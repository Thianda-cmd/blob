// Nachschlagen und Verweisen: SVERWEIS, WVERWEIS, XVERWEIS, VERWEIS, INDEX, VERGLEICH, XVERGLEICH,
// WAHL, ZEILE, SPALTE, ZEILEN, SPALTEN. Exact matches ignore case and understand wildcards (* ?) like Excel; approximate
// matches search sorted data the way Excel does (binary search, largest value ≤ the one sought).

import { hasWildcards, patternTooLong, textMatches } from "../criteria";
import type { Node } from "../parser";
import { compareValues, ERR, isErr, isMatrix, isRef, mkErr, Ref, type CellError, type Matrix, type Scalar, type Value } from "../values";
import type { Ctx, FnDef } from "./types";
import { asMatrix, broadcast, first, toBool, toInt, toNum, valueOf } from "./util";

type Vec = { values: Scalar[]; key: string | null };

/** The values of a row or column (a range or an array), with a cache key when it is a range. */
function vecOf(v: Value, ctx: Ctx, take?: "row0" | "col0"): Vec | CellError {
  if (isRef(v)) {
    let r = ctx.clip(v);
    if (take === "col0") r = new Ref(r.sheet, r.r0, r.c0, r.r1, r.c0);
    else if (take === "row0") r = new Ref(r.sheet, r.r0, r.c0, r.r0, r.c1);
    else if (r.rows > 1 && r.cols > 1) return ERR.na;
    const key = `${r.sheet}:${r.r0}:${r.c0}:${r.r1}:${r.c1}`;
    // Looked up again and again (SVERWEIS down a column): flatten the range once per calculation.
    const values = ctx.memo(`vec:${key}`, () => {
      const out: Scalar[] = [];
      for (const row of ctx.matrix(r)) for (const x of row) out.push(x);
      return out;
    });
    return { values, key };
  }
  const m = asMatrix(v as Scalar | Matrix);
  if (take === "col0") return { values: m.map((row) => row[0]), key: null };
  if (take === "row0") return { values: [...m[0]], key: null };
  if (m.length > 1 && m[0].length > 1) return ERR.na;
  const values: Scalar[] = [];
  for (const row of m) for (const x of row) values.push(x);
  return { values, key: null };
}

const sameKind = (a: Scalar, b: Scalar) => typeof a === typeof b && a !== null && !isErr(a);

/**
 * Exact match (case-insensitive, wildcards in text): first index or -1. An empty lookup cell
 * (null) finds nothing, like Excel: a SVERWEIS filled down into rows without a sample ID shows #NV
 * there, not the row whose key is 0.
 */
function exactIndex(vec: Vec, t: Scalar, ctx: Ctx, reverse = false): number {
  if (t === null) return -1;
  if (typeof t === "string" && hasWildcards(t)) {
    const n = vec.values.length;
    for (let k = 0; k < n; k++) {
      const i = reverse ? n - 1 - k : k;
      const v = vec.values[i];
      if (typeof v === "string" && textMatches(v, t)) return i;
    }
    return -1;
  }
  // Big ranges looked up again and again (SVERWEIS down a column) get an index once per calculation.
  if (vec.key && vec.values.length > 64 && !reverse) {
    const index = ctx.memo(`exact:${vec.key}`, () => {
      const m = new Map<string, number>();
      vec.values.forEach((v, i) => {
        const k = hashKey(v);
        if (k !== null && !m.has(k)) m.set(k, i);
      });
      return m;
    });
    const k = hashKey(t);
    return k === null ? -1 : (index.get(k) ?? -1);
  }
  const n = vec.values.length;
  for (let k = 0; k < n; k++) {
    const i = reverse ? n - 1 - k : k;
    const v = vec.values[i];
    if (sameKind(v, t) && compareValues(v as Exclude<Scalar, CellError>, t as Exclude<Scalar, CellError>) === 0) return i;
  }
  return -1;
}

