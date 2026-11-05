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
// - Which pages a query finds, in which order (findPages, the palette's own): each word of a title on
//   its own, in any order ("Nitrat Photometrie"); the kind and words of a name ("Tabelle Nitrat",
//   "Ordner Chemie") find the pages of that kind with those words, before making one called "Nitrat"
//   (LAB-3), but no page of another kind; the kind alone ("Tabelle", "Ordner") still makes one first;
//   a title typed as it is still comes first, before newer pages that only have its words, then the
//   kind with the name as typed ("Tabelle Versuch 3": "Versuch 3" before a newer "Versuch 13"). Words
//   count where a title's word starts and numbers whole, so "Tabelle Versuch 3" still makes "Versuch 3"
//   when there is only "Versuch 13", as it did before words counted on their own. Tags too.
// - A note made for a spreadsheet ("In Notiz einfügen → Neue Notiz") has a name of its own, so the
//   palette doesn't list two pages of one name (LAB-11): untitled stays untitled, and a long name keeps
//   its ending within the 200 characters a title can have.
// - "Alle Tabellen" (the list of your spreadsheets): first for "meine Tabellen", "alle Tabellen", "my
//   spreadsheets" and a plural alone ("Tabellen", "spreadsheets"), then making one; "Tabelle",
//   "Blobxcel" and "Excel" make one first and list them second. The action says "Neue
//   Blobxcel-Tabelle", and "neue Tabelle" still makes one. The same for "Präsentationen",
//   "presentations" and "Handschriften" (their lists, then a new one; no note named after them).
// - English labels too, and each group (pages, actions, found…) stays one block under its heading.
// The palette's own labels and words are used, so a change to them is checked too.
// Problems make the script exit with 1.

import { newNoteTitle } from "@/components/sheet/embed/noteTitle";
import {
  CALENDAR_WORDS,
  CV_WORDS,
  DECKS_LIST_ID,
  DECK_WORDS,
  FOLDER_WORDS,
  INKS_LIST_ID,
  INK_LIST_WORDS,
  INK_WORDS,
  LIST_WORDS,
  SHEETS_LIST_ID,
  SHEET_WORDS,
  findPages,
  newPageFor,
  paletteOrder,
  type NewKind,
  type PaletteEntry,
} from "@/components/shell/paletteNew";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { shellText } from "@/i18n/messages/shell";
import type { PageKind } from "@/lib/types";

let passed = 0;
const problems: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else problems.push(`${name}${detail === undefined ? "" : `: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 600)}`}`);
}

type Entry = PaletteEntry & { group: "actions" | "pages" | "found"; hint?: string };
/** A page of the workspace, as far as finding it goes (its title as shown, its tags). */
type Page = { kind: PageKind; title: string; tags: string[] };
const page = (kind: PageKind, title: string, tags: string[] = []): Page => ({ kind, title, tags });

/**
 * The palette's list for a query, built like CommandPalette.tsx builds it, with the real labels:
 * `pages` (the most recent first) are found by their title or tags (a page found by a tag has it as
 * its hint), `found` are pages found by the words inside them.
 */
