// Formatting and editing actions on the selection, shared by the toolbar buttons and the grid's
// keyboard shortcuts (Ctrl+B, Alt+=, …), so both behave the same.
//
// CONTRACT: implemented by the editor chrome; the grid imports these for its shortcuts.

import type { CellStyle, NumberFormat } from "@/sheet/types";
import type { SheetStore } from "../store";

const todo = (name: string): never => {
  throw new Error(`chrome actions: ${name} not implemented`);
};

/** Bold, italic, underline, strike, wrap: on for every selected cell unless all already have it. */
export function toggleStyle(store: SheetStore, key: "bold" | "italic" | "underline" | "strike" | "wrap"): void {
  void store;
  void key;
  return todo("toggleStyle");
}

/** Any other look (colour, fill, alignment, size, borders); undefined values remove the setting. */
export function setStyle(store: SheetStore, patch: Partial<CellStyle>): void {
  void store;
  void patch;
  return todo("setStyle");
}

/** null = back to "general". */
export function setNumberFormat(store: SheetStore, fmt: NumberFormat | null): void {
  void store;
  void fmt;
  return todo("setNumberFormat");
}

/** One more or one fewer decimal (from what the active cell shows, like Excel). */
export function changeDecimals(store: SheetStore, delta: 1 | -1): void {
  void store;
  void delta;
  return todo("changeDecimals");
}

/** Excel's AutoSum (Alt+=): =SUMME(…) (or another function) of the numbers above/left of the selection, or below/right of a selected range. */
export function autoSum(store: SheetStore, fn?: "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN" | "STDEV.S"): void {
  void store;
  void fn;
  return todo("autoSum");
}

/** Sort the selection's rows (or the block of data around the active cell, keeping a header row on top). */
export function sortSelection(store: SheetStore, dir: "asc" | "desc"): void {
  void store;
  void dir;
  return todo("sortSelection");
}
