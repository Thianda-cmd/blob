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
    notes: {
      copyTitle: (title: string) => `${title || "Untitled"} (offline copy)`,
      conflict: (title: string) => `This note was changed on another device while you were offline. I kept your version as “${title}”.`,
      copyFailed: "This note was changed on another device. I couldn't keep your version as a copy yet, so it stays here on this device and I'll try again.",
      sharedOffline: "This note is shared. You can read it here; changes to it need a connection.",
    },
    signOut: {
      title: "Not everything is saved yet",
      body: (n: number) =>
        `${n === 1 ? "1 change" : `${n} changes`} on this device couldn't be sent yet (no connection). Signing out now deletes ${n === 1 ? "it" : "them"} from this device. Sign out once you're online, and nothing is lost.`,
      confirm: "Sign out anyway",
    },
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
      readOnly: "You can read this note here. To change it, open it again when you're online.",
      noteTitle: "Note on this device",
      fromDevice: "Opened from this device. What you write is saved here and goes to the cloud when you're back online.",
      openLatest: "Open the latest version",
      pagesHeading: "Pages on this device",
      empty: "Nothing is saved on this device yet. Open Blob once with a connection.",
    },
  },
  de: {
    offline: "Offline",
    waiting: (n) => (n === 1 ? "1 Änderung wartet" : `${n} Änderungen warten`),
    sending: "Speichert…",
    offlineHint: "Du bist offline. Was du änderst, bleibt auf diesem Gerät und wird gespeichert, sobald du wieder online bist.",
    waitingHint: "Diese Änderungen sind auf diesem Gerät und werden gespeichert, sobald die Verbindung zurück ist.",
    backOnline: "Wieder online. Alles ist gespeichert.",
    notes: {
      copyTitle: (title) => `${title || "Ohne Titel"} (Offline-Kopie)`,
      conflict: (title) => `Diese Notiz wurde auf einem anderen Gerät geändert, während du offline warst. Deine Fassung habe ich als „${title}“ behalten.`,
      copyFailed: "Diese Notiz wurde auf einem anderen Gerät geändert. Deine Fassung konnte ich noch nicht als Kopie ablegen, sie bleibt hier auf dem Gerät und ich versuche es gleich nochmal.",
      sharedOffline: "Diese Notiz ist geteilt. Du kannst sie hier lesen; ändern geht nur mit Verbindung.",
    },
    signOut: {
      title: "Noch nicht alles gespeichert",
      body: (n) =>
        `${n === 1 ? "1 Änderung" : `${n} Änderungen`} auf diesem Gerät ${n === 1 ? "konnte" : "konnten"} noch nicht gesendet werden (keine Verbindung). Wenn du dich jetzt abmeldest, ${n === 1 ? "wird sie" : "werden sie"} von diesem Gerät gelöscht. Melde dich ab, wenn du online bist, dann geht nichts verloren.`,
      confirm: "Trotzdem abmelden",
    },
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
      readOnly: "Du kannst diese Notiz hier lesen. Ändern kannst du sie, wenn du wieder online bist.",
      noteTitle: "Notiz auf diesem Gerät",
      fromDevice: "Von diesem Gerät geöffnet. Was du schreibst, wird hier gespeichert und kommt in die Cloud, sobald du wieder online bist.",
      openLatest: "Neueste Fassung öffnen",
      pagesHeading: "Seiten auf diesem Gerät",
      empty: "Auf diesem Gerät ist noch nichts gespeichert. Öffne Blob einmal mit Verbindung.",
    },
  },
});
