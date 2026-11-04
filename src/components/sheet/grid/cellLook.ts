// How one cell looks on the grid: its text as shown (formatted in the user's language), alignment,
// font, colours and borders, with a smart table's decoration underneath the cell's own look.

import type { Locale } from "@/i18n/config";
import { sheetColor, sheetFill } from "@/sheet/colors";
import { defaultAlign, errorText, formatValue, isError, type CellValue, type ErrorCode } from "@/sheet/engine";
import type { BorderLine, Cell, NumberFormat } from "@/sheet/types";
import type { CellDecor } from "./Grid";
import { textWidth } from "./measure";

export const BASE_FONT = 13;
/** Space between a cell's border and its text, px at 100 %. */
export const CELL_PAD = 5;

export type CellLook = {
  /** The text as shown, before fitting it into the column. */
  text: string;
  kind: "number" | "text" | "bool" | "error" | "empty";
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  wrap: boolean;
  /** Font size in px at 100 %. */
  size: number;
  /** CSS colours. */
  color: string | undefined;
  fill: string | undefined;
  /** "top,right,bottom,left" border lines ("" for none), or "" when there are none. */
  borders: string;
  error: ErrorCode | null;
  errorDetail: string | undefined;
  fmt: NumberFormat | undefined;
};

/** The text a value shows with a format; errors in the user's language (#WERT!, #BEZUG!…). */
export function shownText(value: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  if (value === null) return "";
  if (isError(value)) return errorText(value.error, locale);
  return formatValue(value, fmt, locale);
}

export function lookOf(cell: Cell | undefined, value: CellValue, decor: CellDecor | null, locale: Locale): CellLook {
  const s = cell?.s;
  const kind: CellLook["kind"] =
    value === null ? "empty" : isError(value) ? "error" : typeof value === "number" ? "number" : typeof value === "boolean" ? "bool" : "text";
  const b = s?.border;
  const borders = b && (b.top || b.right || b.bottom || b.left) ? [b.top, b.right, b.bottom, b.left].map((x) => x ?? "").join(",") : "";
  return {
    text: shownText(value, s?.fmt, locale),
    kind,
    align: s?.align ?? (value === null ? "left" : defaultAlign(value)),
    valign: s?.valign ?? "middle",
    bold: s?.bold ?? decor?.bold ?? false,
    italic: !!s?.italic,
    underline: !!s?.underline,
    strike: !!s?.strike,
    wrap: !!s?.wrap,
    size: s?.size ?? BASE_FONT,
    color: s?.color ? sheetColor(s.color) : decor?.color,
    fill: s?.fill ? sheetFill(s.fill) : decor?.fill,
    borders,
    error: isError(value) ? value.error : null,
    errorDetail: isError(value) ? value.detail : undefined,
    fmt: s?.fmt,
  };
}

/**
 * Text that looks like a number but isn't one, beside a number in its column: "0,1040,110" (a new
 * value typed after the old one), "0, 5", "O,104" (the letter O). Formulas and charts skip such a
 * cell without a word, so the grid marks it (like Excel's "number stored as text"). It stays as
 * typed: "1,2,3" can be meant as text, and alone in a column of words it gets no mark. Only typed
 * text counts: a formula's text and a cell formatted as text are meant to be text.
 */
export function numberAsText(cell: Cell | undefined, near: (dRow: -1 | 1) => CellValue): boolean {
  if (!cell || cell.f !== undefined || typeof cell.v !== "string" || cell.s?.fmt?.kind === "text") return false;
  if (!/[.,]/.test(cell.v) || !numberLike(cell.v)) return false;
  return typeof near(-1) === "number" || typeof near(1) === "number";
}

/** Text of digits and number signs only, as typed for a number ("12", "0,1040,110", "O,104" with the letter O, "1.5E-3" with an exponent). */
export function numberLike(text: string): boolean {
  const t = text.trim();
  return /\d/.test(t) && /^[+-]?[\dOo.,' ]+(?:[eE][+-]?\d+)?%?$/.test(t);
}

/** CSS for one border line (an Excel border is dark, like ink). */
export function borderCss(line: BorderLine | "", zoom: number): string | undefined {
  if (!line) return undefined;
  const px = (n: number) => `${Math.max(1, Math.round(n * zoom))}px`;
  if (line === "thick") return `${px(2)} solid var(--ink)`;
  if (line === "double") return `${px(3)} double var(--ink)`;
  if (line === "dashed") return `${px(1)} dashed var(--ink)`;
  return `${px(1)} solid var(--ink)`;
}

/**
 * A number that is too wide for its column: in the general format with fewer decimals (or in
 * scientific notation) like Excel, otherwise "###" across the cell.
 */
export function fitNumber(look: CellLook, value: number, avail: number, size: number, locale: Locale): string {
  const width = (t: string) => textWidth(t, size, look.bold, look.italic);
  if (width(look.text) <= avail) return look.text;
  if (!look.fmt || look.fmt.kind === "general") {
    const sep = locale === "de" ? "," : ".";
    const decimals = look.text.includes("E") ? 0 : (look.text.split(sep)[1]?.length ?? 0);
    for (let d = decimals - 1; d >= 0; d--) {
      const t = formatValue(value, { kind: "number", decimals: d }, locale);
      if (width(t) <= avail) return t;
    }
    if (Math.abs(value) >= 1e-300) {
      for (let d = 3; d >= 0; d--) {
        const t = formatValue(value, { kind: "scientific", decimals: d }, locale);
        if (width(t) <= avail) return t;
      }
    }
  }
  return "#".repeat(Math.max(1, Math.floor(avail / Math.max(1, width("#")))));
}
