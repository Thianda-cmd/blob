// Balancing chemical equations: the curated reactions of the "balancing" topic, an exact
// solver, Blob's step-by-step strategy as animated frames, and simulated misconceptions
// (the coefficients a student with a typical wrong idea would type).

import { tx, txMap, type Text } from "@/i18n/text";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import type { Frame, Mistake } from "@/learn/types";
import { element } from "./elements";
import { parseEquation, parseFormula, unbalanced, type Counts } from "./formula";

// ---------------------------------------------------------------------------
// Curated reactions (all checked by the solver: coefficients are the smallest set)

export type ReactionKind = "synthesis" | "metal-oxygen" | "decomposition" | "combustion" | "metal-acid" | "metal-water" | "neutralisation" | "redox" | "precipitation";

export type Reaction = {
  /** Without coefficients, species separated by " + ", arrow "->". */
  eq: string;
  /** The smallest whole-number coefficients (left species first). */
  coefs: number[];
  /** The word equation. */
  words: Text;
  kind: ReactionKind;
  level: 1 | 2 | 3;
  /** Polyatomic groups that stay intact and are balanced as one unit. */
  units?: string[];
};

const R = (eq: string, coefs: number[], en: string, de: string, kind: ReactionKind, level: 1 | 2 | 3, units?: string[]): Reaction => ({
  eq,
  coefs,
  words: tx(en, de),
  kind,
  level,
  units,
});

