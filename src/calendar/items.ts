import { addDays, addMinutes, startOfDay } from "date-fns";
import { boardColor } from "@/components/projects/model";
import { subjectColor } from "@/lib/subjects";
import { isDefaultTime, type AssignedCard } from "@/lib/tasks";
import type { CalEvent, EventKind, Subject, Task, TaskKind } from "@/lib/types";
import { occurrences } from "./recurrence";
import { eventSpan } from "./time";

// Everything the calendar draws, as one kind of item: events (each occurrence of a series is its
// own item), personal tasks with a due date and project cards assigned to you.

export type ItemSource = "event" | "task" | "card";

export type CalItem = {
  /** Unique per occurrence (React key, drag id). */
  key: string;
  source: ItemSource;
  /** The row behind it: the event (a changed occurrence's own row), task or card. */
  id: string;
  title: string;
  start: Date;
  /** Exclusive. */
  end: Date;
  allDay: boolean;
  /** CSS colour. */
  color: string;
  kind: EventKind | TaskKind;
  subjectId: string | null;
  /** Can be dragged to another time / its length changed. */
  movable: boolean;
  resizable: boolean;
  /** Done tasks (shown faded). */
  done: boolean;
  /** A task with a time: a short marker at that time rather than a block. */
  marker: boolean;
  exam: boolean;
  event?: CalEvent;
  /** An occurrence of a repeating event: the series and the start it has in the series. */
  occurrence?: { series: CalEvent; original: string; index: number };
  task?: Task;
  card?: AssignedCard;
};

/** How long a task marker is drawn for. */
export const MARKER_MINUTES = 30;

export type Filters = {
  events: boolean;
  tasks: boolean;
  cards: boolean;
  done: boolean;
  /** Subject ids to hide ("none" for things without a subject). */
  hidden: string[];
};

export const DEFAULT_FILTERS: Filters = { events: true, tasks: true, cards: true, done: true, hidden: [] };

type Input = {
  events: CalEvent[];
  tasks: Task[];
  cards: AssignedCard[];
  subjects: Subject[];
  from: Date;
  to: Date;
  filters?: Filters;
};

/** The colour an event is drawn in: its own, else its subject's, else Blob's. */
export function eventColor(e: Pick<CalEvent, "color" | "subject_id">, subjects: Map<string, Subject> | Subject[]) {
  if (e.color) return subjectColor(e.color);
  const s = e.subject_id ? (subjects instanceof Map ? subjects.get(e.subject_id) : subjects.find((x) => x.id === e.subject_id)) : undefined;
  return s ? subjectColor(s.color) : "var(--blob)";
}

/** A task's place on the calendar: a due date without a time is an all-day item, with a time a marker. */
export function taskSpan(task: Pick<Task, "due_at" | "kind">): { start: Date; end: Date; allDay: boolean } | null {
  if (!task.due_at) return null;
  const due = new Date(task.due_at);
  if (Number.isNaN(due.getTime())) return null;
  if (isDefaultTime(due, task.kind)) {
    const start = startOfDay(due);
    return { start, end: addDays(start, 1), allDay: true };
  }
  return { start: due, end: addMinutes(due, MARKER_MINUTES), allDay: false };
}

const overlaps = (start: Date, end: Date, from: Date, to: Date) => start < to && (end > from || (end.getTime() === start.getTime() && start >= from));

/** The items in [from, to), sorted (all-day first, then by start, longer first). */
export function buildItems({ events, tasks, cards, subjects, from, to, filters = DEFAULT_FILTERS }: Input): CalItem[] {
  const bySubject = new Map(subjects.map((s) => [s.id, s]));
  const hidden = new Set(filters.hidden);
  const shown = (subjectId: string | null) => !hidden.has(subjectId ?? "none");
  const out: CalItem[] = [];

  if (filters.events) {
    const live = events.filter((e) => !e.deleted_at);
    const byId = new Map(live.map((e) => [e.id, e]));
    // Changed occurrences, per series (by the start they replace).
    const overridden = new Map<string, Set<number>>();
    for (const e of live) {
      if (!e.series_id || !e.series_start) continue;
      let set = overridden.get(e.series_id);
      if (!set) overridden.set(e.series_id, (set = new Set()));
      set.add(new Date(e.series_start).getTime());
    }
    for (const e of live) {
      if (!shown(e.subject_id)) continue;
      const color = eventColor(e, bySubject);
      const base = { source: "event" as const, id: e.id, title: e.title, allDay: e.all_day, color, kind: e.kind, subjectId: e.subject_id, movable: true, resizable: true, done: false, marker: false, exam: false, event: e };
      if (e.series_id) {
        // A changed occurrence: drawn as itself, as long as its series is still there.
        const series = byId.get(e.series_id);
        if (!series) continue;
        const { start, end } = eventSpan(e);
        if (!overlaps(start, end, from, to)) continue;
        out.push({ ...base, key: e.id, start, end, occurrence: { series, original: e.series_start!, index: -1 } });
      } else if (e.recurrence) {
        for (const o of occurrences(e, from, to, overridden.get(e.id))) {
          out.push({ ...base, key: `${e.id}:${o.start.getTime()}`, start: o.start, end: o.end, occurrence: { series: e, original: o.original, index: o.index } });
        }
      } else {
        const { start, end } = eventSpan(e);
        if (!overlaps(start, end, from, to)) continue;
        out.push({ ...base, key: e.id, start, end });
      }
    }
  }

  if (filters.tasks) {
    for (const t of tasks) {
      if (t.project_id || (t.done && !filters.done) || !shown(t.subject_id)) continue;
      const span = taskSpan(t);
      if (!span || !overlaps(span.start, span.end, from, to)) continue;
      const s = t.subject_id ? bySubject.get(t.subject_id) : undefined;
      out.push({
        key: `task:${t.id}`,
        source: "task",
        id: t.id,
        title: t.title,
        ...span,
        color: s ? subjectColor(s.color) : "var(--blob)",
        kind: t.kind,
        subjectId: t.subject_id,
        movable: true,
        resizable: false,
        done: t.done,
        marker: !span.allDay,
        exam: t.kind === "exam",
        task: t,
      });
    }
  }

  if (filters.cards) {
    for (const c of cards) {
      if (c.done || !shown(c.subject_id)) continue;
      const span = taskSpan(c);
      if (!span || !overlaps(span.start, span.end, from, to)) continue;
      out.push({
        key: `card:${c.id}`,
        source: "card",
        id: c.id,
        title: c.title,
        ...span,
        color: boardColor(c.project.color),
        kind: c.kind,
        subjectId: c.subject_id,
        movable: false,
        resizable: false,
        done: false,
        marker: !span.allDay,
        exam: false,
        card: c,
      });
    }
  }

  return out.sort(compareItems);
}

export function compareItems(a: CalItem, b: CalItem) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const s = a.start.getTime() - b.start.getTime();
  if (s) return s;
  const len = b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());
  if (len) return len;
  if (a.source !== b.source) return a.source === "event" ? -1 : b.source === "event" ? 1 : a.source === "task" ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** Items that belong in the all-day lane: all-day ones and timed ones lasting a day or more. */
export const inLane = (item: Pick<CalItem, "allDay" | "start" | "end">) => item.allDay || item.end.getTime() - item.start.getTime() >= 864e5;
