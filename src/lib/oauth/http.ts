import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appOrigins, type OAuthApp } from "./apps";

/** JSON for token/userinfo responses: never cached (RFC 6749 §5.1). */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache", ...headers } });
}

/** OAuth error response (RFC 6749 §5.2). */
export const oauthError = (error: string, description: string, status = 400, headers: Record<string, string> = {}) =>
  json({ error, error_description: description }, status, headers);

/** CORS headers when the request comes from one of the app's own origins. */
export function corsFor(request: Request, app: Pick<OAuthApp, "redirect_uris" | "allowed_origins"> | null): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !app || !appOrigins(app).includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

/** Preflight: allowed when the origin belongs to any app that is switched on. */
export async function preflight(request: Request, methods: string) {
  const origin = request.headers.get("origin");
  if (!origin) return new NextResponse(null, { status: 204 });
  const { data } = await createAdminClient().from("oauth_apps").select("redirect_uris, allowed_origins").eq("disabled", false);
  const ok = (data ?? []).some((app) => appOrigins(app).includes(origin));
  if (!ok) return new NextResponse(null, { status: 204, headers: { Vary: "Origin" } });
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

/** Reads client credentials: HTTP Basic (client_secret_basic) or form fields (client_secret_post / none). */
export function clientCredentials(request: Request, form: URLSearchParams) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [id, ...secret] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
      return { clientId: decodeURIComponent(id), clientSecret: decodeURIComponent(secret.join(":")), basic: true };
    } catch {
      return { clientId: null, clientSecret: null, basic: true };
    }
  }
  return { clientId: form.get("client_id"), clientSecret: form.get("client_secret"), basic: false };
}

/** Body as form fields (the standard) or JSON (convenient for some clients). */
export async function readForm(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) if (typeof v === "string") out.set(k, v);
    return out;
  }
  const text = await request.text();
  return new URLSearchParams(text);
}
