// The log of a sheet's changes of rows and columns (Sheet.log): ops.ts writes down every insert and
// delete of rows or columns, every sort and every cut-and-paste move, each with a random id. Two
// versions of a workbook can then be lined up before they are merged (collab.ts): what one person
// did to the rows is done to the other person's version too, so everyone's edits stay on the rows
// they were made on. Undo uses it to take a change back on a version others have edited since,
// and the editor to keep the selection and the cell being typed into on their cells when someone
// else's change of rows arrives.
//
// The log only grows (an undo is a new entry that takes an older one back), and only its newest
// entries are kept. A version whose log doesn't hold the newest entry of the version it was made
// from can't be lined up with it: merging then keeps both versions instead of guessing.
//
// Imports only from types.ts: doc.ts, which stays light, checks stored logs with it.

import { MAX_COLS, MAX_ROWS, type Area, type Pos, type Sheet, type SheetOp } from "./types";

/** A sheet keeps at most this many entries… */
export const LOG_ENTRIES = 50;
/** …and sort orders of at most this many rows in all (a longer sort is kept as a barrier). */
export const LOG_SORT_ROWS = 10000;

const sortRows = (op: SheetOp) => (op.kind === "sort" ? op.order.length : 0);
const barrier = (id: string): SheetOp => ({ id, kind: "barrier" });

/**
 * The newest entries within the limits. When older ones have to go, the oldest one kept becomes a
 * barrier: what happened up to it is no longer known, so a version older than that can't be lined
 * up any more (and isn't mistaken for one that can).
 */
export function capLog(log: SheetOp[]): SheetOp[] {
  let start = log.length;
  let rows = 0;
  while (start > 0 && log.length - start < LOG_ENTRIES && rows + sortRows(log[start - 1]) <= LOG_SORT_ROWS) {
    start--;
    rows += sortRows(log[start]);
  }
  if (start === 0) return log;
  // Even the newest entry is too long alone (a sort of very many rows): only a barrier is left.
  if (start === log.length) return [barrier(log[log.length - 1].id)];
  const kept = log.slice(start);
  kept[0] = barrier(kept[0].id);
  return kept;
}

/** The sheet with `op` written into its log. */
export function withOp(sheet: Sheet, op: SheetOp): Sheet {
  return { ...sheet, log: capLog([...(sheet.log ?? []), op]) };
}

/**
 * What a version did to a sheet's rows and columns since an older version it was made from
 * (`base`): the entries of its log after the newest entry of base's log, oldest first. null when
 * that can't be told (base's newest entry isn't in it: too much happened since, or the version
 * comes from somewhere else) or can't be done again elsewhere (a barrier among them).
 */
export function opsSince(base: readonly SheetOp[] | undefined, side: readonly SheetOp[] | undefined): SheetOp[] | null {
  const b = base ?? [];
  const s = side ?? [];
  let from = 0;
  if (b.length) {
    const newest = b[b.length - 1].id;
    let i = s.length - 1;
    while (i >= 0 && s[i].id !== newest) i--;
    if (i < 0) return null;
    from = i + 1;
  }
  const out = s.slice(from);
  return out.some((op) => op.kind === "barrier") ? null : out;
}

/**
 * The entries that still count once every undo or redo has cancelled the entry right before it
 * that it takes back (an insert and its undo leave the rows as they were).
 */
export function netOps(ops: readonly SheetOp[]): SheetOp[] {
  const out: SheetOp[] = [];
  for (const op of ops) {
    if (op.inv !== undefined && out.length && out[out.length - 1].id === op.inv) out.pop();
    else out.push(op);
  }
  return out;
}

/** The change that takes `op` back, as a new entry (`id`) naming it in `inv`; null for a barrier. */
export function inverseOp(op: SheetOp, id: string): SheetOp | null {
  switch (op.kind) {
    case "insertRows":
      return { id, inv: op.id, kind: "deleteRows", at: op.at, count: op.count };
    case "deleteRows":
      return { id, inv: op.id, kind: "insertRows", at: op.at, count: op.count };
    case "insertCols":
      return { id, inv: op.id, kind: "deleteCols", at: op.at, count: op.count };
    case "deleteCols":
      return { id, inv: op.id, kind: "insertCols", at: op.at, count: op.count };
    case "sort": {
      // Row r0 + i holds what was in row r0 + order[i]; back: row r0 + order[i] gets row r0 + i.
      const order = new Array<number>(op.order.length);
      op.order.forEach((from, i) => {
        order[from] = i;
      });
      return { id, inv: op.id, kind: "sort", r0: op.r0, c0: op.c0, c1: op.c1, order };
    }
    case "move": {
      const to = { r0: op.to.row, c0: op.to.col, r1: op.to.row + op.from.r1 - op.from.r0, c1: op.to.col + op.from.c1 - op.from.c0 };
      return { id, inv: op.id, kind: "move", src: op.dst, from: to, dst: op.src, to: { row: op.from.r0, col: op.from.c0 } };
    }
    case "barrier":
      return null;
  }
}

