// Criteria of ZÄHLENWENN / SUMMEWENN / …WENNS like Excel: ">5", "<=1,5", "<>x", "=", "",
// "Probe*", "A?", "~*" (a literal star), TRUE, a number or a date.

import type { Locale } from "@/i18n/config";
import { compileGlob, globTest } from "./glob";
import { textToNumber } from "./parse";
import { compareText, compareValues, errorFromText, isError, mkErr, numbersEqual, type CellError, type Scalar } from "./values";

export type Criterion = (v: Scalar) => boolean;

export const hasWildcards = (s: string) => /[*?~]/.test(s);

/**
 * The longest text with wildcards that a criterion, a lookup or SUCHEN takes, as in Excel (255
 * characters; longer gives #WERT!). Matching takes up to (length of the text) × (length of the
 * pattern ÷ 32) steps, so a pattern of 32,767 characters from a cell, against long texts, would
 * hold up the sheet for seconds per formula.
 */
export const MAX_PATTERN = 255;

/** #WERT! for a text with wildcards longer than MAX_PATTERN, else null. */
export function patternTooLong(s: Scalar): CellError | null {
  return typeof s === "string" && s.length > MAX_PATTERN && hasWildcards(s) ? mkErr("#VALUE!", "pattern-too-long") : null;
}

/** Text equal to a pattern (with wildcards: * any text, ? one character, ~ escapes), without regard to case. */
export function textMatches(text: string, pattern: string): boolean {
  if (!hasWildcards(pattern)) return compareText(text, pattern) === 0;
  return globTest(compileGlob(pattern), text);
}

const criteriaCache = new Map<string, Criterion | CellError>();

/** A criterion as a test for each cell value (#WERT! for a pattern too long, see MAX_PATTERN). */
export function makeCriterion(crit: Scalar, locale: Locale): Criterion | CellError {
  // An empty criteria cell means 0, as Microsoft documents for ZÄHLENWENNS and MITTELWERTWENN: a
  // summary row whose condition isn't filled in yet counts the zeros, not every empty row.
  if (crit === null) crit = 0;
  if (typeof crit === "number") {
    const n = crit;
    return (v) => (typeof v === "number" ? numbersEqual(v, n) : typeof v === "string" ? numericTextEquals(v, n, locale) : false);
  }
  if (typeof crit === "boolean") return (v) => v === crit;
  if (isError(crit)) return (v) => isError(v) && v.error === crit.error;
  const key = `${locale}\u0000${crit}`;
  let c = criteriaCache.get(key);
  if (c) return c;
  c = parseCriterion(crit, locale);
  if (criteriaCache.size > 2000) criteriaCache.clear();
  criteriaCache.set(key, c);
  return c;
}

function numericTextEquals(v: string, n: number, locale: Locale): boolean {
  const x = textToNumber(v, locale);
  return x !== null && numbersEqual(x, n);
}

function parseCriterion(text: string, locale: Locale): Criterion | CellError {
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(text)!;
  const op = (m[1] ?? "") as "" | "=" | "<>" | "<" | ">" | "<=" | ">=";
  const operand = m[2];

  if (operand === "") {
    // "" matches empty cells and empty text; "=" only cells with nothing in them, and "<>" is its
    // opposite: a formula that gives "" counts as filled, as in Excel (and like ANZAHL2).
    if (op === "") return (v) => v === null || v === "";
    if (op === "=") return (v) => v === null;
    if (op === "<>") return (v) => v !== null;
    return () => false;
  }

  const num = textToNumber(operand, locale);
  if (num !== null) {
    const eq: Criterion = (v) => (typeof v === "number" ? numbersEqual(v, num) : typeof v === "string" ? numericTextEquals(v, num, locale) : false);
    switch (op) {
      case "":
      case "=":
        return eq;
      case "<>":
        return (v) => !eq(v);
      default:
        return (v) => typeof v === "number" && cmpOk(op, numbersEqual(v, num) ? 0 : v < num ? -1 : 1);
    }
  }

  const up = operand.toUpperCase();
  if (up === "TRUE" || up === "FALSE" || up === "WAHR" || up === "FALSCH") {
    const b = up === "TRUE" || up === "WAHR";
    switch (op) {
      case "":
      case "=":
        return (v) => v === b;
      case "<>":
        return (v) => v !== b;
      default:
        return (v) => typeof v === "boolean" && cmpOk(op, compareValues(v, b));
    }
  }

  const errCode = operand.startsWith("#") ? errorFromText(operand, true) : null;
  if (errCode) {
    if (op === "<>") return (v) => !(isError(v) && v.error === errCode);
    if (op === "" || op === "=") return (v) => isError(v) && v.error === errCode;
    return () => false;
  }

  if (op === "" || op === "=" || op === "<>") {
    const tooLong = patternTooLong(operand);
    if (tooLong) return tooLong;
  }
  switch (op) {
    case "":
    case "=":
      return (v) => typeof v === "string" && textMatches(v, operand);
    case "<>":
      return (v) => !(typeof v === "string" && textMatches(v, operand));
    default:
      return (v) => typeof v === "string" && cmpOk(op, compareText(v, operand));
  }
}

function cmpOk(op: string, c: number): boolean {
  switch (op) {
    case "<":
      return c < 0;
    case ">":
      return c > 0;
    case "<=":
      return c <= 0;
    case ">=":
      return c >= 0;
  }
  return false;
}
