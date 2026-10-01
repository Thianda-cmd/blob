"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { topicMeta } from "@/learn/catalog";
import { add, div, mul, sub, type Frac } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";
import { alongLine, crossing, Plane, PlaneDot, PlaneLine, PlanePath, PlaneTag, planeGeo, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";
import { graphVisual, lineSrc, num, opDivide, opRemove, plain, pt, q, qv, side, term, termKeys, val, valWrap } from "./lines";

// ---------------------------------------------------------------------------
// Equations in x and y, rendered with stable keys: equation I uses the ids
// "1x", "1y", "1c" (terms) and "e1" (its equals sign), equation II "2x", "2y",
// "2c", "e2". So when II is multiplied, numbers change in place, and when the
// equations are added, every term glides into the sum.

type V = "x" | "y";
/** Standard form: x·x + y·y = c. */
type Std = { x: number; y: number; c: number };
/** Solved form: v = m·(other) + n. */
type Solved = { v: V; m: number; n: number };

const other = (v: V): V => (v === "x" ? "y" : "x");
const VARS: V[] = ["x", "y"];

/** Write "y − 2x" rather than "−2x + y", so an equation doesn't start with a minus. */
const yFirst = (e: Std) => e.x < 0 && e.y > 0;

function stdSrc(e: Std, id: string): string {
  const xs: [number, string, string] = [e.x, "x", `${id}x`];
  const ys: [number, string, string] = [e.y, "y", `${id}y`];
  return `${side(yFirst(e) ? [ys, xs] : [xs, ys])} =#e${id} ${val(e.c, `${id}c`)}`;
}

/** Both coefficients negative? Flip the whole equation, it reads nicer. */
const tidy = (e: Std): Std => (e.x < 0 && e.y < 0 ? { x: -e.x, y: -e.y, c: -e.c } : e);

function rhsSrc(e: Solved, id: string): string {
  return side([
    [e.m, other(e.v), `${id}${other(e.v)}`],
    [e.n, "", `${id}c`],
  ]);
}

function solvedSrc(e: Solved, id: string): string {
  return `${e.v}#w${id} =#e${id} ${rhsSrc(e, id)}`;
}

/**
 * Both equations, labelled (I) and (II). Each one is a style group so it never
 * breaks in the middle: when space is short, (II) moves below (I) as a whole.
 */
function sysSrc(a: string, b: string, la = "(I)", lb = "(II)", tone: [string, string] = ["blob", "blob"]): string {
  return `\\${tone[0]}{"${la}"#L1 ${a}}#G1 \\quad \\${tone[1]}{"${lb}"#L2 ${b}}#G2`;
}

/** The solution set L = {(x | y)}. */
const resultSrc = (x: number, y: number) => `L#Lr =#Er "{"#Lo (${val(x, "rx")} \\, |#rb${y < 0 ? "" : " \\,"} ${val(y, "ry")})#rp "}"#Lc`;

/** c·value as a term of a sum, e.g. "− 3 · (−2)". The coefficient keeps the term's keys. */
function prodTerm(c: number, value: number, id: string, first: boolean): string {
  const sign = c < 0 ? `-#s${id} ` : first ? "" : `+#s${id} `;
  const a = Math.abs(c);
  // Negative numbers go in brackets when they're put in for a variable.
  if (a === 1) return `${sign}${valWrap(value, `k${id}`)}`;
  return `${sign}${a}#c${id} \\cdot#d${id} ${valWrap(value, `k${id}`)}`;
}

const scale = (e: Std, k: number): Std => ({ x: e.x * k, y: e.y * k, c: e.c * k });
const holds = (e: Std, x: number, y: number) => e.x * x + e.y * y === e.c;

function checkNote(e: Std, x: number, y: number, name: string): string {
  return `Check in ${name}: $${plain(`${prodTerm(e.x, x, "a", true)} ${prodTerm(e.y, y, "b", false)}`)} = ${e.c}$. True!`;
}

// ---------------------------------------------------------------------------
// Worked-solution builders

/** Finish K·v + D = R: take D away, divide by K. */
function solveSteps(o: { K: number; v: V; D: number; R: number; vid: string; did: string; rid: string; eq: string; dFirst?: boolean; lead: string }): Frame[] {
  const { K, v, D, R, vid, did, rid, eq } = o;
  const left = (withD: boolean) => {
    const list: [number, string, string][] = [[K, v, vid]];
    if (withD && D !== 0) {
      if (o.dFirst) list.unshift([D, "", did]);
      else list.push([D, "", did]);
    }
    return side(list);
  };
  const R2 = R - D;
  const U = R2 / K;
  const frames: Frame[] = [];
  const lead = (s: string) => (frames.length === 0 ? `${o.lead} ${s}`.trim() : s);
  if (D !== 0) frames.push({ math: `${left(true)} =#${eq} ${val(R, rid)}${opRemove(D)}`, note: lead(`${D > 0 ? "Subtract" : "Add"} $${Math.abs(D)}$ on both sides.`) });
  if (K !== 1) frames.push({ math: `${left(false)} =#${eq} ${val(R2, rid)}${opDivide(K)}`, note: lead(`Divide both sides by $${K}$.`) });
  frames.push({ math: `${v}#v${vid} =#${eq} ${val(U, rid)}`, note: lead(`So $${v} = ${U}$.`) });
  return frames;
}

/** Put a known value into equation e and solve for the other variable. */
function backSteps(e: Std, id: string, name: string, known: V, value: number): Frame[] {
  const u = other(known);
  const kid = `${id}${known}`;
  const uid = `${id}${u}`;
  const first = yFirst(e) ? known === "y" : known === "x";
  const withProd = first ? `${prodTerm(e[known], value, kid, true)} ${term(e[u], u, uid, false)}` : `${term(e[u], u, uid, true)} ${prodTerm(e[known], value, kid, false)}`;
  const put = `Put $${known} = ${value}$ into ${name}.`;
  const rest = solveSteps({ K: e[u], v: u, D: e[known] * value, R: e.c, vid: uid, did: kid, rid: `${id}c`, eq: `e${id}`, dFirst: first, lead: "Work it out." });
  const shown = `${withProd} =#e${id} ${val(e.c, `${id}c`)}`;
  // With a plain value (no product to work out) the first step is already the next picture.
  if (plain(rest[0].math).startsWith(plain(shown).trim())) return [{ ...rest[0], note: `${put} ${rest[0].note?.replace("Work it out. ", "") ?? ""}`.trim() }, ...rest.slice(1)];
  return [{ math: shown, note: put }, ...rest];
}

const specialFrame = (left: string, right: string, eq: string, ok: boolean): string => `${ok ? "\\green" : "\\red"}{${left} =#${eq} ${right}}`;
const NONE_NOTE = "**No solution**: the lines are parallel and never meet.";
const MANY_NOTE = "**Infinitely many** solutions: both equations describe the same line.";

/** Einsetzungsverfahren: I is solved for a variable, put it into II. */
function substitution(s: Solved, e: Std, sol: [number, number] | null): Frame[] {
  const sv = s.v;
  const ov = other(sv);
  const qs = e[sv];
  const qo = e[ov];
  const bracket = `(${rhsSrc(s, "1")})#br`;
  const sTerm = (first: boolean) => {
    const sign = qs < 0 ? `-#s2${sv} ` : first ? "" : `+#s2${sv} `;
    return `${sign}${Math.abs(qs) === 1 ? "" : `${Math.abs(qs)}#c2${sv} `}${bracket}`;
  };
  const subbed = VARS.map((v, i) => (v === sv ? sTerm(i === 0) : term(qo, ov, `2${ov}`, i === 0))).join(" ");
  const expandedList: [number, string, string][] = VARS.flatMap((v): [number, string, string][] =>
    v === sv
      ? [
          [qs * s.m, ov, `1${ov}`],
          [qs * s.n, "", "1c"],
        ]
      : [[qo, ov, `2${ov}`]],
  );
  const ovTerms = expandedList.filter(([c, v]) => v === ov && c !== 0);
  const K = qs * s.m + qo;
  const D = qs * s.n;
  const right = val(e.c, "2c");
  const frames: Frame[] = [
    { math: sysSrc(solvedSrc(s, "1"), stdSrc(e, "2")), highlight: [...termKeys(`1${ov}`), ...termKeys("1c")], note: `Equation (I) already says what $${sv}$ is.` },
    { math: `${subbed} =#e2 ${right}`, highlight: ["br(", "br)"], note: `**Substitute**: in (II), put $(${plain(rhsSrc(s, "1"))})$ in place of $${sv}$. Keep the brackets!` },
    {
      math: `${side(expandedList)} =#e2 ${right}`,
      note:
        qs === 1
          ? "A plus in front: just drop the brackets."
          : qs === -1
            ? "A minus in front: drop the brackets and flip every sign inside."
            : `Multiply out: $${qs}$ times each term in the bracket.`,
    },
  ];
  const combine = `Combine the $${ov}$-terms: $${plain(side(ovTerms))} = ${plain(side([[K, ov, "k"]]))}$.`;
  if (K === 0) {
    const ok = D === e.c;
    frames.push({ math: specialFrame(val(D, "1c"), right, "e2", ok), note: `The $${ov}$-terms cancel. ${ok ? `$${D} = ${e.c}$ is always true, whatever $${ov}$ is.` : `$${D} = ${e.c}$ is false.`} ${ok ? MANY_NOTE : NONE_NOTE}` });
    return frames;
  }
  frames.push(...solveSteps({ K, v: ov, D, R: e.c, vid: ovTerms[0][2], did: "1c", rid: "2c", eq: "e2", lead: combine }));
  const known = (e.c - D) / K;
  const value = s.m * known + s.n;
  frames.push({
    math: `${sv}#w1 =#e1 ${prodTerm(s.m, known, `1${ov}`, true)} ${term(s.n, "", "1c", false)} =#e3 ${val(value, "res")}`,
    note: `Put $${ov} = ${known}$ into (I): $${sv} = ${value}$.`,
  });
  const [x, y] = sv === "y" ? [known, value] : [value, known];
  if (sol) frames.push({ math: resultSrc(x, y), note: `The solution is $x = ${x}$, $y = ${y}$. ${checkNote(e, x, y, "(II)")}` });
  return frames;
}

/** Gleichsetzungsverfahren: both equations are solved for the same variable. */
function equalization(s1: Solved, s2: Solved, sol: [number, number] | null): Frame[] {
  const v = s1.v;
  const o = other(v);
  const frames: Frame[] = [{ math: sysSrc(solvedSrc(s1, "1"), solvedSrc(s2, "2")), highlight: ["w1", "w2"], note: `Both equations are solved for $${v}$.` }];
  const setEqual = `**Set them equal**: both right sides are equal to $${v}$, so they are equal to each other.`;
  const K = s1.m - s2.m;
  if (s2.m !== 0) {
    frames.push({
      math: `${rhsSrc(s1, "1")} =#e1 ${rhsSrc(s2, "2")}${opRemove(s2.m, o)}`,
      note: `${setEqual} Then bring the $${o}$-terms to the left.`,
    });
  }
  const lead = s2.m !== 0 ? `Now all $${o}$-terms are on the left.` : setEqual;
  if (K === 0) {
    const ok = s1.n === s2.n;
    frames.push({ math: specialFrame(val(s1.n, "1c"), val(s2.n, "2c"), "e1", ok), note: `The $${o}$-terms cancel and $${s1.n} = ${s2.n}$ is ${ok ? "always true" : "false"}. ${ok ? MANY_NOTE : NONE_NOTE}` });
    return frames;
  }
  frames.push(...solveSteps({ K, v: o, D: s1.n, R: s2.n, vid: `1${o}`, did: "1c", rid: "2c", eq: "e1", lead }));
  const known = (s2.n - s1.n) / K;
  const value = s1.m * known + s1.n;
  frames.push({
    math: `${v}#w1 =#e1 ${prodTerm(s1.m, known, `1${o}`, true)} ${term(s1.n, "", "1c", false)} =#e3 ${val(value, "res")}`,
    note: `Put $${o} = ${known}$ into (I): $${v} = ${value}$.`,
  });
  const [x, y] = v === "y" ? [known, value] : [value, known];
  if (sol) frames.push({ math: resultSrc(x, y), note: `The solution is $x = ${x}$, $y = ${y}$. The lines cross at $${pt(x, y, "S")}$.` });
  return frames;
}

type Plan = { ev: V; m1: number; m2: number; subtract: boolean };

/** Which variable to eliminate, and what to multiply I and II by (smallest numbers win). */
function plan(e1: Std, e2: Std): Plan {
  const [a, b] = (["y", "x"] as V[]).map((ev) => {
    const l = lcm(e1[ev], e2[ev]);
    const m1 = l / Math.abs(e1[ev]);
    const m2 = l / Math.abs(e2[ev]);
    const subtract = Math.sign(e1[ev]) === Math.sign(e2[ev]);
    return { ev, m1, m2, subtract, cost: m1 + m2 + (subtract ? 0.3 : 0) };
  });
  return a.cost <= b.cost ? a : b;
}

const times = (k: number, name: string) => (k === 1 ? name : `${k} · ${name}`);

/** Additionsverfahren: add or subtract so one variable cancels (multiplying first if needed). */
function elimination(e1: Std, e2: Std, sol: [number, number] | null, lead?: string): Frame[] {
  const { ev, m1, m2, subtract } = plan(e1, e2);
  const ov = other(ev);
  const E1 = scale(e1, m1);
  const E2 = scale(e2, m2);
  const raw = subtract ? E1[ov] - E2[ov] : E1[ov] + E2[ov];
  const swap = subtract && raw < 0;
  const [A, B, a, b] = swap ? [E2, E1, "2", "1"] : [E1, E2, "1", "2"];
  const sg = subtract ? -1 : 1;
  const K = subtract ? Math.abs(raw) : raw;
  const R = A.c + sg * B.c;
  const evKeys = [...termKeys(`1${ev}`), ...termKeys(`2${ev}`)];
  const multiply = m1 !== 1 || m2 !== 1;
  const t = (e: Std) => plain(term(e[ev], ev, "t", true));
  const intro = multiply
    ? `Nothing cancels yet. Multiply so that the $${ev}$-terms ${subtract ? "match" : "become opposites"}.`
    : subtract
      ? `Both equations have $${t(e1)}$. **Subtract** them and the $${ev}$-terms cancel.`
      : `The $${ev}$-terms $${t(e1)}$ and $${t(e2)}$ are opposites. **Add** the equations and they cancel.`;
  const frames: Frame[] = [{ math: sysSrc(stdSrc(e1, "1"), stdSrc(e2, "2")), highlight: evKeys, note: lead ? `${lead} ${intro}` : intro }];
  if (multiply) {
    const which = m1 !== 1 && m2 !== 1 ? `(I) by $${m1}$ and (II) by $${m2}$` : m1 !== 1 ? `(I) by $${m1}$` : `(II) by $${m2}$`;
    frames.push({
      math: sysSrc(stdSrc(E1, "1"), stdSrc(E2, "2"), times(m1, "(I)"), times(m2, "(II)")),
      highlight: evKeys,
      note: `Multiply ${which}, every term on both sides. Now the $${ev}$-terms are $${t(E1)}$ and $${t(E2)}$.`,
    });
  }
  const sumLeft: [number, string, string][] = VARS.flatMap((v): [number, string, string][] => [
    [A[v], v, `${a}${v}`],
    [sg * B[v], v, `${b}${v}`],
  ]);
  const sumRight = side([
    [A.c, "", `${a}c`],
    [sg * B.c, "", `${b}c`],
  ]);
  const labelText = subtract ? (swap ? "(II) − (I):" : "(I) − (II):") : "(I) + (II):";
  frames.push({
    math: `"${labelText}"#L1 ${side(sumLeft)} =#e${a} ${sumRight}`,
    highlight: evKeys,
    note: subtract
      ? `Subtract ${swap ? "(I) from (II)" : "(II) from (I)"}: left side minus left side, right side minus right side. Careful: every sign of ${swap ? "(I)" : "(II)"} flips.`
      : "Add the equations: left side plus left side, right side plus right side.",
  });
  if (K === 0) {
    const ok = R === 0;
    frames.push({ math: specialFrame(`0#z${a}`, val(R, `${a}c`), `e${a}`, ok), note: `Everything with $x$ and $y$ cancels and $0 = ${R}$ is ${ok ? "always true" : "false"}. ${ok ? MANY_NOTE : NONE_NOTE}` });
    return frames;
  }
  frames.push(...solveSteps({ K, v: ov, D: 0, R, vid: `${a}${ov}`, did: "dz", rid: `${a}c`, eq: `e${a}`, lead: `The $${ev}$-terms cancel. Only $${ov}$ is left.` }));
  const known = R / K;
  // Put it back into the original equation with the simpler other coefficient.
  const back = Math.abs(e2[ev]) < Math.abs(e1[ev]) ? 2 : 1;
  const be = back === 1 ? e1 : e2;
  frames.push(...backSteps(be, String(back), back === 1 ? "(I)" : "(II)", ov, known));
  const value = (be.c - be[ov] * known) / be[ev];
  const [x, y] = ov === "x" ? [known, value] : [value, known];
  if (sol) frames.push({ math: resultSrc(x, y), note: `The solution is $x = ${x}$, $y = ${y}$. ${checkNote(back === 1 ? e2 : e1, x, y, back === 1 ? "(II)" : "(I)")}` });
  return frames;
}

// ---------------------------------------------------------------------------
// Exercise generator: always designed backwards from a whole-number solution.

const sysMath = (a: string, b: string) => plain(sysSrc(a, b));
const pairAnswer = (x: number, y: number) => ({ kind: "pair" as const, names: ["x", "y"] as [string, string], values: [x, y] as [number, number] });

function pickSol(rng: Rng): [number, number] {
  for (;;) {
    const x = rng.int(-5, 6);
    const y = rng.int(-5, 6);
    if ((x !== 0 || y !== 0) && (x !== y || rng.chance(0.25))) return [x, y];
  }
}

/** A random standard-form equation through (x, y). */
function stdThrough(rng: Rng, x: number, y: number, max = 5): Std {
  const a = rng.nonZero(-max, max);
  const b = rng.nonZero(-max, max);
  return tidy({ x: a, y: b, c: a * x + b * y });
}

const det = (e1: Std, e2: Std) => e1.x * e2.y - e1.y * e2.x;
const HINT_SUB = (v: V) => `Equation (I) says what $${v}$ is. Put that expression, in brackets, in place of $${v}$ in (II). Then solve for the other variable.`;
const HINT_EQ = (v: V) => `Both right sides equal $${v}$. Set them equal, solve for the other variable, then put it back in.`;
const HINT_ELIM = "Add or subtract the equations so that one variable cancels. If nothing cancels yet, multiply an equation first.";

/** L1: one equation is already solved for a variable. */
function substitutionTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const sol = { x, y };
    const sv: V = rng.chance(0.7) ? "y" : "x";
    const ov = other(sv);
    const m = rng.nonZero(-3, 3);
    const n = sol[sv] - m * sol[ov];
    if (Math.abs(n) > 10) continue;
    const qs = rng.pick([1, 1, 2, 3, -1, -2]);
    const qo = rng.nonZero(-5, 5);
    if (qs * m + qo === 0) continue;
    const raw: Std = sv === "y" ? { x: qo, y: qs, c: 0 } : { x: qs, y: qo, c: 0 };
    const e = tidy({ ...raw, c: raw.x * x + raw.y * y });
    if (Math.abs(e.c) > 40) continue;
    const s: Solved = { v: sv, m, n };
    return {
      instruction: "Solve by substitution",
      math: sysMath(solvedSrc(s, "1"), stdSrc(e, "2")),
      answer: pairAnswer(x, y),
      hint: HINT_SUB(sv),
      solution: substitution(s, e, [x, y]),
    };
  }
}

