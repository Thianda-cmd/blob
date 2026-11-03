// Reading a typed value: "1,5", "1.234,5", "50 %", "12,50 €", "1,5E-3", "1.11.2026", "14:30",
// WAHR… → a number (with the format the typing implies) or true/false. Used for typing into a
// cell, VALUE(), text in arithmetic ("3" + 1) and criteria (">1,5").

import type { Locale } from "@/i18n/config";
import type { NumberFormat } from "../types";
import { daysInMonth, fullYear, monthFromName, serialFromYMD } from "./dates";

export type ParsedValue = { kind: "number"; value: number; fmt?: NumberFormat } | { kind: "bool"; value: boolean };

export type ParseValueOptions = {
  /** Accept WAHR/FALSCH (TRUE/FALSE in English): typing yes, arithmetic no ("TRUE" + 1 is #VALUE! in Excel). */
  bools?: boolean;
  /** For dates without a year ("1.11."): this year. */
  now?: () => Date;
  /** Accept a lab unit after the number ("12,5 mg/L" → 12,5 shown with its unit): typing only. */
  units?: boolean;
};

/**
 * Units typed after a number that make it a number shown with that unit (instead of dead text,
 * as in Excel). Only these, so "3 Proben" stays text.
 */
const LAB_UNITS = new Set([
  // concentration
  "mg/L", "mg/l", "g/L", "g/l", "µg/L", "µg/l", "ug/L", "µg/mL", "µg/ml", "ug/ml", "ng/mL", "ng/ml", "mg/mL", "mg/ml", "g/mL", "g/ml",
  "mol/L", "mol/l", "mmol/L", "mmol/l", "µmol/L", "µmol/l", "umol/l", "nmol/L", "nmol/l", "M", "mM", "µM", "uM", "nM", "pM",
  "mg/dL", "mg/dl", "g/dL", "g/dl", "U/L", "U/l", "U/mL", "U/ml", "IU/mL", "IU/ml", "Zellen/mL", "Zellen/ml", "cells/mL", "cells/ml", "KBE/mL", "KBE/ml", "CFU/mL", "CFU/ml",
  // mass, amount, volume, length
  "kg", "g", "mg", "µg", "ug", "ng", "pg", "mol", "mmol", "µmol", "umol", "nmol", "pmol", "Da", "kDa",
  "L", "l", "mL", "ml", "µL", "µl", "uL", "ul", "dL", "dl", "nL", "nl",
  "m", "cm", "mm", "µm", "um", "nm", "bp", "kb",
  // time, temperature, pressure, speed, energy
  "s", "sec", "min", "h", "d", "ms", "°C", "°F", "K", "Pa", "hPa", "kPa", "bar", "mbar", "atm", "rpm", "U/min", "xg", "×g", "x g", "× g", "J", "kJ", "cal", "kcal", "V", "mV", "A", "mA",
]);

const SPACE = "[ \\u00A0\\u202F]";
const CURRENCIES: { re: RegExp; symbol: "€" | "$" | "£" | "CHF" }[] = [
  { re: /^(?:€|EUR)$/i, symbol: "€" },
  { re: /^\$$/, symbol: "$" },
  { re: /^£$/, symbol: "£" },
  { re: /^CHF$/i, symbol: "CHF" },
];
const currencySymbol = (s: string) => CURRENCIES.find((c) => c.re.test(s))?.symbol ?? null;

/** Parse a plain number body (no sign) in the locale's style; null when it isn't one. */
function parseNumberBody(body: string, locale: Locale): { value: number; decimals: number; group: boolean; exp: boolean } | null {
  // Exponent: 1,5E-3 / 1.5e3 (no thousands separators then).
  const expMatch = locale === "de" ? /^(\d+(?:,\d*)?|,\d+)[eE]([+-]?\d+)$/.exec(body) : /^(\d+(?:\.\d*)?|\.\d+)[eE]([+-]?\d+)$/.exec(body);
  if (expMatch) {
    const mant = expMatch[1].replace(",", ".");
    const dec = mant.includes(".") ? mant.length - mant.indexOf(".") - 1 : 0;
    return { value: Number(`${mant}e${expMatch[2]}`), decimals: dec, group: false, exp: true };
  }
  const dec = locale === "de" ? "," : ".";
  const grp = locale === "de" ? "." : ",";
  const esc = (c: string) => (c === "." ? "\\." : c);
  const plain = new RegExp(`^(\\d+)(?:${esc(dec)}(\\d*))?$|^${esc(dec)}(\\d+)$`).exec(body);
  if (plain) {
    const int = plain[1] ?? "0";
    const frac = plain[2] ?? plain[3] ?? "";
    return { value: Number(`${int}.${frac || "0"}`), decimals: frac.length, group: false, exp: false };
  }
  const grouped = new RegExp(`^(\\d{1,3}(?:${esc(grp)}\\d{3})+)(?:${esc(dec)}(\\d*))?$`).exec(body);
  if (grouped) {
    const int = grouped[1].split(grp).join("");
    const frac = grouped[2] ?? "";
    return { value: Number(`${int}.${frac || "0"}`), decimals: frac.length, group: true, exp: false };
  }
  return null;
}

