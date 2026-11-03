// Chart actions the toolbar, context menu and smart tables call.
//
// CONTRACT: keep names and signatures.

import { sheetChartText } from "@/i18n/messages/sheetChart";
import { cellKey } from "@/sheet/a1";
import { chartFromAreas, chartSourceAreas } from "@/sheet/chart/create";
import { chartData, type ChartData } from "@/sheet/chart/data";
import { saveChart } from "@/sheet/chart/export";
import { newId, putChart, removeChart } from "@/sheet/ops";
import type { ChartKind, ChartSpec, TrendlineSpec } from "@/sheet/types";
import { selectionAreas, type SheetStore } from "../store";
import { chartViewport, selectChart, setChartUi, type ChartViewport } from "./selection";

/** Gap between a new chart and its data when the usual empty column doesn't leave room for it (logical px). */
const CLOSE_GAP = 16;

/**
 * A new chart goes beside its data with one empty column between them (chartFromAreas). When it
 * wouldn't fit on screen that way (the settings that open with it take room too), it goes right
 * next to the data instead, a little gap away: on a laptop at 1440 px with the sidebar open chart
 * and data are then both in view, and on a narrower screen more of the chart shows.
 */
export function placeInView(spec: ChartSpec, view: ChartViewport | null, freeColumn: (col: number) => boolean = () => true): ChartSpec {
  if (!view || spec.at.col < 1 || !freeColumn(spec.at.col - 1)) return spec;
  const width = spec.size.w * view.zoom;
  const right = view.right - view.sidePanel;
  const usual = view.colX(spec.at.col) + spec.at.dx * view.zoom;
  if (usual + width <= right || usual < view.left) return spec;
  const close = view.colX(spec.at.col - 1) + CLOSE_GAP * view.zoom;
  if (close < view.left || close >= usual) return spec;
  return { ...spec, at: { ...spec.at, col: spec.at.col - 1, dx: CLOSE_GAP } };
}

/** A chart from the current selection (or the smart table the selection is in): added, selected, its panel opened. false when there is nothing to chart. */
export function insertChart(store: SheetStore, kind?: ChartKind): boolean {
  const state = store.get();
  if (state.readOnly) return false;
  // Ctrl-selected areas left to right, whatever order they were picked in: the leftmost column is x.
  const areas = [...selectionAreas(state.selection)].sort((a, b) => a.c0 - b.c0 || a.r0 - b.r0);
  const made = chartFromAreas(state.workbook, state.calc, state.sheetId, chartSourceAreas(state.workbook, state.sheetId, areas), state.locale, kind);
  if (!made) return false;
  // The empty column it would cover instead must be empty beside the chart (about 30 rows).
  const sheet = state.workbook.sheets.find((x) => x.id === state.sheetId);
  const freeColumn = (col: number) => {
    for (let r = made.at.row; r < made.at.row + 30; r++) {
      const c = sheet?.cells[cellKey(r, col)];
      if (c && ((c.v !== undefined && c.v !== "") || c.f !== undefined)) return false;
    }
    return true;
  };
  const spec = placeInView(made, chartViewport(store), freeColumn);
  store.apply(sheetChartText[state.locale].undo.insert, (wb) => putChart(wb, spec));
  if (!store.get().workbook.charts.some((c) => c.id === spec.id)) return false;
  selectChart(store, spec.id, { reveal: true });
  setChartUi(store, { section: null, series: null });
  store.setFocus({ kind: "chart", id: spec.id });
  return true;
}

// ----------------------------------------------------------------------------------------------
// Shared by the chart's card on the sheet and its panel

const textOf = (store: SheetStore) => sheetChartText[store.get().locale];

/** Change one chart (read fresh from the store, so nothing else is lost), as one undo step. */
export function updateChart(store: SheetStore, chartId: string, label: string, change: (c: ChartSpec) => ChartSpec) {
  store.apply(label, (wb) => {
    const c = wb.charts.find((x) => x.id === chartId);
    if (!c) return wb;
    const next = change(c);
    return next === c ? wb : putChart(wb, next);
  });
}

export function deleteChart(store: SheetStore, chartId: string) {
  store.apply(textOf(store).undo.remove, (wb) => removeChart(wb, chartId));
  if (store.get().focus?.id === chartId) store.setFocus(null);
  selectChart(store, null);
}

/** A copy a little below and right of it (new ids for it and its series), selected. */
export function duplicateChart(store: SheetStore, chartId: string): string | null {
  const c = store.get().workbook.charts.find((x) => x.id === chartId);
  if (!c) return null;
  const copy: ChartSpec = { ...c, id: newId(), at: { ...c.at, dx: c.at.dx + 24, dy: c.at.dy + 24 }, series: c.series.map((s) => ({ ...s, id: newId() })) };
  store.apply(textOf(store).undo.duplicate, (wb) => putChart(wb, copy));
  if (!store.get().workbook.charts.some((x) => x.id === copy.id)) return null;
  selectChart(store, copy.id, { reveal: true });
  return copy.id;
}

/** Excel's everyday trendline: linear, with the equation and R² on the chart. */
export const LINEAR_TRENDLINE: TrendlineSpec = { type: "linear", order: 2, period: 2, intercept: null, showEquation: true, showR2: true, forward: 0, backward: 0, name: "" };

/**
 * One tap for a trendline: a linear one with equation and R² on the first series without one.
 * When every series has one already, the panel opens at the trendline settings instead.
 */
export function quickTrendline(store: SheetStore, chartId: string): "added" | "opened" | "none" {
  const c = store.get().workbook.charts.find((x) => x.id === chartId);
  if (!c || c.kind === "pie" || !c.series.length) return "none";
  const target = c.series.find((s) => !s.trendline);
  if (target && !store.get().readOnly) {
    updateChart(store, chartId, textOf(store).undo.trend, (spec) => ({
      ...spec,
      series: spec.series.map((s) => (s.id === target.id ? { ...s, trendline: { ...LINEAR_TRENDLINE } } : s)),
    }));
    setChartUi(store, { series: target.id });
    return "added";
  }
  setChartUi(store, { section: "trend", series: c.series[0].id });
  store.setFocus({ kind: "chart", id: chartId });
  return "opened";
}

/** Open a chart's settings (optionally at a section). */
export function openChartPanel(store: SheetStore, chartId: string, section?: "trend" | "data" | "chart") {
  selectChart(store, chartId);
  if (section) setChartUi(store, { section });
  store.setFocus({ kind: "chart", id: chartId });
}

/** The chart's data now (empty when its cells can't be read). */
export function currentChartData(store: SheetStore, spec: ChartSpec): ChartData {
  const s = store.get();
  try {
    return chartData(spec, s.calc, s.locale);
  } catch (err) {
    console.error("chart data", err);
    return { categories: [], series: [], xDecimals: null, yDecimals: null };
  }
}

/** Save a chart as a PNG or SVG file named after its title. */
export async function saveChartFile(store: SheetStore, chartId: string, format: "png" | "svg"): Promise<boolean> {
  const spec = store.get().workbook.charts.find((x) => x.id === chartId);
  if (!spec) return false;
  try {
    await saveChart(spec, currentChartData(store, spec), store.get().locale, format);
    return true;
  } catch (err) {
    console.error("chart export", err);
    return false;
  }
}
