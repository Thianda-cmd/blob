/**
 * Sign in with Blob: a tiny browser SDK (no dependencies).
 *
 *   import { BlobAuth } from "https://blob.bojes.org/sdk/blob-auth.js";
 *   const blob = new BlobAuth({ clientId: "…", redirectUri: location.origin + "/blob-callback.html" });
 *   await blob.handleRedirect();          // once on page load (finishes full-page or other-tab sign-ins)
 *   const user = await blob.signIn();     // opens Blob in a popup, resolves with the user
 *   blob.onChange((user) => render(user));
 *   await blob.getAccessToken();          // for calling Blob's userinfo or your own API
 *   await blob.signOut();
 *
 * The redirect URI must be registered in Blob's admin panel and serve the small callback page
 * (https://blob.bojes.org/sdk/blob-callback.html) on your own domain.
 *
 * Flow: OAuth 2.0 authorization code with PKCE (S256) + OpenID Connect. Tokens live in
 * localStorage; refresh tokens rotate, guarded by a cross-tab lock.
 */

const VERSION = "1.0.0";
const SCRIPT_ORIGIN = (() => {
  try {
    return new URL(import.meta.url).origin;
  } catch {
    return "https://blob.bojes.org";
  }
})();
const PENDING = "blob-auth:pending:";
const CALLBACK = "blob-auth:callback";
const SKEW = 60; // seconds before expiry we refresh

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (text) => b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const decodeJwt = (jwt) => {
  const [h, p] = jwt.split(".");
  const text = (s) => new TextDecoder().decode(fromB64url(s));
  return { header: JSON.parse(text(h)), payload: JSON.parse(text(p)) };
};
const now = () => Math.floor(Date.now() / 1000);

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export class BlobAuthError extends Error {
  constructor(code, description) {
    super(description || code);
    this.name = "BlobAuthError";
    this.code = code;
  }
}

