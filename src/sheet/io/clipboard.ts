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
// number's full value (Excel x:num, LibreOffice sdval, Google Sheets data-sheets-value) and its
// number format: pasting keeps those (clipboardCells, pasteExactNumbers), so 0,12 shown is
// 0,123456789 pasted, as between two spreadsheet programs.
//
// Only as much is read as a sheet can hold (ReadLimit): a pasted text of millions of lines would
// otherwise take the page's memory before a single cell lands.

import type { Locale } from "@/i18n/config";
import { cellKey } from "../a1";
import { formatValue, parseInput } from "../engine";
import { setCells } from "../ops";
import { MAX_COLS, MAX_ROWS, type Cell, type NumberFormat, type Pos, type Workbook } from "../types";
import { fromExcelFormat, fromSigStyle, withoutUnit } from "./formatCodes";
import type { ReadLimit } from "./limits";
import { lookup } from "./lookup";

/** What a paste reads at most: a whole sheet (pass the rows and columns swapped for a transposed paste). */
export const SHEET_LIMIT: ReadLimit = { rows: MAX_ROWS, cols: MAX_COLS };

/** Rows of cell texts from clipboard data; null when it isn't table-like (then paste as one value). */
export function parseClipboard(data: { text?: string; html?: string }, limit: ReadLimit = SHEET_LIMIT): string[][] | null {
  const text = data.text ?? "";
  const plain = text.replace(/\r\n?/g, "\n");
  const html = data.html && /<table[\s>]/i.test(data.html) ? data.html : null;
  let rows: string[][] | null = null;
  // Spreadsheets' own text is exact (their HTML collapses spaces); Word's and web pages' text
  // loses the table (a cell with two paragraphs breaks the line), so their HTML comes first.
  if (html && !SPREADSHEET_HTML.test(html)) rows = parseHtmlTable(html, limit);
  if (!rows && plain.includes("\t")) rows = parseDelimited(text, "\t", limit);
  if (!rows && html) rows = parseHtmlTable(html, limit);
  if (!rows && plain) {
    const sep = csvishSeparator(plain);
    rows = sep ? parseDelimited(text, sep, limit) : plain.replace(/\n$/, "").includes("\n") ? parseDelimited(text, "\t", limit) : null;
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
 * format code, so Excel shows it the same (a unit too, which the text leaves out); a paste into
 * another Blob spreadsheet reads it back. `style`: Blob's named style for significant figures
 * ("Blob sig 3", as in .xlsx files), which no format code can say.
 */
export type HtmlCellLook = { bold?: boolean; align?: "left" | "center" | "right"; num?: number; fmt?: string; style?: string };

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
        const named = look?.style ? ` data-blob-style="${escHtml(look.style)}"` : "";
        const inner = escHtml(text).replace(/\r\n|\r|\n/g, "<br>");
        // In single quotes like Excel's own, so the format's double quotes need no entities.
        return `<td${num}${named} style='${css.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;")}'>${look?.bold ? `<b>${inner}</b>` : inner}</td>`;
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
 * The last line break is no extra row. Reading stops after `limit.rows` rows, and cells after
 * `limit.cols` in a row are left out.
 */
export function parseDelimited(text: string, sep: string, limit: ReadLimit = SHEET_LIMIT): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = text.length;
  const add = (field: string) => {
    if (row.length < limit.cols) row.push(field);
  };
  /** true when no more rows are read. */
  const endRow = () => {
    rows.push(row);
    row = [];
    return rows.length >= limit.rows;
  };
  while (i <= n) {
    if (i === n) {
      // The text ended right after a separator (a last empty cell) or in the middle of a row.
      if (row.length) {
        add("");
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
    add(field);
    const c = text[next];
    if (c === sep) {
      i = next + 1;
      continue;
    }
    // End of line (\n, \r\n or \r) or of the text.
    if (endRow()) break;
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

/** Digits with separators and spaces, a sign before and a percent sign after: a number in some language's style. */
function looksNumeric(s: string): boolean {
  // Step by step, not one pattern: overlapping repeats like [\d\s]*\d[\d\s]* take seconds on a long pasted line.
  let t = s.trim().replace(/^[-+]/, "");
  if (t.endsWith("%")) t = t.slice(0, -1);
  return /\d/.test(t) && /^[\d.,\s]*$/.test(t);
}

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

/**
 * The number format a spreadsheet's HTML gives a cell: an Excel format code (Excel and Blob write
 * mso-number-format, Google Sheets data-sheets-numberformat), true when it gives one in another
 * form (LibreOffice's are written in the language of whoever copied: the text shows it), or null
 * for none (General).
 */
export type CopiedFormat = string | true | null;

/**
 * What a spreadsheet's copy says about a cell besides its text: its exact number (or null), its
 * number format, and Blob's named style for significant figures (see HtmlCellLook).
 */
export type CopiedCell = { num: number | null; format: CopiedFormat; style: string | null };

/** A cell nothing is known about but its text. */
const NOTHING: CopiedCell = { num: null, format: null, style: null };

type HtmlCell = CopiedCell & { text: string; colspan: number; rowspan: number };
/** A cell of the laid-out table: its text, and what a spreadsheet said about it. */
type GridCell = CopiedCell & { text: string };

/**
 * The rows of the HTML tables in a clipboard fragment, as the cells read: line breaks from <br>
 * and paragraphs, spaces collapsed as a browser shows them, character references decoded. Merged
 * cells (colspan/rowspan) are not merged in a sheet: the text goes into the first cell and the
 * cells it covered stay empty, so the columns stay in line. Tables nested inside a cell are read
 * as that cell's text. At most `limit.rows` rows and `limit.cols` columns are read.
 */
export function parseHtmlTable(html: string, limit: ReadLimit = SHEET_LIMIT): string[][] | null {
  return htmlGrid(html, limit)?.map((row) => row.map((c) => c.text)) ?? null;
}

/** Excel's names for its built-in formats in mso-number-format (Blob writes two of them too). */
const MSO_NAMES: Record<string, string> = {
  general: "General",
  "general number": "General",
  fixed: "0.00",
  standard: "#,##0.00",
  percent: "0.00%",
  scientific: "0.00E+00",
  "short date": "mm-dd-yy",
  "medium date": "dd-mmm-yy",
  "long date": "dddd, mmmm d, yyyy",
  "general date": "m/d/yy h:mm",
  "short time": "h:mm",
  "medium time": "h:mm AM/PM",
  "long time": "h:mm:ss",
};

/** CSS text with its escapes resolved ("0\.00" → "0.00", "\0022" → a quote). */
const cssUnescape = (s: string) =>
  s.replace(/\\(?:([0-9a-fA-F]{1,6})[ \t\r\n\f]?|([\s\S]))/g, (_, hex: string | undefined, ch: string | undefined) => {
    if (hex === undefined) return ch ?? "";
    const code = parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });

/** The format code in CSS declarations ("mso-number-format:Percent"), or null without one. */
function msoNumberFormat(css: string): string | null {
  const m = /mso-number-format\s*:\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|([^;"'{}]*))/i.exec(css);
  if (!m) return null;
  const code = cssUnescape(m[1] ?? m[2] ?? m[3] ?? "").trim();
  return code ? (lookup(MSO_NAMES, code.toLowerCase()) ?? code) : null;
}

/**
 * Excel's formats by class: its HTML defines them in <style> (.xl65 {mso-number-format:"0\.00";})
 * and gives each cell a class. Found with indexOf, so a <style> without an end costs one search.
 */
function classFormats(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const lower = html.toLowerCase();
  for (let at = 0; ; ) {
    const open = lower.indexOf("<style", at);
    const start = open < 0 ? -1 : lower.indexOf(">", open);
    const close = start < 0 ? -1 : lower.indexOf("</style", start);
    if (close < 0) break;
    // A rule's body ends at the next brace: "{" without "}" can't make the search run on.
    for (const rule of html.slice(start + 1, close).matchAll(/\.([\w-]+)\s*\{([^{}]*)\}/g)) {
      const code = msoNumberFormat(rule[2]);
      if (code !== null) out.set(rule[1].toLowerCase(), code);
    }
    at = close + 7;
  }
  return out;
}

const ATTRS = new Map<string, RegExp>();

/** An attribute's value from a tag's attribute text (entities decoded), or null. */
function attrValue(attrs: string, name: string): string | null {
  let re = ATTRS.get(name);
  if (!re) ATTRS.set(name, (re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i")));
  const m = re.exec(attrs);
  return m ? decodeHtmlEntities(m[1] ?? m[2] ?? m[3] ?? "") : null;
}

/** The number format a cell of a spreadsheet's HTML declares (see CopiedFormat). */
function formatOf(attrs: string, classes: Map<string, string> | null): CopiedFormat {
  const style = attrValue(attrs, "style");
  let code = style ? msoNumberFormat(style) : null;
  if (code === null && classes?.size) {
    for (const name of (attrValue(attrs, "class") ?? "").toLowerCase().split(/\s+/)) {
      code = classes.get(name) ?? null;
      if (code !== null) break;
    }
  }
  if (code === null) {
    // Google Sheets: data-sheets-numberformat='{"1":2,"2":"0.00","3":1}' (2: its pattern).
    const g = attrValue(attrs, "data-sheets-numberformat");
    if (g !== null) {
      try {
        const v = JSON.parse(g) as Record<string, unknown> | null;
        code = v && typeof v["2"] === "string" && v["2"] ? v["2"] : null;
      } catch {
        // Not readable: the text shows the format.
      }
      if (code === null) return true;
    }
  }
  if (code === null) {
    // LibreOffice: sdnum="1031;0;0,00" (language; ?; its format code in that language).
    const lo = attrValue(attrs, "sdnum");
    const own = lo?.split(";").slice(2).join(";").trim();
    return own && !/^(standard|general)$/i.test(own) ? true : null;
  }
  return /^general$/i.test(code) ? null : code;
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

/** HTML without its comments; one that isn't closed runs to the end, as in a browser. */
function withoutComments(html: string): string {
  if (!html.includes("<!--")) return html;
  // indexOf, not /<!--[\s\S]*?-->/: each unclosed "<!--" would search the rest of the text again.
  let out = "";
  let at = 0;
  for (;;) {
    const open = html.indexOf("<!--", at);
    if (open < 0) break;
    out += html.slice(at, open);
    const close = html.indexOf("-->", open + 4);
    at = close < 0 ? html.length : close + 3;
  }
  return out + html.slice(at);
}

/**
 * The table laid out as rows of cells, at most `limit.rows` by `limit.cols`. `copied`: also read
 * what a spreadsheet says about each cell (its number and format), else only the text.
 */
function htmlGrid(html: string, limit: ReadLimit, copied = false): GridCell[][] | null {
  // Spreadsheets' number formats: Excel gives them by class, in a <style> inside a comment.
  const classes = copied && html.includes("mso-number-format") ? classFormats(html) : null;
  // Comments and Office's conditional comments (<!--[if …]> … <![endif]-->) carry no cell text.
  const src = withoutComments(html).replace(/<!\[(?:if|endif)[^\]<>]*\]>/gi, "");
  // A tag's attributes never run past the next "<" (outside quotes): an unclosed tag then costs
  // only its own length, not the rest of the text (which made long broken HTML take minutes).
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9:-]*)((?:\s+[^\s=>/<]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s><]+))?)*)\s*\/?>/g;
  const out: HtmlCell[][] = [];
  let depth = 0;
  let row: HtmlCell[] | null = null;
  let cell: (CopiedCell & { parts: string[]; colspan: number; rowspan: number; depth: number }) | null = null;
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

  while ((m = tagRe.exec(src)) && out.length < limit.rows) {
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
        const about: CopiedCell = copied ? { num: exactOf(attrs), format: formatOf(attrs, classes), style: attrValue(attrs, "data-blob-style") } : NOTHING;
        cell = { parts: [], colspan: spanAttr(attrs, "colspan"), rowspan: spanAttr(attrs, "rowspan"), ...about, depth };
      }
      continue;
    }
    if (local === "br") lineBreak();
    else if (BLOCK.has(local)) lineBreak();
  }
  if (out.length < limit.rows) {
    addText(src.slice(at));
    if (cell) closeCell();
    if (row) closeRow();
  }

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
    // Cells past the last column read can't land anywhere.
    if (row.length < limit.cols) row.push({ text, colspan: cell.colspan, rowspan: cell.rowspan, num: cell.num, format: cell.format, style: cell.style });
    cell = null;
  }
  function closeRow() {
    if (row) out.push(row);
    row = null;
  }

  if (!out.length) return null;
  // Lay the cells out on a grid: spans leave empty cells to the right and below (as far as read).
  const EMPTY: GridCell = { text: "", ...NOTHING };
  const grid: GridCell[][] = [];
  const taken: boolean[][] = [];
  out.forEach((cells, r) => {
    grid[r] ??= [];
    taken[r] ??= [];
    let c = 0;
    for (const cellAt of cells) {
      while (taken[r][c]) c++;
      if (c >= limit.cols) break;
      for (let dr = 0; dr < cellAt.rowspan && r + dr < out.length; dr++) {
        const rr = r + dr;
        grid[rr] ??= [];
        taken[rr] ??= [];
        for (let dc = 0; dc < cellAt.colspan && c + dc < limit.cols; dc++) {
          taken[rr][c + dc] = true;
          grid[rr][c + dc] = dr === 0 && dc === 0 ? { text: cellAt.text, num: cellAt.num, format: cellAt.format, style: cellAt.style } : EMPTY;
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
 * Cells pasted as text (pasteText's result) with the exact numbers of the copy. A cell gets the
 * full value only when its text was read plainly as a number (not, say, divided by 100 for a
 * percent cell) and that value, shown the way the text is written (decimals, percent, date,
 * unit…), gives the same text: so a number can't land in the wrong cell. A cell without a number
 * format of its own gets the one the text showed (0,12 stays 0,12 on screen, 0,123456789 inside).
 * `locale`: the one the text was read in.
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
      const plain = parseInput(text, locale);
      if (plain.cell.v !== cell.v) return;
      const shown = plain.fmt ?? decimalsShown(text, locale);
      if (!shown || !sameText(formatValue(x, shown, locale), text)) return;
      const fmt = cell.s?.fmt ? undefined : shown;
      updates.push({ row: at.row + i, col: at.col + j, cell: { ...cell, v: x, ...(fmt ? { s: { ...cell.s, fmt } } : {}) } });
    }),
  );
  return setCells(wb, sheetId, updates);
}

function spanAttr(attrs: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, "i").exec(attrs);
  const n = m ? Number(m[1]) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 200) : 1;
}
