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
// Rows and columns that move: inserting or deleting rows or columns, sorting and cut and paste give
// cells other addresses, so comparing cell by address would put the other person's edits on the
// wrong rows. Each of these changes is written into the sheet's log (src/sheet/sheetLog.ts). Before
// the cells are compared, the versions are lined up: what only one side did to a sheet's rows and
// columns is done to the base and to the other side too (ops.ts replayOp; formulas, charts and
// tables follow as they did for the one who did it), so a value corrected in row 7 lands in row 8
// when the other person inserted a row above it. An edit in rows the other person deleted goes
// with them. Cells cut and pasted into a sheet that only one side has (added since the base) take
// the other side's edits of them along too: that side gets an empty stand-in for the new sheet
// while the versions are lined up. When both sides moved rows or columns of the same sheet, or
// what one side did can't be told (its log doesn't reach back to the base: content from before
// the log, a very long sort, more changes than the log keeps) or can't be done on the other
// version (cells cut and pasted into a sheet the other side deleted), nothing is guessed: their
// version of the sheet stays, mine is added next to it as a copy ("Blatt 1 (Konflikt)"), and the
// report says so. Whatever happens, the result is a valid workbook (normalizeWorkbook at the end
// makes sure of that: charts on deleted sheets go, duplicate names get a number, sizes cover every
// cell), and a copy never pushes another sheet out of a workbook that is full.
//
// The store uses this for undo while others edit too (takeBack): only what the step changed goes
// back, lined up the same way.

import type { Locale } from "@/i18n/config";
import { sheetCollabText } from "@/i18n/messages/sheetCollab";
import { normalizeWorkbook } from "./doc";
import { copySheetInto, newId, replayOp, sheetById } from "./ops";
import { capLog, inverseOp, netOps, opsSince } from "./sheetLog";
import { DEFAULT_SIZE, type Cell, type ChartSpec, type SeriesSpec, type Sheet, type SheetOp, type TableSpec, type Workbook } from "./types";

/**
 * What a merge had to do besides merging (saver.ts shows it): `conflicts` names each sheet whose
 * rows or columns both sides moved at once. That sheet (`sheetId`, `name`) is kept as theirs, and
 * mine is next to it as a new sheet (`copyId`, `copyName`). Both are "" when the workbook already
 * has as many sheets as it can hold: then there is no copy, and only their version is left.
 */
export type MergeReport = { conflicts: { sheetId: string; name: string; copyId: string; copyName: string }[] };

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

/** One sheet of lined-up versions; `log`: the merged log (see planSheet). */
function mergeSheet(base: Sheet | undefined, m: Sheet, t: Sheet, log: SheetOp[] | undefined): Sheet {
  // New on both sides with the same id (two devices that opened the same empty page): both
  // sides' cells, mine first where they differ.
  const b: Sheet = base ?? { ...EMPTY_SHEET, id: m.id };
  if (m === b) return withLog(t, log);
  if (t === b) return withLog(m, log);
  const merged: Sheet = {
    id: m.id,
    name: pick(b.name, m.name, t.name),
    cells: mergeCells(b.cells, m.cells, t.cells),
    cols: mergeRecord(b.cols, m.cols, t.cols),
    rows: mergeRecord(b.rows, m.rows, t.rows),
    freeze: pick(b.freeze, m.freeze, t.freeze),
    size: { rows: mergeSize(b.size.rows, m.size.rows, t.size.rows), cols: mergeSize(b.size.cols, m.size.cols, t.size.cols) },
  };
  return withLog(merged, log);
}

