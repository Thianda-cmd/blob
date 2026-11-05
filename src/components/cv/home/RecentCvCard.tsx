"use client";

import { FileUser } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CardMeta, CardTitle, editedLabel, pageCardClass } from "@/components/subjects/PageCards";
import { CvThumbnail } from "@/cv/CvDocument";
import { cvProgress, normalizeCv } from "@/cv/model";
import { useLocale, useMessages } from "@/i18n/client";
import { cvHomeText } from "@/i18n/messages/cvHome";
import type { PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { isSampleCv } from "./start";
import { useWidth } from "./useWidth";

/**
 * A CV among the recent pages on Start, in the card every page has there (PageCards.tsx): a 16:10
 * picture (the top of page 1, lying on a desk in the CV's accent colour, with how far along it
 * is), the title, and when it was edited.
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
    <Link href={`/p/${page.id}`} className={pageCardClass}>
      <div
        ref={desk}
        className="relative aspect-[16/10] shrink-0 overflow-hidden rounded-lg"
        style={{ background: `color-mix(in oklab, ${cv?.design.accent ?? "var(--blob)"} 14%, var(--paper))` }}
      >
        {cv && width > 0 ? (
          <div
            className="absolute top-3 transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
            style={{ left: (width - paper) / 2 }}
          >
            <CvThumbnail cv={cv} width={paper} className="rounded-[3px] bg-white shadow-card" />
          </div>
        ) : (
          <FileUser className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-ink-3" strokeWidth={1.5} aria-hidden />
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
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />
      </div>
      <CardTitle page={page} title={name} />
      <CardMeta>
        <span className="truncate" suppressHydrationWarning>
          {editedLabel(page.updated_at, now, locale)}
        </span>
      </CardMeta>
    </Link>
  );
}
