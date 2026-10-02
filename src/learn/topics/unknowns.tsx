"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Eraser, Minus, Plus, RotateCcw, Shuffle, Wand2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { SolutionPlayer } from "@/learn/components/SolutionPlayer";
import { topicMeta } from "@/learn/catalog";
import { evaluate, parse } from "@/learn/engine/expr";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Linear equations as lists of terms with stable token keys, so every balance
// step morphs: the term that is taken away fades, the others glide into place.
// Keys: sign s<id>, coefficient c<id>, variable v<id>, denominator d<id>,
// bracket factor f<id>, bracket b<id>.

type Tm = { id: string; c: number; x?: boolean; d?: number; sk?: string; ck?: string };
type Br = { id: string; f: number; items: Tm[] };
type Part = Tm | Br;
type Eq = { l: Part[]; r: Part[] };

const isBr = (p: Part): p is Br => "items" in p;
const X = (id: string, c = 1, d?: number): Tm => ({ id, c, x: true, d });
const K = (id: string, c: number): Tm => ({ id, c });
const B = (id: string, f: number, items: Tm[]): Br => ({ id, f, items });

/** German number style: decimal comma. */
function de(v: number): string {
  return String(Math.round(v * 1000) / 1000).replace(".", ",");
}

function tmSrc(t: Tm, first: boolean, keys = true): string {
  const k = (name: string) => (keys ? `#${name}` : "");
  const abs = Math.abs(t.c);
  const sk = t.sk ?? `s${t.id}`;
  const ck = t.ck ?? `c${t.id}`;
  const sign = t.c < 0 ? `-${k(sk)} ` : first ? "" : `+${k(sk)} `;
  if (!t.x) return `${sign}${de(abs)}${k(ck)}`;
  const coef = abs === 1 ? "" : `${de(abs)}${k(ck)} `;
  const body = `${coef}x${k(`v${t.id}`)}`;
  return t.d && t.d > 1 ? `${sign}\\frac{${body}}{${t.d}${k(`d${t.id}`)}}` : `${sign}${body}`;
}

function partSrc(p: Part, first: boolean, keys = true): string {
  if (!isBr(p)) return tmSrc(p, first, keys);
  const k = (name: string) => (keys ? `#${name}` : "");
  const sign = first ? "" : `+${k(`s${p.id}`)} `;
  const f = p.f === 1 ? "" : `${p.f}${k(`f${p.id}`)} `;
  return `${sign}${f}(${p.items.map((t, i) => tmSrc(t, i === 0, keys)).join(" ")})${k(`b${p.id}`)}`;
}

const sideSrc = (s: Part[], keys = true) => (s.length ? s.map((p, i) => partSrc(p, i === 0, keys)).join(" ") : "0");

/** Display source of an equation, with an optional balance step "| −20". */
function eqSrc(e: Eq, op?: string): string {
  return `${sideSrc(e.l)} =#eq ${sideSrc(e.r)}${op ? ` \\quad \\blob{|#bar ${op}}` : ""}`;
}

/** Keys of all tokens of a side without brackets (to highlight a result). */
function sideKeys(s: Tm[]): string[] {
  return s.flatMap((t, i) => {
    const keys: string[] = [];
    if (t.c < 0 || i > 0) keys.push(t.sk ?? `s${t.id}`);
    if (!t.x || Math.abs(t.c) !== 1) keys.push(t.ck ?? `c${t.id}`);
    if (t.x) keys.push(`v${t.id}`);
    if (t.x && t.d && t.d > 1) keys.push(`d${t.id}`);
    return keys;
  });
}

/** The same without keys, for notes and answer options. */
const eqPlain = (e: Eq) => `${sideSrc(e.l, false)} = ${sideSrc(e.r, false)}`;

function evalSide(s: Part[], x: number): number {
  let sum = 0;
  for (const p of s) {
    if (isBr(p)) sum += p.f * evalSide(p.items, x);
    else sum += p.x ? (p.c * x) / (p.d ?? 1) : p.c;
  }
  return sum;
}

const holds = (e: Eq, x: number) => Math.abs(evalSide(e.l, x) - evalSide(e.r, x)) < 1e-9;

function expandSide(s: Part[]): Tm[] {
  const out: Tm[] = [];
  for (const p of s) {
    if (!isBr(p)) {
      out.push(p);
      continue;
    }
    p.items.forEach((t, j) => {
      const next: Tm = { ...t, c: t.c * p.f };
      if (j === 0) next.sk = `s${p.id}`;
      if (t.x && t.c === 1 && p.f !== 1) next.ck = `f${p.id}`;
      out.push(next);
    });
  }
  return out;
}

const xCoef = (s: Tm[]) => s.filter((t) => t.x).reduce((a, t) => a + t.c / (t.d ?? 1), 0);
const kSum = (s: Tm[]) => s.filter((t) => !t.x).reduce((a, t) => a + t.c, 0);
const needsCombine = (s: Tm[]) => s.filter((t) => t.x).length > 1 || s.filter((t) => !t.x).length > 1;

function combineSide(s: Tm[]): Tm[] {
  const xs = s.filter((t) => t.x);
  const ks = s.filter((t) => !t.x);
  const out: Tm[] = [];
  if (xs.length) {
    const c = xCoef(xs);
    if (c !== 0) out.push(xs.length === 1 ? xs[0] : { ...xs[0], c, d: undefined });
  }
  if (ks.length) {
    const c = kSum(ks);
    if (c !== 0) out.push(ks.length === 1 ? ks[0] : { ...ks[0], c });
  }
  return out;
}

function combineNote(s: Tm[]): string[] {
  const out: string[] = [];
  const xs = s.filter((t) => t.x);
  const ks = s.filter((t) => !t.x);
  if (xs.length > 1) out.push(`$${sideSrc(xs, false)} = ${sideSrc([X("n", xCoef(xs))], false)}$`);
  if (ks.length > 1) out.push(`$${sideSrc(ks, false)} = ${de(kSum(ks))}$`);
  return out;
}

// ---------------------------------------------------------------------------
// Bilingual text helpers

/** Join note parts with spaces, in both languages; empty parts are dropped. */
function joinT(...parts: Text[]): Text {
  if (parts.every((p): p is string => typeof p === "string")) return parts.filter(Boolean).join(" ");
  return txMap((_, l) => parts.map((p) => resolveText(p, l)).filter(Boolean).join(" "));
}

/** German genitive of a name: "Lenas", "Jonas’", "Moritz’". */
const deGen = (name: string) => (/[sßxz]$/.test(name) ? `${name}’` : `${name}s`);

/**
 * A sentence with names (or other bilingual parts) in both languages. The builder gets
 * N (a part in the current language) and G (its German genitive) and returns [English, German]:
 * say((N, G) => [`Let $x$ be ${N(a)}'s age.`, `Sei $x$ ${G(a)} Alter.`]).
 */
function say(build: (N: (p: Text) => string, G: (p: Text) => string) => [string, string]): Text {
  return txMap((_, l) => {
    const N = (p: Text) => resolveText(p, l);
    const [en, deText] = build(N, (p) => deGen(N(p)));
    return l === "en" ? en : deText;
  });
}

/** The same display-language source in both languages, only the names differ. */
function both(build: (N: (p: Text) => string) => string): Text {
  const t = txMap((_, l) => build((p) => resolveText(p, l)));
  return typeof t !== "string" && t.en === t.de ? t.en : t;
}

/** "Let $x$ be …" / "Sei $x$ …" */
const letX = (meaning: Text): Text => say((N) => [`Let $x$ be ${N(meaning)}.`, `Sei $x$ ${N(meaning)}.`]);

/** "**Answer:** … Check: $…$." */
const answerCheck = (sentence: Text, check: string): Text => say((N) => [`**Answer:** ${N(sentence)} Check: $${check}$.`, `**Antwort:** ${N(sentence)} Probe: $${check}$.`]);

/** "**Answer:** The number is 7. Check: $…$." */
const numberAnswer = (x: number, check: string) => answerCheck(tx(`The number is ${x}.`, `Die Zahl ist ${x}.`), check);

/** "18, 19 und 20" */
const deList = (items: (string | number)[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`);

// ---------------------------------------------------------------------------
// Solving

type Op = { src: string; note: Text; apply: (s: Tm[]) => Tm[]; result: (other: number) => string };

function nextOp(l: Tm[], r: Tm[], fresh: () => string): Op | null {
  const aL = xCoef(l);
  const aR = xCoef(r);
  if (aL !== 0 && aR !== 0) {
    const k = Math.min(aL, aR);
    const kx = `${k === 1 ? "" : de(k)}x`;
    return {
      src: `-#oS ${k === 1 ? "" : `${de(k)}#oN `}x#oV`,
      note: tx(`Subtract $${kx}$ on both sides, so that $x$ is only on one side.`, `Subtrahiere auf beiden Seiten $${kx}$, damit $x$ nur noch auf einer Seite steht.`),
      apply: (s) =>
        s
          .map((t) => (t.x ? { ...t, c: t.c - k } : t))
          .filter((t) => t.c !== 0),
      result: () => "",
    };
  }
  const xs = aL !== 0 ? l : r;
  const b = kSum(xs);
  if (b !== 0) {
    const id = fresh();
    return {
      src: b > 0 ? `-#oS ${de(b)}#oN` : `+#oS ${de(-b)}#oN`,
      note: b > 0 ? tx(`Subtract ${de(b)} on both sides.`, `Subtrahiere auf beiden Seiten ${de(b)}.`) : tx(`Add ${de(-b)} on both sides.`, `Addiere auf beiden Seiten ${de(-b)}.`),
      apply: (s) => {
        if (!s.some((t) => !t.x)) return [...s, K(id, -b)];
        return s.map((t) => (t.x ? t : { ...t, c: t.c - b })).filter((t) => t.c !== 0);
      },
      result: (o) => (b > 0 ? `$${de(o)} - ${de(b)} = ${de(o - b)}$.` : `$${de(o)} + ${de(-b)} = ${de(o - b)}$.`),
    };
  }
  const t = xs.find((u) => u.x);
  if (!t) return null;
  if (t.d && t.d > 1) {
    const d = t.d;
    return {
      src: `\\cdot#oS ${d}#oN`,
      note: tx(`Multiply both sides by ${d}.`, `Multipliziere beide Seiten mit ${d}.`),
      apply: (s) => s.map((u) => (u.x ? { ...u, d: undefined } : { ...u, c: u.c * d })),
      result: (o) => `$${de(o)} \\cdot ${d} = ${de(o * d)}$.`,
    };
  }
  if (t.c !== 1) {
    const a = t.c;
    return {
      src: `:#oS ${de(a)}#oN`,
      note: tx(`Divide both sides by ${de(a)}.`, `Teile beide Seiten durch ${de(a)}.`),
      apply: (s) => s.map((u) => (u.x ? { ...u, c: 1 } : { ...u, c: u.c / a })),
      result: (o) => `$${de(o)} : ${de(a)} = ${de(o / a)}$.`,
    };
  }
  return null;
}

/** Worked solution of a linear equation: brackets, like terms, balance steps, x = … */
export function solveFrames(start: Eq, startNote: Text, before: Frame[] = []): { frames: Frame[]; x: number } {
  let count = 0;
  const fresh = () => `k${count++}`;
  const frames: Frame[] = [...before, { math: eqSrc(start), note: startNote }];
  let l: Tm[];
  let r: Tm[];
  const brs = [...start.l, ...start.r].filter(isBr);
  if (brs.length) {
    l = expandSide(start.l);
    r = expandSide(start.r);
    const plain = brs.filter((b) => b.f === 1);
    const notes: Text[] = brs
      .filter((b) => b.f !== 1)
      .map((b) => {
        const m = `$${b.f}(${sideSrc(b.items, false)}) = ${sideSrc(expandSide([b]), false)}$`;
        return tx(`Expand: ${m}.`, `Multipliziere die Klammer aus: ${m}.`);
      });
    if (plain.length === 1) {
      const inner = sideSrc(plain[0].items, false);
      notes.push(tx(`A plus in front of $(${inner})$: just drop the brackets.`, `Vor $(${inner})$ steht ein Plus: Die Klammer fällt einfach weg.`));
    }
    if (plain.length > 1) notes.push(tx("A plus in front of the brackets: just drop them.", "Vor den Klammern steht ein Plus: Sie fallen einfach weg."));
    frames.push({ math: eqSrc({ l, r }), note: joinT(...notes) });
  } else {
    l = start.l as Tm[];
    r = start.r as Tm[];
  }
  let carry: Text = "";
  if (needsCombine(l) || needsCombine(r)) {
    const parts = [...combineNote(l), ...combineNote(r)];
    carry = tx(`Combine like terms: ${parts.join(" and ")}.`, `Fasse gleichartige Terme zusammen: ${parts.join(" und ")}.`);
    l = combineSide(l);
    r = combineSide(r);
  }
  for (let guard = 0; guard < 6; guard++) {
    const op = nextOp(l, r, fresh);
    if (!op) break;
    frames.push({ math: eqSrc({ l, r }, op.src), note: joinT(carry, op.note) });
    const xLeft = xCoef(l) !== 0;
    const other = kSum(xLeft ? r : l);
    l = op.apply(l);
    r = op.apply(r);
    carry = op.result(other);
  }
  if (xCoef(l) === 0) {
    frames.push({ math: eqSrc({ l, r }), note: joinT(carry, tx("Swap the two sides, so $x$ is on the left.", "Vertausche die beiden Seiten, damit $x$ links steht.")) });
    [l, r] = [r, l];
    carry = "";
  }
  const x = kSum(r);
  frames.push({ math: eqSrc({ l, r }), highlight: [...sideKeys(l), "eq", ...sideKeys(r)], note: joinT(carry, tx(`So $x = ${de(x)}$.`, `Also ist $x = ${de(x)}$.`)) });
  return { frames, x };
}

// ---------------------------------------------------------------------------
// Stories → exercises

type Story = {
  text: Text;
  /** Frames that introduce x and the other parts (keys matching the equation). */
  define: Frame[];
  eq: Eq;
  eqNote: Text;
  x: number;
  /** Extra frame when the question asks for something other than x. */
  derived?: { src: string; note: Text };
  answer: AnswerSpec;
  answerText: Text;
  hint: Text;
  /** "the number", "Ben's share in €"… for multiple choice. */
  meaning: Text;
};

const SOLVE = tx("Solve with an equation", "Löse mit einer Gleichung");

function story(s: Story, instruction: Text = SOLVE): Exercise {
  const { frames } = solveFrames(s.eq, s.eqNote, s.define);
  if (s.derived) frames.push({ math: s.derived.src, highlight: ["res"], note: joinT(s.derived.note, s.answerText) });
  else {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, note: joinT(last.note ?? "", s.answerText) };
  }
  return { instruction, text: s.text, answer: s.answer, hint: s.hint, solution: frames };
}

