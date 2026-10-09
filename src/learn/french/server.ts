import { createClient } from "@/lib/supabase/server";
import { loadLearnState } from "@/learn/server";
import type { TopicProgress } from "@/learn/progress";

/** A word's strength for the signed-in student (lang_words, migration 0014). */
export type WordRow = { word_id: string; strength: number; due_on: string; seen: number; wrong: number };

/** Everything the French pages need: lesson progress, learning days (streak, XP) and word strengths. */
export async function loadFrench() {
  const supabase = await createClient();
  const [{ progress, days }, words] = await Promise.all([
    loadLearnState(),
    supabase.from("lang_words").select("word_id, strength, due_on, seen, wrong").eq("course", "fr"),
  ]);
  const lessons: Record<string, Pick<TopicProgress, "lesson_done" | "xp" | "mastery">> = {};
  for (const [key, p] of Object.entries(progress)) if (key.startsWith("fr:")) lessons[key] = { lesson_done: p.lesson_done, xp: p.xp, mastery: p.mastery };
  return { lessons, days, words: (words.data ?? []) as WordRow[] };
}
