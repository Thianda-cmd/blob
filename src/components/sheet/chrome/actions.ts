// Formatting and editing actions on the selection, shared by the toolbar buttons and the grid's
// keyboard shortcuts (Ctrl+B, Alt+=, …), so both behave the same.
//
// CONTRACT: implemented by the editor chrome; the grid imports these for its shortcuts.
//
// Every change is one undo step with its own name ("Fett", "AutoSumme"). Formatting whole rows or
// columns only touches the part of the sheet in use (at least the first 200 rows / 26 columns):
// the document stores cells, not column styles, and a whole column is 20 000 cells.

import type { Locale } from "@/i18n/config";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { areaName, cellKey, parseKey } from "@/sheet/a1";
import { FUNCTION_BY_EN, formatValue, type Calc, type CellValue } from "@/sheet/engine";
import { formulaFormat } from "@/sheet/engine/input";
import { getCell, setCells, setFreeze, setStyle as styleCells, sheetById, sortArea } from "@/sheet/ops";
import { tableAt } from "@/sheet/table/model";
import { DEFAULT_SIZE, MAX_COLS, MAX_ROWS, type Area, type BorderLine, type Cell, type CellStyle, type NumberFormat, type Pos, type Sheet, type Workbook } from "@/sheet/types";
import { currentRegion, filled } from "../grid/navigation";
import { showSheetNotice } from "../notice";
import { activeArea, selectionAreas, typedCell, typingAt, type Selection, type SheetStore } from "../store";
import { sortTableColumn } from "../table/actions";
import { insertFunctionCall } from "./formulaInput";

export type SumFn = "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN" | "STDEV.S";
export type BorderPreset = "all" | "outside" | "thickOutside" | "bottom" | "doubleBottom" | "none";
export type FreezeHow = "row" | "col" | "here" | "none";

const textOf = (store: SheetStore) => sheetChromeText[store.get().locale];

// ----------------------------------------------------------------------------------------------
// Which cells formatting touches

/** The last row and column with a value or formula (-1 when there is none). */
function usedEnd(sheet: Sheet): { row: number; col: number } {
  let row = -1;
  let col = -1;
  for (const key in sheet.cells) {
    if (!filled(sheet.cells[key])) continue;
    const p = parseKey(key);
    if (p.row > row) row = p.row;
    if (p.col > col) col = p.col;
  }
  return { row, col };
}

/**
 * The selection's areas as formatting sees them: inside the sheet, and whole rows or columns cut
 * down to the part in use (but at least the default 200 rows and 26 columns), so selecting a
 * column and making it bold doesn't write 20 000 cells.
 */
export function formatAreas(sheet: Sheet, areas: Area[]): Area[] {
  const R = sheet.size.rows - 1;
  const C = sheet.size.cols - 1;
  let end: { row: number; col: number } | null = null;
  const out: Area[] = [];
  for (const a0 of areas) {
    const a = { r0: Math.max(0, a0.r0), c0: Math.max(0, a0.c0), r1: Math.min(R, a0.r1), c1: Math.min(C, a0.c1) };
    if (a.r0 > a.r1 || a.c0 > a.c1) continue;
    if (a.r0 === 0 && a.r1 === R && R >= DEFAULT_SIZE.rows) {
      end ??= usedEnd(sheet);
      a.r1 = Math.min(R, Math.max(end.row, DEFAULT_SIZE.rows - 1));
    }
    if (a.c0 === 0 && a.c1 === C && C >= DEFAULT_SIZE.cols) {
      end ??= usedEnd(sheet);
      a.c1 = Math.min(C, Math.max(end.col, DEFAULT_SIZE.cols - 1));
    }
    out.push(a);
  }
  return out;
}

/** The selection on the sheet on screen as formatting sees it (see formatAreas). */
function selectedForFormat(store: SheetStore): { sheetId: string; areas: Area[] } | null {
  const s = store.get();
  if (s.readOnly) return null;
  const sheet = sheetById(s.workbook, s.sheetId);
  if (!sheet) return null;
  const areas = formatAreas(sheet, selectionAreas(s.selection));
  return areas.length ? { sheetId: s.sheetId, areas } : null;
}

