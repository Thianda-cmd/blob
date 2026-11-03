"use client";

// A spreadsheet opened from a note's block ("Öffnen", the address from sheetItemHref in
// src/sheet/embed.ts): the chart, smart table or cells the block shows are selected and in view,
// on their own sheet, and the address loses the parameter again.

import { useEffect } from "react";
import { embedTarget, itemFromParam, SHEET_ITEM_PARAM, type SheetEmbedItem } from "@/sheet/embed";
import { selectChart } from "../chart/selection";
import type { SheetStore } from "../store";

/**
 * Select what an embed shows: a chart (framed and scrolled into view), or a table's or range's
 * cells with the active cell at their top left (so a long table opens at its start, like Excel's
 * "Gehe zu"). false when it is gone from the spreadsheet.
 */
export function showEmbedItem(store: SheetStore, item: SheetEmbedItem): boolean {
  const target = embedTarget(store.get().workbook, item);
  if (target.kind === "gone") return false;
  if (target.kind === "chart") {
    if (!target.sheet) return false;
    store.setSheet(target.sheet.id);
    selectChart(store, target.chart.id, { reveal: true });
    return true;
  }
  const area = target.kind === "table" ? target.table.area : target.area;
  const sheet = target.sheet;
  const r1 = Math.min(area.r1, sheet.size.rows - 1);
  const c1 = Math.min(area.c1, sheet.size.cols - 1);
  if (area.r0 > r1 || area.c0 > c1) return false;
  store.setSheet(sheet.id);
  const start = { row: area.r0, col: area.c0 };
  const one = area.r0 === r1 && area.c0 === c1;
  // The range stays selected while the active cell sits at its start (Enter walks through it).
  store.select(one ? start : { anchor: start, focus: start, extra: [{ r0: area.r0, c0: area.c0, r1, c1 }] });
  return true;
}

/** Carry out the ?sheetItem= request of the address once the spreadsheet is on screen. */
export function useOpenEmbedItem(store: SheetStore) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(SHEET_ITEM_PARAM);
    if (raw === null) return;
    // The History API keeps Next's router in step without asking the server for the page again.
    params.delete(SHEET_ITEM_PARAM);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const item = itemFromParam(raw);
    if (item) showEmbedItem(store, item);
  }, [store]);
}
