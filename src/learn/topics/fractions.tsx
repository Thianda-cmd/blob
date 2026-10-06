"use client";

import { AnimatePresence, motion, useSpring, useTransform } from "motion/react";
import { ArrowLeft, ArrowRight, Minus, Plus, RotateCcw, Shuffle } from "lucide-react";
import { useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import { add, div as divF, frac, mul as mulF, sub, type Frac } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, SingleLessonTopic as Topic } from "@/learn/types";
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
const fr = (n: number, d: number) => (d === 1 ? String(n) : `\\frac{${n}}{${d}}`);
const frf = (f: { n: number; d: number }) => fr(f.n, f.d);

/** "2\frac{3}{4}" for an improper fraction. */
function mixedTx(n: number, d: number) {
  const w = Math.floor(n / d);
  const r = n - w * d;
  if (w === 0) return fr(n, d);
  return r === 0 ? String(w) : `${w}\\frac{${r}}{${d}}`;
}

/** A worked solution being written. `pre` and `post` frame the part we're working on. */
type Board = { frames: Frame[]; pre: string; post: string };
const board = (): Board => ({ frames: [], pre: "", post: "" });

function put(b: Board, body: Text, note: Text, extra: Omit<Frame, "math" | "note"> = {}) {
  const math = typeof body === "string" ? `${b.pre}${body}${b.post}` : txMap((t) => `${b.pre}${t(body.en, body.de)}${b.post}`);
  b.frames.push({ math, note, ...extra });
}

/** Divide top and bottom by their greatest common factor. */
function simplify(b: Board, f: KF): KF {
  const g = gcd(f.n, f.d);
  if (g === 1 || f.d === 1) return f;
  put(
    b,
    `\\frac{${f.n}#${f.kn} :#${f.kf}x ${g}#${f.kf}g}{${f.d}#${f.kd} :#${f.kf}y ${g}#${f.kf}h}#${f.kf}`,
    tx(`Simplify: divide top and bottom by $${g}$.`, `Kürzen: Teile Zähler und Nenner durch $${g}$.`),
    { highlight: [`${f.kf}g`, `${f.kf}h`] },
  );
  const r: KF = { ...f, n: f.n / g, d: f.d / g, asFrac: false };
  put(
    b,
    src(r),
    r.d === 1
      ? tx(`$${f.n} : ${f.d} = ${r.n}$, a whole number.`, `$${f.n} : ${f.d} = ${r.n}$, eine ganze Zahl.`)
      : tx(`Fully simplified: $${fr(f.n, f.d)} = ${fr(r.n, r.d)}$.`, `Vollständig gekürzt: $${fr(f.n, f.d)} = ${fr(r.n, r.d)}$.`),
  );
  return r;
}

/** How to find the lowest common denominator (Hauptnenner). */
function lcdNote(a: number, b: number): Text {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const l = lcm(a, b);
  if (big % small === 0)
    return tx(
      `Different denominators. $${small}$ goes into $${big}$, so $${big}$ is the common denominator.`,
      `Verschiedene Nenner. $${big}$ ist durch $${small}$ teilbar, also ist $${big}$ der Hauptnenner.`,
    );
  const multiples: number[] = [];
  for (let m = big; m <= l; m += big) multiples.push(m);
  return tx(
    `Different denominators. Multiples of $${big}$: $${multiples.join(", ")}$. The first one that $${small}$ also goes into is $${l}$.`,
    `Verschiedene Nenner. Vielfache von $${big}$: $${multiples.join(", ")}$. Das erste, das auch durch $${small}$ teilbar ist, ist $${l}$.`,
  );
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
    const which = (by: string, and: string) =>
      [ka > 1 ? `$${src0(A)}$ ${by} $${ka}$` : "", kb > 1 ? `$${src0(B)}$ ${by} $${kb}$` : ""].filter(Boolean).join(` ${and} `);
    const lit = [...(ka > 1 ? [`${A.kf}k`, `${A.kf}l`] : []), ...(kb > 1 ? [`${B.kf}k`, `${B.kf}l`] : [])];
    put(
      b,
      `${ex(A, ka)} ${op}#${opKey} ${ex(B, kb)}`,
      tx(
        `Expand ${which("by", "and")}: multiply top and bottom by the same number.`,
        `Erweitere ${which("mit", "und")}: Zähler und Nenner mit derselben Zahl multiplizieren.`,
      ),
      { highlight: lit },
    );
    A = { ...A, n: A.n * ka, d: l, asFrac: true };
    B = { ...B, n: B.n * kb, d: l, asFrac: true };
    put(b, both(A, B), tx(`Now both fractions have the denominator $${l}$.`, `Jetzt haben beide Brüche den Nenner $${l}$.`), { highlight: [A.kd, B.kd] });
  }
  put(
    b,
    `\\frac{${A.n}#${A.kn} ${op}#${opKey} ${B.n}#${B.kn}}{${A.d}#${A.kd}}#${A.kf}`,
    sign > 0
      ? tx("Same denominator: add the numerators, keep the denominator.", "Gleicher Nenner: Addiere die Zähler, der Nenner bleibt.")
      : tx("Same denominator: subtract the numerators, keep the denominator.", "Gleicher Nenner: Subtrahiere die Zähler, der Nenner bleibt."),
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
    put(
      b,
      both(A, B),
      tx(`Write the whole number as a fraction: $${w.n} = \\frac{${w.n}}{1}$.`, `Schreib die ganze Zahl als Bruch: $${w.n} = \\frac{${w.n}}{1}$.`),
      { highlight: [w.kd] },
    );
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
      tx(
        `${first ? "Before multiplying, simplify crosswise. " : ""}$${top.n}$ and $${bottom.d}$ are both divisible by $${g}$.`,
        `${first ? "Vor dem Multiplizieren über Kreuz kürzen. " : ""}$${top.n}$ und $${bottom.d}$ sind beide durch $${g}$ teilbar.`,
      ),
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
    put(
      b,
      both(A, B),
      tx(`$${top.n} : ${g} = ${nt}$ and $${bottom.d} : ${g} = ${nb}$.`, `$${top.n} : ${g} = ${nt}$ und $${bottom.d} : ${g} = ${nb}$.`),
      { highlight: [top.kn, bottom.kd] },
    );
    first = false;
  }
  put(
    b,
    `\\frac{${A.n}#${A.kn} \\cdot#${opKey} ${B.n}#${B.kn}}{${A.d}#${A.kd} \\cdot#${A.kf}b ${B.d}#${B.kd}}#${A.kf}`,
    TOP_TIMES_TOP,
  );
  const r: KF = { ...A, n: A.n * B.n, d: A.d * B.d, asFrac: false };
  put(
    b,
    src(r),
    r.d === 1
      ? tx(
          `$${A.n} \\cdot ${B.n} = ${r.n}$ and $${A.d} \\cdot ${B.d} = 1$: a whole number.`,
          `$${A.n} \\cdot ${B.n} = ${r.n}$ und $${A.d} \\cdot ${B.d} = 1$: eine ganze Zahl.`,
        )
      : tx(`$${A.n} \\cdot ${B.n} = ${r.n}$ and $${A.d} \\cdot ${B.d} = ${r.d}$.`, `$${A.n} \\cdot ${B.n} = ${r.n}$ und $${A.d} \\cdot ${B.d} = ${r.d}$.`),
  );
  return simplify(b, r);
}

const TOP_TIMES_TOP = tx("Top times top, bottom times bottom.", "Zähler mal Zähler, Nenner mal Nenner.");
const RECIPROCAL_LEAD = tx(
  "To divide, multiply by the **reciprocal** (Kehrwert): flip the second fraction upside down.",
  "Dividieren heißt: mit dem **Kehrwert** multiplizieren. Dreh dafür den zweiten Bruch um.",
);

/** Divides: multiply by the reciprocal (Kehrwert) of the second number. */
function div(b: Board, A: KF, B: KF, opKey: string, lead?: Text): KF {
  put(b, `${src(A)} :#${opKey} ${src(B)}`, lead ?? RECIPROCAL_LEAD, {
    highlight: [opKey],
  });
  if (isWhole(B)) {
    B = { ...B, asFrac: true };
    put(b, `${src(A)} :#${opKey} ${src(B)}`, tx(`Write $${B.n}$ as $\\frac{${B.n}}{1}$.`, `Schreib $${B.n}$ als $\\frac{${B.n}}{1}$.`), { highlight: [B.kd] });
  }
  const R: KF = { n: B.d, d: B.n, kn: B.kd, kd: B.kn, kf: B.kf, asFrac: true };
  const dot = `${opKey}m`;
  put(
    b,
    `${src(A)} \\cdot#${dot} ${src(R)}`,
    tx(
      `Flip $\\frac{${B.n}}{${B.d}}$ to $\\frac{${R.n}}{${R.d}}$ and turn $:$ into $\\cdot$.`,
      `Aus $\\frac{${B.n}}{${B.d}}$ wird der Kehrwert $\\frac{${R.n}}{${R.d}}$, und aus $:$ wird $\\cdot$.`,
    ),
    { highlight: [R.kn, R.kd, dot] },
  );
  return mul(b, A, R, dot);
}

/** A quantity's unit, with the German word for word units. */
type Unit = Text;

/** "3/4 of 28 kg": divide by the denominator, multiply by the numerator. */
function ofSteps(b: Board, n: number, d: number, q: number, unit: Unit) {
  /** A line in both languages: `u` is the unit token for the board, `w` the unit word for notes. */
  const say = (build: (u: string, w: string) => string) =>
    txMap((_, l) => {
      const name = resolveText(unit, l);
      return build(name ? ` "${name}"#u` : "", name ? ` ${name}` : "");
    });
  const one = q / d;
  put(b, say((u) => `\\frac{${n}#n}{${d}#d}#f \\cdot#t ${q}#q${u}`), tx("**Of** means times.", "„von“ heißt **mal**."));
  put(b, `${q}#q :#dv ${d}#d \\cdot#t ${n}#n`, tx("Divide by the denominator, then multiply by the numerator.", "Teile durch den Nenner, dann multipliziere mit dem Zähler."), {
    highlight: ["dv", "d"],
  });
  if (n === 1) {
    put(b, say((u) => `${one}#q${u}`), say((_, w) => `$${q} : ${d} = ${one}$${w}.`));
    return;
  }
  put(b, `${one}#q \\cdot#t ${n}#n`, tx(`$${q} : ${d} = ${one}$. That's $\\frac{1}{${d}}$ of $${q}$.`, `$${q} : ${d} = ${one}$. Das ist $\\frac{1}{${d}}$ von $${q}$.`));
  put(b, say((u) => `${one * n}#q${u}`), say((_, w) => `$${one} \\cdot ${n} = ${one * n}$${w}.`));
}

/** Adds a sentence to the note of the last frame. */
function appendNote(frames: Frame[], text: Text) {
  const last = frames[frames.length - 1];
  const prev = last.note;
  frames[frames.length - 1] = { ...last, note: prev ? txMap((_, l) => `${resolveText(prev, l)} ${resolveText(text, l)}`) : text };
}