/**
 * Does every position of the areas pass `test`? A position without a cell is tested as
 * undefined. Cheap for big areas: when `test(undefined)` fails, an area bigger than the number of
 * cells can't pass.
 */
export function everyCell(sheet: Sheet, areas: Area[], test: (cell: Cell | undefined) => boolean): boolean {
  if (test(undefined)) {
    for (const key in sheet.cells) {
      const p = parseKey(key);
      if (areas.some((a) => p.row >= a.r0 && p.row <= a.r1 && p.col >= a.c0 && p.col <= a.c1) && !test(sheet.cells[key])) return false;
    }
    return true;
  }
  let total = 0;
  for (const a of areas) total += (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);
  if (total === 0) return false;
  // More positions than cells: some position has no cell. (Overlapping Ctrl areas would count
  // twice, so with several areas every position is looked at.)
  if (areas.length === 1 && total > Object.keys(sheet.cells).length) return false;
  const seen = new Set<string>();
  for (const a of areas) {
    for (let r = a.r0; r <= a.r1; r++) {
      for (let c = a.c0; c <= a.c1; c++) {
        const key = cellKey(r, c);
        if (seen.has(key)) continue;
        seen.add(key);
        if (!test(sheet.cells[key])) return false;
      }
    }
  }
  return true;
}

// ----------------------------------------------------------------------------------------------
// Look

/** Bold, italic, underline, strike, wrap: on for every selected cell unless all already have it. */
export function toggleStyle(store: SheetStore, key: "bold" | "italic" | "underline" | "strike" | "wrap"): void {
  const sel = selectedForFormat(store);
  if (!sel) return;
  const s = store.get();
  const sheet = sheetById(s.workbook, sel.sheetId)!;
  const on = !everyCell(sheet, sel.areas, (cell) => !!cell?.s?.[key]);
  store.apply(textOf(store).steps[key], (wb) => styleCells(wb, sel.sheetId, sel.areas, { [key]: on ? true : undefined }));
}

function styleLabel(store: SheetStore, patch: Partial<CellStyle>): string {
  const steps = textOf(store).steps;
  const keys = Object.keys(patch) as (keyof CellStyle)[];
  if (keys.length !== 1) return steps.style;
  const key = keys[0];
  switch (key) {
    case "color":
      return steps.color;
    case "fill":
      return steps.fill;
    case "align":
    case "valign":
      return steps.align;
    case "size":
      return steps.size;
    case "border":
      return steps.borders;
    case "fmt":
      return steps.format;
    case "bold":
    case "italic":
    case "underline":
    case "strike":
    case "wrap":
      return steps[key];
  }
  return steps.style;
}

/** Any other look (colour, fill, alignment, size, borders); undefined values remove the setting. */
export function setStyle(store: SheetStore, patch: Partial<CellStyle>): void {
  const sel = selectedForFormat(store);
  if (!sel) return;
  store.apply(styleLabel(store, patch), (wb) => styleCells(wb, sel.sheetId, sel.areas, patch));
}

/** Excel's border buttons: all lines, the outline (thin or thick), a (double) line under the selection, or none. */
export function setBorders(store: SheetStore, preset: BorderPreset): void {
  const sel = selectedForFormat(store);
  if (!sel) return;
  const sheet = sheetById(store.get().workbook, sel.sheetId)!;
  store.apply(textOf(store).steps.borders, (wb) => {
    let next = wb;
    for (const a of sel.areas) next = bordersOn(next, sheet, sel.sheetId, a, preset);
    return next;
  });
}

type Side = "top" | "right" | "bottom" | "left";

/** The look with these sides set (a line) or removed (undefined). */
function withSides(style: CellStyle | undefined, sides: Partial<Record<Side, BorderLine | undefined>>): CellStyle | undefined {
  const border = { ...style?.border, ...sides };
  for (const k of Object.keys(border) as Side[]) if (border[k] === undefined) delete border[k];
  const next: CellStyle = { ...style, border };
  if (!Object.keys(border).length) delete next.border;
  return Object.keys(next).length ? next : undefined;
}

