import { createClient } from "@/lib/supabase/server";
import { isAtlasKey } from "./atlas/catalog";
import { isLevelKey, type LearnDay, type TopicProgress } from "./progress";

/** Everything the learning pages need about the signed-in student. RLS limits rows to their own. */
export async function loadLearnState() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [progressRes, daysRes] = await Promise.all([
    supabase.from("learn_progress").select("topic, xp, mastery, attempts, correct, best_streak, lesson_done, updated_at"),
    supabase.from("learn_days").select("day, xp").gte("day", since).order("day"),
  ]);
  // Topic rows, per-level rows ("<slug>@<level>") and Atlas rows ("atlas:<slug>") apart, so totals
  // never count a level twice and the Atlas never shows up as a topic.
  const progress: Record<string, TopicProgress> = {};
  const levels: Record<string, TopicProgress> = {};
  const atlas: Record<string, TopicProgress> = {};
  for (const row of (progressRes.data ?? []) as TopicProgress[]) {
    // Rows of the French course (removed) stay in the table, but count no more.
    if (row.topic.startsWith("fr:")) continue;
    if (isAtlasKey(row.topic)) atlas[row.topic.slice("atlas:".length)] = row;
    else (isLevelKey(row.topic) ? levels : progress)[row.topic] = row;
  }
  return { progress, levels, atlas, days: (daysRes.data ?? []) as LearnDay[] };
}

/** A fresh seed per visit, made on the server so the first task renders the same on both sides. */
export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
}

