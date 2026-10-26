import { body, fail, ok } from "@/quiz/http";
import { playerState } from "@/quiz/server";

/** The game as a player sees it: `{ token }`. (POST, so the token stays out of addresses and logs.) */
export async function POST(request: Request) {
  try {
    return ok(await playerState((await body(request)).token));
  } catch (e) {
    return fail(e);
  }
}
