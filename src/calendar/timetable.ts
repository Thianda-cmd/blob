import { addDays, startOfDay } from "date-fns";
import type { Row } from "@/lib/offline/sync";
import { dueAt, matchSubject } from "@/lib/tasks";
import type { CalEvent, Recurrence, Subject, SubjectColor, Task } from "@/lib/types";
import { dayOff, type Timetable, type TimetableExam, type TimetableLesson } from "./bta";
import { Builder, newEvent, type Plan } from "./ops";
import { countBefore, hasOccurrenceBefore, inWeeks, occurrences, untilBefore } from "./recurrence";
import { atMinutes, eventSpan, fromYmd, spanToStored, weekStart, ymd } from "./time";

// Importing a school timetable (src/calendar/bta.ts) into the calendar. Every lesson becomes one
// weekly series from the first day chosen to the end of the school year, so changing a lesson
// later ("this and following", "all") changes the weeks ahead too, and "this event only" just
// that day. Holidays and days off are left out of each series (exdates); fortnightly lessons keep
// to their calendar weeks; lessons of one quarter end with it. Importing again replaces what the
// last import made from the chosen day on and keeps the weeks before.

export type SubjectChoice = { subjectId: string | null; color: SubjectColor | null };

export type TitleStyle = "name" | "code";

export type ImportOptions = {
  /** The first day to import (lessons before stay as they are). */
  from: Date;
  titles: TitleStyle;
  /** Per subject code. */
  subjects: Record<string, SubjectChoice>;
  /** Holidays and days off as all-day events. */
  breaks: boolean;
  /** Exams as exam tasks. */
  exams: boolean;
  /** Minutes before each lesson, or none. */
  reminder: number | null;
};

export type ImportContext = { userId: string; timeZone: string | null; events: CalEvent[]; tasks: Task[]; newId: () => string };

export type ImportResult = { plan: Plan; lessons: number; breaks: number; exams: number; replaced: number };

export const sourcePrefix = (tt: Pick<Timetable, "source" | "className">) => `${tt.source}:${tt.className}:`;

const ms = (iso: string) => new Date(iso).getTime();

/** "Mikroorganismen untersuchen · Theorie" or "B5T". */
export function lessonTitle(l: Pick<TimetableLesson, "code" | "name" | "part">, style: TitleStyle) {
  if (style === "code") return l.code;
  return l.part ? `${l.name} · ${l.part}` : l.name;
}

export function examTitle(x: TimetableExam, style: TitleStyle) {
  return `${style === "code" ? x.code : x.name}: ${x.title}`;
}

/** The last school day of the year (the year's end, or the day before the holidays it falls in). */
export function schoolEnd(tt: Pick<Timetable, "year" | "breaks" | "daysOff">): Date {
  let end = fromYmd(tt.year.to)!;
  for (let i = 0; i < 60; i++) {
    const brk = tt.breaks.find((b) => ymd(end) >= b.from && ymd(end) <= b.to);
    if (!brk) break;
    end = addDays(fromYmd(brk.from)!, -1);
  }
  return end;
}

/** The days a lesson can run on: from `from` (or its quarter's start) to the end of the year (or its quarter). */
function lessonRange(l: TimetableLesson, tt: Timetable, from: Date) {
  let first = startOfDay(from);
  const yearStart = fromYmd(tt.year.from)!;
  if (first < yearStart) first = yearStart;
  let last = schoolEnd(tt);
  if (l.rhythm.kind === "quarter") {
    const qFrom = fromYmd(l.rhythm.from)!;
    const qTo = fromYmd(l.rhythm.to)!;
    if (first < qFrom) first = qFrom;
    if (last > qTo) last = qTo;
  }
  return { first, last };
}

/** How the lesson repeats (weekly on its day, maybe only in even or odd weeks, until `last`). */
function lessonRecurrence(l: TimetableLesson, last: Date): Recurrence {
  const day = (l.day + 1) % 7;
  return { freq: "weekly", byDay: [day], until: ymd(last), ...(l.rhythm.kind === "fortnightly" ? { weeks: l.rhythm.weeks } : {}) };
}

/** The first day the lesson really takes place on or after `first` (null: not before `last`). */
function firstLessonDay(l: TimetableLesson, tt: Timetable, first: Date, last: Date): Date | null {
  const r = lessonRecurrence(l, last);
  let d = first;
  while (d.getDay() !== (l.day + 1) % 7) d = addDays(d, 1);
  for (; d <= last; d = addDays(d, 7)) if (inWeeks(r, weekStart(d, 1)) && !dayOff(tt, ymd(d))) return d;
  return null;
}

/** Whether a lesson takes place on `day`. */
export function lessonOn(l: TimetableLesson, tt: Timetable, day: Date): boolean {
  if (day.getDay() !== (l.day + 1) % 7 || dayOff(tt, ymd(day))) return false;
  const { first, last } = lessonRange(l, tt, fromYmd(tt.year.from)!);
  return day >= first && day <= last && inWeeks(lessonRecurrence(l, last), weekStart(day, 1));
}

