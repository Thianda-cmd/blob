import { defineMessages } from "../define";

/** Blob, the helper: the corner helper's panel and tips, and the intro. */
export const blobText = defineMessages({
  en: {
    helperTitle: "Blob, your helper",
    needAHand: (name: string) => `Hey${name ? ` ${name}` : ""}! Need a hand?`,
    close: "Close",
    newNote: "New note",
    newDeck: "New presentation",
    addTask: "Add homework or exam",
    anotherTip: "Another tip →",
    tips: [
      "Type / in a note to add headings, checklists, quotes and more.",
      "Press ⌘K (Ctrl K) to jump to any note in a second.",
      "Select text in a note to make it bold, highlighted or a link.",
      "Add homework on the Tasks page. Try “Essay due friday”.",
      "Presentations have a Present button. Use the arrow keys to move through slides.",
      "Everything saves automatically. I keep an eye on it.",
      "Drop an image into a note to add it.",
    ],
    // The intro while the app opens
    opening: "Opening Blob",
    boot: ["Waking up Blob", "Gathering your notes", "Sharpening pencils", "Almost there"],
  },
  de: {
    helperTitle: "Blob, dein Helfer",
    needAHand: (name) => `Hey${name ? ` ${name}` : ""}! Kann ich dir helfen?`,
    close: "Schließen",
    newNote: "Neue Notiz",
    newDeck: "Neue Präsentation",
    addTask: "Hausaufgabe oder Test eintragen",
    anotherTip: "Noch ein Tipp →",
    tips: [
      "Tippe / in einer Notiz für Überschriften, Checklisten, Zitate und mehr.",
      "Drück ⌘K (Strg K), um blitzschnell zu jeder Notiz zu springen.",
      "Markiere Text in einer Notiz, um ihn fett, hervorgehoben oder zum Link zu machen.",
      "Trag Hausaufgaben auf der Aufgaben-Seite ein. Probier mal „Aufsatz bis Freitag“.",
      "Präsentationen haben einen Präsentieren-Button. Mit den Pfeiltasten gehst du durch die Folien.",
      "Alles speichert sich automatisch. Ich pass darauf auf.",
      "Zieh ein Bild in eine Notiz, um es einzufügen.",
    ],
    opening: "Blob wird geöffnet",
    boot: ["Blob wacht auf", "Deine Notizen werden eingesammelt", "Bleistifte werden gespitzt", "Gleich geht’s los"],
  },
});
