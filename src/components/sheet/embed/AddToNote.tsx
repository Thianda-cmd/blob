"use client";

// "Add to note" ("In Notiz einfügen"): pick a note (or make a new one) and the chart, table or
// range appears there as a live block. Opened from the chart and table panels and the grid's menu.
//
// CONTRACT: keep the props.

import type { ReactNode } from "react";
import type { SheetEmbedItem } from "@/sheet/embed";

export function AddToNoteDialog({ open, onClose, pageId, item }: { open: boolean; onClose: () => void; pageId: string; item: SheetEmbedItem }): ReactNode {
  void open;
  void onClose;
  void pageId;
  void item;
  return null;
}