function listFor(query: string, pages: Page[], opts: { found?: string[]; lang?: "de" | "en" } = {}): Entry[] {
  const t = shellText[opts.lang ?? "de"].palette;
  const q = query.trim();
  const newPage = (kind: NewKind, bare: string, named: (q: string) => string, keywords?: string): Entry => {
    const { rank, title } = newPageFor(kind, q, bare, keywords);
    return { id: `new-${kind}`, group: "actions", label: title ? named(title) : bare, keywords, rank, title };
  };
  const actions: Entry[] = [
    newPage("note", t.newNote, t.newNoteNamed),
    newPage("sheet", t.newSheet, t.newSheetNamed, SHEET_WORDS),
    newPage("ink", t.newInk, t.newInkNamed, INK_WORDS),
    newPage("deck", t.newDeck, t.newDeckNamed),
    { id: "new-task", group: "actions", label: t.addTask },
    { id: "new-event", group: "actions", label: t.newEvent, keywords: CALENDAR_WORDS },
    { id: "folder-new", group: "actions", label: t.newFolder, keywords: FOLDER_WORDS },
    { id: SHEETS_LIST_ID, group: "actions", label: t.goSheets, keywords: `${SHEET_WORDS} ${LIST_WORDS}` },
    { id: DECKS_LIST_ID, group: "actions", label: t.goDecks, keywords: `${DECK_WORDS} ${LIST_WORDS}` },
    { id: INKS_LIST_ID, group: "actions", label: t.goInks, keywords: `${INK_LIST_WORDS} ${LIST_WORDS}` },
    { id: "cv-new", group: "actions", label: t.newCv, keywords: CV_WORDS },
    { id: "home", group: "actions", label: t.goHome },
    { id: "settings", group: "actions", label: t.settings },
  ];
  // A minute apart, the first the most recent.
  const dated = pages.map((p, i) => ({ ...p, updated_at: new Date(Date.UTC(2026, 10, 1) - i * 60_000).toISOString() }));
  const found = findPages(q, dated, (p) => p.title).map(({ page: p, tag }): Entry => ({ id: `page-${p.title}`, group: "pages", label: p.title, hint: tag && `#${tag}` }));
  const results = (opts.found ?? []).map((title): Entry => ({ id: `found-${title}`, group: "found", label: title }));
  return paletteOrder(q, { actions, pages: found, results });
}

const labels = (list: Entry[]) => list.map((e) => e.label);
/** Each group is one block: the list shows its heading once. */
const blocks = (list: Entry[]) => list.every((e, i) => i === 0 || e.group === list[i - 1].group || !list.slice(0, i).some((x) => x.group === e.group));

const ZELLATMUNG = "review-integration Notiz zur Zellatmung";
const KLIMA = "review-integration Präsentation Klimawandel";
const TITRATION = "review-integration Tabelle Titration";
const MATHE = "Note Mathe Klausur";
const UNTITLED = "Unbenannte Tabelle";
const library = [
  page("note", ZELLATMUNG),
  page("deck", KLIMA),
  page("sheet", TITRATION),
  // Grades: a spreadsheet, found by the words of its title although "Note" names notes.
  page("sheet", MATHE),
  page("sheet", UNTITLED),
  page("note", "Mitochondrien"),
  page("cv", "CV-Entwurf"),
];
const all: Entry[][] = [];
const run = (query: string, pages = library, opts: { found?: string[]; lang?: "de" | "en" } = {}) => {
  const list = listFor(query, pages, opts);
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
  check("'Tabelle Titration' opens the spreadsheet", list[0]?.label === TITRATION && list[1]?.label === "Neue Blobxcel-Tabelle „Titration“", labels(list));
  check("… and offers no note called 'Tabelle Titration'", !list.some((e) => e.id === "new-note"), labels(list));
}
{
  const list = run("Note Mathe");
  check("'Note Mathe' (a grade) opens 'Note Mathe Klausur'", list[0]?.label === MATHE && list[1]?.label === "Neue Notiz „Mathe“", labels(list));
}
{
  const list = run("neue Tabelle Titration");
  check("'neue Tabelle Titration' with no such page makes it first", list[0]?.label === "Neue Blobxcel-Tabelle „Titration“", labels(list));
}

// … and when nothing has that title, making the page comes first.
{
  const list = run("Tabelle Titration", [page("note", "Mitochondrien")]);
  check("'Tabelle Titration' without such a page makes it first", list[0]?.label === "Neue Blobxcel-Tabelle „Titration“", labels(list));
}
{
  const list = run("Notiz zur Zellatmung", [page("note", "Mitochondrien")], { found: ["Biologie Kapitel 4"] });
  check("found only in a page's text: making the note still comes first", list[0]?.label === "Neue Notiz „zur Zellatmung“" && list[1]?.label === "Biologie Kapitel 4", labels(list));
}

