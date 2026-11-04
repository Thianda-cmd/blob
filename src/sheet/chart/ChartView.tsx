"use client";

// A chart drawn in SVG: axes with clean ticks (linear or logarithmic), grid lines, series as
// points, lines, columns, bars, areas or a pie, error bars, trendlines with their equation and
// R², legend and title. Used in the spreadsheet, in notes (embedded) and for exports.
//
// CONTRACT: keep the props; add optional ones if needed.
//
// The drawing itself is laid out by buildChartScene (scene.ts), which export.ts also writes to
// SVG files; this component renders it with React and adds the tooltips (hover with a mouse or
// pen, tap on touch).

import { createElement, useId, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { ChartSpec } from "../types";
import type { ChartData } from "./data";
import { buildChartScene, textWidth, type ChartHit, type ChartScene, type SvgNode } from "./scene";

export type ChartViewProps = {
  spec: ChartSpec;
  data: ChartData;
  width: number;
  height: number;
  locale: Locale;
  /** Fixed colours for an export (no CSS variables); default: follows the page's theme. */
  theme?: "light" | "dark";
  /** Show values on hover/tap. */
  interactive?: boolean;
  /** Highlight one series (its settings are open). */
  selectedSeries?: string | null;
  /**
   * Also write what the chart shows (its summary: series, trendlines with equation and R², notes)
   * into a hidden element with this id, for a card around it that is named by the chart's kind and
   * title and describes itself with that (aria-describedby).
   */
  summaryId?: string;
  className?: string;
};

function renderNode(node: SvgNode | string, key: number): ReactNode {
  if (typeof node === "string") return node;
  const children = node.children?.map((c, i) => renderNode(c, i));
  return createElement(node.tag, { key, ...node.attrs }, children);
}

/** The tooltip under a point of the chart (in chart coordinates), or null. */
export function hitAt(hits: ChartHit[], x: number, y: number): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  hits.forEach((h, i) => {
    const a = h.area;
    if (a.kind === "near") {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= a.r && d < bestD) {
        bestD = d;
        best = i;
      }
    } else if (a.kind === "box") {
      if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1 && bestD > 1e6) {
        bestD = 1e6;
        best = i;
      }
    } else {
      const dx = x - a.cx;
      const dy = y - a.cy;
      if (Math.hypot(dx, dy) > a.r) return;
      let ang = Math.atan2(dy, dx);
      while (ang < a.a0) ang += Math.PI * 2;
      while (ang >= a.a0 + Math.PI * 2) ang -= Math.PI * 2;
      if (ang <= a.a1) {
        bestD = 0;
        best = i;
      }
    }
  });
  return best;
}

export function ChartView(props: ChartViewProps): ReactNode {
  const { spec, data, width, height, locale, theme, interactive, selectedSeries, summaryId, className } = props;
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const scene = useMemo(
    () => buildChartScene(spec, data, { width, height, locale, theme, selectedSeries, idPrefix: `chart${uid}` }),
    [spec, data, width, height, locale, theme, selectedSeries, uid],
  );
  const [active, setActive] = useState<{ scene: ChartScene; index: number } | null>(null);
  // A tooltip belongs to the drawing it was found in; a new drawing (values changed) drops it.
  const hit = interactive && active && active.scene === scene ? (scene.hits[active.index] ?? null) : null;

  const locate = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const index = hitAt(scene.hits, ((e.clientX - r.left) / r.width) * scene.width, ((e.clientY - r.top) / r.height) * scene.height);
    return index === null ? null : { scene, index };
  };
  const same = (a: typeof active, b: typeof active) => a === b || (!!a && !!b && a.scene === b.scene && a.index === b.index);
  const show = (next: typeof active) => setActive((cur) => (same(cur, next) ? cur : next));

  const drawing = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      role="img"
      aria-label={scene.label}
      className={className}
      style={{ display: "block", overflow: "visible", userSelect: "none", WebkitUserSelect: "none" }}
      onPointerMove={interactive ? (e) => show(locate(e)) : undefined}
      onPointerDown={interactive ? (e) => show(locate(e)) : undefined}
      onPointerLeave={interactive ? (e) => e.pointerType === "mouse" && show(null) : undefined}
    >
      <title>{scene.title}</title>
      {scene.nodes.map((n, i) => renderNode(n, i))}
      {hit && <Tooltip scene={scene} hit={hit} />}
    </svg>
  );
  if (!summaryId) return drawing;
  // A sentence of its own: the card's description may go on after it.
  return (
    <>
      {drawing}
      <span id={summaryId} hidden>
        {/[.!?…]$/.test(scene.summary) ? scene.summary : `${scene.summary}.`}
      </span>
    </>
  );
}

/** A small card next to the point: the series (or category) and its values. */
function Tooltip({ scene, hit }: { scene: ChartScene; hit: ChartHit }) {
  const pal = scene.palette;
  const fs = Math.round(scene.fontSize * 0.86 * 10) / 10;
  const lh = fs * 1.45;
  const pad = fs * 0.7;
  const dot = fs * 0.95;
  const rowText = (r: ChartHit["rows"][number]) => `${r.label}: ${r.value}`;
  const w = Math.max(textWidth(hit.title, fs, 600) + (hit.color ? dot : 0), ...hit.rows.map((r) => textWidth(rowText(r), fs) + (r.color ? dot : 0))) + 2 * pad;
  const h = (1 + hit.rows.length) * lh + pad * 1.1;
  const gap = fs * 1.1;
  let x = hit.x + gap;
  if (x + w > scene.width - 2) x = hit.x - gap - w;
  if (x < 2) x = Math.max(2, Math.min(scene.width - w - 2, hit.x - w / 2));
  let y = hit.y - h / 2;
  y = Math.max(2, Math.min(scene.height - h - 2, y));
  const ringR = Math.max(5, scene.fontSize * 0.55);
  return (
    <g pointerEvents="none" aria-hidden>
      {hit.rings.map((r, i) => (
        <circle key={i} cx={r.x} cy={r.y} r={ringR} fill="none" stroke={r.color} strokeWidth={2} />
      ))}
      <g style={{ filter: "drop-shadow(0 2px 6px rgb(0 0 0 / 0.16))" }}>
        <rect x={x} y={y} width={w} height={h} rx={8} fill={pal.bg} stroke={pal.grid} />
      </g>
      <g fontSize={fs}>
        {hit.color && <circle cx={x + pad + dot * 0.3} cy={y + pad * 0.55 + lh * 0.5} r={fs * 0.32} fill={hit.color} />}
        <text x={x + pad + (hit.color ? dot : 0)} y={y + pad * 0.55 + lh * 0.5 + fs * 0.35} fontWeight={600} fill={pal.ink}>
          {hit.title}
        </text>
        {hit.rows.map((r, i) => {
          const cy = y + pad * 0.55 + lh * (i + 1.5);
          return (
            <g key={i}>
              {r.color && <rect x={x + pad} y={cy - fs * 0.32} width={fs * 0.64} height={fs * 0.64} rx={2} fill={r.color} />}
              <text x={x + pad + (r.color ? dot : 0)} y={cy + fs * 0.35} fill={pal.ink2}>
                {r.label}: <tspan fill={pal.ink} fontWeight={500}>{r.value}</tspan>
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
}
