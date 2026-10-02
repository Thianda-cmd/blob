"use client";

import { format } from "date-fns";
import { motion } from "motion/react";
import { ArrowUpRight, FilePlus2, ListPlus, Plus, Presentation, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { useShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { NoteCard, SlideThumb, type PagePreview } from "@/components/subjects/PageCards";
import { PageIcon } from "@/components/shell/Sidebar";
import { UpcomingTasks } from "@/components/tasks/UpcomingTasks";
import { useNow } from "@/components/tasks/useNow";
import { Kbd } from "@/components/ui/Kbd";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { homeText } from "@/i18n/messages/home";
import { subjectColor } from "@/lib/subjects";
import { LearnSnapshot } from "@/learn/components/LearnSnapshot";
import type { LearnDay, TopicProgress } from "@/learn/progress";
import type { PageMeta, Task } from "@/lib/types";
import { cn, firstName, greeting, pageTitle } from "@/lib/utils";
import { formatDistanceStrict } from "date-fns";

const rise = {
  hidden: { opacity: 0, y: 10 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.04 * i, type: "spring" as const, stiffness: 420, damping: 32 } }),
};

export function HomeView({
  tasks,
  previews,
  openTasks,
  openTotal,
  learn,
}: {
  tasks: Task[];
  previews: Record<string, PagePreview>;
  openTasks: Record<string, number>;
  openTotal: number;
  learn: { progress: Record<string, TopicProgress>; days: LearnDay[] };
}) {
  const router = useRouter();
  const now = useNow();
  const { openSearch } = useShell();
  const { profile, pages, subjects, createPage } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(homeText);
  const blobRef = useRef<BlobHandle>(null);
  const [busy, setBusy] = useState<"note" | "deck" | null>(null);

  const recent = [...pages].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  const name = firstName(profile.full_name);

  async function create(kind: "note" | "deck") {
    setBusy(kind);
    const page = await createPage({ kind });
    setBusy(null);
    if (page) router.push(`/p/${page.id}`);
  }

  return (
    <>
      <TopBar crumbs={[{ label: t.title }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1480px] px-6 pb-16 pt-4 lg:px-10">
          {/* Greeting */}
          <motion.section initial="hidden" animate="shown" className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <motion.div variants={rise} custom={0} className="-mb-2 -ml-3 hidden sm:block">
              <Blob ref={blobRef} size={104} mood="happy" onClick={() => blobRef.current?.jump(1)} title="Blob" />
            </motion.div>
            <motion.div variants={rise} custom={1} className="min-w-0 flex-1 pb-1">
              <p className="h-5 text-[13px] text-ink-3" suppressHydrationWarning>
                {now ? format(now, t.dateFormat, { locale: dateLocale(locale) }) : ""}
              </p>
              <h1 className="font-display text-[32px] font-bold leading-tight tracking-[-0.03em]">
                {now ? greeting(new Date(now), locale) : t.hello}
                {name ? `, ${name}` : ""}
              </h1>
              <p className="mt-0.5 text-[14px] text-ink-2">
                {openTotal === 0 ? t.nothingOpen : t.openTasks(openTotal)}
              </p>
            </motion.div>
            <motion.div variants={rise} custom={2} className="flex flex-wrap gap-1.5 pb-1">
              <QuickAction icon={<FilePlus2 />} onClick={() => create("note")} busy={busy === "note"} primary>
                {t.newNote}
              </QuickAction>
              <QuickAction icon={<Presentation />} onClick={() => create("deck")} busy={busy === "deck"}>
                {t.newDeck}
              </QuickAction>
              <QuickAction icon={<ListPlus />} onClick={() => router.push("/tasks?new=1")}>
                {t.addTask}
              </QuickAction>
              <QuickAction icon={<Search />} onClick={openSearch}>
                {t.search}
                <span className="ml-1 flex gap-0.5">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </QuickAction>
            </motion.div>
          </motion.section>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* Recent pages */}
            <motion.section initial="hidden" animate="shown" variants={rise} custom={3} className="min-w-0">
              <SectionTitle>{t.recent}</SectionTitle>
              {recent.length === 0 ? (
                <EmptyRecent onCreate={() => create("note")} />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
                  {recent.map((page, i) => (
                    <motion.div key={page.id} variants={rise} custom={4 + i} initial="hidden" animate="shown">
                      {page.kind === "deck" ? (
                        <RecentDeck page={page} preview={previews[page.id]} now={now} />
                      ) : (
                        <NoteCard page={page} preview={previews[page.id]} parent={pages.find((p) => p.id === page.parent_id)} now={now} />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>

            {/* Due soon */}
            <motion.section initial="hidden" animate="shown" variants={rise} custom={4} className="min-w-0">
              <SectionTitle>{t.comingUp}</SectionTitle>
              <UpcomingTasks initialTasks={tasks} limit={7} days={7} />
              <div className="mt-7">
                <SectionTitle
                  action={
                    <Link href="/learn" className="text-[12.5px] font-medium text-ink-3 hover:text-ink">
                      {t.allTopics}
                    </Link>
                  }
                >
                  {t.keepLearning}
                </SectionTitle>
                <LearnSnapshot progress={learn.progress} days={learn.days} />
              </div>
            </motion.section>
          </div>

          {/* Subjects */}
          <motion.section initial="hidden" animate="shown" variants={rise} custom={6} className="mt-10">
            <SectionTitle>{t.subjects}</SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
              {subjects.map((s, i) => {
                const notes = pages.filter((p) => p.subject_id === s.id && p.kind === "note").length;
                const decks = pages.filter((p) => p.subject_id === s.id && p.kind === "deck").length;
                const open = openTasks[s.id] ?? 0;
                return (
                  <motion.div key={s.id} variants={rise} custom={7 + i} initial="hidden" animate="shown">
                    <Link
                      href={`/subjects/${s.id}`}
                      className="group relative flex h-[92px] flex-col overflow-hidden rounded-xl border border-line bg-raised p-3.5 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2"
                    >
                      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: subjectColor(s.color) }} />
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] leading-none">{s.emoji ?? "📚"}</span>
                        <span className="truncate text-[14px] font-medium">{s.name}</span>
                        <ArrowUpRight className="ml-auto size-3.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-auto flex gap-3 text-[12px] text-ink-3">
                        <span className="shrink-0">{t.notes(notes)}</span>
                        {decks > 0 && <span className="min-w-0 truncate">{t.decks(decks)}</span>}
                        <span className={cn("shrink-0", open > 0 && "font-medium text-blob-ink")}>{t.open(open)}</span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              <AddSubjectCard />
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{children}</h2>
      {action}
    </div>
  );
}

function QuickAction({
  icon,
  children,
  onClick,
  busy,
  primary,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "flex h-8.5 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-[background,transform,border] active:scale-[0.97] disabled:opacity-60 [&>svg]:size-4",
        primary ? "bg-ink text-paper hover:bg-ink/88" : "border border-line bg-raised text-ink-2 shadow-card hover:border-line-2 hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyRecent({ onCreate }: { onCreate: () => void }) {
  const t = useMessages(homeText);
  return (
    <div className="flex h-[150px] items-center justify-center gap-5 rounded-xl border border-dashed border-line-2 px-6">
      <Blob size={84} mood="sleepy" track={false} />
      <div>
        <p className="font-medium">{t.quiet}</p>
        <p className="text-[13px] text-ink-2">{t.quietHint}</p>
        <button onClick={onCreate} className="mt-2 text-[13px] font-medium text-blob-ink hover:underline">
          {t.firstNote}
        </button>
      </div>
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
      <button
        onClick={() => setEditing(true)}
        className="flex h-[92px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-2 text-[13px] text-ink-3 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink"
      >
        <Plus className="size-4" /> {t.addSubject}
      </button>
    );
  }
  return (
    <form
      className="flex h-[92px] flex-col justify-center gap-2 rounded-xl border border-blob/60 bg-raised p-3"
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
        maxLength={60}
        className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] outline-none focus:border-blob"
      />
      <span className="text-[11.5px] text-ink-3">{t.enterToAdd}</span>
    </form>
  );
}

/** Same footprint as a NoteCard so the grid stays even. */
function RecentDeck({ page, preview, now }: { page: PageMeta; preview?: PagePreview; now: number | null }) {
  const locale = useLocale();
  const name = pageTitle(page.title, page.kind, locale);
  return (
    <Link
      href={`/p/${page.id}`}
      className="group flex h-[150px] flex-col rounded-xl border border-line bg-raised p-2 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2"
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg">
        <SlideThumb title={preview?.slideTitle?.trim() || name} theme={preview?.theme ?? null} className="h-full w-full rounded-lg [aspect-ratio:auto]" />
      </div>
      <div className="flex min-w-0 items-center gap-2 px-1.5 pt-2">
        <PageIcon page={page} className="size-3.5" />
        <span className="truncate text-[13.5px] font-medium">{name}</span>
        <span className="ml-auto shrink-0 text-[11.5px] text-ink-3" suppressHydrationWarning>
          {now ? formatDistanceStrict(new Date(page.updated_at), now, { addSuffix: true, locale: dateLocale(locale) }) : ""}
        </span>
      </div>
    </Link>
  );
}
