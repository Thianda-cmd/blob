"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ComponentType, type ReactNode } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useLocale } from "@/i18n/client";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { add, div, eq, frac, mul, neg, show, sub, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { Graph, type GraphProps } from "@/learn/visuals/Graph";
import { alongLine, crossing, Plane, PlaneDot, PlaneHandle, PlaneLine, PlanePath, PlaneTag, planeGeo, StepSlider, TONE, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

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

/** "Now divide both sides by 3." / "Then multiply both sides by 3/2 (…)." as a whole sentence. */
export function divideText(k: Frac, when: "now" | "then" = "now"): Text {
  const now = when === "now";
  if (k.d === 1) return tx(`${now ? "Now" : "Then"} divide both sides by $${num(k)}$.`, `Teile ${now ? "jetzt" : "dann"} beide Seiten durch $${num(k)}$.`);
  const r = num(div(ONE, k));
  return tx(
    `${now ? "Now" : "Then"} multiply both sides by $${r}$ (that undoes the $${num(k)}$).`,
    `Multipliziere ${now ? "jetzt" : "dann"} beide Seiten mit $${r}$, dem Kehrwert von $${num(k)}$.`,
  );
}

/** Join note parts in both languages; empty parts are dropped. */
export const joinT = (...parts: Text[]): Text => txMap((_, l) => parts.map((p) => resolveText(p, l)).filter(Boolean).join(" "));

// ---------------------------------------------------------------------------
// Worked-solution builders

/** Solve L = m·x + b for x. */
export function solveFrames(L: Frac, m: Frac, b: Frac, first: Text, last: (x: Frac) => Text): Frame[] {
  const R = sub(L, b);
  const X = div(R, m);
  const one = m.n === 1 && m.d === 1;
  const frames: Frame[] = [];
  if (b.n !== 0) {
    frames.push({
      math: `${val(L, "L")} =#EQ ${side([
        [m, "x", "m"],
        [b, "", "b"],
      ])}${opRemove(b)}`,
      note: joinT(
        first,
        tx(
          `Get the $x$-term alone: ${b.n > 0 ? "subtract" : "add"} $${num(abs(b))}$ on both sides.`,
          `Bring den $x$-Term allein auf eine Seite: ${b.n > 0 ? "Subtrahiere" : "Addiere"} auf beiden Seiten $${num(abs(b))}$.`,
        ),
      ),
    });
    if (!one) frames.push({ math: `${val(R, "L")} =#EQ ${term(m, "x", "m", true)}${opDivide(m)}`, note: divideText(m) });
  } else {
    frames.push({ math: `${val(L, "L")} =#EQ ${term(m, "x", "m", true)}${one ? "" : opDivide(m)}`, note: joinT(first, one ? "" : divideText(m, "then")) });
  }
  frames.push({ math: `x#vm =#EQ ${val(X, "L")}`, note: last(X) });
  return frames;
}

/** Find b from the slope and one point P on the line. */
export function findBFrames(m: Frac, P: Pt, name: string, first: Text): Frame[] {
  const [px, py] = P;
  const prod = mul(m, q(px));
  const b = sub(q(py), prod);
  return [
    { math: `y#Y =#EQ ${term(m, "x", "m", true)} +#sb b#vb`, note: first },
    {
      math: `${val(py, "L")} =#EQ ${val(m, "m")} \\cdot#dot ${valWrap(px, "vm")} +#sb b#vb`,
      note: tx(
        `$${pt(px, py, name)}$ lies on the line: put in $x = ${num(px)}$ and $y = ${num(py)}$.`,
        `$${pt(px, py, name)}$ liegt auf der Geraden: Setze $x = ${num(px)}$ und $y = ${num(py)}$ ein.`,
      ),
    },
    {
      math: `${val(py, "L")} =#EQ ${val(prod, "m")} +#sb b#vb${opRemove(prod)}`,
      note: tx(
        `$${num(m)} \\cdot ${num(px, true)} = ${num(prod)}$. Now get $b$ alone: ${prod.n > 0 ? "subtract" : "add"} $${num(abs(prod))}$.`,
        `$${num(m)} \\cdot ${num(px, true)} = ${num(prod)}$. Löse jetzt nach $b$ auf: ${prod.n > 0 ? "Subtrahiere" : "Addiere"} $${num(abs(prod))}$.`,
      ),
    },
    { math: `${val(b, "b")} =#EQ b#vb`, note: tx(`So $b = ${num(b)}$.`, `Also ist $b = ${num(b)}$.`) },
    { math: lineSrc(m, b), note: tx(`Put it together: $${plain(lineSrc(m, b))}$.`, `Alles zusammen: $${plain(lineSrc(m, b))}$.`) },
  ];
}

/** m = (y₂ − y₁) : (x₂ − x₁); the numbers drop into the formula, then simplify. */
export function slopeFrames(A: Pt, B: Pt, first: Text): { frames: Frame[]; m: Frac } {
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
      note: tx(
        `Put in the points: $y_2$ and $x_2$ from $${pt(B[0], B[1], "B")}$, $y_1$ and $x_1$ from $${pt(A[0], A[1], "A")}$.`,
        `Setze die Punkte ein: $y_2$ und $x_2$ aus $${pt(B[0], B[1], "B")}$, $y_1$ und $x_1$ aus $${pt(A[0], A[1], "A")}$.`,
      ),
    },
    {
      math: fr(top, bottom),
      note: tx(
        `Work out the top and the bottom: $\\Delta y = ${dy}$ and $\\Delta x = ${dx}$.${simple ? ` That can't be simplified: $m = ${num(m)}$.` : ""}`,
        `Rechne Zähler und Nenner aus: $\\Delta y = ${dy}$ und $\\Delta x = ${dx}$.${simple ? ` Das lässt sich nicht kürzen: $m = ${num(m)}$.` : ""}`,
      ),
    },
  ];
  if (!simple) frames.push({ math: `m#M =#E ${val(m, "m")}`, note: tx(`Simplify: $m = ${num(m)}$.`, `Vereinfache: $m = ${num(m)}$.`) });
  return { frames, m };
}

/** Reading m and b off a graph with two marked grid points P and Q. */
function readGraphFrames(m: Frac, b: Frac, P: Pt, Q: Pt, end: "pair" | "line", tail?: Text): Frame[] {
  const dx = Q[0] - P[0];
  const dy = Q[1] - P[1];
  const bPart = `b#Lb =#E2 ${val(b, "b")}`;
  const top = dy < 0 ? `-#sm ${-dy}#cm` : `${dy}#cm`;
  const frames: Frame[] = [
    { math: bPart, note: tx(`The line crosses the $y$-axis at $${pt(0, b)}$, so $b = ${num(b)}$.`, `Die Gerade schneidet die $y$-Achse bei $${pt(0, b)}$, also ist $b = ${num(b)}$.`) },
    {
      math: `${bPart} \\quad m#Lm =#E1 \\frac{\\Delta#D1 y#D2}{\\Delta#D3 x#D4}#fm`,
      note: tx(
        `For the slope, draw a slope triangle from $${pt(P[0], P[1])}$ to $${pt(Q[0], Q[1])}$.`,
        `Für die Steigung zeichnest du ein Steigungsdreieck von $${pt(P[0], P[1])}$ nach $${pt(Q[0], Q[1])}$.`,
      ),
    },
    {
      math: `${bPart} \\quad m#Lm =#E1 \\frac{${top}}{${dx}#dm}#fm`,
      note: tx(
        `That's $${dx}$ to the right and $${Math.abs(dy)}$ ${dy >= 0 ? "up" : "down"}: $\\Delta x = ${dx}$ and $\\Delta y = ${dy}$.`,
        `Du gehst $${dx}$ nach rechts und $${Math.abs(dy)}$ ${dy >= 0 ? "nach oben" : "nach unten"}: $\\Delta x = ${dx}$ und $\\Delta y = ${dy}$.`,
      ),
    },
  ];
  if (!(dx === m.d && dy === m.n && m.d !== 1)) frames.push({ math: `${bPart} \\quad m#Lm =#E1 ${val(m, "m")}`, note: tx(`Simplify: $m = ${num(m)}$.`, `Vereinfache: $m = ${num(m)}$.`) });
  if (end === "pair") frames.push({ math: `m#Lm =#E1 ${val(m, "m")} \\quad ${bPart}`, note: tail ?? tx(`So $m = ${num(m)}$ and $b = ${num(b)}$.`, `Also ist $m = ${num(m)}$ und $b = ${num(b)}$.`) });
  else frames.push({ math: lineSrc(m, b), note: tail ?? tx(`Put it together: $${plain(lineSrc(m, b))}$.`, `Alles zusammen: $${plain(lineSrc(m, b))}$.`) });
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

const HINT_MB = tx(
  "Compare with $y = mx + b$: $m$ is the number in front of $x$, $b$ is the number on its own.",
  "Vergleiche mit $y = mx + b$: $m$ ist die Zahl vor dem $x$, $b$ die Zahl ohne $x$.",
);
const HINT_SLOPE = tx(
  "$m = \\frac{y_2 - y_1}{x_2 - x_1}$. Put negative numbers in brackets. You can type a fraction like 2/3.",
  "$m = \\frac{y_2 - y_1}{x_2 - x_1}$. Setze negative Zahlen in Klammern. Du kannst einen Bruch wie 2/3 eintippen.",
);
const HINT_B = tx(
  "Put the slope into $y = mx + b$, then put in the point and solve for $b$.",
  "Setze die Steigung in $y = mx + b$ ein, dann den Punkt, und löse nach $b$ auf.",
);
const SLOPE_FIRST = tx("Put the slope into $y = mx + b$. Only $b$ is missing.", "Setze die Steigung in $y = mx + b$ ein. Nur $b$ fehlt noch.");
const I_SLOPE_B = tx("Slope and y-intercept", "Steigung und y-Achsenabschnitt");
const I_LINE = tx("Find the line equation", "Bestimme die Geradengleichung");

// ---------------------------------------------------------------------------
// Typical mistakes. Each wrong answer is simulated from the task's own numbers, so it is
// exactly what a student with that misconception gets. Shared with linear-systems.

/** What a student types to give the answer `spec` (to test it against the checker). */
function typedAnswer(spec: AnswerSpec): AnswerValue | null {
  const typed = (v: number) => (Number.isFinite(v) && !/e/i.test(String(v)) ? String(v) : null);
  switch (spec.kind) {
    case "number": {
      const s = typed(spec.value);
      return s === null ? null : { kind: "text", text: s };
    }
    case "pair": {
      const [a, b] = spec.values.map(typed);
      return a === null || b === null ? null : { kind: "list", values: [a, b] };
    }
    case "expr":
      return { kind: "text", text: spec.value };
    case "choice":
      return { kind: "choice", index: spec.correct };
    default:
      return null;
  }
}

/** Title and Blob's line for a typical mistake. */
export type Msg = [title: Text, say: Text];

/**
 * Typical mistakes for an exercise whose right answer is `answer`. `add` keeps a simulated
 * wrong answer only if the checker really rejects it and no earlier mistake covers it already.
 */
export function mistakeList(answer: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec | null, title: Text, say: Text) => {
    const typed = when && typedAnswer(when);
    if (!when || !typed || check(answer, typed).correct || list.some((m) => check(m.when, typed).correct)) return;
    list.push({ when, title, say });
  };
  return { list, add };
}

