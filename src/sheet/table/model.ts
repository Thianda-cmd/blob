// Smart tables ("intelligente Tabellen", Excel's "Als Tabelle formatieren"): a range with a header
// row that sorts, filters, adds a totals row, grows when you type right below or beside it (and
// the formulas and charts over its data rows grow with it, like Excel's structured references),
// and fills a formula typed into one of its columns down the whole column.
//
// CONTRACT: pure functions on a Workbook; keep names and signatures, add more if needed.
//
// The table's look (header colour, banding, totals line) is not written into the cells: the grid
// draws it from the TableSpec (src/components/sheet/table/useTableDecor.ts), so changing the colour
// or turning banding off touches no cell. Filters hide rows by their values every time the sheet is
// calculated (filteredRows); nothing is stored in the rows themselves.

import { isLocale, type Locale } from "@/i18n/config";
import { cellKey, inArea, normArea, overlaps, parseKey } from "../a1";
import { createCalc, isDuration, shiftFormula, typedFormat, type Calc, type CellValue } from "../engine";
import { formulaFormat, inTypedHours, worksOnRanges, type FormulaSources } from "../engine/input";
import { clearAreas, copyArea, growTableReferences, insertRows, newId, pasteClip, putTable, removeTable, setCells, setStyle, sheetById, sortArea } from "../ops";
import { MAX_COLS, MAX_ROWS, type Area, type Cell, type CellStyle, type FilterSpec, type NumberFormat, type Sheet, type TableColumn, type TableSpec, type TableStyle, type TotalFn, type Workbook } from "../types";
import { columnPattern, genericColumnName, headerGaps } from "./columns";
import { hiddenByFilters, shownText } from "./filter";
import { cleanTableName, freeTableName, validTableName } from "./names";
import { dataRows, isCountTotal, refreshTotals, totalFormula } from "./totals";

export { dataRows, refreshTotals, totalFormula, TOTAL_FNS, TOTAL_CODES, totalOfCell, parseTotalFormula } from "./totals";
export { genericColumnName, columnPattern } from "./columns";
export { cleanTableName, validTableName } from "./names";
export { columnKind, columnValues, columnAverage, shownText, valueKey, type ColumnKind, type ColumnValue } from "./filter";

/** The colours a table can have, in the order the panel shows them. */
export const TABLE_STYLES: TableStyle[] = ["purple", "blue", "green", "orange", "teal", "gray"];

type Update = { row: number; col: number; cell: Cell | null };

/** A value or a formula (a cell with only a look or a note counts as empty). */
const hasContent = (c: Cell | undefined): boolean => !!c && (c.v !== undefined || c.f !== undefined);

export const tableById = (wb: Workbook, id: string): TableSpec | undefined => wb.tables.find((t) => t.id === id);

/** The smart table a cell belongs to (header, data or totals row). */
export function tableAt(wb: Workbook, sheetId: string, row: number, col: number): TableSpec | undefined {
  return wb.tables.find((t) => t.sheetId === sheetId && inArea(t.area, row, col));
}

/** The language a Calc was made for (the store passes it); German when it can't tell. */
function calcLocale(calc: Calc): Locale {
  const l = (calc as unknown as { locale?: unknown }).locale;
  return isLocale(l) ? l : "de";
}

/** setCells, but the same workbook when every update leaves its cell as it was (no empty undo steps). */
function writeCells(wb: Workbook, sheetId: string, updates: Update[]): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const real = updates.filter((u) => JSON.stringify(sheet.cells[cellKey(u.row, u.col)] ?? null) !== JSON.stringify(u.cell === null || !Object.keys(clean(u.cell)).length ? null : clean(u.cell)));
  return real.length ? setCells(wb, sheetId, real) : wb;
}

/** A cell without undefined keys (to compare it with what is stored). */
function clean(c: Cell): Cell {
  const out: Cell = {};
  if (c.v !== undefined) out.v = c.v;
  if (c.f !== undefined) out.f = c.f;
  if (c.s) {
    const s = Object.fromEntries(Object.entries(c.s).filter(([, v]) => v !== undefined)) as CellStyle;
    if (Object.keys(s).length) out.s = s;
  }
  if (c.note) out.note = c.note;
  return out;
}

/** The sheet's grid made at least big enough for an area (a table at the very bottom keeps its empty last row). */
function ensureSize(wb: Workbook, sheetId: string, a: Area): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const rows = Math.min(MAX_ROWS, Math.max(sheet.size.rows, a.r1 + 1));
  const cols = Math.min(MAX_COLS, Math.max(sheet.size.cols, a.c1 + 1));
  if (rows === sheet.size.rows && cols === sheet.size.cols) return wb;
  return { ...wb, sheets: wb.sheets.map((s) => (s.id === sheetId ? { ...s, size: { rows, cols } } : s)) };
}

// ----------------------------------------------------------------------------------------------
// Finding the data: the block of filled cells around a cell (Excel's "current region")

/** Sorted filled rows per column and filled columns per row: "is anything in this stretch?" in log time. */
class ContentIndex {
  private byCol = new Map<number, number[]>();
  private byRow = new Map<number, number[]>();

  constructor(sheet: Sheet, skip: Area[] = []) {
    for (const key in sheet.cells) {
      if (!hasContent(sheet.cells[key])) continue;
      const p = parseKey(key);
      // Cells of other tables don't belong to the block (two tables can sit right next to each other).
      if (skip.some((a) => inArea(a, p.row, p.col))) continue;
      push(this.byCol, p.col, p.row);
      push(this.byRow, p.row, p.col);
    }
    for (const list of this.byCol.values()) list.sort((a, b) => a - b);
    for (const list of this.byRow.values()) list.sort((a, b) => a - b);
  }

