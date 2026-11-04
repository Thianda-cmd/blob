import { defineMessages } from "../define";

/** A size in MB with one decimal, rounded up (so a spreadsheet just over 5 MB never reads "5.0 MB"). */
const mb = (bytes: number, tag: string) => (Math.ceil(bytes / 1e5) / 10).toLocaleString(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * A sheet both sides moved rows or columns of (src/sheet/collab.ts MergeReport): theirs stays, and
 * mine is on the copy `copyName`, or nowhere ("") when the spreadsheet had no room for one more sheet.
 */
type Conflict = { name: string; copyName: string };

function conflictEn(start: string, list: Conflict[]): string {
  const q = (names: string[]) => names.map((n) => `“${n}”`).join(", ");
  const copied = list.filter((c) => c.copyName);
  const lost = list.filter((c) => !c.copyName);
  let out = start;
  if (copied.length === 1) out += ` So nothing gets lost, your version of “${copied[0].name}” is now on a sheet of its own: “${copied[0].copyName}”.`;
  else if (copied.length) out += ` So nothing gets lost, your versions are now on sheets of their own: ${q(copied.map((c) => c.copyName))}.`;
  if (lost.length === 1) out += ` A spreadsheet holds at most 250 sheets, so your version of “${lost[0].name}” couldn't be kept as a sheet of its own: only the other version is left.`;
  else if (lost.length) out += ` A spreadsheet holds at most 250 sheets, so your versions of ${q(lost.map((c) => c.name))} couldn't be kept as sheets of their own: only the other versions are left.`;
  return out;
}

function conflictDe(start: string, list: Conflict[]): string {
  const q = (names: string[]) => names.map((n) => `„${n}“`).join(", ");
  const copied = list.filter((c) => c.copyName);
  const lost = list.filter((c) => !c.copyName);
  let out = start;
  if (copied.length === 1) out += ` Damit nichts verloren geht, steht deine Version von „${copied[0].name}“ jetzt auf einem eigenen Blatt: „${copied[0].copyName}“.`;
  else if (copied.length) out += ` Damit nichts verloren geht, stehen deine Versionen jetzt auf eigenen Blättern: ${q(copied.map((c) => c.copyName))}.`;
  if (lost.length === 1) out += ` Weil eine Tabelle höchstens 250 Blätter haben kann, konnte deine Version von „${lost[0].name}“ kein eigenes Blatt bekommen: Es gibt nur noch die andere Version.`;
  else if (lost.length) out += ` Weil eine Tabelle höchstens 250 Blätter haben kann, konnten deine Versionen von ${q(lost.map((c) => c.name))} keine eigenen Blätter bekommen: Es gibt nur noch die anderen Versionen.`;
  return out;
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
    denied: "You can't edit this spreadsheet any more. Ask its owner for access.",
    unreadable: "This spreadsheet couldn't be read. So that nothing gets lost, it opened for viewing only.",
    tooBig: "This spreadsheet is too big to save (more than 5 MB). Delete sheets or rows you don't need any more.",
    restored: "Your unsaved changes from this device are back.",
    saveTrouble: "Saving isn't working right now. Your changes stay on this device, and I'll keep trying.",
    saveBack: "Saved. It works again.",
    nearlyFull: (bytes: number) => `This spreadsheet is already ${mb(bytes, "en-US")} MB. Above 5 MB it can't be saved any more, so delete sheets or rows you don't need.`,
    conflict: (list: Conflict[]) => conflictEn("Rows or columns of this spreadsheet were moved in two places at once.", list),
    conflictElsewhere: (page: string, list: Conflict[]) => conflictEn(`Rows or columns of “${page}” were moved in two places at once.`, list),
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
    noChart: "Select the numbers you want to chart first.",

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
        areas: "Move between cells, message, settings and toolbar",
      },
    },
  },
  de: {
    kind: "Tabelle",
    untitled: "Unbenannte Tabelle",
    titleLabel: "Titel",
    editor: "Tabellenkalkulation",
    viewOnly: "Du kannst dir diese Tabelle ansehen. Frag die Person, der sie gehört, wenn du mitbearbeiten möchtest.",
    denied: "Du kannst diese Tabelle nicht mehr bearbeiten. Frag die Person, der sie gehört, nach Zugang.",
    unreadable: "Diese Tabelle konnte nicht gelesen werden. Damit nichts verloren geht, ist sie nur zum Ansehen geöffnet.",
    tooBig: "Diese Tabelle ist zu groß zum Speichern (mehr als 5 MB). Lösche Blätter oder Zeilen, die du nicht mehr brauchst.",
    restored: "Deine ungespeicherten Änderungen von diesem Gerät sind wieder da.",
    saveTrouble: "Speichern klappt gerade nicht. Deine Änderungen bleiben auf diesem Gerät, und ich versuche es weiter.",
    saveBack: "Gespeichert. Jetzt klappt es wieder.",
    nearlyFull: (bytes) => `Diese Tabelle ist schon ${mb(bytes, "de-DE")} MB groß. Ab 5 MB kann sie nicht mehr gespeichert werden – lösche Blätter oder Zeilen, die du nicht brauchst.`,
    conflict: (list) => conflictDe("In dieser Tabelle wurden gleichzeitig an zwei Stellen Zeilen oder Spalten verschoben.", list),
    conflictElsewhere: (page, list) => conflictDe(`In „${page}“ wurden gleichzeitig an zwei Stellen Zeilen oder Spalten verschoben.`, list),
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
    importOldXls: "Alte .xls-Dateien kann ich nicht lesen. Speichere sie in Excel zuerst als .xlsx.",
    importTooBig: "Die Datei ist zu groß (höchstens 20 MB).",
    importTooBigSheet: (bytes) => `Daraus würde eine Tabelle mit ${mb(bytes, "de-DE")} MB – zu groß zum Speichern (höchstens 5 MB). Teile die Datei auf oder lass Spalten weg, die du nicht brauchst.`,
    importNoRoom: (bytes) => `Mit dieser Datei wäre die Tabelle ${mb(bytes, "de-DE")} MB groß – zu groß zum Speichern (höchstens 5 MB). Importiere sie lieber als neue Tabelle.`,
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
    noChart: "Markiere zuerst die Zahlen, aus denen ein Diagramm werden soll.",

    chartSettings: "Diagrammeinstellungen",
    tableSettings: "Tabelleneinstellungen",
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
        areas: "Zwischen Zellen, Hinweis, Einstellungen und Werkzeugleiste wechseln",
      },
    },
  },
});
