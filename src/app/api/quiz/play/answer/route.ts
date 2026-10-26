import { body, fail, ok } from "@/quiz/http";
import { answer } from "@/quiz/server";

/** An answer to the open question: `{ token, q, answer }`. */
export async function POST(request: Request) {
  try {
    const b = await body(request);
    return ok(await answer(b.token, b.q, b.answer));
  } catch (e) {
    return fail(e);
  }
}
