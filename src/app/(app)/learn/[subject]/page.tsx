import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { learnText } from "@/i18n/messages/learn";
import { getLocale } from "@/i18n/server";
import { resolveText } from "@/i18n/text";
import { isSubject, SUBJECTS } from "@/learn/catalog";
import { LearnHome } from "@/learn/components/LearnHome";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata({ params }: PageProps<"/learn/[subject]">): Promise<Metadata> {
  const { subject } = await params;
  const locale = await getLocale();
  const info = SUBJECTS.find((s) => s.slug === subject && s.live);
  return { title: info ? `${resolveText(info.title, locale)} · ${learnText[locale].meta.learn}` : learnText[locale].meta.notFound };
}

export default async function SubjectPage({ params }: PageProps<"/learn/[subject]">) {
  const { subject } = await params;
  if (!isSubject(subject)) notFound();
  const { progress, levels, days } = await loadLearnState();
  return <LearnHome subject={subject} progress={progress} levels={levels} days={days} />;
}
