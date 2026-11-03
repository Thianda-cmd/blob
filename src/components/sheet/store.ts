"use client";

// The spreadsheet editor's state: the workbook and its values, the sheet on screen, the selection,
// the cell being edited, undo and redo. One store per open spreadsheet; every part of the editor
// (grid, formula bar, toolbar, tabs, charts, tables) reads it with useSheet and changes it through
// its actions.
//
// CONTRACT: the types and the SheetStore interface are what the other parts are written against.
// Keep them; add members if needed. createSheetStore is implemented by the grid.

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import type { Calc } from "@/sheet/engine";
import type { Area, Pos, Workbook } from "@/sheet/types";

export type Selection = {
  /** Where the selection started; the active cell (the one you type into). */
  anchor: Pos;
  /** The opposite corner (Shift+arrows, dragging). anchor = focus: one cell. */
  focus: Pos;
  /** More areas added with Ctrl/⌘ (a chart of two columns that aren't side by side). */
  extra: Area[];
};

export type EditState = {
  sheetId: string;
  row: number;
  col: number;
  /** What is typed, in the user's language ("=MITTELWERT(B2;B3)", "1,5"). */
  text: string;
  /** Caret position in `text`. */
  caret: number;
  /** In the cell itself or in the formula bar. */
  via: "cell" | "bar";
  /**
   * true: typing replaced the cell's content (Excel's "Eingeben"): arrow keys commit and move.
   * false: editing what was there (F2, double-click, the formula bar): arrow keys move the caret.
   */
  replace: boolean;
  /** Why the last commit failed (a formula that doesn't parse); the editor stays open and shows it. */
  error: { message: string; at: number } | null;
} | null;

export type SheetState = {
  /** The spreadsheet page (pages.id). */
  pageId: string;
  workbook: Workbook;
  /** Values of `workbook`; a new one after every change. */
  calc: Calc;
  /** The sheet on screen. */
  sheetId: string;
  selection: Selection;
  edit: EditState;
  /** Marching ants around what was copied or cut. */
  clip: { sheetId: string; area: Area; cut: boolean } | null;
  /** The chart or smart table whose settings are open (side panel, or a bottom sheet on phones). */
  focus: { kind: "chart" | "table"; id: string } | null;
  readOnly: boolean;
  locale: Locale;
  canUndo: boolean;
  canRedo: boolean;
  /** Counts document changes (local and remote); saving watches it. */
  version: number;
};

export interface SheetStore {
  get(): SheetState;
  subscribe(listener: () => void): () => void;

  /**
   * Change the document with a pure function (src/sheet/ops.ts, src/sheet/table/model.ts…).
   * One undo step called `label`. Nothing happens when read-only or when the function returns
   * the same workbook.
   */
  apply(label: string, change: (wb: Workbook, calc: Calc) => Workbook): void;
  /**
   * Typing `text` into a cell (parsed like Excel, see parseInput); keeps the cell's look and adds
   * a format the input implies. Also grows a smart table typed right below or beside it, and
   * fills a smart table's column when a formula is typed into it (src/sheet/table/model.ts afterInput).
   * Returns false when a formula doesn't parse (nothing changes).
   */
  input(at: Pos, text: string): boolean;

  setSheet(sheetId: string): void;
  /** One cell, an area (anchor top-left) or a full selection. Commits a running edit unless keepEdit (formula reference picking). */
  select(sel: Selection | Pos | Area, opts?: { keepEdit?: boolean }): void;
  /** Start editing the active cell (or `at`): F2/double-click (replace false), typing a character (replace true, text = it). */
  startEdit(opts: { via: "cell" | "bar"; replace: boolean; text?: string; at?: Pos }): void;
  updateEdit(text: string, caret: number): void;
  /** Commit the running edit and move the selection (Enter: down, Tab: right, Shift: back). false: the formula didn't parse. */
  commitEdit(move?: "down" | "up" | "right" | "left" | null): boolean;
  cancelEdit(): void;

  setClip(clip: SheetState["clip"]): void;
  setFocus(focus: SheetState["focus"]): void;

  undo(): void;
  redo(): void;

  /** A row hidden by hand or by a smart table's filter (what the grid hides and SUBTOTAL skips). */
  isRowHidden(sheetId: string, row: number): boolean;

  /** Someone else's save, already merged with ours: replaces the document without an undo step; keeps selection and a running edit. */
  replaceRemote(wb: Workbook): void;
}

export function createSheetStore(init: { pageId: string; workbook: Workbook; locale: Locale; readOnly: boolean }): SheetStore {
  void init;
  throw new Error("store: createSheetStore not implemented");
}

export const SheetStoreContext = createContext<SheetStore | null>(null);

export function useSheetStore(): SheetStore {
  const store = useContext(SheetStoreContext);
  if (!store) throw new Error("useSheetStore: no SheetStoreContext.Provider");
  return store;
}

/**
 * Re-render when the selected part of the state changes. `select` must return something already
 * in the state (the same object while nothing changed) or a primitive, never a new object.
 */
export function useSheet<T>(store: SheetStore, select: (s: SheetState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}
