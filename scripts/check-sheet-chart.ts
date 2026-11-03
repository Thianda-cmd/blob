// Checks the spreadsheet charts (src/sheet/chart) before you commit.
//
//   npm run check:sheet-chart
//
// Trendlines must give what Excel gives (a student compares them with her course), so the
// expected numbers here are computed independently: closed-form sums for straight lines,
// Cramer's rule for parabolas, exact curves for the other models, plus textbook examples.
// Also: R² semantics of every model (fixed intercepts, logarithms), domain errors, the equation
// and R² text in German and English, solving for x, axis ticks, reading chart data from cells
// (with a small fake Calc, so this doesn't need the formula engine), the chart a selection
// makes, and the drawing itself (no NaN, the equation in the SVG).
// Problems make the script exit with 1.

import { placeInView } from "@/components/sheet/chart/actions";
import type { ChartViewport } from "@/components/sheet/chart/selection";
import { cellKey } from "@/sheet/a1";
import { linearAxis, logAxis, logTickLabel, niceStep } from "@/sheet/chart/axis";
import { chartFromAreas, chartSourceAreas, currentRegion } from "@/sheet/chart/create";
import { chartData } from "@/sheet/chart/data";
import { chartSvg } from "@/sheet/chart/export";
import { formatGeneral, formatR2, formatSignificant, parseChartNumber, r2Decimals } from "@/sheet/chart/format";
import { equationParts, equationText, fitTrendline, isFitError, r2Text, realRoots, solveForX, type Fit, type FitError } from "@/sheet/chart/regression";
import { buildChartScene } from "@/sheet/chart/scene";
import { formatValue, type Calc, type CellValue } from "@/sheet/engine";
import type { Cell, ChartSpec, RangeRef, SeriesSpec, TrendlineSpec, Workbook } from "@/sheet/types";

