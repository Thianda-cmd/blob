import { defineMessages } from "../define";

/**
 * Why undo or redo can't take a step back now (src/sheet/collab.ts takeBack): someone else moved
 * rows or columns of the sheet since; what happened to them can't be told; a sheet it needs is
 * gone; it would push data off the end of the sheet; or something went wrong.
 */
export type TakeBackRefusal = "moved" | "unknown" | "gone" | "full" | "error";

/** Two people's versions of a spreadsheet merged (src/sheet/collab.ts), and undo while others edit (src/components/sheet/store.ts). */
export const sheetCollabText = defineMessages({
  en: {
    /** After a sheet's name, for the copy that keeps my version when both people moved its rows or columns at once. */
    conflictSuffix: (n: number) => (n > 1 ? ` (conflict ${n})` : " (conflict)"),
    /** Undo or redo refused, naming the sheet concerned. */
    refused: (what: "undo" | "redo", why: TakeBackRefusal, sheet: string) => {
      const head = what === "undo" ? "This can't be undone any more" : "This can't be redone any more";
      switch (why) {
        case "moved":
          return `${head}: since then, someone (or you on another device) inserted, deleted, sorted or moved rows or columns in “${sheet}”.`;
        case "unknown":
          return `${head}: I can't tell exactly what has happened to the rows and columns of “${sheet}” since then.`;
        case "gone":
          return `${head}: the sheet “${sheet}” isn't there any more.`;
        case "full":
          return `${head}: there's no room for it in “${sheet}” any more – data would be pushed past the end of the sheet.`;
        case "error":
          return `${head}. Nothing in the spreadsheet was changed.`;
      }
    },
    /** Someone else's change of rows or columns took away the cell being typed into. */
    editGone: (typed: string) => `“${typed}” wasn't entered: someone (or you on another device) just deleted that cell's row or column, or moved the cell.`,
    /** …or moved the cells that were cut (the marching ants are gone). */
    cutStopped: "Cut cancelled: someone (or you on another device) just inserted, deleted or moved rows or columns where you cut. Cut the cells again.",
  },
  de: {
    conflictSuffix: (n) => (n > 1 ? ` (Konflikt ${n})` : " (Konflikt)"),
    refused: (what, why, sheet) => {
      const head = what === "undo" ? "Das lässt sich nicht mehr rückgängig machen" : "Das lässt sich nicht mehr wiederholen";
      switch (why) {
        case "moved":
          return `${head}: Inzwischen hat jemand (oder du auf einem anderen Gerät) in „${sheet}“ Zeilen oder Spalten eingefügt, gelöscht, sortiert oder verschoben.`;
        case "unknown":
          return `${head}: Was seitdem mit den Zeilen und Spalten von „${sheet}“ passiert ist, kann ich nicht genau nachverfolgen.`;
        case "gone":
          return `${head}: Das Blatt „${sheet}“ gibt es nicht mehr.`;
        case "full":
          return `${head}: Dafür ist in „${sheet}“ kein Platz mehr – Daten würden über das Ende des Blatts hinausgeschoben.`;
        case "error":
          return `${head}. An der Tabelle hat sich nichts geändert.`;
      }
    },
    editGone: (typed) => `„${typed}“ wurde nicht eingetragen: Jemand (oder du auf einem anderen Gerät) hat gerade die Zeile oder Spalte dieser Zelle gelöscht oder die Zelle verschoben.`,
    cutStopped: "Ausschneiden abgebrochen: Jemand (oder du auf einem anderen Gerät) hat gerade dort, wo du ausgeschnitten hast, Zeilen oder Spalten eingefügt, gelöscht oder verschoben. Schneide die Zellen noch einmal aus.",
  },
});
