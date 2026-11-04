// The name of the note that "In Notiz einfügen → Neue Notiz" makes for a spreadsheet (AddToNote.tsx),
// kept apart from the dialog so scripts/check-palette.ts can check it without loading the app.

/** A page's title has at most 200 characters (the database's limit). */
const TITLE_MAX = 200;

/**
 * The name of a note made for a spreadsheet: the spreadsheet's name with an ending (`named` puts it
 * on: "Kalibrierung – Auswertung"), so the sidebar and the search don't show two pages of one name.
 * A long name is shortened before the ending goes on, by characters as the database counts them; a
 * spreadsheet without a name gives a note without one, never just "– Auswertung".
 */
export function newNoteTitle(sheetTitle: string | null | undefined, named: (sheet: string) => string): string {
  const name = sheetTitle?.trim();
  if (!name) return "";
  const room = TITLE_MAX - Array.from(named("")).length;
  return named(Array.from(name).slice(0, room).join("").trimEnd());
}
