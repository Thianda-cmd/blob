"use client";

import { AnimatePresence, motion } from "motion/react";
import { PanelRight, Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { PageTopBar } from "@/components/page/PageTopBar";
import { useAutosave } from "@/components/page/useAutosave";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { deckText } from "@/i18n/messages/deck";
import { createClient } from "@/lib/supabase/client";
import type { Deck, DeckContent, DeckTheme, DeckThemeSpec, Page, Slide, SlideLayout, SlideTransition } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IMAGE_TYPES,
  deckPalette,
  deckPlainText,
  MAX_IMAGE_BYTES,
  newSlide,
  normalizeDeck,
  presetSpec,
  sectionNumbers,
  specPalette,
  switchLayout,
} from "./deck";
import { DeckInspector, type InspectorTab } from "./DeckInspector";
import { SlideMenu, SlideRail, SlideStrip } from "./SlideRail";
import { SlideView } from "./SlideView";
import { ThemePicker } from "./ThemePicker";

type DeckPatch = { content: DeckContent; title: string; plain_text: string };

/** Editor width (px) from which the right panel shows by default. Matches the container query below. */
const INSPECTOR_MIN_WIDTH = 980;

/**
 * Below 560px of editor width (phones) the rail gives way to a filmstrip under the slide and the
 * panel opens as a sheet below the slide. The stage reads these through CSS variables:
 * side and top/bottom padding, and the filmstrip's height.
 */
const STAGE_VARS =
  "[--pad-x:64px] [--pad-y:48px] [--strip:0px] @max-[559px]/editor:[--pad-x:32px] @max-[559px]/editor:[--pad-y:32px] @max-[559px]/editor:[--strip:100px]";

/** Phones: the panel is a sheet over the lower part of the editor, starting just below the slide (title row + slide). */
const PHONE_SHEET = [
  "@max-[559px]/editor:absolute @max-[559px]/editor:inset-x-0 @max-[559px]/editor:bottom-0 @max-[559px]/editor:z-20 @max-[559px]/editor:w-auto",
  "@max-[559px]/editor:top-[min(84px+(100cqw-32px)*9/16,50%)]",
  "@max-[559px]/editor:rounded-t-2xl @max-[559px]/editor:border-l-0 @max-[559px]/editor:border-t @max-[559px]/editor:shadow-pop",
].join(" ");

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