/** Closes a worked solution: lowest terms, and the mixed-number form of an improper result. */
function finish(frames: Frame[], r: Frac) {
  const last = resolveText(frames[frames.length - 1].note, "en");
  if (r.d > 1 && !/simplified/i.test(last)) appendNote(frames, tx("Already in lowest terms.", "Schon vollständig gekürzt."));
  if (r.d > 1 && r.n > r.d) appendNote(frames, tx(`As a mixed number: $${mixedTx(r.n, r.d)}$.`, `Als gemischte Zahl: $${mixedTx(r.n, r.d)}$.`));
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

// ---------------------------------------------------------------------------
// Typical mistakes. Each one is simulated from the task's numbers, so the wrong
// value is exactly what a student with that misconception gets.

/** A misconception: the value it leads to (null when it leads nowhere sensible) and what Blob says. */
type Slip = { v: Frac | null; title: Text; say: Text } | null | false;

/** A positive fraction, or null (e.g. a zero or negative denominator). */
const fq = (n: number, d: number): Frac | null => (n > 0 && d > 0 && Number.isInteger(n) && Number.isInteger(d) ? frac(n, d) : null);
const pos = (f: Frac | null): Frac | null => (f && f.n > 0 ? f : null);

/**
 * The slips as Mistakes for an answer made by fracAnswer(right) (or a whole-number answer
 * with `unit`). Only kept when the value differs from the right one and from earlier slips.
 */
function slipsFor(right: Frac, slips: Slip[], unit?: Text): Mistake[] {
  const out: Mistake[] = [];
  const seen = [right.n / right.d];
  for (const s of slips) {
    if (!s || !s.v) continue;
    const v = s.v.n / s.v.d;
    if (seen.some((x) => Math.abs(x - v) < 1e-9)) continue;
    // A number answer is typed as a number: only values with at most two decimals.
    if (right.d === 1 && Math.abs(v * 100 - Math.round(v * 100)) > 1e-9) continue;
    seen.push(v);
    const when: AnswerSpec = right.d === 1 ? { kind: "number", value: v, ...(unit ? { unit } : {}) } : { kind: "fraction", n: s.v.n, d: s.v.d };
    out.push({ when, title: s.title, say: s.say });
  }
  return out;
}

const NO_FLIP = tx("Forgot to flip", "Kehrwert vergessen");
const NO_FLIP_SAY = tx(
  "Ah, you multiplied straight away! When dividing, flip the **second** fraction first (the reciprocal), then multiply.",
  "Ah, du hast direkt multipliziert! Beim Dividieren drehst du zuerst den **zweiten** Bruch um (Kehrwert) und multiplizierst dann.",
);

/** Top plus top over bottom plus bottom (or minus): the number one fraction mistake. */
function numDenSlip(P: Frac, Q: Frac, sign: 1 | -1, where?: [string, string]): Slip {
  const plus = sign > 0;
  const [en, de] = where ?? ["", ""];
  const who = en ? `${en}, you` : "You";
  return {
    v: fq(P.n + sign * Q.n, P.d + sign * Q.d),
    title: plus ? tx("Denominators added", "Nenner addiert") : tx("Denominators subtracted", "Nenner subtrahiert"),
    say: plus
      ? tx(
          `Ooh, classic trap! ${who} added the numerators **and** the denominators. Make the denominators the same first, then add only the numerators.`,
          `Die klassische Falle! Du hast ${de}Zähler **und** Nenner addiert. Mach erst die Nenner gleich und addiere dann nur die Zähler.`,
        )
      : tx(
          `Ooh, classic trap! ${who} subtracted the numerators **and** the denominators. Make the denominators the same first, then subtract only the numerators.`,
          `Die klassische Falle! Du hast ${de}Zähler **und** Nenner subtrahiert. Mach erst die Nenner gleich und subtrahiere dann nur die Zähler.`,
        ),
  };
}

/** Adding or subtracting fractions with different denominators. */
function addSubSlips(P: Frac, Q: Frac, sign: 1 | -1): Slip[] {
  const L = lcm(P.d, Q.d);
  const notExpanded = (den: number): Slip => ({
    v: fq(P.n + sign * Q.n, den),
    title: tx("Numerators not expanded", "Zähler nicht erweitert"),
    say: tx(
      `Nearly! $${den}$ works as a common denominator, but you only changed the denominators. Whatever you multiply a denominator by, multiply its numerator by too.`,
      `Fast! $${den}$ passt als gemeinsamer Nenner, aber du hast nur die Nenner verändert. Womit du einen Nenner multiplizierst, damit musst du auch seinen Zähler multiplizieren.`,
    ),
  });
  return [
    numDenSlip(P, Q, sign),
    notExpanded(L),
    notExpanded(P.d * Q.d),
    {
      v: fq(P.n * Q.d + sign * Q.n * P.d, L),
      title: tx("Expanded by the wrong number", "Mit der falschen Zahl erweitert"),
      say: tx(
        `I think I know what you did: you multiplied each numerator by the **other** denominator, but wrote $${L}$ underneath. Expand each fraction by the number that turns **its own** denominator into $${L}$.`,
        `Ich glaub, ich weiß, was du gemacht hast: Du hast jeden Zähler mit dem **anderen** Nenner multipliziert, aber $${L}$ druntergeschrieben. Erweitere jeden Bruch mit der Zahl, die **seinen eigenen** Nenner zu $${L}$ macht.`,
      ),
    },
  ];
}

/** Simplifying n/d, whose greatest common factor is k. */
function simplifySlips(n: number, d: number, k: number): Slip[] {
  // Crossing out a digit that appears on top and bottom (12/24 → 1/4).
  const a = String(n);
  const b = String(d);
  const digit = [...a].find((c) => b.includes(c));
  const cut = (s: string, c: string) => s.replace(c, "");
  const crossed = digit && a.length > 1 && b.length > 1 ? fq(Number(cut(a, digit)), Number(cut(b, digit))) : null;
  return [
    {
      v: fq(n / k, d),
      title: tx("Only the numerator divided", "Nur den Zähler gekürzt"),
      say: tx(
        `Ah, I see what happened! You divided the numerator, but the denominator stayed $${d}$. Simplifying means dividing top **and** bottom by the same number.`,
        `Ah, ich seh, was passiert ist! Du hast den Zähler geteilt, aber der Nenner ist $${d}$ geblieben. Kürzen heißt: Zähler **und** Nenner durch dieselbe Zahl teilen.`,
      ),
    },
    {
      v: fq(n, d / k),
      title: tx("Only the denominator divided", "Nur den Nenner gekürzt"),
      say: tx(
        `Ah, I see what happened! You divided the denominator, but the numerator stayed $${n}$. Simplifying means dividing top **and** bottom by the same number.`,
        `Ah, ich seh, was passiert ist! Du hast den Nenner geteilt, aber der Zähler ist $${n}$ geblieben. Kürzen heißt: Zähler **und** Nenner durch dieselbe Zahl teilen.`,
      ),
    },
    {
      v: crossed,
      title: tx("Digits crossed out", "Ziffern gestrichen"),
      say: tx(
        `Ooh, sneaky! You crossed out the digit $${digit}$ on top and bottom. But you can only cancel **factors**: divide both numbers by the same number.`,
        `Ooh, verlockend! Du hast oben und unten die Ziffer $${digit}$ gestrichen. Kürzen darfst du aber nur **Faktoren**: Teile beide Zahlen durch dieselbe Zahl.`,
      ),
    },
  ];
}

/** n/d of q: divide by the denominator, multiply by the numerator. */
function ofSlips(n: number, d: number, q: number, story: boolean): Slip[] {
  return [
    n > 1 && {
      v: fq(q / d, 1),
      title: tx("Numerator forgotten", "Zähler vergessen"),
      say: tx(
        `Halfway there! $${q} : ${d}$ is $\\frac{1}{${d}}$ of $${q}$. But you need $${n}$ of those parts, so multiply by the numerator too.`,
        `Halb geschafft! $${q} : ${d}$ ist $\\frac{1}{${d}}$ von $${q}$. Du brauchst aber $${n}$ solche Teile, also noch mit dem Zähler multiplizieren.`,
      ),
    },
    n > 1 && {
      v: fq(q * n, 1),
      title: tx("Denominator forgotten", "Nenner vergessen"),
      say: tx(
        `Ah, you multiplied $${q}$ by $${n}$, but forgot to divide by $${d}$. $${fr(n, d)}$ of something is **less** than the whole thing.`,
        `Ah, du hast $${q}$ mit $${n}$ multipliziert, aber vergessen, durch $${d}$ zu teilen. $${fr(n, d)}$ von etwas ist **weniger** als das Ganze.`,
      ),
    },
    n > 1
      ? {
          v: fq(q * d, n),
          title: tx("Numerator and denominator swapped", "Zähler und Nenner vertauscht"),
          say: tx(
            `I think I know what you did: you divided by $${n}$ and multiplied by $${d}$. It's the other way round: divide by the **denominator**, multiply by the **numerator**.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast durch $${n}$ geteilt und mit $${d}$ multipliziert. Andersrum: durch den **Nenner** teilen, mit dem **Zähler** multiplizieren.`,
          ),
        }
      : {
          v: fq(q * d, 1),
          title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"),
          say: tx(
            `Ah, you multiplied by $${d}$! To find $\\frac{1}{${d}}$ of something, you **divide** by $${d}$: the part is smaller than the whole.`,
            `Ah, du hast mit $${d}$ multipliziert! Für $\\frac{1}{${d}}$ von etwas **teilst** du durch $${d}$: Der Teil ist kleiner als das Ganze.`,
          ),
        },
    story && {
      v: fq(q - (q / d) * n, 1),
      title: tx("The other part", "Der andere Teil"),
      say: tx(
        `Careful, that's the **rest**, the other part. The question asks for $${fr(n, d)}$ of $${q}$ itself.`,
        `Vorsicht, das ist der **Rest**, also der andere Teil. Gefragt sind die $${fr(n, d)}$ von $${q}$ selbst.`,
      ),
    },
  ];
}

/** Multiplying two fractions (or a whole number and a fraction). */
function mulSlips(A: Frac, B: Frac): Slip[] {
  const whole = A.d === 1 ? A : B.d === 1 ? B : null;
  const flip: Slip = {
    v: fq(A.n * B.d, A.d * B.n),
    title: tx("Flipped like in dividing", "Umgedreht wie beim Teilen"),
    say: tx(
      "Ah, you flipped a fraction! That's only for **dividing**. Multiplying is simply top times top, bottom times bottom.",
      "Ah, du hast einen Bruch umgedreht! Das macht man nur beim **Dividieren**. Multiplizieren heißt einfach: Zähler mal Zähler, Nenner mal Nenner.",
    ),
  };
  if (whole) {
    const k = whole.n;
    const f = whole === A ? B : A;
    return [
      {
        v: fq(k * f.n, k * f.d),
        title: tx("Numerator and denominator multiplied", "Zähler und Nenner multipliziert"),
        say: tx(
          `Ah, I see what happened! You multiplied the numerator **and** the denominator by $${k}$. That's expanding, so the value doesn't change. A whole number only multiplies the numerator: $${k} = \\frac{${k}}{1}$.`,
          `Ah, ich seh, was passiert ist! Du hast Zähler **und** Nenner mit $${k}$ multipliziert. Das ist Erweitern, der Wert bleibt gleich. Eine ganze Zahl multipliziert nur den Zähler: $${k} = \\frac{${k}}{1}$.`,
        ),
      },
      {
        v: fq(f.n, k * f.d),
        title: tx("Denominator multiplied", "Nenner multipliziert"),
        say: tx(
          `Close, but you multiplied the **denominator** by $${k}$, so the pieces got smaller. Write $${k}$ as $\\frac{${k}}{1}$: it multiplies the numerator.`,
          `Knapp daneben: Du hast den **Nenner** mit $${k}$ multipliziert, dadurch werden die Stücke kleiner. Schreib $${k}$ als $\\frac{${k}}{1}$: Dann wird der Zähler multipliziert.`,
        ),
      },
      flip,
    ];
  }
  const L = lcm(A.d, B.d);
  return [
    {
      v: fq(((A.n * L) / A.d) * ((B.n * L) / B.d), L),
      title: A.d === B.d ? tx("Denominator kept", "Nenner beibehalten") : tx("Common denominator kept", "Hauptnenner behalten"),
      say:
        A.d === B.d
          ? tx(
              "Ah, I see what happened! You kept the denominator, like when adding. When multiplying, the denominators get multiplied too: top times top, bottom times bottom.",
              "Ah, ich seh, was passiert ist! Du hast den Nenner behalten wie beim Addieren. Beim Multiplizieren werden auch die Nenner multipliziert: Zähler mal Zähler, Nenner mal Nenner.",
            )
          : tx(
              "I think I know what you did: you made a common denominator and kept it, like when adding. For multiplying you don't need one: top times top, bottom times bottom.",
              "Ich glaub, ich weiß, was du gemacht hast: Du hast einen Hauptnenner gebildet und ihn behalten wie beim Addieren. Beim Multiplizieren brauchst du keinen: Zähler mal Zähler, Nenner mal Nenner.",
            ),
    },
    flip,
  ];
}

/** Dividing A by B (B may be a whole number). */
function divSlips(A: Frac, B: Frac): Slip[] {
  const k = B.d === 1 ? B.n : 0;
  return [
    {
      v: fq(A.n * B.n, A.d * B.d),
      title: NO_FLIP,
      say: k
        ? tx(
            `Ah, you multiplied by $${k}$! Dividing by $${k}$ means multiplying by its reciprocal $\\frac{1}{${k}}$.`,
            `Ah, du hast mit $${k}$ multipliziert! Durch $${k}$ teilen heißt: mit dem Kehrwert $\\frac{1}{${k}}$ multiplizieren.`,
          )
        : NO_FLIP_SAY,
    },
    {
      v: fq(A.d * B.n, A.n * B.d),
      title: tx("Wrong fraction flipped", "Falschen Bruch umgedreht"),
      say: tx(
        "So close! You flipped the **first** fraction. Only the one you divide by gets turned upside down.",
        "Ganz knapp! Du hast den **ersten** Bruch umgedreht. Umgedreht wird nur der, durch den du teilst.",
      ),
    },
    {
      v: fq(A.d * B.d, A.n * B.n),
      title: tx("Both flipped", "Beide umgedreht"),
      say: tx("Nearly! You flipped **both** fractions. Only the second one becomes its reciprocal.", "Fast! Du hast **beide** Brüche umgedreht. Nur der zweite wird zum Kehrwert."),
    },
  ];
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
  put(
    b,
    src(A),
    tx(
      `Find the largest number that divides both $${n}$ and $${d}$. Here it's $${k}$.`,
      `Such die größte Zahl, durch die $${n}$ und $${d}$ beide teilbar sind (den ggT). Hier ist es $${k}$.`,
    ),
    { highlight: [A.kn, A.kd] },
  );
  simplify(b, A);
  finish(b.frames, { n: n0, d: d0 });
  return {
    instruction: tx("Simplify fully", "Kürze vollständig"),
    math: fr(n, d),
    answer: fracAnswer({ n: n0, d: d0 }),
    hint: tx(
      `Which number divides both $${n}$ and $${d}$? You can also go in small steps, e.g. divide by $${smallestPrime(k)}$ first.`,
      `Durch welche Zahl sind $${n}$ und $${d}$ beide teilbar? Du kannst auch in kleinen Schritten kürzen, z. B. zuerst durch $${smallestPrime(k)}$.`,
    ),
    solution: b.frames,
    mistakes: slipsFor({ n: n0, d: d0 }, simplifySlips(n, d, k)),
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
  put(b, `${left()} =#eq ${right(false)}`, tx(`From $${knownL}$ to $${knownR}$: that's $${opT} ${k}$.`, `Von $${knownL}$ zu $${knownR}$: Das ist $${opT} ${k}$.`), {
    highlight: gapTop ? ["ad", "bd"] : ["an", "bn"],
  });
  put(
    b,
    `${left("x")} =#eq ${right(false)}`,
    expand
      ? tx("Expanding: multiply top **and** bottom by the same number.", "Erweitern: Zähler **und** Nenner mit derselben Zahl multiplizieren.")
      : tx("Simplifying: divide top **and** bottom by the same number.", "Kürzen: Zähler **und** Nenner durch dieselbe Zahl teilen."),
    { highlight: ["ak", "dk"] },
  );
  const [from, to] = gapTop ? [ln, rn] : [ld, rd];
  put(
    b,
    `${left()} =#eq ${right(true)}`,
    tx(`$${from} ${opT} ${k} = ${to}$. So $${fr(ln, ld)} = ${fr(rn, rd)}$.`, `$${from} ${opT} ${k} = ${to}$. Also ist $${fr(ln, ld)} = ${fr(rn, rd)}$.`),
    { highlight: ["q"] },
  );
  const deHow = expand ? "Mit welcher Zahl musst du" : "Durch welche Zahl musst du";
  const deVerb = expand ? "multiplizieren" : "teilen";
  const [shown, gap] = gapTop ? [tx("denominator", "Nenner"), tx("numerator", "Zähler")] : [tx("numerator", "Zähler"), tx("denominator", "Nenner")];
  const en = (t: Text) => resolveText(t, "en");
  const de = (t: Text) => resolveText(t, "de");
  const step = Math.abs(knownR - knownL);
  const slips: Slip[] = [
    // Additive thinking: the same number added (or taken away) on top and bottom.
    {
      v: fq(from + knownR - knownL, 1),
      title: expand ? tx("Added instead of multiplied", "Addiert statt multipliziert") : tx("Subtracted instead of divided", "Subtrahiert statt geteilt"),
      say: expand
        ? tx(
            `Ah, I see what happened! From $${knownL}$ to $${knownR}$ you added $${step}$, and then added the same to the ${en(gap)}. But expanding means **multiplying** top and bottom by the same number.`,
            `Ah, ich seh, was passiert ist! Von $${knownL}$ zu $${knownR}$ hast du $${step}$ addiert und beim ${de(gap)} dasselbe draufgerechnet. Erweitern heißt aber: Zähler und Nenner mit derselben Zahl **multiplizieren**.`,
          )
        : tx(
            `Ah, I see what happened! From $${knownL}$ to $${knownR}$ you subtracted $${step}$, and then subtracted the same from the ${en(gap)}. But simplifying means **dividing** top and bottom by the same number.`,
            `Ah, ich seh, was passiert ist! Von $${knownL}$ zu $${knownR}$ hast du $${step}$ abgezogen und beim ${de(gap)} dasselbe abgezogen. Kürzen heißt aber: Zähler und Nenner durch dieselbe Zahl **teilen**.`,
          ),
    },
    // The factor itself as the answer.
    {
      v: fq(k, 1),
      title: expand ? tx("That's the factor", "Das ist der Faktor") : tx("That's the divisor", "Das ist die Kürzungszahl"),
      say: expand
        ? tx(
            `Nearly! $${k}$ is the right factor: the ${en(shown)} got multiplied by it. Now multiply the ${en(gap)} by $${k}$ too.`,
            `Fast! $${k}$ ist der richtige Faktor: Der ${de(shown)} wurde damit multipliziert. Jetzt nimm auch den ${de(gap)} mal $${k}$.`,
          )
        : tx(
            `Nearly! $${k}$ is the right number: the ${en(shown)} got divided by it. Now divide the ${en(gap)} by $${k}$ too.`,
            `Fast! $${k}$ ist die richtige Zahl: Der ${de(shown)} wurde durch sie geteilt. Jetzt teile auch den ${de(gap)} durch $${k}$.`,
          ),
    },
  ];
  return {
    instruction: tx("Fill in the gap", "Ergänze die fehlende Zahl"),
    math: `${fr(ln, ld)} = \\frac{${gapTop ? "\\box{?}" : rn}}{${gapTop ? rd : "\\box{?}"}}`,
    answer: { kind: "number", value: to },
    hint: gapTop
      ? tx(
          `Compare the denominators. What do you ${expand ? "multiply" : "divide"} $${ld}$ by to get $${rd}$?`,
          `Vergleiche die Nenner. ${deHow} $${ld}$ ${deVerb}, um $${rd}$ zu bekommen?`,
        )
      : tx(
          `Compare the numerators. What do you ${expand ? "multiply" : "divide"} $${ln}$ by to get $${rn}$?`,
          `Vergleiche die Zähler. ${deHow} $${ln}$ ${deVerb}, um $${rn}$ zu bekommen?`,
        ),
    solution: b.frames,
    mistakes: slipsFor({ n: to, d: 1 }, slips),
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
  put(b, `${src(A)} ${op}#op ${src(B)}`, tx("Both fractions have the same denominator. Good news!", "Beide Brüche haben denselben Nenner. Super!"), { highlight: [A.kd, B.kd] });
  addSub(b, A, B, sign, "op");
  finish(b.frames, r);
  return {
    instruction: CALC_SIMPLIFY,
    math: `${fr(x, d)} ${op} ${fr(y, d)}`,
    answer: fracAnswer(r),
    hint: tx(
      `Same denominator: ${sign > 0 ? "add" : "subtract"} the numerators and keep the denominator. Then simplify if you can.`,
      `Gleicher Nenner: ${sign > 0 ? "Addiere" : "Subtrahiere"} die Zähler, der Nenner bleibt. Kürze dann, wenn es geht.`,
    ),
    solution: b.frames,
    mistakes: slipsFor(r, [
      sign > 0 && {
        v: fq(x + y, 2 * d),
        title: tx("Denominators added", "Nenner addiert"),
        say: tx(
          `Ooh, classic trap! The denominators are already the same, so they don't get added: the denominator just stays $${d}$. Only the numerators are added.`,
          `Die klassische Falle! Die Nenner sind schon gleich, die werden nicht addiert: Der Nenner bleibt einfach $${d}$. Nur die Zähler werden addiert.`,
        ),
      },
      {
        v: fq(x + sign * y, d * d),
        title: tx("Denominators multiplied", "Nenner multipliziert"),
        say: tx(
          `Ah, I see what happened! You multiplied the denominators, like when multiplying fractions. Here they're already the same, so the denominator just stays $${d}$.`,
          `Ah, ich seh, was passiert ist! Du hast die Nenner multipliziert wie beim Multiplizieren von Brüchen. Hier sind sie schon gleich, der Nenner bleibt also einfach $${d}$.`,
        ),
      },
    ]),
  };
}

const CALC_SIMPLIFY = tx("Calculate and simplify", "Berechne und kürze");
const CALCULATE = tx("Calculate", "Berechne");
const WORD_PROBLEM = tx("Word problem", "Textaufgabe");
const STUDENTS = tx("students", "Schüler");

const OF_STORIES: { unit: Unit; scale: number; max: number; text: (f: string, q: number) => Text }[] = [
  {
    unit: STUDENTS,
    scale: 1,
    max: 32,
    text: (f, q) =>
      tx(
        `A class has ${q} students. ${f} of them come to school by bike. How many students is that?`,
        `Eine Klasse hat ${q} Schülerinnen und Schüler. ${f} davon kommen mit dem Fahrrad zur Schule. Wie viele sind das?`,
      ),
  },
  {
    unit: "€",
    scale: 1,
    max: 120,
    text: (f, q) => tx(`Mia gets ${q} € for her birthday. She saves ${f} of it. How much money does she save?`, `Mia bekommt ${q}\u00a0€ zum Geburtstag. Sie spart ${f} davon. Wie viel Geld spart sie?`),
  },
  {
    unit: "km",
    scale: 1,
    max: 90,
    text: (f, q) =>
      tx(
        `A bike tour is ${q} km long. By the lunch break, ${f} of the tour is done. How many kilometres is that?`,
        `Eine Radtour ist ${q} km lang. Bis zur Mittagspause ist ${f} der Strecke geschafft. Wie viele Kilometer sind das?`,
      ),
  },
  {
    unit: "g",
    scale: 50,
    max: 1000,
    text: (f, q) =>
      tx(
        `A bag of flour holds ${q} g. A cake needs ${f} of it. How many grams is that?`,
        `In einer Packung Mehl sind ${q} g. Für einen Kuchen braucht man ${f} davon. Wie viel Gramm sind das?`,
      ),
  },
  {
    unit: tx("pages", "Seiten"),
    scale: 10,
    max: 400,
    text: (f, q) =>
      tx(`Ben's book has ${q} pages. He has read ${f} of it. How many pages has he read?`, `Bens Buch hat ${q} Seiten. ${f} davon hat er schon gelesen. Wie viele Seiten sind das?`),
  },
  {
    unit: tx("members", "Mitglieder"),
    scale: 1,
    max: 120,
    text: (f, q) =>
      tx(`A sports club has ${q} members. ${f} of them play football. How many members is that?`, `Ein Sportverein hat ${q} Mitglieder. ${f} davon spielen Fußball. Wie viele Mitglieder sind das?`),
  },
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
    instruction: asText ? WORD_PROBLEM : CALCULATE,
    ...(asText ? { text: story.text(`$${fr(n, d)}$`, q) } : { math: tx(`${fr(n, d)} "of" ${q}`, `${fr(n, d)} "von" ${q}`) }),
    answer: { kind: "number", value: (q / d) * n, ...(asText ? { unit: story.unit } : {}) },
    hint: tx(
      `First find $\\frac{1}{${d}}$ of $${q}$: divide by $${d}$. Then multiply by $${n}$.`,
      `Berechne zuerst $\\frac{1}{${d}}$ von $${q}$: Teile durch $${d}$. Multipliziere dann mit $${n}$.`,
    ),
    solution: b.frames,
    mistakes: slipsFor({ n: (q / d) * n, d: 1 }, ofSlips(n, d, q, asText), asText ? story.unit : undefined),
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
  put(
    b,
    src(A),
    tx(
      `Count: $${n}$ of the $${d}$ equal parts are shaded. That's $${fr(n, d)}$.`,
      `Zähle: $${n}$ von $${d}$ gleich großen Teilen sind gefärbt. Das sind $${fr(n, d)}$.`,
    ),
    { highlight: [A.kn, A.kd] },
  );
  simplify(b, A);
  if (r.d === d) appendNote(b.frames, tx("It can't be simplified any further.", "Weiter kürzen geht nicht."));
  return {
    instruction: tx("Name the shaded part", "Gib den gefärbten Anteil an"),
    text: tx("What fraction of the shape is shaded? Simplify fully.", "Welcher Bruchteil der Figur ist gefärbt? Kürze vollständig."),
    answer: fracAnswer(r),
    hint: tx(
      "Count all the equal parts (denominator) and the shaded ones (numerator). Then simplify.",
      "Zähle alle gleich großen Teile (Nenner) und die gefärbten (Zähler). Kürze dann.",
    ),
    solution: b.frames,
    visual: picture(n, d, shape),
    mistakes: slipsFor(r, [
      {
        v: fq(d - n, d),
        title: tx("Counted the white parts", "Die weißen Teile gezählt"),
        say: tx(
          "Ah, I see what happened! You counted the parts that are **not** shaded. The numerator counts the coloured ones.",
          "Ah, ich seh, was passiert ist! Du hast die **nicht** gefärbten Teile gezählt. Der Zähler zählt die gefärbten.",
        ),
      },
      {
        v: fq(n, d - n),
        title: tx("Shaded compared with white", "Gefärbt mit weiß verglichen"),
        say: tx(
          "I think I know what you did: you put the shaded parts over the white ones. The denominator counts **all** the parts, shaded and white together.",
          "Ich glaub, ich weiß, was du gemacht hast: Du hast die gefärbten Teile oben und die weißen unten hingeschrieben. Der Nenner zählt aber **alle** Teile, gefärbte und weiße zusammen.",
        ),
      },
    ]),
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
    instruction: CALC_SIMPLIFY,
    math: `${frf(P)} ${op} ${frf(Q)}`,
    answer: fracAnswer(r),
    hint: tx(
      `Find the lowest common denominator of $${P.d}$ and $${Q.d}$ first. Then expand both fractions.`,
      `Bestimme zuerst den Hauptnenner von $${P.d}$ und $${Q.d}$. Erweitere dann beide Brüche.`,
    ),
    solution: b.frames,
    mistakes: slipsFor(r, addSubSlips(P, Q, sign)),
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
    cross || withWhole
      ? tx("Multiplying fractions: no common denominator needed.", "Beim Multiplizieren brauchst du keinen gemeinsamen Nenner.")
      : tx("No common denominator needed, and nothing to simplify crosswise here.", "Kein gemeinsamer Nenner nötig, und über Kreuz kürzen geht hier nicht."),
  );
  mul(b, X, Y, "op");
  finish(b.frames, r);
  return {
    instruction: CALC_SIMPLIFY,
    math: `${frf(A)} \\cdot ${frf(B)}`,
    answer: fracAnswer(r),
    hint: withWhole
      ? tx(
          "Write the whole number as a fraction with denominator $1$. Then top times top, bottom times bottom.",
          "Schreib die ganze Zahl als Bruch mit dem Nenner $1$. Dann Zähler mal Zähler, Nenner mal Nenner.",
        )
      : cross
        ? tx(
            "Simplify crosswise first: a numerator and the **other** denominator share a factor.",
            "Kürze zuerst über Kreuz: Ein Zähler und der **andere** Nenner haben einen gemeinsamen Teiler.",
          )
        : TOP_TIMES_TOP,
    solution: b.frames,
    mistakes: slipsFor(r, mulSlips(A, B)),
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
    instruction: CALC_SIMPLIFY,
    math: `${frf(A)} : ${frf(B)}`,
    answer: fracAnswer(r),
    hint:
      B.d === 1
        ? tx(
            `Dividing by $${B.n}$ is the same as multiplying by $\\frac{1}{${B.n}}$.`,
            `Durch $${B.n}$ teilen ist dasselbe wie mit $\\frac{1}{${B.n}}$ multiplizieren.`,
          )
        : tx(`Multiply by the reciprocal: $${frf(B)}$ becomes $${fr(B.d, B.n)}$.`, `Multipliziere mit dem Kehrwert: Aus $${frf(B)}$ wird $${fr(B.d, B.n)}$.`),
    solution: b.frames,
    mistakes: slipsFor(r, divSlips(A, B)),
  };
}

type Story2 = (f1: string, f2: string) => Text;

const SUM_STORIES: Story2[] = [
  (f1, f2) =>
    tx(
      `Leon reads ${f1} of his book on Monday and ${f2} of it on Tuesday. What fraction of the book has he read so far?`,
      `Leon liest am Montag ${f1} seines Buches und am Dienstag ${f2}. Welchen Bruchteil des Buches hat er bisher gelesen?`,
    ),
  (f1, f2) =>
    tx(
      `In a garden, ${f1} of the area is used for vegetables and ${f2} for flowers. What fraction of the garden is used?`,
      `In einem Schrebergarten werden ${f1} der Fläche für Gemüse und ${f2} für Blumen genutzt. Welcher Bruchteil des Gartens wird genutzt?`,
    ),
  (f1, f2) =>
    tx(
      `On a hike, Emma walks ${f1} of the route before lunch and ${f2} of it after lunch. What fraction of the route has she walked?`,
      `Bei einer Wanderung schafft Emma vor dem Mittagessen ${f1} der Strecke und danach ${f2}. Welchen Bruchteil der Strecke hat sie geschafft?`,
    ),
];
const DIFF_STORIES: Story2[] = [
  (f1, f2) =>
    tx(
      `A jug holds ${f1} l of juice. Tim pours ${f2} l into a glass. How many litres are left in the jug?`,
      `In einem Krug sind ${f1} l Saft. Tim gießt ${f2} l in ein Glas. Wie viele Liter sind noch im Krug?`,
    ),
  (f1, f2) =>
    tx(
      `A path is ${f1} km long. Sara has already walked ${f2} km. How far does she still have to go (in km)?`,
      `Ein Weg ist ${f1} km lang. Sara ist schon ${f2} km gegangen. Wie weit muss sie noch gehen (in km)?`,
    ),
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
  put(
    b,
    `${src(X)} ${op}#op ${src(Y)}`,
    sign > 0 ? tx("Both parts together: add them.", "Beide Teile zusammen: addieren.") : tx("Take the second amount away: subtract.", "Der zweite Teil wird weggenommen: subtrahieren."),
  );
  addSub(b, X, Y, sign, "op");
  finish(b.frames, r);
  return {
    instruction: WORD_PROBLEM,
    text: story(`$${frf(P)}$`, `$${frf(Q)}$`),
    answer: fracAnswer(r),
    hint: tx(
      `${sign > 0 ? "Add" : "Subtract"} the two fractions. You need a common denominator first.`,
      `${sign > 0 ? "Addiere" : "Subtrahiere"} die beiden Brüche. Dafür brauchst du zuerst einen gemeinsamen Nenner.`,
    ),
    solution: b.frames,
    mistakes: slipsFor(r, addSubSlips(P, Q, sign)),
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
    mixed.length > 1
      ? tx("First turn both mixed numbers into improper fractions.", "Wandle zuerst beide gemischten Zahlen in unechte Brüche um.")
      : tx("First turn the mixed number into an improper fraction.", "Wandle zuerst die gemischte Zahl in einen unechten Bruch um."),
    { highlight: mixed.map((m) => `${m.id}w`) },
  );
  put(b, `${mWork(M1)} ${sym}#op ${mWork(M2)}`, tx("Whole number times denominator, plus numerator.", "Ganze Zahl mal Nenner, plus Zähler."), {
    highlight: mixed.flatMap((m) => [`${m.id}w`, `${m.id}k`]),
  });
  const X = mImproper(M1);
  const Y = mImproper(M2);
  const sums = (and: string) => `${mixed.map((m) => `$${m.w} \\cdot ${m.d} + ${m.n} = ${m.w * m.d + m.n}$`).join(` ${and} `)}.`;
  put(b, `${src(X)} ${sym}#op ${src(Y)}`, tx(sums("and"), sums("und")));
  if (op === "+" || op === "-") addSub(b, X, Y, op === "+" ? 1 : -1, "op");
  else if (op === "*") mul(b, X, Y, "op");
  else div(b, X, Y, "op");
  finish(b.frames, r);
  return {
    instruction: CALCULATE,
    math: `${mTx(M1)} ${sym} ${mTx(M2)}`,
    answer: fracAnswer(r),
    hint: tx(
      "Turn mixed numbers into improper fractions first: whole number times denominator, plus numerator. The answer can be an improper fraction.",
      "Wandle gemischte Zahlen zuerst in unechte Brüche um: ganze Zahl mal Nenner, plus Zähler. Das Ergebnis darf ein unechter Bruch sein.",
    ),
    solution: b.frames,
    mistakes: slipsFor(r, mixedSlips(M1, M2, op)),
  };
}

/** Mixed numbers: converting them wrongly, or working with wholes and fractions separately. */
function mixedSlips(M1: MixedN, M2: MixedN, op: "+" | "-" | "*" | ":"): Slip[] {
  const calc = (x: Frac, y: Frac) => (op === "+" ? add(x, y) : op === "-" ? sub(x, y) : op === "*" ? mulF(x, y) : divF(x, y));
  const value = (m: MixedN) => frac(m.w * m.d + m.n, m.d);
  const part = (m: MixedN) => frac(m.n, m.d);
  const shown = M1.w ? M1 : M2;
  const out: Slip[] = [
    // 2 3/4 written as 5/4: the whole number added to the numerator.
    {
      v: pos(calc(frac(M1.w + M1.n, M1.d), frac(M2.w + M2.n, M2.d))),
      title: tx("Mixed number converted wrongly", "Gemischte Zahl falsch umgewandelt"),
      say: tx(
        `I think I know what you did: you turned $${mTx(shown)}$ into $\\frac{${shown.w + shown.n}}{${shown.d}}$. But each whole is $${shown.d}$ pieces: whole number **times** denominator, plus numerator.`,
        `Ich glaub, ich weiß, was du gemacht hast: Du hast aus $${mTx(shown)}$ den Bruch $\\frac{${shown.w + shown.n}}{${shown.d}}$ gemacht. Aber jedes Ganze sind $${shown.d}$ Stücke: ganze Zahl **mal** Nenner, plus Zähler.`,
      ),
    },
  ];
  if (op === "+") {
    const parts = numDenSlip(part(M1), part(M2), 1, ["For the fraction parts", "bei den Brüchen "]);
    if (parts && parts.v) out.push({ ...parts, v: add(frac(M1.w + M2.w), parts.v) });
  } else if (op === "-" && M1.n * M2.d < M2.n * M1.d) {
    // Smaller fraction minus bigger fraction, "fixed" by swapping them.
    out.push({
      v: pos(add(frac(M1.w - M2.w), sub(part(M2), part(M1)))),
      title: tx("Fractions subtracted the wrong way", "Brüche andersrum abgezogen"),
      say: tx(
        `Ah, I see what happened! $${fr(M1.n, M1.d)}$ is smaller than $${fr(M2.n, M2.d)}$, so you took the small one from the big one. That turns the subtraction around: change both into improper fractions first.`,
        `Ah, ich seh, was passiert ist! $${fr(M1.n, M1.d)}$ ist kleiner als $${fr(M2.n, M2.d)}$, also hast du den kleinen vom großen abgezogen. Damit drehst du die Rechnung um: Wandle zuerst beide in unechte Brüche um.`,
      ),
    });
  } else if (op === "*") {
    out.push(
      M2.w
        ? {
            v: add(frac(M1.w * M2.w), mulF(part(M1), part(M2))),
            title: tx("Wholes and fractions separately", "Ganze und Brüche einzeln"),
            say: tx(
              "Ooh, tempting! You multiplied the whole numbers and the fractions separately. That works for adding, but not for multiplying: turn the mixed numbers into improper fractions first.",
              "Ooh, verlockend! Du hast die Ganzen und die Brüche einzeln multipliziert. Beim Addieren klappt das, beim Multiplizieren nicht: Wandle die gemischten Zahlen zuerst in unechte Brüche um.",
            ),
          }
        : {
            v: add(frac(M1.w), mulF(part(M1), part(M2))),
            title: tx("Only the fraction part multiplied", "Nur den Bruchteil multipliziert"),
            say: tx(
              `Ah, you multiplied only the fraction part of $${mTx(M1)}$ and left the $${M1.w}$ as it was. The wholes have to be multiplied too: turn it into an improper fraction first.`,
              `Ah, du hast nur den Bruchteil von $${mTx(M1)}$ multipliziert und die $${M1.w}$ stehen lassen. Die Ganzen müssen mitmultipliziert werden: Wandle zuerst in einen unechten Bruch um.`,
            ),
          },
    );
  } else if (op === ":") {
    out.push({ v: mulF(value(M1), value(M2)), title: NO_FLIP, say: NO_FLIP_SAY });
    if (!M2.w)
      out.push({
        v: add(frac(M1.w), divF(part(M1), part(M2))),
        title: tx("Only the fraction part divided", "Nur den Bruchteil geteilt"),
        say: tx(
          `Ah, you divided only the fraction part of $${mTx(M1)}$ and left the $${M1.w}$ as it was. The wholes have to be divided too: turn it into an improper fraction first.`,
          `Ah, du hast nur den Bruchteil von $${mTx(M1)}$ geteilt und die $${M1.w}$ stehen lassen. Die Ganzen müssen mitgeteilt werden: Wandle zuerst in einen unechten Bruch um.`,
        ),
      });
  }
  return out;
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
  put(
    b,
    `${src(XK)} ${osym}#o1 ${src(YK)} ${isym}#o2 ${src(ZK)}`,
    tx("Multiplication and division come first (**Punkt vor Strich**).", "**Punkt vor Strich**: Erst wird multipliziert und dividiert."),
    { highlight: [YK.kn, YK.kd, "o2", ZK.kn, ZK.kd] },
  );
  b.pre = `${src(XK)} ${osym}#o1 `;
  const PK = times ? mul(b, YK, ZK, "o2") : div(b, YK, ZK, "o2");
  b.pre = "";
  addSub(b, XK, PK, sign, "o1");
  finish(b.frames, r);
  return {
    instruction: CALCULATE,
    math: `${frf(X)} ${osym} ${frf(Y)} ${isym} ${frf(Z)}`,
    answer: fracAnswer(r),
    hint: tx(`Punkt vor Strich: work out $${frf(Y)} ${isym} ${frf(Z)}$ first.`, `Punkt vor Strich: Rechne zuerst $${frf(Y)} ${isym} ${frf(Z)}$ aus.`),
    solution: b.frames,
    mistakes: slipsFor(r, [
      {
        v: pos((times ? mulF : divF)(sign > 0 ? add(X, Y) : sub(X, Y), Z)),
        title: tx("Left to right", "Von links nach rechts gerechnet"),
        say: tx(
          `Ah, you worked from left to right! But multiplying and dividing come first (Punkt vor Strich): start with $${frf(Y)} ${isym} ${frf(Z)}$.`,
          `Ah, du hast von links nach rechts gerechnet! Aber Punkt vor Strich: Fang mit $${frf(Y)} ${isym} ${frf(Z)}$ an.`,
        ),
      },
      !times && { v: pos(sign > 0 ? add(X, mulF(Y, Z)) : sub(X, mulF(Y, Z))), title: NO_FLIP, say: NO_FLIP_SAY },
      numDenSlip(X, P, sign, ["In the last step", "im letzten Schritt "]),
    ]),
  };
}

const BRACKET_GONE = tx("The bracket is a single fraction now, so the brackets can go.", "In der Klammer steht jetzt nur noch ein Bruch, die Klammern können weg.");

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
  put(b, `(${src(PK)} ${osym}#o1 ${src(QK)})#br ${isym}#o2 ${src(ZK)}`, tx("Brackets first.", "Klammer zuerst."), { highlight: ["br(", "br)"] });
  b.pre = "(";
  b.post = `)#br ${isym}#o2 ${src(ZK)}`;
  const SK = addSub(b, PK, QK, sign, "o1");
  b.pre = "";
  b.post = "";
  if (times) {
    put(b, `${src(SK)} \\cdot#o2 ${src(ZK)}`, BRACKET_GONE);
    mul(b, SK, ZK, "o2");
  } else {
    div(
      b,
      SK,
      ZK,
      "o2",
      tx(
        "The bracket is a single fraction now, so the brackets can go. To divide, multiply by the reciprocal.",
        "In der Klammer steht jetzt nur noch ein Bruch, die Klammern können weg. Dividieren heißt: mit dem Kehrwert multiplizieren.",
      ),
    );
  }
  finish(b.frames, r);
  return {
    instruction: CALCULATE,
    math: `(${frf(P)} ${osym} ${frf(Q)}) ${isym} ${frf(Z)}`,
    answer: fracAnswer(r),
    hint: tx("Work out the bracket first. Then multiply or divide.", "Rechne zuerst die Klammer aus. Dann multiplizieren oder dividieren."),
    solution: b.frames,
    mistakes: slipsFor(r, bracketSlips(P, Q, Z, sign, times)),
  };
}

/** (P ± Q) · Z or (P ± Q) : Z. */
function bracketSlips(P: Frac, Q: Frac, Z: Frac, sign: 1 | -1, times: boolean): Slip[] {
  const inner = (x: Frac, y: Frac) => (sign > 0 ? add(x, y) : sub(x, y));
  const outer = times ? mulF : divF;
  const S = inner(P, Q);
  const wrongInside = numDenSlip(P, Q, sign, ["Inside the bracket", "in der Klammer "]);
  return [
    {
      v: pos(inner(P, outer(Q, Z))),
      title: tx("Bracket skipped", "Klammer übergangen"),
      say: tx(
        `I think I know what you did: you ${times ? "multiplied" : "divided"} first. But the bracket comes before everything: work out $${frf(P)} ${sign > 0 ? "+" : "-"} ${frf(Q)}$ first.`,
        `Ich glaub, ich weiß, was du gemacht hast: Du hast zuerst ${times ? "multipliziert" : "dividiert"}. Aber die Klammer kommt vor allem anderen: Rechne zuerst $${frf(P)} ${sign > 0 ? "+" : "-"} ${frf(Q)}$ aus.`,
      ),
    },
    wrongInside && wrongInside.v ? { ...wrongInside, v: outer(wrongInside.v, Z) } : null,
    !times && { v: mulF(S, Z), title: NO_FLIP, say: NO_FLIP_SAY },
  ];
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
  put(
    b,
    `\\frac{\\,\\, ${src(X)} \\,\\,}{\\,\\, ${src(Y)} \\,\\,}#big`,
    tx("A **double fraction** (Doppelbruch). The long fraction bar means: divide.", "Ein **Doppelbruch**. Der lange Bruchstrich bedeutet: geteilt durch."),
    { highlight: ["big-bar"] },
  );
  div(
    b,
    X,
    Y,
    "op",
    tx(
      "Write it as a division: top $:$ bottom. Then multiply by the reciprocal (Kehrwert).",
      "Schreib ihn als Division: oberer Bruch $:$ unterer Bruch. Dann mit dem Kehrwert multiplizieren.",
    ),
  );
  finish(b.frames, r);
  return {
    instruction: tx("Simplify the double fraction", "Vereinfache den Doppelbruch"),
    math: `\\frac{\\,\\, ${frf(A)} \\,\\,}{\\,\\, ${frf(B)} \\,\\,}`,
    answer: fracAnswer(r),
    hint: tx(
      "The long bar means divide: top fraction $:$ bottom fraction. Then multiply by the reciprocal.",
      "Der lange Bruchstrich heißt geteilt: oberer Bruch $:$ unterer Bruch. Dann mit dem Kehrwert multiplizieren.",
    ),
    solution: b.frames,
    mistakes: slipsFor(r, [
      {
        v: mulF(A, B),
        title: NO_FLIP,
        say: tx(
          "Ah, you multiplied the two fractions! The long bar means **divide**: top fraction $:$ bottom fraction, so multiply by the reciprocal of the bottom one.",
          "Ah, du hast die beiden Brüche multipliziert! Der lange Bruchstrich heißt **geteilt**: oberer Bruch $:$ unterer Bruch, also mit dem Kehrwert des unteren multiplizieren.",
        ),
      },
      {
        v: divF(B, A),
        title: tx("Top and bottom swapped", "Oben und unten vertauscht"),
        say: tx(
          "So close! You divided the bottom fraction by the top one. The long bar means **top : bottom**, so it's the bottom fraction that gets flipped.",
          "Ganz knapp! Du hast den unteren Bruch durch den oberen geteilt. Der lange Bruchstrich heißt **oben : unten**, umgedreht wird also der untere Bruch.",
        ),
      },
    ]),
  };
}

const LEFT_STORIES: Story2[] = [
  (f1, f2) =>
    tx(
      `Tim eats ${f1} of a pizza and Ali eats ${f2} of it. What fraction of the pizza is left?`,
      `Tim isst ${f1} einer Pizza, Ali isst ${f2} davon. Welcher Bruchteil der Pizza ist übrig?`,
    ),
  (f1, f2) =>
    tx(
      `In class 7c, ${f1} of the students walk to school and ${f2} take the bus. The rest come by bike. What fraction of the class comes by bike?`,
      `In der Klasse 7c gehen ${f1} der Kinder zu Fuß zur Schule und ${f2} fahren mit dem Bus. Der Rest kommt mit dem Fahrrad. Welcher Bruchteil der Klasse kommt mit dem Fahrrad?`,
    ),
  (f1, f2) =>
    tx(
      `Jana spends ${f1} of her pocket money on clothes and ${f2} on snacks. What fraction of her pocket money is left?`,
      `Jana gibt ${f1} ihres Taschengelds für Kleidung aus und ${f2} für Süßigkeiten. Welcher Bruchteil ihres Taschengelds bleibt übrig?`,
    ),
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
  put(b, `${src(X)} +#op ${src(Y)}`, tx("First add up the two parts that are gone.", "Addiere zuerst die beiden Teile, die weg sind."));
  const SK = addSub(b, X, Y, 1, "op");
  const O: KF = { n: SK.d, d: SK.d, kn: "on", kd: "od", kf: "of", asFrac: true };
  put(b, `1#on -#m ${src(SK)}`, tx("The whole is $1$. Subtract what's gone.", "Das Ganze ist $1$. Zieh ab, was weg ist."));
  put(b, `${src(O)} -#m ${src(SK)}`, tx(`Write the whole as $1 = ${fr(SK.d, SK.d)}$.`, `Schreib das Ganze als $1 = ${fr(SK.d, SK.d)}$.`), { highlight: ["on", "od"] });
  addSub(b, O, SK, -1, "m");
  finish(b.frames, r);
  return {
    instruction: WORD_PROBLEM,
    text: rng.pick(LEFT_STORIES)(`$${frf(A)}$`, `$${frf(B)}$`),
    answer: fracAnswer(r),
    hint: tx("Add the two parts. The rest is $1$ minus that sum.", "Addiere die beiden Teile. Der Rest ist $1$ minus diese Summe."),
    solution: b.frames,
    mistakes: slipsFor(r, leftoverSlips(A, B)),
  };
}

/** What's left of a whole after two parts (1 − A − B). */
function leftoverSlips(A: Frac, B: Frac): Slip[] {
  const wrongSum = numDenSlip(A, B, 1, ["For the two parts", "bei den beiden Teilen "]);
  return [
    {
      v: add(A, B),
      title: tx("That's the part that's gone", "Das ist der Teil, der weg ist"),
      say: tx(
        "Nearly! That's how much is **gone**. The question asks what's **left**: take it away from the whole, which is $1$.",
        "Fast! Das ist der Teil, der **weg** ist. Gefragt ist, was **übrig** bleibt: Zieh das vom Ganzen ab, also von $1$.",
      ),
    },
    wrongSum && wrongSum.v ? { ...wrongSum, v: pos(sub(frac(1), wrongSum.v)) } : null,
  ];
}

const MONEY_STORIES: { text: (q: number, f1: string, f2: string) => Text; first: Text; second: Text }[] = [
  {
    text: (q, f1, f2) =>
      tx(
        `Lena gets ${q} € pocket money. She spends ${f1} of it on a book and ${f2} of it on a cinema ticket. How much money does she have left?`,
        `Lena bekommt ${q}\u00a0€ Taschengeld. Sie gibt ${f1} davon für ein Buch und ${f2} für eine Kinokarte aus. Wie viel Geld hat sie noch?`,
      ),
    first: tx("The book", "Das Buch"),
    second: tx("The cinema ticket", "Die Kinokarte"),
  },
  {
    text: (q, f1, f2) =>
      tx(
        `A class trip costs ${q} € per student. The parents pay ${f1} of it and the school pays ${f2}. The student pays the rest. How much is that?`,
        `Eine Klassenfahrt kostet ${q}\u00a0€ pro Kind. Die Eltern zahlen ${f1} davon, der Förderverein der Schule zahlt ${f2}. Den Rest zahlt jedes Kind selbst. Wie viel ist das?`,
      ),
    first: tx("The parents", "Die Eltern"),
    second: tx("The school", "Der Förderverein"),
  },
  {
    text: (q, f1, f2) =>
      tx(
        `Max earns ${q} € at a weekend job. He saves ${f1} of it and spends ${f2} on a video game. How much money is left?`,
        `Max verdient mit einem Ferienjob ${q}\u00a0€. Er spart ${f1} davon und gibt ${f2} für ein Videospiel aus. Wie viel Geld bleibt übrig?`,
      ),
    first: tx("Saved", "Gespart"),
    second: tx("The game", "Das Spiel"),
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
  const of = (en: string) => tx(en, en.replace('"of"', '"von"'));
  const b = board();
  put(b, of(`${src(kf(A.n, A.d, "a"))} "of"#o1 ${q}#q1 "€"#u1 =#e1 ${sa}#ra "€"#ua`), txMap((_, l) => `${resolveText(story.first, l)}: ${part(A.n, A.d)}${l === "de" ? "\u00a0" : " "}€.`));
  put(b, of(`${src(kf(B.n, B.d, "b"))} "of"#o2 ${q}#q2 "€"#u2 =#e2 ${sb}#rb "€"#ub`), txMap((_, l) => `${resolveText(story.second, l)}: ${part(B.n, B.d)}${l === "de" ? "\u00a0" : " "}€.`));
  put(
    b,
    `${q}#q "€"#u -#s1 ${sa}#ra "€"#ua -#s2 ${sb}#rb "€"#ub =#e3 ${left}#r "€"#ur`,
    tx(`Subtract both parts from the total: $${left}$ € are left.`, `Zieh beide Teile vom Gesamtbetrag ab: Es bleiben $${left}$\u00a0€ übrig.`),
    { highlight: ["r"] },
  );
  return {
    instruction: WORD_PROBLEM,
    text: story.text(q, `$${frf(A)}$`, `$${frf(B)}$`),
    answer: { kind: "number", value: left, unit: "€" },
    hint: tx(
      "Work out each part in euros first: divide by the denominator, multiply by the numerator. Then subtract both parts from the total.",
      "Rechne zuerst jeden Teil in Euro aus: durch den Nenner teilen, mit dem Zähler multiplizieren. Zieh dann beide Teile vom Gesamtbetrag ab.",
    ),
    solution: b.frames,
    mistakes: slipsFor(
      { n: left, d: 1 },
      [
        {
          v: fq(sa + sb, 1),
          title: tx("That's both parts together", "Das sind beide Teile zusammen"),
          say: tx(
            `Nearly! That's what the two parts add up to. The question asks what's **left** of the $${q}$ €.`,
            `Fast! So viel machen die beiden Teile zusammen aus. Gefragt ist, was von den $${q}$\u00a0€ **übrig** bleibt.`,
          ),
        },
        {
          v: fq((q - sa) * (B.d - B.n), B.d),
          title: tx("Second part of the rest", "Zweiter Teil vom Rest"),
          say: tx(
            `I think I know what you did: you took $${frf(B)}$ of what was left after the first part. But both fractions are of the **whole** $${q}$ €.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast $${frf(B)}$ vom Rest nach dem ersten Teil genommen. Aber beide Brüche beziehen sich auf die **ganzen** $${q}$\u00a0€.`,
          ),
        },
      ],
      "€",
    ),
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

/** Picks the English or German UI string for the current language. */
function usePick() {
  const de = useLocale() === "de";
  return (en: string, deText: string) => (de ? deText : en);
}

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
  const t = usePick();
  const C = 100;
  const R = 92;
  const v = useSpring(0, { stiffness: 150, damping: 22 });
  useEffect(() => {
    v.set(value);
  }, [v, value]);
  const d = useTransform(v, (t) => sectorPath(C, R, t));
  const lines: Cut[] = parts > 1 ? [{ key: "0-1", at: 0 }, ...cutsFor(parts)] : [];
  return (
    <svg viewBox="0 0 200 200" className={cn("block", className)} role="img" aria-label={t(`Circle cut into ${parts} parts`, `Kreis in ${parts} Teile geteilt`)}>
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
  const t = usePick();
  return (
    <div className="grid place-items-center px-2 py-4">
      {shape === "bar" ? (
        <FracBar parts={d} segs={[{ key: "s", from: 0, to: n / d }]} bg="var(--surface)" appear height={60} className="max-w-[440px]" label={t(`Bar cut into ${d} parts`, `Streifen in ${d} Teile geteilt`)} />
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
  const t = usePick();
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[12.5px] text-ink-2">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(`Decrease ${label}`, `${label} verkleinern`)}
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
        aria-label={t(`Increase ${label}`, `${label} vergrößern`)}
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
  const t = usePick();
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
    ? t("Expand or simplify and watch the purple part. Does it change size?", "Erweitere oder kürze und beobachte den lila Teil. Ändert sich seine Größe?")
    : last.op === "x"
      ? t(
          `Every part was cut into ${last.k} smaller ones. ${last.k} times as many parts, ${last.k} times as many shaded: the same amount.`,
          `Jedes Teil wurde in ${last.k} kleinere zerlegt. ${last.k}-mal so viele Teile und ${last.k}-mal so viele gefärbte: Der Anteil bleibt gleich.`,
        )
      : t(
          `Groups of ${last.k} parts were merged into one. Fewer, bigger parts, but still the same amount.`,
          `Je ${last.k} Teile wurden zu einem zusammengefasst. Weniger, dafür größere Teile, aber der Anteil bleibt gleich.`,
        );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          scope={scope}
          options={[
            ["bar", t("Bar", "Streifen")],
            ["circle", t("Circle", "Kreis")],
          ]}
          value={shape}
          onChange={setShape}
        />
        <Stepper label={t("Numerator", "Zähler")} value={cur.n} min={1} max={cur.d} onChange={(n) => build(n, cur.d)} />
        <Stepper label={t("Denominator", "Nenner")} value={cur.d} min={1} max={24} onChange={(d) => build(cur.n, d)} />
        <button
          type="button"
          onClick={() => build(2, 3)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t("Reset", "Zurücksetzen")}
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
                <FracBar parts={cur.d} segs={[{ key: "s", from: 0, to: cur.n / cur.d }]} bg="var(--surface)" height={64} label={t(`${cur.n} of ${cur.d} parts`, `${cur.n} von ${cur.d} Teilen`)} />
              ) : (
                <FracPie parts={cur.d} value={cur.n / cur.d} bg="var(--surface)" className="w-[190px]" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MathView src={formula} size="lg" scope={`${scope}-f`} highlight={lit} />
          <span className="text-[12.5px] text-ink-3">
            {t(`${cur.n} of ${cur.d} equal parts`, `${cur.n} von ${cur.d} gleich großen Teilen`)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Expand", "Erweitern")}</span>
          {[2, 3, 4].map((k) => (
            <Chip key={k} onClick={() => apply("x", k)} disabled={cur.d * k > 24} title={t(`Multiply top and bottom by ${k}`, `Zähler und Nenner mit ${k} multiplizieren`)}>
              · {k}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Simplify", "Kürzen")}</span>
          {[2, 3, 5].map((k) => (
            <Chip key={k} onClick={() => apply(":", k)} disabled={cur.n % k !== 0 || cur.d % k !== 0} title={t(`Divide top and bottom by ${k}`, `Zähler und Nenner durch ${k} teilen`)}>
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
          {cur.n === cur.d ? t("One whole", "Ein Ganzes") : g === 1 ? t("Fully simplified", "Vollständig gekürzt") : t(`Can be simplified by ${g}`, `Mit ${g} kürzbar`)}
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

const PIECES: Record<number, [string, string]> = {
  2: ["halves", "Halbe"],
  3: ["thirds", "Drittel"],
  4: ["quarters", "Viertel"],
  5: ["fifths", "Fünftel"],
  6: ["sixths", "Sechstel"],
  8: ["eighths", "Achtel"],
  9: ["ninths", "Neuntel"],
  10: ["tenths", "Zehntel"],
  12: ["twelfths", "Zwölftel"],
  20: ["twentieths", "Zwanzigstel"],
  24: ["twenty-fourths", "Vierundzwanzigstel"],
};
const pieces = (d: number, de: boolean) => PIECES[d]?.[de ? 1 : 0] ?? (de ? `${d}-tel` : `parts of ${d}`);

function CommonDenominator() {
  const de = useLocale() === "de";
  const t = (en: string, deText: string) => (de ? deText : en);
  const P = (n: number) => pieces(n, de);
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
          : `\\frac{${A2}#an ${sign}#op ${C2}#cn}{${l}#ad}#af =#eq ${plain(R, l, "r")}${g > 1 ? ` =#eq2 ${fr(R / g, l / g)}` : ""}`;
  const lit = step === 1 ? ["ak", "al", "ck", "cl"] : step === 2 ? ["ad", "cd"] : step === 3 ? ["rn"] : [];

  const texts = [
    t(
      `These pieces have different sizes: ${P(b)} and ${P(d)}. You can't ${plus ? "add" : "subtract"} them yet.`,
      `Die Stücke sind verschieden groß: ${P(b)} und ${P(d)}. So kannst du sie noch nicht ${plus ? "addieren" : "subtrahieren"}.`,
    ),
    t(
      `Expand: cut every piece into smaller ones until both bars have ${l} equal parts. The shaded amounts don't change.`,
      `Erweitern: Zerlege jedes Stück in kleinere, bis beide Streifen ${l} gleich große Teile haben. Die gefärbten Anteile ändern sich nicht.`,
    ),
    t(
      `Now both fractions are counted in the same pieces: ${P(l)}. ${l} is the lowest common denominator.`,
      `Jetzt zählen beide Brüche in denselben Stücken: ${P(l)}. ${l} ist der Hauptnenner.`,
    ),
    plus
      ? t(`Same-sized pieces, so just count them: ${A2} + ${C2} = ${R} ${P(l)}.`, `Gleich große Stücke, also einfach zählen: ${A2} + ${C2} = ${R} ${P(l)}.`)
      : t(`Take ${C2} pieces away from ${A2}: ${R} ${P(l)} are left.`, `Nimm von ${A2} Stücken ${C2} weg: ${R} ${P(l)} bleiben übrig.`),
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

  const labels = [t("Start", "Start"), t("Expand", "Erweitern"), t("Common denominator", "Hauptnenner"), plus ? t("Add", "Addieren") : t("Subtract", "Subtrahieren")];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Segmented
          scope={scope}
          options={[
            ["+", t("Add", "Addieren")],
            ["-", t("Subtract", "Subtrahieren")],
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
          <Shuffle className="size-3.5" /> {t("Another example", "Neues Beispiel")}
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <BarRow label={step >= 2 ? fr(A2, l) : fr(a, b)} scope={`${scope}-la`}>
          <FracBar parts={step >= 1 ? l : b} segs={[{ key: "a", from: 0, to: a / b }]} bg="var(--surface)" label={t("First fraction", "Erster Bruch")} />
        </BarRow>
        <BarRow label={step >= 2 ? fr(C2, l) : fr(c, d)} scope={`${scope}-lc`}>
          <FracBar parts={step >= 1 ? l : d} segs={[{ key: "c", from: 0, to: c / d, tone: "second" }]} bg="var(--surface)" label={t("Second fraction", "Zweiter Bruch")} />
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
                <BarRow label={fr(R, l)} scope={`${scope}-lr`}>
                  <FracBar parts={l} segs={resultSegs} bg="var(--surface)" label={t("Result", "Ergebnis")} />
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
          aria-label={t("Previous step", "Vorheriger Schritt")}
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
          {step >= 3 ? t("Start again", "Noch mal von vorn") : t("Next step", "Nächster Schritt")} {step < 3 && <ArrowRight className="size-3.5" />}
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
  { math: "\\frac{3#n}{4#d}#f", note: tx("A fraction describes a part of a whole.", "Ein Bruch beschreibt einen Teil eines Ganzen.") },
  {
    math: "\\frac{3#n}{4#d}#f",
    note: tx(
      "The **denominator** (Nenner) at the bottom says into how many **equal** parts the whole is cut: $4$.",
      "Der **Nenner** unten sagt, in wie viele **gleich große** Teile das Ganze geteilt ist: $4$.",
    ),
    highlight: ["d"],
  },
  {
    math: "\\frac{3#n}{4#d}#f",
    note: tx("The **numerator** (Zähler) on top says how many of these parts you take: $3$.", "Der **Zähler** oben sagt, wie viele dieser Teile du nimmst: $3$."),
    highlight: ["n"],
  },
  {
    math: "3#n :#dv 4#d",
    note: tx("A fraction is also a division: the fraction bar means $:$.", "Ein Bruch ist auch eine Division: Der Bruchstrich bedeutet $:$."),
    highlight: ["dv"],
  },
  {
    math: tx("3#n :#dv 4#d =#eq 0.75#v", "3#n :#dv 4#d =#eq 0,75#v"),
    note: tx("$3 : 4 = 0.75$. So $\\frac{3}{4}$ and $0.75$ are the same number.", "$3 : 4 = 0,75$. Also sind $\\frac{3}{4}$ und $0,75$ dieselbe Zahl."),
  },
];

const expandFrames: Frame[] = [
  { math: "\\frac{2#n}{3#d}#f", note: tx("Start with $\\frac{2}{3}$.", "Wir starten mit $\\frac{2}{3}$.") },
  {
    math: "\\frac{2#n \\cdot#m1 4#k1}{3#d \\cdot#m2 4#k2}#f",
    note: tx(
      "**Expanding** (Erweitern): multiply top **and** bottom by the same number.",
      "**Erweitern**: Zähler **und** Nenner mit derselben Zahl multiplizieren.",
    ),
    highlight: ["k1", "k2"],
  },
  {
    math: "\\frac{8#n}{12#d}#f",
    note: tx("$\\frac{2}{3} = \\frac{8}{12}$. More, smaller pieces, but the same amount.", "$\\frac{2}{3} = \\frac{8}{12}$. Mehr und kleinere Stücke, aber gleich viel."),
  },
  {
    math: "\\frac{8#n :#s1 4#k1}{12#d :#s2 4#k2}#f",
    note: tx(
      "**Simplifying** (Kürzen) goes backwards: divide top and bottom by the same number.",
      "**Kürzen** ist der Weg zurück: Zähler und Nenner durch dieselbe Zahl teilen.",
    ),
    highlight: ["k1", "k2"],
  },
  {
    math: "\\frac{2#n}{3#d}#f",
    note: tx(
      "Back to $\\frac{2}{3}$. Always simplify **fully**: divide by the greatest common factor (ggT).",
      "Zurück bei $\\frac{2}{3}$. Kürze immer **vollständig**: durch den größten gemeinsamen Teiler (ggT).",
    ),
  },
];

const addBoard = board();
put(
  addBoard,
  "\\frac{3#an}{4#ad}#af +#op \\frac{1#bn}{6#bd}#bf",
  tx("Quarters and sixths are pieces of different sizes. You can't add them directly.", "Viertel und Sechstel sind verschieden große Stücke. Die kannst du nicht direkt addieren."),
);
addSub(addBoard, kf(3, 4, "a"), kf(1, 6, "b"), 1, "op");
appendNote(addBoard.frames, tx("Done: $\\frac{3}{4} + \\frac{1}{6} = \\frac{11}{12}$.", "Fertig: $\\frac{3}{4} + \\frac{1}{6} = \\frac{11}{12}$."));

const mulBoard = board();
put(
  mulBoard,
  "\\frac{4#an}{9#ad}#af \\cdot#op \\frac{3#bn}{8#bd}#bf",
  tx("Multiplying is the easy one: top times top, bottom times bottom.", "Multiplizieren ist am einfachsten: Zähler mal Zähler, Nenner mal Nenner."),
);
mul(mulBoard, kf(4, 9, "a"), kf(3, 8, "b"), "op");
appendNote(mulBoard.frames, tx("Simplifying first kept the numbers small.", "Weil du vorher gekürzt hast, bleiben die Zahlen klein."));

const divBoard = board();
div(divBoard, kf(2, 3, "a"), kf(4, 5, "b"), "op");
appendNote(divBoard.frames, tx("So $\\frac{2}{3} : \\frac{4}{5} = \\frac{5}{6}$.", "Also ist $\\frac{2}{3} : \\frac{4}{5} = \\frac{5}{6}$."));

const mixedFrames: Frame[] = [
  {
    math: "2#w \\frac{3#n}{4#d}#f",
    note: tx("A **mixed number** (gemischte Zahl): $2$ wholes and $\\frac{3}{4}$ more.", "Eine **gemischte Zahl**: $2$ Ganze und noch $\\frac{3}{4}$ dazu."),
  },
  {
    math: "\\frac{2#w \\cdot#x 4#k +#p 3#n}{4#d}#f",
    note: tx("As an improper fraction: whole number times denominator, plus numerator.", "Als unechter Bruch: ganze Zahl mal Nenner, plus Zähler."),
    highlight: ["w", "k"],
  },
  {
    math: "\\frac{11#w}{4#d}#f",
    note: tx("$2 \\cdot 4 + 3 = 11$. So $2\\frac{3}{4} = \\frac{11}{4}$: eleven quarters.", "$2 \\cdot 4 + 3 = 11$. Also ist $2\\frac{3}{4} = \\frac{11}{4}$: elf Viertel."),
  },
  {
    math: tx('11#w :#dv 4#d =#eq 2#q "remainder"#rm 3#r', '11#w :#dv 4#d =#eq 2#q "Rest"#rm 3#r'),
    note: tx("And back again: $11 : 4 = 2$ remainder $3$.", "Und wieder zurück: $11 : 4 = 2$ Rest $3$."),
  },
  {
    math: "2#q \\frac{3#r}{4#d}#f",
    note: tx(
      "$2$ wholes and $3$ quarters left over: $2\\frac{3}{4}$. In the practice tasks, type results as improper fractions.",
      "$2$ Ganze und $3$ Viertel Rest: $2\\frac{3}{4}$. In den Übungsaufgaben gibst du Ergebnisse als unechte Brüche ein.",
    ),
  },
];

const ofBoard = board();
ofSteps(ofBoard, 3, 4, 20, "€");
ofBoard.frames[0].note = tx("$\\frac{3}{4}$ of $20$ €. **Of** means times.", "$\\frac{3}{4}$ von $20$\u00a0€. „von“ heißt **mal**.");
appendNote(ofBoard.frames, tx("So $\\frac{3}{4}$ of $20$ € is $15$ €.", "Also sind $\\frac{3}{4}$ von $20$\u00a0€ genau $15$\u00a0€."));

const checkSimplify = board();
put(
  checkSimplify,
  src(kf(18, 24, "a")),
  tx("Find the largest number that divides both $18$ and $24$. It's $6$.", "Such die größte Zahl, durch die $18$ und $24$ beide teilbar sind. Das ist $6$."),
  { highlight: ["an", "ad"] },
);
simplify(checkSimplify, kf(18, 24, "a"));

const checkSub = board();
addSub(checkSub, kf(5, 6, "a"), kf(3, 8, "b"), -1, "op");
finish(checkSub.frames, { n: 11, d: 24 });

const checkDiv = board();
div(checkDiv, kf(3, 4, "a"), kf(9, 10, "b"), "op");
finish(checkDiv.frames, { n: 5, d: 6 });

const checkOf = board();
ofSteps(checkOf, 3, 7, 28, STUDENTS);

// ---------------------------------------------------------------------------

const fractions: Topic = {
  ...topicMeta("fractions"),
  summary: [
    {
      title: tx("Expand and simplify", "Erweitern und kürzen"),
      body: tx(
        "Multiply or divide top **and** bottom by the same number. The value stays the same. Simplify fully by the greatest common factor.",
        "Zähler **und** Nenner mit derselben Zahl multiplizieren oder durch dieselbe Zahl teilen. Der Wert bleibt gleich. Vollständig kürzen: durch den ggT teilen.",
      ),
      examples: ["\\frac{2}{3} = \\frac{2 \\cdot 4}{3 \\cdot 4} = \\frac{8}{12}", "\\frac{18}{24} = \\frac{18 : 6}{24 : 6} = \\frac{3}{4}"],
      tone: "rule",
    },
    {
      title: tx("Add and subtract", "Addieren und subtrahieren"),
      body: tx(
        "Expand both fractions to the lowest common denominator (Hauptnenner). Then add or subtract the numerators and keep the denominator.",
        "Erweitere beide Brüche auf den Hauptnenner. Dann die Zähler addieren oder subtrahieren, der Nenner bleibt.",
      ),
      examples: ["\\frac{3}{4} + \\frac{1}{6} = \\frac{9}{12} + \\frac{2}{12} = \\frac{11}{12}"],
      tone: "rule",
    },
    {
      title: tx("Multiply", "Multiplizieren"),
      body: tx(
        "Top times top, bottom times bottom. Simplify crosswise first to keep the numbers small.",
        "Zähler mal Zähler, Nenner mal Nenner. Vorher über Kreuz kürzen, dann bleiben die Zahlen klein.",
      ),
      examples: ["\\frac{a}{b} \\cdot \\frac{c}{d} = \\frac{a \\cdot c}{b \\cdot d}", "\\frac{4}{9} \\cdot \\frac{3}{8} = \\frac{1}{3} \\cdot \\frac{1}{2} = \\frac{1}{6}"],
      tone: "rule",
    },
    {
      title: tx("Divide", "Dividieren"),
      body: tx("Multiply by the reciprocal (Kehrwert) of the second fraction.", "Mit dem Kehrwert des zweiten Bruchs multiplizieren."),
      examples: ["\\frac{a}{b} : \\frac{c}{d} = \\frac{a}{b} \\cdot \\frac{d}{c}", "\\frac{2}{3} : \\frac{4}{5} = \\frac{2}{3} \\cdot \\frac{5}{4} = \\frac{5}{6}"],
      tone: "rule",
    },
    {
      title: tx("Mixed numbers and “of”", "Gemischte Zahlen und „von“"),
      body: tx(
        "Turn mixed numbers into improper fractions before calculating. And “of” means times: divide by the denominator, then multiply by the numerator.",
        "Wandle gemischte Zahlen vor dem Rechnen in unechte Brüche um. Und „von“ heißt mal: durch den Nenner teilen, dann mit dem Zähler multiplizieren.",
      ),
      examples: ["2\\frac{3}{4} = \\frac{2 \\cdot 4 + 3}{4} = \\frac{11}{4}", tx('\\frac{3}{4} "of" 20 = 20 : 4 \\cdot 3 = 15', '\\frac{3}{4} "von" 20 = 20 : 4 \\cdot 3 = 15')],
      tone: "tip",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx("Never add the denominators. Find a common denominator first.", "Nenner werden nie addiert. Bring die Brüche zuerst auf einen gemeinsamen Nenner."),
      examples: ["\\frac{1}{2} + \\frac{1}{3} \\ne \\frac{2}{5}", "\\frac{1}{2} + \\frac{1}{3} = \\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("What a fraction means", "Was ein Bruch bedeutet"),
      blob: tx("Fractions are just pieces of a whole. Like slices of pizza!", "Brüche sind einfach Teile eines Ganzen. Wie Pizzastücke!"),
      body: tx(
        "Cut a pizza into $4$ equal slices and take $3$: you have $\\frac{3}{4}$ of the pizza.",
        "Teil eine Pizza in $4$ gleich große Stücke und nimm $3$ davon: Dann hast du $\\frac{3}{4}$ der Pizza.",
      ),
      frames: meaningFrames,
    },
    {
      type: "explain",
      title: tx("Expanding and simplifying", "Erweitern und Kürzen"),
      blob: tx("Same amount, different name. That's the big idea!", "Gleicher Wert, anderer Name. Darum geht's!"),
      body: tx(
        "A fraction has many names: $\\frac{1}{2} = \\frac{2}{4} = \\frac{3}{6}$. Expanding and simplifying switch between them without changing the value.",
        "Ein Bruch hat viele Namen: $\\frac{1}{2} = \\frac{2}{4} = \\frac{3}{6}$. Mit Erweitern und Kürzen wechselst du zwischen ihnen, ohne den Wert zu ändern.",
      ),
      frames: expandFrames,
    },
    {
      type: "widget",
      title: tx("Same amount, new name", "Gleicher Wert, neuer Name"),
      blob: tx("Cut the pieces finer or merge them. Keep an eye on the purple part!", "Zerschneide die Stücke feiner oder fass sie zusammen. Behalte den lila Teil im Blick!"),
      body: tx(
        "Build a fraction with the steppers. Then expand or simplify it and watch the cuts appear and disappear.",
        "Stell mit Plus und Minus einen Bruch ein. Dann erweitere oder kürze ihn und schau zu, wie Schnitte dazukommen und verschwinden.",
      ),
      widget: FractionModel,
    },
    {
      type: "check",
      blob: tx("Your turn! Simplify as far as it goes.", "Du bist dran! Kürze, so weit es geht."),
      exercise: {
        instruction: tx("Simplify fully", "Kürze vollständig"),
        math: "\\frac{18}{24}",
        answer: { kind: "fraction", n: 3, d: 4, mustReduce: true },
        hint: tx("Both numbers are in the $6$ times table.", "Beide Zahlen kommen in der Sechserreihe vor."),
        solution: checkSimplify.frames,
        mistakes: slipsFor({ n: 3, d: 4 }, simplifySlips(18, 24, 6)),
      },
    },
    {
      type: "explain",
      title: tx("Adding and subtracting", "Addieren und Subtrahieren"),
      blob: tx("You can only add pieces of the same size. So first we make them match!", "Addieren kannst du nur gleich große Stücke. Also machen wir sie erst passend!"),
      body: tx(
        "Same denominator: add or subtract the numerators and keep the denominator, e.g. $\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}$.\n\nDifferent denominators: expand both fractions to the **lowest common denominator** (Hauptnenner) first.",
        "Gleiche Nenner: Zähler addieren oder subtrahieren, der Nenner bleibt, z. B. $\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}$.\n\nVerschiedene Nenner: Erweitere beide Brüche zuerst auf den **Hauptnenner**.",
      ),
      frames: addBoard.frames,
    },
    {
      type: "widget",
      title: tx("Find the common denominator", "Den Hauptnenner finden"),
      blob: tx("Step through it and watch the bars get cut into matching pieces.", "Geh Schritt für Schritt durch und schau, wie die Streifen in passende Stücke zerlegt werden."),
      body: tx(
        "Press **Next step**. Both bars are cut into the same number of parts, and then the parts can simply be counted.",
        "Drück auf **Nächster Schritt**. Beide Streifen werden in gleich viele Teile zerlegt, dann kannst du die Teile einfach zählen.",
      ),
      widget: CommonDenominator,
    },
    {
      type: "check",
      blob: tx("Different denominators. What's the lowest common one?", "Verschiedene Nenner. Was ist der Hauptnenner?"),
      exercise: {
        instruction: CALC_SIMPLIFY,
        math: "\\frac{5}{6} - \\frac{3}{8}",
        answer: { kind: "fraction", n: 11, d: 24, mustReduce: true },
        hint: tx("Multiples of $8$: $8, 16, 24$. And $6$ goes into $24$.", "Vielfache von $8$: $8, 16, 24$. Und $24$ ist auch durch $6$ teilbar."),
        solution: checkSub.frames,
        mistakes: slipsFor({ n: 11, d: 24 }, addSubSlips({ n: 5, d: 6 }, { n: 3, d: 8 }, -1)),
      },
    },
    {
      type: "explain",
      title: tx("Multiplying fractions", "Brüche multiplizieren"),
      blob: tx("Good news: no common denominator needed here!", "Gute Nachricht: Hier brauchst du keinen gemeinsamen Nenner!"),
      body: tx(
        "Top times top, bottom times bottom. A whole number counts as a fraction over $1$: $3 \\cdot \\frac{2}{7} = \\frac{3}{1} \\cdot \\frac{2}{7} = \\frac{6}{7}$.",
        "Zähler mal Zähler, Nenner mal Nenner. Eine ganze Zahl ist ein Bruch mit dem Nenner $1$: $3 \\cdot \\frac{2}{7} = \\frac{3}{1} \\cdot \\frac{2}{7} = \\frac{6}{7}$.",
      ),
      frames: mulBoard.frames,
    },
    {
      type: "explain",
      title: tx("Dividing fractions", "Brüche dividieren"),
      blob: tx("Dividing is multiplying in disguise. Flip and multiply!", "Dividieren ist verkleidetes Multiplizieren. Umdrehen und malnehmen!"),
      body: tx(
        "The **reciprocal** (Kehrwert) swaps top and bottom: the reciprocal of $\\frac{4}{5}$ is $\\frac{5}{4}$.",
        "Beim **Kehrwert** tauschen Zähler und Nenner die Plätze: Der Kehrwert von $\\frac{4}{5}$ ist $\\frac{5}{4}$.",
      ),
      frames: divBoard.frames,
    },
    {
      type: "check",
      blob: tx("Flip the second fraction, then simplify crosswise.", "Dreh den zweiten Bruch um, dann kürze über Kreuz."),
      exercise: {
        instruction: CALC_SIMPLIFY,
        math: "\\frac{3}{4} : \\frac{9}{10}",
        answer: { kind: "fraction", n: 5, d: 6, mustReduce: true },
        hint: tx(
          "$\\frac{3}{4} : \\frac{9}{10} = \\frac{3}{4} \\cdot \\frac{10}{9}$. Now simplify crosswise.",
          "$\\frac{3}{4} : \\frac{9}{10} = \\frac{3}{4} \\cdot \\frac{10}{9}$. Jetzt über Kreuz kürzen.",
        ),
        solution: checkDiv.frames,
        mistakes: slipsFor({ n: 5, d: 6 }, divSlips({ n: 3, d: 4 }, { n: 9, d: 10 })),
      },
    },
    {
      type: "explain",
      title: tx("Mixed numbers", "Gemischte Zahlen"),
      blob: tx("Two and three quarters pizzas. Let's write that as one fraction.", "Zweidreiviertel Pizzen. Das schreiben wir jetzt als einen Bruch."),
      body: tx(
        "Fractions bigger than $1$ can be written as a mixed number or as an improper fraction (unechter Bruch). For calculating, the improper fraction is easier.",
        "Brüche größer als $1$ kannst du als gemischte Zahl oder als **unechten Bruch** schreiben. Zum Rechnen ist der unechte Bruch einfacher.",
      ),
      frames: mixedFrames,
    },
    {
      type: "explain",
      title: tx("A fraction of a quantity", "Bruchteile von Größen"),
      blob: tx("Three quarters of 20 euros. How much is that?", "Drei Viertel von 20 Euro. Wie viel ist das?"),
      body: tx(
        "To find a fraction of an amount: divide by the denominator, then multiply by the numerator.",
        "So berechnest du einen Bruchteil einer Größe: durch den Nenner teilen, dann mit dem Zähler multiplizieren.",
      ),
      frames: ofBoard.frames,
    },
    {
      type: "check",
      blob: tx("Last one! Divide first, then multiply.", "Die letzte! Erst teilen, dann malnehmen."),
      exercise: {
        instruction: WORD_PROBLEM,
        text: tx(
          "Class 7b has 28 students. $\\frac{3}{7}$ of them have a pet. How many students have a pet?",
          "Die Klasse 7b hat 28 Schülerinnen und Schüler. $\\frac{3}{7}$ davon haben ein Haustier. Wie viele haben ein Haustier?",
        ),
        answer: { kind: "number", value: 12, unit: STUDENTS },
        hint: tx("$\\frac{1}{7}$ of $28$ is $28 : 7$. Then take $3$ of those.", "$\\frac{1}{7}$ von $28$ ist $28 : 7$. Das Ergebnis nimmst du dann mal $3$."),
        solution: checkOf.frames,
        mistakes: slipsFor({ n: 12, d: 1 }, ofSlips(3, 7, 28, true), STUDENTS),
      },
    },
  ],
  generate,
};

export default fractions;
