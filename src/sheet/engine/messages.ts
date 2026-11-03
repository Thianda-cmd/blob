// Words for what went wrong: why a typed formula doesn't parse ("Hier fehlt eine schließende
// Klammer"), and what an error value in a cell means (for the tooltip on #WERT!, #BEZUG!…).

import type { Locale } from "@/i18n/config";
import { FUNCTION_BY_EN, FUNCTION_NAMES } from "./names";
import type { ParseError } from "./parser";
import type { CellError } from "./values";

/** A function's name in the user's language (SUMME / SUM). */
export function localName(canonical: string, locale: Locale): string {
  const f = FUNCTION_BY_EN.get(canonical);
  return f ? (locale === "de" ? f.de : f.en) : canonical;
}

function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[n];
}

/** The closest function name to a mistyped one ("SUMM" → "SUMME"), or null. */
export function suggestFunction(typed: string, locale: Locale): string | null {
  const up = typed.toUpperCase();
  let best: string | null = null;
  let bestD = Infinity;
  for (const f of FUNCTION_NAMES) {
    for (const name of locale === "de" ? [f.de, f.en] : [f.en]) {
      const d = distance(up, name);
      const shown = locale === "de" ? f.de : f.en;
      if (d < bestD || (d === bestD && name === shown)) {
        bestD = d;
        best = shown;
      }
    }
  }
  const limit = up.length <= 4 ? 1 : 2;
  return best && bestD <= limit ? best : null;
}

const q = (locale: Locale, s: string) => (locale === "de" ? `„${s}“` : `"${s}"`);

/** A parse error in plain words of the user's language. */
export function parseErrorMessage(e: ParseError, locale: Locale): string {
  const de = locale === "de";
  const text = e.text ?? "";
  const fnName = e.fn ? localName(e.fn, locale) : "";
  const sep = de ? ";" : ",";
  switch (e.code) {
    case "empty":
      return de ? "Die Formel ist noch leer." : "The formula is empty.";
    case "unclosed-paren":
      if (fnName) return de ? `Bei ${fnName}( fehlt die schließende Klammer ).` : `The closing bracket ) of ${fnName}( is missing.`;
      return de ? "Hier fehlt eine schließende Klammer )." : "A closing bracket ) is missing here.";
    case "unclosed-brace":
      return de ? "Hier fehlt die schließende geschweifte Klammer }." : "The closing brace } is missing here.";
    case "unexpected-close":
      return de ? `Zu dieser Klammer ${text || ")"} gibt es keine öffnende Klammer.` : `This ${text || ")"} has no opening bracket to match.`;
    case "missing-operand":
      if (text && "+-*/^&=<>:%".includes(text[0]))
        return de ? `Nach ${q(locale, text)} fehlt noch eine Zahl, ein Bezug oder eine Funktion.` : `Something is missing after ${q(locale, text)}: a number, a cell or a function.`;
      if (text === ";" || text === ",") return de ? `Vor ${q(locale, text)} fehlt ein Wert.` : `A value is missing before ${q(locale, text)}.`;
      return de ? "Hier fehlt eine Zahl, ein Bezug oder eine Funktion." : "Something is missing here: a number, a cell or a function.";
    case "missing-operator":
      return de
        ? `Vor ${q(locale, text)} fehlt ein Rechenzeichen (+ - * /) oder ein ${q(locale, sep)}.`
        : `An operator (+ - * /) or a ${q(locale, sep)} is missing before ${q(locale, text)}.`;
    case "unterminated-string":
      return de ? 'Hier fehlt das schließende Anführungszeichen ".' : 'The closing quotation mark " is missing.';
    case "bad-char":
      return de ? `Das Zeichen ${q(locale, text)} verstehe ich hier nicht.` : `I don't understand the character ${q(locale, text)} here.`;
    case "bad-ref":
      return de
        ? `${q(locale, text)} ist kein gültiger Bezug. So sieht einer aus: A1, B2:B10 oder 'Blatt 2'!A1.`
        : `${q(locale, text)} isn't a valid reference. They look like A1, B2:B10 or 'Sheet 2'!A1.`;
    case "bad-array":
      return de ? "In { } gehören nur Zahlen, Texte, WAHR oder FALSCH." : "Only numbers, text, TRUE or FALSE belong inside { }.";
    case "unknown-function": {
      const s = suggestFunction(text, locale);
      const name = text.toUpperCase();
      if (de) return `Die Funktion ${q(locale, name)} gibt es nicht.${s ? ` Meintest du ${s}?` : ""}`;
      return `There is no function called ${q(locale, name)}.${s ? ` Did you mean ${s}?` : ""}`;
    }
    case "unknown-name":
      return de
        ? `${q(locale, text)} ist weder eine Zelle noch eine Funktion. Text gehört in Anführungszeichen: "${text}".`
        : `${q(locale, text)} is neither a cell nor a function. Put text in quotation marks: "${text}".`;
    case "too-few-args":
      return de
        ? `${fnName} braucht mindestens ${e.count} ${e.count === 1 ? "Argument" : "Argumente"}.`
        : `${fnName} needs at least ${e.count} ${e.count === 1 ? "argument" : "arguments"}.`;
    case "too-deep":
      return de ? "Diese Formel ist zu tief verschachtelt." : "This formula is nested too deeply.";
    case "thousands":
      return de
        ? `${q(locale, text)}: In Formeln Dezimalzahlen mit Komma schreiben (1,5) und Tausender ohne Punkt (1000).`
        : `${q(locale, text)}: in formulas write decimals with a comma (1,5) and thousands without a dot (1000).`;
    case "too-many-args":
      return de
        ? `${fnName} hat höchstens ${e.count} ${e.count === 1 ? "Argument" : "Argumente"}.`
        : `${fnName} takes at most ${e.count} ${e.count === 1 ? "argument" : "arguments"}.`;
  }
  return de ? "Diese Formel verstehe ich nicht." : "I don't understand this formula.";
}

