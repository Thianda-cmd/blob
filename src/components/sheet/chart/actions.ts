// Chart actions the toolbar, context menu and smart tables call.
//
// CONTRACT: keep names and signatures.

import { sheetChartText } from "@/i18n/messages/sheetChart";
import { cellKey, normArea } from "@/sheet/a1";
import { chartFromAreas, chartSourceAreas, currentRegion } from "@/sheet/chart/create";
import { chartData, type ChartData } from "@/sheet/chart/data";
import { saveChart } from "@/sheet/chart/export";
import { newId, putChart, removeChart, sheetById } from "@/sheet/ops";
import type { Area, ChartKind, ChartSpec, RangeRef, TrendlineSpec, Workbook } from "@/sheet/types";
import { selectionAreas, type SheetStore } from "../store";
import { chartViewport, selectChart, setChartUi, type ChartViewport } from "./selection";

/** Gap between a new chart and its data when the usual empty column doesn't leave room for it (logical px). */
const CLOSE_GAP = 16;
/** On a grid where less than this share of a new chart's width can show beside its data, it goes below the data instead, if more of it shows there. */
const BESIDE_MIN = 0.5;

/** The ranges a chart reads on its own sheet: values, x values, series names. */
function ownRanges(spec: ChartSpec): RangeRef[] {
  return [spec.x, ...spec.series.flatMap((s) => [s.y, s.x, s.nameRef])].filter((r): r is RangeRef => !!r && r.sheetId === spec.sheetId);
}

const inArea = (row: number, col: number, a: Area) => row >= a.r0 && row <= a.r1 && col >= a.c0 && col <= a.c1;
const union = (a: Area | null, b: Area): Area =>
  a ? { r0: Math.min(a.r0, b.r0), c0: Math.min(a.c0, b.c0), r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1) } : { ...b };

/**
 * The block of cells a chart is made from as the student sees it: its values, x values and names
 * with the labels and headers around them (the filled cells around each range, and the smart
 * table it lies in). Opening the chart's settings keeps its left and top edges in view. null when
 * the chart reads nothing on its own sheet.
 */
export function chartDataBlock(wb: Workbook, spec: ChartSpec): Area | null {
  const sheet = sheetById(wb, spec.sheetId);
  if (!sheet) return null;
  let block: Area | null = null;
  const regions: Area[] = [];
  for (const ref of ownRanges(spec)) {
    const a = normArea(ref);
    block = union(block, a);
    // A range that starts in a block of filled cells found already lies in that same block (it is
    // bounded by empty cells all round): a logger's 20 000 rows are walked once, not per series.
    if (!regions.some((g) => inArea(a.r0, a.c0, g))) {
      const g = currentRegion(sheet, a.r0, a.c0);
      regions.push(g);
      block = union(block, g);
    }
    const table = wb.tables.find((t) => t.sheetId === spec.sheetId && inArea(a.r0, a.c0, t.area));
    if (table) block = union(block, table.area);
  }
  return block;
}

/**
 * The chart below its data, from the data's first column with one empty row between, on cells
 * that are empty (past the results under the data, a slope or R², when they are in the way).
 * null when no free place is near.
 */
function belowData(spec: ChartSpec, view: ChartViewport, data: Area, filled: (row: number, col: number) => boolean): ChartSpec | null {
  const width = spec.size.w * view.zoom;
  const height = spec.size.h * view.zoom;
  const x0 = view.colX(data.c0);
  let c1 = data.c0;
  while (c1 < data.c0 + 60 && view.colX(c1 + 1) < x0 + width) c1++;
  const rowFilled = (r: number) => {
    for (let c = data.c0; c <= c1; c++) if (filled(r, c)) return true;
    return false;
  };
  let row = data.r1 + 2;
  for (let tries = 0; tries < 5; tries++) {
    const y0 = view.rowY(row);
    let r1 = row;
    while (r1 < row + 200 && view.rowY(r1 + 1) < y0 + height) r1++;
    let last = -1;
    for (let r = row; r <= r1; r++) if (rowFilled(r)) last = r;
    if (last < 0) return { ...spec, at: { row, col: data.c0, dx: 0, dy: 0 } };
    // Past the cells in the way, with an empty row after them.
    row = last + 1;
    while (row < last + 200 && rowFilled(row)) row++;
    row++;
  }
  return null;
}

/**
 * A new chart goes beside its data with one empty column between them (chartFromAreas). When it
 * wouldn't fit on screen that way (the settings that open with it take room too), it goes right
 * next to the data instead, a little gap away: on a laptop at 1440 px with the sidebar open chart
 * and data are then both in view, and on a narrower screen more of the chart shows. On a grid so
 * narrow that not even half of it can show beside the data, even with the data at the grid's left
 * edge (a phone), it goes below the data when `below` says where the data is and which cells are
 * taken: there it is as wide as the screen allows, and scrolling down shows it. Not on a wider
 * grid: data that merely sits far right is scrolled to, and settings opening beside the grid take
 * its room only for a while; a chart below the data would cover the rows where more measurements go.
 */
export function placeInView(
  spec: ChartSpec,
  view: ChartViewport | null,
  freeColumn: (col: number) => boolean = () => true,
  below?: { data: Area; filled: (row: number, col: number) => boolean },
): ChartSpec {
  if (!view) return spec;
  const width = spec.size.w * view.zoom;
  const right = view.right - view.sidePanel;
  const usual = view.colX(spec.at.col) + spec.at.dx * view.zoom;
  if (usual + width <= right || usual < view.left) return spec;
  const close = spec.at.col >= 1 && freeColumn(spec.at.col - 1) ? view.colX(spec.at.col - 1) + CLOSE_GAP * view.zoom : null;
  const nearer = close !== null && close >= view.left && close < usual;
  const beside = nearer ? { ...spec, at: { ...spec.at, col: spec.at.col - 1, dx: CLOSE_GAP } } : spec;
  const x = nearer ? close : usual;
  if (x + width <= right) return beside;
  if (below) {
    // How much of the chart can show beside the data and below it, with the data at the grid's
    // left edge and no settings beside the grid.
    const room = view.right - view.left;
    const besideShare = Math.max(0, Math.min(1, (room - (x - view.colX(below.data.c0))) / width));
    const belowShare = Math.min(1, room / width);
    if (besideShare < BESIDE_MIN && belowShare >= besideShare + 0.25) {
      const low = belowData(spec, view, below.data, below.filled);
      if (low) return low;
    }
  }
  return beside;
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
  const hasContent = (r: number, col: number) => {
    const c = sheet?.cells[cellKey(r, col)];
    return !!c && ((c.v !== undefined && c.v !== "") || c.f !== undefined);
  };
  const freeColumn = (col: number) => {
    for (let r = made.at.row; r < made.at.row + 30; r++) if (hasContent(r, col)) return false;
    return true;
  };
  // Below the data, the chart covers only empty cells inside the sheet.
  const data = chartDataBlock(state.workbook, made);
  const filled = (r: number, col: number) => !sheet || r >= sheet.size.rows || col >= sheet.size.cols || hasContent(r, col);
  const spec = placeInView(made, chartViewport(store), freeColumn, data ? { data, filled } : undefined);
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
