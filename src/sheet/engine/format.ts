// Showing values: the text a cell shows for its value and number format, like Excel in the
// user's language (German: 1.234,5 / 01.11.2026; English: 1,234.5 / 11/1/2026), and the format
// codes of TEXT(Wert; "0,00") / TEXT(value, "dd.mm.yyyy").
//
// Rounding for display works on the number's 15 significant digits as decimal text, like Excel,
// so 1,005 with two decimals shows 1,01 (not 1,00 as binary floating point would give).

import type { Locale } from "@/i18n/config";
import type { NumberFormat } from "../types";
import { clockTime, durationText, isoDate, longDate, MAX_SERIAL, MONTHS, MONTHS_SHORT, shortDate, timeOfSerial, WEEKDAYS, WEEKDAYS_SHORT, weekdayOf, ymdFromSerial } from "./dates";
import { boolText, errorText, isError, type CellValue, type CellError, ERR } from "./values";

/**
 * A time format for durations ("Dauer"): the hours go on past 24, like Excel's [h]:mm, so 1,5 days
 * shows 36:00 instead of the clock time 12:00. Typing "36:00" gives it.
 */
export type DurationFormat = { kind: "time"; seconds: boolean; duration: true };

/** Is this a duration format (36:00) rather than a clock time (12:00)? */
export const isDuration = (fmt: NumberFormat | undefined): boolean => fmt?.kind === "time" && "duration" in fmt && fmt.duration === true;

/** Narrow no-break space between a number and its unit ("12,5 mg/L"). */
export const UNIT_SPACE = " ";
const NBSP = " ";

const decSep = (locale: Locale) => (locale === "de" ? "," : ".");
const groupSep = (locale: Locale) => (locale === "de" ? "." : ",");

// ----------------------------------------------------------------------------------------------
// Decimal digits

/** |n| as decimal digits from its 15 significant digits: n = 0.<d> × 10^e (d without leading or trailing zeros). */
export function digitsOf(abs: number): { d: string; e: number } {
  if (abs === 0) return { d: "", e: 0 };
  const s = abs.toPrecision(15);
  const ei = s.indexOf("e");
  const mant = ei < 0 ? s : s.slice(0, ei);
  const exp10 = ei < 0 ? 0 : Number(s.slice(ei + 1));
  const dot = mant.indexOf(".");
  const intPart = dot < 0 ? mant : mant.slice(0, dot);
  const fracPart = dot < 0 ? "" : mant.slice(dot + 1);
  let all = intPart + fracPart;
  let e = intPart.length + exp10;
  // Leading zeros ("0.00123" → "000123", e 1) move the point.
  let lead = 0;
  while (lead < all.length && all.charCodeAt(lead) === 48) lead++;
  all = all.slice(lead);
  e -= lead;
  all = all.replace(/0+$/, "");
  return { d: all, e };
}

function incrementDigits(digits: string): string {
  const arr = digits.split("");
  let i = arr.length - 1;
  while (i >= 0) {
    if (arr[i] === "9") {
      arr[i] = "0";
      i--;
    } else {
      arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1);
      return arr.join("");
    }
  }
  return "1" + arr.join("");
}

/** |n| rounded half away from zero to `decimals` places, as integer and fraction digits. */
export function fixedParts(abs: number, decimals: number): { int: string; frac: string } {
  if (abs === 0) return { int: "0", frac: "0".repeat(decimals) };
  const { d, e } = digitsOf(abs);
  const keep = e + decimals;
  if (keep < 0) return { int: "0", frac: "0".repeat(decimals) };
  let digits: string;
  let ee = e;
  if (keep >= d.length) digits = d + "0".repeat(keep - d.length);
  else {
    digits = d.slice(0, keep);
    if (d.charCodeAt(keep) >= 53) {
      const inc = incrementDigits(digits);
      if (inc.length > digits.length) ee += 1;
      digits = inc;
    }
  }
  if (ee <= 0) return { int: "0", frac: ("0".repeat(-ee) + digits).slice(0, decimals).padEnd(decimals, "0") };
  return { int: digits.slice(0, ee) || "0", frac: digits.slice(ee) };
}

