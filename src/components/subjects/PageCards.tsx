"use client";

import { formatDistanceStrict } from "date-fns";
import { CornerDownRight, Folder, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FONTS, miniBackdrop, presetSpec, specPalette } from "@/components/deck/deck";
import { deckFontVars } from "@/components/deck/fonts";
import { InkThumb } from "@/components/ink/InkThumb";
import { SheetThumb } from "@/components/sheet/SheetThumb";
import { KIND_LOOK, type NewKind } from "@/components/shell/NewPageMenu";
import { PageIcon } from "@/components/shell/Sidebar";
import { addTile, card, cardLift, midTone } from "@/components/ui/surfaces";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { newPageText } from "@/i18n/messages/newPage";
import { notesText } from "@/i18n/messages/notes";
import type { InkPreview } from "@/ink/model";
import type { SheetPreview } from "@/sheet/doc";
import type { DeckThemeSpec, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

// The page cards of Start, Notizen, folders and subjects: one layout for every kind. A picture at
// 16:10 (a note's first lines, a spreadsheet's first cells, a presentation's first slide, a
// handwritten page, a folder's pages), the title under it and one line of meta. Cards of different
// kinds are the same height, so a row of them lines up.

export type PagePreview = {
  /** First bit of the note's text. */
  snippet: string;
  /** Title of the first slide (presentations). */
  slideTitle: string | null;
  /** The deck's theme (a preset's spec or its custom theme), resolved on the server. */
  theme: DeckThemeSpec | null;
  /** Handwritten notes: their first sheet, small. */
  ink?: InkPreview | null;
  /** Spreadsheets: the first rows of their first sheet and their first chart, small. */
  sheet?: SheetPreview | null;
};

/** What is inside a folder: how many pages and the titles of the first few. */
export type FolderInside = { count: number; titles: string[] };

/** "Bearbeitet vor 2 Tagen" (on the server, which doesn't know the student's clock, a space that keeps the line's height). */
export function editedLabel(updatedAt: string, now: number | null, locale: Locale) {
  if (!now) return "\u00a0";
  const t = notesText[locale];
  const d = new Date(updatedAt);
  if (now - d.getTime() < 60_000) return t.editedJustNow;
  return t.edited(formatDistanceStrict(d, now, { addSuffix: true, locale: dateLocale(locale) }));
}

/** A page card: raised on the paper, lifting a little on hover, filling its grid cell's height. */
export const pageCardClass = cn(card, cardLift, "group relative flex h-full min-w-0 flex-col p-2");

/** The picture on a card: 16:10 for every kind. */
export function PageThumb({
  page,
  preview,
  title,
  inside,
  className,
}: {
  page: PageMeta;
  preview?: PagePreview;
  /** The page's title (a presentation without slides shows it on its slide). */
  title: string;
  inside?: FolderInside;
  className?: string;
}) {
  let body: ReactNode;
  if (page.kind === "sheet") body = <SheetThumb preview={preview?.sheet} />;
  else if (page.kind === "ink") body = <InkThumb preview={preview?.ink} crop={0.5} className="h-full" />;
  else if (page.kind === "deck") body = <SlideThumb title={preview?.slideTitle?.trim() || title} theme={preview?.theme ?? null} fill />;
  else if (page.kind === "folder") body = <FolderPeek icon={page.icon} inside={inside} />;
  else body = <NotePeek snippet={preview?.snippet} />;
  return (
    <div className={cn("relative aspect-[16/10] shrink-0 overflow-hidden rounded-lg bg-surface", className)}>
      {body}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />
    </div>
  );
}

/** A note's first lines, like the top of a page (they fade out at the bottom). */
function NotePeek({ snippet }: { snippet?: string }) {
  const t = useMessages(notesText);
  const text = snippet?.trim();
  if (!text) return <span className={cn("grid h-full place-items-center px-3 text-center text-[12px] italic", midTone)}>{t.emptyNote}</span>;
  return (
    <p className="h-full overflow-hidden break-words px-3 py-2.5 text-[11.5px] leading-[1.55] text-ink-2 [mask-image:linear-gradient(to_bottom,black_62%,transparent)]">
      {text}
    </p>
  );
}

/** A folder: its tile and the titles of the pages in it. */
function FolderPeek({ icon, inside }: { icon: string | null; inside?: FolderInside }) {
  const t = useMessages(notesText);
  const look = KIND_LOOK.folder;
  return (
    <div className="flex h-full flex-col gap-2 px-3 py-2.5">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4" style={{ background: look.bg, color: look.fg }}>
        {icon ? <span className="text-[16px] leading-none">{icon}</span> : <Folder strokeWidth={1.9} />}
      </span>
      {inside?.titles.length ? (
        <span className="flex min-h-0 flex-col gap-1 overflow-hidden">
          {inside.titles.slice(0, 3).map((c, i) => (
            <span key={i} className={cn("truncate border-l-2 border-line pl-2 text-[11.5px] leading-snug text-ink-2", i === 2 && "max-sm:hidden")}>
              {c}
            </span>
          ))}
        </span>
      ) : (
        <span className={cn("text-[11.5px] italic", midTone)}>{t.emptyFolder}</span>
      )}
    </div>
  );
}

/** A card's title line: the page's icon and title. */
export function CardTitle({ page, title, className }: { page: Pick<PageMeta, "icon" | "kind">; title: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2 px-1.5 pt-2.5", className)}>
      <PageIcon page={page} className="size-3.5" />
      <span className="truncate text-[13.5px] font-medium leading-snug text-ink max-sm:text-[13px]" title={title}>
        {title}
      </span>
    </span>
  );
}

/** A card's meta line (when it was edited, where it lives). */
export function CardMeta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex min-w-0 items-center gap-1.5 px-1.5 pb-0.5 pt-1 text-[11.5px] leading-snug", midTone, className)}>{children}</span>;
}