/** "Which equation fits the story?" with wrong options that really are wrong. */
function choiceOf(s: Story, wrong: Eq[], rng: Rng): Exercise {
  const right = eqPlain(s.eq);
  const seen = new Set([right]);
  const pool: string[] = [];
  for (const e of wrong) {
    const p = eqPlain(e);
    if (seen.has(p) || holds(e, s.x)) continue;
    seen.add(p);
    pool.push(p);
  }
  const options = rng.shuffle([right, ...rng.shuffle(pool).slice(0, 3)]);
  const { frames } = solveFrames(s.eq, joinT(s.eqNote, tx("That's the equation.", "Das ist die Gleichung.")), s.define);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: joinT(last.note ?? "", s.answerText) };
  return {
    instruction: tx("Which equation fits the story?", "Welche Gleichung passt zur Geschichte?"),
    text: say((N) => [`${N(s.text)}\n\nLet $x$ be ${N(s.meaning)}.`, `${N(s.text)}\n\nSei $x$ ${N(s.meaning)}.`]),
    answer: { kind: "choice", options: options.map((o) => `$${o}$`), correct: options.indexOf(right) },
    hint: tx(
      "Translate the story piece by piece. Which parts belong together, and do they need brackets?",
      "Übersetze die Geschichte Stück für Stück. Welche Teile gehören zusammen, und brauchen sie Klammern?",
    ),
    solution: frames,
  };
}

// The German stories use their own (equally typical) names, picked with the same random draw.
const NAMES_EN = ["Mia", "Leon", "Emma", "Noah", "Lina", "Elias", "Hannah", "Paul", "Sophie", "Ben", "Finn", "Lea", "Jonas", "Amira", "Can", "Zeynep", "Luca", "Ida", "Mats", "Aylin", "Nele", "Yusuf", "Clara", "Theo", "Omar", "Jana"];
const NAMES_DE = ["Marie", "Lukas", "Emilia", "Felix", "Luisa", "Jakob", "Johanna", "Moritz", "Charlotte", "Henri", "Anton", "Frieda", "Niklas", "Elif", "Emre", "Leyla", "Luis", "Greta", "Ole", "Selin", "Merle", "Mehmet", "Lotta", "Karl", "Samir", "Pia"];
const SHORT_EN = ["Ida", "Ben", "Can", "Mia", "Tim", "Lea", "Ali", "Finn", "Nele", "Emma", "Paul", "Noah", "Lina", "Jana", "Omar", "Max", "Ella", "Jan"];
const SHORT_DE = ["Pia", "Tom", "Ole", "Lia", "Kai", "Mara", "Elif", "Lars", "Ina", "Lotte", "Nils", "Jule", "Rosa", "Till", "Eda", "Leni", "Anna", "Malte"];
const NAMES: Text[] = NAMES_EN.map((n, i) => tx(n, NAMES_DE[i]));
const SHORT: Text[] = SHORT_EN.map((n, i) => tx(n, SHORT_DE[i]));

function names(rng: Rng, n: number, list = SHORT): Text[] {
  return rng.shuffle(list).slice(0, n);
}

const PART: Record<"en" | "de", Record<number, [string, string]>> = {
  en: { 2: ["Half", "half"], 3: ["A third", "a third"], 4: ["A quarter", "a quarter"], 5: ["A fifth", "a fifth"] },
  de: { 2: ["Die Hälfte", "die Hälfte"], 3: ["Ein Drittel", "ein Drittel"], 4: ["Ein Viertel", "ein Viertel"], 5: ["Ein Fünftel", "ein Fünftel"] },
};
const TIMES: Record<"en" | "de", Record<number, string>> = {
  en: { 2: "twice", 3: "three times", 4: "four times", 5: "five times" },
  de: { 2: "doppelt", 3: "dreimal", 4: "viermal", 5: "fünfmal" },
};

const LET_NUMBER = tx("Let $x$ be the number you're looking for.", "Sei $x$ die gesuchte Zahl.");
const defineNumber: Frame = { math: "x#vA", note: LET_NUMBER };
const THE_NUMBER = tx("the number", "die gesuchte Zahl");
const YEARS = tx("years", "Jahre");
const STICKERS = tx("stickers", "Sticker");
const WIDTH_CM = tx("the width in cm", "die Breite in cm");
const START_HINT = tx("Let $x$ be the amount at the start. What happens to it in the story?", "Sei $x$ die Menge am Anfang. Was passiert damit in der Geschichte?");

// ---- Level 1: one step

function riddleAdd(rng: Rng, choice = false): Exercise {
  const x = rng.int(5, 60);
  const b = rng.int(3, 40);
  const c = x + b;
  const s: Story = {
    text: rng.pick([
      tx(`I think of a number and add ${b}. The result is ${c}. What is my number?`, `Ich denke mir eine Zahl und addiere ${b}. Das Ergebnis ist ${c}. Wie heißt meine Zahl?`),
      tx(`If you add ${b} to a number, you get ${c}. What is the number?`, `Wenn du ${b} zu einer Zahl addierst, erhältst du ${c}. Wie heißt die Zahl?`),
    ]),
    define: [defineNumber],
    eq: { l: [X("A"), K("b", b)], r: [K("r", c)] },
    eqNote: tx(`Add ${b}: $x + ${b}$. The result is ${c}.`, `Addiere ${b}: $x + ${b}$. Das Ergebnis ist ${c}.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${x} + ${b} = ${c}`),
    hint: tx("Let $x$ be the number. Write the story as an equation, then undo the $+$.", "Sei $x$ die gesuchte Zahl. Schreib die Geschichte als Gleichung und mach dann das $+$ rückgängig."),
    meaning: THE_NUMBER,
  };
  if (choice) return choiceOf(s, [{ l: [X("A"), K("b", -b)], r: [K("r", c)] }, { l: [X("A", b)], r: [K("r", c)] }, { l: [X("A"), K("b", c)], r: [K("r", b)] }], rng);
  return story(s);
}

function riddleSub(rng: Rng, choice = false): Exercise {
  const x = rng.int(20, 90);
  const b = rng.int(3, 19);
  const c = x - b;
  const s: Story = {
    text: rng.pick([
      tx(`I think of a number and subtract ${b}. The result is ${c}. What is my number?`, `Ich denke mir eine Zahl und subtrahiere ${b}. Das Ergebnis ist ${c}. Wie heißt meine Zahl?`),
      tx(`A number decreased by ${b} is ${c}. What is the number?`, `Eine Zahl, vermindert um ${b}, ergibt ${c}. Wie heißt die Zahl?`),
    ]),
    define: [defineNumber],
    eq: { l: [X("A"), K("b", -b)], r: [K("r", c)] },
    eqNote: tx(`Subtract ${b}: $x - ${b}$. The result is ${c}.`, `Subtrahiere ${b}: $x - ${b}$. Das Ergebnis ist ${c}.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${x} - ${b} = ${c}`),
    hint: tx("Let $x$ be the number. Write the story as an equation, then undo the $-$.", "Sei $x$ die gesuchte Zahl. Schreib die Geschichte als Gleichung und mach dann das $-$ rückgängig."),
    meaning: THE_NUMBER,
  };
  if (choice) return choiceOf(s, [{ l: [X("A"), K("b", b)], r: [K("r", c)] }, { l: [K("b", b), X("A", -1)], r: [K("r", c)] }, { l: [X("A")], r: [K("r", c), K("q", -b)] }], rng);
  return story(s);
}

function riddleMul(rng: Rng, choice = false): Exercise {
  const k = rng.int(3, 9);
  const x = rng.int(3, 15);
  const c = k * x;
  const s: Story = {
    text: rng.pick([
      tx(`${k} times a number is ${c}. What is the number?`, `Das ${k}-Fache einer Zahl ist ${c}. Wie heißt die Zahl?`),
      tx(`If I multiply a number by ${k}, I get ${c}. What is my number?`, `Wenn ich eine Zahl mit ${k} multipliziere, erhalte ich ${c}. Wie heißt meine Zahl?`),
    ]),
    define: [defineNumber],
    eq: { l: [X("A", k)], r: [K("r", c)] },
    eqNote: tx(`${k} times the number: $${k}x$. That's ${c}.`, `Das ${k}-Fache der Zahl: $${k}x$. Das ergibt ${c}.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${k} \\cdot ${x} = ${c}`),
    hint: tx(`Let $x$ be the number. Then $${k}x = ${c}$. What undoes "times ${k}"?`, `Sei $x$ die gesuchte Zahl. Dann ist $${k}x = ${c}$. Was macht „mal ${k}“ rückgängig?`),
    meaning: THE_NUMBER,
  };
  if (choice) return choiceOf(s, [{ l: [X("A"), K("b", k)], r: [K("r", c)] }, { l: [X("A", 1, k)], r: [K("r", c)] }, { l: [X("A"), K("b", -k)], r: [K("r", c)] }], rng);
  return story(s);
}

function riddleDiv(rng: Rng, choice = false): Exercise {
  const d = rng.int(2, 5);
  const c = rng.int(3, 15);
  const x = c * d;
  const s: Story = {
    text: tx(`${PART.en[d][0]} of a number is ${c}. What is the number?`, `${PART.de[d][0]} einer Zahl ist ${c}. Wie heißt die Zahl?`),
    define: [defineNumber],
    eq: { l: [X("A", 1, d)], r: [K("r", c)] },
    eqNote: tx(`${PART.en[d][0]} of $x$ means $x$ divided by ${d}: $\\frac{x}{${d}}$.`, `${PART.de[d][0]} von $x$ heißt: $x$ geteilt durch ${d}, also $\\frac{x}{${d}}$.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${x} : ${d} = ${c}`),
    hint: tx(
      `${PART.en[d][0]} of a number is the number divided by ${d}. What undoes "divided by ${d}"?`,
      `${PART.de[d][0]} einer Zahl ist die Zahl geteilt durch ${d}. Was macht „geteilt durch ${d}“ rückgängig?`,
    ),
    meaning: THE_NUMBER,
  };
  if (choice) return choiceOf(s, [{ l: [X("A", d)], r: [K("r", c)] }, { l: [X("A"), K("b", -d)], r: [K("r", c)] }, { l: [X("A"), K("b", d)], r: [K("r", c)] }], rng);
  return story(s);
}

function contextAdd(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const b = rng.int(5, 30);
  const x = rng.int(8, 60);
  const c = x + b;
  const v = rng.pick<{ text: Text; meaning: Text; unit: Text; answer: Text }>([
    {
      text: say((N) => [
        `${N(name)} had some money in the piggy bank. For the birthday, ${N(name)} gets ${b} € more. Now there are ${c} € in the piggy bank. How much money was in it before?`,
        `${N(name)} hatte etwas Geld im Sparschwein. Zum Geburtstag bekommt ${N(name)} ${b} € dazu. Jetzt sind ${c} € im Sparschwein. Wie viel Geld war vorher drin?`,
      ]),
      meaning: tx("the money in the piggy bank before (in €)", "das Geld, das vorher im Sparschwein war (in €)"),
      unit: "€",
      answer: tx(`There were ${x} € in the piggy bank before.`, `Vorher waren ${x} € im Sparschwein.`),
    },
    {
      text: tx(
        `Some people are on a bus. At the next stop, ${b} more people get on and nobody gets off. Now there are ${c} people on the bus. How many were on the bus before?`,
        `In einem Bus sitzen einige Leute. An der nächsten Haltestelle steigen ${b} Leute ein und niemand aus. Jetzt sind ${c} Leute im Bus. Wie viele waren vorher im Bus?`,
      ),
      meaning: tx("the number of people on the bus before", "die Anzahl der Leute, die vorher im Bus waren"),
      unit: tx("people", "Leute"),
      answer: tx(`There were ${x} people on the bus before.`, `Vorher waren ${x} Leute im Bus.`),
    },
    {
      text: say((N) => [
        `${N(name)} has some marbles and wins ${b} more in a game. Now ${N(name)} has ${c} marbles. How many marbles did ${N(name)} have at first?`,
        `${N(name)} hat ein paar Murmeln und gewinnt beim Spielen ${b} dazu. Jetzt hat ${N(name)} ${c} Murmeln. Wie viele Murmeln hatte ${N(name)} am Anfang?`,
      ]),
      meaning: say((N) => [`the number of marbles ${N(name)} had at first`, `die Anzahl der Murmeln, die ${N(name)} am Anfang hatte`]),
      unit: tx("marbles", "Murmeln"),
      answer: say((N) => [`${N(name)} had ${x} marbles at first.`, `${N(name)} hatte am Anfang ${x} Murmeln.`]),
    },
  ]);
  return story({
    text: v.text,
    define: [{ math: "x#vA", note: letX(v.meaning) }],
    eq: { l: [X("A"), K("b", b)], r: [K("r", c)] },
    eqNote: tx(`${b} more: $x + ${b}$. Now it's ${c}.`, `${b} mehr: $x + ${b}$. Jetzt sind es ${c}.`),
    x,
    answer: { kind: "number", value: x, unit: v.unit },
    answerText: answerCheck(v.answer, `${x} + ${b} = ${c}`),
    hint: START_HINT,
    meaning: v.meaning,
  });
}

function contextSub(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const b = rng.int(5, 40);
  const x = rng.int(b + 5, 90);
  const c = x - b;
  const v = rng.pick<{ text: Text; meaning: Text; unit: Text; answer: Text }>([
    {
      text: say((N) => [
        `${N(name)} spends ${b} € on a new game and has ${c} € left. How much money did ${N(name)} have before?`,
        `${N(name)} gibt ${b} € für ein neues Spiel aus und hat noch ${c} € übrig. Wie viel Geld hatte ${N(name)} vorher?`,
      ]),
      meaning: say((N) => [`the money ${N(name)} had before (in €)`, `das Geld, das ${N(name)} vorher hatte (in €)`]),
      unit: "€",
      answer: say((N) => [`${N(name)} had ${x} € before.`, `${N(name)} hatte vorher ${x} €.`]),
    },
    {
      text: tx(
        `Some students are in the school hall. ${b} of them leave. Now ${c} students are still there. How many students were in the hall at first?`,
        `In der Aula sind einige Kinder. ${b} von ihnen gehen. Jetzt sind noch ${c} Kinder da. Wie viele Kinder waren am Anfang in der Aula?`,
      ),
      meaning: tx("the number of students at first", "die Anzahl der Kinder am Anfang"),
      unit: tx("students", "Kinder"),
      answer: tx(`There were ${x} students in the hall at first.`, `Am Anfang waren ${x} Kinder in der Aula.`),
    },
  ]);
  return story({
    text: v.text,
    define: [{ math: "x#vA", note: letX(v.meaning) }],
    eq: { l: [X("A"), K("b", -b)], r: [K("r", c)] },
    eqNote: tx(`${b} fewer: $x - ${b}$. That leaves ${c}.`, `${b} weniger: $x - ${b}$. Übrig bleiben ${c}.`),
    x,
    answer: { kind: "number", value: x, unit: v.unit },
    answerText: answerCheck(v.answer, `${x} - ${b} = ${c}`),
    hint: START_HINT,
    meaning: v.meaning,
  });
}

