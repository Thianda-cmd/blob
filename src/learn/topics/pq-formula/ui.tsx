"use client";

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { dec, enDecimals } from "./shared";

export const SPRING = { type: "spring" as const, stiffness: 260, damping: 28 };
const THUMB = { type: "spring" as const, stiffness: 500, damping: 40 };

/** A number for SVG text and labels in the current language: real minus sign, decimal comma in German. */
export function useNum() {
  const t = useText();
  return (v: number) => t(enDecimals(dec(v))).replace("-", "−");
}

/**
 * A slider over a list of values (works with mouse, touch and the arrow keys). The fill starts
 * at the value closest to 0, so signs are easy to see.
 */
export function ValueSlider({
  name,
  label,
  values,
  index,
  onChange,
  className,
}: {
  /** Short maths name shown in front, e.g. "a". */
  name: string;
  /** Spoken name for screen readers. */
  label: Text;
  values: number[];
  index: number;
  onChange: (index: number) => void;
  className?: string;
}) {
  const t = useText();
  const show = useNum();
  const n = values.length;
  const pct = (i: number) => (n > 1 ? i / (n - 1) : 0);
  let zero = 0;
  values.forEach((v, i) => {
    if (Math.abs(v) < Math.abs(values[zero])) zero = i;
  });
  const value = values[index];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-5 shrink-0 font-math text-[21px] italic text-ink-2">{name}</span>
      <div className="group relative h-9 min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={n - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t(label)}
          aria-valuetext={show(value)}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <div className="pointer-events-none absolute inset-x-2 top-0 bottom-0">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
          {values.map((v, i) => (
            <span
              key={i}
              className={cn("absolute top-[calc(50%+9px)] w-px -translate-x-1/2 bg-ink-3/50", v === 0 || i === zero ? "h-2" : "h-1")}
              style={{ left: `${pct(i) * 100}%` }}
            />
          ))}
          <motion.div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blob"
            initial={false}
            animate={{ left: `${Math.min(pct(index), pct(zero)) * 100}%`, width: `${Math.abs(pct(index) - pct(zero)) * 100}%` }}
            transition={THUMB}
          />
          <motion.div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blob bg-raised shadow-card ring-blob/25 group-focus-within:ring-4"
            initial={false}
            animate={{ left: `${pct(index) * 100}%` }}
            transition={THUMB}
          />
        </div>
      </div>
      <span className="w-12 shrink-0 text-right font-math text-[20px] tabular-nums">{show(value)}</span>
    </div>
  );
}

/** − value + buttons for a whole number. */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: Text }) {
  const t = useText();
  const btn =
    "grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35";
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t(label)}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${t(label)} −1`}>
        <Minus className="size-4" />
      </button>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${t(label)} +1`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** A small pill button for presets. */
export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
        active ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
