// The heavy half of the spreadsheets shown in notes (sheetEmbedData.ts is the light one): reading a
// stored workbook and calculating it as the spreadsheet does. It loads only once a note shows a
// spreadsheet block or exports one, so notes without spreadsheets don't download the formula engine.

import type { Locale } from "@/i18n/config";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc, type Calc } from "@/sheet/engine";
import { filteredRows } from "@/sheet/table/model";
import type { Workbook } from "@/sheet/types";

/** Stored content → a workbook (a damaged one gets its sheet names in `locale`). */
export const readWorkbook = (content: unknown, locale: Locale): Workbook => normalizeWorkbook(content, locale);

const calcs = new WeakMap<Workbook, Map<Locale, Calc>>();
const filterMemo = new WeakMap<Calc, Map<string, ReadonlySet<number>>>();
const NONE: ReadonlySet<number> = new Set<number>();

/** Rows a smart table's filter hides (worked out once per calculation and sheet), as the spreadsheet does. */
function filterHidden(calc: Calc, sheetId: string, locale: Locale): ReadonlySet<number> {
  const wb = calc.workbook;
  if (!wb.tables.some((t) => t.sheetId === sheetId && Object.keys(t.filters).length > 0)) return NONE;
  let bySheet = filterMemo.get(calc);
  if (!bySheet) filterMemo.set(calc, (bySheet = new Map()));
  const known = bySheet.get(sheetId);
  if (known) return known;
  // While a sheet's filters are worked out (they read values), only rows hidden by hand count.
  bySheet.set(sheetId, NONE);
  let rows: ReadonlySet<number> = NONE;
  try {
    rows = filteredRows(wb, calc, sheetId, locale);
  } catch {
    rows = NONE;
  }
  bySheet.set(sheetId, rows);
  return rows;
}

/**
 * The values of a workbook, calculated as the spreadsheet does: SUBTOTAL(1xx) skips hidden and
 * filtered rows, SUBTOTAL(1–11) the filtered ones, also when they are hidden by hand as well.
 */
export function calcOf(wb: Workbook, locale: Locale): Calc {
  let byLocale = calcs.get(wb);
  if (!byLocale) calcs.set(wb, (byLocale = new Map()));
  let calc = byLocale.get(locale);
  if (!calc) {
    let self: Calc | null = null;
    const filtered = (sheetId: string, row: number) => (self ? filterHidden(self, sheetId, locale).has(row) : false);
    calc = createCalc(wb, {
      locale,
      isRowHidden: (sheetId, row) => {
        const sheet = wb.sheets.find((s) => s.id === sheetId);
        if (!sheet) return false;
        return !!sheet.rows[String(row)]?.hidden || filtered(sheetId, row);
      },
      isRowFiltered: filtered,
    });
    self = calc;
    byLocale.set(locale, calc);
  }
  return calc;
}
