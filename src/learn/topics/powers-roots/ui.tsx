"use client";

// Small controls shared by the powers-and-roots widgets: a number stepper and a segmented switch.

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

/** − value + with a label in front ("n ="). */
export function NumStepper({
  label,
  name,
  value,
  min,
  max,
  onChange,
  show,
  wide,
}: {
  /** Shown in front, e.g. "n =" (maths, italic). */
  label: string;
  /** Spoken name for the buttons ("the exponent"). */
  name: Text;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** How the value is shown (defaults to the number). */
  show?: ReactNode;
  wide?: boolean;
}) {
  const t = useText();
  const spoken = t(name);
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 font-math text-[18px] italic text-ink-2">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink active:scale-95 disabled:opacity-35"
        aria-label={t(tx(`Decrease ${spoken}`, `${spoken} verringern`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span
        key={value}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn("text-center font-math text-[20px] tabular-nums", wide ? "min-w-12" : "w-8")}
        aria-live="polite"
      >
        {show ?? value}
      </motion.span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink active:scale-95 disabled:opacity-35"
        aria-label={t(tx(`Increase ${spoken}`, `${spoken} erhöhen`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** A row of options with a sliding highlight. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  scope,
  label,
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  /** Unique id for the sliding highlight. */
  scope: string;
  label: Text;
}) {
  const t = useText();
  return (
    <div className="flex flex-wrap rounded-lg border border-line p-0.5" role="group" aria-label={t(label)}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          className={cn("relative min-h-9 rounded-md px-3 py-1.5 text-[13.5px] font-medium", value === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
          aria-pressed={value === o.id}
        >
          {value === o.id && <motion.span layoutId={`${scope}-seg`} className="absolute inset-0 rounded-md bg-hover" transition={spring} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
