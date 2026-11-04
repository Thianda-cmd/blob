// CSV files: import (the separator is detected: ";" from German Excel, "," or tab; numbers are read
// in the file's language, dates with slashes in the order its own dates show) and export (";" and
// decimal comma in German so Excel opens it right, "," in English).
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import { formatValue, isError, parseInput, type Calc, type ParsedInput } from "../engine";
import type { Workbook } from "../types";
import { parseDelimited } from "./clipboard";
import { withoutUnit } from "./formatCodes";
import { FILE_LIMIT, type ReadLimit } from "./limits";

export { withoutUnit };

export type CsvSeparator = ";" | "," | "\t";

/** How often `sep` appears outside quotes on each of the first lines (quoted line breaks don't end a line). */
function counts(text: string, sep: string, maxLines = 50): number[] {
  const out: number[] = [];
  let count = 0;
  let inQuotes = false;
  let empty = true;
  for (let i = 0; i < text.length && out.length < maxLines; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      empty = false;
    } else if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      // Empty lines say nothing about the separator.
      if (!empty) out.push(count);
      count = 0;
      empty = true;
    } else {
      if (!inQuotes && c === sep) count++;
      empty = false;
    }
  }
  if (!empty && out.length < maxLines) out.push(count);
  return out;
}

/**
 * The separator of a CSV text: Excel's "sep=;" line when there is one, else the one that splits
 * every line into the same number of fields (tab before ";" before ","), else the most frequent one.
 */
export function detectSeparator(text: string): CsvSeparator {
  const hint = /^sep=(.)\r?\n/i.exec(text);
  if (hint && (hint[1] === ";" || hint[1] === "," || hint[1] === "\t")) return hint[1] as CsvSeparator;
  const candidates: CsvSeparator[] = ["\t", ";", ","];
  let best: { sep: CsvSeparator; score: number } | null = null;
  for (const sep of candidates) {
    const c = counts(text, sep);
    if (!c.length || c[0] === 0) continue;
    const steady = c.every((x) => x === c[0]);
    // A separator that is steady on every line wins; the fewer the lines that disagree, the better.
    const agree = c.filter((x) => x === c[0]).length / c.length;
    const score = (steady ? 1000 : agree * 100) + (sep === "\t" ? 2 : sep === ";" ? 1 : 0);
    if (!best || score > best.score) best = { sep, score };
  }
  if (best) return best.sep;
  // No separator on the first line: one column. Pick one that splits nothing ("1,5" in a German
  // column of numbers is a decimal comma).
  return ([";", "\t", ","] as const).find((sep) => !text.includes(sep)) ?? ";";
}

/** A CSV file's rows; `limit`: how much is read (a sheet's worth, and a row to tell there was more). */
export function parseCsv(text: string, limit: ReadLimit = FILE_LIMIT): string[][] {
  return readCsv(text, limit).rows;
}

