// Words for what went wrong: why a typed formula doesn't parse ("Hier fehlt eine schließende
// Klammer"), and what an error value in a cell means (for the tooltip on #WERT!, #BEZUG!…).

import type { Locale } from "@/i18n/config";
import { EXCEL_FUNCTIONS } from "./excelNames";
import { FUNCTION_BY_DE, FUNCTION_BY_EN, FUNCTION_NAMES, type FunctionName } from "./names";
import type { ParseError } from "./parser";
import type { CellError } from "./values";

/** A function's name in the user's language (SUMME / SUM). */
export function localName(canonical: string, locale: Locale): string {
  const f = FUNCTION_BY_EN.get(canonical);
  return f ? (locale === "de" ? f.de : f.en) : canonical;
}

/** A name with its umlauts spelled out: ZÄHLENWENN and ZAEHLENWENN are one. */
const spelled = (name: string) => name.replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS");
/** …and without dots (the keys of MEANT and NOT_YET). */
const plain = (name: string) => spelled(name).replace(/\./g, "");

/** Is the typed name this name with some of its dots left out (STABWS for STABW.S)? Both spelled out. */
function dotsLeftOut(typed: string, name: string): boolean {
  let j = 0;
  for (let i = 0; i < typed.length; i++, j++) {
    while (name[j] === "." && typed[i] !== ".") j++;
    if (name[j] !== typed[i]) return false;
  }
  while (name[j] === ".") j++;
  return j === name.length;
}

/**
 * How far apart two names are: letters added, dropped, swapped with the next one or changed, 64
 * for each, plus 1 for each one changed. So on the same number of steps a slip of the fingers wins
 * over a changed letter: QUARTIL is QUARTILE, not QUANTIL. (`cost % 64`: the letters changed.)
 */
function cost(a: string, b: string): number {
  const n = b.length;
  // Rows i − 2, i − 1 and i of the table (optimal string alignment).
  let before: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j * 64);
  for (let i = 1; i <= a.length; i++) {
    const row = [i * 64];
    for (let j = 1; j <= n; j++) {
      let c = Math.min(prev[j] + 64, row[j - 1] + 64, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 65));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c = Math.min(c, before[j - 2] + 64);
      row.push(c);
    }
    before = prev;
    prev = row;
  }
  return prev[n];
}

/**
 * Is the closest name (both upper case, umlauts spelled out; `c` their cost) a slip of the fingers,
 * not another function? At most 1 step apart for short names, 2 for longer ones, with at most one
 * letter changed. The first letter stays (or swaps with the second): VARIANZ isn't KOVARIANZ, UNDEN
 * isn't UND. The digits stay: LOG2 isn't LOG, T.VERT.1S isn't T.VERT.2S. And so do the parts between
 * the dots, but for letters left out, doubled or swapped: in a part of 4 letters or fewer no letter
 * may change, as those tell the variants apart (.S .N .P, .RE .2S, INKL EXKL, T. F.).
 */
function isSlip(typed: string, name: string, c: number): boolean {
  if (Math.floor(c / 64) > (typed.length <= 4 ? 1 : 2) || c % 64 > 1) return false;
  if (typed[0] !== name[0] && !(typed[0] === name[1] && typed[1] === name[0])) return false;
  if (typed.replace(/\D/g, "") !== name.replace(/\D/g, "")) return false;
  const a = typed.split(".");
  const b = name.split(".");
  if (a.length !== b.length || a.includes("")) return false;
  return a.every((part, i) => Math.min(part.length, b[i].length) > 4 || cost(part, b[i]) % 64 === 0);
}

/** Is the typed name this name with one letter dropped, one typed twice or two next to each other swapped? Both spelled out. */
function oneSlip(typed: string, name: string): boolean {
  const d = typed.length - name.length;
  for (let i = 0; i < name.length; i++) {
    if (d === -1 && name.slice(0, i) + name.slice(i + 1) === typed) return true;
    if (d === 1 && name.slice(0, i) + name[i] + name.slice(i) === typed) return true;
    if (d === 0 && i + 1 < name.length && name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2) === typed) return true;
  }
  return false;
}

