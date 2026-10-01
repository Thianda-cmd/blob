import type { Metadata } from "next";
import { LearnHome } from "@/learn/components/LearnHome";
import { loadLearnState } from "@/learn/server";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const { progress, days } = await loadLearnState();
  return <LearnHome progress={progress} days={days} />;
}
