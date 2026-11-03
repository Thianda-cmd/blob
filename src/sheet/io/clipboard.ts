// The system clipboard: copying cells for Excel, Google Sheets, Numbers, Word or a note (TSV and an
// HTML table), and pasting from them (TSV, CSV-ish text, HTML tables from Excel and web pages).
//
// CONTRACT: keep names and signatures.

/** Rows of cell texts from clipboard data; null when it isn't table-like (then paste as one value). */
export function parseClipboard(data: { text?: string; html?: string }): string[][] | null {
  void data;
  throw new Error("clipboard: parseClipboard not implemented");
}

/** Tab-separated text (quotes around cells with tabs, line breaks or quotes, like Excel). */
export function toTsv(rows: string[][]): string {
  void rows;
  throw new Error("clipboard: toTsv not implemented");
}

/** An HTML table (escaped), optionally with bold/colour per cell, for pasting into rich editors. */
export function toHtmlTable(rows: string[][], styles?: ({ bold?: boolean; align?: "left" | "center" | "right" } | null)[][]): string {
  void rows;
  void styles;
  throw new Error("clipboard: toHtmlTable not implemented");
}
