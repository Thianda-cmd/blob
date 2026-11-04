import { defineMessages } from "../define";

/**
 * Why undo or redo can't take a step back now (src/sheet/collab.ts takeBack): someone else moved
 * rows or columns of the sheet since; what happened to them can't be told; a sheet it needs is
 * gone; it would push data off the end of the sheet; something would be lost (it would delete or
 * paste over what someone wrote since into rows or columns that were empty, or put something back
 * into rows or columns someone deleted since); the step was on a sheet whose two versions couldn't
 * be combined, and mine is on a copy now (store.replaceRemote); or something went wrong.
 */
export type TakeBackRefusal = "moved" | "unknown" | "gone" | "full" | "deleted" | "conflict" | "error";

const joinEn = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items.join(""));
const joinDe = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}` : items.join(""));

/** Two people's versions of a spreadsheet merged (src/sheet/collab.ts), and undo while others edit (src/components/sheet/store.ts). */
export const sheetCollabText = defineMessages({
  en: {
    /** After a sheet's name, for the copy that keeps my version when both people moved its rows or columns at once. */
    conflictSuffix: (n: number) => (n > 1 ? ` (conflict ${n})` : " (conflict)"),
    /** Undo or redo refused, naming the sheet concerned (and for "conflict" the copy my version is on: "" when there is none). */
    refused: (what: "undo" | "redo", why: TakeBackRefusal, sheet: string, copy?: string) => {
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
        case "deleted":
          return `${head}: since then, someone (or you on another device) has entered something or deleted rows or columns in “${sheet}”, and something would get lost.`;
        case "conflict":
          return copy ? `${head}: your version of “${sheet}” is now on “${copy}” – change it there.` : `${head}: only the other version of “${sheet}” is left.`;
        case "error":
          return `${head}. Nothing in the spreadsheet was changed.`;
      }
    },
    /**
     * Undo or redo done, except what someone changed after the step, which stays as it is: `cells`
     * ("C5", "Auswertung!B2"), `more` cells besides, and `sheets` by name (all may be empty).
     */
    kept: (what: "undo" | "redo", cells: string[], more: number, sheets: string[]) => {
      const head = what === "undo" ? "Undone" : "Redone";
      const items = [...cells, ...(more ? [more === 1 ? "1 more cell" : `${more} more cells`] : []), ...sheets.map((s) => `the sheet “${s}”`)];
      if (!items.length) return `${head}, except what someone else (or you on another device) changed in the meantime: that stays as it is.`;
      return `${head}, except ${joinEn(items)}: someone else (or you on another device) changed that in the meantime, so it stays as it is.`;
    },
    /** A sheet I deleted is back with someone else's save: they had written into it meanwhile (collab.ts keeps it). */
    sheetBack: (sheet: string) => `“${sheet}” is back: you had deleted it, but meanwhile someone (or you on another device) had entered something in it.`,
    /** Someone else's change of rows or columns took away the cell being typed into. */
    editGone: (typed: string) => `“${typed}” wasn't entered: someone (or you on another device) just deleted that cell's row or column, or moved the cell.`,
    /** …or moved the cells that were cut (the marching ants are gone). */
    cutStopped: "Cut cancelled: someone (or you on another device) just inserted, deleted or moved rows or columns where you cut. Cut the cells again.",
  },
  de: {
    conflictSuffix: (n) => (n > 1 ? ` (Konflikt ${n})` : " (Konflikt)"),
    refused: (what, why, sheet, copy) => {
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
        case "deleted":
          return `${head}: Inzwischen hat jemand (oder du auf einem anderen Gerät) in „${sheet}“ etwas eingetragen oder Zeilen oder Spalten gelöscht, und dabei ginge etwas verloren.`;
        case "conflict":
          return copy ? `${head}: Deine Version von „${sheet}“ steht jetzt auf „${copy}“ – ändere sie dort.` : `${head}: Von „${sheet}“ gibt es nur noch die andere Version.`;
        case "error":
          return `${head}. An der Tabelle hat sich nichts geändert.`;
      }
    },
    kept: (what, cells, more, sheets) => {
      const head = what === "undo" ? "Rückgängig gemacht" : "Wiederholt";
      const items = [...cells, ...(more ? [more === 1 ? "1 weitere Zelle" : `${more} weitere Zellen`] : []), ...sheets.map((s) => `das Blatt „${s}“`)];
      if (!items.length) return `${head}, bis auf das, was inzwischen jemand anderes (oder du auf einem anderen Gerät) geändert hat: Das bleibt so.`;
      return `${head}, bis auf ${joinDe(items)}: Das hat inzwischen jemand anderes (oder du auf einem anderen Gerät) geändert, darum bleibt es so.`;
    },
    sheetBack: (sheet) => `„${sheet}“ ist wieder da: Du hattest das Blatt gelöscht, aber inzwischen hatte jemand (oder du auf einem anderen Gerät) darin etwas eingetragen.`,
    editGone: (typed) => `„${typed}“ wurde nicht eingetragen: Jemand (oder du auf einem anderen Gerät) hat gerade die Zeile oder Spalte dieser Zelle gelöscht oder die Zelle verschoben.`,
    cutStopped: "Ausschneiden abgebrochen: Jemand (oder du auf einem anderen Gerät) hat gerade dort, wo du ausgeschnitten hast, Zeilen oder Spalten eingefügt, gelöscht oder verschoben. Schneide die Zellen noch einmal aus.",
  },
});
