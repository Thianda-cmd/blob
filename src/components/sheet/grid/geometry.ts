// Where rows and columns are on screen: sizes (with hidden rows and columns, zoom and automatic
// heights for wrapped text), the cells under a point, and which cells are visible.
//
// Coordinates: "content" coordinates have A1's top-left corner at 0,0 (the GridGeometry contract);
// the scrolling element adds the row header's width and the column header's height in front.
// Rows and columns before the freeze line stay put while the rest scrolls.

import { DEFAULT_COL_W, DEFAULT_ROW_H, type Area, type Pos, type Sheet } from "@/sheet/types";
import type { GridGeometry } from "./Grid";

/** Column header height and the narrowest row header, in px at 100 %. */
export const HEADER_H = 24;
const MIN_ROW_HEADER_W = 40;

export type Layout = {
  sheetId: string;
  zoom: number;
  rows: number;
  cols: number;
  /** rowTop[r] = top of row r (zoomed px, content coordinates); rowTop[rows] = the total height. Hidden rows have zero height. */
  rowTop: Float64Array;
  colLeft: Float64Array;
  freezeRows: number;
  freezeCols: number;
  /** How much the frozen rows and columns take (zoomed px). */
  frozenH: number;
  frozenW: number;
  /** Row header width and column header height (zoomed px). */
  headerW: number;
  headerH: number;
  /** All rows and columns (zoomed px). */
  width: number;
  height: number;
};

/**
 * Sizes of every row and column of a sheet. `rowHidden` says which rows are hidden (by hand or by
 * a smart table's filter); `autoHeights` gives rows with wrapped text the height their text needs.
 */
export function buildLayout(sheet: Sheet, zoom: number, rowHidden: (row: number) => boolean, autoHeights: ReadonlyMap<number, number>): Layout {
  const rows = sheet.size.rows;
  const cols = sheet.size.cols;
  const rowTop = new Float64Array(rows + 1);
  const defaultH = Math.round(DEFAULT_ROW_H * zoom);
  let y = 0;
  for (let r = 0; r < rows; r++) {
    rowTop[r] = y;
    if (rowHidden(r)) continue;
    const set = sheet.rows[r]?.h;
    y += set !== undefined ? Math.max(1, Math.round(set * zoom)) : autoHeights.has(r) ? Math.round(autoHeights.get(r)! * zoom) : defaultH;
  }
  rowTop[rows] = y;
  const colLeft = new Float64Array(cols + 1);
  let x = 0;
  for (let c = 0; c < cols; c++) {
    colLeft[c] = x;
    const info = sheet.cols[c];
    if (info?.hidden) continue;
    x += Math.max(1, Math.round((info?.w ?? DEFAULT_COL_W) * zoom));
  }
  colLeft[cols] = x;
  const freezeRows = Math.max(0, Math.min(rows - 1, sheet.freeze.rows));
  const freezeCols = Math.max(0, Math.min(cols - 1, sheet.freeze.cols));
  const digits = String(rows).length;
  const layout = {
    sheetId: sheet.id,
    zoom,
    rows,
    cols,
    freezeRows,
    freezeCols,
    frozenH: rowTop[freezeRows],
    frozenW: colLeft[freezeCols],
    headerW: Math.round(Math.max(MIN_ROW_HEADER_W, 16 + digits * 7.5) * zoom),
    headerH: Math.round(HEADER_H * zoom),
    width: x,
    height: y,
  } as Layout;
  // Not enumerable: React's development tools list the props of every rendered component and
  // would otherwise walk all 20,000 row positions each time (production doesn't care).
  Object.defineProperty(layout, "rowTop", { value: rowTop, enumerable: false });
  Object.defineProperty(layout, "colLeft", { value: colLeft, enumerable: false });
  return layout;
}

export const rowHeight = (l: Layout, r: number) => (r < 0 || r >= l.rows ? 0 : l.rowTop[r + 1] - l.rowTop[r]);
export const colWidth = (l: Layout, c: number) => (c < 0 || c >= l.cols ? 0 : l.colLeft[c + 1] - l.colLeft[c]);