/** The same function, or one an older name of the other (STABW and STABW.S calculate alike). */
const alike = (a: FunctionName, b: FunctionName) => a === b || (a.newer?.length === 1 && a.newer[0] === b.en) || (b.newer?.length === 1 && b.newer[0] === a.en);

/**
 * Words often typed for a function that aren't its name in either language, and the function
 * meant (the same maths), where spelling alone would guess wrong or not at all: MODUS isn't REST,
 * VAR.N (like STABW.N) is the population's VAR.P, not VAR.S, and QUARTIL is QUARTILE, not QUANTIL.
 */
const MEANT = new Map(
  Object.entries({
    MODUS: "MODE.SNGL",
    MITTEL: "AVERAGE",
    MITTE: "AVERAGE",
    DURCHSCHNITT: "AVERAGE",
    AVG: "AVERAGE",
    MEAN: "AVERAGE",
    // The plural, which is also the start of SUMMENPRODUKT.
    SUMMEN: "SUM",
    // The words a student knows from the lesson (the function browser finds them too, functionWords.ts).
    STANDARDABWEICHUNG: "STDEV.S",
    RQUADRAT: "RSQ",
    ZÄHLEN: "COUNT",
    ANZAHLWENN: "COUNTIF",
    QUARTIL: "QUARTILE.INC",
    "QUARTIL.INKL": "QUARTILE.INC",
    "QUARTIL.EXKL": "QUARTILE.EXC",
    "VAR.N": "VAR.P",
    "VARIANZ.N": "VAR.P",
    "VARIANZ.P": "VAR.P",
    "VARIANZ.S": "VAR.S",
    "STABW.P": "STDEV.P",
    "STDEV.N": "STDEV.P",
    "KOVARIANZ.N": "COVARIANCE.P",
    "COVARIANCE.N": "COVARIANCE.P",
    "KONFIDENZ.N": "CONFIDENCE.NORM",
    "CONFIDENCE.N": "CONFIDENCE.NORM",
    // One-tailed, as T.VERT.2S is two-tailed: the right tail, like TVERT with Seiten 1.
    "T.VERT.1S": "T.DIST.RT",
    "T.DIST.1T": "T.DIST.RT",
  }).map(([typed, fn]) => [plain(typed), fn]),
);

/**
 * Excel functions Blob doesn't have yet: every name of Excel's (excelNames.ts) that isn't Blob's.
 * Typed, they are named as such, without a guess by spelling: the nearest name would calculate
 * something else (BINOM.VERT is not T.VERT, ISTKTEXT is the opposite of ISTTEXT, PHI isn't PI).
 * Compared without dots and umlauts, as they may be typed (BINOMVERT, ROEMISCH), but never where
 * that is how one of Blob's names may be typed too (TTEST).
 */
const NOT_YET = (() => {
  const blob = new Set(FUNCTION_NAMES.flatMap((f) => [plain(f.en), plain(f.de)]));
  return new Set(EXCEL_FUNCTIONS.flatMap((f) => [plain(f.en), plain(f.de)]).filter((name) => !blob.has(name)));
})();

/** Is this an Excel function Blob doesn't have yet (BINOM.VERT, EINDEUTIG…)? */
export const notYetInBlob = (typed: string) => NOT_YET.has(plain(typed.toUpperCase()));

/**
 * The names in NOT_YET as each language writes them (with their dots, umlauts spelled out). A guess
 * by spelling weighs them like Blob's names and never lands on one: DATWER is DATWERT begun, not
 * DATUM, and GGANZZHL is GGANZZAHL mistyped, not GANZZAHL.
 */
const NOT_YET_NAMES = {
  de: EXCEL_FUNCTIONS.map((f) => spelled(f.de)).filter((name) => NOT_YET.has(plain(name))),
  en: EXCEL_FUNCTIONS.map((f) => spelled(f.en)).filter((name) => NOT_YET.has(plain(name))),
};

