// Chart actions the toolbar, context menu and smart tables call.
//
// CONTRACT: keep names and signatures.

import type { ChartKind } from "@/sheet/types";
import type { SheetStore } from "../store";

/** A chart from the current selection (or the smart table the selection is in): added, selected, its panel opened. false when there is nothing to chart. */
export function insertChart(store: SheetStore, kind?: ChartKind): boolean {
  void store;
  void kind;
  throw new Error("chart: insertChart not implemented");
}
