"use client";

import { createClient } from "@/lib/supabase/client";
import { getAll, write } from "./idb";
import { isNetworkError, isOnline, reportNetworkError, reportOk } from "./net";

// Flashcard answers given without a connection: kept on the device (the newest per card) and
// sent once the connection is back, so spaced repetition stays right.

type ReviewRow = { card_id: string } & Record<string, unknown>;
type Kept = { id: string; page: string; row: ReviewRow; at: number };

const key = (pageId: string, cardId: string) => `review:${pageId}:${cardId}`;

/** Saves an answer: "saved", "device" (kept here until online) or "error" (the server refused it). */
export async function saveReview(userId: string, pageId: string, row: ReviewRow): Promise<"saved" | "device" | "error"> {
  const send = async () => createClient().from("card_reviews").upsert({ ...row, user_id: userId, page_id: pageId }, { onConflict: "user_id,page_id,card_id" });
  if (isOnline()) {
    const { error, status } = await send();
    if (!error) {
      reportOk();
      void write(userId, "notes", [], [key(pageId, row.card_id)]);
      return "saved";
    }
    if (!isNetworkError(error, status)) return "error";
    reportNetworkError();
  }
  const kept: Kept = { id: key(pageId, row.card_id), page: pageId, row, at: Date.now() };
  return (await write(userId, "notes", [kept])) ? "device" : "error";
}

/** Answers kept on this device for a note (to show the right cards as due while offline). */
export async function keptReviews(userId: string, pageId: string): Promise<ReviewRow[]> {
  const all = await getAll<Kept>(userId, "notes");
  return all.filter((k) => k.id.startsWith(`review:${pageId}:`)).map((k) => k.row);
}

/** Refused because of the sign-in (expired or not renewed yet), not because of the answer itself. */
function isAuthError(error: { code?: string; message?: string }, status?: number) {
  return status === 401 || (error.code ?? "").startsWith("PGRST30") || /jwt/i.test(error.message ?? "");
}

let sending = false;

/** Sends the answers kept on this device. */
export async function flushReviews(userId: string) {
  if (sending || !isOnline()) return;
  sending = true;
  try {
    const kept = (await getAll<Kept>(userId, "notes")).filter((k) => k.id.startsWith("review:"));
    const db = createClient();
    for (const k of kept) {
      const { error, status } = await db.from("card_reviews").upsert({ ...k.row, user_id: userId, page_id: k.page }, { onConflict: "user_id,page_id,card_id" });
      if (error && isNetworkError(error, status)) {
        reportNetworkError();
        return;
      }
      // The sign-in ran out (it renews in a moment): keep it for the next try.
      if (error && isAuthError(error, status)) return;
      // Sent, or refused for good (the note is gone): either way it's done.
      await write(userId, "notes", [], [k.id]);
    }
  } finally {
    sending = false;
  }
}