/**
 * The function a name typed only in part begins (MITTELW, SUMMEW): undefined when no name in the
 * user's language goes on from it (German: then no English one either), null when several do and
 * none of them is the one to name. That is the only one; or the shortest when all the others go on
 * from it (MITTELWERT for MITTELWERTA and …WENN, SUMMEWENN for SUMMEWENNS), unless it is an older
 * name: KONF can be KONFIDENZ.T or KONFIDENZ.NORM, STAB STABW.S or STABW.N. Excel's functions Blob
 * lacks count as names here too, but are never the one: PROGN can be PROGNOSE.ETS, ARCCO ARCCOT.
 * Never a function the typed text isn't the beginning of: MITTELW isn't MITTELABW, SUMMEW isn't
 * SUMME. `typed` with its umlauts spelled out.
 */
function completion(typed: string, locale: Locale): FunctionName | null | undefined {
  for (const lang of locale === "de" ? (["de", "en"] as const) : (["en"] as const)) {
    const name = (f: FunctionName) => spelled(lang === "de" ? f.de : f.en);
    const goesOn = (n: string) => n.length > typed.length && n.startsWith(typed);
    const found = FUNCTION_NAMES.filter((f) => goesOn(name(f)));
    const lacking = NOT_YET_NAMES[lang].filter(goesOn);
    if (!found.length && !lacking.length) continue;
    if (!found.length) return null;
    const [shortest, ...rest] = [...found].sort((a, b) => name(a).length - name(b).length);
    if (!rest.length && !lacking.length) return shortest;
    return !shortest.newer && [...rest.map(name), ...lacking].every((n) => n.startsWith(name(shortest))) ? shortest : null;
  }
  return undefined;
}

/**
 * The function a mistyped or foreign name stands for ("SUMM" → "SUMME", "STABWS" → "STABW.S",
 * SUMME typed in English → "SUM"), or null. Only suggests a function with the same maths: the
 * same name in the other language or without its dots or umlauts, a known synonym, the function
 * a name typed only in part begins (see completion), or else the closest spelling, when that is
 * one function only and a slip of the fingers (see isSlip). Excel's functions Blob lacks count as
 * names in all of this, and are never the guess.
 */