/** A CSV file's rows and the separator they were split at. */
export function readCsv(text: string, limit: ReadLimit = FILE_LIMIT): { rows: string[][]; sep: CsvSeparator } {
  let src = text.replace(/^\uFEFF/, "");
  const sep = detectSeparator(src);
  // Excel's hint line isn't data.
  src = src.replace(/^sep=.\r?\n/i, "");
  const rows = parseDelimited(src, sep, limit);
  // Lines that are empty at the end of the file are no rows.
  while (rows.length && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  return { rows, sep };
}

/**
 * The language a CSV's separator stands for, for its numbers when none of them shows its own
 * ("1.234", "2.500"): "," separates an English file's values (1.234 is one point two three four),
 * ";" a German one's (German Excel's, where 1.234 is a thousand two hundred and thirty-four). Tab-
 * separated text, and a file of one column (whose separator was never seen), say nothing: null.
 */
export function separatorLocale(sep: CsvSeparator, rows: string[][]): Locale | null {
  if (sep === "\t" || !rows.some((r) => r.length > 1)) return null;
  return sep === "," ? "en" : "de";
}

/**
 * The language the numbers of a CSV are written in, so its values can be read like typing in that
 * language: "1,5" and "1.234,5" are German, "1.5" and "1,234.5" English. Files that don't show it
 * (whole numbers only, or "1.234") keep `fallback`: what the separator says, else the reader's
 * language. Dates have no say: "13/11/2026" is written so in Germany and in the UK alike.
 */
export function csvNumberLocale(rows: string[][], fallback: Locale): Locale {
  let de = 0;
  let en = 0;
  for (const row of rows.slice(0, 500)) {
    for (const raw of row) {
      // (endsWith, not /\s*%$/: a regex ending in \s* retries every space of a long field.)
      let s = raw.trim().replace(/^[-+]/, "");
      if (s.endsWith("%")) s = s.slice(0, -1).trimEnd();
      const m = /^(\d+)([.,])(\d+)$/.exec(s);
      if (m) {
        // "1.234" and "1,234" could be either (a thousand, or one point two three four): no vote.
        if (m[3].length === 3 && m[1] !== "0" && m[1].length <= 3) continue;
        if (m[2] === ",") de++;
        else en++;
      } else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^\d{1,3}(\.\d{3}){2,}$/.test(s)) de++;
      else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s) || /^\d{1,3}(,\d{3}){2,}$/.test(s)) en++;
    }
  }
  // Only a clear majority counts.
  if (de > en * 2 && de > 0) return "de";
  if (en > de * 2 && en > 0) return "en";
  return fallback;
}

/** A date with slashes and a year ("3/11/2026", "11/3/26"), a time after it or not: its two first parts. */
const SLASH_DATE = /^(\s*)(\d{1,2})\/(\d{1,2})(?=\/(?:\d{4}|\d{2})(?:$|[\sT]))/;
/** Two numbers with a slash and no year after them ("3/4", "1/20", "3/4 14:00"): its two parts. */
const SLASH_PAIR = /^(\s*)(\d{1,2})\/(\d{1,2})(?![\d/])/;

type DateOrder = "dmy" | "mdy";

const isDate = (p: ParsedInput) => typeof p.cell.v === "number" && (p.fmt?.kind === "date" || p.fmt?.kind === "datetime");

/**
 * Dates with slashes ("3/11/2026") as the file means them. Which part is the day shows where one is
 * above 12 ("13/11/2026": day first, as in Germany and the UK; "11/13/2026": month first, as in the
 * US). A column whose dates don't show it follows the file's other date columns, else the reader's
 * order (`locale`), as German Excel reads them. Two numbers with a slash and no year ("3/4", a
 * dilution "1/20") are as often no date at all: they say nothing about the order and are read as
 * the reader's language reads them (in German "3/4" is the 3rd of April and "1/20" stays text).
 * The rows come back with all these written the way `numbers` (the language the file's values are
 * read in) reads them, so they become what the file means. Numbers stay as they are: a UK file's
 * 1.234 is still one point two three four.
 */
