"use client";

// Column letters and row numbers. Selected columns and rows are highlighted (stronger when the
// whole column or row is selected); a small mark shows where columns or rows are hidden. Clicks,
// drags and resizing are handled by the grid from the pointer position (see Grid.tsx).

import { memo, type ReactNode } from "react";
import { colName } from "@/sheet/a1";
import type { Area } from "@/sheet/types";
import { colWidth, rowHeight, type Layout } from "./geometry";
import type { GridText } from "./GridCells";

type Highlight = "none" | "on" | "full";

function columnHighlight(areas: Area[], rows: number, c: number): Highlight {
  let h: Highlight = "none";
  for (const a of areas) {
    if (c < a.c0 || c > a.c1) continue;
    if (a.r0 === 0 && a.r1 >= rows - 1) return "full";
    h = "on";
  }
  return h;
}

function rowHighlight(areas: Area[], cols: number, r: number): Highlight {
  let h: Highlight = "none";
  for (const a of areas) {
    if (r < a.r0 || r > a.r1) continue;
    if (a.c0 === 0 && a.c1 >= cols - 1) return "full";
    h = "on";
  }
  return h;
}

// The letters and numbers are how students read "B2:B7": dark enough to read on the header's grey
// (4.9:1 light, 5.6:1 dark), still lighter than the cells' own text.
const tone = (h: Highlight) =>
  h === "full"
    ? "bg-blob-soft font-semibold text-blob-ink"
    : h === "on"
      ? "bg-blob-soft text-blob-ink"
      : "bg-hover text-[color-mix(in_srgb,var(--ink-2)_60%,var(--ink-3))]";

/** The headers' text size: smaller with the zoom, but on touch screens never below 12 px (the header row keeps its height). */
const headerFont = (zoom: number, touch: boolean) => (touch ? Math.max(12, 12 * zoom) : Math.max(9, 11.5 * zoom));

/** The letters of columns c0…c1, positioned for a layer whose left edge is the grid's left edge. `touch`: a touch screen. */
export const ColumnHeaders = memo(function ColumnHeaders({ layout, c0, c1, areas, t, touch = false }: { layout: Layout; c0: number; c1: number; areas: Area[]; t: GridText; touch?: boolean }) {
  const out: ReactNode[] = [];
  const fontSize = headerFont(layout.zoom, touch);
  const line = Math.max(2, Math.round(2 * layout.zoom));
  for (let c = c0; c <= c1; c++) {
    const w = colWidth(layout, c);
    const x = layout.headerW + layout.colLeft[c];
    if (w === 0) {
      // Hidden: a small double line where the column would be.
      if (c === 0 || colWidth(layout, c - 1) > 0) {
        out.push(
          <div key={`h${c}`} aria-hidden title={t.hiddenCols} className="absolute top-1 z-10 border-x border-ink-3/70" style={{ left: x - 2, width: 4, height: layout.headerH - 8 }} />,
        );
      }
      continue;
    }
    const h = columnHighlight(areas, layout.rows, c);
    out.push(
      <div
        key={c}
        role="columnheader"
        aria-colindex={c + 2}
        aria-label={t.column(colName(c))}
        className={`absolute top-0 flex select-none items-center justify-center overflow-hidden whitespace-nowrap shadow-[inset_-1px_-1px_0_var(--line-2)] ${tone(h)}`}
        style={{ left: x, width: w, height: layout.headerH, fontSize }}
      >
        {colName(c)}
        {h !== "none" && <span aria-hidden className="absolute inset-x-0 bottom-0 bg-blob" style={{ height: line }} />}
      </div>,
    );
  }
  return (
    <div role="row" aria-rowindex={1} className="absolute left-0 top-0 h-0 w-0">
      {out}
    </div>
  );
});

/** The numbers of rows r0…r1, positioned for a layer whose top edge is the grid's top edge. */
export const RowHeaders = memo(function RowHeaders({ layout, r0, r1, areas, t, touch = false }: { layout: Layout; r0: number; r1: number; areas: Area[]; t: GridText; touch?: boolean }) {
  const out: ReactNode[] = [];
  const fontSize = headerFont(layout.zoom, touch);
  const line = Math.max(2, Math.round(2 * layout.zoom));
  for (let r = r0; r <= r1; r++) {
    const hgt = rowHeight(layout, r);
    const y = layout.headerH + layout.rowTop[r];
    if (hgt === 0) {
      if (r === 0 || rowHeight(layout, r - 1) > 0) {
        out.push(
          <div key={`h${r}`} aria-hidden title={t.hiddenRows} className="absolute left-1 z-10 border-y border-ink-3/70" style={{ top: y - 2, height: 4, width: layout.headerW - 8 }} />,
        );
      }
      continue;
    }
    const h = rowHighlight(areas, layout.cols, r);
    out.push(
      <div key={r} role="row" aria-rowindex={r + 2} className="absolute left-0 w-0" style={{ top: y, height: hgt }}>
        <div
          role="rowheader"
          aria-label={t.row(r + 1)}
          className={`absolute left-0 top-0 flex select-none items-center justify-center overflow-hidden whitespace-nowrap tabular-nums shadow-[inset_-1px_-1px_0_var(--line-2)] ${tone(h)}`}
          style={{ width: layout.headerW, height: hgt, fontSize }}
        >
          {r + 1}
          {h !== "none" && <span aria-hidden className="absolute inset-y-0 right-0 bg-blob" style={{ width: line }} />}
        </div>
      </div>,
    );
  }
  return <>{out}</>;
});

/** The corner above the row numbers: selects everything. */
export function CornerHeader({ layout, all, t }: { layout: Layout; all: boolean; t: GridText }) {
  const s = Math.round(8 * layout.zoom);
  return (
    <div role="row" aria-rowindex={1} className="absolute left-0 top-0 h-0 w-0">
      <div
        role="columnheader"
        aria-colindex={1}
        aria-label={t.selectAll}
        title={t.selectAll}
        className={`absolute left-0 top-0 shadow-[inset_-1px_-1px_0_var(--line-2)] ${all ? "bg-blob-soft" : "bg-hover"}`}
        style={{ width: layout.headerW, height: layout.headerH }}
      >
        <span
          aria-hidden
          className="absolute"
          style={{ right: 4, bottom: 4, width: 0, height: 0, borderLeft: `${s}px solid transparent`, borderBottom: `${s}px solid ${all ? "var(--blob)" : "var(--line-2)"}` }}
        />
      </div>
    </div>
  );
}