function contextMul(rng: Rng): Exercise {
  const k = rng.int(3, 8);
  const x = rng.int(2, 9);
  const c = k * x;
  const what = rng.pick([STICKERS, tx("coloured pencils", "Buntstifte"), tx("trading cards", "Sammelkarten")]);
  return story({
    text: say((N) => [
      `${k} identical packs of ${N(what)} cost ${c} € together. How much does one pack cost?`,
      `${k} gleiche Packungen ${N(what)} kosten zusammen ${c} €. Wie viel kostet eine Packung?`,
    ]),
    define: [{ math: "x#vA", note: tx("Let $x$ be the price of one pack in €.", "Sei $x$ der Preis einer Packung in €.") }],
    eq: { l: [X("A", k)], r: [K("r", c)] },
    eqNote: tx(`${k} packs cost $${k}x$. Together that's ${c} €.`, `${k} Packungen kosten $${k}x$. Zusammen sind das ${c} €.`),
    x,
    answer: { kind: "number", value: x, unit: "€" },
    answerText: answerCheck(tx(`One pack costs ${x} €.`, `Eine Packung kostet ${x} €.`), `${k} \\cdot ${x} = ${c}`),
    hint: tx(`Let $x$ be the price of one pack. Then ${k} packs cost $${k}x$.`, `Sei $x$ der Preis einer Packung. Dann kosten ${k} Packungen $${k}x$.`),
    meaning: tx("the price of one pack (in €)", "der Preis einer Packung (in €)"),
  });
}

// ---- Level 2: two steps, consecutive numbers, perimeter

function riddle2(rng: Rng, choice = false): Exercise {
  const k = rng.int(2, 9);
  const x = rng.int(3, 20);
  const b = rng.int(2, 30);
  const plus = rng.chance(0.5) || k * x - b <= 0;
  const c = plus ? k * x + b : k * x - b;
  const verb = plus ? "add" : "subtract";
  const pm = plus ? "plus" : "minus";
  const text =
    k <= 3 && rng.chance(0.5)
      ? tx(
          `If you ${k === 2 ? "double" : "triple"} a number and then ${verb} ${b}, you get ${c}. What is the number?`,
          `Wenn du eine Zahl ${k === 2 ? "verdoppelst" : "verdreifachst"} und dann ${b} ${plus ? "addierst" : "subtrahierst"}, erhältst du ${c}. Wie heißt die Zahl?`,
        )
      : rng.pick([
          tx(
            `If I multiply a number by ${k} and then ${verb} ${b}, I get ${c}. What is my number?`,
            `Wenn ich eine Zahl mit ${k} multipliziere und dann ${b} ${plus ? "addiere" : "subtrahiere"}, erhalte ich ${c}. Wie heißt meine Zahl?`,
          ),
          tx(`${k} times a number, ${pm} ${b}, makes ${c}. Find the number.`, `Das ${k}-Fache einer Zahl ${pm} ${b} ergibt ${c}. Bestimme die Zahl.`),
        ]);
  const sb = plus ? b : -b;
  const s: Story = {
    text,
    define: [defineNumber],
    eq: { l: [X("A", k), K("b", sb)], r: [K("r", c)] },
    eqNote: tx(`Times ${k}: $${k}x$. Then ${pm} ${b}. That makes ${c}.`, `Mal ${k}: $${k}x$. Dann ${pm} ${b}. Das ergibt ${c}.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${k} \\cdot ${x} ${plus ? "+" : "-"} ${b} = ${c}`),
    hint: tx(
      `Let $x$ be the number: $${k}x ${plus ? "+" : "-"} ${b} = ${c}$. Undo the ${pm} first, then the times.`,
      `Sei $x$ die gesuchte Zahl: $${k}x ${plus ? "+" : "-"} ${b} = ${c}$. Mach zuerst das ${plus ? "Plus" : "Minus"} rückgängig, dann das Mal.`,
    ),
    meaning: THE_NUMBER,
  };
  if (choice)
    return choiceOf(
      s,
      [
        { l: [B("A", k, [X("A1"), K("A2", sb)])], r: [K("r", c)] },
        { l: [X("A", k)], r: [K("r", c), K("q", sb)] },
        { l: [X("A", b), K("b", plus ? k : -k)], r: [K("r", c)] },
        { l: [X("A"), K("k", k), K("b", sb)], r: [K("r", c)] },
      ],
      rng,
    );
  return story(s);
}

function riddleFrac2(rng: Rng): Exercise {
  const d = rng.int(2, 4);
  const m = rng.int(3, 12);
  const x = d * m;
  const b = rng.int(2, 20);
  const plus = rng.chance(0.6) || m - b <= 0;
  const c = plus ? m + b : m - b;
  const pm = plus ? "plus" : "minus";
  return story({
    text: tx(
      `If you take ${PART.en[d][1]} of a number and ${plus ? "add" : "subtract"} ${b}, you get ${c}. What is the number?`,
      `Wenn du ${PART.de[d][1]} einer Zahl nimmst und ${b} ${plus ? "addierst" : "subtrahierst"}, erhältst du ${c}. Wie heißt die Zahl?`,
    ),
    define: [defineNumber],
    eq: { l: [X("A", 1, d), K("b", plus ? b : -b)], r: [K("r", c)] },
    eqNote: tx(`${PART.en[d][0]} of $x$ is $\\frac{x}{${d}}$. Then ${pm} ${b}.`, `${PART.de[d][0]} von $x$ ist $\\frac{x}{${d}}$. Dann ${pm} ${b}.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${x} : ${d} ${plus ? "+" : "-"} ${b} = ${c}`),
    hint: tx(
      `${PART.en[d][0]} of $x$ is $\\frac{x}{${d}}$. Undo the ${pm} first, then multiply by ${d}.`,
      `${PART.de[d][0]} von $x$ ist $\\frac{x}{${d}}$. Mach zuerst das ${plus ? "Plus" : "Minus"} rückgängig, dann multipliziere mit ${d}.`,
    ),
    meaning: THE_NUMBER,
  });
}

type ConsecKind = "three" | "two" | "even";

function consecutiveStory(kind: ConsecKind, x: number, ask: "smallest" | "middle" | "largest"): Story {
  const step = kind === "even" ? 2 : 1;
  const count = kind === "two" ? 2 : 3;
  const parts: Part[] = [X("A"), B("B", 1, [X("B1"), K("B2", step)])];
  if (count === 3) parts.push(B("C", 1, [X("C1"), K("C2", 2 * step)]));
  const S = evalSide(parts, x);
  const offset = ask === "smallest" ? 0 : ask === "middle" ? step : (count - 1) * step;
  const nums = Array.from({ length: count }, (_, i) => x + i * step);
  const define =
    count === 2
      ? `x#vA ,#c1 \\quad x#vB1 +#sB2 1#cB2`
      : `x#vA ,#c1 \\quad x#vB1 +#sB2 ${step}#cB2 ,#c2 \\quad x#vC1 +#sC2 ${2 * step}#cC2`;
  const word = ask === "smallest" ? "smallest" : ask === "middle" ? "middle" : count === 2 ? "larger" : "largest";
  const wordDe = ask === "smallest" ? (count === 2 ? "kleinere" : "kleinste") : ask === "middle" ? "mittlere" : count === 2 ? "größere" : "größte";
  const text =
    kind === "three"
      ? tx(
          `The sum of three consecutive whole numbers is ${S}. What is the ${word} number?`,
          `Die Summe von drei aufeinanderfolgenden natürlichen Zahlen ist ${S}. Wie heißt die ${wordDe} Zahl?`,
        )
      : kind === "two"
        ? tx(`Two consecutive whole numbers add up to ${S}. What is the ${word} number?`, `Zwei aufeinanderfolgende natürliche Zahlen ergeben zusammen ${S}. Wie heißt die ${wordDe} Zahl?`)
        : tx(`Three consecutive even numbers add up to ${S}. What is the ${word} of them?`, `Drei aufeinanderfolgende gerade Zahlen ergeben zusammen ${S}. Wie heißt die ${wordDe} von ihnen?`);
  const result = x + offset;
  return {
    text,
    define: [
      {
        math: define,
        note:
          kind === "even"
            ? tx(
                "Let $x$ be the smallest number. Even numbers go up in steps of 2: $x + 2$ and $x + 4$.",
                "Sei $x$ die kleinste Zahl. Gerade Zahlen kommen in Zweierschritten: $x + 2$ und $x + 4$.",
              )
            : count === 2
              ? tx("Let $x$ be the smaller number. The next one is $x + 1$.", "Sei $x$ die kleinere Zahl. Die nächste ist $x + 1$.")
              : tx("Let $x$ be the smallest number. The next ones are $x + 1$ and $x + 2$.", "Sei $x$ die kleinste Zahl. Die nächsten sind $x + 1$ und $x + 2$."),
      },
    ],
    eq: { l: parts, r: [K("r", S)] },
    eqNote: tx(`Their sum is ${S}.`, `Ihre Summe ist ${S}.`),
    x,
    derived: offset
      ? {
          src: `x#vA +#sq ${offset}#cq =#e1 ${x}#cx +#sq2 ${offset}#cq2 =#e2 ${result}#res`,
          note: tx(`The ${word} number is $x + ${offset} = ${result}$.`, `Die ${wordDe} Zahl ist $x + ${offset} = ${result}$.`),
        }
      : undefined,
    answer: { kind: "number", value: result },
    answerText: answerCheck(tx(`The numbers are ${nums.join(", ")}. The ${word} is ${result}.`, `Die Zahlen sind ${deList(nums)}. Die ${wordDe} ist ${result}.`), `${nums.join(" + ")} = ${S}`),
    hint:
      kind === "even"
        ? tx("Let $x$ be the smallest number. The next even numbers are $x + 2$ and $x + 4$.", "Sei $x$ die kleinste Zahl. Die nächsten geraden Zahlen sind $x + 2$ und $x + 4$.")
        : count === 2
          ? tx("Let $x$ be the smaller number. The next one is $x + 1$.", "Sei $x$ die kleinere Zahl. Die nächste ist $x + 1$.")
          : tx("Let $x$ be the smallest number. The next ones are $x + 1$ and $x + 2$.", "Sei $x$ die kleinste Zahl. Die nächsten sind $x + 1$ und $x + 2$."),
    meaning: count === 2 ? tx("the smaller number", "die kleinere Zahl") : tx("the smallest number", "die kleinste Zahl"),
  };
}

function consecutive(rng: Rng, choice = false): Exercise {
  const kind = rng.pick<ConsecKind>(["three", "three", "two", "even"]);
  const x = kind === "even" ? rng.int(2, 30) * 2 : rng.int(5, 60);
  const ask = kind === "two" ? rng.pick(["smallest", "largest"] as const) : rng.pick(["smallest", "middle", "largest"] as const);
  const s = consecutiveStory(kind, x, ask);
  if (choice) {
    const S = evalSide(s.eq.l, x);
    return choiceOf(
      s,
      [
        { l: [X("A"), X("B"), X("C")], r: [K("r", S)] },
        { l: [X("A", kind === "two" ? 2 : 3), K("b", 2)], r: [K("r", S)] },
        { l: [X("A"), B("B", 1, [X("B1"), K("B2", 2)]), B("C", 1, [X("C1"), K("C2", 4)])], r: [K("r", S)] },
        { l: [X("A"), B("B", 1, [X("B1"), K("B2", 1)]), B("C", 1, [X("C1"), K("C2", 2)])], r: [K("r", S)] },
        { l: [X("A"), K("b", 1), K("c", 2)], r: [K("r", S)] },
      ],
      rng,
    );
  }
  return story(s);
}

const rectAnswer = (w: number, len: number, check: string) =>
  answerCheck(tx(`The rectangle is ${w} cm wide and ${len} cm long.`, `Das Rechteck ist ${w} cm breit und ${len} cm lang.`), check);

function rectangleStory(width: number, k: number, ask: "width" | "length"): Story {
  const P = 2 * width + 2 * (width + k);
  const len = width + k;
  return {
    text: tx(
      `A rectangle is ${k} cm longer than it is wide. Its perimeter is ${P} cm. How ${ask === "width" ? "wide" : "long"} is the rectangle?`,
      `Ein Rechteck ist ${k} cm länger als breit. Sein Umfang beträgt ${P} cm. Wie ${ask === "width" ? "breit" : "lang"} ist das Rechteck?`,
    ),
    define: [
      {
        math: tx(`"width:"#lw x#vW ,#c1 \\quad "length:"#ll x#vL1 +#sL2 ${k}#cL2`, `"Breite:"#lw x#vW ,#c1 \\quad "Länge:"#ll x#vL1 +#sL2 ${k}#cL2`),
        note: tx(`Let $x$ be the width in cm. The length is ${k} cm more: $x + ${k}$.`, `Sei $x$ die Breite in cm. Die Länge ist ${k} cm mehr: $x + ${k}$.`),
      },
    ],
    eq: { l: [X("W", 2), B("L", 2, [X("L1"), K("L2", k)])], r: [K("r", P)] },
    eqNote: tx(`The perimeter is two widths plus two lengths: $2x + 2(x + ${k})$.`, `Der Umfang besteht aus zwei Breiten und zwei Längen: $2x + 2(x + ${k})$.`),
    x: width,
    derived:
      ask === "length"
        ? { src: `x#vW +#sq ${k}#cq =#e1 ${width}#cx +#sq2 ${k}#cq2 =#e2 ${len}#res`, note: tx(`The length is $x + ${k} = ${len}$.`, `Die Länge ist $x + ${k} = ${len}$.`) }
        : undefined,
    answer: { kind: "number", value: ask === "width" ? width : len, unit: "cm" },
    answerText: rectAnswer(width, len, `2 \\cdot ${width} + 2 \\cdot ${len} = ${P}`),
    hint: tx(
      "Let $x$ be the width. Then the length is $x$ plus the difference. Perimeter = 2 · width + 2 · length.",
      "Sei $x$ die Breite. Dann ist die Länge $x$ plus der Unterschied. Umfang = 2 · Breite + 2 · Länge.",
    ),
    meaning: WIDTH_CM,
  };
}

