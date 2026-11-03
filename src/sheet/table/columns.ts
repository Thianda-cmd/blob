// What a smart table's columns carry into rows and columns that come and go: calculated columns
// (a column whose data cells hold one formula, moved along with each row), the columns' number
// formats, and generic names for empty headers ("Spalte3"). Shared by the table model (typing and
// pasting next to a table) and ops.ts (inserting and deleting rows and columns).
//
// Imports nothing from ops.ts or model.ts on purpose: ops.ts uses it without an import cycle.

import type { Locale } from "@/i18n/config";
import { cellKey } from "../a1";
import { shiftFormula } from "../engine";
import type { Area, Cell, Sheet, TableSpec } from "../types";
import { dataRows } from "./totals";

export type CellUpdate = { row: number; col: number; cell: Cell | null };

/** A value or a formula (a cell with only a look or a note counts as empty). */
const hasContent = (c: Cell | undefined): boolean => !!c && (c.v !== undefined || c.f !== undefined);

/** "Spalte3" / "Column3": the name of a column without a header, like Excel's. */
export const genericColumnName = (locale: Locale, n: number) => `${locale === "de" ? "Spalte" : "Column"}${n}`;

/**
 * Names for the empty header cells of a table area ("Spalte2" for its second column), unique
 * among the names in the header (compared without case).
 */
export function headerGaps(sheet: Sheet, a: Area, locale: Locale): CellUpdate[] {
  const taken = new Set<string>();
  for (let c = a.c0; c <= a.c1; c++) {
    const v = sheet.cells[cellKey(a.r0, c)]?.v;
    if (v !== undefined) taken.add(String(v).toLowerCase());
  }
  const out: CellUpdate[] = [];
  for (let c = a.c0; c <= a.c1; c++) {
    const cell = sheet.cells[cellKey(a.r0, c)];
    if (hasContent(cell)) continue;
    let n = c - a.c0 + 1;
    while (taken.has(genericColumnName(locale, n).toLowerCase())) n++;
    const name = genericColumnName(locale, n);
    taken.add(name.toLowerCase());
    out.push({ row: a.r0, col: c, cell: { ...cell, v: name } });
  }
  return out;
}

/**
 * A calculated column: every row r0…r1 of the column holds the same formula, moved along with its
 * row (=A2*B2, =A3*B3…). That formula and the row it was read in; null otherwise. Rows in `skip`
 * (just inserted, still empty) are left out.
 */
export function columnPattern(sheet: Sheet, col: number, r0: number, r1: number, skip?: { r0: number; r1: number }): { f: string; row: number } | null {
  let ref: { f: string; row: number } | null = null;
  for (let r = r0; r <= r1; r++) {
    if (skip && r >= skip.r0 && r <= skip.r1) continue;
    const c = sheet.cells[cellKey(r, col)];
    if (!c || c.f === undefined) return null;
    if (!ref) ref = { f: c.f, row: r };
    else if (shiftFormula(ref.f, r - ref.row, 0) !== c.f) return null;
  }
  return ref;
}

/**
 * Rows `from`…`to` just inserted among a table's data rows (`t` already includes them; `sheet` is
 * the sheet after inserting, so they are empty): calculated columns continue into them and every
 * column's number format carries on from the data row above (from the one below for rows right
 * under the header), the way Excel fills a new table row.
 */
export function insertedRowCells(sheet: Sheet, t: TableSpec, from: number, to: number): CellUpdate[] {
  const d = dataRows(t);
  const near = from - 1 >= d.r0 ? from - 1 : to + 1 <= d.r1 ? to + 1 : -1;
  const out: CellUpdate[] = [];
  if (near < 0) return out;
  for (let col = t.area.c0; col <= t.area.c1; col++) {
    const pattern = columnPattern(sheet, col, d.r0, d.r1, { r0: from, r1: to });
    const fmt = sheet.cells[cellKey(near, col)]?.s?.fmt;
    if (!pattern && !fmt) continue;
    for (let row = from; row <= to; row++) {
      const cell = sheet.cells[cellKey(row, col)];
      const f = pattern && !hasContent(cell) ? shiftFormula(pattern.f, row - pattern.row, 0) : cell?.f;
      const s = fmt && !cell?.s?.fmt ? { ...cell?.s, fmt } : cell?.s;
      out.push({ row, col, cell: { ...cell, f, s } });
    }
  }
  return out;
}
