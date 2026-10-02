"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isConfirmWord, settingsText } from "@/i18n/messages/settings";
import { getMessages } from "@/i18n/server";
import { sessionUser } from "@/lib/oauth/session";
import { revokeGrant } from "@/lib/oauth/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";

const BUCKET = "uploads";
const PAGE = 1000;

/** Every object path under `prefix` (folders are walked recursively). */
async function listFiles(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id === null) out.push(...(await listFiles(admin, path)));
      else out.push(path);
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export type DeleteAccountResult = { error: string };

/**
 * Permanently deletes the signed-in user: their uploaded files, then the auth user
 * (profiles, subjects, pages and tasks cascade). On success it signs out and redirects to "/".
 * `confirmation` is the word typed in the dialog: "löschen" in German, "delete" in English.
 */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResult | undefined> {
  const t = (await getMessages(settingsText)).danger;
  if (typeof confirmation !== "string" || !isConfirmWord(confirmation, t.confirmWord)) {
    return { error: t.typeToConfirm };
  }

  const user = await getUser();
  if (!user) return { error: t.signedOut };

  const admin = createAdminClient();

  try {
    const files = await listFiles(admin, user.id);
    for (let i = 0; i < files.length; i += PAGE) {
      const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + PAGE));
      if (error) throw error;
    }
  } catch (err) {
    console.error("deleteAccount: storage cleanup failed", err);
    return { error: t.storageFailed };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteAccount: deleteUser failed", error);
    return { error: t.deleteFailed };
  }

  // The user is gone; clear the session cookies so no request treats this browser as signed in.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Settings › Connected apps: removes the signed-in person's own access for one app
 * ("Sign in with Blob"). The app is signed out and has to ask again next time.
 */
export async function removeConnectedApp(appId: unknown): Promise<{ ok: boolean }> {
  if (typeof appId !== "string" || !UUID.test(appId)) return { ok: false };
  const user = await sessionUser();
  if (!user) return { ok: false };
  // Only the person's own, still active grant.
  const { data: grant } = await createAdminClient()
    .from("oauth_grants")
    .select("app_id")
    .eq("user_id", user.id)
    .eq("app_id", appId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!grant) return { ok: true };
  await revokeGrant(user.id, appId);
  revalidatePath("/settings");
  return { ok: true };
}
