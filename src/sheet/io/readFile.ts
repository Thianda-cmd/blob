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
import { MAX_FORMULA_LENGTH, parseInput } from "../engine";
import { newId, pasteText } from "../ops";
import { DEFAULT_SIZE, MAX_COLS, MAX_ROWS, type ChartSpec, type RangeRef, type Sheet, type TableSpec, type Workbook } from "../types";
import { clipboardCells, parseHtmlTable, pasteExactNumbers, type CopiedCell } from "./clipboard";
import { csvNumberLocale, readCsv, separatorLocale, slashDatesFor, type CsvSeparator } from "./csv";
import { FILE_LIMIT, MAX_IMPORT_TEXT, MAX_SHEETS } from "./limits";

export { MAX_SHEETS };

/**
 * Why a file wasn't read: too big to read at all, an old binary Excel file, nothing in it, it
 * took too long (the worker was stopped), no room for another sheet, anything else; or the
 * spreadsheet would be too big to save, from the file alone (sheetTooBig) or with what the open
 * one has already (noRoom).
 */
export type ReadProblem = "tooBig" | "oldXls" | "empty" | "failed" | "slow" | "full" | "sheetTooBig" | "noRoom";

/**
 * A file read into a workbook of its own (fresh ids), and what couldn't come along, with `bytes`,
 * what the workbook takes as saved JSON (without the preview a save adds), when it was measured
 * against ReadOptions.maxBytes; or why not, with `message` saying it in the user's language when
 * the reader knows more than the problem (a password, a LibreOffice file, a damaged zip…), and
 * `bytes`, how big the spreadsheet would be (sheetTooBig, noRoom).
 */
export type ReadSheetFile =
  | { workbook: Workbook; skipped: string[]; cutRows: number | null; kind: "xlsx" | "csv"; name: string; bytes?: number }
  | { error: ReadProblem; message?: string; bytes?: number };

/**
 * `sheetRoom`: how many sheets may still be added (the spreadsheet the file goes into has the rest).
 * `maxBytes`: the most a spreadsheet may be saved with (bytes of its JSON), and `openBytes` what the
 * one the file goes into is saved with already (none for a new spreadsheet). A file that can't fit
 * is refused here, before its workbook goes to the page: copying it there and measuring it would
 * freeze the page for seconds.
 */
export type ReadOptions = { sheetRoom?: number; maxBytes?: number; openBytes?: number };

/** What the page sends the import's worker (readFile.worker.ts), and what comes back. */
export type ReadJob = { bytes: ArrayBuffer; name: string; locale: Locale; opts: ReadOptions };
export type ReadReply = { ready: true } | { result: ReadSheetFile };

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").trim();

/**
 * The file's text: UTF-16 (with its byte order mark, or without one), UTF-8, or Windows-1252 when
 * UTF-8 doesn't fit. Without NUL characters: a stray one in a field ("ok\0\0") would come along
 * into the cell, and the database refuses every save of text that holds one.
 */
function decodeText(bytes: Uint8Array): string {
  const text = decodeBytes(bytes);
  return text.includes("\u0000") ? text.replaceAll("\u0000", "") : text;
}

function decodeBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const utf16 = utf16Order(bytes);
  if (utf16) return new TextDecoder(utf16).decode(bytes);
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
 * UTF-16 without a byte order mark, as some instruments and old Windows tools write it: the letters,
 * digits and signs of a lab file each have a 0 as their second byte (little endian) or first byte
 * (big endian), so every second byte is 0. UTF-8 and Windows-1252 text has no 0 bytes at all.
 */
function utf16Order(bytes: Uint8Array): "utf-16le" | "utf-16be" | null {
  const n = Math.min(bytes.length, 4096) & ~1;
  if (n < 4) return null;
  let even = 0;
  let odd = 0;
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) even++;
    if (bytes[i + 1] === 0) odd++;
  }
  const pairs = n / 2;
  if (odd >= pairs / 2 && even <= pairs / 20) return "utf-16le";
  if (even >= pairs / 2 && odd <= pairs / 20) return "utf-16be";
  return null;
}