function group(int: string, sep: string): string {
  let out = "";
  for (let i = 0; i < int.length; i++) {
    if (i > 0 && (int.length - i) % 3 === 0) out += sep;
    out += int[i];
  }
  return out;
}

/** n with fixed decimals in the locale's style: 1234.5, 2 → "1.234,50" (grouped) / "1234,50". */
export function formatFixed(n: number, decimals: number, locale: Locale, grouped = false): string {
  const { int, frac } = fixedParts(Math.abs(n), Math.max(0, decimals));
  const zero = /^0*$/.test(int) && /^0*$/.test(frac);
  const body = (grouped ? group(int, groupSep(locale)) : int) + (decimals > 0 ? decSep(locale) + frac : "");
  return n < 0 && !zero ? `-${body}` : body;
}

/** Mantissa and exponent with `decimals` decimals: 0.0000123, 2 → "1,23E-05". */
export function formatScientific(n: number, decimals: number, locale: Locale, trimZeros = false): string {
  if (n === 0) return (trimZeros ? "0" : "0" + (decimals > 0 ? decSep(locale) + "0".repeat(decimals) : "")) + "E+00";
  const { d, e } = digitsOf(Math.abs(n));
  let exp = e - 1;
  const keep = 1 + decimals;
  let digits = d.length >= keep ? d.slice(0, keep) : d + "0".repeat(keep - d.length);
  if (d.length > keep && d.charCodeAt(keep) >= 53) {
    const inc = incrementDigits(digits);
    if (inc.length > digits.length) {
      exp += 1;
      digits = inc.slice(0, keep);
    } else digits = inc;
  }
  let frac = digits.slice(1);
  if (trimZeros) frac = frac.replace(/0+$/, "");
  const mant = digits[0] + (frac ? decSep(locale) + frac : "");
  return `${n < 0 ? "-" : ""}${mant}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
}

/**
 * Excel's "General" in a normal-width column: up to 11 characters, so about 10 significant digits,
 * no trailing zeros, no thousands separators; scientific for very large or very small numbers.
 */
export function formatGeneral(n: number, locale: Locale): string {
  if (n === 0 || !Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  // 1,23457E+11 / 1,2345E-05 (5 decimals at most, trailing zeros dropped).
  if (abs >= 1e11 || abs < 1e-4) return formatScientific(n, 5, locale, true);
  const { e } = digitsOf(abs);
  const decimals = Math.max(0, 10 - Math.max(1, e));
  const { int, frac } = fixedParts(abs, decimals);
  const f = frac.replace(/0+$/, "");
  return `${n < 0 ? "-" : ""}${int}${f ? decSep(locale) + f : ""}`;
}

/** Significant figures: 3 → 0,00123 / 12,3 / 12,0 / 1230; scientific below 0,0001 or from 1 000 000. */
export function formatSignificant(n: number, digits: number, locale: Locale): string {
  const sig = Math.min(15, Math.max(1, Math.round(digits)));
  if (n === 0) return sig > 1 ? `0${decSep(locale)}${"0".repeat(sig - 1)}` : "0";
  const abs = Math.abs(n);
  // Round to `sig` digits first: the exponent may change (9,996 → 10,0).
  const { d, e } = digitsOf(abs);
  let digitsStr = d.length >= sig ? d.slice(0, sig) : d + "0".repeat(sig - d.length);
  let ee = e;
  if (d.length > sig && d.charCodeAt(sig) >= 53) {
    const inc = incrementDigits(digitsStr);
    if (inc.length > digitsStr.length) {
      ee += 1;
      digitsStr = inc.slice(0, sig);
    } else digitsStr = inc;
  }
  const exp = ee - 1;
  if (exp >= 6 || exp < -4) return formatScientific(n, sig - 1, locale);
  const decimals = Math.max(0, sig - ee);
  const rounded = Number(`0.${digitsStr}e${ee}`);
  return formatFixed(n < 0 ? -rounded : rounded, decimals, locale);
}

function currency(n: number, decimals: number, symbol: "€" | "$" | "£" | "CHF", locale: Locale): string {
  const body = formatFixed(Math.abs(n), decimals, locale, true);
  const neg = n < 0 && /[1-9]/.test(body) ? "-" : "";
  if (locale === "de") return `${neg}${body}${NBSP}${symbol}`;
  return symbol === "CHF" ? `${neg}CHF${NBSP}${body}` : `${neg}${symbol}${body}`;
}

const withUnit = (s: string, unit: string | undefined) => (unit && unit.trim() ? `${s}${UNIT_SPACE}${unit.trim()}` : s);

/** The text a cell shows for a value with its format (no format: "general", like Excel). */
export function formatValue(value: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  if (value === null || value === undefined) return "";
  if (isError(value)) return errorText(value.error, locale);
  if (typeof value === "boolean") return boolText(value, locale);
  if (typeof value === "string") return value;
  return formatNumber(value, fmt, locale);
}

export function formatNumber(n: number, fmt: NumberFormat | undefined, locale: Locale): string {
  if (!Number.isFinite(n)) return errorText("#NUM!", locale);
  if (!fmt) return formatGeneral(n, locale);
  switch (fmt.kind) {
    case "general":
    case "text":
      return formatGeneral(n, locale);
    case "number":
      return withUnit(formatFixed(n, clampDecimals(fmt.decimals), locale, !!fmt.group), fmt.unit);
    case "percent":
      return `${formatFixed(n * 100, clampDecimals(fmt.decimals), locale)}%`;
    case "scientific":
      return withUnit(formatScientific(n, clampDecimals(fmt.decimals), locale), fmt.unit);
    case "significant":
      return withUnit(formatSignificant(n, fmt.digits, locale), fmt.unit);
    case "currency":
      return currency(n, clampDecimals(fmt.decimals), fmt.symbol, locale);
    case "date":
      if (n < 0 || n >= MAX_SERIAL + 1) return formatGeneral(n, locale);
      return fmt.style === "long" ? longDate(n, locale) : fmt.style === "iso" ? isoDate(n) : shortDate(n, locale);
    case "time":
      if (n < 0) return formatGeneral(n, locale);
      return isDuration(fmt) ? durationText(n, fmt.seconds) : clockTime(n, fmt.seconds);
    case "datetime": {
      if (n < 0 || n >= MAX_SERIAL + 1) return formatGeneral(n, locale);
      const t = timeOfSerial(n);
      const day = Math.floor(n) + t.carry;
      return `${shortDate(day, locale)} ${clockTime(day + (t.h * 3600 + t.mi * 60 + t.s) / 86400, false)}`;
    }
  }
  return formatGeneral(n, locale);
}

const clampDecimals = (d: number) => Math.min(15, Math.max(0, Math.round(Number.isFinite(d) ? d : 0)));

// ----------------------------------------------------------------------------------------------
// Excel format codes (TEXT, and anything else that wants them)

type Section = { tokens: FmtTok[]; kind: "number" | "date" | "text" | "general"; hasPercent: number; neg: boolean };
type FmtTok =
  | { t: "lit"; s: string }
  | { t: "digit"; c: "0" | "#" | "?" }
  | { t: "dec" }
  | { t: "group" }
  | { t: "pct" }
  | { t: "exp"; sign: "+" | "-"; digits: number }
  | { t: "text" }
  | { t: "date"; code: string };

/** Split a format into sections at ";" (not inside quotes, brackets or after a backslash). */
function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') {
      const j = code.indexOf('"', i + 1);
      const end = j < 0 ? code.length : j + 1;
      cur += code.slice(i, end);
      i = end - 1;
    } else if (ch === "\\" && i + 1 < code.length) {
      cur += code.slice(i, i + 2);
      i++;
    } else if (ch === "[") {
      const j = code.indexOf("]", i + 1);
      const end = j < 0 ? code.length : j + 1;
      cur += code.slice(i, end);
      i = end - 1;
    } else if (ch === ";") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Is this a date/time section? Letters d, m, y, h, s (German also T, J) outside quotes; digit places win unless it's a time ("hh:mm:ss.00"). */
function isDateSection(code: string, locale: Locale): boolean {
  const plain = code.replace(/"[^"]*"?/g, "").replace(/\\./g, "");
  if (/\[(h+|m+|s+)\]/i.test(plain)) return true;
  const bare = plain.replace(/\[[^\]]*\]/g, "");
  const letters = locale === "de" ? /[dDyYhHsSmMtTjJ]/ : /[dDyYhHsSmM]/;
  if (!letters.test(bare)) return false;
  if (/[0#?]/.test(bare) && !bare.includes(":")) return false;
  return true;
}

/**
 * Which character is the decimal point of a number format? The locale's (German ",", English "."),
 * but forgiving: "0.0%" in German and "0,00" in English mean decimals, since a thousands separator
 * only makes sense as "#.##0".
 */
function decimalCharFor(code: string, locale: Locale): "." | "," {
  const plain = code.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");
  const has = (c: string) => plain.includes(c);
  const thousandsLike = (c: string) => new RegExp(`#\\${c}[#0?]{3}`).test(plain);
  if (locale === "de") {
    if (has(",")) return ",";
    if (has(".") && !thousandsLike(".")) return ".";
    return ",";
  }
  if (has(".")) return ".";
  if (has(",") && !thousandsLike(",")) return ",";
  return ".";
}

