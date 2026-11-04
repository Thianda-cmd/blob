// Pure operations on a workbook: each returns a new Workbook and leaves the old one untouched
// (undo keeps it). Structural changes (rows, columns, sheets, moves) also rewrite formulas,
// charts and smart tables so everything keeps pointing at the same data.
//
// CONTRACT: other modules call these. Keep names and signatures; add more if needed.

import type { Locale } from "@/i18n/config";
import { cellKey, inArea, parseKey } from "./a1";
import { adjustArea, adjustFormula, adjustMovedFormula, compileGlob, editText, formatValue, globReplace, globTest, growTableRefs, isError, parseInput, shiftFormula, tableRowsArea, toCanonicalFormula, toLocalFormula, transposeFormula, typedFormat, type Calc, type CellValue, type Glob, type ParsedInput, type StructuralChange, type TableRows } from "./engine";
import { rewriteRefs } from "./engine/refs";
import { seriesOf } from "./engine/series";
import { withOp } from "./sheetLog";
// Smart-table helpers that import nothing from this file (table/model.ts does, so it can't be used here).
import { columnPattern, headerGaps, insertedRowCells } from "./table/columns";
import { freeTableName } from "./table/names";
import { dataRows, refreshTotals } from "./table/totals";
import { DEFAULT_SIZE, MAX_COLS, MAX_ROWS, type Area, type Cell, type CellStyle, type ChartSpec, type NumberFormat, type Pos, type RangeRef, type Sheet, type SheetOp, type TableSpec, type Workbook } from "./types";

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
// Helpers

/** Replace one sheet (by id) through `f`; the same workbook when nothing changed. */
function updateSheet(wb: Workbook, sheetId: string, f: (s: Sheet) => Sheet): Workbook {
  const i = wb.sheets.findIndex((s) => s.id === sheetId);
  if (i < 0) return wb;
  const next = f(wb.sheets[i]);
  if (next === wb.sheets[i]) return wb;
  const sheets = wb.sheets.slice();
  sheets[i] = next;
  return { ...wb, sheets };
}

/** A style without undefined keys; undefined when nothing is left. */
function cleanStyle(s: CellStyle | undefined): CellStyle | undefined {
  if (!s) return undefined;
  let out: CellStyle | undefined;
  for (const k of Object.keys(s) as (keyof CellStyle)[]) {
    if (s[k] === undefined) continue;
    if (k === "border") {
      const b = s.border!;
      const bb = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined));
      if (!Object.keys(bb).length) continue;
      (out ??= {}).border = bb as CellStyle["border"];
      continue;
    }
    (out ??= {})[k] = s[k] as never;
  }
  return out;
}

/** A cell without undefined keys or an empty style; null when nothing is left. */
function cleanCell(c: Cell): Cell | null {
  const out: Cell = {};
  if (c.v !== undefined && c.v !== null) out.v = c.v;
  if (c.f !== undefined && c.f !== null) out.f = c.f;
  const s = cleanStyle(c.s);
  if (s) out.s = s;
  if (c.note !== undefined && c.note !== null && c.note !== "") out.note = c.note;
  return Object.keys(out).length ? out : null;
}

/** Normalised area clipped to the sheet's grid. */
function clipArea(a: Area, sheet: Sheet): Area | null {
  const r0 = Math.max(0, Math.min(a.r0, a.r1));
  const c0 = Math.max(0, Math.min(a.c0, a.c1));
  const r1 = Math.min(Math.max(a.r0, a.r1), Math.max(sheet.size.rows, 1) - 1);
  const c1 = Math.min(Math.max(a.c0, a.c1), Math.max(sheet.size.cols, 1) - 1);
  return r0 <= r1 && c0 <= c1 ? { r0, c0, r1, c1 } : null;
}

const areaSize = (a: Area) => (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);

