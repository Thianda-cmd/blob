import type { Locale } from "./config";

/**
 * Text that can be in both languages, used for learning content where strings are
 * built in code: `tx("Expand the brackets", "Löse die Klammern auf")`. A plain string
 * is fine for text without words (pure maths, names, numbers).
 */
export type Text = string | { en: string; de: string };

export const tx = (en: string, de: string): Text => ({ en, de });

export function resolveText(text: Text | null | undefined, locale: Locale): string {
  if (text == null) return "";
  return typeof text === "string" ? text : text[locale];
}

/** Build the same sentence in both languages: txMap(t => `${t("Step", "Schritt")} 1`). */
export function txMap(build: (pick: (en: string, de: string) => string, locale: Locale) => string): Text {
  return { en: build((en) => en, "en"), de: build((_, de) => de, "de") };
}
