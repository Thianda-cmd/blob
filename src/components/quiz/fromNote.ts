"use client";

import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SETTINGS } from "@/quiz/model";
import { quizFromNote } from "@/quiz/fromNote";

/**
 * Makes a new quiz of yours from a note (yours or one shared with you): `{ id, count }`, or
 * `"empty"` when the note has nothing to ask, `"failed"` when it couldn't be read or saved.
 */
export async function makeQuizFromNote(pageId: string, userId: string): Promise<{ id: string; count: number } | "empty" | "failed"> {
  const supabase = createClient();
  const { data: page } = await supabase.from("pages").select("user_id, title, content, subject_id").eq("id", pageId).maybeSingle();
  if (!page) return "failed";
  const made = quizFromNote(page.content, page.title ?? "");
  if (!made.questions.length) return "empty";
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: userId,
      title: made.title,
      description: made.description,
      questions: made.questions,
      settings: DEFAULT_SETTINGS,
      // Someone else's subject isn't one of yours.
      subject_id: page.user_id === userId ? page.subject_id : null,
    })
    .select("id")
    .single();
  if (error || !data) return "failed";
  return { id: data.id as string, count: made.questions.length };
}
