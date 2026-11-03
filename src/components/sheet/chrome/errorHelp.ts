// What an error in a cell means and what to do about it, in one place, so the cell's tooltip, the
// status bar and screen readers say the same: the error's name and explanation with its advice
// ("Prüf den Nenner – oder fang den Fall mit WENNFEHLER ab.", src/i18n/messages/sheetGrid.ts),
// or, when the engine knows more about this very case (the function "SUMM" doesn't exist, the
// sheet is gone, STABW.S got one number), the engine's own sentence; an unknown function also
// gets "Meintest du SUMME?". A formula that can't be read at all (#NAME? with nothing unknown in
// it) says where it goes wrong, as the cell editor does while it is typed.

import type { Locale } from "@/i18n/config";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { explainError, suggestFunction, toCanonicalFormula, toLocalFormula, type CellError } from "@/sheet/engine";

/** `formula`: the cell's formula as stored (without "="), when there is one: it explains a formula that can't be read. */
export function errorHelp(err: CellError, locale: Locale, formula?: string): { title: string; text: string } {
  if (err.error === "#NAME?" && err.detail === "syntax") {
    const read = formula ? toCanonicalFormula(toLocalFormula(formula, locale), locale) : null;
    return { title: sheetChromeText[locale].formulaMistake, text: read && "error" in read ? read.error : explainError(err, locale) };
  }
  const { title, text } = sheetGridText[locale].errors[err.error];
  // The engine's sentence only when the detail changes it (for most errors it is the general one).
  const specific = err.detail ? explainError(err, locale) : "";
  if (!specific || specific === explainError({ error: err.error }, locale)) return { title, text };
  const unknown = /^unknown-function:(.+)$/.exec(err.detail ?? "")?.[1];
  const guess = unknown ? suggestFunction(unknown, locale) : null;
  return { title, text: guess && guess.toUpperCase() !== unknown?.toUpperCase() ? `${specific} ${sheetChromeText[locale].didYouMean(guess)}` : specific };
}
