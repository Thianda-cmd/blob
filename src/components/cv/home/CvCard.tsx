"use client";

import { formatDistanceStrict } from "date-fns";
import { motion } from "motion/react";
import { ArrowUpRight, BookOpenCheck, Check, Copy, Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useMemo } from "react";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { templateMeta } from "@/cv/catalog";
import { CvThumbnail } from "@/cv/CvDocument";
import { cvProgress, normalizeCv } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { dateLocale } from "@/i18n/format";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { useText } from "@/i18n/useText";
import { cn, pageTitle } from "@/lib/utils";
import { isSampleCv } from "./start";
import { useWidth } from "./useWidth";

/** A CV on the CV home. `content` is undefined while a CV made elsewhere is still on its way from the server. */
export type CvItem = { id: string; title: string; updated_at: string; content?: unknown };

function edited(updatedAt: string, now: number | null, locale: Locale) {
  if (!now) return " ";
  const t = cvHomeText[locale];
  const d = new Date(updatedAt);
  if (now - d.getTime() < 60_000) return t.editedJustNow;
  return t.edited(formatDistanceStrict(d, now, { addSuffix: true, locale: dateLocale(locale) }));
}

const Thumb = memo(function Thumb({ cv, width }: { cv: Cv; width: number }) {
  return <CvThumbnail cv={cv} width={width} className="rounded-[3px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.07),0_10px_26px_-10px_rgb(0_0_0/0.3)]" />;
});

/**
 * A CV on the CV home: page 1 lying on a desk in the CV's accent colour, the title, when it was
 * last edited and how complete it is. The menu opens, renames, copies or trashes it.
 */
export function CvCard({
  item,
  now,
  onRename,
  onDuplicate,
  onTrash,
}: {
  item: CvItem;
  now: number | null;
  onRename: (cv: Cv) => void;
  onDuplicate: () => void;
  onTrash: () => void;
}) {
  const t = useMessages(cvHomeText);
  const locale = useLocale();
  const tt = useText();
  const router = useRouter();
  const cv = useMemo(() => normalizeCv(item.content, locale), [item.content, locale]);
  const loaded = item.content !== undefined;
  const progress = cvProgress(cv);
  const done = progress === 100;
  // Started from the example and still Lena's: complete, but not the student's CV yet.
  const sample = isSampleCv(cv);
  const title = pageTitle(item.title, "cv", locale);
  const [desk, width] = useWidth<HTMLDivElement>();
  const inset = Math.round(width * 0.1);

  return (
    <div className="group relative h-full">
      <Link
        href={`/p/${item.id}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_1px_1px_rgb(28_27_24/0.04),0_10px_24px_-10px_rgb(28_27_24/0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blob active:translate-y-0"
      >
        <div
          ref={desk}
          className="relative aspect-[1/1.06] overflow-hidden border-b border-line"
          style={{ background: `color-mix(in oklab, ${cv.design.accent} 14%, var(--paper))` }}
        >
          {width > 0 && (
            <div
              className="absolute transition-transform duration-300 ease-out group-hover:-translate-y-1"
              style={{ left: inset, top: inset, width: width - 2 * inset }}
            >
              {loaded ? (
                <Thumb cv={cv} width={width - 2 * inset} />
              ) : (
                <div className="aspect-[210/297] w-full animate-pulse rounded-[3px] bg-white/80 shadow-[0_1px_2px_rgb(0_0_0/0.07)]" />
              )}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-2.5">
          <span className="line-clamp-2 text-[14px] font-medium leading-snug text-ink [overflow-wrap:anywhere]">{title}</span>
          {/* Two lines, so neither gets cut off on a phone. */}
          <span className="mt-0.5 block truncate text-[12px] text-ink-3">{loaded ? tt(templateMeta(cv.design.template).name) : " "}</span>
          <span className="block truncate text-[12px] text-ink-3" suppressHydrationWarning>
            {edited(item.updated_at, now, locale)}
          </span>
          {!loaded ? (
            <span className="mt-auto block pt-2.5">
              <span className="block h-1.5 rounded-full bg-hover" />
            </span>
          ) : sample ? (
            <span className="mt-auto flex items-center gap-1.5 pt-2 text-[11.5px] font-medium text-ink-3" title={t.sampleHint}>
              <BookOpenCheck className="size-3.5 shrink-0" />
              <span className="truncate">{t.sample}</span>
            </span>
          ) : (
            <span className="mt-auto flex items-center gap-2 pt-2.5" title={done ? t.complete : t.progress(progress)}>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover">
                <motion.span
                  className={cn("block h-full rounded-full", done ? "bg-ok" : "bg-blob")}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.15 }}
                />
              </span>
              <span className={cn("flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium tabular-nums", done ? "text-ok" : "text-ink-3")}>
                {done && <Check className="size-3" strokeWidth={3} />}
                {locale === "de" ? `${progress} %` : `${progress}%`}
              </span>
            </span>
          )}
        </div>
      </Link>

      <Popover
        align="end"
        className="w-[210px]"
        trigger={(props) => (
          <button
            {...props}
            aria-label={t.options(title)}
            title={t.options(title)}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg border border-line bg-raised/95 text-ink-2 opacity-0 shadow-card transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Ellipsis className="size-4" />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={<ArrowUpRight />} onSelect={() => (close(), router.push(`/p/${item.id}`))}>
              {t.open}
            </MenuItem>
            <MenuItem icon={<PencilLine />} onSelect={() => (close(), onRename(cv))}>
              {t.rename}
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={() => (close(), onDuplicate())}>
              {t.duplicate}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => (close(), onTrash())}>
              {t.trash}
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}

/** The last tile in the grid: start another CV. Shaped like a card (an empty sheet on the desk), so it lines up with them. */
export function NewCvCard({ onClick }: { onClick: () => void }) {
  const t = useMessages(cvHomeText);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-dashed border-line-2 text-ink-2 transition-colors hover:border-blob/60 hover:bg-blob-soft/40 hover:text-blob-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blob"
    >
      <span className="relative block aspect-[1/1.06] w-full shrink-0">
        <span className="absolute inset-x-[10%] bottom-0 top-[10%] grid place-items-center rounded-t-[4px] border border-b-0 border-dashed border-line-2 transition-[border-color,transform] duration-300 ease-out group-hover:-translate-y-1 group-hover:border-blob/50">
          <span className="grid size-11 place-items-center rounded-xl bg-blob-soft text-blob-ink transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
            <Plus className="size-5" />
          </span>
        </span>
      </span>
      {/* About as tall as a card's title, date and progress, so a tile alone in its row matches the cards. */}
      <span className="flex min-h-[100px] flex-1 items-center justify-center border-t border-dashed border-line-2 px-3 py-3 text-center text-[13.5px] font-medium group-hover:border-blob/50">
        {t.newCv}
      </span>
    </button>
  );
}