/** L1: does a given pair solve the system? */
function checkPairTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const e1 = stdThrough(rng, x, y, 4);
    const e2 = stdThrough(rng, x, y, 4);
    if (det(e1, e2) === 0) continue;
    const kind = rng.pick(["both", "I", "II", "none"] as const);
    const step = (e: Std): Pt => {
      const g = gcd(e.x, e.y);
      return [e.y / g, -e.x / g];
    };
    const d1 = step(e1);
    const d2 = step(e2);
    const p: Pt = kind === "both" ? [x, y] : kind === "I" ? [x + d1[0], y + d1[1]] : kind === "II" ? [x + d2[0], y + d2[1]] : [x + 1, y + rng.pick([0, 1, -1])];
    const ok1 = holds(e1, p[0], p[1]);
    const ok2 = holds(e2, p[0], p[1]);
    if (Math.abs(p[0]) > 9 || Math.abs(p[1]) > 9 || (kind === "none" && (ok1 || ok2))) continue;
    const correct = ok1 && ok2 ? 0 : ok1 ? 1 : ok2 ? 2 : 3;
    const lhs = (e: Std, id: string) =>
      yFirst(e) ? `${prodTerm(e.y, p[1], `${id}y`, true)} ${prodTerm(e.x, p[0], `${id}x`, false)}` : `${prodTerm(e.x, p[0], `${id}x`, true)} ${prodTerm(e.y, p[1], `${id}y`, false)}`;
    const value = (e: Std, id: string) => val(e.x * p[0] + e.y * p[1], `${id}x`);
    const verdict = (e: Std, id: string, ok: boolean) => `${value(e, id)} ${ok ? "=" : "\\ne"}#e${id} ${val(e.c, `${id}c`)}`;
    const end = [
      "Both statements are true, so the pair is **the** solution of the system.",
      "Only (I) is true. A solution of the system has to make **both** equations true.",
      "Only (II) is true. A solution of the system has to make **both** equations true.",
      "Neither statement is true, so the pair solves neither equation.",
    ][correct];
    return {
      instruction: "Check a solution",
      text: `Put in $x = ${p[0]}$ and $y = ${p[1]}$. Which equations does this pair solve?`,
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      answer: {
        kind: "choice",
        options: ["It solves **both** equations: it's the solution of the system.", "It solves only equation (I).", "It solves only equation (II).", "It solves **neither** equation."],
        correct,
      },
      hint: "Put the two numbers into each equation and work out the left side. Is it equal to the right side?",
      solution: [
        { math: sysSrc(stdSrc(e1, "1"), stdSrc(e2, "2")), note: `Put $x = ${p[0]}$ and $y = ${p[1]}$ into both equations.` },
        { math: sysSrc(`${lhs(e1, "1")} =#e1 ${val(e1.c, "1c")}`, `${lhs(e2, "2")} =#e2 ${val(e2.c, "2c")}`), note: "Work out each left side." },
        { math: sysSrc(verdict(e1, "1", ok1), verdict(e2, "2", ok2), "(I)", "(II)", [ok1 ? "green" : "red", ok2 ? "green" : "red"]), note: end },
      ],
    };
  }
}

