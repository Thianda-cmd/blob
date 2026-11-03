"use client";

// What smart tables put above the editor: the open column menu (their messages, such as "Diese
// Zellen gehören schon zu einer intelligenten Tabelle", are the editor's notices: ../notice.ts).
// useTableDecor returns this as `menu`; SheetEditor renders it.

import { useSheet, type SheetStore } from "../store";
import { ColumnMenu } from "./ColumnMenu";
import type { ColumnMenuRequest } from "./decor";

export function TableOverlays({ store, menu, onCloseMenu }: { store: SheetStore; menu: ColumnMenuRequest | null; onCloseMenu: () => void }) {
  // The menu only while its column exists on the sheet on screen (undo, another sheet: it goes).
  const open = useSheet(store, (s) => {
    if (!menu) return false;
    const t = s.workbook.tables.find((x) => x.id === menu.tableId);
    return !!t && t.sheetId === s.sheetId && t.columns.some((c) => c.id === menu.columnId);
  });
  return menu && open ? <ColumnMenu key={`${menu.tableId}:${menu.columnId}`} store={store} request={menu} onClose={onCloseMenu} /> : null;
}
