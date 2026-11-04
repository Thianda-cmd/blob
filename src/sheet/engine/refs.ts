// Rewriting the references inside formulas: copying and filling (relative parts move, $ parts
// stay), and structural changes (rows and columns inserted or deleted, sheets renamed or deleted,
// cells moved by cut and paste) with Excel's rules: a range grows when rows are inserted inside it,
// shrinks when some of its rows are deleted, and becomes #REF! when all of them are.
//
// Everything works on tokens, so the rest of the formula (spaces, names, numbers) stays exactly
// as it was written.

import { colName, quoteSheetName } from "../a1";
import type { Area } from "../types";
import type { StructuralChange } from "./index";
import { EXCEL_MAX_COLS, EXCEL_MAX_ROWS, type RefInfo, type Tok } from "./lexer";
import { lexCanonical } from "./parser";
import { errorText } from "./values";

const cellText = (col: number, absCol: boolean, row: number, absRow: boolean) => `${absCol ? "$" : ""}${colName(col)}${absRow ? "$" : ""}${row + 1}`;

/** The text of a reference: sheet (quoted when needed), then the cell, range, columns or rows with their $ signs. */
export function refText(ref: RefInfo): string {
  const prefix = ref.sheet !== null ? `${quoteSheetName(ref.sheet)}!` : "";
  switch (ref.kind) {
    case "cell":
      return prefix + cellText(ref.c0, ref.ac0, ref.r0, ref.ar0);
    case "range":
      return `${prefix}${cellText(ref.c0, ref.ac0, ref.r0, ref.ar0)}:${cellText(ref.c1, ref.ac1, ref.r1, ref.ar1)}`;
    case "cols":
      return `${prefix}${ref.ac0 ? "$" : ""}${colName(ref.c0)}:${ref.ac1 ? "$" : ""}${colName(ref.c1)}`;
    case "rows":
      return `${prefix}${ref.ar0 ? "$" : ""}${ref.r0 + 1}:${ref.ar1 ? "$" : ""}${ref.r1 + 1}`;
  }
}

/** Corners in order (top-left first), each $ staying with its row or column. */
export function normalizeRef(ref: RefInfo): RefInfo {
  let out = ref;
  if (ref.r0 > ref.r1) out = { ...out, r0: ref.r1, r1: ref.r0, ar0: ref.ar1, ar1: ref.ar0 };
  if (ref.c0 > ref.c1) out = { ...out, c0: ref.c1, c1: ref.c0, ac0: ref.ac1, ac1: ref.ac0 };
  return out;
}

/** Replace references through `f` (undefined keeps a reference, null makes it #REF!); the formula unchanged when nothing changes. */
export function rewriteRefs(canonical: string, f: (ref: RefInfo, tok: Tok) => RefInfo | null | undefined): string {
  const toks = lexCanonical(canonical);
  let changed = false;
  const parts: string[] = [];
  for (const t of toks) {
    if (t.k === "ref" && t.ref) {
      const r = f(t.ref, t);
      if (r === undefined) parts.push(t.text);
      else {
        const text = r === null ? errorText("#REF!", "en") : refText(r);
        if (text !== t.text) changed = true;
        parts.push(text);
      }
    } else parts.push(t.text);
  }
  return changed ? parts.join("") : canonical;
}

const rowOk = (r: number) => r >= 0 && r < EXCEL_MAX_ROWS;
const colOk = (c: number) => c >= 0 && c < EXCEL_MAX_COLS;

/** A reference copied (rows, cols) away: relative parts move, absolute stay; off the grid → null. */
export function shiftRef(ref: RefInfo, rows: number, cols: number): RefInfo | null {
  const r0 = ref.kind === "cols" || ref.ar0 ? ref.r0 : ref.r0 + rows;
  const r1 = ref.kind === "cols" || ref.ar1 ? ref.r1 : ref.r1 + rows;
  const c0 = ref.kind === "rows" || ref.ac0 ? ref.c0 : ref.c0 + cols;
  const c1 = ref.kind === "rows" || ref.ac1 ? ref.c1 : ref.c1 + cols;
  if (!rowOk(r0) || !rowOk(r1) || !colOk(c0) || !colOk(c1)) return null;
  if (r0 === ref.r0 && r1 === ref.r1 && c0 === ref.c0 && c1 === ref.c1) return ref;
  return { ...ref, r0, r1, c0, c1 };
}

