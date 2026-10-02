// The mole: curated substances, molar masses with their step-by-step sums, and the number
// formatting the calculations need (fixed decimals, scientific notation, rounding rules).

import type { Locale } from "@/i18n/config";
import { tx, txMap, type Text } from "@/i18n/text";
import { element } from "./elements";
import { molarMass, parseFormula } from "./formula";

export const NA = 6.022e23;

/** Molar mass in g/mol from the table masses, rounded to two decimals as students write it. */
export function M(formula: string): number {
  const p = parseFormula(formula);
  if (!p.ok) throw new Error(`Bad formula ${formula}`);
  return Math.round(molarMass(p.species.counts) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Numbers

/** Fixed decimals in one language: fx(0.5, "de", 2) → "0,50". */
export const fx = (v: number, l: Locale, d: number) =>
  new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }).format(v);
export const fxText = (v: number, d: number): Text => txMap((_, l) => fx(v, l, d));

/** Decimals that give three significant figures (0,171 · 2,35 · 21,9 · 249). */
export const sig3 = (v: number) => Math.max(0, Math.min(4, 2 - Math.floor(Math.log10(Math.abs(v) || 1))));
export const roundTo = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** "Round to two decimal places." in both languages. */
export function roundText(d: number, grams = false): Text {
  if (d === 0) return grams ? tx("Round to whole grams.", "Runde auf ganze Gramm.") : tx("Round to a whole number.", "Runde auf eine ganze Zahl.");
  const de = ["", "eine Nachkommastelle", "zwei Nachkommastellen", "drei Nachkommastellen", "vier Nachkommastellen"][d];
  return tx(`Round to ${d} decimal place${d === 1 ? "" : "s"}.`, `Runde auf ${de}.`);
}

/** The engine's number tolerance is relative to max(1, |value|): turn an absolute one into it. */
export const tolerance = (value: number, abs: number) => abs / Math.max(1, Math.abs(value));

/** Accepted range: sensible rounding (half a unit of the asked place) or a slightly different table mass. */
export const answerTolerance = (value: number, d: number, rel = 0.006) => tolerance(value, Math.max(rel * Math.abs(value), 0.6 * 10 ** -d));

/** Scientific notation for the display language: "1,20 \\cdot 10^{24}". */
export function sci(v: number, l: Locale, digits = 2): string {
  if (v === 0) return "0";
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / 10 ** e;
  if (Number(m.toFixed(digits)) >= 10) {
    e += 1;
    m = v / 10 ** e;
  }
  return `${fx(m, l, digits)} \\cdot 10^{${e}}`;
}
export const sciText = (v: number, digits = 2): Text => txMap((_, l) => sci(v, l, digits));

// ---------------------------------------------------------------------------
// Molar mass as a sum: "2 \\cdot 1,008 + 15,999", brackets and hydrates kept

type Part = { el: string; n: number } | { group: Part[]; n: number; hydrate?: boolean };

/** Read a formula into parts, keeping brackets and the hydrate water as groups. */
export function formulaParts(f: string): Part[] {
  let i = 0;
  const s = f.replace(/[*•∙]/g, "·");
  const num = () => {
    let j = i;
    while (j < s.length && /[0-9]/.test(s[j])) j++;
    const n = j > i ? Number(s.slice(i, j)) : 1;
    i = j;
    return n;
  };
  const group = (close: string | null): Part[] => {
    const out: Part[] = [];
    while (i < s.length) {
      const c = s[i];
      if (close && c === close) {
        i++;
        return out;
      }
      if (c === "(") {
        i++;
        const inner = group(")");
        out.push({ group: inner, n: num() });
        continue;
      }
      if (c === "·") {
        i++;
        const k = num();
        out.push({ group: group(null), n: k, hydrate: true });
        return out;
      }
      let j = i + 1;
      while (j < s.length && /[a-z]/.test(s[j])) j++;
      const el = s.slice(i, j);
      i = j;
      out.push({ el, n: num() });
    }
    return out;
  };
  return group(null);
}

/**
 * Display source of the sum of atomic masses: "40,078 + 2 \\cdot (15,999 + 1,008)", or with
 * `units` each mass gets its "g/mol" (as in school books, and the line can wrap at each +).
 */
export function massSum(f: string, l: Locale, units = false): string {
  const mass = (el: string) => {
    const m = element(el)!.mass;
    return `${fx(m, l, Math.min(3, (String(m).split(".")[1] ?? "").length))}${units ? ' "g/mol"' : ""}`;
  };
  const walk = (parts: Part[], top: boolean): string =>
    parts
      .map((p) => {
        const term = "el" in p ? (p.n === 1 ? mass(p.el) : `${p.n} \\cdot ${mass(p.el)}`) : p.n === 1 ? walk(p.group, false) : `${p.n} \\cdot (${walk(p.group, false)})`;
        // Keep a number with its unit on one line.
        return top && units ? `\\group{${term}}` : term;
      })
      .join(" + ");
  return walk(formulaParts(f), true);
}
export const massSumText = (f: string): Text => txMap((_, l) => massSum(f, l));

/** Elements of a formula (for the atomic-mass chips). */
export const elementsOf = (f: string) => {
  const p = parseFormula(f);
  return p.ok ? Object.keys(p.species.counts) : [];
};

// ---------------------------------------------------------------------------
// Substances

export type ParticleKind = "molecule" | "atom" | "unit";
export type Substance = { f: string; name: Text; kind: ParticleKind; level: 1 | 2 | 3 };

