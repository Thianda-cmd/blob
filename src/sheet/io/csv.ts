// CSV files: import (the separator is detected: ";" from German Excel, "," or tab) and export
// (";" and decimal comma in German so Excel opens it right, "," in English).
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { Calc } from "../engine";
import type { Workbook } from "../types";

export function parseCsv(text: string): string[][] {
  void text;
  throw new Error("csv: parseCsv not implemented");
}

/** One sheet as CSV (values as shown, with a UTF-8 BOM so Excel reads umlauts). */
export function sheetToCsv(wb: Workbook, calc: Calc, sheetId: string, locale: Locale): string {
  void wb;
  void calc;
  void sheetId;
  void locale;
  throw new Error("csv: sheetToCsv not implemented");
}
