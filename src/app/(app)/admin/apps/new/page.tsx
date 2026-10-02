import type { Metadata } from "next";
import { NewAppView } from "@/components/admin/NewAppView";
import { adminText } from "@/i18n/messages/admin";
import { getMessages } from "@/i18n/server";
import { requireAdmin } from "@/lib/oauth/admin";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: (await getMessages(adminText)).form.newTitle, robots: { index: false } };
}

export default async function NewAppPage() {
  await requireAdmin();
  return <NewAppView />;
}
