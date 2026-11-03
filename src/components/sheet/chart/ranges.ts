// Ranges of a chart as text you can read and type: "B2:B8" on the chart's own sheet,
// "'Blatt 2'!B2:B8" elsewhere, and the grid's selection as a range.

import { areaName, parseArea, quoteSheetName } from "@/sheet/a1";
import { trimToData } from "@/sheet/chart/create";
import { sheetById } from "@/sheet/ops";
import type { RangeRef, Workbook } from "@/sheet/types";
import { activeArea, type SheetState } from "../store";

/** "B2:B8", or with the sheet's name when it is another sheet than `hostSheetId`. */
export function refText(ref: RangeRef | null, wb: Workbook, hostSheetId: string): string {
  if (!ref) return "";
  const area = areaName(ref);
  if (ref.sheetId === hostSheetId) return area;
  const sheet = wb.sheets.find((s) => s.id === ref.sheetId);
  return sheet ? `${quoteSheetName(sheet.name)}!${area}` : area;
}

export type ParsedRef = { ref: RangeRef } | { error: "invalid" } | { error: "sheet"; name: string } | null;

/** Typed text → a range (null for empty text). Accepts $, any case, "Blatt 2!B2" and "'Blatt 2'!B2". */
export function parseRef(text: string, wb: Workbook, hostSheetId: string): ParsedRef {
  const s = text.trim().replace(/\$/g, "");
  if (!s) return null;
  const bang = s.lastIndexOf("!");
  let sheetId = hostSheetId;
  let areaText = s;
  if (bang >= 0) {
    let name = s.slice(0, bang).trim();
    areaText = s.slice(bang + 1);
    if (name.startsWith("'") && name.endsWith("'") && name.length >= 2) name = name.slice(1, -1).replace(/''/g, "'");
    const sheet = wb.sheets.find((sh) => sh.name.toLowerCase() === name.toLowerCase());
    if (!sheet) return { error: "sheet", name };
    sheetId = sheet.id;
  }
  const area = parseArea(areaText);
  if (!area) return { error: "invalid" };
  return { ref: { sheetId, ...area } };
}

/**
 * The grid's selected range as a chart range (on the sheet on screen). Whole columns or rows are
 * cut to the cells with data, like Excel plots a column A:A only as far as it is filled.
 */
export function selectionRef(state: SheetState): RangeRef {
  const area = activeArea(state.selection);
  const sheet = sheetById(state.workbook, state.sheetId);
  const whole = sheet && ((area.r0 === 0 && area.r1 >= sheet.size.rows - 1) || (area.c0 === 0 && area.c1 >= sheet.size.cols - 1));
  const trimmed = whole && sheet ? trimToData(sheet, area) : null;
  return { sheetId: state.sheetId, ...(trimmed ?? area) };
}