export function DeckEditor({ page }: { page: Page }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePage, userId } = useWorkspace();
  const t = useMessages(deckText);

  const [deck, setDeck] = useState<Deck>(() => normalizeDeck(page.content));
  const [title, setTitle] = useState(page.title);
  const [selectedId, setSelectedId] = useState(() => {
    const n = Number(searchParams.get("slide"));
    return (Number.isInteger(n) && deck.slides[n - 1]?.id) || deck.slides[0].id;
  });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ slide: Slide; index: number } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  // "auto" lets a container query decide (hidden when the editor is narrow).
  const [inspector, setInspector] = useState<"auto" | "open" | "closed">("auto");
  const [tab, setTab] = useState<InspectorTab>("slide");

  const deckRef = useRef(deck);
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const save = useCallback(
    async (patch: Partial<DeckPatch>) => {
      const { error } = await createClient().from("pages").update(patch).eq("id", page.id);
      return !error;
    },
    [page.id],
  );
  const { state, schedule, flush } = useAutosave<DeckPatch>(save);

  // Every structural or content change goes through here, so the saved row always matches the screen.
  const change = useCallback(
    (fn: (d: Deck) => Deck) => {
      const next = fn(deckRef.current);
      if (next === deckRef.current) return;
      deckRef.current = next;
      setDeck(next);
      schedule({ content: next, plain_text: deckPlainText(next) });
    },
    [schedule],
  );

  const updateSlide = useCallback(
    (id: string, patch: Partial<Slide>) =>
      change((d) => ({ ...d, slides: d.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [change],
  );

  const index = Math.max(0, deck.slides.findIndex((s) => s.id === selectedId));
  const selected = deck.slides[index];
  const palette = useMemo(() => deckPalette(deck.theme, deck.custom), [deck.theme, deck.custom]);
  const customPalette = useMemo(() => (deck.custom ? specPalette(deck.custom) : null), [deck.custom]);
  const sections = useMemo(() => sectionNumbers(deck.slides), [deck.slides]);

  // Coming back from the presenter: we opened on ?slide=N, now tidy the URL.
  useEffect(() => {
    if (searchParams.has("slide")) window.history.replaceState(null, "", window.location.pathname);
  }, [searchParams]);

  // Focus the first text field of the current slide after adding one.
  useEffect(() => {
    if (!focusNonce) return;
    const el = stageRef.current?.querySelector("textarea");
    el?.focus();
  }, [focusNonce]);

  // Undo toast hides itself.
  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), 6000);
    return () => clearTimeout(t);
  }, [deleted]);

  const present = useCallback(async () => {
    await flush();
    router.push(`/present/${page.id}?slide=${index + 1}`);
  }, [flush, router, page.id, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void present();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  // Slide operations ----------------------------------------------------------

  const addSlide = (layout: SlideLayout) => {
    const slide = newSlide(layout);
    const at = deckRef.current.slides.findIndex((s) => s.id === selected.id) + 1;
    change((d) => ({ ...d, slides: [...d.slides.slice(0, at), slide, ...d.slides.slice(at)] }));
    setSelectedId(slide.id);
    setFocusNonce((n) => n + 1);
  };

  const duplicateSlide = (id: string) => {
    const slides = deckRef.current.slides;
    const at = slides.findIndex((s) => s.id === id);
    if (at < 0) return;
    const copy = { ...slides[at], id: crypto.randomUUID() };
    change((d) => ({ ...d, slides: [...d.slides.slice(0, at + 1), copy, ...d.slides.slice(at + 1)] }));
    setSelectedId(copy.id);
  };

  const deleteSlide = (id: string) => {
    const slides = deckRef.current.slides;
    if (slides.length <= 1) {
      blob.say(t.needsOneSlide, { mood: "thinking" });
      return;
    }
    const at = slides.findIndex((s) => s.id === id);
    if (at < 0) return;
    if (id === selected.id) setSelectedId((slides[at + 1] ?? slides[at - 1]).id);
    setDeleted({ slide: slides[at], index: at });
    change((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== id) }));
  };

  const undoDelete = () => {
    if (!deleted) return;
    const { slide, index: at } = deleted;
    change((d) => ({ ...d, slides: [...d.slides.slice(0, at), slide, ...d.slides.slice(at)] }));
    setSelectedId(slide.id);
    setDeleted(null);
  };

  const moveSlide = (id: string, delta: number) =>
    change((d) => {
      const from = d.slides.findIndex((s) => s.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= d.slides.length) return d;
      const slides = [...d.slides];
      const [s] = slides.splice(from, 1);
      slides.splice(to, 0, s);
      return { ...d, slides };
    });

  const toggleInspector = () => {
    const visible = inspector === "open" || (inspector === "auto" && (bodyRef.current?.offsetWidth ?? 0) >= INSPECTOR_MIN_WIDTH);
    setInspector(visible ? "closed" : "open");
  };

  const setTheme = (theme: DeckTheme) => change((d) => (d.theme === theme || (theme === "custom" && !d.custom) ? d : { ...d, theme }));
  const setCustom = (custom: DeckThemeSpec) => change((d) => ({ ...d, theme: "custom", custom }));
  const setDeckTransition = (transition: SlideTransition, everywhere: boolean) =>
    change((d) => ({ ...d, transition, slides: everywhere ? d.slides.map((s) => (s.transition === null ? s : { ...s, transition: null })) : d.slides }));
  const setLayout = (layout: SlideLayout) => change((d) => ({ ...d, slides: d.slides.map((s) => (s.id === selected.id ? switchLayout(s, layout) : s)) }));

  const customize = () => {
    if (deck.theme !== "custom") setCustom(presetSpec(deck.theme));
    setTab("theme");
    if (!(bodyRef.current && bodyRef.current.offsetWidth >= INSPECTOR_MIN_WIDTH && inspector === "auto")) setInspector("open");
  };

  const onTitle = (value: string) => {
    const next = value.slice(0, 200);
    setTitle(next);
    void updatePage(page.id, { title: next }, { local: true });
    schedule({ title: next });
  };

  const upload = useCallback(
    async (slideId: string, file: File) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        blob.say(t.imageType, { mood: "worried" });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        blob.say(t.imageSize, { mood: "worried" });
        return;
      }
      setUploadingId(slideId);
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type] ?? "png"}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      setUploadingId(null);
      if (error) {
        blob.say(t.uploadFailed, { mood: "worried" });
        blob.react("shake", "worried");
        return;
      }
      updateSlide(slideId, { image: supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl });
      blob.react("jump", "happy");
    },
    [userId, updateSlide, t],
  );

  const onSlideChange = useCallback((patch: Partial<Slide>) => updateSlide(selected.id, patch), [updateSlide, selected.id]);
  const onSlideUpload = useCallback((file: File) => void upload(selected.id, file), [upload, selected.id]);

  return (
    <>
      <PageTopBar
        pageId={page.id}
        saveState={state}
        actions={
          <>
            <button
              type="button"
              onClick={toggleInspector}
              className={cn(
                "grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9",
                inspector === "open" && "bg-hover text-ink",
              )}
              aria-label={t.panelToggle}
              aria-pressed={inspector === "open"}
              title={t.panelTitle}
            >
              <PanelRight className="size-4" />
            </button>
            <ThemePicker theme={deck.theme} palette={palette} customPalette={customPalette} slide={selected} onChange={setTheme} onCustomize={customize} />
            {/* Phones: just the play icon (the label stays for screen readers). The theme lives in the panel there. */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => void present()}
              title={t.presentTitle}
              className="ml-1 max-sm:aspect-square max-sm:px-0 [@media(hover:none)]:h-9"
            >
              <Play className="size-3 fill-current" /> <span className="max-sm:sr-only">{t.present}</span>
            </Button>
          </>
        }
      />
      <div ref={bodyRef} className="@container/editor relative flex min-h-0 flex-1 border-t border-line">
        <SlideRail
          // Tablets: an opened panel takes the rail's place, so the slide stays big enough to see its changes.
          className={inspector === "open" ? "hidden @min-[980px]/editor:flex" : "hidden @min-[560px]/editor:flex"}
          slides={deck.slides}
          palette={palette}
          sections={sections}
          selectedId={selected.id}
          onSelect={setSelectedId}
          onReorder={(slides) => change((d) => ({ ...d, slides }))}
          onAdd={addSlide}
          onDuplicate={duplicateSlide}
          onDelete={deleteSlide}
          onMove={moveSlide}
          onEnter={() => setFocusNonce((n) => n + 1)}
        />

        <section className="relative flex min-w-0 flex-1 flex-col bg-paper" aria-label={t.editor}>
          <div className="relative min-h-0 flex-1 [container-type:size]">
            <div className={cn("absolute inset-0 flex flex-col items-center px-8 py-6 @max-[559px]/editor:px-4 @max-[559px]/editor:py-4", STAGE_VARS)}>
              {/* Spare height goes mostly below the slide, so a narrow (portrait) stage doesn't float mid-screen. */}
              <div aria-hidden className="max-h-12 min-h-0 flex-1 @max-[559px]/editor:hidden" />
              <div className="flex shrink-0 flex-col" style={{ width: "min(100cqw - var(--pad-x), (100cqh - var(--pad-y) - 56px - var(--strip)) * 16 / 9)" }}>
                <div className="mb-3 flex h-11 items-end gap-3">
                  <input
                    value={title}
                    onChange={(e) => onTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setFocusNonce((n) => n + 1);
                      }
                    }}
                    maxLength={200}
                    placeholder={t.untitled}
                    aria-label={t.titleLabel}
                    title={title || undefined}
                    className="min-w-0 flex-1 truncate bg-transparent font-display text-[24px] font-semibold tracking-[-0.025em] text-ink outline-none placeholder:text-ink-3/60"
                  />
                  <span className="shrink-0 pb-1.5 text-[12px] tabular-nums text-ink-3">
                    {t.slideOf(index + 1, deck.slides.length)}
                  </span>
                  {/* Phones: the rail's actions (the filmstrip below handles moving between slides). */}
                  <div className="shrink-0 pb-0.5 @min-[560px]/editor:hidden">
                    <SlideMenu
                      index={index}
                      total={deck.slides.length}
                      onDuplicate={() => duplicateSlide(selected.id)}
                      onMove={(delta) => moveSlide(selected.id, delta)}
                      onDelete={() => deleteSlide(selected.id)}
                    />
                  </div>
                </div>
                <div ref={stageRef} className="aspect-video w-full">
                  <SlideView
                    slide={selected}
                    palette={palette}
                    ordinal={sections.get(selected.id)}
                    mode="edit"
                    onChange={onSlideChange}
                    onUpload={onSlideUpload}
                    uploading={uploadingId === selected.id}
                    frameClassName="rounded-xl shadow-[0_1px_2px_rgb(0_0_0/0.05),0_16px_40px_-16px_rgb(0_0_0/0.22)] ring-1 ring-ink/8 dark:ring-white/12"
                  />
                </div>
                <SlideStrip
                  className="@min-[560px]/editor:hidden"
                  slides={deck.slides}
                  palette={palette}
                  sections={sections}
                  selectedId={selected.id}
                  onSelect={setSelectedId}
                  onAdd={addSlide}
                />
              </div>
              <div aria-hidden className="min-h-0 flex-1" />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
            <AnimatePresence>
              {deleted && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 520, damping: 32 }}
                  className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink py-1.5 pl-3.5 pr-1.5 text-[13px] text-paper shadow-pop"
                  role="status"
                >
                  {t.deleted(deleted.index + 1)}
                  <button
                    type="button"
                    onClick={undoDelete}
                    className="rounded-lg px-2 py-1 font-medium text-blob transition-colors hover:bg-paper/10"
                  >
                    {t.undo}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <DeckInspector
          className={cn(inspector === "auto" ? "hidden @min-[980px]/editor:flex" : inspector === "open" ? "flex" : "hidden", PHONE_SHEET)}
          onClose={() => setInspector("closed")}
          tab={tab}
          onTab={setTab}
          deck={deck}
          palette={palette}
          sections={sections}
          slide={selected}
          index={index}
          uploading={uploadingId === selected.id}
          onLayout={setLayout}
          onChange={onSlideChange}
          onUpload={onSlideUpload}
          onTheme={setTheme}
          onCustom={setCustom}
          onDeckTransition={setDeckTransition}
        />
      </div>
    </>
  );
}
