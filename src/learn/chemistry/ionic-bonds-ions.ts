// Ions and salts for the ionic-bonds topic: which ion an element forms, the common
// polyatomic ions, salt formulas from charges (smallest ratio, brackets) and salt names
// in German and English ("Eisen(III)-oxid" / "iron(III) oxide").

import { tx, type Text } from "@/i18n/text";
import { lcm } from "@/learn/engine/rng";
import { element, mainGroup, shells } from "./elements";

export type Ion = {
  id: string;
  /** Formula without the charge: "Na", "Fe", "SO4". */
  f: string;
  charge: number;
  /** Made of several atoms: needs brackets when there is more than one. */
  poly?: boolean;
  /** Cation: "sodium" / "Natrium"; anion: "chloride" / "Chlorid". */
  name: Text;
  /** Other accepted spellings of the name. */
  alt?: Text[];
  /** The name carries the charge as a Roman numeral: iron(III). */
  roman?: boolean;
  /** Element name for monatomic anions ("chlorine" / "Chlor"), for the "element name" slip. */
  elementName?: Text;
};

const cat = (id: string, f: string, charge: number, en: string, de: string, extra: Partial<Ion> = {}): Ion => ({ id, f, charge, name: tx(en, de), ...extra });
const an = (id: string, f: string, charge: number, en: string, de: string, extra: Partial<Ion> = {}): Ion => ({ id, f, charge, name: tx(en, de), ...extra });

export const CATIONS: Record<string, Ion> = {
  Li: cat("Li", "Li", 1, "lithium", "Lithium"),
  Na: cat("Na", "Na", 1, "sodium", "Natrium"),
  K: cat("K", "K", 1, "potassium", "Kalium"),
  Mg: cat("Mg", "Mg", 2, "magnesium", "Magnesium"),
  Ca: cat("Ca", "Ca", 2, "calcium", "Calcium", { alt: [tx("calcium", "Kalzium")] }),
  Ba: cat("Ba", "Ba", 2, "barium", "Barium"),
  Al: cat("Al", "Al", 3, "aluminium", "Aluminium", { alt: [tx("aluminum", "Aluminium")] }),
  Zn: cat("Zn", "Zn", 2, "zinc", "Zink"),
  Ag: cat("Ag", "Ag", 1, "silver", "Silber"),
  Fe2: cat("Fe2", "Fe", 2, "iron(II)", "Eisen(II)", { roman: true }),
  Fe3: cat("Fe3", "Fe", 3, "iron(III)", "Eisen(III)", { roman: true }),
  Cu1: cat("Cu1", "Cu", 1, "copper(I)", "Kupfer(I)", { roman: true }),
  Cu2: cat("Cu2", "Cu", 2, "copper(II)", "Kupfer(II)", { roman: true }),
  Pb2: cat("Pb2", "Pb", 2, "lead(II)", "Blei(II)", { roman: true }),
  NH4: cat("NH4", "NH4", 1, "ammonium", "Ammonium", { poly: true }),
};

export const ANIONS: Record<string, Ion> = {
  F: an("F", "F", -1, "fluoride", "Fluorid", { elementName: tx("fluorine", "Fluor") }),
  Cl: an("Cl", "Cl", -1, "chloride", "Chlorid", { elementName: tx("chlorine", "Chlor") }),
  Br: an("Br", "Br", -1, "bromide", "Bromid", { elementName: tx("bromine", "Brom") }),
  I: an("I", "I", -1, "iodide", "Iodid", { alt: [tx("iodide", "Jodid")], elementName: tx("iodine", "Iod") }),
  O: an("O", "O", -2, "oxide", "Oxid", { elementName: tx("oxygen", "Sauerstoff") }),
  S: an("S", "S", -2, "sulfide", "Sulfid", { alt: [tx("sulphide", "Sulfid")], elementName: tx("sulfur", "Schwefel") }),
  N: an("N", "N", -3, "nitride", "Nitrid", { elementName: tx("nitrogen", "Stickstoff") }),
  OH: an("OH", "OH", -1, "hydroxide", "Hydroxid", { poly: true }),
  NO3: an("NO3", "NO3", -1, "nitrate", "Nitrat", { poly: true }),
  SO4: an("SO4", "SO4", -2, "sulfate", "Sulfat", { poly: true, alt: [tx("sulphate", "Sulfat")] }),
  CO3: an("CO3", "CO3", -2, "carbonate", "Carbonat", { poly: true, alt: [tx("carbonate", "Karbonat")] }),
  PO4: an("PO4", "PO4", -3, "phosphate", "Phosphat", { poly: true }),
};

/** Look-alike anion names that are a different ion (Sulfid vs Sulfat): [right id, wrong name]. */
export const CONFUSED_ANION: Record<string, Text> = {
  S: tx("sulfate", "Sulfat"),
  SO4: tx("sulfide", "Sulfid"),
  N: tx("nitrate", "Nitrat"),
  NO3: tx("nitride", "Nitrid"),
  Cl: tx("chlorate", "Chlorat"),
  CO3: tx("carbide", "Carbid"),
};

/** "+", "-", "^2+", "^3-": the charge as written after a formula (parser and \ce). */
export function chargeSuffix(charge: number): string {
  if (charge === 0) return "";
  const sign = charge > 0 ? "+" : "-";
  return Math.abs(charge) === 1 ? sign : `^${Math.abs(charge)}${sign}`;
}

/** "Mg^2+", "SO4^2-", "Na+". */
export const ionFormula = (ion: Pick<Ion, "f" | "charge">) => `${ion.f}${chargeSuffix(ion.charge)}`;
/** Display source: "\ce{SO4^2-}". */
export const ionCe = (ion: Pick<Ion, "f" | "charge">) => `\\ce{${ionFormula(ion)}}`;

