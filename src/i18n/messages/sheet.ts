import { defineMessages } from "../define";

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
    someoneChanged: (name: string) => `${name} changed something`,

    exportXlsx: "Export as Excel file (.xlsx)",
    exportCsv: "Export this sheet as CSV",
    importFile: "Import an Excel or CSV file",
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
    importEmpty: "There's nothing in that file.",
    importCut: (rows: string) => `Only the first ${rows} rows fit.`,
    importLabel: "Import",
    templateLabel: "Template",
    printEmpty: "There's nothing on this sheet to print yet.",

    insertChart: "Insert chart",
    addToNote: "Add to a note",
    noChart: "Select the numbers you want to chart first.",

    chartSettings: "Chart settings",
    tableSettings: "Smart table settings",

    sheets: "Sheets",
    empty: "This spreadsheet is empty.",
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
    someoneChanged: (name) => `${name} hat etwas geändert`,

    exportXlsx: "Als Excel-Datei (.xlsx) exportieren",
    exportCsv: "Aktuelles Blatt als CSV exportieren",
    importFile: "Excel- oder CSV-Datei importieren",
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
    importEmpty: "In dieser Datei steht nichts.",
    importCut: (rows) => `Nur die ersten ${rows} Zeilen passen hinein.`,
    importLabel: "Importieren",
    templateLabel: "Vorlage",
    printEmpty: "Auf diesem Blatt gibt es noch nichts zu drucken.",

    insertChart: "Diagramm einfügen",
    addToNote: "In Notiz einfügen",
    noChart: "Markiere zuerst die Zahlen, aus denen ein Diagramm werden soll.",

    chartSettings: "Diagramm-Einstellungen",
    tableSettings: "Tabellen-Einstellungen",

    sheets: "Blätter",
    empty: "Diese Tabelle ist leer.",
  },
});
