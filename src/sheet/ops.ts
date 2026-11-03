// Pure operations on a workbook: each returns a new Workbook and leaves the old one untouched
// (undo keeps it). Structural changes (rows, columns, sheets, moves) also rewrite formulas,
// charts and smart tables so everything keeps pointing at the same data.
//
// CONTRACT: other modules call these. Keep names and signatures; add more if needed.

import type { Locale } from "@/i18n/config";
import { cellKey } from "./a1";
import type { Calc } from "./engine";
import type { Area, Cell, CellStyle, ChartSpec, Pos, Sheet, TableSpec, Workbook } from "./types";

const todo = (name: string): never => {
  throw new Error(`ops: ${name} not implemented`);
};

// ----------------------------------------------------------------------------------------------
// Reading (implemented)

export const sheetById = (wb: Workbook, id: string): Sheet | undefined => wb.sheets.find((s) => s.id === id);

export const getCell = (wb: Workbook, sheetId: string, row: number, col: number): Cell | undefined => sheetById(wb, sheetId)?.cells[cellKey(row, col)];

/** A short random id for sheets, charts, series, tables and columns. */
export function newId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
}

// ----------------------------------------------------------------------------------------------
// Charts and tables (implemented): add or replace by id, remove

export const putChart = (wb: Workbook, chart: ChartSpec): Workbook => ({
  ...wb,
  charts: wb.charts.some((c) => c.id === chart.id) ? wb.charts.map((c) => (c.id === chart.id ? chart : c)) : [...wb.charts, chart],
});
export const removeChart = (wb: Workbook, id: string): Workbook => ({ ...wb, charts: wb.charts.filter((c) => c.id !== id) });

export const putTable = (wb: Workbook, table: TableSpec): Workbook => ({
  ...wb,
  tables: wb.tables.some((t) => t.id === table.id) ? wb.tables.map((t) => (t.id === table.id ? table : t)) : [...wb.tables, table],
});
export const removeTable = (wb: Workbook, id: string): Workbook => ({ ...wb, tables: wb.tables.filter((t) => t.id !== id) });

// ----------------------------------------------------------------------------------------------
// Cells

/**
 * Set or clear cells. `cell: null` removes the cell entirely; a cell left with nothing in it
 * ({} or only undefined keys) is removed too. The sheet's size grows to include every cell
 * (up to MAX_ROWS × MAX_COLS).
 */
export function setCells(wb: Workbook, sheetId: string, updates: { row: number; col: number; cell: Cell | null }[]): Workbook {
  void wb;
  void sheetId;
  void updates;
  return todo("setCells");
}

/** Change the look of every cell in the areas: a patch merges (undefined removes a key), a function replaces. */
export function setStyle(wb: Workbook, sheetId: string, areas: Area[], patch: Partial<CellStyle> | ((style: CellStyle | undefined) => CellStyle | undefined)): Workbook {
  void wb;
  void sheetId;
  void areas;
  void patch;
  return todo("setStyle");
}

export type ClearWhat = "all" | "contents" | "formats" | "notes";

/** Delete key: "contents" keeps the look; "all" removes everything. */
export function clearAreas(wb: Workbook, sheetId: string, areas: Area[], what: ClearWhat): Workbook {
  void wb;
  void sheetId;
  void areas;
  void what;
  return todo("clearAreas");
}

// ----------------------------------------------------------------------------------------------
// Rows and columns: everything at and after `at` moves; formulas, charts and tables follow.

export function insertRows(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  void wb;
  void sheetId;
  void at;
  void count;
  return todo("insertRows");
}
export function deleteRows(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  void wb;
  void sheetId;
  void at;
  void count;
  return todo("deleteRows");
}
export function insertCols(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  void wb;
  void sheetId;
  void at;
  void count;
  return todo("insertCols");
}
export function deleteCols(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  void wb;
  void sheetId;
  void at;
  void count;
  return todo("deleteCols");
}

/** null = back to the default size. */
export function setColWidths(wb: Workbook, sheetId: string, cols: number[], width: number | null): Workbook {
  void wb;
  void sheetId;
  void cols;
  void width;
  return todo("setColWidths");
}
export function setRowHeights(wb: Workbook, sheetId: string, rows: number[], height: number | null): Workbook {
  void wb;
  void sheetId;
  void rows;
  void height;
  return todo("setRowHeights");
}
export function setHidden(wb: Workbook, sheetId: string, kind: "rows" | "cols", indexes: number[], hidden: boolean): Workbook {
  void wb;
  void sheetId;
  void kind;
  void indexes;
  void hidden;
  return todo("setHidden");
}
export function setFreeze(wb: Workbook, sheetId: string, rows: number, cols: number): Workbook {
  void wb;
  void sheetId;
  void rows;
  void cols;
  return todo("setFreeze");
}

// ----------------------------------------------------------------------------------------------
// Copy, paste, fill, sort

/** What copying puts on Blob's own clipboard: the source cells row by row (null = empty). */
export type ClipData = { sheetId: string; area: Area; cells: (Cell | null)[][] };

