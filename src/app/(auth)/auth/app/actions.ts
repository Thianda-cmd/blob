"use server";

import { timingSafeEqual } from "node:crypto";
import { challengeOf, CODE_TTL_MS, hex, isChallenge, isCode, isState, isVerifier, randomToken, sha256 } from "@/lib/auth/appSignIn";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Signing in the Blob app through the browser (src/lib/auth/appSignIn.ts has the whole picture).

/**
 * In the browser, after you confirmed: a one-time code for the app, sent there by its link. Only
 * the code's hash is kept, with your account and the app's challenge.
 */
export async function approveAppSignIn(challenge: string, state: string): Promise<{ link: string } | { error: "request" | "signedOut" | "failed" }> {
  if (!isChallenge(challenge) || !isState(state)) return { error: "request" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "signedOut" };

  const code = randomToken(32);
  const now = Date.now();
  const { error } = await createAdminClient()
    .from("app_sign_ins")
    .insert({
      code_hash: hex(await sha256(code)),
      user_id: user.id,
      challenge,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
    });
  if (error) return { error: "failed" };
  return { link: `org.bojes.blob://auth/app?${new URLSearchParams({ code, state })}` };
}

/**
 * In the app: the code from the browser and the app's own verifier become a session (cookies) for
 * that account. The code is used up on the first try, also when the verifier doesn't match.
 */
export async function finishAppSignIn(code: string, verifier: string): Promise<{ ok: true } | { error: "failed" }> {
  if (!isCode(code) || !isVerifier(verifier)) return { error: "failed" };
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("app_sign_ins")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hex(await sha256(code)))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id, challenge")
    .maybeSingle();
  if (error || !row) return { error: "failed" };

  const expected = Buffer.from(row.challenge as string);
  const got = Buffer.from(await challengeOf(verifier));
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { error: "failed" };

  const { data: found } = await admin.auth.admin.getUserById(row.user_id as string);
  const email = found.user?.email;
  if (!email) return { error: "failed" };
  // A one-time sign-in token for that account (nothing is emailed), used right here: the session
  // lands in this response's cookies, inside the app.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return { error: "failed" };
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (otpError) return { error: "failed" };
  return { ok: true };
}
