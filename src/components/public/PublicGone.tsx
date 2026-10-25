import Link from "next/link";
import { Blob } from "@/components/blob/Blob";
import { publicText } from "@/i18n/messages/public";
import { getMessages } from "@/i18n/server";

/**
 * What a public link shows when it opens nothing (any more): made private, deleted, or not copied
 * whole. Drawn by the page itself rather than through notFound(), which without a loading boundary
 * would leave the whole page to the browser (an empty server page, no theme before first paint).
 */
export async function PublicGone() {
  const t = (await getMessages(publicText)).gone;
  return (
    <div className="grid min-h-dvh flex-1 place-items-center bg-paper px-6">
      <div className="flex max-w-[400px] flex-col items-center text-center">
        <Blob size={140} mood="worried" />
        <h1 className="mt-2 font-display text-[26px] font-bold tracking-[-0.03em] text-balance">{t.title}</h1>
        <p className="mt-1.5 text-[14px] text-ink-2">{t.text}</p>
        <Link href="/" className="mt-6 flex h-10 items-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper hover:bg-ink/88">
          {t.home}
        </Link>
      </div>
    </div>
  );
}
