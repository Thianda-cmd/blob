import { defineMessages } from "../define";

/** Offline mode: the status pill, the offline pages and what Blob says about changes (src/lib/offline). */
export const offlineText = defineMessages({
  en: {
    offline: "Offline",
    waiting: (n: number) => (n === 1 ? "1 change waiting" : `${n} changes waiting`),
    sending: "Saving…",
    offlineHint: "You're offline. What you change is kept on this device and saved as soon as you're back.",
    waitingHint: "These changes are on this device and will be saved when the connection is back.",
    backOnline: "Back online. Everything's saved.",
    refused: {
      events: "I couldn't save that change to your calendar, so I put it back.",
      tasks: "I couldn't save that change to a task, so I put it back.",
    },
    page: {
      title: "You're offline",
      body: "This page isn't on this device yet. Pages you've opened before work offline.",
      retry: "Try again",
      home: "Go to Home",
      notesHeading: "Notes on this device",
      noNotes: "No notes saved on this device yet.",
      noteMissing: "This note isn't on this device.",
      readOnly: "Shared notes can only be read while you're offline.",
    },
  },
  de: {
    offline: "Offline",
    waiting: (n) => (n === 1 ? "1 Änderung wartet" : `${n} Änderungen warten`),
    sending: "Speichert…",
    offlineHint: "Du bist offline. Was du änderst, bleibt auf diesem Gerät und wird gespeichert, sobald du wieder online bist.",
    waitingHint: "Diese Änderungen sind auf diesem Gerät und werden gespeichert, sobald die Verbindung zurück ist.",
    backOnline: "Wieder online. Alles ist gespeichert.",
    refused: {
      events: "Diese Änderung am Kalender konnte ich nicht speichern, deshalb habe ich sie zurückgenommen.",
      tasks: "Diese Änderung an einer Aufgabe konnte ich nicht speichern, deshalb habe ich sie zurückgenommen.",
    },
    page: {
      title: "Du bist offline",
      body: "Diese Seite ist noch nicht auf diesem Gerät. Seiten, die du schon geöffnet hast, gehen auch offline.",
      retry: "Nochmal versuchen",
      home: "Zur Startseite",
      notesHeading: "Notizen auf diesem Gerät",
      noNotes: "Noch keine Notizen auf diesem Gerät gespeichert.",
      noteMissing: "Diese Notiz ist nicht auf diesem Gerät.",
      readOnly: "Geteilte Notizen kannst du offline nur lesen.",
    },
  },
});
