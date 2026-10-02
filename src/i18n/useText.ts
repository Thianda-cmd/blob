"use client";

import { useLocale } from "./client";
import { resolveText, type Text } from "./text";

/** Resolver for bilingual learning text in the current language. */
export function useText() {
  const locale = useLocale();
  return (text: Text | null | undefined) => resolveText(text, locale);
}
