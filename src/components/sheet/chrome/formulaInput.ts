// Helpers for typing formulas, shared by the in-cell editor (grid) and the formula bar, so both
// behave the same: clicking a cell inserts its reference, functions are suggested, the argument
// you are in is named, and every reference gets a colour (the same frame colour on the grid).
//
// CONTRACT: used by the grid's cell editor and the formula bar. Keep names and signatures.
//
// Every helper takes the text as it is in the editor, "=" included, and positions in that text.
// They work on unfinished input ("=SUMME(A1:A", "=WENN(") and never throw for it: the tokens come
// from the engine's tokenizer, which is just as forgiving.

import type { Locale } from "@/i18n/config";
import { SERIES_COLORS } from "@/sheet/colors";
import { FUNCTION_BY_DE, FUNCTION_BY_EN, FUNCTION_NAMES, getFunction, tokenizeFormula, type FormulaToken, type FunctionName } from "@/sheet/engine";
import type { SheetColor } from "@/sheet/types";

/**
 * The colours references get, in order of appearance: the chart series' order (src/sheet/colors.ts),
 * without yellow (too pale as text on white) and gray (looks like plain text).
 */
export const REF_COLORS: SheetColor[] = SERIES_COLORS.filter((c) => c !== "yellow" && c !== "gray");

/**
 * The functions students use most, best first: suggestions and the function browser's
 * "Häufig verwendet" list follow this order.
 */
export const POPULAR_FUNCTIONS: string[] = [
  "SUM",
  "AVERAGE",
  "IF",
  "COUNT",
  "MIN",
  "MAX",
  "ROUND",
  "STDEV.S",
  "SLOPE",
  "INTERCEPT",
  "RSQ",
  "VLOOKUP",
  "COUNTIF",
  "SUMIF",
  "MEDIAN",
  "IFERROR",
  "ABS",
  "SQRT",
  "POWER",
  "LOG10",
  "LN",
  "EXP",
  "COUNTA",
  "AVERAGEIF",
  "FORECAST.LINEAR",
  "TREND",
  "LINEST",
  "CORREL",
  "STDEV.P",
  "VAR.S",
  "CONFIDENCE.T",
  "T.TEST",
  "CONVERT",
  "ROUNDUP",
  "ROUNDDOWN",
  "AND",
  "OR",
  "NOT",
  "TODAY",
  "NOW",
  "DATE",
  "INDEX",
  "MATCH",
  "XLOOKUP",
  "CONCAT",
  "TEXT",
  "LEFT",
  "RIGHT",
  "LEN",
  "SUMPRODUCT",
  "PRODUCT",
  "MOD",
  "INT",
  "LOG",
  "PI",
  "LARGE",
  "SMALL",
  "RANK.EQ",
  "STEYX",
  "GROWTH",
  "LOGEST",
  "FORECAST",
];

const POPULARITY = new Map(POPULAR_FUNCTIONS.map((name, i) => [name, i]));

/** Characters of a function name as people type them ("STABW.S", "ZÄHLENWENN", "LOG10"). */
const NAME_CHAR = /[A-Za-z0-9_.À-ɏ]/;

// ----------------------------------------------------------------------------------------------
// Tokens

let lastTokens: { text: string; locale: Locale; tokens: FormulaToken[] } | null = null;

/**
 * The tokens of the formula in `text` ("=…") with positions in `text` itself (so after the "=").
 * null when the text isn't a formula. The last result is kept: the editor asks several helpers
 * about the same text on every keystroke.
 */
export function formulaTokensOf(text: string, locale: Locale): FormulaToken[] | null {
  if (!text.startsWith("=")) return null;
  if (lastTokens && lastTokens.text === text && lastTokens.locale === locale) return lastTokens.tokens;
  let tokens: FormulaToken[];
  try {
    tokens = tokenizeFormula(text.slice(1), locale).map((t) => ({ ...t, start: t.start + 1, end: t.end + 1 }));
  } catch (err) {
    console.error("sheet: tokenizing a formula failed", err);
    tokens = [];
  }
  lastTokens = { text, locale, tokens };
  return tokens;
}

