// The grid's own actions on the selection, shared by keyboard shortcuts and the context menu:
// fill down/right, clear, insert and delete rows or columns, hide and show them, freeze, notes,
// fitting columns and rows to their content, Ctrl+Enter into every selected cell, Ctrl+A.

import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { cellKey } from "@/sheet/a1";
import { shiftFormula } from "@/sheet/engine";
import {
  clearAreas,
  copyArea,
  deleteCols,
  deleteRows,
  fillArea,
  getCell,
  insertCols,
  insertRows,
  pasteClip,
  setCells,
  setColWidths,
  setFreeze,
  setHidden,
  setRowHeights,
  sheetById,
} from "@/sheet/ops";
import { DEFAULT_COL_W, type Area, type Cell, type Pos, type Sheet } from "@/sheet/types";
import { activeArea, growSheet, parseTyped, selectionAreas, singleCell, tablesAfterPaste, typedCell, type SheetStore } from "../store";
import { BASE_FONT, CELL_PAD, shownText } from "./cellLook";
import { textWidth } from "./measure";
import { currentRegion } from "./navigation";

const labelsOf = (store: SheetStore) => sheetGridText[store.get().locale].labels;
const sheetOf = (store: SheetStore): Sheet => {
  const s = store.get();
  return sheetById(s.workbook, s.sheetId)!;
};

/** Does the area cover whole rows (every column) or whole columns (every row)? */
export function wholeness(area: Area, sheet: Sheet): { rows: boolean; cols: boolean } {
  return { rows: area.c0 === 0 && area.c1 >= sheet.size.cols - 1, cols: area.r0 === 0 && area.r1 >= sheet.size.rows - 1 };
}

/** Rows (or columns) of the selection, each once, in order. */
export function selectedIndexes(store: SheetStore, kind: "rows" | "cols"): number[] {
  const set = new Set<number>();
  for (const a of selectionAreas(store.get().selection)) {
    const [from, to] = kind === "rows" ? [a.r0, a.r1] : [a.c0, a.c1];
    for (let i = from; i <= to; i++) set.add(i);
  }
  return [...set].sort((x, y) => x - y);
}

/** Ctrl+D / Ctrl+R: copy the first row (column) of the selection into the rest; one cell copies the one above (left of) it. */
export function fillFrom(store: SheetStore, dir: "down" | "right") {
  const s = store.get();
  const a = activeArea(s.selection);
  let from: Area;
  let to: Area;
  if (dir === "down") {
    if (a.r0 === a.r1) {
      if (a.r0 === 0) return;
      from = { ...a, r0: a.r0 - 1, r1: a.r0 - 1 };
      to = a;
    } else {
      from = { ...a, r1: a.r0 };
      to = { ...a, r0: a.r0 + 1 };
    }
  } else if (a.c0 === a.c1) {
    if (a.c0 === 0) return;
    from = { ...a, c0: a.c0 - 1, c1: a.c0 - 1 };
    to = a;
  } else {
    from = { ...a, c1: a.c0 };
    to = { ...a, c0: a.c0 + 1 };
  }
  const labels = labelsOf(store);
  store.apply(dir === "down" ? labels.fillDown : labels.fillRight, (wb, calc) => {
    const next = pasteClip(wb, calc, s.sheetId, to, copyArea(wb, s.sheetId, from), { mode: "all" });
    // Filled right under (or beside) a smart table: it grows over the new cells, like typing there.
    return next === wb ? wb : tablesAfterPaste(next, s.sheetId, to, s.locale);
  });
}

/**
 * The fill handle (dragged, or double-clicked to fill down beside the data): `from` continued over
 * `to` (series, formulas, looks), which ends up selected. A smart table right above or beside
 * grows over the new cells, in the same undo step.
 */
export function fillTo(store: SheetStore, from: Area, to: Area) {
  const s = store.get();
  store.apply(labelsOf(store).fill, (wb, calc) => {
    const next = fillArea(wb, calc, s.sheetId, from, to, s.locale);
    return next === wb ? wb : tablesAfterPaste(next, s.sheetId, to, s.locale);
  });
  store.select({ anchor: { row: to.r0, col: to.c0 }, focus: { row: to.r1, col: to.c1 }, extra: [] });
}

/** Delete/Backspace: clear what is in the selected cells (their look stays). */
export function clearSelection(store: SheetStore, what: "contents" | "formats" = "contents") {
  const s = store.get();
  const labels = labelsOf(store);
  store.apply(what === "contents" ? labels.clear : labels.clearFormats, (wb) => clearAreas(wb, s.sheetId, selectionAreas(s.selection), what));
}

/**
 * Ctrl+Enter: what was typed goes into every selected cell. A formula moves with each cell like
 * filling (=A1*2 typed in B1 gives =A2*2 in B2). false: the formula doesn't parse.
 */