/** One ion taken n times inside a formula: "Na2", "(OH)2", "SO4". */
export function part(ion: Pick<Ion, "f" | "poly">, n: number): string {
  if (n === 1) return ion.f;
  return ion.poly ? `(${ion.f})${n}` : `${ion.f}${n}`;
}

export type Salt = { cat: Ion; an: Ion; nc: number; na: number; formula: string; lcm: number };

/** The neutral salt from a cation and an anion, smallest whole-number ratio. */
export function salt(catId: string, anId: string): Salt {
  const c = CATIONS[catId];
  const a = ANIONS[anId];
  if (!c || !a) throw new Error(`Unknown ion ${catId} / ${anId}`);
  const l = lcm(c.charge, -a.charge);
  const nc = l / c.charge;
  const na = l / -a.charge;
  return { cat: c, an: a, nc, na, formula: part(c, nc) + part(a, na), lcm: l };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "sodium chloride" / "Natriumchlorid", "iron(III) oxide" / "Eisen(III)-oxid". */
export function nameOf(c: Ion, a: Ion, cName: Text = c.name, aName: Text = a.name): Text {
  const en = (t: Text) => (typeof t === "string" ? t : t.en);
  const de = (t: Text) => (typeof t === "string" ? t : t.de);
  return tx(`${en(cName)} ${en(aName)}`, `${de(cName)}${c.roman ? "-" : ""}${lowerFirst(de(aName))}`);
}

export const saltName = (s: Salt) => nameOf(s.cat, s.an);

/** Every accepted spelling of a salt's name (both languages, older spellings). */
export function saltNames(s: Salt): Text[] {
  const out: Text[] = [];
  for (const c of [s.cat.name, ...(s.cat.alt ?? [])]) for (const a of [s.an.name, ...(s.an.alt ?? [])]) out.push(nameOf(s.cat, s.an, c, a));
  return out;
}

// ---------------------------------------------------------------------------
// Curated salts (all real compounds students meet in class)

const pairs = (list: string) => list.split(" ").map((p) => p.split("+") as [string, string]);

/** Main-group salts of two elements. */
export const BINARY = pairs(
  "Na+Cl K+Cl Li+Cl Na+Br K+Br Li+Br Na+I K+I Na+F K+F Li+F Mg+Cl Ca+Cl Ba+Cl Ca+Br Mg+F Ca+F Mg+O Ca+O Ba+O Na+O K+O Li+O K+S Al+O Al+F Li+N Mg+N Ca+N",
);

/** Salts with polyatomic ions and a fixed-charge cation, at most one bracket. */
export const POLY_SIMPLE = pairs(
  "Na+OH K+OH Li+OH Ca+OH Mg+OH Ba+OH Na+NO3 K+NO3 Ag+NO3 Ca+NO3 Mg+NO3 Ba+NO3 Zn+NO3 Na+SO4 K+SO4 Mg+SO4 Ca+SO4 Ba+SO4 Zn+SO4 Na+CO3 K+CO3 Ca+CO3 Mg+CO3 Li+CO3 Na+PO4 K+PO4 NH4+Cl NH4+NO3 NH4+Br",
);

/** Harder ones: brackets and a common multiple, ammonium, Roman numerals. */
export const POLY_HARD = pairs(
  "Al+SO4 Ca+PO4 Mg+PO4 Ba+PO4 NH4+SO4 NH4+PO4 NH4+CO3 Al+OH Al+NO3 Al+PO4 Fe3+SO4 Fe3+OH Fe2+OH Fe3+NO3 Fe3+PO4 Fe2+SO4 Cu2+SO4 Cu2+NO3 Cu2+OH Pb2+NO3 Ag+PO4 Ag+SO4 Ag+CO3",
);

/** Salts of metals with several possible charges (named with a Roman numeral). */
export const ROMAN = pairs(
  "Fe2+Cl Fe3+Cl Fe2+O Fe3+O Cu2+O Cu1+O Cu2+Cl Cu1+Cl Fe2+S Cu2+S Cu1+S Pb2+O Pb2+Cl Fe2+SO4 Fe3+SO4 Cu2+SO4 Cu2+NO3 Fe3+OH Fe2+OH Cu2+OH Pb2+NO3 Fe3+NO3 Fe3+PO4",
);

// ---------------------------------------------------------------------------
// Atoms becoming ions

export type AtomIon = { symbol: string; z: number; group: number; charge: number; shells: number[]; name: Text };

/** Main-group elements that form simple ions in school chemistry. */
export const ION_ELEMENTS = ["Li", "Na", "K", "Mg", "Ca", "Ba", "Al", "N", "P", "O", "S", "F", "Cl", "Br", "I"];

/** The ion a main-group element forms: groups I–III give electrons, V–VII take them. */
export function atomIon(symbol: string): AtomIon {
  const e = element(symbol);
  if (!e) throw new Error(`Unknown element ${symbol}`);
  const g = mainGroup(e) ?? 0;
  const charge = g <= 3 ? g : g - 8;
  return { symbol, z: e.z, group: g, charge, shells: shells(e.z), name: e.name };
}

/** Noble gas with the same electron count (He, Ne, Ar, Kr, Xe). */
export const NOBLE: { symbol: string; z: number; name: Text }[] = ["He", "Ne", "Ar", "Kr", "Xe"].map((s) => ({ symbol: s, z: element(s)!.z, name: element(s)!.name }));

export const nobleFor = (electrons: number) => NOBLE.find((n) => n.z === electrons);

export const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
