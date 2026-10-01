"use client";

import { differenceInCalendarDays } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { compareTasks, taskBucket } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickAdd } from "./QuickAdd";
import { TaskRow } from "./TaskRow";
import { useNow } from "./useNow";
import { useTaskStore, type NewTask } from "./useTaskStore";

const spring = { type: "spring", stiffness: 520, damping: 42 } as const;

/**
 * Compact "what's due soon" card for the Home dashboard: overdue tasks plus the next week,
 * at most `limit` rows. Checking a task off works right here. Load `initialTasks` on the
 * server with `loadUpcomingTasks(supabase)` from "@/lib/tasks".
 */
export function UpcomingTasks({
  initialTasks,
  limit = 6,
  days = 7,
  className,
}: {
  initialTasks: Task[];
  /** Max rows to show. */
  limit?: number;
  /** How far ahead to look, in days. */
  days?: number;
  className?: string;
}) {
  const store = useTaskStore(initialTasks);
  const { subjects } = useWorkspace();
  const now = useNow();
  const [adding, setAdding] = useState(false);

  const upcoming = useMemo(() => {
    if (!now) return [];
    return store.tasks
      .filter((t) => !t.done && t.due_at && differenceInCalendarDays(new Date(t.due_at), now) <= days)
      .sort(compareTasks);
  }, [store.tasks, now, days]);

  const shown = upcoming.slice(0, limit);
  const more = upcoming.length - shown.length;
  const overdue = now ? upcoming.filter((t) => taskBucket(t, now) === "overdue").length : 0;
  const today = now ? upcoming.filter((t) => taskBucket(t, now) === "today").length : 0;

  function add(task: NewTask) {
    store.add(task);
    const inWindow = now && task.due_at && differenceInCalendarDays(new Date(task.due_at), now) <= days;
    if (!inWindow) blob.say(task.due_at ? "Added! It's further out, you'll find it in Tasks." : "Added to your Tasks.", { mood: "happy" });
  }

  return (
    <section className={cn("flex flex-col rounded-2xl border border-line bg-raised shadow-card", className)} aria-label="Upcoming tasks">
      <header className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2">
        <h2 className="text-[13.5px] font-semibold text-ink">Upcoming</h2>
        {now && (overdue > 0 || today > 0) && (
          <span className="text-[12px] text-ink-3">
            {overdue > 0 && <span className="text-danger">{overdue} overdue</span>}
            {overdue > 0 && today > 0 && " · "}
            {today > 0 && <span className="text-blob-ink">{today} today</span>}
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setAdding((a) => !a)}
            className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
            aria-label={adding ? "Close" : "Add a task"}
            title={adding ? "Close" : "Add a task"}
            aria-expanded={adding}
          >
            {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          </button>
          <Link href="/tasks" className="flex h-7 items-center gap-1 rounded-lg px-2 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </span>
      </header>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2">
              <QuickAdd size="sm" autoFocus onAdd={add} subjects={subjects} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="@container min-h-0 flex-1 px-2 pb-2">
        {!now ? (
          <div className="space-y-1 px-1.5 pb-1" aria-hidden>
            {[0.7, 0.5, 0.6].map((w, i) => (
              <div key={i} className="flex h-9 items-center gap-3">
                <div className="size-4 rounded-[5px] border-[1.5px] border-line" />
                <div className="h-3 rounded bg-hover" style={{ width: `${w * 70}%` }} />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex items-center gap-3 px-2 pb-2 pt-1">
            <Blob size={52} mood={store.tasks.length ? "happy" : "sleepy"} track={false} />
            <div className="min-w-0 text-[13px] leading-snug">
              <p className="font-medium text-ink">{store.tasks.length ? "All clear this week" : "Nothing due soon"}</p>
              <p className="text-ink-3">
                {store.tasks.length ? "Nothing due in the next few days. Nice." : "Add homework or a test date and it shows up here."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="relative">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                  transition={spring}
                  className="relative list-none"
                >
                  {store.fresh === t.id && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-lg bg-blob-soft"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 1.4, delay: 0.2 }}
                    />
                  )}
                  <TaskRow dense task={t} now={now} subjects={subjects} onToggle={(done) => store.setDone(t.id, done)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {more > 0 && (
          <Link href="/tasks" className="ml-1.5 mt-0.5 inline-flex h-7 items-center rounded-md px-1.5 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink">
            +{more} more this week
          </Link>
        )}
      </div>
    </section>
  );
}
