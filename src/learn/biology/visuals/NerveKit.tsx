"use client";

// Small building blocks shared by the nervous-system drawings and widgets: buttons, a segmented
// control, a labelled slider, an animated note, and path helpers so an impulse can travel along
// a nerve fibre (pure maths, no DOM measuring, so it works in render).

import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Geometry

export type Pt = [number, number];

/** Points along a cubic Bézier curve (including both ends). */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Joins point lists without repeating the shared end points. */
export function chain(...parts: Pt[][]): Pt[] {
  const out: Pt[] = [];
  for (const p of parts) for (const q of p) if (!out.length || Math.hypot(out[out.length - 1][0] - q[0], out[out.length - 1][1] - q[1]) > 0.01) out.push(q);
  return out;
}

/** An SVG path through the points. */
export const pathOf = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/** A polyline you can walk along: `at(0..1)` gives the point at that share of the length. */
export function track(pts: Pt[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const at = (s: number): Pt => {
    const d = Math.min(1, Math.max(0, s)) * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const k = (d - cum[i - 1]) / seg;
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };
  /** The part of the line from share a to share b (for a glowing stretch). */
  const part = (a: number, b: number): Pt[] => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(1, Math.max(a, b));
    const out: Pt[] = [at(lo)];
    for (let i = 1; i < pts.length - 1; i++) {
      const s = cum[i] / total;
      if (s > lo && s < hi) out.push(pts[i]);
    }
    out.push(at(hi));
    return out;
  };
  return { pts, total, at, part, d: pathOf(pts) };
}

/** 0..1 progress of `t` inside the window [a, b]. */
export const span = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Controls

/** A row of options, one active (tabs or a picker). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { id: T; label: Text; icon?: ReactNode }[];
  onChange: (id: T) => void;
  label: Text;
  className?: string;
}) {
  const t = useText();
  const scope = useId();
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="radiogroup" aria-label={t(label)}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13.5px] font-medium transition-colors",
              on ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {on && <motion.span layoutId={`${scope}-seg`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            {o.icon && <span className="relative">{o.icon}</span>}
            <span className="relative">{t(o.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The main action of a widget (purple). */
export function ActionButton({ onClick, children, disabled, className }: { onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-45", className)}
    >
      {children}
    </button>
  );
}

/** A quiet secondary button. */
export function GhostButton({ onClick, children, disabled, label, pressed }: { onClick: () => void; children: ReactNode; disabled?: boolean; label?: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium transition-colors disabled:opacity-35",
        pressed ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** A slider with an icon or word at each end. */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  left,
  right,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: Text;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const t = useText();
  return (
    <div className="flex items-center gap-2.5">
      {left && <span className="shrink-0 text-[12.5px] font-medium text-ink-3">{left}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t(label)}
        className="h-10 min-w-0 flex-1 cursor-pointer accent-[var(--blob)]"
      />
      {right && <span className="shrink-0 text-[12.5px] font-medium text-ink-3">{right}</span>}
    </div>
  );
}

/** An explanation that fades when its content changes. */
export function Note({ id, text, accent, className }: { id: string; text: Text; accent?: boolean; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
        className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", accent ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2", className)}
        aria-live="polite"
      >
        <Inline text={text} />
      </motion.p>
    </AnimatePresence>
  );
}

/** A little pill that says what a structure is doing right now. */
export function Pill({ on, children }: { on?: boolean; children: ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", on ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-3")}>{children}</span>;
}

/** SVG text in the drawing style (only for short labels like ion symbols and axis labels). */
export function SvgLabel({
  x,
  y,
  children,
  size = 12,
  anchor = "middle",
  weight = 600,
  fill = "var(--ink)",
  halo,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  fill?: string;
  halo?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      stroke={halo ? "var(--raised)" : undefined}
      strokeWidth={halo ? 3.5 : undefined}
      paintOrder={halo ? "stroke" : undefined}
      strokeLinejoin="round"
      style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}
    >
      {children}
    </text>
  );
}
