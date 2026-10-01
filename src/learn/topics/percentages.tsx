"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import { gcd, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Numbers

const r2 = (v: number) => Math.round(v * 100) / 100;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** "0.15", "297.5", "1500" */
const num = (v: number) => String(r6(v));
/** Money: "60" or "297.50". */
const cash = (v: number) => (Number.isInteger(r2(v)) ? String(r2(v)) : r2(v).toFixed(2));
const amt = (v: number, unit: string) => (unit === "€" ? cash(v) : num(v));
/** A quoted unit token for the display language: ` "kg"#u`. */
const unitTok = (unit: string, key: string) => (unit ? ` "${unit}"#${key}` : "");
const unitWord = (unit: string) => (unit ? ` ${unit}` : "");

/** Money answers accept one cent either way; everything else must be exact. */
function amount(v: number, unit: string, label?: string): AnswerSpec {
  const value = unit === "€" ? r2(v) : r6(v);
  return {
    kind: "number",
    value,
    unit,
    ...(label ? { label } : {}),
    ...(unit === "€" ? { tolerance: 0.0101 / Math.max(1, Math.abs(value)) } : {}),
  };
}
const rateAnswer = (p: number, label?: string): AnswerSpec => ({ kind: "number", value: r6(p), unit: "%", ...(label ? { label } : {}) });

// ---------------------------------------------------------------------------
// Worked solutions

const SHORTCUTS: Record<number, (G: string, W: string) => string> = {
  50: (G, W) => `Shortcut: $50 %$ is half, so $${G} : 2 = ${W}$.`,
  25: (G, W) => `Shortcut: $25 %$ is a quarter, so $${G} : 4 = ${W}$.`,
  10: (G, W) => `Shortcut: $10 %$ is a tenth, so $${G} : 10 = ${W}$.`,
  20: (G, W) => `Shortcut: $20 %$ is a fifth, so $${G} : 5 = ${W}$.`,
  1: (G, W) => `Shortcut: $1 %$ is a hundredth, so $${G} : 100 = ${W}$.`,
  75: (G, W) => `Shortcut: $75 %$ is three quarters, so $${G} : 4 \\cdot 3 = ${W}$.`,
};

/** W = G · p/100 */
function findWFrames(p: number, G: number, unit: string): Frame[] {
  const q = p / 100;
  const W = G * q;
  const u = unitTok(unit, "u");
  const shortcut = SHORTCUTS[p]?.(amt(G, unit), amt(W, unit));
  return [
    { math: `W#W =#e ${amt(G, unit)}#G${u} \\cdot#m \\frac{${p}#p}{100#h}#f`, note: "Percentage = base value times rate: $W = G \\cdot \\frac{p}{100}$.", highlight: ["G", "p"] },
    { math: `W#W =#e ${amt(G, unit)}#G${u} \\cdot#m ${num(q)}#q`, note: `Write the rate as a decimal: $${p} % = ${num(q)}$.`, highlight: ["q"] },
    { math: `W#W =#e ${amt(W, unit)}#G${u}`, note: `$${amt(G, unit)} \\cdot ${num(q)} = ${amt(W, unit)}$${unitWord(unit)}.${shortcut ? ` ${shortcut}` : ""}` },
  ];
}

/** p % = W / G */
function findPFrames(W: number, G: number): Frame[] {
  const q = W / G;
  return [
    { math: "p#p %#pc =#e \\frac{W#Wv}{G#Gv}#f", note: "The rate is the part divided by the whole: $p % = \\frac{W}{G}$." },
    { math: `p#p %#pc =#e \\frac{${num(W)}#W}{${num(G)}#G}#f`, note: `Here the part is $W = ${num(W)}$ and the whole is $G = ${num(G)}$.`, highlight: ["W", "G"] },
    { math: `p#p %#pc =#e ${num(q)}#q`, note: `$${num(W)} : ${num(G)} = ${num(q)}$.` },
    { math: `p#p %#pc =#e ${num(q * 100)}#q %#pc2`, note: `As a percentage: $${num(q)} = ${num(q * 100)} %$. Move the point two places to the right.`, highlight: ["q"] },
  ];
}

/** G from W and p with the rule of three (Dreisatz). */
function findGFrames(p: number, W: number, unit: string): Frame[] {
  const one = W / p;
  const G = W * (100 / p);
  const u = unitTok(unit, "u");
  return [
    { math: `${p}#a %#ap \\to#to ${amt(W, unit)}#b${u}`, note: `Write down what you know: $${p} %$ of the whole are $${amt(W, unit)}$${unitWord(unit)}.` },
    {
      math: `1#a %#ap \\to#to ${amt(one, unit)}#b${u} \\quad \\fade{:#s1 ${p}#s2}`,
      note: `Rule of three (Dreisatz): divide both sides by $${p}$. That gives $1 %$.`,
      highlight: ["a", "b"],
    },
    {
      math: `100#a %#ap \\to#to ${amt(G, unit)}#b${u} \\quad \\fade{\\cdot#s1 100#s2}`,
      note: `Multiply by $100$: $100 %$ is the base value, $G = ${amt(G, unit)}$${unitWord(unit)}.`,
      highlight: ["a", "b"],
    },
  ];
}

/** A change by p %: growth factor q, new value G · q. */
function changeFrames(G: number, p: number, up: boolean, unit: string): Frame[] {
  const q = 1 + (up ? p : -p) / 100;
  const N = G * q;
  const left = up ? 100 + p : 100 - p;
  const u = unitTok(unit, "u");
  return [
    {
      math: `100#a %#ap ${up ? "+" : "-"}#pm ${p}#b %#bp =#e ${left}#c %#cp`,
      note: up ? `The old value is $100 %$. After the rise, the new value is $${left} %$ of it.` : `The old value is $100 %$. After $${p} %$ off, $${left} %$ is left.`,
    },
    { math: `q#q =#e ${left}#c %#cp =#e2 ${num(q)}#f`, note: `As a decimal, that's the growth factor $q = ${num(q)}$ (Wachstumsfaktor).`, highlight: ["f"] },
    { math: `${amt(G, unit)}#G${u} \\cdot#t ${num(q)}#f =#e3 ${amt(N, unit)}#r${unitTok(unit, "u2")}`, note: `New value = old value $\\cdot\\, q$: $${amt(G, unit)} \\cdot ${num(q)} = ${amt(N, unit)}$${unitWord(unit)}.`, highlight: ["r"] },
  ];
}

/** Back to the original value: divide by the growth factor. */
function reverseFrames(N: number, p: number, up: boolean, unit: string): Frame[] {
  const q = 1 + (up ? p : -p) / 100;
  const G = N / q;
  const u = unitTok(unit, "u");
  return [
    {
      math: `G#G \\cdot#t ${num(q)}#f =#e ${amt(N, unit)}#W${u}`,
      note: up
        ? `A rise of $${p} %$ means: old value $G$ times $${num(q)}$ gives the new value $${amt(N, unit)}$${unitWord(unit)}.`
        : `$${p} %$ off means: old value $G$ times $${num(q)}$ gives the new value $${amt(N, unit)}$${unitWord(unit)}.`,
      highlight: ["f"],
    },
    { math: `G#G =#e ${amt(N, unit)}#W${u} :#t2 ${num(q)}#f`, note: "Undo the multiplication: divide by the growth factor.", highlight: ["t2", "f"] },
    { math: `G#G =#e ${amt(G, unit)}#W${u}`, note: `$${amt(N, unit)} : ${num(q)} = ${amt(G, unit)}$. Check: $${amt(G, unit)} \\cdot ${num(q)} = ${amt(N, unit)}$.`, highlight: ["W"] },
  ];
}

