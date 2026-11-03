// Excel files (.xlsx): export a workbook (values, formulas, number formats, bold/italic, fills,
// column widths, frozen panes, every sheet) and import one (the same, as far as Blob supports it).
// Written without libraries: an .xlsx is a zip of XML files.
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { Calc } from "../engine";
import type { Workbook } from "../types";

export function exportXlsx(wb: Workbook, calc: Calc, locale: Locale): Promise<Blob> {
  void wb;
  void calc;
  void locale;
  throw new Error("xlsx: exportXlsx not implemented");
}

/** What couldn't be brought over is listed in `skipped` ("3 merged cells", "1 chart"). */
export function importXlsx(data: ArrayBuffer, locale: Locale): Promise<{ workbook: Workbook; skipped: string[] }> {
  void data;
  void locale;
  throw new Error("xlsx: importXlsx not implemented");
}