const MB: [string, string] = ["m", "b"];
const mbPair = (m: number, b: number): AnswerSpec => ({ kind: "pair", names: MB, values: [m, b] });
const lineWhen = (m: Frac, b: Frac): AnswerSpec => ({ kind: "expr", value: linePlain(m, b) });
const numWhen = (v: number): AnswerSpec => ({ kind: "number", value: v });
const isUnit = (m: Frac) => m.d === 1 && Math.abs(m.n) === 1;
/** 1/m, or null when that is m itself (±1) or undefined (0). */
const flipped = (m: Frac) => (m.n === 0 || Math.abs(m.n) === m.d ? null : div(ONE, m));
/** b of the line with slope m through P. */
const bThrough = (m: Frac, P: Pt) => sub(q(P[1]), mul(m, q(P[0])));
/** "3x", "-x", "\frac{1}{2}x" for messages. */
const mx = (m: Frac) => plain(term(m, "x", "m", true));

const UPSIDE_GRAPH: Msg = [
  tx("Slope upside down", "Steigung auf dem Kopf"),
  tx(
    "Ah, I see what happened! You did **right over up**. The slope is **up over right**: $m = \\frac{\\Delta y}{\\Delta x}$.",
    "Ah, ich seh, was passiert ist! Du hast **rechts durch hoch** gerechnet. Die Steigung ist **hoch durch rechts**: $m = \\frac{\\Delta y}{\\Delta x}$.",
  ),
];
const UPSIDE_POINTS: Msg = [
  tx("Slope upside down", "Steigung auf dem Kopf"),
  tx(
    "Ah, I see what happened! The $x$-values ended up on top. It's the other way round: $m = \\frac{y_2 - y_1}{x_2 - x_1}$, the $y$-values go on top.",
    "Ah, ich seh, was passiert ist! Die $x$-Werte sind oben gelandet. Es ist andersrum: $m = \\frac{y_2 - y_1}{x_2 - x_1}$, die $y$-Werte gehören in den Zähler.",
  ),
];
const ORDER_MIXED: Msg = [
  tx("Order mixed up", "Reihenfolge vertauscht"),
  tx(
    "Nearly! I think you subtracted in a different order on top and bottom. Both times the same point has to come first.",
    "Fast! Ich glaub, du hast oben und unten in verschiedener Reihenfolge subtrahiert. Beide Male muss derselbe Punkt zuerst kommen.",
  ),
];
const X_AXIS: Msg = [
  tx("Read on the x-axis", "An der x-Achse abgelesen"),
  tx(
    "Ooh, classic trap! That's where the line crosses the **x**-axis. $b$ is where it crosses the **y**-axis.",
    "Die klassische Falle! Da schneidet die Gerade die **x**-Achse. $b$ ist die Stelle, an der sie die **y**-Achse schneidet.",
  ),
];
const SWAPPED_MB: Msg = [
  tx("m and b swapped", "m und b vertauscht"),
  tx(
    "Ha, the right numbers in the wrong places! The slope stands in front of $x$, and $b$ is the number on its own.",
    "Ha, die richtigen Zahlen am falschen Platz! Die Steigung steht vor dem $x$, und $b$ ist die Zahl ohne $x$.",
  ),
];
/** The student gave the slope of a graph with the wrong sign. */
const slopeSign = (m: Frac): Msg =>
  m.n < 0
    ? [
        tx("The line falls", "Die Gerade fällt"),
        tx(
          "Look at the graph again: from left to right the line goes **down**. A falling line has a **negative** slope.",
          "Schau noch mal auf den Graphen: Von links nach rechts geht die Gerade **nach unten**. Eine fallende Gerade hat eine **negative** Steigung.",
        ),
      ]
    : [
        tx("The line rises", "Die Gerade steigt"),
        tx(
          "Look at the graph again: from left to right the line goes **up**. A rising line has a **positive** slope.",
          "Schau noch mal auf den Graphen: Von links nach rechts geht die Gerade **nach oben**. Eine steigende Gerade hat eine **positive** Steigung.",
        ),
      ];
const yAsB = (name: string): Msg => [
  tx("y-coordinate taken as b", "y-Koordinate als b genommen"),
  tx(
    `Ah, I see what happened! You took the $y$-coordinate of $${name}$ as $b$. But $${name}$ isn't on the $y$-axis: put it into $y = mx + b$ and solve for $b$.`,
    `Ah, ich seh, was passiert ist! Du hast die $y$-Koordinate von $${name}$ als $b$ genommen. Aber $${name}$ liegt nicht auf der $y$-Achse: Setz den Punkt in $y = mx + b$ ein und löse nach $b$ auf.`,
  ),
];
/** b = y + m·x instead of y − m·x. */
const bSignSlip = (prod: Frac, slopeRight: boolean): Msg => [
  tx("Sign slip finding b", "Vorzeichenfehler bei b"),
  tx(
    `${slopeRight ? "Nearly, the slope is right!" : "Nearly!"} But to get $b$ alone, $${num(prod)}$ has to change its sign as it moves to the other side.`,
    `${slopeRight ? "Fast, die Steigung stimmt!" : "Fast!"} Aber wenn du $b$ allein stellst, muss $${num(prod)}$ beim Wechsel auf die andere Seite sein Vorzeichen ändern.`,
  ),
];
/** x and y of a point swapped when putting it into the equation. */
const coordsSwapped = (P: Pt, name: string): Msg => [
  tx("x and y swapped", "x und y vertauscht"),
  tx(
    `Looks like you put the coordinates in the wrong way round. In $${pt(P[0], P[1], name)}$ the first number is $x$ and the second is $y$.`,
    `Sieht so aus, als hättest du die Koordinaten vertauscht eingesetzt. In $${pt(P[0], P[1], name)}$ ist die erste Zahl $x$ und die zweite $y$.`,
  ),
];
const notDivided = (m: Frac): Msg => [
  tx("Not divided yet", "Noch nicht geteilt"),
  tx(`Almost there! That's what $${mx(m)}$ is, not $x$ yet. One more step.`, `Fast geschafft! Das ist erst $${mx(m)}$, noch nicht $x$. Ein Schritt fehlt noch.`),
];

/** L1: m and b read off an equation. */
function equationMistakes(m: Frac, b: Frac, form: "std" | "swap" | "nob" | "flat"): Mistake[] {
  const M = qv(m);
  const B = qv(b);
  const mk = mistakeList(mbPair(M, B));
  if (form === "flat") {
    const noX = tx("No x-term here", "Kein x-Term da");
    mk.add(
      mbPair(B, 0),
      noX,
      tx(
        "Ah, a number on its own is never the slope! $m$ is the number in front of $x$, and here there's no $x$-term at all.",
        "Ah, eine Zahl ohne $x$ ist nie die Steigung! $m$ ist die Zahl vor dem $x$, und hier gibt es gar keinen $x$-Term.",
      ),
    );
    mk.add(
      mbPair(1, B),
      noX,
      tx(
        "Hmm, $m = 1$ would mean there's an $x$ in the equation. Here there's no $x$-term at all: what does that say about the slope?",
        "Hm, $m = 1$ hieße, dass ein $x$ in der Gleichung steht. Hier gibt es gar keinen $x$-Term: Was heißt das für die Steigung?",
      ),
    );
  } else if (form === "swap") {
    mk.add(
      mbPair(B, M),
      tx("Fooled by the order", "Reihenfolge-Falle"),
      tx(
        "Ah, the order tricked you! Here the number comes first, but $m$ is always the number **in front of $x$**, wherever it stands.",
        "Ah, die Reihenfolge hat dich reingelegt! Hier steht die Zahl vorne, aber $m$ ist immer die Zahl **vor dem $x$**, egal wo sie steht.",
      ),
    );
  } else if (B !== 0) mk.add(mbPair(B, M), ...SWAPPED_MB);
  else if (!isUnit(m)) {
    mk.add(
      mbPair(0, M),
      tx("No number on its own", "Keine Zahl ohne x"),
      tx(
        `Ah, the $${num(m)}$ is stuck to the $x$, so it's the slope! There's no number on its own here: what does that make $b$?`,
        `Ah, die $${num(m)}$ klebt am $x$, sie ist also die Steigung! Eine Zahl ohne $x$ gibt es hier nicht: Was heißt das für $b$?`,
      ),
    );
  }
  if (M < 0 && B < 0) {
    mk.add(
      mbPair(-M, -B),
      tx("Minus signs lost", "Minuszeichen verloren"),
      tx("Nearly! $m$ and $b$ both take their signs along: each minus belongs to the number behind it.", "Fast! $m$ und $b$ nehmen beide ihr Vorzeichen mit: Jedes Minus gehört zur Zahl dahinter."),
    );
  }
  if (B < 0) {
    mk.add(
      mbPair(M, -B),
      tx("Minus of b lost", "Minus von b verloren"),
      tx(`Nearly! $b$ takes its sign along: the minus in front of the $${num(neg(b))}$ belongs to $b$.`, `Fast! $b$ nimmt sein Vorzeichen mit: Das Minus vor der $${num(neg(b))}$ gehört zu $b$.`),
    );
  }
  if (M < 0) {
    mk.add(
      mbPair(-M, B),
      tx("Minus of m lost", "Minus von m verloren"),
      tx("Nearly! $m$ takes its sign along: the minus in front of the $x$-term belongs to $m$.", "Fast! $m$ nimmt sein Vorzeichen mit: Das Minus vor dem $x$-Term gehört zu $m$."),
    );
  }
  if (isUnit(m)) {
    mk.add(
      mbPair(0, B),
      tx("x alone isn't 0", "x allein heißt nicht 0"),
      tx(
        "Ah, no number in front of $x$ doesn't mean $m = 0$! There's an invisible number hiding there. Which one?",
        "Ah, keine Zahl vor dem $x$ heißt nicht $m = 0$! Da versteckt sich eine unsichtbare Zahl. Welche?",
      ),
    );
  }
  return mk.list;
}

/** L1: m and b read off a graph (answer as a pair). */
function graphPairMistakes(m: Frac, b: Frac): Mistake[] {
  const B = qv(b);
  const mk = mistakeList(mbPair(qv(m), B));
  const inv = flipped(m);
  if (inv) mk.add(mbPair(qv(inv), B), ...UPSIDE_GRAPH);
  mk.add(mbPair(-qv(m), B), ...slopeSign(m));
  if (b.n !== 0) mk.add(mbPair(qv(m), qv(neg(div(b, m)))), ...X_AXIS);
  return mk.list;
}

