"use client";

import type { ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import {
  absCasesFrames,
  absCasesMistakes,
  absCasesSolve,
  absCasesSrc,
  absIneqFrames,
  absIneqSet,
  absIneqSrc,
  absLinearFrames,
  absLinearMistakes,
  absLinearSolve,
  absLinearSrc,
  absSimpleFrames,
  absSimpleMistakes,
  absSimpleSolve,
  absSimpleSrc,
  lin,
  rootLinFrames,
  rootLinMistakes,
  rootLinSolve,
  rootLinSrc,
  rootQuadFrames,
  rootQuadMistakes,
  rootQuadSolve,
  rootQuadSrc,
  rootRootFrames,
  rootRootMistakes,
  rootRootSolve,
  rootRootSrc,
  type AbsCases,
  type AbsIneq,
  type RootQuad,
} from "./build3";
import { mapText } from "./model";
import { DistanceLab, DistancePicture, RootLab } from "./widgets3";

// ---------------------------------------------------------------------------
// Level 3 (Klasse 9–10): absolute value equations and inequalities, as distances on the
// number line and with case analysis, and root equations with the check that removes
// false solutions.

const ABS = tx("Solve the absolute value equation", "Löse die Betragsgleichung");
const ROOT = tx("Solve the root equation", "Löse die Wurzelgleichung");
const solutions = (values: number[]) => ({ kind: "solutions" as const, variable: "x", values, allowNone: true });

function absSimpleExercise(a: number, r: number): Exercise {
  return {
    instruction: ABS,
    math: absSimpleSrc({ a, r }, "x", false),
    answer: solutions(absSimpleSolve({ a, r })),
    hint:
      r < 0
        ? tx("Can a distance be negative?", "Kann ein Abstand negativ sein?")
        : tx(`Which numbers are $${r}$ away from $${a}$ on the number line?`, `Welche Zahlen liegen an der Zahlengeraden $${r}$ von $${a}$ entfernt?`),
    solution: absSimpleFrames({ a, r }),
    mistakes: absSimpleMistakes({ a, r }),
  };
}

function absLinearExercise(u: number, b: number, c: number): Exercise {
  return {
    instruction: ABS,
    math: absLinearSrc({ u, b, c }),
    answer: solutions(absLinearSolve({ u, b, c })),
    hint: tx(`The inside is either $${c}$ or $-${c}$. Solve both equations.`, `Das Innere ist entweder $${c}$ oder $-${c}$. Löse beide Gleichungen.`),
    solution: absLinearFrames({ u, b, c }),
    mistakes: absLinearMistakes({ u, b, c }),
  };
}

function absCasesExercise(t: AbsCases): Exercise {
  return {
    instruction: ABS,
    math: absCasesSrc(t),
    answer: solutions(absCasesSolve(t).values),
    hint: tx(
      "Case 1: the inside is $\\ge 0$, drop the bars. Case 2: the inside is $< 0$, put a minus in front. Check each result against its case.",
      "1. Fall: Das Innere ist $\\ge 0$, die Striche fallen weg. 2. Fall: Das Innere ist $< 0$, ein Minus kommt davor. Prüf jedes Ergebnis an seinem Fall.",
    ),
    solution: absCasesFrames(t),
    mistakes: absCasesMistakes(t),
  };
}

/** Which solution set fits |x − a| < r (or ≤, >, ≥)? */
function absIneqExercise(t: AbsIneq, order: number[]): Exercise {
  const { a, r, rel } = t;
  const inner = rel === "<" || rel === "≤";
  const closed = rel === "≤" || rel === "≥";
  const other: AbsIneq["rel"] = inner ? (closed ? "≥" : ">") : closed ? "≤" : "<";
  const right = absIneqSet(a - r, a + r, rel);
  const flipped = absIneqSet(a - r, a + r, other);
  const centre = absIneqSet(-a - r, -a + r, rel);
  const R = { "<": "<", "≤": "\\le", ">": ">", "≥": "\\ge" }[rel];
  const half: Text = inner ? `L = \\{ x \\,|\\, x ${R} ${a + r} \\}` : `L = \\{ x \\,|\\, x ${R} ${a + r} \\}`;
  const halfLow: Text = `L = \\{ x \\,|\\, x ${R} ${a - r} \\}`;
  const base = [right, flipped, a !== 0 ? centre : halfLow, half];
  const options = order.map((i) => mapText(base[i], (s) => `$${s}$`));
  const at = (i: number) => order.indexOf(i);
  const mistakes: Mistake[] = [
    {
      when: { kind: "choice", options, correct: at(1) },
      title: inner ? tx("Inside, not outside", "Innen, nicht außen") : tx("Outside, not inside", "Außen, nicht innen"),
      say: inner
        ? tx(
            `"${rel === "<" ? "Less than" : "At most"} $${r}$ away from $${a}$" means **close** to $${a}$: the numbers between $${a - r}$ and $${a + r}$, not the ones outside.`,
            `„${rel === "<" ? "Weniger als" : "Höchstens"} $${r}$ von $${a}$ entfernt“ heißt **nah** bei $${a}$: die Zahlen zwischen $${a - r}$ und $${a + r}$, nicht die außerhalb.`,
          )
        : tx(
            `"${rel === ">" ? "More than" : "At least"} $${r}$ away from $${a}$" means **far** from $${a}$: everything outside $${a - r}$ and $${a + r}$.`,
            `„${rel === ">" ? "Mehr als" : "Mindestens"} $${r}$ von $${a}$ entfernt“ heißt **weit weg** von $${a}$: alles außerhalb von $${a - r}$ und $${a + r}$.`,
          ),
    },
    {
      when: { kind: "choice", options, correct: at(2) },
      title: a !== 0 ? tx("Wrong centre", "Falscher Mittelpunkt") : tx("Only one side", "Nur eine Seite"),
      say:
        a !== 0
          ? tx(
              `Nearly! $|${lin(1, -a)}|$ measures the distance from $${a}$, so the set lies around $${a}$, not around $${-a}$.`,
              `Fast! $|${lin(1, -a)}|$ misst den Abstand von $${a}$, die Menge liegt also um $${a}$ herum, nicht um $${-a}$.`,
            )
          : tx("A distance goes both ways: the set has a left and a right boundary.", "Ein Abstand geht in beide Richtungen: Die Menge hat eine linke und eine rechte Grenze."),
      close: a !== 0,
    },
    {
      when: { kind: "choice", options, correct: at(3) },
      title: tx("Only one side", "Nur eine Seite"),
      say: tx(
        `That's only half of it. The distance from $${a}$ counts in **both** directions, so there's a boundary at $${a - r}$ as well as at $${a + r}$.`,
        `Das ist nur die halbe Miete. Der Abstand von $${a}$ zählt in **beide** Richtungen, es gibt also eine Grenze bei $${a - r}$ und eine bei $${a + r}$.`,
      ),
    },
  ];
  return {
    instruction: tx("Find the solution set of the inequality", "Bestimme die Lösungsmenge der Ungleichung"),
    math: absIneqSrc(t),
    answer: { kind: "choice", options, correct: at(0) },
    hint: tx(`Think of the distance from $${a}$: ${inner ? "close to it" : "far from it"}?`, `Denk an den Abstand von $${a}$: nah dran oder weit weg?`),
    solution: absIneqFrames(t),
    mistakes,
  };
}

function rootQuadExercise(t: RootQuad, isolate?: number): Exercise {
  const { good } = rootQuadSolve(t);
  const math = isolate !== undefined ? `\\sqrt{${lin(t.u, t.a)}} ${isolate > 0 ? "+" : "-"} ${Math.abs(isolate)} = x` : rootQuadSrc(t);
  return {
    instruction: ROOT,
    math,
    answer: solutions(good),
    hint:
      isolate !== undefined
        ? tx("Get the root on its own first. Then square, solve, and check every candidate.", "Bring zuerst die Wurzel allein auf eine Seite. Dann quadrieren, lösen und jeden Kandidaten prüfen.")
        : tx("Square both sides, solve the quadratic equation, then check every candidate in the original equation.", "Quadriere beide Seiten, löse die quadratische Gleichung und prüf jeden Kandidaten in der ursprünglichen Gleichung."),
    solution: rootQuadFrames(t, "x", { isolate }),
    mistakes: rootQuadMistakes(t),
  };
}

// ---------------------------------------------------------------------------
// Generators

function absTask(rng: Rng): Exercise | null {
  for (let i = 0; i < 30; i++) {
    const ex = absTaskOnce(rng);
    if (ex) return ex;
  }
  return null;
}

function absTaskOnce(rng: Rng): Exercise | null {
  const form = rng.pick(["simple", "simple", "linear", "cases", "cases", "cases"] as const);
  if (form === "simple") {
    const a = rng.int(-6, 6);
    const roll = rng.next();
    const r = roll < 0.08 ? 0 : roll < 0.16 ? -rng.int(1, 5) : rng.int(1, 8);
    return absSimpleExercise(a, r);
  }
  if (form === "linear") {
    const u = rng.int(2, 4);
    const s1 = rng.int(-4, 8);
    const s2 = rng.int(-8, 4);
    if (s1 <= s2 || (u * (s1 + s2)) % 2 !== 0) return null;
    const b = -(u * (s1 + s2)) / 2;
    const c = (u * (s1 - s2)) / 2;
    if (b === 0 || c > 20) return null;
    return absLinearExercise(u, b, c);
  }
  const u = rng.int(1, 3);
  const b = rng.nonZero(-6, 6);
  const w = rng.pick([-2, -1, 1, 2]);
  const d = rng.nonZero(-9, 9);
  if (w === u || u + w === 0) return null;
  const t: AbsCases = { u, b, w, d };
  const { x1, x2, values } = absCasesSolve(t);
  if (!x1 || !x2 || !values.length || values.some((v) => !Number.isInteger(v) || Math.abs(v) > 15)) return null;
  // Bound and rejected values stay small enough to read.
  if (x1.d > 4 || x2.d > 4 || Math.abs(x1.n / x1.d) > 20 || Math.abs(x2.n / x2.d) > 20) return null;
  return absCasesExercise(t);
}

function absIneqTask(rng: Rng): Exercise {
  const a = rng.int(-5, 5);
  const r = rng.int(1, 6);
  const rel = rng.pick(["<", "≤", ">", "≥"] as const);
  return absIneqExercise({ a, r, rel }, rng.shuffle([0, 1, 2, 3]));
}

function rootTask(rng: Rng): Exercise | null {
  for (let i = 0; i < 30; i++) {
    const ex = rootTaskOnce(rng);
    if (ex) return ex;
  }
  return null;
}

function rootTaskOnce(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.55) {
    const u = rng.chance(0.8) ? 1 : 2;
    const b = rng.int(-2, 4);
    const k = u === 1 ? rng.pick([1, 2, 2, 3, 3, 4, 5, 6]) : rng.pick([2, 3, 4, 5]);
    const x1 = b + k;
    const x2 = 2 * b + u - x1;
    if (x1 === x2) return null;
    const a = b * b - x1 * x2;
    if (Math.abs(a) > 30) return null;
    const t: RootQuad = { u, a, b };
    // Sometimes the root has to be isolated first: √(ux + a) + b = x.
    return b !== 0 && rng.chance(0.3) ? rootQuadExercise(t, b) : rootQuadExercise(t);
  }
  if (roll < 0.8) {
    const u = rng.int(1, 3);
    const c = rng.chance(0.1) ? -rng.int(1, 4) : rng.int(1, 6);
    const x = rng.int(-5, 12);
    const a = c * c - u * x;
    if (a === 0 || Math.abs(a) > 40) return null;
    if (c < 0 && Math.abs(a) > 20) return null;
    return {
      instruction: ROOT,
      math: rootLinSrc({ u, a, c }),
      answer: solutions(rootLinSolve({ u, a, c })),
      hint: c < 0 ? tx("Can a square root be negative?", "Kann eine Quadratwurzel negativ sein?") : tx("Square both sides, then solve. Don't forget the check.", "Quadriere beide Seiten und löse dann. Vergiss die Probe nicht."),
      solution: rootLinFrames({ u, a, c }),
      mistakes: rootLinMistakes({ u, a, c }),
    };
  }
  const u = rng.int(1, 4);
  const w = rng.int(1, 4);
  if (u === w) return null;
  const x = rng.nonZero(-6, 9);
  const a = rng.int(-12, 12);
  const d = a + (u - w) * x;
  if (Math.abs(d) > 20) return null;
  const t = { u, a, w, d };
  const { ok } = rootRootSolve(t);
  return {
    instruction: ROOT,
    math: rootRootSrc(t),
    answer: solutions(ok ? [x] : []),
    hint: tx("Square both sides. Then check: is the number under each root at least 0?", "Quadriere beide Seiten. Dann prüf: Ist die Zahl unter jeder Wurzel mindestens 0?"),
    solution: rootRootFrames(t),
    mistakes: rootRootMistakes(t),
  };
}

