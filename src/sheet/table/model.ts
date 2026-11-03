// Smart tables ("intelligente Tabellen", Excel's "Als Tabelle formatieren"): a range with a header
// row that sorts, filters, adds a totals row, grows when you type right below or beside it, and
// fills a formula typed into one of its columns down the whole column.
//
// CONTRACT: pure functions on a Workbook; keep names and signatures, add more if needed.

import type { Locale } from "@/i18n/config";
import type { Calc } from "../engine";
import type { Area, FilterSpec, TableSpec, TableStyle, TotalFn, Workbook } from "../types";

const todo = (name: string): never => {
  throw new Error(`table: ${name} not implemented`);
};

/** The smart table a cell belongs to (header, data or totals row). */
export function tableAt(wb: Workbook, sheetId: string, row: number, col: number): TableSpec | undefined {
  void wb;
  void sheetId;
  void row;
  void col;
  return todo("tableAt");
}

/**
 * Turn an area into a smart table. When its first row looks like a header (text above numbers)
 * it becomes the header; otherwise a header row is inserted above with "Spalte1", "Spalte2"…
 * ("Column1" in English). A single cell grows to the block of filled cells around it, like Excel.
 */
export function makeTable(wb: Workbook, calc: Calc, sheetId: string, area: Area, locale: Locale, style?: TableStyle): { wb: Workbook; tableId: string } | { error: "overlap" | "empty" } {
  void wb;
  void calc;
  void sheetId;
  void area;
  void locale;
  void style;
  return todo("makeTable");
}

/** Rows of a sheet hidden by its tables' filters. Pure; callers memoise per Calc. */
export function filteredRows(wb: Workbook, calc: Calc, sheetId: string, locale: Locale): Set<number> {
  void wb;
  void calc;
  void sheetId;
  void locale;
  return todo("filteredRows");
}

export function setTableFilter(wb: Workbook, tableId: string, columnId: string, filter: FilterSpec | null): Workbook {
  void wb;
  void tableId;
  void columnId;
  void filter;
  return todo("setTableFilter");
}

/** Sort the data rows (never the header or totals row) by one column. */
export function sortTable(wb: Workbook, calc: Calc, tableId: string, columnId: string, dir: "asc" | "desc", locale: Locale): Workbook {
  void wb;
  void calc;
  void tableId;
  void columnId;
  void dir;
  void locale;
  return todo("sortTable");
}

/** Add or remove the totals row (a new row below; the last column gets a sum or count first). */
export function setTotals(wb: Workbook, calc: Calc, tableId: string, on: boolean, locale: Locale): Workbook {
  void wb;
  void calc;
  void tableId;
  void on;
  void locale;
  return todo("setTotals");
}

/** A column's function in the totals row, written as =SUBTOTAL(109; …) etc. into its cell. */
export function setColumnTotal(wb: Workbook, tableId: string, columnId: string, fn: TotalFn): Workbook {
  void wb;
  void tableId;
  void columnId;
  void fn;
  return todo("setColumnTotal");
}

export function setTableLook(wb: Workbook, tableId: string, patch: Partial<Pick<TableSpec, "name" | "style" | "banded">>): Workbook {
  void wb;
  void tableId;
  void patch;
  return todo("setTableLook");
}

/** A name not used by another table ("Tabelle1", "Tabelle2"… / "Table1"…). */
export function uniqueTableName(wb: Workbook, locale: Locale, base?: string): string {
  void wb;
  void locale;
  void base;
  return todo("uniqueTableName");
}

/** Back to plain cells: the table goes, its cells (values, formulas, look) stay. */
export function unmakeTable(wb: Workbook, tableId: string): Workbook {
  void wb;
  void tableId;
  return todo("unmakeTable");
}

/**
 * After typing into (row, col): a table directly above or to the left grows to include it; a
 * formula typed into a table's data cell is filled down the column (Excel's calculated column).
 * Return wb unchanged when nothing applies. Called by the store's input().
 */
export function afterInput(wb: Workbook, calc: Calc, sheetId: string, row: number, col: number): Workbook {
  void wb;
  void calc;
  void sheetId;
  void row;
  void col;
  return todo("afterInput");
}

/** The header cell's text of each column (names used in charts and menus). */
export function columnNames(wb: Workbook, calc: Calc, table: TableSpec, locale: Locale): string[] {
  void wb;
  void calc;
  void table;
  void locale;
  return todo("columnNames");
}

/** How a cell inside a table looks: header, banded data row, totals row (null outside tables). */
export type TableCellRole = { table: TableSpec; part: "header" | "data" | "totals"; columnIndex: number; band: 0 | 1 };

export function tableCellRole(wb: Workbook, sheetId: string, row: number, col: number, isRowHidden: (row: number) => boolean): TableCellRole | null {
  void wb;
  void sheetId;
  void row;
  void col;
  void isRowHidden;
  return todo("tableCellRole");
}