// ----------------------------------------------------------------------------------------------
// Following cells through changes (the editor's selection, the cell being typed into, what was cut)

/**
 * Where a cell of sheet `sheetId` is after `ops` (entries of that sheet's log, oldest first): its
 * new address, or null when it isn't on the sheet any more (its row or column deleted, or cut and
 * pasted to another sheet).
 */
export function followCell(ops: readonly SheetOp[], sheetId: string, pos: Pos): Pos | null {
  let { row, col } = pos;
  for (const op of ops) {
    switch (op.kind) {
      case "insertRows":
        if (row >= op.at) row += op.count;
        break;
      case "deleteRows":
        if (row >= op.at + op.count) row -= op.count;
        else if (row >= op.at) return null;
        break;
      case "insertCols":
        if (col >= op.at) col += op.count;
        break;
      case "deleteCols":
        if (col >= op.at + op.count) col -= op.count;
        else if (col >= op.at) return null;
        break;
      case "sort":
        if (col >= op.c0 && col <= op.c1 && row >= op.r0 && row < op.r0 + op.order.length) row = op.r0 + op.order.indexOf(row - op.r0);
        break;
      case "move":
        // (Cells pasted over this one replace its content; the cell itself stays where it is.)
        if (op.src === sheetId && row >= op.from.r0 && row <= op.from.r1 && col >= op.from.c0 && col <= op.from.c1) {
          if (op.dst !== sheetId) return null;
          row += op.to.row - op.from.r0;
          col += op.to.col - op.from.c0;
        }
        break;
      case "barrier":
        return null;
    }
  }
  return { row, col };
}

/** Rows (or columns) i0…i1 after `count` of them were deleted at `at`: the part left, or null. */
function shrink(i0: number, i1: number, at: number, count: number): [number, number] | null {
  const end = at + count - 1;
  if (i1 < at) return [i0, i1];
  if (i0 > end) return [i0 - count, i1 - count];
  const left = Math.max(0, at - i0) + Math.max(0, i1 - end);
  return left ? [Math.min(i0, at), Math.min(i0, at) + left - 1] : null;
}

/**
 * An area of sheet `sheetId` after `ops`: moved along with its cells, smaller where rows or
 * columns of it were deleted, bigger where some were inserted inside it. null when it is gone or
 * its cells don't stay together (a sort or a cut and paste through part of it).
 */
export function followArea(ops: readonly SheetOp[], sheetId: string, area: Area): Area | null {
  let { r0, c0, r1, c1 } = area;
  for (const op of ops) {
    switch (op.kind) {
      case "insertRows":
        if (r0 >= op.at) r0 += op.count;
        if (r1 >= op.at) r1 += op.count;
        break;
      case "insertCols":
        if (c0 >= op.at) c0 += op.count;
        if (c1 >= op.at) c1 += op.count;
        break;
      case "deleteRows": {
        const left = shrink(r0, r1, op.at, op.count);
        if (!left) return null;
        [r0, r1] = left;
        break;
      }
      case "deleteCols": {
        const left = shrink(c0, c1, op.at, op.count);
        if (!left) return null;
        [c0, c1] = left;
        break;
      }
      case "sort": {
        const b1 = op.r0 + op.order.length - 1;
        if (c1 < op.c0 || c0 > op.c1 || r1 < op.r0 || r0 > b1) break;
        // All rows of the sorted block: the same cells, in another order.
        if (r0 <= op.r0 && r1 >= b1) break;
        // One row inside the sorted columns goes where its cells went.
        if (r0 !== r1 || c0 < op.c0 || c1 > op.c1) return null;
        r0 = r1 = op.r0 + op.order.indexOf(r0 - op.r0);
        break;
      }
      case "move": {
        const f = op.from;
        if (op.src !== sheetId || r1 < f.r0 || r0 > f.r1 || c1 < f.c0 || c0 > f.c1) break;
        if (r0 < f.r0 || r1 > f.r1 || c0 < f.c0 || c1 > f.c1 || op.dst !== sheetId) return null;
        const dr = op.to.row - f.r0;
        const dc = op.to.col - f.c0;
        r0 += dr;
        r1 += dr;
        c0 += dc;
        c1 += dc;
        break;
      }
      case "barrier":
        return null;
    }
  }
  return { r0, c0, r1, c1 };
}

// ----------------------------------------------------------------------------------------------
// Reading a stored log (normalizeWorkbook)

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
/** Ids as doc.ts takes them: short letters, digits and _ . : - (and nothing an object has built in). */
const goodId = (x: unknown): x is string => typeof x === "string" && /^[\w.:-]{1,64}$/.test(x) && x !== "__proto__" && x !== "constructor" && x !== "prototype";

