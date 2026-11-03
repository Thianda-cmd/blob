// Statistik: MITTELWERT, STABW.S, ZÄHLENWENN, QUANTIL, NORM.VERT, T.TEST, KONFIDENZ… with Excel's
// rules for which cells count (ranges: numbers only; direct arguments converted).

import { makeCriterion, type Criterion } from "../criteria";
import { ERR, isErr, isMatrix, isRef, mkErr, numbersEqual, type CellError, type Matrix, type Scalar, type Value } from "../values";
import { chiSqCdf, chiSqInv, chiSqPdf, chiSqUpper, fCdf, fInv, fPdf, fUpper, normCdf, normInv, normPdf, tCdf, tInv, tPdf, tTwoTail, tUpper } from "./distributions";
import type { Ctx, FnDef } from "./types";
import { asMatrix, collectNumbers, devSq, eachValue, first, mean, numFn, numResult, numbersWithGaps, pairs, sum, toBool, toInt, toNum, why } from "./util";

// ----------------------------------------------------------------------------------------------
// Ranges with criteria (…IF, …IFS)

type Grid = { rows: number; cols: number; get(i: number, j: number): Scalar };

function gridOf(v: Value, ctx: Ctx): Grid {
  if (isRef(v)) {
    const r = ctx.clip(v);
    return { rows: r.rows, cols: r.cols, get: (i, j) => ctx.cell(r.sheet, r.r0 + i, r.c0 + j) };
  }
  const m = asMatrix(v as Scalar | Matrix);
  return { rows: m.length, cols: m[0].length, get: (i, j) => m[i]?.[j] ?? null };
}

/** SUMIF's sum range: the same size as the criteria range, from the sum range's top-left cell (like Excel). */
function resizedLike(v: Value, like: Grid, ctx: Ctx): Grid {
  if (isRef(v)) return { rows: like.rows, cols: like.cols, get: (i, j) => ctx.cell(v.sheet, v.r0 + i, v.c0 + j) };
  return gridOf(v, ctx);
}

