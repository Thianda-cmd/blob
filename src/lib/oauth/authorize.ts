import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appById, appByClientId, parseScopes, publicApp, resolveRedirect, type OAuthApp, type PublicApp } from "./apps";
import { CODE_TTL, SCOPES, type Scope } from "./config";
import { randomToken, sha256 } from "./crypto";
import { logEvent } from "./tokens";

export type AuthorizeParams = {
  client_id: string | null;
  redirect_uri: string | null;
  response_type: string | null;
  scope: string | null;
  state: string | null;
  nonce: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
  prompt: string | null;
  login_hint: string | null;
};

export const readAuthorizeParams = (p: URLSearchParams): AuthorizeParams => ({
  client_id: p.get("client_id"),
  redirect_uri: p.get("redirect_uri"),
  response_type: p.get("response_type"),
  scope: p.get("scope"),
  state: p.get("state"),
  nonce: p.get("nonce"),
  code_challenge: p.get("code_challenge"),
  code_challenge_method: p.get("code_challenge_method"),
  prompt: p.get("prompt"),
  login_hint: p.get("login_hint"),
});

/** Appends parameters to a redirect URI (keeping its own query), plus `iss` against mix-up attacks (RFC 9207). */
export function redirectWith(uri: string, params: Record<string, string | null | undefined>, iss: string) {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  url.searchParams.set("iss", iss);
  return url.toString();
}

export type Checked =
  /** Unknown app or redirect URI: never redirect, show an error page. */
  | { kind: "fatal"; reason: "unknown_app" | "app_disabled" | "bad_redirect" }
  /** Errors the app should hear about: redirect back with ?error=. */
  | { kind: "redirect"; url: string; app: OAuthApp }
  | {
      kind: "ok";
      app: OAuthApp;
      redirectUri: string;
      scopes: Scope[];
      state: string | null;
      nonce: string | null;
      codeChallenge: string | null;
      prompt: string[];
      loginHint: string | null;
    };

/** Validates an authorization request (RFC 6749 §4.1.1, OIDC Core §3.1.2.1, PKCE). */
export async function checkAuthorizeRequest(p: AuthorizeParams, iss: string): Promise<Checked> {
  const app = await appByClientId(p.client_id);
  if (!app) return { kind: "fatal", reason: "unknown_app" };
  const redirectUri = resolveRedirect(app, p.redirect_uri);
  if (!redirectUri) return { kind: "fatal", reason: "bad_redirect" };
  const fail = (error: string, description: string): Checked => ({
    kind: "redirect",
    app,
    url: redirectWith(redirectUri, { error, error_description: description, state: p.state }, iss),
  });
  if (app.disabled) return fail("unauthorized_client", "This app is switched off in Blob.");
  if (p.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  const scopes = parseScopes(p.scope, app);
  if (!scopes) return fail("invalid_scope", `Allowed scopes: ${app.scopes.filter((s) => (SCOPES as readonly string[]).includes(s)).join(" ")}.`);
  if (p.state && p.state.length > 1000) return fail("invalid_request", "state is too long.");
  if (p.nonce && p.nonce.length > 500) return fail("invalid_request", "nonce is too long.");
  // PKCE is required for browser apps and recommended for everyone; only S256 is accepted.
  if (p.code_challenge) {
    if ((p.code_challenge_method ?? "plain") !== "S256") return fail("invalid_request", "code_challenge_method must be S256.");
    if (!/^[A-Za-z0-9\-_]{43,128}$/.test(p.code_challenge)) return fail("invalid_request", "Malformed code_challenge.");
  } else if (!app.confidential) {
    return fail("invalid_request", "PKCE (code_challenge with S256) is required.");
  }
  const prompt = (p.prompt ?? "").split(/\s+/).filter(Boolean);
  if (prompt.includes("none") && prompt.length > 1) return fail("invalid_request", "prompt=none can't be combined.");
  return {
    kind: "ok",
    app,
    redirectUri,
    scopes,
    state: p.state,
    nonce: p.nonce,
    codeChallenge: p.code_challenge,
    prompt,
    loginHint: p.login_hint?.slice(0, 320) ?? null,
  };
}

/** Does the person still need to say yes? (Trusted apps and earlier consent covering the scopes skip it.) */
export async function needsConsent(app: OAuthApp, userId: string, scopes: Scope[]) {
  if (app.trusted) return false;
  const { data } = await createAdminClient().from("oauth_grants").select("scopes, revoked_at").eq("user_id", userId).eq("app_id", app.id).maybeSingle();
  if (!data || data.revoked_at) return true;
  return scopes.some((s) => !(data.scopes as string[]).includes(s));
}

type Ok = Extract<Checked, { kind: "ok" }>;

/** Stores the request so the consent page only needs its id. */
export async function saveRequest(c: Ok) {
  const db = createAdminClient();
  // Tidy up old requests and codes now and then.
  if (Math.random() < 0.05) {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    await Promise.all([db.from("oauth_requests").delete().lt("expires_at", old), db.from("oauth_codes").delete().lt("expires_at", old)]);
  }
  const { data, error } = await db
    .from("oauth_requests")
    .insert({
      app_id: c.app.id,
      redirect_uri: c.redirectUri,
      scopes: c.scopes,
      state: c.state,
      nonce: c.nonce,
      code_challenge: c.codeChallenge,
      code_challenge_method: c.codeChallenge ? "S256" : null,
      prompt: c.prompt.join(" ") || null,
      login_hint: c.loginHint,
    })
    .select("id")
    .single();
  if (error) throw new Error(`oauth_requests: ${error.message}`);
  return data.id as string;
}

export type PendingRequest = {
  id: string;
  app: OAuthApp;
  redirectUri: string;
  scopes: Scope[];
  state: string | null;
  nonce: string | null;
  codeChallenge: string | null;
  loginHint: string | null;
  /** prompt=consent: ask even when consent was given before. */
  forceConsent: boolean;
  expired: boolean;
  completed: boolean;
};

export async function loadRequest(id: string | null | undefined): Promise<PendingRequest | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("oauth_requests").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const app = await appById(data.app_id);
  if (!app) return null;
  return {
    id: data.id,
    app,
    redirectUri: data.redirect_uri,
    scopes: data.scopes as Scope[],
    state: data.state,
    nonce: data.nonce,
    codeChallenge: data.code_challenge,
    loginHint: data.login_hint,
    forceConsent: (data.prompt ?? "").split(" ").includes("consent"),
    expired: Date.parse(data.expires_at) < Date.now(),
    completed: !!data.completed_at,
  };
}