let passed = 0;
const problems: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else problems.push(`${name}${detail === undefined ? "" : `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const near = (a: number | null | undefined, b: number, rel = 1e-9) => typeof a === "number" && Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
function eq<T>(name: string, got: T, want: T) {
  check(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
}
function close(name: string, got: number | null | undefined, want: number, rel = 1e-9) {
  check(name, near(got, want, rel), { got, want });
}

type Spec = Pick<TrendlineSpec, "type" | "order" | "period" | "intercept">;
const spec = (type: Spec["type"], extra: Partial<Spec> = {}): Spec => ({ type, order: 2, period: 2, intercept: null, ...extra });
function fit(name: string, xs: number[], ys: number[], s: Spec): Fit {
  const f = fitTrendline(xs, ys, s);
  if (isFitError(f)) {
    problems.push(`${name}: unexpected ${f.error}`);
    return { type: s.type, coefficients: [NaN, NaN, NaN], r2: NaN, n: 0, predict: () => NaN };
  }
  return f;
}
function fitError(name: string, xs: number[], ys: number[], s: Spec, error: FitError["error"]) {
  const f = fitTrendline(xs, ys, s);
  check(name, isFitError(f) && f.error === error, isFitError(f) ? f.error : "fitted");
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
/** Least squares by the textbook formulas (raw sums), for comparison. */
function textbookLine(xs: number[], ys: number[]) {
  const n = xs.length;
  const sx = sum(xs);
  const sy = sum(ys);
  const sxy = sum(xs.map((x, i) => x * ys[i]));
  const sxx = sum(xs.map((x) => x * x));
  const syy = sum(ys.map((y) => y * y));
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - m * sx) / n;
  const r2 = (n * sxy - sx * sy) ** 2 / ((n * sxx - sx * sx) * (n * syy - sy * sy));
  return { m, b, r2 };
}
const sse = (xs: number[], ys: number[], f: (x: number) => number) => sum(xs.map((x, i) => (ys[i] - f(x)) ** 2));

// ----------------------------------------------------------------------------------------------
// Linear

{
  // Lambert-Beer calibration: concentration (mg/L) against absorbance.
  const x = [0, 2, 4, 6, 8, 10];
  const y = [0.002, 0.105, 0.209, 0.311, 0.418, 0.52];
  const want = textbookLine(x, y);
  const f = fit("calibration", x, y, spec("linear"));
  close("calibration slope", f.coefficients[1], want.m, 1e-12);
  close("calibration intercept", f.coefficients[0], want.b, 1e-9);
  close("calibration R²", f.r2, want.r2, 1e-12);
  close("calibration slope by hand", f.coefficients[1], 21.786 / 420, 1e-12);
  close("calibration R² ≈ 0.99997", f.r2, 0.999969863735797, 1e-9);
  eq("calibration equation de", equationText(f, "de"), "y = 0,0519x + 0,0015");
  eq("calibration equation en", equationText(f, "en"), "y = 0.0519x + 0.0015");
  // Excel's label says "R² = 1" here; students judge calibration lines by R² ≥ 0,999, so Blob
  // shows the decimals that keep it below 1.
  eq("calibration R² text (not 1 like Excel)", r2Text(f.r2!, "de"), "R² = 0,99997");
  eq("calibration R² text en", r2Text(f.r2!, "en"), "R² = 0.99997");
  eq("calibration n", f.n, 6);
  // Excel keeps 4 decimals after "0,": more significant digits on request.
  eq("calibration equation 6 digits", equationText(f, "de", 6), "y = 0,0518714x + 0,00147619");
  close("solve 0,42", solveForX(f, 0.42), (0.42 - want.b) / want.m, 1e-12);

  // The textbook example x 1…5, y 2 4 5 4 5: y = 0,6x + 2,2 with R² = 0,6.
  const t = fit("textbook", [1, 2, 3, 4, 5], [2, 4, 5, 4, 5], spec("linear"));
  close("textbook slope", t.coefficients[1], 0.6, 1e-12);
  close("textbook intercept", t.coefficients[0], 2.2, 1e-12);
  close("textbook R²", t.r2, 0.6, 1e-12);
  eq("textbook equation", equationText(t, "de"), "y = 0,6x + 2,2");
  eq("textbook R² text", r2Text(t.r2!, "de"), "R² = 0,6");

  // Bradford-like protein standard (a bit curved), R² below 1.
  const bx = [0, 0.25, 0.5, 0.75, 1, 1.5];
  const by = [0, 0.152, 0.294, 0.421, 0.533, 0.71];
  const bw = textbookLine(bx, by);
  const bf = fit("bradford", bx, by, spec("linear"));
  close("bradford slope", bf.coefficients[1], bw.m, 1e-12);
  close("bradford R²", bf.r2, bw.r2, 1e-12);
  eq("bradford R² text", r2Text(bf.r2!, "de"), `R² = ${formatGeneral(bw.r2, "de")}`);
  check("bradford R² < 1", bf.r2! < 0.99 && bf.r2! > 0.95, bf.r2);

  // Fixed intercept 0 ("Schnittpunkt = 0"): m = Σxy / Σx², Excel's R² = 1 − SSE / Σy² (uncentred).
  const f0 = fit("through origin", x, y, spec("linear", { intercept: 0 }));
  const m0 = sum(x.map((v, i) => v * y[i])) / sum(x.map((v) => v * v));
  close("origin slope", f0.coefficients[1], m0, 1e-12);
  close("origin slope by hand", f0.coefficients[1], 11.456 / 220, 1e-12);
  eq("origin intercept exactly 0", f0.coefficients[0], 0);
  const sse0 = sse(x, y, (v) => m0 * v);
  close("origin R² uncentred", f0.r2, 1 - sse0 / sum(y.map((v) => v * v)), 1e-12);
  eq("origin equation", equationText(f0, "de"), "y = 0,0521x");
  // The uncentred R² of a poor line through 0 is still high, as in Excel.
  const poor = fit("poor origin", [1, 2, 3, 4], [5, 4, 6, 5], spec("linear", { intercept: 0 }));
  const mp = (5 + 8 + 18 + 20) / 30;
  close("poor origin R²", poor.r2, 1 - sse([1, 2, 3, 4], [5, 4, 6, 5], (v) => mp * v) / (25 + 16 + 36 + 25), 1e-12);
  // Another fixed intercept b₀: the regression of y − b₀ through the origin; R² = 1 − SSE / Σ(y − b₀)².
  const fb = fit("fixed 0,01", x, y, spec("linear", { intercept: 0.01 }));
  const mb = sum(x.map((v, i) => v * (y[i] - 0.01))) / sum(x.map((v) => v * v));
  close("fixed b slope", fb.coefficients[1], mb, 1e-12);
  eq("fixed b intercept", fb.coefficients[0], 0.01);
  close("fixed b R²", fb.r2, 1 - sse(x, y, (v) => mb * v + 0.01) / sum(y.map((v) => (v - 0.01) ** 2)), 1e-12);
  // …which equals LibreOffice's Σ(ŷ − b₀)² / (Σ(ŷ − b₀)² + SSE) for a least-squares fit.
  const ssReg = sum(x.map((v) => (mb * v) ** 2));
  close("fixed b R² = SSreg/(SSreg+SSE)", fb.r2, ssReg / (ssReg + sse(x, y, (v) => mb * v + 0.01)), 1e-12);

  // Gaps, errors, too few, singular.
  const g = fit("gaps", [0, NaN, 2, 3, Infinity], [1, 5, 3, NaN, 9], spec("linear"));
  eq("gaps use 2 pairs", g.n, 2);
  close("gaps slope", g.coefficients[1], 1, 1e-12);
  fitError("one point", [1], [2], spec("linear"), "too-few-points");
  fitError("no points", [], [], spec("linear"), "too-few-points");
  fitError("same x", [2, 2, 2], [1, 2, 3], spec("linear"), "singular");
  fitError("same x (0.1 noise)", [0.1, 0.1, 0.1], [1, 2, 3], spec("linear"), "singular");
  fitError("origin with x all 0", [0, 0], [1, 2], spec("linear", { intercept: 0 }), "singular");
  fitError("intercept NaN", [1, 2], [1, 2], spec("linear", { intercept: NaN }), "bad-intercept");
  const flat = fit("flat", [1, 2, 3], [4, 4, 4], spec("linear"));
  check("flat R² is #N/A (NaN)", Number.isNaN(flat.r2), flat.r2);
  eq("flat equation", equationText(flat, "de"), "y = 4");
  eq("flat R² text de", r2Text(flat.r2!, "de"), "R² = #NV");
  eq("flat R² text en", r2Text(flat.r2!, "en"), "R² = #N/A");
  check("flat has no x for 5", solveForX(flat, 5) === null);
}

// ----------------------------------------------------------------------------------------------
// Polynomial

{
  // An exact parabola: the coefficients come back exactly, R² = 1.
  const x = [-2, -1, 0, 1, 2, 3];
  const p = (v: number) => 2.5 * v * v - 1.3 * v + 0.4;
  const f = fit("parabola", x, x.map(p), spec("polynomial", { order: 2 }));
  close("parabola c0", f.coefficients[0], 0.4, 1e-10);
  close("parabola c1", f.coefficients[1], -1.3, 1e-10);
  close("parabola c2", f.coefficients[2], 2.5, 1e-10);
  close("parabola R²", f.r2, 1, 1e-12);
  eq("parabola equation de", equationText(f, "de"), "y = 2,5x² - 1,3x + 0,4");
  eq("parabola equation en", equationText(f, "en"), "y = 2.5x² - 1.3x + 0.4");
  eq("parabola parts", equationParts(f, "de"), [{ text: "y = 2,5x" }, { text: "2", sup: true, plain: "²" }, { text: " - 1,3x + 0,4" }]);

  // Noisy data against Cramer's rule on the normal equations.
  const nx = [1, 2, 3, 4, 5, 6, 7];
  const ny = [2.3, 3.9, 8.4, 15.6, 26.4, 37.8, 52.1];
  const S = (k: number) => sum(nx.map((v) => v ** k));
  const T = (k: number) => sum(nx.map((v, i) => v ** k * ny[i]));
  const A = [
    [S(0), S(1), S(2)],
    [S(1), S(2), S(3)],
    [S(2), S(3), S(4)],
  ];
  const B = [T(0), T(1), T(2)];
  const det3 = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(A);
  const cramer = [0, 1, 2].map((j) => det3(A.map((row, i) => row.map((v, c) => (c === j ? B[i] : v)))) / D);
  const nf = fit("noisy parabola", nx, ny, spec("polynomial", { order: 2 }));
  cramer.forEach((c, j) => close(`noisy parabola c${j}`, nf.coefficients[j], c, 1e-8));
  const pc = (v: number) => cramer[0] + cramer[1] * v + cramer[2] * v * v;
  const my = sum(ny) / ny.length;
  close("noisy parabola R²", nf.r2, 1 - sse(nx, ny, pc) / sum(ny.map((v) => (v - my) ** 2)), 1e-10);

  // A cubic and order 6 through exact data.
  const cx = [-3, -2, -1, 0, 1, 2, 3, 4];
  const cubic = fit("cubic", cx, cx.map((v) => v ** 3 - 2 * v + 1), spec("polynomial", { order: 3 }));
  [1, -2, 0, 1].forEach((c, j) => close(`cubic c${j}`, cubic.coefficients[j], c, 1e-9));
  eq("cubic equation", equationText(cubic, "de"), "y = x³ - 2x + 1");
  const sx = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  const six = fit("order 6", sx, sx.map((v) => 0.01 * v ** 6 - 0.2 * v ** 3 + v), spec("polynomial", { order: 6 }));
  [0, 1, 0, -0.2, 0, 0, 0.01].forEach((c, j) => check(`order 6 c${j}`, Math.abs(six.coefficients[j] - c) < 1e-8, six.coefficients[j]));

  // Years as x: centring keeps it accurate (raw normal equations would lose most digits).
  const years = [2000, 2001, 2002, 2003, 2004, 2005, 2006];
  const yq = (v: number) => 0.5 * (v - 2003) ** 2 + 3 * (v - 2003) + 10;
  const yf = fit("years", years, years.map(yq), spec("polynomial", { order: 2 }));
  close("years predict 2010", yf.predict(2010), yq(2010), 1e-10);
  close("years R²", yf.r2, 1, 1e-12);
  close("years c2", yf.coefficients[2], 0.5, 1e-9);

  // A fixed intercept: y − c₀ through the origin.
  const fx = [1, 2, 3, 4, 5];
  const fy = fx.map((v) => 2 * v * v + 3 * v + 5);
  const ff = fit("poly fixed", fx, fy, spec("polynomial", { order: 2, intercept: 5 }));
  close("poly fixed c1", ff.coefficients[1], 3, 1e-10);
  close("poly fixed c2", ff.coefficients[2], 2, 1e-10);
  eq("poly fixed c0 exact", ff.coefficients[0], 5);
  close("poly fixed R²", ff.r2, 1, 1e-12);
  // …with noise: R² = 1 − SSE / Σ(y − c₀)².
  const gy = [9.8, 19.3, 32.4, 48.1, 69.9];
  const gf = fit("poly fixed noisy", fx, gy, spec("polynomial", { order: 2, intercept: 5 }));
  // Normal equations of y − 5 = a x + b x² by hand.
  const s2 = sum(fx.map((v) => v ** 2));
  const s3 = sum(fx.map((v) => v ** 3));
  const s4 = sum(fx.map((v) => v ** 4));
  const t1 = sum(fx.map((v, i) => v * (gy[i] - 5)));
  const t2 = sum(fx.map((v, i) => v * v * (gy[i] - 5)));
  const det = s2 * s4 - s3 * s3;
  const a1 = (t1 * s4 - s3 * t2) / det;
  const a2 = (s2 * t2 - s3 * t1) / det;
  close("poly fixed noisy c1", gf.coefficients[1], a1, 1e-9);
  close("poly fixed noisy c2", gf.coefficients[2], a2, 1e-9);
  close("poly fixed noisy R²", gf.r2, 1 - sse(fx, gy, (v) => 5 + a1 * v + a2 * v * v) / sum(gy.map((v) => (v - 5) ** 2)), 1e-10);

  fitError("order 3 with 3 points", [1, 2, 3], [1, 4, 9], spec("polynomial", { order: 3 }), "too-few-points");
  fitError("order 2 with 2 distinct x", [1, 1, 2, 2], [1, 2, 3, 4], spec("polynomial", { order: 2 }), "singular");
  const clamp = fit("order 9 → 6", sx, sx.map((v) => v * v), spec("polynomial", { order: 9 }));
  eq("order clamps to 6", clamp.coefficients.length, 7);

  // Solving: the root inside the measured range, else the nearest one.
  const sq = fit("solve parabola", [0, 1, 2, 3, 4], [0, 1, 4, 9, 16], spec("polynomial", { order: 2 }));
  close("parabola x for 9 (not -3)", solveForX(sq, 9), 3, 1e-9);
  close("parabola x for 25 (nearest root 5)", solveForX(sq, 25), 5, 1e-9);
  check("parabola x for -1: none", solveForX(sq, -1) === null);
  // A curve that bends back inside the range: the branch where the data has that y.
  const hump = fit("hump", [0, 1, 2, 3, 4], [0, 3, 4, 3, 0], spec("polynomial", { order: 2 }));
  close("hump x for 3 near data x 1", solveForX(hump, hump.predict(1)), 1, 1e-6);
  close("cubic solve round trip", solveForX(cubic, cubic.predict(2.5)), 2.5, 1e-9);
  eq("real roots of x² - 1", realRoots([-1, 0, 1]), [-1, 1]);
  eq("double root of (x - 1)²", realRoots([1, -2, 1]), [1]);
  const r3 = realRoots([-6, 11, -6, 1]);
  check("roots of (x-1)(x-2)(x-3)", r3.length === 3 && near(r3[0], 1, 1e-9) && near(r3[1], 2, 1e-9) && near(r3[2], 3, 1e-9), r3);
}

// ----------------------------------------------------------------------------------------------
// Exponential, logarithmic, power, moving average

{
  // Exact exponential growth: a = 1,5, b = 0,3.
  const x = [0, 1, 2, 3, 4, 5];
  const f = fit("exp exact", x, x.map((v) => 1.5 * Math.exp(0.3 * v)), spec("exponential"));
  close("exp a", f.coefficients[0], 1.5, 1e-10);
  close("exp b", f.coefficients[1], 0.3, 1e-10);
  close("exp R²", f.r2, 1, 1e-12);
  eq("exp equation de", equationText(f, "de"), "y = 1,5e^(0,3x)");
  eq("exp equation en", equationText(f, "en"), "y = 1.5e^(0.3x)");
  eq("exp parts", equationParts(f, "de"), [{ text: "y = 1,5e" }, { text: "0,3x", sup: true, plain: "^(0,3x)" }]);
  close("exp solve", solveForX(f, 1.5 * Math.exp(0.9)), 3, 1e-10);

  // Growth curve with noise: Excel fits ln y linearly, and R² is that of the log fit.
  const gx = [0, 1, 2, 3, 4, 5, 6];
  const gy = [0.05, 0.09, 0.21, 0.38, 0.81, 1.52, 3.3];
  const ln = textbookLine(gx, gy.map(Math.log));
  const g = fit("growth", gx, gy, spec("exponential"));
  close("growth a = e^b", g.coefficients[0], Math.exp(ln.b), 1e-10);
  close("growth b = slope of ln y", g.coefficients[1], ln.m, 1e-10);
  close("growth R² on ln y", g.r2, ln.r2, 1e-10);
  // Not the R² of the curve on the original values.
  const yMean = sum(gy) / gy.length;
  const rawR2 = 1 - sse(gx, gy, g.predict) / sum(gy.map((v) => (v - yMean) ** 2));
  check("growth R² is not the raw one", Math.abs(rawR2 - (g.r2 ?? 0)) > 1e-4, { rawR2, r2: g.r2 });
  eq("growth equation", equationText(g, "de"), `y = ${formatGeneral(Math.exp(ln.b), "de")}e^(${formatGeneral(ln.m, "de")}x)`);

  // Fixed intercept a₀ = 0,05: ln y − ln a₀ = b·x through the origin, R² on that.
  const a0 = 0.05;
  const lyy = gy.map((v) => Math.log(v) - Math.log(a0));
  const b0 = sum(gx.map((v, i) => v * lyy[i])) / sum(gx.map((v) => v * v));
  const gf = fit("growth fixed", gx, gy, spec("exponential", { intercept: a0 }));
  eq("growth fixed a", gf.coefficients[0], a0);
  close("growth fixed b", gf.coefficients[1], b0, 1e-12);
  close("growth fixed R²", gf.r2, 1 - sse(gx, lyy, (v) => b0 * v) / sum(lyy.map((v) => v * v)), 1e-12);
  fitError("exp with y = 0", [1, 2, 3], [1, 0, 2], spec("exponential"), "non-positive-y");
  fitError("exp with y < 0", [1, 2, 3], [1, -1, 2], spec("exponential"), "non-positive-y");
  fitError("exp intercept 0", [1, 2, 3], [1, 2, 3], spec("exponential", { intercept: 0 }), "bad-intercept");
  const decay = fit("decay", [0, 1, 2], [2, 2 * Math.exp(-0.5), 2 * Math.exp(-1)], spec("exponential"));
  eq("negative exponent", equationText(decay, "de"), "y = 2e^(-0,5x)");
  eq("negative exponent en", equationText(decay, "en"), "y = 2e^(-0.5x)");

  // Logarithmic y = 2,1·ln(x) − 0,5.
  const lx = [0.5, 1, 2, 4, 8, 16];
  const lf = fit("log", lx, lx.map((v) => 2.1 * Math.log(v) - 0.5), spec("logarithmic"));
  close("log a", lf.coefficients[1], 2.1, 1e-10);
  close("log b", lf.coefficients[0], -0.5, 1e-10);
  eq("log equation de", equationText(lf, "de"), "y = 2,1ln(x) - 0,5");
  eq("log equation en", equationText(lf, "en"), "y = 2.1ln(x) - 0.5");
  check("log predicts NaN at 0", Number.isNaN(lf.predict(0)));
  close("log solve", solveForX(lf, lf.predict(3)), 3, 1e-10);
  const lnoisy = [0.2, 1.1, 2.3, 3.1, 4.4, 5.2];
  const lw = textbookLine(lx.map(Math.log), lnoisy);
  const lnf = fit("log noisy", lx, lnoisy, spec("logarithmic"));
  close("log noisy R² (on y)", lnf.r2, lw.r2, 1e-10);
  fitError("log with x = 0", [0, 1, 2], [1, 2, 3], spec("logarithmic"), "non-positive-x");
  const ignored = fit("log ignores intercept", lx, lnoisy, spec("logarithmic", { intercept: 0 }));
  close("log intercept ignored (as Excel)", ignored.coefficients[0], lnf.coefficients[0], 1e-12);

  // Power y = 3,2·x^0,75.
  const px = [1, 2, 3, 5, 8, 13];
  const pf = fit("power", px, px.map((v) => 3.2 * v ** 0.75), spec("power"));
  close("power a", pf.coefficients[0], 3.2, 1e-10);
  close("power b", pf.coefficients[1], 0.75, 1e-10);
  eq("power equation de", equationText(pf, "de"), "y = 3,2x^0,75");
  eq("power parts", equationParts(pf, "de"), [{ text: "y = 3,2x" }, { text: "0,75", sup: true, plain: "^0,75" }]);
  close("power solve", solveForX(pf, pf.predict(7)), 7, 1e-10);
  const pnoisy = [3.1, 5.6, 7.1, 10.9, 15.2, 21.8];
  const pw = textbookLine(px.map(Math.log), pnoisy.map(Math.log));
  const pnf = fit("power noisy", px, pnoisy, spec("power"));
  close("power noisy R² on logs", pnf.r2, pw.r2, 1e-10);
  close("power noisy a", pnf.coefficients[0], Math.exp(pw.b), 1e-10);
  fitError("power with x = 0", [0, 1, 2], [1, 2, 3], spec("power"), "non-positive-x");
  fitError("power with y = 0", [1, 2, 3], [0, 2, 3], spec("power"), "non-positive-y");

  // Moving average: the mean of points i−p+1…i at x of point i, in the data's order.
  const mf = fit("moving average", [1, 2, 3, 4, 5, 6], [2, 4, 6, 8, 10, 13], spec("movingAverage", { period: 3 }));
  eq("moving average points", mf.points, [
    { x: 3, y: 4 },
    { x: 4, y: 6 },
    { x: 5, y: 8 },
    { x: 6, y: 31 / 3 },
  ]);
  eq("moving average R² null", mf.r2, null);
  eq("moving average no equation", equationText(mf, "de"), "");
  close("moving average solve", solveForX(mf, 7), 4.5, 1e-12);
  fitError("moving average too few", [1, 2, 3], [1, 2, 3], spec("movingAverage", { period: 3 }), "too-few-points");
  const unsorted = fit("moving average order", [3, 1, 2], [30, 10, 20], spec("movingAverage", { period: 2 }));
  eq("moving average keeps the data's order", unsorted.points, [
    { x: 1, y: 20 },
    { x: 2, y: 15 },
  ]);
}

// ----------------------------------------------------------------------------------------------
// Numbers in labels

{
  const line = (m: number, b: number): Fit => ({ type: "linear", coefficients: [b, m], r2: 1, n: 2, predict: (x) => m * x + b });
  eq("sign: y = -1,2x + 3", equationText(line(-1.2, 3), "de"), "y = -1,2x + 3");
  eq("sign: minus intercept", equationText(line(2, -0.5), "de"), "y = 2x - 0,5");
  eq("tiny slope like Excel", equationText(line(0.00006, 0.0012), "de"), "y = 6E-05x + 0,0012");
  eq("tiny slope en", equationText(line(0.00006, 0.0012), "en"), "y = 6E-05x + 0.0012");
  eq("slope 1 dropped", equationText(line(1, 2), "de"), "y = x + 2");
  eq("slope -1", equationText(line(-1, 0), "de"), "y = -x");
  eq("huge numbers", equationText(line(25012.3, -4123456), "de"), "y = 25012x - 4E+06");
  eq("4 decimals", equationText(line(0.052345, 0.00123), "de"), "y = 0,0523x + 0,0012");
  eq("zero line", equationText(line(0, 0), "de"), "y = 0");
  const cases: [number, string][] = [
    [0.052345, "0,0523"],
    [7.85714, "7,8571"],
    [13.4592, "13,459"],
    [124.113, "124,11"],
    [3627.61, "3627,6"],
    [25012.3, "25012"],
    [123456.7, "123457"],
    [1234567, "1E+06"],
    [0.00051, "0,0005"],
    [0.00015, "0,0002"],
    [0.00006, "6E-05"],
    [0.000098, "1E-04"],
    [0.000012345, "1E-05"],
    [0.99996, "1"],
    [9.99996, "10"],
    [-0.5, "-0,5"],
    [0, "0"],
  ];
  for (const [v, s] of cases) eq(`general ${v}`, formatGeneral(v, "de"), s);
  eq("general en", formatGeneral(1234.5678, "en"), "1234.6");
  eq("R² 0,99874", r2Text(0.99874, "de"), "R² = 0,9987");
  eq("R² 0,95", r2Text(0.95, "en"), "R² = 0.95");
  eq("R² digits", r2Text(0.998741234, "de", 6), "R² = 0,998741");
  // R² never reads 1 unless it is 1 up to rounding noise: 4 decimals, more (up to 6) when those
  // would round up to 1, and past that the last decimal is cut, not rounded.
  const r2Cases: [number, string][] = [
    [1, "1"],
    [1 - 1e-15, "1"],
    [1 - 4e-13, "1"],
    [1 + 2e-16, "1"],
    [1 - 1e-12, "0,999999"],
    [0.99997, "0,99997"],
    [0.99996, "0,99996"],
    [0.99995, "0,99995"],
    [0.999949, "0,9999"],
    [0.99994, "0,9999"],
    [0.999996, "0,999996"],
    [0.9999996, "0,999999"],
    [0.99999999, "0,999999"],
    [0.9987, "0,9987"],
    [0.99874, "0,9987"],
    [0.99875, "0,9988"],
    [0.999, "0,999"],
    [0.6, "0,6"],
    [0.12345, "0,1235"],
    [0.00001, "0"],
    [0, "0"],
    [-0.25, "-0,25"],
  ];
  for (const [v, s] of r2Cases) eq(`R² ${v}`, formatR2(v, "de"), s);
  eq("R² NaN de", formatR2(NaN, "de"), "#NV");
  eq("R² en", formatR2(0.999969863735797, "en"), "0.99997");
  eq("R² text 0,99997", r2Text(0.99997, "de"), "R² = 0,99997");
  eq("R² text perfect", r2Text(1 - 2e-16, "de"), "R² = 1");
  eq("R² more digits near 1", r2Text(0.99999996, "de", 6), "R² = 0,99999996");
  eq("R² more digits cut", r2Text(1 - 1e-12, "de", 6), "R² = 0,999999999");
  eq("R² decimals", [r2Decimals(0.9987), r2Decimals(0.99997), r2Decimals(0.999996), r2Decimals(0.9999996), r2Decimals(1), r2Decimals(0.99997, 4, 8)], [4, 5, 6, 6, 4, 5]);
  // A noisy-but-excellent calibration (R² ≈ 0,99998) keeps its 5th decimal on every surface.
  {
    const near1 = fit("near 1", [0, 1, 2, 3, 4, 5], [0.001, 0.1, 0.202, 0.299, 0.401, 0.5], spec("linear"));
    check("near-1 fit is below 1", near1.r2! < 1 - 1e-6 && near1.r2! > 0.9999, near1.r2);
    check("near-1 fit label is not 1", r2Text(near1.r2!, "de") !== "R² = 1" && /^R² = 0,9999\d{1,2}$/.test(r2Text(near1.r2!, "de")), r2Text(near1.r2!, "de"));
  }
  eq("significant 5", formatSignificant(0.0523456, "de", 5), "0,052346");
  eq("significant big", formatSignificant(1234.5678, "en", 5), "1234.6");
  eq("significant tiny", formatSignificant(0.0000123456, "de", 4), "1,235E-05");
  eq("parse de comma", parseChartNumber("0,42", "de"), 0.42);
  eq("parse de thousands", parseChartNumber("1.234,5", "de"), 1234.5);
  eq("parse de dot", parseChartNumber("0.42", "de"), 0.42);
  eq("parse en", parseChartNumber("1,234.5", "en"), 1234.5);
  eq("parse exponent", parseChartNumber("1,5E-3", "de"), 0.0015);
  eq("parse minus sign", parseChartNumber("−2", "de"), -2);
  eq("parse junk", parseChartNumber("abc", "de"), null);
  eq("parse empty", parseChartNumber("  ", "de"), null);
}

// ----------------------------------------------------------------------------------------------
// Axes

{
  eq("nice 0.13", niceStep(0.13), 0.1);
  eq("nice 0.17", niceStep(0.17), 0.2);
  eq("nice 3.3", niceStep(3.3), 5);
  eq("nice 7.9", niceStep(7.9), 10);
  eq("nice 0.0004", niceStep(0.0004), 0.0005);
  const a = linearAxis(0, 10, { min: null, max: null, target: 5, zero: "excel", pad: true });
  eq("x 0…10 like Excel: 0…12", [a.min, a.max, a.step], [0, 12, 2]);
  eq("x 0…10 ticks", a.ticks, [0, 2, 4, 6, 8, 10, 12]);
  const e = linearAxis(0.002, 0.52, { min: null, max: null, target: 5, zero: "excel", pad: true });
  eq("absorbance axis", [e.min, e.max, e.step, e.decimals], [0, 0.6, 0.1, 1]);
  eq("absorbance ticks have no float noise", e.ticks, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  const high = linearAxis(50, 55, { min: null, max: null, target: 5, zero: "excel", pad: true });
  check("50…55 doesn't start at 0 (5/6 rule)", high.min > 0 && high.min <= 50 && high.max >= 55, high);
  const low = linearAxis(10, 100, { min: null, max: null, target: 5, zero: "excel", pad: true });
  eq("10…100 starts at 0", low.min, 0);
  const neg = linearAxis(-5, 5, { min: null, max: null, target: 5, zero: "excel", pad: true });
  check("-5…5 spans both", neg.min <= -5 && neg.max >= 5 && neg.ticks.includes(0), neg);
  const fixed = linearAxis(0, 10, { min: 0, max: 0.5, target: 5, zero: "excel", pad: true });
  eq("fixed ends", [fixed.min, fixed.max], [0, 0.5]);
  const one = linearAxis(5, 5, { min: null, max: null, target: 5, zero: "excel", pad: true });
  check("one value 5 → from 0", one.min === 0 && one.max >= 5, one);
  const cols = linearAxis(12, 33, { min: null, max: null, target: 5, zero: "always", pad: true });
  eq("columns from 0", cols.min, 0);
  const none = linearAxis(NaN, NaN, { min: null, max: null, target: 5, zero: "excel", pad: true });
  check("no data → 0…1", none.min === 0 && none.max >= 1, none);
  const lg = logAxis(0.05, 3, { min: null, max: null });
  eq("log decades", [lg.min, lg.max, lg.ticks], [0.01, 10, [0.01, 0.1, 1, 10]]);
  check("log minor 2…9", lg.minor.includes(0.02) && lg.minor.includes(0.9) && lg.minor.includes(5) && !lg.minor.includes(1), lg.minor);
  const lg1 = logAxis(12, 80, { min: null, max: null });
  eq("one decade labels 2 and 5", lg1.ticks, [10, 20, 50, 100]);
  const lgf = logAxis(0.05, 3, { min: 0.001, max: null });
  eq("log fixed min", lgf.min, 0.001);
  eq("log label 0,01", logTickLabel(0.01, "de"), "0,01");
  eq("log label 1000", logTickLabel(1000, "de"), "1000");
  eq("log label 1E+06", logTickLabel(1e6, "en"), "1E+06");
  eq("log label 0.001 en", logTickLabel(0.001, "en"), "0.001");
}

// ----------------------------------------------------------------------------------------------
// Chart data from cells (a fake Calc that reads the typed values)

function workbook(rows: (number | string | boolean | null)[][], styles: Record<string, Cell["s"]> = {}): Workbook {
  const cells: Record<string, Cell> = {};
  rows.forEach((r, ri) =>
    r.forEach((v, ci) => {
      const s = styles[cellKey(ri, ci)];
      if (v !== null || s) cells[cellKey(ri, ci)] = { ...(v !== null ? { v } : {}), ...(s ? { s } : {}) };
    }),
  );
  return { v: 1, sheets: [{ id: "s1", name: "Blatt 1", cells, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } }], charts: [], tables: [] };
}
function fakeCalc(wb: Workbook): Calc {
  const value = (sheetId: string, row: number, col: number): CellValue => {
    const v = wb.sheets.find((s) => s.id === sheetId)?.cells[cellKey(row, col)]?.v;
    return v === undefined ? null : v;
  };
  return {
    workbook: wb,
    value,
    values: (r: RangeRef) => Array.from({ length: r.r1 - r.r0 + 1 }, (_, i) => Array.from({ length: r.c1 - r.c0 + 1 }, (_, j) => value(r.sheetId, r.r0 + i, r.c0 + j))),
    evaluate: () => null,
  };
}
const ref = (r0: number, c0: number, r1: number, c1: number): RangeRef => ({ sheetId: "s1", r0, c0, r1, c1 });
const series = (id: string, y: RangeRef, extra: Partial<SeriesSpec> = {}): SeriesSpec => ({ id, name: "", nameRef: null, y, x: null, color: null, marker: "circle", line: "none", labels: false, errorBars: null, trendline: null, ...extra });
const chart = (kind: ChartSpec["kind"], x: RangeRef | null, s: SeriesSpec[], extra: Partial<ChartSpec> = {}): ChartSpec => ({
  id: "c1",
  sheetId: "s1",
  at: { row: 0, col: 4, dx: 0, dy: 0 },
  size: { w: 480, h: 300 },
  kind,
  title: "",
  x,
  series: s,
  xAxis: { title: "", min: null, max: null, log: false, grid: false, decimals: null },
  yAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
  legend: "none",
  ...extra,
});
const linearTl: TrendlineSpec = { type: "linear", order: 2, period: 2, intercept: null, showEquation: true, showR2: true, forward: 0, backward: 0, name: "" };

const lab = workbook(
  [
    ["Konzentration", "Extinktion", "Probe", "M1", "M2", "SD", "Mittelwert", "Stabw"],
    [0, 0.002, "A", 12, 14, 1.5, 13, 1.4],
    [2, 0.105, "B", 18, "n. b.", 0.5, 17.5, 0.7],
    [4, 0.209, "C", 25, 27, null, 26, 1.4],
    [6, 0.311, "D", 22, 20, 2, 21, 1.4],
    [8, 0.418, "E", 30, 33, 1, 31.5, 2.1],
    [10, 0.52, "F", 28, 26, 1, 27, 1.4],
  ],
  { [cellKey(1, 1)]: { fmt: { kind: "number", decimals: 3, unit: "AU" } }, [cellKey(1, 0)]: { fmt: { kind: "number", decimals: 1 } } },
);
const calc = fakeCalc(lab);

{
  const c = chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1), { name: "Extinktion", trendline: linearTl })]);
  const d = chartData(c, calc, "de");
  eq("scatter points", d.series[0].points.length, 6);
  eq("scatter first point", d.series[0].points[0], { x: 0, y: 0.002, row: 1, col: 1 });
  eq("scatter decimals from formats", [d.xDecimals, d.yDecimals], [1, 3]);
  eq("scatter y format", d.yFormat, { kind: "number", decimals: 3, unit: "AU" });
  const f = d.series[0].fit;
  check("scatter fit", !!f && !isFitError(f) && near(f.coefficients[1], 21.786 / 420, 1e-12), f);
  eq("scatter name typed", d.series[0].name, "Extinktion");
  eq("scatter colour from palette", d.series[0].color, "blue");
  eq("scatter has no categories", d.categories, []);

  // Text and gaps: the M2 column has "n. b." (not a number) → that point is skipped.
  const g = chartData(chart("scatter", ref(1, 0, 6, 0), [series("m2", ref(1, 4, 6, 4), { nameRef: ref(0, 4, 0, 4) })]), calc, "de");
  eq("non-numbers skipped", g.series[0].points.map((p) => p.x), [0, 4, 6, 8, 10]);
  eq("name from cell", g.series[0].name, "M2");
  // Text among x values: plotted against 1, 2, 3 … like Excel.
  const tx = chartData(chart("scatter", ref(1, 2, 6, 2), [series("m1", ref(1, 3, 6, 3))]), calc, "de");
  eq("text x → 1, 2, 3", tx.series[0].points.map((p) => p.x), [1, 2, 3, 4, 5, 6]);
  eq("default name", tx.series[0].name, "Reihe 1");
  eq("default name en", chartData(chart("scatter", null, [series("m1", ref(1, 3, 6, 3))]), calc, "en").series[0].name, "Series 1");

  // Columns: categories and error bars of every kind.
  const col = (eb: SeriesSpec["errorBars"]) => chartData(chart("column", ref(1, 2, 6, 2), [series("m1", ref(1, 3, 6, 3), { errorBars: eb })]), calc, "de").series[0].points;
  const cd = chartData(chart("column", ref(1, 2, 6, 2), [series("m1", ref(1, 3, 6, 3))]), calc, "de");
  eq("categories as shown", cd.categories, ["A", "B", "C", "D", "E", "F"]);
  eq("category x = index", cd.series[0].points.map((p) => p.x), [0, 1, 2, 3, 4, 5]);
  const fixedEb = col({ kind: "fixed", value: 2, plus: null, minus: null, direction: "both" })[0];
  eq("fixed error bars", [fixedEb.lo, fixedEb.hi], [10, 14]);
  const pctEb = col({ kind: "percent", value: 10, plus: null, minus: null, direction: "plus" })[1];
  check("percent error bars, plus only", pctEb.lo === 18 && near(pctEb.hi, 19.8, 1e-12), pctEb);
  const m1 = [12, 18, 25, 22, 30, 28];
  const mean = sum(m1) / 6;
  const sd = Math.sqrt(sum(m1.map((v) => (v - mean) ** 2)) / 5);
  const sdEb = col({ kind: "stdev", value: 2, plus: null, minus: null, direction: "both" })[2];
  check("stdev error bars: 2 × STABW.S around each point", near(sdEb.hi, 25 + 2 * sd, 1e-12) && near(sdEb.lo, 25 - 2 * sd, 1e-12), sdEb);
  const seEb = col({ kind: "stderr", value: 1, plus: null, minus: null, direction: "minus" })[0];
  check("stderr error bars: SD/√n, minus only", near(seEb.lo, 12 - sd / Math.sqrt(6), 1e-12) && seEb.hi === 12, seEb);
  const custom = col({ kind: "custom", value: 0, plus: ref(1, 5, 6, 5), minus: null, direction: "both" });
  eq("custom error bars (minus = plus)", custom.map((p) => [p.lo, p.hi]), [
    [10.5, 13.5],
    [17.5, 18.5],
    [25, 25],
    [20, 24],
    [29, 31],
    [27, 29],
  ]);
  const custom2 = col({ kind: "custom", value: 0, plus: ref(1, 5, 6, 5), minus: ref(1, 7, 6, 7), direction: "both" })[0];
  eq("custom error bars with own minus", [custom2.lo, custom2.hi], [10.6, 13.5]);

  // Category charts fit their trendline against 1, 2, 3 … (Excel), not 0, 1, 2 ….
  const lt = chartData(chart("line", ref(1, 2, 6, 2), [series("m1", ref(1, 3, 6, 3), { trendline: linearTl })]), calc, "de").series[0].fit;
  const want = textbookLine([1, 2, 3, 4, 5, 6], m1);
  check("category trendline x = 1…n", !!lt && !isFitError(lt) && near(lt.coefficients[1], want.m, 1e-12) && near(lt.coefficients[0], want.b, 1e-12), lt);
  // Domain errors reach the chart.
  const bad = chartData(chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1), { trendline: { ...linearTl, type: "logarithmic" } })]), calc, "de").series[0].fit;
  check("log trendline with x = 0 → error", isFitError(bad) && bad.error === "non-positive-x", bad);
  // Pies have no trendline.
  eq("pie: no fit", chartData(chart("pie", ref(1, 2, 6, 2), [series("m1", ref(1, 3, 6, 3), { trendline: linearTl })]), calc, "de").series[0].fit, null);

  // A whole column as the range: no empty categories after the data.
  const longCol = chartData(chart("column", ref(1, 2, 19999, 2), [series("m1", ref(1, 3, 19999, 3))]), calc, "de");
  eq("whole column → only filled categories", longCol.categories, ["A", "B", "C", "D", "E", "F"]);
  // Hidden rows are left out (Excel's default).
  const hiddenWb: Workbook = { ...lab, sheets: [{ ...lab.sheets[0], rows: { "2": { hidden: true } } }] };
  const hd = chartData(chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1))]), fakeCalc(hiddenWb), "de");
  eq("hidden row skipped", hd.series[0].points.map((p) => p.x), [0, 4, 6, 8, 10]);
  // No series, missing sheet.
  eq("no series", chartData(chart("scatter", null, []), calc, "de").series, []);
  eq("missing sheet", chartData(chart("scatter", null, [series("x", { ...ref(1, 1, 6, 1), sheetId: "gone" })]), calc, "de").series[0].points, []);
}

