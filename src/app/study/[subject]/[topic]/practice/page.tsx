import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { PracticePlayer } from "@/learn/components/PracticePlayer";
import { loadLearnState, newSeed } from "@/learn/server";
import type { Level } from "@/learn/types";

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
  const { progress, days } = await loadLearnState();
  const mode = query.mode === "test" ? "test" : "practice";
  const requested = Number(query.level);
  const level = requested === 1 || requested === 2 || requested === 3 ? (requested as Level) : undefined;
  const seed = newSeed();
  return <PracticePlayer key={seed} slug={topic} mode={mode} level={level} mastery={progress[topic]?.mastery ?? 0} days={days} seed={seed} />;
}