/**
 * Text that is markup, not rows of values: an HTML page or XML (Excel 2003 XML, a LIMS export)
 * saved as .xls. Such files start with a whole tag (which may run over several lines like Excel's
 * own <html xmlns:v=… xmlns:o=…>): one only pages start with (<html>, <table>, <?xml …>), or any
 * other (<div class="export">, <h2>Messprotokoll</h2>) when a table with cells follows somewhere.
 * So a first value like "<0,1", "<NWG" (below the detection limit) or "<b>Probe</b>" is still data.
 */
const MARKUP = /^\s*<(?:!doctype\b|!--|\?xml\b|(?:html|head|body|table|meta|style|title|(?:\w+:)?workbook)\b[^<>]*>)/i;
const FIRST_TAG = /^\s*<[a-z][\w:-]*(?:\s[^<>]*)?>/i;

function isMarkup(text: string): boolean {
  const head = text.slice(0, 2000);
  if (MARKUP.test(head)) return true;
  // The whole text is searched: a long preamble (<div>, <style>) can come before the table.
  return FIRST_TAG.test(head) && /<table[\s>]/i.test(text) && /<\/t[dh]\s*>/i.test(text);
}

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
        const wb = freshIds(kept.workbook);
        const size = sizeFor(opts, wb);
        return tooBigToSave(opts, size) ?? { workbook: wb, skipped: [...skipped, ...kept.lost], cutRows: null, kind: "xlsx", name, bytes: size };
      } catch (e) {
        if (!(e instanceof XlsxError)) throw e;
        return { error: e.code === "oldXls" ? "oldXls" : e.code === "tooBig" ? "tooBig" : "failed", message: e.message };
      }
    }

    const text = decodeText(bytes);
    let rows: string[][];
    let copied: (CopiedCell | null)[][] | null = null;
    let sep: CsvSeparator | null = null;
    if (isMarkup(text)) {
      // A web page or XML: its table if it has one (web tools save HTML tables as .xls).
      const table = /<table[\s>]/i.test(text) ? parseHtmlTable(text, FILE_LIMIT) : null;
      if (!table) return { error: "failed", message: errors.notTable };
      rows = table;
      // Excel's own web pages carry each number's full value and format, as its copies do.
      copied = clipboardCells(text, rows, FILE_LIMIT);
    } else ({ rows, sep } = readCsv(text, FILE_LIMIT));
    if (!rows.length || rows.every((r) => r.every((c) => !c.trim()))) return { error: "empty" };
    const cutRows = rows.length > MAX_ROWS ? MAX_ROWS : null;
    rows = rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS));
    const id = newId();
    const sheetName = name.replace(/[[\]:*?/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || (locale === "de" ? "Blatt 1" : "Sheet 1");
    // Numbers are read in the language the file writes them in: an English lab CSV opened in
    // German keeps 0.123 as 0,123 (not 123). When no value shows it ("1.234"), the separator does
    // ("," English, ";" German); else the reader's language counts.
    const numbers = csvNumberLocale(rows, (sep && separatorLocale(sep, rows)) ?? locale);
    // Too big to save: said before a single cell is made (a million of them take a while).
    const early = tooBigToSave(opts, opts.maxBytes === undefined ? undefined : rowsBytes(rows, numbers));
    if (early) return early;
    // Dates with slashes in the order the file's own dates show (13/11/2026: day first).
    if (sep) rows = slashDatesFor(rows, numbers, locale);
    // Cells the copy marks as text (Excel's '@', x:str) stay text, as when the same table is pasted.
    let wb = pasteText({ v: 1, sheets: [blankSheet(id, sheetName)], charts: [], tables: [] }, id, { row: 0, col: 0 }, rows, numbers, copied?.map((line) => line.map((c) => !!c?.asText)));
    if (copied) wb = pasteExactNumbers(wb, id, { row: 0, col: 0 }, rows, copied, numbers);
    // (Text files bring no more text than they have: no check for MAX_IMPORT_TEXT needed.)
    const kept = keepable(wb, locale);
    const size = sizeFor(opts, kept.workbook);
    return tooBigToSave(opts, size) ?? { workbook: kept.workbook, skipped: kept.lost, cutRows, kind: "csv", name, bytes: size };
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

// Too big to save ---------------------------------------------------------------------------------

/** The frame of a workbook's JSON ({"v":1,"sheets":[…],"charts":[…],"tables":[…]}): one is shared when two are put together. */
const FRAME_BYTES = 64;

/**
 * The problem when the file's workbook couldn't be saved (ReadOptions.maxBytes), alone or added to
 * the open spreadsheet (openBytes), with how big the spreadsheet would be; null when it fits or
 * there is no limit. `size` is the workbook's size as saved JSON (sizeFor), or the least it takes
 * and about how much (rowsBytes); measured only when there is a limit.
 */
function tooBigToSave(opts: ReadOptions, size: number | { least: number; about: number } | undefined): ReadSheetFile | null {
  const max = opts.maxBytes;
  if (max === undefined || size === undefined) return null;
  const { least, about } = typeof size === "number" ? { least: size, about: size } : size;
  if (least > max) return { error: "sheetTooBig", bytes: about };
  const open = opts.openBytes ?? 0;
  if (open > 0 && open + least - FRAME_BYTES > max) return { error: "noRoom", bytes: open + about };
  return null;
}

/** UTF-8 bytes of a text: 1 up to U+007F, 2 up to U+07FF, 3 above, 4 for a pair of surrogates. */
function utf8Length(s: string): number {
  let n = s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x80) n += c >= 0x800 && (c < 0xd800 || c > 0xdfff) ? 2 : 1;
  }
  return n;
}

