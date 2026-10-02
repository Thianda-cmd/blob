"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { Dict } from "./define";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Set once in the root layout from the server's `getLocale()`. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Messages from a dictionary in the current language (client components). */
export function useMessages<T>(dict: Dict<T>): T {
  return dict[useContext(LocaleContext)];
}
