import type { Metadata } from "next";
import { OfflineView } from "@/components/offline/OfflineView";
import { offlineText } from "@/i18n/messages/offline";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(offlineText)).page.title, robots: { index: false } };
}

/**
 * What the app shows for a page that isn't on the device while offline (public/sw.js keeps it):
 * a friendly note and everything that does open offline.
 */
export default function OfflinePage() {
  return <OfflineView />;
}
