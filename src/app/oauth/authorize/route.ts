import { NextResponse, type NextRequest } from "next/server";
import { fromUiLocales, isLocale, LOCALE_COOKIE, UI_LOCALE_COOKIE, UI_LOCALE_MAX_AGE } from "@/i18n/config";
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

/**
 * ui_locales (OIDC Core §3.1.2.1): the app's language for login, sign-up and consent, unless the
 * person chose one in Blob. Kept in a short-lived cookie so it lasts through every page of the
 * sign-in (also /login?next=…); a request without it goes back to the browser's language.
 */
function withUiLocale(response: NextResponse, request: NextRequest, params: URLSearchParams) {
  if (isLocale(request.cookies.get(LOCALE_COOKIE)?.value)) return response;
  const locale = fromUiLocales(params.get("ui_locales"));
  if (locale) response.cookies.set(UI_LOCALE_COOKIE, locale, { path: "/", maxAge: UI_LOCALE_MAX_AGE, sameSite: "lax", httpOnly: true });
  else if (request.cookies.has(UI_LOCALE_COOKIE)) response.cookies.delete(UI_LOCALE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return withUiLocale(await handle(request, params), request, params);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form) if (typeof v === "string") params.set(k, v);
  return withUiLocale(await handle(request, params), request, params);
}
