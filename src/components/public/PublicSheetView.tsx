"use client";

// A spreadsheet seen through its public link: the real grid, read-only (scroll, select and copy
// work; values are calculated by the engine as in the editor), with its charts and smart tables,
// and tabs for its sheets. Nothing here can change it. Loaded by PublicSheet.tsx only for a
// spreadsheet, so other public pages don't download the grid and the formula engine.

import { Sheet as SheetIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ChartLayer } from "@/components/sheet/chart/ChartLayer";
import { Grid, type CellDecor, type GridGeometry } from "@/components/sheet/grid/Grid";
import { createSheetStore, SheetStoreContext, useSheet, type SheetStore } from "@/components/sheet/store";
import { useTableDecor } from "@/components/sheet/table/useTableDecor";
import { useLocale, useMessages } from "@/i18n/client";
import { sheetText } from "@/i18n/messages/sheet";
import { cn } from "@/lib/utils";
import { isBlankWorkbook, normalizeWorkbook } from "@/sheet/doc";

export function PublicSheetView({ pageId, content }: { pageId: string; content: unknown }) {
  const locale = useLocale();
  const t = useMessages(sheetText);
  const [store] = useState<SheetStore>(() => createSheetStore({ pageId, workbook: normalizeWorkbook(content, locale), locale, readOnly: true }));
  const blank = useSheet(store, (s) => isBlankWorkbook(s.workbook));

  if (blank) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-2 px-4 py-6 text-[14px] text-ink-3">
        <SheetIcon className="size-4 shrink-0" />
        {t.empty}
      </div>
    );
  }
  return (
    <SheetStoreContext.Provider value={store}>
      <ReadOnlySheet store={store} />
    </SheetStoreContext.Provider>
  );
}

function ReadOnlySheet({ store }: { store: SheetStore }) {
  const t = useMessages(sheetText);
  const sheets = useSheet(store, (s) => s.workbook.sheets);
  const current = useSheet(store, (s) => s.sheetId);
  const { decorate: tableDecor, menu } = useTableDecor(store);
  // The tables' sort and filter buttons change the spreadsheet: not here.
  const decorate = useCallback(
    (sheetId: string, row: number, col: number): CellDecor | null => {
      const d = tableDecor(sheetId, row, col);
      if (!d?.button) return d;
      const rest = { ...d };
      delete rest.button;
      return rest;
    },
    [tableDecor],
  );
  const overlay = useCallback((geom: GridGeometry) => <ChartLayer store={store} geom={geom} />, [store]);
  const tabs = useMemo(() => sheets.map((s) => ({ id: s.id, name: s.name })), [sheets]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-card">
      <div className="relative h-[min(72vh,640px)] min-h-[320px]">
        <div className="absolute inset-0">
          <Grid store={store} decorate={decorate} overlay={overlay} />
        </div>
      </div>
      {tabs.length > 1 && (
        <div role="tablist" aria-label={t.sheets} className="flex gap-1 overflow-x-auto border-t border-line bg-surface px-2 py-1.5 [scrollbar-width:thin]">
          {tabs.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === current}
              onClick={() => store.setSheet(s.id)}
              className={cn(
                "h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium transition-colors [@media(hover:none)]:h-9",
                s.id === current ? "bg-raised text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:bg-hover hover:text-ink",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {menu}
    </div>
  );
}
