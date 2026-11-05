import { defineMessages } from "../define";

/**
 * Making a new page (src/components/shell/NewPageMenu.tsx): the kinds, in the order every create
 * menu, button row and card grid shows them. The spreadsheet feature is called Blobxcel; what it
 * makes is still a "Tabelle" / "spreadsheet".
 */
export const newPageText = defineMessages({
  en: {
    button: "New",
    label: "Create new",
    title: "New: note, Blobxcel spreadsheet, handwriting, presentation",
    more: "More kinds",
    cards: "Create",
    kinds: {
      note: { name: "Note", short: "Note", hint: "Write, flashcards, quizzes", create: "New note" },
      sheet: { name: "Blobxcel spreadsheet", short: "Blobxcel", hint: "Formulas, charts, lab templates", create: "New Blobxcel spreadsheet" },
      ink: { name: "Handwriting", short: "Handwriting", hint: "Write and draw with a pen", create: "New handwritten note" },
      deck: { name: "Presentation", short: "Presentation", hint: "Slides for your talk", create: "New presentation" },
      folder: { name: "Folder", short: "Folder", hint: "Keep pages together", create: "New folder" },
    },
  },
  de: {
    button: "Neu",
    label: "Neu anlegen",
    title: "Neu: Notiz, Blobxcel-Tabelle, Handschrift, Präsentation",
    more: "Weitere Arten",
    cards: "Neu anlegen",
    kinds: {
      note: { name: "Notiz", short: "Notiz", hint: "Schreiben, Karteikarten, Quiz", create: "Neue Notiz" },
      sheet: { name: "Blobxcel-Tabelle", short: "Blobxcel", hint: "Rechnen, Diagramme, Laborvorlagen", create: "Neue Blobxcel-Tabelle" },
      ink: { name: "Handschrift", short: "Handschrift", hint: "Mit dem Stift schreiben und zeichnen", create: "Neue handschriftliche Notiz" },
      deck: { name: "Präsentation", short: "Präsentation", hint: "Folien fürs Referat", create: "Neue Präsentation" },
      folder: { name: "Ordner", short: "Ordner", hint: "Seiten zusammenhalten", create: "Neuer Ordner" },
    },
  },
});
