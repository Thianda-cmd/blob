"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, NotebookText, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Blob } from "@/components/blob/Blob";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import type { DeckContent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SlideView } from "./SlideView";

type Awake = "pointer" | "key" | null;

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir === 0 ? 0 : `${dir * 12}%`, scale: 0.94, opacity: 0 }),
  center: { x: 0, scale: 1, opacity: 1 },
  exit: (dir: number) => ({ x: dir === 0 ? 0 : `${dir * -12}%`, scale: 0.94, opacity: 0 }),
};

const slideTransition = {
  x: { type: "spring", stiffness: 280, damping: 34, mass: 0.9 },
  scale: { type: "spring", stiffness: 280, damping: 30 },
  opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
} as const;

/** Fullscreen slideshow. Lives outside the app shell. */
export function Presenter({ pageId, title, deck, start }: { pageId: string; title: string; deck: DeckContent; start: number }) {
  const router = useRouter();
  const total = deck.slides.length;
  const [[index, dir], setPos] = useState<[number, number]>([start, 0]);
  const [awake, setAwake] = useState<Awake>("key");
  const [hint, setHint] = useState(true);
  const [notes, setNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | null>(null);

  const ended = index >= total;
  const slide = deck.slides[Math.min(index, total - 1)];
  const nextSlide = deck.slides[index + 1];

  const go = useCallback(
    (to: number) => {
      setPos((prev) => {
        const t = Math.min(Math.max(to, 0), total);
        return t === prev[0] ? prev : [t, t > prev[0] ? 1 : -1];
      });
      setHint(false);
    },
    [total],
  );
  const next = useCallback(() => setPos((p) => (p[0] >= total ? p : [p[0] + 1, 1])), [total]);
  const prev = useCallback(() => setPos((p) => (p[0] <= 0 ? p : [p[0] - 1, -1])), []);

  const wake = useCallback((kind: "pointer" | "key") => {
    setAwake((a) => (a === "pointer" ? a : kind));
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAwake(null), kind === "pointer" ? 2600 : 1800);
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    router.replace(`/p/${pageId}?slide=${Math.min(index, total - 1) + 1}`);
  }, [router, pageId, index, total]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // Initial chrome and hint fade out on their own.
  useEffect(() => {
    idleTimer.current = setTimeout(() => setAwake(null), 3000);
    const t = setTimeout(() => setHint(false), 4500);
    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Warm the cache so image slides appear instantly.
  useEffect(() => {
    deck.slides.forEach((s) => {
      if (s.image) new Image().src = s.image;
    });
  }, [deck.slides]);

  // Keep ?slide= in sync so a reload resumes where you were.
  useEffect(() => {
    window.history.replaceState(null, "", `?slide=${Math.min(index, total - 1) + 1}`);
  }, [index, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          next();
          setHint(false);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          prev();
          setHint(false);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(total - 1);
          break;
        case "Escape":
          e.preventDefault();
          exit();
          return;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "n":
        case "N":
          setNotes((v) => !v);
          break;
        default:
          return;
      }
      e.preventDefault();
      wake("key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, exit, toggleFullscreen, wake, total]);

  const showChrome = awake !== null;
  const progress = ended ? 1 : (index + 1) / total;

  return (
    <div
      data-theme="dark"
      className="fixed inset-0 select-none overflow-hidden bg-[#0b0b0a] text-[#f1efe8]"
      style={{ cursor: awake === "pointer" ? "default" : "none" }}
      onPointerMove={() => wake("pointer")}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY, swiped: false };
      }}
      onPointerUp={(e) => {
        const s = swipe.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          s.swiped = true;
          if (dx < 0) next();
          else prev();
          setHint(false);
        }
      }}
      onClick={(e) => {
        if (swipe.current?.swiped) return;
        if (e.clientX < window.innerWidth / 2) prev();
        else next();
        setHint(false);
      }}
    >
      <p className="sr-only" aria-live="polite">
        {ended ? "End of presentation" : `Slide ${index + 1} of ${total}${slide.title.trim() ? `: ${slide.title.trim()}` : ""}`}
      </p>

      {/* Slides */}
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          className="absolute inset-0"
        >
          {ended ? (
            <EndScreen title={title} total={total} onRestart={() => go(0)} onExit={exit} />
          ) : (
            <SlideView slide={deck.slides[index]} theme={deck.theme} mode="present" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Top controls (mouse only) */}
      <motion.div
        initial={false}
        animate={{ opacity: awake === "pointer" ? 1 : 0, y: awake === "pointer" ? 0 : -6 }}
        transition={{ duration: 0.2 }}
        className={cn("absolute inset-x-0 top-0 flex items-center justify-between p-4", awake !== "pointer" && "pointer-events-none")}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <ChromeButton onClick={exit} label="Exit presentation">
          <X className="size-4" /> Exit <Kbd className="ml-0.5 border-white/10 bg-white/5 text-white/50 shadow-none">Esc</Kbd>
        </ChromeButton>
        <div className="flex gap-1.5">
          <ChromeButton onClick={() => setNotes((v) => !v)} label="Speaker notes (N)" active={notes}>
            <NotebookText className="size-4" /> Notes
          </ChromeButton>
          <ChromeButton onClick={toggleFullscreen} label={fullscreen ? "Exit full screen (F)" : "Full screen (F)"}>
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </ChromeButton>
        </div>
      </motion.div>

      {/* Counter with prev/next */}
      <motion.div
        initial={false}
        animate={{ opacity: showChrome ? 1 : 0 }}
        transition={{ duration: showChrome ? 0.15 : 0.5 }}
        className={cn("absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#1c1b18] p-1", !showChrome && "pointer-events-none")}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={(e) => (e.detail > 0 && e.currentTarget.blur(), prev())} disabled={index === 0} aria-label="Previous slide" className="grid size-7 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[56px] px-1 text-center text-[12.5px] tabular-nums text-white/80">
          {ended ? "End" : `${index + 1} / ${total}`}
        </span>
        <button type="button" onClick={(e) => (e.detail > 0 && e.currentTarget.blur(), next())} disabled={ended} aria-label="Next slide" className="grid size-7 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </motion.div>

      {/* First-run hint */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.4, type: "spring", stiffness: 400, damping: 30 } }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.25 } }}
            className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"
          >
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1c1b18] px-3.5 py-2 text-[12.5px] text-white/70 shadow-pop">
              <Hint keys={["←", "→"]}>move</Hint>
              <Hint keys={["F"]}>full screen</Hint>
              <Hint keys={["N"]}>notes</Hint>
              <Hint keys={["Esc"]}>exit</Hint>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker notes */}
      <AnimatePresence>
        {notes && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-x-0 bottom-16 flex justify-center px-4"
            onClick={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{ cursor: "default" }}
          >
            <div className="w-full max-w-[760px] rounded-2xl border border-white/10 bg-[#1c1b18] shadow-pop">
              <div className="flex items-center gap-3 border-b border-white/8 px-5 py-3 text-[12.5px] text-white/50">
                <NotebookText className="size-3.5" />
                <span className="font-medium text-white/80">Speaker notes</span>
                <span className="tabular-nums">{ended ? "End" : `Slide ${index + 1} of ${total}`}</span>
                <span className="ml-auto truncate">
                  {nextSlide ? (
                    <>
                      Next: <span className="text-white/75">{nextSlide.title.trim() || `Slide ${index + 2}`}</span>
                    </>
                  ) : ended ? null : (
                    "Last slide"
                  )}
                </span>
                <button type="button" onClick={() => setNotes(false)} aria-label="Hide notes" className="-mr-2 grid size-6 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="max-h-[34vh] overflow-y-auto px-5 py-4 text-[17px] leading-[1.6] text-white/90">
                {!ended && slide.notes.trim() ? (
                  <p className="whitespace-pre-wrap">{slide.notes}</p>
                ) : (
                  <p className="text-white/40">{ended ? "That was the last slide." : "No notes for this slide."}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.06]">
        <motion.div
          className="h-full origin-left bg-blob"
          initial={false}
          animate={{ scaleX: progress }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
}

function ChromeButton({ children, onClick, label, active }: { children: ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Mouse clicks shouldn't leave focus behind, or Space would press the button again.
        if (e.detail > 0) e.currentTarget.blur();
        onClick();
      }}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1b18] px-2.5 text-[13px] text-white/75 transition-colors hover:bg-[#262623] hover:text-white",
        active && "border-blob/50 text-white",
      )}
    >
      {children}
    </button>
  );
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {keys.map((k) => (
          <Kbd key={k} className="border-white/12 bg-white/5 text-white/70 shadow-none">
            {k}
          </Kbd>
        ))}
      </span>
      {children}
    </span>
  );
}

function EndScreen({ title, total, onRestart, onExit }: { title: string; total: number; onRestart: () => void; onExit: () => void }) {
  return (
    <div className="grid size-full place-items-center px-6">
      <div className="flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <Blob size={120} mood="excited" />
        <h1 className="mt-3 font-display text-[40px] font-semibold tracking-[-0.03em] text-[#f6f4ee]">That&apos;s a wrap!</h1>
        <p className="mt-1 max-w-[520px] truncate text-[15px] text-white/55">
          {title} · {total} {total === 1 ? "slide" : "slides"}
        </p>
        <div className="mt-7 flex gap-2">
          <Button variant="secondary" onClick={onRestart}>
            <RotateCcw className="size-4" /> Start over
          </Button>
          <Button variant="blob" onClick={onExit}>
            Back to editor
          </Button>
        </div>
      </div>
    </div>
  );
}