export function suggestFunction(typed: string, locale: Locale): string | null {
  const up = typed.toUpperCase();
  const shown = (f: FunctionName) => (locale === "de" ? f.de : f.en);
  const exact = FUNCTION_BY_EN.get(up) ?? FUNCTION_BY_DE.get(up);
  if (exact) return shown(exact);
  // Dots left out can make two names one (T.VERT and TVERT): a guess only when they calculate
  // alike (STABW.N and its older name STABWN), then the newer one.
  const typedSpelled = spelled(up);
  const same = FUNCTION_NAMES.filter((f) => dotsLeftOut(typedSpelled, spelled(f.de)) || dotsLeftOut(typedSpelled, spelled(f.en)));
  if (same.length) {
    const now = same.filter((f) => !f.newer);
    return same.length === 1 ? shown(same[0]) : now.length === 1 && same.every((f) => alike(f, now[0])) ? shown(now[0]) : null;
  }
  // A word, not one cut short at its dot: QUARTIL. can be QUARTIL.INKL or QUARTIL.EXKL.
  const meant = up.endsWith(".") ? undefined : MEANT.get(plain(up));
  if (meant) {
    const f = FUNCTION_BY_EN.get(meant);
    if (f) return shown(f);
  }
  if (notYetInBlob(up) || up.length < 3) return null;
  // The names a German types in are German and English ones.
  const langs = locale === "de" ? (["de", "en"] as const) : (["en"] as const);
  const names = (f: FunctionName) => langs.map((lang) => (lang === "de" ? f.de : f.en));
  const notYet = langs.flatMap((lang) => NOT_YET_NAMES[lang]);
  // A name typed only in part, unless it is just as well a slip of the fingers on another
  // function's name: ROUNDD is ROUND with its D typed twice or the start of ROUNDDOWN, IND is FIND
  // without its F or the start of INDEX. Two readings, no guess.
  const begun = completion(typedSpelled, locale);
  if (begun !== undefined) {
    const slipOfAnother =
      !!begun && (FUNCTION_NAMES.some((f) => !alike(f, begun) && names(f).some((n) => oneSlip(typedSpelled, spelled(n)))) || notYet.some((n) => oneSlip(typedSpelled, n)));
    return begun && !slipOfAnother ? shown(begun) : null;
  }
  // The closest spelling, of Blob's names and of Excel's that Blob lacks (`f` null).
  let best = Infinity;
  let closest: { f: FunctionName | null; name: string; c: number }[] = [];
  const weigh = (f: FunctionName | null, s: string, own: boolean) => {
    // Each letter more or less costs 64: a name that much longer or shorter can't come closer.
    if (Math.abs(s.length - typedSpelled.length) * 64 > best) return;
    const c = cost(typedSpelled, s);
    // On a tie a name in the user's language goes first.
    const score = own ? c : c + 0.5;
    if (score < best) {
      best = score;
      closest = [{ f, name: s, c }];
    } else if (score === best) closest.push({ f, name: s, c });
  };
  for (const f of FUNCTION_NAMES) for (const name of names(f)) weigh(f, spelled(name), name === shown(f));
  // One of those as close as Blob's, in either language, can be meant just as well (COHS: COS or COSH).
  for (const name of notYet) weigh(null, name, true);
  // Two functions just as close is no slip to guess (SUMMEWENSN: SUMMEWENN or SUMMEWENNS?); nor is
  // the closest when it is another function (see isSlip), however close, or one Blob lacks.
  if (new Set(closest.map((x) => x.f)).size !== 1) return null;
  const { f, name, c } = closest[0];
  return f && isSlip(typedSpelled, name, c) ? shown(f) : null;
}

const q = (locale: Locale, s: string) => (locale === "de" ? `„${s}“` : `"${s}"`);

/** A typed formula longer than a cell takes. */
export function formulaTooLongMessage(locale: Locale): string {
  return locale === "de"
    ? "Die Formel ist zu lang: höchstens 8.192 Zeichen, wie in Excel. Verteil die Rechnung auf mehrere Zellen."
    : "The formula is too long: 8,192 characters at most, as in Excel. Spread the calculation over several cells.";
}

/**
 * German "1.234" read as 1234 (the dot separates thousands): the note after typing it, and the
 * label of the button that stores 1,234 instead. `read` is the reading as the cell shows it
 * ("1234 mg/L"), `decimal` the typed text with a comma ("1,234 mg/L").
 */
export function thousandsNotice(typed: string, read: string, decimal: string, locale: Locale): { message: string; action: string } {
  if (locale === "de") return { message: `${q(locale, typed)} ist ${read}: Der Punkt trennt Tausender. Für ${decimal} tipp ein Komma.`, action: `Als ${decimal} lesen` };
  return { message: `${q(locale, typed)} is ${read}: the point separates thousands. For ${decimal}, type a comma.`, action: `Read as ${decimal}` };
}

/**
 * A ratio typed as "1:2" read as a time (the colon separates hours and minutes): the note after
 * typing it, and the label of the button that keeps it as text instead. `shown` is the time as the
 * cell shows it ("01:02"); `duration`: 24 hours or more ("50:01" is a duration, not a time of day).
 */
