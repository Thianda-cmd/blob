"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { tasksText } from "@/i18n/messages/tasks";
import type { Row } from "@/lib/offline/sync";
import { useRows, useSync } from "@/lib/offline/useSync";
import { isDueByToday, retimeForKind } from "@/lib/tasks";
import type { Task, TaskKind, TaskStatus } from "@/lib/types";
import { uid } from "@/lib/utils";

export type NewTask = {
  title: string;
  kind?: TaskKind;
  due_at?: string | null;
  subject_id?: string | null;
  details?: string | null;
  /** The personal board's column and place in it (default: to do, at the top). */
  status?: TaskStatus;
  position?: number;
};

export type TaskPatch = Partial<Pick<Task, "title" | "kind" | "due_at" | "subject_id" | "details">>;

export type TaskStore = {
  tasks: Task[];
  add: (input: NewTask) => Promise<Task | null>;
  update: (id: string, patch: TaskPatch) => Promise<boolean>;
  setDone: (id: string, done: boolean) => Promise<boolean>;
  /** Move a task on the personal board: its column (status) and place in it. Done follows the status. */
  move: (id: string, status: TaskStatus, position: number) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Put back the last deleted task. */
  undoRemove: () => Promise<boolean>;
  /** Id of the task added last, for a short highlight. */
  fresh: string | null;
  /** The last deleted task (for the undo bar), until dismissed. */
  removed: Task | null;
  dismissRemoved: () => void;
};

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Blob's lines for kinds that deserve a special cheer. */
function kindCheers(t: (typeof tasksText)["en"], kind: TaskKind): string[] | undefined {
  return kind === "exam" ? t.examCheers : kind === "project" ? t.projectCheers : undefined;
}

/**
 * Personal tasks, shared by every page that shows them (Tasks, Home, subjects, the calendar) and
 * kept on the device: a change shows at once, is saved in order and waits for the connection
 * when there is none (src/lib/offline/sync.ts). Changes made on other devices arrive live.
 * `subjectId` narrows the list to one subject.
 */
export function useTaskStore(initialTasks: Task[], opts: { subjectId?: string } = {}): TaskStore {
  const t = useMessages(tasksText);
  const { userId } = useWorkspace();
  const sync = useSync();
  const rows = useRows<Task>("tasks", initialTasks);
  const { subjectId } = opts;
  const tasks = useMemo(() => rows.filter((x) => !x.project_id && (!subjectId || x.subject_id === subjectId)), [rows, subjectId]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Task | null>(null);
  const lastSaid = useRef(0);

  const current = useCallback((id: string) => (sync?.row("tasks", id) as Task | undefined) ?? undefined, [sync]);

  const add = useCallback(
    async (input: NewTask) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: uid(),
        user_id: userId,
        subject_id: input.subject_id ?? null,
        title: input.title.trim().slice(0, 200),
        details: input.details ?? null,
        kind: input.kind ?? "homework",
        due_at: input.due_at ?? null,
        done: input.status === "done",
        completed_at: input.status === "done" ? now : null,
        status: input.status ?? "todo",
        project_id: null,
        column_id: null,
        position: input.position ?? 0,
        priority: 0,
        assignees: [],
        labels: [],
        checklist: [],
        attachments: [],
        created_at: now,
        updated_at: now,
      };
      if (!task.title || !sync) return null;
      sync.mutate({ op: "insert", table: "tasks", id: task.id, row: task as unknown as Row });
      setFresh(task.id);
      return task;
    },
    [sync, userId],
  );

  const update = useCallback(
    async (id: string, patch: TaskPatch) => {
      const before = current(id);
      if (!before || !sync) return false;
      const full: TaskPatch = { ...patch };
      if (patch.kind && patch.kind !== before.kind && patch.due_at === undefined) {
        full.due_at = retimeForKind(before.due_at, before.kind, patch.kind);
      }
      if (full.title !== undefined) {
        full.title = full.title.trim().slice(0, 200);
        if (!full.title) return false;
      }
      sync.mutate({ op: "update", table: "tasks", id, values: full, local: { updated_at: new Date().toISOString() } });
      return true;
    },
    [current, sync],
  );

  const setDone = useCallback(
    async (id: string, done: boolean) => {
      const before = current(id);
      if (!before || before.done === done || !sync) return false;
      const now = new Date();
      const completed_at = done ? now.toISOString() : null;
      const status: TaskStatus = done ? "done" : before.status === "done" ? "todo" : before.status;
      // The database works out the status from `done`.
      sync.mutate({ op: "update", table: "tasks", id, values: { done, completed_at }, local: { status } });

      if (done) {
        const open = (sync.rows("tasks") as unknown as Task[]).filter((x) => !x.project_id);
        const clearedToday = isDueByToday(before, now) && !open.some((x) => isDueByToday(x, now));
        if (clearedToday) {
          // Everything due today is done: graduation cap and a victory hop.
          blob.react("celebrate", "excited", 2600, "cap");
          setTimeout(() => blob.react("jump", "love", 2600, "cap"), 900);
          blob.say(pick(t.allClear), { mood: "love", ms: 4200, accessory: "cap" });
          lastSaid.current = Date.now();
        } else {
          blob.react("jump", "excited");
          const special = kindCheers(t, before.kind);
          const quiet = Date.now() - lastSaid.current < 9000;
          if (!quiet && (special || Math.random() < 0.4)) {
            blob.say(pick(special ?? t.cheers), { mood: "happy" });
            lastSaid.current = Date.now();
          }
        }
      }
      return true;
    },
    [current, sync, t],
  );

  const move = useCallback(
    async (id: string, status: TaskStatus, position: number) => {
      const before = current(id);
      if (!before || !sync) return false;
      const done = status === "done";
      const completed_at = done ? (before.done ? before.completed_at : new Date().toISOString()) : null;
      // The database works out `done` and `completed_at` from the status.
      sync.mutate({ op: "update", table: "tasks", id, values: { status, position }, local: { done, completed_at } });
      if (done && !before.done) blob.react("jump", "excited");
      return true;
    },
    [current, sync],
  );

  const remove = useCallback(
    async (id: string) => {
      const before = current(id);
      if (!before || !sync) return false;
      sync.mutate({ op: "delete", table: "tasks", id });
      setRemoved(before);
      return true;
    },
    [current, sync],
  );

  const undoRemove = useCallback(async () => {
    const task = removed;
    if (!task || !sync) return false;
    setRemoved(null);
    sync.mutate({ op: "insert", table: "tasks", id: task.id, row: task as unknown as Row, restore: true });
    blob.react("squish", "happy");
    return true;
  }, [removed, sync]);

  const dismissRemoved = useCallback(() => setRemoved(null), []);

  return useMemo(
    () => ({ tasks, add, update, setDone, move, remove, undoRemove, fresh, removed, dismissRemoved }),
    [tasks, add, update, setDone, move, remove, undoRemove, fresh, removed, dismissRemoved],
  );
}
