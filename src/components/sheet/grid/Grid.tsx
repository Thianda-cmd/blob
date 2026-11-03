"use client";

// The spreadsheet grid: column and row headers, cells (only the visible ones are rendered),
// selection, editing in the cell, keyboard, mouse, touch and pen, clipboard, fill handle,
// resizing, frozen rows/columns and the context menu.
//
// CONTRACT: the props and types below are what the editor (SheetEditor), smart tables
// (decorate) and charts (overlay) are written against. Keep them; add optional props if needed.

import type { ReactNode } from "react";
import type { Pos } from "@/sheet/types";
import type { SheetStore } from "../store";

/** Extra look for a cell, from a smart table (header row, banding, totals row). */
export type CellDecor = {
  /** Background (CSS colour, e.g. var(--sheet-blue-fill)); the cell's own fill wins. */
  fill?: string;
  /** Text colour; the cell's own colour wins. */
  color?: string;
  bold?: boolean;
  /** A line under the cell (header row) or above it (totals row). */
  lineBelow?: "strong";
  lineAbove?: "strong";
  /** A small button at the right of the cell: a smart table's sort and filter menu. */
  button?: {
    state: "plain" | "filtered" | "sortedAsc" | "sortedDesc";
    /** For screen readers and the tooltip ("Sortieren und filtern: Extinktion"). */
    label: string;
    onClick: (anchor: HTMLElement) => void;
  };
};

/** Where cells are, in the coordinates of the scrolling content (A1's top-left corner is 0,0). */
export type GridGeometry = {
  /** A cell's box (hidden rows and columns have zero size). */
  rect(row: number, col: number): { x: number; y: number; w: number; h: number };
  /** The cell under a point of the content. */
  cellAt(x: number, y: number): Pos;
  /** The sheet these coordinates belong to. */
  sheetId: string;
};

export type GridProps = {
  store: SheetStore;
  /** Extra look per cell (smart tables). Called only for visible cells. */
  decorate?: (sheetId: string, row: number, col: number) => CellDecor | null;
  /** Things floating above the cells that scroll with them (charts), positioned with `geom`. */
  overlay?: (geom: GridGeometry) => ReactNode;
  /** Entries added at the top of the cells' context menu ("Als intelligente Tabelle", "Diagramm einfügen"). */
  contextMenu?: (close: () => void) => ReactNode;
  className?: string;
};

export function Grid(props: GridProps): ReactNode {
  void props;
  return null;
}