  rowHas(row: number, c0: number, c1: number): boolean {
    return anyIn(this.byRow.get(row), c0, c1);
  }

  colHas(col: number, r0: number, r1: number): boolean {
    return anyIn(this.byCol.get(col), r0, r1);
  }
}

function push(map: Map<number, number[]>, k: number, v: number) {
  const list = map.get(k);
  if (list) list.push(v);
  else map.set(k, [v]);
}

/** Does a sorted list hold a number between lo and hi? */
function anyIn(sorted: number[] | undefined, lo: number, hi: number): boolean {
  if (!sorted || lo > hi) return false;
  let a = 0;
  let b = sorted.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (sorted[m] < lo) a = m + 1;
    else b = m;
  }
  return a < sorted.length && sorted[a] <= hi;
}

/**
 * The block of filled cells around a cell, like Excel's current region (Ctrl+A, Ctrl+T): the
 * rectangle grows while a filled cell touches it, diagonally too. Cells of `skip` areas don't count.
 */
export function currentRegion(sheet: Sheet, row: number, col: number, skip: Area[] = []): Area {
  return regionIn(new ContentIndex(sheet, skip), row, col);
}

function regionIn(index: ContentIndex, row: number, col: number): Area {
  let r0 = row;
  let r1 = row;
  let c0 = col;
  let c1 = col;
  for (;;) {
    let grew = false;
    while (r1 < MAX_ROWS - 1 && index.rowHas(r1 + 1, c0 - 1, c1 + 1)) {
      r1++;
      grew = true;
    }
    while (r0 > 0 && index.rowHas(r0 - 1, c0 - 1, c1 + 1)) {
      r0--;
      grew = true;
    }
    while (c1 < MAX_COLS - 1 && index.colHas(c1 + 1, r0 - 1, r1 + 1)) {
      c1++;
      grew = true;
    }
    while (c0 > 0 && index.colHas(c0 - 1, r0 - 1, r1 + 1)) {
      c0--;
      grew = true;
    }
    if (!grew) return { r0, c0, r1, c1 };
  }
}

/** The smallest area inside `a` that holds every filled cell of it; null when nothing is there. */
function usedArea(sheet: Sheet, a: Area): Area | null {
  let r0 = Infinity;
  let r1 = -Infinity;
  let c0 = Infinity;
  let c1 = -Infinity;
  const visit = (row: number, col: number, cell: Cell | undefined) => {
    if (!hasContent(cell) || !inArea(a, row, col)) return;
    r0 = Math.min(r0, row);
    r1 = Math.max(r1, row);
    c0 = Math.min(c0, col);
    c1 = Math.max(c1, col);
  };
  const size = (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);
  const keys = Object.keys(sheet.cells);
  if (size > keys.length) {
    for (const key of keys) {
      const p = parseKey(key);
      visit(p.row, p.col, sheet.cells[key]);
    }
  } else {
    for (let r = a.r0; r <= a.r1; r++) for (let c = a.c0; c <= a.c1; c++) visit(r, c, sheet.cells[cellKey(r, c)]);
  }
  return r0 === Infinity ? null : { r0, c0, r1, c1 };
}

const rowEmpty = (sheet: Sheet, row: number, c0: number, c1: number) => {
  for (let c = c0; c <= c1; c++) if (hasContent(sheet.cells[cellKey(row, c)])) return false;
  return true;
};

// ----------------------------------------------------------------------------------------------
// Making a table

/**
 * Does the first row look like a header? Its filled cells are all typed text, and below it the
 * values differ in kind (numbers, dates, true/false or errors under text), or the header looks
 * different (bold or coloured). A list of nothing but text without formatting counts as data,
 * like in Excel; the panel offers to change that right after.
 */
function looksLikeHeader(calc: Calc, sheet: Sheet, a: Area): boolean {
  let texts = 0;
  for (let c = a.c0; c <= a.c1; c++) {
    const cell = sheet.cells[cellKey(a.r0, c)];
    if (!cell || !hasContent(cell)) continue;
    if (cell.f !== undefined || typeof cell.v !== "string") return false;
    texts++;
  }
  if (!texts) return false;
  // Only a row of names: the header of a table still to be filled in.
  if (a.r1 === a.r0) return true;
  const last = Math.min(a.r1, a.r0 + 50);
  for (let c = a.c0; c <= a.c1; c++) {
    for (let r = a.r0 + 1; r <= last; r++) {
      if (!hasContent(sheet.cells[cellKey(r, c)])) continue;
      const v = calc.value(sheet.id, r, c);
      if (v !== null && typeof v !== "string") return true;
    }
  }
  for (let c = a.c0; c <= a.c1; c++) {
    const h = sheet.cells[cellKey(a.r0, c)]?.s;
    const d = sheet.cells[cellKey(a.r0 + 1, c)]?.s;
    if ((h?.bold && !d?.bold) || (h?.fill && h.fill !== d?.fill)) return true;
  }
  return false;
}

/**
 * Make row `row` free in columns c0…c1 by moving what is there one row down: a whole new sheet
 * row (formulas, charts and tables follow), or, when that would cut through a table beside this
 * one, only these columns. The same workbook when the row is free already; null when there is no
 * room left at the bottom of the sheet.
 */