function perimeter(rng: Rng): Exercise {
  if (rng.chance(0.6)) return story(rectangleStory(rng.int(3, 15), rng.int(2, 9), rng.chance(0.5) ? "width" : "length"));
  const base = rng.int(4, 14);
  const k = rng.int(2, 7);
  const P = base + 2 * (base + k);
  return story({
    text: tx(
      `In an isosceles triangle, each of the two equal sides is ${k} cm longer than the base. The perimeter is ${P} cm. How long is the base?`,
      `In einem gleichschenkligen Dreieck ist jeder der beiden Schenkel ${k} cm länger als die Basis. Der Umfang beträgt ${P} cm. Wie lang ist die Basis?`,
    ),
    define: [
      {
        math: tx(`"base:"#lb x#vA ,#c1 \\quad "sides:"#ls x#vL1 +#sL2 ${k}#cL2`, `"Basis:"#lb x#vA ,#c1 \\quad "Schenkel:"#ls x#vL1 +#sL2 ${k}#cL2`),
        note: tx(`Let $x$ be the base in cm. Each of the other two sides is $x + ${k}$.`, `Sei $x$ die Basis in cm. Jeder der beiden Schenkel ist $x + ${k}$ lang.`),
      },
    ],
    eq: { l: [X("A"), B("L", 2, [X("L1"), K("L2", k)])], r: [K("r", P)] },
    eqNote: tx(`The perimeter is the base plus two equal sides: $x + 2(x + ${k})$.`, `Der Umfang ist die Basis plus zwei Schenkel: $x + 2(x + ${k})$.`),
    x: base,
    answer: { kind: "number", value: base, unit: "cm" },
    answerText: answerCheck(tx(`The base is ${base} cm long.`, `Die Basis ist ${base} cm lang.`), `${base} + 2 \\cdot ${base + k} = ${P}`),
    hint: tx("Let $x$ be the base. The two equal sides are each $x$ plus the difference.", "Sei $x$ die Basis. Jeder der beiden Schenkel ist $x$ plus der Unterschied."),
    meaning: tx("the base in cm", "die Basis in cm"),
  });
}

function sumAgesStory(older: Text, younger: Text, x: number, k: number, ask: "younger" | "older"): Story {
  const S = 2 * x + k;
  const asked = ask === "younger" ? younger : older;
  return {
    text: say((N) => [
      `${N(older)} is ${k} years older than ${N(younger)}. Together they are ${S} years old. How old is ${N(asked)}?`,
      `${N(older)} ist ${k} Jahre älter als ${N(younger)}. Zusammen sind sie ${S} Jahre alt. Wie alt ist ${N(asked)}?`,
    ]),
    define: [
      {
        math: both((N) => `"${N(younger)}:"#ly x#vA ,#c1 \\quad "${N(older)}:"#lo x#vP1 +#sP2 ${k}#cP2`),
        note: say((N, G) => [`Let $x$ be ${N(younger)}'s age. ${N(older)} is $x + ${k}$.`, `Sei $x$ ${G(younger)} Alter. ${N(older)} ist $x + ${k}$.`]),
      },
    ],
    eq: { l: [X("A"), B("P", 1, [X("P1"), K("P2", k)])], r: [K("r", S)] },
    eqNote: tx(`Together means: add both ages.`, `Zusammen heißt: Addiere die beiden Alter.`),
    x,
    derived:
      ask === "older"
        ? { src: `x#vA +#sq ${k}#cq =#e1 ${x}#cx +#sq2 ${k}#cq2 =#e2 ${x + k}#res`, note: say((N) => [`${N(older)} is $x + ${k} = ${x + k}$.`, `${N(older)} ist $x + ${k} = ${x + k}$.`]) }
        : undefined,
    answer: { kind: "number", value: ask === "younger" ? x : x + k, unit: YEARS },
    answerText: answerCheck(
      say((N) => [`${N(younger)} is ${x} and ${N(older)} is ${x + k} years old.`, `${N(younger)} ist ${x} und ${N(older)} ${x + k} Jahre alt.`]),
      `${x} + ${x + k} = ${S}`,
    ),
    hint: say((N, G) => [`Let $x$ be ${N(younger)}'s age. Then ${N(older)} is $x + ${k}$.`, `Sei $x$ ${G(younger)} Alter. Dann ist ${N(older)} $x + ${k}$.`]),
    meaning: say((N, G) => [`${N(younger)}'s age`, `${G(younger)} Alter`]),
  };
}

function sumAges(rng: Rng, choice = false): Exercise {
  const [a, b] = names(rng, 2);
  const x = rng.int(6, 15);
  const k = rng.int(2, 9);
  const s = sumAgesStory(a, b, x, k, rng.chance(0.6) ? "younger" : "older");
  if (choice) {
    const S = 2 * x + k;
    return choiceOf(s, [{ l: [X("A"), K("b", k)], r: [K("r", S)] }, { l: [X("A"), X("B", k)], r: [K("r", S)] }, { l: [X("A", 2)], r: [K("r", S), K("q", k)] }], rng);
  }
  return story(s);
}

function ticketFee(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const n = rng.int(2, 6);
  const x = rng.int(8, 45);
  const f = rng.int(2, 6);
  const T = n * x + f;
  return story({
    text: say((N) => [
      `A concert ticket costs the same for everyone. For each order there is also a booking fee of ${f} €. ${N(name)} orders ${n} tickets and pays ${T} € in total. How much does one ticket cost?`,
      `Eine Konzertkarte kostet für alle gleich viel. Pro Bestellung kommt noch eine Servicegebühr von ${f} € dazu. ${N(name)} bestellt ${n} Karten und zahlt insgesamt ${T} €. Wie viel kostet eine Karte?`,
    ]),
    define: [{ math: "x#vA", note: tx("Let $x$ be the price of one ticket in €.", "Sei $x$ der Preis einer Karte in €.") }],
    eq: { l: [X("A", n), K("b", f)], r: [K("r", T)] },
    eqNote: tx(`${n} tickets cost $${n}x$, plus the fee of ${f} €.`, `${n} Karten kosten $${n}x$, dazu kommt die Gebühr von ${f} €.`),
    x,
    answer: { kind: "number", value: x, unit: "€" },
    answerText: answerCheck(tx(`One ticket costs ${x} €.`, `Eine Karte kostet ${x} €.`), `${n} \\cdot ${x} + ${f} = ${T}`),
    hint: tx(`Let $x$ be the price of one ticket. ${n} tickets plus the fee make ${T} €.`, `Sei $x$ der Preis einer Karte. ${n} Karten plus Gebühr ergeben ${T} €.`),
    meaning: tx("the price of one ticket (in €)", "der Preis einer Karte (in €)"),
  });
}

function taxi(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const per = rng.pick([2, 3]);
  const base = rng.int(3, 5);
  const x = rng.int(3, 20);
  const T = per * x + base;
  return story({
    text: say((N, G) => [
      `A taxi ride costs ${base} € to start, plus ${per} € for every kilometre. ${N(name)}'s ride costs ${T} €. How many kilometres long was the ride?`,
      `Eine Taxifahrt kostet ${base} € Grundgebühr und dazu ${per} € pro Kilometer. ${G(name)} Fahrt kostet ${T} €. Wie viele Kilometer lang war die Fahrt?`,
    ]),
    define: [{ math: "x#vA", note: tx("Let $x$ be the length of the ride in km.", "Sei $x$ die Länge der Fahrt in km.") }],
    eq: { l: [X("A", per), K("b", base)], r: [K("r", T)] },
    eqNote: tx(`${per} € per km: $${per}x$. Plus the ${base} € start price.`, `${per} € pro km: $${per}x$. Dazu kommt die Grundgebühr von ${base} €.`),
    x,
    answer: { kind: "number", value: x, unit: "km" },
    answerText: answerCheck(tx(`The ride was ${x} km long.`, `Die Fahrt war ${x} km lang.`), `${per} \\cdot ${x} + ${base} = ${T}`),
    hint: tx(
      `Let $x$ be the number of km. Each km costs ${per} €, and the start price is added once.`,
      `Sei $x$ die Anzahl der Kilometer. Jeder km kostet ${per} €, die Grundgebühr kommt einmal dazu.`,
    ),
    meaning: tx("the length of the ride in km", "die Länge der Fahrt in km"),
  });
}

function rectangleTimes(rng: Rng): Exercise {
  const k = rng.int(2, 4);
  const w = rng.int(2, 12);
  const P = 2 * w + 2 * k * w;
  const ask = rng.chance(0.5) ? "wide" : "long";
  return story({
    text: tx(
      `A rectangle is ${TIMES.en[k]} as long as it is wide. Its perimeter is ${P} cm. How ${ask} is it?`,
      `Ein Rechteck ist ${TIMES.de[k]} so lang wie breit. Sein Umfang beträgt ${P} cm. Wie ${ask === "wide" ? "breit" : "lang"} ist es?`,
    ),
    define: [
      {
        math: tx(`"width:"#lw x#vA ,#c1 \\quad "length:"#ll ${k}#cB x#vB`, `"Breite:"#lw x#vA ,#c1 \\quad "Länge:"#ll ${k}#cB x#vB`),
        note: tx(`Let $x$ be the width in cm. The length is $${k}x$.`, `Sei $x$ die Breite in cm. Die Länge ist $${k}x$.`),
      },
    ],
    eq: { l: [X("A"), X("B", k), X("C"), X("D", k)], r: [K("r", P)] },
    eqNote: tx("Go once around: width, length, width, length.", "Einmal ringsherum: Breite, Länge, Breite, Länge."),
    x: w,
    derived:
      ask === "long"
        ? { src: `${k}#cq x#vA =#e1 ${k}#cq2 \\cdot#dt ${w}#cx =#e2 ${k * w}#res`, note: tx(`The length is $${k}x = ${k * w}$.`, `Die Länge ist $${k}x = ${k * w}$.`) }
        : undefined,
    answer: { kind: "number", value: ask === "wide" ? w : k * w, unit: "cm" },
    answerText: rectAnswer(w, k * w, `${w} + ${k * w} + ${w} + ${k * w} = ${P}`),
    hint: tx(`Let $x$ be the width. The length is $${k}x$. Add all four sides.`, `Sei $x$ die Breite. Die Länge ist $${k}x$. Addiere alle vier Seiten.`),
    meaning: WIDTH_CM,
  });
}

// ---- Level 3: ages, sharing, brackets

const MUM = tx("Mum", "Mama");
const DAD = tx("Dad", "Papa");
const PARENTS: Text[] = [MUM, DAD];

/** Parent is k times as old as the child; in n years m times as old. */
export function ageFutureStory(child: Text, parent: Text, k: number, m: number, n: number, ask: "child" | "parent" = "child"): Story {
  const x = (n * (m - 1)) / (k - m);
  const twice = m === 2 ? "twice" : "three times";
  const twiceDe = m === 2 ? "doppelt" : "dreimal";
  const asked = ask === "child" ? child : parent;
  return {
    text: say((N) => [
      `${N(parent)} is ${TIMES.en[k]} as old as ${N(child)}. In ${n} years, ${N(parent)} will be ${twice} as old as ${N(child)}. How old is ${N(asked)} now?`,
      `${N(parent)} ist ${TIMES.de[k]} so alt wie ${N(child)}. In ${n} Jahren ist ${N(parent)} ${twiceDe} so alt wie ${N(child)}. Wie alt ist ${N(asked)} heute?`,
    ]),
    define: [
      {
        math: both((N) => `"${N(child)}:"#lc x#va ,#c1 \\quad "${N(parent)}:"#lp ${k}#cb x#vb`),
        note: say((N, G) => [
          `Let $x$ be ${N(child)}'s age now. ${N(parent)} is ${TIMES.en[k]} as old: $${k}x$.`,
          `Sei $x$ ${G(child)} heutiges Alter. ${N(parent)} ist ${TIMES.de[k]} so alt: $${k}x$.`,
        ]),
      },
      {
        math: both((N) => `"${N(child)}:"#lc x#va +#sn1 ${n}#cn1 ,#c1 \\quad "${N(parent)}:"#lp ${k}#cb x#vb +#sn2 ${n}#cn2`),
        note: tx(`In ${n} years, **both** are ${n} years older.`, `In ${n} Jahren sind **beide** ${n} Jahre älter.`),
      },
    ],
    eq: { l: [X("b", k), K("n2", n)], r: [B("z", m, [X("a"), K("n1", n)])] },
    eqNote: say((N, G) => [
      `Then ${N(parent)} is ${twice} as old as ${N(child)}. The **whole** age of ${N(child)} is multiplied, so it needs brackets.`,
      `Dann ist ${N(parent)} ${twiceDe} so alt wie ${N(child)}. ${G(child)} **ganzes** Alter wird mit ${m} multipliziert, deshalb braucht es Klammern.`,
    ]),
    x,
    derived:
      ask === "parent"
        ? { src: `${k}#cq x#va =#e1 ${k}#cq2 \\cdot#dt ${x}#cx =#e2 ${k * x}#res`, note: say((N) => [`${N(parent)} is $${k}x = ${k * x}$ years old.`, `${N(parent)} ist $${k}x = ${k * x}$ Jahre alt.`]) }
        : undefined,
    answer: { kind: "number", value: ask === "child" ? x : k * x, unit: YEARS },
    answerText: say((N) => [
      `**Answer:** ${N(child)} is ${x} and ${N(parent)} is ${k * x} years old. Check: in ${n} years they are ${x + n} and ${k * x + n}, and $${k * x + n} = ${m} \\cdot ${x + n}$.`,
      `**Antwort:** ${N(child)} ist ${x} und ${N(parent)} ${k * x} Jahre alt. Probe: In ${n} Jahren sind sie ${x + n} und ${k * x + n}, und $${k * x + n} = ${m} \\cdot ${x + n}$.`,
    ]),
    hint: say((N, G) => [
      `Let $x$ be ${N(child)}'s age now. Write both ages now, then both ages in ${n} years. Careful with brackets!`,
      `Sei $x$ ${G(child)} heutiges Alter. Schreib auf, wie alt beide heute sind und wie alt beide in ${n} Jahren sind. Vorsicht mit den Klammern!`,
    ]),
    meaning: say((N, G) => [`${N(child)}'s age now`, `${G(child)} heutiges Alter`]),
  };
}

const AGE_SETS: [number, number, (rng: Rng) => number][] = [
  [3, 2, (rng) => rng.int(8, 14)],
  [4, 2, (rng) => rng.int(7, 10) * 2],
  [4, 3, (rng) => rng.int(3, 6)],
  [5, 3, (rng) => rng.int(6, 9)],
  [5, 2, (rng) => rng.int(6, 9) * 3],
];

