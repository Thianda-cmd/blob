// What the command palette's "new page" actions make of the query (CommandPalette.tsx), kept apart
// from the component so the rules can be checked without a browser (scripts/check-sheet-doc.ts).

/** The words that name a kind of page itself, in both languages ("Tabelle" means "make a spreadsheet"). */
export const KIND_NAMES = {
  note: "notiz note",
  ink: "handschrift handwriting",
  sheet: "tabelle tabellen spreadsheet sheet excel tabellenkalkulation",
  deck: "präsentation praesentation presentation folien slides",
} as const;

export type NewKind = keyof typeof KIND_NAMES;

/**
 * A new page is called what was typed ("Neue Notiz „Mitochondrien“"), unless the query names the kind
 * of page: "Tabelle" or "neue Tabelle" makes a spreadsheet without a name (its templates give it one)
 * and "Tabelle Titration" one called "Titration" (rank 2: that item comes first, before the pages
 * found). On its way to one of those words ("tab"), the page has no name either; on its way to one of
 * the related `keywords` ("kalib"), it keeps the query as its name (rank 1: first among the new pages).
 * `bare` is the action's own label ("Neue Tabelle"); `q` the query as typed (trimmed).
 */
export function newPageFor(kind: NewKind, q: string, bare: string, keywords?: string): { rank: 0 | 1 | 2; title: string } {
  const lower = q.toLowerCase();
  const names = [bare.toLowerCase(), ...KIND_NAMES[kind].split(" ")].sort((a, b) => b.length - a.length);
  const kindName = names.find((name) => lower === name || lower.startsWith(`${name} `));
  if (kindName) return { rank: 2, title: q.length === lower.length ? q.slice(kindName.length).trim() : "" };
  if (lower.length > 1 && names.some((name) => name.startsWith(lower))) return { rank: 1, title: "" };
  if (lower.length > 1 && keywords?.split(" ").some((w) => w.startsWith(lower))) return { rank: 1, title: q };
  return { rank: 0, title: q };
}
