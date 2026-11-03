// Excel files (.xlsx): export a workbook (values, formulas, number formats, bold/italic, fills,
// column widths, frozen panes, every sheet) and import one (the same, as far as Blob supports it).
// Written without libraries: an .xlsx is a zip of XML files.
//
// CONTRACT: keep names and signatures.
//
// The parts written (SpreadsheetML, ECMA-376), each in the order Excel itself writes its elements:
//   [Content_Types].xml, _rels/.rels, docProps/app.xml, docProps/core.xml
//   xl/workbook.xml (+ _rels), xl/styles.xml, xl/sharedStrings.xml
//   xl/worksheets/sheetN.xml (+ _rels: its smart tables and notes)
//   xl/tables/tableN.xml (smart tables become Excel tables, in Blob's colours as custom table styles)
//   xl/commentsN.xml + xl/drawings/vmlDrawingN.vml (cell notes become Excel notes)
//   xl/drawings/drawingN.xml + xl/charts/chartN.xml (charts, with trendlines and error bars: xlsxCharts.ts)
// Formulas are written as Blob stores them (Excel's own syntax), with "_xlfn." before newer
// functions, and with their current values, so viewers that don't calculate (previews, phones)
// show the numbers; Excel calculates everything again when it opens the file.

import type { Locale } from "@/i18n/config";
import { sheetIoText, type SheetIoText } from "@/i18n/messages/sheetIo";
import { areaName, cellKey, colIndex, colName } from "../a1";
import { COLOR_HEX } from "../colors";
import { adjustFormula, formatValue, getFunction, shiftFormula, toCanonicalFormula, type Calc, type CellValue } from "../engine";
import { newId } from "../ops";
import { totalOfCell } from "../table/totals";
import {
  DEFAULT_COL_W,
  DEFAULT_ROW_H,
  DEFAULT_SIZE,
  MAX_COLS,
  MAX_ROWS,
  type Area,
  type BorderLine,
  type Cell,
  type CellStyle,
  type ChartSpec,
  type FilterSpec,
  type NumberFormat,
  type Sheet,
  type TableColumn,
  type TableSpec,
  type TableStyle,
  type TotalFn,
  type Workbook,
} from "../types";
import { attr, boolAttr, child, children, descendants, escAttr, escText, lookup, numAttr, parseXml, textOf, XML_HEAD, XmlError, xmlBudget, type XmlBudget, type XmlEl } from "./xml";
import { chartFromXml, chartXml, drawingXml, EMU } from "./xlsxCharts";
import { calledFunctions, importFormula, stripPrefixes, toFileFormula, type FileTable, type FormulaContext } from "./xlsxFormulas";
import {
  applyTint,
  argb,
  BORDER_TO_EXCEL,
  borderFromExcel,
  builtinFormat,
  EXCEL_FONT_PT,
  fillArgb,
  fromExcelFormat,
  fromSigStyle,
  heightToPx,
  INDEXED_COLORS,
  mixWhite,
  nearestSheetColor,
  OFFICE_THEME,
  ptToPx,
  pxToHeight,
  pxToPt,
  pxToWidth,
  sigStyleName,
  TABLE_STYLE_NAME,
  tableStyleFromExcel,
  textArgb,
  toExcelFormat,
  widthToPx,
} from "./xlsxStyles";
import { makeZip, readZip, ZipError, type ZipReader } from "./zip";

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.spreadsheetml";
/** Excel's limit for the text of one cell. */
const MAX_TEXT = 32767;
/** Characters of a formula (Excel's limit; Blob can't store longer ones, src/sheet/doc.ts). */
const MAX_FORMULA = 8192;
/** Sheets of one spreadsheet (Blob keeps at most this many, src/sheet/doc.ts). */
const MAX_SHEETS = 250;

/** Why an Excel file can't be read; `message` says it in the user's language. */
export class XlsxError extends Error {
  constructor(
    public code: keyof SheetIoText["errors"],
    locale: Locale,
  ) {
    super(sheetIoText[locale].errors[code]);
  }
}

/**
 * Text for SpreadsheetML strings: characters XML can't carry become _xHHHH_ (Excel's escape), and
 * text that already looks like such an escape is protected (_x005F_ is the underscore).
 */
function xstring(s: string, inAttribute = false): string {
  let out = s.replace(/_x([0-9A-Fa-f]{4})_/g, "_x005F_x$1_");
  out = out.replace(inAttribute ? /[\u0000-\u001F￾￿]/g : /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, (c) => `_x${c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}_`);
  return out;
}

/** _xHHHH_ escapes → characters. */
const unxstring = (s: string) => (s.includes("_x") ? s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : s);

/** A number as the file writes it (no "-0", no NaN). */
function numText(n: number): string {
  if (Object.is(n, -0)) return "0";
  return String(n);
}

// =================================================================================================
// Export
// =================================================================================================

