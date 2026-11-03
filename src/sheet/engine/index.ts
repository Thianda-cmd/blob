// The formula engine: the public API every other part of the spreadsheet uses.
//
// CONTRACT: other modules are written against these exports. Keep every name and signature here;
// add new exports if you need them. Implementations live in the files next to this one.
//
// Formulas are stored canonically (English names, "," separators, "." decimals, no "=") and shown
// in the user's language (German: SUMME, ";" separators, "," decimals). Values follow Excel:
// numbers (dates are serial days since 1899-12-30), text, true/false, empty (null) and errors.

import type { Locale } from "@/i18n/config";
import type { Area, Cell, NumberFormat, Pos, RangeRef, Workbook } from "../types";

export { FUNCTION_NAMES, FUNCTION_BY_DE, FUNCTION_BY_EN, type FunctionCategory, type FunctionName } from "./names";

// ----------------------------------------------------------------------------------------------
// Values

/** Excel's errors plus #CIRC! (a circular reference; Excel shows 0 with a warning, we show the error). */
export type ErrorCode = "#DIV/0!" | "#N/A" | "#NAME?" | "#NULL!" | "#NUM!" | "#REF!" | "#VALUE!" | "#CALC!" | "#CIRC!";

/** An error value; `detail` explains it in plain English (a key for the tooltip, e.g. "unknown-function:SUMM"). */
export type CellError = { error: ErrorCode; detail?: string };

/** A computed value. null = empty. */
export type CellValue = number | string | boolean | null | CellError;

export const isError = (v: unknown): v is CellError => typeof v === "object" && v !== null && "error" in v;

/** The error code as shown in each language (#WERT!, #BEZUG!, #NV, #ZAHL!, #ZIRKEL!…). */
export function errorText(code: ErrorCode, locale: Locale): string {
  void code;
  void locale;
  throw new Error("engine: errorText not implemented");
}

// ----------------------------------------------------------------------------------------------
// Calculating

export type CalcOptions = {
  /** The clock for TODAY()/NOW() (tests pass a fixed date). */
  now?: () => Date;
  /** Rows hidden by a smart table's filter or by hand: SUBTOTAL(1xx, …) skips them, 1–11 skip filtered rows. */
  isRowHidden?: (sheetId: string, row: number) => boolean;
  /**
   * The calculation before this change and the cells that changed, so unchanged results can be kept.
   * Only a hint: ignoring it must still give correct results.
   */
  previous?: Calc;
  changed?: { sheetId: string; row: number; col: number }[];
};

/**
 * The values of one workbook. Formulas are evaluated on demand and remembered; a new workbook
 * (any edit) needs a new Calc. Must handle long chains (A2 = A1 + 1 … A10000) without
 * running out of stack, and circular references (→ #CIRC!) without hanging.
 */
export interface Calc {
  readonly workbook: Workbook;
  /** A cell's value (formulas evaluated); null when empty. Outside the sheet: null. */
  value(sheetId: string, row: number, col: number): CellValue;
  /** The values of an area, row by row. */
  values(ref: RangeRef): CellValue[][];
  /**
   * Evaluate a formula (canonical, without "=") as if it were in cell `at`, e.g. the formula
   * bar's live preview. An array result gives its top-left value.
   */
  evaluate(formula: string, at: { sheetId: string; row: number; col: number }): CellValue;
}

export function createCalc(wb: Workbook, opts?: CalcOptions): Calc {
  void wb;
  void opts;
  throw new Error("engine: createCalc not implemented");
}

// ----------------------------------------------------------------------------------------------
// Typing into a cell, and showing values

export type ParsedInput = {
  /** What to store: a value, a formula, or neither (empty input clears the value). */
  cell: Pick<Cell, "v" | "f">;
  /** A format the input implies, applied when the cell has none yet: "50 %" → percent, "1.11.2026" → date, "1,5E-3" → scientific. */
  fmt?: NumberFormat;
  /** The formula didn't parse: where and why (the editor stays open and shows it). */
  error?: { message: string; at: number };
};

/**
 * Text typed into a cell → what to store. "=…" is a formula (canonicalised); "'…" is always text;
 * numbers in the locale's format ("1,5" in German, "1.5" in English; "1.234,5" with thousands),
 * percentages, dates ("1.11.2026", "2026-11-01", "11/1/2026" in English), times ("14:30"),
 * TRUE/FALSE (WAHR/FALSCH in German). A cell formatted as text keeps everything as text.
 */
