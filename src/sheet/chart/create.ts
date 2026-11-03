// A sensible chart from selected cells, like Excel's "Empfohlene Diagramme":
// two or more number columns → scatter (first column x, the others y, header cells as names);
// a text column first → column chart with categories; one number column → line over 1, 2, 3….
//
// CONTRACT: keep names and signatures.
//
// More of the rules:
// - Series run down columns, unless a single area is wider than tall (then along rows).
// - The first row is a header when the number columns start with text there; header cells become
//   the series' names (as references, so renaming the column renames the series), the axis
//   titles of a scatter chart (x = the first header, y = the second one for a single series) and,
//   for one series, the chart's title. A smart table's own name (not "Tabelle1") is the title.
// - A text or date column first gives the categories. For column, bar, line, area and pie charts
//   asked for by name, a first number column that only grows (time points, concentrations)
//   gives them too; otherwise every number column is a series, as in Excel.
// - One selected cell stands for the block of filled cells around it; whole columns are cut to
//   the rows with data.
// - The chart sits two columns right of the data, at its first row, 480 × 300 px, with a legend
//   below when there is more than one series.

import type { Locale } from "@/i18n/config";
import { cellKey, normArea, parseKey } from "../a1";
import { isError, type Calc, type CellValue } from "../engine";
import { newId, sheetById } from "../ops";
import type { Area, AxisSpec, ChartKind, ChartSpec, NumberFormat, Pos, RangeRef, SeriesSpec, Sheet, Workbook } from "../types";
import { shownText } from "./data";

export const DEFAULT_CHART_SIZE = { w: 480, h: 300 } as const;

const hasContent = (sheet: Sheet, row: number, col: number) => {
  const c = sheet.cells[cellKey(row, col)];
  return !!c && ((c.v !== undefined && c.v !== "") || !!c.f);
};

/**
 * Excel's current region: the block of filled cells around (row, col), bounded by empty rows and
 * columns (Ctrl+A, and what one selected cell means for a chart).
 */
export function currentRegion(sheet: Sheet, row: number, col: number): Area {
  const a = { r0: row, c0: col, r1: row, c1: col };
  const maxR = sheet.size.rows - 1;
  const maxC = sheet.size.cols - 1;
  const rowFilled = (r: number) => {
    if (r < 0 || r > maxR) return false;
    for (let c = Math.max(0, a.c0 - 1); c <= Math.min(maxC, a.c1 + 1); c++) if (hasContent(sheet, r, c)) return true;
    return false;
  };
  const colFilled = (c: number) => {
    if (c < 0 || c > maxC) return false;
    for (let r = Math.max(0, a.r0 - 1); r <= Math.min(maxR, a.r1 + 1); r++) if (hasContent(sheet, r, c)) return true;
    return false;
  };
  for (let changed = true; changed; ) {
    changed = false;
    while (rowFilled(a.r1 + 1)) [a.r1, changed] = [a.r1 + 1, true];
    while (rowFilled(a.r0 - 1)) [a.r0, changed] = [a.r0 - 1, true];
    while (colFilled(a.c1 + 1)) [a.c1, changed] = [a.c1 + 1, true];
    while (colFilled(a.c0 - 1)) [a.c0, changed] = [a.c0 - 1, true];
  }
  return a;
}

/**
 * The areas a chart is made of, from the selected areas: inside a smart table its header and data
 * rows (never the totals row) of the selected columns, one cell in a table → the whole table,
 * one cell elsewhere → the block of filled cells around it (Excel does the same).
 */
export function chartSourceAreas(wb: Workbook, sheetId: string, selected: Area[]): Area[] {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || !selected.length) return [];
  const areas = selected.map(normArea);
  const tableOf = (a: Area) => wb.tables.find((t) => t.sheetId === sheetId && a.r0 >= t.area.r0 && a.r1 <= t.area.r1 && a.c0 >= t.area.c0 && a.c1 <= t.area.c1);
  const rowsOf = (t: Workbook["tables"][number]) => ({ r0: t.area.r0, r1: t.totals && t.area.r1 > t.area.r0 ? t.area.r1 - 1 : t.area.r1 });
  if (areas.length === 1 && areas[0].r0 === areas[0].r1 && areas[0].c0 === areas[0].c1) {
    const t = tableOf(areas[0]);
    if (t) return [{ ...rowsOf(t), c0: t.area.c0, c1: t.area.c1 }];
    return [currentRegion(sheet, areas[0].r0, areas[0].c0)];
  }
  return areas.map((a) => {
    const t = tableOf(a);
    return t ? { ...rowsOf(t), c0: a.c0, c1: a.c1 } : a;
  });
}