function ageFuture(rng: Rng, choice = false): Exercise {
  const [k, m, nOf] = rng.pick(AGE_SETS);
  const n = nOf(rng);
  const child = rng.pick(NAMES);
  const parent = rng.pick(PARENTS);
  const s = ageFutureStory(child, parent, k, m, n, rng.chance(0.7) ? "child" : "parent");
  if (choice) {
    return choiceOf(
      s,
      [
        { l: [X("b", k), K("n2", n)], r: [X("a", m), K("n1", n)] },
        { l: [B("y", k, [X("b"), K("n2", n)])], r: [B("z", m, [X("a"), K("n1", n)])] },
        { l: [X("b", k)], r: [B("z", m, [X("a"), K("n1", n)])] },
        { l: [X("b", k), K("n2", n)], r: [X("a", m)] },
      ],
      rng,
    );
  }
  return story(s);
}

function ageDiff(rng: Rng): Exercise {
  const child = rng.pick(NAMES);
  const parent = rng.pick(PARENTS);
  const m = rng.chance(0.5) ? 2 : 3;
  let x = 0;
  let n = 0;
  let d = 0;
  for (let i = 0; i < 30; i++) {
    x = m === 2 ? rng.int(6, 14) : rng.int(5, 12);
    n = m === 2 ? rng.int(8, 20) : rng.int(2, 8);
    d = (m - 1) * (x + n);
    if (d >= 22 && d <= 36) break;
  }
  const twice = m === 2 ? "twice" : "three times";
  const twiceDe = m === 2 ? "doppelt" : "dreimal";
  return story({
    text: say((N) => [
      `${N(parent)} is ${d} years older than ${N(child)}. In ${n} years, ${N(parent)} will be ${twice} as old as ${N(child)}. How old is ${N(child)} now?`,
      `${N(parent)} ist ${d} Jahre älter als ${N(child)}. In ${n} Jahren ist ${N(parent)} ${twiceDe} so alt wie ${N(child)}. Wie alt ist ${N(child)} heute?`,
    ]),
    define: [
      {
        math: both((N) => `"${N(child)}:"#lc x#va ,#c1 \\quad "${N(parent)}:"#lp x#vp +#sd ${d}#cd`),
        note: say((N, G) => [`Let $x$ be ${N(child)}'s age now. ${N(parent)} is $x + ${d}$.`, `Sei $x$ ${G(child)} heutiges Alter. ${N(parent)} ist $x + ${d}$.`]),
      },
      {
        math: both((N) => `"${N(child)}:"#lc x#va +#sn1 ${n}#cn1 ,#c1 \\quad "${N(parent)}:"#lp x#vp +#sd ${d}#cd +#sn2 ${n}#cn2`),
        note: tx(`In ${n} years, **both** are ${n} years older.`, `In ${n} Jahren sind **beide** ${n} Jahre älter.`),
      },
    ],
    eq: { l: [X("p"), K("d", d), K("n2", n)], r: [B("z", m, [X("a"), K("n1", n)])] },
    eqNote: say((N, G) => [
      `Then ${N(parent)} is ${twice} as old: the **whole** age of ${N(child)} is multiplied, so it needs brackets.`,
      `Dann ist ${N(parent)} ${twiceDe} so alt: ${G(child)} **ganzes** Alter wird mit ${m} multipliziert, deshalb braucht es Klammern.`,
    ]),
    x,
    answer: { kind: "number", value: x, unit: YEARS },
    answerText: say((N) => [
      `**Answer:** ${N(child)} is ${x} years old now. Check: in ${n} years they are ${x + n} and ${x + d + n}, and $${x + d + n} = ${m} \\cdot ${x + n}$.`,
      `**Antwort:** ${N(child)} ist heute ${x} Jahre alt. Probe: In ${n} Jahren sind sie ${x + n} und ${x + d + n}, und $${x + d + n} = ${m} \\cdot ${x + n}$.`,
    ]),
    hint: say((N, G) => [
      `Let $x$ be ${N(child)}'s age now. Then ${N(parent)} is $x + ${d}$. In ${n} years, add ${n} to **both** ages.`,
      `Sei $x$ ${G(child)} heutiges Alter. Dann ist ${N(parent)} $x + ${d}$. In ${n} Jahren sind **beide** ${n} Jahre älter.`,
    ]),
    meaning: say((N, G) => [`${N(child)}'s age now`, `${G(child)} heutiges Alter`]),
  });
}

type ShareKind = "twiceMore" | "tripleLess" | "moreThanB";

export function shareStory(who: [Text, Text, Text], kind: ShareKind, x: number, k: number, ask: 0 | 1 | 2, money: boolean): Story {
  const [A, Bn, C] = who;
  const bc = kind === "tripleLess" ? 3 : 2;
  const c1 = kind === "moreThanB" ? 2 : 1;
  const ck = kind === "tripleLess" ? -k : k;
  const parts: Part[] = [X("A"), X("B", bc), B("C", 1, [X("C1", c1), K("C2", ck)])];
  const T = evalSide(parts, x);
  const vals = [x, bc * x, c1 * x + ck];
  const u = (v: number): Text => (money ? `${v} €` : tx(`${v} stickers`, `${v} Sticker`));
  const cExpr = sideSrc([X("n", c1), K("m", ck)], false);
  const sentenceB = say((N) => [`${N(Bn)} gets ${TIMES.en[bc]} as ${money ? "much" : "many"} as ${N(A)}.`, `${N(Bn)} bekommt ${TIMES.de[bc]} so ${money ? "viel" : "viele"} wie ${N(A)}.`]);
  const sentenceC = say((N) =>
    money
      ? kind === "twiceMore"
        ? [`${N(C)} gets ${k} € more than ${N(A)}.`, `${N(C)} bekommt ${k} € mehr als ${N(A)}.`]
        : kind === "tripleLess"
          ? [`${N(C)} gets ${k} € less than ${N(A)}.`, `${N(C)} bekommt ${k} € weniger als ${N(A)}.`]
          : [`${N(C)} gets ${k} € more than ${N(Bn)}.`, `${N(C)} bekommt ${k} € mehr als ${N(Bn)}.`]
      : kind === "twiceMore"
        ? [`${N(C)} gets ${k} more stickers than ${N(A)}.`, `${N(C)} bekommt ${k} Sticker mehr als ${N(A)}.`]
        : kind === "tripleLess"
          ? [`${N(C)} gets ${k} fewer stickers than ${N(A)}.`, `${N(C)} bekommt ${k} Sticker weniger als ${N(A)}.`]
          : [`${N(C)} gets ${k} more stickers than ${N(Bn)}.`, `${N(C)} bekommt ${k} Sticker mehr als ${N(Bn)}.`],
  );
  const asked = who[ask];
  const derived =
    ask === 0
      ? undefined
      : ask === 1
        ? { src: `${bc}#cq x#vA =#e1 ${bc}#cq2 \\cdot#dt ${x}#cx =#e2 ${vals[1]}#res`, note: say((N) => [`${N(Bn)} gets $${bc}x = ${vals[1]}$.`, `${N(Bn)} bekommt $${bc}x = ${vals[1]}$.`]) }
        : {
            src: `${c1 === 1 ? "" : `${c1}#cp `}x#vA ${ck < 0 ? "-" : "+"}#sq ${Math.abs(ck)}#cq =#e1 ${c1 === 1 ? "" : `${c1}#cp2 \\cdot#dt `}${x}#cx ${ck < 0 ? "-" : "+"}#sq2 ${Math.abs(ck)}#cq2 =#e2 ${vals[2]}#res`,
            note: say((N) => [`${N(C)} gets $${cExpr} = ${vals[2]}$.`, `${N(C)} bekommt $${cExpr} = ${vals[2]}$.`]),
          };
  return {
    text: say((N) =>
      money
        ? [
            `${N(A)}, ${N(Bn)} and ${N(C)} share ${T} € of prize money. ${resolveText(sentenceB, "en")} ${resolveText(sentenceC, "en")} How much does ${N(asked)} get?`,
            `${N(A)}, ${N(Bn)} und ${N(C)} teilen sich ${T} € Preisgeld. ${resolveText(sentenceB, "de")} ${resolveText(sentenceC, "de")} Wie viel bekommt ${N(asked)}?`,
          ]
        : [
            `${N(A)}, ${N(Bn)} and ${N(C)} share ${T} stickers. ${resolveText(sentenceB, "en")} ${resolveText(sentenceC, "en")} How many stickers does ${N(asked)} get?`,
            `${N(A)}, ${N(Bn)} und ${N(C)} teilen sich ${T} Sticker. ${resolveText(sentenceB, "de")} ${resolveText(sentenceC, "de")} Wie viele Sticker bekommt ${N(asked)}?`,
          ],
    ),
    define: [
      {
        math: both(
          (N) =>
            `"${N(A)}:"#la x#vA ,#c1 \\quad "${N(Bn)}:"#lb ${bc}#cB x#vB ,#c2 \\quad "${N(C)}:"#lc ${c1 === 1 ? "" : `${c1}#cC1 `}x#vC1 ${ck < 0 ? "-" : "+"}#sC2 ${Math.abs(ck)}#cC2`,
        ),
        note: say((N, G) => [
          `The others are compared with ${N(A)}, so let $x$ be ${N(A)}'s share. Then ${N(Bn)} gets $${bc}x$ and ${N(C)} gets $${cExpr}$.`,
          `Die anderen werden mit ${N(A)} verglichen, also sei $x$ ${G(A)} Anteil. Dann bekommt ${N(Bn)} $${bc}x$ und ${N(C)} $${cExpr}$.`,
        ]),
      },
    ],
    eq: { l: parts, r: [K("r", T)] },
    eqNote: say((N) => [`All three shares together make ${N(u(T))}.`, `Alle drei Anteile zusammen ergeben ${N(u(T))}.`]),
    x,
    derived,
    answer: { kind: "number", value: vals[ask], unit: money ? "€" : STICKERS },
    answerText: say((N) => [
      `**Answer:** ${N(asked)} gets ${N(u(vals[ask]))}. Check: $${vals.join(" + ")} = ${T}$.`,
      `**Antwort:** ${N(asked)} bekommt ${N(u(vals[ask]))}. Probe: $${vals.join(" + ")} = ${T}$.`,
    ]),
    hint: say((N, G) => [
      `Let $x$ be ${N(A)}'s share. Write the other two shares with $x$, then add all three.`,
      `Sei $x$ ${G(A)} Anteil. Schreib die beiden anderen Anteile mit $x$ und addiere dann alle drei.`,
    ]),
    meaning: say((N, G) => [`${N(A)}'s share`, `${G(A)} Anteil`]),
  };
}

function share(rng: Rng): Exercise {
  const who = names(rng, 3) as [Text, Text, Text];
  const kind = rng.pick<ShareKind>(["twiceMore", "tripleLess", "moreThanB"]);
  const money = rng.chance(0.7);
  const k = money ? rng.int(1, 6) * 5 : rng.int(3, 12);
  const x = kind === "tripleLess" ? rng.int(k + 3, k + 30) : rng.int(5, 40);
  return story(shareStory(who, kind, x, k, rng.pick([0, 0, 1, 2] as const), money));
}

function ticketsStory(na: number, nc: number, x: number, d: number, ask: "child" | "adult"): Story {
  const T = nc * x + na * (x + d);
  return {
    text: tx(
      `${na} adult tickets and ${nc} child tickets for the zoo cost ${T} € in total. An adult ticket costs ${d} € more than a child ticket. How much does ${ask === "child" ? "a child" : "an adult"} ticket cost?`,
      `${na} Erwachsenenkarten und ${nc} Kinderkarten für den Zoo kosten zusammen ${T} €. Eine Erwachsenenkarte kostet ${d} € mehr als eine Kinderkarte. Wie viel kostet eine ${ask === "child" ? "Kinderkarte" : "Erwachsenenkarte"}?`,
    ),
    define: [
      {
        math: tx(`"child:"#lc x#vA ,#c1 \\quad "adult:"#la x#vB1 +#sB2 ${d}#cB2`, `"Kinder:"#lc x#vA ,#c1 \\quad "Erwachsene:"#la x#vB1 +#sB2 ${d}#cB2`),
        note: tx(`Let $x$ be the price of a child ticket in €. An adult ticket costs $x + ${d}$.`, `Sei $x$ der Preis einer Kinderkarte in €. Eine Erwachsenenkarte kostet $x + ${d}$.`),
      },
    ],
    eq: { l: [X("A", nc), B("B", na, [X("B1"), K("B2", d)])], r: [K("r", T)] },
    eqNote: tx(
      `${nc} child tickets: $${nc}x$. ${na} adult tickets: $${na}(x + ${d})$, the **whole** price times ${na}.`,
      `${nc} Kinderkarten: $${nc}x$. ${na} Erwachsenenkarten: $${na}(x + ${d})$, also der **ganze** Preis mal ${na}.`,
    ),
    x,
    derived:
      ask === "adult"
        ? { src: `x#vA +#sq ${d}#cq =#e1 ${x}#cx +#sq2 ${d}#cq2 =#e2 ${x + d}#res`, note: tx(`An adult ticket costs $x + ${d} = ${x + d}$ €.`, `Eine Erwachsenenkarte kostet $x + ${d} = ${x + d}$ €.`) }
        : undefined,
    answer: { kind: "number", value: ask === "child" ? x : x + d, unit: "€" },
    answerText: answerCheck(
      tx(`A child ticket costs ${x} €, an adult ticket ${x + d} €.`, `Eine Kinderkarte kostet ${x} €, eine Erwachsenenkarte ${x + d} €.`),
      `${nc} \\cdot ${x} + ${na} \\cdot ${x + d} = ${T}`,
    ),
    hint: tx(
      "Let $x$ be the price of a child ticket. An adult ticket costs $x$ plus the difference. Brackets!",
      "Sei $x$ der Preis einer Kinderkarte. Eine Erwachsenenkarte kostet $x$ plus den Unterschied. Klammern!",
    ),
    meaning: tx("the price of a child ticket (in €)", "der Preis einer Kinderkarte (in €)"),
  };
}

function tickets(rng: Rng, choice = false): Exercise {
  const na = rng.int(2, 3);
  let nc = rng.int(2, 4);
  if (nc === na) nc++;
  const x = rng.int(4, 12);
  const d = rng.int(2, 8);
  const s = ticketsStory(na, nc, x, d, rng.chance(0.6) ? "child" : "adult");
  if (choice) {
    const T = nc * x + na * (x + d);
    return choiceOf(
      s,
      [
        { l: [X("A", nc), X("B", na), K("b", d)], r: [K("r", T)] },
        { l: [X("A", nc + na)], r: [K("r", T)] },
        { l: [X("A", nc), B("B", na, [X("B1"), K("B2", -d)])], r: [K("r", T)] },
        { l: [B("A", nc, [X("A1"), K("A2", d)]), X("B", na)], r: [K("r", T)] },
      ],
      rng,
    );
  }
  return story(s);
}