type Change = { up: boolean; p: number };
const factorOf = (c: Change) => 1 + (c.up ? c.p : -c.p) / 100;
const changeNote = (c: Change) => (c.up ? `a rise of $${c.p} %$ means $\\cdot\\, ${num(factorOf(c))}$` : `a drop of $${c.p} %$ means $\\cdot\\, ${num(factorOf(c))}$`);

/** Two changes in a row, step by step. */
function chainFrames(G: number, changes: Change[], unit: string): Frame[] {
  const u = unitTok(unit, "u");
  const fac = changes.map(factorOf);
  const tail = (from: number) =>
    fac
      .slice(from)
      .map((q, i) => ` \\cdot#t${from + i} ${num(q)}#q${from + i}`)
      .join("");
  const frames: Frame[] = [
    { math: `${amt(G, unit)}#v${u}${tail(0)}`, note: `Each change is one growth factor: ${changes.map(changeNote).join(", and ")}.` },
  ];
  let v = G;
  fac.forEach((q, i) => {
    const before = v;
    v *= q;
    frames.push({ math: `${amt(v, unit)}#v${u}${tail(i + 1)}`, note: `${i === 0 ? "First change" : "Next change"}: $${amt(before, unit)} \\cdot ${num(q)} = ${amt(v, unit)}$${unitWord(unit)}.` });
  });
  return frames;
}

/** Total change of several changes: multiply the factors. */
function totalFrames(changes: Change[]): Frame[] {
  const fac = changes.map(factorOf);
  const Q = fac.reduce((a, b) => a * b, 1);
  const prod = fac.map((q, i) => `${i ? ` \\cdot#t${i} ` : ""}${num(q)}#q${i}`).join("");
  const pct = r6(Math.abs(Q - 1) * 100);
  return [
    { math: prod, note: `Turn each change into a growth factor: ${changes.map(changeNote).join(", and ")}.` },
    { math: `${prod} =#e ${num(Q)}#Q`, note: `Multiply the factors: $q = ${num(Q)}$.`, highlight: ["Q"] },
    { math: `${num(Q)}#Q =#e2 ${num(Q * 100)}#P %#pc`, note: `The final value is $${num(Q * 100)} %$ of the original.`, highlight: ["P"] },
    {
      math: Q > 1 ? `${num(Q * 100)}#P %#pc -#m 100#H %#hp =#e3 ${num(pct)}#A %#ap` : `100#H %#hp -#m ${num(Q * 100)}#P %#pc =#e3 ${num(pct)}#A %#ap`,
      note: Q > 1 ? `Compared with the $100 %$ at the start, that's $${num(pct)} %$ more.` : `Compared with the $100 %$ at the start, that's $${num(pct)} %$ less.`,
      highlight: ["A"],
    },
  ];
}

/** Compound growth or decay over n years. */
function compoundFrames(K: number, p: number, up: boolean, n: number, unit: string, whole = false): Frame[] {
  const q = 1 + (up ? p : -p) / 100;
  const exact = K * q ** n;
  const shown = whole ? String(Math.round(exact)) : amt(exact, unit);
  const isExact = Math.abs(Number(shown) - exact) < 1e-9;
  // Money keeps its unit on the board; counts (inhabitants) only get it in the result.
  const u = unit === "€" ? unitTok(unit, "u") : "";
  const L = unit === "€" ? "K" : "N";
  const factors = Array.from({ length: n }, (_, i) => ` \\cdot#t${i} ${num(q)}#q${i}`).join("");
  return [
    { math: `${L}_${n} =#e ${K}#k${u}${factors}`, note: `Each year the value is multiplied by $q = ${num(q)}$. After ${n} years, that's ${n} times.` },
    { math: `${L}_${n} =#e ${K}#k${u} \\cdot#t0 ${num(q)}#q0^{${n}#n}`, note: `Write it as a power: $${L}_${n} = ${K} \\cdot ${num(q)}^${n}$.`, highlight: ["n"] },
    {
      math: `${L}_${n} ${isExact ? "=" : "\\approx"}#e ${shown}#k${unitTok(unit, "u")}`,
      note: `With a calculator: $${K} \\cdot ${num(q)}^${n} ${isExact ? "=" : "\\approx"} ${shown}$${unitWord(unit)}.${isExact ? "" : whole ? " Rounded to a whole number." : " Rounded to the cent."}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Exercise generator

type Gen = (rng: Rng) => Exercise | null;

function pickWeighted(rng: Rng, list: [number, Gen][]): Gen {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, g] of list) {
    r -= w;
    if (r < 0) return g;
  }
  return list[list.length - 1][1];
}

/** Smallest base value step that makes p % of it a whole number. */
const stepFor = (p: number) => 100 / gcd(p, 100);

const UNITS = ["€", "kg", "m", "L", "g", "km"];

// Level 1 ---------------------------------------------------------------------

function wTask(rng: Rng): Exercise | null {
  const p = rng.pick([1, 2, 5, 10, 10, 15, 20, 25, 25, 30, 40, 50, 50, 60, 75, 80]);
  const unit = rng.pick(UNITS);
  const step = Math.max(stepFor(p), 10);
  const G = step * rng.int(2, Math.floor(1200 / step));
  if (G < 20 || (G % 10 !== 0 && rng.chance(0.6))) return null;
  const W = (G * p) / 100;
  return {
    instruction: "Calculate",
    math: `${p} % "of" ${G} "${unit}"`,
    answer: amount(W, unit),
    hint: SHORTCUTS[p] ? "Use a shortcut, or $W = G \\cdot \\frac{p}{100}$." : `$${p} % = ${num(p / 100)}$. Multiply the base value by it.`,
    solution: findWFrames(p, G, unit),
  };
}

const W_STORIES: { unit: string; bases: number[]; text: (p: number, G: number) => string }[] = [
  { unit: "students", bases: [20, 24, 25, 28, 30, 32], text: (p, G) => `Class 8b has ${G} students. ${p} % of them come to school by bike. How many students is that?` },
  { unit: "members", bases: [60, 80, 120, 150, 200, 240, 300, 400], text: (p, G) => `A sports club has ${G} members. ${p} % of them are under 18. How many members is that?` },
  { unit: "g", bases: [200, 250, 300, 400, 500, 750, 1000], text: (p, G) => `A bag of trail mix weighs ${G} g. ${p} % of it is nuts. How many grams of nuts are in the bag?` },
  { unit: "€", bases: [600, 750, 800, 900, 1000, 1200], text: (p, G) => `Jonas earns ${G} € a month as an apprentice. He saves ${p} % of it. How much does he save each month?` },
  { unit: "students", bases: [300, 400, 450, 500, 600, 800, 1200], text: (p, G) => `A school has ${G} students. ${p} % of them take part in the sports day. How many students take part?` },
];

function wStoryTask(rng: Rng): Exercise | null {
  const story = rng.pick(W_STORIES);
  const G = rng.pick(story.bases);
  const rates = [5, 10, 20, 25, 30, 40, 50, 60, 75, 80, 15].filter((p) => Number.isInteger((G * p) / 100));
  if (!rates.length) return null;
  const p = rng.pick(rates);
  const W = (G * p) / 100;
  return {
    instruction: "Word problem",
    text: story.text(p, G),
    answer: amount(W, story.unit),
    hint: "What is the whole (base value $G$), and what is the rate? Then $W = G \\cdot \\frac{p}{100}$.",
    solution: findWFrames(p, G, story.unit),
  };
}

function convertTask(rng: Rng): Exercise | null {
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const p = rng.pick([3, 5, 8, 12, 15, 19, 25, 35, 40, 64, 70, 99, 120, 150, 7.5, 2.5]);
    const v = p / 100;
    return {
      instruction: "Write as a decimal",
      math: `${num(p)} %`,
      answer: { kind: "number", value: r6(v) },
      hint: "Percent means per hundred: divide by $100$.",
      solution: [
        { math: `${num(p)}#p %#pc`, note: "Percent means per hundred." },
        { math: `${num(p)}#p %#pc =#e \\frac{${num(p)}#n}{100#h}#f`, note: `$${num(p)} %$ is $${num(p)}$ hundredths.`, highlight: ["h"] },
        { math: `${num(p)}#p %#pc =#e \\frac{${num(p)}#n}{100#h}#f =#e2 ${num(v)}#v`, note: `Divide by $100$: the decimal point moves two places to the left. $${num(p)} % = ${num(v)}$.`, highlight: ["v"] },
      ],
    };
  }
  if (kind === 1) {
    const v = rng.pick([0.07, 0.3, 0.45, 0.08, 0.125, 0.6, 0.03, 0.95, 1.2, 0.005, 0.72, 0.19]);
    const p = v * 100;
    return {
      instruction: "Write as a percentage",
      math: num(v),
      answer: rateAnswer(p),
      hint: "Multiply by $100$: move the decimal point two places to the right.",
      solution: [
        { math: `${num(v)}#v`, note: "A percentage counts hundredths." },
        { math: `${num(v)}#v =#e \\frac{${num(p)}#n}{100#h}#f`, note: `$${num(v)}$ is $${num(p)}$ hundredths.` },
        { math: `${num(v)}#v =#e \\frac{${num(p)}#n}{100#h}#f =#e2 ${num(p)}#p %#pc`, note: `Hundredths are percent: $${num(v)} = ${num(p)} %$.`, highlight: ["p"] },
      ],
    };
  }
  const d = rng.pick([2, 4, 5, 10, 20, 25, 50]);
  const n = rng.int(1, d - 1);
  if (gcd(n, d) !== 1) return null;
  const k = 100 / d;
  const p = n * k;
  return {
    instruction: "Write as a percentage",
    math: `\\frac{${n}}{${d}}`,
    answer: rateAnswer(p),
    hint: `Expand the fraction so that the denominator is $100$: multiply top and bottom by $${k}$.`,
    solution: [
      { math: `\\frac{${n}#n}{${d}#d}#f`, note: "Percent means hundredths. So aim for the denominator $100$." },
      { math: `\\frac{${n}#n \\cdot#m1 ${k}#k1}{${d}#d \\cdot#m2 ${k}#k2}#f`, note: `$${d} \\cdot ${k} = 100$, so expand by $${k}$.`, highlight: ["k1", "k2"] },
      { math: `\\frac{${p}#n}{100#d}#f`, note: `That's $${p}$ hundredths.` },
      { math: `\\frac{${p}#n}{100#d}#f =#e ${p}#p %#pc`, note: `$${p}$ hundredths are $${p} %$.`, highlight: ["p"] },
    ],
  };
}

