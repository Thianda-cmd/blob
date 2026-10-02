import type { NextRequest } from "next/server";
import { authenticate, DATA_METHODS, dataError, deleteItem, getItem, MAX_KEYS, noContent, putItem, readPutBody, validKey } from "@/lib/oauth/data";
import { json, preflight } from "@/lib/oauth/http";

type Ctx = RouteContext<"/api/v1/data/[key]">;

const badKey = "key must match ^[a-z0-9][a-z0-9_.-]{0,63}$.";

/** One value this app keeps for the signed-in person. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const caller = await authenticate(request);
  if (caller instanceof Response) return caller;
  const { key } = await ctx.params;
  if (!validKey(key)) return dataError(caller, 400, "invalid_request", { error_description: badKey });
  const item = await getItem(caller, key);
  if (!item) return dataError(caller, 404, "not_found");
  return json(item, 200, caller.cors);
}

/** Stores a value: `{ value, version? }`. version omitted = overwrite, 0 = create only, n = only if still n. */
export async function PUT(request: NextRequest, ctx: Ctx) {
  const caller = await authenticate(request);
  if (caller instanceof Response) return caller;
  const { key } = await ctx.params;
  if (!validKey(key)) return dataError(caller, 400, "invalid_request", { error_description: badKey });
  const body = await readPutBody(request, caller);
  if (body instanceof Response) return body;

  const result = await putItem(caller, key, body);
  switch (result.kind) {
    case "ok":
      return json({ key: result.key, version: result.version, updated_at: result.updated_at }, 200, caller.cors);
    case "conflict":
      return dataError(caller, 409, "conflict", result.current);
    case "too_many_keys":
      return dataError(caller, 422, "too_many_keys", { error_description: `At most ${MAX_KEYS} keys per app and person.` });
    case "invalid":
      return dataError(caller, 400, "invalid_request", { error_description: result.description });
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const caller = await authenticate(request);
  if (caller instanceof Response) return caller;
  const { key } = await ctx.params;
  if (!validKey(key)) return dataError(caller, 400, "invalid_request", { error_description: badKey });
  await deleteItem(caller, key);
  return noContent(caller);
}

export const OPTIONS = (request: NextRequest) => preflight(request, DATA_METHODS);
