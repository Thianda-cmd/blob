import { addDays, addMonths, addYears, startOfDay } from "date-fns";
import type { CalEvent, Recurrence } from "@/lib/types";
import { allDayIso, dateFromAllDay, eventSpan, fromYmd, weekStart } from "./time";

// Repeating events, worked out in local wall-clock time (a lesson at 8:00 stays at 8:00 after the
// clocks change). Months without the start's day (the 31st, 29 February) are skipped, as in
// iCalendar. A series' changed occurrences are their own rows (series_id + series_start); its
// removed ones are listed in `exdates`. Both are matched by the occurrence's original start.

export type Occurrence = {
  /** The series row (or the plain event). */
  event: CalEvent;
  start: Date;
  end: Date;
  /** Original start of this occurrence as stored (what exdates and overrides refer to). */
  original: string;
  /** Position in the series (0 = first). */
  index: number;
};

/** Safety limit for walking a series. */
const MAX_STEPS = 20000;

export const intervalOf = (r: Recurrence) => Math.min(99, Math.max(1, Math.floor(r.interval ?? 1)));

/** The weekdays a weekly series falls on (sorted), defaulting to the start's weekday. */
export function weekdaysOf(r: Recurrence, start: Date): number[] {
  const days = (r.byDay ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length ? [...new Set(days)].sort((a, b) => a - b) : [start.getDay()];
}

/** The same wall-clock time of day as `like`, on `day`. */
function sameTime(day: Date, like: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), like.getHours(), like.getMinutes(), like.getSeconds());
}

/** Stored form of an occurrence's start (UTC midnight for all-day events). */
function stored(allDay: boolean, d: Date) {
  return allDay ? allDayIso(d) : d.toISOString();
}

/**
 * Every start of the series in order, from its first, until `stopAt` (exclusive) or its end.
 * `visit` returns false to stop early.
 */
function walk(event: CalEvent, stopAt: Date, visit: (start: Date, index: number) => boolean | void) {
  const r = event.recurrence;
  const { start } = eventSpan(event);
  if (!r) {
    visit(start, 0);
    return;
  }
  const interval = intervalOf(r);
  const until = fromYmd(r.until ?? null);
  const untilEnd = until ? addDays(until, 1) : null;
  const count = r.count && r.count > 0 ? Math.min(r.count, 5000) : Infinity;
  let index = 0;
  const ok = (d: Date) => d >= start && (!untilEnd || d < untilEnd) && d < stopAt && index < count;
  const ended = (d: Date) => (untilEnd && d >= untilEnd) || d >= stopAt || index >= count;

  if (r.freq === "weekly") {
    // In week order (Monday first), so Sunday comes after Saturday.
    const days = [...weekdaysOf(r, start)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    // Weeks counted from the week of the start (weeks begin on Monday, as in iCalendar).
    let week = weekStart(start, 1);
    for (let step = 0; step < MAX_STEPS; step++) {
      for (const wd of days) {
        const day = addDays(week, (wd - 1 + 7) % 7);
        const at = sameTime(day, start);
        if (at < start) continue;
        if (ended(at)) return;
        if (ok(at)) {
          if (visit(at, index) === false) return;
          index++;
        }
      }
      week = addDays(week, 7 * interval);
    }
    return;
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    let at: Date | null;
    if (r.freq === "daily") at = sameTime(addDays(startOfDay(start), step * interval), start);
    else if (r.freq === "monthly") {
      const m = addMonths(new Date(start.getFullYear(), start.getMonth(), 1), step * interval);
      at = new Date(m.getFullYear(), m.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds());
      if (at.getMonth() !== m.getMonth()) at = null; // no such day this month
    } else {
      const y = addYears(new Date(start.getFullYear(), 0, 1), step * interval).getFullYear();
      at = new Date(y, start.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds());
      if (at.getMonth() !== start.getMonth()) at = null; // 29 February in a common year
    }
    if (!at) continue;
    if (ended(at)) return;
    if (ok(at)) {
      if (visit(at, index) === false) return;
      index++;
    }
  }
}

/**
 * The occurrences of `event` that overlap [from, to). Removed ones (exdates) and ones replaced by
 * a changed copy (`overridden`: their original starts, in milliseconds) are left out.
 */
export function occurrences(event: CalEvent, from: Date, to: Date, overridden: Set<number> = new Set()): Occurrence[] {
  const { start, end } = eventSpan(event);
  const length = end.getTime() - start.getTime();
  const lengthDays = event.all_day ? Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 864e5)) : 0;
  const skip = new Set((event.exdates ?? []).map((x) => new Date(x).getTime()));
  const out: Occurrence[] = [];
  // Occurrences starting a little before `from` can still reach into it.
  const reach = event.all_day ? lengthDays * 864e5 : length;
  walk(event, to, (at, index) => {
    const stop = event.all_day ? addDays(at, lengthDays) : new Date(at.getTime() + length);
    if (stop.getTime() <= from.getTime() || at.getTime() + reach <= from.getTime()) return;
    const original = stored(event.all_day, at);
    const ms = new Date(original).getTime();
    if (skip.has(ms) || overridden.has(ms)) return;
    out.push({ event, start: at, end: stop, original, index });
  });
  return out;
}

/** The original start of the occurrence of `event` that happens on `day` (for "this event only"), if any. */
export function occurrenceOn(event: CalEvent, day: Date): Occurrence | null {
  const s = startOfDay(day);
  return occurrences(event, s, addDays(s, 1)).find((o) => startOfDay(o.start).getTime() === s.getTime()) ?? null;
}

/** How many times the series happens before `at` (for splitting a series with a count). */
export function countBefore(event: CalEvent, at: Date): number {
  let n = 0;
  walk(event, at, () => {
    n++;
  });
  return n;
}

/** The yyyy-mm-dd of the day before `d` (a series' `until` when it is cut at `d`). */
export function untilBefore(d: Date): string {
  const prev = addDays(startOfDay(d), -1);
  const m = prev.getMonth() + 1;
  return `${prev.getFullYear()}-${String(m).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
}

/** Whether the series still happens at all after cutting it at `d` (else the cut deletes it). */
export function hasOccurrenceBefore(event: CalEvent, d: Date): boolean {
  let any = false;
  walk(event, d, () => {
    any = true;
    return false;
  });
  return any;
}

/** An all-day event's first day (local). */
export const allDayStart = (e: CalEvent) => dateFromAllDay(e.starts_at);