/** L3: the equation of a graph (answer as y = …). */
function graphLineMistakes(m: Frac, b: Frac): Mistake[] {
  const mk = mistakeList(lineWhen(m, b));
  const inv = flipped(m);
  if (inv) mk.add(lineWhen(inv, b), ...UPSIDE_GRAPH);
  mk.add(lineWhen(neg(m), b), ...slopeSign(m));
  if (b.n !== 0) {
    mk.add(lineWhen(m, neg(div(b, m))), ...X_AXIS);
    mk.add(lineWhen(b, m), ...SWAPPED_MB);
  }
  return mk.list;
}

/** Why a wrong option of "which equation belongs to the graph?" is wrong. */
function optionMistake(m: Frac, b: Frac, o: [Frac, Frac]): Msg {
  const [om, ob] = o;
  if (eq(om, m) && eq(ob, neg(b))) {
    return [
      tx("Sign of b", "Vorzeichen von b"),
      tx(
        "Nearly! The slope fits, but check the sign of $b$: does the line cross the $y$-axis above or below $0$?",
        "Fast! Die Steigung passt, aber prüf das Vorzeichen von $b$: Schneidet die Gerade die $y$-Achse oberhalb oder unterhalb von $0$?",
      ),
    ];
  }
  if (eq(om, m) && eq(ob, add(b, ONE))) {
    return [
      tx("Off by one", "Um eins daneben"),
      tx(
        "So close! Same slope, but this line crosses the $y$-axis one unit higher than the one in the graph.",
        "Ganz knapp! Gleiche Steigung, aber diese Gerade schneidet die $y$-Achse eine Einheit höher als die im Bild.",
      ),
    ];
  }
  if (eq(om, m)) {
    return [
      tx("Check b", "b prüfen"),
      tx(
        "So close! Same slope, but look exactly where the line in the graph crosses the $y$-axis.",
        "Ganz knapp! Gleiche Steigung, aber schau genau hin, wo die Gerade im Bild die $y$-Achse schneidet.",
      ),
    ];
  }
  if (eq(om, neg(m)) && eq(ob, b)) {
    return m.n > 0
      ? [
          tx("Wrong direction", "Falsche Richtung"),
          tx(
            "Nearly! The y-intercept fits, but this line would **fall**: its slope is negative. The line in the graph rises.",
            "Fast! Der y-Achsenabschnitt passt, aber diese Gerade würde **fallen**: Ihre Steigung ist negativ. Die Gerade im Bild steigt.",
          ),
        ]
      : [
          tx("Wrong direction", "Falsche Richtung"),
          tx(
            "Nearly! The y-intercept fits, but this line would **rise**: its slope is positive. The line in the graph falls.",
            "Fast! Der y-Achsenabschnitt passt, aber diese Gerade würde **steigen**: Ihre Steigung ist positiv. Die Gerade im Bild fällt.",
          ),
        ];
  }
  if (eq(ob, b) && eq(om, div(ONE, m))) {
    return [
      tx("Slope upside down", "Steigung auf dem Kopf"),
      tx(
        "Close! The y-intercept fits, but this slope is upside down. It's **up over right**: $m = \\frac{\\Delta y}{\\Delta x}$.",
        "Knapp! Der y-Achsenabschnitt passt, aber diese Steigung steht auf dem Kopf. Es heißt **hoch durch rechts**: $m = \\frac{\\Delta y}{\\Delta x}$.",
      ),
    ];
  }
  if (eq(om, neg(m)) && eq(ob, neg(b))) {
    return [
      tx("Both signs flipped", "Beide Vorzeichen falsch"),
      tx(
        "Both signs are flipped in this one. Does the line rise or fall? And does it cross the $y$-axis above or below $0$?",
        "Hier sind beide Vorzeichen andersrum. Steigt oder fällt die Gerade? Und schneidet sie die $y$-Achse oberhalb oder unterhalb von $0$?",
      ),
    ];
  }
  return [
    tx("m and b swapped", "m und b vertauscht"),
    tx(
      "Ooh, in this one $m$ and $b$ swapped places! The number in front of $x$ is the slope, the number on its own shows where the line meets the $y$-axis.",
      "Ooh, hier haben $m$ und $b$ die Plätze getauscht! Die Zahl vor dem $x$ ist die Steigung, die Zahl ohne $x$ zeigt, wo die Gerade die $y$-Achse trifft.",
    ),
  ];
}

/** L1: y for a given x. */
function valueMistakes(m: Frac, b: Frac, x: number): Mistake[] {
  const prod = qv(mul(m, q(x)));
  const B = qv(b);
  const mk = mistakeList(numWhen(prod + B));
  const times = `$${num(m)} \\cdot ${num(x, true)}$`;
  if (B !== 0) {
    mk.add(
      numWhen(prod),
      tx("b left out", "b vergessen"),
      tx(`Good start with ${times}! But you stopped there: the $${num(b)}$ at the end still has to be included.`, `Guter Anfang mit ${times}! Aber da hast du aufgehört: Die $${num(b)}$ am Ende gehört noch dazu.`),
    );
  }
  if (m.n < 0 || x < 0) {
    const sign = (v: number) => (v < 0 ? "Minus" : "Plus");
    const result = m.n < 0 && x < 0 ? "Plus" : "Minus";
    const en = (s: string) => s.toLowerCase();
    mk.add(
      numWhen(-prod + B),
      tx("Sign of the product", "Vorzeichen vom Produkt"),
      tx(
        `Careful with the signs: ${times} is ${en(sign(m.n))} times ${en(sign(x))}, and that gives **${en(result)}**!`,
        `Achtung bei den Vorzeichen: ${times} ist ${sign(m.n)} mal ${sign(x)}, und das ergibt **${result}**!`,
      ),
    );
  }
  if (!isUnit(m)) {
    mk.add(
      numWhen(qv(m) + x + B),
      tx("Plus instead of times", "Plus statt mal"),
      tx(
        `Ah, I think you added $${num(m)}$ and $${num(x)}$. But $${mx(m)}$ means $${num(m)}$ **times** $x$.`,
        `Ah, ich glaub, du hast $${num(m)}$ und $${num(x)}$ addiert. Aber $${mx(m)}$ heißt $${num(m)}$ **mal** $x$.`,
      ),
    );
  }
  return mk.list;
}

/** L2: slope through A and B (B − A on top and bottom). */
function slopeMistakes(A: Pt, B: Pt): Mistake[] {
  const m = q(B[1] - A[1], B[0] - A[0]);
  const mk = mistakeList(numWhen(qv(m)));
  const inv = flipped(m);
  if (inv) mk.add(numWhen(qv(inv)), ...UPSIDE_POINTS);
  mk.add(numWhen(-qv(m)), ...ORDER_MIXED);
  // Minus a negative coordinate taken as minus: 3 − (−2) worked out as 3 − 2.
  if (A[0] < 0 || A[1] < 0) {
    const dx = B[0] - Math.abs(A[0]);
    const ex = A[1] < 0 ? `${B[1]} - (${A[1]})` : `${B[0]} - (${A[0]})`;
    if (dx !== 0) {
      mk.add(
        numWhen((B[1] - Math.abs(A[1])) / dx),
        tx("Minus a negative number", "Minus eine negative Zahl"),
        tx(
          `Careful with negative coordinates: subtracting a negative number means **adding**. Put it in brackets: $${ex}$.`,
          `Vorsicht bei negativen Koordinaten: Eine negative Zahl abziehen heißt **addieren**. Setz sie in Klammern: $${ex}$.`,
        ),
      );
    }
  }
  return mk.list;
}

/** L2: line from its slope and a point P. */
function slopePointMistakes(m: Frac, P: Pt): Mistake[] {
  const mk = mistakeList(lineWhen(m, bThrough(m, P)));
  const prod = mul(m, q(P[0]));
  mk.add(lineWhen(m, q(P[1])), ...yAsB("P"));
  mk.add(lineWhen(m, add(q(P[1]), prod)), ...bSignSlip(prod, false));
  mk.add(lineWhen(m, sub(q(P[0]), mul(m, q(P[1])))), ...coordsSwapped(P, "P"));
  return mk.list;
}

/** L2: point test. Only one wrong option, so Blob guesses the slip that leads there. */
function pointTestMistakes(m: Frac, b: Frac, P: Pt, on: boolean, answer: Extract<AnswerSpec, { kind: "choice" }>): Mistake[] {
  const [px, py] = P;
  const M = qv(m);
  const B = qv(b);
  const prod = M * px;
  const times = `$${num(m)} \\cdot ${num(px, true)}$`;
  const mk = mistakeList(answer);
  const when = { ...answer, correct: on ? 1 : 0 };
  const negative = M < 0 || px < 0;
  if (on) {
    if (negative) {
      mk.add(
        when,
        tx("Check the calculation", "Rechnung prüfen"),
        tx(
          `Recheck the right side step by step: first ${times} (watch the sign!), then the rest. Compare with the left side.`,
          `Rechne die rechte Seite noch mal Schritt für Schritt: erst ${times} (Vorzeichen beachten!), dann den Rest. Vergleich mit der linken Seite.`,
        ),
      );
    } else {
      mk.add(
        when,
        tx("Check the calculation", "Rechnung prüfen"),
        tx(
          `Did you put the numbers in the right places? $x = ${px}$ goes into $${mx(m)}$, and $y = ${py}$ is the left side.`,
          `Hast du die Zahlen an der richtigen Stelle eingesetzt? $x = ${px}$ kommt in $${mx(m)}$, und $y = ${py}$ steht auf der linken Seite.`,
        ),
      );
    }
  } else if (M * py + B === px) {
    mk.add(
      when,
      tx("x and y swapped", "x und y vertauscht"),
      tx(
        `Careful: it only works out if you swap $x$ and $y$. In $${pt(px, py, "P")}$, $x = ${px}$ and $y = ${py}$.`,
        `Vorsicht: Das geht nur auf, wenn du $x$ und $y$ vertauschst. In $${pt(px, py, "P")}$ ist $x = ${px}$ und $y = ${py}$.`,
      ),
    );
  } else if (negative && -prod + B === py) {
    mk.add(
      when,
      tx("Watch the sign", "Achtung, Vorzeichen"),
      tx(`Check the sign of ${times} again. With the right sign, do both sides still match?`, `Prüf das Vorzeichen von ${times} noch mal. Passen beide Seiten mit dem richtigen Vorzeichen immer noch zusammen?`),
    );
  } else if (!isUnit(m) && M + px + B === py) {
    mk.add(
      when,
      tx("Plus instead of times", "Plus statt mal"),
      tx(`Careful: $${mx(m)}$ means $${num(m)}$ **times** $x$, not plus. Work out the right side again.`, `Vorsicht: $${mx(m)}$ heißt $${num(m)}$ **mal** $x$, nicht plus. Rechne die rechte Seite noch mal aus.`),
    );
  } else {
    mk.add(
      when,
      tx("Really equal?", "Wirklich gleich?"),
      tx(`Put in $x = ${px}$ and work out the right side exactly. Does it really give $${py}$?`, `Setz $x = ${px}$ ein und rechne die rechte Seite genau aus. Kommt da wirklich $${py}$ heraus?`),
    );
  }
  return mk.list;
}