/** Is this "(" / ")" / "{" / "}" token? */
const isParen = (t: FormulaToken, ch: "(" | ")" | "{" | "}") => t.kind === "paren" && t.text === ch;

// ----------------------------------------------------------------------------------------------
// Pointing at cells

/** What may follow a reference inserted at the caret: the end, a space, ")", a separator or an operator. */
const BLOCKS_REF = /[A-Za-z0-9_.$'"#!({À-ɏ]/;

/**
 * Is the caret at a spot where clicking (or arrow-keying to) a cell should insert its reference?
 * True right after "=", "(", the argument separator or an operator, or while the reference just
 * inserted is still under the caret (then a new click replaces it).
 */
export function wantsRef(text: string, caret: number, locale: Locale): boolean {
  const tokens = formulaTokensOf(text, locale);
  if (!tokens || caret < 1 || caret > text.length) return false;
  let prev: FormulaToken | null = null;
  let touching: FormulaToken | null = null;
  let braces = 0;
  for (const t of tokens) {
    if (t.start >= caret) break;
    if (t.end > caret) {
      // The caret is inside a token: a name, a number or a text being typed (spaces are fine).
      if (t.kind === "space") break;
      return false;
    }
    if (isParen(t, "{")) braces++;
    else if (isParen(t, "}")) braces = Math.max(0, braces - 1);
    if (t.kind !== "space") prev = t;
    touching = t;
  }
  // The reference right before the caret is replaced by the next one pointed at.
  if (touching && touching.kind === "ref" && touching.end === caret) return true;
  // Inserting before an operand would glue the two together ("=SUMME(|A1)" → "B2A1").
  const next = text[caret];
  if (next !== undefined && BLOCKS_REF.test(next)) return false;
  if (!prev) return true;
  if (braces > 0) return false;
  if (prev.kind === "paren") return prev.text === "(";
  if (prev.kind === "separator") return true;
  if (prev.kind === "operator") return prev.text !== "%";
  return false;
}

/** Insert `ref` ("B3", "B3:B9", "'Blatt 2'!A1") at the caret, replacing a reference that ends there. */
export function insertRef(text: string, caret: number, ref: string, locale: Locale): { text: string; caret: number } {
  const at = Math.max(0, Math.min(text.length, caret));
  const tokens = formulaTokensOf(text, locale) ?? [];
  let start = at;
  const before = tokens.find((t) => t.end === at && t.start < at && t.kind === "ref");
  if (before) start = before.start;
  else if (ref.includes("!")) {
    // A sheet name typed by hand right before ("'Blatt 2'!"): the reference brings its own.
    const prefix = tokens.find((t) => t.end === at && t.start < at && t.kind === "unknown" && t.text.endsWith("!"));
    if (prefix) start = prefix.start;
  }
  return { text: text.slice(0, start) + ref + text.slice(at), caret: start + ref.length };
}

// ----------------------------------------------------------------------------------------------
// Suggesting functions

/** Upper case without umlauts, so "zahlenwenn" and "ZAEHLENWENN" find ZÄHLENWENN. */
function fold(s: string): string {
  return s
    .toUpperCase()
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/Ü/g, "U");
}
const foldTyped = (s: string) => fold(s).replace(/AE/g, "A").replace(/OE/g, "O").replace(/UE/g, "U");

/** The word typed at the caret: where it starts and ends, and the part before the caret. null outside formulas or when there is none. */
function wordAt(text: string, caret: number): { start: number; end: number; typed: string } | null {
  if (!text.startsWith("=") || caret < 1 || caret > text.length) return null;
  let start = caret;
  while (start > 1 && NAME_CHAR.test(text[start - 1])) start--;
  if (start === caret) return null;
  let end = caret;
  while (end < text.length && NAME_CHAR.test(text[end])) end++;
  return { start, end, typed: text.slice(start, caret) };
}

/**
 * The functions whose name starts with `typed`, best first. German: German names before English
 * ones (both work in formulas); English: English names only (German names aren't functions there).
 * Within a group: an exact name, then the popular ones, then shorter names, then A–Z.
 */