function lessonDetails(l: TimetableLesson) {
  return [[l.code, l.field, l.part].filter(Boolean).join(" · "), l.teachers.join(", "), l.note, l.correction].filter(Boolean).join("\n").slice(0, 4000) || null;
}

/** Changes that take back what earlier imports from this source made, from `from` on. */
function replaceFrom(b: Builder, events: CalEvent[], prefix: string, from: Date): number {
  const live = events.filter((e) => !e.deleted_at);
  const fromMs = from.getTime();
  let replaced = 0;
  for (const e of live) {
    if (e.series_id || !e.source?.startsWith(prefix)) continue;
    if (!e.recurrence) {
      if (eventSpan(e).start.getTime() >= fromMs) {
        b.remove(e);
        replaced++;
      }
      continue;
    }
    const overrides = live.filter((o) => o.series_id === e.id);
    const later = overrides.filter((o) => ms(o.series_start!) >= fromMs);
    if (!occurrences(e, from, addDays(from, 800)).length && !later.length) continue;
    replaced++;
    if (hasOccurrenceBefore(e, from)) {
      const r = e.recurrence;
      const until = untilBefore(from);
      b.update(e, { recurrence: { ...r, until: r.until && r.until < until ? r.until : until, ...(r.count ? { count: countBefore(e, from) } : {}) } });
      for (const o of later) b.remove(o);
    } else {
      for (const o of overrides) b.remove(o);
      b.remove(e);
    }
  }
  return replaced;
}

/** Series of earlier imports from this timetable that still have lessons on or after `from`. */
export function importedAfter(events: CalEvent[], tt: Pick<Timetable, "source" | "className">, from: Date): number {
  const prefix = sourcePrefix(tt);
  return events.filter((e) => !e.deleted_at && !e.series_id && e.source?.startsWith(prefix) && (e.recurrence ? occurrences(e, from, addDays(from, 800)).length > 0 : eventSpan(e).start >= from)).length;
}

/** Takes the imported timetable out of the calendar from `from` on. */
export function planRemoveImport(tt: Pick<Timetable, "source" | "className">, events: CalEvent[], from: Date): Plan {
  const b = new Builder();
  replaceFrom(b, events, sourcePrefix(tt), startOfDay(from));
  return b.plan;
}

