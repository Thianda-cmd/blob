"use client";

import { motion } from "motion/react";
import { useId, useRef, useState } from "react";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type GraphColor = "blob" | "ink" | "ok" | "danger" | "sky";

const COLOR: Record<GraphColor, string> = {
  blob: "var(--blob)",
  ink: "var(--ink)",
  ok: "var(--ok)",
  danger: "var(--danger)",
  sky: "var(--subject-sky)",
};

export type GraphFunction = {
  f: (x: number) => number;
  color?: GraphColor;
  label?: Text;
  dashed?: boolean;
  /** Stable key so the curve morphs smoothly when `f` changes. */
  key?: string;
  /** Restrict the domain. */
  from?: number;
  to?: number;
};

export type GraphPoint = {
  x: number;
  y: number;
  label?: Text;
  color?: GraphColor;
  key?: string;
  /** Drag with the mouse/finger; snapped to `snap`. */
  draggable?: boolean;
  onDrag?: (x: number, y: number) => void;
  /** Hollow ring instead of a filled dot. */
  hollow?: boolean;
};

export type GraphSegment = {
  from: [number, number];
  to: [number, number];
  color?: GraphColor;
  dashed?: boolean;
  label?: Text;
  key?: string;
};

export type GraphProps = {
  xRange?: [number, number];
  yRange?: [number, number];
  functions?: GraphFunction[];
  points?: GraphPoint[];
  segments?: GraphSegment[];
  /** Grid spacing; also the snap step for draggable points. */
  step?: number;
  snap?: number;
  height?: number;
  className?: string;
  /** Axis names. */
  xLabel?: Text;
  yLabel?: Text;
};

const SAMPLES = 160;

