import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isScope, type Scope } from "./config";
import { sameHash, sha256 } from "./crypto";

export type OAuthApp = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  homepage_url: string | null;
  privacy_url: string | null;
  logo_url: string | null;
  mark: string;
  color: string;
  redirect_uris: string[];
  allowed_origins: string[];
  scopes: string[];
  confidential: boolean;
  secret_hash: string | null;
  secret_hint: string | null;
  trusted: boolean;
  disabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** What the consent screen and other public places may show about an app. */
export type PublicApp = Pick<OAuthApp, "client_id" | "name" | "description" | "homepage_url" | "privacy_url" | "logo_url" | "mark" | "color" | "trusted">;

export const publicApp = (app: OAuthApp): PublicApp => ({
  client_id: app.client_id,
  name: app.name,
  description: app.description,
  homepage_url: app.homepage_url,
  privacy_url: app.privacy_url,
  logo_url: app.logo_url,
  mark: app.mark,
  color: app.color,
  trusted: app.trusted,
});

export async function appByClientId(clientId: string | null | undefined): Promise<OAuthApp | null> {
  if (!clientId || clientId.length > 64) return null;
  const { data } = await createAdminClient().from("oauth_apps").select("*").eq("client_id", clientId).maybeSingle();
  return (data as OAuthApp | null) ?? null;
}

export async function appById(id: string): Promise<OAuthApp | null> {
  const { data } = await createAdminClient().from("oauth_apps").select("*").eq("id", id).maybeSingle();
  return (data as OAuthApp | null) ?? null;
}

/**
 * The redirect URI must match a registered one exactly (no wildcards, no prefix matching).
 * Without one in the request, an app with a single registered URI uses that.
 */
export function resolveRedirect(app: OAuthApp, requested: string | null): string | null {
  if (!requested) return app.redirect_uris.length === 1 ? app.redirect_uris[0] : null;
  return app.redirect_uris.includes(requested) ? requested : null;
}

/** Origins allowed to call the token and userinfo endpoints from a browser. */
export function appOrigins(app: Pick<OAuthApp, "redirect_uris" | "allowed_origins">): string[] {
  const out = new Set<string>();
  for (const uri of [...app.redirect_uris, ...app.allowed_origins]) {
    try {
      const u = new URL(uri);
      if (u.protocol === "https:" || u.protocol === "http:") out.add(u.origin);
    } catch {
      /* not a URL: skip */
    }
  }
  return [...out];
}

/** Checks a client secret (confidential apps). */
export function secretMatches(app: OAuthApp, secret: string | null | undefined) {
  return !!secret && !!app.secret_hash && sameHash(sha256(secret), app.secret_hash);
}

/** Parses the requested scopes. `null` means one of them isn't allowed for this app. */
export function parseScopes(raw: string | null, app: OAuthApp): Scope[] | null {
  const asked = (raw ?? "openid").split(/\s+/).filter(Boolean);
  const out: Scope[] = [];
  for (const s of asked) {
    if (!isScope(s) || !app.scopes.includes(s)) return null;
    if (!out.includes(s)) out.push(s);
  }
  return out.length ? out : null;
}

/** A registered redirect URI must be https (http only for localhost) and carry no fragment. */
export function validRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
  } catch {
    return false;
  }
}
