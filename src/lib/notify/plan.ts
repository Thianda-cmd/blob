import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { buildItems, taskSpan } from "@/calendar/items";
import { atMinutes, ymd } from "@/calendar/time";
import type { CalEvent, Task } from "@/lib/types";

// What Blob reminds you of, worked out on the device (so it works offline and needs no server):
// the notifications for the next two weeks, each with a stable id so the system's list can be
// brought in step without duplicates. src/lib/notify/scheduler.ts hands them to the system.

export type NotifyPrefs = {
  /** Calendar events' own reminders. */
  events: boolean;
  /** Homework and projects due tomorrow (the evening before). */
  homework: boolean;
  /** Exams: a week, two days and a day before, and that morning. */
  exams: boolean;
  /** Reminders (task kind): at their time. */
  reminders: boolean;
  /** Flashcards to review. */
  cards: boolean;
  /** Keep the learning streak. */
  streak: boolean;
  /** A morning overview of the day. */
  morning: boolean;
};

export const DEFAULT_PREFS: NotifyPrefs = { events: true, homework: true, exams: true, reminders: true, cards: true, streak: true, morning: false };

export function prefsOf(raw: unknown): NotifyPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_PREFS };
  for (const k of Object.keys(out) as (keyof NotifyPrefs)[]) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  return out;
}

/** Which group a notification belongs to: on Android a channel each (settings per group), and grouped together. */
export type NotifyKind = "events" | "school" | "learning" | "daily";

export type Planned = {
  id: number;
  key: string;
  at: Date;
  title: string;
  body: string;
  link: string;
  kind: NotifyKind;
  /** The longer list shown when it's expanded (homework due, the day's plan). */
  lines?: string[];
};

/** The words (src/i18n/messages/notify.ts). */
export type NotifyWords = {
  eventSoon: (minutes: number) => string;
  eventAt: (when: string) => string;
  eventAllDay: (day: string) => string;
  homeworkTitle: string;
  homeworkBody: (titles: string[]) => string;
  reminderTitle: string;
  examIn: (days: number) => string;
  examToday: string;
  cardsTitle: string;
  cardsBody: (n: number) => string;
  streakTitle: (days: number) => string;
  streakBody: string;
  morningTitle: string;
  morningBody: (events: number, due: number) => string;
  /** "14:00" */
  time: (d: Date) => string;
  /** "Today", "Tomorrow", "Friday" */
  day: (d: Date, now: Date) => string;
};

export type PlanInput = {
  now: Date;
  events: CalEvent[];
  tasks: Task[];
  /** Cards with a review due on or before each day (yyyy-mm-dd → count), for today and tomorrow. */
  cardsDue: Record<string, number>;
  /** Days with learning XP (for the streak). */
  learnDays: { day: string; xp: number }[];
  prefs: NotifyPrefs;
  words: NotifyWords;
  /** How far ahead (days). */
  horizon?: number;
  /** At most this many (iOS keeps 64 at a time). */
  max?: number;
  /** For the subject's name next to an exam. */
  subjects?: { id: string; name: string }[];
};

/** A stable 31-bit id for a notification's key (FNV-1a). */
export function notifyId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

const at = (day: Date, hour: number, minute = 0) => atMinutes(startOfDay(day), hour * 60 + minute);