export function parseInput(text: string, locale: Locale, current?: Cell): ParsedInput {
  void text;
  void locale;
  void current;
  throw new Error("engine: parseInput not implemented");
}

/** What the editor shows when you edit a cell: "=SUMME(A1:A3)" in German, "1,5" for 1.5, a date as typed. */
export function editText(cell: Cell | undefined, locale: Locale): string {
  void cell;
  void locale;
  throw new Error("engine: editText not implemented");
}

/** The text a cell shows for a value with its format (no format: "general", like Excel). */
export function formatValue(value: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  void value;
  void fmt;
  void locale;
  throw new Error("engine: formatValue not implemented");
}

/** Default alignment of a value: numbers right, text left, booleans and errors centred. */
export function defaultAlign(value: CellValue): "left" | "center" | "right" {
  void value;
  throw new Error("engine: defaultAlign not implemented");
}

// ----------------------------------------------------------------------------------------------
// Formulas as text

/** Canonical → the user's language (without "="): "SUM(A1,1.5)" → "SUMME(A1;1,5)". */
export function toLocalFormula(canonical: string, locale: Locale): string {
  void canonical;
  void locale;
  throw new Error("engine: toLocalFormula not implemented");
}

/**
 * The user's language → canonical (without "="). Accepts English names in German too (SUM and
 * SUMME both work), any case, and ";" or "," as separator where unambiguous. Returns where and why
 * when it doesn't parse, in plain words of the user's language.
 */
export function toCanonicalFormula(local: string, locale: Locale): { formula: string } | { error: string; at: number } {
  void local;
  void locale;
  throw new Error("engine: toCanonicalFormula not implemented");
}

/** A reference written in a formula, resolved to an area. */
export type FormulaRef = {
  /** Sheet name as written, or null for the formula's own sheet. */
  sheet: string | null;
  area: Area;
  /** Whole columns (A:A) or whole rows (1:1). */
  whole?: "cols" | "rows";
};

export type FormulaToken = {
  kind: "number" | "string" | "bool" | "error" | "ref" | "function" | "name" | "operator" | "paren" | "separator" | "space" | "unknown";
  text: string;
  /** Position in the text given to tokenizeFormula. */
  start: number;
  end: number;
  /** ref: the cell or area it points at. */
  ref?: FormulaRef;
  /** function: its canonical (English) name, when known. */
  fn?: string;
};

/**
 * Tokens of a formula as the user is typing it (localised, without "=", may be unfinished:
 * "SUMME(A1:A" must still tokenize). For colouring references, autocomplete and argument hints.
 */
export function tokenizeFormula(local: string, locale: Locale): FormulaToken[] {
  void local;
  void locale;
  throw new Error("engine: tokenizeFormula not implemented");
}

/** References in a canonical formula (for showing precedents, charts from formulas…). */
export function formulaRefs(canonical: string): FormulaRef[] {
  void canonical;
  throw new Error("engine: formulaRefs not implemented");
}

/**
 * Copying or filling a formula: relative references move by (rows, cols), absolute ($A$1) parts
 * stay. A reference pushed off the sheet becomes #REF!.
 */
export function shiftFormula(canonical: string, rows: number, cols: number): string {
  void canonical;
  void rows;
  void cols;
  throw new Error("engine: shiftFormula not implemented");
}

/** A change to the workbook's structure that formulas must follow. */
export type StructuralChange =
  | { kind: "insertRows" | "deleteRows" | "insertCols" | "deleteCols"; sheet: string; at: number; count: number }
  | { kind: "renameSheet"; from: string; to: string }
  | { kind: "deleteSheet"; sheet: string }
  /** Cut and paste: references to the moved cells follow them. */
  | { kind: "move"; sheet: string; from: Area; toSheet: string; to: Pos };

/**
 * Rewrite a formula that sits on sheet `host` after a structural change: A5 → A6 after a row is
 * inserted above, references into deleted rows → #REF!, ranges grow and shrink like in Excel,
 * renamed sheets are renamed in references.
 */
export function adjustFormula(canonical: string, host: string, change: StructuralChange): string {
  void canonical;
  void host;
  void change;
  throw new Error("engine: adjustFormula not implemented");
}
