// Signing in the Blob app through the browser, where you're already signed in (like signing in a
// TV app on your phone). Pieces used on both sides:
//
// 1. The app makes a secret (the verifier) and keeps it; it opens /auth/app/approve in the system
//    browser with only the verifier's SHA-256 (the challenge) and a random state.
// 2. In the browser you confirm. The server keeps the hash of a one-time code (2 minutes) with your
//    account and the challenge, and the browser hands the code to the app: org.bojes.blob://auth/app.
// 3. The app (/auth/app) checks the state is its own and trades code + verifier for a session. The
//    code works once, and only together with the verifier, so a code caught on the way (another
//    program that registered the link scheme) is useless.

/** Where the app keeps its half while the browser is open (the app's own storage). */
export const APP_SIGN_IN_KEY = "blob-app-signin";
/** How long a code from the browser stays valid. */
export const CODE_TTL_MS = 2 * 60_000;
/** How long the app waits for the browser. */
export const REQUEST_TTL_MS = 10 * 60_000;

export type AppSignInRequest = { state: string; verifier: string; at: number; next: string };

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const randomToken = (bytes: number) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** PKCE S256: base64url(SHA-256(verifier)). */
export const challengeOf = async (verifier: string) => b64url(await sha256(verifier));

export const isChallenge = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);
export const isState = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(s);
export const isCode = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);
export const isVerifier = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(s);

/** The app's platform, as the approve page names it. */
export type AppDevice = "windows" | "macos" | "linux" | "android" | "ios";
export const isDevice = (s: unknown): s is AppDevice => s === "windows" || s === "macos" || s === "linux" || s === "android" || s === "ios";
