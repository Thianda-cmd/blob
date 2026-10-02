"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Undo2, X } from "lucide-react";
import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { tasksText } from "@/i18n/messages/tasks";
import { dueAt, groupTasks, isDefaultTime, type TaskGroup } from "@/lib/tasks";
import type { Subject, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskRow } from "./TaskRow";
import type { TaskStore } from "./useTaskStore";
import { useNow } from "./useNow";

const spring = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const;

type Item = { kind: "header"; key: string; group: TaskGroup; hidden: number } | { kind: "task"; key: string; task: Task; group: TaskGroup["key"] };

/**
 * Tasks grouped into Overdue / Today / Tomorrow / This week / Next week / Later / No date / Done.
 * Everything lives in one animated list, so a checked task glides into "Done" instead of jumping.
 */
export function TaskBoard({
  store,
  tasks = store.tasks,
  subjects,
  hideSubject,
  narrow,
  doneLimit = 5,
  empty,
  className,
}: {
  store: TaskStore;
  /** A filtered subset of `store.tasks`; defaults to all of them. */
  tasks?: Task[];
  subjects: Subject[];
  hideSubject?: boolean;
  /** Fit a narrow column (e.g. a side panel). */
  narrow?: boolean;
  /** How many done tasks to show before "Show all". */
  doneLimit?: number;
  /** Rendered when there's nothing to show at all. */
  empty?: ReactNode;
  className?: string;
}) {
  const now = useNow();
  const [doneOpen, setDoneOpen] = useState(true);
  const [doneAll, setDoneAll] = useState(false);
  const groups = useMemo(() => (now ? groupTasks(tasks, now) : []), [tasks, now]);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const g of groups) {
      const isDone = g.key === "done";
      const visible = isDone ? (doneOpen ? (doneAll ? g.tasks : g.tasks.slice(0, doneLimit)) : []) : g.tasks;
      out.push({ kind: "header", key: `h-${g.key}`, group: g, hidden: g.tasks.length - visible.length });
      for (const t of visible) out.push({ kind: "task", key: t.id, task: t, group: g.key });
    }
    return out;
  }, [groups, doneOpen, doneAll, doneLimit]);

  if (!now) return <BoardSkeleton className={className} />;
  if (tasks.length === 0) return <>{empty}</>;

  function moveOverdueToToday(group: TaskGroup) {
    const today = new Date();
    for (const t of group.tasks) {
      const due = t.due_at ? new Date(t.due_at) : null;
      const time = due && !isDefaultTime(due, t.kind) ? { h: due.getHours(), m: due.getMinutes() } : null;
      store.update(t.id, { due_at: dueAt(today, t.kind, time).toISOString() });
    }
  }

  return (
    <ul className={cn("relative", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) =>
          item.kind === "header" ? (
            <motion.li
              key={item.key}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={spring}
              className="list-none"
            >
              <GroupHeader
                group={item.group}
                now={now}
                first={items[0] === item}
                doneOpen={doneOpen}
                hidden={item.hidden}
                onToggleDone={() => setDoneOpen((o) => !o)}
                onShowAll={() => setDoneAll(true)}
                onMoveToToday={() => moveOverdueToToday(item.group)}
              />
            </motion.li>
          ) : (
            <motion.li
              key={item.key}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -14, transition: { duration: 0.16 } }}
              transition={spring}
              className="relative list-none"
            >
              {store.fresh === item.task.id && <FreshGlow />}
              <TaskRow
                task={item.task}
                now={now}
                subjects={subjects}
                hideSubject={hideSubject}
                narrow={narrow}
                onToggle={(done) => store.setDone(item.task.id, done)}
                onUpdate={(patch) => store.update(item.task.id, patch)}
                onDelete={() => store.remove(item.task.id)}
              />
            </motion.li>
          ),
        )}
      </AnimatePresence>
    </ul>
  );
}

function FreshGlow() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-lg bg-blob-soft"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.4, delay: 0.25, ease: "easeOut" }}
    />
  );
}