/** Visit the cells of the areas that exist (cheaper than every position for big areas). */
function eachExisting(sheet: Sheet, areas: Area[], f: (key: string, cell: Cell) => void): void {
  const total = areas.reduce((n, a) => n + areaSize(a), 0);
  const keys = Object.keys(sheet.cells);
  if (total > keys.length) {
    for (const key of keys) {
      const p = parseKey(key);
      if (areas.some((a) => inArea(a, p.row, p.col))) f(key, sheet.cells[key]);
    }
    return;
  }
  const seen = new Set<string>();
  for (const a of areas) {
    for (let r = a.r0; r <= a.r1; r++) {
      for (let c = a.c0; c <= a.c1; c++) {
        const key = cellKey(r, c);
        const cell = sheet.cells[key];
        if (cell && !seen.has(key)) {
          seen.add(key);
          f(key, cell);
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------------------------
// Cells

/**
 * Set or clear cells. `cell: null` removes the cell entirely; a cell left with nothing in it
 * ({} or only undefined keys) is removed too. The sheet's size grows to include every cell
 * (up to MAX_ROWS × MAX_COLS).
 */
export function setCells(wb: Workbook, sheetId: string, updates: { row: number; col: number; cell: Cell | null }[]): Workbook {
  if (!updates.length) return wb;
  return updateSheet(wb, sheetId, (sheet) => {
    let cells: Record<string, Cell> | null = null;
    let rows = sheet.size.rows;
    let cols = sheet.size.cols;
    for (const u of updates) {
      if (!(u.row >= 0 && u.col >= 0 && u.row < MAX_ROWS && u.col < MAX_COLS)) continue;
      const key = cellKey(u.row, u.col);
      const next = u.cell === null ? null : cleanCell(u.cell);
      const cur = (cells ?? sheet.cells)[key];
      if (next === null) {
        if (cur === undefined) continue;
        cells ??= { ...sheet.cells };
        delete cells[key];
      } else {
        cells ??= { ...sheet.cells };
        cells[key] = next;
        if (u.row >= rows) rows = u.row + 1;
        if (u.col >= cols) cols = u.col + 1;
      }
    }
    if (!cells) return sheet;
    const size = rows !== sheet.size.rows || cols !== sheet.size.cols ? { rows: Math.min(MAX_ROWS, rows), cols: Math.min(MAX_COLS, cols) } : sheet.size;
    return { ...sheet, cells, size };
  });
}

/** Change the look of every cell in the areas: a patch merges (undefined removes a key), a function replaces. */
export function setStyle(wb: Workbook, sheetId: string, areas: Area[], patch: Partial<CellStyle> | ((style: CellStyle | undefined) => CellStyle | undefined)): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const clipped = areas.map((a) => clipArea(a, sheet)).filter((a): a is Area => !!a);
  if (!clipped.length) return wb;
  const apply = (s: CellStyle | undefined): CellStyle | undefined => (typeof patch === "function" ? patch(s) : cleanStyle({ ...s, ...patch }));
  // Only removing settings: only existing cells can change.
  const onlyRemoves = typeof patch !== "function" && Object.values(patch).every((v) => v === undefined);
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  const visit = (row: number, col: number, cell: Cell | undefined) => {
    const s = cleanStyle(apply(cell?.s));
    if (!cell && !s) return;
    if (cell && JSON.stringify(cell.s) === JSON.stringify(s)) return;
    updates.push({ row, col, cell: { ...cell, s } });
  };
  if (onlyRemoves) {
    eachExisting(sheet, clipped, (key, cell) => {
      const p = parseKey(key);
      visit(p.row, p.col, cell);
    });
  } else {
    const seen = new Set<string>();
    for (const a of clipped) {
      for (let r = a.r0; r <= a.r1; r++) {
        for (let c = a.c0; c <= a.c1; c++) {
          const key = cellKey(r, c);
          if (seen.has(key)) continue;
          seen.add(key);
          visit(r, c, sheet.cells[key]);
        }
      }
    }
  }
  return setCells(wb, sheetId, updates);
}

export type ClearWhat = "all" | "contents" | "formats" | "notes";

/** Delete key: "contents" keeps the look; "all" removes everything. */
export function clearAreas(wb: Workbook, sheetId: string, areas: Area[], what: ClearWhat): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const norm = areas.map((a) => ({ r0: Math.min(a.r0, a.r1), c0: Math.min(a.c0, a.c1), r1: Math.max(a.r0, a.r1), c1: Math.max(a.c0, a.c1) }));
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  eachExisting(sheet, norm, (key, cell) => {
    const p = parseKey(key);
    let next: Cell | null;
    switch (what) {
      case "all":
        next = null;
        break;
      case "contents":
        next = { ...cell, v: undefined, f: undefined };
        break;
      case "formats":
        next = { ...cell, s: undefined };
        break;
      case "notes":
        next = { ...cell, note: undefined };
        break;
    }
    updates.push({ row: p.row, col: p.col, cell: next });
  });
  return setCells(wb, sheetId, updates);
}

// ----------------------------------------------------------------------------------------------
// Structural changes: formulas everywhere, charts and tables follow
//
// Each one is also written into the log of the sheets it changes (Sheet.log, src/sheet/sheetLog.ts)
// with a random id: merging lines other people's versions up with it (collab.ts), and replayOp
// does it again on such a version.

type RowColChange = { kind: "insertRows" | "deleteRows" | "insertCols" | "deleteCols"; at: number; count: number };

/** What names a logged change: its id and, for an undo or redo, the entry it takes back. */
type OpHead = { id: string; inv?: string };
const freshHead = (): OpHead => ({ id: newId() });
const headOf = (op: SheetOp): OpHead => (op.inv === undefined ? { id: op.id } : { id: op.id, inv: op.inv });

/** `op` written into the log of each sheet it changes. */
function logOp(wb: Workbook, sheetIds: string[], op: SheetOp): Workbook {
  let next = wb;
  for (const id of new Set(sheetIds)) next = updateSheet(next, id, (s) => withOp(s, op));
  return next;
}

/**
 * Could this formula name the sheet? A quick test before rewriting it. Formulas write a ' in a
 * sheet name twice ('Paul''s Daten'!A1), so that spelling counts too.
 */
function mayName(f: string, sheetName: string): boolean {
  const text = f.toLowerCase();
  const name = sheetName.toLowerCase();
  return text.includes(name) || (name.includes("'") && text.includes(name.replace(/'/g, "''")));
}

/**
 * Every formula of the workbook rewritten through `f` (host sheet name, formula) → new formula.
 * Sheets without changes are kept as they are, and so is sheet `skip` (its formulas are done
 * already: going through a big sheet's cells again would cost as much as the change itself).
 */
function mapFormulas(wb: Workbook, f: (host: Sheet, formula: string, key: string) => string, skip?: string): Workbook {
  let changed = false;
  const sheets = wb.sheets.map((sheet) => {
    if (sheet.id === skip) return sheet;
    let cells: Record<string, Cell> | null = null;
    for (const key in sheet.cells) {
      const cell = sheet.cells[key];
      if (cell.f === undefined) continue;
      const nf = f(sheet, cell.f, key);
      if (nf !== cell.f) {
        cells ??= { ...sheet.cells };
        cells[key] = { ...cell, f: nf };
      }
    }
    if (!cells) return sheet;
    changed = true;
    return { ...sheet, cells };
  });
  return changed ? { ...wb, sheets } : wb;
}

/** A chart or table range after a change on `sheetId`: unchanged, moved/resized, or null when its cells are gone. */
function adjustRange<T extends RangeRef>(ref: T, sheetId: string, change: RowColChange): T | null {
  if (ref.sheetId !== sheetId) return ref;
  const a = adjustArea(ref, change);
  if (!a) return null;
  if (a.r0 === ref.r0 && a.r1 === ref.r1 && a.c0 === ref.c0 && a.c1 === ref.c1) return ref;
  return { ...ref, ...a };
}

/** Charts after a change: ranges follow, series whose data is gone go (and a chart with no series left). */
function adjustCharts(charts: ChartSpec[], f: <T extends RangeRef>(ref: T) => T | null, anchor?: (c: ChartSpec) => ChartSpec): ChartSpec[] {
  const out: ChartSpec[] = [];
  for (const chart0 of charts) {
    const chart = anchor ? anchor(chart0) : chart0;
    let changed = chart !== chart0;
    const x = chart.x ? f(chart.x) : null;
    if (x !== chart.x) changed = true;
    const series = [];
    for (const s of chart.series) {
      const y = f(s.y);
      if (!y) {
        changed = true;
        continue;
      }
      const sx = s.x ? f(s.x) : null;
      const nameRef = s.nameRef ? f(s.nameRef) : null;
      const eb = s.errorBars;
      const plus = eb?.plus ? f(eb.plus) : null;
      const minus = eb?.minus ? f(eb.minus) : null;
      const ebChanged = !!eb && (plus !== eb.plus || minus !== eb.minus);
      if (y !== s.y || sx !== s.x || nameRef !== s.nameRef || ebChanged) {
        changed = true;
        series.push({ ...s, y, x: sx, nameRef, errorBars: eb && ebChanged ? { ...eb, plus, minus } : eb });
      } else series.push(s);
    }
    if (!series.length && chart.series.length) continue;
    out.push(changed ? { ...chart, x, series } : chart);
  }
  return out;
}

/**
 * A smart table's data rows changed from `from` to `to`: it grew by rows typed or pasted right
 * below it (table/model.ts afterInput, afterPaste) or inserted at its edges. Like Excel's
 * structured references (Tabelle1[Extinktion]), every reference that covered exactly its data rows
 * in one or more of its columns follows: formulas on any sheet (=STEIGUNG(C6:C11;B6:B11) →
 * C6:C12, B6:B12; $C$6:$C$11; 'Blatt 1'!C6:C11) and chart ranges (x and y values, error bar cells),
 * and so do ranges over its header row plus all data rows. Parts of the data, the totals row and
 * single cells stay. A formula never grows to include its own cell. The same workbook when nothing
 * points there. (`table`: its sheet, columns and header row; its area may already be the new one.)
 */
export function growTableReferences(wb: Workbook, table: TableSpec, from: { r0: number; r1: number }, to: { r0: number; r1: number }): Workbook {
  const sheet = sheetById(wb, table.sheetId);
  if (!sheet || from.r1 < from.r0 || to.r1 < to.r0 || (from.r0 === to.r0 && from.r1 === to.r1)) return wb;
  const rows: TableRows = { sheet: sheet.name, c0: table.area.c0, c1: table.area.c1, header: table.area.r0, from, to };
  // Formulas over the table's data in the rows it takes in (a summary under it: =STEIGUNG(B2:B7;A2:A7)
  // in B9 when a fill reaches row 9): no formula's ranges grow over them (growTableRefs' keepOut),
  // or the R² under the slope would count the slope as a measurement.
  const keepOut: Pos[] = [];
  for (let row = from.r1 + 1; row <= to.r1; row++) {
    for (let col = rows.c0; col <= rows.c1; col++) {
      const f = sheet.cells[cellKey(row, col)]?.f;
      if (f && growTableRefs(f, sheet.name, rows) !== f) keepOut.push({ row, col });
    }
  }
  // Every range that ends on the last data row names that row's number: a cheap first test.
  const mark = String(from.r1 + 1);
  const next = mapFormulas(wb, (host, f, key) => (f.includes(mark) ? growTableRefs(f, host.name, rows, parseKey(key), keepOut) : f));
  const fix = <T extends RangeRef>(ref: T): T => {
    if (ref.sheetId !== table.sheetId) return ref;
    const a = tableRowsArea(ref, rows);
    return a ? { ...ref, r0: a.r0, r1: a.r1 } : ref;
  };
  // A chart whose ranges would take in one of those cells keeps all of them: its x and y values stay in step.
  const keeps = (chart: ChartSpec) =>
    [chart.x, ...chart.series.flatMap((s) => [s.y, s.x, s.errorBars?.plus, s.errorBars?.minus])].some((ref) => {
      const a = ref && ref.sheetId === table.sheetId ? tableRowsArea(ref, rows) : null;
      return !!a && keepOut.some((p) => inArea(a, p.row, p.col));
    });
  let chartsChanged = false;
  const charts = next.charts.map((chart) => {
    if (keeps(chart)) return chart;
    const x = chart.x ? fix(chart.x) : null;
    let changed = x !== chart.x;
    // The legend name (nameRef) is the header cell: it stays.
    const series = chart.series.map((s) => {
      const y = fix(s.y);
      const sx = s.x ? fix(s.x) : null;
      const eb = s.errorBars;
      const plus = eb?.plus ? fix(eb.plus) : null;
      const minus = eb?.minus ? fix(eb.minus) : null;
      if (y === s.y && sx === s.x && plus === (eb?.plus ?? null) && minus === (eb?.minus ?? null)) return s;
      changed = true;
      return { ...s, y, x: sx, errorBars: eb ? { ...eb, plus, minus } : eb };
    });
    if (!changed) return chart;
    chartsChanged = true;
    return { ...chart, x, series };
  });
  return chartsChanged ? { ...next, charts } : next;
}

/** Shift a record keyed by index ("0", "1"…) for inserted or deleted rows/columns. */
function shiftIndexRecord<T>(rec: Record<string, T>, at: number, count: number, insert: boolean): Record<string, T> {
  const out: Record<string, T> = {};
  let changed = false;
  for (const [k, v] of Object.entries(rec)) {
    const i = Number(k);
    if (insert) {
      if (i >= at) {
        out[String(i + count)] = v;
        changed = true;
      } else out[k] = v;
    } else if (i >= at && i < at + count) changed = true;
    else if (i >= at + count) {
      out[String(i - count)] = v;
      changed = true;
    } else out[k] = v;
  }
  return changed ? out : rec;
}

/** Rows or columns inserted or deleted (logged as `head`): the same workbook when that can't be done. */
function rowColChange(wb: Workbook, sheetId: string, change: RowColChange, head: OpHead): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || change.count <= 0 || change.at < 0) return wb;
  const rowsOp = change.kind === "insertRows" || change.kind === "deleteRows";
  const insert = change.kind === "insertRows" || change.kind === "insertCols";
  const limit = rowsOp ? MAX_ROWS : MAX_COLS;
  const { at, count } = change;
  const end = at + count - 1;

  // One pass over this sheet: move the cells, adjust their formulas, note how far they reach.
  const sc: StructuralChange = { kind: change.kind, sheet: sheet.name, at, count };
  const cells: Record<string, Cell> = {};
  let used = 0;
  for (const key in sheet.cells) {
    const comma = key.indexOf(",");
    const row = +key.slice(0, comma);
    const col = +key.slice(comma + 1);
    const i = rowsOp ? row : col;
    let ni = i;
    if (insert) {
      if (i >= at) ni = i + count;
      // Data pushed off the sheet would be lost: refuse, like Excel.
      if (ni >= limit) return wb;
    } else if (i >= at && i <= end) continue;
    else if (i > end) ni = i - count;
    let cell = sheet.cells[key];
    if (cell.f !== undefined) {
      const nf = adjustFormula(cell.f, sheet.name, sc);
      if (nf !== cell.f) cell = { ...cell, f: nf };
    }
    cells[ni === i ? key : rowsOp ? `${ni},${col}` : `${row},${ni}`] = cell;
    if (ni + 1 > used) used = ni + 1;
  }

  // Formulas on the other sheets follow when they name this one.
  let next = mapFormulas(
    { ...wb, sheets: wb.sheets.map((s) => (s.id === sheetId ? { ...s, cells } : s)) },
    (host, f) => (mayName(f, sheet.name) ? adjustFormula(f, host.name, sc) : f),
    sheetId,
  );

  // Row heights / column widths and hidden flags, frozen panes, size.
  next = updateSheet(next, sheetId, (s) => {
    const key = rowsOp ? "rows" : "cols";
    const rec = shiftIndexRecord(s[key] as Record<string, unknown>, at, count, insert);
    const freezeN = rowsOp ? s.freeze.rows : s.freeze.cols;
    let nf = freezeN;
    if (insert && at < freezeN) nf = freezeN + count;
    if (!insert && at < freezeN) nf = freezeN - (Math.min(end, freezeN - 1) - at + 1);
    const freeze = rowsOp ? { ...s.freeze, rows: nf } : { ...s.freeze, cols: nf };
    const sizeN = rowsOp ? s.size.rows : s.size.cols;
    const base = rowsOp ? DEFAULT_SIZE.rows : DEFAULT_SIZE.cols;
    const ns = insert ? Math.min(limit, sizeN + count) : Math.max(Math.min(sizeN, base), sizeN - count, used, 1);
    const size = rowsOp ? { ...s.size, rows: ns } : { ...s.size, cols: ns };
    return { ...s, [key]: rec, freeze, size } as Sheet;
  });

  // Charts: ranges and anchors.
  const fix = <T extends RangeRef>(ref: T) => adjustRange(ref, sheetId, change);
  const anchor = (c: ChartSpec): ChartSpec => {
    if (c.sheetId !== sheetId) return c;
    const i = rowsOp ? c.at.row : c.at.col;
    let ni = i;
    let reset = false;
    if (insert) {
      if (i >= at) ni = i + count;
    } else if (i >= at && i <= end) {
      ni = at;
      reset = true;
    } else if (i > end) ni = i - count;
    if (ni === i && !reset) return c;
    const atNew = rowsOp ? { ...c.at, row: ni, dy: reset ? 0 : c.at.dy } : { ...c.at, col: ni, dx: reset ? 0 : c.at.dx };
    return { ...c, at: atNew };
  };
  const charts = adjustCharts(next.charts, fix, anchor);

  // Smart tables on this sheet.
  const tables: TableSpec[] = [];
  const grown: { before: TableSpec; after: TableSpec }[] = [];
  for (const t of next.tables) {
    if (t.sheetId !== sheetId) {
      tables.push(t);
      continue;
    }
    const area = adjustArea(t.area, change);
    if (!area) continue;
    if (change.kind === "deleteRows" && t.area.r0 >= at && t.area.r0 <= end) continue; // its header row is gone
    let nt: TableSpec = area.r0 === t.area.r0 && area.r1 === t.area.r1 && area.c0 === t.area.c0 && area.c1 === t.area.c1 ? t : { ...t, area };
    if (change.kind === "deleteRows" && t.totals && t.area.r1 >= at && t.area.r1 <= end) nt = { ...nt, totals: false };
    if (change.kind === "insertCols" && at > t.area.c0 && at <= t.area.c1) {
      const i = at - t.area.c0;
      // Ids from the change's own id: done again on another version (replayOp), the column gets
      // the same id there, so both versions' tables still match column for column.
      const added = Array.from({ length: count }, (_, k) => ({ id: `${head.id}-${k}`, total: "none" as const }));
      nt = { ...nt, columns: [...t.columns.slice(0, i), ...added, ...t.columns.slice(i)] };
    }
    if (change.kind === "deleteCols") {
      const from = Math.max(at, t.area.c0) - t.area.c0;
      const to = Math.min(end, t.area.c1) - t.area.c0;
      if (from <= to) {
        const gone = new Set(t.columns.slice(from, to + 1).map((c) => c.id));
        const columns = t.columns.filter((c) => !gone.has(c.id));
        if (!columns.length) continue;
        const filters = Object.fromEntries(Object.entries(t.filters).filter(([id]) => !gone.has(id)));
        nt = { ...nt, columns, filters, sort: t.sort && gone.has(t.sort.column) ? null : t.sort };
      }
    }
    if (change.kind === "insertRows" && nt.area.r0 === t.area.r0 && nt.area.r1 > t.area.r1) grown.push({ before: t, after: nt });
    tables.push(nt);
  }
  let out: Workbook = { ...next, charts, tables };
  for (const g of grown) out = continueTableRows(out, g.before, g.after, at, count);
  return logOp(out, [sheetId], { ...head, kind: change.kind, at, count });
}

/**
 * Rows inserted among a table's data rows (the table went from `before` to `after`), like Excel:
 * calculated columns and number formats continue into them, and when they came right under the
 * header or right above the totals row, ranges over the data rows take them in too (rows inserted
 * in between are inside those ranges already).
 */
function continueTableRows(wb: Workbook, before: TableSpec, after: TableSpec, at: number, count: number): Workbook {
  const d = dataRows(before);
  let next = wb;
  if (d.r1 >= d.r0) {
    if (at === d.r0) next = growTableReferences(next, after, { r0: d.r0 + count, r1: d.r1 + count }, { r0: d.r0, r1: d.r1 + count });
    else if (before.totals && at === before.area.r1) next = growTableReferences(next, after, d, { r0: d.r0, r1: d.r1 + count });
  }
  const sheet = sheetById(next, after.sheetId);
  return sheet ? setCells(next, after.sheetId, insertedRowCells(sheet, after, at, at + count - 1)) : next;
}

// ----------------------------------------------------------------------------------------------
// Rows and columns: everything at and after `at` moves; formulas, charts and tables follow.

//
// Smart tables: rows inserted among a table's data rows get its calculated columns and number
// formats; a totals row keeps adding up every data row; a table never loses its last data row;
// columns inserted into a table get a header name.

export function insertRows(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  const next = rowColChange(wb, sheetId, { kind: "insertRows", at, count }, freshHead());
  // Rows right under the header or right above the totals row lie outside the totals' SUBTOTAL ranges.
  return next === wb ? wb : refreshTotals(next, sheetId);
}
export function deleteRows(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  const next = deleteRowsKeepingTables(wb, sheetId, at, count);
  return next === wb ? wb : refreshTotals(next, sheetId);
}
/** `locale`: for the header names of columns inserted into a smart table ("Spalte3" / "Column3"). */
export function insertCols(wb: Workbook, sheetId: string, at: number, count: number, locale: Locale = "de"): Workbook {
  const next = rowColChange(wb, sheetId, { kind: "insertCols", at, count }, freshHead());
  if (next === wb) return wb;
  // A table's columns need names (menus, charts, the totals label): new ones get "Spalte3", unique in the table, as in Excel.
  const sheet = sheetById(next, sheetId);
  if (!sheet) return next;
  const names: { row: number; col: number; cell: Cell | null }[] = [];
  for (const t of wb.tables) {
    if (t.sheetId !== sheetId || !(at > t.area.c0 && at <= t.area.c1)) continue;
    const grown = next.tables.find((x) => x.id === t.id);
    if (grown) names.push(...headerGaps(sheet, grown.area, locale).filter((u) => u.col >= at && u.col < at + count));
  }
  return names.length ? setCells(next, sheetId, names) : next;
}
export function deleteCols(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  return rowColChange(wb, sheetId, { kind: "deleteCols", at, count }, freshHead());
}

/**
 * Deleting rows, except that a smart table losing every data row keeps one, empty, as in Excel (a
 * table of only a header can't take rows where its data was). One row less is deleted and the
 * row that stays (the table's first data row) is emptied in every column, except for what the
 * table keeps there: its calculated columns' formulas and its columns' number formats. Ranges over
 * the table's data rows shrink to that row instead of becoming #BEZUG!, so the totals row,
 * formulas like =STEIGUNG(…) and charts keep working and grow again with the next rows typed
 * below the table. Everything else ends up as after the full deletion.
 */
function deleteRowsKeepingTables(wb: Workbook, sheetId: string, at: number, count: number): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || count <= 0 || at < 0) return wb;
  const end = at + count - 1;
  const emptied = wb.tables.filter((t) => {
    if (t.sheetId !== sheetId || t.area.r0 !== at - 1) return false;
    const d = dataRows(t);
    return d.r1 >= d.r0 && d.r1 <= end;
  });
  if (!emptied.length) return rowColChange(wb, sheetId, { kind: "deleteRows", at, count }, freshHead());

  // What the kept row holds afterwards, read before anything moves.
  const keepFormula = new Set<number>();
  const keepFmt = new Map<number, NumberFormat>();
  for (const t of emptied) {
    const d = dataRows(t);
    for (let col = t.area.c0; col <= t.area.c1; col++) {
      if (columnPattern(sheet, col, d.r0, d.r1)) keepFormula.add(col);
      const fmt = sheet.cells[cellKey(d.r0, col)]?.s?.fmt ?? sheet.cells[cellKey(d.r1, col)]?.s?.fmt;
      if (fmt) keepFmt.set(col, fmt);
    }
  }
  // (Only these rows are logged as deleted: the kept row just has its cells emptied.)
  let next = count > 1 ? rowColChange(wb, sheetId, { kind: "deleteRows", at: at + 1, count: count - 1 }, freshHead()) : wb;

  // The kept row, emptied (its own formulas already follow the deletion).
  const after = sheetById(next, sheetId)!;
  const prefix = `${at},`;
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  const cols = new Set<number>([...keepFormula, ...keepFmt.keys()]);
  for (const key in after.cells) if (key.startsWith(prefix)) cols.add(parseKey(key).col);
  for (const col of cols) {
    const f = keepFormula.has(col) ? after.cells[cellKey(at, col)]?.f : undefined;
    const fmt = keepFmt.get(col);
    updates.push({ row: at, col, cell: f !== undefined || fmt ? { f, s: fmt ? { fmt } : undefined } : null });
  }
  next = setCells(next, sheetId, updates);
  next = updateSheet(next, sheetId, (s) => {
    if (!s.rows[String(at)]) return s;
    const rows = { ...s.rows };
    delete rows[String(at)];
    return { ...s, rows };
  });

  // Tables and charts as the full deletion leaves them: a table whose header row was the kept row
  // goes, one whose totals row it was loses it, charts anchored in the deleted rows move to the
  // first of them. An emptied table's filters go too: they could hide its one row.
  const gone = new Set(wb.tables.filter((t) => t.sheetId === sheetId && t.area.r0 === at).map((t) => t.id));
  const lostTotals = new Set(wb.tables.filter((t) => t.sheetId === sheetId && t.totals && t.area.r0 < at && t.area.r1 === at).map((t) => t.id));
  const emptiedIds = new Set(emptied.map((t) => t.id));
  const tables = next.tables
    .filter((t) => !gone.has(t.id))
    .map((t) => {
      if (lostTotals.has(t.id)) return { ...t, totals: false, area: { ...t.area, r1: at - 1 } };
      if (emptiedIds.has(t.id) && Object.keys(t.filters).length) return { ...t, filters: {} };
      return t;
    });
  const anchored = new Set(wb.charts.filter((c) => c.sheetId === sheetId && c.at.row >= at && c.at.row <= end).map((c) => c.id));
  const charts = next.charts.map((c) => (anchored.has(c.id) && (c.at.row !== at || c.at.dy !== 0) ? { ...c, at: { ...c.at, row: at, dy: 0 } } : c));
  return { ...next, tables, charts };
}

function setIndexProps<T extends { w?: number; h?: number; hidden?: boolean }>(rec: Record<string, T>, indexes: number[], patch: Partial<T>): Record<string, T> {
  const out = { ...rec };
  for (const i of indexes) {
    if (!(i >= 0)) continue;
    const k = String(i);
    const merged = { ...out[k], ...patch } as T;
    for (const key of Object.keys(merged) as (keyof T)[]) if (merged[key] === undefined || merged[key] === false) delete merged[key];
    if (Object.keys(merged).length) out[k] = merged;
    else delete out[k];
  }
  return out;
}

const clampSize = (n: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, n)));

