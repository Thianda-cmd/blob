// Genetics facts shared by the three levels: traits, crosses, blood groups, X-linked crosses.

import { resolveText, tx, type Text } from "@/i18n/text";

// ---------------------------------------------------------------------------
// Traits with a dominant and a recessive form

export type TraitId = "flower" | "shape" | "colour" | "height" | "pod" | "fur";

export type Trait = {
  id: TraitId;
  /** Letter of the dominant allele (the recessive one is the small letter). */
  letter: string;
  /** "pea" / "Erbse" */
  organism: Text;
  /** "pea plants" / "Erbsenpflanzen" */
  many: Text;
  /** "plants" / "Pflanzen" (offspring) */
  ind: Text;
  /** The trait: "flower colour" / "Blütenfarbe" */
  name: Text;
  dom: Text;
  rec: Text;
  /** "purple flowers" / "violette Blüten" (have …) */
  hasDom: Text;
  hasRec: Text;
  /** "with purple flowers" / "mit violetten Blüten" */
  withDom: Text;
  withRec: Text;
  /** "have purple flowers" / "haben violette Blüten", "are round" / "sind rund" (question about offspring) */
  qDom: Text;
  qRec: Text;
  /** A made-up in-between look (for the "blending" misconception). */
  mix: Text;
};

export const TRAITS: Record<TraitId, Trait> = {
  flower: {
    id: "flower",
    letter: "A",
    organism: tx("pea", "Erbse"),
    many: tx("pea plants", "Erbsenpflanzen"),
    ind: tx("plants", "Pflanzen"),
    name: tx("flower colour", "Blütenfarbe"),
    dom: tx("purple", "violett"),
    rec: tx("white", "weiß"),
    hasDom: tx("purple flowers", "violette Blüten"),
    hasRec: tx("white flowers", "weiße Blüten"),
    withDom: tx("with purple flowers", "mit violetten Blüten"),
    withRec: tx("with white flowers", "mit weißen Blüten"),
    qDom: tx("have purple flowers", "haben violette Blüten"),
    qRec: tx("have white flowers", "haben weiße Blüten"),
    mix: tx("all light purple, a mix of both", "alle hellviolett, eine Mischung aus beidem"),
  },
  shape: {
    id: "shape",
    letter: "R",
    organism: tx("pea", "Erbse"),
    many: tx("pea plants", "Erbsenpflanzen"),
    ind: tx("seeds", "Samen"),
    name: tx("seed shape", "Samenform"),
    dom: tx("round", "rund"),
    rec: tx("wrinkled", "runzlig"),
    hasDom: tx("round seeds", "runde Samen"),
    hasRec: tx("wrinkled seeds", "runzlige Samen"),
    withDom: tx("with round seeds", "mit runden Samen"),
    withRec: tx("with wrinkled seeds", "mit runzligen Samen"),
    qDom: tx("are round", "sind rund"),
    qRec: tx("are wrinkled", "sind runzlig"),
    mix: tx("all slightly wrinkled, a mix of both", "alle leicht runzlig, eine Mischung aus beidem"),
  },
  colour: {
    id: "colour",
    letter: "G",
    organism: tx("pea", "Erbse"),
    many: tx("pea plants", "Erbsenpflanzen"),
    ind: tx("seeds", "Samen"),
    name: tx("seed colour", "Samenfarbe"),
    dom: tx("yellow", "gelb"),
    rec: tx("green", "grün"),
    hasDom: tx("yellow seeds", "gelbe Samen"),
    hasRec: tx("green seeds", "grüne Samen"),
    withDom: tx("with yellow seeds", "mit gelben Samen"),
    withRec: tx("with green seeds", "mit grünen Samen"),
    qDom: tx("are yellow", "sind gelb"),
    qRec: tx("are green", "sind grün"),
    mix: tx("all yellowish green, a mix of both", "alle gelbgrün, eine Mischung aus beidem"),
  },
  height: {
    id: "height",
    letter: "L",
    organism: tx("pea", "Erbse"),
    many: tx("pea plants", "Erbsenpflanzen"),
    ind: tx("plants", "Pflanzen"),
    name: tx("stem length", "Länge der Sprossachse"),
    dom: tx("tall", "lang"),
    rec: tx("short", "kurz"),
    hasDom: tx("a long stem", "eine lange Sprossachse"),
    hasRec: tx("a short stem", "eine kurze Sprossachse"),
    withDom: tx("with a long stem", "mit langer Sprossachse"),
    withRec: tx("with a short stem", "mit kurzer Sprossachse"),
    qDom: tx("have a long stem", "haben eine lange Sprossachse"),
    qRec: tx("have a short stem", "haben eine kurze Sprossachse"),
    mix: tx("all medium height, a mix of both", "alle mittelgroß, eine Mischung aus beidem"),
  },
  pod: {
    id: "pod",
    letter: "H",
    organism: tx("pea", "Erbse"),
    many: tx("pea plants", "Erbsenpflanzen"),
    ind: tx("plants", "Pflanzen"),
    name: tx("pod colour", "Hülsenfarbe"),
    dom: tx("green", "grün"),
    rec: tx("yellow", "gelb"),
    hasDom: tx("green pods", "grüne Hülsen"),
    hasRec: tx("yellow pods", "gelbe Hülsen"),
    withDom: tx("with green pods", "mit grünen Hülsen"),
    withRec: tx("with yellow pods", "mit gelben Hülsen"),
    qDom: tx("have green pods", "haben grüne Hülsen"),
    qRec: tx("have yellow pods", "haben gelbe Hülsen"),
    mix: tx("all yellowish green, a mix of both", "alle gelbgrün, eine Mischung aus beidem"),
  },
  fur: {
    id: "fur",
    letter: "F",
    organism: tx("guinea pig", "Meerschweinchen"),
    many: tx("guinea pigs", "Meerschweinchen"),
    ind: tx("young", "Jungtiere"),
    name: tx("fur colour", "Fellfarbe"),
    dom: tx("black", "schwarz"),
    rec: tx("white", "weiß"),
    hasDom: tx("black fur", "schwarzes Fell"),
    hasRec: tx("white fur", "weißes Fell"),
    withDom: tx("with black fur", "mit schwarzem Fell"),
    withRec: tx("with white fur", "mit weißem Fell"),
    qDom: tx("have black fur", "haben schwarzes Fell"),
    qRec: tx("have white fur", "haben weißes Fell"),
    mix: tx("all grey, a mix of both", "alle grau, eine Mischung aus beidem"),
  },
};