export class BlobAuth {
  /**
   * @param {{ clientId: string, redirectUri: string, issuer?: string, scope?: string, locale?: "de" | "en", storage?: Storage }} options
   */
  constructor(options) {
    if (!options?.clientId || !options?.redirectUri) throw new Error("BlobAuth needs clientId and redirectUri");
    this.clientId = options.clientId;
    this.redirectUri = options.redirectUri;
    this.issuer = (options.issuer || SCRIPT_ORIGIN).replace(/\/+$/, "");
    this.scope = options.scope || "openid profile email offline_access";
    this.locale = options.locale;
    this.storage = options.storage || window.localStorage;
    this.key = `blob-auth:${this.clientId}`;
    this.listeners = new Set();
    this.discovery = null;
    this.waiting = null; // the signIn() in progress: { state, resolve, reject, popup, timer }
    this.refreshing = null;

    window.addEventListener("message", (e) => this.#onMessage(e));
    // Another tab signed in or out (e.g. after confirming a new account's email there).
    window.addEventListener("storage", (e) => {
      if (e.key !== this.key) return;
      this.#emit();
      // The popup's sign-in finished in another tab: close the popup and resolve signIn().
      if (this.waiting && this.user) this.#settle(null, this.user);
    });
  }

  static version = VERSION;

  /** The signed-in person ({ sub, name, given_name, email, picture, locale }) or null. */
  get user() {
    return this.#session()?.user ?? null;
  }

  get signedIn() {
    return !!this.#session();
  }

  /** Calls `listener(user)` now and whenever someone signs in or out (in any tab). Returns an unsubscribe function. */
  onChange(listener) {
    this.listeners.add(listener);
    listener(this.user);
    return () => this.listeners.delete(listener);
  }

  /**
   * Opens Blob to sign in. Resolves with the user, rejects with BlobAuthError("access_denied")
   * when they cancel, or "popup_closed" when the window is closed.
   * @param {{ prompt?: "login" | "consent" | "select_account", loginHint?: string, popup?: boolean }} [opts]
   */
  async signIn(opts = {}) {
    if (this.waiting) {
      this.waiting.popup?.focus();
      return this.waiting.promise;
    }
    const config = await this.#config();
    const state = randomString(16);
    const nonce = randomString(16);
    const verifier = randomString(48);
    const challenge = await sha256(verifier);
    const url = new URL(config.authorization_endpoint);
    const params = {
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ui_locales: this.locale,
      prompt: opts.prompt,
      login_hint: opts.loginHint,
    };
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    // Kept in localStorage so a different tab (email confirmation link) can finish the sign-in.
    this.storage.setItem(PENDING + state, JSON.stringify({ verifier, nonce, clientId: this.clientId, returnTo: location.href, at: Date.now() }));
    this.#cleanupPending();

    const popup = opts.popup === false ? null : openCentered(url.toString());
    if (!popup) {
      // Popup blocked (or not wanted): a normal redirect; handleRedirect() finishes on return.
      location.assign(url.toString());
      return new Promise(() => {});
    }
    let resolve, reject;
    const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
    const timer = setInterval(() => {
      if (popup.closed && this.waiting?.state === state) {
        // Give a just-delivered message a moment to arrive.
        setTimeout(() => this.waiting?.state === state && this.#settle(new BlobAuthError("popup_closed", "The sign-in window was closed.")), 400);
      }
    }, 500);
    this.waiting = { state, resolve, reject, popup, timer, promise };
    return promise;
  }

  /**
   * Finishes a sign-in that came back without the popup: a full-page redirect, or another tab
   * (e.g. after confirming a new account's email). Call once on page load. Resolves with the
   * user when it finished one, otherwise null.
   */
  async handleRedirect() {
    let callback = readJson(this.storage, CALLBACK);
    const here = new URL(location.href);
    if (!callback && here.searchParams.get("state") && (here.searchParams.get("code") || here.searchParams.get("error"))) {
      callback = { url: here.toString() };
    }
    if (!callback) return null;
    const url = new URL(callback.url);
    const pending = readJson(this.storage, PENDING + url.searchParams.get("state"));
    if (!pending) {
      this.storage.removeItem(CALLBACK); // stale or already handled
      return null;
    }
    if (pending.clientId !== this.clientId) return null;
    this.storage.removeItem(CALLBACK);
    if (here.searchParams.get("code")) {
      here.searchParams.delete("code");
      here.searchParams.delete("state");
      here.searchParams.delete("iss");
      history.replaceState(history.state, "", here.toString());
    }
    try {
      const user = await this.#finish(url);
      if (this.waiting) this.#settle(null, user);
      return user;
    } catch (error) {
      if (this.waiting) this.#settle(error);
      return null;
    }
  }

  /** A valid access token (refreshed when needed), or null when signed out. */
  async getAccessToken() {
    const session = this.#session();
    if (!session) return null;
    if (session.expires_at - SKEW > now()) return session.access_token;
    if (!session.refresh_token) {
      this.#clear();
      return null;
    }
    this.refreshing ??= this.#refresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** Fresh details from Blob (name, picture…), also updating `user`. */
  async refreshUser() {
    const token = await this.getAccessToken();
    if (!token) return null;
    const config = await this.#config();
    const res = await fetch(config.userinfo_endpoint, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return this.user;
    const user = await res.json();
    const session = this.#session();
    if (session) this.#save({ ...session, user });
    return user;
  }

  /** Signs out of this site (Blob itself stays signed in). */
  async signOut() {
    const session = this.#session();
    this.#clear();
    if (session?.refresh_token) {
      try {
        const config = await this.#config();
        await fetch(config.revocation_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: session.refresh_token, token_type_hint: "refresh_token", client_id: this.clientId }),
        });
      } catch {
        /* signed out locally either way */
      }
    }
  }

  /** A ready-made "Sign in with Blob" button. */
  button(opts = {}) {
    const de = (opts.locale || this.locale || document.documentElement.lang || "de").startsWith("de");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "blob-signin";
    b.innerHTML = `${BLOB_MARK}<span>${opts.label || (de ? "Mit Blob anmelden" : "Sign in with Blob")}</span>`;
    injectStyles();
    b.addEventListener("click", () => this.signIn().catch(() => {}));
    return b;
  }

  // ---------------------------------------------------------------------------------------

  async #config() {
    if (this.discovery) return this.discovery;
    const res = await fetch(`${this.issuer}/.well-known/openid-configuration`);
    if (!res.ok) throw new BlobAuthError("discovery_failed", "Couldn't reach Blob.");
    this.discovery = await res.json();
    return this.discovery;
  }

