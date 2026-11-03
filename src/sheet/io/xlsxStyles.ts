// Looks between Blob and .xlsx files: number formats (Blob's kinds ⇄ Excel's format codes),
// colours (Blob's named palette ⇄ Excel's RGB, theme and indexed colours), font sizes and borders.

import type { Locale } from "@/i18n/config";
import { COLOR_HEX } from "../colors";
import type { BorderLine, NumberFormat, SheetColor, TableStyle } from "../types";
import { lookup } from "./xml";

// Number formats ----------------------------------------------------------------------------------

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
/** Text shown after a number ("mg/L"), quoted for a format code. */
const literal = (unit: string | undefined) => {
  const u = (unit ?? "").replace(/"/g, "").trim();
  return u ? `" ${u}"` : "";
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

/**
 * An Excel format code → Blob's format (undefined: general). Lossy where Blob has no equivalent:
 * fractions and thousands scaling read as general, any date as a date, any clock time as a time.
 */
export function fromExcelFormat(code: string, locale: Locale): NumberFormat | undefined {
  const trimmed = code.trim();
  if (!trimmed || /^general$/i.test(trimmed)) return undefined;
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
    if (hasClock && !hasDate) return { kind: "time", seconds: /s/i.test(p) };
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

// Colours -----------------------------------------------------------------------------------------

/** "#1a73e8" → "FF1A73E8" (Excel's ARGB). */
export const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

/** Blob colours as Excel colours (the light theme's: a file is printed on white). */
export const textArgb = (c: SheetColor) => argb(COLOR_HEX[c].light);
export const fillArgb = (c: SheetColor) => argb(COLOR_HEX[c].fill);

/** `hex` mixed with white (amount 0 = white, 1 = the colour). */
export function mixWhite(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * amount);
  return `#${[mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type Lab = { L: number; a: number; b: number };

function oklab(hex: string): Lab {
  const n = parseInt(hex.replace("#", "").slice(-6), 16);
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const bl = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

const CHROMATIC: SheetColor[] = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown"];
const hueOf = (c: Lab) => Math.atan2(c.b, c.a);
let paletteHues: { color: SheetColor; hue: number; L: number }[] | null = null;

function palette() {
  paletteHues ??= CHROMATIC.map((color) => {
    const lab = oklab(COLOR_HEX[color].light);
    return { color, hue: hueOf(lab), L: lab.L };
  });
  return paletteHues;
}

/**
 * The palette colour nearest to an Excel colour ("RRGGBB" or "AARRGGBB"), or null for black text
 * and white fills (the default look). Matched by hue, so Excel's bright yellow fill (FFFF00) is
 * Blob's yellow and its dark red text (C00000) is red; greys are gray.
 */
export function nearestSheetColor(rgb: string, kind: "text" | "fill"): SheetColor | null {
  const hex = rgb.replace(/^#/, "").slice(-6);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const lab = oklab(hex);
  const chroma = Math.hypot(lab.a, lab.b);
  if (kind === "text") {
    if (chroma < 0.035) return lab.L < 0.42 || lab.L > 0.93 ? null : "gray";
  } else {
    if (lab.L > 0.975 && chroma < 0.03) return null;
    if (chroma < 0.022) return lab.L > 0.985 ? null : "gray";
  }
  const hue = hueOf(lab);
  let best: SheetColor = "gray";
  let bestD = Infinity;
  for (const p of palette()) {
    if (p.color === "brown") continue;
    let d = Math.abs(hue - p.hue);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bestD) {
      bestD = d;
      best = p.color;
    }
  }
  // Brown is a dark orange or yellow.
  if ((best === "orange" || best === "yellow") && lab.L < (kind === "text" ? 0.56 : 0.6) && chroma < 0.16) return "brown";
  return best;
}

/** Excel's legacy 64-colour palette (indexed colours), as RRGGBB. */
export const INDEXED_COLORS = [
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
  "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
  "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
  "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
  "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
  "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
];

/** The Office theme's colours, in the order Excel numbers them (theme="0" is the light background). */
export const OFFICE_THEME = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "0563C1", "954F72"];

/** A colour lightened (tint > 0) or darkened (tint < 0) the way Excel applies `tint`. */
export function applyTint(rgb: string, tint: number): string {
  if (!tint) return rgb;
  const n = parseInt(rgb, 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) r = g = b = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  return [r, g, b].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Sizes and lines ---------------------------------------------------------------------------------

/** Blob's default text is 13 px; Excel's 11 pt. Sizes keep their proportion to the default. */
export const BLOB_FONT_PX = 13;
export const EXCEL_FONT_PT = 11;
export const pxToPt = (px: number, basePt = EXCEL_FONT_PT) => Math.round(((basePt * px) / BLOB_FONT_PX) * 2) / 2;
export const ptToPx = (pt: number, basePt = EXCEL_FONT_PT) => Math.round((BLOB_FONT_PX * pt) / basePt);

/** Column widths: Excel counts characters of Calibri 11 (7 px each, padding included). */
export const pxToWidth = (px: number) => Math.round((px / 7) * 256) / 256;
export const widthToPx = (w: number) => Math.max(8, Math.round(w * 7));
/** Row heights: points ⇄ px (1 pt = 4/3 px). */
export const pxToHeight = (px: number) => Math.round(px * 0.75 * 4) / 4;
export const heightToPx = (pt: number) => Math.max(8, Math.round(pt / 0.75));

export const BORDER_TO_EXCEL: Record<BorderLine, string> = { thin: "thin", thick: "medium", double: "double", dashed: "dashed" };

export function borderFromExcel(style: string | undefined): BorderLine | undefined {
  if (!style || style === "none") return undefined;
  if (style === "double") return "double";
  if (style === "medium" || style === "thick") return "thick";
  if (/dash|dot/i.test(style)) return "dashed";
  return "thin";
}

// Smart table looks -------------------------------------------------------------------------------

/** Blob's table colours as custom table styles in the file ("Blob blue"), so they come back as they were. */
export const TABLE_STYLE_NAME = (s: TableStyle) => `Blob ${s}`;

/**
 * A table style of the file → Blob's colour: Blob's own, else Excel's built-in styles by the
 * theme colour they use (Light/Medium/Dark 1–28 cycle through dark, blue, orange, gray, gold, blue, green).
 */
export function tableStyleFromExcel(name: string | undefined): TableStyle {
  const own = /^Blob (purple|blue|green|orange|teal|gray)$/i.exec(name ?? "");
  if (own) return own[1].toLowerCase() as TableStyle;
  const m = /^TableStyle(?:Light|Medium|Dark)(\d+)$/i.exec(name ?? "");
  if (!m) return "blue";
  const cycle: TableStyle[] = ["gray", "blue", "orange", "gray", "orange", "blue", "green"];
  return cycle[(Number(m[1]) - 1) % 7] ?? "blue";
}