export function copyArea(wb: Workbook, sheetId: string, area: Area): ClipData {
  void wb;
  void sheetId;
  void area;
  return todo("copyArea");
}

export type PasteMode = "all" | "values" | "formats" | "formulas";

/**
 * Paste a clip with its top-left at target's top-left. Formulas shift by the distance from the
 * source, like Excel; "values" pastes calculated values (from calc); "formats" only looks.
 * `cut`: move instead (the source is cleared, references to it anywhere follow the cells).
 * When the target area is a whole multiple of the clip's size, the clip repeats to fill it.
 */
export function pasteClip(wb: Workbook, calc: Calc, sheetId: string, target: Area, clip: ClipData, opts: { mode: PasteMode; transpose?: boolean; cut?: boolean }): Workbook {
  void wb;
  void calc;
  void sheetId;
  void target;
  void clip;
  void opts;
  return todo("pasteClip");
}

/** Paste text from outside Blob (Excel, Google Sheets, a web table): each piece parsed like typing. */
export function pasteText(wb: Workbook, sheetId: string, at: Pos, rows: string[][], locale: Locale): Workbook {
  void wb;
  void sheetId;
  void at;
  void rows;
  void locale;
  return todo("pasteText");
}

/**
 * The fill handle: extend `from` to cover `to` (a bigger area in one direction, containing `from`).
 * Like Excel: one number copies, two or more continue their step (1, 2 → 3, 4; 0,5 1 → 1,5);
 * dates continue by day (or month/year when the step is one); "Probe 1" → "Probe 2"; weekday and
 * month names continue (in German and English); formulas shift; styles copy. Filling up or left
 * runs the series backwards.
 */
export function fillArea(wb: Workbook, calc: Calc, sheetId: string, from: Area, to: Area, locale: Locale): Workbook {
  void wb;
  void calc;
  void sheetId;
  void from;
  void to;
  void locale;
  return todo("fillArea");
}

export type SortKey = { col: number; dir: "asc" | "desc" };

/**
 * Sort the rows of an area by one or more columns, like Excel: numbers before text before
 * true/false, empty cells last either way, text compared in the user's language. Whole rows of
 * the area move with their formulas (relative references shift with the row).
 */
export function sortArea(wb: Workbook, calc: Calc, sheetId: string, area: Area, keys: SortKey[], locale: Locale): Workbook {
  void wb;
  void calc;
  void sheetId;
  void area;
  void keys;
  void locale;
  return todo("sortArea");
}

// ----------------------------------------------------------------------------------------------
// Find and replace

export type FindOptions = { sheetId?: string; matchCase?: boolean; wholeCell?: boolean; inFormulas?: boolean };

/** Cells whose shown text (or formula, with inFormulas) contains the query, sheet by sheet, row by row. */
export function findCells(wb: Workbook, calc: Calc, query: string, opts: FindOptions, locale: Locale): { sheetId: string; row: number; col: number }[] {
  void wb;
  void calc;
  void query;
  void opts;
  void locale;
  return todo("findCells");
}

/** Replace in typed values (and formulas with inFormulas); returns the workbook and how many cells changed. */
export function replaceCells(wb: Workbook, calc: Calc, query: string, replacement: string, opts: FindOptions, locale: Locale): { wb: Workbook; count: number } {
  void wb;
  void calc;
  void query;
  void replacement;
  void opts;
  void locale;
  return todo("replaceCells");
}

// ----------------------------------------------------------------------------------------------
// Sheets (tabs)

/** A new empty sheet after the others (or at `at`), named uniquely ("Blatt 2" / "Sheet 2"). */
export function addSheet(wb: Workbook, locale: Locale, name?: string, at?: number): { wb: Workbook; sheetId: string } {
  void wb;
  void locale;
  void name;
  void at;
  return todo("addSheet");
}
/** Formulas that point at the old name follow. */
export function renameSheet(wb: Workbook, sheetId: string, name: string): Workbook {
  void wb;
  void sheetId;
  void name;
  return todo("renameSheet");
}
/** Never the last sheet. Its charts and tables go too; references to it become #REF!. */
export function deleteSheet(wb: Workbook, sheetId: string): Workbook {
  void wb;
  void sheetId;
  return todo("deleteSheet");
}
export function moveSheet(wb: Workbook, sheetId: string, toIndex: number): Workbook {
  void wb;
  void sheetId;
  void toIndex;
  return todo("moveSheet");
}
/** A copy right after it ("Blatt 1 (2)"), with its charts and tables. */
export function duplicateSheet(wb: Workbook, sheetId: string): { wb: Workbook; sheetId: string } {
  void wb;
  void sheetId;
  return todo("duplicateSheet");
}
/** base, or base + " (2)", " (3)"… not used yet (case-insensitive). */
export function uniqueSheetName(wb: Workbook, base: string): string {
  void wb;
  void base;
  return todo("uniqueSheetName");
}
/** 1–31 characters, none of []:*?/\ and not starting or ending with '. */
export function validSheetName(name: string): boolean {
  void name;
  return todo("validSheetName");
}
