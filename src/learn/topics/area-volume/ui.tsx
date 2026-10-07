"use client";

// Small controls shared by the area-volume widgets.

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

/** A labelled − value + stepper. */
export function Stepper({
  label,
  name,
  value,
  min,
  max,
  step = 1,
  unit,
  format,
  onChange,
}: {
  label: Text;
  /** Spoken name for the buttons ("length"). */
  name: Text;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const t = useText();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 min-w-[1.2em] text-[14px] text-ink-2">{t(label)}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`Decrease ${t(name)}`, `${t(name)} verkleinern`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-[3.2em] text-center text-[16px] font-semibold tabular-nums">
        {format ? format(value) : value}
        {unit ? <span className="ml-0.5 text-[13px] font-normal text-ink-3">{unit}</span> : null}
      </motion.span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`Increase ${t(name)}`, `${t(name)} vergrößern`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** A segmented switch with a gliding background. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: Text }[]; value: T; onChange: (v: T) => void }) {
  const t = useText();
  const scope = useId();
  return (
    <div className="inline-flex rounded-lg border border-line p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === o.id && <motion.span layoutId={`${scope}-seg`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{t(o.label)}</span>
        </button>
      ))}
    </div>
  );
}

/** A number with a decimal comma in German. */
export function useNum() {
  const t = useText();
  return (v: number, digits?: number) => {
    const s = digits === undefined ? String(Math.round(v * 1e6) / 1e6) : v.toFixed(digits);
    return t(tx(s, s.replace(".", ",")));
  };
}

/** Opaque tints of the accent for drawings (opaque, so stacked shapes cover each other). */
export const TINT = {
  soft: "color-mix(in oklab, var(--blob) 12%, var(--surface))",
  mid: "color-mix(in oklab, var(--blob) 26%, var(--surface))",
  strong: "color-mix(in oklab, var(--blob) 45%, var(--surface))",
  side: "color-mix(in oklab, var(--blob) 7%, var(--surface))",
};
