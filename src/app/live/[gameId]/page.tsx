import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { HostScreen } from "@/components/quiz/host/HostScreen";
import { quizText } from "@/i18n/messages/quiz";
import { getMessages } from "@/i18n/server";
import { getUser } from "@/lib/supabase/server";
import { hostState, QuizError } from "@/quiz/server";

async function load(gameId: string) {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/live/${gameId}`)}`);
  try {
    return await hostState(user.id, gameId);
  } catch (e) {
    if (e instanceof QuizError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/live/[gameId]">): Promise<Metadata> {
  const t = await getMessages(quizText);
  return { title: { absolute: t.metaHost(t.title) }, robots: { index: false }, other: { "blob-no-offline": "1" } };
}

/** The big screen of a live game, for its host. Players join on their phones at /play. */
export default async function LivePage({ params }: PageProps<"/live/[gameId]">) {
  const { gameId } = await params;
  const view = await load(gameId);
  if (!view) notFound();
  // The address people join at: this site as the class reaches it (the preview, or blob.bojes.org).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "blob.bojes.org";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return <HostScreen initial={view} origin={`${proto}://${host}`} />;
}
