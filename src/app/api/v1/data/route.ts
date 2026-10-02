import type { NextRequest } from "next/server";
import { authenticate, DATA_METHODS, listItems } from "@/lib/oauth/data";
import { json, preflight } from "@/lib/oauth/http";

/** App data: the keys this app keeps for the signed-in person. Needs the "data" scope. */
export async function GET(request: NextRequest) {
  const caller = await authenticate(request);
  if (caller instanceof Response) return caller;
  const items = await listItems(caller);
  return json({ items }, 200, caller.cors);
}

export const OPTIONS = (request: NextRequest) => preflight(request, DATA_METHODS);
