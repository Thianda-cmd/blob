// Spreadsheets ("Tabellen", page kind "sheet"): the document stored in pages.content.
//
// A workbook holds sheets (tabs) of cells, charts that float on a sheet and smart tables
// ("intelligente Tabellen"). Everything is plain JSON, so saving, merging (src/sheet/collab.ts),
// exporting and embedding in notes all work on the same object. Rows and columns are 0-based
// everywhere in code; the UI shows them as 1… and A… (src/sheet/a1.ts).
//
// Never mutate a Workbook: every change makes a new object (src/sheet/ops.ts), sharing whatever
// didn't change. Undo keeps the old objects, saving compares them.

/** A spreadsheet page's content (pages.content of kind "sheet"). */
export type Workbook = {
  v: 1;
  /** In tab order; always at least one. */
  sheets: Sheet[];
  /** Charts, each floating on one sheet. */
  charts: ChartSpec[];
  /** Smart tables, each a range on one sheet with a header row. */
  tables: TableSpec[];
};

export type Sheet = {
  /** Stable id (survives renames); charts and tables point at sheets by id. */
  id: string;
  /** Unique in the workbook (compared without case); formulas use it: 'Blatt 2'!A1. */
  name: string;
  /** Cells by cellKey(row, col) = "row,col". Only cells with a value, formula, style or note. */
  cells: Record<string, Cell>;
  /** Column width (px) and hidden flag by column index ("0", "1"…). */
  cols: Record<string, { w?: number; hidden?: boolean }>;
  /** Row height (px) and hidden flag by row index. */
  rows: Record<string, { h?: number; hidden?: boolean }>;
  /** Frozen top rows and left columns (0 = none). */
  freeze: { rows: number; cols: number };
  /** How many rows and columns the grid shows; it grows when you type, paste or fill beyond it. */
  size: { rows: number; cols: number };
  /**
   * The sheet's latest changes of rows and columns (inserted, deleted, sorted, moved), oldest
   * first. Merging lines two people's versions up with it before comparing cells, so an edit made
   * in row 7 lands in row 8 when the other person inserted a row above it (src/sheet/sheetLog.ts,
   * src/sheet/collab.ts). Missing in older content: nothing recorded.
   */
  log?: SheetOp[];
  /**
   * On the copy merging makes when two people's versions of a sheet can't be combined (the second
   * one's version, next to the sheet; src/sheet/collab.ts): the id of that sheet. The other person
   * is told when it arrives in their editor. Missing on every other sheet (and in older content).
   */
  copyOf?: string;
};

/**
 * One change of a sheet's rows or columns, as kept in Sheet.log. `id` is random; `inv` is set on
 * an undo or redo and names the entry it takes back.
 */
export type SheetOp = { id: string; inv?: string } & (
  | { kind: "insertRows" | "deleteRows" | "insertCols" | "deleteCols"; at: number; count: number }
  /** Rows r0… of columns c0…c1 in a new order: row r0 + i holds what was in row r0 + order[i]. */
  | { kind: "sort"; r0: number; c0: number; c1: number; order: number[] }
  /** Cut and paste: the block `from` of sheet `src` moved to `to` on sheet `dst` (the same sheet or another; kept in both logs). */
  | { kind: "move"; src: string; from: Area; dst: string; to: Pos }
  /** A change that can't be repeated on another version: the entries before it were dropped, or what it was couldn't be read. */
  | { kind: "barrier" }
);

export const DEFAULT_COL_W = 100;
export const DEFAULT_ROW_H = 28;
export const DEFAULT_SIZE = { rows: 200, cols: 26 } as const;
/** Hard limits, so one page stays a reasonable size to save and calculate. */
export const MAX_ROWS = 20000;
export const MAX_COLS = 200;

