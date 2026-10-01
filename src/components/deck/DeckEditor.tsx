"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, PanelRight, Play, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { PageTopBar } from "@/components/page/PageTopBar";
import { useAutosave } from "@/components/page/useAutosave";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import type { DeckContent, DeckTheme, Page, Slide, SlideLayout } from "@/lib/types";
import { ALLOWED_IMAGE_TYPES, deckPlainText, MAX_IMAGE_BYTES, newSlide, normalizeDeck } from "./deck";
import { DeckInspector } from "./DeckInspector";
import { AddSlideMenu, SlideRail } from "./SlideRail";
import { SlideView } from "./SlideView";
import { ThemePicker } from "./ThemePicker";

type DeckPatch = { content: DeckContent; title: string; plain_text: string };

/** Editor width (px) from which the right panel shows by default. Matches the container query below. */
const INSPECTOR_MIN_WIDTH = 980;

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

export function DeckEditor({ page }: { page: Page }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePage, userId } = useWorkspace();

  const [deck, setDeck] = useState<DeckContent>(() => normalizeDeck(page.content));
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
    (fn: (d: DeckContent) => DeckContent) => {
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
      blob.say("A presentation needs at least one slide.", { mood: "thinking" });
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

  const setTheme = (theme: DeckTheme) => change((d) => (d.theme === theme ? d : { ...d, theme }));

  const onTitle = (value: string) => {
    const next = value.slice(0, 200);
    setTitle(next);
    void updatePage(page.id, { title: next }, { local: true });
    schedule({ title: next });
  };

  const upload = useCallback(
    async (slideId: string, file: File) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        blob.say("I can only use PNG, JPG, GIF or WebP images.", { mood: "worried" });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        blob.say("That image is over 10 MB. Try a smaller one?", { mood: "worried" });
        return;
      }
      setUploadingId(slideId);
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type] ?? "png"}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      setUploadingId(null);
      if (error) {
        blob.say("That upload didn't work. Try again?", { mood: "worried" });
        blob.react("shake", "worried");
        return;
      }
      updateSlide(slideId, { image: supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl });
      blob.react("jump", "happy");
    },
    [userId, updateSlide],
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
              className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              aria-label="Toggle slide panel"
              title="Slide panel"
            >
              <PanelRight className="size-4" />
            </button>
            <ThemePicker theme={deck.theme} slide={selected} onChange={setTheme} />
            <Button variant="primary" size="sm" onClick={() => void present()} title="Present (Ctrl Enter)" className="ml-1">
              <Play className="size-3 fill-current" /> Present
            </Button>
          </>
        }
      />
      <div ref={bodyRef} className="@container/editor flex min-h-0 flex-1 border-t border-line">
        <SlideRail
          className="hidden @min-[560px]/editor:flex"
          slides={deck.slides}
          theme={deck.theme}
          selectedId={selected.id}
          onSelect={setSelectedId}
          onReorder={(slides) => change((d) => ({ ...d, slides }))}
          onAdd={addSlide}
          onDuplicate={duplicateSlide}
          onDelete={deleteSlide}
          onMove={moveSlide}
          onEnter={() => setFocusNonce((n) => n + 1)}
        />

        <section className="relative flex min-w-0 flex-1 flex-col bg-paper" aria-label="Slide editor">
          <div className="relative min-h-0 flex-1 [container-type:size]">
            <div className="absolute inset-0 flex items-center justify-center px-8 py-6">
              <div className="flex flex-col" style={{ width: "min(100cqw - 64px, (100cqh - 48px - 56px) * 16 / 9)" }}>
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
                    placeholder="Untitled presentation"
                    aria-label="Presentation title"
                    className="min-w-0 flex-1 truncate bg-transparent font-display text-[24px] font-semibold tracking-[-0.025em] text-ink outline-none placeholder:text-ink-3/60"
                  />
                  <span className="shrink-0 pb-1.5 text-[12px] tabular-nums text-ink-3">
                    Slide {index + 1} of {deck.slides.length}
                  </span>
                  {/* Compact slide navigation when the rail is hidden (phones). */}
                  <div className="flex shrink-0 items-center pb-0.5 @min-[560px]/editor:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedId(deck.slides[Math.max(0, index - 1)].id)}
                      disabled={index === 0}
                      className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-40"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(deck.slides[Math.min(deck.slides.length - 1, index + 1)].id)}
                      disabled={index === deck.slides.length - 1}
                      className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-40"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                    <AddSlideMenu
                      onAdd={addSlide}
                      align="end"
                      trigger={(props) => (
                        <button {...props} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label="Add a slide">
                          <Plus className="size-4" />
                        </button>
                      )}
                    />
                  </div>
                </div>
                <div ref={stageRef} className="aspect-video w-full">
                  <SlideView
                    slide={selected}
                    theme={deck.theme}
                    mode="edit"
                    onChange={onSlideChange}
                    onUpload={onSlideUpload}
                    uploading={uploadingId === selected.id}
                    frameClassName="rounded-xl shadow-[0_1px_2px_rgb(0_0_0/0.05),0_16px_40px_-16px_rgb(0_0_0/0.22)] ring-1 ring-ink/8 dark:ring-white/12"
                  />
                </div>
              </div>
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
                  Slide {deleted.index + 1} deleted
                  <button
                    type="button"
                    onClick={undoDelete}
                    className="rounded-lg px-2 py-1 font-medium text-blob transition-colors hover:bg-paper/10"
                  >
                    Undo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <DeckInspector
          className={inspector === "auto" ? "hidden @min-[980px]/editor:flex" : inspector === "open" ? "flex" : "hidden"}
          deck={deck}
          slide={selected}
          index={index}
          uploading={uploadingId === selected.id}
          onLayout={(layout) => updateSlide(selected.id, { layout })}
          onChange={onSlideChange}
          onUpload={onSlideUpload}
        />
      </div>
    </>
  );
}