// Just the kind: making one is the first thing, above the untitled pages that match.
{
  const list = run("Tabelle");
  check("'Tabelle' makes a spreadsheet first", list[0]?.id === "new-sheet" && list[0]?.label === "Neue Blobxcel-Tabelle", labels(list));
  check("… the pages follow", list.findIndex((e) => e.label === UNTITLED) > 0 && list.findIndex((e) => e.label === TITRATION) > 0, labels(list));
  check("… no note called 'Tabelle'", !list.some((e) => e.id === "new-note"), labels(list));
}
{
  const list = run("neue Tabelle");
  check("'neue Tabelle' makes a spreadsheet first", list[0]?.id === "new-sheet" && list[0]?.label === "Neue Blobxcel-Tabelle", labels(list));
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
  check("'tab': pages first, then the new spreadsheet first among the new pages", list[0]?.label === TITRATION && list[firstNew]?.id === "new-sheet" && list[firstNew]?.label === "Neue Blobxcel-Tabelle", labels(list));
}
// On the way to one of a kind's words: its new page first among the new pages, named after the query.
for (const query of ["kalib", "formel"]) {
  const list = run(query);
  const firstNew = list.findIndex((e) => e.id.startsWith("new"));
  check(`'${query}': the new spreadsheet „${query}“ first among the new pages`, firstNew >= 0 && list[firstNew]?.id === "new-sheet" && list[firstNew]?.label === `Neue Blobxcel-Tabelle „${query}“`, labels(list));
}
{
  const list = run("skizze");
  const firstNew = list.findIndex((e) => e.id.startsWith("new"));
  check("'skizze': the new handwritten note first among the new pages", firstNew >= 0 && list[firstNew]?.id === "new-ink", labels(list));
}
{
  const list = run("Zellatmung", [page("note", ZELLATMUNG)], { found: ["Biologie Kapitel 4"] });
  check("pages by title, then by their words, then the actions", labels(list).slice(0, 2).join(" | ") === `${ZELLATMUNG} | Biologie Kapitel 4` && list[2]?.group === "actions", labels(list));
}
{
  const list = run("", library.slice(0, 2));
  check("no query: three actions (note, Blobxcel spreadsheet, handwriting), then the recent pages", labels(list).join(" | ") === ["Neue Notiz", "Neue Blobxcel-Tabelle", "Neue handschriftliche Notiz", ZELLATMUNG, KLIMA].join(" | "), labels(list));
}