function makeRoom(wb: Workbook, calc: Calc, sheetId: string, row: number, c0: number, c1: number): Workbook | null {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || row >= MAX_ROWS) return null;
  const band: Area = { r0: row, r1: row, c0, c1 };
  const tables = wb.tables.filter((t) => t.sheetId === sheetId);
  if (rowEmpty(sheet, row, c0, c1) && !tables.some((t) => overlaps(t.area, band))) return wb;
  const cuts = tables.some((t) => t.area.r0 < row && t.area.r1 >= row && (t.area.c1 < c0 || t.area.c0 > c1));
  if (!cuts) {
    const next = insertRows(wb, sheetId, row, 1);
    return next === wb ? null : next;
  }
  let last = row;
  for (const key in sheet.cells) {
    const p = parseKey(key);
    if (p.row > last && p.col >= c0 && p.col <= c1) last = p.row;
  }
  if (last + 1 >= MAX_ROWS) return null;
  const clip = copyArea(wb, sheetId, { r0: row, c0, r1: last, c1 });
  return pasteClip(wb, calc, sheetId, { r0: row + 1, c0, r1: last + 1, c1 }, clip, { mode: "all", cut: true });
}

export type MakeTableOptions = {
  style?: TableStyle;
  /** "auto" guesses (see makeTable); "yes": the first row is the header; "no": a header row is added. */
  header?: "auto" | "yes" | "no";
  /** A wished name ("Kalibrierung"), made unique; invalid names fall back to "Tabelle1". */
  name?: string;
};

export type MadeTable = {
  wb: Workbook;
  tableId: string;
  /** Was the first row taken as the header, or was a header row added? */
  header: "found" | "added";
  /** True when cells moved down to make room for an added header row. */
  moved: boolean;
  /** The table's area. */
  area: Area;
};

/**
 * Turn an area into a smart table. When its first row looks like a header (text above numbers)
 * it becomes the header; otherwise a header row is inserted above with "Spalte1", "Spalte2"…
 * ("Column1" in English). A single cell grows to the block of filled cells around it, like Excel.
 */
export function makeTable(wb: Workbook, calc: Calc, sheetId: string, area: Area, locale: Locale, style?: TableStyle): { wb: Workbook; tableId: string } | { error: "overlap" | "empty" } {
  const r = makeTableWith(wb, calc, sheetId, area, locale, { style });
  return "error" in r ? r : { wb: r.wb, tableId: r.tableId };
}

/** makeTable with more to say: whether the first row is the header, a name. */
export function makeTableWith(wb: Workbook, calc: Calc, sheetId: string, area: Area, locale: Locale, opts: MakeTableOptions = {}): MadeTable | { error: "overlap" | "empty" } {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return { error: "empty" };
  const others = wb.tables.filter((t) => t.sheetId === sheetId);
  const n = normArea(area);
  let a: Area = { r0: Math.max(0, n.r0), c0: Math.max(0, n.c0), r1: Math.min(MAX_ROWS - 1, n.r1), c1: Math.min(MAX_COLS - 1, n.c1) };
  if (a.r0 > a.r1 || a.c0 > a.c1) return { error: "empty" };

  if (a.r0 === a.r1 && a.c0 === a.c1) {
    if (others.some((t) => inArea(t.area, a.r0, a.c0))) return { error: "overlap" };
    a = currentRegion(sheet, a.r0, a.c0, others.map((t) => t.area));
  } else {
    // Whole columns or rows: only the part with data (not 20 000 empty rows).
    const wholeCols = a.r0 === 0 && a.r1 >= sheet.size.rows - 1;
    const wholeRows = a.c0 === 0 && a.c1 >= sheet.size.cols - 1;
    if (wholeCols || wholeRows) {
      const used = usedArea(sheet, a);
      if (!used) return { error: "empty" };
      a = { r0: wholeCols ? used.r0 : a.r0, r1: wholeCols ? used.r1 : a.r1, c0: wholeRows ? used.c0 : a.c0, c1: wholeRows ? used.c1 : a.c1 };
    }
  }
  if (!usedArea(sheet, a)) return { error: "empty" };
  if (others.some((t) => overlaps(t.area, a))) return { error: "overlap" };

  let header = opts.header === "yes" ? true : opts.header === "no" ? false : looksLikeHeader(calc, sheet, a);
  let next = wb;
  let moved = false;
  if (header) {
    if (a.r1 === a.r0) {
      // Only the names: one empty row below to type into.
      if (a.r1 + 1 >= MAX_ROWS) return { error: "empty" };
      a = { ...a, r1: a.r1 + 1 };
      if (others.some((t) => overlaps(t.area, a))) return { error: "overlap" };
    }
  } else if (!rowEmpty(sheet, a.r0, a.c0, a.c1)) {
    // (An empty first row of the selection simply becomes the header row.)
    const above: Area = { r0: a.r0 - 1, r1: a.r0 - 1, c0: a.c0, c1: a.c1 };
    if (a.r0 > 0 && rowEmpty(sheet, a.r0 - 1, a.c0, a.c1) && !others.some((t) => overlaps(t.area, above))) {
      // The empty row right above takes the header: nothing has to move.
      a = { ...a, r0: a.r0 - 1 };
    } else {
      const room = makeRoom(next, calc, sheetId, a.r0, a.c0, a.c1);
      if (room) {
        next = room;
        moved = true;
        a = { ...a, r1: a.r1 + 1 };
      } else header = true; // no room left at the bottom of the sheet: the first row has to do
    }
  }
  const sheetNow = sheetById(next, sheetId)!;
  next = writeCells(next, sheetId, headerGaps(sheetNow, a, locale));
  next = ensureSize(next, sheetId, a);

  const tableId = newId();
  const table: TableSpec = {
    id: tableId,
    sheetId,
    name: uniqueTableName(next, locale, opts.name),
    area: a,
    columns: Array.from({ length: a.c1 - a.c0 + 1 }, () => ({ id: newId(), total: "none" as const })),
    totals: false,
    style: opts.style && TABLE_STYLES.includes(opts.style) ? opts.style : "purple",
    banded: true,
    filters: {},
    sort: null,
  };
  return { wb: putTable(next, table), tableId, header: header ? "found" : "added", moved, area: a };
}

