// Reading a typed value: "1,5", "1.234,5", "50 %", "12,50 €", "1,5E-3", "1.11.2026", "14:30",
// WAHR… → a number (with the format the typing implies) or true/false. Used for typing into a
// cell, VALUE(), text in arithmetic ("3" + 1) and criteria (">1,5").

import type { Locale } from "@/i18n/config";
import type { NumberFormat } from "../types";
import { daysInMonth, fullYear, monthFromName, serialFromYMD } from "./dates";
import type { DurationFormat } from "./format";

export type ParsedValue =
  | {
      kind: "number";
      value: number;
      fmt?: NumberFormat;
      /**
       * German typing, "1.234" (one group of three digits after a dot, no comma): read as 1234 like
       * Excel does, but 1,234 may have been meant; this is that other reading (see `thousandsHint`).
       */
      orDecimal?: { value: number; fmt?: NumberFormat };
    }
  | { kind: "bool"; value: boolean };

export type ParseValueOptions = {
  /** Accept WAHR/FALSCH (TRUE/FALSE in English): typing yes, arithmetic no ("TRUE" + 1 is #VALUE! in Excel). */
  bools?: boolean;
  /** For dates without a year ("1.11."): this year. */
  now?: () => Date;
  /** Accept a lab unit after the number ("12,5 mg/L" → 12,5 shown with its unit): typing only. */
  units?: boolean;
  /**
   * Typing only, German: no number starts with a lone 0 before a thousands group, so "0.123"
   * (or "-0.123", "0.123 mg/L") is the decimal 0,123, the way "1.5" is 1,5. VALUE() and
   * arithmetic keep reading "0.123" as 123.
   */
  zeroDecimal?: boolean;
  /**
   * Typing only, German: "1.234", "2.345 g" or "1.000 µL" stay 1234, 2345 and 1000 (the thousands
   * dot of German lab notation: "10.000 rpm"), but aren't shown with a thousands dot, so the cell
   * reads "1234", visibly not what was typed when 1,234 was meant, and the result carries
   * `orDecimal` for a one-click correction. A balance or photometer gives 1.234 with three decimals,
   * so silently showing it unchanged as 1234 would hide a factor of 1000.
   */
  thousandsHint?: boolean;
  /**
   * Typing only: the other language's decimal sign before an exponent is a decimal sign, as
   * calculators and instruments show such numbers ("1.5E-3", "2.4E6 Zellen/mL" in German, "1,5E-3"
   * in English): no number has a thousands separator right before its exponent. Without it the
   * cell would be text, and a replicate typed so would silently drop out of MITTELWERT. VALUE(),
   * arithmetic and criteria keep Excel's reading (text).
   */
  foreignExponent?: boolean;
};

/** "0.123" in German typing: a 0 (or 00…) before the dot can't be a thousands group. */
const zeroBeforeDot = (body: string, locale: Locale, opts?: ParseValueOptions) => !!opts?.zeroDecimal && locale === "de" && /^0+\.\d/.test(body);

/**
 * Units typed after a number that make it a number shown with that unit (instead of dead text,
 * as in Excel). Only these, so "3 Proben" or "2 Kolben" stay text. "%" isn't one: "50 %" is a
 * percentage. A 2 or 3 typed right after a unit is its power ("g/cm3" → g/cm³). Every unit
 * Blob's templates show is here, so what a template shows types back as the same number
 * (scripts/check-sheet-io.ts checks it).
 */