// LAB-3: the kind and some words of a name, in any order, find the page. Enter opens it instead of
// making a second spreadsheet with a strange name (the sweep's queries, with a lab's pages).
const NITRAT = "sweep-lab Photometrie Nitrat";
const PHOTO = "Tabelle sweep-lab Photometrie";
const DRINKING = "Nitrat im Trinkwasser";
const lab = [page("sheet", NITRAT), page("note", "sweep-lab Laborjournal"), page("note", DRINKING), page("sheet", PHOTO), page("folder", "Chemie")];
const pageLabels = (list: Entry[]) => list.filter((e) => e.group === "pages").map((e) => e.label);
{
  const list = run("Tabelle sweep-lab Nitrat", lab);
  check("'Tabelle sweep-lab Nitrat' opens the spreadsheet 'sweep-lab Photometrie Nitrat'", list[0]?.label === NITRAT && list[1]?.label === "Neue Blobxcel-Tabelle „sweep-lab Nitrat“", labels(list));
}
{
  const list = run("Tabelle Nitrat", lab);
  check("'Tabelle Nitrat' opens the spreadsheet, making one comes right after", list[0]?.label === NITRAT && list[1]?.label === "Neue Blobxcel-Tabelle „Nitrat“", labels(list));
  check("… and finds no note: only spreadsheets drop the word 'Tabelle'", pageLabels(list).join(" | ") === NITRAT, labels(list));
}
for (const query of ["Nitrat Photometrie", "photometrie nitrat", "Photometrie sweep-lab"]) {
  const list = run(query, lab);
  check(`'${query}': the words in any order find the spreadsheet`, list[0]?.label === NITRAT, labels(list));
}
{
  const list = run("tabelle photo", lab);
  check("'tabelle photo' lists both spreadsheets with 'photo' before making one", pageLabels(list).join(" | ") === `${NITRAT} | ${PHOTO}` && list[2]?.label === "Neue Blobxcel-Tabelle „photo“", labels(list));
}
{
  const list = run("Notiz Nitrat", lab);
  check("'Notiz Nitrat' opens the note, not the spreadsheet", list[0]?.label === DRINKING && list[1]?.label === "Neue Notiz „Nitrat“" && !pageLabels(list).includes(NITRAT), labels(list));
}
{
  const VERIFY = "sweep-verify-lab Titration";
  let list = run(`Tabelle ${VERIFY}`, [page("sheet", VERIFY)]);
  check("'Tabelle <the whole title>' opens the spreadsheet", list[0]?.label === VERIFY && list[1]?.label === `Neue Blobxcel-Tabelle „${VERIFY}“`, labels(list));
  list = run("Titration sweep-verify-lab", [page("sheet", VERIFY)]);
  check("'Titration sweep-verify-lab' (words swapped) opens it", list[0]?.label === VERIFY, labels(list));
}
{
  // The palette's own "Tabelle Titration" makes a spreadsheet called "Titration": the same query opens it later.
  const made = newPageFor("sheet", "Tabelle Titration", shellText.de.palette.newSheet, SHEET_WORDS).title;
  const pages = [page("sheet", "Photometrie Nitrat"), page("sheet", made), page("sheet", "Wachstumskurve E. coli")];
  let list = run("Tabelle Titration", pages);
  check("'Tabelle Titration' opens the spreadsheet it made before, no second one", made === "Titration" && list[0]?.label === "Titration" && list[1]?.label === "Neue Blobxcel-Tabelle „Titration“", labels(list));
  list = run("Tabelle Wachstumskurve", pages);
  check("'Tabelle Wachstumskurve' opens 'Wachstumskurve E. coli'", list[0]?.label === "Wachstumskurve E. coli", labels(list));
}
{
  const list = run("Präsentation Zellbiologie", [page("deck", "Zellbiologie Referat"), page("note", "Zellbiologie Mitschrift")]);
  check("'Präsentation Zellbiologie' opens the presentation, not the note", pageLabels(list).join(" | ") === "Zellbiologie Referat" && list[1]?.label === "Neue Präsentation „Zellbiologie“", labels(list));
}
{
  const list = run("Handschrift Mitose", [page("ink", "Mitose Skizze"), page("note", "Mitose")]);
  check("'Handschrift Mitose' opens the handwritten note", pageLabels(list).join(" | ") === "Mitose Skizze" && list[1]?.label === "Neue handschriftliche Notiz „Mitose“", labels(list));
}
{
  const list = run("Ordner Chemie", lab);
  check("'Ordner Chemie' opens the folder, not a new note called 'Ordner Chemie'", list[0]?.label === "Chemie" && pageLabels(list).join(" | ") === "Chemie", labels(list));
}
{
  const list = run("Ordner", lab);
  check("'Ordner' alone: making a folder comes first, the folders don't jump ahead", list[0]?.id === "folder-new" && !pageLabels(list).includes("Chemie"), labels(list));
}
{
  const list = run("Tabelle", lab);
  check("'Tabelle' alone: only the titles with the word, after making one", list[0]?.id === "new-sheet" && pageLabels(list).join(" | ") === PHOTO, labels(list));
}
{
  const list = run("Zellatmung Notiz");
  check("'Zellatmung Notiz' (kind last) finds the note by its words", list[0]?.label === ZELLATMUNG, labels(list));
}
// A title typed as it is still comes first, before newer pages that only have its words: what Enter
// opened before the words counted on their own, it still opens.
{
  const list = run("Zellatmung Zusammenfassung", [page("note", "Zusammenfassung Zellatmung Teil 2"), page("note", "Zellatmung Zusammenfassung")]);
  check("the title as typed first, the newer page with the same words after it", pageLabels(list).join(" | ") === "Zellatmung Zusammenfassung | Zusammenfassung Zellatmung Teil 2", labels(list));
}
{
  const list = run("Notiz zur Zellatmung", [page("note", "Fragen zur Zellatmung"), page("note", ZELLATMUNG)]);
  check("'Notiz zur Zellatmung' opens the note with that title, not a newer note 'zur Zellatmung'", list[0]?.label === ZELLATMUNG && list[1]?.label === "Fragen zur Zellatmung" && list[2]?.label === "Neue Notiz „zur Zellatmung“", labels(list));
}
{
  const list = run("Zellatmung  Teil", [page("note", "Zellatmung Teil 2")]);
  check("two spaces between the words still find the title", list[0]?.label === "Zellatmung Teil 2", labels(list));
}