export function colonNotice(typed: string, shown: string, duration: boolean, locale: Locale): { message: string; action: string } {
  if (locale === "de") return { message: `${q(locale, typed)} ist jetzt die ${duration ? "Dauer" : "Uhrzeit"} ${shown}. Für ein Verhältnis tipp '${typed} (mit Apostroph davor).`, action: `Als Text ${q(locale, typed)}` };
  return { message: `${q(locale, typed)} is now the ${duration ? "duration" : "time"} ${shown}. For a ratio, type '${typed} (with an apostrophe in front).`, action: `As text ${q(locale, typed)}` };
}

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
      const name = text.toUpperCase();
      if (notYetInBlob(name)) return de ? `Die Funktion ${q(locale, name)} gibt es in Blob noch nicht.` : `Blob doesn't have the function ${q(locale, name)} yet.`;
      const s = suggestFunction(text, locale);
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
    case "ambiguous-comma": {
      // `text` is the formula with every comma a ";", when that fits the function; otherwise
      // (=WENN(A1>0,5,1,0): 0,5 or 0 and 5?) only the person typing knows which commas separate.
      const why = de
        ? "Komma oder Semikolon? In deutschen Formeln trennt ; die Argumente, und das Komma gehört in Dezimalzahlen (0,5)."
        : "Comma or semicolon? In German formulas ; separates the arguments, and the comma belongs in decimal numbers (0,5).";
      if (text) return de ? `${why} Meintest du ${text}?` : `${why} Did you mean ${text}?`;
      if (fnName) return de ? `${why} Trenn die Argumente von ${fnName} mit ;.` : `${why} Separate the arguments of ${fnName} with ;.`;
      return de ? `${why} Trenn die Argumente mit ;.` : `${why} Separate the arguments with ;.`;
    }
    case "decimal-comma": {
      // =REST(10,3): the number 10,3 and one argument short, or two arguments with a comma between
      // (`e.meant`: the formula with ";", when the function takes that many).
      const missing = e.count ?? 1;
      const read = de
        ? `${q(locale, text)} ist hier eine Zahl mit Dezimalkomma, dann ${missing === 1 ? `fehlt ${fnName} noch ein Argument` : `fehlen ${fnName} noch ${missing} Argumente`}.`
        : `${q(locale, text)} is a number with a decimal comma here, so ${fnName} is still ${missing === 1 ? "an argument" : `${missing} arguments`} short.`;
      if (e.meant) return de ? `${read} Meintest du ${e.meant}?` : `${read} Did you mean ${e.meant}?`;
      return de ? `${read} In deutschen Formeln trennt ; die Argumente.` : `${read} In German formulas ; separates the arguments.`;
    }
    case "too-many-args":
      return de
        ? `${fnName} hat höchstens ${e.count} ${e.count === 1 ? "Argument" : "Argumente"}.`
        : `${fnName} takes at most ${e.count} ${e.count === 1 ? "argument" : "arguments"}.`;
  }
  return de ? "Diese Formel verstehe ich nicht." : "I don't understand this formula.";
}

/** A number for a message: whole numbers in full (12.345), others to 4 significant digits (0,1111), in the user's style. */
const shortNumber = (x: number, locale: Locale) =>
  x.toLocaleString(locale === "de" ? "de-DE" : "en-US", Number.isInteger(x) ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: 4 });

/**
 * The argument names (as in the help, docs.ts) of the functions whose errors name an argument:
 * "Bei NORM.VERT muss „Standabwn“ größer als 0 sein". Here and not taken from docs.ts, which is
 * big and only the editor needs; check-sheet compares the two.
 */
