"use client";

// The look of smart tables on the grid (header colours, banding, totals line) and the header
// buttons that open each column's sort and filter menu.
//
// CONTRACT: SheetEditor passes the returned function as the Grid's `decorate`, and renders
// `menu` (the open column menu, if any) somewhere in its tree.
//
// `decorate` is made once per workbook and calculation (decor.ts); the grid calls it for every
// visible cell, so it only compares a few numbers. `menu` also shows the tables' short messages,
// so render it even while no menu is open.

import { createElement, useCallback, useMemo, useState, type ReactNode } from "react";
import type { CellDecor } from "../grid/Grid";
import { useSheet, type SheetStore } from "../store";
import { buildDecorate, type ColumnMenuRequest } from "./decor";
import { TableOverlays } from "./TableOverlays";

export function useTableDecor(store: SheetStore): { decorate: (sheetId: string, row: number, col: number) => CellDecor | null; menu: ReactNode } {
  const wb = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const locale = useSheet(store, (s) => s.locale);
  const [menu, setMenu] = useState<ColumnMenuRequest | null>(null);

  const decorate = useMemo(
    () =>
      buildDecorate(
        wb,
        calc,
        locale,
        (sheetId, row) => store.isRowHidden(sheetId, row),
        // The same button again closes its menu.
        (m) => setMenu((cur) => (cur && cur.tableId === m.tableId && cur.columnId === m.columnId ? null : m)),
      ),
    [wb, calc, locale, store],
  );
  const close = useCallback(() => setMenu(null), []);
  const node = useMemo(() => createElement(TableOverlays, { store, menu, onCloseMenu: close }), [store, menu, close]);
  return { decorate, menu: node };
}