function parseNumberSection(code: string, locale: Locale): Section {
  const dec = decimalCharFor(code, locale);
  const grp = dec === "," ? "." : ",";
  const tokens: FmtTok[] = [];
  let pct = 0;
  let hasText = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') {
      const j = code.indexOf('"', i + 1);
      tokens.push({ t: "lit", s: code.slice(i + 1, j < 0 ? code.length : j) });
      i = j < 0 ? code.length : j;
    } else if (ch === "\\" && i + 1 < code.length) {
      tokens.push({ t: "lit", s: code[i + 1] });
      i++;
    } else if (ch === "[") {
      const j = code.indexOf("]", i + 1);
      i = j < 0 ? code.length : j;
    } else if (ch === "_" && i + 1 < code.length) {
      tokens.push({ t: "lit", s: " " });
      i++;
    } else if (ch === "*" && i + 1 < code.length) {
      i++;
    } else if (ch === "0" || ch === "#" || ch === "?") tokens.push({ t: "digit", c: ch });
    else if (ch === dec) tokens.push({ t: "dec" });
    else if (ch === grp) tokens.push({ t: "group" });
    else if (ch === "%") {
      tokens.push({ t: "pct" });
      pct++;
    } else if ((ch === "E" || ch === "e") && (code[i + 1] === "+" || code[i + 1] === "-") && /[0#?]/.test(code[i + 2] ?? "")) {
      let j = i + 2;
      while (j < code.length && /[0#?]/.test(code[j])) j++;
      tokens.push({ t: "exp", sign: code[i + 1] as "+" | "-", digits: j - i - 2 });
      i = j - 1;
    } else if (ch === "@") {
      tokens.push({ t: "text" });
      hasText = true;
    } else tokens.push({ t: "lit", s: ch });
  }
  const hasDigits = tokens.some((t) => t.t === "digit");
  return { tokens, kind: hasDigits ? "number" : hasText ? "text" : "text", hasPercent: pct, neg: false };
}

function parseDateSection(code: string, locale: Locale): Section {
  const tokens: FmtTok[] = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') {
      const j = code.indexOf('"', i + 1);
      tokens.push({ t: "lit", s: code.slice(i + 1, j < 0 ? code.length : j) });
      i = j < 0 ? code.length : j;
      continue;
    }
    if (ch === "\\" && i + 1 < code.length) {
      tokens.push({ t: "lit", s: code[i + 1] });
      i++;
      continue;
    }
    if (ch === "[") {
      const j = code.indexOf("]", i + 1);
      const inner = code.slice(i + 1, j < 0 ? code.length : j).toLowerCase();
      if (/^(h+|m+|s+)$/.test(inner)) tokens.push({ t: "date", code: `[${inner[0]}]` });
      i = j < 0 ? code.length : j;
      continue;
    }
    const upper = code.slice(i, i + 5).toUpperCase();
    if (upper === "AM/PM") {
      tokens.push({ t: "date", code: "ampm" });
      i += 4;
      continue;
    }
    if (code.slice(i, i + 3).toUpperCase() === "A/P") {
      tokens.push({ t: "date", code: "ap" });
      i += 2;
      continue;
    }
    let c = ch.toLowerCase();
    if (locale === "de" && c === "t") c = "d";
    if (locale === "de" && c === "j") c = "y";
    if ("dmyhs".includes(c)) {
      let j = i + 1;
      while (j < code.length) {
        let n = code[j].toLowerCase();
        if (locale === "de" && n === "t") n = "d";
        if (locale === "de" && n === "j") n = "y";
        if (n !== c) break;
        j++;
      }
      tokens.push({ t: "date", code: c.repeat(j - i) });
      i = j - 1;
      continue;
    }
    if ((ch === "." || ch === ",") && tokens.length && tokens[tokens.length - 1].t === "date" && /^s+$/.test((tokens[tokens.length - 1] as { code: string }).code) && code[i + 1] === "0") {
      let j = i + 1;
      while (j < code.length && code[j] === "0") j++;
      tokens.push({ t: "date", code: `frac${j - i - 1}` });
      i = j - 1;
      continue;
    }
    tokens.push({ t: "lit", s: ch });
  }
  // "m" right after an hour or right before a second means minutes.
  const dateToks = tokens.filter((t): t is { t: "date"; code: string } => t.t === "date");
  for (let k = 0; k < dateToks.length; k++) {
    const tk = dateToks[k];
    if (!/^m{1,2}$/.test(tk.code)) continue;
    const prev = dateToks[k - 1]?.code ?? "";
    const next = dateToks[k + 1]?.code ?? "";
    if (/^h+$|^\[h\]$/.test(prev) || /^s+$|^\[s\]$/.test(next)) tk.code = tk.code === "m" ? "min" : "mmin";
  }
  return { tokens, kind: "date", hasPercent: 0, neg: false };
}

