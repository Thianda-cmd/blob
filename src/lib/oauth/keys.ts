import "server-only";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";

type KeyRow = { kid: string; alg: string; public_jwk: JWK; private_jwk: JWK; active: boolean; created_at: string; retired_at: string | null };

/** Retired keys stay published this long, so tokens they signed can still be verified. */
const RETIRED_GRACE_MS = 1000 * 60 * 60 * 24 * 2;
const CACHE_MS = 1000 * 60 * 5;

let cache: { at: number; rows: KeyRow[] } | null = null;

async function loadKeys(fresh = false): Promise<KeyRow[]> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const db = createAdminClient();
  const { data, error } = await db.from("oauth_keys").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`oauth_keys: ${error.message}`);
  cache = { at: Date.now(), rows: (data ?? []) as KeyRow[] };
  return cache.rows;
}

/** Creates a new RS256 signing key and makes it the one that signs from now on. */
export async function createSigningKey(): Promise<KeyRow> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
  const pub = await exportJWK(publicKey);
  const priv = await exportJWK(privateKey);
  const kid = (await calculateJwkThumbprint(pub)).slice(0, 16);
  const row = { kid, alg: "RS256", public_jwk: { ...pub, kid, alg: "RS256", use: "sig" }, private_jwk: { ...priv, kid, alg: "RS256" }, active: true };
  const db = createAdminClient();
  const { data, error } = await db.from("oauth_keys").insert(row).select("*").single();
  if (error) throw new Error(`oauth_keys insert: ${error.message}`);
  cache = null;
  return data as KeyRow;
}

/** Retires every older key once a new one exists (they stay in the JWKS for a grace period). */
export async function rotateSigningKey() {
  const fresh = await createSigningKey();
  const db = createAdminClient();
  await db.from("oauth_keys").update({ active: false, retired_at: new Date().toISOString() }).neq("kid", fresh.kid).eq("active", true);
  cache = null;
  return fresh.kid;
}

/** The key that signs new tokens (created on first use). */
export async function signingKey() {
  let row = (await loadKeys()).find((k) => k.active);
  if (!row) row = (await loadKeys(true)).find((k) => k.active) ?? (await createSigningKey());
  return { kid: row.kid, alg: row.alg, key: await importJWK(row.private_jwk, row.alg) };
}

/** Public keys for /oauth/jwks: the active ones and recently retired ones. */
export async function publicKeys(): Promise<JWK[]> {
  const now = Date.now();
  return (await loadKeys())
    .filter((k) => k.active || (k.retired_at && now - Date.parse(k.retired_at) < RETIRED_GRACE_MS))
    .map((k) => k.public_jwk);
}

/** Key rows for the admin panel (no private parts). */
export async function keyList() {
  return (await loadKeys(true)).map(({ kid, alg, active, created_at, retired_at }) => ({ kid, alg, active, created_at, retired_at }));
}