function riddleBrackets(rng: Rng, choice = false): Exercise {
  const k = rng.int(2, 6);
  const plus = rng.chance(0.6);
  const b = rng.int(2, 12);
  const x = plus ? rng.int(2, 20) : rng.int(b + 1, b + 20);
  const sb = plus ? b : -b;
  const c = k * (x + sb);
  const s: Story = {
    text: plus
      ? tx(
          `Add ${b} to a number and multiply the sum by ${k}. The result is ${c}. What is the number?`,
          `Addiert man ${b} zu einer Zahl und multipliziert die Summe mit ${k}, erhält man ${c}. Wie heißt die Zahl?`,
        )
      : tx(
          `Subtract ${b} from a number and multiply the difference by ${k}. The result is ${c}. What is the number?`,
          `Subtrahiert man ${b} von einer Zahl und multipliziert die Differenz mit ${k}, erhält man ${c}. Wie heißt die Zahl?`,
        ),
    define: [{ math: "x#vA1", note: LET_NUMBER }],
    eq: { l: [B("A", k, [X("A1"), K("A2", sb)])], r: [K("r", c)] },
    eqNote: tx(
      `First $x ${plus ? "+" : "-"} ${b}$. Then the **whole** ${plus ? "sum" : "difference"} times ${k}: brackets!`,
      `Zuerst $x ${plus ? "+" : "-"} ${b}$. Dann die **ganze** ${plus ? "Summe" : "Differenz"} mal ${k}: Klammern!`,
    ),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: numberAnswer(x, `${k} \\cdot (${x} ${plus ? "+" : "-"} ${b}) = ${k} \\cdot ${x + sb} = ${c}`),
    hint: tx(
      `The ${plus ? "sum" : "difference"} is multiplied as a whole, so write it in brackets: $${k}(x ${plus ? "+" : "-"} ${b})$.`,
      `Die ${plus ? "Summe" : "Differenz"} wird als Ganzes multipliziert, also kommt sie in Klammern: $${k}(x ${plus ? "+" : "-"} ${b})$.`,
    ),
    meaning: THE_NUMBER,
  };
  if (choice)
    return choiceOf(
      s,
      [
        { l: [X("A1", k), K("A2", sb)], r: [K("r", c)] },
        { l: [K("k", k), B("A", 1, [X("A1"), K("A2", sb)])], r: [K("r", c)] },
        { l: [X("A1"), K("A2", k * sb)], r: [K("r", c)] },
      ],
      rng,
    );
  return story(s);
}

function bothSides(rng: Rng): Exercise {
  let k = 0;
  let x = 0;
  let b = 0;
  let e = 0;
  for (let i = 0; i < 30; i++) {
    k = rng.int(2, 5);
    x = rng.int(3, 15);
    b = rng.int(1, 20);
    e = (k - 1) * x - b;
    if (e > 0) break;
  }
  if (e <= 0) {
    k = 3;
    x = 8;
    b = 6;
    e = 10;
  }
  return story({
    text: tx(
      `If you multiply a number by ${k} and subtract ${b}, you get the same as when you add ${e} to the number. What is the number?`,
      `Multipliziert man eine Zahl mit ${k} und subtrahiert ${b}, erhält man dasselbe, wie wenn man ${e} zu der Zahl addiert. Wie heißt die Zahl?`,
    ),
    define: [defineNumber],
    eq: { l: [X("A", k), K("b", -b)], r: [X("B"), K("e", e)] },
    eqNote: tx(`Left: $${k}x - ${b}$. Right: $x + ${e}$. "The same" means: equals.`, `Links: $${k}x - ${b}$. Rechts: $x + ${e}$. „Dasselbe“ heißt: Beide Seiten sind gleich.`),
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: tx(
      `**Answer:** The number is ${x}. Check: $${k} \\cdot ${x} - ${b} = ${k * x - b}$ and $${x} + ${e} = ${x + e}$.`,
      `**Antwort:** Die Zahl ist ${x}. Probe: $${k} \\cdot ${x} - ${b} = ${k * x - b}$ und $${x} + ${e} = ${x + e}$.`,
    ),
    hint: tx(
      "Both results are equal. Write each side with $x$, then get all the $x$ onto one side.",
      "Beide Ergebnisse sind gleich. Schreib jede Seite mit $x$ und bring dann alle $x$ auf eine Seite.",
    ),
    meaning: THE_NUMBER,
  });
}

const LEVELS: Record<Level, ((rng: Rng) => Exercise)[]> = {
  1: [
    (r) => riddleAdd(r),
    (r) => riddleSub(r),
    (r) => riddleMul(r),
    (r) => riddleDiv(r),
    contextAdd,
    contextSub,
    contextMul,
    (r) => r.pick([riddleAdd, riddleSub, riddleMul, riddleDiv])(r, true),
  ],
  2: [
    (r) => riddle2(r),
    riddleFrac2,
    (r) => consecutive(r),
    perimeter,
    (r) => sumAges(r),
    ticketFee,
    taxi,
    rectangleTimes,
    (r) => r.pick([riddle2, consecutive, sumAges])(r, true),
  ],
  3: [
    (r) => ageFuture(r),
    ageDiff,
    share,
    (r) => tickets(r),
    (r) => riddleBrackets(r),
    bothSides,
    (r) => r.pick([ageFuture, tickets, riddleBrackets])(r, true),
    share,
  ],
};

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 20; tries++) {
    const ex = rng.pick(LEVELS[level])(rng);
    if (ex.answer.kind === "choice" && ex.answer.options.length < 3) continue;
    if (ex.answer.kind === "number" && !(Number.isInteger(ex.answer.value) && ex.answer.value > 0)) continue;
    return ex;
  }
  return riddleAdd(rng);
}

// ---------------------------------------------------------------------------
// Widget 1: from words to maths, piece by piece.

// The German phrases keep the same pieces (and maths) as the English ones, in German word order.
type Piece = { w: Text; m: string };
type Phrase = { label: Text; pieces: Piece[]; order: (number | string)[]; term: string; sub: (x: number) => string; f: (x: number) => number; xs: number[]; tip: Text };

const A_NUMBER = tx("a number", "eine Zahl");
const OF_A_NUMBER = tx("a number", "einer Zahl");
const TWICE = tx("twice", "das Doppelte");

const PHRASES: Phrase[] = [
  {
    label: tx("twice a number", "das Doppelte einer Zahl"),
    pieces: [{ w: TWICE, m: "2 \\cdot" }, { w: OF_A_NUMBER, m: "x" }],
    order: [0, 1],
    term: "2x",
    sub: (x) => `2 \\cdot ${x}`,
    f: (x) => 2 * x,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: tx("Twice means times 2. We write $2x$ instead of $2 \\cdot x$.", "Das Doppelte heißt mal 2. Wir schreiben $2x$ statt $2 \\cdot x$."),
  },
  {
    label: tx("5 more than a number", "5 mehr als eine Zahl"),
    pieces: [{ w: tx("5 more than", "5 mehr als"), m: "+ 5" }, { w: A_NUMBER, m: "x" }],
    order: [1, 0],
    term: "x + 5",
    sub: (x) => `${x} + 5`,
    f: (x) => x + 5,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: tx(
      "The order flips! You read the 5 first, but the number comes first in maths: $x + 5$.",
      "Die Reihenfolge dreht sich um! Du liest die 5 zuerst, aber im Term steht die Zahl vorne: $x + 5$.",
    ),
  },
  {
    label: tx("3 less than a number", "3 weniger als eine Zahl"),
    pieces: [{ w: tx("3 less than", "3 weniger als"), m: "- 3" }, { w: A_NUMBER, m: "x" }],
    order: [1, 0],
    term: "x - 3",
    sub: (x) => `${x} - 3`,
    f: (x) => x - 3,
    xs: [4, 5, 6, 7, 8, 9, 10, 12, 15, 20],
    tip: tx(
      'Careful: "3 less than a number" is $x - 3$, not $3 - x$. Try it with a number!',
      "Vorsicht: „3 weniger als eine Zahl“ ist $x - 3$, nicht $3 - x$. Probier es mit einer Zahl aus!",
    ),
  },
  {
    label: tx("3 minus a number", "3 minus eine Zahl"),
    pieces: [{ w: "3", m: "3" }, { w: "minus", m: "-" }, { w: A_NUMBER, m: "x" }],
    order: [0, 1, 2],
    term: "3 - x",
    sub: (x) => `3 - ${x}`,
    f: (x) => 3 - x,
    xs: [1, 2, 3, 4, 5, 6],
    tip: tx("Here the order stays exactly as you read it: $3 - x$.", "Hier bleibt die Reihenfolge genau so, wie du sie liest: $3 - x$."),
  },
  {
    label: tx("a third of a number", "ein Drittel einer Zahl"),
    pieces: [{ w: tx("a third of", "ein Drittel"), m: ": 3" }, { w: OF_A_NUMBER, m: "x" }],
    order: [1, 0],
    term: "\\frac{x}{3}",
    sub: (x) => `\\frac{${x}}{3}`,
    f: (x) => x / 3,
    xs: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    tip: tx(
      "A third of something means: divide it by 3. As a fraction: $\\frac{x}{3}$.",
      "Ein Drittel von etwas heißt: durch 3 teilen. Als Bruch: $\\frac{x}{3}$.",
    ),
  },
  {
    label: tx("twice a number, plus 4", "das Doppelte einer Zahl, plus 4"),
    pieces: [{ w: TWICE, m: "2 \\cdot" }, { w: OF_A_NUMBER, m: "x" }, { w: "plus 4", m: "+ 4" }],
    order: [0, 1, 2],
    term: "2x + 4",
    sub: (x) => `2 \\cdot ${x} + 4`,
    f: (x) => 2 * x + 4,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: tx("First double, then add 4. No brackets needed.", "Erst verdoppeln, dann 4 addieren. Klammern brauchst du hier nicht."),
  },
  {
    label: tx("twice the sum of a number and 4", "das Doppelte der Summe aus einer Zahl und 4"),
    pieces: [{ w: TWICE, m: "2 \\cdot" }, { w: tx("the sum of", "der Summe aus"), m: "+" }, { w: OF_A_NUMBER, m: "x" }, { w: tx("and 4", "und 4"), m: "4" }],
    order: [0, "(", 2, 1, 3, ")"],
    term: "2(x + 4)",
    sub: (x) => `2 \\cdot (${x} + 4)`,
    f: (x) => 2 * (x + 4),
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: tx(
      'The **whole** sum is doubled, so it needs brackets: $2(x + 4)$. Compare it with "twice a number, plus 4"!',
      "Die **ganze** Summe wird verdoppelt, deshalb braucht sie Klammern: $2(x + 4)$. Vergleiche mit „das Doppelte einer Zahl, plus 4“!",
    ),
  },
  {
    label: tx("the sum of a number and the next one", "die Summe aus einer Zahl und ihrem Nachfolger"),
    pieces: [{ w: tx("the sum of", "die Summe aus"), m: "+" }, { w: OF_A_NUMBER, m: "x" }, { w: tx("and the next one", "und ihrem Nachfolger"), m: "(x + 1)" }],
    order: [1, 0, 2],
    term: "x + (x + 1)",
    sub: (x) => `${x} + ${x + 1}`,
    f: (x) => 2 * x + 1,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: tx(
      'Consecutive numbers: the next one is always $x + 1$. "The sum of A and B" means $A + B$.',
      "Aufeinanderfolgende Zahlen: Der Nachfolger ist immer $x + 1$. „Die Summe aus A und B“ heißt $A + B$.",
    ),
  },
];

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

function Badge({ n, on }: { n: number; on?: boolean }) {
  return (
    <span className={cn("grid size-4 shrink-0 place-items-center rounded-full text-[9.5px] font-bold transition-colors", on ? "bg-blob text-white" : "bg-line text-ink-3")}>{n}</span>
  );
}

