// A chart's data, read from the cells: points per series, names, categories, error bars and
// fitted trendlines. Shared by the chart in the editor, its export and the chart embedded in a note.
//
// CONTRACT: keep names and signatures.
//
// Like Excel:
// - Cells that aren't numbers (text, empty, errors, TRUE/FALSE) are skipped: a gap in a line.
// - Rows and columns hidden by hand or by a smart table's filter are left out (Excel's default
//   "show data in hidden rows and columns" is off), so filtering a table filters its chart. How
//   many numbers that leaves out is counted: formulas like STEIGUNG still use them.
// - A scatter series whose x cells contain text is plotted against 1, 2, 3 … instead; the first
//   such cell is reported, so the chart and the panel can say why.
// - Trendlines of line, column, bar and area charts are fitted against the category number
//   1, 2, 3 … (Excel's x for category charts), so their equations match Excel's. ChartPoint.x of
//   those charts is the 0-based category index, so the view draws the trendline at x − 1.
// - Error bars are absolute ends (lo, hi) per point. "stdev" is value × the sample standard
//   deviation (STABW.S) of the series' values around each point; "stderr" is SD / √n of the
//   series; "custom" reads the + and − amounts cell by cell (a missing − range uses the + one).

import type { Locale } from "@/i18n/config";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import { cellKey, posName, quoteSheetName } from "../a1";
import { SERIES_COLORS } from "../colors";
import { formatValue, isError, type Calc, type CellValue } from "../engine";
import { sheetById } from "../ops";
import { filteredRows } from "../table/model";
import type { ChartSpec, ErrorBarSpec, NumberFormat, RangeRef, SeriesSpec, SheetColor, Workbook } from "../types";
import { formatDecimals } from "./format";
import { fitTrendline, type Fit, type FitError } from "./regression";

export type ChartPoint = {
  /** Scatter: the x value; other kinds: the category index (0, 1, 2…). */
  x: number;
  y: number;
  /** Error bar ends (absolute values), when the series has error bars. */
  lo?: number;
  hi?: number;
  /** The cell this point came from (for highlighting it on the grid). */
  row: number;
  col: number;
};

export type ChartSeriesData = {
  id: string;
  name: string;
  color: SheetColor;
  points: ChartPoint[];
  /** The fitted trendline, or why it can't be fitted. */
  fit: Fit | FitError | null;
  /**
   * Numbers of the series left out because their row or column is hidden or filtered out (like
   * Excel's charts). Formulas like STEIGUNG still count them, so the panel says so.
   */
  hiddenPoints?: number;
  /**
   * Scatter: the first shown x cell that holds text, why the series is plotted against 1, 2, 3 …
   * (Excel does that without a word). `cell` names it as the chart's sheet writes it: "A7", or
   * "'Blatt 2'!A7" on another sheet.
   */
  xText?: { cell: string; text: string; sheetId: string; row: number; col: number };
};

export type ChartData = {
  /** Category labels (line, column, bar, area, pie), as shown in the cells. */
  categories: string[];
  series: ChartSeriesData[];
  /** Number formats of the source cells, so ticks look like the data ("0,25", "25 %"). */
  xDecimals: number | null;
  yDecimals: number | null;
  /** The number format of the first x (scatter) and y value: percent, units, dates for ticks and tooltips. */
  xFormat?: NumberFormat | null;
  yFormat?: NumberFormat | null;
};

/** The colour series i shows in (its own, else the palette in turn). */
export const seriesColor = (s: Pick<SeriesSpec, "color">, i: number): SheetColor => s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];

/** At most this many cells are read per range (a whole column is 20 000 rows: fine; a whole sheet isn't). */
const MAX_CELLS = 100_000;

type CellRead = { pos: number; row: number; col: number; value: CellValue; fmt: NumberFormat | undefined; visible: boolean };

/** Which rows and columns are hidden (by hand or by a table filter), per sheet, computed once per chartData call. */
function hiddenLookup(wb: Workbook, calc: Calc, locale: Locale) {
  const cache = new Map<string, { rows: Set<number> | null; isRowHidden: (r: number) => boolean; isColHidden: (c: number) => boolean }>();
  return (sheetId: string) => {
    let entry = cache.get(sheetId);
    if (!entry) {
      const sheet = sheetById(wb, sheetId);
      const filtered = wb.tables.some((t) => t.sheetId === sheetId && Object.keys(t.filters).length > 0) ? filteredRows(wb, calc, sheetId, locale) : null;
      entry = {
        rows: filtered,
        isRowHidden: (r) => !!sheet?.rows[String(r)]?.hidden || !!filtered?.has(r),
        isColHidden: (c) => !!sheet?.cols[String(c)]?.hidden,
      };
      cache.set(sheetId, entry);
    }
    return entry;
  };
}