function bordersOn(wb: Workbook, sheet: Sheet, sheetId: string, a: Area, preset: BorderPreset): Workbook {
  const row = (r: number): Area => ({ r0: r, c0: a.c0, r1: r, c1: a.c1 });
  const col = (c: number): Area => ({ r0: a.r0, c0: c, r1: a.r1, c1: c });
  const sides = (areas: Area[], s: Partial<Record<Side, BorderLine | undefined>>) => (w: Workbook) => styleCells(w, sheetId, areas, (style) => withSides(style, s));
  const steps: ((w: Workbook) => Workbook)[] = [];
  switch (preset) {
    case "all":
      steps.push(sides([a], { top: "thin", right: "thin", bottom: "thin", left: "thin" }));
      break;
    case "outside":
    case "thickOutside": {
      const line: BorderLine = preset === "outside" ? "thin" : "thick";
      steps.push(sides([row(a.r0)], { top: line }), sides([row(a.r1)], { bottom: line }), sides([col(a.c0)], { left: line }), sides([col(a.c1)], { right: line }));
      break;
    }
    case "bottom":
      steps.push(sides([row(a.r1)], { bottom: "thin" }));
      break;
    case "doubleBottom":
      steps.push(sides([row(a.r1)], { bottom: "double" }));
      break;
    case "none":
      steps.push((w) => styleCells(w, sheetId, [a], (style) => withSides(style, { top: undefined, right: undefined, bottom: undefined, left: undefined })));
      // A line belongs to both cells it separates: the neighbours' sides facing the selection go too.
      if (a.r0 > 0) steps.push(sides([row(a.r0 - 1)], { bottom: undefined }));
      if (a.r1 < sheet.size.rows - 1) steps.push(sides([row(a.r1 + 1)], { top: undefined }));
      if (a.c0 > 0) steps.push(sides([col(a.c0 - 1)], { right: undefined }));
      if (a.c1 < sheet.size.cols - 1) steps.push(sides([col(a.c1 + 1)], { left: undefined }));
      break;
  }
  return steps.reduce((w, f) => f(w), wb);
}

// ----------------------------------------------------------------------------------------------
// Number formats

/** null = back to "general". */
export function setNumberFormat(store: SheetStore, fmt: NumberFormat | null): void {
  const sel = selectedForFormat(store);
  if (!sel) return;
  const next = fmt && fmt.kind !== "general" ? fmt : undefined;
  store.apply(textOf(store).steps.format, (wb) => styleCells(wb, sel.sheetId, sel.areas, { fmt: next }));
}

const clampDecimals = (n: number) => Math.max(0, Math.min(15, Math.round(n)));

/**
 * The format with one decimal more or fewer (`delta`) than `fmt` shows `value` with: in General,
 * as many as the value shows now (3,14159 → 3,1416), like Excel. 0 keeps the decimals (General
 * becomes Number with what it shows). null: decimals don't apply (dates, times, text).
 */
export function stepDecimals(fmt: NumberFormat | undefined, value: CellValue, delta: number, locale: Locale): NumberFormat | null {
  if (!fmt || fmt.kind === "general") {
    const shown = typeof value === "number" && Number.isFinite(value) ? formatValue(value, undefined, locale) : "";
    const e = shown.search(/E[+-]/);
    const mantissa = e >= 0 ? shown.slice(0, e) : shown;
    const sep = mantissa.indexOf(locale === "de" ? "," : ".");
    const decimals = sep >= 0 ? mantissa.length - sep - 1 : 0;
    return e >= 0 ? { kind: "scientific", decimals: clampDecimals(decimals + delta) } : { kind: "number", decimals: clampDecimals(decimals + delta) };
  }
  switch (fmt.kind) {
    case "number":
    case "percent":
    case "scientific":
    case "currency":
      return { ...fmt, decimals: clampDecimals(fmt.decimals + delta) };
    case "significant":
      return { ...fmt, digits: Math.max(1, Math.min(15, Math.round(fmt.digits + delta))) };
    default:
      return null;
  }
}

