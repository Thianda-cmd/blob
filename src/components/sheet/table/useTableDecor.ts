"use client";

// The look of smart tables on the grid (header colours, banding, totals line) and the header
// buttons that open each column's sort and filter menu.
//
// CONTRACT: SheetEditor passes the returned function as the Grid's `decorate`, and renders
// `menu` (the open column menu, if any) somewhere in its tree.

import type { ReactNode } from "react";
import type { CellDecor } from "../grid/Grid";
import type { SheetStore } from "../store";

export function useTableDecor(store: SheetStore): { decorate: (sheetId: string, row: number, col: number) => CellDecor | null; menu: ReactNode } {
  void store;
  return { decorate: () => null, menu: null };
}
