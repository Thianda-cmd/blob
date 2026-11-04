// Smart table actions the toolbar and context menu call.
//
// CONTRACT: keep names and signatures.
//
// Each change is one undo step with its own name ("Tabelle sortieren"); the store's undo covers
// all of them. Messages for things that can't be done appear at the bottom of the editor
// (../notice.ts), so callers don't need to show anything themselves.

import { sheetTableText } from "@/i18n/messages/sheetTable";
import type { Locale } from "@/i18n/config";
import {
  clearTableFilters,
  dataRows,
  deleteTable,
  makeTableWith,
  setColumnTotal,
  setTableFilter,
  setTableLook,
  setTotals,
  sortTable,
  tableAt,
  tableById,
  unmakeTable,
} from "@/sheet/table/model";
import type { Area, FilterSpec, TableSpec, TotalFn } from "@/sheet/types";
import { insertChart } from "../chart/actions";
import { showSheetNotice } from "../notice";
import { activeArea, type SheetStore } from "../store";
import { freshTable, setFreshTable } from "./notice";

const textOf = (store: SheetStore) => sheetTableText[store.get().locale];
const localeOf = (store: SheetStore): Locale => store.get().locale;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const within = (a: Area, b: Area) => a.r0 >= b.r0 && a.r1 <= b.r1 && a.c0 >= b.c0 && a.c1 <= b.c1;

/** Turn the selection into a smart table, select it and open its panel. false when it can't (overlaps another table, nothing there). */
export function makeTableFromSelection(store: SheetStore): boolean {
  const s = store.get();
  if (s.readOnly) return false;
  const area = activeArea(s.selection);
  const inside = tableAt(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col);
  if (inside && within(area, inside.area)) {
    // Already a table (Ctrl+T inside one): its settings instead of a second table.
    store.setFocus({ kind: "table", id: inside.id });
    return true;
  }
  return createTable(store, area, "auto");
}

/** Make a table of `area` on the sheet on screen, as one undo step; select it and open its panel. */
function createTable(store: SheetStore, area: Area, header: "auto" | "yes" | "no"): boolean {
  const s = store.get();
  const t = sheetTableText[s.locale];
  const r = makeTableWith(s.workbook, s.calc, s.sheetId, area, s.locale, { header });
  if ("error" in r) {
    // Overlapping another table is a clash to sort out; an empty selection only needs a hint.
    showSheetNotice(store, t.errors[r.error], r.error === "overlap" ? "error" : "info");
    return false;
  }
  const before = s.workbook;
  const selection = s.selection;
  store.apply(t.undo.make, (wb) => (wb === before ? r.wb : wb));
  const after = store.get().workbook;
  if (after === before || !after.tables.some((x) => x.id === r.tableId)) return false;
  // The whole table selected, the active cell where it was (a row lower when the data moved down
  // to make room for the header).
  const a = r.area;
  const p = selection.anchor;
  const row = clamp(p.row + (r.moved && p.row >= a.r0 && p.col >= a.c0 && p.col <= a.c1 ? 1 : 0), a.r0, a.r1);
  const col = clamp(p.col, a.c0, a.c1);
  store.select({ anchor: { row, col }, focus: { row, col }, extra: [a] });
  setFreshTable(store, { tableId: r.tableId, header: r.header, sheetId: s.sheetId, area, selection, before, after: store.get().workbook });
  store.setFocus({ kind: "table", id: r.tableId });
  return true;
}

/**
 * Right after making a table: make it again with the other choice for its first row (the header,
 * or data under a new header row). Only while nothing else has changed since.
 */
export function switchTableHeader(store: SheetStore, tableId: string): boolean {
  const f = freshTable(store, tableId);
  if (!f) return false;
  store.undo();
  if (store.get().workbook !== f.before) return false;
  store.select(f.selection);
  return createTable(store, f.area, f.header === "found" ? "no" : "yes");
}

