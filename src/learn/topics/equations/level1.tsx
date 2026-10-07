"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, RotateCcw, Shuffle, Undo2 } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { div as qdiv, frac, value as qvalue } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";
import {
  coef,
  eqMistakes,
  eqSrc,
  equation,
  evalSide,
  expandAll,
  group,
  inner,
  isZero,
  make,
  prod,
  qsub,
  solveEq,
  substSide,
  term,
  VARS,
  type Eq,
  type Item,
  type Rel,
} from "./model";
import { StepsBoard } from "./ui";

// rearranging/level2.tsx uses these two helpers from here.
export { emWidth, smoothFracExits } from "./model";

// ---------------------------------------------------------------------------
// Level 1 (Klasse 7): the balance, two-step equations, x on both sides, brackets,
// and inequalities with the sign flip for a negative factor.

const signed = (b: number) => (b < 0 ? `- ${-b}` : `+ ${b}`);
const RELS: Exclude<Rel, "=">[] = ["<", ">", "≤", "≥"];

function tier1(rng: Rng): Exercise | null {
  const v = rng.pick(VARS);
  const shape = rng.pick(["plus", "times", "two", "two", "two", "turned", "frac", "minus"] as const);
  if (shape === "plus") {
    const x = rng.nonZero(-8, 15);
    const b = rng.nonZero(-15, 15, [-x]);
    const L = rng.chance(0.3) ? [term("B", b), term("A", 1, 1)] : [term("A", 1, 1), term("B", b)];
    return make(
      equation(L, "=", [term("C", x + b)]),
      v,
      tx(
        `Undo the $${signed(b)}$: ${b > 0 ? "subtract" : "add"} $${Math.abs(b)}$ on both sides.`,
        `Weg mit dem $${signed(b)}$: ${b > 0 ? "Subtrahiere" : "Addiere"} $${Math.abs(b)}$ auf beiden Seiten.`,
      ),
      true,
    );
  }
  if (shape === "times") {
    const a = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, -2, -3, -4, -5]);
    const x = rng.nonZero(-9, 12, [1]);
    return make(
      equation([term("A", a, 1)], "=", [term("C", a * x)]),
      v,
      tx(`$${a}${v}$ means $${a} \\cdot ${v}$. Divide both sides by $${a}$.`, `$${a}${v}$ bedeutet $${a} \\cdot ${v}$. Teile beide Seiten durch $${a}$.`),
      true,
    );
  }
  if (shape === "frac") {
    const a = rng.int(2, 6);
    const c = rng.nonZero(-6, 9);
    return make(
      equation([term("A", frac(1, a), 1)], "=", [term("C", c)]),
      v,
      tx(`$${v}$ is divided by $${a}$. Do the opposite on both sides.`, `$${v}$ wird durch $${a}$ geteilt. Wende auf beiden Seiten die Umkehrrechnung an.`),
      true,
    );
  }
  if (shape === "minus") {
    const a = rng.int(2, 6);
    const x = rng.nonZero(-4, 9);
    const b = rng.int(5, 30);
    if (b - a * x === 0) return null;
    return make(
      equation([term("B", b), term("A", -a, 1)], "=", [term("C", b - a * x)]),
      v,
      tx(`First subtract $${b}$ on both sides. Then divide by $-${a}$, minus included.`, `Subtrahiere zuerst $${b}$ auf beiden Seiten. Teile dann durch $-${a}$, samt Minuszeichen.`),
      true,
    );
  }
  const a = rng.int(2, 9);
  const x = rng.nonZero(-6, 10);
  const b = rng.nonZero(-15, 15);
  const c = a * x + b;
  if (c === 0 || Math.abs(c) > 90) return null;
  const hint = tx(`First get rid of the $${signed(b)}$, then divide by $${a}$.`, `Erst muss das $${signed(b)}$ weg, dann teilst du durch $${a}$.`);
  const lhs = rng.chance(0.25) ? [term("B", b), term("A", a, 1)] : [term("A", a, 1), term("B", b)];
  if (shape === "turned") return make(equation([term("C", c)], "=", lhs), v, hint, true);
  return make(equation(lhs, "=", [term("C", c)]), v, hint, true);
}

function tier2(rng: Rng): Exercise | null {
  const v = rng.pick(VARS);
  const shape = rng.pick(["both", "both", "bracket", "bracketBoth", "tidy", "ineq", "ineq"] as const);
  if (shape === "both") {
    const a = rng.int(2, 9);
    const c = rng.chance(0.2) ? -rng.int(1, 4) : rng.int(1, 8);
    const x = rng.nonZero(-6, 9);
    const b = rng.nonZero(-12, 12);
    const d = (a - c) * x + b;
    if (a === c || d === 0 || d === b || Math.abs(d) > 40) return null;
    const R = rng.chance(0.3) ? [term("D", d), term("C", c, 1)] : [term("C", c, 1), term("D", d)];
    const L = rng.chance(0.2) ? [term("B", b), term("A", a, 1)] : [term("A", a, 1), term("B", b)];
    return make(
      equation(L, "=", R),
      v,
      tx(`Collect the $${v}$-terms on one side and the numbers on the other.`, `Bring die $${v}$-Terme auf eine Seite und die Zahlen auf die andere.`),
      true,
    );
  }
  if (shape === "bracket" || shape === "bracketBoth") {
    const k = rng.chance(0.2) ? -rng.int(2, 3) : rng.int(2, 6);
    const q = shape === "bracket" && rng.chance(0.3) ? rng.int(2, 3) : 1;
    const p = rng.nonZero(-9, 9);
    const x = rng.nonZero(-6, 9);
    const g = group("G", k, [inner(q, 1), inner(p)]);
    if (shape === "bracket") {
      const extra = rng.chance(0.3) ? rng.nonZero(-9, 9) : 0;
      const c = k * (q * x + p) + extra;
      if (c === 0 || Math.abs(c) > 80) return null;
      const L = extra ? [g, term("E", extra)] : [g];
      return make(
        equation(L, "=", [term("C", c)]),
        v,
        tx(`Expand the bracket first: multiply $${k}$ by both terms inside.`, `Löse zuerst die Klammer auf: Multipliziere beide Terme darin mit $${k}$.`),
        true,
      );
    }
    const c = rng.int(1, 6);
    const d = k * (x + p) - c * x;
    if (c === k || d === 0 || Math.abs(d) > 40) return null;
    return make(
      equation([g], "=", [term("C", c, 1), term("D", d)]),
      v,
      tx(`Expand the bracket, then bring the $${v}$-terms together.`, `Löse die Klammer auf, dann bring die $${v}$-Terme auf eine Seite.`),
      true,
    );
  }
  if (shape === "tidy") {
    const a = rng.int(2, 7);
    const c = rng.nonZero(-4, 5);
    const s = a + c;
    const x = rng.nonZero(-6, 9);
    const b = rng.nonZero(-10, 10);
    const d = s * x + b;
    if (s === 0 || d === 0 || Math.abs(d) > 60) return null;
    return make(
      equation([term("A", a, 1), term("B", b), term("C", c, 1)], "=", [term("D", d)]),
      v,
      tx(`First combine the two $${v}$-terms on the left.`, `Fasse zuerst die beiden $${v}$-Terme links zusammen.`),
      true,
    );
  }
  // inequality, positive coefficient
  const rel = rng.pick(RELS);
  const x0 = rng.int(-6, 9);
  const a = rng.int(2, 8);
  const b = rng.nonZero(-12, 12);
  if (rng.chance(0.5)) {
    const c = a * x0 + b;
    return make(
      equation([term("A", a, 1), term("B", b)], rel, [term("C", c)]),
      v,
      tx(
        "Solve it like an equation. You only divide by a positive number, so the sign stays.",
        "Löse sie wie eine Gleichung. Du teilst nur durch eine positive Zahl, also bleibt das Relationszeichen, wie es ist.",
      ),
    );
  }
  const c = rng.int(1, a - 1);
  const d = (a - c) * x0 + b;
  if (d === b) return null;
  return make(
    equation([term("A", a, 1), term("B", b)], rel, [term("C", c, 1), term("D", d)]),
    v,
    tx(`Collect the $${v}$-terms on the left, the numbers on the right. Then divide.`, `Bring die $${v}$-Terme nach links und die Zahlen nach rechts. Dann teilst du.`),
  );
}

const TIER3_SHAPES = ["frac", "fracTwo", "ineqNeg", "ineqNeg", "ineqBracket", "twoBrackets", "minusBracket", "product"] as const;
export type Tier3Shape = (typeof TIER3_SHAPES)[number];