const GRIDS: [number, number][] = [
  [10, 10],
  [5, 10],
  [5, 5],
  [4, 5],
  [2, 5],
  [4, 10],
];

function gridTask(rng: Rng): Exercise | null {
  const [rows, cols] = rng.pick(GRIDS);
  const total = rows * cols;
  const k = rng.int(1, total - 1);
  const p = (k * 100) / total;
  if (!Number.isInteger(p) && rng.chance(0.85)) return null;
  const m = 100 / total;
  const frames: Frame[] = [{ math: `\\frac{${k}#n}{${total}#d}#f`, note: `$${k}$ of the $${total}$ squares are shaded.` }];
  if (total !== 100) {
    frames.push({ math: `\\frac{${k}#n \\cdot#m1 ${num(m)}#k1}{${total}#d \\cdot#m2 ${num(m)}#k2}#f`, note: `Expand to hundredths: $${total} \\cdot ${num(m)} = 100$.`, highlight: ["k1", "k2"] });
    frames.push({ math: `\\frac{${num(p)}#n}{100#d}#f`, note: `$${k} \\cdot ${num(m)} = ${num(p)}$.` });
  }
  frames.push({ math: `\\frac{${num(p)}#n}{100#d}#f =#e ${num(p)}#p %#pc`, note: `$${num(p)}$ hundredths are $${num(p)} %$.`, highlight: ["p"] });
  return {
    instruction: "Read the picture",
    text: "What percentage of the grid is shaded?",
    answer: rateAnswer(p),
    hint: total === 100 ? "Each square is $1 %$." : `There are $${total}$ squares, so each one is $100 : ${total} = ${num(m)} %$.`,
    solution: frames,
    visual: { component: PercentGrid as unknown as ComponentType<Record<string, unknown>>, props: { rows, cols, k } },
  };
}

// Level 2 ---------------------------------------------------------------------

const P_STORIES: { text: (W: number, G: number) => string; maxG: number }[] = [
  { text: (W, G) => `In a survey, ${W} of ${G} students said maths is their favourite subject. What percentage is that?`, maxG: 200 },
  { text: (W, G) => `A football team won ${W} of its ${G} games this season. What percentage of its games did it win?`, maxG: 40 },
  { text: (W, G) => `A chocolate bar weighs ${G} g and contains ${W} g of sugar. What percentage of the bar is sugar?`, maxG: 300 },
  { text: (W, G) => `${W} of the ${G} seats in a cinema are taken. What percentage of the seats are taken?`, maxG: 400 },
  { text: (W, G) => `Mira answered ${W} of ${G} quiz questions correctly. What percentage is that?`, maxG: 50 },
];

function pTask(rng: Rng): Exercise | null {
  const p = rng.pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 64, 75, 80, 12, 8, 90]);
  const step = stepFor(p);
  const asText = rng.chance(0.6);
  const story = rng.pick(P_STORIES);
  const maxG = asText ? story.maxG : 800;
  if (step > maxG) return null;
  const G = step * rng.int(1, Math.floor(maxG / step));
  const W = (G * p) / 100;
  if (G < 8 || W < 1) return null;
  const unit = rng.pick(UNITS);
  return {
    instruction: asText ? "Word problem" : "Find the percent rate",
    ...(asText ? { text: story.text(W, G) } : { math: `G = ${amt(G, unit)} "${unit}" ,\\quad W = ${amt(W, unit)} "${unit}"` }),
    answer: rateAnswer(p, asText ? undefined : "p ="),
    hint: "Part divided by whole: $p % = \\frac{W}{G}$. Then turn the decimal into a percentage.",
    solution: findPFrames(W, G),
  };
}