/** The check: which candidates from squaring really solve the root equation? */
function probeTask(rng: Rng): Exercise | null {
  const b = rng.int(-2, 4);
  const k = rng.pick([1, 2, 3, 3, 4, 5]);
  const x1 = b + k;
  const x2 = 2 * b + 1 - x1;
  if (x1 === x2) return null;
  const a = b * b - x1 * x2;
  if (Math.abs(a) > 30) return null;
  const t: RootQuad = { u: 1, a, b };
  const { cands, good } = rootQuadSolve(t);
  if (cands.length !== 2) return null;
  const [c1, c2] = rng.chance(0.5) ? [cands[0], cands[1]] : [cands[1], cands[0]];
  const base: Text[] = [
    tx(`only $x = ${c1}$`, `nur $x = ${c1}$`),
    tx(`only $x = ${c2}$`, `nur $x = ${c2}$`),
    tx("both", "beide"),
    tx("neither", "keine von beiden"),
  ];
  const order = rng.shuffle([0, 1, 2, 3]);
  const options = order.map((i) => base[i]);
  const pos = (i: number) => order.indexOf(i);
  const correct = pos(good.length === 2 ? 2 : good.length === 0 ? 3 : good[0] === c1 ? 0 : 1);
  const check = (x: number) => ({ left: Math.sqrt(x + a), right: x - b });
  const bad = cands.find((x) => !good.includes(x));
  const mistakes: Mistake[] = [];
  const say = (x: number) => {
    const { left, right } = check(x);
    return left === right
      ? b === 0
        ? tx(`$x = ${x}$ works: $\\sqrt{${x + a}} = ${left}$, and the right side is $${right}$ too.`, `$x = ${x}$ passt: $\\sqrt{${x + a}} = ${left}$, und die rechte Seite ist auch $${right}$.`)
        : tx(`$x = ${x}$ works: $\\sqrt{${x + a}} = ${left}$ and $${x} ${b > 0 ? "-" : "+"} ${Math.abs(b)} = ${right}$.`, `$x = ${x}$ passt: $\\sqrt{${x + a}} = ${left}$ und $${x} ${b > 0 ? "-" : "+"} ${Math.abs(b)} = ${right}$.`)
      : tx(
          `Check $x = ${x}$: the root gives $${left}$, the right side $${right}$. A root is never negative, so that's a false solution.`,
          `Probe für $x = ${x}$: Die Wurzel ergibt $${left}$, die rechte Seite $${right}$. Eine Wurzel ist nie negativ, also ist das eine Scheinlösung.`,
        );
  };
  for (let i = 0; i < 4; i++) {
    if (pos(i) === correct) continue;
    const when = { kind: "choice" as const, options, correct: pos(i) };
    if (i === 2 && bad !== undefined) mistakes.push({ when, title: tx("False solution kept", "Scheinlösung behalten"), say: say(bad), close: true });
    else if (i === 3) mistakes.push({ when, title: tx("One of them works", "Einer passt doch"), say: say(good[0]) });
    else if (i < 2) {
      const x = i === 0 ? c1 : c2;
      mistakes.push({ when, title: good.includes(x) ? tx("The other one works too", "Der andere passt auch") : tx("Do the check", "Mach die Probe"), say: say(good.includes(x) ? (x === c1 ? c2 : c1) : x) });
    }
  }
  return {
    instruction: tx("Do the check: which candidates are solutions?", "Mach die Probe: Welche Kandidaten sind Lösungen?"),
    text: tx(
      `Squaring $${rootQuadSrc(t)}$ gives the candidates $x_1 = ${c1}$ and $x_2 = ${c2}$. Which of them solve the original equation?`,
      `Quadrieren von $${rootQuadSrc(t)}$ liefert die Kandidaten $x_1 = ${c1}$ und $x_2 = ${c2}$. Welche davon lösen die ursprüngliche Gleichung?`,
    ),
    answer: { kind: "choice", options, correct },
    hint: tx("Put each candidate into the original equation. The root must come out equal to the right side.", "Setz jeden Kandidaten in die ursprüngliche Gleichung ein. Die Wurzel muss genau die rechte Seite ergeben."),
    solution: [...rootQuadFrames(t).slice(-3)],
    mistakes,
  };
}