export function matchFunctions(typed: string, locale: Locale): FunctionName[] {
  const upper = typed.toUpperCase();
  const folded = foldTyped(typed);
  if (!upper) return [];
  const starts = (name: string) => name.startsWith(upper) || fold(name).startsWith(folded);
  type Hit = { fn: FunctionName; group: number; exact: boolean; name: string };
  const hits: Hit[] = [];
  for (const fn of FUNCTION_NAMES) {
    if (locale === "de" && starts(fn.de)) hits.push({ fn, group: 0, exact: fn.de === upper || fold(fn.de) === folded, name: fn.de });
    else if (starts(fn.en)) hits.push({ fn, group: locale === "de" ? 1 : 0, exact: fn.en === upper, name: fn.en });
  }
  const pop = (fn: FunctionName) => POPULARITY.get(fn.en) ?? 10000;
  hits.sort(
    (a, b) =>
      a.group - b.group ||
      Number(b.exact) - Number(a.exact) ||
      // Excel's older names (STABW, TVERT…) after the modern ones they stand for.
      Number(!!a.fn.newer) - Number(!!b.fn.newer) ||
      pop(a.fn) - pop(b.fn) ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name),
  );
  return hits.map((h) => h.fn);
}

/** Functions matching the word before the caret (German and English names), best first. */
export function suggestFunctions(text: string, caret: number, locale: Locale): { start: number; end: number; items: FunctionName[] } | null {
  const word = wordAt(text, caret);
  if (!word) return null;
  // A name starts with a letter; a function already followed by "(" is complete.
  if (!/^[A-Za-z_À-ɏ]/.test(word.typed) || text[word.end] === "(") return null;
  // Not the second half of a range ("A1:B"), a sheet's reference ("Blatt1!A", "$A") or an error.
  const before = text[word.start - 1];
  if (before === ":" || before === "$" || before === "!" || before === "'" || before === "#") return null;
  // Not inside a text in quotes or a quoted sheet name.
  const tokens = formulaTokensOf(text, locale) ?? [];
  const inside = tokens.find((t) => t.start <= caret - 1 && caret - 1 < t.end);
  if (inside && (inside.kind === "string" || inside.kind === "error" || (inside.kind === "unknown" && inside.text.startsWith("'")))) return null;
  const items = matchFunctions(word.typed, locale);
  return items.length ? { start: word.start, end: word.end, items } : null;
}

/** The function of a name as typed in either language ("MITTELWERT", "average"). */
export function functionByName(name: string): FunctionName | undefined {
  const upper = name.toUpperCase();
  return FUNCTION_BY_DE.get(upper) ?? FUNCTION_BY_EN.get(upper);
}

/** Functions without arguments (PI, HEUTE, JETZT, ZUFALLSZAHL…) get "()" right away. */
function takesNoArguments(name: string): boolean {
  const fn = functionByName(name);
  if (!fn) return false;
  try {
    return getFunction(fn.en)?.max === 0;
  } catch {
    return false;
  }
}

/** Accept a suggestion: the name and an opening parenthesis replace the word; caret inside. */
export function applySuggestion(text: string, s: { start: number; end: number }, name: string): { text: string; caret: number } {
  const start = Math.max(0, Math.min(text.length, s.start));
  const end = Math.max(start, Math.min(text.length, s.end));
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (after.startsWith("(")) return { text: before + name + after, caret: start + name.length + 1 };
  if (takesNoArguments(name)) return { text: `${before}${name}()${after}`, caret: start + name.length + 2 };
  return { text: `${before}${name}(${after}`, caret: start + name.length + 1 };
}

/**
 * A function picked from the function browser goes into the text: a word being typed at the
 * caret is replaced, otherwise it goes in at the caret. Text that isn't a formula yet becomes one
 * ("=MITTELWERT(").
 */
export function insertFunctionCall(text: string, caret: number, name: string, locale: Locale): { text: string; caret: number } {
  if (!text.startsWith("=")) return applySuggestion("=", { start: 1, end: 1 }, name);
  const at = Math.max(1, Math.min(text.length, caret));
  // Only a half-typed function name goes ("=MITTE|" → "=MITTELWERT("), never a reference ("=A1|").
  const word = suggestFunctions(text, at, locale);
  return applySuggestion(text, word ?? { start: at, end: at }, name);
}

