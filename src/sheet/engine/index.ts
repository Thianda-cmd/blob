// The formula engine: the public API every other part of the spreadsheet uses.
//
// CONTRACT: other modules are written against these exports. Keep every name and signature here;
// add new exports if you need them. Implementations live in the files next to this one:
//   values.ts     values, errors and Excel's comparison rules
//   lexer.ts      formula text → tokens (canonical, German, English; tolerant of unfinished input)
//   parser.ts     tokens → tree with Excel's precedence; cached per formula text
//   translate.ts  canonical ⇄ local formulas, tokens for the editor
//   refs.ts       moving references: copy/fill (shift) and structural changes (adjust)
//   calc.ts       evaluating a workbook (lazy, memoised, no deep recursion, cycles → #CIRC!)
//   functions/    every function of names.ts, by category
//   criteria.ts   ">5", "<>x", "Probe*" for …IF(S)
//   parse.ts      typed values ("1,5", "50 %", "1.11.2026", "14:30") → numbers
//   format.ts     numbers → text (cell formats and TEXT format codes)
//   input.ts      typing into a cell, editing it again, default alignment
//   dates.ts      serial dates (days since 1899-12-30) and names of months and days
//   messages.ts   why a formula doesn't parse, what an error means — in German and English
//   series.ts     what the fill handle continues (numbers, dates, "Probe 1", Montag, Jan…)
//
// Formulas are stored canonically (English names, "," separators, "." decimals, no "=") and shown
// in the user's language (German: SUMME, ";" separators, "," decimals). Values follow Excel:
// numbers (dates are serial days since 1899-12-30), text, true/false, empty (null) and errors.

import type { Locale } from "@/i18n/config";
import type { Area, Cell, NumberFormat, Pos, RangeRef, Workbook } from "../types";
import { createCalcImpl } from "./calc";
import { formatValue as formatValueImpl } from "./format";
import { defaultAlign as defaultAlignImpl, editText as editTextImpl, parseInput as parseInputImpl } from "./input";
import { explainError as explainErrorImpl, parseErrorMessage, suggestFunction as suggestFunctionImpl } from "./messages";
import { adjustFormula as adjustFormulaImpl, adjustMovedFormula as adjustMovedFormulaImpl, shiftFormula as shiftFormulaImpl } from "./refs";
import { formulaRefs as formulaRefsImpl, toCanonicalFormula as toCanonicalImpl, tokenizeFormula as tokenizeImpl, toLocalFormula as toLocalImpl } from "./translate";
import { errorText as errorTextImpl, type CellError, type CellValue, type ErrorCode } from "./values";

export { FUNCTION_NAMES, FUNCTION_BY_DE, FUNCTION_BY_EN, type FunctionCategory, type FunctionName } from "./names";

// ----------------------------------------------------------------------------------------------
// Values

/** Excel's errors plus #CIRC! (a circular reference; Excel shows 0 with a warning, we show the error). */
export type { ErrorCode, CellError, CellValue } from "./values";

export { isError } from "./values";

/** The error code as shown in each language (#WERT!, #BEZUG!, #NV, #ZAHL!, #ZIRKEL!…). */
export function errorText(code: ErrorCode, locale: Locale): string {
  return errorTextImpl(code, locale);
}

/**
 * What an error value means, in one or two plain sentences of the user's language (the tooltip
 * of a cell showing #WERT!, #BEZUG!, #NV…). Uses `detail` when it says more ("not-found",
 * "unknown-function:SUMM", "sheet-missing:Blatt 3").
 */
