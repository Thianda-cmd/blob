import { addDays, startOfDay } from "date-fns";
import { buildItems } from "@/calendar/items";
import { ymd } from "@/calendar/time";
import type { CalEvent, Subject, Task } from "@/lib/types";

// What the home and lock screen widgets show (Android: gen/android …/TodayWidget.kt; iPhone and
// iPad: src-tauri/ios/BlobWidget). Plain JSON they read on their own, without Blob running: the
// coming week's events and due tasks, the learning streak and the cards to review, with the words
// in the account's language. The widgets leave out what has ended themselves, so it stays right
// for a while after the app was last open.

export type WidgetItem = {
  /** Title. */
  t: string;
  /** Start and end, ms since 1970 (end exclusive). */
  s: number;
  e: number;
  /** All day. */
  a: boolean;
  /** Colour on a light and on a dark background. */
  c: string;
  cd: string;
  /** "event" (also lessons and the like), "task" (due then) or "exam". */
  k: "event" | "task" | "exam";
  /** Where tapping it leads in the app. */
  l: string;
};

export type WidgetWords = {
  today: string;
  tomorrow: string;
  nothing: string;
  allDay: string;
  due: string;
  exam: string;
  next: string;
  streak: string;
  cards: string;
  /** "+{n} more" */
  more: string;
  open: string;
};

export type WidgetData = {
  v: 1;
  /** When it was made. */
  at: number;
  locale: string;
  items: WidgetItem[];
  /** Days in a row with practice (up to today, or yesterday while today has none yet). */
  streak: number;
  practisedToday: boolean;
  /** Cards due for review today. */
  cards: number;
  w: WidgetWords;
};

/** The palette (src/app/globals.css): light and dark. */
const PALETTE: Record<string, [string, string]> = {
  "--blob": ["#6d3df5", "#8259fa"],
  "--subject-ink": ["#3d3c37", "#c9c7bf"],
  "--subject-clay": ["#c4653e", "#c4653e"],
  "--subject-moss": ["#5d8a4c", "#5d8a4c"],
  "--subject-sky": ["#3f78b3", "#3f78b3"],
  "--subject-plum": ["#8a5a9c", "#8a5a9c"],
  "--subject-sand": ["#b48e38", "#b48e38"],
  "--subject-rose": ["#c05475", "#c05475"],
  "--subject-teal": ["#3a8c87", "#3a8c87"],
};

function colours(css: string): [string, string] {
  const m = /var\((--[a-z-]+)\)/.exec(css);
  return (m && PALETTE[m[1]]) || PALETTE["--blob"];
}

export function streakOf(learnDays: { day: string; xp: number }[], now: Date): { streak: number; practisedToday: boolean } {
  const days = new Set(learnDays.filter((d) => d.xp > 0).map((d) => d.day));
  const practisedToday = days.has(ymd(now));
  let streak = 0;
  for (let d = practisedToday ? startOfDay(now) : addDays(startOfDay(now), -1); days.has(ymd(d)); d = addDays(d, -1)) streak++;
  return { streak, practisedToday };
}

const MAX_ITEMS = 24;

export function widgetData(input: {
  now: Date;
  events: CalEvent[];
  tasks: Task[];
  subjects: Subject[];
  cardsDue: Record<string, number>;
  learnDays: { day: string; xp: number }[];
  words: WidgetWords;
  locale: string;
}): WidgetData {
  const { now } = input;
  const from = startOfDay(now);
  const items = buildItems({ events: input.events, tasks: input.tasks, cards: [], subjects: input.subjects, from, to: addDays(from, 8) })
    .filter((i) => i.source !== "card" && !i.done && i.end.getTime() > now.getTime())
    // By day; on a day, all-day items first.
    .sort((a, b) => ymd(a.start).localeCompare(ymd(b.start)) || Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
    .slice(0, MAX_ITEMS)
    .map((i): WidgetItem => {
      const [c, cd] = colours(i.color);
      const series = i.occurrence?.series.id ?? i.event?.series_id ?? i.event?.id;
      return {
        t: i.title,
        s: i.start.getTime(),
        e: i.end.getTime(),
        a: i.allDay,
        c,
        cd,
        k: i.exam ? "exam" : i.source === "task" ? "task" : "event",
        l: i.source === "event" ? `/calendar?date=${ymd(i.start)}${series ? `&event=${series}` : ""}` : `/tasks`,
      };
    });
  return {
    v: 1,
    at: now.getTime(),
    locale: input.locale,
    items,
    ...streakOf(input.learnDays, now),
    cards: input.cardsDue[ymd(now)] ?? 0,
    w: input.words,
  };
}