/** L1: read the solution off a graph. */
function graphTask(rng: Rng): Exercise {
  for (;;) {
    const x = rng.int(-4, 4);
    const y = rng.int(-4, 4);
    const m1 = rng.nonZero(-3, 3);
    const m2 = rng.nonZero(-3, 3);
    if (m1 === m2) continue;
    const n1 = y - m1 * x;
    const n2 = y - m2 * x;
    if (Math.abs(n1) > 6 || Math.abs(n2) > 6 || n1 === n2) continue;
    const s1: Solved = { v: "y", m: m1, n: n1 };
    const s2: Solved = { v: "y", m: m2, n: n2 };
    const sys = sysSrc(solvedSrc(s1, "1"), solvedSrc(s2, "2"));
    return {
      instruction: "Solve graphically",
      text: "Each equation is one of the lines. Read the solution of the system off the graph.",
      math: plain(sys),
      visual: graphVisual({
        xRange: [-6, 6],
        yRange: [-6, 6],
        functions: [
          { f: (t) => m1 * t + n1, key: "I", color: "blob", label: "I" },
          { f: (t) => m2 * t + n2, key: "II", color: "ink", label: "II" },
        ],
      }),
      answer: pairAnswer(x, y),
      hint: "Find the point where the two lines cross. Its $x$- and $y$-coordinates are the solution.",
      solution: [
        { math: sys, note: "Each equation is a line. A point on **both** lines solves both equations." },
        { math: `S#S ${pt(`${x}#rx`, `${y}#ry`)}`, note: `The lines cross at $${pt(x, y, "S")}$.` },
        {
          math: sysSrc(`${valWrap(y, "1v")} =#e1 ${prodTerm(m1, x, "1x", true)} ${term(n1, "", "1c", false)}`, `${valWrap(y, "2v")} =#e2 ${prodTerm(m2, x, "2x", true)} ${term(n2, "", "2c", false)}`),
          note: `Check: put $x = ${x}$ and $y = ${y}$ into both equations. Both are true.`,
        },
        { math: resultSrc(x, y), note: `So the solution is $x = ${x}$, $y = ${y}$.` },
      ],
    };
  }
}

/** L2: both solved for the same variable. */
function equalizationTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const sol = { x, y };
    const v: V = rng.chance(0.8) ? "y" : "x";
    const o = other(v);
    const m1 = rng.int(-4, 4);
    const m2 = rng.int(-4, 4);
    if (m1 === m2 || m1 === 0) continue;
    const n1 = sol[v] - m1 * sol[o];
    const n2 = sol[v] - m2 * sol[o];
    if (Math.abs(n1) > 12 || Math.abs(n2) > 12) continue;
    const s1: Solved = { v, m: m1, n: n1 };
    const s2: Solved = { v, m: m2, n: n2 };
    return {
      instruction: "Solve by equalization",
      math: sysMath(solvedSrc(s1, "1"), solvedSrc(s2, "2")),
      answer: pairAnswer(x, y),
      hint: HINT_EQ(v),
      solution: equalization(s1, s2, [x, y]),
    };
  }
}

