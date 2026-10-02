"use server";

import { approve, deny, loadRequest } from "@/lib/oauth/authorize";
import { issuer } from "@/lib/oauth/config";
import { sessionUser } from "@/lib/oauth/session";
import { createClient } from "@/lib/supabase/server";

/** Allow or cancel a "Sign in with Blob" request. Returns where the browser should go next. */
export async function decide(requestId: string, allow: boolean): Promise<{ url: string } | { error: "expired" | "done" | "signed_out" }> {
  const pending = await loadRequest(requestId);
  if (!pending || pending.expired) return { error: "expired" };
  if (pending.completed) return { error: "done" };
  const user = await sessionUser();
  if (!user) return { error: "signed_out" };
  const iss = issuer();
  return { url: allow ? await approve(pending, user.id, iss, user.authTime) : await deny(pending, user.id, iss) };
}

/** "Not you?": sign out of Blob in this browser and sign in again for the same request. */
export async function switchAccount(requestId: string): Promise<string> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return `/login?next=${encodeURIComponent(`/oauth/continue?request=${requestId}`)}`;
}
