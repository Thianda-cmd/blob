"use client";

// What smart tables put above the editor: the open column menu and short messages ("Diese Zellen
// gehören schon zu einer Tabelle"). useTableDecor returns this as `menu`; SheetEditor renders it.

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { sheetTableText } from "@/i18n/messages/sheetTable";
import { useHydrated } from "@/lib/useHydrated";
import { cn } from "@/lib/utils";
import { useSheet, type SheetStore } from "../store";
import { ColumnMenu } from "./ColumnMenu";
import type { ColumnMenuRequest } from "./decor";
import { hideTableNotice, useTableNotice } from "./notice";

export function TableOverlays({ store, menu, onCloseMenu }: { store: SheetStore; menu: ColumnMenuRequest | null; onCloseMenu: () => void }) {
  // The menu only while its column exists on the sheet on screen (undo, another sheet: it goes).
  const open = useSheet(store, (s) => {
    if (!menu) return false;
    const t = s.workbook.tables.find((x) => x.id === menu.tableId);
    return !!t && t.sheetId === s.sheetId && t.columns.some((c) => c.id === menu.columnId);
  });
  return (
    <>
      {menu && open && <ColumnMenu key={`${menu.tableId}:${menu.columnId}`} store={store} request={menu} onClose={onCloseMenu} />}
      <TableToast store={store} />
    </>
  );
}

function TableToast({ store }: { store: SheetStore }) {
  const notice = useTableNotice(store);
  const locale = useSheet(store, (s) => s.locale);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(20px,calc(env(safe-area-inset-bottom)+12px))] z-[75] flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role={notice.tone === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className={cn(
              "pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border bg-raised py-2 pl-3.5 pr-1.5 text-[13px] leading-snug shadow-pop",
              notice.tone === "error" ? "border-danger/30 text-ink" : "border-line text-ink-2",
            )}
          >
            {notice.tone === "error" && <span aria-hidden className="mt-[5px] size-2 shrink-0 rounded-full bg-danger" />}
            <span className="min-w-0 flex-1 py-0.5">{notice.text}</span>
            <button
              type="button"
              onClick={() => hideTableNotice(store, notice.id)}
              aria-label={sheetTableText[locale].close}
              className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-8"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
