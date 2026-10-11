import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

// Time helpers for the calendar. Everything on screen is in local time. All-day events are stored
// as UTC midnights that stand for dates, so they read back as the same days in any time zone.

export const MINUTES_PER_DAY = 1440;

/** Local midnight of the date an all-day timestamp stands for. */
export function dateFromAllDay(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** The all-day timestamp for a local date (UTC midnight of that date). */
export function allDayIso(day: Date): string {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString();
}

/** Start and (exclusive) end of an event as local times. */
export function eventSpan(e: { all_day: boolean; starts_at: string; ends_at: string }): { start: Date; end: Date } {
  if (e.all_day) return { start: dateFromAllDay(e.starts_at), end: dateFromAllDay(e.ends_at) };
  return { start: new Date(e.starts_at), end: new Date(e.ends_at) };
}

/** Back to stored timestamps. */
export function spanToStored(allDay: boolean, start: Date, end: Date): { starts_at: string; ends_at: string } {
  if (allDay) {
    const s = startOfDay(start);
    // At least one day; the end is exclusive.
    const e = startOfDay(end) > s ? startOfDay(end) : addDays(s, 1);
    return { starts_at: allDayIso(s), ends_at: allDayIso(e) };
  }
  return { starts_at: start.toISOString(), ends_at: (end > start ? end : new Date(start.getTime() + 15 * 60e3)).toISOString() };
}

/**
 * Wall-clock minutes of `t` counted from local midnight of `day` (negative or past 1440 for other
 * days). Wall clock, not elapsed time: 8:00 is 480 even on the days the clocks change.
 */
export function minutesInto(day: Date, t: Date): number {
  return differenceInCalendarDays(t, day) * MINUTES_PER_DAY + t.getHours() * 60 + t.getMinutes();
}

/** `day` at `minutes` past local midnight (wall clock: 8:00 stays 8:00 on days the clocks change). */
export function atMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  const whole = Math.floor(minutes / MINUTES_PER_DAY);
  const rest = minutes - whole * MINUTES_PER_DAY;
  const base = addDays(d, whole);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(rest / 60), rest % 60);
}

export function snap(minutes: number, step: number) {
  return Math.round(minutes / step) * step;
}

/** The days from `start` (inclusive) for `count` days. */
export function daysFrom(start: Date, count: number): Date[] {
  const s = startOfDay(start);
  return Array.from({ length: count }, (_, i) => addDays(s, i));
}

/** The first day of the week holding `d`. */
export function weekStart(d: Date, weekStartsOn: number): Date {
  const s = startOfDay(d);
  const diff = (s.getDay() - weekStartsOn + 7) % 7;
  return addDays(s, -diff);
}

/** Whole local days between two dates. */
export const dayDiff = (a: Date, b: Date) => differenceInCalendarDays(a, b);

/** Local yyyy-mm-dd. */
export function ymd(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}

/** A local date from yyyy-mm-dd (null when it isn't one). */
export function fromYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

/** The device's IANA time zone ("Europe/Berlin"), when it says. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
