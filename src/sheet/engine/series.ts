// Continuing a series with the fill handle, like Excel: 1, 2 → 3, 4; 0,5; 1 → 1,5; dates by day
// (or by month / year when that is the step); "Probe 1" → "Probe 2"; Montag → Dienstag,
// Jan → Feb (German and English, full names and abbreviations). Filling up or left runs backwards.

import type { Cell } from "../types";
import { daysInMonth, serialFromYMD, ymdFromSerial } from "./dates";
import { shiftFormula } from "./refs";

/** Lists that continue (Monday first, like Excel's custom lists). */
const LISTS: string[][] = [
  ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
  ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
];

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Keep the case style of the original: MONTAG → DIENSTAG, montag → dienstag. */
function likeCase(word: string, model: string): string {
  if (model === model.toUpperCase() && model !== model.toLowerCase()) return word.toUpperCase();
  if (model === model.toLowerCase()) return word.toLowerCase();
  return word;
}

/** The list and positions of the texts, when they all belong to one list. */
function listOf(texts: string[]): { list: string[]; idx: number[] } | null {
  for (const list of LISTS) {
    const lower = list.map((x) => x.toLowerCase());
    const idx = texts.map((t) => lower.indexOf(t.trim().replace(/\.$/, "").toLowerCase()));
    if (idx.every((i) => i >= 0)) return { list, idx };
  }
  return null;
}

/** "Probe 01" → prefix "Probe ", number 1 (2 digits), suffix "". A number at the end, else at the start. */
function textNumber(s: string): { prefix: string; n: number; width: number; suffix: string } | null {
  let m = /^(.*?)(\d+)$/.exec(s);
  if (m && m[1] !== "") return { prefix: m[1], n: Number(m[2]), width: m[2].length, suffix: "" };
  m = /^(\d+)(\D.*)$/.exec(s);
  if (m) return { prefix: "", n: Number(m[1]), width: m[1].length, suffix: m[2] };
  return null;
}

const clean15 = (x: number) => (Number.isFinite(x) && x !== 0 ? Number(x.toPrecision(15)) : x);

