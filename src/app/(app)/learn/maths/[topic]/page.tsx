import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTopicMeta } from "@/learn/catalog";
import { TopicView } from "@/learn/components/TopicView";
import { EMPTY_PROGRESS } from "@/learn/progress";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/learn/maths/[topic]">): Promise<Metadata> {
  const meta = findTopicMeta((await params).topic);
  return { title: meta ? `${meta.title} · Maths` : "Not found" };
}

export default async function TopicPage({ params }: PageProps<"/learn/maths/[topic]">) {
  const { topic } = await params;
  if (!findTopicMeta(topic)) notFound();
  const { progress, days } = await loadLearnState();
  return <TopicView slug={topic} progress={progress[topic] ?? EMPTY_PROGRESS(topic)} days={days} />;
}
