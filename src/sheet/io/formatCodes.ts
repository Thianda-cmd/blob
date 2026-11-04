// Number formats between Blob and Excel: Blob's kinds ⇄ Excel's format codes. Used by the .xlsx
// reader and writer (src/sheet/io/xlsx.ts) and by copy and paste (src/sheet/io/clipboard.ts),
// which tell Excel each cell's format in the HTML they put on the clipboard and read it back.
// Kept apart from the rest of xlsxStyles.ts so the spreadsheet editor loads only this part.

import type { Locale } from "@/i18n/config";
import type { NumberFormat } from "../types";
import { lookup } from "./lookup";

/** Excel's built-in formats that have a fixed code (the rest depend on the reader's language). */
export const BUILTIN_CODES: Record<number, string> = {
  0: "General",
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "# ?/?",
  13: "# ??/??",
  14: "mm-dd-yy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "m/d/yy h:mm",
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mmss.0",
  48: "##0.0E+0",
  49: "@",
};

const zeros = (n: number) => "0".repeat(Math.max(0, Math.min(15, Math.round(n))));
const decimalsPart = (d: number) => (d > 0 ? `.${zeros(d)}` : "");
/** Text shown after a number ("mg/L"), quoted for a format code; an angle's degree sign right after it ("45°"), as Blob shows it. */
const literal = (unit: string | undefined) => {
  const u = (unit ?? "").replace(/"/g, "").trim();
  return u ? (u === "°" ? '"°"' : `" ${u}"`) : "";
};

/**
 * A Blob number format as Excel's: a built-in id, or a format code to add to the file. `value` is
 * the cell's number, for "significant figures", which Excel can't show: the decimals the value
 * needs for them are written instead (what the cell shows now; a new value keeps those decimals).
 */
export function toExcelFormat(fmt: NumberFormat | undefined, locale: Locale, value?: unknown): { id: number } | { code: string } {
  if (!fmt) return { id: 0 };
  switch (fmt.kind) {
    case "general":
      return { id: 0 };
    case "text":
      return { id: 49 };
    case "number": {
      const d = Math.max(0, Math.min(15, Math.round(fmt.decimals)));
      if (!fmt.unit?.trim()) {
        if (!fmt.group && d === 0) return { id: 1 };
        if (!fmt.group && d === 2) return { id: 2 };
        if (fmt.group && d === 0) return { id: 3 };
        if (fmt.group && d === 2) return { id: 4 };
      }
      return { code: `${fmt.group ? "#,##0" : "0"}${decimalsPart(d)}${literal(fmt.unit)}` };
    }
    case "percent": {
      const d = Math.max(0, Math.min(15, Math.round(fmt.decimals)));
      if (d === 0) return { id: 9 };
      if (d === 2) return { id: 10 };
      return { code: `0${decimalsPart(d)}%` };
    }
    case "scientific": {
      const d = Math.max(0, Math.min(15, Math.round(fmt.decimals)));
      if (d === 2 && !fmt.unit?.trim()) return { id: 11 };
      return { code: `0${decimalsPart(d)}E+00${literal(fmt.unit)}` };
    }
    case "significant": {
      const digits = Math.max(1, Math.min(15, Math.round(fmt.digits)));
      const v = typeof value === "number" && Number.isFinite(value) && value !== 0 ? Math.abs(value) : null;
      if (v === null) return { code: `0${decimalsPart(Math.max(0, digits - 1))}${literal(fmt.unit)}` };
      const e = Math.floor(Math.log10(v));
      // Like Blob: very big and very small numbers in scientific notation.
      if (e >= 6 || e < -4) return { code: `0${decimalsPart(digits - 1)}E+00${literal(fmt.unit)}` };
      return { code: `0${decimalsPart(Math.max(0, digits - 1 - e))}${literal(fmt.unit)}` };
    }
    case "currency": {
      const d = Math.max(0, Math.min(15, Math.round(fmt.decimals)));
      const body = `#,##0${decimalsPart(d)}`;
      if (locale === "de") return { code: `${body} "${fmt.symbol}"` };
      return { code: fmt.symbol === "CHF" ? `"CHF "${body}` : `"${fmt.symbol}"${body}` };
    }
    case "date":
      if (fmt.style === "short") return { id: 14 };
      if (fmt.style === "iso") return { code: "yyyy-mm-dd" };
      return { code: locale === "de" ? "[$-407]d. mmmm yyyy" : "[$-409]mmmm d, yyyy" };
    case "time":
      // A duration's hours go on past 24 ([h]:mm, 36:00); a clock time's start again at 0 (12:00).
      if (fmt.duration) return fmt.seconds ? { id: 46 } : { code: "[h]:mm" };
      return { code: fmt.seconds ? "hh:mm:ss" : "hh:mm" };
    case "datetime":
      return { id: 22 };
  }
}

/**
 * Significant figures ride along as a named cell style ("Blob sig 3"): Excel and LibreOffice keep
 * a cell's named style, show the decimals written for the value as usual, and an import into Blob
 * turns the cell back into significant figures. (Never a made-up format code: Excel repairs or
 * refuses files with codes it doesn't know.)
 */
export const sigStyleName = (fmt: NumberFormat | undefined): string | undefined =>
  fmt?.kind === "significant" ? `Blob sig ${Math.max(1, Math.min(15, Math.round(fmt.digits)))}` : undefined;

/**
 * The significant figures a named style of the file stands for, kept when the cell still shows a
 * plain number (someone who gave it a date or percent format in Excel meant that).
 */
export function fromSigStyle(name: string | undefined, fmt: NumberFormat | undefined): NumberFormat | undefined {
  const m = /^Blob sig (\d{1,2})$/.exec(name ?? "");
  const digits = m ? Number(m[1]) : 0;
  if (digits < 1 || digits > 15 || (fmt && fmt.kind !== "number" && fmt.kind !== "scientific")) return fmt;
  return fmt?.unit ? { kind: "significant", digits, unit: fmt.unit } : { kind: "significant", digits };
}

/** The first section of a format code (positive numbers), split outside quotes and brackets. */
function firstSection(code: string): string {
  let inQuote = false;
  let bracket = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "\\" && !inQuote) {
      i++;
      continue;
    }
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && c === "[") bracket = true;
    else if (!inQuote && c === "]") bracket = false;
    else if (!inQuote && !bracket && c === ";") return code.slice(0, i);
  }
  return code;
}

