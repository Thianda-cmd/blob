import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { LessonPlayer } from "@/learn/components/LessonPlayer";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/study/[subject]/[topic]/lesson">): Promise<Metadata> {
  const { subject, topic } = await params;
  const meta = findTopicMeta(topic);
  const locale = await getLocale();
  const t = learnText[locale].meta;
  return { title: meta?.subject === subject ? t.lesson(resolveText(meta.title, locale)) : t.notFound };
}

export default async function LessonPage({ params }: PageProps<"/study/[subject]/[topic]/lesson">) {
  const { subject, topic } = await params;
  if (findTopicMeta(topic)?.subject !== subject) notFound();
  const { progress, days } = await loadLearnState();
  return <LessonPlayer slug={topic} mastery={progress[topic]?.mastery ?? 0} days={days} />;
}
