// Trendlines like Excel's (Trendlinie): the same model, coefficients, equation and R², so a
// calibration line here matches the one in class.
//
// CONTRACT: used by the chart data (data.ts), the chart view and tests. Keep names and signatures.
//
// Models (Excel's): linear y = m·x + b; polynomial y = cₙxⁿ + … + c₁x + c₀; exponential
// y = a·e^(b·x) (fitted on ln y); logarithmic y = a·ln(x) + b; power y = a·x^b (fitted on ln x,
// ln y); moving average over `period` points. R² as Excel shows it (for exponential and power: of
// the fit on the logarithms; with a fixed intercept: Excel's own definition, see the tests).
//
// How Excel gets its numbers, and so how this file does:
// - Least squares. Linear fits use centred sums; polynomials are solved with a Householder QR on
//   a centred and scaled x (well conditioned up to order 6 even for x like 2000…2020), then
//   expanded back to the coefficients of x that the equation shows.
// - Exponential and power fits are linear fits on ln y (and ln x), so their R² is the R² of that
//   linear fit on the logarithms, not of the curve on the original values. That is what Excel
//   prints on the chart (and what LOGEST/LINEST on LN(y) give).
// - A fixed intercept ("Schnittpunkt festlegen" at b₀) is a fit of y − b₀ through the origin, like
//   LINEST(y − b₀; x; FALSE). Its R² uses the uncentred total sum of squares of that regression:
//   R² = 1 − SSE / Σ(y − b₀)². For b₀ = 0 this is Excel's well-known 1 − SSE / Σy² (higher than
//   the free fit's R² would suggest); for other b₀ the same regression gives the same formula
//   (LibreOffice computes Σ(ŷ − b₀)² / (Σ(ŷ − b₀)² + SSE), which equals it because the residuals of
//   a least-squares fit through the origin are orthogonal to the fitted values). For exponential
//   fits the fixed a₀ is ln a₀ on the log scale, and R² is computed on ln y − ln a₀. a₀ has to be
//   above 0 (a·e^(bx) never reaches 0): a 0 or less, typically left over from a line through the
//   origin when the type was switched, is ignored and a fitted instead (Fit.intercept says which,
//   so the panel can tell), rather than drawing a falling curve through rising data.
// - Logarithmic and power fits have no fixed intercept in Excel (the option is greyed out); a
//   given intercept is ignored for them.
// - Exponential and power curves are computed from ln a (Fit.lnA): with dates as x (46 000 days)
//   a itself is far below what a number holds (Excel's label says "0e^…"), yet the curve and the
//   way back from a measured value work.
// - Data that a model can't take (x ≤ 0 for logarithmic and power, y ≤ 0 for exponential and
//   power) is an error, like Excel, which refuses those trendlines rather than skipping points.
// - When all y are equal the total sum of squares is 0 and R² is undefined: NaN, shown as #NV.

import type { Locale } from "@/i18n/config";
import type { TrendlineSpec } from "../types";
import { EQUATION_DIGITS, formatCoefficient, formatFromLn, formatR2 } from "./format";

export type Fit = {
  type: TrendlineSpec["type"];
  /**
   * linear [b, m]; polynomial [c₀, c₁, …, cₙ]; exponential [a, b]; logarithmic [b, a] (y = a·ln x + b);
   * power [a, b]; movingAverage [] (see `points`).
   */
  coefficients: number[];
  /** Coefficient of determination; null for moving averages. */
  r2: number | null;
  /** Points used (pairs with both numbers; and x > 0 / y > 0 where the model needs it). */
  n: number;
  /** The fitted y at x (NaN outside the model's domain, e.g. ln of x ≤ 0). */
  predict(x: number): number;
  /** Moving average: the averaged points, in x order. */
  points?: { x: number; y: number }[];
  /** The pairs used, in the data's order (for solveForX's choice between several answers). */
  xs?: number[];
  ys?: number[];
  /** The x range of the pairs used: the trendline is drawn over it (plus the forecast). */
  xMin?: number;
  xMax?: number;
  /** The fixed intercept that was used (null: fitted). */
  intercept?: number | null;
  /**
   * Exponential and power: ln a, which the curve and solveForX are computed from, so they work
   * where a itself is 0 or ∞ as a number (dates as x).
   */
  lnA?: number;
  /**
   * Polynomial: the same curve as d₀ + d₁t + … with t = (x − center) / scale, which predicts and
   * solves accurately even where the coefficients of x are huge or tiny.
   */
  basis?: { center: number; scale: number; d: number[] };
};

