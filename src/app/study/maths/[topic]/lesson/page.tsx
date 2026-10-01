import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTopicMeta } from "@/learn/catalog";
import { LessonPlayer } from "@/learn/components/LessonPlayer";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/study/maths/[topic]/lesson">): Promise<Metadata> {
  const meta = findTopicMeta((await params).topic);
  return { title: meta ? `Lesson: ${meta.title}` : "Not found" };
}

export default async function LessonPage({ params }: PageProps<"/study/maths/[topic]/lesson">) {
  const { topic } = await params;
  if (!findTopicMeta(topic)) notFound();
  const { progress, days } = await loadLearnState();
  return <LessonPlayer slug={topic} mastery={progress[topic]?.mastery ?? 0} days={days} />;
}
