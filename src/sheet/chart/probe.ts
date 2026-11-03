// "Probe berechnen" in the chart panel: the x of a sample from its measured y along the
// trendline (solveForX), written the way a lab report needs it: the result, the line that shows
// how it was worked out (with numbers that give that result on a calculator) and where it lies
// against the standards. Pure, so the check script tests it.

import type { Locale } from "@/i18n/config";
import { formatCoefficient, parseChartNumber } from "./format";
import { aOutOfRange, lnOfA, type Fit } from "./regression";

/** The result: 5 significant digits, huge ones like cell counts as 5,1833E+08. */
export const probeResultText = (x: number, locale: Locale) => formatCoefficient(x, locale, 5);

/**
 * The solution with the numbers put in: "x = (0,5 − 0,0254368) / 0,000946289 = 501,48" (the
 * models with a formula; null for polynomials and moving averages). The numbers are rounded so
 * that typing the line into a calculator gives the result shown: 6 significant digits, more where
 * 6 aren't enough (the result is worked out again from the rounded numbers to check).
 */
export function workedLine(fit: Fit, y: number, x: number, locale: Locale): string | null {
  const c = fit.coefficients;
  const result = probeResultText(x, locale);
  for (let d = 6; d <= 12; d++) {
    const n = (v: number) => formatCoefficient(v, locale, d);
    // What the student types: the shown numbers, not the exact ones.
    const shown = (v: number) => parseChartNumber(n(v), locale) ?? NaN;
    const minus = (a: string, v: number) => (v < 0 ? `${a} + ${n(-v)}` : `${a} − ${n(v)}`);
    const Y = shown(y);
    let line: string;
    let value: number;
    switch (fit.type) {
      case "linear":
        line = `x = (${minus(n(y), c[0])}) / ${n(c[1])}`;
        value = (Y - shown(c[0])) / shown(c[1]);
        break;
      case "logarithmic":
        line = `x = e^((${minus(n(y), c[0])}) / ${n(c[1])})`;
        value = Math.exp((Y - shown(c[0])) / shown(c[1]));
        break;
      case "exponential":
      case "power":
        if (aOutOfRange(fit)) {
          // a beyond what a number holds (dates as x): with ln a instead, (ln y − ln a) / b.
          const lnA = lnOfA(fit);
          const inner = `(${minus(`ln(${n(y)})`, lnA)}) / ${n(c[1])}`;
          const v = (Math.log(Y) - shown(lnA)) / shown(c[1]);
          line = fit.type === "exponential" ? `x = ${inner}` : `x = e^(${inner})`;
          value = fit.type === "exponential" ? v : Math.exp(v);
        } else if (fit.type === "exponential") {
          line = `x = ln(${n(y)} / ${n(c[0])}) / ${n(c[1])}`;
          value = Math.log(Y / shown(c[0])) / shown(c[1]);
        } else {
          line = `x = (${n(y)} / ${n(c[0])})^(1 / ${n(c[1])})`;
          value = (Y / shown(c[0])) ** (1 / shown(c[1]));
        }
        break;
      default:
        return null;
    }
    if (d === 12 || probeResultText(value, locale) === result) return `${line} = ${result}`;
  }
  return null;
}

/**
 * Where a sample's x lies against the standards (decided on x, so falling curves work too):
 * above the highest ("dilute it"), below the lowest ("measure it more concentrated"), or below 0
 * where the standards start at the blank or above ("below the blank"); null inside.
 */
export function probeRange(fit: Fit, x: number): "above" | "below" | "negative" | null {
  const lo = fit.xMin;
  const hi = fit.xMax;
  if (lo === undefined || hi === undefined) return null;
  if (x > hi + 1e-9 * Math.abs(hi)) return "above";
  if (x < lo - 1e-9 * Math.abs(lo)) return x < 0 && lo >= 0 ? "negative" : "below";
  return null;
}
