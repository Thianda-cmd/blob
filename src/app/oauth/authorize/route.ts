import { NextResponse, type NextRequest } from "next/server";
import { approve, checkAuthorizeRequest, loadRequest, needsConsent, readAuthorizeParams, redirectWith, saveRequest } from "@/lib/oauth/authorize";
import { issuer } from "@/lib/oauth/config";
import { sessionUser } from "@/lib/oauth/session";

/**
 * The authorization endpoint. Apps send people here; Blob checks the request, signs them in
 * (/login), asks for consent (/oauth/consent) and redirects back with a one-time code.
 */
async function handle(request: NextRequest, params: URLSearchParams) {
  const iss = issuer(request);
  const checked = await checkAuthorizeRequest(readAuthorizeParams(params), iss);
  const to = (url: string) => NextResponse.redirect(url, 303);

  if (checked.kind === "fatal") return to(new URL(`/oauth/error?reason=${checked.reason}`, request.url).toString());
  if (checked.kind === "redirect") return to(checked.url);

  const user = await sessionUser();
  const forcePrompt = checked.prompt.some((p) => p === "consent" || p === "login" || p === "select_account");

  if (checked.prompt.includes("none")) {
    if (!user) return to(redirectWith(checked.redirectUri, { error: "login_required", state: checked.state }, iss));
    if (await needsConsent(checked.app, user.id, checked.scopes)) {
      return to(redirectWith(checked.redirectUri, { error: "consent_required", state: checked.state }, iss));
    }
  }

  const id = await saveRequest(checked);

  // Already signed in and already allowed (or a trusted app): straight back with a code.
  if (user && !forcePrompt && !(await needsConsent(checked.app, user.id, checked.scopes))) {
    const pending = await loadRequest(id);
    if (pending) return to(await approve(pending, user.id, iss, user.authTime));
  }

  if (!user) return to(new URL(`/login?next=${encodeURIComponent(`/oauth/continue?request=${id}`)}`, request.url).toString());
  return to(new URL(`/oauth/consent?request=${id}`, request.url).toString());
}

export async function GET(request: NextRequest) {
  return handle(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form) if (typeof v === "string") params.set(k, v);
  return handle(request, params);
}
