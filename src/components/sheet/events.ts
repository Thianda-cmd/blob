// Small DOM events between parts of the spreadsheet editor that don't hold each other:
// the grid's Ctrl+F opens the toolbar's find panel (Ctrl+H, ⌘⌥F on a Mac, with the replace row
// shown), Shift+F3 opens the function browser, Ctrl+1 the number formats.
//
// CONTRACT: dispatch with openSheetPanel(name); listen with window.addEventListener(SHEET_EVENT, …).

export const SHEET_EVENT = "blob-sheet";

export type SheetEventDetail = { open: "find" | "replace" | "functions" | "format" };

export function openSheetPanel(open: SheetEventDetail["open"]) {
  window.dispatchEvent(new CustomEvent<SheetEventDetail>(SHEET_EVENT, { detail: { open } }));
}
