import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appByClientId, secretMatches } from "@/lib/oauth/apps";
import { sha256 } from "@/lib/oauth/crypto";
import { clientCredentials, corsFor, json, oauthError, preflight, readForm } from "@/lib/oauth/http";
import { logEvent } from "@/lib/oauth/tokens";

/**
 * Token revocation (RFC 7009), used when someone signs out of an app. Revoking a refresh token
 * ends its whole family. Access tokens are short-lived JWTs and simply expire.
 */
export async function POST(request: NextRequest) {
  const form = await readForm(request);
  const { clientId, clientSecret } = clientCredentials(request, form);
  const app = await appByClientId(clientId);
  const cors = corsFor(request, app);
  if (!app) return oauthError("invalid_client", "Unknown client_id.", 401, cors);
  if (app.confidential && !secretMatches(app, clientSecret)) return oauthError("invalid_client", "Client authentication failed.", 401, cors);

  const token = form.get("token");
  if (token) {
    const db = createAdminClient();
    const { data } = await db.from("oauth_refresh_tokens").select("family, user_id, app_id").eq("token_hash", sha256(token)).maybeSingle();
    if (data && data.app_id === app.id) {
      await db.from("oauth_refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("family", data.family).is("revoked_at", null);
      await logEvent("revoked", app.id, data.user_id, "signed out of the app");
    }
  }
  // Always 200, so the response doesn't reveal whether a token existed.
  return json({}, 200, cors);
}

export const OPTIONS = (request: NextRequest) => preflight(request, "POST, OPTIONS");
