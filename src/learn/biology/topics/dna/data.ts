// Shared facts and helpers for the topic "DNA und Proteinbiosynthese": base pairing, the
// standard genetic code, translation with start and stop rules, and display helpers.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Mistake } from "@/learn/types";

// ---------------------------------------------------------------------------
// Bases and pairing

export const DNA_BASES = ["A", "T", "G", "C"] as const;
/** The order of the code sun rings (and of the code table). */
export const RNA_BASES = ["U", "C", "A", "G"] as const;

/** DNA–DNA pairing: A–T, G–C. */
export const PAIR: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
/** The RNA base built opposite a DNA template base (A → U). */
export const RNA_PAIR: Record<string, string> = { A: "U", T: "A", G: "C", C: "G" };
/** RNA–RNA pairing (codon ↔ anticodon). */
export const RR_PAIR: Record<string, string> = { A: "U", U: "A", G: "C", C: "G" };

export const complement = (dna: string) => [...dna].map((b) => PAIR[b] ?? b).join("");
/** mRNA made from a template (codogenic) strand, base by base. */
export const transcribe = (template: string) => [...template].map((b) => RNA_PAIR[b] ?? b).join("");
/** Coding strand → mRNA (same sequence, U instead of T). */
export const toRna = (s: string) => s.replace(/T/g, "U");
export const toDna = (s: string) => s.replace(/U/g, "T");
/** Anticodon written 3′→5′, base for base under the codon. */
export const anticodonOf = (codon: string) => [...codon].map((b) => RR_PAIR[b] ?? b).join("");
export const reversed = (s: string) => [...s].reverse().join("");
export const triplets = (s: string) => s.match(/.{1,3}/g) ?? [];

/** Full base names. */
export const BASE_NAME: Record<string, Text> = {
  A: tx("adenine", "Adenin"),
  T: tx("thymine", "Thymin"),
  G: tx("guanine", "Guanin"),
  C: tx("cytosine", "Cytosin"),
  U: tx("uracil", "Uracil"),
};
export const BASE_VAR: Record<string, string> = { A: "var(--bio-a)", T: "var(--bio-t)", G: "var(--bio-g)", C: "var(--bio-c)", U: "var(--bio-u)" };
/** Hydrogen bonds per base pair. */
export const HBONDS: Record<string, number> = { A: 2, T: 2, U: 2, G: 3, C: 3 };

// ---------------------------------------------------------------------------
// The standard genetic code

/** One-letter amino acids for all 64 codons, bases in the order U, C, A, G (first, second, third). */
const CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const IDX: Record<string, number> = { U: 0, C: 1, A: 2, G: 3 };

export type Amino = { one: string; abbr: string; name: Text; also?: string[] };
export const AMINO: Record<string, Amino> = {
  A: { one: "A", abbr: "Ala", name: tx("alanine", "Alanin") },
  R: { one: "R", abbr: "Arg", name: tx("arginine", "Arginin") },
  N: { one: "N", abbr: "Asn", name: tx("asparagine", "Asparagin") },
  D: { one: "D", abbr: "Asp", name: tx("aspartic acid", "Asparaginsäure"), also: ["Aspartat", "aspartate"] },
  C: { one: "C", abbr: "Cys", name: tx("cysteine", "Cystein") },
  Q: { one: "Q", abbr: "Gln", name: tx("glutamine", "Glutamin") },
  E: { one: "E", abbr: "Glu", name: tx("glutamic acid", "Glutaminsäure"), also: ["Glutamat", "glutamate"] },
  G: { one: "G", abbr: "Gly", name: tx("glycine", "Glycin") },
  H: { one: "H", abbr: "His", name: tx("histidine", "Histidin") },
  I: { one: "I", abbr: "Ile", name: tx("isoleucine", "Isoleucin") },
  L: { one: "L", abbr: "Leu", name: tx("leucine", "Leucin") },
  K: { one: "K", abbr: "Lys", name: tx("lysine", "Lysin") },
  M: { one: "M", abbr: "Met", name: tx("methionine", "Methionin") },
  F: { one: "F", abbr: "Phe", name: tx("phenylalanine", "Phenylalanin") },
  P: { one: "P", abbr: "Pro", name: tx("proline", "Prolin") },
  S: { one: "S", abbr: "Ser", name: tx("serine", "Serin") },
  T: { one: "T", abbr: "Thr", name: tx("threonine", "Threonin") },
  W: { one: "W", abbr: "Trp", name: tx("tryptophan", "Tryptophan") },
  Y: { one: "Y", abbr: "Tyr", name: tx("tyrosine", "Tyrosin") },
  V: { one: "V", abbr: "Val", name: tx("valine", "Valin") },
  "*": { one: "*", abbr: "Stop", name: tx("stop", "Stopp") },
};

