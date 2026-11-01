import type { Metadata } from "next";
import { atlasText } from "@/i18n/messages/atlas";
import { getMessages } from "@/i18n/server";
import { AtlasHome } from "@/learn/atlas/components/AtlasHome";
import { allAtlasStats } from "@/learn/atlas/content";
import { loadLearnState } from "@/learn/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(atlasText);
  return { title: t.meta.atlas };
}

export default async function AtlasPage() {
  const { atlas, days } = await loadLearnState();
  return <AtlasHome stats={allAtlasStats()} progress={atlas} days={days} />;
}