/** L2: elimination where the coefficients already match. */
function matchingTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const ev: V = rng.chance(0.65) ? "y" : "x";
    const k = rng.int(1, 4) * rng.sign();
    const adding = rng.chance(0.65);
    const a1 = rng.nonZero(-5, 5);
    const a2 = rng.nonZero(-5, 5);
    if (adding ? a1 + a2 === 0 : a1 === a2) continue;
    const build = (a: number, kk: number): Std => {
      const e = ev === "y" ? { x: a, y: kk, c: 0 } : { x: kk, y: a, c: 0 };
      e.c = e.x * x + e.y * y;
      return e;
    };
    const e1 = tidy(build(a1, k));
    const e2 = tidy(build(a2, adding ? -k : k));
    if (Math.abs(e1.c) > 40 || Math.abs(e2.c) > 40) continue;
    const p = plan(e1, e2);
    if (p.m1 !== 1 || p.m2 !== 1) continue;
    return {
      instruction: "Solve by elimination",
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      answer: pairAnswer(x, y),
      hint: adding ? "Look at the coefficients: one variable has opposite numbers in front. Add the equations." : "One variable has the same number in front in both equations. Subtract the equations.",
      solution: elimination(e1, e2, [x, y]),
    };
  }
}

/** L3: elimination that needs one or both equations multiplied first. */
function multiplyTask(rng: Rng): Exercise {
  const both = rng.chance(0.4);
  for (;;) {
    const [x, y] = pickSol(rng);
    const e1 = stdThrough(rng, x, y, both ? 6 : 5);
    const e2 = stdThrough(rng, x, y, both ? 6 : 5);
    if (det(e1, e2) === 0 || Math.abs(e1.c) > 50 || Math.abs(e2.c) > 50) continue;
    const p = plan(e1, e2);
    const big = Math.max(p.m1, p.m2);
    const small = Math.min(p.m1, p.m2);
    if (both ? small < 2 || big > 5 : small !== 1 || big < 2 || big > 4) continue;
    return {
      instruction: "Solve the system",
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      answer: pairAnswer(x, y),
      hint: HINT_ELIM,
      solution: elimination(e1, e2, [x, y]),
    };
  }
}

