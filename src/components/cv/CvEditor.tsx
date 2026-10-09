"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Eye, FileDown, Palette, PencilLine, TriangleAlert } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { blob } from "@/components/blob/bus";
import { PageTopBar } from "@/components/page/PageTopBar";
import { useAutosave } from "@/components/page/useAutosave";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { CvPrint, type CvLayoutInfo } from "@/cv/CvDocument";
import { cvFileName, cvPlainText, cvProgress, cvTitle, normalizeCv, type CvCheck } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useLocale, useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { createClient } from "@/lib/supabase/client";
import type { Page } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CvForm } from "./CvForm";
import { DesignPanel, type PanelTab } from "./DesignPanel";
import type { LengthIssue } from "./editor/Checklist";
import { addSection, checkTarget, revealPart } from "./editor/jump";
import { LayoutProbe } from "./editor/LayoutProbe";
import { longestPart, type LongPart } from "./editor/overflow";
import { PdfDialog, pdfExplained } from "./editor/PdfDialog";
import { PreviewPane, type Zoom } from "./editor/PreviewPane";
import { ProgressRing } from "./editor/ProgressRing";
import { Segmented } from "./editor/Segmented";
import { useIsMac, useMediaQuery } from "./editor/useMedia";
import type { CvChange } from "./types";

type CvPatch = { content: Cv; title: string; plain_text: string };
type Mode = "edit" | "design" | "preview";

/** Remembers whether the design panel was open (this browser only). */
const PANEL_KEY = "blob-cv-panel";
/** From this preview width the design panel sits beside the pages; below it, it lies over them. */
const PANEL_BESIDE = 560;

const never = () => () => {};

/**
 * The CV editor. Wide screens: the form on the left, the live A4 pages on the right with a slim
 * toolbar, and the design panel beside them. Tablets and phones: Edit · Design · Preview.
 *
 * Drawn in the browser only: a CV stored without ids (a fresh, empty one) gets new random ids each
 * time it is read, so the server's ids would not match the browser's.
 */
export function CvEditor({ page }: { page: Page }) {
  const browser = useSyncExternalStore(never, () => true, () => false);
  if (!browser)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageTopBar pageId={page.id} saveState="saved" />
        <div className="min-h-0 flex-1 border-t border-line bg-surface" />
      </div>
    );
  return <Editor page={page} />;
}

