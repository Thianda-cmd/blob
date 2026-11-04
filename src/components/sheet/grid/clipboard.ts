// Copy, cut and paste for the grid. Copying puts the shown values on the system clipboard as
// tab-separated text and as an HTML table (so Excel, Google Sheets, Word or a Blob note can take
// them), and keeps Blob's own copy with formulas and looks. Pasting the same text back inside
// Blob uses that copy (formulas move like in Excel, a cut moves the cells); anything else is
// parsed like typing, with the full numbers a spreadsheet's copy carries besides its text, and
// its text cells kept as text ("007"). A copy of a filtered smart table takes the rows it shows,
// and a paste fills the rows a filter shows (the ones it hides keep their cells).
//
// Numbers go out without their unit ("2,0", not "2,0 mg/L"): Excel, LibreOffice and Google Sheets
// then take them as numbers to calculate with, not as text. Excel also gets each number's full
// value and its format, unit included, so it shows the cell as Blob does; so does another Blob
// spreadsheet that gets the copy without Blob's own (in another tab, after a reload).

import type { Locale } from "@/i18n/config";
import { sheetCollabText } from "@/i18n/messages/sheetCollab";
import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { cellKey, sameArea } from "@/sheet/a1";
import { sameJson } from "@/sheet/collab";
import { defaultAlign, parseInput, type CellValue } from "@/sheet/engine";
import { monthFromName } from "@/sheet/engine/dates";
import { clipboardCells, parseClipboard, pasteExactNumbers, SHEET_LIMIT, toHtmlTable, toTsv, type CopiedCell, type HtmlCellLook } from "@/sheet/io/clipboard";
import { csvNumberLocale } from "@/sheet/io/csv";
import { BUILTIN_CODES, sigStyleName, toExcelFormat, withoutUnit } from "@/sheet/io/formatCodes";
import type { ReadLimit } from "@/sheet/io/limits";
import { copyArea, pasteClip, pasteText, sheetById, type ClipData } from "@/sheet/ops";
import { followArea, lostCell, netOps, opsSince } from "@/sheet/sheetLog";
import { filteredRows } from "@/sheet/table/model";
import type { Area, NumberFormat, SheetOp } from "@/sheet/types";
import { showSheetNotice } from "../notice";
import { activeArea, tablesAfterPaste, type SheetState, type SheetStore } from "../store";
import { shownText } from "./cellLook";

/**
 * `values`: what the copied cells held then, a formula's result included, line by line (a values
 * paste brings these once the copied cells changed or moved, see pasteData). `log`: the copied
 * sheet's log of row and column changes then (Sheet.log), to find a cut's cells after rows moved.
 */
type OwnCopy = { pageId: string; text: string; html: string; clip: ClipData; values: CellValue[][]; cut: boolean; log: readonly SheetOp[] | undefined };

/** Blob's own clipboard: the cells last copied or cut (with formulas and looks) and the text and HTML that went to the system clipboard with them. */
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

/**
 * The rows a smart table's filter hides on the sheet on screen (not those hidden by hand); null
 * when it hides none, or working that out failed (copy and paste then take every row).
 */
function filteredOut(s: SheetState): ReadonlySet<number> | null {
  if (!s.workbook.tables.some((t) => t.sheetId === s.sheetId && Object.keys(t.filters).length > 0)) return null;
  try {
    const hidden = filteredRows(s.workbook, s.calc, s.sheetId, s.locale);
    return hidden.size ? hidden : null;
  } catch (e) {
    reportOnce("filteredRows", e);
    return null;
  }
}

/**
 * The rows of `area` that a smart table's filter shows, when it hides some of them; null to copy
 * every row (also when the filter hides them all: those are the cells that were picked then).
 */
function rowsShownByFilters(s: SheetState, area: Area): number[] | null {
  const hidden = filteredOut(s);
  if (!hidden) return null;
  const rows: number[] = [];
  for (let r = area.r0; r <= area.r1; r++) if (!hidden.has(r)) rows.push(r);
  return rows.length && rows.length < area.r1 - area.r0 + 1 ? rows : null;
}

/**
 * The rows a paste of `count` rows from row `r0` down fills: like LibreOffice, it leaves out the
 * rows a filter hides (`hidden`), so what you paste beside a filtered table lands next to the
 * rows you see, and the cells you can't see keep what they hold. null when the rows simply
 * follow each other (also when r0 itself is hidden: a cell picked there by its name).
 */
