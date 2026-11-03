// Excel's rules for function arguments: turning values into numbers, text and true/false, and
// collecting the numbers of ranges and direct arguments the way SUM, AVERAGE, COUNT… do.

import { textToNumber } from "../parse";
import { boolText, ERR, isErr, isMatrix, isRef, mkErr, numberToText, numResult, type CellError, type ErrorCode, type Matrix, type Scalar, type Value } from "../values";
import type { Ctx, FnDef } from "./types";

export { numResult };

/**
 * Errors that say why, for the cell's tooltip (explainError in src/sheet/engine/messages.ts). "@"
 * in a detail stands for the function; the call fills in its name, so RANG and RANG.GLEICH each
 * name themselves. Argument numbers count from 1.
 */
export const why = {
  /**
   * Fewer numbers than the function needs (#DIV/0!, or the code Excel gives, e.g. #NUM! for
   * MEDIAN): STABW.S of one replicate. `counts` says what counted when it isn't just numbers:
   * "a" for the A forms (text as 0), "pairs" for x and y in the same place (STEIGUNG, KORREL).
   */
  few: (need: number, have: number, code: ErrorCode = "#DIV/0!", counts?: "a" | "pairs"): CellError => mkErr(code, `few:@:${need}:${have}${counts ? `:${counts}` : ""}`),
  /** The same for each of two groups (T.TEST, F.TEST): `have` is the smaller group's count. */
  fewEach: (need: number, have: number): CellError => mkErr("#DIV/0!", `few:@:${need}:${have}:each`),
  /** All values the same where they must vary (#DIV/0!): KORREL or STEIGUNG of constant data. */
  same: (): CellError => mkErr("#DIV/0!", "same:@"),
  /** No cell meets the condition, so there is nothing to average (#DIV/0!). */
  noMatch: (): CellError => mkErr("#DIV/0!", "nomatch:@"),
  /**
   * Argument i is outside what the function allows (#NUM!, or the code Excel gives): "gt0" must
   * be > 0, "ge0" not negative, "ge1" / "ge2" at least 1 / 2, "p" between 0 and 1, "pos" only
   * numbers > 0, "num" only numbers (no empty cells or text), "opt" one of the options its help
   * lists, "range" between lo and hi.
   */
  arg: (i: number, rule: "gt0" | "ge0" | "ge1" | "ge2" | "p" | "pos" | "num" | "opt", code: ErrorCode = "#NUM!"): CellError => mkErr(code, `arg:@:${i}:${rule}`),
  range: (i: number, lo: number, hi: number): CellError => mkErr("#NUM!", `arg:@:${i}:range:${lo}:${hi}`),
  /** No value occurs more than once (#N/A from MODUS.EINF). */
  noRepeat: (): CellError => mkErr("#N/A", "norepeat:@"),
  /** Two ranges that must be the same size aren't (#N/A). */
  sizes: (): CellError => mkErr("#N/A", "sizes"),
};

/** A value as a number: empty 0, TRUE 1, "3" 3, "abc" #VALUE!. */
export function toNum(v: Scalar, ctx: Ctx): number | CellError {
  if (typeof v === "number") return v;
  if (v === null) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = textToNumber(v, ctx.locale);
    return n === null ? mkErr("#VALUE!", "not-a-number") : n;
  }
  return v;
}

/** A whole number (Excel truncates toward zero). */
export function toInt(v: Scalar, ctx: Ctx): number | CellError {
  const n = toNum(v, ctx);
  return typeof n === "number" ? Math.trunc(n) : n;
}

/** A value as text: numbers with up to 15 digits in the user's style, TRUE/WAHR. */
export function toStr(v: Scalar, ctx: Ctx): string | CellError {
  if (typeof v === "string") return v;
  if (v === null) return "";
  if (typeof v === "number") return numberToText(v, ctx.locale);
  if (typeof v === "boolean") return boolText(v, ctx.locale);
  return v;
}

/** A value as true/false: numbers ≠ 0 are TRUE; "TRUE"/"WAHR" text too; other text is #VALUE!. */
export function toBool(v: Scalar, ctx: Ctx): boolean | CellError {
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const up = v.trim().toUpperCase();
    if (up === "TRUE" || up === "WAHR") return true;
    if (up === "FALSE" || up === "FALSCH") return false;
    void ctx;
    return ERR.value;
  }
  return v;
}

/** A value or the top-left of an array (where one value is needed). */
export function first(v: Scalar | Matrix): Scalar {
  return isMatrix(v) ? (v[0]?.[0] ?? null) : v;
}

/** Any value as rows (one value = 1×1). */
export function asMatrix(v: Scalar | Matrix): Matrix {
  return isMatrix(v) ? v : [[v]];
}

/** Every value of an argument with whether it came from a range or array (true) or was written directly (false). */
export function eachValue(args: Value[], ctx: Ctx, f: (v: Scalar, inRange: boolean) => void | boolean): void {
  for (const a of args) {
    if (isRef(a) || isMatrix(a)) {
      const m = isRef(a) ? ctx.matrix(a) : a;
      for (const row of m) for (const v of row) if (f(v, true) === false) return;
    } else if (f(a, false) === false) return;
  }
}

