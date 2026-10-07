"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

// Small UI pieces the widgets of all three levels share.

export const spring = { type: "spring" as const, stiffness: 420, damping: 32 };
export const soft = { type: "spring" as const, stiffness: 240, damping: 30 };

/** A little Blob with a speech bubble (inside a widget, so it also works on a public page). */
export function BlobSays({ text, mood }: { text: Text; mood: BlobMood }) {
  const line = useText()(text);
  return (
    <div className="flex items-end gap-2.5">
      <div className="shrink-0">
        <Blob size={52} mood={mood} track={false} accessory="glasses" interactive={false} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={line}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={spring}
          style={{ transformOrigin: "bottom left" }}
          className="mb-2 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[14px] leading-snug text-ink shadow-card"
        >
          <Inline text={line} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** − value + with a label; the value glides in when it changes. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  format = String,
}: {
  label: Text;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: Text;
  format?: (v: number) => string;
}) {
  const t = useText();
  const name = t(label);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[13.5px] text-ink-2">{name}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`Decrease: ${name}`, `Verkleinern: ${name}`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-9 text-center font-math text-[19px] tabular-nums">
        {format(value)}
        {unit ? <span className="ml-0.5 text-[14px] text-ink-2">{t(unit)}</span> : null}
      </motion.span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`Increase: ${name}`, `Vergrößern: ${name}`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Two pill tabs (or more) with a gliding background. */
export function Tabs<T extends string>({ value, options, onChange, scope }: { value: T; options: [T, Text][]; onChange: (v: T) => void; scope: string }) {
  const t = useText();
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-line p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", value === v ? "text-white" : "text-ink-2 hover:text-ink")}
        >
          {value === v && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-lg bg-blob" transition={spring} />}
          <span className="relative">{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

/** A small status lamp with a label ("Clue 1 fits"). */
export function Lamp({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors", on ? "border-ok/50 bg-ok/[0.07]" : "border-line bg-surface")}>
      <motion.span
        animate={{ scale: on ? [1, 1.35, 1] : 1 }}
        transition={{ duration: 0.35 }}
        className={cn("size-2.5 shrink-0 rounded-full transition-colors", on ? "bg-ok" : "bg-line-2")}
      />
      <div className="min-w-0 text-[13.5px] leading-snug text-ink">{children}</div>
    </div>
  );
}