export type FitError = { error: "too-few-points" | "non-positive-x" | "non-positive-y" | "singular" | "bad-intercept" };

export const isFitError = (f: Fit | FitError | null | undefined): f is FitError => !!f && "error" in f;

type FitSpec = Pick<TrendlineSpec, "type" | "order" | "period" | "intercept">;

/** Fit a trendline to (x, y) pairs (NaN pairs skipped). Moving averages keep the data's order. */
export function fitTrendline(xs: number[], ys: number[], spec: FitSpec): Fit | FitError {
  const px: number[] = [];
  const py: number[] = [];
  const count = Math.min(xs.length, ys.length);
  for (let i = 0; i < count; i++) {
    const x = xs[i];
    const y = ys[i];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      px.push(x);
      py.push(y);
    }
  }
  const intercept = spec.intercept ?? null;
  switch (spec.type) {
    case "linear":
      return linearFit(px, py, intercept);
    case "polynomial":
      return polynomialFit(px, py, spec.order, intercept);
    case "exponential":
      return exponentialFit(px, py, intercept);
    case "logarithmic":
      return logarithmicFit(px, py);
    case "power":
      return powerFit(px, py);
    case "movingAverage":
      return movingAverageFit(px, py, spec.period);
    default:
      return { error: "singular" };
  }
}

// ----------------------------------------------------------------------------------------------
// The models

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/** Are all values the same (no spread to fit a slope to)? Relative, so 0.1 + 0.2 noise doesn't count as spread. */
function noSpread(v: number[]): boolean {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of v) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return !(hi - lo > 1e-12 * Math.max(Math.abs(lo), Math.abs(hi)));
}

const allEqual = (v: number[], to?: number) => v.every((x) => x === (to ?? v[0]));

/**
 * R² as Excel reports it: 1 − SSE / SST. Free fits: SST around the mean. A fixed intercept b₀:
 * the uncentred SST of the regression through the origin, Σ(y − b₀)². NaN when SST is 0.
 */
function rSquared(ys: number[], fitted: number[], fixed: number | null): number {
  if (fixed === null ? allEqual(ys) : allEqual(ys, fixed)) return NaN;
  const center = fixed ?? mean(ys);
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < ys.length; i++) {
    const e = ys[i] - fitted[i];
    const d = ys[i] - center;
    sse += e * e;
    sst += d * d;
  }
  return sst > 0 ? 1 - sse / sst : NaN;
}

type Line = { m: number; b: number; r2: number };

/** Least squares y = m·x + b, or y = m·x + b0 with b0 fixed. */
function lineCore(px: number[], py: number[], b0: number | null): Line | FitError {
  if (px.length < 2) return { error: "too-few-points" };
  let m: number;
  let b: number;
  if (b0 === null) {
    if (noSpread(px)) return { error: "singular" };
    const mx = mean(px);
    const my = mean(py);
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < px.length; i++) {
      const dx = px[i] - mx;
      sxx += dx * dx;
      sxy += dx * (py[i] - my);
    }
    if (!(sxx > 0)) return { error: "singular" };
    m = sxy / sxx;
    b = my - m * mx;
  } else {
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < px.length; i++) {
      sxx += px[i] * px[i];
      sxy += px[i] * (py[i] - b0);
    }
    if (!(sxx > 0)) return { error: "singular" };
    m = sxy / sxx;
    b = b0;
  }
  const fitted = px.map((x) => m * x + b);
  return { m, b, r2: rSquared(py, fitted, b0) };
}

/**
 * Coefficients that are only rounding noise (2E-15 for a term exact data doesn't have) become 0,
 * so y = x³ − 2x + 1 reads like that: a term counts when it moves y by more than 1e-12 of the
 * data's size anywhere in the data's x range.
 */