// ----------------------------------------------------------------------------------------------
// Filters and sorting

/** Rows of a sheet hidden by its tables' filters. Pure; callers memoise per Calc. */
export function filteredRows(wb: Workbook, calc: Calc, sheetId: string, locale: Locale): Set<number> {
  const out = new Set<number>();
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return out;
  for (const t of wb.tables) {
    if (t.sheetId !== sheetId || !Object.keys(t.filters).length) continue;
    hiddenByFilters(calc, sheet, t, locale, out);
  }
  return out;
}

const sameFilter = (a: FilterSpec, b: FilterSpec) => JSON.stringify(a) === JSON.stringify(b);

export function setTableFilter(wb: Workbook, tableId: string, columnId: string, filter: FilterSpec | null): Workbook {
  const t = tableById(wb, tableId);
  if (!t || !t.columns.some((c) => c.id === columnId)) return wb;
  const current = t.filters[columnId];
  if (!filter) {
    if (!current) return wb;
    const filters = { ...t.filters };
    delete filters[columnId];
    return putTable(wb, { ...t, filters });
  }
  if (current && sameFilter(current, filter)) return wb;
  return putTable(wb, { ...t, filters: { ...t.filters, [columnId]: filter } });
}

/** Every filter of a table off. */
export function clearTableFilters(wb: Workbook, tableId: string): Workbook {
  const t = tableById(wb, tableId);
  if (!t || !Object.keys(t.filters).length) return wb;
  return putTable(wb, { ...t, filters: {} });
}

/** Sort the data rows (never the header or totals row) by one column. */
export function sortTable(wb: Workbook, calc: Calc, tableId: string, columnId: string, dir: "asc" | "desc", locale: Locale): Workbook {
  const t = tableById(wb, tableId);
  if (!t) return wb;
  const i = t.columns.findIndex((c) => c.id === columnId);
  if (i < 0) return wb;
  const d = dataRows(t);
  const sorted = d.r1 > d.r0 ? sortArea(wb, calc, t.sheetId, { r0: d.r0, c0: t.area.c0, r1: d.r1, c1: t.area.c1 }, [{ col: t.area.c0 + i, dir }], locale) : wb;
  const t2 = tableById(sorted, tableId) ?? t;
  if (sorted === wb && t2.sort?.column === columnId && t2.sort.dir === dir) return wb;
  return putTable(sorted, { ...t2, sort: { column: columnId, dir } });
}

// ----------------------------------------------------------------------------------------------
// The totals row

/**
 * Two number formats alike, whatever order their keys come in: a format loaded back from the
 * database has jsonb's order ({kind, unit, decimals}), one made in this session the code's.
 */
function sameFormat(a: NumberFormat | undefined, b: NumberFormat | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const k in x) if (x[k] !== y[k]) return false;
  for (const k in y) if (!(k in x) && y[k] !== undefined) return false;
  return true;
}

/** A clock time's format as a duration (36:00 past a day, not 12:00); undefined for any other format. */
const durationOf = (fmt: NumberFormat): NumberFormat | undefined => (fmt.kind === "time" && !isDuration(fmt) ? { kind: "time", seconds: fmt.seconds, duration: true } : undefined);

/** A time format and the other way to read it, as a clock time or a duration (the same seconds): what a time column's total switches between. */
const sameTime = (a: NumberFormat, b: NumberFormat) => a.kind === "time" && b.kind === "time" && a.seconds === b.seconds;

/** What a cell of the table's sheet holds: its formula's result (asked only for formulas, when needed). */
type ValueAt = (row: number, col: number) => CellValue;

/** A column's number format, and whether it shows moments: timestamps shown as their clock time (an instrument's log). */
type ColumnFormat = { fmt: NumberFormat; moment: boolean };

/**
 * A column's number format: its last data cell's that has one (of the last 50 rows). Among clock
 * times a duration decides, as when formulas sum them up (src/sheet/engine/input.ts join): times
 * typed down a growth curve, 0:00, 12:00, 24:00, 36:00, 18:00, are durations (Max 36:00, not the
 * clock time 12:00), and so is a clock time of a day or more.
 */
function dataFormat(sheet: Sheet, t: TableSpec, col: number, value: ValueAt): ColumnFormat | undefined {
  const d = dataRows(t);
  const top = Math.max(d.r0, d.r1 - 49);
  // A time cell's format, and for a clock time its value (a duration needs none), which tells a
  // moment or a day or more apart.
  const timeAt = (r: number) => {
    const c = sheet.cells[cellKey(r, col)];
    if (c?.s?.fmt?.kind !== "time") return undefined;
    const fmt = c.s.fmt;
    return { fmt, v: isDuration(fmt) ? undefined : c.f === undefined ? c.v : value(r, col) };
  };
  for (let r = d.r1; r >= top; r--) {
    const fmt = sheet.cells[cellKey(r, col)]?.s?.fmt;
    if (!fmt || fmt.kind === "text") continue;
    const time = timeAt(r);
    if (!time || isDuration(fmt)) return { fmt, moment: false };
    if (typeof time.v === "number" && !inTypedHours(time.v)) return { fmt, moment: true };
    for (let q = r; q >= top; q--) {
      const o = timeAt(q);
      if (o && (isDuration(o.fmt) || (typeof o.v === "number" && o.v >= 1 && inTypedHours(o.v)))) return { fmt: durationOf(fmt) ?? fmt, moment: false };
    }
    return { fmt, moment: false };
  }
  return undefined;
}