/** The cells of a range in reading order, with their position in the range (pos) and whether they are shown. */
function readRange(calc: Calc, ref: RangeRef, hidden: ReturnType<typeof hiddenLookup>): CellRead[] {
  const sheet = sheetById(calc.workbook, ref.sheetId);
  if (!sheet) return [];
  const cols = ref.c1 - ref.c0 + 1;
  const r1 = Math.min(ref.r1, ref.r0 + Math.max(0, Math.floor(MAX_CELLS / Math.max(1, cols)) - 1));
  const area = { ...ref, r1 };
  const values = calc.values(area);
  const h = hidden(ref.sheetId);
  const out: CellRead[] = [];
  let pos = 0;
  for (let r = area.r0; r <= area.r1; r++) {
    for (let c = area.c0; c <= area.c1; c++) {
      out.push({ pos: pos++, row: r, col: c, value: values[r - area.r0]?.[c - area.c0] ?? null, fmt: sheet.cells[cellKey(r, c)]?.s?.fmt, visible: !h.isRowHidden(r) && !h.isColHidden(c) });
    }
  }
  return out;
}

const num = (v: CellValue): number => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/** A cell's value as the cell shows it (text as typed, numbers and dates in their format). */
export function shownText(v: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  if (v === null) return "";
  if (typeof v === "string") return v;
  return formatValue(v, fmt, locale);
}

const sampleSd = (v: number[]) => {
  if (v.length < 2) return NaN;
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
};

/** Error bar ends for every point of a series; `pos[i]` is point i's position in the y range (for custom amounts). */
function errorBars(points: ChartPoint[], pos: number[], eb: ErrorBarSpec, calc: Calc, hidden: ReturnType<typeof hiddenLookup>) {
  const ys = points.map((p) => p.y);
  let plusAt: (p: ChartPoint, i: number) => number;
  let minusAt: (p: ChartPoint, i: number) => number;
  const value = Number.isFinite(eb.value) ? Math.abs(eb.value) : 0;
  switch (eb.kind) {
    case "fixed":
      plusAt = minusAt = () => value;
      break;
    case "percent":
      plusAt = minusAt = (p) => (Math.abs(p.y) * value) / 100;
      break;
    case "stdev": {
      const sd = sampleSd(ys) * (value || 1);
      plusAt = minusAt = () => sd;
      break;
    }
    case "stderr": {
      const se = sampleSd(ys) / Math.sqrt(ys.length);
      plusAt = minusAt = () => se;
      break;
    }
    case "custom": {
      const plus = eb.plus ? readRange(calc, eb.plus, hidden) : [];
      const minus = eb.minus ? readRange(calc, eb.minus, hidden) : plus;
      const amount = (cells: CellRead[], at: number) => {
        const v = num(cells[at]?.value ?? null);
        return Number.isFinite(v) ? Math.abs(v) : 0;
      };
      plusAt = (_, i) => amount(plus, pos[i]);
      minusAt = (_, i) => amount(minus, pos[i]);
      break;
    }
    default:
      return;
  }
  points.forEach((p, i) => {
    const up = eb.direction === "minus" ? 0 : plusAt(p, i);
    const down = eb.direction === "plus" ? 0 : minusAt(p, i);
    if (!Number.isFinite(up) || !Number.isFinite(down)) return;
    p.lo = p.y - down;
    p.hi = p.y + up;
  });
}