function renderNumber(sec: Section, value: number, locale: Locale, signed: boolean): string {
  // A separator with no digit place after it scales ("0,0," shows thousands); drop those first.
  let scale = 0;
  const toks = sec.tokens.filter((t, i) => {
    if (t.t !== "group") return true;
    const next = sec.tokens.slice(i + 1).find((x) => x.t !== "group");
    if (next && next.t === "digit") return true;
    scale++;
    return false;
  });
  let v = (Math.abs(value) * Math.pow(100, sec.hasPercent)) / Math.pow(1000, scale);
  const expTok = toks.find((t): t is Extract<FmtTok, { t: "exp" }> => t.t === "exp");
  const decIdx = toks.findIndex((t) => t.t === "dec");
  const expIdx = expTok ? toks.indexOf(expTok) : -1;
  const intEnd = decIdx >= 0 ? decIdx : expIdx >= 0 ? expIdx : toks.length;
  const intDigits = toks.slice(0, intEnd).filter((t) => t.t === "digit") as { t: "digit"; c: string }[];
  const fracDigits = decIdx >= 0 ? (toks.slice(decIdx + 1, expIdx >= 0 ? expIdx : toks.length).filter((t) => t.t === "digit") as { t: "digit"; c: string }[]) : [];
  const grouped = toks.slice(0, intEnd).some((t) => t.t === "group") && intDigits.length > 0;
  let exponent = 0;
  if (expTok) {
    if (v !== 0) {
      const ipl = Math.max(1, intDigits.length);
      exponent = Math.floor(Math.log10(v)) - (ipl - 1);
      v = v / Math.pow(10, exponent);
      // Rounding can make 9,99 → 10,0.
      const { int } = fixedParts(v, fracDigits.length);
      if (int.length > ipl) {
        exponent += 1;
        v = v / 10;
      }
    }
  }
  const { int: intStr0, frac: fracStr0 } = fixedParts(v, fracDigits.length);
  // Integer digits: "#" alone shows nothing for 0.
  const minInt = intDigits.filter((d) => d.c === "0" || d.c === "?").length;
  let intStr = intStr0.replace(/^0+/, "");
  if (intStr.length < minInt) intStr = intStr.padStart(minInt, "0");
  if (grouped) intStr = group(intStr, groupSep(locale));
  // Fraction digits: trailing zeros of "#" places go away, "?" become spaces.
  let fracStr = fracStr0;
  for (let k = fracDigits.length - 1; k >= 0; k--) {
    if (fracStr[k] !== "0") break;
    if (fracDigits[k].c === "#") fracStr = fracStr.slice(0, k);
    else if (fracDigits[k].c === "?") fracStr = fracStr.slice(0, k) + " " + fracStr.slice(k + 1);
    else break;
  }
  const zero = /^[0.,\s]*$/.test(intStr + fracStr);
  let out = "";
  let intPlaced = false;
  let fracPos = 0;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === "lit") out += t.s;
    else if (t.t === "pct") out += "%";
    else if (t.t === "digit") {
      if (k < intEnd) {
        if (!intPlaced) {
          out += intStr;
          intPlaced = true;
        }
      } else if (k > decIdx && (expIdx < 0 || k < expIdx)) {
        out += fracStr[fracPos] ?? "";
        fracPos++;
      }
    } else if (t.t === "dec") {
      if (!intPlaced) {
        out += intStr;
        intPlaced = true;
      }
      if (fracStr.length) out += decSep(locale);
    } else if (t.t === "exp") {
      if (!intPlaced) {
        out += intStr;
        intPlaced = true;
      }
      const es = String(Math.abs(exponent)).padStart(t.digits, "0");
      out += `E${exponent < 0 ? "-" : t.sign === "+" ? "+" : ""}${es}`;
    } else if (t.t === "text") out += "";
  }
  return signed && value < 0 && !zero ? `-${out}` : out;
}

