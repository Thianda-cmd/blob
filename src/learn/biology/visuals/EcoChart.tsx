"use client";

// Axes, grid and helpers for the ecology graphs (tolerance curve, population growth,
// predator and prey, lake profile). Text uses the app font and ink tokens.

import type { ReactNode } from "react";

export type Box = { W: number; H: number; l: number; r: number; t: number; b: number };

export function scales(box: Box, x: [number, number], y: [number, number], flipY = false) {
  const px = (v: number) => box.l + ((v - x[0]) / (x[1] - x[0])) * (box.W - box.l - box.r);
  const py = (v: number) =>
    flipY ? box.t + ((v - y[0]) / (y[1] - y[0])) * (box.H - box.t - box.b) : box.H - box.b - ((v - y[0]) / (y[1] - y[0])) * (box.H - box.t - box.b);
  return { px, py };
}

export const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

const FONT = { fontFamily: "var(--font-sans)" } as const;

export function Axes({
  box,
  x,
  y,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  xFmt = String,
  yFmt = String,
  flipY = false,
  grid = true,
  yTickLabels = true,
}: {
  box: Box;
  x: [number, number];
  y: [number, number];
  xTicks: number[];
  yTicks: number[];
  xLabel: string;
  yLabel: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  flipY?: boolean;
  grid?: boolean;
  yTickLabels?: boolean;
}) {
  const { px, py } = scales(box, x, y, flipY);
  const x0 = box.l;
  const y0 = flipY ? box.t : box.H - box.b;
  return (
    <g>
      {grid &&
        yTicks.map((v) => <line key={`gy${v}`} x1={box.l} x2={box.W - box.r} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeWidth={0.8} />)}
      {grid &&
        xTicks.map((v) => <line key={`gx${v}`} x1={px(v)} x2={px(v)} y1={box.t} y2={box.H - box.b} stroke="var(--line)" strokeWidth={0.8} />)}
      <line x1={x0} x2={x0} y1={box.t - 4} y2={box.H - box.b} stroke="var(--ink-2)" strokeWidth={1.3} />
      <line x1={box.l} x2={box.W - box.r + 4} y1={y0} y2={y0} stroke="var(--ink-2)" strokeWidth={1.3} />
      {xTicks.map((v) => (
        <text key={`tx${v}`} x={px(v)} y={flipY ? box.t - 7 : box.H - box.b + 15} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={FONT} className="tabular-nums">
          {xFmt(v)}
        </text>
      ))}
      {yTickLabels &&
        yTicks.map((v) => (
          <text key={`ty${v}`} x={box.l - 6} y={py(v) + 3.8} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={FONT} className="tabular-nums">
            {yFmt(v)}
          </text>
        ))}
      <text x={box.W - box.r} y={flipY ? box.t - 22 : box.H - 4} textAnchor="end" fontSize={11.5} fill="var(--ink-2)" style={FONT}>
        {xLabel}
      </text>
      <text x={4} y={flipY ? box.H - 4 : box.t - 8} fontSize={11.5} fill="var(--ink-2)" style={FONT}>
        {yLabel}
      </text>
    </g>
  );
}

/** A text label with a halo so it stays readable on top of lines. */
export function Tag({ x, y, children, anchor = "middle", color = "var(--ink)", size = 12, weight = 600 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; color?: string; size?: number; weight?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill={color} stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" style={FONT}>
      {children}
    </text>
  );
}