// Names and categories that are numbers or dates go through the engine's formatValue; check
// them once the engine is there.
let engineReady = false;
try {
  formatValue(1.5, undefined, "de");
  engineReady = true;
} catch {
  engineReady = false;
}
if (engineReady) {
  const nums = workbook([
    [2024, 2025],
    [1, 2],
    [3, 4],
  ]);
  const d = chartData(chart("column", ref(1, 0, 2, 0), [series("a", ref(1, 1, 2, 1), { nameRef: ref(0, 1, 0, 1) })]), fakeCalc(nums), "de");
  eq("numeric name via formatValue", d.series[0].name, formatValue(2025, undefined, "de"));
  eq("numeric categories via formatValue", d.categories, [formatValue(1, undefined, "de"), formatValue(3, undefined, "de")]);
}

// ----------------------------------------------------------------------------------------------
// The chart a selection makes

{
  const wbc = { ...lab, tables: [] };
  const sc = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 0, r1: 6, c1: 1 }], "de");
  check("calibration → scatter", sc?.kind === "scatter", sc?.kind);
  eq("scatter x = first column", sc?.x, ref(1, 0, 6, 0));
  eq("series y below the header", sc?.series.map((s) => s.y), [ref(1, 1, 6, 1)]);
  eq("series name from header cell", sc?.series[0].nameRef, ref(0, 1, 0, 1));
  eq("axis titles from headers", [sc?.xAxis.title, sc?.yAxis.title], ["Konzentration", "Extinktion"]);
  eq("title = the one series", sc?.title, "Extinktion");
  eq("placed right of the data", sc?.at, { row: 0, col: 3, dx: 0, dy: 0 });
  // Where it fits on screen: one empty column between data and chart when there is room, else
  // right beside the data (a laptop at 1440 px with the sidebar open and the settings beside the grid).
  if (sc) {
    const widths = [170, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const colX = (c: number) => widths.slice(0, c).reduce((a, b) => a + b, 0);
    const view = (right: number, extra: Partial<ChartViewport> = {}): ChartViewport => ({ left: 0, right, colX, zoom: 1, sidePanel: 0, ...extra });
    eq("room for the gap column", placeInView(sc, view(1200)).at, sc.at);
    eq("no room: beside the data", placeInView(sc, view(782)).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("settings about to open beside the grid", placeInView(sc, view(1134, { sidePanel: 352 })).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("not even beside the data: beside it, more of it shows", placeInView(sc, view(622)).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("gap column narrower than the gap: as made", placeInView({ ...sc, at: { ...sc.at, col: 3 } }, view(622, { colX: (c) => (c <= 2 ? colX(c) : colX(c) - 90) })).at, sc.at);
    eq("the column beside the data isn't empty", placeInView(sc, view(782), (c) => c !== 2).at, sc.at);
    eq("zoomed 150 %: beside the data", placeInView(sc, view(1200, { colX: (c) => colX(c) * 1.5, zoom: 1.5 })).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("scrolled past the data: as made", placeInView(sc, view(782, { left: 300 })).at, sc.at);
    eq("no grid on screen", placeInView(sc, null), sc);
  }
  eq("default size", sc?.size, { w: 480, h: 300 });
  eq("one series: no legend", sc?.legend, "none");
  eq("scatter: markers, no line", [sc?.series[0].marker, sc?.series[0].line], ["circle", "none"]);
  eq("y grid on, x grid off", [sc?.yAxis.grid, sc?.xAxis.grid], [true, false]);

  const one = chartFromAreas(wbc, calc, "s1", [{ r0: 3, c0: 1, r1: 3, c1: 1 }], "de");
  eq("one cell → the block around it", one?.series.length, 6);
  eq("current region", currentRegion(lab.sheets[0], 3, 1), { r0: 0, c0: 0, r1: 6, c1: 7 });

  const text = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 2, r1: 6, c1: 4 }], "de");
  check("text first → columns", text?.kind === "column", text?.kind);
  eq("categories from the text column", text?.x, ref(1, 2, 6, 2));
  eq("two series → legend below", [text?.series.length, text?.legend], [2, "bottom"]);
  eq("no title for several series", text?.title, "");

  const single = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 3, r1: 6, c1: 3 }], "de");
  check("one number column → line", single?.kind === "line" && single.x === null, single?.kind);
  eq("line: straight with markers", [single?.series[0].line, single?.series[0].marker], ["straight", "circle"]);

  const replicates = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 2, r1: 6, c1: 2 }, { r0: 0, c0: 6, r1: 6, c1: 7 }], "de");
  check("mean + SD → means with error bars", replicates?.series.length === 1 && replicates.series[0].errorBars?.kind === "custom", replicates?.series);
  eq("SD column as error amounts", replicates?.series[0].errorBars?.plus, ref(1, 7, 6, 7));
  eq("Ctrl areas: categories from the first", replicates?.x, ref(1, 2, 6, 2));
  eq("placed right of the last area", replicates?.at.col, 9);

  const whole = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 0, r1: 19999, c1: 1 }], "de");
  eq("whole columns cut to the data", whole?.series[0].y, ref(1, 1, 6, 1));

  const asked = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 0, r1: 6, c1: 1 }], "de", "column");
  eq("columns of x/y: the growing first column labels", [asked?.kind, asked?.x, asked?.series.length], ["column", ref(1, 0, 6, 0), 1]);
  const pie = chartFromAreas(wbc, calc, "s1", [{ r0: 0, c0: 2, r1: 6, c1: 4 }], "de", "pie");
  eq("pie takes one series", pie?.series.length, 1);
  const emptyWb = workbook([["a", "b"], ["c", "d"]]);
  eq("nothing numeric → null", chartFromAreas(emptyWb, fakeCalc(emptyWb), "s1", [{ r0: 0, c0: 0, r1: 1, c1: 1 }], "de"), null);
  eq("empty area → null", chartFromAreas(wbc, calc, "s1", [{ r0: 50, c0: 10, r1: 60, c1: 12 }], "de"), null);

  const named: Workbook = {
    ...lab,
    tables: [{ id: "t1", sheetId: "s1", name: "Kalibrierung", area: { r0: 0, c0: 0, r1: 6, c1: 1 }, columns: [], totals: false, style: "blue", banded: true, filters: {}, sort: null }],
  };
  eq("a smart table's name is the title", chartFromAreas(named, fakeCalc(named), "s1", [{ r0: 0, c0: 0, r1: 6, c1: 1 }], "de")?.title, "Kalibrierung");
  // What a selection means: a cell in a smart table → its header and data rows, never the totals row.
  const withTotals: Workbook = { ...named, tables: [{ ...named.tables[0], area: { r0: 0, c0: 0, r1: 7, c1: 1 }, totals: true }] };
  eq("cell in a table → header + data rows", chartSourceAreas(withTotals, "s1", [{ r0: 3, c0: 1, r1: 3, c1: 1 }]), [{ r0: 0, r1: 6, c0: 0, c1: 1 }]);
  eq("columns of a table → its rows", chartSourceAreas(withTotals, "s1", [{ r0: 2, c0: 1, r1: 4, c1: 1 }]), [{ r0: 0, r1: 6, c0: 1, c1: 1 }]);
  eq("a cell outside tables → the block", chartSourceAreas(lab, "s1", [{ r0: 2, c0: 2, r1: 2, c1: 2 }]), [{ r0: 0, c0: 0, r1: 6, c1: 7 }]);
  eq("a range stays", chartSourceAreas(lab, "s1", [{ r0: 0, c0: 0, r1: 6, c1: 1 }]), [{ r0: 0, c0: 0, r1: 6, c1: 1 }]);
  const auto: Workbook = { ...named, tables: [{ ...named.tables[0], name: "Tabelle1" }] };
  eq("an automatic table name isn't", chartFromAreas(auto, fakeCalc(auto), "s1", [{ r0: 0, c0: 0, r1: 6, c1: 1 }], "de")?.title, "Extinktion");
}

