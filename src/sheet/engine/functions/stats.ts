// Statistik: MITTELWERT, STABW.S, ZÄHLENWENN, QUANTIL, NORM.VERT, T.TEST, KONFIDENZ… with Excel's
// rules for which cells count (ranges: numbers only; direct arguments converted).

import { makeCriterion, type Criterion } from "../criteria";
import { ERR, isErr, isMatrix, isRef, numbersEqual, type CellError, type Matrix, type Scalar, type Value } from "../values";
import { normCdf, normInv, normPdf, tCdf, tInv, tPdf, tTwoTail, tUpper } from "./distributions";
import type { Ctx, FnDef } from "./types";
import { asMatrix, collectNumbers, devSq, eachValue, first, mean, numFn, numResult, numbersWithGaps, pairs, sum, toBool, toInt, toNum } from "./util";

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
    const crit = critScalar(args[i + 1], ctx);
    conds.push({ grid: gridOf(args[i], ctx), test: makeCriterion(crit, ctx.locale) });
  }
  if ((args.length - (targetFirst ? 1 : 0)) % 2 !== 0) return ERR.value;
  return matching(target ?? conds[0].grid, conds);
}

/** SUMIF / AVERAGEIF: (range, criterion, [sum range]). */
function ifValues(args: Value[], ctx: Ctx): Scalar[] | CellError {
  const range = gridOf(args[0], ctx);
  const test = makeCriterion(critScalar(args[1], ctx), ctx.locale);
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

function variance(xs: number[], sample: boolean): number | CellError {
  const n = xs.length;
  if (n < (sample ? 2 : 1)) return ERR.div0;
  return devSq(xs) / (sample ? n - 1 : n);
}

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
  if (!xs.length || k < 0 || k > 1) return ERR.num;
  const s = sorted(xs);
  const pos = k * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

function median(xs: number[]): number | CellError {
  if (!xs.length) return ERR.num;
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
  if (n < 2) return ERR.div0;
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
  if (sxx === 0 || syy === 0) return ERR.div0;
  return { r: sxy / Math.sqrt(sxx * syy), n, sxx, syy, sxy, mx, my };
}

function covariance(a: Value, b: Value, ctx: Ctx, sample: boolean): number | CellError {
  const A = numbersWithGaps(a, ctx);
  if (isErr(A)) return A;
  const B = numbersWithGaps(b, ctx);
  if (isErr(B)) return B;
  if (A.values.length !== B.values.length) return ERR.na;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < A.values.length; i++) {
    if (Number.isNaN(A.values[i]) || Number.isNaN(B.values[i])) continue;
    x.push(A.values[i]);
    y.push(B.values[i]);
  }
  const n = x.length;
  if (n < (sample ? 2 : 1)) return ERR.div0;
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (sample ? n - 1 : n);
}

/** Student's t-test (T.TEST): type 1 paired, 2 equal variances, 3 unequal (Welch). */
function tTest(a: Value, b: Value, tails: number, type: number, ctx: Ctx): number | CellError {
  if (tails !== 1 && tails !== 2) return ERR.num;
  if (type < 1 || type > 3) return ERR.num;
  const A = numbersWithGaps(a, ctx);
  if (isErr(A)) return A;
  const B = numbersWithGaps(b, ctx);
  if (isErr(B)) return B;
  let t: number;
  let df: number;
  if (type === 1) {
    if (A.values.length !== B.values.length) return ERR.na;
    const d: number[] = [];
    for (let i = 0; i < A.values.length; i++) {
      if (Number.isNaN(A.values[i]) || Number.isNaN(B.values[i])) continue;
      d.push(A.values[i] - B.values[i]);
    }
    const n = d.length;
    if (n < 2) return ERR.div0;
    const sd = Math.sqrt(devSq(d) / (n - 1));
    if (sd === 0) return ERR.div0;
    t = mean(d) / (sd / Math.sqrt(n));
    df = n - 1;
  } else {
    const x = A.values.filter((v) => !Number.isNaN(v));
    const y = B.values.filter((v) => !Number.isNaN(v));
    const n1 = x.length;
    const n2 = y.length;
    if (n1 < 2 || n2 < 2) return ERR.div0;
    const v1 = devSq(x) / (n1 - 1);
    const v2 = devSq(y) / (n2 - 1);
    const diff = mean(x) - mean(y);
    if (type === 2) {
      df = n1 + n2 - 2;
      const pooled = ((n1 - 1) * v1 + (n2 - 1) * v2) / df;
      const se = Math.sqrt(pooled * (1 / n1 + 1 / n2));
      if (se === 0) return ERR.div0;
      t = diff / se;
    } else {
      const s1 = v1 / n1;
      const s2 = v2 / n2;
      const se = Math.sqrt(s1 + s2);
      if (se === 0) return ERR.div0;
      t = diff / se;
      df = ((s1 + s2) * (s1 + s2)) / ((s1 * s1) / (n1 - 1) + (s2 * s2) / (n2 - 1));
    }
  }
  const at = Math.abs(t);
  return tails === 1 ? tUpper(at, df) : tTwoTail(at, df);
}

// ----------------------------------------------------------------------------------------------

