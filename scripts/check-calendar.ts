// Checks the calendar's date logic: repeating events, item building and layout. Runs in a time zone
// with daylight saving time, so the clock changes are covered:
//   TZ=Europe/Berlin npx tsx --tsconfig tsconfig.json scripts/check-calendar.ts
import { buildItems, inLane, taskSpan, type CalItem } from "../src/calendar/items";
import { fitLane, itemDays, layoutDay, monthWeeks, packLane } from "../src/calendar/layout";
import { countBefore, hasOccurrenceBefore, occurrenceOn, occurrences, untilBefore } from "../src/calendar/recurrence";
import { allDayIso, atMinutes, eventSpan, minutesInto, spanToStored, weekStart, ymd } from "../src/calendar/time";
import { planDelete, planEdit, scopesFor } from "../src/calendar/ops";
import { publicHolidays, rhythmOf, type Timetable } from "../src/calendar/bta";
import { importedAfter, planImport, planRemoveImport, schoolEnd } from "../src/calendar/timetable";
import { isoWeek } from "../src/calendar/time";
import type { Change } from "../src/lib/offline/sync";
import type { CalEvent, Task } from "../src/lib/types";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`✗ ${name}`, detail ?? "");
  }
}
const eq = (name: string, got: unknown, want: unknown) => check(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const hm = (d: Date) => `${ymd(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function event(p: Partial<CalEvent> & { start: Date; end: Date }): CalEvent {
  const { start, end, ...rest } = p;
  const allDay = rest.all_day ?? false;
  const stored = spanToStored(allDay, start, end);
  return {
    id: rest.id ?? `e${Math.random().toString(36).slice(2, 8)}`,
    user_id: "u",
    subject_id: null,
    title: "Event",
    details: null,
    location: null,
    kind: "event",
    color: null,
    all_day: allDay,
    time_zone: "Europe/Berlin",
    recurrence: null,
    exdates: [],
    series_id: null,
    series_start: null,
    reminders: [],
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...rest,
    ...stored,
  };
}

function task(p: Partial<Task>): Task {
  return {
    id: `t${Math.random().toString(36).slice(2, 8)}`,
    user_id: "u",
    subject_id: null,
    title: "Task",
    details: null,
    kind: "homework",
    due_at: null,
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (tz !== "Europe/Berlin") console.warn(`(running in ${tz}; the clock-change checks expect Europe/Berlin)`);

// Time helpers ----------------------------------------------------------------------------------

{
  // 25 October 2026: clocks go back in Berlin (the day has 25 hours).
  const day = at(2026, 10, 25);
  eq("minutesInto: wall clock on the clock-change day", minutesInto(day, at(2026, 10, 25, 8)), 480);
  eq("minutesInto: next day", minutesInto(day, at(2026, 10, 26, 1)), 1500);
  eq("minutesInto: day before", minutesInto(day, at(2026, 10, 24, 23)), -60);
  eq("atMinutes", hm(atMinutes(day, 8 * 60 + 15)), "2026-10-25 08:15");
  eq("atMinutes past midnight", hm(atMinutes(day, 1440 + 30)), "2026-10-26 00:30");
  eq("allDayIso", allDayIso(at(2026, 3, 29)), "2026-03-29T00:00:00.000Z");
  const span = eventSpan({ all_day: true, starts_at: "2026-03-29T00:00:00.000Z", ends_at: "2026-03-31T00:00:00+00:00" });
  eq("all-day span reads the dates", [hm(span.start), hm(span.end)], ["2026-03-29 00:00", "2026-03-31 00:00"]);
  const s = spanToStored(true, at(2026, 5, 1, 14), at(2026, 5, 1, 15));
  eq("spanToStored all-day keeps at least a day", s, { starts_at: "2026-05-01T00:00:00.000Z", ends_at: "2026-05-02T00:00:00.000Z" });
  eq("weekStart Monday", ymd(weekStart(at(2026, 10, 11), 1)), "2026-10-05");
  eq("weekStart Sunday", ymd(weekStart(at(2026, 10, 11), 0)), "2026-10-11");
}

// Repeating events -------------------------------------------------------------------------------

{
  // Mon + Wed 8:00–9:30 from Monday 12 Oct, across the clock change.
  const e = event({ start: at(2026, 10, 12, 8), end: at(2026, 10, 12, 9, 30), recurrence: { freq: "weekly", byDay: [1, 3] } });
  const occ = occurrences(e, at(2026, 10, 19), at(2026, 11, 2));
  eq(
    "weekly Mon/Wed keeps 8:00 across the clock change",
    occ.map((o) => hm(o.start)),
    ["2026-10-19 08:00", "2026-10-21 08:00", "2026-10-26 08:00", "2026-10-28 08:00"],
  );
  eq("weekly indexes", occ.map((o) => o.index), [2, 3, 4, 5]);
  eq("weekly length", occ.map((o) => (o.end.getTime() - o.start.getTime()) / 60e3), [90, 90, 90, 90]);
  eq("occurrence original is the stored UTC start", occ[2].original, new Date(2026, 9, 26, 8).toISOString());

  const skip = { ...e, exdates: [occ[0].original] };
  eq("exdates skip", occurrences(skip, at(2026, 10, 19), at(2026, 10, 26)).map((o) => hm(o.start)), ["2026-10-21 08:00"]);
  const overridden = new Set([new Date(occ[1].original.replace(".000Z", "+00:00")).getTime()]);
  eq("overridden skip (any timestamp spelling)", occurrences(e, at(2026, 10, 19), at(2026, 10, 26), overridden).map((o) => hm(o.start)), ["2026-10-19 08:00"]);

  eq("occurrenceOn", occurrenceOn(e, at(2026, 10, 28))?.index, 5);
  eq("occurrenceOn none", occurrenceOn(e, at(2026, 10, 27)), null);
  eq("countBefore", countBefore(e, at(2026, 10, 26)), 4);
  eq("hasOccurrenceBefore start", hasOccurrenceBefore(e, at(2026, 10, 12, 8)), false);
  eq("hasOccurrenceBefore later", hasOccurrenceBefore(e, at(2026, 10, 13)), true);
  eq("untilBefore", untilBefore(at(2026, 11, 1, 10)), "2026-10-31");
}

{
  // Starts on a Wednesday with byDay Mon/Wed: the Monday before the start doesn't count.
  const e = event({ start: at(2026, 10, 14, 10), end: at(2026, 10, 14, 11), recurrence: { freq: "weekly", byDay: [1, 3], count: 3 } });
  eq("weekly from mid-week with count", occurrences(e, at(2026, 10, 1), at(2026, 12, 1)).map((o) => ymd(o.start)), ["2026-10-14", "2026-10-19", "2026-10-21"]);
  const every2 = event({ start: at(2026, 10, 12, 10), end: at(2026, 10, 12, 11), recurrence: { freq: "weekly", interval: 2 } });
  eq("every 2 weeks", occurrences(every2, at(2026, 10, 1), at(2026, 11, 15)).map((o) => ymd(o.start)), ["2026-10-12", "2026-10-26", "2026-11-09"]);
  const sunday = event({ start: at(2026, 10, 11, 18), end: at(2026, 10, 11, 19), recurrence: { freq: "weekly", byDay: [0, 6] } });
  eq("weekly Sat/Sun (week starts Monday)", occurrences(sunday, at(2026, 10, 1), at(2026, 10, 19)).map((o) => ymd(o.start)), ["2026-10-11", "2026-10-17", "2026-10-18"]);
}

{
  const daily = event({ start: at(2026, 3, 27, 7), end: at(2026, 3, 27, 7, 30), recurrence: { freq: "daily", until: "2026-03-30" } });
  eq("daily until (inclusive) across the spring change", occurrences(daily, at(2026, 3, 1), at(2026, 5, 1)).map(hmStart), ["2026-03-27 07:00", "2026-03-28 07:00", "2026-03-29 07:00", "2026-03-30 07:00"]);
  const monthly = event({ start: at(2026, 1, 31, 9), end: at(2026, 1, 31, 10), recurrence: { freq: "monthly" } });
  eq("monthly on the 31st skips short months", occurrences(monthly, at(2026, 1, 1), at(2026, 9, 1)).map((o) => ymd(o.start)), ["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31", "2026-08-31"]);
  const leap = event({ start: at(2028, 2, 29), end: at(2028, 3, 1), all_day: true, recurrence: { freq: "yearly" } });
  eq("yearly on 29 February", occurrences(leap, at(2028, 1, 1), at(2037, 1, 1)).map((o) => ymd(o.start)), ["2028-02-29", "2032-02-29", "2036-02-29"]);
  const birthday = event({ start: at(2010, 10, 12), end: at(2010, 10, 13), all_day: true, kind: "birthday", recurrence: { freq: "yearly" } });
  const b = occurrences(birthday, at(2026, 10, 1), at(2026, 11, 1));
  eq("yearly all-day years later", b.map((o) => [ymd(o.start), ymd(o.end), o.index, o.original]), [["2026-10-12", "2026-10-13", 16, "2026-10-12T00:00:00.000Z"]]);
  const trip = event({ start: at(2026, 10, 9), end: at(2026, 10, 12), all_day: true, recurrence: { freq: "weekly" } });
  eq("multi-day all-day occurrence reaching into the range", occurrences(trip, at(2026, 10, 11), at(2026, 10, 12)).map((o) => [ymd(o.start), ymd(o.end)]), [["2026-10-09", "2026-10-12"]]);
  const night = event({ start: at(2026, 10, 10, 22), end: at(2026, 10, 11, 2), recurrence: { freq: "daily" } });
  eq("overnight occurrence reaching into the range", occurrences(night, at(2026, 10, 11), at(2026, 10, 11, 12)).map((o) => hm(o.start)), ["2026-10-10 22:00"]);
}

function hmStart(o: { start: Date }) {
  return hm(o.start);
}

// Items --------------------------------------------------------------------------------------------

{
  const series = event({ id: "s1", title: "Maths", start: at(2026, 10, 12, 8), end: at(2026, 10, 12, 9), recurrence: { freq: "daily" } });
  const moved = event({ id: "o1", title: "Maths (moved)", start: at(2026, 10, 13, 10), end: at(2026, 10, 13, 11), series_id: "s1", series_start: new Date(2026, 9, 13, 8).toISOString().replace(".000Z", "+00:00") });
  const orphan = event({ id: "o2", start: at(2026, 10, 13, 12), end: at(2026, 10, 13, 13), series_id: "gone", series_start: new Date(2026, 9, 13, 12).toISOString() });
  const deleted = event({ id: "d1", start: at(2026, 10, 13, 15), end: at(2026, 10, 13, 16), deleted_at: "2026-10-01T00:00:00Z" });
  const homework = task({ id: "h1", due_at: at(2026, 10, 13, 23, 59).toISOString() });
  const timed = task({ id: "h2", due_at: at(2026, 10, 13, 14).toISOString() });
  const exam = task({ id: "x1", kind: "exam", due_at: at(2026, 10, 13, 8).toISOString() });
  const card = task({ id: "p1", project_id: "proj", due_at: at(2026, 10, 13, 8).toISOString() });
  const items = buildItems({ events: [series, moved, orphan, deleted], tasks: [homework, timed, exam, card], cards: [], subjects: [], from: at(2026, 10, 13), to: at(2026, 10, 14) });
  eq(
    "items for a day",
    items.map((i) => `${i.key.replace(/:\d+$/, ":n")} ${i.allDay ? "all-day" : hm(i.start)}`),
    ["task:h1 all-day", "task:x1 all-day", "o1 2026-10-13 10:00", "task:h2 2026-10-13 14:00"],
  );
  const o1 = items.find((i) => i.id === "o1")!;
  eq("override knows its series", [o1.occurrence?.series.id, o1.movable], ["s1", true]);
  const h2 = items.find((i) => i.id === "h2")!;
  eq("timed task is a marker", [h2.marker, h2.resizable, (h2.end.getTime() - h2.start.getTime()) / 60e3], [true, false, 30]);
  check("exam flagged", items.find((i) => i.id === "x1")!.exam);
  const next = buildItems({ events: [series, moved], tasks: [], cards: [], subjects: [], from: at(2026, 10, 14), to: at(2026, 10, 15) });
  eq("series occurrence key", next.map((i) => i.key), [`s1:${at(2026, 10, 14, 8).getTime()}`]);
  const hidden = buildItems({ events: [series], tasks: [homework], cards: [], subjects: [], from: at(2026, 10, 13), to: at(2026, 10, 14), filters: { events: true, tasks: false, cards: true, done: true, hidden: ["none"] } });
  eq("filters", hidden.length, 0);
  eq("taskSpan default time", taskSpan({ due_at: at(2026, 10, 13, 8).toISOString(), kind: "reminder" })?.allDay, true);
  eq("taskSpan explicit time", taskSpan({ due_at: at(2026, 10, 13, 8).toISOString(), kind: "homework" })?.allDay, false);
}

// Layout -------------------------------------------------------------------------------------------

function item(key: string, start: Date, end: Date, allDay = false): CalItem {
  return { key, source: "event", id: key, title: key, start, end, allDay, color: "", kind: "event", subjectId: null, movable: true, resizable: true, done: false, marker: false, exam: false };
}

{
  const day = at(2026, 10, 13);
  const boxes = layoutDay(
    [
      item("a", at(2026, 10, 13, 9), at(2026, 10, 13, 11)),
      item("b", at(2026, 10, 13, 9, 30), at(2026, 10, 13, 10)),
      item("c", at(2026, 10, 13, 10, 30), at(2026, 10, 13, 12)),
      item("d", at(2026, 10, 13, 14), at(2026, 10, 13, 15)),
      item("e", at(2026, 10, 12, 23), at(2026, 10, 13, 1)),
      item("f", at(2026, 10, 13, 23), at(2026, 10, 14, 1)),
      item("g", at(2026, 10, 12, 20), at(2026, 10, 13, 0)),
    ],
    day,
  );
  const by = Object.fromEntries(boxes.map((b) => [b.item.key, b]));
  eq("overlap columns", ["a", "b", "c"].map((k) => [by[k].col, by[k].cols, by[k].span]), [[0, 2, 1], [1, 2, 1], [1, 2, 1]]);
  eq("alone takes the width", [by.d.col, by.d.cols, by.d.span], [0, 1, 1]);
  eq("from the day before", [by.e.top, by.e.bottom, by.e.fromBefore, by.e.goesOn], [0, 60, true, false]);
  eq("into the next day", [by.f.top, by.f.bottom, by.f.fromBefore, by.f.goesOn], [1380, 1440, false, true]);
  check("ending at midnight before stays out", !by.g);

  const spread = layoutDay(
    [item("x", at(2026, 10, 13, 9), at(2026, 10, 13, 12)), item("y", at(2026, 10, 13, 9), at(2026, 10, 13, 10)), item("z", at(2026, 10, 13, 9), at(2026, 10, 13, 10)), item("w", at(2026, 10, 13, 10), at(2026, 10, 13, 11))],
    day,
  );
  const s = Object.fromEntries(spread.map((b) => [b.item.key, [b.col, b.cols, b.span]]));
  eq("stretch into free columns", s, { x: [0, 3, 1], y: [1, 3, 1], z: [2, 3, 1], w: [1, 3, 2] });

  const short = layoutDay([item("p", at(2026, 10, 13, 9), at(2026, 10, 13, 9, 5)), item("q", at(2026, 10, 13, 9, 10), at(2026, 10, 13, 9, 30))], day);
  eq("short items count as 20 minutes", short.map((b) => [b.col, b.cols]), [[0, 2], [1, 2]]);
}

{
  const days = Array.from({ length: 7 }, (_, i) => at(2026, 10, 12 + i));
  const { bars, rows } = packLane(
    [
      item("trip", at(2026, 10, 10), at(2026, 10, 14), true),
      item("mon", at(2026, 10, 12), at(2026, 10, 13), true),
      item("wed-fri", at(2026, 10, 14), at(2026, 10, 17), true),
      item("thu", at(2026, 10, 15), at(2026, 10, 16), true),
      item("long", at(2026, 10, 16, 18), at(2026, 10, 20, 9)),
    ],
    days,
  );
  const by = Object.fromEntries(bars.map((b) => [b.item.key, [b.first, b.last, b.row, b.fromBefore, b.goesOn]]));
  eq("lane bars", by, {
    trip: [0, 1, 0, true, false],
    mon: [0, 0, 1, false, false],
    "wed-fri": [2, 4, 0, false, false],
    thu: [3, 3, 1, false, false],
    long: [4, 6, 1, false, true],
  });
  eq("lane rows", rows, 2);
  const fit = fitLane(bars, 7, 1);
  eq("fit one row", [fit.shown.map((b) => b.item.key), fit.hidden], [[], [2, 1, 1, 2, 2, 1, 1]]);
  const fit2 = fitLane(bars, 7, 2);
  eq("fit two rows", fit2.hidden, [0, 0, 0, 0, 0, 0, 0]);
  eq("itemDays timed to midnight", [itemDays(item("m", at(2026, 10, 12, 20), at(2026, 10, 13))).last.getDate()], [12]);
  check("inLane", inLane(item("l", at(2026, 10, 12, 9), at(2026, 10, 13, 9))) && !inLane(item("s", at(2026, 10, 12, 9), at(2026, 10, 12, 10))));
  eq("month weeks (Oct 2026, Monday)", monthWeeks(at(2026, 10, 11), 1).map((w) => ymd(w[0])), ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  eq("month weeks (Feb 2026, Sunday)", monthWeeks(at(2026, 2, 1), 0).length, 4);
}

// Changing repeating events ------------------------------------------------------------------------

{
  type Map_ = Map<string, CalEvent>;
  const apply = (map: Map_, changes: Change[]) => {
    for (const c of changes) {
      if (c.op === "insert") map.set(c.id, { ...(c.row as unknown as CalEvent), deleted_at: null });
      else if (c.op === "update") {
        const cur = map.get(c.id);
        if (cur) map.set(c.id, { ...cur, ...(c.values as Partial<CalEvent>) });
      } else {
        const cur = map.get(c.id);
        if (cur) map.set(c.id, { ...cur, deleted_at: "deleted" });
      }
    }
  };
  const state = (map: Map_) => JSON.stringify([...map.values()].filter((e) => !e.deleted_at).sort((a, b) => (a.id < b.id ? -1 : 1)));
  const range = { from: at(2026, 10, 12), to: at(2026, 11, 2) };
  const view = (map: Map_) =>
    buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], ...range }).map((i) => `${hm(i.start)}-${String(i.end.getHours()).padStart(2, "0")}:${String(i.end.getMinutes()).padStart(2, "0")} ${i.title}`);
  let n = 0;
  const newId = () => `n${++n}`;
  const fresh = (): Map_ => {
    const s = event({ id: "s", title: "Maths", start: at(2026, 10, 12, 8), end: at(2026, 10, 12, 9), recurrence: { freq: "weekly", byDay: [1, 3], count: 6 } });
    return new Map([["s", s]]);
  };
  const itemAt = (map: Map_, y: number, m: number, d: number) => buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(y, m, d), to: at(y, m, d + 1) })[0];

  eq("series before", view(fresh()), [
    "2026-10-12 08:00-09:00 Maths",
    "2026-10-14 08:00-09:00 Maths",
    "2026-10-19 08:00-09:00 Maths",
    "2026-10-21 08:00-09:00 Maths",
    "2026-10-26 08:00-09:00 Maths",
    "2026-10-28 08:00-09:00 Maths",
  ]);

  // This one only: moved to 10:00.
  let map = fresh();
  let before = state(map);
  let item = itemAt(map, 2026, 10, 19);
  let plan = planEdit(item, { span: { start: at(2026, 10, 19, 10), end: at(2026, 10, 19, 11, 30), allDay: false } }, "this", map, newId);
  apply(map, plan.changes);
  eq("this: one occurrence moved", view(map)[2], "2026-10-19 10:00-11:30 Maths");
  eq("this: others stay", view(map).length, 6);
  // Then the whole series an hour later: the moved one stays moved.
  const moved = itemAt(map, 2026, 10, 21);
  const plan2 = planEdit(moved, { span: { start: at(2026, 10, 21, 9), end: at(2026, 10, 21, 10), allDay: false }, title: "Maths!" }, "all", map, newId);
  apply(map, plan2.changes);
  eq("all: shifted, the changed copy keeps its time", view(map), [
    "2026-10-12 09:00-10:00 Maths!",
    "2026-10-14 09:00-10:00 Maths!",
    "2026-10-19 10:00-11:30 Maths!",
    "2026-10-21 09:00-10:00 Maths!",
    "2026-10-26 09:00-10:00 Maths!",
    "2026-10-28 09:00-10:00 Maths!",
  ]);
  apply(map, plan2.undo);
  apply(map, plan.undo);
  eq("undo restores", state(map), before);

  // This and following, from the 4th, moved to Tuesday/Thursday at 14:00.
  map = fresh();
  before = state(map);
  item = itemAt(map, 2026, 10, 21);
  plan = planEdit(item, { span: { start: at(2026, 10, 22, 14), end: at(2026, 10, 22, 15), allDay: false } }, "following", map, newId);
  apply(map, plan.changes);
  eq("following: cut and continued", view(map), [
    "2026-10-12 08:00-09:00 Maths",
    "2026-10-14 08:00-09:00 Maths",
    "2026-10-19 08:00-09:00 Maths",
    "2026-10-22 14:00-15:00 Maths",
    "2026-10-27 14:00-15:00 Maths",
    "2026-10-29 14:00-15:00 Maths",
  ]);
  apply(map, plan.undo);
  eq("following undo", state(map), before);

  // Delete this / following / all.
  map = fresh();
  before = state(map);
  plan = planDelete(itemAt(map, 2026, 10, 14), "this", map);
  apply(map, plan.changes);
  eq("delete this", view(map).length, 5);
  const p2 = planDelete(itemAt(map, 2026, 10, 26), "following", map);
  apply(map, p2.changes);
  eq("delete following", view(map).map((v) => v.slice(0, 10)), ["2026-10-12", "2026-10-19", "2026-10-21"]);
  apply(map, p2.undo);
  apply(map, plan.undo);
  eq("delete undo", state(map), before);
  const p3 = planDelete(itemAt(map, 2026, 10, 19), "all", map);
  apply(map, p3.changes);
  eq("delete all", view(map).length, 0);
  apply(map, p3.undo);
  eq("delete all undo", state(map), before);

  // Following from the first occurrence changes the whole series; a changed copy is deleted with it.
  map = fresh();
  apply(map, planEdit(itemAt(map, 2026, 10, 19), { title: "Moved" }, "this", map, newId).changes);
  const first = planEdit(itemAt(map, 2026, 10, 12), { title: "Algebra" }, "following", map, newId);
  apply(map, first.changes);
  eq("following from the first = all", new Set(view(map).map((v) => v.split(" ").slice(2).join(" "))), new Set(["Algebra"]));
  check("following from the first adds no series", ![...map.values()].some((e) => e.recurrence && e.id !== "s"));

  // All-day series moved by a day, with a removed occurrence that must follow.
  const bday = event({ id: "b", title: "Trip", start: at(2026, 10, 13), end: at(2026, 10, 15), all_day: true, recurrence: { freq: "weekly" } });
  map = new Map([["b", bday]]);
  apply(map, planDelete(itemAt(map, 2026, 10, 20), "this", map).changes);
  const shiftAll = planEdit(itemAt(map, 2026, 10, 13), { span: { start: at(2026, 10, 14), end: at(2026, 10, 16), allDay: true } }, "all", map, newId);
  apply(map, shiftAll.changes);
  eq(
    "all-day series shifted with its removed occurrence",
    buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(2026, 10, 12), to: at(2026, 11, 2) }).map((i) => [ymd(i.start), ymd(i.end)]),
    [["2026-10-14", "2026-10-16"], ["2026-10-28", "2026-10-30"]],
  );
  eq("scopes", [scopesFor(itemAt(fresh(), 2026, 10, 12)), scopesFor(itemAt(fresh(), 2026, 10, 12), { recurrence: null })], [["this", "following", "all"], ["following", "all"]]);
}

// Even and odd calendar weeks ------------------------------------------------------------------------

{
  eq("iso weeks", [isoWeek(at(2026, 12, 28)), isoWeek(at(2027, 1, 3)), isoWeek(at(2027, 1, 4)), isoWeek(at(2027, 1, 11)), isoWeek(at(2026, 10, 26))], [53, 53, 1, 2, 44]);
  // 2026 has 53 weeks: "every 2 weeks" would slip into the odd weeks after New Year, even weeks don't.
  const even = event({ id: "ev", start: at(2026, 12, 7, 8), end: at(2026, 12, 7, 9), recurrence: { freq: "weekly", byDay: [1], weeks: "even" } });
  eq(
    "even weeks across a 53-week year",
    occurrences(even, at(2026, 12, 1), at(2027, 2, 1)).map((o) => ymd(o.start)),
    ["2026-12-07", "2026-12-21", "2027-01-11", "2027-01-25"],
  );
  const odd = event({ id: "od", start: at(2026, 12, 1, 8), end: at(2026, 12, 1, 9), recurrence: { freq: "weekly", byDay: [2], weeks: "odd" } });
  // Week 49 is odd; weeks 53 and 1 are both odd, so it happens two weeks running there.
  eq("odd weeks", occurrences(odd, at(2026, 12, 1), at(2027, 1, 13)).map((o) => ymd(o.start)), ["2026-12-01", "2026-12-15", "2026-12-29", "2027-01-05"]);
  const late = event({ id: "l", start: at(2026, 12, 7, 8), end: at(2026, 12, 7, 9), recurrence: { freq: "weekly", byDay: [1], weeks: "odd" } });
  eq("odd weeks: a start in an even week waits for the next odd one", occurrences(late, at(2026, 12, 1), at(2026, 12, 22)).map((o) => ymd(o.start)), ["2026-12-14"]);
  eq("even weeks with a count", occurrences(event({ id: "c", start: at(2026, 10, 26, 8), end: at(2026, 10, 26, 9), recurrence: { freq: "weekly", weeks: "even", count: 3 } }), at(2026, 10, 1), at(2027, 1, 1)).length, 3);

  // Moving a fortnightly series from Friday to the next Monday puts it into the other weeks.
  const fri = event({ id: "f", start: at(2026, 10, 30, 8), end: at(2026, 10, 30, 9), recurrence: { freq: "weekly", byDay: [5], weeks: "even" } });
  const map = new Map([["f", fri]]);
  const item = buildItems({ events: [fri], tasks: [], cards: [], subjects: [], from: at(2026, 10, 30), to: at(2026, 10, 31) })[0];
  const plan = planEdit(item, { span: { start: at(2026, 11, 2, 8), end: at(2026, 11, 2, 9), allDay: false } }, "all", map, () => "x");
  const r = (plan.changes[0] as { values: Partial<CalEvent> }).values.recurrence!;
  eq("moved across a week: other weeks", [r.weeks, r.byDay], ["odd", [1]]);
}

// Importing a school timetable --------------------------------------------------------------------

{
  eq("rhythms", [rhythmOf("14-tg..", []).kind, rhythmOf("1. Quart.", [{ nr: 1, from: "2026-08-01", to: "2026-12-18" }]).kind, rhythmOf(null, []).kind], ["fortnightly", "quarter", "weekly"]);
  eq("holidays 2027", [publicHolidays(2027)["2027-03-26"], publicHolidays(2027)["2027-05-06"], publicHolidays(2027)["2027-05-17"]], ["Karfreitag", "Christi Himmelfahrt", "Pfingstmontag"]);

  const lesson = (p: Partial<Timetable["lessons"][number]>): Timetable["lessons"][number] => ({
    id: "x",
    day: 0,
    start: 480,
    end: 570,
    code: "B5T",
    name: "Mikroorganismen untersuchen",
    part: "Theorie",
    field: "LF 5",
    teachers: ["A. Teacher"],
    room: "P03",
    note: null,
    correction: null,
    rhythm: { kind: "weekly" },
    hue: 345,
    ...p,
  });
  const tt: Timetable = {
    source: "bta",
    className: "T1",
    updated: null,
    blocks: [],
    lessons: [
      lesson({ id: "mon" }),
      lesson({ id: "fri", day: 4, start: 480, end: 675, code: "B4T", name: "Pflanzen untersuchen", rhythm: { kind: "fortnightly", weeks: "even" } }),
      lesson({ id: "wed", day: 2, start: 810, end: 900, code: "EDV", name: "EDV", part: null, field: null, rhythm: { kind: "quarter", nr: 1, from: "2026-08-01", to: "2026-12-18" } }),
    ],
    quarters: [
      { nr: 1, from: "2026-08-01", to: "2026-12-18" },
      { nr: 2, from: "2026-12-19", to: "2027-07-31" },
    ],
    breaks: [
      { name: "Weihnachtsferien", from: "2026-12-21", to: "2027-01-08" },
      { name: "Sommerferien", from: "2027-07-05", to: "2027-08-06" },
    ],
    daysOff: { "2026-11-18": "Studientag" },
    exams: [
      { code: "B5T", name: "Mikroorganismen untersuchen", date: "2026-11-02", title: "Klausur Nr. 1" },
      { code: "EDV", name: "EDV", date: "2026-11-11", title: "Klausur Nr. 1" },
      { code: "B5T", name: "Mikroorganismen untersuchen", date: "2026-10-01", title: "Klausur Nr. 0" },
    ],
    year: { from: "2026-08-01", to: "2027-07-31" },
    live: true,
  };
  eq("school ends before the summer holidays", ymd(schoolEnd(tt)), "2027-07-04");

  type Map_ = Map<string, CalEvent>;
  const apply = (map: Map_, tasks: Task[], changes: Change[]) => {
    for (const c of changes) {
      if (c.table === "tasks") {
        if (c.op === "insert") tasks.push(c.row as unknown as Task);
        else if (c.op === "delete") tasks.splice(tasks.findIndex((x) => x.id === c.id), 1);
        continue;
      }
      if (c.op === "insert") map.set(c.id, { ...(c.row as unknown as CalEvent), deleted_at: null });
      else if (c.op === "update") map.set(c.id, { ...map.get(c.id)!, ...(c.values as Partial<CalEvent>) });
      else map.set(c.id, { ...map.get(c.id)!, deleted_at: "deleted" });
    }
  };
  let n = 0;
  const ctx = (map: Map_, tasks: Task[]) => ({ userId: "u", timeZone: "Europe/Berlin", events: [...map.values()], tasks, newId: () => `i${++n}` });
  const opts = { from: at(2026, 10, 26), titles: "name" as const, subjects: { B5T: { subjectId: null, color: "rose" as const } }, breaks: true, exams: true, reminder: null };
  const days = (map: Map_, title: string, from: Date, to: Date) =>
    buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from, to })
      .filter((i) => i.title === title)
      .map((i) => hm(i.start));

  const map: Map_ = new Map();
  const tasks: Task[] = [];
  const first = planImport(tt, opts, ctx(map, tasks));
  apply(map, tasks, first.plan.changes);
  eq("import counts", [first.lessons, first.breaks, first.exams, first.replaced], [3, 3, 2, 0]);
  eq(
    "weekly lesson skips the holidays",
    days(map, "Mikroorganismen untersuchen · Theorie", at(2026, 12, 7), at(2027, 1, 19)),
    ["2026-12-07 08:00", "2026-12-14 08:00", "2027-01-11 08:00", "2027-01-18 08:00"],
  );
  eq(
    "fortnightly lesson in even weeks",
    days(map, "Pflanzen untersuchen · Theorie", at(2026, 10, 26), at(2027, 2, 1)),
    ["2026-10-30 08:00", "2026-11-13 08:00", "2026-11-27 08:00", "2026-12-11 08:00", "2027-01-15 08:00", "2027-01-29 08:00"],
  );
  const edv = days(map, "EDV", at(2026, 10, 26), at(2027, 7, 1));
  eq("quarter lesson: until its quarter ends, not on a day off", [edv[0], edv[edv.length - 1], edv.includes("2026-11-18 13:30")], ["2026-10-28 13:30", "2026-12-16 13:30", false]);
  const mon = days(map, "Mikroorganismen untersuchen · Theorie", at(2026, 10, 26), at(2027, 8, 1));
  eq("last lesson before the summer", mon[mon.length - 1], "2027-06-28 08:00");
  eq("exams: future ones, at the lesson's time", tasks.map((x) => [x.title, hm(new Date(x.due_at!))]), [
    ["Mikroorganismen untersuchen: Klausur Nr. 1", "2026-11-02 08:00"],
    ["EDV: Klausur Nr. 1", "2026-11-11 13:30"],
  ]);
  check("colour chosen", [...map.values()].some((e) => e.title.startsWith("Mikro") && e.color === "rose"));

  // Changing an imported lesson "this and following" changes the weeks ahead.
  const nov9 = buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(2026, 11, 9), to: at(2026, 11, 10) }).find((i) => i.title.startsWith("Mikro"))!;
  apply(map, tasks, planEdit(nov9, { location: "P12" }, "following", new Map(map), () => `e${++n}`).changes);
  const rooms = buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(2026, 11, 2), to: at(2026, 11, 24) })
    .filter((i) => i.title.startsWith("Mikro"))
    .map((i) => i.event!.location);
  eq("following edit reaches the weeks ahead", rooms, ["P03", "P12", "P12", "P12"]);

  // Importing again from 16 November keeps the weeks before and replaces the rest (no doubles).
  // The split Monday series, Friday, Wednesday, the day off and both holidays (the cut series ends before).
  eq("imported after", importedAfter([...map.values()], tt, at(2026, 11, 16)), 6);
  const again = planImport(tt, { ...opts, from: at(2026, 11, 16) }, ctx(map, tasks));
  apply(map, tasks, again.plan.changes);
  eq("import again: exams not doubled", [again.exams, tasks.length], [0, 2]);
  eq(
    "import again: no doubles, weeks before kept",
    days(map, "Mikroorganismen untersuchen · Theorie", at(2026, 11, 2), at(2026, 11, 24)),
    ["2026-11-02 08:00", "2026-11-09 08:00", "2026-11-16 08:00", "2026-11-23 08:00"],
  );
  const rooms2 = buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(2026, 11, 2), to: at(2026, 11, 24) })
    .filter((i) => i.title.startsWith("Mikro"))
    .map((i) => i.event!.location);
  eq("import again: your change before stays, after is the school's", rooms2, ["P03", "P12", "P03", "P03"]);
  eq("one Christmas holiday", buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(2026, 12, 1), to: at(2027, 1, 31) }).filter((i) => i.title === "Weihnachtsferien").length, 1);

  // Undo takes it all back; removing takes out what's left from a day on.
  apply(map, tasks, again.plan.undo);
  eq("undo the second import", importedAfter([...map.values()], tt, at(2026, 11, 16)), 6);
  apply(map, tasks, planRemoveImport(tt, [...map.values()], at(2026, 10, 26)).changes);
  eq("removed", buildItems({ events: [...map.values()], tasks: [], cards: [], subjects: [], from: at(2026, 10, 1), to: at(2027, 8, 1) }).length, 0);
}

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
