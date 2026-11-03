"use client";

// CONTRACT: <FormulaBar store={store} /> is placed by SheetEditor. Implemented by the editor chrome.

import type { ReactNode } from "react";
import type { SheetStore } from "../store";

export function FormulaBar({ store }: { store: SheetStore }): ReactNode {
  void store;
  return null;
}
