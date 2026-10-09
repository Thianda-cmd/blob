import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { frenchText } from "@/i18n/messages/french";
import { getLocale } from "@/i18n/server";
import { FrenchPlayer } from "@/learn/french/components/FrenchPlayer";
import { courseState } from "@/learn/french/course";
import { loadFrench } from "@/learn/french/server";
import { newSeed } from "@/learn/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: frenchText[await getLocale()].meta.practice };
}

/** A mixed review of everything learnt so far, weak and due words first. */
export default async function FrenchPracticePage() {
  const { lessons, days, words } = await loadFrench();
  const units = courseState(lessons)
    .units.map((s) => ({ slug: s.unit.slug, upTo: s.lessons.lastIndexOf("done") + 1 }))
    .filter((u) => u.upTo > 0);
  if (!units.length) redirect("/learn/french");
  const today = new Date().toISOString().slice(0, 10);
  const weak = words.filter((w) => w.strength <= 2 || w.due_on <= today).map((w) => w.word_id);
  const seed = newSeed();
  return <FrenchPlayer key={seed} mode="practice" units={units} weak={weak} seed={seed} days={days} />;
}
