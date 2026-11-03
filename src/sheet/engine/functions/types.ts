// What a spreadsheet function gets while it runs: its arguments and the context of the cell it
// is calculated for.

import type { Locale } from "@/i18n/config";
import type { Node } from "../parser";
import type { Matrix, Ref, Scalar, Value } from "../values";

export interface Ctx {
  readonly locale: Locale;
  /** The sheet (Calc index) and cell the formula is in; row/col are -1 outside a cell. */
  readonly sheet: number;
  readonly row: number;
  readonly col: number;
  /** TODAY() and NOW(). */
  now(): Date;
  /** One cell's value (formulas calculated); null when empty. */
  cell(sheet: number, row: number, col: number): Scalar;
  /** A reference's values: one value for a single cell, otherwise rows of values. Whole columns stop at the sheet's used rows. */
  deref(v: Value): Scalar | Matrix;
  /** The values of a reference as rows (whole columns clipped like deref). */
  matrix(ref: Ref): Matrix;
  /** A reference clipped to the part of the sheet that has cells (whole columns and rows). */
  clip(ref: Ref): Ref;
  /** A cell's formula (canonical), or undefined. */
  formula(sheet: number, row: number, col: number): string | undefined;
  /** Is a row hidden: by a smart table's filter, or by hand? */
  rowHidden(sheet: number, row: number): { filtered: boolean; manual: boolean };
  /** Evaluate an argument's tree (for functions that only evaluate what they need: IF, IFERROR…). */
  ev(node: Node): Value;
  /** Does the cell hold anything (value or formula)? */
  hasCell(sheet: number, row: number, col: number): boolean;
  /** Something remembered for the rest of this calculation (lookup indexes of a range). */
  memo<T>(key: string, make: () => T): T;
}

export type FnDef = {
  /** Canonical (English) name. */
  name: string;
  min: number;
  max: number;
  /**
   * How each argument is passed (the last letter repeats for the rest):
   * s = one value: arrays and ranges are "lifted" (the function runs once per element, like Excel 365);
   * v = a value or an array (references become values);
   * r = as written (references stay references, for SUM-like rules and ROW, SUBTOTAL…).
   */
  args: string;
  impl?: (args: Value[], ctx: Ctx) => Value;
  /** Functions that only evaluate the arguments they need (IF, IFERROR, CHOOSE…). */
  lazy?: (args: Node[], ctx: Ctx) => Value;
  /** Errors in "s" arguments are passed to the function instead of being its result right away (ISERROR…). */
  takesErrors?: boolean;
  /** Changes on every calculation (TODAY, NOW, RAND). */
  volatile?: boolean;
};
