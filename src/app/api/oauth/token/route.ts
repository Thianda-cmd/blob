import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appByClientId, secretMatches, type OAuthApp } from "@/lib/oauth/apps";
import { issuer, type Scope } from "@/lib/oauth/config";
import { pkceMatches, sha256 } from "@/lib/oauth/crypto";
import { clientCredentials, corsFor, json, oauthError, preflight, readForm } from "@/lib/oauth/http";
import { grantActive, issueTokens, logEvent } from "@/lib/oauth/tokens";

/** The token endpoint: swaps a one-time code (with PKCE) or a refresh token for tokens. */
export async function POST(request: NextRequest) {
  const form = await readForm(request);
  const { clientId, clientSecret, basic } = clientCredentials(request, form);
  const app = await appByClientId(clientId);
  const cors = corsFor(request, app);
  const fail = (error: string, description: string, status = 400) => oauthError(error, description, status, cors);

  if (!app) return fail("invalid_client", "Unknown client_id.", 401);
  if (app.disabled) return fail("unauthorized_client", "This app is switched off in Blob.");
  if (app.confidential) {
    if (!secretMatches(app, clientSecret)) {
      await logEvent("error", app.id, null, "bad client secret");
      return oauthError("invalid_client", "Client authentication failed.", 401, { ...cors, ...(basic ? { "WWW-Authenticate": 'Basic realm="blob"' } : {}) });
    }
  } else if (clientSecret) {
    return fail("invalid_client", "This app is a public client and has no secret.", 401);
  }

  const iss = issuer(request);
  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") return codeGrant(app, form, iss, cors, fail);
  if (grantType === "refresh_token") return refreshGrant(app, form, iss, cors, fail);
  return fail("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

type Fail = (error: string, description: string, status?: number) => Response;

async function codeGrant(app: OAuthApp, form: URLSearchParams, iss: string, cors: Record<string, string>, fail: Fail) {
  const code = form.get("code");
  if (!code) return fail("invalid_request", "Missing code.");
  const db = createAdminClient();
  const { data } = await db.rpc("oauth_redeem_code", { p_code_hash: sha256(code) });
  const row = (data as { app_id: string; user_id: string; redirect_uri: string; scopes: Scope[]; nonce: string | null; code_challenge: string | null; auth_time: string }[] | null)?.[0];
  if (!row || row.app_id !== app.id) {
    await logEvent("error", app.id, null, "invalid or reused code");
    return fail("invalid_grant", "The code is invalid, expired or already used.");
  }
  if (form.get("redirect_uri") !== row.redirect_uri) return fail("invalid_grant", "redirect_uri doesn't match the authorization request.");
  if (row.code_challenge) {
    const verifier = form.get("code_verifier");
    if (!verifier || !pkceMatches(verifier, row.code_challenge)) return fail("invalid_grant", "PKCE verification failed.");
  } else if (!app.confidential) {
    return fail("invalid_grant", "PKCE is required.");
  }
  if (!(await grantActive(row.user_id, app.id))) return fail("invalid_grant", "Access was revoked.");

  const tokens = await issueTokens({ iss, app, userId: row.user_id, scopes: row.scopes, nonce: row.nonce, authTime: Math.floor(Date.parse(row.auth_time) / 1000) });
  await Promise.all([
    db.from("oauth_grants").update({ last_used_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("app_id", app.id),
    logEvent("token", app.id, row.user_id),
  ]);
  return json(tokens, 200, cors);
}

async function refreshGrant(app: OAuthApp, form: URLSearchParams, iss: string, cors: Record<string, string>, fail: Fail) {
  const token = form.get("refresh_token");
  if (!token) return fail("invalid_request", "Missing refresh_token.");
  const db = createAdminClient();
  const hash = sha256(token);
  const { data } = await db.rpc("oauth_use_refresh_token", { p_token_hash: hash });
  const row = (data as { app_id: string; user_id: string; scopes: Scope[]; family: string; auth_time: string }[] | null)?.[0];

  if (!row) {
    // A used token showing up again means it leaked: revoke the whole family (RFC 9700 §4.14.2).
    const { data: old } = await db.from("oauth_refresh_tokens").select("family, user_id, app_id, used_at").eq("token_hash", hash).maybeSingle();
    if (old?.used_at && old.app_id === app.id) {
      await db.from("oauth_refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("family", old.family).is("revoked_at", null);
      await logEvent("reuse", app.id, old.user_id, "refresh token reused, family revoked");
    }
    return fail("invalid_grant", "The refresh token is invalid, expired or already used.");
  }
  if (row.app_id !== app.id) return fail("invalid_grant", "This refresh token belongs to another app.");
  if (!(await grantActive(row.user_id, app.id))) return fail("invalid_grant", "Access was revoked.");

  // Optional narrower scope (RFC 6749 §6).
  let scopes = row.scopes;
  const asked = form.get("scope");
  if (asked) {
    const want = asked.split(/\s+/).filter(Boolean);
    if (want.some((s) => !row.scopes.includes(s as Scope))) return fail("invalid_scope", "Can't widen the scope on refresh.");
    scopes = want as Scope[];
    if (!scopes.includes("offline_access")) scopes = [...scopes, "offline_access"];
  }

  const tokens = await issueTokens({ iss, app, userId: row.user_id, scopes, authTime: Math.floor(Date.parse(row.auth_time) / 1000), family: row.family });
  await Promise.all([
    db.from("oauth_grants").update({ last_used_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("app_id", app.id),
    logEvent("refresh", app.id, row.user_id),
  ]);
  return json(tokens, 200, cors);
}

export const OPTIONS = (request: NextRequest) => preflight(request, "POST, OPTIONS");