function Edited({ page, now, className }: { page: PageMeta; now: number | null; className?: string }) {
  const locale = useLocale();
  return (
    <span className={cn("truncate", className)} suppressHydrationWarning>
      {editedLabel(page.updated_at, now, locale)}
    </span>
  );
}

/** A note: its first lines; the page it sits in, if any. */
export function NoteCard({ page, preview, parent, now }: { page: PageMeta; preview?: PagePreview; parent?: PageMeta; now: number | null }) {
  const locale = useLocale();
  const title = pageTitle(page.title, page.kind, locale);
  return (
    <Link href={`/p/${page.id}`} className={pageCardClass}>
      <PageThumb page={page} preview={preview} title={title} />
      <CardTitle page={page} title={title} />
      <CardMeta>
        {parent && (
          <span className="flex min-w-0 items-center gap-1 overflow-hidden" title={pageTitle(parent.title, parent.kind, locale)}>
            <CornerDownRight className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{pageTitle(parent.title, parent.kind, locale)}</span>
          </span>
        )}
        <Edited page={page} now={now} className={cn(parent && "ml-auto shrink-0")} />
      </CardMeta>
    </Link>
  );
}

/** A tiny rendering of the first slide, in the deck's theme: 16:9, or filling its box (`fill`, on cards). */
export function SlideThumb({ title, theme, className, fill }: { title: string; theme: DeckThemeSpec | null; className?: string; fill?: boolean }) {
  const spec = theme ?? presetSpec("paper");
  const p = specPalette(spec);
  const h = FONTS[p.heading];
  return (
    <div
      className={cn("relative overflow-hidden", fill ? "h-full w-full" : "aspect-video rounded-lg ring-1 ring-inset ring-black/[0.06]", deckFontVars, className)}
      style={{ backgroundColor: p.bg, ...miniBackdrop(spec), color: p.fg }}
    >
      <div className="absolute inset-0 flex flex-col justify-center px-[9%]">
        <span className="h-[3px] w-5 rounded-full" style={{ background: p.accent }} />
        <span
          className="mt-2 line-clamp-2 text-[16px] leading-[1.15] max-sm:text-[14px]"
          style={{ fontFamily: h.family, fontWeight: h.weights[2], letterSpacing: `${-0.02 * h.track}em`, color: p.title }}
        >
          {title}
        </span>
        <span className="mt-2 h-[5px] w-[46%] rounded-full bg-current opacity-15" />
      </div>
      <span className="absolute bottom-[7%] right-[6%] text-[8px] font-medium tabular-nums opacity-40">1</span>
    </div>
  );
}

