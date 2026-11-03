// Checks the spreadsheet charts (src/sheet/chart) before you commit.
//
//   npm run check:sheet-chart
//
// Trendlines must give what Excel gives (a student compares them with her course), so the
// expected numbers here are computed independently: closed-form sums for straight lines,
// Cramer's rule for parabolas, exact curves for the other models, plus textbook examples.
// Also: R² semantics of every model (fixed intercepts, logarithms), domain errors, the equation
// and R² text in German and English (4 significant digits per coefficient, the same rule as the
// .xlsx label format), solving for x and "Probe berechnen" (a worked line that adds up, advice
// above and below the standards, what it makes of what the student types), axis ticks, reading
// chart data from cells (with a small fake Calc, so this doesn't need the formula engine: hidden
// points, text among x values), the chart a selection makes and where it lands (beside the data,
// below it on a phone), the drawing itself (no NaN, the equation in the SVG, wrapped when long,
// forecasts on category charts, log axes with values ≤ 0, notes under the plot and in the aria
// label), and the chart on the screen (how far opening its settings scrolls, when the panel
// shows a copy of it, its action bar on a phone, reduced motion) with the panel's words.
// Problems make the script exit with 1.

import { chartDataBlock, placeInView } from "@/components/sheet/chart/actions";
import { barShift, inViewNext, revealScroll, scrollBehavior, shownShare, type Rect } from "@/components/sheet/chart/reveal";
import type { ChartViewport } from "@/components/sheet/chart/selection";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import { cellKey } from "@/sheet/a1";
import { linearAxis, logAxis, logTickLabel, logTicksScientific, niceStep } from "@/sheet/chart/axis";
import { chartFromAreas, chartSourceAreas, currentRegion } from "@/sheet/chart/create";
import { chartData } from "@/sheet/chart/data";
import { chartSvg } from "@/sheet/chart/export";
import { formatCoefficient, formatFromLn, formatGeneral, formatR2, formatSignificant, isCalendarFormat, parseChartNumber, r2Decimals } from "@/sheet/chart/format";
import { probeRange, probeResultText, probeSteps, readProbe, titleUnit } from "@/sheet/chart/probe";
import { aOutOfRange, equationParts, equationText, fitTrendline, isFitError, r2Text, realRoots, solveForX, type Fit, type FitError } from "@/sheet/chart/regression";
import { buildChartScene, textWidth, wrapEquation, type SvgNode } from "@/sheet/chart/scene";
import { formatValue, formatWithCode, type Calc, type CellValue } from "@/sheet/engine";
import { trendLabelFormat } from "@/sheet/io/xlsxCharts";
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
  // Every coefficient with 4 significant digits (Excel's narrow label would say 0,0519 and 0,0015).
  eq("calibration equation de", equationText(f, "de"), "y = 0,05187x + 0,001476");
  eq("calibration equation en", equationText(f, "en"), "y = 0.05187x + 0.001476");
  // Excel's label says "R² = 1" here; students judge calibration lines by R² ≥ 0,999, so Blob
  // shows the decimals that keep it below 1.
  eq("calibration R² text (not 1 like Excel)", r2Text(f.r2!, "de"), "R² = 0,99997");
  eq("calibration R² text en", r2Text(f.r2!, "en"), "R² = 0.99997");
  eq("calibration n", f.n, 6);
  // "More digits" in the panel: 6 significant digits.
  eq("calibration equation 6 digits", equationText(f, "de", 6), "y = 0,0518714x + 0,00147619");
  close("solve 0,42", solveForX(f, 0.42), (0.42 - want.b) / want.m, 1e-12);

  // Small and huge slopes keep their digits, so a student who works back from the label gets the
  // right concentration (Excel's narrow label: "0,0009x + 0,0254", 5 % off; "9E-10x", 5 % off).
  const brad = fit("bradford µg/mL", [0, 125, 250, 500, 750, 1000], [0.0247, 0.1472, 0.2587, 0.5007, 0.7317, 0.9737], spec("linear"));
  eq("bradford µg/mL label", equationText(brad, "de"), "y = 0,0009463x + 0,02544");
  const byHand = (0.5 - 0.02544) / 0.0009463;
  check("bradford: the label's numbers give the concentration within 0,05 %", Math.abs(byHand / solveForX(brad, 0.5)! - 1) < 5e-4, { byHand, exact: solveForX(brad, 0.5) });
  const cells = fit("cell counts", [1e8, 2e8, 5e8, 1e9, 2e9], [0.1, 0.21, 0.48, 0.95, 1.9], spec("linear"));
  eq("cell counts label", equationText(cells, "de"), "y = 9,434E-10x + 0,01098");
  check("cells: the label's numbers give the count within 0,05 %", Math.abs((0.5 - 0.01098) / 9.434e-10 / solveForX(cells, 0.5)! - 1) < 5e-4);
  // The chart label, its aria label and "Formel kopieren" all use equationText: 4 digits, 6 with "more digits".
  eq("bradford 6 digits", equationText(brad, "en", 6), "y = 0.000946316x + 0.0254368");

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
  eq("origin equation", equationText(f0, "de"), "y = 0,05207x");
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
  eq("growth equation", equationText(g, "de"), `y = ${formatCoefficient(Math.exp(ln.b), "de")}e^(${formatCoefficient(ln.m, "de")}x)`);
  eq("growth equation text", equationText(g, "de"), "y = 0,04832e^(0,699x)");

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
  fitError("exp intercept NaN", [1, 2, 3], [1, 2, 3], spec("exponential", { intercept: NaN }), "bad-intercept");
  // A fixed a of 0 or less (left over from a line through the origin) can't be: a is fitted, not
  // replaced by 1 (which drew a falling curve through growth data, R² 0,28).
  const ox = [1.5, 2, 2.5, 3, 3.5];
  const oy = [0.088, 0.172, 0.351, 0.694, 1.36];
  const free = fit("growth free", ox, oy, spec("exponential"));
  for (const a0 of [0, -1]) {
    const ig = fit(`growth with a ${a0}`, ox, oy, spec("exponential", { intercept: a0 }));
    check(`exp intercept ${a0} ignored: fitted a`, ig.intercept === null && near(ig.coefficients[0], free.coefficients[0], 1e-12) && near(ig.coefficients[1], free.coefficients[1], 1e-12) && ig.r2! > 0.999, ig);
  }
  eq("exp intercept 0 equation", equationText(fit("growth with 0", ox, oy, spec("exponential", { intercept: 0 })), "de"), "y = 0,01117e^(1,374x)");
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
// Dates as x: a of exponential and power fits is far below what a number holds (e^(−28 610)),
// yet the curve and the way back work (Excel's label says "0e^…" and Blob drew nothing).

