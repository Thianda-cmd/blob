"use client";

// Small controls shared by the plant-structure widgets: toggle chips, a segmented switch,
// a labelled slider and Blob's caption box. Tokens only, so light and dark mode both work.

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A toggle chip (on = purple). */
export function PlantChip({
  on,
  onClick,
  icon,
  children,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  /** Accessible name when the chip's text alone isn't clear. */
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border px-3 text-[13.5px] font-semibold transition-colors active:scale-[0.97]",
        on ? "border-blob bg-blob text-white" : "border-line bg-raised text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

/** A segmented switch between a few options. */
export function PlantSeg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "relative rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition-colors",
            value === o.id ? "text-white" : "text-ink-2 hover:text-ink",
          )}
        >
          {value === o.id && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** A range slider with a name on the left and the current value on the right. */
export function PlantSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueText,
  low,
  high,
  icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** What the value means right now ("strong", "22 °C"). */
  valueText: string;
  /** Captions under both ends. */
  low?: string;
  high?: string;
  icon?: ReactNode;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-[13.5px]">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          {icon}
          {label}
        </span>
        <span className="font-medium tabular-nums text-blob-ink">{valueText}</span>
      </div>
      <div className="relative h-8 select-none">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={valueText}
          className="peer absolute inset-x-0 top-0 z-10 h-8 w-full cursor-pointer opacity-0"
        />
        <div className="pointer-events-none absolute inset-x-2.5 top-0 h-8">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-line" />
          <div className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-blob/60" style={{ width: `${pct}%` }} />
          <motion.div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-blob bg-raised shadow-card ring-blob/25 peer-focus-visible:ring-4"
            initial={false}
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 600, damping: 42 }}
          />
        </div>
      </div>
      {(low || high) && (
        <div className="flex justify-between text-[11.5px] text-ink-3">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

/** Blob's explanation under a widget; fades when the text changes. */
export function PlantNote({ id, children, tone = "plain" }: { id: string; children: ReactNode; tone?: "plain" | "good" | "warn" }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
        aria-live="polite"
        className={cn(
          "min-h-[3.25rem] rounded-xl border px-3.5 py-2.5 text-[14px] leading-relaxed",
          tone === "good" ? "border-blob/40 bg-blob-soft text-ink" : tone === "warn" ? "border-line bg-surface text-ink" : "border-line bg-surface text-ink-2",
        )}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** A small meter (0..1) with a label, e.g. the transpiration rate or the turgor. */
export function PlantMeter({ label, value, valueText, color = "var(--blob)" }: { label: string; value: number; valueText: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="font-medium tabular-nums text-ink-2">{valueText}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} transition={{ type: "spring", stiffness: 220, damping: 30 }} />
      </div>
    </div>
  );
}
