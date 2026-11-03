// Helpers for typing formulas, shared by the in-cell editor (grid) and the formula bar, so both
// behave the same: clicking a cell inserts its reference, functions are suggested, the argument
// you are in is named, and every reference gets a colour (the same frame colour on the grid).
//
// CONTRACT: used by the grid's cell editor and the formula bar. Keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { FormulaToken, FunctionName } from "@/sheet/engine";
import type { SheetColor } from "@/sheet/types";

const todo = (name: string): never => {
  throw new Error(`formulaInput: ${name} not implemented`);
};

/**
 * Is the caret at a spot where clicking (or arrow-keying to) a cell should insert its reference?
 * True right after "=", "(", the argument separator or an operator, or while the reference just
 * inserted is still under the caret (then a new click replaces it).
 */
export function wantsRef(text: string, caret: number, locale: Locale): boolean {
  void text;
  void caret;
  void locale;
  return todo("wantsRef");
}

/** Insert `ref` ("B3", "B3:B9", "'Blatt 2'!A1") at the caret, replacing a reference that ends there. */
export function insertRef(text: string, caret: number, ref: string, locale: Locale): { text: string; caret: number } {
  void text;
  void caret;
  void ref;
  void locale;
  return todo("insertRef");
}

/** Functions matching the word before the caret (German and English names), best first. */
export function suggestFunctions(text: string, caret: number, locale: Locale): { start: number; end: number; items: FunctionName[] } | null {
  void text;
  void caret;
  void locale;
  return todo("suggestFunctions");
}

/** Accept a suggestion: the name and an opening parenthesis replace the word; caret inside. */
export function applySuggestion(text: string, s: { start: number; end: number }, name: string): { text: string; caret: number } {
  void text;
  void s;
  void name;
  return todo("applySuggestion");
}

/** The function call around the caret and which argument (0-based) it is in, for the hint. */
export function argumentAt(text: string, caret: number, locale: Locale): { fn: string; index: number } | null {
  void text;
  void caret;
  void locale;
  return todo("argumentAt");
}

/** A colour per distinct reference, in order of appearance (the same reference keeps its colour). */
export function refColors(tokens: FormulaToken[]): Map<FormulaToken, SheetColor> {
  void tokens;
  return todo("refColors");
}