function renderDate(sec: Section, serial: number, locale: Locale): string | CellError {
  if (serial < 0 || serial >= MAX_SERIAL + 1) return ERR.value;
  const hasAmPm = sec.tokens.some((t) => t.t === "date" && (t.code === "ampm" || t.code === "ap"));
  const fracTok = sec.tokens.find((t) => t.t === "date" && t.code.startsWith("frac")) as { code: string } | undefined;
  const fracDigits = fracTok ? Number(fracTok.code.slice(4)) : 0;
  // Round to the shown precision first (seconds, or their fraction).
  const unit = 86400 * Math.pow(10, fracDigits);
  const rounded = Math.round(serial * unit) / unit;
  const day = Math.floor(rounded);
  const secs = (rounded - day) * 86400;
  const { y, m, d } = ymdFromSerial(day);
  const wd = weekdayOf(day);
  const h = Math.floor(secs / 3600 + 1e-9);
  const mi = Math.floor((secs - h * 3600) / 60 + 1e-9);
  const s = Math.floor(secs - h * 3600 - mi * 60 + 1e-9);
  const sfrac = secs - Math.floor(secs + 1e-9);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  let out = "";
  for (const t of sec.tokens) {
    if (t.t === "lit") {
      out += t.s;
      continue;
    }
    if (t.t !== "date") continue;
    switch (t.code) {
      case "d":
        out += d;
        break;
      case "dd":
        out += pad(d);
        break;
      case "ddd":
        out += WEEKDAYS_SHORT[locale][wd];
        break;
      case "m":
        out += m;
        break;
      case "mm":
        out += pad(m);
        break;
      case "mmm":
        out += MONTHS_SHORT[locale][m - 1];
        break;
      case "mmmmm":
        out += MONTHS[locale][m - 1][0];
        break;
      case "yy":
      case "y":
        out += pad(y % 100);
        break;
      case "h":
        out += hasAmPm ? ((h + 11) % 12) + 1 : h;
        break;
      case "hh":
        out += pad(hasAmPm ? ((h + 11) % 12) + 1 : h);
        break;
      case "min":
        out += mi;
        break;
      case "mmin":
        out += pad(mi);
        break;
      case "s":
        out += s;
        break;
      case "ss":
        out += pad(s);
        break;
      case "[h]":
        out += Math.floor(rounded * 24 + 1e-9);
        break;
      case "[m]":
        out += Math.floor(rounded * 1440 + 1e-9);
        break;
      case "[s]":
        out += Math.floor(rounded * 86400 + 1e-9);
        break;
      case "ampm":
        out += h < 12 ? "AM" : "PM";
        break;
      case "ap":
        out += h < 12 ? "A" : "P";
        break;
      default:
        if (t.code.startsWith("frac")) out += decSep(locale) + fixedParts(sfrac, fracDigits).frac;
        else if (/^d{4,}$/.test(t.code)) out += WEEKDAYS[locale][wd];
        else if (/^m{4}$/.test(t.code) || /^m{6,}$/.test(t.code)) out += MONTHS[locale][m - 1];
        else if (/^y{3,}$/.test(t.code)) out += pad(y, 4);
        else if (/^h{3,}$/.test(t.code)) out += pad(h);
        else if (/^s{3,}$/.test(t.code)) out += pad(s);
        else out += t.code;
    }
  }
  return out;
}

