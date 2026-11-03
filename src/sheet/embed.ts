// What a note can show from a spreadsheet (the "sheetEmbed" note block): a chart, a smart table or
// a range of cells, always live from the spreadsheet.
//
// CONTRACT: shared by the note block (src/components/editor/blocks/SheetEmbed.tsx) and the
// "Add to note" dialog (src/components/sheet/embed/AddToNote.tsx).

import type { Area } from "./types";

export type SheetEmbedItem =
  | { kind: "chart"; chartId: string }
  | { kind: "table"; tableId: string }
  | { kind: "range"; sheetId: string; area: Area };

/** The note block's attributes. */
export type SheetEmbedAttrs = { pageId: string | null; item: SheetEmbedItem | null };
