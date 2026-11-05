"use client";

import { format } from "date-fns";
import { ArrowRight, ArrowUpRight, House, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { RecentCvCard } from "@/components/cv/home/RecentCvCard";
import { useRefreshOnBack } from "@/components/cv/home/useRefreshOnBack";
import { useShell } from "@/components/shell/AppShell";
import { CreateCards, NewPageButton, type NewKind } from "@/components/shell/NewPageMenu";
import { PageBody, PageHeader, SectionHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { subjectCounts } from "@/components/subjects/counts";
import { PageCard, type PagePreview } from "@/components/subjects/PageCards";
import type { ProjectSummary } from "@/components/projects/load";
import { UpcomingTasks } from "@/components/tasks/UpcomingTasks";
import { useNow } from "@/components/tasks/useNow";
import { IconButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { addTile, card, cardLift, midTone, panel } from "@/components/ui/surfaces";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { homeText } from "@/i18n/messages/home";
import { subjectsText } from "@/i18n/messages/subjects";
import { subjectColor } from "@/lib/subjects";
import { LearnSnapshot } from "@/learn/components/LearnSnapshot";
import type { LearnDay, TopicProgress } from "@/learn/progress";
import type { AssignedCard } from "@/lib/tasks";
import type { CalEvent, PageKind, Task } from "@/lib/types";
import { cn, firstName, greeting, pageTitle } from "@/lib/utils";
import { ProjectsBlock } from "./ProjectsBlock";
import { TodaySchedule } from "./TodaySchedule";

/** Which pages "Zuletzt bearbeitet" shows; remembered in this browser. */
type RecentKind = "all" | "notes" | "sheets" | "decks";
const RECENT_KEY = "blob-home-recent";
const RECENT_KINDS: readonly RecentKind[] = ["all", "notes", "sheets", "decks"];
/** Handwritten notes are notes too. */
const KINDS_OF: Record<Exclude<RecentKind, "all">, PageKind[]> = { notes: ["note", "ink"], sheets: ["sheet"], decks: ["deck"] };
/** What "+ Neu…" makes when a kind has nothing yet. */
const CREATES: Record<Exclude<RecentKind, "all">, NewKind> = { notes: "note", sheets: "sheet", decks: "deck" };
/** "Alle ansehen": the notes page with that kind (Notizen and Handschrift are two tabs there, so all of them). */
const SEE_ALL: Record<RecentKind, string> = { all: "/notes", notes: "/notes", sheets: "/notes?kind=sheet", decks: "/notes?kind=deck" };
const RECENT_COUNT = 6;

export function HomeView({
  tasks,
  previews,
  cvs,
  openTasks,
  openTotal,
  learn,
  projects = [],
  assigned = [],
  events = [],
}: {
  tasks: Task[];
  previews: Record<string, PagePreview>;
  /** The content of recent CVs, for their thumbnails. */
  cvs: Record<string, unknown>;
  openTasks: Record<string, number>;
  openTotal: number;
  learn: { progress: Record<string, TopicProgress>; days: LearnDay[] };
  /** Your active projects (most recently active first) and the project cards assigned to you. */
  projects?: ProjectSummary[];
  assigned?: AssignedCard[];
  /** The calendar's events, for today's. */
  events?: CalEvent[];
}) {
  const router = useRouter();
  const now = useNow();
  const { openSearch } = useShell();
  const { profile, pages, subjects, createPage } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(homeText);
  const ts = useMessages(subjectsText);
  const blobRef = useRef<BlobHandle>(null);
  const [busy, setBusy] = useState<NewKind | null>(null);
  const [kind, setKind] = useState<RecentKind>("all");
  // Back from a page you just edited: fetch the previews (and CV thumbnails) again instead of Next's old copy.
  useRefreshOnBack();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY) as RecentKind | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the choice after mount
      if (saved && saved !== "all" && RECENT_KINDS.includes(saved)) setKind(saved);
    } catch {}
  }, []);

  const choose = (next: RecentKind) => {
    setKind(next);
    try {
      localStorage.setItem(RECENT_KEY, next);
    } catch {}
  };

  const recent = pages
    .filter((p) => kind === "all" || KINDS_OF[kind].includes(p.kind))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, RECENT_COUNT);
  const name = firstName(profile.full_name);

  async function create(next: NewKind) {
    if (busy) return;
    setBusy(next);
    const page = await createPage({ kind: next });
    setBusy(null);
    if (page) router.push(`/p/${page.id}`);
  }

  // (It switches what the section shows: tabs, one Tab stop, the arrows choose.)
  const switcher = (className?: string) => (
    <Segmented
      size="sm"
      kind="tabs"
      value={kind}
      onChange={choose}
      label={t.recentKinds.label}
      className={className}
      options={RECENT_KINDS.map((k) => ({ value: k, label: t.recentKinds[k] }))}
    />
  );

  return (
    <>
      <TopBar
        crumbs={[{ label: t.title, icon: <House className="size-3.5 text-ink-3" aria-hidden /> }]}
        actions={
          // Without the sidebar (tablets, phones) or on a touch screen: the search, which has no key there.
          <IconButton size="bar" label={t.search} onClick={openSearch} className="[@media(min-width:64rem)_and_(hover:hover)]:hidden">
            <Search className="size-4" />
          </IconButton>
        }
      />
      <PageBody width="wide">
        {/* Greeting */}
        <div className="flex items-center gap-5">
          <div className="mb-5 hidden shrink-0 sm:mb-6 sm:block">
            <Blob ref={blobRef} size={80} mood="happy" onClick={() => blobRef.current?.jump(1)} title="Blob" />
          </div>
          <PageHeader
            size="hero"
            className="min-w-0 flex-1"
            label={<span suppressHydrationWarning>{now ? format(now, t.dateFormat, { locale: dateLocale(locale) }) : " "}</span>}
            title={
              <>
                {now ? greeting(new Date(now), locale) : t.hello}
                {name ? `, ${name}` : ""}
              </>
            }
            // One line that may wrap on a phone.
            meta={<span className="whitespace-normal text-[14px] text-ink-2">{openTotal === 0 ? t.nothingOpen : t.openTasks(openTotal)}</span>}
          />
        </div>

        {/* New: a note, a Blobxcel spreadsheet, handwriting, a presentation */}
        <CreateCards onPick={create} busy={busy !== null} />

        <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Recent pages */}
          <section className="min-w-0" aria-labelledby="home-recent">
            <SectionHeader
              id="home-recent"
              title={t.recent}
              action={
                <span className="flex items-center gap-3">
                  {switcher("max-sm:hidden")}
                  <Link
                    href={SEE_ALL[kind]}
                    className="flex items-center gap-1 whitespace-nowrap font-medium text-ink-2 hover:text-ink [@media(hover:none)]:-my-2 [@media(hover:none)]:py-2"
                  >
                    {t.seeAll} <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </span>
              }
            />
            {/* Phones: the switch on its own line under the heading. */}
            {switcher("mb-3 sm:hidden")}
            {recent.length === 0 ? (
              kind === "all" ? (
                <EmptyRecent />
              ) : (
                <NoneOfKind kind={kind} onPick={create} busy={busy === CREATES[kind]} />
              )
            ) : (
              // A swipeable shelf on phones (like the recents in Notion's app); a grid from tablets up.
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
                {recent.map((page) => {
                  const inside = page.kind === "folder" ? pages.filter((c) => c.parent_id === page.id) : [];
                  return (
                    <div key={page.id} className="h-full min-w-0 max-sm:w-[72%] max-sm:max-w-[260px] max-sm:shrink-0 max-sm:snap-start">
                      {page.kind === "cv" ? (
                        <RecentCvCard page={page} content={cvs[page.id]} now={now} />
                      ) : (
                        <PageCard
                          page={page}
                          preview={previews[page.id]}
                          parent={page.parent_id ? pages.find((p) => p.id === page.parent_id) : undefined}
                          inside={{ count: inside.length, titles: inside.slice(0, 3).map((c) => pageTitle(c.title, c.kind, locale)) }}
                          now={now}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-10">
              <ProjectsBlock projects={projects} assigned={assigned} title={(children, action) => <SectionHeader title={children} action={action} />} />
            </div>
          </section>

          {/* Today in the calendar, then what is due soon */}
          <section className="min-w-0">
            <TodaySchedule events={events} now={now} title={(children, action) => <SectionHeader title={children} action={action} />} />
            <SectionHeader title={t.comingUp} />
            <UpcomingTasks initialTasks={tasks} limit={7} days={7} />
            <div className="mt-8">
              <SectionHeader
                title={t.keepLearning}
                action={
                  <Link href="/learn" className="font-medium text-ink-2 hover:text-ink [@media(hover:none)]:-my-2 [@media(hover:none)]:py-2">
                    {t.allTopics}
                  </Link>
                }
              />
              <LearnSnapshot progress={learn.progress} days={learn.days} />
            </div>
          </section>
        </div>

        {/* Subjects (two columns on phones, so 15 of them stay a short list) */}
        <section className="mt-10" aria-labelledby="home-subjects">
          <SectionHeader id="home-subjects" title={t.subjects} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] sm:gap-3">
            {subjects.map((s) => {
              // What the subject holds, counted as its own page counts it (one line, cut at the end
              // on a narrow card; the whole of it in the tooltip).
              const holds = subjectCounts(
                pages.filter((p) => p.subject_id === s.id),
                ts,
              ).join(" · ");
              const open = openTasks[s.id] ?? 0;
              return (
                <Link key={s.id} href={`/subjects/${s.id}`} className={cn(card, cardLift, "group relative flex h-[92px] flex-col overflow-hidden p-3.5")}>
                  <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: subjectColor(s.color) }} aria-hidden />
                  <span className="flex items-center gap-2">
                    <span className="text-[16px] leading-none" aria-hidden>
                      {s.emoji ?? "📚"}
                    </span>
                    <span className="truncate text-[14px] font-medium text-ink" title={s.name}>
                      {s.name}
                    </span>
                    <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                  <span className={cn("mt-auto flex gap-3 text-[12px]", midTone)}>
                    <span className="min-w-0 truncate" title={holds}>
                      {holds}
                    </span>
                    <span className={cn("shrink-0", open > 0 && "font-medium text-blob-ink")}>{t.open(open)}</span>
                  </span>
                </Link>
              );
            })}
            <AddSubjectCard />
          </div>
        </section>
      </PageBody>
    </>
  );
}

/** No pages at all yet: the create cards above are what to do. */
function EmptyRecent() {
  const t = useMessages(homeText);
  return <EmptyState size="sm" art={<Blob size={72} mood="sleepy" track={false} />} title={t.quiet} body={t.quietHint} />;
}

/** None of this kind yet: say so, and make the first one. */
function NoneOfKind({ kind, onPick, busy }: { kind: Exclude<RecentKind, "all">; onPick: (kind: NewKind) => void; busy: boolean }) {
  const t = useMessages(homeText);
  return (
    <div className={cn(panel, "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4")}>
      <p className="text-[13.5px] text-ink-2">{t.recentNone[kind]}</p>
      <NewPageButton kind={CREATES[kind]} split={false} onPick={onPick} busy={busy} labelOnPhones />
    </div>
  );
}

function AddSubjectCard() {
  const { createSubject } = useWorkspace();
  const t = useMessages(homeText);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={cn(addTile, "flex h-[92px] items-center justify-center gap-1.5 text-[13px] font-medium")}>
        <Plus className="size-4" aria-hidden /> {t.addSubject}
      </button>
    );
  }
  return (
    <form
      className={cn(card, "flex h-[92px] flex-col justify-center gap-2 border-blob/60 p-3")}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setEditing(false);
        const colors = ["sky", "clay", "moss", "plum", "sand", "rose", "teal"] as const;
        await createSubject({ name, color: colors[Math.floor(Math.random() * colors.length)] });
        setName("");
        setEditing(false);
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setEditing(false)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        placeholder={t.subjectName}
        aria-label={t.subjectName}
        maxLength={60}
        className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] outline-none focus:border-blob"
      />
      <span className={cn("text-[11.5px]", midTone)}>{t.enterToAdd}</span>
    </form>
  );
}
