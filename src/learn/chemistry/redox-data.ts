// Redox reactions: the redox series of metals, oxidation numbers by the school rules,
// half-equations with electrons and ionic redox equations built from them.

import { tx, type Text } from "@/i18n/text";
import { element } from "./elements";
import { parseFormula } from "./formula";

// ---------------------------------------------------------------------------
// The redox series (Redoxreihe der Metalle), from base (unedel) to noble (edel).
// Standard potentials in volts, for ordering only.

export type Metal = {
  symbol: string;
  name: Text;
  /** Charge of its usual ion in school experiments. */
  charge: number;
  e0: number;
  /** The salt solution used in experiments (ion of this metal). */
  salt?: { formula: string; name: Text };
  /** Name of the ion, e.g. "copper ions" / "Kupfer-Ionen". */
  ions: Text;
};

export const SERIES: Metal[] = [
  { symbol: "K", name: tx("potassium", "Kalium"), charge: 1, e0: -2.93, ions: tx("potassium ions", "Kalium-Ionen") },
  { symbol: "Ca", name: tx("calcium", "Calcium"), charge: 2, e0: -2.87, ions: tx("calcium ions", "Calcium-Ionen") },
  { symbol: "Na", name: tx("sodium", "Natrium"), charge: 1, e0: -2.71, ions: tx("sodium ions", "Natrium-Ionen") },
  { symbol: "Mg", name: tx("magnesium", "Magnesium"), charge: 2, e0: -2.37, salt: { formula: "MgSO4", name: tx("magnesium sulfate", "Magnesiumsulfat") }, ions: tx("magnesium ions", "Magnesium-Ionen") },
  { symbol: "Al", name: tx("aluminium", "Aluminium"), charge: 3, e0: -1.66, ions: tx("aluminium ions", "Aluminium-Ionen") },
  { symbol: "Zn", name: tx("zinc", "Zink"), charge: 2, e0: -0.76, salt: { formula: "ZnSO4", name: tx("zinc sulfate", "Zinksulfat") }, ions: tx("zinc ions", "Zink-Ionen") },
  { symbol: "Fe", name: tx("iron", "Eisen"), charge: 2, e0: -0.44, salt: { formula: "FeSO4", name: tx("iron(II) sulfate", "Eisen(II)-sulfat") }, ions: tx("iron(II) ions", "Eisen(II)-Ionen") },
  { symbol: "Pb", name: tx("lead", "Blei"), charge: 2, e0: -0.13, ions: tx("lead ions", "Blei-Ionen") },
  { symbol: "Cu", name: tx("copper", "Kupfer"), charge: 2, e0: 0.34, salt: { formula: "CuSO4", name: tx("copper(II) sulfate", "Kupfer(II)-sulfat") }, ions: tx("copper(II) ions", "Kupfer(II)-Ionen") },
  { symbol: "Ag", name: tx("silver", "Silber"), charge: 1, e0: 0.8, salt: { formula: "AgNO3", name: tx("silver nitrate", "Silbernitrat") }, ions: tx("silver ions", "Silber-Ionen") },
  { symbol: "Au", name: tx("gold", "Gold"), charge: 3, e0: 1.5, ions: tx("gold ions", "Gold-Ionen") },
];

export const metal = (symbol: string) => SERIES.find((m) => m.symbol === symbol)!;

/** Metals that are safe in school experiments with salt solutions (the alkali and alkaline-earth metals react with the water itself). */
export const LAB_METALS = ["Mg", "Zn", "Fe", "Cu", "Ag"].map(metal);

/** Does a strip of metal `m` react with the ions of metal `n`? Only if m is less noble. */
export const reacts = (m: Metal, n: Metal) => m.e0 < n.e0;

const SUP: Record<string, string> = { "1": "¹", "2": "²", "3": "³", "+": "⁺", "-": "⁻" };
/** "Cu²⁺" for plain text and SVG. */
export const ionText = (symbol: string, charge: number) => `${symbol}${(Math.abs(charge) > 1 ? String(Math.abs(charge)) : "").replace(/./g, (d) => SUP[d])}${charge > 0 ? "⁺" : "⁻"}`;
/** "Cu^2+" for \ce and formula answers. */
export const ionCe = (symbol: string, charge: number) => `${symbol}${charge === 0 ? "" : `${Math.abs(charge) > 1 ? `^${Math.abs(charge)}` : ""}${charge > 0 ? "+" : "-"}`}`;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const k = (n: number) => (n === 1 ? "" : String(n));