function dropNoise(c: number[], px: number[], py: number[], keep0: boolean): number[] {
  let yScale = 0;
  for (const y of py) yScale = Math.max(yScale, Math.abs(y));
  let xScale = 0;
  for (const x of px) xScale = Math.max(xScale, Math.abs(x));
  return c.map((v, k) => (k === 0 && keep0) || Math.abs(v) * Math.max(1, xScale) ** k > 1e-12 * yScale ? v : 0);
}

function range(px: number[]) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of px) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return { xMin: lo, xMax: hi };
}

function linearFit(px: number[], py: number[], b0: number | null): Fit | FitError {
  if (b0 !== null && !Number.isFinite(b0)) return { error: "bad-intercept" };
  const line = lineCore(px, py, b0);
  if ("error" in line) return line;
  const [b, m] = dropNoise([line.b, line.m], px, py, b0 !== null);
  return { type: "linear", coefficients: [b, m], r2: line.r2, n: px.length, predict: (x) => m * x + b, xs: px, ys: py, ...range(px), intercept: b0 };
}

function polynomialFit(px: number[], py: number[], orderIn: number, c0: number | null): Fit | FitError {
  if (c0 !== null && !Number.isFinite(c0)) return { error: "bad-intercept" };
  const order = Math.max(2, Math.min(6, Math.round(Number.isFinite(orderIn) ? orderIn : 2)));
  const n = px.length;
  const powers = Array.from({ length: c0 === null ? order + 1 : order }, (_, i) => (c0 === null ? i : i + 1));
  if (n < Math.max(2, powers.length)) return { error: "too-few-points" };
  // A fixed intercept keeps x = 0 at t = 0, so only scale; a free fit centres too.
  const center = c0 === null ? mean(px) : 0;
  let scale = 0;
  for (const x of px) scale = Math.max(scale, Math.abs(x - center));
  if (!(scale > 0) || (c0 === null && noSpread(px))) return { error: "singular" };
  const target = c0 === null ? py : py.map((y) => y - c0);
  const rows = px.map((x) => {
    const t = (x - center) / scale;
    return powers.map((p) => t ** p);
  });
  const sol = leastSquares(rows, target);
  if (!sol) return { error: "singular" };
  const d = new Array<number>(order + 1).fill(0);
  powers.forEach((p, j) => (d[p] = sol[j]));
  if (c0 !== null) d[0] = c0;
  const coefficients = dropNoise(expandPolynomial(d, center, scale), px, py, c0 !== null);
  // Exactly the fixed intercept, not c0 plus rounding noise of the expansion.
  if (c0 !== null) coefficients[0] = c0;
  const predict = (x: number) => horner(d, (x - center) / scale);
  const fitted = px.map(predict);
  return {
    type: "polynomial",
    coefficients,
    r2: rSquared(py, fitted, c0),
    n,
    predict,
    xs: px,
    ys: py,
    ...range(px),
    intercept: c0,
    basis: { center, scale, d },
  };
}

function exponentialFit(px: number[], py: number[], given: number | null): Fit | FitError {
  if (px.length < 2) return { error: "too-few-points" };
  if (py.some((y) => y <= 0)) return { error: "non-positive-y" };
  if (given !== null && !Number.isFinite(given)) return { error: "bad-intercept" };
  // A fixed a of 0 or less can't be (see the top of this file): a is fitted.
  const a0 = given !== null && given > 0 ? given : null;
  const line = lineCore(px, py.map(Math.log), a0 === null ? null : Math.log(a0));
  if ("error" in line) return line;
  const lnA = line.b;
  const a = a0 ?? Math.exp(lnA);
  const b = line.m;
  return { type: "exponential", coefficients: [a, b], r2: line.r2, n: px.length, predict: (x) => Math.exp(lnA + b * x), xs: px, ys: py, ...range(px), intercept: a0, lnA };
}

