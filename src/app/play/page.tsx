import type { Metadata } from "next";
import { PlayScreen } from "@/components/quiz/play/PlayScreen";
import { quizText } from "@/i18n/messages/quiz";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(quizText);
  return { title: { absolute: t.metaPlay }, description: t.home.intro };
}

/** Playing along in a live quiz, without an account: blob.bojes.org/play (or ?pin= from the QR code). */
export default async function PlayPage({ searchParams }: PageProps<"/play">) {
  const pin = (await searchParams).pin;
  const value = Array.isArray(pin) ? pin[0] : pin;
  return <PlayScreen initialPin={value && /^\d{6}$/.test(value) ? value : null} />;
}
