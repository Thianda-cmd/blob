import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizEditor } from "@/components/quiz/editor/QuizEditor";
import { quizText } from "@/i18n/messages/quiz";
import { getMessages } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { normalizeQuiz, QUIZ_COLUMNS } from "@/quiz/model";
import { gamesOf } from "@/quiz/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("quizzes").select(QUIZ_COLUMNS).eq("id", id).is("trashed_at", null).maybeSingle();
  return data ? normalizeQuiz(data as Record<string, unknown>) : null;
}

export async function generateMetadata({ params }: PageProps<"/quiz/[id]">): Promise<Metadata> {
  const [quiz, t] = await Promise.all([params.then((p) => load(p.id)), getMessages(quizText)]);
  return { title: quiz?.title.trim() || t.untitled };
}

export default async function QuizEditorPage({ params }: PageProps<"/quiz/[id]">) {
  const { id } = await params;
  const [quiz, user] = await Promise.all([load(id), getUser()]);
  if (!quiz || !user) notFound();
  const games = await gamesOf(user.id, quiz.id).catch(() => []);
  return <QuizEditor initial={quiz} games={games} />;
}