/**
 * The format a total shows its result in: the column's (a sum of milligrams is milligrams), but a
 * sum or mean of clock times is how long they took, a duration (08:30 + 07:45 + 09:15 is 25:30,
 * not the time 01:30), as AutoSum and the status bar show it; moments stay moments (the mean of an
 * instrument's timestamps is one too). A count is a plain number.
 */
function totalFormat(fn: TotalFn, column: ColumnFormat | undefined): NumberFormat | undefined {
  if (!column || isCountTotal(fn)) return undefined;
  if ((fn === "sum" || fn === "average") && !column.moment) return durationOf(column.fmt) ?? column.fmt;
  return column.fmt;
}

/** The cell of one column in the totals row: its SUBTOTAL, the label (first column without a function) or nothing. */
function totalsCell(sheet: Sheet, t: TableSpec, i: number, locale: Locale | undefined, value: ValueAt): Update {
  const col = t.area.c0 + i;
  const row = t.area.r1;
  const cell = sheet.cells[cellKey(row, col)];
  const fn = t.columns[i].total;
  const d = dataRows(t);
  const f = totalFormula(fn, col, d.r0, d.r1);
  let s = cell?.s;
  if (f) {
    // The format follows the function while it is one a total gave (the column's, as a clock time
    // or a duration): Max then Summe shows 25:30, Summe then Anzahl a plain 3. One picked by hand stays.
    const column = dataFormat(sheet, t, col, value);
    const had = s?.fmt;
    if (!had || (column && (sameFormat(had, column.fmt) || sameTime(had, column.fmt)))) {
      const fmt = totalFormat(fn, column);
      if (!sameFormat(had, fmt)) s = { ...s, fmt };
    }
    return { row, col, cell: { ...cell, v: undefined, f, s } };
  }
  if (i === 0 && locale) return { row, col, cell: { ...cell, v: locale === "de" ? "Ergebnis" : "Total", f: undefined } };
  return { row, col, cell: cell ? { ...cell, v: undefined, f: undefined } : null };
}

/** Add or remove the totals row (a new row below; the last column gets a sum or count first). */
export function setTotals(wb: Workbook, calc: Calc, tableId: string, on: boolean, locale: Locale): Workbook {
  const t = tableById(wb, tableId);
  if (!t || t.totals === on) return wb;
  if (!on) {
    const row = t.area.r1;
    // A table keeps at least its header; the row goes, the functions are remembered for next time.
    const cleared = clearAreas(wb, t.sheetId, [{ r0: row, c0: t.area.c0, r1: row, c1: t.area.c1 }], "all");
    return putTable(cleared, { ...t, totals: false, area: { ...t.area, r1: Math.max(t.area.r0, row - 1) } });
  }
  const row = t.area.r1 + 1;
  const room = makeRoom(wb, calc, t.sheetId, row, t.area.c0, t.area.c1);
  if (!room) return wb;
  const t1 = tableById(room, tableId) ?? t;
  let columns: TableColumn[] = t1.columns;
  if (!columns.some((c) => c.total !== "none")) {
    // Excel's start: a sum under the last column with numbers, else a count under the last column.
    const d = dataRows(t1);
    let pick = -1;
    for (let i = columns.length - 1; i >= 0 && pick < 0; i--) {
      for (let r = d.r0; r <= d.r1; r++) {
        if (typeof calc.value(t1.sheetId, r, t1.area.c0 + i) === "number") {
          pick = i;
          break;
        }
      }
    }
    // The first column keeps the label, unless the table has only one column.
    let fn: TotalFn = "sum";
    let at = pick;
    if (pick < 0 || (pick === 0 && columns.length > 1)) {
      fn = "count";
      at = columns.length - 1;
    }
    columns = columns.map((c, i) => (i === at ? { ...c, total: fn } : c));
  }
  const table: TableSpec = { ...t1, totals: true, area: { ...t1.area, r1: row }, columns };
  let next = putTable(ensureSize(room, t.sheetId, table.area), table);
  const sheet = sheetById(next, t.sheetId)!;
  // The data rows didn't move (the room is made below them): their values are calc's.
  const value = (r: number, c: number) => calc.value(t.sheetId, r, c);
  next = writeCells(
    next,
    t.sheetId,
    table.columns.map((_, i) => totalsCell(sheet, table, i, locale, value)),
  );
  return next;
}

/**
 * A column's function in the totals row, written as =SUBTOTAL(109; …) etc. into its cell.
 * `locale` (optional): with "none" the first column gets its label back ("Ergebnis"). `calc`
 * (optional): the workbook's values, for a column of formulas whose results decide the total's
 * format (a mean of timestamps made by formulas is a moment, not 1111908:45 hours); without it
 * they are worked out here.
 */
export function setColumnTotal(wb: Workbook, tableId: string, columnId: string, fn: TotalFn, locale?: Locale, calc?: Calc): Workbook {
  const t = tableById(wb, tableId);
  if (!t) return wb;
  const i = t.columns.findIndex((c) => c.id === columnId);
  if (i < 0) return wb;
  const table: TableSpec = t.columns[i].total === fn ? t : { ...t, columns: t.columns.map((c) => (c.id === columnId ? { ...c, total: fn } : c)) };
  let next = table === t ? wb : putTable(wb, table);
  if (!table.totals) return next;
  const sheet = sheetById(next, table.sheetId);
  if (!sheet) return next;
  let values = calc;
  const value = (r: number, c: number) => (values ??= createCalc(wb, { locale })).value(table.sheetId, r, c);
  next = writeCells(next, table.sheetId, [totalsCell(sheet, table, i, locale, value)]);
  return next;
}