const G_STORIES: { unit: string; min: number; max: number; text: (W: string, p: number) => string; counts?: boolean }[] = [
  { unit: "€", min: 200, max: 1500, text: (W, p) => `Paul has saved ${W} €. That is ${p} % of the price of a new bike. How much does the bike cost?` },
  { unit: "students", min: 300, max: 1500, counts: true, text: (W, p) => `${W} students of a school take the bus. That is ${p} % of all students. How many students go to the school?` },
  { unit: "pages", min: 80, max: 600, counts: true, text: (W, p) => `Lea has read ${W} pages of her book. That is ${p} % of the book. How many pages does the book have?` },
  { unit: "L", min: 100, max: 1500, text: (W, p) => `A water tank holds ${W} L. It is ${p} % full. How many litres does the full tank hold?` },
];

function gTask(rng: Rng): Exercise | null {
  const p = rng.pick([4, 5, 10, 15, 20, 25, 30, 40, 60, 75, 80, 12, 35]);
  const asText = rng.chance(0.6);
  const story = rng.pick(G_STORIES);
  const unit = asText ? story.unit : rng.pick(UNITS);
  const step = stepFor(p);
  const G = step * rng.int(1, Math.floor(1500 / step));
  const W = (G * p) / 100;
  if (G < 40 || G % 10 !== 0) return null;
  if (asText && (G < story.min || G > story.max || (story.counts && !Number.isInteger(W)))) return null;
  return {
    instruction: asText ? "Word problem" : "Find the base value",
    ...(asText ? { text: story.text(amt(W, unit), p) } : { math: `W = ${amt(W, unit)} "${unit}" ,\\quad p % = ${p} %` }),
    answer: amount(G, unit, asText ? undefined : "G ="),
    hint: `Rule of three: if $${p} %$ are $${amt(W, unit)}$, what is $1 %$? And then $100 %$?`,
    solution: findGFrames(p, W, unit),
  };
}

const CHANGE_STORIES: { up: boolean; vat?: boolean; unit: string; base: (rng: Rng) => number; text: (G: string, p: number) => string }[] = [
  { up: false, unit: "€", base: (rng) => 10 * rng.int(4, 30), text: (G, p) => `A jacket costs ${G} €. In the sale, the price is reduced by ${p} %. What is the sale price?` },
  { up: false, unit: "€", base: (rng) => 10 * rng.int(2, 8), text: (G, p) => `A video game costs ${G} €. Club members get ${p} % off. How much do members pay?` },
  { up: true, vat: true, unit: "€", base: (rng) => 5 * rng.int(4, 60), text: (G) => `Headphones cost ${G} € before VAT. VAT (Mehrwertsteuer) is 19 %. What is the price including VAT?` },
  { up: true, unit: "€", base: (rng) => 10 * rng.int(40, 120), text: (G, p) => `The rent for a flat is ${G} € a month. It goes up by ${p} %. What is the new rent?` },
  {
    up: true,
    unit: "inhabitants",
    base: (rng) => 100 * rng.int(20, 300),
    text: (G, p) => `A town has ${G} inhabitants. In one year the population grows by ${p} %. How many inhabitants does it have now?`,
  },
];

function changeTask(rng: Rng): Exercise | null {
  const story = rng.pick(CHANGE_STORIES);
  const p = story.vat ? 19 : story.up ? rng.pick([2, 3, 4, 5, 8, 10, 12, 15, 20]) : rng.pick([10, 15, 20, 25, 30, 40, 50, 35]);
  const G = story.base(rng);
  const N = G * factorOf({ up: story.up, p });
  if (story.unit === "inhabitants" && !Number.isInteger(r6(N))) return null;
  return {
    instruction: "Word problem",
    text: story.text(cash(G), p),
    answer: amount(N, story.unit),
    hint: story.up ? `The new value is $${100 + p} %$ of the old one. Multiply by the growth factor $${num(1 + p / 100)}$.` : `$${p} %$ off leaves $${100 - p} %$. Multiply by $${num(1 - p / 100)}$.`,
    solution: changeFrames(G, p, story.up, story.unit),
  };
}

// Level 3 ---------------------------------------------------------------------

const REVERSE_STORIES: { up: boolean; vat?: boolean; base: (rng: Rng) => number; text: (N: string, p: number) => string }[] = [
  { up: false, base: (rng) => 10 * rng.int(4, 30), text: (N, p) => `After a discount of ${p} %, a jacket costs ${N} €. What was the original price?` },
  { up: true, vat: true, base: (rng) => 10 * rng.int(10, 100), text: (N) => `A phone costs ${N} € including 19 % VAT. What is the price without VAT?` },
  { up: true, base: (rng) => 5 * rng.int(4, 30), text: (N, p) => `After a price rise of ${p} %, a concert ticket costs ${N} €. What did it cost before?` },
  { up: true, base: (rng) => 50 * rng.int(30, 70), text: (N, p) => `After a pay rise of ${p} %, Sara earns ${N} € a month. How much did she earn before?` },
  { up: false, base: (rng) => 10 * rng.int(4, 20), text: (N, p) => `In the sale, everything is ${p} % off. Tom pays ${N} € for a pair of shoes. What was the normal price?` },
];

function reverseTask(rng: Rng): Exercise | null {
  const story = rng.pick(REVERSE_STORIES);
  const p = story.vat ? 19 : story.up ? rng.pick([5, 10, 15, 20, 25, 4, 8]) : rng.pick([10, 15, 20, 25, 30, 40, 35]);
  const G = story.base(rng);
  const N = r2(G * factorOf({ up: story.up, p }));
  return {
    instruction: "Word problem",
    text: story.text(cash(N), p),
    answer: amount(G, "€"),
    hint: `The new price is $${story.up ? 100 + p : 100 - p} %$ of the old one. So divide by $${num(factorOf({ up: story.up, p }))}$. Careful: don't just ${story.up ? "subtract" : "add"} $${p} %$ of the new price!`,
    solution: reverseFrames(N, p, story.up, "€"),
  };
}

const CHAIN_STORIES: { text: (G: string, a: Change, b: Change) => string; signs: [boolean, boolean] }[] = [
  { signs: [true, false], text: (G, a, b) => `A bike costs ${G} €. First the price goes up by ${a.p} %, later it is reduced by ${b.p} %. What does the bike cost now?` },
  { signs: [true, false], text: (G, a, b) => `A share is worth ${G} €. On Monday its value rises by ${a.p} %, on Tuesday it falls by ${b.p} %. What is it worth now?` },
  { signs: [false, true], text: (G, a, b) => `In a sale, a TV is reduced from ${G} € by ${a.p} %. After the sale, the reduced price goes up by ${b.p} %. What does the TV cost after the sale?` },
  { signs: [true, true], text: (G, a, b) => `A shop raises a price of ${G} € by ${a.p} %. A month later it raises the new price by another ${b.p} %. What is the final price?` },
];

function chainTask(rng: Rng): Exercise | null {
  const story = rng.pick(CHAIN_STORIES);
  const pa = rng.pick([10, 20, 25, 50, 5]);
  const pb = rng.chance(0.4) ? pa : rng.pick([10, 20, 25, 50, 5]);
  const a: Change = { up: story.signs[0], p: pa };
  const b: Change = { up: story.signs[1], p: pb };
  const G = rng.pick([100, 200, 400, 500, 800, 1000, 50, 300, 250]);
  const N = G * factorOf(a) * factorOf(b);
  if (Math.abs(r2(N) - N) > 1e-9) return null;
  const same = a.p === b.p && a.up !== b.up;
  return {
    instruction: "Word problem",
    text: story.text(String(G), a, b),
    answer: amount(N, "€"),
    hint: same ? "Careful: the second change works on the **new** price. Multiply by both growth factors." : "One growth factor per change. Multiply the price by both.",
    solution: chainFrames(G, [a, b], "€"),
  };
}