/** Copying or filling a formula (rows, cols) away. */
export function shiftFormula(canonical: string, rows: number, cols: number): string {
  if (rows === 0 && cols === 0) return canonical;
  return rewriteRefs(canonical, (ref) => {
    const r = shiftRef(ref, rows, cols);
    return r === ref ? undefined : r;
  });
}

/**
 * Pasting a formula transposed (rows become columns), from (srcRow, srcCol) to (dstRow, dstCol):
 * like Excel, a relative reference's offset turns too (two columns to the left becomes two rows
 * up), so it keeps pointing at the same, now transposed, data. Absolute references stay; mixed
 * ones just move by the distance.
 */
export function transposeFormula(canonical: string, srcRow: number, srcCol: number, dstRow: number, dstCol: number): string {
  const dr = dstRow - srcRow;
  const dc = dstCol - srcCol;
  const corner = (r: number, c: number, ar: boolean, ac: boolean): [number, number] => {
    if (!ar && !ac) return [dstRow + (c - srcCol), dstCol + (r - srcRow)];
    return [ar ? r : r + dr, ac ? c : c + dc];
  };
  return rewriteRefs(canonical, (ref) => {
    if (ref.kind === "cols" || ref.kind === "rows") {
      const r = shiftRef(ref, dr, dc);
      return r === ref ? undefined : r;
    }
    const [r0, c0] = corner(ref.r0, ref.c0, ref.ar0, ref.ac0);
    const [r1, c1] = corner(ref.r1, ref.c1, ref.ar1, ref.ac1);
    if (!rowOk(r0) || !rowOk(r1) || !colOk(c0) || !colOk(c1)) return null;
    return normalizeRef({ ...ref, r0, c0, r1, c1 });
  });
}

const same = (a: string | null, b: string) => a !== null && a.toLowerCase() === b.toLowerCase();

/** An inclusive span [lo, hi] after inserting `count` at `at`. */
function spanInsert(lo: number, hi: number, at: number, count: number): [number, number] {
  return [lo >= at ? lo + count : lo, hi >= at ? hi + count : hi];
}

/** An inclusive span after deleting [at, at+count-1]; null when all of it is gone. */
function spanDelete(lo: number, hi: number, at: number, count: number): [number, number] | null {
  const end = at + count - 1;
  if (lo >= at && hi <= end) return null;
  const nlo = lo < at ? lo : lo > end ? lo - count : at;
  const nhi = hi < at ? hi : hi > end ? hi - count : at - 1;
  return nhi < nlo ? null : [nlo, nhi];
}

/** An area on a sheet after a structural change of that sheet; null when it was deleted entirely. */
export function adjustArea(area: Area, change: { kind: "insertRows" | "deleteRows" | "insertCols" | "deleteCols"; at: number; count: number }): Area | null {
  const a = { r0: Math.min(area.r0, area.r1), c0: Math.min(area.c0, area.c1), r1: Math.max(area.r0, area.r1), c1: Math.max(area.c0, area.c1) };
  switch (change.kind) {
    case "insertRows": {
      const [r0, r1] = spanInsert(a.r0, a.r1, change.at, change.count);
      return { ...a, r0, r1 };
    }
    case "insertCols": {
      const [c0, c1] = spanInsert(a.c0, a.c1, change.at, change.count);
      return { ...a, c0, c1 };
    }
    case "deleteRows": {
      const s = spanDelete(a.r0, a.r1, change.at, change.count);
      return s ? { ...a, r0: s[0], r1: s[1] } : null;
    }
    case "deleteCols": {
      const s = spanDelete(a.c0, a.c1, change.at, change.count);
      return s ? { ...a, c0: s[0], c1: s[1] } : null;
    }
  }
}

