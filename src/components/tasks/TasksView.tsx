"use client";

import { addWeeks, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { LayoutList, ListChecks, Plus, SquareKanban, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { PageBody, PageHeader } from "@/components/shell/PageHeader";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { chipOn, midTone } from "@/components/ui/surfaces";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { tasksText } from "@/i18n/messages/tasks";
import { TASK_KINDS, dayKey, formatDue, isDueByToday, taskBucket } from "@/lib/tasks";
import type { AssignedCard } from "@/lib/tasks";
import type { Task, TaskKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickAdd, type QuickAddHandle } from "./QuickAdd";
import { TaskBoard, UndoToast } from "./TaskBoard";
import { FromProjects } from "./FromProjects";
import { PersonalBoard } from "./PersonalBoard";
import { CalendarHeat, KindFilter, Panel, SubjectFilter, WeekProgress } from "./TaskInsights";
import { useNow } from "./useNow";
import { useTaskStore } from "./useTaskStore";

type Filters = { day: string | null; kind: TaskKind | null; subject: string | null };
const NO_FILTERS: Filters = { day: null, kind: null, subject: null };

type View = "list" | "board";
const VIEW_KEY = "blob-tasks-view";

/**
 * The full Tasks page: quick add + grouped list (or the board: To do, Doing, Done) on the left,
 * calendar, filters and cards assigned to you in projects on the right. The top bar holds the view
 * switch and the violet "+ Neue Aufgabe" (it puts the cursor into the quick add, like "n" does).
 */
export function TasksView({ initialTasks, assigned = [] }: { initialTasks: Task[]; assigned?: AssignedCard[] }) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const store = useTaskStore(initialTasks);
  const { subjects } = useWorkspace();
  const now = useNow();
  const params = useSearchParams();
  const quick = useRef<QuickAddHandle>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [mode, setMode] = useState<View>("list");
  const tasks = store.tasks;

  // List or board: the one you used last.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a preference after mount
      if (localStorage.getItem(VIEW_KEY) === "board") setMode("board");
    } catch {}
  }, []);
  const chooseMode = (next: View) => {
    setMode(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
  };

  // /tasks?new=1 (from the command palette or Blob): focus the quick add, then tidy the URL.
  const wantsNew = params.get("new") === "1";
  useEffect(() => {
    if (!wantsNew) return;
    quick.current?.focus();
    window.history.replaceState(null, "", "/tasks");
  }, [wantsNew]);

  // "n" focuses the quick add from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      quick.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const view = useMemo(() => {
    if (!now) return null;
    const byDay = (t: Task) =>
      !filters.day || (filters.day === "overdue" ? taskBucket(t, now) === "overdue" : !!t.due_at && dayKey(t.due_at) === filters.day);
    const byKind = (t: Task) => !filters.kind || t.kind === filters.kind;
    const bySubject = (t: Task) => !filters.subject || (filters.subject === "none" ? !t.subject_id : t.subject_id === filters.subject);
    const open = tasks.filter((t) => !t.done);

    const kindCounts = Object.fromEntries(TASK_KINDS.map((k) => [k, 0])) as Record<TaskKind, number>;
    for (const t of open) if (byDay(t) && bySubject(t)) kindCounts[t.kind]++;

    const subjectCounts = new Map<string, number>();
    let noSubject = 0;
    for (const t of open) {
      if (!byDay(t) || !byKind(t)) continue;
      if (t.subject_id) subjectCounts.set(t.subject_id, (subjectCounts.get(t.subject_id) ?? 0) + 1);
      else noSubject++;
    }

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addWeeks(weekStart, 1);
    const thisWeek = tasks.filter((t) => t.due_at && new Date(t.due_at) >= weekStart && new Date(t.due_at) < weekEnd);

    return {
      visible: tasks.filter((t) => byDay(t) && byKind(t) && bySubject(t)),
      heatTasks: open.filter((t) => byKind(t) && bySubject(t)),
      kindCounts,
      subjectCounts,
      noSubject,
      open: open.length,
      dueToday: open.filter((t) => t.due_at && differenceInCalendarDays(new Date(t.due_at), now) === 0).length,
      overdue: open.filter((t) => taskBucket(t, now) === "overdue").length,
      weekDone: thisWeek.filter((t) => t.done).length,
      weekTotal: thisWeek.length,
      clearedToday:
        !open.some((t) => isDueByToday(t, now)) && tasks.some((t) => t.done && t.completed_at && differenceInCalendarDays(new Date(t.completed_at), now) === 0),
      nextUp: open.find((t) => t.due_at),
    };
  }, [tasks, filters, now]);

  const filtered = !!(filters.day || filters.kind || filters.subject);
  const filterSubject = filters.subject && filters.subject !== "none" ? subjects.find((s) => s.id === filters.subject) : null;
  const filterDay = filters.day && filters.day !== "overdue" ? new Date(`${filters.day}T00:00:00`) : null;

  const chips: { key: keyof Filters; label: string }[] = [];
  if (filters.day)
    chips.push({ key: "day", label: filters.day === "overdue" ? t.group.overdue : t.dueOn(format(filterDay!, t.filterDayFormat, { locale: dateLocale(locale) })) });
  if (filters.kind) chips.push({ key: "kind", label: t.kindPlural[filters.kind] });
  if (filters.subject) chips.push({ key: "subject", label: filters.subject === "none" ? t.noSubject : (filterSubject?.name ?? t.subject) });

  const counts = view ? (
    <>
      {t.open(view.open)}
      {view.dueToday > 0 && (
        <>
          {" · "}
          <span className="text-blob-ink">{t.dueToday(view.dueToday)}</span>
        </>
      )}
      {view.overdue > 0 && (
        <>
          {" · "}
          <span className="text-danger">{t.overdue(view.overdue)}</span>
        </>
      )}
    </>
  ) : (
    // Same height before the counts are known (they need the time of day): no jump.
    "\u00a0"
  );

  return (
    <>
      <TopBar
        crumbs={[{ label: t.title, icon: <ListChecks className="size-3.5 text-ink-3" /> }]}
        actions={
          <>
            <Segmented
              kind="tabs"
              compact
              value={mode}
              onChange={chooseMode}
              label={t.view}
              options={[
                { value: "list", label: t.viewList, icon: <LayoutList /> },
                { value: "board", label: t.viewBoard, icon: <SquareKanban /> },
              ]}
            />
            <Button variant="blob" size="bar" className="ml-1" onClick={() => quick.current?.focus()} title={`${t.newTask} (N)`} aria-keyshortcuts="N">
              <Plus className="size-4" strokeWidth={2.4} aria-hidden />
              <span className="max-sm:sr-only">{t.newTask}</span>
            </Button>
          </>
        }
      />
      <PageBody>
        {/* grid-cols-1 (a minmax(0, 1fr) track): a long subject name in the filters must not widen the page. */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_288px]">
          <section className="min-w-0">
            <PageHeader title={t.title} meta={counts} />

            <QuickAdd
              ref={quick}
              onAdd={store.add}
              subjects={subjects}
              defaultSubjectId={filterSubject?.id ?? null}
              defaultDay={filterDay}
              autoFocus={wantsNew}
              shortcut="N"
            />

            <AnimatePresence initial={false}>
              {filtered && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-1.5 pt-3">
                    <span className={cn("text-[12.5px]", midTone)}>{t.showing}</span>
                    {chips.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, [c.key]: null }))}
                        aria-label={t.removeFilter(c.label)}
                        title={t.removeFilter(c.label)}
                        className={cn(
                          "group inline-flex h-7 max-w-full items-center gap-1 rounded-full border pl-2.5 pr-1.5 text-[12.5px] font-medium transition-colors hover:border-blob/70 [@media(hover:none)]:h-8",
                          chipOn,
                        )}
                      >
                        <span className="truncate">{c.label}</span>
                        <X className="size-3.5 shrink-0 opacity-70 group-hover:opacity-100" aria-hidden />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFilters(NO_FILTERS)}
                      className="ml-0.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
                    >
                      {t.clear}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {view && view.clearedToday && !filtered && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-blob/25 bg-blob-soft/60 py-2 pl-2 pr-4">
                    <Blob size={44} mood="happy" track={false} />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">{t.allClearToday}</p>
                      <p className="truncate text-[12.5px] text-ink-2">
                        {view.nextUp && now ? (
                          <>
                            {t.nextUp} {view.nextUp.title} <span className={midTone}>· {formatDue(view.nextUp.due_at!, now, locale)}</span>
                          </>
                        ) : (
                          t.nothingElse
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "board" && tasks.length > 0 ? (
              <div className="mt-5">
                <PersonalBoard store={store} tasks={view?.visible ?? tasks} subjects={subjects} now={now} />
              </div>
            ) : (
              <TaskBoard
                className="mt-5"
                store={store}
                tasks={view?.visible ?? tasks}
                subjects={subjects}
                empty={
                  tasks.length === 0 ? (
                    <NothingYet onExample={(text) => quick.current?.fill(text)} />
                  ) : (
                    <EmptyState
                      size="sm"
                      className="mt-4"
                      title={t.nothingMatches}
                      actions={
                        <Button variant="secondary" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                          {t.clearFilters}
                        </Button>
                      }
                    />
                  )
                }
              />
            )}
          </section>

          {/* Wide screens: a quiet rail beside the list, like the calendar's (a hairline, no boxes), sticky,
              scrolling on its own once many subjects make it taller than the screen. Below 1280 px the
              list needs the width (its rows keep room for subject and date): the boxes go under it,
              calendar on the left, filters on the right. Phones: one column. */}
          <aside className="grid min-w-0 grid-cols-1 content-start gap-3 md:grid-cols-2 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-7.5rem)] xl:grid-cols-1 xl:gap-7 xl:self-start xl:overflow-y-auto xl:border-l xl:border-line xl:pl-6 xl:[scrollbar-width:thin]">
            {view && now ? (
              <>
                <Panel
                  className="md:row-span-2 md:self-start xl:row-span-1"
                  title={t.nextTwoWeeks}
                  action={<span className={cn("text-[11.5px]", midTone)}>{format(now, t.monthFormat, { locale: dateLocale(locale) })}</span>}
                >
                  <CalendarHeat
                    tasks={view.heatTasks}
                    now={now}
                    selected={filters.day}
                    overdue={view.overdue}
                    onSelect={(day) => setFilters((f) => ({ ...f, day }))}
                  />
                  {view.weekTotal > 0 && (
                    <div className="mt-3.5 border-t border-line pt-3">
                      <WeekProgress done={view.weekDone} total={view.weekTotal} />
                    </div>
                  )}
                </Panel>
                <Panel title={t.byType}>
                  <KindFilter counts={view.kindCounts} value={filters.kind} onChange={(kind) => setFilters((f) => ({ ...f, kind }))} />
                </Panel>
                <Panel title={t.subjects}>
                  <SubjectFilter
                    subjects={subjects}
                    counts={view.subjectCounts}
                    noSubject={view.noSubject}
                    value={filters.subject}
                    onChange={(subject) => setFilters((f) => ({ ...f, subject }))}
                  />
                </Panel>
                <Panel
                  title={t.fromProjects}
                  action={
                    <Link href="/projects" className={cn("rounded-md px-1 py-0.5 text-[11.5px] font-medium hover:bg-hover hover:text-ink", midTone)}>
                      {t.allProjects}
                    </Link>
                  }
                >
                  <FromProjects initial={assigned} />
                </Panel>
              </>
            ) : (
              <div className="h-[420px] rounded-xl border border-line md:col-span-2 xl:col-span-1 xl:border-0" aria-hidden />
            )}
          </aside>
        </div>
      </PageBody>
      <UndoToast store={store} />
    </>
  );
}

/** No tasks at all: Blob, what to do, and examples that fill the quick add. */
function NothingYet({ onExample }: { onExample: (text: string) => void }) {
  const t = useMessages(tasksText);
  return (
    <EmptyState
      className="mt-2"
      art={<Blob size={88} mood="sleepy" />}
      title={t.emptyTitle}
      body={t.emptyBody}
      actions={t.examples.map((ex) => (
        <button key={ex} type="button" onClick={() => onExample(ex)} className="blob-chip">
          {ex}
        </button>
      ))}
    />
  );
}
