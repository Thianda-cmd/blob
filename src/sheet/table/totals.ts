// The totals row of a smart table ("Ergebniszeile"): which SUBTOTAL each total function writes,
// reading a totals cell back, and keeping the totals formulas on the table's data rows when rows
// come and go.
//
// Imports nothing from ops.ts on purpose: ops.ts may call refreshTotals after inserting or
// deleting rows without an import cycle.

import { cellKey, colIndex, colName } from "../a1";
import type { Cell, Sheet, TableSpec, TotalFn, Workbook } from "../types";

/** Every total function, in the order menus show them. */
export const TOTAL_FNS: TotalFn[] = ["none", "sum", "average", "count", "countNumbers", "min", "max", "stdev", "var"];

/** Excel's totals row codes: 1xx, so rows hidden by a filter or by hand don't count. */
export const TOTAL_CODES: Record<Exclude<TotalFn, "none">, number> = {
  sum: 109,
  average: 101,
  count: 103,
  countNumbers: 102,
  min: 105,
  max: 104,
  stdev: 107,
  var: 110,
};

const BY_CODE: Record<number, Exclude<TotalFn, "none">> = { 9: "sum", 1: "average", 3: "count", 2: "countNumbers", 5: "min", 4: "max", 7: "stdev", 10: "var" };

/** Counts: their result is a number of cells, so the column's number format doesn't suit them. */
export const isCountTotal = (fn: TotalFn) => fn === "count" || fn === "countNumbers";

/** The rows between the header and the totals row (r1 < r0 when the table has none). */
export function dataRows(t: TableSpec): { r0: number; r1: number } {
  return { r0: t.area.r0 + 1, r1: t.totals ? t.area.r1 - 1 : t.area.r1 };
}

/** A column's total over rows r0…r1 as a canonical formula ("SUBTOTAL(109,B2:B10)"); null for "none" or no rows. */
export function totalFormula(fn: TotalFn, col: number, r0: number, r1: number, code?: number): string | null {
  if (fn === "none" || r1 < r0) return null;
  const c = colName(col);
  return `SUBTOTAL(${code ?? TOTAL_CODES[fn]},${c}${r0 + 1}:${c}${r1 + 1})`;
}

const SUBTOTAL_RE = /^SUBTOTAL\(\s*(\d{1,3})\s*,\s*\$?([A-Z]{1,3})\$?(\d{1,6})\s*:\s*\$?([A-Z]{1,3})\$?(\d{1,6})\s*\)$/i;

/** A totals cell's formula read back (SUBTOTAL over one column); null for anything else. */
export function parseTotalFormula(f: string | undefined): { fn: Exclude<TotalFn, "none">; code: number; col: number; r0: number; r1: number } | null {
  if (!f) return null;
  const m = SUBTOTAL_RE.exec(f.trim());
  if (!m) return null;
  const code = Number(m[1]);
  const fn = BY_CODE[code > 100 ? code - 100 : code];
  const c0 = colIndex(m[2]);
  const c1 = colIndex(m[4]);
  if (!fn || (code > 11 && code < 101) || code > 111 || c0 < 0 || c0 !== c1) return null;
  const a = Number(m[3]) - 1;
  const b = Number(m[5]) - 1;
  return { fn, code, col: c0, r0: Math.min(a, b), r1: Math.max(a, b) };
}

/**
 * What a totals cell shows: one of the functions (when it holds the SUBTOTAL for its own column),
 * "none" when it is empty or the label, "custom" for anything else typed there.
 */
export function totalOfCell(cell: Cell | undefined, col: number): TotalFn | "custom" {
  if (!cell || (cell.f === undefined && (cell.v === undefined || typeof cell.v === "string"))) return "none";
  const p = parseTotalFormula(cell.f);
  return p && p.col === col ? p.fn : "custom";
}

/**
 * The totals formulas of tables back on their data rows. Inserting a row right under the header
 * or right above the totals row leaves a SUBTOTAL range one row short (ranges only grow when rows
 * come in between their ends, as in Excel); this puts it right. Only SUBTOTALs over the table's own
 * column are touched, never a formula typed there by hand. The same workbook when nothing changed.
 */
export function refreshTotals(wb: Workbook, sheetId?: string): Workbook {
  let next = wb;
  for (const t of wb.tables) {
    if (!t.totals || (sheetId !== undefined && t.sheetId !== sheetId)) continue;
    const d = dataRows(t);
    if (d.r1 < d.r0) continue;
    const si = next.sheets.findIndex((s) => s.id === t.sheetId);
    if (si < 0) continue;
    const sheet = next.sheets[si];
    let cells: Record<string, Cell> | null = null;
    for (let i = 0; i < t.columns.length; i++) {
      const col = t.area.c0 + i;
      const key = cellKey(t.area.r1, col);
      const cell = sheet.cells[key];
      const p = parseTotalFormula(cell?.f);
      if (!cell || !p || p.col !== col) continue;
      const want = totalFormula(p.fn, col, d.r0, d.r1, p.code);
      if (!want || want === cell.f) continue;
      cells ??= { ...sheet.cells };
      cells[key] = { ...cell, f: want };
    }
    if (!cells) continue;
    const sheets = next.sheets.slice();
    sheets[si] = { ...sheet, cells } satisfies Sheet;
    next = { ...next, sheets };
  }
  return next;
}
