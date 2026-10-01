"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Eraser, Minus, Plus, RotateCcw, Shuffle, Wand2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
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

const join = (...notes: string[]) => notes.filter(Boolean).join(" ");

type Op = { src: string; note: string; apply: (s: Tm[]) => Tm[]; result: (other: number) => string };

function nextOp(l: Tm[], r: Tm[], fresh: () => string): Op | null {
  const aL = xCoef(l);
  const aR = xCoef(r);
  if (aL !== 0 && aR !== 0) {
    const k = Math.min(aL, aR);
    return {
      src: `-#oS ${k === 1 ? "" : `${de(k)}#oN `}x#oV`,
      note: `Subtract $${k === 1 ? "" : de(k)}x$ on both sides, so that $x$ is only on one side.`,
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
      note: b > 0 ? `Subtract ${de(b)} on both sides.` : `Add ${de(-b)} on both sides.`,
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
      note: `Multiply both sides by ${d}.`,
      apply: (s) => s.map((u) => (u.x ? { ...u, d: undefined } : { ...u, c: u.c * d })),
      result: (o) => `$${de(o)} \\cdot ${d} = ${de(o * d)}$.`,
    };
  }
  if (t.c !== 1) {
    const a = t.c;
    return {
      src: `:#oS ${de(a)}#oN`,
      note: `Divide both sides by ${de(a)}.`,
      apply: (s) => s.map((u) => (u.x ? { ...u, c: 1 } : { ...u, c: u.c / a })),
      result: (o) => `$${de(o)} : ${de(a)} = ${de(o / a)}$.`,
    };
  }
  return null;
}

/** Worked solution of a linear equation: brackets, like terms, balance steps, x = … */
export function solveFrames(start: Eq, startNote: string, before: Frame[] = []): { frames: Frame[]; x: number } {
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
    const notes = brs.filter((b) => b.f !== 1).map((b) => `Expand: $${b.f}(${sideSrc(b.items, false)}) = ${sideSrc(expandSide([b]), false)}$.`);
    if (plain.length === 1) notes.push(`A plus in front of $(${sideSrc(plain[0].items, false)})$: just drop the brackets.`);
    if (plain.length > 1) notes.push("A plus in front of the brackets: just drop them.");
    frames.push({ math: eqSrc({ l, r }), note: notes.join(" ") });
  } else {
    l = start.l as Tm[];
    r = start.r as Tm[];
  }
  let carry = "";
  if (needsCombine(l) || needsCombine(r)) {
    carry = `Combine like terms: ${[...combineNote(l), ...combineNote(r)].join(" and ")}.`;
    l = combineSide(l);
    r = combineSide(r);
  }
  for (let guard = 0; guard < 6; guard++) {
    const op = nextOp(l, r, fresh);
    if (!op) break;
    frames.push({ math: eqSrc({ l, r }, op.src), note: join(carry, op.note) });
    const xLeft = xCoef(l) !== 0;
    const other = kSum(xLeft ? r : l);
    l = op.apply(l);
    r = op.apply(r);
    carry = op.result(other);
  }
  if (xCoef(l) === 0) {
    frames.push({ math: eqSrc({ l, r }), note: join(carry, "Swap the two sides, so $x$ is on the left.") });
    [l, r] = [r, l];
    carry = "";
  }
  const x = kSum(r);
  frames.push({ math: eqSrc({ l, r }), highlight: [...sideKeys(l), "eq", ...sideKeys(r)], note: join(carry, `So $x = ${de(x)}$.`) });
  return { frames, x };
}

// ---------------------------------------------------------------------------
// Stories → exercises

type Story = {
  text: string;
  /** Frames that introduce x and the other parts (keys matching the equation). */
  define: Frame[];
  eq: Eq;
  eqNote: string;
  x: number;
  /** Extra frame when the question asks for something other than x. */
  derived?: { src: string; note: string };
  answer: AnswerSpec;
  answerText: string;
  hint: string;
  /** "the number", "Ben's share in €"… for multiple choice. */
  meaning: string;
};

function story(s: Story, instruction = "Solve with an equation"): Exercise {
  const { frames } = solveFrames(s.eq, s.eqNote, s.define);
  if (s.derived) frames.push({ math: s.derived.src, highlight: ["res"], note: `${s.derived.note} ${s.answerText}` });
  else {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, note: `${last.note} ${s.answerText}` };
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
  const { frames } = solveFrames(s.eq, `${s.eqNote} That's the equation.`, s.define);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: `${last.note} ${s.answerText}` };
  return {
    instruction: "Which equation fits the story?",
    text: `${s.text}\n\nLet $x$ be ${s.meaning}.`,
    answer: { kind: "choice", options: options.map((o) => `$${o}$`), correct: options.indexOf(right) },
    hint: "Translate the story piece by piece. Which parts belong together, and do they need brackets?",
    solution: frames,
  };
}

const NAMES = ["Mia", "Leon", "Emma", "Noah", "Lina", "Elias", "Hannah", "Paul", "Sophie", "Ben", "Finn", "Lea", "Jonas", "Amira", "Can", "Zeynep", "Luca", "Ida", "Mats", "Aylin", "Nele", "Yusuf", "Clara", "Theo", "Omar", "Jana"];
const SHORT = ["Ida", "Ben", "Can", "Mia", "Tim", "Lea", "Ali", "Finn", "Nele", "Emma", "Paul", "Noah", "Lina", "Jana", "Omar", "Max", "Ella", "Jan"];

function names(rng: Rng, n: number, list = SHORT): string[] {
  return rng.shuffle(list).slice(0, n);
}

const PART: Record<number, [string, string]> = { 2: ["Half", "half"], 3: ["A third", "a third"], 4: ["A quarter", "a quarter"], 5: ["A fifth", "a fifth"] };
const TIMES: Record<number, string> = { 2: "twice", 3: "three times", 4: "four times", 5: "five times" };

const defineNumber: Frame = { math: "x#vA", note: "Let $x$ be the number you're looking for." };

// ---- Level 1: one step

function riddleAdd(rng: Rng, choice = false): Exercise {
  const x = rng.int(5, 60);
  const b = rng.int(3, 40);
  const c = x + b;
  const s: Story = {
    text: rng.pick([`I think of a number and add ${b}. The result is ${c}. What is my number?`, `If you add ${b} to a number, you get ${c}. What is the number?`]),
    define: [defineNumber],
    eq: { l: [X("A"), K("b", b)], r: [K("r", c)] },
    eqNote: `Add ${b}: $x + ${b}$. The result is ${c}.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${x} + ${b} = ${c}$.`,
    hint: "Let $x$ be the number. Write the story as an equation, then undo the $+$.",
    meaning: "the number",
  };
  if (choice) return choiceOf(s, [{ l: [X("A"), K("b", -b)], r: [K("r", c)] }, { l: [X("A", b)], r: [K("r", c)] }, { l: [X("A"), K("b", c)], r: [K("r", b)] }], rng);
  return story(s);
}

