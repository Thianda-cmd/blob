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
  /** Counts requests to scroll the selected chart into view (a chart just inserted). */
  reveal: number;
};

type Entry = { value: ChartUi; listeners: Set<() => void> };

const EMPTY: ChartUi = { selected: null, series: null, section: null, reveal: 0 };
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

/** Select a chart on the sheet; `reveal` scrolls it into view. */
export function selectChart(store: SheetStore, id: string | null, opts: { reveal?: boolean } = {}) {
  const cur = chartUi(store);
  setChartUi(store, { selected: id, reveal: opts.reveal ? cur.reveal + 1 : cur.reveal, series: id === cur.selected ? cur.series : null });
}
