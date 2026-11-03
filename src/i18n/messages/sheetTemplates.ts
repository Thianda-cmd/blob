import { defineMessages } from "../define";

/**
 * The start screen of a new spreadsheet (src/components/sheet/TemplatePicker.tsx). The templates'
 * own titles, descriptions and cell texts live with them in src/sheet/templates.ts.
 */
export const sheetTemplatesText = defineMessages({
  en: {
    label: "Start a new spreadsheet",
    heading: "How do you want to start?",
    intro: "With an empty sheet, or with a lab template that already has its formulas, smart table and chart. Everything in it is yours to change.",
    blank: "Blank spreadsheet",
    blankHint: "An empty sheet – just start typing.",
    templates: "Lab templates",
    close: "Close and start blank",
    keys: "to choose",
    open: "to open",
    blankKey: "blank sheet",
    // Feature tags on the cards
    kinds: { scatter: "Scatter chart", line: "Line chart", column: "Column chart", bar: "Bar chart", area: "Area chart", pie: "Pie chart" },
    trendline: "Trendline + R²",
    errorBars: "Error bars",
    logAxis: "Log axis",
    smartTable: "Smart table",
    formulas: (n: number) => (n === 1 ? "1 formula" : `${n} formulas`),
  },
  de: {
    label: "Neue Tabelle beginnen",
    heading: "Womit fängst du an?",
    intro: "Mit einem leeren Blatt oder mit einer Vorlage fürs Labor, in der Formeln, intelligente Tabelle und Diagramm schon fertig sind. Du kannst alles darin ändern.",
    blank: "Leere Tabelle",
    blankHint: "Ein leeres Blatt – tipp einfach los.",
    templates: "Vorlagen fürs Labor",
    close: "Schließen und leer beginnen",
    keys: "auswählen",
    open: "öffnen",
    blankKey: "leeres Blatt",
    kinds: { scatter: "Punktdiagramm", line: "Liniendiagramm", column: "Säulendiagramm", bar: "Balkendiagramm", area: "Flächendiagramm", pie: "Kreisdiagramm" },
    trendline: "Trendlinie + R²",
    errorBars: "Fehlerbalken",
    logAxis: "Log. Achse",
    smartTable: "Intelligente Tabelle",
    formulas: (n: number) => (n === 1 ? "1 Formel" : `${n} Formeln`),
  },
});
