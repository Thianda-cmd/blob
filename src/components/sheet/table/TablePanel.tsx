"use client";

// A smart table's settings: name, colour, banded rows, totals row and each column's total,
// "Diagramm erstellen", convert back to plain cells, remove.
//
// CONTRACT: <TablePanel store tableId onClose /> is placed by SheetEditor.

import type { ReactNode } from "react";
import type { SheetStore } from "../store";

export function TablePanel({ store, tableId, onClose }: { store: SheetStore; tableId: string; onClose: () => void }): ReactNode {
  void store;
  void tableId;
  void onClose;
  return null;
}
