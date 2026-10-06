import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta, SUBJECTS } from "@/learn/catalog";
import { TopicView } from "@/learn/components/TopicView";
import { parseLevel } from "@/learn/levels";
import { EMPTY_PROGRESS } from "@/learn/progress";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/learn/[subject]/[topic]">): Promise<Metadata> {
  const { subject, topic } = await params;
  const meta = findTopicMeta(topic);
  const locale = await getLocale();
  const t = learnText[locale].meta;
  const info = SUBJECTS.find((s) => s.slug === subject);
  if (!meta || !info || meta.subject !== subject) return { title: t.notFound };
  return { title: t.topic(resolveText(meta.title, locale), resolveText(info.title, locale)) };
}

export default async function TopicPage({ params, searchParams }: PageProps<"/learn/[subject]/[topic]">) {
  const [{ subject, topic }, query] = await Promise.all([params, searchParams]);
  if (findTopicMeta(topic)?.subject !== subject) notFound();
  const { progress, levels, days } = await loadLearnState();
  return (
    <TopicView
      // A new level from the address (back from a lesson) starts the view fresh.
      key={String(query.level ?? "")}
      slug={topic}
      progress={progress[topic] ?? EMPTY_PROGRESS(topic)}
      levels={levels}
      days={days}
      initialLevel={parseLevel(query.level)}
    />
  );
}
