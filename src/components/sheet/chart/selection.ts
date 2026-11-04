"use client";

// Which chart is selected on the sheet (frame, handles, action bar), which series the panel is
// about, and which panel section to show. Kept per editor store, next to it rather than in it:
// it is the charts' own screen state, not part of the document or its undo.

import { useSyncExternalStore } from "react";
import type { SheetStore } from "../store";

export type ChartSection = "chart" | "data" | "trend" | "errors" | "axes" | "look";

export type ChartUi = {
  /** The chart selected on the sheet. */
  selected: string | null;
  /** The series whose settings the panel shows (highlighted in the chart). */
  series: string | null;
  /** A section the panel should open and scroll to (the action bar's "Trendlinie"). */
  section: ChartSection | null;
  /** Counts requests to scroll a chart into view (a chart just inserted, duplicated or opened from a note). */
  reveal: number;
  /** The chart the latest of those requests was for (selecting another chart later doesn't scroll). */
  revealId: string | null;
  /**
   * Whether the chart whose settings are open can be seen on the sheet: ChartLayer measures it
   * before the settings are first painted, and again when the grid has scrolled. Its panel shows
   * a copy of the chart while it can't (covered by the docked settings, or scrolled away); null
   * until measured, and the panel shows no copy until then.
   */
  inView: { id: string; shown: boolean } | null;
};

type Entry = { value: ChartUi; listeners: Set<() => void> };

const EMPTY: ChartUi = { selected: null, series: null, section: null, reveal: 0, revealId: null, inView: null };
const entries = new WeakMap<SheetStore, Entry>();

function entry(store: SheetStore): Entry {
  let e = entries.get(store);
  if (!e) {
    e = { value: EMPTY, listeners: new Set() };
    entries.set(store, e);
  }
  return e;
}

export const chartUi = (store: SheetStore): ChartUi => entry(store).value;

export function setChartUi(store: SheetStore, patch: Partial<ChartUi>) {
  const e = entry(store);
  const next = { ...e.value, ...patch };
  if ((Object.keys(next) as (keyof ChartUi)[]).every((k) => next[k] === e.value[k])) return;
  e.value = next;
  for (const l of [...e.listeners]) l();
}

export function useChartUi(store: SheetStore): ChartUi {
  const e = entry(store);
  return useSyncExternalStore(
    (l) => {
      e.listeners.add(l);
      return () => e.listeners.delete(l);
    },
    () => e.value,
    () => EMPTY,
  );
}

/**
 * What the grid shows, for putting a new chart where it can be seen (insertChart). Registered by
 * ChartLayer while the grid is on screen; px are the grid's content px (GridGeometry, zoomed).
 */
export type ChartViewport = {
  /** The visible part of the scrolling cells, left to right. */
  left: number;
  right: number;
  /** A column's left edge. */
  colX: (col: number) => number;
  /** A row's top edge. */
  rowY: (row: number) => number;
  zoom: number;
  /** How much narrower the grid gets when the chart's settings open beside it (0 when they are open already or dock below). */
  sidePanel: number;
};

const viewports = new WeakMap<SheetStore, () => ChartViewport | null>();

export function setChartViewport(store: SheetStore, measure: (() => ChartViewport | null) | null) {
  if (measure) viewports.set(store, measure);
  else viewports.delete(store);
}

/** The grid's visible part now (null when no grid is on screen). */
export function chartViewport(store: SheetStore): ChartViewport | null {
  try {
    return viewports.get(store)?.() ?? null;
  } catch {
    return null;
  }
}

/** Select a chart on the sheet; `reveal` scrolls it into view. */
export function selectChart(store: SheetStore, id: string | null, opts: { reveal?: boolean } = {}) {
  const cur = chartUi(store);
  setChartUi(store, {
    selected: id,
    reveal: opts.reveal ? cur.reveal + 1 : cur.reveal,
    revealId: opts.reveal ? id : cur.revealId,
    series: id === cur.selected ? cur.series : null,
  });
}
