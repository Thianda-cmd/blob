import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The person signed in to Blob in this browser, verified with Supabase, plus when they last
 * actually signed in (for the ID token's auth_time).
 */
export async function sessionUser(): Promise<{ id: string; email: string | null; authTime: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: claims } = await supabase.auth.getClaims();
  const amr = (claims?.claims?.amr ?? []) as { timestamp?: number }[];
  const stamps = amr.map((m) => m.timestamp ?? 0).filter(Boolean);
  const authTime = stamps.length ? Math.max(...stamps) : Number(claims?.claims?.iat ?? Math.floor(Date.now() / 1000));
  return { id: data.user.id, email: data.user.email ?? null, authTime };
}
