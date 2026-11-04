// Copy, cut and paste for the grid. Copying puts the shown values on the system clipboard as
// tab-separated text and as an HTML table (so Excel, Google Sheets, Word or a Blob note can take
// them), and keeps Blob's own copy with formulas and looks. Pasting the same text back inside
// Blob uses that copy (formulas move like in Excel, a cut moves the cells); anything else is
// parsed like typing, with the full numbers a spreadsheet's copy carries besides its text.
//
// Numbers go out without their unit ("2,0", not "2,0 mg/L"): Excel, LibreOffice and Google Sheets
// then take them as numbers to calculate with, not as text. Excel also gets each number's full
// value and its format, unit included, so it shows the cell as Blob does; so does another Blob
// spreadsheet that gets the copy without Blob's own (in another tab, after a reload).

import type { Locale } from "@/i18n/config";
import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { sameArea } from "@/sheet/a1";
import { defaultAlign } from "@/sheet/engine";
import { clipboardCells, parseClipboard, pasteExactNumbers, SHEET_LIMIT, toHtmlTable, toTsv, type CopiedCell, type HtmlCellLook } from "@/sheet/io/clipboard";
import { csvNumberLocale } from "@/sheet/io/csv";
import { BUILTIN_CODES, sigStyleName, toExcelFormat, withoutUnit } from "@/sheet/io/formatCodes";
import type { ReadLimit } from "@/sheet/io/limits";
import { copyArea, pasteClip, pasteText, type ClipData } from "@/sheet/ops";
import type { Area, NumberFormat } from "@/sheet/types";
import { activeArea, tablesAfterPaste, type SheetStore } from "../store";
import { shownText } from "./cellLook";

type OwnCopy = { pageId: string; text: string; clip: ClipData; cut: boolean };

/** Blob's own clipboard: the cells last copied or cut (with formulas and looks) and the text that went to the system clipboard with them. */
let ownCopy: OwnCopy | null = null;

const normalize = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");

// The clipboard formats come from src/sheet/io/clipboard.ts. Should one of them ever fail, these
// plain versions keep copy and paste working (tabs and line breaks, a bare table); a failure is
// reported once.
const reported = new Set<string>();
function reportOnce(what: string, err: unknown) {
  if (reported.has(what)) return;
  reported.add(what);
  console.error(`sheet: ${what} failed`, err);
}