/** The values of `target` (or the first range) where every (range, criterion) pair matches; null when sizes differ. */
function matching(target: Grid, conds: { grid: Grid; test: Criterion }[]): Scalar[] | CellError {
  for (const c of conds) if (c.grid.rows !== target.rows || c.grid.cols !== target.cols) return ERR.value;
  const out: Scalar[] = [];
  for (let i = 0; i < target.rows; i++) {
    for (let j = 0; j < target.cols; j++) {
      let ok = true;
      for (const c of conds) {
        if (!c.test(c.grid.get(i, j))) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(target.get(i, j));
    }
  }
  return out;
}

function critScalar(v: Value, ctx: Ctx): Scalar {
  return first(isRef(v) ? ctx.deref(v) : (v as Scalar | Matrix));
}

/** (sum_range | average_range | min_range), then pairs of criteria range and criterion. */
function ifsValues(args: Value[], ctx: Ctx, targetFirst: boolean): Scalar[] | CellError {
  const target = targetFirst ? gridOf(args[0], ctx) : null;
  const conds: { grid: Grid; test: Criterion }[] = [];
  for (let i = targetFirst ? 1 : 0; i + 1 < args.length; i += 2) {
    const test = makeCriterion(critScalar(args[i + 1], ctx), ctx.locale);
    if (isErr(test)) return test;
    conds.push({ grid: gridOf(args[i], ctx), test });
  }
  if ((args.length - (targetFirst ? 1 : 0)) % 2 !== 0) return ERR.value;
  return matching(target ?? conds[0].grid, conds);
}

/** SUMIF / AVERAGEIF: (range, criterion, [sum range]). */
function ifValues(args: Value[], ctx: Ctx): Scalar[] | CellError {
  const range = gridOf(args[0], ctx);
  const test = makeCriterion(critScalar(args[1], ctx), ctx.locale);
  if (isErr(test)) return test;
  const target = args.length > 2 && args[2] !== null ? resizedLike(args[2], range, ctx) : range;
  return matching(target, [{ grid: range, test }]);
}

const numbersOf = (vals: Scalar[]): number[] | CellError => {
  const out: number[] = [];
  for (const v of vals) {
    if (isErr(v)) return v;
    if (typeof v === "number") out.push(v);
  }
  return out;
};

// ----------------------------------------------------------------------------------------------
// Helpers

const SIZES = why.sizes();

/** `counts` "a": the A forms, which count text as 0 (for the message when there are too few). */
function variance(xs: number[], sample: boolean, counts?: "a"): number | CellError {
  const n = xs.length;
  if (n < (sample ? 2 : 1)) return why.few(sample ? 2 : 1, n, "#DIV/0!", counts);
  return devSq(xs) / (sample ? n - 1 : n);
}

const stdev = (xs: number[], sample: boolean, counts?: "a"): number | CellError => {
  const v = variance(xs, sample, counts);
  return typeof v === "number" ? Math.sqrt(v) : v;
};

const aggregate = (name: string, f: (xs: number[]) => number | CellError, mode: "plain" | "a" = "plain"): FnDef => ({
  name,
  min: 1,
  max: 255,
  args: "r",
  impl: (args, ctx) => {
    const xs = collectNumbers(args, ctx, mode);
    if (isErr(xs)) return xs;
    const r = f(xs);
    return typeof r === "number" ? numResult(r) : r;
  },
});

function sorted(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

function percentileInc(xs: number[], k: number): number | CellError {
  if (!xs.length) return why.few(1, 0, "#NUM!");
  if (k < 0 || k > 1) return why.arg(2, "p");
  const s = sorted(xs);
  const pos = k * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

/**
 * PERCENTILE.EXC: the rank k·(n + 1) must lie between 1 and n, so k between 1/(n + 1) and
 * n/(n + 1); in between it interpolates like PERCENTILE.INC.
 */
function percentileExc(xs: number[], k: number): number | CellError {
  const n = xs.length;
  if (!n) return why.few(1, 0, "#NUM!");
  // k·(n + 1) to 15 digits: 0,9 · 10 is 9.000000000000002 in binary, but the 9th value is meant.
  const h = Number((k * (n + 1)).toPrecision(15));
  if (!(k > 0 && k < 1) || h < 1 || h > n) return why.range(2, 1 / (n + 1), n / (n + 1));
  const s = sorted(xs);
  const i = Math.floor(h);
  return i >= n ? s[n - 1] : s[i - 1] + (h - i) * (s[i] - s[i - 1]);
}

function median(xs: number[]): number | CellError {
  if (!xs.length) return why.few(1, 0, "#NUM!");
  const s = sorted(xs);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The numbers of one array argument (LARGE, PERCENTILE…), skipping text and empty cells. */
function arrayNumbers(v: Value, ctx: Ctx): number[] | CellError {
  return collectNumbers([isRef(v) || isMatrix(v) ? v : [[v as Scalar]]], ctx);
}

function correlation(ys: Value, xs: Value, ctx: Ctx): { r: number; n: number; sxx: number; syy: number; sxy: number; mx: number; my: number } | CellError {
  const p = pairs(ys, xs, ctx);
  if (isErr(p)) return p;
  const n = p.x.length;
  if (n < 2) return why.few(2, n, "#DIV/0!", "pairs");
  const mx = mean(p.x);
  const my = mean(p.y);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = p.x[i] - mx;
    const dy = p.y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx === 0 || syy === 0) return why.same();
  return { r: sxy / Math.sqrt(sxx * syy), n, sxx, syy, sxy, mx, my };
}

function covariance(a: Value, b: Value, ctx: Ctx, sample: boolean): number | CellError {
  const A = numbersWithGaps(a, ctx);
  if (isErr(A)) return A;
  const B = numbersWithGaps(b, ctx);
  if (isErr(B)) return B;
  if (A.values.length !== B.values.length) return SIZES;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < A.values.length; i++) {
    if (Number.isNaN(A.values[i]) || Number.isNaN(B.values[i])) continue;
    x.push(A.values[i]);
    y.push(B.values[i]);
  }
  const n = x.length;
  if (n < (sample ? 2 : 1)) return why.few(sample ? 2 : 1, n, "#DIV/0!", "pairs");
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (sample ? n - 1 : n);
}

/** Student's t-test (T.TEST): type 1 paired, 2 equal variances, 3 unequal (Welch). */
function tTest(a: Value, b: Value, tails: number, type: number, ctx: Ctx): number | CellError {
  if (tails !== 1 && tails !== 2) return why.arg(3, "opt");
  if (type < 1 || type > 3) return why.arg(4, "opt");
  const A = numbersWithGaps(a, ctx);
  if (isErr(A)) return A;
  const B = numbersWithGaps(b, ctx);
  if (isErr(B)) return B;
  let t: number;
  let df: number;
  if (type === 1) {
    if (A.values.length !== B.values.length) return SIZES;
    const d: number[] = [];
    for (let i = 0; i < A.values.length; i++) {
      if (Number.isNaN(A.values[i]) || Number.isNaN(B.values[i])) continue;
      d.push(A.values[i] - B.values[i]);
    }
    const n = d.length;
    if (n < 2) return why.few(2, n, "#DIV/0!", "pairs");
    const sd = Math.sqrt(devSq(d) / (n - 1));
    if (sd === 0) return why.same();
    t = mean(d) / (sd / Math.sqrt(n));
    df = n - 1;
  } else {
    const x = A.values.filter((v) => !Number.isNaN(v));
    const y = B.values.filter((v) => !Number.isNaN(v));
    const n1 = x.length;
    const n2 = y.length;
    if (n1 < 2 || n2 < 2) return why.fewEach(2, Math.min(n1, n2));
    const v1 = devSq(x) / (n1 - 1);
    const v2 = devSq(y) / (n2 - 1);
    const diff = mean(x) - mean(y);
    if (type === 2) {
      df = n1 + n2 - 2;
      const pooled = ((n1 - 1) * v1 + (n2 - 1) * v2) / df;
      const se = Math.sqrt(pooled * (1 / n1 + 1 / n2));
      if (se === 0) return why.same();
      t = diff / se;
    } else {
      const s1 = v1 / n1;
      const s2 = v2 / n2;
      const se = Math.sqrt(s1 + s2);
      if (se === 0) return why.same();
      t = diff / se;
      df = ((s1 + s2) * (s1 + s2)) / ((s1 * s1) / (n1 - 1) + (s2 * s2) / (n2 - 1));
    }
  }
  const at = Math.abs(t);
  return tails === 1 ? tUpper(at, df) : tTwoTail(at, df);
}

/** RANG and its kin: how many numbers rank before x, and how many equal it (#NV when x isn't in the list). */
function rankOf([x, ref, order]: Value[], ctx: Ctx): { better: number; ties: number } | CellError {
  const n = toNum(x as Scalar, ctx);
  if (typeof n !== "number") return n;
  const xs = arrayNumbers(ref, ctx);
  if (isErr(xs)) return xs;
  const asc = order === undefined || order === null ? false : toBool(order as Scalar, ctx);
  if (isErr(asc)) return asc;
  let better = 0;
  let ties = 0;
  for (const v of xs) {
    if (numbersEqual(v, n)) ties++;
    else if (asc ? v < n : v > n) better++;
  }
  return ties ? { better, ties } : ERR.notFound;
}

/** KONFIDENZ's arguments: Alpha between 0 and 1, a standard deviation above 0, at least one value. */
function confidenceArgs(alpha: number, sd: number, n: number): CellError | null {
  if (!(alpha > 0 && alpha < 1)) return why.arg(1, "p");
  if (sd <= 0) return why.arg(2, "gt0");
  if (n < 1) return why.arg(3, "ge1");
  return null;
}

/** Excel's largest degrees of freedom for the chi-squared and F distributions. */
const MAX_DF = 1e10;

/** The F distribution's arguments: x not negative, both degrees of freedom from 1 to 10^10. */
function fArgs(x: number, d1: number, d2: number): CellError | null {
  if (x < 0) return why.arg(1, "ge0");
  if (d1 < 1 || d1 > MAX_DF) return why.range(2, 1, MAX_DF);
  if (d2 < 1 || d2 > MAX_DF) return why.range(3, 1, MAX_DF);
  return null;
}

/** The chi-squared distribution's arguments: x not negative, degrees of freedom from 1 to 10^10. */
function chiArgs(x: number, k: number): CellError | null {
  if (x < 0) return why.arg(1, "ge0");
  if (k < 1 || k > MAX_DF) return why.range(2, 1, MAX_DF);
  return null;
}

// ----------------------------------------------------------------------------------------------

export const STATS: FnDef[] = [
  aggregate("AVERAGE", (xs) => (xs.length ? sum(xs) / xs.length : why.few(1, 0))),
  aggregate("AVERAGEA", (xs) => (xs.length ? sum(xs) / xs.length : why.few(1, 0, "#DIV/0!", "a")), "a"),
  aggregate("MEDIAN", median),
  aggregate("MIN", (xs) => (xs.length ? Math.min(...xs) : 0)),
  aggregate("MAX", (xs) => (xs.length ? Math.max(...xs) : 0)),
  aggregate("STDEV.S", (xs) => stdev(xs, true)),
  aggregate("STDEV", (xs) => stdev(xs, true)),
  aggregate("STDEV.P", (xs) => stdev(xs, false)),
  aggregate("STDEVP", (xs) => stdev(xs, false)),
  // The "A" forms count text in ranges as 0 and TRUE as 1, like MITTELWERTA.
  aggregate("STDEVA", (xs) => stdev(xs, true, "a"), "a"),
  aggregate("STDEVPA", (xs) => stdev(xs, false, "a"), "a"),
  aggregate("VAR.S", (xs) => variance(xs, true)),
  aggregate("VAR", (xs) => variance(xs, true)),
  aggregate("VAR.P", (xs) => variance(xs, false)),
  aggregate("VARP", (xs) => variance(xs, false)),
  aggregate("VARA", (xs) => variance(xs, true, "a"), "a"),
  aggregate("VARPA", (xs) => variance(xs, false, "a"), "a"),
  aggregate("AVEDEV", (xs) => {
    if (!xs.length) return why.few(1, 0, "#NUM!");
    const m = mean(xs);
    return sum(xs.map((x) => Math.abs(x - m))) / xs.length;
  }),
  aggregate("DEVSQ", (xs) => (xs.length ? devSq(xs) : why.few(1, 0, "#NUM!"))),
  aggregate("GEOMEAN", (xs) => {
    if (!xs.length) return why.few(1, 0, "#NUM!");
    if (xs.some((x) => x <= 0)) return why.arg(1, "pos");
    return Math.exp(sum(xs.map(Math.log)) / xs.length);
  }),
  aggregate("HARMEAN", (xs) => {
    if (!xs.length) return why.few(1, 0, "#NUM!");
    if (xs.some((x) => x <= 0)) return why.arg(1, "pos");
    return xs.length / sum(xs.map((x) => 1 / x));
  }),
  aggregate("SKEW", (xs) => {
    const n = xs.length;
    if (n < 3) return why.few(3, n);
    const m = mean(xs);
    const s = Math.sqrt(devSq(xs) / (n - 1));
    if (s === 0) return why.same();
    let acc = 0;
    for (const x of xs) acc += Math.pow((x - m) / s, 3);
    return (n / ((n - 1) * (n - 2))) * acc;
  }),
  aggregate("KURT", (xs) => {
    const n = xs.length;
    if (n < 4) return why.few(4, n);
    const m = mean(xs);
    const s = Math.sqrt(devSq(xs) / (n - 1));
    if (s === 0) return why.same();
    let acc = 0;
    for (const x of xs) acc += Math.pow((x - m) / s, 4);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * acc - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  }),
  {
    name: "MODE.SNGL",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      const xs = collectNumbers(args, ctx);
      if (isErr(xs)) return xs;
      const counts = new Map<number, number>();
      let best: number | null = null;
      let bestCount = 1;
      for (const x of xs) {
        const c = (counts.get(x) ?? 0) + 1;
        counts.set(x, c);
      }
      // The first value (in the data's order) with the highest count, like Excel.
      for (const x of xs) {
        const c = counts.get(x)!;
        if (c > bestCount) {
          best = x;
          bestCount = c;
        }
      }
      return best === null ? why.noRepeat() : best;
    },
  },
  {
    name: "COUNT",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      let n = 0;
      eachValue(args, ctx, (v, inRange) => {
        if (typeof v === "number") n++;
        else if (!inRange && (typeof v === "boolean" || (typeof v === "string" && typeof toNum(v, ctx) === "number"))) n++;
      });
      return n;
    },
  },
  {
    name: "COUNTA",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      let n = 0;
      eachValue(args, ctx, (v) => {
        if (v !== null) n++;
      });
      return n;
    },
  },
  {
    name: "COUNTBLANK",
    min: 1,
    max: 1,
    args: "r",
    impl: ([a], ctx) => {
      let n = 0;
      const g = gridOf(a, ctx);
      for (let i = 0; i < g.rows; i++) for (let j = 0; j < g.cols; j++) if (g.get(i, j) === null || g.get(i, j) === "") n++;
      return n;
    },
  },
  {
    name: "COUNTIF",
    min: 2,
    max: 2,
    args: "rs",
    impl: (args, ctx) => {
      const vals = ifValues(args, ctx);
      return isErr(vals) ? vals : vals.length;
    },
  },
  {
    name: "COUNTIFS",
    min: 2,
    max: 254,
    args: "/rs",
    impl: (args, ctx) => {
      const vals = ifsValues(args, ctx, false);
      return isErr(vals) ? vals : vals.length;
    },
  },
  {
    name: "SUMIF",
    min: 2,
    max: 3,
    args: "rsr",
    impl: (args, ctx) => {
      const vals = ifValues(args, ctx);
      if (isErr(vals)) return vals;
      const xs = numbersOf(vals);
      return isErr(xs) ? xs : numResult(sum(xs));
    },
  },
  {
    name: "SUMIFS",
    min: 3,
    max: 255,
    args: "r/rs",
    impl: (args, ctx) => {
      const vals = ifsValues(args, ctx, true);
      if (isErr(vals)) return vals;
      const xs = numbersOf(vals);
      return isErr(xs) ? xs : numResult(sum(xs));
    },
  },
  {
    name: "AVERAGEIF",
    min: 2,
    max: 3,
    args: "rsr",
    impl: (args, ctx) => {
      const vals = ifValues(args, ctx);
      if (isErr(vals)) return vals;
      const xs = numbersOf(vals);
      if (isErr(xs)) return xs;
      return xs.length ? numResult(sum(xs) / xs.length) : why.noMatch();
    },
  },
  {
    name: "AVERAGEIFS",
    min: 3,
    max: 255,
    args: "r/rs",
    impl: (args, ctx) => {
      const vals = ifsValues(args, ctx, true);
      if (isErr(vals)) return vals;
      const xs = numbersOf(vals);
      if (isErr(xs)) return xs;
      return xs.length ? numResult(sum(xs) / xs.length) : why.noMatch();
    },
  },
  {
    name: "MINIFS",
    min: 3,
    max: 255,
    args: "r/rs",
    impl: (args, ctx) => {
      const vals = ifsValues(args, ctx, true);
      if (isErr(vals)) return vals;
      const xs = numbersOf(vals);
      if (isErr(xs)) return xs;
      return xs.length ? Math.min(...xs) : 0;
    },
  },
  {
    name: "MAXIFS",
    min: 3,
    max: 255,
    args: "r/rs",
    impl: (args, ctx) => {
      const vals = ifsValues(args, ctx, true);
      if (isErr(vals)) return vals;
      const xs = numbersOf(vals);
      if (isErr(xs)) return xs;
      return xs.length ? Math.max(...xs) : 0;
    },
  },
  {
    name: "LARGE",
    min: 2,
    max: 2,
    args: "vs",
    impl: ([a, k], ctx) => {
      const xs = arrayNumbers(a, ctx);
      if (isErr(xs)) return xs;
      const kk = toNum(k as Scalar, ctx);
      if (typeof kk !== "number") return kk;
      const i = Math.ceil(kk);
      if (!xs.length) return why.few(1, 0, "#NUM!");
      if (i < 1 || i > xs.length) return why.range(2, 1, xs.length);
      return sorted(xs)[xs.length - i];
    },
  },
  {
    name: "SMALL",
    min: 2,
    max: 2,
    args: "vs",
    impl: ([a, k], ctx) => {
      const xs = arrayNumbers(a, ctx);
      if (isErr(xs)) return xs;
      const kk = toNum(k as Scalar, ctx);
      if (typeof kk !== "number") return kk;
      const i = Math.ceil(kk);
      if (!xs.length) return why.few(1, 0, "#NUM!");
      if (i < 1 || i > xs.length) return why.range(2, 1, xs.length);
      return sorted(xs)[i - 1];
    },
  },
  {
    name: "RANK.EQ",
    min: 2,
    max: 3,
    args: "svs",
    impl: (args, ctx) => {
      const r = rankOf(args, ctx);
      return isErr(r) ? r : r.better + 1;
    },
  },
  {
    name: "RANK.AVG",
    min: 2,
    max: 3,
    args: "svs",
    impl: (args, ctx) => {
      // Equal numbers share the mean of the places they take: two at the top are both 1,5.
      const r = rankOf(args, ctx);
      return isErr(r) ? r : r.better + (r.ties + 1) / 2;
    },
  },
  {
    name: "PERCENTILE.INC",
    min: 2,
    max: 2,
    args: "vs",
    impl: ([a, k], ctx) => {
      const xs = arrayNumbers(a, ctx);
      if (isErr(xs)) return xs;
      const kk = toNum(k as Scalar, ctx);
      if (typeof kk !== "number") return kk;
      return percentileInc(xs, kk);
    },
  },
  {
    name: "QUARTILE.INC",
    min: 2,
    max: 2,
    args: "vs",
    impl: ([a, q], ctx) => {
      const xs = arrayNumbers(a, ctx);
      if (isErr(xs)) return xs;
      const qq = toInt(q as Scalar, ctx);
      if (typeof qq !== "number") return qq;
      if (qq < 0 || qq > 4) return why.range(2, 0, 4);
      return percentileInc(xs, qq / 4);
    },
  },
  {
    name: "PERCENTILE.EXC",
    min: 2,
    max: 2,
    args: "vs",
    impl: ([a, k], ctx) => {
      const xs = arrayNumbers(a, ctx);
      if (isErr(xs)) return xs;
      const kk = toNum(k as Scalar, ctx);
      if (typeof kk !== "number") return kk;
      return percentileExc(xs, kk);
    },
  },
  {
    name: "QUARTILE.EXC",
    min: 2,
    max: 2,
    args: "vs",
    impl: ([a, q], ctx) => {
      const xs = arrayNumbers(a, ctx);
      if (isErr(xs)) return xs;
      const qq = toInt(q as Scalar, ctx);
      if (typeof qq !== "number") return qq;
      if (qq < 1 || qq > 3) return why.range(2, 1, 3);
      // The first and third quartile need 3 numbers, the median 1.
      const r = percentileExc(xs, qq / 4);
      return isErr(r) && xs.length ? why.few(qq === 2 ? 1 : 3, xs.length, "#NUM!") : r;
    },
  },
  numFn("STANDARDIZE", 3, 3, ([x, m, sd]) => (sd <= 0 ? why.arg(3, "gt0") : (x - m) / sd)),
  {
    name: "NORM.DIST",
    min: 4,
    max: 4,
    args: "s",
    impl: ([x0, m0, s0, c0], ctx) => {
      const x = toNum(x0 as Scalar, ctx);
      if (typeof x !== "number") return x;
      const m = toNum(m0 as Scalar, ctx);
      if (typeof m !== "number") return m;
      const s = toNum(s0 as Scalar, ctx);
      if (typeof s !== "number") return s;
      const cum = toBool(c0 as Scalar, ctx);
      if (isErr(cum)) return cum;
      if (s <= 0) return why.arg(3, "gt0");
      const z = (x - m) / s;
      return numResult(cum ? normCdf(z) : normPdf(z) / s);
    },
  },
  numFn("NORM.INV", 3, 3, ([p, m, s]) => {
    if (!(p > 0 && p < 1)) return why.arg(1, "p");
    if (s <= 0) return why.arg(3, "gt0");
    return m + s * normInv(p);
  }),
  {
    name: "NORM.S.DIST",
    min: 2,
    max: 2,
    args: "s",
    impl: ([z0, c0], ctx) => {
      const z = toNum(z0 as Scalar, ctx);
      if (typeof z !== "number") return z;
      const cum = toBool(c0 as Scalar, ctx);
      if (isErr(cum)) return cum;
      return numResult(cum ? normCdf(z) : normPdf(z));
    },
  },
  numFn("NORM.S.INV", 1, 1, ([p]) => (!(p > 0 && p < 1) ? why.arg(1, "p") : normInv(p))),
  // NORMSDIST (Excel 2007) is NORM.S.VERT with WAHR: the probability up to z.
  numFn("NORMSDIST", 1, 1, ([z]) => normCdf(z)),
  {
    name: "T.DIST",
    min: 3,
    max: 3,
    args: "s",
    impl: ([x0, df0, c0], ctx) => {
      const x = toNum(x0 as Scalar, ctx);
      if (typeof x !== "number") return x;
      const df = toInt(df0 as Scalar, ctx);
      if (typeof df !== "number") return df;
      const cum = toBool(c0 as Scalar, ctx);
      if (isErr(cum)) return cum;
      if (df < 1) return why.arg(2, "ge1");
      return numResult(cum ? tCdf(x, df) : tPdf(x, df));
    },
  },
  numFn("T.DIST.2T", 2, 2, ([x, df0]) => {
    const df = Math.trunc(df0);
    if (x < 0) return why.arg(1, "ge0");
    if (df < 1) return why.arg(2, "ge1");
    return tTwoTail(x, df);
  }),
  numFn("T.DIST.RT", 2, 2, ([x, df0]) => {
    const df = Math.trunc(df0);
    if (df < 1) return why.arg(2, "ge1");
    return tUpper(x, df);
  }),
  // TVERT (Excel 2007): one tail (T.VERT.RE) or both (T.VERT.2S), for t ≥ 0.
  numFn("TDIST", 3, 3, ([x, df0, tails0]) => {
    const df = Math.trunc(df0);
    const tails = Math.trunc(tails0);
    if (x < 0) return why.arg(1, "ge0");
    if (df < 1) return why.arg(2, "ge1");
    if (tails !== 1 && tails !== 2) return why.arg(3, "opt");
    return tails === 1 ? tUpper(x, df) : tTwoTail(x, df);
  }),
  numFn("T.INV", 2, 2, ([p, df0]) => {
    const df = Math.trunc(df0);
    if (!(p > 0 && p < 1)) return why.arg(1, "p");
    if (df < 1) return why.arg(2, "ge1");
    return tInv(p, df);
  }),
  numFn("T.INV.2T", 2, 2, ([p, df0]) => {
    const df = Math.trunc(df0);
    if (!(p > 0 && p <= 1)) return why.arg(1, "p");
    if (df < 1) return why.arg(2, "ge1");
    if (p === 1) return 0;
    return tInv(1 - p / 2, df);
  }),
  {
    name: "T.TEST",
    min: 4,
    max: 4,
    args: "vvss",
    impl: ([a, b, tails0, type0], ctx) => {
      const tails = toInt(tails0 as Scalar, ctx);
      if (typeof tails !== "number") return tails;
      const type = toInt(type0 as Scalar, ctx);
      if (typeof type !== "number") return type;
      const r = tTest(a, b, tails, type, ctx);
      return typeof r === "number" ? numResult(r) : r;
    },
  },
  numFn("CONFIDENCE.NORM", 3, 3, ([alpha, sd, n0]) => {
    const bad = confidenceArgs(alpha, sd, Math.trunc(n0));
    return bad ?? (normInv(1 - alpha / 2) * sd) / Math.sqrt(Math.trunc(n0));
  }),
  numFn("CONFIDENCE.T", 3, 3, ([alpha, sd, n0]) => {
    const n = Math.trunc(n0);
    const bad = confidenceArgs(alpha, sd, n);
    if (bad) return bad;
    if (n === 1) return why.arg(3, "ge2", "#DIV/0!");
    return (tInv(1 - alpha / 2, n - 1) * sd) / Math.sqrt(n);
  }),

  // F-test: do two groups scatter equally? (Which T.TEST type: 2 for equal, 3 for unequal variances.)
  {
    name: "F.TEST",
    min: 2,
    max: 2,
    args: "vv",
    impl: ([a, b], ctx) => {
      const x = arrayNumbers(a, ctx);
      if (isErr(x)) return x;
      const y = arrayNumbers(b, ctx);
      if (isErr(y)) return y;
      if (x.length < 2 || y.length < 2) return why.fewEach(2, Math.min(x.length, y.length));
      const v1 = devSq(x) / (x.length - 1);
      const v2 = devSq(y) / (y.length - 1);
      if (v1 === 0 || v2 === 0) return why.same();
      // Two-tailed: twice the smaller tail of F = s1² / s2².
      const f = v1 / v2;
      const d1 = x.length - 1;
      const d2 = y.length - 1;
      return numResult(Math.min(1, 2 * Math.min(fCdf(f, d1, d2), fUpper(f, d1, d2))));
    },
  },
  {
    name: "F.DIST",
    min: 4,
    max: 4,
    args: "s",
    impl: ([x0, a0, b0, c0], ctx) => {
      const x = toNum(x0 as Scalar, ctx);
      if (typeof x !== "number") return x;
      const d1 = toInt(a0 as Scalar, ctx);
      if (typeof d1 !== "number") return d1;
      const d2 = toInt(b0 as Scalar, ctx);
      if (typeof d2 !== "number") return d2;
      const cum = toBool(c0 as Scalar, ctx);
      if (isErr(cum)) return cum;
      const bad = fArgs(x, d1, d2);
      return bad ?? numResult(cum ? fCdf(x, d1, d2) : fPdf(x, d1, d2));
    },
  },
  numFn("F.DIST.RT", 3, 3, ([x, a, b]) => fArgs(x, Math.trunc(a), Math.trunc(b)) ?? fUpper(x, Math.trunc(a), Math.trunc(b))),
  numFn("F.INV", 3, 3, ([p, a, b]) => {
    const d1 = Math.trunc(a);
    const d2 = Math.trunc(b);
    const bad = fArgs(1, d1, d2);
    if (bad) return bad;
    if (!(p >= 0 && p < 1)) return why.arg(1, "p");
    return p === 0 ? 0 : fInv(p, d1, d2);
  }),
  numFn("F.INV.RT", 3, 3, ([p, a, b]) => {
    const d1 = Math.trunc(a);
    const d2 = Math.trunc(b);
    const bad = fArgs(1, d1, d2);
    if (bad) return bad;
    if (!(p > 0 && p <= 1)) return why.arg(1, "p");
    return p === 1 ? 0 : fInv(p, d1, d2, true);
  }),

  // Chi-squared: observed against expected counts (Mendel's ratios, a contingency table).
  {
    name: "CHISQ.DIST",
    min: 3,
    max: 3,
    args: "s",
    impl: ([x0, k0, c0], ctx) => {
      const x = toNum(x0 as Scalar, ctx);
      if (typeof x !== "number") return x;
      const k = toInt(k0 as Scalar, ctx);
      if (typeof k !== "number") return k;
      const cum = toBool(c0 as Scalar, ctx);
      if (isErr(cum)) return cum;
      const bad = chiArgs(x, k);
      return bad ?? numResult(cum ? chiSqCdf(x, k) : chiSqPdf(x, k));
    },
  },
  numFn("CHISQ.DIST.RT", 2, 2, ([x, k0]) => chiArgs(x, Math.trunc(k0)) ?? chiSqUpper(x, Math.trunc(k0))),
  numFn("CHISQ.INV", 2, 2, ([p, k0]) => {
    const k = Math.trunc(k0);
    const bad = chiArgs(1, k);
    if (bad) return bad;
    if (!(p >= 0 && p < 1)) return why.arg(1, "p");
    return p === 0 ? 0 : chiSqInv(p, k);
  }),
  numFn("CHISQ.INV.RT", 2, 2, ([p, k0]) => {
    const k = Math.trunc(k0);
    const bad = chiArgs(1, k);
    if (bad) return bad;
    if (!(p > 0 && p <= 1)) return why.arg(1, "p");
    return p === 1 ? 0 : chiSqInv(p, k, true);
  }),
  {
    name: "CHISQ.TEST",
    min: 2,
    max: 2,
    args: "vv",
    impl: ([a, e], ctx) => {
      const A = numbersWithGaps(a, ctx);
      if (isErr(A)) return A;
      const E = numbersWithGaps(e, ctx);
      if (isErr(E)) return E;
      if (A.rows !== E.rows || A.cols !== E.cols) return SIZES;
      let chi = 0;
      for (let i = 0; i < A.values.length; i++) {
        const o = A.values[i];
        const x = E.values[i];
        // Every cell counts toward the degrees of freedom, so an empty or text cell can't just be
        // left out (LibreOffice refuses it too): a count of nothing is 0.
        if (Number.isNaN(o)) return why.arg(1, "num");
        if (Number.isNaN(x)) return why.arg(2, "num");
        if (x < 0) return why.arg(2, "pos");
        if (x === 0) return mkErr("#DIV/0!", "expected-zero");
        chi += ((o - x) * (o - x)) / x;
      }
      // Degrees of freedom: (rows − 1)·(columns − 1) for a table, n − 1 for a single row or column.
      const df = A.rows > 1 && A.cols > 1 ? (A.rows - 1) * (A.cols - 1) : Math.max(A.rows, A.cols) - 1;
      if (df < 1) return why.few(2, 1, "#N/A");
      return numResult(chiSqUpper(chi, df));
    },
  },

  // HÄUFIGKEIT: how many values fall into each class. An array, one count more than classes
  // (the last counts what lies above the highest class); in a cell its first count shows, INDEX
  // picks the others.
  {
    name: "FREQUENCY",
    min: 2,
    max: 2,
    args: "vv",
    impl: ([data, bins], ctx) => {
      const xs = arrayNumbers(data, ctx);
      if (isErr(xs)) return xs;
      const bs = arrayNumbers(bins, ctx);
      if (isErr(bs)) return bs;
      // The classes keep their order; each counts what lies above the next smaller class up to itself.
      const order = bs.map((b, i) => ({ b, i })).sort((p, q) => p.b - q.b);
      const counts: number[] = new Array(bs.length + 1).fill(0);
      for (const x of xs) {
        let lo = 0;
        let hi = order.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (order[mid].b < x) lo = mid + 1;
          else hi = mid;
        }
        counts[lo === order.length ? bs.length : order[lo].i]++;
      }
      return counts.map((c) => [c]);
    },
  },
  {
    name: "CORREL",
    min: 2,
    max: 2,
    args: "v",
    impl: ([a, b], ctx) => {
      const c = correlation(a, b, ctx);
      return isErr(c) ? c : numResult(c.r);
    },
  },
  {
    name: "PEARSON",
    min: 2,
    max: 2,
    args: "v",
    impl: ([a, b], ctx) => {
      const c = correlation(a, b, ctx);
      return isErr(c) ? c : numResult(c.r);
    },
  },
  {
    name: "COVARIANCE.S",
    min: 2,
    max: 2,
    args: "v",
    impl: ([a, b], ctx) => {
      const c = covariance(a, b, ctx, true);
      return typeof c === "number" ? numResult(c) : c;
    },
  },
  {
    name: "COVARIANCE.P",
    min: 2,
    max: 2,
    args: "v",
    impl: ([a, b], ctx) => {
      const c = covariance(a, b, ctx, false);
      return typeof c === "number" ? numResult(c) : c;
    },
  },
];

/**
 * Excel's older names (Excel 2007 and before) that calculate exactly like a newer function; old
 * workbooks and textbooks use them (names.ts says which one is newer).
 */
const SAME_AS: [old: string, now: string][] = [
  ["RANK", "RANK.EQ"],
  ["PERCENTILE", "PERCENTILE.INC"],
  ["QUARTILE", "QUARTILE.INC"],
  ["MODE", "MODE.SNGL"],
  ["NORMDIST", "NORM.DIST"],
  ["NORMINV", "NORM.INV"],
  ["NORMSINV", "NORM.S.INV"],
  ["TINV", "T.INV.2T"],
  ["TTEST", "T.TEST"],
  ["CONFIDENCE", "CONFIDENCE.NORM"],
  ["FTEST", "F.TEST"],
  ["FDIST", "F.DIST.RT"],
  ["FINV", "F.INV.RT"],
  ["CHIDIST", "CHISQ.DIST.RT"],
  ["CHIINV", "CHISQ.INV.RT"],
  ["CHITEST", "CHISQ.TEST"],
];
for (const [old, now] of SAME_AS) STATS.push({ ...STATS.find((f) => f.name === now)!, name: old });
