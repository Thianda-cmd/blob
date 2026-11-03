// Dates and times as numbers, like Excel: a date is the count of days since 30 December 1899
// (1 = 31.12.1899, 45658 = 01.01.2025), a time is the fraction of a day (0,5 = 12:00).
//
// The 1900 leap-year quirk: Excel pretends 29 February 1900 existed (serial 60), a bug kept from
// Lotus 1-2-3. We count real days from 30.12.1899 for every date, as LibreOffice and Google Sheets
// do, so every date from 1 March 1900 on has exactly Excel's serial number (what matters for lab
// and school work); only the first two months of 1900 are one day off from Excel's numbers.
//
// All the arithmetic is on whole days (no Date objects, no time zones), so daylight saving time
// can never shift a date.

import type { Locale } from "@/i18n/config";

/** Days from 30.12.1899 to 01.01.1970 (Excel's DATE(1970;1;1)). */
const UNIX_EPOCH_SERIAL = 25569;
/** The last day Excel knows: 31.12.9999. */
export const MAX_SERIAL = 2958465;

/** Days since 1970-01-01 of a civil date (proleptic Gregorian), Howard Hinnant's algorithm. */
function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = m > 2 ? m - 3 : m + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z: number): { y: number; m: number; d: number } {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** The serial number of a date; month and day may overflow (month 13 = January of the next year, day 0 = last of the month before). */
export function serialFromYMD(y: number, m: number, d: number): number {
  // Normalise the month first so days_from_civil gets 1–12.
  const mm = m - 1;
  const yy = y + Math.floor(mm / 12);
  const m1 = (((mm % 12) + 12) % 12) + 1;
  return daysFromCivil(yy, m1, 1) + (d - 1) + UNIX_EPOCH_SERIAL;
}

/** Year, month (1–12) and day of a serial number (its whole days). */
export function ymdFromSerial(serial: number): { y: number; m: number; d: number } {
  return civilFromDays(Math.floor(serial) - UNIX_EPOCH_SERIAL);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(serial: number): number {
  // 30.12.1899 was a Saturday.
  return (((Math.floor(serial) + 6) % 7) + 7) % 7;
}

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Hours, minutes, seconds of the time part, rounded to the nearest second; `carry` is 1 when it rounds up to the next day. */
export function timeOfSerial(serial: number): { h: number; mi: number; s: number; carry: number } {
  const frac = serial - Math.floor(serial);
  let total = Math.round(frac * 86400);
  let carry = 0;
  if (total >= 86400) {
    total -= 86400;
    carry = 1;
  }
  return { h: Math.floor(total / 3600), mi: Math.floor((total % 3600) / 60), s: total % 60, carry };
}

/** A local Date (the device's clock) → serial number with the time of day. */
export function serialFromDate(date: Date): number {
  const days = serialFromYMD(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const secs = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
  return days + secs / 86400;
}

/** Two-digit years like Excel: 00–29 → 2000–2029, 30–99 → 1930–1999. */
export function fullYear(y: number, digits: number): number {
  if (digits > 2) return y;
  return y < 30 ? 2000 + y : 1900 + y;
}

export const MONTHS: Record<Locale, string[]> = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
export const MONTHS_SHORT: Record<Locale, string[]> = {
  de: ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
/** Sunday first, like WEEKDAY. */
export const WEEKDAYS: Record<Locale, string[]> = {
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
export const WEEKDAYS_SHORT: Record<Locale, string[]> = {
  de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

/** A month name or abbreviation in either language ("März", "Maerz", "Mrz", "Mär", "mar", "October", "Okt.") → 1–12; 0 when it isn't one. */
export function monthFromName(text: string): number {
  const t = text.toLowerCase().replace(/\.$/, "");
  if (!t) return 0;
  for (const loc of ["de", "en"] as const) {
    for (let i = 0; i < 12; i++) {
      const full = MONTHS[loc][i].toLowerCase();
      if (t === full || t === MONTHS_SHORT[loc][i].toLowerCase()) return i + 1;
      // Prefixes of at least 3 letters ("Sept", "Febr", "Mär").
      if (t.length >= 3 && full.startsWith(t)) return i + 1;
    }
  }
  if (t === "maerz") return 3;
  return 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 01.11.2026 (de) / 11/1/2026 (en). */
export function shortDate(serial: number, locale: Locale): string {
  const { y, m, d } = ymdFromSerial(serial);
  return locale === "de" ? `${pad2(d)}.${pad2(m)}.${y}` : `${m}/${d}/${y}`;
}

/** 1. November 2026 (de) / November 1, 2026 (en). */
export function longDate(serial: number, locale: Locale): string {
  const { y, m, d } = ymdFromSerial(serial);
  return locale === "de" ? `${d}. ${MONTHS.de[m - 1]} ${y}` : `${MONTHS.en[m - 1]} ${d}, ${y}`;
}

/** 2026-11-01 */
export function isoDate(serial: number): string {
  const { y, m, d } = ymdFromSerial(serial);
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

/** 14:30 or 14:30:05 (24-hour clock in both languages; it's what lab protocols use). */
export function clockTime(serial: number, seconds: boolean): string {
  const t = timeOfSerial(serial);
  return seconds ? `${pad2(t.h)}:${pad2(t.mi)}:${pad2(t.s)}` : `${pad2(t.h)}:${pad2(t.mi)}`;
}

/** A duration in hours and minutes, Excel's [h]:mm: 1,5 days → 36:00 (36:00:00 with seconds), rounded to the second. */
export function durationText(serial: number, seconds: boolean): string {
  const total = Math.round(serial * 86400);
  const h = Math.floor(total / 3600);
  const mi = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return seconds ? `${pad2(h)}:${pad2(mi)}:${pad2(s)}` : `${pad2(h)}:${pad2(mi)}`;
}

/** ISO 8601 week number (weeks start on Monday; week 1 holds the year's first Thursday). */
export function isoWeekNum(serial: number): number {
  const day = Math.floor(serial);
  const wd = (weekdayOf(day) + 6) % 7; // Monday 0
  const thursday = day - wd + 3;
  const { y } = ymdFromSerial(thursday);
  const jan1 = serialFromYMD(y, 1, 1);
  return Math.floor((thursday - jan1) / 7) + 1;
}