const inside = (r: { r0: number; r1: number; c0: number; c1: number }, a: Area) => r.r0 >= a.r0 && r.r1 <= a.r1 && r.c0 >= a.c0 && r.c1 <= a.c1;

/**
 * A reference in a formula on sheet `host` after a structural change. For a moved formula
 * (cut and paste), `newHost` is the sheet it lands on: references that stay keep pointing at
 * the old sheet.
 */
export function adjustRef(ref0: RefInfo, host: string, change: StructuralChange, newHost: string = host): RefInfo | null | undefined {
  const ref = ref0;
  const refSheet = ref.sheet ?? host;
  const movedHost = newHost.toLowerCase() !== host.toLowerCase();
  // An implicit reference in a formula that moves to another sheet must name its old sheet.
  const keepHome = (r: RefInfo): RefInfo => (movedHost && r.sheet === null ? { ...r, sheet: host } : r);

  switch (change.kind) {
    case "renameSheet":
      if (same(ref.sheet, change.from)) return { ...ref, sheet: change.to };
      return movedHost && ref.sheet === null ? keepHome(ref) : undefined;
    case "deleteSheet":
      return same(ref.sheet, change.sheet) ? null : undefined;
    case "move": {
      const n = normalizeRef(ref);
      const bounded = n.kind === "cell" || n.kind === "range";
      if (bounded && same(refSheet, change.sheet) && inside(n, change.from)) {
        const dr = change.to.row - change.from.r0;
        const dc = change.to.col - change.from.c0;
        const moved: RefInfo = { ...n, r0: n.r0 + dr, r1: n.r1 + dr, c0: n.c0 + dc, c1: n.c1 + dc };
        if (!rowOk(moved.r0) || !rowOk(moved.r1) || !colOk(moved.c0) || !colOk(moved.c1)) return null;
        // Landing on the formula's own sheet: no prefix needed unless one was written.
        const implicit = ref.sheet === null && change.toSheet.toLowerCase() === newHost.toLowerCase();
        return { ...moved, sheet: implicit ? null : change.toSheet };
      }
      // Cells pasted over: references to them are gone (#REF!), like Excel.
      const h = change.from.r1 - change.from.r0;
      const w = change.from.c1 - change.from.c0;
      const dest: Area = { r0: change.to.row, c0: change.to.col, r1: change.to.row + h, c1: change.to.col + w };
      if (bounded && same(refSheet, change.toSheet) && inside(n, dest) && !(same(refSheet, change.sheet) && inside(n, change.from))) return null;
      return movedHost ? keepHome(ref) : undefined;
    }
    default: {
      if (!same(refSheet, change.sheet)) return movedHost ? keepHome(ref) : undefined;
      const n = normalizeRef(ref);
      const rowsChange = change.kind === "insertRows" || change.kind === "deleteRows";
      if (rowsChange && n.kind === "cols") return undefined;
      if (!rowsChange && n.kind === "rows") return undefined;
      const area = adjustArea({ r0: n.r0, c0: n.c0, r1: n.r1, c1: n.c1 }, change);
      if (!area) return null;
      if (!rowOk(area.r0) || !rowOk(area.r1) || !colOk(area.c0) || !colOk(area.c1)) return null;
      if (area.r0 === n.r0 && area.r1 === n.r1 && area.c0 === n.c0 && area.c1 === n.c1) return n === ref ? undefined : n;
      return { ...n, ...area };
    }
  }
}

/** Rewrite a formula on sheet `host` after a structural change (sheet names compared without case). */
export function adjustFormula(canonical: string, host: string, change: StructuralChange): string {
  return rewriteRefs(canonical, (ref) => adjustRef(ref, host, change));
}

/** A formula moved by cut and paste from sheet `host` to `newHost`, following the move. */
export function adjustMovedFormula(canonical: string, host: string, newHost: string, change: StructuralChange): string {
  return rewriteRefs(canonical, (ref) => adjustRef(ref, host, change, newHost));
}

