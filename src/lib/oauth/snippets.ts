/**
 * Copy-paste code for "Sign in with Blob", shared by the admin panel's Integration tab and the
 * public /developers page. Code comments come from the dictionaries so they follow the language.
 */

export type SnippetVars = { issuer: string; clientId: string; redirectUri: string };

/** The smallest working setup for a browser app (the SDK does PKCE, the popup and the tokens). */
export const sdkQuickStart = ({ issuer, clientId, redirectUri }: SnippetVars) => `<script type="module">
  import { BlobAuth } from "${issuer}/sdk/blob-auth.js";
  const blob = new BlobAuth({ clientId: "${clientId}", redirectUri: "${redirectUri}" });
  document.querySelector("#login").onclick = async () => { const user = await blob.signIn(); };
</script>`;

export type FullExampleNotes = { login: string; logout: string; finish: string; changes: string; signIn: string; token: string; button: string };

/** A complete page: finish redirects, react to sign-in and sign-out, call your API. */
export const sdkFullExample = ({ issuer, clientId, redirectUri }: SnippetVars, n: FullExampleNotes) => `<button id="login">${n.login}</button>
<button id="logout" hidden>${n.logout}</button>

<script type="module">
  import { BlobAuth } from "${issuer}/sdk/blob-auth.js";

  const blob = new BlobAuth({
    clientId: "${clientId}",
    redirectUri: "${redirectUri}",
  });

  // ${n.finish}
  await blob.handleRedirect();

  // ${n.changes}
  blob.onChange((user) => {
    document.querySelector("#login").hidden = !!user;
    document.querySelector("#logout").hidden = !user;
  });

  document.querySelector("#login").onclick = async () => {
    const user = await blob.signIn(); // ${n.signIn}
    console.log(user.name, user.email);
  };
  document.querySelector("#logout").onclick = () => blob.signOut();

  // ${n.token}
  const token = await blob.getAccessToken();

  // ${n.button}
  // document.body.append(blob.button());
</script>`;

export type ServerNotes = { start: string; exchange: string; refresh: string };

/** Authorization request a server app sends the browser to (with PKCE, which Blob recommends for everyone). */
export const authorizeExample = ({ issuer, clientId, redirectUri }: SnippetVars) =>
  `${issuer}/oauth/authorize?response_type=code
  &client_id=${encodeURIComponent(clientId)}
  &redirect_uri=${encodeURIComponent(redirectUri)}
  &scope=openid%20profile%20email
  &state=RANDOM_STATE
  &nonce=RANDOM_NONCE
  &code_challenge=BASE64URL_SHA256_OF_VERIFIER
  &code_challenge_method=S256`;

/** Code exchange on the server with HTTP Basic client authentication (client_secret_basic). */
export const curlExchange = ({ issuer, clientId, redirectUri }: SnippetVars, n: ServerNotes) => `# ${n.exchange}
curl -X POST "${issuer}/api/oauth/token" \\
  -u "${clientId}:$BLOB_CLIENT_SECRET" \\
  -d grant_type=authorization_code \\
  -d code="$CODE" \\
  -d redirect_uri="${redirectUri}" \\
  -d code_verifier="$CODE_VERIFIER"

# ${n.refresh}
curl -X POST "${issuer}/api/oauth/token" \\
  -u "${clientId}:$BLOB_CLIENT_SECRET" \\
  -d grant_type=refresh_token \\
  -d refresh_token="$REFRESH_TOKEN"`;

/** Example token response (shape only). */
export const tokenResponse = `{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiIsInR5cCI6ImF0K2p3dCJ9…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email offline_access",
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiIsInR5cCI6IkpXVCJ9…",
  "refresh_token": "blob_rt_…"
}`;
