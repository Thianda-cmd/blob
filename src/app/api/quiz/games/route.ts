import { body, fail, ok } from "@/quiz/http";
import { createGame, QuizError } from "@/quiz/server";
import { getUser } from "@/lib/supabase/server";

/** Starts a live game of one of your quizzes: `{ quizId, settings? }` → `{ id, pin }`. */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) throw new QuizError("unauthorized", 401);
    const b = await body(request);
    const settings = b.settings && typeof b.settings === "object" ? (b.settings as Record<string, unknown>) : undefined;
    return ok(await createGame(user.id, String(b.quizId ?? ""), settings));
  } catch (e) {
    return fail(e);
  }
}
