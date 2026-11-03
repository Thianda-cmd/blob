// Regression (Kalibriergeraden): STEIGUNG, ACHSENABSCHNITT, BESTIMMTHEITSMASS, STFEHLERYX,
// PROGNOSE, TREND, VARIATION, RGP (LINEST) and RKP (LOGEST) with Excel's results, including RGP's
// statistics block (standard errors, R², F, degrees of freedom, sums of squares).
//
// Least squares are solved with Householder QR on centred data (accurate even for x², x³ columns
// of a polynomial calibration); columns that are linear combinations of others are dropped and
// get coefficient 0, as Excel does.

import { ERR, isErr, isRef, mkErr, type CellError, type Matrix, type Scalar, type Value } from "../values";
import type { Ctx, FnDef } from "./types";
import { asMatrix, mean, numResult, pairs, toBool, toNum, why } from "./util";

type Data = { values: number[]; rows: number; cols: number };

/** All values of an argument as numbers; anything else is #VALUE! (LINEST needs complete data). */
function strictNumbers(v: Value, ctx: Ctx): Data | CellError {
  const m = asMatrix(isRef(v) ? ctx.deref(v) : (v as Scalar | Matrix));
  const values: number[] = [];
  for (const row of m) {
    for (const x of row) {
      if (isErr(x)) return x;
      if (typeof x !== "number") return mkErr("#VALUE!", "not-a-number");
      values.push(x);
    }
  }
  return { values, rows: m.length, cols: m[0]?.length ?? 0 };
}

export type LinearFit = {
  /** b_1 … b_k for the columns of X (0 for dropped columns), then the intercept. */
  coef: number[];
  intercept: number;
  /** Standard errors (NaN where undefined). */
  se: number[];
  seIntercept: number;
  r2: number;
  sey: number;
  F: number;
  df: number;
  ssReg: number;
  ssResid: number;
  k: number;
};

