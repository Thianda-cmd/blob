// The system clipboard: copying cells for Excel, Google Sheets, Numbers, Word or a note (TSV and an
// HTML table), and pasting from them (TSV, CSV-ish text, HTML tables from Excel and web pages).
//
// CONTRACT: keep names and signatures.
//
// What the spreadsheet programs put on the clipboard:
// - Excel: text/plain is TSV with "\r\n" after every row; a cell with a line break (or a tab, or
//   one that starts with a quote) is in quotes with its quotes doubled, and line breaks inside it
//   are plain "\n". text/html is a table full of Office markup (<style>, conditional comments,
//   x:num attributes, <br style='mso-data-placement:same-cell'> for line breaks in a cell).
// - Google Sheets: TSV without the last line break; HTML inside <google-sheets-html-origin>.
// - LibreOffice, Numbers, Word tables and web pages: an HTML table, and text with tabs (or not).
// Both carry the values as the cells show them ("1,5" in German), which is what pasting wants:
// every value is read like typing in the user's language. A spreadsheet's HTML also carries each
// number's full value (Excel x:num, LibreOffice sdval, Google Sheets data-sheets-value): pasting
// keeps those (clipboardNumbers, pasteExactNumbers), so 0,12 shown is 0,123456789 pasted, as
// between two spreadsheet programs.

import type { Locale } from "@/i18n/config";
import { cellKey } from "../a1";
import { formatValue, parseInput } from "../engine";
import { setCells } from "../ops";
import type { Cell, NumberFormat, Pos, Workbook } from "../types";
import { lookup } from "./xml";

/** Rows of cell texts from clipboard data; null when it isn't table-like (then paste as one value). */
export function parseClipboard(data: { text?: string; html?: string }): string[][] | null {
  const text = data.text ?? "";
  const plain = text.replace(/\r\n?/g, "\n");
  const html = data.html && /<table[\s>]/i.test(data.html) ? data.html : null;
  let rows: string[][] | null = null;
  // Spreadsheets' own text is exact (their HTML collapses spaces); Word's and web pages' text
  // loses the table (a cell with two paragraphs breaks the line), so their HTML comes first.
  if (html && !SPREADSHEET_HTML.test(html)) rows = parseHtmlTable(html);
  if (!rows && plain.includes("\t")) rows = parseDelimited(text, "\t");
  if (!rows && html) rows = parseHtmlTable(html);
  if (!rows && plain) {
    const sep = csvishSeparator(plain);
    rows = sep ? parseDelimited(text, sep) : plain.replace(/\n$/, "").includes("\n") ? parseDelimited(text, "\t") : null;
  }
  if (!rows || !rows.length) return null;
  // One cell is one value: the caller pastes it as typed, unless reading took something off
  // (quotes around a value with a line break) that typing would keep.
  if (rows.length === 1 && rows[0].length === 1 && rows[0][0] === plain.replace(/\n$/, "")) return null;
  return rows;
}

/** HTML written by Excel, Google Sheets, LibreOffice Calc or Blob's own spreadsheets. */
const SPREADSHEET_HTML = /urn:schemas-microsoft-com:office:excel|google-sheets-html-origin|data-sheets-|\bsdval=|\bsdnum=|data-blob-sheet/i;

/** A cell needs quotes in TSV and CSV when it holds the separator, a line break or a quote. */
function needsQuotes(cell: string, sep: string) {
  return cell.includes(sep) || cell.includes("\n") || cell.includes("\r") || cell.includes('"');
}

const quote = (cell: string) => `"${cell.replace(/"/g, '""')}"`;

/** Tab-separated text (quotes around cells with tabs, line breaks or quotes, like Excel). */
export function toTsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => (needsQuotes(cell, "\t") ? quote(cell) : cell)).join("\t")).join("\n");
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * How a copied cell goes into the HTML. `num`: its full value, for Excel (x:num), which then
 * calculates with it rather than with the rounded text. `fmt`: its number format as an Excel
 * format code, so Excel shows it the same (a unit too, which the text leaves out).
 */
export type HtmlCellLook = { bold?: boolean; align?: "left" | "center" | "right"; num?: number; fmt?: string };

