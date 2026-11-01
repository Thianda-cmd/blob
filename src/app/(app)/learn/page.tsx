import type { Metadata } from "next";
import { learnText } from "@/i18n/messages/learn";
import { getMessages } from "@/i18n/server";
import { allAtlasStats } from "@/learn/atlas/content";
import { LearnHome } from "@/learn/components/LearnHome";
import { lastSubject } from "@/learn/catalog";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(learnText);
  return { title: t.meta.learn };
}

export default async function LearnPage() {
  const { progress, levels, days, atlas } = await loadLearnState();
  return <LearnHome subject={lastSubject(progress)} progress={progress} levels={levels} days={days} atlas={atlas} atlasStats={allAtlasStats()} />;
}