// ----------------------------------------------------------------------------------------------
// Name and look (the rules for names are in ./names.ts, which ops.ts uses too)

/** Why a name can't be this table's name (null: it can). */
export function tableNameProblem(wb: Workbook, tableId: string, name: string): "empty" | "taken" | "invalid" | null {
  const n = cleanTableName(name);
  if (!n) return "empty";
  if (!validTableName(n)) return "invalid";
  if (wb.tables.some((t) => t.id !== tableId && t.name.toLowerCase() === n.toLowerCase())) return "taken";
  return null;
}

export function setTableLook(wb: Workbook, tableId: string, patch: Partial<Pick<TableSpec, "name" | "style" | "banded">>): Workbook {
  const t = tableById(wb, tableId);
  if (!t) return wb;
  let next = t;
  if (patch.name !== undefined) {
    const name = cleanTableName(patch.name);
    if (name !== t.name && tableNameProblem(wb, tableId, name) === null) next = { ...next, name };
  }
  if (patch.style !== undefined && patch.style !== t.style && TABLE_STYLES.includes(patch.style)) next = { ...next, style: patch.style };
  if (patch.banded !== undefined && patch.banded !== t.banded) next = { ...next, banded: patch.banded };
  return next === t ? wb : putTable(wb, next);
}

/** A name not used by another table ("Tabelle1", "Tabelle2"… / "Table1"…; a wished name, made unique). */
export function uniqueTableName(wb: Workbook, locale: Locale, base?: string): string {
  return freeTableName(wb.tables.map((t) => t.name), locale, base);
}

// ----------------------------------------------------------------------------------------------
// Ending a table

/**
 * Back to plain cells: the table goes, its cells (values, formulas, look) stay. Like Excel's
 * "Convert to range", the header keeps looking like one (bold, in the table's colour) and the
 * totals row stays bold; cells with a look of their own keep it.
 */
export function unmakeTable(wb: Workbook, tableId: string): Workbook {
  const t = tableById(wb, tableId);
  if (!t) return wb;
  const a = t.area;
  let next = setStyle(wb, t.sheetId, [{ r0: a.r0, c0: a.c0, r1: a.r0, c1: a.c1 }], (s) => ({ ...s, bold: s?.bold ?? true, fill: s?.fill ?? t.style }));
  if (t.totals && a.r1 > a.r0) next = setStyle(next, t.sheetId, [{ r0: a.r1, c0: a.c0, r1: a.r1, c1: a.c1 }], (s) => ({ ...s, bold: s?.bold ?? true }));
  return removeTable(next, tableId);
}

/** The table and everything in its cells gone ("Tabelle löschen"). */
export function deleteTable(wb: Workbook, tableId: string): Workbook {
  const t = tableById(wb, tableId);
  if (!t) return wb;
  return removeTable(clearAreas(wb, t.sheetId, [t.area], "all"), tableId);
}

// ----------------------------------------------------------------------------------------------
// Typing next to and into a table

/** A table that grows to include a cell typed right below it (no totals row) or right beside it. */
function growInto(wb: Workbook, sheetId: string, row: number, col: number): { table: TableSpec; dir: "row" | "col" } | null {
  const tables = wb.tables.filter((t) => t.sheetId === sheetId);
  const blocked = (self: TableSpec, a: Area) => tables.some((o) => o.id !== self.id && overlaps(o.area, a));
  for (const t of tables) {
    const a = t.area;
    if (!t.totals && row === a.r1 + 1 && col >= a.c0 && col <= a.c1) {
      if (blocked(t, { r0: row, r1: row, c0: a.c0, c1: a.c1 })) return null;
      return { table: { ...t, area: { ...a, r1: row } }, dir: "row" };
    }
  }
  for (const t of tables) {
    const a = t.area;
    if (col === a.c1 + 1 && row >= a.r0 && row <= a.r1 && col < MAX_COLS) {
      if (blocked(t, { r0: a.r0, r1: a.r1, c0: col, c1: col })) return null;
      return { table: { ...t, area: { ...a, c1: col }, columns: [...t.columns, { id: newId(), total: "none" }] }, dir: "col" };
    }
  }
  return null;
}

/**
 * New data rows `from`…`to` at the bottom of a (grown) table: calculated columns continue into
 * them and the columns' number formats carry on. `given` cells were typed or pasted: they keep
 * what they got (at most a missing number format is added).
 */
function continueRows(sheet: Sheet, t: TableSpec, from: number, to: number, given: (row: number, col: number) => boolean): Update[] {
  const d = dataRows(t);
  const last = from - 1;
  const out: Update[] = [];
  for (let col = t.area.c0; col <= t.area.c1; col++) {
    const pattern = last >= d.r0 ? columnPattern(sheet, col, d.r0, last) : null;
    // Decimals, units and dates carry on; percent and text formats would change what was typed
    // (5 → 500 %), so those don't.
    const fmt = last >= d.r0 ? sheet.cells[cellKey(last, col)]?.s?.fmt : undefined;
    const carry = fmt && fmt.kind !== "percent" && fmt.kind !== "text" ? fmt : undefined;
    if (!pattern && !carry) continue;
    for (let row = from; row <= to; row++) {
      const cell = sheet.cells[cellKey(row, col)];
      const typed = given(row, col);
      let next: Cell | undefined;
      if (pattern && !typed && !hasContent(cell)) next = { ...cell, f: shiftFormula(pattern.f, row - pattern.row, 0) };
      const base = next ?? cell;
      if (carry && !base?.s?.fmt && (hasContent(base) || !typed)) next = { ...base, s: { ...base?.s, fmt: carry } };
      if (next) out.push({ row, col, cell: next });
    }
  }
  return out;
}

