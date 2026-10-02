import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta, SUBJECTS } from "@/learn/catalog";
import { TopicView } from "@/learn/components/TopicView";
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

export default async function TopicPage({ params }: PageProps<"/learn/[subject]/[topic]">) {
  const { subject, topic } = await params;
  if (findTopicMeta(topic)?.subject !== subject) notFound();
  const { progress, days } = await loadLearnState();
  return <TopicView slug={topic} progress={progress[topic] ?? EMPTY_PROGRESS(topic)} days={days} />;
}