function totalChangeTask(rng: Rng): Exercise | null {
  const kind = rng.int(0, 2);
  const p1 = rng.pick([10, 20, 25, 30, 50]);
  const p2 = rng.pick([10, 20, 25, 30, 50]);
  let changes: Change[];
  let text: string;
  if (kind === 0) {
    changes = [
      { up: true, p: p1 },
      { up: false, p: p1 },
    ];
    text = `A price goes up by ${p1} % and later goes down by ${p1} %. By how many percent is the final price lower than the original price?`;
  } else if (kind === 1) {
    changes = [
      { up: true, p: p1 },
      { up: true, p: p2 },
    ];
    text = `A price rises by ${p1} %, and later by another ${p2} %. By how many percent has it risen in total?`;
  } else {
    changes = [
      { up: false, p: p1 },
      { up: false, p: p2 },
    ];
    text = `In a sale, a price is reduced by ${p1} %. On the last day, the sale price is cut by another ${p2} %. By how many percent is the final price lower than the original price?`;
  }
  const Q = changes.map(factorOf).reduce((x, y) => x * y, 1);
  const pct = r6(Math.abs(Q - 1) * 100);
  if (pct === 0 || pct >= 100) return null;
  return {
    instruction: "Word problem",
    text,
    answer: rateAnswer(pct),
    hint: "Don't just add the percentages. Multiply the growth factors, then compare with $1$.",
    solution: totalFrames(changes),
  };
}

const COMPOUND_STORIES: { up: boolean; whole?: boolean; unit: string; text: (K: number, p: number, n: number) => string }[] = [
  {
    up: true,
    unit: "€",
    text: (K, p, n) => `Mia puts ${K} € into a savings account with ${p} % interest per year. The interest stays in the account and earns interest too (Zinseszins). How much money is in the account after ${n} years? Round to the cent.`,
  },
  { up: false, unit: "€", text: (K, p, n) => `A new car costs ${K} €. It loses ${p} % of its value every year. What is it worth after ${n} years? Round to the cent.` },
  {
    up: true,
    whole: true,
    unit: "inhabitants",
    text: (K, p, n) => `A town has ${K} inhabitants. The population grows by ${p} % each year. How many inhabitants will it have after ${n} years? Round to a whole number.`,
  },
];

function compoundTask(rng: Rng): Exercise | null {
  const story = rng.pick(COMPOUND_STORIES);
  const p = story.up ? rng.pick([2, 3, 4, 5]) : rng.pick([10, 15, 20, 25]);
  const n = rng.int(2, 3);
  const K = story.whole ? rng.int(5, 40) * 1000 : story.up ? rng.pick([500, 1000, 2000, 2500, 5000]) : rng.pick([10000, 12000, 15000, 20000, 25000, 30000]);
  const exact = K * (1 + (story.up ? p : -p) / 100) ** n;
  const value = story.whole ? Math.round(exact) : r2(exact);
  return {
    instruction: "Word problem",
    text: story.text(K, p, n),
    answer: story.whole ? { kind: "number", value, unit: story.unit, tolerance: 1.01 / Math.max(1, value) } : amount(value, "€"),
    hint: `Growth factor $q = ${num(1 + (story.up ? p : -p) / 100)}$, once per year: multiply by $q^${n}$.`,
    solution: compoundFrames(K, p, story.up, n, story.unit, story.whole),
  };
}

const POINT_STORIES: ((a: number, b: number) => string)[] = [
  (a, b) => `The share of students who cycle to school rises from ${a} % to ${b} %.`,
  (a, b) => `A bank raises its interest rate from ${a} % to ${b} %.`,
  (a, b) => `A party's result in an election goes up from ${a} % to ${b} %.`,
];
const POINT_PAIRS: [number, number][] = [
  [20, 25],
  [2, 3],
  [4, 5],
  [10, 12],
  [40, 50],
  [5, 6],
  [8, 10],
  [25, 30],
  [30, 36],
  [16, 20],
];

function pointsTask(rng: Rng): Exercise | null {
  const [a, b] = rng.pick(POINT_PAIRS);
  const diff = b - a;
  const rel = (diff / a) * 100;
  const intro = rng.pick(POINT_STORIES)(a, b);
  const frames: Frame[] = [
    { math: `${a}#a %#ap \\to#to ${b}#b %#bp`, note: `From $${a} %$ to $${b} %$.` },
    { math: `${b}#b %#bp -#m ${a}#a %#ap =#e ${diff}#c "percentage points"#pp`, note: `The difference is $${diff}$ **percentage points** (Prozentpunkte).` },
    {
      math: `\\frac{${diff}#c}{${a}#a}#f =#e ${num(diff / a)}#h =#e2 ${num(rel)}#r %#rp`,
      note: `Compared with the old value: $${diff} : ${a} = ${num(diff / a)}$. So it rose by $${num(rel)} %$.`,
      highlight: ["r"],
    },
  ];
  if (rng.chance(0.45)) {
    const options = [
      `It rose by ${diff} percentage points.`,
      `It rose by ${diff} %.`,
      `It rose by ${b} percentage points.`,
      rel === b ? `It fell by ${diff} percentage points.` : `It rose by ${num(rel)} percentage points.`,
    ];
    const order = rng.shuffle([0, 1, 2, 3]);
    return {
      instruction: "Percent or percentage points?",
      text: `${intro} Which statement is correct?`,
      answer: { kind: "choice", options: order.map((i) => options[i]), correct: order.indexOf(0) },
      hint: "Subtracting two percentages gives percentage points. A change in percent compares with the old value.",
      solution: frames,
    };
  }
  return {
    instruction: "Word problem",
    text: `${intro} By how many percent did it rise?`,
    answer: rateAnswer(rel),
    hint: `It rose by $${diff}$ percentage points. But in percent, compare the rise with the old value $${a} %$.`,
    solution: frames,
  };
}

const LEVELS: Record<Level, [number, Gen][]> = {
  1: [
    [3, wTask],
    [3, wStoryTask],
    [2, convertTask],
    [2, gridTask],
  ],
  2: [
    [3, pTask],
    [3, gTask],
    [4, changeTask],
  ],
  3: [
    [3, reverseTask],
    [2, chainTask],
    [2, totalChangeTask],
    [2, compoundTask],
    [1.5, pointsTask],
  ],
};

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 80; tries++) {
    const ex = pickWeighted(rng, LEVELS[level])(rng);
    if (ex) return ex;
  }
  return {
    instruction: "Calculate",
    math: `10 % "of" 300 "€"`,
    answer: amount(30, "€"),
    hint: "$10 %$ is a tenth.",
    solution: findWFrames(10, 300, "€"),
  };
}

// ---------------------------------------------------------------------------
// Pictures

const EMPTY = "color-mix(in oklab, var(--ink) 8%, transparent)";

