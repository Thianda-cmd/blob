import "server-only";
import { QuizError } from "./server";

// The quiz's routes (src/app/api/quiz) answer in JSON, never cached; errors are `{ error: code }`.

const NO_STORE = { "Cache-Control": "no-store" };

export const ok = (data: unknown) => Response.json(data, { headers: NO_STORE });

export function fail(e: unknown) {
  if (e instanceof QuizError) return Response.json({ error: e.code }, { status: e.status, headers: NO_STORE });
  console.error("quiz", e);
  return Response.json({ error: "failed" }, { status: 500, headers: NO_STORE });
}

/** A small JSON body (an object), or {} when there is none or it isn't one. */
export async function body(request: Request, max = 8000): Promise<Record<string, unknown>> {
  const text = await request.text().catch(() => "");
  if (text.length > max) throw new QuizError("too_large", 413);
  try {
    const v = text ? (JSON.parse(text) as unknown) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
