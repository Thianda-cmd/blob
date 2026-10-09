"use client";

import { formatDistanceStrict } from "date-fns";
import { CornerDownRight, Folder, Layers, TextSearch } from "lucide-react";
import Link from "next/link";
import { Avatar, type Person } from "@/components/share/Avatar";
import { PageIcon, SubjectIcon } from "@/components/shell/Sidebar";
import { SlideThumb, type PagePreview } from "@/components/subjects/PageCards";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { notesText } from "@/i18n/messages/notes";
import type { PageMeta, Subject } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

function edited(updatedAt: string, now: number | null, locale: Locale) {
  if (!now) return " ";
  const t = notesText[locale];
  const d = new Date(updatedAt);
  if (now - d.getTime() < 60_000) return t.editedJustNow;
  return t.edited(formatDistanceStrict(d, now, { addSuffix: true, locale: dateLocale(locale) }));
}

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

const tileBase =
  "group relative flex min-w-0 flex-col rounded-xl border border-line bg-raised shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_1px_1px_rgb(28_27_24/0.04),0_8px_20px_-8px_rgb(28_27_24/0.18)] [content-visibility:auto] [contain-intrinsic-size:auto_170px]";

/** Tag chips (they filter by their tag). */
function Tags({ tags, onTag, max = 3 }: { tags: string[]; onTag: (tag: string) => void; max?: number }) {
  if (!tags.length) return null;
  return (
    <span className="relative z-[1] flex min-w-0 flex-wrap gap-1">
      {tags.slice(0, max).map((tag) => (
        <button
          key={tag}
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
      {tags.length > max && <span className="px-0.5 text-[11px] text-ink-3">+{tags.length - max}</span>}
    </span>
  );
}

function Meta({ page, subject, parent, owner, shared, due, now }: Pick<TileProps, "page" | "subject" | "parent" | "owner" | "shared" | "due" | "now">) {
  const locale = useLocale();
  const t = useMessages(notesText);
  return (
    <span className="flex min-w-0 items-center gap-2 text-[11.5px] text-ink-3">
      {parent ? (
        <span className="flex min-w-0 items-center gap-1" title={pageTitle(parent.title, parent.kind, locale)}>
          <CornerDownRight className="size-3 shrink-0" />
          <span className="truncate">{pageTitle(parent.title, parent.kind, locale)}</span>
        </span>
      ) : subject ? (
        <span className="flex min-w-0 items-center gap-1.5" title={subject.name}>
          <span className="grid size-3.5 shrink-0 place-items-center [&_svg]:size-3">
            <SubjectIcon subject={subject} className="text-[11px]" />
          </span>
          <span className="truncate">{subject.name}</span>
        </span>
      ) : null}
      {shared && (owner ? <Avatar person={owner} size={16} title={t.sharedBy(owner.full_name || "?")} /> : <span className="shrink-0 text-ink-3">{t.shared}</span>)}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {due > 0 && (
          <Link
            href={`/study/note/${page.id}?mode=cards`}
            onClick={(e) => e.stopPropagation()}
            className="relative z-[1] flex items-center gap-1 rounded-full bg-blob/15 px-1.5 py-px text-[11px] font-semibold text-blob-ink hover:bg-blob/25"
          >
            <Layers className="size-3" /> {t.due(due)}
          </Link>
        )}
        <span suppressHydrationWarning>{edited(page.updated_at, now, locale)}</span>
      </span>
    </span>
  );
}

/** A page in the grid: a note with its first lines, a presentation with its first slide, a folder with what's inside. */
export function PageTile(props: TileProps & { childCount: number; childTitles: string[] }) {
  const { page, preview, inText, onTag, childCount, childTitles } = props;
  const locale = useLocale();
  const t = useMessages(notesText);
  const title = pageTitle(page.title, page.kind, locale);

  if (page.kind === "deck") {
    return (
      <div className={cn(tileBase, "p-2")}>
        <Link href={`/p/${page.id}`} className="absolute inset-0 rounded-xl" aria-label={title} />
        <SlideThumb title={preview?.slideTitle?.trim() || title} theme={preview?.theme ?? null} className="pointer-events-none transition-transform duration-300 group-hover:scale-[1.012]" />
        <div className="pointer-events-none flex min-w-0 items-center gap-2 px-1.5 pt-2.5">
          <PageIcon page={page} className="size-3.5" />
          <span className="truncate text-[13.5px] font-medium text-ink" title={title}>
            {title}
          </span>
        </div>
        <div className="mt-1.5 space-y-1.5 px-1.5 pb-0.5">
          <Tags tags={page.tags} onTag={onTag} />
          <Meta {...props} />
        </div>
      </div>
    );
  }

  const snippet = page.kind === "folder" ? "" : preview?.snippet?.trim();
  return (
    <div className={cn(tileBase, "min-h-[150px] p-3.5")}>
      <Link href={`/p/${page.id}`} className="absolute inset-0 rounded-xl" aria-label={title} />
      <div className="pointer-events-none flex min-w-0 items-start gap-2">
        {page.kind === "folder" ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink">
            {page.icon ? <span className="text-[14px] leading-none">{page.icon}</span> : <Folder className="size-4" strokeWidth={1.9} />}
          </span>
        ) : (
          <PageIcon page={page} className="mt-0.5" />
        )}
        <span className={cn("line-clamp-2 min-w-0 text-[14px] font-medium leading-snug text-ink", page.kind === "folder" && "mt-1")} title={title}>
          {title}
        </span>
      </div>
      {page.kind === "folder" ? (
        <div className="pointer-events-none mt-2.5 space-y-1">
          <div className="text-[12px] text-ink-3">{childCount ? t.pagesInside(childCount) : t.emptyFolder}</div>
          {childTitles.map((c, i) => (
            <div key={i} className="truncate border-l-2 border-line pl-2 text-[12px] text-ink-2">
              {c}
            </div>
          ))}
        </div>
      ) : (
        <p className={cn("pointer-events-none mt-2 line-clamp-3 text-[12.5px] leading-[1.55]", snippet ? "text-ink-3" : "italic text-ink-3/70")}>{snippet || t.emptyNote}</p>
      )}
      <div className="mt-auto space-y-2 pt-2.5">
        {inText && (
          <span className="pointer-events-none flex items-center gap-1 text-[11px] font-medium text-blob-ink">
            <TextSearch className="size-3" /> {t.inText}
          </span>
        )}
        <Tags tags={page.tags} onTag={onTag} />
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
    <li className={cn("group relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover/50 sm:px-4 [content-visibility:auto] [contain-intrinsic-size:auto_56px]", !first && "border-t border-line")}>
      <Link href={`/p/${page.id}`} className="absolute inset-0" aria-label={title} />
      <span className="pointer-events-none grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface">
        <PageIcon page={page} />
      </span>
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-ink">{title}</span>
          {inText && <TextSearch className="size-3 shrink-0 text-blob-ink" aria-label={t.inText} />}
        </span>
        {page.kind === "note" && preview?.snippet && <span className="mt-0.5 block truncate text-[12px] text-ink-3 max-sm:hidden">{preview.snippet}</span>}
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
