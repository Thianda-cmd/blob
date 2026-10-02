"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isConfirmWord, settingsText } from "@/i18n/messages/settings";
import { getMessages } from "@/i18n/server";
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
