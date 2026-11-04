// Checks what happens to a note's spreadsheets beyond the screen, and what signing out leaves:
//
//   npm run check:sheet-note
//
//   - paper (src/components/editor/notePrint.ts, planWideTable): a table from a spreadsheet wider
//     than the paper gets smaller text (not below the smallest that reads well), then prints in
//     pieces, as few as that allows and with the largest text that needs no more, each starting
//     with the first column again unless that column is wide; random tables keep every column,
//     in order, each piece within the paper; a long word in a wrapping cell breaks inside it
//     (sheetEmbed.css)
//   - Blob files (src/components/notes/transfer.ts) against a stand-in for the database: a note's
//     file carries the spreadsheets and presentations its blocks show from elsewhere (each page
//     alone, after the pages asked for, once), what the open editor holds counts, and those in the
//     trash or out of reach are named instead; importing the file points the blocks to the copies
//   - signing out (src/lib/offline/device.ts, src/components/shell/recent.ts): every key that
//     remembers the account's pages, subjects or projects goes, the device's own preferences
//     stay, and the recent pages don't come back from memory
// Problems make the script exit with 1.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JSONContent } from "@tiptap/core";
import { planWideTable } from "@/components/editor/notePrint";
import { recentPages } from "@/components/shell/recent";
import { editorText } from "@/i18n/messages/editor";
import type { PageMeta } from "@/lib/types";
import { pageTitle } from "@/lib/utils";
import type { BlobFile, BlobFilePage } from "@/notes/blobFile";

const problems: string[] = [];
let checks = 0;

function eq(where: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) problems.push(`${where}: expected ${e}\n      got      ${a}`);
}

function ok(where: string, cond: boolean, detail?: unknown) {
  checks++;
  if (!cond) problems.push(`${where}: not true${detail === undefined ? "" : ` (${JSON.stringify(detail)})`}`);
}

// Paper ------------------------------------------------------------------------------------------

/** The fewest pieces in order with these widths (an independent count: filling each piece in turn is the best one can do). */
function fewestPieces(widths: number[], room: number, scale: number, lead: boolean) {
  const first = lead ? widths[0] * scale : 0;
  let pieces = 1;
  let used = first;
  let filled = false;
  for (let i = lead ? 1 : 0; i < widths.length; i++) {
    const w = widths[i] * scale;
    if (filled && used + w > room) {
      pieces++;
      used = first;
      filled = false;
    }
    used += w;
    filled = true;
  }
  return pieces;
}

/** What every plan keeps: all columns once and in order, the scale in bounds, each piece within the room. */
function planHolds(where: string, widths: number[], room: number, min: number) {
  const plan = planWideTable(widths, room, min);
  const all = widths.map((_, i) => i);
  const total = widths.reduce((s, w) => s + w, 0);
  const body = plan.parts.flatMap((p) => (plan.lead ? p.slice(1) : p));
  eq(`${where}: every column once, in order`, body, plan.lead ? all.slice(1) : all);
  if (plan.lead) ok(`${where}: each piece starts with the first column`, plan.parts.every((p) => p[0] === 0), plan.parts);
  ok(`${where}: text never larger, never below the smallest`, plan.scale <= 1 + 1e-9 && plan.scale >= Math.min(min, 1) - 1e-9, plan.scale);
  for (const p of plan.parts) {
    const width = p.reduce((s, i) => s + widths[i] * plan.scale, 0);
    const alone = p.length - (plan.lead ? 1 : 0) === 1;
    ok(`${where}: a piece within the paper (or one column too wide for any)`, width <= room + 1e-6 || alone, { width, room, p });
  }
  if (total <= room) eq(`${where}: fits, so as it is`, plan, { scale: 1, parts: [all], lead: false });
  else if (total * min <= room) ok(`${where}: smaller text, one piece`, plan.parts.length === 1 && Math.abs(plan.scale - room / total) < 1e-9, plan);
  else {
    eq(`${where}: as few pieces as the smallest text allows`, plan.parts.length, fewestPieces(widths, room, min, plan.lead));
    if (plan.scale < 0.999) ok(`${where}: the largest text that needs no more pieces`, fewestPieces(widths, room, plan.scale * 1.002, plan.lead) > plan.parts.length, plan.scale);
    eq(`${where}: the first column again unless wide`, plan.lead, widths.length > 2 && widths[0] * min <= room / 3);
  }
  return plan;
}