/**
 * TEXT(value; format): Excel's format codes. German codes in German ("TT.MM.JJJJ", "0,00",
 * "#.##0,00 €", "TTTT"), English in English ("dd.mm.yyyy", "0.00", "#,##0.00"); both languages
 * also accept the other's date letters and decimal point where unambiguous.
 */
export function formatWithCode(value: number | string | boolean | null, code: string, locale: Locale): string | CellError {
  const sections = splitSections(code);
  if (typeof value === "boolean") return boolText(value, locale);
  if (typeof value === "string") {
    const textSec = sections.length >= 4 ? sections[3] : sections.find((s) => s.includes("@"));
    if (textSec === undefined) return value;
    return renderTextSection(textSec, value);
  }
  const n = value ?? 0;
  let secCode: string;
  let signed = true;
  if (n < 0 && sections.length >= 2 && sections[1] !== "") {
    secCode = sections[1];
    signed = false;
  } else if (n === 0 && sections.length >= 3) {
    secCode = sections[2];
  } else secCode = sections[0];
  const trimmed = secCode.replace(/\[[^\]]*\]/g, (m) => (/^\[(h+|m+|s+)\]$/i.test(m) ? m : "")).trim();
  if (!trimmed || /^(general|standard)$/i.test(trimmed)) return formatGeneral(signed ? n : Math.abs(n), locale);
  if (isDateSection(trimmed, locale)) return renderDate(parseDateSection(trimmed, locale), n, locale);
  const sec = parseNumberSection(trimmed, locale);
  if (sec.kind !== "number") return sec.tokens.map((t) => (t.t === "lit" ? t.s : t.t === "text" ? formatGeneral(n, locale) : t.t === "pct" ? "%" : "")).join("");
  const frac = renderFraction(trimmed, n, signed);
  if (frac !== null) return frac;
  return renderNumber(sec, n, locale, signed);
}

