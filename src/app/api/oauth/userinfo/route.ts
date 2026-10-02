import type { NextRequest } from "next/server";
import { appByClientId } from "@/lib/oauth/apps";
import { issuer } from "@/lib/oauth/config";
import { corsFor, json, preflight } from "@/lib/oauth/http";
import { activeGrant, effectiveScopes, issuedUnder, userClaims, verifyAccessToken } from "@/lib/oauth/tokens";

/** OIDC UserInfo: the signed-in person's details for a valid access token. */
async function handle(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const claims = token ? await verifyAccessToken(token, issuer(request)) : null;
  const app = claims ? await appByClientId(claims.client_id) : null;
  const cors = corsFor(request, app);
  const deny = (error: string) => json({ error }, 401, { ...cors, "WWW-Authenticate": `Bearer error="${error}"` });

  if (!claims || !app || app.disabled) return deny("invalid_token");
  const grant = await activeGrant(claims.sub, app.id);
  if (!grant || !issuedUnder(claims, grant)) return deny("invalid_token");
  if (!claims.scope.split(" ").includes("openid")) return json({ error: "insufficient_scope" }, 403, { ...cors, "WWW-Authenticate": 'Bearer error="insufficient_scope"' });
  // Only what the person (still) allows: e.g. no email when they reconnected without it.
  const user = await userClaims(claims.sub, effectiveScopes(claims, grant, app));
  if (!user) return deny("invalid_token");
  return json(user, 200, cors);
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = (request: NextRequest) => preflight(request, "GET, POST, OPTIONS");
