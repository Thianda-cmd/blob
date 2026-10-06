"use client";

// Small helpers shared by the circulation drawings and widgets: geometry along polylines,
// smooth curves through points, colours for oxygen-rich/oxygen-poor blood and a few buttons.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Pt = [number, number];

/** Length of a polyline. */
export function polyLength(pts: Pt[]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** The point at arc length `s` along a polyline (clamped to its ends). */
export function pointAt(pts: Pt[], s: number): Pt {
  if (s <= 0) return pts[0];
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (rest <= d) {
      const f = d ? rest / d : 0;
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
    rest -= d;
  }
  return pts[pts.length - 1];
}

/** Joins polylines end to start (a repeated joint point is dropped). */
export function joinPolys(...parts: Pt[][]): Pt[] {
  const out: Pt[] = [];
  for (const p of parts) {
    for (const q of p) {
      const last = out[out.length - 1];
      if (last && Math.abs(last[0] - q[0]) < 0.01 && Math.abs(last[1] - q[1]) < 0.01) continue;
      out.push(q);
    }
  }
  return out;
}

/** "M x y L x y …" for a polyline. */
export const polyPath = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
export function smoothPath(pts: Pt[], tension = 1) {
  if (pts.length < 3) return polyPath(pts);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Linear interpolation in a series of [x, y] points sorted by x. */
export function valueAt(series: Pt[], x: number) {
  if (x <= series[0][0]) return series[0][1];
  for (let i = 1; i < series.length; i++) {
    const [x0, y0] = series[i - 1];
    const [x1, y1] = series[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return series[series.length - 1][1];
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through [x, y] points sorted by x: smooth, but
 * never overshoots, so peaks and plateaus stay where the data puts them.
 */
export function monotone(series: Pt[]) {
  const n = series.length;
  const xs = series.map((p) => p[0]);
  const ys = series.map((p) => p[1]);
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const hh = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / hh;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * hh * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * hh * m[i + 1];
  };
}

/** Blood colour between oxygen-poor (0) and oxygen-rich (1). */
export const bloodMix = (rich: number) => {
  const p = Math.round(Math.max(0, Math.min(1, rich)) * 100);
  return p >= 100 ? "var(--bio-blood)" : p <= 0 ? "var(--bio-blood-low)" : `color-mix(in srgb, var(--bio-blood) ${p}%, var(--bio-blood-low))`;
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A small deterministic pseudo-random number in [0, 1) for index i (no Math.random in render). */
export function noise(i: number, salt = 0) {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 7, 1597334677);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Buttons

export function Chip({ on, onClick, children, className, label }: { on: boolean; onClick: () => void; children: ReactNode; className?: string; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors",
        on ? "border-transparent bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MainButton({ onClick, children, className, disabled }: { onClick: () => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SoftButton({ onClick, children, className, disabled, label }: { onClick: () => void; children: ReactNode; className?: string; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn("flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30", className)}
    >
      {children}
    </button>
  );
}

/** A labelled range slider with the value shown on the right. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="font-math text-[15px] tabular-nums text-ink">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-8 w-full cursor-pointer accent-[var(--blob)]"
      />
    </label>
  );
}

/** Text inside drawings: small, in the app font, readable in both themes. */
export const svgText = { fontFamily: "var(--font-sans)" } as const;