/** A presentation: its first slide. */
export function DeckCard({ page, preview, now }: { page: PageMeta; preview?: PagePreview; now: number | null }) {
  return <PlainCard page={page} preview={preview} now={now} />;
}

/** A handwritten note: the top of its first page. */
export function InkCard({ page, preview, now }: { page: PageMeta; preview?: PagePreview; now: number | null }) {
  return <PlainCard page={page} preview={preview} now={now} />;
}

/** A spreadsheet: the top of its first sheet (and its first chart), like a little screenshot. */
export function SheetCard({ page, preview, now }: { page: PageMeta; preview?: PagePreview; now: number | null }) {
  return <PlainCard page={page} preview={preview} now={now} />;
}

function PlainCard({ page, preview, now }: { page: PageMeta; preview?: PagePreview; now: number | null }) {
  const locale = useLocale();
  const title = pageTitle(page.title, page.kind, locale);
  return (
    <Link href={`/p/${page.id}`} className={pageCardClass}>
      <PageThumb page={page} preview={preview} title={title} />
      <CardTitle page={page} title={title} />
      <CardMeta>
        <Edited page={page} now={now} />
      </CardMeta>
    </Link>
  );
}

/**
 * A folder: the titles of its first pages, and how many there are. An empty one says so in its
 * picture; its meta line then says when it was last changed, like the other cards.
 */
export function FolderCard({ page, inside, now }: { page: PageMeta; inside: FolderInside; now: number | null }) {
  const locale = useLocale();
  const t = useMessages(notesText);
  const title = pageTitle(page.title, page.kind, locale);
  return (
    <Link href={`/p/${page.id}`} className={pageCardClass}>
      <PageThumb page={page} title={title} inside={inside} />
      <CardTitle page={page} title={title} />
      <CardMeta>{inside.count ? <span className="truncate">{t.pagesInside(inside.count)}</span> : <Edited page={page} now={now} />}</CardMeta>
    </Link>
  );
}

/** The card for any page but a CV (those have their own, RecentCvCard). */
export function PageCard({ page, preview, parent, inside, now }: { page: PageMeta; preview?: PagePreview; parent?: PageMeta; inside?: FolderInside; now: number | null }) {
  if (page.kind === "folder") return <FolderCard page={page} inside={inside ?? { count: 0, titles: [] }} now={now} />;
  if (page.kind === "note") return <NoteCard page={page} preview={preview} parent={parent} now={now} />;
  return <PlainCard page={page} preview={preview} now={now} />;
}

/**
 * "+ Neue Notiz" at the end of a row of cards (a dashed add tile, as tall as the cards). On a phone,
 * or as the only thing in its section (`alone`), a slim bar across the row.
 */
export function NewCard({ kind, onClick, busy, alone }: { kind: NewKind; onClick: () => void; busy?: boolean; alone?: boolean }) {
  const t = useMessages(newPageText);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        addTile,
        "flex items-center justify-center gap-1.5 px-3 text-center text-[12.5px] font-medium disabled:pointer-events-none disabled:opacity-60",
        alone ? "col-span-full h-12 flex-row" : "h-full min-h-[150px] flex-col max-sm:col-span-full max-sm:h-12 max-sm:min-h-0 max-sm:flex-row",
      )}
    >
      <Plus className="size-4 shrink-0" aria-hidden />
      {t.kinds[kind].create}
    </button>
  );
}
