// Axis scales for charts: "nice" linear ticks (steps of 1, 2 or 5 × 10ⁿ; for times of day and
// durations 15 min, 30 min, 1 h …), logarithmic axes (decades with minor ticks 2…9), and where
// values land on screen.
//
// Automatic ranges follow Excel closely, so a chart looks like the one from class: the axis starts
// at 0 when the data's minimum is less than 5/6 of its maximum, and an automatic end gets a little
// room beyond the data (x from 0 to 10 → axis to 12), so the last point isn't cut by the frame.

import type { Locale } from "@/i18n/config";
import { formatFixed, formatScientific } from "./format";

export type AxisScale = {
  log: boolean;
  /** The axis' ends (for log: positive). */
  min: number;
  max: number;
  /** Major ticks (labelled). */
  ticks: number[];
  /** Minor ticks (log axes: 2…9 of every decade). */
  minor: number[];
  /** Linear: the step between ticks; log: 0. */
  step: number;
  /** Linear: the decimals the step needs ("0,25" → 2); log axes format each tick on its own. */
  decimals: number;
};

const EPS = 1e-9;

/** A power of ten without float noise: 10^-3 → 0.001 (not 0.0010000000000000002). */
export const pow10 = (e: number) => Number(`1e${e}`);

/** Strip float noise from k·step: 3 × 0.1 → 0.3. */
const clean = (v: number) => (v === 0 ? 0 : Number(v.toPrecision(12)));

/** 1, 2 or 5 × 10ⁿ, whichever is closest (on a log scale) to `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const e = Math.floor(Math.log10(raw));
  const f = raw / pow10(e);
  let best = 1;
  let bestD = Infinity;
  for (const c of [1, 2, 5, 10]) {
    const d = Math.abs(Math.log(f / c));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // Divide for negative powers: 2 / 10 is exactly 0.2, 2 × 0.1 isn't always.
  return e < 0 ? best / pow10(-e) : best * pow10(e);
}

/** A second, a minute and an hour in days, the unit of times in cells (0:30 is 0,0208…). */
const SECOND = 1 / 86400;
const MINUTE = 1 / 1440;
const HOUR = 1 / 24;
/** Below a day, a time axis ticks in steps a clock or a lab protocol counts in. */
const TIME_STEPS = [
  ...[1, 5, 10, 15, 30].map((s) => s * SECOND),
  ...[1, 5, 10, 15, 30].map((m) => m * MINUTE),
  ...[1, 2, 3, 4, 6, 12].map((h) => h * HOUR),
  1,
];

/**
 * The step of a time axis (in days) closest to `raw` on a log scale: 1, 5, 10, 15 or 30 seconds
 * or minutes, 1, 2, 3, 4, 6 or 12 hours, then whole days (1, 2, 5, 10 …), so the ticks read
 * 0:00, 0:30, 1:00 … instead of 0:00, 0:28, 0:57 … (niceStep on days).
 */
export function timeStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return HOUR;
  if (raw > 1) return Math.max(1, niceStep(raw));
  let best = 1;
  for (const s of TIME_STEPS) if (Math.abs(Math.log(raw / s)) < Math.abs(Math.log(raw / best))) best = s;
  return best;
}

/** The decimals that tick labels of a step need: 0.25 → 2, 0.5 → 1, 2 → 0. */
export function stepDecimals(step: number): number {
  if (!(step > 0)) return 0;
  // 0.25 is not a 1-2-5 step but fixed bounds can produce it; find the decimals that show it exactly.
  for (let d = 0; d <= 12; d++) if (Math.abs(Math.round(step * pow10(d)) - step * pow10(d)) < 1e-6 * step * pow10(d)) return d;
  return Math.max(0, -Math.floor(Math.log10(step)));
}

export type LinearAxisOptions = {
  /** Fixed ends set by the user (null: automatic). */
  min: number | null;
  max: number | null;
  /** About how many ticks fit (depends on the axis' length on screen). */
  target: number;
  /** "always": the axis includes 0 (columns, bars, areas). "excel": Excel's 5/6 rule. "never". */
  zero: "always" | "excel" | "never";
  /** Room beyond the data at automatic ends (Excel's +5 %). */
  pad?: boolean;
  /** The smallest step between ticks: 1 on an axis of dates without times (at half days each date would show twice). */
  minStep?: number;
  /** Times of day or durations (values in days): steps of whole minutes, hours … (timeStep). */
  time?: boolean;
};

