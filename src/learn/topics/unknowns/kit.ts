import type { Locale } from "@/i18n/config";
import { resolveText, txMap, type Text } from "@/i18n/text";
import { check } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Mistake } from "@/learn/types";

// Shared helpers of the three levels: bilingual sentences with names and numbers, name lists,
// and simulated wrong answers (Exercise.mistakes).

/** German number style: decimal comma (level 1 uses it for whole numbers in both languages). */
export function de(v: number): string {
  return String(Math.round(v * 1000) / 1000).replace(".", ",");
}

/** A number in the given language: 2,5 in German, 2.5 in English. */
export function num(v: number, l: Locale): string {
  const s = String(Math.round(v * 1000) / 1000);
  return l === "de" ? s.replace(".", ",") : s;
}

/** Join note parts with spaces, in both languages; empty parts are dropped. */
export function joinT(...parts: Text[]): Text {
  if (parts.every((p): p is string => typeof p === "string")) return parts.filter(Boolean).join(" ");
  return txMap((_, l) => parts.map((p) => resolveText(p, l)).filter(Boolean).join(" "));
}

/** Paragraphs (blank line between them), in both languages. */
export function paras(...parts: Text[]): Text {
  return txMap((_, l) => parts.map((p) => resolveText(p, l)).filter(Boolean).join("\n\n"));
}

export const E = (t: Text) => resolveText(t, "en");
export const D = (t: Text) => resolveText(t, "de");

/** German genitive of a name: "Lenas", "Jonas’", "Moritz’". */
export const deGen = (name: string) => (/[sßxz]$/.test(name) ? `${name}’` : `${name}s`);

/**
 * A sentence with names (or other bilingual parts) in both languages. The builder gets
 * N (a part in the current language) and G (its German genitive) and returns [English, German]:
 * say((N, G) => [`Let $x$ be ${N(a)}'s age.`, `Sei $x$ ${G(a)} Alter.`]).
 */
export function say(build: (N: (p: Text) => string, G: (p: Text) => string) => [string, string]): Text {
  return txMap((_, l) => {
    const N = (p: Text) => resolveText(p, l);
    const [en, deText] = build(N, (p) => deGen(N(p)));
    return l === "en" ? en : deText;
  });
}

/** Like `say`, with numbers in the language's style (n(2.5) is "2.5" or "2,5"). */
export function sayN(build: (f: { n: (v: number) => string; N: (p: Text) => string; G: (p: Text) => string }) => [string, string]): Text {
  return txMap((_, l) => {
    const N = (p: Text) => resolveText(p, l);
    const [en, deText] = build({ n: (v) => num(v, l), N, G: (p) => deGen(N(p)) });
    return l === "en" ? en : deText;
  });
}

/** The same display-language source in both languages, only the names (or numbers) differ. */
export function both(build: (N: (p: Text) => string) => string): Text {
  const t = txMap((_, l) => build((p) => resolveText(p, l)));
  return typeof t !== "string" && t.en === t.de ? t.en : t;
}

/** Display-language maths whose numbers follow the language (decimal comma in German). */
export function mathN(build: (n: (v: number) => string) => string): Text {
  const t = txMap((_, l) => build((v) => num(v, l)));
  return typeof t !== "string" && t.en === t.de ? t.en : t;
}