function GroupHeader({
  group,
  now,
  first,
  doneOpen,
  hidden,
  onToggleDone,
  onShowAll,
  onMoveToToday,
}: {
  group: TaskGroup;
  now: number;
  first: boolean;
  doneOpen: boolean;
  hidden: number;
  onToggleDone: () => void;
  onShowAll: () => void;
  onMoveToToday: () => void;
}) {
  const t = useMessages(tasksText);
  const locale = useLocale();
  const fmt = { locale: dateLocale(locale) };
  const isDone = group.key === "done";
  const label = t.group[group.key];
  const sub =
    group.key === "today" ? format(now, t.due.header, fmt) : group.key === "tomorrow" ? format(addDays(now, 1), t.due.header, fmt) : null;
  return (
    <div className={cn("flex h-8 items-end gap-2 pb-1.5 pl-2 pr-2", !first && "mt-4")}>
      {isDone ? (
        <button onClick={onToggleDone} className="-ml-1 flex items-center gap-1 rounded-md px-1 text-[12.5px] font-semibold text-ink-3 hover:text-ink" aria-expanded={doneOpen}>
          <ChevronDown className={cn("size-3.5 transition-transform duration-200", !doneOpen && "-rotate-90")} />
          {label}
        </button>
      ) : (
        <span className={cn("text-[12.5px] font-semibold", group.key === "overdue" ? "text-danger" : group.key === "today" ? "text-ink" : "text-ink-2")}>
          {label}
        </span>
      )}
      <span className="rounded-full bg-hover px-1.5 text-[11px] font-medium tabular-nums leading-[18px] text-ink-3">{group.tasks.length}</span>
      {sub && <span className="text-[12px] text-ink-3">{sub}</span>}
      <span className="ml-auto" />
      {group.key === "overdue" && (
        <button onClick={onMoveToToday} className="rounded-md px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-hover hover:text-ink">
          {t.moveToToday}
        </button>
      )}
      {isDone && doneOpen && hidden > 0 && (
        <button onClick={onShowAll} className="rounded-md px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-hover hover:text-ink">
          {t.showMore(hidden)}
        </button>
      )}
    </div>
  );
}

function BoardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1.5 pt-1", className)} aria-hidden>
      <div className="mb-3 ml-2 h-3 w-16 rounded bg-hover" />
      {[0.72, 0.5, 0.62].map((w, i) => (
        <div key={i} className="flex h-[38px] items-center gap-3 px-2.5">
          <div className="size-[17px] rounded-[6px] border-[1.5px] border-line" />
          <div className="h-3 rounded bg-hover" style={{ width: `${w * 60}%` }} />
        </div>
      ))}
    </div>
  );
}

/** "Task deleted · Undo" pill at the bottom of the screen. */
export function UndoToast({ store }: { store: TaskStore }) {
  const t = useMessages(tasksText);
  const { removed, dismissRemoved, undoRemove } = store;
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(dismissRemoved, 6000);
    return () => clearTimeout(t);
  }, [removed, dismissRemoved]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {removed && (
        <motion.div
          key={removed.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className="fixed bottom-6 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-raised py-1 pl-3.5 pr-1 text-[13px] text-ink shadow-pop"
          role="status"
        >
          {/* The title shrinks, "Deleted" / "gelöscht" stays readable. */}
          <span className="flex min-w-0 max-w-[260px] items-baseline gap-1">
            {t.deletedBefore && <span className="shrink-0">{t.deletedBefore}</span>}
            <span className="min-w-0 truncate text-ink-3">{t.quote(removed.title)}</span>
            {t.deletedAfter && <span className="shrink-0">{t.deletedAfter}</span>}
          </span>
          <button onClick={undoRemove} className="ml-2 flex h-7 items-center gap-1.5 rounded-lg px-2 font-medium text-blob-ink hover:bg-blob-soft">
            <Undo2 className="size-3.5" /> {t.undo}
          </button>
          <button onClick={dismissRemoved} className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.dismiss}>
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
