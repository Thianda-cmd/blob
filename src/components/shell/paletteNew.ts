// What the command palette's "new page" actions make of the query, the words that find its actions,
// the pages a query finds and the order of everything it lists (CommandPalette.tsx), kept apart from
// the component so the rules can be checked without a browser, with the real words
// (scripts/check-sheet-doc.ts, scripts/check-palette.ts).

import type { PageKind } from "@/lib/types";

/**
 * The words that name a kind of page itself, in both languages ("Tabelle" means "make a spreadsheet").
 * Spreadsheets are made with Blobxcel, so "Blobxcel" names them too.
 */
export const KIND_NAMES = {
  note: "notiz note",
  ink: "handschrift handschriften handwriting",
  sheet: "tabelle tabellen spreadsheet spreadsheets sheet sheets excel blobxcel tabellenkalkulation",
  deck: "präsentation präsentationen praesentation praesentationen presentation presentations folien slides",
} as const;

/** "Neue Tabelle", "new spreadsheet": the word for new before a kind's name still just names the kind. */
const NEW_WORDS = ["neue", "new"];

// Extra words that find an action besides its label, in both languages.
export const CV_WORDS = "cv lebenslauf resume résumé bewerbung application praktikum internship ausbildung apprenticeship";
export const FOLDER_WORDS = "ordner folder";
export const INK_WORDS = "handschrift handwriting stift pen zeichnen draw drawing skizze sketch tablet s pen";
export const SHEET_WORDS = "tabelle tabellen spreadsheet sheet excel blobxcel tabellenkalkulation calc rechnen formel formula diagramm chart kalibrierung kalibriergerade calibration messreihe messwerte mittelwert trendlinie";
export const NOTEBOOK_WORDS = "notizbuch notebook heft privat";
export const PROJECT_WORDS = "projekt project board kanban gruppenarbeit gruppenprojekt referat klassenfahrt team";
export const NOTES_WORDS = "notizen notes wissensnetz graph tags karteikarten";
export const CALENDAR_WORDS = "kalender calendar termin event stundenplan timetable schedule geburtstag birthday woche week monat month";
/** Words that ask for a list of your pages of a kind ("meine Tabellen", "all spreadsheets"). */
export const LIST_WORDS = "meine my alle all liste list übersicht overview";

/** Words that find the lists of presentations and of handwritten notes (with LIST_WORDS). */
export const DECK_WORDS = "präsentation präsentationen praesentation praesentationen presentation presentations folien slides";
export const INK_LIST_WORDS = "handschrift handschriften handwriting handwritten";

/** The palette's action that lists your spreadsheets (/notes?kind=sheet): "Alle Tabellen". */
export const SHEETS_LIST_ID = "sheets";
/** … your presentations (/notes?kind=deck) and your handwritten notes (/notes?kind=ink). */
export const DECKS_LIST_ID = "decks";
export const INKS_LIST_ID = "inks";
/** A plural kind word alone asks for the list of that kind first, then a new one ("Tabellen", "Präsentationen"). */
const LIST_KIND_WORDS = new Map([
  ["tabellen", SHEETS_LIST_ID],
  ["spreadsheets", SHEETS_LIST_ID],
  ["sheets", SHEETS_LIST_ID],
  ["präsentationen", DECKS_LIST_ID],
  ["praesentationen", DECKS_LIST_ID],
  ["presentations", DECKS_LIST_ID],
  ["handschriften", INKS_LIST_ID],
]);

export type NewKind = keyof typeof KIND_NAMES;

/**
 * A new page is called what was typed ("Neue Notiz „Mitochondrien“"), unless the query names the kind
 * of page: "Tabelle" or "neue Tabelle" makes a spreadsheet without a name (its templates give it one)
 * and "Tabelle Titration" one called "Titration" (rank 2: that item moves up, see paletteOrder). On
 * its way to one of those words ("tab"), the page has no name either; on its way to one of
 * the related `keywords` ("kalib"), it keeps the query as its name (rank 1 for both: up among the new
 * pages, the first kind ahead of the second).
 * `bare` is the action's own label ("Neue Blobxcel-Tabelle"); `q` the query as typed (trimmed).
 */
