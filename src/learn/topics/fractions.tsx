"use client";

import { AnimatePresence, motion, useSpring, useTransform } from "motion/react";
import { ArrowLeft, ArrowRight, Minus, Plus, RotateCcw, Shuffle } from "lucide-react";
import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import { add, div as divF, frac, mul as mulF, sub, type Frac } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Fractions on the board. Every fraction carries its own token keys (numerator,
// denominator, bar), so numbers glide when fractions are expanded, combined,
// flipped or multiplied.

type KF = { n: number; d: number; kn: string; kd: string; kf: string; asFrac?: boolean };

const kf = (n: number, d: number, id: string): KF => ({ n, d, kn: `${id}n`, kd: `${id}d`, kf: `${id}f` });
const isWhole = (f: KF) => f.d === 1 && !f.asFrac;

/** Keyed display source: "\frac{3#an}{4#ad}#af", or "2#an" for a whole number. */
function src(f: KF): string {
  return isWhole(f) ? `${f.n}#${f.kn}` : `\\frac{${f.n}#${f.kn}}{${f.d}#${f.kd}}#${f.kf}`;
}

/** Plain display for notes and tasks: "\frac{3}{4}" or "2". */
const tx = (n: number, d: number) => (d === 1 ? String(n) : `\\frac{${n}}{${d}}`);
const txf = (f: { n: number; d: number }) => tx(f.n, f.d);

/** "2\frac{3}{4}" for an improper fraction. */
function mixedTx(n: number, d: number) {
  const w = Math.floor(n / d);
  const r = n - w * d;
  if (w === 0) return tx(n, d);
  return r === 0 ? String(w) : `${w}\\frac{${r}}{${d}}`;
}

/** A worked solution being written. `pre` and `post` frame the part we're working on. */
type Board = { frames: Frame[]; pre: string; post: string };
const board = (): Board => ({ frames: [], pre: "", post: "" });

function put(b: Board, body: string, note: string, extra: Omit<Frame, "math" | "note"> = {}) {
  b.frames.push({ math: `${b.pre}${body}${b.post}`, note, ...extra });
}

/** Divide top and bottom by their greatest common factor. */
function simplify(b: Board, f: KF): KF {
  const g = gcd(f.n, f.d);
  if (g === 1 || f.d === 1) return f;
  put(
    b,
    `\\frac{${f.n}#${f.kn} :#${f.kf}x ${g}#${f.kf}g}{${f.d}#${f.kd} :#${f.kf}y ${g}#${f.kf}h}#${f.kf}`,
    `Simplify: divide top and bottom by $${g}$.`,
    { highlight: [`${f.kf}g`, `${f.kf}h`] },
  );
  const r: KF = { ...f, n: f.n / g, d: f.d / g, asFrac: false };
  put(b, src(r), r.d === 1 ? `$${f.n} : ${f.d} = ${r.n}$, a whole number.` : `Fully simplified: $${tx(f.n, f.d)} = ${tx(r.n, r.d)}$.`);
  return r;
}

/** How to find the lowest common denominator (Hauptnenner). */
function lcdNote(a: number, b: number): string {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const l = lcm(a, b);
  if (big % small === 0) return `Different denominators. $${small}$ goes into $${big}$, so $${big}$ is the common denominator.`;
  const multiples: number[] = [];
  for (let m = big; m <= l; m += big) multiples.push(m);
  return `Different denominators. Multiples of $${big}$: $${multiples.join(", ")}$. The first one that $${small}$ also goes into is $${l}$.`;
}

/** Adds or subtracts two fractions: common denominator, combine numerators, simplify. Keeps A's keys. */
function addSub(b: Board, A: KF, B: KF, sign: 1 | -1, opKey: string): KF {
  const op = sign > 0 ? "+" : "-";
  const both = (x: KF, y: KF) => `${src(x)} ${op}#${opKey} ${src(y)}`;
  if (A.d !== B.d) {
    const l = lcm(A.d, B.d);
    put(b, both(A, B), lcdNote(A.d, B.d), { highlight: [A.kd, B.kd] });
    const ka = l / A.d;
    const kb = l / B.d;
    const ex = (f: KF, k: number) =>
      k === 1 ? src(f) : `\\frac{${f.n}#${f.kn} \\cdot#${f.kf}p ${k}#${f.kf}k}{${f.d}#${f.kd} \\cdot#${f.kf}q ${k}#${f.kf}l}#${f.kf}`;
    const which = [ka > 1 ? `$${src0(A)}$ by $${ka}$` : "", kb > 1 ? `$${src0(B)}$ by $${kb}$` : ""].filter(Boolean).join(" and ");
    const lit = [...(ka > 1 ? [`${A.kf}k`, `${A.kf}l`] : []), ...(kb > 1 ? [`${B.kf}k`, `${B.kf}l`] : [])];
    put(b, `${ex(A, ka)} ${op}#${opKey} ${ex(B, kb)}`, `Expand ${which}: multiply top and bottom by the same number.`, { highlight: lit });
    A = { ...A, n: A.n * ka, d: l, asFrac: true };
    B = { ...B, n: B.n * kb, d: l, asFrac: true };
    put(b, both(A, B), `Now both fractions have the denominator $${l}$.`, { highlight: [A.kd, B.kd] });
  }
  put(
    b,
    `\\frac{${A.n}#${A.kn} ${op}#${opKey} ${B.n}#${B.kn}}{${A.d}#${A.kd}}#${A.kf}`,
    sign > 0 ? "Same denominator: add the numerators, keep the denominator." : "Same denominator: subtract the numerators, keep the denominator.",
  );
  const r: KF = { ...A, n: A.n + sign * B.n, asFrac: false };
  put(b, src(r), `$${A.n} ${op} ${B.n} = ${r.n}$.`);
  return simplify(b, r);
}

/** Plain text of a board fraction for notes. */
const src0 = (f: KF) => (isWhole(f) ? String(f.n) : `\\frac{${f.n}}{${f.d}}`);

/** Multiplies: whole numbers over 1, simplify crosswise, top times top and bottom times bottom. */
function mul(b: Board, A: KF, B: KF, opKey: string): KF {
  const both = (x: KF, y: KF) => `${src(x)} \\cdot#${opKey} ${src(y)}`;
  if (isWhole(A) || isWhole(B)) {
    const w = isWhole(A) ? A : B;
    A = { ...A, asFrac: true };
    B = { ...B, asFrac: true };
    put(b, both(A, B), `Write the whole number as a fraction: $${w.n} = \\frac{${w.n}}{1}$.`, { highlight: [w.kd] });
  }
  let first = true;
  for (const pass of [1, 2]) {
    const top = pass === 1 ? A : B;
    const bottom = pass === 1 ? B : A;
    const g = gcd(top.n, bottom.d);
    if (g === 1) continue;
    put(
      b,
      both(A, B),
      `${first ? "Before multiplying, simplify crosswise. " : ""}$${top.n}$ and $${bottom.d}$ are both divisible by $${g}$.`,
      { highlight: [top.kn, bottom.kd] },
    );
    const nt = top.n / g;
    const nb = bottom.d / g;
    if (pass === 1) {
      A = { ...A, n: nt };
      B = { ...B, d: nb };
    } else {
      B = { ...B, n: nt };
      A = { ...A, d: nb };
    }
    put(b, both(A, B), `$${top.n} : ${g} = ${nt}$ and $${bottom.d} : ${g} = ${nb}$.`, { highlight: [top.kn, bottom.kd] });
    first = false;
  }
  put(
    b,
    `\\frac{${A.n}#${A.kn} \\cdot#${opKey} ${B.n}#${B.kn}}{${A.d}#${A.kd} \\cdot#${A.kf}b ${B.d}#${B.kd}}#${A.kf}`,
    "Top times top, bottom times bottom.",
  );
  const r: KF = { ...A, n: A.n * B.n, d: A.d * B.d, asFrac: false };
  put(
    b,
    src(r),
    r.d === 1 ? `$${A.n} \\cdot ${B.n} = ${r.n}$ and $${A.d} \\cdot ${B.d} = 1$: a whole number.` : `$${A.n} \\cdot ${B.n} = ${r.n}$ and $${A.d} \\cdot ${B.d} = ${r.d}$.`,
  );
  return simplify(b, r);
}

/** Divides: multiply by the reciprocal (Kehrwert) of the second number. */
function div(b: Board, A: KF, B: KF, opKey: string, lead?: string): KF {
  put(b, `${src(A)} :#${opKey} ${src(B)}`, lead ?? "To divide, multiply by the **reciprocal** (Kehrwert): flip the second fraction upside down.", {
    highlight: [opKey],
  });
  if (isWhole(B)) {
    B = { ...B, asFrac: true };
    put(b, `${src(A)} :#${opKey} ${src(B)}`, `Write $${B.n}$ as $\\frac{${B.n}}{1}$.`, { highlight: [B.kd] });
  }
  const R: KF = { n: B.d, d: B.n, kn: B.kd, kd: B.kn, kf: B.kf, asFrac: true };
  const dot = `${opKey}m`;
  put(b, `${src(A)} \\cdot#${dot} ${src(R)}`, `Flip $\\frac{${B.n}}{${B.d}}$ to $\\frac{${R.n}}{${R.d}}$ and turn $:$ into $\\cdot$.`, {
    highlight: [R.kn, R.kd, dot],
  });
  return mul(b, A, R, dot);
}

/** "3/4 of 28 kg": divide by the denominator, multiply by the numerator. */
function ofSteps(b: Board, n: number, d: number, q: number, unit: string) {
  const u = unit ? ` "${unit}"#u` : "";
  const unitText = unit ? ` ${unit}` : "";
  const one = q / d;
  put(b, `\\frac{${n}#n}{${d}#d}#f \\cdot#t ${q}#q${u}`, "**Of** means times.");
  put(b, `${q}#q :#dv ${d}#d \\cdot#t ${n}#n`, "Divide by the denominator, then multiply by the numerator.", { highlight: ["dv", "d"] });
  if (n === 1) {
    put(b, `${one}#q${u}`, `$${q} : ${d} = ${one}$${unitText}.`);
    return;
  }
  put(b, `${one}#q \\cdot#t ${n}#n`, `$${q} : ${d} = ${one}$. That's $\\frac{1}{${d}}$ of $${q}$.`);
  put(b, `${one * n}#q${u}`, `$${one} \\cdot ${n} = ${one * n}$${unitText}.`);
}

/** Adds a sentence to the note of the last frame. */
function appendNote(frames: Frame[], text: string) {
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, note: last.note ? `${last.note} ${text}` : text };
}

