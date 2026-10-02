import type { NextRequest } from "next/server";
import { DATA_METHODS, guarded } from "@/lib/oauth/data";
import { corsForAnyApp, json, preflight } from "@/lib/oauth/http";

/** Keys never contain "/": a JSON 404 the app's browser code can read, instead of Next's HTML page. */
const notFound = guarded(async (request: NextRequest) =>
  json({ error: "not_found", error_description: "Keys match ^[a-z0-9][a-z0-9_.-]{0,63}$ and contain no \"/\"." }, 404, await corsForAnyApp(request)),
);

export const GET = notFound;
export const PUT = notFound;
export const DELETE = notFound;
export const POST = notFound;
export const PATCH = notFound;
export const OPTIONS = (request: NextRequest) => preflight(request, DATA_METHODS);
