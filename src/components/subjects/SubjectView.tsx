"use client";

import { differenceInCalendarDays, format, isSameYear } from "date-fns";
import { ArrowRight, FilePlus2, Presentation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { SubjectMenu } from "@/components/shell/SubjectMenu";
import { TopBar } from "@/components/shell/TopBar";
import { QuickAdd } from "@/components/tasks/QuickAdd";
import { TaskBoard, UndoToast } from "@/components/tasks/TaskBoard";
import { useNow } from "@/components/tasks/useNow";
import { useTaskStore, type NewTask } from "@/components/tasks/useTaskStore";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { subjectsText } from "@/i18n/messages/subjects";
import { subjectColor } from "@/lib/subjects";
import type { PageKind, Subject, Task } from "@/lib/types";
import { DeckCard, NewCard, NoteCard, type PagePreview } from "./PageCards";

/** Everything for one subject: notes, presentations and its tasks. */
export function SubjectView({ subject: initial, previews, initialTasks }: { subject: Subject; previews: Record<string, PagePreview>; initialTasks: Task[] }) {
  const router = useRouter();
  const { subjects, pages, createPage } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(subjectsText);
  // Prefer the live copy so renames, recolors and new emojis show up immediately.
  const subject = subjects.find((s) => s.id === initial.id) ?? initial;
  const store = useTaskStore(initialTasks);
  const now = useNow();
  const [creating, setCreating] = useState<PageKind | null>(null);

  const { notes, decks, byId } = useMemo(() => {
    const mine = pages.filter((p) => p.subject_id === subject.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return { notes: mine.filter((p) => p.kind === "note"), decks: mine.filter((p) => p.kind === "deck"), byId: new Map(pages.map((p) => [p.id, p])) };
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

  function addTask(task: NewTask) {
    store.add(task);
    if (task.subject_id !== subject.id) {
      const other = subjects.find((s) => s.id === task.subject_id);
      blob.say(other ? t.addedTo(other.name) : t.addedToTasks, { mood: "happy" });
    }
  }

  const icon = subject.emoji ? (
    <span className="text-[12px] leading-none">{subject.emoji}</span>
  ) : (
    <span className="size-2 rounded-full" style={{ background: subjectColor(subject.color) }} />
  );

  const stats = [t.noteCount(notes.length), t.deckCount(decks.length), t.openTaskCount(open.length)];

  return (
    <>
      <TopBar crumbs={[{ label: subject.name, icon }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-5 sm:px-8 lg:px-10 lg:pt-7">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-4">
            <div className="relative grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-raised shadow-card">
              {subject.emoji ? (
                <span className="text-[28px] leading-none">{subject.emoji}</span>
              ) : (
                <span className="size-5 rounded-full" style={{ background: subjectColor(subject.color) }} />
              )}
              {subject.emoji && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-surface"
                  style={{ background: subjectColor(subject.color) }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h1 className="truncate font-display text-[30px] font-bold leading-tight tracking-[-0.025em]">{subject.name}</h1>
                <SubjectMenu key={subject.id} subject={subject} trigger="button" />
              </div>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {stats.join(" · ")}
                {nextExam && now && (
                  <>
                    {" · "}
                    <span className="text-blob-ink">{t.nextExam(examWhen(nextExam.due_at!, now, locale))}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => create("note")} loading={creating === "note"}>
                <FilePlus2 className="size-4" /> {t.newNote}
              </Button>
              <Button variant="secondary" onClick={() => create("deck")} loading={creating === "deck"}>
                <Presentation className="size-4" /> {t.newDeck}
              </Button>
            </div>
          </header>

          <div className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-9">
              <Section title={t.notes} count={notes.length}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
                  {notes.map((p) => (
                    <NoteCard key={p.id} page={p} preview={previews[p.id]} parent={p.parent_id ? byId.get(p.parent_id) : undefined} now={now} />
                  ))}
                  <NewCard kind="note" onClick={() => create("note")} busy={creating === "note"} />
                </div>
              </Section>

              <Section title={t.presentations} count={decks.length}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
                  {decks.map((p) => (
                    <DeckCard key={p.id} page={p} preview={previews[p.id]} now={now} />
                  ))}
                  <NewCard kind="deck" onClick={() => create("deck")} busy={creating === "deck"} />
                </div>
              </Section>
            </div>

            <aside className="min-w-0 rounded-2xl border border-line bg-raised/50 p-3.5 lg:sticky lg:top-7 lg:self-start dark:bg-raised/40">
              <Section
                title={t.tasks}
                count={open.length}
                action={
                  <Link href="/tasks" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-hover hover:text-ink">
                    {t.allTasks} <ArrowRight className="size-3" />
                  </Link>
                }
              >
                <QuickAdd size="sm" onAdd={addTask} subjects={subjects} defaultSubjectId={subject.id} placeholder={t.addTaskFor(subject.name)} />
                <TaskBoard
                  className="mt-3"
                  store={store}
                  tasks={tasks}
                  subjects={subjects}
                  hideSubject
                  narrow
                  doneLimit={3}
                  empty={
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-line-2 px-3 py-3">
                      <Blob size={48} mood="sleepy" track={false} />
                      <p className="text-[12.5px] leading-snug text-ink-2">
                        {t.noTasksFor(subject.name)}
                        <br />
                        <span className="text-ink-3">{t.noTasksHint}</span>
                      </p>
                    </div>
                  }
                />
              </Section>
            </aside>
          </div>
        </div>
      </div>
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

function Section({ title, count, action, children }: { title: string; count: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex h-6 items-center gap-2">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-hover px-1.5 text-[11px] font-medium leading-[18px] tabular-nums text-ink-3">{count}</span>
        <span className="ml-auto">{action}</span>
      </div>
      {children}
    </section>
  );
}
