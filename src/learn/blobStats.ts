import type { BlobStats } from "@/components/blob/wardrobe";
import { courseState } from "@/learn/french/course";
import { loadLearnState } from "@/learn/server";

/** The longest run of consecutive days with XP. */
function bestStreak(days: string[]) {
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const day of [...days].sort()) {
    const t = Date.parse(`${day}T00:00:00Z`) / 864e5;
    run = t - prev === 1 ? run + 1 : 1;
    prev = t;
    best = Math.max(best, run);
  }
  return best;
}

/** What unlocks things in Blob's wardrobe: XP, lessons, French, streaks and days. */
export async function loadBlobStats(): Promise<BlobStats> {
  const { progress, days } = await loadLearnState();
  const rows = Object.entries(progress);
  const french = Object.fromEntries(rows.filter(([key]) => key.startsWith("fr:")));
  const units = courseState(french).units;
  const finished = (u: (typeof units)[number]) => u.done === u.unit.lessons.length;
  const active = days.filter((d) => d.xp > 0).map((d) => d.day);
  return {
    xp: rows.reduce((n, [, p]) => n + (p.xp ?? 0), 0),
    lessons: rows.filter(([key, p]) => p.lesson_done && key !== "fr:practice").length,
    frenchLessons: rows.filter(([key, p]) => key.startsWith("fr:") && key !== "fr:practice" && p.lesson_done).length,
    frenchUnits: units.filter(finished).length,
    chef: units.some((u) => u.unit.slug === "manger" && finished(u)),
    bestStreak: bestStreak(active),
    activeDays: active.length,
  };
}
