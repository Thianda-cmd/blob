"use client";

import type { ComponentType } from "react";
import { tx, txMap, type Text } from "@/i18n/text";
import { value as qvalue } from "@/learn/engine/frac";
import { lcm, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { NumberLine } from "@/learn/visuals/NumberLine";
import {
  cancelFrames,
  lead,
  decFrames,
  decMistakes,
  decSrc,
  fracCheck,
  fracFrames,
  fracMistakes,
  fracSrc,
  intervalText,
  linSolve,
  mistakeBag,
  piece,
  ratioFrames,
  ratioMistakes,
  ratioSrc,
  ratioValue,
  setBuilder,
  type FracSpec,
  type Ratio,
} from "./build2";
import { tierTask } from "./level1";
import { eqMistakes, eqSrc, equation, group, inner, mapText, REL_FLIP, REL_TEXT, smoothFracExits, solveEq, term, type Eq, type Rel } from "./model";
import { BothSidesLab, SolutionSetLab } from "./widgets2";

// ---------------------------------------------------------------------------
// Level 2 (Klasse 8): equations with fractions and decimals, equations with no
// solution or every number as a solution, ratio equations, and solution sets of
// inequalities (number line, set notation, intervals).

type IneqRel = Exclude<Rel, "=">;
const RELS: IneqRel[] = ["<", ">", "≤", "≥"];
const SOLVE = tx("Solve the equation", "Löse die Gleichung");
const stripKeys = (t: Text) => mapText(t, (s) => s.replace(/#[A-Za-z0-9_-]+/g, ""));

/** The solution set as a last frame of an inequality: set notation and the interval in words. */
function setFrame(v: string, rel: IneqRel, b: number): Frame {
  const closed = rel === "≤" || rel === "≥";
  const interval = intervalText(rel, b);
  return {
    math: setBuilder(v, rel, b),
    note: txMap(
      (t, l) =>
        `${t("As a solution set. On the number line:", "Als Lösungsmenge. An der Zahlengeraden:")} ${closed ? t("a filled dot", "ein ausgefüllter Punkt") : t("an open circle", "ein offener Kreis")} ${t(`at $${b}$, shaded to the`, `bei $${b}$, markiert nach`)} ${rel === ">" || rel === "≥" ? t("right", "rechts") : t("left", "links")}. ${t("As an interval:", "Als Intervall:")} ${typeof interval === "string" ? interval : interval[l]}`,
    ),
  };
}

// ---------------------------------------------------------------------------
// Exercises from a fixed spec (used by the lesson checks and the generator).

function fracExercise(s: FracSpec, v: string, hint: Text): Exercise {
  const res = fracFrames(s, v, { check: s.rel === "=" });
  const value = qvalue(res.value);
  const frames = s.rel === "=" ? res.frames : [...res.frames, setFrame(v, res.rel as IneqRel, value)];
  return {
    instruction: s.rel === "=" ? SOLVE : tx("Solve the inequality", "Löse die Ungleichung"),
    math: fracSrc(s, v, false),
    answer: s.rel === "=" ? { kind: "solutions", variable: v, values: [value] } : { kind: "inequality", variable: v, op: res.rel as IneqRel, value },
    hint,
    solution: frames,
    mistakes: fracMistakes(s, v, { value: res.value, rel: res.rel }, eqMistakes(res.cleared, v, res.value, res.rel)),
  };
}

function decExercise(e: Eq, v: string): Exercise {
  const res = decFrames(e, v);
  return {
    instruction: SOLVE,
    math: stripKeys(decSrc(e, v)),
    answer: { kind: "solutions", variable: v, values: [qvalue(res.value)] },
    hint: tx("Multiply every term by $10$. Then the decimals are gone.", "Multipliziere jeden Term mit $10$. Dann sind die Kommazahlen weg."),
    solution: res.frames,
    mistakes: decMistakes(e, v, { value: res.value, rel: "=" }, eqMistakes(e, v, res.value, "=")),
  };
}

type SetKind = "none" | "all" | "one";

/** "Find the solution set": no solution, every number, or exactly one. Multiple choice. */
function setExercise(e: Eq, v: string, order: number[]): Exercise | null {
  const run = linSolve(e.L, e.R, "=");
  let kind: SetKind = "one";
  let frames: Frame[];
  let left = 0;
  let right = 0;
  if (run) {
    const x0 = qvalue(run.value);
    if (!Number.isInteger(x0) || x0 === 0) return null;
    const solved = solveEq(e, v);
    frames = [...solved.frames, { math: `L = \\{ ${lead(x0)} \\}`, note: tx(`Exactly one solution: $L = \\{ ${lead(x0)} \\}$.`, `Genau eine Lösung: $L = \\{ ${lead(x0)} \\}$.`) }];
  } else {
    const c = cancelFrames(e, v);
    kind = c.kind;
    frames = c.frames;
    left = qvalue(c.left);
    right = qvalue(c.right);
  }
  const x0 = run ? qvalue(run.value) : 0;
  const extra = kind === "one" ? -x0 : kind === "none" ? right - left : left;
  if (extra === 0) return null;
  const NONE = "$L = \\{ \\}$";
  const ALL = "$L =$ ℚ";
  const ZERO = "$L = \\{ 0 \\}$";
  const one = (n: number) => `$L = \\{ ${lead(n)} \\}$`;
  const base = kind === "one" ? [NONE, ALL, one(x0), one(extra)] : [NONE, ALL, ZERO, one(extra)];
  if (new Set(base).size < 4) return null;
  const options = order.map((i) => base[i]);
  const correct = options.indexOf(kind === "none" ? NONE : kind === "all" ? ALL : one(x0));
  const st = `$${left} = ${right}$`;
  const say: Record<string, { title: Text; say: Text; close?: boolean }> = {};
  if (kind === "none") {
    say[ALL] = {
      title: tx("That statement is false", "Die Aussage ist falsch"),
      say: tx(`What's left, ${st}, is **false**, whatever $${v}$ is. A false statement means: no solution at all.`, `Übrig bleibt ${st}, und das ist **falsch**, egal, was $${v}$ ist. Eine falsche Aussage heißt: gar keine Lösung.`),
    };
    say[ZERO] = {
      title: tx(`${v} vanished, not ${v} = 0`, `${v} verschwunden, nicht ${v} = 0`),
      say: tx(
        `Ooh, classic trap! The $${v}$ disappeared, but that doesn't mean $${v} = 0$. Look at what's left: ${st}. Can that ever be true?`,
        `Die klassische Falle! Das $${v}$ ist verschwunden, aber das heißt nicht $${v} = 0$. Schau, was übrig bleibt: ${st}. Kann das je stimmen?`,
      ),
    };
    say[one(extra)] = {
      title: tx(`0 · ${v} can't be ${String(extra).replace("-", "−")}`, `0 · ${v} kann nicht ${String(extra).replace("-", "−")} sein`),
      say: tx(
        `Careful: what's left is $0 \\cdot ${v} = ${extra}$. Zero times any number is $0$, never $${extra}$. So no number fits.`,
        `Vorsicht: Übrig bleibt $0 \\cdot ${v} = ${extra}$. Null mal irgendeine Zahl ist $0$, nie $${extra}$. Also passt keine Zahl.`,
      ),
    };
  } else if (kind === "all") {
    say[NONE] = {
      title: tx("That statement is true", "Die Aussage ist wahr"),
      say: tx(
        `The $${v}$ is gone, but what's left, ${st}, is **true**, whatever $${v}$ is. A true statement means: **every** number is a solution.`,
        `Das $${v}$ ist weg, aber was übrig bleibt, ${st}, ist **wahr**, egal, was $${v}$ ist. Eine wahre Aussage heißt: **Jede** Zahl ist eine Lösung.`,
      ),
    };
    say[ZERO] = {
      title: tx(`${v} vanished, not ${v} = 0`, `${v} verschwunden, nicht ${v} = 0`),
      say: tx(
        `Ooh, classic trap! The $${v}$ disappeared, but that doesn't mean $${v} = 0$. What's left, ${st}, is true for **every** $${v}$.`,
        `Die klassische Falle! Das $${v}$ ist verschwunden, aber das heißt nicht $${v} = 0$. Was übrig bleibt, ${st}, stimmt für **jedes** $${v}$.`,
      ),
    };
    say[one(extra)] = {
      title: tx(`Not a value of ${v}`, `Kein Wert für ${v}`),
      say: tx(
        `$${extra}$ is a number from the equation, not a value of $${v}$. After the $${v}$-terms cancel, ${st} is left, and that's true for every $${v}$.`,
        `$${extra}$ ist eine Zahl aus der Gleichung, kein Wert für $${v}$. Nachdem sich die $${v}$-Terme aufheben, bleibt ${st}, und das stimmt für jedes $${v}$.`,
      ),
    };
  } else {
    const cancel = {
      title: tx(`The ${v}-terms don't cancel`, `Die ${v}-Terme heben sich nicht auf`),
      say: tx(
        `Look again: after expanding, the $${v}$-terms on the two sides are different, so they don't cancel. Solve it like a normal equation.`,
        `Schau noch mal hin: Nach dem Auflösen sind die $${v}$-Terme auf beiden Seiten verschieden, sie heben sich also nicht auf. Löse ganz normal.`,
      ),
    };
    say[NONE] = cancel;
    say[ALL] = cancel;
    say[one(extra)] = {
      title: tx("Sign slip", "Vorzeichenfehler"),
      say: tx(`Nearly! Put $${v} = ${extra}$ back in: it doesn't work. Check your signs.`, `Fast! Setz $${v} = ${extra}$ ein: Das geht nicht auf. Prüf deine Vorzeichen.`),
      close: true,
    };
  }
  const mistakes: Mistake[] = options
    .map((o, i): Mistake | null => (i === correct || !say[o] ? null : { when: { kind: "choice", options, correct: i }, ...say[o] }))
    .filter((m): m is Mistake => m !== null);
  return {
    instruction: tx("Find the solution set", "Bestimme die Lösungsmenge"),
    math: eqSrc(e, v, false),
    answer: { kind: "choice", options, correct },
    hint: tx(
      `Simplify both sides. If the $${v}$-terms cancel, look at what's left: true or false?`,
      `Vereinfache beide Seiten. Wenn sich die $${v}$-Terme aufheben, schau, was übrig bleibt: wahr oder falsch?`,
    ),
    solution: frames,
    mistakes,
  };
}

function ratioExercise(r: Ratio, v: string): Exercise {
  const x = ratioValue(r);
  return {
    instruction: tx("Solve the ratio equation", "Löse die Verhältnisgleichung"),
    math: ratioSrc(r, v, false),
    answer: { kind: "solutions", variable: v, values: [x] },
    hint:
      r.form === "colon"
        ? tx("Outer terms times outer terms equals inner terms times inner terms.", "Außenglieder mal Außenglieder ist gleich Innenglieder mal Innenglieder.")
        : tx("Multiply crosswise: each numerator times the other denominator.", "Multipliziere über Kreuz: jeden Zähler mit dem anderen Nenner."),
    solution: ratioFrames(r, v),
    mistakes: ratioMistakes(r, v),
  };
}

/** (x + a)/p = (x + b)/q: crosswise to q(x + a) = p(x + b). */
function crossExercise(a: number, p: number, b: number, q: number, v: string): Exercise | null {
  const s: FracSpec = { L: [piece("G", 1, 1, a, p)], R: [piece("H", 1, 1, b, q)], rel: "=" };
  const e = equation([group("G", q, [inner(1, 1), inner(a)])], "=", [group("H", p, [inner(1, 1), inner(b)])]);
  const run = linSolve(e.L, e.R, "=");
  if (!run || !Number.isInteger(qvalue(run.value))) return null;
  const first: Frame[] = [
    { math: fracSrc(s, v), note: tx("Two fractions are equal: multiply crosswise.", "Zwei Brüche sind gleich: Multipliziere über Kreuz.") },
    {
      math: fracSrc(s, v),
      arrows: [
        [`dH`, `vG0`],
        [`dG`, `vH0`],
      ],
      highlight: ["dG", "dH"],
      note: tx(`Each numerator times the **other** denominator. The numerators keep their brackets.`, `Jeder Zähler mal den **anderen** Nenner. Die Zähler bleiben in Klammern.`),
    },
  ];
  const solved = solveEq(e, v, { intro: tx(`Crosswise: $${q}(${v} ${b0(a)}) = ${p}(${v} ${b0(b)})$.`, `Über Kreuz: $${q}(${v} ${b0(a)}) = ${p}(${v} ${b0(b)})$.`) });
  const frames = smoothFracExits([...first, ...solved.frames, fracCheck(s, v, solved.value)]);
  const bag = mistakeBag({ value: run.value, rel: "=" }, v);
  bag.push(
    linSolve([term("", q, 1), term("", a)], [term("", p, 1), term("", b)], "="),
    tx("Numerator without brackets", "Zähler ohne Klammer"),
    tx(
      `Ah, I see what happened! The **whole** numerator gets multiplied: $${q}(${v} ${b0(a)})$, not $${q}${v} ${b0(a)}$. Keep the brackets.`,
      `Ah, ich seh, was passiert ist! Der **ganze** Zähler wird multipliziert: $${q}(${v} ${b0(a)})$, nicht $${q}${v} ${b0(a)}$. Lass die Klammern stehen.`,
    ),
  );
  bag.push(
    linSolve([group("G", p, [inner(1, 1), inner(a)])], [group("H", q, [inner(1, 1), inner(b)])], "="),
    tx("Not crosswise", "Nicht über Kreuz"),
    tx(
      `I think I know what you did: each numerator got its **own** denominator. Crosswise means: the left numerator times the **right** denominator, $${q}(${v} ${b0(a)})$.`,
      `Ich glaub, ich weiß, was du gemacht hast: Jeder Zähler hat seinen **eigenen** Nenner abbekommen. Über Kreuz heißt: linker Zähler mal **rechter** Nenner, $${q}(${v} ${b0(a)})$.`,
    ),
  );
  bag.merge(eqMistakes(e, v, run.value, "="));
  return {
    instruction: tx("Solve the ratio equation", "Löse die Verhältnisgleichung"),
    math: fracSrc(s, v, false),
    answer: { kind: "solutions", variable: v, values: [qvalue(run.value)] },
    hint: tx("Multiply crosswise and keep each numerator in brackets.", "Multipliziere über Kreuz und lass jeden Zähler in Klammern."),
    solution: frames,
    mistakes: bag.out,
  };
}
/** "+ 3", "- 2" */
const b0 = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);

/** An inequality with brackets, solved by the level 1 solver, plus its solution set. */
function bracketIneqExercise(e: Eq, v: string, hint: Text): Exercise {
  const { frames, value, rel } = solveEq(e, v);
  const b = qvalue(value);
  return {
    instruction: tx("Solve the inequality", "Löse die Ungleichung"),
    math: eqSrc(e, v, false),
    answer: { kind: "inequality", variable: v, op: rel as IneqRel, value: b },
    hint,
    solution: [...frames, setFrame(v, rel as IneqRel, b)],
    mistakes: eqMistakes(e, v, value, rel),
  };
}

/** Read the solution set off a number line. */
function lineExercise(at: number, right: boolean, closed: boolean): Exercise {
  const rel: IneqRel = right ? (closed ? "≥" : ">") : closed ? "≤" : "<";
  const order: IneqRel[] = at % 2 === 0 ? ["<", "≤", ">", "≥"] : [">", "≥", "<", "≤"];
  const options = order.map((r) => mapText(setBuilder("x", r, at), (s) => `$${s}$`));
  const correct = order.indexOf(rel);
  const flipDot: IneqRel = { "<": "≤", "≤": "<", ">": "≥", "≥": ">" }[rel] as IneqRel;
  const flipDir: IneqRel = REL_FLIP[rel] as IneqRel;
  const both: IneqRel = REL_FLIP[flipDot] as IneqRel;
  const mistakes: Mistake[] = [
    {
      when: { kind: "choice", options, correct: order.indexOf(flipDot) },
      title: closed ? tx("The dot is filled", "Der Punkt ist ausgefüllt") : tx("The circle is open", "Der Kreis ist offen"),
      say: closed
        ? tx(`Nearly! The dot at $${at}$ is **filled**: $${at}$ itself belongs to the solution. That's $\\le$ or $\\ge$.`, `Fast! Der Punkt bei $${at}$ ist **ausgefüllt**: $${at}$ gehört selbst dazu. Das ist $\\le$ oder $\\ge$.`)
        : tx(`Nearly! The circle at $${at}$ is **open**: $${at}$ itself is not a solution. That's $<$ or $>$.`, `Fast! Der Kreis bei $${at}$ ist **offen**: $${at}$ selbst ist keine Lösung. Das ist $<$ oder $>$.`),
      close: true,
    },
    {
      when: { kind: "choice", options, correct: order.indexOf(flipDir) },
      title: tx("Wrong direction", "Falsche Richtung"),
      say: right
        ? tx(`Look at the shading: it goes to the **right**, towards the bigger numbers. So $x$ is bigger than $${at}$.`, `Schau auf die Markierung: Sie geht nach **rechts**, zu den größeren Zahlen. Also ist $x$ größer als $${at}$.`)
        : tx(`Look at the shading: it goes to the **left**, towards the smaller numbers. So $x$ is smaller than $${at}$.`, `Schau auf die Markierung: Sie geht nach **links**, zu den kleineren Zahlen. Also ist $x$ kleiner als $${at}$.`),
    },
    {
      when: { kind: "choice", options, correct: order.indexOf(both) },
      title: tx("Direction and dot", "Richtung und Punkt"),
      say: tx(
        "Two things to check: the shading shows the direction (right means bigger), and the dot shows whether the boundary is included (filled means yes).",
        "Zwei Dinge prüfen: Die Markierung zeigt die Richtung (rechts heißt größer), und der Punkt zeigt, ob die Grenze dazugehört (ausgefüllt heißt ja).",
      ),
    },
  ];
  return {
    instruction: tx("Which solution set does the number line show?", "Welche Lösungsmenge zeigt die Zahlengerade?"),
    visual: { component: NumberLine as ComponentType<Record<string, unknown>>, props: { from: -6, to: 6, rays: [{ at, dir: right ? "right" : "left", closed }] } },
    answer: { kind: "choice", options, correct },
    hint: tx("Filled dot: the boundary belongs to it. Shading to the right: bigger numbers.", "Ausgefüllter Punkt: Die Grenze gehört dazu. Markierung nach rechts: größere Zahlen."),
    solution: [
      {
        math: `x ${REL_TEXT[rel]} ${at}`,
        note: txMap(
          (t) =>
            `${closed ? t(`Filled dot: $${at}$ belongs to it.`, `Ausgefüllter Punkt: $${at}$ gehört dazu.`) : t(`Open circle: $${at}$ itself doesn't belong to it.`, `Offener Kreis: $${at}$ selbst gehört nicht dazu.`)} ${right ? t("Shaded to the right: the bigger numbers.", "Nach rechts markiert: die größeren Zahlen.") : t("Shaded to the left: the smaller numbers.", "Nach links markiert: die kleineren Zahlen.")}`,
        ),
      },
      setFrame("x", rel, at),
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generators

const DEN_PAIRS: [number, number][] = [
  [2, 3],
  [2, 4],
  [3, 4],
  [2, 5],
  [3, 6],
  [4, 6],
  [2, 6],
  [4, 3],
  [3, 2],
  [6, 4],
  [5, 2],
];

function fracTask(rng: Rng): Exercise | null {
  const v = rng.pick(["x", "x", "x", "y", "a"]);
  const [p, q] = rng.pick(DEN_PAIRS);
  const x0 = rng.nonZero(-8, 12);
  const form = rng.pick(["two", "two", "mixed", "minus"] as const);
  const ok = (n: number) => n !== 0 && Math.abs(n) <= 12;
  let s: FracSpec;
  if (form === "two") {
    const u1 = rng.pick([1, 1, 1, 2, 3]);
    const u2 = rng.pick([1, 1, 2]);
    const a1 = p * rng.int(-3, 5) - u1 * x0;
    const a2 = q * rng.int(-3, 5) - u2 * x0;
    if (!ok(a1) || !ok(a2)) return null;
    const sg = rng.sign();
    const c = (u1 * x0 + a1) / p + (sg * (u2 * x0 + a2)) / q;
    if (c === 0) return null;
    s = { L: [piece("G", 1, u1, a1, p), piece("H", sg, u2, a2, q)], R: [piece("C", 1, 0, c)], rel: "=" };
  } else if (form === "mixed") {
    if (p === q) return null;
    const x = lcm(p, q) * rng.nonZero(-2, 2);
    const a = p * rng.int(-3, 4) - x;
    const c = (x + a) / p - x / q;
    if (!ok(a) || c === 0) return null;
    s = { L: [piece("G", 1, 1, a, p)], R: [piece("H", 1, 1, 0, q), piece("C", 1, 0, c)], rel: "=" };
  } else {
    const u = rng.pick([1, 2, 3]);
    const a = p * rng.int(-3, 5) - u * x0;
    const b = q * rng.int(-3, 5) - x0;
    if (!ok(a) || !ok(b)) return null;
    const c = (u * x0 + a) / p - (x0 + b) / q;
    if (c === 0) return null;
    s = { L: [piece("G", 1, u, a, p), piece("C", -1, 0, c)], R: [piece("H", 1, 1, b, q)], rel: "=" };
  }
  const k = lcm(p, q);
  const ex = fracExercise(
    s,
    v,
    tx(`Multiply every term by $${k}$, the common denominator. Each numerator goes in brackets.`, `Multipliziere jeden Term mit $${k}$, dem Hauptnenner. Jeder Zähler kommt in Klammern.`),
  );
  const a = ex.answer;
  return a.kind === "solutions" && Number.isInteger(a.values[0]) && a.values[0] !== 0 && Math.abs(a.values[0]) <= 20 ? ex : null;
}

function decTask(rng: Rng): Exercise | null {
  const v = rng.pick(["x", "x", "x", "y"]);
  const A = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 11, 13]);
  const C = rng.int(1, 9);
  if (A === C) return null;
  const x0 = rng.nonZero(-6, 10);
  const B = rng.chance(0.35) ? 10 * rng.nonZero(-4, 4) : rng.nonZero(-45, 45);
  const D = (A - C) * x0 + B;
  if (D === 0 || Math.abs(D) > 90 || D === B) return null;
  const L = rng.chance(0.25) ? [term("B", B), term("A", A, 1)] : [term("A", A, 1), term("B", B)];
  const R = rng.chance(0.3) ? [term("D", D), term("C", C, 1)] : [term("C", C, 1), term("D", D)];
  return decExercise(equation(L, "=", R), v);
}

function setTask(rng: Rng): Exercise | null {
  const v = "x";
  const kind = rng.pick(["none", "none", "all", "all", "one"] as const);
  const form = rng.pick(["k1", "k2", "k3"] as const);
  const delta = kind === "none" ? rng.nonZero(-6, 6) : 0;
  const x0 = rng.nonZero(-6, 8);
  let e: Eq;
  if (form === "k1") {
    // k(x + p) + r = kx + s
    const k = rng.int(2, 5);
    const p = rng.nonZero(-6, 6);
    const r = rng.int(-9, 9);
    const left = k * p + r;
    const L = r ? [group("G", k, [inner(1, 1), inner(p)]), term("E", r)] : [group("G", k, [inner(1, 1), inner(p)])];
    if (kind === "one") {
      const c = k + rng.pick([-1, 1]);
      const s = (k - c) * x0 + left;
      if (s === 0 || c === 0) return null;
      e = equation(L, "=", [term("C", c, 1), term("D", s)]);
    } else {
      const s = left + delta;
      e = equation(L, "=", s ? [term("C", k, 1), term("D", s)] : [term("C", k, 1)]);
    }
  } else if (form === "k2") {
    // k(x + p) − mx = (k − m)x + s
    const k = rng.int(3, 6);
    const m = rng.int(1, k - 1);
    const p = rng.nonZero(-5, 5);
    const left = k * p;
    const L = [group("G", k, [inner(1, 1), inner(p)]), term("M", -m, 1)];
    if (kind === "one") {
      const c = k - m + 1;
      const s = (k - m - c) * x0 + left;
      if (s === 0) return null;
      e = equation(L, "=", [term("C", c, 1), term("D", s)]);
    } else {
      const s = left + delta;
      e = equation(L, "=", s ? [term("C", k - m, 1), term("D", s)] : [term("C", k - m, 1)]);
    }
  } else {
    // ux + a − (wx + b) = (u − w)x + s
    const w = rng.int(1, 4);
    const u = w + rng.int(1, 4);
    const a = rng.nonZero(-9, 9);
    const b = rng.nonZero(-9, 9);
    const left = a - b;
    const L = [term("U", u, 1), term("A", a), group("G", -1, [inner(w, 1), inner(b)])];
    if (kind === "one") {
      const c = u - w + 1;
      const s = (u - w - c) * x0 + left;
      if (s === 0) return null;
      e = equation(L, "=", [term("C", c, 1), term("D", s)]);
    } else {
      const s = left + delta;
      e = equation(L, "=", s ? [term("C", u - w, 1), term("D", s)] : [term("C", u - w, 1)]);
    }
  }
  return setExercise(e, v, rng.shuffle([0, 1, 2, 3]));
}

function ratioTask(rng: Rng): Exercise | null {
  const v = rng.pick(["x", "x", "x", "y"]);
  if (rng.chance(0.25)) {
    const [p, q] = rng.pick(DEN_PAIRS.filter(([a, b]) => a !== b));
    const m = rng.nonZero(-3, 4);
    const x0 = rng.nonZero(-8, 10);
    const a = p * m - x0;
    const b = q * m - x0;
    if (!a || !b || a === b || Math.abs(a) > 12 || Math.abs(b) > 12) return null;
    return crossExercise(a, p, b, q, v);
  }
  const [a, b] = rng.pick([
    [1, 2],
    [2, 3],
    [3, 4],
    [2, 5],
    [3, 5],
    [1, 3],
    [1, 4],
    [4, 5],
    [3, 2],
    [5, 3],
    [4, 3],
  ]);
  const m = rng.int(1, 6);
  const n = rng.int(2, 9);
  if (m === n) return null;
  const t: (number | null)[] = [a * m, b * m, a * n, b * n];
  if (t.some((x) => (x as number) > 60)) return null;
  const pos = rng.int(0, 3);
  t[pos] = null;
  return ratioExercise({ t, form: rng.chance(0.55) ? "colon" : "frac" }, v);
}

function ineqTask(rng: Rng): Exercise | null {
  const v = rng.pick(["x", "x", "x", "y"]);
  const rel = rng.pick(RELS);
  const x0 = rng.int(-6, 9);
  const form = rng.pick(["bracket", "bracket", "frac", "fracBin"] as const);
  if (form === "bracket") {
    const k = rng.chance(0.3) ? -rng.int(2, 3) : rng.int(2, 5);
    const m = rng.int(1, 6);
    if (m === k) return null;
    const p = rng.nonZero(-6, 6);
    const r = rng.int(-8, 8);
    const s = k * (x0 + p) + r - m * x0;
    const L = r ? [group("G", k, [inner(1, 1), inner(p)]), term("E", r)] : [group("G", k, [inner(1, 1), inner(p)])];
    const R = s ? [term("C", m, 1), term("D", s)] : [term("C", m, 1)];
    return bracketIneqExercise(
      equation(L, rel, R),
      v,
      tx(`Expand, then collect the $${v}$-terms on the left. Dividing by a negative number flips the sign.`, `Löse die Klammer auf und bring die $${v}$-Terme nach links. Beim Teilen durch eine negative Zahl dreht sich das Zeichen um.`),
    );
  }
  const [p, q] = rng.pick(DEN_PAIRS.filter(([a, b]) => a !== b));
  let s: FracSpec;
  if (form === "frac") {
    // x/p + a ≷ x/q + b, x0 a multiple of both denominators
    const x = lcm(p, q) * rng.nonZero(-2, 2);
    const a = rng.int(-6, 6);
    const b = x / p + a - x / q;
    s = { L: a ? [piece("G", 1, 1, 0, p), piece("A", 1, 0, a)] : [piece("G", 1, 1, 0, p)], R: b ? [piece("H", 1, 1, 0, q), piece("B", 1, 0, b)] : [piece("H", 1, 1, 0, q)], rel };
  } else {
    // (x + a)/p ≷ x + b
    const m = rng.int(-3, 4);
    const a = p * m - x0;
    const b = m - x0;
    if (!a || !b || Math.abs(a) > 12) return null;
    s = { L: [piece("G", 1, 1, a, p)], R: [piece("H", 1, 1, 0, 1), piece("B", 1, 0, b)], rel };
  }
  const k = [...s.L, ...s.R].reduce((acc, pc) => lcm(acc, pc.den), 1);
  const ex = fracExercise(
    s,
    v,
    tx(`Multiply every term by $${k}$. That's positive, so the sign stays. Watch out at the end!`, `Multipliziere jeden Term mit $${k}$. Das ist positiv, also bleibt das Zeichen. Pass am Ende auf!`),
  );
  const a = ex.answer;
  return a.kind === "inequality" && Number.isInteger(a.value) && Math.abs(a.value) <= 20 ? ex : null;
}

/** Level 2 practice: fractions and decimals, solution sets, ratios, inequalities. */
export function generate2(rng: Rng): Exercise {
  for (let tries = 0; tries < 60; tries++) {
    const r = rng.next();
    const ex =
      r < 0.22
        ? fracTask(rng)
        : r < 0.33
          ? decTask(rng)
          : r < 0.38
            ? tierTask(3, rng, ["frac", "fracTwo"])
            : r < 0.54
              ? setTask(rng)
              : r < 0.69
                ? ratioTask(rng)
                : r < 0.88
                  ? ineqTask(rng)
                  : lineExercise(rng.int(-5, 5), rng.chance(0.5), rng.chance(0.5));
    if (ex) return ex;
  }
  return ratioExercise({ t: [null, 4, 6, 8], form: "colon" }, "x");
}

// ---------------------------------------------------------------------------
// Lesson

const fractionIntro = fracFrames({ L: [piece("G", 1, 1, 1, 2), piece("H", -1, 1, -2, 3)], R: [piece("C", 1, 0, 2)], rel: "=" }, "x", { check: true, maxEm: 18 }).frames;

const decimalIntro = decFrames(equation([term("A", 3, 1), term("B", 12)], "=", [term("C", 5, 1), term("D", -4)]), "x", { maxEm: 18 }).frames;

const cancelIntro: Frame[] = [
  ...cancelFrames(equation([group("G", 2, [inner(1, 1), inner(3)])], "=", [term("C", 2, 1), term("D", 5)]), "x", 18).frames,
  ...cancelFrames(equation([group("H", 3, [inner(1, 1), inner(-1)]), term("E", 1, 1)], "=", [term("F", 4, 1), term("K", -3)]), "x", 18).frames.map((f, i) =>
    i === 0 ? { ...f, note: tx("A second one: expand the bracket first.", "Noch eine: Löse zuerst die Klammer auf.") } : f,
  ),
];

const ratioIntro: Frame[] = [
  ...ratioFrames({ t: [null, 4, 6, 8], form: "colon" }, "x"),
  {
    math: "\\frac{x}{4} = \\frac{6}{8}",
    note: tx(
      "The same equation as fractions: $x : 4 = \\frac{x}{4}$. In fraction form you multiply **crosswise**: $x \\cdot 8 = 4 \\cdot 6$.",
      "Dieselbe Gleichung mit Brüchen: $x : 4 = \\frac{x}{4}$. In Bruchform multiplizierst du **über Kreuz**: $x \\cdot 8 = 4 \\cdot 6$.",
    ),
  },
];

const ineqIntro = (() => {
  const s: FracSpec = { L: [piece("G", 1, 1, 0, 2), piece("B", -1, 0, 1)], R: [piece("H", 1, 1, 0, 3)], rel: "≤" };
  const res = fracFrames(s, "x", { maxEm: 18 });
  return [...res.frames, setFrame("x", "≤", qvalue(res.value))];
})();

export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Fractions: the common denominator", "Brüche: der Hauptnenner"),
      body: tx(
        "Multiply **every** term by the common denominator. A numerator with two terms becomes a bracket.",
        "Multipliziere **jeden** Term mit dem Hauptnenner. Ein Zähler mit zwei Termen wird zur Klammer.",
      ),
      examples: ["\\frac{x + 1}{2} - \\frac{x - 2}{3} = 2 \\quad | \\, \\cdot 6", "3(x + 1) - 2(x - 2) = 12"],
      tone: "rule",
    },
    {
      title: tx("Minus in front of a fraction", "Minus vor dem Bruch"),
      body: tx("It belongs to the whole numerator, so every sign in the bracket flips.", "Es gehört zum ganzen Zähler, also dreht sich jedes Vorzeichen in der Klammer um."),
      examples: ["-6 \\cdot \\frac{x - 2}{3} = -2(x - 2) = -2x + 4"],
      tone: "warning",
    },
    {
      title: tx("Decimals: times 10", "Dezimalzahlen: mal 10"),
      body: tx("One digit after the point: multiply every term by $10$. Two digits: by $100$.", "Eine Nachkommastelle: Multipliziere jeden Term mit $10$. Zwei Nachkommastellen: mit $100$."),
      examples: [tx("0.3x + 1.2 = 0.5x - 0.4 \\quad | \\, \\cdot 10", "0,3x + 1,2 = 0,5x - 0,4 \\quad | \\, \\cdot 10"), "3x + 12 = 5x - 4"],
      tone: "tip",
    },
    {
      title: tx("No solution or every number", "Keine Lösung oder jede Zahl"),
      body: tx(
        "If $x$ cancels, look at what's left. A false statement: $L = \\{ \\}$. A true statement: every number works, $L =$ ℚ.",
        "Fällt $x$ weg, schau, was übrig bleibt. Eine falsche Aussage: $L = \\{ \\}$. Eine wahre Aussage: Jede Zahl passt, $L =$ ℚ.",
      ),
      examples: ["2x + 6 = 2x + 5 \\Rightarrow 6 = 5 \\Rightarrow L = \\{ \\}", "4x - 3 = 4x - 3 \\Rightarrow -3 = -3 \\Rightarrow L = ℚ"],
      tone: "rule",
    },
    {
      title: tx("Ratio equations", "Verhältnisgleichungen"),
      body: tx("Outer terms times outer terms equals inner terms times inner terms. With fractions: multiply crosswise.", "Außenglieder mal Außenglieder ist gleich Innenglieder mal Innenglieder. Mit Brüchen: über Kreuz multiplizieren."),
      examples: ["x : 4 = 6 : 8 \\Rightarrow 8x = 24 \\Rightarrow x = 3"],
      tone: "rule",
    },
    {
      title: tx("Solution sets of inequalities", "Lösungsmengen von Ungleichungen"),
      body: tx(
        "Write the answer as a set. On the number line: an open circle for $<$ and $>$, a filled dot for $\\le$ and $\\ge$. As an interval: $x \\le 6$ is (−∞, 6].",
        "Schreib die Lösung als Menge. An der Zahlengeraden: ein offener Kreis bei $<$ und $>$, ein ausgefüllter Punkt bei $\\le$ und $\\ge$. Als Intervall: $x \\le 6$ ist ]−∞; 6].",
      ),
      examples: ["L = \\{ x \\,|\\, x \\le 6 \\}"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Fractions: multiply by the common denominator", "Brüche: mit dem Hauptnenner multiplizieren"),
      blob: tx("Fractions in an equation? One multiplication and they're gone!", "Brüche in der Gleichung? Eine Multiplikation, und sie sind weg!"),
      body: tx(
        "Find the common denominator of all fractions and multiply **every** term by it. A numerator with several terms becomes a bracket, so nothing gets lost.",
        "Bestimme den Hauptnenner aller Brüche und multipliziere **jeden** Term damit. Ein Zähler mit mehreren Termen wird zur Klammer, so geht nichts verloren.",
      ),
      frames: fractionIntro,
    },
    {
      type: "explain",
      title: tx("Decimals: multiply by 10", "Dezimalzahlen: mal 10"),
      blob: tx("Decimals work the same way. Just move the point!", "Mit Kommazahlen geht's genauso. Einfach das Komma verschieben!"),
      body: tx(
        "With one digit after the point, multiply every term by $10$. Then you solve a normal equation with whole numbers.",
        "Bei einer Nachkommastelle multiplizierst du jeden Term mit $10$. Dann löst du eine ganz normale Gleichung mit ganzen Zahlen.",
      ),
      frames: decimalIntro,
    },
    {
      type: "check",
      blob: tx("Your turn! Common denominator first.", "Jetzt du! Zuerst der Hauptnenner."),
      exercise: fracExercise(
        { L: [piece("G", 1, 1, -1, 3), piece("H", 1, 1, 0, 2)], R: [piece("C", 1, 0, 3)], rel: "=" },
        "x",
        tx("The common denominator of $3$ and $2$ is $6$. Multiply every term by $6$.", "Der Hauptnenner von $3$ und $2$ ist $6$. Multipliziere jeden Term mit $6$."),
      ),
    },
    {
      type: "explain",
      title: tx("No solution, or every number", "Keine Lösung oder jede Zahl"),
      blob: tx("Sometimes x just vanishes. Then the leftovers decide!", "Manchmal verschwindet das x einfach. Dann entscheidet der Rest!"),
      body: tx(
        "If the $x$-terms cancel, a statement without $x$ is left. **False** (like $6 = 5$): no number works, $L = \\{ \\}$. **True** (like $-3 = -3$): every number works, $L =$ ℚ, the set of rational numbers.",
        "Heben sich die $x$-Terme auf, bleibt eine Aussage ohne $x$. **Falsch** (wie $6 = 5$): Keine Zahl passt, $L = \\{ \\}$. **Wahr** (wie $-3 = -3$): Jede Zahl passt, $L =$ ℚ, die Menge der rationalen Zahlen.",
      ),
      frames: cancelIntro,
    },
    {
      type: "widget",
      title: tx("Both sides as lines", "Beide Seiten als Geraden"),
      blob: tx("Make the lines parallel. What happens to the solution?", "Mach die Geraden parallel. Was passiert mit der Lösung?"),
      body: tx(
        "Each side of an equation is a line. The solution is where they cross. Parallel lines never cross: no solution. The same line twice: every number is a solution.",
        "Jede Seite einer Gleichung ist eine Gerade. Die Lösung liegt dort, wo sie sich schneiden. Parallele Geraden schneiden sich nie: keine Lösung. Zweimal dieselbe Gerade: Jede Zahl ist eine Lösung.",
      ),
      widget: BothSidesLab,
    },
    {
      type: "check",
      blob: tx("Does x survive this one?", "Überlebt das x diesmal?"),
      exercise: setExercise(equation([group("G", 4, [inner(1, 1), inner(-2)]), term("E", 3)], "=", [term("C", 4, 1), term("D", -5)]), "x", [2, 0, 3, 1])!,
    },
    {
      type: "explain",
      title: tx("Ratio equations", "Verhältnisgleichungen"),
      blob: tx("Two ratios, one trick: multiply crosswise!", "Zwei Verhältnisse, ein Trick: über Kreuz multiplizieren!"),
      body: tx(
        "In $a : b = c : d$ the product of the outer terms equals the product of the inner terms: $a \\cdot d = b \\cdot c$. As fractions, that's multiplying crosswise.",
        "In $a : b = c : d$ ist das Produkt der Außenglieder gleich dem Produkt der Innenglieder: $a \\cdot d = b \\cdot c$. Mit Brüchen heißt das: über Kreuz multiplizieren.",
      ),
      frames: ratioIntro,
    },
    {
      type: "check",
      blob: tx("Outer times outer, inner times inner.", "Außen mal außen, innen mal innen."),
      exercise: ratioExercise({ t: [15, null, 5, 2], form: "colon" }, "x"),
    },
    {
      type: "explain",
      title: tx("Inequalities and their solution set", "Ungleichungen und ihre Lösungsmenge"),
      blob: tx("Same tools, and the answer is a whole set of numbers.", "Gleiche Werkzeuge, und die Lösung ist eine ganze Menge von Zahlen."),
      body: tx(
        "Fractions and brackets work as in equations. Multiplying by a positive common denominator keeps the sign. Write the result as a set, $L = \\{ x \\,|\\, x \\le 6 \\}$, or as an interval.",
        "Brüche und Klammern behandelst du wie bei Gleichungen. Beim Multiplizieren mit dem positiven Hauptnenner bleibt das Zeichen. Schreib das Ergebnis als Menge, $L = \\{ x \\,|\\, x \\le 6 \\}$, oder als Intervall.",
      ),
      frames: ineqIntro,
    },
    {
      type: "widget",
      title: tx("Build the solution set", "Bau die Lösungsmenge"),
      blob: tx("Solve, then show it on the number line!", "Erst lösen, dann an der Zahlengeraden zeigen!"),
      body: tx(
        "Solve the inequality, then set the boundary, the direction and the dot. The notation below follows along: as an inequality, as a set and as an interval.",
        "Löse die Ungleichung und stell dann Grenze, Richtung und Punkt ein. Die Schreibweisen darunter laufen mit: als Ungleichung, als Menge und als Intervall.",
      ),
      widget: SolutionSetLab,
    },
    {
      type: "check",
      blob: tx("Last one. Watch the sign at the end!", "Die letzte! Achte am Ende auf das Zeichen!"),
      exercise: fracExercise(
        { L: [piece("G", 1, 1, 4, 2)], R: [piece("H", 1, 1, 0, 1), piece("B", -1, 0, 1)], rel: ">" },
        "x",
        tx("Multiply both sides by $2$. At the end you multiply by $-1$: flip the sign!", "Multipliziere beide Seiten mit $2$. Am Ende multiplizierst du mit $-1$: Zeichen umdrehen!"),
      ),
    },
  ],
};
