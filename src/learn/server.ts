import { createClient } from "@/lib/supabase/server";
import { isLevelKey, type LearnDay, type TopicProgress } from "./progress";

/** Everything the learning pages need about the signed-in student. RLS limits rows to their own. */
export async function loadLearnState() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [progressRes, daysRes] = await Promise.all([
    supabase.from("learn_progress").select("topic, xp, mastery, attempts, correct, best_streak, lesson_done, updated_at"),
    supabase.from("learn_days").select("day, xp").gte("day", since).order("day"),
  ]);
  // Topic rows and per-level rows ("<slug>@<level>") apart, so totals never count a level twice.
  const progress: Record<string, TopicProgress> = {};
  const levels: Record<string, TopicProgress> = {};
  for (const row of (progressRes.data ?? []) as TopicProgress[]) (isLevelKey(row.topic) ? levels : progress)[row.topic] = row;
  return { progress, levels, days: (daysRes.data ?? []) as LearnDay[] };
}

/** A fresh seed per visit, made on the server so the first task renders the same on both sides. */
export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
}