export function tier3(rng: Rng, only?: readonly Tier3Shape[]): Exercise | null {
  const v = rng.pick(VARS);
  const shape = rng.pick(only ?? TIER3_SHAPES);
  if (shape === "frac") {
    const [p, q] = rng.pick([[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [3, 4], [2, 5], [3, 5]] as const);
    const m = rng.nonZero(-4, 6);
    const b = rng.nonZero(-10, 10);
    const c = p * m + b;
    if (c === 0) return null;
    return make(
      equation([term("A", frac(p, q), 1), term("B", b)], "=", [term("C", c)]),
      v,
      tx("Get the fraction on its own first. Then multiply by the denominator.", "Bring zuerst den Bruch allein auf eine Seite. Multipliziere dann mit dem Nenner."),
    );
  }
  if (shape === "fracTwo") {
    const [a, b] = rng.pick([[2, 3], [2, 5], [3, 4], [3, 5], [4, 6], [2, 4], [2, 6]] as const);
    const l = lcm(a, b);
    const x = l * rng.nonZero(-3, 4);
    if (rng.chance(0.4)) {
      // x/a + k = x/b
      const k = x / b - x / a;
      if (k === 0) return null;
      return make(
        equation([term("A", frac(1, a), 1), term("B", k)], "=", [term("C", frac(1, b), 1)]),
        v,
        tx(`Multiply every term by $${l}$ first. That clears both fractions.`, `Multipliziere zuerst jeden Term mit $${l}$. Dann sind beide Brüche weg.`),
      );
    }
    const s = rng.sign();
    const c = x / a + (s * x) / b;
    if (c === 0) return null;
    return make(
      equation([term("A", frac(1, a), 1), term("B", frac(s, b), 1)], "=", [term("C", c)]),
      v,
      tx(`Multiply every term by $${l}$, the common denominator.`, `Multipliziere jeden Term mit $${l}$, dem Hauptnenner.`),
    );
  }
  if (shape === "ineqNeg") {
    const rel = rng.pick(RELS);
    const x0 = rng.int(-5, 8);
    if (rng.chance(0.5)) {
      const a = rng.int(2, 6);
      const b = rng.int(1, 20);
      return make(
        equation([term("B", b), term("A", -a, 1)], rel, [term("C", b - a * x0)]),
        v,
        tx(
          `Subtract $${b}$ first. Then you divide by $-${a}$: that flips the sign.`,
          `Subtrahiere zuerst $${b}$. Dann teilst du durch $-${a}$: Dabei dreht sich das Relationszeichen um.`,
        ),
      );
    }
    const a = rng.int(1, 5);
    const c = a + rng.int(1, 5);
    const b = rng.nonZero(-10, 10);
    const d = (a - c) * x0 + b;
    if (d === b) return null;
    return make(
      equation([term("A", a, 1), term("B", b)], rel, [term("C", c, 1), term("D", d)]),
      v,
      tx(
        `Bring the $${v}$-terms to the left. You'll end up dividing by a negative number, so flip the sign.`,
        `Bring die $${v}$-Terme nach links. Am Ende teilst du durch eine negative Zahl, also dreh das Relationszeichen um.`,
      ),
    );
  }
  if (shape === "ineqBracket") {
    const rel = rng.pick(RELS);
    const x0 = rng.int(-5, 6);
    const p = rng.nonZero(-6, 6);
    if (rng.chance(0.5)) {
      const k = rng.int(2, 4);
      const c = k + rng.int(1, 4);
      const d = k * (x0 + p) - c * x0;
      if (d === 0) return null;
      return make(
        equation([group("G", k, [inner(1, 1), inner(p)])], rel, [term("C", c, 1), term("D", d)]),
        v,
        tx(
          `Expand first, then collect the $${v}$-terms on the left. Watch for a negative factor at the end.`,
          `Löse zuerst die Klammer auf, dann bring die $${v}$-Terme nach links. Achte am Ende auf einen negativen Faktor.`,
        ),
      );
    }
    const k = -rng.int(2, 5);
    const d = k * (x0 + p);
    if (d === 0) return null;
    return make(
      equation([group("G", k, [inner(1, 1), inner(p)])], rel, [term("D", d)]),
      v,
      tx(`Expand: $${k}$ times each term. In the end you divide by a negative number.`, `Klammer auflösen: $${k}$ mal jeden Term. Am Ende teilst du durch eine negative Zahl.`),
    );
  }
  if (shape === "twoBrackets") {
    const k = rng.int(2, 6);
    const m = rng.int(1, 5);
    if (k === m) return null;
    const p = rng.nonZero(-7, 7);
    const q = rng.nonZero(-7, 7);
    const x = rng.nonZero(-6, 8);
    const G = group("G", k, [inner(1, 1), inner(p)]);
    if (rng.chance(0.5)) {
      const c = k * (x + p) - m * (x + q);
      if (c === 0 || Math.abs(c) > 60) return null;
      return make(
        equation([G, group("H", -m, [inner(1, 1), inner(q)])], "=", [term("C", c)]),
        v,
        tx("Expand both brackets. The minus in front of the second one flips its signs.", "Löse beide Klammern auf. Das Minus vor der zweiten dreht die Vorzeichen darin um."),
      );
    }
    const c = k * (x + p) - m * (x + q);
    if (c === 0 || Math.abs(c) > 40) return null;
    return make(
      equation([G], "=", [group("H", m, [inner(1, 1), inner(q)]), term("C", c)]),
      v,
      tx("Expand both brackets, then solve as usual.", "Löse beide Klammern auf, dann rechne wie gewohnt weiter."),
    );
  }
  if (shape === "minusBracket") {
    const a = rng.int(3, 9);
    const bb = rng.int(1, a - 1);
    const c = rng.nonZero(-9, 9);
    const x = rng.nonZero(-6, 8);
    const d = (a - bb) * x + c;
    if (d === 0 || Math.abs(d) > 60) return null;
    return make(
      equation([term("A", a, 1), group("G", -1, [inner(bb, 1), inner(-c)])], "=", [term("D", d)]),
      v,
      tx("A minus in front of the bracket flips every sign inside.", "Ein Minus vor der Klammer dreht jedes Vorzeichen darin um."),
    );
  }
  // product: (x + p)(x + q) = x² + r, or (x + p)² = x² + r
  const p = rng.nonZero(-6, 6);
  const x = rng.nonZero(-6, 8);
  if (rng.chance(0.5)) {
    const q = rng.nonZero(-6, 6);
    if (p + q === 0) return null;
    const r = (p + q) * x + p * q;
    if (r === 0 || Math.abs(r) > 60) return null;
    return make(
      equation([prod("P", [inner(1, 1), inner(p)], [inner(1, 1), inner(q)])], "=", [term("A", 1, 2), term("C", r)]),
      v,
      tx(`Multiply out the brackets. The $${v}^2$ cancels, then it's a normal equation.`, `Multipliziere die Klammern aus. Das $${v}^2$ fällt weg, dann ist es eine ganz normale Gleichung.`),
    );
  }
  const r = 2 * p * x + p * p;
  if (r === 0 || Math.abs(r) > 80) return null;
  return make(
    equation([prod("P", [inner(1, 1), inner(p)], [], { square: true })], "=", [term("A", 1, 2), term("C", r)]),
    v,
    tx(`Use $(a + b)^2 = a^2 + 2ab + b^2$. The $${v}^2$ cancels.`, `Nutze die binomische Formel $(a + b)^2 = a^2 + 2ab + b^2$. Das $${v}^2$ fällt weg.`),
  );
}

/** One task from the old difficulty tiers (1 basics, 2 standard, 3 challenge), friendly numbers only. */
export function tierTask(tier: 1 | 2 | 3, rng: Rng, only?: readonly Tier3Shape[]): Exercise {
  for (let tries = 0; tries < 40; tries++) {
    const ex = tier === 1 ? tier1(rng) : tier === 2 ? tier2(rng) : tier3(rng, only);
    if (!ex) continue;
    const a = ex.answer;
    const value = a.kind === "solutions" ? a.values[0] : a.kind === "inequality" ? a.value : 0;
    // Friendly numbers only, and no lonely 0 as the answer to an equation.
    if (Math.abs(value) > 30 || (a.kind === "solutions" && value === 0)) continue;
    return ex;
  }
  return make(equation([term("A", 2, 1), term("B", 3)], "=", [term("C", 11)]), "x", tx("First subtract $3$, then divide by $2$.", "Subtrahiere zuerst $3$, dann teile durch $2$."), true);
}

// ---------------------------------------------------------------------------
// More task shapes for level 1: find the mistake in a worked solution, number
// puzzles (set up the equation yourself), and the check by substituting.

/** "3x", "x", "-x", "-2x" */
const xTerm = (n: number) => (n === 1 ? "x" : n === -1 ? "-x" : `${n}x`);
/** "3x + 5", "3x - 5", "3x" */
const lin = (a: number, b: number) => `${xTerm(a)}${b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`}`;
const LINE = (n: number) => `"(${n})"`;
/** The step after the bar: "| −2x", "| +5", "| :3". */
const barX = (c: number) => ` \\quad | \\, -${c === 1 ? "" : c}x`;
const barN = (b: number) => ` \\quad | \\, ${b > 0 ? "-" : "+"}${Math.abs(b)}`;
const barDiv = (k: number) => ` \\quad | \\, :${k < 0 ? `(${k})` : k}`;

/** A worked solution of ax + b = cx + d with one wrong line (or none): which line is wrong? */
function findMistake(rng: Rng): Exercise | null {
  const c = rng.int(1, 5);
  const A = rng.int(2, 5);
  const a = c + A;
  const x0 = rng.nonZero(-5, 9);
  const b = rng.nonZero(-12, 12);
  const d = A * x0 + b;
  if (d === 0 || d === b || Math.abs(d) > 60) return null;
  const err = rng.pick([2, 3, 4, 0] as const);
  // What the lines say, mistakes carried along.
  const k2 = err === 2 ? a + c : A;
  const r3 = err === 3 ? d + b : d - b;
  const x4 = err === 4 ? r3 - k2 : r3 / k2;
  if (!Number.isInteger(x4) || (err !== 0 && x4 === x0) || Math.abs(x4) > 40 || r3 === 0) return null;
  const lines = [`${lin(a, b)} = ${lin(c, d)}${barX(c)}`, `${lin(k2, b)} = ${d}${barN(b)}`, `${xTerm(k2)} = ${r3}${barDiv(k2)}`, `x = ${x4}`];
  const right = [lines[0], `${lin(A, b)} = ${d}${barN(b)}`, `${xTerm(A)} = ${d - b}${barDiv(A)}`, `x = ${x0}`];
  const board = (list: string[], mark: (i: number) => string | null) =>
    list.map((l, i) => `${LINE(i + 1)} \\; ${mark(i) ? `\\${mark(i)}{${l}}` : l}`).join(" \\\\ ");
  /** Why a line is right (maths only, the same in both languages). */
  const why: Record<2 | 3 | 4, string> = {
    2: `$${xTerm(a)} - ${xTerm(c)} = ${xTerm(A)}$`,
    3: `$${d} ${b > 0 ? "-" : "+"} ${Math.abs(b)} = ${d - b}$`,
    4: `$${d - b} : ${A} = ${x0}$`,
  };
  const errNote: Record<2 | 3 | 4, Text> = {
    2: tx(
      `Line (2) is wrong: $${xTerm(a)} - ${xTerm(c)} = ${xTerm(A)}$, not $${xTerm(a + c)}$. Taking away $${xTerm(c)}$ makes the left side smaller.`,
      `Zeile (2) ist falsch: $${xTerm(a)} - ${xTerm(c)} = ${xTerm(A)}$, nicht $${xTerm(a + c)}$. Wer $${xTerm(c)}$ wegnimmt, macht die linke Seite kleiner.`,
    ),
    3: tx(
      `Line (3) is wrong: the $${b > 0 ? "+" : "-"}${Math.abs(b)}$ goes away with $${b > 0 ? "-" : "+"}${Math.abs(b)}$ on **both** sides, so the right side is $${d} ${b > 0 ? "-" : "+"} ${Math.abs(b)} = ${d - b}$.`,
      `Zeile (3) ist falsch: Das $${b > 0 ? "+" : "-"}${Math.abs(b)}$ verschwindet mit $${b > 0 ? "-" : "+"}${Math.abs(b)}$ auf **beiden** Seiten, rechts steht also $${d} ${b > 0 ? "-" : "+"} ${Math.abs(b)} = ${d - b}$.`,
    ),
    4: tx(
      `Line (4) is wrong: $${xTerm(A)} = ${d - b}$ means $${A} \\cdot x = ${d - b}$. You undo a multiplication by **dividing**: $${d - b} : ${A} = ${x0}$.`,
      `Zeile (4) ist falsch: $${xTerm(A)} = ${d - b}$ heißt $${A} \\cdot x = ${d - b}$. Ein Mal machst du mit **Teilen** rückgängig: $${d - b} : ${A} = ${x0}$.`,
    ),
  };
  const lhs = a * x0 + b;
  const solution: Frame[] =
    err === 0
      ? [
          { math: board(lines, () => "green"), note: tx(`Every line checks out: ${why[2]}, ${why[3]} and ${why[4]}.`, `Jede Zeile stimmt: ${why[2]}, ${why[3]} und ${why[4]}.`) },
          {
            math: `${a} \\cdot ${x0 < 0 ? `(${x0})` : x0} ${b > 0 ? "+" : "-"} ${Math.abs(b)} = ${lhs} = ${c === 1 ? "" : `${c} \\cdot `}${x0 < 0 ? `(${x0})` : x0} ${d > 0 ? "+" : "-"} ${Math.abs(d)}`,
            note: tx(`Check: $x = ${x0}$ gives $${lhs}$ on both sides. No mistake!`, `Probe: Mit $x = ${x0}$ ergeben beide Seiten $${lhs}$. Kein Fehler!`),
          },
        ]
      : [
          { math: board(lines, (i) => (i + 1 === err ? "red" : null)), note: errNote[err] },
          { math: board(right, (i) => (i + 1 >= err ? "green" : null)), note: tx(`Corrected from line (${err}) on: so $x = ${x0}$.`, `Ab Zeile (${err}) verbessert: Also ist $x = ${x0}$.`) },
        ];
  const options = [tx("Line (2)", "Zeile (2)"), tx("Line (3)", "Zeile (3)"), tx("Line (4)", "Zeile (4)"), tx("There is no mistake", "Es gibt keinen Fehler")];
  const correct = err === 0 ? 3 : err - 2;
  const mistakes: Mistake[] = [];
  for (let i = 0; i < 4; i++) {
    if (i === correct) continue;
    const when: AnswerSpec = { kind: "choice", options, correct: i };
    if (i === 3) {
      const l = a * x4 + b;
      const r = c * x4 + d;
      mistakes.push({
        when,
        title: tx("The check fails", "Die Probe geht nicht auf"),
        say: tx(
          `Do the check: put $x = ${x4}$ into line (1). The left side gives $${l}$, the right side $${r}$. Not equal, so a line has a slip. Go through them one by one.`,
          `Mach die Probe: Setz $x = ${x4}$ in Zeile (1) ein. Links kommt $${l}$ heraus, rechts $${r}$. Nicht gleich, also steckt irgendwo ein Fehler. Geh die Zeilen einzeln durch.`,
        ),
      });
    } else if (err === 0 || i + 2 < err) {
      const j = (i + 2) as 2 | 3 | 4;
      mistakes.push({
        when,
        title: tx("That line is right", "Diese Zeile stimmt"),
        say: tx(
          `Line (${j}) is fine: ${why[j]}.${err === 0 ? " Try the check with the result." : " The slip comes later."}`,
          `Zeile (${j}) passt: ${why[j]}.${err === 0 ? " Mach mal die Probe mit dem Ergebnis." : " Der Fehler kommt erst später."}`,
        ),
      });
    } else {
      mistakes.push({
        when,
        title: tx("The slip is earlier", "Der Fehler liegt weiter oben"),
        say: tx(
          `Line (${i + 2}) follows correctly from the line above it. But that line already carries a mistake. Look further up!`,
          `Zeile (${i + 2}) folgt richtig aus der Zeile darüber. Aber dort steckt schon ein Fehler. Schau weiter oben!`,
        ),
        close: true,
      });
    }
  }
  const rows = [
    { left: lin(a, b), right: lin(c, d), op: `-${c === 1 ? "" : c}x` },
    { left: lin(k2, b), right: String(d), op: `${b > 0 ? "-" : "+"}${Math.abs(b)}` },
    { left: xTerm(k2), right: String(r3), op: `:${k2}` },
    { left: "x", right: String(x4) },
  ];
  return {
    instruction: tx("Find the first line with a mistake", "In welcher Zeile steckt der erste Fehler?"),
    visual: { component: StepsBoard as ComponentType<Record<string, unknown>>, props: { rows } },
    answer: { kind: "choice", options, correct },
    hint: tx("Check each line against the one above it: is the step after the bar done correctly on both sides?", "Vergleich jede Zeile mit der darüber: Ist der Schritt hinter dem Strich auf beiden Seiten richtig ausgeführt?"),
    solution,
    mistakes,
  };
}

/** Multiples in words: "three times" / "das Dreifache" (and "dem Dreifachen"). */
const TIMES: Record<number, { en: string; nom: string; dat: string; verb: string; verbEn: string }> = {
  2: { en: "twice", nom: "das Doppelte", dat: "dem Doppelten", verb: "verdopple", verbEn: "double the result" },
  3: { en: "three times", nom: "das Dreifache", dat: "dem Dreifachen", verb: "verdreifache", verbEn: "triple the result" },
  4: { en: "four times", nom: "das Vierfache", dat: "dem Vierfachen", verb: "vervierfache", verbEn: "multiply the result by 4" },
  5: { en: "five times", nom: "das Fünffache", dat: "dem Fünffachen", verb: "verfünffache", verbEn: "multiply the result by 5" },
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** I think of a number…: the student sets up the equation and solves it. */
function puzzle(rng: Rng): Exercise | null {
  const kind = rng.pick(["times", "times", "bracket", "more", "both"] as const);
  const x0 = rng.int(2, 15);
  let e: Eq;
  let text: Text;
  let setUp: Text;
  const extra: Mistake[] = [];
  const wrong = (eq: Eq) => {
    const L = expandAll(eq.L);
    const R = expandAll(eq.R);
    const A = qsub(coef(L, 1), coef(R, 1));
    return isZero(A) ? null : qvalue(qdiv(qsub(coef(R, 0), coef(L, 0)), A));
  };
  if (kind === "times") {
    const a = rng.int(2, 9);
    const b = rng.nonZero(-20, 25);
    const c = a * x0 + b;
    if (c <= 0) return null;
    e = equation([term("A", a, 1), term("B", b)], "=", [term("C", c)]);
    text =
      b > 0
        ? tx(`I think of a number. I multiply it by ${a} and then add ${b}. The result is ${c}. What is my number?`, `Ich denke mir eine Zahl. Ich multipliziere sie mit ${a} und addiere dann ${b}. Das Ergebnis ist ${c}. Wie heißt meine Zahl?`)
        : tx(`I think of a number. I multiply it by ${a} and then subtract ${-b}. The result is ${c}. What is my number?`, `Ich denke mir eine Zahl. Ich multipliziere sie mit ${a} und subtrahiere dann ${-b}. Das Ergebnis ist ${c}. Wie heißt meine Zahl?`);
    setUp = tx(`My number is $x$. Times $${a}$ gives $${a}x$, then ${b > 0 ? "plus" : "minus"} $${Math.abs(b)}$: $${lin(a, b)} = ${c}$.`, `Meine Zahl ist $x$. Mal $${a}$ ergibt $${a}x$, dann ${b > 0 ? "plus" : "minus"} $${Math.abs(b)}$: $${lin(a, b)} = ${c}$.`);
  } else if (kind === "bracket") {
    const k = rng.int(2, 4);
    const p = rng.int(2, 12);
    const c = k * (x0 + p);
    e = equation([group("G", k, [inner(1, 1), inner(p)])], "=", [term("C", c)]);
    const w = TIMES[k];
    text = tx(
      `I add ${p} to my number and then ${w.verbEn}. I get ${c}. What is my number?`,
      `Ich addiere ${p} zu meiner Zahl und ${w.verb} dann das Ergebnis. Ich erhalte ${c}. Wie heißt meine Zahl?`,
    );
    setUp = tx(
      `First $x + ${p}$, then the **whole** result times $${k}$. That needs a bracket: $${k}(x + ${p}) = ${c}$.`,
      `Zuerst $x + ${p}$, dann das **ganze** Ergebnis mal $${k}$. Dafür brauchst du eine Klammer: $${k}(x + ${p}) = ${c}$.`,
    );
    const v = wrong(equation([term("A", k, 1), term("B", p)], "=", [term("C", c)]));
    if (v !== null && v !== x0)
      extra.push({
        when: { kind: "solutions", variable: "x", values: [v] },
        title: tx("Bracket forgotten", "Klammer vergessen"),
        say: tx(
          `Careful with the order! First you add $${p}$, then the **whole** result is multiplied: $${k}(x + ${p})$. Without the bracket only the $x$ gets multiplied.`,
          `Achtung, Reihenfolge! Zuerst addierst du $${p}$, dann wird das **ganze** Ergebnis multipliziert: $${k}(x + ${p})$. Ohne Klammer würde nur das $x$ multipliziert.`,
        ),
      });
  } else if (kind === "more") {
    const k = rng.int(3, 5);
    const b = (k - 1) * x0;
    e = equation([term("A", k, 1)], "=", [term("C", 1, 1), term("D", b)]);
    const w = TIMES[k];
    text = tx(`${cap(w.en)} a number is ${b} more than the number itself. What is the number?`, `${cap(w.nom)} einer Zahl ist um ${b} größer als die Zahl selbst. Wie heißt die Zahl?`);
    setUp = tx(
      `${cap(w.en)} the number is $${k}x$. "${b} more than the number" is $x + ${b}$. So $${k}x = x + ${b}$.`,
      `${cap(w.nom)} der Zahl ist $${k}x$. „Um ${b} größer als die Zahl“ ist $x + ${b}$. Also $${k}x = x + ${b}$.`,
    );
    const v = wrong(equation([term("A", k, 1), term("D", b)], "=", [term("C", 1, 1)]));
    if (v !== null)
      extra.push({
        when: { kind: "solutions", variable: "x", values: [v] },
        title: tx("Added to the wrong side", "Auf der falschen Seite addiert"),
        say: tx(
          `Ooh, a classic! "${b} more than the number" means the number **plus** ${b}: $x + ${b}$. That's the side that gets the $+${b}$, not the $${k}x$.`,
          `Die klassische Falle! „Um ${b} größer als die Zahl“ heißt: die Zahl **plus** ${b}, also $x + ${b}$. Dort kommt das $+${b}$ hin, nicht zum $${k}x$.`,
        ),
      });
  } else {
    const c = rng.int(1, 3);
    const a = c + rng.int(1, 3);
    const b = rng.int(2, 12);
    const d = (a - c) * x0 - b;
    if (d <= 0 || !TIMES[a] || (c > 1 && !TIMES[c])) return null;
    e = equation([term("A", a, 1), term("B", -b)], "=", [term("C", c, 1), term("D", d)]);
    const w = TIMES[a];
    const cEn = c === 1 ? "my number" : `${TIMES[c].en} my number`;
    const cDe = c === 1 ? "meine Zahl" : `${TIMES[c].nom} meiner Zahl`;
    text = tx(
      `Subtract ${b} from ${w.en} my number and you get the same as ${cEn} plus ${d}. What is my number?`,
      `Subtrahierst du ${b} vom ${w.dat.replace("dem ", "")} meiner Zahl, erhältst du dasselbe wie ${cDe} plus ${d}. Wie heißt meine Zahl?`,
    );
    setUp = tx(`Left: $${a}x - ${b}$. Right: $${lin(c, d)}$. Both are equal: $${a}x - ${b} = ${lin(c, d)}$.`, `Links: $${a}x - ${b}$. Rechts: $${lin(c, d)}$. Beide sind gleich: $${a}x - ${b} = ${lin(c, d)}$.`);
    const v = wrong(equation([term("B", b), term("A", -a, 1)], "=", [term("C", c, 1), term("D", d)]));
    if (v !== null && v !== x0)
      extra.push({
        when: { kind: "solutions", variable: "x", values: [v] },
        title: tx("Subtracted the wrong way round", "Falsch herum subtrahiert"),
        say: tx(
          `"Subtract ${b} from ${w.en} my number" means $${a}x - ${b}$, not $${b} - ${a}x$. The number you subtract **from** comes first.`,
          `„${b} vom ${w.dat.replace("dem ", "")} subtrahieren“ heißt $${a}x - ${b}$, nicht $${b} - ${a}x$. Die Zahl, **von** der du abziehst, steht vorne.`,
        ),
      });
  }
  const { frames, value } = solveEq(e, "x", { check: true, intro: setUp });
  const seen = new Set([qvalue(value)]);
  const mistakes = [...extra, ...eqMistakes(e, "x", value, "=")].filter((m) => {
    const w = m.when.kind === "solutions" ? m.when.values[0] : NaN;
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
  return {
    instruction: tx("Set up an equation and solve it", "Stell eine Gleichung auf und löse sie"),
    text,
    answer: { kind: "solutions", variable: "x", values: [qvalue(value)] },
    hint: tx("Call the number $x$. Then turn the sentence into maths, piece by piece.", "Nenn die Zahl $x$. Dann übersetz den Satz Stück für Stück in Mathe."),
    solution: frames,
    mistakes: mistakes.slice(0, 5),
  };
}

/** Which of these numbers solves the equation? Decided by the check (Probe). */
function probe(rng: Rng): Exercise | null {
  const x0 = rng.nonZero(-4, 8);
  let e: Eq;
  if (rng.chance(0.6)) {
    const c = rng.int(1, 4);
    const a = c + rng.int(1, 4);
    const b = rng.nonZero(-10, 10);
    const d = (a - c) * x0 + b;
    if (d === 0) return null;
    e = equation([term("A", a, 1), term("B", b)], "=", [term("C", c, 1), term("D", d)]);
  } else {
    const k = rng.int(2, 4);
    const p = rng.nonZero(-5, 6);
    const c = rng.int(1, k - 1);
    const d = k * (x0 + p) - c * x0;
    if (d === 0) return null;
    e = equation([group("G", k, [inner(1, 1), inner(p)])], "=", [term("C", c, 1), term("D", d)]);
  }
  const slips = eqMistakes(e, "x", frac(x0), "=")
    .map((m) => (m.when.kind === "solutions" ? m.when.values[0] : NaN))
    .filter((w) => Number.isInteger(w) && w !== x0 && Math.abs(w) <= 20);
  const pool = [...new Set([...slips, -x0, x0 + 1, x0 - 1, x0 + 2])].filter((w) => w !== x0);
  const others = rng.shuffle(pool).slice(0, 3);
  if (others.length < 3) return null;
  const values = rng.shuffle([x0, ...others]);
  const correct = values.indexOf(x0);
  const options = values.map((w) => `$x = ${w}$`);
  const side = (items: Item[], w: number) => qvalue(evalSide(items, frac(w)));
  const frames: Frame[] = [
    {
      math: eqSrc(e, "x", false),
      note: tx("Put each number in for $x$. Only the solution makes both sides equal.", "Setz jede Zahl für $x$ ein. Nur bei der Lösung sind beide Seiten gleich."),
    },
    ...values.map((w): Frame => {
      const l = side(e.L, w);
      const r = side(e.R, w);
      const ok = l === r;
      const line = `${substSide(e.L, frac(w))} = ${l} \\quad ${substSide(e.R, frac(w))} = ${r}`;
      return {
        math: ok ? `\\green{${line}}` : line,
        note: ok
          ? tx(`$x = ${w}$: left $${l}$, right $${r}$. Equal, so this is the solution!`, `$x = ${w}$: links $${l}$, rechts $${r}$. Gleich, also ist das die Lösung!`)
          : tx(`$x = ${w}$: left $${l}$, right $${r}$. Not equal.`, `$x = ${w}$: links $${l}$, rechts $${r}$. Nicht gleich.`),
      };
    }),
  ];
  const mistakes: Mistake[] = values
    .map((w, i): Mistake | null => {
      if (i === correct) return null;
      const l = side(e.L, w);
      const r = side(e.R, w);
      return {
        when: { kind: "choice", options, correct: i },
        title: tx("The check fails", "Die Probe geht nicht auf"),
        say: tx(
          `Put $x = ${w}$ in: the left side gives $${l}$, the right side $${r}$. Not equal, so $${w}$ isn't the solution.`,
          `Setz $x = ${w}$ ein: Links kommt $${l}$ heraus, rechts $${r}$. Nicht gleich, also ist $${w}$ nicht die Lösung.`,
        ),
      };
    })
    .filter((m): m is Mistake => m !== null);
  return {
    instruction: tx("Which number solves the equation? Do the check.", "Welche Zahl löst die Gleichung? Mach die Probe."),
    math: eqSrc(e, "x", false),
    answer: { kind: "choice", options, correct },
    hint: tx("Put each number in for $x$ and work out both sides.", "Setz jede Zahl für $x$ ein und rechne beide Seiten aus."),
    solution: frames,
    mistakes,
  };
}

/** Level 1 practice: mostly the old basic and standard tiers, some challenge tasks, and three new shapes. */
export function generate1(rng: Rng): Exercise {
  for (let tries = 0; tries < 40; tries++) {
    const r = rng.next();
    const ex =
      r < 0.3
        ? tierTask(1, rng)
        : r < 0.54
          ? tierTask(2, rng)
          : r < 0.64
            ? tierTask(3, rng, ["ineqNeg", "ineqBracket", "minusBracket", "twoBrackets"])
            : r < 0.76
              ? findMistake(rng)
              : r < 0.88
                ? puzzle(rng)
                : probe(rng);
    if (ex) return ex;
  }
  return tierTask(1, rng);
}

// ---------------------------------------------------------------------------
// Interactive balance scale: take the same away on both sides.

type Pan = { x: number; n: number };
type Side = "l" | "r";
type BalanceLine = { l: Pan; r: Pan; kind: "x" | "n" | "div"; amount: number };
type BalanceState = { l: Pan; r: Pan; lines: BalanceLine[]; tipped: boolean };
type BalanceMsg = "start" | "ok" | "noN" | "noX" | "div" | "solved" | "tipped" | "one";

const PUZZLES: { l: Pan; r: Pan; x: number }[] = [
  { l: { x: 2, n: 3 }, r: { x: 0, n: 11 }, x: 4 },
  { l: { x: 3, n: 1 }, r: { x: 1, n: 7 }, x: 3 },
  { l: { x: 1, n: 8 }, r: { x: 3, n: 2 }, x: 3 },
  { l: { x: 4, n: 2 }, r: { x: 2, n: 10 }, x: 4 },
];

const fresh = (i: number): BalanceState => ({ l: PUZZLES[i].l, r: PUZZLES[i].r, lines: [], tipped: false });
const weightOf = (p: Pan, x: number) => p.x * x + p.n;

function panSrc(p: Pan, side: Side | "", keys = true): string {
  const k = (name: string) => (keys ? `#${side}${name}` : "");
  const parts: string[] = [];
  if (p.x > 0) parts.push(p.x === 1 ? `x${k("x")}` : `${p.x}${k("c")} x${k("x")}`);
  if (p.n > 0) parts.push(`${parts.length ? `+${k("p")} ` : ""}${p.n}${k("n")}`);
  return parts.length ? parts.join(" ") : `0${k("z")}`;
}

function lineOp(line: BalanceLine) {
  if (line.kind === "div") return `:${line.amount}`;
  if (line.kind === "n") return `-${line.amount}`;
  return line.amount === 1 ? "-x" : `-${line.amount}x`;
}

function isSolved(s: BalanceState) {
  return !s.tipped && ((s.l.x === 1 && s.l.n === 0 && s.r.x === 0) || (s.r.x === 1 && s.r.n === 0 && s.l.x === 0));
}

function takeBoth(s: BalanceState, kind: "x" | "n"): BalanceState | null {
  if (s.l[kind] < 1 || s.r[kind] < 1) return null;
  const last = s.lines[s.lines.length - 1];
  const lines = last && last.kind === kind ? [...s.lines.slice(0, -1), { ...last, amount: last.amount + 1 }] : [...s.lines, { l: s.l, r: s.r, kind, amount: 1 }];
  return { l: { ...s.l, [kind]: s.l[kind] - 1 }, r: { ...s.r, [kind]: s.r[kind] - 1 }, lines, tipped: false };
}

function divisorOf(s: BalanceState) {
  if (s.tipped || (!s.l.x && !s.r.x) || isSolved(s)) return 0;
  const counts = [s.l.x, s.l.n, s.r.x, s.r.n].filter((c) => c > 0);
  const g = counts.reduce((a, b) => gcd(a, b));
  return g >= 2 ? g : 0;
}

/** Item positions on a pan, bottom row first: x-boxes, then 1-weights. */
function pack(p: Pan) {
  const out: { id: string; kind: "x" | "n"; cx: number; cy: number }[] = [];
  let y = 0;
  const rows = (count: number, size: number, perRow: number, kind: "x" | "n") => {
    for (let start = 0; start < count; start += perRow) {
      const k = Math.min(perRow, count - start);
      const width = k * size + (k - 1) * 5;
      for (let i = 0; i < k; i++) out.push({ id: `${kind}${start + i}`, kind, cx: -width / 2 + size / 2 + i * (size + 5), cy: -(y + size / 2) });
      y += size + 5;
    }
  };
  rows(p.x, 32, 4, "x");
  rows(p.n, 20, 6, "n");
  return out;
}

const SWING = { type: "spring" as const, stiffness: 70, damping: 9, mass: 1 };
const BEAM = 160;

function PanView({ cx, angle, side, pan, xValue, reveal, onTap }: { cx: number; angle: number; side: Side; pan: Pan; xValue: number; reveal: boolean; onTap: (side: Side, kind: "x" | "n") => void }) {
  const rad = (angle * Math.PI) / 180;
  const dir = side === "l" ? -1 : 1;
  const dx = -dir * BEAM * (1 - cos(rad));
  const dy = dir * BEAM * sin(rad);
  return (
    <motion.g initial={false} animate={{ x: dx, y: dy }} transition={SWING}>
      <path d={`M ${cx} 70 L ${cx - 76} 224 M ${cx} 70 L ${cx + 76} 224`} stroke="var(--ink-3)" strokeWidth={1.4} fill="none" opacity={0.7} />
      <circle cx={cx} cy={70} r={4} fill="var(--ink-2)" />
      <path d={`M ${cx - 86} 224 H ${cx + 86} A 86 17 0 0 1 ${cx - 86} 224 Z`} fill="color-mix(in oklab, var(--ink) 9%, var(--surface))" stroke="var(--ink-3)" strokeWidth={1.2} />
      <g transform={`translate(${cx} 221)`}>
        <AnimatePresence initial={false}>
          {pack(pan).map((it) => (
            <motion.g
              key={it.id}
              initial={{ opacity: 0, scale: 0.4, x: it.cx, y: it.cy - 24 }}
              animate={{ opacity: 1, scale: 1, x: it.cx, y: it.cy }}
              exit={{ opacity: 0, scale: 0.7, y: it.cy - 56, transition: { duration: 0.38, ease: "easeOut" } }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => onTap(side, it.kind)}
              style={{ cursor: "pointer" }}
            >
              {it.kind === "x" ? (
                <>
                  <rect x={-16} y={-16} width={32} height={32} rx={8} fill="var(--blob)" />
                  <text y={6.5} textAnchor="middle" fontSize={reveal ? 18 : 20} fill="#fff" className="font-math" fontStyle={reveal ? "normal" : "italic"}>
                    {reveal ? xValue : "x"}
                  </text>
                </>
              ) : (
                <>
                  <rect x={-10} y={-10} width={20} height={20} rx={4.5} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.2} />
                  <text y={4.5} textAnchor="middle" fontSize={13} fill="var(--ink-2)" className="font-math">
                    1
                  </text>
                </>
              )}
            </motion.g>
          ))}
        </AnimatePresence>
      </g>
    </motion.g>
  );
}

