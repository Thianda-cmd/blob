"use client";

import { formatDistanceStrict } from "date-fns";
import { FileUser } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PageIcon } from "@/components/shell/Sidebar";
import { CvThumbnail } from "@/cv/CvDocument";
import { cvProgress, normalizeCv } from "@/cv/model";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { cvHomeText } from "@/i18n/messages/cvHome";
import type { PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { isSampleCv } from "./start";
import { useWidth } from "./useWidth";

/**
 * A CV among the recent pages on Home: the top of page 1 (name and header) on a desk in the CV's
 * accent colour. Same footprint as the note and presentation cards.
 */
export function RecentCvCard({ page, content, now }: { page: PageMeta; content: unknown; now: number | null }) {
  const locale = useLocale();
  const t = useMessages(cvHomeText);
  const cv = useMemo(() => (content === undefined ? null : normalizeCv(content, locale)), [content, locale]);
  const [desk, width] = useWidth<HTMLDivElement>();
  const name = pageTitle(page.title, page.kind, locale);
  const paper = Math.round(width * 0.8);
  const progress = cv ? cvProgress(cv) : null;
  // Still Lena's example: complete, but not ready to send.
  const sample = cv ? isSampleCv(cv) : false;
  return (
    <Link
      href={`/p/${page.id}`}
      className="group flex h-[150px] flex-col rounded-xl border border-line bg-raised p-2 shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2"
    >
      <div
        ref={desk}
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg ring-1 ring-inset ring-black/[0.05]"
        style={{ background: `color-mix(in oklab, ${cv?.design.accent ?? "var(--blob)"} 14%, var(--paper))` }}
      >
        {cv && width > 0 ? (
          <div className="absolute top-3 transition-transform duration-300 ease-out group-hover:-translate-y-1" style={{ left: (width - paper) / 2 }}>
            <CvThumbnail cv={cv} width={paper} className="rounded-[3px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.07),0_8px_20px_-8px_rgb(0_0_0/0.3)]" />
          </div>
        ) : (
          <FileUser className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-ink-3" strokeWidth={1.5} />
        )}
        {progress !== null && (
          <span
            title={sample ? t.sampleHint : undefined}
            className={cn(
              "absolute bottom-1.5 right-1.5 max-w-[calc(100%-12px)] truncate rounded-md bg-raised/95 px-1.5 py-0.5 text-[11px] font-medium tabular-nums shadow-card",
              progress === 100 && !sample ? "text-ok" : "text-ink-2",
            )}
          >
            {sample ? t.sample : progress === 100 ? t.complete : t.progress(progress)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2 px-1.5 pt-2">
        <PageIcon page={page} className="size-3.5" />
        <span className="truncate text-[13.5px] font-medium" title={name}>
          {name}
        </span>
        <span className="ml-auto shrink-0 text-[11.5px] text-ink-3" suppressHydrationWarning>
          {now ? formatDistanceStrict(new Date(page.updated_at), now, { addSuffix: true, locale: dateLocale(locale) }) : ""}
        </span>
      </div>
    </Link>
  );
}
