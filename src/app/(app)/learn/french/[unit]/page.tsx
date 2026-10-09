import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { frenchText } from "@/i18n/messages/french";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { UnitGuide } from "@/learn/french/components/UnitGuide";
import { courseState, unitBySlug } from "@/learn/french/course";
import { loadFrench } from "@/learn/french/server";

export async function generateMetadata({ params }: PageProps<"/learn/french/[unit]">): Promise<Metadata> {
  const [{ unit: slug }, locale] = await Promise.all([params, getLocale()]);
  const unit = unitBySlug(slug);
  return { title: unit ? frenchText[locale].meta.guide(resolveText(unit.title, locale)) : learnText[locale].meta.notFound };
}

export default async function UnitGuidePage({ params }: PageProps<"/learn/french/[unit]">) {
  const { unit: slug } = await params;
  const unit = unitBySlug(slug);
  if (!unit) notFound();
  const { lessons } = await loadFrench();
  const state = courseState(lessons).units.find((s) => s.unit.slug === slug)!;
  // Start where the student is in this unit; a finished unit starts again at lesson 1, a locked one not at all.
  const at = state.lessons.findIndex((l) => l === "current" || l === "open");
  const startHref = !state.unlocked ? null : `/study/french/${slug}/${at >= 0 ? at + 1 : 1}`;
  return <UnitGuide unit={unit} startHref={startHref} />;
}