function rowsToFill(hidden: ReadonlySet<number> | null, r0: number, count: number): number[] | null {
  if (!hidden || hidden.has(r0) || count < 1) return null;
  const rows: number[] = [];
  for (let r = r0; rows.length < count; r++) if (!hidden.has(r)) rows.push(r);
  return rows[rows.length - 1] === r0 + count - 1 ? null : rows;
}

/** How many rows of `area` a paste fills: those a filter doesn't hide (see rowsToFill). */
function rowsFilled(hidden: ReadonlySet<number> | null, area: Area): number {
  let n = area.r1 - area.r0 + 1;
  if (!hidden || hidden.has(area.r0)) return n;
  for (const r of hidden) if (r >= area.r0 && r <= area.r1) n--;
  return n;
}

/**
 * Are the copied cells still where they were copied from, as they were? Not after rows were
 * inserted, deleted or sorted there (other cells are in those rows now), nor after a copied cell
 * was typed over. Compared by what they hold, one look per copied cell (usually the very same
 * cell): a collaborator's edit anywhere gives every cell a new object (the editor reads their
 * version from JSON) and changes none of these.
 */
function untouched(s: SheetState, clip: ClipData): boolean {
  const sheet = sheetById(s.workbook, clip.sheetId);
  if (!sheet) return false;
  return clip.cells.every((line, i) => {
    const row = clip.rows?.[i] ?? clip.area.r0 + i;
    return line.every((cell, j) => sameJson(sheet.cells[cellKey(row, clip.area.c0 + j)] ?? null, cell));
  });
}

/**
 * Where the cells of a cut are now: rows or columns inserted, deleted, sorted or moved on its
 * sheet since took them along (Sheet.log; someone else's such change cancels a cut, see
 * store.replaceRemote). "gone" when none of them is left (their rows or columns deleted, or the
 * sheet); null when they aren't together any more (sorted or moved apart) or that can't be told.
 */
function cutCells(s: SheetState, own: OwnCopy): Area | "gone" | null {
  const { area, cells, rows } = own.clip;
  const sheet = sheetById(s.workbook, own.clip.sheetId);
  if (!sheet) return "gone";
  if (sheet.log === own.log) return area;
  const ops = opsSince(own.log, sheet.log);
  if (!ops) return null;
  const net = netOps(ops);
  const now = followArea(net, sheet.id, area);
  if (now) return now;
  // (Its empty cells don't count: nothing of them would be there twice.)
  const lost = (i: number, j: number) => !!lostCell(net, sheet.id, { row: rows?.[i] ?? area.r0 + i, col: area.c0 + j });
  return cells.every((line, i) => line.every((cell, j) => !cell || lost(i, j))) ? "gone" : null;
}

/**
 * A text typing keeps as it is in both languages, told without reading it (parseInput): one that
 * starts with a letter is a number only behind a currency ("EUR 5", "chf 12.50") and a date only
 * behind a month ("Nov 3, 2026", "Mär 2026"); one that starts with any other sign that starts no
 * number ("(", "#", "µ") is neither. Truth values are left to the caller. Names and sample IDs
 * ("Probe 12", "P-00001-0") are most of the text cells of a big copy: reading each of them, in
 * both languages, made copying slow. false: the text has to be read.
 */