/** Least squares y ≈ b0 + X·b (b0 = 0 without `withConst`). X is n rows × k columns. */
export function linearFit(X: number[][], y: number[], withConst: boolean): LinearFit | CellError {
  const n = y.length;
  const k = X[0]?.length ?? 0;
  if (n === 0 || k === 0) return ERR.value;
  const mx = new Array<number>(k).fill(0);
  let my = 0;
  if (withConst) {
    my = mean(y);
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += X[i][j];
      mx[j] = s / n;
    }
  }
  // Column-major copy of the (centred) design matrix and the response.
  const A: number[][] = [];
  const norms: number[] = [];
  for (let j = 0; j < k; j++) {
    const col = new Array<number>(n);
    let nn = 0;
    for (let i = 0; i < n; i++) {
      col[i] = X[i][j] - mx[j];
      nn += col[i] * col[i];
    }
    A.push(col);
    norms.push(Math.sqrt(nn));
  }
  const b = y.map((v) => v - my);
  // Householder QR, skipping columns that are (numerically) dependent on earlier ones.
  const kept: number[] = [];
  const R: number[][] = []; // R[row][keptIndex]
  let row = 0;
  for (let j = 0; j < k; j++) {
    const col = A[j];
    let alpha = 0;
    for (let i = row; i < n; i++) alpha += col[i] * col[i];
    alpha = Math.sqrt(alpha);
    if (row >= n || alpha <= 1e-10 * Math.max(norms[j], 1e-300) || norms[j] === 0) continue;
    // Reflect rows row…n-1 so col becomes (±alpha, 0, …).
    const sign = col[row] > 0 ? -1 : 1;
    const v = new Array<number>(n).fill(0);
    for (let i = row; i < n; i++) v[i] = col[i];
    v[row] -= sign * alpha;
    let vv = 0;
    for (let i = row; i < n; i++) vv += v[i] * v[i];
    if (vv > 0) {
      const apply = (target: number[]) => {
        let d = 0;
        for (let i = row; i < n; i++) d += v[i] * target[i];
        const f = (2 * d) / vv;
        for (let i = row; i < n; i++) target[i] -= f * v[i];
      };
      for (let jj = j; jj < k; jj++) apply(A[jj]);
      apply(b);
    }
    kept.push(j);
    row++;
  }
  const p = kept.length;
  for (let r = 0; r < p; r++) R.push(kept.map((j) => A[j][r]));
  // Back substitution R·c = Qᵀb.
  const c = new Array<number>(p).fill(0);
  for (let r = p - 1; r >= 0; r--) {
    let s = b[r];
    for (let q = r + 1; q < p; q++) s -= R[r][q] * c[q];
    c[r] = s / R[r][r];
  }
  const coef = new Array<number>(k).fill(0);
  kept.forEach((j, idx) => (coef[j] = c[idx]));
  let intercept = 0;
  if (withConst) {
    intercept = my;
    for (let j = 0; j < k; j++) intercept -= coef[j] * mx[j];
  }
  // Sums of squares.
  let ssResid = 0;
  let ssTotal = 0;
  for (let i = 0; i < n; i++) {
    let fit = intercept;
    for (let j = 0; j < k; j++) fit += coef[j] * X[i][j];
    const e = y[i] - fit;
    ssResid += e * e;
    ssTotal += withConst ? (y[i] - my) * (y[i] - my) : y[i] * y[i];
  }
  const ssReg = ssTotal - ssResid;
  const df = n - p - (withConst ? 1 : 0);
  const r2 = ssTotal === 0 ? NaN : ssReg / ssTotal;
  const sey = df > 0 ? Math.sqrt(ssResid / df) : NaN;
  const F = df > 0 && p > 0 && ssResid > 0 ? ssReg / p / (ssResid / df) : NaN;
  // Standard errors: sey² · (RᵀR)⁻¹ = sey² · R⁻¹R⁻ᵀ.
  const Rinv: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let col = 0; col < p; col++) {
    for (let r = p - 1; r >= 0; r--) {
      let s = r === col ? 1 : 0;
      for (let q = r + 1; q < p; q++) s -= R[r][q] * Rinv[q][col];
      Rinv[r][col] = s / R[r][r];
    }
  }
  // cov[a][b] (kept indexes) = Σ_r Rinv[a][r]·Rinv[b][r]
  const cov = (a: number, bb: number) => {
    let s = 0;
    for (let r = 0; r < p; r++) s += Rinv[a][r] * Rinv[bb][r];
    return s;
  };
  const se = new Array<number>(k).fill(0);
  kept.forEach((j, idx) => (se[j] = sey * Math.sqrt(cov(idx, idx))));
  let seIntercept = NaN;
  if (withConst) {
    // Var(b0) = sey² (1/n + mxᵀ (XcᵀXc)⁻¹ mx)
    let q = 0;
    for (let a = 0; a < p; a++) for (let bb = 0; bb < p; bb++) q += mx[kept[a]] * cov(a, bb) * mx[kept[bb]];
    seIntercept = sey * Math.sqrt(1 / n + q);
  }
  return { coef, intercept, se, seIntercept, r2, sey, F, df, ssReg, ssResid, k };
}

/** The data of RGP / TREND: y, the design matrix X (one column per variable) and how new x values are shaped. */
function regressionData(ysArg: Value, xsArg: Value | undefined, ctx: Ctx): { y: number[]; X: number[][]; byRow: boolean; k: number; yShape: { rows: number; cols: number } } | CellError {
  const Y = strictNumbers(ysArg, ctx);
  if (isErr(Y)) return Y;
  const n = Y.values.length;
  if (n === 0) return ERR.value;
  const byRow = Y.rows === 1 && Y.cols > 1;
  if (xsArg === undefined || xsArg === null) {
    return { y: Y.values, X: Y.values.map((_, i) => [i + 1]), byRow, k: 1, yShape: { rows: Y.rows, cols: Y.cols } };
  }
  const Xd = strictNumbers(xsArg, ctx);
  if (isErr(Xd)) return Xd;
  const shape = { rows: Y.rows, cols: Y.cols };
  const single = () => ({ y: Y.values, X: Xd.values.map((x) => [x]), byRow, k: 1, yShape: shape });
  // One x per y, laid out the same way: one variable.
  if (Xd.rows === Y.rows && Xd.cols === Y.cols) return single();
  if (Y.cols === 1) {
    // y in a column: every column of x is a variable (x, x², x³… for a polynomial).
    if (Xd.rows === n) {
      const X: number[][] = [];
      for (let i = 0; i < n; i++) X.push(Xd.values.slice(i * Xd.cols, (i + 1) * Xd.cols));
      return { y: Y.values, X, byRow: false, k: Xd.cols, yShape: shape };
    }
  } else if (Y.rows === 1) {
    // y in a row: every row of x is a variable.
    if (Xd.cols === n) {
      const X: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let r = 0; r < Xd.rows; r++) row.push(Xd.values[r * Xd.cols + i]);
        X.push(row);
      }
      return { y: Y.values, X, byRow: true, k: Xd.rows, yShape: shape };
    }
  }
  if (Xd.values.length === n) return single();
  return mkErr("#REF!", "sizes");
}

