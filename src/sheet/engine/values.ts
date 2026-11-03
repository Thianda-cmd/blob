// Values of the formula engine: what a cell holds after calculating (numbers, text, true/false,
// empty, errors), the references and arrays formulas pass around while they are evaluated, and
// Excel's rules for turning one kind into another ("3" + 1 = 4, TRUE + 1 = 2, "abc" + 1 = #VALUE!).

import type { Locale } from "@/i18n/config";

/** Excel's errors plus #CIRC! (a circular reference; Excel shows 0 with a warning, we show the error). */
export type ErrorCode = "#DIV/0!" | "#N/A" | "#NAME?" | "#NULL!" | "#NUM!" | "#REF!" | "#VALUE!" | "#CALC!" | "#CIRC!";

/** An error value; `detail` explains it in plain English (a key for the tooltip, e.g. "unknown-function:SUMM"). */
export type CellError = { error: ErrorCode; detail?: string };

/** A computed value. null = empty. */
export type CellValue = number | string | boolean | null | CellError;

export const isError = (v: unknown): v is CellError => typeof v === "object" && v !== null && "error" in v;

export const ERROR_CODES: ErrorCode[] = ["#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!", "#CALC!", "#CIRC!"];

const ERROR_DE: Record<ErrorCode, string> = {
  "#DIV/0!": "#DIV/0!",
  "#N/A": "#NV",
  "#NAME?": "#NAME?",
  "#NULL!": "#NULL!",
  "#NUM!": "#ZAHL!",
  "#REF!": "#BEZUG!",
  "#VALUE!": "#WERT!",
  "#CALC!": "#KALK!",
  "#CIRC!": "#ZIRKEL!",
};

/** The error code as shown in each language (#WERT!, #BEZUG!, #NV, #ZAHL!, #ZIRKEL!…). */
export function errorText(code: ErrorCode, locale: Locale): string {
  return locale === "de" ? ERROR_DE[code] : code;
}

/** "#WERT!" or "#VALUE!" (any case) → the code; null when it isn't one. German texts only with `german`. */
export function errorFromText(text: string, german: boolean): ErrorCode | null {
  const up = text.toUpperCase();
  for (const code of ERROR_CODES) {
    if (code === up) return code;
    if (german && ERROR_DE[code] === up) return code;
  }
  return null;
}

/** Every error spelling a formula may contain, longest first (so "#NULL!" wins over "#NU…"). */
export function errorSpellings(german: boolean): { text: string; code: ErrorCode }[] {
  const out: { text: string; code: ErrorCode }[] = ERROR_CODES.map((code) => ({ text: code, code }));
  if (german) for (const code of ERROR_CODES) if (ERROR_DE[code] !== code) out.push({ text: ERROR_DE[code], code });
  return out.sort((a, b) => b.text.length - a.text.length);
}

const frozen = (error: ErrorCode, detail?: string): CellError => Object.freeze(detail ? { error, detail } : { error });

/** Shared error values (frozen: never mutate a value). */
export const ERR = {
  div0: frozen("#DIV/0!", "div-zero"),
  na: frozen("#N/A"),
  name: frozen("#NAME?"),
  null: frozen("#NULL!"),
  num: frozen("#NUM!"),
  ref: frozen("#REF!"),
  value: frozen("#VALUE!"),
  calc: frozen("#CALC!"),
  circ: frozen("#CIRC!", "circular"),
  notFound: frozen("#N/A", "not-found"),
  args: frozen("#VALUE!", "args"),
  syntax: frozen("#NAME?", "syntax"),
} as const;

export const mkErr = (error: ErrorCode, detail?: string): CellError => (detail ? { error, detail } : { error });

// ----------------------------------------------------------------------------------------------
// Values while evaluating

/** A one-cell value: what a cell holds. */
export type Scalar = CellValue;

/** An array of values, row by row (at least 1×1). Ranges and array results are matrices. */
export type Matrix = Scalar[][];

/** A reference to cells on a sheet (by the Calc's sheet index), kept as a reference until a function needs values. */
export class Ref {
  constructor(
    readonly sheet: number,
    readonly r0: number,
    readonly c0: number,
    readonly r1: number,
    readonly c1: number,
  ) {}
  get rows() {
    return this.r1 - this.r0 + 1;
  }
  get cols() {
    return this.c1 - this.c0 + 1;
  }
  get single() {
    return this.r0 === this.r1 && this.c0 === this.c1;
  }
}

/** Anything an expression gives while evaluating. */
export type Value = Scalar | Matrix | Ref;

export const isMatrix = (v: Value): v is Matrix => Array.isArray(v);
export const isRef = (v: Value): v is Ref => v instanceof Ref;
export const isErr = (v: unknown): v is CellError => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Ref) && "error" in v;

/** A number result: NaN and infinities become #NUM!, -0 becomes 0. */
export function numResult(n: number): number | CellError {
  if (!Number.isFinite(n)) return ERR.num;
  return n === 0 ? 0 : n;
}

// ----------------------------------------------------------------------------------------------
// Turning numbers into text (concatenation, LEN, TEXTJOIN…): up to 15 significant digits, like Excel.

/** 1.5 → "1,5" (de) / "1.5" (en); 1/3 → "0,333333333333333"; 1E+21 → "1E+21". */
export function numberToText(n: number, locale: Locale): string {
  if (n === 0 || !Number.isFinite(n)) return "0";
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const s = n.toPrecision(15);
  const e = s.indexOf("e");
  let mant = e < 0 ? s : s.slice(0, e);
  if (mant.includes(".")) mant = mant.replace(/0+$/, "").replace(/\.$/, "");
  if (locale === "de") mant = mant.replace(".", ",");
  if (e < 0) return mant;
  const exp = Number(s.slice(e + 1));
  return `${mant}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
}

export const boolText = (b: boolean, locale: Locale) => (locale === "de" ? (b ? "WAHR" : "FALSCH") : b ? "TRUE" : "FALSE");

// ----------------------------------------------------------------------------------------------
// Comparing like Excel: numbers < text < true/false; text without regard to case.

const collator = new Intl.Collator("de", { sensitivity: "accent", numeric: false });

/** Text compared like Excel: case doesn't matter, accents do. */
export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 0;
  const c = collator.compare(la, lb);
  return c < 0 ? -1 : c > 0 ? 1 : la < lb ? -1 : 1;
}

/** Equal at Excel's 15 significant digits (so 0.1 + 0.2 = 0.3 is TRUE). */
export function numbersEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-15;
}

const typeRank = (v: number | string | boolean) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);

/** -1, 0, 1 for two values that aren't errors (empty is 0, "" or FALSE, whichever the other side is). */
export function compareValues(a: Exclude<Scalar, CellError>, b: Exclude<Scalar, CellError>): number {
  if (a === null && b === null) return 0;
  if (a === null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  if (typeof a === "number") return numbersEqual(a, b as number) ? 0 : a < (b as number) ? -1 : 1;
  if (typeof a === "string") return compareText(a, b as string);
  return a === b ? 0 : a ? 1 : -1;
}