const LAB_UNITS = new Set([
  // concentration
  "mg/L", "mg/l", "g/L", "g/l", "µg/L", "µg/l", "ug/L", "µg/mL", "µg/ml", "ug/ml", "ng/mL", "ng/ml", "mg/mL", "mg/ml", "g/mL", "g/ml",
  "ng/µL", "ng/µl", "ng/uL", "ng/ul", "µg/µL", "µg/µl", "pg/µL", "pg/µl", "kg/L", "kg/l",
  "mol/L", "mol/l", "mmol/L", "mmol/l", "µmol/L", "µmol/l", "umol/l", "nmol/L", "nmol/l", "M", "mM", "µM", "uM", "nM", "pM",
  "mg/dL", "mg/dl", "g/dL", "g/dl", "U/L", "U/l", "U/mL", "U/ml", "U/µL", "U/µl", "U/uL", "U/ul", "U/mg", "IU/mL", "IU/ml",
  "Zellen/mL", "Zellen/ml", "cells/mL", "cells/ml", "KBE/mL", "KBE/ml", "CFU/mL", "CFU/ml",
  "ppm", "ppb", "ppt", "mg/kg", "µg/kg", "ug/kg", "g/kg", "mg/g", "µg/g",
  // a calibration line's slope: absorbance per concentration
  "L/mg", "l/mg", "mL/mg", "ml/mg", "L/g", "l/g", "mL/µg", "ml/µg",
  // molar mass, density, conductivity, molar energy, extinction coefficient
  "g/mol", "kg/mol", "g/cm³", "kg/m³", "kg/dm³", "µS/cm", "uS/cm", "mS/cm", "kJ/mol", "J/mol", "kcal/mol", "L/(mol·cm)", "l/(mol·cm)",
  // rates: flow, enzyme activity, growth
  "mL/min", "ml/min", "L/min", "l/min", "µL/min", "µl/min", "mL/h", "ml/h", "L/h", "l/h", "µmol/min", "nmol/min", "h⁻¹", "min⁻¹", "s⁻¹", "d⁻¹",
  "1/h", "1/min", "1/s", "1/d",
  // counts: a master mix's reactions
  "Ansätze", "Ansatz", "reactions", "reaction",
  // mass, amount, volume, length, area
  "kg", "g", "mg", "µg", "ug", "ng", "pg", "mol", "mmol", "µmol", "umol", "nmol", "pmol", "Da", "kDa",
  "L", "l", "mL", "ml", "µL", "µl", "uL", "ul", "dL", "dl", "nL", "nl", "m³", "dm³", "cm³", "mm³",
  "m", "cm", "mm", "µm", "um", "nm", "bp", "kb", "m²", "cm²", "mm²", "µm²",
  // time, temperature, pressure, speed, energy, electricity, angle, optical density
  "s", "sec", "min", "h", "d", "ms", "°C", "°F", "K", "Pa", "hPa", "kPa", "bar", "mbar", "atm", "rpm", "rcf", "U/min", "xg", "×g", "x g", "× g", "J", "kJ", "cal", "kcal", "V", "mV", "A", "mA", "°", "OD",
]);

const SPACES = "   ";

/**
 * The text without spaces (no-break ones too) at its end. By hand on purpose: a RegExp such as
 * ^(.*?) *%$ takes quadratic time on a long run of spaces (a pasted or imported cell can be
 * 32,767 characters long).
 */
function trimSpacesEnd(s: string): string {
  let end = s.length;
  while (end > 0 && SPACES.includes(s[end - 1])) end--;
  return s.slice(0, end);
}

function trimSpacesStart(s: string): string {
  let start = 0;
  while (start < s.length && SPACES.includes(s[start])) start++;
  return s.slice(start);
}

type Currency = "€" | "$" | "£" | "CHF";
/** How a currency may be written before or after the number (any case): "12,50 €", "12,50 EUR", "$12.50", "CHF 12.50". */
const CURRENCIES: { text: string; symbol: Currency }[] = [
  { text: "EUR", symbol: "€" },
  { text: "CHF", symbol: "CHF" },
  { text: "€", symbol: "€" },
  { text: "$", symbol: "$" },
  { text: "£", symbol: "£" },
];

/** A currency at the end ("12,50 €") or the start ("€ 12,50") of a text with a digit beside it: the symbol and the rest. */
function currencyIn(s: string): { symbol: Currency; rest: string; before: boolean } | null {
  for (const c of CURRENCIES) {
    if (s.slice(-c.text.length).toUpperCase() === c.text) {
      const rest = trimSpacesEnd(s.slice(0, s.length - c.text.length));
      if (/\d/.test(rest)) return { symbol: c.symbol, rest, before: false };
    }
  }
  for (const c of CURRENCIES) {
    if (s.slice(0, c.text.length).toUpperCase() === c.text) {
      const rest = trimSpacesStart(s.slice(c.text.length));
      if (/\d/.test(rest)) return { symbol: c.symbol, rest, before: true };
    }
  }
  return null;
}

