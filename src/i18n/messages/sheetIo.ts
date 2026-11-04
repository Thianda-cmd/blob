import { defineMessages } from "../define";

/** What became of formulas that couldn't come along (the import's note lists them after "Nicht übernommen:"). */
const keptEn = (n: number) => (n === 1 ? "its result is kept as a value" : "their results are kept as values");
const keptDe = (n: number) => (n === 1 ? "ihr Ergebnis steht als Wert in der Zelle" : "ihre Ergebnisse stehen als Werte in den Zellen");

/**
 * Getting data in and out of spreadsheets (src/sheet/io): Excel files, CSV and the clipboard. The
 * import's notes say what couldn't come along, in words a student understands.
 */
export const sheetIoText = defineMessages({
  en: {
    /** Name of a sheet without one. */
    sheet: (n: number) => `Sheet ${n}`,
    /** Who wrote a note (comments in the Excel file). */
    author: "Blob",
    /** No sheet of a file fits into the spreadsheet any more. */
    full: (max: number) => `This spreadsheet already has ${max} sheets, the most it can hold. Import the file as a new spreadsheet instead: “Import a file” in Notes.`,
    errors: {
      notXlsx: "This isn't an Excel file (.xlsx). Excel, LibreOffice and Google Sheets can save one: File → Save as → Excel workbook.",
      oldXls: "This is an old Excel file (.xls). Open it in Excel or LibreOffice and save it as .xlsx or CSV, then try again.",
      encrypted: "This file is protected with a password. Open it in Excel, remove the password and save it again.",
      ods: "This is a LibreOffice file (.ods). Save it in LibreOffice as Excel 2007–365 (.xlsx), then try again.",
      numbers: "This is a Numbers file. In Numbers choose File → Export to → Excel, then open that file.",
      broken: "This file seems to be damaged or incomplete. Try saving it again in Excel.",
      noSheets: "There is no sheet in this file.",
      unsupported: "I can't open this file. Save it again as .xlsx in Excel and try once more.",
      tooBig: "This file is too big to open here, or it is damaged. Split it into smaller files, or save it again in Excel.",
      slow: "Reading this file took too long, so I stopped. Is it very big? Split it into smaller files and try again.",
      notTable: "There is no table in this file that I can read. Open it in Excel or LibreOffice and save it as .xlsx or CSV.",
    },
    /** What an import left out (each a short line, number first). */
    skipped: {
      merged: (n: number) => (n === 1 ? "1 merged cell area (its text is in the first cell)" : `${n} merged cell areas (the text is in the first cell)`),
      charts: (n: number) => (n === 1 ? "1 chart Blob can't draw (3-D, doughnut, radar…)" : `${n} charts Blob can't draw (3-D, doughnut, radar…)`),
      chartSheets: (n: number) => (n === 1 ? "1 chart sheet" : `${n} chart sheets`),
      pictures: (n: number) => (n === 1 ? "1 picture" : `${n} pictures`),
      shapes: (n: number) => (n === 1 ? "1 drawing or text box" : `${n} drawings or text boxes`),
      conditional: (n: number) => (n === 1 ? "1 conditional format" : `${n} conditional formats`),
      validation: (n: number) => (n === 1 ? "1 data validation (drop-down list or input rule)" : `${n} data validations (drop-down lists or input rules)`),
      links: (n: number) => (n === 1 ? "1 hyperlink (the text stays)" : `${n} hyperlinks (the text stays)`),
      unknownFunctions: (n: number, names: string) => `${n === 1 ? "1 formula" : `${n} formulas`} with functions Blob doesn't know (${names}; ${keptEn(n)})`,
      external: (n: number) => `${n === 1 ? "1 formula" : `${n} formulas`} with references to other files (${keptEn(n)})`,
      tableRefs: (n: number) => `${n === 1 ? "1 formula" : `${n} formulas`} with table references Blob couldn't read (${keptEn(n)})`,
      badFormulas: (n: number) => `${n === 1 ? "1 formula" : `${n} formulas`} Blob couldn't read (${keptEn(n)})`,
      arrays: (n: number) => (n === 1 ? "1 array formula (only its first result is calculated)" : `${n} array formulas (only their first result is calculated)`),
      filters: (n: number) => (n === 1 ? "1 filter Blob doesn't have (all rows are shown)" : `${n} filters Blob doesn't have (all rows are shown)`),
      sheetFilter: "a filter on a whole sheet (all rows are shown)",
      noHeaderTables: (n: number) => (n === 1 ? "1 table without a header row (kept as plain cells)" : `${n} tables without a header row (kept as plain cells)`),
      pivots: (n: number) => (n === 1 ? "1 PivotTable (kept as values)" : `${n} PivotTables (kept as values)`),
      sparklines: "sparklines",
      macros: "macros",
      protection: "sheet protection",
      outline: "groups of rows or columns (what was collapsed stays hidden)",
      tooBig: (n: number, rows: string, cols: number) => `${n === 1 ? "1 cell" : `${n} cells`} beyond ${rows} rows and ${cols} columns`,
      longText: (n: number) => `${n === 1 ? "1 very long text" : `${n} very long texts`} (shortened)`,
      sheetLimit: (n: number, max: number) => `${n === 1 ? "1 sheet" : `${n} sheets`} after the first${max === 1 ? " one" : ` ${max}`} (no more fit into this spreadsheet)`,
      longFormulas: (n: number, max: string) => `${n === 1 ? "1 formula" : `${n} formulas`} longer than ${max} characters (${keptEn(n)})`,
      chartLimit: (n: number, max: number) => `${n === 1 ? "1 chart" : `${n} charts`} after the first${max === 1 ? " one" : ` ${max}`}`,
      seriesLimit: (n: number, max: number) => `${n === 1 ? "1 data series" : `${n} data series`} (a chart holds ${max} at most)`,
      tableLimit: (n: number) =>
        n === 1 ? "1 smart table that overlaps another or is one too many (kept as plain cells)" : `${n} smart tables that overlap others or are too many (kept as plain cells)`,
      cells: (n: number) => (n === 1 ? "1 cell Blob can't keep" : `${n} cells Blob can't keep`),
    },
  },
  de: {
    sheet: (n) => `Blatt ${n}`,
    author: "Blob",
    full: (max) => `Diese Tabelle hat schon ${max} Blätter, mehr passen nicht hinein. Importier die Datei lieber als neue Tabelle: „Datei importieren“ in den Notizen.`,
    errors: {
      notXlsx: "Das ist keine Excel-Datei (.xlsx). Excel, LibreOffice und Google Tabellen können eine speichern: Datei → Speichern unter → Excel-Arbeitsmappe.",
      oldXls: "Das ist eine alte Excel-Datei (.xls). Öffne sie in Excel oder LibreOffice, speicher sie als .xlsx oder CSV und versuch es dann nochmal.",
      encrypted: "Diese Datei ist mit einem Passwort geschützt. Öffne sie in Excel, entfern das Passwort und speicher sie nochmal.",
      ods: "Das ist eine LibreOffice-Datei (.ods). Speicher sie in LibreOffice als „Excel 2007–365 (.xlsx)“ und versuch es dann nochmal.",
      numbers: "Das ist eine Numbers-Datei. Wähl in Numbers „Ablage → Exportieren → Excel“ und öffne dann diese Datei.",
      broken: "Die Datei scheint beschädigt oder unvollständig zu sein. Speicher sie in Excel nochmal und versuch es erneut.",
      noSheets: "In dieser Datei ist kein Tabellenblatt.",
      unsupported: "Diese Datei kann ich nicht öffnen. Speicher sie in Excel nochmal als .xlsx und versuch es erneut.",
      tooBig: "Diese Datei ist zu groß, um sie hier zu öffnen, oder sie ist beschädigt. Teil sie in kleinere Dateien auf oder speicher sie in Excel nochmal.",
      slow: "Das Lesen hat zu lange gedauert, deshalb habe ich aufgehört. Ist die Datei sehr groß? Teil sie in kleinere Dateien auf und versuch es nochmal.",
      notTable: "In dieser Datei ist keine Tabelle, die ich lesen kann. Öffne sie in Excel oder LibreOffice und speicher sie als .xlsx oder CSV.",
    },
    skipped: {
      merged: (n) => (n === 1 ? "1 verbundener Zellbereich (der Text steht in der ersten Zelle)" : `${n} verbundene Zellbereiche (der Text steht jeweils in der ersten Zelle)`),
      charts: (n) => (n === 1 ? "1 Diagramm, das Blob nicht zeichnen kann (3D, Ring, Netz …)" : `${n} Diagramme, die Blob nicht zeichnen kann (3D, Ring, Netz …)`),
      chartSheets: (n) => (n === 1 ? "1 Diagrammblatt" : `${n} Diagrammblätter`),
      pictures: (n) => (n === 1 ? "1 Bild" : `${n} Bilder`),
      shapes: (n) => (n === 1 ? "1 Zeichnung oder Textfeld" : `${n} Zeichnungen oder Textfelder`),
      conditional: (n) => (n === 1 ? "1 bedingte Formatierung" : `${n} bedingte Formatierungen`),
      validation: (n) => (n === 1 ? "1 Datenüberprüfung (Auswahlliste oder Eingaberegel)" : `${n} Datenüberprüfungen (Auswahllisten oder Eingaberegeln)`),
      links: (n) => (n === 1 ? "1 Link (der Text bleibt)" : `${n} Links (der Text bleibt)`),
      unknownFunctions: (n, names) => `${n === 1 ? "1 Formel" : `${n} Formeln`} mit Funktionen, die Blob nicht kennt (${names}; ${keptDe(n)})`,
      external: (n) => `${n === 1 ? "1 Formel" : `${n} Formeln`} mit Bezügen auf andere Dateien (${keptDe(n)})`,
      tableRefs: (n) => `${n === 1 ? "1 Formel" : `${n} Formeln`} mit Tabellenbezügen, die Blob nicht lesen konnte (${keptDe(n)})`,
      badFormulas: (n) => `${n === 1 ? "1 Formel" : `${n} Formeln`}, die Blob nicht lesen konnte (${keptDe(n)})`,
      arrays: (n) => (n === 1 ? "1 Matrixformel (nur ihr erstes Ergebnis wird berechnet)" : `${n} Matrixformeln (nur ihr erstes Ergebnis wird berechnet)`),
      filters: (n) => (n === 1 ? "1 Filter, den Blob nicht kennt (alle Zeilen werden gezeigt)" : `${n} Filter, die Blob nicht kennt (alle Zeilen werden gezeigt)`),
      sheetFilter: "ein Filter auf einem ganzen Blatt (alle Zeilen werden gezeigt)",
      noHeaderTables: (n) => (n === 1 ? "1 Tabelle ohne Überschriftenzeile (als normale Zellen übernommen)" : `${n} Tabellen ohne Überschriftenzeile (als normale Zellen übernommen)`),
      pivots: (n) => (n === 1 ? "1 PivotTable (als Werte übernommen)" : `${n} PivotTables (als Werte übernommen)`),
      sparklines: "Sparklines",
      macros: "Makros",
      protection: "Blattschutz",
      outline: "Gruppierungen von Zeilen oder Spalten (Eingeklapptes bleibt ausgeblendet)",
      tooBig: (n, rows, cols) => `${n === 1 ? "1 Zelle" : `${n} Zellen`} jenseits von ${rows} Zeilen und ${cols} Spalten`,
      longText: (n) => `${n === 1 ? "1 sehr langer Text" : `${n} sehr lange Texte`} (gekürzt)`,
      sheetLimit: (n, max) => `${n === 1 ? "1 Blatt" : `${n} Blätter`} ${max === 1 ? "nach dem ersten" : `nach den ersten ${max}`} (mehr passen nicht in diese Tabelle)`,
      longFormulas: (n, max) => `${n === 1 ? "1 Formel" : `${n} Formeln`} mit mehr als ${max} Zeichen (${keptDe(n)})`,
      chartLimit: (n, max) => `${n === 1 ? "1 Diagramm" : `${n} Diagramme`} ${max === 1 ? "nach dem ersten" : `nach den ersten ${max}`}`,
      seriesLimit: (n, max) => `${n === 1 ? "1 Datenreihe" : `${n} Datenreihen`} (ein Diagramm hat höchstens ${max})`,
      tableLimit: (n) =>
        n === 1
          ? "1 intelligente Tabelle, die eine andere überlappt oder eine zu viel ist (als normale Zellen übernommen)"
          : `${n} intelligente Tabellen, die andere überlappen oder zu viele sind (als normale Zellen übernommen)`,
      cells: (n) => (n === 1 ? "1 Zelle, die Blob nicht behalten kann" : `${n} Zellen, die Blob nicht behalten kann`),
    },
  },
});

export type SheetIoText = (typeof sheetIoText)["en"];
