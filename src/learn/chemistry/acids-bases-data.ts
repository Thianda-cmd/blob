// Acids and bases: indicators with their colours, the common acids with their anions, the
// hydroxides, salts from neutralisations and everyday solutions with their pH.

import { tx, type Text } from "@/i18n/text";

// ---------------------------------------------------------------------------
// Indicators. Colours per whole pH value 0–14 (simplified school colour charts).

export type IndicatorId = "universal" | "bromothymol" | "phenolphthalein" | "litmus";

export const COLOUR = {
  red: tx("red", "rot"),
  redOrange: tx("red-orange", "orangerot"),
  orange: tx("orange", "orange"),
  yellow: tx("yellow", "gelb"),
  green: tx("green", "grün"),
  blueGreen: tx("blue-green", "blaugrün"),
  blue: tx("blue", "blau"),
  violet: tx("violet", "violett"),
  redViolet: tx("red-violet", "rotviolett"),
  blueViolet: tx("blue-violet", "blauviolett"),
  colourless: tx("colourless", "farblos"),
  palePink: tx("pale pink", "zartrosa"),
  pink: tx("pink", "pink"),
} satisfies Record<string, Text>;

export type ColourId = keyof typeof COLOUR;

type Shade = { hex: string | null; name: ColourId };

const s = (hex: string | null, name: ColourId): Shade => ({ hex, name });

/** 15 shades for pH 0 to 14. `hex: null` means colourless. */
const SHADES: Record<IndicatorId, Shade[]> = {
  universal: [
    s("#c62839", "red"),
    s("#d0303a", "red"),
    s("#da463a", "red"),
    s("#e4682f", "redOrange"),
    s("#ec8d26", "orange"),
    s("#efab22", "orange"),
    s("#e2c72c", "yellow"),
    s("#76b649", "green"),
    s("#3ea488", "blueGreen"),
    s("#2f88c2", "blue"),
    s("#3567bf", "blue"),
    s("#574fb3", "violet"),
    s("#643fa5", "violet"),
    s("#683498", "violet"),
    s("#612b88", "violet"),
  ],
  bromothymol: [
    ...Array.from({ length: 7 }, () => s("#dcc22b", "yellow")),
    s("#62a84f", "green"),
    ...Array.from({ length: 7 }, () => s("#2f6fbe", "blue")),
  ],
  phenolphthalein: [
    ...Array.from({ length: 9 }, () => s(null, "colourless")),
    s("#eea2cb", "palePink"),
    ...Array.from({ length: 5 }, () => s("#d3338a", "pink")),
  ],
  litmus: [
    ...Array.from({ length: 5 }, () => s("#c6403d", "red")),
    s("#a6466f", "redViolet"),
    s("#85509e", "violet"),
    s("#85509e", "violet"),
    s("#6656aa", "blueViolet"),
    ...Array.from({ length: 6 }, () => s("#3d5db6", "blue")),
  ],
};

export const INDICATORS: { id: IndicatorId; name: Text; short: Text }[] = [
  { id: "universal", name: tx("universal indicator", "Universalindikator"), short: tx("Universal", "Universal") },
  { id: "bromothymol", name: tx("bromothymol blue", "Bromthymolblau"), short: tx("Bromothymol blue", "Bromthymolblau") },
  { id: "phenolphthalein", name: tx("phenolphthalein", "Phenolphthalein"), short: tx("Phenolphthalein", "Phenolphthalein") },
  { id: "litmus", name: tx("litmus", "Lackmus"), short: tx("Litmus", "Lackmus") },
];

export const indicator = (id: IndicatorId) => INDICATORS.find((i) => i.id === id)!;

/** The indicator's shade at a whole pH value (clamped to 0–14). */
export function shade(id: IndicatorId, ph: number) {
  const i = Math.max(0, Math.min(14, Math.round(ph)));
  const x = SHADES[id][i];
  return { hex: x.hex, name: COLOUR[x.name], id: x.name };
}

/** The colour in each range, as taught: acidic / neutral / alkaline. */
export const INDICATOR_RANGES: Record<IndicatorId, { acidic: ColourId; neutral: ColourId; alkaline: ColourId }> = {
  universal: { acidic: "red", neutral: "green", alkaline: "violet" },
  bromothymol: { acidic: "yellow", neutral: "green", alkaline: "blue" },
  phenolphthalein: { acidic: "colourless", neutral: "colourless", alkaline: "pink" },
  litmus: { acidic: "red", neutral: "violet", alkaline: "blue" },
};

// ---------------------------------------------------------------------------
// Solutions

export type Nature = "acidic" | "neutral" | "alkaline";

