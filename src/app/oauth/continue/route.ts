import { NextResponse, type NextRequest } from "next/server";
import { approve, loadRequest, needsConsent } from "@/lib/oauth/authorize";
import { issuer } from "@/lib/oauth/config";
import { sessionUser } from "@/lib/oauth/session";

/**
 * Where "Sign in with Blob" picks up after signing in (or confirming a new account's email):
 * straight back to the app when nothing needs asking, otherwise the consent screen.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("request");
  const here = `/oauth/continue?request=${id}`;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const pending = await loadRequest(id);
  if (!pending || pending.expired || pending.completed) return to(`/oauth/consent?request=${id}`);

  const user = await sessionUser();
  if (!user) return to(`/login?next=${encodeURIComponent(here)}`);

  if (!pending.forceConsent && !(await needsConsent(pending.app, user.id, pending.scopes))) {
    return NextResponse.redirect(await approve(pending, user.id, issuer(request), user.authTime), 303);
  }
  return to(`/oauth/consent?request=${pending.id}`);
}