const S = (f: string, en: string, de: string, kind: ParticleKind, level: 1 | 2 | 3): Substance => ({ f, name: tx(en, de), kind, level });

export const SUBSTANCES: Substance[] = [
  // Level 1: small molecules, elements, simple salts
  S("H2O", "water", "Wasser", "molecule", 1),
  S("CO2", "carbon dioxide", "Kohlenstoffdioxid", "molecule", 1),
  S("NH3", "ammonia", "Ammoniak", "molecule", 1),
  S("CH4", "methane", "Methan", "molecule", 1),
  S("O2", "oxygen", "Sauerstoff", "molecule", 1),
  S("N2", "nitrogen", "Stickstoff", "molecule", 1),
  S("Cl2", "chlorine", "Chlor", "molecule", 1),
  S("HCl", "hydrogen chloride", "Chlorwasserstoff", "molecule", 1),
  S("SO2", "sulfur dioxide", "Schwefeldioxid", "molecule", 1),
  S("NaCl", "sodium chloride", "Natriumchlorid", "unit", 1),
  S("MgO", "magnesium oxide", "Magnesiumoxid", "unit", 1),
  S("CaO", "calcium oxide", "Calciumoxid", "unit", 1),
  S("KCl", "potassium chloride", "Kaliumchlorid", "unit", 1),
  S("NaOH", "sodium hydroxide", "Natriumhydroxid", "unit", 1),
  S("Fe", "iron", "Eisen", "atom", 1),
  S("Cu", "copper", "Kupfer", "atom", 1),
  S("C", "carbon", "Kohlenstoff", "atom", 1),
  S("Al", "aluminium", "Aluminium", "atom", 1),
  // Level 2: more atoms and indices
  S("H2SO4", "sulfuric acid", "Schwefelsäure", "molecule", 2),
  S("HNO3", "nitric acid", "Salpetersäure", "molecule", 2),
  S("H3PO4", "phosphoric acid", "Phosphorsäure", "molecule", 2),
  S("C6H12O6", "glucose", "Glucose", "molecule", 2),
  S("C12H22O11", "sucrose (sugar)", "Saccharose (Haushaltszucker)", "molecule", 2),
  S("C2H5OH", "ethanol", "Ethanol", "molecule", 2),
  S("C3H8", "propane", "Propan", "molecule", 2),
  S("C4H10", "butane", "Butan", "molecule", 2),
  S("CaCO3", "calcium carbonate", "Calciumcarbonat", "unit", 2),
  S("Na2CO3", "sodium carbonate", "Natriumcarbonat", "unit", 2),
  S("NaHCO3", "sodium hydrogen carbonate", "Natriumhydrogencarbonat", "unit", 2),
  S("Al2O3", "aluminium oxide", "Aluminiumoxid", "unit", 2),
  S("Fe2O3", "iron(III) oxide", "Eisen(III)-oxid", "unit", 2),
  S("CaCl2", "calcium chloride", "Calciumchlorid", "unit", 2),
  S("MgCl2", "magnesium chloride", "Magnesiumchlorid", "unit", 2),
  S("CuSO4", "copper(II) sulfate", "Kupfer(II)-sulfat", "unit", 2),
  S("KNO3", "potassium nitrate", "Kaliumnitrat", "unit", 2),
  // Brackets
  S("Ca(OH)2", "calcium hydroxide", "Calciumhydroxid", "unit", 2),
  S("Mg(OH)2", "magnesium hydroxide", "Magnesiumhydroxid", "unit", 2),
  S("Al(OH)3", "aluminium hydroxide", "Aluminiumhydroxid", "unit", 2),
  S("Ca(NO3)2", "calcium nitrate", "Calciumnitrat", "unit", 2),
  S("Mg(NO3)2", "magnesium nitrate", "Magnesiumnitrat", "unit", 2),
  S("Al2(SO4)3", "aluminium sulfate", "Aluminiumsulfat", "unit", 2),
  S("(NH4)2SO4", "ammonium sulfate", "Ammoniumsulfat", "unit", 2),
  S("Ca3(PO4)2", "calcium phosphate", "Calciumphosphat", "unit", 2),
  S("Fe2(SO4)3", "iron(III) sulfate", "Eisen(III)-sulfat", "unit", 2),
  // Level 3: hydrates
  S("CuSO4*5H2O", "copper(II) sulfate pentahydrate (blue vitriol)", "Kupfer(II)-sulfat-Pentahydrat (Kupfervitriol)", "unit", 3),
  S("CaSO4*2H2O", "calcium sulfate dihydrate (gypsum)", "Calciumsulfat-Dihydrat (Gips)", "unit", 3),
  S("MgSO4*7H2O", "magnesium sulfate heptahydrate (Epsom salt)", "Magnesiumsulfat-Heptahydrat (Bittersalz)", "unit", 3),
  S("Na2CO3*10H2O", "sodium carbonate decahydrate (washing soda)", "Natriumcarbonat-Decahydrat (Kristallsoda)", "unit", 3),
  S("CaCl2*6H2O", "calcium chloride hexahydrate", "Calciumchlorid-Hexahydrat", "unit", 3),
];

export const substance = (f: string) => SUBSTANCES.find((s) => s.f === f)!;

/** "molecules" / "Moleküle" etc. */
export const PARTICLES: Record<ParticleKind, Text> = {
  molecule: tx("molecules", "Moleküle"),
  atom: tx("atoms", "Atome"),
  unit: tx("formula units", "Formeleinheiten"),
};

/** Display source of a formula for \\ce: hydrate star becomes the dot. */
export const ceF = (f: string) => `\\ce{${f}}`;
