import { defineMessages } from "../define";

/** The Blob app around the site (src-tauri, src/components/NativeBridge.tsx). */
export const nativeText = defineMessages({
  en: {
    printTitle: "Printing isn't available here yet",
    printBody: "This app can't print or save PDFs on this device yet. Open the page in your browser and print it from there (you may need to sign in there once).",
    openBrowser: "Open in browser",
    close: "Close",
  },
  de: {
    printTitle: "Drucken geht hier noch nicht",
    printBody: "Diese App kann auf diesem Gerät noch nicht drucken oder PDFs speichern. Öffne die Seite im Browser und drucke sie dort (eventuell musst du dich dort einmal anmelden).",
    openBrowser: "Im Browser öffnen",
    close: "Schließen",
  },
});