function EqRow({ l, r, rel = "=", op, scope, live }: { l: string; r: string; rel?: string; op?: string; scope?: string; live?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2", live ? "min-h-12" : "min-h-8 text-ink-3")}>
      <MathView src={l} size={live ? "lg" : "md"} scope={scope && `${scope}-l`} animate={!!live} className="justify-self-end" />
      <MathView src={rel} size={live ? "lg" : "md"} animate={false} className={rel === "=" ? "" : "text-danger"} />
      <span className="flex min-w-0 items-center gap-4">
        <MathView src={r} size={live ? "lg" : "md"} scope={scope && `${scope}-r`} animate={!!live} />
        {op && <MathView src={`| \\, ${op}`} size="md" animate={false} className="text-blob-ink" />}
      </span>
    </div>
  );
}

const BALANCE_MSG: Record<BalanceMsg, Text> = {
  start: tx("Tap a block to take it away. The same block disappears from the other pan too.", "Tippe auf einen Block, um ihn wegzunehmen. Derselbe Block verschwindet auch aus der anderen Waagschale."),
  ok: tx("Still level. Both sides lost exactly the same weight.", "Immer noch im Gleichgewicht. Beide Seiten haben genau gleich viel Gewicht verloren."),
  noN: tx("The other pan has no 1-weight left. Try something else.", "In der anderen Waagschale liegt kein 1er-Gewicht mehr. Probier etwas anderes."),
  noX: tx("The other pan has no x-box to take away. Try something else.", "In der anderen Waagschale ist keine x-Kiste zum Wegnehmen. Probier etwas anderes."),
  div: tx(
    "Each pan was split into equal parts. One part stays on each side, so it's still level.",
    "Jede Waagschale wurde in gleiche Teile aufgeteilt. Auf jeder Seite bleibt ein Teil, also ist die Waage weiter im Gleichgewicht.",
  ),
  solved: tx("Solved! One x-box balances the weights on the other side.", "Gelöst! Eine x-Kiste wiegt so viel wie die Gewichte auf der anderen Seite:"),
  tipped: tx("It tips! Only one side changed, so the two sides aren't equal any more.", "Sie kippt! Nur eine Seite hat sich verändert, also sind die Seiten nicht mehr gleich."),
  one: tx("Now tap a block on just one pan and watch the balance.", "Tippe jetzt auf einen Block in nur einer Waagschale und beobachte die Waage."),
};