function logarithmicFit(px: number[], py: number[]): Fit | FitError {
  if (px.length < 2) return { error: "too-few-points" };
  if (px.some((x) => x <= 0)) return { error: "non-positive-x" };
  const line = lineCore(px.map(Math.log), py, null);
  if ("error" in line) return line;
  const a = line.m;
  const b = line.b;
  return { type: "logarithmic", coefficients: [b, a], r2: line.r2, n: px.length, predict: (x) => (x > 0 ? a * Math.log(x) + b : NaN), xs: px, ys: py, ...range(px), intercept: null };
}

function powerFit(px: number[], py: number[]): Fit | FitError {
  if (px.length < 2) return { error: "too-few-points" };
  if (px.some((x) => x <= 0)) return { error: "non-positive-x" };
  if (py.some((y) => y <= 0)) return { error: "non-positive-y" };
  const line = lineCore(px.map(Math.log), py.map(Math.log), null);
  if ("error" in line) return line;
  const lnA = line.b;
  const b = line.m;
  return { type: "power", coefficients: [Math.exp(lnA), b], r2: line.r2, n: px.length, predict: (x) => (x > 0 ? Math.exp(lnA + b * Math.log(x)) : NaN), xs: px, ys: py, ...range(px), intercept: null, lnA };
}

/**
 * Excel's moving average: the mean of points i − p + 1 … i, drawn at x of point i, in the data's
 * order (Excel's help: in a scatter chart the average follows the order of the values, so sort
 * by x first for a meaningful line).
 */
function movingAverageFit(px: number[], py: number[], periodIn: number): Fit | FitError {
  const p = Math.max(2, Math.round(Number.isFinite(periodIn) ? periodIn : 2));
  const n = px.length;
  if (n < p + 1) return { error: "too-few-points" };
  const points: { x: number; y: number }[] = [];
  for (let i = p - 1; i < n; i++) {
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += py[j];
    points.push({ x: px[i], y: s / p });
  }
  const sorted = points.every((pt, i) => i === 0 || pt.x >= points[i - 1].x);
  const predict = (x: number) => {
    if (!sorted || !(x >= points[0].x && x <= points[points.length - 1].x)) return NaN;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (x <= b.x) return b.x === a.x ? b.y : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
    }
    return NaN;
  };
  return { type: "movingAverage", coefficients: [], r2: null, n, predict, points, xs: px, ys: py, ...range(px), intercept: null };
}

// ----------------------------------------------------------------------------------------------
// Linear algebra

/** Least squares A·x ≈ b by Householder QR; null when A doesn't have full column rank. */
export function leastSquares(A: number[][], b: number[]): number[] | null {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  if (n === 0 || m < n) return null;
  const R = A.map((row) => row.slice());
  const y = b.slice();
  const colNorms: number[] = [];
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += R[i][j] * R[i][j];
    colNorms.push(Math.sqrt(s));
  }
  for (let j = 0; j < n; j++) {
    let norm = 0;
    for (let i = j; i < m; i++) norm += R[i][j] * R[i][j];
    norm = Math.sqrt(norm);
    if (norm === 0) return null;
    const alpha = R[j][j] > 0 ? -norm : norm;
    const v: number[] = [];
    for (let i = j; i < m; i++) v.push(R[i][j]);
    v[0] -= alpha;
    let vv = 0;
    for (const x of v) vv += x * x;
    if (vv === 0) continue;
    for (let c = j; c < n; c++) {
      let dot = 0;
      for (let i = j; i < m; i++) dot += v[i - j] * R[i][c];
      const f = (2 * dot) / vv;
      for (let i = j; i < m; i++) R[i][c] -= f * v[i - j];
    }
    let dot = 0;
    for (let i = j; i < m; i++) dot += v[i - j] * y[i];
    const f = (2 * dot) / vv;
    for (let i = j; i < m; i++) y[i] -= f * v[i - j];
  }
  // A column that is (nearly) a combination of the others: too few distinct x for the order.
  for (let j = 0; j < n; j++) if (!(Math.abs(R[j][j]) > 1e-10 * Math.max(colNorms[j], 1e-300))) return null;
  const x = new Array<number>(n).fill(0);
  for (let j = n - 1; j >= 0; j--) {
    let s = y[j];
    for (let c = j + 1; c < n; c++) s -= R[j][c] * x[c];
    x[j] = s / R[j][j];
  }
  return x.every(Number.isFinite) ? x : null;
}

