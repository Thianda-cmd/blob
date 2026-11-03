// Checks the order of the command palette's list (src/components/shell/paletteNew.ts) without a
// browser: what Enter opens for a query.
//
//   npm run check:palette
//
// - A query that starts with a kind of page and goes on with a name ("Notiz zur Zellatmung",
//   "Präsentation Klima", "Tabelle Titration", "Note Mathe") lists the pages whose title matches
//   first, so Enter opens them; making a new page named after the rest comes right after them, or
//   first when no page is found.
// - Just the kind ("Tabelle", "neue Tabelle") still makes one first, above the untitled pages that
//   match ("Unbenannte Tabelle").
// - Pages first for any other query; the actions that match before the new-page fallbacks ("cv");
//   on the way to a kind ("tab") or to one of its words ("kalib", "formel") its new page first among
//   those; no query: three actions, then pages.
// - English labels too, and each group (pages, actions, found…) stays one block under its heading.
// The palette's own labels and words are used, so a change to them is checked too.
// Problems make the script exit with 1.

import { CALENDAR_WORDS, CV_WORDS, INK_WORDS, SHEET_WORDS, newPageFor, paletteOrder, type NewKind, type PaletteEntry } from "@/components/shell/paletteNew";
import { shellText } from "@/i18n/messages/shell";

let passed = 0;
const problems: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else problems.push(`${name}${detail === undefined ? "" : `: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 600)}`}`);
}

type Entry = PaletteEntry & { group: "actions" | "pages" | "found" };

/**
 * The palette's list for a query, built like CommandPalette.tsx builds it, with the real labels:
 * pages match by their title, `found` are pages found by the words inside them.
 */
function listFor(query: string, titles: string[], opts: { found?: string[]; lang?: "de" | "en" } = {}): Entry[] {
  const t = shellText[opts.lang ?? "de"].palette;
  const q = query.trim();
  const lower = q.toLowerCase();
  const newPage = (kind: NewKind, bare: string, named: (q: string) => string, keywords?: string): Entry => {
    const { rank, title } = newPageFor(kind, q, bare, keywords);
    return { id: `new-${kind}`, group: "actions", label: title ? named(title) : bare, keywords, rank, title };
  };
  const actions: Entry[] = [
    newPage("note", t.newNote, t.newNoteNamed),
    newPage("ink", t.newInk, t.newInkNamed, INK_WORDS),
    newPage("sheet", t.newSheet, t.newSheetNamed, SHEET_WORDS),
    newPage("deck", t.newDeck, t.newDeckNamed),
    { id: "new-task", group: "actions", label: t.addTask },
    { id: "new-event", group: "actions", label: t.newEvent, keywords: CALENDAR_WORDS },
    { id: "cv-new", group: "actions", label: t.newCv, keywords: CV_WORDS },
    { id: "home", group: "actions", label: t.goHome },
    { id: "settings", group: "actions", label: t.settings },
  ];
  const pages = titles.filter((title) => !lower || title.toLowerCase().includes(lower)).map((title): Entry => ({ id: `page-${title}`, group: "pages", label: title }));
  const results = (opts.found ?? []).map((title): Entry => ({ id: `found-${title}`, group: "found", label: title }));
  return paletteOrder(q, { actions, pages, results });
}

const labels = (list: Entry[]) => list.map((e) => e.label);
/** Each group is one block: the list shows its heading once. */
const blocks = (list: Entry[]) => list.every((e, i) => i === 0 || e.group === list[i - 1].group || !list.slice(0, i).some((x) => x.group === e.group));

const ZELLATMUNG = "review-integration Notiz zur Zellatmung";
const KLIMA = "review-integration Präsentation Klimawandel";
const TITRATION = "review-integration Tabelle Titration";
const MATHE = "Note Mathe Klausur";
const UNTITLED = "Unbenannte Tabelle";
const library = [ZELLATMUNG, KLIMA, TITRATION, MATHE, UNTITLED, "Mitochondrien", "CV-Entwurf"];
const all: Entry[][] = [];
const run = (query: string, titles = library, opts: { found?: string[]; lang?: "de" | "en" } = {}) => {
  const list = listFor(query, titles, opts);
  all.push(list);
  return list;
};

// A kind word, then the name of a page you have: Enter opens that page (INT-1).
{
  const list = run("Notiz zur Zellatmung");
  check("'Notiz zur Zellatmung' opens the note", list[0]?.label === ZELLATMUNG, labels(list));
  check("… and offers a new note „zur Zellatmung“ right after it", list[1]?.label === "Neue Notiz „zur Zellatmung“", labels(list));
}
{
  const list = run("Präsentation Klima");
  check("'Präsentation Klima' opens the presentation", list[0]?.label === KLIMA && list[1]?.label === "Neue Präsentation „Klima“", labels(list));
}
{
  const list = run("Tabelle Titration");
  check("'Tabelle Titration' opens the spreadsheet", list[0]?.label === TITRATION && list[1]?.label === "Neue Tabelle „Titration“", labels(list));
  check("… and offers no note called 'Tabelle Titration'", !list.some((e) => e.id === "new-note"), labels(list));
}
{
  const list = run("Note Mathe");
  check("'Note Mathe' (a grade) opens 'Note Mathe Klausur'", list[0]?.label === MATHE && list[1]?.label === "Neue Notiz „Mathe“", labels(list));
}
{
  const list = run("neue Tabelle Titration");
  check("'neue Tabelle Titration' with no such page makes it first", list[0]?.label === "Neue Tabelle „Titration“", labels(list));
}