/** L3: a short word problem. */
function wordTask(rng: Rng): Exercise {
  const kind = rng.pick(["tickets", "animals", "numbers", "cafe"] as const);
  for (;;) {
    let text: string;
    let e1: Std;
    let e2: Std;
    let x: number;
    let y: number;
    let setup: string;
    let answer: string;
    if (kind === "tickets") {
      const pa = rng.int(8, 14);
      const pc = rng.int(4, pa - 2);
      x = rng.int(4, 30);
      y = rng.int(4, 30);
      e1 = { x: 1, y: 1, c: x + y };
      e2 = { x: pa, y: pc, c: pa * x + pc * y };
      text = `A cinema sells adult tickets for ${pa} € and child tickets for ${pc} €. On Sunday it sold ${e1.c} tickets and took ${e2.c} €. How many adult tickets ($x$) and child tickets ($y$) did it sell?`;
      setup = "Set up: (I) counts the tickets, (II) counts the money.";
      answer = `So it sold ${x} adult tickets and ${y} child tickets.`;
    } else if (kind === "animals") {
      x = rng.int(3, 25);
      y = rng.int(3, 25);
      e1 = { x: 1, y: 1, c: x + y };
      e2 = { x: 2, y: 4, c: 2 * x + 4 * y };
      text = `On a farm there are chickens and rabbits. Together they have ${e1.c} heads and ${e2.c} legs. How many chickens ($x$) and rabbits ($y$) are there?`;
      setup = "Set up: every animal has one head, that's (I). A chicken has 2 legs and a rabbit 4, that's (II).";
      answer = `So there are ${x} chickens and ${y} rabbits.`;
    } else if (kind === "numbers") {
      x = rng.int(8, 40);
      y = rng.int(2, x - 1);
      e1 = { x: 1, y: 1, c: x + y };
      e2 = { x: 1, y: -1, c: x - y };
      text = `The sum of two numbers is ${e1.c} and their difference is ${e2.c}. Find the larger number $x$ and the smaller number $y$.`;
      setup = "Set up: (I) is the sum, (II) the difference.";
      answer = `The numbers are ${x} and ${y}.`;
    } else {
      x = rng.int(2, 5);
      y = rng.int(2, 5);
      const [a1, b1, a2, b2] = [rng.int(2, 5), rng.int(2, 5), rng.int(2, 5), rng.int(2, 5)];
      e1 = { x: a1, y: b1, c: a1 * x + b1 * y };
      e2 = { x: a2, y: b2, c: a2 * x + b2 * y };
      if (x === y || det(e1, e2) === 0) continue;
      text = `${a1} coffees and ${b1} muffins cost ${e1.c} €. ${a2} coffees and ${b2} muffins cost ${e2.c} €. What does one coffee ($x$) and one muffin ($y$) cost?`;
      setup = "Set up one equation for each sentence.";
      answer = `So a coffee costs ${x} € and a muffin ${y} €.`;
    }
    const p = plan(e1, e2);
    if (Math.max(p.m1, p.m2) > 6) continue;
    const frames = elimination(e1, e2, [x, y], setup);
    frames[frames.length - 1] = { ...frames[frames.length - 1], note: `${answer} ${checkNote(e2, x, y, "(II)")}` };
    return {
      instruction: "Word problem",
      text,
      answer: pairAnswer(x, y),
      hint: "Write one equation for each piece of information, then solve the system, e.g. with the elimination method.",
      solution: frames,
    };
  }
}

