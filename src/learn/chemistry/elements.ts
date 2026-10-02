// The periodic table: every element with its German and English name, standard atomic
// mass (rounded as in school tables; radioactive elements use their most stable isotope),
// position and Pauling electronegativity where defined.

import { tx, type Text } from "@/i18n/text";

export type Category =
  | "alkali"
  | "alkaline-earth"
  | "transition"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide"
  | "unknown";

export type Element = {
  z: number;
  symbol: string;
  name: Text;
  /** Atomic mass in u (= molar mass in g/mol). */
  mass: number;
  /** IUPAC group 1–18; null for lanthanides/actinides (f-block). */
  group: number | null;
  period: number;
  category: Category;
  /** Pauling electronegativity, when defined. */
  en: number | null;
};

type Row = [number, string, string, string, number, number | null, number, Category, number | null];

// prettier-ignore
const ROWS: Row[] = [
  [1, "H", "Hydrogen", "Wasserstoff", 1.008, 1, 1, "nonmetal", 2.2],
  [2, "He", "Helium", "Helium", 4.003, 18, 1, "noble-gas", null],
  [3, "Li", "Lithium", "Lithium", 6.94, 1, 2, "alkali", 0.98],
  [4, "Be", "Beryllium", "Beryllium", 9.012, 2, 2, "alkaline-earth", 1.57],
  [5, "B", "Boron", "Bor", 10.81, 13, 2, "metalloid", 2.04],
  [6, "C", "Carbon", "Kohlenstoff", 12.011, 14, 2, "nonmetal", 2.55],
  [7, "N", "Nitrogen", "Stickstoff", 14.007, 15, 2, "nonmetal", 3.04],
  [8, "O", "Oxygen", "Sauerstoff", 15.999, 16, 2, "nonmetal", 3.44],
  [9, "F", "Fluorine", "Fluor", 18.998, 17, 2, "halogen", 3.98],
  [10, "Ne", "Neon", "Neon", 20.18, 18, 2, "noble-gas", null],
  [11, "Na", "Sodium", "Natrium", 22.99, 1, 3, "alkali", 0.93],
  [12, "Mg", "Magnesium", "Magnesium", 24.305, 2, 3, "alkaline-earth", 1.31],
  [13, "Al", "Aluminium", "Aluminium", 26.982, 13, 3, "post-transition", 1.61],
  [14, "Si", "Silicon", "Silicium", 28.085, 14, 3, "metalloid", 1.9],
  [15, "P", "Phosphorus", "Phosphor", 30.974, 15, 3, "nonmetal", 2.19],
  [16, "S", "Sulfur", "Schwefel", 32.06, 16, 3, "nonmetal", 2.58],
  [17, "Cl", "Chlorine", "Chlor", 35.45, 17, 3, "halogen", 3.16],
  [18, "Ar", "Argon", "Argon", 39.948, 18, 3, "noble-gas", null],
  [19, "K", "Potassium", "Kalium", 39.098, 1, 4, "alkali", 0.82],
  [20, "Ca", "Calcium", "Calcium", 40.078, 2, 4, "alkaline-earth", 1.0],
  [21, "Sc", "Scandium", "Scandium", 44.956, 3, 4, "transition", 1.36],
  [22, "Ti", "Titanium", "Titan", 47.867, 4, 4, "transition", 1.54],
  [23, "V", "Vanadium", "Vanadium", 50.942, 5, 4, "transition", 1.63],
  [24, "Cr", "Chromium", "Chrom", 51.996, 6, 4, "transition", 1.66],
  [25, "Mn", "Manganese", "Mangan", 54.938, 7, 4, "transition", 1.55],
  [26, "Fe", "Iron", "Eisen", 55.845, 8, 4, "transition", 1.83],
  [27, "Co", "Cobalt", "Cobalt", 58.933, 9, 4, "transition", 1.88],
  [28, "Ni", "Nickel", "Nickel", 58.693, 10, 4, "transition", 1.91],
  [29, "Cu", "Copper", "Kupfer", 63.546, 11, 4, "transition", 1.9],
  [30, "Zn", "Zinc", "Zink", 65.38, 12, 4, "transition", 1.65],
  [31, "Ga", "Gallium", "Gallium", 69.723, 13, 4, "post-transition", 1.81],
  [32, "Ge", "Germanium", "Germanium", 72.63, 14, 4, "metalloid", 2.01],
  [33, "As", "Arsenic", "Arsen", 74.922, 15, 4, "metalloid", 2.18],
  [34, "Se", "Selenium", "Selen", 78.971, 16, 4, "nonmetal", 2.55],
  [35, "Br", "Bromine", "Brom", 79.904, 17, 4, "halogen", 2.96],
  [36, "Kr", "Krypton", "Krypton", 83.798, 18, 4, "noble-gas", 3.0],
  [37, "Rb", "Rubidium", "Rubidium", 85.468, 1, 5, "alkali", 0.82],
  [38, "Sr", "Strontium", "Strontium", 87.62, 2, 5, "alkaline-earth", 0.95],
  [39, "Y", "Yttrium", "Yttrium", 88.906, 3, 5, "transition", 1.22],
  [40, "Zr", "Zirconium", "Zirconium", 91.224, 4, 5, "transition", 1.33],
  [41, "Nb", "Niobium", "Niob", 92.906, 5, 5, "transition", 1.6],
  [42, "Mo", "Molybdenum", "Molybdän", 95.95, 6, 5, "transition", 2.16],
  [43, "Tc", "Technetium", "Technetium", 98, 7, 5, "transition", 1.9],
  [44, "Ru", "Ruthenium", "Ruthenium", 101.07, 8, 5, "transition", 2.2],
  [45, "Rh", "Rhodium", "Rhodium", 102.91, 9, 5, "transition", 2.28],
  [46, "Pd", "Palladium", "Palladium", 106.42, 10, 5, "transition", 2.2],
  [47, "Ag", "Silver", "Silber", 107.87, 11, 5, "transition", 1.93],
  [48, "Cd", "Cadmium", "Cadmium", 112.41, 12, 5, "transition", 1.69],
  [49, "In", "Indium", "Indium", 114.82, 13, 5, "post-transition", 1.78],
  [50, "Sn", "Tin", "Zinn", 118.71, 14, 5, "post-transition", 1.96],
  [51, "Sb", "Antimony", "Antimon", 121.76, 15, 5, "metalloid", 2.05],
  [52, "Te", "Tellurium", "Tellur", 127.6, 16, 5, "metalloid", 2.1],
  [53, "I", "Iodine", "Iod", 126.9, 17, 5, "halogen", 2.66],
  [54, "Xe", "Xenon", "Xenon", 131.29, 18, 5, "noble-gas", 2.6],
  [55, "Cs", "Caesium", "Caesium", 132.91, 1, 6, "alkali", 0.79],
  [56, "Ba", "Barium", "Barium", 137.33, 2, 6, "alkaline-earth", 0.89],
  [57, "La", "Lanthanum", "Lanthan", 138.91, null, 6, "lanthanide", 1.1],
  [58, "Ce", "Cerium", "Cer", 140.12, null, 6, "lanthanide", 1.12],
  [59, "Pr", "Praseodymium", "Praseodym", 140.91, null, 6, "lanthanide", 1.13],
  [60, "Nd", "Neodymium", "Neodym", 144.24, null, 6, "lanthanide", 1.14],
  [61, "Pm", "Promethium", "Promethium", 145, null, 6, "lanthanide", null],
  [62, "Sm", "Samarium", "Samarium", 150.36, null, 6, "lanthanide", 1.17],
  [63, "Eu", "Europium", "Europium", 151.96, null, 6, "lanthanide", null],
  [64, "Gd", "Gadolinium", "Gadolinium", 157.25, null, 6, "lanthanide", 1.2],
  [65, "Tb", "Terbium", "Terbium", 158.93, null, 6, "lanthanide", null],
  [66, "Dy", "Dysprosium", "Dysprosium", 162.5, null, 6, "lanthanide", 1.22],
  [67, "Ho", "Holmium", "Holmium", 164.93, null, 6, "lanthanide", 1.23],
  [68, "Er", "Erbium", "Erbium", 167.26, null, 6, "lanthanide", 1.24],
  [69, "Tm", "Thulium", "Thulium", 168.93, null, 6, "lanthanide", 1.25],
  [70, "Yb", "Ytterbium", "Ytterbium", 173.05, null, 6, "lanthanide", null],
  [71, "Lu", "Lutetium", "Lutetium", 174.97, null, 6, "lanthanide", 1.27],
  [72, "Hf", "Hafnium", "Hafnium", 178.49, 4, 6, "transition", 1.3],
  [73, "Ta", "Tantalum", "Tantal", 180.95, 5, 6, "transition", 1.5],
  [74, "W", "Tungsten", "Wolfram", 183.84, 6, 6, "transition", 2.36],
  [75, "Re", "Rhenium", "Rhenium", 186.21, 7, 6, "transition", 1.9],
  [76, "Os", "Osmium", "Osmium", 190.23, 8, 6, "transition", 2.2],
  [77, "Ir", "Iridium", "Iridium", 192.22, 9, 6, "transition", 2.2],
  [78, "Pt", "Platinum", "Platin", 195.08, 10, 6, "transition", 2.28],
  [79, "Au", "Gold", "Gold", 196.97, 11, 6, "transition", 2.54],
  [80, "Hg", "Mercury", "Quecksilber", 200.59, 12, 6, "transition", 2.0],
  [81, "Tl", "Thallium", "Thallium", 204.38, 13, 6, "post-transition", 1.62],
  [82, "Pb", "Lead", "Blei", 207.2, 14, 6, "post-transition", 2.33],
  [83, "Bi", "Bismuth", "Bismut", 208.98, 15, 6, "post-transition", 2.02],
  [84, "Po", "Polonium", "Polonium", 209, 16, 6, "post-transition", 2.0],
  [85, "At", "Astatine", "Astat", 210, 17, 6, "halogen", 2.2],
  [86, "Rn", "Radon", "Radon", 222, 18, 6, "noble-gas", null],
  [87, "Fr", "Francium", "Francium", 223, 1, 7, "alkali", 0.7],
  [88, "Ra", "Radium", "Radium", 226, 2, 7, "alkaline-earth", 0.9],
  [89, "Ac", "Actinium", "Actinium", 227, null, 7, "actinide", 1.1],
  [90, "Th", "Thorium", "Thorium", 232.04, null, 7, "actinide", 1.3],
  [91, "Pa", "Protactinium", "Protactinium", 231.04, null, 7, "actinide", 1.5],
  [92, "U", "Uranium", "Uran", 238.03, null, 7, "actinide", 1.38],
  [93, "Np", "Neptunium", "Neptunium", 237, null, 7, "actinide", 1.36],
  [94, "Pu", "Plutonium", "Plutonium", 244, null, 7, "actinide", 1.28],
  [95, "Am", "Americium", "Americium", 243, null, 7, "actinide", 1.3],
  [96, "Cm", "Curium", "Curium", 247, null, 7, "actinide", 1.3],
  [97, "Bk", "Berkelium", "Berkelium", 247, null, 7, "actinide", 1.3],
  [98, "Cf", "Californium", "Californium", 251, null, 7, "actinide", 1.3],
  [99, "Es", "Einsteinium", "Einsteinium", 252, null, 7, "actinide", 1.3],
  [100, "Fm", "Fermium", "Fermium", 257, null, 7, "actinide", 1.3],
  [101, "Md", "Mendelevium", "Mendelevium", 258, null, 7, "actinide", 1.3],
  [102, "No", "Nobelium", "Nobelium", 259, null, 7, "actinide", 1.3],
  [103, "Lr", "Lawrencium", "Lawrencium", 266, null, 7, "actinide", 1.3],
  [104, "Rf", "Rutherfordium", "Rutherfordium", 267, 4, 7, "transition", null],
  [105, "Db", "Dubnium", "Dubnium", 268, 5, 7, "transition", null],
  [106, "Sg", "Seaborgium", "Seaborgium", 269, 6, 7, "transition", null],
  [107, "Bh", "Bohrium", "Bohrium", 270, 7, 7, "transition", null],
  [108, "Hs", "Hassium", "Hassium", 269, 8, 7, "transition", null],
  [109, "Mt", "Meitnerium", "Meitnerium", 278, 9, 7, "unknown", null],
  [110, "Ds", "Darmstadtium", "Darmstadtium", 281, 10, 7, "unknown", null],
  [111, "Rg", "Roentgenium", "Roentgenium", 282, 11, 7, "unknown", null],
  [112, "Cn", "Copernicium", "Copernicium", 285, 12, 7, "unknown", null],
  [113, "Nh", "Nihonium", "Nihonium", 286, 13, 7, "unknown", null],
  [114, "Fl", "Flerovium", "Flerovium", 289, 14, 7, "unknown", null],
  [115, "Mc", "Moscovium", "Moscovium", 290, 15, 7, "unknown", null],
  [116, "Lv", "Livermorium", "Livermorium", 293, 16, 7, "unknown", null],
  [117, "Ts", "Tennessine", "Tenness", 294, 17, 7, "unknown", null],
  [118, "Og", "Oganesson", "Oganesson", 294, 18, 7, "unknown", null],
];