{
  const d0 = 46325;
  const days = [0, 1, 2, 3, 4, 5, 6];
  const noise = [0, 0.03, -0.02, 0.04, -0.03, 0.02, -0.01];
  const counts = days.map((t) => Math.round(2e5 * Math.exp(0.62 * t) * (1 + noise[t])));
  const dx = days.map((t) => d0 + t);
  const fromStart = fit("cells from the start", days, counts, spec("exponential"));
  const dated = fit("cells by date", dx, counts, spec("exponential"));
  eq("dates: a is 0 as a number", dated.coefficients[0], 0);
  close("dates: same growth rate as from the start", dated.coefficients[1], fromStart.coefficients[1], 1e-9);
  close("dates: same R²", dated.r2, fromStart.r2!, 1e-9);
  close("dates: the curve has values", dated.predict(d0 + 3), fromStart.predict(3), 1e-6);
  close("dates: solve for 1 000 000 cells", solveForX(dated, 1e6), d0 + solveForX(fromStart, 1e6)!, 1e-9);
  eq("dates: the label shows a, not 0", equationText(dated, "de"), "y = 5,884E-12426e^(0,6179x)");
  const power = fit("cells by date, power", dx, counts, spec("power"));
  check("dates: power curve has values", Number.isFinite(power.predict(d0 + 3)) && power.predict(d0 + 3) > 1e6, power.predict(d0 + 3));
  check("dates: power solves", near(power.predict(solveForX(power, 1e6)!), 1e6, 1e-6), solveForX(power, 1e6));
  check("dates: power label has no 0x", !equationText(power, "de").startsWith("y = 0x"), equationText(power, "de"));
  // The panel's tip "use the time since the start as x" is for calendar dates (or an a beyond a
  // number), not for elapsed time typed as 0:00, 0:30, 1:00 …, which already is that.
  check("dates tip: dates and date-times are calendar dates", isCalendarFormat({ kind: "date", style: "short" }) && isCalendarFormat({ kind: "datetime" }));
  check("dates tip: a time is not", !isCalendarFormat({ kind: "time", seconds: false }) && !isCalendarFormat(null));
  const elapsed = fit("elapsed time as h:mm", [0, 1, 2, 3, 4, 5].map((k) => k / 48), [0.05, 0.07, 0.1, 0.14, 0.2, 0.28], spec("exponential"));
  check("dates tip: elapsed time keeps a in range", !aOutOfRange(elapsed) && aOutOfRange(dated), { elapsed: elapsed.coefficients, dated: dated.coefficients });
}

// ----------------------------------------------------------------------------------------------
// "Probe berechnen": the worked line gives the result shown when you type it into a calculator,
// and the advice depends on where the sample lies (dilute only when it is above the standards).

