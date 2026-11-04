// A sensible chart from selected cells, like Excel's "Empfohlene Diagramme":
// two or more number columns → scatter (first column x, the others y, header cells as names);
// a text column first → column chart with categories, unless a lab series follows it (then a
// scatter chart, see below); one number column → line over 1, 2, 3….
//
// CONTRACT: keep names and signatures.
//
// More of the rules:
// - Series run down columns, unless a single area outside smart tables is wider than tall (then
//   along rows, like a plate reader's wells × times, as in Excel), except where its columns make
//   a lab series under a header that names a concentration or a dilution (c, Konz., Verdünnung):
//   a replicate table with few dilutions. A smart table's columns are its fields, however few
//   rows it has.
// - The first row is a header when the number columns start with text there; header cells become
//   the series' names (as references, so renaming the column renames the series), the axis
//   titles of a scatter chart (x = the first header, y = the second one for a single series) and,
//   for one series, the chart's title. A smart table's own name (not "Tabelle1") is the title.
// - A lab series: a column of sample names first (S0, S1 …, 1:2, 1:4 … or Probe A: most with a
//   number or a letter on its own; ratios typed as clock times under a header that names a ratio
//   too), then a column of at least four numbers that only rise or only fall (concentrations, a
//   dilution series, times; a blank or standards measured twice may repeat a number, with at
//   least three different ones), then more numbers. It becomes a scatter
//   chart of those numbers against that column, without the names, ready for a trendline: what a
//   student draws for a calibration. Days, weeks or months as the labels (Tag 1, KW 12, Jan) are
//   the x axis themselves, unless times follow them, and words (Mathe, Licht) are categories:
//   both stay column charts. A scatter chart asked for by name takes the first number column
//   after the labels as x too, but not after days, weeks or months (its points then sit at
//   1, 2, 3 …, one per label).
// - Clock times or durations first (0:00, 0:30 …, not calendar dates): a scatter chart with its
//   points joined by straight lines, so they sit at their real times (a growth curve).
// - Otherwise a text or date column first gives the categories. For column, bar, line, area and
//   pie charts asked for by name, a first number column that only grows (time points,
//   concentrations) gives them too; otherwise every number column is a series, as in Excel.
// - One selected cell stands for the block of filled cells around it; whole columns are cut to
//   the rows with data.
// - The chart sits two columns right of the data, at its first row, 480 × 300 px, with a legend
//   below when there is more than one series. Inserting it then finds it a place on screen and off
//   filled cells, smaller on a phone (placeInView in src/components/sheet/chart/actions.ts).

import type { Locale } from "@/i18n/config";
import { cellKey, normArea, parseKey } from "../a1";
import { isError, type Calc, type CellValue } from "../engine";
import { namesRatio } from "../engine/input";
import { newId, sheetById } from "../ops";
import type { Area, AxisSpec, ChartKind, ChartSpec, NumberFormat, Pos, RangeRef, SeriesSpec, Sheet, Workbook } from "../types";
import { shownText } from "./data";

export const DEFAULT_CHART_SIZE = { w: 480, h: 300 } as const;
/** The smallest a chart gets, by resizing it or made on a phone (px). */
export const CHART_MIN = { w: 240, h: 160 } as const;

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

/** "date": calendar dates (with or without the time of day); "time": clock times or durations. */
type LineType = "number" | "date" | "time" | "text" | "empty";
type Line = { cells: Pos[]; type: LineType };
/** A line with its header cell (null: the block has no header), and whether it holds ratios typed as clock times (see linesOf). */
type HLine = Line & { header: Pos | null; ratios: boolean };

