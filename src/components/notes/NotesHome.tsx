"use client";

import {
  ArrowDownUp,
  BookMarked,
  Check,
  ChevronDown,
  FolderKanban,
  GraduationCap,
  Hash,
  Layers,
  LayoutGrid,
  List,
  Network,
  NotebookPen,
  Search,
  Sheet as SheetIcon,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Blob } from "@/components/blob/Blob";
import { CreateCards, KIND_LOOK, NEW_KINDS, NewPageButton, type NewKind } from "@/components/shell/NewPageMenu";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { SubjectIcon } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import type { PagePreview } from "@/components/subjects/PageCards";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { card, chipOff, chipOn, fieldClass, midTone } from "@/components/ui/surfaces";
import { PageMenuArea } from "./PageMenuArea";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";
import { resolveText } from "@/i18n/text";
import { CATALOG } from "@/learn/catalog";
import type { DueRow } from "@/notes/server";
import { today } from "@/notes/study/srs";
import { fold } from "@/notes/text";
import { createClient } from "@/lib/supabase/client";
import type { PageMeta, Project } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { NotesGraph } from "./NotesGraph";
import { PageRow, PageTile } from "./PageTiles";
import { useImporter } from "./useImporter";
import { useShareInfo } from "./useShared";

/** The filters, as they stand in the address (?tag=…&kind=…). */
export type NotesQuery = { q: string; subject: string; tag: string; kind: string; owner: string; project: string; topic: string; sort: string; view: string };

const QUERY_KEYS = ["q", "subject", "tag", "kind", "owner", "project", "topic", "sort", "view"] as const satisfies readonly (keyof NotesQuery)[];

/** The filters an address asks for (its first value of each). */
function readNotesQuery(params: { get: (name: string) => string | null }): NotesQuery {
  const query = {} as NotesQuery;
  for (const k of QUERY_KEYS) query[k] = params.get(k) ?? "";
  return query;
}

/** The address's query string for these filters (the defaults, newest first and cards, left out). */
function searchFor(query: NotesQuery) {
  const params = new URLSearchParams();
  for (const k of QUERY_KEYS) {
    const v = query[k];
    if (v && !(k === "sort" && v === "recent") && !(k === "view" && v === "grid")) params.set(k, v);
  }
  return params.toString();
}

/**
 * The filters go into the address, without a new entry in the history and without rendering the
 * page again on the server. With `null` (not history.state) Next.js keeps its own state for the
 * entry and its router takes the new address: useSearchParams follows (the sidebar and the rail
 * light Blobxcel on the Tabellen tab), and Back to this entry comes back to these filters.
 */
function writeUrl(query: NotesQuery) {
  // (Only while the address is still this page's: a late write must never land on the next page.)
  if (window.location.pathname !== "/notes") return;
  const search = searchFor(query);
  window.history.replaceState(null, "", search ? `/notes?${search}` : "/notes");
}

type Sort = "recent" | "created" | "alpha";
type View = "grid" | "list" | "graph";

/** The kinds' tabs (folders only when there are some), in the order of every create menu. */
const TAB_KINDS: readonly NewKind[] = NEW_KINDS;
const isKind = (k: string): k is NewKind => (NEW_KINDS as readonly string[]).includes(k);

/** A button in the toolbar card (the spreadsheet's tool buttons): its height inside a 1 px border. */
const toolClass =
  "flex h-[30px] items-center gap-1.5 rounded-[7px] px-2 text-[13px] font-medium transition-colors disabled:opacity-50 [@media(hover:none)]:h-[34px] [&_svg]:size-3.5 [&_svg]:shrink-0";

/** How long the search waits after the last letter before it goes into the address. */
const TYPING_PAUSE = 350;

