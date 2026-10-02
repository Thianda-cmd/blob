"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { authText } from "@/i18n/messages/auth";
import { getLocale } from "@/i18n/server";
import { authMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

const TYPES: EmailOtpType[] = ["signup", "email", "magiclink", "recovery", "invite", "email_change"];

/**
 * Verifies the one-time token from an email link. Runs on a button click (POST),
 * not on page load, so link scanners in school mail systems can't use the token up.
 */
export async function confirmEmail(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  let next = safeNext(String(form.get("next") ?? ""));
  const locale = await getLocale();
  const t = authText[locale].confirm;

  if (!tokenHash || !TYPES.includes(type)) return { error: t.incomplete };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    const expired = error.code === "otp_expired" || /expired|invalid/i.test(error.message);
    return { error: expired ? t.expired : authMessage(error, locale) };
  }

  if (type === "recovery") next = "/reset-password";
  if (type === "invite") next = "/reset-password";
  redirect(next);
}
