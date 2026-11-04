import { defineMessages } from "../define";

/** Signed out without a connection (src/components/shell/SignedOut.tsx): the sign-in page opens once Blob is online again. */
export const signedOutText = defineMessages({
  en: {
    title: "You're signed out",
    body: "Nothing of your account is left on this device. There's no connection right now: the sign-in page opens as soon as you're back online.",
  },
  de: {
    title: "Du bist abgemeldet",
    body: "Von deinem Konto ist nichts mehr auf diesem Gerät. Gerade gibt es keine Verbindung: Die Anmeldung öffnet sich, sobald du wieder online bist.",
  },
});
