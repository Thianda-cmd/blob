// Saving a spreadsheet that several people edit at once (like presentations, src/components/deck/collab.ts):
// each save names the revision it builds on; when someone else saved in between, merge cell by
// cell — whoever changed a cell (or a chart, a table, a sheet's settings) since the common base
// wins, and if both did, ours. Sheets, charts and tables added on either side are kept; deleted
// ones stay deleted, except a sheet the other side changed meanwhile: work someone saved is never
// lost to a deletion made by someone who hadn't seen it, so that sheet stays, with that change,
// and the report says so.
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
// with them, but what was written into rows or columns that were empty before never does. Cells
// cut and pasted into a sheet that only one side has (added since the base) take the other side's
// edits of them along too: that side gets an empty stand-in for the new sheet while the versions
// are lined up. When both sides moved rows or columns of the same sheet, or what one side did
// can't be told (its log doesn't reach back to the base: content from before the log, more
// changes than the log keeps) or can't be done on the other version (cells cut and pasted into a
// sheet the other side deleted, rows deleted that were empty for that side while the other side
// was writing into them), nothing is guessed: their version of the sheet stays, mine is added
// next to it as a copy ("Blatt 1 (Konflikt)", marked as such in Sheet.copyOf), and the report says
// so. What I wrote elsewhere for my version of it (formulas, chart ranges) then reads the copy.
// Whatever happens, the result is a valid workbook (normalizeWorkbook at the end makes sure of
// that: charts on deleted sheets go, sizes cover every cell), and a copy never pushes another
// sheet out of a workbook that is full.
//
// Sheet names: formulas name sheets, so before the cells are compared every version's formulas
// name each sheet as the result will (a sheet renamed on one side, two sheets that would get the
// same name, which then gets a number): a formula typed against the old name follows the rename.
//
// The store uses this for undo while others edit too (takeBack): only what the step changed goes
// back, lined up the same way, and what someone else changed after the step stays as they left it
// (a cell, a chart, a sheet they wrote into), which the store then says.

import type { Locale } from "@/i18n/config";
import { sheetCollabText } from "@/i18n/messages/sheetCollab";
import { parseKey, posName, quoteSheetName } from "./a1";
import { normalizeWorkbook } from "./doc";
import { copySheetInto, newId, renameInFormulas, renameSheetRefs, replayOp, sheetById, withoutSheet } from "./ops";
import { capLog, inverseOp, lostCell, netOps, opsSince } from "./sheetLog";
import { DEFAULT_SIZE, type Cell, type ChartSpec, type RangeRef, type SeriesSpec, type Sheet, type SheetOp, type TableSpec, type Workbook } from "./types";

/**
 * Why a sheet couldn't simply be merged (MergeReport). Its versions couldn't be lined up, so theirs
 * stays and mine is on a copy: both sides moved its rows or columns ("moved"); what a side did to
 * them can't be told ("unknown"); a change needs a sheet the other side deleted ("gone") or would
 * push data off the end of the sheet ("full"); one side deleted rows or columns that were empty
 * for it (or pasted cells over some) that the other side had just written into ("deleted"). Or one
 * side deleted the sheet while the other side changed it, so it stays with that change
 * ("keptMine": they deleted it, I changed it; "keptTheirs": I deleted it, they changed it). Or
 * "arrived": a copy someone else's merge made, with their version of sheet `name` (arrivedCopies).
 */
export type MergeWhy = "moved" | "unknown" | "gone" | "full" | "deleted" | "keptMine" | "keptTheirs" | "arrived";

/**
 * What a merge had to do besides merging (saver.ts shows it): `conflicts` names each sheet concerned
 * (`sheetId`, `name`) and why. A sheet whose versions couldn't be lined up is kept as theirs, and
 * mine is next to it as a new sheet (`copyId`, `copyName`). Both are "" when the workbook already
 * has as many sheets as it can hold: then there is no copy, only their version is left, and
 * `formulas` names the cells elsewhere whose formulas I wrote for my version ("Auswertung!B5").
 * They are "" for a sheet that was kept too. `tooBig`: with the copy the spreadsheet is too big to
 * save (saver.ts finds that out).
 */
export type MergeReport = { conflicts: { sheetId: string; name: string; copyId: string; copyName: string; why: MergeWhy; formulas?: string[]; tooBig?: boolean }[] };

/** A report entry whose sheet is kept as theirs, with mine on a copy (or nowhere): not a sheet that was kept, nor one that arrived. */
export const keptAsTheirs = (c: MergeReport["conflicts"][number]) => c.why !== "keptMine" && c.why !== "keptTheirs" && c.why !== "arrived";

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

/** How a merge decides when both sides changed the same thing. */
type Ctx = {
  /**
   * Undo or redo (takeBack): mine is where the step goes back to, theirs what is there now. What
   * both changed keeps theirs, since someone changed it after the step (else mine wins), and that
   * is noted: the cells in `kept`, anything else in `keptOther`.
   */
  undo: boolean;
  kept: { sheetId: string; key: string }[];
  keptOther: boolean;
};
const mergeCtx = (): Ctx => ({ undo: false, kept: [], keptOther: false });

/** Mine if I changed it since base, else theirs (an undo: theirs if they changed it since base, else mine). */
function pick<T>(c: Ctx, base: T, mine: T, theirs: T): T {
  if (sameJson(mine, base)) return theirs;
  if (!c.undo || sameJson(theirs, base)) return mine;
  if (!sameJson(theirs, mine)) c.keptOther = true;
  return theirs;
}