export const REACTIONS: Reaction[] = [
  // Level 1: two or three species, small numbers
  R("H2 + O2 -> H2O", [2, 1, 2], "hydrogen + oxygen → water", "Wasserstoff + Sauerstoff → Wasser", "synthesis", 1),
  R("Na + Cl2 -> NaCl", [2, 1, 2], "sodium + chlorine → sodium chloride", "Natrium + Chlor → Natriumchlorid", "synthesis", 1),
  R("Mg + O2 -> MgO", [2, 1, 2], "magnesium + oxygen → magnesium oxide", "Magnesium + Sauerstoff → Magnesiumoxid", "metal-oxygen", 1),
  R("Ca + O2 -> CaO", [2, 1, 2], "calcium + oxygen → calcium oxide", "Calcium + Sauerstoff → Calciumoxid", "metal-oxygen", 1),
  R("Cu + O2 -> CuO", [2, 1, 2], "copper + oxygen → copper(II) oxide", "Kupfer + Sauerstoff → Kupfer(II)-oxid", "metal-oxygen", 1),
  R("Zn + O2 -> ZnO", [2, 1, 2], "zinc + oxygen → zinc oxide", "Zink + Sauerstoff → Zinkoxid", "metal-oxygen", 1),
  R("H2 + Cl2 -> HCl", [1, 1, 2], "hydrogen + chlorine → hydrogen chloride", "Wasserstoff + Chlor → Chlorwasserstoff", "synthesis", 1),
  R("N2 + H2 -> NH3", [1, 3, 2], "nitrogen + hydrogen → ammonia", "Stickstoff + Wasserstoff → Ammoniak", "synthesis", 1),
  R("K + Br2 -> KBr", [2, 1, 2], "potassium + bromine → potassium bromide", "Kalium + Brom → Kaliumbromid", "synthesis", 1),
  R("Li + Cl2 -> LiCl", [2, 1, 2], "lithium + chlorine → lithium chloride", "Lithium + Chlor → Lithiumchlorid", "synthesis", 1),
  R("N2 + O2 -> NO", [1, 1, 2], "nitrogen + oxygen → nitrogen monoxide", "Stickstoff + Sauerstoff → Stickstoffmonoxid", "synthesis", 1),
  R("C + O2 -> CO", [2, 1, 2], "carbon + oxygen → carbon monoxide", "Kohlenstoff + Sauerstoff → Kohlenstoffmonoxid", "synthesis", 1),
  R("Zn + HCl -> ZnCl2 + H2", [1, 2, 1, 1], "zinc + hydrochloric acid → zinc chloride + hydrogen", "Zink + Salzsäure → Zinkchlorid + Wasserstoff", "metal-acid", 1),
  R("Mg + HCl -> MgCl2 + H2", [1, 2, 1, 1], "magnesium + hydrochloric acid → magnesium chloride + hydrogen", "Magnesium + Salzsäure → Magnesiumchlorid + Wasserstoff", "metal-acid", 1),
  R("H2O -> H2 + O2", [2, 2, 1], "water → hydrogen + oxygen", "Wasser → Wasserstoff + Sauerstoff", "decomposition", 1),
  R("H2O2 -> H2O + O2", [2, 2, 1], "hydrogen peroxide → water + oxygen", "Wasserstoffperoxid → Wasser + Sauerstoff", "decomposition", 1),
  R("HgO -> Hg + O2", [2, 2, 1], "mercury(II) oxide → mercury + oxygen", "Quecksilber(II)-oxid → Quecksilber + Sauerstoff", "decomposition", 1),
  R("Ag2O -> Ag + O2", [2, 4, 1], "silver oxide → silver + oxygen", "Silberoxid → Silber + Sauerstoff", "decomposition", 1),

  // Level 2: the class-test standards
  R("Fe + O2 -> Fe2O3", [4, 3, 2], "iron + oxygen → iron(III) oxide", "Eisen + Sauerstoff → Eisen(III)-oxid", "metal-oxygen", 2),
  R("Al + O2 -> Al2O3", [4, 3, 2], "aluminium + oxygen → aluminium oxide", "Aluminium + Sauerstoff → Aluminiumoxid", "metal-oxygen", 2),
  R("Li + O2 -> Li2O", [4, 1, 2], "lithium + oxygen → lithium oxide", "Lithium + Sauerstoff → Lithiumoxid", "metal-oxygen", 2),
  R("Al + Cl2 -> AlCl3", [2, 3, 2], "aluminium + chlorine → aluminium chloride", "Aluminium + Chlor → Aluminiumchlorid", "synthesis", 2),
  R("Fe + Cl2 -> FeCl3", [2, 3, 2], "iron + chlorine → iron(III) chloride", "Eisen + Chlor → Eisen(III)-chlorid", "synthesis", 2),
  R("Al + Br2 -> AlBr3", [2, 3, 2], "aluminium + bromine → aluminium bromide", "Aluminium + Brom → Aluminiumbromid", "synthesis", 2),
  R("Na + H2O -> NaOH + H2", [2, 2, 2, 1], "sodium + water → sodium hydroxide + hydrogen", "Natrium + Wasser → Natriumhydroxid + Wasserstoff", "metal-water", 2),
  R("K + H2O -> KOH + H2", [2, 2, 2, 1], "potassium + water → potassium hydroxide + hydrogen", "Kalium + Wasser → Kaliumhydroxid + Wasserstoff", "metal-water", 2),
  R("CH4 + O2 -> CO2 + H2O", [1, 2, 1, 2], "methane + oxygen → carbon dioxide + water", "Methan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 2),
  R("C3H8 + O2 -> CO2 + H2O", [1, 5, 3, 4], "propane + oxygen → carbon dioxide + water", "Propan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 2),
  R("Al + HCl -> AlCl3 + H2", [2, 6, 2, 3], "aluminium + hydrochloric acid → aluminium chloride + hydrogen", "Aluminium + Salzsäure → Aluminiumchlorid + Wasserstoff", "metal-acid", 2),
  R("Fe + HCl -> FeCl2 + H2", [1, 2, 1, 1], "iron + hydrochloric acid → iron(II) chloride + hydrogen", "Eisen + Salzsäure → Eisen(II)-chlorid + Wasserstoff", "metal-acid", 2),
  R("Ca(OH)2 + HCl -> CaCl2 + H2O", [1, 2, 1, 2], "calcium hydroxide + hydrochloric acid → calcium chloride + water", "Calciumhydroxid + Salzsäure → Calciumchlorid + Wasser", "neutralisation", 2),
  R("NaOH + H2SO4 -> Na2SO4 + H2O", [2, 1, 1, 2], "sodium hydroxide + sulfuric acid → sodium sulfate + water", "Natriumhydroxid + Schwefelsäure → Natriumsulfat + Wasser", "neutralisation", 2, ["SO4"]),
  R("KOH + H2SO4 -> K2SO4 + H2O", [2, 1, 1, 2], "potassium hydroxide + sulfuric acid → potassium sulfate + water", "Kaliumhydroxid + Schwefelsäure → Kaliumsulfat + Wasser", "neutralisation", 2, ["SO4"]),
  R("Ca(OH)2 + HNO3 -> Ca(NO3)2 + H2O", [1, 2, 1, 2], "calcium hydroxide + nitric acid → calcium nitrate + water", "Calciumhydroxid + Salpetersäure → Calciumnitrat + Wasser", "neutralisation", 2, ["NO3"]),
  R("CaCO3 + HCl -> CaCl2 + H2O + CO2", [1, 2, 1, 1, 1], "calcium carbonate + hydrochloric acid → calcium chloride + water + carbon dioxide", "Calciumcarbonat + Salzsäure → Calciumchlorid + Wasser + Kohlenstoffdioxid", "metal-acid", 2),
  R("CuO + C -> Cu + CO2", [2, 1, 2, 1], "copper(II) oxide + carbon → copper + carbon dioxide", "Kupfer(II)-oxid + Kohlenstoff → Kupfer + Kohlenstoffdioxid", "redox", 2),
  R("Fe2O3 + H2 -> Fe + H2O", [1, 3, 2, 3], "iron(III) oxide + hydrogen → iron + water", "Eisen(III)-oxid + Wasserstoff → Eisen + Wasser", "redox", 2),
  R("Fe2O3 + Al -> Al2O3 + Fe", [1, 2, 1, 2], "iron(III) oxide + aluminium → aluminium oxide + iron", "Eisen(III)-oxid + Aluminium → Aluminiumoxid + Eisen", "redox", 2),
  R("Mg + CO2 -> MgO + C", [2, 1, 2, 1], "magnesium + carbon dioxide → magnesium oxide + carbon", "Magnesium + Kohlenstoffdioxid → Magnesiumoxid + Kohlenstoff", "redox", 2),
  R("SO2 + O2 -> SO3", [2, 1, 2], "sulfur dioxide + oxygen → sulfur trioxide", "Schwefeldioxid + Sauerstoff → Schwefeltrioxid", "synthesis", 2),
  R("KClO3 -> KCl + O2", [2, 2, 3], "potassium chlorate → potassium chloride + oxygen", "Kaliumchlorat → Kaliumchlorid + Sauerstoff", "decomposition", 2),
  R("BaCl2 + Na2SO4 -> BaSO4 + NaCl", [1, 1, 1, 2], "barium chloride + sodium sulfate → barium sulfate + sodium chloride", "Bariumchlorid + Natriumsulfat → Bariumsulfat + Natriumchlorid", "precipitation", 2, ["SO4"]),

  // Level 3: halves, polyatomic ions and longer equations
  R("C2H6 + O2 -> CO2 + H2O", [2, 7, 4, 6], "ethane + oxygen → carbon dioxide + water", "Ethan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("C4H10 + O2 -> CO2 + H2O", [2, 13, 8, 10], "butane + oxygen → carbon dioxide + water", "Butan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("C5H12 + O2 -> CO2 + H2O", [1, 8, 5, 6], "pentane + oxygen → carbon dioxide + water", "Pentan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("C6H14 + O2 -> CO2 + H2O", [2, 19, 12, 14], "hexane + oxygen → carbon dioxide + water", "Hexan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("C8H18 + O2 -> CO2 + H2O", [2, 25, 16, 18], "octane + oxygen → carbon dioxide + water", "Octan + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("C2H5OH + O2 -> CO2 + H2O", [1, 3, 2, 3], "ethanol + oxygen → carbon dioxide + water", "Ethanol + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("C6H12O6 + O2 -> CO2 + H2O", [1, 6, 6, 6], "glucose + oxygen → carbon dioxide + water", "Glucose + Sauerstoff → Kohlenstoffdioxid + Wasser", "combustion", 3),
  R("CO2 + H2O -> C6H12O6 + O2", [6, 6, 1, 6], "carbon dioxide + water → glucose + oxygen", "Kohlenstoffdioxid + Wasser → Glucose + Sauerstoff", "synthesis", 3),
  R("Al + H2SO4 -> Al2(SO4)3 + H2", [2, 3, 1, 3], "aluminium + sulfuric acid → aluminium sulfate + hydrogen", "Aluminium + Schwefelsäure → Aluminiumsulfat + Wasserstoff", "metal-acid", 3, ["SO4"]),
  R("Al + CuSO4 -> Al2(SO4)3 + Cu", [2, 3, 1, 3], "aluminium + copper(II) sulfate → aluminium sulfate + copper", "Aluminium + Kupfer(II)-sulfat → Aluminiumsulfat + Kupfer", "redox", 3, ["SO4"]),
  R("Cu + AgNO3 -> Cu(NO3)2 + Ag", [1, 2, 1, 2], "copper + silver nitrate → copper(II) nitrate + silver", "Kupfer + Silbernitrat → Kupfer(II)-nitrat + Silber", "redox", 3, ["NO3"]),
  R("Pb(NO3)2 + KI -> PbI2 + KNO3", [1, 2, 1, 2], "lead(II) nitrate + potassium iodide → lead(II) iodide + potassium nitrate", "Blei(II)-nitrat + Kaliumiodid → Blei(II)-iodid + Kaliumnitrat", "precipitation", 3, ["NO3"]),
  R("H3PO4 + NaOH -> Na3PO4 + H2O", [1, 3, 1, 3], "phosphoric acid + sodium hydroxide → sodium phosphate + water", "Phosphorsäure + Natriumhydroxid → Natriumphosphat + Wasser", "neutralisation", 3, ["PO4"]),
  R("H3PO4 + Ca(OH)2 -> Ca3(PO4)2 + H2O", [2, 3, 1, 6], "phosphoric acid + calcium hydroxide → calcium phosphate + water", "Phosphorsäure + Calciumhydroxid → Calciumphosphat + Wasser", "neutralisation", 3, ["PO4"]),
  R("Al(OH)3 + H2SO4 -> Al2(SO4)3 + H2O", [2, 3, 1, 6], "aluminium hydroxide + sulfuric acid → aluminium sulfate + water", "Aluminiumhydroxid + Schwefelsäure → Aluminiumsulfat + Wasser", "neutralisation", 3, ["SO4"]),
  R("Fe2O3 + C -> Fe + CO2", [2, 3, 4, 3], "iron(III) oxide + carbon → iron + carbon dioxide", "Eisen(III)-oxid + Kohlenstoff → Eisen + Kohlenstoffdioxid", "redox", 3),
  R("NH3 + O2 -> NO + H2O", [4, 5, 4, 6], "ammonia + oxygen → nitrogen monoxide + water", "Ammoniak + Sauerstoff → Stickstoffmonoxid + Wasser", "redox", 3),
  R("FeS2 + O2 -> Fe2O3 + SO2", [4, 11, 2, 8], "iron disulfide (pyrite) + oxygen → iron(III) oxide + sulfur dioxide", "Eisendisulfid (Pyrit) + Sauerstoff → Eisen(III)-oxid + Schwefeldioxid", "redox", 3),
  R("NaHCO3 -> Na2CO3 + H2O + CO2", [2, 1, 1, 1], "sodium hydrogen carbonate → sodium carbonate + water + carbon dioxide", "Natriumhydrogencarbonat → Natriumcarbonat + Wasser + Kohlenstoffdioxid", "decomposition", 3),
];

export const reaction = (eq: string) => REACTIONS.find((r) => r.eq === eq)!;

// ---------------------------------------------------------------------------
// Small helpers

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
export const gcdOf = (xs: number[]) => xs.reduce((g, x) => gcd(g, x), 0);

/** The species of an equation as written: { left: ["Fe", "O2"], right: ["Fe2O3"] }. */
export function parts(eq: string) {
  const [l, r] = eq.split("->");
  const side = (s: string) =>
    s
      .split(" + ")
      .map((p) => p.trim())
      .filter(Boolean);
  return { left: side(l), right: side(r ?? "") };
}

export const allSpecies = (eq: string) => {
  const p = parts(eq);
  return [...p.left, ...p.right];
};

const countsOf = (formula: string): Counts => {
  const f = parseFormula(formula);
  return f.ok ? f.species.counts : {};
};

/** "4Fe + 3O2 -> 2Fe2O3" as display source; each species keeps its coefficient on the same line when it wraps. */
export function ceEquation(eq: string, coefs: number[]): string {
  const p = parts(eq);
  const piece = (s: string, i: number) => `\\group{\\ce{${coefs[i] && coefs[i] !== 1 ? coefs[i] : ""}${s}}}`;
  return `${p.left.map(piece).join(" + ")} -> ${p.right.map((s, i) => piece(s, p.left.length + i)).join(" + ")}`;
}

// ---------------------------------------------------------------------------
// Exact solver: the null space of the atom matrix, over the rationals

type Q = { n: number; d: number };
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const qsub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qdiv = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);

/** Smallest positive whole-number coefficients, or null when there is no unique way to balance. */
export function solve(eqText: string): number[] | null {
  const eq = parseEquation(eqText);
  if (!eq) return null;
  const species = [...eq.left, ...eq.right];
  const nl = eq.left.length;
  const n = species.length;
  const els = [...new Set(species.flatMap((s) => Object.keys(s.counts)))];
  const rows: Q[][] = els.map((el) => species.map((s, i) => q((i < nl ? 1 : -1) * (s.counts[el] ?? 0))));
  if (species.some((s) => s.charge)) rows.push(species.map((s, i) => q((i < nl ? 1 : -1) * s.charge)));
  // Reduced row echelon form.
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    const p = rows.findIndex((row, i) => i >= r && row[c].n !== 0);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    const pv = rows[r][c];
    rows[r] = rows[r].map((x) => qdiv(x, pv));
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i][c].n === 0) continue;
      const f = rows[i][c];
      rows[i] = rows[i].map((x, j) => qsub(x, qmul(f, rows[r][j])));
    }
    pivots.push(c);
    r++;
  }
  if (n - pivots.length !== 1) return null;
  const free = [...Array(n).keys()].find((c) => !pivots.includes(c))!;
  const x: Q[] = Array.from({ length: n }, () => q(0));
  x[free] = q(1);
  pivots.forEach((c, i) => (x[c] = q(-rows[i][free].n, rows[i][free].d)));
  const den = x.reduce((m, v) => lcm(m, v.d), 1);
  let ints = x.map((v) => (v.n * den) / v.d);
  if (ints.every((v) => v < 0)) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= 0)) return null;
  const g = gcdOf(ints);
  return ints.map((v) => v / g);
}