const ARG_NAMES = new Map<string, [en: string[], de: string[]]>(
  (
    [
      ["PERCENTILE.INC PERCENTILE PERCENTILE.EXC LARGE SMALL", "array|k", "Matrix|k"],
      ["QUARTILE.INC QUARTILE QUARTILE.EXC", "array|quart", "Matrix|Quartile"],
      ["T.TEST TTEST", "array1|array2|tails|type", "Matrix1|Matrix2|Seiten|Typ"],
      ["CONFIDENCE.NORM CONFIDENCE CONFIDENCE.T", "alpha|standard_dev|size", "Alpha|Standabwn|Umfang"],
      ["F.DIST", "x|deg_freedom1|deg_freedom2|cumulative", "x|Freiheitsgrade1|Freiheitsgrade2|Kumuliert"],
      ["F.DIST.RT FDIST", "x|deg_freedom1|deg_freedom2", "x|Freiheitsgrade1|Freiheitsgrade2"],
      ["F.INV F.INV.RT FINV", "probability|deg_freedom1|deg_freedom2", "Wahrsch|Freiheitsgrade1|Freiheitsgrade2"],
      ["CHISQ.DIST T.DIST", "x|deg_freedom|cumulative", "x|Freiheitsgrade|Kumuliert"],
      ["CHISQ.DIST.RT CHIDIST T.DIST.2T T.DIST.RT", "x|deg_freedom", "x|Freiheitsgrade"],
      ["CHISQ.INV CHISQ.INV.RT CHIINV T.INV T.INV.2T TINV", "probability|deg_freedom", "Wahrsch|Freiheitsgrade"],
      ["TDIST", "x|deg_freedom|tails", "x|Freiheitsgrade|Seiten"],
      ["GEOMEAN HARMEAN", "number1|number2", "Zahl1|Zahl2"],
      ["STANDARDIZE", "x|mean|standard_dev", "x|Mittelwert|Standabwn"],
      ["NORM.DIST NORMDIST", "x|mean|standard_dev|cumulative", "x|Mittelwert|Standabwn|Kumuliert"],
      ["NORM.INV NORMINV", "probability|mean|standard_dev", "Wahrsch|Mittelwert|Standabwn"],
      ["NORM.S.INV NORMSINV", "probability", "Wahrsch"],
      ["CHISQ.TEST CHITEST", "actual_range|expected_range", "Beob_Messwerte|Erwart_Werte"],
      ["GROWTH", "known_y's|known_x's|new_x's|const", "Y_Werte|X_Werte|Neue_x_Werte|Konstante"],
      ["LOGEST", "known_y's|known_x's|const|stats", "Y_Werte|X_Werte|Konstante|Stats"],
    ] as const
  ).flatMap(([fns, en, de]) => fns.split(" ").map((fn): [string, [string[], string[]]] => [fn, [en.split("|"), de.split("|")]])),
);

/** The choices of the arguments that only take a few numbers ("opt"), as their help describes them. */
const ARG_OPTIONS: Record<string, [en: string, de: string]> = {
  "T.TEST:3": ["1: one-tailed; 2: two-tailed (usual).", "1: einseitig; 2: zweiseitig (üblich)."],
  "T.TEST:4": ["1: paired; 2: two samples, equal variance; 3: two samples, unequal variance (Welch).", "1: gepaart; 2: zwei Stichproben, gleiche Varianz; 3: zwei Stichproben, ungleiche Varianz (Welch)."],
  "TTEST:3": ["1: one-tailed; 2: two-tailed (usual).", "1: einseitig; 2: zweiseitig (üblich)."],
  "TTEST:4": ["1: paired; 2: two samples, equal variance; 3: two samples, unequal variance (Welch).", "1: gepaart; 2: zwei Stichproben, gleiche Varianz; 3: zwei Stichproben, ungleiche Varianz (Welch)."],
  "TDIST:3": ["1: one-tailed; 2: two-tailed.", "1: einseitig; 2: zweiseitig."],
};

/**
 * Why a function gave its error, from the detail the function set (`why` in functions/util.ts):
 * "few:STDEV.S:2:1", "same:CORREL", "arg:NORM.DIST:3:gt0"… "" when the detail says nothing of that kind.
 */