function paper() {
  const room = 651;
  const min = 7.5 / 13.5;
  // Narrow: as on screen.
  const narrow = planHolds("narrow", [90, 110, 60], room, min);
  eq("narrow: unchanged", narrow.scale, 1);
  // A 96-well plate layout (13 columns): smaller text, one piece.
  const plate = planHolds("plate", [56, ...Array(12).fill(75)], room, min);
  ok("plate: one piece, text about 70 %", plate.parts.length === 1 && plate.scale > 0.65 && plate.scale < 0.72, plate.scale);
  // Kinetics (20 columns of "Zeit 5 min"): two pieces, the first column again, text well above the smallest.
  const kinetics = planHolds("kinetics", Array(20).fill(87), room, min);
  eq("kinetics: two pieces", kinetics.parts.length, 2);
  ok("kinetics: first column repeated", kinetics.lead && kinetics.parts[1][0] === 0);
  ok("kinetics: text larger than the smallest", kinetics.scale > 0.65, kinetics.scale);
  // 30 samples with a label column: three pieces of about the same size.
  const samples = planHolds("samples", [150, ...Array(30).fill(70)], room, min);
  eq("samples: three pieces", samples.parts.length, 3);
  const sizes = samples.parts.map((p) => p.length - 1);
  ok("samples: the pieces about even", Math.max(...sizes) - Math.min(...sizes) <= 2, sizes);
  // A wide first column isn't repeated (it would leave little room for the rest).
  const wideFirst = planHolds("wide first column", [600, ...Array(12).fill(80)], room, min);
  ok("wide first column: not repeated", !wideFirst.lead && wideFirst.parts.length > 1, wideFirst);
  // Two columns: no repeating.
  planHolds("two wide columns", [900, 900], room, min);
  // One column wider than any paper: one piece at full size (its text wraps instead).
  eq("one huge column", planWideTable([2400], room, min), { scale: 1, parts: [[0]], lead: false });
  // Larger text (size "l", 15 px): the smallest is a smaller share.
  planHolds("size l", Array(25).fill(95), room, 7.5 / 15);
  // Random tables.
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 400; k++) {
    const n = 1 + Math.floor(rand() * 50);
    const widths = Array.from({ length: n }, () => 20 + Math.floor(rand() * (rand() < 0.1 ? 900 : 220)));
    planHolds(`random ${k}`, widths, 300 + Math.floor(rand() * 600), 0.4 + rand() * 0.6);
  }
  // A cell that wraps is at most 22em wide: on paper a longer word (a DNA sequence) breaks inside
  // it, instead of running over the next cells and off the paper, where Chrome would shrink the
  // whole PDF to fit it.
  const css = readFileSync(join(process.cwd(), "src/components/editor/blocks/sheetEmbed.css"), "utf8");
  ok("a wrapping cell is at most 22em wide", /\.blob-sheet-table \.is-wrap \{[^}]*max-width: 22em/.test(css));
  ok("on paper, a long word breaks inside its wrapping cell", /\.note-print table\.blob-sheet-table \.is-wrap \{[^}]*overflow-wrap: break-word/.test(css));
}

// Blob files --------------------------------------------------------------------------------------

type DbRow = { id: string; kind: string; title: string; icon: string | null; tags: string[]; topics: string[]; content: unknown; parent_id: string | null; trashed_at: string | null; position: number };

/** A stand-in for the database's pages table, as PostgREST answers (what transfer.ts asks). */
const db = { rows: [] as DbRow[], asked: [] as string[], offlineFor: null as RegExp | null };