// ----------------------------------------------------------------------------------------------
// The drawing

{
  const tl = { ...linearTl };
  const kinds: ChartSpec["kind"][] = ["scatter", "line", "column", "bar", "area", "pie"];
  const variants: [string, ChartSpec][] = [];
  for (const k of kinds) {
    variants.push([
      k,
      chart(k, k === "scatter" ? ref(1, 0, 6, 0) : ref(1, 2, 6, 2), [series("a", ref(1, 3, 6, 3), { nameRef: ref(0, 3, 0, 3), trendline: tl, labels: true, line: "smooth", errorBars: { kind: "percent", value: 5, plus: null, minus: null, direction: "both" } }), series("b", ref(1, 4, 6, 4), { marker: "diamond", trendline: { ...tl, type: "polynomial", order: 3 } })], {
        title: `Test ${k}`,
        legend: "right",
      }),
    ]);
  }
  variants.push(["log axes", chart("scatter", ref(1, 0, 6, 0), [series("a", ref(1, 3, 6, 3), { trendline: { ...tl, type: "exponential", forward: 3, backward: 1 } })], { yAxis: { title: "OD", min: null, max: null, log: true, grid: true, decimals: null }, xAxis: { title: "t", min: null, max: null, log: true, grid: true, decimals: 1 } })]);
  variants.push(["tiny", chart("scatter", ref(1, 0, 6, 0), [series("a", ref(1, 1, 6, 1), { trendline: tl })], { size: { w: 120, h: 90 }, title: "Ein sehr langer Titel der nicht passt", legend: "bottom" })]);
  variants.push(["empty", chart("column", null, [])]);
  variants.push(["fixed axes", chart("scatter", ref(1, 0, 6, 0), [series("a", ref(1, 1, 6, 1), { trendline: { ...tl, type: "power" } })], { yAxis: { title: "", min: 0.1, max: 0.4, log: false, grid: true, decimals: 2 } })]);
  for (const [name, c] of variants) {
    for (const locale of ["de", "en"] as const) {
      const svg = chartSvg(c, chartData(c, calc, locale), locale);
      check(`svg ${name} ${locale} has no NaN/Infinity`, !/NaN|Infinity|undefined/.test(svg), svg.match(/.{40}(NaN|Infinity|undefined).{20}/)?.[0]);
      check(`svg ${name} ${locale} is one <svg>`, svg.startsWith("<svg ") && svg.endsWith("</svg>"));
    }
  }
  const cal = chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1), { name: "Extinktion", trendline: tl })], { title: "Kalibrierung" });
  const svg = chartSvg(cal, chartData(cal, calc, "de"), "de");
  check("equation in the SVG", svg.includes("y = 0,0519x + 0,0015"), svg.length);
  check("R² in the SVG (0,99997, not 1)", svg.includes("R² = 0,99997") && !svg.includes("R² = 1<"), svg.match(/R² = [^<]*/)?.[0]);
  check("aria summary", svg.includes('aria-label="Punktdiagramm Kalibrierung, 1 Reihe, Trendlinie y = 0,0519x + 0,0015, R² = 0,99997"'), svg.match(/aria-label="[^"]*"/)?.[0]);
  check("light colours in files", svg.includes("#1a73e8") && !svg.includes("var(--"));
  const scene = buildChartScene(cal, chartData(cal, calc, "de"), { width: 480, height: 300, locale: "de" });
  check("screen colours are CSS variables", JSON.stringify(scene.nodes).includes("var(--sheet-blue)"));
  eq("one tooltip per point", scene.hits.length, 6);
  check("tooltip says x and y", scene.hits[1].rows.map((r) => r.value).join(" ") === "2,0 0,105 AU", scene.hits[1].rows);
  const empty = buildChartScene(chart("scatter", null, []), chartData(chart("scatter", null, []), calc, "de"), { width: 480, height: 300, locale: "de" });
  check("empty chart says so", JSON.stringify(empty.nodes).includes("Noch keine Zahlen") && empty.plot === null);
  const poly = chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 3, 6, 3), { trendline: { ...tl, type: "polynomial" } })]);
  check("polynomial exponent drawn raised", JSON.stringify(buildChartScene(poly, chartData(poly, calc, "de"), { width: 480, height: 300, locale: "de" }).nodes).includes('"dy":-'));
}

const failed = problems.length;
if (failed) {
  console.error(`check:sheet-chart: ${failed} problem${failed === 1 ? "" : "s"} (${passed} passed)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check:sheet-chart: all ${passed} checks passed${engineReady ? "" : " (number names via the engine skipped: engine not ready)"}.`);