/** c₀ + c₁t + c₂t² + … at t. */
export function horner(c: number[], t: number): number {
  let s = 0;
  for (let i = c.length - 1; i >= 0; i--) s = s * t + c[i];
  return s;
}

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Σ d_k ((x − center) / scale)^k → the coefficients of x⁰, x¹, …. */
function expandPolynomial(d: number[], center: number, scale: number): number[] {
  const out = new Array<number>(d.length).fill(0);
  for (let k = 0; k < d.length; k++) {
    const dk = d[k] / scale ** k;
    for (let j = 0; j <= k; j++) out[j] += dk * binomial(k, j) * (-center) ** (k - j);
  }
  return out;
}

/** The real roots of c₀ + c₁t + … (ascending), found between the turning points by bisection. */
export function realRoots(cIn: number[]): number[] {
  let maxAbs = 0;
  for (const v of cIn) maxAbs = Math.max(maxAbs, Math.abs(v));
  if (maxAbs === 0) return [];
  let deg = cIn.length - 1;
  while (deg > 0 && Math.abs(cIn[deg]) <= 1e-13 * maxAbs) deg--;
  if (deg === 0) return [];
  const c = cIn.slice(0, deg + 1);
  if (deg === 1) return [-c[0] / c[1]];
  const turning = realRoots(c.slice(1).map((v, i) => v * (i + 1)));
  let bound = 0;
  for (let i = 0; i < deg; i++) bound = Math.max(bound, Math.abs(c[i] / c[deg]));
  bound += 1;
  const stops = [-bound, ...turning.filter((t) => t > -bound && t < bound), bound];
  const f = (t: number) => horner(c, t);
  const roots: number[] = [];
  for (let k = 0; k < stops.length - 1; k++) {
    let lo = stops[k];
    let hi = stops[k + 1];
    let flo = f(lo);
    const fhi = f(hi);
    if (flo === 0) {
      roots.push(lo);
      continue;
    }
    if (fhi === 0) {
      roots.push(hi);
      continue;
    }
    if (flo * fhi > 0) continue;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (mid === lo || mid === hi) break;
      const fm = f(mid);
      if (fm === 0) {
        lo = hi = mid;
        break;
      }
      if (fm > 0 === flo > 0) {
        lo = mid;
        flo = fm;
      } else hi = mid;
    }
    roots.push((lo + hi) / 2);
  }
  // A curve that only touches 0 at a turning point (a double root) has no sign change around it.
  let scale = 0;
  for (const v of c) scale = Math.max(scale, Math.abs(v));
  for (const t of turning) if (Math.abs(f(t)) <= 1e-12 * scale) roots.push(t);
  roots.sort((a, b) => a - b);
  return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 1e-9 * (1 + Math.abs(r))).map((r) => (r === 0 ? 0 : r));
}

// ----------------------------------------------------------------------------------------------
// Solving for x: the concentration of a sample from its measured value

/**
 * Of several answers, the one where the data has a y closest to the measured one (a curve that
 * bends back has two x for one y; the data says which branch the sample is on).
 */
function pickByData(candidates: number[], fit: Fit, y: number): number | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const xs = fit.xs ?? [];
  const ys = fit.ys ?? [];
  let near = -1;
  for (let i = 0; i < ys.length; i++) if (near < 0 || Math.abs(ys[i] - y) < Math.abs(ys[near] - y)) near = i;
  if (near < 0) return null;
  const x0 = xs[near];
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(c - x0) < Math.abs(best - x0)) best = c;
  return best;
}

/** Excel's y = ŷ for a polynomial: the root inside the measured x range, else the nearest one. */
function solvePolynomial(fit: Fit, y: number): number | null {
  const basis = fit.basis ?? { center: 0, scale: 1, d: fit.coefficients };
  const q = basis.d.slice();
  q[0] -= y;
  const roots = realRoots(q).map((t) => basis.center + basis.scale * t);
  if (roots.length === 0) return null;
  const lo = fit.xMin ?? -Infinity;
  const hi = fit.xMax ?? Infinity;
  const tol = Number.isFinite(hi - lo) ? 1e-9 * Math.max(hi - lo, Math.abs(hi), 1e-300) : 0;
  const inside = roots.filter((r) => r >= lo - tol && r <= hi + tol);
  if (inside.length) return pickByData(inside, fit, y);
  const dist = (r: number) => (r < lo ? lo - r : r - hi);
  const best = Math.min(...roots.map(dist));
  return pickByData(
    roots.filter((r) => dist(r) <= best * (1 + 1e-9)),
    fit,
    y,
  );
}

