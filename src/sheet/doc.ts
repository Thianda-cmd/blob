// A spreadsheet page's stored content: making new ones, reading stored JSON safely, and the text
// and preview other parts of Blob need (search, tiles, public pages).
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { Calc } from "./engine";
import type { Workbook } from "./types";

/** An empty workbook with one sheet ("Blatt 1" / "Sheet 1"). */
export function newWorkbook(locale: Locale): Workbook {
  void locale;
  throw new Error("doc: newWorkbook not implemented");
}

/**
 * Stored JSON → a valid Workbook. Never throws: anything malformed is repaired or dropped (bad
 * cells, unknown keys, charts and tables pointing at missing sheets, out-of-range sizes), and
 * empty or foreign content gives a new workbook.
 */
export function normalizeWorkbook(raw: unknown, locale: Locale): Workbook {
  void raw;
  void locale;
  throw new Error("doc: normalizeWorkbook not implemented");
}

/** Is it still the untouched new workbook (one empty sheet, no charts or tables)? */
export function isBlankWorkbook(wb: Workbook): boolean {
  void wb;
  throw new Error("doc: isBlankWorkbook not implemented");
}

/** Words of the workbook for search (pages.plain_text): sheet names, text cells, table and chart titles. */
export function workbookPlainText(wb: Workbook, calc: Calc, locale: Locale): string {
  void wb;
  void calc;
  void locale;
  throw new Error("doc: workbookPlainText not implemented");
}

/** A small preview for tiles and cards: the first rows and columns of the first sheet, as shown. */
export type SheetPreview = { rows: string[][]; charts: number; tables: number };

export function workbookPreview(wb: Workbook, calc: Calc, locale: Locale): SheetPreview {
  void wb;
  void calc;
  void locale;
  throw new Error("doc: workbookPreview not implemented");
}