function hashKey(v: Scalar): string | null {
  if (typeof v === "number") return `n${Number(v.toPrecision(15))}`;
  if (typeof v === "string") return `s${v.toLowerCase()}`;
  if (typeof v === "boolean") return `b${v}`;
  return null;
}

/**
 * Binary search like Excel's: the last position whose value is ≤ target (ascending data), or
 * with `descending` the last position whose value is ≥ target. Values of another kind (text
 * among numbers, empty cells) are stepped over; an empty lookup cell finds nothing.
 */
function approxIndex(values: Scalar[], t: Scalar, descending = false): number {
  if (t === null) return -1;
  let lo = 0;
  let hi = values.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let m = mid;
    while (m >= lo && !sameKind(values[m], t)) m--;
    if (m < lo) {
      m = mid + 1;
      while (m <= hi && !sameKind(values[m], t)) m++;
      if (m > hi) break;
    }
    const c = compareValues(values[m] as Exclude<Scalar, CellError>, t as Exclude<Scalar, CellError>);
    if (descending ? c >= 0 : c <= 0) {
      found = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return found;
}

/** XLOOKUP's "exact or next smaller / larger" without assuming sorted data (an empty lookup cell finds nothing). */
function nearestIndex(values: Scalar[], t: Scalar, larger: boolean, reverse: boolean): number {
  if (t === null) return -1;
  let best = -1;
  const n = values.length;
  for (let k = 0; k < n; k++) {
    const i = reverse ? n - 1 - k : k;
    const v = values[i];
    if (!sameKind(v, t)) continue;
    const c = compareValues(v as Exclude<Scalar, CellError>, t as Exclude<Scalar, CellError>);
    if (c === 0) return i;
    if (larger ? c > 0 : c < 0) {
      if (best < 0) best = i;
      else {
        const d = compareValues(v as Exclude<Scalar, CellError>, values[best] as Exclude<Scalar, CellError>);
        if (larger ? d < 0 : d > 0) best = i;
      }
    }
  }
  return best;
}

/** A cell of a table (range or array) by 0-based row and column. */
function cellOf(table: Value, i: number, j: number, ctx: Ctx): Scalar {
  if (isRef(table)) return ctx.cell(table.sheet, table.r0 + i, table.c0 + j);
  return asMatrix(table as Scalar | Matrix)[i]?.[j] ?? null;
}

function dims(v: Value, ctx: Ctx): { rows: number; cols: number } {
  if (isRef(v)) {
    const r = ctx.clip(v);
    return { rows: r.rows, cols: r.cols };
  }
  const m = asMatrix(v as Scalar | Matrix);
  return { rows: m.length, cols: m[0].length };
}

function lookupTable(args: Value[], ctx: Ctx, horizontal: boolean): Value {
  const [lookup, table, idx0, approx0] = args;
  const target = lookup as Scalar;
  if (isErr(target)) return target;
  const idx = toInt(idx0 as Scalar, ctx);
  if (typeof idx !== "number") return idx;
  const approx = approx0 === undefined ? true : toBool(approx0 as Scalar, ctx);
  if (isErr(approx)) return approx;
  const d = dims(table, ctx);
  if (idx < 1) return ERR.value;
  if (idx > (horizontal ? d.rows : d.cols)) return mkErr("#REF!", "index");
  const vec = vecOf(table, ctx, horizontal ? "row0" : "col0");
  if (isErr(vec)) return vec;
  const tooLong = approx ? null : patternTooLong(target);
  if (tooLong) return tooLong;
  const pos = approx ? approxIndex(vec.values, target) : exactIndex(vec, target, ctx);
  if (pos < 0) return ERR.notFound;
  const v = horizontal ? cellOf(table, idx - 1, pos, ctx) : cellOf(table, pos, idx - 1, ctx);
  return v;
}

/** INDEX on a reference gives a reference (so ZEILE(INDEX(…)) and A1:INDEX(…) work). */
function indexOf(args: Value[], ctx: Ctx): Value {
  const arr = args[0];
  const rowArg = args.length > 1 ? (args[1] as Scalar) : null;
  const colArg = args.length > 2 ? (args[2] as Scalar) : null;
  if (args.length > 3 && args[3] !== null) {
    const area = toInt(args[3] as Scalar, ctx);
    if (typeof area !== "number") return area;
    if (area !== 1) return mkErr("#REF!", "index");
  }
  let r = rowArg === null ? 0 : toInt(rowArg, ctx);
  if (typeof r !== "number") return r;
  let c = colArg === null ? 0 : toInt(colArg, ctx);
  if (typeof c !== "number") return c;
  if (r < 0 || c < 0) return ERR.value;
  const rows = isRef(arr) ? arr.rows : asMatrix(arr as Scalar | Matrix).length;
  const cols = isRef(arr) ? arr.cols : asMatrix(arr as Scalar | Matrix)[0].length;
  // INDEX(A1:E1; 3) means the third column of a single row.
  if (args.length === 2 && rows === 1 && cols > 1) {
    c = r;
    r = 1;
  } else if (args.length === 2 && cols === 1) c = 1;
  if (r > rows || c > cols) return mkErr("#REF!", "index");
  if (isRef(arr)) {
    const r0 = r === 0 ? arr.r0 : arr.r0 + r - 1;
    const r1 = r === 0 ? arr.r1 : r0;
    const c0 = c === 0 ? arr.c0 : arr.c0 + c - 1;
    const c1 = c === 0 ? arr.c1 : c0;
    return new Ref(arr.sheet, r0, c0, r1, c1);
  }
  const m = asMatrix(arr as Scalar | Matrix);
  if (r > 0 && c > 0) return m[r - 1][c - 1];
  if (r > 0) return [m[r - 1]];
  if (c > 0) return m.map((row) => [row[c - 1]]);
  return m;
}

/**
 * XVERWEIS's and XVERGLEICH's search: the position of `target` in one row or column (-1: not
 * found), with their match mode (0 exact, −1 or 1 the next smaller or larger, 2 wildcards) and
 * search mode (1 from the first, −1 from the last, ±2 binary).
 */
function xsearch(target: Scalar, lookArr: Value, modeArg: Value | undefined, searchArg: Value | undefined, ctx: Ctx): { pos: number; vertical: boolean; n: number } | CellError {
  const mode = modeArg !== undefined && modeArg !== null ? toInt(modeArg as Scalar, ctx) : 0;
  if (typeof mode !== "number") return mode;
  const search = searchArg !== undefined && searchArg !== null ? toInt(searchArg as Scalar, ctx) : 1;
  if (typeof search !== "number") return search;
  if (![0, -1, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search)) return ERR.value;
  const ld = dims(lookArr, ctx);
  if (ld.rows > 1 && ld.cols > 1) return ERR.value;
  const vertical = ld.cols === 1 && ld.rows >= 1;
  const vec = vecOf(lookArr, ctx);
  if (isErr(vec)) return vec;
  // Binary search modes give the same answers as a straight search on sorted data, so search straight.
  const reverse = search === -1 || search === -2;
  let pos: number;
  if (mode === 2) {
    const tooLong = patternTooLong(target);
    if (tooLong) return tooLong;
    pos = exactIndex({ values: vec.values, key: null }, target, ctx, reverse);
  } else if (mode === 0) {
    // Exact match: * and ? are ordinary characters here.
    const t = typeof target === "string" && hasWildcards(target) ? target.replace(/[*?~]/g, "~$&") : target;
    pos = exactIndex(reverse ? { values: vec.values, key: null } : vec, t, ctx, reverse);
  } else pos = nearestIndex(vec.values, target, mode === 1, reverse);
  return { pos, vertical, n: vertical ? ld.rows : ld.cols };
}

function xlookup(args: Value[], ctx: Ctx): Value {
  const target = args[0] as Scalar;
  if (isErr(target)) return target;
  const lookArr = args[1];
  const retArr = args[2];
  const notFound = args.length > 3 && args[3] !== null ? args[3] : undefined;
  const found = xsearch(target, lookArr, args[4], args[5], ctx);
  if (isErr(found)) return found;
  const { pos, vertical, n } = found;
  const rd = dims(retArr, ctx);
  if ((vertical ? rd.rows : rd.cols) !== n) return ERR.value;
  if (pos < 0) return notFound === undefined ? ERR.notFound : notFound;
  if (isRef(retArr)) {
    const r = ctx.clip(retArr);
    return vertical ? new Ref(r.sheet, r.r0 + pos, r.c0, r.r0 + pos, r.c1) : new Ref(r.sheet, r.r0, r.c0 + pos, r.r1, r.c0 + pos);
  }
  const m = asMatrix(retArr as Scalar | Matrix);
  return vertical ? [m[pos]] : m.map((row) => [row[pos]]);
}

function match(args: Value[], ctx: Ctx): Value {
  const target = args[0] as Scalar;
  if (isErr(target)) return target;
  const type = args.length > 2 && args[2] !== null ? toNum(args[2] as Scalar, ctx) : 1;
  if (typeof type !== "number") return type;
  const vec = vecOf(args[1], ctx);
  if (isErr(vec)) return vec;
  let pos: number;
  if (type === 0) {
    const tooLong = patternTooLong(target);
    if (tooLong) return tooLong;
    pos = exactIndex(vec, target, ctx);
  } else pos = approxIndex(vec.values, target, type < 0);
  return pos < 0 ? ERR.notFound : pos + 1;
}

/** XVERGLEICH: the position (from 1) of a value, searched like XVERWEIS does. */
function xmatch(args: Value[], ctx: Ctx): Value {
  const target = args[0] as Scalar;
  if (isErr(target)) return target;
  const found = xsearch(target, args[1], args[2], args[3], ctx);
  if (isErr(found)) return found;
  return found.pos < 0 ? ERR.notFound : found.pos + 1;
}

/**
 * VERWEIS: the largest value ≤ the one sought in sorted data (like VERGLEICH with 1), and the
 * value at the same place of the result row or column. Without one, a table answers from its last
 * column (taller than wide, searched in its first column) or its last row (searched in its first row).
 */
function lookup(args: Value[], ctx: Ctx): Value {
  const target = args[0] as Scalar;
  if (isErr(target)) return target;
  const where = args[1];
  const d = dims(where, ctx);
  let vec: Vec | CellError;
  let result: Value;
  let resultHorizontal: boolean;
  if (args.length > 2 && args[2] !== null) {
    if (d.rows > 1 && d.cols > 1) return ERR.na;
    vec = vecOf(where, ctx);
    result = args[2];
    const rd = dims(result, ctx);
    if (rd.rows > 1 && rd.cols > 1) return ERR.na;
    resultHorizontal = rd.rows === 1 && rd.cols > 1;
  } else {
    const wide = d.cols > d.rows;
    vec = vecOf(where, ctx, wide ? "row0" : "col0");
    // The last row or column of the table, as a range or array of its own.
    if (isRef(where)) {
      const r = ctx.clip(where);
      result = wide ? new Ref(r.sheet, r.r1, r.c0, r.r1, r.c1) : new Ref(r.sheet, r.r0, r.c1, r.r1, r.c1);
    } else {
      const m = asMatrix(where as Scalar | Matrix);
      result = wide ? [m[m.length - 1]] : m.map((row) => [row[row.length - 1]]);
    }
    resultHorizontal = wide;
  }
  if (isErr(vec)) return vec;
  const pos = approxIndex(vec.values, target);
  if (pos < 0) return ERR.notFound;
  if (isRef(result)) {
    // Like Excel, a result range shorter than the searched one goes on past its end (a single
    // cell in the direction of the search).
    const single = result.rows === 1 && result.cols === 1;
    const across = single ? d.rows === 1 && d.cols > 1 : resultHorizontal;
    return across ? ctx.cell(result.sheet, result.r0, result.c0 + pos) : ctx.cell(result.sheet, result.r0 + pos, result.c0);
  }
  const rd = dims(result, ctx);
  if (pos >= (resultHorizontal ? rd.cols : rd.rows)) return ERR.notFound;
  return resultHorizontal ? cellOf(result, 0, pos, ctx) : cellOf(result, pos, 0, ctx);
}

function choose(nodes: Node[], ctx: Ctx): Value {
  const idxV = valueOf(ctx.ev(nodes[0]), ctx);
  const pickOne = (x: Scalar): number | CellError => {
    if (isErr(x)) return x;
    const i = toInt(x, ctx);
    if (typeof i !== "number") return i;
    if (i < 1 || i >= nodes.length) return ERR.value;
    return i;
  };
  if (isMatrix(idxV) && (idxV.length > 1 || idxV[0].length > 1)) {
    // CHOOSE({1,2}; A; B): every element picks its own argument.
    const choices = nodes.slice(1).map((n) => (n.t === "miss" ? 0 : valueOf(ctx.ev(n), ctx)));
    return broadcast([idxV, ...choices], (xs) => {
      const i = pickOne(xs[0]);
      return typeof i === "number" ? xs[i] : i;
    });
  }
  const i = pickOne(first(idxV));
  if (typeof i !== "number") return i;
  const node = nodes[i];
  return node.t === "miss" ? 0 : ctx.ev(node);
}

export const LOOKUP: FnDef[] = [
  { name: "VLOOKUP", min: 3, max: 4, args: "srss", lookupValue: true, impl: (args, ctx) => lookupTable(args, ctx, false) },
  { name: "HLOOKUP", min: 3, max: 4, args: "srss", lookupValue: true, impl: (args, ctx) => lookupTable(args, ctx, true) },
  { name: "XLOOKUP", min: 3, max: 6, args: "srrvss", lookupValue: true, impl: (args, ctx) => xlookup(args, ctx) },
  { name: "MATCH", min: 2, max: 3, args: "srs", lookupValue: true, impl: (args, ctx) => match(args, ctx) },
  { name: "XMATCH", min: 2, max: 4, args: "srss", lookupValue: true, impl: (args, ctx) => xmatch(args, ctx) },
  { name: "LOOKUP", min: 2, max: 3, args: "srr", lookupValue: true, impl: (args, ctx) => lookup(args, ctx) },
  { name: "INDEX", min: 2, max: 4, args: "rsss", impl: (args, ctx) => indexOf(args, ctx) },
  { name: "CHOOSE", min: 2, max: 255, args: "s", lazy: choose },
  {
    name: "ROW",
    min: 0,
    max: 1,
    args: "r",
    impl: (args, ctx) => {
      if (!args.length || args[0] === null) return ctx.row >= 0 ? ctx.row + 1 : ERR.value;
      const r = args[0];
      if (!isRef(r)) return ERR.value;
      if (r.rows === 1) return r.r0 + 1;
      const c = ctx.clip(r);
      const out: Matrix = [];
      for (let i = c.r0; i <= c.r1; i++) out.push([i + 1]);
      return out;
    },
  },
  {
    name: "COLUMN",
    min: 0,
    max: 1,
    args: "r",
    impl: (args, ctx) => {
      if (!args.length || args[0] === null) return ctx.col >= 0 ? ctx.col + 1 : ERR.value;
      const r = args[0];
      if (!isRef(r)) return ERR.value;
      if (r.cols === 1) return r.c0 + 1;
      const c = ctx.clip(r);
      const line: Scalar[] = [];
      for (let j = c.c0; j <= c.c1; j++) line.push(j + 1);
      return [line];
    },
  },
  {
    name: "ROWS",
    min: 1,
    max: 1,
    args: "r",
    impl: ([a]) => (isRef(a) ? a.rows : isMatrix(a) ? a.length : 1),
  },
  {
    name: "COLUMNS",
    min: 1,
    max: 1,
    args: "r",
    impl: ([a]) => (isRef(a) ? a.cols : isMatrix(a) ? a[0].length : 1),
  },
];