/** The last index whose start is at or before `v` in a list of starts (binary search). */
function lastStartAtOrBefore(starts: Float64Array, count: number, v: number): number {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The row at content y (a visible one: hidden rows have no height). Above the first: the first; below the last: the last. */
export function rowAt(l: Layout, y: number): number {
  let r = lastStartAtOrBefore(l.rowTop, l.rows, Math.max(0, y));
  while (r > 0 && rowHeight(l, r) === 0) r--;
  return r;
}

export function colAt(l: Layout, x: number): number {
  let c = lastStartAtOrBefore(l.colLeft, l.cols, Math.max(0, x));
  while (c > 0 && colWidth(l, c) === 0) c--;
  return c;
}

/** A cell's box in content coordinates (hidden rows and columns: zero size). Beyond the sheet: continues with default sizes. */
export function cellRect(l: Layout, row: number, col: number): { x: number; y: number; w: number; h: number } {
  const y = row < l.rows ? l.rowTop[Math.max(0, row)] : l.height + (row - l.rows) * Math.round(DEFAULT_ROW_H * l.zoom);
  const x = col < l.cols ? l.colLeft[Math.max(0, col)] : l.width + (col - l.cols) * Math.round(DEFAULT_COL_W * l.zoom);
  const h = row < l.rows ? rowHeight(l, row) : Math.round(DEFAULT_ROW_H * l.zoom);
  const w = col < l.cols ? colWidth(l, col) : Math.round(DEFAULT_COL_W * l.zoom);
  return { x, y, w, h };
}

/** An area's box in content coordinates. */
export function areaRect(l: Layout, a: Area): { x: number; y: number; w: number; h: number } {
  const r0 = Math.max(0, Math.min(a.r0, l.rows - 1));
  const r1 = Math.max(0, Math.min(a.r1, l.rows - 1));
  const c0 = Math.max(0, Math.min(a.c0, l.cols - 1));
  const c1 = Math.max(0, Math.min(a.c1, l.cols - 1));
  const x = l.colLeft[c0];
  const y = l.rowTop[r0];
  return { x, y, w: l.colLeft[c1 + 1] - x, h: l.rowTop[r1 + 1] - y };
}

/** The contract's geometry for overlays (charts), plus the zoom so they can scale their own sizes. */
export function geometryOf(l: Layout): GridGeometry {
  return {
    sheetId: l.sheetId,
    zoom: l.zoom,
    rect: (row, col) => cellRect(l, row, col),
    cellAt: (x, y) => ({ row: rowAt(l, y), col: colAt(l, x) }),
  };
}

// ----------------------------------------------------------------------------------------------
// The scroll position and what is on screen

export type Scroll = { left: number; top: number };
export type Viewport = { w: number; h: number };

/** A point of the scrolling element's visible box (0,0 = its top-left corner) → content coordinates. Frozen parts don't scroll. */
export function viewToContent(l: Layout, px: number, py: number, scroll: Scroll): { x: number; y: number } {
  const sx = px - l.headerW;
  const sy = py - l.headerH;
  return { x: sx < l.frozenW ? sx : sx + scroll.left, y: sy < l.frozenH ? sy : sy + scroll.top };
}

/** Content coordinates → the scrolling element's visible box. */
export function contentToView(l: Layout, x: number, y: number, scroll: Scroll, frozen: { row: boolean; col: boolean }): { x: number; y: number } {
  return { x: l.headerW + x - (frozen.col ? 0 : scroll.left), y: l.headerH + y - (frozen.row ? 0 : scroll.top) };
}

export type Hit =
  | { kind: "corner" }
  /** `edge`: the column whose right border is under the pointer (to resize it). */
  | { kind: "colHeader"; col: number; edge: number | null }
  | { kind: "rowHeader"; row: number; edge: number | null }
  | { kind: "cell"; row: number; col: number };

/** What is under a point of the scrolling element's visible box. `slop`: how close to a header border counts as on it. */
export function hitTest(l: Layout, px: number, py: number, scroll: Scroll, slop: number): Hit {
  const { x, y } = viewToContent(l, px, py, scroll);
  if (px < l.headerW && py < l.headerH) return { kind: "corner" };
  if (py < l.headerH) {
    const col = colAt(l, x);
    return { kind: "colHeader", col, edge: edgeNear(l.colLeft, l.cols, x, slop, (c) => colWidth(l, c)) };
  }
  if (px < l.headerW) {
    const row = rowAt(l, y);
    return { kind: "rowHeader", row, edge: edgeNear(l.rowTop, l.rows, y, slop, (r) => rowHeight(l, r)) };
  }
  return { kind: "cell", row: rowAt(l, y), col: colAt(l, x) };
}

/** The visible row or column whose far border is within `slop` of v, or null. */
function edgeNear(starts: Float64Array, count: number, v: number, slop: number, size: (i: number) => number): number | null {
  const i = lastStartAtOrBefore(starts, count, Math.max(0, v));
  // The border at the end of i, and the one at its start (the end of the visible one before it).
  if (Math.abs(starts[i + 1] - v) <= slop && size(i) > 0) return i;
  if (Math.abs(starts[i] - v) <= slop) {
    let j = i - 1;
    while (j >= 0 && size(j) === 0) j--;
    if (j >= 0) return j;
  }
  return null;
}

/**
 * The rows and columns of the scrolling part to render: what is visible plus some more, so
 * scrolling a little shows cells that are already there. `scroll` may be rounded down by up to
 * `slack` px (the grid re-renders only every `slack` px of scrolling).
 */
export function renderWindow(l: Layout, scroll: Scroll, view: Viewport, slack: number): { r0: number; r1: number; c0: number; c1: number } {
  const over = 160 * Math.max(1, l.zoom);
  const top = scroll.top + l.frozenH - over;
  const bottom = scroll.top + slack + Math.max(0, view.h - l.headerH) + over;
  const left = scroll.left + l.frozenW - over;
  const right = scroll.left + slack + Math.max(0, view.w - l.headerW) + over;
  return {
    r0: Math.max(l.freezeRows, rowAt(l, top)),
    r1: Math.max(l.freezeRows, rowAt(l, bottom)),
    c0: Math.max(l.freezeCols, colAt(l, left)),
    c1: Math.max(l.freezeCols, colAt(l, right)),
  };
}

/** The scroll position that shows a cell (or keeps the current one when it already shows). */
export function scrollToShow(l: Layout, p: Pos, scroll: Scroll, view: Viewport): Scroll {
  let { left, top } = scroll;
  if (p.row >= l.freezeRows && p.row < l.rows) {
    const y0 = l.rowTop[p.row];
    const y1 = l.rowTop[p.row + 1];
    const visTop = top + l.frozenH;
    const visBottom = top + view.h - l.headerH;
    if (y0 < visTop) top = y0 - l.frozenH;
    else if (y1 > visBottom) top = Math.min(y0 - l.frozenH, y1 - (view.h - l.headerH));
  }
  if (p.col >= l.freezeCols && p.col < l.cols) {
    const x0 = l.colLeft[p.col];
    const x1 = l.colLeft[p.col + 1];
    const visLeft = left + l.frozenW;
    const visRight = left + view.w - l.headerW;
    if (x0 < visLeft) left = x0 - l.frozenW;
    else if (x1 > visRight) left = Math.min(x0 - l.frozenW, x1 - (view.w - l.headerW));
  }
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

/** How many rows a page (PageUp/PageDown) is: the visible part of the scrolling rows. */
export function pageRows(l: Layout, view: Viewport): number {
  const h = Math.max(0, view.h - l.headerH - l.frozenH);
  return Math.max(1, Math.floor(h / Math.max(1, Math.round(DEFAULT_ROW_H * l.zoom))) - 1);
}
