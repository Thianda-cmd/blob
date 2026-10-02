import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "./session";

/** Is this person in `public.admins`? (Rows are added by hand in SQL, never from the app.) */
export const isAdmin = cache(async (userId: string | null | undefined): Promise<boolean> => {
  if (!userId) return false;
  const { data, error } = await createAdminClient().from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && !!data;
});

/**
 * The signed-in admin, for admin pages and server actions. Everyone else gets a plain 404,
 * so the admin panel doesn't even admit it exists.
 */
export async function requireAdmin() {
  const user = await sessionUser();
  if (!user || !(await isAdmin(user.id))) notFound();
  return user;
}
