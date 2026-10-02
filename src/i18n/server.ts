import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, negotiate, type Locale } from "./config";
import type { Dict } from "./define";

/** The visitor's language: their saved choice, else what their browser asks for. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiate((await headers()).get("accept-language"));
});

/** Messages from a dictionary in the visitor's language (server components, actions, metadata). */
export async function getMessages<T>(dict: Dict<T>): Promise<T> {
  return dict[await getLocale()];
}