export type Cell = {
  /**
   * What was typed, when it isn't a formula: a number, text or true/false. Dates and times are
   * numbers (serial days since 1899-12-30, like Excel) with a date or time format.
   */
  v?: number | string | boolean;
  /**
   * A formula without the leading "=", in canonical form: English function names, "," between
   * arguments, "." as decimal point, A1 references, sheet names quoted when needed ('Blatt 2'!A1).
   * The editor shows it in the user's language (src/sheet/engine: toLocalFormula).
   */
  f?: string;
  /** Look and number format. */
  s?: CellStyle;
  /** A comment ("Notiz") shown when you point at or tap the cell. */
  note?: string;
};

/** Colours are names, not hex, so they look right in light and dark mode (palette: src/sheet/colors.ts). */
export type SheetColor = "gray" | "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink" | "brown";

export type BorderLine = "thin" | "thick" | "double" | "dashed";

export type CellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Text colour (default: ink). */
  color?: SheetColor;
  /** Background (a light tint of the colour). */
  fill?: SheetColor;
  /** Default: numbers right, text left, true/false and errors centred. */
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  /** Long text wraps inside the cell (and the row grows). */
  wrap?: boolean;
  /** Font size in px (default 13). */
  size?: number;
  fmt?: NumberFormat;
  border?: { top?: BorderLine; right?: BorderLine; bottom?: BorderLine; left?: BorderLine };
};

/**
 * How a number is shown. The value itself never changes (12.5 stays 12.5); `unit` is shown after
 * the number ("12,5 mg/L"), handy for lab values.
 */
export type NumberFormat =
  | { kind: "general" }
  | { kind: "number"; decimals: number; group?: boolean; unit?: string }
  | { kind: "percent"; decimals: number }
  /** 1,23E-05 */
  | { kind: "scientific"; decimals: number; unit?: string }
  /** Significant figures (signifikante Stellen), e.g. 3 → 0,00123 / 12,3 / 1230. */
  | { kind: "significant"; digits: number; unit?: string }
  | { kind: "currency"; decimals: number; symbol: "€" | "$" | "£" | "CHF" }
  /** short: 01.11.2026 (de) / 11/1/2026 (en); long: 1. November 2026; iso: 2026-11-01 */
  | { kind: "date"; style: "short" | "long" | "iso" }
  /**
   * `duration`: the hours go on past 24 ([h]:mm), 36:00 instead of the clock time 12:00 (typed
   * 24:00 or more, or chosen as "Dauer").
   */
  | { kind: "time"; seconds: boolean; duration?: boolean }
  | { kind: "datetime" }
  /** Keep what was typed as text, never a number ("007", phone numbers). */
  | { kind: "text" };

/** A rectangle of cells, inclusive and normalised (r0 ≤ r1, c0 ≤ c1). */
export type Area = { r0: number; c0: number; r1: number; c1: number };
/** An area on a sheet, by sheet id (charts and tables use this: it survives renames). */
export type RangeRef = Area & { sheetId: string };
export type Pos = { row: number; col: number };

// ----------------------------------------------------------------------------------------------
// Charts

export type ChartKind = "scatter" | "line" | "column" | "bar" | "area" | "pie";

export type ChartSpec = {
  id: string;
  /** The sheet it floats on. */
  sheetId: string;
  /** Top-left corner: a cell plus an offset in px inside it, so the chart moves with inserted rows. */
  at: { row: number; col: number; dx: number; dy: number };
  /** Size in px. */
  size: { w: number; h: number };
  kind: ChartKind;
  title: string;
  /**
   * Scatter: the x values shared by all series (a series may have its own). Line, column, bar,
   * area, pie: the category labels. null: 1, 2, 3…
   */
  x: RangeRef | null;
  series: SeriesSpec[];
  xAxis: AxisSpec;
  yAxis: AxisSpec;
  legend: "top" | "right" | "bottom" | "none";
};

