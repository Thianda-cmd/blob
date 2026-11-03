// "Probe berechnen" in the chart panel: the x of a sample from its measured y along the
// trendline (solveForX), written the way a lab report needs it: the result, the formula and the
// line that shows how it was worked out (with numbers that give that result on a calculator) and
// where it lies against the standards. What the student typed is read here too, with a reason
// when it isn't a number. Pure, so the check script tests it.

import type { Locale } from "@/i18n/config";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import { formatCoefficient, parseChartNumber } from "./format";
import { aOutOfRange, lnOfA, type Fit } from "./regression";

/** The result: 5 significant digits, huge ones like cell counts as 5,1833E+08. */
export const probeResultText = (x: number, locale: Locale) => formatCoefficient(x, locale, 5);

/** The unit in an axis title's brackets at its end: "Konzentration (mg/L)" → "mg/L", "c [µmol/L]" → "µmol/L"; null without one. */
export function titleUnit(title: string): string | null {
  const m = /[([]\s*([^()[\]]+?)\s*[)\]]$/.exec(title.trim());
  return m ? m[1] : null;
}

const sameUnit = (a: string, b: string) => {
  const norm = (u: string) => u.toLowerCase().replace(/\s+/g, "").replace(/μ/g, "µ");
  return norm(a) === norm(b);
};

/** The start of a number, still being typed: "-", "0,", "1e-", ",5". */
const NUMBER_START = /^[-+]?(?:(?:\d[\d.,]*|[.,]\d*)(?:[eE][-+]?\d*)?)?$/;

/**
 * The measured value typed into "Probe berechnen". A number, also with the unit of the y axis
 * ("1200 RFU" when the axis is "Fluoreszenz (RFU)"). Otherwise y is null, and `problem` says why:
 * `typing` for the start of a number ("-", "1e-": say nothing yet, the student isn't done),
 * `xUnit` for a number with the unit of the result (a concentration typed where the absorbance
 * goes: worked back, it would give a wrong answer that looks right), `notNumber` for the rest
 * ("abc", "0,42 mg/L" on an axis without that unit). Any other unit isn't stripped, for the same
 * reason.
 */
export function readProbe(text: string, locale: Locale, yTitle: string, xTitle: string): { y: number | null; problem: null | "typing" | "notNumber" | { xUnit: string } } {
  const s = text.trim();
  if (!s) return { y: null, problem: null };
  const y = parseChartNumber(s, locale);
  if (y !== null) return { y, problem: null };
  const m = /^([-+−]?[\d.,]*\d(?:[eE][-+−]?\d+)?)\s*(\S.*)$/.exec(s);
  if (m) {
    const yUnit = titleUnit(yTitle);
    const xUnit = titleUnit(xTitle);
    const n = parseChartNumber(m[1], locale);
    if (n !== null && yUnit && sameUnit(m[2], yUnit)) return { y: n, problem: null };
    if (n !== null && xUnit && sameUnit(m[2], xUnit)) return { y: null, problem: { xUnit } };
  }
  return { y: null, problem: NUMBER_START.test(s.replace(/\s+/g, "").replace(/−/g, "-")) ? "typing" : "notNumber" };
}

/**
 * How a sample's x is worked out, as the panel shows it under the result: the formula ("x = (y −
 * b) / m") and the same with the numbers put in ("x = (0,5 − 0,0254368) / 0,000946316 = 501,48";
 * null when there is no result, and for polynomials and moving averages, which have no formula). The
 * numbers are rounded so that typing the line into a calculator gives the result shown: 6
 * significant digits, more where 6 aren't enough (the result is worked out again from the rounded
 * numbers to check). A line through the origin only divides ("x = 0,5 / 0,00084876"). An a beyond
 * what a number holds (dates as x) goes in as ln a, and the formula says what ln a is, rounded as
 * in the line.
 */
export function probeSteps(fit: Fit, y: number, x: number | null, locale: Locale): { formula: string; line: string | null } {
  const t = sheetChartText[locale];
  const c = fit.coefficients;
  const origin = fit.type === "linear" && c[0] === 0;
  const formula = (n: (v: number) => string) => {
    if (origin) return t.solveOrigin;
    if ((fit.type === "exponential" || fit.type === "power") && aOutOfRange(fit)) return t.solveViaLn[fit.type](n(lnOfA(fit)));
    return t.solveHow[fit.type];
  };
  if (x === null) return { formula: formula((v) => formatCoefficient(v, locale, 6)), line: null };
  const result = probeResultText(x, locale);
  // 6 significant digits, one more each round, at most 12.
  for (let d = 6; ; d++) {
    const n = (v: number) => formatCoefficient(v, locale, d);
    // What the student types: the shown numbers, not the exact ones.
    const shown = (v: number) => parseChartNumber(n(v), locale) ?? NaN;
    const minus = (a: string, v: number) => (v < 0 ? `${a} + ${n(-v)}` : `${a} − ${n(v)}`);
    const Y = shown(y);
    let line: string;
    let value: number;
    switch (fit.type) {
      case "linear":
        line = origin ? `x = ${n(y)} / ${n(c[1])}` : `x = (${minus(n(y), c[0])}) / ${n(c[1])}`;
        value = (Y - shown(c[0])) / shown(c[1]);
        break;
      case "logarithmic":
        line = `x = e^((${minus(n(y), c[0])}) / ${n(c[1])})`;
        value = Math.exp((Y - shown(c[0])) / shown(c[1]));
        break;
      case "exponential":
      case "power":
        if (aOutOfRange(fit)) {
          // a beyond what a number holds (dates as x): (ln y − ln a) / b, and the formula names ln a.
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
        return { formula: t.solveHow[fit.type], line: null };
    }
    if (d === 12 || probeResultText(value, locale) === result) return { formula: formula(n), line: `${line} = ${result}` };
  }
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
