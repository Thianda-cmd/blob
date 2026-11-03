// What the grid draws for smart tables, cell by cell: the coloured header with its sort and filter
// button, banded rows and the totals row. Built once per workbook and calculation; every call is a
// few comparisons (the grid asks for each visible cell on every render).
//
// No React here, so the check script can test it; useTableDecor wraps it for the editor.

import type { Locale } from "@/i18n/config";
import { sheetTableText } from "@/i18n/messages/sheetTable";
import type { Calc } from "@/sheet/engine";
import { columnNames, dataRows, tableBands } from "@/sheet/table/model";
import type { TableSpec, Workbook } from "@/sheet/types";
import type { CellDecor } from "../grid/Grid";
import { tableLook } from "./look";

/** Which column menu to open, and the header button it hangs from. */
export type ColumnMenuRequest = { tableId: string; columnId: string; anchor: HTMLElement };

type Prepared = {
  header: CellDecor[];
  totals: CellDecor;
  band: CellDecor;
  /** Band of a data row (0 or 1). */
  bandOf: (row: number) => number;
};

export function buildDecorate(
  wb: Workbook,
  calc: Calc,
  locale: Locale,
  isRowHidden: (sheetId: string, row: number) => boolean,
  open: (m: ColumnMenuRequest) => void,
): (sheetId: string, row: number, col: number) => CellDecor | null {
  const t = sheetTableText[locale];
  const bySheet = new Map<string, TableSpec[]>();
  for (const table of wb.tables) {
    const list = bySheet.get(table.sheetId);
    if (list) list.push(table);
    else bySheet.set(table.sheetId, [table]);
  }
  // Rows hidden on a sheet at all (by hand or by any table's filter): without them banding is plain parity.
  const anyHidden = new Map<string, boolean>();
  const sheetHides = (sheetId: string) => {
    let v = anyHidden.get(sheetId);
    if (v === undefined) {
      const sheet = wb.sheets.find((s) => s.id === sheetId);
      v = !!sheet && (Object.values(sheet.rows).some((r) => r.hidden) || wb.tables.some((x) => x.sheetId === sheetId && Object.keys(x.filters).length > 0));
      anyHidden.set(sheetId, v);
    }
    return v;
  };

  const prepared = new Map<string, Prepared>();
  const prepare = (table: TableSpec): Prepared => {
    const look = tableLook(table.style);
    const names = columnNames(wb, calc, table, locale);
    const header = table.columns.map((column, i): CellDecor => {
      const state = table.filters[column.id] ? "filtered" : table.sort?.column === column.id ? (table.sort.dir === "asc" ? "sortedAsc" : "sortedDesc") : "plain";
      return {
        fill: look.headerFill,
        color: look.ink,
        bold: true,
        lineBelow: "strong",
        button: { state, label: t.headerButton(names[i], state), onClick: (anchor) => open({ tableId: table.id, columnId: column.id, anchor }) },
      };
    });
    const d = dataRows(table);
    let bandOf: (row: number) => number = (row) => (row - d.r0) % 2;
    if (sheetHides(table.sheetId)) {
      let bands: Uint8Array | null = null;
      bandOf = (row) => {
        bands ??= tableBands(table, (r) => isRowHidden(table.sheetId, r));
        return bands[row - d.r0] ?? 0;
      };
    }
    return {
      header,
      totals: { fill: look.totalsFill, color: look.ink, bold: true, lineAbove: "strong" },
      band: { fill: look.bandFill },
      bandOf,
    };
  };

  return (sheetId, row, col) => {
    const tables = bySheet.get(sheetId);
    if (!tables) return null;
    for (const table of tables) {
      const a = table.area;
      if (row < a.r0 || row > a.r1 || col < a.c0 || col > a.c1) continue;
      let p = prepared.get(table.id);
      if (!p) prepared.set(table.id, (p = prepare(table)));
      if (row === a.r0) return p.header[col - a.c0] ?? null;
      if (table.totals && row === a.r1) return p.totals;
      // The first data row stays plain under the coloured header; every second row is shaded.
      return table.banded && p.bandOf(row) === 1 ? p.band : null;
    }
    return null;
  };
}
