import { body, fail, ok } from "@/quiz/http";
import { join } from "@/quiz/server";

/** Joins the game: `{ nickname, look }` → `{ token, view }`. The phone keeps the token. */
export async function POST(request: Request, ctx: RouteContext<"/api/quiz/play/[pin]/join">) {
  try {
    const b = await body(request);
    return ok(await join((await ctx.params).pin, b.nickname, b.look));
  } catch (e) {
    return fail(e);
  }
}
