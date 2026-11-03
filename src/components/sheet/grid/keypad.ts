"use client";

// Which on-screen keyboard typing into a cell asks for on a phone or tablet: digits where numbers
// are typed (a column of measured values), letters everywhere else (and always for formulas and
// text, so "=" is at hand). "123" / "ABC" in the formula bar switches while the cell editor has
// the keyboard; the choice is remembered for that kind of cell (numbers, or the rest) while the
// page is open. The digits keyboard of an iPhone has no minus and no "=": ABC stays one tap away.

import { useSyncExternalStore } from "react";
import { cellKey } from "@/sheet/a1";
import type { Cell, Pos, Sheet } from "@/sheet/types";

/** The values of the inputmode attribute used here. */
export type Keypad = "decimal" | "text";
/** Where numbers are typed, or anything else. */
export type KeypadContext = "number" | "other";

type State = {
  /** What was chosen by hand for each kind of cell (null: what suits it). */
  choice: Readonly<Record<KeypadContext, Keypad | null>>;
  /** The cell editor has the keyboard (a touch screen keeps it between values). */
  open: boolean;
};

const START: State = { choice: { number: null, other: null }, open: false };
let state: State = START;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useKeypad(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => START,
  );
}

/** A tap on "123" or "ABC": this kind of cell gets `pad` from now on. */
export function chooseKeypad(context: KeypadContext, pad: Keypad) {
  if (state.choice[context] === pad) return;
  state = { ...state, choice: { ...state.choice, [context]: pad } };
  emit();
}

/** The cell editor got or lost the keyboard. */
export function setKeypadOpen(open: boolean) {
  if (state.open === open) return;
  state = { ...state, open };
  emit();
}

/** A number typed into the cell: not a formula's result, not a date or a time (those need "." or ":"). */
function typedNumber(cell: Cell | undefined): boolean {
  if (!cell || cell.f !== undefined || typeof cell.v !== "number") return false;
  const kind = cell.s?.fmt?.kind;
  return kind !== "date" && kind !== "time" && kind !== "datetime" && kind !== "text";
}

/**
 * Is `p` a place where a number is typed? It holds one, or it is empty with a typed number right
 * above or below it (the next value of a column of measurements). A formula, text or a column of
 * formulas is not.
 */
export function keypadContext(sheet: Sheet, p: Pos): KeypadContext {
  const cell = sheet.cells[cellKey(p.row, p.col)];
  if (cell && (cell.f !== undefined || (cell.v !== undefined && cell.v !== ""))) return typedNumber(cell) ? "number" : "other";
  const above = p.row > 0 ? sheet.cells[cellKey(p.row - 1, p.col)] : undefined;
  const below = sheet.cells[cellKey(p.row + 1, p.col)];
  return typedNumber(above) || typedNumber(below) ? "number" : "other";
}

/** The keyboard for a kind of cell: the one chosen by hand, else digits for numbers and letters for the rest. */
export function keypadFor(context: KeypadContext, choice: State["choice"]): Keypad {
  return choice[context] ?? (context === "number" ? "decimal" : "text");
}
