"use client";

// CONTRACT: the function library (fx): categories, search in German and English, each function's
// help (src/sheet/engine/docs.ts). onPick gets the canonical (English) name.

import type { ReactNode } from "react";

export function FunctionBrowser({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (fn: string) => void }): ReactNode {
  void open;
  void onClose;
  void onPick;
  return null;
}
