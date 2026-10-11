import { NextResponse } from "next/server";

// The newest Blob app for computers, from the project's GitHub releases (tags app-v<version>). For
// the apps from before they could update themselves (src/lib/update): they learn here that there's
// a new one, and open its page. (Newer apps ask GitHub themselves: src-tauri/src/update.rs.)

const RELEASES = "https://api.github.com/repos/Thianda-cmd/blob/releases?per_page=20";
const PAGE = "https://github.com/Thianda-cmd/blob/releases/tag/app-v";

type Release = { tag_name: string; draft: boolean; body: string | null; published_at: string | null };

const parse = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : null);
const newer = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export async function GET() {
  try {
    const res = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    const releases = (await res.json()) as Release[];
    let best: { v: number[]; r: Release } | null = null;
    for (const r of releases) {
      const v = !r.draft && r.tag_name.startsWith("app-v") ? parse(r.tag_name.slice(5)) : null;
      if (v && (!best || newer(v, best.v) > 0)) best = { v, r };
    }
    if (!best) return NextResponse.json({ error: "none" }, { status: 404 });
    const version = best.v.join(".");
    return NextResponse.json(
      { version, notes: (best.r.body ?? "").slice(0, 20_000), page: PAGE + version, published: best.r.published_at },
      { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
