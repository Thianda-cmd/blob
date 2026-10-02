import type { NextRequest } from "next/server";
import { authenticate, DATA_METHODS, guarded, listItems, methodNotAllowed } from "@/lib/oauth/data";
import { json, preflight } from "@/lib/oauth/http";

/** App data: the keys this app keeps for the signed-in person. Needs the "data" scope. */
export const GET = guarded(async (request: NextRequest) => {
  const caller = await authenticate(request);
  if (caller instanceof Response) return caller;
  const items = await listItems(caller);
  return json({ items }, 200, caller.cors);
});

export const OPTIONS = (request: NextRequest) => preflight(request, DATA_METHODS);

// Values live under /api/v1/data/{key}.
const onlyGet = methodNotAllowed("GET, OPTIONS");
export const POST = onlyGet;
export const PUT = onlyGet;
export const PATCH = onlyGet;
export const DELETE = onlyGet;
