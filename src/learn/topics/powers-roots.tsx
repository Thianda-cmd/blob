"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Combine, Minus, Plus, Shuffle, Split } from "lucide-react";
import { useId, useState } from "react";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Small helpers for writing powers with stable animation keys. Decimals use a
// comma, as in German schools.

/** "3,6", "-0,5", "12". */
function dec(v: number): string {
  return String(Math.round(v * 1e9) / 1e9).replace(".", ",");
}

/** A number on its own, keyed: "5#k" or "-#ks 2#k". */
function num(n: number, k: string): string {
  return n < 0 ? `-#${k}s ${dec(-n)}#${k}` : `${dec(n)}#${k}`;
}

/** A number inside a sum or product, keyed; negative ones get brackets. */
function inner(n: number, k: string): string {
  return n < 0 ? `(-#${k}s ${dec(-n)}#${k})#${k}b` : `${dec(n)}#${k}`;
}

/** Plain number for notes, in brackets when negative: "(-2)". */
const par = (n: number) => (n < 0 ? `(${dec(n)})` : dec(n));

/** Plain power: "x", "x^{5}", "x^{-2}". */
const pp = (base: string | number, e: number) => (e === 1 ? `${base}` : `${base}^{${e}}`);

/** Keyed power with base key `b` and exponent key `ek`. A lone base hides its 1 unless `showOne`. */
function kp(base: string | number, b: string, e: number, ek: string, showOne = false): string {
  return e === 1 && !showOne ? `${base}#${b}` : `${base}#${b}^{${num(e, ek)}}`;
}

/** Keyed exponent sum like "4 + 5 + (-2)" (op keys `${opKey}1`, `${opKey}2`…). */
function keyedSum(list: { v: number; k: string }[], op: string, opKey: string): string {
  return list.map((t, i) => (i === 0 ? num(t.v, t.k) : `${op}#${opKey}${i} ${inner(t.v, t.k)}`)).join(" ");
}

const plainSum = (vals: number[]) => vals.map((v, i) => (i === 0 ? dec(v) : `+ ${par(v)}`)).join(" ");

/** Coefficient in front of a variable: "" for 1, "-" for -1, else the number. */
const coef = (c: number) => (c === 1 ? "" : c === -1 ? "-" : dec(c));

/** Digits grouped in threes with thin spaces: "36\,000\,000". The first group gets key `k`. */
function grouped(digits: string, k?: string): string {
  if (digits.length < 5) return k ? `${digits}#${k}` : digits;
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return groups.map((g, i) => (i === 0 && k ? `${g}#${k}` : g)).join(" \\,");
}

function largestSquareRoot(n: number): number {
  for (let k = Math.floor(Math.sqrt(n)); k >= 1; k--) if (n % (k * k) === 0) return k;
  return 1;
}

const gcdInt = (a: number, b: number): number => (b ? gcdInt(b, a % b) : Math.abs(a));

// ---------------------------------------------------------------------------
// Worked solutions (also used by the lesson checks)

/** (−2)^5 = −32 etc.: written out, then multiplied step by step. */
function evalPowerFrames(b: number, n: number): Frame[] {
  const value = b ** n;
  const bp = par(b);
  const factor = (i: number) => (b < 0 ? `(-#f${i}s ${-b}#f${i})#f${i}b` : `${b}#f${i}`);
  const frames: Frame[] = [{ math: `${factor(0)}^{${n}#e}`, note: `$${pp(bp, n)}$ means: $${n}$ factors of $${bp}$, multiplied together.` }];
  const signNote = b < 0 ? (n % 2 === 0 ? " An even number of minus signs gives plus." : " An odd number of minus signs: the result is negative.") : "";
  if (b === -1) {
    frames.push({ math: num(value, "f0"), note: `$(-1) \\cdot (-1) = 1$, so every pair of factors gives $1$.${signNote} So $(-1)^{${n}} = ${value}$.` });
    return frames;
  }
  const rest = (from: number) =>
    Array.from({ length: n - from }, (_, j) => `\\cdot#d${from + j} ${factor(from + j)}`).join(" ");
  frames.push({ math: `${factor(0)} ${rest(1)}`, note: `Written out: $${n}$ factors.` });
  if (n <= 5) {
    let acc = b;
    for (let i = 1; i < n; i++) {
      const prev = acc;
      acc *= b;
      frames.push({ math: `${num(acc, "f0")} ${rest(i + 1)}`.trim(), note: `$${par(prev)} \\cdot ${bp} = ${acc}$.` });
    }
  } else {
    const chain: number[] = [];
    for (let i = 1, acc = b; i <= n; i++, acc *= b) chain.push(acc);
    frames.push({ math: num(value, "f0"), note: `Multiply step by step: $${chain.join(", ")}$.` });
  }
  const last = frames[frames.length - 1];
  last.note = `${last.note}${signNote} So $${pp(bp, n)} = ${value}$.`;
  return frames;
}

/** −3² = −9: the exponent only belongs to the 3. */
function minusTrapFrames(b: number, n: number): Frame[] {
  const factors = Array.from({ length: n }, (_, i) => (i === 0 ? `${b}#f0` : `\\cdot#d${i} ${b}#f${i}`)).join(" ");
  return [
    { math: `-#m ${b}#f0^{${n}#e}`, note: `The exponent belongs only to the $${b}$. The minus is not part of the base.`, highlight: ["f0", "e"] },
    { math: `-#m (${factors})#br`, note: `So it means $-(${Array.from({ length: n }, () => b).join(" \\cdot ")})$.` },
    { math: `-#m ${b ** n}#f0`, note: `$-${b}^{${n}} = ${-(b ** n)}$. With brackets, $(-${b})^{${n}}$ would be $+${b ** n}$.` },
  ];
}

