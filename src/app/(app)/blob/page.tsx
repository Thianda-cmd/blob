import type { Metadata } from "next";
import { BlobCorner } from "@/components/blob/BlobCorner";
import { blobCornerText } from "@/i18n/messages/blobCorner";
import { getLocale } from "@/i18n/server";
import { loadBlobStats } from "@/learn/blobStats";

export async function generateMetadata(): Promise<Metadata> {
  return { title: blobCornerText[await getLocale()].title };
}

export default async function BlobPage() {
  const stats = await loadBlobStats();
  // The month on the server decides seasonal items, so both renders agree.
  return <BlobCorner stats={stats} month={new Date().getMonth() + 1} />;
}