/** The active cell's format and value. */
function activeFormat(store: SheetStore): { fmt: NumberFormat | undefined; value: CellValue } {
  const s = store.get();
  const { row, col } = s.selection.anchor;
  return { fmt: getCell(s.workbook, s.sheetId, row, col)?.s?.fmt, value: s.calc.value(s.sheetId, row, col) };
}

/** One more or one fewer decimal (from what the active cell shows, like Excel). */
export function changeDecimals(store: SheetStore, delta: 1 | -1): void {
  const sel = selectedForFormat(store);
  if (!sel) return;
  const { fmt, value } = activeFormat(store);
  const next = stepDecimals(fmt, value, delta, store.get().locale);
  if (!next) return;
  store.apply(textOf(store).steps.decimals, (wb) => styleCells(wb, sel.sheetId, sel.areas, { fmt: next }));
}

/** Formats that can carry a unit. */
export const takesUnit = (fmt: NumberFormat | undefined): boolean => !fmt || fmt.kind === "general" || fmt.kind === "number" || fmt.kind === "scientific" || fmt.kind === "significant";

/** The unit the active cell shows, or "". */
export const unitOf = (fmt: NumberFormat | undefined): string => (fmt && (fmt.kind === "number" || fmt.kind === "scientific" || fmt.kind === "significant") ? (fmt.unit ?? "") : "");

/**
 * Show `unit` after the selected numbers ("12,5 mg/L"); null or "" removes it. A number in General
 * keeps the decimals it shows (0,0523 stays 0,0523 mg/L); empty cells get the active cell's, so
 * what is typed there later shows the unit too. Percentages, dates and the like keep their format.
 */
export function setUnit(store: SheetStore, unit: string | null): void {
  const sel = selectedForFormat(store);
  if (!sel) return;
  const s = store.get();
  const sheet = sheetById(s.workbook, sel.sheetId)!;
  const u = unit && unit.trim() ? unit.trim().slice(0, 24) : undefined;
  const active = activeFormat(store);
  const fallback: NumberFormat =
    active.fmt && (active.fmt.kind === "number" || active.fmt.kind === "scientific" || active.fmt.kind === "significant")
      ? active.fmt
      : (stepDecimals(undefined, active.value, 0, s.locale) ?? { kind: "number", decimals: 2 });
  const withUnit = (fmt: NumberFormat): NumberFormat => {
    if (fmt.kind !== "number" && fmt.kind !== "scientific" && fmt.kind !== "significant") return fmt;
    const next = { ...fmt };
    if (u) next.unit = u;
    else delete next.unit;
    return next;
  };
  const { sheetId, locale } = s;
  store.apply(textOf(store).steps.unit, (wb, calc) => {
    const updates: { row: number; col: number; cell: Cell | null }[] = [];
    const seen = new Set<string>();
    for (const a of sel.areas) {
      for (let r = a.r0; r <= a.r1; r++) {
        for (let c = a.c0; c <= a.c1; c++) {
          const key = cellKey(r, c);
          if (seen.has(key)) continue;
          seen.add(key);
          const cell = sheet.cells[key];
          const fmt = cell?.s?.fmt;
          if (!takesUnit(fmt)) continue;
          let next: NumberFormat;
          if (fmt && fmt.kind !== "general") next = withUnit(fmt);
          else if (!u) continue;
          else {
            const value = calc.value(sheetId, r, c);
            next = withUnit(typeof value === "number" ? (stepDecimals(undefined, value, 0, locale) ?? fallback) : fallback);
          }
          if (JSON.stringify(next) === JSON.stringify(fmt)) continue;
          updates.push({ row: r, col: c, cell: { ...cell, s: { ...cell?.s, fmt: next } } });
        }
      }
    }
    return setCells(wb, sheetId, updates);
  });
}

