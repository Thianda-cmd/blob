// Limits for reading spreadsheet files and pasted tables (src/sheet/io), shared by the readers.
// What they read can come from anywhere: a few kilobytes of zip can name one long text for a
// million cells, so the readers stop with "too big" rather than build what no page could hold.

import { MAX_COLS, MAX_ROWS } from "../types";

/** The most sheets a spreadsheet holds (as src/sheet/doc.ts keeps). */
export const MAX_SHEETS = 250;

/**
 * Characters of text one file may bring into its cells (values, formulas and notes): over three
 * times what a page can save (5 MB), so a file a little too big still gets the page's own message
 * with its size, and no file can make the reader build gigabytes of text.
 */
export const MAX_IMPORT_TEXT = 16_000_000;

/** How many rows, and cells in a row, of a table's text are read (more can't land in a sheet). */
export type ReadLimit = { rows: number; cols: number };

/** A whole sheet, plus a row to tell that there was more (an import says so). */
export const FILE_LIMIT: ReadLimit = { rows: MAX_ROWS + 1, cols: MAX_COLS };
