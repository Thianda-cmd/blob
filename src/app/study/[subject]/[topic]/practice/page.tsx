import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { PracticePlayer } from "@/learn/components/PracticePlayer";
import { levelProgress, parseLevel, suggestedLevel } from "@/learn/levels";
import { loadLearnState, newSeed } from "@/learn/server";

export async function generateMetadata({ params, searchParams }: PageProps<"/study/[subject]/[topic]/practice">): Promise<Metadata> {
  const [{ subject, topic }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const meta = findTopicMeta(topic);
  const t = learnText[locale].meta;
  if (meta?.subject !== subject) return { title: t.notFound };
  const title = resolveText(meta.title, locale);
  return { title: query.mode === "test" ? t.test(title) : t.practice(title) };
}

export default async function PracticePage({ params, searchParams }: PageProps<"/study/[subject]/[topic]/practice">) {
  const [{ subject, topic }, query] = await Promise.all([params, searchParams]);
  if (findTopicMeta(topic)?.subject !== subject) notFound();
  const meta = findTopicMeta(topic)!;
  const { progress, levels, days } = await loadLearnState();
  const mode = query.mode === "test" ? "test" : "practice";
  const level = parseLevel(query.level) ?? suggestedLevel(meta, progress[topic], levels);
  const seed = newSeed();
  return (
    <PracticePlayer
      key={seed}
      slug={topic}
      mode={mode}
      level={level}
      mastery={progress[topic]?.mastery ?? 0}
      levelMastery={levelProgress(topic, level, progress[topic], levels).mastery}
      days={days}
      seed={seed}
    />
  );
}
