import { fail, ok } from "@/quiz/http";
import { peek, QuizError } from "@/quiz/server";

/** Whether there is a game with this PIN to join (no account needed). */
export async function GET(_request: Request, ctx: RouteContext<"/api/quiz/play/[pin]">) {
  try {
    const game = await peek((await ctx.params).pin);
    if (!game) throw new QuizError("not_found", 404);
    return ok(game);
  } catch (e) {
    return fail(e);
  }
}
