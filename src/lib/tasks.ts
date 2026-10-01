import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  isSameYear,
  isValid,
  set,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject, Task, TaskKind } from "./types";

/* ---------------------------------------------------------------------------
   Kinds
   --------------------------------------------------------------------------- */

export const TASK_KINDS: TaskKind[] = ["homework", "exam", "project", "reminder"];

export const KIND_LABEL: Record<TaskKind, string> = {
  homework: "Homework",
  exam: "Exam",
  project: "Project",
  reminder: "Reminder",
};

export const KIND_PLURAL: Record<TaskKind, string> = {
  homework: "Homework",
  exam: "Exams",
  project: "Projects",
  reminder: "Reminders",
};

export type TimeOfDay = { h: number; m: number };

/** When a task is due if you only gave a day: exams and reminders in the morning, the rest by end of day. */
export const DEFAULT_TIME: Record<TaskKind, TimeOfDay> = {
  homework: { h: 23, m: 59 },
  project: { h: 23, m: 59 },
  exam: { h: 8, m: 0 },
  reminder: { h: 8, m: 0 },
};

const WEEK = { weekStartsOn: 1 } as const;

/** A day plus the kind's default time (or an explicit time). */
export function dueAt(day: Date, kind: TaskKind = "homework", time?: TimeOfDay | null): Date {
  const t = time ?? DEFAULT_TIME[kind];
  return set(startOfDay(day), { hours: t.h, minutes: t.m, seconds: 0, milliseconds: 0 });
}

/** True when the time part is just a default (end of day, or the kind's default), so it's not worth showing. */
export function isDefaultTime(due: Date, kind: TaskKind) {
  const h = due.getHours();
  const m = due.getMinutes();
  if ((h === 23 && m === 59) || (h === 0 && m === 0)) return true;
  const d = DEFAULT_TIME[kind];
  return h === d.h && m === d.m;
}

/** Keep a task's due day but move a default time to the new kind's default (e.g. homework 23:59 → exam 8:00). */
export function retimeForKind(due_at: string | null, from: TaskKind, to: TaskKind): string | null {
  if (!due_at) return null;
  const due = new Date(due_at);
  if (!isDefaultTime(due, from)) return due_at;
  return dueAt(due, to).toISOString();
}

/* ---------------------------------------------------------------------------
   Formatting
   --------------------------------------------------------------------------- */

/** "Today", "Tomorrow", "Fri", "Oct 12", "Yesterday", "2 days late". */
export function formatDue(due: Date | string, now: Date | number = new Date()) {
  const d = typeof due === "string" ? new Date(due) : due;
  const diff = differenceInCalendarDays(d, now);
  if (diff < -1) return `${-diff} days late`;
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 7) return format(d, "EEE");
  return isSameYear(d, now) ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/** Locale-aware short time, e.g. "8:00 AM" or "08:00". */
export function formatTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** Full label for tooltips: "Friday, Oct 2" or "Friday, Oct 2 · 8:00 AM" (end of day is left out). */
export function formatDueLong(due: Date | string) {
  const d = typeof due === "string" ? new Date(due) : due;
  const day = format(d, isSameYear(d, new Date()) ? "EEEE, MMM d" : "EEEE, MMM d, yyyy");
  return d.getHours() === 23 && d.getMinutes() === 59 ? day : `${day} · ${formatTime(d)}`;
}

export type DueTone = "late" | "today" | "soon" | "later";

export function dueTone(due: Date | string, now: Date | number): DueTone {
  const diff = differenceInCalendarDays(typeof due === "string" ? new Date(due) : due, now);
  if (diff < 0) return "late";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "later";
}

/** yyyy-MM-dd in local time, handy as a map key for days. */
export function dayKey(d: Date | string) {
  return format(typeof d === "string" ? new Date(d) : d, "yyyy-MM-dd");
}

/* ---------------------------------------------------------------------------
   Grouping
   --------------------------------------------------------------------------- */

export type TaskGroupKey = "overdue" | "today" | "tomorrow" | "week" | "nextweek" | "later" | "none" | "done";

export const GROUP_LABEL: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  nextweek: "Next week",
  later: "Later",
  none: "No date",
  done: "Done",
};

