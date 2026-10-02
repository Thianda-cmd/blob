import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { TopicView } from "@/learn/components/TopicView";
import { EMPTY_PROGRESS } from "@/learn/progress";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/learn/maths/[topic]">): Promise<Metadata> {
  const meta = findTopicMeta((await params).topic);
  const locale = await getLocale();
  const t = learnText[locale].meta;
  return { title: meta ? t.topic(resolveText(meta.title, locale)) : t.notFound };
}

export default async function TopicPage({ params }: PageProps<"/learn/maths/[topic]">) {
  const { topic } = await params;
  if (!findTopicMeta(topic)) notFound();
  const { progress, days } = await loadLearnState();
  return <TopicView slug={topic} progress={progress[topic] ?? EMPTY_PROGRESS(topic)} days={days} />;
}