export const sameCoefs = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------------------
// Blob's strategy, step by step: metals first, then polyatomic groups, then the other
// nonmetals, hydrogen, and oxygen last. A half? Double everything.

type Item = { key: string; unit: boolean; prio: number; per: number[]; elemental: boolean[] };

const METALS = new Set(["alkali", "alkaline-earth", "transition", "post-transition", "lanthanide", "actinide"]);

function unitCount(formula: string, unit: string): number {
  const m = formula.match(new RegExp(`\\(${unit}\\)(\\d*)`));
  if (m) return m[1] ? Number(m[1]) : 1;
  return formula.includes(unit) ? 1 : 0;
}

function itemsOf(r: { eq: string; units?: string[] }): Item[] {
  const species = allSpecies(r.eq);
  const rest = species.map((s) => ({ ...countsOf(s) }));
  const items: Item[] = [];
  for (const u of r.units ?? []) {
    const uc = countsOf(u);
    const per = species.map((s) => unitCount(s, u));
    per.forEach((k, i) => {
      for (const [el, n] of Object.entries(uc)) rest[i][el] = (rest[i][el] ?? 0) - n * k;
    });
    items.push({ key: u, unit: true, prio: 1, per, elemental: species.map(() => false) });
  }
  const order: string[] = [];
  for (const c of rest) for (const [el, n] of Object.entries(c)) if (n > 0 && !order.includes(el)) order.push(el);
  for (const el of order) {
    const e = element(el);
    const prio = el === "O" ? 4 : el === "H" ? 3 : e && METALS.has(e.category) ? 0 : 2;
    items.push({
      key: el,
      unit: false,
      prio,
      per: rest.map((c) => Math.max(0, c[el] ?? 0)),
      elemental: species.map((s) => {
        const c = countsOf(s);
        return Object.keys(c).length === 1 && el in c;
      }),
    });
  }
  return items.sort((a, b) => a.prio - b.prio);
}