export const NATURE: Record<Nature, Text> = {
  acidic: tx("acidic", "sauer"),
  neutral: tx("neutral", "neutral"),
  alkaline: tx("alkaline (basic)", "alkalisch (basisch)"),
};

export const natureOf = (ph: number): Nature => (ph < 7 ? "acidic" : ph > 7 ? "alkaline" : "neutral");

/** Everyday solutions with their (approximate) pH; `label` is shown as written. */
export type Everyday = { name: Text; ph: number; label: Text; nature: Nature };

const E = (en: string, de: string, ph: number, label: Text): Everyday => ({ name: tx(en, de), ph, label, nature: natureOf(ph) });

/** One example for every whole pH value, used by the pH slider. */
export const PH_EXAMPLES: Everyday[] = [
  E("hydrochloric acid (1 mol/L)", "Salzsäure (1 mol/l)", 0, "0"),
  E("stomach acid", "Magensaft", 1, tx("about 1–2", "etwa 1–2")),
  E("lemon juice", "Zitronensaft", 2, tx("about 2–2.5", "etwa 2–2,5")),
  E("vinegar", "Essig", 3, tx("about 2.5–3", "etwa 2,5–3")),
  E("tomato juice", "Tomatensaft", 4, tx("about 4", "etwa 4")),
  E("black coffee", "schwarzer Kaffee", 5, tx("about 5", "etwa 5")),
  E("rainwater", "Regenwasser", 6, tx("about 5.6", "etwa 5,6")),
  E("pure water", "reines Wasser", 7, "7"),
  E("seawater", "Meerwasser", 8, tx("about 8", "etwa 8")),
  E("soapy water", "Seifenlauge", 9, tx("about 9–10", "etwa 9–10")),
  E("washing powder solution", "Waschmittellösung", 10, tx("about 10–11", "etwa 10–11")),
  E("household ammonia", "Salmiakgeist (Ammoniakwasser)", 11, tx("about 11–12", "etwa 11–12")),
  E("limewater", "Kalkwasser", 12, tx("about 12.4", "etwa 12,4")),
  E("drain cleaner", "Rohrreiniger", 13, tx("about 13–14", "etwa 13–14")),
  E("sodium hydroxide solution (1 mol/L)", "Natronlauge (1 mol/l)", 14, "14"),
];

/** Solutions whose nature is clear-cut, for "acidic, neutral or alkaline?" tasks. */
export const CLEAR_CUT: { name: Text; nature: Nature; why: Text }[] = [
  { name: tx("lemon juice", "Zitronensaft"), nature: "acidic", why: tx("It contains citric acid.", "Er enthält Citronensäure.") },
  { name: tx("vinegar", "Essig"), nature: "acidic", why: tx("It contains acetic acid.", "Er enthält Essigsäure.") },
  { name: tx("cola", "Cola"), nature: "acidic", why: tx("It contains phosphoric acid and carbonic acid.", "Sie enthält Phosphorsäure und Kohlensäure.") },
  { name: tx("stomach acid", "Magensaft"), nature: "acidic", why: tx("It contains hydrochloric acid.", "Er enthält Salzsäure.") },
  { name: tx("descaler for kettles", "Entkalker für den Wasserkocher"), nature: "acidic", why: tx("It contains an acid that dissolves limescale.", "Er enthält eine Säure, die Kalk auflöst.") },
  { name: tx("distilled water", "destilliertes Wasser"), nature: "neutral", why: tx("Pure water has exactly as many $\\ce{H3O+}$ as $\\ce{OH-}$ ions.", "Reines Wasser hat genau gleich viele $\\ce{H3O+}$- wie $\\ce{OH-}$-Ionen.") },
  { name: tx("table salt solution", "Kochsalzlösung"), nature: "neutral", why: tx("Sodium chloride is the salt of a neutralisation: neither acid nor base is left over.", "Natriumchlorid ist das Salz einer Neutralisation: Weder Säure noch Base ist übrig.") },
  { name: tx("sugar solution", "Zuckerlösung"), nature: "neutral", why: tx("Sugar neither gives nor takes protons.", "Zucker gibt keine Protonen ab und nimmt keine auf.") },
  { name: tx("soapy water", "Seifenlauge"), nature: "alkaline", why: tx("Soap solutions contain hydroxide ions.", "Seifenlösungen enthalten Hydroxid-Ionen.") },
  { name: tx("limewater", "Kalkwasser"), nature: "alkaline", why: tx("It is a solution of calcium hydroxide.", "Es ist eine Lösung von Calciumhydroxid.") },
  { name: tx("drain cleaner", "Rohrreiniger"), nature: "alkaline", why: tx("It contains sodium hydroxide.", "Er enthält Natriumhydroxid.") },
  { name: tx("glass cleaner with ammonia", "Glasreiniger mit Ammoniak"), nature: "alkaline", why: tx("Ammonia takes protons from water and forms hydroxide ions.", "Ammoniak nimmt Protonen vom Wasser auf, dabei entstehen Hydroxid-Ionen.") },
];