/** A coordinate system that draws lines and curves, with draggable points. */
export function Graph({
  xRange = [-6, 6],
  yRange = [-5, 5],
  functions = [],
  points = [],
  segments = [],
  step = 1,
  snap,
  height = 320,
  className,
  xLabel = "x",
  yLabel = "y",
}: GraphProps) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const tt = useText();
  const W = 100 * ((xRange[1] - xRange[0]) / (yRange[1] - yRange[0]));
  const H = 100;
  const sx = (x: number) => ((x - xRange[0]) / (xRange[1] - xRange[0])) * W;
  const sy = (y: number) => H - ((y - yRange[0]) / (yRange[1] - yRange[0])) * H;
  const unit = W / (xRange[1] - xRange[0]);

  const gridX: number[] = [];
  for (let x = Math.ceil(xRange[0] / step) * step; x <= xRange[1] + 1e-9; x += step) gridX.push(Math.round(x * 1e6) / 1e6);
  const gridY: number[] = [];
  for (let y = Math.ceil(yRange[0] / step) * step; y <= yRange[1] + 1e-9; y += step) gridY.push(Math.round(y * 1e6) / 1e6);
  const labelEvery = Math.max(1, Math.round(gridX.length / 12));

  function path(fn: GraphFunction) {
    const a = Math.max(xRange[0], fn.from ?? -Infinity);
    const b = Math.min(xRange[1], fn.to ?? Infinity);
    const pad = (yRange[1] - yRange[0]) * 2;
    let d = "";
    let pen = false;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = a + ((b - a) * i) / SAMPLES;
      const y = fn.f(x);
      if (!Number.isFinite(y) || y > yRange[1] + pad || y < yRange[0] - pad) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`;
      pen = true;
    }
    return d;
  }

  function toWorld(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const s = snap ?? step;
    const x = Math.round((xRange[0] + (p.x / W) * (xRange[1] - xRange[0])) / s) * s;
    const y = Math.round((yRange[0] + ((H - p.y) / H) * (yRange[1] - yRange[0])) / s) * s;
    return [Math.min(xRange[1], Math.max(xRange[0], x)), Math.min(yRange[1], Math.max(yRange[0], y))] as const;
  }

  return (
    <div className={cn("relative w-full select-none", className)} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`-6 -4 ${W + 12} ${H + 10}`}
        className="h-full w-full touch-none overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={(e) => {
          if (!dragging) return;
          const p = points.find((pt, i) => (pt.key ?? String(i)) === dragging);
          if (!p?.onDrag) return;
          const [x, y] = toWorld(e);
          if (x !== p.x || y !== p.y) p.onDrag(x, y);
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        <defs>
          <clipPath id={`clip-${id}`}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
          <marker id={`ax-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
          </marker>
        </defs>

        {/* grid */}
        <g stroke="var(--line)" strokeWidth={0.25}>
          {gridX.map((x) => (
            <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} />
          ))}
          {gridY.map((y) => (
            <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} />
          ))}
        </g>

        {/* axes */}
        {yRange[0] <= 0 && yRange[1] >= 0 && (
          <line x1={0} x2={W + 3} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={0.45} markerEnd={`url(#ax-${id})`} />
        )}
        {xRange[0] <= 0 && xRange[1] >= 0 && (
          <line x1={sx(0)} x2={sx(0)} y1={H} y2={-3} stroke="var(--ink-3)" strokeWidth={0.45} markerEnd={`url(#ax-${id})`} />
        )}
        <g fontSize={3.1} fill="var(--ink-3)" fontFamily="var(--font-math)">
          {gridX
            .filter((x, i) => x !== 0 && i % labelEvery === 0)
            .map((x) => (
              <text key={`lx${x}`} x={sx(x)} y={Math.min(H - 1, Math.max(4, sy(0) + 4.4))} textAnchor="middle">
                {String(x).replace("-", "−")}
              </text>
            ))}
          {gridY
            .filter((y, i) => y !== 0 && i % labelEvery === 0)
            .map((y) => (
              <text key={`ly${y}`} x={Math.min(W - 1, Math.max(3, sx(0) - 1.6))} y={sy(y) + 1.1} textAnchor="end">
                {String(y).replace("-", "−")}
              </text>
            ))}
          <text x={W + 4} y={sy(0) + 1.2} fontStyle="italic" fontSize={3.8}>
            {tt(xLabel)}
          </text>
          <text x={sx(0) + 1.6} y={-2.6} fontStyle="italic" fontSize={3.8}>
            {tt(yLabel)}
          </text>
        </g>

        <g clipPath={`url(#clip-${id})`}>
          {segments.map((s, i) => (
            <motion.line
              key={s.key ?? `seg${i}`}
              initial={false}
              animate={{ x1: sx(s.from[0]), y1: sy(s.from[1]), x2: sx(s.to[0]), y2: sy(s.to[1]) }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              stroke={COLOR[s.color ?? "ink"]}
              strokeWidth={0.6}
              strokeDasharray={s.dashed ? "1.6 1.2" : undefined}
            />
          ))}
          {functions.map((fn, i) => (
            <motion.path
              key={fn.key ?? `fn${i}`}
              initial={{ pathLength: 0 }}
              animate={{ d: path(fn), pathLength: 1 }}
              transition={{ d: { type: "spring", stiffness: 200, damping: 26 }, pathLength: { duration: 0.9, ease: "easeOut" } }}
              fill="none"
              stroke={COLOR[fn.color ?? "blob"]}
              strokeWidth={0.9}
              strokeLinecap="round"
              strokeDasharray={fn.dashed ? "2 1.4" : undefined}
            />
          ))}
        </g>

        {segments
          .filter((s) => s.label)
          .map((s, i) => (
            <motion.text
              key={`sl${s.key ?? i}`}
              initial={false}
              animate={{ x: (sx(s.from[0]) + sx(s.to[0])) / 2 + (s.from[1] === s.to[1] ? 0 : 2.2), y: (sy(s.from[1]) + sy(s.to[1])) / 2 + (s.from[1] === s.to[1] ? 4 : 1) }}
              fontSize={3.2}
              fill={COLOR[s.color ?? "ink"]}
              fontFamily="var(--font-math)"
              textAnchor={s.from[1] === s.to[1] ? "middle" : "start"}
            >
              {tt(s.label)}
            </motion.text>
          ))}

        {functions
          .filter((fn) => fn.label)
          .map((fn, i) => {
            const x = Math.min(xRange[1], fn.to ?? xRange[1]) - (xRange[1] - xRange[0]) * 0.12;
            const y = fn.f(x);
            if (!Number.isFinite(y) || y > yRange[1] || y < yRange[0]) return null;
            return (
              <motion.text
                key={`fl${fn.key ?? i}`}
                initial={false}
                animate={{ x: sx(x), y: sy(y) - 2.4 }}
                fontSize={3.4}
                fill={COLOR[fn.color ?? "blob"]}
                fontFamily="var(--font-math)"
                fontStyle="italic"
              >
                {tt(fn.label)}
              </motion.text>
            );
          })}

        {points.map((p, i) => {
          const key = p.key ?? String(i);
          const color = COLOR[p.color ?? "blob"];
          return (
            <motion.g
              key={key}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1, x: sx(p.x), y: sy(p.y) }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              style={{ cursor: p.draggable ? (dragging === key ? "grabbing" : "grab") : undefined }}
              onPointerDown={(e) => {
                if (!p.draggable) return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDragging(key);
              }}
            >
              {p.draggable && <circle r={unit * 0.45} fill={color} opacity={dragging === key ? 0.22 : 0.12} />}
              <circle r={p.draggable ? 1.6 : 1.25} fill={p.hollow ? "var(--surface)" : color} stroke={color} strokeWidth={p.hollow ? 0.55 : 0} />
              {p.label && (
                <text x={2} y={-2} fontSize={3.3} fill="var(--ink)" fontFamily="var(--font-math)">
                  {tt(p.label)}
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
