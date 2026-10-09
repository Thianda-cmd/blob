"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import type { Frame } from "@/learn/types";
import { cn } from "@/lib/utils";
import { MathView, type MathSize } from "./MathView";
import { Inline } from "./Rich";

/** Plays a worked solution: the maths morphs frame by frame while the steps are explained. */
export function SolutionPlayer({
  frames,
  autoPlay = true,
  size = "lg",
  interval = 2200,
  className,
}: {
  frames: Frame[];
  autoPlay?: boolean;
  size?: MathSize;
  interval?: number;
  className?: string;
}) {
  const scope = useId();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const frame = frames[Math.min(i, frames.length - 1)];
  const t = useMessages(learnText).solution;

  useEffect(() => {
    if (!playing) return;
    if (i >= frames.length - 1) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((n) => n + 1), interval);
    return () => clearTimeout(t);
  }, [playing, i, frames.length, interval]);

  if (!frames.length) return null;
  const stepped = frames.length > 1;

  return (
    <div className={cn("grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]", className)}>
      {/*
        The controls sit under the maths (not on top of it), and wide maths scrolls instead of being cut.
        Next to a long list of steps the board keeps its own height and stays in view (below the top bar).
      */}
      <div className="relative flex min-h-[140px] flex-col overflow-hidden rounded-2xl border border-line bg-surface md:sticky md:top-20 md:self-start">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
        <div className={cn("relative grid flex-1 place-items-center overflow-x-auto px-4 sm:px-6", stepped ? "pb-1 pt-7" : "py-7")}>
          <MathView src={frame.math} size={size} highlight={frame.highlight} arrows={frame.arrows} scope={scope} />
        </div>
        {/* A one-frame solution has nothing to step through. */}
        {stepped && (
          <div className="relative flex items-center justify-end gap-0.5 px-2 pb-1.5">
            <button
              onClick={() => {
                setPlaying(false);
                setI((n) => Math.max(0, n - 1));
              }}
              disabled={i === 0}
              className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-30 sm:size-7"
              aria-label={t.previous}
              title={t.previous}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="w-10 text-center text-[11.5px] tabular-nums text-ink-3">
              {i + 1}/{frames.length}
            </span>
            <button
              onClick={() => {
                setPlaying(false);
                setI((n) => Math.min(frames.length - 1, n + 1));
              }}
              disabled={i >= frames.length - 1}
              className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-30 sm:size-7"
              aria-label={t.next}
              title={t.next}
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              onClick={() => {
                setI(0);
                setPlaying(true);
              }}
              className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink sm:size-7"
              aria-label={t.replay}
              title={t.replay}
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <ol className="space-y-1.5 self-center">
        {frames.map((f, n) =>
          f.note ? (
            <motion.li
              key={n}
              initial={false}
              animate={{ opacity: n <= i ? 1 : 0.35 }}
              className={cn("flex cursor-pointer gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug transition-colors", n === i ? "bg-blob-soft/70 text-ink" : "text-ink-2 hover:bg-hover")}
              onClick={() => {
                setPlaying(false);
                setI(n);
              }}
            >
              <span className={cn("mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", n <= i ? "bg-blob text-white" : "bg-hover text-ink-3")}>{n + 1}</span>
              <span>
                <Inline text={f.note} />
              </span>
            </motion.li>
          ) : null,
        )}
      </ol>
    </div>
  );
}