function answer(url: URL): DbRow[] {
  let out = db.rows.slice();
  for (const [key, value] of url.searchParams) {
    if (key === "select") continue;
    if (key === "order") {
      out.sort((a, b) => a.position - b.position);
      continue;
    }
    const m = /^(in|is|eq)\.(.*)$/.exec(value);
    if (!m) continue;
    const field = key as keyof DbRow;
    if (m[1] === "in") {
      const set = new Set(m[2].replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")));
      out = out.filter((r) => set.has(String(r[field])));
    } else if (m[1] === "is" && m[2] === "null") out = out.filter((r) => r[field] == null);
    else if (m[1] === "eq") out = out.filter((r) => String(r[field]) === m[2]);
  }
  return out;
}

async function standIn(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = init?.method ?? "GET";
  db.asked.push(`${method} ${decodeURIComponent(url.search)}`);
  if (db.offlineFor?.test(decodeURIComponent(url.search))) throw new TypeError("Failed to fetch");
  if (url.pathname !== "/rest/v1/pages") return new Response("{}", { status: 404 });
  if (method === "PATCH") {
    const patch = JSON.parse(String(init?.body ?? "{}")) as Partial<DbRow>;
    for (const row of answer(url)) Object.assign(row, patch);
    return new Response(null, { status: 204 });
  }
  return new Response(JSON.stringify(answer(url)), { status: 200, headers: { "content-type": "application/json" } });
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const workbook = (text: string) => ({ v: 1, sheets: [{ id: "s1", name: "Blatt 1", cells: { "0,0": { v: text } }, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 20, cols: 5 } }], charts: [], tables: [] });
const sheetBlock = (pageId: string, chartId = "chart1"): JSONContent => ({ type: "sheetEmbed", attrs: { pageId, item: { kind: "chart", chartId }, size: "m", caption: "" } });
const para = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const row = (n: number, kind: string, title: string, content: unknown, extra: Partial<DbRow> = {}): DbRow => ({ id: id(n), kind, title, icon: null, tags: [], topics: [], content, parent_id: null, trashed_at: null, position: n, ...extra });

const walk = (pages: BlobFilePage[], depth = 0): string[] => pages.flatMap((p) => [`${"-".repeat(depth)}${p.kind}:${p.title}`, ...walk(p.children, depth + 1)]);

async function blobFiles() {
  const { exportPages, importBlobFile, shownPages } = await import("@/components/notes/transfer");
  const { remapPageIds } = await import("@/notes/blobFile");

  // What a note shows: spreadsheets (pageId) and presentations (id), nested blocks too, once each.
  const shown = shownPages(
    doc(
      sheetBlock(id(2)),
      { type: "toggle", content: [para("Mehr"), sheetBlock(id(3)), { type: "deckEmbed", attrs: { id: id(4) } }] },
      sheetBlock(id(2), "chart2"),
      sheetBlock("not-a-page"),
      { type: "deckEmbed", attrs: { id: null } },
      sheetBlock(id(5).toUpperCase()),
    ),
  );
  eq("shown: in the note's order, once each, ids as stored", [...shown], [
    [id(2), "sheet"],
    [id(3), "sheet"],
    [id(4), "deck"],
    [id(5), "sheet"],
  ]);
  eq("shown: not a note", [...shownPages({ v: 1, sheets: [] })], []);

  // The note (with a sub-page that it shows too), and what it shows from elsewhere.
  db.rows = [
    row(1, "note", "Protokoll", doc(para("Kalibrierung:"), sheetBlock(id(2)), sheetBlock(id(2), "chart2"), { type: "callout", content: [sheetBlock(id(3))] }, { type: "deckEmbed", attrs: { id: id(4) } }, sheetBlock(id(6)), sheetBlock(id(7)), sheetBlock(id(8)), sheetBlock(id(9)))),
    row(2, "sheet", "Kalibrierung", workbook("Konzentration (mg/L)")),
    row(3, "sheet", "Kinetik", workbook("Zeit (min)")),
    row(4, "deck", "Referat", { theme: "paper", slides: [{ id: "sl1", layout: "title", title: "Nitrat", body: "", image: null, notes: "" }] }),
    row(6, "sheet", "Alte Messung", workbook("alt"), { trashed_at: "2026-11-01T10:00:00Z" }),
    // id(7): deleted, or not shared with you (the database doesn't answer for it).
    row(8, "note", "Keine Tabelle", doc(para("x"))),
    row(9, "sheet", "Unterseite", workbook("Unterseite"), { parent_id: id(1) }),
    // Below a spreadsheet the note shows: stays home.
    row(10, "note", "Unter Kalibrierung", doc(para("y")), { parent_id: id(2) }),
  ];
  db.asked = [];
  const result = await exportPages([id(1)]);
  if (!result) return problems.push("export: no file");
  eq("export: the note (with its sub-page), then what it shows, each alone", walk(result.file.pages), ["note:Protokoll", "-sheet:Unterseite", "sheet:Kalibrierung", "sheet:Kinetik", "deck:Referat"]);
  eq("export: their refs are their ids", result.file.pages.map((p) => p.ref), [id(1), id(2), id(3), id(4)]);
  eq("export: pages counted", result.pages, 5);
  eq("export: in the trash and out of reach, named", result.left, [
    { kind: "sheet", title: "Alte Messung" },
    { kind: "sheet", title: null },
  ]);
  ok("export: the spreadsheet's data is in the file", JSON.stringify(result.file).includes("Konzentration (mg/L)"));
  eq("export: what the note shows asked for once, together", db.asked.filter((q) => /select=[^&]*trashed_at/.test(q)).length, 1);

  // What the open editor holds counts (a block added just now, one removed just now).
  const current = { id: id(1), content: doc(sheetBlock(id(3))) };
  const fresh = await exportPages([id(1)], current);
  eq("export: the open editor's blocks", fresh && walk(fresh.file.pages), ["note:Protokoll", "-sheet:Unterseite", "sheet:Kinetik"]);
  eq("export: nothing left out then", fresh?.left, []);

  // A note that shows nothing from elsewhere: no extra question to the database.
  db.rows.push(row(11, "note", "Nur Text", doc(para("z"))));
  db.asked = [];
  const plain = await exportPages([id(11)]);
  eq("export: a note without blocks", plain && walk(plain.file.pages), ["note:Nur Text"]);
  ok("export: a note without blocks asks nothing more", !db.asked.some((q) => /select=[^&]*trashed_at/.test(q)), db.asked);

  // Several pages at once (the backup): a spreadsheet among them isn't packed twice.
  const both = await exportPages([id(1), id(2)]);
  eq("export: a shown page that is exported anyway comes once", both && walk(both.file.pages), ["note:Protokoll", "-sheet:Unterseite", "sheet:Kalibrierung", "-note:Unter Kalibrierung", "sheet:Kinetik", "deck:Referat"]);

  // Without a connection for what the note shows: no file rather than one without them.
  db.offlineFor = /select=[^&]*trashed_at/;
  eq("export: what the note shows can't be read: no file", await exportPages([id(1)]), null);
  db.offlineFor = null;

  // Importing the file: the blocks point to the copies, the note opens first.
  const made: DbRow[] = [];
  let next = 100;
  const createPage = async (input: { kind: PageMeta["kind"]; title: string; icon: string | null; tags: string[]; topics: string[]; subject_id: string | null; parent_id: string | null; content?: unknown }): Promise<PageMeta> => {
    const r = row(next++, input.kind, input.title, input.content ?? {}, { parent_id: input.parent_id });
    db.rows.push(r);
    made.push(r);
    return { id: r.id, user_id: "u", kind: input.kind, title: input.title, icon: input.icon, subject_id: input.subject_id, parent_id: input.parent_id, is_favorite: false, position: 0, trashed_at: null, tags: input.tags, topics: input.topics, created_at: "", updated_at: "" };
  };
  const imported = await importBlobFile(result.file as BlobFile, { userId: "u", subjectId: null, parentId: id(50), locale: "de", createPage });
  eq("import: the note opens (it comes first)", imported.roots.map((p) => p.title), ["Protokoll", "Kalibrierung", "Kinetik", "Referat"]);
  eq("import: what the note shows sits beside it", made.filter((r) => r.kind !== "note" && r.title !== "Unterseite").map((r) => r.parent_id), [id(50), id(50), id(50)]);
  const note = made.find((r) => r.title === "Protokoll");
  const copy = (title: string) => made.find((r) => r.title === title)?.id;
  const json = JSON.stringify(note?.content ?? null);
  const pointed = [...json.matchAll(/"pageId":"([0-9a-f-]{36})"/g)].map((m) => m[1]);
  eq("import: the blocks point to the copies (and to what stayed out, as before)", pointed, [copy("Kalibrierung"), copy("Kalibrierung"), copy("Kinetik"), id(6), id(7), id(8), copy("Unterseite")]);
  ok("import: the presentation block too", json.includes(`"type":"deckEmbed","attrs":{"id":"${copy("Referat")}"}`), json);
  // (The same as remapPageIds alone, with the refs exportPages gives.)
  const ids = new Map(result.file.pages.map((p, i) => [p.ref, `copy-${i}`]));
  ok("remap: the extra pages' refs relink the blocks", JSON.stringify(remapPageIds(result.file.pages[0].content, ids)).includes(`"pageId":"copy-1"`));

  // What Blob says about what stayed out: the ones in the trash by name, the others counted.
  const de = editorText.de.export.leftOut;
  const en = editorText.en.export.leftOut;
  eq("left out (de): one in the trash", de([{ kind: "sheet", title: "Alte Messung" }]), "Die Tabelle „Alte Messung“ liegt im Papierkorb, deshalb ist sie nicht in der Datei. Stell sie wieder her, dann kommt sie mit.");
  eq("left out (de): one out of reach", de([{ kind: "sheet", title: null }]), "Eine Tabelle aus deiner Notiz wurde gelöscht oder ist nicht mit dir geteilt, deshalb ist sie nicht in der Datei.");
  // (An untitled page by the name the trash lists it under, as useNoteExport passes it.)
  eq("untitled pages as the trash lists them", [pageTitle(" ", "deck", "de"), pageTitle("", "sheet", "de"), pageTitle(null, "sheet", "en")], ["Unbenannte Präsentation", "Unbenannte Tabelle", "Untitled spreadsheet"]);
  eq(
    "left out (de): two in the trash, a presentation out of reach",
    de([
      { kind: "sheet", title: "Kinetik" },
      { kind: "deck", title: pageTitle(" ", "deck", "de") },
      { kind: "deck", title: null },
    ]),
    "„Kinetik“ und „Unbenannte Präsentation“ liegen im Papierkorb, deshalb sind sie nicht in der Datei. Stell sie wieder her, dann kommen sie mit. Eine Präsentation aus deiner Notiz wurde gelöscht oder ist nicht mit dir geteilt, deshalb ist sie nicht in der Datei.",
  );
  eq(
    "left out (de): three out of reach, of both kinds",
    de([
      { kind: "sheet", title: null },
      { kind: "deck", title: null },
      { kind: "sheet", title: null },
    ]),
    "3 Tabellen und Präsentationen aus deiner Notiz wurden gelöscht oder sind nicht mit dir geteilt, deshalb sind sie nicht in der Datei.",
  );
  eq("left out (en): one in the trash", en([{ kind: "deck", title: "Referat" }]), "The presentation “Referat” is in the trash, so it isn't in the file. Restore it and it comes along.");
  eq("left out (en): an untitled one in the trash", en([{ kind: "sheet", title: pageTitle("", "sheet", "en") }]), "The spreadsheet “Untitled spreadsheet” is in the trash, so it isn't in the file. Restore it and it comes along.");
  eq(
    "left out (en): three in the trash, two out of reach",
    en([
      { kind: "sheet", title: "A" },
      { kind: "sheet", title: "B" },
      { kind: "sheet", title: "C" },
      { kind: "sheet", title: null },
      { kind: "sheet", title: null },
    ]),
    "“A”, “B” and “C” are in the trash, so they aren't in the file. Restore them and they come along. 2 spreadsheets in your note were deleted or aren't shared with you, so they aren't in the file.",
  );
  ok("left out: what the export found, said", de(result.left).includes("„Alte Messung“") && de(result.left).includes("Eine Tabelle aus deiner Notiz"), de(result.left));
}

// Signing out -------------------------------------------------------------------------------------

async function signingOut() {
  const { isAccountKey } = await import("@/lib/offline/device");
  for (const key of ["blob-recent-pages", "blob-side-page", "blob-open-pages", "blob-folded-subjects", "blob-cal-filters", "blob-project-view", `blob-file-sweep:page:${id(1)}`, `blob-file-sweep:project:${id(2)}`, `blob-atlas-seen:${id(3)}`]) ok(`signing out removes ${key}`, isAccountKey(key));
  for (const key of ["blob-theme", "blob-sidebar", "blob-side-ratio", "blob-note-view", "blob-folded-sections", "blob-cal-view", "blob-cal-rail", "blob-tasks-view", "blob-locale", "blob-note-pdf-explained"]) ok(`signing out keeps ${key}`, !isAccountKey(key));

  // The recent pages live in storage only: once signing out removes them, none come back.
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
  };
  recentPages.visit(id(1));
  recentPages.visit(id(2));
  recentPages.visit(id(1));
  eq("recent: newest first, once each", recentPages.list(), [id(1), id(2)]);
  for (const k of [...memory.keys()]) if (isAccountKey(k)) memory.delete(k);
  eq("recent: gone after signing out", recentPages.list(), []);
  recentPages.visit(id(3));
  eq("recent: the next account's pages only", JSON.parse(memory.get("blob-recent-pages") ?? "[]"), [id(3)]);
}

async function main() {
  // The database client reads where it lives when it first loads (src/lib/supabase/env.ts).
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://stand-in.local";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "stand-in";
  globalThis.fetch = standIn as typeof fetch;
  paper();
  await blobFiles();
  await signingOut();
  if (problems.length) {
    console.error(`check:sheet-note: ${problems.length} problem(s) in ${checks} checks`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`check:sheet-note: all ${checks} checks passed`);
}

void main().catch((e) => {
  console.error("check:sheet-note crashed:", e);
  process.exit(1);
});