/** Everything the import changes, as one plan (one undo). */
export function planImport(tt: Timetable, opts: ImportOptions, ctx: ImportContext): ImportResult {
  const b = new Builder();
  const prefix = sourcePrefix(tt);
  const from = startOfDay(opts.from);
  const replaced = replaceFrom(b, ctx.events, prefix, from);
  const choice = (code: string): SubjectChoice => opts.subjects[code] ?? { subjectId: null, color: null };

  let lessons = 0;
  for (const l of tt.lessons) {
    const { first, last } = lessonRange(l, tt, from);
    if (first > last) continue;
    const day = firstLessonDay(l, tt, first, last);
    if (!day) continue;
    const start = atMinutes(day, l.start);
    const end = atMinutes(day, l.end);
    const { subjectId, color } = choice(l.code);
    const draft = newEvent({
      id: ctx.newId(),
      user_id: ctx.userId,
      title: lessonTitle(l, opts.titles).slice(0, 200),
      details: lessonDetails(l),
      location: l.room || null,
      kind: "lesson",
      subject_id: subjectId,
      color,
      time_zone: ctx.timeZone,
      ...spanToStored(false, start, end),
      recurrence: lessonRecurrence(l, last),
      reminders: opts.reminder === null ? [] : [opts.reminder],
      source: `${prefix}lesson:${l.id}`.slice(0, 120),
    });
    // The holidays and days off it would fall on.
    const exdates = occurrences(draft, start, addDays(last, 1))
      .filter((o) => dayOff(tt, ymd(o.start)))
      .map((o) => o.original)
      .slice(0, 1000);
    b.insert({ ...draft, exdates });
    lessons++;
  }

  let breaks = 0;
  if (opts.breaks) {
    const end = fromYmd(tt.year.to)!;
    const days: { name: string; from: Date; to: Date }[] = [];
    for (const brk of tt.breaks) {
      const a = fromYmd(brk.from)!;
      const z = fromYmd(brk.to)!;
      if (z < from || a > end) continue;
      days.push({ name: brk.name, from: a < from ? from : a, to: z });
    }
    for (const [d, name] of Object.entries(tt.daysOff)) {
      const day = fromYmd(d)!;
      // Weekends have no school anyway; days inside holidays are part of them.
      if (day < from || day > end || day.getDay() === 0 || day.getDay() === 6 || tt.breaks.some((x) => d >= x.from && d <= x.to)) continue;
      days.push({ name, from: day, to: day });
    }
    days.sort((x, y) => x.from.getTime() - y.from.getTime());
    for (const x of days) {
      b.insert(
        newEvent({
          id: ctx.newId(),
          user_id: ctx.userId,
          title: x.name.slice(0, 200),
          kind: "break",
          color: "sand",
          all_day: true,
          time_zone: ctx.timeZone,
          ...spanToStored(true, x.from, addDays(x.to, 1)),
          source: `${prefix}break:${ymd(x.from)}`,
        }),
      );
      breaks++;
    }
  }

  let exams = 0;
  if (opts.exams) {
    const seen = new Set(ctx.tasks.filter((t) => t.due_at).map((t) => `${t.title.trim().toLowerCase()}|${ymd(new Date(t.due_at!))}`));
    const now = new Date().toISOString();
    for (const x of tt.exams) {
      const day = fromYmd(x.date);
      if (!day || day < from) continue;
      const title = examTitle(x, opts.titles).slice(0, 200);
      const key = `${title.toLowerCase()}|${x.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // At the start of that day's lesson, when there is one.
      const lesson = tt.lessons.filter((l) => l.code === x.code && lessonOn(l, tt, day)).sort((p, q) => p.start - q.start)[0];
      const due = lesson ? atMinutes(day, lesson.start) : dueAt(day, "exam");
      const task: Task = {
        id: ctx.newId(),
        user_id: ctx.userId,
        subject_id: choice(x.code).subjectId,
        title,
        details: [x.code, lesson?.field].filter(Boolean).join(" · ") || null,
        kind: "exam",
        due_at: due.toISOString(),
        done: false,
        completed_at: null,
        status: "todo",
        project_id: null,
        column_id: null,
        position: 0,
        priority: 0,
        assignees: [],
        labels: [],
        checklist: [],
        attachments: [],
        created_at: now,
        updated_at: now,
      };
      b.plan.changes.push({ op: "insert", table: "tasks", id: task.id, row: task as unknown as Row });
      b.plan.undo.unshift({ op: "delete", table: "tasks", id: task.id });
      exams++;
    }
  }

  return { plan: b.plan, lessons, breaks, exams, replaced };
}

// Suggestions for the import dialog ---------------------------------------------------------------

/** Subject colours by hue (the light theme's), for picking the nearest to the school's own colour. */
const HUES: [SubjectColor, number][] = [
  ["clay", 17],
  ["sand", 41],
  ["moss", 103],
  ["teal", 176],
  ["sky", 210],
  ["plum", 283],
  ["rose", 342],
];

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Other names a school subject may have in your subjects. */
const ALIASES: Record<string, string[]> = {
  ENGL: ["Englisch", "English"],
  DEUT: ["Deutsch", "German"],
  MFH: ["Mathe", "Mathematik", "Math", "Maths"],
  EDV: ["EDV", "Informatik", "Computer Science", "IT"],
  "LF 1": ["Chemie", "Chemistry"],
  "LF 3": ["Chemie", "Chemistry"],
  "LF 4": ["Biologie", "Biology", "Botanik"],
  "LF 5": ["Mikrobiologie", "Biologie", "Biology"],
  "LF 6": ["Ökologie", "Biologie", "Biology"],
};

/** One row per subject code: name, colour suggestion and your subject it matches (if any). */
export function suggestSubjects(tt: Timetable, subjects: Subject[]): { code: string; name: string; part: string | null; hue: number; choice: SubjectChoice }[] {
  const byCode = new Map<string, TimetableLesson>();
  for (const l of tt.lessons) if (!byCode.has(l.code)) byCode.set(l.code, l);
  const rows = [...byCode.values()];
  // Each colour once where possible, closest first; subjects of one learning field share theirs.
  const groupOf = (l: TimetableLesson) => l.field ?? l.code;
  const groups = [...new Map(rows.map((l) => [groupOf(l), l.hue])).entries()];
  const colorOf = new Map<string, SubjectColor>();
  const pairs = groups.flatMap(([g, hue]) => HUES.map(([c, h]) => ({ g, c, gap: hueGap(hue, h) }))).sort((a, b) => a.gap - b.gap);
  const used = new Set<SubjectColor>();
  for (const p of pairs) {
    if (colorOf.has(p.g) || used.has(p.c)) continue;
    colorOf.set(p.g, p.c);
    used.add(p.c);
  }
  for (const [g, hue] of groups) if (!colorOf.has(g)) colorOf.set(g, [...HUES].sort((a, b) => hueGap(hue, a[1]) - hueGap(hue, b[1]))[0][0]);

  return rows.map((l) => {
    const names = [l.name, l.code, ...(ALIASES[l.field ?? ""] ?? []), ...(ALIASES[l.code] ?? [])];
    let match: Subject | null = null;
    for (const n of names) {
      match = subjects.find((s) => s.kind !== "notebook" && s.name.trim().toLowerCase() === n.toLowerCase()) ?? null;
      if (match) break;
    }
    if (!match) match = matchSubject(l.name, subjects.filter((s) => s.kind !== "notebook"));
    return { code: l.code, name: l.name, part: l.part, hue: l.hue, choice: { subjectId: match?.id ?? null, color: match ? null : (colorOf.get(groupOf(l)) ?? null) } };
  });
}