/** Parse a plain number body (no sign) in the locale's style; null when it isn't one. */
function parseNumberBody(body: string, locale: Locale, opts?: ParseValueOptions): { value: number; decimals: number; group: boolean; exp: boolean } | null {
  // Exponent: 1,5E-3 / 1.5e3 (no thousands separators then), typed also 1.5E-3 / 1,5e3 (foreignExponent).
  const expMatch =
    (locale === "de" ? /^(\d+(?:,\d*)?|,\d+)[eE]([+-]?\d+)$/.exec(body) : /^(\d+(?:\.\d*)?|\.\d+)[eE]([+-]?\d+)$/.exec(body)) ??
    (opts?.foreignExponent ? (locale === "de" ? /^(\d+\.\d+)[eE]([+-]?\d+)$/ : /^(\d+,\d+)[eE]([+-]?\d+)$/).exec(body) : null);
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
  if (grouped && !zeroBeforeDot(body, locale, opts)) {
    const int = grouped[1].split(grp).join("");
    const frac = grouped[2] ?? "";
    return { value: Number(`${int}.${frac || "0"}`), decimals: frac.length, group: true, exp: false };
  }
  return null;
}

/** A forgiving second try: the other language's decimal point ("1.5" in German, "1,5" in English) when it can't be thousands. */
function parseForeignDecimal(body: string, locale: Locale, opts?: ParseValueOptions): number | null {
  const re = locale === "de" ? /^(\d+)\.(\d+)$/ : /^(\d+),(\d+)$/;
  const m = re.exec(body);
  if (!m || (m[2].length === 3 && !zeroBeforeDot(body, locale, opts))) return null;
  return Number(`${m[1]}.${m[2]}`);
}

/** Digits after the decimal separator of a plain "1.25" / "1,25". */
const fractionDigits = (body: string) => {
  const i = body.search(/[.,]/);
  return i < 0 ? 0 : body.length - i - 1;
};

function validDate(y: number, m: number, d: number): number | null {
  // The serial numbers start at 30.12.1899 (0) and 31.12.1899 (1): those two read back too, so a
  // date cell holding 0 or 1 can be edited without turning into text.
  if (y === 1899 && m === 12 && (d === 30 || d === 31)) return serialFromYMD(y, m, d);
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 9999) return null;
  if (d > daysInMonth(y, m)) return null;
  return serialFromYMD(y, m, d);
}

/** The most hours a typed time may have ("9999:59"); longer durations are edited as plain numbers. */
export const MAX_TYPED_HOURS = 9999;