{
  const steps = (f: Fit, y: number, locale: "de" | "en" = "de") => probeSteps(f, y, solveForX(f, y), locale);
  const brad = fit("bradford probe", [0, 125, 250, 500, 750, 1000], [0.0247, 0.1472, 0.2587, 0.5007, 0.7317, 0.9737], spec("linear"));
  const xb = solveForX(brad, 0.5)!;
  eq("probe result", probeResultText(xb, "de"), "501,48");
  eq("probe worked line", steps(brad, 0.5), { formula: "x = (y − b) / m", line: "x = (0,5 − 0,0254368) / 0,000946316 = 501,48" });
  eq("probe worked line en", steps(brad, 0.5, "en").line, "x = (0.5 − 0.0254368) / 0.000946316 = 501.48");
  const cells = fit("cells probe", [1e8, 2e8, 5e8, 1e9, 2e9], [0.1, 0.21, 0.48, 0.95, 1.9], spec("linear"));
  const xc = solveForX(cells, 0.5)!;
  eq("probe: a cell count in scientific notation", probeResultText(xc, "de"), "5,1833E+08");
  eq("probe worked line, cells", steps(cells, 0.5).line, "x = (0,5 − 0,0109784) / 9,43449E-10 = 5,1833E+08");
  const lab = fit("lab probe", [0, 2, 4, 6, 8, 10], [0.002, 0.105, 0.209, 0.311, 0.418, 0.52], spec("linear"));
  eq("probe worked line, minus intercept", steps(lab, -0.01).line, "x = (-0,01 − 0,00147619) / 0,0518714 = -0,22124");
  // A calibration line through the origin only divides (no "(0,5 − 0)" in the lab report).
  const origin = fit("probe through the origin", [0, 100, 200, 400, 600, 800], [0, 0.098, 0.181, 0.349, 0.517, 0.664], spec("linear", { intercept: 0 }));
  eq("probe through the origin", steps(origin, 0.5), { formula: "x = y / m", line: "x = 0,5 / 0,00084876 = 589,09" });
  eq("probe through the origin en", steps(origin, -0.01, "en"), { formula: "x = y / m", line: "x = -0.01 / 0.00084876 = -11.782" });
  // Dates as x: a is beyond what a number holds, so the line works with ln a, and the formula
  // above it says what ln a is, rounded as in the line (growth: ln a < 0, decay: ln a > 0).
  const datesUp = fit("dates steps", [46325, 46326, 46327, 46328, 46329], [2e5, 3.7e5, 6.8e5, 1.3e6, 2.4e6], spec("exponential"));
  const datesDown = fit("dates decay steps", [46329, 46330, 46331, 46332, 46333, 46334], [5e6, 3.2e6, 2e6, 1.3e6, 8.3e5, 5.3e5], spec("exponential"));
  const datesPower = fit("dates power steps", [46325, 46326, 46327, 46328, 46329], [2e5, 3.7e5, 6.8e5, 1.3e6, 2.4e6], spec("power"));
  for (const [name, f, start] of [
    ["growth", datesUp, "x = (ln y − ln a) / b, mit ln a = "],
    ["decay", datesDown, "x = (ln y − ln a) / b, mit ln a = "],
    ["power", datesPower, "x = e^((ln y − ln a) / b), mit ln a = "],
  ] as const) {
    const s = steps(f, 1e6);
    const lnA = s.formula.startsWith(start) ? s.formula.slice(start.length) : "";
    const term = lnA.startsWith("-") ? `+ ${lnA.slice(1)})` : `− ${lnA})`;
    check(`probe with dates, ${name}: the formula names ln a`, /^-?\d+(,\d+)?$/.test(lnA), s.formula);
    check(`probe with dates, ${name}: the line uses that ln a`, !!s.line && s.line.includes(term), { formula: s.formula, line: s.line });
  }
  eq("probe with dates en", steps(datesUp, 1e6, "en").formula.startsWith("x = (ln y − ln a) / b, with ln a = -"), true);
  eq("probe without a result: the formula alone", steps(datesUp, -1), { formula: `x = (ln y − ln a) / b, mit ln a = ${formatCoefficient(datesUp.lnA!, "de", 6)}`, line: null });
  eq("probe on a polynomial: the description, no line", steps(fit("poly probe", [0, 1, 2, 3, 4], [0, 1.1, 3.9, 9.2, 15.8], spec("polynomial")), 5).line, null);
  // Every worked line, typed into a calculator, gives its own result (all models with a formula).
  const models: [string, Fit][] = [
    ["bradford", brad],
    ["cells", cells],
    ["lab", lab],
    ["origin", origin],
    ["exponential", fit("growth probe", [0, 1, 2, 3, 4, 5, 6], [0.05, 0.09, 0.21, 0.38, 0.81, 1.52, 3.3], spec("exponential"))],
    ["logarithmic", fit("log probe", [0.5, 1, 2, 4, 8, 16], [0.2, 1.1, 2.3, 3.1, 4.4, 5.2], spec("logarithmic"))],
    ["power", fit("power probe", [1, 2, 3, 5, 8, 13], [3.1, 5.6, 7.1, 10.9, 15.2, 21.8], spec("power"))],
    ["dates", datesUp],
    ["dates decay", datesDown],
    ["dates power", datesPower],
  ];
  const calculator = (line: string, locale: "de" | "en") => {
    // The line as a calculator reads it: numbers in the user's format, ln, e^, ^, −.
    const expr = line
      .replace(/^x = /, "")
      .replace(/ = [^=]*$/, "")
      .replace(/−/g, "-")
      .replace(/-?\d[\d.,]*(E[-+]\d+)?/g, (m) => `(${parseChartNumber(m, locale)})`)
      .replace(/ln\(/g, "Math.log(")
      .replace(/e\^\(/g, "Math.exp(")
      .replace(/\^/g, "**");
    return Function(`"use strict"; return (${expr});`)() as number;
  };
  for (const [name, f] of models) {
    for (const locale of ["de", "en"] as const) {
      for (const y of [0.05, 0.42, 1, 3, 12, 1e6]) {
        const x = solveForX(f, y);
        if (x === null) continue;
        const line = probeSteps(f, y, x, locale).line!;
        const shown = line.split(" = ").pop();
        check(`worked line adds up: ${name} ${y} ${locale}`, shown === probeResultText(x, locale) && probeResultText(calculator(line, locale), locale) === shown, line);
      }
    }
  }
  // Where the sample lies, decided on x (so falling curves work too).
  eq("probe inside", probeRange(lab, solveForX(lab, 0.3)!), null);
  eq("probe above the highest standard", probeRange(lab, solveForX(lab, 0.6)!), "above");
  eq("probe below the blank", probeRange(lab, solveForX(lab, 0.001)!), "negative");
  const noBlank = fit("no blank", [2, 4, 6, 8, 10], [0.105, 0.209, 0.311, 0.418, 0.52], spec("linear"));
  eq("probe below the lowest standard", probeRange(noBlank, solveForX(noBlank, 0.05)!), "below");
  const falling = fit("falling", [0, 2, 4, 6], [1, 0.8, 0.6, 0.4], spec("linear"));
  eq("probe on a falling line: high y is below", probeRange(falling, solveForX(falling, 1.2)!), "negative");
  eq("probe on a falling line: low y is above", probeRange(falling, solveForX(falling, 0.2)!), "above");

  // What the student types: a number, also with the y axis's own unit; a reason when it isn't one.
  // The start of a number says nothing yet; a concentration typed where the absorbance goes gets
  // its own reason (worked back, it would give a wrong result that looks right).
  const read = (text: string, yTitle = "Extinktion", xTitle = "Konzentration (mg/L)", locale: "de" | "en" = "de") => readProbe(text, locale, yTitle, xTitle);
  eq("probe input: a number", read("0,42"), { y: 0.42, problem: null });
  eq("probe input: a point works in German too", read("0.42").y, 0.42);
  eq("probe input: empty", read("  "), { y: null, problem: null });
  eq("probe input: letters", read("abc").problem, "notNumber");
  eq("probe input: the result's unit", read("0,42 mg/L").problem, { xUnit: "mg/L" });
  eq("probe input: a unit no axis has", read("0,42 mg/L", "Extinktion", "Konzentration").problem, "notNumber");
  eq("probe input: the y axis's unit is fine", read("1200 rfu", "Fluoreszenz (RFU)", "Konzentration (µg/mL)").y, 1200);
  eq("probe input: µ and μ are the same", read("12 μmol/L", "c [µmol/L]").y, 12);
  for (const partial of ["-", "+", ",", "1e", "1e-", "1,2E+", "0,42 E", "0,42 E-"]) eq(`probe input: still typing ${JSON.stringify(partial)}`, read(partial), { y: null, problem: "typing" });
  for (const bad of ["e5", "4 %", "12 x", "1..2a", "O,42"]) eq(`probe input: never a number ${JSON.stringify(bad)}`, read(bad).problem, "notNumber");
  eq("probe input en", read("1,200.5", "Absorbance", "Concentration (mg/L)", "en").y, 1200.5);
  eq("axis title units", ["Konzentration (mg/L)", "Extinktion", "c [µmol/L]", "OD (600 nm)", "Zeit (min) "].map(titleUnit), ["mg/L", null, "µmol/L", "600 nm", "min"]);
}

// ----------------------------------------------------------------------------------------------
// The .xlsx export's label format follows the same rule: Excel shows every coefficient with at
// least 4 significant digits, the same equation as Blob's chart to those digits.

{
  const fits: [string, Fit][] = [
    ["bradford", fit("x bradford", [0, 125, 250, 500, 750, 1000], [0.0247, 0.1472, 0.2587, 0.5007, 0.7317, 0.9737], spec("linear"))],
    ["cells", fit("x cells", [1e8, 2e8, 5e8, 1e9, 2e9], [0.1, 0.21, 0.48, 0.95, 1.9], spec("linear"))],
    ["lab", fit("x lab", [0, 2, 4, 6, 8, 10], [0.002, 0.105, 0.209, 0.311, 0.418, 0.52], spec("linear"))],
    ["quadratic", fit("x quad", [0, 125, 250, 500, 750, 1000], [0, 0.1347, 0.2633, 0.5027, 0.7113, 0.8993], spec("polynomial"))],
    ["growth", fit("x growth", [0, 1, 2, 3, 4, 5, 6], [0.05, 0.09, 0.21, 0.38, 0.81, 1.52, 3.3], spec("exponential"))],
    ["small", fit("x small", [0, 1, 2, 3], [0.00002, 0.00007, 0.00012, 0.00018], spec("linear"))],
  ];
  for (const [name, f] of fits) {
    const code = trendLabelFormat(f);
    for (const c of f.coefficients.filter((v) => v !== 0)) {
      const shown = formatWithCode(c, code, "de");
      const excel = typeof shown === "string" ? parseChartNumber(shown, "de") : null;
      const chart = parseChartNumber(formatCoefficient(c, "de"), "de");
      check(`xlsx label ${name}: ${c} keeps 4 digits in Excel`, excel !== null && Math.abs(excel - c) <= 5.000001e-4 * Math.abs(c), { code, excel });
      check(`xlsx label ${name}: ${c} agrees with the chart`, excel !== null && chart !== null && Math.abs(excel - chart) <= 1e-3 * Math.abs(c), { excel, chart });
    }
  }
}

// ----------------------------------------------------------------------------------------------
// Numbers in labels

{
  const line = (m: number, b: number): Fit => ({ type: "linear", coefficients: [b, m], r2: 1, n: 2, predict: (x) => m * x + b });
  eq("sign: y = -1,2x + 3", equationText(line(-1.2, 3), "de"), "y = -1,2x + 3");
  eq("sign: minus intercept", equationText(line(2, -0.5), "de"), "y = 2x - 0,5");
  eq("tiny slope", equationText(line(0.00006, 0.0012), "de"), "y = 6E-05x + 0,0012");
  eq("tiny slope en", equationText(line(0.00006, 0.0012), "en"), "y = 6E-05x + 0.0012");
  eq("tiny slope keeps its digits", equationText(line(0.0000523456, 0.0012), "de"), "y = 5,235E-05x + 0,0012");
  eq("slope 1 dropped", equationText(line(1, 2), "de"), "y = x + 2");
  eq("slope -1", equationText(line(-1, 0), "de"), "y = -x");
  eq("huge numbers", equationText(line(25012.3, -4123456), "de"), "y = 25012x - 4123456");
  eq("from 10 million on scientific", equationText(line(12345678, -5.6e10), "de"), "y = 1,235E+07x - 5,6E+10");
  eq("4 significant digits", equationText(line(0.052345, 0.00123), "de"), "y = 0,05235x + 0,00123");
  eq("zero line", equationText(line(0, 0), "de"), "y = 0");
  // Every coefficient formatCoefficient writes reads back within 4 significant digits, at any size.
  {
    const bad: string[] = [];
    for (let e = -12; e <= 12; e++) {
      for (const m of [1, 1.23456, 4.99995, 9.87654, 9.99996]) {
        for (const v of [m * 10 ** e, -m * 10 ** e]) {
          for (const locale of ["de", "en"] as const) {
            const s = formatCoefficient(v, locale);
            const back = parseChartNumber(s, locale);
            if (back === null || Math.abs(back - v) > 5.000001e-4 * Math.abs(v)) bad.push(`${v} → ${s}`);
          }
        }
      }
    }
    eq("coefficients keep 4 significant digits", bad, []);
  }
  const coefCases: [number, string][] = [
    [0.0518714, "0,05187"],
    [0.000946289, "0,0009463"],
    [0.00147619, "0,001476"],
    [9.43396e-10, "9,434E-10"],
    [7.85714, "7,857"],
    [25012.3, "25012"],
    [1234567.89, "1234568"],
    [12345678, "1,235E+07"],
    [0.000098, "9,8E-05"],
    [0.0012, "0,0012"],
    [-0.5, "-0,5"],
    [0, "0"],
  ];
  for (const [v, s] of coefCases) eq(`coefficient ${v}`, formatCoefficient(v, "de"), s);
  eq("coefficient 6 digits", formatCoefficient(0.0518714, "de", 6), "0,0518714");
  eq("coefficient en", formatCoefficient(0.000946289, "en"), "0.0009463");
  // A number known only by its logarithm (a of a fit with dates as x).
  eq("from ln: tiny", formatFromLn(-28411.9, "de"), "7,389E-12340");
  eq("from ln: huge", formatFromLn(23000, "en"), "5.93E+9988");
  eq("from ln: ordinary", formatFromLn(Math.log(0.0521), "de"), "0,0521");
  eq("from ln: rounds up a decade", formatFromLn(Math.LN10 * -1000 + Math.log(9.99996), "de"), "1E-999");
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
  // Text among x values: plotted against 1, 2, 3 … like Excel, and the first such cell is named.
  const tx = chartData(chart("scatter", ref(1, 2, 6, 2), [series("m1", ref(1, 3, 6, 3))]), calc, "de");
  eq("text x → 1, 2, 3", tx.series[0].points.map((p) => p.x), [1, 2, 3, 4, 5, 6]);
  eq("text x → which cell", tx.series[0].xText, { cell: "C2", text: "A", sheetId: "s1", row: 1, col: 2 });
  eq("numbers as x → no text cell", d.series[0].xText, undefined);
  {
    // "Blank" typed for the blank's concentration: the whole calibration silently became 1…6.
    const blank = workbook([["c", "E"], ["Blank", 0.003], [2, 0.104], [4, 0.207], [6, 0.318], [8, 0.423], [10, 0.522]]);
    const bd = chartData(chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1), { trendline: linearTl })]), fakeCalc(blank), "de");
    eq("blank as text → A2 named", [bd.series[0].xText?.cell, bd.series[0].xText?.text], ["A2", "Blank"]);
    // A hidden row's text doesn't count (the chart leaves the row out anyway).
    const hiddenBlank: Workbook = { ...blank, sheets: [{ ...blank.sheets[0], rows: { "1": { hidden: true } } }] };
    const hb = chartData(chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1))]), fakeCalc(hiddenBlank), "de");
    check("hidden text x cell → real x values", hb.series[0].xText === undefined && hb.series[0].points[0].x === 2, hb.series[0]);
    eq("hidden row counted", hb.series[0].hiddenPoints, 1);
    // x values on another sheet: the cell with its sheet's name.
    const other: Workbook = { ...blank, sheets: [blank.sheets[0], { ...blank.sheets[0], id: "s2", name: "Blatt 2" }] };
    const od = chartData(chart("scatter", { ...ref(1, 0, 6, 0), sheetId: "s2" }, [series("e", ref(1, 1, 6, 1))]), fakeCalc(other), "de");
    eq("text x on another sheet", od.series[0].xText?.cell, "'Blatt 2'!A2");
    // A series' own x values.
    const own = chartData(chart("scatter", null, [series("e", ref(1, 1, 6, 1), { x: ref(1, 0, 6, 0) })]), fakeCalc(blank), "de");
    eq("own x with text", own.series[0].xText?.cell, "A2");
  }
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
  // …and counted, so the panel can say that formulas like STEIGUNG still use it.
  eq("hidden points counted", hd.series[0].hiddenPoints, 1);
  eq("nothing hidden → no count", d.series[0].hiddenPoints, undefined);
  // A smart table's filter (here: Extinktion < 0,4) leaves rows out the same way, and they count too.
  const filteredWb: Workbook = {
    ...lab,
    tables: [{ id: "t1", sheetId: "s1", name: "Standards", area: { r0: 0, c0: 0, r1: 6, c1: 1 }, columns: [{ id: "tc1", total: "none" }, { id: "tc2", total: "none" }], totals: false, style: "blue", banded: true, filters: { tc2: { kind: "number", op: "lt", a: 0.4, b: null } }, sort: null }],
  };
  const fd = chartData(chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1))]), fakeCalc(filteredWb), "de");
  eq("filtered rows skipped and counted", [fd.series[0].points.map((p) => p.x), fd.series[0].hiddenPoints], [[0, 2, 4, 6], 2]);
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
    const rowY = (r: number) => r * 26;
    const view = (right: number, extra: Partial<ChartViewport> = {}): ChartViewport => ({ left: 0, right, top: 0, bottom: 520, colX, rowY, zoom: 1, sidePanel: 0, ...extra });
    eq("room for the gap column", placeInView(sc, view(1200)).at, sc.at);
    eq("no room: beside the data", placeInView(sc, view(782)).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("settings about to open beside the grid", placeInView(sc, view(1134, { sidePanel: 352 })).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("not even beside the data: beside it, more of it shows", placeInView(sc, view(622)).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("gap column narrower than the gap: as made", placeInView({ ...sc, at: { ...sc.at, col: 3 } }, view(622, { colX: (c) => (c <= 2 ? colX(c) : colX(c) - 90) })).at, sc.at);
    eq("the column beside the data isn't empty", placeInView(sc, view(782), (c) => c !== 2).at, sc.at);
    eq("zoomed 150 %: beside the data", placeInView(sc, view(1200, { colX: (c) => colX(c) * 1.5, zoom: 1.5 })).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("scrolled past the data: as made", placeInView(sc, view(782, { left: 300 })).at, sc.at);
    eq("no grid on screen", placeInView(sc, null), sc);

    // A phone (350 px of cells): beside the data only a sliver of the chart would show, so it goes
    // below the data, one empty row between, from the data's first column; past the slope and R²
    // under the data (a calibration sheet), never over them. With room enough beside the data
    // (a tablet held upright, a laptop with the settings open) it stays beside it.
    const block = chartDataBlock(wbc, sc);
    eq("data block of a chart: the filled cells around its ranges", block, { r0: 0, c0: 0, r1: 6, c1: 7 });
    const data = { r0: 0, c0: 0, r1: 6, c1: 1 };
    const empty = () => false;
    const below = (filled: (r: number, c: number) => boolean = empty) => ({ data, filled });
    eq("phone: below the data", placeInView(sc, view(350), undefined, below()).at, { row: 8, col: 0, dx: 0, dy: 0 });
    const results = (r: number, c: number) => (r === 8 || r === 9) && c <= 1;
    eq("phone: below the results under the data", placeInView(sc, view(350), undefined, below(results)).at, { row: 11, col: 0, dx: 0, dy: 0 });
    eq("phone: nothing free below: beside the data", placeInView(sc, view(350), undefined, below(() => true)).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("phone at 150 %: below the data", placeInView(sc, view(350, { colX: (c) => colX(c) * 1.5, rowY: (r) => rowY(r) * 1.5, zoom: 1.5 }), undefined, below()).at, { row: 8, col: 0, dx: 0, dy: 0 });
    eq("tablet: beside the data", placeInView(sc, view(740), undefined, below()).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("laptop with the settings beside the grid: beside the data", placeInView(sc, view(622), undefined, below()).at, { row: 0, col: 2, dx: 16, dy: 0 });
    eq("room for the gap column: as made, also with below", placeInView(sc, view(1200), undefined, below()).at, sc.at);
    const wide = (r: number, c: number) => r >= 8 && r <= 20 && c === 4;
    eq("phone: the chart's width counts (a filled cell under its right part)", placeInView(sc, view(350), undefined, below(wide)).at, { row: 22, col: 0, dx: 0, dy: 0 });
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
  // The chart label and the aria label carry the same 4 significant digits as the panel.
  check("equation in the SVG", svg.includes("y = 0,05187x + 0,001476"), svg.match(/y = [^<]*/)?.[0]);
  check("R² in the SVG (0,99997, not 1)", svg.includes("R² = 0,99997") && !svg.includes("R² = 1<"), svg.match(/R² = [^<]*/)?.[0]);
  check("aria summary", svg.includes('aria-label="Punktdiagramm Kalibrierung, 1 Reihe, Trendlinie y = 0,05187x + 0,001476, R² = 0,99997"'), svg.match(/aria-label="[^"]*"/)?.[0]);
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

// ----------------------------------------------------------------------------------------------
// The drawing: forecasts on category charts, log axes with values ≤ 0, notes under the plot,
// long equations, trendlines with dates as x.

/** Every <text> of a scene as it reads (its tspans joined). */
function sceneTexts(nodes: (SvgNode | string)[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (typeof n === "string") continue;
    if (n.tag === "text") out.push((n.children ?? []).map((c) => (typeof c === "string" ? c : (c.children ?? []).join(""))).join(""));
    else if (n.children) sceneTexts(n.children, out);
  }
  return out;
}
/** Paths of a scene with a given attribute (and the attributes). */
function scenePaths(nodes: (SvgNode | string)[], pick: (attrs: NonNullable<SvgNode["attrs"]>) => boolean, out: string[] = []): string[] {
  for (const n of nodes) {
    if (typeof n === "string") continue;
    if (n.tag === "path" && n.attrs && pick(n.attrs)) out.push(String(n.attrs.d ?? ""));
    if (n.children) scenePaths(n.children, pick, out);
  }
  return out;
}
/** The x (or y) coordinates of a path's points. */
const pathCoords = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
const trendPaths = (nodes: SvgNode[]) => scenePaths(nodes, (a) => a.strokeDasharray !== undefined && String(a.clipPath ?? "").includes("-tight"));

{
  // Forecasts on column, line, area and bar charts get categories of their own, like Excel: the
  // dashed line isn't cut off half a category after the last point any more.
  // (Values in the hundreds, so no value tick reads "5" or "6" like an extra category would.)
  const week = workbook([["Tag", "Wert"], ["Mo", 200], ["Di", 310], ["Mi", 390], ["Do", 520]]);
  const wc = fakeCalc(week);
  for (const kind of ["column", "line", "area", "bar"] as const) {
    const c = chart(kind, ref(1, 0, 4, 0), [series("w", ref(1, 1, 4, 1), { line: "straight", trendline: { ...linearTl, forward: 2, backward: 1 } })]);
    const scene = buildChartScene(c, chartData(c, wc, "de"), { width: 480, height: 300, locale: "de" });
    const P = scene.plot!;
    const pts = pathCoords(trendPaths(scene.nodes)[0] ?? "");
    const along = pts.map((p) => (kind === "bar" ? p.y : p.x));
    const [a0, a1] = kind === "bar" ? [P.y, P.y + P.h] : [P.x, P.x + P.w];
    const band = (a1 - a0) / 7;
    check(`${kind}: forecast drawn inside the plot`, along.length === 2 && near(Math.min(...along), a0 + 0.5 * band, 1e-3) && near(Math.max(...along), a1 - 0.5 * band, 1e-3), { along, a0, a1 });
    const texts = sceneTexts(scene.nodes);
    check(`${kind}: the extra categories have no labels`, ["Mo", "Di", "Mi", "Do"].every((s) => texts.includes(s)) && !texts.includes("5") && !texts.includes("6"), texts);
    eq(`${kind}: tooltips only for the data's categories`, scene.hits.map((h) => h.title), ["Mo", "Di", "Mi", "Do"]);
  }
  // "Rückwärts 0,5" (Excel's trick to start a column chart's trendline at the axis) adds nothing.
  const half = chart("column", ref(1, 0, 4, 0), [series("w", ref(1, 1, 4, 1), { trendline: { ...linearTl, backward: 0.5 } })]);
  const hs = buildChartScene(half, chartData(half, wc, "de"), { width: 480, height: 300, locale: "de" });
  const hp = pathCoords(trendPaths(hs.nodes)[0] ?? "");
  check("backward 0,5 reaches the axis", near(hp[0]?.x, hs.plot!.x, 1e-3), { first: hp[0], plot: hs.plot });
  // The value axis is stretched only for a forecast that is drawn: here it is.
  const lineFc = chart("line", ref(1, 0, 4, 0), [series("w", ref(1, 1, 4, 1), { trendline: { ...linearTl, forward: 3 } })]);
  const lf = buildChartScene(lineFc, chartData(lineFc, wc, "de"), { width: 480, height: 300, locale: "de" });
  check("line: forecast end inside the plot", Math.max(...pathCoords(trendPaths(lf.nodes)[0] ?? "").map((p) => p.x)) <= lf.plot!.x + lf.plot!.w + 0.01, lf.plot);
  // A forecast beyond the 500 extra categories is drawn as far as they reach, and the value axis
  // isn't stretched for the rest: the line ends near the top of the plot, not at a fifth of it.
  const far = chart("column", ref(1, 0, 4, 0), [series("w", ref(1, 1, 4, 1), { trendline: { ...linearTl, forward: 2000 } })]);
  const fs2 = buildChartScene(far, chartData(far, wc, "de"), { width: 480, height: 300, locale: "de" });
  const farEnd = pathCoords(trendPaths(fs2.nodes)[0] ?? "").pop();
  check("huge forecast: drawn to the last extra category, axis not stretched past it", !!farEnd && near(farEnd.x, fs2.plot!.x + fs2.plot!.w, 1e-3) && farEnd.y <= fs2.plot!.y + 0.25 * fs2.plot!.h, { farEnd, plot: fs2.plot });

  // A log axis: the 0 at the start of a growth curve isn't drawn (a note says so), the noisy
  // point's error bar that reaches below 0 runs off the bottom without a lower cap, and the
  // skipped point's error bar doesn't stretch the axis.
  const growth = workbook([["t", "OD", "SD"], [0, 0, 0.004], [1, 0.012, 0.015], [2, 0.05, 0.01], [3, 0.2, 0.03], [4, 0.8, 0.06], [5, 1.6, 0.1]]);
  const gc = fakeCalc(growth);
  const logChart = chart("scatter", ref(1, 0, 6, 0), [series("g", ref(1, 1, 6, 1), { errorBars: { kind: "custom", value: 0, plus: ref(1, 2, 6, 2), minus: null, direction: "both" } })], { yAxis: { title: "OD", min: null, max: null, log: true, grid: true, decimals: null } });
  for (const locale of ["de", "en"] as const) {
    const ls = buildChartScene(logChart, chartData(logChart, gc, locale), { width: 480, height: 300, locale });
    const texts = sceneTexts(ls.nodes);
    check(`log axis: note about the value ≤ 0 (${locale})`, texts.includes(locale === "de" ? "1 Wert ≤ 0 nicht gezeigt (Log-Achse)" : "1 value ≤ 0 not shown (log axis)"), texts);
    check(`log axis: the 0's error bar doesn't stretch the axis (${locale})`, texts.includes(locale === "de" ? "0,01" : "0.01") && !texts.includes(locale === "de" ? "0,001" : "0.001"), texts);
    const bars = scenePaths(ls.nodes, (a) => a.strokeWidth === 1.3).join("");
    const stems = [...bars.matchAll(/M[\d.]+ [\d.]+V[\d.]+/g)].length;
    const caps = [...bars.matchAll(/h[\d.]+/g)].length;
    check(`log axis: 5 error bars, one without its lower cap (${locale})`, stems === 5 && caps === 9, { stems, caps });
    check(`log axis: the bar below 0 runs to the plot's bottom (${locale})`, bars.includes(`${Math.round((ls.plot!.y + ls.plot!.h) * 100) / 100}V`), bars.slice(0, 80));
    // A screen reader gets the chart as its aria label only: the note is in it too.
    check(`log axis: the note in the aria label (${locale})`, ls.label.endsWith(locale === "de" ? ", 1 Reihe. 1 Wert ≤ 0 nicht gezeigt (Log-Achse)" : ", 1 series. 1 value ≤ 0 not shown (log axis)"), ls.label);
  }
  // A chart too small for the note still says it to a screen reader.
  const tinyLog = buildChartScene(logChart, chartData(logChart, gc, "de"), { width: 140, height: 100, locale: "de" });
  check("log axis, tiny chart: no room for the note, the aria label has it", !sceneTexts(tinyLog.nodes).some((s) => s.includes("Log-Achse")) && tinyLog.label.includes("1 Wert ≤ 0 nicht gezeigt"), { texts: sceneTexts(tinyLog.nodes), label: tinyLog.label });
  // Nothing above 0 at all: the message in the middle, no note under it.
  const zeros = workbook([["x", "y"], [1, 0], [2, -1]]);
  const zs = buildChartScene(chart("scatter", ref(1, 0, 2, 0), [series("z", ref(1, 1, 2, 1))], { yAxis: { title: "", min: null, max: null, log: true, grid: true, decimals: null } }), chartData(chart("scatter", ref(1, 0, 2, 0), [series("z", ref(1, 1, 2, 1))]), fakeCalc(zeros), "de"), { width: 480, height: 300, locale: "de" });
  check("log axis with nothing above 0 says so once", sceneTexts(zs.nodes).filter((s) => s.includes("Log-Achse") || s.includes("logarithmische")).length === 1, sceneTexts(zs.nodes));
  check("log axis with nothing above 0: the aria label says so", zs.label.endsWith(". Eine logarithmische Achse braucht Werte über 0"), zs.label);
  // A log x axis counts its values ≤ 0 too.
  const logX = chart("scatter", ref(1, 0, 6, 0), [series("g", ref(1, 3, 6, 3))], { xAxis: { title: "", min: null, max: null, log: true, grid: false, decimals: null } });
  check("log x axis: note about x ≤ 0", sceneTexts(buildChartScene(logX, chartData(logX, calc, "de"), { width: 480, height: 300, locale: "de" }).nodes).includes("1 Wert ≤ 0 nicht gezeigt (Log-Achse)"));

  // One notation per log axis.
  check("log ticks 1E-07…1E-03 all scientific", logTicksScientific([1e-7, 1e-6, 1e-5, 1e-4, 1e-3]) && [1e-7, 1e-5, 1e-3].map((v) => logTickLabel(v, "de", true)).join(" ") === "1E-07 1E-05 1E-03");
  check("log ticks 1000…1E+07 all scientific", logTicksScientific([1e3, 1e4, 1e5, 1e6, 1e7]) && logTickLabel(1e3, "de", true) === "1E+03" && logTickLabel(2e6, "de", true) === "2E+06");
  check("log ticks 0,01…100 written out", !logTicksScientific([0.01, 0.1, 1, 10, 100]) && logTickLabel(0.01, "de") === "0,01");
  const cfu = workbook([["t", "KBE/mL"], [0, 2e3], [1, 3e4], [2, 4e5], [3, 5e6], [4, 2e7]]);
  const cfuChart = chart("scatter", ref(1, 0, 5, 0), [series("k", ref(1, 1, 5, 1))], { yAxis: { title: "", min: null, max: null, log: true, grid: true, decimals: null } });
  const cfuTicks = sceneTexts(buildChartScene(cfuChart, chartData(cfuChart, fakeCalc(cfu), "de"), { width: 480, height: 300, locale: "de" }).nodes).filter((s) => /E\+|^1000/.test(s));
  eq("CFU axis in one notation", cfuTicks, ["1E+03", "1E+04", "1E+05", "1E+06", "1E+07", "1E+08"]);

  // Text among the x values: the chart itself says so (in the grid, in notes and in files).
  const blank = workbook([["c", "E"], ["Blank", 0.003], [2, 0.104], [4, 0.207], [6, 0.318], [8, 0.423], [10, 0.522]]);
  const textChart = chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1), { trendline: linearTl })]);
  check("text x: note in the SVG", chartSvg(textChart, chartData(textChart, fakeCalc(blank), "de"), "de").includes("Text in A2 statt Zahl – x ist hier 1, 2, 3 …"));
  check("text x: note in English", chartSvg(textChart, chartData(textChart, fakeCalc(blank), "en"), "en").includes("Text in A2 instead of a number – x is 1, 2, 3 … here"));
  check("text x: note in the SVG's aria label", /aria-label="[^"]*R² = [\d,]+\. Text in A2 statt Zahl – x ist hier 1, 2, 3 …"/.test(chartSvg(textChart, chartData(textChart, fakeCalc(blank), "de"), "de")), chartSvg(textChart, chartData(textChart, fakeCalc(blank), "de"), "de").match(/aria-label="[^"]*"/)?.[0]);
  const numericX = chart("scatter", ref(1, 0, 6, 0), [series("e", ref(1, 1, 6, 1))]);
  const numericScene = buildChartScene(numericX, chartData(numericX, calc, "de"), { width: 480, height: 300, locale: "de" });
  check("numbers as x: no note", !sceneTexts(numericScene.nodes).some((s) => s.includes("statt Zahl")) && numericScene.label === "Punktdiagramm, 1 Reihe", { label: numericScene.label });
  // The panel's hint names the trendline only where one uses these x values.
  check("text x panel hint: a trendline is wrong too", sheetChartText.de.xTextPanel("A2", "Blank", true).includes("Trendlinie und Probe stimmen so nicht") && sheetChartText.en.xTextPanel("A2", "Blank", true).includes("trendline"));
  check("text x panel hint: no trendline, no word about it", !sheetChartText.de.xTextPanel("C4", "vier", false).includes("Trendlinie") && !sheetChartText.en.xTextPanel("C4", "four", false).includes("trendline"));

  // A long equation is broken between its terms, not run past the plot.
  const sixth = fit("6th order", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [1.3, 1.9, 2.5, 3.1, 3.5, 4, 4.3, 4.8, 5.1, 5.6, 5.9, 6.4], spec("polynomial", { order: 6 }));
  const parts = equationParts(sixth, "de");
  const wrapped = wrapEquation(parts, 260, 12);
  const lineText = (ps: typeof parts) => ps.map((p) => (p.sup ? (p.plain ?? p.text) : p.text)).join("");
  check("long equation wraps", wrapped.length >= 2 && wrapped.every((l) => l.indent + l.parts.reduce((w, p) => w + textWidth(p.text, p.sup ? 12 * 0.72 : 12), 0) <= 260), wrapped.map((l) => lineText(l.parts)));
  eq("wrapped lines read as the equation", wrapped.map((l) => lineText(l.parts)).join(" "), equationText(sixth, "de"));
  check("continuation lines start with their sign, after y =", wrapped.slice(1).every((l) => /^[+-] /.test(lineText(l.parts)) && l.indent > 0), wrapped.map((l) => lineText(l.parts)));
  eq("short equation stays one line", wrapEquation(equationParts(fit("short", [0, 1, 2], [1, 3, 5], spec("linear")), "de"), 260, 12).length, 1);

  // Dates as x: the exponential curve is drawn (it was missing), and has its legend entry.
  const datesWb = workbook(
    [["Datum", "Zellen"], ...[0, 1, 2, 3, 4, 5, 6].map((t) => [46325 + t, Math.round(2e5 * Math.exp(0.62 * t) * (1 + [0, 0.03, -0.02, 0.04, -0.03, 0.02, -0.01][t]))])],
    Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((r) => [cellKey(r, 0), { fmt: { kind: "date" as const, style: "short" as const } }])),
  );
  for (const type of ["exponential", "power"] as const) {
    const dc = chart("scatter", ref(1, 0, 7, 0), [series("c", ref(1, 1, 7, 1), { trendline: { ...linearTl, type } })], { legend: "bottom" });
    const ds = buildChartScene(dc, chartData(dc, fakeCalc(datesWb), "de"), { width: 480, height: 300, locale: "de" });
    check(`dates ${type}: the trendline is drawn`, pathCoords(trendPaths(ds.nodes)[0] ?? "").length > 100, trendPaths(ds.nodes)[0]?.slice(0, 60));
    check(`dates ${type}: legend entry`, sceneTexts(ds.nodes).some((s) => s.includes("(Reihe 1)")), sceneTexts(ds.nodes));
  }
  // A trendline with nothing to draw on the axes has no legend entry.
  const negWb = workbook([["x", "y"], [1, 5], [2, 4], [3, 3.2], [4, 2.1]]);
  const negLine = chart("scatter", ref(1, 0, 4, 0), [series("n", ref(1, 1, 4, 1), { trendline: { ...linearTl, forward: 0 } })], { legend: "bottom", yAxis: { title: "", min: null, max: null, log: true, grid: true, decimals: null } });
  check("drawn trendline has its legend entry", sceneTexts(buildChartScene(negLine, chartData(negLine, fakeCalc(negWb), "de"), { width: 480, height: 300, locale: "de" }).nodes).includes("Linear (Reihe 1)"));
  // (The line through these is below 0 from x = 1 to 5; only the last point shows.)
  const allNeg = workbook([["x", "y"], [1, -5], [2, -4], [3, -3], [4, -2], [5, 0.01]]);
  const negChart = chart("scatter", ref(1, 0, 5, 0), [series("n", ref(1, 1, 5, 1), { trendline: linearTl })], { legend: "bottom", yAxis: { title: "", min: null, max: null, log: true, grid: true, decimals: null } });
  const negScene = buildChartScene(negChart, chartData(negChart, fakeCalc(allNeg), "de"), { width: 480, height: 300, locale: "de" });
  check("trendline below 0 on a log axis: no legend entry", trendPaths(negScene.nodes).every((d) => !d) && !sceneTexts(negScene.nodes).includes("Linear (Reihe 1)"), sceneTexts(negScene.nodes));
}

// ----------------------------------------------------------------------------------------------
// The chart on the screen: how far opening its settings scrolls the grid (never pushing the data
// it is made from out of view), when the panel shows a copy of it, and where its action bar goes
// on a phone. Screen px, measured in the browser at 1280 and 1440 px and on a tablet.

{
  const r = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom });
  const scroll = { left: 0, top: 0, maxLeft: 2000, maxTop: 4000 };
  // Laptop, 1280 px with the sidebar: the calibration template's chart beside its table, the
  // settings open beside the grid. Column A (the labels) starts at the room's left edge.
  const room1280 = r(297, 225, 920, 750);
  const card1280 = r(742, 320, 1203, 620);
  const labels = r(297, 317, 727, 513);
  const opening = revealScroll({ card: card1280, room: room1280, bar: "above", data: labels, mode: "settings", scroll });
  eq("settings at 1280: the labels stay, nothing scrolls", opening, { left: 0, top: 0 });
  check("settings at 1280: the chart is mostly hidden, the panel shows it", !inViewNext(null, shownShare(card1280, room1280)), shownShare(card1280, room1280));
  eq("duplicated or from a note: the chart comes into view", revealScroll({ card: card1280, room: room1280, bar: "above", data: labels, mode: "show", scroll })?.left, 295);
  eq("settings, data further right: up to its left edge", revealScroll({ card: card1280, room: room1280, bar: "above", data: r(497, 317, 927, 513), mode: "settings", scroll })?.left, 200);
  eq("settings, column A partly scrolled away already: no further", revealScroll({ card: card1280, room: room1280, bar: "above", data: r(237, 317, 667, 513), mode: "settings", scroll })?.left, 0);
  eq("settings, data out of view on the left: the chart comes in", revealScroll({ card: card1280, room: room1280, bar: "above", data: r(100, 317, 280, 513), mode: "settings", scroll })?.left, 295);
  eq("no data on the chart's sheet: the chart comes in", revealScroll({ card: card1280, room: room1280, bar: "above", data: null, mode: "settings", scroll })?.left, 295);
  eq("as far as the grid scrolls", revealScroll({ card: card1280, room: room1280, bar: "above", data: null, mode: "show", scroll: { ...scroll, maxLeft: 120 } })?.left, 120);
  eq("chart left of the room: back left", revealScroll({ card: r(250, 320, 730, 620), room: room1280, bar: "above", data: labels, mode: "settings", scroll: { ...scroll, left: 400 } })?.left, 341);
  // Tablet held upright: settings docked from y 531 down. A chart under them comes up into the
  // room above them only as far as the data's header row stays in view.
  const roomTablet = r(40, 224, 820, 531);
  eq("docked, chart beside the data: up into the room, its top first", revealScroll({ card: r(300, 400, 780, 700), room: roomTablet, bar: "above", data: r(40, 400, 300, 600), mode: "settings", scroll })?.top, 112);
  eq("docked, chart below the data: the header row stays", revealScroll({ card: r(40, 600, 520, 900), room: roomTablet, bar: "above", data: r(40, 250, 300, 450), mode: "settings", scroll })?.top, 26);
  eq("docked over nearly all of the grid: no room", revealScroll({ card: card1280, room: r(40, 224, 820, 240), bar: "above", data: null, mode: "show", scroll }), null);
  const fits = revealScroll({ card: r(300, 230, 780, 520), room: roomTablet, bar: "below", data: r(40, 224, 300, 400), mode: "settings", scroll });
  eq("docked, chart in view already: nothing scrolls", fits, { left: 0, top: 0 });

  // How much shows, and the copy in the panel: shown when under 90 % of the chart can be seen,
  // gone again only from 90 %, and once gone it comes back only under 75 % (no flicker while
  // scrolling a little).
  eq("shown share: all", shownShare(r(100, 100, 300, 200), r(0, 0, 1000, 1000)), 1);
  eq("shown share: the smaller of width and height", shownShare(r(100, 100, 300, 200), r(0, 0, 200, 1000)), 0.5);
  eq("shown share: none", shownShare(r(100, 100, 300, 200), r(400, 0, 1000, 1000)), 0);
  eq("in view: decided once", [inViewNext(null, 0.95), inViewNext(null, 0.85)], [true, false]);
  eq("in view: slack either way", [inViewNext(true, 0.8), inViewNext(true, 0.7), inViewNext(false, 0.85), inViewNext(false, 0.9)], [true, false, false, true]);

  // The action bar on a phone (cells from x 40 to 390): a chart wider than the screen keeps its
  // buttons on screen, a bar wider than what shows of the chart starts at its left, and nothing
  // moves for a chart scrolled out of view.
  const phone = r(40, 200, 390, 760);
  const bar = (left: number, top: number, w = 330) => r(left, top, left + w, top + 44);
  eq("bar of a wide chart: pulled in from the right", barShift(bar(115, 252), r(40, 300, 520, 600), phone), { x: -63, y: 0 });
  eq("bar wider than what shows of the chart: over the cells beside it, all on screen", barShift(bar(375, 252), r(300, 300, 780, 600), phone), { x: -323, y: 0 });
  eq("bar wider than the screen: from its left", barShift(bar(100, 252, 400), r(40, 300, 520, 600), phone), { x: -52, y: 0 });
  eq("laptop, chart half under the settings: the bar ends where the chart is cut", barShift(bar(808, 272), r(743, 320, 1203, 620), r(297, 225, 919, 750)), { x: -227, y: 0 });
  eq("bar of a chart out of view: stays", barShift(bar(475, 252), r(400, 300, 880, 600), phone), { x: 0, y: 0 });
  eq("bar above a chart scrolled up: down into view", barShift(bar(100, 166, 200), r(40, 214, 520, 514), phone), { x: 0, y: 42 });
  eq("bar below a chart, past the bottom: up into view", barShift(bar(100, 770, 200), r(40, 460, 520, 760), phone), { x: 0, y: -62 });
  eq("bar of a chart below the screen: stays", barShift(bar(100, 770, 200), r(40, 820, 520, 1120), phone), { x: 0, y: 0 });
  eq("bar in place: no shift", barShift(bar(100, 252, 200), r(40, 300, 520, 600), phone), { x: 0, y: 0 });

  // Less motion: the grid jumps instead of gliding.
  const real = (globalThis as { window?: unknown }).window;
  eq("scrolling: smooth without a window", scrollBehavior(), "smooth");
  (globalThis as { window?: unknown }).window = { matchMedia: (q: string) => ({ matches: q.includes("reduce") }) };
  eq("scrolling: instant with reduced motion", scrollBehavior(), "auto");
  (globalThis as { window?: unknown }).window = real;

  // Words a student knows, the same as in the rest of Blob (Fehlerbalken), the switch and the
  // field of a fixed intercept named apart, axes named by where they run.
  const de = sheetChartText.de;
  const en = sheetChartText.en;
  eq("error bars as in the templates", [de.sections.errors, de.undo.errors], ["Fehlerbalken", "Fehlerbalken ändern"]);
  eq("axes of a column chart", [de.axisCategories(false), de.axisValues(true)], ["Horizontale Achse (Kategorien)", "Vertikale Achse (Werte)"]);
  eq("axes of a bar chart", [de.axisCategories(true), de.axisValues(false)], ["Vertikale Achse (Kategorien)", "Horizontale Achse (Werte)"]);
  eq("axes in English", [en.axisCategories(false), en.axisValues(true)], ["Horizontal axis (categories)", "Vertical axis (values)"]);
  check("no Excel jargon", !/Rubrik|Größenachse/.test(JSON.stringify(de)) && !JSON.stringify(de.sections).includes("Fehlerindikator"));
  check("intercept: switch and field named apart", de.interceptValue !== de.setIntercept && en.interceptValue !== en.setIntercept, [de.interceptValue, en.interceptValue]);
}

const failed = problems.length;
if (failed) {
  console.error(`check:sheet-chart: ${failed} problem${failed === 1 ? "" : "s"} (${passed} passed)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check:sheet-chart: all ${passed} checks passed${engineReady ? "" : " (number names via the engine skipped: engine not ready)"}.`);