export const STATS: FnDef[] = [
  aggregate("AVERAGE", (xs) => (xs.length ? sum(xs) / xs.length : ERR.div0)),
  aggregate("AVERAGEA", (xs) => (xs.length ? sum(xs) / xs.length : ERR.div0), "a"),
  aggregate("MEDIAN", median),
  aggregate("MIN", (xs) => (xs.length ? Math.min(...xs) : 0)),
  aggregate("MAX", (xs) => (xs.length ? Math.max(...xs) : 0)),
  aggregate("STDEV.S", (xs) => {
    const v = variance(xs, true);
    return typeof v === "number" ? Math.sqrt(v) : v;
  }),
  aggregate("STDEV", (xs) => {
    const v = variance(xs, true);
    return typeof v === "number" ? Math.sqrt(v) : v;
  }),
  aggregate("STDEV.P", (xs) => {
    const v = variance(xs, false);
    return typeof v === "number" ? Math.sqrt(v) : v;
  }),
  aggregate("STDEVP", (xs) => {
    const v = variance(xs, false);
    return typeof v === "number" ? Math.sqrt(v) : v;
  }),
  aggregate("VAR.S", (xs) => variance(xs, true)),
  aggregate("VAR", (xs) => variance(xs, true)),
  aggregate("VAR.P", (xs) => variance(xs, false)),
  aggregate("VARP", (xs) => variance(xs, false)),
  aggregate("AVEDEV", (xs) => {
    if (!xs.length) return ERR.num;
    const m = mean(xs);
    return sum(xs.map((x) => Math.abs(x - m))) / xs.length;
  }),
  aggregate("DEVSQ", (xs) => (xs.length ? devSq(xs) : ERR.num)),
  aggregate("GEOMEAN", (xs) => {
    if (!xs.length || xs.some((x) => x <= 0)) return ERR.num;
    return Math.exp(sum(xs.map(Math.log)) / xs.length);
  }),
  aggregate("HARMEAN", (xs) => {
    if (!xs.length || xs.some((x) => x <= 0)) return ERR.num;
    return xs.length / sum(xs.map((x) => 1 / x));
  }),
  aggregate("SKEW", (xs) => {
    const n = xs.length;
    if (n < 3) return ERR.div0;
    const m = mean(xs);
    const s = Math.sqrt(devSq(xs) / (n - 1));
    if (s === 0) return ERR.div0;
    let acc = 0;
    for (const x of xs) acc += Math.pow((x - m) / s, 3);
    return (n / ((n - 1) * (n - 2))) * acc;
  }),
  aggregate("KURT", (xs) => {
    const n = xs.length;
    if (n < 4) return ERR.div0;
    const m = mean(xs);
    const s = Math.sqrt(devSq(xs) / (n - 1));
    if (s === 0) return ERR.div0;
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
      return best === null ? ERR.na : best;
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
      return xs.length ? numResult(sum(xs) / xs.length) : ERR.div0;
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
      return xs.length ? numResult(sum(xs) / xs.length) : ERR.div0;
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
      if (i < 1 || i > xs.length) return ERR.num;
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
      if (i < 1 || i > xs.length) return ERR.num;
      return sorted(xs)[i - 1];
    },
  },
  {
    name: "RANK.EQ",
    min: 2,
    max: 3,
    args: "svs",
    impl: ([x, ref, order], ctx) => {
      const n = toNum(x as Scalar, ctx);
      if (typeof n !== "number") return n;
      const xs = arrayNumbers(ref, ctx);
      if (isErr(xs)) return xs;
      const asc = order === undefined || order === null ? false : toBool(order as Scalar, ctx);
      if (isErr(asc)) return asc;
      if (!xs.some((v) => numbersEqual(v, n))) return ERR.na;
      let rank = 1;
      for (const v of xs) if (!numbersEqual(v, n) && (asc ? v < n : v > n)) rank++;
      return rank;
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
      if (qq < 0 || qq > 4) return ERR.num;
      return percentileInc(xs, qq / 4);
    },
  },
  numFn("STANDARDIZE", 3, 3, ([x, m, sd]) => (sd <= 0 ? ERR.num : (x - m) / sd)),
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
      if (s <= 0) return ERR.num;
      const z = (x - m) / s;
      return numResult(cum ? normCdf(z) : normPdf(z) / s);
    },
  },
  numFn("NORM.INV", 3, 3, ([p, m, s]) => {
    if (!(p > 0 && p < 1) || s <= 0) return ERR.num;
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
  numFn("NORM.S.INV", 1, 1, ([p]) => (!(p > 0 && p < 1) ? ERR.num : normInv(p))),
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
      if (df < 1) return ERR.num;
      return numResult(cum ? tCdf(x, df) : tPdf(x, df));
    },
  },
  numFn("T.DIST.2T", 2, 2, ([x, df0]) => {
    const df = Math.trunc(df0);
    if (x < 0 || df < 1) return ERR.num;
    return tTwoTail(x, df);
  }),
  numFn("T.INV", 2, 2, ([p, df0]) => {
    const df = Math.trunc(df0);
    if (!(p > 0 && p < 1) || df < 1) return ERR.num;
    return tInv(p, df);
  }),
  numFn("T.INV.2T", 2, 2, ([p, df0]) => {
    const df = Math.trunc(df0);
    if (!(p > 0 && p <= 1) || df < 1) return ERR.num;
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
    const n = Math.trunc(n0);
    if (!(alpha > 0 && alpha < 1) || sd <= 0 || n < 1) return ERR.num;
    return (normInv(1 - alpha / 2) * sd) / Math.sqrt(n);
  }),
  numFn("CONFIDENCE.T", 3, 3, ([alpha, sd, n0]) => {
    const n = Math.trunc(n0);
    if (!(alpha > 0 && alpha < 1) || sd <= 0 || n < 1) return ERR.num;
    if (n === 1) return ERR.div0;
    return (tInv(1 - alpha / 2, n - 1) * sd) / Math.sqrt(n);
  }),
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