/** null = back to the default size. */
export function setColWidths(wb: Workbook, sheetId: string, cols: number[], width: number | null): Workbook {
  return updateSheet(wb, sheetId, (s) => ({ ...s, cols: setIndexProps(s.cols, cols, { w: width === null ? undefined : clampSize(width, 16, 2000) }) }));
}
export function setRowHeights(wb: Workbook, sheetId: string, rows: number[], height: number | null): Workbook {
  return updateSheet(wb, sheetId, (s) => ({ ...s, rows: setIndexProps(s.rows, rows, { h: height === null ? undefined : clampSize(height, 12, 1000) }) }));
}
export function setHidden(wb: Workbook, sheetId: string, kind: "rows" | "cols", indexes: number[], hidden: boolean): Workbook {
  return updateSheet(wb, sheetId, (s) => ({ ...s, [kind]: setIndexProps(s[kind] as Record<string, { hidden?: boolean }>, indexes, { hidden: hidden || undefined }) }));
}
export function setFreeze(wb: Workbook, sheetId: string, rows: number, cols: number): Workbook {
  return updateSheet(wb, sheetId, (s) => {
    const r = Math.max(0, Math.min(Math.floor(rows) || 0, MAX_ROWS - 1));
    const c = Math.max(0, Math.min(Math.floor(cols) || 0, MAX_COLS - 1));
    return r === s.freeze.rows && c === s.freeze.cols ? s : { ...s, freeze: { rows: r, cols: c } };
  });
}

