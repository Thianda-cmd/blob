import { defineMessages } from "../define";

/** Around a note or presentation: top bar, save state, autosave, the trashed-page notice, the /p route. */
export const pageText = defineMessages({
  en: {
    notFound: "Not found",
    // Top bar
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    options: "Page options",
    moveToSubject: "Move to subject",
    noSubject: "No subject",
    copyLink: "Copy link",
    linkCopied: "Link copied. Only you can open it.",
    moveToTrash: "Move to trash",
    // Save state
    saved: "Saved",
    saving: "Saving",
    offline: "Offline, retrying",
    cantReach: "I can't reach the server. I'll keep trying.",
    backOnline: "Back online. Everything is saved!",
    // Trashed page
    trash: "Trash",
    inTrash: (title: string) => `“${title}” is in the trash`,
    restoreHint: "Restore it to keep working on it.",
    restore: "Restore",
    restoreFailed: "Couldn't restore it. Try again?",
  },
  de: {
    notFound: "Nicht gefunden",
    addFavorite: "Zu Favoriten hinzufügen",
    removeFavorite: "Aus Favoriten entfernen",
    options: "Seitenoptionen",
    moveToSubject: "In Fach verschieben",
    noSubject: "Kein Fach",
    copyLink: "Link kopieren",
    linkCopied: "Link kopiert. Nur du kannst ihn öffnen.",
    moveToTrash: "In den Papierkorb",
    saved: "Gespeichert",
    saving: "Speichert",
    offline: "Offline, versuche erneut",
    cantReach: "Ich erreiche den Server gerade nicht. Ich versuche es weiter.",
    backOnline: "Wieder online. Alles ist gespeichert!",
    trash: "Papierkorb",
    inTrash: (title) => `„${title}“ liegt im Papierkorb`,
    restoreHint: "Stell sie wieder her, um daran weiterzuarbeiten.",
    restore: "Wiederherstellen",
    restoreFailed: "Das Wiederherstellen hat nicht geklappt. Nochmal versuchen?",
  },
});