/** The sheet with `log` as its log (the same sheet when it has it already). */
function withLog(s: Sheet, log: SheetOp[] | undefined): Sheet {
  if (s.log === log) return s;
  if (log) return { ...s, log };
  const out = { ...s };
  delete out.log;
  return out;
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

// Lining the versions up ----------------------------------------------------------------------

/**
 * Why a sheet can't be lined up: both sides moved its rows or columns; what a side did to them
 * can't be told; a change can't be done on another version because a sheet it needs is gone, or
 * because it would push data off the end of the sheet.
 */
type Why = "moved" | "unknown" | "gone" | "full";

/** How the versions of one sheet are lined up before their cells are compared. */
type Plan = {
  /**
   * plain: nobody moved its rows or columns since the base (or both did the same); mine, theirs:
   * only that side did; conflict: it can't be lined up (`why`).
   */
  kind: "plain" | "mine" | "theirs" | "conflict";
  why?: Why;
  /** Changes both sides have, in front of their own (a draft that was saved after all): done to the base. */
  shared: SheetOp[];
  /** mine, theirs: what that side did (without the changes it took back again), done to the base and the other side. */
  ops: SheetOp[];
  /** Everything each side did since the base (null: can't be told). */
  mineRaw: SheetOp[] | null;
  theirsRaw: SheetOp[] | null;
  /** The merged sheet's log: both sides' entries, so either side's versions can be lined up with it later. */
  log: SheetOp[] | undefined;
};

/** Did `side` change sheet `id` since the base: its cells, rows, columns, frozen panes or size, or a chart or table on it (not its name or log)? */
function touched(base: Workbook, side: Workbook, id: string): boolean {
  const b = sheetById(base, id);
  const s = sheetById(side, id);
  if (!b || !s) return true;
  if (b !== s && !(sameJson(b.cells, s.cells) && sameJson(b.cols, s.cols) && sameJson(b.rows, s.rows) && sameJson(b.freeze, s.freeze) && sameJson(b.size, s.size))) return true;
  const on = <T extends { sheetId: string }>(list: T[]) => list.filter((x) => x.sheetId === id);
  return !sameJson(on(base.charts), on(side.charts)) || !sameJson(on(base.tables), on(side.tables));
}

function planSheet(base: Workbook, mine: Workbook, theirs: Workbook, id: string): Plan {
  const b = sheetById(base, id)?.log;
  const m = sheetById(mine, id)?.log;
  const t = sheetById(theirs, id)?.log;
  const mineRaw = opsSince(b, m);
  const theirsRaw = opsSince(b, t);
  const none = { shared: [], ops: [], mineRaw, theirsRaw };
  if (!mineRaw || !theirsRaw) {
    // What a side did to the rows can't be told: fine as long as one side left the sheet alone
    // (then its rows are the base's, and the other side's version of the sheet is taken).
    if (!touched(base, mine, id)) return { ...none, kind: "plain", log: t };
    if (!touched(base, theirs, id)) return { ...none, kind: "plain", log: m };
    return { ...none, kind: "conflict", why: "unknown", log: t };
  }
  let k = 0;
  while (k < mineRaw.length && k < theirsRaw.length && mineRaw[k].id === theirsRaw[k].id) k++;
  const shared = mineRaw.slice(0, k);
  const mRest = mineRaw.slice(k);
  const tRest = theirsRaw.slice(k);
  const mNet = netOps(mRest);
  const tNet = netOps(tRest);
  if (mNet.length && tNet.length) return { ...none, kind: "conflict", why: "moved", log: t };
  const plan = { shared, mineRaw, theirsRaw };
  if (mNet.length) return { ...plan, kind: "mine", ops: mNet, log: capLog([...(t ?? []), ...mRest]) };
  if (tNet.length) return { ...plan, kind: "theirs", ops: tNet, log: capLog([...(m ?? []), ...tRest]) };
  return { ...plan, kind: "plain", ops: [], log: !mRest.length ? t : !tRest.length ? m : capLog([...(t ?? []), ...mRest]) };
}

/** The ops of a plan that move cells between two sheets (in both sheets' logs). */
function crossMoves(p: Plan): SheetOp[] {
  const ops = p.kind === "conflict" ? [...(p.mineRaw ?? []), ...(p.theirsRaw ?? [])] : [...p.shared, ...p.ops];
  return ops.filter((op) => op.kind === "move" && op.src !== op.dst);
}

const role = (p: Plan, id: string) => (p.shared.some((op) => op.id === id) ? "shared" : p.ops.some((op) => op.id === id) ? "ops" : null);

/**
 * A move between two sheets is done once for both: both sheets are lined up the same way, or both
 * keep a copy. (A move both sides have already is only done to the base, however the rest of each
 * sheet is lined up. When the other sheet isn't on both sides, doing the move decides: it needs
 * that sheet, or its stand-in.)
 */
function closeOverMoves(plans: Map<string, Plan>, conflict: (id: string, why: Why) => Plan): void {
  for (let again = true; again; ) {
    again = false;
    for (const id of plans.keys()) {
      for (const op of crossMoves(plans.get(id)!)) {
        if (op.kind !== "move") continue;
        const p = plans.get(id)!;
        const other = op.src === id ? op.dst : op.src;
        const q = plans.get(other);
        if (!q) continue;
        const r = role(p, op.id);
        if (p.kind !== "conflict" && q.kind !== "conflict" && r === role(q, op.id) && (r === "shared" || q.kind === p.kind)) continue;
        if (p.kind !== "conflict") {
          plans.set(id, conflict(id, "moved"));
          again = true;
        }
        if (q.kind !== "conflict") {
          plans.set(other, conflict(other, "moved"));
          again = true;
        }
      }
    }
  }
}

/** A change that couldn't be done: the sheet whose list it is in, why, and the sheet that is about (a missing one, else that sheet). */
type Failed = { ok: false; sheetId: string; why: Why; about: string };
type Replayed = { ok: true; wb: Workbook } | Failed;

/**
 * Changes from sheets' logs (`lists`, by sheet id) done on a workbook, each once and in each
 * sheet's own order (a move between two sheets waits until it is next in both). A change that
 * needs a sheet the workbook doesn't have fails, or with `missing` "skip" is left out ("some": only
 * when it needs no sheet the workbook has). A change that fails names its sheet.
 */
function replayAll(wb: Workbook, lists: Map<string, SheetOp[]>, missing: "fail" | "some" | "skip" = "fail"): Replayed {
  const pos = new Map<string, number>();
  const holders = new Map<string, string[]>();
  for (const [id, ops] of lists) {
    pos.set(id, 0);
    for (const op of ops) holders.set(op.id, [...(holders.get(op.id) ?? []), id]);
  }
  const head = (id: string): SheetOp | undefined => lists.get(id)![pos.get(id)!];
  let next = wb;
  for (let progress = true; progress; ) {
    progress = false;
    for (const id of lists.keys()) {
      for (let op = head(id); op; op = head(id)) {
        const at = holders.get(op.id)!;
        if (at.some((h) => head(h)?.id !== op!.id)) break;
        const needs = op.kind === "move" ? [...new Set([op.src, op.dst])] : [id];
        const gone = needs.filter((s) => !sheetById(next, s));
        const skip = gone.length > 0 && (missing === "skip" || (missing === "some" && gone.length === needs.length));
        if (!skip) {
          const done = gone.length ? null : replayOp(next, id, op);
          if (!done) return { ok: false, sheetId: id, why: gone.length ? "gone" : "full", about: gone[0] ?? id };
          next = done;
        }
        for (const h of at) pos.set(h, pos.get(h)! + 1);
        progress = true;
      }
    }
  }
  // (Moves between two sheets in a different order in their logs: what happened can't be told.)
  for (const [id, ops] of lists) if (pos.get(id)! < ops.length) return { ok: false, sheetId: id, why: "unknown", about: id };
  return { ok: true, wb: next };
}

type Side = "base" | "mine" | "theirs";

/**
 * An empty sheet put into a version for lining up only (`into`: which), where one side cut and
 * pasted cells into or out of a sheet that is new since the base: the cells land in it on the
 * other version too, with that side's edits of them, so they can be merged as usual. On the base
 * it is the empty sheet the new one started as. A new sheet that side deleted again gets one on
 * every version: what was moved into it goes with it.
 */
type StandIn = { sheet: Sheet; into: Set<Side> };

/** The stand-ins the versions need, except for the sheets in `refused`. */
function standIns(base: Workbook, mine: Workbook, theirs: Workbook, refused: ReadonlySet<string>): Map<string, StandIn> {
  const out = new Map<string, StandIn>();
  const sides = [
    [mine, "mine", theirs, "theirs"],
    [theirs, "theirs", mine, "mine"],
  ] as const;
  for (const [side, sideName, other, otherName] of sides) {
    for (const s of side.sheets) {
      for (const op of opsSince(sheetById(base, s.id)?.log, s.log) ?? []) {
        if (op.kind !== "move" || op.src === op.dst) continue;
        for (const id of [op.src, op.dst]) {
          // Only for new sheets: one deleted since stays deleted, a move into it can't be lined up.
          if (sheetById(base, id) || refused.has(id)) continue;
          const own = sheetById(side, id);
          let st = out.get(id);
          if (!st) {
            // (A sheet's name only matters to formulas pointing into it.)
            st = { sheet: { id, name: own?.name ?? id, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { ...DEFAULT_SIZE } }, into: new Set() };
            out.set(id, st);
          }
          st.into.add("base");
          if (!own) st.into.add(sideName);
          if (!sheetById(other, id)) st.into.add(otherName);
        }
      }
    }
  }
  return out;
}

function withStandIns(wb: Workbook, stand: Map<string, StandIn>, which: Side): Workbook {
  const add = [...stand.values()].filter((st) => st.into.has(which)).map((st) => st.sheet);
  return add.length ? { ...wb, sheets: [...wb.sheets, ...add] } : wb;
}

type LinedUp = { base: Workbook; mine: Workbook; theirs: Workbook; plans: Map<string, Plan>; conflicts: string[]; stand: Map<string, StandIn> };

/** The three versions in the same rows and columns, sheet by sheet, and the sheets that can't be. */
function lineUp(base: Workbook, mine: Workbook, theirs: Workbook): LinedUp {
  const refused = new Set<string>();
  for (;;) {
    const stand = standIns(base, mine, theirs, refused);
    const lined = lineUpWith(withStandIns(base, stand, "base"), withStandIns(mine, stand, "mine"), withStandIns(theirs, stand, "theirs"), stand);
    // A new sheet that can't be lined up after all: once more without its stand-in (which would
    // otherwise be taken for the other side's version of it).
    const bad = [...stand.keys()].filter((id) => lined.plans.get(id)?.kind === "conflict");
    if (!bad.length) return lined;
    for (const id of bad) refused.add(id);
  }
}

function lineUpWith(base: Workbook, mine: Workbook, theirs: Workbook, stand: Map<string, StandIn>): LinedUp {
  const plans = new Map<string, Plan>();
  // (A sheet stood in for on both sides is nobody's: moves into it are done, it isn't lined up.)
  const nobodys = (id: string) => !!stand.get(id)?.into.has("mine") && !!stand.get(id)?.into.has("theirs");
  for (const s of mine.sheets) if (sheetById(theirs, s.id) && !nobodys(s.id)) plans.set(s.id, planSheet(base, mine, theirs, s.id));
  const conflict = (id: string, why: Why): Plan => ({ ...plans.get(id)!, kind: "conflict", why, shared: [], ops: [], log: sheetById(theirs, id)?.log });
  closeOverMoves(plans, conflict);
  for (;;) {
    // The base gets what both sides and what either side alone did; each side what the other did.
    const toBase = new Map<string, SheetOp[]>();
    const toMine = new Map<string, SheetOp[]>();
    const toTheirs = new Map<string, SheetOp[]>();
    for (const [id, p] of plans) {
      if (p.kind === "conflict") continue;
      if (p.shared.length || p.ops.length) toBase.set(id, [...p.shared, ...p.ops]);
      if (p.kind === "mine") toTheirs.set(id, p.ops);
      if (p.kind === "theirs") toMine.set(id, p.ops);
    }
    // (A sheet the base doesn't have is new on both sides: nothing to line up on the base there.)
    const b = replayAll(base, toBase, "some");
    const m = b.ok ? replayAll(mine, toMine) : b;
    const t = m.ok ? replayAll(theirs, toTheirs) : m;
    if (b.ok && m.ok && t.ok) {
      const conflicts = [...plans].filter(([, p]) => p.kind === "conflict").map(([id]) => id);
      return { base: b.wb, mine: m.wb, theirs: t.wb, plans, conflicts, stand };
    }
    // A change that can't be done on another version (a sheet it needs is gone there, or data
    // would be pushed off the grid): that sheet can't be lined up either.
    const failed = [b, m, t].find((r): r is Failed => !r.ok)!;
    plans.set(failed.sheetId, conflict(failed.sheetId, failed.why));
    closeOverMoves(plans, conflict);
  }
}

/** Mine, with the sheets `ids` and the charts and tables on them as in theirs. */
function takeTheirs(mine: Workbook, theirs: Workbook, ids: ReadonlySet<string>): Workbook {
  const on = (x: { sheetId: string }) => ids.has(x.sheetId);
  const swap = <T extends { id: string; sheetId: string }>(m: T[], t: T[]): T[] => {
    const byId = new Map(t.map((x) => [x.id, x]));
    const out = m.flatMap((x) => {
      if (!on(x)) return [x];
      const other = byId.get(x.id);
      return other && on(other) ? [other] : [];
    });
    const have = new Set(out.map((x) => x.id));
    for (const x of t) if (on(x) && !have.has(x.id)) out.push(x);
    return out;
  };
  return {
    ...mine,
    sheets: mine.sheets.map((s) => (ids.has(s.id) ? (sheetById(theirs, s.id) ?? s) : s)),
    charts: swap(mine.charts, theirs.charts),
    tables: swap(mine.tables, theirs.tables),
  };
}

/** "Blatt 1 (Konflikt)", "Blatt 1 (Konflikt 2)"…: a name no sheet has yet, at most 31 characters. */
function conflictName(wb: Workbook, name: string, locale: Locale): string {
  const taken = new Set(wb.sheets.map((s) => s.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const suffix = sheetCollabText[locale].conflictSuffix(n);
    const candidate = name.slice(0, 31 - suffix.length).trimEnd() + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** The language of names made up while merging, when the caller doesn't say: English when a sheet has an English default name. */
const guessLocale = (wb: Workbook): Locale => (wb.sheets.some((s) => /^Sheet \d+$/.test(s.name)) ? "en" : "de");

/** The cell-by-cell merge of lined-up versions, a copy of mine for each sheet that couldn't be lined up. */
function mergeLinedUp(l: LinedUp, locale: Locale, report?: MergeReport): Workbook {
  const { plans, conflicts, theirs, stand } = l;
  let base = l.base;
  let mine = l.mine;
  if (conflicts.length) {
    // My version of such a sheet goes to its copy; the sheet itself stays as theirs. Formulas and
    // charts elsewhere that point into it changed in mine only because I moved its rows: compared
    // with a base that had my changes too, they count as unchanged, so theirs (fitting their
    // version of the sheet) are kept. (A move into a sheet the base doesn't have is left out: what
    // points at those cells now points into my new sheet, where they are.)
    const moved = new Map<string, SheetOp[]>();
    for (const id of conflicts) {
      const raw = plans.get(id)!.mineRaw;
      if (raw?.length) moved.set(id, raw);
    }
    const r = replayAll(base, moved, "skip");
    if (r.ok) base = r.wb;
    mine = takeTheirs(mine, theirs, new Set(conflicts));
  }
  // A stand-in is no sheet of its version: the sheet counts as new on the side that has it, and
  // is merged with the other side's stand-in (the cells moved into it there) against the base's.
  const own = (wb: Workbook, side: Side) => wb.sheets.filter((s) => !stand.get(s.id)?.into.has(side));
  const logOf = (s: Sheet) => plans.get(s.id)?.log ?? s.log;
  const sheets = mergeById(own(base, "base"), own(mine, "mine"), own(theirs, "theirs"), (b, m, t) => mergeSheet(b ?? sheetById(base, m.id), m, t, logOf(m))).map((s) => {
    const st = stand.get(s.id);
    if (!st?.into.has("mine") && !st?.into.has("theirs")) return s;
    return mergeSheet(sheetById(base, s.id), sheetById(mine, s.id)!, sheetById(theirs, s.id)!, logOf(s));
  });
  const merged: Workbook = {
    v: 1,
    sheets,
    charts: mergeById(base.charts, mine.charts, theirs.charts, mergeChart),
    // Mine first: two tables made at the same place at once (they would overlap) keep mine.
    tables: mergeById(base.tables, mine.tables, theirs.tables, mergeTable, true),
  };
  // Both deleted the other's sheets: a workbook keeps at least one (theirs, as they saved it).
  if (!merged.sheets.length) merged.sheets = own(theirs, "theirs").length ? own(theirs, "theirs") : own(mine, "mine");
  /** The merged workbook with copies of mine for the first `room` conflicts. */
  const withCopies = (room: number) => {
    let out = merged;
    let copies = 0;
    const made: MergeReport["conflicts"] = [];
    for (const id of conflicts) {
      const mineSheet = sheetById(l.mine, id);
      if (!mineSheet) continue;
      const kept = sheetById(out, id);
      const name = kept?.name ?? mineSheet.name;
      if (copies >= room) {
        made.push({ sheetId: id, name, copyId: "", copyName: "" });
        continue;
      }
      const copyName = conflictName(out, mineSheet.name, locale);
      const copy = copySheetInto(out, l.mine, id, copyName, kept ? out.sheets.indexOf(kept) + 1 : out.sheets.length);
      out = copy.wb;
      copies++;
      made.push({ sheetId: id, name, copyId: copy.sheetId, copyName });
    }
    return { out, made, copies };
  };
  let built = withCopies(Infinity);
  let result = normalizeWorkbook(built.out, locale);
  const over = built.out.sheets.length - result.sheets.length;
  if (over > 0) {
    // More sheets than a workbook holds: only as many copies as fit (a copy never pushes another
    // sheet out); for the others only their version is left, and the report says so.
    built = withCopies(Math.max(0, built.copies - over));
    result = normalizeWorkbook(built.out, locale);
  }
  report?.conflicts.push(...built.made);
  return result;
}

// ----------------------------------------------------------------------------------------------

/**
 * Merge my version and theirs, both made from `base`. A sheet whose rows or columns both sides
 * moved is kept as theirs, with mine as a copy next to it, listed in `report`. `locale`: the
 * language of that copy's name (guessed from the sheet names when not given).
 */
export function mergeWorkbooks(base: Workbook, mine: Workbook, theirs: Workbook, report?: MergeReport, locale?: Locale): Workbook {
  if (mine === theirs || theirs === base) return mine;
  if (mine === base) return theirs;
  return mergeLinedUp(lineUp(base, mine, theirs), locale ?? guessLocale(mine), report);
}

/**
 * What undo or redo can do (takeBack): the workbook, or why the step can't be taken back now and
 * the sheet that is about (moved: someone else moved rows or columns of it since; unknown: what
 * happened to its rows and columns can't be told; gone: a sheet the step needs was deleted; full:
 * taking it back would push data off the end of the sheet).
 */
export type TakeBack = { wb: Workbook } | { refused: Why; sheetId: string };

/**
 * Undo and redo while others edit (the store): the change from `from` back to `to`, done on `now`.
 * An undo goes from a step's result back to what was before it, a redo from the undo's result back
 * to what was before that; either way the changes of rows and columns being taken back are the
 * entries `from`'s log has beyond `to`'s. They are taken back on `now` as new entries of its log (a
 * log only grows, so other versions can still be lined up with it), and then only what the step
 * changed goes back: what others did since stays, on the rows they did it on. Refused when that
 * can't be done without guessing.
 */
export function takeBack(from: Workbook, to: Workbook, now: Workbook): TakeBack {
  // The changes to take back, by sheet, newest first (a move between two sheets is in both lists,
  // as one change).
  const back = new Map<string, SheetOp[]>();
  const inverses = new Map<string, SheetOp>();
  const unknown = new Set<string>();
  for (const s of from.sheets) {
    const t = sheetById(to, s.id);
    if (!t) continue;
    const ops = opsSince(t.log, s.log);
    if (ops && !ops.length) continue;
    const list: SheetOp[] = [];
    for (const op of ops ?? []) {
      const inv = inverses.get(op.id) ?? inverseOp(op, newId());
      if (!inv) break;
      inverses.set(op.id, inv);
      list.unshift(inv);
    }
    if (ops && list.length === ops.length) back.set(s.id, list);
    else unknown.add(s.id);
  }
  if (!back.size && !unknown.size) {
    // A step that changed cells only.
    if (now === from) return { wb: to };
    return mergedOrRefused(lineUp(from, to, now), now);
  }
  if (now === from) {
    // Nobody changed anything since: the version from before, its log grown by the changes taken
    // back (a barrier where they can't be told).
    return {
      wb: {
        ...to,
        sheets: to.sheets.map((s) => {
          const was = sheetById(from, s.id)?.log ?? [];
          const ops = back.get(s.id);
          if (ops) return withLog(s, capLog([...was, ...ops]));
          return unknown.has(s.id) ? withLog(s, capLog([...was, { id: newId(), kind: "barrier" }])) : s;
        }),
      },
    };
  }
  const [unknownId] = unknown;
  if (unknownId !== undefined) return { refused: "unknown", sheetId: unknownId };
  for (const [id] of back) {
    const n = sheetById(now, id);
    // A sheet deleted since: nothing to take back there (the merge leaves it deleted).
    if (!n) {
      back.delete(id);
      continue;
    }
    const since = opsSince(sheetById(from, id)!.log, n.log);
    if (!since) return { refused: "unknown", sheetId: id };
    if (netOps(since).length) return { refused: "moved", sheetId: id };
  }
  // Both in the rows and columns from before the step; `to` is there already, and its log is
  // taken as far as `from`'s now goes, so only `now` has changes of its own.
  const f = replayAll(from, back);
  if (!f.ok) return { refused: f.why, sheetId: f.about };
  const n = replayAll(now, back);
  if (!n.ok) return { refused: n.why, sheetId: n.about };
  const to2: Workbook = { ...to, sheets: to.sheets.map((s) => (back.has(s.id) ? withLog(s, sheetById(f.wb, s.id)?.log) : s)) };
  return mergedOrRefused(lineUp(f.wb, to2, n.wb), now);
}

/** Lined-up versions merged, or why not: undo never makes a copy. */
function mergedOrRefused(l: LinedUp, now: Workbook): TakeBack {
  const [id] = l.conflicts;
  if (id !== undefined) return { refused: l.plans.get(id)?.why ?? "moved", sheetId: id };
  return { wb: mergeLinedUp(l, guessLocale(now)) };
}
