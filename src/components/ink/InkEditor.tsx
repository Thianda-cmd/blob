"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, Eraser, Eye, FileDown, GalleryVerticalEnd, ImageDown, Maximize2, NotebookText, Palette, Plus, Scissors, CopyPlus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { blob } from "@/components/blob/bus";
import { useDark } from "@/components/editor/blocks/useDark";
import { download } from "@/components/notes/transfer";
import { PageTopBar } from "@/components/page/PageTopBar";
import type { SaveState } from "@/components/page/useAutosave";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { usePhone, useTouch } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { inkText } from "@/i18n/messages/ink";
import { InkDoc } from "@/ink/doc";
import { InkEngine, type EngineState, type Frame } from "@/ink/engine";
import { ImageCache } from "@/ink/images";
import { isPenTool, type InkColor, type InkContent } from "@/ink/model";
import { PEN_COLORS } from "@/ink/pens";
import { exportPdf, exportPng } from "@/ink/pdf";
import { buildPreview } from "@/ink/preview";
import { inkColor, setTextFont } from "@/ink/render";
import { InkSync, markOpen, type SyncStatus } from "@/ink/sync";
import { fileUrl, MAX_FILE_BYTES, uploadFile } from "@/lib/files";
import { useLive } from "@/lib/live";
import { blobApp } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Member, Page } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pages } from "./Pages";
import { PaperPanel } from "./Paper";
import { Toolbar } from "./Toolbar";
import { useInkSettings } from "./useInkSettings";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/** Room above the first sheet for the title (CSS pixels). */
const HEAD = 62;

const IDLE: EngineState = { page: 0, pages: 0, zoomed: false, canUndo: false, canRedo: false, selection: null, moving: false, fingersDraw: true, penSeen: false, text: null, snapped: 0 };
const noop = () => () => {};

const posKey = (id: string) => `blob-ink-pos:${id}`;
function readPosition(id: string) {
  try {
    const v = JSON.parse(sessionStorage.getItem(posKey(id)) ?? "null");
    return v && typeof v.page === "number" ? (v as { page: number; offset: number; zoom: number }) : null;
  } catch {
    return null;
  }
}

