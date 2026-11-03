"use client";

// A chart's settings: type, data (series, x values, names), trendline (type, order, intercept,
// equation, R², forecast), error bars, axes (titles, min/max, log scale, grid), look, legend;
// export as PNG/SVG; add to a note. Side panel on wide screens, bottom sheet on phones (SheetEditor decides).
//
// CONTRACT: <ChartPanel store chartId onClose /> is placed by SheetEditor.

import type { ReactNode } from "react";
import type { SheetStore } from "../store";

export function ChartPanel({ store, chartId, onClose }: { store: SheetStore; chartId: string; onClose: () => void }): ReactNode {
  void store;
  void chartId;
  void onClose;
  return null;
}