const COUNT_OPTIONS = ["Exactly one solution", "No solution", "Infinitely many solutions"];

/** L3: one, none or infinitely many solutions? */
function specialTask(rng: Rng): Exercise {
  const outcome = rng.pick(["none", "none", "many", "many", "one"] as const);
  const variant = rng.pick(outcome === "many" ? (["mixed", "std"] as const) : (["mixed", "std", "solved"] as const));
  const correct = outcome === "one" ? 0 : outcome === "none" ? 1 : 2;
  const base = { instruction: "How many solutions?", text: "How many solutions does the system have?", answer: { kind: "choice" as const, options: COUNT_OPTIONS, correct } };
  const hint = "Try to solve it. If both variables disappear, look at what's left: a true statement or a false one?";
  for (;;) {
    const [x, y] = pickSol(rng);
    if (variant === "mixed") {
      const m = rng.nonZero(-3, 3);
      const n = y - m * x;
      const qy = rng.pick([1, 2, 3, -1, -2]);
      let qx = -qy * m;
      if (outcome === "one") qx += rng.nonZero(-3, 3);
      let r = qx * x + qy * y;
      if (outcome === "none") r += rng.nonZero(-6, 6);
      if (Math.abs(n) > 9 || Math.abs(r) > 30 || qx === 0) continue;
      const s: Solved = { v: "y", m, n };
      const e: Std = { x: qx, y: qy, c: r };
      return { ...base, math: sysMath(solvedSrc(s, "1"), stdSrc(e, "2")), hint, solution: substitution(s, e, outcome === "one" ? [x, y] : null) };
    }
    if (variant === "solved") {
      const m = rng.nonZero(-3, 3);
      const m2 = outcome === "one" ? m + rng.nonZero(-2, 2) : m;
      const n1 = y - m * x;
      const n2 = outcome === "one" ? y - m2 * x : n1 + rng.nonZero(-5, 5);
      if (Math.abs(n1) > 9 || Math.abs(n2) > 9) continue;
      const s1: Solved = { v: "y", m, n: n1 };
      const s2: Solved = { v: "y", m: m2, n: n2 };
      return { ...base, math: sysMath(solvedSrc(s1, "1"), solvedSrc(s2, "2")), hint, solution: equalization(s1, s2, outcome === "one" ? [x, y] : null) };
    }
    const e1 = stdThrough(rng, x, y, 4);
    const k = rng.pick([2, 3]);
    let e2 = scale(e1, k);
    if (outcome === "none") e2 = { ...e2, c: e2.c + rng.nonZero(-5, 5) };
    if (outcome === "one") e2 = stdThrough(rng, x, y, 5);
    if (outcome === "one" && det(e1, e2) === 0) continue;
    if (Math.abs(e2.c) > 40) continue;
    return { ...base, math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")), hint, solution: elimination(e1, e2, outcome === "one" ? [x, y] : null) };
  }
}

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1) {
    const r = rng.next();
    if (r < 0.65) return substitutionTask(rng);
    if (r < 0.85) return checkPairTask(rng);
    return graphTask(rng);
  }
  if (level === 2) return rng.chance(0.45) ? equalizationTask(rng) : matchingTask(rng);
  const r = rng.next();
  if (r < 0.45) return multiplyTask(rng);
  if (r < 0.72) return wordTask(rng);
  return specialTask(rng);
}

// ---------------------------------------------------------------------------
// Widget: two lines whose equations you change. The intersection point is the
// solution; parallel and identical lines show the special cases.

const SYS_M: Frac[] = [q(-3), q(-2), q(-1), q(-1, 2), q(0), q(1, 2), q(1), q(2), q(3)];
type LineState = { m: number; b: number };
const START: [LineState, LineState] = [
  { m: 7, b: -1 },
  { m: 2, b: 5 },
];