// ----------------------------------------------------------------------------------------------
// Copy, paste, fill, sort

/**
 * What copying puts on Blob's own clipboard: the source cells row by row (null = empty). `rows`:
 * each line's row in the source, when the copy left rows of the area out (the ones a smart
 * table's filter hides, as Excel does); without it the lines are area.r0, area.r0 + 1, …
 */
export type ClipData = { sheetId: string; area: Area; cells: (Cell | null)[][]; rows?: number[] };

/** The row of the source a clip's line `i` comes from. */
const clipRow = (clip: ClipData, i: number) => clip.rows?.[i] ?? clip.area.r0 + i;

/**
 * Copy an area. `rows`: only these rows of it, in this order (the ones a filter shows); the
 * lines then sit next to each other and remember where they came from (ClipData.rows), so a
 * pasted formula still points where it did.
 */
export function copyArea(wb: Workbook, sheetId: string, area: Area, rows?: number[]): ClipData {
  const sheet = sheetById(wb, sheetId);
  const a = { r0: Math.min(area.r0, area.r1), c0: Math.min(area.c0, area.c1), r1: Math.max(area.r0, area.r1), c1: Math.max(area.c0, area.c1) };
  const kept = rows?.filter((r) => r >= a.r0 && r <= a.r1);
  // Every row of the area (or none): a plain copy.
  const some = kept && kept.length && kept.length < a.r1 - a.r0 + 1 ? kept : null;
  const cells: (Cell | null)[][] = [];
  const line = (r: number) => {
    const out: (Cell | null)[] = [];
    for (let c = a.c0; c <= a.c1; c++) out.push(sheet?.cells[cellKey(r, c)] ?? null);
    return out;
  };
  if (some) for (const r of some) cells.push(line(r));
  else for (let r = a.r0; r <= a.r1; r++) cells.push(line(r));
  return some ? { sheetId, area: a, cells, rows: some } : { sheetId, area: a, cells };
}

