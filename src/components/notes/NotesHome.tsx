"use client";

import { motion } from "motion/react";
import {
  ArrowDownUp,
  BookMarked,
  Check,
  ChevronDown,
  FilePlus2,
  FolderPlus,
  GraduationCap,
  Hash,
  Layers,
  LayoutGrid,
  List,
  Network,
  Plus,
  Presentation,
  Search,
  Shapes,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Blob } from "@/components/blob/Blob";
import { SubjectIcon } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import type { PagePreview } from "@/components/subjects/PageCards";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";
import { resolveText } from "@/i18n/text";
import { CATALOG } from "@/learn/catalog";
import type { DueRow } from "@/notes/server";
import { today } from "@/notes/study/srs";
import { fold } from "@/notes/text";
import { createClient } from "@/lib/supabase/client";
import type { PageKind, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { NotesGraph } from "./NotesGraph";
import { PageRow, PageTile } from "./PageTiles";
import { useShareInfo } from "./useShared";

/** The filters, as they stand in the address (?tag=…&kind=…). */
export type NotesQuery = { q: string; subject: string; tag: string; kind: string; owner: string; topic: string; sort: string; view: string };

type Sort = "recent" | "created" | "alpha";
type View = "grid" | "list" | "graph";

const KINDS: PageKind[] = ["note", "deck", "folder"];

function writeUrl(query: NotesQuery) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v && !(k === "sort" && v === "recent") && !(k === "view" && v === "grid")) params.set(k, v);
  }
  const search = params.toString();
  window.history.replaceState(window.history.state, "", search ? `/notes?${search}` : "/notes");
}

