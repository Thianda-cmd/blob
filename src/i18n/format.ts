import { de, enGB } from "date-fns/locale";
import type { Locale } from "./config";

/** date-fns locale for `format`, `formatDistance`… Pass as `{ locale: dateLocale(locale) }`. */
export const dateLocale = (locale: Locale) => (locale === "de" ? de : enGB);

/** BCP 47 tag for Intl / toLocale*String. */
export const intlLocale = (locale: Locale) => (locale === "de" ? "de-DE" : "en-GB");

export function formatNumber(n: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocale(locale), options).format(n);
}
