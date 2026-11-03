"use client";

// CONTRACT: <Toolbar store={store} /> is placed by SheetEditor. Implemented by the editor chrome.

import type { ReactNode } from "react";
import type { SheetStore } from "../store";

export function Toolbar({ store }: { store: SheetStore }): ReactNode {
  void store;
  return null;
}
