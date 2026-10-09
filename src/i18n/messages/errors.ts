import { defineMessages } from "../define";

/** The app-wide error and 404 pages. */
export const errorsText = defineMessages({
  en: {
    error: {
      title: "Oops, something went squish",
      body: "That wasn't supposed to happen. Your saved work is safe. Try again in a moment.",
      retry: "Try again",
    },
    notFound: {
      meta: "Page not found",
      title: "This page wobbled away",
      body: "It may have been deleted, or the link is wrong. Your other notes are safe.",
      home: "Back to Home",
      /** For visitors who aren't signed in: no notes to reassure about, and Home would ask them to sign in. */
      guestBody: "It may have moved, or the link is wrong.",
      guestHome: "To the start page",
    },
  },
  de: {
    error: {
      title: "Hoppla, da ist was schiefgewabbelt",
      body: "Das hätte nicht passieren sollen. Deine gespeicherte Arbeit ist sicher. Versuch es gleich nochmal.",
      retry: "Nochmal versuchen",
    },
    notFound: {
      meta: "Seite nicht gefunden",
      title: "Diese Seite ist weggewabbelt",
      body: "Vielleicht wurde sie gelöscht oder der Link ist falsch. Deine anderen Notizen sind sicher.",
      home: "Zurück zum Start",
      guestBody: "Vielleicht ist sie umgezogen oder der Link ist falsch.",
      guestHome: "Zur Startseite",
    },
  },
});