export function fillSelectionWith(store: SheetStore, text: string): boolean {
  const s = store.get();
  const e = s.edit;
  if (!e) return false;
  const at: Pos = { row: e.row, col: e.col };
  const parsed = parseTyped(text, s.locale, getCell(s.workbook, e.sheetId, at.row, at.col));
  if (parsed.error) return store.commitEdit(null);
  // The cells selected when typing began (pointing at cells for a formula moved the selection since).
  const sel = store.editSelection() ?? singleCell(at);
  const areas = selectionAreas(sel);
  // One cell: that's typing without moving on (a smart table continues its formula column, grows…).
  if (areas.length === 1 && areas[0].r0 === areas[0].r1 && areas[0].c0 === areas[0].c1) return store.commitEdit(null);
  store.cancelEdit();
  store.apply(labelsOf(store).fillSelection, (wb) => {
    const updates: { row: number; col: number; cell: Cell | null }[] = [];
    for (const a of areas) {
      for (let r = a.r0; r <= a.r1; r++) {
        for (let c = a.c0; c <= a.c1; c++) {
          const f = parsed.cell.f;
          const p = f !== undefined && (r !== at.row || c !== at.col) ? { ...parsed, cell: { f: shiftFormula(f, r - at.row, c - at.col) } } : parsed;
          updates.push({ row: r, col: c, cell: typedCell(getCell(wb, e.sheetId, r, c), p) });
        }
      }
    }
    const next = setCells(wb, e.sheetId, updates);
    return next === wb ? wb : tablesAfterPaste(next, e.sheetId, areas, s.locale);
  });
  store.select(sel);
  return true;
}

/** Insert rows above (or columns left of) the selection, as many as are selected; `after` inserts below (right of) it. */
export function insertAtSelection(store: SheetStore, kind: "rows" | "cols", after = false) {
  const s = store.get();
  const a = activeArea(s.selection);
  const labels = labelsOf(store);
  if (kind === "rows") {
    const count = a.r1 - a.r0 + 1;
    store.apply(labels.insertRows, (wb) => insertRows(wb, s.sheetId, after ? a.r1 + 1 : a.r0, count));
  } else {
    const count = a.c1 - a.c0 + 1;
    store.apply(labels.insertCols, (wb) => insertCols(wb, s.sheetId, after ? a.c1 + 1 : a.c0, count, s.locale));
  }
}

/** Delete the selected rows (or columns), all areas, from the bottom up so the indexes stay right. */
export function deleteAtSelection(store: SheetStore, kind: "rows" | "cols") {
  const s = store.get();
  const indexes = selectedIndexes(store, kind);
  const sheet = sheetOf(store);
  const total = kind === "rows" ? sheet.size.rows : sheet.size.cols;
  // Never every row or column: a sheet keeps at least one.
  if (!indexes.length || indexes.length >= total) return;
  const runs: [number, number][] = [];
  for (const i of indexes) {
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === i) last[1]++;
    else runs.push([i, 1]);
  }
  const labels = labelsOf(store);
  store.apply(kind === "rows" ? labels.deleteRows : labels.deleteCols, (wb) => {
    let out = wb;
    for (const [at, count] of runs.reverse()) out = kind === "rows" ? deleteRows(out, s.sheetId, at, count) : deleteCols(out, s.sheetId, at, count);
    return out;
  });
  const p = s.selection.anchor;
  store.select(kind === "rows" ? { row: Math.min(p.row, Math.max(0, total - indexes.length - 1)), col: p.col } : { row: p.row, col: Math.min(p.col, Math.max(0, total - indexes.length - 1)) });
}

export function hideSelection(store: SheetStore, kind: "rows" | "cols") {
  const s = store.get();
  const indexes = selectedIndexes(store, kind);
  const sheet = sheetOf(store);
  if (indexes.length >= (kind === "rows" ? sheet.size.rows : sheet.size.cols)) return;
  store.apply(labelsOf(store).hide, (wb) => setHidden(wb, s.sheetId, kind, indexes, true));
}

/** Hidden rows (columns) in the selection or right next to it. */
export function hiddenNear(store: SheetStore, kind: "rows" | "cols"): number[] {
  const s = store.get();
  const sheet = sheetOf(store);
  const hidden = (i: number) => (kind === "rows" ? !!sheet.rows[i]?.hidden : !!sheet.cols[i]?.hidden);
  const max = kind === "rows" ? sheet.size.rows : sheet.size.cols;
  const out = new Set<number>();
  for (const a of selectionAreas(s.selection)) {
    const [from, to] = kind === "rows" ? [a.r0, a.r1] : [a.c0, a.c1];
    for (let i = from; i <= to; i++) if (hidden(i)) out.add(i);
    for (let i = from - 1; i >= 0 && hidden(i); i--) out.add(i);
    for (let i = to + 1; i < max && hidden(i); i++) out.add(i);
  }
  return [...out].sort((x, y) => x - y);
}

export function unhideNear(store: SheetStore, kind: "rows" | "cols", indexes = hiddenNear(store, kind)) {
  if (!indexes.length) return;
  const sheetId = store.get().sheetId;
  store.apply(labelsOf(store).unhide, (wb) => setHidden(wb, sheetId, kind, indexes, false));
}