/** Sheet names Excel accepts: 1–31 characters, none of []:*?/\, no ' at either end, unique, not "History". */
function excelSheetNames(sheets: Sheet[], locale: Locale): string[] {
  const used = new Set<string>();
  return sheets.map((s, i) => {
    let name = s.name.replace(/[[\]:*?/\\]/g, "_").replace(/^'+|'+$/g, "").trim().slice(0, 31) || sheetIoText[locale].sheet(i + 1);
    if (name.toLowerCase() === "history") name = `${name} (1)`;
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      candidate = name.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** A table name Excel accepts: letters, digits, "_" and "."; starts with a letter or "_"; not like a cell; unique. */
function excelTableName(name: string, used: Set<string>): string {
  let s = name.normalize("NFC").replace(/[^\p{L}\p{N}_.\\]/gu, "_");
  if (!/^[\p{L}_\\]/u.test(s)) s = `_${s}`;
  if (/^[A-Za-z]{1,3}[0-9]+$/.test(s) || /^[RrCc]$/.test(s) || /^[Rr][0-9]*[Cc][0-9]*$/.test(s)) s = `_${s}`;
  s = s.slice(0, 200);
  let candidate = s;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${s}_${n}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/** `named`: a named cell style the cell's format belongs to (significant figures, see sigStyleName). */
type StyleKey = { fmt: { id: number } | { code: string }; style: CellStyle | undefined; named?: string };

/** styles.xml, built up while the sheets are written: every distinct look gets one cell format (xf). */
class StyleSheet {
  private numFmts = new Map<string, number>();
  private fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  private fontIds = new Map<string, number>([[this.fonts[0], 0]]);
  private fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private fillIds = new Map<string, number>();
  private borders: string[] = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  private borderIds = new Map<string, number>([[this.borders[0], 0]]);
  /** Every cell gets vertical centring: Blob's cells are centred, Excel's sit at the bottom. */
  private xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>'];
  private xfIds = new Map<string, number>([[this.xfs[0], 0]]);
  private dxfs: string[] = [];
  private tableStyles = new Map<TableStyle, string>();
  /** Named cell styles after "Normal": the name at index i is cell style xf i + 1. */
  private named: string[] = [];

  private intern(list: string[], ids: Map<string, number>, xml: string): number {
    let id = ids.get(xml);
    if (id === undefined) {
      id = list.length;
      list.push(xml);
      ids.set(xml, id);
    }
    return id;
  }

  private numFmtId(fmt: { id: number } | { code: string }): number {
    if ("id" in fmt) return fmt.id;
    let id = this.numFmts.get(fmt.code);
    if (id === undefined) {
      id = 164 + this.numFmts.size;
      this.numFmts.set(fmt.code, id);
    }
    return id;
  }

  /** The cell format for a look and number format. */
  xf({ fmt, style, named }: StyleKey): number {
    const s = style ?? {};
    const numFmtId = this.numFmtId(fmt);
    let xfId = 0;
    if (named) {
      xfId = this.named.indexOf(named) + 1;
      if (!xfId) xfId = this.named.push(named);
    }
    let font = "<font>";
    if (s.bold) font += "<b/>";
    if (s.italic) font += "<i/>";
    if (s.strike) font += "<strike/>";
    if (s.underline) font += "<u/>";
    font += `<sz val="${s.size ? pxToPt(s.size) : EXCEL_FONT_PT}"/>`;
    if (s.color) font += `<color rgb="${textArgb(s.color)}"/>`;
    font += '<name val="Calibri"/><family val="2"/></font>';
    const fontId = this.intern(this.fonts, this.fontIds, font);
    const fillId = s.fill ? this.intern(this.fills, this.fillIds, `<fill><patternFill patternType="solid"><fgColor rgb="${fillArgb(s.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    let borderId = 0;
    const b = s.border;
    if (b && (b.left || b.right || b.top || b.bottom)) {
      const side = (name: string, line: BorderLine | undefined) => (line ? `<${name} style="${BORDER_TO_EXCEL[line]}"><color indexed="64"/></${name}>` : `<${name}/>`);
      borderId = this.intern(this.borders, this.borderIds, `<border>${side("left", b.left)}${side("right", b.right)}${side("top", b.top)}${side("bottom", b.bottom)}<diagonal/></border>`);
    }
    const horizontal = s.align ? ` horizontal="${s.align}"` : "";
    const vertical = ` vertical="${s.valign === "top" ? "top" : s.valign === "bottom" ? "bottom" : "center"}"`;
    const wrap = s.wrap ? ' wrapText="1"' : "";
    const xml =
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="${xfId}"` +
      (numFmtId ? ' applyNumberFormat="1"' : "") +
      (fontId ? ' applyFont="1"' : "") +
      (fillId ? ' applyFill="1"' : "") +
      (borderId ? ' applyBorder="1"' : "") +
      ` applyAlignment="1"><alignment${horizontal}${vertical}${wrap}/></xf>`;
    return this.intern(this.xfs, this.xfIds, xml);
  }

  /** A custom table style in Blob's colours: tinted bold header, light bands, a bold totals row. */
  tableStyle(style: TableStyle): string {
    const known = this.tableStyles.get(style);
    if (known) return known;
    const name = TABLE_STYLE_NAME(style);
    const strong = argb(COLOR_HEX[style].light);
    const header = this.dxfs.length;
    this.dxfs.push(`<dxf><font><b/></font><fill><patternFill patternType="solid"><bgColor rgb="${fillArgb(style)}"/></patternFill></fill><border><bottom style="thin"><color rgb="${strong}"/></bottom></border></dxf>`);
    const band = this.dxfs.length;
    this.dxfs.push(`<dxf><fill><patternFill patternType="solid"><bgColor rgb="${argb(mixWhite(COLOR_HEX[style].fill, 0.45))}"/></patternFill></fill></dxf>`);
    const totals = this.dxfs.length;
    this.dxfs.push(`<dxf><font><b/></font><border><top style="double"><color rgb="${strong}"/></top></border></dxf>`);
    this.tableStyles.set(
      style,
      `<tableStyle name="${escAttr(name)}" pivot="0" count="3"><tableStyleElement type="headerRow" dxfId="${header}"/><tableStyleElement type="totalRow" dxfId="${totals}"/><tableStyleElement type="firstRowStripe" dxfId="${band}"/></tableStyle>`,
    );
    return name;
  }

  xml(): string {
    const fmts = [...this.numFmts].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escAttr(code)}"/>`).join("");
    const styles = [...this.tableStyles.values()];
    return (
      XML_HEAD +
      `<styleSheet xmlns="${NS_MAIN}">` +
      (fmts ? `<numFmts count="${this.numFmts.size}">${fmts}</numFmts>` : "") +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders>` +
      // Named styles look like "Normal": the cells that use one carry their own look.
      `<cellStyleXfs count="${this.named.length + 1}">${'<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'.repeat(this.named.length + 1)}</cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      `<cellStyles count="${this.named.length + 1}"><cellStyle name="Normal" xfId="0" builtinId="0"/>${this.named.map((name, i) => `<cellStyle name="${escAttr(name)}" xfId="${i + 1}"/>`).join("")}</cellStyles>` +
      `<dxfs count="${this.dxfs.length}">${this.dxfs.join("")}</dxfs>` +
      `<tableStyles count="${styles.length}" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16">${styles.join("")}</tableStyles>` +
      "</styleSheet>"
    );
  }
}

/** Shared strings: every text once, cells point at it by number. */
class Strings {
  private ids = new Map<string, number>();
  private list: string[] = [];
  count = 0;
  id(s: string): number {
    this.count++;
    let id = this.ids.get(s);
    if (id === undefined) {
      id = this.list.length;
      this.list.push(s);
      this.ids.set(s, id);
    }
    return id;
  }
  xml(): string {
    const items = this.list.map((s) => `<si><t xml:space="preserve">${escText(xstring(s))}</t></si>`).join("");
    return XML_HEAD + `<sst xmlns="${NS_MAIN}" count="${this.count}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

const ERROR_FILE: Partial<Record<string, string>> = {
  "#DIV/0!": "#DIV/0!",
  "#N/A": "#N/A",
  "#NAME?": "#NAME?",
  "#NULL!": "#NULL!",
  "#NUM!": "#NUM!",
  "#REF!": "#REF!",
  "#VALUE!": "#VALUE!",
};

/** The <c> element of one cell (null when there is nothing to write). */
function cellXml(ref: string, xf: number, cell: Cell | undefined, value: CellValue, strings: Strings, override?: string): string | null {
  const s = xf ? ` s="${xf}"` : "";
  if (override !== undefined) return `<c r="${ref}"${s} t="s"><v>${strings.id(override)}</v></c>`;
  if (cell?.f !== undefined && cell.f !== "") {
    const f = `<f>${escText(toFileFormula(cell.f))}</f>`;
    if (value === null) return `<c r="${ref}"${s}>${f}</c>`;
    if (typeof value === "number") return Number.isFinite(value) ? `<c r="${ref}"${s}>${f}<v>${numText(value)}</v></c>` : `<c r="${ref}"${s} t="e">${f}<v>#NUM!</v></c>`;
    if (typeof value === "boolean") return `<c r="${ref}"${s} t="b">${f}<v>${value ? 1 : 0}</v></c>`;
    if (typeof value === "string") return `<c r="${ref}"${s} t="str">${f}<v>${escText(xstring(value.slice(0, MAX_TEXT)))}</v></c>`;
    const code = ERROR_FILE[value.error];
    return code ? `<c r="${ref}"${s} t="e">${f}<v>${escText(code)}</v></c>` : `<c r="${ref}"${s}>${f}</c>`;
  }
  const v = cell?.v;
  if (v === undefined || v === "") return xf ? `<c r="${ref}"${s}/>` : null;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${numText(v)}</v></c>` : null;
  if (typeof v === "boolean") return `<c r="${ref}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${s} t="s"><v>${strings.id(v.slice(0, MAX_TEXT))}</v></c>`;
}

/** The <cols> element: Blob's widths in Excel's units, neighbours with the same width merged. */
function colsXml(sheet: Sheet): string {
  const entries = Object.entries(sheet.cols)
    .map(([k, v]) => ({ col: Number(k), w: v.w, hidden: !!v.hidden }))
    .filter((c) => Number.isInteger(c.col) && c.col >= 0 && c.col < MAX_COLS && (c.w !== undefined || c.hidden))
    .sort((a, b) => a.col - b.col);
  const runs: { min: number; max: number; w: number; hidden: boolean }[] = [];
  for (const e of entries) {
    const w = e.w ?? DEFAULT_COL_W;
    const last = runs[runs.length - 1];
    if (last && last.max === e.col - 1 && last.w === w && last.hidden === e.hidden) last.max = e.col;
    else runs.push({ min: e.col, max: e.col, w, hidden: e.hidden });
  }
  if (!runs.length) return "";
  return `<cols>${runs.map((r) => `<col min="${r.min + 1}" max="${r.max + 1}" width="${pxToWidth(r.w)}" customWidth="1"${r.hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>`;
}

function paneXml(sheet: Sheet): string {
  const rows = Math.max(0, Math.min(sheet.freeze.rows, MAX_ROWS - 1));
  const cols = Math.max(0, Math.min(sheet.freeze.cols, MAX_COLS - 1));
  if (!rows && !cols) return "";
  const top = `${colName(cols)}${rows + 1}`;
  const pane = rows && cols ? "bottomRight" : rows ? "bottomLeft" : "topRight";
  return (
    `<pane${cols ? ` xSplit="${cols}"` : ""}${rows ? ` ySplit="${rows}"` : ""} topLeftCell="${top}" activePane="${pane}" state="frozen"/>` +
    `<selection pane="${pane}" activeCell="${top}" sqref="${top}"/>`
  );
}

/** Excel's notes need a drawing of their yellow boxes in the old VML format, one shape per note. */
function vmlXml(notes: { row: number; col: number }[], sheetNo: number): string {
  const shapes = notes
    .map(
      (n, i) =>
        `<v:shape id="_x0000_s${sheetNo * 1024 + i + 1}" type="#_x0000_t202" style="position:absolute;margin-left:59.25pt;margin-top:1.5pt;width:144pt;height:72pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">` +
        '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>' +
        '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>' +
        `<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${n.col + 1}, 15, ${Math.max(0, n.row - 1)}, 10, ${n.col + 3}, 15, ${n.row + 4}, 4</x:Anchor>` +
        `<x:AutoFill>False</x:AutoFill><x:Row>${n.row}</x:Row><x:Column>${n.col}</x:Column></x:ClientData></v:shape>`,
    )
    .join("");
  return (
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${sheetNo}"/></o:shapelayout>` +
    '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' +
    shapes +
    "</xml>"
  );
}

const TOTAL_FN_LABEL = /^[^=]/;

export async function exportXlsx(wb: Workbook, calc: Calc, locale: Locale): Promise<Blob> {
  const enc = new TextEncoder();
  const files: { name: string; data: string; type?: string }[] = [];
  const styles = new StyleSheet();
  const strings = new Strings();
  const names = excelSheetNames(wb.sheets, locale);
  const tableNames = new Set<string>();
  // Formulas name sheets: a name Excel couldn't take is changed in every formula too.
  const renames = wb.sheets
    .map((s, i) => ({ from: s.name, to: names[i] }))
    .filter((r) => r.from !== r.to);
  const fileFormula = (f: string, host: string): string => {
    if (!renames.length) return f;
    let out = f;
    // Through temporary names, so a sheet renamed to another sheet's old name can't be mixed up.
    renames.forEach((r, i) => (out = safeAdjust(out, host, { kind: "renameSheet", from: r.from, to: `\u0001${i}` })));
    renames.forEach((r, i) => (out = safeAdjust(out, host, { kind: "renameSheet", from: `\u0001${i}`, to: r.to })));
    return out;
  };

  const contentTypes: string[] = [];
  const sheetRels: string[] = [];
  let tableNo = 0;
  let commentNo = 0;
  let chartNo = 0;
  let drawingNo = 0;
  const active = 0;

  wb.sheets.forEach((sheet, si) => {
    const sheetNo = si + 1;
    const rels: string[] = [];
    // Smart tables on this sheet: their headers must be unique texts, the column names.
    const tables = wb.tables.filter((t) => t.sheetId === sheet.id);
    const headerText = new Map<string, string>();
    const tableXml: { file: string; rel: string }[] = [];
    for (const t of tables) {
      const a = t.area;
      if (a.r1 < a.r0 + (t.totals ? 1 : 0) || a.r1 >= MAX_ROWS || a.c1 >= MAX_COLS) continue;
      const used = new Set<string>();
      const cols = Array.from({ length: a.c1 - a.c0 + 1 }, (_, i) => {
        const c = a.c0 + i;
        const cell = sheet.cells[cellKey(a.r0, c)];
        const value = cell ? safeValue(calc, sheet.id, a.r0, c) : null;
        let name = (value === null ? "" : typeof value === "string" ? value : formatValue(value, cell?.s?.fmt, locale)).replace(/\r\n?/g, "\n").trim();
        if (!name) name = `${locale === "de" ? "Spalte" : "Column"}${i + 1}`;
        let candidate = name;
        for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${name}${n}`;
        used.add(candidate.toLowerCase());
        headerText.set(cellKey(a.r0, c), candidate);
        // The totals row: a label (text) or a formula of the column.
        let totals = "";
        if (t.totals) {
          const tc = sheet.cells[cellKey(a.r1, c)];
          if (tc?.f) totals = ` totalsRowFunction="custom"><totalsRowFormula>${escText(toFileFormula(fileFormula(tc.f, sheet.name)))}</totalsRowFormula></tableColumn>`;
          else if (typeof tc?.v === "string" && tc.v && TOTAL_FN_LABEL.test(tc.v)) totals = ` totalsRowLabel="${escAttr(xstring(tc.v, true))}"/>`;
        }
        return `<tableColumn id="${i + 1}" name="${escAttr(xstring(candidate, true))}"${totals || "/>"}`;
      });
      tableNo++;
      const name = excelTableName(t.name, tableNames);
      const filterEnd = t.totals ? a.r1 - 1 : a.r1;
      const xml =
        XML_HEAD +
        `<table xmlns="${NS_MAIN}" id="${tableNo}" name="${escAttr(name)}" displayName="${escAttr(name)}" ref="${areaName(a)}"${t.totals ? ' totalsRowCount="1"' : ' totalsRowShown="0"'}>` +
        `<autoFilter ref="${areaName({ ...a, r1: Math.max(a.r0, filterEnd) })}"/>` +
        `<tableColumns count="${cols.length}">${cols.join("")}</tableColumns>` +
        `<tableStyleInfo name="${escAttr(styles.tableStyle(t.style))}" showFirstColumn="0" showLastColumn="0" showRowStripes="${t.banded ? 1 : 0}" showColumnStripes="0"/>` +
        "</table>";
      const file = `xl/tables/table${tableNo}.xml`;
      files.push({ name: file, data: xml });
      contentTypes.push(`<Override PartName="/${file}" ContentType="${CT}.table+xml"/>`);
      tableXml.push({ file, rel: `rId${rels.length + 1}` });
      rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/table" Target="../tables/table${tableNo}.xml"/>`);
    }

    // The cells, row by row.
    const byRow = new Map<number, { col: number; key: string }[]>();
    let maxRow = -1;
    let maxCol = -1;
    for (const key of Object.keys(sheet.cells)) {
      const i = key.indexOf(",");
      const row = Number(key.slice(0, i));
      const col = Number(key.slice(i + 1));
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= MAX_ROWS || col >= MAX_COLS) continue;
      let list = byRow.get(row);
      if (!list) byRow.set(row, (list = []));
      list.push({ col, key });
    }
    // A smart table's empty header cell gets its column name written into it (Excel requires one).
    for (const key of headerText.keys()) {
      if (sheet.cells[key]) continue;
      const i = key.indexOf(",");
      const row = Number(key.slice(0, i));
      let list = byRow.get(row);
      if (!list) byRow.set(row, (list = []));
      list.push({ col: Number(key.slice(i + 1)), key });
    }
    const rowProps = new Map<number, { h?: number; hidden?: boolean }>();
    for (const [k, v] of Object.entries(sheet.rows)) {
      const r = Number(k);
      if (Number.isInteger(r) && r >= 0 && r < MAX_ROWS && (v.h !== undefined || v.hidden)) rowProps.set(r, v);
    }
    const rowsOut: string[] = [];
    const notes: { row: number; col: number; text: string }[] = [];
    const allRows = [...new Set([...byRow.keys(), ...rowProps.keys()])].sort((a, b) => a - b);
    for (const r of allRows) {
      const cells = (byRow.get(r) ?? []).sort((a, b) => a.col - b.col);
      const parts: string[] = [];
      for (const { col, key } of cells) {
        const cell: Cell = sheet.cells[key] ?? {};
        const formula = cell.f ? fileFormula(cell.f, sheet.name) : undefined;
        const value = cell.f ? safeValue(calc, sheet.id, r, col) : null;
        const xf = cell.s ? styles.xf({ fmt: toExcelFormat(cell.s.fmt, locale, typeof value === "number" ? value : cell.v), style: cell.s, named: sigStyleName(cell.s.fmt) }) : 0;
        const xml = cellXml(`${colName(col)}${r + 1}`, xf, formula !== undefined ? { ...cell, f: formula } : cell, value, strings, headerText.get(key));
        if (xml) {
          parts.push(xml);
          if (r > maxRow) maxRow = r;
          if (col > maxCol) maxCol = col;
        }
        if (cell.note?.trim()) notes.push({ row: r, col, text: cell.note });
      }
      const props = rowProps.get(r);
      const attrs = (props?.h !== undefined ? ` ht="${pxToHeight(props.h)}" customHeight="1"` : "") + (props?.hidden ? ' hidden="1"' : "");
      if (parts.length || attrs) rowsOut.push(parts.length ? `<row r="${r + 1}"${attrs}>${parts.join("")}</row>` : `<row r="${r + 1}"${attrs}/>`);
    }

    // Notes: Excel's comments, with their (hidden) yellow boxes.
    let legacy = "";
    if (notes.length) {
      commentNo++;
      const t = sheetIoText[locale];
      const comments =
        XML_HEAD +
        `<comments xmlns="${NS_MAIN}"><authors><author>${escText(t.author)}</author></authors><commentList>` +
        notes.map((n) => `<comment ref="${colName(n.col)}${n.row + 1}" authorId="0"><text><t xml:space="preserve">${escText(xstring(n.text.slice(0, MAX_TEXT)))}</t></text></comment>`).join("") +
        "</commentList></comments>";
      files.push({ name: `xl/comments${commentNo}.xml`, data: comments });
      files.push({ name: `xl/drawings/vmlDrawing${commentNo}.vml`, data: vmlXml(notes, sheetNo) });
      contentTypes.push(`<Override PartName="/xl/comments${commentNo}.xml" ContentType="${CT}.comments+xml"/>`);
      rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/comments" Target="../comments${commentNo}.xml"/>`);
      rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/vmlDrawing" Target="../drawings/vmlDrawing${commentNo}.vml"/>`);
      legacy = `<legacyDrawing r:id="rId${rels.length}"/>`;
    }

    // Charts: a drawing of the sheet holds them, each in a chart part of its own.
    let drawing = "";
    const sheetCharts = wb.charts.filter((c) => c.sheetId === sheet.id);
    if (sheetCharts.length) {
      const placed: { spec: (typeof sheetCharts)[number]; rel: string; id: number }[] = [];
      const drawingRels: string[] = [];
      for (const spec of sheetCharts) {
        let xml: string | null = null;
        try {
          xml = chartXml(spec, calc, (id) => names[wb.sheets.findIndex((x) => x.id === id)], chartNo + 1, locale);
        } catch {
          xml = null;
        }
        if (!xml) continue;
        chartNo++;
        files.push({ name: `xl/charts/chart${chartNo}.xml`, data: xml });
        contentTypes.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        const rel = `rId${drawingRels.length + 1}`;
        drawingRels.push(`<Relationship Id="${rel}" Type="${REL}/chart" Target="../charts/chart${chartNo}.xml"/>`);
        placed.push({ spec, rel, id: placed.length + 1 });
      }
      if (placed.length) {
        drawingNo++;
        files.push({ name: `xl/drawings/drawing${drawingNo}.xml`, data: drawingXml(placed) });
        files.push({ name: `xl/drawings/_rels/drawing${drawingNo}.xml.rels`, data: XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">${drawingRels.join("")}</Relationships>` });
        contentTypes.push(`<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
        rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/drawing" Target="../drawings/drawing${drawingNo}.xml"/>`);
        drawing = `<drawing r:id="rId${rels.length}"/>`;
      }
    }

    const dimension = maxRow >= 0 ? areaName({ r0: 0, c0: 0, r1: maxRow, c1: Math.max(0, maxCol) }) : "A1";
    const sheetXml =
      XML_HEAD +
      `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
      `<dimension ref="${dimension}"/>` +
      `<sheetViews><sheetView${si === active ? ' tabSelected="1"' : ""} workbookViewId="0">${paneXml(sheet)}</sheetView></sheetViews>` +
      // Blob's default columns are wider than Excel's; rows keep Excel's height (it fits them to wrapped text).
      `<sheetFormatPr baseColWidth="10" defaultColWidth="${pxToWidth(DEFAULT_COL_W)}" defaultRowHeight="15"/>` +
      colsXml(sheet) +
      (rowsOut.length ? `<sheetData>${rowsOut.join("")}</sheetData>` : "<sheetData/>") +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
      drawing +
      legacy +
      (tableXml.length ? `<tableParts count="${tableXml.length}">${tableXml.map((t) => `<tablePart r:id="${t.rel}"/>`).join("")}</tableParts>` : "") +
      "</worksheet>";
    files.push({ name: `xl/worksheets/sheet${sheetNo}.xml`, data: sheetXml });
    contentTypes.push(`<Override PartName="/xl/worksheets/sheet${sheetNo}.xml" ContentType="${CT}.worksheet+xml"/>`);
    if (rels.length) files.push({ name: `xl/worksheets/_rels/sheet${sheetNo}.xml.rels`, data: XML_HEAD + `<Relationships xmlns="${NS_PKG_REL}">${rels.join("")}</Relationships>` });
    sheetRels.push(`<Relationship Id="rId${sheetNo}" Type="${REL}/worksheet" Target="worksheets/sheet${sheetNo}.xml"/>`);
  });

  const n = wb.sheets.length;
  const workbook =
    XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    "<workbookPr/>" +
    `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="${active}"/></bookViews>` +
    `<sheets>${wb.sheets.map((_, i) => `<sheet name="${escAttr(names[i])}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
    // Excel works every value out again when it opens the file (Blob's are in the file for viewers that don't).
    '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
    "</workbook>";
  const workbookRels =
    XML_HEAD +
    `<Relationships xmlns="${NS_PKG_REL}">${sheetRels.join("")}` +
    `<Relationship Id="rId${n + 1}" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId${n + 2}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>` +
    "</Relationships>";
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const core =
    XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:creator>Blob</dc:creator><cp:lastModifiedBy>Blob</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    "</cp:coreProperties>";
  const app =
    XML_HEAD +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    "<Application>Blob</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>" +
    `<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${n}</vt:i4></vt:variant></vt:vector></HeadingPairs>` +
    `<TitlesOfParts><vt:vector size="${n}" baseType="lpstr">${names.map((s) => `<vt:lpstr>${escText(s)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts>` +
    "<LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion>" +
    "</Properties>";
  const types =
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    (commentNo ? '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>' : "") +
    `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
    contentTypes.join("") +
    `<Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${CT}.sharedStrings+xml"/>` +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    "</Types>";
  const rootRels =
    XML_HEAD +
    `<Relationships xmlns="${NS_PKG_REL}">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
    "</Relationships>";

  const parts: { name: string; data: string }[] = [
    { name: "[Content_Types].xml", data: types },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/app.xml", data: app },
    { name: "docProps/core.xml", data: core },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: styles.xml() },
    { name: "xl/sharedStrings.xml", data: strings.xml() },
    ...files,
  ];
  const zip = await makeZip(parts.map((p) => ({ name: p.name, data: enc.encode(p.data) })));
  return new Blob([zip as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function safeValue(calc: Calc, sheetId: string, row: number, col: number): CellValue {
  try {
    return calc.value(sheetId, row, col);
  } catch {
    return null;
  }
}

function safeAdjust(f: string, host: string, change: Parameters<typeof adjustFormula>[2]): string {
  try {
    return adjustFormula(f, host, change);
  } catch {
    return f;
  }
}

// =================================================================================================
// Import
// =================================================================================================

type Rel = { id: string; type: string; target: string; external: boolean };

/** The directory of a part ("xl/worksheets/sheet1.xml" → "xl/worksheets/"). */
const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);
/** Where a part's relationships are ("xl/workbook.xml" → "xl/_rels/workbook.xml.rels"). */
const relsOf = (path: string) => `${dirOf(path)}_rels/${path.slice(path.lastIndexOf("/") + 1)}.rels`;

/** A relationship's target as a part name. */
function resolvePart(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = (dirOf(base) + target).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

async function readRels(zip: ZipReader, part: string, budget: XmlBudget): Promise<Rel[]> {
  const text = await zip.text(relsOf(part));
  if (!text) return [];
  const root = parseXml(text, budget);
  return children(root, "Relationship").map((r) => ({
    id: attr(r, "Id") ?? "",
    type: attr(r, "Type") ?? "",
    target: attr(r, "Target") ?? "",
    external: attr(r, "TargetMode") === "External",
  }));
}

const relIs = (rel: Rel, kind: string) => rel.type.endsWith(`/${kind}`);

type XfLook = { style: CellStyle | undefined; fmt: NumberFormat | undefined };

/** styles.xml read for cells: each cell format (xf) → Blob's look. */
class FileStyles {
  private looks = new Map<number, XfLook>();
  private numFmts = new Map<number, string>();
  private fonts: { b: boolean; i: boolean; u: boolean; strike: boolean; sz: number | null; color: string | null }[] = [];
  private fills: (string | null)[] = [];
  private borders: { left?: BorderLine; right?: BorderLine; top?: BorderLine; bottom?: BorderLine }[] = [];
  private xfs: { numFmtId: number; fontId: number; fillId: number; borderId: number; xfId: number; h?: string; v?: string; wrap: boolean }[] = [];
  /** Names of the file's named cell styles, by their cell style xf. */
  private styleNames = new Map<number, string>();
  private baseSize = EXCEL_FONT_PT;

  constructor(
    root: XmlEl | null,
    private theme: string[],
    private locale: Locale,
  ) {
    if (!root) return;
    const indexed = children(child(child(root, "colors"), "indexedColors"), "rgbColor").map((c) => (attr(c, "rgb") ?? "").slice(-6));
    const palette = indexed.length ? indexed : INDEXED_COLORS;
    const color = (el: XmlEl | null): string | null => {
      if (!el || boolAttr(el, "auto")) return null;
      const rgb = attr(el, "rgb");
      let hex: string | null = null;
      if (rgb && /^[0-9A-Fa-f]{6,8}$/.test(rgb)) hex = rgb.slice(-6).toUpperCase();
      else if (attr(el, "theme") !== undefined) hex = this.theme[numAttr(el, "theme") ?? 1] ?? null;
      else if (attr(el, "indexed") !== undefined) {
        const i = numAttr(el, "indexed") ?? 64;
        hex = i === 64 ? "000000" : i === 65 ? "FFFFFF" : (palette[i] ?? null);
      }
      if (!hex) return null;
      const tint = numAttr(el, "tint") ?? 0;
      return tint ? applyTint(hex, tint) : hex;
    };
    for (const f of children(child(root, "numFmts"), "numFmt")) {
      const id = numAttr(f, "numFmtId");
      if (id !== undefined) this.numFmts.set(id, attr(f, "formatCode") ?? "");
    }
    this.fonts = children(child(root, "fonts"), "font").map((f) => {
      const u = child(f, "u");
      return {
        b: !!child(f, "b") && attr(child(f, "b"), "val") !== "0" && attr(child(f, "b"), "val") !== "false",
        i: !!child(f, "i") && attr(child(f, "i"), "val") !== "0" && attr(child(f, "i"), "val") !== "false",
        u: !!u && attr(u, "val") !== "none",
        strike: !!child(f, "strike") && attr(child(f, "strike"), "val") !== "0" && attr(child(f, "strike"), "val") !== "false",
        sz: numAttr(child(f, "sz"), "val") ?? null,
        color: color(child(f, "color")),
      };
    });
    this.baseSize = this.fonts[0]?.sz ?? EXCEL_FONT_PT;
    this.fills = children(child(root, "fills"), "fill").map((f) => {
      const pattern = child(f, "patternFill");
      if (pattern) {
        const type = attr(pattern, "patternType") ?? (child(pattern, "fgColor") ? "solid" : "none");
        if (type === "none" || type === "gray125" || type === "gray0625") return null;
        return color(child(pattern, "fgColor")) ?? color(child(pattern, "bgColor"));
      }
      const stops = descendants(child(f, "gradientFill"), "stop");
      return stops.length ? color(child(stops[0], "color")) : null;
    });
    this.borders = children(child(root, "borders"), "border").map((b) => {
      const side = (name: string) => {
        const el = child(b, name) ?? (name === "left" ? child(b, "start") : name === "right" ? child(b, "end") : null);
        return borderFromExcel(attr(el, "style"));
      };
      return { left: side("left"), right: side("right"), top: side("top"), bottom: side("bottom") };
    });
    for (const s of children(child(root, "cellStyles"), "cellStyle")) {
      const xfId = numAttr(s, "xfId");
      if (xfId !== undefined) this.styleNames.set(xfId, attr(s, "name") ?? "");
    }
    this.xfs = children(child(root, "cellXfs"), "xf").map((x) => {
      const al = child(x, "alignment");
      return {
        numFmtId: numAttr(x, "numFmtId") ?? 0,
        fontId: numAttr(x, "fontId") ?? 0,
        fillId: numAttr(x, "fillId") ?? 0,
        borderId: numAttr(x, "borderId") ?? 0,
        xfId: numAttr(x, "xfId") ?? 0,
        h: attr(al, "horizontal"),
        v: attr(al, "vertical"),
        wrap: boolAttr(al, "wrapText"),
      };
    });
  }

  format(numFmtId: number): NumberFormat | undefined {
    const custom = this.numFmts.get(numFmtId);
    if (custom !== undefined) return fromExcelFormat(custom, this.locale);
    if (numFmtId === 0) return undefined;
    return builtinFormat(numFmtId, this.locale);
  }

  look(index: number): XfLook {
    let look = this.looks.get(index);
    if (look) return look;
    const xf = this.xfs[index];
    if (!xf) {
      look = { style: undefined, fmt: undefined };
      this.looks.set(index, look);
      return look;
    }
    const s: CellStyle = {};
    const font = this.fonts[xf.fontId];
    if (font) {
      if (font.b) s.bold = true;
      if (font.i) s.italic = true;
      if (font.u) s.underline = true;
      if (font.strike) s.strike = true;
      if (font.sz !== null && Math.abs(font.sz - this.baseSize) > 0.01) {
        const px = ptToPx(font.sz, this.baseSize);
        if (px !== 13) s.size = Math.max(6, Math.min(72, px));
      }
      const c = font.color ? nearestSheetColor(font.color, "text") : null;
      if (c) s.color = c;
    }
    const fill = this.fills[xf.fillId];
    if (fill) {
      const c = nearestSheetColor(fill, "fill");
      if (c) s.fill = c;
    }
    const b = this.borders[xf.borderId];
    if (b && (b.left || b.right || b.top || b.bottom)) {
      s.border = {};
      if (b.top) s.border.top = b.top;
      if (b.right) s.border.right = b.right;
      if (b.bottom) s.border.bottom = b.bottom;
      if (b.left) s.border.left = b.left;
    }
    if (xf.h === "left" || xf.h === "right" || xf.h === "center") s.align = xf.h;
    else if (xf.h === "centerContinuous") s.align = "center";
    // Excel's default is bottom and Blob's middle; only "top" is a choice someone made (LibreOffice
    // writes "bottom" on cells nobody aligned).
    if (xf.v === "top") s.valign = "top";
    if (xf.wrap) s.wrap = true;
    // Significant figures come back through the named style Blob gave the cell.
    const fmt = fromSigStyle(this.styleNames.get(xf.xfId), this.format(xf.numFmtId));
    if (fmt) s.fmt = fmt;
    look = { style: Object.keys(s).length ? s : undefined, fmt };
    this.looks.set(index, look);
    return look;
  }
}

/** The theme's colours in Excel's numbering (light 1, dark 1, light 2, dark 2, accents, links). */
function themeColors(root: XmlEl | null): string[] {
  const scheme = root ? descendants(root, "clrScheme")[0] : null;
  if (!scheme) return OFFICE_THEME;
  const read = (name: string, fallback: string) => {
    const el = child(scheme, name);
    const v = child(el, "srgbClr") ? attr(child(el, "srgbClr"), "val") : child(el, "sysClr") ? attr(child(el, "sysClr"), "lastClr") : undefined;
    return v && /^[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fallback;
  };
  const [lt1, dk1, lt2, dk2, ...rest] = OFFICE_THEME;
  return [
    read("lt1", lt1),
    read("dk1", dk1),
    read("lt2", lt2),
    read("dk2", dk2),
    ...["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map((k, i) => read(k, rest[i])),
  ];
}

/** A string item of sharedStrings.xml: its text runs (not the phonetic guides). */
function stringItem(si: XmlEl): string {
  let s = "";
  for (const k of si.kids) {
    if (typeof k === "string") continue;
    if (k.local === "t") s += textOf(k);
    else if (k.local === "r") for (const t of children(k, "t")) s += textOf(t);
  }
  return unxstring(s);
}

/** "B12" → row 11, col 1 (null when it isn't a cell address). */
function parseRef(ref: string): { row: number; col: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/.exec(ref);
  if (!m) return null;
  const col = colIndex(m[1]);
  const row = Number(m[2]) - 1;
  return col < 0 || row < 0 ? null : { row, col };
}

function parseRange(ref: string | undefined): Area | null {
  if (!ref) return null;
  const [a, b] = ref.split(":");
  const p = parseRef(a ?? "");
  const q = b ? parseRef(b) : p;
  if (!p || !q) return null;
  return { r0: Math.min(p.row, q.row), c0: Math.min(p.col, q.col), r1: Math.max(p.row, q.row), c1: Math.max(p.col, q.col) };
}

/** Days from Excel's 1904 date system to its usual one. */
const DAYS_1904 = 1462;

/** "2026-11-01T14:30:00" (cells of type d) → serial date. */
function isoToSerial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?/.exec(iso.trim());
  if (!m) return null;
  const days = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 + 25569;
  const time = m[4] ? (Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6] ?? 0)) / 86400 : 0;
  return days + time;
}

const TOTALS_FROM_EXCEL: Record<string, TotalFn> = { sum: "sum", average: "average", count: "count", countNums: "countNumbers", min: "min", max: "max", stdDev: "stdev", var: "var" };

/** An Excel table's filter on one column → Blob's (null when Blob has no such filter). */
function filterFromExcel(fc: XmlEl): FilterSpec | null {
  const filters = child(fc, "filters");
  if (filters) {
    if (children(filters, "dateGroupItem").length) return null;
    const values = children(filters, "filter").map((f) => attr(f, "val") ?? "");
    if (boolAttr(filters, "blank")) values.push("");
    return values.length ? { kind: "values", values } : null;
  }
  const custom = child(fc, "customFilters");
  if (custom) {
    const list = children(custom, "customFilter");
    const ops: Record<string, "gt" | "gte" | "lt" | "lte" | "eq" | "neq"> = { greaterThan: "gt", greaterThanOrEqual: "gte", lessThan: "lt", lessThanOrEqual: "lte", equal: "eq", notEqual: "neq" };
    const read = (el: XmlEl) => ({ op: lookup(ops, attr(el, "operator") ?? "equal"), val: attr(el, "val") ?? "" });
    if (list.length === 1) {
      const { op, val } = read(list[0]);
      const n = Number(val);
      if (op && val !== "" && Number.isFinite(n)) return { kind: "number", op, a: n, b: null };
      // Text: "Probe*" (begins), "*Probe" (ends), "*Probe*" (contains), "Probe" (equals).
      if (op === "eq" || op === "neq") {
        const text = val.replace(/~([*?])/g, "$1");
        if (/^\*.+\*$/.test(val)) return { kind: "text", op: op === "eq" ? "contains" : "notContains", text: text.slice(1, -1) };
        if (op === "eq" && /^[^*]+\*$/.test(val)) return { kind: "text", op: "begins", text: text.slice(0, -1) };
        if (op === "eq" && /^\*[^*]+$/.test(val)) return { kind: "text", op: "ends", text: text.slice(1) };
        if (op === "eq" && !/[*?]/.test(val)) return { kind: "text", op: "equals", text };
      }
      return null;
    }
    if (list.length === 2 && boolAttr(custom, "and")) {
      const [x, y] = list.map(read);
      const a = Number(x.val);
      const b = Number(y.val);
      if (x.op === "gte" && y.op === "lte" && Number.isFinite(a) && Number.isFinite(b)) return { kind: "number", op: "between", a, b };
    }
    return null;
  }
  const top = child(fc, "top10");
  if (top) {
    if (boolAttr(top, "percent")) return null;
    return { kind: "number", op: boolAttr(top, "top", true) ? "top" : "bottom", a: numAttr(top, "val") ?? 10, b: null };
  }
  const dyn = child(fc, "dynamicFilter");
  if (dyn) {
    const type = attr(dyn, "type");
    if (type === "aboveAverage") return { kind: "number", op: "aboveAverage", a: null, b: null };
    if (type === "belowAverage") return { kind: "number", op: "belowAverage", a: null, b: null };
  }
  return null;
}

/** Notes of a sheet from its comments part ("Lena:" before the text, as Excel writes the author, dropped). */
function readComments(root: XmlEl): Map<string, string> {
  const authors = children(child(root, "authors"), "author").map((a) => textOf(a).trim());
  const out = new Map<string, string>();
  for (const c of children(child(root, "commentList"), "comment")) {
    const ref = attr(c, "ref");
    const text = child(c, "text");
    if (!ref || !text) continue;
    const runs = children(text, "r");
    let s = "";
    if (runs.length) {
      runs.forEach((r, i) => {
        const t = children(r, "t").map(textOf).join("");
        const bold = !!child(child(r, "rPr"), "b");
        const author = authors[numAttr(c, "authorId") ?? -1];
        if (i === 0 && bold && /:\s*$/.test(t) && (!author || t.trim().replace(/:$/, "") === author)) return;
        s += t;
      });
    } else s = children(text, "t").map(textOf).join("");
    s = unxstring(s).replace(/\r\n?/g, "\n").trim();
    if (s) out.set(ref.toUpperCase(), s);
  }
  return out;
}

/** Excel 365's threaded comments: the first and its replies, one note. */
function readThreaded(root: XmlEl): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of children(root, "threadedComment")) {
    const ref = attr(c, "ref")?.toUpperCase();
    const text = unxstring(textOf(child(c, "text"))).replace(/\r\n?/g, "\n").trim();
    if (!ref || !text) continue;
    out.set(ref, out.has(ref) ? `${out.get(ref)}\n— ${text}` : text);
  }
  return out;
}

type SheetPart = {
  name: string;
  path: string;
  root: XmlEl;
  rels: Rel[];
  /** Index among the workbook's sheets (for sheet-scoped defined names). */
  index: number;
};

type Counts = {
  merged: number;
  charts: number;
  chartSheets: number;
  pictures: number;
  shapes: number;
  conditional: number;
  validation: number;
  links: number;
  unknown: number;
  unknownNames: Set<string>;
  external: number;
  tableRefs: number;
  bad: number;
  arrays: number;
  filters: number;
  sheetFilter: number;
  noHeader: number;
  pivots: number;
  sparklines: number;
  macros: number;
  protection: number;
  outline: number;
  tooBig: number;
  longText: number;
  /** Sheets past Blob's limit, not read. */
  sheets: number;
  longFormulas: number;
};

/** What couldn't come along, as short lines in the user's language. */
function skippedLines(c: Counts, locale: Locale): string[] {
  const t = sheetIoText[locale].skipped;
  const out: string[] = [];
  if (c.merged) out.push(t.merged(c.merged));
  if (c.charts) out.push(t.charts(c.charts));
  if (c.chartSheets) out.push(t.chartSheets(c.chartSheets));
  if (c.pictures) out.push(t.pictures(c.pictures));
  if (c.shapes) out.push(t.shapes(c.shapes));
  if (c.conditional) out.push(t.conditional(c.conditional));
  if (c.validation) out.push(t.validation(c.validation));
  if (c.links) out.push(t.links(c.links));
  if (c.unknown) {
    const names = [...c.unknownNames].slice(0, 4).join(", ") + (c.unknownNames.size > 4 ? ", …" : "");
    out.push(t.unknownFunctions(c.unknown, names));
  }
  if (c.external) out.push(t.external(c.external));
  if (c.tableRefs) out.push(t.tableRefs(c.tableRefs));
  if (c.bad) out.push(t.badFormulas(c.bad));
  if (c.arrays) out.push(t.arrays(c.arrays));
  if (c.filters) out.push(t.filters(c.filters));
  if (c.sheetFilter) out.push(t.sheetFilter);
  if (c.noHeader) out.push(t.noHeaderTables(c.noHeader));
  if (c.pivots) out.push(t.pivots(c.pivots));
  if (c.sparklines) out.push(t.sparklines);
  if (c.macros) out.push(t.macros);
  if (c.protection) out.push(t.protection);
  if (c.outline) out.push(t.outline);
  if (c.tooBig) out.push(t.tooBig(c.tooBig, MAX_ROWS.toLocaleString(locale === "de" ? "de-DE" : "en-US"), MAX_COLS));
  if (c.longText) out.push(t.longText(c.longText));
  if (c.sheets) out.push(t.sheets(c.sheets, MAX_SHEETS));
  if (c.longFormulas) out.push(t.longFormulas(c.longFormulas, MAX_FORMULA.toLocaleString(locale === "de" ? "de-DE" : "en-US")));
  return out;
}

/** Bytes that aren't a zip: an old .xls, or an encrypted (password) Office file, both OLE containers. */
function oleKind(bytes: Uint8Array): "encrypted" | "oldXls" | null {
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (bytes.length < 8 || !ole.every((b, i) => bytes[i] === b)) return null;
  // Encrypted Office files keep an "EncryptionInfo" stream (its name is UTF-16 in the directory).
  const needle = "EncryptionInfo";
  const limit = Math.min(bytes.length, 1 << 20);
  outer: for (let i = 0; i + needle.length * 2 <= limit; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j * 2] !== needle.charCodeAt(j) || bytes[i + j * 2 + 1] !== 0) continue outer;
    }
    return "encrypted";
  }
  return "oldXls";
}

/** What couldn't be brought over is listed in `skipped` ("3 merged cells", "1 chart"). */
export async function importXlsx(data: ArrayBuffer, locale: Locale): Promise<{ workbook: Workbook; skipped: string[] }> {
  const bytes = new Uint8Array(data);
  const ole = oleKind(bytes);
  if (ole) throw new XlsxError(ole, locale);
  let zip: ZipReader;
  try {
    zip = readZip(bytes);
  } catch (e) {
    throw new XlsxError(e instanceof ZipError && e.code === "not-zip" ? "notXlsx" : "broken", locale);
  }
  try {
    return await readWorkbook(zip, locale);
  } catch (e) {
    if (e instanceof XlsxError) throw e;
    if (e instanceof ZipError) throw new XlsxError(e.code === "encrypted" ? "encrypted" : e.code === "unsupported" ? "unsupported" : e.code === "tooBig" ? "tooBig" : "broken", locale);
    if (e instanceof XmlError && e.tooBig) throw new XlsxError("tooBig", locale);
    throw new XlsxError("broken", locale);
  }
}

async function readWorkbook(zip: ZipReader, locale: Locale): Promise<{ workbook: Workbook; skipped: string[] }> {
  const t = sheetIoText[locale];
  const mimetype = await zip.text("mimetype").catch(() => null);
  if (mimetype?.includes("opendocument")) throw new XlsxError("ods", locale);
  if (zip.names.some((n) => /^Index\/.*\.iwa$/i.test(n))) throw new XlsxError("numbers", locale);

  // Every part of the file shares one budget of elements (see xml.ts).
  const budget = xmlBudget();
  const xml = (text: string) => parseXml(text, budget);
  const rootRels = await readRels(zip, "", budget);
  const office = rootRels.find((r) => relIs(r, "officeDocument") && !r.external);
  const wbPath = office ? resolvePart("", office.target) : "xl/workbook.xml";
  const wbText = await zip.text(wbPath);
  if (!wbText) throw new XlsxError(zip.has("word/document.xml") || zip.has("ppt/presentation.xml") ? "notXlsx" : "broken", locale);
  const wbRoot = xml(wbText);
  if (wbRoot.local !== "workbook") throw new XlsxError("notXlsx", locale);
  const wbRels = await readRels(zip, wbPath, budget);
  const relById = new Map(wbRels.map((r) => [r.id, r]));
  const date1904 = boolAttr(child(wbRoot, "workbookPr"), "date1904");

  const counts: Counts = {
    merged: 0,
    charts: 0,
    chartSheets: 0,
    pictures: 0,
    shapes: 0,
    conditional: 0,
    validation: 0,
    links: 0,
    unknown: 0,
    unknownNames: new Set(),
    external: 0,
    tableRefs: 0,
    bad: 0,
    arrays: 0,
    filters: 0,
    sheetFilter: 0,
    noHeader: 0,
    pivots: 0,
    sparklines: 0,
    macros: 0,
    protection: 0,
    outline: 0,
    tooBig: 0,
    longText: 0,
    sheets: 0,
    longFormulas: 0,
  };
  if (zip.names.some((n) => /vbaProject\.bin$/i.test(n))) counts.macros = 1;

  const themeRel = wbRels.find((r) => relIs(r, "theme"));
  const themeText = themeRel ? await zip.text(resolvePart(wbPath, themeRel.target)) : null;
  const theme = themeColors(themeText ? xml(themeText) : null);
  const stylesRel = wbRels.find((r) => relIs(r, "styles"));
  const stylesText = stylesRel ? await zip.text(resolvePart(wbPath, stylesRel.target)) : null;
  const styles = new FileStyles(stylesText ? xml(stylesText) : null, theme, locale);
  const sstRel = wbRels.find((r) => relIs(r, "sharedStrings"));
  const sstText = sstRel ? await zip.text(resolvePart(wbPath, sstRel.target)) : null;
  const sst = sstText ? children(xml(sstText), "si").map(stringItem) : [];

  // The sheets, in tab order (those past Blob's limit aren't read at all).
  const sheetParts: SheetPart[] = [];
  const sheetEls = children(child(wbRoot, "sheets"), "sheet");
  for (let i = 0; i < sheetEls.length; i++) {
    const el = sheetEls[i];
    const rel = relById.get(attr(el, "r:id") ?? attr(el, "id") ?? "");
    if (!rel || rel.external) continue;
    if (relIs(rel, "chartsheet")) {
      counts.chartSheets++;
      continue;
    }
    if (!relIs(rel, "worksheet")) continue;
    if (sheetParts.length >= MAX_SHEETS) {
      counts.sheets++;
      continue;
    }
    const path = resolvePart(wbPath, rel.target);
    const text = await zip.text(path);
    if (!text) continue;
    sheetParts.push({ name: (attr(el, "name") ?? "").trim(), path, root: xml(text), rels: await readRels(zip, path, budget), index: i });
  }
  if (!sheetParts.length) throw new XlsxError("noSheets", locale);

  // Names: unique (without case) and valid for Blob, like Excel's own.
  const usedNames = new Set<string>();
  const blobSheets: Sheet[] = sheetParts.map((p, i) => {
    let name = p.name.replace(/[[\]:*?/\\]/g, "_").replace(/^'+|'+$/g, "").slice(0, 31) || t.sheet(i + 1);
    for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${name.slice(0, 26)} (${n})`;
    usedNames.add(name.toLowerCase());
    return { id: newId(), name, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: DEFAULT_SIZE.rows, cols: DEFAULT_SIZE.cols } };
  });

  // Smart tables first: formulas anywhere may refer to them.
  const fileTables = new Map<string, FileTable>();
  const tablesBySheet = new Map<number, { table: TableSpec; filtered: boolean }[]>();
  const blobTables: TableSpec[] = [];
  const tableNames = new Set<string>();
  for (let si = 0; si < sheetParts.length; si++) {
    const part = sheetParts[si];
    for (const tp of children(child(part.root, "tableParts"), "tablePart")) {
      const rel = part.rels.find((r) => r.id === (attr(tp, "r:id") ?? attr(tp, "id")));
      if (!rel) continue;
      const text = await zip.text(resolvePart(part.path, rel.target));
      if (!text) continue;
      const tr = xml(text);
      const area = parseRange(attr(tr, "ref"));
      if (!area) continue;
      const name = attr(tr, "displayName") ?? attr(tr, "name") ?? "";
      const header = (numAttr(tr, "headerRowCount") ?? 1) > 0;
      const totals = (numAttr(tr, "totalsRowCount") ?? 0) > 0;
      const cols = children(child(tr, "tableColumns"), "tableColumn");
      const colNames = cols.map((c) => unxstring(attr(c, "name") ?? ""));
      fileTables.set(name.toUpperCase(), { name, sheet: part.name, area, header, totals, columns: colNames });
      if (!header) {
        counts.noHeader++;
        continue;
      }
      if (area.r1 >= MAX_ROWS || area.c1 >= MAX_COLS || area.r1 <= area.r0) continue;
      const width = area.c1 - area.c0 + 1;
      const columns: TableColumn[] = Array.from({ length: width }, (_, i) => ({ id: newId(), total: lookup(TOTALS_FROM_EXCEL, attr(cols[i], "totalsRowFunction")) ?? "none" }));
      const filters: Record<string, FilterSpec> = {};
      let lost = false;
      const af = child(tr, "autoFilter");
      for (const fc of children(af, "filterColumn")) {
        const colId = numAttr(fc, "colId") ?? -1;
        const column = columns[colId];
        const spec = column ? filterFromExcel(fc) : null;
        if (column && spec) filters[column.id] = spec;
        else lost = true;
      }
      if (lost) counts.filters++;
      let sort: TableSpec["sort"] = null;
      const cond = child(child(af, "sortState") ?? child(tr, "sortState"), "sortCondition");
      const sortArea = parseRange(attr(cond, "ref"));
      if (sortArea && sortArea.c0 >= area.c0 && sortArea.c0 <= area.c1) sort = { column: columns[sortArea.c0 - area.c0].id, dir: boolAttr(cond, "descending") ? "desc" : "asc" };
      const info = child(tr, "tableStyleInfo");
      let blobName = name.trim() || `${locale === "de" ? "Tabelle" : "Table"}${blobTables.length + 1}`;
      for (let n = 2; tableNames.has(blobName.toLowerCase()); n++) blobName = `${name}${n}`;
      tableNames.add(blobName.toLowerCase());
      const table: TableSpec = {
        id: newId(),
        sheetId: blobSheets[si].id,
        name: blobName,
        area,
        columns,
        totals,
        style: tableStyleFromExcel(attr(info, "name")),
        banded: info ? boolAttr(info, "showRowStripes", true) : true,
        filters,
        sort,
      };
      blobTables.push(table);
      let list = tablesBySheet.get(si);
      if (!list) tablesBySheet.set(si, (list = []));
      list.push({ table, filtered: !!child(af, "filterColumn") });
    }
  }
  const tableAt = (sheet: string, row: number, col: number) => {
    for (const ft of fileTables.values()) {
      const a = ft.area;
      if (ft.sheet.toLowerCase() === sheet.toLowerCase() && row >= a.r0 && row <= a.r1 && col >= a.c0 && col <= a.c1) return ft;
    }
    return null;
  };

  // Defined names (named ranges), for formulas that use them.
  const definedNames: FormulaContext["names"] = new Map();
  for (const dn of children(child(wbRoot, "definedNames"), "definedName")) {
    const name = attr(dn, "name") ?? "";
    if (!name || name.startsWith("_xlnm.") || name.startsWith("_xl")) continue;
    const def = textOf(dn).trim();
    if (!def) continue;
    let entry = definedNames.get(name.toUpperCase());
    if (!entry) definedNames.set(name.toUpperCase(), (entry = { local: new Map() }));
    const local = numAttr(dn, "localSheetId");
    if (local === undefined) entry.global = def;
    else {
      const sheet = sheetParts.find((p) => p.index === local) ?? sheetParts[local];
      if (sheet) entry.local.set(sheet.name.toLowerCase(), def);
    }
  }

  // Charts name sheets as the file does.
  const sheetIds = new Map(sheetParts.map((p, i) => [p.name.toLowerCase(), blobSheets[i].id]));
  const sheetIdOf = (name: string) => sheetIds.get(name.toLowerCase());
  const blobCharts: ChartSpec[] = [];

  // Formulas name sheets as the file did; Blob's names differ only where the file's weren't valid.
  const renames = sheetParts.map((p, i) => ({ from: p.name, to: blobSheets[i].name })).filter((r) => r.from !== r.to);

  for (let si = 0; si < sheetParts.length; si++) {
    const part = sheetParts[si];
    const sheet = blobSheets[si];
    const root = part.root;
    const tables = tablesBySheet.get(si) ?? [];
    // Rows a table's filter hides come back through the filter, not as rows hidden by hand.
    const filterRows: Area[] = tables.filter((x) => x.filtered).map((x) => ({ ...x.table.area, r0: x.table.area.r0 + 1 }));
    const sheetFilter = child(root, "autoFilter");
    if (sheetFilter && child(sheetFilter, "filterColumn")) {
      counts.sheetFilter++;
      const a = parseRange(attr(sheetFilter, "ref"));
      if (a) filterRows.push({ ...a, r0: a.r0 + 1 });
    }
    const hiddenByFilter = (r: number) => filterRows.some((a) => r >= a.r0 && r <= a.r1);

    // Columns.
    for (const c of children(child(root, "cols"), "col")) {
      const min = (numAttr(c, "min") ?? 1) - 1;
      const max = Math.min((numAttr(c, "max") ?? min + 1) - 1, MAX_COLS - 1);
      const width = numAttr(c, "width");
      // Excel writes <col> for formatted columns too, at the default width and without customWidth.
      const customAttr = attr(c, "customWidth");
      const custom = customAttr === undefined ? width !== undefined && attr(c, "style") === undefined : boolAttr(c, "customWidth");
      const hidden = boolAttr(c, "hidden");
      if ((numAttr(c, "outlineLevel") ?? 0) > 0) counts.outline = 1;
      for (let col = Math.max(0, min); col <= max; col++) {
        const entry: { w?: number; hidden?: boolean } = {};
        if (custom && width !== undefined) {
          const px = widthToPx(width);
          if (Math.abs(px - DEFAULT_COL_W) > 1) entry.w = px;
        }
        if (hidden || (width !== undefined && width === 0)) entry.hidden = true;
        if (entry.w !== undefined || entry.hidden) sheet.cols[String(col)] = entry;
      }
    }

    // Frozen panes.
    const pane = child(child(child(root, "sheetViews"), "sheetView"), "pane");
    if (pane && /^frozen/.test(attr(pane, "state") ?? "")) {
      sheet.freeze = { rows: Math.max(0, Math.min(MAX_ROWS - 1, Math.round(numAttr(pane, "ySplit") ?? 0))), cols: Math.max(0, Math.min(MAX_COLS - 1, Math.round(numAttr(pane, "xSplit") ?? 0))) };
    }

    // Notes.
    const notes = new Map<string, string>();
    for (const rel of part.rels) {
      if (relIs(rel, "comments")) {
        const text = await zip.text(resolvePart(part.path, rel.target));
        if (text) for (const [k, v] of readComments(xml(text))) if (!notes.has(k)) notes.set(k, v);
      }
    }
    for (const rel of part.rels) {
      if (relIs(rel, "threadedComment")) {
        const text = await zip.text(resolvePart(part.path, rel.target));
        if (text) for (const [k, v] of readThreaded(xml(text))) notes.set(k, v);
      }
    }

    // What else is on the sheet that Blob doesn't have.
    counts.merged += children(child(root, "mergeCells"), "mergeCell").length;
    counts.conditional += children(root, "conditionalFormatting").length;
    counts.validation += children(child(root, "dataValidations"), "dataValidation").length;
    counts.links += children(child(root, "hyperlinks"), "hyperlink").length;
    if (child(root, "sheetProtection")) counts.protection = 1;
    const ext = child(root, "extLst");
    if (ext && descendants(ext, "sparklineGroup").length) counts.sparklines = 1;
    if (ext) counts.conditional += descendants(ext, "conditionalFormatting").length;
    for (const rel of part.rels) {
      if (relIs(rel, "pivotTable")) counts.pivots++;
      if (relIs(rel, "drawing")) {
        const path = resolvePart(part.path, rel.target);
        const text = await zip.text(path);
        if (!text) continue;
        const drawing = xml(text);
        const drawingRels = await readRels(zip, path, budget);
        const layout = sheetLayout(root);
        for (const anchor of children(drawing).filter((a) => /Anchor$/.test(a.local))) {
          const chartEl = descendants(anchor, "chart")[0];
          if (chartEl) {
            // Charts come over as Blob charts at the same place (those Blob can't draw are listed).
            const chartRel = drawingRels.find((r) => r.id === (attr(chartEl, "r:id") ?? attr(chartEl, "id")));
            const chartText = chartRel && relIs(chartRel, "chart") ? await zip.text(resolvePart(path, chartRel.target)) : null;
            const place = anchorPlace(anchor, layout);
            let spec: ChartSpec | null = null;
            try {
              spec = chartText && place ? chartFromXml(xml(chartText), sheetIdOf, sheet.id, place.at, place.size, theme) : null;
            } catch (e) {
              // A chart Blob can't read is left out (and listed); a file over its budget isn't read at all.
              if (e instanceof XmlError && e.tooBig) throw e;
              spec = null;
            }
            if (spec) blobCharts.push(spec);
            else counts.charts++;
          } else if (descendants(anchor, "pic").length) counts.pictures++;
          else if (descendants(anchor, "sp").length || descendants(anchor, "cxnSp").length) counts.shapes++;
        }
      }
    }

    // The cells.
    const shared = new Map<string, { row: number; col: number; formula: string | null; problem?: "external" | "table-ref" }>();
    const ctxBase = { tables: fileTables, names: definedNames, sheet: part.name, tableAt };
    let maxRow = -1;
    let maxCol = -1;
    let nextRow = 0;
    for (const rowEl of children(child(root, "sheetData"), "row")) {
      const r = (numAttr(rowEl, "r") ?? nextRow + 1) - 1;
      nextRow = r + 1;
      const rowCells = children(rowEl, "c");
      if (r >= MAX_ROWS) {
        counts.tooBig += rowCells.filter((c) => child(c, "v") || child(c, "f") || child(c, "is")).length;
        continue;
      }
      if ((numAttr(rowEl, "outlineLevel") ?? 0) > 0) counts.outline = 1;
      const ht = numAttr(rowEl, "ht");
      const rowEntry: { h?: number; hidden?: boolean } = {};
      if (ht !== undefined && boolAttr(rowEl, "customHeight")) {
        const px = heightToPx(ht);
        if (Math.abs(px - DEFAULT_ROW_H) > 1) rowEntry.h = px;
      }
      if (boolAttr(rowEl, "hidden") && !hiddenByFilter(r)) rowEntry.hidden = true;
      if (rowEntry.h !== undefined || rowEntry.hidden) sheet.rows[String(r)] = rowEntry;

      let nextCol = 0;
      for (const c of rowCells) {
        const ref = attr(c, "r");
        const pos = ref ? parseRef(ref) : { row: r, col: nextCol };
        if (!pos) continue;
        const col = pos.col;
        nextCol = col + 1;
        const vEl = child(c, "v");
        const fEl = child(c, "f");
        const isEl = child(c, "is");
        if (col >= MAX_COLS) {
          if (vEl || fEl || isEl) counts.tooBig++;
          continue;
        }
        const type = attr(c, "t") ?? "n";
        const look = styles.look(numAttr(c, "s") ?? 0);
        const out: Cell = {};
        if (look.style) out.s = look.style;

        // The value as the file has it (a formula's last result, or a constant).
        let value: number | string | boolean | { error: string } | null = null;
        const raw = vEl ? textOf(vEl) : null;
        if (type === "s") value = raw !== null ? (sst[Number(raw)] ?? "") : null;
        else if (type === "inlineStr") value = isEl ? stringItem(isEl) : raw !== null ? unxstring(raw) : null;
        else if (type === "str") value = raw !== null ? unxstring(raw) : null;
        else if (type === "b") value = raw !== null ? raw.trim() === "1" || raw.trim().toLowerCase() === "true" : null;
        else if (type === "e") value = raw !== null ? { error: raw.trim() } : null;
        else if (type === "d") value = raw !== null ? isoToSerial(raw) : null;
        else if (raw !== null && raw.trim() !== "") {
          const n = Number(raw);
          value = Number.isFinite(n) ? n : raw;
        }
        if (type === "d" && typeof value === "number" && !out.s?.fmt) out.s = { ...out.s, fmt: { kind: "date", style: "short" } };

        // The formula.
        let formula: string | null = null;
        if (fEl) {
          const ft = attr(fEl, "t") ?? "normal";
          const text = textOf(fEl).trim();
          if (ft === "array") counts.arrays++;
          if (ft === "dataTable") formula = null;
          else if (ft === "shared") {
            const si2 = attr(fEl, "si") ?? "";
            let master = shared.get(si2);
            if (text && (!master || master.row !== pos.row || master.col !== col)) {
              const imported = importFormula(renameSheets(text, renames), { ...ctxBase, row: pos.row, col });
              master = "formula" in imported ? { row: pos.row, col, formula: imported.formula } : { row: pos.row, col, formula: null, problem: imported.problem };
              shared.set(si2, master);
              if (master.problem) noteProblem(master.problem, counts);
              else formula = master.formula;
            } else if (master) {
              if (master.problem) noteProblem(master.problem, counts);
              else if (master.formula !== null) formula = safeShift(master.formula, pos.row - master.row, col - master.col);
            }
          } else if (text) {
            const imported = importFormula(renameSheets(text, renames), { ...ctxBase, row: pos.row, col });
            if ("formula" in imported) formula = imported.formula;
            else noteProblem(imported.problem, counts);
          }
        }
        // LibreOffice writes TRUE and FALSE typed into a cell as the formulas TRUE() and FALSE().
        if (formula !== null && /^(TRUE|FALSE)\(\)$/i.test(formula.trim())) {
          value = /^TRUE/i.test(formula.trim());
          formula = null;
        }
        // Longer than a formula may be (LibreOffice writes such): its last result stays, as a value.
        if (formula !== null && formula.length > MAX_FORMULA) {
          counts.longFormulas++;
          formula = null;
        }
        if (formula !== null) {
          const checked = checkFormula(formula);
          if ("formula" in checked) out.f = checked.formula;
          else {
            const unknown = calledFunctions(formula).filter((fn) => !getFunction(fn));
            if (unknown.length) {
              counts.unknown++;
              unknown.forEach((u) => counts.unknownNames.add(u));
            } else counts.bad++;
          }
        }
        if (out.f === undefined && value !== null) {
          if (typeof value === "object") {
            // An error as a value (#N/A typed into a cell) stays an error.
            const code = value.error.toUpperCase();
            if ("formula" in checkFormula(code)) out.f = code;
            else out.v = value.error;
          } else if (typeof value === "string") {
            if (value.length > MAX_TEXT) counts.longText++;
            if (value !== "") out.v = value.slice(0, MAX_TEXT);
          } else if (typeof value === "number") {
            const fmt = out.s?.fmt;
            out.v = date1904 && fmt && (fmt.kind === "date" || fmt.kind === "datetime") ? value + DAYS_1904 : value;
          } else out.v = value;
        }
        const note = notes.get(`${colName(col)}${pos.row + 1}`);
        if (note) out.note = note;
        if (out.v === undefined && out.f === undefined && !out.s && !out.note) continue;
        sheet.cells[cellKey(pos.row, col)] = out;
        if (out.v !== undefined || out.f !== undefined || out.note) {
          if (pos.row > maxRow) maxRow = pos.row;
          if (col > maxCol) maxCol = col;
        }
      }
    }
    // Notes on cells that have nothing else.
    for (const [ref, text] of notes) {
      const pos = parseRef(ref);
      if (!pos || pos.row >= MAX_ROWS || pos.col >= MAX_COLS) continue;
      const key = cellKey(pos.row, pos.col);
      if (!sheet.cells[key]) sheet.cells[key] = { note: text };
      if (pos.row > maxRow) maxRow = pos.row;
      if (pos.col > maxCol) maxCol = pos.col;
    }
    for (const x of tables) {
      maxRow = Math.max(maxRow, x.table.area.r1);
      maxCol = Math.max(maxCol, x.table.area.c1);
      // A totals row's function as its cell has it (Excel files say "custom" for Blob's own and for
      // SUBTOTALs typed by hand), so switching the totals row off and on brings the same ones back.
      if (!x.table.totals) continue;
      const { area, columns } = x.table;
      columns.forEach((c, i) => {
        const fn = totalOfCell(sheet.cells[cellKey(area.r1, area.c0 + i)], area.c0 + i);
        if (fn !== "custom" && fn !== "none") columns[i] = { ...c, total: fn };
      });
    }
    sheet.size = {
      rows: Math.min(MAX_ROWS, Math.max(DEFAULT_SIZE.rows, maxRow + 1 + 50, sheet.freeze.rows + 1)),
      cols: Math.min(MAX_COLS, Math.max(DEFAULT_SIZE.cols, maxCol + 1 + 4, sheet.freeze.cols + 1)),
    };
  }

  const workbook: Workbook = { v: 1, sheets: blobSheets, charts: blobCharts, tables: blobTables };
  return { workbook, skipped: skippedLines(counts, locale) };
}

/** Excel's column widths and row heights of a sheet in px, for placing drawings. */
type Layout = { col: (c: number) => number; row: (r: number) => number };

function sheetLayout(root: XmlEl): Layout {
  const fmt = child(root, "sheetFormatPr");
  const defaultWidth = numAttr(fmt, "defaultColWidth");
  const base = numAttr(fmt, "baseColWidth") ?? 8;
  // Excel's default column: baseColWidth characters plus padding (8 → 8.43 → 64 px).
  const colDefault = defaultWidth !== undefined ? widthToPx(defaultWidth) : Math.round(base * 7 + 8);
  const rowDefault = heightToPx(numAttr(fmt, "defaultRowHeight") ?? 15);
  const widths = new Map<number, number>();
  for (const c of children(child(root, "cols"), "col")) {
    const w = numAttr(c, "width");
    if (w === undefined) continue;
    const min = (numAttr(c, "min") ?? 1) - 1;
    const max = Math.min((numAttr(c, "max") ?? min + 1) - 1, MAX_COLS + 50);
    for (let i = Math.max(0, min); i <= max; i++) widths.set(i, boolAttr(c, "hidden") ? 0 : widthToPx(w));
  }
  const heights = new Map<number, number>();
  for (const r of children(child(root, "sheetData"), "row")) {
    const i = (numAttr(r, "r") ?? 0) - 1;
    const ht = numAttr(r, "ht");
    if (i >= 0 && (ht !== undefined || boolAttr(r, "hidden"))) heights.set(i, boolAttr(r, "hidden") ? 0 : heightToPx(ht ?? 15));
  }
  return { col: (c) => widths.get(c) ?? colDefault, row: (r) => heights.get(r) ?? rowDefault };
}

/** Where a drawing anchor puts its object: a cell and an offset in it, and its size (px). */
function anchorPlace(anchor: XmlEl, layout: Layout): { at: ChartSpec["at"]; size: ChartSpec["size"] } | null {
  const px = (emu: number | undefined) => Math.round((emu ?? 0) / EMU);
  const point = (el: XmlEl | null) => (el ? { col: Number(textOf(child(el, "col"))) || 0, colOff: px(Number(textOf(child(el, "colOff"))) || 0), row: Number(textOf(child(el, "row"))) || 0, rowOff: px(Number(textOf(child(el, "rowOff"))) || 0) } : null);
  const clampSize = (w: number, h: number) => ({ w: Math.max(160, Math.min(2000, Math.round(w))), h: Math.max(120, Math.min(1500, Math.round(h))) });
  if (anchor.local === "absoluteAnchor") {
    const pos = child(anchor, "pos");
    const ext = child(anchor, "ext");
    if (!ext) return null;
    return { at: { row: 0, col: 0, dx: px(numAttr(pos, "x")), dy: px(numAttr(pos, "y")) }, size: clampSize(px(numAttr(ext, "cx")), px(numAttr(ext, "cy"))) };
  }
  const from = point(child(anchor, "from"));
  if (!from) return null;
  const at = { row: Math.min(from.row, MAX_ROWS - 1), col: Math.min(from.col, MAX_COLS - 1), dx: from.colOff, dy: from.rowOff };
  if (anchor.local === "oneCellAnchor") {
    const ext = child(anchor, "ext");
    if (!ext) return null;
    return { at, size: clampSize(px(numAttr(ext, "cx")), px(numAttr(ext, "cy"))) };
  }
  const to = point(child(anchor, "to"));
  if (!to) return null;
  let w = -from.colOff + to.colOff;
  for (let c = from.col; c < to.col && c < from.col + 500; c++) w += layout.col(c);
  let h = -from.rowOff + to.rowOff;
  for (let r = from.row; r < to.row && r < from.row + 2000; r++) h += layout.row(r);
  return { at, size: clampSize(w, h) };
}

function noteProblem(problem: "external" | "table-ref", counts: Counts) {
  if (problem === "external") counts.external++;
  else counts.tableRefs++;
}

/** Sheet names in a file's formula → Blob's names for them (only where they had to change). */
function renameSheets(f: string, renames: { from: string; to: string }[]): string {
  if (!renames.length) return f;
  let out = stripPrefixes(f);
  renames.forEach((r, i) => (out = safeAdjust(out, "", { kind: "renameSheet", from: r.from, to: `\u0001${i}` })));
  renames.forEach((r, i) => (out = safeAdjust(out, "", { kind: "renameSheet", from: `\u0001${i}`, to: r.to })));
  return out;
}

function safeShift(f: string, rows: number, cols: number): string {
  try {
    return shiftFormula(f, rows, cols);
  } catch {
    return f;
  }
}

/** Does the engine read the formula (and know its functions)? Its canonical text if so. */
function checkFormula(f: string): { formula: string } | { error: string } {
  try {
    const r = toCanonicalFormula(f, "en");
    return "formula" in r ? { formula: r.formula } : { error: r.error };
  } catch {
    return { error: "parse" };
  }
}
