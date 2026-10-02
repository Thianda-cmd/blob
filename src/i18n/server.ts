import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, negotiate, UI_LOCALE_COOKIE, type Locale } from "./config";
import { PATH_HEADER } from "@/lib/path-header";
import type { Dict } from "./define";

/** Pages of a "Sign in with Blob" request, where the app's language (ui_locales) applies. */
const SIGN_IN_PAGES = /^\/(?:login|signup|check-email|forgot-password|reset-password|auth|oauth)(?:\/|$)/;

/**
 * The visitor's language: their saved choice, else on sign-in pages the language an app asked
 * for during "Sign in with Blob" (ui_locales), else what their browser asks for.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const saved = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const head = await headers();
  const asked = jar.get(UI_LOCALE_COOKIE)?.value;
  if (isLocale(asked) && SIGN_IN_PAGES.test(head.get(PATH_HEADER) ?? "")) return asked;
  return negotiate(head.get("accept-language"));
});

/** Messages from a dictionary in the visitor's language (server components, actions, metadata). */
export async function getMessages<T>(dict: Dict<T>): Promise<T> {
  return dict[await getLocale()];
}