/** Display source with keyed coefficients: `\group{2#k0 \ce{H2}} + \group{\ce{O2}} -> …`. A fraction shows as \frac. Groups keep each species on one line. */
export function coefSrc(eq: string, coefs: (number | Q)[]): string {
  const p = parts(eq);
  const piece = (s: string, i: number) => {
    const c = coefs[i];
    const v = typeof c === "number" ? q(c) : c;
    const tok = v.d !== 1 ? `\\frac{${v.n}#k${i}n}{${v.d}#k${i}d}#k${i} ` : v.n !== 1 ? `${v.n}#k${i} ` : "";
    return `\\group{${tok}\\ce{${s}}}`;
  };
  return `${p.left.map(piece).join(" + ")} -> ${p.right.map((s, i) => piece(s, p.left.length + i)).join(" + ")}`;
}

/** Leaf keys of an element's symbols (and their subscripts) in a display source, for highlighting. */
export function elementKeys(src: string, el: string): string[] {
  const out: string[] = [];
  const leaves = (nodes: DNode[]) => {
    const all: string[] = [];
    const walk = (list: DNode[]) => {
      for (const n of list) {
        if ("v" in n && n.type !== "space") all.push(n.k);
        if ("base" in n) walk(n.base);
        if ("sub" in n) walk(n.sub);
        if ("body" in n) walk(n.body);
      }
    };
    walk(nodes);
    return all;
  };
  const walk = (list: DNode[]) => {
    for (const n of list) {
      if (n.type === "sym" && n.v === el) out.push(n.k);
      else if (n.type === "sub" && n.base.length === 1 && n.base[0].type === "sym" && n.base[0].v === el) out.push(...leaves([n]));
      else if (n.type === "sub" || n.type === "pow") walk(n.base);
      else if (n.type === "paren" || n.type === "style") walk(n.body);
    }
  };
  walk(parseDisplay(src));
  return out;
}

