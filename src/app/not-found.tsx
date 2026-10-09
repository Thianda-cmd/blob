import type { Metadata } from "next";
import Link from "next/link";
import { Blob } from "@/components/blob/Blob";
import { errorsText } from "@/i18n/messages/errors";
import { getMessages } from "@/i18n/server";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(errorsText)).notFound.meta };
}

export default async function NotFound() {
  const [messages, user] = await Promise.all([getMessages(errorsText), getUser()]);
  const t = messages.notFound;
  return (
    <div className="grid min-h-dvh flex-1 place-items-center bg-paper px-6">
      <div className="flex flex-col items-center text-center">
        <Blob size={150} mood="surprised" />
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-[-0.03em] text-balance">{t.title}</h1>
        <p className="mt-1.5 max-w-[360px] text-[14px] text-ink-2">{user ? t.body : t.guestBody}</p>
        <Link href={user ? "/home" : "/"} className="mt-6 flex h-10 items-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper hover:bg-ink/88">
          {user ? t.home : t.guestHome}
        </Link>
      </div>
    </div>
  );
}