export function plan(input: PlanInput): Planned[] {
  const { now, prefs, words: w } = input;
  const horizon = addDays(startOfDay(now), (input.horizon ?? 14) + 1);
  const out: Planned[] = [];
  const add = (key: string, when: Date, title: string, body: string, link: string, kind: NotifyKind, lines?: string[]) => {
    if (when.getTime() <= now.getTime() + 30_000 || when >= horizon) return;
    out.push({ id: notifyId(key), key, at: when, title, body, link, kind, ...(lines?.length ? { lines } : {}) });
  };
  const subjectName = (id: string | null) => (id ? input.subjects?.find((s) => s.id === id)?.name : undefined);

  // Events: their own reminders.
  if (prefs.events) {
    const items = buildItems({ events: input.events, tasks: [], cards: [], subjects: [], from: startOfDay(now), to: addDays(horizon, 1) });
    for (const item of items) {
      const e = item.event;
      if (!e || !e.reminders?.length) continue;
      for (const m of e.reminders) {
        const when = item.allDay ? atMinutes(startOfDay(item.start), -m) : new Date(item.start.getTime() - m * 60_000);
        const body = item.allDay ? w.eventAllDay(w.day(item.start, when)) : m > 0 && m <= 120 ? w.eventSoon(m) : w.eventAt(`${w.day(item.start, when)}, ${w.time(item.start)}`);
        // Where: the room of a lesson matters most when it's about to start.
        const place = e.location?.trim();
        add(`e:${item.key}:${m}`, when, item.title, place ? `${body} · ${place}` : body, `/calendar?date=${ymd(item.start)}&event=${e.series_id ?? e.id}`, "events");
      }
    }
  }

  const open = input.tasks.filter((t) => !t.done && !t.project_id && t.due_at);

  // Homework and projects: the evening before they are due (one notification per day).
  if (prefs.homework) {
    const byDay = new Map<string, { day: Date; titles: string[] }>();
    for (const t of open) {
      if (t.kind !== "homework" && t.kind !== "project") continue;
      const span = taskSpan(t);
      if (!span) continue;
      const day = startOfDay(span.start);
      const k = ymd(day);
      const entry = byDay.get(k) ?? { day, titles: [] };
      entry.titles.push(t.title);
      byDay.set(k, entry);
    }
    for (const [k, { day, titles }] of byDay) add(`hw:${k}`, at(addDays(day, -1), 18), w.homeworkTitle, w.homeworkBody(titles), `/tasks`, "school", titles.length > 1 ? titles : undefined);
  }

  // Reminders: at their time (or 8:00 on the day).
  if (prefs.reminders) {
    for (const t of open) {
      if (t.kind !== "reminder") continue;
      add(`rem:${t.id}:${t.due_at}`, new Date(t.due_at!), w.reminderTitle, t.title, `/tasks`, "events");
    }
  }

  // Exams: a week, two days and a day before (18:00), and that morning (7:00).
  if (prefs.exams) {
    for (const t of open) {
      if (t.kind !== "exam") continue;
      const day = startOfDay(new Date(t.due_at!));
      const subject = subjectName(t.subject_id);
      const what = subject && !t.title.toLowerCase().includes(subject.toLowerCase()) ? `${t.title} · ${subject}` : t.title;
      for (const n of [7, 2, 1]) add(`ex:${t.id}:${ymd(day)}:${n}`, at(addDays(day, -n), 18), w.examIn(n), what, `/calendar?date=${ymd(day)}`, "school");
      add(`ex:${t.id}:${ymd(day)}:0`, at(day, 7), w.examToday, what, `/calendar?date=${ymd(day)}`, "school");
    }
  }

  // Flashcards: 17:00 on days with cards to review (today and tomorrow: reviewing moves them).
  if (prefs.cards) {
    for (const d of [0, 1]) {
      const day = addDays(startOfDay(now), d);
      const n = input.cardsDue[ymd(day)] ?? 0;
      if (n > 0) add(`cards:${ymd(day)}`, at(day, 17), w.cardsTitle, w.cardsBody(n), `/notes`, "learning");
    }
  }

  // Learning streak: 19:30 when today has no practice yet and yesterday had.
  if (prefs.streak) {
    const days = new Set(input.learnDays.filter((d) => d.xp > 0).map((d) => d.day));
    const today = startOfDay(now);
    if (!days.has(ymd(today)) && days.has(ymd(addDays(today, -1)))) {
      let n = 0;
      for (let d = addDays(today, -1); days.has(ymd(d)); d = addDays(d, -1)) n++;
      add(`streak:${ymd(today)}`, at(today, 19, 30), w.streakTitle(n), w.streakBody, `/learn`, "learning");
    }
  }

  // Morning overview: 7:00 on days with something on (a week ahead).
  if (prefs.morning) {
    const items = buildItems({ events: input.events, tasks: input.tasks, cards: [], subjects: [], from: startOfDay(now), to: addDays(startOfDay(now), 8) });
    for (let d = 0; d < 7; d++) {
      const day = addDays(startOfDay(now), d);
      const onDay = items.filter((i) => differenceInCalendarDays(i.start, day) === 0 && !(i.source === "task" && i.done));
      const events = onDay.filter((i) => i.source === "event").length;
      const due = onDay.filter((i) => i.source === "task").length;
      // Expanded: the day's plan, "8:00 Mathe".
      const lines = onDay.slice(0, 30).map((i) => (i.allDay ? i.title : `${w.time(i.start)} ${i.title}`));
      if (events + due > 0) add(`am:${ymd(day)}`, at(day, 7), w.morningTitle, w.morningBody(events, due), `/calendar?date=${ymd(day)}&view=day`, "daily", lines);
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, input.max ?? 60);
}
