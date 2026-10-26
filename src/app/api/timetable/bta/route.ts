import { BTA_ORIGIN, BTA_PLAN_FN, buildTimetable, decodeSeroval, mergeProfile, readProfile, type SchoolProfile } from "@/calendar/bta";
import { getUser } from "@/lib/supabase/server";

// The BTA926A timetable from bta.bojes.org, read for the calendar's import (TimetableImport). The
// site's timetable is a TanStack Start server function; it answers only requests that look like
// they come from its own pages (CSRF protection), hence the Origin and Sec-Fetch-Site headers.
// The school year (quarters, holidays, names, exams) is read from the site's scripts now and then.

const SITE_HEADERS = {
  Origin: BTA_ORIGIN,
  Referer: `${BTA_ORIGIN}/`,
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": "Blob (blob.bojes.org) timetable import",
};

type Known = { profile: SchoolProfile; live: boolean; fn: string; at: number };
let known: Known | null = null;
const KNOWN_FOR = 6 * 3600e3;

async function get(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, headers: { ...SITE_HEADERS, ...init.headers }, cache: "no-store", signal: AbortSignal.timeout(9000) });
}

/** The site's scripts: the timetable function's id and the school year. */
async function discover(): Promise<Known> {
  if (known && Date.now() - known.at < KNOWN_FOR) return known;
  let fn = BTA_PLAN_FN;
  let read: Partial<SchoolProfile> = {};
  try {
    const html = await (await get(BTA_ORIGIN)).text();
    const scripts = [...new Set([...html.matchAll(/\/assets\/[\w.-]+\.js/g)].map((m) => m[0]))].slice(0, 16);
    const texts = await Promise.all(
      scripts.map(async (path) => {
        try {
          const res = await get(BTA_ORIGIN + path);
          const body = res.ok ? await res.text() : "";
          return body.length < 3_000_000 ? body : "";
        } catch {
          return "";
        }
      }),
    );
    const js = texts.join("\n;\n");
    // The function's id sits right before the key the site caches the timetable under.
    const id = /([0-9a-f]{64})`\)\),[\w$]{1,4}=`boje-plan/.exec(js)?.[1] ?? /\.handler\([\w$]{1,4}\(`([0-9a-f]{64})`\)\)/.exec(js)?.[1];
    if (id) fn = id;
    read = readProfile(js);
  } catch {
    // The snapshot and the known id do.
  }
  const merged = mergeProfile(read);
  known = { ...merged, fn, at: Date.now() };
  return known;
}

async function loadPlan(fn: string) {
  const res = await get(`${BTA_ORIGIN}/_serverFn/${fn}`, { headers: { "x-tsr-serverFn": "true", Accept: "application/x-tss-framed, application/x-ndjson, application/json" } });
  if (!res.ok) throw new Error(`bta: ${res.status}`);
  const body = (await res.json()) as unknown;
  const decoded = decodeSeroval(body) as { result?: unknown; error?: unknown };
  if (decoded?.error) throw new Error("bta: server function failed");
  return decoded?.result ?? decoded;
}

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    let site = await discover();
    let raw: unknown;
    try {
      raw = await loadPlan(site.fn);
    } catch {
      // A new release of the site may have moved the function: look again once.
      known = null;
      site = await discover();
      raw = await loadPlan(site.fn);
    }
    const timetable = buildTimetable(raw, site.profile, site.live);
    return Response.json(timetable, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
