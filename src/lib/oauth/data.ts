import "server-only";
import { decodeJwt } from "jose";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appByClientId, type OAuthApp } from "./apps";
import { issuer } from "./config";
import { corsFor, corsForAnyApp, json } from "./http";
import { activeGrant, effectiveScopes, issuedUnder, verifyAccessToken } from "./tokens";

/**
 * App data: apps keep small JSON values (e.g. LernLabor's learning progress) in the person's
 * Blob account, so they follow them to every device. Needs the "data" scope. Every value is
 * partitioned by (the app of the access token, the person); apps never see each other's data.
 *
 *   GET    /api/v1/data        list of keys
 *   GET    /api/v1/data/{key}  one value
 *   PUT    /api/v1/data/{key}  { value, version? }  version: omitted = overwrite, 0 = create only, n = only if still n
 *   DELETE /api/v1/data/{key}
 */

export const DATA_KEY = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
/**
 * Largest value, measured as compact UTF-8 JSON. Matches the check on oauth_app_data.size.
 * oauth_app_data_put also limits what Postgres stores (numbers like 1e308 are printed in full).
 */
export const MAX_VALUE_BYTES = 256 * 1024;
/** Most keys one app may keep per person. Enforced by oauth_app_data_put (0006). */
export const MAX_KEYS = 50;
/** Largest request body we read (the value plus its JSON wrapper, maybe pretty-printed). */
const MAX_BODY_BYTES = 1024 * 1024;
export const DATA_METHODS = "GET, PUT, DELETE, OPTIONS";

export type DataCaller = { app: OAuthApp; userId: string; cors: Record<string, string> };

/** Error responses carry CORS for the app's origins, so its browser code can read them. */
export const dataError = (caller: Pick<DataCaller, "cors">, status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  json({ error, ...extra }, status, { ...caller.cors, ...headers });

/** 204 for DELETE: no body, still never cached. */
export const noContent = (caller: Pick<DataCaller, "cors">) =>
  new NextResponse(null, { status: 204, headers: { ...caller.cors, "Cache-Control": "no-store", Pragma: "no-cache" } });

/**
 * Checks the Bearer access token: valid, app exists and is switched on, the person still allows
 * the app, and both the token and the app have the "data" scope. Returns who is calling, or the
 * error response to send.
 */
export async function authenticate(request: Request): Promise<DataCaller | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : null;
  const claims = token ? await verifyAccessToken(token, issuer(request)) : null;
  // CORS on errors too (an expired token must not look like a network failure to the app). An
  // unverified token only picks which app's origins may read the error; it grants nothing.
  const app = await appByClientId(claims?.client_id ?? unverifiedClientId(token));
  const cors = app ? corsFor(request, app) : await corsForAnyApp(request);
  const invalid = () => dataError({ cors }, 401, "invalid_token", {}, { "WWW-Authenticate": 'Bearer error="invalid_token"' });

  if (!claims || !app || app.client_id !== claims.client_id || app.disabled) return invalid();
  // Revoked, or issued before the person connected the app again: the token is dead for good.
  const grant = await activeGrant(claims.sub, app.id);
  if (!grant || !issuedUnder(claims, grant)) return invalid();
  // "data" must still be in the token, in what the person allows and in what the app may ask for.
  if (!effectiveScopes(claims, grant, app).includes("data")) {
    return dataError({ cors }, 403, "insufficient_scope", {}, { "WWW-Authenticate": 'Bearer error="insufficient_scope", scope="data"' });
  }
  return { app, userId: claims.sub, cors };
}

/**
 * Wraps a data API handler so that unexpected failures still answer with JSON and CORS headers.
 * Without CORS the app's browser code would only see a network error and keep retrying.
 */
export function guarded<R extends Request, A extends unknown[]>(handler: (request: R, ...rest: A) => Promise<Response>) {
  return async (request: R, ...rest: A): Promise<Response> => {
    try {
      return await handler(request, ...rest);
    } catch (error) {
      console.error("data API", request.method, new URL(request.url).pathname, error);
      return json({ error: "server_error", error_description: "Something went wrong in Blob. Try again later." }, 500, await corsForAnyApp(request));
    }
  };
}

/** JSON 405 for methods the data API doesn't have (instead of Next's empty answer without CORS). */
export const methodNotAllowed = (allow: string) =>
  guarded(async (request: Request) => json({ error: "method_not_allowed", error_description: `Allowed: ${allow}.` }, 405, { ...(await corsForAnyApp(request)), Allow: allow }));

