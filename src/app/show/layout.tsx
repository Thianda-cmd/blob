import { ArrowRight, LogIn } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { BlobMark } from "@/components/blob/BlobMark";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { showText } from "@/i18n/messages/show";
import { getMessages } from "@/i18n/server";
import { PATH_HEADER } from "@/lib/path-header";
import { getUser } from "@/lib/supabase/server";

/** Public pages with lesson pictures: anyone can open them, signed in or not. */
export default async function ShowLayout({ children }: LayoutProps<"/show">) {
  const [user, t, head] = await Promise.all([getUser(), getMessages(showText), headers()]);
  // After signing in, back to the picture they were looking at.
  const here = head.get(PATH_HEADER);
  const login = here?.startsWith("/show") ? `/login?next=${encodeURIComponent(here)}` : "/login";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-paper">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label={t.home} className="flex items-center gap-2">
            <BlobMark size={24} />
            <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
          </Link>
          <Link href="/show" aria-label={t.gallery} className="rounded-full bg-blob-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-blob-ink hover:bg-blob-soft/70">
            {t.brand}
          </Link>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitch compact />
            {!user && (
              <Link
                href={login}
                aria-label={t.signIn}
                className="flex h-8.5 items-center gap-1.5 rounded-lg px-2 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink sm:px-3"
              >
                <LogIn className="size-4 sm:hidden" />
                <span className="hidden sm:inline">{t.signIn}</span>
              </Link>
            )}
            <Link
              href={user ? "/learn" : "/signup"}
              className="flex h-8.5 items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-3 text-[13.5px] font-medium text-paper hover:bg-ink/88 sm:px-3.5"
            >
              {user ? t.openApp : <><span className="sm:hidden">{t.startShort}</span><span className="hidden sm:inline">{t.start}</span></>}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line/60 py-6 text-center text-[12.5px] text-ink-3">
        <Link href="/show" className="hover:text-ink">
          {t.gallery}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/" className="hover:text-ink">
          Blob
        </Link>
      </footer>
    </div>
  );
}