/** A number as Excel writes x:num ("1E-7", never "-0"). */
const excelNum = (n: number) => (Object.is(n, -0) ? "0" : String(n).replace("e", "E"));

/** An Excel format code as a CSS string (Excel reads mso-number-format with CSS escapes). */
const cssString = (code: string) => `"${code.replace(/[\\"]/g, "\\$&")}"`;

/** An HTML table (escaped), optionally with bold/colour per cell, for pasting into rich editors. */
export function toHtmlTable(rows: string[][], styles?: (HtmlCellLook | null)[][]): string {
  // Light borders so a table pasted into Word or an e-mail is visibly a table; spreadsheets and
  // Blob notes keep only the cells and their text.
  const cell = "border:1px solid #d4d2cb;padding:2px 6px;vertical-align:middle";
  const body = rows
    .map((row, r) => {
      const cells = row.map((text, c) => {
        const look = styles?.[r]?.[c];
        let css = cell;
        if (look?.align) css += `;text-align:${look.align}`;
        if (look?.bold) css += ";font-weight:bold";
        if (look?.fmt) css += `;mso-number-format:${cssString(look.fmt)}`;
        const num = look?.num !== undefined && Number.isFinite(look.num) ? ` x:num="${excelNum(look.num)}"` : "";
        const inner = escHtml(text).replace(/\r\n|\r|\n/g, "<br>");
        // In single quotes like Excel's own, so the format's double quotes need no entities.
        return `<td${num} style='${css.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;")}'>${look?.bold ? `<b>${inner}</b>` : inner}</td>`;
      });
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
  return `<meta charset="utf-8"><table data-blob-sheet="1" xmlns:x="urn:schemas-microsoft-com:office:excel" style="border-collapse:collapse"><tbody>${body}</tbody></table>`;
}

// Delimited text ----------------------------------------------------------------------------------

/**
 * Rows of text separated by `sep`, with quoted fields like Excel and RFC 4180: "a""b" is a"b, and
 * a quoted field may hold the separator and line breaks. A field that only starts with a quote but
 * doesn't end as a quoted field (`"Hallo" sagte sie`) is taken as it is, as Excel writes those.
 * The last line break is no extra row.
 */
export function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = text.length;
  const endRow = () => {
    rows.push(row);
    row = [];
  };
  while (i <= n) {
    if (i === n) {
      // The text ended right after a separator (a last empty cell) or in the middle of a row.
      if (row.length) {
        row.push("");
        endRow();
      }
      break;
    }
    let field: string | null = null;
    let next = i;
    if (text[i] === '"') {
      // A quoted field: up to a quote that isn't doubled, which must be followed by the end of the field.
      let j = i + 1;
      let value = "";
      for (;;) {
        const q = text.indexOf('"', j);
        if (q < 0) break;
        if (text[q + 1] === '"') {
          value += text.slice(j, q + 1);
          j = q + 2;
          continue;
        }
        const after = text[q + 1];
        if (after === undefined || after === sep || after === "\n" || after === "\r") {
          field = value + text.slice(j, q);
          next = q + 1;
        }
        break;
      }
    }
    if (field === null) {
      // Unquoted (or a quote that isn't one): up to the separator or the end of the line.
      let j = i;
      while (j < n && text[j] !== sep && text[j] !== "\n" && text[j] !== "\r") j++;
      field = text.slice(i, j);
      next = j;
    }
    row.push(field);
    const c = text[next];
    if (c === sep) {
      i = next + 1;
      continue;
    }
    // End of line (\n, \r\n or \r) or of the text.
    endRow();
    if (c === "\r" && text[next + 1] === "\n") i = next + 2;
    else if (c === "\r" || c === "\n") i = next + 1;
    else break;
    if (i === n) break;
  }
  return rows;
}

/** How often `sep` appears outside quotes in each line. */
function countsPerLine(text: string, sep: string, maxLines = 30): number[] {
  const counts: number[] = [];
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length && counts.length < maxLines; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && c === "\n") {
      counts.push(count);
      count = 0;
    } else if (!inQuotes && c === sep) count++;
  }
  if (count > 0 || (text.length && !text.endsWith("\n") && counts.length < maxLines)) counts.push(count);
  return counts;
}

