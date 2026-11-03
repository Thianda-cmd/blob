// Datum und Uhrzeit: HEUTE, JETZT, DATUM, ZEIT, JAHR, MONAT, TAG, STUNDE, MINUTE, SEKUNDE,
// WOCHENTAG, KALENDERWOCHE, ISOKALENDERWOCHE, DATEDIF, TAGE, EDATUM, MONATSENDE, NETTOARBEITSTAGE.

import { daysInMonth, isoWeekNum, MAX_SERIAL, serialFromDate, serialFromYMD, timeOfSerial, weekdayOf, ymdFromSerial } from "../dates";
import { ERR, isErr, isMatrix, isRef, mkErr, type Scalar, type Value } from "../values";
import type { Ctx, FnDef } from "./types";
import { asMatrix, numFn, toNum, toStr } from "./util";

const validSerial = (n: number) => n >= 0 && n <= MAX_SERIAL + 0.99999999;

/** A date argument: a serial number (text like "1.11.2026" works too). */
function dateFn(name: string, min: number, max: number, f: (serials: number[]) => number | ReturnType<typeof mkErr>): FnDef {
  return numFn(name, min, max, (a) => {
    if (!validSerial(a[0])) return ERR.num;
    return f(a);
  });
}

function addMonths(serial: number, months: number, endOfMonth: boolean): number {
  const { y, m, d } = ymdFromSerial(serial);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  const last = daysInMonth(ny, nm);
  return serialFromYMD(ny, nm, endOfMonth ? last : Math.min(d, last));
}

function weekNum(serial: number, type: number): number | null {
  if (type === 21) return isoWeekNum(serial);
  const starts: Record<number, number> = { 1: 0, 17: 0, 2: 1, 11: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6 };
  const start = starts[type];
  if (start === undefined) return null;
  const day = Math.floor(serial);
  const { y } = ymdFromSerial(day);
  const jan1 = serialFromYMD(y, 1, 1);
  const offset = (weekdayOf(jan1) - start + 7) % 7;
  return Math.floor((day - jan1 + offset) / 7) + 1;
}