function keptAsTyped(text: string): boolean {
  const t = text.trim();
  // Spaces only (an empty cell then); digits, decimal signs, signs, currencies, a formula, an apostrophe.
  if (!t || /^[\d.,+\-−€$£=']/.test(t)) return false;
  // (As parseValueText looks for a currency and a month in front.)
  const head = t.slice(0, 3).toUpperCase();
  if (head === "EUR" || head === "CHF") return false;
  const word = /^[A-Za-zÄÖÜäöü]+/.exec(t)?.[0];
  return !word || !isMonth(word);
}

/** First words looked up as months: a big copy has few different ones ("Probe", "Std"). */
const monthWords = new Map<string, boolean>();

function isMonth(word: string): boolean {
  let month = monthWords.get(word);
  if (month === undefined) {
    month = monthFromName(word) !== 0;
    remember(monthWords, word, month);
  }
  return month;
}

/** Keep what a short text gave (long ones seldom come again); a copy of all different texts doesn't keep them all. */
function remember(memo: Map<string, boolean>, text: string, value: boolean) {
  if (text.length > 64) return;
  if (memo.size >= 5000) memo.clear();
  memo.set(text, value);
}

/**
 * What texts that had to be read read as, by language: a column of dates or batch numbers repeats
 * them. Kept for the year they were read in (`readingsYear`): typing reads a day and month without
 * a year in the current one, and "29.2." is a date only in a leap year.
 */
const readings: Record<Locale, Map<string, boolean>> = { de: new Map(), en: new Map() };
let readingsYear = 0;

/** Forget the readings of another year (see readings); once per copy. */
function readThisYear() {
  const year = new Date().getFullYear();
  if (year === readingsYear) return;
  readingsYear = year;
  readings.de.clear();
  readings.en.clear();
}

let textsReadSoFar = 0;

/** How many texts copying has had to read so far (not told by keptAsTyped, not remembered), for the checks. */
export const textsRead = () => textsReadSoFar;

/**
 * A text that typing would read as something else: a number ("007", "1E5"), a date, a time, a
 * truth value or a formula. Also in the other language where that one reads it differently (its
 * decimal sign, day or month first, its truth values, its function names): a paste reads numbers
 * in the language they are written in.
 */
function readsAsOther(text: string, locale: Locale): boolean {
  const truth = /^\s*(wahr|falsch|true|false)\s*$/i.test(text);
  if (!truth) {
    // Anything else needs a digit, a sign or quote in front…
    if (!/\d/.test(text) && !/^[=+\-']/.test(text)) return false;
    // …and, starting with a letter, a currency or a month (see keptAsTyped).
    if (keptAsTyped(text)) return false;
  }
  const known = readings[locale].get(text);
  if (known !== undefined) return known;
  textsReadSoFar++;
  const reads = (l: Locale) => {
    const p = parseInput(text, l);
    return p.cell.f !== undefined || p.cell.v !== text || !!p.fmt || !!p.error;
  };
  const other = reads(locale) || ((truth || /[.,/]|^[=+-]/.test(text)) && reads(locale === "de" ? "en" : "de"));
  remember(readings[locale], text, other);
  return other;
}

/**
 * What copying the selection gives: TSV and HTML of the shown values; Blob's own copy is
 * remembered and the marching ants start. Like Excel, a copy leaves out the rows a smart table's
 * filter hides (rows hidden by hand come along): pasted where no filter hides rows, the rest lands
 * next to each other. A cut moves the whole block, filtered rows too.
 */
export function copySelection(store: SheetStore, cut: boolean): CopyPayload {
  const s = store.get();
  const area = activeArea(s.selection);
  const sheet = s.workbook.sheets.find((x) => x.id === s.sheetId)!;
  const cutting = cut && !s.readOnly;
  const shown = cutting ? null : rowsShownByFilters(s, area);
  const lines = shown ?? Array.from({ length: area.r1 - area.r0 + 1 }, (_, i) => area.r0 + i);
  const rows: string[][] = [];
  const styles: (HtmlCellLook | null)[][] = [];
  const values: CellValue[][] = [];
  readThisYear();
  for (const r of lines) {
    const line: string[] = [];
    const look: (HtmlCellLook | null)[] = [];
    const held: CellValue[] = [];
    for (let c = area.c0; c <= area.c1; c++) {
      const cell = sheet.cells[`${r},${c}`];
      const value = cell ? s.calc.value(s.sheetId, r, c) : null;
      held.push(value);
      const fmt = cell?.s?.fmt;
      // Without the unit (see the top of the file); the HTML says it to Excel as the format.
      line.push(shownText(value, withoutUnit(fmt), s.locale));
      if (!cell) look.push(null);
      else {
        const base: HtmlCellLook = { bold: cell.s?.bold, align: cell.s?.align ?? (value === null ? undefined : defaultAlign(value)) };
        if (typeof value === "number") look.push({ ...base, num: value, fmt: msoFormat(fmt, s.locale, value), style: sigStyleName(fmt) });
        // A text cell, or a text typing would read as something else, is marked as text, so
        // "007" stays 007 in Excel and in another Blob tab.
        else if (typeof value === "string" && value !== "" && (fmt?.kind === "text" || readsAsOther(value, s.locale))) look.push({ ...base, text: true, ...(fmt?.kind === "text" ? { fmt: "@" } : {}) });
        else look.push(base);
      }
    }
    rows.push(line);
    styles.push(look);
    values.push(held);
  }
  // The text is that of the rows copied, so pasting it back finds Blob's own copy (pasteData).
  const text = tsv(rows);
  const html = htmlTable(rows, styles);
  ownCopy = { pageId: s.pageId, text, html, clip: copyArea(s.workbook, s.sheetId, area, shown ?? undefined), values, cut: cutting, log: sheet.log };
  store.setClip({ sheetId: s.sheetId, area, cut: cutting });
  return { text, html, area, sheetId: s.sheetId };
}

export type PasteMode = "all" | "values" | "transpose";

/**
 * Paste clipboard data at the selection. Blob's own copy when the text is what Blob copied (or
 * when there is no data because the system clipboard can't be read), else the text or HTML table
 * parsed like typing. Blob's own copy also goes from one spreadsheet into another (formulas move
 * like within a sheet, looks come along). A paste skips the rows a smart table's filter hides
 * (rowsToFill), except a cut, which moves its block as it is. The pasted cells end up selected.
 * false: there was nothing to paste.
 */
export function pasteData(store: SheetStore, data: { text?: string; html?: string } | null, mode: PasteMode): boolean {
  const s = store.get();
  if (s.readOnly) return false;
  const labels = sheetGridText[s.locale].labels;
  const target = activeArea(s.selection);
  const text = data?.text !== undefined ? normalize(data.text) : null;
  const own = ownCopy !== null && (text === null ? !data?.html : text !== "" && normalize(ownCopy.text) === text) ? ownCopy : null;

  if (own) {
    const here = own.pageId === s.pageId;
    // A cut someone else's change cancelled (store.replaceRemote) pastes nothing, also from the
    // text it put on the clipboard: as a copy, the cells would be there twice, with their values
    // from before. The notice says again why.
    const stopped = s.stoppedCut;
    if (here && own.cut && stopped && stopped.sheetId === own.clip.sheetId && sameArea(stopped.area, own.clip.area)) {
      showSheetNotice(store, sheetCollabText[s.locale].cutStopped);
      return true;
    }
    // A cut moves its cells, once (within its own spreadsheet), from where they are now (see
    // cutCells), with any paste. After Escape (no marching ants any more) it pastes like a copy,
    // and so it does once its cells are gone (their rows or columns deleted): its ants go then, as
    // with Escape. Cells of it sorted or moved apart can't move together, and pasted as a copy they
    // would be there twice: it is cancelled then, as by someone else's change, and pastes nothing
    // (each time, until something else is copied or cut, or Escape makes it a copy).
    const now = here && own.cut ? cutCells(s, own) : undefined;
    if (now === null) {
      store.setClip(null);
      showSheetNotice(store, sheetGridText[s.locale].cutApart);
      return true;
    }
    const ants = s.clip;
    const marked = here && own.cut && !!ants?.cut && ants.sheetId === own.clip.sheetId;
    const moving = marked && now && now !== "gone" && (sameArea(ants.area, own.clip.area) || sameArea(ants.area, now)) ? now : null;
    const cut = moving !== null;
    if (marked && !cut) {
      endCut();
      store.setClip(null);
    }
    let intact: boolean | undefined;
    /** Are the copied cells where they were copied from, as they were (see untouched)? Looked at once, when needed. */
    const copyUntouched = () => (intact ??= here && untouched(s, own.clip));
    // As values, a formula's result is read where it was copied from while the copied cells are
    // there as they were. Else it is the one it had when copied: in another spreadsheet (its values
    // live in that one's calculation), after rows were inserted, deleted or sorted there (other
    // cells are in those rows now), or after a copied cell was typed over.
    const values = mode === "values" && !cut && !copyUntouched() ? own.values : undefined;
    const transpose = mode === "transpose";
    const ch = moving ? moving.r1 - moving.r0 + 1 : own.clip.cells.length;
    const cw = moving ? moving.c1 - moving.c0 + 1 : (own.clip.cells[0]?.length ?? 1);
    const [h, w] = transpose ? [cw, ch] : [ch, cw];
    let toRows: readonly number[] | null;
    let pasted: Area;
    if (!cut && !transpose && own.clip.rows && here && own.clip.sheetId === s.sheetId && target.r0 === own.clip.area.r0 && target.c0 === own.clip.area.c0 && copyUntouched()) {
      // A copy that left filtered rows out, pasted back where it came from: each line goes back
      // to its own row, also when the filter changed meanwhile ("formulas to values" on a
      // filtered table: copy, then paste values on the same cells). Only while those rows hold
      // what was copied: after rows were inserted, deleted or sorted, other cells are there (a
      // header, measurements a filter hides), and the lines go next to each other as anywhere.
      toRows = own.clip.rows;
      pasted = own.clip.area;
    } else {
      // A copy leaves out the rows a filter hides (rowsToFill); a cut moves its block as it is.
      const hidden = cut ? null : filteredOut(s);
      const th = rowsFilled(hidden, target);
      const tw = target.c1 - target.c0 + 1;
      // A copy fills a target that is a whole multiple of it; a cut moves its cells once.
      const repeats = !cut && th % h === 0 && tw % w === 0;
      const height = repeats ? th : h;
      toRows = rowsToFill(hidden, target.r0, height);
      pasted = { r0: target.r0, c0: target.c0, r1: toRows ? toRows[toRows.length - 1] : target.r0 + height - 1, c1: target.c0 + (repeats ? tw : w) - 1 };
    }
    store.apply(cut ? labels.move : labels.paste, (wb, calc) => {
      const next = pasteClip(wb, calc, s.sheetId, pasted, moving ? { ...own.clip, area: moving } : own.clip, { mode: mode === "values" ? "values" : "all", transpose, cut, ...(toRows ? { toRows } : {}), ...(values ? { values } : {}) });
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
  const html = data.html;
  const transpose = mode === "transpose";
  // No more than a sheet holds is read (its rows become columns when transposed).
  const limit: ReadLimit = transpose ? { rows: SHEET_LIMIT.cols, cols: SHEET_LIMIT.rows } : SHEET_LIMIT;
  const parsed = parse({ text: data.text, html }, limit) ?? (text ? [[text]] : null);
  if (!parsed || !parsed.length) return false;
  // Excel, LibreOffice and Google Sheets copy rounded text ("0,12") and, in their HTML, the full
  // number (0,123456789) and its format: those are pasted, so means and fits match the source.
  const exact = copiedCells(html, parsed, limit);
  const rows = transpose ? transposeRows(parsed, "") : parsed;
  const exactRows = exact && transpose ? transposeRows(exact, null) : exact;
  const height = rows.length;
  const width = Math.max(1, ...rows.map((r) => r.length));
  const at = { row: target.r0, col: target.c0 };
  // As with Blob's own copy, the rows a filter hides are left out (rowsToFill).
  const toRows = rowsToFill(filteredOut(s), at.row, height);
  const pasted: Area = { r0: at.row, c0: at.col, r1: toRows ? toRows[toRows.length - 1] : at.row + height - 1, c1: at.col + width - 1 };
  // Numbers are read in the language they are written in: English lab values ("0.123") pasted
  // by a German user stay 0,123 (not 123); data that doesn't show it is read in the user's own.
  const numbers = csvNumberLocale(rows, s.locale);
  // What the copy says is text stays as it is written ("007" from a text cell isn't 7).
  const asText = exactRows?.map((line) => line.map((c) => !!c?.asText)) ?? null;
  store.apply(labels.paste, (wb) => {
    let next = pasteText(wb, s.sheetId, at, rows, numbers, asText, toRows);
    if (exactRows) {
      try {
        next = pasteExactNumbers(next, s.sheetId, at, rows, exactRows, numbers, toRows);
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

/**
 * Read the system clipboard without a keyboard event (menu actions, Ctrl+Shift+V); null when the
 * browser won't let the page. A clipboard that holds no text (a picture, a file) gives "": there
 * is nothing to paste then (not Blob's own copy, which pasteData takes when there is no data).
 * Where the browser can, the HTML comes as the other program wrote it (readItems), never put into
 * the page: Blob only reads its table as text (src/sheet/io/clipboard.ts).
 */
export async function readSystemClipboard(): Promise<{ text?: string; html?: string } | null> {
  const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clip) return null;
  try {
    if (typeof clip.read === "function") {
      const items = await readItems(clip);
      let text: string | undefined;
      let html: string | undefined;
      for (const item of items) {
        if (html === undefined && item.types.includes("text/html")) html = await (await item.getType("text/html")).text();
        if (text === undefined && item.types.includes("text/plain")) text = await (await item.getType("text/plain")).text();
      }
      return { text: text ?? "", html };
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

/** navigator.clipboard.read's options (Chromium's, not yet in TypeScript's types). */
type ReadOptions = { unsanitized?: string[] };

/**
 * The clipboard's items, with the HTML as it was written where the browser allows it (Chromium):
 * a browser's own reading of Excel's HTML drops its <style>, which says which cells are text
 * ("007") and how the numbers are formatted. Other browsers hand over what they read without.
 */
async function readItems(clip: Clipboard): Promise<ClipboardItems> {
  const read = clip.read.bind(clip) as (options?: ReadOptions) => Promise<ClipboardItems>;
  try {
    return await read({ unsanitized: ["text/html"] });
  } catch (e) {
    // Refused: so would be the plain read (the caller tries plain text then).
    if (e instanceof DOMException && e.name === "NotAllowedError") throw e;
    // A browser that doesn't take the option.
    return read();
  }
}