/** x^4 · x^5 · x: add the exponents. */
function productFrames(v: string, exps: number[]): Frame[] {
  const total = exps.reduce((s, e) => s + e, 0);
  const lhs = (showOne: boolean) => exps.map((e, i) => (i === 0 ? "" : `\\cdot#d${i} `) + kp(v, `b${i}`, e, `e${i}`, showOne)).join(" ");
  const frames: Frame[] = [{ math: lhs(false), note: `All factors have the same base $${v}$.` }];
  const lone = exps.indexOf(1);
  if (lone >= 0) frames.push({ math: lhs(true), note: `A lone $${v}$ counts as $${v}^1$.`, highlight: [`e${lone}`] });
  frames.push({
    math: `${v}#b0^{${keyedSum(exps.map((e, i) => ({ v: e, k: `e${i}` })), "+", "p")}}`,
    note: "Same base, multiplied: keep the base and **add** the exponents.",
  });
  frames.push({
    math: kp(v, "b0", total, "e0", true),
    note: `$${plainSum(exps)} = ${total}$. So $n = ${total}$.${total < 0 ? ` (That's $\\frac{1}{${pp(v, -total)}}$.)` : ""}`,
  });
  return frames;
}

/** x^9 : x^4 or as a fraction: subtract the exponents. */
function quotientFrames(v: string, e1: number, e2: number, frac: boolean, unknown = true): Frame[] {
  const n = e1 - e2;
  const a = kp(v, "b0", e1, "e0");
  const b = kp(v, "b1", e2, "e1");
  const after = n < 0 ? ` That means $${pp(v, n)} = \\frac{1}{${pp(v, -n)}}$.` : n === 0 ? ` And $${v}^0 = 1$.` : "";
  return [
    { math: frac ? `\\frac{${a}}{${b}}#F` : `${a} :#dv ${b}`, note: `Two powers with the same base $${v}$, divided.` },
    {
      math: `${v}#b0^{${num(e1, "e0")} -#mi ${inner(e2, "e1")}}`,
      note: `Keep the base and **subtract** the exponents.${e2 < 0 ? " Minus a negative number is plus." : ""}`,
    },
    { math: kp(v, "b0", n, "e0", true), note: `$${e1} - ${par(e2)} = ${n}$.${unknown ? ` So $n = ${n}$.` : ""}${after}` },
  ];
}

/** (x^3)^4 (· x^2): multiply, then maybe add. */
function powerOfPowerFrames(v: string, e1: number, k: number, extra: number | null): Frame[] {
  const tail = (showOne = false) => (extra === null ? "" : ` \\cdot#d ${kp(v, "b1", extra, "e1", showOne)}`);
  const inside = e1 * k;
  const frames: Frame[] = [
    { math: `(${kp(v, "b0", e1, "e0")})#br^{${k}#k}${tail()}`, note: `A power of a power: $${pp(v, e1)}$ is taken $${k}$ times.` },
    { math: `${v}#b0^{${inner(e1, "e0")} \\cdot#t ${k}#k}${tail()}`, note: "Keep the base and **multiply** the exponents." },
    { math: `${kp(v, "b0", inside, "e0", true)}${tail(true)}`, note: `$${par(e1)} \\cdot ${k} = ${inside}$.${extra === null ? ` So $n = ${inside}$.` : ""}` },
  ];
  if (extra !== null) {
    const total = inside + extra;
    frames.push({
      math: `${v}#b0^{${num(inside, "e0")} +#p ${inner(extra, "e1")}}`,
      note: `Now two powers with the same base are multiplied: add the exponents.${extra === 1 ? ` (A lone $${v}$ is $${v}^1$.)` : ""}`,
    });
    frames.push({ math: kp(v, "b0", total, "e0", true), note: `$${inside} + ${par(extra)} = ${total}$. So $n = ${total}$.` });
  }
  return frames;
}

/** 2^{-3} = 1/8 */
function negativeToFractionFrames(b: number, e: number): Frame[] {
  const frames: Frame[] = [
    { math: `${b}#b^{-#s ${e}#e}`, note: "A negative exponent means: **one divided by** the power." },
    { math: `\\frac{1#one}{${kp(b, "b", e, "e")}}#F`, note: `$${b}^{-${e}} = \\frac{1}{${pp(b, e)}}$. In the fraction, the exponent is positive.` },
  ];
  if (e > 1) frames.push({ math: `\\frac{1#one}{${b ** e}#b}#F`, note: `$${pp(b, e)} = ${b ** e}$. So $${b}^{-${e}} = \\frac{1}{${b ** e}}$.` });
  return frames;
}

/** (2x^3)^4 · 3x^{-2}: bracket first, then numbers and exponents. */
function bracketPowerFrames(v: string, k: number, e1: number, j: number, extra: { d: number; e2: number } | null): Frame[] {
  const K = k ** j;
  const kTok = k === -1 ? "-#c1s " : `${num(k, "c1")} `;
  const extraSrc = (showOne: boolean) => {
    if (!extra) return "";
    const pw = kp(v, "b2", extra.e2, "e2", showOne);
    if (extra.d === 1) return ` \\cdot#dot ${pw}`;
    if (extra.d < 0) return ` \\cdot#dot (-#c2s ${-extra.d}#c2 ${pw})#g`;
    return ` \\cdot#dot ${extra.d}#c2 ${pw}`;
  };
  const kHead = (c: number) => (c === 1 ? "" : c === -1 ? "-#c1s " : `${num(c, "c1")} `);
  const frames: Frame[] = [
    { math: `(${kTok}${kp(v, "b1", e1, "e1")})#br^{${j}#j}${extraSrc(false)}`, note: `The bracket comes first. Its exponent $${j}$ belongs to **every factor** inside.` },
    {
      math: `${inner(k, "c1")}^{${j}#j} \\cdot#d1 ${v}#b1^{${inner(e1, "e1")} \\cdot#jt ${j}#j2}${extraSrc(false)}`,
      note: `So you get $${par(k)}^{${j}}$ and $${e1 === 1 ? v : `(${pp(v, e1)})`}^{${j}}$. For a power of a power, multiply the exponents.`,
    },
    {
      math: `${kHead(K)}${kp(v, "b1", e1 * j, "e1", true)}${extraSrc(true)}`,
      note: `$${par(k)}^{${j}} = ${K}$ and $${par(e1)} \\cdot ${j} = ${e1 * j}$.${extra ? "" : ` So $c = ${K}$ and $n = ${e1 * j}$.`}`,
    },
  ];
  if (extra) {
    const c = K * extra.d;
    const n = e1 * j + extra.e2;
    frames.push({
      math: `${kHead(c)}${v}#b1^{${num(e1 * j, "e1")} +#p ${inner(extra.e2, "e2")}}`,
      note: `Multiply the numbers: $${K} \\cdot ${par(extra.d)} = ${c}$. Same base: add the exponents.`,
    });
    frames.push({ math: `${kHead(c)}${kp(v, "b1", n, "e1", true)}`, note: `$${e1 * j} + ${par(extra.e2)} = ${n}$. So $c = ${c}$ and $n = ${n}$.` });
  }
  return frames;
}

/** 36 000 000 = 3,6 · 10^7 and 0,00036 = 3,6 · 10^{-4}. */
function sciFrames(digits: string, e: number): Frame[] {
  const mant = Number(digits) / 10 ** (digits.length - 1);
  if (e > 0) {
    const raw = digits + "0".repeat(e - digits.length + 1);
    const power = "1" + "0".repeat(e);
    return [
      { math: grouped(raw, "m"), note: `Move the comma to the left until exactly one digit is in front of it: $${dec(mant)}$. That's $${e}$ places.` },
      { math: `${dec(mant)}#m \\cdot#d ${grouped(power, "t")}`, note: `To keep the value, multiply by $${grouped(power)}$ again.` },
      { math: `${dec(mant)}#m \\cdot#d 10#t^{${e}#e}`, note: `$${grouped(power)} = 10^{${e}}$ (a $1$ with $${e}$ zeros). So $a = ${dec(mant)}$ and $n = ${e}$.` },
    ];
  }
  const raw = `0,${"0".repeat(-e - 1)}${digits}`;
  const small = `0,${"0".repeat(-e - 1)}1`;
  return [
    { math: `${raw}#m`, note: `Move the comma to the **right** until one digit (not $0$) is in front of it: $${dec(mant)}$. That's $${-e}$ places.` },
    { math: `${dec(mant)}#m \\cdot#d ${small}#t`, note: `Now the number is too big. To keep the value, multiply by $${small}$.` },
    { math: `${dec(mant)}#m \\cdot#d 10#t^{-#es ${-e}#e}`, note: `$${small} = 10^{${e}}$. So $a = ${dec(mant)}$ and $n = ${e}$.` },
  ];
}

/** √72 = √(36·2) = √36·√2 = 6√2 */
function partialRootFrames(N: number, prefix = 1): Frame[] {
  const s = largestSquareRoot(N);
  const r = N / (s * s);
  const pre = prefix === 1 ? "" : `${prefix}#t `;
  const frames: Frame[] = [
    { math: `${pre}\\sqrt{${N}#s}#R`, note: `Find the **biggest square number** that divides $${N}$: it's $${s * s}$.` },
    { math: `${pre}\\sqrt{${s * s}#s \\cdot#d ${r}#r}#R`, note: `$${N} = ${s * s} \\cdot ${r}$.`, highlight: ["s"] },
  ];
  if (prefix === 1) {
    frames.push({ math: `\\sqrt{${s * s}#s}#R0 \\cdot#d \\sqrt{${r}#r}#R`, note: "Split the root: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$." });
    frames.push({ math: `${s}#s \\sqrt{${r}#r}#R`, note: `$\\sqrt{${s * s}} = ${s}$ comes out of the root. So $a = ${s}$ and $b = ${r}$.` });
  } else {
    frames.push({ math: `${prefix}#t \\cdot#d0 ${s}#s \\sqrt{${r}#r}#R`, note: `$\\sqrt{${s * s}} = ${s}$ comes out of the root.` });
    frames.push({ math: `${prefix * s}#t \\sqrt{${r}#r}#R`, note: `$${prefix} \\cdot ${s} = ${prefix * s}$. So $a = ${prefix * s}$ and $b = ${r}$.` });
  }
  return frames;
}

/** (3·10^4)·(2·10^5) or (8·10^9):(2·10^3), normalised to a·10^n. */
function sciCalcFrames(a1: number, e1: number, a2: number, e2: number, div: boolean): Frame[] {
  const P = div ? a1 / a2 : a1 * a2;
  const E = div ? e1 - e2 : e1 + e2;
  const t = (a: number, ak: string, e: number, i: number) => `(${a}#${ak} \\cdot#d${i} 10#t${i}^{${num(e, `e${i}`)}})#g${i}`;
  const frames: Frame[] = [
    { math: `${t(a1, "a1", e1, 1)} ${div ? ":" : "\\cdot"}#dot ${t(a2, "a2", e2, 2)}`, note: div ? "Divide the numbers and the powers of ten separately." : "Multiply the numbers and the powers of ten separately." },
    div
      ? { math: `\\frac{${a1}#a1}{${a2}#a2}#F \\cdot#dot \\frac{10#t1^{${num(e1, "e1")}}}{10#t2^{${num(e2, "e2")}}}#G`, note: "Numbers together, powers of ten together." }
      : { math: `${a1}#a1 \\cdot#d1 ${a2}#a2 \\cdot#dot 10#t1^{${num(e1, "e1")}} \\cdot#d2 10#t2^{${num(e2, "e2")}}`, note: "Numbers together, powers of ten together." },
    {
      math: `${dec(P)}#a1 \\cdot#dot 10#t1^{${num(e1, "e1")} ${div ? "-" : "+"}#op ${inner(e2, "e2")}}`,
      note: div ? `$${a1} : ${a2} = ${dec(P)}$. Divide powers: subtract the exponents.` : `$${a1} \\cdot ${a2} = ${dec(P)}$. Multiply powers: add the exponents.`,
    },
    { math: `${dec(P)}#a1 \\cdot#dot 10#t1^{${num(E, "e1")}}`, note: `$${e1} ${div ? "-" : "+"} ${par(e2)} = ${E}$.` },
  ];
  if (P >= 10 || P < 1) {
    const up = P >= 10;
    const mant = up ? P / 10 : P * 10;
    const n = up ? E + 1 : E - 1;
    frames.push({
      math: `${dec(mant)}#a1 \\cdot#dn 10#tn^{${up ? "1#en" : "-#ens 1#en"}} \\cdot#dot 10#t1^{${num(E, "e1")}}`,
      note: up ? `But $${dec(P)}$ is not below $10$: $${dec(P)} = ${dec(mant)} \\cdot 10^1$.` : `But $${dec(P)}$ is below $1$: $${dec(P)} = ${dec(mant)} \\cdot 10^{-1}$.`,
    });
    frames.push({ math: `${dec(mant)}#a1 \\cdot#dot 10#t1^{${num(n, "e1")}}`, note: `$${E} ${up ? "+ 1" : "- 1"} = ${n}$. So $a = ${dec(mant)}$ and $n = ${n}$.` });
  } else {
    frames[frames.length - 1].note += ` So $a = ${dec(P)}$ and $n = ${E}$.`;
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Exercise generator. Each shape returns null for a degenerate draw (retried).

const VARS = ["x", "a", "y", "b", "z"] as const;
const LETTER_PAIRS: [string, string][] = [
  ["a", "b"],
  ["x", "y"],
  ["r", "s"],
];
const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

type Shape = (rng: Rng, level: Level) => Exercise | null;

const findN = (math: string, n: number, hint: string, solution: Frame[], instruction = "Find the exponent n"): Exercise => ({
  instruction,
  math,
  answer: { kind: "number", value: n, label: "n =" },
  hint,
  solution,
});

const evalPower: Shape = (rng, level) => {
  if (level >= 2 && rng.chance(0.4)) {
    const b = rng.int(2, 5);
    const n = b === 2 ? rng.pick([2, 4]) : 2;
    return {
      instruction: "Calculate",
      math: `-${b}^{${n}}`,
      answer: { kind: "number", value: -(b ** n) },
      hint: `Which number does the exponent belong to? Is the minus part of the base?`,
      solution: minusTrapFrames(b, n),
    };
  }
  let b: number;
  let n: number;
  if (rng.chance(level === 1 ? 0.3 : 0.65)) {
    b = rng.pick([-2, -2, -3, -1, -4, -5]);
    n = b === -2 ? rng.int(2, 6) : b === -3 ? rng.int(2, 4) : b === -1 ? rng.int(5, 12) : rng.int(2, 3);
  } else {
    b = rng.pick([2, 2, 3, 3, 4, 5, 6, 7, 8]);
    n = b === 2 ? rng.int(3, 8) : b === 3 ? rng.int(3, 5) : b <= 5 ? rng.int(3, 4) : 3;
  }
  if (Math.abs(b ** n) > 650) return null;
  return {
    instruction: "Calculate",
    math: pp(par(b), n),
    answer: { kind: "number", value: b ** n },
    hint: b < 0 ? "Write out the factors. Count the minus signs: even gives plus, odd gives minus." : `$${pp(b, n)}$ means $${n}$ factors $${b}$, not $${b} \\cdot ${n}$.`,
    solution: evalPowerFrames(b, n),
  };
};

const productExponent: Shape = (rng, level) => {
  const v = rng.chance(0.25) ? rng.pick(["2", "3", "5", "10"]) : rng.pick(VARS);
  const count = rng.chance(0.35) ? 3 : 2;
  const exps: number[] = [];
  for (let i = 0; i < count; i++) {
    const lone = i === count - 1 && count === 3 && rng.chance(0.5);
    exps.push(lone ? 1 : level === 1 ? rng.int(2, 9) : rng.chance(0.35) ? -rng.int(1, 6) : rng.int(2, 9));
  }
  if (level >= 2 && !exps.some((e) => e < 0)) exps[rng.int(0, count - 1)] = -rng.int(1, 6);
  const total = exps.reduce((s, e) => s + e, 0);
  if (total === 0 || total === 1 || Math.abs(total) > 20) return null;
  const lhs = exps.map((e) => pp(v, e)).join(" \\cdot ");
  const hint = exps.includes(1) ? `A lone $${v}$ counts as $${v}^1$.` : exps.some((e) => e < 0) ? "Add the exponents and watch the signs: $5 + (-2) = 3$." : "Same base: add the exponents.";
  return findN(`${lhs} = ${v}^{\\blob{n}}`, total, hint, productFrames(v, exps));
};

const quotientExponent: Shape = (rng, level) => {
  const v = rng.chance(0.25) ? rng.pick(["2", "3", "10"]) : rng.pick(VARS);
  let e1: number;
  let e2: number;
  if (level === 1) {
    e1 = rng.int(5, 12);
    e2 = rng.int(2, e1 - 1);
  } else {
    const kind = rng.int(0, 2);
    if (kind === 0) {
      e1 = rng.int(2, 6);
      e2 = e1 + rng.int(1, 6);
    } else if (kind === 1) {
      e1 = rng.int(2, 7);
      e2 = -rng.int(1, 5);
    } else {
      e1 = -rng.int(1, 4);
      e2 = rng.int(2, 5);
    }
  }
  const frac = rng.chance(0.5);
  const lhs = frac ? `\\frac{${pp(v, e1)}}{${pp(v, e2)}}` : `${pp(v, e1)} : ${pp(v, e2)}`;
  const hint = e2 < 0 ? "Subtract the exponents. Minus a negative number is plus." : "Same base, divided: subtract the exponents (top minus bottom).";
  return findN(`${lhs} = ${v}^{\\blob{n}}`, e1 - e2, hint, quotientFrames(v, e1, e2, frac));
};

const evalWithRules: Shape = (rng) => {
  const b = rng.pick([2, 2, 3, 5, 10]);
  const r = b === 2 ? rng.int(2, 6) : b === 3 ? rng.int(2, 4) : rng.int(2, 3);
  const kind = rng.int(0, 2);
  let e1: number;
  let e2: number;
  let math: string;
  let frames: Frame[];
  if (kind < 2) {
    e2 = rng.int(2, 6);
    e1 = r + e2;
    math = kind === 0 ? `${pp(b, e1)} : ${pp(b, e2)}` : `\\frac{${pp(b, e1)}}{${pp(b, e2)}}`;
    frames = quotientFrames(String(b), e1, e2, kind === 1, false);
  } else {
    if (r < 3) return null;
    e1 = rng.int(1, r - 1);
    e2 = r - e1;
    math = `${pp(b, e1)} \\cdot ${pp(b, e2)}`;
    frames = productFrames(String(b), [e1, e2]).map((f) => ({ ...f, note: f.note?.replace(` So $n = ${r}$.`, "") }));
  }
  const last = frames[frames.length - 1];
  frames.push({ math: `${last.math} =#eq ${b ** r}#r`, note: `$${pp(b, r)} = ${b ** r}$.` });
  return { instruction: "Calculate", math, answer: { kind: "number", value: b ** r }, hint: "Use a power rule first. Then calculate the small power that's left.", solution: frames };
};

const powerOfPower: Shape = (rng) => {
  const v = rng.chance(0.2) ? rng.pick(["2", "3", "10"]) : rng.pick(VARS);
  const e1 = rng.chance(0.25) ? -rng.int(1, 4) : rng.int(2, 5);
  const k = rng.int(2, 4);
  if (Math.abs(e1 * k) > 16) return null;
  const extra = rng.chance(0.45) ? rng.nonZero(-5, 6) : null;
  const total = e1 * k + (extra ?? 0);
  if (total === 0 || total === 1) return null;
  const math = `(${pp(v, e1)})^{${k}}${extra !== null ? ` \\cdot ${pp(v, extra)}` : ""} = ${v}^{\\blob{n}}`;
  return findN(math, total, "Power of a power: multiply the exponents. Then add the exponent of the extra factor.", powerOfPowerFrames(v, e1, k, extra));
};

const negativeExponent: Shape = (rng) => {
  const kind = rng.int(0, 3);
  if (kind === 0) {
    const b = rng.pick([2, 2, 3, 4, 5, 10]);
    const e = b === 2 ? rng.int(1, 5) : rng.int(1, 3);
    if (e === 1 && rng.chance(0.6)) return null;
    return {
      instruction: "Write as a fraction",
      math: `${b}^{-${e}}`,
      answer: { kind: "fraction", n: 1, d: b ** e },
      hint: "$a^{-n} = \\frac{1}{a^n}$.",
      solution: negativeToFractionFrames(b, e),
    };
  }
  if (kind === 1) {
    const e = rng.int(1, 4);
    const value = Number(`1e-${e}`);
    const big = grouped("1" + "0".repeat(e));
    return {
      instruction: "Write as a decimal number",
      math: `10^{-${e}}`,
      answer: { kind: "number", value },
      hint: `$10^{-${e}} = \\frac{1}{10^{${e}}}$. How many places after the comma?`,
      solution: [
        { math: `10#b^{-#s ${e}#e}`, note: "A negative exponent means: one divided by the power." },
        { math: `\\frac{1#one}{${kp(10, "b", e, "e")}}#F`, note: `$10^{-${e}} = \\frac{1}{${pp(10, e)}}$.` },
        { math: `\\frac{1#one}{${big}#b}#F =#eq ${dec(value)}#r`, note: `Divide by $${big}$: the $1$ moves $${e}$ ${e === 1 ? "place" : "places"} behind the comma. So $10^{-${e}} = ${dec(value)}$.` },
      ],
    };
  }
  if (kind === 2) {
    const b = rng.int(2, 5);
    const e = b <= 3 ? rng.int(2, 4) : rng.int(2, 3);
    if (b ** e > 125) return null;
    return {
      instruction: "Calculate",
      math: `(\\frac{1}{${b}})^{-${e}}`,
      answer: { kind: "number", value: b ** e },
      hint: "A negative exponent flips the fraction.",
      solution: [
        { math: `(\\frac{1#one}{${b}#b}#F)#br^{-#s ${e}#e}`, note: "A negative exponent means: one divided by the power. That flips the fraction." },
        { math: `${b}#b^{${e}#e}`, note: `$(\\frac{1}{${b}})^{-${e}} = ${b}^{${e}}$, now with a positive exponent.` },
        { math: `${b ** e}#b`, note: `$${b}^{${e}} = ${b ** e}$.` },
      ],
    };
  }
  const b = rng.int(2, 5);
  const e1 = rng.int(1, 4);
  const r = rng.int(0, 2);
  const e2 = e1 + r;
  return {
    instruction: "Calculate",
    math: `${b}^{-${e1}} \\cdot ${pp(b, e2)}`,
    answer: { kind: "number", value: b ** r },
    hint: "Same base: add the exponents first.",
    solution: [
      { math: `${kp(b, "b0", -e1, "e0")} \\cdot#d ${kp(b, "b1", e2, "e1")}`, note: `Same base $${b}$, multiplied.` },
      { math: `${b}#b0^{${num(-e1, "e0")} +#p ${e2}#e1}`, note: "Add the exponents." },
      {
        math: `${kp(b, "b0", r, "e0", true)} =#eq ${b ** r}#r`,
        note: `$-${e1} + ${e2} = ${r}$.${r === 0 ? " Any number (except $0$) to the power $0$ is $1$." : r === 1 ? ` And $${b}^1 = ${b}$.` : ` And $${pp(b, r)} = ${b ** r}$.`}`,
      },
    ],
  };
};

const sciNotation: Shape = (rng) => {
  const single = rng.chance(0.25);
  const digits = String(single ? rng.int(2, 9) : rng.nonZero(11, 99, [20, 30, 40, 50, 60, 70, 80, 90]));
  const mant = Number(digits) / 10 ** (digits.length - 1);
  const kind = rng.pick(["big", "big", "small", "small", "back"] as const);
  if (kind === "back") {
    const e = -rng.int(1, 5);
    const value = Number(`${mant}e${e}`);
    return {
      instruction: "Write as a decimal number",
      math: `${dec(mant)} \\cdot 10^{${e}}`,
      answer: { kind: "number", value },
      hint: `The exponent $${e}$ means: move the comma $${-e}$ ${-e === 1 ? "place" : "places"} to the left.`,
      solution: [
        { math: `${dec(mant)}#m \\cdot#d 10#t^{-#es ${-e}#e}`, note: `$10^{${e}}$ makes the number smaller: move the comma $${-e}$ ${-e === 1 ? "place" : "places"} to the **left**.` },
        { math: `${dec(value)}#m`, note: `Fill the gaps with zeros. So $${dec(mant)} \\cdot 10^{${e}} = ${dec(value)}$.` },
      ],
    };
  }
  const e = kind === "big" ? rng.int(4, 9) : -rng.int(2, 6);
  const raw = kind === "big" ? digits + "0".repeat(e - digits.length + 1) : `0,${"0".repeat(-e - 1)}${digits}`;
  return {
    instruction: "Write in scientific notation",
    text: "Write it as $a \\cdot 10^n$ with $1 \\le a < 10$.",
    math: `${kind === "big" ? grouped(raw) : raw} = \\blob{a} \\cdot 10^{\\blob{n}}`,
    answer: { kind: "pair", names: ["a", "n"], values: [mant, e] },
    hint: kind === "big" ? "Count how many places the comma moves to the left. That's $n$." : "The comma moves to the right, so $n$ is negative.",
    solution: sciFrames(digits, e),
  };
};

const simpleRoot: Shape = (rng) => {
  const kind = rng.int(0, 4);
  if (kind === 0) {
    const k = rng.int(11, 20);
    return {
      instruction: "Calculate",
      math: `\\sqrt{${k * k}}`,
      answer: { kind: "number", value: k },
      hint: `Which number times itself gives $${k * k}$?`,
      solution: [
        { math: `\\sqrt{${k * k}#n}#R`, note: `Which number times itself gives $${k * k}$?` },
        { math: `\\sqrt{${k}#a \\cdot#d ${k}#b}#R`, note: `$${k} \\cdot ${k} = ${k * k}$.` },
        { math: `${k}#a`, note: `So $\\sqrt{${k * k}} = ${k}$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = rng.nonZero(2, 15, [10]);
    const N = k * k;
    return {
      instruction: "Calculate",
      math: `\\sqrt{${dec(N / 100)}}`,
      answer: { kind: "number", value: k / 10 },
      hint: `Write it as a fraction: $${dec(N / 100)} = \\frac{${N}}{100}$.`,
      solution: [
        { math: `\\sqrt{${dec(N / 100)}#n}#R`, note: "A root of a decimal number. Write it as a fraction first." },
        { math: `\\sqrt{\\frac{${N}#a}{100#b}#F}#R`, note: `$${dec(N / 100)} = \\frac{${N}}{100}$.` },
        { math: `\\frac{\\sqrt{${N}#a}#R}{\\sqrt{100#b}#R2}#F`, note: "Take the root of the top and of the bottom." },
        { math: `\\frac{${k}#a}{10#b}#F =#eq ${dec(k / 10)}#r`, note: `$\\sqrt{${N}} = ${k}$ and $\\sqrt{100} = 10$. So the result is $${dec(k / 10)}$.` },
      ],
    };
  }
  if (kind === 2) {
    const b = rng.int(2, 12);
    const a = rng.int(1, b - 1);
    if (gcdInt(a, b) !== 1) return null;
    return {
      instruction: "Write as a fraction",
      math: `\\sqrt{\\frac{${a * a}}{${b * b}}}`,
      answer: { kind: "fraction", n: a, d: b },
      hint: "Take the root of the top and of the bottom separately.",
      solution: [
        { math: `\\sqrt{\\frac{${a * a}#a}{${b * b}#b}#F}#R`, note: "The root of a fraction." },
        { math: `\\frac{\\sqrt{${a * a}#a}#R}{\\sqrt{${b * b}#b}#R2}#F`, note: "Take the root of the top and of the bottom." },
        { math: `\\frac{${a}#a}{${b}#b}#F`, note: `$\\sqrt{${a * a}} = ${a}$ and $\\sqrt{${b * b}} = ${b}$.` },
      ],
    };
  }
  if (kind === 3) {
    const r = rng.pick([2, 3, 5, 6, 7, 10]);
    const s1 = rng.int(1, 5);
    const s2 = rng.int(1, 5);
    const a = r * s1 * s1;
    const b = r * s2 * s2;
    if (s1 === s2 || a > 100 || b > 100) return null;
    const value = r * s1 * s2;
    return {
      instruction: "Calculate",
      math: `\\sqrt{${a}} \\cdot \\sqrt{${b}}`,
      answer: { kind: "number", value },
      hint: "$\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{a \\cdot b}$.",
      solution: [
        { math: `\\sqrt{${a}#a}#R \\cdot#d \\sqrt{${b}#b}#R2`, note: "Neither root is a whole number on its own." },
        { math: `\\sqrt{${a}#a \\cdot#d ${b}#b}#R`, note: "Put both under one root: $\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{a \\cdot b}$." },
        { math: `\\sqrt{${a * b}#a}#R`, note: `$${a} \\cdot ${b} = ${a * b}$.` },
        { math: `${value}#a`, note: `$${value} \\cdot ${value} = ${a * b}$, so the result is $${value}$.` },
      ],
    };
  }
  const b = rng.pick([2, 3, 5, 6, 7]);
  const k = rng.int(2, 9);
  const a = b * k * k;
  if (a > 300) return null;
  const frac = rng.chance(0.5);
  return {
    instruction: "Calculate",
    math: frac ? `\\frac{\\sqrt{${a}}}{\\sqrt{${b}}}` : `\\sqrt{${a}} : \\sqrt{${b}}`,
    answer: { kind: "number", value: k },
    hint: "$\\sqrt{a} : \\sqrt{b} = \\sqrt{a : b}$.",
    solution: [
      { math: frac ? `\\frac{\\sqrt{${a}#a}#R}{\\sqrt{${b}#b}#R2}#F` : `\\sqrt{${a}#a}#R :#dv \\sqrt{${b}#b}#R2`, note: "Neither root is a whole number on its own." },
      { math: frac ? `\\sqrt{\\frac{${a}#a}{${b}#b}#F}#R` : `\\sqrt{${a}#a :#dv ${b}#b}#R`, note: "Put both under one root." },
      { math: `\\sqrt{${k * k}#a}#R`, note: `$${a} : ${b} = ${k * k}$.` },
      { math: `${k}#a`, note: `$\\sqrt{${k * k}} = ${k}$.` },
    ],
  };
};

const coefficientProduct: Shape = (rng) => {
  const v = rng.pick(VARS);
  if (rng.chance(0.6)) {
    const c1 = rng.nonZero(-9, 9, [1, -1]);
    const c2 = rng.int(2, 9) * (rng.chance(0.25) ? -1 : 1);
    const e1 = rng.int(1, 7);
    const e2 = rng.chance(0.3) ? -rng.int(1, 4) : rng.int(1, 7);
    const n = e1 + e2;
    const c = c1 * c2;
    if (n === 0 || n === 1 || Math.abs(c) > 72) return null;
    const second = c2 < 0 ? `(${c2}${pp(v, e2)})` : `${c2}${pp(v, e2)}`;
    const f2 = (showOne: boolean) => kp(v, "b2", e2, "e2", showOne);
    return {
      instruction: "Simplify",
      math: `${c1}${pp(v, e1)} \\cdot ${second} = \\blob{c} ${v}^{\\blob{n}}`,
      answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
      hint: "Multiply the numbers. Add the exponents.",
      solution: [
        { math: `${num(c1, "c1")} ${kp(v, "b1", e1, "e1")} \\cdot#dot ${c2 < 0 ? `(${num(c2, "c2")} ${f2(false)})#g` : `${c2}#c2 ${f2(false)}`}`, note: "Numbers and powers, all multiplied." },
        { math: `${num(c1, "c1")} \\cdot#dc ${inner(c2, "c2")} \\cdot#dot ${kp(v, "b1", e1, "e1", true)} \\cdot#dv ${f2(true)}`, note: "Sort them: numbers together, powers together." },
        { math: `${num(c, "c1")} ${v}#b1^{${num(e1, "e1")} +#p ${inner(e2, "e2")}}`, note: `Multiply the numbers: $${c1} \\cdot ${par(c2)} = ${c}$. Add the exponents.` },
        { math: `${num(c, "c1")} ${kp(v, "b1", n, "e1", true)}`, note: `$${e1} + ${par(e2)} = ${n}$. So $c = ${c}$ and $n = ${n}$.` },
      ],
    };
  }
  const c = rng.nonZero(-9, 9, [1, -1]);
  const d = rng.int(2, 6);
  const top = c * d;
  const e1 = rng.int(3, 9);
  const e2 = rng.int(1, e1 + 3);
  const n = e1 - e2;
  if (n === 0 || n === 1 || Math.abs(top) > 60) return null;
  return {
    instruction: "Simplify",
    math: `\\frac{${top}${pp(v, e1)}}{${d}${pp(v, e2)}} = \\blob{c} ${v}^{\\blob{n}}`,
    answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
    hint: "Divide the numbers. Subtract the exponents.",
    solution: [
      { math: `\\frac{${num(top, "c1")} ${kp(v, "b1", e1, "e1")}}{${d}#c2 ${kp(v, "b2", e2, "e2")}}#F`, note: "A fraction with numbers and powers." },
      { math: `\\frac{${num(top, "c1")}}{${d}#c2}#F \\cdot#dot \\frac{${kp(v, "b1", e1, "e1", true)}}{${kp(v, "b2", e2, "e2", true)}}#G`, note: "Split it: numbers on their own, powers on their own." },
      { math: `${num(c, "c1")} ${v}#b1^{${num(e1, "e1")} -#mi ${inner(e2, "e2")}}`, note: `$${top} : ${d} = ${c}$. Divide powers: subtract the exponents.` },
      { math: `${num(c, "c1")} ${kp(v, "b1", n, "e1", true)}`, note: `$${e1} - ${e2} = ${n}$. So $c = ${c}$ and $n = ${n}$.` },
    ],
  };
};

const mixedTwoVars: Shape = (rng) => {
  const [u, w] = rng.pick(LETTER_PAIRS);
  if (rng.chance(0.55)) {
    const k = rng.int(2, 3);
    const p1 = rng.nonZero(-3, 4);
    const q1 = rng.nonZero(-3, 4);
    const p2 = rng.nonZero(-5, 5);
    const q2 = rng.nonZero(-5, 5);
    const m = p1 * k + p2;
    const n = q1 * k + q2;
    if ((p1 < 0 && q1 < 0) || !m || !n || Math.abs(m) > 15 || Math.abs(n) > 15) return null;
    return {
      instruction: "Simplify",
      math: `(${pp(u, p1)} ${pp(w, q1)})^{${k}} \\cdot ${pp(u, p2)} ${pp(w, q2)} = ${u}^{\\blob{m}} ${w}^{\\blob{n}}`,
      answer: { kind: "pair", names: ["m", "n"], values: [m, n] },
      hint: "Bracket first: multiply each exponent inside by the outer one. Then add exponents of the same letter.",
      solution: [
        { math: `(${kp(u, "u1", p1, "pu")} ${kp(w, "w1", q1, "pw")})#br^{${k}#k} \\cdot#dot ${kp(u, "u2", p2, "ru")} ${kp(w, "w2", q2, "rw")}`, note: "Start with the bracket." },
        {
          math: `${u}#u1^{${inner(p1, "pu")} \\cdot#ku ${k}#k} ${w}#w1^{${inner(q1, "pw")} \\cdot#kw ${k}#k2} \\cdot#dot ${kp(u, "u2", p2, "ru", true)} ${kp(w, "w2", q2, "rw", true)}`,
          note: `The outer exponent $${k}$ multiplies **every** exponent inside.`,
        },
        {
          math: `${kp(u, "u1", p1 * k, "pu", true)} ${kp(w, "w1", q1 * k, "pw", true)} \\cdot#dot ${kp(u, "u2", p2, "ru", true)} ${kp(w, "w2", q2, "rw", true)}`,
          note: `$${par(p1)} \\cdot ${k} = ${p1 * k}$ and $${par(q1)} \\cdot ${k} = ${q1 * k}$.`,
        },
        {
          math: `${u}#u1^{${num(p1 * k, "pu")} +#su ${inner(p2, "ru")}} ${w}#w1^{${num(q1 * k, "pw")} +#sw ${inner(q2, "rw")}}`,
          note: `Same letter, multiplied: add the exponents. $${u}$ with $${u}$, $${w}$ with $${w}$.`,
        },
        { math: `${kp(u, "u1", m, "pu", true)} ${kp(w, "w1", n, "pw", true)}`, note: `So $m = ${m}$ and $n = ${n}$.` },
      ],
    };
  }
  const p1 = rng.int(1, 9);
  const q1 = rng.int(1, 9);
  const p2 = rng.int(1, 9);
  const q2 = rng.int(1, 9);
  const m = p1 - p2;
  const n = q1 - q2;
  if (!m || !n || (m > 0 && n > 0 && rng.chance(0.6))) return null;
  const neg = m < 0 ? pp(u, m) : n < 0 ? pp(w, n) : null;
  const negPlain = m < 0 ? pp(u, -m) : pp(w, -n);
  return {
    instruction: "Simplify",
    math: `\\frac{${pp(u, p1)} ${pp(w, q1)}}{${pp(u, p2)} ${pp(w, q2)}} = ${u}^{\\blob{m}} ${w}^{\\blob{n}}`,
    answer: { kind: "pair", names: ["m", "n"], values: [m, n] },
    hint: "Each letter on its own: exponent on top minus exponent below.",
    solution: [
      { math: `\\frac{${kp(u, "u1", p1, "pu")} ${kp(w, "w1", q1, "pw")}}{${kp(u, "u2", p2, "ru")} ${kp(w, "w2", q2, "rw")}}#F`, note: "Two letters. Treat each one on its own." },
      { math: `${u}#u1^{${num(p1, "pu")} -#su ${inner(p2, "ru")}} ${w}#w1^{${num(q1, "pw")} -#sw ${inner(q2, "rw")}}`, note: "Divide powers with the same base: subtract the exponents (top minus bottom)." },
      {
        math: `${kp(u, "u1", m, "pu", true)} ${kp(w, "w1", n, "pw", true)}`,
        note: `So $m = ${m}$ and $n = ${n}$.${neg ? ` A negative exponent is fine: $${neg} = \\frac{1}{${negPlain}}$.` : ""}`,
      },
    ],
  };
};

const mixedCoefficient: Shape = (rng) => {
  const v = rng.pick(VARS);
  const k = rng.pick([2, 2, 3, -2, -1]);
  const j = k === 3 ? 2 : rng.int(2, 3);
  const e1 = rng.chance(0.2) ? -rng.int(1, 2) : rng.int(1, 4);
  const K = k ** j;
  const head = `${coef(k)}${pp(v, e1)}`;
  if (rng.chance(0.6)) {
    const d = rng.pick([1, 2, 3, 4, 5, -2, -3]);
    const e2 = rng.nonZero(-6, 5);
    const c = K * d;
    const n = e1 * j + e2;
    if (Math.abs(c) < 2 || Math.abs(c) > 100 || n === 0 || n === 1) return null;
    const second = d === 1 ? pp(v, e2) : d < 0 ? `(${d}${pp(v, e2)})` : `${d}${pp(v, e2)}`;
    return {
      instruction: "Simplify",
      math: `(${head})^{${j}} \\cdot ${second} = \\blob{c} ${v}^{\\blob{n}}`,
      answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
      hint: `Bracket first: $(${head})^{${j}} = ${par(k)}^{${j}} \\cdot (${pp(v, e1)})^{${j}}$.`,
      solution: bracketPowerFrames(v, k, e1, j, { d, e2 }),
    };
  }
  if (K < 0 || Math.abs(K) < 4) return null;
  const divisors = [2, 3, 4, 9].filter((d) => d < Math.abs(K) && K % d === 0);
  if (!divisors.length) return null;
  const d = rng.pick(divisors);
  const c = K / d;
  const e2 = rng.int(1, 9);
  const n = e1 * j - e2;
  if (n === 0 || n === 1) return null;
  return {
    instruction: "Simplify",
    math: `\\frac{(${head})^{${j}}}{${d}${pp(v, e2)}} = \\blob{c} ${v}^{\\blob{n}}`,
    answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
    hint: "Work out the bracket on top first. Then divide the numbers and subtract the exponents.",
    solution: [
      { math: `\\frac{(${coef(k) === "-" ? "-#c1s " : `${num(k, "c1")} `}${kp(v, "b1", e1, "e1")})#br^{${j}#j}}{${d}#c2 ${kp(v, "b2", e2, "e2")}}#F`, note: "Start with the bracket on top." },
      {
        math: `\\frac{${num(K, "c1")} ${kp(v, "b1", e1 * j, "e1", true)}}{${d}#c2 ${kp(v, "b2", e2, "e2")}}#F`,
        note: `The exponent goes to both factors: $${par(k)}^{${j}} = ${K}$ and $(${pp(v, e1)})^{${j}} = ${pp(v, e1 * j)}$.`,
      },
      { math: `${num(c, "c1")} ${v}#b1^{${num(e1 * j, "e1")} -#mi ${inner(e2, "e2")}}`, note: `$${K} : ${d} = ${c}$. Divide powers: subtract the exponents.` },
      { math: `${num(c, "c1")} ${kp(v, "b1", n, "e1", true)}`, note: `$${e1 * j} - ${e2} = ${n}$. So $c = ${c}$ and $n = ${n}$.` },
    ],
  };
};

const partialRoot: Shape = (rng) => {
  const kind = rng.pick(["plain", "plain", "prefix", "sum", "product"] as const);
  const unknown = "\\blob{a} \\sqrt{\\blob{b}}";
  const pair = (a: number, b: number) => ({ kind: "pair" as const, names: ["a", "b"] as [string, string], values: [a, b] as [number, number] });
  if (kind === "plain") {
    const s = rng.int(2, 10);
    const r = rng.pick(SQUAREFREE);
    const N = s * s * r;
    if (N > 300) return null;
    return {
      instruction: "Simplify the root",
      math: `\\sqrt{${N}} = ${unknown}`,
      answer: pair(s, r),
      hint: `Look for the biggest square number that divides $${N}$ (like $4, 9, 16, 25, 36, …$).`,
      solution: partialRootFrames(N),
    };
  }
  if (kind === "prefix") {
    const t = rng.int(2, 5);
    const s = rng.int(2, 5);
    const r = rng.pick([2, 3, 5, 6, 7]);
    const N = s * s * r;
    if (N > 150) return null;
    return {
      instruction: "Simplify the root",
      math: `${t}\\sqrt{${N}} = ${unknown}`,
      answer: pair(t * s, r),
      hint: `First simplify $\\sqrt{${N}}$. Then multiply by $${t}$.`,
      solution: partialRootFrames(N, t),
    };
  }
  if (kind === "sum") {
    const r = rng.pick([2, 3, 5, 6, 7]);
    const s1 = rng.int(1, 6);
    const s2 = rng.int(1, 6);
    const minus = rng.chance(0.4);
    const a = minus ? s1 - s2 : s1 + s2;
    const N1 = s1 * s1 * r;
    const N2 = s2 * s2 * r;
    if (s1 === s2 || a < 2 || N1 > 200 || N2 > 200 || (s1 === 1 && s2 === 1)) return null;
    const op = minus ? "-" : "+";
    const rootSrc = (s: number, i: number) => (s === 1 ? `\\sqrt{${r}#r${i}}#R${i}` : `\\sqrt{${s * s}#s${i} \\cdot#d${i} ${r}#r${i}}#R${i}`);
    const outSrc = (s: number, i: number) => `${s === 1 ? "" : `${s}#s${i} `}\\sqrt{${r}#r${i}}#R${i}`;
    const outPlain = (s: number) => `${s === 1 ? "" : s}\\sqrt{${r}}`;
    return {
      instruction: "Simplify",
      math: `\\sqrt{${N1}} ${op} \\sqrt{${N2}} = ${unknown}`,
      answer: pair(a, r),
      hint: "Simplify each root first. Then they have the same root and can be combined.",
      solution: [
        { math: `\\sqrt{${N1}#s1}#R1 ${op}#op \\sqrt{${N2}#s2}#R2`, note: "You can't add the numbers under the roots. Simplify each root first." },
        { math: `${rootSrc(s1, 1)} ${op}#op ${rootSrc(s2, 2)}`, note: `Square factors: ${[[N1, s1], [N2, s2]].filter(([, s]) => s > 1).map(([N, s]) => `$${N} = ${s * s} \\cdot ${r}$`).join(" and ")}.` },
        { math: `${outSrc(s1, 1)} ${op}#op ${outSrc(s2, 2)}`, note: `Take them out: $${outPlain(s1)} ${op} ${outPlain(s2)}$.` },
        { math: `${a}#s1 \\sqrt{${r}#r1}#R1`, note: `Both have $\\sqrt{${r}}$, so combine them like $x$-terms: $${s1} ${op} ${s2} = ${a}$. So $a = ${a}$ and $b = ${r}$.` },
      ],
    };
  }
  const r = rng.pick([2, 3, 5, 6]);
  const s = rng.int(2, 6);
  const N = s * s * r;
  if (N > 200) return null;
  const options: [number, number][] = [];
  for (let a = 2; a * a < N; a++) {
    if (N % a !== 0) continue;
    const b = N / a;
    if (largestSquareRoot(a) ** 2 === a || largestSquareRoot(b) ** 2 === b) continue;
    options.push([a, b]);
  }
  if (!options.length) return null;
  const [a, b] = rng.pick(options);
  return {
    instruction: "Simplify",
    math: `\\sqrt{${a}} \\cdot \\sqrt{${b}} = ${unknown}`,
    answer: pair(s, r),
    hint: "Put both under one root first. Then look for the biggest square factor.",
    solution: [
      { math: `\\sqrt{${a}#x}#R \\cdot#d \\sqrt{${b}#y}#R2`, note: "Two roots, multiplied." },
      { math: `\\sqrt{${a}#x \\cdot#d ${b}#y}#R`, note: "Put both under one root: $\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{a \\cdot b}$." },
      { math: `\\sqrt{${N}#x}#R`, note: `$${a} \\cdot ${b} = ${N}$.` },
      { math: `\\sqrt{${s * s}#x \\cdot#d2 ${r}#r}#R`, note: `The biggest square factor: $${N} = ${s * s} \\cdot ${r}$.`, highlight: ["x"] },
      { math: `${s}#x \\sqrt{${r}#r}#R`, note: `$\\sqrt{${s * s}} = ${s}$ comes out. So $a = ${s}$ and $b = ${r}$.` },
    ],
  };
};

const SCI_DIV: [number, number][] = [
  [8, 2],
  [9, 3],
  [6, 2],
  [6, 3],
  [8, 4],
  [9, 2],
  [7, 2],
  [3, 6],
  [2, 8],
  [4, 8],
  [1, 2],
  [3, 4],
  [1, 4],
  [5, 2],
];

const sciCalc: Shape = (rng) => {
  const div = rng.chance(0.4);
  const [a1, a2] = div ? rng.pick(SCI_DIV) : [rng.int(2, 9), rng.int(2, 9)];
  const e1 = rng.nonZero(-8, 9);
  const e2 = rng.nonZero(-8, 9);
  const P = div ? a1 / a2 : a1 * a2;
  const E = div ? e1 - e2 : e1 + e2;
  const mant = P >= 10 ? P / 10 : P < 1 ? P * 10 : P;
  const n = P >= 10 ? E + 1 : P < 1 ? E - 1 : E;
  if (n === 0 || Math.abs(n) > 15 || Math.abs(E) > 15) return null;
  const t = (a: number, e: number) => `(${a} \\cdot 10^{${e}})`;
  return {
    instruction: "Calculate",
    text: "Give the result as $a \\cdot 10^n$ with $1 \\le a < 10$.",
    math: `${t(a1, e1)} ${div ? ":" : "\\cdot"} ${t(a2, e2)} = \\blob{a} \\cdot 10^{\\blob{n}}`,
    answer: { kind: "pair", names: ["a", "n"], values: [mant, n] },
    hint: `${div ? "Divide" : "Multiply"} the numbers and the powers of ten separately. Check that $a$ is between $1$ and $10$.`,
    solution: sciCalcFrames(a1, e1, a2, e2, div),
  };
};

const negativeFraction: Shape = (rng) => {
  if (rng.chance(0.6)) {
    const a = rng.int(2, 5);
    const b = rng.int(2, 5);
    const e = rng.int(2, 3);
    if (a === b || gcdInt(a, b) !== 1 || Math.max(a, b) ** e > 125) return null;
    return {
      instruction: "Write as a fraction",
      math: `(\\frac{${a}}{${b}})^{-${e}}`,
      answer: { kind: "fraction", n: b ** e, d: a ** e },
      hint: "A negative exponent flips the fraction. Then the exponent is positive.",
      solution: [
        { math: `(\\frac{${a}#a}{${b}#b}#F)#br^{-#s ${e}#e}`, note: "A negative exponent means: one divided by the power." },
        { math: `(\\frac{${b}#b}{${a}#a}#F)#br^{${e}#e}`, note: "That flips the fraction, and the exponent becomes positive." },
        { math: `\\frac{${b}#b^{${e}#e}}{${a}#a^{${e}#e2}}#F`, note: "The exponent goes to the top and to the bottom." },
        { math: `\\frac{${b ** e}#b}{${a ** e}#a}#F`, note: `$${b}^{${e}} = ${b ** e}$ and $${a}^{${e}} = ${a ** e}$.` },
      ],
    };
  }
  const b = rng.int(2, 5);
  const e1 = rng.int(1, 5);
  const r = rng.int(1, 3);
  const e2 = e1 + r;
  if (b ** r > 125) return null;
  const frames = quotientFrames(String(b), -e1, -e2, true, false);
  const last = frames[frames.length - 1];
  frames.push({ math: `${last.math} =#eq ${b ** r}#r`, note: `$${pp(b, r)} = ${b ** r}$.` });
  return {
    instruction: "Calculate",
    math: `\\frac{${b}^{-${e1}}}{${b}^{-${e2}}}`,
    answer: { kind: "number", value: b ** r },
    hint: "Same base: subtract the exponents. Minus a negative number is plus.",
    solution: frames,
  };
};

const SHAPES: Record<Level, [Shape, number][]> = {
  1: [
    [evalPower, 3],
    [productExponent, 3],
    [quotientExponent, 2],
    [evalWithRules, 2],
  ],
  2: [
    [powerOfPower, 2],
    [negativeExponent, 2],
    [quotientExponent, 1],
    [productExponent, 1],
    [sciNotation, 2],
    [simpleRoot, 2],
    [coefficientProduct, 2],
    [evalPower, 1],
  ],
  3: [
    [mixedTwoVars, 2],
    [mixedCoefficient, 2],
    [partialRoot, 3],
    [sciCalc, 2],
    [negativeFraction, 1],
  ],
};

function generate(level: Level, rng: Rng): Exercise {
  const shapes = SHAPES[level];
  const total = shapes.reduce((s, [, w]) => s + w, 0);
  for (let tries = 0; tries < 60; tries++) {
    let pick = rng.next() * total;
    const shape = shapes.find(([, w]) => (pick -= w) < 0)?.[0] ?? shapes[0][0];
    const ex = shape(rng, level);
    if (ex) return ex;
  }
  return productExponent(rng, 1) ?? findN("x^2 \\cdot x^3 = x^{\\blob{n}}", 5, "Same base: add the exponents.", productFrames("x", [2, 3]));
}

// ---------------------------------------------------------------------------
// Interactive 1: the power lab. Every factor is a tile; the rules are just
// counting tiles.

type Rule = "mul" | "div" | "pow";

const RULES: { id: Rule; label: string }[] = [
  { id: "mul", label: "a^m \\cdot a^n" },
  { id: "div", label: "a^m : a^n" },
  { id: "pow", label: "(a^m)^n" },
];

const MAX: Record<Rule, { m: number; n: number }> = { mul: { m: 6, n: 6 }, div: { m: 6, n: 6 }, pow: { m: 4, n: 3 } };

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

type Piece = { key: string; kind: "tile"; tone: number } | { key: string; kind: "open" | "close" | "dot" };

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 font-math text-[18px] italic text-ink-2">{label} =</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-7 text-center font-math text-[20px] tabular-nums">
        {value}
      </motion.span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function tileClass(tone: number) {
  return cn(
    "grid size-10 place-items-center rounded-[11px] font-math text-[22px] italic select-none",
    tone % 2 === 0 ? "bg-blob text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]" : "bg-blob-soft text-blob-ink ring-1 ring-inset ring-blob/35",
  );
}

function rowPieces(rule: Rule, m: number, n: number, joined: boolean): Piece[] {
  const sizes = rule === "mul" ? [m, n] : Array.from({ length: n }, () => m);
  const out: Piece[] = [];
  let i = 0;
  sizes.forEach((size, g) => {
    if (!joined && g > 0) out.push({ key: `dot${g}`, kind: "dot" });
    if (!joined) out.push({ key: `open${g}`, kind: "open" });
    for (let j = 0; j < size; j++, i++) out.push({ key: `t${i}`, kind: "tile", tone: g });
    if (!joined) out.push({ key: `close${g}`, kind: "close" });
  });
  return out;
}

const factors = (k: number) => (k === 1 ? "1 factor" : `${k} factors`);
const pairs = (k: number) => (k === 1 ? "1 pair" : `${k} pairs`);

function PowerLab() {
  const scope = useId();
  const [rule, setRule] = useState<Rule>("mul");
  const [m, setM] = useState(3);
  const [n, setN] = useState(2);
  const [joined, setJoined] = useState(false);

  function pickRule(r: Rule) {
    setRule(r);
    setM((x) => Math.min(x, MAX[r].m));
    setN((x) => Math.min(x, MAX[r].n));
  }

  const result = rule === "mul" ? m + n : rule === "div" ? m - n : m * n;
  const cancel = Math.min(m, n);

  let formula: string;
  if (rule === "mul") {
    formula = `a#A^{${m}#M} \\cdot#d a#B^{${n}#N}`;
    if (joined) formula += ` =#e1 a#C^{${m}#M2 +#op ${n}#N2} =#e2 a#D^{${result}#R}`;
  } else if (rule === "div") {
    formula = `a#A^{${m}#M} :#d a#B^{${n}#N}`;
    if (joined) {
      formula += ` =#e1 a#C^{${m}#M2 -#op ${n}#N2} =#e2 a#D^{${num(result, "R")}}`;
      if (result === 0) formula += " =#e3 1#one";
      if (result < 0) formula += ` =#e3 \\frac{1#one}{${kp("a", "E", -result, "R2")}}#F`;
    }
  } else {
    formula = `(a#A^{${m}#M})#br^{${n}#N}`;
    if (joined) formula += ` =#e1 a#C^{${m}#M2 \\cdot#op ${n}#N2} =#e2 a#D^{${result}#R}`;
  }

  const caption = !joined
    ? rule === "mul"
      ? `${factors(m)} times ${factors(n)}. Press Combine.`
      : rule === "div"
        ? `${factors(m)} on top, ${factors(n)} below. Press Combine.`
        : `${n === 1 ? "1 bracket" : `${n} brackets`}, each with ${factors(m)}. Press Combine.`
    : rule === "mul"
      ? `${m} + ${n} = ${factors(result)}: add the exponents.`
      : rule === "pow"
        ? `${n} × ${m} = ${factors(result)}: multiply the exponents.`
        : result > 0
          ? `${pairs(cancel)} cancel, ${factors(result)} left on top: subtract the exponents.`
          : result === 0
            ? "Everything cancels, so 1 is left. That's why a⁰ = 1."
            : `${pairs(cancel)} cancel, ${factors(-result)} left below. That's what the negative exponent means.`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex rounded-lg border border-line p-0.5">
          {RULES.map((r) => (
            <button
              key={r.id}
              onClick={() => pickRule(r.id)}
              className={cn("relative rounded-md px-3 py-1.5", rule === r.id ? "text-ink" : "text-ink-3 hover:text-ink")}
              aria-pressed={rule === r.id}
            >
              {rule === r.id && <motion.span layoutId={`${scope}-rule`} className="absolute inset-0 rounded-md bg-hover" transition={spring} />}
              <MathView src={r.label} size="sm" animate={false} className="relative" />
            </button>
          ))}
        </div>
        <Stepper label="m" value={m} min={1} max={MAX[rule].m} onChange={setM} />
        <Stepper label="n" value={n} min={1} max={MAX[rule].n} onChange={setN} />
      </div>

      <div className="relative grid min-h-[190px] place-items-center overflow-hidden rounded-xl border border-line bg-surface px-4 py-6">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
        {rule === "div" ? (
          <div
            className="relative grid gap-x-1.5 gap-y-2"
            style={{ gridTemplateColumns: `repeat(${Math.max(m, n)}, 2.5rem)` }}
          >
            <AnimatePresence initial={false}>
              {Array.from({ length: m }, (_, i) => (
                <DivTile key={`t${i}`} col={i} row={1} tone={0} gone={joined && i < cancel} delay={i * 0.12} />
              ))}
              {Array.from({ length: n }, (_, i) => (
                <DivTile key={`b${i}`} col={i} row={3} tone={1} gone={joined && i < cancel} delay={i * 0.12 + 0.06} />
              ))}
            </AnimatePresence>
            <motion.div layout transition={spring} className="h-[3px] rounded-full bg-ink-2" style={{ gridColumn: "1 / -1", gridRow: 2 }} />
          </div>
        ) : (
          <div className="relative flex max-w-full flex-wrap items-center justify-center gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {rowPieces(rule, m, n, joined).map((pc) =>
                pc.kind === "tile" ? (
                  <motion.span
                    key={pc.key}
                    layout
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={spring}
                    className={tileClass(pc.tone)}
                  >
                    a
                  </motion.span>
                ) : (
                  <motion.span
                    key={pc.key}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                    className={cn("font-math leading-none text-ink-3", pc.kind === "dot" ? "px-1 text-[26px]" : "text-[40px] font-light")}
                  >
                    {pc.kind === "open" ? "(" : pc.kind === "close" ? ")" : "·"}
                  </motion.span>
                ),
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          onClick={() => setJoined((j) => !j)}
          className={cn(
            "flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors active:scale-[0.97]",
            joined ? "border border-line text-ink-2 hover:bg-hover hover:text-ink" : "bg-blob text-white hover:bg-blob-deep",
          )}
        >
          {joined ? <Split className="size-4" /> : <Combine className="size-4" />}
          {joined ? "Write out again" : "Combine"}
        </button>
        <MathView src={formula} size="md" scope={`${scope}-f`} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={caption} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] text-ink-2">
          {caption}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function DivTile({ col, row, tone, gone, delay }: { col: number; row: number; tone: number; gone: boolean; delay: number }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: gone ? 0.25 : 1, scale: gone ? 0.86 : 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ ...spring, delay: gone ? delay : 0 }}
      className={cn(tileClass(tone), "relative")}
      style={{ gridColumn: col + 1, gridRow: row }}
    >
      a
      <motion.span
        initial={false}
        animate={{ scaleX: gone ? 1 : 0 }}
        transition={{ duration: 0.25, delay: gone ? delay + 0.1 : 0 }}
        className="absolute left-[-3px] right-[-3px] top-1/2 h-[2.5px] origin-left -rotate-[28deg] rounded-full bg-ink"
      />
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Interactive 2: the root splitter. Pick a square factor and see the number
// as squares of equal size.

const SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196];
const ROOT_PRESETS = [72, 50, 12, 75, 98, 48, 200, 18, 180, 27, 128, 45, 20];

function SquaresPicture({ k, r }: { k: number; r: number }) {
  const W = 360;
  const H = 168;
  const left = 40;
  const gap = 8;
  let best = { cols: 1, c: 0 };
  for (let cols = 1; cols <= r; cols++) {
    const rows = Math.ceil(r / cols);
    const c = Math.min((W - left - 4 - (cols - 1) * gap) / (cols * k), (H - 8 - (rows - 1) * gap) / (rows * k));
    if (c > best.c) best = { cols, c };
  }
  const c = Math.min(best.c, 24);
  const cols = best.cols;
  const rows = Math.ceil(r / cols);
  const side = k * c;
  const ox = left + (W - left - (cols * side + (cols - 1) * gap)) / 2;
  const oy = (H - (rows * side + (rows - 1) * gap)) / 2;
  const total = k * k * r;
  const inset = Math.min(1.6, c * 0.12);
  const cells = Array.from({ length: total }, (_, i) => {
    const j = Math.floor(i / (k * k));
    const w = i % (k * k);
    return {
      i,
      j,
      x: ox + (j % cols) * (side + gap) + (w % k) * c + inset / 2,
      y: oy + Math.floor(j / cols) * (side + gap) + Math.floor(w / k) * c + inset / 2,
    };
  });
  const size = Math.max(0.5, c - inset);
  const fill = (j: number) => (k === 1 ? "color-mix(in oklab, var(--ink) 22%, transparent)" : j % 2 === 0 ? "var(--blob)" : "color-mix(in oklab, var(--blob) 45%, transparent)");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px]" role="img" aria-label={`${total} as ${r} squares of ${k} by ${k}`}>
      <AnimatePresence initial={false}>
        {cells.map((cell) => (
          <motion.rect
            key={cell.i}
            initial={{ opacity: 0, x: cell.x, y: cell.y, width: size, height: size }}
            animate={{ opacity: 1, x: cell.x, y: cell.y, width: size, height: size, fill: fill(cell.j) }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 210, damping: 26, delay: Math.min(cell.i * 0.002, 0.3) }}
            rx={Math.min(3, c * 0.2)}
          />
        ))}
      </AnimatePresence>
      {k > 1 && (
        <motion.g initial={false} animate={{ x: ox - 10, y: oy }} transition={{ type: "spring", stiffness: 210, damping: 26 }}>
          <motion.line initial={false} animate={{ y2: side }} x1={0} x2={0} y1={0} stroke="var(--ink-3)" strokeWidth={1.2} />
          <motion.text initial={false} animate={{ y: side / 2 + 8 }} x={-8} textAnchor="end" fontSize={24} fill="var(--ink-2)" fontFamily="var(--font-math)">
            {k}
          </motion.text>
        </motion.g>
      )}
    </svg>
  );
}

function RootSplitter() {
  const scope = useId();
  const [n, setN] = useState(72);
  const [pick, setPick] = useState<number | null>(null);
  const [preset, setPreset] = useState(0);
  const fits = SQUARES.filter((s) => s <= n && n % s === 0);
  const best = fits.length ? fits[fits.length - 1] : 1;
  const sq = pick !== null && fits.includes(pick) ? pick : best;
  const k = Math.round(Math.sqrt(sq));
  const r = n / sq;
  const restRoot = largestSquareRoot(r);

  function setNumber(next: number) {
    setN(Math.min(200, Math.max(2, next)));
    setPick(null);
  }

  let formula: string;
  if (sq === 1) formula = `\\sqrt{${n}#N}#W`;
  else if (r === 1) formula = `\\sqrt{${n}#N}#W =#e1 \\sqrt{${k}#S \\cdot#d ${k}#R}#W1 =#e3 \\blob{${k}#K}`;
  else formula = `\\sqrt{${n}#N}#W =#e1 \\sqrt{${sq}#S \\cdot#d ${r}#R}#W1 =#e2 \\sqrt{${sq}#S2}#W2 \\cdot#d2 \\sqrt{${r}#R2}#W3 =#e3 ${restRoot > 1 ? `${k}#K \\sqrt{${r}#R3}#W4` : `\\blob{${k}#K \\sqrt{${r}#R3}#W4}`}`;

  const status: { ok: boolean; text: string } =
    sq === 1
      ? { ok: true, text: `No square number (except 1) divides $${n}$. So $\\sqrt{${n}}$ stays as it is.` }
      : r === 1
        ? { ok: true, text: `$${n}$ is a square number itself: $\\sqrt{${n}} = ${k}$.` }
        : restRoot > 1
          ? { ok: false, text: `Not finished: $${r}$ still contains the square number $${restRoot * restRoot}$. Pick a bigger square.` }
          : { ok: true, text: `Fully simplified: $\\sqrt{${n}} = ${k}\\sqrt{${r}}$.` };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[13px] text-ink-2">Number under the root</span>
          <button onClick={() => setNumber(n - 1)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label="Decrease">
            <Minus className="size-3.5" />
          </button>
          <motion.span key={n} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-10 text-center font-math text-[20px] tabular-nums">
            {n}
          </motion.span>
          <button onClick={() => setNumber(n + 1)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label="Increase">
            <Plus className="size-3.5" />
          </button>
        </div>
        <button
          onClick={() => {
            const next = (preset + 1) % ROOT_PRESETS.length;
            setPreset(next);
            setNumber(ROOT_PRESETS[next]);
          }}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Shuffle className="size-3.5" /> Another number
        </button>
      </div>

      <div>
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Square factors</div>
        <div className="flex flex-wrap gap-1.5">
          {SQUARES.filter((s) => s <= Math.max(n, 4)).map((s) => {
            const ok = n % s === 0;
            const on = ok && s === sq;
            return (
              <button
                key={s}
                disabled={!ok}
                onClick={() => setPick(s)}
                className={cn(
                  "relative h-9 min-w-11 rounded-lg border px-2.5 font-math text-[17px] tabular-nums transition-colors",
                  on ? "border-transparent text-white" : ok ? "border-blob/40 text-ink hover:bg-blob-soft" : "border-line text-ink-3/60",
                )}
                aria-pressed={on}
              >
                {on && <motion.span layoutId={`${scope}-sq`} className="absolute inset-0 rounded-lg bg-blob" transition={spring} />}
                <span className="relative">{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <div className="flex min-h-[64px] items-center">
          <MathView src={formula} size="lg" scope={`${scope}-f`} />
        </div>
        <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={status.text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("flex items-start gap-2 text-[13.5px] leading-relaxed", status.ok ? "text-ok" : "text-ink-2")}
            >
              {status.ok && <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />}
              <span>
                <Inline text={status.text} />
              </span>
            </motion.div>
          </AnimatePresence>
          <div className="space-y-1">
            <SquaresPicture k={k} r={r} />
            <div className="flex justify-center">
              <MathView src={k === 1 ? `${n} = ${n} \\cdot 1^2` : `${n} = ${r} \\cdot ${k}^2`} size="sm" animate={false} className="text-ink-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const introFrames: Frame[] = [
  { math: "2#a \\cdot#d1 2#b \\cdot#d2 2#c \\cdot#d3 2#d \\cdot#d4 2#e", note: "Five times the same factor $2$. Writing that out gets long." },
  {
    math: "2#a^{5#n}",
    note: 'Short: $2^5$, read "2 to the power of 5". The **base** $2$ is the factor, the **exponent** $5$ counts the factors.',
    highlight: ["a", "n"],
  },
  { math: "2#a^{5#n} =#eq 32#r", note: "Worked out: $2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32$." },
  { math: "2#a^{3#n} =#eq 2#x1 \\cdot#m1 2#x2 \\cdot#m2 2#x3 =#eq2 8#r", note: "Careful: $2^3$ means $2 \\cdot 2 \\cdot 2 = 8$. It's **not** $2 \\cdot 3 = 6$.", highlight: ["n"] },
  {
    math: "(-#m 3#a)#br^{2#n} =#eq 9#r ,#c -#m2 3#a2^{2#n2} =#eq2 -#m3 9#r2",
    note: "Brackets matter: in $(-3)^2$ the minus is squared too. In $-3^2$ only the $3$ is squared.",
  },
];

const productFramesLesson: Frame[] = [
  { math: "a#a1^{3#e1} \\cdot#dot a#a4^{2#e2}", note: "Two powers with the **same base** $a$, multiplied." },
  { math: "(a#a1 \\cdot#m1 a#a2 \\cdot#m2 a#a3)#L \\cdot#dot (a#a4 \\cdot#m4 a#a5)#R", note: "Write them out: three factors $a$, then two more." },
  {
    math: "a#a1 \\cdot#m1 a#a2 \\cdot#m2 a#a3 \\cdot#dot a#a4 \\cdot#m4 a#a5",
    note: "Without brackets it's one long product of $3 + 2 = 5$ factors.",
    highlight: ["a1", "a2", "a3", "a4", "a5"],
  },
  { math: "a#a1^{3#e1 +#pl 2#e2}", note: "So the exponents add up: $a^{3+2}$." },
  { math: "a#a1^{5#e1}", note: "$a^3 \\cdot a^2 = a^5$. **Same base: keep it and add the exponents.** In general $a^m \\cdot a^n = a^{m+n}$." },
];

const quotientFramesLesson: Frame[] = [
  { math: "\\frac{a#a1^{5#e1}}{a#b1^{2#e2}}#F", note: "Now divide: $a^5 : a^2$, written as a fraction." },
  {
    math: "\\frac{\\strike{a#a1} \\cdot#m1 \\strike{a#a2} \\cdot#m2 a#a3 \\cdot#m3 a#a4 \\cdot#m4 a#a5}{\\strike{a#b1} \\cdot#n1 \\strike{a#b2}}#F",
    note: "Write it out. Each $a$ below cancels one $a$ on top.",
  },
  { math: "a#a3 \\cdot#m3 a#a4 \\cdot#m4 a#a5 =#eq a#r^{3#e3}", note: "Three factors are left: $a^5 : a^2 = a^{5-2} = a^3$. So **subtract** the exponents." },
  { math: "a#a3^{3#e1} :#dv a#b1^{3#e2} =#eq a#r^{0#e3} =#eq2 1#one", note: "Same exponents? Everything cancels and $1$ is left. That's why $a^0 = 1$." },
  {
    math: "a#a3^{2#e1} :#dv a#b1^{5#e2} =#eq a#r^{-#ns 3#e3} =#eq2 \\frac{1#one}{a#q^{3#e4}}#G",
    note: "More factors below? Then three $a$ stay **below**: $a^{-3} = \\frac{1}{a^3}$. A negative exponent means **one divided by**.",
  },
];

const bracketFramesLesson: Frame[] = [
  { math: "(a#a^{2#e1})#br^{3#e2}", note: "A power of a power: $a^2$, three times." },
  { math: "a#a^{2#e1} \\cdot#d1 a#a2^{2#f1} \\cdot#d2 a#a3^{2#f2}", note: "Written out: $a^2 \\cdot a^2 \\cdot a^2 = a^{2+2+2}$." },
  { math: "a#a^{2#e1 \\cdot#t 3#e2} =#eq a#r^{6#e3}", note: "That's $2 \\cdot 3$. So for a power of a power, **multiply** the exponents." },
  { math: "(2#c x#x)#br^{3#e}", note: "A product in brackets, with an exponent." },
  { math: "2#c^{3#e} \\cdot#d x#x^{3#e2}", note: "The exponent goes to **every factor** in the bracket." },
  { math: "8#c x#x^{3#e2}", note: "$2^3 = 8$, so $(2x)^3 = 8x^3$." },
  {
    math: "(a#a +#p b#b)#br^{2#e} \\ne#ne a#a2^{2#e2} +#p2 b#b2^{2#e3}",
    note: "But only for products! A **sum** in brackets is different: $(a + b)^2 = a^2 + 2ab + b^2$.",
  },
];

const tenFramesLesson: Frame[] = [
  { math: "10#t^{3#e} =#eq 1#v1 \\,000#v2", note: "$10^3$ is a $1$ with three zeros." },
  { math: "10#t^{-#es 3#e} =#eq \\frac{1#o}{1\\,000}#F =#eq2 0,001#v2", note: "A negative exponent gives a small number: $10^{-3} = 0,001$, three places after the comma." },
  { math: "4#m \\,500\\,000", note: "Big numbers are easier to read with powers of ten." },
  { math: "4,5#m \\cdot#d 1#t \\,000\\,000", note: "Move the comma $6$ places to the left: $4,5$. To keep the value, multiply by $1\\,000\\,000$." },
  {
    math: "4,5#m \\cdot#d 10#t^{6#e}",
    note: "$1\\,000\\,000 = 10^6$. This is **scientific notation**: a number from $1$ to below $10$, times a power of ten.",
  },
  { math: "0,00072#s =#eq 7,2#m \\cdot#d 10#t^{-#es 4#e}", note: "Small numbers work the same way. The comma moves $4$ places to the **right**, so the exponent is $-4$." },
];

const rootFramesLesson: Frame[] = [
  { math: "\\sqrt{50#s}#R", note: "How can you simplify $\\sqrt{50}$?" },
  { math: "\\sqrt{25#s \\cdot#d 2#r}#R", note: "Split $50$ into a **square number** times the rest: $50 = 25 \\cdot 2$.", highlight: ["s"] },
  { math: "\\sqrt{25#s}#R0 \\cdot#d \\sqrt{2#r}#R", note: "Take the root of each factor: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$." },
  { math: "5#s \\sqrt{2#r}#R", note: "$\\sqrt{25} = 5$ comes out. So $\\sqrt{50} = 5\\sqrt{2}$. That's called **partially taking the root**." },
  {
    math: "\\sqrt{(-#m 3#a)#br^{2#e}}#R =#eq \\sqrt{9#n}#R2 =#eq2 3#r",
    note: "Careful: $\\sqrt{(-3)^2} = 3$, not $-3$. A square root is never negative. So $\\sqrt{a^2} = |a|$, the absolute value.",
  },
  { math: "\\sqrt{a#a}#R =#eq a#a2^{\\frac{1}{2}#F}", note: "A square root is a power too: $a^{\\frac{1}{2}} \\cdot a^{\\frac{1}{2}} = a^{\\frac{1}{2} + \\frac{1}{2}} = a^1 = a$." },
  { math: "\\sqrt{9 + 16} \\ne \\sqrt{9} + \\sqrt{16}", note: "Never split a root over a **sum**: $\\sqrt{25} = 5$, but $3 + 4 = 7$." },
];

const powersRoots: Topic = {
  ...topicMeta("powers-roots"),
  summary: [
    {
      title: "Same base",
      body: "Multiply: add the exponents. Divide: subtract them. Power of a power: multiply them.",
      examples: ["a^m \\cdot a^n = a^{m+n}", "a^m : a^n = a^{m-n}", "(a^m)^n = a^{m \\cdot n}"],
      tone: "rule",
    },
    { title: "Exponent outside a product", body: "The exponent goes to every factor in the bracket.", examples: ["(a \\cdot b)^n = a^n \\cdot b^n", "(2x)^3 = 8x^3"], tone: "rule" },
    { title: "Zero and negative exponents", body: "A negative exponent means one divided by the power.", examples: ["a^0 = 1", "a^{-n} = \\frac{1}{a^n}", "2^{-3} = \\frac{1}{8}"], tone: "rule" },
    {
      title: "Square roots",
      body: "Split off the biggest square number and take its root (teilweise Wurzelziehen).",
      examples: ["\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}", "\\sqrt{50} = \\sqrt{25 \\cdot 2} = 5\\sqrt{2}", "\\sqrt{a^2} = |a| \\quad \\sqrt{a} = a^{\\frac{1}{2}}"],
      tone: "rule",
    },
    {
      title: "Scientific notation",
      body: "A number from 1 to below 10, times a power of ten. Count how far the comma moves.",
      examples: ["4\\,500\\,000 = 4,5 \\cdot 10^6", "0,00072 = 7,2 \\cdot 10^{-4}"],
      tone: "tip",
    },
    {
      title: "Classic mistakes",
      body: "The exponent counts factors. And the rules only work for products, never for sums.",
      examples: ["2^3 = 8 \\ne 2 \\cdot 3", "(a + b)^2 \\ne a^2 + b^2", "\\sqrt{a + b} \\ne \\sqrt{a} + \\sqrt{b}"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: "Powers: a short way to multiply",
      blob: "Ready? Powers are just lazy multiplication. I like lazy!",
      body: "When the same factor appears again and again, we write it as a **power**.",
      frames: introFrames,
    },
    {
      type: "explain",
      title: "Same base: add the exponents",
      blob: "Let's multiply two powers. Count the factors with me!",
      body: "Write powers out and the rule appears by itself.",
      frames: productFramesLesson,
    },
    {
      type: "widget",
      title: "The power lab",
      blob: "Every tile is one factor a. Press Combine and watch them!",
      body: "Pick a rule, change $m$ and $n$ and press **Combine**. Try $:$ with a bigger $n$ than $m$. What happens?",
      widget: PowerLab,
    },
    {
      type: "check",
      blob: "Your turn! Watch out for the lonely x at the end.",
      exercise: {
        instruction: "Find the exponent n",
        math: "x^4 \\cdot x^5 \\cdot x = x^{\\blob{n}}",
        answer: { kind: "number", value: 10, label: "n =" },
        hint: "A single $x$ counts as $x^1$.",
        solution: productFrames("x", [4, 5, 1]),
      },
    },
    {
      type: "explain",
      title: "Dividing: subtract the exponents",
      blob: "Dividing is cancelling. And it explains the strange exponents 0 and −3!",
      body: "Same base, divided: keep the base and subtract the exponents. The result can be $0$ or negative.",
      frames: quotientFramesLesson,
    },
    {
      type: "check",
      blob: "A negative exponent. What does it mean again?",
      exercise: {
        instruction: "Write as a fraction",
        math: "2^{-3}",
        answer: { kind: "fraction", n: 1, d: 8 },
        hint: "$a^{-n} = \\frac{1}{a^n}$, so $2^{-3} = \\frac{1}{2^3}$.",
        solution: negativeToFractionFrames(2, 3),
      },
    },
    {
      type: "explain",
      title: "Brackets with an exponent",
      blob: "Brackets with an exponent outside. Two rules, one trap!",
      body: "A power of a power: multiply the exponents. A product to a power: every factor gets the exponent.",
      frames: bracketFramesLesson,
    },
    {
      type: "check",
      blob: "Don't forget the 2 in the bracket!",
      exercise: {
        instruction: "Simplify",
        math: "(2x^3)^4 = \\blob{c} x^{\\blob{n}}",
        answer: { kind: "pair", names: ["c", "n"], values: [16, 12] },
        hint: "Both factors get the exponent $4$: $2^4$ and $(x^3)^4$.",
        solution: bracketPowerFrames("x", 2, 3, 4, null),
      },
    },
    {
      type: "explain",
      title: "Powers of ten",
      blob: "Huge and tiny numbers, made easy. Scientists do it like this!",
      body: "Positive exponents make big numbers, negative exponents make small ones.",
      frames: tenFramesLesson,
    },
    {
      type: "check",
      blob: "Count the places the comma moves.",
      exercise: {
        instruction: "Write in scientific notation",
        text: "Write it as $a \\cdot 10^n$ with $1 \\le a < 10$.",
        math: "0,00036 = \\blob{a} \\cdot 10^{\\blob{n}}",
        answer: { kind: "pair", names: ["a", "n"], values: [3.6, -4] },
        hint: "Move the comma to the right until one digit (not $0$) is in front of it. Right means negative.",
        solution: sciFrames("36", -4),
      },
    },
    {
      type: "explain",
      title: "Square roots: pull out squares",
      blob: "Roots undo squares. Let's make them as simple as possible.",
      body: "The rule behind it: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$, for $a, b \\ge 0$.",
      frames: rootFramesLesson,
    },
    {
      type: "widget",
      title: "The root splitter",
      blob: "Find the biggest square inside the number. Try a smaller one too!",
      body: "Pick a square factor. The picture shows the number as equal squares. The side of one square comes out of the root.",
      widget: RootSplitter,
    },
    {
      type: "check",
      blob: "Last one! Which square fits into 72?",
      exercise: {
        instruction: "Simplify the root",
        math: "\\sqrt{72} = \\blob{a} \\sqrt{\\blob{b}}",
        answer: { kind: "pair", names: ["a", "b"], values: [6, 2] },
        hint: "The biggest square number that divides $72$ is $36$.",
        solution: partialRootFrames(72),
      },
    },
  ],
  generate,
};

export default powersRoots;