// ----------------------------------------------------------------------------------------------
// AutoSum

const isNumber = (calc: Calc, sheetId: string, r: number, c: number) => r >= 0 && c >= 0 && typeof calc.value(sheetId, r, c) === "number";
const isEmpty = (sheet: Sheet, r: number, c: number) => !filled(sheet.cells[cellKey(r, c)]);

/**
 * What AutoSum adds up for one cell, like Excel: the block of numbers right above it, else the one
 * left of it; empty cells between the block and the cell are included. null: no numbers there.
 */
export function autoSumRange(sheet: Sheet, calc: Calc, sheetId: string, at: Pos): Area | null {
  const up = (): Area | null => {
    let r = at.row - 1;
    while (r >= 0 && isEmpty(sheet, r, at.col)) r--;
    if (!isNumber(calc, sheetId, r, at.col)) return null;
    let top = r;
    while (isNumber(calc, sheetId, top - 1, at.col)) top--;
    return { r0: top, c0: at.col, r1: at.row - 1, c1: at.col };
  };
  const left = (): Area | null => {
    let c = at.col - 1;
    while (c >= 0 && isEmpty(sheet, at.row, c)) c--;
    if (!isNumber(calc, sheetId, at.row, c)) return null;
    let first = c;
    while (isNumber(calc, sheetId, at.row, first - 1)) first--;
    return { r0: at.row, c0: first, r1: at.row, c1: at.col - 1 };
  };
  if (isNumber(calc, sheetId, at.row - 1, at.col)) return up();
  if (isNumber(calc, sheetId, at.row, at.col - 1)) return left();
  return up() ?? left();
}

/** Whole columns (rows) cut down to the rows (columns) with data and one more for the results; null when there is no data. */
function trimWhole(sheet: Sheet, a: Area): Area | null {
  const wholeCols = a.r0 === 0 && a.r1 >= sheet.size.rows - 1;
  const wholeRows = a.c0 === 0 && a.c1 >= sheet.size.cols - 1;
  if (!wholeCols && !wholeRows) return a;
  let last = -1;
  for (const key in sheet.cells) {
    if (!filled(sheet.cells[key])) continue;
    const p = parseKey(key);
    if (wholeCols && p.col >= a.c0 && p.col <= a.c1) last = Math.max(last, p.row);
    else if (!wholeCols && p.row >= a.r0 && p.row <= a.r1) last = Math.max(last, p.col);
  }
  if (last < 0) return null;
  return wholeCols ? { ...a, r1: Math.min(MAX_ROWS - 1, last + 1) } : { ...a, c1: Math.min(MAX_COLS - 1, last + 1) };
}

/**
 * The formulas AutoSum writes for a selected range (canonical, e.g. SUM(B2:B9)): under each column
 * with numbers (into the selection's last row when it is empty, else into the first free row
 * below), to the right of a single row, or right of each row when the last column is empty (both
 * plus a grand total when the last row and column are empty). Text at the top or left (headers,
 * labels) is left out of the ranges.
 */