/** A metal atom reduces the ions of a nobler metal: half-equations and the ionic equation. */
export function metalSwap(m: Metal, n: Metal) {
  const e = lcm(m.charge, n.charge);
  const a = e / m.charge;
  const b = e / n.charge;
  return {
    electrons: e,
    a,
    b,
    ox: `${m.symbol} -> ${ionCe(m.symbol, m.charge)} + ${k(m.charge)}e-`,
    red: `${ionCe(n.symbol, n.charge)} + ${k(n.charge)}e- -> ${n.symbol}`,
    total: `${k(a)}${m.symbol} + ${k(b)}${ionCe(n.symbol, n.charge)} -> ${k(a)}${ionCe(m.symbol, m.charge)} + ${k(b)}${n.symbol}`,
  };
}

// ---------------------------------------------------------------------------
// Oxidation numbers by the school rules

const PEROXIDES = new Set(["H2O2", "Na2O2", "BaO2"]);
const METAL_CATS = new Set(["alkali", "alkaline-earth", "transition", "post-transition"]);

export type OxResult = { values: Record<string, number>; counts: Record<string, number>; charge: number; known: string[]; unknown?: string };

/**
 * Oxidation numbers of every element in a formula ("H2SO4", "SO4^2-", "Fe^3+", "O2").
 * Known first: elements 0, single ions = charge, F −1, alkali +1, alkaline-earth +2, Al +3,
 * H +1 (−1 in metal hydrides), O −2 (−1 in peroxides, not fixed next to F), halogens −1
 * without O or F. The one element left over is worked out from the sum. Null if that's not unique.
 */
export function oxidationNumbers(formula: string): OxResult | null {
  const f = parseFormula(formula);
  if (!f.ok) return null;
  const { counts, charge } = f.species;
  const els = Object.keys(counts);
  const values: Record<string, number> = {};
  if (els.length === 1) {
    const v = charge / counts[els[0]];
    if (!Number.isInteger(v)) return null;
    return { values: { [els[0]]: v }, counts, charge, known: [] };
  }
  const has = (el: string) => el in counts;
  const isMetal = (el: string) => METAL_CATS.has(element(el)?.category ?? "");
  const hydride = has("H") && els.every((el) => el === "H" || isMetal(el));
  for (const el of els) {
    const e = element(el);
    if (!e) return null;
    if (el === "F") values[el] = -1;
    else if (e.category === "alkali") values[el] = 1;
    else if (e.category === "alkaline-earth") values[el] = 2;
    else if (el === "Al") values[el] = 3;
    else if (el === "H") values[el] = hydride ? -1 : 1;
    else if (el === "O" && !has("F")) values[el] = PEROXIDES.has(formula) ? -1 : -2;
    else if (["Cl", "Br", "I"].includes(el) && !has("O") && !has("F")) values[el] = -1;
  }
  const unknown = els.filter((el) => !(el in values));
  if (unknown.length > 1) return null;
  const known = els.filter((el) => el in values);
  if (unknown.length === 1) {
    const u = unknown[0];
    const rest = known.reduce((s, el) => s + values[el] * counts[el], 0);
    const v = (charge - rest) / counts[u];
    if (!Number.isInteger(v)) return null;
    values[u] = v;
    return { values, counts, charge, known, unknown: u };
  }
  const sum = known.reduce((s, el) => s + values[el] * counts[el], 0);
  return sum === charge ? { values, counts, charge, known } : null;
}

/** Roman numerals as in German school books: +VI, −II, 0. */
export function roman(v: number): string {
  if (v === 0) return "0";
  const R = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  return `${v > 0 ? "+" : "−"}${R[Math.abs(v)]}`;
}

/** "+6", "−2", "0" with a proper minus. */
export const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

// ---------------------------------------------------------------------------
// Half-equations (Teilgleichungen) with the number of electrons

export type Half = {
  /** The equation with the electrons, e.g. "Cl2 + 2e- -> 2Cl-". */
  eq: string;
  electrons: number;
  kind: "ox" | "red";
  level: 1 | 2 | 3;
  /** A typical wrong electron count and why. */
  slip?: { value: number; title: Text; say: Text };
};

