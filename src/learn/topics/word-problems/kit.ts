// Helpers for the word-problem levels 2 and 3: bilingual building, numbers in the
// language's style, and typical mistakes simulated from a task's own numbers.

import type { ComponentType } from "react";
import type { Locale } from "@/i18n/config";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";

export const E = (t: Text) => resolveText(t, "en");
export const D = (t: Text) => resolveText(t, "de");

/** The same builder in both languages; a plain string when nothing differs (pure maths). */
export function both(build: (l: Locale) => string): Text {
  const en = build("en");
  const de = build("de");
  return en === de ? en : { en, de };
}

/** Joins bilingual pieces. */
export const cat = (...parts: Text[]): Text => both((l) => parts.map((p) => resolveText(p, l)).join(""));

/** Removes float noise (0.1 + 0.2). */
export const clean = (v: number, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

function grouped(int: string, sep: string) {
  if (int.length < 5) return int;
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * A number for prose in the language's style: "2,5" / "2.5", big numbers grouped
 * ("25.000" / "25,000", from five digits on), at most `digits` decimals.
 */
export function nf(v: number, l: Locale, digits = 2): string {
  const r = clean(v, digits);
  const [int, frac] = String(Math.abs(r)).split(".");
  const sign = r < 0 ? "−" : "";
  return `${sign}${grouped(int, l === "de" ? "." : ",")}${frac ? (l === "de" ? "," : ".") + frac : ""}`;
}

/** Both languages of a prose number. */
export const nt = (v: number, digits = 2): Text => both((l) => nf(v, l, digits));

/**
 * A number in the display language: decimal comma in German, a thin space between
 * groups of three from five digits on ("25 000"). With a key, every group keeps one.
 */
/** Highlight keys for keyed numbers: mn gives each digit group its own key (k, k_1, k_2 …). */
export const hk = (...keys: string[]) => keys.flatMap((k) => [k, `${k}_1`, `${k}_2`, `${k}_3`]);

export function mn(v: number, l: Locale, key?: string, digits = 2): string {
  const r = clean(v, digits);
  const [int, frac] = String(Math.abs(r)).split(".");
  const sign = r < 0 ? "-" : "";
  const fracPart = frac ? (l === "de" ? "," : ".") + frac : "";
  const groups = int.length < 5 ? [int] : grouped(int, " ").split(" ");
  groups[groups.length - 1] += fracPart;
  const keyed = groups.map((g, i) => (key ? `${g}#${key}${i ? `_${i}` : ""}` : g));
  return `${sign}${keyed.join(" \\, ")}`;
}

/** Euros: "12" or "7,50" / "7.50". */
export function eu(v: number, l: Locale): string {
  const r = Math.round(v * 100) / 100;
  if (Number.isInteger(r)) return nf(r, l, 0);
  const s = r.toFixed(2);
  return l === "de" ? s.replace(".", ",") : s;
}

/** Language tools for building a sentence or a formula in one language. */
export type Say = {
  l: Locale;
  de: boolean;
  /** Resolves bilingual text. */
  t: (x: Text) => string;
  /** Prose number: "2,5" / "2.5". */
  n: (v: number, digits?: number) => string;
  /** Display-language number, optionally keyed. */
  m: (v: number, key?: string, digits?: number) => string;
  /** Euros: "7,50" / "7.50", "12". */
  e: (v: number) => string;
};

export const say = (l: Locale): Say => ({
  l,
  de: l === "de",
  t: (x) => resolveText(x, l),
  n: (v, digits = 2) => nf(v, l, digits),
  m: (v, key, digits = 2) => mn(v, l, key, digits),
  e: (v) => eu(v, l),
});

/** English and German built side by side with numbers in each language's style. */
export function txs(en: (s: Say) => string, de: (s: Say) => string): Text {
  const a = en(say("en"));
  const b = de(say("de"));
  return a === b ? a : { en: a, de: b };
}

/** One builder for both languages (formulas: same structure, words and numbers per language). */
export const mb = (build: (s: Say) => string): Text => both((l) => build(say(l)));

/** A number answer, rounded to remove float noise. */
export const numAns = (value: number, unit?: Text, extra: { tolerance?: number; label?: Text } = {}): AnswerSpec => ({
  kind: "number",
  value: clean(value, 4),
  ...(unit ? { unit } : {}),
  ...extra,
});

/**
 * Typical mistakes for a number answer: each simulated wrong value becomes a mistake if it
 * differs from the right answer and from the mistakes before it.
 */
export function mistakesFor(answer: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (v: number | false | null | undefined, title: Text, say: Text, close?: boolean) => {
    if (answer.kind !== "number" || v === false || v == null || !Number.isFinite(v)) return;
    const value = clean(v, 4);
    const typed = { kind: "text" as const, text: String(value) };
    if (check(answer, typed).correct) return;
    if (list.some((m) => check(m.when, typed).correct)) return;
    // A value like 5,5556 gets typed rounded (5,56 or 5,6): accept a small window around it.
    const exact = Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
    const tolerance = answer.tolerance ?? (exact ? undefined : 0.01);
    const when: AnswerSpec = { kind: "number", value, ...(answer.unit ? { unit: answer.unit } : {}), ...(tolerance ? { tolerance } : {}) };
    // The right answer must never look like this mistake (overlapping tolerances).
    if (check(when, { kind: "text", text: String(answer.value) }).correct) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

/** A choice option: the first one in a list is right; wrong ones with `say` become typical mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Options shuffled with rng, or kept in the given order (`keep`). Duplicates (same English text) are dropped. */
export function choice(rng: Rng | null, opts: Opt[], keep = false): { answer: AnswerSpec; mistakes: Mistake[] } {
  const seen = new Set<string>();
  const unique = opts.filter((o) => {
    const k = E(o.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const idx = unique.map((_, i) => i);
  const order = rng && !keep ? rng.shuffle(idx) : idx;
  const options = order.map((i) => unique[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = unique[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, ...(o.title ? { title: o.title } : {}), say: o.say });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

/** Options in a fixed order (e.g. small to large); `right` is the index of the right one. */
export function fixedChoice(opts: Opt[], right: number): { answer: AnswerSpec; mistakes: Mistake[] } {
  const options = opts.map((o) => o.text);
  const mistakes: Mistake[] = [];
  opts.forEach((o, i) => {
    if (i !== right && o.say) mistakes.push({ when: { kind: "choice", options, correct: i }, ...(o.title ? { title: o.title } : {}), say: o.say });
  });
  return { answer: { kind: "choice", options, correct: right }, mistakes };
}

/** An exercise picture. */
export const visual = (component: unknown, props: Record<string, unknown>): NonNullable<Exercise["visual"]> => ({
  component: component as ComponentType<Record<string, unknown>>,
  props,
});

/** Weighted pick. */
export function weighted<T>(rng: Rng, list: [number, T][]): T {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, v] of list) {
    if ((r -= w) < 0) return v;
  }
  return list[list.length - 1][1];
}

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

/** German genitive of a name: "Mias", "Jonas'". */
export const gen = (name: string) => (/[sßxz]$/.test(name) ? `${name}'` : `${name}s`);

export const NAMES = [
  "Mia", "Leon", "Emma", "Noah", "Lina", "Elias", "Hannah", "Paul", "Sophie", "Ben", "Emilia", "Finn", "Lea", "Jonas", "Amira",
  "Can", "Zeynep", "Luca", "Ida", "Mats", "Aylin", "Milan", "Nele", "Yusuf", "Clara", "Theo", "Leni", "Omar", "Jana", "Malik",
];

export const ANSWER = tx("**Answer:**", "**Antwort:**");

const COMMA = /(\d),(\d)/g;

/**
 * English uses a decimal point: "7,50 €" becomes "7.50 €" in the English half of every text
 * (and a plain string with a decimal comma becomes bilingual). German stays as it is. Walks
 * lessons and exercises; components and functions are left alone.
 */
export function englishDecimals<T>(x: T): T {
  if (typeof x === "string") return (/\d,\d/.test(x) ? { en: x.replace(COMMA, "$1.$2"), de: x } : x) as T;
  if (Array.isArray(x)) return x.map((v) => englishDecimals(v)) as T;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (typeof o.en === "string" && typeof o.de === "string" && Object.keys(o).length === 2) return { en: o.en.replace(COMMA, "$1.$2"), de: o.de } as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = k === "component" || k === "widget" || typeof v === "function" ? v : englishDecimals(v);
    return out as T;
  }
  return x;
}