export type PasteMode = "all" | "values" | "formats" | "formulas";

/** A calculated value as something a cell can hold (an error stays an error, as a tiny formula). */
function valueCell(v: CellValue): Pick<Cell, "v" | "f"> {
  if (v === null) return {};
  if (isError(v)) return { f: v.error };
  return { v };
}

/**
 * Paste a clip with its top-left at target's top-left. Formulas shift by the distance from the
 * source, like Excel (each from its own row when the copy left rows out); "values" pastes
 * calculated values (from calc, or `values`: the clip's cells' values, line by line, as they were
 * when copied); "formats" only looks. `cut`: move instead (the source is cleared, references to it
 * anywhere follow the cells; always the whole area). When the target area is a whole multiple of
 * the clip's size, the clip repeats to fill it. `toRows`: the sheet rows the target is made of,
 * top to bottom, when they don't follow each other (a paste leaves out the rows a smart table's
 * filter hides; a copy pasted back where it came from goes back to its own rows); the target is
 * then as tall as that list.
 */
export function pasteClip(wb: Workbook, calc: Calc, sheetId: string, target: Area, clip: ClipData, opts: { mode: PasteMode; transpose?: boolean; cut?: boolean; toRows?: readonly number[]; values?: readonly (readonly CellValue[])[] }): Workbook {
  const h = clip.cells.length;
  const w = clip.cells[0]?.length ?? 0;
  if (!h || !w) return wb;
  const dest = sheetById(wb, sheetId);
  if (!dest) return wb;
  const t = { r0: Math.min(target.r0, target.r1), c0: Math.min(target.c0, target.c1), r1: Math.max(target.r0, target.r1), c1: Math.max(target.c0, target.c1) };
  // A cut whose sheet is gone meanwhile can't move anything: paste what was copied instead.
  if (opts.cut && sheetById(wb, clip.sheetId)) return moveCells(wb, clip, sheetId, { row: t.r0, col: t.c0 });
  const transpose = !!opts.transpose;
  const H = transpose ? w : h;
  const W = transpose ? h : w;
  const toRows = opts.toRows;
  const th = toRows ? toRows.length : t.r1 - t.r0 + 1;
  const tw = t.c1 - t.c0 + 1;
  const reps = th % H === 0 && tw % W === 0 ? { r: th / H, c: tw / W } : { r: 1, c: 1 };
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  for (let rr = 0; rr < reps.r; rr++) {
    for (let rc = 0; rc < reps.c; rc++) {
      for (let i = 0; i < H; i++) {
        for (let j = 0; j < W; j++) {
          const si = transpose ? j : i;
          const sj = transpose ? i : j;
          const src = clip.cells[si][sj];
          const srcRow = clipRow(clip, si);
          const srcCol = clip.area.c0 + sj;
          const row = toRows ? toRows[rr * H + i] : t.r0 + rr * H + i;
          const col = t.c0 + rc * W + j;
          if (row === undefined || row >= MAX_ROWS || col >= MAX_COLS) continue;
          const existing = dest.cells[cellKey(row, col)];
          const shifted = (c: Cell): Cell => {
            if (c.f === undefined) return c;
            return { ...c, f: transpose ? transposeFormula(c.f, srcRow, srcCol, row, col) : shiftFormula(c.f, row - srcRow, col - srcCol) };
          };
          let cell: Cell | null;
          switch (opts.mode) {
            case "all":
              cell = src ? shifted(src) : null;
              break;
            case "formulas":
              cell = { ...(src ? shifted({ v: src.v, f: src.f }) : {}), s: existing?.s, note: existing?.note };
              break;
            case "values": {
              const val = src?.f === undefined ? (src?.v ?? null) : opts.values ? (opts.values[si]?.[sj] ?? null) : calc.value(clip.sheetId, srcRow, srcCol);
              const fmt = src?.s?.fmt;
              cell = { ...valueCell(val), s: fmt ? { ...existing?.s, fmt } : existing?.s, note: existing?.note };
              break;
            }
            case "formats":
              cell = existing || src?.s ? { ...existing, s: src?.s } : null;
              break;
          }
          updates.push({ row, col, cell });
        }
      }
    }
  }
  return setCells(wb, sheetId, updates);
}