function Editor({ page }: { page: Page }) {
  const t = useMessages(cvEditorText);
  const locale = useLocale();
  const { updatePage } = useWorkspace();
  const [cv, setCv] = useState<Cv>(() => normalizeCv(page.content, locale));
  const cvRef = useRef(cv);
  // The page title follows the name ("Lebenslauf – Lena Schneider") until someone renames the page.
  const autoTitle = useRef(!page.title.trim() || page.title === cvTitle(cv));

  const save = useCallback(
    async (patch: Partial<CvPatch>) => {
      const { error } = await createClient().from("pages").update(patch).eq("id", page.id);
      return !error;
    },
    [page.id],
  );
  const { state, schedule } = useAutosave<CvPatch>(save);

  const change: CvChange = useCallback(
    (fn) => {
      const next = fn(cvRef.current);
      if (next === cvRef.current) return;
      cvRef.current = next;
      setCv(next);
      const patch: Partial<CvPatch> = { content: next, plain_text: cvPlainText(next) };
      if (autoTitle.current) {
        patch.title = cvTitle(next);
        updatePage(page.id, { title: patch.title }, { local: true });
      }
      schedule(patch);
    },
    [schedule, updatePage, page.id],
  );

  // Typing stays quick: the pages catch up a moment later.
  const preview = useDeferredValue(cv);
  const wide = useMediaQuery("(min-width: 1024px)");
  const mac = useIsMac();
  const [mode, setMode] = useState<Mode>("edit");
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("design");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [layout, setLayout] = useState<CvLayoutInfo | null>(null);
  const [pdf, setPdf] = useState<"idle" | "explain" | "print">("idle");
  const progress = cvProgress(cv);
  const paneRef = useRef<HTMLElement>(null);

  // The engine reports after every re-measure: only a different page count or overflow is news.
  const onLayout = useCallback(
    (info: CvLayoutInfo) => setLayout((l) => (l && l.pages === info.pages && l.overflow === info.overflow ? l : info)),
    [],
  );

  useEffect(() => {
    try {
      // Not where the panel would cover the pages (a narrow window with the sidebar open).
      const room = (paneRef.current?.clientWidth ?? 0) >= PANEL_BESIDE;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the preference after mount
      if (room && localStorage.getItem(PANEL_KEY) === "open") setPanelOpen(true);
    } catch {}
  }, []);

  const showPanel = useCallback((open: boolean, next?: PanelTab) => {
    if (next) setTab(next);
    setPanelOpen(open);
    try {
      localStorage.setItem(PANEL_KEY, open ? "open" : "closed");
    } catch {}
  }, []);
  /** The toolbar buttons: open the panel on that tab, or close it if it already shows it. */
  const togglePanel = (next: PanelTab) => showPanel(!(panelOpen && tab === next), next);

  // Escape closes the panel where it lies over the pages (not while a dialog has the Escape key).
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      if (document.querySelector("[data-cv-scrim]")?.getClientRects().length) showPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, showPanel]);

  // Blob cheers once when the checklist is complete (not when a finished CV is opened, and not
  // while something is cut off).
  const overflow = Boolean(layout?.overflow);
  const lastProgress = useRef(progress);
  const cheered = useRef(false);
  useEffect(() => {
    if (progress === 100 && lastProgress.current < 100 && !cheered.current && !overflow) {
      cheered.current = true;
      blob.react("celebrate", "excited", 3200);
      blob.say(t.cheer, { mood: "excited" });
    }
    lastProgress.current = progress;
  }, [progress, overflow, t.cheer]);

  // From the checklist (or the "too long" notice) to the right card of the form.
  const reveal = useCallback(
    (part: string, focus?: string[], entry?: { id: string; heading: string }) => {
      if (!wide) setMode("edit");
      revealPart(part, focus, entry);
    },
    [wide],
  );
  const jump = useCallback(
    (check: CvCheck) => {
      const target = checkTarget(cvRef.current, check);
      let part = target.part;
      if (target.add) {
        // No such section yet: add it (with its first row), then go there.
        const added = addSection(cvRef.current, target.add);
        change(() => added.cv);
        part = added.id;
      }
      reveal(part, target.focus);
    },
    [change, reveal],
  );

  // The layout comes from the preview, or (phones, in Edit or Design) from an unseen copy.
  const culprit = useMemo(() => (overflow ? longestPart(preview) : null), [overflow, preview]);
  const culpritRef = useRef(culprit);
  useEffect(() => {
    culpritRef.current = culprit;
  });
  // Straight to printing only for those who know the way and when nothing is cut off: otherwise the
  // dialog, with its warning, every time.
  const startPdf = useCallback(() => setPdf((p) => (p !== "idle" ? p : pdfExplained() && !culpritRef.current ? "print" : "explain")), []);

  // Ctrl/Cmd+P prints the CV, not the editor around it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        startPdf();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startPdf]);

  // Printing from the browser's menu would print the editor around the CV: Blob points to the PDF
  // button, and the paper only says so (see the print style below).
  useEffect(() => {
    if (pdf !== "idle") return;
    const onBefore = () => blob.say(t.printTip, { mood: "happy" });
    window.addEventListener("beforeprint", onBefore);
    return () => window.removeEventListener("beforeprint", onBefore);
  }, [pdf, t.printTip]);

  const pdfKeys = mac ? "⌘P" : locale === "de" ? "Strg+P" : "Ctrl+P";
  const lengthText = (c: LongPart) => (c.what.type === "profile" ? t.tooLongProfile : c.what.type === "untitled" ? t.tooLongUntitled(c.what.section) : t.tooLong(c.what.name));
  const showCulprit = (c: LongPart) => reveal(c.part, undefined, c.entry);
  const issue: LengthIssue | null = culprit
    ? { text: lengthText(culprit), onShow: () => showCulprit(culprit) }
    : layout && layout.pages > 2
      ? { text: t.tooManyPages(layout.pages) }
      : null;

  const pdfButton = (big?: boolean) => (
    <Button
      variant="primary"
      size={big ? "lg" : "sm"}
      onClick={startPdf}
      loading={pdf === "print"}
      title={t.pdfTitle(pdfKeys)}
      className={cn("shrink-0", big && "max-[400px]:px-3.5")}
    >
      <FileDown className={big ? "size-4" : "size-3.5"} /> {t.pdf}
    </Button>
  );

  const tooLong = culprit && (
    <div role="status" className="sticky left-0 top-0 z-10 flex items-start gap-2.5 border-b border-danger/20 bg-[color-mix(in_oklab,var(--danger)_9%,var(--surface))] px-4 py-2.5">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="text-ink">{lengthText(culprit)}</p>
        {/* Not in a narrow column (the design panel open beside the pages): the warning alone says enough there. */}
        <p className="mt-0.5 text-[12.5px] text-ink-3 @max-[420px]/pages:hidden">{t.tooLongHint}</p>
      </div>
      <Button size="sm" onClick={() => showCulprit(culprit)}>
        {t.tooLongShow}
      </Button>
    </div>
  );

  const panel = (className: string, onClose?: () => void) => (
    <DesignPanel cv={cv} change={change} tab={tab} onTab={setTab} onJump={jump} onClose={onClose} issue={issue} className={className} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageTopBar pageId={page.id} saveState={state} />

      {/* Tablets and phones: one view at a time, the PDF always in reach. */}
      <div className="flex shrink-0 items-center gap-2 border-y border-line bg-surface px-3 py-2 lg:hidden">
        <Segmented
          kind="tabs"
          size="md"
          label={t.views}
          value={mode}
          onChange={setMode}
          // Each label as wide as it needs: "Bearbeiten" is twice as long as "Design".
          equal={false}
          className="min-w-0 flex-1 sm:max-w-[420px]"
          options={[
            { id: "edit", label: <><PencilLine className="hidden sm:block" aria-hidden />{t.modes.edit}</> },
            { id: "design", label: <><Palette className="hidden sm:block" aria-hidden />{t.modes.design}</> },
            { id: "preview", label: <><Eye className="hidden sm:block" aria-hidden />{t.modes.preview}</> },
          ]}
        />
        <span className="ml-auto" />
        {pdfButton(true)}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-line lg:grid lg:grid-cols-[clamp(330px,42%,440px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:border-t">
        <div
          aria-label={t.form}
          role="region"
          className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface lg:border-r lg:border-line", mode !== "edit" && "max-lg:hidden")}
        >
          <button
            type="button"
            onClick={() => {
              setTab("check");
              setMode("design");
            }}
            className="flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left transition-colors hover:bg-hover/60 lg:hidden"
          >
            <ProgressRing value={progress} size={30} stroke={3.5}>
              <span className="text-[9.5px] font-semibold tabular-nums text-ink">{progress}</span>
            </ProgressRing>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] text-ink">
              {issue && <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden />}
              <span className="min-w-0">{progress < 100 ? t.progressStrip(progress) : issue ? t.progressStripLong : t.progressStripDone}</span>
            </span>
            <span className="flex shrink-0 items-center text-[13.5px] font-medium text-blob-ink">
              {t.checklist}
              <ChevronRight className="size-4" />
            </span>
          </button>
          <CvForm cv={cv} change={change} />
        </div>

        {wide ? (
          <PreviewPane
            paneRef={paneRef}
            className="min-h-0 flex-1 max-lg:hidden"
            cv={preview}
            zoom={zoom}
            onZoom={setZoom}
            pages={layout?.pages ?? null}
            onLayout={onLayout}
            notice={tooLong}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => togglePanel("check")}
                  aria-pressed={panelOpen && tab === "check"}
                  title={t.progressTitle(progress)}
                  aria-label={t.progressTitle(progress)}
                  className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12.5px] font-medium tabular-nums text-ink-2 transition-colors hover:bg-hover hover:text-ink aria-pressed:bg-hover aria-pressed:text-ink"
                >
                  <ProgressRing value={progress} size={18} stroke={2.5} />
                  <span className="hidden @min-[600px]/preview:inline">{t.progressShort(progress)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => togglePanel("design")}
                  aria-pressed={panelOpen && tab === "design"}
                  aria-label={t.designToggle}
                  title={t.designToggleTitle}
                  className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink aria-pressed:bg-hover aria-pressed:text-ink"
                >
                  <Palette className="size-4" />
                  <span className="hidden @min-[480px]/preview:inline">{t.designToggle}</span>
                </button>
                <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
                {pdfButton()}
              </>
            }
            side={
              <AnimatePresence initial={false}>
                {/* Where the panel lies over the pages, a tap on them closes it. */}
                {panelOpen && (
                  <motion.div
                    key="scrim"
                    data-cv-scrim
                    aria-hidden
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onPointerDown={() => showPanel(false)}
                    className="absolute inset-0 z-10 bg-ink/5 @min-[560px]/preview:hidden"
                  />
                )}
                {panelOpen && (
                  <motion.div
                    key="panel"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16, transition: { duration: 0.12 } }}
                    transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    className="absolute inset-y-0 right-0 z-20 flex w-[300px] border-l border-line shadow-pop @min-[560px]/preview:static @min-[560px]/preview:shadow-none"
                  >
                    {panel("min-w-0 flex-1", () => showPanel(false))}
                  </motion.div>
                )}
              </AnimatePresence>
            }
          />
        ) : mode === "preview" ? (
          <PreviewPane className="min-h-0 flex-1" cv={preview} zoom={zoom} onZoom={setZoom} pages={layout?.pages ?? null} onLayout={onLayout} notice={tooLong} />
        ) : mode === "design" ? (
          panel("min-h-0 flex-1")
        ) : null}
      </div>
      {!wide && mode !== "preview" && <LayoutProbe cv={preview} onLayout={onLayout} />}

      <PdfDialog
        open={pdf === "explain"}
        onClose={() => setPdf("idle")}
        onPrint={() => setPdf("print")}
        warning={
          culprit && (
            <p className="mt-3 flex gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] leading-snug text-ink">
              <TriangleAlert className="mt-px size-4 shrink-0 text-danger" />
              <span>
                {lengthText(culprit)} {t.tooLongHint}
              </span>
            </p>
          )
        }
      />
      {pdf === "print" ? (
        <CvPrint cv={cv} fileName={cvFileName(cv)} onDone={() => setPdf("idle")} />
      ) : (
        <style>{`@media print { html, body { height: auto !important; min-height: 0 !important; } body > * { display: none !important; } body::before { content: ${JSON.stringify(t.printNote)}; display: block; margin: 25mm 20mm; font: 14pt/1.5 system-ui, sans-serif; color: #000; } }`}</style>
      )}
    </div>
  );
}