// … and when nothing has that title, making the page comes first.
{
  const list = run("Tabelle Titration", ["Mitochondrien"]);
  check("'Tabelle Titration' without such a page makes it first", list[0]?.label === "Neue Tabelle „Titration“", labels(list));
}
{
  const list = run("Notiz zur Zellatmung", ["Mitochondrien"], { found: ["Biologie Kapitel 4"] });
  check("found only in a page's text: making the note still comes first", list[0]?.label === "Neue Notiz „zur Zellatmung“" && list[1]?.label === "Biologie Kapitel 4", labels(list));
}

// Just the kind: making one is the first thing, above the untitled pages that match.
{
  const list = run("Tabelle");
  check("'Tabelle' makes a spreadsheet first", list[0]?.id === "new-sheet" && list[0]?.label === "Neue Tabelle", labels(list));
  check("… the pages follow", list.findIndex((e) => e.label === UNTITLED) > 0 && list.findIndex((e) => e.label === TITRATION) > 0, labels(list));
  check("… no note called 'Tabelle'", !list.some((e) => e.id === "new-note"), labels(list));
}
{
  const list = run("neue Tabelle");
  check("'neue Tabelle' makes a spreadsheet first", list[0]?.id === "new-sheet" && list[0]?.label === "Neue Tabelle", labels(list));
}
{
  const list = run("Notiz");
  check("'Notiz' makes a note first", list[0]?.id === "new-note" && list[0]?.label === "Neue Notiz", labels(list));
}

// Everything else: pages first.
{
  const list = run("Mitochondrien");
  check("a title opens the page", list[0]?.label === "Mitochondrien", labels(list));
  check("… a note named after it is still offered", list.some((e) => e.label === "Neue Notiz „Mitochondrien“"), labels(list));
}
{
  const list = run("cv");
  const cv = list.findIndex((e) => e.id === "cv-new");
  const note = list.findIndex((e) => e.id === "new-note");
  check("'cv': the page first, then „Neuer Lebenslauf“ before a note called 'cv'", list[0]?.label === "CV-Entwurf" && cv > 0 && cv < note, labels(list));
}
{
  const list = run("tab");
  const firstNew = list.findIndex((e) => e.id.startsWith("new"));
  // (Not the handwritten note „tab“ that the word "tablet" finds: the kind itself goes first.)
  check("'tab': pages first, then the new spreadsheet first among the new pages", list[0]?.label === TITRATION && list[firstNew]?.id === "new-sheet" && list[firstNew]?.label === "Neue Tabelle", labels(list));
}
// On the way to one of a kind's words: its new page first among the new pages, named after the query.
for (const query of ["kalib", "formel"]) {
  const list = run(query);
  const firstNew = list.findIndex((e) => e.id.startsWith("new"));
  check(`'${query}': the new spreadsheet „${query}“ first among the new pages`, firstNew >= 0 && list[firstNew]?.id === "new-sheet" && list[firstNew]?.label === `Neue Tabelle „${query}“`, labels(list));
}
{
  const list = run("skizze");
  const firstNew = list.findIndex((e) => e.id.startsWith("new"));
  check("'skizze': the new handwritten note first among the new pages", firstNew >= 0 && list[firstNew]?.id === "new-ink", labels(list));
}
{
  const list = run("Zellatmung", [ZELLATMUNG], { found: ["Biologie Kapitel 4"] });
  check("pages by title, then by their words, then the actions", labels(list).slice(0, 2).join(" | ") === `${ZELLATMUNG} | Biologie Kapitel 4` && list[2]?.group === "actions", labels(list));
}
{
  const list = run("", library.slice(0, 2));
  check("no query: three actions, then the recent pages", labels(list).join(" | ") === ["Neue Notiz", "Neue handschriftliche Notiz", "Neue Tabelle", ZELLATMUNG, KLIMA].join(" | "), labels(list));
}

// In English.
{
  const list = run("spreadsheet Lab 3", ["spreadsheet Lab 3 results"], { lang: "en" });
  check("English: 'spreadsheet Lab 3' opens the page", list[0]?.label === "spreadsheet Lab 3 results" && list[1]?.label === "New spreadsheet “Lab 3”", labels(list));
}
{
  const list = run("New spreadsheet", ["Untitled spreadsheet"], { lang: "en" });
  check("English: 'New spreadsheet' makes one first", list[0]?.id === "new-sheet" && list[0]?.label === "New spreadsheet", labels(list));
}
{
  const list = run("note Krebs cycle", ["note Krebs cycle summary"], { lang: "en" });
  check("English: 'note Krebs cycle' opens the note", list[0]?.label === "note Krebs cycle summary" && list[1]?.label === "New note “Krebs cycle”", labels(list));
}

// Every list above keeps its groups together (one heading each).
check("groups stay together", all.every(blocks), all.filter((l) => !blocks(l)).map(labels));

if (problems.length) {
  console.log(`check-palette: ${passed} passed, ${problems.length} FAILED`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log(`check-palette: all ${passed} checks passed`);