function explainWhy(detail: string, locale: Locale): string {
  const de = locale === "de";
  const [kind, fn = "", ...rest] = detail.split(":");
  const name = localName(fn, locale);
  switch (kind) {
    case "few": {
      const need = Number(rest[0]);
      const have = Number(rest[1]);
      const counts = rest[2];
      if (counts === "each") {
        return de
          ? `${name} braucht in jeder Gruppe mindestens ${need} Zahlen – in einer ${have === 1 ? "ist es nur eine" : have === 0 ? "ist keine" : `sind es nur ${have}`}. Leere Zellen und Text zählen nicht.`
          : `${name} needs at least ${need} numbers in each group – one has ${have === 1 ? "only one" : have === 0 ? "none" : `only ${have}`}. Empty cells and text don't count.`;
      }
      if (counts === "pairs") {
        // STEIGUNG, KORREL, T.TEST of pairs…: an x without its y (or the other way round) doesn't count.
        const pair = de ? "Ein Paar zählt nur, wenn in beiden Bereichen an derselben Stelle eine Zahl steht." : "A pair only counts when both ranges hold a number in the same place.";
        if (have === 0) return de ? `${name} findet kein Wertepaar. ${pair}` : `${name} finds no pair of values. ${pair}`;
        return de
          ? `${name} braucht mindestens ${need} Wertepaare – hier ${have === 1 ? "ist es nur eins" : `sind es nur ${have}`}. ${pair}`
          : `${name} needs at least ${need} pairs of values – there ${have === 1 ? "is only one" : `are only ${have}`} here. ${pair}`;
      }
      if (counts === "a") {
        // The A forms (STABWA, MITTELWERTA…) count text as 0 and WAHR as 1.
        if (have === 0) return de ? `${name} findet keinen Wert: Leere Zellen zählen nicht. Prüf den Bereich.` : `${name} finds no value: empty cells don't count. Check the range.`;
        return de
          ? `${name} braucht mindestens ${need} Werte – hier ${have === 1 ? "ist es nur einer" : `sind es nur ${have}`}. Leere Zellen zählen nicht, Text zählt als 0.`
          : `${name} needs at least ${need} values – there ${have === 1 ? "is only one" : `are only ${have}`} here. Empty cells don't count; text counts as 0.`;
      }
      if (have === 0) return de ? `${name} findet keine Zahl: Leere Zellen und Text zählen nicht. Prüf den Bereich.` : `${name} finds no number: empty cells and text don't count. Check the range.`;
      return de
        ? `${name} braucht mindestens ${need} Zahlen – hier ${have === 1 ? "ist es nur eine" : `sind es nur ${have}`}. Leere Zellen und Text zählen nicht.`
        : `${name} needs at least ${need} numbers – there ${have === 1 ? "is only one" : `are only ${have}`} here. Empty cells and text don't count.`;
    }
    case "same":
      return de
        ? `${name} kann nicht rechnen, weil die Werte alle gleich sind (bei Wertepaaren: alle x- oder alle y-Werte). Ohne Streuung gibt es kein Ergebnis.`
        : `${name} can't calculate because the values are all the same (for pairs: all x or all y values). Without any spread there is no result.`;
    case "nomatch":
      return de ? `Keine Zelle erfüllt die Bedingung, darum hat ${name} nichts zu mitteln.` : `No cell meets the condition, so ${name} has nothing to average.`;
    case "norepeat":
      return de ? `Keine Zahl kommt mehr als einmal vor, darum hat ${name} keinen häufigsten Wert.` : `No number occurs more than once, so ${name} has no most frequent value.`;
    case "sizes":
      return de ? "Die Bereiche sind unterschiedlich groß." : "The ranges have different sizes.";
    case "expected-zero":
      return de ? "Ein erwarteter Wert ist 0: Durch ihn kann der Chi-Quadrat-Test nicht teilen." : "An expected count is 0: the chi-squared test can't divide by it.";
    case "arg": {
      const i = Number(rest[0]);
      const rule = rest[1];
      const argName = ARG_NAMES.get(fn)?.[de ? 1 : 0][i - 1];
      const options = ARG_OPTIONS[`${fn}:${i}`]?.[de ? 1 : 0];
      if (!argName || (rule === "opt" && !options)) return de ? `Ein Argument von ${name} liegt außerhalb dessen, was die Funktion erlaubt.` : `An argument of ${name} is outside what the function allows.`;
      const a = q(locale, argName);
      if (rule === "opt") return de ? `Bei ${name} gibt es für ${a} nur diese Möglichkeiten: ${options}` : `In ${name}, ${a} allows only these: ${options}`;
      const lo = shortNumber(Number(rest[2]), locale);
      const hi = shortNumber(Number(rest[3]), locale);
      // German: "Bei NORM.VERT muss „Standabwn“ größer als 0 sein." (the verb, then the argument, then the rest).
      const rules: Record<string, [verb: string, rest: string, en: string]> = {
        gt0: ["muss", "größer als 0 sein", "must be greater than 0"],
        ge0: ["darf", "nicht negativ sein", "can't be negative"],
        ge1: ["muss", "mindestens 1 sein", "must be at least 1"],
        ge2: ["muss", "mindestens 2 sein", "must be at least 2"],
        p: ["muss", "zwischen 0 und 1 liegen", "must be between 0 and 1"],
        pos: ["darf", "nur Zahlen größer als 0 enthalten", "may only hold numbers greater than 0"],
        num: ["darf", "nur Zahlen enthalten, keine leeren Zellen und keinen Text (für „keine“ trag 0 ein)", "may only hold numbers, no empty cells or text (for “none”, enter 0)"],
        // Expected counts: a 0 there can't be divided by, so no advice to enter one.
        posnum: ["darf", "nur Zahlen größer als 0 enthalten, keine leeren Zellen und keinen Text", "may only hold numbers greater than 0, no empty cells or text"],
        range: ["muss", `zwischen ${lo} und ${hi} liegen`, `must be between ${lo} and ${hi}`],
      };
      const r = rules[rule];
      if (!r) return "";
      return de ? `Bei ${name} ${r[0]} ${a} ${r[1]}.` : `In ${name}, ${a} ${r[2]}.`;
    }
  }
  return "";
}

