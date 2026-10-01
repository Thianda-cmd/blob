import type { AuthError } from "@supabase/supabase-js";

/** Turn Supabase auth errors into short, friendly sentences. */
export function authMessage(error: AuthError | Error | null | undefined): string {
  if (!error) return "";
  const code = "code" in error ? (error as AuthError).code : undefined;
  const msg = error.message?.toLowerCase() ?? "";

  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with this email.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many tries. Wait a minute and try again.";
    case "signup_disabled":
      return "Sign ups are turned off right now.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "otp_expired":
      return "This link has expired. Request a new one.";
    case "email_address_invalid":
      return "That email address doesn't look valid.";
    case "user_not_found":
      return "We couldn't find an account with that email.";
  }

  if (msg.includes("fetch") || msg.includes("network")) return "Can't reach the server. Check your connection.";
  if (msg.includes("rate limit")) return "Too many tries. Wait a minute and try again.";
  return error.message || "Something went wrong. Please try again.";
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
