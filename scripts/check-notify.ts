// Checks what Blob plans to remind of (src/lib/notify/plan.ts):
//   TZ=Europe/Berlin npx tsx --tsconfig tsconfig.json scripts/check-notify.ts
import { DEFAULT_PREFS, notifyId, plan, prefsOf, type NotifyWords } from "../src/lib/notify/plan";
import type { CalEvent, Task } from "../src/lib/types";

let failed = 0;
let passed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else {
    failed++;
    console.error(`✗ ${name}`, { got, want });
  }
};
const at = (m: number, d: number, h = 0, min = 0) => new Date(2026, m - 1, d, h, min);
const hm = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const words: NotifyWords = {
  eventSoon: (m) => `in ${m}`,
  eventAt: (w) => w,
  eventAllDay: (d) => `${d} all day`,
  homeworkTitle: "Due tomorrow",
  homeworkBody: (t) => t.join(" & "),
  reminderTitle: "Reminder",
  examIn: (n) => `Exam in ${n}`,
  examToday: "Exam today",
  cardsTitle: "Cards",
  cardsBody: (n) => `${n} cards`,
  streakTitle: (n) => `${n} days`,
  streakBody: "keep going",
  morningTitle: "Your day",
  morningBody: (e, d) => `${e}/${d}`,
  time: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`,
  day: (d, now) => (d.getDate() === now.getDate() ? "Today" : "Later"),
};

const base = { user_id: "u", subject_id: null, details: null, location: null, kind: "event" as const, color: null, time_zone: null, exdates: [], series_id: null, series_start: null, deleted_at: null, created_at: "", updated_at: "" };
const events: CalEvent[] = [
  { ...base, id: "e1", title: "Chor", all_day: false, starts_at: at(10, 14, 10).toISOString(), ends_at: at(10, 14, 11).toISOString(), recurrence: null, reminders: [10, 1440] },
  { ...base, id: "e2", title: "Ausflug", all_day: true, starts_at: "2026-10-16T00:00:00.000Z", ends_at: "2026-10-17T00:00:00.000Z", recurrence: null, reminders: [-540] },
  { ...base, id: "e3", title: "Sport", all_day: false, starts_at: at(10, 13, 15).toISOString(), ends_at: at(10, 13, 16).toISOString(), recurrence: { freq: "weekly" }, reminders: [30] },
];
const task = (p: Partial<Task>): Task => ({ id: "t", user_id: "u", subject_id: null, title: "T", details: null, kind: "homework", due_at: null, done: false, completed_at: null, status: "todo", project_id: null, column_id: null, position: 0, priority: 0, assignees: [], labels: [], checklist: [], attachments: [], created_at: "", updated_at: "", ...p });
const tasks: Task[] = [
  task({ id: "h1", title: "Bio", due_at: at(10, 15, 23, 59).toISOString() }),
  task({ id: "h2", title: "Mathe", due_at: at(10, 15, 23, 59).toISOString() }),
  task({ id: "h3", title: "Done", due_at: at(10, 15, 23, 59).toISOString(), done: true }),
  task({ id: "x1", title: "Englisch", kind: "exam", due_at: at(10, 20, 8).toISOString() }),
  task({ id: "r1", title: "Geld mitbringen", kind: "reminder", due_at: at(10, 14, 7, 30).toISOString() }),
  task({ id: "p1", title: "Projektkarte", project_id: "proj", due_at: at(10, 15, 23, 59).toISOString() }),
];
const now = at(10, 14, 8);
const out = plan({ now, events, tasks, cardsDue: { "2026-10-14": 3, "2026-10-15": 0 }, learnDays: [{ day: "2026-10-13", xp: 40 }, { day: "2026-10-12", xp: 10 }], prefs: DEFAULT_PREFS, words, horizon: 14 });
const line = (p: (typeof out)[number]) => `${hm(p.at)} ${p.title}: ${p.body}`;
const shown = out.map(line);
eq("first few", shown.slice(0, 6), ["10/14 09:50 Chor: in 10", "10/14 17:00 Cards: 3 cards", "10/14 18:00 Due tomorrow: Bio & Mathe", "10/14 19:30 2 days: keep going", "10/16 09:00 Ausflug: Today all day", "10/18 18:00 Exam in 2: Englisch"]);
eq("all-day reminder at 9:00 on the day", shown.filter((s) => s.includes("Ausflug")), ["10/16 09:00 Ausflug: Today all day"]);
eq("exam reminders (the week-before one is already past)", shown.filter((s) => s.includes("Exam")), ["10/18 18:00 Exam in 2: Englisch", "10/19 18:00 Exam in 1: Englisch", "10/20 07:00 Exam today: Englisch"]);
eq("weekly series: the next two Tuesdays", shown.filter((s) => s.includes("Sport")), ["10/20 14:30 Sport: in 30", "10/27 14:30 Sport: in 30"]);
eq("reminder in the past is left out", shown.filter((s) => s.includes("Geld")).length, 0);
eq("the day-before reminder of today's event is in the past", shown.filter((s) => s.startsWith("10/13")).length, 0);
eq("weekly series repeats its reminder", shown.filter((s) => s.includes("Sport")).length, 2);
eq("project cards and done tasks are not homework", shown.some((s) => s.includes("Projektkarte") || s.includes("Done")), false);
eq("ids are unique", new Set(out.map((p) => p.id)).size, out.length);
eq("ids are stable", notifyId("e:x:10"), notifyId("e:x:10"));
eq("ids are positive 31-bit", out.every((p) => p.id > 0 && p.id < 2 ** 31), true);
const off = plan({ now, events, tasks, cardsDue: {}, learnDays: [], prefs: prefsOf({ events: false, homework: false, exams: false, reminders: false, cards: false, streak: false }), words });
eq("all off", off.length, 0);
const morning = plan({ now, events, tasks, cardsDue: {}, learnDays: [], prefs: prefsOf({ events: false, homework: false, exams: false, reminders: false, cards: false, streak: false, morning: true }), words });
eq("morning overviews", morning.map(line).slice(0, 2), ["10/15 07:00 Your day: 0/2", "10/16 07:00 Your day: 1/0"]);
eq("cap", plan({ now, events, tasks, cardsDue: {}, learnDays: [], prefs: DEFAULT_PREFS, words, max: 3 }).length, 3);

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
