import type { SheetColor } from "./types";

// The spreadsheet palette. Cells and charts store colour names; the CSS variables in globals.css
// (--sheet-<name> for text/lines, --sheet-<name>-fill for cell backgrounds) switch with dark mode.

export const SHEET_COLORS: SheetColor[] = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown"];

/** Text, line and chart colour (follows dark mode). */
export const sheetColor = (c: SheetColor) => `var(--sheet-${c})`;
/** Cell background tint (follows dark mode). */
export const sheetFill = (c: SheetColor) => `var(--sheet-${c}-fill)`;

/** Chart series take these in turn when they have no colour of their own. */
export const SERIES_COLORS: SheetColor[] = ["blue", "orange", "green", "purple", "red", "teal", "pink", "brown", "yellow", "gray"];

/** Fixed hex values, for exports (PNG, SVG, XLSX) where CSS variables don't exist. */
export const COLOR_HEX: Record<SheetColor, { light: string; dark: string; fill: string; fillDark: string }> = {
  gray: { light: "#5f6368", dark: "#b5b8bd", fill: "#ececec", fillDark: "#3a3a3c" },
  red: { light: "#d93025", dark: "#f28b82", fill: "#fde2df", fillDark: "#4d2422" },
  orange: { light: "#e8710a", dark: "#fcad70", fill: "#fde9d4", fillDark: "#4d3220" },
  yellow: { light: "#b58b00", dark: "#fdd663", fill: "#fff3c4", fillDark: "#4a4019" },
  green: { light: "#188038", dark: "#81c995", fill: "#dcf1e1", fillDark: "#1f3b28" },
  teal: { light: "#0f8a83", dark: "#6fd3c9", fill: "#d5f0ee", fillDark: "#173b38" },
  blue: { light: "#1a73e8", dark: "#8ab4f8", fill: "#dde9fc", fillDark: "#1f3352" },
  purple: { light: "#7c4dff", dark: "#b39dff", fill: "#ebe3ff", fillDark: "#33294f" },
  pink: { light: "#d01884", dark: "#ff8bcb", fill: "#fbe0ef", fillDark: "#4a1f37" },
  brown: { light: "#8d5a2b", dark: "#d6a77a", fill: "#f1e5d8", fillDark: "#3d2e21" },
};
