import type { ComponentType, ReactNode } from "react";
import type { Cv, CvTemplateId } from "../types";

/**
 * How a CV design is built. A design never positions content across pages itself: it cuts the CV
 * into blocks, says which column each block goes in, and the engine (src/cv/CvDocument.tsx)
 * measures them and fills A4 pages, so the screen preview and the printed PDF are the same pages.
 *
 * Rules for blocks (the measuring depends on them):
 * - No outer margins on a block's root: use padding for space above or below. Blocks stack without gaps.
 * - Sizes in em (relative to the page's font size, which follows the "text size" setting) or mm.
 * - Colours from the page variables (--cv-ink, --cv-ink-2, --cv-ink-3, --cv-line, --cv-accent,
 *   --cv-accent-soft, --cv-on-accent, --cv-paper), never the app's theme colours: a CV is always
 *   printed on white paper, also when the app is in dark mode.
 * - Fonts: var(--cv-heading) and var(--cv-body); --cv-heading-weight for headings.
 * - Images (the photo) need a fixed size, so they don't change a block's height once loaded.
 */
export type CvGeometry = {
  /** Page margins in mm (content box). Pages after the first may use other top/bottom margins. */
  margin: { top: number; right: number; bottom: number; left: number };
  marginNext?: { top: number; bottom: number };
  /** A second, narrower column. */
  side?: { width: number; position: "left" | "right"; gap: number };
  /**
   * Where page 1's "header" blocks go: across the content width above both columns ("full"),
   * or at the top of the main column only ("main", the side column then starts at the top).
   */
  header: "full" | "main";
  /** Space under the header on page 1, in mm. */
  headerGap: number;
};

export type CvColumn = "header" | "main" | "side";

export type CvBlock = {
  /** Stable within one render (used as React key and for measuring). */
  key: string;
  column: CvColumn;
  node: ReactNode;
  /** A heading: never the last block on a page, it moves over with the block after it. */
  keepWithNext?: boolean;
};

/** Decorations behind one page (side column fill, header band, rules), drawn in the 210 × 297 mm page box. */
export type CvBackgroundProps = {
  cv: Cv;
  /** 0-based. */
  page: number;
  pages: number;
  /** Height of page 1's header blocks in mm (0 on other pages). */
  headerHeight: number;
  geometry: CvGeometry;
};

export type CvTemplate = {
  id: CvTemplateId;
  geometry: (cv: Cv) => CvGeometry;
  blocks: (cv: Cv) => CvBlock[];
  Background?: ComponentType<CvBackgroundProps>;
  /** Drawn above the content on each page (page numbers, a footer line). */
  Overlay?: ComponentType<CvBackgroundProps>;
};
