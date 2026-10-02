import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** An app the person signed in to with Blob, for Settings › Connected apps. Nothing secret. */
export type ConnectedApp = {
  app_id: string;
  name: string;
  logo_url: string | null;
  mark: string;
  color: string;
  homepage_url: string | null;
  scopes: string[];
  since: string;
  last_used: string | null;
};

type Row = {
  app_id: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  oauth_apps: { name: string; logo_url: string | null; mark: string; color: string; homepage_url: string | null } | null;
};

/** The person's own grants that are still in place, newest first. */
export async function connectedApps(userId: string): Promise<ConnectedApp[]> {
  const { data, error } = await createAdminClient()
    .from("oauth_grants")
    .select("app_id, scopes, created_at, last_used_at, oauth_apps(name, logo_url, mark, color, homepage_url)")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("connectedApps", error);
    return [];
  }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.oauth_apps)
    .map((r) => ({
      app_id: r.app_id,
      name: r.oauth_apps!.name,
      logo_url: r.oauth_apps!.logo_url,
      mark: r.oauth_apps!.mark,
      color: r.oauth_apps!.color,
      homepage_url: r.oauth_apps!.homepage_url,
      scopes: r.scopes,
      since: r.created_at,
      last_used: r.last_used_at,
    }));
}
