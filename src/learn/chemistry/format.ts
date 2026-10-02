// Numbers in chemistry content: decimal comma in German, point in English ("22,99" / "22.99").

import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";

/** A number for display in one language, at most `digits` decimals, no thousands separator. */
export const dec = (v: number, locale: Locale, digits = 2) =>
  new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits, useGrouping: false }).format(v);

/** The same number in both languages, for `math`, notes and answers: decText(22.99) → "22.99" / "22,99". */
export const decText = (v: number, digits = 2): Text => txMap((_, l) => dec(v, l, digits));