// ----------------------------------------------------------------------------------------------
// Smart tables growing: Excel's structured references, without the syntax

/**
 * A smart table whose data rows changed from `from` to `to`: it grew by rows typed or pasted right
 * below it, or by rows inserted right under its header or right above its totals row (rows
 * inserted between its data rows need nothing: ranges grow by Excel's rules then).
 */
export type TableRows = {
  /** The table's sheet, by name (compared without case, as formulas name sheets). */
  sheet: string;
  /** The table's columns. */
  c0: number;
  c1: number;
  /** Its header row. */
  header: number;
  /** Its data rows as references write them now, and the rows they should cover. */
  from: { r0: number; r1: number };
  to: { r0: number; r1: number };
};

/**
 * Where a range on the table's sheet goes when the table's rows change: a range that covers
 * exactly the data rows of one or more of the table's columns covers the new data rows, one that
 * covers the header row plus all data rows grows with them. Anything else (part of the data, the
 * totals row, columns beside the table) gives null.
 */
export function tableRowsArea(a: Area, rows: Omit<TableRows, "sheet">): Area | null {
  const { from, to } = rows;
  if (from.r1 < from.r0 || to.r1 < to.r0) return null;
  const n = { r0: Math.min(a.r0, a.r1), c0: Math.min(a.c0, a.c1), r1: Math.max(a.r0, a.r1), c1: Math.max(a.c0, a.c1) };
  if (n.c0 < rows.c0 || n.c1 > rows.c1 || n.r1 !== from.r1) return null;
  if (n.r0 === from.r0) return n.r0 === to.r0 && n.r1 === to.r1 ? null : { ...n, r0: to.r0, r1: to.r1 };
  if (n.r0 === rows.header && rows.header < from.r0) return n.r1 === to.r1 ? null : { ...n, r1: to.r1 };
  return null;
}

/**
 * A formula on sheet `host` after a smart table's rows changed: =STEIGUNG(C6:C11;B6:B11) →
 * C6:C12, B6:B12 when the table's data rows 6…11 became 6…12, also as $C$6:$C$11 or
 * 'Blatt 1'!C6:C11 from another sheet, the way Excel's Tabelle1[Extinktion] would follow. Only
 * ranges (A1:A5), never single cells. `at`: the formula's own cell; when one of its ranges would
 * come to include it (=MITTELWERT(C6:C11) typed right below the table, into C12; a fill over the
 * rows under the table, where =STEIGUNG(B2:B7;A2:A7) sits in B9), the formula stays as it is, all
 * of its ranges: the table growing never makes a formula circular, and the ranges of one formula
 * keep the same rows (one grown, its partner not, would give #NV). So it does when one of them
 * would take in a cell of `keepOut` (on the table's sheet): other formulas over the table's data in
 * the rows it takes in, a summary under it (the fill reaching row 9, =BESTIMMTHEITSMASS(B2:B7;A2:A7)
 * in B10 must not count B9's slope as a measurement).
 */
export function growTableRefs(canonical: string, host: string, rows: TableRows, at?: { row: number; col: number }, keepOut: readonly { row: number; col: number }[] = []): string {
  const own = same(host, rows.sheet);
  let stays = false;
  const grown = rewriteRefs(canonical, (ref) => {
    if (ref.kind !== "range" || !same(ref.sheet ?? host, rows.sheet)) return undefined;
    const n = normalizeRef(ref);
    const a = tableRowsArea(n, rows);
    if (!a) return undefined;
    const takesIn = (p: { row: number; col: number }) => p.row >= a.r0 && p.row <= a.r1 && p.col >= a.c0 && p.col <= a.c1;
    if ((at && own && takesIn(at)) || keepOut.some(takesIn)) stays = true;
    return { ...n, r0: a.r0, r1: a.r1 };
  });
  return stays ? canonical : grown;
}
