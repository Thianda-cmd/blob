// Words students type when they look for a function, in German and English, and the functions they
// mean: everyday words ("Durchschnitt", "Schnitt"), lab words ("Kalibriergerade", "Bestimmtheitsmaß")
// and the ways R² is typed without the ² key ("R2", "R^2", "R-Quadrat"). The function browser ranks
// these right after the functions' own names.

import { FUNCTION_BY_EN } from "@/sheet/engine";

/** The words, and the functions they mean, the most likely first (English names). */
const WORDS: [words: string[], functions: string[]][] = [
  [["Durchschnitt", "Durchschnittswert", "Schnitt", "Mittel", "Ø", "average", "mean", "avg"], ["AVERAGE", "AVERAGEIF", "MEDIAN"]],
  [["Median", "Zentralwert"], ["MEDIAN"]],
  [["R²", "R-Quadrat", "Bestimmtheitsmaß", "Bestimmtheit", "R squared", "coefficient of determination"], ["RSQ"]],
  [["Standardabweichung", "Stdabw", "Abweichung", "Streuung", "SD", "std", "standard deviation"], ["STDEV.S", "STDEV.P"]],
  [["Varianz", "variance"], ["VAR.S", "VAR.P"]],
  [
    ["Kalibrierung", "Kalibriergerade", "Kalibrierkurve", "Eichgerade", "Eichkurve", "Ausgleichsgerade", "Regressionsgerade", "lineare Regression", "Trendlinie", "calibration", "linear regression", "line of best fit", "trendline"],
    ["SLOPE", "INTERCEPT", "RSQ", "FORECAST.LINEAR", "LINEST", "STEYX"],
  ],
  [["Steigung", "Anstieg", "Gradient", "slope"], ["SLOPE"]],
  [["Achsenabschnitt", "y-Achsenabschnitt", "Schnittpunkt", "Nullpunkt", "intercept", "y-intercept"], ["INTERCEPT"]],
  [["Konzentration", "zurückrechnen", "Vorhersage", "interpolieren", "concentration", "predict", "interpolate"], ["FORECAST.LINEAR", "TREND"]],
  [["Korrelation", "Zusammenhang", "correlation"], ["CORREL", "PEARSON", "RSQ"]],
  [["Anzahl", "zählen", "wie viele", "count", "how many"], ["COUNT", "COUNTA", "COUNTIF"]],
  [["Summe", "addieren", "zusammenrechnen", "zusammenzählen", "plus", "add", "total"], ["SUM", "SUMIF"]],
  [["kleinste", "kleinster", "Minimum", "smallest", "lowest"], ["MIN", "SMALL"]],
  [["größte", "größter", "Maximum", "largest", "highest"], ["MAX", "LARGE"]],
  [["Wurzel", "Quadratwurzel", "square root", "root"], ["SQRT"]],
  [["hoch", "Potenz", "Quadrat", "squared", "power", "exponent"], ["POWER", "EXP"]],
  [["Logarithmus", "lg", "logarithm"], ["LOG10", "LN", "LOG"]],
  [["Betrag", "absolut", "absolute"], ["ABS"]],
  [["Rest", "Modulo", "remainder"], ["MOD"]],
  [["t-Test", "Signifikanz", "signifikant", "p-Wert", "significance", "p-value"], ["T.TEST"]],
  [["Konfidenzintervall", "Vertrauensintervall", "Konfidenz", "confidence interval", "confidence"], ["CONFIDENCE.T", "CONFIDENCE.NORM"]],
  [["Fehler abfangen", "Fehler", "error"], ["IFERROR", "IFNA", "ISERROR"]],
  [["nachschlagen", "Wert suchen", "lookup", "look up"], ["XLOOKUP", "VLOOKUP", "MATCH"]],
  [["verbinden", "zusammenfügen", "join", "combine"], ["TEXTJOIN", "CONCAT"]],
  [["Zufall", "random"], ["RAND", "RANDBETWEEN"]],
  [["Einheit", "umrechnen", "unit", "convert units"], ["CONVERT"]],
];

/** Lower case, umlauts as plain vowels, ß as ss: "Zählen" and "zahlen" are the same search. */
export const foldSearch = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");

/** Only letters and digits ("R^2", "R²", "r 2" → "r2"; "y-Achsenabschnitt" → "yachsenabschnitt"). */
export const squeeze = (s: string) => foldSearch(s).replace(/²/g, "2").replace(/[^a-z0-9ø]/g, "");

/** Each word, squeezed, with the functions it means (only those the engine has). */
const INDEX: { word: string; functions: string[] }[] = WORDS.flatMap(([words, functions]) => {
  const known = functions.filter((f) => FUNCTION_BY_EN.has(f));
  return words.map((w) => ({ word: squeeze(w), functions: known }));
});

/**
 * What may follow a word for the search to still mean it: an ending ("Durchschnitte",
 * "Kalibrierungen", "averages"), not a word of its own ("Fehlerbalken", "Schnittpunkt").
 */
const ENDING = /^(?:e|n|s|en|er|es|em|ern|ens)$/;

/**
 * The functions a search means through these words: per function (English name) how well — 0 the
 * word typed exactly, 1 the start of a word, or the word with an ending ("Kalibrier",
 * "Durchschnitte") — and its place among that word's functions. Starts and endings count from
 * four letters, so "r" or "sd" only find their own word.
 */
export function functionsForWords(query: string): Map<string, { exact: boolean; rank: number }> {
  const q = squeeze(query);
  const out = new Map<string, { exact: boolean; rank: number }>();
  if (!q) return out;
  for (const { word, functions } of INDEX) {
    const exact = word === q;
    const partial = !exact && Math.min(q.length, word.length) >= 4 && (word.startsWith(q) || (q.startsWith(word) && ENDING.test(q.slice(word.length))));
    if (!exact && !partial) continue;
    functions.forEach((en, rank) => {
      const old = out.get(en);
      if (!old || (exact && !old.exact) || (exact === old.exact && rank < old.rank)) out.set(en, { exact, rank });
    });
  }
  return out;
}