export function autoSumCells(sheet: Sheet, calc: Calc, sheetId: string, area0: Area, fn: SumFn): { row: number; col: number; f: string }[] {
  const area = trimWhole(sheet, area0);
  if (!area) return [];
  const { r0, c0, r1, c1 } = area;
  const num = (r: number, c: number) => isNumber(calc, sheetId, r, c);
  const out: { row: number; col: number; f: string }[] = [];
  const call = (a: Area) => `${fn}(${areaName(a)})`;
  /** The sum of column c over rows from..to (from the first number on), into row `at`; the first row with a number, or -1. */
  const colSum = (c: number, from: number, to: number, at: number): number => {
    let top = from;
    while (top <= to && !num(top, c)) top++;
    if (top > to) return -1;
    out.push({ row: at, col: c, f: call({ r0: top, c0: c, r1: to, c1: c }) });
    return top;
  };
  const rowSum = (r: number, from: number, to: number, at: number): number => {
    let first = from;
    while (first <= to && !num(r, first)) first++;
    if (first > to) return -1;
    out.push({ row: r, col: at, f: call({ r0: r, c0: first, r1: r, c1: to }) });
    return first;
  };
  const rowFree = (r: number, from: number, to: number) => {
    for (let c = from; c <= to; c++) if (!isEmpty(sheet, r, c)) return false;
    return true;
  };
  const colFree = (c: number, from: number, to: number) => {
    for (let r = from; r <= to; r++) if (!isEmpty(sheet, r, c)) return false;
    return true;
  };

  if (r0 === r1) {
    // One row: the result goes right of it (into its last cell when that is empty).
    if (c1 > c0 && isEmpty(sheet, r0, c1)) rowSum(r0, c0, c1 - 1, c1);
    else {
      let c = c1 + 1;
      while (c < MAX_COLS - 1 && !isEmpty(sheet, r0, c)) c++;
      rowSum(r0, c0, c1, c);
    }
    return out;
  }
  const lastRowFree = rowFree(r1, c0, c1);
  const lastColFree = c1 > c0 && colFree(c1, r0, r1);
  if (lastRowFree && lastColFree && r1 - r0 >= 1 && c1 - c0 >= 1) {
    let top = Infinity;
    let first = Infinity;
    for (let c = c0; c < c1; c++) {
      const t = colSum(c, r0, r1 - 1, r1);
      if (t >= 0) top = Math.min(top, t);
    }
    for (let r = r0; r < r1; r++) {
      const f = rowSum(r, c0, c1 - 1, c1);
      if (f >= 0) first = Math.min(first, f);
    }
    if (top !== Infinity && first !== Infinity) out.push({ row: r1, col: c1, f: call({ r0: top, c0: first, r1: r1 - 1, c1: c1 - 1 }) });
  } else if (lastRowFree) {
    for (let c = c0; c <= c1; c++) colSum(c, r0, r1 - 1, r1);
  } else if (lastColFree) {
    for (let r = r0; r <= r1; r++) rowSum(r, c0, c1 - 1, c1);
  } else {
    let r = r1 + 1;
    while (r < MAX_ROWS - 1 && !rowFree(r, c0, c1)) r++;
    for (let c = c0; c <= c1; c++) colSum(c, r0, r1, r);
  }
  return out;
}

/** Excel's AutoSum (Alt+=): =SUMME(…) (or another function) of the numbers above/left of the selection, or below/right of a selected range. */
export function autoSum(store: SheetStore, fn?: "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN" | "STDEV.S"): void {
  const which: SumFn = fn ?? "SUM";
  let s = store.get();
  if (s.readOnly) return;
  const t = sheetChromeText[s.locale];
  const info = FUNCTION_BY_EN.get(which);
  const local = info ? (s.locale === "de" ? info.de : info.en) : which;
  if (s.edit) {
    // Typing a formula: the function goes in at the caret, like picking it from the list.
    if (s.edit.text.startsWith("=")) {
      const next = insertFunctionCall(s.edit.text, s.edit.caret, local, s.locale);
      store.updateEdit(next.text, next.caret);
      return;
    }
    if (!store.commitEdit(null)) return;
    s = store.get();
  }
  const sheet = sheetById(s.workbook, s.sheetId);
  if (!sheet) return;
  const area = activeArea(s.selection);
  if (area.r0 === area.r1 && area.c0 === area.c1) {
    // One cell: the proposal opens in the cell, like Excel. Enter takes it; clicking or dragging
    // over other cells replaces the range first (the caret sits right after it).
    const at = s.selection.anchor;
    const range = autoSumRange(sheet, s.calc, s.sheetId, at);
    const text = `=${local}(${range ? areaName(range) : ""})`;
    store.startEdit({ via: "cell", replace: true, text, at });
    store.updateEdit(text, text.length - 1);
    return;
  }
  const cells = autoSumCells(sheet, s.calc, s.sheetId, area, which);
  if (!cells.length) {
    showSheetNotice(store, t.noNumbers);
    return;
  }
  const sheetId = s.sheetId;
  // Each formula as if typed into its cell, keeping its look and note: =SUMME of run times shows
  // 49:15 (see formulaFormat).
  const typed = cells.map((c) => {
    const { current, place } = typingAt(s, sheetId, c);
    const fmt = formulaFormat(c.f, place);
    return { row: c.row, col: c.col, cell: typedCell(current, fmt ? { cell: { f: c.f }, fmt } : { cell: { f: c.f } }) };
  });
  store.apply(t.steps.autoSum, (wb) => setCells(wb, sheetId, typed));
}

