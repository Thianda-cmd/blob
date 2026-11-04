// Looks between Blob and .xlsx files: number formats (Blob's kinds ⇄ Excel's format codes),
// colours (Blob's named palette ⇄ Excel's RGB, theme and indexed colours), font sizes and borders.

import { COLOR_HEX } from "../colors";
import type { BorderLine, SheetColor, TableStyle } from "../types";

// Number formats ----------------------------------------------------------------------------------

// In formatCodes.ts: copy and paste use them too, and load nothing else of this file.
export { BUILTIN_CODES, builtinFormat, fromExcelFormat, fromSigStyle, isDayClockCode, sigStyleName, toExcelFormat } from "./formatCodes";

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