/** Freeze the rows above and the columns left of the active cell (whole rows or columns selected: only those); `top`: just the first row; off: none. */
export function freeze(store: SheetStore, how: "here" | "top" | "off") {
  const s = store.get();
  const sheet = sheetOf(store);
  let rows = 0;
  let cols = 0;
  if (how === "top") rows = 1;
  else if (how === "here") {
    const a = activeArea(s.selection);
    const whole = wholeness(a, sheet);
    rows = whole.cols ? 0 : whole.rows ? a.r0 : s.selection.anchor.row;
    cols = whole.rows ? 0 : whole.cols ? a.c0 : s.selection.anchor.col;
    if (!rows && !cols) return;
  }
  store.apply(labelsOf(store).freeze, (wb) => setFreeze(wb, s.sheetId, rows, cols));
}

/** Set (or with an empty text, remove) a cell's note. */
export function setNote(store: SheetStore, at: Pos, note: string) {
  const s = store.get();
  const text = note.trim() ? note.replace(/\s+$/, "") : "";
  const current = getCell(s.workbook, s.sheetId, at.row, at.col);
  if ((current?.note ?? "") === text) return;
  store.apply(labelsOf(store).note, (wb) => {
    const cell = getCell(wb, s.sheetId, at.row, at.col);
    const next: Cell = { ...cell };
    if (text) next.note = text;
    else delete next.note;
    return setCells(wb, s.sheetId, [{ row: at.row, col: at.col, cell: next }]);
  });
}

/** The width a column needs for everything in it (px at 100 %), or null when it is empty. */
export function contentWidth(store: SheetStore, col: number): number | null {
  const s = store.get();
  const sheet = sheetOf(store);
  let max = 0;
  for (const key in sheet.cells) {
    const i = key.indexOf(",");
    if (Number(key.slice(i + 1)) !== col) continue;
    const row = Number(key.slice(0, i));
    const cell = sheet.cells[key];
    if (cell.v === undefined && cell.f === undefined) continue;
    const text = shownText(s.calc.value(s.sheetId, row, col), cell.s?.fmt, s.locale);
    const w = textWidth(text, cell.s?.size ?? BASE_FONT, !!cell.s?.bold, !!cell.s?.italic);
    if (w > max) max = w;
  }
  return max > 0 ? Math.min(600, Math.max(24, Math.ceil(max + 2 * CELL_PAD + 6))) : null;
}

/** Double-click on a column border (or "fit" in the menu): each column as wide as its content. */
export function fitColumns(store: SheetStore, cols: number[]) {
  const sheetId = store.get().sheetId;
  const widths = cols.map((c) => [c, contentWidth(store, c)] as const);
  store.apply(sheetGridText[store.get().locale].labels.colWidth, (wb) => {
    let out = wb;
    for (const [c, w] of widths) out = setColWidths(out, sheetId, [c], w === null || w === DEFAULT_COL_W ? null : w);
    return out;
  });
}

/** Rows back to their natural height (the default, or what wrapped text needs). */
export function fitRows(store: SheetStore, rows: number[]) {
  const sheetId = store.get().sheetId;
  store.apply(labelsOf(store).rowHeight, (wb) => setRowHeights(wb, sheetId, rows, null));
}

/** Ctrl/⌘+A: the block of data around the active cell first, everything the second time. */
export function selectRegionOrAll(store: SheetStore) {
  const s = store.get();
  const sheet = sheetOf(store);
  const all: Area = { r0: 0, c0: 0, r1: sheet.size.rows - 1, c1: sheet.size.cols - 1 };
  const region = currentRegion(sheet, s.selection.anchor);
  const current = activeArea(s.selection);
  const single = region.r0 === region.r1 && region.c0 === region.c1;
  const same = current.r0 === region.r0 && current.r1 === region.r1 && current.c0 === region.c0 && current.c1 === region.c1;
  const target = single || same ? all : region;
  store.select({ anchor: { row: target.r0, col: target.c0 }, focus: { row: target.r1, col: target.c1 }, extra: [] });
}

/** Add rows (or columns) at the end of the sheet. */
export function addRoom(store: SheetStore, kind: "rows" | "cols", count: number) {
  const s = store.get();
  const sheet = sheetOf(store);
  const labels = labelsOf(store);
  store.apply(kind === "rows" ? labels.addRows : labels.addCols, (wb) =>
    kind === "rows" ? growSheet(wb, s.sheetId, sheet.size.rows + count, sheet.size.cols) : growSheet(wb, s.sheetId, sheet.size.rows, sheet.size.cols + count),
  );
}

/** Is a cell's position inside any selected area? */
export function isSelected(store: SheetStore, p: Pos): boolean {
  return selectionAreas(store.get().selection).some((a) => p.row >= a.r0 && p.row <= a.r1 && p.col >= a.c0 && p.col <= a.c1);
}

/** The note of a cell, if any. */
export const noteAt = (sheet: Sheet, p: Pos) => sheet.cells[cellKey(p.row, p.col)]?.note ?? "";