/** A forgiving second try: the other language's decimal point ("1.5" in German, "1,5" in English) when it can't be thousands. */
function parseForeignDecimal(body: string, locale: Locale): number | null {
  const re = locale === "de" ? /^(\d+)\.(\d+)$/ : /^(\d+),(\d+)$/;
  const m = re.exec(body);
  if (!m || m[2].length === 3) return null;
  return Number(`${m[1]}.${m[2]}`);
}

function validDate(y: number, m: number, d: number): number | null {
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 9999) return null;
  if (d > daysInMonth(y, m)) return null;
  return serialFromYMD(y, m, d);
}

/** "14:30", "14:30:15", "2:30 PM" → fraction of a day (hours may exceed 24: "36:00" = 1,5). */
function parseTime(text: string): { value: number; seconds: boolean } | null {
  const m = /^(\d{1,4}):(\d{1,2})(?::(\d{1,2})(?:[.,](\d+))?)?(?:\s*([AaPp])\.?[Mm]\.?)?$/.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const s = m[3] ? Number(m[3]) + (m[4] ? Number(`0.${m[4]}`) : 0) : 0;
  if (mi >= 60 || s >= 60) return null;
  if (m[5]) {
    if (h < 1 || h > 12) return null;
    const pm = m[5].toLowerCase() === "p";
    h = (h % 12) + (pm ? 12 : 0);
  }
  return { value: (h * 3600 + mi * 60 + s) / 86400, seconds: m[3] !== undefined };
}

function thisYear(opts?: ParseValueOptions): number {
  return (opts?.now ? opts.now() : new Date()).getFullYear();
}

/** A date (with an optional time after a space): returns the serial number and its format. */
function parseDate(text: string, locale: Locale, opts?: ParseValueOptions): { value: number; fmt: NumberFormat } | null {
  let datePart = text;
  let time: { value: number; seconds: boolean } | null = null;
  const sp = /^(\S+(?:\s+\S+){0,2}?)(?:\s+|T)(\d{1,2}:\d{1,2}(?::\d{1,2})?(?:\s*[AaPp]\.?[Mm]\.?)?)$/.exec(text);
  if (sp) {
    time = parseTime(sp[2]);
    if (!time) return null;
    datePart = sp[1];
  }
  let serial: number | null = null;
  let style: "short" | "long" | "iso" = "short";

  // ISO 2026-11-01 in both languages.
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  if (m) {
    serial = validDate(Number(m[1]), Number(m[2]), Number(m[3]));
    style = "iso";
  }
  // 1.11.2026, 1.11.26 and 1.11. (this year). Without the final dot, "1.5" stays a number (1,5):
  // Excel would make it 1 May, a classic trap for measured values.
  if (serial === null && (m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})?$/.exec(datePart))) {
    const y = m[3] ? fullYear(Number(m[3]), m[3].length) : thisYear(opts);
    serial = validDate(y, Number(m[2]), Number(m[1]));
  }
  // Slashes: 11/1/2026 (month first) in English, 1/11/2026 (day first) in German.
  if (serial === null && (m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(datePart))) {
    const y = m[3] ? fullYear(Number(m[3]), m[3].length) : thisYear(opts);
    const a = Number(m[1]);
    const b = Number(m[2]);
    serial = locale === "de" ? validDate(y, b, a) : validDate(y, a, b);
  }
  // Month names: "1. November 2026", "1. Nov. 2026", "1 Nov 2026", "November 1, 2026", "Nov 1".
  if (serial === null && (m = /^(\d{1,2})\.?\s*([A-Za-zÄÖÜäöü]{3,}\.?)\s*(\d{4}|\d{2})?$/.exec(datePart))) {
    const month = monthFromName(m[2]);
    if (month) {
      const y = m[3] ? fullYear(Number(m[3]), m[3].length) : thisYear(opts);
      serial = validDate(y, month, Number(m[1]));
      style = "long";
    }
  }
  if (serial === null && (m = /^([A-Za-zÄÖÜäöü]{3,}\.?)\s+(\d{1,2}),?\s*(\d{4}|\d{2})?$/.exec(datePart))) {
    const month = monthFromName(m[1]);
    if (month) {
      const y = m[3] ? fullYear(Number(m[3]), m[3].length) : thisYear(opts);
      serial = validDate(y, month, Number(m[2]));
      style = "long";
    }
  }
  if (serial === null) return null;
  if (time) return { value: serial + time.value, fmt: { kind: "datetime" } };
  return { value: serial, fmt: { kind: "date", style } };
}