/** Words to absolute value: "all numbers at distance 4 from −2". */
function distanceTask(rng: Rng): Exercise | null {
  const a = rng.nonZero(-6, 6);
  const r = rng.int(1, 7);
  if (Math.abs(a) === r) return null;
  const kind = rng.pick(["=", "=", "<", ">", "≤", "≥"] as const);
  const R = { "=": "=", "<": "<", ">": ">", "≤": "\\le", "≥": "\\ge" }[kind];
  const wrongRel = { "=": "<", "<": ">", ">": "<", "≤": "\\ge", "≥": "\\le" }[kind];
  const phrase: Record<typeof kind, [string, string]> = {
    "=": [`exactly ${r}`, `genau ${r}`],
    "<": [`less than ${r}`, `kleiner als ${r}`],
    ">": [`more than ${r}`, `größer als ${r}`],
    "≤": [`at most ${r}`, `höchstens ${r}`],
    "≥": [`at least ${r}`, `mindestens ${r}`],
  };
  const right = `|${lin(1, -a)}| ${R} ${r}`;
  const base = [right, `|${lin(1, a)}| ${R} ${r}`, `|${lin(1, -a)}| ${wrongRel} ${r}`, `|${lin(1, -r)}| ${R} ${Math.abs(a)}`];
  if (new Set(base).size < 4) return null;
  const order = rng.shuffle([0, 1, 2, 3]);
  const options = order.map((i) => `$${base[i]}$`);
  const at = (i: number) => order.indexOf(i);
  const mistakes: Mistake[] = [
    {
      when: { kind: "choice", options, correct: at(1) },
      title: tx("Sign of the centre", "Vorzeichen der Mitte"),
      say: tx(
        `Nearly! The distance from $${a}$ is $|x - (${a})| = |${lin(1, -a)}|$. Inside the bars you **subtract** the centre.`,
        `Fast! Der Abstand von $${a}$ ist $|x - (${a})| = |${lin(1, -a)}|$. In den Strichen wird die Mitte **abgezogen**.`,
      ),
      close: true,
    },
    {
      when: { kind: "choice", options, correct: at(2) },
      title: tx("Wrong relation", "Falsches Zeichen"),
      say: tx(`Read it again: the distance is ${phrase[kind][0]}. Which sign says exactly that?`, `Lies noch mal genau: Der Abstand ist ${phrase[kind][1]}. Welches Zeichen sagt genau das?`),
    },
    {
      when: { kind: "choice", options, correct: at(3) },
      title: tx("Centre and distance swapped", "Mitte und Abstand vertauscht"),
      say: tx(
        `The centre goes **inside** the bars, the distance on the other side: $|x - \\text{centre}|$ compared with the distance.`,
        `Die Mitte steht **in** den Betragsstrichen, der Abstand auf der anderen Seite: $|x - \\text{Mitte}|$ verglichen mit dem Abstand.`,
      ),
    },
  ];
  return {
    instruction: tx("Write it with an absolute value", "Schreib es mit einem Betrag"),
    text: tx(`All numbers $x$ whose distance from $${a}$ is ${phrase[kind][0]}.`, `Alle Zahlen $x$, deren Abstand von $${a}$ ${phrase[kind][1]} ist.`),
    answer: { kind: "choice", options, correct: at(0) },
    hint: tx(`The distance between $x$ and $${a}$ is $|x - (${a})|$.`, `Der Abstand zwischen $x$ und $${a}$ ist $|x - (${a})|$.`),
    solution: [
      { math: `|x - (${a})| = |${lin(1, -a)}|`, note: tx(`The distance between $x$ and $${a}$.`, `Der Abstand zwischen $x$ und $${a}$.`) },
      { math: right, note: tx(`It should be ${phrase[kind][0]}.`, `Er soll ${phrase[kind][1]} sein.`) },
    ],
    mistakes,
  };
}