/** Fractions like Excel's "# ?/?" (best fit with up to 9 as denominator), "?/??", "# ?/8" (eighths). */
function renderFraction(code: string, value: number, signed: boolean): string | null {
  const plain = code.replace(/"[^"]*"/g, "").replace(/\\./g, "");
  const m = /^\s*(?:([#0?,]+)\s+)?([#0?]+)\s*\/\s*([#0?]+|[0-9]+)\s*$/.exec(plain);
  if (!m) return null;
  const neg = value < 0;
  const abs = Math.abs(value);
  const whole = m[1] !== undefined;
  let int = whole ? Math.floor(abs) : 0;
  const part = abs - int;
  let num: number;
  let den: number;
  if (/^[0-9]+$/.test(m[3])) {
    den = Number(m[3]) || 1;
    num = Math.round(part * den);
  } else {
    const maxDen = Math.pow(10, m[3].length) - 1;
    den = 1;
    num = Math.round(part);
    let best = Math.abs(part - num);
    for (let d = 2; d <= maxDen && best > 1e-12; d++) {
      const nn = Math.round(part * d);
      const err = Math.abs(part - nn / d);
      if (err < best - 1e-15) {
        best = err;
        num = nn;
        den = d;
      }
    }
  }
  if (whole && num === den) {
    int += 1;
    num = 0;
  }
  const sign = signed && neg && (int > 0 || num > 0) ? "-" : "";
  if (!whole) return `${sign}${num}/${den}`;
  if (num === 0) return `${sign}${int}`;
  return int > 0 ? `${sign}${int} ${num}/${den}` : `${sign}${num}/${den}`;
}

function renderTextSection(code: string, text: string): string {
  let out = "";
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') {
      const j = code.indexOf('"', i + 1);
      out += code.slice(i + 1, j < 0 ? code.length : j);
      i = j < 0 ? code.length : j;
    } else if (ch === "\\" && i + 1 < code.length) {
      out += code[i + 1];
      i++;
    } else if (ch === "@") out += text;
    else if (ch === "[") {
      const j = code.indexOf("]", i + 1);
      i = j < 0 ? code.length : j;
    } else out += ch;
  }
  return out;
}
