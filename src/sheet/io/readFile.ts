// Reading a spreadsheet file into a workbook of its own: an Excel file (.xlsx), CSV or TSV text
// (also when it is called .xls, as photometers and web tools often save it), or an HTML table
// saved as .xls. What Blob can't keep is listed in `skipped` in the user's language, and the
// workbook is already what the saved page will hold: the limits a save applies
// (src/sheet/doc.ts normalizeWorkbook) are applied here and announced, not silently on reopening.
//
// The browser runs this in a Web Worker (readFile.worker.ts, started by
// src/components/sheet/importFile.ts), so a big or hostile file can't freeze the editor; Node
// (the check script) and browsers without workers run it directly.

import type { Locale } from "@/i18n/config";
import { sheetIoText } from "@/i18n/messages/sheetIo";
import { normalizeWorkbook } from "../doc";
import { MAX_FORMULA_LENGTH } from "../engine";
import { newId, pasteText } from "../ops";
import { DEFAULT_SIZE, MAX_COLS, MAX_ROWS, type ChartSpec, type RangeRef, type Sheet, type TableSpec, type Workbook } from "../types";
import { clipboardCells, parseHtmlTable, pasteExactNumbers, type CopiedCell } from "./clipboard";
import { csvNumberLocale, parseCsv } from "./csv";
import { FILE_LIMIT, MAX_IMPORT_TEXT, MAX_SHEETS } from "./limits";

export { MAX_SHEETS };

/**
 * Why a file wasn't read: too big to read at all, an old binary Excel file, nothing in it, it
 * took too long (the worker was stopped), no room for another sheet, or anything else.
 */
export type ReadProblem = "tooBig" | "oldXls" | "empty" | "failed" | "slow" | "full";

/**
 * A file read into a workbook of its own (fresh ids), and what couldn't come along; or why not,
 * with `message` saying it in the user's language when the reader knows more than the problem
 * (a password, a LibreOffice file, a damaged zip…).
 */
export type ReadSheetFile =
  | { workbook: Workbook; skipped: string[]; cutRows: number | null; kind: "xlsx" | "csv"; name: string }
  | { error: ReadProblem; message?: string };

/** `sheetRoom`: how many sheets may still be added (the spreadsheet the file goes into has the rest). */
export type ReadOptions = { sheetRoom?: number };

/** What the page sends the import's worker (readFile.worker.ts), and what comes back. */
export type ReadJob = { bytes: ArrayBuffer; name: string; locale: Locale; opts: ReadOptions };
export type ReadReply = { ready: true } | { result: ReadSheetFile };

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").trim();

/** The file's text: UTF-16 with its byte order mark, UTF-8, or Windows-1252 when UTF-8 doesn't fit. */
function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  // CSV files from German Excel are often Windows-1252: then "Ä", "µ" and "°C" come through.
  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8;
  }
}

/**
 * Text that is markup, not rows of values: an HTML page or XML (Excel 2003 XML, a LIMS export)
 * saved as .xls. Only what such files start with counts (a whole tag, which may run over several
 * lines like Excel's own <html xmlns:v=… xmlns:o=…>), so a first value like "<0,1", "<NWG" (below
 * the detection limit) or "<b>Probe</b>" is still data.
 */
const MARKUP = /^\s*<(?:!doctype\b|!--|\?xml\b|(?:html|head|body|table|meta|style|title|(?:\w+:)?workbook)\b[^<>]*>)/i;

const blankSheet = (id: string, name: string): Sheet => ({ id, name, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: DEFAULT_SIZE.rows, cols: DEFAULT_SIZE.cols } });

/**
 * Read a file's bytes. An .xlsx (or a zip or old Office file of another kind, which the Excel
 * reader explains), else text: CSV/TSV, or an HTML table. Never throws.
 */
