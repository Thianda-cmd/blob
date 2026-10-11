import type { Metadata } from "next";
import { OfflineNote } from "@/components/offline/OfflineNote";
import { offlineText } from "@/i18n/messages/offline";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(offlineText)).page.noteTitle, robots: { index: false } };
}

/** A note opened from this device's copy (the app sends notes here when there is no connection). */
export default function OfflineNotePage() {
  return <OfflineNote />;
}