/** The part of an area that has data (a whole column → its filled rows); null when it is empty. */
export function trimToData(sheet: Sheet, area: Area): Area | null {
  const a = normArea(area);
  let r0 = Infinity;
  let c0 = Infinity;
  let r1 = -Infinity;
  let c1 = -Infinity;
  const big = (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1) > Object.keys(sheet.cells).length;
  const visit = (row: number, col: number) => {
    if (row < a.r0 || row > a.r1 || col < a.c0 || col > a.c1 || !hasContent(sheet, row, col)) return;
    r0 = Math.min(r0, row);
    r1 = Math.max(r1, row);
    c0 = Math.min(c0, col);
    c1 = Math.max(c1, col);
  };
  if (big) {
    for (const key of Object.keys(sheet.cells)) {
      const p = parseKey(key);
      visit(p.row, p.col);
    }
  } else {
    for (let r = a.r0; r <= a.r1; r++) for (let c = a.c0; c <= a.c1; c++) visit(r, c);
  }
  return r0 === Infinity ? null : { r0, c0, r1, c1 };
}

type LineType = "number" | "date" | "text" | "empty";
type Line = { cells: Pos[]; type: LineType };

const isDate = (fmt: NumberFormat | undefined) => fmt?.kind === "date" || fmt?.kind === "datetime" || fmt?.kind === "time";
const isText = (v: CellValue) => typeof v === "string" && v.trim() !== "";

/** A series with the defaults of a chart kind. */
export function newSeries(kind: ChartKind, y: RangeRef, opts: Partial<SeriesSpec> = {}): SeriesSpec {
  return {
    id: newId(),
    name: "",
    nameRef: null,
    y,
    x: null,
    color: null,
    marker: kind === "scatter" || kind === "line" ? "circle" : "none",
    line: kind === "line" ? "straight" : "none",
    labels: false,
    errorBars: null,
    trendline: null,
    ...opts,
  };
}

export const newAxis = (title = "", grid = false): AxisSpec => ({ title, min: null, max: null, log: false, grid, decimals: null });

