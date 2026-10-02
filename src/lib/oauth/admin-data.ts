import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminApp, AppEvent, AppSummary, Connection, Person, SignInStats } from "./admin-types";

/**
 * Data for the admin panel (/admin). Server only, with the service role: call these only after
 * `requireAdmin()`. Every query names its columns, so an app's `secret_hash` is never read.
 */

export const APP_COLUMNS =
  "id, client_id, name, description, homepage_url, privacy_url, logo_url, mark, color, redirect_uris, allowed_origins, scopes, confidential, secret_hint, trusted, disabled, created_at, updated_at";

/** Days are counted on Blob's home clock (German schools), whatever the server's timezone is. */
const TIME_ZONE = "Europe/Berlin";
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayKey = (d: string | Date) => dayFormat.format(new Date(d));

/** The last `n` calendar days as YYYY-MM-DD, oldest first, ending today. */
function lastDays(n: number) {
  const [y, m, d] = dayKey(new Date()).split("-").map(Number);
  // Calendar arithmetic at noon UTC, so daylight-saving changes never skip or repeat a day.
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - (n - 1 - i), 12)).toISOString().slice(0, 10));
}

const CHART_DAYS = 30;
/** Supabase answers at most 1000 rows per request. */
const PAGE = 1000;

type EventRow = { kind: string; created_at: string };

/** Sign-ins and problems over the last 30 days, for one app or for all of them. */
async function signInStats(appId?: string): Promise<SignInStats> {
  const db = createAdminClient();
  // A day more than needed: the window is cut to calendar days below.
  const since = new Date(Date.now() - (CHART_DAYS + 1) * 864e5).toISOString();
  const rows: EventRow[] = [];
  for (let from = 0; from < 100 * PAGE; from += PAGE) {
    let query = db
      .from("oauth_events")
      .select("kind, created_at")
      .in("kind", ["token", "error", "reuse"])
      .gte("created_at", since)
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (appId) query = query.eq("app_id", appId);
    const { data, error } = await query;
    if (error) throw new Error(`oauth_events: ${error.message}`);
    rows.push(...((data ?? []) as EventRow[]));
    if (!data || data.length < PAGE) break;
  }

  const days = lastDays(CHART_DAYS);
  const today = days[days.length - 1];
  const week = new Set(days.slice(-7));
  const perDay = new Map(days.map((d) => [d, 0]));
  const stats: SignInStats = { today: 0, week: 0, errors: 0, series: [] };
  for (const row of rows) {
    const day = dayKey(row.created_at);
    if (row.kind === "token") {
      if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1);
      if (day === today) stats.today++;
      if (week.has(day)) stats.week++;
    } else if (week.has(day)) {
      stats.errors++;
    }
  }
  stats.series = days.map((day) => ({ day, count: perDay.get(day) ?? 0 }));
  return stats;
}

/** People with access right now (grants that weren't revoked). */
async function connectedCount(appId?: string) {
  let query = createAdminClient().from("oauth_grants").select("user_id", { count: "exact", head: true }).is("revoked_at", null);
  if (appId) query = query.eq("app_id", appId);
  const { count } = await query;
  return count ?? 0;
}

async function lastSignIn(appId: string) {
  const { data } = await createAdminClient()
    .from("oauth_events")
    .select("created_at")
    .eq("app_id", appId)
    .eq("kind", "token")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

/** Everything /admin shows: totals, the 30-day chart and every app with its numbers. */
export async function adminOverview() {
  const db = createAdminClient();
  const [{ data, error }, stats, people] = await Promise.all([
    db.from("oauth_apps").select(APP_COLUMNS).order("created_at", { ascending: true }),
    signInStats(),
    connectedCount(),
  ]);
  if (error) throw new Error(`oauth_apps: ${error.message}`);
  const apps = (data ?? []) as AdminApp[];
  const summaries: AppSummary[] = await Promise.all(
    apps.map(async (app) => {
      const [count, last] = await Promise.all([connectedCount(app.id), lastSignIn(app.id)]);
      return { ...app, people: count, lastSignIn: last };
    }),
  );
  return { apps: summaries, stats, people };
}

/** Names, emails and pictures for a list of people (profiles + auth users). */
export async function peopleInfo(ids: (string | null)[]): Promise<Record<string, Person>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return {};
  const db = createAdminClient();
  const out: Record<string, Person> = {};
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await db.from("profiles").select("id, full_name, avatar_url").in("id", unique.slice(i, i + 200));
    for (const p of data ?? []) out[p.id] = { name: (p.full_name as string | null)?.trim() || "", email: null, avatar: (p.avatar_url as string | null) ?? null };
  }
  const setEmail = (id: string, email: string | null | undefined) => {
    const person = (out[id] ??= { name: "", email: null, avatar: null });
    person.email = email ?? null;
    if (!person.name) person.name = email?.split("@")[0] ?? "";
  };
  if (unique.length <= 50) {
    await Promise.all(
      unique.map(async (id) => {
        const { data } = await db.auth.admin.getUserById(id);
        if (data.user) setEmail(id, data.user.email);
      }),
    );
  } else {
    // Many people: walk the user list once instead of one request each.
    const wanted = new Set(unique);
    for (let page = 1; page <= 50 && wanted.size; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users ?? []) {
        if (!wanted.has(u.id)) continue;
        setEmail(u.id, u.email);
        wanted.delete(u.id);
      }
      if (!data || data.users.length < 1000) break;
    }
  }
  return out;
}

/** Everything /admin/apps/[id] shows. `null` when there is no such app. */
export async function adminAppDetail(id: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("oauth_apps").select(APP_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`oauth_apps: ${error.message}`);
  if (!data) return null;
  const app = data as AdminApp;

  const connections: Connection[] = [];
  const loadConnections = async () => {
    for (let from = 0; from < 100 * PAGE; from += PAGE) {
      const { data: rows } = await db
        .from("oauth_grants")
        .select("user_id, scopes, created_at, last_used_at")
        .eq("app_id", id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      connections.push(...((rows ?? []) as Connection[]));
      if (!rows || rows.length < PAGE) break;
    }
  };

  const [stats, eventsRes] = await Promise.all([
    signInStats(id),
    db.from("oauth_events").select("id, kind, user_id, detail, created_at").eq("app_id", id).order("id", { ascending: false }).limit(40),
    loadConnections(),
  ]);
  const events = (eventsRes.data ?? []) as AppEvent[];
  const people = await peopleInfo([...connections.map((c) => c.user_id), ...events.map((e) => e.user_id)]);
  return { app, stats, events, connections, people };
}