/** Cut and paste: the cells move, and every reference to them follows (charts and tables too). Logged as `head` in both sheets. */
function moveCells(wb: Workbook, clip: ClipData, toSheetId: string, to: Pos, head: OpHead = freshHead()): Workbook {
  const src = sheetById(wb, clip.sheetId);
  const dst = sheetById(wb, toSheetId);
  if (!src || !dst) return wb;
  const from = clip.area;
  if (from.r0 === to.row && from.c0 === to.col && clip.sheetId === toSheetId) return wb;
  const h = from.r1 - from.r0;
  const w = from.c1 - from.c0;
  if (to.row + h >= MAX_ROWS || to.col + w >= MAX_COLS || to.row < 0 || to.col < 0) return wb;
  const change: StructuralChange = { kind: "move", sheet: src.name, from, toSheet: dst.name, to };
  // The cells being moved, as they are now (their formulas adjusted as moved formulas).
  const moving: { row: number; col: number; cell: Cell }[] = [];
  for (let r = from.r0; r <= from.r1; r++) {
    for (let c = from.c0; c <= from.c1; c++) {
      const cell = src.cells[cellKey(r, c)];
      if (!cell) continue;
      const moved = cell.f !== undefined ? { ...cell, f: adjustMovedFormula(cell.f, src.name, dst.name, change) } : cell;
      moving.push({ row: r - from.r0 + to.row, col: c - from.c0 + to.col, cell: moved });
    }
  }
  // Every other formula follows the move.
  let next = mapFormulas(wb, (host, f, key) => {
    if (host.id === clip.sheetId) {
      const p = parseKey(key);
      if (inArea(from, p.row, p.col)) return f; // replaced below
    }
    return adjustFormula(f, host.name, change);
  });
  // Clear the source, then write the destination.
  const clearSrc: { row: number; col: number; cell: null }[] = [];
  for (let r = from.r0; r <= from.r1; r++) for (let c = from.c0; c <= from.c1; c++) clearSrc.push({ row: r, col: c, cell: null });
  next = setCells(next, clip.sheetId, clearSrc);
  const destArea: Area = { r0: to.row, c0: to.col, r1: to.row + h, c1: to.col + w };
  const writes: { row: number; col: number; cell: Cell | null }[] = [];
  const movedKeys = new Set(moving.map((m) => cellKey(m.row, m.col)));
  for (let r = destArea.r0; r <= destArea.r1; r++) for (let c = destArea.c0; c <= destArea.c1; c++) if (!movedKeys.has(cellKey(r, c))) writes.push({ row: r, col: c, cell: null });
  for (const m of moving) writes.push(m);
  next = setCells(next, toSheetId, writes);
  // Charts and tables whose ranges lie inside the moved cells go with them.
  const inside = (a: RangeRef) => a.sheetId === clip.sheetId && a.r0 >= from.r0 && a.r1 <= from.r1 && a.c0 >= from.c0 && a.c1 <= from.c1;
  const follow = <T extends RangeRef>(ref: T): T => (inside(ref) ? { ...ref, sheetId: toSheetId, r0: ref.r0 - from.r0 + to.row, r1: ref.r1 - from.r0 + to.row, c0: ref.c0 - from.c0 + to.col, c1: ref.c1 - from.c0 + to.col } : ref);
  const charts = adjustCharts(next.charts, follow);
  const tables = next.tables.map((t) => {
    const ref = { ...t.area, sheetId: t.sheetId };
    if (!inside(ref)) return t;
    const moved = follow(ref);
    return { ...t, sheetId: toSheetId, area: { r0: moved.r0, c0: moved.c0, r1: moved.r1, c1: moved.c1 } };
  });
  const op: SheetOp = { ...head, kind: "move", src: clip.sheetId, from: { r0: from.r0, c0: from.c0, r1: from.r1, c1: from.c1 }, dst: toSheetId, to: { row: to.row, col: to.col } };
  return logOp({ ...next, charts, tables }, [clip.sheetId, toSheetId], op);
}

/**
 * Paste text from outside Blob (Excel, Google Sheets, a web table): each piece parsed like typing.
 * `asText`: the pieces the copy says are text (a text cell from Excel, LibreOffice, Google Sheets
 * or another Blob tab): those stay as they are written, so the sample ID 007 isn't the number 7.
 * `toRows`: the sheet row of each line, when they don't follow each other from at.row (a paste
 * leaves out the rows a smart table's filter hides).
 */
export function pasteText(wb: Workbook, sheetId: string, at: Pos, rows: string[][], locale: Locale, asText?: readonly (readonly boolean[])[] | null, toRows?: readonly number[] | null): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  rows.forEach((line, i) => {
    line.forEach((text, j) => {
      const row = toRows?.[i] ?? at.row + i;
      const col = at.col + j;
      if (row >= MAX_ROWS || col >= MAX_COLS) return;
      const existing = sheet.cells[cellKey(row, col)];
      const p: ParsedInput = asText?.[i]?.[j] ? { cell: text === "" ? {} : { v: text } } : parseInput(text, locale, existing);
      const content: Pick<Cell, "v" | "f"> = p.error ? { v: text } : p.cell;
      const fmt = typedFormat(existing?.s?.fmt, p.fmt);
      const s = fmt !== existing?.s?.fmt ? { ...existing?.s, fmt } : existing?.s;
      updates.push({ row, col, cell: { v: content.v, f: content.f, s, note: existing?.note } });
    });
  });
  return setCells(wb, sheetId, updates);
}

/**
 * The fill handle: extend `from` to cover `to` (a bigger area in one direction, containing `from`).
 * Like Excel: one number copies, two or more continue their step (1, 2 → 3, 4; 0,5 1 → 1,5);
 * dates continue by day (or month/year when the step is one); "Probe 1" → "Probe 2"; weekday and
 * month names continue (in German and English); formulas shift; styles copy. Filling up or left
 * runs the series backwards.
 */
export function fillArea(wb: Workbook, calc: Calc, sheetId: string, from: Area, to: Area, locale: Locale): Workbook {
  void calc;
  void locale;
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const f = { r0: Math.min(from.r0, from.r1), c0: Math.min(from.c0, from.c1), r1: Math.max(from.r0, from.r1), c1: Math.max(from.c0, from.c1) };
  const t = { r0: Math.min(to.r0, to.r1), c0: Math.min(to.c0, to.c1), r1: Math.max(to.r0, to.r1), c1: Math.max(to.c0, to.c1) };
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  const get = (r: number, c: number) => sheet.cells[cellKey(r, c)];
  if (t.r1 > f.r1 || t.r0 < f.r0) {
    const down = t.r1 > f.r1;
    for (let c = f.c0; c <= f.c1; c++) {
      const src: (Cell | undefined)[] = [];
      for (let r = f.r0; r <= f.r1; r++) src.push(get(r, c));
      const gen = seriesOf(src, { rows: 1, cols: 0 });
      if (down) for (let r = f.r1 + 1; r <= t.r1; r++) updates.push({ row: r, col: c, cell: gen(r - f.r0) });
      else for (let r = f.r0 - 1; r >= t.r0; r--) updates.push({ row: r, col: c, cell: gen(r - f.r0) });
    }
  } else if (t.c1 > f.c1 || t.c0 < f.c0) {
    const right = t.c1 > f.c1;
    for (let r = f.r0; r <= f.r1; r++) {
      const src: (Cell | undefined)[] = [];
      for (let c = f.c0; c <= f.c1; c++) src.push(get(r, c));
      const gen = seriesOf(src, { rows: 0, cols: 1 });
      if (right) for (let c = f.c1 + 1; c <= t.c1; c++) updates.push({ row: r, col: c, cell: gen(c - f.c0) });
      else for (let c = f.c0 - 1; c >= t.c0; c--) updates.push({ row: r, col: c, cell: gen(c - f.c0) });
    }
  } else return wb;
  // Notes stay where they were (Excel copies them, but a note belongs to one measurement).
  for (const u of updates) {
    const note = get(u.row, u.col)?.note;
    if (u.cell) u.cell = { ...u.cell, note };
    else if (note) u.cell = { note };
  }
  return setCells(wb, sheetId, updates.filter((u) => u.row >= 0 && u.col >= 0));
}

export type SortKey = { col: number; dir: "asc" | "desc" };

/** Excel's sort order: numbers < text < FALSE < TRUE < errors (reversed for descending); empty always last. */
function sortCompare(a: CellValue, b: CellValue, dir: "asc" | "desc", collator: Intl.Collator): number {
  const empty = (v: CellValue) => v === null || v === "";
  if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : empty(a) ? 1 : -1;
  const rank = (v: CellValue) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : 3);
  const ra = rank(a);
  const rb = rank(b);
  let c: number;
  if (ra !== rb) c = ra - rb;
  else if (typeof a === "number") c = a - (b as number);
  else if (typeof a === "string") c = collator.compare(a, b as string);
  else if (typeof a === "boolean") c = Number(a) - Number(b);
  else c = 0;
  return dir === "asc" ? c : -c;
}

/**
 * Sort the rows of an area by one or more columns, like Excel: numbers before text before
 * true/false, empty cells last either way, text compared in the user's language. Whole rows of
 * the area move with their formulas (relative references shift with the row).
 */
