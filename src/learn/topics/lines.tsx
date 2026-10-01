"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ComponentType, type ReactNode } from "react";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { topicMeta } from "@/learn/catalog";
import { add, div, frac, mul, neg, show, sub, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";
import { Graph, type GraphProps } from "@/learn/visuals/Graph";
import { alongLine, crossing, Plane, PlaneDot, PlaneHandle, PlaneLine, PlanePath, PlaneTag, planeGeo, StepSlider, TONE, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Exact numbers and keyed maths. Shared with the linear-systems topic.

export const q = (n: number, d = 1): Frac => frac(n, d);
export const qv = (a: Frac) => a.n / a.d;
const ZERO = q(0);
const ONE = q(1);
const toQ = (a: Frac | number) => (typeof a === "number" ? q(a) : a);
const abs = (a: Frac) => (a.n < 0 ? neg(a) : a);

/** "3", "-\frac{2}{3}"; in brackets when negative and `wrap` (for products like 2 · (−3)). */
export function num(a: Frac | number, wrap = false): string {
  const f = toQ(a);
  return wrap && f.n < 0 ? `(${show(f)})` : show(f);
}

/** A point like A(2 | −3) in the display language. */
export function pt(x: Frac | number | string, y: Frac | number | string, name = ""): string {
  const s = (v: Frac | number | string) => (typeof v === "string" ? v : num(v));
  // A minus right after the bar must stay a sign (MathView spaces it as a sign only after an operator).
  const gap = s(y).trim().startsWith("-") ? "" : " \\,";
  return `${name}(${s(x)} \\, |${gap} ${s(y)})`;
}

/** Display source without animation keys. */
export const plain = (src: string) => src.replace(/#[A-Za-z0-9_-]+/g, "");

/**
 * One term c·v of a sum with animation keys: sign s<id>, number c<id>,
 * denominator d<id> and bar f<id> for fractions, letter v<id>.
 */
export function term(c: Frac | number, v: string, id: string, first: boolean): string {
  const f = toQ(c);
  if (f.n === 0) return "";
  const n = Math.abs(f.n);
  const sign = f.n < 0 ? `-#s${id} ` : first ? "" : `+#s${id} `;
  const coef = f.d === 1 ? (v && n === 1 ? "" : `${n}#c${id} `) : `\\frac{${n}#c${id}}{${f.d}#d${id}}#f${id} `;
  return `${sign}${coef}${v ? `${v}#v${id}` : ""}`.trim();
}

/** A sum of terms [coefficient, letter, id]; zero terms are left out. */
export function side(list: [Frac | number, string, string][]): string {
  const out: string[] = [];
  for (const [c, v, id] of list) {
    const s = term(c, v, id, out.length === 0);
    if (s) out.push(s);
  }
  return out.length ? out.join(" ") : `0#z${list[0]?.[2] ?? ""}`;
}

/** A signed number with keys (0 too). */
export function val(c: Frac | number, id: string): string {
  const f = toQ(c);
  return f.n === 0 ? `0#c${id}` : term(f, "", id, true);
}

/** Like `val`, in brackets when negative. */
export function valWrap(c: Frac | number, id: string): string {
  const f = toQ(c);
  return f.n < 0 ? `(${term(f, "", id, true)})#p${id}` : val(f, id);
}

export const termKeys = (id: string) => [`s${id}`, `c${id}`, `d${id}`, `f${id}-bar`, `v${id}`];

/** "y = mx + b" with keys Y, EQ, the slope term "m" and the constant "b". */
export function lineSrc(m: Frac, b: Frac, lhs = "y"): string {
  return `${lhs}#Y =#EQ ${side([
    [m, "x", "m"],
    [b, "", "b"],
  ])}`;
}

/** Text for the answer checker, e.g. "-(2x/3)+1". */
export function linePlain(m: Frac, b: Frac): string {
  let s = "";
  if (m.n !== 0) {
    if (m.d === 1) s = m.n === 1 ? "x" : m.n === -1 ? "-x" : `${m.n}x`;
    else {
      const top = Math.abs(m.n) === 1 ? "x" : `${Math.abs(m.n)}x`;
      s = m.n < 0 ? `-(${top}/${m.d})` : `${top}/${m.d}`;
    }
  }
  if (b.n !== 0) {
    const a = b.d === 1 ? `${Math.abs(b.n)}` : `${Math.abs(b.n)}/${b.d}`;
    s += b.n < 0 ? `-${a}` : s ? `+${a}` : a;
  }
  return s || "0";
}

/** The next step written next to an equation, German style: "| − 6", "| : 2", "| · (−3/2)". */
export function opNote(kind: "+" | "-" | ":" | "*", value: Frac | number, v = ""): string {
  const f = toQ(value);
  const sym = kind === "*" ? "\\cdot" : kind;
  let body: string;
  if (v) body = `${f.n === 1 && f.d === 1 ? "" : `${val(f, "op")} `}${v}#opx`;
  else body = kind === ":" || kind === "*" ? valWrap(f, "op") : val(f, "op");
  // One group, so the note never breaks away from its bar; tinted like a margin note.
  return ` \\quad \\blob{|#opb \\, ${sym}#ops ${body}}#opg`;
}

/** Take a term away on both sides. */
export const opRemove = (c: Frac | number, v = "") => (toQ(c).n > 0 ? opNote("-", c, v) : opNote("+", neg(toQ(c)), v));

/** Divide both sides by k (for a fraction: multiply by its reciprocal). */
export const opDivide = (k: Frac | number) => (toQ(k).d === 1 ? opNote(":", k) : opNote("*", div(ONE, toQ(k))));

/** "divide both sides by 3" / "multiply both sides by 3/2". */
export function divideText(k: Frac): string {
  return k.d === 1 ? `divide both sides by $${num(k)}$` : `multiply both sides by $${num(div(ONE, k))}$ (that undoes the $${num(k)}$)`;
}

// ---------------------------------------------------------------------------
// Worked-solution builders

/** Solve L = m·x + b for x. */
function solveFrames(L: Frac, m: Frac, b: Frac, first: string, last: (x: Frac) => string): Frame[] {
  const R = sub(L, b);
  const X = div(R, m);
  const one = m.n === 1 && m.d === 1;
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
  const frames: Frame[] = [];
  if (b.n !== 0) {
    frames.push({
      math: `${val(L, "L")} =#EQ ${side([
        [m, "x", "m"],
        [b, "", "b"],
      ])}${opRemove(b)}`,
      note: join(first, `Get the $x$-term alone: ${b.n > 0 ? "subtract" : "add"} $${num(abs(b))}$ on both sides.`),
    });
    if (!one) frames.push({ math: `${val(R, "L")} =#EQ ${term(m, "x", "m", true)}${opDivide(m)}`, note: `Now ${divideText(m)}.` });
  } else {
    frames.push({ math: `${val(L, "L")} =#EQ ${term(m, "x", "m", true)}${one ? "" : opDivide(m)}`, note: join(first, one ? "" : `Then ${divideText(m)}.`) });
  }
  frames.push({ math: `x#vm =#EQ ${val(X, "L")}`, note: last(X) });
  return frames;
}

/** Find b from the slope and one point P on the line. */
function findBFrames(m: Frac, P: Pt, name: string, first: string): Frame[] {
  const [px, py] = P;
  const prod = mul(m, q(px));
  const b = sub(q(py), prod);
  return [
    { math: `y#Y =#EQ ${term(m, "x", "m", true)} +#sb b#vb`, note: first },
    {
      math: `${val(py, "L")} =#EQ ${val(m, "m")} \\cdot#dot ${valWrap(px, "vm")} +#sb b#vb`,
      note: `$${pt(px, py, name)}$ lies on the line: put in $x = ${num(px)}$ and $y = ${num(py)}$.`,
    },
    {
      math: `${val(py, "L")} =#EQ ${val(prod, "m")} +#sb b#vb${opRemove(prod)}`,
      note: `$${num(m)} \\cdot ${num(px, true)} = ${num(prod)}$. Now get $b$ alone: ${prod.n > 0 ? "subtract" : "add"} $${num(abs(prod))}$.`,
    },
    { math: `${val(b, "b")} =#EQ b#vb`, note: `So $b = ${num(b)}$.` },
    { math: lineSrc(m, b), note: `Put it together: $${plain(lineSrc(m, b))}$.` },
  ];
}

/** m = (y₂ − y₁) : (x₂ − x₁); the numbers drop into the formula, then simplify. */
function slopeFrames(A: Pt, B: Pt, first: string): { frames: Frame[]; m: Frac } {
  const dy = B[1] - A[1];
  const dx = B[0] - A[0];
  const m = q(dy, dx);
  const fr = (top: string, bottom: string) => `m#M =#E \\frac{${top}}{${bottom}}#fm`;
  const top = dy < 0 ? `-#sm ${-dy}#cm` : `${dy}#cm`;
  const bottom = dx < 0 ? `-#sq ${-dx}#dm` : `${dx}#dm`;
  const simple = dx === m.d && dy === m.n && m.d !== 1;
  const frames: Frame[] = [
    { math: fr("y#n1 _{2#n1i}#S1 -#nm y#n2 _{1#n2i}#S2", "x#d1 _{2#d1i}#S3 -#dm x#d2 _{1#d2i}#S4"), note: first },
    {
      math: fr(`${val(B[1], "n1")} -#nm ${valWrap(A[1], "n2")}`, `${val(B[0], "d1")} -#dm ${valWrap(A[0], "d2")}`),
      note: `Put in the points: $y_2$ and $x_2$ from $${pt(B[0], B[1], "B")}$, $y_1$ and $x_1$ from $${pt(A[0], A[1], "A")}$.`,
    },
    {
      math: fr(top, bottom),
      note: `Work out the top and the bottom: $\\Delta y = ${dy}$ and $\\Delta x = ${dx}$.${simple ? ` That can't be simplified: $m = ${num(m)}$.` : ""}`,
    },
  ];
  if (!simple) frames.push({ math: `m#M =#E ${val(m, "m")}`, note: `Simplify: $m = ${num(m)}$.` });
  return { frames, m };
}

/** Reading m and b off a graph with two marked grid points P and Q. */
function readGraphFrames(m: Frac, b: Frac, P: Pt, Q: Pt, end: "pair" | "line", tail?: string): Frame[] {
  const dx = Q[0] - P[0];
  const dy = Q[1] - P[1];
  const bPart = `b#Lb =#E2 ${val(b, "b")}`;
  const top = dy < 0 ? `-#sm ${-dy}#cm` : `${dy}#cm`;
  const frames: Frame[] = [
    { math: bPart, note: `The line crosses the $y$-axis at $${pt(0, b)}$, so $b = ${num(b)}$.` },
    {
      math: `${bPart} \\quad m#Lm =#E1 \\frac{\\Delta#D1 y#D2}{\\Delta#D3 x#D4}#fm`,
      note: `For the slope, draw a slope triangle from $${pt(P[0], P[1])}$ to $${pt(Q[0], Q[1])}$.`,
    },
    {
      math: `${bPart} \\quad m#Lm =#E1 \\frac{${top}}{${dx}#dm}#fm`,
      note: `That's $${dx}$ to the right and $${Math.abs(dy)}$ ${dy >= 0 ? "up" : "down"}: $\\Delta x = ${dx}$ and $\\Delta y = ${dy}$.`,
    },
  ];
  if (!(dx === m.d && dy === m.n && m.d !== 1)) frames.push({ math: `${bPart} \\quad m#Lm =#E1 ${val(m, "m")}`, note: `Simplify: $m = ${num(m)}$.` });
  if (end === "pair") frames.push({ math: `m#Lm =#E1 ${val(m, "m")} \\quad ${bPart}`, note: tail ?? `So $m = ${num(m)}$ and $b = ${num(b)}$.` });
  else frames.push({ math: lineSrc(m, b), note: tail ?? `Put it together: $${plain(lineSrc(m, b))}$.` });
  return frames;
}

// ---------------------------------------------------------------------------
// Pictures for tasks (the shared <Graph>)

const GraphView = Graph as unknown as ComponentType<Record<string, unknown>>;

export function graphVisual(props: GraphProps): NonNullable<Exercise["visual"]> {
  return { component: GraphView, props: props as unknown as Record<string, unknown> };
}

export const lineFn = (m: Frac, b: Frac) => (x: number) => qv(m) * x + qv(b);
/** Plain-text point label for SVG, with a real minus sign. */
export const ptLabel = (name: string, x: number, y: number) => `${name}(${x} | ${y})`.replace(/-/g, "−");
const yAt = (m: Frac, b: Frac, x: number) => qv(add(mul(m, q(x)), b));

// ---------------------------------------------------------------------------
// Exercise generator

const FRACS: Frac[] = [q(1, 2), q(-1, 2), q(1, 3), q(-1, 3), q(2, 3), q(-2, 3), q(3, 2), q(-3, 2), q(3, 4), q(-3, 4), q(1, 4), q(-1, 4)];
const NICE_FRACS = FRACS.slice(0, 8);
const PERP: Frac[] = [q(1), q(-1), q(2), q(-2), q(3), q(-3), ...NICE_FRACS];

const slopeFrom = (rng: Rng, fracChance: number, maxInt = 4, pool = FRACS) => (rng.chance(fracChance) ? rng.pick(pool) : q(rng.nonZero(-maxInt, maxInt)));
/** A non-zero multiple of `step` with |value| ≤ max. */
const multipleOf = (rng: Rng, step: number, max: number) => step * rng.nonZero(-Math.floor(max / step), Math.floor(max / step));
const fits = (p: Pt, r = 4) => Math.abs(p[0]) <= r && Math.abs(p[1]) <= r;

const HINT_MB = "Compare with $y = mx + b$: $m$ is the number in front of $x$, $b$ is the number on its own.";
const HINT_SLOPE = "$m = \\frac{y_2 - y_1}{x_2 - x_1}$. Put negative numbers in brackets. You can type a fraction like 2/3.";
const HINT_B = "Put the slope into $y = mx + b$, then put in the point and solve for $b$.";

/** L1: read m and b from an equation. */
function readEquation(rng: Rng): Exercise {
  const form = rng.pick(["std", "std", "std", "swap", "swap", "nob", "flat"] as const);
  const m = form === "flat" ? ZERO : slopeFrom(rng, 0.3, 6, NICE_FRACS);
  const b = form === "nob" ? ZERO : q(rng.nonZero(-9, 9));
  const swapped = `y#Y =#EQ ${side([
    [b, "", "b"],
    [m, "x", "m"],
  ])}`;
  const given = form === "swap" ? swapped : lineSrc(m, b);
  const frames: Frame[] = [];
  if (form === "swap") {
    frames.push({ math: swapped, note: "Here the number comes first. Sort it into the form $y = mx + b$." });
    frames.push({ math: lineSrc(m, b), note: `Swap the two terms. Each one keeps its sign: $${plain(lineSrc(m, b))}$.` });
  } else {
    frames.push({ math: given, note: "Compare with $y = mx + b$." });
  }
  const mNote =
    form === "flat"
      ? "There is no $x$-term at all, so $m = 0$. The line is horizontal."
      : m.n === 1 && m.d === 1
        ? "No number in front of $x$ means $m = 1$."
        : m.n === -1 && m.d === 1
          ? "Just a minus in front of $x$ means $m = -1$."
          : `$m$ is the number in front of $x$, with its sign: $m = ${num(m)}$.`;
  frames.push({ math: lineSrc(m, b), highlight: termKeys("m").filter((k) => k !== "vm"), note: mNote });
  frames.push({
    math: lineSrc(m, b),
    highlight: termKeys("b"),
    note: form === "nob" ? "There is no number on its own, so $b = 0$. The line goes through the origin." : `$b$ is the number on its own, with its sign: $b = ${num(b)}$.`,
  });
  frames.push({ math: `m#Lm =#E1 ${val(m, "m")} \\quad b#Lb =#E2 ${val(b, "b")}`, note: `So $m = ${num(m)}$ and $b = ${num(b)}$.` });
  return {
    instruction: "Slope and y-intercept",
    text: "Find the slope $m$ and the y-intercept $b$.",
    math: plain(given),
    answer: { kind: "pair", names: ["m", "b"], values: [qv(m), qv(b)] },
    hint: HINT_MB,
    solution: frames,
  };
}

/** A line through two marked grid points that fit on a ±5 graph. */
function markedLine(rng: Rng, hard: boolean): { m: Frac; b: Frac; P: Pt; Q: Pt } {
  for (let t = 0; t < 80; t++) {
    const m = hard ? rng.pick(FRACS) : rng.chance(0.7) ? q(rng.nonZero(-3, 3)) : rng.pick([q(1, 2), q(-1, 2)]);
    const b = q(hard ? rng.nonZero(-3, 3) : rng.int(-3, 3));
    const run = m.d;
    const s = hard ? rng.pick([-2, -1, 1]) * run : 0;
    let P: Pt = [s, yAt(m, b, s)];
    let Q: Pt = [s + run, yAt(m, b, s + run)];
    if (!hard && !fits(Q)) Q = [s - run, yAt(m, b, s - run)];
    if (Q[0] < P[0]) [P, Q] = [Q, P];
    if (fits(P) && fits(Q)) return { m, b, P, Q };
  }
  return { m: q(1), b: q(1), P: [0, 1], Q: [1, 2] };
}

function lineGraph(m: Frac, b: Frac, marks: Pt[]) {
  return graphVisual({
    xRange: [-5, 5],
    yRange: [-5, 5],
    functions: [{ f: lineFn(m, b), key: "g", color: "blob" }],
    points: marks.map(([x, y], i) => ({ x, y, key: `p${i}`, color: "ink" as const })),
  });
}

/** L1: read m and b off a graph (pair); L3: write down the equation of the graph (expr). */
function graphTask(rng: Rng, hard: boolean): Exercise {
  const { m, b, P, Q } = markedLine(rng, hard);
  if (!hard) {
    return {
      instruction: "Slope and y-intercept",
      text: "Read the slope $m$ and the y-intercept $b$ off the graph.",
      visual: lineGraph(m, b, [P, Q]),
      answer: { kind: "pair", names: ["m", "b"], values: [qv(m), qv(b)] },
      hint: "$b$: where does the line cross the $y$-axis? $m$: walk from one marked point to the other. How far right, how far up or down?",
      solution: readGraphFrames(m, b, P, Q, "pair"),
    };
  }
  return {
    instruction: "Find the line equation",
    text: "Write down the equation of the line in the graph.",
    visual: lineGraph(m, b, [P, Q]),
    answer: { kind: "expr", value: linePlain(m, b), prefix: "y =", form: "expanded" },
    hint: "Read $b$ where the line crosses the $y$-axis. For $m$, use a slope triangle between the marked points: $m = \\frac{\\Delta y}{\\Delta x}$.",
    solution: readGraphFrames(m, b, P, Q, "line"),
  };
}

/** L1: which equation belongs to the graph? */
function whichGraph(rng: Rng): Exercise {
  const { m, b, P, Q } = markedLine(rng, false);
  const key = (x: Frac, y: Frac) => `${x.n}/${x.d}|${y.n}/${y.d}`;
  const wrong: [Frac, Frac][] = [];
  const seen = new Set([key(m, b)]);
  const tryAdd = (x: Frac, y: Frac) => {
    if (seen.has(key(x, y))) return;
    seen.add(key(x, y));
    wrong.push([x, y]);
  };
  const candidates: [Frac, Frac][] = rng.shuffle([
    [neg(m), b],
    [m, neg(b)],
    [b.n !== 0 ? b : q(2), m],
    [div(ONE, m), b],
    [neg(m), neg(b)],
    [m, add(b, ONE)],
  ]);
  for (const [x, y] of candidates) if (wrong.length < 3) tryAdd(x, y);
  const options = rng.shuffle([[m, b] as [Frac, Frac], ...wrong]);
  const correct = options.findIndex(([x, y]) => key(x, y) === key(m, b));
  const letter = String.fromCharCode(65 + correct);
  return {
    instruction: "Match the graph",
    text: "Which equation belongs to the line in the graph?",
    visual: lineGraph(m, b, [P, Q]),
    answer: { kind: "choice", options: options.map(([x, y]) => `$${plain(lineSrc(x, y))}$`), correct },
    hint: "First read $b$ on the $y$-axis. Then check the slope: does the line rise or fall, and how steeply?",
    solution: readGraphFrames(m, b, P, Q, "line", `That's answer ${letter}: $${plain(lineSrc(m, b))}$.`),
  };
}

/** L1: work out y for a given x. */
function valueAt(rng: Rng): Exercise {
  const half = rng.chance(0.2);
  const m = half ? rng.pick([q(1, 2), q(-1, 2), q(3, 2), q(-3, 2)]) : q(rng.nonZero(-5, 5));
  const b = q(rng.int(-9, 9));
  const x = half ? 2 * rng.nonZero(-4, 4) : rng.nonZero(-6, 6);
  const prod = mul(m, q(x));
  const y = add(prod, b);
  const frames: Frame[] = [
    { math: lineSrc(m, b), highlight: ["vm"], note: `Replace $x$ by $${num(x)}$.` },
    { math: `y#Y =#EQ ${val(m, "m")} \\cdot#dot ${valWrap(x, "vm")} ${term(b, "", "b", false)}`, note: "Multiply first, then add." },
    { math: `y#Y =#EQ ${val(prod, "m")} ${term(b, "", "b", false)}`, note: `$${num(m)} \\cdot ${num(x, true)} = ${num(prod)}$.` },
  ];
  const done = `So $y = ${num(y)}$. The point $${pt(x, y, "P")}$ lies on the line.`;
  if (b.n !== 0) frames.push({ math: `y#Y =#EQ ${val(y, "m")}`, note: done });
  else frames[frames.length - 1] = { ...frames[frames.length - 1], note: `$${num(m)} \\cdot ${num(x, true)} = ${num(prod)}$. ${done}` };
  const ask = rng.chance(0.5);
  return {
    instruction: "Find y",
    text: ask ? `Find $y$ for $x = ${num(x)}$.` : `The point $${pt(x, "?", "P")}$ lies on the line. Find its $y$-coordinate.`,
    math: plain(lineSrc(m, b)),
    answer: { kind: "number", value: qv(y), label: "y =" },
    hint: `Put $${num(x)}$ in for $x$. Multiply before you add.`,
    solution: frames,
  };
}

/** L2: slope through two points. */
function slopeTask(rng: Rng): Exercise {
  for (;;) {
    const m = slopeFrom(rng, 0.5, 4);
    const k = rng.pick([1, 1, 2]) * rng.sign();
    const dx = m.d * k;
    const dy = m.n * k;
    const A: Pt = [rng.int(-6, 6), rng.int(-6, 6)];
    const B: Pt = [A[0] + dx, A[1] + dy];
    if (!fits(B, 9) || (A[0] === 0 && A[1] === 0)) continue;
    const { frames } = slopeFrames(A, B, "The slope formula: change in $y$ divided by change in $x$.");
    return {
      instruction: "Find the slope",
      text: "Find the slope $m$ of the line through $A$ and $B$.",
      math: `${pt(A[0], A[1], "A")} \\quad ${pt(B[0], B[1], "B")}`,
      answer: { kind: "number", value: qv(m), label: "m =" },
      hint: HINT_SLOPE,
      solution: frames,
    };
  }
}

/** L2: equation from slope and a point. */
function slopePointTask(rng: Rng): Exercise {
  for (;;) {
    const m = slopeFrom(rng, 0.4, 5, NICE_FRACS);
    const px = multipleOf(rng, m.d, 6);
    const b = q(rng.nonZero(-8, 8));
    const py = yAt(m, b, px);
    if (Math.abs(py) > 12) continue;
    return {
      instruction: "Find the line equation",
      text: `A line has the slope $m = ${num(m)}$ and passes through $${pt(px, py, "P")}$. Find its equation.`,
      answer: { kind: "expr", value: linePlain(m, b), prefix: "y =", form: "expanded" },
      hint: HINT_B,
      solution: findBFrames(m, [px, py], "P", "Put the slope into $y = mx + b$. Only $b$ is missing."),
    };
  }
}

/** L2: does a point lie on the line? */
function pointTest(rng: Rng): Exercise {
  const m = q(rng.nonZero(-5, 5));
  const b = q(rng.int(-8, 8));
  const px = rng.nonZero(-5, 5);
  const on = rng.chance(0.5);
  const right = yAt(m, b, px);
  const py = on ? right : right + rng.nonZero(-3, 3);
  const P = pt(px, py, "P");
  return {
    instruction: "Point test",
    text: `Does the point $${P}$ lie on the line?`,
    math: plain(lineSrc(m, b)),
    answer: { kind: "choice", options: ["Yes, $P$ lies on the line.", "No, $P$ is not on the line."], correct: on ? 0 : 1 },
    hint: "Put both coordinates of $P$ into the equation. Do you get a true statement?",
    solution: [
      { math: lineSrc(m, b), note: "**Point test**: put both coordinates of $P$ into the equation." },
      { math: `${val(py, "Y")} =#EQ ${val(m, "m")} \\cdot#dot ${valWrap(px, "vm")} ${term(b, "", "b", false)}`, note: `$x = ${px}$ and $y = ${py}$.` },
      on
        ? { math: `\\green{${val(py, "Y")} =#EQ ${val(right, "m")}}`, note: "Both sides are equal, a true statement. So $P$ lies on the line." }
        : { math: `\\red{${val(py, "Y")} \\ne#EQ ${val(right, "m")}}`, note: `The right side gives $${right}$, not $${py}$. A false statement, so $P$ is **not** on the line.` },
    ],
  };
}

/** L2: the missing x-coordinate of a point on the line. */
function missingX(rng: Rng): Exercise {
  for (;;) {
    const m = q(rng.nonZero(-5, 5, [1]));
    const b = q(rng.nonZero(-9, 9));
    const x = rng.nonZero(-6, 6);
    const y = yAt(m, b, x);
    if (Math.abs(y) > 20) continue;
    return {
      instruction: "Find x",
      text: `The point $${pt("?", y, "P")}$ lies on the line. Find its $x$-coordinate.`,
      math: plain(lineSrc(m, b)),
      answer: { kind: "number", value: x, label: "x =" },
      hint: `Put $y = ${y}$ into the equation and solve for $x$.`,
      solution: [
        { math: lineSrc(m, b), highlight: ["Y"], note: `Put in $y = ${y}$.` },
        ...solveFrames(q(y), m, b, "", (X) => `So $x = ${num(X)}$ and the point is $${pt(X, y, "P")}$.`),
      ],
    };
  }
}

/** L2/L3: the zero (where the line meets the x-axis). */
function zeroTask(rng: Rng, hard: boolean): Exercise {
  for (;;) {
    let m: Frac;
    let x0: Frac;
    if (hard) {
      m = rng.pick(NICE_FRACS);
      x0 = q(multipleOf(rng, m.d, 8));
    } else {
      m = q(rng.nonZero(-6, 6));
      x0 = rng.chance(0.25) && m.n % 2 === 0 ? q(2 * rng.int(-4, 3) + 1, 2) : q(rng.nonZero(-6, 6));
    }
    const b = neg(mul(m, x0));
    if (b.d !== 1 || b.n === 0 || Math.abs(b.n) > 15) continue;
    return {
      instruction: "Find the zero",
      text: "Where does the line cross the $x$-axis?",
      math: plain(lineSrc(m, b)),
      answer: { kind: "number", value: qv(x0), label: "x =" },
      hint: "On the $x$-axis $y = 0$. Set $y = 0$ and solve for $x$. A decimal like 2,5 is fine.",
      solution: [
        { math: lineSrc(m, b), highlight: ["Y"], note: "At the zero the line meets the $x$-axis, so $y = 0$." },
        ...solveFrames(ZERO, m, b, "", (X) => `The zero is $x = ${num(X)}$. The line crosses the $x$-axis at $${pt(X, 0, "N")}$.`),
      ],
    };
  }
}

/** L3: the line through two points. */
function twoPointsTask(rng: Rng): Exercise {
  for (;;) {
    const m = slopeFrom(rng, 0.5, 4, NICE_FRACS);
    const b = q(rng.nonZero(-6, 6));
    const x1 = multipleOf(rng, m.d, 6);
    const x2 = multipleOf(rng, m.d, 6);
    if (x1 === x2) continue;
    const A: Pt = [Math.min(x1, x2), yAt(m, b, Math.min(x1, x2))];
    const B: Pt = [Math.max(x1, x2), yAt(m, b, Math.max(x1, x2))];
    if (!fits(A, 9) || !fits(B, 9)) continue;
    const use = Math.abs(A[0]) <= Math.abs(B[0]) ? A : B;
    const { frames } = slopeFrames(A, B, "First the slope: $m = \\frac{y_2 - y_1}{x_2 - x_1}$.");
    return {
      instruction: "Find the line equation",
      text: `Find the equation of the line through $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$.`,
      answer: { kind: "expr", value: linePlain(m, b), prefix: "y =", form: "expanded" },
      hint: "First the slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$. Then put one of the points into $y = mx + b$ to get $b$.",
      solution: [...frames, ...findBFrames(m, use, use === A ? "A" : "B", `Now find $b$: so far the line is $${plain(`y = ${term(m, "x", "m", true)} + b`)}$.`)],
    };
  }
}

/** L3: parallel or perpendicular line through a point. */
function throughPointTask(rng: Rng, perp: boolean): Exercise {
  for (;;) {
    const mg = perp ? rng.pick(PERP) : slopeFrom(rng, 0.4, 3, NICE_FRACS);
    const bg = q(rng.int(-3, 3));
    const mh = perp ? neg(div(ONE, mg)) : mg;
    const px = multipleOf(rng, mh.d, 4);
    const bh = q(rng.nonZero(-5, 5));
    if (bh.n === bg.n && !perp) continue;
    const py = yAt(mh, bh, px);
    if (!fits([px, py], 5) || py === yAt(mg, bg, px)) continue;
    const g = plain(lineSrc(mg, bg));
    const visual = graphVisual({
      xRange: [-6, 6],
      yRange: [-6, 6],
      functions: [{ f: lineFn(mg, bg), key: "g", color: "blob", label: "g" }],
      points: [{ x: px, y: py, key: "P", color: "ink", label: "P" }],
    });
    const lead: Frame[] = perp
      ? [
          { math: "m#Lg _{g#Lgi}#Sg \\cdot#X m#Lh _{h#Lhi}#Sh =#E -#sr 1#cr", note: "Perpendicular lines: their slopes multiply to $-1$." },
          { math: `${val(mg, "g")} \\cdot#X m#Lh _{h#Lhi}#Sh =#E -#sr 1#cr`, note: `Put in $m_g = ${num(mg)}$.` },
          { math: `m#Lh _{h#Lhi}#Sh =#E ${val(mh, "m")}`, note: `So $m_h = ${num(mh)}$: flip $${num(mg)}$ upside down and change the sign.` },
        ]
      : [{ math: `m#Lh _{h#Lhi}#Sh =#E m#Lg _{g#Lgi}#Sg =#E2 ${val(mg, "m")}`, note: `Parallel lines have the **same slope**: $m_h = ${num(mg)}$.` }];
    return {
      instruction: perp ? "Perpendicular line" : "Parallel line",
      text: `The line $g$ has the equation $${g}$. Find the line $h$ through $${pt(px, py, "P")}$ that is **${perp ? "perpendicular" : "parallel"}** to $g$.`,
      visual,
      answer: { kind: "expr", value: linePlain(mh, bh), prefix: "y =", form: "expanded" },
      hint: perp ? "Perpendicular: $m_g \\cdot m_h = -1$, so $m_h = -\\frac{1}{m_g}$. Then find $b$ with $P$." : "Parallel lines have the same slope. Then find $b$ with $P$.",
      solution: [...lead, ...findBFrames(mh, [px, py], "P", "Put the slope into $y = mx + b$. Only $b$ is missing.")],
    };
  }
}

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1) {
    const r = rng.next();
    if (r < 0.35) return readEquation(rng);
    if (r < 0.6) return graphTask(rng, false);
    if (r < 0.85) return valueAt(rng);
    return whichGraph(rng);
  }
  if (level === 2) {
    const r = rng.next();
    if (r < 0.25) return slopeTask(rng);
    if (r < 0.5) return slopePointTask(rng);
    if (r < 0.62) return pointTest(rng);
    if (r < 0.75) return missingX(rng);
    return zeroTask(rng, false);
  }
  const r = rng.next();
  if (r < 0.3) return twoPointsTask(rng);
  if (r < 0.45) return throughPointTask(rng, false);
  if (r < 0.65) return throughPointTask(rng, true);
  if (r < 0.8) return zeroTask(rng, true);
  return graphTask(rng, true);
}

// ---------------------------------------------------------------------------
// Widgets

const M_STEPS: Frac[] = [q(-3), q(-2), q(-3, 2), q(-1), q(-2, 3), q(-1, 2), q(-1, 3), q(0), q(1, 3), q(1, 2), q(2, 3), q(1), q(3, 2), q(2), q(3)];
const TRI_FILL = "color-mix(in oklab, var(--blob) 15%, transparent)";

function Caption({ children }: { children: ReactNode }) {
  return <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</span>;
}

function Tag({ src, tone = "blob" }: { src: string; tone?: "blob" | "ink" }) {
  return (
    <span className={tone === "blob" ? "text-blob-ink" : "text-ink"}>
      <MathView src={src} size="inline" animate={false} />
    </span>
  );
}

/** Where the slope triangle starts: at the y-intercept if it fits, else one triangle further along. */
function triangleStart(m: Frac, b: number): number {
  const run = m.d;
  const ok = (s: number) => [s, s + run].every((x) => Math.abs(x) <= 4.6 && Math.abs(qv(m) * x + b) <= 4.6);
  for (const s of [0, -run, run, -2 * run, 2 * run, -3 * run]) if (ok(s)) return s;
  return 0;
}

function slopeSentence(m: Frac): string {
  if (m.n === 0) return "Going right never changes $y$: the line is **horizontal**.";
  return m.n > 0
    ? `Go $${m.d}$ to the right and $${m.n}$ up, and you're back on the line. It **rises**.`
    : `Go $${m.d}$ to the right and $${-m.n}$ down, and you're back on the line. It **falls**.`;
}

/** Sliders for m and b: the line turns and slides, the slope triangle follows. */
function SlopeSliders() {
  const scope = useId();
  const [mi, setMi] = useState(10);
  const [b, setB] = useState(1);
  const m = M_STEPS[mi];
  const angle = useSpringTo(Math.atan(qv(m)));
  const bS = useSpringTo(b);
  const runS = useSpringTo(m.d);
  const startS = useSpringTo(triangleStart(m, b));
  const corners = (): [Pt, Pt, Pt] => {
    const t = Math.tan(angle.get());
    const bb = bS.get();
    const r = runS.get();
    const s = startS.get();
    const y = t * s + bb;
    return [
      [s, y],
      [s + r, y],
      [s + r, y + t * r],
    ];
  };

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          label="A line with its slope triangle"
          overlay={
            <>
              <PlaneTag
                at={() => {
                  const [a, c] = corners();
                  return [(a[0] + c[0]) / 2, a[1]];
                }}
                dy={m.n >= 0 ? 15 : -15}
              >
                <Tag src={`\\Delta x = ${m.d}`} />
              </PlaneTag>
              {m.n !== 0 && (
                <PlaneTag
                  at={() => {
                    const [, c, e] = corners();
                    return [c[0], (c[1] + e[1]) / 2];
                  }}
                  anchor="left"
                  dx={8}
                >
                  <Tag src={`\\Delta y = ${m.n}`} />
                </PlaneTag>
              )}
              <PlaneTag at={() => [0, bS.get()]} anchor="right" dx={-9} dy={m.n < 0 ? 13 : -13}>
                <Tag src={`b = ${b}`} tone="ink" />
              </PlaneTag>
            </>
          }
        >
          <PlanePath shape={corners} closed fill={TRI_FILL} />
          <PlanePath
            shape={() => {
              const [a, c, e] = corners();
              return [a, c, e];
            }}
            stroke={TONE.blob}
            width={0.55}
            dashed
          />
          <PlaneLine through={() => [[0, bS.get()], [Math.cos(angle.get()), Math.sin(angle.get())]]} width={1.1} />
          <PlaneDot at={() => [0, bS.get()]} tone="ink" hollow r={1.3} pulse={b} />
        </Plane>
      </div>

      <div className="space-y-5">
        <div className="grid min-h-[84px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
          <MathView src={lineSrc(m, q(b))} size="lg" scope={`${scope}-eq`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>Slope</Caption>
            <MathView src={`m = ${num(m)}`} size="sm" animate={false} className="text-blob-ink" />
          </div>
          <StepSlider value={mi} count={M_STEPS.length} onChange={setMi} zero={7} label="Slope m" valueText={`m = ${qv(m).toFixed(2)}`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>y-intercept</Caption>
            <MathView src={`b = ${b}`} size="sm" animate={false} />
          </div>
          <StepSlider value={b + 4} count={9} onChange={(i) => setB(i - 4)} zero={4} label="y-intercept b" valueText={`b = ${b}`} tone="ink" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${m.n}/${m.d}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            className="min-h-[3em] text-[14px] leading-relaxed text-ink-2"
          >
            <Inline text={slopeSentence(m)} />
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-1">
      <span className="w-[86px] shrink-0">
        <Caption>{label}</Caption>
      </span>
      {children}
    </div>
  );
}

/** Drag two points: line, slope triangle and equation follow. */
function PointsLab() {
  const scope = useId();
  const [A, setA] = useState<Pt>([-3, -1]);
  const [B, setB] = useState<Pt>([3, 3]);
  const [touched, setTouched] = useState(false);
  const ax = useSpringTo(A[0]);
  const ay = useSpringTo(A[1]);
  const bx = useSpringTo(B[0]);
  const by = useSpringTo(B[1]);
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const m = dx === 0 ? null : q(dy, dx);
  const b = m ? sub(q(A[1]), mul(m, q(A[0]))) : null;

  function onMove(id: string, p: Pt) {
    const other = id === "A" ? B : A;
    if (p[0] === other[0] && p[1] === other[1]) return;
    setTouched(true);
    if (id === "A") setA(p);
    else setB(p);
  }

  const tri = (): [Pt, Pt, Pt] => {
    const a: Pt = [ax.get(), ay.get()];
    const c: Pt = [bx.get(), by.get()];
    return [a, [c[0], a[1]], c];
  };
  const yIntercept = (): Pt | null => {
    const [a0, a1, b0, b1] = [ax.get(), ay.get(), bx.get(), by.get()];
    if (Math.abs(b0 - a0) < 0.05) return null;
    return [0, a1 - ((b1 - a1) / (b0 - a0)) * a0];
  };
  const reduced = m && (!(dx === m.d && dy === m.n) || m.d === 1);
  const eq = m && b ? lineSrc(m, b) : `x#vm =#EQ ${val(A[0], "b")}`;

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          label="Drag the points A and B"
          onMove={onMove}
          overlay={
            <>
              <PlaneTag at={() => [ax.get(), ay.get()]} dy={dy >= 0 ? 17 : -17} dx={-6}>
                <Tag src={pt(A[0], A[1], "A")} tone="ink" />
              </PlaneTag>
              <PlaneTag at={() => [bx.get(), by.get()]} dy={dy >= 0 ? -17 : 17} dx={6}>
                <Tag src={pt(B[0], B[1], "B")} tone="ink" />
              </PlaneTag>
              {dx !== 0 && dy !== 0 && (
                <PlaneTag
                  at={() => {
                    const [a, c] = tri();
                    return [(a[0] + c[0]) / 2, a[1]];
                  }}
                  dy={dy > 0 ? 15 : -15}
                >
                  <Tag src={`\\Delta x = ${dx}`} />
                </PlaneTag>
              )}
              {dx !== 0 && dy !== 0 && (
                <PlaneTag
                  at={() => {
                    const [, c, e] = tri();
                    return [c[0], (c[1] + e[1]) / 2];
                  }}
                  anchor={dx > 0 ? "left" : "right"}
                  dx={dx > 0 ? 8 : -8}
                >
                  <Tag src={`\\Delta y = ${dy}`} />
                </PlaneTag>
              )}
            </>
          }
        >
          <PlanePath shape={tri} closed fill={TRI_FILL} />
          <PlanePath shape={tri} stroke={TONE.blob} width={0.55} dashed />
          <PlaneLine through={() => [[ax.get(), ay.get()], [bx.get() - ax.get(), by.get() - ay.get()]]} width={1.1} />
          <PlaneDot at={yIntercept} tone="ink" hollow r={1.2} />
          <PlaneHandle id="A" x={ax} y={ay} at={A} label="Point A" hint={!touched} />
          <PlaneHandle id="B" x={bx} y={by} at={B} label="Point B" hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-4">
        <div className="grid min-h-[84px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
          <MathView src={eq} size="lg" scope={`${scope}-eq`} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {m && b ? (
            <motion.div key="calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
              <Row label="Slope">
                <MathView
                  src={`m = \\frac{\\Delta y}{\\Delta x} = \\frac{${dy}}{${dx}}${reduced ? ` = ${num(m)}` : ""}`}
                  size="md"
                  animate={false}
                />
              </Row>
              <Row label="y-intercept">
                <MathView src={`b = ${num(A[1])} - ${num(m, true)} \\cdot ${num(A[0], true)} = ${num(b)}`} size="md" animate={false} />
              </Row>
              <p className="pt-1 text-[13.5px] leading-relaxed text-ink-2">
                <Inline text="$b$ comes from putting $A$ into $y = mx + b$: $y_A = m \cdot x_A + b$, so $b = y_A - m \cdot x_A$." />
              </p>
            </motion.div>
          ) : (
            <motion.p key="vertical" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-danger/25 bg-danger/[0.05] px-4 py-3 text-[14px] leading-relaxed text-ink">
              <Inline text={`$\\Delta x = 0$ and you can't divide by $0$. This is the **vertical** line $x = ${A[0]}$: it has no slope and no equation of the form $y = mx + b$.`} />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const G_STEPS = M_STEPS.filter((m) => m.n !== 0);

/** Parallel (same slope) and perpendicular (slopes multiply to −1) through a point you drag. */
function ParallelLab() {
  const scope = useId();
  const [mi, setMi] = useState(G_STEPS.findIndex((m) => m.n === 1 && m.d === 2));
  const [perp, setPerp] = useState(false);
  const [P, setP] = useState<Pt>([2, -3]);
  const [touched, setTouched] = useState(false);
  const bg = 2;
  const mg = G_STEPS[mi];
  const mh = perp ? neg(div(ONE, mg)) : mg;
  const bh = sub(q(P[1]), mul(mh, q(P[0])));
  const tg = Math.atan(qv(mg));
  const ag = useSpringTo(tg);
  const ah = useSpringTo(perp ? tg - Math.PI / 2 : tg);
  const px = useSpringTo(P[0]);
  const py = useSpringTo(P[1]);
  const geo = planeGeo([-5, 5], [-5, 5]);
  const dir = (a: number): Pt => [Math.cos(a), Math.sin(a)];
  const meet = () => crossing([0, bg], dir(ag.get()), [px.get(), py.get()], dir(ah.get()));
  const corner = (): Pt[] | null => {
    const s = meet();
    if (!s) return null;
    const u = dir(ag.get());
    const v = dir(ah.get());
    // Point both legs of the marker towards P's side, so it sits in one corner.
    const toP: Pt = [px.get() - s[0], py.get() - s[1]];
    const sv = toP[0] * v[0] + toP[1] * v[1] >= 0 ? 1 : -1;
    const r = 0.55;
    return [
      [s[0] + u[0] * r, s[1] + u[1] * r],
      [s[0] + u[0] * r + sv * v[0] * r, s[1] + u[1] * r + sv * v[1] * r],
      [s[0] + sv * v[0] * r, s[1] + sv * v[1] * r],
    ];
  };
  const tri = (from: () => Pt, a: () => number): Pt[] | null => {
    const p = from();
    const t = Math.tan(a());
    if (!Number.isFinite(t) || Math.abs(t) > 20) return null;
    const run = mg.d;
    return [p, [p[0] + run, p[1]], [p[0] + run, p[1] + t * run]];
  };
  const relation = perp ? `m_g \\cdot m_h = ${num(mg)} \\cdot ${num(mh, true)} = -1` : `m_h = m_g = ${num(mg)}`;

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          label="Line g and line h through the point P"
          onMove={(_, p) => {
            setTouched(true);
            setP(p);
          }}
          overlay={
            <>
              <PlaneTag at={() => alongLine(geo, [0, bg], dir(ag.get()), 0.92)} dy={-14}>
                <Tag src="g" />
              </PlaneTag>
              <PlaneTag at={() => alongLine(geo, [px.get(), py.get()], dir(ah.get()), 0.92)} dy={-14}>
                <Tag src="h" tone="ink" />
              </PlaneTag>
              <PlaneTag at={() => [px.get(), py.get()]} dx={10} dy={14} anchor="left">
                <Tag src={pt(P[0], P[1], "P")} tone="ink" />
              </PlaneTag>
            </>
          }
        >
          <PlanePath shape={() => tri(() => [0, bg], () => ag.get())} closed fill={TRI_FILL} opacity={perp ? 0 : 1} />
          <PlanePath shape={() => tri(() => [px.get(), py.get()], () => ah.get())} closed fill="color-mix(in oklab, var(--ink) 9%, transparent)" opacity={perp ? 0 : 1} />
          <PlaneLine through={() => [[0, bg], dir(ag.get())]} width={1.1} />
          <PlaneLine through={() => [[px.get(), py.get()], dir(ah.get())]} tone="ink" width={1} />
          <PlanePath shape={corner} stroke={TONE.ink} width={0.5} opacity={perp ? 1 : 0} />
          <PlaneDot at={meet} tone="ink" r={0.9} />
          <PlaneHandle id="P" x={px} y={py} at={P} tone="ink" label="Point P" hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-4">
        <div className="flex w-fit rounded-lg border border-line p-0.5">
          {[false, true].map((t) => (
            <button key={String(t)} onClick={() => setPerp(t)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", perp === t ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {perp === t && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t ? "Perpendicular" : "Parallel"}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="w-4 font-math text-[18px] italic text-blob-ink">g</span>
            <MathView src={lineSrc(mg, q(bg))} size="md" scope={`${scope}-g`} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 font-math text-[18px] italic text-ink">h</span>
            <MathView src={lineSrc(mh, bh)} size="md" scope={`${scope}-h`} />
          </div>
        </div>
        <div className="grid min-h-[52px] place-items-center rounded-xl bg-blob-soft/50 px-4 py-2">
          <MathView src={relation} size="md" scope={`${scope}-rel`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>Slope of g</Caption>
            <MathView src={`m_g = ${num(mg)}`} size="sm" animate={false} className="text-blob-ink" />
          </div>
          <StepSlider value={mi} count={G_STEPS.length} onChange={setMi} zero={7} label="Slope of g" valueText={`m = ${qv(mg).toFixed(2)}`} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <Inline
            text={
              perp
                ? `Turn $g$: $h$ turns with it and always meets $g$ at a right angle. Rise and run swap places and the sign flips: $${num(mg)}$ turns into $${num(mh)}$.`
                : "Same slope, same slope triangle: the lines never meet. Drag $P$ and $h$ moves along, always parallel."
            }
          />
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const introFrames: Frame[] = [
  { math: "y#Y =#EQ m#cm x#vm +#sb b#cb", note: "Every straight line (Gerade) has an equation like this. For each $x$ it tells you the $y$ that belongs to it." },
  { math: "y#Y =#EQ m#cm x#vm +#sb b#cb", highlight: ["cb"], note: `$b$ is the **y-intercept** (y-Achsenabschnitt): the line crosses the $y$-axis at $${pt(0, "b")}$.` },
  { math: "y#Y =#EQ m#cm x#vm +#sb b#cb", highlight: ["cm"], note: "$m$ is the **slope** (Steigung): how far the line goes up for every step to the right." },
  { math: "y#Y =#EQ 2#cm x#vm +#sb 1#cb", highlight: ["cm", "cb"], note: "Example: $y = 2x + 1$ has the slope $m = 2$ and the y-intercept $b = 1$." },
  { math: "y#Y =#EQ 2#cm \\cdot#dot 3#vm +#sb 1#cb", highlight: ["vm"], note: "Put in any $x$, say $x = 3$ ..." },
  { math: "y#Y =#EQ 7#cm", note: `... and you get $y = 7$. So the point $${pt(3, 7)}$ lies on the line.` },
];

const slopeTriangleFrames: Frame[] = [
  { math: "m#M =#E \\frac{\\Delta#D1 y#D2}{\\Delta#D3 x#D4}#fm", note: "Slope = **rise over run**. $\\Delta y$ is how far you go up, $\\Delta x$ how far you go right. ($\\Delta$ means difference.)" },
  { math: "m#M =#E \\frac{6#cm}{3#dm}#fm", note: `Example: from $${pt(1, 2)}$ to $${pt(4, 8)}$ you go $3$ right and $6$ up.` },
  { math: "m#M =#E 2#cm", note: "$\\frac{6}{3} = 2$: for every step to the right the line goes $2$ up. It **rises**." },
  { math: "m#M =#E \\frac{-#sm 2#cm}{4#dm}#fm", note: `Going **down** makes $\\Delta y$ negative. From $${pt(0, 3)}$ to $${pt(4, 1)}$: $4$ right, $2$ down.` },
  { math: "m#M =#E -#sm \\frac{1#cm}{2#dm}#fm", note: "A negative slope: the line **falls** from left to right." },
  { math: "m#M =#E 0#cm", note: "And $\\Delta y = 0$ gives $m = 0$: a **horizontal** line, like $y = 3$." },
];

const lessonTwoPoints = (() => {
  const { frames, m } = slopeFrames([1, 3], [4, 9], "Step 1, the slope: subtract the $y$-values, subtract the $x$-values, divide. Same order on top and bottom!");
  return [...frames, ...findBFrames(m, [1, 3], "A", "Step 2, find $b$. So far we know $y = 2x + b$.")];
})();

const lessonTest: Frame[] = [
  { math: lineSrc(q(2), q(-4)), note: `Does $${pt(3, 2, "P")}$ lie on the line $y = 2x - 4$?` },
  { math: `2#L =#EQ 2#cm \\cdot#dot 3#vm -#sb 4#cb`, note: "**Point test** (Punktprobe): put in $x = 3$ and $y = 2$." },
  { math: "\\green{2#L =#EQ 2#cm}", note: "$6 - 4 = 2$. A true statement, so $P$ lies on the line. A false statement would mean it doesn't." },
  ...solveFrames(ZERO, q(2), q(-4), "The **zero** (Nullstelle) is where the line crosses the $x$-axis. There $y = 0$.", (X) => `So $x = ${num(X)}$. The line crosses the $x$-axis at $${pt(X, 0, "N")}$.`),
];

const lines: Topic = {
  ...topicMeta("lines"),
  summary: [
    { title: "The line equation", body: "$m$ is the slope (Steigung), $b$ the y-intercept (y-Achsenabschnitt): the line crosses the $y$-axis at $(0 | b)$.", examples: ["y = mx + b", "y = 2x - 3"], tone: "rule" },
    {
      title: "Slope triangle",
      body: "Go $\\Delta x$ to the right and $\\Delta y$ up (negative: down). $m > 0$ rises, $m < 0$ falls, $m = 0$ is horizontal.",
      examples: ["m = \\frac{\\Delta y}{\\Delta x} = \\frac{y_2 - y_1}{x_2 - x_1}"],
      tone: "rule",
    },
    { title: "Line through two points", body: "First $m$ with the slope formula. Then put one point into $y = mx + b$ and solve for $b$.", examples: [`A${pt(1, 3)} , B${pt(4, 9)}`, "m = \\frac{9 - 3}{4 - 1} = 2", "3 = 2 \\cdot 1 + b \\Rightarrow b = 1"], tone: "tip" },
    { title: "Point test and zero", body: "Point test: put the point in and check for a true statement. Zero (Nullstelle): set $y = 0$ and solve.", examples: ["0 = 2x - 6 \\Rightarrow x = 3"], tone: "rule" },
    { title: "Parallel and perpendicular", body: "Parallel lines have the same slope. Perpendicular lines have slopes that multiply to $-1$.", examples: ["m_1 = m_2", "m_1 \\cdot m_2 = -1"], tone: "tip" },
    { title: "Classic mistakes", body: "Keep the same order on top and bottom of the slope formula. And $b$ is where the line meets the $y$-axis, not the $x$-axis.", examples: ['\\frac{y_2 - y_1}{x_2 - x_1} \\quad \\green{"right"}', '\\frac{y_2 - y_1}{x_1 - x_2} \\quad \\red{"wrong"}'], tone: "warning" },
  ],
  lesson: [
    {
      type: "explain",
      title: "The equation of a line",
      blob: "Straight lines are everywhere. Two numbers are all you need to describe one!",
      body: "Every straight line that isn't vertical has an equation of the form $y = mx + b$.",
      frames: introFrames,
    },
    {
      type: "widget",
      title: "What m and b do",
      blob: "Move the sliders. Which one turns the line, which one slides it?",
      body: "Change $m$ and $b$ and watch the line. The little triangle shows the slope: go right, then up or down, and you're back on the line.",
      widget: SlopeSliders,
    },
    {
      type: "explain",
      title: "The slope triangle",
      blob: "Rise over run. Say it with me!",
      body: "Pick two points on a line. From one to the other you go $\\Delta x$ to the right and $\\Delta y$ up. The slope is the ratio of the two (Steigungsdreieck).",
      frames: slopeTriangleFrames,
    },
    {
      type: "check",
      blob: "Your turn! Find b first, then walk the triangle.",
      exercise: {
        instruction: "Slope and y-intercept",
        text: "Read the slope $m$ and the y-intercept $b$ off the graph.",
        visual: lineGraph(q(2, 3), q(-1), [
          [0, -1],
          [3, 1],
        ]),
        answer: { kind: "pair", names: ["m", "b"], values: [2 / 3, -1] },
        hint: "The line crosses the $y$-axis at $-1$. From there go to the other marked point: how far right, how far up? You can type a fraction like 2/3.",
        solution: readGraphFrames(q(2, 3), q(-1), [0, -1], [3, 1], "pair"),
      },
    },
    {
      type: "widget",
      title: "Drag the points",
      blob: "Grab A or B and move them around. Everything follows!",
      body: "Two points fix a line. Drag $A$ and $B$: the slope triangle shows $\\Delta x$ and $\\Delta y$, and the equation updates as you go.",
      widget: PointsLab,
    },
    {
      type: "explain",
      title: "The line through two points",
      blob: "Two steps: first m, then b. That's the whole trick.",
      body: `For $A${pt(1, 3)}$ and $B${pt(4, 9)}$ we want the equation $y = mx + b$.`,
      frames: lessonTwoPoints,
    },
    {
      type: "check",
      blob: "Slope first, then b. You've got this!",
      exercise: {
        instruction: "Find the line equation",
        text: `Find the equation of the line through $${pt(-1, 4, "A")}$ and $${pt(2, -2, "B")}$.`,
        answer: { kind: "expr", value: "-2x+2", prefix: "y =", form: "expanded" },
        hint: "$m = \\frac{-2 - 4}{2 - (-1)}$. Then put $A$ into $y = mx + b$.",
        solution: (() => {
          const { frames, m } = slopeFrames([-1, 4], [2, -2], "First the slope.");
          return [...frames, ...findBFrames(m, [-1, 4], "A", "Now $b$: so far $y = -2x + b$.")];
        })(),
      },
    },
    {
      type: "explain",
      title: "On the line? Where does it cross the x-axis?",
      blob: "Two quick checks you'll need all the time.",
      body: "A point lies on a line when its coordinates make the equation true. The zero (Nullstelle) is the point where $y = 0$.",
      frames: lessonTest,
    },
    {
      type: "check",
      blob: "Set y to zero and solve!",
      exercise: {
        instruction: "Find the zero",
        text: "Where does the line cross the $x$-axis?",
        math: "y = -2x + 5",
        answer: { kind: "number", value: 2.5, label: "x =" },
        hint: "Solve $0 = -2x + 5$. A decimal like 2,5 is fine.",
        solution: [
          { math: lineSrc(q(-2), q(5)), highlight: ["Y"], note: "At the zero, $y = 0$." },
          ...solveFrames(ZERO, q(-2), q(5), "", (X) => `So $x = ${num(X)} = 2,5$. The line crosses the $x$-axis at $${pt("2,5", 0, "N")}$.`),
        ],
      },
    },
    {
      type: "widget",
      title: "Parallel and perpendicular",
      blob: "Same slope means parallel. Watch what perpendicular does to the triangle!",
      body: "Parallel lines have the **same slope**. Perpendicular lines meet at a right angle; their slopes multiply to $-1$, so $m_h = -\\frac{1}{m_g}$.",
      widget: ParallelLab,
    },
    {
      type: "check",
      blob: "Last one! Same slope, new point.",
      exercise: {
        instruction: "Parallel line",
        text: `The line $g$ has the equation $y = -\\frac{1}{2}x + 4$. Find the line $h$ through $${pt(4, 1, "P")}$ that is **parallel** to $g$.`,
        visual: graphVisual({
          xRange: [-6, 6],
          yRange: [-6, 6],
          functions: [{ f: lineFn(q(-1, 2), q(4)), key: "g", color: "blob", label: "g" }],
          points: [{ x: 4, y: 1, key: "P", color: "ink", label: "P" }],
        }),
        answer: { kind: "expr", value: "-(x/2)+3", prefix: "y =", form: "expanded" },
        hint: "Parallel means the same slope: $m = -\\frac{1}{2}$. Then put $P$ into $y = -\\frac{1}{2}x + b$.",
        solution: [
          { math: `m#Lh _{h#Lhi}#Sh =#E m#Lg _{g#Lgi}#Sg =#E2 ${val(q(-1, 2), "m")}`, note: "Parallel lines have the **same slope**: $m_h = -\\frac{1}{2}$." },
          ...findBFrames(q(-1, 2), [4, 1], "P", "Put the slope into $y = mx + b$. Only $b$ is missing."),
        ],
      },
    },
  ],
  generate,
};

export default lines;