/** L2: x of a point on the line with a given y. */
function missingXMistakes(m: Frac, b: Frac, y: number): Mistake[] {
  const M = qv(m);
  const B = qv(b);
  const mk = mistakeList(numWhen((y - B) / M));
  mk.add(
    numWhen(M * y + B),
    tx("Put in for x", "Für x eingesetzt"),
    tx(
      `Ah, I see what happened! You put $${y}$ in for $x$. But $${y}$ is the $y$-coordinate: set $y = ${y}$ and solve for $x$.`,
      `Ah, ich seh, was passiert ist! Du hast $${y}$ für $x$ eingesetzt. Aber $${y}$ ist die $y$-Koordinate: Setz $y = ${y}$ und löse nach $x$ auf.`,
    ),
  );
  mk.add(
    numWhen((y + B) / M),
    tx("Sign of b kept", "Vorzeichen von b behalten"),
    tx(
      `Nearly! To get the $x$-term alone, ${B > 0 ? "subtract" : "add"} $${num(Math.abs(B))}$ on both sides. I think you did the opposite.`,
      `Fast! Um den $x$-Term allein zu bekommen, musst du auf beiden Seiten $${num(Math.abs(B))}$ ${B > 0 ? "subtrahieren" : "addieren"}. Ich glaub, du hast das Gegenteil gemacht.`,
    ),
  );
  mk.add(
    numWhen(y / M - B),
    tx("Divided too early", "Zu früh geteilt"),
    tx(
      `Close! If you divide by $${num(m)}$ first, the $${num(b)}$ has to be divided too. Easier: first get rid of the $${num(b)}$, then divide.`,
      `Knapp! Wenn du zuerst durch $${num(m)}$ teilst, musst du die $${num(b)}$ auch teilen. Einfacher: Erst die $${num(b)}$ wegschaffen, dann teilen.`,
    ),
  );
  mk.add(numWhen(y - B), ...notDivided(m));
  return mk.list;
}

/** L2/L3: the zero −b/m. */
function zeroMistakes(m: Frac, b: Frac): Mistake[] {
  const mk = mistakeList(numWhen(qv(neg(div(b, m)))));
  const line = plain(
    side([
      [m, "x", "m"],
      [b, "", "b"],
    ]),
  );
  mk.add(
    numWhen(qv(div(b, m))),
    tx("Sign of b", "Vorzeichen von b"),
    tx(
      `Nearly! In $0 = ${line}$, the $${num(b)}$ changes its sign when it moves to the other side.`,
      `Fast! In $0 = ${line}$ wechselt die $${num(b)}$ ihr Vorzeichen, wenn sie auf die andere Seite kommt.`,
    ),
  );
  mk.add(
    numWhen(qv(neg(div(m, b)))),
    tx("Divided the wrong way", "Falsch herum geteilt"),
    tx(
      "Ah, I think you divided the wrong way round! Divide by the number **in front of $x$**, not the other way.",
      "Ah, ich glaub, du hast andersrum geteilt! Teile durch die Zahl **vor dem $x$**, nicht umgekehrt.",
    ),
  );
  mk.add(
    numWhen(qv(b)),
    tx("That's the y-intercept", "Das ist der y-Achsenabschnitt"),
    tx(
      `Ooh, classic trap! At $${num(b)}$ the line crosses the **y**-axis. The zero is where it crosses the **x**-axis: set $y = 0$.`,
      `Die klassische Falle! Bei $${num(b)}$ schneidet die Gerade die **y**-Achse. Die Nullstelle ist da, wo sie die **x**-Achse schneidet: Setz $y = 0$.`,
    ),
  );
  if (!isUnit(m)) mk.add(numWhen(-qv(b)), ...notDivided(m));
  return mk.list;
}

/** L3: line through A and B; `use` is the point the worked solution puts in for b. */
function twoPointsMistakes(A: Pt, B: Pt, use: 0 | 1): Mistake[] {
  const m = q(B[1] - A[1], B[0] - A[0]);
  const pts: [Pt, string][] = use === 0 ? [[A, "A"], [B, "B"]] : [[B, "B"], [A, "A"]];
  const U = pts[0][0];
  const mk = mistakeList(lineWhen(m, bThrough(m, U)));
  const inv = flipped(m);
  if (inv) mk.add(lineWhen(inv, bThrough(inv, U)), ...UPSIDE_POINTS);
  mk.add(lineWhen(neg(m), bThrough(neg(m), U)), ...ORDER_MIXED);
  for (const [P, name] of pts) mk.add(lineWhen(m, q(P[1])), ...yAsB(name));
  for (const [P] of pts) {
    const prod = mul(m, q(P[0]));
    mk.add(lineWhen(m, add(q(P[1]), prod)), ...bSignSlip(prod, true));
  }
  return mk.list;
}