export type SeriesSpec = {
  id: string;
  /** Legend name typed by hand; used when nameRef is null. */
  name: string;
  /** Legend name from a cell (usually the column's header), so it follows edits. */
  nameRef: RangeRef | null;
  /** The values (one column or one row). */
  y: RangeRef;
  /** Scatter only: this series' own x values; null = the chart's x. */
  x: RangeRef | null;
  /** null = the next colour of the palette. */
  color: SheetColor | null;
  marker: "circle" | "square" | "triangle" | "diamond" | "none";
  line: "none" | "straight" | "smooth";
  /** Show each value next to its point. */
  labels: boolean;
  errorBars: ErrorBarSpec | null;
  trendline: TrendlineSpec | null;
};

/** Like Excel's trendlines (Trendlinie), with the same formulas and R² (src/sheet/chart/regression.ts). */
export type TrendlineSpec = {
  type: "linear" | "polynomial" | "exponential" | "logarithmic" | "power" | "movingAverage";
  /** Polynomial: order 2–6. */
  order: number;
  /** Moving average: period 2+. */
  period: number;
  /** Fixed y at x = 0 ("Schnittpunkt festlegen"; linear, polynomial, exponential); null = fitted. */
  intercept: number | null;
  showEquation: boolean;
  showR2: boolean;
  /**
   * Also write where the trendline crosses y = 0 ("Nullstelle") on the chart, under the equation
   * and R². Missing (older workbooks, .xlsx files, which have no such label): off.
   */
  showZero?: boolean;
  /** Extend the line beyond the data, in x units (forward = to the right). */
  forward: number;
  backward: number;
  /** Legend name; "" = automatic ("Linear (Extinktion)"). */
  name: string;
};

export type ErrorBarSpec = {
  /** fixed: ± value; percent: ± value % of each point; stdev: value × SD of the series; stderr: SE of the series; custom: amounts from cells. */
  kind: "fixed" | "percent" | "stdev" | "stderr" | "custom";
  value: number;
  /** custom: the + and − amounts, one per point (often a column of standard deviations). */
  plus: RangeRef | null;
  minus: RangeRef | null;
  direction: "both" | "plus" | "minus";
};

export type AxisSpec = {
  title: string;
  /** null = automatic. Ignored for category axes. */
  min: number | null;
  max: number | null;
  /** Logarithmic (base 10), e.g. a growth curve. */
  log: boolean;
  grid: boolean;
  /** Decimals of the tick labels; null = automatic. */
  decimals: number | null;
};

// ----------------------------------------------------------------------------------------------
// Smart tables

/** The function of a column in the totals row (written as SUBTOTAL into the cell, so it ignores filtered rows). */
export type TotalFn = "none" | "sum" | "average" | "count" | "countNumbers" | "min" | "max" | "stdev" | "var";
export type TableStyle = "purple" | "blue" | "green" | "orange" | "teal" | "gray";

export type FilterSpec =
  /** Only rows whose shown text is one of these ("" = empty cells). */
  | { kind: "values"; values: string[] }
  | { kind: "number"; op: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between" | "top" | "bottom" | "aboveAverage" | "belowAverage"; a: number | null; b: number | null }
  | { kind: "text"; op: "contains" | "notContains" | "begins" | "ends" | "equals"; text: string };

export type TableColumn = { id: string; total: TotalFn };

export type TableSpec = {
  id: string;
  sheetId: string;
  /** Unique in the workbook ("Tabelle1", "Kalibrierung"). */
  name: string;
  /** The whole table: header row, data rows and (with `totals`) the totals row as its last row. */
  area: Area;
  /** One per column of `area`, in order. Column names are the header cells' text. */
  columns: TableColumn[];
  totals: boolean;
  style: TableStyle;
  /** Alternate row shading. */
  banded: boolean;
  /** Active filters by column id; filtered rows are hidden (not deleted). */
  filters: Record<string, FilterSpec>;
  /** The last sort, shown as an arrow in that column's header. */
  sort: { column: string; dir: "asc" | "desc" } | null;
};