/** Undo making a table, right after (the panel's "Rückgängig"). */
export function undoMakeTable(store: SheetStore, tableId: string) {
  if (!freshTable(store, tableId)) return;
  setFreshTable(store, null);
  store.undo();
}

/** The table the active cell is in. */
export function tableAtSelection(store: SheetStore): TableSpec | undefined {
  const s = store.get();
  return tableAt(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col);
}

/** Open a table's settings (side panel, or a bottom sheet on phones). */
export function openTablePanel(store: SheetStore, tableId: string) {
  const table = tableById(store.get().workbook, tableId);
  if (!table) return;
  if (store.get().sheetId !== table.sheetId) store.setSheet(table.sheetId);
  store.setFocus({ kind: "table", id: tableId });
}

export function sortTableColumn(store: SheetStore, tableId: string, columnId: string, dir: "asc" | "desc") {
  const locale = localeOf(store);
  store.apply(textOf(store).undo.sort, (wb, calc) => sortTable(wb, calc, tableId, columnId, dir, locale));
}

/** Set (or with null clear) one column's filter. */
export function filterTableColumn(store: SheetStore, tableId: string, columnId: string, filter: FilterSpec | null) {
  const t = textOf(store);
  store.apply(filter ? t.undo.filter : t.undo.clearFilter, (wb) => setTableFilter(wb, tableId, columnId, filter));
}

export function clearAllTableFilters(store: SheetStore, tableId: string) {
  store.apply(textOf(store).undo.clearFilters, (wb) => clearTableFilters(wb, tableId));
}

/** The totals row on or off. */
export function setTableTotals(store: SheetStore, tableId: string, on: boolean) {
  const locale = localeOf(store);
  store.apply(textOf(store).undo.totals, (wb, calc) => setTotals(wb, calc, tableId, on, locale));
}

/** One column's function in the totals row. */
export function setTableColumnTotal(store: SheetStore, tableId: string, columnId: string, fn: TotalFn) {
  const locale = localeOf(store);
  store.apply(textOf(store).undo.total, (wb, calc) => setColumnTotal(wb, tableId, columnId, fn, locale, calc));
}

/** Name, colour or banding (one undo step each, named after what changed). */
export function changeTableLook(store: SheetStore, tableId: string, patch: Partial<Pick<TableSpec, "name" | "style" | "banded">>) {
  const t = textOf(store);
  const label = patch.name !== undefined ? t.undo.name : patch.style !== undefined ? t.undo.style : t.undo.banded;
  store.apply(label, (wb) => setTableLook(wb, tableId, patch));
}

/** Back to plain cells ("In Bereich umwandeln"). */
export function convertTableToRange(store: SheetStore, tableId: string) {
  store.apply(textOf(store).undo.unmake, (wb) => unmakeTable(wb, tableId));
  if (store.get().focus?.id === tableId) store.setFocus(null);
}

/** The table and its cells gone. */
export function deleteTableWithCells(store: SheetStore, tableId: string) {
  store.apply(textOf(store).undo.remove, (wb) => deleteTable(wb, tableId));
  if (store.get().focus?.id === tableId) store.setFocus(null);
}

/**
 * A chart of the table: its header and data rows selected, then the chart is made like from any
 * selection (numbers or times in the first column, or sample names followed by at least four numbers
 * that only rise or only fall, give a scatter chart; see src/sheet/chart/create.ts). Opens the chart's
 * panel.
 */
export function chartFromTable(store: SheetStore, tableId: string): boolean {
  const table = tableById(store.get().workbook, tableId);
  if (!table || store.get().readOnly) return false;
  if (store.get().sheetId !== table.sheetId) store.setSheet(table.sheetId);
  const d = dataRows(table);
  store.select({ r0: table.area.r0, c0: table.area.c0, r1: Math.max(table.area.r0, d.r1), c1: table.area.c1 });
  const ok = insertChart(store);
  if (!ok) showSheetNotice(store, textOf(store).noChart);
  return ok;
}