const label = (it: { key: string }) => `$\\ce{${it.key}}$`;

export type Strategy = {
  frames: Frame[];
  coefs: number[];
  /** Coefficients right before the first "double everything" step, with the fraction's index. */
  half?: { before: number[]; index: number; num: number; den: number };
};

/** Blob's step-by-step balancing as animated frames. Returns null if the strategy gets stuck. */
export function strategy(r: { eq: string; units?: string[] }): Strategy | null {
  const species = allSpecies(r.eq);
  const nl = parts(r.eq).left.length;
  const n = species.length;
  const items = itemsOf(r);
  let coef = Array<number>(n).fill(1);
  const frames: Frame[] = [];
  let half: Strategy["half"];

  const side = (it: Item, s: 0 | 1, c = coef) => it.per.reduce((sum, k, i) => sum + ((i < nl ? 0 : 1) === s ? k * c[i] : 0), 0);
  const tally = (c = coef) => items.map((it) => `${label(it)} ${side(it, 0, c)} | ${side(it, 1, c)}`).join(", ");
  const src = (c: (number | Q)[] = coef) => coefSrc(r.eq, c);
  const lit = (s: string, it: Item, changed: number[]) => [...changed.map((i) => `k${i}`), ...(it.unit ? [] : elementKeys(s, it.key))];

  frames.push({
    math: src(),
    note: txMap((t) =>
      items.some((it) => it.unit)
        ? `${t("Count the atoms and groups on each side (left | right):", "Zähl die Atome und Gruppen auf beiden Seiten (links | rechts):")} ${tally()}.`
        : `${t("Count the atoms on each side (left | right):", "Zähl die Atome auf beiden Seiten (links | rechts):")} ${tally()}.`,
    ),
  });

  const done = new Set<string>();
  let okList: Item[] = [];
  const flushOk = () => {
    if (!okList.length) return;
    const list = okList.map((it) => `${label(it)} (${side(it, 0)} | ${side(it, 1)})`).join(", ");
    const s = src();
    frames.push({
      math: s,
      highlight: okList.flatMap((it) => (it.unit ? [] : elementKeys(s, it.key))),
      note: txMap((t) => `${t("Already balanced:", "Passt schon:")} ${list}.`),
    });
    okList = [];
  };

  for (let guard = 0; guard < 24; guard++) {
    const it = items.find((x) => !done.has(x.key) || side(x, 0) !== side(x, 1));
    if (!it) break;
    const L = side(it, 0);
    const Rr = side(it, 1);
    if (L === Rr) {
      done.add(it.key);
      okList.push(it);
      continue;
    }
    flushOk();
    const locked = new Set<number>();
    for (const other of items) if (other.key !== it.key && done.has(other.key)) other.per.forEach((k, i) => k > 0 && locked.add(i));
    // Candidates: free species whose coefficient alone can balance this item.
    type Cand = { i: number; c: Q; elemental: boolean; atoms: number };
    const cands: Cand[] = [];
    for (let i = 0; i < n; i++) {
      if (!it.per[i] || locked.has(i)) continue;
      const s: 0 | 1 = i < nl ? 0 : 1;
      const need = side(it, s === 0 ? 1 : 0) - (side(it, s) - it.per[i] * coef[i]);
      if (need <= 0) continue;
      cands.push({ i, c: q(need, it.per[i]), elemental: it.elemental[i], atoms: Object.values(countsOf(species[i])).reduce((a, b) => a + b, 0) });
    }
    const score = (c: Cand) => (c.c.d === 1 ? 0 : 2) + (c.elemental ? 0 : 1);
    cands.sort((a, b) => score(a) - score(b) || a.atoms - b.atoms);
    const best = cands[0];
    const holders = [...Array(n).keys()].filter((i) => it.per[i] > 0);
    const oneEach = holders.filter((i) => i < nl).length === 1 && holders.filter((i) => i >= nl).length === 1;

    if (best && (best.c.d === 1 || !oneEach || score(best) < 2 || [...locked].every((i) => !holders.includes(i)))) {
      const sp = species[best.i];
      const total = side(it, best.i < nl ? 1 : 0);
      if (best.c.d === 1) {
        coef = coef.map((c, i) => (i === best.i ? best.c.n : c));
        const s = src();
        frames.push({
          math: s,
          highlight: lit(s, it, [best.i]),
          note: tx(
            `**${label(it)}**: ${L} on the left, ${Rr} on the right. A **${best.c.n}** in front of $\\ce{${sp}}$ makes it ${total} on each side.`,
            `**${label(it)}**: links ${L}, rechts ${Rr}. Mit einer **${best.c.n}** vor $\\ce{${sp}}$ sind es auf jeder Seite ${total}.`,
          ),
        });
      } else {
        const shown: (number | Q)[] = coef.map((c, i) => (i === best.i ? best.c : c));
        const s = src(shown);
        frames.push({
          math: s,
          highlight: lit(s, it, [best.i]),
          note: tx(
            `**${label(it)}**: ${L} on the left, ${Rr} on the right. For ${total} you'd need $\\frac{${best.c.n}}{${best.c.d}}$ $\\ce{${sp}}$.`,
            `**${label(it)}**: links ${L}, rechts ${Rr}. Für ${total} bräuchtest du $\\frac{${best.c.n}}{${best.c.d}}$ $\\ce{${sp}}$.`,
          ),
        });
        const k = best.c.d;
        if (!half) half = { before: [...coef], index: best.i, num: best.c.n, den: k };
        coef = coef.map((c, i) => (i === best.i ? best.c.n : c * k));
        const s2 = src();
        frames.push({
          math: s2,
          highlight: [...Array(n).keys()].map((i) => `k${i}`),
          note:
            k === 2
              ? tx("Half a molecule doesn't exist. So double **every** coefficient.", "Halbe Moleküle gibt es nicht. Also verdoppelst du **jeden** Koeffizienten.")
              : tx(`Only whole numbers count. So multiply **every** coefficient by ${k}.`, `Es zählen nur ganze Zahlen. Also nimmst du **jeden** Koeffizienten mal ${k}.`),
        });
      }
      done.add(it.key);
      continue;
    }

    // No free species: make both sides equal with the smallest common multiple.
    if (!oneEach) return null;
    const [a, b] = holders;
    const T = lcm(L, Rr);
    const fa = T / L;
    const fb = T / Rr;
    coef = coef.map((c, i) => (i === a ? c * fa : i === b ? c * fb : c));
    const s = src();
    const changed = [a, b].filter((i, j) => (j === 0 ? fa : fb) !== 1);
    const what = (and: string) => changed.map((i) => `**${coef[i]}** $\\ce{${species[i]}}$`).join(and);
    frames.push({
      math: s,
      highlight: lit(s, it, changed),
      note: tx(
        `**${label(it)}**: ${L} on the left, ${Rr} on the right. The smallest common multiple is ${T}, so: ${what(" and ")}.`,
        `**${label(it)}**: links ${L}, rechts ${Rr}. Das kleinste gemeinsame Vielfache ist ${T}, also: ${what(" und ")}.`,
      ),
    });
    for (const other of items) if (side(other, 0) !== side(other, 1)) done.delete(other.key);
    done.add(it.key);
  }
  if (items.some((x) => side(x, 0) !== side(x, 1))) return null;
  flushOk();
  const g = gcdOf(coef);
  if (g > 1) {
    coef = coef.map((c) => c / g);
    frames.push({
      math: src(),
      highlight: [...Array(n).keys()].map((i) => `k${i}`),
      note: tx(`All numbers can be divided by ${g}. Equations use the smallest whole numbers.`, `Alle Zahlen lassen sich durch ${g} teilen. In Reaktionsgleichungen stehen die kleinsten ganzen Zahlen.`),
    });
  }
  const finalTally = tally();
  frames.push({
    math: src(),
    note: txMap((t) => `${t("Check:", "Probe:")} ${finalTally}. ${t("Balanced!", "Ausgeglichen!")}`),
  });
  return { frames, coefs: coef, half };
}

