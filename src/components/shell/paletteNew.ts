// What the command palette's "new page" actions make of the query, the words that find its actions,
// and the order of everything it lists (CommandPalette.tsx), kept apart from the component so the
// rules can be checked without a browser, with the real words (scripts/check-sheet-doc.ts,
// scripts/check-palette.ts).

/** The words that name a kind of page itself, in both languages ("Tabelle" means "make a spreadsheet"). */
export const KIND_NAMES = {
  note: "notiz note",
  ink: "handschrift handwriting",
  sheet: "tabelle tabellen spreadsheet sheet excel tabellenkalkulation",
  deck: "präsentation praesentation presentation folien slides",
} as const;

// Extra words that find an action besides its label, in both languages.
export const CV_WORDS = "cv lebenslauf resume résumé bewerbung application praktikum internship ausbildung apprenticeship";
export const FOLDER_WORDS = "ordner folder";
export const INK_WORDS = "handschrift handwriting stift pen zeichnen draw drawing skizze sketch tablet s pen";
export const SHEET_WORDS = "tabelle tabellen spreadsheet sheet excel tabellenkalkulation calc rechnen formel formula diagramm chart kalibrierung kalibriergerade calibration messreihe messwerte mittelwert trendlinie";
export const NOTEBOOK_WORDS = "notizbuch notebook heft privat";
export const PROJECT_WORDS = "projekt project board kanban gruppenarbeit gruppenprojekt referat klassenfahrt team";
export const NOTES_WORDS = "notizen notes wissensnetz graph tags karteikarten";
export const CALENDAR_WORDS = "kalender calendar termin event stundenplan timetable schedule geburtstag birthday woche week monat month";

export type NewKind = keyof typeof KIND_NAMES;

/**
 * A new page is called what was typed ("Neue Notiz „Mitochondrien“"), unless the query names the kind
 * of page: "Tabelle" or "neue Tabelle" makes a spreadsheet without a name (its templates give it one)
 * and "Tabelle Titration" one called "Titration" (rank 2: that item moves up, see paletteOrder). On
 * its way to one of those words ("tab"), the page has no name either; on its way to one of
 * the related `keywords` ("kalib"), it keeps the query as its name (rank 1 for both: up among the new
 * pages, the first kind ahead of the second).
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

/** An entry of the palette, as far as its place in the list goes. */
export type PaletteEntry = {
  /** New pages' actions start with "new" ("new-sheet", "new-task"). */
  id: string;
  label: string;
  /** Extra words that find an action (in both languages), e.g. "cv" for „Neuer Lebenslauf“. */
  keywords?: string;
  /** New pages: what newPageFor made of the query. */
  rank?: number;
  title?: string;
};

/**
 * The palette's list. Without a query: the first three actions, then the recent pages. With one:
 * the pages found (by title or tag), then the other `results` (found in the text, tags, subjects,
 * topics), the actions that match ("cv" → „Neuer Lebenslauf“, so Enter doesn't make a note called
 * "cv" when nothing else matches), and last the new pages named after the query: first the one whose
 * kind the query is on its way to ("tab" → Tabelle), then those it is on its way to a word of ("tab"
 * → tablet, handwriting), then the rest.
 *
 * A query that names a kind of page (rank 2) moves making one up, and drops the other new pages
 * (nobody wants a note called "Tabelle"):
 *   - just the kind ("Tabelle", "neue Tabelle"): first of all, above the pages, which would all match
 *     ("Unbenannte Tabelle");
 *   - the kind and a name ("Notiz zur Zellatmung"): right after the pages found, so Enter still opens
 *     the page "Notiz zur Zellatmung" instead of making a note "zur Zellatmung"; first when no page
 *     is found.
 */
export function paletteOrder<T extends PaletteEntry>(q: string, { actions, pages, results }: { actions: T[]; pages: T[]; results: T[] }): T[] {
  if (!q) return [...actions.slice(0, 3), ...pages];
  const lower = q.toLowerCase();
  const isNew = (a: T) => a.id.startsWith("new");
  const hit = (a: T) => a.label.toLowerCase().includes(lower) || (lower.length > 1 && Boolean(a.keywords?.split(" ").some((w) => w.startsWith(lower))));
  const matching = actions.filter((a) => !isNew(a) && hit(a));
  const asked = actions.filter((a) => isNew(a) && a.rank === 2);
  if (asked.some((a) => !a.title)) return [...asked, ...matching, ...pages, ...results];
  if (asked.length) return [...pages, ...asked, ...matching, ...results];
  // Rank 1 without a name: on its way to the kind itself; with one (the query): to a word of it.
  // (A stable sort: the same place keeps the order of the actions.)
  const place = (a: T) => (a.rank === 1 ? (a.title ? 1 : 2) : 0);
  const newPages = actions.filter(isNew).sort((a, b) => place(b) - place(a));
  return [...pages, ...results, ...matching, ...newPages];
}
