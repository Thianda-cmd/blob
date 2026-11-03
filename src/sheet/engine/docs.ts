// Help for every function in names.ts, in both languages: what it does, its arguments and an
// example. Used by the formula bar (autocomplete, argument hints) and the function browser (fx).
//
// CONTRACT: keyed by the canonical English name (FUNCTION_NAMES[i].en); every function has an entry.

export type FnArgDoc = {
  /** As Excel names it in that language ("Zahl1", "Suchkriterium" / "number1", "lookup_value"). */
  name: string;
  /** One short sentence. */
  desc: string;
  optional?: boolean;
  /** Can be given again and again (Zahl1; Zahl2; …). */
  repeat?: boolean;
};

export type FnDoc = {
  /** One or two plain sentences: what it gives you. */
  summary: string;
  args: FnArgDoc[];
  /** A formula in that language with "=", e.g. "=MITTELWERT(B2:B6)". */
  example: string;
  /** What the example gives, in words ("the mean of the five measurements"). */
  exampleResult: string;
  /** Optional lab tip ("Für Kalibriergeraden: …"). */
  tip?: string;
};

export const FUNCTION_DOCS: Record<string, { en: FnDoc; de: FnDoc }> = {};
