// Chemical formulas and equations: read what a student types ("Ca(OH)2", "SO4^2-",
// "CuSO4·5H2O"), count atoms, molar masses, and check whether an equation is balanced.

import { tx, type Text } from "@/i18n/text";
import { element } from "./elements";

export type Counts = Record<string, number>;
export type Species = { counts: Counts; charge: number; text: string };
export type FormulaResult = { ok: true; species: Species } | { ok: false; error: Text };

const SUBSCRIPTS: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };
const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-" };

/** Normalise typing variants: unicode sub/superscripts, "·"/"*" for hydrates, en dashes. */
function normalise(raw: string): string {
  let s = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
  // "Mg2+" is the ion Mg²⁺ (a lone element with a number and a sign), as chemists write it.
  s = s.replace(/^([A-Z][a-z]?)(\d+)([+-])$/, "$1^$2$3");
  s = s.replace(/[₀-₉]/g, (c) => SUBSCRIPTS[c]);
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPTS[c]).join(""));
  return s.replace(/[*•∙]/g, "·");
}

const add = (into: Counts, from: Counts, k = 1) => {
  for (const [el, n] of Object.entries(from)) into[el] = (into[el] ?? 0) + n * k;
};

/** Parse one formula like "Al2(SO4)3", "Fe^3+", "SO4^2-", "Na+", "CuSO4·5H2O". */
export function parseFormula(raw: string): FormulaResult {
  const s = normalise(raw);
  if (!s) return { ok: false, error: tx("Type a formula first.", "Gib zuerst eine Formel ein.") };
  let i = 0;
  let charge = 0;

  const number = () => {
    let j = i;
    while (j < s.length && /[0-9]/.test(s[j])) j++;
    const n = j > i ? Number(s.slice(i, j)) : 1;
    i = j;
    return n;
  };

  function group(close: string | null): Counts {
    const out: Counts = {};
    while (i < s.length) {
      const c = s[i];
      if (close && c === close) {
        i++;
        return out;
      }
      if (c === "(" || c === "[") {
        i++;
        const inner = group(c === "(" ? ")" : "]");
        add(out, inner, number());
        continue;
      }
      if (/[A-Z]/.test(c)) {
        let j = i + 1;
        while (j < s.length && /[a-z]/.test(s[j])) j++;
        const sym = s.slice(i, j);
        if (!element(sym)) {
          // "CO" typed as "Co" or "co": help with capitals.
          throw new FormulaError(
            /^[A-Z][a-z]$/.test(sym) && element(sym[0]) && element(sym[1].toUpperCase())
              ? tx(`"${sym}" isn't an element. Did you mean ${sym[0]}${sym[1].toUpperCase()}? Every element starts with a capital letter.`, `„${sym}“ ist kein Element. Meinst du ${sym[0]}${sym[1].toUpperCase()}? Jedes Element beginnt mit einem Großbuchstaben.`)
              : tx(`I don't know the element "${sym}".`, `Das Element „${sym}“ kenne ich nicht.`),
          );
        }
        i = j;
        out[sym] = (out[sym] ?? 0) + number();
        continue;
      }
      if (/[a-z]/.test(c)) throw new FormulaError(tx("Element symbols start with a capital letter (Na, Cl, O…).", "Elementsymbole beginnen mit einem Großbuchstaben (Na, Cl, O …)."));
      if (c === "·") {
        i++;
        const k = number();
        const rest = group(close);
        add(out, rest, k);
        return out;
      }
      if (c === "^" || c === "+" || c === "-") {
        if (close) throw new FormulaError(tx("The charge goes at the very end.", "Die Ladung steht ganz am Ende."));
        const rest = s.slice(c === "^" ? i + 1 : i);
        const m = rest.match(/^([0-9]*)([+-])$/) ?? rest.match(/^([+-])([0-9]*)$/);
        if (!m) throw new FormulaError(tx("Write charges like Na+, Ca^2+ or SO4^2-.", "Schreib Ladungen wie Na+, Ca^2+ oder SO4^2-."));
        const [n, sign] = /^[+-]$/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
        charge = (sign === "-" ? -1 : 1) * (n ? Number(n) : 1);
        i = s.length;
        return out;
      }
      throw new FormulaError(tx(`"${c}" doesn't belong in a formula.`, `„${c}“ gehört nicht in eine Formel.`));
    }
    if (close) throw new FormulaError(tx("A bracket is missing.", "Da fehlt eine Klammer."));
    return out;
  }

  try {
    if (/^[0-9]/.test(s)) {
      return { ok: false, error: tx("Just the formula, no number in front.", "Nur die Formel, ohne Zahl davor.") };
    }
    const counts = group(null);
    if (!Object.keys(counts).length) return { ok: false, error: tx("That's not a formula yet.", "Das ist noch keine Formel.") };
    return { ok: true, species: { counts, charge, text: s } };
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, error: e.text };
    throw e;
  }
}

class FormulaError extends Error {
  constructor(readonly text: Text) {
    super(typeof text === "string" ? text : text.en);
  }
}

export const sameCounts = (a: Counts, b: Counts) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? 0) === (b[k] ?? 0));
};

/** Molar mass in g/mol. */
export function molarMass(counts: Counts): number {
  return Object.entries(counts).reduce((s, [el, n]) => s + (element(el)?.mass ?? 0) * n, 0);
}

/** Display-language source for a formula: "\ce{Al2(SO4)3}". */
export const ce = (formula: string) => `\\ce{${formula}}`;

// ---------------------------------------------------------------------------
// Equations

export type Equation = { left: Species[]; right: Species[] };

/** Parse "CH4 + O2 -> CO2 + H2O" (also → and =). Coefficients in the text are ignored. */
export function parseEquation(raw: string): Equation | null {
  const [l, r] = raw.split(/->|→|=|⟶/);
  if (r === undefined) return null;
  const side = (txt: string) =>
    txt
      .split(/\s\+\s|\s\+(?=[A-Z(])/)
      .map((p) => p.trim().replace(/^[0-9]+\s*/, ""))
      .filter(Boolean)
      .map((p) => parseFormula(p));
  const left = side(l);
  const right = side(r);
  if ([...left, ...right].some((x) => !x.ok)) return null;
  return { left: left.map((x) => (x as { ok: true; species: Species }).species), right: right.map((x) => (x as { ok: true; species: Species }).species) };
}

/** Atoms (and charge) on each side for given coefficients (left species first, then right). */
export function sideCounts(eq: Equation, coefs: number[]) {
  const left: Counts = {};
  const right: Counts = {};
  let qL = 0;
  let qR = 0;
  eq.left.forEach((s, i) => {
    add(left, s.counts, coefs[i]);
    qL += s.charge * coefs[i];
  });
  eq.right.forEach((s, i) => {
    add(right, s.counts, coefs[eq.left.length + i]);
    qR += s.charge * coefs[eq.left.length + i];
  });
  return { left, right, charge: [qL, qR] as [number, number] };
}

/** Elements whose atom counts differ between the sides: [element, left, right]. */
export function unbalanced(eq: Equation, coefs: number[]): [string, number, number][] {
  const { left, right } = sideCounts(eq, coefs);
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys.filter((k) => (left[k] ?? 0) !== (right[k] ?? 0)).map((k) => [k, left[k] ?? 0, right[k] ?? 0]);
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const gcdAll = (xs: number[]) => xs.reduce((g, x) => gcd(g, x), 0);
