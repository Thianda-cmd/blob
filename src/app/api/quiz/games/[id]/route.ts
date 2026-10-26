import { body, fail, ok } from "@/quiz/http";
import { hostAct, hostState, QuizError, type HostAction } from "@/quiz/server";
import { getUser } from "@/lib/supabase/server";

const ACTIONS: HostAction[] = ["start", "reveal", "next", "end", "lock", "unlock", "kick"];

/** The game as its host sees it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/quiz/games/[id]">) {
  try {
    const user = await getUser();
    if (!user) throw new QuizError("unauthorized", 401);
    return ok(await hostState(user.id, (await ctx.params).id));
  } catch (e) {
    return fail(e);
  }
}

/** The host moves the game on: `{ action, playerId? }`. */
export async function POST(request: Request, ctx: RouteContext<"/api/quiz/games/[id]">) {
  try {
    const user = await getUser();
    if (!user) throw new QuizError("unauthorized", 401);
    const b = await body(request);
    const action = ACTIONS.find((a) => a === b.action);
    if (!action) throw new QuizError("action");
    return ok(await hostAct(user.id, (await ctx.params).id, action, typeof b.playerId === "string" ? b.playerId : undefined));
  } catch (e) {
    return fail(e);
  }
}
