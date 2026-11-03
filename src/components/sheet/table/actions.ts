// Smart table actions the toolbar and context menu call.
//
// CONTRACT: keep names and signatures.

import type { SheetStore } from "../store";

/** Turn the selection into a smart table, select it and open its panel. false when it can't (overlaps another table, nothing there). */
export function makeTableFromSelection(store: SheetStore): boolean {
  void store;
  throw new Error("table: makeTableFromSelection not implemented");
}