/** "14:30", "14:30:15", "2:30 PM" → fraction of a day (hours may exceed 24: "36:00" = 1,5). */
function parseTime(text: string): { value: number; seconds: boolean; hours: number } | null {
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
  return { value: (h * 3600 + mi * 60 + s) / 86400, seconds: m[3] !== undefined, hours: h };
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
  let currency: Currency | null = null;
  if (rest.endsWith("%")) {
    percent = true;
    rest = trimSpacesEnd(rest.slice(0, -1));
  } else {
    const c = currencyIn(rest);
    if (c) {
      currency = c.symbol;
      rest = c.rest;
      if (c.before && /^[-−]/.test(rest) && sign === 1) {
        sign = -1;
        rest = rest.slice(1);
      }
    }
  }

  // A lab unit after the number: "12,5 mg/L", "37 °C", "100µl", "1,02 g/cm3" (g/cm³). The power
  // follows the unit directly: "10 cm 3" stays text. A rate per time ("0,693 1/h") starts with a
  // digit, so it needs a space before it.
  let unit: string | null = null;
  if (opts?.units && !percent && !currency) {
    const um = /^([0-9.,]+(?:[eE][+-]?[0-9]+)?)(?:\s*([^\s0-9.,+\-][^0-9]*?)|\s+(1\/[^\s0-9][^0-9]*?))((?<!\s)[23])?$/.exec(rest);
    const name = um ? (um[2] ?? um[3]).trim() + (um[4] === "2" ? "²" : um[4] === "3" ? "³" : "") : "";
    if (um && LAB_UNITS.has(name)) {
      unit = name;
      rest = um[1];
    }
  }

  const num = parseNumberBody(rest, locale, opts);
  // German "1.234": one group of three digits after a dot and nothing else (see thousandsHint).
  // Money keeps its thousands dot: "1.234 €" never means 1,234 €.
  const ambiguous = !!num?.group && !!opts?.thousandsHint && locale === "de" && !currency && /^\d{1,3}\.\d{3}$/.test(rest);
  const decimal = sign * Number(rest);
  if (num && unit) {
    const value = sign * num.value;
    if (!Number.isFinite(value)) return null;
    if (num.exp) return { kind: "number", value, fmt: { kind: "scientific", decimals: Math.max(2, num.decimals), unit } };
    if (ambiguous) return { kind: "number", value, fmt: { kind: "number", decimals: 0, unit }, orDecimal: { value: decimal, fmt: { kind: "number", decimals: 3, unit } } };
    return { kind: "number", value, fmt: { kind: "number", decimals: num.decimals, group: num.group || undefined, unit } };
  }
  if (unit) {
    // "1.5 mg/L" in German: the forgiving decimal point works with a unit too, as it does without one.
    const foreign = parseForeignDecimal(rest, locale, opts);
    if (foreign !== null) return { kind: "number", value: sign * foreign, fmt: { kind: "number", decimals: fractionDigits(rest), unit } };
  }
  if (num) {
    const value = sign * num.value;
    if (!Number.isFinite(value)) return null;
    if (percent) {
      const fmt: NumberFormat = { kind: "percent", decimals: num.decimals };
      if (ambiguous) return { kind: "number", value: value / 100, fmt, orDecimal: { value: decimal / 100, fmt: { kind: "percent", decimals: 3 } } };
      return { kind: "number", value: value / 100, fmt };
    }
    if (currency) return { kind: "number", value, fmt: { kind: "currency", decimals: num.decimals > 0 ? Math.max(2, num.decimals) : 0, symbol: currency } };
    if (num.exp) return { kind: "number", value, fmt: { kind: "scientific", decimals: Math.max(2, num.decimals) } };
    if (ambiguous) return { kind: "number", value, orDecimal: { value: decimal } };
    if (num.group) return { kind: "number", value, fmt: { kind: "number", decimals: num.decimals, group: true } };
    return { kind: "number", value };
  }
  if (percent || currency || sign === -1 || text.startsWith("+")) {
    // "-1.5" in German is a number too (dates have no sign).
    const foreign = parseForeignDecimal(rest, locale, opts);
    if (foreign !== null) {
      const value = sign * foreign;
      if (percent) return { kind: "number", value: value / 100, fmt: { kind: "percent", decimals: fractionDigits(rest) } };
      if (currency) return { kind: "number", value, fmt: { kind: "currency", decimals: 2, symbol: currency } };
      return { kind: "number", value };
    }
    // A time below zero can only be a duration ("-16:00", an overnight run's Ende − Start, as it is
    // shown and exported): read back as the negative duration it was.
    if (sign === -1 && !percent && !currency && !/[AaPp]/.test(rest)) {
      const t = parseTime(rest);
      if (t) return { kind: "number", value: -t.value, fmt: { kind: "time", seconds: t.seconds, duration: true } };
    }
    return null;
  }

  // Times and dates (no sign, no symbols).
  const time = parseTime(text);
  if (time) {
    // 24 hours or more is a duration (an incubation, a growth curve over days): it shows as 36:00
    // and edits as 36:00, like Excel's [h]:mm, instead of the clock time 12:00.
    if (time.hours >= 24) {
      const fmt: DurationFormat = { kind: "time", seconds: time.seconds, duration: true };
      return { kind: "number", value: time.value, fmt };
    }
    return { kind: "number", value: time.value, fmt: { kind: "time", seconds: time.seconds } };
  }
  const date = parseDate(text, locale, opts);
  if (date) return { kind: "number", value: date.value, fmt: date.fmt };

  const foreign = parseForeignDecimal(text, locale, opts);
  if (foreign !== null) return { kind: "number", value: foreign };
  return null;
}

/** Text in arithmetic and VALUE(): numbers, percentages, currency, dates and times, never true/false. */
export function textToNumber(text: string, locale: Locale): number | null {
  const p = parseValueText(text, locale);
  return p && p.kind === "number" ? p.value : null;
}
