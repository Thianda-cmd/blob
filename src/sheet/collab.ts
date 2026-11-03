// Saving a spreadsheet that several people edit at once (like presentations, src/components/deck/collab.ts):
// each save names the revision it builds on; when someone else saved in between, merge cell by
// cell — whoever changed a cell (or a chart, a table, a sheet's settings) since the common base
// wins, and if both did, ours. Sheets, charts and tables added on either side are kept; deleted
// ones stay deleted.
//
// CONTRACT: keep names and signatures.

import type { Workbook } from "./types";

export function mergeWorkbooks(base: Workbook, mine: Workbook, theirs: Workbook): Workbook {
  void base;
  void mine;
  void theirs;
  throw new Error("collab: mergeWorkbooks not implemented");
}
