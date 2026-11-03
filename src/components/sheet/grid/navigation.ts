// Moving around the data like Excel: Ctrl/⌘+arrows jump to the edge of the data, Ctrl/⌘+A picks
// the block of data around the active cell, Ctrl/⌘+End goes to the last used cell, and a
// double-click on the fill handle fills down as far as the data next to it goes.

import { cellKey } from "@/sheet/a1";
import type { Area, Cell, Pos, Sheet } from "@/sheet/types";

/** Has the cell something in it (a value or a formula)? Formatting alone doesn't count. */
export const filled = (cell: Cell | undefined) => !!cell && ((cell.v !== undefined && cell.v !== "") || cell.f !== undefined);

export const isFilled = (sheet: Sheet, row: number, col: number) => filled(sheet.cells[cellKey(row, col)]);

/**
 * Ctrl/⌘ + arrow from `p` (dRow/dCol: one of them ±1): inside a block of data to its last cell,
 * from its edge or from empty cells to the next filled cell, or to the sheet's edge when there is
 * none. Hidden rows and columns are stepped over.
 */
export function dataEdge(sheet: Sheet, p: Pos, dRow: number, dCol: number, rowHidden: (r: number) => boolean): Pos {
  const R = sheet.size.rows - 1;
  const C = sheet.size.cols - 1;
  const hidden = (r: number, c: number) => rowHidden(r) || !!sheet.cols[c]?.hidden;
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r <= R && c <= C;
  const step = (q: Pos): Pos | null => {
    let r = q.row + dRow;
    let c = q.col + dCol;
    while (inside(r, c) && hidden(r, c)) {
      r += dRow;
      c += dCol;
    }
    return inside(r, c) ? { row: r, col: c } : null;
  };
  const first = step(p);
  if (!first) return p;
  let cur: Pos = first;
  if (isFilled(sheet, p.row, p.col) && isFilled(sheet, first.row, first.col)) {
    // Inside a block: to its last filled cell.
    for (let next = step(cur); next && isFilled(sheet, next.row, next.col); next = step(cur)) cur = next;
    return cur;
  }
  // To the next filled cell, or the edge.
  while (!isFilled(sheet, cur.row, cur.col)) {
    const next = step(cur);
    if (!next) return cur;
    cur = next;
  }
  return cur;
}

/** The used part of the sheet (every cell with a value or a formula), or null when it is empty. */
export function usedArea(sheet: Sheet): Area | null {
  let r0 = Infinity;
  let c0 = Infinity;
  let r1 = -1;
  let c1 = -1;
  for (const key in sheet.cells) {
    if (!filled(sheet.cells[key])) continue;
    const i = key.indexOf(",");
    const r = Number(key.slice(0, i));
    const c = Number(key.slice(i + 1));
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
    if (c < c0) c0 = c;
    if (c > c1) c1 = c;
  }
  return r1 < 0 ? null : { r0, c0, r1, c1 };
}

/**
 * Excel's current region: the rectangle of data around `p`, grown while any cell touching it
 * (sideways or diagonally) has something in it. A lone empty cell gives just itself.
 */
export function currentRegion(sheet: Sheet, p: Pos): Area {
  const R = sheet.size.rows - 1;
  const C = sheet.size.cols - 1;
  const a: Area = { r0: p.row, c0: p.col, r1: p.row, c1: p.col };
  const rowHas = (r: number, c0: number, c1: number) => {
    if (r < 0 || r > R) return false;
    for (let c = Math.max(0, c0); c <= Math.min(C, c1); c++) if (isFilled(sheet, r, c)) return true;
    return false;
  };
  const colHas = (c: number, r0: number, r1: number) => {
    if (c < 0 || c > C) return false;
    for (let r = Math.max(0, r0); r <= Math.min(R, r1); r++) if (isFilled(sheet, r, c)) return true;
    return false;
  };
  for (let grown = true, guard = 0; grown && guard < 10000; guard++) {
    grown = false;
    if (rowHas(a.r0 - 1, a.c0 - 1, a.c1 + 1)) {
      a.r0--;
      grown = true;
    }
    if (rowHas(a.r1 + 1, a.c0 - 1, a.c1 + 1)) {
      a.r1++;
      grown = true;
    }
    if (colHas(a.c0 - 1, a.r0 - 1, a.r1 + 1)) {
      a.c0--;
      grown = true;
    }
    if (colHas(a.c1 + 1, a.r0 - 1, a.r1 + 1)) {
      a.c1++;
      grown = true;
    }
  }
  return a;
}

/**
 * Double-click on the fill handle: the last row to fill down to, following the data in the
 * column left of the selection (or right of it): as far as it goes without a gap. null when there
 * is nothing to follow.
 */
export function fillDownEnd(sheet: Sheet, area: Area): number | null {
  const follow = (c: number): number | null => {
    if (c < 0 || c >= sheet.size.cols || !isFilled(sheet, area.r1 + 1, c)) return null;
    let r = area.r1 + 1;
    while (r + 1 < sheet.size.rows && isFilled(sheet, r + 1, c)) r++;
    return r;
  };
  return follow(area.c0 - 1) ?? follow(area.c1 + 1);
}

/** The last filled column in a row (End), or -1. */
export function lastInRow(sheet: Sheet, row: number): number {
  let last = -1;
  for (const key in sheet.cells) {
    const i = key.indexOf(",");
    if (Number(key.slice(0, i)) !== row || !filled(sheet.cells[key])) continue;
    last = Math.max(last, Number(key.slice(i + 1)));
  }
  return last;
}
