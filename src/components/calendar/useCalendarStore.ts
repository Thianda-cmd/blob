"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useTaskStore } from "@/components/tasks/useTaskStore";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { clampSpan, newEvent, planCreate, planDelete, planDuplicate, planEdit, type EventPatch, type Plan, type Scope, type Span } from "@/calendar/ops";
import type { CalItem } from "@/calendar/items";
import { deviceTimeZone, spanToStored } from "@/calendar/time";
import type { Change } from "@/lib/offline/sync";
import { useRows, useSync } from "@/lib/offline/useSync";
import { dueAt } from "@/lib/tasks";
import type { CalEvent, Task } from "@/lib/types";
import { uid } from "@/lib/utils";

export type UndoEntry = { id: string; label: string; undo: Change[] };

/** Everything the calendar reads and changes: events, personal tasks, and an undo history. */
export function useCalendarStore({ initialEvents, initialTasks }: { initialEvents: CalEvent[]; initialTasks: Task[] }) {
  const sync = useSync();
  const { userId } = useWorkspace();
  const events = useRows<CalEvent>("events", initialEvents);
  const tasks = useTaskStore(initialTasks);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  // The history lives in a ref (read by handlers) mirrored into state (for the undo bar).
  const historyRef = useRef<UndoEntry[]>([]);
  const [history, setHistory] = useState<UndoEntry[]>([]);

  const run = useCallback(
    (plan: Plan, label: string) => {
      if (!sync || !plan.changes.length) return;
      for (const c of plan.changes) sync.mutate(c);
      historyRef.current = [...historyRef.current.slice(-29), { id: uid(), label, undo: plan.undo }];
      setHistory(historyRef.current);
    },
    [sync],
  );

  /** Takes back the last change. */
  const undo = useCallback(() => {
    const last = historyRef.current[historyRef.current.length - 1];
    if (!sync || !last) return null;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistory(historyRef.current);
    for (const c of last.undo) sync.mutate(c);
    blob.react("squish", "happy");
    return last;
  }, [sync]);

  const dismiss = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
  }, []);

  const create = useCallback(
    (values: Partial<CalEvent> & { span: Span }, label: string) => {
      const span = clampSpan(values.span);
      const { span: _ignored, ...rest } = values;
      void _ignored;
      const row = newEvent({
        ...rest,
        id: uid(),
        user_id: userId,
        time_zone: deviceTimeZone(),
        all_day: span.allDay,
        ...spanToStored(span.allDay, span.start, span.end),
      });
      run(planCreate(row), label);
      return row;
    },
    [run, userId],
  );

  const edit = useCallback((item: CalItem, patch: EventPatch, scope: Scope, label: string) => run(planEdit(item, patch.span ? { ...patch, span: clampSpan(patch.span) } : patch, scope, byId, uid), label), [run, byId]);

  const remove = useCallback((item: CalItem, scope: Scope, label: string) => run(planDelete(item, scope, byId), label), [run, byId]);

  const duplicate = useCallback((item: CalItem, span: Span, label: string) => run(planDuplicate(item, clampSpan(span), uid), label), [run]);

  /** Moves a task: to a day (its kind's usual time) or to a time. */
  const moveTask = useCallback(
    (item: CalItem, span: Span, label: string) => {
      const task = item.task;
      if (!task || !sync) return;
      const due = span.allDay ? dueAt(span.start, task.kind).toISOString() : span.start.toISOString();
      if (due === task.due_at) return;
      run({ changes: [{ op: "update", table: "tasks", id: task.id, values: { due_at: due } }], undo: [{ op: "update", table: "tasks", id: task.id, values: { due_at: task.due_at } }] }, label);
    },
    [run, sync],
  );

  return { events, byId, tasks, history, run, undo, create, edit, remove, duplicate, moveTask, dismiss };
}

export type CalendarStore = ReturnType<typeof useCalendarStore>;