// Numbered lab pages: the kind and a name a page has as typed come before newer pages that only have
// its words; a word counts where a title's word starts, a number whole (the verifier's cases).
{
  const list = run("Tabelle Versuch 3", [page("sheet", "Versuch 13"), page("sheet", "Versuch 3")]);
  check("'Tabelle Versuch 3' opens 'Versuch 3', not the newer 'Versuch 13'", pageLabels(list).join(" | ") === "Versuch 3" && list[1]?.label === "Neue Blobxcel-Tabelle „Versuch 3“", labels(list));
}
{
  const list = run("Tabelle Gruppe 1", [page("sheet", "Gruppe 2 – Messung 1"), page("sheet", "Gruppe 1")]);
  check("'Tabelle Gruppe 1' opens 'Gruppe 1' before the newer 'Gruppe 2 – Messung 1'", pageLabels(list).join(" | ") === "Gruppe 1 | Gruppe 2 – Messung 1", labels(list));
}
{
  const list = run("Tabelle Titration", [page("sheet", "Rücktitration"), page("note", "Tabelle zur Titration"), page("sheet", "Titration")]);
  check("'Tabelle Titration' opens the spreadsheet 'Titration', not a newer note 'Tabelle zur Titration' or 'Rücktitration'", pageLabels(list).join(" | ") === "Titration | Tabelle zur Titration" && list[2]?.label === "Neue Blobxcel-Tabelle „Titration“", labels(list));
}
// Making a spreadsheet still works as before when only pages with a longer number or word exist.
for (const [name, title] of [["Versuch 3", "Versuch 13"], ["Messung 2", "Messung 12.02."], ["Tag 1", "Wachstum Tag 12"], ["Lab 3", "Lab 2 (2023)"], ["Versuch 2", "Versuch 2.1"], ["Titration", "Rücktitration"], ["a", "Photometrie Nitrat"]]) {
  const list = run(`Tabelle ${name}`, [page("sheet", title)]);
  check(`'Tabelle ${name}' with only '${title}': makes „${name}“ first`, list[0]?.label === `Neue Blobxcel-Tabelle „${name}“` && !pageLabels(list).length, labels(list));
}
{
  let list = run("Tabelle Versuch 3", [page("sheet", "Versuch3 Kalibrierung")]);
  check("a number right after a word counts: 'Tabelle Versuch 3' finds 'Versuch3 Kalibrierung'", list[0]?.label === "Versuch3 Kalibrierung", labels(list));
  list = run("Tabelle Titration", [page("sheet", "Säure-Base-Titration")]);
  check("… and a word after a hyphen: 'Tabelle Titration' finds 'Säure-Base-Titration'", list[0]?.label === "Säure-Base-Titration", labels(list));
  list = run("Tabelle pH 7", [page("sheet", "Puffer pH 7,4"), page("sheet", "Puffer pH 7")]);
  check("a decimal is one number: 'Tabelle pH 7' opens 'Puffer pH 7', not the newer 'Puffer pH 7,4'", pageLabels(list).join(" | ") === "Puffer pH 7", labels(list));
  list = run("Tabelle Versuch 2.1", [page("sheet", "Versuch 2.1 Wiederholung"), page("sheet", "Versuch 2. Teil")]);
  check("… typed on, 'Versuch 2.1' finds it; a point after a number is no decimal ('Versuch 2. Teil')", pageLabels(list).join(" | ") === "Versuch 2.1 Wiederholung" && run("Tabelle Versuch 2", [page("sheet", "Versuch 2. Teil")])[0]?.label === "Versuch 2. Teil", labels(list));
}
{
  // The query as typed finds what it always found, parts of words and numbers too (while typing).
  let list = run("Versuch 1", [page("sheet", "Versuch 13")]);
  check("without a kind's name, the query as typed: 'Versuch 1' still finds 'Versuch 13'", list[0]?.label === "Versuch 13", labels(list));
  list = run("trat", [page("sheet", "Photometrie Nitrat")]);
  check("… and 'trat' 'Photometrie Nitrat'", list[0]?.label === "Photometrie Nitrat", labels(list));
}