function tsv(rows: string[][]): string {
  try {
    return toTsv(rows);
  } catch (e) {
    reportOnce("toTsv", e);
    const quote = (t: string) => (/[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
    return rows.map((r) => r.map(quote).join("\t")).join("\n");
  }
}

function htmlTable(rows: string[][], styles: (HtmlCellLook | null)[][]): string {
  try {
    return toHtmlTable(rows, styles);
  } catch (e) {
    reportOnce("toHtmlTable", e);
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  }
}

function parse(data: { text?: string; html?: string }, limit: ReadLimit): string[][] | null {
  try {
    return parseClipboard(data, limit);
  } catch (e) {
    reportOnce("parseClipboard", e);
    const text = data.text ? normalize(data.text) : "";
    return text.includes("\t") || text.includes("\n") ? text.split("\n").map((line) => line.split("\t")) : null;
  }
}

/** The full numbers and formats behind a spreadsheet's copy (see clipboardCells); null when there are none, or reading them failed. */
function copiedCells(html: string | undefined, rows: string[][], limit: ReadLimit): (CopiedCell | null)[][] | null {
  try {
    return clipboardCells(html, rows, limit);
  } catch (e) {
    reportOnce("clipboardCells", e);
    return null;
  }
}

/**
 * A number format as Excel's mso-number-format in copied HTML (undefined for General). Built-in
 * formats that depend on the language go by Excel's names for them.
 */
function msoFormat(fmt: NumberFormat | undefined, locale: Locale, value: number): string | undefined {
  try {
    const x = toExcelFormat(fmt, locale, value);
    if ("code" in x) return x.code;
    if (x.id === 0) return undefined;
    if (x.id === 14) return "Short Date";
    if (x.id === 22) return "General Date";
    return BUILTIN_CODES[x.id];
  } catch (e) {
    reportOnce("toExcelFormat", e);
    return undefined;
  }
}

export type CopyPayload = { text: string; html: string; area: Area; sheetId: string };

/** What copying the selection gives: TSV and HTML of the shown values; Blob's own copy is remembered and the marching ants start. */
export function copySelection(store: SheetStore, cut: boolean): CopyPayload {
  const s = store.get();
  const area = activeArea(s.selection);
  const sheet = s.workbook.sheets.find((x) => x.id === s.sheetId)!;
  const rows: string[][] = [];
  const styles: (HtmlCellLook | null)[][] = [];
  for (let r = area.r0; r <= area.r1; r++) {
    const line: string[] = [];
    const look: (HtmlCellLook | null)[] = [];
    for (let c = area.c0; c <= area.c1; c++) {
      const cell = sheet.cells[`${r},${c}`];
      const value = cell ? s.calc.value(s.sheetId, r, c) : null;
      const fmt = cell?.s?.fmt;
      // Without the unit (see the top of the file); the HTML says it to Excel as the format.
      line.push(shownText(value, withoutUnit(fmt), s.locale));
      if (!cell) look.push(null);
      else {
        const base: HtmlCellLook = { bold: cell.s?.bold, align: cell.s?.align ?? (value === null ? undefined : defaultAlign(value)) };
        look.push(typeof value === "number" ? { ...base, num: value, fmt: msoFormat(fmt, s.locale, value), style: sigStyleName(fmt) } : base);
      }
    }
    rows.push(line);
    styles.push(look);
  }
  const text = tsv(rows);
  const html = htmlTable(rows, styles);
  ownCopy = { pageId: s.pageId, text, clip: copyArea(s.workbook, s.sheetId, area), cut: cut && !s.readOnly };
  store.setClip({ sheetId: s.sheetId, area, cut: cut && !s.readOnly });
  return { text, html, area, sheetId: s.sheetId };
}

export type PasteMode = "all" | "values" | "transpose";

/**
 * Paste clipboard data at the selection. Blob's own copy when the text is what Blob copied (or
 * when there is no data because the system clipboard can't be read), else the text or HTML table
 * parsed like typing. Blob's own copy also goes from one spreadsheet into another (formulas move
 * like within a sheet, looks come along), except as values: those are the shown values then. The
 * pasted cells end up selected. false: there was nothing to paste.
 */
export function pasteData(store: SheetStore, data: { text?: string; html?: string } | null, mode: PasteMode): boolean {
  const s = store.get();
  if (s.readOnly) return false;
  const labels = sheetGridText[s.locale].labels;
  const target = activeArea(s.selection);
  const text = data?.text !== undefined ? normalize(data.text) : null;
  const ours = !!ownCopy && (text === null ? !data?.html : text !== "" && normalize(ownCopy.text) === text);
  // From another spreadsheet, values come from the text (the cells' values live in that one's calculation).
  const own = ours && ownCopy && (ownCopy.pageId === s.pageId || mode !== "values") ? ownCopy : null;

  if (own) {
    // A cut moves its cells, once (within its own spreadsheet); after Escape (no marching ants
    // any more) it pastes like a copy.
    const here = own.pageId === s.pageId;
    const cut = here && own.cut && !!s.clip?.cut && s.clip.sheetId === own.clip.sheetId && sameArea(s.clip.area, own.clip.area);
    const transpose = mode === "transpose";
    const ch = own.clip.cells.length;
    const cw = own.clip.cells[0]?.length ?? 1;
    const [h, w] = transpose ? [cw, ch] : [ch, cw];
    const th = target.r1 - target.r0 + 1;
    const tw = target.c1 - target.c0 + 1;
    // A copy fills a target that is a whole multiple of it; a cut moves its cells once.
    const repeats = !cut && th % h === 0 && tw % w === 0;
    const pasted: Area = { r0: target.r0, c0: target.c0, r1: target.r0 + (repeats ? th : h) - 1, c1: target.c0 + (repeats ? tw : w) - 1 };
    store.apply(cut ? labels.move : labels.paste, (wb, calc) => {
      const next = pasteClip(wb, calc, s.sheetId, target, own.clip, { mode: mode === "values" ? "values" : "all", transpose, cut });
      // Rows pasted right under a smart table join it, in the same undo step.
      return next === wb ? wb : tablesAfterPaste(next, s.sheetId, pasted, s.locale);
    });
    store.select(pasted);
    if (cut) {
      ownCopy = null;
      store.setClip(null);
    }
    return true;
  }

  if (!data || (!data.text && !data.html)) return false;
  const transpose = mode === "transpose";
  // No more than a sheet holds is read (its rows become columns when transposed).
  const limit: ReadLimit = transpose ? { rows: SHEET_LIMIT.cols, cols: SHEET_LIMIT.rows } : SHEET_LIMIT;
  const parsed = parse({ text: data.text, html: data.html }, limit) ?? (text ? [[text]] : null);
  if (!parsed || !parsed.length) return false;
  // Excel, LibreOffice and Google Sheets copy rounded text ("0,12") and, in their HTML, the full
  // number (0,123456789) and its format: those are pasted, so means and fits match the source.
  const exact = copiedCells(data.html, parsed, limit);
  const rows = transpose ? transposeRows(parsed, "") : parsed;
  const exactRows = exact && transpose ? transposeRows(exact, null) : exact;
  const height = rows.length;
  const width = Math.max(1, ...rows.map((r) => r.length));
  const at = { row: target.r0, col: target.c0 };
  const pasted: Area = { r0: at.row, c0: at.col, r1: at.row + height - 1, c1: at.col + width - 1 };
  // Numbers are read in the language they are written in: English lab values ("0.123") pasted
  // by a German user stay 0,123 (not 123); data that doesn't show it is read in the user's own.
  const numbers = csvNumberLocale(rows, s.locale);
  store.apply(labels.paste, (wb) => {
    let next = pasteText(wb, s.sheetId, at, rows, numbers);
    if (exactRows) {
      try {
        next = pasteExactNumbers(next, s.sheetId, at, rows, exactRows, numbers);
      } catch (e) {
        // The rounded text is pasted then, as before.
        reportOnce("pasteExactNumbers", e);
      }
    }
    return next === wb ? wb : tablesAfterPaste(next, s.sheetId, pasted, s.locale);
  });
  store.select(pasted);
  return true;
}

function transposeRows<T>(rows: T[][], empty: T): T[][] {
  const width = Math.max(0, ...rows.map((r) => r.length));
  return Array.from({ length: width }, (_, c) => rows.map((r) => r[c] ?? empty));
}

/** Is there a copy of Blob's own for this page (so the menu can paste even when the system clipboard can't be read)? */
export const hasOwnCopy = (pageId: string) => ownCopy?.pageId === pageId;

/** Forget the cut after Escape: pasting then copies (the ants are gone, like Excel's copy mode). */
export function endCut() {
  if (ownCopy?.cut) ownCopy = { ...ownCopy, cut: false };
}

/** Write to the system clipboard without a keyboard event (menu actions). false when the browser refused. */
export async function writeSystemClipboard(text: string, html: string): Promise<boolean> {
  const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clip) return false;
  try {
    if (typeof clip.write === "function" && typeof ClipboardItem !== "undefined") {
      await clip.write([new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
      return true;
    }
  } catch {
    // Some browsers only take plain text: try that below.
  }
  try {
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Read the system clipboard without a keyboard event (menu actions); null when the browser won't let the page. */
export async function readSystemClipboard(): Promise<{ text?: string; html?: string } | null> {
  const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clip) return null;
  try {
    if (typeof clip.read === "function") {
      const items = await clip.read();
      let text: string | undefined;
      let html: string | undefined;
      for (const item of items) {
        if (html === undefined && item.types.includes("text/html")) html = await (await item.getType("text/html")).text();
        if (text === undefined && item.types.includes("text/plain")) text = await (await item.getType("text/plain")).text();
      }
      return { text, html };
    }
  } catch {
    // Reading rich data was refused; plain text may still work.
  }
  try {
    return { text: await clip.readText() };
  } catch {
    return null;
  }
}
