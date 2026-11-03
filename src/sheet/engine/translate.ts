// Formulas as text in two forms: canonical (stored: English names, "," between arguments, "."
// decimals) and local (shown and typed: German SUMME(A1;1,5), English SUM(A1,1.5)). Translation
// goes token by token, so spaces and everything else the person wrote stay as they were.

import type { Locale } from "@/i18n/config";
import { quoteSheetName } from "../a1";
import { MAX_COLS, MAX_ROWS } from "../types";
import type { FormulaRef, FormulaToken } from "./index";
import { lex, type RefInfo, type Tok } from "./lexer";
import { localName, parseErrorMessage } from "./messages";
import { lexCanonical, parseTokens } from "./parser";
import { normalizeRef, refText } from "./refs";
import { errorText } from "./values";

export function toFormulaRef(ref: RefInfo): FormulaRef {
  const n = normalizeRef(ref);
  if (n.kind === "cols") return { sheet: n.sheet, area: { r0: 0, c0: n.c0, r1: MAX_ROWS - 1, c1: n.c1 }, whole: "cols" };
  if (n.kind === "rows") return { sheet: n.sheet, area: { r0: n.r0, c0: 0, r1: n.r1, c1: MAX_COLS - 1 }, whole: "rows" };
  return { sheet: n.sheet, area: { r0: n.r0, c0: n.c0, r1: n.r1, c1: n.c1 } };
}

const errPrefix = (t: Tok) => (t.sheet != null ? `${quoteSheetName(t.sheet)}!` : "");

/** Canonical → the user's language (without "="): "SUM(A1,1.5)" → "SUMME(A1;1,5)". */
export function toLocalFormula(canonical: string, locale: Locale): string {
  const toks = lexCanonical(canonical);
  const de = locale === "de";
  let out = "";
  for (const t of toks) {
    switch (t.k) {
      case "num": {
        // ".5" is written "0,5" in German (",5" reads like a separator inside { }).
        const text = t.text.startsWith(".") ? `0${t.text}` : t.text;
        out += de ? text.replace(".", ",") : t.text;
        break;
      }
      case "fn":
        out += t.fn ? localName(t.fn, locale) : t.text;
        break;
      case "bool":
        out += de ? (t.bool ? "WAHR" : "FALSCH") : t.bool ? "TRUE" : "FALSE";
        break;
      case "err":
        out += errPrefix(t) + errorText(t.err ?? "#REF!", locale);
        break;
      case "sep":
        if (t.inBrace) out += t.text === ";" ? ";" : de ? "." : ",";
        else out += de ? ";" : ",";
        break;
      default:
        out += t.text;
    }
  }
  return out;
}

/**
 * The user's language → canonical (without "="). Accepts English names in German too (SUM and
 * SUMME both work), any case, and ";" or "," as separator where unambiguous. Returns where and why
 * when it doesn't parse, in plain words of the user's language.
 */