function Chip({ id, m, n, appear = true }: { id: string; m: string; n: number; appear?: boolean }) {
  return (
    <motion.span
      layoutId={id}
      initial={appear ? { opacity: 0, y: -10, scale: 0.8 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="inline-flex items-center gap-1.5 rounded-xl border border-blob/30 bg-raised px-2.5 py-1 shadow-card"
    >
      <Badge n={n} on />
      <MathView src={m} size="md" animate={false} />
    </motion.span>
  );
}

function Translator() {
  const t = useText();
  const scope = useId();
  const [sel, setSel] = useState(1);
  const [run, setRun] = useState(0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {PHRASES.map((p, i) => (
          <button
            key={i}
            onClick={() => {
              setSel(i);
              setRun((r) => r + 1);
            }}
            className={cn(
              "relative rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
              sel === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {sel === i && <motion.span layoutId={`${scope}-pick`} className="absolute inset-0 rounded-full bg-blob" transition={spring} />}
            <span className="relative">{t(p.label)}</span>
          </button>
        ))}
      </div>
      <TranslateRun key={`${sel}-${run}`} phrase={PHRASES[sel]} onReplay={() => setRun((r) => r + 1)} />
    </div>
  );
}

function TranslateRun({ phrase, onReplay }: { phrase: Phrase; onReplay: () => void }) {
  const t = useText();
  const scope = useId();
  const n = phrase.pieces.length;
  const [stage, setStage] = useState(0);
  const [xi, setXi] = useState(Math.min(5, phrase.xs.length - 1));
  useEffect(() => {
    if (stage > n + 1) return;
    const timer = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 500 : stage < n ? 850 : 1000);
    return () => clearTimeout(timer);
  }, [stage, n]);
  const assembled = stage > n;
  const done = stage > n + 1;
  const x = phrase.xs[xi];
  const value = phrase.f(x);
  const replay = t(tx("Replay", "Nochmal abspielen"));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface px-4 pb-3 pt-3">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("In words", "In Worten"))}</div>
        <div className="mt-3 flex flex-wrap items-start justify-center gap-x-2.5 gap-y-2">
          {phrase.pieces.map((p, i) => {
            const lit = stage > i;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <motion.span
                  animate={{ scale: stage === i + 1 && !assembled ? 1.06 : 1 }}
                  transition={spring}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[19px] transition-colors duration-300", lit ? "bg-blob-soft text-blob-ink" : "text-ink")}
                >
                  <Badge n={i + 1} on={lit} />
                  {t(p.w)}
                </motion.span>
                <div className="flex h-11 items-start">{lit && !assembled && <Chip id={`${scope}-${i}`} m={p.m} n={i + 1} />}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("In maths", "In Mathe"))}</span>
          <button onClick={onReplay} className="ml-auto grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={replay} title={replay}>
            <RotateCcw className="size-3.5" />
          </button>
        </div>
        <div className="flex min-h-[52px] flex-wrap items-center justify-center gap-1.5">
          {assembled ? (
            phrase.order.map((o, j) =>
              typeof o === "number" ? (
                <Chip key={`p${o}`} id={`${scope}-${o}`} m={phrase.pieces[o].m} n={o + 1} appear={false} />
              ) : (
                <motion.span
                  key={`g${j}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...spring, delay: 0.45 }}
                  className="px-0.5 font-math text-[40px] leading-none text-blob-ink"
                >
                  {o}
                </motion.span>
              ),
            )
          ) : (
            <span className="text-[13px] text-ink-3">{t(tx("Translating piece by piece…", "Wird Stück für Stück übersetzt …"))}</span>
          )}
        </div>
        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line pt-3">
              <span className="text-[13px] text-ink-2">Term:</span>
              <MathView src={phrase.term} size="lg" animate={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.15 }} className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-blob-soft/50 px-4 py-3 text-[14px] leading-relaxed text-ink">
              <Inline text={phrase.tip} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface px-4 py-3">
              <span className="text-[13px] text-ink-2">{t(tx("Test it with", "Teste mit"))}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setXi((i) => Math.max(0, i - 1))}
                  disabled={xi === 0}
                  className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover disabled:opacity-35"
                  aria-label={t(tx("Smaller number", "Kleinere Zahl"))}
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-14 text-center font-math text-[18px]">
                  <i>x</i> = {x}
                </span>
                <button
                  onClick={() => setXi((i) => Math.min(phrase.xs.length - 1, i + 1))}
                  disabled={xi === phrase.xs.length - 1}
                  className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover disabled:opacity-35"
                  aria-label={t(tx("Bigger number", "Größere Zahl"))}
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <MathView src={`${phrase.sub(x)} =#eq ${de(value)}#v`} size="md" scope={`${scope}-test`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget 2: build the equation from chips.

type BuildChip = { id: string; d: string; p: string };
type BuildCase = { text: Text; letX: Text; x0: number; chips: BuildChip[]; show: string[]; hint: Text; answer: Text };

const ch = (id: string, d: string, p = d): BuildChip => ({ id, d, p });

const BUILD: BuildCase[] = [
  {
    text: tx("Lea has 3 times as many stickers as Ben. Together they have 48 stickers.", "Lea hat dreimal so viele Sticker wie Ben. Zusammen haben sie 48 Sticker."),
    letX: tx("Let $x$ be the number of Ben's stickers.", "Sei $x$ die Anzahl von Bens Stickern."),
    x0: 12,
    chips: [ch("x", "x"), ch("3x", "3x"), ch("p", "+"), ch("e", "="), ch("48", "48"), ch("x3", "(x + 3)", "(x+3)"), ch("m", "-"), ch("16", "16")],
    show: ["x", "p", "3x", "e", "48"],
    hint: tx("Ben has $x$, Lea has 3 times as many: $3x$. Together means: add them.", "Ben hat $x$, Lea dreimal so viele: $3x$. Zusammen heißt: addieren."),
    answer: tx("Ben has 12 stickers and Lea has 36.", "Ben hat 12 Sticker und Lea 36."),
  },
  {
    text: tx("The sum of three consecutive numbers is 57.", "Die Summe von drei aufeinanderfolgenden Zahlen ist 57."),
    letX: tx("Let $x$ be the smallest of the three numbers.", "Sei $x$ die kleinste der drei Zahlen."),
    x0: 18,
    chips: [ch("x", "x"), ch("x1", "(x + 1)", "(x+1)"), ch("x2", "(x + 2)", "(x+2)"), ch("p1", "+"), ch("p2", "+"), ch("e", "="), ch("57", "57"), ch("3x", "3x"), ch("x3", "(x + 3)", "(x+3)")],
    show: ["x", "p1", "x1", "p2", "x2", "e", "57"],
    hint: tx("The numbers are $x$, $x + 1$ and $x + 2$. Their sum is 57.", "Die Zahlen sind $x$, $x + 1$ und $x + 2$. Ihre Summe ist 57."),
    answer: tx("The numbers are 18, 19 and 20.", "Die Zahlen sind 18, 19 und 20."),
  },
  {
    text: tx("A rectangle is 4 cm longer than it is wide. Its perimeter is 32 cm.", "Ein Rechteck ist 4 cm länger als breit. Sein Umfang beträgt 32 cm."),
    letX: tx("Let $x$ be the width in cm.", "Sei $x$ die Breite in cm."),
    x0: 6,
    chips: [ch("2x", "2x"), ch("2b", "2(x + 4)", "2(x+4)"), ch("p", "+"), ch("e", "="), ch("32", "32"), ch("x4", "(x + 4)", "(x+4)"), ch("4x", "4x"), ch("8", "8")],
    show: ["2x", "p", "2b", "e", "32"],
    hint: tx("Two widths: $2x$. Two lengths: $2(x + 4)$. Together they make the perimeter.", "Zwei Breiten: $2x$. Zwei Längen: $2(x + 4)$. Zusammen ergeben sie den Umfang."),
    answer: tx("The rectangle is 6 cm wide and 10 cm long.", "Das Rechteck ist 6 cm breit und 10 cm lang."),
  },
  {
    text: tx(
      "3 child tickets and 2 adult tickets cost 43 € in total. An adult ticket costs 4 € more than a child ticket.",
      "3 Kinderkarten und 2 Erwachsenenkarten kosten zusammen 43 €. Eine Erwachsenenkarte kostet 4 € mehr als eine Kinderkarte.",
    ),
    letX: tx("Let $x$ be the price of a child ticket in €.", "Sei $x$ der Preis einer Kinderkarte in €."),
    x0: 7,
    chips: [ch("3x", "3x"), ch("2b", "2(x + 4)", "2(x+4)"), ch("p", "+"), ch("e", "="), ch("43", "43"), ch("2x4", "2x + 4", "2x+4"), ch("5x", "5x"), ch("m", "-")],
    show: ["3x", "p", "2b", "e", "43"],
    hint: tx(
      "An adult ticket costs $x + 4$, and there are 2 of them: $2(x + 4)$. Brackets!",
      "Eine Erwachsenenkarte kostet $x + 4$, und es sind 2 Stück: $2(x + 4)$. Klammern!",
    ),
    answer: tx("A child ticket costs 7 €, an adult ticket 11 €.", "Eine Kinderkarte kostet 7 €, eine Erwachsenenkarte 11 €."),
  },
  {
    text: tx("Mum is 26 years older than Tom. Together they are 50 years old.", "Mama ist 26 Jahre älter als Tom. Zusammen sind sie 50 Jahre alt."),
    letX: tx("Let $x$ be Tom's age.", "Sei $x$ Toms Alter."),
    x0: 12,
    chips: [ch("x", "x"), ch("x26", "(x + 26)", "(x+26)"), ch("p", "+"), ch("e", "="), ch("50", "50"), ch("26x", "26x"), ch("m", "-"), ch("xm", "(x - 26)", "(x-26)")],
    show: ["x", "p", "x26", "e", "50"],
    hint: tx("Tom is $x$. Mum is 26 years older: $x + 26$. Together means: add.", "Tom ist $x$. Mama ist 26 Jahre älter: $x + 26$. Zusammen heißt: addieren."),
    answer: tx("Tom is 12 and Mum is 38 years old.", "Tom ist 12 und Mama 38 Jahre alt."),
  },
];

type Verdict = { ok: true; a: [number, number, number, number] } | { ok: false; msg: Text };

function judge(c: BuildCase, line: BuildChip[]): Verdict {
  if (!line.length) return { ok: false, msg: tx("Tap the chips to build your equation.", "Tippe die Bausteine an, um deine Gleichung zu bauen.") };
  const eqs = line.filter((t) => t.p === "=").length;
  if (eqs !== 1)
    return {
      ok: false,
      msg: eqs === 0 ? tx("An equation needs an equals sign.", "Eine Gleichung braucht ein Gleichheitszeichen.") : tx("Only one equals sign, please.", "Bitte nur ein Gleichheitszeichen."),
    };
  const i = line.findIndex((t) => t.p === "=");
  const L = line.slice(0, i).map((t) => t.p).join(" ");
  const R = line.slice(i + 1).map((t) => t.p).join(" ");
  const pl = L ? parse(L) : null;
  const pr = R ? parse(R) : null;
  if (!pl?.ok || !pr?.ok)
    return { ok: false, msg: tx("That doesn't read as maths yet. Check the order of the chips.", "Das ergibt noch keine Gleichung. Prüf die Reihenfolge der Bausteine.") };
  const Lf = (x: number) => evaluate(pl.ast, { x });
  const Rf = (x: number) => evaluate(pr.ast, { x });
  const g = (x: number) => Lf(x) - Rf(x);
  const linear = Math.abs(g(2) - 2 * g(1) + g(0)) < 1e-9;
  if (linear && Math.abs(g(c.x0)) < 1e-9 && Math.abs(g(c.x0 + 1.37)) > 1e-9) {
    return { ok: true, a: [Lf(1) - Lf(0), Lf(0), Rf(1) - Rf(0), Rf(0)] };
  }
  return { ok: false, msg: c.hint };
}

function BlobSays({ text, mood }: { text: Text; mood: BlobMood }) {
  const line = useText()(text);
  return (
    <div className="flex items-end gap-2.5">
      <div className="shrink-0">
        <Blob size={52} mood={mood} track={false} accessory="glasses" interactive={false} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={line}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={spring}
          style={{ transformOrigin: "bottom left" }}
          className="mb-2 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[14px] leading-snug text-ink shadow-card"
        >
          <Inline text={line} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EquationBuilder() {
  const [n, setN] = useState(0);
  return <BuildRound key={n} c={BUILD[n % BUILD.length]} index={n % BUILD.length} onNext={() => setN((v) => v + 1)} />;
}

function BuildRound({ c, index, onNext }: { c: BuildCase; index: number; onNext: () => void }) {
  const t = useText();
  const scope = useId();
  const [line, setLine] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tries, setTries] = useState(0);
  const [shown, setShown] = useState(false);
  const [speech, setSpeech] = useState<{ text: Text; mood: BlobMood }>({
    text: tx("Tap the chips in the right order. Some of them are traps!", "Tippe die Bausteine in der richtigen Reihenfolge an. Ein paar davon sind Fallen!"),
    mood: "happy",
  });
  const byId = (id: string) => c.chips.find((k) => k.id === id)!;
  const solved = verdict?.ok === true;

  function toggle(id: string) {
    if (solved) return;
    setVerdict(null);
    setLine((l) => (l.includes(id) ? l.filter((v) => v !== id) : [...l, id]));
  }

  function checkLine(ids: string[], fromShow = false) {
    const v = judge(c, ids.map(byId));
    setVerdict(v);
    if (v.ok) {
      setSpeech({
        text: fromShow
          ? tx("Here it is. Watch how it gets solved!", "Hier ist sie. Schau zu, wie sie gelöst wird!")
          : tx("Yes! That equation fits the story. Now watch it get solved.", "Ja! Die Gleichung passt zur Geschichte. Jetzt schau zu, wie sie gelöst wird."),
        mood: "excited",
      });
    } else {
      setTries((n) => n + 1);
      setSpeech({ text: v.msg, mood: "thinking" });
    }
  }

  function showMe() {
    setShown(true);
    setLine(c.show);
    checkLine(c.show, true);
  }

  const frames = verdict?.ok ? builtFrames(c, line.map(byId), verdict.a) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx(`Story ${index + 1}`, `Geschichte ${index + 1}`))}</span>
        <button onClick={onNext} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("Another story", "Andere Geschichte"))}
        </button>
      </div>
      <div className="rounded-xl border border-line bg-surface px-5 py-4 text-[17px] leading-relaxed text-ink">
        <p>{t(c.text)}</p>
        <p className="mt-1.5 text-[15px] text-ink-2">
          <Inline text={c.letX} />
        </p>
      </div>

      <div
        className={cn(
          "flex min-h-[72px] flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 transition-colors",
          solved ? "border-ok/50 bg-ok/[0.06]" : verdict && !verdict.ok ? "border-danger/40" : "border-line-2",
        )}
      >
        {line.length === 0 && <span className="text-[13.5px] text-ink-3">{t(tx("Your equation appears here", "Hier entsteht deine Gleichung"))}</span>}
        {line.map((id) => (
          <BuildToken key={id} chip={byId(id)} layoutId={`${scope}-${id}`} onClick={() => toggle(id)} disabled={solved} />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {c.chips.map((chip) =>
          line.includes(chip.id) ? (
            <span key={chip.id} className="rounded-xl border border-dashed border-line-2 px-3 py-1.5">
              <span className="invisible">
                <MathView src={chip.d} size="md" animate={false} />
              </span>
            </span>
          ) : (
            <BuildToken key={chip.id} chip={chip} layoutId={`${scope}-${chip.id}`} onClick={() => toggle(chip.id)} disabled={solved} />
          ),
        )}
      </div>

      {!solved && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => checkLine(line)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper transition-transform hover:bg-ink/88 active:scale-[0.97]"
          >
            <Check className="size-4" /> {t(tx("Check", "Prüfen"))}
          </button>
          <button
            onClick={() => {
              setLine([]);
              setVerdict(null);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Eraser className="size-4" /> {t(tx("Clear", "Leeren"))}
          </button>
          {tries > 0 && (
            <button onClick={showMe} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              <Wand2 className="size-4" /> {t(tx("Show me", "Zeig’s mir"))}
            </button>
          )}
        </div>
      )}

      <BlobSays text={speech.text} mood={speech.mood} />

      <AnimatePresence>
        {solved && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }} className="space-y-3">
            <SolutionPlayer frames={frames} size="md" interval={1900} />
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 * frames.length }} className="rounded-xl bg-blob-soft/50 px-4 py-3 text-[15px] font-medium text-ink">
              {shown ? "" : t(tx("Your equation works! ", "Deine Gleichung passt! "))}
              {t(c.answer)}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BuildToken({ chip, layoutId, onClick, disabled }: { chip: BuildChip; layoutId: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      layoutId={layoutId}
      transition={spring}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-line bg-raised px-3 py-1.5 shadow-card transition-colors hover:border-blob/50 disabled:cursor-default disabled:hover:border-line"
    >
      <MathView src={chip.d} size="md" animate={false} />
    </motion.button>
  );
}

/** Frames for the student's own equation: as built, tidied up, then solved. */
function builtFrames(c: BuildCase, line: BuildChip[], a: [number, number, number, number]): Frame[] {
  const built: Frame = { math: line.map((t) => t.d).join(" "), note: tx("Your equation, straight from the story.", "Deine Gleichung, direkt aus der Geschichte.") };
  const side = (ax: number, b: number, id: string): Tm[] => [...(ax ? [X(`${id}x`, ax)] : []), ...(b ? [K(`${id}k`, b)] : [])];
  const tidy: Eq = { l: side(a[0], a[1], "l"), r: side(a[2], a[3], "r") };
  const same = eqPlain(tidy).replace(/\s+/g, "") === line.map((t) => t.p).join("").replace(/[()]/g, "");
  const brackets = line.some((t) => t.p.includes("("));
  const tidyNote = brackets
    ? tx("Expand the brackets and combine like terms.", "Löse die Klammern auf und fasse gleichartige Terme zusammen.")
    : tx("Combine like terms.", "Fasse gleichartige Terme zusammen.");
  const { frames } = solveFrames(tidy, same ? tx("Let's solve it with balance steps.", "Jetzt lösen wir sie mit Äquivalenzumformungen.") : tidyNote, same ? [] : [built]);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: joinT(last.note ?? "", c.answer) };
  return frames;
}

// ---------------------------------------------------------------------------
// Lesson

const riddleEq: Eq = { l: [X("A", 3), K("b", 5)], r: [K("r", 26)] };

const nameFrames: Frame[] = [
  {
    math: "x#vA",
    note: tx("**Let** $x$ **be** the number I'm thinking of. Now translate the riddle, piece by piece.", "**Sei** $x$ die Zahl, die ich mir denke. Jetzt übersetzen wir das Rätsel Stück für Stück."),
  },
  { math: "3#cA x#vA", note: tx('"I multiply it by 3": $3x$.', "„Ich multipliziere sie mit 3“: $3x$.") },
  { math: "3#cA x#vA +#sb 5#cb", note: tx('"and then add 5": $3x + 5$.', "„und addiere dann 5“: $3x + 5$.") },
  { math: "3#cA x#vA +#sb 5#cb =#eq 26#cr", note: tx('"The result is 26." That\'s our **equation**!', "„Das Ergebnis ist 26.“ Das ist unsere **Gleichung**!") },
];

const solveRiddle = (() => {
  const { frames } = solveFrames(riddleEq, tx("Our equation from the riddle. Goal: $x$ alone on one side.", "Unsere Gleichung aus dem Rätsel. Ziel: $x$ allein auf einer Seite."));
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: joinT(last.note ?? "", tx("**Answer sentence:** My number is 7.", "**Antwortsatz:** Meine Zahl ist 7.")) };
  frames.push({
    math: "3#cA \\cdot#dt 7#vA +#sb 5#cb =#eq 26#cr",
    note: tx("**Check** in the story: 3 times 7 is 21, plus 5 is 26. It works!", "**Probe** im Text: 3 mal 7 ist 21, plus 5 ist 26. Passt!"),
  });
  return frames;
})();

// In German the share example uses Lea instead of Anna (Ben and Cem stay).
const ANNA = tx("Anna", "Lea");
const shareLesson = shareStory([ANNA, "Ben", "Cem"], "twiceMore", 25, 20, 0, true);
const shareFrames = (() => {
  const { frames } = solveFrames(shareLesson.eq, shareLesson.eqNote, [
    { math: tx(`"Anna:"#la x#vA`, `"Lea:"#la x#vA`), note: tx("Anna gets the least, so let $x$ be Anna's share in €.", "Lea bekommt am wenigsten, also sei $x$ Leas Anteil in €.") },
    { math: tx(`"Anna:"#la x#vA ,#c1 \\quad "Ben:"#lb 2#cB x#vB`, `"Lea:"#la x#vA ,#c1 \\quad "Ben:"#lb 2#cB x#vB`), note: tx("Ben gets twice as much: $2x$.", "Ben bekommt doppelt so viel: $2x$.") },
    {
      math: tx(`"Anna:"#la x#vA ,#c1 \\quad "Ben:"#lb 2#cB x#vB ,#c2 \\quad "Cem:"#lc x#vC1 +#sC2 20#cC2`, `"Lea:"#la x#vA ,#c1 \\quad "Ben:"#lb 2#cB x#vB ,#c2 \\quad "Cem:"#lc x#vC1 +#sC2 20#cC2`),
      note: tx("Cem gets 20 € more than Anna: $x + 20$.", "Cem bekommt 20 € mehr als Lea: $x + 20$."),
    },
  ]);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = {
    ...last,
    note: joinT(
      last.note ?? "",
      tx(
        "Anna gets 25 €, Ben $2 \\cdot 25 = 50$ €, Cem $25 + 20 = 45$ €. Check: $25 + 50 + 45 = 120$.",
        "Lea bekommt 25 €, Ben $2 \\cdot 25 = 50$ €, Cem $25 + 20 = 45$ €. Probe: $25 + 50 + 45 = 120$.",
      ),
    ),
  };
  return frames;
})();

const ageLesson = ageFutureStory("Lena", MUM, 3, 2, 12);
const ageFrames = (() => {
  const { frames } = solveFrames(ageLesson.eq, ageLesson.eqNote, ageLesson.define);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: joinT(last.note ?? "", ageLesson.answerText) };
  return frames;
})();

const unknowns: Topic = {
  ...topicMeta("unknowns"),
  summary: [
    {
      title: tx("Name the unknown", "Die Unbekannte benennen"),
      body: tx(
        "Start with **Let** $x$ **be …** Choose the smallest or simplest quantity, then write everything else with $x$.",
        "Fang mit **Sei** $x$ **…** an. Wähle die kleinste oder einfachste Größe und schreib alles andere mit $x$.",
      ),
      examples: [tx('"Anna:" x , \\quad "Ben:" 2x , \\quad "Cem:" x + 20', '"Lea:" x , \\quad "Ben:" 2x , \\quad "Cem:" x + 20')],
      tone: "rule",
    },
    {
      title: tx("Translate piece by piece", "Stück für Stück übersetzen"),
      body: tx("Words become maths. Watch the order!", "Aus Worten wird Mathe. Achte auf die Reihenfolge!"),
      examples: [
        tx('"twice a number:" \\quad 2x', '"das Doppelte einer Zahl:" \\quad 2x'),
        tx('"5 more than a number:" \\quad x + 5', '"5 mehr als eine Zahl:" \\quad x + 5'),
        tx('"3 less than a number:" \\quad x - 3', '"3 weniger als eine Zahl:" \\quad x - 3'),
        tx('"a third of a number:" \\quad \\frac{x}{3}', '"ein Drittel einer Zahl:" \\quad \\frac{x}{3}'),
      ],
      tone: "rule",
    },
    {
      title: tx("Solve with balance steps", "Mit Äquivalenzumformungen lösen"),
      body: tx("Do the same on both sides until $x$ is alone.", "Mach auf beiden Seiten dasselbe, bis $x$ allein steht."),
      examples: ["3x + 5 = 26 \\quad | -5", "3x = 21 \\quad | :3", "x = 7"],
      tone: "rule",
    },
    {
      title: tx("Consecutive numbers", "Aufeinanderfolgende Zahlen"),
      body: tx(
        "One after the other: add 1 each time. Even or odd ones: add 2 each time.",
        "Direkt hintereinander: jedes Mal plus 1. Gerade oder ungerade Zahlen: jedes Mal plus 2.",
      ),
      examples: ["x , \\quad x + 1 , \\quad x + 2", "x , \\quad x + 2 , \\quad x + 4"],
      tone: "tip",
    },
    {
      title: tx("Brackets matter", "Klammern sind wichtig"),
      body: tx(
        '"Twice the sum of $x$ and 4" doubles the **whole** sum. "In 5 years" adds 5 to **every** age.',
        "„Das Doppelte der Summe aus $x$ und 4“ verdoppelt die **ganze** Summe. „In 5 Jahren“ addiert 5 zu **jedem** Alter.",
      ),
      examples: ["2(x + 4) \\ne 2x + 4"],
      tone: "warning",
    },
    {
      title: tx("Answer and check", "Antwortsatz und Probe"),
      body: tx(
        "Answer in a full sentence, with the unit. Check your result in the **story**, not just in the equation.",
        "Antworte in einem ganzen Satz, mit Einheit. Mach die Probe im **Text**, nicht nur in der Gleichung.",
      ),
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Let x be the unknown", "Sei x die Unbekannte"),
      blob: tx("One number is missing? Give it a name! We call it x.", "Eine Zahl fehlt? Gib ihr einen Namen! Wir nennen sie x."),
      body: tx(
        '**"I think of a number. I multiply it by 3 and then add 5. The result is 26. What is my number?"** Name the unknown number $x$, then translate the story into maths, piece by piece.',
        "**„Ich denke mir eine Zahl. Ich multipliziere sie mit 3 und addiere dann 5. Das Ergebnis ist 26. Wie heißt meine Zahl?“** Nenne die unbekannte Zahl $x$ und übersetze den Text dann Stück für Stück in Mathe.",
      ),
      frames: nameFrames,
    },
    {
      type: "widget",
      title: tx("From words to maths", "Von Worten zu Mathe"),
      blob: tx("Pick a phrase and watch it turn into maths!", "Wähl einen Ausdruck und schau zu, wie daraus Mathe wird!"),
      body: tx(
        "Each piece of the sentence becomes a piece of maths. Sometimes the order changes, sometimes you need brackets. Try them all, and test each term with a number.",
        "Jedes Stück des Satzes wird zu einem Stück Mathe. Manchmal ändert sich die Reihenfolge, manchmal brauchst du Klammern. Probier alle aus und teste jeden Term mit einer Zahl.",
      ),
      widget: Translator,
    },
    {
      type: "check",
      blob: tx("Careful, this one is a classic trap!", "Vorsicht, das ist eine klassische Falle!"),
      exercise: {
        instruction: tx("Which term fits?", "Welcher Term passt?"),
        text: tx(
          "Translate into maths: **Subtract 7 from a number, then double the result.**",
          "Übersetze in einen Term: **Subtrahiere 7 von einer Zahl und verdopple dann das Ergebnis.**",
        ),
        answer: { kind: "choice", options: ["$2x - 7$", "$2(x - 7)$", "$x - 14$", "$7 - 2x$"], correct: 1 },
        hint: tx("What gets doubled: only the number, or the whole result?", "Was wird verdoppelt: nur die Zahl oder das ganze Ergebnis?"),
        solution: [
          { math: "x#vA", note: tx("Let $x$ be the number.", "Sei $x$ die Zahl.") },
          { math: "x#vA -#s 7#c", note: tx("Subtract 7 from it: $x - 7$.", "Subtrahiere 7 davon: $x - 7$.") },
          {
            math: "2#f (x#vA -#s 7#c)#b",
            note: tx(
              "Then double the **result**: the whole difference, so it needs brackets. $2x - 7$ would only double the $x$.",
              "Dann verdopple das **Ergebnis**, also die ganze Differenz. Deshalb braucht es Klammern. $2x - 7$ würde nur das $x$ verdoppeln.",
            ),
          },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Solve, answer, check", "Lösen, Antwortsatz, Probe"),
      blob: tx("Now the fun part: get x on its own!", "Jetzt kommt der beste Teil: Bring x allein auf eine Seite!"),
      body: tx(
        "Solve the equation with balance steps: whatever you do to one side, do to the other. Then answer in a sentence and check the answer **in the story**.",
        "Löse die Gleichung mit Äquivalenzumformungen: Was du auf einer Seite machst, machst du auch auf der anderen. Dann schreibst du einen Antwortsatz und machst die Probe **im Text**.",
      ),
      frames: solveRiddle,
    },
    {
      type: "check",
      blob: tx("Your turn! Let x be the number…", "Du bist dran! Sei x die Zahl …"),
      exercise: story({
        text: tx("If you double a number and subtract 9, you get 31. What is the number?", "Wenn du eine Zahl verdoppelst und 9 subtrahierst, erhältst du 31. Wie heißt die Zahl?"),
        define: [defineNumber],
        eq: { l: [X("A", 2), K("b", -9)], r: [K("r", 31)] },
        eqNote: tx("Double: $2x$. Then minus 9. That makes 31.", "Verdoppeln: $2x$. Dann minus 9. Das ergibt 31."),
        x: 20,
        answer: { kind: "number", value: 20, label: "x =" },
        answerText: numberAnswer(20, "2 \\cdot 20 - 9 = 31"),
        hint: tx("Let $x$ be the number: $2x - 9 = 31$. Undo the minus first.", "Sei $x$ die gesuchte Zahl: $2x - 9 = 31$. Mach zuerst das Minus rückgängig."),
        meaning: THE_NUMBER,
      }),
    },
    {
      type: "explain",
      title: tx("One x for several parts", "Ein x für mehrere Teile"),
      blob: tx("Three people, but only one x. Here's the trick!", "Drei Leute, aber nur ein x. So geht der Trick!"),
      body: tx(
        "**Anna, Ben and Cem share 120 €. Ben gets twice as much as Anna. Cem gets 20 € more than Anna.** Choose $x$ for the smallest part. Write every other part with $x$, then add them all up.",
        "**Lea, Ben und Cem teilen sich 120 €. Ben bekommt doppelt so viel wie Lea. Cem bekommt 20 € mehr als Lea.** Wähle $x$ für den kleinsten Anteil. Schreib jeden anderen Anteil mit $x$ und addiere dann alle.",
      ),
      frames: shareFrames,
    },
    {
      type: "widget",
      title: tx("Build the equation", "Bau die Gleichung"),
      blob: tx("You build it this time. Watch out for the trap chips!", "Diesmal baust du sie. Pass auf die Fallen-Bausteine auf!"),
      body: tx(
        "Read the story and tap the chips in the right order to build the equation. Tap a chip in your equation to send it back.",
        "Lies die Geschichte und tippe die Bausteine in der richtigen Reihenfolge an. Tippst du einen Baustein in deiner Gleichung an, wandert er zurück.",
      ),
      widget: EquationBuilder,
    },
    {
      type: "check",
      blob: tx("Consecutive numbers: x, x + 1, x + 2!", "Aufeinanderfolgende Zahlen: x, x + 1, x + 2!"),
      exercise: story(consecutiveStory("three", 28, "largest")),
    },
    {
      type: "explain",
      title: tx("Age problems: now and later", "Altersaufgaben: heute und später"),
      blob: tx("Age problems look tricky, but a little table makes them easy.", "Altersaufgaben sehen knifflig aus, aber mit einer kleinen Tabelle werden sie einfach."),
      body: tx(
        "**Mum is three times as old as Lena. In 12 years, Mum will be twice as old as Lena. How old is Lena now?** Write both ages now, then both ages later. Time passes for **everyone**!",
        "**Mama ist dreimal so alt wie Lena. In 12 Jahren ist Mama doppelt so alt wie Lena. Wie alt ist Lena heute?** Schreib auf, wie alt beide heute sind, dann, wie alt beide später sind. Die Zeit vergeht für **alle**!",
      ),
      frames: ageFrames,
    },
    {
      type: "check",
      blob: tx("Last one! Now and in 5 years.", "Die letzte! Heute und in 5 Jahren."),
      exercise: story(ageFutureStory("Tim", DAD, 4, 3, 5)),
    },
  ],
  generate,
};

export default unknowns;