/** Level 3 practice: absolute values (equations, inequalities, distances) and root equations. */
export function generate3(rng: Rng): Exercise {
  for (let tries = 0; tries < 80; tries++) {
    const r = rng.next();
    const ex = r < 0.34 ? absTask(rng) : r < 0.5 ? absIneqTask(rng) : r < 0.78 ? rootTask(rng) : r < 0.89 ? probeTask(rng) : distanceTask(rng);
    if (ex) return ex;
  }
  return absSimpleExercise(3, 5);
}

// ---------------------------------------------------------------------------
// Lesson

const distanceIntro: Frame[] = [
  {
    math: "|-4| = 4 \\quad |4| = 4",
    note: tx("The absolute value $|a|$ is the distance of $a$ from $0$. Distances are never negative.", "Der Betrag $|a|$ ist der Abstand der Zahl $a$ von $0$. Abstände sind nie negativ."),
  },
  {
    math: "|7 - 2| = 5 \\quad |2 - 7| = 5",
    note: tx("$|a - b|$ is the distance between $a$ and $b$. The order doesn't matter.", "$|a - b|$ ist der Abstand zwischen $a$ und $b$. Die Reihenfolge ist egal."),
  },
  ...absSimpleFrames({ a: 3, r: 5 }),
];

const casesIntro = absCasesFrames(
  { u: 3, b: -2, w: 1, d: 6 },
  "x",
  tx(
    "Now there's an $x$ on the right, so the distance picture alone doesn't help. Split into two cases (case analysis): is the inside $3x - 2$ positive or negative?",
    "Jetzt steht rechts ein $x$, da hilft das Abstandsbild allein nicht. Unterscheide zwei Fälle (Fallunterscheidung): Ist das Innere $3x - 2$ positiv oder negativ?",
  ),
);

