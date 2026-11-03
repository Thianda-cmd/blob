"use client";

// The spreadsheet open in this tab, for "Duplizieren" (useDuplicatePage): its store, read as it is
// on screen when a copy is made. A module of its own that PageTopBar loads only on spreadsheet
// pages: the store brings the formula engine along, which notes and presentations don't need.

import { useContext, useEffect } from "react";
import { storedContent } from "@/components/sheet/saver";
import { SheetStoreContext } from "@/components/sheet/store";
import { keepOpenSheet } from "./useDuplicatePage";

export function OpenSheetCopy({ pageId }: { pageId: string }) {
  const store = useContext(SheetStoreContext);
  useEffect(() => {
    if (!store) return;
    return keepOpenSheet(pageId, () => {
      // What is still being typed in a cell counts, as when saving or exporting. A formula with a
      // mistake can't go in: its cell stays open and says why, and no copy is made (null).
      if (store.get().edit && !store.commitEdit(null)) return null;
      const s = store.get();
      const { content, plain } = storedContent(s.workbook, s.calc, s.locale);
      return { content, plain_text: plain };
    });
  }, [pageId, store]);
  return null;
}