const nOrNA = (x: number): Scalar => (Number.isFinite(x) ? x : ERR.num);

/** RGP / RKP output: coefficients right to left, then the statistics rows. */
function linestMatrix(fit: LinearFit, stats: boolean, transform: (x: number) => number, withConst: boolean): Matrix {
  const k = fit.k;
  const row0: Scalar[] = [];
  for (let j = k - 1; j >= 0; j--) row0.push(nOrNA(transform(fit.coef[j])));
  row0.push(nOrNA(transform(fit.intercept)));
  if (!stats) return [row0];
  const width = k + 1;
  const pad = (cells: Scalar[]) => {
    while (cells.length < width) cells.push(ERR.na);
    return cells;
  };
  const row1: Scalar[] = [];
  for (let j = k - 1; j >= 0; j--) row1.push(nOrNA(fit.se[j]));
  row1.push(withConst ? nOrNA(fit.seIntercept) : ERR.na);
  return [row0, row1, pad([nOrNA(fit.r2), nOrNA(fit.sey)]), pad([nOrNA(fit.F), fit.df]), pad([nOrNA(fit.ssReg), nOrNA(fit.ssResid)])];
}

function optBool(v: Value | undefined, def: boolean, ctx: Ctx): boolean | CellError {
  if (v === undefined || v === null) return def;
  const s = isRef(v) ? ctx.deref(v) : v;
  return toBool(asMatrix(s as Scalar | Matrix)[0][0], ctx);
}

function linest(args: Value[], ctx: Ctx, log: boolean): Value {
  const withConst = optBool(args[2], true, ctx);
  if (isErr(withConst)) return withConst;
  const stats = optBool(args[3], false, ctx);
  if (isErr(stats)) return stats;
  const d = regressionData(args[0], args.length > 1 && args[1] !== null ? args[1] : undefined, ctx);
  if (isErr(d)) return d;
  let y = d.y;
  if (log) {
    if (y.some((v) => v <= 0)) return why.arg(1, "pos");
    y = y.map(Math.log);
  }
  const fit = linearFit(d.X, y, withConst);
  if (isErr(fit)) return fit;
  return linestMatrix(fit, stats, log ? Math.exp : (x) => x, withConst);
}

function trend(args: Value[], ctx: Ctx, log: boolean): Value {
  const withConst = optBool(args[3], true, ctx);
  if (isErr(withConst)) return withConst;
  const d = regressionData(args[0], args.length > 1 && args[1] !== null ? args[1] : undefined, ctx);
  if (isErr(d)) return d;
  let y = d.y;
  if (log) {
    if (y.some((v) => v <= 0)) return why.arg(1, "pos");
    y = y.map(Math.log);
  }
  const fit = linearFit(d.X, y, withConst);
  if (isErr(fit)) return fit;
  const predict = (xs: number[]) => {
    let s = fit.intercept;
    for (let j = 0; j < d.k; j++) s += fit.coef[j] * xs[j];
    return log ? Math.exp(s) : s;
  };
  if (args.length < 3 || args[2] === null) {
    // At the known x values, shaped like the known y values.
    const out: Matrix = [];
    const { rows, cols } = d.yShape;
    for (let r = 0; r < rows; r++) {
      const line: Scalar[] = [];
      for (let c = 0; c < cols; c++) line.push(nOrNA(predict(d.X[r * cols + c])));
      out.push(line);
    }
    return out;
  }
  const N = strictNumbers(args[2], ctx);
  if (isErr(N)) return N;
  if (d.k === 1) {
    const out: Matrix = [];
    for (let r = 0; r < N.rows; r++) {
      const line: Scalar[] = [];
      for (let c = 0; c < N.cols; c++) line.push(nOrNA(predict([N.values[r * N.cols + c]])));
      out.push(line);
    }
    return out;
  }
  // Several variables: each row (or column, for y in a row) of new x is one point.
  const out: Matrix = [];
  if (!d.byRow) {
    if (N.cols !== d.k) return mkErr("#REF!", "sizes");
    for (let r = 0; r < N.rows; r++) out.push([nOrNA(predict(N.values.slice(r * N.cols, (r + 1) * N.cols)))]);
    return out;
  }
  if (N.rows !== d.k) return mkErr("#REF!", "sizes");
  const line: Scalar[] = [];
  for (let c = 0; c < N.cols; c++) {
    const xs: number[] = [];
    for (let r = 0; r < N.rows; r++) xs.push(N.values[r * N.cols + c]);
    line.push(nOrNA(predict(xs)));
  }
  return [line];
}

