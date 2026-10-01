"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { isDueByToday, retimeForKind } from "@/lib/tasks";
import type { Task, TaskKind } from "@/lib/types";
import { uid } from "@/lib/utils";

export type NewTask = {
  title: string;
  kind?: TaskKind;
  due_at?: string | null;
  subject_id?: string | null;
  details?: string | null;
};

export type TaskPatch = Partial<Pick<Task, "title" | "kind" | "due_at" | "subject_id" | "details">>;

export type TaskStore = {
  tasks: Task[];
  add: (input: NewTask) => Promise<Task | null>;
  update: (id: string, patch: TaskPatch) => Promise<boolean>;
  setDone: (id: string, done: boolean) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Put back the last deleted task. */
  undoRemove: () => Promise<boolean>;
  /** Id of the task added last, for a short highlight. */
  fresh: string | null;
  /** The last deleted task (for the undo bar), until dismissed. */
  removed: Task | null;
  dismissRemoved: () => void;
};

const CHEERS = [
  "Nice! One less thing.",
  "Done and dusted.",
  "Look at you go!",
  "Checked off. Smooth.",
  "That's progress.",
  "Crossed off. Feels good, right?",
  "Boom. Next one!",
  "Little wins add up.",
];
const KIND_CHEERS: Partial<Record<TaskKind, string[]>> = {
  exam: ["Exam done? Hope it went great!", "One exam down. Proud of you."],
  project: ["Project finished. That's a big one!", "Project wrapped up. Well played."],
};
const ALL_CLEAR = [
  "That's everything for today. You're free!",
  "Today's list: cleared. Go do something fun.",
  "All done for today! Time to relax.",
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function oops(message = "Hmm, that didn't save. Check your connection?") {
  blob.say(message, { mood: "worried" });
  blob.react("shake", "worried");
}

/** Client-side task list with optimistic writes to Supabase and Blob reactions. */
export function useTaskStore(initialTasks: Task[]): TaskStore {
  const { userId } = useWorkspace();
  const [tasks, setTasks] = useState(initialTasks);
  const [fresh, setFresh] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Task | null>(null);
  // Mirror of `tasks` so async handlers always build on the latest list.
  const ref = useRef(initialTasks);
  const lastSaid = useRef(0);

  const commit = useCallback((fn: (prev: Task[]) => Task[]) => {
    ref.current = fn(ref.current);
    setTasks(ref.current);
  }, []);

  const replace = useCallback((id: string, next: Task | null) => {
    commit((ts) => (next ? ts.map((t) => (t.id === id ? next : t)) : ts.filter((t) => t.id !== id)));
  }, [commit]);

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
        done: false,
        completed_at: null,
        created_at: now,
        updated_at: now,
      };
      if (!task.title) return null;
      commit((ts) => [...ts, task]);
      setFresh(task.id);
      const { data, error } = await createClient()
        .from("tasks")
        .insert({
          id: task.id,
          title: task.title,
          details: task.details,
          kind: task.kind,
          due_at: task.due_at,
          subject_id: task.subject_id,
        })
        .select()
        .single();
      if (error || !data) {
        replace(task.id, null);
        oops("I couldn't add that task. Try again?");
        return null;
      }
      // Keep local edits made while the insert was in flight.
      const local = ref.current.find((t) => t.id === task.id);
      if (local) replace(task.id, { ...(data as Task), ...pickEdits(local, task) });
      return data as Task;
    },
    [commit, replace, userId],
  );

  const update = useCallback(
    async (id: string, patch: TaskPatch) => {
      const before = ref.current.find((t) => t.id === id);
      if (!before) return false;
      const full: TaskPatch = { ...patch };
      if (patch.kind && patch.kind !== before.kind && patch.due_at === undefined) {
        full.due_at = retimeForKind(before.due_at, before.kind, patch.kind);
      }
      if (full.title !== undefined) {
        full.title = full.title.trim().slice(0, 200);
        if (!full.title) return false;
      }
      replace(id, { ...before, ...full, updated_at: new Date().toISOString() });
      const { error } = await createClient().from("tasks").update(full).eq("id", id);
      if (error) {
        const current = ref.current.find((t) => t.id === id);
        if (current) replace(id, { ...current, ...revert(before, full) });
        oops();
        return false;
      }
      return true;
    },
    [replace],
  );

  const setDone = useCallback(
    async (id: string, done: boolean) => {
      const before = ref.current.find((t) => t.id === id);
      if (!before || before.done === done) return false;
      const now = new Date();
      const completed_at = done ? now.toISOString() : null;
      replace(id, { ...before, done, completed_at });

      if (done) {
        const clearedToday = isDueByToday(before, now) && !ref.current.some((t) => isDueByToday(t, now));
        if (clearedToday) {
          blob.react("jump", "excited", 2600);
          setTimeout(() => blob.react("jump", "love", 2600), 700);
          blob.say(pick(ALL_CLEAR), { mood: "love", ms: 4200 });
          lastSaid.current = Date.now();
        } else {
          blob.react("jump", "excited");
          const special = KIND_CHEERS[before.kind];
          const quiet = Date.now() - lastSaid.current < 9000;
          if (!quiet && (special || Math.random() < 0.4)) {
            blob.say(pick(special ?? CHEERS), { mood: "happy" });
            lastSaid.current = Date.now();
          }
        }
      }

      const { error } = await createClient().from("tasks").update({ done, completed_at }).eq("id", id);
      if (error) {
        const current = ref.current.find((t) => t.id === id);
        if (current) replace(id, { ...current, done: before.done, completed_at: before.completed_at });
        oops();
        return false;
      }
      return true;
    },
    [replace],
  );

  const remove = useCallback(
    async (id: string) => {
      const before = ref.current.find((t) => t.id === id);
      if (!before) return false;
      replace(id, null);
      setRemoved(before);
      const { error } = await createClient().from("tasks").delete().eq("id", id);
      if (error) {
        commit((ts) => [...ts, before]);
        setRemoved(null);
        oops("I couldn't delete that task.");
        return false;
      }
      return true;
    },
    [commit, replace],
  );

  const undoRemove = useCallback(async () => {
    const task = removed;
    if (!task) return false;
    setRemoved(null);
    commit((ts) => [...ts.filter((t) => t.id !== task.id), task]);
    const { error } = await createClient().from("tasks").insert({
      id: task.id,
      title: task.title,
      details: task.details,
      kind: task.kind,
      due_at: task.due_at,
      subject_id: task.subject_id,
      done: task.done,
      completed_at: task.completed_at,
      created_at: task.created_at,
    });
    if (error) {
      replace(task.id, null);
      oops("I couldn't bring that task back.");
      return false;
    }
    blob.react("squish", "happy");
    return true;
  }, [commit, removed, replace]);

  const dismissRemoved = useCallback(() => setRemoved(null), []);

  return useMemo(
    () => ({ tasks, add, update, setDone, remove, undoRemove, fresh, removed, dismissRemoved }),
    [tasks, add, update, setDone, remove, undoRemove, fresh, removed, dismissRemoved],
  );
}

/** Fields the user changed locally since `original` was created. */
function pickEdits(local: Task, original: Task): Partial<Task> {
  const out: Partial<Task> = {};
  for (const key of ["title", "kind", "due_at", "subject_id", "details", "done", "completed_at"] as const) {
    if (local[key] !== original[key]) (out as Record<string, unknown>)[key] = local[key];
  }
  return out;
}

/** The values from `before` for every key in `patch`. */
function revert(before: Task, patch: TaskPatch): Partial<Task> {
  const out: Partial<Task> = {};
  for (const key of Object.keys(patch) as (keyof TaskPatch)[]) (out as Record<string, unknown>)[key] = before[key];
  return out;
}
