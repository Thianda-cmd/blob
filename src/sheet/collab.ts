// Saving a spreadsheet that several people edit at once (like presentations, src/components/deck/collab.ts):
// each save names the revision it builds on; when someone else saved in between, merge cell by
// cell — whoever changed a cell (or a chart, a table, a sheet's settings) since the common base
// wins, and if both did, ours. Sheets, charts and tables added on either side are kept; deleted
// ones stay deleted.
//
// CONTRACT: keep names and signatures.
//
// How fine the merge is: a cell's content (value or formula), its look and its note are merged
// separately, so one person formatting a column while another types into it keeps both. Charts and
// their series, smart tables and sheets merge field by field (a chart moved by one person and
// renamed by the other keeps both changes). A smart table's shape (its area, columns and totals
// row) is one field, so it never ends up with columns that don't fit its area. Sheet sizes only
// grow by merging (the larger one wins when both changed), so nobody's cells end up off the grid.
//
// What it can't line up: inserting or deleting rows moves every cell below, so a cell typed by the
// other person at the same time in those rows may land a row off. Rare enough (both at once) to
// accept; the result is still a valid workbook (normalizeWorkbook at the end makes sure of that:
// charts on deleted sheets go, duplicate names get a number, sizes cover every cell).
//
// The store also uses this for undo while others edit: undoing merges (after, before, now), so only
// what the step changed goes back.

import { normalizeWorkbook } from "./doc";
import type { Cell, ChartSpec, SeriesSpec, Sheet, TableSpec, Workbook } from "./types";

/**
 * Deep equality of JSON values. Key order doesn't count (jsonb stores keys in its own order) and
 * a member that is undefined counts as missing.
 */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameJson(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const k in x) if (x[k] !== undefined && !sameJson(x[k], y[k])) return false;
  for (const k in y) if (y[k] !== undefined && x[k] === undefined) return false;
  return true;
}

/** Mine if I changed it since base, else theirs. */
const pick = <T>(base: T, mine: T, theirs: T): T => (sameJson(mine, base) ? theirs : mine);

