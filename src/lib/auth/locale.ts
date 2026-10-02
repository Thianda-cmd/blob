import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

/** Fallback for helpers called without a locale: the page's <html lang>, else the default. */
export function guessLocale(): Locale {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}