// ---------------------------------------------------------------------------
// Acids, their anions and salts

export type Acid = {
  formula: string;
  name: Text;
  /** Other accepted names (word answers). */
  alt: Text[];
  /** Protons the acid can give away. */
  protons: number;
  /** The anion after giving away all protons, with charge: "SO4^2-". */
  anion: string;
  /** The anion without charge, as it appears in salt formulas. */
  core: string;
  anionName: Text;
  /** For salt names: "chloride" / "chlorid". */
  stem: { en: string; de: string };
  /** The anion after giving away only the first proton (polyprotic acids). */
  half?: { formula: string; name: Text };
  /** A similar-sounding acid students mix it up with: name and formula. */
  lookalike?: { name: Text; formula: string };
  /** Where you meet it. */
  everyday: Text;
};

export const ACIDS: Acid[] = [
  {
    formula: "HCl",
    name: tx("hydrochloric acid", "Salzsäure"),
    alt: [tx("hydrogen chloride", "Chlorwasserstoff"), tx("hydrochloric acid", "Chlorwasserstoffsäure")],
    protons: 1,
    anion: "Cl-",
    core: "Cl",
    anionName: tx("chloride ion", "Chlorid-Ion"),
    stem: { en: "chloride", de: "chlorid" },
    lookalike: { name: tx("chloric acid", "Chlorsäure"), formula: "HClO3" },
    everyday: tx("in your stomach", "im Magensaft"),
  },
  {
    formula: "HNO3",
    name: tx("nitric acid", "Salpetersäure"),
    alt: [],
    protons: 1,
    anion: "NO3-",
    core: "NO3",
    anionName: tx("nitrate ion", "Nitrat-Ion"),
    stem: { en: "nitrate", de: "nitrat" },
    lookalike: { name: tx("nitrous acid", "Salpetrige Säure"), formula: "HNO2" },
    everyday: tx("for making fertilisers", "bei der Herstellung von Dünger"),
  },
  {
    formula: "H2SO4",
    name: tx("sulfuric acid", "Schwefelsäure"),
    alt: [tx("sulphuric acid", "Schwefelsäure")],
    protons: 2,
    anion: "SO4^2-",
    core: "SO4",
    anionName: tx("sulfate ion", "Sulfat-Ion"),
    stem: { en: "sulfate", de: "sulfat" },
    half: { formula: "HSO4-", name: tx("hydrogen sulfate ion", "Hydrogensulfat-Ion") },
    lookalike: { name: tx("sulfurous acid", "Schweflige Säure"), formula: "H2SO3" },
    everyday: tx("in car batteries", "in der Autobatterie"),
  },
  {
    formula: "H3PO4",
    name: tx("phosphoric acid", "Phosphorsäure"),
    alt: [],
    protons: 3,
    anion: "PO4^3-",
    core: "PO4",
    anionName: tx("phosphate ion", "Phosphat-Ion"),
    stem: { en: "phosphate", de: "phosphat" },
    half: { formula: "H2PO4-", name: tx("dihydrogen phosphate ion", "Dihydrogenphosphat-Ion") },
    everyday: tx("in cola", "in Cola"),
  },
  {
    formula: "H2CO3",
    name: tx("carbonic acid", "Kohlensäure"),
    alt: [],
    protons: 2,
    anion: "CO3^2-",
    core: "CO3",
    anionName: tx("carbonate ion", "Carbonat-Ion"),
    stem: { en: "carbonate", de: "carbonat" },
    half: { formula: "HCO3-", name: tx("hydrogen carbonate ion", "Hydrogencarbonat-Ion") },
    lookalike: { name: tx("carbon dioxide", "Kohlenstoffdioxid"), formula: "CO2" },
    everyday: tx("in sparkling water", "im Sprudelwasser"),
  },
  {
    formula: "CH3COOH",
    name: tx("acetic acid", "Essigsäure"),
    alt: [tx("ethanoic acid", "Ethansäure")],
    protons: 1,
    anion: "CH3COO-",
    core: "CH3COO",
    anionName: tx("acetate ion", "Acetat-Ion"),
    stem: { en: "acetate", de: "acetat" },
    lookalike: { name: tx("formic acid", "Ameisensäure"), formula: "HCOOH" },
    everyday: tx("in vinegar", "im Essig"),
  },
];

