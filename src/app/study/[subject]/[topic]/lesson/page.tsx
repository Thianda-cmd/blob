import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta, lessonLevels, topicHref } from "@/learn/catalog";
import { levelProgress, parseLevel } from "@/learn/levels";
import { LessonPlayer } from "@/learn/components/LessonPlayer";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/study/[subject]/[topic]/lesson">): Promise<Metadata> {
  const { subject, topic } = await params;
  const meta = findTopicMeta(topic);
  const locale = await getLocale();
  const t = learnText[locale].meta;
  return { title: meta?.subject === subject ? t.lesson(resolveText(meta.title, locale)) : t.notFound };
}

export default async function LessonPage({ params, searchParams }: PageProps<"/study/[subject]/[topic]/lesson">) {
  const [{ subject, topic }, query] = await Promise.all([params, searchParams]);
  const meta = findTopicMeta(topic);
  if (meta?.subject !== subject) notFound();
  // Without a level: the first written lesson. A level without a lesson yet: its topic page.
  const level = parseLevel(query.level) ?? lessonLevels(meta)[0];
  if (!level || !meta.levels[level].minutes) redirect(topicHref(meta, level));
  const { progress, levels, days } = await loadLearnState();
  return (
    <LessonPlayer
      key={level}
      slug={topic}
      level={level}
      mastery={progress[topic]?.mastery ?? 0}
      levelMastery={levelProgress(topic, level, progress[topic], levels).mastery}
      days={days}
    />
  );
}