/** "18, 19 und 20" */
export const deList = (items: (string | number)[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`);

// ---------------------------------------------------------------------------
// Names. The German stories use their own (equally typical) names, picked with the same random draw.

const NAMES_EN = ["Mia", "Leon", "Emma", "Noah", "Lina", "Elias", "Hannah", "Paul", "Sophie", "Ben", "Finn", "Lea", "Jonas", "Amira", "Can", "Zeynep", "Luca", "Ida", "Mats", "Aylin", "Nele", "Yusuf", "Clara", "Theo", "Omar", "Jana"];
const NAMES_DE = ["Marie", "Lukas", "Emilia", "Felix", "Luisa", "Jakob", "Johanna", "Moritz", "Charlotte", "Henri", "Anton", "Frieda", "Niklas", "Elif", "Emre", "Leyla", "Luis", "Greta", "Ole", "Selin", "Merle", "Mehmet", "Lotta", "Karl", "Samir", "Pia"];
const SHORT_EN = ["Ida", "Ben", "Can", "Mia", "Tim", "Lea", "Ali", "Finn", "Nele", "Emma", "Paul", "Noah", "Lina", "Jana", "Omar", "Max", "Ella", "Jan"];
const SHORT_DE = ["Pia", "Tom", "Ole", "Lia", "Kai", "Mara", "Elif", "Lars", "Ina", "Lotte", "Nils", "Jule", "Rosa", "Till", "Eda", "Leni", "Anna", "Malte"];
export const NAMES: Text[] = NAMES_EN.map((n, i) => ({ en: n, de: NAMES_DE[i] }));
export const SHORT: Text[] = SHORT_EN.map((n, i) => ({ en: n, de: SHORT_DE[i] }));

export function names(rng: Rng, n: number, list = SHORT): Text[] {
  return rng.shuffle(list).slice(0, n);
}

// ---------------------------------------------------------------------------
// Typical mistakes as simulated wrong numbers.

export type Wrong = { v: number; title: Text; say: Text; signed?: boolean } | false;

export const wrong = (v: number, title: Text, say: Text, signed = false): Wrong => ({ v, title, say, signed });

/**
 * Simulated wrong results → Exercise.mistakes. Only values the checker rejects (and,
 * unless `signed`, positive ones), no duplicates: the first explanation wins. Results
 * like 10,333… get typed rounded, so those accept a small window around them.
 */
export function wrongNumbers(answer: AnswerSpec, list: Wrong[]): Mistake[] {
  if (answer.kind !== "number") return [];
  const out: Mistake[] = [];
  for (const w of list) {
    if (!w || !Number.isFinite(w.v) || (!w.signed && w.v <= 0)) continue;
    const value = Math.round(w.v * 1000) / 1000;
    const exact = Math.abs(w.v * 100 - Math.round(w.v * 100)) < 1e-6;
    const window = exact ? 0 : Math.min(0.051, 0.05 * Math.abs(value) + 0.0005);
    if (Math.abs(value - answer.value) <= Math.max(1e-6, 3 * window)) continue;
    if (check(answer, { kind: "text", text: String(value) }).correct) continue;
    if (out.some((m) => m.when.kind === "number" && Math.abs(m.when.value - value) < 1e-6)) continue;
    const when: AnswerSpec = { kind: "number", value, unit: answer.unit, ...(window ? { tolerance: window / Math.max(1, Math.abs(value)) } : {}) };
    out.push({ when, title: w.title, say: w.say });
  }
  return out;
}

/** A wrong pair (x | y) with Blob's line. */
export type WrongPair = { v: [number, number]; title: Text; say: Text } | false;

/** Simulated wrong pairs → Exercise.mistakes: only pairs the checker rejects, no duplicates. */
export function wrongPairs(answer: AnswerSpec, list: WrongPair[]): Mistake[] {
  if (answer.kind !== "pair") return [];
  const out: Mistake[] = [];
  for (const w of list) {
    if (!w || !w.v.every(Number.isFinite)) continue;
    const v: [number, number] = [Math.round(w.v[0] * 1000) / 1000, Math.round(w.v[1] * 1000) / 1000];
    if (check(answer, { kind: "list", values: v.map(String) }).correct) continue;
    if (out.some((m) => m.when.kind === "pair" && m.when.values[0] === v[0] && m.when.values[1] === v[1])) continue;
    out.push({ when: { kind: "pair", names: answer.names, values: v }, title: w.title, say: w.say });
  }
  return out;
}

/** Simulated wrong solution sets → Exercise.mistakes (only sets the checker rejects, no duplicates). */
export function wrongSolutions(answer: AnswerSpec, list: ({ v: number[]; title: Text; say: Text } | false)[]): Mistake[] {
  if (answer.kind !== "solutions") return [];
  const out: Mistake[] = [];
  const key = (v: number[]) => [...v].sort((a, b) => a - b).join("|");
  for (const w of list) {
    if (!w || !w.v.length || !w.v.every(Number.isFinite)) continue;
    const v = w.v.map((x) => Math.round(x * 1000) / 1000);
    if (check(answer, { kind: "list", values: v.map(String) }).correct) continue;
    if (out.some((m) => m.when.kind === "solutions" && key(m.when.values) === key(v))) continue;
    out.push({ when: { kind: "solutions", variable: answer.variable, values: v }, title: w.title, say: w.say });
  }
  return out;
}
