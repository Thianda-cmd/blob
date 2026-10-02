import "server-only";

/**
 * Sign in with Blob: Blob as an OpenID Connect provider for other sites (e.g. LernLabor).
 *
 * Flow: authorization code with PKCE. The app sends people to /oauth/authorize, Blob signs
 * them in and asks for consent (/oauth/consent), then redirects back with a one-time code
 * that the app swaps for tokens at /api/oauth/token.
 */

/** Scopes an app can ask for, in the order the consent screen lists them. */
export const SCOPES = ["openid", "profile", "email", "data", "offline_access"] as const;
export type Scope = (typeof SCOPES)[number];
export const isScope = (s: string): s is Scope => (SCOPES as readonly string[]).includes(s);

export const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour
export const ID_TOKEN_TTL = 60 * 60;
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days, renewed on every use
export const CODE_TTL = 2 * 60;

/** The public address of this Blob (the token issuer). Must not change once apps rely on it. */
export function issuer(request?: Request): string {
  const configured = process.env.BLOB_ISSUER || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/+$/, "");
  if (request) return new URL(request.url).origin;
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

/** The issuer inside server actions and server components (no Request object there). */
export async function currentIssuer(): Promise<string> {
  const configured = process.env.BLOB_ISSUER || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/+$/, "");
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return issuer();
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const endpoints = (iss: string) => ({
  authorization_endpoint: `${iss}/oauth/authorize`,
  token_endpoint: `${iss}/api/oauth/token`,
  userinfo_endpoint: `${iss}/api/oauth/userinfo`,
  revocation_endpoint: `${iss}/api/oauth/revoke`,
  jwks_uri: `${iss}/oauth/jwks`,
});

/** Where apps with the "data" scope keep their own data for a person (see lib/oauth/data.ts). */
export const dataEndpoint = (iss: string) => `${iss}/api/v1/data`;
