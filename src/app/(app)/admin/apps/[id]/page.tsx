import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppView } from "@/components/admin/AppView";
import { adminText } from "@/i18n/messages/admin";
import { getMessages } from "@/i18n/server";
import { requireAdmin } from "@/lib/oauth/admin";
import { adminAppDetail } from "@/lib/oauth/admin-data";
import { APP_TABS } from "@/lib/oauth/admin-types";
import { dataEndpoint, endpoints, issuer } from "@/lib/oauth/config";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/admin/apps/[id]">): Promise<Metadata> {
  await requireAdmin();
  const { id } = await params;
  const { data } = UUID.test(id) ? await createAdminClient().from("oauth_apps").select("name").eq("id", id).maybeSingle() : { data: null };
  const t = await getMessages(adminText);
  return { title: data ? `${data.name} · ${t.title}` : t.title, robots: { index: false } };
}

export default async function AdminAppPage({ params, searchParams }: PageProps<"/admin/apps/[id]">) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const detail = await adminAppDetail(id);
  if (!detail) notFound();
  const tab = APP_TABS.find((t) => t === query.tab) ?? "overview";
  const iss = issuer();
  // The app-data API only matters to apps allowed the "data" scope.
  const urls: Record<string, string> = { ...endpoints(iss), ...(detail.app.scopes.includes("data") ? { blob_data_endpoint: dataEndpoint(iss) } : {}) };
  return <AppView {...detail} issuer={iss} endpoints={urls} initialTab={tab} />;
}
