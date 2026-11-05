"use client";

import { differenceInCalendarDays, format, isSameYear } from "date-fns";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { ProjectRow } from "@/components/home/ProjectsBlock";
import { useImporter } from "@/components/notes/useImporter";
import type { ProjectSummary } from "@/components/projects/load";
import { NewPageButton, type NewKind } from "@/components/shell/NewPageMenu";
import { PageBody, PageHeader, SectionHeader } from "@/components/shell/PageHeader";
import { SubjectMenu } from "@/components/shell/SubjectMenu";
import { TopBar } from "@/components/shell/TopBar";
import { QuickAdd } from "@/components/tasks/QuickAdd";
import { TaskBoard, UndoToast } from "@/components/tasks/TaskBoard";
import { useNow } from "@/components/tasks/useNow";
import { useTaskStore, type NewTask } from "@/components/tasks/useTaskStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { panel } from "@/components/ui/surfaces";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { projectLinksText } from "@/i18n/messages/projectLinks";
import { subjectsText } from "@/i18n/messages/subjects";
import { subjectColor } from "@/lib/subjects";
import type { PageKind, Subject, Task } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { subjectCounts } from "./counts";
import { DeckCard, FolderCard, InkCard, NewCard, NoteCard, SheetCard, type PagePreview } from "./PageCards";

/**
 * Everything for one subject: its notes and spreadsheets (always, each with its add tile), its
 * handwriting, presentations, folders (the order of every create menu) and projects when it has
 * some, and its tasks beside them.
 * The top bar's violet "+ Neue Notiz" makes a note here; its ▾ the other kinds (or imports a file).
 */
