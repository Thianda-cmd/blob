import { format } from "date-fns";
import type { Locale } from "@/i18n/config";
import { dateLocale, intlLocale } from "@/i18n/format";
import type { calendarText } from "@/i18n/messages/calendar";
import type { Recurrence } from "@/lib/types";
import { fromYmd } from "@/calendar/time";
import { intervalOf, weekdaysOf } from "@/calendar/recurrence";

type T = (typeof calendarText)["en"];

const timeFormats = new Map<string, Intl.DateTimeFormat>();

/** "8:00", "14:30" (the locale's own style). */
export function fmtTime(d: Date, locale: Locale) {
  let f = timeFormats.get(locale);
  if (!f) timeFormats.set(locale, (f = new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" })));
  return f.format(d);
}

/** "8:00 – 9:30" */
export function fmtRange(start: Date, end: Date, locale: Locale) {
  return `${fmtTime(start, locale)} – ${fmtTime(end, locale)}`;
}

export const fmt = (d: Date, pattern: string, locale: Locale) => format(d, pattern, { locale: dateLocale(locale) });

/** A weekday's name ("Monday"), 0 Sunday … 6 Saturday. */
export function weekdayName(day: number, locale: Locale, width: "long" | "short" = "long") {
  // 4 January 1970 was a Sunday.
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: width, timeZone: "UTC" }).format(new Date(Date.UTC(1970, 0, 4 + day)));
}

/** How an event repeats, in words. */
export function describeRepeat(r: Recurrence | null, start: Date, t: T, locale: Locale): string {
  if (!r) return t.repeat.never;
  const n = intervalOf(r);
  const days = r.freq === "weekly" ? weekdaysOf(r, start) : [];
  const simpleEnd = !r.until && !r.count;
  const parity = r.freq === "weekly" && (r.weeks === "even" || r.weeks === "odd") ? r.weeks : null;
  if (simpleEnd && n === 1 && !parity) {
    if (r.freq === "daily") return t.repeat.daily;
    if (r.freq === "weekly" && days.join() === "1,2,3,4,5") return t.repeat.weekdays;
    if (r.freq === "weekly" && days.length === 1 && days[0] === start.getDay()) return t.repeat.weekly(weekdayName(start.getDay(), locale));
    if (r.freq === "monthly") return t.repeat.monthly(start.getDate());
    if (r.freq === "yearly") return t.repeat.yearly(fmt(start, t.format.monthDay, locale));
  }
  const every = parity && n === 1 ? t.repeat.everyOther : t.repeat.everyN(n, r.freq);
  const on = r.freq === "weekly" ? orderWeek(days).map((d) => weekdayName(d, locale, "short")).join(", ") : null;
  const until = fromYmd(r.until ?? null);
  const end = until ? t.repeat.until(fmt(until, t.format.dateYear, locale)) : r.count ? t.repeat.count(r.count) : null;
  const text = t.repeat.summary(every, on, end);
  return parity ? `${text} (${t.repeat.parity[parity]})` : text;
}

/** Weekdays in week order (Monday first). */
export const orderWeek = (days: number[]) => [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

/** A reminder in words: minutes before the start (all-day events: before local midnight). */
export function describeReminder(minutes: number, allDay: boolean, t: T, locale: Locale): string {
  if (allDay) {
    // -540 is 9:00 on the day; 360 is 18:00 the day before.
    const daysBefore = Math.ceil(minutes / 1440);
    const minuteOfDay = daysBefore * 1440 - minutes;
    const time = fmtTime(new Date(2000, 0, 1, Math.floor(minuteOfDay / 60), minuteOfDay % 60), locale);
    if (daysBefore <= 0) return t.reminder.onDayAt(time);
    if (daysBefore === 1) return t.reminder.dayBeforeAt(time);
    if (daysBefore === 7) return t.reminder.weekBeforeAt(time);
    return t.reminder.daysBeforeAt(daysBefore, time);
  }
  if (minutes === 0) return t.reminder.atStart;
  if (minutes % 10080 === 0) return t.reminder.weeks(minutes / 10080);
  if (minutes % 1440 === 0) return t.reminder.days(minutes / 1440);
  if (minutes % 60 === 0) return t.reminder.hours(minutes / 60);
  return t.reminder.minutes(minutes);
}

/** Reminder choices offered in the editor. */
export const REMINDER_CHOICES = {
  timed: [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080],
  // On the day at 9:00 and 7:00, the day before at 9:00 and 18:00, two days and a week before at 18:00.
  allDay: [-540, -420, 900, 360, 1800, 9000],
};
