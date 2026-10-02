"use server";

import { cookies } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "./config";

/**
 * Switch the language. Remembered in a cookie for this browser and, when signed in, on the
 * account (user metadata) so other devices and the auth emails follow. Call router.refresh() after.
 */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return { ok: false as const };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  const user = await getUser();
  if (user && user.user_metadata?.locale !== locale) {
    const supabase = await createClient();
    await supabase.auth.updateUser({ data: { locale } });
  }
  return { ok: true as const };
}
