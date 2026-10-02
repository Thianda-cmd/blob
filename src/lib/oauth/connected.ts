import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appDataUsage } from "./data";

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
  /** false: access was removed, but the app's data is still stored in Blob. */
  connected: boolean;
  /** What the app keeps in Blob for this person (scope "data"), or null. */
  data: { keys: number; bytes: number } | null;
};

type Row = {
  app_id: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  oauth_apps: { name: string; logo_url: string | null; mark: string; color: string; homepage_url: string | null } | null;
};

/**
 * The person's own grants that are still in place, newest first, plus apps they removed that
 * still keep data in Blob (so that data can be deleted too).
 */
export async function connectedApps(userId: string): Promise<ConnectedApp[]> {
  const db = createAdminClient();
  const [{ data, error }, usage] = await Promise.all([
    db
      .from("oauth_grants")
      .select("app_id, scopes, created_at, last_used_at, revoked_at, oauth_apps(name, logo_url, mark, color, homepage_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    appDataUsage(userId).catch(() => new Map<string, { keys: number; bytes: number }>()),
  ]);
  if (error) {
    console.error("connectedApps", error);
    return [];
  }
  return ((data ?? []) as unknown as (Row & { revoked_at: string | null })[])
    .filter((r) => r.oauth_apps && (!r.revoked_at || usage.has(r.app_id)))
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
      connected: !r.revoked_at,
      data: usage.get(r.app_id) ?? null,
    }))
    .sort((a, b) => Number(b.connected) - Number(a.connected));
}
