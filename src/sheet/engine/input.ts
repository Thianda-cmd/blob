// Typing into a cell and editing it again: "=…" is a formula, "'…" always text, numbers, dates,
// times and percentages in the user's style become numbers (with the format the typing implies),
// and editText gives back what the editor should show so that committing it again changes nothing.

import type { Locale } from "@/i18n/config";
import type { Cell, NumberFormat } from "../types";
import { clockTime, durationText, isoDate, shortDate, timeOfSerial } from "./dates";
import { digitsOf, formatValue, isDuration } from "./format";
import type { ParsedInput } from "./index";
import { lex } from "./lexer";
import { formulaTooLongMessage, thousandsNotice } from "./messages";
import { MAX_TYPED_HOURS, parseValueText } from "./parse";
import { toCanonicalFormula, toLocalFormula } from "./translate";
import { boolText, isError, type CellValue } from "./values";

type InputOptions = { now?: () => Date };

/**
 * The longest formula a cell takes, as in Excel: 8,192 characters (stored, without "="). Longer
 * ones are refused when typed: the saved sheet would drop them.
 */
export const MAX_FORMULA_LENGTH = 8192;

type TypedFormula = { formula: string } | { error: { message: string; at: number }; tooLong?: boolean };

/** A formula as typed (without "=") → canonical, or why not, with the caret position for the editor (`shift`: where the formula starts in the typed text). */
function typedFormula(local: string, locale: Locale, shift: number): TypedFormula {
  const tooLong = (at: number): TypedFormula => ({ error: { message: formulaTooLongMessage(locale), at: shift + at }, tooLong: true });
  // What counts is the stored formula (German names can be longer or shorter than the English
  // ones); text far beyond that can't fit and isn't worth reading.
  if (local.length > 4 * MAX_FORMULA_LENGTH) return tooLong(MAX_FORMULA_LENGTH);
  const r = toCanonicalFormula(local, locale);
  if ("error" in r) return { error: { message: r.error, at: r.at + shift } };
  if (r.formula.length > MAX_FORMULA_LENGTH) return tooLong(local.length);
  return r;
}

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
    const r = typedFormula(text.slice(1), locale, 1);
    if ("error" in r) return { cell: {}, error: r.error };
    const fmt = impliedFormulaFormat(r.formula);
    return fmt ? { cell: { f: r.formula }, fmt } : { cell: { f: r.formula } };
  }
  const parsed = parseValueText(text, locale, { bools: true, units: true, zeroDecimal: true, thousandsHint: true, now: opts?.now });
  if (parsed) {
    if (parsed.kind === "bool") return { cell: { v: parsed.value } };
    // Excel: a number typed into a percent cell means percent (50 → 50 %).
    const inPercentCell = (fmt: NumberFormat | undefined, v: number) => (!fmt && current?.s?.fmt?.kind === "percent" ? v / 100 : v);
    const value = inPercentCell(parsed.fmt, parsed.value);
    const out: ParsedInput = parsed.fmt ? { cell: { v: value }, fmt: parsed.fmt } : { cell: { v: value } };
    if (parsed.orDecimal) {
      // "1.234" stays 1234 (Excel's reading), but the person may have meant 1,234: say so, and
      // offer it. The reading as the cell shows it ("„001.234“ ist 1234"), the other as typed
      // with a comma ("Als 1,000 lesen").
      const alt = parsed.orDecimal;
      const typed = text.trim();
      const { message, action } = thousandsNotice(typed, formatValue(parsed.value, parsed.fmt, locale), typed.replace(/(\d+)\.(\d+)/, "$1,$2"), locale);
      out.notice = { message, action, other: alt.fmt ? { cell: { v: alt.value }, fmt: alt.fmt } : { cell: { v: inPercentCell(undefined, alt.value) } } };
    }
    return out;
  }
  // "+A1*2" or "-A1": a formula without "=" (an old habit from other programs), when it is clearly one.
  if (/^[+-]/.test(text)) {
    const toks = lex(text, locale);
    if (toks.some((t) => t.k === "ref" || t.k === "fn")) {
      const r = typedFormula(text, locale, 0);
      if ("formula" in r) return { cell: { f: r.formula } };
      if (r.tooLong) return { cell: {}, error: r.error };
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
      const t = timeOfSerial(v);
      const seconds = t.s !== 0 || fmt.seconds;
      // A duration edits as one ("36:00"), and so does a time of a day or more with hours typing
      // takes back (a 36:00 typed before durations had their own format): never an 1899 date,
      // which wouldn't read back as a number. Too long for that: a duration as a plain number, a
      // date with its time (a timestamp shown as a clock time) as the date and the time.
      if (isDuration(fmt) || v >= 1) {
        if (Math.round(v * 86400) < (MAX_TYPED_HOURS + 1) * 3600) return durationText(v, seconds);
        if (isDuration(fmt)) return editNumber(v, locale);
        return `${shortDate(Math.floor(v) + t.carry, locale)} ${clockTime(v, t.s !== 0)}`;
      }
      return clockTime(v, seconds);
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