/**
 * A workbook's size as saving measures it (src/components/sheet/saver.ts jsonBytes; without the
 * preview a save adds), when there is a limit to measure it against.
 */
const sizeFor = (opts: ReadOptions, wb: Workbook) => (opts.maxBytes === undefined ? undefined : utf8Length(JSON.stringify(wb)));

const digits = (n: number) => (n < 10 ? 1 : n < 100 ? 2 : n < 1000 ? 3 : n < 10000 ? 4 : String(n).length);

/**
 * A field that becomes a cell when pasted: not empty, not only blanks (as trim() sees them, which
 * parseInput asks: a no-break space or U+3000 too), not a lone apostrophe. Most fields start with
 * a letter or a digit, which says so without trimming.
 */
const filled = (s: string) => {
  const c = s.charCodeAt(0);
  return (c > 32 && c < 127 && c !== 39) || (s !== "'" && s.trim() !== "");
};

/**
 * What the cells of a text file's rows take as saved JSON, worked out before any cell is made:
 * `least` for sure (each field with something in it becomes a cell, "row,col":{"v":…} with at
 * least one character of value), and `about` with the values and formats of up to 2000 fields
 * from all over the file, read as pasting reads them.
 */
function rowsBytes(rows: string[][], numbers: Locale): { least: number; about: number } {
  let least = 0;
  let cells = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowDigits = digits(r);
    for (let c = 0; c < row.length; c++) {
      if (!filled(row[c])) continue;
      cells++;
      // "r,c":{"v":X} and the comma after it.
      least += rowDigits + digits(c) + 12;
    }
  }
  if (!cells) return { least: 0, about: 0 };
  const step = Math.max(1, Math.floor(cells / 2000));
  let seen = 0;
  let sampled = 0;
  let more = 0;
  for (const row of rows) {
    for (const text of row) {
      if (!filled(text) || seen++ % step) continue;
      const p = parseInput(text, numbers);
      const cell = p.error ? { v: text } : p.fmt ? { ...p.cell, s: { fmt: p.fmt } } : p.cell;
      // Beyond {"v":X} with one character of X, counted above.
      more += Math.max(0, utf8Length(JSON.stringify(cell)) - 7);
      sampled++;
    }
  }
  return { least, about: least + Math.round((more / sampled) * cells) };
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