/**
 * Excel's calculated column: a formula typed into a data cell fills the whole column (moved along
 * with each row) when the column's other cells are empty or hold one formula pattern themselves.
 * Values typed by hand are never overwritten.
 *
 * Each cell shows what the typed one shows: the format typing its formula there gives (=B3-A3 of
 * two times a duration, =(B3-A3)*24 none), and where that says nothing or only a clock time (a row
 * still empty, or with only its Start yet) the typed cell's, so times typed into it later show as a
 * duration too. A formula over ranges (=SUMME($B$2:B2), =B2-MIN(B:B)) gives every row the typed
 * cell's: looking through its ranges again for each of 5,000 rows would take seconds. A format the
 * column's old formula gave a cell goes with that formula, as when the cell itself is typed into
 * anew (src/components/sheet/store.ts typingBase), also in a cell emptied with Entf (which keeps
 * its look): =B2-A2 edited to =(B2-A2)*24 shows hours in every row, not 204:00. A format picked by
 * hand stays, and the typed cell's own spreads to the cells without one.
 */
function fillColumn(wb: Workbook, calc: Calc, sheet: Sheet, t: TableSpec, row: number, col: number): Update[] {
  const typed = sheet.cells[cellKey(row, col)];
  if (!typed || typed.f === undefined) return [];
  const d = dataRows(t);
  if (d.r1 <= d.r0) return [];
  let ref: { f: string; row: number } | null = null;
  for (let r = d.r0; r <= d.r1; r++) {
    if (r === row) continue;
    const c = sheet.cells[cellKey(r, col)];
    if (!c || !hasContent(c)) continue;
    if (c.f === undefined) return [];
    if (!ref) ref = { f: c.f, row: r };
    else if (shiftFormula(ref.f, r - ref.row, 0) !== c.f) return [];
  }
  const src: FormulaSources = { wb, sheetId: sheet.id, value: (id, r, c) => calc.value(id, r, c) };
  const implied = formulaFormat(typed.f, src);
  const each = !worksOnRanges(typed.f);
  // The old formula, with what it gives in the typed row (what the rows empty then took) and in its
  // own first row (what it gave, also when the typed row's cells have been emptied since).
  const old = ref && { ...ref, here: formulaFormat(shiftFormula(ref.f, row - ref.row, 0), src), first: formulaFormat(ref.f, src), each: !worksOnRanges(ref.f) };
  const oldGave = (fmt: NumberFormat) => !!old && (sameFormat(fmt, old.here) || sameFormat(fmt, old.first));
  /** Whether `had` is a format the old formula gave row r: what it gives there, in the typed row or in its first row, or as a fill puts them together. */
  const fromOld = (had: NumberFormat, r: number) => {
    if (!old) return false;
    if (oldGave(had)) return true;
    if (!old.each) return false;
    const there = formulaFormat(shiftFormula(old.f, r - old.row, 0), src);
    return sameFormat(had, there) || sameFormat(had, typedFormat(there, old.here));
  };
  // The typed cell's own format: one neither its formula nor the old one gave (picked by hand).
  const mine = typed.s?.fmt;
  const own = mine && !sameFormat(mine, implied) && !oldGave(mine) ? mine : undefined;
  const out: Update[] = [];
  for (let r = d.r0; r <= d.r1; r++) {
    if (r === row) continue;
    const f = shiftFormula(typed.f, r - row, 0);
    const c = sheet.cells[cellKey(r, col)];
    if (c?.f === f) continue;
    const had = c?.s?.fmt;
    const hand = had && !fromOld(had, r) ? had : undefined;
    const here = each ? typedFormat(formulaFormat(f, src), implied) : implied;
    const fmt = typedFormat(hand ?? own, here);
    out.push({ row: r, col, cell: { ...c, v: undefined, f, s: c?.s || fmt ? { ...c?.s, fmt } : undefined } });
  }
  return out;
}

/**
 * After typing into (row, col): a table directly above or to the left grows to include it (and
 * formulas and charts over its data rows grow with it, see ops.ts growTableReferences); a
 * formula typed into a table's data cell is filled down the column (Excel's calculated column).
 * Return wb unchanged when nothing applies. Called by the store's input().
 * (`locale`, optional: for the name of a new column; else the Calc's language.)
 */
export function afterInput(wb: Workbook, calc: Calc, sheetId: string, row: number, col: number, locale?: Locale): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || !wb.tables.length) return wb;
  const lang = locale ?? calcLocale(calc);
  const typed = sheet.cells[cellKey(row, col)];
  let next = wb;
  let t = tableAt(wb, sheetId, row, col);

  if (!t && hasContent(typed)) {
    const grown = growInto(wb, sheetId, row, col);
    if (grown) {
      t = grown.table;
      next = putTable(ensureSize(next, sheetId, t.area), t);
      if (grown.dir === "row") {
        // Formulas and charts over the data rows (=STEIGUNG(C6:C11;…)) take the new row in, like
        // Excel's structured references; then calculated columns continue into it.
        next = growTableReferences(next, t, { r0: t.area.r0 + 1, r1: row - 1 }, { r0: t.area.r0 + 1, r1: row });
        next = writeCells(next, sheetId, continueRows(sheetById(next, sheetId)!, t, row, row, (r, c) => r === row && c === col));
      } else next = writeCells(next, sheetId, headerGaps(sheet, t.area, lang).filter((u) => u.col === col));
    }
  }
  if (!t) return wb;

  const now = sheetById(next, sheetId)!;
  const d = dataRows(t);
  if (row === t.area.r0 && !hasContent(typed)) {
    // A header can't be empty (Excel puts "Spalte2" back): menus and charts need a name.
    next = writeCells(next, sheetId, headerGaps(now, t.area, lang).filter((u) => u.col === col));
  } else if (row >= d.r0 && row <= d.r1 && typed?.f !== undefined) {
    next = writeCells(next, sheetId, fillColumn(next, calc, now, t, row, col));
  }
  return refreshTotals(next, sheetId);
}