// Tags find pages as well as titles; the tag shows as the hint of a page its title didn't find.
{
  const pages = [page("note", "Zellbiologie", ["Klausur"]), page("note", "Klausur Mathe"), page("note", "Mathe Klausur Fragen", ["klausur"]), page("note", "Mitose")];
  let list = run("klausur", pages);
  const hints = (l: Entry[]) => l.filter((e) => e.group === "pages").map((e) => `${e.label}${e.hint ? ` ${e.hint}` : ""}`).join(" | ");
  check("'klausur': titles and tags, the most recent first, the tag next to the page its title didn't find", hints(list) === "Zellbiologie #Klausur | Klausur Mathe | Mathe Klausur Fragen", hints(list));
  list = run("#klausur", pages);
  check("'#klausur': the pages with the tag only", hints(list) === "Zellbiologie #Klausur | Mathe Klausur Fragen #klausur", hints(list));
}

// In English.
{
  const list = run("spreadsheet Lab 3", [page("sheet", "spreadsheet Lab 3 results")], { lang: "en" });
  check("English: 'spreadsheet Lab 3' opens the page", list[0]?.label === "spreadsheet Lab 3 results" && list[1]?.label === "New Blobxcel spreadsheet “Lab 3”", labels(list));
}
{
  const list = run("spreadsheet Lab 3", [page("sheet", "Lab 2 (2023)"), page("sheet", "Lab 3")], { lang: "en" });
  check("English: 'spreadsheet Lab 3' opens 'Lab 3', not the newer 'Lab 2 (2023)'", pageLabels(list).join(" | ") === "Lab 3" && list[1]?.label === "New Blobxcel spreadsheet “Lab 3”", labels(list));
}
{
  const list = run("New spreadsheet", [page("sheet", "Untitled spreadsheet")], { lang: "en" });
  check("English: 'New spreadsheet' (the old label) still makes one first", list[0]?.id === "new-sheet" && list[0]?.label === "New Blobxcel spreadsheet", labels(list));
}
{
  const list = run("note Krebs cycle", [page("note", "note Krebs cycle summary")], { lang: "en" });
  check("English: 'note Krebs cycle' opens the note", list[0]?.label === "note Krebs cycle summary" && list[1]?.label === "New note “Krebs cycle”", labels(list));
}
{
  const list = run("spreadsheet nitrate", [page("note", "nitrate notes"), page("sheet", "Photometry nitrate")], { lang: "en" });
  check("English: 'spreadsheet nitrate' opens the spreadsheet, not the note", pageLabels(list).join(" | ") === "Photometry nitrate" && list[1]?.label === "New Blobxcel spreadsheet “nitrate”", labels(list));
}
{
  const list = run("folder chemistry", [page("folder", "Chemistry")], { lang: "en" });
  check("English: 'folder chemistry' opens the folder", list[0]?.label === "Chemistry", labels(list));
}

// LAB-11: the note that "In Notiz einfügen → Neue Notiz" makes for a spreadsheet has a name of its own.
{
  const de = noteBlocksText.de.sheet.addToNote.newNoteTitle;
  const en = noteBlocksText.en.sheet.addToNote.newNoteTitle;
  const SHEET = "sweep-lab Kalibrierung";
  const note = newNoteTitle(SHEET, de);
  const list = run("Kalibrierung", [page("note", note), page("sheet", SHEET)]);
  check("the spreadsheet's new note: '… – Auswertung', two rows told apart by name", note === `${SHEET} – Auswertung` && pageLabels(list).join(" | ") === `${note} | ${SHEET}`, labels(list));
  check("English: '… – notes'", newNoteTitle("Calibration", en) === "Calibration – notes", newNoteTitle("Calibration", en));
  check("an untitled spreadsheet gives an untitled note, never just the ending", [undefined, null, "", "   "].every((title) => newNoteTitle(title, de) === "" && newNoteTitle(title, en) === ""));
  // 200 characters, a title's most: shortened for the ending, here right after a space, which goes too.
  const long = newNoteTitle("Extinktion ".repeat(19).slice(0, 200), de);
  check("a 200-character name: the note's still fits the 200 characters, ending kept", Array.from(long).length <= 200 && long.endsWith("Extinktion – Auswertung") && !long.includes("  "), long);
  const emoji = newNoteTitle("🧪".repeat(200), en);
  check("… counted as the database counts characters (no half emoji)", Array.from(emoji).length === 200 && /^(🧪)+ – notes$/u.test(emoji), Array.from(emoji).length);
}

