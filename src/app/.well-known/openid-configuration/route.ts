import { NextResponse } from "next/server";
import { dataEndpoint, endpoints, issuer, SCOPES } from "@/lib/oauth/config";

/** OpenID Connect discovery: everything an app needs to set up "Sign in with Blob". */
export function GET(request: Request) {
  const iss = issuer(request);
  return NextResponse.json(
    {
      issuer: iss,
      ...endpoints(iss),
      scopes_supported: SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
      revocation_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
      code_challenge_methods_supported: ["S256"],
      claims_supported: ["sub", "iss", "aud", "exp", "iat", "auth_time", "nonce", "name", "given_name", "picture", "locale", "updated_at", "email", "email_verified"],
      prompt_values_supported: ["none", "login", "consent", "select_account"],
      ui_locales_supported: ["de", "en"],
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${iss}/developers`,
      // Not part of OpenID Connect: Blob's API for apps' own data (scope "data").
      blob_data_endpoint: dataEndpoint(iss),
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  );
}