/** A handwritten note: sheets of paper to write and draw on with a pen, a finger or a mouse. */
export function InkEditor({ page, role = "owner", members = [] }: { page: Page; role?: AccessRole; members?: Member[] }) {
  const t = useMessages(inkText);
  const { updatePage, userId, profile } = useWorkspace();
  const readOnly = role === "viewer";
  const shared = members.length > 1;
  const dark = useDark();
  const phone = usePhone();
  const touch = useTouch();
  const { settings, update, recent, remember, lastPen } = useInkSettings();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<{ engine: InkEngine; sync: InkSync; images: ImageCache; doc: InkDoc } | null>(null);
  const engine = parts?.engine ?? null;
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [title, setTitle] = useState(page.title);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const [writer, setWriter] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const state = useSyncExternalStore(engine?.subscribe ?? noop, engine?.getState ?? (() => IDLE), () => IDLE);

  // The surface, its saving and the note's things, for as long as the note is open.
  useEffect(() => {
    const root = surfaceRef.current;
    if (!root) return;
    setTextFont(getComputedStyle(document.body).fontFamily);
    const doc = new InkDoc();
    const sync = new InkSync({ page: page.id, user: userId, doc, canEdit: role !== "viewer", keep: !!blobApp() });
    let eng: InkEngine | null = null;
    const images = new ImageCache((path) => fileUrl(path), (path) => eng?.imageLoaded(path));
    eng = new InkEngine(root, { doc, sync, readOnly: role === "viewer", dark: document.documentElement.dataset.theme === "dark", images });
    eng.head = HEAD;
    setParts({ engine: eng, sync, images, doc });
    const unmark = markOpen(page.id);
    const offStatus = sync.subscribe(() => setStatus(sync.status));
    let alive = true;
    void sync.start().then(() => {
      if (!alive || !eng) return;
      eng.ensureSheet(page.id);
      eng.place(readPosition(page.id));
      setLoaded(true);
      setStatus(sync.status);
    });
    const keepPosition = () => {
      try {
        if (eng) sessionStorage.setItem(posKey(page.id), JSON.stringify(eng.position()));
      } catch {
        // Not kept.
      }
    };
    window.addEventListener("pagehide", keepPosition);
    return () => {
      alive = false;
      keepPosition();
      window.removeEventListener("pagehide", keepPosition);
      void sync.flush().finally(() => sync.stop());
      unmark();
      offStatus();
      eng?.destroy();
    };
    // One surface per note (the role and theme are passed on below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, userId]);

  useEffect(() => engine?.setDark(dark), [engine, dark]);
  useEffect(() => {
    engine?.setReadOnly(readOnly);
    parts?.sync.setCanEdit(!readOnly);
  }, [engine, parts, readOnly]);
  useEffect(() => engine?.setSettings(settings), [engine, settings]);

  // The first time a pen is used here: fingers scroll from now on. Say so once.
  const hinted = useRef(false);
  useEffect(() => {
    if (!state.penSeen || hinted.current || settings.fingers !== "auto") return;
    hinted.current = true;
    try {
      if (localStorage.getItem("blob-ink-pen-hint")) return;
      localStorage.setItem("blob-ink-pen-hint", "1");
    } catch {
      return;
    }
    blob.say(t.fingersHint, { mood: "happy", ms: 6000 });
  }, [state.penSeen, settings.fingers, t.fingersHint]);

  // Who else is here (shared notes), and who just wrote something.
  const live = useLive(shared ? `page:${page.id}` : null, { user_id: userId, name: profile.full_name ?? "", avatar_url: profile.avatar_url });
  const peersRef = useRef(live.peers);
  useEffect(() => {
    peersRef.current = live.peers;
  });
  useEffect(() => {
    if (!parts) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = parts.sync.onRemoteItems((_items, by) => {
      const peer = peersRef.current.find((p) => p.user_id === by);
      const who = peer?.name || members.find((m) => m.user_id === by)?.full_name;
      if (!who) return;
      setWriter(who.split(" ")[0]);
      clearTimeout(timer);
      timer = setTimeout(() => setWriter(null), 2500);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [parts, members]);

  // The preview for lists (and the text in text boxes, for search), saved a moment after changes.
  const savedPreview = useRef<string | null>(null);
  useEffect(() => {
    if (!parts || readOnly) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      if (!parts.sync.loaded) return;
      const preview = buildPreview(parts.doc);
      const words = parts.doc
        .all()
        .flatMap((i) => (i.kind === "text" ? [i.text] : []))
        .join("\n")
        .slice(0, 20000);
      const key = JSON.stringify([preview, words]);
      if (key === savedPreview.current) return;
      savedPreview.current = key;
      const content: InkContent = { v: 1, preview };
      void createClient().from("pages").update({ content, plain_text: words }).eq("id", page.id);
    };
    const off = parts.doc.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(save, 2500);
    });
    // What the server had: no need to save it again.
    savedPreview.current = JSON.stringify([(page.content as InkContent | null)?.preview ?? null, page.plain_text ?? ""]);
    return () => {
      off();
      clearTimeout(timer);
      save();
    };
  }, [parts, readOnly, page.id, page.content, page.plain_text]);

  // The pages overview draws again as things change.
  useEffect(() => {
    if (!pagesOpen || !parts) return;
    return parts.doc.subscribe(() => bump());
  }, [pagesOpen, parts]);

  // The title: shown above the first sheet, saved a moment after typing.
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changeTitle = (v: string) => {
    const next = v.slice(0, 200);
    setTitle(next);
    void updatePage(page.id, { title: next }, { local: true });
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => void updatePage(page.id, { title: next }), 600);
  };
  useEffect(() => () => clearTimeout(titleTimer.current), []);

  // Floating things follow the sheets (no React render per frame).
  const titleBox = useRef<HTMLDivElement>(null);
  const footBox = useRef<HTMLButtonElement>(null);
  const selBox = useRef<HTMLDivElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const zoomLabel = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<Frame | null>(null);
  useEffect(() => {
    if (!engine) return;
    return engine.onFrame((f) => {
      frameRef.current = f;
      const title = titleBox.current;
      if (title) {
        title.style.transform = `translate(${f.head.x}px, ${f.head.y - HEAD + 6}px)`;
        title.style.width = `${f.head.w}px`;
      }
      const foot = footBox.current;
      if (foot) {
        foot.style.display = f.foot ? "" : "none";
        if (f.foot) {
          foot.style.transform = `translate(${f.foot.x}px, ${f.foot.y + 18}px)`;
          foot.style.width = `${f.foot.w}px`;
        }
      }
      const sel = selBox.current;
      if (sel && f.selection) {
        const r = f.selection;
        const w = sel.offsetWidth;
        const parent = sel.parentElement?.clientWidth ?? 0;
        const x = Math.max(8, Math.min(parent - w - 8, r.x + r.w / 2 - w / 2));
        const above = r.y - sel.offsetHeight - 40;
        const y = above > 60 ? above : r.y + r.h + 16;
        sel.style.transform = `translate(${x}px, ${y}px)`;
      }
      const text = textBox.current;
      if (text && f.text) {
        text.style.transform = `translate(${f.text.rect.x}px, ${f.text.rect.y}px)`;
        text.style.width = `${f.text.rect.w}px`;
        text.style.fontSize = `${f.text.fontPx}px`;
        text.style.color = f.text.color;
      }
      if (zoomLabel.current) zoomLabel.current.textContent = t.zoom(Math.round(f.zoom * 100));
    });
  }, [engine, t, state.selection, state.text]);

  // The text box being typed: focused when it opens.
  useEffect(() => {
    const el = textBox.current;
    if (!state.text || !el) return;
    el.value = frameRef.current?.text?.text ?? "";
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    requestAnimationFrame(() => el.focus({ preventScroll: true }));
  }, [state.text]);

  // Colours from the bar: the selection takes them, else the pen in use (the eraser and the
  // lasso hand over to the pen).
  const onColor = useCallback(
    (c: InkColor) => {
      if (engine && state.selection) {
        engine.recolorSelection(c);
        return;
      }
      update((s) => {
        if (s.tool === "text") return { ...s, text: { ...s.text, color: c } };
        const tool = isPenTool(s.tool) ? s.tool : lastPen();
        return { ...s, tool, pens: { ...s.pens, [tool]: { ...s.pens[tool], color: c } } };
      });
    },
    [engine, state.selection, update, lastPen],
  );

  // Pictures.
  const addPicture = async (file: File) => {
    if (!engine) return;
    if (!IMAGE_TYPES.includes(file.type)) return blob.say(t.imageType, { mood: "worried" });
    if (file.size > MAX_FILE_BYTES) return blob.say(t.imageSize, { mood: "worried" });
    blob.say(t.uploading, { mood: "idle", ms: 2500 });
    let w = 1000;
    let h = 750;
    try {
      const bmp = await createImageBitmap(file);
      w = bmp.width;
      h = bmp.height;
      bmp.close();
    } catch {
      // The size comes from the picture once it shows.
    }
    const stored = await uploadFile({ type: "page", id: page.id }, file);
    if (!stored) return blob.say(t.uploadFailed, { mood: "worried" });
    engine.insertPicture(stored.path, w, h);
  };

  // Exports.
  const fileName = (title.trim() || t.untitled).replace(/[\\/:*?"<>|#%]+/g, " ").trim().slice(0, 80);
  const onPdf = async () => {
    if (!parts) return;
    blob.say(t.exporting, { mood: "idle", ms: 2500 });
    try {
      const pdf = await exportPdf(parts.doc, parts.images, title || t.untitled);
      download(`${fileName}.pdf`, pdf, "application/pdf");
      blob.say(t.exported, { mood: "happy" });
    } catch {
      blob.say(t.exportFailed, { mood: "worried" });
    }
  };
  const onPng = async () => {
    if (!parts) return;
    const sheet = parts.doc.sheets[state.page];
    if (!sheet) return;
    try {
      const png = await exportPng(parts.doc, sheet, parts.images, dark);
      download(`${fileName} ${state.page + 1}.png`, png, "image/png");
      blob.say(t.exported, { mood: "happy" });
    } catch {
      blob.say(t.exportFailed, { mood: "worried" });
    }
  };
  const [confirmErase, setConfirmErase] = useState(false);

  // Keys (desktops and tablets with keyboards).
  useEffect(() => {
    if (!engine) return;
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && !typing(e.target)) {
        engine.setSpace(e.type === "keydown");
        if (e.type === "keydown") e.preventDefault();
        return;
      }
      if (e.type !== "keydown" || typing(e.target) || e.altKey) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (mod && k === "z") return run(() => (e.shiftKey ? engine.redo() : engine.undo()));
      if (mod && k === "y") return run(() => engine.redo());
      if (mod && k === "c" && state.selection) return run(() => engine.copySelection());
      if (mod && k === "x" && state.selection) return run(() => engine.cutSelection());
      if (mod && k === "v" && engine.canPaste) return run(() => engine.paste());
      if (mod && k === "d" && state.selection) return run(() => engine.duplicateSelection());
      if (mod && (k === "=" || k === "+")) return run(() => engine.zoomBy(1.25));
      if (mod && k === "-") return run(() => engine.zoomBy(0.8));
      if (mod && k === "0") return run(() => engine.resetZoom());
      if (mod && k === "p") return run(() => void onPdf());
      if (mod) return;
      if ((k === "delete" || k === "backspace") && state.selection) return run(() => engine.deleteSelection());
      if (k === "escape") return run(() => engine.clearSelection());
      if (k === "pagedown") return run(() => engine.scrollBy(engine.screenHeight * 0.85));
      if (k === "pageup") return run(() => engine.scrollBy(-engine.screenHeight * 0.85));
      if (k === "arrowdown") return run(() => engine.scrollBy(80, false));
      if (k === "arrowup") return run(() => engine.scrollBy(-80, false));
      if (readOnly) return;
      const tools: Record<string, () => void> = {
        p: () => update((s) => ({ ...s, tool: lastPen() })),
        h: () => update((s) => ({ ...s, tool: "highlighter" })),
        e: () => update((s) => ({ ...s, tool: "eraser" })),
        l: () => update((s) => ({ ...s, tool: "lasso" })),
        t: () => update((s) => ({ ...s, tool: "text" })),
      };
      if (tools[k]) run(tools[k]);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, state.selection, readOnly, update, lastPen]);

  const saveState: SaveState = status === "waiting" ? "device" : status === "error" || status === "denied" ? "error" : status === "saving" ? "saving" : "saved";
  const sheet = parts?.doc.sheets[state.page] ?? null;

  const paper = (close: () => void) => (
    <PaperPanel
      sheet={sheet}
      dark={dark}
      onApply={(style, all) => {
        engine?.styleSheets(all ? "all" : sheet ? [sheet.id] : [], style);
        void close;
      }}
    />
  );
  const more = (close: () => void) => (
    <>
      {phone && (
        <>
          <MenuItem icon={<GalleryVerticalEnd />} onSelect={() => (close(), setPagesOpen(true))}>
            {t.pages}
          </MenuItem>
          <PaperMenuItem label={t.pageStyle} content={paper} />
          <MenuSeparator />
        </>
      )}
      <MenuItem icon={<Plus />} onSelect={() => (close(), engine?.addSheet(state.page))} disabled={readOnly}>
        {t.addPageAfter}
      </MenuItem>
      <MenuItem icon={<Eraser />} onSelect={() => (close(), setConfirmErase(true))} disabled={readOnly}>
        {t.erasePage}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<ZoomIn />} onSelect={() => engine?.zoomBy(1.25)}>
        {t.zoomIn}
      </MenuItem>
      <MenuItem icon={<ZoomOut />} onSelect={() => engine?.zoomBy(0.8)}>
        {t.zoomOut}
      </MenuItem>
      <MenuItem icon={<Maximize2 />} onSelect={() => (close(), engine?.resetZoom())}>
        {t.fitWidth}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<FileDown />} onSelect={() => (close(), void onPdf())}>
        {t.exportPdf}
      </MenuItem>
      <MenuItem icon={<ImageDown />} onSelect={() => (close(), void onPng())}>
        {t.exportPng}
      </MenuItem>
    </>
  );

  const notice = readOnly ? t.viewOnly : status === "denied" ? t.denied : null;

  return (
    <>
      <PageTopBar
        pageId={page.id}
        saveState={saveState}
        peers={live.peers}
        role={role}
        members={members}
        menu={(close) => (
          <>
            <MenuItem icon={<FileDown />} onSelect={() => (close(), void onPdf())}>
              {t.exportPdf}
            </MenuItem>
            <MenuItem icon={<ImageDown />} onSelect={() => (close(), void onPng())}>
              {t.exportPng}
            </MenuItem>
            <MenuSeparator />
          </>
        )}
      />
      {notice && (
        <p role="status" className="flex items-center gap-2 border-t border-line bg-blob-soft/60 px-4 py-2 text-[13px] text-blob-ink">
          <Eye className="size-3.5 shrink-0" />
          <span className="min-w-0">{notice}</span>
        </p>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden border-t border-line" data-ink-surface>
        <div
          ref={surfaceRef}
          role="application"
          aria-label={t.surface}
          aria-roledescription={t.kind}
          className={cn("absolute inset-0 touch-none select-none overscroll-none outline-none [-webkit-touch-callout:none] [-webkit-user-select:none]", settings.tool === "text" && !readOnly ? "cursor-text" : settings.tool === "lasso" ? "cursor-crosshair" : "cursor-default")}
          style={{ WebkitTapHighlightColor: "transparent" } as CSSProperties}
        />

        {/* The title, above the first sheet (it scrolls with the pages). */}
        <div ref={titleBox} className="pointer-events-none absolute left-0 top-0 flex h-[50px] items-end will-change-transform">
          <input
            value={title}
            readOnly={readOnly}
            onChange={(e) => changeTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder={t.untitled}
            aria-label={t.titleLabel}
            spellCheck
            className="pointer-events-auto w-full min-w-0 truncate bg-transparent font-display text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink outline-none placeholder:text-ink-3/45 sm:text-[28px]"
          />
        </div>

        {/* A new page, under the last one. */}
        {!readOnly && (
          <button
            ref={footBox}
            type="button"
            onClick={() => engine?.addSheet()}
            className="absolute left-0 top-0 flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-2 bg-surface/40 text-[13.5px] font-medium text-ink-3 transition-colors will-change-transform hover:border-blob hover:text-blob-ink"
            style={{ display: "none" }}
          >
            <Plus className="size-4" />
            {t.addPage}
          </button>
        )}

        {/* The text box being typed. */}
        {state.text && (
          <textarea
            ref={textBox}
            rows={1}
            spellCheck
            onChange={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
              engine?.updateText(el.value, el.scrollHeight);
            }}
            onBlur={() => engine?.finishText()}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            className="absolute left-0 top-0 z-10 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-sm bg-transparent p-0 leading-[1.35] outline outline-1 outline-offset-4 outline-blob/50"
            style={{ fontFamily: "inherit" }}
          />
        )}

        {/* What to do with the selection. */}
        <AnimatePresence>
          {state.selection && !state.moving && !readOnly && (
            <motion.div
              ref={selBox}
              key="sel"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 600, damping: 34 }}
              className="absolute left-0 top-0 z-20 flex items-center gap-0.5 rounded-xl border border-line bg-raised p-1 shadow-pop"
              onPointerDown={(e) => e.stopPropagation()}
              role="toolbar"
              aria-label={t.selected(state.selection.count)}
            >
              <SelButton label={t.copy} onClick={() => engine?.copySelection()} touch={touch}>
                <Copy />
              </SelButton>
              <SelButton label={t.cut} onClick={() => engine?.cutSelection()} touch={touch}>
                <Scissors />
              </SelButton>
              <SelButton label={t.duplicate} onClick={() => engine?.duplicateSelection()} touch={touch}>
                <CopyPlus />
              </SelButton>
              {state.selection.strokes > 0 && (
                <Popover
                  side="top"
                  align="start"
                  role="dialog"
                  label={t.colour}
                  className="w-[268px] p-2"
                  trigger={({ ref, onClick }) => (
                    <SelButton buttonRef={ref} label={t.colour} onClick={() => onClick({ stopPropagation() {}, preventDefault() {} } as React.MouseEvent)} touch={touch}>
                      <Palette />
                    </SelButton>
                  )}
                >
                  {(close) => (
                    <div className="grid grid-cols-6 gap-1">
                      {PEN_COLORS.map((c) => (
                        <button key={c} type="button" aria-label={c} onClick={() => (engine?.recolorSelection(c), close())} className="grid size-10 place-items-center rounded-full">
                          <span className="block size-6 rounded-full border border-black/10 dark:border-white/15" style={{ background: inkColor(c, dark) }} />
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>
              )}
              <SelButton label={t.delete} onClick={() => engine?.deleteSelection()} touch={touch} danger>
                <Trash2 />
              </SelButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The tools: a floating bar on top (at the bottom on phones, near the thumb). */}
        {!readOnly && (
          <div className={cn("pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2", phone ? "bottom-[max(10px,env(safe-area-inset-bottom))]" : "top-3")}>
            <Toolbar
              settings={settings}
              update={update}
              state={state}
              recent={recent}
              remember={remember}
              dark={dark}
              phone={phone}
              touch={touch}
              onUndo={() => engine?.undo()}
              onRedo={() => engine?.redo()}
              onPicture={() => fileRef.current?.click()}
              onColor={onColor}
              paper={paper}
              more={more}
              onPages={() => setPagesOpen(true)}
              lastPen={lastPen()}
            />
          </div>
        )}

        {/* Where you are: page and zoom. */}
        <div className={cn("pointer-events-none absolute right-3 z-20 flex items-center gap-1.5", phone && !readOnly ? "bottom-[calc(max(10px,env(safe-area-inset-bottom))+62px)]" : "bottom-3")}>
          <AnimatePresence>
            {state.zoomed && (
              <motion.button
                key="zoom"
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                onClick={() => engine?.resetZoom()}
                title={t.fitWidth}
                className="pointer-events-auto flex h-8 items-center rounded-full border border-line bg-raised/90 px-3 text-[12.5px] font-medium tabular-nums text-ink-2 shadow-card backdrop-blur-md hover:text-ink"
              >
                <span ref={zoomLabel} />
              </motion.button>
            )}
          </AnimatePresence>
          {state.pages > 0 && (
            <button
              type="button"
              onClick={() => setPagesOpen(true)}
              aria-label={t.pageOf(state.page + 1, state.pages)}
              className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-line bg-raised/90 px-3 text-[12.5px] font-medium tabular-nums text-ink-2 shadow-card backdrop-blur-md hover:text-ink"
            >
              <NotebookText className="size-3.5" />
              {t.pageShort(state.page + 1, state.pages)}
            </button>
          )}
        </div>

        {/* Someone else is writing (shared notes). */}
        <AnimatePresence>
          {writer && (
            <motion.div
              key="writer"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-raised/90 px-3 py-1 text-[12px] text-ink-2 shadow-card backdrop-blur-md"
              role="status"
            >
              {t.writing(writer)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opening. */}
        <AnimatePresence>
          {!loaded && (
            <motion.div key="loading" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <div className="flex items-center gap-2 rounded-full bg-raised/90 px-4 py-2 text-[13px] text-ink-3 shadow-card">
                <span className="blob-upload-spinner" />
                {t.loading}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {parts && (
        <Pages
          open={pagesOpen}
          onClose={() => setPagesOpen(false)}
          doc={parts.doc}
          dark={dark}
          images={parts.images}
          version={version}
          current={state.page}
          readOnly={readOnly}
          phone={phone}
          onGo={(i) => engine?.goToSheet(i)}
          onAdd={(after) => {
            engine?.addSheet(after);
            bump();
          }}
          onDuplicate={(id) => engine?.duplicateSheet(id)}
          onDelete={(id) => engine?.deleteSheet(id)}
          onMove={(id, to) => engine?.moveSheet(id, to)}
        />
      )}

      {confirmErase && (
        <ConfirmErase
          text={t.erasePageConfirm}
          yes={t.erase}
          no={t.cancel}
          onYes={() => {
            if (sheet) engine?.clearSheet(sheet.id);
            setConfirmErase(false);
          }}
          onNo={() => setConfirmErase(false)}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void addPicture(file);
        }}
      />
    </>
  );
}

function SelButton({ label, onClick, children, touch, danger, buttonRef }: { label: string; onClick: () => void; children: React.ReactNode; touch: boolean; danger?: boolean; buttonRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center rounded-lg transition-colors [&_svg]:size-[17px]",
        touch ? "size-10" : "size-8",
        danger ? "text-ink-2 hover:bg-danger/10 hover:text-danger" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Phones: the paper styles open from the "more" menu. */
function PaperMenuItem({ label, content }: { label: string; content: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      role="dialog"
      label={label}
      className="w-[300px] p-3"
      trigger={({ ref, onClick }) => (
        <button ref={ref} type="button" role="menuitem" onClick={onClick} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-ink-2 hover:bg-hover hover:text-ink [&_svg]:size-4">
          <NotebookText className="text-ink-3" />
          {label}
        </button>
      )}
    >
      {(close) => content(close)}
    </Popover>
  );
}

function ConfirmErase({ text, yes, no, onYes, onNo }: { text: string; yes: string; no: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgb(20_18_14/0.32)] px-4" onClick={onNo} role="presentation">
      <div role="alertdialog" aria-label={text} className="w-full max-w-xs rounded-2xl border border-line bg-raised p-4 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14px] font-medium text-ink">{text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onNo} className="h-8 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover">
            {no}
          </button>
          <button type="button" onClick={onYes} autoFocus className="h-8 rounded-lg bg-danger px-3 text-[13px] font-medium text-white hover:bg-danger/90">
            {yes}
          </button>
        </div>
      </div>
    </div>
  );
}
