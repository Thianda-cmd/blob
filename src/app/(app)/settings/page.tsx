import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { settingsText } from "@/i18n/messages/settings";
import { getMessages } from "@/i18n/server";
import { connectedApps } from "@/lib/oauth/connected";
import { sessionUser } from "@/lib/oauth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(settingsText)).title };
}

export default async function SettingsPage() {
  // The (app) layout already sent signed-out people to /login.
  const user = await sessionUser();
  return <SettingsView connectedApps={user ? await connectedApps(user.id) : []} />;
}
