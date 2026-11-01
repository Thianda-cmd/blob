"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import type { StepsView } from "../types";

/** How long each step shows when playing. */
const PLAY_MS = 3600;

/** A process as a picture that changes step by step, with a step bar, arrows and play. */
export function StepsStage({
  view,
  step,
  onStep,
  seen,
  controls = true,
  className,
}: {
  view: StepsView;
  step: number;
  onStep: (step: number) => void;
  seen?: Set<string>;
  /** The step bar and buttons (hidden in the quiz). */
  controls?: boolean;
  className?: string;
}) {
  const t = useMessages(atlasText);
  const tt = useText();
  const [playing, setPlaying] = useState(false);
  const n = view.steps.length;
  const bar = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      if (step < n - 1) onStep(step + 1);
      else setPlaying(false);
    }, PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, step, n, onStep]);

  // Keep the current step in view on narrow screens.
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [step]);

  const Drawing = view.Drawing;
  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full select-none" style={{ aspectRatio: `${view.width} / ${view.height}` }}>
        <svg
          viewBox={`0 0 ${view.width} ${view.height}`}
          className="absolute inset-0 size-full overflow-visible"
          role="img"
          // In the quiz (no controls) the step's title would say the answer out loud.
          aria-label={controls ? `${tt(view.title)}: ${tt(view.steps[step]?.title)}` : tt(view.title)}
        >
          <Drawing step={step} />
        </svg>
      </div>
      {controls && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              onStep(Math.max(0, step - 1));
            }}
            disabled={step === 0}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
            aria-label={t.back}
          >
            <ChevronLeft className="size-4" />
          </button>
          <ol ref={bar} className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t.stepsList}>
            {view.steps.map((s, i) => {
              const on = i === step;
              const done = seen?.has(String(i));
              return (
                <li key={i} data-step={i} className="min-w-[44px] flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      onStep(i);
                    }}
                    aria-current={on ? "step" : undefined}
                    title={tt(s.title)}
                    className="group flex w-full flex-col items-stretch gap-1.5 rounded-lg px-1 pb-1 pt-1.5 text-left"
                  >
                    <span className={cn("h-1.5 rounded-full transition-colors duration-300", on ? "bg-blob" : i < step ? "bg-blob/45" : done ? "bg-blob/25" : "bg-line group-hover:bg-line-2")} />
                    <span className={cn("truncate px-0.5 text-[11.5px] font-semibold leading-tight", on ? "text-ink" : "text-ink-3 group-hover:text-ink-2")}>
                      <span className="tabular-nums">{i + 1}</span>
                      <span className="max-sm:hidden"> {tt(s.short)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={() => {
              if (step === n - 1 && !playing) {
                onStep(0);
                setPlaying(true);
              } else setPlaying((p) => !p);
            }}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-ink-2 transition-colors hover:bg-hover hover:text-ink"
            aria-label={playing ? t.pause : step === n - 1 ? t.restart : t.play}
            title={playing ? t.pause : step === n - 1 ? t.restart : t.play}
          >
            {playing ? <Pause className="size-4" /> : step === n - 1 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              onStep(Math.min(n - 1, step + 1));
            }}
            disabled={step === n - 1}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-[background,opacity] hover:bg-blob-deep disabled:opacity-40"
            aria-label={t.next}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