function Stepper({ label, onDown, onUp, canDown, canUp }: { label: ReactNode; onDown: () => void; onUp: () => void; canDown: boolean; canUp: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onDown} disabled={!canDown} className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label="Decrease">
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-6 text-center">{label}</span>
      <button onClick={onUp} disabled={!canUp} className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label="Increase">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function LineRow({ name, tone, line, onChange, scope }: { name: string; tone: "blob" | "ink"; line: LineState; onChange: (l: LineState) => void; scope: string }) {
  const m = SYS_M[line.m];
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-6 min-w-6 place-items-center rounded-md px-1 font-sans text-[12px] font-bold", tone === "blob" ? "bg-blob text-white" : "bg-ink text-paper")}>{name}</span>
        <MathView src={lineSrc(m, q(line.b))} size="md" scope={scope} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-9 text-[13px] text-ink-3">
        <div className="flex items-center gap-2">
          <span className="font-math italic">m</span>
          <Stepper label={<MathView src={num(m)} size="sm" animate={false} />} canDown={line.m > 0} canUp={line.m < SYS_M.length - 1} onDown={() => onChange({ ...line, m: line.m - 1 })} onUp={() => onChange({ ...line, m: line.m + 1 })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-math italic">b</span>
          <Stepper label={<MathView src={String(line.b)} size="sm" animate={false} />} canDown={line.b > -5} canUp={line.b < 5} onDown={() => onChange({ ...line, b: line.b - 1 })} onUp={() => onChange({ ...line, b: line.b + 1 })} />
        </div>
      </div>
    </div>
  );
}

function SystemLab() {
  const scope = useId();
  const [l1, setL1] = useState(START[0]);
  const [l2, setL2] = useState(START[1]);
  const m1 = SYS_M[l1.m];
  const m2 = SYS_M[l2.m];
  const sameSlope = m1.n === m2.n && m1.d === m2.d;
  const kind = sameSlope ? (l1.b === l2.b ? "same" : "parallel") : "one";
  let S: [Frac, Frac] | null = null;
  if (kind === "one") {
    const sx = div(q(l2.b - l1.b), sub(m1, m2));
    S = [sx, add(mul(m1, sx), q(l1.b))];
  }
  const onGrid = S !== null && Math.abs(qv(S[0])) <= 5 && Math.abs(qv(S[1])) <= 5;
  const a1 = useSpringTo(Math.atan(qv(m1)));
  const a2 = useSpringTo(Math.atan(qv(m2)));
  const b1 = useSpringTo(l1.b);
  const b2 = useSpringTo(l2.b);
  const geo = planeGeo([-5, 5], [-5, 5]);
  const dir = (a: number): Pt => [Math.cos(a), Math.sin(a)];
  const meet = () => crossing([0, b1.get()], dir(a1.get()), [0, b2.get()], dir(a2.get()));
  const band = (): Pt[] => {
    const t = Math.tan(a1.get());
    const [u, w] = [b1.get(), b2.get()];
    return [
      [-6, -6 * t + u],
      [6, 6 * t + u],
      [6, 6 * t + w],
      [-6, -6 * t + w],
    ];
  };
  const presets: { label: string; run: () => void }[] = [
    {
      label: "Crossing",
      run: () => {
        setL1(START[0]);
        setL2(START[1]);
      },
    },
    { label: "Parallel", run: () => setL2({ m: l1.m, b: l1.b <= 1 ? l1.b + 3 : l1.b - 3 }) },
    { label: "Same line", run: () => setL2({ ...l1 }) },
  ];

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          label="Two lines and their intersection"
          overlay={
            <>
              <PlaneTag at={() => alongLine(geo, [0, b1.get()], dir(a1.get()), 0.94)} dy={-13}>
                <span className="font-sans text-[12px] font-bold text-blob-ink">I</span>
              </PlaneTag>
              <PlaneTag at={() => alongLine(geo, [0, b2.get()], dir(a2.get()), 0.94)} dy={13}>
                <span className="font-sans text-[12px] font-bold text-ink">II</span>
              </PlaneTag>
              {S && (
                <PlaneTag at={meet} dy={-22} className="shadow-[0_0_0_1.5px_var(--blob)]">
                  <span className="text-ink">
                    <MathView src={pt(S[0], S[1], "S")} size="inline" animate={false} />
                  </span>
                </PlaneTag>
              )}
            </>
          }
        >
          <PlanePath shape={band} closed fill="color-mix(in oklab, var(--danger) 10%, transparent)" opacity={kind === "parallel" ? 1 : 0} />
          <PlaneLine through={() => [[0, b1.get()], dir(a1.get())]} width={1.1} />
          <PlaneLine through={() => [[0, b2.get()], dir(a2.get())]} tone="ink" width={kind === "same" ? 0.8 : 1} dashed={kind === "same"} />
          <PlaneDot at={meet} tone="blob" r={1.5} pulse={S ? `${S[0].n}/${S[0].d},${S[1].n}/${S[1].d}` : "none"} />
        </Plane>
      </div>

      <div className="space-y-3">
        <LineRow name="I" tone="blob" line={l1} onChange={setL1} scope={`${scope}-1`} />
        <LineRow name="II" tone="ink" line={l2} onChange={setL2} scope={`${scope}-2`} />
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.label} onClick={p.run} className="h-8 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              {p.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={kind}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn("rounded-xl border px-4 py-3", kind === "one" ? "border-blob/30 bg-blob-soft/50" : kind === "parallel" ? "border-danger/25 bg-danger/[0.05]" : "border-ok/30 bg-ok/[0.07]")}
          >
            <div className="font-display text-[16px] font-semibold">{kind === "one" ? "Exactly one solution" : kind === "parallel" ? "No solution" : "Infinitely many solutions"}</div>
            <div className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              {kind === "one" && S ? (
                <Inline text={`The lines cross at $${pt(S[0], S[1], "S")}$. ${onGrid ? "That point" : "That point (off the grid here)"} makes **both** equations true: $x = ${num(S[0])}$, $y = ${num(S[1])}$.`} />
              ) : kind === "parallel" ? (
                <Inline text="Same slope, different y-intercepts: the lines are parallel and never meet. No point is on both." />
              ) : (
                <Inline text="Same slope, same y-intercept: it's the same line twice. Every point on it solves both equations." />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const v = (n: number, k: string) => `${n}#${k}`;
const introFrames: Frame[] = [
  {
    math: sysSrc(stdSrc({ x: 1, y: 1, c: 5 }, "1"), stdSrc({ x: 1, y: -1, c: 1 }, "2")),
    note: "Two equations with the same two unknowns $x$ and $y$: a **linear system** (lineares Gleichungssystem, LGS).",
  },
  {
    math: sysSrc(stdSrc({ x: 1, y: 1, c: 5 }, "1"), stdSrc({ x: 1, y: -1, c: 1 }, "2")),
    highlight: ["v1x", "s1y", "v1y", "e1", "c1c"],
    note: `On its own, $x + y = 5$ has lots of solutions: $${pt(1, 4)}$, $${pt(2, 3)}$, $${pt(3, 2)}$ and many more.`,
  },
  {
    math: sysSrc(`${v(2, "v1x")} +#s1y ${v(3, "v1y")} =#e1 5#c1c`, `${v(2, "v2x")} -#s2y ${v(3, "v2y")} \\ne#e2 1#c2c`, "(I)", "(II)", ["green", "red"]),
    note: "Try $x = 2$, $y = 3$: equation (I) is true. But (II) gives $2 - 3 = -1$, not $1$.",
  },
  {
    math: sysSrc(`${v(3, "v1x")} +#s1y ${v(2, "v1y")} =#e1 5#c1c`, `${v(3, "v2x")} -#s2y ${v(2, "v2y")} =#e2 1#c2c`, "(I)", "(II)", ["green", "green"]),
    note: "Try $x = 3$, $y = 2$: **both** are true!",
  },
  { math: resultSrc(3, 2), note: "So the solution is the pair $(3 | 2)$. We write the solution set as $L$. Next: how to find it without guessing." },
];

const specialFrames: Frame[] = [
  ...equalization({ v: "y", m: 2, n: 1 }, { v: "y", m: 2, n: -3 }, null),
  ...substitution({ v: "y", m: 2, n: 1 }, { x: 4, y: -2, c: -2 }, null),
];
specialFrames[0] = { ...specialFrames[0], note: "First system: both lines have slope $2$ but different y-intercepts. Set them equal." };
const parallelEnd = specialFrames.findIndex((f) => f.math.startsWith("\\red"));
specialFrames[parallelEnd + 1] = { ...specialFrames[parallelEnd + 1], note: "Second system. Equation (I) is solved for $y$, so substitute." };

const linearSystems: Topic = {
  ...topicMeta("linear-systems"),
  summary: [
    {
      title: "What a solution is",
      body: "A pair $(x | y)$ that makes **both** equations true. In a graph it's the point where the two lines cross.",
      examples: ['"(I)" x + y = 5 \\quad "(II)" x - y = 1', 'L = "{" (3 \\, | \\, 2) "}"'],
      tone: "rule",
    },
    { title: "Equalization (Gleichsetzungsverfahren)", body: "Both equations are solved for the same variable: set the right sides equal.", examples: ["y = 2x - 1 , \\quad y = -x + 5", "2x - 1 = -x + 5"], tone: "rule" },
    { title: "Substitution (Einsetzungsverfahren)", body: "One equation is solved for a variable: put that expression, in brackets, into the other one.", examples: ["y = 2x + 1 , \\quad 3x + y = 11", "3x + (2x + 1) = 11"], tone: "rule" },
    {
      title: "Elimination (Additionsverfahren)",
      body: "Add or subtract the equations so that one variable cancels. Multiply an equation first if needed.",
      examples: ["2x + y = 7 , \\quad 3x - y = 8", "5x = 15"],
      tone: "rule",
    },
    { title: "Special cases", body: "Both variables vanish? A false statement like $0 = 4$ means no solution (parallel lines). A true one like $0 = 0$ means infinitely many solutions (same line).", examples: ['0 = 4 \\quad "false: no solution"', '0 = 0 \\quad "true: infinitely many"'], tone: "tip" },
    { title: "Don't stop halfway", body: "Once you have $x$, put it back into an equation to get $y$. Then check both equations.", tone: "warning" },
  ],
  lesson: [
    {
      type: "explain",
      title: "Two equations, two unknowns",
      blob: "One equation, two unknowns: too many answers. Two equations: now we can pin it down!",
      body: "A solution of a system is a pair of numbers $(x | y)$ that makes **both** equations true at the same time.",
      frames: introFrames,
    },
    {
      type: "widget",
      title: "Each equation is a line",
      blob: "Change the lines and watch where they cross!",
      body: "Solve each equation for $y$ and you get a line. A point on **both** lines solves both equations: the intersection is the solution. Try the special cases too.",
      widget: SystemLab,
    },
    {
      type: "explain",
      title: "Equalization (Gleichsetzungsverfahren)",
      blob: "Both say what y is? Then they must be equal!",
      body: "Use it when both equations are solved for the same variable, for example both for $y$.",
      frames: equalization({ v: "y", m: 2, n: -1 }, { v: "y", m: -1, n: 5 }, [2, 3]),
    },
    {
      type: "check",
      blob: "Your turn. Set the right sides equal.",
      exercise: {
        instruction: "Solve by equalization",
        math: sysMath(solvedSrc({ v: "y", m: 3, n: -4 }, "1"), solvedSrc({ v: "y", m: 1, n: 2 }, "2")),
        answer: pairAnswer(3, 5),
        hint: "$3x - 4 = x + 2$. Solve for $x$, then put it into one of the equations.",
        solution: equalization({ v: "y", m: 3, n: -4 }, { v: "y", m: 1, n: 2 }, [3, 5]),
      },
    },
    {
      type: "explain",
      title: "Substitution (Einsetzungsverfahren)",
      blob: "Swap in what you know. Brackets are your friend here.",
      body: "Use it when **one** equation is solved for a variable. Put that expression into the other equation, then only one unknown is left.",
      frames: substitution({ v: "y", m: 2, n: 1 }, { x: 3, y: 1, c: 11 }, [2, 5]),
    },
    {
      type: "check",
      blob: "This time it's x that's on its own. Same idea!",
      exercise: {
        instruction: "Solve by substitution",
        math: sysMath(solvedSrc({ v: "x", m: 3, n: -2 }, "1"), stdSrc({ x: 2, y: 1, c: 10 }, "2")),
        answer: pairAnswer(4, 2),
        hint: "Put $(3y - 2)$ in place of $x$ in (II): $2(3y - 2) + y = 10$.",
        solution: substitution({ v: "x", m: 3, n: -2 }, { x: 2, y: 1, c: 10 }, [4, 2]),
      },
    },
    {
      type: "explain",
      title: "Elimination (Additionsverfahren)",
      blob: "Add two equations and watch a variable vanish. Magic? No, maths!",
      body: "If a variable has opposite numbers in front, adding the equations makes it cancel.",
      frames: elimination({ x: 2, y: 1, c: 7 }, { x: 3, y: -1, c: 8 }, [3, 1]),
    },
    {
      type: "explain",
      title: "Multiply first",
      blob: "Nothing cancels? Make it cancel!",
      body: "Multiply an equation (every term on both sides!) so that one variable gets opposite numbers. Then add.",
      frames: elimination({ x: 1, y: 2, c: 8 }, { x: 3, y: -1, c: 3 }, [2, 3]),
    },
    {
      type: "check",
      blob: "Which equation should you multiply, and by what?",
      exercise: {
        instruction: "Solve by elimination",
        math: sysMath(stdSrc({ x: 3, y: 2, c: 13 }, "1"), stdSrc({ x: 1, y: -1, c: 1 }, "2")),
        answer: pairAnswer(3, 2),
        hint: "Multiply (II) by $2$: then the $y$-terms are $+2y$ and $-2y$.",
        solution: elimination({ x: 3, y: 2, c: 13 }, { x: 1, y: -1, c: 1 }, [3, 2]),
      },
    },
    {
      type: "explain",
      title: "No solution or infinitely many",
      blob: "Sometimes x and y both disappear. Then read what's left!",
      body: "If both variables vanish, look at the statement that is left. **False** (like $1 = -3$): no solution, the lines are parallel. **True** (like $-2 = -2$): infinitely many, it's the same line.",
      frames: specialFrames,
    },
    {
      type: "check",
      blob: "Last one! Solve it and see what's left.",
      exercise: {
        instruction: "How many solutions?",
        text: "How many solutions does the system have?",
        math: sysMath(solvedSrc({ v: "y", m: -1, n: 4 }, "1"), stdSrc({ x: 2, y: 2, c: 8 }, "2")),
        answer: { kind: "choice", options: COUNT_OPTIONS, correct: 2 },
        hint: "Substitute $y = -x + 4$ into (II). What happens to $x$?",
        solution: substitution({ v: "y", m: -1, n: 4 }, { x: 2, y: 2, c: 8 }, null),
      },
    },
  ],
  generate,
};

export default linearSystems;