export function newPageFor(kind: NewKind, q: string, bare: string, keywords?: string): { rank: 0 | 1 | 2; title: string } {
  const lower = q.toLowerCase();
  const words = KIND_NAMES[kind].split(" ");
  // (The action's own label, the kind's names, and those after "neue"/"new": "neue Tabelle" still
  // makes a spreadsheet now that its action says "Neue Blobxcel-Tabelle".)
  const names = [bare.toLowerCase(), ...words, ...NEW_WORDS.flatMap((n) => words.map((w) => `${n} ${w}`))].sort((a, b) => b.length - a.length);
  const kindName = names.find((name) => lower === name || lower.startsWith(`${name} `));
  if (kindName) return { rank: 2, title: q.length === lower.length ? q.slice(kindName.length).trim() : "" };
  if (lower.length > 1 && names.some((name) => name.startsWith(lower))) return { rank: 1, title: "" };
  if (lower.length > 1 && keywords?.split(" ").some((w) => w.startsWith(lower))) return { rank: 1, title: q };
  return { rank: 0, title: q };
}

/** The words that name a kind of page when looking for one: the kinds above, and folders ("Ordner Chemie"). */
const FIND_KIND_NAMES: Partial<Record<PageKind, string>> = { ...KIND_NAMES, folder: FOLDER_WORDS };

const isLetter = (c = "") => /[\p{L}\p{M}]/u.test(c);
const isDigit = (c = "") => /\p{Nd}/u.test(c);
/** A number goes on: a digit, or a decimal comma or point with one ("pH 7,4", "Versuch 2.1", "12.02."). */
const goesOn = (a = "", b = "") => isDigit(a) || (/[.,]/.test(a) && isDigit(b));

/**
 * Whether `part` starts a word of `title` (both in lower case): "photo" in "Photometrie", "lab" in
 * "sweep-lab", "3" in "Versuch3"; not "titration" in "Rücktitration" or "a" in "Nitrat". A number
 * counts whole: "3" is not in "Versuch 13" or "2023", "7" not in "pH 7,4", "Messung 1" not in
 * "Messung 12.02.".
 */
function startsWord(title: string, part: string): boolean {
  const letter = isLetter(part[0]);
  const digit = isDigit(part[0]);
  const number = isDigit(part[part.length - 1]);
  for (let at = title.indexOf(part); at >= 0; at = title.indexOf(part, at + 1)) {
    if (letter && isLetter(title[at - 1])) continue;
    if (digit && goesOn(title[at - 1], title[at - 2])) continue;
    const end = at + part.length;
    if (number && goesOn(title[end], title[end + 1])) continue;
    return true;
  }
  return false;
}

/**
 * How a query finds a page by its title (as shown: pageTitle, "Unbenannte Tabelle" for one without
 * a name) and its kind, the best the highest:
 *   3: the title has the query as typed ("Zellatmung Teil 2" for "zellatmung teil"), as the palette
 *      always found pages.
 *   2: the query starts with the name of a kind of page and goes on with a name ("Tabelle Nitrat",
 *      "Notiz zur Zellatmung", "Ordner Chemie"), and the page is of that kind with the name in its
 *      title as typed ("Photometrie Nitrat"). So it is listed before "Neue Tabelle „Nitrat“"
 *      (paletteOrder), and Enter opens it instead of making another one.
 *   1: each word is in the title on its own, in any order ("nitrat photometrie" finds "Photometrie
 *      Nitrat"); after a kind's name, the other words in a page of that kind.
 *   0: not found.
 * Words from 2 down count where a word of the title starts, numbers whole (startsWord), so "Tabelle
 * Versuch 3" opens "Versuch 3", not a newer "Versuch 13", and makes it when there is none; "Tabelle
 * Titration" doesn't open "Rücktitration". The kind's name alone ("Tabelle") only finds the titles it
 * is in: making one comes first then.
 */
