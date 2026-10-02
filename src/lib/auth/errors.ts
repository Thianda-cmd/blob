import type { AuthError } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { authText } from "@/i18n/messages/auth";
import { guessLocale } from "./locale";

/**
 * Turn Supabase auth errors into short, friendly sentences in the reader's language.
 * Client: pass `useLocale()`; server: `await getLocale()`. Without it, the page's language is used.
 */
export function authMessage(error: AuthError | Error | null | undefined, locale: Locale = guessLocale()): string {
  if (!error) return "";
  const t = authText[locale];
  const code = "code" in error ? (error as AuthError).code : undefined;
  const msg = error.message?.toLowerCase() ?? "";

  switch (code) {
    case "invalid_credentials":
      return t.errors.invalidCredentials;
    case "email_not_confirmed":
      return t.errors.notConfirmed;
    case "user_already_exists":
    case "email_exists":
      return t.common.exists;
    case "weak_password":
      return t.errors.weakPassword;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t.errors.tooManyTries;
    case "signup_disabled":
      return t.errors.signupsOff;
    case "same_password":
      return t.errors.samePassword;
    case "otp_expired":
      return t.errors.linkExpired;
    case "email_address_invalid":
      return t.errors.invalidEmail;
    case "user_not_found":
      return t.common.noAccount;
  }

  if (msg.includes("fetch") || msg.includes("network")) return t.errors.offline;
  if (msg.includes("rate limit")) return t.errors.tooManyTries;
  return error.message ? t.errors.unknown(error.message) : t.errors.generic;
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