export function sortArea(wb: Workbook, calc: Calc, sheetId: string, area: Area, keys: SortKey[], locale: Locale): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || !keys.length) return wb;
  const a = { r0: Math.min(area.r0, area.r1), c0: Math.min(area.c0, area.c1), r1: Math.max(area.r0, area.r1), c1: Math.max(area.c0, area.c1) };
  const collator = new Intl.Collator(locale, { sensitivity: "accent", numeric: false });
  const rows: { row: number; keys: CellValue[] }[] = [];
  for (let r = a.r0; r <= a.r1; r++) rows.push({ row: r, keys: keys.map((k) => calc.value(sheetId, r, k.col)) });
  const sorted = rows.slice().sort((x, y) => {
    for (let i = 0; i < keys.length; i++) {
      const c = sortCompare(x.keys[i], y.keys[i], keys[i].dir, collator);
      if (c !== 0) return c;
    }
    return 0;
  });
  if (sorted.every((x, i) => x.row === a.r0 + i)) return wb;
  // Logged as the new order of the rows, not as "sorted by B": another version is put in the
  // same order (replayOp), whatever its values are.
  return permuteRows(wb, sheetId, { id: newId(), kind: "sort", r0: a.r0, c0: a.c0, c1: a.c1, order: sorted.map((x) => x.row - a.r0) });
}

/** The rows of a block in a new order (a sort, or one done again): their formulas move along with them. */
function permuteRows(wb: Workbook, sheetId: string, op: Extract<SheetOp, { kind: "sort" }>): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const updates: { row: number; col: number; cell: Cell | null }[] = [];
  op.order.forEach((from, i) => {
    if (from === i) return;
    const src = op.r0 + from;
    const row = op.r0 + i;
    for (let c = op.c0; c <= op.c1; c++) {
      const cell = sheet.cells[cellKey(src, c)];
      updates.push({ row, col: c, cell: cell ? (cell.f !== undefined ? { ...cell, f: shiftFormula(cell.f, row - src, 0) } : cell) : null });
    }
  });
  return logOp(setCells(wb, sheetId, updates), [sheetId], op);
}

// ----------------------------------------------------------------------------------------------
// Doing a logged change again

/**
 * A change from the log of sheet `sheetId` (src/sheet/sheetLog.ts) done again on another version
 * of the workbook, logged there with the same id: merging lines two versions up with it
 * (collab.ts), undo and redo take changes back with it. Only the rows, columns and cells move,
 * with everything that points at them; what a smart table did on top (keeping its last data row,
 * names for new header cells) was a change of cells and comes with the cells. null when it can't
 * be done on this version: a sheet is missing, or data would be pushed off the grid.
 */
export function replayOp(wb: Workbook, sheetId: string, op: SheetOp): Workbook | null {
  switch (op.kind) {
    case "insertRows":
    case "deleteRows":
    case "insertCols":
    case "deleteCols": {
      const next = rowColChange(wb, sheetId, { kind: op.kind, at: op.at, count: op.count }, headOf(op));
      if (next === wb) return null;
      return op.kind === "insertRows" || op.kind === "deleteRows" ? refreshTotals(next, sheetId) : next;
    }
    case "sort":
      return sheetById(wb, sheetId) ? permuteRows(wb, sheetId, op) : null;
    case "move": {
      if (!sheetById(wb, op.src) || !sheetById(wb, op.dst)) return null;
      const next = moveCells(wb, copyArea(wb, op.src, op.from), op.dst, op.to, headOf(op));
      return next === wb ? null : next;
    }
    case "barrier":
      return null;
  }
}

// ----------------------------------------------------------------------------------------------
// Find and replace

export type FindOptions = { sheetId?: string; matchCase?: boolean; wholeCell?: boolean; inFormulas?: boolean };

/**
 * The query as a test: * and ? are wildcards (like Excel's find), ~ escapes them. Matched without
 * a RegExp (src/sheet/engine/glob.ts), so no query can freeze the page.
 */
function finder(query: string, opts: FindOptions): { found: (text: string) => boolean; replace: (text: string, by: string) => string } {
  const glob: Glob = compileGlob(query, { matchCase: opts.matchCase });
  if (opts.wholeCell) return { found: (text) => globTest(glob, text), replace: (text, by) => (globTest(glob, text) ? by : text) };
  return { found: (text) => globTest(glob, text, "contains"), replace: (text, by) => globReplace(glob, text, by) };
}