export const acid = (formula: string) => ACIDS.find((a) => a.formula === formula)!;

export type Base = {
  formula: string;
  name: Text;
  /** Name of its solution in water. */
  solution: Text;
  /** The metal cation (hydroxides only). */
  cation?: { symbol: string; charge: number; name: { en: string; de: string } };
  everyday: Text;
};

export const BASES: Base[] = [
  {
    formula: "NaOH",
    name: tx("sodium hydroxide", "Natriumhydroxid"),
    solution: tx("sodium hydroxide solution", "Natronlauge"),
    cation: { symbol: "Na", charge: 1, name: { en: "sodium", de: "Natrium" } },
    everyday: tx("in drain cleaner", "im Rohrreiniger"),
  },
  {
    formula: "KOH",
    name: tx("potassium hydroxide", "Kaliumhydroxid"),
    solution: tx("potassium hydroxide solution", "Kalilauge"),
    cation: { symbol: "K", charge: 1, name: { en: "potassium", de: "Kalium" } },
    everyday: tx("for making soft soap", "bei der Herstellung von Schmierseife"),
  },
  {
    formula: "Ca(OH)2",
    name: tx("calcium hydroxide", "Calciumhydroxid"),
    solution: tx("limewater", "Kalkwasser"),
    cation: { symbol: "Ca", charge: 2, name: { en: "calcium", de: "Calcium" } },
    everyday: tx("in lime mortar", "im Kalkmörtel"),
  },
  {
    formula: "Mg(OH)2",
    name: tx("magnesium hydroxide", "Magnesiumhydroxid"),
    solution: tx("milk of magnesia", "Magnesiamilch"),
    cation: { symbol: "Mg", charge: 2, name: { en: "magnesium", de: "Magnesium" } },
    everyday: tx("in tablets against heartburn", "in Tabletten gegen Sodbrennen"),
  },
  {
    formula: "NH3",
    name: tx("ammonia", "Ammoniak"),
    solution: tx("ammonia solution", "Ammoniakwasser"),
    everyday: tx("in glass cleaner", "im Glasreiniger"),
  },
];

export const base = (formula: string) => BASES.find((b) => b.formula === formula)!;
export const HYDROXIDES = BASES.filter((b) => b.cation);

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const n = (k: number) => (k === 1 ? "" : String(k));
const polyatomic = (core: string) => /[A-Z].*[A-Z]|\d/.test(core);

/** Cations and anions in a salt: charges cancel with the smallest numbers. */
export function saltCounts(b: Base, a: Acid) {
  const m = b.cation!.charge;
  const g = gcd(m, a.protons);
  return { cations: a.protons / g, anions: m / g };
}

/** Formula of the salt from a hydroxide and an acid: "Ca3(PO4)2", "CH3COONa", "(CH3COO)2Ca". */
export function saltFormula(b: Base, a: Acid, counts = saltCounts(b, a)): string {
  const cat = `${b.cation!.symbol}${n(counts.cations)}`;
  const an = counts.anions > 1 && polyatomic(a.core) ? `(${a.core})${counts.anions}` : `${a.core}${n(counts.anions)}`;
  return a.formula === "CH3COOH" ? `${an}${cat}` : `${cat}${an}`;
}

/** "Natriumchlorid" / "sodium chloride". */
export const saltName = (b: Base, a: Acid): Text => tx(`${b.cation!.name.en} ${a.stem.en}`, `${b.cation!.name.de}${a.stem.de}`);

/** Neutralisation of a hydroxide: "HCl + Ca(OH)2 -> CaCl2 + H2O" with its smallest coefficients. */
export function neutralisation(b: Base, a: Acid) {
  const { cations, anions } = saltCounts(b, a);
  const water = anions * a.protons;
  return { equation: `${a.formula} + ${b.formula} -> ${saltFormula(b, a)} + H2O`, coefficients: [anions, cations, 1, water], water };
}

/** Ammonia neutralisations: ammonium salts, no water. */
export const AMMONIUM: { acid: string; equation: string; coefficients: number[]; salt: string; name: Text }[] = [
  { acid: "HCl", equation: "NH3 + HCl -> NH4Cl", coefficients: [1, 1, 1], salt: "NH4Cl", name: tx("ammonium chloride", "Ammoniumchlorid") },
  { acid: "HNO3", equation: "NH3 + HNO3 -> NH4NO3", coefficients: [1, 1, 1], salt: "NH4NO3", name: tx("ammonium nitrate", "Ammoniumnitrat") },
  { acid: "H2SO4", equation: "NH3 + H2SO4 -> (NH4)2SO4", coefficients: [2, 1, 1], salt: "(NH4)2SO4", name: tx("ammonium sulfate", "Ammoniumsulfat") },
  { acid: "H3PO4", equation: "NH3 + H3PO4 -> (NH4)3PO4", coefficients: [3, 1, 1], salt: "(NH4)3PO4", name: tx("ammonium phosphate", "Ammoniumphosphat") },
];