// ---------------------------------------------------------------------------
// Misconceptions, simulated: the coefficients a student with a typical wrong idea types

/**
 * An equation whose ONLY balanced set is `coefs` (made of noble-gas "atoms"), so a
 * balance-kind mistake can match exactly these coefficients.
 */
export function exactly(coefs: number[], nl: number): string | null {
  if (gcdOf(coefs) !== 1) return null;
  const n = coefs.length;
  const SYMS = ["He", "Ne", "Ar", "Kr", "Xe", "Rn", "Og"];
  const atoms: Counts[] = coefs.map(() => ({}));
  let e = 0;
  const pair = (i: number, j: number) => {
    const g = gcd(coefs[i], coefs[j]);
    atoms[i][SYMS[e]] = coefs[j] / g;
    atoms[j][SYMS[e]] = coefs[i] / g;
    e++;
  };
  for (let j = nl; j < n; j++) pair(0, j);
  for (let i = 1; i < nl; i++) pair(i, nl);
  const f = (c: Counts) =>
    Object.entries(c)
      .map(([el, k]) => `${el}${k === 1 ? "" : k}`)
      .join("");
  const species = atoms.map(f);
  return `${species.slice(0, nl).join(" + ")} -> ${species.slice(nl).join(" + ")}`;
}

/** Plain-text formula with subscript digits, for labels: "CO2" → "CO₂". */
export const sub = (f: string) => f.replace(/[0-9]/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);

