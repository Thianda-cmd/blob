// What of the grid's cells can be seen. On narrow screens SheetEditor docks the chart and table
// settings over the editor's lower part ([data-sheet-dock]), and on phones and tablets the
// on-screen keyboard covers the screen's lower part: the cells behind them are in the grid but out
// of sight. Drags stop at the last cell that can be seen and scroll on from there (at a speed a
// finger can follow), so filling or selecting never reaches cells the student can't see, and the
// moving end of the selection is kept where it can be seen (Grid.tsx). The fill-by-touch hint is
// placed here too: over the cells that can be seen, away from the square it talks about.

import { inArea } from "@/sheet/a1";
import type { Area, Pos } from "@/sheet/types";
import { colAt, rowAt, viewToContent, type Layout, type Scroll } from "./geometry";

/**
 * The top of the settings docked over the editor's lower part (viewport y), or null when none are
 * docked. Measured without their slide-in transform, so it is right while they still move up.
 */
export function dockTop(within: Element): number | null {
  const editor = within.closest<HTMLElement>("[data-sheet-editor]");
  const dock = editor?.querySelector<HTMLElement>(":scope > [data-sheet-dock]");
  return editor && dock ? editor.getBoundingClientRect().top + editor.clientTop + dock.offsetTop : null;
}

/**
 * The bottom of the grid's cells that can be seen (viewport y): the grid's own bottom, or higher
 * where docked settings or the on-screen keyboard (the visual viewport ends there) cover it.
 * `least`: how far down from the grid's top the cells need to show (column letters, frozen rows,
 * a row) to be kept in view; settings docked over more than that (tall, on a phone) are left out,
 * as nothing can be kept in view above them.
 */
export function shownBottom(grid: HTMLElement, least = 0): number {
  const r = grid.getBoundingClientRect();
  const top = r.top + grid.clientTop;
  const dock = dockTop(grid);
  const vv = window.visualViewport;
  return Math.min(top + grid.clientHeight, dock !== null && dock >= top + least ? dock : Infinity, vv ? vv.offsetTop + vv.height : window.innerHeight);
}

/** The grid's cells that can be seen (viewport coordinates): from under the column letters (`headerH` px tall) down to shownBottom, across the grid. */
export function shownCells(grid: HTMLElement, headerH: number): { top: number; bottom: number; left: number; right: number } {
  const r = grid.getBoundingClientRect();
  const left = r.left + grid.clientLeft;
  return { top: r.top + grid.clientTop + headerH, bottom: shownBottom(grid), left, right: left + grid.clientWidth };
}

/**
 * How fast a drag scrolls the grid at an edge of the cells that can be seen, in px a second. `dist`:
 * how far the pointer is into the zone along that edge (`edge` px wide, inside the edge, and on past
 * it); `cell`: how big a cell is along the way it scrolls. A mouse or a pen: faster the further out
 * (2 px a frame at 60 Hz as it comes into the zone, at most 48), as before. A finger covers the
 * cells under it and can go far past the edge (over docked settings, half a phone's screen): from
 * about 2 cells a second as it comes into the zone, 4 to 5 at the edge, to at most 25 from 2 zones
 * past it, so a few more rows can still be taken in one at a time, and many by going further.
 */
export function scrollSpeed(dist: number, edge: number, cell: number, finger: boolean): number {
  if (dist <= 0) return 0;
  if (!finger) return 60 * Math.min(48, 2 + dist / 2.5);
  const k = Math.min(1, dist / (3 * edge));
  return cell * (2 + 23 * k * k);
}

/**
 * The top of the notice at the bottom of the editor (SheetNotice.tsx; viewport y) when its card is
 * over the viewport's x from `left` to `right`, else null (none showing, or beside them). The top
 * of the box that holds the card: it doesn't move while the card slides in.
 */
export function noticeTop(within: Element, left: number, right: number): number | null {
  const card = within.closest("[data-sheet-editor]")?.querySelector<HTMLElement>("[data-sheet-notice]");
  const holder = card?.parentElement;
  if (!card || !holder) return null;
  const r = card.getBoundingClientRect();
  return r.left < right && r.right > left ? holder.getBoundingClientRect().top : null;
}

/**
 * Where that notice goes across the editor while the on-screen keyboard is up. Centred (null), as
 * always, where the cells above it hold the row being typed in: `room` is from the grid's top down
 * to the card's top edge, `need` what the grid shows down to that row's bottom (column letters,
 * frozen rows, the row) plus a gap; the grid then keeps the row above the card. Where they don't (a
 * phone held sideways leaves about a row of cells above the keyboard), in the half of `box` (where
 * the notices are laid out, viewport x) away from the cell being typed in (`cell`) and clear of it,
 * so the cell and what is typed into it stay in sight: as how far in from the box's left and right
 * edges the notices go. Null too where that leaves them less than `least` px.
 */