function onlyKeys(x: Obj, keys: readonly string[]): boolean {
  for (const k in x) if (!keys.includes(k)) return false;
  return true;
}

const ROWCOL_KEYS = ["id", "inv", "kind", "at", "count"];
const SORT_KEYS = ["id", "inv", "kind", "r0", "c0", "c1", "order"];
const MOVE_KEYS = ["id", "inv", "kind", "src", "from", "dst", "to"];

/**
 * One stored entry, when it is one this app can do again: the same object when it is right as it
 * is, a repaired copy (sheet ids of a move as they are now), or null.
 */
function readOp(x: Obj, own: string, sheetIds: ReadonlyMap<string, string>): SheetOp | null {
  if (x.inv !== undefined && !goodId(x.inv)) return null;
  switch (x.kind) {
    case "insertRows":
    case "deleteRows":
    case "insertCols":
    case "deleteCols": {
      const limit = x.kind === "insertRows" || x.kind === "deleteRows" ? MAX_ROWS : MAX_COLS;
      return isInt(x.at, 0, limit - 1) && isInt(x.count, 1, limit) && onlyKeys(x, ROWCOL_KEYS) ? (x as SheetOp) : null;
    }
    case "sort": {
      if (!isInt(x.r0, 0, MAX_ROWS - 1) || !isInt(x.c0, 0, MAX_COLS - 1) || !isInt(x.c1, x.c0, MAX_COLS - 1) || !onlyKeys(x, SORT_KEYS)) return null;
      const order = x.order;
      if (!Array.isArray(order) || !order.length || order.length > LOG_SORT_ROWS || x.r0 + order.length > MAX_ROWS) return null;
      // Every row of the block exactly once.
      const seen = new Uint8Array(order.length);
      for (const v of order) {
        if (!isInt(v, 0, order.length - 1) || seen[v]) return null;
        seen[v] = 1;
      }
      return x as SheetOp;
    }
    case "move": {
      // A sheet deleted since keeps its id: the entry still lines up versions that have it.
      const sheetRef = (v: unknown) => (typeof v === "string" ? (sheetIds.get(v) ?? (goodId(v) ? v : null)) : null);
      const src = sheetRef(x.src);
      const dst = sheetRef(x.dst);
      const f = x.from;
      const t = x.to;
      if (!src || !dst || (src !== own && dst !== own) || !isObj(f) || !isObj(t) || !onlyKeys(x, MOVE_KEYS)) return null;
      if (!onlyKeys(f, ["r0", "c0", "r1", "c1"]) || !onlyKeys(t, ["row", "col"])) return null;
      if (!isInt(f.r0, 0, MAX_ROWS - 1) || !isInt(f.r1, f.r0, MAX_ROWS - 1) || !isInt(f.c0, 0, MAX_COLS - 1) || !isInt(f.c1, f.c0, MAX_COLS - 1)) return null;
      if (!isInt(t.row, 0, MAX_ROWS - 1 - (f.r1 - f.r0)) || !isInt(t.col, 0, MAX_COLS - 1 - (f.c1 - f.c0))) return null;
      if (src === x.src && dst === x.dst) return x as SheetOp;
      const head = x.inv === undefined ? { id: x.id as string } : { id: x.id as string, inv: x.inv as string };
      return { ...head, kind: "move", src, from: f as Area, dst, to: t as Pos };
    }
    case "barrier":
      return onlyKeys(x, ["id", "kind"]) ? (x as SheetOp) : null;
  }
  return null;
}

/**
 * A stored log as this app can use it (normalizeWorkbook, doc.ts). An entry that isn't valid
 * becomes a barrier in its place (nothing after it is mistaken for lined up), ids are unique, the
 * limits hold, and an empty log is no log. `own`: the id of the sheet it belongs to; `sheetIds`:
 * the stored sheet ids → the ids the sheets have now. The same result on every device; `same`
 * when nothing had to change.
 */
export function readLog(raw: unknown, own: string, sheetIds: ReadonlyMap<string, string>): { log: SheetOp[] | undefined; same: boolean } {
  if (raw === undefined) return { log: undefined, same: true };
  if (!Array.isArray(raw) || !raw.length) return { log: undefined, same: false };
  let same = true;
  const ids = new Set<string>();
  const out: SheetOp[] = [];
  for (let i = 0; i < raw.length; i++) {
    const x: unknown = raw[i];
    const stored = isObj(x) && goodId(x.id) && !ids.has(x.id) ? x.id : null;
    let id = stored;
    for (let n = 0; id === null || ids.has(id); n++) id = n ? `log${i}_${n}` : `log${i}`;
    ids.add(id);
    const op = stored !== null ? readOp(x as Obj, own, sheetIds) : null;
    if (op !== x) same = false;
    out.push(op ?? barrier(id));
  }
  const log = capLog(out);
  if (log !== out) same = false;
  return same ? { log: raw as SheetOp[], same } : { log, same };
}
