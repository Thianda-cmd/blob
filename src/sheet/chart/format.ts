// Numbers in charts: trendline equations (with enough significant digits to calculate with) and
// R² the way Excel labels them, tick labels, data labels and tooltips. Plain functions without the
// formula engine, so the regression, the chart and their tests work on their own.

import type { Locale } from "@/i18n/config";
import type { NumberFormat } from "../types";

/** "1.5" → "1,5" in German. Works on plain JS number strings (no grouping, no exponent letters). */
const localize = (s: string, locale: Locale) => (locale === "de" ? s.replace(".", ",") : s);

/** "1.2500" → "1.25", "3.000" → "3". */
function trimZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

/** "1.5e-7" → "1.5E-07" (Excel writes the exponent with a sign and at least two digits). */
function excelExponent(s: string): string {
  const [m, e] = s.split("e");
  const exp = Number(e);
  return `${m}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
}

/**
 * Excel's "General" format squeezed into `width` characters (without the sign): as many decimals
 * as fit, trailing zeros dropped, and scientific notation when the first digit would fall past
 * the last decimal or the number has too many digits: 0.052345 → "0,0523", 0.00051 → "0,0005",
 * 7.85714 → "7,8571", 13.4592 → "13,459", 124.113 → "124,11", 25012.3 → "25012",
 * 0.00006 → "6E-05", 0.000098 → "1E-04", 1234567 → "1E+06". Values without a number format in
 * tooltips and data labels use it, roomy. (Excel's trendline labels use the narrow one, which is
 * too coarse to calculate with; Blob's equations use formatCoefficient.)
 */
export function formatGeneral(v: number, locale: Locale, width = 6): string {
  if (Number.isNaN(v)) return locale === "de" ? "#NV" : "#N/A";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  if (v === 0) return "0";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const fixed = fixedInWidth(a, width);
  if (fixed !== null) return sign + localize(fixed, locale);
  return sign + localize(scientificInWidth(a, width), locale);
}

/**
 * a.toFixed(dec), rounded like Excel: half up on the decimal digits you see (0.00015 → "0.0002"),
 * not on the binary value (JS gives "0.0001" because 0.00015 is stored as 0.000149999…).
 */
export function toFixedDecimal(a: number, dec: number): string {
  if (!(Math.abs(a) < 1e15) || dec > 15) return a.toFixed(dec);
  const f = 10 ** dec;
  const scaled = Number((Math.abs(a) * f).toPrecision(15));
  const r = Math.round(scaled) / f;
  return (a < 0 && r !== 0 ? -r : r).toFixed(dec);
}

function fixedInWidth(a: number, width: number): string | null {
  if (a >= 1e21) return null;
  const intDigits = a < 1 ? 1 : Math.floor(a).toString().length;
  if (intDigits > width) return null;
  // Below 1: the decimals left after "0," must reach the first digit, else scientific.
  if (a < 1 && Math.floor(Math.log10(a) + 1e-12) < -(width - 2)) return null;
  for (let dec = Math.max(0, width - intDigits - 1); dec >= 0; dec--) {
    const s = toFixedDecimal(a, dec);
    // Rounding can add a digit (9.99996 → "10.0000"): try one decimal fewer.
    if (s.length > width) continue;
    const t = trimZeros(s);
    return Number(t) === 0 ? null : t;
  }
  return null;
}

function scientificInWidth(a: number, width: number): string {
  for (let dec = Math.max(0, width - 6); dec >= 0; dec--) {
    const s = excelExponent(a.toExponential(dec));
    if (s.length <= width || dec === 0) {
      const [m, e] = s.split("E");
      return `${trimZeros(m)}E${e}`;
    }
  }
  return excelExponent(a.toExponential(0));
}

/** A positive number in scientific notation with `d` significant digits, trailing zeros dropped: "1,2346E-05". */
function scientificText(a: number, d: number, locale: Locale): string {
  const [m, e] = excelExponent(a.toExponential(d - 1)).split("E");
  return localize(`${trimZeros(m)}E${e}`, locale);
}

/** `digits` significant digits; scientific below 0,0001 and above 10^maxFixedExp. */
function significant(v: number, locale: Locale, digits: number, maxFixedExp: number): string {
  if (Number.isNaN(v)) return locale === "de" ? "#NV" : "#N/A";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  if (v === 0) return "0";
  const d = Math.max(1, Math.min(15, Math.round(digits)));
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const exp = Number(a.toExponential(d - 1).split("e")[1]);
  if (exp < -4 || exp > maxFixedExp) return sign + scientificText(a, d, locale);
  const s = trimZeros(toFixedDecimal(a, Math.max(0, d - 1 - exp)));
  return s === "0" ? "0" : sign + localize(s, locale);
}

/**
 * A number with `digits` significant digits, trailing zeros dropped (axis settings, cell values
 * in the panel): 0.0523456 → "0,052346" (5), 1234.5678 → "1234,6" (5). Very small or large
 * numbers in scientific notation (1,2346E-05).
 */
export function formatSignificant(v: number, locale: Locale, digits: number): string {
  return significant(v, locale, digits, 9);
}

/**
 * Significant digits every coefficient of a trendline equation keeps: on the chart, in its aria
 * label, in the panel and on the clipboard, and (as one format for the whole label) in an .xlsx
 * export. Four are enough to work a sample's concentration back by hand to about 0,05 %.
 */
export const EQUATION_DIGITS = 4;

/**
 * A coefficient of a trendline equation, and the numbers worked out with it ("Probe berechnen"):
 * `digits` significant digits with trailing zeros dropped, the whole-number part never rounded
 * away, scientific below 0,0001 and from 10 million on. 0.000946289 → "0,0009463",
 * 0.0518714 → "0,05187", 25012.3 → "25012", 9.43396e-10 → "9,434E-10", 518333626 → "5,183E+08".
 * Excel's narrow "General" label keeps 1 significant digit of such numbers (0,0009 or 9E-10), and
 * a student who works back from that gets concentrations 5 % off.
 */
export function formatCoefficient(v: number, locale: Locale, digits = EQUATION_DIGITS): string {
  return significant(v, locale, digits, 6);
}

/**
 * A positive number given by its natural logarithm, with `digits` significant digits, also where
 * the number is beyond what a JS number holds: exponential and power trendlines with dates as x
 * (46 000 days) have an a like e^(−28412) = 1,234E-12339, which is 0 as a number.
 */
export function formatFromLn(lnV: number, locale: Locale, digits = EQUATION_DIGITS): string {
  if (Number.isNaN(lnV)) return locale === "de" ? "#NV" : "#N/A";
  const direct = Math.exp(lnV);
  if (direct >= 1e-300 && direct <= 1e300) return formatCoefficient(direct, locale, digits);
  if (!Number.isFinite(lnV)) return lnV > 0 ? "∞" : "0";
  const d = Math.max(1, Math.min(15, Math.round(digits)));
  const log10 = lnV / Math.LN10;
  let e = Math.floor(log10);
  let m = (10 ** (log10 - e)).toFixed(d - 1);
  // 9,99996 rounds up to 10,000: one more power of ten instead.
  if (Number(m) >= 10) {
    e += 1;
    m = (Number(m) / 10).toFixed(d - 1);
  }
  return localize(`${trimZeros(m)}E${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`, locale);
}

/** Scientific notation with `digits` significant digits, trailing zeros dropped: 1500000 → "1,5E+06". */
export function formatScientific(v: number, locale: Locale, digits: number): string {
  if (Number.isNaN(v)) return locale === "de" ? "#NV" : "#N/A";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  if (v === 0) return "0";
  return (v < 0 ? "-" : "") + scientificText(Math.abs(v), Math.max(1, Math.min(15, Math.round(digits))), locale);
}

/** Dates, times and both: the kinds of format whose numbers are serial dates. */
export const isDateFormat = (fmt: NumberFormat | null | undefined) => fmt?.kind === "date" || fmt?.kind === "datetime" || fmt?.kind === "time";

/**
 * Calendar dates, with or without the time of day: numbers that count days since 1900. A time
 * alone (0:00, 0:30, 1:00 …) is often already the time since the start of a measurement.
 */
export const isCalendarFormat = (fmt: NumberFormat | null | undefined) => fmt?.kind === "date" || fmt?.kind === "datetime";

/** R² counts as exactly 1 within this distance: a perfect line's 1 − SSE/SST lands a few ulps off. */
export const R2_ONE_TOLERANCE = 5e-13;

/**
 * The decimals R² needs so that a value below 1 doesn't round up to 1: `min` normally, more for
 * 0,99997 (5) or 0,999996 (6), at most `max`. A value that is 1 up to rounding noise needs `min`.
 */
export function r2Decimals(r2: number, min = 4, max = 6): number {
  if (!(r2 < 1 - R2_ONE_TOLERANCE)) return min;
  for (let d = min; d < max; d++) if (Number(toFixedDecimal(r2, d)) < 1) return d;
  return max;
}

/**
 * R² as the chart label, the chart panel and notes show it. Excel's label rounds 0,99997 to
 * "R² = 1", but students judge a calibration line by R² ≥ 0,999, so "1" appears only when R² is 1
 * up to rounding noise. Otherwise `min` decimals with trailing zeros dropped like Excel's label
 * ("0,9987", "0,6"), more when those would round up to 1 ("0,99997", "0,999996"), and when even
 * `max` decimals would, the last one is cut instead of rounded ("0,999999"): never a false 1.
 */
export function formatR2(r2: number, locale: Locale, min = 4, max = 6): string {
  if (Number.isNaN(r2)) return locale === "de" ? "#NV" : "#N/A";
  if (!Number.isFinite(r2)) return r2 > 0 ? "∞" : "-∞";
  if (Math.abs(r2 - 1) <= R2_ONE_TOLERANCE) return "1";
  const d = r2Decimals(r2, min, max);
  let s = toFixedDecimal(r2, d);
  if (r2 < 1 && Number(s) >= 1) s = (Math.floor(r2 * 10 ** d) / 10 ** d).toFixed(d);
  return localize(trimZeros(s), locale);
}

/** Thousands with "." (German) or "," (English) in the integer part of a plain number string. */
function group(s: string, locale: Locale): string {
  const [int, frac] = s.split(".");
  const sep = locale === "de" ? "." : ",";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return frac === undefined ? grouped : `${grouped}${locale === "de" ? "," : "."}${frac}`;
}

/** A number with fixed decimals: 0.3 → "0,30" (2). No "-0". */
export function formatFixed(v: number, decimals: number, locale: Locale, grouping = false): string {
  if (Number.isNaN(v)) return locale === "de" ? "#NV" : "#N/A";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "-∞";
  const d = Math.max(0, Math.min(20, Math.round(decimals)));
  let s = Math.abs(v) >= 1e21 ? Math.abs(v).toExponential(4) : toFixedDecimal(Math.abs(v), d);
  if (Number(s) === 0) return grouping ? group(s, locale) : localize(s, locale);
  if (s.includes("e")) return (v < 0 ? "-" : "") + localize(excelExponent(s), locale);
  s = grouping ? group(s, locale) : localize(s, locale);
  return (v < 0 ? "-" : "") + s;
}

/** The decimals a format shows (number, percent, scientific, currency); null for the others. */
export function formatDecimals(fmt: NumberFormat | null | undefined): number | null {
  if (!fmt) return null;
  switch (fmt.kind) {
    case "number":
    case "percent":
    case "scientific":
    case "currency":
      return fmt.decimals;
    default:
      return null;
  }
}

/**
 * A value as a chart shows it next to a point or in a tooltip, following the cells' format where
 * it is a plain number kind (number, percent, scientific, currency, significant), else Excel's
 * General in a roomy width. `unit` adds a number format's unit ("0,105 mg/L").
 */
export function formatChartNumber(v: number, fmt: NumberFormat | null | undefined, locale: Locale, opts: { decimals?: number | null; unit?: boolean } = {}): string {
  const dec = opts.decimals ?? null;
  switch (fmt?.kind) {
    case "percent":
      return `${formatFixed(v * 100, dec !== null ? Math.max(0, dec - 2) : fmt.decimals, locale)}%`;
    case "scientific": {
      const d = dec ?? fmt.decimals;
      const s = v === 0 ? formatFixed(0, d, locale) : localize(excelExponent(Math.abs(v).toExponential(Math.max(0, Math.min(20, d)))), locale);
      const signed = v < 0 && v !== 0 ? `-${s}` : s;
      return opts.unit && fmt.unit ? `${signed} ${fmt.unit}` : signed;
    }
    case "currency": {
      const s = formatFixed(v, dec ?? fmt.decimals, locale, true);
      if (fmt.symbol === "€" || fmt.symbol === "CHF") return `${s} ${fmt.symbol}`;
      return v < 0 ? `-${fmt.symbol}${s.slice(1)}` : `${fmt.symbol}${s}`;
    }
    case "number": {
      const s = formatFixed(v, dec ?? fmt.decimals, locale, !!fmt.group);
      return opts.unit && fmt.unit ? `${s} ${fmt.unit}` : s;
    }
    case "significant": {
      const s = dec !== null ? formatFixed(v, dec, locale) : formatSignificant(v, locale, fmt.digits);
      return opts.unit && fmt.unit ? `${s} ${fmt.unit}` : s;
    }
    default:
      return dec !== null ? formatFixed(v, dec, locale) : formatGeneral(v, locale, 10);
  }
}

/** Parse a number typed in a chart setting: "0,5", "0.5", "-1,2E-3", "1.234,5" (German), " 12 ". null when it isn't one. */
export function parseChartNumber(text: string, locale: Locale): number | null {
  let s = text.trim().replace(/\s+/g, "").replace(/−/g, "-");
  if (!s) return null;
  if (locale === "de") {
    // "1.234,5" → thousands dots go; a lone comma is the decimal point; "1.5" is still 1.5.
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