function sortedKeys(sheet: Sheet): { key: string; row: number; col: number }[] {
  return Object.keys(sheet.cells)
    .map((key) => ({ key, ...parseKey(key) }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Cells whose shown text (or formula, with inFormulas) contains the query, sheet by sheet, row by row. */
export function findCells(wb: Workbook, calc: Calc, query: string, opts: FindOptions, locale: Locale): { sheetId: string; row: number; col: number }[] {
  if (!query) return [];
  const match = finder(query, opts);
  const out: { sheetId: string; row: number; col: number }[] = [];
  for (const sheet of wb.sheets) {
    if (opts.sheetId && sheet.id !== opts.sheetId) continue;
    for (const { key, row, col } of sortedKeys(sheet)) {
      const cell = sheet.cells[key];
      if (cell.v === undefined && cell.f === undefined) continue;
      const text = opts.inFormulas ? editText(cell, locale).replace(/^'/, "") : formatValue(calc.value(sheet.id, row, col), cell.s?.fmt, locale);
      if (match.found(text)) out.push({ sheetId: sheet.id, row, col });
    }
  }
  return out;
}

/** Replace in typed values (and formulas with inFormulas); returns the workbook and how many cells changed. */
export function replaceCells(wb: Workbook, calc: Calc, query: string, replacement: string, opts: FindOptions, locale: Locale): { wb: Workbook; count: number } {
  void calc;
  if (!query) return { wb, count: 0 };
  const match = finder(query, opts);
  let next = wb;
  let count = 0;
  for (const sheet of wb.sheets) {
    if (opts.sheetId && sheet.id !== opts.sheetId) continue;
    const updates: { row: number; col: number; cell: Cell | null }[] = [];
    for (const { key, row, col } of sortedKeys(sheet)) {
      const cell = sheet.cells[key];
      if (cell.f !== undefined) {
        if (!opts.inFormulas) continue;
        const local = toLocalFormula(cell.f, locale);
        if (!match.found(local)) continue;
        const replaced = match.replace(local, replacement);
        const r = toCanonicalFormula(replaced, locale);
        if ("error" in r || r.formula === cell.f) continue;
        updates.push({ row, col, cell: { ...cell, f: r.formula } });
        count++;
        continue;
      }
      if (cell.v === undefined) continue;
      const text = typeof cell.v === "string" ? cell.v : editText({ v: cell.v, s: cell.s }, locale);
      if (!match.found(text)) continue;
      const replaced = match.replace(text, replacement);
      if (replaced === text) continue;
      const p = typeof cell.v === "string" && cell.s?.fmt?.kind === "text" ? { cell: { v: replaced } } : parseInput(replaced, locale, cell);
      const content: Pick<Cell, "v" | "f"> = "error" in p && p.error ? { v: replaced } : p.cell;
      updates.push({ row, col, cell: { ...cell, v: content.v, f: content.f } });
      count++;
    }
    if (updates.length) next = setCells(next, sheet.id, updates);
  }
  return { wb: next, count };
}

// ----------------------------------------------------------------------------------------------
// Sheets (tabs)

const sheetBase = (locale: Locale) => (locale === "de" ? "Blatt" : "Sheet");
const nameTaken = (wb: Workbook, name: string, except?: string) => wb.sheets.some((s) => s.id !== except && s.name.toLowerCase() === name.toLowerCase());

/** A new empty sheet after the others (or at `at`), named uniquely ("Blatt 2" / "Sheet 2"). */
export function addSheet(wb: Workbook, locale: Locale, name?: string, at?: number): { wb: Workbook; sheetId: string } {
  let finalName: string;
  const wanted = name?.trim();
  if (wanted && validSheetName(wanted)) finalName = uniqueSheetName(wb, wanted);
  else {
    let n = wb.sheets.length + 1;
    while (nameTaken(wb, `${sheetBase(locale)} ${n}`)) n++;
    finalName = `${sheetBase(locale)} ${n}`;
  }
  const sheet: Sheet = { id: newId(), name: finalName, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { ...DEFAULT_SIZE } };
  const i = at === undefined ? wb.sheets.length : Math.max(0, Math.min(wb.sheets.length, Math.floor(at)));
  const sheets = [...wb.sheets.slice(0, i), sheet, ...wb.sheets.slice(i)];
  return { wb: { ...wb, sheets }, sheetId: sheet.id };
}

/** Formulas that point at the old name follow. */
export function renameSheet(wb: Workbook, sheetId: string, name: string): Workbook {
  const sheet = sheetById(wb, sheetId);
  const to = name.trim();
  if (!sheet || !validSheetName(to) || to === sheet.name || nameTaken(wb, to, sheetId)) return wb;
  const change: StructuralChange = { kind: "renameSheet", from: sheet.name, to };
  const renamed = updateSheet(wb, sheetId, (s) => ({ ...s, name: to }));
  return mapFormulas(renamed, (host, f) => (mayName(f, sheet.name) ? adjustFormula(f, host.name, change) : f));
}

/**
 * Sheet names in formulas rewritten all at once, as merging needs it (collab.ts): `names` maps a
 * name (in lower case: formulas compare names without case) to the name it stands for now, or to
 * null when references to it become #REF!. In one pass, so two sheets that swapped names stay apart.
 */
export function renameInFormulas(wb: Workbook, names: ReadonlyMap<string, string | null>): Workbook {
  return names.size ? mapFormulas(wb, (_host, f) => renameSheetRefs(f, names)) : wb;
}

/** One formula with sheet names rewritten as renameInFormulas does (the same text when it names none of them). */
export function renameSheetRefs(f: string, names: ReadonlyMap<string, string | null>): string {
  for (const n of names.keys()) {
    if (!mayName(f, n)) continue;
    return rewriteRefs(f, (ref) => {
      const to = ref.sheet === null ? undefined : names.get(ref.sheet.toLowerCase());
      return to === undefined || to === null ? to : { ...ref, sheet: to };
    });
  }
  return f;
}

/** Never the last sheet. Its charts and tables go too; references to it become #REF!. */
export function deleteSheet(wb: Workbook, sheetId: string): Workbook {
  return wb.sheets.length <= 1 ? wb : withoutSheet(wb, sheetId);
}

/**
 * What deleting a sheet does, also to the last one: merging compares with it (collab.ts), where a
 * sheet one side deleted is kept because the other side changed it.
 */
export function withoutSheet(wb: Workbook, sheetId: string): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const change: StructuralChange = { kind: "deleteSheet", sheet: sheet.name };
  const rest: Workbook = { ...wb, sheets: wb.sheets.filter((s) => s.id !== sheetId), charts: wb.charts.filter((c) => c.sheetId !== sheetId), tables: wb.tables.filter((t) => t.sheetId !== sheetId) };
  const next = mapFormulas(rest, (host, f) => (mayName(f, sheet.name) ? adjustFormula(f, host.name, change) : f));
  const charts = adjustCharts(next.charts, (ref) => (ref.sheetId === sheetId ? null : ref));
  return { ...next, charts };
}

export function moveSheet(wb: Workbook, sheetId: string, toIndex: number): Workbook {
  const from = wb.sheets.findIndex((s) => s.id === sheetId);
  if (from < 0) return wb;
  const to = Math.max(0, Math.min(wb.sheets.length - 1, Math.floor(toIndex)));
  if (to === from) return wb;
  const sheets = wb.sheets.slice();
  const [s] = sheets.splice(from, 1);
  sheets.splice(to, 0, s);
  return { ...wb, sheets };
}

/** A copy right after it ("Blatt 1 (2)"), with its charts and tables. */
export function duplicateSheet(wb: Workbook, sheetId: string): { wb: Workbook; sheetId: string } {
  const i = wb.sheets.findIndex((s) => s.id === sheetId);
  if (i < 0) return { wb, sheetId };
  return copySheetInto(wb, wb, sheetId, uniqueSheetName(wb, wb.sheets[i].name), i + 1);
}

/**
 * A copy of sheet `sheetId` of workbook `from`, with its charts and tables (new ids, table names
 * made unique: "Standards2", "BSA_2"), put into `wb` at tab position `at` and called `name`.
 * duplicateSheet copies within one workbook; merging keeps my version of a sheet this way when
 * both people moved its rows at once (collab.ts).
 */
export function copySheetInto(wb: Workbook, from: Workbook, sheetId: string, name: string, at: number): { wb: Workbook; sheetId: string } {
  const sheet = sheetById(from, sheetId);
  if (!sheet) return { wb, sheetId };
  let copy: Sheet = { ...sheet, id: newId(), name };
  // Its log of rows and columns stays with the original: the copy starts without a history (and
  // isn't a copy merging made: collab.ts marks those itself).
  delete copy.log;
  delete copy.copyOf;
  // Formulas on it that name its own sheet name the copy, as in Excel: they read the copy's cells.
  if (name.toLowerCase() !== sheet.name.toLowerCase()) copy = renameInFormulas({ v: 1, sheets: [copy], charts: [], tables: [] }, new Map([[sheet.name.toLowerCase(), name]])).sheets[0];
  const i = Math.max(0, Math.min(wb.sheets.length, at));
  const sheets = [...wb.sheets.slice(0, i), copy, ...wb.sheets.slice(i)];
  const onCopy = <T extends RangeRef>(ref: T): T => (ref.sheetId === sheetId ? { ...ref, sheetId: copy.id } : ref);
  const charts = from.charts
    .filter((c) => c.sheetId === sheetId)
    .map((c) => ({
      ...c,
      id: newId(),
      sheetId: copy.id,
      x: c.x ? onCopy(c.x) : null,
      series: c.series.map((s) => ({
        ...s,
        id: newId(),
        y: onCopy(s.y),
        x: s.x ? onCopy(s.x) : null,
        nameRef: s.nameRef ? onCopy(s.nameRef) : null,
        errorBars: s.errorBars ? { ...s.errorBars, plus: s.errorBars.plus ? onCopy(s.errorBars.plus) : null, minus: s.errorBars.minus ? onCopy(s.errorBars.minus) : null } : null,
      })),
    }));
  let next: Workbook = { ...wb, sheets, charts: [...wb.charts, ...charts] };
  for (const t of from.tables.filter((t) => t.sheetId === sheetId)) {
    const ids = new Map(t.columns.map((c) => [c.id, newId()]));
    const table: TableSpec = {
      ...t,
      id: newId(),
      sheetId: copy.id,
      // (Stored names are always valid, so the language of a made-up one never matters.)
      name: freeTableName(next.tables.map((x) => x.name), "de", t.name),
      columns: t.columns.map((c) => ({ ...c, id: ids.get(c.id)! })),
      filters: Object.fromEntries(Object.entries(t.filters).map(([id, f]) => [ids.get(id) ?? id, f])),
      sort: t.sort ? { ...t.sort, column: ids.get(t.sort.column) ?? t.sort.column } : null,
    };
    next = { ...next, tables: [...next.tables, table] };
  }
  return { wb: next, sheetId: copy.id };
}

/** base, or base + " (2)", " (3)"… not used yet (case-insensitive). */
export function uniqueSheetName(wb: Workbook, base: string): string {
  const b = base.trim().slice(0, 31) || "Blatt";
  if (!nameTaken(wb, b)) return b;
  const m = /^(.*) \((\d+)\)$/.exec(b);
  const root = m ? m[1] : b;
  let n = m ? Number(m[2]) + 1 : 2;
  for (;;) {
    const suffix = ` (${n})`;
    const candidate = root.slice(0, 31 - suffix.length) + suffix;
    if (!nameTaken(wb, candidate)) return candidate;
    n++;
  }
}

/** 1–31 characters, none of []:*?/\ and not starting or ending with '. */
export function validSheetName(name: string): boolean {
  if (typeof name !== "string") return false;
  if (name.length < 1 || name.length > 31 || !name.trim()) return false;
  if (/[[\]:*?/\\]/.test(name)) return false;
  return !name.startsWith("'") && !name.endsWith("'");
}
