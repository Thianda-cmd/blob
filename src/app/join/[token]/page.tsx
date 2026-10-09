import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinView, type InvitePreview } from "@/components/share/JoinView";
import { shareText } from "@/i18n/messages/share";
import { getMessages } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(shareText)).join.metaTitle, robots: { index: false } };
}

/**
 * /join/<token>: an invite link. Shows what it opens, from whom and with which role, then joins.
 * Outside the app shell on purpose: someone who just made an account joins before onboarding.
 */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  const valid = /^[A-Za-z0-9_-]{16,128}$/.test(token);
  const supabase = await createClient();
  const [preview, profile] = await Promise.all([
    valid ? supabase.rpc("invite_preview", { p_token: token }) : Promise.resolve({ data: { ok: false, reason: "unknown" } }),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  return (
    <JoinView
      token={token}
      preview={(preview.data as InvitePreview | null) ?? { ok: false, reason: "unknown" }}
      me={profile.data?.full_name?.trim() || user.email || ""}
    />
  );
}