// "Alle Tabellen": the list of your spreadsheets (audit B), and Blobxcel's own name.
{
  const ids = (list: Entry[]) => list.map((e) => e.id);
  let list = run("meine tabellen");
  check("'meine tabellen' → Alle Tabellen first", list[0]?.id === SHEETS_LIST_ID && list[0]?.label === "Alle Tabellen", labels(list));
  list = run("Tabellen");
  check("'Tabellen' → Alle Tabellen, then Neue Blobxcel-Tabelle", list[0]?.id === SHEETS_LIST_ID && list[1]?.id === "new-sheet" && list[1]?.label === "Neue Blobxcel-Tabelle", labels(list));
  list = run("my spreadsheets", library, { lang: "en" });
  check("English: 'my spreadsheets' → All spreadsheets first", list[0]?.id === SHEETS_LIST_ID && list[0]?.label === "All spreadsheets", labels(list));
  list = run("spreadsheets", library, { lang: "en" });
  check("English: 'spreadsheets' → All spreadsheets, then New Blobxcel spreadsheet", list[0]?.id === SHEETS_LIST_ID && list[1]?.id === "new-sheet" && list[1]?.label === "New Blobxcel spreadsheet", labels(list));
  list = run("Tabelle");
  check("'Tabelle' → Neue Blobxcel-Tabelle, then Alle Tabellen", list[0]?.id === "new-sheet" && list[1]?.id === SHEETS_LIST_ID, labels(list));
  list = run("alle tabellen");
  check("'alle tabellen' → Alle Tabellen first", list[0]?.id === SHEETS_LIST_ID, labels(list));
  list = run("Übersicht Tabellen");
  check("a list word and the kind: 'Übersicht Tabellen' → Alle Tabellen first", list[0]?.id === SHEETS_LIST_ID, labels(list));
  list = run("spreadsheets overview", library, { lang: "en" });
  check("English, the other way round: 'spreadsheets overview' finds All spreadsheets", ids(list).includes(SHEETS_LIST_ID), labels(list));
  list = run("meine katze");
  check("every word must fit: 'meine katze' doesn't list the spreadsheets", !ids(list).includes(SHEETS_LIST_ID), labels(list));
  for (const query of ["blobxcel", "Blobxcel", "BLOBXCEL", "excel", "Excel"]) {
    list = run(query);
    check(`'${query}' → Neue Blobxcel-Tabelle first, Alle Tabellen second`, list[0]?.id === "new-sheet" && list[0]?.label === "Neue Blobxcel-Tabelle" && list[1]?.id === SHEETS_LIST_ID, labels(list));
    check(`… '${query}' makes no note and no page named after it`, !ids(list).includes("new-note") && !list.some((e) => e.label.includes("„")), labels(list));
  }
  list = run("blobxcel", library, { lang: "en" });
  check("English: 'blobxcel' → New Blobxcel spreadsheet first, All spreadsheets second", list[0]?.label === "New Blobxcel spreadsheet" && list[1]?.label === "All spreadsheets", labels(list));
  list = run("blobx");
  check("'blobx' on its way: Alle Tabellen, then Neue Blobxcel-Tabelle first among the new pages (no name)", ids(list).indexOf(SHEETS_LIST_ID) >= 0 && list.find((e) => e.id.startsWith("new"))?.label === "Neue Blobxcel-Tabelle", labels(list));
  list = run("Blobxcel Titration");
  check("'Blobxcel Titration' opens the spreadsheet, making „Titration“ comes right after", list[0]?.label === TITRATION && list[1]?.label === "Neue Blobxcel-Tabelle „Titration“", labels(list));
  list = run("Blobxcel Titration", [page("note", "Titration Protokoll")]);
  check("'Blobxcel Titration' with only a note: makes the spreadsheet first, finds no note", list[0]?.label === "Neue Blobxcel-Tabelle „Titration“" && !pageLabels(list).length, labels(list));
  list = run("Neue Blobxcel-Tabelle");
  check("the action's own label makes one first", list[0]?.id === "new-sheet" && list[0]?.label === "Neue Blobxcel-Tabelle", labels(list));
  list = run("meine blobxcel");
  check("'meine blobxcel' → Alle Tabellen first", list[0]?.id === SHEETS_LIST_ID, labels(list));
  list = run("neue präsentation");
  check("'neue präsentation' still makes a presentation first", list[0]?.id === "new-deck" && list[0]?.label === "Neue Präsentation", labels(list));
  list = run("neue Handschrift");
  check("'neue Handschrift' makes a handwritten note first (no note called that)", list[0]?.id === "new-ink" && list[0]?.label === "Neue handschriftliche Notiz" && !ids(list).includes("new-note"), labels(list));
  // The kind's names stay what they were for the other rules (check-sheet-doc: 'Tabellenbuch' is a name, not a kind).
  check("'Tabellenbuch' is still a name: a note and a spreadsheet called so", newPageFor("sheet", "Tabellenbuch", shellText.de.palette.newSheet, SHEET_WORDS).rank === 0);
  check("no query: no list action among the first three", !ids(run("")).slice(0, 3).includes(SHEETS_LIST_ID), labels(run("")));
}