/** All 64 codons in code-sun order (UUU, UUC, UUA, UUG, UCU …). */
export const ALL_CODONS: string[] = RNA_BASES.flatMap((a) => RNA_BASES.flatMap((b) => RNA_BASES.map((c) => a + b + c)));

/** One-letter amino acid of an mRNA codon ("*" for stop). DNA codons (with T) are read as mRNA. */
export function aminoLetter(codon: string): string {
  const c = toRna(codon);
  const i = 16 * IDX[c[0]] + 4 * IDX[c[1]] + IDX[c[2]];
  return CODE[i] ?? "?";
}
export const aminoOf = (codon: string): Amino => AMINO[aminoLetter(codon)];
export const isStop = (codon: string) => aminoLetter(codon) === "*";
export const STOPS = ["UAA", "UAG", "UGA"];
export const codonsFor = (one: string) => ALL_CODONS.filter((c) => aminoLetter(c) === one);
/** Abbreviation for a one-letter code ("Stopp"/"Stop" handled by the caller). */
export const abbr = (one: string) => AMINO[one]?.abbr ?? "?";

/** Words a student may type for an amino acid: name in both languages, the three-letter code, other names. */
export const aminoAccept = (a: Amino): Text[] => [a.name, a.abbr, ...(a.also ?? [])];

export type Translation = {
  /** Index of the first AUG, or -1. */
  start: number;
  /** Sense codons from AUG on (stop not included). */
  codons: string[];
  /** One-letter amino acids. */
  aas: string[];
  /** The stop codon that ended it (null when the sequence ran out first). */
  stop: string | null;
};

/** Reads an mRNA like a ribosome: from the first AUG, codon by codon, until a stop codon. */
export function translate(mrna: string, from?: number): Translation {
  const start = from ?? mrna.indexOf("AUG");
  const out: Translation = { start, codons: [], aas: [], stop: null };
  if (start < 0) return out;
  for (let i = start; i + 3 <= mrna.length; i += 3) {
    const c = mrna.slice(i, i + 3);
    if (isStop(c)) {
      out.stop = c;
      break;
    }
    out.codons.push(c);
    out.aas.push(aminoLetter(c));
  }
  return out;
}

/** "Met–Ala–Gly" from one-letter codes. */
export const peptideText = (aas: string[]) => aas.map(abbr).join("–");
/** A peptide as inline display maths for rich text and choice options. */
export const peptideRich = (aas: string[]) => `$\\text{${peptideText(aas) || "–"}}$`;

// ---------------------------------------------------------------------------
// Random sequences (only rng!)

export const randomDna = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.pick(DNA_BASES)).join("");

/** A DNA strand that uses at least `distinct` different bases and no base more than `maxRun` times in a row. */
export function variedDna(rng: Rng, n: number, distinct = 3, maxRun = 2): string {
  for (let k = 0; k < 60; k++) {
    const s = randomDna(rng, n);
    if (new Set(s).size >= distinct && !new RegExp(`(.)\\1{${maxRun}}`).test(s)) return s;
  }
  return "ATGCGTAC".slice(0, n).padEnd(n, "A");
}

/** A random sense codon (no stop), optionally not AUG and not from a list. */
export function senseCodon(rng: Rng, opts: { noStart?: boolean; avoid?: string[] } = {}): string {
  for (let k = 0; k < 80; k++) {
    const c = rng.pick(ALL_CODONS);
    if (isStop(c)) continue;
    if (opts.noStart && c === "AUG") continue;
    if (opts.avoid?.includes(c)) continue;
    return c;
  }
  return "GCU";
}

/** Bases (mRNA alphabet) that contain no AUG and no stop in any frame together with what follows. */
export function leader(rng: Rng, n: number): string {
  for (let k = 0; k < 80; k++) {
    const s = Array.from({ length: n }, () => rng.pick(["C", "G", "A", "U"] as const)).join("");
    if (!s.includes("AUG") && !/AU$|A$/.test(s)) return s;
  }
  return "GC".repeat(n).slice(0, n);
}