export function SubjectView({
  subject: initial,
  previews,
  initialTasks,
  projects,
}: {
  subject: Subject;
  previews: Record<string, PagePreview>;
  initialTasks: Task[];
  /** The subject's active projects (yours and the ones you're in). */
  projects: ProjectSummary[];
}) {
  const router = useRouter();
  const { subjects, pages, createPage } = useWorkspace();
  const importer = useImporter();
  const locale = useLocale();
  const t = useMessages(subjectsText);
  const tl = useMessages(projectLinksText);
  // Prefer the live copy so renames, recolors and new emojis show up immediately.
  const subject = subjects.find((s) => s.id === initial.id) ?? initial;
  const store = useTaskStore(initialTasks, { subjectId: subject.id });
  const now = useNow();
  const [creating, setCreating] = useState<PageKind | null>(null);

  const { notes, inks, sheets, decks, folders, byId } = useMemo(() => {
    const mine = pages.filter((p) => p.subject_id === subject.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return {
      notes: mine.filter((p) => p.kind === "note"),
      inks: mine.filter((p) => p.kind === "ink"),
      sheets: mine.filter((p) => p.kind === "sheet"),
      decks: mine.filter((p) => p.kind === "deck"),
      folders: mine.filter((p) => p.kind === "folder"),
      byId: new Map(pages.map((p) => [p.id, p])),
    };
  }, [pages, subject.id]);

  const tasks = useMemo(() => store.tasks.filter((t) => t.subject_id === subject.id), [store.tasks, subject.id]);
  const open = tasks.filter((t) => !t.done);
  const nextExam = now
    ? open
        .filter((t) => t.kind === "exam" && t.due_at && differenceInCalendarDays(new Date(t.due_at), now) >= 0)
        .sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0]
    : undefined;

  async function create(kind: PageKind) {
    if (creating) return;
    setCreating(kind);
    const page = await createPage({ kind, subject_id: subject.id });
    setCreating(null);
    if (page) router.push(`/p/${page.id}`);
  }
  const pick = (kind: NewKind) => void create(kind);

  function addTask(task: NewTask) {
    store.add(task);
    if (task.subject_id !== subject.id) {
      const other = subjects.find((s) => s.id === task.subject_id);
      blob.say(other ? t.addedTo(other.name) : t.addedToTasks, { mood: "happy" });
    }
  }

  const color = subjectColor(subject.color);
  const crumbIcon = subject.emoji ? <span className="text-[12px] leading-none">{subject.emoji}</span> : <span className="size-2 rounded-full" style={{ background: color }} />;
  // The emoji on its tile with the subject's colour as a dot at the corner; without an emoji, the colour itself.
  const headerIcon = subject.emoji ? (
    <span className="relative -m-px grid size-10 place-items-center">
      <span className="leading-none">{subject.emoji}</span>
      <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-paper" style={{ background: color }} />
    </span>
  ) : (
    <span aria-hidden className="size-3.5 rounded-full" style={{ background: color }} />
  );

  // What's in it, only what there is, counted as Start's subject cards count it: "2 Notizen ·
  // 1 Tabelle · 1 Handschrift", then the tasks: "3 offene Aufgaben · Nächster Test morgen". On phones
  // only the tasks part when there is one (each section shows its own count), so the line stays short.
  const pageStats = subjectCounts([...notes, ...sheets, ...inks, ...decks, ...folders], t);
  const exam = nextExam && now ? t.nextExam(examWhen(nextExam.due_at!, now, locale)) : null;
  const taskInfo = open.length > 0 || !!exam;
  const meta = (
    // The line may wrap (wrapMeta) instead of losing its end: the next test is the part that matters most.
    <span>
      <span className={cn(taskInfo && "max-sm:hidden")}>{pageStats.join(" · ")}</span>
      {taskInfo && <span className="max-sm:hidden"> · </span>}
      {open.length > 0 && t.openTaskCount(open.length)}
      {exam && (
        <>
          {open.length > 0 && " · "}
          <span className="text-blob-ink">{exam}</span>
        </>
      )}
    </span>
  );

  const parentOf = (parentId: string | null) => (parentId ? byId.get(parentId) : undefined);

  return (
    <>
      <TopBar
        crumbs={[{ label: subject.name, icon: crumbIcon }]}
        actions={<NewPageButton kind="note" onPick={pick} onImport={() => importer.pick({ subjectId: subject.id })} busy={creating !== null} />}
      />
      <PageBody>
        <PageHeader
          icon={headerIcon}
          title={<span title={subject.name}>{subject.name}</span>}
          meta={meta}
          wrapMeta
          actions={<SubjectMenu key={subject.id} subject={subject} trigger="button" />}
        />

        {/* The tasks beside the pages from 1280 px; below, the cards need the width (two columns at least). */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-9">
            <Section id="subject-notes" title={t.notes} count={notes.length}>
              <CardGrid>
                {notes.map((p) => (
                  <NoteCard key={p.id} page={p} preview={previews[p.id]} parent={parentOf(p.parent_id)} now={now} />
                ))}
                <NewCard kind="note" onClick={() => pick("note")} busy={creating === "note"} alone={notes.length === 0} />
              </CardGrid>
            </Section>

            <Section id="subject-sheets" title={t.sheets} count={sheets.length}>
              <CardGrid>
                {sheets.map((p) => (
                  <SheetCard key={p.id} page={p} preview={previews[p.id]} now={now} />
                ))}
                <NewCard kind="sheet" onClick={() => pick("sheet")} busy={creating === "sheet"} alone={sheets.length === 0} />
              </CardGrid>
            </Section>

            {inks.length > 0 && (
              <Section id="subject-inks" title={t.inks} count={inks.length}>
                <CardGrid>
                  {inks.map((p) => (
                    <InkCard key={p.id} page={p} preview={previews[p.id]} now={now} />
                  ))}
                  <NewCard kind="ink" onClick={() => pick("ink")} busy={creating === "ink"} />
                </CardGrid>
              </Section>
            )}

            {decks.length > 0 && (
              <Section id="subject-decks" title={t.presentations} count={decks.length}>
                <CardGrid>
                  {decks.map((p) => (
                    <DeckCard key={p.id} page={p} preview={previews[p.id]} now={now} />
                  ))}
                  <NewCard kind="deck" onClick={() => pick("deck")} busy={creating === "deck"} />
                </CardGrid>
              </Section>
            )}

            {folders.length > 0 && (
              <Section id="subject-folders" title={t.folders} count={folders.length}>
                <CardGrid>
                  {folders.map((f) => {
                    const inside = pages.filter((p) => p.parent_id === f.id);
                    return <FolderCard key={f.id} page={f} inside={{ count: inside.length, titles: inside.slice(0, 3).map((c) => pageTitle(c.title, c.kind, locale)) }} now={now} />;
                  })}
                  <NewCard kind="folder" onClick={() => pick("folder")} busy={creating === "folder"} />
                </CardGrid>
              </Section>
            )}

            {projects.length > 0 && (
              <Section
                id="subject-projects"
                title={tl.projects}
                count={projects.length}
                action={
                  <Link
                    href={`/projects?new=1&subject=${subject.id}`}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:-my-1.5 [@media(hover:none)]:py-2"
                  >
                    <Plus className="size-3.5" aria-hidden /> {tl.newProjectFor}
                  </Link>
                }
              >
                <div className="grid grid-cols-1 gap-2.5 min-[720px]:grid-cols-2">
                  {projects.map((p) => (
                    <ProjectRow key={p.id} project={p} />
                  ))}
                </div>
              </Section>
            )}
          </div>

          <aside aria-labelledby="subject-tasks" className={cn(panel, "min-w-0 xl:sticky xl:top-6 xl:self-start")}>
            <SectionHeader
              id="subject-tasks"
              title={t.tasks}
              count={open.length}
              action={
                <Link
                  href="/tasks"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:-my-1.5 [@media(hover:none)]:py-2"
                >
                  {t.allTasks} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
            <QuickAdd size="sm" onAdd={addTask} subjects={subjects} defaultSubjectId={subject.id} placeholder={t.addTaskFor(subject.name)} />
            <TaskBoard
              className="mt-3"
              store={store}
              tasks={tasks}
              subjects={subjects}
              hideSubject
              narrow
              doneLimit={3}
              empty={<EmptyState size="sm" art={<Blob size={56} mood="sleepy" track={false} />} title={t.noTasksFor(subject.name)} body={t.noTasksHint} />}
            />
          </aside>
        </div>
      </PageBody>
      <UndoToast store={store} />
    </>
  );
}

/** "today", "tomorrow", "on Fri", "Oct 12" (German: "heute", "morgen", "am Freitag", "am 12. Okt."). Never in the past. */
function examWhen(due: string, now: number, locale: Locale) {
  const t = subjectsText[locale];
  const d = new Date(due);
  const days = differenceInCalendarDays(d, now);
  if (days === 0) return t.today;
  if (days === 1) return t.tomorrow;
  const opts = { locale: dateLocale(locale) };
  if (days < 7) return t.onWeekday(format(d, t.weekdayFormat, opts));
  return t.onDate(format(d, isSameYear(d, now) ? t.dateFormat : t.dateYearFormat, opts));
}

function Section({ id, title, count, action, children }: { id: string; title: string; count: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <SectionHeader id={id} title={title} count={count} action={action} />
      {children}
    </section>
  );
}

/** The page cards of a section: two columns on phones, as many as fit from tablets up (cards line up in height). */
function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-3">{children}</div>;
}
