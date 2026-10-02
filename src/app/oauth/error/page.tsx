import type { Metadata } from "next";
import Link from "next/link";
import { Blob } from "@/components/blob/Blob";
import { oauthText } from "@/i18n/messages/oauth";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages(oauthText)).meta.error, robots: { index: false } };
}

/** Shown instead of redirecting when the app or its redirect address can't be trusted. */
export default async function OAuthErrorPage({ searchParams }: PageProps<"/oauth/error">) {
  const t = (await getMessages(oauthText)).error;
  const reason = (await searchParams).reason;
  const text = reason === "unknown_app" || reason === "app_disabled" || reason === "bad_redirect" ? t[reason] : t.unknown_app;
  return (
    <div className="w-full max-w-[420px] rounded-[28px] border border-line bg-raised p-8 text-center shadow-pop">
      <div className="mx-auto w-fit">
        <Blob size={110} mood="worried" interactive={false} />
      </div>
      <h1 className="mt-3 font-display text-[22px] font-bold tracking-[-0.02em] text-balance">{t.title}</h1>
      <p className="mt-2 text-[14px] text-ink-2">{text}</p>
      <p className="mt-1 text-[12.5px] text-ink-3">{t.tip}</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-xl border border-line px-4 text-[14px] font-medium hover:bg-hover">
        {t.back}
      </Link>
    </div>
  );
}
