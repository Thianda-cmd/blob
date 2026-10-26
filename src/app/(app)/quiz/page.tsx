import type { Metadata } from "next";
import { QuizHome } from "@/components/quiz/home/QuizHome";
import { quizText } from "@/i18n/messages/quiz";
import { getMessages } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeQuiz, QUIZ_COLUMNS } from "@/quiz/model";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(quizText)).title };
}

export default async function QuizPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("quizzes").select(QUIZ_COLUMNS).is("trashed_at", null).order("updated_at", { ascending: false }).limit(200);
  return <QuizHome initial={(data ?? []).map((row) => normalizeQuiz(row as Record<string, unknown>))} />;
}