function riddleSub(rng: Rng, choice = false): Exercise {
  const x = rng.int(20, 90);
  const b = rng.int(3, 19);
  const c = x - b;
  const s: Story = {
    text: rng.pick([`I think of a number and subtract ${b}. The result is ${c}. What is my number?`, `A number decreased by ${b} is ${c}. What is the number?`]),
    define: [defineNumber],
    eq: { l: [X("A"), K("b", -b)], r: [K("r", c)] },
    eqNote: `Subtract ${b}: $x - ${b}$. The result is ${c}.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${x} - ${b} = ${c}$.`,
    hint: "Let $x$ be the number. Write the story as an equation, then undo the $-$.",
    meaning: "the number",
  };
  if (choice) return choiceOf(s, [{ l: [X("A"), K("b", b)], r: [K("r", c)] }, { l: [K("b", b), X("A", -1)], r: [K("r", c)] }, { l: [X("A")], r: [K("r", c), K("q", -b)] }], rng);
  return story(s);
}

function riddleMul(rng: Rng, choice = false): Exercise {
  const k = rng.int(3, 9);
  const x = rng.int(3, 15);
  const c = k * x;
  const s: Story = {
    text: rng.pick([`${k} times a number is ${c}. What is the number?`, `If I multiply a number by ${k}, I get ${c}. What is my number?`]),
    define: [defineNumber],
    eq: { l: [X("A", k)], r: [K("r", c)] },
    eqNote: `${k} times the number: $${k}x$. That's ${c}.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${k} \\cdot ${x} = ${c}$.`,
    hint: `Let $x$ be the number. Then $${k}x = ${c}$. What undoes "times ${k}"?`,
    meaning: "the number",
  };
  if (choice) return choiceOf(s, [{ l: [X("A"), K("b", k)], r: [K("r", c)] }, { l: [X("A", 1, k)], r: [K("r", c)] }, { l: [X("A"), K("b", -k)], r: [K("r", c)] }], rng);
  return story(s);
}

function riddleDiv(rng: Rng, choice = false): Exercise {
  const d = rng.int(2, 5);
  const c = rng.int(3, 15);
  const x = c * d;
  const s: Story = {
    text: `${PART[d][0]} of a number is ${c}. What is the number?`,
    define: [defineNumber],
    eq: { l: [X("A", 1, d)], r: [K("r", c)] },
    eqNote: `${PART[d][0]} of $x$ means $x$ divided by ${d}: $\\frac{x}{${d}}$.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${x} : ${d} = ${c}$.`,
    hint: `${PART[d][0]} of a number is the number divided by ${d}. What undoes "divided by ${d}"?`,
    meaning: "the number",
  };
  if (choice) return choiceOf(s, [{ l: [X("A", d)], r: [K("r", c)] }, { l: [X("A"), K("b", -d)], r: [K("r", c)] }, { l: [X("A"), K("b", d)], r: [K("r", c)] }], rng);
  return story(s);
}

function contextAdd(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const b = rng.int(5, 30);
  const x = rng.int(8, 60);
  const c = x + b;
  const v = rng.pick([
    {
      text: `${name} had some money in the piggy bank. For the birthday, ${name} gets ${b} € more. Now there are ${c} € in the piggy bank. How much money was in it before?`,
      meaning: "the money in the piggy bank before (in €)",
      unit: "€",
      answer: `There were ${x} € in the piggy bank before.`,
    },
    {
      text: `Some people are on a bus. At the next stop, ${b} more people get on and nobody gets off. Now there are ${c} people on the bus. How many were on the bus before?`,
      meaning: "the number of people on the bus before",
      unit: "people",
      answer: `There were ${x} people on the bus before.`,
    },
    {
      text: `${name} has some marbles and wins ${b} more in a game. Now ${name} has ${c} marbles. How many marbles did ${name} have at first?`,
      meaning: `the number of marbles ${name} had at first`,
      unit: "marbles",
      answer: `${name} had ${x} marbles at first.`,
    },
  ]);
  return story({
    text: v.text,
    define: [{ math: "x#vA", note: `Let $x$ be ${v.meaning}.` }],
    eq: { l: [X("A"), K("b", b)], r: [K("r", c)] },
    eqNote: `${b} more: $x + ${b}$. Now it's ${c}.`,
    x,
    answer: { kind: "number", value: x, unit: v.unit },
    answerText: `**Answer:** ${v.answer} Check: $${x} + ${b} = ${c}$.`,
    hint: "Let $x$ be the amount at the start. What happens to it in the story?",
    meaning: v.meaning,
  });
}

function contextSub(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const b = rng.int(5, 40);
  const x = rng.int(b + 5, 90);
  const c = x - b;
  const v = rng.pick([
    {
      text: `${name} spends ${b} € on a new game and has ${c} € left. How much money did ${name} have before?`,
      meaning: `the money ${name} had before (in €)`,
      unit: "€",
      answer: `${name} had ${x} € before.`,
    },
    {
      text: `Some students are in the school hall. ${b} of them leave. Now ${c} students are still there. How many students were in the hall at first?`,
      meaning: "the number of students at first",
      unit: "students",
      answer: `There were ${x} students in the hall at first.`,
    },
  ]);
  return story({
    text: v.text,
    define: [{ math: "x#vA", note: `Let $x$ be ${v.meaning}.` }],
    eq: { l: [X("A"), K("b", -b)], r: [K("r", c)] },
    eqNote: `${b} fewer: $x - ${b}$. That leaves ${c}.`,
    x,
    answer: { kind: "number", value: x, unit: v.unit },
    answerText: `**Answer:** ${v.answer} Check: $${x} - ${b} = ${c}$.`,
    hint: "Let $x$ be the amount at the start. What happens to it in the story?",
    meaning: v.meaning,
  });
}