export function noticeBeside(room: number, need: number, cell: { left: number; right: number }, box: { left: number; right: number }, least: number): { left: number; right: number } | null {
  if (room >= need) return null;
  const w = box.right - box.left;
  const toRight = cell.left + cell.right < box.left + box.right;
  const inset = Math.round(Math.max(w / 2, toRight ? cell.right - box.left : box.right - cell.left));
  if (w - inset < least) return null;
  return toRight ? { left: inset, right: 0 } : { left: 0, right: inset };
}

/**
 * The cell a drag points at. `px`, `py`: the pointer in the grid's own coordinates (the top-left
 * of its padding box is 0,0); `shown`: the grid's width and the height of it that can be seen (see
 * shownBottom). Above the column letters or left of the row numbers it is the first cell there; past
 * what can be seen it is the last cell that can be seen, at least half of it (the grid scrolls on
 * meanwhile, so the drag keeps going, but only ever over cells on screen).
 */
export function dragCell(l: Layout, px: number, py: number, scroll: Scroll, shown: { w: number; h: number }): Pos {
  const x = Math.max(l.headerW, Math.min(px, shown.w - 1));
  const y = Math.max(l.headerH, Math.min(py, shown.h - 1));
  const c = viewToContent(l, x, y, scroll);
  let row = rowAt(l, c.y);
  let col = colAt(l, c.x);
  if (py > y) row = mostlyShown(l.rowTop, row, scroll.top + shown.h - l.headerH, scroll.top + l.frozenH, l.freezeRows, (v) => rowAt(l, v));
  if (px > x) col = mostlyShown(l.colLeft, col, scroll.left + shown.w - l.headerW, scroll.left + l.frozenW, l.freezeCols, (v) => colAt(l, v));
  return { row, col };
}

/**
 * Row (or column) `i`, the last one that can be seen up to `end` (content px), or the one before it
 * when less than half of `i` shows: a sliver at the edge isn't seen. Frozen ones and the first one
 * after the frozen ones (from `start` on) always count.
 */
function mostlyShown(starts: Float64Array, i: number, end: number, start: number, frozen: number, at: (v: number) => number): number {
  if (i < frozen || starts[i] <= start) return i;
  return end - starts[i] >= (starts[i + 1] - starts[i]) / 2 ? i : at(starts[i] - 1);
}

/** The target of a fill-handle drag: the selection stretched toward the pointer, along the way it moved most. */
export function fillTarget(from: Area, p: Pos): Area | null {
  if (inArea(from, p.row, p.col)) return null;
  const down = p.row - from.r1;
  const up = from.r0 - p.row;
  const right = p.col - from.c1;
  const left = from.c0 - p.col;
  const vertical = Math.max(down, up);
  const horizontal = Math.max(right, left);
  if (vertical >= horizontal && vertical > 0) return down > 0 ? { ...from, r1: p.row } : { ...from, r0: p.row };
  if (horizontal > 0) return right > 0 ? { ...from, c1: p.col } : { ...from, c0: p.col };
  return null;
}

/**
 * Where the fill-by-touch hint goes (its top, viewport y), `h` px tall, so that it covers neither
 * the selection nor the fill square it talks about (`keep`: from the selection's top to the square
 * with a finger's room around it). Over the cells that can be seen (`cells`: from under the column
 * letters to where they stop being seen): right under the column letters, else at the bottom of
 * what can be seen, above the notice at the bottom of the editor when one shows over them
 * (`cells.floor`: its top; "„1.234“ ist 1234 … Als 1,234 lesen" stays readable). When they leave
 * no room for it beside the selection (a phone with docked settings shows only a few rows), over
 * the column letters and the bar above them (touches pass through it). Only when that would be off
 * the screen too, under the column letters.
 */
export function placeFillHint(cells: { top: number; bottom: number; floor?: number | null }, keep: { top: number; bottom: number }, h: number, gap = 8): number {
  const bottom = Math.min(cells.bottom, cells.floor ?? Infinity);
  const high = cells.top + gap;
  const low = bottom - gap - h;
  const fits = (top: number) => top >= cells.top && top + h <= bottom && (keep.bottom + gap <= top || keep.top >= top + h + gap);
  if (fits(high)) return high;
  if (fits(low)) return low;
  const above = cells.top - h;
  return above >= gap ? above : high;
}
