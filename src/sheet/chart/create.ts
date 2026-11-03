// A sensible chart from selected cells, like Excel's "Empfohlene Diagramme":
// two or more number columns → scatter (first column x, the others y, header cells as names);
// a text column first → column chart with categories; one number column → line over 1, 2, 3….
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { Calc } from "../engine";
import type { Area, ChartKind, ChartSpec, Workbook } from "../types";

/** A new chart for the areas (Ctrl-selected areas count as more columns), placed right of the data; null when nothing to chart. */
export function chartFromAreas(wb: Workbook, calc: Calc, sheetId: string, areas: Area[], locale: Locale, kind?: ChartKind): ChartSpec | null {
  void wb;
  void calc;
  void sheetId;
  void areas;
  void locale;
  void kind;
  throw new Error("chart: chartFromAreas not implemented");
}
