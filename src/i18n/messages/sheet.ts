import type { MergeReport } from "@/sheet/collab";
import { defineMessages } from "../define";

/** A size in MB with one decimal, rounded up (so a spreadsheet just over 5 MB never reads "5.0 MB"). */
const mb = (bytes: number, tag: string) => (Math.ceil(bytes / 1e5) / 10).toLocaleString(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * What merging had to do for one sheet `name` (src/sheet/collab.ts MergeReport, with why). Its two
 * versions couldn't be combined: theirs stays, and mine is on the copy `copyName`, or nowhere ("")
 * when the spreadsheet had no room for one more sheet (then `formulas` are the cells whose formulas
 * were written for mine); `tooBig`: with the copy it is too big to save. Or the sheet stays although
 * one side deleted it ("keptMine", "keptTheirs"), or someone else's copy of it arrived ("arrived").
 */
type Conflict = Pick<MergeReport["conflicts"][number], "name" | "copyName" | "why" | "formulas" | "tooBig">;

function conflictEn(c: Conflict): string {
  const name = `“${c.name}”`;
  const copy = `“${c.copyName}”`;
  const next = `Move what you need from ${copy} to ${name}, then delete the conflict copy.`;
  switch (c.why) {
    case "keptMine":
      return `Someone (or you on another device) deleted ${name} while you were working in it. So nothing gets lost, the sheet is still there.`;
    case "keptTheirs":
      return `You had deleted ${name}, but meanwhile someone (or you on another device) entered something in it. So nothing gets lost, the sheet is back.`;
    case "arrived":
      // (The copy is the only place the other person's version is: not to be deleted before what they need is moved.)
      return `Someone (or you on another device) worked on ${name} at the same time as you, and the two versions couldn't be combined. So nothing gets lost, the other version is now on ${copy}. Only delete that copy once everything from it that belongs in ${name} is there.`;
  }
  const what =
    c.why === "moved"
      ? `You and someone else (or you on another device) inserted, deleted, sorted or moved rows or columns in ${name} at the same time.`
      : c.why === "deleted"
        ? `Rows or columns of ${name} were deleted while something was being entered into them.`
        : `Your changes to ${name} couldn't be combined with someone else's (or yours from another device).`;
  if (!c.copyName) {
    const check = c.formulas?.length ? ` Check these formulas, you wrote them for your version: ${c.formulas.join(", ")}.` : "";
    return `${what} A spreadsheet holds at most 250 sheets, so your version couldn't get a sheet of its own: only the other version is left.${check}`;
  }
  const big = c.tooBig ? " Until then, with both versions the spreadsheet is too big to save (more than 5 MB): your changes stay on this device." : "";
  return `${what} So nothing gets lost, your version is now on ${copy}. ${next}${big}`;
}

function conflictDe(c: Conflict): string {
  const name = `„${c.name}“`;
  const copy = `„${c.copyName}“`;
  const next = `Kopier, was du aus ${copy} brauchst, nach ${name} und lösch dann die Konflikt-Kopie.`;
  switch (c.why) {
    case "keptMine":
      return `Jemand (oder du auf einem anderen Gerät) hat ${name} gelöscht, während du darin gearbeitet hast. Damit nichts verloren geht, ist das Blatt noch da.`;
    case "keptTheirs":
      return `Du hattest ${name} gelöscht, aber inzwischen hat jemand (oder du auf einem anderen Gerät) darin etwas eingetragen. Damit nichts verloren geht, ist das Blatt wieder da.`;
    case "arrived":
      return `Jemand (oder du auf einem anderen Gerät) hat gleichzeitig mit dir an ${name} gearbeitet, und die beiden Versionen ließen sich nicht zusammenführen. Damit nichts verloren geht, steht die andere Version jetzt auf ${copy}. Lösch diese Kopie erst, wenn alles, was davon nach ${name} gehört, dort steht.`;
  }
  const what =
    c.why === "moved"
      ? `Du und jemand anderes (oder du auf einem anderen Gerät) habt gleichzeitig in ${name} Zeilen oder Spalten eingefügt, gelöscht, sortiert oder verschoben.`
      : c.why === "deleted"
        ? `In ${name} wurden Zeilen oder Spalten gelöscht, in die gleichzeitig etwas eingetragen wurde.`
        : `Deine Änderungen an ${name} ließen sich nicht mit denen von jemand anderem (oder von dir auf einem anderen Gerät) zusammenführen.`;
  if (!c.copyName) {
    const check = c.formulas?.length ? ` Prüf diese Formeln, du hast sie für deine Version geschrieben: ${c.formulas.join(", ")}.` : "";
    return `${what} Weil eine Tabelle höchstens 250 Blätter haben kann, konnte deine Version kein eigenes Blatt bekommen: Es gibt nur noch die andere Version.${check}`;
  }
  const big = c.tooBig ? " Bis dahin ist die Tabelle mit beiden Versionen zu groß zum Speichern (mehr als 5 MB): Deine Änderungen bleiben so lange auf diesem Gerät." : "";
  return `${what} Damit nichts verloren geht, steht deine Version jetzt auf ${copy}. ${next}${big}`;
}

/**
 * What still reads a conflict copy from other sheets (src/sheet/collab.ts copyTies), for
 * tooBigReaders: the cells whose formulas do ("Auswertung!B3", at most a few, `more` besides), and
 * the charts (`chartSheet`: the sheet the only one is on).
 */
type CopyReaders = { cells: string[]; more: number; charts: number; chartSheet: string | null };

const joinEn = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items.join(""));
const joinDe = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}` : items.join(""));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function readersEn(r: CopyReaders, name: string, copy: string): string {
  const n = r.cells.length + r.more;
  const cells = joinEn([...r.cells, ...(r.more ? [r.more === 1 ? "one more cell" : `${r.more} more cells`] : [])]);
  const formulas = n ? `${n === 1 ? "The formula" : "The formulas"} in ${cells}` : "";
  const charts = r.charts === 1 ? `a chart${r.chartSheet ? ` on “${r.chartSheet}”` : ""}` : r.charts ? `${r.charts} charts` : "";
  const who = formulas && charts ? `${formulas}, as well as ${charts},` : formulas || capital(charts);
  const them = [n === 1 ? "the formula" : n ? "the formulas" : "", r.charts === 1 ? "the chart" : r.charts ? "the charts" : ""].filter(Boolean).join(" and ");
  // (After "…, as well as …," the verb goes with what comes first.)
  return `${who} still ${(n || r.charts) > 1 ? "use" : "uses"} “${copy}”. Move what you need from there to “${name}”, point ${them} at “${name}”, and only then delete the conflict copy.`;
}

function readersDe(r: CopyReaders, name: string, copy: string): string {
  const n = r.cells.length + r.more;
  const cells = joinDe([...r.cells, ...(r.more ? [r.more === 1 ? "einer weiteren Zelle" : `${r.more} weiteren Zellen`] : [])]);
  const formulas = n ? `${n === 1 ? "Die Formel" : "Die Formeln"} in ${cells}` : "";
  const charts = r.charts === 1 ? `ein Diagramm${r.chartSheet ? ` auf „${r.chartSheet}“` : ""}` : r.charts ? `${r.charts} Diagramme` : "";
  const who = formulas && charts ? `${formulas} sowie ${charts}` : formulas || capital(charts);
  const them = [n === 1 ? "die Formel" : n ? "die Formeln" : "", r.charts === 1 ? "das Diagramm" : r.charts ? "die Diagramme" : ""].filter(Boolean).join(" und ");
  return `${who} ${n + r.charts > 1 ? "nutzen" : "nutzt"} noch „${copy}“. Kopier, was du von dort brauchst, nach „${name}“, stell ${them} auf „${name}“ um und lösch erst dann die Konflikt-Kopie.`;
}

/**
 * Spreadsheets ("Tabellen", src/components/sheet): the page around the grid — title, saving,
 * import and export, printing, the side panel — and the spreadsheet on public pages.
 * The grid, toolbar, charts, smart tables and templates have their own files (sheetGrid,
 * sheetChrome, sheetChart, sheetTable, sheetTemplates).
 */
export const sheetText = defineMessages({
  en: {
    kind: "Spreadsheet",
    untitled: "Untitled spreadsheet",
    titleLabel: "Title",
    editor: "Spreadsheet",
    viewOnly: "You can look at this spreadsheet. Ask its owner if you want to edit it too.",
    denied: "You can't edit this spreadsheet any more, so your last changes aren't saved. Save them as a copy, or ask the spreadsheet's owner for access.",
    rejected: "Your last changes can't be saved. So that nothing gets lost, save the spreadsheet as an Excel file or as a copy.",
    saveAsCopy: "Save as a copy",
    savedAsCopy: "This is your copy, with your changes. The original stays as it was.",
    // Changes kept on this device for a spreadsheet you can't edit any more (src/components/sheet/DeniedDrafts.tsx).
    deniedDrafts: {
      title: "Your changes aren't saved",
      body: (title: string) => `You can't edit “${title}” any more, so your last changes to it are only on this device. Save them as a spreadsheet of your own, or discard them.`,
      later: "Later",
      discard: "Discard",
    },
    unreadable: "This spreadsheet couldn't be read. So that nothing gets lost, it opened for viewing only.",
    tooBig: "This spreadsheet is too big to save (more than 5 MB). Delete sheets or rows you don't need any more.",
    restored: "Your unsaved changes from this device are back.",
    saveTrouble: "Saving isn't working right now. Your changes stay on this device, and I'll keep trying.",
    saveBack: "Saved – it's working again.",
    nearlyFull: (bytes: number) => `This spreadsheet is already ${mb(bytes, "en-US")} MB. Above 5 MB it can't be saved any more, so delete sheets or rows you don't need.`,
    /** What merging had to do (src/sheet/collab.ts MergeReport), sheet by sheet; elsewhere: in the spreadsheet `page`, saved in the background. */
    conflict: (list: Conflict[]) => list.map(conflictEn).join(" "),
    conflictElsewhere: (page: string, list: Conflict[]) => `Spreadsheet “${page}”: ${list.map(conflictEn).join(" ")}`,
    /** In place of tooBig while the conflict copy `copy` of sheet `name` that this editor's merge made is what makes it too big (MergeReport tooBig): it holds my version. */
    tooBigConflict: (name: string, copy: string) => `With both versions of “${name}” this spreadsheet is too big to save (more than 5 MB). Move what you need from “${copy}” to “${name}”, then delete the conflict copy and saving works again. Until then everything stays on this device.`,
    /**
     * In place of tooBigConflict while formulas or charts on other sheets still read that copy (collab.ts
     * copyTies; deleting it would break them): they are named, and there is no button to save my version.
     */
    tooBigReaders: (name: string, copy: string, readers: CopyReaders) => `With both versions of “${name}” this spreadsheet is too big to save (more than 5 MB). ${readersEn(readers, name, copy)} Until then everything stays on this device.`,
    /** The button next to tooBigConflict: my version of that sheet (the conflict copy) kept as a spreadsheet of my own (collab.ts ownVersion), and the copy goes here. */
    saveOwnVersion: "Save my version as its own spreadsheet",
    /** What the spreadsheet saveOwnVersion made says once it opens (in place of savedAsCopy): it holds my version of sheet `name`. */
    savedOwnVersion: (name: string) => `This is your version of “${name}” as a spreadsheet of its own. The original keeps the other version.`,
    /** In place of tooBig when conflict copies are in it but which one makes it too big isn't known (after a reload, say). */
    tooBigCopies: "This spreadsheet is too big to save (more than 5 MB). Delete sheets or rows you don't need any more, but delete a conflict copy only once everything important from it is in the original.",
    someoneChanged: (name: string) => `${name} changed something`,

    exportXlsx: "Save as Excel file",
    exportCsv: "Save sheet as CSV",
    importFile: "Import Excel or CSV",
    print: "Print",
    exporting: "Getting your file ready…",
    exported: "Saved to your downloads.",
    exportFailed: "That didn't work. Try again?",
    reading: "Reading your file…",
    imported: (n: number) => (n === 1 ? "Added as a new sheet." : `Added as ${n} new sheets.`),
    importSkipped: (list: string) => `Not brought over: ${list}.`,
    importFailed: "I couldn't read that file. Is it an Excel file (.xlsx) or a CSV file?",
    importOldXls: "Old .xls files can't be read. Save it as .xlsx in Excel first.",
    importTooBig: "That file is too big (20 MB at most).",
    importTooBigSheet: (bytes: number) => `That would make a ${mb(bytes, "en-US")} MB spreadsheet, too big to save (5 MB at most). Split the file, or leave out columns you don't need.`,
    importNoRoom: (bytes: number) => `With this file the spreadsheet would be ${mb(bytes, "en-US")} MB, too big to save (5 MB at most). Import it as a new spreadsheet instead.`,
    importEmpty: "There's nothing in that file.",
    importCut: (rows: string) => `Only the first ${rows} rows fit.`,
    importLabel: "Import",
    dropHere: "Drop to add it as a new sheet",
    dropHint: "An Excel (.xlsx) or CSV file",
    printEmpty: "There's nothing on this sheet to print yet.",
    noticeClose: "Close message",
    // Said after a message with a button: the grid keeps Tab, F6 gets there (SheetEditor's parts).
    noticeActionKey: (label: string) => `Press F6 to get to the “${label}” button.`,

    insertChart: "Insert chart",
    addToNote: "Add to a note",

    chartSettings: "Chart settings",
    tableSettings: "Smart table settings",
    dockBigger: "Make the settings taller",
    dockSmaller: "Make the settings smaller",

    sheets: "Sheets",
    empty: "This spreadsheet is empty.",

    // The keyboard shortcuts list (Ctrl/⌘+/, src/components/shell/ShortcutsDialog.tsx).
    shortcuts: {
      groups: { cells: "Spreadsheets: cells", tools: "Spreadsheets: tools" },
      items: {
        edit: "Edit the cell",
        absolute: "Switch $ in a reference (A1 → $A$1)",
        newLine: "New line in the cell",
        fillTyped: "Type into every selected cell",
        fill: "Fill down / right",
        date: "Today's date / the time",
        undo: "Undo / redo",
        table: "Format as table",
        formats: "Number formats",
        autoSum: "AutoSum",
        chart: "Insert chart",
        functions: "All functions",
        find: "Find",
        replace: "Find and replace",
        save: "Save now",
        print: "Print",
        areas: "Move between cells, message, charts, settings and toolbar",
      },
    },
  },
  de: {
    kind: "Tabelle",
    untitled: "Unbenannte Tabelle",
    titleLabel: "Titel",
    editor: "Tabellenkalkulation",
    viewOnly: "Du kannst dir diese Tabelle ansehen. Frag die Person, der sie gehört, wenn du mitbearbeiten möchtest.",
    denied: "Du kannst diese Tabelle nicht mehr bearbeiten, deshalb sind deine letzten Änderungen nicht gespeichert. Speicher sie als Kopie oder frag die Person, der die Tabelle gehört, nach Zugang.",
    rejected: "Deine letzten Änderungen können nicht gespeichert werden. Damit nichts verloren geht, speicher die Tabelle als Excel-Datei oder als Kopie.",
    saveAsCopy: "Als Kopie speichern",
    savedAsCopy: "Das ist deine Kopie, mit deinen Änderungen. Das Original bleibt, wie es war.",
    deniedDrafts: {
      title: "Deine Änderungen sind nicht gespeichert",
      body: (title) => `Du kannst „${title}“ nicht mehr bearbeiten, deshalb sind deine letzten Änderungen daran nur auf diesem Gerät. Speicher sie als eigene Tabelle oder verwirf sie.`,
      later: "Später",
      discard: "Verwerfen",
    },
    unreadable: "Diese Tabelle konnte nicht gelesen werden. Damit nichts verloren geht, ist sie nur zum Ansehen geöffnet.",
    tooBig: "Diese Tabelle ist zu groß zum Speichern (mehr als 5 MB). Lösch Blätter oder Zeilen, die du nicht mehr brauchst.",
    restored: "Deine ungespeicherten Änderungen von diesem Gerät sind wieder da.",
    saveTrouble: "Speichern klappt gerade nicht. Deine Änderungen bleiben auf diesem Gerät, und ich versuche es weiter.",
    saveBack: "Gespeichert. Jetzt klappt es wieder.",
    nearlyFull: (bytes) => `Diese Tabelle ist schon ${mb(bytes, "de-DE")} MB groß. Ab 5 MB kann sie nicht mehr gespeichert werden – lösch Blätter oder Zeilen, die du nicht brauchst.`,
    conflict: (list) => list.map(conflictDe).join(" "),
    conflictElsewhere: (page, list) => `Tabelle „${page}“: ${list.map(conflictDe).join(" ")}`,
    tooBigConflict: (name, copy) => `Mit beiden Versionen von „${name}“ ist diese Tabelle zu groß zum Speichern (mehr als 5 MB). Kopier, was du aus „${copy}“ brauchst, nach „${name}“ und lösch dann die Konflikt-Kopie. Danach klappt das Speichern wieder, bis dahin bleibt alles auf diesem Gerät.`,
    tooBigReaders: (name, copy, readers) => `Mit beiden Versionen von „${name}“ ist diese Tabelle zu groß zum Speichern (mehr als 5 MB). ${readersDe(readers, name, copy)} Bis dahin bleibt alles auf diesem Gerät.`,
    saveOwnVersion: "Meine Version als eigene Tabelle speichern",
    savedOwnVersion: (name) => `Das ist deine Version von „${name}“ als eigene Tabelle. Im Original bleibt die andere Version.`,
    tooBigCopies: "Diese Tabelle ist zu groß zum Speichern (mehr als 5 MB). Lösch Blätter oder Zeilen, die du nicht mehr brauchst, eine Konflikt-Kopie aber erst, wenn alles Wichtige daraus im Original steht.",
    someoneChanged: (name) => `${name} hat etwas geändert`,

    exportXlsx: "Als Excel-Datei speichern",
    exportCsv: "Blatt als CSV speichern",
    importFile: "Excel/CSV importieren",
    print: "Drucken",
    exporting: "Deine Datei wird vorbereitet…",
    exported: "In deinen Downloads gespeichert.",
    exportFailed: "Das hat nicht geklappt. Nochmal versuchen?",
    reading: "Deine Datei wird gelesen…",
    imported: (n) => (n === 1 ? "Als neues Blatt hinzugefügt." : `Als ${n} neue Blätter hinzugefügt.`),
    importSkipped: (list) => `Nicht übernommen: ${list}.`,
    importFailed: "Diese Datei konnte ich nicht lesen. Ist es eine Excel-Datei (.xlsx) oder eine CSV-Datei?",
    importOldXls: "Alte .xls-Dateien kann ich nicht lesen. Speicher sie in Excel zuerst als .xlsx.",
    importTooBig: "Die Datei ist zu groß (höchstens 20 MB).",
    importTooBigSheet: (bytes) => `Daraus würde eine Tabelle mit ${mb(bytes, "de-DE")} MB – zu groß zum Speichern (höchstens 5 MB). Teil die Datei auf oder lass Spalten weg, die du nicht brauchst.`,
    importNoRoom: (bytes) => `Mit dieser Datei wäre die Tabelle ${mb(bytes, "de-DE")} MB groß – zu groß zum Speichern (höchstens 5 MB). Importier sie lieber als neue Tabelle.`,
    importEmpty: "In dieser Datei steht nichts.",
    importCut: (rows) => `Nur die ersten ${rows} Zeilen passen hinein.`,
    importLabel: "Importieren",
    dropHere: "Loslassen für ein neues Blatt",
    dropHint: "Eine Excel- (.xlsx) oder CSV-Datei",
    printEmpty: "Auf diesem Blatt gibt es noch nichts zu drucken.",
    noticeClose: "Hinweis schließen",
    noticeActionKey: (label) => `Mit F6 kommst du zum Knopf „${label}“.`,

    insertChart: "Diagramm einfügen",
    addToNote: "In Notiz einfügen",

    chartSettings: "Diagrammeinstellungen",
    tableSettings: "Einstellungen der intelligenten Tabelle",
    dockBigger: "Einstellungen größer",
    dockSmaller: "Einstellungen kleiner",

    sheets: "Blätter",
    empty: "Diese Tabelle ist leer.",

    shortcuts: {
      groups: { cells: "Tabellen: Zellen", tools: "Tabellen: Werkzeuge" },
      items: {
        edit: "Zelle bearbeiten",
        absolute: "$ im Bezug umschalten (A1 → $A$1)",
        newLine: "Neue Zeile in der Zelle",
        fillTyped: "In alle markierten Zellen schreiben",
        fill: "Nach unten / rechts ausfüllen",
        date: "Heutiges Datum / Uhrzeit",
        undo: "Rückgängig / Wiederholen",
        table: "Als Tabelle formatieren",
        formats: "Zahlenformate",
        autoSum: "AutoSumme",
        chart: "Diagramm einfügen",
        functions: "Alle Funktionen",
        find: "Suchen",
        replace: "Suchen und ersetzen",
        save: "Jetzt speichern",
        print: "Drucken",
        areas: "Zwischen Zellen, Hinweis, Diagrammen, Einstellungen und Werkzeugleiste wechseln",
      },
    },
  },
});
