"use client";

import { useId } from "react";
import { cos, sin } from "@/lib/stableMath";

/**
 * Building blocks for the Atlas drawings: seeded scatter, waves, a phospholipid bilayer and
 * soft gradients. Coordinates are rounded so the server and the browser draw the same thing.
 */

export const r1 = (v: number) => Math.round(v * 10) / 10;

/** A small seeded random generator (mulberry32), so scattered dots sit still between renders. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points scattered inside `inside`, at least `gap` apart and outside `avoid`. */
export function scatter(seed: number, n: number, box: [number, number, number, number], inside: (x: number, y: number) => boolean, gap: number, avoid?: (x: number, y: number) => boolean) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = box;
  const out: [number, number][] = [];
  for (let i = 0; out.length < n && i < n * 60; i++) {
    const x = r1(x0 + rnd() * (x1 - x0));
    const y = r1(y0 + rnd() * (y1 - y0));
    if (!inside(x, y) || avoid?.(x, y)) continue;
    if (out.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < gap * gap)) continue;
    out.push([x, y]);
  }
  return out;
}

/** Is (x, y) inside the rounded rectangle (stadium when r = h/2)? */
export function inRoundRect(x: number, y: number, rx: number, ry: number, w: number, h: number, r: number, pad = 0) {
  const X = x - rx;
  const Y = y - ry;
  if (X < pad || Y < pad || X > w - pad || Y > h - pad) return false;
  const cx = Math.min(Math.max(X, r), w - r);
  const cy = Math.min(Math.max(Y, r), h - r);
  return (X - cx) ** 2 + (Y - cy) ** 2 <= (r - pad) ** 2;
}

/**
 * A wave along a direction: from (x, y), `len` long at `angle` degrees, `amp` high, one wave per
 * `wl`. The amplitude grows in over the first wavelength, like a flagellum leaving its hook.
 */
export function wave(x: number, y: number, len: number, angle: number, amp: number, wl: number, phase = 0) {
  const a = (angle * Math.PI) / 180;
  const ux = cos(a);
  const uy = sin(a);
  const pts: string[] = [];
  for (let s = 0; s <= len; s += 3) {
    const grow = Math.min(1, s / wl);
    const o = amp * grow * sin((s / wl) * 2 * Math.PI + phase);
    pts.push(`${r1(x + ux * s - uy * o)} ${r1(y + uy * s + ux * o)}`);
  }
  return `M ${pts.join(" L ")}`;
}

/** The point `s` along a wave() with the same arguments. */
export function wavePoint(x: number, y: number, s: number, angle: number, amp: number, wl: number, phase = 0): [number, number] {
  const a = (angle * Math.PI) / 180;
  const ux = cos(a);
  const uy = sin(a);
  const o = amp * Math.min(1, s / wl) * sin((s / wl) * 2 * Math.PI + phase);
  return [r1(x + ux * s - uy * o), r1(y + uy * s + ux * o)];
}

/** A closed wobbly loop (the folded DNA of a nucleoid) around (cx, cy). */
export function tangle(cx: number, cy: number, rx: number, ry: number, seed = 1) {
  const pts: string[] = [];
  const k = 7 + (seed % 3);
  for (let i = 0; i <= 220; i++) {
    const t = (i / 220) * 2 * Math.PI;
    const x = cx + rx * cos(t) + rx * 0.17 * cos(k * t + seed) + rx * 0.07 * sin(13 * t);
    const y = cy + ry * sin(t) + ry * 0.38 * sin((k + 1) * t + seed) + ry * 0.12 * cos(11 * t);
    pts.push(`${r1(x)} ${r1(y)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

/** A point on the outline of a stadium and its outward normal, at fraction t of the way round. */
export function onStadium(box: { x: number; y: number; w: number; h: number }, t: number): [number, number, number, number] {
  const r = box.h / 2;
  const straight = box.w - 2 * r;
  const arc = Math.PI * r;
  const L = 2 * straight + 2 * arc;
  let s = ((t % 1) + 1) % 1 * L;
  // Top edge, left to right.
  if (s < straight) return [box.x + r + s, box.y, 0, -1];
  s -= straight;
  // Right end, top to bottom.
  if (s < arc) {
    const a = -Math.PI / 2 + s / r;
    return [box.x + box.w - r + r * cos(a), box.y + r + r * sin(a), cos(a), sin(a)];
  }
  s -= arc;
  // Bottom edge, right to left.
  if (s < straight) return [box.x + box.w - r - s, box.y + box.h, 0, 1];
  s -= straight;
  const a = Math.PI / 2 + s / r;
  return [box.x + r + r * cos(a), box.y + r + r * sin(a), cos(a), sin(a)];
}

/** Unique ids for gradients and patterns in one drawing. */
export function useIds<const K extends string>(...names: K[]): Record<K, string> {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  return Object.fromEntries(names.map((n) => [n, `${n}-${base}`])) as Record<K, string>;
}

/**
 * A phospholipid bilayer seen from the side: a row of heads on each face and wavy tails in
 * between. From x0 to x1, top face at y, `h` thick.
 */
export function Bilayer({ x0, x1, y, h = 26, gap = 7.2, head = 3.2, skip }: { x0: number; x1: number; y: number; h?: number; gap?: number; head?: number; skip?: (x: number) => boolean }) {
  const xs: number[] = [];
  for (let x = x0 + gap / 2; x <= x1 - gap / 2 + 0.01; x += gap) if (!skip?.(x)) xs.push(r1(x));
  const tail = h / 2 - head - 0.6;
  return (
    <g>
      <rect x={x0} y={y + head} width={x1 - x0} height={h - 2 * head} fill="var(--bio-tail)" />
      {xs.map((x) => (
        <g key={x}>
          <path
            d={`M ${x - 1} ${r1(y + head)} q 1.2 ${r1(tail / 2)} 0 ${r1(tail)} M ${x + 1} ${r1(y + head)} q -1.2 ${r1(tail / 2)} 0 ${r1(tail)} M ${x - 1} ${r1(y + h - head)} q 1.2 ${r1(-tail / 2)} 0 ${r1(-tail)} M ${x + 1} ${r1(y + h - head)} q -1.2 ${r1(-tail / 2)} 0 ${r1(-tail)}`}
            stroke="var(--bio-head)"
            strokeWidth={0.8}
            fill="none"
            opacity={0.85}
          />
          <circle cx={x} cy={r1(y + head)} r={head} fill="var(--bio-head)" stroke="var(--bio-wood-deep)" strokeWidth={0.5} />
          <circle cx={x} cy={r1(y + h - head)} r={head} fill="var(--bio-head)" stroke="var(--bio-wood-deep)" strokeWidth={0.5} />
        </g>
      ))}
    </g>
  );
}

/** A soft top-left highlight over a shape, for a bit of volume. */
export function Shine({ id, cx = "30%", cy = "25%" }: { id: string; cx?: string; cy?: string }) {
  return (
    <radialGradient id={id} cx={cx} cy={cy} r="75%">
      <stop offset="0" stopColor="#fff" style={{ stopOpacity: "var(--bio-shine)" }} />
      <stop offset="0.55" stopColor="#fff" style={{ stopOpacity: "calc(var(--bio-shine) * 0.15)" }} />
      <stop offset="1" stopColor="#fff" stopOpacity={0} />
    </radialGradient>
  );
}
