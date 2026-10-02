import { defineMessages } from "../define";

/** Workspace-wide toasts (Blob says them) and the starter slides of a new presentation. */
export const workspaceText = defineMessages({
  en: {
    notSaved: "Hmm, that didn't save. Check your connection?",
    createFailed: "I couldn't create that page. Try again?",
    trashed: "Moved to trash. You can restore it anytime.",
    subjectFailed: "I couldn't add that subject.",
    subjectAdded: (name: string) => `${name} added!`,
    deck: {
      title: "Your big idea",
      subtitle: "A short subtitle, or your name",
      bulletsTitle: "Three things to know",
      bullets: "First point\nSecond point\nThird point",
    },
  },
  de: {
    notSaved: "Hm, das wurde nicht gespeichert. Ist deine Verbindung okay?",
    createFailed: "Ich konnte die Seite nicht erstellen. Nochmal versuchen?",
    trashed: "In den Papierkorb verschoben. Du kannst sie jederzeit wiederherstellen.",
    subjectFailed: "Ich konnte das Fach nicht hinzufügen.",
    subjectAdded: (name) => `${name} hinzugefügt!`,
    deck: {
      title: "Deine große Idee",
      subtitle: "Ein kurzer Untertitel oder dein Name",
      bulletsTitle: "Drei Dinge, die du wissen solltest",
      bullets: "Erster Punkt\nZweiter Punkt\nDritter Punkt",
    },
  },
});