/** What the consent screen needs, without any secrets. */
export const requestView = (r: PendingRequest): { id: string; app: PublicApp; scopes: Scope[]; redirectOrigin: string } => ({
  id: r.id,
  app: publicApp(r.app),
  scopes: r.scopes,
  redirectOrigin: new URL(r.redirectUri).origin,
});

/** Issues a one-time code for the request and records the grant. Returns where to send the browser. */
export async function approve(r: PendingRequest, userId: string, iss: string, authTime: number) {
  const db = createAdminClient();
  const code = randomToken(32);
  const now = new Date().toISOString();
  const [{ error }] = await Promise.all([
    db.from("oauth_codes").insert({
      code_hash: sha256(code),
      app_id: r.app.id,
      user_id: userId,
      redirect_uri: r.redirectUri,
      scopes: r.scopes,
      nonce: r.nonce,
      code_challenge: r.codeChallenge,
      code_challenge_method: r.codeChallenge ? "S256" : null,
      auth_time: new Date(authTime * 1000).toISOString(),
      expires_at: new Date(Date.now() + CODE_TTL * 1000).toISOString(),
    }),
    db.from("oauth_requests").update({ completed_at: now }).eq("id", r.id),
  ]);
  if (error) throw new Error(`oauth_codes: ${error.message}`);
  // Merge with what was granted before, so asking for less later doesn't drop earlier consent.
  const { data: prev } = await db.from("oauth_grants").select("scopes, revoked_at").eq("user_id", userId).eq("app_id", r.app.id).maybeSingle();
  const scopes = [...new Set([...(prev && !prev.revoked_at ? (prev.scopes as string[]) : []), ...r.scopes])];
  await db.from("oauth_grants").upsert({ user_id: userId, app_id: r.app.id, scopes, updated_at: now, revoked_at: null }, { onConflict: "user_id,app_id" });
  await logEvent("authorize", r.app.id, userId);
  return redirectWith(r.redirectUri, { code, state: r.state }, iss);
}

export async function deny(r: PendingRequest, userId: string | null, iss: string) {
  await createAdminClient().from("oauth_requests").update({ completed_at: new Date().toISOString() }).eq("id", r.id);
  await logEvent("denied", r.app.id, userId);
  return redirectWith(r.redirectUri, { error: "access_denied", error_description: "The person said no.", state: r.state }, iss);
}