// ---------------------------------------------------------------------------
// Protolysis reactions (proton transfers), for "who is the acid?" tasks.

export type Protolysis = {
  /** Display source of the equation (\ce body). */
  ce: string;
  /** Species as written: [acid-or-base, ...] left then right. */
  species: string[];
  /** Index (in species) of the proton donor and acceptor on the left. */
  donor: number;
  acceptor: number;
  /** What happens, one sentence. */
  why: Text;
  level: 2 | 3;
};

export const PROTOLYSES: Protolysis[] = [
  { ce: "HCl + H2O -> H3O+ + Cl-", species: ["HCl", "H2O", "H3O+", "Cl-"], donor: 0, acceptor: 1, why: tx("$\\ce{HCl}$ hands its proton to water and is left as $\\ce{Cl-}$.", "$\\ce{HCl}$ gibt sein Proton an Wasser ab und bleibt als $\\ce{Cl-}$ zurück."), level: 2 },
  { ce: "HNO3 + H2O -> H3O+ + NO3-", species: ["HNO3", "H2O", "H3O+", "NO3-"], donor: 0, acceptor: 1, why: tx("$\\ce{HNO3}$ gives its proton to water and is left as $\\ce{NO3-}$.", "$\\ce{HNO3}$ gibt sein Proton an Wasser ab und bleibt als $\\ce{NO3-}$ zurück."), level: 2 },
  { ce: "NH3 + H2O <=> NH4+ + OH-", species: ["NH3", "H2O", "NH4+", "OH-"], donor: 1, acceptor: 0, why: tx("Water gives a proton to ammonia: $\\ce{NH3}$ becomes $\\ce{NH4+}$, water is left as $\\ce{OH-}$.", "Wasser gibt ein Proton an Ammoniak ab: Aus $\\ce{NH3}$ wird $\\ce{NH4+}$, das Wasser bleibt als $\\ce{OH-}$ zurück."), level: 2 },
  { ce: "H3O+ + OH- -> H2O + H2O", species: ["H3O+", "OH-", "H2O", "H2O"], donor: 0, acceptor: 1, why: tx("The oxonium ion hands its extra proton to the hydroxide ion: two water molecules.", "Das Oxonium-Ion gibt sein zusätzliches Proton an das Hydroxid-Ion ab: zwei Wassermoleküle."), level: 2 },
  { ce: "CH3COOH + H2O <=> H3O+ + CH3COO-", species: ["CH3COOH", "H2O", "H3O+", "CH3COO-"], donor: 0, acceptor: 1, why: tx("Acetic acid gives the H of its COOH group to water and is left as the acetate ion.", "Essigsäure gibt das H ihrer COOH-Gruppe an Wasser ab und bleibt als Acetat-Ion zurück."), level: 3 },
  { ce: "HCl + NH3 -> NH4+ + Cl-", species: ["HCl", "NH3", "NH4+", "Cl-"], donor: 0, acceptor: 1, why: tx("Even without water: $\\ce{HCl}$ hands its proton straight to $\\ce{NH3}$. Together the ions form ammonium chloride.", "Sogar ohne Wasser: $\\ce{HCl}$ gibt sein Proton direkt an $\\ce{NH3}$ ab. Zusammen bilden die Ionen Ammoniumchlorid."), level: 3 },
  { ce: "CO3^2- + H2O <=> HCO3- + OH-", species: ["CO3^2-", "H2O", "HCO3-", "OH-"], donor: 1, acceptor: 0, why: tx("The carbonate ion takes a proton from water: that's why soda solution is alkaline.", "Das Carbonat-Ion nimmt ein Proton vom Wasser auf: Deshalb ist Sodalösung alkalisch."), level: 3 },
  { ce: "HSO4- + H2O <=> H3O+ + SO4^2-", species: ["HSO4-", "H2O", "H3O+", "SO4^2-"], donor: 0, acceptor: 1, why: tx("The hydrogen sulfate ion still has a proton to give: it hands it to water.", "Das Hydrogensulfat-Ion hat noch ein Proton übrig: Es gibt es an Wasser ab."), level: 3 },
];
