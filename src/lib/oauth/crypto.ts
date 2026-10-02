import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** URL-safe random string, e.g. for codes and refresh tokens. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Codes, refresh tokens and secrets are only ever stored as SHA-256 hashes. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Compares two hex hashes without leaking timing. */
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** PKCE (RFC 7636): BASE64URL(SHA256(verifier)) must equal the challenge sent with the request. */
export function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Readable client ids: "lernlabor_k3f8d2x9qa". */
export function newClientId(name: string) {
  const slug =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "app";
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const tail = Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
  return `${slug}_${tail}`;
}

/** A client secret, shown once. Only its hash and last four characters are kept. */
export function newClientSecret() {
  const secret = `blob_secret_${randomToken(32)}`;
  return { secret, hash: sha256(secret), hint: secret.slice(-4) };
}