/** L3: line h through P, parallel or perpendicular to g: y = mg·x + bg. */
function throughPointMistakes(mg: Frac, bg: Frac, P: Pt, perp: boolean): Mistake[] {
  const mh = perp ? neg(div(ONE, mg)) : mg;
  const through = (s: Frac) => lineWhen(s, bThrough(s, P));
  const mk = mistakeList(through(mh));
  if (perp) {
    mk.add(
      through(neg(mg)),
      tx("Only the sign flipped", "Nur das Vorzeichen gedreht"),
      tx(
        "Half of it! For perpendicular you flip the sign **and** take the reciprocal: $m_h = -\\frac{1}{m_g}$.",
        "Die Hälfte hast du! Für orthogonal drehst du das Vorzeichen um **und** bildest den Kehrwert: $m_h = -\\frac{1}{m_g}$.",
      ),
    );
    mk.add(
      through(div(ONE, mg)),
      tx("Sign not flipped", "Vorzeichen nicht gedreht"),
      tx(
        "Half of it! You took the reciprocal, but the sign has to flip too: $m_h = -\\frac{1}{m_g}$.",
        "Die Hälfte hast du! Den Kehrwert hast du, aber das Vorzeichen muss sich auch umdrehen: $m_h = -\\frac{1}{m_g}$.",
      ),
    );
    mk.add(
      through(mg),
      tx("That's parallel", "Das wäre parallel"),
      tx(
        "Hmm, with the same slope $h$ would be **parallel** to $g$. Perpendicular means $m_g \\cdot m_h = -1$.",
        "Hm, mit der gleichen Steigung wäre $h$ **parallel** zu $g$. Orthogonal heißt $m_g \\cdot m_h = -1$.",
      ),
    );
  } else {
    mk.add(
      lineWhen(mg, bg),
      tx("That's g again", "Das ist wieder g"),
      tx(
        "Same slope, great! But that's just $g$ again. $h$ has to go through $P$, so it needs its own $b$: put $P$ in.",
        "Gleiche Steigung, super! Aber das ist einfach wieder $g$. $h$ muss durch $P$ gehen, braucht also ein eigenes $b$: Setz $P$ ein.",
      ),
    );
    mk.add(
      through(neg(div(ONE, mg))),
      tx("That's perpendicular", "Das wäre orthogonal"),
      tx(
        "Ah, $-\\frac{1}{m}$ is the slope for a **perpendicular** line. Parallel lines simply have the **same** slope.",
        "Ah, $-\\frac{1}{m}$ ist die Steigung für eine **orthogonale** Gerade. Parallele Geraden haben einfach die **gleiche** Steigung.",
      ),
    );
  }
  mk.add(lineWhen(mh, q(P[1])), ...yAsB("P"));
  const prod = mul(mh, q(P[0]));
  mk.add(lineWhen(mh, add(q(P[1]), prod)), ...bSignSlip(prod, true));
  return mk.list;
}

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
    frames.push({ math: swapped, note: tx("Here the number comes first. Sort it into the form $y = mx + b$.", "Hier steht die Zahl vorne. Bring die Gleichung in die Form $y = mx + b$.") });
    frames.push({
      math: lineSrc(m, b),
      note: tx(`Swap the two terms. Each one keeps its sign: $${plain(lineSrc(m, b))}$.`, `Vertausche die beiden Terme. Jeder behält sein Vorzeichen: $${plain(lineSrc(m, b))}$.`),
    });
  } else {
    frames.push({ math: given, note: tx("Compare with $y = mx + b$.", "Vergleiche mit $y = mx + b$.") });
  }
  const mNote =
    form === "flat"
      ? tx("There is no $x$-term at all, so $m = 0$. The line is horizontal.", "Es gibt gar keinen $x$-Term, also ist $m = 0$. Die Gerade verläuft waagerecht.")
      : m.n === 1 && m.d === 1
        ? tx("No number in front of $x$ means $m = 1$.", "Steht keine Zahl vor dem $x$, ist $m = 1$.")
        : m.n === -1 && m.d === 1
          ? tx("Just a minus in front of $x$ means $m = -1$.", "Steht nur ein Minus vor dem $x$, ist $m = -1$.")
          : tx(`$m$ is the number in front of $x$, with its sign: $m = ${num(m)}$.`, `$m$ ist die Zahl vor dem $x$, mit Vorzeichen: $m = ${num(m)}$.`);
  frames.push({ math: lineSrc(m, b), highlight: termKeys("m").filter((k) => k !== "vm"), note: mNote });
  frames.push({
    math: lineSrc(m, b),
    highlight: termKeys("b"),
    note:
      form === "nob"
        ? tx("There is no number on its own, so $b = 0$. The line goes through the origin.", "Es gibt keine Zahl ohne $x$, also ist $b = 0$. Die Gerade geht durch den Ursprung.")
        : tx(`$b$ is the number on its own, with its sign: $b = ${num(b)}$.`, `$b$ ist die Zahl ohne $x$, mit Vorzeichen: $b = ${num(b)}$.`),
  });
  frames.push({ math: `m#Lm =#E1 ${val(m, "m")} \\quad b#Lb =#E2 ${val(b, "b")}`, note: tx(`So $m = ${num(m)}$ and $b = ${num(b)}$.`, `Also ist $m = ${num(m)}$ und $b = ${num(b)}$.`) });
  return {
    instruction: I_SLOPE_B,
    text: tx("Find the slope $m$ and the y-intercept $b$.", "Bestimme die Steigung $m$ und den y-Achsenabschnitt $b$."),
    math: plain(given),
    answer: { kind: "pair", names: ["m", "b"], values: [qv(m), qv(b)] },
    hint: HINT_MB,
    solution: frames,
    mistakes: equationMistakes(m, b, form),
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

const READ_GRAPH = tx("Read the slope $m$ and the y-intercept $b$ off the graph.", "Lies die Steigung $m$ und den y-Achsenabschnitt $b$ am Graphen ab.");

/** L1: read m and b off a graph (pair); L3: write down the equation of the graph (expr). */
function graphTask(rng: Rng, hard: boolean): Exercise {
  const { m, b, P, Q } = markedLine(rng, hard);
  if (!hard) {
    return {
      instruction: I_SLOPE_B,
      text: READ_GRAPH,
      visual: lineGraph(m, b, [P, Q]),
      answer: { kind: "pair", names: ["m", "b"], values: [qv(m), qv(b)] },
      hint: tx(
        "$b$: where does the line cross the $y$-axis? $m$: walk from one marked point to the other. How far right, how far up or down?",
        "$b$: Wo schneidet die Gerade die $y$-Achse? $m$: Geh von einem markierten Punkt zum anderen. Wie weit nach rechts, wie weit nach oben oder unten?",
      ),
      solution: readGraphFrames(m, b, P, Q, "pair"),
      mistakes: graphPairMistakes(m, b),
    };
  }
  return {
    instruction: I_LINE,
    text: tx("Write down the equation of the line in the graph.", "Gib die Gleichung der abgebildeten Geraden an."),
    visual: lineGraph(m, b, [P, Q]),
    answer: { kind: "expr", value: linePlain(m, b), prefix: "y =", form: "expanded" },
    hint: tx(
      "Read $b$ where the line crosses the $y$-axis. For $m$, use a slope triangle between the marked points: $m = \\frac{\\Delta y}{\\Delta x}$.",
      "Lies $b$ dort ab, wo die Gerade die $y$-Achse schneidet. Für $m$ nimmst du ein Steigungsdreieck zwischen den markierten Punkten: $m = \\frac{\\Delta y}{\\Delta x}$.",
    ),
    solution: readGraphFrames(m, b, P, Q, "line"),
    mistakes: graphLineMistakes(m, b),
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
  // Every wrong option is a typical misreading: slope sign, sign of b, m and b swapped, Δx/Δy…
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
  const answer = { kind: "choice" as const, options: options.map(([x, y]) => `$${plain(lineSrc(x, y))}$`), correct };
  const mk = mistakeList(answer);
  options.forEach((o, i) => i !== correct && mk.add({ ...answer, correct: i }, ...optionMistake(m, b, o)));
  return {
    instruction: tx("Match the graph", "Ordne den Graphen zu"),
    text: tx("Which equation belongs to the line in the graph?", "Welche Gleichung gehört zur abgebildeten Geraden?"),
    visual: lineGraph(m, b, [P, Q]),
    answer,
    mistakes: mk.list,
    hint: tx(
      "First read $b$ on the $y$-axis. Then check the slope: does the line rise or fall, and how steeply?",
      "Lies zuerst $b$ an der $y$-Achse ab. Prüf dann die Steigung: Steigt oder fällt die Gerade, und wie steil?",
    ),
    solution: readGraphFrames(m, b, P, Q, "line", tx(`That's answer ${letter}: $${plain(lineSrc(m, b))}$.`, `Das ist Antwort ${letter}: $${plain(lineSrc(m, b))}$.`)),
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
    { math: lineSrc(m, b), highlight: ["vm"], note: tx(`Replace $x$ by $${num(x)}$.`, `Setze $${num(x)}$ für $x$ ein.`) },
    { math: `y#Y =#EQ ${val(m, "m")} \\cdot#dot ${valWrap(x, "vm")} ${term(b, "", "b", false)}`, note: tx("Multiply first, then add.", "Erst multiplizieren, dann addieren.") },
    { math: `y#Y =#EQ ${val(prod, "m")} ${term(b, "", "b", false)}`, note: `$${num(m)} \\cdot ${num(x, true)} = ${num(prod)}$.` },
  ];
  const done = tx(`So $y = ${num(y)}$. The point $${pt(x, y, "P")}$ lies on the line.`, `Also ist $y = ${num(y)}$. Der Punkt $${pt(x, y, "P")}$ liegt auf der Geraden.`);
  if (b.n !== 0) frames.push({ math: `y#Y =#EQ ${val(y, "m")}`, note: done });
  else frames[frames.length - 1] = { ...frames[frames.length - 1], note: joinT(`$${num(m)} \\cdot ${num(x, true)} = ${num(prod)}$.`, done) };
  const ask = rng.chance(0.5);
  return {
    instruction: tx("Find y", "Berechne y"),
    text: ask
      ? tx(`Find $y$ for $x = ${num(x)}$.`, `Berechne $y$ für $x = ${num(x)}$.`)
      : tx(`The point $${pt(x, "?", "P")}$ lies on the line. Find its $y$-coordinate.`, `Der Punkt $${pt(x, "?", "P")}$ liegt auf der Geraden. Berechne seine $y$-Koordinate.`),
    math: plain(lineSrc(m, b)),
    answer: { kind: "number", value: qv(y), label: "y =" },
    hint: tx(`Put $${num(x)}$ in for $x$. Multiply before you add.`, `Setze $${num(x)}$ für $x$ ein. Punkt vor Strich: erst multiplizieren, dann addieren.`),
    solution: frames,
    mistakes: valueMistakes(m, b, x),
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
    const { frames } = slopeFrames(A, B, tx("The slope formula: change in $y$ divided by change in $x$.", "Die Steigungsformel: Änderung von $y$ geteilt durch Änderung von $x$."));
    return {
      instruction: tx("Find the slope", "Berechne die Steigung"),
      text: tx("Find the slope $m$ of the line through $A$ and $B$.", "Berechne die Steigung $m$ der Geraden durch $A$ und $B$."),
      math: `${pt(A[0], A[1], "A")} \\quad ${pt(B[0], B[1], "B")}`,
      answer: { kind: "number", value: qv(m), label: "m =" },
      hint: HINT_SLOPE,
      solution: frames,
      mistakes: slopeMistakes(A, B),
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
      instruction: I_LINE,
      text: tx(
        `A line has the slope $m = ${num(m)}$ and passes through $${pt(px, py, "P")}$. Find its equation.`,
        `Eine Gerade hat die Steigung $m = ${num(m)}$ und geht durch $${pt(px, py, "P")}$. Bestimme ihre Gleichung.`,
      ),
      answer: { kind: "expr", value: linePlain(m, b), prefix: "y =", form: "expanded" },
      hint: HINT_B,
      solution: findBFrames(m, [px, py], "P", SLOPE_FIRST),
      mistakes: slopePointMistakes(m, [px, py]),
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
  const answer = {
    kind: "choice" as const,
    options: [tx("Yes, $P$ lies on the line.", "Ja, $P$ liegt auf der Geraden."), tx("No, $P$ is not on the line.", "Nein, $P$ liegt nicht auf der Geraden.")],
    correct: on ? 0 : 1,
  };
  return {
    instruction: tx("Point test", "Punktprobe"),
    text: tx(`Does the point $${P}$ lie on the line?`, `Liegt der Punkt $${P}$ auf der Geraden?`),
    math: plain(lineSrc(m, b)),
    answer,
    mistakes: pointTestMistakes(m, b, [px, py], on, answer),
    hint: tx("Put both coordinates of $P$ into the equation. Do you get a true statement?", "Setze beide Koordinaten von $P$ in die Gleichung ein. Erhältst du eine wahre Aussage?"),
    solution: [
      { math: lineSrc(m, b), note: tx("**Point test**: put both coordinates of $P$ into the equation.", "**Punktprobe**: Setze beide Koordinaten von $P$ in die Gleichung ein.") },
      { math: `${val(py, "Y")} =#EQ ${val(m, "m")} \\cdot#dot ${valWrap(px, "vm")} ${term(b, "", "b", false)}`, note: tx(`$x = ${px}$ and $y = ${py}$.`, `$x = ${px}$ und $y = ${py}$.`) },
      on
        ? {
            math: `\\green{${val(py, "Y")} =#EQ ${val(right, "m")}}`,
            note: tx("Both sides are equal, a true statement. So $P$ lies on the line.", "Beide Seiten sind gleich, eine wahre Aussage. Also liegt $P$ auf der Geraden."),
          }
        : {
            math: `\\red{${val(py, "Y")} \\ne#EQ ${val(right, "m")}}`,
            note: tx(
              `The right side gives $${right}$, not $${py}$. A false statement, so $P$ is **not** on the line.`,
              `Die rechte Seite ergibt $${right}$, nicht $${py}$. Eine falsche Aussage, also liegt $P$ **nicht** auf der Geraden.`,
            ),
          },
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
      instruction: tx("Find x", "Berechne x"),
      text: tx(`The point $${pt("?", y, "P")}$ lies on the line. Find its $x$-coordinate.`, `Der Punkt $${pt("?", y, "P")}$ liegt auf der Geraden. Berechne seine $x$-Koordinate.`),
      math: plain(lineSrc(m, b)),
      answer: { kind: "number", value: x, label: "x =" },
      hint: tx(`Put $y = ${y}$ into the equation and solve for $x$.`, `Setze $y = ${y}$ in die Gleichung ein und löse nach $x$ auf.`),
      solution: [
        { math: lineSrc(m, b), highlight: ["Y"], note: tx(`Put in $y = ${y}$.`, `Setze $y = ${y}$ ein.`) },
        ...solveFrames(q(y), m, b, "", (X) => tx(`So $x = ${num(X)}$ and the point is $${pt(X, y, "P")}$.`, `Also ist $x = ${num(X)}$, und der Punkt heißt $${pt(X, y, "P")}$.`)),
      ],
      mistakes: missingXMistakes(m, b, y),
    };
  }
}

const I_ZERO = tx("Find the zero", "Berechne die Nullstelle");
const Q_ZERO = tx("Where does the line cross the $x$-axis?", "Wo schneidet die Gerade die $x$-Achse?");

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
      instruction: I_ZERO,
      text: Q_ZERO,
      math: plain(lineSrc(m, b)),
      answer: { kind: "number", value: qv(x0), label: "x =" },
      hint: tx(
        "On the $x$-axis $y = 0$. Set $y = 0$ and solve for $x$. A decimal like 2,5 is fine.",
        "Auf der $x$-Achse ist $y = 0$. Setze $y = 0$ und löse nach $x$ auf. Eine Kommazahl wie 2,5 ist okay.",
      ),
      solution: [
        { math: lineSrc(m, b), highlight: ["Y"], note: tx("At the zero the line meets the $x$-axis, so $y = 0$.", "An der Nullstelle trifft die Gerade die $x$-Achse, also ist $y = 0$.") },
        ...solveFrames(ZERO, m, b, "", (X) =>
          tx(
            `The zero is $x = ${num(X)}$. The line crosses the $x$-axis at $${pt(X, 0, "N")}$.`,
            `Die Nullstelle ist $x = ${num(X)}$. Die Gerade schneidet die $x$-Achse in $${pt(X, 0, "N")}$.`,
          ),
        ),
      ],
      mistakes: zeroMistakes(m, b),
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
    const { frames } = slopeFrames(A, B, tx("First the slope: $m = \\frac{y_2 - y_1}{x_2 - x_1}$.", "Zuerst die Steigung: $m = \\frac{y_2 - y_1}{x_2 - x_1}$."));
    const sofar = plain(`y = ${term(m, "x", "m", true)} + b`);
    return {
      instruction: I_LINE,
      text: tx(
        `Find the equation of the line through $${pt(A[0], A[1], "A")}$ and $${pt(B[0], B[1], "B")}$.`,
        `Bestimme die Gleichung der Geraden durch $${pt(A[0], A[1], "A")}$ und $${pt(B[0], B[1], "B")}$.`,
      ),
      answer: { kind: "expr", value: linePlain(m, b), prefix: "y =", form: "expanded" },
      hint: tx(
        "First the slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$. Then put one of the points into $y = mx + b$ to get $b$.",
        "Zuerst die Steigung $m = \\frac{y_2 - y_1}{x_2 - x_1}$. Setze dann einen der Punkte in $y = mx + b$ ein, um $b$ zu bekommen.",
      ),
      solution: [...frames, ...findBFrames(m, use, use === A ? "A" : "B", tx(`Now find $b$: so far the line is $${sofar}$.`, `Jetzt fehlt $b$: Bisher heißt die Gerade $${sofar}$.`))],
      mistakes: twoPointsMistakes(A, B, use === A ? 0 : 1),
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
          { math: "m#Lg _{g#Lgi}#Sg \\cdot#X m#Lh _{h#Lhi}#Sh =#E -#sr 1#cr", note: tx("Perpendicular lines: their slopes multiply to $-1$.", "Orthogonale Geraden: Das Produkt ihrer Steigungen ist $-1$.") },
          { math: `${val(mg, "g")} \\cdot#X m#Lh _{h#Lhi}#Sh =#E -#sr 1#cr`, note: tx(`Put in $m_g = ${num(mg)}$.`, `Setze $m_g = ${num(mg)}$ ein.`) },
          {
            math: `m#Lh _{h#Lhi}#Sh =#E ${val(mh, "m")}`,
            note: tx(
              `So $m_h = ${num(mh)}$: flip $${num(mg)}$ upside down and change the sign.`,
              `Also ist $m_h = ${num(mh)}$: Bilde den Kehrwert von $${num(mg)}$ und dreh das Vorzeichen um.`,
            ),
          },
        ]
      : [{ math: `m#Lh _{h#Lhi}#Sh =#E m#Lg _{g#Lgi}#Sg =#E2 ${val(mg, "m")}`, note: tx(`Parallel lines have the **same slope**: $m_h = ${num(mg)}$.`, `Parallele Geraden haben die **gleiche Steigung**: $m_h = ${num(mg)}$.`) }];
    return {
      instruction: perp ? tx("Perpendicular line", "Orthogonale Gerade") : tx("Parallel line", "Parallele Gerade"),
      text: tx(
        `The line $g$ has the equation $${g}$. Find the line $h$ through $${pt(px, py, "P")}$ that is **${perp ? "perpendicular" : "parallel"}** to $g$.`,
        `Die Gerade $g$ hat die Gleichung $${g}$. Bestimme die Gerade $h$ durch $${pt(px, py, "P")}$, die **${perp ? "orthogonal" : "parallel"}** zu $g$ ist.`,
      ),
      visual,
      answer: { kind: "expr", value: linePlain(mh, bh), prefix: "y =", form: "expanded" },
      hint: perp
        ? tx(
            "Perpendicular: $m_g \\cdot m_h = -1$, so $m_h = -\\frac{1}{m_g}$. Then find $b$ with $P$.",
            "Orthogonal: $m_g \\cdot m_h = -1$, also $m_h = -\\frac{1}{m_g}$. Dann bestimmst du $b$ mit $P$.",
          )
        : tx("Parallel lines have the same slope. Then find $b$ with $P$.", "Parallele Geraden haben die gleiche Steigung. Dann bestimmst du $b$ mit $P$."),
      solution: [...lead, ...findBFrames(mh, [px, py], "P", SLOPE_FIRST)],
      mistakes: throughPointMistakes(mg, bg, [px, py], perp),
    };
  }
}

/**
 * Level 2 practice: the three difficulty tiers of the old one-lesson topic, mixed. Mostly the
 * standard tasks (slope, line through a point, point test, zero) and the harder ones (line
 * through two points, parallel and perpendicular, the equation of a graph), a few warm-ups.
 */
export function generate2(rng: Rng): Exercise {
  const r = rng.next();
  // Warm-ups: read m and b, work out a point
  if (r < 0.04) return readEquation(rng);
  if (r < 0.08) return graphTask(rng, false);
  if (r < 0.12) return whichGraph(rng);
  if (r < 0.15) return valueAt(rng);
  // Standard
  if (r < 0.27) return slopeTask(rng);
  if (r < 0.39) return slopePointTask(rng);
  if (r < 0.47) return pointTest(rng);
  if (r < 0.55) return missingX(rng);
  if (r < 0.64) return zeroTask(rng, false);
  // Harder
  if (r < 0.76) return twoPointsTask(rng);
  if (r < 0.82) return throughPointTask(rng, false);
  if (r < 0.89) return throughPointTask(rng, true);
  if (r < 0.94) return zeroTask(rng, true);
  return graphTask(rng, true);
}

// ---------------------------------------------------------------------------
// Widgets

const M_STEPS: Frac[] = [q(-3), q(-2), q(-3, 2), q(-1), q(-2, 3), q(-1, 2), q(-1, 3), q(0), q(1, 3), q(1, 2), q(2, 3), q(1), q(3, 2), q(2), q(3)];
export const TRI_FILL = "color-mix(in oklab, var(--blob) 15%, transparent)";

export function Caption({ children }: { children: ReactNode }) {
  return <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</span>;
}

export function Tag({ src, tone = "blob" }: { src: string; tone?: "blob" | "ink" }) {
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

function slopeSentence(m: Frac): Text {
  if (m.n === 0) return tx("Going right never changes $y$: the line is **horizontal**.", "Nach rechts ändert sich $y$ nie: Die Gerade verläuft **waagerecht**.");
  return m.n > 0
    ? tx(`Go $${m.d}$ to the right and $${m.n}$ up, and you're back on the line. It **rises**.`, `Geh $${m.d}$ nach rechts und $${m.n}$ nach oben, und du bist wieder auf der Geraden. Sie **steigt**.`)
    : tx(`Go $${m.d}$ to the right and $${-m.n}$ down, and you're back on the line. It **falls**.`, `Geh $${m.d}$ nach rechts und $${-m.n}$ nach unten, und du bist wieder auf der Geraden. Sie **fällt**.`);
}

const L_SLOPE = tx("Slope", "Steigung");
const L_INTERCEPT = tx("y-intercept", "y-Achsenabschnitt");

/** Sliders for m and b: the line turns and slides, the slope triangle follows. */
function SlopeSliders() {
  const t = useText();
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
          label={tx("A line with its slope triangle", "Eine Gerade mit ihrem Steigungsdreieck")}
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
          <PlaneLine through={() => [[0, bS.get()], [cos(angle.get()), sin(angle.get())]]} width={1.1} />
          <PlaneDot at={() => [0, bS.get()]} tone="ink" hollow r={1.3} pulse={b} />
        </Plane>
      </div>

      <div className="space-y-5">
        <div className="grid min-h-[84px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
          <MathView src={lineSrc(m, q(b))} size="lg" scope={`${scope}-eq`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>{t(L_SLOPE)}</Caption>
            <MathView src={`m = ${num(m)}`} size="sm" animate={false} className="text-blob-ink" />
          </div>
          <StepSlider value={mi} count={M_STEPS.length} onChange={setMi} zero={7} label={tx("Slope m", "Steigung m")} valueText={`m = ${qv(m).toFixed(2)}`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>{t(L_INTERCEPT)}</Caption>
            <MathView src={`b = ${b}`} size="sm" animate={false} />
          </div>
          <StepSlider value={b + 4} count={9} onChange={(i) => setB(i - 4)} zero={4} label={tx("y-intercept b", "y-Achsenabschnitt b")} valueText={`b = ${b}`} tone="ink" />
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

function Row({ label, children }: { label: Text; children: ReactNode }) {
  const t = useText();
  const de = useLocale() === "de";
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-1">
      {/* Wide enough for the longer German "y-Achsenabschnitt", so both rows line up. */}
      <span className={cn("shrink-0", de ? "w-[154px] whitespace-nowrap" : "w-[86px]")}>
        <Caption>{t(label)}</Caption>
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
          label={tx("Drag the points A and B", "Ziehe die Punkte A und B")}
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
          <PlaneHandle id="A" x={ax} y={ay} at={A} label={tx("Point A", "Punkt A")} hint={!touched} />
          <PlaneHandle id="B" x={bx} y={by} at={B} label={tx("Point B", "Punkt B")} hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-4">
        <div className="grid min-h-[84px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
          <MathView src={eq} size="lg" scope={`${scope}-eq`} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {m && b ? (
            <motion.div key="calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
              <Row label={L_SLOPE}>
                <MathView
                  src={`m = \\frac{\\Delta y}{\\Delta x} = \\frac{${dy}}{${dx}}${reduced ? ` = ${num(m)}` : ""}`}
                  size="md"
                  animate={false}
                />
              </Row>
              <Row label={L_INTERCEPT}>
                <MathView src={`b = ${num(A[1])} - ${num(m, true)} \\cdot ${num(A[0], true)} = ${num(b)}`} size="md" animate={false} />
              </Row>
              <p className="pt-1 text-[13.5px] leading-relaxed text-ink-2">
                <Inline
                  text={tx(
                    "$b$ comes from putting $A$ into $y = mx + b$: $y_A = m \\cdot x_A + b$, so $b = y_A - m \\cdot x_A$.",
                    "$b$ bekommst du, indem du $A$ in $y = mx + b$ einsetzt: $y_A = m \\cdot x_A + b$, also $b = y_A - m \\cdot x_A$.",
                  )}
                />
              </p>
            </motion.div>
          ) : (
            <motion.p key="vertical" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-danger/25 bg-danger/[0.05] px-4 py-3 text-[14px] leading-relaxed text-ink">
              <Inline
                text={tx(
                  `$\\Delta x = 0$ and you can't divide by $0$. This is the **vertical** line $x = ${A[0]}$: it has no slope and no equation of the form $y = mx + b$.`,
                  `$\\Delta x = 0$, und durch $0$ kann man nicht teilen. Das ist die Gerade $x = ${A[0]}$, **parallel zur $y$-Achse**: Sie hat keine Steigung und keine Gleichung der Form $y = mx + b$.`,
                )}
              />
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
  const t = useText();
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
  const dir = (a: number): Pt => [cos(a), sin(a)];
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
          label={tx("Line g and line h through the point P", "Gerade g und Gerade h durch den Punkt P")}
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
          <PlaneHandle id="P" x={px} y={py} at={P} tone="ink" label={tx("Point P", "Punkt P")} hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-4">
        <div className="flex w-fit rounded-lg border border-line p-0.5">
          {[false, true].map((on) => (
            <button key={String(on)} onClick={() => setPerp(on)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", perp === on ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {perp === on && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{on ? t(tx("Perpendicular", "Orthogonal")) : "Parallel"}</span>
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
            <Caption>{t(tx("Slope of g", "Steigung von g"))}</Caption>
            <MathView src={`m_g = ${num(mg)}`} size="sm" animate={false} className="text-blob-ink" />
          </div>
          <StepSlider value={mi} count={G_STEPS.length} onChange={setMi} zero={7} label={tx("Slope of g", "Steigung von g")} valueText={`m = ${qv(mg).toFixed(2)}`} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <Inline
            text={
              perp
                ? tx(
                    `Turn $g$: $h$ turns with it and always meets $g$ at a right angle. Rise and run swap places and the sign flips: $${num(mg)}$ turns into $${num(mh)}$.`,
                    `Dreh $g$: $h$ dreht sich mit und schneidet $g$ immer im rechten Winkel. Hoch und rechts tauschen die Plätze, und das Vorzeichen dreht sich um: Aus $${num(mg)}$ wird $${num(mh)}$.`,
                  )
                : tx(
                    "Same slope, same slope triangle: the lines never meet. Drag $P$ and $h$ moves along, always parallel.",
                    "Gleiche Steigung, gleiches Steigungsdreieck: Die Geraden schneiden sich nie. Zieh $P$, und $h$ wandert mit, immer parallel.",
                  )
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
  {
    math: "y#Y =#EQ m#cm x#vm +#sb b#cb",
    note: tx(
      "Every straight line (Gerade) has an equation like this. For each $x$ it tells you the $y$ that belongs to it.",
      "Jede Gerade hat so eine Gleichung. Sie sagt dir zu jedem $x$, welches $y$ dazugehört.",
    ),
  },
  {
    math: "y#Y =#EQ m#cm x#vm +#sb b#cb",
    highlight: ["cb"],
    note: tx(
      `$b$ is the **y-intercept** (y-Achsenabschnitt): the line crosses the $y$-axis at $${pt(0, "b")}$.`,
      `$b$ ist der **y-Achsenabschnitt**: Die Gerade schneidet die $y$-Achse bei $${pt(0, "b")}$.`,
    ),
  },
  {
    math: "y#Y =#EQ m#cm x#vm +#sb b#cb",
    highlight: ["cm"],
    note: tx(
      "$m$ is the **slope** (Steigung): how far the line goes up for every step to the right.",
      "$m$ ist die **Steigung**: Sie sagt, wie weit die Gerade pro Schritt nach rechts nach oben geht.",
    ),
  },
  {
    math: "y#Y =#EQ 2#cm x#vm +#sb 1#cb",
    highlight: ["cm", "cb"],
    note: tx(
      "Example: $y = 2x + 1$ has the slope $m = 2$ and the y-intercept $b = 1$.",
      "Beispiel: $y = 2x + 1$ hat die Steigung $m = 2$ und den y-Achsenabschnitt $b = 1$.",
    ),
  },
  { math: "y#Y =#EQ 2#cm \\cdot#dot 3#vm +#sb 1#cb", highlight: ["vm"], note: tx("Put in any $x$, say $x = 3$ ...", "Setz ein beliebiges $x$ ein, zum Beispiel $x = 3$ …") },
  { math: "y#Y =#EQ 7#cm", note: tx(`... and you get $y = 7$. So the point $${pt(3, 7)}$ lies on the line.`, `… und du erhältst $y = 7$. Der Punkt $${pt(3, 7)}$ liegt also auf der Geraden.`) },
];

const slopeTriangleFrames: Frame[] = [
  {
    math: "m#M =#E \\frac{\\Delta#D1 y#D2}{\\Delta#D3 x#D4}#fm",
    note: tx(
      "Slope = **rise over run**. $\\Delta y$ is how far you go up, $\\Delta x$ how far you go right. ($\\Delta$ means difference.)",
      "Steigung = **hoch durch rechts**. $\\Delta y$ ist, wie weit du nach oben gehst, $\\Delta x$, wie weit nach rechts. ($\\Delta$ heißt Differenz.)",
    ),
  },
  {
    math: "m#M =#E \\frac{6#cm}{3#dm}#fm",
    note: tx(`Example: from $${pt(1, 2)}$ to $${pt(4, 8)}$ you go $3$ right and $6$ up.`, `Beispiel: Von $${pt(1, 2)}$ nach $${pt(4, 8)}$ gehst du $3$ nach rechts und $6$ nach oben.`),
  },
  {
    math: "m#M =#E 2#cm",
    note: tx("$\\frac{6}{3} = 2$: for every step to the right the line goes $2$ up. It **rises**.", "$\\frac{6}{3} = 2$: Pro Schritt nach rechts geht die Gerade $2$ nach oben. Sie **steigt**."),
  },
  {
    math: "m#M =#E \\frac{-#sm 2#cm}{4#dm}#fm",
    note: tx(
      `Going **down** makes $\\Delta y$ negative. From $${pt(0, 3)}$ to $${pt(4, 1)}$: $4$ right, $2$ down.`,
      `Geht es **nach unten**, ist $\\Delta y$ negativ. Von $${pt(0, 3)}$ nach $${pt(4, 1)}$: $4$ nach rechts, $2$ nach unten.`,
    ),
  },
  { math: "m#M =#E -#sm \\frac{1#cm}{2#dm}#fm", note: tx("A negative slope: the line **falls** from left to right.", "Eine negative Steigung: Die Gerade **fällt** von links nach rechts.") },
  { math: "m#M =#E 0#cm", note: tx("And $\\Delta y = 0$ gives $m = 0$: a **horizontal** line, like $y = 3$.", "Und $\\Delta y = 0$ ergibt $m = 0$: eine **waagerechte** Gerade, wie $y = 3$.") },
];

const lessonTwoPoints = (() => {
  const { frames, m } = slopeFrames(
    [1, 3],
    [4, 9],
    tx(
      "Step 1, the slope: subtract the $y$-values, subtract the $x$-values, divide. Same order on top and bottom!",
      "Schritt 1, die Steigung: $y$-Werte subtrahieren, $x$-Werte subtrahieren, teilen. Oben und unten dieselbe Reihenfolge!",
    ),
  );
  return [...frames, ...findBFrames(m, [1, 3], "A", tx("Step 2, find $b$. So far we know $y = 2x + b$.", "Schritt 2, $b$ bestimmen. Bisher wissen wir: $y = 2x + b$."))];
})();

const lessonTest: Frame[] = [
  { math: lineSrc(q(2), q(-4)), note: tx(`Does $${pt(3, 2, "P")}$ lie on the line $y = 2x - 4$?`, `Liegt $${pt(3, 2, "P")}$ auf der Geraden $y = 2x - 4$?`) },
  { math: `2#L =#EQ 2#cm \\cdot#dot 3#vm -#sb 4#cb`, note: tx("**Point test** (Punktprobe): put in $x = 3$ and $y = 2$.", "**Punktprobe**: Setze $x = 3$ und $y = 2$ ein.") },
  {
    math: "\\green{2#L =#EQ 2#cm}",
    note: tx(
      "$6 - 4 = 2$. A true statement, so $P$ lies on the line. A false statement would mean it doesn't.",
      "$6 - 4 = 2$. Eine wahre Aussage, also liegt $P$ auf der Geraden. Bei einer falschen Aussage läge $P$ nicht darauf.",
    ),
  },
  ...solveFrames(
    ZERO,
    q(2),
    q(-4),
    tx(
      "The **zero** (Nullstelle) is where the line crosses the $x$-axis. There $y = 0$.",
      "Die **Nullstelle** ist die Stelle, an der die Gerade die $x$-Achse schneidet. Dort ist $y = 0$.",
    ),
    (X) => tx(`So $x = ${num(X)}$. The line crosses the $x$-axis at $${pt(X, 0, "N")}$.`, `Also ist $x = ${num(X)}$. Die Gerade schneidet die $x$-Achse in $${pt(X, 0, "N")}$.`),
  ),
];

/** Level 2 (Klasse 8): slope, y-intercept and the line through two points. */
export const level2: LevelLesson = {
  summary: [
    {
      title: tx("The line equation", "Die Geradengleichung"),
      body: tx(
        "$m$ is the slope (Steigung), $b$ the y-intercept (y-Achsenabschnitt): the line crosses the $y$-axis at $(0 | b)$.",
        "$m$ ist die Steigung, $b$ der y-Achsenabschnitt: Die Gerade schneidet die $y$-Achse bei $(0 | b)$.",
      ),
      examples: ["y = mx + b", "y = 2x - 3"],
      tone: "rule",
    },
    {
      title: tx("Slope triangle", "Steigungsdreieck"),
      body: tx(
        "Go $\\Delta x$ to the right and $\\Delta y$ up (negative: down). $m > 0$ rises, $m < 0$ falls, $m = 0$ is horizontal.",
        "Geh $\\Delta x$ nach rechts und $\\Delta y$ nach oben (negativ: nach unten). $m > 0$: steigend, $m < 0$: fallend, $m = 0$: waagerecht.",
      ),
      examples: ["m = \\frac{\\Delta y}{\\Delta x} = \\frac{y_2 - y_1}{x_2 - x_1}"],
      tone: "rule",
    },
    {
      title: tx("Line through two points", "Gerade durch zwei Punkte"),
      body: tx(
        "First $m$ with the slope formula. Then put one point into $y = mx + b$ and solve for $b$.",
        "Zuerst $m$ mit der Steigungsformel. Dann einen Punkt in $y = mx + b$ einsetzen und nach $b$ auflösen.",
      ),
      examples: [`A${pt(1, 3)} , B${pt(4, 9)}`, "m = \\frac{9 - 3}{4 - 1} = 2", "3 = 2 \\cdot 1 + b \\Rightarrow b = 1"],
      tone: "tip",
    },
    {
      title: tx("Point test and zero", "Punktprobe und Nullstelle"),
      body: tx(
        "Point test: put the point in and check for a true statement. Zero (Nullstelle): set $y = 0$ and solve.",
        "Punktprobe: Punkt einsetzen und prüfen, ob eine wahre Aussage herauskommt. Nullstelle: $y = 0$ setzen und nach $x$ auflösen.",
      ),
      examples: ["0 = 2x - 6 \\Rightarrow x = 3"],
      tone: "rule",
    },
    {
      title: tx("Parallel and perpendicular", "Parallel und orthogonal"),
      body: tx(
        "Parallel lines have the same slope. Perpendicular lines have slopes that multiply to $-1$.",
        "Parallele Geraden haben die gleiche Steigung. Bei orthogonalen (senkrechten) Geraden ist das Produkt der Steigungen $-1$.",
      ),
      examples: ["m_1 = m_2", "m_1 \\cdot m_2 = -1"],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Keep the same order on top and bottom of the slope formula. And $b$ is where the line meets the $y$-axis, not the $x$-axis.",
        "Nimm in der Steigungsformel oben und unten dieselbe Reihenfolge. Und $b$ liest du an der $y$-Achse ab, nicht an der $x$-Achse.",
      ),
      examples: [
        tx('\\frac{y_2 - y_1}{x_2 - x_1} \\quad \\green{"right"}', '\\frac{y_2 - y_1}{x_2 - x_1} \\quad \\green{"richtig"}'),
        tx('\\frac{y_2 - y_1}{x_1 - x_2} \\quad \\red{"wrong"}', '\\frac{y_2 - y_1}{x_1 - x_2} \\quad \\red{"falsch"}'),
      ],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The equation of a line", "Die Geradengleichung"),
      blob: tx("Straight lines are everywhere. Two numbers are all you need to describe one!", "Geraden sind überall. Du brauchst nur zwei Zahlen, um eine zu beschreiben!"),
      body: tx(
        "Every straight line that isn't vertical has an equation of the form $y = mx + b$.",
        "Jede Gerade, die nicht parallel zur $y$-Achse verläuft, hat eine Gleichung der Form $y = mx + b$.",
      ),
      frames: introFrames,
    },
    {
      type: "widget",
      title: tx("What m and b do", "Was m und b bewirken"),
      blob: tx("Move the sliders. Which one turns the line, which one slides it?", "Beweg die Regler. Welcher dreht die Gerade, welcher verschiebt sie?"),
      body: tx(
        "Change $m$ and $b$ and watch the line. The little triangle shows the slope: go right, then up or down, and you're back on the line.",
        "Ändere $m$ und $b$ und beobachte die Gerade. Das kleine Dreieck zeigt die Steigung: nach rechts, dann nach oben oder unten, und du bist wieder auf der Geraden.",
      ),
      widget: SlopeSliders,
    },
    {
      type: "explain",
      title: tx("The slope triangle", "Das Steigungsdreieck"),
      blob: tx("Rise over run. Say it with me!", "Hoch durch rechts. Sprich mir nach!"),
      body: tx(
        "Pick two points on a line. From one to the other you go $\\Delta x$ to the right and $\\Delta y$ up. The slope is the ratio of the two (Steigungsdreieck).",
        "Nimm zwei Punkte auf einer Geraden. Von einem zum anderen gehst du $\\Delta x$ nach rechts und $\\Delta y$ nach oben. Die Steigung ist der Quotient aus beiden.",
      ),
      frames: slopeTriangleFrames,
    },
    {
      type: "check",
      blob: tx("Your turn! Find b first, then walk the triangle.", "Du bist dran! Erst b ablesen, dann das Dreieck ablaufen."),
      exercise: {
        instruction: I_SLOPE_B,
        text: READ_GRAPH,
        visual: lineGraph(q(2, 3), q(-1), [
          [0, -1],
          [3, 1],
        ]),
        answer: { kind: "pair", names: ["m", "b"], values: [2 / 3, -1] },
        hint: tx(
          "The line crosses the $y$-axis at $-1$. From there go to the other marked point: how far right, how far up? You can type a fraction like 2/3.",
          "Die Gerade schneidet die $y$-Achse bei $-1$. Geh von dort zum anderen markierten Punkt: Wie weit nach rechts, wie weit nach oben? Du kannst einen Bruch wie 2/3 eintippen.",
        ),
        solution: readGraphFrames(q(2, 3), q(-1), [0, -1], [3, 1], "pair"),
        mistakes: graphPairMistakes(q(2, 3), q(-1)),
      },
    },
    {
      type: "widget",
      title: tx("Drag the points", "Zieh die Punkte"),
      blob: tx("Grab A or B and move them around. Everything follows!", "Schnapp dir A oder B und verschieb sie. Alles andere folgt!"),
      body: tx(
        "Two points fix a line. Drag $A$ and $B$: the slope triangle shows $\\Delta x$ and $\\Delta y$, and the equation updates as you go.",
        "Zwei Punkte legen eine Gerade fest. Zieh $A$ und $B$: Das Steigungsdreieck zeigt $\\Delta x$ und $\\Delta y$, und die Gleichung passt sich sofort an.",
      ),
      widget: PointsLab,
    },
    {
      type: "explain",
      title: tx("The line through two points", "Die Gerade durch zwei Punkte"),
      blob: tx("Two steps: first m, then b. That's the whole trick.", "Zwei Schritte: erst m, dann b. Das ist der ganze Trick."),
      body: tx(`For $A${pt(1, 3)}$ and $B${pt(4, 9)}$ we want the equation $y = mx + b$.`, `Für $A${pt(1, 3)}$ und $B${pt(4, 9)}$ suchen wir die Gleichung $y = mx + b$.`),
      frames: lessonTwoPoints,
    },
    {
      type: "check",
      blob: tx("Slope first, then b. You've got this!", "Erst die Steigung, dann b. Du schaffst das!"),
      exercise: {
        instruction: I_LINE,
        text: tx(
          `Find the equation of the line through $${pt(-1, 4, "A")}$ and $${pt(2, -2, "B")}$.`,
          `Bestimme die Gleichung der Geraden durch $${pt(-1, 4, "A")}$ und $${pt(2, -2, "B")}$.`,
        ),
        answer: { kind: "expr", value: "-2x+2", prefix: "y =", form: "expanded" },
        hint: tx("$m = \\frac{-2 - 4}{2 - (-1)}$. Then put $A$ into $y = mx + b$.", "$m = \\frac{-2 - 4}{2 - (-1)}$. Setze dann $A$ in $y = mx + b$ ein."),
        solution: (() => {
          const { frames, m } = slopeFrames([-1, 4], [2, -2], tx("First the slope.", "Zuerst die Steigung."));
          return [...frames, ...findBFrames(m, [-1, 4], "A", tx("Now $b$: so far $y = -2x + b$.", "Jetzt $b$: Bisher gilt $y = -2x + b$."))];
        })(),
        mistakes: twoPointsMistakes([-1, 4], [2, -2], 0),
      },
    },
    {
      type: "explain",
      title: tx("On the line? Where does it cross the x-axis?", "Punktprobe und Nullstelle"),
      blob: tx("Two quick checks you'll need all the time.", "Zwei schnelle Checks, die du ständig brauchst."),
      body: tx(
        "A point lies on a line when its coordinates make the equation true. The zero (Nullstelle) is the point where $y = 0$.",
        "Ein Punkt liegt auf einer Geraden, wenn seine Koordinaten die Gleichung erfüllen. Die Nullstelle ist die Stelle, an der $y = 0$ ist.",
      ),
      frames: lessonTest,
    },
    {
      type: "check",
      blob: tx("Set y to zero and solve!", "Setz y gleich null und löse!"),
      exercise: {
        instruction: I_ZERO,
        text: Q_ZERO,
        math: "y = -2x + 5",
        answer: { kind: "number", value: 2.5, label: "x =" },
        hint: tx("Solve $0 = -2x + 5$. A decimal like 2,5 is fine.", "Löse $0 = -2x + 5$. Eine Kommazahl wie 2,5 ist okay."),
        solution: [
          { math: lineSrc(q(-2), q(5)), highlight: ["Y"], note: tx("At the zero, $y = 0$.", "An der Nullstelle ist $y = 0$.") },
          ...solveFrames(ZERO, q(-2), q(5), "", (X) =>
            tx(
              `So $x = ${num(X)} = 2,5$. The line crosses the $x$-axis at $${pt("2,5", 0, "N")}$.`,
              `Also ist $x = ${num(X)} = 2,5$. Die Gerade schneidet die $x$-Achse in $${pt("2,5", 0, "N")}$.`,
            ),
          ),
        ],
        mistakes: zeroMistakes(q(-2), q(5)),
      },
    },
    {
      type: "widget",
      title: tx("Parallel and perpendicular", "Parallel und orthogonal"),
      blob: tx("Same slope means parallel. Watch what perpendicular does to the triangle!", "Gleiche Steigung heißt parallel. Schau, was orthogonal mit dem Dreieck macht!"),
      body: tx(
        "Parallel lines have the **same slope**. Perpendicular lines meet at a right angle; their slopes multiply to $-1$, so $m_h = -\\frac{1}{m_g}$.",
        "Parallele Geraden haben die **gleiche Steigung**. Orthogonale (senkrechte) Geraden schneiden sich im rechten Winkel. Das Produkt ihrer Steigungen ist $-1$, also $m_h = -\\frac{1}{m_g}$.",
      ),
      widget: ParallelLab,
    },
    {
      type: "check",
      blob: tx("Last one! Same slope, new point.", "Die letzte! Gleiche Steigung, neuer Punkt."),
      exercise: {
        instruction: tx("Parallel line", "Parallele Gerade"),
        text: tx(
          `The line $g$ has the equation $y = -\\frac{1}{2}x + 4$. Find the line $h$ through $${pt(4, 1, "P")}$ that is **parallel** to $g$.`,
          `Die Gerade $g$ hat die Gleichung $y = -\\frac{1}{2}x + 4$. Bestimme die Gerade $h$ durch $${pt(4, 1, "P")}$, die **parallel** zu $g$ ist.`,
        ),
        visual: graphVisual({
          xRange: [-6, 6],
          yRange: [-6, 6],
          functions: [{ f: lineFn(q(-1, 2), q(4)), key: "g", color: "blob", label: "g" }],
          points: [{ x: 4, y: 1, key: "P", color: "ink", label: "P" }],
        }),
        answer: { kind: "expr", value: "-(x/2)+3", prefix: "y =", form: "expanded" },
        hint: tx(
          "Parallel means the same slope: $m = -\\frac{1}{2}$. Then put $P$ into $y = -\\frac{1}{2}x + b$.",
          "Parallel heißt gleiche Steigung: $m = -\\frac{1}{2}$. Setze dann $P$ in $y = -\\frac{1}{2}x + b$ ein.",
        ),
        solution: [
          {
            math: `m#Lh _{h#Lhi}#Sh =#E m#Lg _{g#Lgi}#Sg =#E2 ${val(q(-1, 2), "m")}`,
            note: tx("Parallel lines have the **same slope**: $m_h = -\\frac{1}{2}$.", "Parallele Geraden haben die **gleiche Steigung**: $m_h = -\\frac{1}{2}$."),
          },
          ...findBFrames(q(-1, 2), [4, 1], "P", SLOPE_FIRST),
        ],
        mistakes: throughPointMistakes(q(-1, 2), q(4), [4, 1], false),
      },
    },
  ],
};
