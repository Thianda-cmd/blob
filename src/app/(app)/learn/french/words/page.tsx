import type { Metadata } from "next";
import { frenchText } from "@/i18n/messages/french";
import { getLocale } from "@/i18n/server";
import { WordList } from "@/learn/french/components/WordList";
import { loadFrench } from "@/learn/french/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: frenchText[await getLocale()].meta.words };
}

export default async function FrenchWordsPage() {
  const { words } = await loadFrench();
  return <WordList words={words} />;
}