/** Simple linear regression of paired cells (STEIGUNG, ACHSENABSCHNITT, …). */
function simple(ys: Value, xs: Value, ctx: Ctx) {
  const p = pairs(ys, xs, ctx);
  if (isErr(p)) return p;
  const n = p.x.length;
  const mx = n ? mean(p.x) : 0;
  const my = n ? mean(p.y) : 0;
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
  return { n, mx, my, sxx, syy, sxy };
}

/** Why no line fits these pairs: fewer than `need` of them, or all x the same (with `ys` also all y). */
function lineProblem(s: { n: number; sxx: number; syy: number }, need: number, ys = false): CellError | null {
  if (s.n < need) return why.few(need, s.n, "#DIV/0!", "pairs");
  if (s.sxx === 0 || (ys && s.syy === 0)) return why.same();
  return null;
}

export const REGRESSION: FnDef[] = [
  {
    name: "SLOPE",
    min: 2,
    max: 2,
    args: "v",
    impl: ([ys, xs], ctx) => {
      const s = simple(ys, xs, ctx);
      if (isErr(s)) return s;
      return lineProblem(s, 2) ?? numResult(s.sxy / s.sxx);
    },
  },
  {
    name: "INTERCEPT",
    min: 2,
    max: 2,
    args: "v",
    impl: ([ys, xs], ctx) => {
      const s = simple(ys, xs, ctx);
      if (isErr(s)) return s;
      return lineProblem(s, 2) ?? numResult(s.my - (s.sxy / s.sxx) * s.mx);
    },
  },
  {
    name: "RSQ",
    min: 2,
    max: 2,
    args: "v",
    impl: ([ys, xs], ctx) => {
      const s = simple(ys, xs, ctx);
      if (isErr(s)) return s;
      return lineProblem(s, 2, true) ?? numResult((s.sxy * s.sxy) / (s.sxx * s.syy));
    },
  },
  {
    name: "STEYX",
    min: 2,
    max: 2,
    args: "v",
    impl: ([ys, xs], ctx) => {
      const s = simple(ys, xs, ctx);
      if (isErr(s)) return s;
      return lineProblem(s, 3) ?? numResult(Math.sqrt(Math.max(0, s.syy - (s.sxy * s.sxy) / s.sxx) / (s.n - 2)));
    },
  },
  ...(["FORECAST", "FORECAST.LINEAR"] as const).map(
    (name): FnDef => ({
      name,
      min: 3,
      max: 3,
      args: "svv",
      impl: ([x0, ys, xs], ctx) => {
        const x = toNum(x0 as Scalar, ctx);
        if (typeof x !== "number") return x;
        const s = simple(ys, xs, ctx);
        if (isErr(s)) return s;
        const bad = lineProblem(s, 2);
        if (bad) return bad;
        const m = s.sxy / s.sxx;
        return numResult(s.my - m * s.mx + m * x);
      },
    }),
  ),
  { name: "LINEST", min: 1, max: 4, args: "vvss", impl: (args, ctx) => linest(args, ctx, false) },
  { name: "LOGEST", min: 1, max: 4, args: "vvss", impl: (args, ctx) => linest(args, ctx, true) },
  { name: "TREND", min: 1, max: 4, args: "vvvs", impl: (args, ctx) => trend(args, ctx, false) },
  { name: "GROWTH", min: 1, max: 4, args: "vvvs", impl: (args, ctx) => trend(args, ctx, true) },
];
