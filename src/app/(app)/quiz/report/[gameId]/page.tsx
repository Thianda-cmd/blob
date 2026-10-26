import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/quiz/report/ReportView";
import { quizText } from "@/i18n/messages/quiz";
import { getMessages } from "@/i18n/server";
import { getUser } from "@/lib/supabase/server";
import { report } from "@/quiz/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(quizText)).report.title };
}

/** How a live game went: everyone's points and how each question went. */
export default async function ReportPage({ params }: PageProps<"/quiz/report/[gameId]">) {
  const [{ gameId }, user] = await Promise.all([params, getUser()]);
  if (!user) notFound();
  const data = await report(user.id, gameId).catch(() => null);
  if (!data) notFound();
  return <ReportView report={data} />;
}