const twoAtoms = (formula: string, value: number) => ({
  value,
  title: tx("Two atoms, not one", "Zwei Atome, nicht eins"),
  say: tx(
    `You counted the electrons for **one** atom. But $\\ce{${formula}}$ has two, and each needs its share.`,
    `Du hast die Elektronen für **ein** Atom gezählt. Aber $\\ce{${formula}}$ besteht aus zwei, und jedes braucht seinen Anteil.`,
  ),
});

export const HALVES: Half[] = [
  { eq: "Na -> Na+ + e-", electrons: 1, kind: "ox", level: 1 },
  { eq: "K -> K+ + e-", electrons: 1, kind: "ox", level: 1 },
  { eq: "Mg -> Mg^2+ + 2e-", electrons: 2, kind: "ox", level: 1 },
  { eq: "Ca -> Ca^2+ + 2e-", electrons: 2, kind: "ox", level: 1 },
  { eq: "Zn -> Zn^2+ + 2e-", electrons: 2, kind: "ox", level: 1 },
  { eq: "Al -> Al^3+ + 3e-", electrons: 3, kind: "ox", level: 1 },
  { eq: "Fe -> Fe^2+ + 2e-", electrons: 2, kind: "ox", level: 1 },
  { eq: "Cu^2+ + 2e- -> Cu", electrons: 2, kind: "red", level: 1 },
  { eq: "Ag+ + e- -> Ag", electrons: 1, kind: "red", level: 1 },
  { eq: "Fe^3+ + 3e- -> Fe", electrons: 3, kind: "red", level: 1 },
  { eq: "Cl2 + 2e- -> 2Cl-", electrons: 2, kind: "red", level: 2, slip: twoAtoms("Cl2", 1) },
  { eq: "Br2 + 2e- -> 2Br-", electrons: 2, kind: "red", level: 2, slip: twoAtoms("Br2", 1) },
  { eq: "O2 + 4e- -> 2O^2-", electrons: 4, kind: "red", level: 2, slip: twoAtoms("O2", 2) },
  { eq: "2H+ + 2e- -> H2", electrons: 2, kind: "red", level: 2, slip: { value: 1, title: tx("Two ions, not one", "Zwei Ionen, nicht eins"), say: tx("There are **two** $\\ce{H+}$ ions, and each takes one electron.", "Da stehen **zwei** $\\ce{H+}$-Ionen, und jedes nimmt ein Elektron auf.") } },
  { eq: "2Cl- -> Cl2 + 2e-", electrons: 2, kind: "ox", level: 2, slip: { value: 1, title: tx("Two ions, not one", "Zwei Ionen, nicht eins"), say: tx("There are **two** $\\ce{Cl-}$ ions, and each gives away one electron.", "Da stehen **zwei** $\\ce{Cl-}$-Ionen, und jedes gibt ein Elektron ab.") } },
  { eq: "2Br- -> Br2 + 2e-", electrons: 2, kind: "ox", level: 2, slip: { value: 1, title: tx("Two ions, not one", "Zwei Ionen, nicht eins"), say: tx("There are **two** $\\ce{Br-}$ ions, and each gives away one electron.", "Da stehen **zwei** $\\ce{Br-}$-Ionen, und jedes gibt ein Elektron ab.") } },
  { eq: "S + 2e- -> S^2-", electrons: 2, kind: "red", level: 2 },
  { eq: "H2 -> 2H+ + 2e-", electrons: 2, kind: "ox", level: 2, slip: twoAtoms("H2", 1) },
  {
    eq: "Fe^2+ -> Fe^3+ + e-",
    electrons: 1,
    kind: "ox",
    level: 3,
    slip: { value: 3, title: tx("It's already an ion", "Es ist schon ein Ion"), say: tx("$\\ce{Fe^2+}$ has already lost two electrons. From $2+$ to $3+$ is just one more step.", "$\\ce{Fe^2+}$ hat schon zwei Elektronen abgegeben. Von $2+$ nach $3+$ ist es nur noch ein Schritt.") },
  },
  {
    eq: "Fe^3+ + e- -> Fe^2+",
    electrons: 1,
    kind: "red",
    level: 3,
    slip: { value: 3, title: tx("Not all the way to the atom", "Nicht bis zum Atom"), say: tx("The iron ion doesn't become an atom here, only $\\ce{Fe^2+}$. From $3+$ to $2+$ is one step.", "Das Eisen-Ion wird hier kein Atom, sondern nur $\\ce{Fe^2+}$. Von $3+$ nach $2+$ ist es ein Schritt.") },
  },
  {
    eq: "Cu+ -> Cu^2+ + e-",
    electrons: 1,
    kind: "ox",
    level: 3,
    slip: { value: 2, title: tx("It's already an ion", "Es ist schon ein Ion"), say: tx("$\\ce{Cu+}$ has already given away one electron. To reach $2+$ it needs to lose just one more.", "$\\ce{Cu+}$ hat schon ein Elektron abgegeben. Bis $2+$ fehlt nur noch eins.") },
  },
];