const isCalendar = (fmt: NumberFormat | undefined) => fmt?.kind === "date" || fmt?.kind === "datetime";
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

  const numbersIn = (cells: Pos[]) => cells.some((p) => typeof value(p) === "number");
  const typeOf = (cells: Pos[]): LineType => {
    let nums = 0;
    let dates = 0;
    let times = 0;
    let texts = 0;
    for (const p of cells) {
      const v = value(p);
      if (typeof v === "number") {
        nums++;
        const fmt = fmtAt(p);
        if (isCalendar(fmt)) dates++;
        else if (fmt?.kind === "time") times++;
      } else if (isText(v)) texts++;
    }
    if (nums > 0 && nums >= texts) return (dates + times) * 2 < nums ? "number" : dates >= times ? "date" : "time";
    return texts > 0 ? "text" : "empty";
  };
  const headerText = (l: Pick<HLine, "header"> | null) => {
    if (!l?.header) return "";
    const v = value(l.header);
    if (v === null || isError(v)) return "";
    return shownText(v, fmtAt(l.header), locale).trim();
  };
  /**
   * The lines of cells: columns, or (`rows`) rows, each with its header cell when the block has a
   * header (the lines with numbers below start with text, or nothing, there). Ratios typed as
   * clock times under a header that names a ratio ("Verdünnung": 1:2 became 01:02) are its
   * labels, as if kept as text.
   */
  const linesOf = (rows: boolean): HLine[] => {
    const raw: Pos[][] = [];
    for (const a of list) {
      if (rows) for (let r = a.r0; r <= a.r1; r++) raw.push(Array.from({ length: a.c1 - a.c0 + 1 }, (_, i) => ({ row: r, col: a.c0 + i })));
      else for (let c = a.c0; c <= a.c1; c++) raw.push(Array.from({ length: a.r1 - a.r0 + 1 }, (_, i) => ({ row: a.r0 + i, col: c })));
    }
    const withNumbers = raw.filter((l) => l.length > 1 && numbersIn(l.slice(1)));
    const hasHeader =
      withNumbers.length > 0 &&
      withNumbers.every((l) => {
        const v = value(l[0]);
        return v === null || v === "" || isText(v);
      }) &&
      raw.some((l) => isText(value(l[0])));
    return raw
      .map((cells): HLine => {
        const data = hasHeader ? cells.slice(1) : cells;
        const header = hasHeader ? cells[0] : null;
        const type = typeOf(data);
        const ratios = type === "time" && namesRatio(headerText({ header }));
        return { cells: data, type: ratios ? "text" : type, header, ratios };
      })
      .filter((l) => l.type !== "empty" && l.cells.length > 0);
  };

  const refOf = (cells: Pos[]): RangeRef => ({
    sheetId,
    r0: Math.min(...cells.map((p) => p.row)),
    c0: Math.min(...cells.map((p) => p.col)),
    r1: Math.max(...cells.map((p) => p.row)),
    c1: Math.max(...cells.map((p) => p.col)),
  });
  const nameRefOf = (l: HLine): RangeRef | null => (headerText(l) && l.header ? { sheetId, r0: l.header.row, c0: l.header.col, r1: l.header.row, c1: l.header.col } : null);

  /**
   * At least `min` numbers in the line, each above the one before (or, with `either`, each below it
   * too). `ties`: a number may also repeat the one before (a blank measured twice, standards in
   * duplicate, one per row), as long as at least three different ones rise or fall.
   */
  const ordered = (l: Line, min: number, either: boolean, ties = false) => {
    let up = true;
    let down = either;
    let prev = NaN;
    let count = 0;
    const different = new Set<number>();
    for (const p of l.cells) {
      const v = value(p);
      if (typeof v !== "number") continue;
      if (count > 0) {
        up &&= ties ? v >= prev : v > prev;
        down &&= ties ? v <= prev : v < prev;
      }
      prev = v;
      count++;
      different.add(v);
    }
    return count >= min && (up || down) && (!ties || different.size >= 3);
  };
  // E1, E2 … or "Messwert 1", "Messwert 2": numbered replicates, measured side by side.
  const stem = (l: HLine) => headerText(l).toLowerCase().replace(/[\d₀-₉\s.,:;()[\]/_-]+/g, "");
  const replicates = (a: HLine, b: HLine) => headerText(a) !== headerText(b) && stem(a) !== "" && stem(a) === stem(b);
  /** At least half of the texts in the line pass the test. */
  const mostTexts = (l: Line, test: (s: string) => boolean) => {
    let texts = 0;
    let passed = 0;
    for (const p of l.cells) {
      const v = value(p);
      if (typeof v !== "string" || !v.trim()) continue;
      texts++;
      if (test(v)) passed++;
    }
    return texts > 0 && passed * 2 >= texts;
  };
  /**
   * A lab series in the columns: a label column first (S0, S1 … or 1:2, 1:4 …), then the first
   * column of numbers or times, the x values, when more numbers follow. Not a column of means or
   * standard deviations, and not the first of several replicates: those are measurements. Not
   * after days, weeks or months either (Tag 1, KW 12, Jan, or a header like "Tag"): those are the
   * x axis themselves, with every number column measured over them (cress growing in light and in
   * the dark), unless a column of times follows them (Zeitpunkt T0, T1 … with t (min)).
   * `samples`: the labels name samples, with a number or a letter (S1, Std 2, 1:4, Probe A, or
   * ratios kept as times); words (Mathe, Licht, Ana) name categories, whose first number column
   * may rise by chance or by sorting. `rises`: the x values only rise or only fall (ties allowed).
   */
  const labSeriesIn = (lines: HLine[]) => {
    const head = lines[0];
    const at = head.type === "text" ? lines.findIndex((l, i) => i > 0 && (l.type === "number" || l.type === "time")) : -1;
    const x = at > 0 ? lines[at] : null;
    const ys = x ? lines.slice(at + 1).filter((l) => l.type === "number") : [];
    const overTime = x !== null && x.type !== "time" && !TIME_HEAD_RE.test(headerText(x)) && (WHEN_RE.test(headerText(head)) || mostTexts(head, (s) => WHEN_RE.test(s)));
    const series = x && ys.length > 0 && !overTime && !MEAN_RE.test(headerText(x)) && !SD_RE.test(headerText(x)) && !replicates(x, ys[0]) ? { x, ys } : null;
    const samples = series !== null && (head.ratios || mostTexts(head, (s) => SAMPLE_RE.test(s)));
    return { series, samples, rises: series !== null && ordered(series.x, 4, true, true) };
  };

  // Lines of cells: columns, or rows of a single area wider than tall outside smart tables (a plate
  // reader's wells × times, as in Excel; a smart table's columns are its fields, however few rows
  // it has). Unless its columns make a lab series under a header that names a concentration or a
  // dilution (a replicate table with five dilutions and nine columns of results): then columns.
  const first = list[0];
  const inTable = (a: Area) => wb.tables.some((t) => t.sheetId === sheetId && a.r0 >= t.area.r0 && a.r1 <= t.area.r1 && a.c0 >= t.area.c0 && a.c1 <= t.area.c1);
  const wide = list.length === 1 && !inTable(first) && first.c1 - first.c0 > first.r1 - first.r0;
  const columns = linesOf(false);
  const asColumns = columns.length > 0 ? labSeriesIn(columns) : null;
  const byRows = wide && !(asColumns?.series && asColumns.samples && asColumns.rises && namesAmount(headerText(asColumns.series.x)));
  const lines = byRows ? linesOf(true) : columns;
  if (!lines.length) return null;

  const head = lines[0];
  const numeric = lines.filter((l) => l.type === "number");
  const numbersAfter = (i: number) => lines.slice(i + 1).filter((l) => l.type === "number");
  const lab = byRows ? null : asColumns;
  const labelSeries = lab?.series ?? null;

  let k: ChartKind;
  let xLine: HLine | null = null;
  let catLine: HLine | null = null;
  let seriesLines: HLine[];
  // Points joined by straight lines: a scatter chart over times (a growth curve).
  let joined = false;
  if (!kind) {
    if (head.type === "time") {
      // Clock times or durations (0:00, 0:30 …): points at their real times, not evenly spaced
      // categories, so a corrected time moves its point. Calendar dates stay categories.
      k = "scatter";
      xLine = head;
      seriesLines = numbersAfter(0);
      joined = true;
    } else if (labelSeries && lab?.samples && lab.rises) {
      // A calibration, a dilution series, measurements over time, with a label per row: the
      // numbers against the rising (or falling) column, as a lab report plots them.
      k = "scatter";
      xLine = labelSeries.x;
      seriesLines = labelSeries.ys;
      joined = labelSeries.x.type === "time";
    } else if (head.type === "text" || head.type === "date") {
      catLine = head;
      seriesLines = numbersAfter(0);
      k = head.type === "text" ? "column" : "line";
    } else if (numeric.length >= 2) {
      k = "scatter";
      xLine = head;
      seriesLines = numbersAfter(0);
    } else {
      k = "line";
      seriesLines = numeric;
    }
  } else if (kind === "scatter") {
    k = kind;
    if (head.type !== "text" && lines.length >= 2) {
      xLine = head;
      seriesLines = numbersAfter(0);
    } else if (labelSeries) {
      // Points need x values: the labels can't be, the first number column after them can.
      xLine = labelSeries.x;
      seriesLines = labelSeries.ys;
    } else seriesLines = numeric;
  } else {
    k = kind;
    if (head.type !== "number" || (numeric.length >= 2 && ordered(head, 2, false))) {
      catLine = head;
      seriesLines = numbersAfter(0);
    } else seriesLines = numeric;
    if (k === "pie") seriesLines = seriesLines.slice(0, 1);
  }
  if (!seriesLines.length) return null;

  // Replicates with a mean and a standard deviation column ("Mittelwert", "Stabw"): chart the
  // means, with the standard deviations as their error bars, like a lab report does.
  const sdOf = new Map<HLine, HLine>();
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
      ...(joined ? { line: "straight" as const } : {}),
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
/**
 * Points in time as labels: days, weeks, months, years and times in German and English, also in
 * compounds (Messtag, Kalenderwoche, Uhrzeit), weekdays and months by name, months cut short
 * (Jan), quarters, and a number with h, min, s or d (2 h, 30 min). Weekdays cut short (Mo, Fr.,
 * Sat) only on their own, with a date or a clock time (Fr 12.03., Mo 08:00, Mo 8 Uhr, Mon 8 am):
 * with a plain number after them they are samples' names (Fr. 1 a fraction, So 1, Sa 1).
 */
