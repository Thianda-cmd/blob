"use client";

import { motion } from "motion/react";
import { useId, useSyncExternalStore, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

// Small UI pieces shared by the level 2 and level 3 widgets.

/** A number for people: decimal comma in German, a real minus sign, at most `digits` decimals. */
export function fmtNum(v: number, locale: Locale, digits = 2): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const s = String(Object.is(r, -0) ? 0 : r);
  return (locale === "de" ? s.replace(".", ",") : s).replace("-", "−");
}

/** The same number for the display language (hyphen minus, decimal comma in German). */
export function texNum(v: number, locale: Locale, digits = 2): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const s = String(Object.is(r, -0) ? 0 : r);
  return locale === "de" ? s.replace(".", ",") : s;
}

const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** Phone-sized screen? (false on the server, so the first paint is the wide drawing.) */
export const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia("(max-width: 639px)").matches, () => false);

/** A slider with a label in front and the value behind it. */
export function Slider({
  name,
  value,
  min,
  max,
  step = 1,
  shown,
  onChange,
  label,
}: {
  name: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The value as shown (formatted for the language). */
  shown: string;
  onChange: (v: number) => void;
  /** Accessible name. */
  label: string;
}) {
  const pct = (value - min) / (max - min);
  const zero = Math.min(1, Math.max(0, (0 - min) / (max - min)));
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step < 1 ? 1 : step) ticks.push(Math.round(t * 1e6) / 1e6);
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-6 shrink-0 font-math text-[19px] italic text-ink-2">{name}</span>
      <div className="group relative h-9 flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <div className="pointer-events-none absolute inset-x-2 top-0 bottom-0">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
          {ticks.map((t) => (
            <span
              key={t}
              className={cn("absolute top-[calc(50%+9px)] w-px -translate-x-1/2 bg-ink-3/50", t === 0 ? "h-2" : "h-1")}
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
            />
          ))}
          <motion.div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blob"
            initial={false}
            animate={{ left: `${Math.min(pct, zero) * 100}%`, width: `${Math.abs(pct - zero) * 100}%` }}
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
      <span className="w-11 shrink-0 text-right font-math text-[19px] tabular-nums text-ink">{shown}</span>
    </div>
  );
}

/** A row of options with a sliding purple pill on the chosen one. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const scope = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn("relative h-9 min-w-10 rounded-lg px-3 text-[14px] font-medium transition-colors", on ? "text-white" : "text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {on && <motion.span layoutId={`${scope}-pill`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A small caption above a control. */
export function Caption({ children }: { children: ReactNode }) {
  return <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</span>;
}