const DIATOMIC = ["H2", "N2", "O2", "F2", "Cl2", "Br2", "I2"];
const NAME: Record<string, Text> = {
  H: tx("Hydrogen", "Wasserstoff"),
  N: tx("Nitrogen", "Stickstoff"),
  O: tx("Oxygen", "Sauerstoff"),
  F: tx("Fluorine", "Fluor"),
  Cl: tx("Chlorine", "Chlor"),
  Br: tx("Bromine", "Brom"),
  I: tx("Iodine", "Iod"),
};

/** Rebuild a formula from counts in a fixed order (for simulated "wrong" species only). */
const fromCounts = (c: Counts) =>
  Object.entries(c)
    .filter(([, k]) => k > 0)
    .map(([el, k]) => `${el}${k === 1 ? "" : k}`)
    .join("");

/** Typical balancing slips for this reaction, each with the exact coefficients it leads to. */
export function balanceMistakes(r: { eq: string; coefs: number[]; units?: string[]; kind?: ReactionKind }, opts: { half?: Strategy["half"] } = {}): Mistake[] {
  const out: Mistake[] = [];
  const p = parts(r.eq);
  const nl = p.left.length;
  const species = [...p.left, ...p.right];
  const orig = parseEquation(r.eq)!;
  const add = (coefs: number[] | null, alt: string | null, title: Text, say: Text, close = false) => {
    if (!coefs || !alt) return;
    if (coefs.length !== species.length || sameCoefs(coefs, r.coefs)) return;
    if (!unbalanced(orig, coefs).length) return; // a multiple of the right answer: the checker says so itself
    if (out.some((m) => m.when.kind === "balance" && sameCoefs(m.when.coefficients, coefs))) return;
    out.push({ when: { kind: "balance", equation: alt, coefficients: coefs }, title, say, close });
  };
  const swap = (i: number, formula: string) => {
    const s = [...species];
    s[i] = formula;
    return `${s.slice(0, nl).join(" + ")} -> ${s.slice(nl).join(" + ")}`;
  };
  const viaAlt = (alt: string) => {
    const c = solve(alt);
    return c ? { c, alt } : null;
  };

  // 1. A half got removed, but only at one species.
  const half = opts.half;
  if (half && half.den === 2 && half.num > 1) {
    const c = half.before.map((x, i) => (i === half.index ? half.num : x));
    add(
      c,
      exactly(c, nl),
      tx("Only one number doubled", "Nur eine Zahl verdoppelt"),
      tx(
        `You got rid of the half at $\\ce{${species[half.index]}}$, good idea! But doubling means **every** coefficient doubles, the others too.`,
        `Den Bruch bei $\\ce{${species[half.index]}}$ wegzubekommen ist die richtige Idee! Aber verdoppeln heißt: **Jeder** Koeffizient wird verdoppelt, auch die anderen.`,
      ),
      true,
    );
  }

  // 2. A diatomic element counted as single atoms.
  species.forEach((s, i) => {
    if (!DIATOMIC.includes(s)) return;
    const el = s.slice(0, -1);
    const v = viaAlt(swap(i, el));
    if (!v) return;
    const name = NAME[el];
    add(
      v.c,
      v.alt,
      tx(`${sub(s)} comes in pairs`, `${sub(s)} im Doppelpack`),
      txMap(
        (t, l) =>
          `${t(
            `I think you counted $\\ce{${s}}$ as a single ${el} atom. ${typeof name === "string" ? name : name[l]} comes in pairs: every $\\ce{${s}}$ brings **two** atoms. Count again with that.`,
            `Ich glaub, du hast $\\ce{${s}}$ wie ein einzelnes ${el}-Atom gezählt. ${typeof name === "string" ? name : name[l]} kommt im Doppelpack: Jedes $\\ce{${s}}$ bringt **zwei** Atome mit. Zähl damit noch mal.`,
          )}`,
      ),
    );
  });

  // 3. An O or H atom overlooked where it shows up in two products (or two reactants).
  for (const el of ["O", "H"]) {
    for (const [from, to] of [
      [0, nl],
      [nl, species.length],
    ]) {
      const holders = species.map((s, i) => ({ s, i, c: countsOf(s) })).filter((x) => x.i >= from && x.i < to && (x.c[el] ?? 0) > 0);
      if (holders.length < 2) continue;
      for (const h of holders) {
        if (Object.keys(h.c).length < 2) continue;
        const v = viaAlt(swap(h.i, fromCounts({ ...h.c, [el]: 0 })));
        if (!v) continue;
        const others = holders.filter((x) => x.i !== h.i).map((x) => `$\\ce{${x.s}}$`);
        add(
          v.c,
          v.alt,
          tx(`Missed the ${el} in ${sub(h.s)}`, `${el} in ${sub(h.s)} übersehen`),
          tx(
            `Nearly! When you counted ${el}, did you skip the ${el} in $\\ce{${h.s}}$? On that side ${el} sits in ${others.join(" and ")} **and** in $\\ce{${h.s}}$.`,
            `Fast! Hast du beim Zählen der ${el}-Atome das ${el} in $\\ce{${h.s}}$ übersehen? Auf dieser Seite steckt ${el} in ${others.join(" und ")} **und** in $\\ce{${h.s}}$.`,
          ),
          true,
        );
      }
    }
  }

  // 4. The number after a bracket only counted once.
  species.forEach((s, i) => {
    const m = s.match(/\(([A-Za-z0-9]+)\)(\d+)/);
    if (!m) return;
    const v = viaAlt(swap(i, s.replace(m[0], m[1])));
    if (!v) return;
    add(
      v.c,
      v.alt,
      tx("Bracket factor missed", "Faktor hinter der Klammer"),
      tx(
        `Careful with $\\ce{${s}}$: the ${m[2]} after the bracket counts for the **whole** group. That's ${m[2]} times $\\ce{${m[1]}}$, not just one.`,
        `Vorsicht bei $\\ce{${s}}$: Die ${m[2]} hinter der Klammer gilt für die **ganze** Gruppe. Das sind ${m[2]}-mal $\\ce{${m[1]}}$, nicht nur eine.`,
      ),
    );
  });

  // 5. Neutralisation: one water molecule, whatever happens.
  if (r.kind === "neutralisation") {
    const w = species.indexOf("H2O");
    if (w >= 0 && r.coefs[w] !== 1) {
      const c = r.coefs.map((x, i) => (i === w ? 1 : x));
      const g = gcdOf(c);
      add(
        c.map((x) => x / g),
        exactly(
          c.map((x) => x / g),
          nl,
        ),
        tx("How much water?", "Wie viel Wasser?"),
        tx(
          "Almost! In a neutralisation, **each** H from the acid meets one OH from the base and forms one water molecule. So count the OH groups: that's how many $\\ce{H2O}$ you need.",
          "Fast! Bei einer Neutralisation trifft **jedes** H der Säure auf ein OH der Base und bildet ein Wassermolekül. Zähl also die OH-Gruppen: So viele $\\ce{H2O}$ brauchst du.",
        ),
      );
    }
  }
  return out;
}
