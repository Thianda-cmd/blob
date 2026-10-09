"use client";

import { FileText, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { CvDocument, PAGE_W, type CvLayoutInfo } from "@/cv/CvDocument";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { cn } from "@/lib/utils";
import { Segmented } from "./Segmented";

export type Zoom = "fit" | "full";

const MM = 96 / 25.4;
const PAGE_PX = PAGE_W * MM;

/**
 * The live A4 pages with a slim toolbar: zoom (fit or real size), the page count and whatever the
 * editor puts on the right (design, checklist, PDF). `side` sits next to the pages (the design panel).
 */
export function PreviewPane({
  cv,
  zoom,
  onZoom,
  pages,
  onLayout,
  actions,
  notice,
  side,
  className,
  paneRef,
}: {
  cv: Cv;
  zoom: Zoom;
  onZoom: (zoom: Zoom) => void;
  /** Page count from the last layout (null before the first). */
  pages: number | null;
  onLayout: (info: CvLayoutInfo) => void;
  actions?: ReactNode;
  notice?: ReactNode;
  side?: ReactNode;
  className?: string;
  paneRef?: Ref<HTMLElement>;
}) {
  const t = useMessages(cvEditorText);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; pad: number } | null>(null);

  // Fit the pages to the column, with a little room around them.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const pad = el.clientWidth >= 640 ? 32 : 14;
      const scale = Math.min(1, Math.max(0.2, (el.clientWidth - pad * 2) / PAGE_PX));
      setFit((f) => (f && Math.abs(f.scale - scale) < 0.001 && f.pad === pad ? f : { scale, pad }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // At real size the page is wider than a narrow column: start in its middle.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && zoom === "full") el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [zoom]);

  const scale = zoom === "full" ? 1 : (fit?.scale ?? 0.5);
  const many = (pages ?? 0) > 2;

  return (
    <section ref={paneRef} aria-label={t.previewLabel} className={cn("@container/preview flex min-h-0 min-w-0 flex-col bg-paper", className)}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-2.5">
        <Segmented
          label={t.zoom}
          equal={false}
          value={zoom}
          onChange={onZoom}
          options={[
            {
              id: "fit",
              title: t.zoomFitTitle,
              label: (
                <>
                  <Maximize2 aria-hidden />
                  <span className="hidden @min-[520px]/preview:inline">{t.zoomFit}</span>
                  <span className="sr-only @min-[520px]/preview:hidden">{t.zoomFit}</span>
                </>
              ),
            },
            { id: "full", title: t.zoomFullTitle, label: t.zoomFull },
          ]}
        />
        {pages !== null && (
          <span
            className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12.5px] tabular-nums", many ? "text-danger" : "text-ink-3")}
            title={many ? t.pagesTip : undefined}
            aria-live="polite"
          >
            <FileText className="size-3.5" aria-hidden />
            {t.pages(pages)}
          </span>
        )}
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      {/* overflow-hidden: the engine's hidden measuring copy must not make the page around it scrollable. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* A container of its own: the notice above the pages answers to their width, not the panel's. */}
        <div ref={scrollRef} className="@container/pages min-w-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
          {notice}
          <div className="mx-auto w-max" style={{ padding: `${fit && fit.pad > 20 ? 28 : 16}px ${fit?.pad ?? 16}px 40px` }}>
            <CvDocument
              cv={cv}
              scale={scale}
              gap={fit && fit.pad > 20 ? 24 : 14}
              onLayout={onLayout}
              pageClassName="rounded-[2px] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_36px_-14px_rgb(0_0_0/0.28)] ring-1 ring-black/[0.04]"
            />
          </div>
        </div>
        {side}
      </div>
    </section>
  );
}