/** A format code split into its placeholders (what Excel fills in) and its literal text. */
function splitCode(section: string): { pattern: string; text: string; currency: string | null; elapsed: boolean } {
  let pattern = "";
  let text = "";
  let currency: string | null = null;
  let elapsed = false;
  for (let i = 0; i < section.length; i++) {
    const c = section[i];
    if (c === '"') {
      const end = section.indexOf('"', i + 1);
      const lit = section.slice(i + 1, end < 0 ? section.length : end);
      text += lit;
      i = end < 0 ? section.length : end;
      continue;
    }
    if (c === "\\") {
      text += section[i + 1] ?? "";
      i++;
      continue;
    }
    if (c === "_" || c === "*") {
      // Space as wide as the next character, or that character repeated to fill: no text.
      i++;
      continue;
    }
    if (c === "[") {
      const end = section.indexOf("]", i + 1);
      const inner = section.slice(i + 1, end < 0 ? section.length : end);
      i = end < 0 ? section.length : end;
      if (/^\$/.test(inner)) {
        // [$€-407]: a currency symbol (or nothing) and a language.
        const sym = inner.slice(1).split("-")[0];
        if (sym) currency = sym;
      } else if (/^(h+|m+|s+)$/i.test(inner)) {
        elapsed = true;
        pattern += inner;
      }
      // Colours ([Red]) and conditions ([<100]) say nothing about the kind.
      continue;
    }
    if (/[0#?.,%Ee+\-/@yYmMdDhHsS:]/.test(c) || section.slice(i, i + 5).toUpperCase() === "AM/PM" || section.slice(i, i + 3).toUpperCase() === "A/P") {
      if (section.slice(i, i + 5).toUpperCase() === "AM/PM") {
        pattern += "AM/PM";
        i += 4;
        continue;
      }
      if ((c === "+" || c === "-") && !/[Ee]$/.test(pattern)) {
        text += c;
        continue;
      }
      pattern += c;
      continue;
    }
    if (c === "€" || c === "$" || c === "£") currency = currency ?? c;
    text += c;
  }
  return { pattern, text, currency, elapsed };
}

const SYMBOLS: Record<string, "€" | "$" | "£" | "CHF"> = { "€": "€", EUR: "€", $: "$", USD: "$", "£": "£", GBP: "£", CHF: "CHF", "SFr.": "CHF", Fr: "CHF", "Fr.": "CHF" };

/** Decimals after the point in a number pattern ("0.00" → 2). */
function decimalsOf(pattern: string): number {
  const dot = pattern.indexOf(".");
  if (dot < 0) return 0;
  const m = /^[0#?]+/.exec(pattern.slice(dot + 1));
  return m ? Math.min(15, m[0].length) : 0;
}

/** Excel's limit for one format code: a longer one (from a damaged or crafted file) is read as general. */
const MAX_CODE_LENGTH = 255;

/**
 * An Excel format code → Blob's format (undefined: general). Lossy where Blob has no equivalent:
 * fractions and thousands scaling read as general, any date as a date, any clock time as a time.
 */
export function fromExcelFormat(code: string, locale: Locale): NumberFormat | undefined {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > MAX_CODE_LENGTH || /^general$/i.test(trimmed)) return undefined;
  const section = firstSection(trimmed);
  if (/^general/i.test(section.trim())) return undefined;
  const { pattern, text, currency, elapsed } = splitCode(section);
  if (pattern.includes("@") && !/[0#?]/.test(pattern)) return { kind: "text" };
  const p = pattern.replace(/AM\/PM/gi, "");
  const hasDate = /[yd]/i.test(p);
  const hasClock = /[hs]/i.test(p) || elapsed || /AM\/PM/i.test(pattern);
  const hasMonth = /m/i.test(p);
  if (hasDate || hasClock || (hasMonth && !/[0#?]/.test(p))) {
    if (hasDate && hasClock) return { kind: "datetime" };
    // Elapsed time ([h]:mm, [mm]:ss): a duration, whose hours go on past 24.
    if (hasClock && !hasDate) return elapsed ? { kind: "time", seconds: /s/i.test(p), duration: true } : { kind: "time", seconds: /s/i.test(p) };
    if (/m{4}/i.test(p) || /d{3,}/i.test(p)) return { kind: "date", style: "long" };
    if (/^y{4}-m{1,2}-d{1,2}$/i.test(section.replace(/\[[^\]]*\]/g, "").trim())) return { kind: "date", style: "iso" };
    return { kind: "date", style: "short" };
  }
  if (!/[0#?]/.test(p)) return undefined;
  if (/\//.test(p)) return undefined;
  const intPart = p.split(".")[0];
  // "0," divides by a thousand: Blob can't, and showing the number unscaled would be wrong.
  if (/[0#?],+$/.test(intPart) && !p.includes(".")) return undefined;
  const decimals = decimalsOf(p);
  if (p.includes("%")) return { kind: "percent", decimals };
  if (/E[+-]/i.test(p)) {
    const unit = cleanUnit(text);
    return unit ? { kind: "scientific", decimals, unit } : { kind: "scientific", decimals };
  }
  const sym = currency ? (lookup(SYMBOLS, currency) ?? lookup(SYMBOLS, currency.toUpperCase())) : undefined;
  const textSym = Object.keys(SYMBOLS).find((s) => text.includes(s));
  if (sym || textSym) return { kind: "currency", decimals, symbol: sym ?? SYMBOLS[textSym!] };
  const group = /[0#?],[0#?]/.test(intPart);
  const unit = cleanUnit(text);
  const out: NumberFormat = { kind: "number", decimals };
  if (group) out.group = true;
  if (unit) out.unit = unit;
  void locale;
  return out;
}

/**
 * The format without a unit: a number with "mg/L" after it would reach Excel as text. For CSV and
 * for the text a copy puts on the clipboard.
 */
export function withoutUnit(fmt: NumberFormat | undefined): NumberFormat | undefined {
  if (!fmt) return fmt;
  if ((fmt.kind === "number" || fmt.kind === "scientific" || fmt.kind === "significant") && fmt.unit) return { ...fmt, unit: undefined };
  return fmt;
}

/** Literal text of a number format as a unit: brackets and signs Excel adds around negatives aren't one. */
function cleanUnit(text: string): string | undefined {
  const t = text.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  return t && /[\p{L}°µ%‰/²³]/u.test(t) ? t.slice(0, 24) : undefined;
}

/** Formats for the built-in ids that depend on the reader's language, and the fixed ones. */
export function builtinFormat(id: number, locale: Locale): NumberFormat | undefined {
  if (id === 14 || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return { kind: "date", style: "short" };
  if (id === 15 || id === 16 || id === 17) return { kind: "date", style: "short" };
  if (id === 22) return { kind: "datetime" };
  if (id >= 5 && id <= 8) return { kind: "currency", decimals: id >= 7 ? 2 : 0, symbol: locale === "de" ? "€" : "$" };
  if (id === 41 || id === 42) return id === 42 ? { kind: "currency", decimals: 0, symbol: locale === "de" ? "€" : "$" } : { kind: "number", decimals: 0, group: true };
  if (id === 43 || id === 44) return id === 44 ? { kind: "currency", decimals: 2, symbol: locale === "de" ? "€" : "$" } : { kind: "number", decimals: 2, group: true };
  const code = BUILTIN_CODES[id];
  return code ? fromExcelFormat(code, locale) : undefined;
}