/** Closes a worked solution: lowest terms, and the mixed-number form of an improper result. */
function finish(frames: Frame[], r: Frac) {
  const last = frames[frames.length - 1].note ?? "";
  if (r.d > 1 && !/simplified/i.test(last)) appendNote(frames, "Already in lowest terms.");
  if (r.d > 1 && r.n > r.d) appendNote(frames, `As a mixed number: $${mixedTx(r.n, r.d)}$.`);
}

// Mixed numbers (w = 0 means a plain fraction).
type MixedN = { w: number; n: number; d: number; id: string };
const mSrc = (m: MixedN) => `${m.w ? `${m.w}#${m.id}w ` : ""}\\frac{${m.n}#${m.id}n}{${m.d}#${m.id}d}#${m.id}f`;
const mWork = (m: MixedN) =>
  m.w ? `\\frac{${m.w}#${m.id}w \\cdot#${m.id}x ${m.d}#${m.id}k +#${m.id}p ${m.n}#${m.id}n}{${m.d}#${m.id}d}#${m.id}f` : mSrc(m);
const mImproper = (m: MixedN): KF => ({ n: m.w * m.d + m.n, d: m.d, kn: `${m.id}n`, kd: `${m.id}d`, kf: `${m.id}f` });
const mTx = (m: MixedN) => `${m.w ? m.w : ""}\\frac{${m.n}}{${m.d}}`;

// ---------------------------------------------------------------------------
// Exercise generator

type Gen = (rng: Rng) => Exercise | null;
type Visual = NonNullable<Exercise["visual"]>;

function pickWeighted(rng: Rng, list: [number, Gen][]): Gen {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, g] of list) {
    r -= w;
    if (r < 0) return g;
  }
  return list[list.length - 1][1];
}

/** A numerator in [lo, hi] with no common factor with d. */
function coprime(rng: Rng, d: number, lo: number, hi: number): number | null {
  const options: number[] = [];
  for (let n = lo; n <= hi; n++) if (gcd(n, d) === 1) options.push(n);
  return options.length ? rng.pick(options) : null;
}

/** A fraction in lowest terms (proper, or improper if asked). */
function randFrac(rng: Rng, dens: number[], improper = false): Frac | null {
  const d = rng.pick(dens);
  const n = improper ? coprime(rng, d, d + 1, 2 * d - 1) : coprime(rng, d, 1, d - 1);
  return n === null ? null : { n, d };
}

function fracAnswer(r: Frac): AnswerSpec {
  return r.d === 1 ? { kind: "number", value: r.n } : { kind: "fraction", n: r.n, d: r.d, mustReduce: true };
}

const smallestPrime = (k: number) => [2, 3, 5, 7].find((p) => k % p === 0) ?? k;
const picture = (n: number, d: number, shape: "bar" | "circle"): Visual => ({
  component: FractionPicture as unknown as ComponentType<Record<string, unknown>>,
  props: { n, d, shape },
});

// Level 1 ---------------------------------------------------------------------

function simplifyTask(rng: Rng): Exercise | null {
  const d0 = rng.int(2, 10);
  const n0 = rng.chance(0.15) ? coprime(rng, d0, d0 + 1, 2 * d0 - 1) : coprime(rng, d0, 1, d0 - 1);
  const k = rng.int(2, 9);
  if (n0 === null) return null;
  const n = n0 * k;
  const d = d0 * k;
  if (d > 90 || n < 4) return null;
  const b = board();
  const A = kf(n, d, "a");
  put(b, src(A), `Find the largest number that divides both $${n}$ and $${d}$. Here it's $${k}$.`, { highlight: [A.kn, A.kd] });
  simplify(b, A);
  finish(b.frames, { n: n0, d: d0 });
  return {
    instruction: "Simplify fully",
    math: tx(n, d),
    answer: fracAnswer({ n: n0, d: d0 }),
    hint: `Which number divides both $${n}$ and $${d}$? You can also go in small steps, e.g. divide by $${smallestPrime(k)}$ first.`,
    solution: b.frames,
  };
}

function gapTask(rng: Rng): Exercise | null {
  const d = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const n = coprime(rng, d, 1, d - 1);
  const k = rng.int(2, 8);
  if (n === null || d * k > 80) return null;
  const expand = rng.chance(0.6);
  const gapTop = rng.chance(0.6);
  const [ln, ld, rn, rd] = expand ? [n, d, n * k, d * k] : [n * k, d * k, n, d];
  const opT = expand ? "\\cdot" : ":";
  const left = (inner = "") => `\\frac{${ln}#an${inner ? ` ${opT}#ao ${k}#ak` : ""}}{${ld}#ad${inner ? ` ${opT}#do ${k}#dk` : ""}}#af`;
  const right = (filled: boolean) =>
    gapTop
      ? `\\frac{${filled ? `${rn}#q` : "\\box{?#q}"}}{${rd}#bd}#bf`
      : `\\frac{${rn}#bn}{${filled ? `${rd}#q` : "\\box{?#q}"}}#bf`;
  const [knownL, knownR] = gapTop ? [ld, rd] : [ln, rn];
  const b = board();
  put(b, `${left()} =#eq ${right(false)}`, `From $${knownL}$ to $${knownR}$: that's $${opT} ${k}$.`, { highlight: gapTop ? ["ad", "bd"] : ["an", "bn"] });
  put(
    b,
    `${left("x")} =#eq ${right(false)}`,
    expand ? "Expanding: multiply top **and** bottom by the same number." : "Simplifying: divide top **and** bottom by the same number.",
    { highlight: ["ak", "dk"] },
  );
  const [from, to] = gapTop ? [ln, rn] : [ld, rd];
  put(b, `${left()} =#eq ${right(true)}`, `$${from} ${opT} ${k} = ${to}$. So $${tx(ln, ld)} = ${tx(rn, rd)}$.`, { highlight: ["q"] });
  return {
    instruction: "Fill in the gap",
    math: `${tx(ln, ld)} = \\frac{${gapTop ? "\\box{?}" : rn}}{${gapTop ? rd : "\\box{?}"}}`,
    answer: { kind: "number", value: to },
    hint: gapTop
      ? `Compare the denominators. What do you ${expand ? "multiply" : "divide"} $${ld}$ by to get $${rd}$?`
      : `Compare the numerators. What do you ${expand ? "multiply" : "divide"} $${ln}$ by to get $${rn}$?`,
    solution: b.frames,
  };
}