export function explainError(err: CellError, locale: Locale): string {
  return explainErrorImpl(err, locale);
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
  /**
   * The user's language, for the few things inside formulas that depend on it, like Excel:
   * TEXT(x; "0,00") format codes, numbers joined into text ("Wert: " & 1,5 → "Wert: 1,5"), text
   * read as a number ("1,5" + 1). Default: German.
   */
  locale?: Locale;
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
  return createCalcImpl(wb, opts);
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
 *
 * Beyond Excel, kinder to lab work: "12,5 mg/L", "37 °C", "100 µl" (a known lab unit after the
 * number) become numbers shown with that unit; German "1.5" stays the number 1,5 (only "1.5." or
 * "1.5.2026" is a date — Excel would silently make 1 May). Like Excel: a number typed into a
 * percent cell means percent (50 → 50 %), "+A1*2" is a formula, =HEUTE()/=DATUM(…) get a date
 * format, =JETZT() date and time, =ZEIT(…) a time.
 */
export function parseInput(text: string, locale: Locale, current?: Cell): ParsedInput {
  return parseInputImpl(text, locale, current);
}

/** What the editor shows when you edit a cell: "=SUMME(A1:A3)" in German, "1,5" for 1.5, a date as typed. */
export function editText(cell: Cell | undefined, locale: Locale): string {
  return editTextImpl(cell, locale);
}

/** The text a cell shows for a value with its format (no format: "general", like Excel). */
export function formatValue(value: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  return formatValueImpl(value, fmt, locale);
}

/** Default alignment of a value: numbers right, text left, booleans and errors centred. */
export function defaultAlign(value: CellValue): "left" | "center" | "right" {
  return defaultAlignImpl(value);
}

// ----------------------------------------------------------------------------------------------
// Formulas as text

/** Canonical → the user's language (without "="): "SUM(A1,1.5)" → "SUMME(A1;1,5)". */
export function toLocalFormula(canonical: string, locale: Locale): string {
  return toLocalImpl(canonical, locale);
}

/**
 * The user's language → canonical (without "="). Accepts English names in German too (SUM and
 * SUMME both work), any case, and ";" or "," as separator where unambiguous. Returns where and why
 * when it doesn't parse, in plain words of the user's language.
 */
export function toCanonicalFormula(local: string, locale: Locale): { formula: string } | { error: string; at: number } {
  return toCanonicalImpl(local, locale);
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
  return tokenizeImpl(local, locale);
}

/** References in a canonical formula (for showing precedents, charts from formulas…). */
export function formulaRefs(canonical: string): FormulaRef[] {
  return formulaRefsImpl(canonical);
}

/**
 * Copying or filling a formula: relative references move by (rows, cols), absolute ($A$1) parts
 * stay. A reference pushed off the sheet becomes #REF!.
 */
export function shiftFormula(canonical: string, rows: number, cols: number): string {
  return shiftFormulaImpl(canonical, rows, cols);
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
 * (`host` and the sheets in `change` are sheet names, compared without case, as formulas use names.)
 */
export function adjustFormula(canonical: string, host: string, change: StructuralChange): string {
  return adjustFormulaImpl(canonical, host, change);
}

/**
 * A formula that is itself moved by cut and paste from sheet `host` to sheet `newHost`: references
 * to the moved cells follow them, the others keep pointing where they did (naming the old sheet
 * when the formula lands on another one).
 */
export function adjustMovedFormula(canonical: string, host: string, newHost: string, change: StructuralChange): string {
  return adjustMovedFormulaImpl(canonical, host, newHost, change);
}

// ----------------------------------------------------------------------------------------------
// Extras for the editor

/** The closest function name to a mistyped one in the user's language ("SUMM" → "SUMME"), or null. */
export function suggestFunction(typed: string, locale: Locale): string | null {
  return suggestFunctionImpl(typed, locale);
}

/** For .xlsx files: newer functions need Excel's "_xlfn." prefix on the way out, and lose it on the way in. */
export { toFileFormula, fromFileFormula } from "./translate";

export { parseErrorMessage };
export { formatWithCode } from "./format";
export { normalizeRef, refText, adjustArea, transposeFormula } from "./refs";
export { getFunction, missingFunctions } from "./functions";
export { serialFromYMD, ymdFromSerial } from "./dates";