export function toCanonicalFormula(local: string, locale: Locale): { formula: string } | { error: string; at: number } {
  const toks = lex(local, locale);
  const r = parseTokens(toks, locale);
  if (!r.ok) {
    // "Blatt 2!A1": a sheet name with spaces needs quotes; say exactly that.
    const sp = /(^|[^'A-Za-z0-9_.\u00C0-\u024F])([A-Za-z_\u00C0-\u024F][A-Za-z0-9_.\u00C0-\u024F]*(?: +[A-Za-z0-9_.\u00C0-\u024F]+)+)!/.exec(local);
    if (sp) {
      const name = sp[2];
      const at = sp.index + sp[1].length;
      return {
        error: locale === "de" ? `Blattnamen mit Leerzeichen gehören in Apostrophe: '${name}'!` : `Sheet names with spaces go in single quotes: '${name}'!`,
        at,
      };
    }
    return { error: parseErrorMessage(r.error, locale), at: r.error.at };
  }
  const w = r.parsed.warnings[0];
  if (w) return { error: parseErrorMessage(w, locale), at: w.at };
  let out = "";
  for (const t of toks) {
    switch (t.k) {
      case "num":
        out += t.text.replace(",", ".");
        break;
      case "fn":
        out += t.fn ?? (t.upper ?? t.text);
        break;
      case "bool":
        out += t.bool ? "TRUE" : "FALSE";
        break;
      case "err":
        out += errPrefix(t) + (t.err ?? "#REF!");
        break;
      case "ref":
        out += t.ref ? refText(normalizeRef(t.ref)) : t.text;
        break;
      case "sep":
        if (t.inBrace) out += t.text === ";" ? ";" : ",";
        else out += ",";
        break;
      default:
        out += t.text;
    }
  }
  return { formula: out };
}

const KIND: Record<Tok["k"], FormulaToken["kind"]> = {
  num: "number",
  str: "string",
  bool: "bool",
  err: "error",
  ref: "ref",
  fn: "function",
  name: "name",
  op: "operator",
  lp: "paren",
  rp: "paren",
  lb: "paren",
  rb: "paren",
  sep: "separator",
  ws: "space",
  bad: "unknown",
};

/**
 * Tokens of a formula as the user is typing it (localised, without "=", may be unfinished:
 * "SUMME(A1:A" must still tokenize). For colouring references, autocomplete and argument hints.
 */
export function tokenizeFormula(local: string, locale: Locale): FormulaToken[] {
  return lex(local, locale).map((t) => {
    const out: FormulaToken = { kind: KIND[t.k], text: t.text, start: t.start, end: t.end };
    if (t.k === "ref" && t.ref) out.ref = toFormulaRef(t.ref);
    if (t.k === "fn" && t.fn) out.fn = t.fn;
    return out;
  });
}

/** References in a canonical formula (for showing precedents, charts from formulas…). */
export function formulaRefs(canonical: string): FormulaRef[] {
  const out: FormulaRef[] = [];
  for (const t of lexCanonical(canonical)) if (t.k === "ref" && t.ref) out.push(toFormulaRef(t.ref));
  return out;
}

/** Functions Excel files name with the "_xlfn." prefix (added to Excel after 2007). */
const XLFN = new Set([
  "CEILING.MATH", "CHISQ.DIST", "CHISQ.DIST.RT", "CHISQ.INV", "CHISQ.INV.RT", "CHISQ.TEST", "CONCAT", "CONFIDENCE.NORM", "CONFIDENCE.T", "COVARIANCE.P",
  "COVARIANCE.S", "DAYS", "F.DIST", "F.DIST.RT", "F.INV", "F.INV.RT", "F.TEST", "FLOOR.MATH", "FORECAST.LINEAR", "IFNA", "IFS", "ISFORMULA", "ISOWEEKNUM",
  "MAXIFS", "MINIFS", "MODE.SNGL", "NORM.DIST", "NORM.INV", "NORM.S.DIST", "NORM.S.INV", "PERCENTILE.EXC", "PERCENTILE.INC", "QUARTILE.EXC", "QUARTILE.INC",
  "RANK.AVG", "RANK.EQ", "STDEV.P", "STDEV.S", "SWITCH", "T.DIST", "T.DIST.2T", "T.DIST.RT", "T.INV", "T.INV.2T", "T.TEST", "TEXTJOIN", "VAR.P", "VAR.S",
  "XLOOKUP", "XMATCH", "XOR",
]);

/** A canonical formula as an .xlsx file writes it: newer functions get Excel's "_xlfn." prefix. */
export function toFileFormula(canonical: string): string {
  let changed = false;
  const out = lexCanonical(canonical).map((t) => {
    if (t.k === "fn" && t.fn && XLFN.has(t.fn) && !/^_xl/i.test(t.text)) {
      changed = true;
      return `_xlfn.${t.fn}`;
    }
    return t.text;
  });
  return changed ? out.join("") : canonical;
}

/** A formula read from an .xlsx file → canonical: without "_xlfn." / "_xlws." prefixes, names in capitals. */
export function fromFileFormula(formula: string): string {
  let changed = false;
  const out = lexCanonical(formula).map((t) => {
    if (t.k === "fn" && t.fn && t.text !== t.fn) {
      changed = true;
      return t.fn;
    }
    return t.text;
  });
  return changed ? out.join("") : formula;
}