function unverifiedClientId(token: string | null): string | null {
  if (!token) return null;
  try {
    const id = decodeJwt(token).client_id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export const validKey = (key: string | undefined): key is string => typeof key === "string" && DATA_KEY.test(key);

type Row = { key: string; value: unknown; version: number; size: number; updated_at: string };

export async function listItems({ app, userId }: DataCaller) {
  const { data, error } = await createAdminClient()
    .from("oauth_app_data")
    .select("key, version, size, updated_at")
    .eq("app_id", app.id)
    .eq("user_id", userId)
    .order("key");
  if (error) throw new Error(`oauth_app_data: ${error.message}`);
  return (data ?? []) as Pick<Row, "key" | "version" | "size" | "updated_at">[];
}

export async function getItem({ app, userId }: DataCaller, key: string) {
  const { data, error } = await createAdminClient()
    .from("oauth_app_data")
    .select("key, value, version, updated_at")
    .eq("app_id", app.id)
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`oauth_app_data: ${error.message}`);
  return (data as Pick<Row, "key" | "value" | "version" | "updated_at"> | null) ?? null;
}

export async function deleteItem({ app, userId }: DataCaller, key: string) {
  const { error } = await createAdminClient().from("oauth_app_data").delete().eq("app_id", app.id).eq("user_id", userId).eq("key", key);
  if (error) throw new Error(`oauth_app_data: ${error.message}`);
}

type PutBody = { value: unknown; version: number | null; size: number };

/** Reads and checks a PUT body `{ value, version? }`. Returns the parsed body or an error response. */
export async function readPutBody(request: Request, caller: DataCaller): Promise<PutBody | NextResponse> {
  const bad = (description: string) => dataError(caller, 400, "invalid_request", { error_description: description });
  const tooLarge = () => dataError(caller, 413, "too_large", { error_description: `The value must be at most ${MAX_VALUE_BYTES} bytes as JSON.` });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return tooLarge();
  let text: string;
  try {
    text = await request.text();
  } catch {
    return bad("Couldn't read the request body.");
  }
  if (text.length > MAX_BODY_BYTES) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return bad("The body must be JSON: { \"value\": …, \"version\"?: number }.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("value" in body)) return bad("The body must be an object with a \"value\".");
  const { value, version: rawVersion } = body as { value: unknown; version?: unknown };
  // A top-level null can't be stored (DELETE the key instead); nulls inside objects are fine.
  if (value === null || value === undefined) return bad("value can't be null. Use DELETE to remove a key.");
  let version: number | null = null;
  if (rawVersion !== undefined && rawVersion !== null) {
    if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 0 || rawVersion > 2_147_483_647) {
      return bad("version must be a whole number ≥ 0.");
    }
    version = rawVersion;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return bad("The value can't be stored as JSON.");
  }
  const size = Buffer.byteLength(serialized, "utf8");
  if (size > MAX_VALUE_BYTES) return tooLarge();
  // Half of a UTF-16 surrogate pair (in a string or a key) has no UTF-8 form, so Postgres refuses it.
  if (LONE_SURROGATE.test(serialized)) return bad("Text in the value must be valid Unicode (no lone surrogates).");
  return { value, version, size };
}

/**
 * JSON.stringify writes characters raw, except control characters and lone surrogates, which it
 * escapes as \uXXXX. So an escape \ud800–\udfff that isn't itself escaped (an odd run of
 * backslashes before the u) is a lone surrogate.
 */
const LONE_SURROGATE = /(?<!\\)(?:\\\\)*\\ud[89a-f][0-9a-f]{2}/i;

export type PutResult =
  | { kind: "ok"; key: string; version: number; updated_at: string }
  | { kind: "conflict"; current: { key: string; value: unknown; version: number; updated_at: string | null } }
  | { kind: "too_many_keys" }
  | { kind: "too_large" }
  | { kind: "invalid"; description: string };

/**
 * Writes a value with optimistic concurrency. oauth_app_data_put (0006_oauth_app_data_limits.sql)
 * runs one write per app and person at a time and checks the key limit and the stored size there,
 * so parallel requests can't get past them.
 */
export async function putItem(caller: DataCaller, key: string, body: PutBody): Promise<PutResult> {
  const { app, userId } = caller;
  const { data, error } = await createAdminClient().rpc("oauth_app_data_put", {
    p_app_id: app.id,
    p_user_id: userId,
    p_key: key,
    p_value: body.value,
    p_size: body.size,
    p_expected_version: body.version,
  });
  if (error) {
    if (error.code === "BLB01") return { kind: "too_many_keys" };
    if (error.code === "BLB02") return { kind: "too_large" };
    // Values Postgres' jsonb refuses (e.g. "\u0000" in a string), that nest too deeply, or that
    // PostgREST can't read as JSON.
    if (error.code?.startsWith("22") || error.code === "54001" || error.code === "PGRST102") return { kind: "invalid", description: "The value can't be stored as JSON." };
    throw new Error(`oauth_app_data_put: ${error.message}`);
  }
  const row = (data as Row[] | null)?.[0];
  if (row) return { kind: "ok", key: row.key, version: row.version, updated_at: row.updated_at };

  // Someone else wrote in between (or the key doesn't exist / already exists): send the current state.
  const current = await getItem(caller, key);
  return { kind: "conflict", current: current ?? { key, value: null, version: 0, updated_at: null } };
}

/**
 * For Settings › Connected apps: how much each app keeps for this person ({ app_id → keys, bytes }).
 * Data stays when access is removed, so people need to see it and be able to delete it.
 */
export async function appDataUsage(userId: string): Promise<Map<string, { keys: number; bytes: number }>> {
  const { data, error } = await createAdminClient().from("oauth_app_data").select("app_id, size").eq("user_id", userId);
  if (error) throw new Error(`oauth_app_data: ${error.message}`);
  const out = new Map<string, { keys: number; bytes: number }>();
  for (const row of data ?? []) {
    const entry = out.get(row.app_id) ?? { keys: 0, bytes: 0 };
    entry.keys += 1;
    entry.bytes += row.size as number;
    out.set(row.app_id, entry);
  }
  return out;
}

/** Deletes everything one app keeps for one person (Settings › Connected apps). Returns how many keys went. */
export async function deleteAppData(userId: string, appId: string): Promise<number> {
  const { error, count } = await createAdminClient().from("oauth_app_data").delete({ count: "exact" }).eq("user_id", userId).eq("app_id", appId);
  if (error) throw new Error(`oauth_app_data: ${error.message}`);
  return count ?? 0;
}
