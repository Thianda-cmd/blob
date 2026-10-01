"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type NumberLineRay = {
  /** Boundary value. */
  at: number;
  /** Which way the shaded part goes. */
  dir: "left" | "right";
  /** Closed dot (≤, ≥) or open circle (<, >). */
  closed?: boolean;
  color?: "blob" | "ok" | "danger";
};

export type NumberLineMark = { at: number; label?: string; closed?: boolean; color?: "blob" | "ok" | "danger" | "ink" };

const COLOR = { blob: "var(--blob)", ok: "var(--ok)", danger: "var(--danger)", ink: "var(--ink)" };

/** A number line with marks and shaded rays, for inequalities and intervals. */
export function NumberLine({
  from = -6,
  to = 6,
  step = 1,
  rays = [],
  marks = [],
  className,
}: {
  from?: number;
  to?: number;
  step?: number;
  rays?: NumberLineRay[];
  marks?: NumberLineMark[];
  className?: string;
}) {
  const W = 200;
  const pad = 8;
  const x = (v: number) => pad + ((v - from) / (to - from)) * (W - pad * 2);
  const ticks: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);

  return (
    <svg viewBox={`0 0 ${W} 34`} className={cn("w-full overflow-visible", className)} aria-hidden>
      <line x1={2} x2={W - 2} y1={16} y2={16} stroke="var(--ink-3)" strokeWidth={0.8} />
      <path d={`M${W - 4} 13.5 L${W - 1} 16 L${W - 4} 18.5`} fill="none" stroke="var(--ink-3)" strokeWidth={0.8} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={13} y2={19} stroke="var(--ink-3)" strokeWidth={t === 0 ? 0.9 : 0.5} />
          <text x={x(t)} y={28} fontSize={5} textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--font-math)">
            {String(t).replace("-", "−")}
          </text>
        </g>
      ))}
      {rays.map((r, i) => {
        const color = COLOR[r.color ?? "blob"];
        const end = r.dir === "right" ? W - 3 : 3;
        return (
          <g key={`ray${i}`}>
            <motion.line
              x1={x(r.at)}
              y1={16}
              y2={16}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.85}
              initial={{ x2: x(r.at) }}
              animate={{ x2: end, x1: x(r.at) }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
            <motion.circle
              cy={16}
              r={2.6}
              initial={{ scale: 0 }}
              animate={{ scale: 1, cx: x(r.at) }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              fill={r.closed ? color : "var(--surface)"}
              stroke={color}
              strokeWidth={1.2}
            />
          </g>
        );
      })}
      {marks.map((m, i) => {
        const color = COLOR[m.color ?? "ink"];
        return (
          <motion.g key={`mark${i}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: x(m.at) }} transition={{ type: "spring", stiffness: 400, damping: 24 }}>
            <circle cy={16} r={2.2} fill={m.closed === false ? "var(--surface)" : color} stroke={color} strokeWidth={1} />
            {m.label && (
              <text y={8} fontSize={5} textAnchor="middle" fill={color} fontFamily="var(--font-math)" fontStyle="italic">
                {m.label}
              </text>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}
