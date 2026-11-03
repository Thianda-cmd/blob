// Criteria of ZÄHLENWENN / SUMMEWENN / …WENNS like Excel: ">5", "<=1,5", "<>x", "=", "",
// "Probe*", "A?", "~*" (a literal star), TRUE, a number or a date.

import type { Locale } from "@/i18n/config";
import { textToNumber } from "./parse";
import { compareText, compareValues, errorFromText, isError, numbersEqual, type Scalar } from "./values";

export type Criterion = (v: Scalar) => boolean;

const regexCache = new Map<string, RegExp>();

/** Excel wildcards → a RegExp (whole text, any case): * any text, ? one character, ~ escapes. */
export function wildcardRegex(pattern: string): RegExp {
  let re = regexCache.get(pattern);
  if (re) return re;
  let src = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "~" && i + 1 < pattern.length && "*?~".includes(pattern[i + 1])) {
      src += "\\" + pattern[i + 1];
      i++;
    } else if (ch === "*") src += "[\\s\\S]*";
    else if (ch === "?") src += "[\\s\\S]";
    else src += ch.replace(/[\\^$.|+()[\]{}*?]/g, "\\$&");
  }
  re = new RegExp(`^${src}$`, "i");
  if (regexCache.size > 2000) regexCache.clear();
  regexCache.set(pattern, re);
  return re;
}

export const hasWildcards = (s: string) => /[*?~]/.test(s);

/** Text equal to a pattern (with wildcards), without regard to case. */
export function textMatches(text: string, pattern: string): boolean {
  if (!hasWildcards(pattern)) return compareText(text, pattern) === 0;
  return wildcardRegex(pattern).test(text);
}

const criteriaCache = new Map<string, Criterion>();

/** A criterion as a test for each cell value. */
export function makeCriterion(crit: Scalar, locale: Locale): Criterion {
  if (typeof crit === "number") {
    return (v) => (typeof v === "number" ? numbersEqual(v, crit) : typeof v === "string" ? numericTextEquals(v, crit, locale) : false);
  }
  if (typeof crit === "boolean") return (v) => v === crit;
  if (crit === null) return (v) => v === null || v === "";
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

function parseCriterion(text: string, locale: Locale): Criterion {
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(text)!;
  const op = (m[1] ?? "") as "" | "=" | "<>" | "<" | ">" | "<=" | ">=";
  const operand = m[2];

  if (operand === "") {
    // "" matches empty cells and empty text; "=" only cells with nothing in them.
    if (op === "") return (v) => v === null || v === "";
    if (op === "=") return (v) => v === null;
    if (op === "<>") return (v) => v !== null && v !== "";
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
