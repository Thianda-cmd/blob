// Typing into a cell and editing it again: "=…" is a formula, "'…" always text, numbers, dates,
// times and percentages in the user's style become numbers (with the format the typing implies),
// and editText gives back what the editor should show so that committing it again changes nothing.

import type { Locale } from "@/i18n/config";
import type { Cell, NumberFormat } from "../types";
import { clockTime, isoDate, shortDate, timeOfSerial } from "./dates";
import { digitsOf } from "./format";
import type { ParsedInput } from "./index";
import { lex } from "./lexer";
import { parseValueText } from "./parse";
import { toCanonicalFormula, toLocalFormula } from "./translate";
import { boolText, isError, type CellValue } from "./values";

type InputOptions = { now?: () => Date };

/** Formulas whose result is a date or time get that format when typed (=HEUTE() shows 03.11.2026, not 46329). */
function impliedFormulaFormat(canonical: string): NumberFormat | undefined {
  const m = /^\s*([A-Z][A-Z0-9.]*)\s*\(/.exec(canonical);
  if (!m) return undefined;
  switch (m[1]) {
    case "TODAY":
    case "DATE":
    case "EDATE":
    case "EOMONTH":
      return { kind: "date", style: "short" };
    case "NOW":
      return { kind: "datetime" };
    case "TIME":
      return { kind: "time", seconds: false };
  }
  return undefined;
}

/**
 * Text typed into a cell → what to store. "=…" is a formula (canonicalised); "'…" is always text;
 * numbers in the locale's format ("1,5" in German, "1.5" in English; "1.234,5" with thousands),
 * percentages, dates ("1.11.2026", "2026-11-01", "11/1/2026" in English), times ("14:30"),
 * TRUE/FALSE (WAHR/FALSCH in German). A cell formatted as text keeps everything as text.
 */
export function parseInput(text: string, locale: Locale, current?: Cell, opts?: InputOptions): ParsedInput {
  if (current?.s?.fmt?.kind === "text") return { cell: text === "" ? {} : { v: text } };
  if (text.trim() === "") return { cell: {} };
  if (text.startsWith("'")) return { cell: { v: text.slice(1) } };
  if (text.startsWith("=")) {
    const r = toCanonicalFormula(text.slice(1), locale);
    if ("error" in r) return { cell: {}, error: { message: r.error, at: r.at + 1 } };
    const fmt = impliedFormulaFormat(r.formula);
    return fmt ? { cell: { f: r.formula }, fmt } : { cell: { f: r.formula } };
  }
  const parsed = parseValueText(text, locale, { bools: true, units: true, now: opts?.now });
  if (parsed) {
    if (parsed.kind === "bool") return { cell: { v: parsed.value } };
    let value = parsed.value;
    // Excel: a number typed into a percent cell means percent (50 → 50 %).
    if (!parsed.fmt && current?.s?.fmt?.kind === "percent") value = value / 100;
    return parsed.fmt ? { cell: { v: value }, fmt: parsed.fmt } : { cell: { v: value } };
  }
  // "+A1*2" or "-A1": a formula without "=" (an old habit from other programs), when it is clearly one.
  if (/^[+-]/.test(text)) {
    const toks = lex(text, locale);
    if (toks.some((t) => t.k === "ref" || t.k === "fn")) {
      const r = toCanonicalFormula(text, locale);
      if ("formula" in r) return { cell: { f: r.formula } };
    }
  }
  return { cell: { v: text } };
}

/** A number for editing: all its digits (up to 15 significant), no thousands separators. */
export function editNumber(n: number, locale: Locale): string {
  if (n === 0 || !Number.isFinite(n)) return "0";
  const { d, e } = digitsOf(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  const dec = locale === "de" ? "," : ".";
  if (e > 21 || e < -6) {
    // 1,5E-10 / 6,022E+23
    const mant = d.length > 1 ? `${d[0]}${dec}${d.slice(1)}` : d;
    const exp = e - 1;
    return `${sign}${mant}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  if (e <= 0) return `${sign}0${dec}${"0".repeat(-e)}${d}`;
  if (d.length <= e) return sign + d + "0".repeat(e - d.length);
  return `${sign}${d.slice(0, e)}${dec}${d.slice(e)}`;
}

/** Would typing this text back make something other than text (a number, date, formula…)? */
function wouldParse(text: string, locale: Locale): boolean {
  if (text === "" || text.startsWith("'") || text.startsWith("=")) return true;
  if (text.trim() === "") return true;
  const p = parseInput(text, locale);
  return p.cell.v === undefined || typeof p.cell.v !== "string" || p.cell.f !== undefined;
}

/** What the editor shows when you edit a cell: "=SUMME(A1:A3)" in German, "1,5" for 1.5, a date as typed. */
export function editText(cell: Cell | undefined, locale: Locale): string {
  if (!cell) return "";
  if (cell.f !== undefined) return `=${toLocalFormula(cell.f, locale)}`;
  const v = cell.v;
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return boolText(v, locale);
  const fmt = cell.s?.fmt;
  if (typeof v === "string") {
    if (fmt?.kind === "text") return v;
    return wouldParse(v, locale) ? `'${v}` : v;
  }
  if (!Number.isFinite(v)) return "";
  switch (fmt?.kind) {
    case "percent":
      return `${editNumber(Number((v * 100).toPrecision(15)), locale)}%`;
    case "date":
    case "datetime": {
      if (v < 0) break;
      const t = timeOfSerial(v);
      const day = Math.floor(v) + t.carry;
      const date = fmt.kind === "date" && fmt.style === "iso" ? isoDate(day) : shortDate(day, locale);
      if (t.h === 0 && t.mi === 0 && t.s === 0) return date;
      return `${date} ${clockTime(day + (t.h * 3600 + t.mi * 60 + t.s) / 86400, t.s !== 0)}`;
    }
    case "time": {
      if (v < 0) break;
      if (v >= 1) {
        const t = timeOfSerial(v);
        const day = Math.floor(v) + t.carry;
        return `${shortDate(day, locale)} ${clockTime(v, t.s !== 0)}`;
      }
      const t = timeOfSerial(v);
      return clockTime(v, t.s !== 0 || fmt.seconds);
    }
  }
  return editNumber(v, locale);
}

/** Default alignment of a value: numbers right, text left, booleans and errors centred. */
export function defaultAlign(value: CellValue): "left" | "center" | "right" {
  if (typeof value === "number") return "right";
  if (typeof value === "boolean" || isError(value)) return "center";
  return "left";
}
