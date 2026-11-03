"use client";

// Reading an Excel (.xlsx) or CSV file for the spreadsheet: as new sheets of the workbook that is
// open ("Excel- oder CSV-Datei importieren"), or as a new spreadsheet page (the notes' import,
// src/components/notes/transfer.ts).
//
// The reading itself (src/sheet/io/readFile.ts) runs in a Web Worker: a file of a few hundred
// kilobytes can unpack to gigabytes or hold millions of cells, and the editor must stay usable
// meanwhile. A worker that takes longer than READ_LIMIT_MS is stopped. Where workers don't
// start (an old browser, the check script), the page reads the file itself; the reader's own
// limits keep that bounded too.

import type { Locale } from "@/i18n/config";
import { sheetIoText } from "@/i18n/messages/sheetIo";
import { normalizeWorkbook, workbookPreview } from "@/sheet/doc";
import { createCalc, type Calc } from "@/sheet/engine";
import { MAX_SHEETS, readSheetBytes, type ReadJob, type ReadOptions, type ReadReply, type ReadSheetFile } from "@/sheet/io/readFile";
import { renameSheet, uniqueSheetName } from "@/sheet/ops";
import { uniqueTableName } from "@/sheet/table/model";
import type { Workbook } from "@/sheet/types";
import { jsonBytes, storedContent } from "./saver";

export { freshIds, MAX_SHEETS, type ReadProblem, type ReadSheetFile } from "@/sheet/io/readFile";

/** Bigger files aren't read (a spreadsheet page holds at most 5 MB anyway). */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/**
 * What the file picker offers. ".xls" too: photometers and web tools save CSV text or an HTML
 * table under that name (a real old Excel file gets a message saying how to save it).
 */
export const SHEET_FILE_ACCEPT = [
  ".xlsx",
  ".xls",
  ".csv",
  ".tsv",
  ".txt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
].join(",");

/** How long reading may take before the worker is stopped (a real file needs a few seconds at most). */
const READ_LIMIT_MS = 30_000;
/** How long the worker may take to start (the first time it is loaded, or compiled in development). */
const START_LIMIT_MS = 20_000;

/** How many more sheets fit into a workbook (pass as `sheetRoom` when adding a file's sheets to it). */
export const sheetRoom = (wb: Workbook) => Math.max(0, MAX_SHEETS - wb.sheets.length);

/**
 * Read an .xlsx, CSV or text file into a workbook of its own. `sheetRoom`: how many sheets may
 * come in (see sheetRoom()); 250 for a new spreadsheet.
 */
export async function readSheetFile(file: File, locale: Locale, opts: ReadOptions = {}): Promise<ReadSheetFile> {
  if (file.size > MAX_IMPORT_BYTES) return { error: "tooBig" };
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch (e) {
    console.error("sheet: reading the file failed", e);
    return { error: "failed" };
  }
  const job: ReadJob = { bytes, name: file.name, locale, opts };
  return (await readInWorker(job)) ?? readSheetBytes(new Uint8Array(bytes), file.name, locale, opts);
}

/** The file read by a worker; null when no worker could start (the caller reads it itself then). */
function readInWorker(job: ReadJob): Promise<ReadSheetFile | null> {
  if (typeof Worker === "undefined") return Promise.resolve(null);
  let worker: Worker;
  try {
    worker = new Worker(new URL("../../sheet/io/readFile.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let started = false;
    const finish = (result: ReadSheetFile | null) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    let timer = setTimeout(() => finish(null), START_LIMIT_MS);
    worker.onmessage = (e: MessageEvent<ReadReply>) => {
      if ("result" in e.data) return finish(e.data.result);
      started = true;
      clearTimeout(timer);
      timer = setTimeout(() => finish({ error: "slow", message: sheetIoText[job.locale].errors.slow }), READ_LIMIT_MS);
      // A copy, not a transfer: should the worker fail after all, the bytes are still here.
      worker.postMessage(job);
    };
    // Before "ready" the worker couldn't load (the page reads the file then); after it, reading
    // itself failed (likely out of memory, which reading again on the page would only repeat).
    worker.onerror = (e) => {
      e.preventDefault();
      finish(started ? { error: "failed" } : null);
    };
    worker.onmessageerror = () => finish({ error: "failed" });
  });
}

/**
 * Another workbook's sheets (with their charts and tables) added after the sheets of `wb`. Sheet
 * names that are taken get a number ("Blatt 1 (2)"), and the added sheets' formulas follow the
 * new names; table names stay unique. `extra` must already have ids of its own (freshIds). Only
 * the sheets that fit come along (250 in all; a file read with sheetRoom has no more).
 */
export function appendWorkbook(wb: Workbook, extra: Workbook, locale: Locale): Workbook {
  const room = sheetRoom(wb);
  if (!room) return wb;
  let incoming = extra;
  if (extra.sheets.length > room) {
    const fits = new Set(extra.sheets.slice(0, room).map((s) => s.id));
    incoming = { ...extra, sheets: extra.sheets.filter((s) => fits.has(s.id)), charts: extra.charts.filter((c) => fits.has(c.sheetId)), tables: extra.tables.filter((t) => fits.has(t.sheetId)) };
  }
  for (const s of [...incoming.sheets]) {
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
 * with its preview for lists and its words for search, and its size as saving measures it. A page
 * over MAX_SHEET_BYTES could never be saved again: the importers refuse it before making the page.
 */
export function sheetPageContent(raw: unknown, locale: Locale): { content: unknown; plain_text: string; bytes: number } {
  const wb = normalizeWorkbook(raw, locale);
  const { content, plain } = storedContent(wb, createCalc(wb, { locale }), locale);
  return { content, plain_text: plain, bytes: jsonBytes(content) };
}

/**
 * The size `next` (the open workbook with a file's sheets added after its own, appendWorkbook)
 * would be saved with, measured as saving measures it. Its preview is the first sheet's, which an
 * import doesn't change, so the open calculation is enough (nothing is recalculated).
 */
export function importedBytes(next: Workbook, calc: Calc, locale: Locale): number {
  return jsonBytes({ ...next, preview: workbookPreview(next, calc, locale) });
}

export { MAX_BYTES as MAX_SHEET_BYTES } from "./saver";