const looksNumeric = (s: string) => /^\s*[-+]?[\d.,\s]*\d[\d.,\s]*%?\s*$/.test(s);

/**
 * Text copied from a text file or a web page that is a table without tabs: ";" between values on
 * every line (German CSV), or "," when that is clearly the separator (not a decimal comma). null
 * otherwise. Needs two or more lines, so a sentence with a semicolon stays one value.
 */
function csvishSeparator(plain: string): string | null {
  const body = plain.replace(/\n$/, "");
  if (!body.includes("\n")) return null;
  const lines = body.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;
  for (const sep of [";", ","]) {
    const counts = countsPerLine(lines.join("\n"), sep);
    if (!counts.length || counts[0] < 1 || !counts.every((c) => c === counts[0])) continue;
    if (sep === ",") {
      // "1,5\n2,5" is a column of German numbers, not two columns.
      const fields = lines.slice(0, 30).flatMap((l) => l.split(","));
      if (fields.every(looksNumeric)) continue;
    }
    return sep;
  }
  return null;
}

// HTML tables -------------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  zwj: "",
  zwnj: "",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  deg: "°",
  micro: "µ",
  plusmn: "±",
  times: "×",
  divide: "÷",
  middot: "·",
  sup1: "¹",
  sup2: "²",
  sup3: "³",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  permil: "‰",
  ndash: "–",
  mdash: "—",
  minus: "−",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  sbquo: "‚",
  lsquo: "‘",
  rsquo: "’",
  copy: "©",
  reg: "®",
  trade: "™",
  sect: "§",
  para: "¶",
  bull: "•",
  larr: "←",
  rarr: "→",
  uarr: "↑",
  darr: "↓",
  harr: "↔",
  le: "≤",
  ge: "≥",
  ne: "≠",
  asymp: "≈",
  infin: "∞",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  Delta: "Δ",
  Sigma: "Σ",
  Omega: "Ω",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  aacute: "á",
  ccedil: "ç",
  ntilde: "ñ",
  oslash: "ø",
  aring: "å",
};

/** HTML character references → characters (numeric ones, and the named ones people paste). */
export function decodeHtmlEntities(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);?/g, (m, e: string) => {
    if (e[0] === "#") {
      let code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      // Windows-1252 code points that web pages send as numbers (&#150; is an en dash).
      if (code >= 128 && code <= 159) code = CP1252[code - 128] ?? code;
      if (code === 160) return " ";
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    const v = lookup(ENTITIES, e);
    // A name we don't know stays as it was written ("&foo" in a sentence is just text).
    return v !== undefined && (m.endsWith(";") || v.length) ? v : m;
  });
}

const CP1252: (number | undefined)[] = [
  0x20ac, undefined, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, undefined, 0x017d, undefined,
  undefined, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, undefined, 0x017e, 0x0178,
];

/** Elements whose content is never cell text. */
const SKIP = new Set(["style", "script", "head", "title", "template", "noscript", "object", "svg", "math", "caption", "colgroup", "xml"]);
/** Elements that end a line of text inside a cell. */
const BLOCK = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "blockquote", "dt", "dd", "tr", "ul", "ol"]);

type HtmlCell = { text: string; colspan: number; rowspan: number; num: number | null };
/** A cell of the laid-out table: its text, and the exact number a spreadsheet gave it (or null). */
type GridCell = { text: string; num: number | null };

/**
 * The rows of the HTML tables in a clipboard fragment, as the cells read: line breaks from <br>
 * and paragraphs, spaces collapsed as a browser shows them, character references decoded. Merged
 * cells (colspan/rowspan) are not merged in a sheet: the text goes into the first cell and the
 * cells it covered stay empty, so the columns stay in line. Tables nested inside a cell are read
 * as that cell's text.
 */
export function parseHtmlTable(html: string): string[][] | null {
  return htmlGrid(html)?.map((row) => row.map((c) => c.text)) ?? null;
}

/**
 * The exact number a spreadsheet put on a cell of its HTML: Excel's x:num="…" (a bare x:num means
 * the text is exact), LibreOffice's sdval="…", Google Sheets' data-sheets-value {"1":3,"3":…}
 * (type 3 is a number). null for anything else.
 */