export const ELEMENTS: Element[] = ROWS.map(([z, symbol, en, de, mass, group, period, category, eneg]) => ({
  z,
  symbol,
  name: tx(en, de),
  mass,
  group,
  period,
  category,
  en: eneg,
}));

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));
export const element = (symbol: string) => BY_SYMBOL.get(symbol);
export const byNumber = (z: number) => ELEMENTS[z - 1];

export const CATEGORY_NAMES: Record<Category, Text> = {
  alkali: tx("Alkali metals", "Alkalimetalle"),
  "alkaline-earth": tx("Alkaline earth metals", "Erdalkalimetalle"),
  transition: tx("Transition metals", "Übergangsmetalle"),
  "post-transition": tx("Other metals", "Weitere Metalle"),
  metalloid: tx("Metalloids", "Halbmetalle"),
  nonmetal: tx("Nonmetals", "Nichtmetalle"),
  halogen: tx("Halogens", "Halogene"),
  "noble-gas": tx("Noble gases", "Edelgase"),
  lanthanide: tx("Lanthanides", "Lanthanoide"),
  actinide: tx("Actinides", "Actinoide"),
  unknown: tx("Unknown properties", "Unbekannte Eigenschaften"),
};

/** Main-group names as used in German schools (Hauptgruppen I–VIII). */
export const MAIN_GROUP_NAMES: Record<number, Text> = {
  1: tx("Alkali metals", "Alkalimetalle"),
  2: tx("Alkaline earth metals", "Erdalkalimetalle"),
  13: tx("Boron group", "Borgruppe"),
  14: tx("Carbon group", "Kohlenstoffgruppe"),
  15: tx("Nitrogen group", "Stickstoffgruppe"),
  16: tx("Chalcogens", "Chalkogene"),
  17: tx("Halogens", "Halogene"),
  18: tx("Noble gases", "Edelgase"),
};

