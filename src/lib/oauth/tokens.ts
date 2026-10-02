import "server-only";
import { decodeProtectedHeader, importJWK, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OAuthApp } from "./apps";
import { ACCESS_TOKEN_TTL, ID_TOKEN_TTL, REFRESH_TOKEN_TTL, type Scope } from "./config";
import { randomToken, sha256 } from "./crypto";
import { publicKeys, signingKey } from "./keys";

export type EventKind = "consent" | "authorize" | "token" | "refresh" | "denied" | "revoked" | "error" | "reuse";

/** Records what happened for the admin panel. Never throws: logging must not break a sign-in. */
export async function logEvent(kind: EventKind, appId: string | null, userId: string | null, detail?: string) {
  try {
    await createAdminClient().from("oauth_events").insert({ kind, app_id: appId, user_id: userId, detail: detail?.slice(0, 300) ?? null });
  } catch {
    /* ignore */
  }
}

/** The person's details as an app may see them, limited to the granted scopes. */
export async function userClaims(userId: string, scopes: readonly string[]) {
  const db = createAdminClient();
  const [{ data: auth }, { data: profile }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from("profiles").select("full_name, avatar_url, updated_at").eq("id", userId).maybeSingle(),
  ]);
  const user = auth?.user;
  if (!user) return null;
  const claims: Record<string, unknown> = { sub: user.id };
  if (scopes.includes("profile")) {
    const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "";
    claims.name = name;
    const first = name.split(/\s+/)[0];
    if (first) claims.given_name = first;
    if (profile?.avatar_url) claims.picture = profile.avatar_url;
    const locale = (user.user_metadata as { locale?: unknown } | undefined)?.locale;
    if (locale === "de" || locale === "en") claims.locale = locale;
    claims.updated_at = Math.floor(Date.parse(profile?.updated_at ?? user.updated_at ?? user.created_at) / 1000);
  }
  if (scopes.includes("email") && user.email) {
    claims.email = user.email;
    claims.email_verified = !!user.email_confirmed_at;
  }
  return claims;
}

/** Issues access + ID token, and a refresh token when `offline_access` was granted. */
export async function issueTokens(opts: {
  iss: string;
  app: OAuthApp;
  userId: string;
  scopes: Scope[];
  nonce?: string | null;
  authTime: number;
  family?: string;
}) {
  const { iss, app, userId, scopes, nonce, authTime } = opts;
  const key = await signingKey();
  const now = Math.floor(Date.now() / 1000);
  const scope = scopes.join(" ");

  const access_token = await new SignJWT({ scope, client_id: app.client_id })
    .setProtectedHeader({ alg: key.alg, kid: key.kid, typ: "at+jwt" })
    .setIssuer(iss)
    .setSubject(userId)
    .setAudience(app.client_id)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL)
    .setJti(randomToken(12))
    .sign(key.key);

  const out: Record<string, unknown> = { access_token, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL, scope };

  if (scopes.includes("openid")) {
    const claims = (await userClaims(userId, scopes)) ?? { sub: userId };
    const { sub: _sub, ...rest } = claims;
    void _sub;
    out.id_token = await new SignJWT({ ...rest, auth_time: authTime, ...(nonce ? { nonce } : {}) })
      .setProtectedHeader({ alg: key.alg, kid: key.kid, typ: "JWT" })
      .setIssuer(iss)
      .setSubject(userId)
      .setAudience(app.client_id)
      .setIssuedAt(now)
      .setExpirationTime(now + ID_TOKEN_TTL)
      .sign(key.key);
  }

  if (scopes.includes("offline_access")) {
    const refresh = `blob_rt_${randomToken(32)}`;
    const { error } = await createAdminClient()
      .from("oauth_refresh_tokens")
      .insert({
        token_hash: sha256(refresh),
        app_id: app.id,
        user_id: userId,
        scopes,
        family: opts.family ?? crypto.randomUUID(),
        auth_time: new Date(authTime * 1000).toISOString(),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString(),
      });
    if (error) throw new Error(`refresh token: ${error.message}`);
    out.refresh_token = refresh;
  }

  return out;
}

export type AccessClaims = JWTPayload & { scope: string; client_id: string; sub: string };

/** Checks a Bearer access token: our signature, our issuer, not expired, typ at+jwt. */
export async function verifyAccessToken(token: string, iss: string): Promise<AccessClaims | null> {
  try {
    const { kid, typ } = decodeProtectedHeader(token);
    if (typ !== "at+jwt" || !kid) return null;
    const jwk = (await publicKeys()).find((k) => k.kid === kid);
    if (!jwk) return null;
    const key = await importJWK(jwk, "RS256");
    const { payload } = await jwtVerify(token, key, { issuer: iss, algorithms: ["RS256"], typ: "at+jwt" });
    if (typeof payload.sub !== "string" || typeof payload.scope !== "string" || typeof payload.client_id !== "string") return null;
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

/** Is the person's permission for this app still in place (not revoked, app not disabled)? */
export async function grantActive(userId: string, appId: string) {
  const { data } = await createAdminClient().from("oauth_grants").select("revoked_at").eq("user_id", userId).eq("app_id", appId).maybeSingle();
  return !!data && !data.revoked_at;
}

/** Revokes a person's permission for an app and every refresh token it holds. */
export async function revokeGrant(userId: string, appId: string) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  await Promise.all([
    db.from("oauth_grants").update({ revoked_at: now }).eq("user_id", userId).eq("app_id", appId),
    db.from("oauth_refresh_tokens").update({ revoked_at: now }).eq("user_id", userId).eq("app_id", appId).is("revoked_at", null),
  ]);
  await logEvent("revoked", appId, userId);
}
