import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

/**
 * Landing point for every email link (sign-up confirmation, magic link, password reset, email change).
 * Handles both the PKCE `code` flow and `token_hash` links from custom email templates.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  let next = safeNext(params.get("next"));

  const to = (path: string) => {
    const url = request.nextUrl.clone();
    const [pathname, query] = path.split("?");
    url.pathname = pathname;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  };

  const supabase = await createClient();
  let failure: string | null = params.get("error_description");

  if (!failure && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(next);
    failure = error.message;
  } else if (!failure && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type === "recovery") next = "/reset-password";
      return to(next);
    }
    failure = error.message;
  }

  // PKCE links opened in another browser can't be exchanged, but the email is confirmed by then.
  if (/code verifier|code_verifier/i.test(failure ?? "")) {
    return to(`/login?notice=${encodeURIComponent("Email confirmed! Sign in to continue.")}`);
  }

  const message = /expired|invalid/i.test(failure ?? "")
    ? "That link has expired or was already used. Try again."
    : failure || "That link didn't work. Try again.";
  return to(`/login?error=${encodeURIComponent(message)}`);
}