// ---------------------------------------------------------------------------
// Display helpers (display language: \text{…} keeps base letters upright and is not a "word")

export const P5 = "5′";
export const P3 = "3′";

/** \text{AUG GCU} (grouped in triplets when asked). */
export const seq = (s: string, group = false) => `\\text{${group ? triplets(s).join(" ") : s}}`;
/** A strand with its ends: \text{5′-ATG GCA-3′}. */
export const strand = (s: string, from: "5" | "3", group = false) => {
  const [a, b] = from === "5" ? [P5, P3] : [P3, P5];
  return `\\text{${a}-${group ? triplets(s).join(" ") : s}-${b}}`;
};
/** Same as `strand` but for rich text ($…$ inline maths). */
export const strandRich = (s: string, from: "5" | "3", group = false) => `$${strand(s, from, group)}$`;
export const seqRich = (s: string, group = false) => `$${seq(s, group)}$`;

/**
 * Two strands base for base, stacked as columns (a thin line between each pair):
 * `pairs("ATG", "TAC")` → \frac{\text{A}}{\text{T}} …  Keys k0, k1… let pairs glide between frames.
 */
export function pairs(top: string, bottom: string, opts: { ends?: [string, string, string, string]; key?: string; mark?: number[] } = {}) {
  const k = opts.key ?? "p";
  const cols = [...top].map((t, i) => {
    const b = bottom[i] ?? " ";
    const lit = opts.mark?.includes(i);
    const cell = `\\frac{\\text{${t}}#${k}t${i} }{${lit ? "\\hl{" : ""}\\text{${b}}#${k}b${i} ${lit ? "}" : ""}}#${k}${i}`;
    return cell;
  });
  if (opts.ends) {
    const [lt, lb, rt, rb] = opts.ends;
    return `\\group{\\frac{\\text{${lt}}#${k}lt }{\\text{${lb}}#${k}lb }#${k}L ${cols.join(" ")} \\frac{\\text{${rt}}#${k}rt }{\\text{${rb}}#${k}rb }#${k}R}`;
  }
  return `\\group{${cols.join(" ")}}`;
}

// ---------------------------------------------------------------------------
// Answers and typical mistakes

/** Base sequences typed by the student: exact (case, spaces and hyphens don't matter). Keep them ≤ 6 bases. */
export const seqAnswer = (s: string, label?: Text): AnswerSpec => ({ kind: "word", accept: [s], label, placeholder: tx("bases only, e.g. ACG…", "nur Basen, z. B. ACG…") });

/** Collects mistakes; a mistake is only kept when it is wrong and differs from the ones before. */
export function mistakeList() {
  const list: Mistake[] = [];
  const seen = new Set<string>();
  const add = (right: string, wrong: string, title: Text, say: Text) => {
    const w = wrong.toUpperCase();
    if (w === right.toUpperCase() || seen.has(w)) return;
    seen.add(w);
    list.push({ when: { kind: "word", accept: [w] }, title, say });
  };
  return { list, add };
}

/** Number mistakes: only kept when different from the answer and from each other. */
export function numberMistakes(value: number) {
  const list: Mistake[] = [];
  const seen = new Set<number>([value]);
  const add = (wrong: number, title: Text, say: Text, close?: boolean) => {
    if (!Number.isFinite(wrong) || seen.has(wrong)) return;
    if (Math.abs(wrong - value) <= 1e-6 * Math.max(1, Math.abs(value))) return;
    seen.add(wrong);
    list.push(close ? { when: { kind: "number", value: wrong }, title, say, close } : { when: { kind: "number", value: wrong }, title, say });
  };
  return { list, add };
}

/** A choice option; the right one comes first in the list given to `choiceOf`. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Options shuffled with rng; wrong options with a `say` become typical mistakes. */
export function choiceOf(rng: Rng | null, opts: Opt[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

/** Removes options whose English text repeats an earlier one (keeps the first, i.e. the right one). */
export function uniqueOpts(opts: Opt[]): Opt[] {
  const seen = new Set<string>();
  return opts.filter((o) => {
    const key = typeof o.text === "string" ? o.text : o.text.en;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Format a whole number with thousands separators for both languages (1,048,576 / 1.048.576). */
export const bigText = (n: number): Text => tx(n.toLocaleString("en-GB"), n.toLocaleString("de-DE"));