/** Read a chart's data. Cells that aren't numbers are skipped (a gap in a line). */
export function chartData(spec: ChartSpec, calc: Calc, locale: Locale): ChartData {
  const t = sheetChartText[locale];
  const wb = calc.workbook;
  const hidden = hiddenLookup(wb, calc, locale);
  const scatter = spec.kind === "scatter";
  const shared = spec.x ? readRange(calc, spec.x, hidden).filter((c) => c.visible) : null;

  let xDecimals: number | null = null;
  let yDecimals: number | null = null;
  let xFormat: NumberFormat | null = null;
  let yFormat: NumberFormat | null = null;

  const series: ChartSeriesData[] = spec.series.map((s, si) => {
    const yCells = readRange(calc, s.y, hidden);
    const ys = yCells.filter((c) => c.visible);
    let hiddenPoints = 0;
    for (const c of yCells) if (!c.visible && Number.isFinite(num(c.value))) hiddenPoints++;
    let xs: CellRead[] | null = null;
    let xText: ChartSeriesData["xText"];
    if (scatter) {
      const own = s.x ? readRange(calc, s.x, hidden).filter((c) => c.visible) : null;
      xs = own ?? shared;
      // Excel: text among the x values → the series is plotted against 1, 2, 3 …. The first such
      // cell is kept, so the chart and its panel can say which one it is.
      const textCell = xs?.find((c) => typeof c.value === "string" && c.value.trim() !== "");
      const xRef = s.x ?? spec.x;
      if (textCell && xRef) {
        xText = { cell: cellName(wb, spec.sheetId, xRef.sheetId, textCell.row, textCell.col), text: String(textCell.value).trim(), sheetId: xRef.sheetId, row: textCell.row, col: textCell.col };
        xs = null;
      }
    }
    const points: ChartPoint[] = [];
    const pos: number[] = [];
    ys.forEach((cell, i) => {
      const y = num(cell.value);
      if (!Number.isFinite(y)) return;
      let x: number;
      if (scatter) {
        if (xs) {
          const xc = xs[i];
          x = xc ? num(xc.value) : NaN;
          if (!Number.isFinite(x)) return;
          if (xFormat === null && xc.fmt) {
            xFormat = xc.fmt;
            xDecimals = formatDecimals(xc.fmt);
          }
        } else x = i + 1;
      } else x = i;
      if (yFormat === null && cell.fmt) {
        yFormat = cell.fmt;
        yDecimals = formatDecimals(cell.fmt);
      }
      points.push({ x, y, row: cell.row, col: cell.col });
      pos.push(cell.pos);
    });
    if (s.errorBars && spec.kind !== "pie") errorBars(points, pos, s.errorBars, calc, hidden);

    let fit: Fit | FitError | null = null;
    if (s.trendline && spec.kind !== "pie") {
      const fx = points.map((p) => (scatter ? p.x : p.x + 1));
      fit = fitTrendline(
        fx,
        points.map((p) => p.y),
        s.trendline,
      );
    }
    return {
      id: s.id,
      name: seriesName(s, si, calc, locale, t.seriesDefault),
      color: seriesColor(s, si),
      points,
      fit,
      ...(hiddenPoints ? { hiddenPoints } : {}),
      ...(xText ? { xText } : {}),
    };
  });

  let categories: string[] = [];
  if (!scatter) {
    // As many categories as there are values or labels: empty cells at the end (a whole column
    // taken as the range) don't make empty categories.
    const labels = shared ? shared.map((c) => shownText(c.value, c.fmt, locale)) : [];
    let used = 0;
    for (const s of series) for (const p of s.points) used = Math.max(used, p.x + 1);
    for (let i = labels.length - 1; i >= used; i--) {
      if (labels[i].trim()) {
        used = i + 1;
        break;
      }
    }
    categories = labels.slice(0, used);
    for (let i = categories.length; i < used; i++) categories.push(String(i + 1));
  }
  return { categories, series, xDecimals, yDecimals, xFormat, yFormat };
}

/** A cell as the chart's sheet writes it: "A7", or "'Blatt 2'!A7" on another sheet. */
function cellName(wb: Workbook, hostSheetId: string, sheetId: string, row: number, col: number): string {
  const name = posName({ row, col });
  if (sheetId === hostSheetId) return name;
  const sheet = sheetById(wb, sheetId);
  return sheet ? `${quoteSheetName(sheet.name)}!${name}` : name;
}

function seriesName(s: SeriesSpec, i: number, calc: Calc, locale: Locale, fallback: (n: number) => string): string {
  if (s.nameRef) {
    const v = calc.value(s.nameRef.sheetId, s.nameRef.r0, s.nameRef.c0);
    if (v !== null && !(typeof v === "string" && !v.trim())) {
      if (isError(v)) return s.name.trim() || fallback(i + 1);
      const fmt = sheetById(calc.workbook, s.nameRef.sheetId)?.cells[cellKey(s.nameRef.r0, s.nameRef.c0)]?.s?.fmt;
      return shownText(v, fmt, locale);
    }
  }
  return s.name.trim() || fallback(i + 1);
}
