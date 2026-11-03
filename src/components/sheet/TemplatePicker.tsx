"use client";

// Shown in a new, still empty spreadsheet: start blank or from a lab template.
//
// CONTRACT: SheetEditor shows it while the workbook is blank; onPick gets the template's workbook.

import type { ReactNode } from "react";
import type { Workbook } from "@/sheet/types";

export function TemplatePicker({ onPick, onDismiss }: { onPick: (wb: Workbook) => void; onDismiss: () => void }): ReactNode {
  void onPick;
  void onDismiss;
  return null;
}