/**
 * The numbers of SUM-like arguments. Ranges and arrays: numbers only (text, true/false and empty
 * cells are skipped). Written directly: TRUE = 1, "3" = 3, "abc" → #VALUE!, an empty argument = 0.
 * mode "a" (AVERAGEA…): in ranges text counts as 0 and TRUE as 1.
 */
export function collectNumbers(args: Value[], ctx: Ctx, mode: "plain" | "a" = "plain"): number[] | CellError {
  const out: number[] = [];
  let err: CellError | null = null;
  eachValue(args, ctx, (v, inRange) => {
    if (typeof v === "number") out.push(v);
    else if (isErr(v)) {
      err = v;
      return false;
    } else if (inRange) {
      if (mode === "a") {
        if (typeof v === "boolean") out.push(v ? 1 : 0);
        else if (typeof v === "string") out.push(0);
      }
    } else {
      const n = toNum(v, ctx);
      if (typeof n !== "number") {
        err = n;
        return false;
      }
      out.push(n);
    }
  });
  return err ?? out;
}

/** The numbers of one range-like argument for regression and paired statistics, keeping positions (non-numbers as NaN). */
export function numbersWithGaps(v: Value, ctx: Ctx): { values: number[]; rows: number; cols: number } | CellError {
  const m = isRef(v) ? ctx.matrix(v) : asMatrix(v as Scalar | Matrix);
  const values: number[] = [];
  for (const row of m) {
    for (const x of row) {
      if (isErr(x)) return x;
      values.push(typeof x === "number" ? x : NaN);
    }
  }
  return { values, rows: m.length, cols: m[0]?.length ?? 0 };
}

/** Pairs (x, y) where both are numbers, from two ranges of the same size (else #N/A). */
export function pairs(ys: Value, xs: Value, ctx: Ctx): { x: number[]; y: number[] } | CellError {
  const a = numbersWithGaps(ys, ctx);
  if (isErr(a)) return a;
  const b = numbersWithGaps(xs, ctx);
  if (isErr(b)) return b;
  if (a.values.length !== b.values.length) return ERR.na;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < a.values.length; i++) {
    if (Number.isNaN(a.values[i]) || Number.isNaN(b.values[i])) continue;
    y.push(a.values[i]);
    x.push(b.values[i]);
  }
  return { x, y };
}

export const sum = (xs: number[]) => {
  // Neumaier's summation: long columns of measurements add up without drifting.
  let s = 0;
  let c = 0;
  for (const x of xs) {
    const t = s + x;
    c += Math.abs(s) >= Math.abs(x) ? s - t + x : x - t + s;
    s = t;
  }
  return s + c;
};

export const mean = (xs: number[]) => sum(xs) / xs.length;

/** Sum of squared deviations from the mean (two passes, accurate). */
export function devSq(xs: number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s;
}

// ----------------------------------------------------------------------------------------------
// Small builders for the many one-number functions

/** A function of numbers (each lifted over arrays): ROUND, SQRT, LOG… */
export function numFn(name: string, min: number, max: number, f: (a: number[], ctx: Ctx) => number | CellError | Scalar): FnDef {
  return {
    name,
    min,
    max,
    args: "s",
    impl: (args, ctx) => {
      const nums: number[] = [];
      for (const a of args) {
        const n = toNum(a as Scalar, ctx);
        if (typeof n !== "number") return n;
        nums.push(n);
      }
      const r = f(nums, ctx);
      return typeof r === "number" ? numResult(r) : r;
    },
  };
}

// ----------------------------------------------------------------------------------------------
// Arrays meeting arrays (Excel's broadcasting): a 1×1 array or a value goes everywhere, a single
// row repeats down, a single column repeats across; where sizes don't match the result is #N/A.

export function broadcastShape(vals: (Scalar | Matrix)[]): { rows: number; cols: number } {
  let rows = 1;
  let cols = 1;
  for (const v of vals) {
    if (!isMatrix(v)) continue;
    rows = Math.max(rows, v.length);
    cols = Math.max(cols, v[0]?.length ?? 1);
  }
  return { rows, cols };
}

/** Element (i, j) of a value broadcast to a bigger shape. */
export function pick(v: Scalar | Matrix, i: number, j: number): Scalar {
  if (!isMatrix(v)) return v;
  const rows = v.length;
  const cols = v[0]?.length ?? 0;
  const ii = rows === 1 ? 0 : i;
  const jj = cols === 1 ? 0 : j;
  if (ii >= rows || jj >= cols) return ERR.na;
  return v[ii][jj];
}

export function broadcast(vals: (Scalar | Matrix)[], f: (xs: Scalar[]) => Scalar): Matrix {
  const { rows, cols } = broadcastShape(vals);
  const out: Matrix = [];
  const xs: Scalar[] = new Array(vals.length);
  for (let i = 0; i < rows; i++) {
    const line: Scalar[] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < vals.length; k++) xs[k] = pick(vals[k], i, j);
      line[j] = f(xs);
    }
    out.push(line);
  }
  return out;
}

/** A value with references turned into values (one cell → its value, more → rows). */
export function valueOf(v: Value, ctx: Ctx): Scalar | Matrix {
  return isRef(v) ? ctx.deref(v) : v;
}