/**
 * Typed text → a number or true/false, in the locale's style; null when it is text.
 * German: "1,5", "1.234,5", "-1,5", "1,5E-3", "50 %", "12,50 €", "1.11.2026", "1.11.", "14:30", WAHR.
 * English: "1.5", "1,234.5", "50%", "€12.50", "11/1/2026", "2:30 PM", TRUE.
 */
export function parseValueText(input: string, locale: Locale, opts?: ParseValueOptions): ParsedValue | null {
  const text = input.trim();
  if (!text) return null;

  if (opts?.bools) {
    const up = text.toUpperCase();
    if (locale === "de" ? up === "WAHR" : up === "TRUE") return { kind: "bool", value: true };
    if (locale === "de" ? up === "FALSCH" : up === "FALSE") return { kind: "bool", value: false };
  }

  // Sign, then percent or currency around the number.
  let rest = text;
  let sign = 1;
  if (/^[-+−]/.test(rest)) {
    sign = rest[0] === "+" ? 1 : -1;
    rest = rest.slice(1).trimStart();
  }

  let percent = false;
  let currency: "€" | "$" | "£" | "CHF" | null = null;
  let m = new RegExp(`^(.*?)${SPACE}*%$`).exec(rest);
  if (m) {
    percent = true;
    rest = m[1];
  } else if ((m = new RegExp(`^(.*?)${SPACE}*(€|EUR|\\$|£|CHF)$`, "i").exec(rest)) && /\d/.test(m[1])) {
    currency = currencySymbol(m[2]);
    rest = m[1];
  } else if ((m = new RegExp(`^(€|EUR|\\$|£|CHF)${SPACE}*(.*)$`, "i").exec(rest)) && /\d/.test(m[2])) {
    currency = currencySymbol(m[1]);
    rest = m[2];
    if (/^[-−]/.test(rest) && sign === 1) {
      sign = -1;
      rest = rest.slice(1);
    }
  }

  // A lab unit after the number: "12,5 mg/L", "37 °C", "100µl".
  let unit: string | null = null;
  if (opts?.units && !percent && !currency) {
    const um = /^([0-9.,]+(?:[eE][+-]?[0-9]+)?)\s*([^\s0-9.,+\-][^0-9]*)$/.exec(rest);
    if (um && LAB_UNITS.has(um[2].trim())) {
      unit = um[2].trim();
      rest = um[1];
    }
  }

  const num = parseNumberBody(rest, locale);
  if (num && unit) {
    const value = sign * num.value;
    if (!Number.isFinite(value)) return null;
    if (num.exp) return { kind: "number", value, fmt: { kind: "scientific", decimals: Math.max(2, num.decimals), unit } };
    return { kind: "number", value, fmt: { kind: "number", decimals: num.decimals, group: num.group || undefined, unit } };
  }
  if (num) {
    const value = sign * num.value;
    if (!Number.isFinite(value)) return null;
    if (percent) return { kind: "number", value: value / 100, fmt: { kind: "percent", decimals: num.decimals } };
    if (currency) return { kind: "number", value, fmt: { kind: "currency", decimals: num.decimals > 0 ? Math.max(2, num.decimals) : 0, symbol: currency } };
    if (num.exp) return { kind: "number", value, fmt: { kind: "scientific", decimals: Math.max(2, num.decimals) } };
    if (num.group) return { kind: "number", value, fmt: { kind: "number", decimals: num.decimals, group: true } };
    return { kind: "number", value };
  }
  if (percent || currency || sign === -1 || text.startsWith("+")) {
    // "-1.5" in German is a number too (dates have no sign).
    const foreign = parseForeignDecimal(rest, locale);
    if (foreign !== null) {
      const value = sign * foreign;
      if (percent) return { kind: "number", value: value / 100, fmt: { kind: "percent", decimals: rest.length - rest.search(/[.,]/) - 1 } };
      if (currency) return { kind: "number", value, fmt: { kind: "currency", decimals: 2, symbol: currency } };
      return { kind: "number", value };
    }
    return null;
  }

  // Times and dates (no sign, no symbols).
  const time = parseTime(text);
  if (time) return { kind: "number", value: time.value, fmt: { kind: "time", seconds: time.seconds } };
  const date = parseDate(text, locale, opts);
  if (date) return { kind: "number", value: date.value, fmt: date.fmt };

  const foreign = parseForeignDecimal(text, locale);
  if (foreign !== null) return { kind: "number", value: foreign };
  return null;
}

/** Text in arithmetic and VALUE(): numbers, percentages, currency, dates and times, never true/false. */
export function textToNumber(text: string, locale: Locale): number | null {
  const p = parseValueText(text, locale);
  return p && p.kind === "number" ? p.value : null;
}