export function NotesHome({
  previews,
  links,
  due,
  projects = [],
  pageProjects = {},
}: {
  previews: Record<string, PagePreview>;
  links: Record<string, string[]>;
  due: DueRow[];
  /** The projects your pages are on cards in, and for each page the projects it is in. */
  projects?: Pick<Project, "id" | "title" | "icon" | "color">[];
  pageProjects?: Record<string, string[]>;
}) {
  const router = useRouter();
  const t = useMessages(notesText);
  const locale = useLocale();
  const now = useNow();
  const { pick } = useImporter();
  const { pages: allPages, subjects, createPage, userId } = useWorkspace();
  // The filters are what the address says: when the page opens (also with Back, which can bring
  // back an entry whose page Next.js keeps from before the filters changed) and whenever something
  // else changes the address (a link to /notes?…: the sidebar's Notizen and Blobxcel, Start's "Alle
  // ansehen"). What's chosen here goes into the address in the same event (`set`), so it never
  // comes back as a change from elsewhere, also while the router is still catching up.
  const params = useSearchParams();
  const [query, setQuery] = useState<NotesQuery>(() => readNotesQuery(params));
  const address = searchFor(readNotesQuery(params));
  // What's typed into the search goes into the address after a pause (each update of the router
  // renders the whole app again), and right away when the search loses the keyboard (a card is
  // clicked, Tab), so Back still finds it. Back itself, or leaving the page, drops it: it would
  // land on another entry of the history.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPending = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  };
  useEffect(() => {
    // (Letters still on their way: the page is ahead of the address, not behind it.)
    if (pending.current) return;
    const said = readNotesQuery(new URLSearchParams(window.location.search));
    setQuery((prev) => (searchFor(prev) === searchFor(said) ? prev : said));
  }, [address]);
  useEffect(() => {
    const cancel = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
    window.addEventListener("popstate", cancel);
    return () => {
      window.removeEventListener("popstate", cancel);
      cancel();
    };
  }, []);
  const [busy, setBusy] = useState<NewKind | null>(null);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const q = useDeferredValue(query.q.trim());
  const sort: Sort = query.sort === "alpha" || query.sort === "created" ? query.sort : "recent";
  const view: View = query.view === "list" || query.view === "graph" ? query.view : "grid";

  // (The address is written in the event, not in a state updater: Next.js's router updates itself
  // from it, which must not happen while React renders.)
  const set = (patch: Partial<NotesQuery>, { typing = false } = {}) => {
    const next = { ...query, ...patch };
    setQuery(next);
    cancelPending();
    if (!typing) return writeUrl(next);
    pending.current = setTimeout(() => {
      pending.current = null;
      writeUrl(next);
    }, TYPING_PAUSE);
  };
  const flushTyping = () => {
    if (!pending.current) return;
    cancelPending();
    writeUrl(query);
  };

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

  // Filters (search, subject, tag, owner, project, topic), then the kind (its tabs count without it), then the order.
  const filtered = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    return pages.filter((p) => {
      if (query.subject === "none" ? p.subject_id && subjects.some((s) => s.id === p.subject_id) : query.subject && p.subject_id !== query.subject) return false;
      if (query.tag && !p.tags.some((x) => x.toLowerCase() === query.tag.toLowerCase())) return false;
      if (query.owner === "mine" && p.user_id !== userId) return false;
      if (query.owner === "shared" && p.user_id === userId) return false;
      if (query.project && !pageProjects[p.id]?.includes(query.project)) return false;
      if (query.topic && !p.topics.some((x) => x.split("@")[0] === query.topic)) return false;
      if (!words.length) return true;
      if (found.has(p.id)) return true;
      const hay = fold(`${pageTitle(p.title, p.kind, locale)} ${p.tags.join(" ")} ${previews[p.id]?.snippet ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [pages, q, found, query.subject, query.tag, query.owner, query.project, query.topic, subjects, userId, previews, locale, pageProjects]);

  const results = useMemo(() => {
    const title = (p: PageMeta) => pageTitle(p.title, p.kind, locale);
    return filtered
      .filter((p) => !query.kind || p.kind === query.kind)
      .sort((a, b) =>
        sort === "alpha" ? title(a).localeCompare(title(b), locale) : sort === "created" ? b.created_at.localeCompare(a.created_at) : b.updated_at.localeCompare(a.updated_at),
      );
  }, [filtered, query.kind, sort, locale]);

  // How many of each kind the other filters leave (the tabs' numbers).
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of filtered) c[p.kind] = (c[p.kind] ?? 0) + 1;
    return c;
  }, [filtered]);

  // "/" jumps to the search.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function create(kind: NewKind) {
    if (busy) return;
    setBusy(kind);
    // A new page lands where you're looking: in the filtered subject, with the filtered tag and topic.
    const subject = query.subject && query.subject !== "none" ? query.subject : null;
    const page = await createPage({ kind, subject_id: subject, tags: query.tag ? [query.tag] : undefined, topics: query.topic ? [query.topic] : undefined });
    setBusy(null);
    if (page) router.push(`/p/${page.id}`);
  }

  const subject = subjects.find((s) => s.id === query.subject);
  // Filters other than the kind (the kind has its tabs).
  const filtering = Boolean(query.subject || query.tag || query.owner || query.project || query.topic || q);
  const resetFilters = () => set({ q: "", subject: "", tag: "", owner: "", project: "", topic: "" });
  const project = projects.find((p) => p.id === query.project);
  const inProject = (id: string) => pages.filter((p) => pageProjects[p.id]?.includes(id)).length;
  const schoolSubjects = subjects.filter((s) => s.kind !== "notebook");
  const notebooks = subjects.filter((s) => s.kind === "notebook");
  const dueNotes = [...dueByPage.entries()].sort((a, b) => b[1] - a[1]);

  const kind = isKind(query.kind) ? query.kind : null;
  // "2 von 5": of the pages of this kind (or all of them), before the filters.
  const ofKind = query.kind ? pages.filter((p) => p.kind === query.kind).length : pages.length;
  // The sidebar's "Blobxcel": the spreadsheets, under the feature's name.
  const sheetsOnly = kind === "sheet";
  const crumbIcon = <NotebookPen className="size-3.5 text-ink-3" aria-hidden />;

  let body: ReactNode;
  if (!pages.length && !kind) body = <NothingYet onPick={create} busy={busy !== null} />;
  else if (kind && !results.length && !filtering) body = <KindEmpty kind={kind} onPick={create} busy={busy === kind} />;
  else if (!results.length) {
    body = (
      <EmptyState
        art={<Blob size={80} mood="thinking" track={false} />}
        title={t.noMatchTitle}
        body={t.noMatch}
        actions={
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            {t.filters.reset}
          </Button>
        }
      />
    );
  } else if (view === "list") {
    body = (
      <ul className={cn(card, "overflow-hidden")}>
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
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-3">
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
    );
  }

  return (
    <PageMenuArea>
      <TopBar
        crumbs={
          sheetsOnly
            ? [
                // On phones and small tablets (the rail names the place there) the parent shrinks to
                // its icon, so "Blobxcel" keeps the room beside the view switch and the long button.
                { label: <span className="max-md:sr-only">{t.title}</span>, title: t.title, href: "/notes", icon: crumbIcon },
                { label: t.sheetTitle, icon: <SheetIcon className="size-3.5" style={{ color: KIND_LOOK.sheet.fg }} aria-hidden /> },
              ]
            : [{ label: t.title, icon: crumbIcon }]
        }
        actions={
          <>
            <Segmented
              kind="tabs"
              compact="md"
              value={view}
              onChange={(v) => set({ view: v === "grid" ? "" : v })}
              label={t.view.label}
              className="mr-1"
              options={[
                { value: "grid", label: t.view.grid, icon: <LayoutGrid /> },
                { value: "list", label: t.view.list, icon: <List /> },
                { value: "graph", label: t.view.graph, icon: <Network /> },
              ]}
            />
            {/* With no kind chosen its whole text is "Neue Notiz" (the desktop app's test clicks it). */}
            <NewPageButton kind={kind ?? "note"} onPick={create} onImport={() => pick()} busy={busy !== null} />
          </>
        }
      />
      <PageBody width="wide">
        <PageHeader
          title={sheetsOnly ? t.sheetTitle : t.title}
          meta={sheetsOnly ? t.sheetMeta : undefined}
          icon={sheetsOnly ? <SheetIcon style={{ color: KIND_LOOK.sheet.fg }} aria-hidden /> : undefined}
        >
          <KindTabs value={query.kind} counts={counts} total={filtered.length} folders={pages.some((p) => p.kind === "folder")} onChange={(k) => set({ kind: k })} />
        </PageHeader>

        {/* Due flashcards */}
        {dueTotal > 0 && view !== "graph" && (
          <section className="mb-4 flex flex-col gap-3 rounded-xl border border-blob/25 bg-blob-soft/45 p-4 sm:flex-row sm:items-center dark:bg-blob-soft/30">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blob text-white dark:bg-blob-deep" aria-hidden>
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
              <GraduationCap className="size-4" aria-hidden /> {t.dueBanner.study}
            </Button>
          </section>
        )}

        {/* Search, filters and the order: one toolbar card, staying at the top while you scroll. */}
        <div className="sticky top-0 z-10 -mx-4 mb-3 bg-paper/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div role="group" aria-label={t.filters.label} className={cn(card, "flex flex-wrap items-center gap-1 p-1")}>
            <label className="relative min-w-0 flex-1 basis-[240px] max-sm:basis-full">
              <span className="sr-only">{t.searchLabel}</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                ref={searchRef}
                value={query.q}
                onChange={(e) => set({ q: e.target.value }, { typing: true })}
                onBlur={flushTyping}
                onKeyDown={(e) => e.key === "Escape" && (set({ q: "" }), e.currentTarget.blur())}
                placeholder={kind ? t.searchKind[kind] : t.search}
                className={cn(fieldClass, "w-full pl-8 pr-10")}
              />
              {query.q ? (
                <button
                  type="button"
                  onClick={() => set({ q: "" })}
                  className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-8"
                  aria-label={t.clearSearch}
                  title={t.clearSearch}
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 [@media(hover:none)]:hidden" title={t.searchKey}>
                  <Kbd>/</Kbd>
                </span>
              )}
            </label>
            {/* The filters beside the search, or on their own row when there's no room (phones: scrolling sideways). */}
            <div className="flex min-w-0 items-center gap-1 max-sm:-mx-1 max-sm:w-[calc(100%+0.5rem)] max-sm:overflow-x-auto max-sm:px-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
              <Filter
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
              </Filter>
              <Filter icon={<Hash />} label={query.tag ? `#${query.tag}` : t.filters.tag} active={Boolean(query.tag)} onClear={() => set({ tag: "" })} disabled={!tags.length}>
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
              </Filter>
              <Filter
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
              </Filter>
              {projects.length > 0 && (
                <Filter
                  icon={project ? <span className="text-[13px] leading-none">{project.icon || "📋"}</span> : <FolderKanban />}
                  label={project ? project.title.trim() || t.filters.project : t.filters.project}
                  active={Boolean(query.project)}
                  onClear={() => set({ project: "" })}
                >
                  {(close) => (
                    <div className="max-h-[280px] overflow-y-auto">
                      <MenuItem active={!query.project} onSelect={() => (set({ project: "" }), close())}>
                        {t.filters.allProjects}
                      </MenuItem>
                      {projects.map((p) => (
                        <MenuItem
                          key={p.id}
                          icon={<span className="grid w-4 place-items-center text-[13px] leading-none">{p.icon || "📋"}</span>}
                          active={query.project === p.id}
                          shortcut={inProject(p.id)}
                          onSelect={() => (set({ project: p.id }), close())}
                        >
                          <span className="truncate">{p.title.trim() || t.filters.project}</span>
                        </MenuItem>
                      ))}
                    </div>
                  )}
                </Filter>
              )}
              {topics.length > 0 && (
                <Filter icon={<GraduationCap />} label={query.topic ? topicLabel(query.topic) : t.filters.topic} active={Boolean(query.topic)} onClear={() => set({ topic: "" })}>
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
                </Filter>
              )}
              {filtering && (
                <button type="button" onClick={resetFilters} className={cn(toolClass, "shrink-0 whitespace-nowrap text-ink-2 hover:bg-hover hover:text-ink")}>
                  {t.filters.reset}
                </button>
              )}
              {view !== "graph" && (
                <>
                  <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-line" />
                  <Popover
                    align="end"
                    className="w-[200px]"
                    trigger={(props) => (
                      <button
                        {...props}
                        type="button"
                        className={cn(toolClass, "shrink-0 whitespace-nowrap border border-transparent text-ink-2 hover:bg-hover hover:text-ink")}
                        aria-label={`${t.filters.sort}: ${sort === "alpha" ? t.filters.alpha : sort === "created" ? t.filters.created : t.filters.recent}`}
                        title={t.filters.sort}
                      >
                        <ArrowDownUp />
                        {sort === "alpha" ? t.filters.alpha : sort === "created" ? t.filters.created : t.filters.recent}
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
                </>
              )}
            </div>
          </div>
        </div>

        {view === "graph" ? (
          // (The kind tabs control it too: aria-controls finds it.)
          <div id="notes-results">
            <NotesGraph pages={results} links={links} subjects={subjects} topicLabel={topicLabel} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_260px]">
            <section id="notes-results" className="min-w-0" aria-live="polite" aria-label={t.title}>
              {results.length > 0 && <p className={cn("mb-2.5 px-0.5 text-[12px]", midTone)}>{t.shown(results.length, ofKind)}</p>}
              {body}
            </section>

            {/* Tag cloud: beside the pages on wide screens, below them on smaller ones. */}
            {pages.length > 0 && (
              <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
                <div className={cn(card, "p-3.5")}>
                  <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <Hash className="size-3.5 text-ink-3" aria-hidden /> {t.tags}
                  </h2>
                  {tags.length === 0 ? (
                    <p className={cn("text-[12.5px] leading-snug", midTone)}>{t.noTags}</p>
                  ) : (
                    <TagCloud tags={tags} active={query.tag} onPick={(tag) => set({ tag: query.tag.toLowerCase() === tag.toLowerCase() ? "" : tag })} />
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </PageBody>
    </PageMenuArea>
  );
}

/** No pages at all yet: what Blob can make. */
function NothingYet({ onPick, busy }: { onPick: (kind: NewKind) => void; busy: boolean }) {
  const t = useMessages(notesText);
  return (
    <>
      <EmptyState art={<Blob size={96} mood="happy" />} title={t.emptyTitle} body={t.emptyText} className="pb-8 sm:pb-10" />
      <CreateCards onPick={onPick} busy={busy} className="mx-auto max-w-[880px]" />
    </>
  );
}

/** A kind's tab with nothing in it: make the first one. */
function KindEmpty({ kind, onPick, busy }: { kind: NewKind; onPick: (kind: NewKind) => void; busy: boolean }) {
  const t = useMessages(notesText).emptyKind[kind];
  return (
    <EmptyState
      art={<Blob size={88} mood="sleepy" track={false} />}
      title={t.title}
      body={t.text}
      actions={<NewPageButton kind={kind} split={false} onPick={onPick} busy={busy} labelOnPhones />}
    />
  );
}

/**
 * The kinds as tabs under the title (Alle, Notizen, Tabellen, Handschrift, Präsentationen, Ordner if
 * there are any: the order of every create menu), each with how many the other filters leave. Arrow
 * keys move between them. On phones the row scrolls sideways and keeps the chosen tab in sight
 * (Start's "Alle ansehen" under Präsentationen opens this page on the fifth tab).
 */
function KindTabs({
  value,
  counts,
  total,
  folders,
  onChange,
}: {
  value: string;
  counts: Record<string, number>;
  total: number;
  /** Whether there are folders at all (their tab stays while a search finds none). */
  folders: boolean;
  onChange: (kind: string) => void;
}) {
  const t = useMessages(notesText).kinds;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = [
    { kind: "", label: t.all, n: total },
    ...TAB_KINDS.filter((k) => k !== "folder" || folders || value === "folder").map((k) => ({ kind: k as string, label: t[k], n: counts[k] ?? 0 })),
  ];
  const current = Math.max(
    0,
    tabs.findIndex((tab) => tab.kind === value),
  );
  useEffect(() => {
    const tab = refs.current[current];
    if (tab) revealSideways(tab);
  }, [current]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const j = (to + tabs.length) % tabs.length;
    onChange(tabs[j].kind);
    refs.current[j]?.focus();
  };
  return (
    <div role="tablist" aria-label={t.label} className="flex gap-1.5 sm:flex-wrap">
      {tabs.map((tab, i) => {
        const on = i === current;
        return (
          <button
            key={tab.kind || "all"}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="notes-results"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.kind)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors [@media(hover:none)]:h-9",
              on ? chipOn : chipOff,
            )}
          >
            {tab.label}
            <span className={cn("text-[11.5px] tabular-nums", on ? "text-blob-ink" : midTone)}>{tab.n}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Scrolls the row an element sits in (a row of chips that scrolls sideways on phones) just so far
 * that the element is in sight, and nothing else: no scrolling of the page up or down.
 */
function revealSideways(el: HTMLElement) {
  let row = el.parentElement;
  while (row && !(row.scrollWidth > row.clientWidth && /auto|scroll/.test(getComputedStyle(row).overflowX))) row = row.parentElement;
  if (!row) return;
  const box = row.getBoundingClientRect();
  const it = el.getBoundingClientRect();
  // (16 px to spare: the row's own padding, so the chip doesn't sit on the screen's edge.)
  if (it.left < box.left + 16) row.scrollLeft -= box.left + 16 - it.left;
  else if (it.right > box.right - 16) row.scrollLeft += it.right - (box.right - 16);
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
            type="button"
            onClick={() => onPick(tag)}
            aria-pressed={on}
            className={cn("rounded-full border px-2.5 py-0.5 transition-colors [@media(hover:none)]:py-1.5", on ? chipOn : chipOff)}
            style={{ fontSize: 12 + weight * 3.5, fontWeight: weight > 0.6 ? 600 : 500 }}
          >
            #{tag}
            <span className={cn("ml-1 text-[10.5px] tabular-nums", on ? "text-blob-ink" : midTone)}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A filter in the toolbar: a tool button with its menu; when it's on, violet-soft with an X to take it off. */
function Filter({
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
  const t = useMessages(notesText).filters;
  return (
    <span className={cn("flex shrink-0 items-center rounded-lg border transition-colors", active ? chipOn : "border-transparent")}>
      <Popover
        align="start"
        className="w-[240px]"
        trigger={(props) => (
          <button
            {...props}
            type="button"
            disabled={disabled}
            className={cn(toolClass, "max-w-[220px]", active ? "pr-1 text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {icon}
            <span className="truncate">{label}</span>
            {!active && <ChevronDown className="text-ink-3" aria-hidden />}
          </button>
        )}
      >
        {children}
      </Popover>
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="grid size-[30px] place-items-center rounded-[7px] text-blob-ink/80 hover:text-blob-ink [@media(hover:none)]:size-[34px]"
          aria-label={t.remove(label)}
          title={t.remove(label)}
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}