// The other plurals (C2-11): "Präsentationen" lists your presentations first, then makes one, and
// never a note called "präsentationen"; the same for "Handschriften" and English "presentations".
{
  const ids = (list: Entry[]) => list.map((e) => e.id);
  let list = run("Präsentationen");
  check("'Präsentationen' → Alle Präsentationen, then Neue Präsentation", list[0]?.id === DECKS_LIST_ID && list[0]?.label === "Alle Präsentationen" && list[1]?.id === "new-deck" && list[1]?.label === "Neue Präsentation", labels(list));
  check("… and no note (nor any page) called 'präsentationen'", !ids(list).includes("new-note") && !list.some((e) => e.label.includes("„")), labels(list));
  list = run("presentations", library, { lang: "en" });
  check("English: 'presentations' → All presentations, then New presentation", list[0]?.label === "All presentations" && list[1]?.label === "New presentation", labels(list));
  list = run("meine Präsentationen");
  check("'meine Präsentationen' → Alle Präsentationen first", list[0]?.id === DECKS_LIST_ID, labels(list));
  list = run("Präsentation");
  check("'Präsentation' → Neue Präsentation, then Alle Präsentationen", list[0]?.id === "new-deck" && list[1]?.id === DECKS_LIST_ID, labels(list));
  list = run("Präsentationen Klima");
  check("'Präsentationen Klima' opens the presentation, then makes „Klima“", list[0]?.label === KLIMA && list[1]?.label === "Neue Präsentation „Klima“", labels(list));
  list = run("Handschriften");
  check("'Handschriften' → Alle Handschriften, then Neue handschriftliche Notiz, no note called so", list[0]?.id === INKS_LIST_ID && list[1]?.id === "new-ink" && !ids(list).includes("new-note"), labels(list));
  list = run("Folien");
  check("'Folien' still makes a presentation first", list[0]?.id === "new-deck" && list[0]?.label === "Neue Präsentation", labels(list));
  list = run("praes");
  check("'praes' on its way: Neue Präsentation first among the new pages (no name)", list.find((e) => e.id.startsWith("new"))?.label === "Neue Präsentation", labels(list));
}

// Every list above keeps its groups together (one heading each).
check("groups stay together", all.every(blocks), all.filter((l) => !blocks(l)).map(labels));

if (problems.length) {
  console.log(`check-palette: ${passed} passed, ${problems.length} FAILED`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log(`check-palette: all ${passed} checks passed`);
