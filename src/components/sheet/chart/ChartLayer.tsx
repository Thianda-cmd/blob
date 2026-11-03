"use client";

// The charts floating on the sheet on screen (Grid overlay): tap to select, drag to move, handles
// to resize, double-tap or the settings button to open the chart panel, Delete to remove.
//
// CONTRACT: <ChartLayer store geom /> is passed as the Grid's overlay by SheetEditor.

import type { ReactNode } from "react";
import type { GridGeometry } from "../grid/Grid";
import type { SheetStore } from "../store";

export function ChartLayer({ store, geom }: { store: SheetStore; geom: GridGeometry }): ReactNode {
  void store;
  void geom;
  return null;
}