export const PEA_TRAITS: TraitId[] = ["flower", "shape", "colour", "height", "pod"];
export const ALL_TRAITS: TraitId[] = [...PEA_TRAITS, "fur"];

/** "violett (A) ist dominant über weiß (a)" */
export function dominanceLine(t: Trait): Text {
  const L = t.letter;
  const l = L.toLowerCase();
  const en = (x: Text) => resolveText(x, "en");
  const de = (x: Text) => resolveText(x, "de");
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  return tx(
    `${cap(en(t.organism))}, ${en(t.name)}: ${en(t.dom)} ($${L}$) is dominant over ${en(t.rec)} ($${l}$).`,
    `${de(t.organism)}, ${de(t.name)}: ${de(t.dom)} ($${L}$) ist dominant über ${de(t.rec)} ($${l}$).`,
  );
}

/** Pea plant drawing props that show this trait in its dominant or recessive form. */
export function peaLook(t: TraitId, dominant: boolean): Record<string, unknown> {
  switch (t) {
    case "flower":
      return { flower: dominant ? "purple" : "white", focus: "flower" };
    case "shape":
      return { seedShape: dominant ? "round" : "wrinkled", focus: "seeds" };
    case "colour":
      return { seedColour: dominant ? "yellow" : "green", focus: "seeds" };
    case "height":
      return { tall: dominant, focus: "stem" };
    case "pod":
      return { pod: dominant ? "green" : "yellow", focus: "pod" };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Monohybrid crosses (two alleles, written as two letters: "Aa")

/** Puts the dominant (capital) allele first: "aA" → "Aa"; blood groups A before B before 0. */
export function geno(a: string, b: string): string {
  const rank = (x: string) => (x === "0" ? 100 : x === x.toUpperCase() ? x.charCodeAt(0) : 50 + x.charCodeAt(0));
  return rank(a) <= rank(b) ? a + b : b + a;
}

/** The four cells of a Punnett square, row by row: rows are the gametes of parent 2, columns those of parent 1. */
export function punnett(g1: string, g2: string): string[] {
  const out: string[] = [];
  for (const r of [g2[0], g2[1]]) for (const c of [g1[0], g1[1]]) out.push(geno(c, r));
  return out;
}

/** Counts of each value, in first-seen order. */
export function tally<T extends string>(items: T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()];
}

export function gcdList(xs: number[]) {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  return xs.reduce((a, b) => g(a, b));
}

/** Genotypes of a dominant-recessive monohybrid cross in the order DD, Dd, dd. */
export function monoCounts(g1: string, g2: string): { DD: number; Dd: number; dd: number } {
  const cells = punnett(g1, g2);
  const n = (s: string) => cells.filter((c) => c === s).length;
  const L = g1[0].toUpperCase();
  const l = L.toLowerCase();
  return { DD: n(L + L), Dd: n(L + l), dd: n(l + l) };
}

// ---------------------------------------------------------------------------
// Intermediate inheritance (no allele dominates): two capitals, R and W

export type Intermediate = { id: "mirabilis" | "snapdragon"; name: Text; plural: Text };
export const INTERMEDIATE: Intermediate[] = [
  { id: "mirabilis", name: tx("four o'clock flower (Mirabilis jalapa)", "Wunderblume (Mirabilis jalapa)"), plural: tx("four o'clock flowers", "Wunderblumen") },
  { id: "snapdragon", name: tx("snapdragon", "Löwenmäulchen"), plural: tx("snapdragons", "Löwenmäulchen") },
];
export const INTER_COLOUR: Record<string, Text> = { RR: tx("red", "rot"), RW: tx("pink", "rosa"), WW: tx("white", "weiß") };

// ---------------------------------------------------------------------------
// Blood groups (AB0 system): A and B are codominant, 0 is recessive

export const BLOOD_GENOTYPES = ["AA", "A0", "BB", "B0", "AB", "00"] as const;
export type BloodGenotype = (typeof BLOOD_GENOTYPES)[number];
export type BloodGroup = "A" | "B" | "AB" | "0";
export const BLOOD_GROUPS: BloodGroup[] = ["A", "B", "AB", "0"];

export function bloodGroup(g: string): BloodGroup {
  const a = g.includes("A");
  const b = g.includes("B");
  return a && b ? "AB" : a ? "A" : b ? "B" : "0";
}

/** Genotypes that give a blood group. */
export const genotypesOf = (bg: BloodGroup) => BLOOD_GENOTYPES.filter((g) => bloodGroup(g) === bg);

/** Probability of each blood group among the children of two genotypes. */
export function bloodChildren(g1: string, g2: string): Record<BloodGroup, number> {
  const out: Record<BloodGroup, number> = { A: 0, B: 0, AB: 0, "0": 0 };
  for (const c of punnett(g1, g2)) out[bloodGroup(c)] += 0.25;
  return out;
}

/** "Blutgruppe A" / "blood group A" */
export const bgName = (bg: BloodGroup): Text => tx(`blood group ${bg}`, `Blutgruppe ${bg}`);

// ---------------------------------------------------------------------------
// X-linked crosses. Mother: 0, 1 or 2 disease alleles; father: 0 or 1.

export type XDisease = { id: "colour" | "haemo"; name: Text; short: Text; affected: Text; healthy: Text };
export const X_DISEASES: XDisease[] = [
  {
    id: "colour",
    name: tx("red-green colour blindness", "Rot-Grün-Sehschwäche"),
    short: tx("red-green colour blindness", "Rot-Grün-Sehschwäche"),
    affected: tx("colour-blind", "rot-grün-sehschwach"),
    healthy: tx("with normal colour vision", "normalsichtig"),
  },
  {
    id: "haemo",
    name: tx("haemophilia A (bleeder disease)", "Bluterkrankheit (Hämophilie A)"),
    short: tx("haemophilia", "Bluterkrankheit"),
    affected: tx("a haemophiliac", "Bluter"),
    healthy: tx("healthy", "gesund"),
  },
];

/** Display-language genotype for an X-linked recessive trait: X^A X^a, X^a Y. */
export function xGeno(sex: "m" | "f", d: number): string {
  if (sex === "m") return d ? "X^a Y" : "X^A Y";
  return d === 0 ? "X^A X^A" : d === 1 ? "X^A X^a" : "X^a X^a";
}

/** Children of an X-linked recessive cross: probabilities among daughters, among sons and among all children. */
export function xCross(md: number, fd: number) {
  const mg = md === 0 ? [0, 0] : md === 1 ? [0, 1] : [1, 1];
  // daughters: father's X (fd) + one maternal X; sons: one maternal X
  const daughters = mg.map((b) => fd + b);
  const sons = mg;
  const share = (xs: number[], f: (d: number) => boolean) => xs.filter(f).length / xs.length;
  return {
    daughterAffected: share(daughters, (d) => d === 2),
    daughterCarrier: share(daughters, (d) => d === 1),
    sonAffected: share(sons, (d) => d === 1),
    /** Probability that a child (any) is affected. */
    childAffected: (share(daughters, (d) => d === 2) + share(sons, (d) => d === 1)) / 2,
    /** Probability that the next child is an affected son. */
    affectedSon: share(sons, (d) => d === 1) / 2,
    daughters,
    sons,
  };
}

// ---------------------------------------------------------------------------
// Mendel's own F2 numbers (1866)

export type MendelRow = { trait: Text; dom: Text; rec: Text; a: number; b: number };
export const MENDEL_F2: MendelRow[] = [
  { trait: tx("seed shape", "Samenform"), dom: tx("round", "rund"), rec: tx("wrinkled", "runzlig"), a: 5474, b: 1850 },
  { trait: tx("seed colour", "Samenfarbe"), dom: tx("yellow", "gelb"), rec: tx("green", "grün"), a: 6022, b: 2001 },
  { trait: tx("flower colour", "Blütenfarbe"), dom: tx("purple", "violett"), rec: tx("white", "weiß"), a: 705, b: 224 },
  { trait: tx("pod shape", "Hülsenform"), dom: tx("inflated", "gewölbt"), rec: tx("constricted", "eingeschnürt"), a: 882, b: 299 },
  { trait: tx("pod colour", "Hülsenfarbe"), dom: tx("green", "grün"), rec: tx("yellow", "gelb"), a: 428, b: 152 },
  { trait: tx("flower position", "Blütenstellung"), dom: tx("axial", "achsenständig"), rec: tx("terminal", "endständig"), a: 651, b: 207 },
  { trait: tx("stem length", "Länge der Sprossachse"), dom: tx("long", "lang"), rec: tx("short", "kurz"), a: 787, b: 277 },
];