function pageMatcher(q: string): (title: string, kind: PageKind) => 0 | 1 | 2 | 3 {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const typed = words.join(" ");
  const [first, ...rest] = words;
  const name = rest.join(" ");
  const kinds = rest.length ? (Object.keys(FIND_KIND_NAMES) as PageKind[]).filter((kind) => FIND_KIND_NAMES[kind]?.split(" ").includes(first)) : [];
  return (title, kind) => {
    const lower = title.toLowerCase();
    if (lower.includes(typed)) return 3;
    const ofKind = kinds.includes(kind);
    if (ofKind && startsWord(lower, name)) return 2;
    const all = (some: string[]) => some.every((w) => startsWord(lower, w));
    return all(words) || (ofKind && all(rest)) ? 1 : 0;
  };
}

/**
 * The pages the palette lists for a query (CommandPalette.tsx; scripts/check-palette.ts checks it):
 * found by their title (pageMatcher, `titleOf` gives it as shown) or a tag ("klausur"; "#klausur"
 * looks at tags only). The best first, a tag as good as the title with the query as typed (the
 * palette's order before the words counted on their own), and the most recent first among equals. At
 * most 12; without a query, the 6 most recent. `tag`: the tag that found a page its title didn't
 * (shown next to it).
 */
export function findPages<P extends { kind: PageKind; tags: readonly string[]; updated_at: string }>(q: string, pages: readonly P[], titleOf: (page: P) => string): { page: P; tag?: string }[] {
  const lower = q.toLowerCase();
  const byTitle = pageMatcher(q);
  const tagQuery = lower.replace(/^#/, "");
  return pages
    .map((page) => {
      const title = lower.startsWith("#") ? 0 : byTitle(titleOf(page), page.kind);
      const tag = tagQuery ? page.tags.find((t) => t.toLowerCase().includes(tagQuery)) : undefined;
      return { page, title, tag, rank: tag ? 3 : title };
    })
    .filter((f) => f.rank)
    .sort((a, b) => b.rank - a.rank || b.page.updated_at.localeCompare(a.page.updated_at))
    .slice(0, q ? 12 : 6)
    .map(({ page, title, tag }) => ({ page, tag: title ? undefined : tag }));
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
 * A plural on its own ("Tabellen", "spreadsheets", "Präsentationen", "Handschriften") asks for the
 * list first ("Alle Tabellen"), then a new one. An action is found by its label, by a keyword the query starts, or by each word of a
 * query of several ("meine Tabellen", "my spreadsheets": "Alle Tabellen").
 */
export function paletteOrder<T extends PaletteEntry>(q: string, { actions, pages, results }: { actions: T[]; pages: T[]; results: T[] }): T[] {
  if (!q) return [...actions.slice(0, 3), ...pages];
  const lower = q.toLowerCase();
  const isNew = (a: T) => a.id.startsWith("new");
  const words = lower.split(/\s+/).filter((w) => w.length > 1);
  const keys = (a: T) => a.keywords?.split(" ") ?? [];
  const hit = (a: T) =>
    a.label.toLowerCase().includes(lower) ||
    (lower.length > 1 && keys(a).some((w) => w.startsWith(lower))) ||
    (words.length > 1 && words.every((w) => a.label.toLowerCase().includes(w) || keys(a).some((k) => k.startsWith(w))));
  const matching = actions.filter((a) => !isNew(a) && hit(a));
  const asked = actions.filter((a) => isNew(a) && a.rank === 2);
  const listId = LIST_KIND_WORDS.get(lower);
  const list = listId ? matching.filter((a) => a.id === listId) : [];
  if (list.length) return [...list, ...asked, ...matching.filter((a) => !list.includes(a)), ...pages, ...results];
  if (asked.some((a) => !a.title)) return [...asked, ...matching, ...pages, ...results];
  if (asked.length) return [...pages, ...asked, ...matching, ...results];
  // Rank 1 without a name: on its way to the kind itself; with one (the query): to a word of it.
  // (A stable sort: the same place keeps the order of the actions.)
  const place = (a: T) => (a.rank === 1 ? (a.title ? 1 : 2) : 0);
  const newPages = actions.filter(isNew).sort((a, b) => place(b) - place(a));
  return [...pages, ...results, ...matching, ...newPages];
}
