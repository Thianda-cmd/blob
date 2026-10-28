"use client";

import { format } from "date-fns";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { publicText } from "@/i18n/messages/public";
import { publicHref, type PublicView } from "@/lib/publicLink";
import { cn, pageTitle } from "@/lib/utils";
import { PageGlyph, PublicPagesProvider } from "./context";
import { PublicCv } from "./PublicCv";
import { PublicDeck } from "./PublicDeck";
import { PublicInk } from "./PublicInk";
import { PublicNote } from "./PublicNote";

const never = () => () => {};

// A CV's A4 page is 794px wide at full size: its column (with the side padding) fits it exactly.
const WIDTH = { note: "max-w-[760px]", folder: "max-w-[760px]", cv: "max-w-[842px]", deck: "max-w-[1100px]", ink: "max-w-[860px]" } as const;

/**
 * A page opened through its public link: Blob's bar with "Try Blob", where the page sits under the
 * link's page, its title and content (a note, presentation or CV, read-only), the pages inside it,
 * and a word about Blob at the end. Nothing here needs an account.
 */
export function PublicPage({ token, view }: { token: string; view: PublicView }) {
  const t = useMessages(publicText).view;
  const locale = useLocale();
  // The content is drawn in the browser (editor blocks, measured CV pages, slides).
  const browser = useSyncExternalStore(never, () => true, () => false);
  const page = view.page;
  const pages = useMemo(() => new Map([...view.trail, ...view.children, ...view.linked].map((p) => [p.id, p])), [view]);
  const title = pageTitle(page.title, page.kind, locale);
  const updated = format(new Date(page.updated_at), t.dateFormat, { locale: dateLocale(locale) });

  return (
    <PublicPagesProvider value={{ token, root: view.root, pages }}>
      <div className="flex min-h-dvh flex-col bg-paper">
        <header className="safe-top sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="flex h-9 shrink-0 items-center gap-2 rounded-lg">
              <BlobMark size={24} />
              <span className="font-display text-[17px] font-bold tracking-[-0.03em]">Blob</span>
              <span className="ml-1 hidden rounded-full bg-hover px-2 py-0.5 text-[11.5px] font-medium text-ink-3 sm:inline">{t.shared}</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitch compact />
              <Link
                href="/signup"
                className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[13.5px] font-medium text-paper transition-colors hover:bg-ink/88"
              >
                {t.try}
              </Link>
            </div>
          </div>
        </header>

        <main className={cn("mx-auto w-full flex-1 px-4 pb-16 pt-7 sm:px-6 sm:pt-10", WIDTH[page.kind])}>
          {view.trail.length > 0 && (
            <nav aria-label={t.inside} className="mb-5 flex flex-wrap items-center gap-1 text-[13px] text-ink-3">
              {view.trail.map((p) => (
                <span key={p.id} className="flex min-w-0 items-center gap-1">
                  <Link href={publicHref(token, p.id, view.root)} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-hover hover:text-ink">
                    <PageGlyph page={p} className="size-3.5" />
                    <span className="max-w-[220px] truncate">{pageTitle(p.title, p.kind, locale)}</span>
                  </Link>
                  <ChevronRight className="size-3.5 shrink-0 text-ink-3/70" />
                </span>
              ))}
            </nav>
          )}

          <div className="flex items-start gap-3">
            {page.icon && <span className="mt-1 text-[34px] leading-none sm:text-[40px]">{page.icon}</span>}
            <h1 className="min-w-0 break-words font-display text-[32px] font-bold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[40px]">{title}</h1>
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-3">{t.updated(updated)}</p>

          <div className="mt-8">
            {browser &&
              (page.kind === "note" ? (
                <PublicNote pageId={page.id} content={page.content} />
              ) : page.kind === "deck" ? (
                <PublicDeck content={page.content} />
              ) : page.kind === "cv" ? (
                <PublicCv content={page.content} />
              ) : page.kind === "ink" ? (
                <PublicInk token={token} pageId={page.id} />
              ) : view.children.length === 0 ? (
                <p className="text-[14px] text-ink-3">{t.empty}</p>
              ) : null)}
          </div>

          {view.children.length > 0 && (
            <section className="mt-12" aria-labelledby="public-inside">
              <h2 id="public-inside" className="mb-2.5 text-[13px] font-semibold text-ink-2">
                {t.inside}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {view.children.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={publicHref(token, p.id, view.root)}
                      className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[14px] font-medium text-ink shadow-card transition-colors hover:border-line-2 hover:bg-hover/50"
                    >
                      <PageGlyph page={p} />
                      <span className="min-w-0 flex-1 truncate">{pageTitle(p.title, p.kind, locale)}</span>
                      <ChevronRight className="size-4 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        <footer className="safe-bottom border-t border-line bg-surface">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
            <span className="flex items-center gap-2 text-[13px] text-ink-2">
              <BlobMark size={20} /> {t.madeWith}
            </span>
            <Link href="/signup" className="flex items-center gap-1 text-[13px] font-medium text-blob-ink hover:underline">
              {t.tryLong} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </footer>
      </div>
    </PublicPagesProvider>
  );
}