/** Each key of an object: mine if I changed it since base, else theirs (a key may be missing on any side). */
function mergeFields<T extends object>(c: Ctx, base: T | undefined, mine: T, theirs: T): T {
  if (!base) return c.undo ? theirs : mine;
  if (sameJson(mine, base)) return theirs;
  if (sameJson(theirs, base)) return mine;
  const b = base as Record<string, unknown>;
  const m = mine as Record<string, unknown>;
  const t = theirs as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(m), ...Object.keys(t), ...Object.keys(b)])) {
    const v = pick(c, b[k], m[k], t[k]);
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/**
 * The order of things that have ids: whoever reordered wins (mine first; an undo: theirs first);
 * things new on the other side go after the one before them there, or at the end. `first`: all of
 * mine (an undo: theirs), then what is new on the other side (for smart tables, where the earlier
 * of two overlapping tables is kept).
 */
function mergeOrder(c: Ctx, base: string[], mine: string[], theirs: string[], keep: Set<string>, first = false): string[] {
  if (first) {
    const [one, two] = c.undo ? [theirs, mine] : [mine, theirs];
    const order = one.filter((id) => keep.has(id));
    const placed = new Set(order);
    for (const id of two) if (keep.has(id) && !placed.has(id)) order.push(id);
    return order;
  }
  const inBase = new Set(base);
  const reordered = (side: string[]) => {
    const inSide = new Set(side);
    return !sameJson(
      side.filter((id) => inBase.has(id)),
      base.filter((id) => inSide.has(id)),
    );
  };
  const mineReordered = reordered(mine);
  const mineWins = mineReordered && !(c.undo && reordered(theirs));
  if (mineReordered && !mineWins) {
    // (An undo that leaves the order as someone else changed it since: noted.)
    const kept = (side: string[], other: string[]) => {
      const there = new Set(other);
      return side.filter((id) => keep.has(id) && there.has(id));
    };
    if (!sameJson(kept(mine, theirs), kept(theirs, mine))) c.keptOther = true;
  }
  const [primary, other] = mineWins ? [mine, theirs] : [theirs, mine];
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

/**
 * Lists of things with ids: added on either side kept, deleted on either side gone, the rest merged.
 * `first`: see mergeOrder. `keepChanged`: an undo deletes nothing that someone changed after the
 * step (charts, tables, a chart's series).
 */
function mergeById<T extends { id: string }>(
  c: Ctx,
  base: T[],
  mine: T[],
  theirs: T[],
  merge: (b: T | undefined, m: T, t: T) => T,
  opts: { first?: boolean; keepChanged?: boolean } = {},
): T[] {
  if (mine === base) return theirs;
  if (theirs === base || theirs === mine) return mine;
  const byId = (list: T[]) => new Map(list.map((x) => [x.id, x]));
  const b = byId(base);
  const m = byId(mine);
  const t = byId(theirs);
  const keep = new Set<string>();
  for (const id of [...m.keys(), ...t.keys()]) {
    // There before and now missing on one side: deleted there, so it stays deleted.
    if (b.has(id) && (!m.has(id) || !t.has(id))) {
      const changedSince = c.undo && opts.keepChanged && !m.has(id) && !sameJson(t.get(id), b.get(id));
      if (!changedSince) continue;
      c.keptOther = true;
    }
    keep.add(id);
  }
  const order = mergeOrder(
    c,
    base.map((x) => x.id),
    mine.map((x) => x.id),
    theirs.map((x) => x.id),
    keep,
    opts.first,
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

/**
 * One cell (`key` of sheet `sheetId`): its content (value or formula), look and note each from
 * whoever changed it; when both did, mine (an undo: theirs, and the cell is noted).
 */
function mergeCell(c: Ctx, sheetId: string, key: string, b: Cell | undefined, m: Cell | undefined, t: Cell | undefined): Cell | undefined {
  if (sameCell(m, b)) return t;
  if (sameCell(t, b) || sameCell(t, m)) return m;
  let clash = false;
  const part = <T>(bx: T, mx: T, tx: T, same: (x: T, y: T) => boolean): T => {
    if (same(mx, bx)) return tx;
    if (same(tx, bx)) return mx;
    if (!same(tx, mx)) clash = true;
    return c.undo ? tx : mx;
  };
  const content = part(b, m, t, sameContent);
  const s = part(b?.s, m?.s, t?.s, sameJson);
  const note = part(b?.note, m?.note, t?.note, (x, y) => x === y);
  if (clash && c.undo) c.kept.push({ sheetId, key });
  const out: Cell = {};
  if (content?.v !== undefined) out.v = content.v;
  if (content?.f !== undefined) out.f = content.f;
  if (s) out.s = s;
  if (note) out.note = note;
  return out.v === undefined && out.f === undefined && !out.s && !out.note ? undefined : out;
}

function mergeCells(c: Ctx, sheetId: string, b: Record<string, Cell>, m: Record<string, Cell>, t: Record<string, Cell>): Record<string, Cell> {
  if (m === b) return t;
  if (t === b || t === m) return m;
  const out: Record<string, Cell> = {};
  for (const k in m) {
    const cell = mergeCell(c, sheetId, k, b[k], m[k], t[k]);
    if (cell) out[k] = cell;
  }
  for (const k in t) {
    if (k in m) continue;
    const cell = mergeCell(c, sheetId, k, b[k], undefined, t[k]);
    if (cell) out[k] = cell;
  }
  return out;
}

/** Column widths or row heights: each entry from whoever changed it. */
function mergeRecord<T>(c: Ctx, b: Record<string, T>, m: Record<string, T>, t: Record<string, T>): Record<string, T> {
  if (m === b) return t;
  if (t === b || t === m) return m;
  const out: Record<string, T> = {};
  for (const k of new Set([...Object.keys(m), ...Object.keys(t), ...Object.keys(b)])) {
    const v = pick(c, b[k], m[k], t[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** A sheet's size: from whoever changed it; when both did, the larger (nobody's cells fall off the grid). */
const mergeSize = (b: number, m: number, t: number) => (m === b ? t : t === b ? m : Math.max(m, t));

const EMPTY_SHEET: Omit<Sheet, "id"> = { name: "", cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 0, cols: 0 } };

/** One sheet of lined-up versions; `log`: the merged log (see planSheet). */
function mergeSheet(c: Ctx, base: Sheet | undefined, m: Sheet, t: Sheet, log: SheetOp[] | undefined): Sheet {
  // New on both sides with the same id (two devices that opened the same empty page): both
  // sides' cells, mine first where they differ (an undo: theirs).
  const b: Sheet = base ?? { ...EMPTY_SHEET, id: m.id };
  if (m === b) return withLog(t, log);
  if (t === b) return withLog(m, log);
  const merged: Sheet = {
    id: m.id,
    name: pick(c, b.name, m.name, t.name),
    cells: mergeCells(c, m.id, b.cells, m.cells, t.cells),
    cols: mergeRecord(c, b.cols, m.cols, t.cols),
    rows: mergeRecord(c, b.rows, m.rows, t.rows),
    freeze: pick(c, b.freeze, m.freeze, t.freeze),
    size: { rows: mergeSize(b.size.rows, m.size.rows, t.size.rows), cols: mergeSize(b.size.cols, m.size.cols, t.size.cols) },
  };
  const copyOf = pick(c, b.copyOf, m.copyOf, t.copyOf);
  if (copyOf) merged.copyOf = copyOf;
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

function mergeChart(c: Ctx, b: ChartSpec | undefined, m: ChartSpec, t: ChartSpec): ChartSpec {
  if (!b) return c.undo ? t : m;
  if (sameJson(m, b)) return t;
  if (sameJson(t, b)) return m;
  return {
    id: m.id,
    sheetId: pick(c, b.sheetId, m.sheetId, t.sheetId),
    at: pick(c, b.at, m.at, t.at),
    size: pick(c, b.size, m.size, t.size),
    kind: pick(c, b.kind, m.kind, t.kind),
    title: pick(c, b.title, m.title, t.title),
    x: pick(c, b.x, m.x, t.x),
    series: mergeById<SeriesSpec>(c, b.series, m.series, t.series, (bs, ms, ts) => mergeFields(c, bs, ms, ts), { keepChanged: true }),
    xAxis: mergeFields(c, b.xAxis, m.xAxis, t.xAxis),
    yAxis: mergeFields(c, b.yAxis, m.yAxis, t.yAxis),
    legend: pick(c, b.legend, m.legend, t.legend),
  };
}

function mergeTable(c: Ctx, b: TableSpec | undefined, m: TableSpec, t: TableSpec): TableSpec {
  if (!b) return c.undo ? t : m;
  if (sameJson(m, b)) return t;
  if (sameJson(t, b)) return m;
  // The area, its columns and the totals row belong together.
  const shape = (x: TableSpec) => ({ sheetId: x.sheetId, area: x.area, columns: x.columns, totals: x.totals });
  const s = pick(c, shape(b), shape(m), shape(t));
  return {
    id: m.id,
    sheetId: s.sheetId,
    name: pick(c, b.name, m.name, t.name),
    area: s.area,
    columns: s.columns,
    totals: s.totals,
    style: pick(c, b.style, m.style, t.style),
    banded: pick(c, b.banded, m.banded, t.banded),
    // Filters and sort of columns that are gone are dropped by normalizeWorkbook.
    filters: pick(c, b.filters, m.filters, t.filters),
    sort: pick(c, b.sort, m.sort, t.sort),
  };
}

// Lining the versions up ----------------------------------------------------------------------

/**
 * Why a sheet can't be lined up: both sides moved its rows or columns; what a side did to them
 * can't be told; a change can't be done on another version because a sheet it needs is gone, or
 * because it would push data off the end of the sheet, or because it would delete (or paste cells
 * over) what that version had just written into rows or columns that were empty.
 */
type Why = "moved" | "unknown" | "gone" | "full" | "deleted";

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

/** Is there anything on sheet `id` of `wb`: a cell (even one with only a look), a chart or a smart table? */
function holdsAnything(wb: Workbook, id: string): boolean {
  const s = sheetById(wb, id);
  if (!s) return false;
  return Object.keys(s.cells).length > 0 || wb.charts.some((x) => x.sheetId === id) || wb.tables.some((x) => x.sheetId === id);
}

/** `undo`: theirs is what is there now (takeBack), whose log the result's log grows from. */
function planSheet(base: Workbook, mine: Workbook, theirs: Workbook, id: string, undo: boolean): Plan {
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
    if (!touched(base, theirs, id)) return { ...none, kind: "plain", log: undo ? t : m };
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
        // (A sheet that can't be lined up because the other one can't: for the same reason.)
        const why = (p.kind === "conflict" ? p.why : q.kind === "conflict" ? q.why : undefined) ?? "moved";
        if (p.kind !== "conflict") {
          plans.set(id, conflict(id, why));
          again = true;
        }
        if (q.kind !== "conflict") {
          plans.set(other, conflict(other, why));
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

/** The base with the changes of rows and columns both sides have already: where each side's own ones start. */
function sharedStart(base: Workbook, plans: Map<string, Plan>): Workbook {
  const lists = new Map<string, SheetOp[]>();
  for (const [id, p] of plans) if (p.shared.length) lists.set(id, p.shared);
  if (!lists.size) return base;
  const r = replayAll(base, lists, "some");
  return r.ok ? r.wb : base;
}

/** Something written into a cell: a value, a formula or a note (a look alone isn't). */
const written = (c: Cell | undefined) => !!c && (c.v !== undefined || c.f !== undefined || c.note !== undefined);

/**
 * Would doing `ops` (changes of the rows and columns of sheet `id`) on `other` destroy something
 * written there in a cell that is empty in `base` (in the same rows and columns)? Under cells they
 * paste, always. In a row or column they delete, when it had nothing written in it in `base` right
 * before (rows that were empty for whoever deleted them, tidied up say: they never saw what was
 * written there since). A row they saw something in they deleted on purpose, so what was added to
 * it goes with it, like an edit there. `strict`: whatever row or column (an undo deletes nothing
 * someone wrote since).
 */
function destroysNew(ops: readonly SheetOp[], id: string, base: Workbook, other: Workbook, strict = false): boolean {
  if (!ops.some((op) => op.kind === "deleteRows" || op.kind === "deleteCols" || op.kind === "move")) return false;
  const o = sheetById(other, id);
  if (!o) return false;
  const b = sheetById(base, id)?.cells ?? {};
  // The base right before each of `ops` (done on it as far as needed), and its rows and columns
  // with something written in them then (null: it can't be told, so it counts).
  type Filled = { rows: Set<number>; cols: Set<number> };
  const versions: (Workbook | null)[] = [base];
  const filled = new Map<number, Filled | null>();
  const filledAt = (k: number): Filled | null => {
    if (!filled.has(k)) {
      for (let i = versions.length; i <= k; i++) versions.push(versions[i - 1] && replayOp(versions[i - 1]!, id, ops[i - 1]));
      const s = versions[k] && sheetById(versions[k]!, id);
      let f: Filled | null = null;
      if (s) {
        f = { rows: new Set(), cols: new Set() };
        for (const key in s.cells) {
          if (!written(s.cells[key])) continue;
          const p = parseKey(key);
          f.rows.add(p.row);
          f.cols.add(p.col);
        }
      }
      filled.set(k, f);
    }
    return filled.get(k) ?? null;
  };
  for (const key in o.cells) {
    if (!written(o.cells[key]) || written(b[key])) continue;
    const lost = lostCell(ops, id, parseKey(key));
    if (!lost) continue;
    if (strict || lost.how === "pasted") return true;
    const f = filledAt(lost.op);
    if (!f || !(lost.how === "rows" ? f.rows.has(lost.at.row) : f.cols.has(lost.at.col))) return true;
  }
  return false;
}

/** The three versions in the same rows and columns, sheet by sheet, and the sheets that can't be. `undo`: see planSheet. */
function lineUp(base: Workbook, mine: Workbook, theirs: Workbook, undo = false): LinedUp {
  const refused = new Set<string>();
  for (;;) {
    const stand = standIns(base, mine, theirs, refused);
    const lined = lineUpWith(withStandIns(base, stand, "base"), withStandIns(mine, stand, "mine"), withStandIns(theirs, stand, "theirs"), stand, undo);
    // A new sheet that can't be lined up after all: once more without its stand-in (which would
    // otherwise be taken for the other side's version of it).
    const bad = [...stand.keys()].filter((id) => lined.plans.get(id)?.kind === "conflict");
    if (!bad.length) return lined;
    for (const id of bad) refused.add(id);
  }
}

function lineUpWith(base: Workbook, mine: Workbook, theirs: Workbook, stand: Map<string, StandIn>, undo: boolean): LinedUp {
  const plans = new Map<string, Plan>();
  // (A sheet stood in for on both sides is nobody's: moves into it are done, it isn't lined up.)
  const nobodys = (id: string) => !!stand.get(id)?.into.has("mine") && !!stand.get(id)?.into.has("theirs");
  for (const s of mine.sheets) if (sheetById(theirs, s.id) && !nobodys(s.id)) plans.set(s.id, planSheet(base, mine, theirs, s.id, undo));
  const conflict = (id: string, why: Why): Plan => ({ ...plans.get(id)!, kind: "conflict", why, shared: [], ops: [], log: sheetById(theirs, id)?.log });
  closeOverMoves(plans, conflict);
  // Rows or columns one side deleted that were empty for it (or cells it pasted over) while the
  // other side has just written into them: doing that on the other version would destroy what was
  // written, so both versions are kept. (A change of a value that was there, or a cell added to a
  // row that had something in it, goes with its row, as above. For an undo, which can't keep two
  // versions, every row counts: it is refused rather than lose what it would put back.)
  const start = sharedStart(base, plans);
  for (const [id, p] of plans) {
    if ((p.kind === "mine" || p.kind === "theirs") && destroysNew(p.ops, id, start, p.kind === "mine" ? theirs : mine, undo)) plans.set(id, conflict(id, "deleted"));
  }
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

/** `name`, or with a number when a sheet has it already ("Blatt 2 (2)"), as normalizeWorkbook numbers them. */
function freeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  const m = /^(.*) \((\d+)\)$/.exec(name);
  const root = m ? m[1] : name;
  for (let n = m ? Number(m[2]) + 1 : 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = root.slice(0, 31 - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** A chart with each of its ranges through `f` (`mine`, `base`: that range in those versions of the chart). */
function chartRanges(ch: ChartSpec, mine: ChartSpec | undefined, base: ChartSpec | undefined, f: (r: RangeRef, mine: RangeRef | null | undefined, base: RangeRef | null | undefined) => RangeRef): ChartSpec {
  const fix = <T extends RangeRef | null>(r: T, m: RangeRef | null | undefined, b: RangeRef | null | undefined): T => (r ? (f(r, m, b) as T) : r);
  const series = ch.series.map((s) => {
    const ms = mine?.series.find((x) => x.id === s.id);
    const bs = base?.series.find((x) => x.id === s.id);
    const eb = s.errorBars;
    const next: SeriesSpec = {
      ...s,
      y: fix(s.y, ms?.y, bs?.y),
      x: fix(s.x, ms?.x, bs?.x),
      nameRef: fix(s.nameRef, ms?.nameRef, bs?.nameRef),
      errorBars: eb && { ...eb, plus: fix(eb.plus, ms?.errorBars?.plus, bs?.errorBars?.plus), minus: fix(eb.minus, ms?.errorBars?.minus, bs?.errorBars?.minus) },
    };
    return sameJson(next, s) ? s : next;
  });
  const x = fix(ch.x, mine?.x, base?.x);
  return x === ch.x && series.every((s, i) => s === ch.series[i]) ? ch : { ...ch, x, series };
}

/** What an undo or redo left as it is now, because someone changed it after the step: cells, sheets (by id), and anything else (a chart, a table, a sheet's name, the order of the tabs…). */
export type Kept = { cells: { sheetId: string; row: number; col: number }[]; sheets: string[]; other: boolean };

/**
 * The cell-by-cell merge of lined-up versions, a copy of mine for each sheet that couldn't be lined
 * up. `undo`: an undo or redo (takeBack, see Ctx), which notes there what it left as it is now.
 */
function mergeLinedUp(l: LinedUp, locale: Locale, report?: MergeReport, undo?: Kept): Workbook {
  const { plans, conflicts, stand } = l;
  const c: Ctx = { ...mergeCtx(), undo: !!undo };
  const ids = new Set(conflicts);
  let base = l.base;
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
  }
  // A stand-in is no sheet of its version: the sheet counts as new on the side that has it, and
  // is merged with the other side's stand-in (the cells moved into it there) against the base's.
  const own = (wb: Workbook, side: Side) => wb.sheets.filter((s) => !stand.get(s.id)?.into.has(side));
  // A sheet one side deleted while the other side changed it stays, with that change (an undo
  // deletes no sheet someone changed after the step; one deleted since stays deleted). Compared
  // with a base that had the deletion too (what pointed at the sheet #REF!, its charts and tables
  // gone), the side that deleted it changed nothing about it, so the other side's sheet, its charts
  // and tables, and what points at it there are taken. (Not when nothing is left on it there: its
  // cells cut and pasted elsewhere, say.)
  const keptSheets: { id: string; why: "keptMine" | "keptTheirs" }[] = [];
  const stays = (side: Workbook, id: string) => touched(base, side, id) && holdsAnything(side, id);
  for (const s of own(base, "base")) {
    const inMine = !!sheetById(l.mine, s.id);
    const inTheirs = !!sheetById(l.theirs, s.id);
    if (inMine && !inTheirs && !c.undo && stays(l.mine, s.id)) keptSheets.push({ id: s.id, why: "keptMine" });
    else if (!inMine && inTheirs && stays(l.theirs, s.id)) keptSheets.push({ id: s.id, why: "keptTheirs" });
  }
  for (const k of keptSheets) base = withoutSheet(base, k.id);

  // Every sheet's name in the result, by id: as merged (a sheet kept as theirs has their name), with
  // a number where two would have the same one. Every version's formulas name the sheets that way
  // before the cells are compared: a formula typed with a sheet's old name follows its rename (on
  // either side, in one pass, so names swapped stay apart), and one naming a sheet that is gone
  // reads #REF! rather than another sheet that has its name now.
  const stub = (list: Sheet[]) => list.map((s) => ({ id: s.id, name: s.name }));
  const mineNamed = conflicts.length ? takeTheirs(l.mine, l.theirs, ids) : l.mine;
  // (The merge below then finds these names on every side: an undo that leaves a name, or the
  // order of the tabs, as someone changed it since is noted here.)
  const named: Ctx = { ...c, kept: [] };
  let order = mergeById(named, stub(own(base, "base")), stub(own(mineNamed, "mine")), stub(own(l.theirs, "theirs")), (b, m, t) => ({
    id: m.id,
    name: pick(named, b?.name ?? sheetById(base, m.id)?.name ?? "", m.name, t.name),
  }));
  c.keptOther ||= named.keptOther;
  if (!order.length) order = stub(own(l.theirs, "theirs").length ? own(l.theirs, "theirs") : own(l.mine, "mine"));
  const names = new Map<string, string>();
  const taken = new Set<string>();
  for (const s of order) {
    const name = freeName(s.name, taken);
    taken.add(name.toLowerCase());
    names.set(s.id, name);
  }
  const renamed = (wb: Workbook, side: Side): Workbook => {
    const refs = new Map<string, string | null>();
    for (const s of own(wb, side)) {
      const to = names.get(s.id);
      if (to === undefined ? taken.has(s.name.toLowerCase()) : to !== s.name) refs.set(s.name.toLowerCase(), to ?? null);
    }
    const sheets = wb.sheets.map((s) => {
      const to = names.get(s.id);
      return to === undefined || to === s.name ? s : { ...s, name: to };
    });
    return renameInFormulas(sheets.some((s, i) => s !== wb.sheets[i]) ? { ...wb, sheets } : wb, refs);
  };
  base = renamed(base, "base");
  const mineAll = renamed(l.mine, "mine");
  const theirs = renamed(l.theirs, "theirs");
  const mine = conflicts.length ? takeTheirs(mineAll, theirs, ids) : mineAll;

  const logOf = (s: Sheet) => plans.get(s.id)?.log ?? s.log;
  const sheets = mergeById(c, own(base, "base"), own(mine, "mine"), own(theirs, "theirs"), (b, m, t) => mergeSheet(c, b ?? sheetById(base, m.id), m, t, logOf(m))).map((s) => {
    const st = stand.get(s.id);
    if (!st?.into.has("mine") && !st?.into.has("theirs")) return s;
    return mergeSheet(c, sheetById(base, s.id), sheetById(mine, s.id)!, sheetById(theirs, s.id)!, logOf(s));
  });
  const merged: Workbook = {
    v: 1,
    sheets,
    charts: mergeById(c, base.charts, mine.charts, theirs.charts, (b, m, t) => mergeChart(c, b, m, t), { keepChanged: true }),
    // Mine first (an undo: theirs): two tables made at the same place at once (they would overlap) keep that one.
    tables: mergeById(c, base.tables, mine.tables, theirs.tables, (b, m, t) => mergeTable(c, b, m, t), { first: true, keepChanged: true }),
  };
  // Both deleted the other's sheets: a workbook keeps at least one (theirs, as they saved it).
  if (!merged.sheets.length) merged.sheets = own(theirs, "theirs").length ? own(theirs, "theirs") : own(mine, "mine");

  /**
   * What I wrote for my version of a sheet kept as theirs reads my version, on its copy: formulas I
   * typed or changed elsewhere that name it, chart ranges I picked or changed that point into it
   * (what I left as it was fits their version, which stays), and everything on the copies. Without
   * a copy, the report names those formulas instead.
   */
  const toCopies = (wb: Workbook, made: MergeReport["conflicts"]): Workbook => {
    if (!made.length) return wb;
    const copies = new Map(made.filter((x) => x.copyId).map((x) => [x.sheetId, x]));
    const copyIds = new Set([...copies.values()].map((x) => x.copyId));
    const toCopy = new Map([...copies].map(([id, x]) => [names.get(id)!.toLowerCase(), x.copyName]));
    const lost = made.filter((x) => !x.copyId).map((x) => ({ x, refs: new Map([[names.get(x.sheetId)!.toLowerCase(), null]]) }));
    const sheets = wb.sheets.map((s) => {
      if (copyIds.has(s.id)) return renameInFormulas({ ...wb, sheets: [s] }, toCopy).sheets[0];
      const m = ids.has(s.id) ? undefined : sheetById(mineAll, s.id);
      if (!m) return s;
      const b = sheetById(base, s.id)?.cells ?? {};
      let cells: Record<string, Cell> | null = null;
      for (const key in m.cells) {
        const f = m.cells[key].f;
        if (f === undefined || f === b[key]?.f || s.cells[key]?.f !== f) continue;
        for (const { x, refs } of lost) if (renameSheetRefs(f, refs) !== f) (x.formulas ??= []).push(`${quoteSheetName(s.name)}!${posName(parseKey(key))}`);
        const nf = renameSheetRefs(f, toCopy);
        if (nf === f) continue;
        cells ??= { ...s.cells };
        cells[key] = { ...s.cells[key], f: nf };
      }
      return cells ? { ...s, cells } : s;
    });
    const mineCharts = new Map(mineAll.charts.map((x) => [x.id, x]));
    const baseCharts = new Map(base.charts.map((x) => [x.id, x]));
    const charts = wb.charts.map((ch) => {
      if (ids.has(ch.sheetId) || !(copyIds.has(ch.sheetId) || mineCharts.has(ch.id))) return ch;
      const all = copyIds.has(ch.sheetId);
      return chartRanges(ch, mineCharts.get(ch.id), baseCharts.get(ch.id), (r, m, b) => {
        const x = copies.get(r.sheetId);
        return x && (all || (sameJson(r, m) && !sameJson(m, b))) ? { ...r, sheetId: x.copyId } : r;
      });
    });
    const same = sheets.every((s, i) => s === wb.sheets[i]) && charts.every((ch, i) => ch === wb.charts[i]);
    return same ? wb : { ...wb, sheets, charts };
  };

  /** The merged workbook with copies of mine for the first `room` conflicts. */
  const withCopies = (room: number) => {
    let out = merged;
    let copies = 0;
    const made: MergeReport["conflicts"] = [];
    for (const id of conflicts) {
      const mineSheet = sheetById(mineAll, id);
      if (!mineSheet) continue;
      const kept = sheetById(out, id);
      const name = kept?.name ?? mineSheet.name;
      const why = plans.get(id)?.why ?? "moved";
      if (copies >= room) {
        made.push({ sheetId: id, name, copyId: "", copyName: "", why });
        continue;
      }
      // (Named as I named my version: a rename of mine stays on it, while the sheet kept as theirs
      // has their name.)
      const copyName = conflictName(out, (sheetById(l.mine, id) ?? mineSheet).name, locale);
      const copy = copySheetInto(out, mineAll, id, copyName, kept ? out.sheets.indexOf(kept) + 1 : out.sheets.length);
      // Marked as a copy merging made: the other person is told when it reaches them (saver.ts).
      out = { ...copy.wb, sheets: copy.wb.sheets.map((s) => (s.id === copy.sheetId ? { ...s, copyOf: id } : s)) };
      copies++;
      made.push({ sheetId: id, name, copyId: copy.sheetId, copyName, why });
    }
    return { out: toCopies(out, made), made, copies };
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
  report?.conflicts.push(...built.made, ...keptSheets.map((k) => ({ sheetId: k.id, name: names.get(k.id) ?? "", copyId: "", copyName: "", why: k.why })));
  if (undo) {
    undo.cells.push(...c.kept.map((k) => ({ sheetId: k.sheetId, ...parseKey(k.key) })));
    undo.sheets.push(...keptSheets.map((k) => k.id));
    undo.other ||= c.keptOther;
  }
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
 * Copies of sheets someone else's merge made that `theirs` brings (Sheet.copyOf): their version of
 * a sheet whose versions couldn't be combined, which this editor neither made nor has seen (neither
 * `base` nor `now` has it), as report entries ("arrived").
 */
export function arrivedCopies(base: Workbook, now: Workbook, theirs: Workbook): MergeReport["conflicts"] {
  const out: MergeReport["conflicts"] = [];
  for (const s of theirs.sheets) {
    const of = s.copyOf === undefined ? undefined : sheetById(theirs, s.copyOf);
    if (of && !sheetById(base, s.id) && !sheetById(now, s.id)) out.push({ sheetId: of.id, name: of.name, copyId: s.id, copyName: s.name, why: "arrived" });
  }
  return out;
}

/**
 * My version of a sheet that has a conflict copy (Sheet.copyOf), as a spreadsheet of its own: the
 * copy `copyId` with its charts and smart tables, under its original's name (its formulas naming
 * the copy name it). For when the spreadsheet is too big to save with both versions: kept as a
 * spreadsheet of your own, mine leaves room for theirs (the editor's "Meine Version als eigene
 * Tabelle speichern", which then deletes the copy). Only that sheet: formulas on other sheets that
 * I left as they were fit their version of it, and would read the wrong rows of mine. Offered only
 * while nothing ties the copy to other sheets (copyTies). null when `copyId` is no such copy, or its
 * original is gone.
 */
export function ownVersion(wb: Workbook, copyId: string, locale: Locale): Workbook | null {
  const copy = sheetById(wb, copyId);
  const original = copy?.copyOf === undefined ? undefined : sheetById(wb, copy.copyOf);
  if (!copy || !original) return null;
  const mine: Sheet = { ...copy, name: original.name };
  delete mine.copyOf;
  const own: Workbook = { v: 1, sheets: [mine], charts: wb.charts.filter((ch) => ch.sheetId === copyId), tables: wb.tables.filter((t) => t.sheetId === copyId) };
  return normalizeWorkbook(renameInFormulas(own, new Map([[copy.name.toLowerCase(), original.name]])), locale);
}

/** What ties a conflict copy to the rest of the spreadsheet (copyTies). */
export type CopyTies = {
  /** Cells on other sheets whose formulas read the copy: tab by tab, row by row. */
  cells: { sheetId: string; row: number; col: number }[];
  /** Charts on other sheets with a range on the copy (their ids). */
  charts: string[];
  /** A formula on the copy, or a range of a chart on it, reads another sheet (its original too). */
  readsOthers: boolean;
};

/** Every range a chart reads: its x values, and each series' values, x values, name and error bar cells. */
const rangesOf = (ch: ChartSpec): RangeRef[] =>
  [ch.x, ...ch.series.flatMap((s) => [s.y, s.x, s.nameRef, s.errorBars?.plus, s.errorBars?.minus])].filter((r): r is RangeRef => !!r);

/**
 * The cells of a sheet whose formulas name one of the sheets in `names` (lower case), row by row,
 * kept for the sheet as it is: while a spreadsheet is too big to save the editor asks after every
 * change, and a big sheet that didn't change isn't gone through again.
 */
const naming = new WeakMap<Sheet, { key: string; found: { row: number; col: number }[] }>();
function cellsNaming(s: Sheet, names: ReadonlyMap<string, null>): { row: number; col: number }[] {
  const key = [...names.keys()].join("\n");
  const had = naming.get(s);
  if (had?.key === key) return had.found;
  const found: { row: number; col: number }[] = [];
  // (A formula names a sheet when renaming that sheet to nothing changes it.)
  for (const at in s.cells) {
    const f = s.cells[at].f;
    if (f !== undefined && renameSheetRefs(f, names) !== f) found.push(parseKey(at));
  }
  found.sort((a, b) => a.row - b.row || a.col - b.col);
  naming.set(s, { key, found });
  return found;
}

/**
 * What ties the conflict copy `copyId` to the rest of the spreadsheet. My version kept as a
 * spreadsheet of its own (ownVersion) is only the copy, with its charts and smart tables, and the
 * copy then goes from this one: what reads it from other sheets would break here (formulas turn
 * into #REF!, chart ranges on it go, a chart left without values with them), and what it reads on
 * other sheets isn't there (a formula on it naming the original would even read my own rows there).
 * What reads the copy is what I wrote for my version (merging points it there: mergeLinedUp), so
 * the editor offers that way out only while nothing ties the copy (tiedCopy), and else says what
 * reads it.
 */
export function copyTies(wb: Workbook, copyId: string): CopyTies {
  const out: CopyTies = { cells: [], charts: [], readsOthers: false };
  const copy = sheetById(wb, copyId);
  if (!copy) return out;
  const it = new Map([[copy.name.toLowerCase(), null]]);
  const others = new Map(wb.sheets.filter((s) => s.id !== copyId).map((s) => [s.name.toLowerCase(), null]));
  for (const s of wb.sheets) {
    if (s.id === copyId) out.readsOthers ||= cellsNaming(s, others).length > 0;
    else out.cells.push(...cellsNaming(s, it).map((p) => ({ sheetId: s.id, ...p })));
  }
  for (const ch of wb.charts) {
    const ranges = rangesOf(ch);
    if (ch.sheetId === copyId) out.readsOthers ||= ranges.some((r) => r.sheetId !== copyId);
    else if (ranges.some((r) => r.sheetId === copyId)) out.charts.push(ch.id);
  }
  return out;
}

/** Whether anything ties the copy to the rest of the spreadsheet (copyTies). */
export const tiedCopy = (t: CopyTies) => t.cells.length > 0 || t.charts.length > 0 || t.readsOthers;

/**
 * What undo or redo can do (takeBack): the workbook, with what it left as it is now because someone
 * changed it after the step (`kept`, when there is any), or why the step can't be taken back now
 * and the sheet that is about (moved: someone else moved rows or columns of it since; unknown: what
 * happened to its rows and columns can't be told; gone: a sheet the step needs was deleted; full:
 * taking it back would push data off the end of the sheet; deleted: it would delete, or paste over,
 * what someone wrote since into rows or columns that were empty).
 */
export type TakeBack = { wb: Workbook; kept?: Kept } | { refused: Why; sheetId: string };

/**
 * `now` is `from` with nothing changed since but the sheets' logs (which grow with every undo and
 * redo): nobody else changed anything in between. (Compared by reference: what the store's steps
 * share with each other.)
 */
function sameButLogs(from: Workbook, now: Workbook): boolean {
  if (from === now) return true;
  if ((from.charts !== now.charts && !sameJson(from.charts, now.charts)) || (from.tables !== now.tables && !sameJson(from.tables, now.tables))) return false;
  if (from.sheets.length !== now.sheets.length) return false;
  return from.sheets.every((s, i) => {
    const n = now.sheets[i];
    return s === n || (s.id === n.id && s.name === n.name && s.cells === n.cells && s.cols === n.cols && s.rows === n.rows && s.freeze === n.freeze && s.size === n.size && s.copyOf === n.copyOf);
  });
}

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
    // (A sheet the step made goes again, but what was done to its rows comes first: cells moved
    // there are found where they were moved to.)
    const ops = opsSince(sheetById(to, s.id)?.log, s.log);
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
  if (sameButLogs(from, now)) {
    // Nobody changed anything since: the version from before, with now's logs grown by the changes
    // taken back (a barrier where they can't be told). So a log capped meanwhile never stops undo
    // while working alone, however far back it goes.
    const sheets = to.sheets.map((s) => {
      const was = sheetById(now, s.id)?.log;
      const ops = back.get(s.id);
      if (ops) return withLog(s, capLog([...(was ?? []), ...ops]));
      if (unknown.has(s.id)) return withLog(s, capLog([...(was ?? []), { id: newId(), kind: "barrier" }]));
      // (A log only grows: now's, where the step changed only cells.)
      return sheetById(now, s.id) ? withLog(s, was) : s;
    });
    // (The very version from before when that changes nothing: the saver sees it is what it saved.)
    return { wb: sheets.every((s, i) => s === to.sheets[i]) ? to : { ...to, sheets } };
  }
  // A step that changed cells only.
  if (!back.size && !unknown.size) return mergedOrRefused(lineUp(from, to, now, true), now);
  const [unknownId] = unknown;
  if (unknownId !== undefined) return { refused: "unknown", sheetId: unknownId };
  for (const [id, ops] of back) {
    const n = sheetById(now, id);
    // A sheet deleted since: nothing to take back there (the merge leaves it deleted).
    if (!n) {
      back.delete(id);
      continue;
    }
    const since = opsSince(sheetById(from, id)!.log, n.log);
    if (!since) return { refused: "unknown", sheetId: id };
    if (netOps(since).length) return { refused: "moved", sheetId: id };
    // Taking back an insert deletes its rows again: not when someone has written into them since.
    if (destroysNew(ops, id, from, now, true)) return { refused: "deleted", sheetId: id };
  }
  // Both in the rows and columns from before the step; `to` is there already, and its log is
  // taken as far as `from`'s now goes, so only `now` has changes of its own.
  const f = replayAll(from, back);
  if (!f.ok) return { refused: f.why, sheetId: f.about };
  const n = replayAll(now, back);
  if (!n.ok) return { refused: n.why, sheetId: n.about };
  const to2: Workbook = { ...to, sheets: to.sheets.map((s) => (back.has(s.id) ? withLog(s, sheetById(f.wb, s.id)?.log) : s)) };
  return mergedOrRefused(lineUp(f.wb, to2, n.wb, true), now);
}

/** Lined-up versions merged, or why not: undo never makes a copy. */
function mergedOrRefused(l: LinedUp, now: Workbook): TakeBack {
  const [id] = l.conflicts;
  if (id !== undefined) return { refused: l.plans.get(id)?.why ?? "moved", sheetId: id };
  const kept: Kept = { cells: [], sheets: [], other: false };
  const wb = mergeLinedUp(l, guessLocale(now), undefined, kept);
  return kept.cells.length || kept.sheets.length || kept.other ? { wb, kept } : { wb };
}