/** ln a of an exponential or power fit (from the fit itself where a is 0 or ∞ as a number). */
export const lnOfA = (fit: Fit) => fit.lnA ?? Math.log(fit.coefficients[0]);

/**
 * Whether a of an exponential or power fit is beyond what a number holds (0 or ∞), so it is only
 * known as ln a: dates as x (46 000 days) do that.
 */
export const aOutOfRange = (fit: Fit) => (fit.type === "exponential" || fit.type === "power") && fit.lnA !== undefined && !(fit.coefficients[0] >= 1e-300 && fit.coefficients[0] <= 1e300);

/**
 * Solve a fitted line for x: the concentration of a sample from its measured value (y), the
 * everyday use of a calibration curve. null when there is no (unique) answer.
 */
export function solveForX(fit: Fit, y: number): number | null {
  if (!Number.isFinite(y)) return null;
  const c = fit.coefficients;
  let x: number | null = null;
  switch (fit.type) {
    case "linear":
      x = c[1] === 0 ? null : (y - c[0]) / c[1];
      break;
    case "polynomial":
      x = solvePolynomial(fit, y);
      break;
    case "exponential":
      x = c[1] === 0 || !(y > 0) ? null : (Math.log(y) - lnOfA(fit)) / c[1];
      break;
    case "logarithmic":
      x = c[1] === 0 ? null : Math.exp((y - c[0]) / c[1]);
      break;
    case "power":
      x = c[1] === 0 || !(y > 0) ? null : Math.exp((Math.log(y) - lnOfA(fit)) / c[1]);
      break;
    case "movingAverage": {
      const pts = fit.points ?? [];
      const hits: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (a.y === y) hits.push(a.x);
        else if ((a.y - y) * (b.y - y) < 0) hits.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      if (pts.length && pts[pts.length - 1].y === y) hits.push(pts[pts.length - 1].x);
      x = pickByData([...new Set(hits)], fit, y);
      break;
    }
  }
  return x !== null && Number.isFinite(x) ? x : null;
}

// ----------------------------------------------------------------------------------------------
// The equation and R² as text

/**
 * A piece of the equation. `sup`: drawn as a superscript (exponents); `plain` is how it is
 * written in plain text instead ("²", "^(0,35x)").
 */
export type EqPart = { text: string; sup?: boolean; plain?: string };

const SUPERSCRIPT_DIGITS: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/**
 * The equation in pieces for drawing it with real superscripts: "y = 2,5x" + ²"2" + " - 1,3x + 0,4".
 * Same numbers and conventions as equationText. Moving averages have no equation ([]).
 */