export async function readSheetBytes(bytes: Uint8Array, fileName: string, locale: Locale, opts: ReadOptions = {}): Promise<ReadSheetFile> {
  const name = baseName(fileName) || "Import";
  const room = Math.min(MAX_SHEETS, opts.sheetRoom ?? MAX_SHEETS);
  const errors = sheetIoText[locale].errors;
  if (room < 1) return { error: "full", message: sheetIoText[locale].full(MAX_SHEETS) };
  try {
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    if (zip || ole) {
      // The .xlsx reader is loaded only when a file needs it.
      const { importXlsx, XlsxError } = await import("./xlsx");
      try {
        const { workbook, skipped } = await importXlsx(bytes, locale, { maxSheets: room });
        if (!workbook.sheets.length) return { error: "empty" };
        const kept = keepable(workbook, locale);
        if (cellText(kept.workbook) > MAX_IMPORT_TEXT) return { error: "tooBig", message: errors.tooBig };
        return { workbook: freshIds(kept.workbook), skipped: [...skipped, ...kept.lost], cutRows: null, kind: "xlsx", name };
      } catch (e) {
        if (!(e instanceof XlsxError)) throw e;
        return { error: e.code === "oldXls" ? "oldXls" : e.code === "tooBig" ? "tooBig" : "failed", message: e.message };
      }
    }

    const text = decodeText(bytes);
    let rows: string[][];
    let copied: (CopiedCell | null)[][] | null = null;
    if (MARKUP.test(text.slice(0, 2000))) {
      // A web page or XML: its table if it has one (web tools save HTML tables as .xls).
      const table = /<table[\s>]/i.test(text) ? parseHtmlTable(text, FILE_LIMIT) : null;
      if (!table) return { error: "failed", message: errors.notTable };
      rows = table;
      // Excel's own web pages carry each number's full value and format, as its copies do.
      copied = clipboardCells(text, rows, FILE_LIMIT);
    } else rows = parseCsv(text, FILE_LIMIT);
    if (!rows.length || rows.every((r) => r.every((c) => !c.trim()))) return { error: "empty" };
    const cutRows = rows.length > MAX_ROWS ? MAX_ROWS : null;
    rows = rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS));
    const id = newId();
    const sheetName = name.replace(/[[\]:*?/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || (locale === "de" ? "Blatt 1" : "Sheet 1");
    // Numbers are read in the language the file writes them in: an English lab CSV opened in
    // German keeps 0.123 as 0,123 (not 123).
    const numbers = csvNumberLocale(rows, locale);
    let wb = pasteText({ v: 1, sheets: [blankSheet(id, sheetName)], charts: [], tables: [] }, id, { row: 0, col: 0 }, rows, numbers);
    if (copied) wb = pasteExactNumbers(wb, id, { row: 0, col: 0 }, rows, copied, numbers);
    // (Text files bring no more text than they have: no check for MAX_IMPORT_TEXT needed.)
    const kept = keepable(wb, locale);
    return { workbook: kept.workbook, skipped: kept.lost, cutRows, kind: "csv", name };
  } catch (e) {
    console.error("sheet: reading the file failed", e);
    return { error: "failed" };
  }
}

/**
 * The workbook as a saved page keeps it (normalizeWorkbook, which every reopening applies), and
 * what that took away, as lines for `skipped`.
 */
function keepable(wb: Workbook, locale: Locale): { workbook: Workbook; lost: string[] } {
  const kept = normalizeWorkbook(wb, locale);
  if (kept === wb) return { workbook: wb, lost: [] };
  const t = sheetIoText[locale].skipped;
  const lost: string[] = [];
  const sheets = wb.sheets.length - kept.sheets.length;
  if (sheets > 0) lost.push(t.sheetLimit(sheets, kept.sheets.length));
  const charts = wb.charts.length - kept.charts.length;
  if (charts > 0) lost.push(t.chartLimit(charts, kept.charts.length));
  // Series: of the charts that stayed (a chart keeps its id), the most one chart may have is what
  // the fullest of the cut ones kept.
  const before = new Map(wb.charts.map((c) => [c.id, c.series.length]));
  let series = 0;
  let most = 0;
  for (const c of kept.charts) {
    const cut = (before.get(c.id) ?? c.series.length) - c.series.length;
    if (cut > 0) {
      series += cut;
      most = Math.max(most, c.series.length);
    }
  }
  if (series > 0) lost.push(t.seriesLimit(series, most));
  const tables = wb.tables.length - kept.tables.length;
  if (tables > 0) lost.push(t.tableLimit(tables));
  // Cells and formulas, sheet by sheet (sheets keep their ids too).
  const keptSheets = new Map(kept.sheets.map((s) => [s.id, s]));
  let cells = 0;
  let formulas = 0;
  for (const s of wb.sheets) {
    const k = keptSheets.get(s.id);
    if (!k || k === s) continue;
    cells += Math.max(0, Object.keys(s.cells).length - Object.keys(k.cells).length);
    formulas += Math.max(0, formulaCount(s) - formulaCount(k));
  }
  if (formulas > 0) lost.push(t.longFormulas(formulas, MAX_FORMULA_LENGTH.toLocaleString(locale === "de" ? "de-DE" : "en-US")));
  if (cells > 0) lost.push(t.cells(cells));
  return { workbook: kept, lost };
}

function formulaCount(sheet: Sheet): number {
  let n = 0;
  for (const key in sheet.cells) if (sheet.cells[key].f !== undefined) n++;
  return n;
}

/**
 * Characters of text in a workbook's cells (values, formulas, notes). The Excel reader stops at
 * MAX_IMPORT_TEXT already; this is the last check before the workbook goes to the page (the
 * worker's message copies all of it, and the page measures it as JSON).
 */
function cellText(wb: Workbook): number {
  let n = 0;
  for (const sheet of wb.sheets) {
    for (const key in sheet.cells) {
      const c = sheet.cells[key];
      if (typeof c.v === "string") n += c.v.length;
      if (c.f !== undefined) n += c.f.length;
      if (c.note !== undefined) n += c.note.length;
    }
  }
  return n;
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