function sameDenTask(rng: Rng): Exercise | null {
  const d = rng.int(3, 12);
  const sign: 1 | -1 = rng.chance(0.6) ? 1 : -1;
  let x = rng.int(1, d - 1);
  let y = rng.int(1, d - 1);
  if (sign < 0 && x < y) [x, y] = [y, x];
  const r = frac(x + sign * y, d);
  if (r.n <= 0 || r.d === 1) return null;
  const A = kf(x, d, "a");
  const B = kf(y, d, "b");
  const op = sign > 0 ? "+" : "-";
  const b = board();
  put(b, `${src(A)} ${op}#op ${src(B)}`, "Both fractions have the same denominator. Good news!", { highlight: [A.kd, B.kd] });
  addSub(b, A, B, sign, "op");
  finish(b.frames, r);
  return {
    instruction: "Calculate and simplify",
    math: `${tx(x, d)} ${op} ${tx(y, d)}`,
    answer: fracAnswer(r),
    hint: `Same denominator: ${sign > 0 ? "add" : "subtract"} the numerators and keep the denominator. Then simplify if you can.`,
    solution: b.frames,
  };
}

const OF_STORIES: { unit: string; scale: number; max: number; text: (f: string, q: number) => string }[] = [
  { unit: "students", scale: 1, max: 32, text: (f, q) => `A class has ${q} students. ${f} of them come to school by bike. How many students is that?` },
  { unit: "€", scale: 1, max: 120, text: (f, q) => `Mia gets ${q} € for her birthday. She saves ${f} of it. How much money does she save?` },
  { unit: "km", scale: 1, max: 90, text: (f, q) => `A bike tour is ${q} km long. By the lunch break, ${f} of the tour is done. How many kilometres is that?` },
  { unit: "g", scale: 50, max: 1000, text: (f, q) => `A bag of flour holds ${q} g. A cake needs ${f} of it. How many grams is that?` },
  { unit: "pages", scale: 10, max: 400, text: (f, q) => `Ben's book has ${q} pages. He has read ${f} of it. How many pages has he read?` },
  { unit: "members", scale: 1, max: 120, text: (f, q) => `A sports club has ${q} members. ${f} of them play football. How many members is that?` },
];

function ofTask(rng: Rng): Exercise | null {
  const d = rng.pick([2, 3, 4, 5, 6, 8, 10]);
  const n = coprime(rng, d, 1, d - 1);
  if (n === null) return null;
  const story = rng.pick(OF_STORIES);
  const q = d * rng.int(2, 12) * story.scale;
  if (q > story.max || q < 6) return null;
  const asText = rng.chance(0.5);
  const b = board();
  ofSteps(b, n, d, q, asText ? story.unit : "");
  return {
    instruction: asText ? "Word problem" : "Calculate",
    ...(asText ? { text: story.text(`$${tx(n, d)}$`, q) } : { math: `${tx(n, d)} "of" ${q}` }),
    answer: { kind: "number", value: (q / d) * n, ...(asText ? { unit: story.unit } : {}) },
    hint: `First find $\\frac{1}{${d}}$ of $${q}$: divide by $${d}$. Then multiply by $${n}$.`,
    solution: b.frames,
  };
}

function pictureTask(rng: Rng): Exercise | null {
  const d = rng.pick([4, 6, 8, 9, 10, 12]);
  const n = rng.int(1, d - 1);
  if (gcd(n, d) === 1 && rng.chance(0.75)) return null;
  const shape = rng.chance(0.55) ? "bar" : "circle";
  const r = frac(n, d);
  const b = board();
  const A = kf(n, d, "a");
  put(b, src(A), `Count: $${n}$ of the $${d}$ equal parts are shaded. That's $${tx(n, d)}$.`, { highlight: [A.kn, A.kd] });
  simplify(b, A);
  if (r.d === d) appendNote(b.frames, "It can't be simplified any further.");
  return {
    instruction: "Name the shaded part",
    text: "What fraction of the shape is shaded? Simplify fully.",
    answer: fracAnswer(r),
    hint: "Count all the equal parts (denominator) and the shaded ones (numerator). Then simplify.",
    solution: b.frames,
    visual: picture(n, d, shape),
  };
}

// Level 2 ---------------------------------------------------------------------

const DENS = [2, 3, 4, 5, 6, 8, 9, 10, 12];

function addTask(rng: Rng): Exercise | null {
  const A = randFrac(rng, DENS);
  const B = randFrac(rng, DENS);
  if (!A || !B || A.d === B.d || lcm(A.d, B.d) > 36) return null;
  const sign: 1 | -1 = rng.chance(0.55) ? 1 : -1;
  let [P, Q] = [A, B];
  if (sign < 0 && P.n / P.d < Q.n / Q.d) [P, Q] = [Q, P];
  const r = sign > 0 ? add(P, Q) : sub(P, Q);
  if (r.n <= 0 || r.d === 1) return null;
  const op = sign > 0 ? "+" : "-";
  const b = board();
  addSub(b, kf(P.n, P.d, "a"), kf(Q.n, Q.d, "b"), sign, "op");
  finish(b.frames, r);
  return {
    instruction: "Calculate and simplify",
    math: `${txf(P)} ${op} ${txf(Q)}`,
    answer: fracAnswer(r),
    hint: `Find the lowest common denominator of $${P.d}$ and $${Q.d}$ first. Then expand both fractions.`,
    solution: b.frames,
  };
}

function mulTask(rng: Rng): Exercise | null {
  let A: Frac | null;
  let B: Frac | null;
  const withWhole = rng.chance(0.25);
  if (withWhole) {
    const k = rng.int(2, 9);
    B = randFrac(rng, [3, 4, 5, 6, 7, 8, 9, 10, 12]);
    if (!B || (gcd(k, B.d) === 1 && rng.chance(0.75))) return null;
    A = { n: k, d: 1 };
    if (rng.chance(0.4)) [A, B] = [B, A];
  } else {
    A = randFrac(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12], rng.chance(0.2));
    B = randFrac(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12], rng.chance(0.2));
    if (!A || !B) return null;
    const cross = gcd(A.n, B.d) > 1 || gcd(B.n, A.d) > 1;
    if (!cross && rng.chance(0.8)) return null;
  }
  const r = mulF(frac(A.n, A.d), frac(B.n, B.d));
  if (r.d === 1 || r.d > 60 || r.n > 60) return null;
  const b = board();
  const X = kf(A.n, A.d, "a");
  const Y = kf(B.n, B.d, "b");
  const cross = gcd(A.n, B.d) > 1 || gcd(B.n, A.d) > 1;
  put(
    b,
    `${src(X)} \\cdot#op ${src(Y)}`,
    cross || withWhole ? "Multiplying fractions: no common denominator needed." : "No common denominator needed, and nothing to simplify crosswise here.",
  );
  mul(b, X, Y, "op");
  finish(b.frames, r);
  return {
    instruction: "Calculate and simplify",
    math: `${txf(A)} \\cdot ${txf(B)}`,
    answer: fracAnswer(r),
    hint: withWhole
      ? "Write the whole number as a fraction with denominator $1$. Then top times top, bottom times bottom."
      : cross
        ? "Simplify crosswise first: a numerator and the **other** denominator share a factor."
        : "Top times top, bottom times bottom.",
    solution: b.frames,
  };
}

function divTask(rng: Rng): Exercise | null {
  let A: Frac | null;
  let B: Frac | null;
  if (rng.chance(0.25)) {
    A = randFrac(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10], rng.chance(0.2));
    const k = rng.int(2, 6);
    if (!A || (gcd(A.n, k) === 1 && rng.chance(0.7))) return null;
    B = { n: k, d: 1 };
  } else {
    A = randFrac(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12], rng.chance(0.2));
    B = randFrac(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12], rng.chance(0.2));
    if (!A || !B || (A.n === B.n && A.d === B.d)) return null;
    const cross = gcd(A.n, B.n) > 1 || gcd(A.d, B.d) > 1;
    if (!cross && rng.chance(0.8)) return null;
  }
  const r = divF(frac(A.n, A.d), frac(B.n, B.d));
  if (r.d === 1 || r.d > 60 || r.n > 60) return null;
  const b = board();
  div(b, kf(A.n, A.d, "a"), kf(B.n, B.d, "b"), "op");
  finish(b.frames, r);
  return {
    instruction: "Calculate and simplify",
    math: `${txf(A)} : ${txf(B)}`,
    answer: fracAnswer(r),
    hint: B.d === 1 ? `Dividing by $${B.n}$ is the same as multiplying by $\\frac{1}{${B.n}}$.` : `Multiply by the reciprocal: $${txf(B)}$ becomes $${tx(B.d, B.n)}$.`,
    solution: b.frames,
  };
}

const SUM_STORIES: ((f1: string, f2: string) => string)[] = [
  (f1, f2) => `Leon reads ${f1} of his book on Monday and ${f2} of it on Tuesday. What fraction of the book has he read so far?`,
  (f1, f2) => `In a garden, ${f1} of the area is used for vegetables and ${f2} for flowers. What fraction of the garden is used?`,
  (f1, f2) => `On a hike, Emma walks ${f1} of the route before lunch and ${f2} of it after lunch. What fraction of the route has she walked?`,
];
const DIFF_STORIES: ((f1: string, f2: string) => string)[] = [
  (f1, f2) => `A jug holds ${f1} l of juice. Tim pours ${f2} l into a glass. How many litres are left in the jug?`,
  (f1, f2) => `A path is ${f1} km long. Sara has already walked ${f2} km. How far does she still have to go (in km)?`,
];

