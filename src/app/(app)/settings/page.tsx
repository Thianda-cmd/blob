import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { settingsText } from "@/i18n/messages/settings";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(settingsText)).title };
}

export default function SettingsPage() {
  return <SettingsView />;
}