function exactOf(attrs: string): number | null {
  const m = /(?:^|\s)(?:x:num|sdval)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  if (m) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    const n = Number(raw);
    return raw && Number.isFinite(n) ? n : null;
  }
  const g = /(?:^|\s)data-sheets-value\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
  if (!g) return null;
  try {
    const v = JSON.parse(decodeHtmlEntities(g[1] ?? g[2] ?? "")) as Record<string, unknown> | null;
    return v && v["1"] === 3 && typeof v["3"] === "number" && Number.isFinite(v["3"]) ? v["3"] : null;
  } catch {
    return null;
  }
}

function htmlGrid(html: string): GridCell[][] | null {
  // Comments and Office's conditional comments (<!--[if …]> … <![endif]-->) carry no cell text.
  const src = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[(?:if|endif)[^\]]*\]>/gi, "");
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
  const out: HtmlCell[][] = [];
  let depth = 0;
  let row: HtmlCell[] | null = null;
  let cell: { parts: string[]; colspan: number; rowspan: number; num: number | null; depth: number } | null = null;
  let skip: string | null = null;
  let at = 0;
  let m: RegExpExecArray | null;

  const addText = (raw: string) => {
    if (!cell || skip) return;
    cell.parts.push(raw.replace(/[ \t\r\n\f]+/g, " "));
  };
  const lineBreak = () => {
    if (cell && !skip) cell.parts.push("\n");
  };

  while ((m = tagRe.exec(src))) {
    addText(src.slice(at, m.index));
    at = tagRe.lastIndex;
    const closing = m[0][1] === "/";
    const name = m[1].toLowerCase();
    const local = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
    if (skip) {
      if (closing && local === skip) skip = null;
      continue;
    }
    if (!closing && SKIP.has(local) && !m[0].endsWith("/>")) {
      skip = local;
      continue;
    }
    if (local === "table") {
      if (!closing) depth++;
      else {
        depth = Math.max(0, depth - 1);
        if (depth === 0) {
          if (cell) closeCell();
          if (row) closeRow();
        }
      }
      if (depth > 1 || (closing && depth >= 1)) lineBreak();
      continue;
    }
    if (depth !== 1) {
      // Inside a nested table: its rows and cells are text of the outer cell.
      if (depth > 1) {
        if (local === "br" || BLOCK.has(local)) lineBreak();
        else if ((local === "td" || local === "th") && closing) addText(" ");
      }
      continue;
    }
    if (local === "tr") {
      if (cell) closeCell();
      if (row) closeRow();
      if (!closing) row = [];
      continue;
    }
    if (local === "td" || local === "th") {
      if (cell) closeCell();
      if (!closing) {
        row ??= [];
        const attrs = m[2] ?? "";
        cell = { parts: [], colspan: spanAttr(attrs, "colspan"), rowspan: spanAttr(attrs, "rowspan"), num: exactOf(attrs), depth };
      }
      continue;
    }
    if (local === "br") lineBreak();
    else if (BLOCK.has(local)) lineBreak();
  }
  addText(src.slice(at));
  if (cell) closeCell();
  if (row) closeRow();

  function closeCell() {
    if (!cell || !row) {
      cell = null;
      return;
    }
    const text = decodeHtmlEntities(cell.parts.join(""))
      .replace(/ /g, " ")
      .split("\n")
      .map((line) => line.replace(/^ +| +$/g, ""))
      .join("\n")
      .replace(/^\n+|\n+$/g, "")
      .replace(/\n{2,}/g, "\n");
    row.push({ text, colspan: cell.colspan, rowspan: cell.rowspan, num: cell.num });
    cell = null;
  }
  function closeRow() {
    if (row) out.push(row);
    row = null;
  }

  if (!out.length) return null;
  // Lay the cells out on a grid: spans leave empty cells to the right and below.
  const EMPTY: GridCell = { text: "", num: null };
  const grid: GridCell[][] = [];
  const taken: boolean[][] = [];
  out.forEach((cells, r) => {
    grid[r] ??= [];
    taken[r] ??= [];
    let c = 0;
    for (const cellAt of cells) {
      while (taken[r][c]) c++;
      for (let dr = 0; dr < cellAt.rowspan; dr++) {
        const rr = r + dr;
        grid[rr] ??= [];
        taken[rr] ??= [];
        for (let dc = 0; dc < cellAt.colspan; dc++) {
          taken[rr][c + dc] = true;
          grid[rr][c + dc] = dr === 0 && dc === 0 ? { text: cellAt.text, num: cellAt.num } : EMPTY;
        }
      }
      c += cellAt.colspan;
    }
  });
  const width = Math.max(1, ...grid.map((r) => r.length));
  const rows = grid.slice(0, Math.max(out.length, 1)).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? EMPTY));
  // A trailing empty row (Excel's HTML sometimes ends with one) is nothing to paste.
  while (rows.length > 1 && rows[rows.length - 1].every((t) => t.text === "")) rows.pop();
  return rows;
}