  #session() {
    return readJson(this.storage, this.key);
  }

  #save(session) {
    this.storage.setItem(this.key, JSON.stringify(session));
    this.#emit();
  }

  #clear() {
    this.storage.removeItem(this.key);
    this.#emit();
  }

  #emit() {
    const user = this.user;
    for (const l of this.listeners) {
      try {
        l(user);
      } catch (e) {
        console.error(e);
      }
    }
  }

  #settle(error, user) {
    const w = this.waiting;
    if (!w) return;
    this.waiting = null;
    clearInterval(w.timer);
    try {
      w.popup?.close();
    } catch {
      /* ignore */
    }
    if (error) w.reject(error);
    else w.resolve(user);
  }

  #onMessage(event) {
    if (event.origin !== location.origin || event.data?.type !== "blob-auth:callback") return;
    const url = new URL(event.data.url);
    if (!this.waiting || url.searchParams.get("state") !== this.waiting.state) return;
    this.#finish(url).then(
      (user) => this.#settle(null, user),
      (error) => this.#settle(error),
    );
  }

  async #finish(url) {
    const state = url.searchParams.get("state");
    const pending = readJson(this.storage, PENDING + state);
    this.storage.removeItem(PENDING + state);
    if (!pending) throw new BlobAuthError("invalid_state", "Unknown or expired sign-in.");
    const error = url.searchParams.get("error");
    if (error) throw new BlobAuthError(error, url.searchParams.get("error_description") || error);
    const config = await this.#config();
    const iss = url.searchParams.get("iss");
    if (iss && iss !== config.issuer) throw new BlobAuthError("invalid_issuer", "The response came from a different issuer.");
    const code = url.searchParams.get("code");
    if (!code) throw new BlobAuthError("invalid_response", "No code in the response.");

    const tokens = await this.#token({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri, client_id: this.clientId, code_verifier: pending.verifier });
    const user = await this.#checkIdToken(tokens.id_token, pending.nonce);
    this.#save(sessionFrom(tokens, user));
    return user;
  }

  async #refresh() {
    const run = async () => {
      // Another tab may have refreshed while we waited for the lock.
      const session = this.#session();
      if (!session) return null;
      if (session.expires_at - SKEW > now()) return session.access_token;
      try {
        const tokens = await this.#token({ grant_type: "refresh_token", refresh_token: session.refresh_token, client_id: this.clientId });
        const user = tokens.id_token ? await this.#checkIdToken(tokens.id_token) : session.user;
        this.#save(sessionFrom(tokens, user, session));
        return tokens.access_token;
      } catch (error) {
        if (error instanceof BlobAuthError && error.code === "invalid_grant") this.#clear();
        return null;
      }
    };
    // One refresh at a time across tabs: rotating tokens must not be used twice.
    return navigator.locks?.request ? navigator.locks.request(`blob-auth-refresh:${this.clientId}`, run) : run();
  }

  async #token(body) {
    const config = await this.#config();
    const res = await fetch(config.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new BlobAuthError(data.error || "token_error", data.error_description);
    return data;
  }

  /** Verifies the ID token's signature (RS256 via the JWKS), issuer, audience, expiry and nonce. */
  async #checkIdToken(idToken, nonce) {
    if (!idToken) throw new BlobAuthError("invalid_response", "No ID token.");
    const config = await this.#config();
    const { header, payload } = decodeJwt(idToken);
    if (header.alg !== "RS256") throw new BlobAuthError("invalid_token", "Unexpected algorithm.");
    const { keys } = await (await fetch(config.jwks_uri)).json();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) throw new BlobAuthError("invalid_token", "Unknown signing key.");
    const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const [h, p, s] = idToken.split(".");
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
    if (!valid) throw new BlobAuthError("invalid_token", "Bad signature.");
    if (payload.iss !== config.issuer) throw new BlobAuthError("invalid_token", "Wrong issuer.");
    if (payload.aud !== this.clientId && !(Array.isArray(payload.aud) && payload.aud.includes(this.clientId))) throw new BlobAuthError("invalid_token", "Wrong audience.");
    if (payload.exp < now() - 300) throw new BlobAuthError("invalid_token", "Expired.");
    if (nonce && payload.nonce !== nonce) throw new BlobAuthError("invalid_token", "Nonce mismatch.");
    const { sub, name, given_name, email, email_verified, picture, locale } = payload;
    return { sub, name, given_name, email, email_verified, picture, locale };
  }

  #cleanupPending() {
    for (let i = this.storage.length - 1; i >= 0; i--) {
      const key = this.storage.key(i);
      if (!key?.startsWith(PENDING)) continue;
      const item = readJson(this.storage, key);
      if (!item || Date.now() - item.at > 1000 * 60 * 60) this.storage.removeItem(key);
    }
  }
}