/** A new chart for the areas (Ctrl-selected areas count as more columns), placed right of the data; null when nothing to chart. */
export function chartFromAreas(wb: Workbook, calc: Calc, sheetId: string, areas: Area[], locale: Locale, kind?: ChartKind): ChartSpec | null {
  const sheet = sheetById(wb, sheetId);
  if (!sheet || !areas.length) return null;
  let list = areas.map(normArea);
  if (list.length === 1 && list[0].r0 === list[0].r1 && list[0].c0 === list[0].c1) list = [currentRegion(sheet, list[0].r0, list[0].c0)];
  list = list.map((a) => trimToData(sheet, a)).filter((a): a is Area => a !== null);
  if (!list.length) return null;

  const value = (p: Pos) => calc.value(sheetId, p.row, p.col);
  const fmtAt = (p: Pos) => sheet.cells[cellKey(p.row, p.col)]?.s?.fmt;

  // Lines of cells: columns (or rows of a single wide area).
  const first = list[0];
  const byRows = list.length === 1 && first.c1 - first.c0 > first.r1 - first.r0;
  const raw: Pos[][] = [];
  for (const a of list) {
    if (byRows) for (let r = a.r0; r <= a.r1; r++) raw.push(Array.from({ length: a.c1 - a.c0 + 1 }, (_, i) => ({ row: r, col: a.c0 + i })));
    else for (let c = a.c0; c <= a.c1; c++) raw.push(Array.from({ length: a.r1 - a.r0 + 1 }, (_, i) => ({ row: a.r0 + i, col: c })));
  }

  const numbersIn = (cells: Pos[]) => cells.some((p) => typeof value(p) === "number");
  // A header: the lines with numbers below start with text (or nothing) there.
  const withNumbers = raw.filter((l) => l.length > 1 && numbersIn(l.slice(1)));
  const hasHeader =
    withNumbers.length > 0 &&
    withNumbers.every((l) => {
      const v = value(l[0]);
      return v === null || v === "" || isText(v);
    }) &&
    raw.some((l) => isText(value(l[0])));

  const typeOf = (cells: Pos[]): LineType => {
    let nums = 0;
    let dates = 0;
    let texts = 0;
    for (const p of cells) {
      const v = value(p);
      if (typeof v === "number") {
        nums++;
        if (isDate(fmtAt(p))) dates++;
      } else if (isText(v)) texts++;
    }
    if (nums > 0 && nums >= texts) return dates * 2 >= nums ? "date" : "number";
    return texts > 0 ? "text" : "empty";
  };
  const lines: (Line & { header: Pos | null })[] = raw
    .map((cells) => {
      const data = hasHeader ? cells.slice(1) : cells;
      return { cells: data, type: typeOf(data), header: hasHeader ? cells[0] : null };
    })
    .filter((l) => l.type !== "empty" && l.cells.length > 0);
  if (!lines.length) return null;

  const head = lines[0];
  const numeric = lines.filter((l) => l.type === "number");
  const increasing = (l: Line) => {
    let prev = -Infinity;
    let count = 0;
    for (const p of l.cells) {
      const v = value(p);
      if (typeof v !== "number") continue;
      if (!(v > prev)) return false;
      prev = v;
      count++;
    }
    return count > 1;
  };

  let k: ChartKind;
  let xLine: (typeof lines)[number] | null = null;
  let catLine: (typeof lines)[number] | null = null;
  let seriesLines: typeof lines;
  if (!kind) {
    if (head.type === "text" || head.type === "date") {
      catLine = head;
      seriesLines = lines.slice(1).filter((l) => l.type === "number");
      k = head.type === "text" ? "column" : "line";
    } else if (numeric.length >= 2) {
      k = "scatter";
      xLine = head;
      seriesLines = lines.slice(1).filter((l) => l.type === "number");
    } else {
      k = "line";
      seriesLines = numeric;
    }
  } else if (kind === "scatter") {
    k = kind;
    if ((head.type === "number" || head.type === "date") && lines.length >= 2) {
      xLine = head;
      seriesLines = lines.slice(1).filter((l) => l.type === "number");
    } else seriesLines = numeric;
  } else {
    k = kind;
    if (head.type === "text" || head.type === "date" || (numeric.length >= 2 && head.type === "number" && increasing(head))) {
      catLine = head;
      seriesLines = lines.slice(1).filter((l) => l.type === "number");
    } else seriesLines = numeric;
    if (k === "pie") seriesLines = seriesLines.slice(0, 1);
  }
  if (!seriesLines.length) return null;

  const refOf = (cells: Pos[]): RangeRef => ({
    sheetId,
    r0: Math.min(...cells.map((p) => p.row)),
    c0: Math.min(...cells.map((p) => p.col)),
    r1: Math.max(...cells.map((p) => p.row)),
    c1: Math.max(...cells.map((p) => p.col)),
  });
  const headerText = (l: (typeof lines)[number] | null) => {
    if (!l?.header) return "";
    const v = value(l.header);
    if (v === null || isError(v)) return "";
    return shownText(v, fmtAt(l.header), locale).trim();
  };
  const nameRefOf = (l: (typeof lines)[number]): RangeRef | null => (headerText(l) && l.header ? { sheetId, r0: l.header.row, c0: l.header.col, r1: l.header.row, c1: l.header.col } : null);

  // Replicates with a mean and a standard deviation column ("Mittelwert", "Stabw"): chart the
  // means, with the standard deviations as their error bars, like a lab report does.
  const sdOf = new Map<(typeof lines)[number], (typeof lines)[number]>();
  if (k !== "pie") {
    seriesLines.forEach((l, i) => {
      if (!MEAN_RE.test(headerText(l))) return;
      const sd = seriesLines.slice(i + 1).find((m) => SD_RE.test(headerText(m)));
      if (sd && ![...sdOf.values()].includes(sd)) sdOf.set(l, sd);
    });
    if (sdOf.size) seriesLines = [...sdOf.keys()];
  }
  const series = seriesLines.map((l) => {
    const sd = sdOf.get(l);
    return newSeries(k, refOf(l.cells), {
      nameRef: nameRefOf(l),
      errorBars: sd ? { kind: "custom", value: 0, plus: refOf(sd.cells), minus: null, direction: "both" } : null,
    });
  });

  const tableTitle = tableName(wb, sheetId, list);
  const single = series.length === 1 ? headerText(seriesLines[0]) : "";
  const xTitle = k === "scatter" ? headerText(xLine) : "";
  const yTitle = k === "scatter" && series.length === 1 ? single : "";
  const xRange = xLine ?? catLine;
  return {
    id: newId(),
    sheetId,
    at: { row: Math.min(...list.map((a) => a.r0)), col: Math.max(...list.map((a) => a.c1)) + 2, dx: 0, dy: 0 },
    size: { ...DEFAULT_CHART_SIZE },
    kind: k,
    title: tableTitle ?? single,
    x: xRange ? refOf(xRange.cells) : null,
    series,
    xAxis: newAxis(xTitle, false),
    yAxis: newAxis(yTitle, k !== "pie"),
    legend: series.length > 1 ? "bottom" : "none",
  };
}

/** Column headers of means and standard deviations, in German and English lab use. */
const MEAN_RE = /(^|[^\p{L}])(mittelwert|mittel|mean|average|avg|durchschnitt|mw|ø|x̄)([^\p{L}]|$)/iu;
const SD_RE = /(^|[^\p{L}])(stabw|stabw\.s|standardabweichung|std\.?\s?abw\.?|sd|s\.d\.|stdev|std|standard deviation|±)([^\p{L}]|$)/iu;

/** The name of the smart table all areas lie in, unless it is an automatic one ("Tabelle1", "Table2"). */
function tableName(wb: Workbook, sheetId: string, areas: Area[]): string | null {
  const t = wb.tables.find((tb) => tb.sheetId === sheetId && areas.every((a) => a.r0 >= tb.area.r0 && a.r1 <= tb.area.r1 && a.c0 >= tb.area.c0 && a.c1 <= tb.area.c1));
  if (!t || /^(tabelle|table)\s*\d*$/i.test(t.name.trim())) return null;
  return t.name.trim() || null;
}
