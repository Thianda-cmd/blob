"use server";

import { timingSafeEqual } from "node:crypto";
import { challengeOf, CODE_TTL_MS, hex, isChallenge, isCode, isState, isVerifier, randomToken, sha256 } from "@/lib/auth/appSignIn";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Signing in the Blob app through the browser (src/lib/auth/appSignIn.ts has the whole picture).

/**
 * In the browser, after you confirmed: a one-time code for the app. Only hashes are kept (of the
 * code and of the app's state), with your account and the app's challenge. The app picks it up
 * itself (`pollAppSignIn`); the code also goes to the app by its link, which brings it forward.
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
      state_hash: hex(await sha256(state)),
      user_id: user.id,
      challenge,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
    });
  if (error) return { error: "failed" };
  // /auth/confirm: every version of the app opens that page from its link (auth/app only the newer ones).
  return { link: `org.bojes.blob://auth/confirm?${new URLSearchParams({ app_code: code, state })}` };
}

/** A session (cookies in this response) for the account, made with a one-time sign-in token. */
async function signInAs(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(userId);
  const email = found.user?.email;
  if (!email) return false;
  // Nothing is emailed: the token is used right here, so the session lands in the app.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return false;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  return !error;
}

/**
 * A confirmed sign-in the app already used moments ago (by its link or by asking), when the answer
 * with the session didn't reach it: the link and the app's own asking can cross, and a page that
 * moves on drops the other's answer. Only the app's verifier redeems it, so this lets nobody else in.
 */
const AGAIN_MS = 2 * 60_000;

/**
 * In the app, from the link: the code from the browser and the app's own verifier become a
 * session. The code is used up on the first try (also when the verifier doesn't match); the app
 * that holds the verifier may redeem it again for a short while (AGAIN_MS).
 */
export async function finishAppSignIn(code: string, verifier: string): Promise<{ ok: true } | { error: "failed" }> {
  if (!isCode(code) || !isVerifier(verifier)) return { error: "failed" };
  const admin = createAdminClient();
  const codeHash = hex(await sha256(code));
  const now = new Date();
  const { data: fresh, error } = await admin
    .from("app_sign_ins")
    .update({ used_at: now.toISOString() })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", now.toISOString())
    .select("user_id, challenge")
    .maybeSingle();
  if (error) return { error: "failed" };
  const row =
    fresh ??
    (
      await admin
        .from("app_sign_ins")
        .select("user_id, challenge")
        .eq("code_hash", codeHash)
        .gt("used_at", new Date(now.getTime() - AGAIN_MS).toISOString())
        .gt("expires_at", now.toISOString())
        .maybeSingle()
    ).data;
  if (!row) return { error: "failed" };

  const expected = Buffer.from(row.challenge as string);
  const got = Buffer.from(await challengeOf(verifier));
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { error: "failed" };
  return (await signInAs(row.user_id as string)) ? { ok: true } : { error: "failed" };
}

/**
 * In the app, while it waits for the browser: has this sign-in been confirmed? Found by the app's
 * state, and only together with its verifier (whose SHA-256 the browser confirmed), so knowing the
 * state alone gets nobody anywhere. A confirmed sign-in is used up here and becomes a session.
 */
export async function pollAppSignIn(state: string, verifier: string): Promise<{ status: "ok" | "waiting" | "failed" }> {
  if (!isState(state) || !isVerifier(verifier)) return { status: "failed" };
  const admin = createAdminClient();
  const stateHash = hex(await sha256(state));
  const challenge = await challengeOf(verifier);
  const now = new Date();
  const { data: fresh, error } = await admin
    .from("app_sign_ins")
    .update({ used_at: now.toISOString() })
    .eq("state_hash", stateHash)
    .eq("challenge", challenge)
    .is("used_at", null)
    .gt("expires_at", now.toISOString())
    .select("user_id")
    .maybeSingle();
  if (error) return { status: "failed" };
  // Used by the app's link a moment ago, and that answer got lost: the same app may have it again.
  const row =
    fresh ??
    (
      await admin
        .from("app_sign_ins")
        .select("user_id")
        .eq("state_hash", stateHash)
        .eq("challenge", challenge)
        .gt("used_at", new Date(now.getTime() - AGAIN_MS).toISOString())
        .gt("expires_at", now.toISOString())
        .maybeSingle()
    ).data;
  if (!row) return { status: "waiting" };
  return { status: (await signInAs(row.user_id as string)) ? "ok" : "failed" };
}