/**
 * After pasting or filling into `area`: a table the pasted rows continue below (it has no totals
 * row) grows down over them, a table they continue to the right of grows over the new columns,
 * like typing there (formulas and charts over the data rows take the new rows in, calculated
 * columns and number formats continue into them; new columns get a header name). Only rows and
 * columns with something in them count. The same
 * workbook when nothing applies. For the grid's paste and fill handle.
 */
export function afterPaste(wb: Workbook, calc: Calc, sheetId: string, area: Area, locale?: Locale): Workbook {
  if (!wb.tables.some((t) => t.sheetId === sheetId)) return wb;
  const a = normArea(area);
  const lang = locale ?? calcLocale(calc);
  const pasted = (row: number, col: number) => inArea(a, row, col);
  let next = wb;
  for (const first of wb.tables) {
    if (first.sheetId !== sheetId) continue;
    let t = tableById(next, first.id) ?? first;
    const blocked = (b: Area) => next.tables.some((o) => o.sheetId === sheetId && o.id !== t.id && overlaps(o.area, b));
    if (!t.totals && a.r1 > t.area.r1 && a.r0 <= t.area.r1 + 1 && a.c0 <= t.area.c1 && a.c1 >= t.area.c0) {
      const used = usedArea(sheetById(next, sheetId)!, { r0: t.area.r1 + 1, r1: a.r1, c0: t.area.c0, c1: t.area.c1 });
      if (used && !blocked({ r0: t.area.r1 + 1, r1: used.r1, c0: t.area.c0, c1: t.area.c1 })) {
        const grown: TableSpec = { ...t, area: { ...t.area, r1: used.r1 } };
        next = putTable(ensureSize(next, sheetId, grown.area), grown);
        next = growTableReferences(next, grown, { r0: t.area.r0 + 1, r1: t.area.r1 }, { r0: t.area.r0 + 1, r1: used.r1 });
        next = writeCells(next, sheetId, continueRows(sheetById(next, sheetId)!, grown, t.area.r1 + 1, used.r1, pasted));
        t = grown;
      }
    }
    if (a.c1 > t.area.c1 && a.c0 <= t.area.c1 + 1 && a.r0 <= t.area.r1 && a.r1 >= t.area.r0) {
      const used = usedArea(sheetById(next, sheetId)!, { r0: t.area.r0, r1: t.area.r1, c0: t.area.c1 + 1, c1: a.c1 });
      if (used && !blocked({ r0: t.area.r0, r1: t.area.r1, c0: t.area.c1 + 1, c1: used.c1 })) {
        const added = Array.from({ length: used.c1 - t.area.c1 }, () => ({ id: newId(), total: "none" as const }));
        const grown: TableSpec = { ...t, area: { ...t.area, c1: used.c1 }, columns: [...t.columns, ...added] };
        next = putTable(ensureSize(next, sheetId, grown.area), grown);
        next = writeCells(next, sheetId, headerGaps(sheetById(next, sheetId)!, grown.area, lang).filter((u) => u.col > t.area.c1));
      }
    }
  }
  return next === wb ? wb : refreshTotals(next, sheetId);
}

// ----------------------------------------------------------------------------------------------
// Reading

/** The header cell's text of each column (names used in charts and menus). */
export function columnNames(wb: Workbook, calc: Calc, table: TableSpec, locale: Locale): string[] {
  const sheet = sheetById(wb, table.sheetId);
  return table.columns.map((_, i) => {
    const col = table.area.c0 + i;
    const cell = sheet?.cells[cellKey(table.area.r0, col)];
    const text = hasContent(cell) ? shownText(calc.value(table.sheetId, table.area.r0, col), cell?.s?.fmt, locale).trim() : "";
    return text || genericColumnName(locale, i + 1);
  });
}

/** How a cell inside a table looks: header, banded data row, totals row (null outside tables). */
export type TableCellRole = { table: TableSpec; part: "header" | "data" | "totals"; columnIndex: number; band: 0 | 1 };

export function tableCellRole(wb: Workbook, sheetId: string, row: number, col: number, isRowHidden: (row: number) => boolean): TableCellRole | null {
  const table = tableAt(wb, sheetId, row, col);
  if (!table) return null;
  const columnIndex = col - table.area.c0;
  if (row === table.area.r0) return { table, part: "header", columnIndex, band: 0 };
  if (table.totals && row === table.area.r1) return { table, part: "totals", columnIndex, band: 0 };
  // Banding follows the rows you see: a filter doesn't leave two shaded rows next to each other.
  let shown = 0;
  for (let r = table.area.r0 + 1; r < row; r++) if (!isRowHidden(r)) shown++;
  return { table, part: "data", columnIndex, band: (shown % 2) as 0 | 1 };
}

/**
 * The band (0, 1) of each data row of a table at once, counting only rows you see; index 0 is
 * the first data row. Faster than tableCellRole for every cell of a big table.
 */
export function tableBands(table: TableSpec, isRowHidden: (row: number) => boolean): Uint8Array {
  const d = dataRows(table);
  const out = new Uint8Array(Math.max(0, d.r1 - d.r0 + 1));
  let shown = 0;
  for (let r = d.r0; r <= d.r1; r++) {
    if (isRowHidden(r)) continue;
    out[r - d.r0] = shown % 2;
    shown++;
  }
  return out;
}
