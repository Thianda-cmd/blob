// Small text tools for German and English school notes: which language, sentences, words that
// matter, comparing answers. Pure and deterministic.

import { offsetText, sliceLine, trimLine, type Line } from "./doc";

export type Lang = "de" | "en";

const STOP_DE = new Set(
  (
    "der die das den dem des ein eine einer einem einen eines und oder aber auch als am an auf aus bei bis da dadurch daher damit dann " +
    "dass daß denn doch durch für gegen hat haben hatte hatten hier ihr ihre im in ins ist ja jede jeder jedes kann können man mehr mit " +
    "nach nicht noch nur ob ohne sehr sein seine sich sie sind so sowie über um unter vom von vor war waren was weil welche welcher " +
    "wenn wer werden wie wieder wird wir wo zu zum zur zwischen es er ich du dies diese dieser dieses diesem diesen wurde wurden " +
    "sowohl beim etwa etc bzw usw z b d h oft immer meist viele vielen einige alle allem allen also schon dort heute gibt geben " +
    "seit sondern selbst zwei drei vier fünf eins kein keine keinen dabei dafür darauf darin davon dazu deren dessen ihm ihn ihnen " +
    "uns unser unsere mich mir dich dir euch hatte habe hast wäre wären würde würden muss müssen soll sollen will wollen darf dürfen"
  ).split(" "),
);

const STOP_EN = new Set(
  (
    "the a an and or but also as at by for from in into is are was were be been being of on to with this that these those it its " +
    "they them their there here he she his her we our you your i me my not no so if then than which who whom whose what when where " +
    "why how all any both each few more most other some such only own same too very can will just should would could has have had " +
    "do does did up down out over under again further once about after before between through during above below off while because " +
    "until against e g i etc called can may might must one two three many much often usually always"
  ).split(" "),
);

/** "de" when the text reads German (umlauts, ß and common German words), else "en". */
export function detectLang(text: string, fallback: Lang = "de"): Lang {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (!words.length) return fallback;
  let de = 0;
  let en = 0;
  for (const w of words) {
    if (STOP_DE.has(w)) de++;
    if (STOP_EN.has(w)) en++;
    if (/[äöüß]/.test(w)) de += 0.5;
  }
  if (de === en) return fallback;
  return de > en ? "de" : "en";
}

export const isStopword = (word: string) => STOP_DE.has(word) || STOP_EN.has(word);

/** Lower case, umlauts spelled out, ß → ss, without accents: for comparing words. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** A rough German/English stem, so "Zellen" and "Zelle", "cells" and "cell" count as the same word. */
export function stem(word: string): string {
  let w = fold(word);
  if (w.length <= 4) return w;
  for (const end of ["ungen", "ung", "heit", "keit", "ern", "en", "er", "es", "e", "n", "s", "ies", "ing", "ed"]) {
    if (w.length - end.length >= 4 && w.endsWith(end)) {
      w = w.slice(0, -end.length);
      break;
    }
  }
  return w;
}

/** The words of a text that carry meaning (no stop words, no numbers), as stems. */
export function contentWords(text: string): string[] {
  return (text.match(/\p{L}[\p{L}\p{N}-]*/gu) ?? []).filter((w) => w.length > 2 && !isStopword(w.toLowerCase())).map(stem);
}

/** Abbreviations that end with a full stop but don't end a sentence. */
const ABBREVIATIONS = new Set(
  (
    "z b d h u a bzw usw vgl ca evtl ggf inkl max min mind nr s str sog u.a z.b d.h zb dh bspw insb jh jhd jahrh v chr n chr " +
    "dr prof bzgl etc e g i e vs mr mrs ms st no fig approx eg ie abb kap tab"
  ).split(" "),
);

/**
 * Sentences of a line, as lines. Knows German abbreviations ("z. B.", "d. h.", "ca."), ordinals
 * ("im 19. Jahrhundert", "am 6. Oktober") and decimals ("2.5").
 */
export function sentences(line: Line): Line[] {
  const text = offsetText(line);
  const out: Line[] = [];
  let start = 0;
  const re = /[.!?]+["“”»«)]*(?=\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const before = text.slice(start, m.index);
    const lastWord = before.match(/([\p{L}\d.]+)$/u)?.[1] ?? "";
    const next = text.slice(end).match(/^\s+(\S)/)?.[1] ?? "";
    if (m[0].startsWith(".") && m[0].length === 1) {
      // "z. B." / "d. h." / "ca." / single letters ("S. 12")
      if (ABBREVIATIONS.has(lastWord.toLowerCase().replace(/\.$/, "")) || /^\p{L}$/u.test(lastWord)) continue;
      // "19. Jahrhundert", "6. Oktober": a day or century before the point is an ordinal. A year
      // ("… bis 1918. Er …") ends the sentence.
      if (/^\d{1,2}$/.test(lastWord) && next && !/^[„"(]/.test(next)) continue;
    }
    // The next sentence starts with a capital letter, a digit, a quote or maths; otherwise keep going.
    if (next && !/[\p{Lu}\d„"“(￼]/u.test(next)) continue;
    const s = trimLine(sliceLine(line, start, end));
    if (s.length) out.push(s);
    start = end;
  }
  const rest = trimLine(sliceLine(line, start));
  if (rest.length) out.push(rest);
  return out;
}

/** A stable short id for a string (FNV-1a, base 36). */
export function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(36) + h2.toString(36).slice(0, 4);
}

/** Levenshtein distance, stopping early once it is above `max`. */
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const LEANS = /^[„"(]?(dies|diese|dieser|diesen|dieses|dabei|dadurch|daher|deshalb|deswegen|daraufhin|this|these|that|it|they|its|their|he|she|his|her)\b/i;
const LEANS_IF_VERB = /^[„"(]?(das|er|sie|es|ihr|ihre|ihren|man)\s+(\p{Ll})/iu;

/**
 * A sentence that leans on the one before it: "Diesen Vorgang nennt man …", "Das führte zu …",
 * "It takes place in …" (but not "Das Wettrüsten …", where "das" is just an article).
 */
export function needsContext(text: string): boolean {
  if (LEANS.test(text)) return true;
  const m = LEANS_IF_VERB.exec(text);
  return Boolean(m && m[2] === m[2].toLowerCase() && m[2] !== m[2].toUpperCase());
}

const ARTICLES = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|the|a|an)\s+/i;

/** A term without a leading article ("Die Mitose" → "Mitose"). */
export const withoutArticle = (s: string) => s.replace(ARTICLES, "");

/** For comparing a typed answer: folded, without article, punctuation and extra spaces. */
export function answerKey(s: string): string {
  return fold(withoutArticle(s.trim()))
    .replace(/[^\p{L}\p{N}+\-−=²³]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Is a typed answer right? Small typos are fine in longer words. */
export function sameAnswer(typed: string, expected: string): "exact" | "close" | false {
  const a = answerKey(typed);
  const b = answerKey(expected);
  if (!a) return false;
  if (a === b) return "exact";
  const allowed = b.length >= 12 ? 2 : b.length >= 5 ? 1 : 0;
  return allowed && distance(a, b, allowed) <= allowed ? "close" : false;
}

/** A seeded random generator (mulberry32) for shuffles that stay the same during a round. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
