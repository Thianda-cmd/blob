import type { NextRequest } from "next/server";
import { sameHash, sha256 } from "@/lib/oauth/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The nightly clean-up of the files bucket (vercel.json "crons"): files whose note or project no
 * longer exists and that nothing refers to, uploaded more than a day ago (rpc orphan_files,
 * migration 0012). It only ever removes paths that orphan_files returned. Deleting a note or project
 * in the app removes its files right after (components/files/deleteForever); this catches what that
 * missed (a failed request, a file another deleted note still referred to).
 *
 * Also tidies two tables: used or expired app sign-in codes (src/lib/auth/appSignIn.ts) after a
 * day, and calendar events deleted more than 90 days ago (devices keep such a "deleted" mark for 60
 * days and reload the whole list daily, so none of them still needs it).
 */

export const maxDuration = 60;

/** Paths per orphan_files call, paths per storage request, and calls per run (the rest waits a night). */
const BATCH = 500;
const REMOVE = 100;
const ROUNDS = 20;

/**
 * Who may start it. With CRON_SECRET set (Vercel then sends it as "Authorization: Bearer <secret>"
 * with every cron request), only that counts. Without it, requests that look like Vercel's cron
 * requests: the user agent "vercel-cron/1.0" and the x-vercel-cron-schedule header
 * (vercel.com/docs/cron-jobs). Those can be copied, but a copied request can do no more than run
 * tonight's clean-up early: only files nothing refers to and whose note or project is gone go, and
 * finding them is an indexed lookup (migration 0013).
 */
function allowed(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) return sameHash(sha256(request.headers.get("authorization") ?? ""), sha256(`Bearer ${secret}`));
  return (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/") && request.headers.has("x-vercel-cron-schedule");
}

async function tidy(db: ReturnType<typeof createAdminClient>) {
  const day = 864e5;
  const signIns = await db.from("app_sign_ins").delete().lt("expires_at", new Date(Date.now() - day).toISOString());
  const events = await db.from("events").delete().lt("deleted_at", new Date(Date.now() - 90 * day).toISOString());
  return (signIns.error ?? events.error)?.message ?? null;
}

export async function GET(request: NextRequest) {
  if (!allowed(request)) return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  const tidied = await tidy(db);
  let removed = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const { data, error } = await db.rpc("orphan_files", { p_limit: BATCH });
    if (error) return Response.json({ ok: false, removed, error: error.message }, { status: 500 });
    const paths = ((data ?? []) as string[]).filter((p) => p.startsWith("page/") || p.startsWith("project/"));
    if (!paths.length) break;
    let gone = 0;
    for (let i = 0; i < paths.length; i += REMOVE) {
      const res = await db.storage.from("files").remove(paths.slice(i, i + REMOVE));
      if (res.error) return Response.json({ ok: false, removed: removed + gone, error: res.error.message }, { status: 500 });
      gone += res.data?.length ?? 0;
    }
    removed += gone;
    // A short batch was the last one; and if nothing went, asking again would only bring the same files.
    if (paths.length < BATCH || gone === 0) break;
  }
  return Response.json({ ok: true, removed, tidy: tidied ?? "ok" });
}
