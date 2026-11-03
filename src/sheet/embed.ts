// What a note can show from a spreadsheet (the "sheetEmbed" note block): a chart, a smart table or
// a range of cells, always live from the spreadsheet.
//
// CONTRACT: shared by the note block (src/components/editor/blocks/SheetEmbed.tsx) and the
// "Add to note" dialog (src/components/sheet/embed/AddToNote.tsx).
//
// Besides the types, this module holds the block's pure parts, so the note, its exports and the
// check script read embeds the same way: checking attributes that come from a document or a URL
// (src/sheet/embedAttrs.ts, re-exported here, which notes load without the rest), finding what an
// embed points at, and the table a note shows (values as the cells show them, with their looks),
// as a model and as Markdown.

import type { Locale } from "@/i18n/config";
import { areaName, cellKey } from "./a1";
import { defaultAlign, formatValue, isError, type Calc, type CellValue } from "./engine";
import { filteredRows } from "./table/model";
import { DEFAULT_COL_W, MAX_COLS, MAX_ROWS, type Area, type CellStyle, type ChartSpec, type Sheet, type SheetColor, type TableSpec, type TableStyle, type Workbook } from "./types";
import { EMBED_MAX_COLS, EMBED_MAX_ROWS, type SheetEmbedItem } from "./embedAttrs";

export * from "./embedAttrs";

// What an embed points at -------------------------------------------------------------------------

export type EmbedTarget =
  | { kind: "chart"; chart: ChartSpec; sheet: Sheet | undefined }
  | { kind: "table"; table: TableSpec; sheet: Sheet }
  | { kind: "range"; sheet: Sheet; area: Area }
  /** The chart, table or sheet was deleted from the spreadsheet. */
  | { kind: "gone"; what: "chart" | "table" | "sheet" };

export function embedTarget(wb: Workbook, item: SheetEmbedItem): EmbedTarget {
  if (item.kind === "chart") {
    const chart = wb.charts.find((c) => c.id === item.chartId);
    return chart ? { kind: "chart", chart, sheet: wb.sheets.find((s) => s.id === chart.sheetId) } : { kind: "gone", what: "chart" };
  }
  if (item.kind === "table") {
    const table = wb.tables.find((t) => t.id === item.tableId);
    const sheet = table && wb.sheets.find((s) => s.id === table.sheetId);
    return table && sheet ? { kind: "table", table, sheet } : { kind: "gone", what: "table" };
  }
  const sheet = wb.sheets.find((s) => s.id === item.sheetId);
  return sheet ? { kind: "range", sheet, area: item.area } : { kind: "gone", what: "sheet" };
}

/** The cells with something in them, as one area (null for an empty sheet). For the range picker's first guess. */
export function usedArea(sheet: Sheet): Area | null {
  let r0 = Infinity;
  let c0 = Infinity;
  let r1 = -1;
  let c1 = -1;
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.v === undefined && cell.f === undefined) continue;
    const i = key.indexOf(",");
    const r = Number(key.slice(0, i));
    const c = Number(key.slice(i + 1));
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
    if (c < c0) c0 = c;
    if (c > c1) c1 = c;
  }
  return r1 < 0 ? null : { r0, c0, r1, c1 };
}

// The table a note shows --------------------------------------------------------------------------

export type EmbedCell = {
  text: string;
  align: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: SheetColor;
  fill?: SheetColor;
  wrap?: boolean;
  /** Font size in px (13 is normal). */
  size?: number;
  border?: CellStyle["border"];
  /** A number (shown with even digits, so columns of numbers line up). */
  num?: boolean;
  error?: boolean;
};

export type EmbedRow = { cells: EmbedCell[]; part: "header" | "data" | "totals"; band: 0 | 1 };

export type EmbedTableModel = {
  kind: "table" | "range";
  /** The smart table's name, or the sheet's. */
  title: string;
  /** Where it is: "Blatt 1 · A1:D12". */
  where: string;
  sheetId: string;
  area: Area;
  /** Widths of the columns shown, in px (the spreadsheet's). */
  widths: number[];
  rows: EmbedRow[];
  /** A smart table's colour. */
  style: TableStyle | null;
  banded: boolean;
  /** Rows (and columns) not shown because there are too many. */
  moreRows: number;
  moreCols: number;
};

/** Rows hidden in a sheet: by hand, or by a smart table's filter. */
export function hiddenRows(wb: Workbook, calc: Calc, sheet: Sheet, locale: Locale): (row: number) => boolean {
  let filtered: Set<number> | null = null;
  if (wb.tables.some((t) => t.sheetId === sheet.id && Object.keys(t.filters).length > 0)) {
    try {
      filtered = filteredRows(wb, calc, sheet.id, locale);
    } catch {
      filtered = null;
    }
  }
  return (row) => !!sheet.rows[String(row)]?.hidden || !!filtered?.has(row);
}

