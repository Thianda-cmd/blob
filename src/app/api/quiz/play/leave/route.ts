import { body, fail, ok } from "@/quiz/http";
import { leave } from "@/quiz/server";

/** A player leaves the game: `{ token }`. */
export async function POST(request: Request) {
  try {
    await leave((await body(request)).token);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