/** Each key of an object: mine if I changed it since base, else theirs (a key may be missing on any side). */
function mergeFields<T extends object>(base: T | undefined, mine: T, theirs: T): T {
  if (!base) return mine;
  if (sameJson(mine, base)) return theirs;
  if (sameJson(theirs, base)) return mine;
  const b = base as Record<string, unknown>;
  const m = mine as Record<string, unknown>;
  const t = theirs as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(m), ...Object.keys(t), ...Object.keys(b)])) {
    const v = pick(b[k], m[k], t[k]);
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/**
 * The order of things that have ids: whoever reordered wins (mine first); things new on the other
 * side go after the one before them there, or at the end. `mineFirst`: all of mine, then what is
 * new on their side (for smart tables, where the earlier of two overlapping tables is kept).
 */
function mergeOrder(base: string[], mine: string[], theirs: string[], keep: Set<string>, mineFirst = false): string[] {
  if (mineFirst) {
    const order = mine.filter((id) => keep.has(id));
    const placed = new Set(order);
    for (const id of theirs) if (keep.has(id) && !placed.has(id)) order.push(id);
    return order;
  }
  const inBase = new Set(base);
  const inMine = new Set(mine);
  const reorderedByMe = !sameJson(
    mine.filter((id) => inBase.has(id)),
    base.filter((id) => inMine.has(id)),
  );
  const [primary, other] = reorderedByMe ? [mine, theirs] : [theirs, mine];
  const order = primary.filter((id) => keep.has(id));
  const placed = new Set(order);
  for (let i = 0; i < other.length; i++) {
    const id = other[i];
    if (!keep.has(id) || placed.has(id)) continue;
    let at = order.length;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(other[j]);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    order.splice(at, 0, id);
    placed.add(id);
  }
  return order;
}

/** Lists of things with ids: added on either side kept, deleted on either side gone, the rest merged. */
function mergeById<T extends { id: string }>(base: T[], mine: T[], theirs: T[], merge: (b: T | undefined, m: T, t: T) => T, preferMine = false): T[] {
  if (mine === base) return theirs;
  if (theirs === base || theirs === mine) return mine;
  const byId = (list: T[]) => new Map(list.map((x) => [x.id, x]));
  const b = byId(base);
  const m = byId(mine);
  const t = byId(theirs);
  const keep = new Set<string>();
  for (const id of [...m.keys(), ...t.keys()]) {
    // There before and now missing on one side: deleted there, so it stays deleted.
    if (b.has(id) && (!m.has(id) || !t.has(id))) continue;
    keep.add(id);
  }
  const order = mergeOrder(
    base.map((x) => x.id),
    mine.map((x) => x.id),
    theirs.map((x) => x.id),
    keep,
    preferMine,
  );
  return order.map((id) => {
    const mi = m.get(id);
    const ti = t.get(id);
    if (mi && ti) return mi === ti ? mi : merge(b.get(id), mi, ti);
    return (mi ?? ti)!;
  });
}

// Cells ----------------------------------------------------------------------------------------

const sameContent = (a: Cell | undefined, b: Cell | undefined) => a?.v === b?.v && a?.f === b?.f;
const sameCell = (a: Cell | undefined, b: Cell | undefined) => a === b || (!!a && !!b && sameContent(a, b) && a.note === b.note && sameJson(a.s, b.s));

/** One cell: its content (value or formula), look and note each from whoever changed it (both: mine). */
function mergeCell(b: Cell | undefined, m: Cell | undefined, t: Cell | undefined): Cell | undefined {
  if (sameCell(m, b)) return t;
  if (sameCell(t, b) || sameCell(t, m)) return m;
  const content = sameContent(m, b) ? t : m;
  const s = sameJson(m?.s, b?.s) ? t?.s : m?.s;
  const note = m?.note === b?.note ? t?.note : m?.note;
  const out: Cell = {};
  if (content?.v !== undefined) out.v = content.v;
  if (content?.f !== undefined) out.f = content.f;
  if (s) out.s = s;
  if (note) out.note = note;
  return out.v === undefined && out.f === undefined && !out.s && !out.note ? undefined : out;
}

function mergeCells(b: Record<string, Cell>, m: Record<string, Cell>, t: Record<string, Cell>): Record<string, Cell> {
  if (m === b) return t;
  if (t === b || t === m) return m;
  const out: Record<string, Cell> = {};
  for (const k in m) {
    const cell = mergeCell(b[k], m[k], t[k]);
    if (cell) out[k] = cell;
  }
  for (const k in t) {
    if (k in m) continue;
    const cell = mergeCell(b[k], undefined, t[k]);
    if (cell) out[k] = cell;
  }
  return out;
}

/** Column widths or row heights: each entry from whoever changed it. */
function mergeRecord<T>(b: Record<string, T>, m: Record<string, T>, t: Record<string, T>): Record<string, T> {
  if (m === b) return t;
  if (t === b || t === m) return m;
  const out: Record<string, T> = {};
  for (const k of new Set([...Object.keys(m), ...Object.keys(t), ...Object.keys(b)])) {
    const v = pick(b[k], m[k], t[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** A sheet's size: from whoever changed it; when both did, the larger (nobody's cells fall off the grid). */
const mergeSize = (b: number, m: number, t: number) => (m === b ? t : t === b ? m : Math.max(m, t));

const EMPTY_SHEET: Omit<Sheet, "id"> = { name: "", cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 0, cols: 0 } };

function mergeSheet(base: Sheet | undefined, m: Sheet, t: Sheet): Sheet {
  // New on both sides with the same id (two devices that opened the same empty page): both
  // sides' cells, mine first where they differ.
  const b: Sheet = base ?? { ...EMPTY_SHEET, id: m.id };
  if (m === b) return t;
  if (t === b) return m;
  return {
    id: m.id,
    name: pick(b.name, m.name, t.name),
    cells: mergeCells(b.cells, m.cells, t.cells),
    cols: mergeRecord(b.cols, m.cols, t.cols),
    rows: mergeRecord(b.rows, m.rows, t.rows),
    freeze: pick(b.freeze, m.freeze, t.freeze),
    size: { rows: mergeSize(b.size.rows, m.size.rows, t.size.rows), cols: mergeSize(b.size.cols, m.size.cols, t.size.cols) },
  };
}

// Charts and smart tables ----------------------------------------------------------------------

function mergeChart(b: ChartSpec | undefined, m: ChartSpec, t: ChartSpec): ChartSpec {
  if (!b) return m;
  if (sameJson(m, b)) return t;
  if (sameJson(t, b)) return m;
  return {
    id: m.id,
    sheetId: pick(b.sheetId, m.sheetId, t.sheetId),
    at: pick(b.at, m.at, t.at),
    size: pick(b.size, m.size, t.size),
    kind: pick(b.kind, m.kind, t.kind),
    title: pick(b.title, m.title, t.title),
    x: pick(b.x, m.x, t.x),
    series: mergeById<SeriesSpec>(b.series, m.series, t.series, mergeFields),
    xAxis: mergeFields(b.xAxis, m.xAxis, t.xAxis),
    yAxis: mergeFields(b.yAxis, m.yAxis, t.yAxis),
    legend: pick(b.legend, m.legend, t.legend),
  };
}

function mergeTable(b: TableSpec | undefined, m: TableSpec, t: TableSpec): TableSpec {
  if (!b) return m;
  if (sameJson(m, b)) return t;
  if (sameJson(t, b)) return m;
  // The area, its columns and the totals row belong together.
  const shape = (x: TableSpec) => ({ sheetId: x.sheetId, area: x.area, columns: x.columns, totals: x.totals });
  const s = sameJson(shape(m), shape(b)) ? t : m;
  return {
    id: m.id,
    sheetId: s.sheetId,
    name: pick(b.name, m.name, t.name),
    area: s.area,
    columns: s.columns,
    totals: s.totals,
    style: pick(b.style, m.style, t.style),
    banded: pick(b.banded, m.banded, t.banded),
    // Filters and sort of columns that are gone are dropped by normalizeWorkbook.
    filters: pick(b.filters, m.filters, t.filters),
    sort: pick(b.sort, m.sort, t.sort),
  };
}

// ----------------------------------------------------------------------------------------------

export function mergeWorkbooks(base: Workbook, mine: Workbook, theirs: Workbook): Workbook {
  if (mine === theirs || theirs === base) return mine;
  if (mine === base) return theirs;
  const merged: Workbook = {
    v: 1,
    sheets: mergeById(base.sheets, mine.sheets, theirs.sheets, mergeSheet),
    charts: mergeById(base.charts, mine.charts, theirs.charts, mergeChart),
    // Mine first: two tables made at the same place at once (they would overlap) keep mine.
    tables: mergeById(base.tables, mine.tables, theirs.tables, mergeTable, true),
  };
  // Both deleted the other's sheets: a workbook keeps at least one (theirs, as they saved it).
  if (!merged.sheets.length) merged.sheets = theirs.sheets.length ? theirs.sheets : mine.sheets;
  // Names only matter for sheets that come out without one (can't happen with valid input).
  const locale = merged.sheets.some((s) => /^Sheet \d+$/.test(s.name)) ? "en" : "de";
  return normalizeWorkbook(merged, locale);
}
