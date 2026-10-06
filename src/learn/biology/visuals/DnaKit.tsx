"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Base colours from the biology palette (A, T, G, C, U). */
export const BASE_COLOR: Record<string, string> = { A: "var(--bio-a)", T: "var(--bio-t)", G: "var(--bio-g)", C: "var(--bio-c)", U: "var(--bio-u)" };

/** A soft tinted background for a base, readable in light and dark mode. */
export const baseTint = (b: string, pct = 30) => `color-mix(in oklab, ${BASE_COLOR[b] ?? "var(--line)"} ${pct}%, var(--raised))`;

/** One base as a small tile with its letter (used in strands, codons and the mutation lab). */
export function BaseTile({
  base,
  size = 30,
  dim,
  ring,
  className,
  children,
}: {
  base: string;
  size?: number;
  dim?: boolean;
  /** Purple outline: "look here". */
  ring?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-md border-2 font-semibold text-ink transition-opacity", dim && "opacity-35", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.52),
        background: base.trim() ? baseTint(base) : "transparent",
        borderColor: ring ? "var(--blob)" : base.trim() ? BASE_COLOR[base] : "var(--line-2)",
        boxShadow: ring ? "0 0 0 3px color-mix(in oklab, var(--blob) 25%, transparent)" : undefined,
      }}
    >
      {base.trim() ? base : ""}
      {children}
    </span>
  );
}

/** A tile that pops in with a spring (for a strand that is being built). */
export function PopTile({ base, size = 30, ring, delay = 0 }: { base: string; size?: number; ring?: boolean; delay?: number }) {
  return (
    <motion.span initial={{ scale: 0.3, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 520, damping: 26, delay }} className="inline-grid">
      <BaseTile base={base} size={size} ring={ring} />
    </motion.span>
  );
}

/** Round step buttons used by the step-through widgets. */
export function StepButton({ onClick, disabled, label, children, primary }: { onClick: () => void; disabled?: boolean; label: string; children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-[14px] font-medium transition-colors disabled:opacity-35",
        primary ? "border-blob bg-blob text-white hover:bg-blob-deep disabled:hover:bg-blob" : "border-line text-ink-2 hover:bg-hover hover:text-ink disabled:hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

/** Small dots that show where in a process we are; tap one to jump there. */
export function StepDots({ count, at, onPick, label }: { count: number; at: number; onPick: (i: number) => void; label: (i: number) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={label(i)}
          className={cn("h-2 rounded-full transition-all", i === at ? "w-6 bg-blob" : i < at ? "w-2 bg-blob/50" : "w-2 bg-line-2")}
        />
      ))}
    </div>
  );
}

/** A segmented toggle (two or three options). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("relative rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors", value === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === o.id && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-lg bg-raised shadow-card" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
