"use client";

import { CornerDownRight, Layers, TextSearch } from "lucide-react";
import Link from "next/link";
import { Avatar, type Person } from "@/components/share/Avatar";
import { PageIcon, SubjectIcon } from "@/components/shell/Sidebar";
import { CardTitle, PageThumb, editedLabel, pageCardClass, type PagePreview } from "@/components/subjects/PageCards";
import { midTone } from "@/components/ui/surfaces";
import { usePhone } from "@/components/ui/useMediaQuery";
import { useLocale, useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";
import type { PageMeta, Subject } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

type TileProps = {
  page: PageMeta;
  preview?: PagePreview;
  subject?: Subject;
  parent?: PageMeta;
  due: number;
  owner?: Person | null;
  shared: boolean;
  /** Found through the words inside it (not the title). */
  inText: boolean;
  now: number | null;
  onTag: (tag: string) => void;
};

/** Tag chips (they filter by their tag). */
function Tags({ tags, onTag, max = 3 }: { tags: string[]; onTag: (tag: string) => void; max?: number }) {
  if (!tags.length) return null;
  return (
    <span className="relative z-[1] flex min-w-0 flex-wrap gap-1">
      {tags.slice(0, max).map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTag(tag);
          }}
          className="max-w-[140px] truncate rounded-full bg-hover px-1.5 py-px text-[11px] font-medium text-ink-2 transition-colors hover:bg-blob-soft hover:text-blob-ink pointer-coarse:px-2 pointer-coarse:py-1.5"
        >
          #{tag}
        </button>
      ))}
      {tags.length > max && <span className={cn("px-0.5 text-[11px]", midTone)}>+{tags.length - max}</span>}
    </span>
  );
}

/** Says why a tile is among the results: the search found its words, not its title. */
function InText() {
  const t = useMessages(notesText);
  return (
    <span className="pointer-events-none flex items-center gap-1 text-[11px] font-medium text-blob-ink">
      <TextSearch className="size-3" aria-hidden /> {t.inText}
    </span>
  );
}

function Meta({ page, subject, parent, owner, shared, due, now }: Pick<TileProps, "page" | "subject" | "parent" | "owner" | "shared" | "due" | "now">) {
  const locale = useLocale();
  const t = useMessages(notesText);
  return (
    <span className={cn("flex min-w-0 items-center gap-2 text-[11.5px]", midTone)}>
      {parent ? (
        <span className="flex min-w-0 items-center gap-1 overflow-hidden" title={pageTitle(parent.title, parent.kind, locale)}>
          <CornerDownRight className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{pageTitle(parent.title, parent.kind, locale)}</span>
        </span>
      ) : subject ? (
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden" title={subject.name}>
          <span className="grid size-3.5 shrink-0 place-items-center [&_svg]:size-3">
            <SubjectIcon subject={subject} className="text-[11px]" />
          </span>
          <span className="truncate">{subject.name}</span>
        </span>
      ) : null}
      {shared && (owner ? <Avatar person={owner} size={16} title={t.sharedBy(owner.full_name || "?")} /> : <span className="shrink-0">{t.shared}</span>)}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {due > 0 && (
          <Link
            href={`/study/note/${page.id}?mode=cards`}
            onClick={(e) => e.stopPropagation()}
            className="relative z-[1] flex items-center gap-1 rounded-full bg-blob/15 px-1.5 py-px text-[11px] font-semibold text-blob-ink hover:bg-blob/25"
          >
            <Layers className="size-3" aria-hidden /> {t.due(due)}
          </Link>
        )}
        <span suppressHydrationWarning>{editedLabel(page.updated_at, now, locale)}</span>
      </span>
    </span>
  );
}

/**
 * A page in the grid, in the same card as everywhere (Start, folders, subjects): its picture (a
 * note's first lines, a spreadsheet's first cells, a slide, a handwritten page, a folder's pages),
 * its title, why it was found, its tags and where it lives. The whole card opens the page; the tags
 * and the due cards are buttons of their own above it.
 */
export function PageTile(props: TileProps & { childCount: number; childTitles: string[] }) {
  const { page, preview, inText, onTag, childCount, childTitles } = props;
  const locale = useLocale();
  // Two columns on a phone: room for two tags.
  const phone = usePhone();
  const title = pageTitle(page.title, page.kind, locale);
  return (
    <div className={cn(pageCardClass, "[contain-intrinsic-size:auto_230px] [content-visibility:auto]")} data-page-id={page.id}>
      {/* The outline inside the card: content-visibility clips what is drawn outside it. */}
      <Link href={`/p/${page.id}`} className="absolute inset-0 rounded-xl focus-visible:outline-offset-[-2px]" aria-label={title} />
      <PageThumb page={page} preview={preview} title={title} inside={page.kind === "folder" ? { count: childCount, titles: childTitles } : undefined} className="pointer-events-none" />
      <CardTitle page={page} title={title} className="pointer-events-none" />
      <div className="mt-auto space-y-1.5 px-1.5 pb-0.5 pt-1.5">
        {inText && <InText />}
        <Tags tags={page.tags} onTag={onTag} max={phone ? 2 : 3} />
        <Meta {...props} />
      </div>
    </div>
  );
}

/** A page in the list view: one row each. */
export function PageRow(props: TileProps & { first: boolean }) {
  const { page, preview, inText, onTag, first } = props;
  const locale = useLocale();
  const t = useMessages(notesText);
  const title = pageTitle(page.title, page.kind, locale);
  return (
    <li
      data-page-id={page.id}
      className={cn("group relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover/50 sm:px-4 [content-visibility:auto] [contain-intrinsic-size:auto_56px]", !first && "border-t border-line")}
    >
      <Link href={`/p/${page.id}`} className="absolute inset-0 focus-visible:outline-offset-[-2px]" aria-label={title} />
      <span className="pointer-events-none grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface">
        <PageIcon page={page} />
      </span>
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-ink">{title}</span>
          {inText && <TextSearch className="size-3 shrink-0 text-blob-ink" aria-label={t.inText} />}
        </span>
        {page.kind === "note" && preview?.snippet && <span className={cn("mt-0.5 block truncate text-[12px] max-sm:hidden", midTone)}>{preview.snippet}</span>}
      </span>
      <span className="hidden max-w-[220px] shrink-0 md:block">
        <Tags tags={page.tags} onTag={onTag} max={2} />
      </span>
      <span className="w-[min(46%,260px)] shrink-0 max-sm:w-auto">
        <Meta {...props} />
      </span>
    </li>
  );
}
