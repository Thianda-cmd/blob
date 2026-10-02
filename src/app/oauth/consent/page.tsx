import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsentCard, RequestGone } from "@/components/oauth/ConsentCard";
import { oauthText } from "@/i18n/messages/oauth";
import { getMessages } from "@/i18n/server";
import { loadRequest, needsConsent, requestView } from "@/lib/oauth/authorize";
import { sessionUser } from "@/lib/oauth/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ searchParams }: PageProps<"/oauth/consent">): Promise<Metadata> {
  const t = await getMessages(oauthText);
  const id = (await searchParams).request;
  const pending = await loadRequest(typeof id === "string" ? id : null);
  return { title: pending ? t.meta.consent(pending.app.name) : t.meta.error, robots: { index: false } };
}

export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const raw = (await searchParams).request;
  const id = typeof raw === "string" ? raw : null;
  const pending = await loadRequest(id);
  if (!pending || pending.expired) return <RequestGone kind="expired" />;
  if (pending.completed) return <RequestGone kind="done" />;

  const user = await sessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/continue?request=${pending.id}`)}`);

  const supabase = await createClient();
  const [{ data: profile }, ask] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    needsConsent(pending.app, user.id, pending.scopes),
  ]);
  const account = {
    name: profile?.full_name?.trim() || user.email?.split("@")[0] || "",
    email: user.email ?? "",
    avatar: profile?.avatar_url ?? null,
  };
  // Here for prompt=select_account or login (e.g. after signing out of the app) with everything
  // already allowed: only confirm the account, no permissions to read through again.
  return <ConsentCard request={requestView(pending)} account={account} confirmOnly={!pending.forceConsent && !ask} />;
}
