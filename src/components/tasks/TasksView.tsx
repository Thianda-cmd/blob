"use client";

import { addWeeks, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { Kbd } from "@/components/ui/Kbd";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { tasksText } from "@/i18n/messages/tasks";
import { TASK_KINDS, dayKey, formatDue, isDueByToday, taskBucket } from "@/lib/tasks";
import type { Task, TaskKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickAdd, type QuickAddHandle } from "./QuickAdd";
import { TaskBoard, UndoToast } from "./TaskBoard";
import { CalendarHeat, KindFilter, Panel, SubjectFilter, WeekProgress } from "./TaskInsights";
import { useNow } from "./useNow";
import { useTaskStore } from "./useTaskStore";

type Filters = { day: string | null; kind: TaskKind | null; subject: string | null };
const NO_FILTERS: Filters = { day: null, kind: null, subject: null };

/** The full Tasks page: quick add + grouped list on the left, calendar and filters on the right. */
export function TasksView({ initialTasks }: { initialTasks: Task[] }) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const store = useTaskStore(initialTasks);
  const { subjects } = useWorkspace();
  const now = useNow();
  const params = useSearchParams();
  const quick = useRef<QuickAddHandle>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const tasks = store.tasks;

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

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* grid-cols-1 (a minmax(0, 1fr) track): a long subject name in the filters must not widen the page. */}
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-x-10 gap-y-8 px-4 pb-28 pt-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-10 lg:pt-7">
        <section className="min-w-0">
          <header className="mb-4 flex items-end gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.025em]">{t.title}</h1>
              <p className="mt-0.5 h-5 text-[13px] text-ink-3">
                {view && (
                  <>
                    {t.open(view.open)}
                    {view.dueToday > 0 && <> · <span className="text-blob-ink">{t.dueToday(view.dueToday)}</span></>}
                    {view.overdue > 0 && <> · <span className="text-danger">{t.overdue(view.overdue)}</span></>}
                  </>
                )}
              </p>
            </div>
            <span className="ml-auto hidden items-center gap-1.5 pb-1 text-[11.5px] text-ink-3 md:flex [@media(hover:none)]:hidden">
              {t.pressBefore} <Kbd>N</Kbd> {t.pressAfter}
            </span>
          </header>

          <QuickAdd
            ref={quick}
            onAdd={store.add}
            subjects={subjects}
            defaultSubjectId={filterSubject?.id ?? null}
            defaultDay={filterDay}
            autoFocus={wantsNew}
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
                  <span className="text-[12px] text-ink-3">{t.showing}</span>
                  {chips.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setFilters((f) => ({ ...f, [c.key]: null }))}
                      className="group inline-flex h-6 items-center gap-1 rounded-md bg-ink pl-2 pr-1 text-[12px] font-medium text-paper"
                    >
                      {c.label}
                      <X className="size-3 opacity-60 group-hover:opacity-100" />
                    </button>
                  ))}
                  <button onClick={() => setFilters(NO_FILTERS)} className="ml-1 text-[12px] text-ink-3 hover:text-ink">
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
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-blob-soft/60 py-2 pl-2 pr-4">
                  <Blob size={44} mood="happy" track={false} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">{t.allClearToday}</p>
                    <p className="truncate text-[12.5px] text-ink-2">
                      {view.nextUp && now ? (
                        <>
                          {t.nextUp} {view.nextUp.title} <span className="text-ink-3">· {formatDue(view.nextUp.due_at!, now, locale)}</span>
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

          <TaskBoard
            className="mt-5"
            store={store}
            tasks={view?.visible ?? tasks}
            subjects={subjects}
            empty={
              tasks.length === 0 ? (
                <EmptyState onExample={(text) => quick.current?.fill(text)} />
              ) : (
                <div className="mt-10 flex flex-col items-center text-center">
                  <p className="text-[13.5px] text-ink-2">{t.nothingMatches}</p>
                  <button onClick={() => setFilters(NO_FILTERS)} className="mt-1 text-[13px] font-medium text-blob-ink hover:underline">
                    {t.clearFilters}
                  </button>
                </div>
              )
            }
          />
        </section>

        {/* Tablets: calendar on the left, filters on the right instead of three screen-wide panels.
            Desktop: a sticky column that scrolls on its own once many subjects make it taller than the screen. */}
        <aside className="grid min-w-0 grid-cols-1 content-start gap-3 md:grid-cols-2 lg:sticky lg:top-7 lg:max-h-[calc(100dvh-7.5rem)] lg:grid-cols-1 lg:self-start lg:overflow-y-auto lg:[scrollbar-width:thin]">
          {view && now ? (
            <>
              <Panel className="md:row-span-2 md:self-start lg:row-span-1" title={t.nextTwoWeeks} action={<span className="text-[11.5px] text-ink-3">{format(now, t.monthFormat, { locale: dateLocale(locale) })}</span>}>
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
            </>
          ) : (
            <div className="h-[420px] rounded-xl border border-line md:col-span-2 lg:col-span-1" aria-hidden />
          )}
        </aside>
      </div>
      <UndoToast store={store} />
    </div>
  );
}

function EmptyState({ onExample }: { onExample: (text: string) => void }) {
  const t = useMessages(tasksText);
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 pb-9 pt-7 text-center">
      <Blob size={96} mood="sleepy" />
      <h2 className="mt-2 font-display text-[18px] font-semibold tracking-[-0.01em]">{t.emptyTitle}</h2>
      <p className="mt-1 max-w-[400px] text-[13.5px] text-ink-2">{t.emptyBody}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {t.examples.map((ex) => (
          <button
            key={ex}
            onClick={() => onExample(ex)}
            className={cn("h-7 rounded-lg border border-line bg-raised px-2.5 text-[12.5px] text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink")}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