const ineqIntro: Frame[] = [
  ...absIneqFrames({ a: 2, r: 3, rel: "<" }),
  {
    math: tx('"Case 1:" \\; x \\ge 2 \\quad \\quad x - 2 < 3 \\;\\Rightarrow\\; x < 5', '"1. Fall:" \\; x \\ge 2 \\quad \\quad x - 2 < 3 \\;\\Rightarrow\\; x < 5'),
    note: tx(
      "The same with case analysis. Case 1: the inside is $\\ge 0$, so the bars just go. Together with the condition: $2 \\le x < 5$.",
      "Dasselbe mit Fallunterscheidung. 1. Fall: Das Innere ist $\\ge 0$, die Striche fallen weg. Zusammen mit der Bedingung: $2 \\le x < 5$.",
    ),
  },
  {
    math: tx('"Case 2:" \\; x < 2 \\quad \\quad -(x - 2) < 3 \\;\\Rightarrow\\; x > -1', '"2. Fall:" \\; x < 2 \\quad \\quad -(x - 2) < 3 \\;\\Rightarrow\\; x > -1'),
    note: tx(
      "Case 2: the inside is negative, so a minus goes in front: $-x + 2 < 3$ gives $x > -1$. Together with $x < 2$: $-1 < x < 2$.",
      "2. Fall: Das Innere ist negativ, also kommt ein Minus davor: $-x + 2 < 3$ ergibt $x > -1$. Zusammen mit $x < 2$: $-1 < x < 2$.",
    ),
  },
  { math: "-1 < x < 5", note: tx("Both cases together, $2 \\le x < 5$ and $-1 < x < 2$: the same stretch from $-1$ to $5$.", "Beide Fälle zusammen, $2 \\le x < 5$ und $-1 < x < 2$: dieselbe Strecke von $-1$ bis $5$.") },
  ...absIneqFrames({ a: 2, r: 3, rel: ">" }).map((f, i) =>
    i === 0 ? { ...f, note: tx("And the opposite: more than $3$ away from $2$.", "Und das Gegenteil: mehr als $3$ von $2$ entfernt.") } : f,
  ),
];