/** What an error in a cell means, in one or two plain sentences (for its tooltip). */
export function explainError(err: CellError, locale: Locale): string {
  const de = locale === "de";
  const detail = err.detail ?? "";
  const [key, arg = ""] = (() => {
    const i = detail.indexOf(":");
    return i < 0 ? [detail, ""] : [detail.slice(0, i), detail.slice(i + 1)];
  })();
  switch (err.error) {
    case "#DIV/0!":
      return de ? "Division durch null: Der Teiler ist 0 oder eine leere Zelle." : "Division by zero: the divisor is 0 or an empty cell.";
    case "#N/A":
      if (key === "not-found") return de ? "Der gesuchte Wert kommt im Suchbereich nicht vor." : "The value you're looking for isn't in the lookup range.";
      if (key === "no-match") return de ? "Keine der Bedingungen trifft zu." : "None of the conditions is true.";
      if (key === "unit") return de ? `Die Einheit ${q(locale, arg)} kenne ich nicht, oder die Einheiten passen nicht zusammen.` : `The unit ${q(locale, arg)} is unknown, or the units don't belong together.`;
      return de ? "Kein Wert verfügbar (#NV)." : "No value is available (#N/A).";
    case "#NAME?":
      if (key === "unknown-function") return de ? `Die Funktion ${q(locale, arg)} gibt es nicht.` : `There is no function called ${q(locale, arg)}.`;
      if (key === "unknown-name") return de ? `${q(locale, arg)} ist kein bekannter Name. Text gehört in Anführungszeichen.` : `${q(locale, arg)} isn't a known name. Put text in quotation marks.`;
      return de ? "Die Formel enthält einen Fehler." : "The formula has a mistake in it.";
    case "#NULL!":
      return de ? "Die Bereiche überschneiden sich nicht." : "The ranges don't intersect.";
    case "#NUM!":
      return de
        ? "Ungültige Zahl: Das Ergebnis ist zu groß, zu klein oder nicht definiert (z. B. die Wurzel einer negativen Zahl)."
        : "Invalid number: the result is too large, too small or undefined (for example the square root of a negative number).";
    case "#REF!":
      if (key === "sheet-missing") return de ? `Das Blatt ${q(locale, arg)} gibt es nicht (mehr).` : `The sheet ${q(locale, arg)} doesn't exist (any more).`;
      if (key === "index") return de ? "Die Zeile oder Spalte liegt außerhalb des Bereichs." : "The row or column is outside the range.";
      if (key === "sizes") return de ? "Die Bereiche sind unterschiedlich groß." : "The ranges have different sizes.";
      return de ? "Der Bezug zeigt auf Zellen, die gelöscht wurden." : "The reference points at cells that were deleted.";
    case "#VALUE!":
      if (key === "not-a-number") return de ? "Hier wird mit einem Text gerechnet, der keine Zahl ist." : "This calculates with text that isn't a number.";
      if (key === "args") return de ? `Falsche Anzahl an Argumenten für ${localName(arg, locale)}.` : `Wrong number of arguments for ${localName(arg, locale)}.`;
      if (key === "too-long") return de ? "Der Text ist zu lang (höchstens 32.767 Zeichen)." : "The text is too long (32,767 characters at most).";
      if (key === "internal") return de ? "Diese Formel konnte nicht berechnet werden." : "This formula couldn't be calculated.";
      if (key === "not-found") return de ? "Der gesuchte Text kommt nicht vor." : "The text you're looking for isn't there.";
      return de ? "Ein Wert hat den falschen Typ für diese Rechnung oder Funktion." : "A value has the wrong type for this calculation or function.";
    case "#CALC!":
      return de ? "Diese Berechnung ist nicht möglich." : "This calculation isn't possible.";
    case "#CIRC!":
      return de ? "Zirkelbezug: Die Formel bezieht sich (auch über Umwege) auf ihre eigene Zelle." : "Circular reference: the formula refers (perhaps indirectly) to its own cell.";
  }
  return "";
}
