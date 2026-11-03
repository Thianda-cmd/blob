"use client";

// Reading an Excel (.xlsx) or CSV file for the spreadsheet: as new sheets of the workbook that is
// open ("Excel- oder CSV-Datei importieren"), or as a new spreadsheet page (the notes' import,
// src/components/notes/transfer.ts). The .xlsx reader is loaded only when a file needs it.
//
// CSV files from German Excel are often saved in Windows-1252, not UTF-8: when UTF-8 gives
// broken characters, the file is read again that way, so "Ä", "µ" and "°C" come through.

import type { Locale } from "@/i18n/config";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import { csvNumberLocale, parseCsv } from "@/sheet/io/csv";
import { newId, pasteText, renameSheet, uniqueSheetName } from "@/sheet/ops";
import { uniqueTableName } from "@/sheet/table/model";
import { DEFAULT_SIZE, MAX_COLS, MAX_ROWS, type ChartSpec, type RangeRef, type Sheet, type TableSpec, type Workbook } from "@/sheet/types";
import { storedContent } from "./saver";

/** Bigger files aren't read (a spreadsheet page holds at most 5 MB anyway). */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** What the file picker offers. */
export const SHEET_FILE_ACCEPT = [
  ".xlsx",
  ".csv",
  ".tsv",
  ".txt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/tab-separated-values",
].join(",");

export type ReadProblem = "tooBig" | "oldXls" | "empty" | "failed";

/** A file read into a workbook of its own (fresh ids), and what couldn't come along. */
export type ReadSheetFile = { workbook: Workbook; skipped: string[]; cutRows: number | null; kind: "xlsx" | "csv"; name: string } | { error: ReadProblem };

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").trim();

/**
 * What kind of file it is, by its first bytes (a zip is an .xlsx, an old Office file is an .xls),
 * else by its name: anything else is read as text (CSV). (Windows calls CSV files
 * "application/vnd.ms-excel", so the type alone says little.)
 */
async function fileKind(file: File): Promise<"xlsx" | "xls" | "text"> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return "xlsx";
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "xls";
  if (/\.xls$/i.test(file.name)) return "xls";
  return "text";
}

/** The file's text: UTF-8, or Windows-1252 when UTF-8 doesn't fit. */
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8;
  }
}

const blankSheet = (id: string, name: string): Sheet => ({ id, name, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: DEFAULT_SIZE.rows, cols: DEFAULT_SIZE.cols } });

/** Read an .xlsx or CSV file. */
export async function readSheetFile(file: File, locale: Locale): Promise<ReadSheetFile> {
  if (file.size > MAX_IMPORT_BYTES) return { error: "tooBig" };
  const name = baseName(file.name) || "Import";
  try {
    const kind = await fileKind(file);
    if (kind === "xls") return { error: "oldXls" };
    if (kind === "xlsx") {
      const { importXlsx } = await import("@/sheet/io/xlsx");
      const { workbook, skipped } = await importXlsx(await file.arrayBuffer(), locale);
      if (!workbook.sheets.length) return { error: "empty" };
      return { workbook: freshIds(workbook), skipped, cutRows: null, kind: "xlsx", name };
    }
    let rows = parseCsv(await readText(file));
    if (!rows.length || rows.every((r) => r.every((c) => !c.trim()))) return { error: "empty" };
    const cutRows = rows.length > MAX_ROWS ? MAX_ROWS : null;
    rows = rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS));
    const id = newId();
    const sheetName = name.replace(/[[\]:*?/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || (locale === "de" ? "Blatt 1" : "Sheet 1");
    // Numbers are read in the language the file writes them in: an English lab CSV opened in
    // German keeps 0.123 as 0,123 (not 123).
    const wb = pasteText({ v: 1, sheets: [blankSheet(id, sheetName)], charts: [], tables: [] }, id, { row: 0, col: 0 }, rows, csvNumberLocale(rows, locale));
    return { workbook: wb, skipped: [], cutRows, kind: "csv", name };
  } catch (e) {
    console.error("sheet: reading the file failed", e);
    return { error: "failed" };
  }
}

/** The same workbook with new ids for its sheets, charts, series, tables and columns (references follow). */
export function freshIds(wb: Workbook): Workbook {
  const sheetIds = new Map(wb.sheets.map((s) => [s.id, newId()]));
  const sid = (id: string) => sheetIds.get(id) ?? id;
  const ref = <T extends RangeRef | null>(r: T): T => (r ? ({ ...r, sheetId: sid(r.sheetId) } as T) : r);
  const sheets = wb.sheets.map((s) => ({ ...s, id: sid(s.id) }));
  const charts: ChartSpec[] = wb.charts.map((c) => ({
    ...c,
    id: newId(),
    sheetId: sid(c.sheetId),
    x: ref(c.x),
    series: c.series.map((s) => ({
      ...s,
      id: newId(),
      y: ref(s.y),
      x: ref(s.x),
      nameRef: ref(s.nameRef),
      errorBars: s.errorBars ? { ...s.errorBars, plus: ref(s.errorBars.plus), minus: ref(s.errorBars.minus) } : null,
    })),
  }));
  const tables: TableSpec[] = wb.tables.map((t) => {
    const cols = new Map(t.columns.map((c) => [c.id, newId()]));
    return {
      ...t,
      id: newId(),
      sheetId: sid(t.sheetId),
      columns: t.columns.map((c) => ({ ...c, id: cols.get(c.id)! })),
      filters: Object.fromEntries(Object.entries(t.filters).map(([k, f]) => [cols.get(k) ?? k, f])),
      sort: t.sort ? { ...t.sort, column: cols.get(t.sort.column) ?? t.sort.column } : null,
    };
  });
  return { v: 1, sheets, charts, tables };
}

/**
 * Another workbook's sheets (with their charts and tables) added after the sheets of `wb`. Sheet
 * names that are taken get a number ("Blatt 1 (2)"), and the added sheets' formulas follow the
 * new names; table names stay unique. `extra` must already have ids of its own (freshIds).
 */
export function appendWorkbook(wb: Workbook, extra: Workbook, locale: Locale): Workbook {
  let incoming = extra;
  for (const s of extra.sheets) {
    const current = incoming.sheets.find((x) => x.id === s.id);
    if (!current) continue;
    const others: Workbook = { ...wb, sheets: [...wb.sheets, ...incoming.sheets.filter((x) => x.id !== s.id)] };
    const name = uniqueSheetName(others, current.name);
    if (name !== current.name) {
      // Renamed inside the incoming workbook first, so its own formulas follow.
      const temp = renameSheet(incoming, s.id, name);
      incoming = temp !== incoming ? temp : { ...incoming, sheets: incoming.sheets.map((x) => (x.id === s.id ? { ...x, name } : x)) };
    }
  }
  let next: Workbook = { ...wb, sheets: [...wb.sheets, ...incoming.sheets], charts: [...wb.charts, ...incoming.charts] };
  for (const t of incoming.tables) next = { ...next, tables: [...next.tables, { ...t, name: uniqueTableName(next, locale, t.name) }] };
  return next;
}

/**
 * What a new spreadsheet page stores for a workbook (or stored JSON from a Blob file): read safely,
 * with its preview for lists and its words for search.
 */
export function sheetPageContent(raw: unknown, locale: Locale): { content: unknown; plain_text: string } {
  const wb = normalizeWorkbook(raw, locale);
  const { content, plain } = storedContent(wb, createCalc(wb, { locale }), locale);
  return { content, plain_text: plain };
}