const rootIntro = rootQuadFrames({ u: 1, a: 5, b: 1 });

const noSolutionFrames: Frame[] = [
  {
    math: "\\sqrt{x + 3} = -2",
    note: tx("A square root is never negative. So: no solution, $L = \\{ \\}$. No calculation needed!", "Eine Quadratwurzel ist nie negativ. Also: keine Lösung, $L = \\{ \\}$. Ganz ohne Rechnung!"),
  },
  { math: "|2x - 1| = -3", note: tx("An absolute value is a distance, never negative: $L = \\{ \\}$.", "Ein Betrag ist ein Abstand, nie negativ: $L = \\{ \\}$.") },
  { math: "|x + 1| < 0", note: tx("A distance smaller than $0$? Never: $L = \\{ \\}$.", "Ein Abstand kleiner als $0$? Niemals: $L = \\{ \\}$.") },
  { math: "|x - 5| \\ge 0", note: tx("A distance is always at least $0$, so this holds for every number: $L =$ ℝ.", "Ein Abstand ist immer mindestens $0$, das gilt also für jede Zahl: $L =$ ℝ.") },
  {
    math: "\\sqrt{x} = x - 6 \\;\\Rightarrow\\; x_1 = 9 \\quad x_2 = 4",
    note: tx(
      "With an $x$ on the other side you can't tell at a glance. Squaring gives $9$ and $4$, but only $9$ passes the check: $\\sqrt{4} = 2$, while $4 - 6 = -2$.",
      "Steht auf der anderen Seite ein $x$, siehst du es nicht auf einen Blick. Quadrieren liefert $9$ und $4$, aber nur $9$ besteht die Probe: $\\sqrt{4} = 2$, aber $4 - 6 = -2$.",
    ),
  },
];

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Absolute value = distance", "Betrag = Abstand"),
      body: tx(
        "$|x - a|$ is the distance between $x$ and $a$. At distance $r$ there are two numbers: $a - r$ and $a + r$.",
        "$|x - a|$ ist der Abstand zwischen $x$ und $a$. Im Abstand $r$ liegen zwei Zahlen: $a - r$ und $a + r$.",
      ),
      examples: [tx('|x - 3| = 5 \\Rightarrow x = -2 \\quad "or" \\quad x = 8', '|x - 3| = 5 \\Rightarrow x = -2 \\quad "oder" \\quad x = 8'), "|x + 2| = |x - (-2)|"],
      tone: "rule",
    },
    {
      title: tx("Case analysis", "Fallunterscheidung"),
      body: tx(
        "Case 1: inside $\\ge 0$, drop the bars. Case 2: inside $< 0$, write a minus in front of the bracket. Keep only results that fit their case.",
        "1. Fall: Inneres $\\ge 0$, Striche weglassen. 2. Fall: Inneres $< 0$, ein Minus vor die Klammer. Behalte nur Ergebnisse, die zu ihrem Fall passen.",
      ),
      examples: [tx('|3x - 2| = x + 6', '|3x - 2| = x + 6'), tx('"Case 1:" \\; 3x - 2 = x + 6', '"1. Fall:" \\; 3x - 2 = x + 6'), tx('"Case 2:" \\; -(3x - 2) = x + 6', '"2. Fall:" \\; -(3x - 2) = x + 6')],
      tone: "rule",
    },
    {
      title: tx("Absolute value inequalities", "Betragsungleichungen"),
      body: tx("Less than $r$: between the two boundaries. More than $r$: everything outside.", "Kleiner als $r$: zwischen den beiden Grenzen. Größer als $r$: alles außerhalb."),
      examples: ["|x - 2| < 3 \\Leftrightarrow -1 < x < 5", tx('|x - 2| > 3 \\Leftrightarrow x < -1 \\; "or" \\; x > 5', '|x - 2| > 3 \\Leftrightarrow x < -1 \\; "oder" \\; x > 5')],
      tone: "rule",
    },
    {
      title: tx("Root equations", "Wurzelgleichungen"),
      body: tx(
        "Get the root on its own, square both sides (binomial formula on the other side!), solve, then check every candidate.",
        "Bring die Wurzel allein auf eine Seite, quadriere beide Seiten (auf der anderen Seite binomische Formel!), löse und prüfe dann jeden Kandidaten.",
      ),
      examples: ["\\sqrt{x + 5} = x - 1 \\quad | \\, (\\;)^2", "x + 5 = x^2 - 2x + 1"],
      tone: "rule",
    },
    {
      title: tx("False solutions", "Scheinlösungen"),
      body: tx(
        "Squaring can add solutions that don't work in the original equation. Only the check (Probe) tells you. A root is never negative.",
        "Quadrieren kann Lösungen hinzufügen, die in der ursprünglichen Gleichung nicht passen. Nur die Probe verrät es. Eine Wurzel ist nie negativ.",
      ),
      examples: ["x = -1: \\; \\sqrt{4} = 2 \\ne -2"],
      tone: "warning",
    },
    {
      title: tx("One look can be enough", "Ein Blick kann reichen"),
      body: tx("An absolute value or a square root that should be negative: no solution.", "Ein Betrag oder eine Quadratwurzel, die negativ sein soll: keine Lösung."),
      examples: ["|2x - 1| = -3 \\Rightarrow L = \\{ \\}", "\\sqrt{x + 3} = -2 \\Rightarrow L = \\{ \\}"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The absolute value is a distance", "Der Betrag ist ein Abstand"),
      blob: tx("Bars around a number? Think distance, not sign!", "Striche um eine Zahl? Denk an Abstand, nicht an Vorzeichen!"),
      body: tx(
        "$|x - 3| = 5$ asks: which numbers are $5$ away from $3$ on the number line? There are two, one on each side.",
        "$|x - 3| = 5$ fragt: Welche Zahlen liegen an der Zahlengeraden $5$ von $3$ entfernt? Es gibt zwei, auf jeder Seite eine.",
      ),
      visual: { component: DistancePicture as ComponentType<Record<string, unknown>>, props: { center: 3, radius: 5, rel: "=", from: -4, to: 10 } },
      frames: distanceIntro,
    },
    {
      type: "widget",
      title: tx("Distance on the number line", "Abstand an der Zahlengeraden"),
      blob: tx("Drag x around. When is the distance just right?", "Zieh x hin und her. Wann passt der Abstand genau?"),
      body: tx(
        "$|x - a|$ measures how far $x$ is from the centre $a$. Change the centre and the distance, switch between equal, less and greater, and watch the solution set.",
        "$|x - a|$ misst, wie weit $x$ von der Mitte $a$ entfernt ist. Verändere Mitte und Abstand, wechsle zwischen gleich, kleiner und größer und beobachte die Lösungsmenge.",
      ),
      widget: DistanceLab,
    },
    {
      type: "check",
      blob: tx("Your turn! Careful with the plus inside.", "Jetzt du! Vorsicht mit dem Plus in den Strichen."),
      exercise: absSimpleExercise(-2, 7),
    },
    {
      type: "explain",
      title: tx("Case analysis", "Fallunterscheidung"),
      blob: tx("Two cases, two mini equations. Then check which results fit!", "Zwei Fälle, zwei kleine Gleichungen. Dann prüfen, welche Ergebnisse passen!"),
      body: tx(
        "Is the inside of the bars positive, the bars change nothing. Is it negative, they flip its sign. Solve both cases, and keep only results that fit their case.",
        "Ist das Innere der Striche positiv, ändern die Striche nichts. Ist es negativ, drehen sie sein Vorzeichen um. Löse beide Fälle und behalte nur Ergebnisse, die zu ihrem Fall passen.",
      ),
      frames: casesIntro,
    },
    {
      type: "check",
      blob: tx("This one has a trap: one case result doesn't fit.", "Hier steckt eine Falle drin: Ein Ergebnis passt nicht zu seinem Fall."),
      exercise: absCasesExercise({ u: 1, b: -4, w: 2, d: 1 }),
    },
    {
      type: "explain",
      title: tx("Absolute value inequalities", "Betragsungleichungen"),
      blob: tx("Close to the centre or far away? That's the whole question.", "Nah an der Mitte oder weit weg? Das ist die ganze Frage."),
      body: tx(
        "$|x - 2| < 3$: all numbers less than $3$ away from $2$, a stretch between two boundaries. $|x - 2| > 3$: everything outside that stretch.",
        "$|x - 2| < 3$: alle Zahlen, die weniger als $3$ von $2$ entfernt sind, eine Strecke zwischen zwei Grenzen. $|x - 2| > 3$: alles außerhalb dieser Strecke.",
      ),
      visual: { component: DistancePicture as ComponentType<Record<string, unknown>>, props: { center: 2, radius: 3, rel: "<", from: -4, to: 8 } },
      frames: ineqIntro,
    },
    {
      type: "check",
      blob: tx("At most 4 away from what, exactly?", "Höchstens 4 entfernt, aber von welcher Zahl?"),
      exercise: absIneqExercise({ a: -1, r: 4, rel: "≤" }, [2, 0, 3, 1]),
    },
    {
      type: "explain",
      title: tx("Root equations and the check", "Wurzelgleichungen und die Probe"),
      blob: tx("Squaring is powerful, but it can sneak in false solutions!", "Quadrieren ist stark, aber es kann Scheinlösungen einschmuggeln!"),
      body: tx(
        "Square both sides to remove the root. That can create candidates that don't solve the original equation (false solutions). So the check is part of the solution, not an extra.",
        "Quadriere beide Seiten, um die Wurzel loszuwerden. Dabei können Kandidaten entstehen, die die ursprüngliche Gleichung nicht lösen (Scheinlösungen). Die Probe gehört deshalb zur Lösung, sie ist kein Extra.",
      ),
      frames: rootIntro,
    },
    {
      type: "widget",
      title: tx("Where false solutions come from", "Woher Scheinlösungen kommen"),
      blob: tx("Turn on the mirror line and find the red point!", "Schalte die Spiegelgerade ein und finde den roten Punkt!"),
      body: tx(
        "After squaring, $\\sqrt{x + a} = x - b$ and $\\sqrt{x + a} = -(x - b)$ look the same. The real solution is where the curve meets the line; a false one is where it meets the mirrored line.",
        "Nach dem Quadrieren sehen $\\sqrt{x + a} = x - b$ und $\\sqrt{x + a} = -(x - b)$ gleich aus. Die echte Lösung liegt dort, wo die Kurve die Gerade trifft, eine Scheinlösung dort, wo sie die gespiegelte Gerade trifft.",
      ),
      widget: RootLab,
    },
    {
      type: "explain",
      title: tx("When one look is enough", "Wenn ein Blick reicht"),
      blob: tx("Expert trick: sometimes you can see the answer without calculating.", "Profi-Trick: Manchmal siehst du die Lösung, ohne zu rechnen."),
      body: tx(
        "Absolute values and square roots are never negative. If one of them is supposed to be negative, there's no solution.",
        "Beträge und Quadratwurzeln sind nie negativ. Soll einer davon negativ sein, gibt es keine Lösung.",
      ),
      frames: noSolutionFrames,
    },
    {
      type: "check",
      blob: tx("Last one: root alone first, then square, then check!", "Die letzte: erst die Wurzel allein, dann quadrieren, dann Probe!"),
      exercise: rootQuadExercise({ u: 2, a: 1, b: 1 }, 1),
    },
  ],
};
