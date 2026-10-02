"use client";

import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText, useTypewriter } from "@/components/blob/speech";
import { useLocale, useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { resolveText } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

/**
 * 7x − (3x − 5) → 7x − 3x + 5 → 4x + 5, the same frames as the real "minus in front"
 * lesson: tokens keep their keys, so they glide to their new places.
 */
const FRAMES: { math: string; plain: string; highlight?: string[]; arrows?: [string, string][]; mood: BlobMood; ms: number }[] = [
  { math: "7#a x#ax -#m (3#b x#bx -#s 5#c)#g", plain: "7x − (3x − 5)", highlight: ["m"], mood: "thinking", ms: 3400 },
  { math: "7#a x#ax -#m (3#b x#bx -#s 5#c)#g", plain: "7x − (3x − 5)", arrows: [["m", "b"], ["m", "c"]], mood: "thinking", ms: 3200 },
  { math: "7#a x#ax -#m 3#b x#bx +#s 5#c", plain: "7x − 3x + 5", highlight: ["m", "s"], mood: "happy", ms: 3000 },
  { math: "7#a x#ax -#m 3#b x#bx +#s 5#c", plain: "7x − 3x + 5", highlight: ["a", "ax", "m", "b", "bx"], mood: "happy", ms: 3200 },
  { math: "4#a x#ax +#s 5#c", plain: "4x + 5", mood: "excited", ms: 4200 },
];
const LAST = FRAMES.length - 1;

/** "$-5$" → "−5": what the typewriter shows before the maths is rendered. */
const toPlain = (text: string) => text.replace(/\$([^$]+)\$/g, (_, m: string) => m.replace(/-/g, "−"));

/** A live worked solution with Blob as the tutor. Plays while visible; pausable; still under reduced motion. */
export function LearnDemo({ className }: { className?: string }) {
  const t = useMessages(landingText).learn.demo;
  const locale = useLocale();
  const topic = resolveText(topicMeta("brackets").title, locale);
  const root = useRef<HTMLDivElement>(null);
  const blob = useRef<BlobHandle>(null);
  const visible = useInView(root, { amount: 0.4 });
  const reduce = useReducedMotion();
  // "auto" plays unless the visitor prefers reduced motion; the buttons override it.
  const [mode, setMode] = useState<"auto" | "playing" | "paused">("auto");
  const [pos, setPos] = useState({ run: 0, step: 0 });
  const playing = visible && (mode === "playing" || (mode === "auto" && !reduce));
  const { step, run } = pos;
  const frame = FRAMES[step];
  const line = t.lines[step];
  const plain = toPlain(line);
  const { shown, typing } = useTypewriter(plain, 46);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setPos((p) => (p.step >= LAST ? { run: p.run + 1, step: 0 } : { run: p.run, step: p.step + 1 })),
      FRAMES[step].ms,
    );
    return () => clearTimeout(timer);
  }, [playing, step, run]);

  // Blob points at the board for each new step and cheers at the result.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => (step === LAST ? blob.current?.celebrate() : blob.current?.point()), 160);
    return () => clearTimeout(timer);
  }, [step, run, visible]);

  const go = (n: number) => {
    setMode("paused");
    setPos((p) => ({ run: p.run, step: n }));
  };

  return (
    <div ref={root} role="group" aria-label={t.label} className={cn("flex flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-card", className)}>
      <div className="flex h-12 items-center gap-3 border-b border-line px-4">
        <span className="grid size-6 place-items-center rounded-md bg-blob-soft font-math text-[13px] italic text-blob-ink" aria-hidden>
          x
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-medium">{topic}</div>
          <div className="text-[11.5px] text-ink-3">{t.solution}</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[12px] tabular-nums text-ink-3" aria-live="off">
            {t.step(step + 1, FRAMES.length)}
          </span>
          <IconButton label={playing ? t.pause : t.play} onClick={() => setMode(playing ? "paused" : "playing")}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </IconButton>
          <IconButton
            label={t.replay}
            onClick={() => {
              setMode("playing");
              setPos((p) => ({ run: p.run + 1, step: 0 }));
            }}
          >
            <RotateCcw className="size-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="relative grid min-h-[190px] flex-1 place-items-center overflow-hidden bg-surface px-4 py-10 sm:min-h-[230px]">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={run}
            className="relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <div aria-hidden>
              <MathView
                src={frame.math}
                size="xl"
                highlight={frame.highlight}
                arrows={frame.arrows}
                scope={`landing-demo-${run}`}
                className="max-sm:text-[34px]!"
              />
            </div>
            <span className="sr-only">{frame.plain}</span>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {step === LAST && (
            <motion.span
              key={`done-${run}`}
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: 0.45, type: "spring", stiffness: 520, damping: 22 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-blob-soft px-2.5 py-1 text-[12px] font-medium text-blob-ink"
            >
              <Check className="size-3.5" strokeWidth={2.5} /> {t.done}
            </motion.span>
          )}
        </AnimatePresence>
        <div className="absolute inset-x-4 bottom-0 flex gap-1.5 pb-0">
          {FRAMES.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={t.goTo(i + 1)}
              aria-current={i === step ? "step" : undefined}
              className="group flex h-4 flex-1 items-center"
            >
              <span className="block h-1 w-full overflow-hidden rounded-full bg-line transition-colors group-hover:bg-line-2">
                <motion.span
                  key={i === step ? `${run}-${step}-${playing}` : "idle"}
                  className="block h-full rounded-full bg-blob"
                  initial={{ width: i === step && playing ? "0%" : i <= step ? "100%" : "0%" }}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={i === step && playing ? { duration: f.ms / 1000, ease: "linear" } : { duration: 0.2 }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2 px-3 pb-3 pt-1 sm:gap-3 sm:px-4">
        <div className="-mb-1 shrink-0">
          <Blob ref={blob} size={104} className="max-sm:h-[84px] max-sm:w-[84px]" mood={frame.mood} accessory="glasses" talking={typing} look={{ x: 0.5, y: -0.6 }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${run}-${step}-${line}`}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 480, damping: 28 }}
            style={{ transformOrigin: "bottom left" }}
            className="mb-6 min-w-0 flex-1 rounded-2xl rounded-bl-md border border-line bg-raised px-4 py-3 text-[14.5px] leading-snug text-ink shadow-pop"
          >
            {typing ? <TypedText text={plain} shown={shown} /> : <Inline text={line} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink"
    >
      {children}
    </button>
  );
}