function sessionFrom(tokens, user, previous) {
  return {
    access_token: tokens.access_token,
    expires_at: now() + (tokens.expires_in || 3600),
    refresh_token: tokens.refresh_token || previous?.refresh_token || null,
    scope: tokens.scope,
    user,
  };
}

function openCentered(url) {
  const w = 480;
  const h = 760;
  const left = Math.max(0, (window.screenX ?? 0) + (window.outerWidth - w) / 2);
  const top = Math.max(0, (window.screenY ?? 0) + (window.outerHeight - h) / 2);
  return window.open(url, "blob-auth", `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
}

const BLOB_MARK = `<svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true"><defs><radialGradient id="blob-auth-g" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#a78bfa"/><stop offset=".55" stop-color="#6d3df5"/><stop offset="1" stop-color="#4c1fd1"/></radialGradient></defs><path d="M16 4.5c6.6 0 11.5 5.2 11.5 12.1 0 6.2-4.9 10.9-11.5 10.9S4.5 22.8 4.5 16.6C4.5 9.7 9.4 4.5 16 4.5Z" fill="url(#blob-auth-g)"/><ellipse cx="12.4" cy="15.6" rx="1.7" ry="2.1" fill="#1d1030"/><ellipse cx="19.6" cy="15.6" rx="1.7" ry="2.1" fill="#1d1030"/><path d="M13.6 20.2c1.4 1.2 3.4 1.2 4.8 0" stroke="#1d1030" stroke-width="1.4" fill="none" stroke-linecap="round"/><ellipse cx="11" cy="9.8" rx="2.4" ry="1.3" fill="#fff" opacity=".55"/></svg>`;

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `.blob-signin{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:10px;height:44px;padding:0 18px 0 14px;border-radius:12px;background:#6d3df5;color:#fff;font:600 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;box-shadow:inset 0 1px 0 rgb(255 255 255/.25),0 1px 2px rgb(0 0 0/.12);transition:background .15s,transform .1s}.blob-signin:hover{background:#5326d6}.blob-signin:active{transform:scale(.97)}.blob-signin:focus-visible{outline:2px solid #b9a2ff;outline-offset:2px}.blob-signin svg{flex-shrink:0;filter:drop-shadow(0 1px 1px rgb(0 0 0/.15))}`;
  document.head.append(style);
}