const GROUP_ORDER: TaskGroupKey[] = ["overdue", "today", "tomorrow", "week", "nextweek", "later", "none", "done"];

export type TaskGroup = { key: TaskGroupKey; label: string; tasks: Task[] };

export function taskBucket(task: Pick<Task, "done" | "due_at">, now: Date | number): TaskGroupKey {
  if (task.done) return "done";
  if (!task.due_at) return "none";
  const due = new Date(task.due_at);
  const diff = differenceInCalendarDays(due, now);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  const nextWeek = startOfWeek(addWeeks(now, 1), WEEK);
  if (due < nextWeek) return "week";
  if (due < addWeeks(nextWeek, 1)) return "nextweek";
  return "later";
}

/** Open tasks by due date, then by creation. Done tasks: most recently completed first. */
export function compareTasks(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.done && b.done) return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
  if (a.due_at !== b.due_at) {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    const diff = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (diff !== 0) return diff;
  }
  return a.created_at.localeCompare(b.created_at);
}

/** Overdue / Today / Tomorrow / This week / Next week / Later / No date / Done. Empty groups are left out. */
export function groupTasks(tasks: Task[], now: Date | number): TaskGroup[] {
  const buckets = new Map<TaskGroupKey, Task[]>();
  for (const t of [...tasks].sort(compareTasks)) {
    const key = taskBucket(t, now);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  return GROUP_ORDER.filter((k) => buckets.has(k)).map((key) => ({ key, label: GROUP_LABEL[key], tasks: buckets.get(key)! }));
}

/** Open tasks due today or earlier: what "done for today" means. */
export function isDueByToday(task: Pick<Task, "done" | "due_at">, now: Date | number) {
  return !task.done && !!task.due_at && differenceInCalendarDays(new Date(task.due_at), now) <= 0;
}

/* ---------------------------------------------------------------------------
   Quick add: "Bio test fri 8am #biology" → title, due date, kind, subject
   --------------------------------------------------------------------------- */

export type QuickAddToken = { start: number; end: number; type: "date" | "time" | "kind" | "subject" };

export type ParsedQuickAdd = {
  /** The text with date, time and #subject phrases removed. */
  title: string;
  /** ISO timestamp, using the kind's default time when no time was typed. */
  due_at: string | null;
  /** Only set when the text hints at it (exam, project, reminder). */
  kind?: TaskKind;
  /** The day the task is due (local midnight) and an explicit time, if any. */
  day: Date | null;
  time: TimeOfDay | null;
  /** Raw text after "#", e.g. "bio". Match it with `matchSubject`. */
  subject?: string;
  /** Recognised spans of the original text, for highlighting. */
  tokens: QuickAddToken[];
};

export type ParseOptions = {
  /** Read "10/12" as October 12 (US). Dotted dates like "12.10" are always day first. */
  monthFirst?: boolean;
  /** Only treat "#tag" as a subject when this says so (otherwise "Exercise #5" would lose its "#5"). */
  isSubject?: (tag: string) => boolean;
};

type Candidate = {
  start: number;
  end: number;
  type: "date" | "time";
  day?: Date;
  time?: TimeOfDay;
  /** Only trusted at the end of the text ("fri", "at 3"): elsewhere they are probably ordinary words. */
  weak?: boolean;
};

const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  couple: 2,
  "a couple of": 2,
  three: 3,
  few: 3,
  "a few": 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const WEEKDAY_RE = "(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";
const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const ORDINAL = "(?:st|nd|rd|th)?";
// Start / end of a "word" (letters, digits, # and accents count as word characters).
const B = "(?<![\\p{L}\\p{N}_#])";
const E = "(?![\\p{L}\\p{N}_])";

/** Words that turn "12.10" into a page number rather than a date ("p. 12.10", "exercise 1.8"). */
const NOT_A_DATE_BEFORE = /(?:\b(?:p|pp|pg|page|pages|ex|exercise|exercises|ch|chap|chapter|chapters|section|sec|no|nr|vol|task|tasks|question|questions|q|nos)\.?|§|#)\s*$/i;

/** "due", "by", "on"… right before a date are dropped from the title together with it. */
const CONNECTOR_BEFORE = /(?:^|\s)((?:(?:due|by|on|for|until|till|til|before|at)\s+)+)$/i;

function re(source: string) {
  return new RegExp(source, "giu");
}

function makeDay(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month, day);
  if (!isValid(d) || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

/** A date without a year means the next one: "Jan 10" typed in December is next January. */
function inferYear(month: number, day: number, now: Date): Date | null {
  const thisYear = makeDay(now.getFullYear(), month, day);
  if (!thisYear) return makeDay(now.getFullYear() + 1, month, day);
  if (differenceInCalendarDays(thisYear, now) < -30) return makeDay(now.getFullYear() + 1, month, day);
  return thisYear;
}

function fullYear(y: string | undefined) {
  if (!y) return null;
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

function nextWeekday(now: Date, target: number, mode: "plain" | "this" | "next"): Date {
  const today = startOfDay(now);
  const current = today.getDay();
  if (mode === "next") {
    // The occurrence in next calendar week (weeks start Monday).
    const monday = startOfWeek(addWeeks(today, 1), WEEK);
    return addDays(monday, (target + 6) % 7);
  }
  let delta = (target - current + 7) % 7;
  if (delta === 0 && mode === "plain") delta = 7; // "friday" said on a Friday means next week
  return addDays(today, delta);
}

function toNumber(word: string) {
  const w = word.toLowerCase().replace(/\s+/g, " ");
  if (/^\d+$/.test(w)) return Number(w);
  return NUMBER_WORDS[w] ?? null;
}

function to24h(hour: number, minute: number, meridiem: string | undefined): TimeOfDay | null {
  let h = hour;
  if (meridiem) {
    const pm = meridiem.toLowerCase().startsWith("p");
    if (h < 1 || h > 12) return null;
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  if (h > 23 || minute > 59) return null;
  return { h, m: minute };
}

function collectCandidates(text: string, now: Date, opts: ParseOptions): Candidate[] {
  const today = startOfDay(now);
  const out: Candidate[] = [];
  const push = (m: RegExpExecArray, c: Omit<Candidate, "start" | "end">) => out.push({ start: m.index, end: m.index + m[0].length, ...c });
  let m: RegExpExecArray | null;

  // today / tonight / tomorrow / day after tomorrow
  const rel = re(`${B}(day after tomorrow|overmorrow|today|tonight|tomorrow|tomorow|tommorow|tommorrow|tmrw|tmr|tmw)${E}`);
  while ((m = rel.exec(text))) {
    const w = m[1].toLowerCase();
    if (w === "day after tomorrow" || w === "overmorrow") push(m, { type: "date", day: addDays(today, 2) });
    else if (w === "today") push(m, { type: "date", day: today });
    else if (w === "tonight") push(m, { type: "date", day: today, time: { h: 20, m: 0 } });
    else push(m, { type: "date", day: addDays(today, 1) });
  }

  // in 3 days / in a week / in two weeks / in a couple of days
  const inN = re(`${B}in\\s+(\\d{1,3}|a couple of|a few|an|a|one|two|three|four|five|six|seven|eight|nine|ten|couple|few)\\s+(days?|weeks?|months?)${E}`);
  while ((m = inN.exec(text))) {
    const n = toNumber(m[1]);
    if (n == null) continue;
    const unit = m[2].toLowerCase();
    const day = unit.startsWith("day") ? addDays(today, n) : unit.startsWith("week") ? addWeeks(today, n) : addMonths(today, n);
    push(m, { type: "date", day });
  }

  // next week / next month / this weekend / end of week
  const span = re(`${B}(next week|next month|(?:this |the |next )?weekend|end of (?:the )?week|eow|this week)${E}`);
  while ((m = span.exec(text))) {
    const w = m[1].toLowerCase();
    let day: Date;
    if (w === "next week") day = startOfWeek(addWeeks(today, 1), WEEK);
    else if (w === "next month") day = startOfMonth(addMonths(today, 1));
    else if (w === "next weekend") day = nextWeekday(now, 6, "next");
    else if (w.endsWith("weekend")) day = today.getDay() === 0 ? today : nextWeekday(now, 6, "this");
    else {
      // end of week / this week → Friday (or next Friday when the week is already over)
      day = today.getDay() === 6 || today.getDay() === 0 ? nextWeekday(now, 5, "next") : nextWeekday(now, 5, "this");
    }
    push(m, { type: "date", day });
  }

  // weekdays: fri, on friday, next monday, this thu
  const wd = re(`${B}(?:(next|this|coming|on|by|due)\\s+)?${WEEKDAY_RE}${E}`);
  while ((m = wd.exec(text))) {
    const qualifier = m[1]?.toLowerCase();
    const word = m[2];
    const isFull = /day$/i.test(word);
    // "sat", "sun", "wed"… are also ordinary words ("SAT prep", "the sun"): without a qualifier
    // they only count at the end of the text.
    const weak = !isFull && !qualifier;
    if (weak && (word === word.toUpperCase() || /\b(?:the|a|an|my|your|our|his|her|their)\s+$/i.test(text.slice(0, m.index)))) continue;
    const target = WEEKDAYS[word.slice(0, 3).toLowerCase()];
    const mode = qualifier === "next" ? "next" : qualifier === "this" ? "this" : "plain";
    // Keep "on"/"by"/"due" out of the date span itself; the connector pass removes them from the title.
    if (qualifier && !["next", "this", "coming"].includes(qualifier)) {
      const start = m.index + m[0].length - word.length;
      out.push({ start, end: start + word.length, type: "date", day: nextWeekday(now, target, mode) });
    } else {
      push(m, { type: "date", day: nextWeekday(now, target, mode), weak });
    }
  }

  // ISO 2026-10-12
  const iso = re(`${B}(\\d{4})-(\\d{1,2})-(\\d{1,2})${E}`);
  while ((m = iso.exec(text))) {
    const day = makeDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (day) push(m, { type: "date", day });
  }

  // 12.10 / 12.10.2026 / 12/10 / 10/12/26
  const num = re(`${B}(\\d{1,2})([./])(\\d{1,2})(?:\\2(\\d{4}|\\d{2}))?(?:\\.(?!\\d))?(?![\\d/]|\\.\\d|:\\d)`);
  while ((m = num.exec(text))) {
    if (NOT_A_DATE_BEFORE.test(text.slice(0, m.index))) continue;
    const a = Number(m[1]);
    const b = Number(m[3]);
    let dd = a;
    let mm = b;
    if (m[2] === "/") {
      const monthFirst = a > 12 ? false : b > 12 ? true : !!opts.monthFirst;
      dd = monthFirst ? b : a;
      mm = monthFirst ? a : b;
    }
    const y = fullYear(m[4]);
    const day = y ? makeDay(y, mm - 1, dd) : inferYear(mm - 1, dd, now);
    if (day) push(m, { type: "date", day });
  }

  // Oct 12 / October 12th, 2026
  const md = re(`${B}${MONTH_RE}\\s+(\\d{1,2})${ORDINAL}(?:,?\\s+(\\d{4}))?${E}`);
  while ((m = md.exec(text))) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const y = fullYear(m[3]);
    const day = y ? makeDay(y, month, Number(m[2])) : inferYear(month, Number(m[2]), now);
    if (day) push(m, { type: "date", day });
  }

  // 12 Oct / 12th of October
  const dm = re(`${B}(\\d{1,2})${ORDINAL}(?:\\s+of)?\\s+${MONTH_RE}(?:,?\\s+(\\d{4}))?${E}`);
  while ((m = dm.exec(text))) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const y = fullYear(m[3]);
    const day = y ? makeDay(y, month, Number(m[1])) : inferYear(month, Number(m[1]), now);
    if (day) push(m, { type: "date", day });
  }

  // Times: 8am, 3:30 pm, at 15:00, @ 9, at 8.30, noon, midnight
  const ampm = re(`${B}(?:(?:at|@)\\s*)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)(?![\\p{L}])`);
  while ((m = ampm.exec(text))) {
    const time = to24h(Number(m[1]), Number(m[2] ?? 0), m[3]);
    if (time) push(m, { type: "time", time });
  }
  const h24 = re(`${B}(?:(?:at|@)\\s*)?([01]?\\d|2[0-3]):([0-5]\\d)${E}`);
  while ((m = h24.exec(text))) push(m, { type: "time", time: { h: Number(m[1]), m: Number(m[2]) } });
  const atDot = re(`${B}(?:at|@)\\s*([01]?\\d|2[0-3])\\.([0-5]\\d)${E}`);
  while ((m = atDot.exec(text))) push(m, { type: "time", time: { h: Number(m[1]), m: Number(m[2]) } });
  const atHour = re(`${B}(?:at|@)\\s*(\\d{1,2})(?![\\d.:/\\p{L}])`);
  while ((m = atHour.exec(text))) {
    const h = Number(m[1]);
    if (h < 1 || h > 23) continue;
    // "at 3" in a school context almost always means the afternoon. "Look at 2 graphs" is not a time.
    push(m, { type: "time", time: { h: h <= 6 ? h + 12 : h, m: 0 }, weak: true });
  }
  const named = re(`${B}(?:at\\s+)?(noon|midday|midnight)${E}`);
  while ((m = named.exec(text))) push(m, { type: "time", time: m[1].toLowerCase() === "midnight" ? { h: 23, m: 59 } : { h: 12, m: 0 } });

  return out;
}

/** Weak candidates survive only when nothing but other dates/times, #tags and punctuation follow them. */
function dropWeak(text: string, cands: Candidate[]) {
  return cands.filter((c) => {
    if (!c.weak) return true;
    const rest = text.split("");
    for (const o of cands) if (o !== c) for (let i = o.start; i < o.end; i++) rest[i] = " ";
    return /^[\s,.;:!?]*(?:#[\p{L}\p{N}_-]+[\s,.;:!?]*)*$/u.test(rest.join("").slice(c.end));
  });
}

/** Longest candidates win; overlapping shorter ones are dropped. */
function dropOverlaps(cands: Candidate[]) {
  const sorted = [...cands].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Candidate[] = [];
  for (const c of sorted) if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
  return kept.sort((a, b) => a.start - b.start);
}

const KIND_HINTS: { kind: TaskKind; re: RegExp }[] = [
  { kind: "exam", re: re(`${B}(tests?|exams?|quiz(?:zes)?|midterms?|finals|final exam|klausur|vocab test|oral exam)${E}`) },
  { kind: "project", re: re(`${B}(projects?|presentation|poster|portfolio)${E}`) },
  { kind: "reminder", re: re(`${B}(bring|remember|reminder|don'?t forget|remind me)${E}`) },
];

const REMINDER_PREFIX = /^\s*(?:remind me (?:to|about|of)|don'?t forget (?:to )?|reminder:?)\s+/i;

export function parseQuickAdd(text: string, now: Date = new Date(), opts: ParseOptions = {}): ParsedQuickAdd {
  const tokens: QuickAddToken[] = [];
  const remove: { start: number; end: number }[] = [];

  // #subject (the first one that names a subject wins)
  let subject: string | undefined;
  let tag: RegExpExecArray | null = null;
  for (const t of text.matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu)) {
    if (opts.isSubject && !opts.isSubject(t[2])) continue;
    tag = t as RegExpExecArray;
    break;
  }
  if (tag) {
    const start = tag.index + tag[1].length;
    subject = tag[2];
    tokens.push({ start, end: start + 1 + tag[2].length, type: "subject" });
    remove.push({ start, end: start + 1 + tag[2].length });
  }

  // Dates and times: the last one typed wins ("prepare for monday's quiz due friday").
  const cands = dropOverlaps(dropWeak(text, collectCandidates(text, now, opts))).filter((c) => !tag || c.end <= tag.index + tag[1].length || c.start >= tag.index + tag[0].length);
  const date = [...cands].reverse().find((c) => c.type === "date");
  const timeCand = [...cands].reverse().find((c) => c.type === "time");
  let day: Date | null = date?.day ?? null;
  let time: TimeOfDay | null = timeCand?.time ?? date?.time ?? null;

  for (const c of [date, timeCand]) {
    if (!c) continue;
    tokens.push({ start: c.start, end: c.end, type: c.type });
    // Swallow a connector right before it: "essay due friday" → "essay".
    const before = CONNECTOR_BEFORE.exec(text.slice(0, c.start));
    remove.push({ start: before ? c.start - before[1].length : c.start, end: c.end });
  }

  // A time on its own means today, or tomorrow if that time has already passed.
  if (!day && timeCand?.time) {
    day = startOfDay(now);
    if (dueAt(day, "homework", timeCand.time) < now) day = addDays(day, 1);
  }
  if (date?.time && timeCand?.time) time = timeCand.time;

  // Kind from keywords. They stay in the title ("Biology test"), except "remind me to…".
  let kind: TaskKind | undefined;
  for (const hint of KIND_HINTS) {
    hint.re.lastIndex = 0;
    const k = hint.re.exec(text);
    if (k) {
      kind = hint.kind;
      tokens.push({ start: k.index, end: k.index + k[0].length, type: "kind" });
      break;
    }
  }
  const prefix = REMINDER_PREFIX.exec(text);
  if (prefix) {
    kind = "reminder";
    remove.push({ start: 0, end: prefix[0].length });
  }

  // Build the title from what's left.
  let title = "";
  let cursor = 0;
  for (const r of [...remove].sort((a, b) => a.start - b.start)) {
    if (r.start > cursor) title += text.slice(cursor, r.start);
    title += " ";
    cursor = Math.max(cursor, r.end);
  }
  title += text.slice(cursor);
  title = title
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")
    .trim();
  if (remove.length) title = title.replace(/\s+(?:due|by|on|for|until|till|at)$/i, "").trim();
  if (prefix && title) title = title[0].toUpperCase() + title.slice(1);

  const due = day ? dueAt(day, kind ?? "homework", time) : null;
  return {
    title,
    due_at: due ? due.toISOString() : null,
    kind,
    day: day ? startOfDay(day) : null,
    time,
    subject,
    tokens: tokens.sort((a, b) => a.start - b.start),
  };
}

/** Find the subject a "#tag" refers to: exact name, prefix, initials ("cs"), then substring. */
export function matchSubject<S extends Pick<Subject, "id" | "name">>(query: string | undefined | null, subjects: S[]): S | null {
  if (!query) return null;
  const q = query.toLowerCase().replace(/[-_]+/g, " ").trim();
  if (!q) return null;
  const norm = (s: string) => s.toLowerCase().trim();
  const squash = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, "");
  return (
    subjects.find((s) => norm(s.name) === q) ??
    subjects.find((s) => squash(s.name) === squash(q)) ??
    subjects.find((s) => norm(s.name).startsWith(q)) ??
    subjects.find((s) =>
      norm(s.name)
        .split(/\s+/)
        .map((w) => w[0])
        .join("") === q,
    ) ??
    (q.length >= 2 ? subjects.find((s) => norm(s.name).includes(q)) : undefined) ??
    null
  );
}

/** Subjects for the "#" autocomplete, best matches first. */
export function suggestSubjects<S extends Pick<Subject, "id" | "name">>(query: string, subjects: S[], limit = 6): S[] {
  const q = query.toLowerCase().replace(/[-_]+/g, " ");
  if (!q) return subjects.slice(0, limit);
  const score = (s: S) => {
    const n = s.name.toLowerCase();
    if (n.startsWith(q)) return 0;
    if (n.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (n.includes(q)) return 2;
    return 9;
  };
  return subjects
    .map((s) => [s, score(s)] as const)
    .filter(([, sc]) => sc < 9)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([s]) => s);
}

/* ---------------------------------------------------------------------------
   Loading (works with the server or the browser Supabase client)
   --------------------------------------------------------------------------- */

const RECENT_DONE_DAYS = 7;

/** Open tasks plus anything completed in the last week, soonest first. */
export async function loadTasks(supabase: SupabaseClient, opts: { subjectId?: string } = {}): Promise<Task[]> {
  const since = addDays(new Date(), -RECENT_DONE_DAYS).toISOString();
  let query = supabase.from("tasks").select("*").or(`done.eq.false,completed_at.gte.${since}`);
  if (opts.subjectId) query = query.eq("subject_id", opts.subjectId);
  const { data } = await query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at").limit(500);
  return (data ?? []) as Task[];
}

/**
 * For the Home dashboard: open tasks that are overdue or due within the next week.
 * Fetches a day of slack because the server doesn't know the user's time zone; `UpcomingTasks` trims it.
 */
export async function loadUpcomingTasks(supabase: SupabaseClient, days = 7): Promise<Task[]> {
  const until = addDays(new Date(), days + 1).toISOString();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("done", false)
    .not("due_at", "is", null)
    .lte("due_at", until)
    .order("due_at", { ascending: true })
    .limit(50);
  return (data ?? []) as Task[];
}
