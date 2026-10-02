import type { Metadata } from "next";
import { AdminHome } from "@/components/admin/AdminHome";
import { adminText } from "@/i18n/messages/admin";
import { getMessages } from "@/i18n/server";
import { requireAdmin } from "@/lib/oauth/admin";
import { adminOverview } from "@/lib/oauth/admin-data";
import { endpoints, issuer } from "@/lib/oauth/config";
import { keyList } from "@/lib/oauth/keys";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: (await getMessages(adminText)).title, robots: { index: false } };
}

export default async function AdminPage() {
  await requireAdmin();
  const [{ apps, stats, people }, keys] = await Promise.all([adminOverview(), keyList()]);
  return <AdminHome apps={apps} stats={stats} people={people} keys={keys} jwksUrl={endpoints(issuer()).jwks_uri} />;
}
