// Small DOM events between parts of the spreadsheet editor that don't hold each other:
// the grid's Ctrl+F opens the toolbar's find dialog, Shift+F3 opens the function browser.
//
// CONTRACT: dispatch with openSheetPanel(name); listen with window.addEventListener(SHEET_EVENT, …).

export const SHEET_EVENT = "blob-sheet";

export type SheetEventDetail = { open: "find" | "functions" | "format" };

export function openSheetPanel(open: SheetEventDetail["open"]) {
  window.dispatchEvent(new CustomEvent<SheetEventDetail>(SHEET_EVENT, { detail: { open } }));
}