// Exact numbers ------------------------------------------------------------------------------------

/** The same text, whatever the spaces (HTML collapses them; Blob puts a thin one before a unit). */
const sameText = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

/**
 * The exact numbers behind a spreadsheet's copy, cell by cell as `rows` (the text that is pasted)
 * has them. Only where the spreadsheet's HTML table lines up with that text: the same number of
 * rows and, for each cell, the same text (a filtered or merged copy that differs leaves those
 * cells to their text). null when there is nothing to use.
 */
export function clipboardNumbers(html: string | undefined, rows: string[][]): (number | null)[][] | null {
  if (!html || !SPREADSHEET_HTML.test(html) || !/<table[\s>]/i.test(html)) return null;
  const grid = htmlGrid(html);
  if (!grid || grid.length !== rows.length) return null;
  let found = false;
  const out = rows.map((row, r) =>
    row.map((text, c) => {
      const cell = grid[r][c];
      if (!cell || cell.num === null || !sameText(cell.text, text)) return null;
      found = true;
      return cell.num;
    }),
  );
  return found ? out : null;
}

/** "0,12" → two decimals (a plain number in the locale's style; undefined for anything else). */
function decimalsShown(text: string, locale: Locale): NumberFormat | undefined {
  const m = (locale === "de" ? /^[-+−]?\d+(?:,(\d+))?$/ : /^[-+−]?\d+(?:\.(\d+))?$/).exec(text.trim());
  return m ? { kind: "number", decimals: m[1]?.length ?? 0 } : undefined;
}

/**
 * Cells pasted as text (pasteText's result) with the exact numbers of the copy: a cell whose text
 * was read as a number gets the full value when that value, shown the way its text is written
 * (decimals, percent, date, unit…), reads the same text, so a number can't land in the wrong cell.
 * A cell without a number format of its own gets the decimals the text showed, so it still looks
 * as it did where it came from. `locale`: the one the text was read in.
 */
export function pasteExactNumbers(wb: Workbook, sheetId: string, at: Pos, rows: string[][], exact: (number | null)[][], locale: Locale): Workbook {
  const sheet = wb.sheets.find((s) => s.id === sheetId);
  if (!sheet) return wb;
  const updates: { row: number; col: number; cell: Cell }[] = [];
  exact.forEach((line, i) =>
    line.forEach((x, j) => {
      const text = rows[i]?.[j];
      const cell = sheet.cells[cellKey(at.row + i, at.col + j)];
      if (x === null || text === undefined || !cell || cell.f !== undefined || typeof cell.v !== "number" || cell.v === x) return;
      const shown = parseInput(text, locale).fmt ?? decimalsShown(text, locale);
      if (!shown || !sameText(formatValue(x, shown, locale), text)) return;
      const fmt = cell.s?.fmt ?? (sameText(formatValue(x, undefined, locale), text) ? undefined : shown);
      updates.push({ row: at.row + i, col: at.col + j, cell: { ...cell, v: x, ...(fmt && !cell.s?.fmt ? { s: { ...cell.s, fmt } } : {}) } });
    }),
  );
  return setCells(wb, sheetId, updates);
}

function spanAttr(attrs: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, "i").exec(attrs);
  const n = m ? Number(m[1]) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 200) : 1;
}
