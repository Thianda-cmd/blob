"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
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
 */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResult | undefined> {
  if (typeof confirmation !== "string" || confirmation.trim().toLowerCase() !== "delete") {
    return { error: "Type “delete” to confirm." };
  }

  const user = await getUser();
  if (!user) return { error: "You're signed out. Sign in again to delete your account." };

  const admin = createAdminClient();

  try {
    const files = await listFiles(admin, user.id);
    for (let i = 0; i < files.length; i += PAGE) {
      const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + PAGE));
      if (error) throw error;
    }
  } catch (err) {
    console.error("deleteAccount: storage cleanup failed", err);
    return { error: "I couldn't remove your uploaded images, so your account is still here. Try again in a moment." };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteAccount: deleteUser failed", error);
    return { error: "Something went wrong deleting your account. Try again in a moment." };
  }

  // The user is gone; clear the session cookies so no request treats this browser as signed in.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