export function slashDatesFor(rows: string[][], numbers: Locale, locale: Locale): string[][] {
  // What each column's dates say: a first part above 12 (day first), a second one (month first).
  const seen = new Map<number, { day: boolean; month: boolean }>();
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      if (row[c].indexOf("/") < 0) continue;
      const m = SLASH_DATE.exec(row[c]);
      if (!m) continue;
      const a = Number(m[2]);
      const b = Number(m[3]);
      let col = seen.get(c);
      if (!col) seen.set(c, (col = { day: false, month: false }));
      if (a > 12 && a <= 31 && b >= 1 && b <= 12) col.day = true;
      else if (b > 12 && b <= 31 && a >= 1 && a <= 12) col.month = true;
    }
  }
  const orderOf = (x: { day: boolean; month: boolean }): DateOrder | null => (x.day === x.month ? null : x.day ? "dmy" : "mdy");
  const orders = [...seen.values()].map(orderOf);
  const file: DateOrder | null = orders.includes("dmy") === orders.includes("mdy") ? null : orders.includes("dmy") ? "dmy" : "mdy";
  const reads: DateOrder = numbers === "de" ? "dmy" : "mdy";
  const turn = new Set<number>();
  for (const [c, x] of seen) if ((orderOf(x) ?? file ?? (locale === "de" ? "dmy" : "mdy")) !== reads) turn.add(c);
  // Pairs without a year read differently only when the numbers aren't read in the reader's language.
  const pairs = numbers !== locale;
  if (!turn.size && !pairs) return rows;
  return rows.map((row) => {
    let out = row;
    for (let c = 0; c < row.length; c++) {
      const text = row[c];
      if (text.indexOf("/") < 0) continue;
      const m = turn.has(c) ? SLASH_DATE.exec(text) : null;
      let next: string | null = null;
      if (m) {
        const turned = `${m[1]}${m[3]}/${m[2]}${text.slice(m[0].length)}`;
        // Only where that is a date: 13/13/2026 stays text, as written.
        if (isDate(parseInput(turned, numbers))) next = turned;
      } else if (pairs) {
        const pair = SLASH_PAIR.exec(text);
        if (!pair) continue;
        const mine = parseInput(text, locale);
        if (isDate(mine)) {
          const turned = `${pair[1]}${pair[3]}/${pair[2]}${text.slice(pair[0].length)}`;
          if (parseInput(turned, numbers).cell.v === mine.cell.v) next = turned;
        } else if (typeof parseInput(text, numbers).cell.v === "number") next = `'${text}`;
      }
      if (next === null) continue;
      if (out === row) out = [...row];
      out[c] = next;
    }
    return out;
  });
}

/**
 * Text that a spreadsheet program would run as a formula when it opens the file ("=…", "+…",
 * "-…", "@…"): it gets a leading apostrophe so it stays text (and can't be used to sneak a
 * formula into someone's Excel). Numbers aren't text and keep their minus sign.
 */
function guard(text: string): string {
  return /^[=+\-@\t\r]/.test(text) && text.length > 1 ? `'${text}` : text;
}

/** One sheet as CSV (values as shown, with a UTF-8 BOM so Excel reads umlauts). */
export function sheetToCsv(wb: Workbook, calc: Calc, sheetId: string, locale: Locale): string {
  const sheet = wb.sheets.find((s) => s.id === sheetId);
  const sep = locale === "de" ? ";" : ",";
  if (!sheet) return "\uFEFF";
  // The used range: from A1 to the last cell with something in it.
  let lastRow = -1;
  let lastCol = -1;
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.v === undefined && cell.f === undefined) continue;
    if (cell.v === "" && cell.f === undefined) continue;
    const i = key.indexOf(",");
    const r = Number(key.slice(0, i));
    const c = Number(key.slice(i + 1));
    if (r > lastRow) lastRow = r;
    if (c > lastCol) lastCol = c;
  }
  const lines: string[] = [];
  for (let r = 0; r <= lastRow; r++) {
    const fields: string[] = [];
    for (let c = 0; c <= lastCol; c++) {
      const cell = sheet.cells[`${r},${c}`];
      if (!cell || (cell.v === undefined && cell.f === undefined)) {
        fields.push("");
        continue;
      }
      const value = calc.value(sheetId, r, c);
      let text = formatValue(value, withoutUnit(cell.s?.fmt), locale);
      if (typeof value === "string") text = guard(text);
      else if (value !== null && isError(value)) text = formatValue(value, undefined, locale);
      fields.push(text.includes(sep) || text.includes('"') || text.includes("\n") || text.includes("\r") ? `"${text.replace(/"/g, '""')}"` : text);
    }
    lines.push(fields.join(sep));
  }
  return `\uFEFF${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;
}