/** Least-squares line through (0, y0), (1, y1)…: Excel's fill trend. */
function trend(ys: number[]): { a: number; b: number } {
  const n = ys.length;
  if (n === 1) return { a: ys[0], b: 0 };
  const mx = (n - 1) / 2;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  ys.forEach((y, i) => {
    sxy += (i - mx) * (y - my);
    sxx += (i - mx) * (i - mx);
  });
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

const isDateFmt = (c: Cell) => c.s?.fmt?.kind === "date" || c.s?.fmt?.kind === "datetime";
const isTimeFmt = (c: Cell) => c.s?.fmt?.kind === "time";

/** Month-wise date series (same day each month, or always the month's last day), or null. */
function monthSeries(serials: number[]): ((k: number) => number) | null {
  if (serials.some((s) => s !== Math.floor(s))) return null;
  const ymd = serials.map((s) => ymdFromSerial(s));
  const months = ymd.map((d) => d.y * 12 + (d.m - 1));
  const step = months[1] - months[0];
  if (step === 0) return null;
  for (let i = 2; i < months.length; i++) if (months[i] - months[i - 1] !== step) return null;
  const sameDay = ymd.every((d) => d.d === ymd[0].d);
  const lastDays = ymd.every((d) => d.d === daysInMonth(d.y, d.m));
  if (!sameDay && !lastDays) return null;
  const day = ymd[0].d;
  return (k) => {
    const total = months[0] + step * k;
    const y = Math.floor(total / 12);
    const m = total - y * 12 + 1;
    const last = daysInMonth(y, m);
    return serialFromYMD(y, m, lastDays && !sameDay ? last : Math.min(day, last));
  };
}

/**
 * The cells of one line of the fill handle's source (in fill order) → a generator for position k
 * (k < 0 runs backwards, 0…n−1 are the sources). Formulas shift by the distance moved; `step`
 * converts a position difference into rows and columns.
 */
export function seriesOf(src: (Cell | undefined)[], step: { rows: number; cols: number }): (k: number) => Cell | null {
  const n = src.length;
  const filled = src.filter((c): c is Cell => !!c && (c.v !== undefined || c.f !== undefined));
  const styleAt = (k: number) => src[mod(k, n)]?.s;
  const withStyle = (k: number, cell: Cell): Cell => {
    const s = styleAt(k);
    return s ? { ...cell, s } : cell;
  };

  // All numbers (no formulas, nothing empty): a numeric series.
  if (filled.length === n && n >= 1 && src.every((c) => c && c.f === undefined && typeof c.v === "number")) {
    const cells = src as Cell[];
    const ys = cells.map((c) => c.v as number);
    const allDates = cells.every(isDateFmt);
    const allTimes = cells.every(isTimeFmt);
    if (n === 1) {
      if (allDates) return (k) => withStyle(k, { v: ys[0] + k });
      if (allTimes) return (k) => withStyle(k, { v: clean15(ys[0] + k / 24) });
      return (k) => withStyle(k, { v: ys[0] });
    }
    if (allDates) {
      const months = monthSeries(ys);
      if (months) return (k) => withStyle(k, { v: months(k) });
    }
    const { a, b } = trend(ys);
    return (k) => withStyle(k, { v: k >= 0 && k < n ? ys[k] : clean15(a + b * k) });
  }

  // All text of one list (weekdays, months).
  if (filled.length === n && src.every((c) => c && c.f === undefined && typeof c.v === "string")) {
    const texts = (src as Cell[]).map((c) => c.v as string);
    const list = listOf(texts);
    if (list) {
      const L = list.list.length;
      const stepI = n === 1 ? 1 : mod(list.idx[1] - list.idx[0], L) || L;
      const consistent = list.idx.every((v, i) => i === 0 || mod(v - list.idx[i - 1], L) === mod(stepI, L));
      if (consistent) {
        return (k) => {
          if (k >= 0 && k < n) return withStyle(k, { v: texts[k] });
          return withStyle(k, { v: likeCase(list.list[mod(list.idx[0] + stepI * k, L)], texts[0]) });
        };
      }
    }
    // Text with a number, all the same pattern: the numbers continue.
    const parts = texts.map(textNumber);
    if (parts.every((p) => p) && parts.every((p) => p!.prefix === parts[0]!.prefix && p!.suffix === parts[0]!.suffix)) {
      const nums = parts.map((p) => p!.n);
      const { a, b } = n === 1 ? { a: nums[0], b: 1 } : trend(nums);
      const width = parts[0]!.width;
      return (k) => {
        if (k >= 0 && k < n) return withStyle(k, { v: texts[k] });
        const v = Math.abs(Math.round(a + b * k));
        return withStyle(k, { v: `${parts[0]!.prefix}${String(v).padStart(width, "0")}${parts[0]!.suffix}` });
      };
    }
  }

  // Anything else repeats position by position: formulas move along, a text with a number counts up
  // once per round, a weekday or month name steps to the next one.
  return (k) => {
    const i = mod(k, n);
    const c = src[i];
    if (!c) return null;
    const round = (k - i) / n;
    if (c.f !== undefined) return { ...c, f: shiftFormula(c.f, (k - i) * step.rows, (k - i) * step.cols) };
    if (typeof c.v === "string" && round !== 0) {
      const one = listOf([c.v]);
      if (one) return { ...c, v: likeCase(one.list[mod(one.idx[0] + round, one.list.length)], c.v) };
      const p = textNumber(c.v);
      if (p) return { ...c, v: `${p.prefix}${String(Math.abs(p.n + round)).padStart(p.width, "0")}${p.suffix}` };
    }
    if (typeof c.v === "number" && n === 1 && isDateFmt(c)) return { ...c, v: c.v + k };
    return c;
  };
}