// ----------------------------------------------------------------------------------------------
// The argument you are in

type Frame = { kind: "fn" | "group" | "brace"; fn: string; index: number };

/** The function call around the caret and which argument (0-based) it is in, for the hint. */
export function argumentAt(text: string, caret: number, locale: Locale): { fn: string; index: number } | null {
  const tokens = formulaTokensOf(text, locale);
  if (!tokens) return null;
  const stack: Frame[] = [];
  let prev: FormulaToken | null = null;
  for (const t of tokens) {
    // Only what is complete before the caret counts ("SUMME(" with the caret after "(" is in SUMME).
    if (t.end > caret) break;
    if (t.kind === "paren") {
      if (t.text === "(") {
        const fn = prev && prev.kind === "function" ? (prev.fn ?? prev.text.toUpperCase()) : "";
        stack.push({ kind: fn ? "fn" : "group", fn, index: 0 });
      } else if (t.text === "{") stack.push({ kind: "brace", fn: "", index: 0 });
      else if (t.text === ")") {
        // Closes the innermost "(" (an unclosed "{" inside it goes too).
        while (stack.length && stack[stack.length - 1].kind === "brace") stack.pop();
        stack.pop();
      } else if (t.text === "}") {
        if (stack.length && stack[stack.length - 1].kind === "brace") stack.pop();
      }
    } else if (t.kind === "separator") {
      const top = stack[stack.length - 1];
      // Separators inside { } separate the constants of an array, not arguments.
      if (top && top.kind !== "brace") top.index++;
    }
    if (t.kind !== "space") prev = t;
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const f = stack[i];
    if (f.kind === "fn") return { fn: f.fn, index: f.index };
  }
  return null;
}

// ----------------------------------------------------------------------------------------------
// Colours

/** The same reference however it is written: A1, a1, $A$1 and B5:A1 / A1:B5 are one. */
function refKey(t: FormulaToken): string {
  const r = t.ref;
  if (!r) return t.text.replace(/\$/g, "").toUpperCase();
  const a = r.area;
  return `${(r.sheet ?? "").toLowerCase()}!${a.r0},${a.c0}:${a.r1},${a.c1}${r.whole ?? ""}`;
}

/** A colour per distinct reference, in order of appearance (the same reference keeps its colour). */
export function refColors(tokens: FormulaToken[]): Map<FormulaToken, SheetColor> {
  const out = new Map<FormulaToken, SheetColor>();
  const byRef = new Map<string, SheetColor>();
  for (const t of tokens) {
    if (t.kind !== "ref") continue;
    const key = refKey(t);
    let color = byRef.get(key);
    if (!color) {
      color = REF_COLORS[byRef.size % REF_COLORS.length];
      byRef.set(key, color);
    }
    out.set(t, color);
  }
  return out;
}

/**
 * The parenthesis matching the one at or right before the caret, for showing pairs while typing:
 * [open, close] positions in `text`, or null. Parentheses in texts don't count (they are inside
 * string tokens).
 */
export function matchingParens(text: string, caret: number, locale: Locale): [number, number] | null {
  const tokens = formulaTokensOf(text, locale);
  if (!tokens) return null;
  const parens = tokens.filter((t) => isParen(t, "(") || isParen(t, ")"));
  // The one just typed (before the caret) first, then the one after it.
  const here = parens.find((t) => t.end === caret) ?? parens.find((t) => t.start === caret);
  if (!here) return null;
  const i = parens.indexOf(here);
  if (here.text === "(") {
    let depth = 0;
    for (let j = i; j < parens.length; j++) {
      depth += parens[j].text === "(" ? 1 : -1;
      if (depth === 0) return [here.start, parens[j].start];
    }
    return null;
  }
  let depth = 0;
  for (let j = i; j >= 0; j--) {
    depth += parens[j].text === ")" ? 1 : -1;
    if (depth === 0) return [parens[j].start, here.start];
  }
  return null;
}