/** A linear axis for data from dataMin to dataMax (both NaN or Infinity when there is no data). */
export function linearAxis(dataMin: number, dataMax: number, opts: LinearAxisOptions): AxisScale {
  let lo = Number.isFinite(dataMin) ? dataMin : 0;
  let hi = Number.isFinite(dataMax) ? dataMax : 1;
  if (lo > hi) [lo, hi] = [hi, lo];
  const userMin = opts.min !== null && Number.isFinite(opts.min) ? opts.min : null;
  const userMax = opts.max !== null && Number.isFinite(opts.max) ? opts.max : null;
  const fixedRange = userMin !== null && userMax !== null && userMin < userMax;
  const autoMin = userMin === null || (userMax !== null && !fixedRange);
  const autoMax = userMax === null || (userMin !== null && !fixedRange);
  if (!autoMin) lo = userMin!;
  if (!autoMax) hi = userMax!;
  if (!autoMin && autoMax && hi <= lo) hi = lo + Math.max(1, Math.abs(lo));
  if (!autoMax && autoMin && lo >= hi) lo = hi - Math.max(1, Math.abs(hi));

  let snappedMin = false;
  let snappedMax = false;
  if (lo === hi) {
    // One value (or all the same): show it with 0, like Excel.
    if (lo > 0) {
      if (autoMin) [lo, snappedMin] = [0, true];
      else hi = lo * 2;
    } else if (lo < 0) {
      if (autoMax) [hi, snappedMax] = [0, true];
      else lo = hi * 2;
    } else {
      hi = autoMax ? 1 : hi;
      lo = autoMin ? 0 : lo;
      if (hi <= lo) hi = lo + 1;
    }
  } else if (opts.zero === "always") {
    if (autoMin && lo > 0) [lo, snappedMin] = [0, true];
    if (autoMax && hi < 0) [hi, snappedMax] = [0, true];
  } else if (opts.zero === "excel") {
    // Excel: when the minimum is under 5/6 of the maximum the axis starts at 0 (and mirrored for
    // negative data), so a calibration starting at 0,002 starts at 0.
    if (autoMin && lo > 0 && lo < (5 / 6) * hi) [lo, snappedMin] = [0, true];
    if (autoMax && hi < 0 && hi > (5 / 6) * lo) [hi, snappedMax] = [0, true];
  }
  if (lo === 0) snappedMin = true;
  if (hi === 0) snappedMax = true;

  const target = Math.max(2, Math.min(12, opts.target));
  const span = hi - lo;
  const step = Math.max(opts.minStep ?? 0, (opts.time ? timeStep : niceStep)(span / target));
  let min = lo;
  let max = hi;
  if (autoMin) {
    const padded = opts.pad && !snappedMin ? lo - 0.05 * span : lo;
    // Room below the data never crosses 0 (x from 0,5 to 10 starts at 0, not at -2).
    const p = lo >= 0 && padded < 0 ? 0 : padded;
    min = clean(Math.floor(p / step + EPS) * step);
  }
  if (autoMax) {
    const padded = opts.pad && !snappedMax ? hi + 0.05 * span : hi;
    const p = hi <= 0 && padded > 0 ? 0 : padded;
    max = clean(Math.ceil(p / step - EPS) * step);
  }
  if (max <= min) max = clean(min + step);
  const ticks: number[] = [];
  const k0 = Math.ceil(min / step - EPS);
  const k1 = Math.floor(max / step + EPS);
  for (let k = k0; k <= k1 && ticks.length < 200; k++) ticks.push(clean(k * step));
  return { log: false, min, max, ticks, minor: [], step, decimals: stepDecimals(step) };
}

