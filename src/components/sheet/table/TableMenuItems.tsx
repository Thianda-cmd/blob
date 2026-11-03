"use client";

// Smart table entries for the cells' context menu (the Grid's `contextMenu` prop): outside a
// table "Als Tabelle formatieren" (Strg+T); inside one its settings, a chart of it, the totals
// row and clearing its filters.
//
//   <Grid contextMenu={(close) => <TableMenuItems store={store} close={close} />} … />

import { ChartScatter, FunnelX, Settings2, Sigma, TableProperties } from "lucide-react";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { sheetTableText } from "@/i18n/messages/sheetTable";
import { tableAt } from "@/sheet/table/model";
import { useSheet, type SheetStore } from "../store";
import { chartFromTable, clearAllTableFilters, makeTableFromSelection, openTablePanel, setTableTotals } from "./actions";

export function TableMenuItems({ store, close, separator = true }: { store: SheetStore; close: () => void; separator?: boolean }) {
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const table = useSheet(store, (s) => tableAt(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col));
  const mac = useIsMac();
  const t = sheetTableText[locale];
  if (readOnly) return null;
  const run = (f: () => void) => () => {
    close();
    f();
  };
  return (
    <>
      {!table ? (
        <MenuItem icon={<TableProperties />} shortcut={mac ? "⌘T" : locale === "de" ? "Strg+T" : "Ctrl+T"} onSelect={run(() => makeTableFromSelection(store))}>
          {t.makeTable}
        </MenuItem>
      ) : (
        <>
          <MenuItem icon={<Settings2 />} onSelect={run(() => openTablePanel(store, table.id))}>
            {t.openTable}
          </MenuItem>
          <MenuItem icon={<ChartScatter />} onSelect={run(() => chartFromTable(store, table.id))}>
            {t.chart}
          </MenuItem>
          <MenuItem icon={<Sigma />} active={table.totals} onSelect={run(() => setTableTotals(store, table.id, !table.totals))}>
            {t.totalsRow}
          </MenuItem>
          {Object.keys(table.filters).length > 0 && (
            <MenuItem icon={<FunnelX />} onSelect={run(() => clearAllTableFilters(store, table.id))}>
              {t.clearAll}
            </MenuItem>
          )}
        </>
      )}
      {separator && <MenuSeparator />}
    </>
  );
}
