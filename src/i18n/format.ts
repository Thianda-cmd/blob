import { de, enGB } from "date-fns/locale";
import type { Locale } from "./config";

/** date-fns locale for `format`, `formatDistance`… Pass as `{ locale: dateLocale(locale) }`. */
export const dateLocale = (locale: Locale) => (locale === "de" ? de : enGB);

/** BCP 47 tag for Intl / toLocale*String. */
export const intlLocale = (locale: Locale) => (locale === "de" ? "de-DE" : "en-GB");

export function formatNumber(n: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocale(locale), options).format(n);
}

/** "840 B", "12 KB", "1,2 MB" in the reader's number format. */
export function formatBytes(bytes: number, locale: Locale) {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb, locale, { maximumFractionDigits: kb < 10 ? 1 : 0 })} KB`;
  return `${formatNumber(kb / 1024, locale, { maximumFractionDigits: 1 })} MB`;
}
