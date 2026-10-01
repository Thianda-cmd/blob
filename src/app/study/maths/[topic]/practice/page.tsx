import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTopicMeta } from "@/learn/catalog";
import { PracticePlayer } from "@/learn/components/PracticePlayer";
import { loadLearnState, newSeed } from "@/learn/server";
import type { Level } from "@/learn/types";

export async function generateMetadata({ params, searchParams }: PageProps<"/study/maths/[topic]/practice">): Promise<Metadata> {
  const [{ topic }, query] = await Promise.all([params, searchParams]);
  const meta = findTopicMeta(topic);
  if (!meta) return { title: "Not found" };
  return { title: `${query.mode === "test" ? "Test" : "Practice"}: ${meta.title}` };
}

export default async function PracticePage({ params, searchParams }: PageProps<"/study/maths/[topic]/practice">) {
  const [{ topic }, query] = await Promise.all([params, searchParams]);
  if (!findTopicMeta(topic)) notFound();
  const { progress, days } = await loadLearnState();
  const mode = query.mode === "test" ? "test" : "practice";
  const requested = Number(query.level);
  const level = requested === 1 || requested === 2 || requested === 3 ? (requested as Level) : undefined;
  const seed = newSeed();
  return <PracticePlayer key={seed} slug={topic} mode={mode} level={level} mastery={progress[topic]?.mastery ?? 0} days={days} seed={seed} />;
}
