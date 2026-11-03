// A chart's data, read from the cells: points per series, names, categories, error bars and
// fitted trendlines. Shared by the chart in the editor, its export and the chart embedded in a note.
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { Calc } from "../engine";
import type { ChartSpec, SheetColor } from "../types";
import type { Fit, FitError } from "./regression";

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
};

export type ChartData = {
  /** Category labels (line, column, bar, area, pie), as shown in the cells. */
  categories: string[];
  series: ChartSeriesData[];
  /** Number formats of the source cells, so ticks look like the data ("0,25", "25 %"). */
  xDecimals: number | null;
  yDecimals: number | null;
};

/** Read a chart's data. Cells that aren't numbers are skipped (a gap in a line). */
export function chartData(spec: ChartSpec, calc: Calc, locale: Locale): ChartData {
  void spec;
  void calc;
  void locale;
  throw new Error("chart: chartData not implemented");
}