export function NotesHome({
  previews,
  links,
  due,
  initialQuery,
}: {
  previews: Record<string, PagePreview>;
  links: Record<string, string[]>;
  due: DueRow[];
  initialQuery: NotesQuery;
}) {
  const router = useRouter();
  const t = useMessages(notesText);
  const locale = useLocale();
  const now = useNow();
  const { pages: allPages, subjects, createPage, userId } = useWorkspace();
  const [query, setQuery] = useState<NotesQuery>(initialQuery);
  const [busy, setBusy] = useState<PageKind | null>(null);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const q = useDeferredValue(query.q.trim());
  const sort: Sort = query.sort === "alpha" || query.sort === "created" ? query.sort : "recent";
  const view: View = query.view === "list" || query.view === "graph" ? query.view : "grid";

  const set = (patch: Partial<NotesQuery>) =>
    setQuery((prev) => {
      const next = { ...prev, ...patch };
      writeUrl(next);
      return next;
    });

  // CVs live on /cv.
  const pages = useMemo(() => allPages.filter((p) => p.kind !== "cv"), [allPages]);
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const shareInfo = useShareInfo(
    useMemo(() => pages.filter((p) => p.user_id !== userId && (!p.parent_id || !byId.has(p.parent_id))).map((p) => p.id), [pages, userId, byId]),
    userId,
  );
  const ownerOf = (p: PageMeta) => {
    let top: PageMeta | undefined = p;
    while (top?.parent_id && byId.get(top.parent_id)?.user_id === p.user_id) top = byId.get(top.parent_id);
    return top ? shareInfo[top.id]?.owner : undefined;
  };

  // Words inside the notes (titles and tags are matched right here).
  useEffect(() => {
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results
      setFound(new Set());
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      const { data } = await createClient().from("pages").select("id").is("trashed_at", null).neq("kind", "cv").ilike("plain_text", pattern).limit(200);
      if (!cancelled && data) setFound(new Set(data.map((d) => d.id as string)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  // Due flashcards per note, for "today" where the student is.
  const dueByPage = useMemo(() => {
    const out = new Map<string, number>();
    if (!now) return out;
    const day = today(new Date(now));
    for (const r of due) if (r.due_on <= day && byId.has(r.page_id)) out.set(r.page_id, (out.get(r.page_id) ?? 0) + 1);
    return out;
  }, [due, now, byId]);
  const dueTotal = [...dueByPage.values()].reduce((a, b) => a + b, 0);

  const tags = useMemo(() => {
    const counts = new Map<string, { tag: string; n: number }>();
    for (const p of pages) {
      for (const tag of p.tags) {
        const k = tag.toLowerCase();
        counts.set(k, { tag: counts.get(k)?.tag ?? tag, n: (counts.get(k)?.n ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
  }, [pages]);

  const topics = useMemo(() => {
    const slugs = new Set(pages.flatMap((p) => p.topics.map((x) => x.split("@")[0])));
    return CATALOG.filter((c) => slugs.has(c.slug)).map((c) => ({ slug: c.slug, title: resolveText(c.title, locale) }));
  }, [pages, locale]);
  const topicLabel = (slug: string) => {
    const meta = CATALOG.find((c) => c.slug === slug);
    return meta ? resolveText(meta.title, locale) : slug;
  };

  // Filters (search, subject, tag, kind, owner, topic), then the order.
  const results = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    const list = pages.filter((p) => {
      if (query.subject === "none" ? p.subject_id && subjects.some((s) => s.id === p.subject_id) : query.subject && p.subject_id !== query.subject) return false;
      if (query.tag && !p.tags.some((x) => x.toLowerCase() === query.tag.toLowerCase())) return false;
      if (query.kind && p.kind !== query.kind) return false;
      if (query.owner === "mine" && p.user_id !== userId) return false;
      if (query.owner === "shared" && p.user_id === userId) return false;
      if (query.topic && !p.topics.some((x) => x.split("@")[0] === query.topic)) return false;
      if (!words.length) return true;
      if (found.has(p.id)) return true;
      const hay = fold(`${pageTitle(p.title, p.kind, locale)} ${p.tags.join(" ")} ${previews[p.id]?.snippet ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
    const title = (p: PageMeta) => pageTitle(p.title, p.kind, locale);
    return list.sort((a, b) =>
      sort === "alpha"
        ? title(a).localeCompare(title(b), locale)
        : sort === "created"
          ? b.created_at.localeCompare(a.created_at)
          : b.updated_at.localeCompare(a.updated_at),
    );
  }, [pages, q, found, query.subject, query.tag, query.kind, query.owner, query.topic, sort, subjects, userId, previews, locale]);

  const counts = useMemo(() => {
    const c = { note: 0, deck: 0, folder: 0 } as Record<PageKind, number>;
    for (const p of pages) c[p.kind] = (c[p.kind] ?? 0) + 1;
    return c;
  }, [pages]);

  // "/" jumps to the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function create(kind: Extract<PageKind, "note" | "deck" | "folder">) {
    if (busy) return;
    setBusy(kind);
    // A new page lands where you're looking: in the filtered subject, with the filtered tag and topic.
    const subject = query.subject && query.subject !== "none" ? query.subject : null;
    const page = await createPage({ kind, subject_id: subject, tags: query.tag ? [query.tag] : undefined, topics: query.topic ? [query.topic] : undefined });
    setBusy(null);
    if (page) router.push(`/p/${page.id}`);
  }

  const subject = subjects.find((s) => s.id === query.subject);
  const active = Boolean(query.subject || query.tag || query.kind || query.owner || query.topic || q);
  const resetFilters = () => set({ q: "", subject: "", tag: "", kind: "", owner: "", topic: "" });
  const schoolSubjects = subjects.filter((s) => s.kind !== "notebook");
  const notebooks = subjects.filter((s) => s.kind === "notebook");

  const dueNotes = [...dueByPage.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <TopBar crumbs={[{ label: t.title }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-24 pt-5 sm:px-8 lg:px-10 lg:pt-7">
          {/* Header */}
          <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-[32px]">{t.title}</h1>
              <p className="mt-0.5 text-[13px] text-ink-3">{t.counts(counts.note ?? 0, counts.deck ?? 0, counts.folder ?? 0)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Segmented
                value={view === "graph" ? "graph" : "all"}
                onChange={(v) => set({ view: v === "graph" ? "graph" : view === "list" ? "list" : "" })}
                options={[
                  { value: "all", label: t.tabs.all, icon: <Layers /> },
                  { value: "graph", label: t.tabs.graph, icon: <Network /> },
                ]}
              />
              <NewMenu onPick={create} busy={busy} />
            </div>
          </header>

          {/* Due flashcards */}
          {dueTotal > 0 && view !== "graph" && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex flex-col gap-3 rounded-2xl border border-blob/25 bg-blob-soft/45 p-4 sm:flex-row sm:items-center dark:bg-blob-soft/30"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
                  <Layers className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-ink">
                    {t.dueBanner.title(dueTotal)} <span className="font-normal text-ink-2">{t.dueBanner.inNotes(dueNotes.length)}</span>
                  </h2>
                  <p className="text-[13px] text-ink-2">{t.dueBanner.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dueNotes.slice(0, 6).map(([id, n]) => {
                      const p = byId.get(id)!;
                      return (
                        <Link
                          key={id}
                          href={`/study/note/${id}?mode=cards`}
                          className="flex max-w-[240px] items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[12.5px] text-ink-2 shadow-card transition-colors hover:border-blob/40 hover:text-ink [@media(hover:none)]:py-1.5"
                        >
                          <span className="truncate">{pageTitle(p.title, p.kind, locale)}</span>
                          <span className="shrink-0 rounded-full bg-blob/15 px-1.5 text-[11px] font-semibold tabular-nums text-blob-ink">{n}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Button variant="blob" size="md" onClick={() => router.push(`/study/note/${dueNotes[0][0]}?mode=cards`)} className="shrink-0 self-start sm:self-center">
                <GraduationCap className="size-4" /> {t.dueBanner.study}
              </Button>
            </motion.section>
          )}

          {/* Search and filters */}
          <div className="sticky top-0 z-10 -mx-4 mt-5 bg-surface/90 px-4 pb-3 pt-2 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[min(100%,260px)] flex-1">
                <span className="sr-only">{t.searchLabel}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  ref={searchRef}
                  value={query.q}
                  onChange={(e) => set({ q: e.target.value })}
                  onKeyDown={(e) => e.key === "Escape" && (set({ q: "" }), e.currentTarget.blur())}
                  placeholder={t.search}
                  className="h-9.5 w-full rounded-xl border border-line bg-raised pl-9 pr-16 text-[14px] text-ink shadow-card outline-none transition-[border,box-shadow] placeholder:text-ink-3/80 hover:border-line-2 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)]"
                />
                {query.q ? (
                  <button
                    onClick={() => set({ q: "" })}
                    className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
                    aria-label={t.filters.reset}
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [@media(hover:none)]:hidden" title={t.searchKey}>
                    <Kbd>/</Kbd>
                  </span>
                )}
              </label>
              {view !== "graph" && (
                <div className="flex items-center gap-1.5">
                  <Popover
                    align="end"
                    className="w-[200px]"
                    trigger={(props) => (
                      <button {...props} className="flex h-9.5 items-center gap-1.5 rounded-xl border border-line bg-raised px-3 text-[13px] text-ink-2 shadow-card hover:border-line-2 hover:text-ink" aria-label={t.filters.sort} title={t.filters.sort}>
                        <ArrowDownUp className="size-3.5" />
                        <span className="max-sm:hidden">{sort === "alpha" ? t.filters.alpha : sort === "created" ? t.filters.created : t.filters.recent}</span>
                      </button>
                    )}
                  >
                    {(close) =>
                      (["recent", "created", "alpha"] as const).map((s) => (
                        <MenuItem key={s} active={sort === s} shortcut={sort === s ? <Check className="size-3.5" /> : undefined} onSelect={() => (set({ sort: s }), close())}>
                          {s === "alpha" ? t.filters.alpha : s === "created" ? t.filters.created : t.filters.recent}
                        </MenuItem>
                      ))
                    }
                  </Popover>
                  <Segmented
                    compact
                    value={view}
                    onChange={(v) => set({ view: v === "list" ? "list" : "" })}
                    options={[
                      { value: "grid", label: t.view.grid, icon: <LayoutGrid /> },
                      { value: "list", label: t.view.list, icon: <List /> },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Filter chips: one row that scrolls sideways on phones. */}
            <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              <FilterChip
                icon={subject ? <SubjectIcon subject={subject} /> : <BookMarked />}
                label={subject ? subject.name : query.subject === "none" ? t.filters.noSubject : t.filters.subject}
                active={Boolean(query.subject)}
                onClear={() => set({ subject: "" })}
              >
                {(close) => (
                  <>
                    <MenuItem active={!query.subject} onSelect={() => (set({ subject: "" }), close())}>
                      {t.filters.allSubjects}
                    </MenuItem>
                    {schoolSubjects.length > 0 && <MenuLabel>{t.filters.subjects}</MenuLabel>}
                    {schoolSubjects.map((s) => (
                      <MenuItem key={s.id} active={query.subject === s.id} icon={<SubjectIcon subject={s} />} onSelect={() => (set({ subject: s.id }), close())}>
                        {s.name}
                      </MenuItem>
                    ))}
                    {notebooks.length > 0 && <MenuLabel>{t.filters.notebooks}</MenuLabel>}
                    {notebooks.map((s) => (
                      <MenuItem key={s.id} active={query.subject === s.id} icon={<SubjectIcon subject={s} />} onSelect={() => (set({ subject: s.id }), close())}>
                        {s.name}
                      </MenuItem>
                    ))}
                    <MenuSeparator />
                    <MenuItem active={query.subject === "none"} onSelect={() => (set({ subject: "none" }), close())}>
                      {t.filters.noSubject}
                    </MenuItem>
                  </>
                )}
              </FilterChip>
              <FilterChip icon={<Hash />} label={query.tag ? `#${query.tag}` : t.filters.tag} active={Boolean(query.tag)} onClear={() => set({ tag: "" })} disabled={!tags.length}>
                {(close) => (
                  <div className="max-h-[280px] overflow-y-auto">
                    <MenuItem active={!query.tag} onSelect={() => (set({ tag: "" }), close())}>
                      {t.filters.allTags}
                    </MenuItem>
                    {tags.map(({ tag, n }) => (
                      <MenuItem key={tag} active={query.tag.toLowerCase() === tag.toLowerCase()} shortcut={n} onSelect={() => (set({ tag }), close())}>
                        #{tag}
                      </MenuItem>
                    ))}
                  </div>
                )}
              </FilterChip>
              <FilterChip
                icon={<Shapes />}
                label={query.kind === "deck" ? t.filters.decks : query.kind === "folder" ? t.filters.folders : query.kind === "note" ? t.filters.notes : t.filters.kind}
                active={Boolean(query.kind)}
                onClear={() => set({ kind: "" })}
              >
                {(close) => (
                  <>
                    <MenuItem active={!query.kind} onSelect={() => (set({ kind: "" }), close())}>
                      {t.filters.allKinds}
                    </MenuItem>
                    {KINDS.map((k) => (
                      <MenuItem key={k} active={query.kind === k} shortcut={counts[k] ?? 0} onSelect={() => (set({ kind: k }), close())}>
                        {k === "deck" ? t.filters.decks : k === "folder" ? t.filters.folders : t.filters.notes}
                      </MenuItem>
                    ))}
                  </>
                )}
              </FilterChip>
              <FilterChip
                icon={<Users />}
                label={query.owner === "mine" ? t.filters.mine : query.owner === "shared" ? t.filters.shared : t.filters.owner}
                active={Boolean(query.owner)}
                onClear={() => set({ owner: "" })}
              >
                {(close) => (
                  <>
                    <MenuItem active={!query.owner} onSelect={() => (set({ owner: "" }), close())}>
                      {t.filters.allOwners}
                    </MenuItem>
                    <MenuItem active={query.owner === "mine"} onSelect={() => (set({ owner: "mine" }), close())}>
                      {t.filters.mine}
                    </MenuItem>
                    <MenuItem active={query.owner === "shared"} onSelect={() => (set({ owner: "shared" }), close())}>
                      {t.filters.shared}
                    </MenuItem>
                  </>
                )}
              </FilterChip>
              {topics.length > 0 && (
                <FilterChip icon={<GraduationCap />} label={query.topic ? topicLabel(query.topic) : t.filters.topic} active={Boolean(query.topic)} onClear={() => set({ topic: "" })}>
                  {(close) => (
                    <div className="max-h-[280px] overflow-y-auto">
                      <MenuItem active={!query.topic} onSelect={() => (set({ topic: "" }), close())}>
                        {t.filters.allTopics}
                      </MenuItem>
                      {topics.map((tp) => (
                        <MenuItem key={tp.slug} active={query.topic === tp.slug} onSelect={() => (set({ topic: tp.slug }), close())}>
                          {tp.title}
                        </MenuItem>
                      ))}
                    </div>
                  )}
                </FilterChip>
              )}
              {active && (
                <button onClick={resetFilters} className="shrink-0 whitespace-nowrap rounded-lg px-2 text-[12.5px] font-medium text-ink-3 hover:text-ink [@media(hover:none)]:h-9">
                  {t.filters.reset}
                </button>
              )}
            </div>
          </div>

          {view === "graph" ? (
            <NotesGraph pages={results} links={links} subjects={subjects} topicLabel={topicLabel} />
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_260px]">
              <section className="min-w-0" aria-live="polite">
                <div className="mb-2.5 flex items-center justify-between px-0.5 text-[12px] text-ink-3">
                  <span>{t.shown(results.length, pages.length)}</span>
                </div>
                {pages.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-14 text-center">
                    <Blob size={112} mood="happy" />
                    <h2 className="mt-2 font-display text-[20px] font-semibold tracking-[-0.015em]">{t.emptyTitle}</h2>
                    <p className="mt-1 max-w-[380px] text-[13.5px] text-ink-2">{t.emptyText}</p>
                    <Button variant="primary" className="mt-5" onClick={() => create("note")} loading={busy === "note"}>
                      <FilePlus2 className="size-4" /> {t.folder.newNote}
                    </Button>
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-12 text-center">
                    <Blob size={84} mood="thinking" track={false} />
                    <p className="mt-2 text-[13.5px] text-ink-2">{t.noMatch}</p>
                    <button onClick={resetFilters} className="mt-3 h-8 rounded-lg border border-line bg-raised px-3 text-[13px] font-medium text-ink shadow-card hover:border-line-2">
                      {t.filters.reset}
                    </button>
                  </div>
                ) : view === "list" ? (
                  <ul className="overflow-hidden rounded-xl border border-line bg-raised shadow-card">
                    {results.map((p, i) => (
                      <PageRow
                        key={p.id}
                        page={p}
                        first={i === 0}
                        preview={previews[p.id]}
                        subject={subjects.find((s) => s.id === p.subject_id)}
                        parent={p.parent_id ? byId.get(p.parent_id) : undefined}
                        due={dueByPage.get(p.id) ?? 0}
                        owner={p.user_id !== userId ? ownerOf(p) : undefined}
                        shared={p.user_id !== userId}
                        inText={found.has(p.id)}
                        now={now}
                        onTag={(tag) => set({ tag })}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
                    {results.map((p) => (
                      <PageTile
                        key={p.id}
                        page={p}
                        preview={previews[p.id]}
                        subject={subjects.find((s) => s.id === p.subject_id)}
                        parent={p.parent_id ? byId.get(p.parent_id) : undefined}
                        childCount={p.kind === "folder" ? pages.filter((c) => c.parent_id === p.id).length : 0}
                        childTitles={p.kind === "folder" ? pages.filter((c) => c.parent_id === p.id).slice(0, 3).map((c) => pageTitle(c.title, c.kind, locale)) : []}
                        due={dueByPage.get(p.id) ?? 0}
                        owner={p.user_id !== userId ? ownerOf(p) : undefined}
                        shared={p.user_id !== userId}
                        inText={found.has(p.id)}
                        now={now}
                        onTag={(tag) => set({ tag })}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Tag cloud: beside the list on wide screens, below it on smaller ones. */}
              <aside className="min-w-0 xl:sticky xl:top-28 xl:self-start">
                <div className="rounded-2xl border border-line bg-raised/60 p-3.5 dark:bg-raised/40">
                  <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <Hash className="size-3.5 text-ink-3" /> {t.tags}
                  </h2>
                  {tags.length === 0 ? (
                    <p className="text-[12.5px] leading-snug text-ink-3">{t.noTags}</p>
                  ) : (
                    <TagCloud tags={tags} active={query.tag} onPick={(tag) => set({ tag: query.tag.toLowerCase() === tag.toLowerCase() ? "" : tag })} />
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Tags sized by how often they're used. */
function TagCloud({ tags, active, onPick }: { tags: { tag: string; n: number }[]; active: string; onPick: (tag: string) => void }) {
  const max = Math.max(...tags.map((x) => x.n));
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, 40).map(({ tag, n }) => {
        const weight = max > 1 ? (n - 1) / (max - 1) : 0;
        const on = active.toLowerCase() === tag.toLowerCase();
        return (
          <button
            key={tag}
            onClick={() => onPick(tag)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-2.5 py-0.5 transition-colors [@media(hover:none)]:py-1.5",
              on ? "border-blob/50 bg-blob-soft text-blob-ink" : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink",
            )}
            style={{ fontSize: 12 + weight * 3.5, fontWeight: weight > 0.6 ? 600 : 500 }}
          >
            #{tag}
            <span className="ml-1 text-[10.5px] tabular-nums text-ink-3">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({
  icon,
  label,
  active,
  onClear,
  disabled,
  children,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClear: () => void;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  return (
    <span className={cn("flex shrink-0 items-center rounded-lg border shadow-card", active ? "border-blob/40 bg-blob-soft/60 text-blob-ink" : "border-line bg-raised text-ink-2")}>
      <Popover
        align="start"
        className="w-[240px]"
        trigger={(props) => (
          <button
            {...props}
            disabled={disabled}
            className={cn(
              "flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 [@media(hover:none)]:h-9 [&_svg]:size-3.5 [&_svg]:shrink-0",
              active ? "pr-1" : "hover:text-ink",
            )}
          >
            {icon}
            <span className="truncate">{label}</span>
            {!active && <ChevronDown className="text-ink-3" />}
          </button>
        )}
      >
        {children}
      </Popover>
      {active && (
        <button onClick={onClear} className="grid size-7 place-items-center rounded-md text-blob-ink/80 hover:text-blob-ink [@media(hover:none)]:size-9" aria-label={label}>
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  compact,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: ReactNode }[];
  compact?: boolean;
}) {
  return (
    <div className="flex rounded-xl border border-line bg-paper p-0.5 shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)]" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          title={o.label}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium transition-colors [&_svg]:size-3.5 [@media(hover:none)]:h-9",
            value === o.value ? "bg-raised text-ink shadow-card" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.icon}
          <span className={cn(compact ? "sr-only" : "max-sm:sr-only")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function NewMenu({ onPick, busy }: { onPick: (kind: "note" | "deck" | "folder") => void; busy: PageKind | null }) {
  const t = useMessages(notesText);
  return (
    <Popover
      align="end"
      className="w-[200px]"
      trigger={(props) => (
        <Button {...props} variant="primary" loading={Boolean(busy)}>
          <Plus className="size-4" /> {t.new}
        </Button>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon={<FilePlus2 />} onSelect={() => (close(), onPick("note"))}>
            {t.newNote}
          </MenuItem>
          <MenuItem icon={<Presentation />} onSelect={() => (close(), onPick("deck"))}>
            {t.newDeck}
          </MenuItem>
          <MenuItem icon={<FolderPlus />} onSelect={() => (close(), onPick("folder"))}>
            {t.newFolder}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}