const WHEN_RE =
  /(^|[^\p{L}])(\p{L}*(tag|tage|woche|wochen|monat|monate|jahr|jahre|datum|zeit|zeitpunkt|stunde|stunden|day|days|week|weeks|month|months|year|years|date|time|hour|hours)|kw|quartal|quarter|semester|q[1-4]|mittwoch|jan|januar|jänner|january|feb|februar|february|mär|märz|mrz|mar|march|apr|april|mai|may|jun|juni|june|jul|juli|july|aug|august|sep|sept|september|okt|oktober|oct|october|nov|november|dez|dezember|dec|december)([^\p{L}]|$)|\p{N}\s*(s|sek|min|h|d)([^\p{L}]|$)|^\s*(mo|di|mi|do|fr|sa|so|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\.?(,?\s*\d{1,2}[./]\d{1,2}[./]?(\d{2,4})?)?(,?\s*(\d{1,2}:\d{2}(\s*(uhr|am|pm))?|\d{1,2}\s*(uhr|am|pm)))?\s*$/iu;
/** A header that names a time: Zeit (also Uhrzeit, Inkubationszeit), t, Dauer, time, or a unit of time in brackets ("(min)", "[h]"). */
const TIME_HEAD_RE = /(^|[^\p{L}])(\p{L}*zeit|t|time|dauer|duration)([^\p{L}]|$)|[([]\s*(s|sek|sec|min|h|std|d|tage?|days?)\s*[)\]]/iu;
/** A sample's name: a number in it (S1, Std 2, 1:4, 10⁻², S₁) or a letter on its own (Probe A). */
const SAMPLE_RE = /\p{N}|(^|[^\p{L}])\p{L}([^\p{L}]|$)/u;
/** A concentration or a dilution by its name (c, β, Konz., Massenkonzentration, conc., Verdünnung, dilution, Proteingehalt) or by its unit (mg/L, µg/mL, mmol/L, ppm). */
const AMOUNT_RE = /(^|[^\p{L}])(c|β|ρ|\p{L}*konz\p{L}*|conc\p{L}*|verd(ü|ue)nn\p{L}*|dilutions?|\p{L}*gehalt)([^\p{L}]|$)|[µu]?[nmµk]?(g|mol)\s*\/\s*[mµdc]?l(?!\p{L})|ppm|ppb/iu;
/**
 * A header that names the concentrations or dilutions below it ("c (µg/mL)", "Konz.",
 * "Verdünnung"), not one that is a value itself ("0 mg/L": doses along a plate reader's header row).
 */
const namesAmount = (header: string) => AMOUNT_RE.test(header) && !/^\s*[-+−]?\d/.test(header);

/** The name of the smart table all areas lie in, unless it is an automatic one ("Tabelle1", "Table2"). */
function tableName(wb: Workbook, sheetId: string, areas: Area[]): string | null {
  const t = wb.tables.find((tb) => tb.sheetId === sheetId && areas.every((a) => a.r0 >= tb.area.r0 && a.r1 <= tb.area.r1 && a.c0 >= tb.area.c0 && a.c1 <= tb.area.c1));
  if (!t || /^(tabelle|table)\s*\d*$/i.test(t.name.trim())) return null;
  return t.name.trim() || null;
}
