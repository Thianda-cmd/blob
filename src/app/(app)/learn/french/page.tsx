import type { Metadata } from "next";
import { frenchText } from "@/i18n/messages/french";
import { getLocale } from "@/i18n/server";
import { FrenchHome } from "@/learn/french/components/FrenchHome";
import { loadFrench } from "@/learn/french/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: frenchText[await getLocale()].meta.course };
}

export default async function FrenchPage() {
  const { lessons, days, words } = await loadFrench();
  return <FrenchHome lessons={lessons} days={days} words={words} />;
}