// ---------------------------------------------------------------------------
// Reactions where oxidation numbers change (for "which element is oxidised?")

export type OxChange = {
  /** \ce body with coefficients. */
  ce: string;
  oxidised: string;
  reduced: string;
  /** Oxidation numbers before → after for each element. */
  change: Record<string, [number, number]>;
  /** Reducing and oxidising agent (formulas as written on the left). */
  reducer: string;
  oxidiser: string;
  where?: Text;
  level: 1 | 2 | 3;
};

export const OX_CHANGES: OxChange[] = [
  { ce: "CuO + H2 -> Cu + H2O", oxidised: "H", reduced: "Cu", change: { Cu: [2, 0], O: [-2, -2], H: [0, 1] }, reducer: "H2", oxidiser: "CuO", level: 1 },
  { ce: "2CuO + C -> 2Cu + CO2", oxidised: "C", reduced: "Cu", change: { Cu: [2, 0], O: [-2, -2], C: [0, 4] }, reducer: "C", oxidiser: "CuO", level: 1 },
  { ce: "Fe2O3 + 3CO -> 2Fe + 3CO2", oxidised: "C", reduced: "Fe", change: { Fe: [3, 0], O: [-2, -2], C: [2, 4] }, reducer: "CO", oxidiser: "Fe2O3", where: tx("in the blast furnace", "im Hochofen"), level: 2 },
  { ce: "Fe2O3 + 2Al -> Al2O3 + 2Fe", oxidised: "Al", reduced: "Fe", change: { Fe: [3, 0], O: [-2, -2], Al: [0, 3] }, reducer: "Al", oxidiser: "Fe2O3", where: tx("in the thermite reaction for welding rails", "beim Thermitverfahren zum Schweißen von Schienen"), level: 2 },
  { ce: "2Mg + CO2 -> 2MgO + C", oxidised: "Mg", reduced: "C", change: { Mg: [0, 2], O: [-2, -2], C: [4, 0] }, reducer: "Mg", oxidiser: "CO2", level: 3 },
  { ce: "CH4 + 2O2 -> CO2 + 2H2O", oxidised: "C", reduced: "O", change: { C: [-4, 4], H: [1, 1], O: [0, -2] }, reducer: "CH4", oxidiser: "O2", where: tx("when natural gas burns", "beim Verbrennen von Erdgas"), level: 3 },
  { ce: "Zn + 2HCl -> ZnCl2 + H2", oxidised: "Zn", reduced: "H", change: { Zn: [0, 2], H: [1, 0], Cl: [-1, -1] }, reducer: "Zn", oxidiser: "HCl", level: 3 },
  { ce: "2H2 + O2 -> 2H2O", oxidised: "H", reduced: "O", change: { H: [0, 1], O: [0, -2] }, reducer: "H2", oxidiser: "O2", level: 2 },
  { ce: "2Na + Cl2 -> 2NaCl", oxidised: "Na", reduced: "Cl", change: { Na: [0, 1], Cl: [0, -1] }, reducer: "Na", oxidiser: "Cl2", level: 2 },
  { ce: "Cl2 + 2KBr -> 2KCl + Br2", oxidised: "Br", reduced: "Cl", change: { Cl: [0, -1], K: [1, 1], Br: [-1, 0] }, reducer: "KBr", oxidiser: "Cl2", level: 3 },
];