function embedCell(value: CellValue, style: CellStyle | undefined, locale: Locale): EmbedCell {
  const s = style ?? {};
  let text: string;
  try {
    text = formatValue(value, s.fmt, locale);
  } catch {
    text = value === null ? "" : String(value);
  }
  const error = value !== null && isError(value);
  const cell: EmbedCell = { text, align: s.align ?? (value === null ? "left" : defaultAlign(value)) };
  if (typeof value === "number") cell.num = true;
  if (error) cell.error = true;
  if (s.valign) cell.valign = s.valign;
  if (s.bold) cell.bold = true;
  if (s.italic) cell.italic = true;
  if (s.underline) cell.underline = true;
  if (s.strike) cell.strike = true;
  if (s.color) cell.color = s.color;
  if (s.fill) cell.fill = s.fill;
  if (s.wrap) cell.wrap = true;
  if (s.size && s.size !== 13) cell.size = s.size;
  if (s.border && (s.border.top || s.border.right || s.border.bottom || s.border.left)) cell.border = s.border;
  return cell;
}

/**
 * The table a note shows for a smart table or a range: the visible rows and columns (hidden and
 * filtered ones are left out, like when Excel copies a filtered table), values as the cells show
 * them, with their looks. At most `maxRows` rows of data (a smart table's totals row always shows).
 */
export function embedTableModel(wb: Workbook, calc: Calc, item: SheetEmbedItem, locale: Locale, opts: { maxRows?: number; maxCols?: number } = {}): EmbedTableModel | null {
  const target = embedTarget(wb, item);
  if (target.kind !== "table" && target.kind !== "range") return null;
  const { sheet } = target;
  const table = target.kind === "table" ? target.table : null;
  const full = table ? table.area : target.kind === "range" ? target.area : null;
  if (!full) return null;
  // Never more than the sheet has.
  const area: Area = { r0: full.r0, c0: full.c0, r1: Math.min(full.r1, sheet.size.rows - 1, MAX_ROWS - 1), c1: Math.min(full.c1, sheet.size.cols - 1, MAX_COLS - 1) };
  const maxRows = opts.maxRows ?? EMBED_MAX_ROWS;
  const maxCols = opts.maxCols ?? EMBED_MAX_COLS;
  const hidden = hiddenRows(wb, calc, sheet, locale);
  const cols: number[] = [];
  let moreCols = 0;
  for (let c = area.c0; c <= area.c1; c++) {
    if (sheet.cols[String(c)]?.hidden) continue;
    if (cols.length >= maxCols) moreCols++;
    else cols.push(c);
  }
  const rows: EmbedRow[] = [];
  let moreRows = 0;
  let band: 0 | 1 = 0;
  let dataShown = 0;
  const value = (r: number, c: number): CellValue => {
    try {
      return calc.value(sheet.id, r, c);
    } catch {
      return null;
    }
  };
  for (let r = area.r0; r <= area.r1; r++) {
    const part: EmbedRow["part"] = table && r === table.area.r0 ? "header" : table?.totals && r === table.area.r1 ? "totals" : "data";
    // A header or totals row always shows; data rows only when not hidden.
    if (part === "data" && hidden(r)) continue;
    if (part === "data") {
      if (dataShown >= maxRows) {
        moreRows++;
        continue;
      }
      dataShown++;
    }
    const cells = cols.map((c) => {
      const cell = sheet.cells[cellKey(r, c)];
      return embedCell(cell ? value(r, c) : null, cell?.s, locale);
    });
    rows.push({ cells, part, band: part === "data" ? band : 0 });
    if (part === "data") band = band === 0 ? 1 : 0;
  }
  return {
    kind: table ? "table" : "range",
    title: table ? table.name : sheet.name,
    where: `${sheet.name} · ${areaName(full)}`,
    sheetId: sheet.id,
    area: full,
    widths: cols.map((c) => sheet.cols[String(c)]?.w ?? DEFAULT_COL_W),
    rows,
    style: table ? table.style : null,
    banded: table ? table.banded : false,
    moreRows,
    moreCols,
  };
}

/** A cell's text for Markdown: pipes escaped, line breaks as <br>. */
const mdCell = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r\n|\r|\n/g, "<br>").trim();

/**
 * The table as Markdown (GitHub's tables: the first row is the header, which Markdown always has;
 * a range without a smart table's header uses its first row). Numbers are right-aligned.
 */
export function embedTableMarkdown(model: EmbedTableModel): string {
  if (!model.rows.length || !model.widths.length) return "";
  const head = model.rows[0];
  const body = model.rows.slice(1);
  const width = model.widths.length;
  const numeric = Array.from({ length: width }, (_, c) => {
    const cells = body.filter((r) => r.part === "data").map((r) => r.cells[c]);
    return cells.length > 0 && cells.filter((x) => x.text !== "").every((x) => x.num || x.align === "right");
  });
  // Bold cells (and the totals row) in **…**; the header is bold in Markdown anyway.
  const line = (cells: EmbedCell[], header: boolean, totals: boolean) =>
    `| ${cells
      .map((x) => {
        const text = mdCell(x.text);
        return text && !header && (totals || x.bold) ? `**${text}**` : text;
      })
      .join(" | ")} |`;
  const rule = `|${numeric.map((n) => (n ? " ---: |" : " --- |")).join("")}`;
  return [line(head.cells, true, false), rule, ...body.map((r) => line(r.cells, false, r.part === "totals"))].join("\n");
}
