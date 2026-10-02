import { format, formatDistanceToNowStrict } from "date-fns";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";

/** "2. Okt. 2026" / "2 Oct 2026" */
export const shortDate = (iso: string, locale: Locale) => format(new Date(iso), locale === "de" ? "d. MMM yyyy" : "d MMM yyyy", { locale: dateLocale(locale) });

/** "vor 3 Stunden" / "3 hours ago" */
export const ago = (iso: string, locale: Locale) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: dateLocale(locale) });

/** "2. Okt. 2026, 14:30" / "2 Oct 2026, 14:30" for tooltips. */
export const dateTime = (iso: string, locale: Locale) => format(new Date(iso), locale === "de" ? "d. MMM yyyy, HH:mm" : "d MMM yyyy, HH:mm", { locale: dateLocale(locale) });

/** A chart day (YYYY-MM-DD): "Do., 2. Okt." / "Thu 2 Oct" */
export const chartDay = (day: string, locale: Locale) => format(new Date(`${day}T12:00:00`), locale === "de" ? "EEE, d. MMM" : "EEE d MMM", { locale: dateLocale(locale) });

/** A chart axis label: "2. Okt." / "2 Oct" */
export const axisDay = (day: string, locale: Locale) => format(new Date(`${day}T12:00:00`), locale === "de" ? "d. MMM" : "d MMM", { locale: dateLocale(locale) });

/** The host of a URL, for compact display. */
export function host(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