/** What an error in a cell means, in one or two plain sentences (for its tooltip). */
export function explainError(err: CellError, locale: Locale): string {
  const de = locale === "de";
  const detail = err.detail ?? "";
  const why = detail && explainWhy(detail, locale);
  if (why) return why;
  const [key, arg = ""] = (() => {
    const i = detail.indexOf(":");
    return i < 0 ? [detail, ""] : [detail.slice(0, i), detail.slice(i + 1)];
  })();
  switch (err.error) {
    case "#DIV/0!":
      return de ? "Division durch null: Der Teiler ist 0 oder eine leere Zelle." : "Division by zero: the divisor is 0 or an empty cell.";
    case "#N/A":
      if (key === "not-found") return de ? "Der gesuchte Wert kommt im Suchbereich nicht vor." : "The value you're looking for isn't in the lookup range.";
      if (key === "empty-lookup") return de ? "Die Zelle mit dem Suchwert ist leer." : "The cell with the lookup value is empty.";
      if (key === "no-match") return de ? "Keine der Bedingungen trifft zu." : "None of the conditions is true.";
      if (key === "unit") return de ? `Die Einheit ${q(locale, arg)} kenne ich nicht, oder die Einheiten passen nicht zusammen.` : `The unit ${q(locale, arg)} is unknown, or the units don't belong together.`;
      return de ? "Kein Wert verfügbar (#NV)." : "No value is available (#N/A).";
    case "#NAME?":
      if (key === "unknown-function" && notYetInBlob(arg)) return de ? `Die Funktion ${q(locale, arg)} gibt es in Blob noch nicht.` : `Blob doesn't have the function ${q(locale, arg)} yet.`;
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
      if (key === "pattern-too-long") return de ? "Das Suchmuster ist zu lang: höchstens 255 Zeichen, wie in Excel." : "The search pattern is too long: 255 characters at most, as in Excel.";
      return de ? "Ein Wert hat den falschen Typ für diese Rechnung oder Funktion." : "A value has the wrong type for this calculation or function.";
    case "#CALC!":
      return de ? "Diese Berechnung ist nicht möglich." : "This calculation isn't possible.";
    case "#CIRC!":
      return de ? "Zirkelbezug: Die Formel bezieht sich (auch über Umwege) auf ihre eigene Zelle." : "Circular reference: the formula refers (perhaps indirectly) to its own cell.";
  }
  return "";
}
