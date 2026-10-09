"use client";

import { ArrowUpLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageIcon } from "@/components/shell/Sidebar";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { createClient } from "@/lib/supabase/client";
import type { PageKind, PageMeta } from "@/lib/types";
import { pageTitle } from "@/lib/utils";
import { parseTopic } from "./Chips";

type Backlink = { id: string; title: string; icon: string | null; kind: PageKind; plain_text: string | null; updated_at: string };

/** Where the other note mentions this one (its title in its text), with a little context around it. */
function snippet(text: string, title: string): { before: string; hit: string; after: string } | null {
  const plain = text.replace(/\s+/g, " ").trim();
  if (!plain) return null;
  const at = title.trim() ? plain.toLocaleLowerCase().indexOf(title.trim().toLocaleLowerCase()) : -1;
  if (at < 0) return { before: "", hit: "", after: plain.slice(0, 150) + (plain.length > 150 ? "…" : "") };
  const start = Math.max(0, at - 60);
  const end = Math.min(plain.length, at + title.trim().length + 80);
  return {
    before: (start > 0 ? "…" : "") + plain.slice(start, at),
    hit: plain.slice(at, at + title.trim().length),
    after: plain.slice(at + title.trim().length, end) + (end < plain.length ? "…" : ""),
  };
}

/**
 * Under the note: the notes that link here ("Verlinkt von", with the sentence that mentions it) and
 * notes on the same topics or with the same tags ("Ähnliche Notizen").
 */
export function NoteConnections({ page, title }: { page: PageMeta; title: string }) {
  const t = useMessages(noteBlocksText).knowledge;
  const locale = useLocale();
  const { pages } = useWorkspace();
  const [backlinks, setBacklinks] = useState<{ id: string; rows: Backlink[] } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void createClient()
      .from("pages")
      .select("id, title, icon, kind, plain_text, updated_at")
      .contains("links", [page.id])
      .is("trashed_at", null)
      .order("updated_at", { ascending: false })
      .limit(24)
      .then(({ data }) => {
        if (alive) setBacklinks({ id: page.id, rows: ((data ?? []) as Backlink[]).filter((r) => r.id !== page.id) });
      });
    return () => {
      alive = false;
    };
  }, [page.id, tick]);

  // Coming back to the tab: someone (or you, elsewhere) may have linked here meanwhile.
  useEffect(() => {
    const onFocus = () => setTick((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const rows = useMemo(() => (backlinks?.id === page.id ? backlinks.rows : []), [backlinks, page.id]);
  const similar = useMemo(() => {
    const myTopics = new Set((page.topics ?? []).map((x) => parseTopic(x).slug));
    const myTags = new Set((page.tags ?? []).map((x) => x.toLocaleLowerCase()));
    if (!myTopics.size && !myTags.size) return [];
    const linked = new Set(rows.map((r) => r.id));
    return pages
      .filter((p) => p.id !== page.id && p.kind === "note" && !p.trashed_at && !linked.has(p.id))
      .map((p) => {
        const topics = (p.topics ?? []).filter((x) => myTopics.has(parseTopic(x).slug)).length;
        const tags = (p.tags ?? []).filter((x) => myTags.has(x.toLocaleLowerCase())).length;
        return { page: p, topics, tags, score: topics * 3 + tags * 2 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.page.updated_at.localeCompare(a.page.updated_at))
      .slice(0, 4);
  }, [pages, page.id, page.topics, page.tags, rows]);

  if (!rows.length && !similar.length) return null;

  return (
    <section className="blob-connections" aria-label={`${t.backlinks} · ${t.similar}`}>
      {rows.length > 0 && (
        <div>
          <Heading icon={<ArrowUpLeft className="size-3.5" />} count={rows.length}>
            {t.backlinks}
          </Heading>
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => {
              const s = snippet(r.plain_text ?? "", title);
              return (
                <Link key={r.id} href={`/p/${r.id}`} className="blob-connection">
                  <span className="flex min-w-0 items-center gap-2">
                    <PageIcon page={r} className="size-3.5 shrink-0" />
                    <span className="truncate text-[13.5px] font-medium text-ink">{pageTitle(r.title, r.kind, locale)}</span>
                  </span>
                  {s && (
                    <span className="mt-1 line-clamp-2 text-[12.5px] leading-[1.55] text-ink-3">
                      {s.before}
                      {s.hit && <mark className="blob-connection-hit">{s.hit}</mark>}
                      {s.after}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {similar.length > 0 && (
        <div>
          <Heading icon={<Sparkles className="size-3.5" />}>{t.similar}</Heading>
          <div className="grid gap-2 sm:grid-cols-2">
            {similar.map(({ page: p, topics, tags }) => (
              <Link key={p.id} href={`/p/${p.id}`} className="blob-connection">
                <span className="flex min-w-0 items-center gap-2">
                  <PageIcon page={p} className="size-3.5 shrink-0" />
                  <span className="truncate text-[13.5px] font-medium text-ink">{pageTitle(p.title, p.kind, locale)}</span>
                </span>
                <span className="mt-1 text-[12px] text-ink-3">{topics ? t.similarWhy.topics : t.similarWhy.tags(tags)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Heading({ icon, children, count }: { icon: ReactNode; children: ReactNode; count?: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
      <span className="text-ink-3">{icon}</span>
      {children}
      {count !== undefined && <span className="font-normal text-ink-3">· {count}</span>}
    </h2>
  );
}