/** A logarithmic (base 10) axis for positive data; whole decades unless the user fixed the ends. */
export function logAxis(dataMin: number, dataMax: number, opts: { min: number | null; max: number | null }): AxisScale {
  let lo = dataMin > 0 && Number.isFinite(dataMin) ? dataMin : 1;
  let hi = dataMax > 0 && Number.isFinite(dataMax) ? dataMax : 10;
  if (lo > hi) [lo, hi] = [hi, lo];
  let min = opts.min !== null && opts.min > 0 ? opts.min : pow10(Math.floor(Math.log10(lo) + EPS));
  let max = opts.max !== null && opts.max > 0 ? opts.max : pow10(Math.ceil(Math.log10(hi) - EPS));
  if (max <= min) {
    if (opts.max !== null && opts.max > 0) min = pow10(Math.floor(Math.log10(max) - EPS) - 1);
    else max = pow10(Math.floor(Math.log10(min) + EPS) + 1);
  }
  const e0 = Math.ceil(Math.log10(min) - EPS);
  const e1 = Math.floor(Math.log10(max) + EPS);
  const decades = Math.max(0, e1 - e0);
  // Many decades: label every second (or third…) one so the labels don't collide.
  const stride = Math.max(1, Math.ceil((decades + 1) / 9));
  const ticks: number[] = [];
  for (let e = e0; e <= e1; e += stride) ticks.push(pow10(e));
  // One decade or less: 2 and 5 get labels too (10, 20, 50, 100), else the axis says little.
  if (decades <= 1) {
    for (let e = Math.floor(Math.log10(min) + EPS); e <= e1; e++) {
      for (const m of [2, 5]) {
        const v = clean(m * pow10(e));
        if (v >= min * (1 - EPS) && v <= max * (1 + EPS)) ticks.push(v);
      }
    }
    ticks.sort((a, b) => a - b);
  }
  const minor: number[] = [];
  if (decades <= 8) {
    for (let e = Math.floor(Math.log10(min) + EPS); e <= e1; e++) {
      for (let m = 2; m <= 9; m++) {
        const v = clean(m * pow10(e));
        if (v > min * (1 + EPS) && v < max * (1 - EPS) && !ticks.includes(v)) minor.push(v);
      }
    }
    // A stride > 1 leaves decades unlabelled: they still get a tick.
    if (stride > 1) for (let e = e0; e <= e1; e++) if ((e - e0) % stride) minor.push(pow10(e));
  }
  return { log: true, min, max, ticks, minor, step: 0, decimals: 0 };
}

/** Where v lands on the axis: 0 at min, 1 at max (NaN for v ≤ 0 on a log axis). */
export function axisFraction(scale: AxisScale, v: number): number {
  if (scale.log) {
    if (!(v > 0)) return NaN;
    const a = Math.log10(scale.min);
    const b = Math.log10(scale.max);
    return (Math.log10(v) - a) / (b - a);
  }
  return (v - scale.min) / (scale.max - scale.min);
}

/** The value at a fraction of the axis (inverse of axisFraction). */
export function axisValue(scale: AxisScale, f: number): number {
  if (scale.log) {
    const a = Math.log10(scale.min);
    const b = Math.log10(scale.max);
    return 10 ** (a + f * (b - a));
  }
  return scale.min + f * (scale.max - scale.min);
}

/** Ticks of a log axis are written out (0,00001 … 100000) inside this range, else as 1E-06, 1E+06. */
const needsScientific = (v: number) => v > 0 && (Math.log10(v) < -5 - EPS || Math.log10(v) >= 6 - EPS);

/**
 * Whether a log axis writes all its ticks in scientific notation: as soon as one of them needs it,
 * so an axis reads 1E-07 … 1E-03 or 1E+03 … 1E+07, never 1E-06 next to 0,00001.
 */
export const logTicksScientific = (ticks: number[]) => ticks.some(needsScientific);

/**
 * A tick label of a log axis: 0,01 / 0,1 / 1 / 10 … 100000, beyond that 1E+06; with `scientific`
 * (see logTicksScientific) every tick like 1E+03.
 */
export function logTickLabel(v: number, locale: Locale, scientific = false): string {
  const e = Math.round(Math.log10(v));
  const decade = Math.abs(v - pow10(e)) <= 1e-9 * v;
  if (scientific || needsScientific(v)) return decade ? `1E${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}` : formatScientific(v, locale, 4);
  // Not a decade (2, 5 or a fixed end): enough decimals to show it.
  if (!decade) {
    const dec = Math.max(0, Math.min(10, 2 - Math.floor(Math.log10(v))));
    return formatFixed(v, dec, locale).replace(/([.,]\d*?)0+$/, "$1").replace(/[.,]$/, "");
  }
  return formatFixed(v, Math.max(0, -e), locale);
}