function contextMul(rng: Rng): Exercise {
  const k = rng.int(3, 8);
  const x = rng.int(2, 9);
  const c = k * x;
  const what = rng.pick(["stickers", "coloured pencils", "trading cards"]);
  return story({
    text: `${k} identical packs of ${what} cost ${c} € together. How much does one pack cost?`,
    define: [{ math: "x#vA", note: "Let $x$ be the price of one pack in €." }],
    eq: { l: [X("A", k)], r: [K("r", c)] },
    eqNote: `${k} packs cost $${k}x$. Together that's ${c} €.`,
    x,
    answer: { kind: "number", value: x, unit: "€" },
    answerText: `**Answer:** One pack costs ${x} €. Check: $${k} \\cdot ${x} = ${c}$.`,
    hint: `Let $x$ be the price of one pack. Then ${k} packs cost $${k}x$.`,
    meaning: "the price of one pack (in €)",
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
  const text =
    k <= 3 && rng.chance(0.5)
      ? `If you ${k === 2 ? "double" : "triple"} a number and then ${verb} ${b}, you get ${c}. What is the number?`
      : rng.pick([`If I multiply a number by ${k} and then ${verb} ${b}, I get ${c}. What is my number?`, `${k} times a number, ${plus ? "plus" : "minus"} ${b}, makes ${c}. Find the number.`]);
  const sb = plus ? b : -b;
  const s: Story = {
    text,
    define: [defineNumber],
    eq: { l: [X("A", k), K("b", sb)], r: [K("r", c)] },
    eqNote: `Times ${k}: $${k}x$. Then ${plus ? "plus" : "minus"} ${b}. That makes ${c}.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${k} \\cdot ${x} ${plus ? "+" : "-"} ${b} = ${c}$.`,
    hint: `Let $x$ be the number: $${k}x ${plus ? "+" : "-"} ${b} = ${c}$. Undo the ${plus ? "plus" : "minus"} first, then the times.`,
    meaning: "the number",
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
  return story({
    text: `If you take ${PART[d][1]} of a number and ${plus ? "add" : "subtract"} ${b}, you get ${c}. What is the number?`,
    define: [defineNumber],
    eq: { l: [X("A", 1, d), K("b", plus ? b : -b)], r: [K("r", c)] },
    eqNote: `${PART[d][0]} of $x$ is $\\frac{x}{${d}}$. Then ${plus ? "plus" : "minus"} ${b}.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${x} : ${d} ${plus ? "+" : "-"} ${b} = ${c}$.`,
    hint: `${PART[d][0]} of $x$ is $\\frac{x}{${d}}$. Undo the ${plus ? "plus" : "minus"} first, then multiply by ${d}.`,
    meaning: "the number",
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
  const text =
    kind === "three"
      ? `The sum of three consecutive whole numbers is ${S}. What is the ${word} number?`
      : kind === "two"
        ? `Two consecutive whole numbers add up to ${S}. What is the ${word} number?`
        : `Three consecutive even numbers add up to ${S}. What is the ${word} of them?`;
  const result = x + offset;
  return {
    text,
    define: [
      {
        math: define,
        note:
          kind === "even"
            ? "Let $x$ be the smallest number. Even numbers go up in steps of 2: $x + 2$ and $x + 4$."
            : count === 2
              ? "Let $x$ be the smaller number. The next one is $x + 1$."
              : "Let $x$ be the smallest number. The next ones are $x + 1$ and $x + 2$.",
      },
    ],
    eq: { l: parts, r: [K("r", S)] },
    eqNote: `Their sum is ${S}.`,
    x,
    derived: offset ? { src: `x#vA +#sq ${offset}#cq =#e1 ${x}#cx +#sq2 ${offset}#cq2 =#e2 ${result}#res`, note: `The ${word} number is $x + ${offset} = ${result}$.` } : undefined,
    answer: { kind: "number", value: result },
    answerText: `**Answer:** The numbers are ${nums.join(", ")}. The ${word} is ${result}. Check: $${nums.join(" + ")} = ${S}$.`,
    hint:
      kind === "even"
        ? "Let $x$ be the smallest number. The next even numbers are $x + 2$ and $x + 4$."
        : count === 2
          ? "Let $x$ be the smaller number. The next one is $x + 1$."
          : "Let $x$ be the smallest number. The next ones are $x + 1$ and $x + 2$.",
    meaning: count === 2 ? "the smaller number" : "the smallest number",
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

function rectangleStory(width: number, k: number, ask: "width" | "length"): Story {
  const P = 2 * width + 2 * (width + k);
  const len = width + k;
  return {
    text: `A rectangle is ${k} cm longer than it is wide. Its perimeter is ${P} cm. How ${ask === "width" ? "wide" : "long"} is the rectangle?`,
    define: [{ math: `"width:"#lw x#vW ,#c1 \\quad "length:"#ll x#vL1 +#sL2 ${k}#cL2`, note: `Let $x$ be the width in cm. The length is ${k} cm more: $x + ${k}$.` }],
    eq: { l: [X("W", 2), B("L", 2, [X("L1"), K("L2", k)])], r: [K("r", P)] },
    eqNote: `The perimeter is two widths plus two lengths: $2x + 2(x + ${k})$.`,
    x: width,
    derived: ask === "length" ? { src: `x#vW +#sq ${k}#cq =#e1 ${width}#cx +#sq2 ${k}#cq2 =#e2 ${len}#res`, note: `The length is $x + ${k} = ${len}$.` } : undefined,
    answer: { kind: "number", value: ask === "width" ? width : len, unit: "cm" },
    answerText: `**Answer:** The rectangle is ${width} cm wide and ${len} cm long. Check: $2 \\cdot ${width} + 2 \\cdot ${len} = ${P}$.`,
    hint: "Let $x$ be the width. Then the length is $x$ plus the difference. Perimeter = 2 · width + 2 · length.",
    meaning: "the width in cm",
  };
}

function perimeter(rng: Rng): Exercise {
  if (rng.chance(0.6)) return story(rectangleStory(rng.int(3, 15), rng.int(2, 9), rng.chance(0.5) ? "width" : "length"));
  const base = rng.int(4, 14);
  const k = rng.int(2, 7);
  const P = base + 2 * (base + k);
  return story({
    text: `In an isosceles triangle, each of the two equal sides is ${k} cm longer than the base. The perimeter is ${P} cm. How long is the base?`,
    define: [{ math: `"base:"#lb x#vA ,#c1 \\quad "sides:"#ls x#vL1 +#sL2 ${k}#cL2`, note: `Let $x$ be the base in cm. Each of the other two sides is $x + ${k}$.` }],
    eq: { l: [X("A"), B("L", 2, [X("L1"), K("L2", k)])], r: [K("r", P)] },
    eqNote: `The perimeter is the base plus two equal sides: $x + 2(x + ${k})$.`,
    x: base,
    answer: { kind: "number", value: base, unit: "cm" },
    answerText: `**Answer:** The base is ${base} cm long. Check: $${base} + 2 \\cdot ${base + k} = ${P}$.`,
    hint: "Let $x$ be the base. The two equal sides are each $x$ plus the difference.",
    meaning: "the base in cm",
  });
}

function sumAgesStory(older: string, younger: string, x: number, k: number, ask: "younger" | "older"): Story {
  const S = 2 * x + k;
  return {
    text: `${older} is ${k} years older than ${younger}. Together they are ${S} years old. How old is ${ask === "younger" ? younger : older}?`,
    define: [{ math: `"${younger}:"#ly x#vA ,#c1 \\quad "${older}:"#lo x#vP1 +#sP2 ${k}#cP2`, note: `Let $x$ be ${younger}'s age. ${older} is $x + ${k}$.` }],
    eq: { l: [X("A"), B("P", 1, [X("P1"), K("P2", k)])], r: [K("r", S)] },
    eqNote: `Together means: add both ages.`,
    x,
    derived: ask === "older" ? { src: `x#vA +#sq ${k}#cq =#e1 ${x}#cx +#sq2 ${k}#cq2 =#e2 ${x + k}#res`, note: `${older} is $x + ${k} = ${x + k}$.` } : undefined,
    answer: { kind: "number", value: ask === "younger" ? x : x + k, unit: "years" },
    answerText: `**Answer:** ${younger} is ${x} and ${older} is ${x + k} years old. Check: $${x} + ${x + k} = ${S}$.`,
    hint: `Let $x$ be ${younger}'s age. Then ${older} is $x + ${k}$.`,
    meaning: `${younger}'s age`,
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
    text: `A concert ticket costs the same for everyone. For each order there is also a booking fee of ${f} €. ${name} orders ${n} tickets and pays ${T} € in total. How much does one ticket cost?`,
    define: [{ math: "x#vA", note: "Let $x$ be the price of one ticket in €." }],
    eq: { l: [X("A", n), K("b", f)], r: [K("r", T)] },
    eqNote: `${n} tickets cost $${n}x$, plus the fee of ${f} €.`,
    x,
    answer: { kind: "number", value: x, unit: "€" },
    answerText: `**Answer:** One ticket costs ${x} €. Check: $${n} \\cdot ${x} + ${f} = ${T}$.`,
    hint: `Let $x$ be the price of one ticket. ${n} tickets plus the fee make ${T} €.`,
    meaning: "the price of one ticket (in €)",
  });
}

function taxi(rng: Rng): Exercise {
  const name = rng.pick(NAMES);
  const per = rng.pick([2, 3]);
  const base = rng.int(3, 5);
  const x = rng.int(3, 20);
  const T = per * x + base;
  return story({
    text: `A taxi ride costs ${base} € to start, plus ${per} € for every kilometre. ${name}'s ride costs ${T} €. How many kilometres long was the ride?`,
    define: [{ math: "x#vA", note: "Let $x$ be the length of the ride in km." }],
    eq: { l: [X("A", per), K("b", base)], r: [K("r", T)] },
    eqNote: `${per} € per km: $${per}x$. Plus the ${base} € start price.`,
    x,
    answer: { kind: "number", value: x, unit: "km" },
    answerText: `**Answer:** The ride was ${x} km long. Check: $${per} \\cdot ${x} + ${base} = ${T}$.`,
    hint: `Let $x$ be the number of km. Each km costs ${per} €, and the start price is added once.`,
    meaning: "the length of the ride in km",
  });
}

function rectangleTimes(rng: Rng): Exercise {
  const k = rng.int(2, 4);
  const w = rng.int(2, 12);
  const P = 2 * w + 2 * k * w;
  const ask = rng.chance(0.5) ? "wide" : "long";
  return story({
    text: `A rectangle is ${TIMES[k]} as long as it is wide. Its perimeter is ${P} cm. How ${ask} is it?`,
    define: [{ math: `"width:"#lw x#vA ,#c1 \\quad "length:"#ll ${k}#cB x#vB`, note: `Let $x$ be the width in cm. The length is $${k}x$.` }],
    eq: { l: [X("A"), X("B", k), X("C"), X("D", k)], r: [K("r", P)] },
    eqNote: "Go once around: width, length, width, length.",
    x: w,
    derived: ask === "long" ? { src: `${k}#cq x#vA =#e1 ${k}#cq2 \\cdot#dt ${w}#cx =#e2 ${k * w}#res`, note: `The length is $${k}x = ${k * w}$.` } : undefined,
    answer: { kind: "number", value: ask === "wide" ? w : k * w, unit: "cm" },
    answerText: `**Answer:** The rectangle is ${w} cm wide and ${k * w} cm long. Check: $${w} + ${k * w} + ${w} + ${k * w} = ${P}$.`,
    hint: `Let $x$ be the width. The length is $${k}x$. Add all four sides.`,
    meaning: "the width in cm",
  });
}

// ---- Level 3: ages, sharing, brackets

const PARENTS = ["Mum", "Dad"];

/** Parent is k times as old as the child; in n years m times as old. */
export function ageFutureStory(child: string, parent: string, k: number, m: number, n: number, ask: "child" | "parent" = "child"): Story {
  const x = (n * (m - 1)) / (k - m);
  const twice = m === 2 ? "twice" : "three times";
  return {
    text: `${parent} is ${TIMES[k]} as old as ${child}. In ${n} years, ${parent} will be ${twice} as old as ${child}. How old is ${ask === "child" ? child : parent} now?`,
    define: [
      { math: `"${child}:"#lc x#va ,#c1 \\quad "${parent}:"#lp ${k}#cb x#vb`, note: `Let $x$ be ${child}'s age now. ${parent} is ${TIMES[k]} as old: $${k}x$.` },
      { math: `"${child}:"#lc x#va +#sn1 ${n}#cn1 ,#c1 \\quad "${parent}:"#lp ${k}#cb x#vb +#sn2 ${n}#cn2`, note: `In ${n} years, **both** are ${n} years older.` },
    ],
    eq: { l: [X("b", k), K("n2", n)], r: [B("z", m, [X("a"), K("n1", n)])] },
    eqNote: `Then ${parent} is ${twice} as old as ${child}. The **whole** age of ${child} is multiplied, so it needs brackets.`,
    x,
    derived: ask === "parent" ? { src: `${k}#cq x#va =#e1 ${k}#cq2 \\cdot#dt ${x}#cx =#e2 ${k * x}#res`, note: `${parent} is $${k}x = ${k * x}$ years old.` } : undefined,
    answer: { kind: "number", value: ask === "child" ? x : k * x, unit: "years" },
    answerText: `**Answer:** ${child} is ${x} and ${parent} is ${k * x} years old. Check: in ${n} years they are ${x + n} and ${k * x + n}, and $${k * x + n} = ${m} \\cdot ${x + n}$.`,
    hint: `Let $x$ be ${child}'s age now. Write both ages now, then both ages in ${n} years. Careful with brackets!`,
    meaning: `${child}'s age now`,
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
  return story({
    text: `${parent} is ${d} years older than ${child}. In ${n} years, ${parent} will be ${twice} as old as ${child}. How old is ${child} now?`,
    define: [
      { math: `"${child}:"#lc x#va ,#c1 \\quad "${parent}:"#lp x#vp +#sd ${d}#cd`, note: `Let $x$ be ${child}'s age now. ${parent} is $x + ${d}$.` },
      { math: `"${child}:"#lc x#va +#sn1 ${n}#cn1 ,#c1 \\quad "${parent}:"#lp x#vp +#sd ${d}#cd +#sn2 ${n}#cn2`, note: `In ${n} years, **both** are ${n} years older.` },
    ],
    eq: { l: [X("p"), K("d", d), K("n2", n)], r: [B("z", m, [X("a"), K("n1", n)])] },
    eqNote: `Then ${parent} is ${twice} as old: the **whole** age of ${child} is multiplied, so it needs brackets.`,
    x,
    answer: { kind: "number", value: x, unit: "years" },
    answerText: `**Answer:** ${child} is ${x} years old now. Check: in ${n} years they are ${x + n} and ${x + d + n}, and $${x + d + n} = ${m} \\cdot ${x + n}$.`,
    hint: `Let $x$ be ${child}'s age now. Then ${parent} is $x + ${d}$. In ${n} years, add ${n} to **both** ages.`,
    meaning: `${child}'s age now`,
  });
}

type ShareKind = "twiceMore" | "tripleLess" | "moreThanB";

export function shareStory(who: [string, string, string], kind: ShareKind, x: number, k: number, ask: 0 | 1 | 2, money: boolean): Story {
  const [A, Bn, C] = who;
  const bc = kind === "tripleLess" ? 3 : 2;
  const c1 = kind === "moreThanB" ? 2 : 1;
  const ck = kind === "tripleLess" ? -k : k;
  const parts: Part[] = [X("A"), X("B", bc), B("C", 1, [X("C1", c1), K("C2", ck)])];
  const T = evalSide(parts, x);
  const vals = [x, bc * x, c1 * x + ck];
  const u = (v: number) => (money ? `${v} €` : `${v} stickers`);
  const sentenceB = `${Bn} gets ${TIMES[bc]} as ${money ? "much" : "many"} as ${A}.`;
  const sentenceC = money
    ? kind === "twiceMore"
      ? `${C} gets ${k} € more than ${A}.`
      : kind === "tripleLess"
        ? `${C} gets ${k} € less than ${A}.`
        : `${C} gets ${k} € more than ${Bn}.`
    : kind === "twiceMore"
      ? `${C} gets ${k} more stickers than ${A}.`
      : kind === "tripleLess"
        ? `${C} gets ${k} fewer stickers than ${A}.`
        : `${C} gets ${k} more stickers than ${Bn}.`;
  const asked = who[ask];
  const derived =
    ask === 0
      ? undefined
      : ask === 1
        ? { src: `${bc}#cq x#vA =#e1 ${bc}#cq2 \\cdot#dt ${x}#cx =#e2 ${vals[1]}#res`, note: `${Bn} gets $${bc}x = ${vals[1]}$.` }
        : {
            src: `${c1 === 1 ? "" : `${c1}#cp `}x#vA ${ck < 0 ? "-" : "+"}#sq ${Math.abs(ck)}#cq =#e1 ${c1 === 1 ? "" : `${c1}#cp2 \\cdot#dt `}${x}#cx ${ck < 0 ? "-" : "+"}#sq2 ${Math.abs(ck)}#cq2 =#e2 ${vals[2]}#res`,
            note: `${C} gets $${sideSrc([X("n", c1), K("m", ck)], false)} = ${vals[2]}$.`,
          };
  return {
    text: money
      ? `${A}, ${Bn} and ${C} share ${T} € of prize money. ${sentenceB} ${sentenceC} How much does ${asked} get?`
      : `${A}, ${Bn} and ${C} share ${T} stickers. ${sentenceB} ${sentenceC} How many stickers does ${asked} get?`,
    define: [
      {
        math: `"${A}:"#la x#vA ,#c1 \\quad "${Bn}:"#lb ${bc}#cB x#vB ,#c2 \\quad "${C}:"#lc ${c1 === 1 ? "" : `${c1}#cC1 `}x#vC1 ${ck < 0 ? "-" : "+"}#sC2 ${Math.abs(ck)}#cC2`,
        note: `The others are compared with ${A}, so let $x$ be ${A}'s share. Then ${Bn} gets $${bc}x$ and ${C} gets $${sideSrc([X("n", c1), K("m", ck)], false)}$.`,
      },
    ],
    eq: { l: parts, r: [K("r", T)] },
    eqNote: `All three shares together make ${u(T)}.`,
    x,
    derived,
    answer: { kind: "number", value: vals[ask], unit: money ? "€" : "stickers" },
    answerText: `**Answer:** ${asked} gets ${u(vals[ask])}. Check: $${vals.join(" + ")} = ${T}$.`,
    hint: `Let $x$ be ${A}'s share. Write the other two shares with $x$, then add all three.`,
    meaning: `${A}'s share`,
  };
}

function share(rng: Rng): Exercise {
  const who = names(rng, 3) as [string, string, string];
  const kind = rng.pick<ShareKind>(["twiceMore", "tripleLess", "moreThanB"]);
  const money = rng.chance(0.7);
  const k = money ? rng.int(1, 6) * 5 : rng.int(3, 12);
  const x = kind === "tripleLess" ? rng.int(k + 3, k + 30) : rng.int(5, 40);
  return story(shareStory(who, kind, x, k, rng.pick([0, 0, 1, 2] as const), money));
}

function ticketsStory(na: number, nc: number, x: number, d: number, ask: "child" | "adult"): Story {
  const T = nc * x + na * (x + d);
  return {
    text: `${na} adult tickets and ${nc} child tickets for the zoo cost ${T} € in total. An adult ticket costs ${d} € more than a child ticket. How much does ${ask === "child" ? "a child" : "an adult"} ticket cost?`,
    define: [{ math: `"child:"#lc x#vA ,#c1 \\quad "adult:"#la x#vB1 +#sB2 ${d}#cB2`, note: `Let $x$ be the price of a child ticket in €. An adult ticket costs $x + ${d}$.` }],
    eq: { l: [X("A", nc), B("B", na, [X("B1"), K("B2", d)])], r: [K("r", T)] },
    eqNote: `${nc} child tickets: $${nc}x$. ${na} adult tickets: $${na}(x + ${d})$, the **whole** price times ${na}.`,
    x,
    derived: ask === "adult" ? { src: `x#vA +#sq ${d}#cq =#e1 ${x}#cx +#sq2 ${d}#cq2 =#e2 ${x + d}#res`, note: `An adult ticket costs $x + ${d} = ${x + d}$ €.` } : undefined,
    answer: { kind: "number", value: ask === "child" ? x : x + d, unit: "€" },
    answerText: `**Answer:** A child ticket costs ${x} €, an adult ticket ${x + d} €. Check: $${nc} \\cdot ${x} + ${na} \\cdot ${x + d} = ${T}$.`,
    hint: "Let $x$ be the price of a child ticket. An adult ticket costs $x$ plus the difference. Brackets!",
    meaning: "the price of a child ticket (in €)",
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
      ? `Add ${b} to a number and multiply the sum by ${k}. The result is ${c}. What is the number?`
      : `Subtract ${b} from a number and multiply the difference by ${k}. The result is ${c}. What is the number?`,
    define: [{ math: "x#vA1", note: "Let $x$ be the number you're looking for." }],
    eq: { l: [B("A", k, [X("A1"), K("A2", sb)])], r: [K("r", c)] },
    eqNote: `First $x ${plus ? "+" : "-"} ${b}$. Then the **whole** ${plus ? "sum" : "difference"} times ${k}: brackets!`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${k} \\cdot (${x} ${plus ? "+" : "-"} ${b}) = ${k} \\cdot ${x + sb} = ${c}$.`,
    hint: `The ${plus ? "sum" : "difference"} is multiplied as a whole, so write it in brackets: $${k}(x ${plus ? "+" : "-"} ${b})$.`,
    meaning: "the number",
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
    text: `If you multiply a number by ${k} and subtract ${b}, you get the same as when you add ${e} to the number. What is the number?`,
    define: [defineNumber],
    eq: { l: [X("A", k), K("b", -b)], r: [X("B"), K("e", e)] },
    eqNote: `Left: $${k}x - ${b}$. Right: $x + ${e}$. "The same" means: equals.`,
    x,
    answer: { kind: "number", value: x, label: "x =" },
    answerText: `**Answer:** The number is ${x}. Check: $${k} \\cdot ${x} - ${b} = ${k * x - b}$ and $${x} + ${e} = ${x + e}$.`,
    hint: "Both results are equal. Write each side with $x$, then get all the $x$ onto one side.",
    meaning: "the number",
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

type Piece = { w: string; m: string };
type Phrase = { label: string; pieces: Piece[]; order: (number | string)[]; term: string; sub: (x: number) => string; f: (x: number) => number; xs: number[]; tip: string };

const PHRASES: Phrase[] = [
  {
    label: "twice a number",
    pieces: [{ w: "twice", m: "2 \\cdot" }, { w: "a number", m: "x" }],
    order: [0, 1],
    term: "2x",
    sub: (x) => `2 \\cdot ${x}`,
    f: (x) => 2 * x,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: 'Twice means times 2. We write $2x$ instead of $2 \\cdot x$.',
  },
  {
    label: "5 more than a number",
    pieces: [{ w: "5 more than", m: "+ 5" }, { w: "a number", m: "x" }],
    order: [1, 0],
    term: "x + 5",
    sub: (x) => `${x} + 5`,
    f: (x) => x + 5,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: "The order flips! You read the 5 first, but the number comes first in maths: $x + 5$.",
  },
  {
    label: "3 less than a number",
    pieces: [{ w: "3 less than", m: "- 3" }, { w: "a number", m: "x" }],
    order: [1, 0],
    term: "x - 3",
    sub: (x) => `${x} - 3`,
    f: (x) => x - 3,
    xs: [4, 5, 6, 7, 8, 9, 10, 12, 15, 20],
    tip: 'Careful: "3 less than a number" is $x - 3$, not $3 - x$. Try it with a number!',
  },
  {
    label: "3 minus a number",
    pieces: [{ w: "3", m: "3" }, { w: "minus", m: "-" }, { w: "a number", m: "x" }],
    order: [0, 1, 2],
    term: "3 - x",
    sub: (x) => `3 - ${x}`,
    f: (x) => 3 - x,
    xs: [1, 2, 3, 4, 5, 6],
    tip: "Here the order stays exactly as you read it: $3 - x$.",
  },
  {
    label: "a third of a number",
    pieces: [{ w: "a third of", m: ": 3" }, { w: "a number", m: "x" }],
    order: [1, 0],
    term: "\\frac{x}{3}",
    sub: (x) => `\\frac{${x}}{3}`,
    f: (x) => x / 3,
    xs: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    tip: "A third of something means: divide it by 3. As a fraction: $\\frac{x}{3}$.",
  },
  {
    label: "twice a number, plus 4",
    pieces: [{ w: "twice", m: "2 \\cdot" }, { w: "a number", m: "x" }, { w: "plus 4", m: "+ 4" }],
    order: [0, 1, 2],
    term: "2x + 4",
    sub: (x) => `2 \\cdot ${x} + 4`,
    f: (x) => 2 * x + 4,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: "First double, then add 4. No brackets needed.",
  },
  {
    label: "twice the sum of a number and 4",
    pieces: [{ w: "twice", m: "2 \\cdot" }, { w: "the sum of", m: "+" }, { w: "a number", m: "x" }, { w: "and 4", m: "4" }],
    order: [0, "(", 2, 1, 3, ")"],
    term: "2(x + 4)",
    sub: (x) => `2 \\cdot (${x} + 4)`,
    f: (x) => 2 * (x + 4),
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: "The **whole** sum is doubled, so it needs brackets: $2(x + 4)$. Compare it with \"twice a number, plus 4\"!",
  },
  {
    label: "the sum of a number and the next one",
    pieces: [{ w: "the sum of", m: "+" }, { w: "a number", m: "x" }, { w: "and the next one", m: "(x + 1)" }],
    order: [1, 0, 2],
    term: "x + (x + 1)",
    sub: (x) => `${x} + ${x + 1}`,
    f: (x) => 2 * x + 1,
    xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    tip: 'Consecutive numbers: the next one is always $x + 1$. "The sum of A and B" means $A + B$.',
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
  const scope = useId();
  const [sel, setSel] = useState(1);
  const [run, setRun] = useState(0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {PHRASES.map((p, i) => (
          <button
            key={p.label}
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
            <span className="relative">{p.label}</span>
          </button>
        ))}
      </div>
      <TranslateRun key={`${sel}-${run}`} phrase={PHRASES[sel]} onReplay={() => setRun((r) => r + 1)} />
    </div>
  );
}

function TranslateRun({ phrase, onReplay }: { phrase: Phrase; onReplay: () => void }) {
  const scope = useId();
  const n = phrase.pieces.length;
  const [stage, setStage] = useState(0);
  const [xi, setXi] = useState(Math.min(5, phrase.xs.length - 1));
  useEffect(() => {
    if (stage > n + 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 500 : stage < n ? 850 : 1000);
    return () => clearTimeout(t);
  }, [stage, n]);
  const assembled = stage > n;
  const done = stage > n + 1;
  const x = phrase.xs[xi];
  const value = phrase.f(x);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface px-4 pb-3 pt-3">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">In words</div>
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
                  {p.w}
                </motion.span>
                <div className="flex h-11 items-start">{lit && !assembled && <Chip id={`${scope}-${i}`} m={p.m} n={i + 1} />}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">In maths</span>
          <button onClick={onReplay} className="ml-auto grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label="Replay" title="Replay">
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
            <span className="text-[13px] text-ink-3">Translating piece by piece…</span>
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
              <span className="text-[13px] text-ink-2">Test it with</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setXi((i) => Math.max(0, i - 1))} disabled={xi === 0} className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover disabled:opacity-35" aria-label="Smaller number">
                  <Minus className="size-3" />
                </button>
                <span className="w-14 text-center font-math text-[18px]">
                  <i>x</i> = {x}
                </span>
                <button onClick={() => setXi((i) => Math.min(phrase.xs.length - 1, i + 1))} disabled={xi === phrase.xs.length - 1} className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover disabled:opacity-35" aria-label="Bigger number">
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
type BuildCase = { text: string; letX: string; x0: number; chips: BuildChip[]; show: string[]; hint: string; answer: string };

const ch = (id: string, d: string, p = d): BuildChip => ({ id, d, p });

const BUILD: BuildCase[] = [
  {
    text: "Lea has 3 times as many stickers as Ben. Together they have 48 stickers.",
    letX: "Let $x$ be the number of Ben's stickers.",
    x0: 12,
    chips: [ch("x", "x"), ch("3x", "3x"), ch("p", "+"), ch("e", "="), ch("48", "48"), ch("x3", "(x + 3)", "(x+3)"), ch("m", "-"), ch("16", "16")],
    show: ["x", "p", "3x", "e", "48"],
    hint: "Ben has $x$, Lea has 3 times as many: $3x$. Together means: add them.",
    answer: "Ben has 12 stickers and Lea has 36.",
  },
  {
    text: "The sum of three consecutive numbers is 57.",
    letX: "Let $x$ be the smallest of the three numbers.",
    x0: 18,
    chips: [ch("x", "x"), ch("x1", "(x + 1)", "(x+1)"), ch("x2", "(x + 2)", "(x+2)"), ch("p1", "+"), ch("p2", "+"), ch("e", "="), ch("57", "57"), ch("3x", "3x"), ch("x3", "(x + 3)", "(x+3)")],
    show: ["x", "p1", "x1", "p2", "x2", "e", "57"],
    hint: "The numbers are $x$, $x + 1$ and $x + 2$. Their sum is 57.",
    answer: "The numbers are 18, 19 and 20.",
  },
  {
    text: "A rectangle is 4 cm longer than it is wide. Its perimeter is 32 cm.",
    letX: "Let $x$ be the width in cm.",
    x0: 6,
    chips: [ch("2x", "2x"), ch("2b", "2(x + 4)", "2(x+4)"), ch("p", "+"), ch("e", "="), ch("32", "32"), ch("x4", "(x + 4)", "(x+4)"), ch("4x", "4x"), ch("8", "8")],
    show: ["2x", "p", "2b", "e", "32"],
    hint: "Two widths: $2x$. Two lengths: $2(x + 4)$. Together they make the perimeter.",
    answer: "The rectangle is 6 cm wide and 10 cm long.",
  },
  {
    text: "3 child tickets and 2 adult tickets cost 43 € in total. An adult ticket costs 4 € more than a child ticket.",
    letX: "Let $x$ be the price of a child ticket in €.",
    x0: 7,
    chips: [ch("3x", "3x"), ch("2b", "2(x + 4)", "2(x+4)"), ch("p", "+"), ch("e", "="), ch("43", "43"), ch("2x4", "2x + 4", "2x+4"), ch("5x", "5x"), ch("m", "-")],
    show: ["3x", "p", "2b", "e", "43"],
    hint: "An adult ticket costs $x + 4$, and there are 2 of them: $2(x + 4)$. Brackets!",
    answer: "A child ticket costs 7 €, an adult ticket 11 €.",
  },
  {
    text: "Mum is 26 years older than Tom. Together they are 50 years old.",
    letX: "Let $x$ be Tom's age.",
    x0: 12,
    chips: [ch("x", "x"), ch("x26", "(x + 26)", "(x+26)"), ch("p", "+"), ch("e", "="), ch("50", "50"), ch("26x", "26x"), ch("m", "-"), ch("xm", "(x - 26)", "(x-26)")],
    show: ["x", "p", "x26", "e", "50"],
    hint: "Tom is $x$. Mum is 26 years older: $x + 26$. Together means: add.",
    answer: "Tom is 12 and Mum is 38 years old.",
  },
];

type Verdict = { ok: true; a: [number, number, number, number] } | { ok: false; msg: string };

function judge(c: BuildCase, line: BuildChip[]): Verdict {
  if (!line.length) return { ok: false, msg: "Tap the chips to build your equation." };
  const eqs = line.filter((t) => t.p === "=").length;
  if (eqs !== 1) return { ok: false, msg: eqs === 0 ? "An equation needs an equals sign." : "Only one equals sign, please." };
  const i = line.findIndex((t) => t.p === "=");
  const L = line.slice(0, i).map((t) => t.p).join(" ");
  const R = line.slice(i + 1).map((t) => t.p).join(" ");
  const pl = L ? parse(L) : null;
  const pr = R ? parse(R) : null;
  if (!pl?.ok || !pr?.ok) return { ok: false, msg: "That doesn't read as maths yet. Check the order of the chips." };
  const Lf = (x: number) => evaluate(pl.ast, { x });
  const Rf = (x: number) => evaluate(pr.ast, { x });
  const g = (x: number) => Lf(x) - Rf(x);
  const linear = Math.abs(g(2) - 2 * g(1) + g(0)) < 1e-9;
  if (linear && Math.abs(g(c.x0)) < 1e-9 && Math.abs(g(c.x0 + 1.37)) > 1e-9) {
    return { ok: true, a: [Lf(1) - Lf(0), Lf(0), Rf(1) - Rf(0), Rf(0)] };
  }
  return { ok: false, msg: c.hint };
}

function BlobSays({ text, mood }: { text: string; mood: BlobMood }) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="shrink-0">
        <Blob size={52} mood={mood} track={false} accessory="glasses" interactive={false} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={spring}
          style={{ transformOrigin: "bottom left" }}
          className="mb-2 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[14px] leading-snug text-ink shadow-card"
        >
          <Inline text={text} />
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
  const scope = useId();
  const [line, setLine] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tries, setTries] = useState(0);
  const [shown, setShown] = useState(false);
  const [say, setSay] = useState<{ text: string; mood: BlobMood }>({ text: "Tap the chips in the right order. Some of them are traps!", mood: "happy" });
  const byId = (id: string) => c.chips.find((t) => t.id === id)!;
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
      setSay({ text: fromShow ? "Here it is. Watch how it gets solved!" : "Yes! That equation fits the story. Now watch it get solved.", mood: "excited" });
    } else {
      setTries((t) => t + 1);
      setSay({ text: v.msg, mood: "thinking" });
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
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Story {index + 1}</span>
        <button onClick={onNext} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> Another story
        </button>
      </div>
      <div className="rounded-xl border border-line bg-surface px-5 py-4 text-[17px] leading-relaxed text-ink">
        <p>{c.text}</p>
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
        {line.length === 0 && <span className="text-[13.5px] text-ink-3">Your equation appears here</span>}
        {line.map((id) => (
          <BuildToken key={id} chip={byId(id)} layoutId={`${scope}-${id}`} onClick={() => toggle(id)} disabled={solved} />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {c.chips.map((t) =>
          line.includes(t.id) ? (
            <span key={t.id} className="rounded-xl border border-dashed border-line-2 px-3 py-1.5">
              <span className="invisible">
                <MathView src={t.d} size="md" animate={false} />
              </span>
            </span>
          ) : (
            <BuildToken key={t.id} chip={t} layoutId={`${scope}-${t.id}`} onClick={() => toggle(t.id)} disabled={solved} />
          ),
        )}
      </div>

      {!solved && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => checkLine(line)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper transition-transform hover:bg-ink/88 active:scale-[0.97]"
          >
            <Check className="size-4" /> Check
          </button>
          <button
            onClick={() => {
              setLine([]);
              setVerdict(null);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Eraser className="size-4" /> Clear
          </button>
          {tries > 0 && (
            <button onClick={showMe} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              <Wand2 className="size-4" /> Show me
            </button>
          )}
        </div>
      )}

      <BlobSays text={say.text} mood={say.mood} />

      <AnimatePresence>
        {solved && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }} className="space-y-3">
            <SolutionPlayer frames={frames} size="md" interval={1900} />
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 * frames.length }} className="rounded-xl bg-blob-soft/50 px-4 py-3 text-[15px] font-medium text-ink">
              {shown ? "" : "Your equation works! "}
              {c.answer}
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
  const built: Frame = { math: line.map((t) => t.d).join(" "), note: "Your equation, straight from the story." };
  const side = (ax: number, b: number, id: string): Tm[] => [...(ax ? [X(`${id}x`, ax)] : []), ...(b ? [K(`${id}k`, b)] : [])];
  const tidy: Eq = { l: side(a[0], a[1], "l"), r: side(a[2], a[3], "r") };
  const same = eqPlain(tidy).replace(/\s+/g, "") === line.map((t) => t.p).join("").replace(/[()]/g, "");
  const brackets = line.some((t) => t.p.includes("("));
  const tidyNote = brackets ? "Expand the brackets and combine like terms." : "Combine like terms.";
  const { frames } = solveFrames(tidy, same ? "Let's solve it with balance steps." : tidyNote, same ? [] : [built]);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: `${last.note} ${c.answer}` };
  return frames;
}

// ---------------------------------------------------------------------------
// Lesson

const riddleEq: Eq = { l: [X("A", 3), K("b", 5)], r: [K("r", 26)] };

const nameFrames: Frame[] = [
  { math: "x#vA", note: "**Let** $x$ **be** the number I'm thinking of. Now translate the riddle, piece by piece." },
  { math: "3#cA x#vA", note: '"I multiply it by 3": $3x$.' },
  { math: "3#cA x#vA +#sb 5#cb", note: '"and then add 5": $3x + 5$.' },
  { math: "3#cA x#vA +#sb 5#cb =#eq 26#cr", note: '"The result is 26." That\'s our **equation**!' },
];

const solveRiddle = (() => {
  const { frames } = solveFrames(riddleEq, "Our equation from the riddle. Goal: $x$ alone on one side.");
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: `${last.note} **Answer sentence:** My number is 7.` };
  frames.push({ math: "3#cA \\cdot#dt 7#vA +#sb 5#cb =#eq 26#cr", note: "**Check** in the story: 3 times 7 is 21, plus 5 is 26. It works!" });
  return frames;
})();

const shareLesson = shareStory(["Anna", "Ben", "Cem"], "twiceMore", 25, 20, 0, true);
const shareFrames = (() => {
  const { frames } = solveFrames(shareLesson.eq, shareLesson.eqNote, [
    { math: `"Anna:"#la x#vA`, note: "Anna gets the least, so let $x$ be Anna's share in €." },
    { math: `"Anna:"#la x#vA ,#c1 \\quad "Ben:"#lb 2#cB x#vB`, note: "Ben gets twice as much: $2x$." },
    { math: `"Anna:"#la x#vA ,#c1 \\quad "Ben:"#lb 2#cB x#vB ,#c2 \\quad "Cem:"#lc x#vC1 +#sC2 20#cC2`, note: "Cem gets 20 € more than Anna: $x + 20$." },
  ]);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: `${last.note} Anna gets 25 €, Ben $2 \\cdot 25 = 50$ €, Cem $25 + 20 = 45$ €. Check: $25 + 50 + 45 = 120$.` };
  return frames;
})();

const ageLesson = ageFutureStory("Lena", "Mum", 3, 2, 12);
const ageFrames = (() => {
  const { frames } = solveFrames(ageLesson.eq, ageLesson.eqNote, ageLesson.define);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: `${last.note} ${ageLesson.answerText}` };
  return frames;
})();

const unknowns: Topic = {
  ...topicMeta("unknowns"),
  summary: [
    { title: "Name the unknown", body: "Start with **Let** $x$ **be …** Choose the smallest or simplest quantity, then write everything else with $x$.", examples: ['"Anna:" x , \\quad "Ben:" 2x , \\quad "Cem:" x + 20'], tone: "rule" },
    {
      title: "Translate piece by piece",
      body: "Words become maths. Watch the order!",
      examples: ['"twice a number:" \\quad 2x', '"5 more than a number:" \\quad x + 5', '"3 less than a number:" \\quad x - 3', '"a third of a number:" \\quad \\frac{x}{3}'],
      tone: "rule",
    },
    { title: "Solve with balance steps", body: "Do the same on both sides until $x$ is alone.", examples: ["3x + 5 = 26 \\quad | -5", "3x = 21 \\quad | :3", "x = 7"], tone: "rule" },
    { title: "Consecutive numbers", body: "One after the other: add 1 each time. Even or odd ones: add 2 each time.", examples: ["x , \\quad x + 1 , \\quad x + 2", "x , \\quad x + 2 , \\quad x + 4"], tone: "tip" },
    { title: "Brackets matter", body: '"Twice the sum of $x$ and 4" doubles the **whole** sum. "In 5 years" adds 5 to **every** age.', examples: ["2(x + 4) \\ne 2x + 4"], tone: "warning" },
    { title: "Answer and check", body: "Answer in a full sentence, with the unit. Check your result in the **story**, not just in the equation.", tone: "tip" },
  ],
  lesson: [
    {
      type: "explain",
      title: "Let x be the unknown",
      blob: "One number is missing? Give it a name! We call it x.",
      body: '**"I think of a number. I multiply it by 3 and then add 5. The result is 26. What is my number?"** Name the unknown number $x$, then translate the story into maths, piece by piece.',
      frames: nameFrames,
    },
    {
      type: "widget",
      title: "From words to maths",
      blob: "Pick a phrase and watch it turn into maths!",
      body: "Each piece of the sentence becomes a piece of maths. Sometimes the order changes, sometimes you need brackets. Try them all, and test each term with a number.",
      widget: Translator,
    },
    {
      type: "check",
      blob: "Careful, this one is a classic trap!",
      exercise: {
        instruction: "Which term fits?",
        text: "Translate into maths: **Subtract 7 from a number, then double the result.**",
        answer: { kind: "choice", options: ["$2x - 7$", "$2(x - 7)$", "$x - 14$", "$7 - 2x$"], correct: 1 },
        hint: "What gets doubled: only the number, or the whole result?",
        solution: [
          { math: "x#vA", note: "Let $x$ be the number." },
          { math: "x#vA -#s 7#c", note: "Subtract 7 from it: $x - 7$." },
          { math: "2#f (x#vA -#s 7#c)#b", note: "Then double the **result**: the whole difference, so it needs brackets. $2x - 7$ would only double the $x$." },
        ],
      },
    },
    {
      type: "explain",
      title: "Solve, answer, check",
      blob: "Now the fun part: get x on its own!",
      body: "Solve the equation with balance steps: whatever you do to one side, do to the other. Then answer in a sentence and check the answer **in the story**.",
      frames: solveRiddle,
    },
    {
      type: "check",
      blob: "Your turn! Let x be the number…",
      exercise: story({
        text: "If you double a number and subtract 9, you get 31. What is the number?",
        define: [defineNumber],
        eq: { l: [X("A", 2), K("b", -9)], r: [K("r", 31)] },
        eqNote: "Double: $2x$. Then minus 9. That makes 31.",
        x: 20,
        answer: { kind: "number", value: 20, label: "x =" },
        answerText: "**Answer:** The number is 20. Check: $2 \\cdot 20 - 9 = 31$.",
        hint: "Let $x$ be the number: $2x - 9 = 31$. Undo the minus first.",
        meaning: "the number",
      }),
    },
    {
      type: "explain",
      title: "One x for several parts",
      blob: "Three people, but only one x. Here's the trick!",
      body: "**Anna, Ben and Cem share 120 €. Ben gets twice as much as Anna. Cem gets 20 € more than Anna.** Choose $x$ for the smallest part. Write every other part with $x$, then add them all up.",
      frames: shareFrames,
    },
    {
      type: "widget",
      title: "Build the equation",
      blob: "You build it this time. Watch out for the trap chips!",
      body: "Read the story and tap the chips in the right order to build the equation. Tap a chip in your equation to send it back.",
      widget: EquationBuilder,
    },
    {
      type: "check",
      blob: "Consecutive numbers: x, x + 1, x + 2!",
      exercise: story(consecutiveStory("three", 28, "largest")),
    },
    {
      type: "explain",
      title: "Age problems: now and later",
      blob: "Age problems look tricky, but a little table makes them easy.",
      body: "**Mum is three times as old as Lena. In 12 years, Mum will be twice as old as Lena. How old is Lena now?** Write both ages now, then both ages later. Time passes for **everyone**!",
      frames: ageFrames,
    },
    {
      type: "check",
      blob: "Last one! Now and in 5 years.",
      exercise: story(ageFutureStory("Tim", "Dad", 4, 3, 5)),
    },
  ],
  generate,
};

export default unknowns;