function storyAddTask(rng: Rng): Exercise | null {
  const A = randFrac(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
  const B = randFrac(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
  if (!A || !B || A.d === B.d || lcm(A.d, B.d) > 30) return null;
  const sign: 1 | -1 = rng.chance(0.6) ? 1 : -1;
  let [P, Q] = [A, B];
  if (sign < 0 && P.n / P.d < Q.n / Q.d) [P, Q] = [Q, P];
  const r = sign > 0 ? add(P, Q) : sub(P, Q);
  if (r.n <= 0 || r.d === 1 || (sign > 0 && r.n >= r.d) || r.n / r.d < 0.15) return null;
  const story = rng.pick(sign > 0 ? SUM_STORIES : DIFF_STORIES);
  const op = sign > 0 ? "+" : "-";
  const b = board();
  const X = kf(P.n, P.d, "a");
  const Y = kf(Q.n, Q.d, "b");
  put(b, `${src(X)} ${op}#op ${src(Y)}`, sign > 0 ? "Both parts together: add them." : "Take the second amount away: subtract.");
  addSub(b, X, Y, sign, "op");
  finish(b.frames, r);
  return {
    instruction: "Word problem",
    text: story(`$${txf(P)}$`, `$${txf(Q)}$`),
    answer: fracAnswer(r),
    hint: `${sign > 0 ? "Add" : "Subtract"} the two fractions. You need a common denominator first.`,
    solution: b.frames,
  };
}

// Level 3 ---------------------------------------------------------------------

function mixedTask(rng: Rng): Exercise | null {
  const op = rng.pick(["+", "-", "*", ":"] as const);
  const muldiv = op === "*" || op === ":";
  const make = (id: string, maxW: number, plainOk: boolean): MixedN | null => {
    const d = rng.pick(muldiv ? [2, 3, 4, 5, 6] : [2, 3, 4, 5, 6, 8, 10, 12]);
    const n = coprime(rng, d, 1, d - 1);
    if (n === null) return null;
    return { w: plainOk && rng.chance(0.35) ? 0 : rng.int(1, maxW), n, d, id };
  };
  const M1 = make("a", muldiv ? 3 : 5, false);
  const M2 = make("b", 3, muldiv);
  if (!M1 || !M2) return null;
  if (!muldiv && lcm(M1.d, M2.d) > 24) return null;
  const v1 = frac(M1.w * M1.d + M1.n, M1.d);
  const v2 = frac(M2.w * M2.d + M2.n, M2.d);
  const r = op === "+" ? add(v1, v2) : op === "-" ? sub(v1, v2) : op === "*" ? mulF(v1, v2) : divF(v1, v2);
  if (r.n <= 0 || r.d === 1 || r.n > 200 || r.d > 72) return null;
  const sym = op === "+" ? "+" : op === "-" ? "-" : op === "*" ? "\\cdot" : ":";
  const mixed = [M1, M2].filter((m) => m.w > 0);
  const b = board();
  put(
    b,
    `${mSrc(M1)} ${sym}#op ${mSrc(M2)}`,
    mixed.length > 1 ? "First turn both mixed numbers into improper fractions." : "First turn the mixed number into an improper fraction.",
    { highlight: mixed.map((m) => `${m.id}w`) },
  );
  put(b, `${mWork(M1)} ${sym}#op ${mWork(M2)}`, "Whole number times denominator, plus numerator.", { highlight: mixed.flatMap((m) => [`${m.id}w`, `${m.id}k`]) });
  const X = mImproper(M1);
  const Y = mImproper(M2);
  put(b, `${src(X)} ${sym}#op ${src(Y)}`, `${mixed.map((m) => `$${m.w} \\cdot ${m.d} + ${m.n} = ${m.w * m.d + m.n}$`).join(" and ")}.`);
  if (op === "+" || op === "-") addSub(b, X, Y, op === "+" ? 1 : -1, "op");
  else if (op === "*") mul(b, X, Y, "op");
  else div(b, X, Y, "op");
  finish(b.frames, r);
  return {
    instruction: "Calculate",
    math: `${mTx(M1)} ${sym} ${mTx(M2)}`,
    answer: fracAnswer(r),
    hint: "Turn mixed numbers into improper fractions first: whole number times denominator, plus numerator. The answer can be an improper fraction.",
    solution: b.frames,
  };
}

function orderTask(rng: Rng): Exercise | null {
  const X = randFrac(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
  const Y = randFrac(rng, [2, 3, 4, 5, 6, 8, 9], rng.chance(0.2));
  const Z = randFrac(rng, [2, 3, 4, 5, 6, 8, 9]);
  if (!X || !Y || !Z) return null;
  const times = rng.chance(0.55);
  const sign: 1 | -1 = rng.chance(0.6) ? 1 : -1;
  const P = times ? mulF(Y, Z) : divF(Y, Z);
  const cross = times ? gcd(Y.n, Z.d) > 1 || gcd(Z.n, Y.d) > 1 : gcd(Y.n, Z.n) > 1 || gcd(Y.d, Z.d) > 1;
  if (!cross || P.d === 1 || P.n > 30) return null;
  const r = sign > 0 ? add(X, P) : sub(X, P);
  if (r.n <= 0 || r.d === 1 || lcm(X.d, P.d) > 36 || r.d > 48) return null;
  const isym = times ? "\\cdot" : ":";
  const osym = sign > 0 ? "+" : "-";
  const XK = kf(X.n, X.d, "a");
  const YK = kf(Y.n, Y.d, "b");
  const ZK = kf(Z.n, Z.d, "c");
  const b = board();
  put(b, `${src(XK)} ${osym}#o1 ${src(YK)} ${isym}#o2 ${src(ZK)}`, "Multiplication and division come first (**Punkt vor Strich**).", {
    highlight: [YK.kn, YK.kd, "o2", ZK.kn, ZK.kd],
  });
  b.pre = `${src(XK)} ${osym}#o1 `;
  const PK = times ? mul(b, YK, ZK, "o2") : div(b, YK, ZK, "o2");
  b.pre = "";
  addSub(b, XK, PK, sign, "o1");
  finish(b.frames, r);
  return {
    instruction: "Calculate",
    math: `${txf(X)} ${osym} ${txf(Y)} ${isym} ${txf(Z)}`,
    answer: fracAnswer(r),
    hint: `Punkt vor Strich: work out $${txf(Y)} ${isym} ${txf(Z)}$ first.`,
    solution: b.frames,
  };
}

function bracketTask(rng: Rng): Exercise | null {
  const X = randFrac(rng, [2, 3, 4, 5, 6, 8, 10]);
  const Y = randFrac(rng, [2, 3, 4, 5, 6, 8, 10]);
  const Z = randFrac(rng, [2, 3, 4, 5, 6, 7, 8, 9], rng.chance(0.25));
  if (!X || !Y || !Z || X.d === Y.d || lcm(X.d, Y.d) > 24) return null;
  const sign: 1 | -1 = rng.chance(0.6) ? 1 : -1;
  let [P, Q] = [X, Y];
  if (sign < 0 && P.n / P.d < Q.n / Q.d) [P, Q] = [Q, P];
  const S = sign > 0 ? add(P, Q) : sub(P, Q);
  if (S.n <= 0 || S.d === 1) return null;
  const times = rng.chance(0.5);
  const r = times ? mulF(S, Z) : divF(S, Z);
  const cross = times ? gcd(S.n, Z.d) > 1 || gcd(Z.n, S.d) > 1 : gcd(S.n, Z.n) > 1 || gcd(S.d, Z.d) > 1;
  if (!cross || r.d === 1 || r.n > 60 || r.d > 60) return null;
  const osym = sign > 0 ? "+" : "-";
  const isym = times ? "\\cdot" : ":";
  const PK = kf(P.n, P.d, "a");
  const QK = kf(Q.n, Q.d, "b");
  const ZK = kf(Z.n, Z.d, "c");
  const b = board();
  put(b, `(${src(PK)} ${osym}#o1 ${src(QK)})#br ${isym}#o2 ${src(ZK)}`, "Brackets first.", { highlight: ["br(", "br)"] });
  b.pre = "(";
  b.post = `)#br ${isym}#o2 ${src(ZK)}`;
  const SK = addSub(b, PK, QK, sign, "o1");
  b.pre = "";
  b.post = "";
  if (times) {
    put(b, `${src(SK)} \\cdot#o2 ${src(ZK)}`, "The bracket is a single fraction now, so the brackets can go.");
    mul(b, SK, ZK, "o2");
  } else {
    div(b, SK, ZK, "o2", "The bracket is a single fraction now, so the brackets can go. To divide, multiply by the reciprocal.");
  }
  finish(b.frames, r);
  return {
    instruction: "Calculate",
    math: `(${txf(P)} ${osym} ${txf(Q)}) ${isym} ${txf(Z)}`,
    answer: fracAnswer(r),
    hint: "Work out the bracket first. Then multiply or divide.",
    solution: b.frames,
  };
}

function doubleTask(rng: Rng): Exercise | null {
  const A = randFrac(rng, [2, 3, 4, 5, 6, 8, 9, 10], rng.chance(0.2));
  let B = randFrac(rng, [2, 3, 4, 5, 6, 8, 9, 10], rng.chance(0.2));
  if (rng.chance(0.25)) B = { n: rng.int(2, 6), d: 1 };
  if (!A || !B || (A.n === B.n && A.d === B.d)) return null;
  const cross = gcd(A.n, B.n) > 1 || gcd(A.d, B.d) > 1;
  if (!cross && rng.chance(0.8)) return null;
  const r = divF(frac(A.n, A.d), frac(B.n, B.d));
  if (r.d === 1 || r.n > 60 || r.d > 60) return null;
  const X = kf(A.n, A.d, "a");
  const Y = kf(B.n, B.d, "b");
  const b = board();
  // Thin spaces make the main fraction bar visibly longer than the inner ones.
  put(b, `\\frac{\\,\\, ${src(X)} \\,\\,}{\\,\\, ${src(Y)} \\,\\,}#big`, "A **double fraction** (Doppelbruch). The long fraction bar means: divide.", { highlight: ["big-bar"] });
  div(b, X, Y, "op", "Write it as a division: top $:$ bottom. Then multiply by the reciprocal (Kehrwert).");
  finish(b.frames, r);
  return {
    instruction: "Simplify the double fraction",
    math: `\\frac{\\,\\, ${txf(A)} \\,\\,}{\\,\\, ${txf(B)} \\,\\,}`,
    answer: fracAnswer(r),
    hint: "The long bar means divide: top fraction $:$ bottom fraction. Then multiply by the reciprocal.",
    solution: b.frames,
  };
}

const LEFT_STORIES: ((f1: string, f2: string) => string)[] = [
  (f1, f2) => `Tim eats ${f1} of a pizza and Ali eats ${f2} of it. What fraction of the pizza is left?`,
  (f1, f2) => `In class 7c, ${f1} of the students walk to school and ${f2} take the bus. The rest come by bike. What fraction of the class comes by bike?`,
  (f1, f2) => `Jana spends ${f1} of her pocket money on clothes and ${f2} on snacks. What fraction of her pocket money is left?`,
];

function leftoverTask(rng: Rng): Exercise | null {
  const A = randFrac(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
  const B = randFrac(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
  if (!A || !B || A.d === B.d || lcm(A.d, B.d) > 24) return null;
  const S = add(A, B);
  if (S.n >= S.d) return null;
  const r = sub(frac(1), S);
  const X = kf(A.n, A.d, "a");
  const Y = kf(B.n, B.d, "b");
  const b = board();
  put(b, `${src(X)} +#op ${src(Y)}`, "First add up the two parts that are gone.");
  const SK = addSub(b, X, Y, 1, "op");
  const O: KF = { n: SK.d, d: SK.d, kn: "on", kd: "od", kf: "of", asFrac: true };
  put(b, `1#on -#m ${src(SK)}`, "The whole is $1$. Subtract what's gone.");
  put(b, `${src(O)} -#m ${src(SK)}`, `Write the whole as $1 = ${tx(SK.d, SK.d)}$.`, { highlight: ["on", "od"] });
  addSub(b, O, SK, -1, "m");
  finish(b.frames, r);
  return {
    instruction: "Word problem",
    text: rng.pick(LEFT_STORIES)(`$${txf(A)}$`, `$${txf(B)}$`),
    answer: fracAnswer(r),
    hint: "Add the two parts. The rest is $1$ minus that sum.",
    solution: b.frames,
  };
}

const MONEY_STORIES: { text: (q: number, f1: string, f2: string) => string; first: string; second: string }[] = [
  {
    text: (q, f1, f2) => `Lena gets ${q} € pocket money. She spends ${f1} of it on a book and ${f2} of it on a cinema ticket. How much money does she have left?`,
    first: "The book",
    second: "The cinema ticket",
  },
  {
    text: (q, f1, f2) => `A class trip costs ${q} € per student. The parents pay ${f1} of it and the school pays ${f2}. The student pays the rest. How much is that?`,
    first: "The parents",
    second: "The school",
  },
  {
    text: (q, f1, f2) => `Max earns ${q} € at a weekend job. He saves ${f1} of it and spends ${f2} on a video game. How much money is left?`,
    first: "Saved",
    second: "The game",
  },
];

function moneyLeftTask(rng: Rng): Exercise | null {
  const A = randFrac(rng, [2, 3, 4, 5, 6, 8, 10]);
  const B = randFrac(rng, [2, 3, 4, 5, 6, 8, 10]);
  if (!A || !B || A.d === B.d) return null;
  const l = lcm(A.d, B.d);
  const q = l * rng.int(1, 6);
  if (q > 120 || q < 12) return null;
  const sa = (q / A.d) * A.n;
  const sb = (q / B.d) * B.n;
  const left = q - sa - sb;
  if (left <= 0) return null;
  const story = rng.pick(MONEY_STORIES);
  const part = (n: number, d: number) => (n === 1 ? `$${q} : ${d} = ${(q / d) * n}$` : `$${q} : ${d} \\cdot ${n} = ${(q / d) * n}$`);
  const b = board();
  put(b, `${src(kf(A.n, A.d, "a"))} "of"#o1 ${q}#q1 "€"#u1 =#e1 ${sa}#ra "€"#ua`, `${story.first}: ${part(A.n, A.d)} €.`);
  put(b, `${src(kf(B.n, B.d, "b"))} "of"#o2 ${q}#q2 "€"#u2 =#e2 ${sb}#rb "€"#ub`, `${story.second}: ${part(B.n, B.d)} €.`);
  put(b, `${q}#q "€"#u -#s1 ${sa}#ra "€"#ua -#s2 ${sb}#rb "€"#ub =#e3 ${left}#r "€"#ur`, `Subtract both parts from the total: $${left}$ € are left.`, {
    highlight: ["r"],
  });
  return {
    instruction: "Word problem",
    text: story.text(q, `$${txf(A)}$`, `$${txf(B)}$`),
    answer: { kind: "number", value: left, unit: "€" },
    hint: "Work out each part in euros first: divide by the denominator, multiply by the numerator. Then subtract both parts from the total.",
    solution: b.frames,
  };
}

const LEVELS: Record<Level, [number, Gen][]> = {
  1: [
    [3, simplifyTask],
    [2, gapTask],
    [3, sameDenTask],
    [3, ofTask],
    [2, pictureTask],
  ],
  2: [
    [4, addTask],
    [3, mulTask],
    [3, divTask],
    [2, storyAddTask],
  ],
  3: [
    [4, mixedTask],
    [2, orderTask],
    [2, bracketTask],
    [1.5, doubleTask],
    [1, leftoverTask],
    [1, moneyLeftTask],
  ],
};

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 60; tries++) {
    const ex = pickWeighted(rng, LEVELS[level])(rng);
    if (ex) return ex;
  }
  for (;;) {
    const ex = simplifyTask(rng);
    if (ex) return ex;
  }
}

// ---------------------------------------------------------------------------
// Fraction pictures: a bar or a circle cut into equal parts. The cuts are keyed
// by their position (as a reduced fraction), so expanding only adds new cuts
// and simplifying only removes some. The shaded amount never moves.

type Cut = { key: string; at: number };

function cutsFor(parts: number): Cut[] {
  const out: Cut[] = [];
  for (let i = 1; i < parts; i++) {
    const g = gcd(i, parts);
    out.push({ key: `${i / g}-${parts / g}`, at: i / parts });
  }
  return out;
}

type Seg = { key: string; from: number; to: number; tone?: "main" | "second" | "gone"; enter?: [number, number]; delay?: number };
const SEG_FILL = { main: "var(--blob)", second: "var(--blob-light)", gone: "color-mix(in oklab, var(--danger) 16%, transparent)" };
const EMPTY = "color-mix(in oklab, var(--ink) 7%, transparent)";
const BW = 400;

function FracBar({
  parts,
  segs,
  height = 54,
  bg = "var(--raised)",
  appear = false,
  label,
  className,
}: {
  parts: number;
  segs: Seg[];
  height?: number;
  bg?: string;
  appear?: boolean;
  label?: string;
  className?: string;
}) {
  const clip = `fb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const H = height;
  return (
    <svg viewBox={`0 0 ${BW} ${H}`} className={cn("block w-full", className)} role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <rect width={BW} height={H} rx={12} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={BW} height={H} fill={EMPTY} />
        {segs.map((s) => (
          <motion.rect
            key={s.key}
            y={0}
            height={H}
            fill={SEG_FILL[s.tone ?? "main"]}
            stroke={s.tone === "gone" ? "var(--danger)" : undefined}
            strokeWidth={s.tone === "gone" ? 2 : 0}
            strokeDasharray={s.tone === "gone" ? "6 5" : undefined}
            initial={s.enter ? { x: s.enter[0] * BW, width: (s.enter[1] - s.enter[0]) * BW } : appear ? { x: s.from * BW, width: 0 } : false}
            animate={{ x: s.from * BW, width: Math.max(0, (s.to - s.from) * BW) }}
            transition={{ type: "spring", stiffness: 190, damping: 24, delay: s.delay ?? (appear ? 0.25 : 0) }}
          />
        ))}
        <AnimatePresence initial={appear}>
          {cutsFor(parts).map((c, i) => (
            <motion.path
              key={c.key}
              d={`M ${c.at * BW} -2 L ${c.at * BW} ${H + 2}`}
              stroke={bg}
              strokeWidth={3}
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.025 }}
            />
          ))}
        </AnimatePresence>
      </g>
      <rect x={0.75} y={0.75} width={BW - 1.5} height={H - 1.5} rx={11.5} fill="none" stroke="var(--line-2)" strokeWidth={1.5} />
    </svg>
  );
}

function sectorPath(c: number, r: number, t: number): string {
  if (t <= 0.0005) return "M 0 0";
  if (t >= 0.9995) return `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r} Z`;
  const a = 2 * Math.PI * t - Math.PI / 2;
  const x = (c + r * Math.cos(a)).toFixed(2);
  const y = (c + r * Math.sin(a)).toFixed(2);
  return `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${t > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

function FracPie({ parts, value, bg = "var(--raised)", appear = false, className }: { parts: number; value: number; bg?: string; appear?: boolean; className?: string }) {
  const C = 100;
  const R = 92;
  const v = useSpring(0, { stiffness: 150, damping: 22 });
  useEffect(() => {
    v.set(value);
  }, [v, value]);
  const d = useTransform(v, (t) => sectorPath(C, R, t));
  const lines: Cut[] = parts > 1 ? [{ key: "0-1", at: 0 }, ...cutsFor(parts)] : [];
  return (
    <svg viewBox="0 0 200 200" className={cn("block", className)} role="img" aria-label={`Circle cut into ${parts} parts`}>
      <circle cx={C} cy={C} r={R} fill={EMPTY} />
      <motion.path d={d} fill="var(--blob)" />
      <AnimatePresence initial={appear}>
        {lines.map((c, i) => {
          const a = c.at * 2 * Math.PI - Math.PI / 2;
          return (
            <motion.path
              key={c.key}
              d={`M ${C} ${C} L ${(C + (R + 2) * Math.cos(a)).toFixed(2)} ${(C + (R + 2) * Math.sin(a)).toFixed(2)}`}
              stroke={bg}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.025 }}
            />
          );
        })}
      </AnimatePresence>
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line-2)" strokeWidth={1.5} />
    </svg>
  );
}

/** The picture shown with "which fraction is shaded?" tasks. */
function FractionPicture({ n, d, shape }: { n: number; d: number; shape: "bar" | "circle" }) {
  return (
    <div className="grid place-items-center px-2 py-4">
      {shape === "bar" ? (
        <FracBar parts={d} segs={[{ key: "s", from: 0, to: n / d }]} bg="var(--surface)" appear height={60} className="max-w-[440px]" label={`Bar cut into ${d} parts`} />
      ) : (
        <FracPie parts={d} value={n / d} bg="var(--surface)" appear className="w-[180px]" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small controls

function Segmented<T extends string>({ options, value, onChange, scope }: { options: [T, string][]; value: T; onChange: (v: T) => void; scope: string }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === v ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === v && <motion.span layoutId={`${scope}-seg`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[12.5px] text-ink-2">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-7 text-center font-math text-[19px] tabular-nums">
        {value}
      </motion.span>
      <button
        type="button"
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

function Chip({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-9 min-w-11 rounded-lg border border-line bg-surface px-2.5 font-math text-[17px] text-ink transition-colors hover:border-blob/50 hover:bg-blob-soft disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Interactive 1: same amount, different names (expanding and simplifying).

type Op = { n: number; d: number; op: "x" | ":"; k: number };

function FractionModel() {
  const scope = useId();
  const [shape, setShape] = useState<"bar" | "circle">("bar");
  const [cur, setCur] = useState({ n: 2, d: 3 });
  const [last, setLast] = useState<Op | null>(null);
  const g = gcd(cur.n, cur.d);

  const apply = (op: "x" | ":", k: number) => {
    setLast({ ...cur, op, k });
    setCur(op === "x" ? { n: cur.n * k, d: cur.d * k } : { n: cur.n / k, d: cur.d / k });
  };
  const build = (n: number, d: number) => {
    setLast(null);
    setCur({ n: Math.min(n, d), d });
  };

  const id = (f: { n: number; d: number }) => `${f.n}x${f.d}`;
  const fracSrc = (f: { n: number; d: number }, step?: { op: string; k: number }) => {
    const i = id(f);
    const top = step ? ` ${step.op}#o${i} ${step.k}#k${i}` : "";
    const bottom = step ? ` ${step.op}#p${i} ${step.k}#l${i}` : "";
    return `\\frac{${f.n}#n${i}${top}}{${f.d}#d${i}${bottom}}#f${i}`;
  };
  const formula = last ? `${fracSrc(last, { op: last.op === "x" ? "\\cdot" : ":", k: last.k })} =#eq ${fracSrc(cur)}` : fracSrc(cur);
  const lit = last ? [`k${id(last)}`, `l${id(last)}`] : [];

  const message = !last
    ? "Expand or simplify and watch the purple part. Does it change size?"
    : last.op === "x"
      ? `Every part was cut into ${last.k} smaller ones. ${last.k} times as many parts, ${last.k} times as many shaded: the same amount.`
      : `Groups of ${last.k} parts were merged into one. Fewer, bigger parts, but still the same amount.`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          scope={scope}
          options={[
            ["bar", "Bar"],
            ["circle", "Circle"],
          ]}
          value={shape}
          onChange={setShape}
        />
        <Stepper label="Numerator" value={cur.n} min={1} max={cur.d} onChange={(n) => build(n, cur.d)} />
        <Stepper label="Denominator" value={cur.d} min={1} max={24} onChange={(d) => build(cur.n, d)} />
        <button
          type="button"
          onClick={() => build(2, 3)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> Reset
        </button>
      </div>

      <div className="grid items-center gap-6 rounded-xl border border-line bg-surface p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,230px)]">
        <div className="grid min-h-[130px] place-items-center md:min-h-[200px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={shape}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2 }}
              className="grid w-full place-items-center"
            >
              {shape === "bar" ? (
                <FracBar parts={cur.d} segs={[{ key: "s", from: 0, to: cur.n / cur.d }]} bg="var(--surface)" height={64} label={`${cur.n} of ${cur.d} parts`} />
              ) : (
                <FracPie parts={cur.d} value={cur.n / cur.d} bg="var(--surface)" className="w-[190px]" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MathView src={formula} size="lg" scope={`${scope}-f`} highlight={lit} />
          <span className="text-[12.5px] text-ink-3">
            {cur.n} of {cur.d} equal parts
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Expand</span>
          {[2, 3, 4].map((k) => (
            <Chip key={k} onClick={() => apply("x", k)} disabled={cur.d * k > 24} title={`Multiply top and bottom by ${k}`}>
              · {k}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Simplify</span>
          {[2, 3, 5].map((k) => (
            <Chip key={k} onClick={() => apply(":", k)} disabled={cur.n % k !== 0 || cur.d % k !== 0} title={`Divide top and bottom by ${k}`}>
              : {k}
            </Chip>
          ))}
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[12px] font-semibold",
            g === 1 ? "bg-ok/12 text-ok" : "bg-blob-soft text-blob-ink",
          )}
        >
          {cur.n === cur.d ? "One whole" : g === 1 ? "Fully simplified" : `Can be simplified by ${g}`}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={message} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive 2: bring two fractions to a common denominator, then add or subtract.

const PAIRS: [number, number, number, number][] = [
  [1, 2, 1, 3],
  [3, 4, 1, 6],
  [2, 5, 1, 4],
  [3, 8, 1, 4],
  [2, 3, 1, 4],
  [4, 9, 1, 3],
];

const PIECES: Record<number, string> = {
  2: "halves",
  3: "thirds",
  4: "quarters",
  5: "fifths",
  6: "sixths",
  8: "eighths",
  9: "ninths",
  10: "tenths",
  12: "twelfths",
  20: "twentieths",
  24: "twenty-fourths",
};
const pieces = (d: number) => PIECES[d] ?? `parts of ${d}`;

function CommonDenominator() {
  const scope = useId();
  const [pi, setPi] = useState(0);
  const [sign, setSign] = useState<"+" | "-">("+");
  const [step, setStep] = useState(0);
  const [a, b, c, d] = PAIRS[pi % PAIRS.length];
  const l = lcm(b, d);
  const ka = l / b;
  const kc = l / d;
  const A2 = a * ka;
  const C2 = c * kc;
  const R = sign === "+" ? A2 + C2 : A2 - C2;
  const plus = sign === "+";

  const plain = (n: number, dd: number, id: string) => `\\frac{${n}#${id}n}{${dd}#${id}d}#${id}f`;
  const expanded = (n: number, dd: number, k: number, id: string) =>
    k === 1 ? plain(n, dd, id) : `\\frac{${n}#${id}n \\cdot#${id}m ${k}#${id}k}{${dd}#${id}d \\cdot#${id}q ${k}#${id}l}#${id}f`;
  const g = gcd(R, l);
  const formula =
    step === 0
      ? `${plain(a, b, "a")} ${sign}#op ${plain(c, d, "c")}`
      : step === 1
        ? `${expanded(a, b, ka, "a")} ${sign}#op ${expanded(c, d, kc, "c")}`
        : step === 2
          ? `${plain(A2, l, "a")} ${sign}#op ${plain(C2, l, "c")}`
          : `\\frac{${A2}#an ${sign}#op ${C2}#cn}{${l}#ad}#af =#eq ${plain(R, l, "r")}${g > 1 ? ` =#eq2 ${tx(R / g, l / g)}` : ""}`;
  const lit = step === 1 ? ["ak", "al", "ck", "cl"] : step === 2 ? ["ad", "cd"] : step === 3 ? ["rn"] : [];

  const texts = [
    `These pieces have different sizes: ${pieces(b)} and ${pieces(d)}. You can't ${plus ? "add" : "subtract"} them yet.`,
    `Expand: cut every piece into smaller ones until both bars have ${l} equal parts. The shaded amounts don't change.`,
    `Now both fractions are counted in the same pieces: ${pieces(l)}. ${l} is the lowest common denominator.`,
    plus ? `Same-sized pieces, so just count them: ${A2} + ${C2} = ${R} ${pieces(l)}.` : `Take ${C2} pieces away from ${A2}: ${R} ${pieces(l)} are left.`,
  ];
  const pieceText = texts[step];

  const resultSegs: Seg[] = plus
    ? [
        { key: "a", from: 0, to: a / b, tone: "main" },
        { key: "c", from: a / b, to: a / b + c / d, tone: "second", enter: [a / b, a / b], delay: 0.35 },
      ]
    : [
        { key: "g", from: a / b - c / d, to: a / b, tone: "gone", enter: [a / b - c / d, a / b - c / d], delay: 0.3 },
        { key: "a", from: 0, to: a / b - c / d, tone: "main", enter: [0, a / b], delay: 0.3 },
      ];

  const labels = ["Start", "Expand", "Common denominator", plus ? "Add" : "Subtract"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Segmented
          scope={scope}
          options={[
            ["+", "Add"],
            ["-", "Subtract"],
          ]}
          value={sign}
          onChange={setSign}
        />
        <button
          type="button"
          onClick={() => {
            setPi((x) => x + 1);
            setStep(0);
          }}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Shuffle className="size-3.5" /> Another example
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <BarRow label={step >= 2 ? tx(A2, l) : tx(a, b)} scope={`${scope}-la`}>
          <FracBar parts={step >= 1 ? l : b} segs={[{ key: "a", from: 0, to: a / b }]} bg="var(--surface)" label="First fraction" />
        </BarRow>
        <BarRow label={step >= 2 ? tx(C2, l) : tx(c, d)} scope={`${scope}-lc`}>
          <FracBar parts={step >= 1 ? l : d} segs={[{ key: "c", from: 0, to: c / d, tone: "second" }]} bg="var(--surface)" label="Second fraction" />
        </BarRow>
        <AnimatePresence initial={false}>
          {step === 3 && (
            <motion.div
              key={`r${sign}${pi}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="overflow-hidden"
            >
              <div className="border-t border-dashed border-line pt-3">
                <BarRow label={tx(R, l)} scope={`${scope}-lr`}>
                  <FracBar parts={l} segs={resultSegs} bg="var(--surface)" label="Result" />
                </BarRow>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="grid min-h-[86px] place-items-center pt-2">
          <MathView src={formula} size="lg" scope={`${scope}-f`} highlight={lit} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30"
          aria-label="Previous step"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex flex-wrap gap-1.5">
          {labels.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors",
                i === step ? "bg-blob text-white" : i < step ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-3 hover:text-ink",
              )}
            >
              {i + 1}. {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep((s) => (s >= 3 ? 0 : s + 1))}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-paper hover:bg-ink/88"
        >
          {step >= 3 ? "Start again" : "Next step"} {step < 3 && <ArrowRight className="size-3.5" />}
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={pieceText} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {pieceText}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function BarRow({ label, scope, children }: { label: string; scope: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid w-14 shrink-0 place-items-center">
        <MathView src={label} size="md" scope={scope} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson boards

const meaningFrames: Frame[] = [
  { math: "\\frac{3#n}{4#d}#f", note: "A fraction describes a part of a whole." },
  { math: "\\frac{3#n}{4#d}#f", note: "The **denominator** (Nenner) at the bottom says into how many **equal** parts the whole is cut: $4$.", highlight: ["d"] },
  { math: "\\frac{3#n}{4#d}#f", note: "The **numerator** (Zähler) on top says how many of these parts you take: $3$.", highlight: ["n"] },
  { math: "3#n :#dv 4#d", note: "A fraction is also a division: the fraction bar means $:$.", highlight: ["dv"] },
  { math: "3#n :#dv 4#d =#eq 0.75#v", note: "$3 : 4 = 0.75$. So $\\frac{3}{4}$ and $0.75$ are the same number." },
];

const expandFrames: Frame[] = [
  { math: "\\frac{2#n}{3#d}#f", note: "Start with $\\frac{2}{3}$." },
  { math: "\\frac{2#n \\cdot#m1 4#k1}{3#d \\cdot#m2 4#k2}#f", note: "**Expanding** (Erweitern): multiply top **and** bottom by the same number.", highlight: ["k1", "k2"] },
  { math: "\\frac{8#n}{12#d}#f", note: "$\\frac{2}{3} = \\frac{8}{12}$. More, smaller pieces, but the same amount." },
  { math: "\\frac{8#n :#s1 4#k1}{12#d :#s2 4#k2}#f", note: "**Simplifying** (Kürzen) goes backwards: divide top and bottom by the same number.", highlight: ["k1", "k2"] },
  { math: "\\frac{2#n}{3#d}#f", note: "Back to $\\frac{2}{3}$. Always simplify **fully**: divide by the greatest common factor (ggT)." },
];

const addBoard = board();
put(addBoard, "\\frac{3#an}{4#ad}#af +#op \\frac{1#bn}{6#bd}#bf", "Quarters and sixths are pieces of different sizes. You can't add them directly.");
addSub(addBoard, kf(3, 4, "a"), kf(1, 6, "b"), 1, "op");
appendNote(addBoard.frames, "Done: $\\frac{3}{4} + \\frac{1}{6} = \\frac{11}{12}$.");

const mulBoard = board();
put(mulBoard, "\\frac{4#an}{9#ad}#af \\cdot#op \\frac{3#bn}{8#bd}#bf", "Multiplying is the easy one: top times top, bottom times bottom.");
mul(mulBoard, kf(4, 9, "a"), kf(3, 8, "b"), "op");
appendNote(mulBoard.frames, "Simplifying first kept the numbers small.");

const divBoard = board();
div(divBoard, kf(2, 3, "a"), kf(4, 5, "b"), "op");
appendNote(divBoard.frames, "So $\\frac{2}{3} : \\frac{4}{5} = \\frac{5}{6}$.");

const mixedFrames: Frame[] = [
  { math: "2#w \\frac{3#n}{4#d}#f", note: "A **mixed number** (gemischte Zahl): $2$ wholes and $\\frac{3}{4}$ more." },
  { math: "\\frac{2#w \\cdot#x 4#k +#p 3#n}{4#d}#f", note: "As an improper fraction: whole number times denominator, plus numerator.", highlight: ["w", "k"] },
  { math: "\\frac{11#w}{4#d}#f", note: "$2 \\cdot 4 + 3 = 11$. So $2\\frac{3}{4} = \\frac{11}{4}$: eleven quarters." },
  { math: "11#w :#dv 4#d =#eq 2#q \"remainder\"#rm 3#r", note: "And back again: $11 : 4 = 2$ remainder $3$." },
  { math: "2#q \\frac{3#r}{4#d}#f", note: "$2$ wholes and $3$ quarters left over: $2\\frac{3}{4}$. In the practice tasks, type results as improper fractions." },
];

const ofBoard = board();
ofSteps(ofBoard, 3, 4, 20, "€");
ofBoard.frames[0].note = "$\\frac{3}{4}$ of $20$ €. **Of** means times.";
appendNote(ofBoard.frames, "So $\\frac{3}{4}$ of $20$ € is $15$ €.");

const checkSimplify = board();
put(checkSimplify, src(kf(18, 24, "a")), "Find the largest number that divides both $18$ and $24$. It's $6$.", { highlight: ["an", "ad"] });
simplify(checkSimplify, kf(18, 24, "a"));

const checkSub = board();
addSub(checkSub, kf(5, 6, "a"), kf(3, 8, "b"), -1, "op");
finish(checkSub.frames, { n: 11, d: 24 });

const checkDiv = board();
div(checkDiv, kf(3, 4, "a"), kf(9, 10, "b"), "op");
finish(checkDiv.frames, { n: 5, d: 6 });

const checkOf = board();
ofSteps(checkOf, 3, 7, 28, "students");

// ---------------------------------------------------------------------------

const fractions: Topic = {
  ...topicMeta("fractions"),
  summary: [
    {
      title: "Expand and simplify",
      body: "Multiply or divide top **and** bottom by the same number. The value stays the same. Simplify fully by the greatest common factor.",
      examples: ["\\frac{2}{3} = \\frac{2 \\cdot 4}{3 \\cdot 4} = \\frac{8}{12}", "\\frac{18}{24} = \\frac{18 : 6}{24 : 6} = \\frac{3}{4}"],
      tone: "rule",
    },
    {
      title: "Add and subtract",
      body: "Expand both fractions to the lowest common denominator (Hauptnenner). Then add or subtract the numerators and keep the denominator.",
      examples: ["\\frac{3}{4} + \\frac{1}{6} = \\frac{9}{12} + \\frac{2}{12} = \\frac{11}{12}"],
      tone: "rule",
    },
    {
      title: "Multiply",
      body: "Top times top, bottom times bottom. Simplify crosswise first to keep the numbers small.",
      examples: ["\\frac{a}{b} \\cdot \\frac{c}{d} = \\frac{a \\cdot c}{b \\cdot d}", "\\frac{4}{9} \\cdot \\frac{3}{8} = \\frac{1}{3} \\cdot \\frac{1}{2} = \\frac{1}{6}"],
      tone: "rule",
    },
    {
      title: "Divide",
      body: "Multiply by the reciprocal (Kehrwert) of the second fraction.",
      examples: ["\\frac{a}{b} : \\frac{c}{d} = \\frac{a}{b} \\cdot \\frac{d}{c}", "\\frac{2}{3} : \\frac{4}{5} = \\frac{2}{3} \\cdot \\frac{5}{4} = \\frac{5}{6}"],
      tone: "rule",
    },
    {
      title: "Mixed numbers and “of”",
      body: "Turn mixed numbers into improper fractions before calculating. And “of” means times: divide by the denominator, then multiply by the numerator.",
      examples: ["2\\frac{3}{4} = \\frac{2 \\cdot 4 + 3}{4} = \\frac{11}{4}", "\\frac{3}{4} \"of\" 20 = 20 : 4 \\cdot 3 = 15"],
      tone: "tip",
    },
    {
      title: "Classic mistake",
      body: "Never add the denominators. Find a common denominator first.",
      examples: ["\\frac{1}{2} + \\frac{1}{3} \\ne \\frac{2}{5}", "\\frac{1}{2} + \\frac{1}{3} = \\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: "What a fraction means",
      blob: "Fractions are just pieces of a whole. Like slices of pizza!",
      body: "Cut a pizza into $4$ equal slices and take $3$: you have $\\frac{3}{4}$ of the pizza.",
      frames: meaningFrames,
    },
    {
      type: "explain",
      title: "Expanding and simplifying",
      blob: "Same amount, different name. That's the big idea!",
      body: "A fraction has many names: $\\frac{1}{2} = \\frac{2}{4} = \\frac{3}{6}$. Expanding and simplifying switch between them without changing the value.",
      frames: expandFrames,
    },
    {
      type: "widget",
      title: "Same amount, new name",
      blob: "Cut the pieces finer or merge them. Keep an eye on the purple part!",
      body: "Build a fraction with the steppers. Then expand or simplify it and watch the cuts appear and disappear.",
      widget: FractionModel,
    },
    {
      type: "check",
      blob: "Your turn! Simplify as far as it goes.",
      exercise: {
        instruction: "Simplify fully",
        math: "\\frac{18}{24}",
        answer: { kind: "fraction", n: 3, d: 4, mustReduce: true },
        hint: "Both numbers are in the $6$ times table.",
        solution: checkSimplify.frames,
      },
    },
    {
      type: "explain",
      title: "Adding and subtracting",
      blob: "You can only add pieces of the same size. So first we make them match!",
      body: "Same denominator: add or subtract the numerators and keep the denominator, e.g. $\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}$.\n\nDifferent denominators: expand both fractions to the **lowest common denominator** (Hauptnenner) first.",
      frames: addBoard.frames,
    },
    {
      type: "widget",
      title: "Find the common denominator",
      blob: "Step through it and watch the bars get cut into matching pieces.",
      body: "Press **Next step**. Both bars are cut into the same number of parts, and then the parts can simply be counted.",
      widget: CommonDenominator,
    },
    {
      type: "check",
      blob: "Different denominators. What's the lowest common one?",
      exercise: {
        instruction: "Calculate and simplify",
        math: "\\frac{5}{6} - \\frac{3}{8}",
        answer: { kind: "fraction", n: 11, d: 24, mustReduce: true },
        hint: "Multiples of $8$: $8, 16, 24$. And $6$ goes into $24$.",
        solution: checkSub.frames,
      },
    },
    {
      type: "explain",
      title: "Multiplying fractions",
      blob: "Good news: no common denominator needed here!",
      body: "Top times top, bottom times bottom. A whole number counts as a fraction over $1$: $3 \\cdot \\frac{2}{7} = \\frac{3}{1} \\cdot \\frac{2}{7} = \\frac{6}{7}$.",
      frames: mulBoard.frames,
    },
    {
      type: "explain",
      title: "Dividing fractions",
      blob: "Dividing is multiplying in disguise. Flip and multiply!",
      body: "The **reciprocal** (Kehrwert) swaps top and bottom: the reciprocal of $\\frac{4}{5}$ is $\\frac{5}{4}$.",
      frames: divBoard.frames,
    },
    {
      type: "check",
      blob: "Flip the second fraction, then simplify crosswise.",
      exercise: {
        instruction: "Calculate and simplify",
        math: "\\frac{3}{4} : \\frac{9}{10}",
        answer: { kind: "fraction", n: 5, d: 6, mustReduce: true },
        hint: "$\\frac{3}{4} : \\frac{9}{10} = \\frac{3}{4} \\cdot \\frac{10}{9}$. Now simplify crosswise.",
        solution: checkDiv.frames,
      },
    },
    {
      type: "explain",
      title: "Mixed numbers",
      blob: "Two and three quarters pizzas. Let's write that as one fraction.",
      body: "Fractions bigger than $1$ can be written as a mixed number or as an improper fraction (unechter Bruch). For calculating, the improper fraction is easier.",
      frames: mixedFrames,
    },
    {
      type: "explain",
      title: "A fraction of a quantity",
      blob: "Three quarters of 20 euros. How much is that?",
      body: "To find a fraction of an amount: divide by the denominator, then multiply by the numerator.",
      frames: ofBoard.frames,
    },
    {
      type: "check",
      blob: "Last one! Divide first, then multiply.",
      exercise: {
        instruction: "Word problem",
        text: "Class 7b has 28 students. $\\frac{3}{7}$ of them have a pet. How many students have a pet?",
        answer: { kind: "number", value: 12, unit: "students" },
        hint: "$\\frac{1}{7}$ of $28$ is $28 : 7$. Then take $3$ of those.",
        solution: checkOf.frames,
      },
    },
  ],
  generate,
};

export default fractions;