// ----------------------------------------------------------------------------------------------
// Sorting

/** Whole columns (rows) cut down to the rows (columns) with data; null when there is none. */
function clipToData(sheet: Sheet, a: Area): Area | null {
  const wholeCols = a.r0 === 0 && a.r1 >= sheet.size.rows - 1;
  const wholeRows = a.c0 === 0 && a.c1 >= sheet.size.cols - 1;
  if (!wholeCols && !wholeRows) return a;
  let lo = Infinity;
  let hi = -1;
  for (const key in sheet.cells) {
    if (!filled(sheet.cells[key])) continue;
    const p = parseKey(key);
    if (p.row < a.r0 || p.row > a.r1 || p.col < a.c0 || p.col > a.c1) continue;
    const i = wholeCols ? p.row : p.col;
    lo = Math.min(lo, i);
    hi = Math.max(hi, i);
  }
  if (hi < 0) return null;
  return wholeCols ? { ...a, r0: lo, r1: hi } : { ...a, c0: lo, c1: hi };
}

/**
 * Is the first row of the area a header? Its filled cells are text, and below at least one of them
 * is something else (a number, a date, true/false) or the header is bold and the row below isn't.
 */
export function hasHeaderRow(sheet: Sheet, calc: Calc, sheetId: string, a: Area): boolean {
  if (a.r1 <= a.r0) return false;
  let texts = 0;
  let differs = false;
  for (let c = a.c0; c <= a.c1; c++) {
    const top = calc.value(sheetId, a.r0, c);
    if (top === null || top === "") continue;
    if (typeof top !== "string") return false;
    texts++;
    const below = calc.value(sheetId, a.r0 + 1, c);
    if (below !== null && below !== "" && typeof below !== "string") differs = true;
    if (sheet.cells[cellKey(a.r0, c)]?.s?.bold && !sheet.cells[cellKey(a.r0 + 1, c)]?.s?.bold) differs = true;
  }
  return texts > 0 && differs;
}

/**
 * What sorting the selection sorts: the selected rows, or the block of data around the active
 * cell, without a header row on top; sorted by the active cell's column. A single selected column
 * inside a bigger block takes the whole block along (`widened`), so rows never fall apart (Excel
 * asks; this is its default answer). So do several selected areas: they can't each be sorted on
 * their own (Excel refuses), so the block around the active cell is, as for one cell. null: fewer
 * than two rows to sort.
 */
export function sortPlan(sheet: Sheet, calc: Calc, sheetId: string, sel: Selection): { area: Area; col: number; header: boolean; widened: boolean } | null {
  const at = sel.anchor;
  const areas = selectionAreas(sel);
  let area: Area | null = activeArea(sel);
  let widened = false;
  if (areas.length > 1) {
    area = currentRegion(sheet, at);
    for (let c = area.c0; c <= area.c1 && !widened; c++) widened = !areas.some((a) => a.c0 <= c && c <= a.c1);
  } else if (area.r0 === area.r1 && area.c0 === area.c1) area = currentRegion(sheet, at);
  else {
    area = clipToData(sheet, area);
    if (!area) return null;
    if (area.c0 === area.c1) {
      const region = currentRegion(sheet, { row: Math.max(area.r0, Math.min(area.r1, at.row)), col: area.c0 });
      if (region.c0 < area.c0 || region.c1 > area.c1) {
        area = region;
        widened = true;
      }
    }
  }
  const header = hasHeaderRow(sheet, calc, sheetId, area);
  const body = header ? { ...area, r0: area.r0 + 1 } : area;
  if (body.r1 <= body.r0) return null;
  const col = at.col >= body.c0 && at.col <= body.c1 ? at.col : body.c0;
  return { area: body, col, header, widened };
}