export function equationParts(fit: Fit, locale: Locale, digits?: number): EqPart[] {
  const d = digits ?? EQUATION_DIGITS;
  const num = (v: number) => formatCoefficient(v, locale, d);
  // a of an exponential or power curve with dates as x is only known as ln a (it is 0 as a number).
  const aNum = (a: number) => (aOutOfRange(fit) ? formatFromLn(fit.lnA!, locale, d) : num(a));
  const c = fit.coefficients;
  const parts: EqPart[] = [{ text: "y = " }];
  // Each term: its coefficient and what it multiplies. Exactly-zero terms are left out, like
  // Excel's "y = 0,0523x" for a line through the origin; a coefficient shown as 1 is dropped
  // before a variable ("y = x + 2").
  const terms = (list: [number, EqPart[]][]) => {
    let first = true;
    for (const [coef, variable] of list) {
      if (coef === 0 || !Number.isFinite(coef)) continue;
      let mag = num(Math.abs(coef));
      if (variable.length && mag === "1") mag = "";
      const sign = first ? (coef < 0 ? "-" : "") : coef < 0 ? " - " : " + ";
      parts.push({ text: sign + mag }, ...variable);
      first = false;
    }
    if (first) parts.push({ text: "0" });
  };
  const power = (k: number): EqPart[] =>
    k === 1 ? [{ text: "x" }] : [{ text: "x" }, { text: String(k), sup: true, plain: String(k).replace(/\d/g, (d) => SUPERSCRIPT_DIGITS[d]) }];
  switch (fit.type) {
    case "linear":
      terms([
        [c[1], [{ text: "x" }]],
        [c[0], []],
      ]);
      break;
    case "polynomial": {
      const list: [number, EqPart[]][] = [];
      for (let k = c.length - 1; k >= 1; k--) list.push([c[k], power(k)]);
      list.push([c[0], []]);
      terms(list);
      break;
    }
    case "logarithmic":
      terms([
        [c[1], [{ text: "ln(x)" }]],
        [c[0], []],
      ]);
      break;
    case "exponential": {
      const [a, b] = c;
      if (b === 0) {
        terms([[a, []]]);
        break;
      }
      const aText = aNum(a);
      const bText = num(b);
      const exp = `${bText === "1" ? "" : bText === "-1" ? "-" : bText}x`;
      parts.push({ text: `${aText === "1" ? "" : aText === "-1" ? "-" : aText}e` }, { text: exp, sup: true, plain: `^(${exp})` });
      break;
    }
    case "power": {
      const [a, b] = c;
      if (b === 0) {
        terms([[a, []]]);
        break;
      }
      const aText = aNum(a);
      const bText = num(b);
      parts.push({ text: `${aText === "1" ? "" : aText === "-1" ? "-" : aText}x` });
      if (bText !== "1") parts.push({ text: bText, sup: true, plain: `^${bText}` });
      break;
    }
    case "movingAverage":
      return [];
  }
  // Neighbouring plain pieces in one (fewer text runs to draw).
  const merged: EqPart[] = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && !last.sup && !p.sup) last.text += p.text;
    else merged.push({ ...p });
  }
  return merged;
}

/**
 * The equation as Excel writes it on the chart, in the user's number format, with every
 * coefficient to `digits` significant digits (EQUATION_DIGITS, 4, unless "more digits" asks for
 * more; see formatCoefficient): "y = 0,05187x + 0,001476", "y = 0,0009463x + 0,02544",
 * "y = 1,2e^(0,35x)" (rendered with a superscript by the chart), "y = 2,1ln(x) - 0,5",
 * "y = 0,3x² - 1,2x + 4".
 */
export function equationText(fit: Fit, locale: Locale, digits?: number): string {
  return equationParts(fit, locale, digits)
    .map((p) => (p.sup ? (p.plain ?? p.text) : p.text))
    .join("");
}

/**
 * "R² = 0,9987" in the user's number format: 4 decimals, and never "1" for a fit that isn't
 * perfect ("R² = 0,99997" where Excel's label says 1; see formatR2). `digits`: the decimals for
 * "more digits" in the panel (up to 3 more if needed).
 */
export function r2Text(r2: number, locale: Locale, digits?: number): string {
  return `R² = ${digits ? formatR2(r2, locale, Math.max(4, digits), Math.max(6, digits + 3)) : formatR2(r2, locale)}`;
}

/**
 * With times as x (0:00, 0:30 …, which count in days, as in Excel and in STEIGUNG): the slope of
 * a line or the number in a growth curve's exponent, per day as the equation shows it and per hour
 * (÷ 24), each to `digits` significant digits. null for the other models.
 */
export function perHour(fit: Fit, locale: Locale, digits?: number): { kind: "slope" | "exponent"; perDay: string; perHour: string } | null {
  if (fit.type !== "linear" && fit.type !== "exponential") return null;
  const day = fit.coefficients[1];
  if (!Number.isFinite(day)) return null;
  return { kind: fit.type === "linear" ? "slope" : "exponent", perDay: formatCoefficient(day, locale, digits), perHour: formatCoefficient(day / 24, locale, digits) };
}