function datedif(start: number, end: number, unit: string): number | ReturnType<typeof mkErr> {
  const s = Math.floor(start);
  const e = Math.floor(end);
  if (s > e) return ERR.num;
  const a = ymdFromSerial(s);
  const b = ymdFromSerial(e);
  switch (unit.toUpperCase()) {
    case "D":
      return e - s;
    case "M":
      return (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
    case "Y":
      return b.y - a.y - (b.m < a.m || (b.m === a.m && b.d < a.d) ? 1 : 0);
    case "YM":
      return (((b.m - a.m - (b.d < a.d ? 1 : 0)) % 12) + 12) % 12;
    case "MD": {
      if (b.d >= a.d) return b.d - a.d;
      // Days in the month before the end date's month, as Excel counts them.
      const pm = b.m === 1 ? 12 : b.m - 1;
      const py = b.m === 1 ? b.y - 1 : b.y;
      return daysInMonth(py, pm) - a.d + b.d;
    }
    case "YD": {
      let anchor = serialFromYMD(b.y, a.m, Math.min(a.d, daysInMonth(b.y, a.m)));
      if (anchor > e) anchor = serialFromYMD(b.y - 1, a.m, Math.min(a.d, daysInMonth(b.y - 1, a.m)));
      return e - anchor;
    }
  }
  return ERR.num;
}

function holidays(v: Value | undefined, ctx: Ctx): Set<number> | ReturnType<typeof mkErr> {
  const out = new Set<number>();
  if (v === undefined || v === null) return out;
  const m = asMatrix(isRef(v) ? ctx.deref(v) : isMatrix(v) ? v : (v as Scalar));
  for (const row of m) {
    for (const x of row) {
      if (isErr(x)) return x;
      if (x === null) continue;
      const n = toNum(x, ctx);
      if (typeof n !== "number") return n;
      out.add(Math.floor(n));
    }
  }
  return out;
}

export const DATE_FNS: FnDef[] = [
  { name: "TODAY", min: 0, max: 0, args: "s", volatile: true, impl: (_a, ctx) => Math.floor(serialFromDate(ctx.now())) },
  { name: "NOW", min: 0, max: 0, args: "s", volatile: true, impl: (_a, ctx) => serialFromDate(ctx.now()) },
  numFn("DATE", 3, 3, ([y0, m0, d0]) => {
    let y = Math.trunc(y0);
    if (y >= 0 && y < 1900) y += 1900;
    if (y < 0 || y >= 10000) return ERR.num;
    const s = serialFromYMD(y, Math.trunc(m0), Math.trunc(d0));
    if (s < 0 || s > MAX_SERIAL) return ERR.num;
    return s;
  }),
  numFn("TIME", 3, 3, ([h, m, s]) => {
    const total = Math.trunc(h) * 3600 + Math.trunc(m) * 60 + Math.trunc(s);
    if (total < 0) return ERR.num;
    return (total % 86400) / 86400;
  }),
  dateFn("YEAR", 1, 1, ([x]) => ymdFromSerial(x).y),
  dateFn("MONTH", 1, 1, ([x]) => ymdFromSerial(x).m),
  dateFn("DAY", 1, 1, ([x]) => ymdFromSerial(x).d),
  dateFn("HOUR", 1, 1, ([x]) => timeOfSerial(x).h),
  dateFn("MINUTE", 1, 1, ([x]) => timeOfSerial(x).mi),
  dateFn("SECOND", 1, 1, ([x]) => timeOfSerial(x).s),
  dateFn("WEEKDAY", 1, 2, ([x, type]) => {
    const t = type === undefined ? 1 : Math.trunc(type);
    const wd = weekdayOf(x); // 0 = Sunday
    if (t === 1 || t === 17) return wd + 1;
    if (t === 2 || t === 11) return ((wd + 6) % 7) + 1;
    if (t === 3) return (wd + 6) % 7;
    if (t >= 12 && t <= 16) return ((wd - (t - 10) + 7) % 7) + 1;
    return ERR.num;
  }),
  dateFn("WEEKNUM", 1, 2, ([x, type]) => {
    const w = weekNum(x, type === undefined ? 1 : Math.trunc(type));
    return w === null ? ERR.num : w;
  }),
  dateFn("ISOWEEKNUM", 1, 1, ([x]) => isoWeekNum(x)),
  {
    name: "DATEDIF",
    min: 3,
    max: 3,
    args: "s",
    impl: ([a, b, u], ctx) => {
      const s = toNum(a as Scalar, ctx);
      if (typeof s !== "number") return s;
      const e = toNum(b as Scalar, ctx);
      if (typeof e !== "number") return e;
      const unit = toStr(u as Scalar, ctx);
      if (typeof unit !== "string") return unit;
      if (!validSerial(s) || !validSerial(e)) return ERR.num;
      return datedif(s, e, unit);
    },
  },
  numFn("DAYS", 2, 2, ([e, s]) => {
    if (!validSerial(s) || !validSerial(e)) return ERR.num;
    return Math.floor(e) - Math.floor(s);
  }),
  dateFn("EDATE", 2, 2, ([s, m]) => {
    const r = addMonths(s, Math.trunc(m), false);
    return r < 0 || r > MAX_SERIAL ? ERR.num : r;
  }),
  dateFn("EOMONTH", 2, 2, ([s, m]) => {
    const r = addMonths(s, Math.trunc(m), true);
    return r < 0 || r > MAX_SERIAL ? ERR.num : r;
  }),
  {
    name: "NETWORKDAYS",
    min: 2,
    max: 3,
    args: "ssv",
    impl: (args, ctx) => {
      const a = toNum(args[0] as Scalar, ctx);
      if (typeof a !== "number") return a;
      const b = toNum(args[1] as Scalar, ctx);
      if (typeof b !== "number") return b;
      if (!validSerial(a) || !validSerial(b)) return ERR.num;
      const hol = holidays(args[2], ctx);
      if (isErr(hol)) return hol;
      const s = Math.floor(Math.min(a, b));
      const e = Math.floor(Math.max(a, b));
      // Whole weeks have 5 working days; count the rest day by day.
      const days = e - s + 1;
      const weeks = Math.floor(days / 7);
      let count = weeks * 5;
      for (let d = s + weeks * 7; d <= e; d++) {
        const wd = weekdayOf(d);
        if (wd !== 0 && wd !== 6) count++;
      }
      for (const h of hol) {
        if (h < s || h > e) continue;
        const wd = weekdayOf(h);
        if (wd !== 0 && wd !== 6) count--;
      }
      return a <= b ? count : -count;
    },
  },
];
