import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { frenchText } from "@/i18n/messages/french";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { FrenchPlayer } from "@/learn/french/components/FrenchPlayer";
import { courseState, unitBySlug } from "@/learn/french/course";
import { loadFrench } from "@/learn/french/server";
import { newSeed } from "@/learn/server";

function parse(slug: string, n: string) {
  const unit = unitBySlug(slug);
  const lesson = Number(n);
  return unit && Number.isInteger(lesson) && lesson >= 1 && lesson <= unit.lessons.length ? { unit, lesson } : null;
}

export async function generateMetadata({ params }: PageProps<"/study/french/[unit]/[n]">): Promise<Metadata> {
  const [{ unit, n }, locale] = await Promise.all([params, getLocale()]);
  const found = parse(unit, n);
  return { title: found ? frenchText[locale].meta.lesson(resolveText(found.unit.title, locale), found.lesson) : learnText[locale].meta.notFound };
}

export default async function FrenchLessonPage({ params }: PageProps<"/study/french/[unit]/[n]">) {
  const { unit: slug, n } = await params;
  const found = parse(slug, n);
  if (!found) notFound();
  const { lessons, days } = await loadFrench();
  const state = courseState(lessons).units.find((s) => s.unit.slug === slug)!;
  const at = state.lessons[found.lesson - 1];
  // Locked lessons are not skipped into: back to the path, where the next one waits.
  if (at === "locked") redirect("/learn/french");
  const seed = newSeed();
  return <FrenchPlayer key={seed} mode="lesson" unit={slug} lesson={found.lesson} seed={seed} days={days} doneBefore={state.done} replay={at === "done"} />;
}
