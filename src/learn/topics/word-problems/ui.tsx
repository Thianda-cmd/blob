"use client";

// Small controls the word-problem widgets share: a segmented switch, a stepper, a
// slider and Blob with a speech bubble. Tokens only, so they work in light and dark mode.

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

export const spring = { type: "spring" as const, stiffness: 420, damping: 32 };
export const soft = { type: "spring" as const, stiffness: 240, damping: 30 };

/** A row of options with a sliding highlight. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  id,
  label,
  size = "md",
}: {
  options: { value: T; label: Text }[];
  value: T;
  onChange: (v: T) => void;
  /** Unique per widget instance (layoutId of the highlight). */
  id: string;
  label: Text;
  size?: "sm" | "md";
}) {
  const t = useText();
  return (
    <div role="radiogroup" aria-label={t(label)} className="inline-flex max-w-full flex-wrap rounded-lg border border-line p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13px]",
              on ? "text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            {on && <motion.span layoutId={`${id}-seg`} className="absolute inset-0 rounded-md bg-blob" transition={spring} />}
            <span className="relative whitespace-nowrap">{t(o.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** − value + with a label. */
export function Stepper({
  label,
  value,
  onDec,
  onInc,
  canDec = true,
  canInc = true,
  unit,
  className,
}: {
  label: Text;
  value: string;
  onDec: () => void;
  onInc: () => void;
  canDec?: boolean;
  canInc?: boolean;
  unit?: string;
  className?: string;
}) {
  const t = useText();
  const name = t(label);
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="mr-1 text-[13px] text-ink-2">{name}</span>
      <button
        onClick={onDec}
        disabled={!canDec}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t({ en: `${name}: less`, de: `${name}: weniger` })}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-[2.6em] text-center font-math text-[19px] tabular-nums">
        {value}
      </motion.span>
      <button
        onClick={onInc}
        disabled={!canInc}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t({ en: `${name}: more`, de: `${name}: mehr` })}
      >
        <Plus className="size-3.5" />
      </button>
      {unit && <span className="text-[13px] text-ink-2">{unit}</span>}
    </div>
  );
}

/** A slider with a purple track and a big thumb (touch friendly); the native input does the work. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  valueText,
  className,
  stacked = false,
}: {
  label: Text;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** What the value reads like (with unit). */
  display: ReactNode;
  valueText?: string;
  className?: string;
  /** Label and value on a row above the track (for long labels). */
  stacked?: boolean;
}) {
  const t = useText();
  const pct = (value - min) / (max - min);
  const track = (
    <div className="group relative h-9 min-w-0 flex-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t(label)}
        aria-valuetext={valueText}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none absolute inset-x-2.5 inset-y-0">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
        <motion.div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blob"
          initial={false}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
        <motion.div
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blob bg-raised shadow-card ring-blob/25 group-focus-within:ring-4"
          initial={false}
          animate={{ left: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      </div>
    </div>
  );
  if (stacked)
    return (
      <div className={className}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] leading-tight text-ink-2">{t(label)}</span>
          <span className="font-math text-[17px] tabular-nums text-ink">{display}</span>
        </div>
        {track}
      </div>
    );
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-[7.5em] shrink-0 text-[13px] leading-tight text-ink-2">{t(label)}</span>
      {track}
      <span className="min-w-[4.2em] text-right font-math text-[17px] tabular-nums text-ink">{display}</span>
    </div>
  );
}

/** Blob with a speech bubble that changes with the situation. */
export function BlobLine({ text, mood = "happy" }: { text: Text; mood?: BlobMood }) {
  const line = useText()(text);
  return (
    <div className="flex items-end gap-2.5">
      <div className="shrink-0">
        <Blob size={48} mood={mood} track={false} accessory="glasses" interactive={false} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={line}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={spring}
          style={{ transformOrigin: "bottom left" }}
          className="mb-2 min-w-0 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[14px] leading-snug text-ink shadow-card"
        >
          <Inline text={line} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** A small caps heading. */
export function Label({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <div className={cn("text-[11.5px] font-semibold uppercase tracking-[0.08em]", accent ? "text-blob-ink" : "text-ink-3")}>{children}</div>;
}

/** The short instruction at the top of a widget (so it also works on its own page). */
export function HowTo({ text }: { text: Text }) {
  return (
    <p className="text-[13.5px] leading-relaxed text-ink-2">
      <Inline text={text} />
    </p>
  );
}
