"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { deckFontVars } from "@/components/deck/fonts";
import { cn } from "@/lib/utils";
import { CV_FONTS } from "./fonts";
import { templateFor } from "./templates";
import type { CvBlock, CvGeometry, CvTemplate } from "./templates/types";
import type { Cv } from "./types";

// The CV engine: cuts a CV into blocks (the design decides how), measures each block at its real
// width, and fills A4 pages column by column. Screen previews, thumbnails and the printed PDF all
// draw the same pages, so what you see is what you print.

export const PAGE_W = 210;
export const PAGE_H = 297;
const PX_PER_MM = 96 / 25.4;
/** Slack for sub-pixel rounding between the measuring copy and the page. */
const SLACK_MM = 0.4;

const FONT_SIZE = { s: "8.9pt", m: "9.6pt", l: "10.4pt" } as const;

/** Mixes the accent with white for tints; hex in, rgb() out. */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * (1 - amount));
  return `rgb(${mix((n >> 16) & 255)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
}

/** Black or white, whichever reads better on the accent. */
function onAccent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#16171a" : "#ffffff";
}

/** The page's CSS variables: colours, fonts and text size. Blocks only use these. */
export function cvStyle(cv: Cv): CSSProperties {
  const fonts = CV_FONTS[cv.design.fonts];
  const accent = cv.design.accent;
  return {
    "--cv-accent": accent,
    "--cv-accent-soft": tint(accent, 0.12),
    "--cv-accent-mid": tint(accent, 0.45),
    "--cv-on-accent": onAccent(accent),
    "--cv-ink": "#1d1e21",
    "--cv-ink-2": "#46474d",
    "--cv-ink-3": "#76777e",
    "--cv-line": "#dfe0e4",
    "--cv-paper": "#ffffff",
    "--cv-heading": fonts.heading,
    "--cv-body": fonts.body,
    "--cv-heading-weight": String(fonts.headingWeight),
    fontFamily: "var(--cv-body)",
    fontSize: FONT_SIZE[cv.design.size],
    lineHeight: 1.42,
    color: "var(--cv-ink)",
  } as CSSProperties;
}

type Layout = {
  /** For each page, the indexes of the blocks in each column. */
  pages: { header: number[]; main: number[]; side: number[] }[];
  headerHeight: number;
  /** A block taller than a whole page (it is cut off). */
  overflow: boolean;
};

const mm = (px: number) => px / PX_PER_MM;

function widths(g: CvGeometry) {
  const content = PAGE_W - g.margin.left - g.margin.right;
  const side = g.side?.width ?? 0;
  const main = g.side ? content - side - g.side.gap : content;
  const sideX = g.side ? (g.side.position === "left" ? g.margin.left : g.margin.left + main + g.side.gap) : 0;
  const mainX = g.side?.position === "left" ? g.margin.left + side + g.side.gap : g.margin.left;
  const header = g.header === "full" ? content : main;
  const headerX = g.header === "full" ? g.margin.left : mainX;
  return { content, main, side, mainX, sideX, header, headerX };
}

/** Fills pages with measured blocks (heights in mm). */
function paginate(blocks: CvBlock[], heights: number[], g: CvGeometry): Layout {
  const headerIdx = blocks.flatMap((b, i) => (b.column === "header" ? [i] : []));
  const headerHeight = headerIdx.reduce((sum, i) => sum + heights[i], 0);
  const top = (p: number) => (p === 0 ? g.margin.top : (g.marginNext?.top ?? g.margin.top));
  const bottom = (p: number) => (p === 0 ? g.margin.bottom : (g.marginNext?.bottom ?? g.margin.bottom));
  const headerCut = headerIdx.length ? headerHeight + g.headerGap : 0;
  const room = (p: number, column: "main" | "side") =>
    PAGE_H - top(p) - bottom(p) - (p === 0 && (column === "main" || g.header === "full") ? headerCut : 0);

  let overflow = false;
  const fill = (column: "main" | "side") => {
    const idx = blocks.flatMap((b, i) => (b.column === column ? [i] : []));
    const pages: number[][] = [[]];
    let used = 0;
    idx.forEach((i, n) => {
      const p = pages.length - 1;
      const h = heights[i];
      const next = idx[n + 1];
      // A heading needs room for itself and the first thing under it.
      const need = blocks[i].keepWithNext && next !== undefined ? h + heights[next] : h;
      if (used > 0 && used + need > room(p, column) + SLACK_MM) {
        // A closing block takes the block before it along (and that block's heading), so it never sits alone.
        const carried: number[] = [];
        const current = pages[p];
        if (blocks[i].keepWithPrevious) {
          while (current.length > 1) {
            carried.unshift(current.pop()!);
            if (!blocks[current[current.length - 1]].keepWithNext) break;
          }
        }
        pages.push(carried);
        used = carried.reduce((sum, j) => sum + heights[j], 0);
      }
      if (h > room(pages.length - 1, column) + SLACK_MM) overflow = true;
      pages[pages.length - 1].push(i);
      used += h;
    });
    return pages;
  };

  const main = fill("main");
  const side = fill("side");
  const count = Math.max(main.length, side.length, 1);
  return {
    pages: Array.from({ length: count }, (_, p) => ({ header: p === 0 ? headerIdx : [], main: main[p] ?? [], side: side[p] ?? [] })),
    headerHeight,
    overflow,
  };
}

/** Re-measure once web fonts arrive (a fallback font has other line breaks). */
function useFontsVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let alive = true;
    const bump = () => alive && setVersion((v) => v + 1);
    document.fonts.ready.then(bump);
    document.fonts.addEventListener("loadingdone", bump);
    return () => {
      alive = false;
      document.fonts.removeEventListener("loadingdone", bump);
    };
  }, []);
  return version;
}

const Block = ({ block, index }: { block: CvBlock; index: number }) => (
  // flow-root keeps the block's inner margins inside the measured box.
  <div data-cv-block={index} style={{ display: "flow-root" }}>
    {block.node}
  </div>
);

export type CvLayoutInfo = { pages: number; overflow: boolean };

/**
 * Draws a CV as A4 pages. `scale` shrinks the pages for screens (1 = real size, for printing);
 * `maxPages` draws only the first pages (thumbnails).
 */
export function CvDocument({
  cv,
  scale = 1,
  maxPages,
  gap = 16,
  onLayout,
  className,
  pageClassName,
}: {
  cv: Cv;
  scale?: number;
  maxPages?: number;
  /** Space between pages on screen, in px. */
  gap?: number;
  onLayout?: (info: CvLayoutInfo) => void;
  className?: string;
  pageClassName?: string;
}) {
  const template = templateFor(cv.design.template);
  const geometry = useMemo(() => template.geometry(cv), [template, cv]);
  const blocks = useMemo(() => template.blocks(cv), [template, cv]);
  const fonts = useFontsVersion();
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const style = useMemo(() => cvStyle(cv), [cv]);
  const w = widths(geometry);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    // Rects include any CSS transform on an ancestor (a scaled card, an opening animation); undo it.
    const first = root.firstElementChild as HTMLElement | null;
    const ratio = first && first.offsetWidth ? first.getBoundingClientRect().width / first.offsetWidth : 1;
    const heights = blocks.map((_, i) => {
      const el = root.querySelector<HTMLElement>(`[data-cv-block="${i}"]`);
      return el ? mm(el.getBoundingClientRect().height / (ratio || 1)) : 0;
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the layout depends on measured DOM sizes
    setLayout(paginate(blocks, heights, geometry));
  }, [blocks, geometry, fonts]);

  const report = useRef(onLayout);
  useEffect(() => {
    report.current = onLayout;
  });
  useEffect(() => {
    if (layout) report.current?.({ pages: layout.pages.length, overflow: layout.overflow });
  }, [layout]);

  const pages = layout ? (maxPages ? layout.pages.slice(0, maxPages) : layout.pages) : [];
  const Background = template.Background;
  const Overlay = template.Overlay;

  return (
    <div className={cn(deckFontVars, "cv-document", className)}>
      {/* The measuring copy: same widths and styles as the pages, never seen. */}
      <div ref={measureRef} aria-hidden className="cv-measure" style={{ ...style, position: "absolute", left: -10000, top: 0, visibility: "hidden", pointerEvents: "none" }}>
        {(["header", "main", "side"] as const).map((column) => (
          <div key={column} style={{ width: `${column === "header" ? w.header : column === "main" ? w.main : w.side}mm` }}>
            {blocks.map((b, i) => (b.column === column ? <Block key={b.key} block={b} index={i} /> : null))}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center" style={{ gap }}>
        {pages.map((page, p) => (
          <div
            key={p}
            className="cv-page-slot"
            style={{ width: `${PAGE_W * scale}mm`, height: `${PAGE_H * scale}mm` }}
          >
            <div
              className={cn("cv-page relative overflow-hidden bg-white", pageClassName)}
              style={{ ...style, width: `${PAGE_W}mm`, height: `${PAGE_H}mm`, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "0 0" }}
            >
              {Background && <Background cv={cv} page={p} pages={layout?.pages.length ?? 1} headerHeight={p === 0 ? layout?.headerHeight ?? 0 : 0} geometry={geometry} />}
              <PageColumns cv={cv} page={p} layout={layout!} blocks={blocks} geometry={geometry} />
              {Overlay && <Overlay cv={cv} page={p} pages={layout?.pages.length ?? 1} headerHeight={p === 0 ? layout?.headerHeight ?? 0 : 0} geometry={geometry} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageColumns({ page, layout, blocks, geometry }: { cv: Cv; page: number; layout: Layout; blocks: CvBlock[]; geometry: CvGeometry }) {
  const w = widths(geometry);
  const slot = layout.pages[page];
  const top = page === 0 ? geometry.margin.top : (geometry.marginNext?.top ?? geometry.margin.top);
  const below = page === 0 && slot.header.length ? layout.headerHeight + geometry.headerGap : 0;
  const column = (list: number[], x: number, width: number, y: number): ReactNode =>
    list.length > 0 && (
      <div className="absolute" style={{ left: `${x}mm`, top: `${y}mm`, width: `${width}mm` }}>
        {list.map((i) => (
          <Block key={blocks[i].key} block={blocks[i]} index={i} />
        ))}
      </div>
    );
  return (
    <>
      {column(slot.header, w.headerX, w.header, top)}
      {column(slot.main, w.mainX, w.main, top + below)}
      {geometry.side && column(slot.side, w.sideX, w.side, top + (geometry.header === "full" ? below : 0))}
    </>
  );
}

/** The first page only, scaled to `width` px (cards and design pickers). */
export function CvThumbnail({ cv, width, className }: { cv: Cv; width: number; className?: string }) {
  const scale = width / (PAGE_W * PX_PER_MM);
  return (
    <div className={cn("pointer-events-none select-none overflow-hidden", className)} style={{ width, height: PAGE_H * PX_PER_MM * scale }} aria-hidden>
      <CvDocument cv={cv} scale={scale} maxPages={1} gap={0} />
    </div>
  );
}

/**
 * Prints the CV (the browser's print dialog, where "Save as PDF" makes the file). While it is
 * mounted, printing shows only the CV pages at real size on A4 without margins. `onDone` runs
 * after the dialog closes.
 */
export function CvPrint({ cv, fileName, onDone }: { cv: Cv; fileName: string; onDone: () => void }) {
  const [ready, setReady] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!ready) return;
    const title = document.title;
    document.title = fileName;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.title = title;
      done.current();
    };
    window.addEventListener("afterprint", finish, { once: true });
    // Let the pages paint (and their fonts settle) before the dialog takes its snapshot.
    const timer = window.setTimeout(() => {
      window.print();
      // Some browsers return from print() while the dialog is still open and never send afterprint:
      // the next tap or click in the page means it has closed.
      window.addEventListener("pointerdown", finish, { once: true });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pointerdown", finish);
      document.title = title;
    };
  }, [ready, fileName]);

  if (typeof document === "undefined") return null;
  return createPortal(
    // Off screen but laid out (the pages are measured); in print it is the only thing on the paper.
    <div className="cv-print" style={{ position: "fixed", left: -100000, top: 0, visibility: "hidden" }} aria-hidden>
      <style>{PRINT_CSS}</style>
      <CvDocument cv={cv} scale={1} gap={0} onLayout={() => setReady(true)} />
    </div>,
    document.body,
  );
}

const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body > :not(.cv-print) { display: none !important; }
  .cv-print { position: static !important; visibility: visible !important; }
  .cv-print .cv-measure { display: none !important; }
  .cv-print .cv-page-slot { height: 296.6mm !important; overflow: hidden; break-after: page; }
  .cv-print .cv-page-slot:last-child { break-after: auto; }
  .cv-print .cv-page { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}`;