/** Main group number I–VIII (1–8) for groups 1, 2, 13–18; null for transition metals. */
export function mainGroup(e: Element): number | null {
  if (e.group === 1 || e.group === 2) return e.group;
  if (e.group !== null && e.group >= 13) return e.group - 10;
  return null;
}

/** Outer (valence) electrons in the school model: main group number (He: 2). */
export function valenceElectrons(e: Element): number | null {
  if (e.z === 2) return 2;
  return mainGroup(e);
}

/**
 * Electrons per shell (K, L, M, …) in the shell model (Schalenmodell), filled in the usual
 * subshell order. Right for all main-group elements; a few transition metals differ by one.
 */
export function shells(z: number): number[] {
  const out: number[] = [];
  let left = z;
  for (const [n, cap] of SUBSHELLS) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    out[n - 1] = (out[n - 1] ?? 0) + k;
    left -= k;
  }
  return Array.from(out, (x) => x ?? 0);
}

/** Subshells in filling order (Madelung rule) as [shell number, capacity]: 1s 2s 2p 3s 3p 4s 3d 4p … */
const SUBSHELLS: [number, number][] = [
  [1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6], [5, 2], [4, 10], [5, 6], [6, 2], [4, 14], [5, 10], [6, 6], [7, 2], [5, 14], [6, 10], [7, 6],
];

/** Neutrons of the most common isotope (mass number − Z), from the rounded atomic mass. */
export const neutrons = (e: Element) => Math.round(e.mass) - e.z;
