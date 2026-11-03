"use client";

// Printing the sheet on screen ("Drucken", Ctrl/⌘+P): a clean copy of its cells as they show —
// formatted values, bold and colours, alignment, borders, column widths, smart tables in their
// colours — on white paper, with its charts below. Like notes (src/components/editor/notePrint.ts)
// the copy sits in the page and is all the paper shows; the browser's print window (or the app's,
// see NativeBridge) does the rest, "Als PDF speichern" included. Wide sheets print in landscape
// and shrink to the page's width.
//
// Built with DOM nodes and textContent (never HTML strings): what people typed can't become markup.
// Charts are pictures (an <img> of their SVG), which can't run anything either.

import type { Locale } from "@/i18n/config";
import { chartData } from "@/sheet/chart/data";
import { chartSvg } from "@/sheet/chart/export";
import { COLOR_HEX } from "@/sheet/colors";
import { defaultAlign, formatValue, type Calc } from "@/sheet/engine";
import { DEFAULT_COL_W, type BorderLine, type Cell, type ChartSpec, type SheetColor, type TableSpec, type Workbook } from "@/sheet/types";

/** Room on A4 with 12 mm margins, in CSS px (96 per inch). */
const PORTRAIT_W = 703;
const LANDSCAPE_W = 1032;

const css = (landscape: boolean) => `
@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }
@media screen { .sheet-print { position: fixed; left: -100000px; top: 0; visibility: hidden; } }
@media print {
  html.sheet-printing, html.sheet-printing body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  html.sheet-printing body > :not(.sheet-print) { display: none !important; }
  html.sheet-printing .sheet-print { position: static !important; left: auto !important; visibility: visible !important; }
}
.sheet-print { background: #fff; color: #1c1b18; font: 11px/1.35 ${FONT}; }
.sheet-print * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.sheet-print h1 { margin: 0 0 2px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
.sheet-print .sheet-print-sub { margin: 0 0 10px; color: #6b6a65; font-size: 10.5px; }
.sheet-print table { border-collapse: collapse; table-layout: fixed; }
.sheet-print td { border: 0.5px solid #d6d4cf; padding: 1px 4px; height: 20px; vertical-align: bottom; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sheet-print td.wrap { white-space: pre-wrap; overflow-wrap: anywhere; text-overflow: clip; }
.sheet-print tr { break-inside: avoid; }
.sheet-print .sheet-print-charts { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 16px; }
.sheet-print .sheet-print-chart { break-inside: avoid; border: 0.5px solid #d6d4cf; border-radius: 6px; overflow: hidden; }
.sheet-print .sheet-print-chart img { display: block; max-width: 100%; height: auto; }
`;

const LINE: Record<BorderLine, string> = { thin: "1px solid #3c3b37", thick: "2px solid #1c1b18", double: "3px double #1c1b18", dashed: "1px dashed #3c3b37" };

/** A colour mixed with white (`amount` of the colour), as hex. */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const tableLook = (style: SheetColor) => {
  const c = COLOR_HEX[style];
  return { header: tint(c.light, 0.24), band: tint(c.light, 0.07), totals: tint(c.light, 0.11), ink: c.light, line: `1.5px solid ${c.light}` };
};

const hasContent = (c: Cell | undefined) => !!c && (c.v !== undefined || c.f !== undefined);

const FONT = 'Geist, Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
let measurer: CanvasRenderingContext2D | null | undefined;
/** How wide a text is on paper (px), or null when the browser can't say. */
function textWidth(text: string, size: number, bold: boolean, italic: boolean): number | null {
  if (measurer === undefined) measurer = document.createElement("canvas").getContext("2d");
  if (!measurer) return null;
  measurer.font = `${italic ? "italic " : ""}${bold ? 700 : 400} ${size}px ${FONT}`;
  return measurer.measureText(text).width;
}

type PrintOptions = { wb: Workbook; calc: Calc; sheetId: string; title: string; subtitle: string; locale: Locale; isRowHidden: (row: number) => boolean };