/** Sort the selection's rows (or the block of data around the active cell, keeping a header row on top). */
export function sortSelection(store: SheetStore, dir: "asc" | "desc"): void {
  let s = store.get();
  if (s.readOnly) return;
  if (s.edit) {
    if (!store.commitEdit(null)) return;
    s = store.get();
  }
  const t = sheetChromeText[s.locale];
  const sheet = sheetById(s.workbook, s.sheetId);
  if (!sheet) return;
  const at = s.selection.anchor;
  // In a smart table the table sorts itself (header and totals stay, the arrow shows in its header).
  const table = tableAt(s.workbook, s.sheetId, at.row, at.col);
  if (table) {
    const column = table.columns[at.col - table.area.c0];
    if (column) {
      sortTableColumn(store, table.id, column.id, dir);
      return;
    }
  }
  const plan = sortPlan(sheet, s.calc, s.sheetId, s.selection);
  if (!plan) {
    showSheetNotice(store, t.nothingToSort);
    return;
  }
  const { sheetId, locale } = s;
  const before = store.get().workbook;
  store.apply(t.steps.sort, (wb, calc) => sortArea(wb, calc, sheetId, plan.area, [{ col: plan.col, dir }], locale));
  if (plan.widened && store.get().workbook !== before) showSheetNotice(store, t.sortedWithNeighbours);
}

// ----------------------------------------------------------------------------------------------
// Freezing rows and columns

/** Keep the top row, the first column, everything above and left of the active cell, or nothing in place while scrolling. */
export function freezePanes(store: SheetStore, how: FreezeHow): void {
  const s = store.get();
  if (s.readOnly) return;
  const sheet = sheetById(s.workbook, s.sheetId);
  if (!sheet) return;
  const t = sheetChromeText[s.locale];
  let rows = 0;
  let cols = 0;
  if (how === "row") rows = 1;
  else if (how === "col") cols = 1;
  else if (how === "here") {
    const a = activeArea(s.selection);
    const wholeCols = a.r0 === 0 && a.r1 >= sheet.size.rows - 1;
    const wholeRows = a.c0 === 0 && a.c1 >= sheet.size.cols - 1;
    rows = wholeCols ? 0 : wholeRows ? a.r0 : s.selection.anchor.row;
    cols = wholeRows ? 0 : wholeCols ? a.c0 : s.selection.anchor.col;
    if (!rows && !cols) {
      showSheetNotice(store, t.freezeNothing);
      return;
    }
  }
  const sheetId = s.sheetId;
  store.apply(t.steps.freeze, (wb) => setFreeze(wb, sheetId, rows, cols));
}

// ----------------------------------------------------------------------------------------------
// Functions picked from the function browser

/**
 * Put a function (by its English name) into the formula being typed at the caret, or start a new
 * formula in the active cell ("=MITTELWERT("), in the formula bar or the cell (default: where the
 * running edit is, else the formula bar).
 */
export function insertFunction(store: SheetStore, en: string, via?: "bar" | "cell"): void {
  const s = store.get();
  if (s.readOnly) return;
  const info = FUNCTION_BY_EN.get(en);
  const name = info ? (s.locale === "de" ? info.de : info.en) : en;
  const e = s.edit;
  if (e && e.text.startsWith("=")) {
    const next = insertFunctionCall(e.text, e.caret, name, s.locale);
    if (via && e.via !== via) store.startEdit({ via, replace: e.replace });
    store.updateEdit(next.text, next.caret);
    return;
  }
  const next = insertFunctionCall("", 0, name, s.locale);
  store.startEdit({ via: via ?? e?.via ?? "bar", replace: true, text: next.text });
  store.updateEdit(next.text, next.caret);
}
