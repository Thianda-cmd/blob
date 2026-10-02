/** Languages Blob speaks. German first: it's made for German schools. */
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Cookie that remembers the choice (set by the language switch, synced from the account). */
export const LOCALE_COOKIE = "blob-locale";

/**
 * The language an app asked for with ui_locales when it sent someone to "Sign in with Blob".
 * Set by /oauth/authorize for the length of a sign-in (an hour), only used when there is no
 * saved choice, so login, sign-up and consent speak the app's language.
 */
export const UI_LOCALE_COOKIE = "blob-ui-locale";
export const UI_LOCALE_MAX_AGE = 60 * 60;

export const LOCALE_NAMES: Record<Locale, { name: string; short: string }> = {
  de: { name: "Deutsch", short: "DE" },
  en: { name: "English", short: "EN" },
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Best supported language for an Accept-Language header ("de-DE,de;q=0.9,en;q=0.8" → "de"). */
export function negotiate(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

/** First language Blob speaks in an OIDC ui_locales value ("de-DE en" → "de"), or null. */
export function fromUiLocales(value: string | null | undefined): Locale | null {
  for (const tag of (value ?? "").split(/\s+/).slice(0, 10)) {
    const lang = tag.toLowerCase().split("-")[0];
    if (isLocale(lang)) return lang;
  }
  return null;
}