/** The copy for paper (not yet in the page); null when there is nothing on the sheet. */
export function buildPrintCopy(opts: PrintOptions): { box: HTMLElement; landscape: boolean } | null {
  const { wb, calc, sheetId, locale } = opts;
  const sheet = wb.sheets.find((s) => s.id === sheetId);
  if (!sheet) return null;
  const tables = wb.tables.filter((t) => t.sheetId === sheetId);
  const charts = wb.charts.filter((c) => c.sheetId === sheetId);

  // The used range: everything with content, a fill or a border, and every smart table.
  let r0 = Infinity;
  let c0 = Infinity;
  let r1 = -1;
  let c1 = -1;
  for (const key in sheet.cells) {
    const cell = sheet.cells[key];
    if (!hasContent(cell) && !cell.s?.fill && !cell.s?.border) continue;
    const i = key.indexOf(",");
    const r = Number(key.slice(0, i));
    const c = Number(key.slice(i + 1));
    r0 = Math.min(r0, r);
    c0 = Math.min(c0, c);
    r1 = Math.max(r1, r);
    c1 = Math.max(c1, c);
  }
  for (const t of tables) {
    r0 = Math.min(r0, t.area.r0);
    c0 = Math.min(c0, t.area.c0);
    r1 = Math.max(r1, t.area.r1);
    c1 = Math.max(c1, t.area.c1);
  }
  if (r1 < 0 && !charts.length) return null;

  const rows: number[] = [];
  const cols: number[] = [];
  if (r1 >= 0) {
    for (let r = r0; r <= r1; r++) if (!sheet.rows[r]?.hidden && !opts.isRowHidden(r)) rows.push(r);
    for (let c = c0; c <= c1; c++) if (!sheet.cols[c]?.hidden) cols.push(c);
  }
  const widths = cols.map((c) => sheet.cols[c]?.w ?? DEFAULT_COL_W);
  const tableWidth = widths.reduce((a, w) => a + w, 0);
  const chartWidth = Math.max(0, ...charts.map((c) => c.size.w));
  const landscape = Math.max(tableWidth, chartWidth) > PORTRAIT_W;
  const room = landscape ? LANDSCAPE_W : PORTRAIT_W;

  const box = document.createElement("div");
  box.className = "sheet-print";
  box.setAttribute("aria-hidden", "true");
  const style = document.createElement("style");
  style.textContent = css(landscape);
  const h1 = document.createElement("h1");
  h1.textContent = opts.title;
  box.append(style, h1);
  if (opts.subtitle) {
    const sub = document.createElement("p");
    sub.className = "sheet-print-sub";
    sub.textContent = opts.subtitle;
    box.append(sub);
  }

  if (rows.length && cols.length) {
    const table = document.createElement("table");
    // Too wide even in landscape: the table shrinks to the page.
    const zoom = Math.min(1, room / tableWidth);
    if (zoom < 1) table.style.setProperty("zoom", String(Math.max(0.3, zoom)));
    table.style.width = `${tableWidth}px`;
    const colgroup = document.createElement("colgroup");
    for (const w of widths) {
      const col = document.createElement("col");
      col.style.width = `${w}px`;
      colgroup.append(col);
    }
    table.append(colgroup);

    // Banding follows the rows that are printed (a filter doesn't leave two shaded rows together).
    const bandOf = new Map<string, Map<number, number>>();
    for (const t of tables) {
      const m = new Map<number, number>();
      let shown = 0;
      for (const r of rows) {
        if (r <= t.area.r0 || r > t.area.r1 || (t.totals && r === t.area.r1)) continue;
        m.set(r, shown++ % 2);
      }
      bandOf.set(t.id, m);
    }
    const tableAt = (r: number, c: number): TableSpec | undefined => tables.find((t) => r >= t.area.r0 && r <= t.area.r1 && c >= t.area.c0 && c <= t.area.c1);

    /** An empty cell that text from the left may run over (no look of its own, not in a table). */
    const free = (r: number, c: number) => {
      const cell = sheet.cells[`${r},${c}`];
      return !hasContent(cell) && !cell?.s?.fill && !cell?.s?.border && !tableAt(r, c);
    };

    const body = document.createElement("tbody");
    for (const r of rows) {
      const tr = document.createElement("tr");
      const h = sheet.rows[r]?.h;
      if (h) tr.style.height = `${h}px`;
      for (let ci = 0; ci < cols.length; ci++) {
        const c = cols[ci];
        const td = document.createElement("td");
        const cell = sheet.cells[`${r},${c}`];
        const s = cell?.s;
        const value = hasContent(cell) ? calc.value(sheetId, r, c) : null;
        const text = value === null ? "" : formatValue(value, s?.fmt, locale);
        if (text) td.textContent = text;
        const align = s?.align ?? (value === null ? "left" : defaultAlign(value));
        if (align !== "left") td.style.textAlign = align;
        if (s?.valign === "top") td.style.verticalAlign = "top";
        else if (s?.valign === "middle") td.style.verticalAlign = "middle";
        if (s?.wrap) td.className = "wrap";
        else if (text && align === "left") {
          // Long text runs over the empty cells to its right, as on screen: the cell spans as many
          // as it needs (never past the table's edge, where it ends with "…").
          const size = s?.size ? s.size * 0.85 : 11;
          const need = textWidth(text, size, !!s?.bold, !!s?.italic);
          let room = widths[ci];
          let span = 1;
          while (need !== null && room < need + 10 && ci + span < cols.length && free(r, cols[ci + span])) room += widths[ci + span++];
          if (span > 1) {
            td.colSpan = span;
            ci += span - 1;
          }
        }
        const t = tableAt(r, c);
        if (t) {
          const look = tableLook(t.style);
          if (r === t.area.r0) {
            td.style.background = look.header;
            td.style.color = look.ink;
            td.style.fontWeight = "700";
            td.style.borderBottom = look.line;
          } else if (t.totals && r === t.area.r1) {
            td.style.background = look.totals;
            td.style.fontWeight = "700";
            td.style.borderTop = look.line;
          } else if (t.banded && bandOf.get(t.id)?.get(r) === 1) td.style.background = look.band;
        }
        if (s?.fill) td.style.background = COLOR_HEX[s.fill].fill;
        if (s?.color) td.style.color = COLOR_HEX[s.color].light;
        if (s?.bold) td.style.fontWeight = "700";
        if (s?.italic) td.style.fontStyle = "italic";
        const deco = [s?.underline ? "underline" : "", s?.strike ? "line-through" : ""].filter(Boolean).join(" ");
        if (deco) td.style.textDecoration = deco;
        if (s?.size) td.style.fontSize = `${Math.round(s.size * 0.85 * 10) / 10}px`;
        if (s?.border) {
          if (s.border.top) td.style.borderTop = LINE[s.border.top];
          if (s.border.right) td.style.borderRight = LINE[s.border.right];
          if (s.border.bottom) td.style.borderBottom = LINE[s.border.bottom];
          if (s.border.left) td.style.borderLeft = LINE[s.border.left];
        }
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);
    box.append(table);
  }

  if (charts.length) {
    const wrap = document.createElement("div");
    wrap.className = "sheet-print-charts";
    for (const spec of charts) {
      const img = chartPicture(spec, calc, locale, room);
      if (img) wrap.append(img);
    }
    box.append(wrap);
  }
  return { box, landscape };
}

/** A chart as a picture of its SVG (light colours), at most as wide as the page. */
function chartPicture(spec: ChartSpec, calc: Calc, locale: Locale, room: number): HTMLElement | null {
  try {
    const w = Math.min(spec.size.w, room);
    const h = Math.round((spec.size.h * w) / spec.size.w);
    const svg = chartSvg(spec, chartData(spec, calc, locale), locale, { w, h });
    const holder = document.createElement("div");
    holder.className = "sheet-print-chart";
    const img = document.createElement("img");
    img.alt = spec.title;
    img.width = w;
    img.height = h;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    holder.append(img);
    return holder;
  } catch (e) {
    console.error("sheet: chart for printing failed", e);
    return null;
  }
}

/**
 * Print the sheet. False when there is nothing on it to print. Resolves once the print window has
 * closed (or the page was touched again: some browsers never say).
 */
export async function printSheet(opts: PrintOptions): Promise<boolean> {
  const built = buildPrintCopy(opts);
  if (!built) return false;
  const { box } = built;
  document.body.append(box);
  const root = document.documentElement;
  const docTitle = document.title;
  document.title = opts.title;
  root.classList.add("sheet-printing");
  // The charts' pictures decoded before the print window takes its copy.
  await Promise.race([Promise.all([...box.querySelectorAll("img")].map((img) => img.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]);
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pointerdown", finish);
      root.classList.remove("sheet-printing");
      box.remove();
      document.title = docTitle;
      resolve();
    };
    window.addEventListener("afterprint", finish, { once: true });
    try {
      window.print();
    } catch {
      finish();
      return;
    }
    window.addEventListener("pointerdown", finish, { once: true });
  });
  return true;
}