function BalanceScale() {
  const t = useText();
  const scope = useId();
  const [puzzle, setPuzzle] = useState(0);
  const [mode, setMode] = useState<"both" | "one">("both");
  const [s, setS] = useState(() => fresh(0));
  const [past, setPast] = useState<BalanceState[]>([]);
  const [msg, setMsg] = useState<BalanceMsg>("start");
  const X = PUZZLES[puzzle].x;
  const solved = isSolved(s);
  const angle = Math.max(-11, Math.min(11, (weightOf(s.r, X) - weightOf(s.l, X)) * 3.5));
  const k = divisorOf(s);

  function commit(next: BalanceState, m: BalanceMsg) {
    setPast((p) => [...p, s]);
    setS(next);
    setMsg(isSolved(next) ? "solved" : m);
  }
  function tap(side: Side, kind: "x" | "n") {
    if (s.tipped || solved) return;
    if (mode === "one") {
      const pan = s[side];
      if (pan[kind] < 1) return;
      const nextPan = { ...pan, [kind]: pan[kind] - 1 };
      const next = { ...s, [side]: nextPan } as BalanceState;
      commit({ ...next, tipped: weightOf(next.l, X) !== weightOf(next.r, X) }, "tipped");
      return;
    }
    const next = takeBoth(s, kind);
    if (!next) setMsg(kind === "x" ? "noX" : "noN");
    else commit(next, "ok");
  }
  function divide() {
    if (!k) return;
    commit({ l: { x: s.l.x / k, n: s.l.n / k }, r: { x: s.r.x / k, n: s.r.n / k }, lines: [...s.lines, { l: s.l, r: s.r, kind: "div", amount: k }], tipped: false }, "div");
  }
  function undo() {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setS(prev);
    setMsg(prev.tipped ? "tipped" : prev.lines.length ? "ok" : "start");
  }
  function load(i: number, m: "both" | "one" = mode) {
    setPuzzle(i);
    setS(fresh(i));
    setPast([]);
    setMsg(m === "one" ? "one" : "start");
  }
  function switchMode(m: "both" | "one") {
    setMode(m);
    load(puzzle, m);
  }

  const tone = msg === "tipped" ? "text-danger" : msg === "solved" ? "text-blob-ink font-semibold" : msg === "ok" || msg === "div" ? "text-ok" : "text-ink-2";
  const buttons: { label: string; on: () => void; ok: boolean }[] = [
    { label: "-1", on: () => tap("l", "n"), ok: s.l.n > 0 && s.r.n > 0 },
    { label: "-x", on: () => tap("l", "x"), ok: s.l.x > 0 && s.r.x > 0 },
    { label: `:${k || 2}`, on: divide, ok: k > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {(["both", "one"] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", mode === m ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {mode === m && <motion.span layoutId={`${scope}-mode`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{m === "both" ? t(tx("Both sides", "Beide Seiten")) : t(tx("One side only", "Nur eine Seite"))}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <button onClick={undo} disabled={!past.length} className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[13px] sm:gap-1.5 sm:px-2.5 font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent">
            <Undo2 className="size-3.5" /> {t(tx("Undo", "Rückgängig"))}
          </button>
          <button onClick={() => load(puzzle)} className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[13px] sm:gap-1.5 sm:px-2.5 font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-3.5" /> {t(tx("Reset", "Von vorn"))}
          </button>
          <button onClick={() => load((puzzle + 1) % PUZZLES.length)} className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[13px] sm:gap-1.5 sm:px-2.5 font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <Shuffle className="size-3.5" /> {t(tx("New puzzle", "Neues Rätsel"))}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 pt-3 pb-1">
        <svg viewBox="0 34 520 234" className="mx-auto block w-full max-w-[540px] select-none overflow-visible" role="img" aria-label={t(tx("Balance scale", "Balkenwaage"))}>
          <path d="M 260 74 L 246 254 H 274 Z" fill="color-mix(in oklab, var(--ink) 16%, transparent)" />
          <rect x={206} y={252} width={108} height={10} rx={5} fill="color-mix(in oklab, var(--ink) 22%, transparent)" />
          <PanView cx={260 - BEAM} angle={angle} side="l" pan={s.l} xValue={X} reveal={solved} onTap={tap} />
          <PanView cx={260 + BEAM} angle={angle} side="r" pan={s.r} xValue={X} reveal={solved} onTap={tap} />
          <motion.g initial={false} animate={{ rotate: angle }} transition={SWING}>
            <rect x={92} y={66} width={336} height={8} rx={4} fill="var(--ink-2)" />
            <circle cx={260} cy={70} r={10} fill="var(--blob)" />
            <circle cx={260} cy={70} r={3.5} fill="var(--raised)" />
          </motion.g>
        </svg>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {s.lines.map((line, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <EqRow l={panSrc(line.l, "", false)} r={panSrc(line.r, "", false)} op={lineOp(line)} />
              </motion.div>
            ))}
          </AnimatePresence>
          <EqRow l={panSrc(s.l, "l")} r={panSrc(s.r, "r")} rel={s.tipped ? "\\ne" : "="} scope={scope} live />
        </div>
        {mode === "both" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("On both sides", "Auf beiden Seiten"))}</span>
            <div className="flex gap-1.5">
              {buttons.map((b) => (
                <button
                  key={b.label}
                  onClick={b.on}
                  disabled={!b.ok || solved}
                  className="h-10 min-w-14 rounded-lg border border-line bg-raised px-3 text-[18px] text-ink transition-[transform,background] hover:border-blob hover:bg-blob-soft active:scale-95 disabled:pointer-events-none disabled:opacity-35"
                >
                  <MathView src={`| \\, ${b.label}`} size="sm" animate={false} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={msg + (solved ? X : "")} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className={cn("min-h-[1.5em] text-[14px]", tone)}>
          {t(BALANCE_MSG[msg])}
          {solved && (
            <>
              {" "}
              <MathView src={`x = ${X}`} size="inline" animate={false} className="mx-[0.1em] align-middle" />
            </>
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive number line: test numbers in an inequality and find the pattern.

type LabEx = { tex: string; lhs: (x: number) => number; sub: (x: string) => string; rel: Exclude<Rel, "=">; rhs: number; sol: { rel: Exclude<Rel, "=">; at: number }; steps: string[]; flips: boolean };

const LAB: LabEx[] = [
  { tex: "2x + 1 < 7", lhs: (x) => 2 * x + 1, sub: (x) => `2 \\cdot ${x} + 1`, rel: "<", rhs: 7, sol: { rel: "<", at: 3 }, steps: ["2x + 1 < 7 \\quad | \\, -1", "2x < 6 \\quad | \\, :2", "x < 3"], flips: false },
  { tex: "-2x < 6", lhs: (x) => -2 * x, sub: (x) => `-2 \\cdot ${x}`, rel: "<", rhs: 6, sol: { rel: ">", at: -3 }, steps: ["-2x < 6 \\quad | \\, :(-2)", "x \\hl{>} -3"], flips: true },
  { tex: "3x - 2 \\ge 4", lhs: (x) => 3 * x - 2, sub: (x) => `3 \\cdot ${x} - 2`, rel: "≥", rhs: 4, sol: { rel: "≥", at: 2 }, steps: ["3x - 2 \\ge 4 \\quad | \\, +2", "3x \\ge 6 \\quad | \\, :3", "x \\ge 2"], flips: false },
  { tex: "4 - 2x \\ge -2", lhs: (x) => 4 - 2 * x, sub: (x) => `4 - 2 \\cdot ${x}`, rel: "≥", rhs: -2, sol: { rel: "≤", at: 3 }, steps: ["4 - 2x \\ge -2 \\quad | \\, -4", "-2x \\ge -6 \\quad | \\, :(-2)", "x \\hl{\\le} 3"], flips: true },
];

const holds = (a: number, rel: Exclude<Rel, "=">, b: number) => (rel === "<" ? a < b : rel === ">" ? a > b : rel === "≤" ? a <= b : a >= b);
const deNum = (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace(".", ","));
const inBrackets = (v: number) => (v < 0 ? `(${deNum(v)})` : deNum(v));
const REL_PLAIN: Record<Rel, string> = { "=": "=", "<": "<", ">": ">", "≤": "≤", "≥": "≥" };

const NL = { from: -6, to: 6, y: 56 };
/** Number line geometry: a narrower drawing on phones keeps the labels readable. */
const lineGeometry = (narrow: boolean) => (narrow ? { w: 360, left: 22, right: 338, font: 17, bubble: 80 } : { w: 640, left: 34, right: 606, font: 15, bubble: 68 });

const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia("(max-width: 639px)").matches, () => false);

function InequalityLab() {
  const t = useText();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [ex, setEx] = useState(0);
  const [x, setX] = useState(0);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [show, setShow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const g = lineGeometry(useNarrow());
  const nx = (v: number) => g.left + ((v - NL.from) / (NL.to - NL.from)) * (g.right - g.left);
  const e = LAB[ex];
  const lhs = e.lhs(x);
  const ok = holds(lhs, e.rel, e.rhs);
  const color = ok ? "var(--ok)" : "var(--danger)";

  function moveTo(raw: number) {
    const v = Math.max(NL.from, Math.min(NL.to, Math.round(raw * 2) / 2));
    setX(v);
    setSeen((s) => (String(v) in s ? s : { ...s, [String(v)]: holds(e.lhs(v), e.rel, e.rhs) }));
  }
  function fromPointer(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    moveTo(NL.from + ((p.x - g.left) / (g.right - g.left)) * (NL.to - NL.from));
  }
  function pick(i: number) {
    setEx(i);
    setX(0);
    setSeen({});
    setShow(false);
  }

  const ticks: number[] = [];
  for (let v = NL.from; v <= NL.to; v++) ticks.push(v);
  const right = e.sol.rel === ">" || e.sol.rel === "≥";
  const closed = e.sol.rel === "≤" || e.sol.rel === "≥";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LAB.map((l, i) => (
          <button
            key={l.tex}
            onClick={() => pick(i)}
            className={cn("relative h-10 rounded-lg border px-3 transition-colors", ex === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
          >
            {ex === i && <motion.span layoutId={`${scope}-ex`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <MathView src={l.tex} size="sm" animate={false} className="relative" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 py-3 sm:px-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${g.w} 96`}
          className={cn("block w-full touch-none select-none", dragging ? "cursor-grabbing" : "cursor-pointer")}
          role="slider"
          aria-label={t(tx("Value of x", "Wert von x"))}
          aria-valuemin={NL.from}
          aria-valuemax={NL.to}
          aria-valuenow={x}
          tabIndex={0}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
              ev.preventDefault();
              moveTo(x + 0.5);
            } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
              ev.preventDefault();
              moveTo(x - 0.5);
            }
          }}
          onPointerDown={(ev) => {
            (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
            setDragging(true);
            fromPointer(ev);
          }}
          onPointerMove={(ev) => dragging && fromPointer(ev)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <line x1={g.left - 22} x2={g.right + 22} y1={NL.y} y2={NL.y} stroke="var(--ink-3)" strokeWidth={1.5} />
          <path d={`M ${g.right + 15} ${NL.y - 5} L ${g.right + 23} ${NL.y} L ${g.right + 15} ${NL.y + 5}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={nx(t)} x2={nx(t)} y1={NL.y - 7} y2={NL.y + 7} stroke="var(--ink-3)" strokeWidth={t === 0 ? 1.6 : 1} />
              {t < NL.to && <line x1={nx(t + 0.5)} x2={nx(t + 0.5)} y1={NL.y - 3} y2={NL.y + 3} stroke="var(--ink-3)" strokeWidth={0.8} opacity={0.6} />}
              <text x={nx(t)} y={NL.y + 27} fontSize={g.font} textAnchor="middle" fill="var(--ink-2)" className="font-math">
                {String(t).replace("-", "−")}
              </text>
            </g>
          ))}
          <AnimatePresence>
            {show && (
              <motion.g key={`sol${ex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.line
                  y1={NL.y}
                  y2={NL.y}
                  x1={nx(e.sol.at)}
                  initial={{ x2: nx(e.sol.at) }}
                  animate={{ x2: right ? g.right + 20 : g.left - 20 }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  stroke="var(--blob)"
                  strokeWidth={9}
                  strokeLinecap="round"
                  opacity={0.32}
                />
                <circle cx={nx(e.sol.at)} cy={NL.y} r={7.5} fill={closed ? "var(--blob)" : "var(--surface)"} stroke="var(--blob)" strokeWidth={2.6} />
              </motion.g>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {Object.entries(seen).map(([k, good]) => (
              <motion.circle
                key={`${ex}:${k}`}
                cx={nx(Number(k))}
                cy={NL.y}
                r={4.6}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.9 }}
                exit={{ scale: 0, opacity: 0 }}
                fill={good ? "var(--ok)" : "var(--danger)"}
              />
            ))}
          </AnimatePresence>
          <motion.g initial={false} animate={{ x: nx(x) }} transition={{ type: "spring", stiffness: 520, damping: 36 }}>
            <circle cy={NL.y} r={16} fill={color} opacity={0.16} />
            <circle cy={NL.y} r={8.5} fill={color} stroke="var(--raised)" strokeWidth={2.5} />
            <rect x={-g.bubble / 2} y={2} width={g.bubble} height={27} rx={13.5} fill={color} />
            <text y={21} textAnchor="middle" fontSize={g.font} fill="#fff" className="font-math" fontStyle="italic">
              x = {deNum(x).replace("-", "−")}
            </text>
          </motion.g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <MathView src={`${e.sub(inBrackets(x))} = ${deNum(lhs)}`} size="md" scope={`${scope}-sub`} />
        <span className="flex items-center gap-2.5">
          <MathView src={`${deNum(lhs)} ${REL_PLAIN[e.rel]} ${deNum(e.rhs)}`} size="md" scope={`${scope}-cmp`} />
          <motion.span
            key={String(ok)}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
            className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold text-white", ok ? "bg-ok" : "bg-danger")}
          >
            {ok ? t(tx("true", "wahr")) : t(tx("false", "falsch"))}
          </motion.span>
        </span>
        {!show && (
          <button onClick={() => setShow(true)} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <Eye className="size-3.5" /> {t(tx("Show the solution", "Lösung zeigen"))}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {show && (
          <motion.div key={`steps${ex}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-blob-soft/50 px-4 py-3">
              <div className="space-y-1">
                {e.steps.map((st) => (
                  <div key={st}>
                    <MathView src={st} size="md" animate={false} />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="font-math text-[22px] text-ink">
                  L = {"{"} <i>x</i> | <i>x</i> {REL_PLAIN[e.sol.rel]} {String(e.sol.at).replace("-", "−")} {"}"}
                </div>
                <p className="max-w-[340px] text-[13.5px] text-ink-2">
                  {t(
                    e.flips
                      ? tx("Dividing by a negative number flipped the sign. Your green dots agree!", "Beim Teilen durch eine negative Zahl hat sich das Relationszeichen umgedreht. Deine grünen Punkte zeigen es auch!")
                      : closed
                        ? tx("The boundary belongs to the solution: a filled dot.", "Die Grenze gehört zur Lösungsmenge: ein geschlossener Punkt.")
                        : tx("The boundary itself is not a solution: an open circle.", "Die Grenze selbst ist keine Lösung: ein offener Punkt."),
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

const balanceFrames: Frame[] = [
  {
    math: "x#x +#p 5#b =#eq 12#c",
    note: tx("On the left: $x$ and $5$. On the right: $12$. Both sides are worth the same.", "Links: $x$ und $5$. Rechts: $12$. Beide Seiten sind gleich viel wert."),
  },
  {
    math: "x#x +#p 5#b =#eq 12#c \\quad |#bar \\, -#o 5#on",
    highlight: ["o", "on"],
    note: tx(
      "We want $x$ alone, so the $+5$ has to go. Write the plan after a bar: $| -5$ means **subtract 5**.",
      "Wir wollen $x$ allein haben, also muss das $+5$ weg. Schreib den Rechenschritt hinter einen Strich: $| -5$ heißt **5 subtrahieren**.",
    ),
  },
  {
    math: "x#x +#p 5#b -#l 5#ln =#eq 12#c -#r 5#rn \\quad |#bar \\, -#o 5#on",
    highlight: ["l", "ln", "r", "rn"],
    note: tx(
      "Whatever you do to one side, you do to the other: subtract $5$ on **both** sides.",
      "Was du auf einer Seite machst, machst du auch auf der anderen: Subtrahiere $5$ auf **beiden** Seiten.",
    ),
  },
  { math: "x#x =#eq 7#c", note: tx("$5 - 5 = 0$ and $12 - 5 = 7$. So $x = 7$.", "$5 - 5 = 0$ und $12 - 5 = 7$. Also ist $x = 7$.") },
  { math: "\\green{7} + 5 = 12", note: tx("Check: put $7$ in for $x$. $7 + 5 = 12$. Balanced!", "Probe: Setze $7$ für $x$ ein. $7 + 5 = 12$. Im Gleichgewicht!") },
];

const twoStep = solveEq(equation([term("A", 2, 1), term("B", 3)], "=", [term("C", 11)]), "x", {
  check: true,
  maxEm: 18,
  intro: tx(
    "$2x$ means $2 \\cdot x$. So two things happen to $x$: times $2$, then plus $3$.",
    "$2x$ bedeutet $2 \\cdot x$. Mit $x$ passieren also zwei Dinge: erst mal $2$, dann plus $3$.",
  ),
}).frames;

const bothSides = solveEq(equation([term("A", 5, 1), term("B", -2)], "=", [term("C", 3, 1), term("D", 6)]), "x", {
  check: true,
  maxEm: 18,
  intro: tx("Now there's an $x$ on both sides. Collect them on one side first.", "Jetzt steht auf beiden Seiten ein $x$. Bring die $x$-Terme zuerst auf eine Seite."),
}).frames;

const withBracket = solveEq(equation([group("G", 3, [inner(1, 1), inner(-2)])], "=", [term("C", 1, 1), term("D", 4)]), "x", { check: true, maxEm: 18 }).frames;

const firstInequality = solveEq(equation([term("A", 2, 1), term("B", 1)], "<", [term("C", 7)]), "x", {
  maxEm: 18,
  intro: tx(
    "An inequality: the left side is **smaller** than the right side. Solve it just like an equation.",
    "Eine Ungleichung: Die linke Seite ist **kleiner** als die rechte. Löse sie genau wie eine Gleichung.",
  ),
}).frames;

const flipFrames: Frame[] = [
  { math: "2#a <#rel 5#b", note: tx("Why is there an exception? Start with something true: $2 < 5$.", "Warum gibt es eine Ausnahme? Fang mit einer wahren Aussage an: $2 < 5$.") },
  {
    math: "2#a <#rel 5#b \\quad |#bar \\, \\cdot#o (-#os 1#on)#ob",
    highlight: ["bar", "o", "os", "on", "ob(", "ob)"],
    note: tx("Now multiply both sides by $-1$.", "Multipliziere jetzt beide Seiten mit $-1$."),
  },
  { math: "-#as 2#a \\hl{?#q} -#bs 5#b", note: tx("We get $-2$ and $-5$. Which one is bigger?", "Du bekommst $-2$ und $-5$. Welche Zahl ist größer?") },
  {
    math: "-#as 2#a >#rel2 -#bs 5#b",
    highlight: ["rel2"],
    note: tx(
      "$-2$ is **bigger** than $-5$: it lies further right on the number line. The sign had to flip!",
      "$-2$ ist **größer** als $-5$: Die Zahl liegt auf dem Zahlenstrahl weiter rechts. Das Relationszeichen musste sich umdrehen!",
    ),
  },
  ...solveEq(equation([term("A", -3, 1)], "≤", [term("C", 12)]), "x", {
    maxEm: 18,
    intro: tx("Same with $-3x \\le 12$. To get $x$ alone you divide by $-3$.", "Genauso bei $-3x \\le 12$. Um $x$ allein zu bekommen, teilst du durch $-3$."),
  }).frames,
];

export const level1: LevelLesson = {
  summary: [
    {
      title: tx("The balance rule", "Die Waage-Regel"),
      body: tx("Do the same thing to **both** sides. Write each step after a bar.", "Mach auf **beiden** Seiten dasselbe. Schreib jeden Schritt hinter einen Strich."),
      examples: ["2x + 3 = 11 \\quad | \\, -3", "2x = 8 \\quad | \\, :2", "x = 4"],
      tone: "rule",
    },
    {
      title: tx("In this order", "In dieser Reihenfolge"),
      body: tx(
        "Expand brackets. Collect the $x$-terms on one side and the numbers on the other. Then divide by the number in front of $x$.",
        "Klammern auflösen. Die $x$-Terme auf eine Seite bringen und die Zahlen auf die andere. Dann durch die Zahl vor dem $x$ teilen.",
      ),
      examples: ["3(x - 2) = x + 4", "3x - 6 = x + 4 \\quad | \\, -x", "2x - 6 = 4 \\quad | \\, +6", "2x = 10 \\quad | \\, :2"],
      tone: "rule",
    },
    {
      title: tx("Inequalities", "Ungleichungen"),
      body: tx(
        "Solve them like equations. The solution is a whole range of numbers, shown on a number line.",
        "Löse sie wie Gleichungen. Die Lösung ist ein ganzer Zahlenbereich, den du am Zahlenstrahl zeigen kannst.",
      ),
      examples: ["2x + 1 < 7 \\quad | \\, -1", "2x < 6 \\quad | \\, :2", "x < 3"],
      tone: "rule",
    },
    {
      title: tx("Negative factor: flip the sign", "Negativer Faktor: Zeichen umdrehen"),
      body: tx(
        "Multiplying or dividing both sides by a **negative** number turns the inequality sign around.",
        "Bei der Multiplikation oder Division mit einer **negativen** Zahl dreht sich das Relationszeichen um.",
      ),
      examples: ["-3x \\le 12 \\quad | \\, :(-3)", "x \\ge -4"],
      tone: "warning",
    },
    {
      title: tx("Fractions", "Brüche"),
      body: tx("Multiply every term by the common denominator. The fractions disappear.", "Multipliziere jeden Term mit dem Hauptnenner. Dann verschwinden die Brüche."),
      examples: ["\\frac{x}{2} + \\frac{x}{3} = 5 \\quad | \\, \\cdot 6", "3x + 2x = 30"],
      tone: "tip",
    },
    {
      title: tx("Check your answer", "Mach die Probe"),
      body: tx("Put the solution back in. Both sides must give the same number.", "Setz die Lösung in die Gleichung ein. Beide Seiten müssen dieselbe Zahl ergeben."),
      examples: ["2 \\cdot 4 + 3 = 11"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("An equation is a balance", "Eine Gleichung ist eine Waage"),
      blob: tx("Picture a balance that's perfectly level. That's an equation!", "Stell dir eine Waage vor, die genau im Gleichgewicht ist. Das ist eine Gleichung!"),
      body: tx(
        "An equation says: the left side is worth exactly as much as the right side. To find $x$, we change both sides in the same way until $x$ is alone.",
        "Eine Gleichung sagt: Die linke Seite ist genau so viel wert wie die rechte. Um $x$ zu finden, verändern wir beide Seiten auf die gleiche Weise, bis $x$ allein dasteht.",
      ),
      frames: balanceFrames,
    },
    {
      type: "widget",
      title: tx("Keep it balanced", "Halte die Waage im Gleichgewicht"),
      blob: tx("Tap the blocks! Can you get one x-box all by itself?", "Tippe auf die Blöcke! Schaffst du es, dass eine x-Kiste ganz allein übrig bleibt?"),
      body: tx(
        "Each purple box weighs $x$, each small block weighs $1$. Take away the same on both sides and the balance stays level. Then switch to **One side only** and see what happens.",
        "Jede lila Kiste wiegt $x$, jeder kleine Block wiegt $1$. Nimm auf beiden Seiten dasselbe weg, dann bleibt die Waage im Gleichgewicht. Wechsle danach zu **Nur eine Seite** und schau, was passiert.",
      ),
      widget: BalanceScale,
    },
    {
      type: "explain",
      title: tx("Two steps: first plus and minus, then divide", "Zwei Schritte: erst plus und minus, dann teilen"),
      blob: tx("Undo things in reverse: the plus goes first, then the times.", "Mach alles in umgekehrter Reihenfolge rückgängig: zuerst das Plus, dann das Mal."),
      body: tx(
        "Get rid of the number that's added or subtracted first. Then divide by the number in front of $x$.",
        "Bring zuerst die Zahl weg, die addiert oder subtrahiert wird. Teile dann durch die Zahl vor dem $x$.",
      ),
      frames: twoStep,
    },
    {
      type: "check",
      blob: tx("Your turn! Same two steps.", "Jetzt du! Dieselben zwei Schritte."),
      exercise: make(
        equation([term("A", 4, 1), term("B", -7)], "=", [term("C", 13)]),
        "x",
        tx("First add $7$ on both sides, then divide by $4$.", "Addiere zuerst $7$ auf beiden Seiten, dann teile durch $4$."),
        true,
      ),
    },
    {
      type: "explain",
      title: tx("x on both sides", "x auf beiden Seiten"),
      blob: tx("Two teams of x? Bring them together on one side.", "Zwei x-Teams? Bring sie auf einer Seite zusammen."),
      body: tx(
        "Collect all $x$-terms on one side and all numbers on the other. Tip: take away the smaller $x$-term, then $x$ stays positive.",
        "Bring alle $x$-Terme auf eine Seite und alle Zahlen auf die andere. Tipp: Zieh den kleineren $x$-Term ab, dann bleibt $x$ positiv.",
      ),
      frames: bothSides,
    },
    {
      type: "explain",
      title: tx("Brackets? Expand first", "Klammern? Erst auflösen"),
      blob: tx("Brackets are wrapping paper. Unwrap them first!", "Klammern sind wie Geschenkpapier. Erst mal auspacken!"),
      body: tx(
        "Multiply out the brackets. After that it's an equation like the ones before.",
        "Multipliziere die Klammern aus. Danach ist es eine Gleichung wie die davor.",
      ),
      frames: withBracket,
    },
    {
      type: "check",
      blob: tx("Bracket first, then the balance steps.", "Erst die Klammer, dann die Waage-Schritte."),
      exercise: make(
        equation([group("G", 2, [inner(1, 1), inner(4)])], "=", [term("C", 5, 1), term("D", -1)]),
        "x",
        tx("Expand: $2(x + 4) = 2x + 8$. Then bring the $x$-terms together.", "Klammer auflösen: $2(x + 4) = 2x + 8$. Dann bring die $x$-Terme auf eine Seite."),
        true,
      ),
    },
    {
      type: "explain",
      title: tx("Inequalities", "Ungleichungen"),
      blob: tx("Not equal, but smaller or bigger. Same tricks!", "Nicht gleich, sondern kleiner oder größer. Gleiche Tricks!"),
      body: tx(
        "$x < 3$ means $x$ is smaller than $3$. $x \\ge 3$ means greater than or equal to $3$. You solve inequalities just like equations, and the answer is a whole range of numbers.",
        "$x < 3$ heißt: $x$ ist kleiner als $3$. $x \\ge 3$ heißt: größer oder gleich $3$. Ungleichungen löst du genau wie Gleichungen, und die Lösung ist ein ganzer Zahlenbereich.",
      ),
      frames: firstInequality,
    },
    {
      type: "widget",
      title: tx("Test numbers on the number line", "Zahlen am Zahlenstrahl testen"),
      blob: tx("Drag x around. Green means it works, red means it doesn't.", "Zieh x hin und her. Grün heißt: passt. Rot heißt: passt nicht."),
      body: tx(
        "Move $x$ and watch whether the inequality is true. The dots remember what you tried. Then compare $2x + 1 < 7$ with $-2x < 6$: where are the solutions?",
        "Verschieb $x$ und schau, ob die Ungleichung wahr ist. Die Punkte merken sich, was du ausprobiert hast. Vergleich dann $2x + 1 < 7$ mit $-2x < 6$: Wo liegen die Lösungen?",
      ),
      widget: InequalityLab,
    },
    {
      type: "explain",
      title: tx("The one exception: negative numbers", "Die eine Ausnahme: negative Zahlen"),
      blob: tx("This is the trap in every test. Watch closely!", "Das ist die Falle in jeder Klassenarbeit. Pass gut auf!"),
      body: tx(
        "Multiply or divide both sides by a **negative** number and the inequality sign turns around. That's the only new rule.",
        "Multiplizierst du beide Seiten mit einer **negativen** Zahl oder teilst durch sie, dreht sich das Relationszeichen um. Das ist die einzige neue Regel.",
      ),
      frames: flipFrames,
    },
    {
      type: "check",
      blob: tx("Last one. Remember the flip!", "Die letzte! Denk ans Umdrehen!"),
      exercise: make(
        equation([term("A", -4, 1), term("B", 3)], ">", [term("C", 11)]),
        "x",
        tx(
          "Subtract $3$, then divide by $-4$. Dividing by a negative number flips the sign!",
          "Subtrahiere $3$, dann teile durch $-4$. Beim Teilen durch eine negative Zahl dreht sich das Relationszeichen um!",
        ),
      ),
    },
  ],
};