/** A grid of squares with the first k shaded (row by row). */
function PercentGrid({ rows, cols, k }: { rows: number; cols: number; k: number }) {
  return (
    <div className="grid place-items-center py-4">
      <div className="grid w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols * 42 }} role="img" aria-label={`${k} of ${rows * cols} squares shaded`}>
        {Array.from({ length: rows * cols }, (_, i) => (
          <div key={i} className="relative aspect-square rounded-[4px]" style={{ background: EMPTY }}>
            {i < k && (
              <motion.div
                className="absolute inset-0 rounded-[4px] bg-blob"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.15 + i * 0.006 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive 1: drag the rate, watch the percentage.

const BASES = [
  { G: 200, unit: "€" },
  { G: 80, unit: "kg" },
  { G: 1500, unit: "m" },
  { G: 50, unit: "L" },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
        active ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Scale labels: centred on their tick, but kept inside the bar at both ends. */
const edge = (t: number) => (t === 0 ? "" : t === 100 ? "-translate-x-full" : "-translate-x-1/2");

function PercentExplorer() {
  const scope = useId();
  const [bi, setBi] = useState(0);
  const [p, setP] = useState(15);
  const [dragging, setDragging] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const { G, unit } = BASES[bi];
  const W = (G * p) / 100;

  const fromPointer = (clientX: number) => {
    const el = bar.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setP(Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100))));
  };

  const formula = `W#W =#e ${amt(G, unit)}#G "${unit}"#u \\cdot#m \\frac{${p}#p}{100#h}#f =#e2 ${amt(W, unit)}#r "${unit}"#u2`;
  const spring = { type: "spring" as const, stiffness: 320, damping: 32 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Base value G</span>
          {BASES.map((b, i) => (
            <Pill key={b.unit} active={bi === i} onClick={() => setBi(i)}>
              {b.G} {b.unit}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Try</span>
          {[1, 10, 25, 50, 75].map((v) => (
            <Pill key={v} active={p === v} onClick={() => setP(v)}>
              {v} %
            </Pill>
          ))}
        </div>
      </div>

      <div className="grid items-center gap-6 rounded-xl border border-line bg-surface p-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="mx-auto grid w-full max-w-[200px] grid-cols-10 gap-[3px]" role="img" aria-label={`${p} of 100 squares shaded`}>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i} className="relative aspect-square rounded-[3px]" style={{ background: EMPTY }}>
              <motion.div
                className="absolute inset-0 rounded-[3px] bg-blob"
                initial={false}
                animate={{ scale: i < p ? 1 : 0.3, opacity: i < p ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 34, delay: dragging ? 0 : (i < p ? i : 99 - i) * 0.003 }}
              />
            </div>
          ))}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="relative px-1 pb-9 pt-9">
            <div className="pointer-events-none absolute inset-x-1 top-0 h-6 text-[11.5px] text-ink-3">
              {[0, 25, 50, 75, 100].map((t) => (
                <span key={t} className={cn("absolute whitespace-nowrap tabular-nums", edge(t))} style={{ left: `${t}%` }}>
                  {t} %
                </span>
              ))}
            </div>
            <div
              ref={bar}
              role="slider"
              tabIndex={0}
              aria-label="Percent rate"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={p}
              aria-valuetext={`${p} %`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(true);
                fromPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (dragging) fromPointer(e.clientX);
              }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
                if (!step) return;
                e.preventDefault();
                e.stopPropagation();
                setP((v) => Math.max(0, Math.min(100, v + step)));
              }}
              className="relative h-12 cursor-ew-resize touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blob/50"
              style={{ background: EMPTY }}
            >
              <motion.div className="absolute inset-y-0 left-0 rounded-xl bg-blob" initial={false} animate={{ width: `${p}%` }} transition={dragging ? { duration: 0.06 } : spring} />
              <motion.div className="absolute inset-y-[-6px] w-0" initial={false} animate={{ left: `${p}%` }} transition={dragging ? { duration: 0.06 } : spring}>
                <div className="absolute inset-y-0 left-[-3px] w-[6px] rounded-full bg-ink shadow-card" />
                <div className="absolute bottom-full left-0 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-blob px-1.5 py-0.5 font-math text-[14px] font-semibold text-white tabular-nums">
                  {p} %
                </div>
                <div className="absolute left-0 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 font-math text-[14px] text-paper tabular-nums">
                  {amt(W, unit)} {unit}
                </div>
              </motion.div>
            </div>
            <div className="pointer-events-none absolute inset-x-1 bottom-0 h-5 text-[11.5px] text-ink-3">
              {[0, 50, 100].map((t) => (
                <span key={t} className={cn("absolute whitespace-nowrap tabular-nums", edge(t))} style={{ left: `${t}%` }}>
                  {amt((G * t) / 100, unit)} {unit}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <MathView src={formula} size="md" scope={`${scope}-f`} highlight={["p", "r"]} />
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Each small square is <strong className="font-semibold text-ink">1 %</strong> of {G} {unit}, that is {amt(G / 100, unit)} {unit}. So {p} squares are {amt(W, unit)} {unit}.
          </p>
        </div>
      </div>
      <p className="text-[13px] text-ink-3">Drag the bar or use the arrow keys.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive 2: a chain of changes, each one a growth factor.

type Step = Change & { id: number };

const PRESETS: { label: string; changes: Change[] }[] = [
  {
    label: "+20 %, then −20 %",
    changes: [
      { up: true, p: 20 },
      { up: false, p: 20 },
    ],
  },
  { label: "VAT +19 %", changes: [{ up: true, p: 19 }] },
  { label: "Sale −25 %", changes: [{ up: false, p: 25 }] },
  {
    label: "3 years at +5 %",
    changes: [
      { up: true, p: 5 },
      { up: true, p: 5 },
      { up: true, p: 5 },
    ],
  },
];

function GrowthChain() {
  const scope = useId();
  const [start, setStart] = useState(100);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, up: true, p: 20 },
    { id: 2, up: false, p: 20 },
  ]);
  const [nextId, setNextId] = useState(3);

  const values = steps.reduce<number[]>((list, s) => [...list, list[list.length - 1] * factorOf(s)], [start]);
  const Q = values[values.length - 1] / start;
  const maxV = Math.max(...values);
  const H = 130;
  const scale = H / maxV;
  const final = values[values.length - 1];
  const signedSum = steps.reduce((s, c) => s + (c.up ? c.p : -c.p), 0);
  const pct = r2(Math.abs(Q - 1) * 100);

  const update = (id: number, patch: Partial<Change>) => setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const load = (changes: Change[]) => {
    setSteps(changes.map((c, i) => ({ ...c, id: nextId + i })));
    setNextId((n) => n + changes.length);
  };

  const formula = `${start}#s "€"#u${steps.map((s) => ` \\cdot#t${s.id} ${num(factorOf(s))}#q${s.id}`).join("")} =#e ${cash(final)}#r "€"#u2`;
  const verdict =
    Math.abs(Q - 1) < 1e-9
      ? "Overall factor 1: back where you started."
      : `Overall factor ${num(r6(Q))}: the price ${Q > 1 ? "rose" : "fell"} by ${num(pct)} % in total.`;
  const trap = steps.length > 1 && signedSum === 0 && Math.abs(Q - 1) > 1e-9 ? " The percentages add up to 0, but the price doesn't come back: each change works on a different base value." : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Start</span>
          {[100, 80, 250].map((v) => (
            <Pill key={v} active={start === v} onClick={() => setStart(v)}>
              {v} €
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Try</span>
          {PRESETS.map((pr) => (
            <Pill key={pr.label} active={false} onClick={() => load(pr.changes)}>
              {pr.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="relative flex items-end gap-2 sm:gap-4" style={{ height: H + 64 }}>
          <motion.div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3/60"
            initial={false}
            animate={{ bottom: start * scale + 22 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
          <AnimatePresence initial={false}>
            {values.map((v, i) => {
              const s = i > 0 ? steps[i - 1] : null;
              return (
                <motion.div
                  key={s ? s.id : "start"}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="whitespace-nowrap font-math text-[15px] tabular-nums sm:text-[17px]">{cash(v)} €</span>
                  <motion.div
                    className="w-full max-w-[72px] rounded-t-lg"
                    style={{ background: i === 0 ? "color-mix(in oklab, var(--ink-3) 45%, transparent)" : s?.up ? "var(--blob)" : "var(--blob-light)" }}
                    initial={false}
                    animate={{ height: Math.max(4, v * scale) }}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                  />
                  <span className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-3">{num(r2((v / start) * 100))} %</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="mt-4 overflow-x-auto">
          <MathView src={formula} size="md" scope={`${scope}-f`} highlight={["r"]} />
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-0.5">
                <span className="w-[70px] text-[12.5px] text-ink-2">Change {i + 1}</span>
                <div className="flex rounded-lg border border-line p-0.5">
                  {[true, false].map((up) => (
                    <button
                      key={String(up)}
                      type="button"
                      onClick={() => update(s.id, { up, p: up ? s.p : Math.min(s.p, 95) })}
                      className={cn("relative grid h-7 w-9 place-items-center rounded-md text-[16px] font-semibold", s.up === up ? "text-white" : "text-ink-2 hover:text-ink")}
                      aria-label={up ? "Increase" : "Decrease"}
                    >
                      {s.up === up && <motion.span layoutId={`${scope}-sign-${s.id}`} className="absolute inset-0 rounded-md bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
                      <span className="relative">{up ? "+" : "−"}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => update(s.id, { p: Math.max(5, Math.ceil(s.p / 5) * 5 - 5) })}
                    disabled={s.p <= 5}
                    className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
                    aria-label="Less"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-12 text-center font-math text-[17px] tabular-nums">{s.p} %</span>
                  <button
                    type="button"
                    onClick={() => update(s.id, { p: Math.min(s.up ? 100 : 95, Math.floor(s.p / 5) * 5 + 5) })}
                    disabled={s.p >= (s.up ? 100 : 95)}
                    className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
                    aria-label="More"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="font-math text-[16px] text-ink-2">
                  → · {num(factorOf(s))}
                </span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps((list) => list.filter((x) => x.id !== s.id))}
                    className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
                    aria-label="Remove change"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {steps.length < 3 && (
          <button
            type="button"
            onClick={() => {
              setSteps((list) => [...list, { id: nextId, up: true, p: 10 }]);
              setNextId((n) => n + 1);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Plus className="size-3.5" /> Add a change
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={verdict + trap} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">{verdict}</strong>
          {trap}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson boards

const perHundredFrames: Frame[] = [
  { math: "25#p %#pc", note: "Percent comes from Latin **per centum**: per hundred." },
  { math: "25#p %#pc =#e1 \\frac{25#n}{100#h}#f", note: "So $25 %$ means $25$ out of $100$.", highlight: ["h"] },
  { math: "25#p %#pc =#e1 \\frac{25#n}{100#h}#f =#e2 0.25#dec", note: "As a decimal: $25 : 100 = 0.25$. The point moves two places to the left.", highlight: ["dec"] },
  { math: "25#p %#pc =#e1 \\frac{25#n}{100#h}#f =#e2 0.25#dec =#e3 \\frac{1#n2}{4#d2}#f2", note: "Simplified, it's $\\frac{1}{4}$: a quarter. Three ways to write the same share." },
];

const formulaFrames: Frame[] = [
  { math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f", note: "The basic formula of percentages: three quantities, one rule." },
  { math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f", note: "$G$ is the **base value** (Grundwert): the whole, $100 %$.", highlight: ["G"] },
  { math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f", note: "$p %$ is the **percent rate** (Prozentsatz): how many hundredths you take.", highlight: ["p", "h"] },
  { math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f", note: "$W$ is the **percentage** (Prozentwert): the part you get.", highlight: ["W"] },
  { math: 'W#W =#e 200#G "€"#u \\cdot#m \\frac{15#p}{100#h}#f', note: "Example: $15 %$ of $200$ €. Put in $G = 200$ and $p = 15$.", highlight: ["G", "p"] },
  { math: 'W#W =#e 200#G "€"#u \\cdot#m 0.15#q', note: "Write $15 %$ as a decimal: $0.15$.", highlight: ["q"] },
  { math: 'W#W =#e 30#G "€"#u', note: "$200 \\cdot 0.15 = 30$. So $15 %$ of $200$ € is $30$ €." },
];

const rearrangeFrames: Frame[] = [
  { math: "W#W =#e G#G \\cdot#m p#p %#pc", note: "Short form: $W = G \\cdot p %$, with $p %$ written as a decimal." },
  { math: "\\frac{W#W}{G#G}#f =#e p#p %#pc", note: "To find the **rate**, divide both sides by $G$.", highlight: ["G"] },
  { math: "p#p %#pc =#e \\frac{W#W}{G#G}#f", note: "Rate = part divided by whole." },
  { math: "p#p %#pc =#e \\frac{12#W}{30#G}#f", note: "Example: $12$ of $30$ students are in a club." },
  { math: "p#p %#pc =#e 0.4#v", note: "$12 : 30 = 0.4$." },
  { math: "p#p %#pc =#e 40#v %#pc2", note: "$0.4 = 40 %$. Move the point two places to the right." },
  { math: "G#G =#e \\frac{W#W}{p#p %#pc}#f", note: "To find the **base value**, divide $W$ by the rate instead.", highlight: ["G"] },
  { math: 'G#G =#e \\frac{30#W "€"#u}{0.2#p}#f', note: "Example: $30$ € are $20 %$ of a price. $20 % = 0.2$." },
  { math: 'G#G =#e 150#W "€"#u', note: "$30 : 0.2 = 150$. The full price is $150$ €." },
];

const factorFrames: Frame[] = [
  { math: "100#a %#ap +#pl 19#b %#bp =#e 119#c %#cp", note: "VAT (Mehrwertsteuer) adds $19 %$. The new price is $119 %$ of the old one." },
  { math: "q#q =#e 119#c %#cp =#e2 1.19#f", note: "As a decimal, that's the **growth factor** $q = 1.19$ (Wachstumsfaktor).", highlight: ["f"] },
  { math: '120#G "€"#u \\cdot#t 1.19#f =#e3 142.80#r "€"#u2', note: "One multiplication does it all: $120 \\cdot 1.19 = 142.80$ €.", highlight: ["r"] },
  { math: "100#a %#ap -#mi 20#b %#bp =#e 80#c %#cp", note: "A discount works the same way. $20 %$ off leaves $80 %$." },
  { math: "q#q =#e 80#c %#cp =#e2 0.8#f", note: "Growth factor $q = 0.8$. Smaller than $1$: the value shrinks.", highlight: ["f"] },
  { math: '120#G "€"#u \\cdot#t 0.8#f =#e3 96#r "€"#u2', note: "$120 \\cdot 0.8 = 96$ €.", highlight: ["r"] },
];

const reverseLesson: Frame[] = [
  ...reverseFrames(64, 20, false, "€"),
  {
    math: '\\red{64#m1 "€"#m2 \\cdot#m3 1.2#m4 =#m5 76.80#m6 "€"#m7} \\ne#ne 80#W "€"#u',
    note: "Classic mistake: adding $20 %$ to $64$ € gives $76.80$ €, not $80$ €. The $20 %$ belonged to the **old** price, not the new one.",
  },
];
reverseLesson[0] = { ...reverseLesson[0], note: "After $20 %$ off, a jacket costs $64$ €. So the old price $G$ times $0.8$ gives $64$ €." };

const pointsFrames: Frame[] = [
  { math: "2#a %#ap \\to#to 3#b %#bp", note: "A bank raises its interest rate from $2 %$ to $3 %$. How big is the rise?" },
  { math: '3#b %#bp -#m 2#a %#ap =#e 1#c "percentage point"#pp', note: "The difference of two percentages is measured in **percentage points** (Prozentpunkte): $1$ point." },
  { math: "\\frac{1#c}{2#a}#f =#e 0.5#h =#e2 50#r %#rp", note: "But compared with the old rate, $1$ is half of $2$. In percent, the rate rose by $50 %$!", highlight: ["r"] },
];

// ---------------------------------------------------------------------------

const percentages: Topic = {
  ...topicMeta("percentages"),
  summary: [
    {
      title: "Percent means per hundred",
      body: "Fractions, decimals and percentages are three ways to write the same share.",
      examples: ["25 % = \\frac{25}{100} = 0.25", "50 % = \\frac{1}{2} ,\\quad 10 % = \\frac{1}{10} ,\\quad 1 % = \\frac{1}{100}"],
      tone: "rule",
    },
    {
      title: "Base value, percentage, rate",
      body: "$G$ is the whole (Grundwert), $W$ the part (Prozentwert), $p %$ the rate (Prozentsatz).",
      examples: ["W = G \\cdot \\frac{p}{100}", "p % = \\frac{W}{G}", "G = \\frac{W}{p %}"],
      tone: "rule",
    },
    {
      title: "Growth factor",
      body: "A rise of $p %$: multiply by $1 + \\frac{p}{100}$. A drop of $p %$: multiply by $1 - \\frac{p}{100}$.",
      examples: ['120 "€" \\cdot 1.19 = 142.80 "€"', '120 "€" \\cdot 0.8 = 96 "€"'],
      tone: "rule",
    },
    {
      title: "Back to the original",
      body: "To undo a change, divide by the growth factor. Several changes: multiply all their factors.",
      examples: ["G \\cdot 0.8 = 64 \\Rightarrow G = 64 : 0.8 = 80", "1.2 \\cdot 0.8 = 0.96"],
      tone: "tip",
    },
    {
      title: "Percent or percentage points?",
      body: "$+20 %$ then $-20 %$ is **not** back to the start. And from $2 %$ to $3 %$ is $1$ percentage point, but $50 %$ more.",
      examples: ['3 % - 2 % = 1 "percentage point"', "\\frac{1}{2} = 50 %"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: "Percent means per hundred",
      blob: "Percent is everywhere: sales, phone batteries, test results. Let's crack it!",
      body: "Percentages make shares easy to compare, because everything is measured out of $100$.\n\nWorth knowing by heart: $50 % = \\frac{1}{2}$, $25 % = \\frac{1}{4}$, $20 % = \\frac{1}{5}$, $10 % = \\frac{1}{10}$, $1 % = \\frac{1}{100}$.",
      frames: perHundredFrames,
    },
    {
      type: "explain",
      title: "Base value, percentage and rate",
      blob: "Three quantities, one formula. Know which is which and you've won!",
      body: "Every percentage problem is about a whole, a part, and the rate that connects them.",
      frames: formulaFrames,
    },
    {
      type: "widget",
      title: "Drag the rate",
      blob: "Drag the bar and watch the squares fill up. Each one is one percent!",
      body: "The hundred square is the base value $G$, cut into $100$ equal pieces. Choose $G$, drag the rate and watch the percentage $W$.",
      widget: PercentExplorer,
    },
    {
      type: "check",
      blob: "Your turn! Rate as a decimal, then multiply.",
      exercise: {
        instruction: "Calculate",
        math: '18 % "of" 250 "€"',
        answer: amount(45, "€"),
        hint: "$18 % = 0.18$. Then $250 \\cdot 0.18$.",
        solution: findWFrames(18, 250, "€"),
      },
    },
    {
      type: "explain",
      title: "Finding the rate or the base value",
      blob: "Same formula, just turned around. Watch the letters move!",
      body: "Prefer the rule of three (Dreisatz)? For the base value: $20 % \\to 30$ €, so $1 % \\to 1.50$ € and $100 % \\to 150$ €. Same answer.",
      frames: rearrangeFrames,
    },
    {
      type: "check",
      blob: "Part divided by whole. You've got this!",
      exercise: {
        instruction: "Word problem",
        text: "In class 9a, 7 of the 28 students wear glasses. What percentage is that?",
        answer: rateAnswer(25),
        hint: "$p % = \\frac{W}{G} = \\frac{7}{28}$. Then turn the decimal into a percentage.",
        solution: findPFrames(7, 28),
      },
    },
    {
      type: "explain",
      title: "Increase and decrease: the growth factor",
      blob: "This trick saves so much time: one multiplication instead of two steps!",
      body: "You could work out $19 %$ and add it on. Faster: multiply by the **growth factor** right away.",
      frames: factorFrames,
    },
    {
      type: "widget",
      title: "One change after another",
      blob: "Up 20 %, then down 20 %. Back to the start? Let's see!",
      body: "Every change is one growth factor. Several changes in a row: multiply the factors. Change the steps, or try the examples.",
      widget: GrowthChain,
    },
    {
      type: "check",
      blob: "15 % off. What's left, as a factor?",
      exercise: {
        instruction: "Word problem",
        text: "A bike costs 480 €. In the sale, the price is reduced by 15 %. What is the sale price?",
        answer: amount(408, "€"),
        hint: "$15 %$ off leaves $85 %$. Multiply by $0.85$.",
        solution: changeFrames(480, 15, false, "€"),
      },
    },
    {
      type: "explain",
      title: "Back to the original price",
      blob: "Going backwards is where most people slip. Not you, though!",
      body: "If you know the price **after** a change, divide by the growth factor to get the price before.",
      frames: reverseLesson,
    },
    {
      type: "check",
      blob: "Price after a rise. Divide, don't subtract!",
      exercise: {
        instruction: "Word problem",
        text: "After a price rise of 25 %, a video game costs 60 €. What did it cost before?",
        answer: amount(48, "€"),
        hint: "The new price is $125 %$ of the old one: $G \\cdot 1.25 = 60$.",
        solution: reverseFrames(60, 25, true, "€"),
      },
    },
    {
      type: "explain",
      title: "Percent or percentage points?",
      blob: "Last one: a trap even the news falls into!",
      body: "When a percentage itself changes, there are two ways to describe it. Both are correct, but they mean different things.",
      frames: pointsFrames,
    },
  ],
  generate,
};

export default percentages;
