"use client";

// A chart drawn in SVG: axes with clean ticks (linear or logarithmic), grid lines, series as
// points, lines, columns, bars, areas or a pie, error bars, trendlines with their equation and
// R², legend and title. Used in the spreadsheet, in notes (embedded) and for exports.
//
// CONTRACT: keep the props; add optional ones if needed.

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { ChartSpec } from "../types";
import type { ChartData } from "./data";

export type ChartViewProps = {
  spec: ChartSpec;
  data: ChartData;
  width: number;
  height: number;
  locale: Locale;
  /** Fixed colours for an export (no CSS variables); default: follows the page's theme. */
  theme?: "light" | "dark";
  /** Show values on hover/tap. */
  interactive?: boolean;
  /** Highlight one series (its settings are open). */
  selectedSeries?: string | null;
  className?: string;
};

export function ChartView(props: ChartViewProps): ReactNode {
  void props;
  return null;
}
