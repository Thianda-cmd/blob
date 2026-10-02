import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { learnText } from "@/i18n/messages/learn";

export type TopicProgress = {
  topic: string;
  xp: number;
  mastery: number;
  attempts: number;
  correct: number;
  best_streak: number;
  lesson_done: boolean;
  updated_at: string;
};

export type LearnDay = { day: string; xp: number };

export const DAILY_GOAL = 60;

export const EMPTY_PROGRESS = (topic: string): TopicProgress => ({
  topic,
  xp: 0,
  mastery: 0,
  attempts: 0,
  correct: 0,
  best_streak: 0,
  lesson_done: false,
  updated_at: new Date(0).toISOString(),
});

/** Local calendar day as YYYY-MM-DD (streaks follow the student's own midnight). */
export function today(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive days with XP, counting today or yesterday as the latest. */
export function streak(days: LearnDay[], now = new Date()): number {
  const set = new Set(days.filter((d) => d.xp > 0).map((d) => d.day));
  const cursor = new Date(now);
  if (!set.has(today(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (set.has(today(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Mastery stage 0–4: new, started, getting there, strong, mastered. */
export function masteryStage(m: number) {
  if (m >= 85) return 4;
  if (m >= 60) return 3;
  if (m >= 30) return 2;
  if (m > 0) return 1;
  return 0;
}

/** "Getting there" / "Wird besser"… for a mastery score. */
export function masteryLabel(m: number, locale: Locale) {
  return learnText[locale].mastery[masteryStage(m)];
}

/** Practice level that fits a mastery score. */
export const levelFor = (mastery: number): 1 | 2 | 3 => (mastery < 30 ? 1 : mastery < 65 ? 2 : 3);

/** New mastery after one answer at a level (1–3). */
export function nextMastery(m: number, correct: boolean, level: number) {
  const delta = correct ? 3 + level * 2 : -(4 - Math.min(level, 3));
  return Math.max(0, Math.min(100, m + delta));
}

export async function record(
  supabase: SupabaseClient,
  input: { topic: string; xp: number; attempts: number; correct: number; mastery: number; streak: number; lesson?: boolean },
) {
  const { error } = await supabase.rpc("learn_record", {
    p_topic: input.topic,
    p_day: today(),
    p_xp: input.xp,
    p_attempts: input.attempts,
    p_correct: input.correct,
    p_mastery: input.mastery,
    p_streak: input.streak,
    p_lesson: input.lesson ?? false,
  });
  return !error;
}
