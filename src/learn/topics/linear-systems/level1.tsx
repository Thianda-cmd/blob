"use client";

import type { ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import type { Pt } from "@/learn/visuals/LinesGraph";
import { graphVisual, mistakeList, plain, pt, val, type Msg } from "../lines/level2";
import { eqSrc, LegendGraph, PairTester, rightAt, TableLab, ValueTable } from "./lab1";
import {
  checkPairMistakes,
  det,
  graphSystemMistakes,
  holds,
  joinText,
  pairAnswer,
  prodTerm,
  resultSrc,
  solvedSrc,
  stdSrc,
  substitution,
  substitutionMistakes,
  sysMath,
  sysSrc,
  termOf,
  tidy,
  xyWhen,
  yFirst,
  type Choice,
  type Solved,
  type Std,
} from "./level2";

// ---------------------------------------------------------------------------
// Level 1: two conditions at once. Testing a pair, a table of values, the crossing
// point of two lines, and substituting when one variable is already alone.

const visual = (component: unknown, props: Record<string, unknown>) => ({ component: component as ComponentType<Record<string, unknown>>, props });
/** "$(3 | 4)$" for options and messages. */
const pairText = (p: Pt) => `$${pt(p[0], p[1])}$`;

/** Put the pair p into both equations: first the numbers, then the verdict (green or red). */
function testFrames(e1: Std, e2: Std, p: Pt): [Frame["math"], Frame["math"]] {
  const lhs = (e: Std, id: string) =>
    yFirst(e) ? `${prodTerm(e.y, p[1], `${id}y`, true)} ${prodTerm(e.x, p[0], `${id}x`, false)}` : `${prodTerm(e.x, p[0], `${id}x`, true)} ${prodTerm(e.y, p[1], `${id}y`, false)}`;
  const ok = [holds(e1, p[0], p[1]), holds(e2, p[0], p[1])];
  const verdict = (e: Std, id: string, good: boolean) => `${val(e.x * p[0] + e.y * p[1], `${id}x`)} ${good ? "=" : "\\ne"}#e${id} ${val(e.c, `${id}c`)}`;
  return [
    sysSrc(`${lhs(e1, "1")} =#e1 ${val(e1.c, "1c")}`, `${lhs(e2, "2")} =#e2 ${val(e2.c, "2c")}`),
    sysSrc(verdict(e1, "1", ok[0]), verdict(e2, "2", ok[1]), "(I)", "(II)", [ok[0] ? "green" : "red", ok[1] ? "green" : "red"]),
  ];
}

const PUT_IN = (p: Pt) => tx(`Put in $x = ${p[0]}$ and $y = ${p[1]}$.`, `Setze $x = ${p[0]}$ und $y = ${p[1]}$ ein.`);
const LEFT_SIDES = tx("Work out each left side.", "Rechne jeweils die linke Seite aus.");

/** What the verdict means for the pair. */
function verdictNote(e1: Std, e2: Std, p: Pt): Text {
  const a = holds(e1, p[0], p[1]);
  const b = holds(e2, p[0], p[1]);
  const P = pairText(p);
  if (a && b) return tx(`Both equations are true, so ${P} is **the** solution of the system.`, `Beide Gleichungen stimmen, also ist ${P} **die** Lösung des LGS.`);
  if (a) return tx(`(I) is true, but (II) is false. One false equation is enough: ${P} is **not** a solution.`, `(I) stimmt, aber (II) nicht. Eine falsche Gleichung reicht: ${P} ist **keine** Lösung.`);
  if (b) return tx(`(II) is true, but (I) is false. A solution has to make **both** true: ${P} is not one.`, `(II) stimmt, aber (I) nicht. Eine Lösung muss **beide** erfüllen: ${P} ist keine.`);
  return tx(`Neither equation is true for ${P}.`, `Für ${P} stimmt keine der beiden Gleichungen.`);
}

// ---------------------------------------------------------------------------
// Task builders shared by the lesson and the practice

/** A small equation a·x + b·y = c through (x | y), friendly for beginners. */
function friendlyStd(rng: Rng, x: number, y: number): Std {
  const a = rng.pick([1, 1, 2, 3]);
  const b = rng.pick([1, 1, 2, 3, -1, -1, -2]);
  return tidy({ x: a, y: b, c: a * x + b * y });
}

/** One step along the line e (to the next grid point on it). */
function stepOn(e: Std): Pt {
  const g = Math.abs(gcdOf(e.x, e.y));
  return [e.y / g, -e.x / g];
}
function gcdOf(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** A grid point on e (other than the solution) with small non-negative numbers, if there is one. */
function otherPointOn(e: Std, sol: Pt, rng: Rng, avoid: Pt[] = []): Pt | null {
  const d = stepOn(e);
  const tries = rng.shuffle([1, -1, 2, -2]).map((k): Pt => [sol[0] + k * d[0], sol[1] + k * d[1]]);
  return tries.find((p) => p[0] >= 0 && p[1] >= 0 && p[0] <= 9 && p[1] <= 9 && !avoid.some((q) => q[0] === p[0] && q[1] === p[1])) ?? null;
}

const CHECK_OPTIONS = [
  tx("It solves **both** equations: it's the solution of the system.", "Es löst **beide** Gleichungen: Es ist die Lösung des LGS."),
  tx("It solves only equation (I).", "Es löst nur Gleichung (I)."),
  tx("It solves only equation (II).", "Es löst nur Gleichung (II)."),
  tx("It solves **neither** equation.", "Es löst **keine** der beiden Gleichungen."),
];

function checkPairExercise(e1: Std, e2: Std, p: Pt): Exercise {
  const ok1 = holds(e1, p[0], p[1]);
  const ok2 = holds(e2, p[0], p[1]);
  const answer: Choice = { kind: "choice", options: CHECK_OPTIONS, correct: ok1 && ok2 ? 0 : ok1 ? 1 : ok2 ? 2 : 3 };
  const [put, verdict] = testFrames(e1, e2, p);
  return {
    instruction: tx("Check a pair", "Prüfe ein Zahlenpaar"),
    text: tx(`Which equations does the pair ${pairText(p)} solve?`, `Welche Gleichungen löst das Zahlenpaar ${pairText(p)}?`),
    math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
    answer,
    hint: tx(
      `Put $x = ${p[0]}$ and $y = ${p[1]}$ into each equation and work out the left side. Is it equal to the right side?`,
      `Setze $x = ${p[0]}$ und $y = ${p[1]}$ in jede Gleichung ein und rechne die linke Seite aus. Kommt die rechte Seite heraus?`,
    ),
    solution: [
      { math: sysSrc(stdSrc(e1, "1"), stdSrc(e2, "2")), note: PUT_IN(p) },
      { math: put, note: LEFT_SIDES },
      { math: verdict, note: verdictNote(e1, e2, p) },
    ],
    mistakes: checkPairMistakes(e1, e2, p, answer),
  };
}

type Wrong = { p: Pt; why: "swapped" | "onlyI" | "onlyII" | "none" };

function whichPairExercise(e1: Std, e2: Std, sol: Pt, wrongs: Wrong[], order: number[]): Exercise {
  const all: Pt[] = [sol, ...wrongs.map((w) => w.p)];
  const options = order.map((i) => pairText(all[i]));
  const answer: Choice = { kind: "choice", options, correct: order.indexOf(0) };
  const mk = mistakeList(answer);
  for (const w of wrongs) {
    const P = pairText(w.p);
    const msg: Msg =
      w.why === "swapped"
        ? [
            tx("x and y swapped", "x und y vertauscht"),
            tx(
              `Careful with the order! In ${P} the **first** number is $x$, so $x = ${w.p[0]}$ and $y = ${w.p[1]}$. Put them in that way round and check both equations again.`,
              `Achtung, Reihenfolge! In ${P} ist die **erste** Zahl $x$, also $x = ${w.p[0]}$ und $y = ${w.p[1]}$. Setz sie so herum ein und prüf beide Gleichungen noch mal.`,
            ),
          ]
        : w.why === "onlyI"
          ? [
              tx("Only (I) fits", "Nur (I) passt"),
              tx(`Nearly! ${P} makes (I) true, but put it into (II) as well. A solution has to fit **both** equations.`, `Fast! ${P} erfüllt (I), aber setz es auch in (II) ein. Eine Lösung muss **beide** Gleichungen erfüllen.`),
            ]
          : w.why === "onlyII"
            ? [
                tx("Only (II) fits", "Nur (II) passt"),
                tx(`Nearly! ${P} makes (II) true, but check (I) too. A solution has to fit **both** equations.`, `Fast! ${P} erfüllt (II), aber prüf auch (I). Eine Lösung muss **beide** Gleichungen erfüllen.`),
              ]
            : [
                tx("Neither fits", "Keine passt"),
                tx(`Put ${P} into both equations: neither of them comes out true. Test the pairs one by one.`, `Setz ${P} in beide Gleichungen ein: Keine von beiden stimmt. Teste die Paare der Reihe nach.`),
              ];
    mk.add({ ...answer, correct: order.indexOf(all.indexOf(w.p)) }, ...msg);
  }
  const [put, verdict] = testFrames(e1, e2, sol);
  return {
    instruction: tx("Find the solution", "Finde die Lösung"),
    text: tx("Which pair of numbers solves the system?", "Welches Zahlenpaar löst das Gleichungssystem?"),
    math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
    answer,
    hint: tx(
      "Test each pair: put the first number in for $x$, the second for $y$. The solution makes **both** equations true.",
      "Teste jedes Paar: Die erste Zahl setzt du für $x$ ein, die zweite für $y$. Die Lösung erfüllt **beide** Gleichungen.",
    ),
    solution: [
      { math: sysSrc(stdSrc(e1, "1"), stdSrc(e2, "2")), note: joinText(tx(`Test ${pairText(sol)}.`, `Teste ${pairText(sol)}.`), PUT_IN(sol)) },
      { math: put, note: LEFT_SIDES },
      { math: verdict, note: joinText(verdictNote(e1, e2, sol), tx("The other pairs fail at least one equation.", "Die anderen Paare fallen bei mindestens einer Gleichung durch.")) },
    ],
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Table of values

type Rule = { m: number; n: number };
const ruleSrc = (r: Rule) => eqSrc({ kind: "y", m: r.m, n: r.n });
const at = (r: Rule, x: number) => r.m * x + r.n;
const TABLE_XS = [0, 1, 2, 3, 4, 5, 6];

/** The story behind a table task (optional) and what x and y mean. */
type TableStory = { text: Text; answer: (x: number, y: number) => Text };

function tableExercise(r1: Rule, r2: Rule, story?: TableStory): Exercise {
  const xs = TABLE_XS;
  const sx = (r2.n - r1.n) / (r1.m - r2.m);
  const sy = at(r1, sx);
  const shown = 2;
  const row = (r: Rule) => xs.map((x, i) => (i < shown ? at(r, x) : null));
  // A worked column: "x = 3: (I) y = 2 · 3 + 1 = 7, (II) y = 3 + 4 = 7".
  const column = (x: number): string => {
    const a = at(r1, x);
    const b = at(r2, x);
    const eq = a === b;
    return `x#X =#XE ${x}#XK \\quad ${sysSrc(`y#1y =#e1 ${rightAt(r1.m, r1.n, x)} =#f1 ${val(a, "r1")}`, `y#2y =#e2 ${rightAt(r2.m, r2.n, x)} =#f2 ${val(b, "r2")}`, "(I)", "(II)", eq ? ["green", "green"] : ["blob", "blob"])}`;
  };
  const frames: Frame[] = [
    {
      math: sysSrc(ruleSrc(r1), ruleSrc(r2)),
      note: tx(
        `Fill in the table: for each $x$, work out $y$ in (I) and in (II). $x = 0$ and $x = 1$ are already done.`,
        `Füll die Tabelle aus: Rechne für jedes $x$ den $y$-Wert von (I) und von (II) aus. $x = 0$ und $x = 1$ sind schon fertig.`,
      ),
    },
  ];
  for (let x = shown; x <= sx; x++) {
    const a = at(r1, x);
    const b = at(r2, x);
    frames.push({
      math: column(x),
      note:
        a === b
          ? tx(`For $x = ${x}$ both give $y = ${a}$. **Same $x$, same $y$**: that's the solution!`, `Für $x = ${x}$ ergeben beide $y = ${a}$. **Gleiches $x$, gleiches $y$**: Das ist die Lösung!`)
          : tx(`For $x = ${x}$: $${a} \\ne ${b}$. Not yet, keep going.`, `Für $x = ${x}$: $${a} \\ne ${b}$. Noch nicht, weiter geht's.`),
    });
  }
  frames.push({ math: resultSrc(sx, sy), note: story ? story.answer(sx, sy) : tx(`So $L = \\{ ${pt(sx, sy)} \\}$.`, `Also ist $L = \\{ ${pt(sx, sy)} \\}$.`) });

  // Same number in both rows, but under different x: a classic slip.
  const mk = mistakeList(pairAnswer(sx, sy));
  const v1 = xs.map((x) => at(r1, x));
  const v2 = xs.map((x) => at(r2, x));
  for (let i = 0; i < xs.length; i++) {
    const j = v2.indexOf(v1[i]);
    if (j < 0 || j === i) continue;
    const msg: Msg = [
      tx("Same y, different x", "Gleiches y, verschiedenes x"),
      tx(
        `The number $${v1[i]}$ shows up in both rows, but under **different** $x$-values ($x = ${xs[i]}$ and $x = ${xs[j]}$). The solution needs the same $y$ **in the same column**.`,
        `Die Zahl $${v1[i]}$ kommt in beiden Zeilen vor, aber bei **verschiedenen** $x$-Werten ($x = ${xs[i]}$ und $x = ${xs[j]}$). Für die Lösung muss in **derselben Spalte** dasselbe $y$ stehen.`,
      ),
    ];
    mk.add(xyWhen(xs[i], v1[i]), ...msg);
    mk.add(xyWhen(xs[j], v1[i]), ...msg);
  }
  if (sx > 0) {
    mk.add(xyWhen(0, r1.n), tx("That's the start", "Das ist der Anfang"), tx(
      `That's just the first column ($x = 0$) of (I). Go on along the table until (I) and (II) give the **same** $y$.`,
      `Das ist nur die erste Spalte ($x = 0$) von (I). Geh die Tabelle weiter entlang, bis (I) und (II) **dasselbe** $y$ ergeben.`,
    ));
  }

  return {
    instruction: tx("Solve with a table of values", "Löse mit einer Wertetabelle"),
    text: story
      ? story.text
      : tx("Complete the table of values. Where do both equations give the same $y$? Give that pair.", "Ergänze die Wertetabelle. Wo ergeben beide Gleichungen dasselbe $y$? Gib dieses Zahlenpaar an."),
    math: sysMath(ruleSrc(r1), ruleSrc(r2)),
    visual: visual(ValueTable, { xs, rows: [{ name: "I", values: row(r1) }, { name: "II", values: row(r2) }] }),
    answer: pairAnswer(sx, sy),
    hint: tx(
      "Work out $y$ for $x = 2$, $x = 3$, … in both equations. Stop where both rows show the same number.",
      "Rechne $y$ für $x = 2$, $x = 3$, … in beiden Gleichungen aus. Hör auf, wenn in beiden Zeilen dieselbe Zahl steht.",
    ),
    solution: frames,
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Reading a graph

function graphExercise(S: Pt, l1: Rule, l2: Rule, range: Pt = [-1, 7]): Exercise {
  const [x, y] = S;
  const s1: Solved = { v: "y", m: l1.m, n: l1.n };
  const s2: Solved = { v: "y", m: l2.m, n: l2.n };
  const sys = sysSrc(solvedSrc(s1, "1"), solvedSrc(s2, "2"));
  return {
    instruction: tx("Read the solution off the graph", "Lies die Lösung am Graphen ab"),
    text: tx("Each equation belongs to one of the lines. Which pair solves both?", "Jede Gleichung gehört zu einer der Geraden. Welches Zahlenpaar löst beide?"),
    math: sysMath(solvedSrc(s1, "1"), solvedSrc(s2, "2")),
    visual: graphVisual({
      xRange: range,
      yRange: range,
      functions: [
        { f: (t) => l1.m * t + l1.n, key: "I", color: "blob", label: "I" },
        { f: (t) => l2.m * t + l2.n, key: "II", color: "ink", label: "II" },
      ],
    }),
    answer: pairAnswer(x, y),
    mistakes: graphSystemMistakes(x, y, [
      [l1.m, l1.n],
      [l2.m, l2.n],
    ]),
    hint: tx(
      "Find the point where the two lines cross. First read its $x$-value, then its $y$-value.",
      "Such den Punkt, an dem sich die beiden Geraden schneiden. Lies zuerst seinen $x$-Wert ab, dann seinen $y$-Wert.",
    ),
    solution: [
      { math: sys, note: tx("Each line is the picture of one equation. A point on **both** lines fits both equations.", "Jede Gerade ist das Bild einer Gleichung. Ein Punkt auf **beiden** Geraden passt zu beiden Gleichungen.") },
      {
        math: `S#S ${pt(`${x}#rx`, `${y}#ry`)}`,
        note: tx(`The lines cross at $${pt(x, y, "S")}$: $${x}$ along the $x$-axis, $${y}$ up the $y$-axis.`, `Die Geraden schneiden sich in $${pt(x, y, "S")}$: $${x}$ auf der $x$-Achse, $${y}$ auf der $y$-Achse.`),
      },
      {
        math: sysSrc(`${val(y, "1v")} =#e1 ${rightAt(l1.m, l1.n, x)}`, `${val(y, "2v")} =#e2 ${rightAt(l2.m, l2.n, x)}`, "(I)", "(II)", ["green", "green"]),
        note: tx(`Check: put $x = ${x}$ and $y = ${y}$ into both equations. Both are true.`, `Probe: Setze $x = ${x}$ und $y = ${y}$ in beide Gleichungen ein. Beide stimmen.`),
      },
      { math: resultSrc(x, y), note: tx(`So $L = \\{ ${pt(x, y)} \\}$.`, `Also ist $L = \\{ ${pt(x, y)} \\}$.`) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Substitution when one variable is alone

const SOLVE_SUB1 = tx("Solve by substituting", "Löse durch Einsetzen");

/** Substitution mistakes from level 2, plus "a term got lost when combining". */
function subMistakes(s: Solved, e: Std, extra: [AnswerSpec, Msg][] = []): Mistake[] {
  const sv = s.v;
  const ov = sv === "x" ? "y" : "x";
  const known = (e.c - e[sv] * s.n) / (e[sv] * s.m + e[ov]);
  const [px, py] = sv === "y" ? [known, s.m * known + s.n] : [s.m * known + s.n, known];
  const mk = mistakeList(xyWhen(px, py));
  for (const [when, msg] of extra) mk.add(when, ...msg);
  // Both values right, but in the wrong boxes (stories bring their own message for this in `extra`).
  mk.add(
    xyWhen(py, px),
    tx("Swapped", "Vertauscht"),
    tx(
      `Both numbers are right, just in the wrong boxes! You worked out $${ov}$ first: that number goes in the box for $${ov}$.`,
      `Beide Zahlen stimmen, nur in den falschen Feldern! Du hast zuerst $${ov}$ ausgerechnet: Diese Zahl gehört ins Feld für $${ov}$.`,
    ),
  );
  for (const m of substitutionMistakes(s, e)) mk.add(m.when, m.title ?? tx("Slip", "Kleiner Fehler"), m.say);
  // x + 2x read as 2x: the term that was already there gets lost.
  const qo = e[ov];
  const qm = e[sv] * s.m;
  if (qo !== 0 && qm !== 0 && qo + qm !== qm) {
    const lost = (e.c - e[sv] * s.n) / qm;
    // Only numbers a student would really write down (whole numbers or halves).
    if (Number.isInteger(lost * 2) && Number.isInteger((s.m * lost + s.n) * 2)) {
    const via = sv === "y" ? xyWhen(lost, s.m * lost + s.n) : xyWhen(s.m * lost + s.n, lost);
    mk.add(
      via,
      tx("A term got lost", "Ein Term ist verloren gegangen"),
      tx(
        `I think a term got lost when you combined: $${termOf(qo, ov)}$ and $${termOf(qm, ov)}$ together make $${termOf(qo + qm, ov)}$. Don't forget the $${termOf(qo, ov)}$ that was there already!`,
        `Ich glaub, beim Zusammenfassen ist ein Term verloren gegangen: $${termOf(qo, ov)}$ und $${termOf(qm, ov)}$ ergeben zusammen $${termOf(qo + qm, ov)}$. Vergiss das $${termOf(qo, ov)}$ nicht, das schon da war!`,
      ),
    );
    }
  }
  return mk.list.slice(0, 5);
}

function substitutionExercise(s: Solved, e: Std, sol: Pt): Exercise {
  return {
    instruction: SOLVE_SUB1,
    math: sysMath(solvedSrc(s, "1"), stdSrc(e, "2")),
    answer: pairAnswer(sol[0], sol[1]),
    hint: tx(
      `(I) says what $${s.v}$ is. Replace $${s.v}$ in (II) by that term (in brackets), solve for the other variable, then work out $${s.v}$.`,
      `(I) sagt dir, was $${s.v}$ ist. Ersetze $${s.v}$ in (II) durch diesen Term (in Klammern), löse nach der anderen Variable auf und rechne dann $${s.v}$ aus.`,
    ),
    solution: substitution(s, e, sol),
    mistakes: subMistakes(s, e),
  };
}

// ---------------------------------------------------------------------------
// Stories with two unknowns

type Story = {
  text: Text;
  /** What x and y stand for, as a board line. */
  defs: Text;
  s: Solved;
  e: Std;
  sol: Pt;
  setup: Text;
  answer: Text;
  swapped: Text;
  extra: [AnswerSpec, Msg][];
  /** Wrong systems for "which system fits?", with Blob's reason. */
  wrong: [string, Msg][];
};

const sysLine = (a: string, b: string) => `${a} , \\quad ${b}`;
const solvedLine = (s: Solved) => plain(solvedSrc(s, "1"));
const stdLine = (e: Std) => plain(stdSrc(e, "1"));

/** [English, German] */
type Say = [string, string];

/** "y = d + x" written the wrong way round. `ask`: the question that decides which one is bigger. */
const REVERSED = (d: number, ask: Say): Msg => [
  tx("The wrong way round", "Falsch herum"),
  tx(
    `Read the sentence again: ${ask[0]} $y$ is the bigger one, so you add the ${d} to the **smaller** one: $y = x + ${d}$.`,
    `Lies den Satz noch mal: ${ask[1]} $y$ ist der größere Wert, also kommt die ${d} zum **kleineren** dazu: $y = x + ${d}$.`,
  ),
];
const REVERSED_TIMES = (k: number, ask: Say): Msg => [
  tx("The wrong way round", "Falsch herum"),
  tx(
    `Read the sentence again: ${ask[0]} $y$ is the bigger one, so it's ${k === 2 ? "twice" : `${k} times`} the **smaller** one: $y = ${k}x$.`,
    `Lies den Satz noch mal: ${ask[1]} $y$ ist der größere Wert, also ist $y$ das ${k === 2 ? "Doppelte" : `${k}-Fache`} des **kleineren**: $y = ${k}x$.`,
  ),
];
/** "7 years older" read as times. `more`: the story's own phrase, `twice`: what times would sound like. */
const TIMES = (more: Say, twice: Say): Msg => [
  tx("Plus, not times", "Plus, nicht mal"),
  tx(`"${more[0]}" means **plus**, not times. "${twice[0]}" would be times.`, `„${more[1]}“ heißt **plus**, nicht mal. „${twice[1]}“ wäre mal.`),
];
const timesEn = (k: number) => (k === 2 ? "twice" : `${k} times`);
const timesDe = (k: number) => (k === 2 ? "doppelt" : `${k}-mal`);
/** "4 times as big" read as plus. `as`: the story's phrase after the factor ("as big", "as many"). */
const PLUS = (k: number, as: Say): Msg => [
  tx("Times, not plus", "Mal, nicht plus"),
  tx(`"${timesEn(k)} ${as[0]}" means **multiply**: $y = ${k}x$, not $y = x + ${k}$.`, `„${timesDe(k)} ${as[1]}“ heißt **multiplizieren**: $y = ${k}x$, nicht $y = x + ${k}$.`),
];
const TOGETHER: Msg = [
  tx("Together means plus", "Zusammen heißt plus"),
  tx("\"Together\" or \"in total\" means you **add**: $x + y$.", "„Zusammen“ oder „insgesamt“ heißt: **addieren**, also $x + y$."),
];

function makeStory(rng: Rng, kind: "ages" | "times" | "prices" | "class" | "rectangle" | "farm"): Story {
  if (kind === "ages") {
    const [a, b] = rng.pick([
      ["Emma", "Ben"],
      ["Lena", "Finn"],
      ["Mia", "Jonas"],
    ]);
    const d = rng.int(2, 9);
    const x = rng.int(8, 16);
    const y = x + d;
    const S = x + y;
    return {
      text: tx(
        `${b} is ${d} years older than ${a}. Together they are ${S} years old. How old is each of them? ($x$: ${a}'s age, $y$: ${b}'s age)`,
        `${b} ist ${d} Jahre älter als ${a}. Zusammen sind sie ${S} Jahre alt. Wie alt sind die beiden? ($x$: Alter von ${a}, $y$: Alter von ${b})`,
      ),
      defs: tx(`x#X ": ${a}'s age"#DX \\quad y#Y ": ${b}'s age"#DY`, `x#X ": Alter von ${a}"#DX \\quad y#Y ": Alter von ${b}"#DY`),
      s: { v: "y", m: 1, n: d },
      e: { x: 1, y: 1, c: S },
      sol: [x, y],
      setup: tx(`"${d} years older": $y = x + ${d}$. "Together ${S}": $x + y = ${S}$.`, `„${d} Jahre älter“: $y = x + ${d}$. „Zusammen ${S}“: $x + y = ${S}$.`),
      answer: tx(`${a} is ${x} and ${b} is ${y} years old.`, `${a} ist ${x} und ${b} ist ${y} Jahre alt.`),
      swapped: tx(`Ha, swapped! $x$ is **${a}'s** age, and ${a} is the younger one.`, `Ha, vertauscht! $x$ ist das Alter von **${a}**, und ${a} ist jünger.`),
      extra:
        S % 2 === 0
          ? [
              [
                xyWhen(S / 2, S / 2),
                [
                  tx("Not the same age", "Nicht gleich alt"),
                  tx(`If both were ${S / 2}, ${b} wouldn't be older at all. Use **both** pieces of information.`, `Wären beide ${S / 2}, wäre ${b} gar nicht älter. Nutze **beide** Angaben.`),
                ],
              ],
            ]
          : [],
      wrong: [
        [sysLine(solvedLine({ v: "x", m: 1, n: d }), stdLine({ x: 1, y: 1, c: S })), REVERSED(d, ["**who** is older?", "**Wer** ist älter?"])],
        [sysLine(solvedLine({ v: "y", m: d, n: 0 }), stdLine({ x: 1, y: 1, c: S })), TIMES([`${d} years older`, `${d} Jahre älter`], ["Twice as old", "Doppelt so alt"])],
        [sysLine(solvedLine({ v: "y", m: 1, n: d }), stdLine({ x: -1, y: 1, c: S })), TOGETHER],
      ],
    };
  }
  if (kind === "times" || kind === "farm") {
    const k = rng.int(2, 5);
    const x = rng.int(2, kind === "farm" ? 9 : 12);
    const y = k * x;
    const S = x + y;
    const farm = kind === "farm";
    return {
      text: farm
        ? tx(
            `On a farm there are ${timesEn(k)} as many chickens as cows, ${S} animals in total. How many cows ($x$) and chickens ($y$) are there?`,
            `Auf einem Bauernhof gibt es ${timesDe(k)} so viele Hühner wie Kühe, insgesamt ${S} Tiere. Wie viele Kühe ($x$) und Hühner ($y$) sind es?`,
          )
        : tx(
            `One number is ${timesEn(k)} as big as another. Together they make ${S}. Find the smaller number $x$ and the bigger number $y$.`,
            `Eine Zahl ist ${timesDe(k)} so groß wie eine andere. Zusammen ergeben sie ${S}. Bestimme die kleinere Zahl $x$ und die größere Zahl $y$.`,
          ),
      defs: farm
        ? tx(`x#X ": cows"#DX \\quad y#Y ": chickens"#DY`, `x#X ": Kühe"#DX \\quad y#Y ": Hühner"#DY`)
        : tx(`x#X ": smaller number"#DX \\quad y#Y ": bigger number"#DY`, `x#X ": kleinere Zahl"#DX \\quad y#Y ": größere Zahl"#DY`),
      s: { v: "y", m: k, n: 0 },
      e: { x: 1, y: 1, c: S },
      sol: [x, y],
      setup: farm
        ? tx(`"${timesEn(k)} as many chickens": $y = ${k}x$. "${S} animals in total": $x + y = ${S}$.`, `„${timesDe(k)} so viele Hühner“: $y = ${k}x$. „Insgesamt ${S} Tiere“: $x + y = ${S}$.`)
        : tx(`"${timesEn(k)} as big": $y = ${k}x$. "Together ${S}": $x + y = ${S}$.`, `„${timesDe(k)} so groß“: $y = ${k}x$. „Zusammen ${S}“: $x + y = ${S}$.`),
      answer: farm
        ? tx(`There are ${x} cows and ${y} chickens.`, `Es sind ${x} Kühe und ${y} Hühner.`)
        : tx(`The numbers are ${x} and ${y}.`, `Die Zahlen sind ${x} und ${y}.`),
      swapped: farm
        ? tx("Ha, swapped! $x$ counts the **cows**, and there are fewer cows than chickens.", "Ha, vertauscht! $x$ zählt die **Kühe**, und davon gibt es weniger als Hühner.")
        : tx("Ha, swapped! $x$ is the **smaller** number.", "Ha, vertauscht! $x$ ist die **kleinere** Zahl."),
      extra: [],
      wrong: [
        [
          sysLine(solvedLine({ v: "x", m: k, n: 0 }), stdLine({ x: 1, y: 1, c: S })),
          REVERSED_TIMES(k, farm ? ["are there more **cows** or more **chickens**?", "Gibt es mehr **Kühe** oder mehr **Hühner**?"] : ["**which** number is bigger?", "**Welche** Zahl ist größer?"]),
        ],
        [sysLine(solvedLine({ v: "y", m: 1, n: k }), stdLine({ x: 1, y: 1, c: S })), PLUS(k, farm ? ["as many", "so viele"] : ["as big", "so groß"])],
        [sysLine(solvedLine({ v: "y", m: k, n: 0 }), stdLine({ x: -1, y: 1, c: S })), TOGETHER],
      ],
    };
  }
  if (kind === "prices") {
    const it = rng.pick([
      {
        en: ["salad", "pizza"],
        deText: ["Eine Pizza", "ein Salat"],
        deDefs: ["Preis für einen Salat", "Preis für eine Pizza"],
        deShort: ["Salat", "Pizza"],
        deAnswer: ["Ein Salat", "eine Pizza"],
        deCheap: "einen Salat",
      },
      {
        en: ["cap", "T-shirt"],
        deText: ["Ein T-Shirt", "eine Mütze"],
        deDefs: ["Preis für eine Mütze", "Preis für ein T-Shirt"],
        deShort: ["Mütze", "T-Shirt"],
        deAnswer: ["Eine Mütze", "ein T-Shirt"],
        deCheap: "eine Mütze",
      },
      {
        en: ["notebook", "book"],
        deText: ["Ein Buch", "ein Heft"],
        deDefs: ["Preis für ein Heft", "Preis für ein Buch"],
        deShort: ["Heft", "Buch"],
        deAnswer: ["Ein Heft", "ein Buch"],
        deCheap: "ein Heft",
      },
    ]);
    const d = rng.int(2, 6);
    const x = rng.int(3, 9);
    const y = x + d;
    const S = x + y;
    return {
      text: tx(
        `A ${it.en[1]} costs ${d} € more than a ${it.en[0]}. Together they cost ${S} €. Find both prices. ($x$: price of a ${it.en[0]} in €, $y$: price of a ${it.en[1]} in €)`,
        `${it.deText[0]} kostet ${d} € mehr als ${it.deText[1]}. Zusammen kosten sie ${S} €. Bestimme beide Preise. ($x$: ${it.deDefs[0]} in €, $y$: ${it.deDefs[1]} in €)`,
      ),
      defs: tx(`x#X ": ${it.en[0]} (€)"#DX \\quad y#Y ": ${it.en[1]} (€)"#DY`, `x#X ": ${it.deShort[0]} (€)"#DX \\quad y#Y ": ${it.deShort[1]} (€)"#DY`),
      s: { v: "y", m: 1, n: d },
      e: { x: 1, y: 1, c: S },
      sol: [x, y],
      setup: tx(`"${d} € more": $y = x + ${d}$. "Together ${S} €": $x + y = ${S}$.`, `„${d} € mehr“: $y = x + ${d}$. „Zusammen ${S} €“: $x + y = ${S}$.`),
      answer: tx(`A ${it.en[0]} costs ${x} €, a ${it.en[1]} ${y} €.`, `${it.deAnswer[0]} kostet ${x} €, ${it.deAnswer[1]} ${y} €.`),
      swapped: tx(`Ha, swapped! $x$ is the price of a **${it.en[0]}**, the cheaper one.`, `Ha, vertauscht! $x$ ist der Preis für **${it.deCheap}**, das Günstigere.`),
      extra: [],
      wrong: [
        [sysLine(solvedLine({ v: "x", m: 1, n: d }), stdLine({ x: 1, y: 1, c: S })), REVERSED(d, ["**which** one costs more?", "**Was** kostet mehr?"])],
        [sysLine(solvedLine({ v: "y", m: d, n: 0 }), stdLine({ x: 1, y: 1, c: S })), TIMES([`${d} € more`, `${d} € mehr`], ["Twice as much", "Doppelt so teuer"])],
        [sysLine(solvedLine({ v: "y", m: 1, n: d }), stdLine({ x: -1, y: 1, c: S })), TOGETHER],
      ],
    };
  }
  if (kind === "class") {
    const d = rng.int(2, 6);
    const x = rng.int(9, 14);
    const y = x + d;
    const S = x + y;
    return {
      text: tx(
        `In class 7b there are ${d} more girls than boys, ${S} pupils in total. How many boys ($x$) and girls ($y$) are in the class?`,
        `In der Klasse 7b gibt es ${d} Mädchen mehr als Jungen, insgesamt ${S} Kinder. Wie viele Jungen ($x$) und Mädchen ($y$) sind in der Klasse?`,
      ),
      defs: tx(`x#X ": boys"#DX \\quad y#Y ": girls"#DY`, `x#X ": Jungen"#DX \\quad y#Y ": Mädchen"#DY`),
      s: { v: "y", m: 1, n: d },
      e: { x: 1, y: 1, c: S },
      sol: [x, y],
      setup: tx(`"${d} more girls": $y = x + ${d}$. "${S} in total": $x + y = ${S}$.`, `„${d} Mädchen mehr“: $y = x + ${d}$. „Insgesamt ${S}“: $x + y = ${S}$.`),
      answer: tx(`There are ${x} boys and ${y} girls.`, `Es sind ${x} Jungen und ${y} Mädchen.`),
      swapped: tx("Ha, swapped! $x$ counts the **boys**, and there are fewer boys.", "Ha, vertauscht! $x$ zählt die **Jungen**, und davon gibt es weniger."),
      extra:
        S % 2 === 0
          ? [
              [
                xyWhen(S / 2, S / 2),
                [
                  tx("Not half and half", "Nicht halb und halb"),
                  tx(`Half and half doesn't work: there are ${d} more girls. Use **both** pieces of information.`, `Halbe-halbe geht nicht: Es sind ${d} Mädchen mehr. Nutze **beide** Angaben.`),
                ],
              ],
            ]
          : [],
      wrong: [
        [sysLine(solvedLine({ v: "x", m: 1, n: d }), stdLine({ x: 1, y: 1, c: S })), REVERSED(d, ["are there more **girls** or more **boys**?", "Gibt es mehr **Mädchen** oder mehr **Jungen**?"])],
        [sysLine(solvedLine({ v: "y", m: d, n: 0 }), stdLine({ x: 1, y: 1, c: S })), TIMES([`${d} more girls`, `${d} Mädchen mehr`], ["Twice as many", "Doppelt so viele"])],
        [sysLine(solvedLine({ v: "y", m: 1, n: d }), stdLine({ x: -1, y: 1, c: S })), TOGETHER],
      ],
    };
  }
  // rectangle
  const d = rng.int(2, 6);
  const x = rng.int(2, 9);
  const y = x + d;
  const U = 2 * x + 2 * y;
  return {
    text: tx(
      `A rectangle is ${d} cm longer than it is wide. Its perimeter is ${U} cm. How wide ($x$) and how long ($y$) is it, in cm?`,
      `Ein Rechteck ist ${d} cm länger als breit. Sein Umfang beträgt ${U} cm. Wie breit ($x$) und wie lang ($y$) ist es, in cm?`,
    ),
    defs: tx(`x#X ": width (cm)"#DX \\quad y#Y ": length (cm)"#DY`, `x#X ": Breite (cm)"#DX \\quad y#Y ": Länge (cm)"#DY`),
    s: { v: "y", m: 1, n: d },
    e: { x: 2, y: 2, c: U },
    sol: [x, y],
    setup: tx(
      `"${d} cm longer": $y = x + ${d}$. The perimeter is two widths and two lengths: $2x + 2y = ${U}$.`,
      `„${d} cm länger“: $y = x + ${d}$. Der Umfang besteht aus zwei Breiten und zwei Längen: $2x + 2y = ${U}$.`,
    ),
    answer: tx(`The rectangle is ${x} cm wide and ${y} cm long.`, `Das Rechteck ist ${x} cm breit und ${y} cm lang.`),
    swapped: tx("Ha, swapped! $x$ is the **width**, the shorter side.", "Ha, vertauscht! $x$ ist die **Breite**, die kürzere Seite."),
    extra:
      (U - d) % 2 === 0
        ? [
            [
              xyWhen((U - d) / 2, (U - d) / 2 + d),
              [
                tx("Only half the way round", "Nur halb herum"),
                tx(
                  "The perimeter goes **all the way round**: two widths and two lengths, so it's $2x + 2y$, not $x + y$.",
                  "Der Umfang geht **einmal ganz herum**: zwei Breiten und zwei Längen, also $2x + 2y$ und nicht $x + y$.",
                ),
              ],
            ],
          ]
        : [],
    wrong: [
      [
        sysLine(solvedLine({ v: "y", m: 1, n: d }), stdLine({ x: 1, y: 1, c: U })),
        [
          tx("Only half the way round", "Nur halb herum"),
          tx("The perimeter goes **all the way round**: two widths and two lengths.", "Der Umfang geht **einmal ganz herum**: zwei Breiten und zwei Längen."),
        ],
      ],
      [sysLine(solvedLine({ v: "x", m: 1, n: d }), stdLine({ x: 2, y: 2, c: U })), REVERSED(d, ["**which** side is longer?", "**Welche** Seite ist länger?"])],
      [sysLine(solvedLine({ v: "y", m: d, n: 0 }), stdLine({ x: 2, y: 2, c: U })), TIMES([`${d} cm longer`, `${d} cm länger`], ["Twice as long", "Doppelt so lang"])],
    ],
  };
}

const STORY_KINDS = ["ages", "times", "prices", "class", "rectangle", "farm"] as const;

function storyExercise(st: Story): Exercise {
  const frames = substitution(st.s, st.e, st.sol);
  frames[0] = { ...frames[0], note: joinText(tx("Set up one equation for each piece of information.", "Stell für jede Angabe eine Gleichung auf."), st.setup) };
  const last = frames.length - 1;
  frames[last] = { ...frames[last], note: joinText(st.answer, tx("Check it with the story: both statements fit.", "Probe am Text: Beide Angaben passen.")) };
  return {
    instruction: tx("Word problem", "Textaufgabe"),
    text: st.text,
    answer: pairAnswer(st.sol[0], st.sol[1]),
    hint: tx(
      "Write one equation for each piece of information. One of them says directly what $y$ is: put it into the other one.",
      "Stell für jede Angabe eine Gleichung auf. Eine davon sagt direkt, was $y$ ist: Setz sie in die andere ein.",
    ),
    solution: [{ math: st.defs, note: tx("First decide what $x$ and $y$ stand for.", "Leg zuerst fest, wofür $x$ und $y$ stehen.") }, ...frames],
    mistakes: subMistakes(st.s, st.e, [[xyWhen(st.sol[1], st.sol[0]), [tx("Swapped", "Vertauscht"), st.swapped]], ...st.extra]),
  };
}

function setupExercise(st: Story, rng: Rng): Exercise {
  const right = sysLine(solvedLine(st.s), stdLine(st.e));
  const all = [right, ...st.wrong.map((w) => w[0])];
  const order = rng.shuffle([0, 1, 2, 3]);
  const answer: Choice = { kind: "choice", options: order.map((i) => `$${all[i]}$`), correct: order.indexOf(0) };
  const mk = mistakeList(answer);
  st.wrong.forEach((w, k) => mk.add({ ...answer, correct: order.indexOf(k + 1) }, ...w[1]));
  return {
    instruction: tx("Which system fits?", "Welches LGS passt?"),
    text: joinText(st.text, tx("Which system of equations describes the story?", "Welches Gleichungssystem beschreibt die Geschichte?")),
    answer,
    hint: tx("Translate one sentence at a time. Then test: does the system say the same as the story?", "Übersetze einen Satz nach dem anderen. Prüf dann: Sagt das LGS dasselbe wie der Text?"),
    solution: [
      { math: st.defs, note: tx("What do $x$ and $y$ stand for?", "Wofür stehen $x$ und $y$?") },
      { math: sysSrc(solvedSrc(st.s, "1"), stdSrc(st.e, "2")), note: st.setup },
    ],
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Practice

function pickSol1(rng: Rng): Pt {
  for (;;) {
    const x = rng.int(1, 6);
    const y = rng.int(1, 6);
    if (x !== y || rng.chance(0.2)) return [x, y];
  }
}

function checkPairTask(rng: Rng): Exercise {
  for (;;) {
    const sol = pickSol1(rng);
    const e1 = friendlyStd(rng, sol[0], sol[1]);
    const e2 = friendlyStd(rng, sol[0], sol[1]);
    if (det(e1, e2) === 0 || e1.c < 0 || e2.c < -6) continue;
    const kind = rng.pick(["both", "I", "II", "none"] as const);
    let p: Pt | null = sol;
    if (kind === "I") p = otherPointOn(e1, sol, rng);
    if (kind === "II") p = otherPointOn(e2, sol, rng);
    if (kind === "none") p = [sol[0] + rng.pick([1, -1]), sol[1] + rng.pick([1, 0, -1])];
    if (!p || p[0] < 0 || p[1] < 0) continue;
    if (kind === "none" && (holds(e1, p[0], p[1]) || holds(e2, p[0], p[1]))) continue;
    return checkPairExercise(e1, e2, p);
  }
}

function whichPairTask(rng: Rng): Exercise {
  for (;;) {
    const sol = pickSol1(rng);
    if (sol[0] === sol[1]) continue;
    const e1 = friendlyStd(rng, sol[0], sol[1]);
    const e2 = friendlyStd(rng, sol[0], sol[1]);
    if (det(e1, e2) === 0 || e1.c < 0 || e2.c < -6) continue;
    const swapped: Pt = [sol[1], sol[0]];
    if (holds(e1, swapped[0], swapped[1]) && holds(e2, swapped[0], swapped[1])) continue;
    const a = otherPointOn(e1, sol, rng, [swapped]);
    const b = otherPointOn(e2, sol, rng, [swapped, ...(a ? [a] : [])]);
    if (!a || !b) continue;
    const wrongs: Wrong[] = [
      { p: swapped, why: "swapped" },
      { p: a, why: "onlyI" },
      { p: b, why: "onlyII" },
    ];
    return whichPairExercise(e1, e2, sol, wrongs, rng.shuffle([0, 1, 2, 3]));
  }
}

const TABLE_STORIES = ["plain", "plain", "candles", "taxi", "savings", "plants"] as const;

function tableTask(rng: Rng): Exercise {
  const kind = rng.pick(TABLE_STORIES);
  for (;;) {
    const x = rng.int(2, 5);
    if (kind === "plain") {
      const m1 = rng.pick([-2, -1, 1, 2, 3]);
      const m2 = rng.pick([-2, -1, 1, 2, 3]);
      if (m1 === m2) continue;
      const y = rng.int(1, 12);
      const r1 = { m: m1, n: y - m1 * x };
      const r2 = { m: m2, n: y - m2 * x };
      const values = TABLE_XS.flatMap((v) => [at(r1, v), at(r2, v)]);
      if (Math.min(...values) < -6 || Math.max(...values) > 24 || r1.n < -3 || r2.n < -3) continue;
      return tableExercise(r1, r2);
    }
    if (kind === "candles") {
      const m1 = rng.pick([2, 3]);
      const m2 = 1;
      const y = rng.int(2, 8);
      const n1 = y + m1 * x;
      const n2 = y + m2 * x;
      if (n1 - 6 * m1 < 0 || n2 - 6 * m2 < 0 || n1 > 24) continue;
      return tableExercise({ m: -m1, n: n1 }, { m: -m2, n: n2 }, {
        text: tx(
          `Candle I is ${n1} cm long and burns ${m1} cm shorter every hour. Candle II is ${n2} cm long and burns 1 cm shorter every hour. After how many hours ($x$) are both equally long, and how long ($y$, in cm)?`,
          `Kerze I ist ${n1} cm lang und brennt pro Stunde ${m1} cm ab. Kerze II ist ${n2} cm lang und brennt pro Stunde 1 cm ab. Nach wie vielen Stunden ($x$) sind beide gleich lang, und wie lang ($y$, in cm)?`,
        ),
        answer: (sx, sy) => tx(`After ${sx} hours both candles are ${sy} cm long: $L = \\{ ${pt(sx, sy)} \\}$.`, `Nach ${sx} Stunden sind beide Kerzen ${sy} cm lang: $L = \\{ ${pt(sx, sy)} \\}$.`),
      });
    }
    if (kind === "taxi") {
      const p1 = rng.int(1, 2);
      const p2 = p1 + rng.int(1, 2);
      const b2 = rng.int(1, 4);
      const b1 = b2 + (p2 - p1) * x;
      if (b1 > 12) continue;
      return tableExercise({ m: p1, n: b1 }, { m: p2, n: b2 }, {
        text: tx(
          `Taxi I costs ${b1} € to start plus ${p1} € per km. Taxi II costs ${b2} € to start plus ${p2} € per km. For how many km ($x$) do both cost the same, and how much ($y$, in €)?`,
          `Taxi I kostet ${b1} € Grundgebühr und ${p1} € pro km. Taxi II kostet ${b2} € Grundgebühr und ${p2} € pro km. Bei wie vielen km ($x$) kosten beide gleich viel, und wie viel ($y$, in €)?`,
        ),
        answer: (sx, sy) => tx(`For ${sx} km both taxis cost ${sy} €: $L = \\{ ${pt(sx, sy)} \\}$.`, `Bei ${sx} km kosten beide Taxis ${sy} €: $L = \\{ ${pt(sx, sy)} \\}$.`),
      });
    }
    if (kind === "savings") {
      const s1 = rng.int(2, 5);
      const s2 = rng.int(1, s1 - 1);
      const a1 = rng.int(0, 5);
      const a2 = a1 + (s1 - s2) * x;
      if (a2 > 20) continue;
      const [n1, n2] = rng.pick([
        ["Tom", "Lea"],
        ["Ali", "Mia"],
        ["Finn", "Ella"],
      ]);
      return tableExercise({ m: s1, n: a1 }, { m: s2, n: a2 }, {
        text: tx(
          `${n1} has ${a1} € and saves ${s1} € every week (I). ${n2} has ${a2} € and saves ${s2} € every week (II). After how many weeks ($x$) do both have the same amount, and how much ($y$, in €)?`,
          `${n1} hat ${a1} € und spart jede Woche ${s1} € dazu (I). ${n2} hat ${a2} € und spart jede Woche ${s2} € dazu (II). Nach wie vielen Wochen ($x$) haben beide gleich viel, und wie viel ($y$, in €)?`,
        ),
        answer: (sx, sy) => tx(`After ${sx} weeks both have ${sy} €: $L = \\{ ${pt(sx, sy)} \\}$.`, `Nach ${sx} Wochen haben beide ${sy} €: $L = \\{ ${pt(sx, sy)} \\}$.`),
      });
    }
    // plants
    const g1 = rng.int(2, 4);
    const g2 = rng.int(1, g1 - 1);
    const h1 = rng.int(1, 6);
    const h2 = h1 + (g1 - g2) * x;
    if (h2 > 16) continue;
    return tableExercise({ m: g1, n: h1 }, { m: g2, n: h2 }, {
      text: tx(
        `Plant I is ${h1} cm tall and grows ${g1} cm a week. Plant II is ${h2} cm tall and grows ${g2} cm a week. After how many weeks ($x$) are both equally tall, and how tall ($y$, in cm)?`,
        `Pflanze I ist ${h1} cm hoch und wächst ${g1} cm pro Woche. Pflanze II ist ${h2} cm hoch und wächst ${g2} cm pro Woche. Nach wie vielen Wochen ($x$) sind beide gleich hoch, und wie hoch ($y$, in cm)?`,
      ),
      answer: (sx, sy) => tx(`After ${sx} weeks both plants are ${sy} cm tall: $L = \\{ ${pt(sx, sy)} \\}$.`, `Nach ${sx} Wochen sind beide Pflanzen ${sy} cm hoch: $L = \\{ ${pt(sx, sy)} \\}$.`),
    });
  }
}

function graphTask(rng: Rng): Exercise {
  for (;;) {
    const S: Pt = [rng.int(0, 5), rng.int(0, 5)];
    const m1 = rng.pick([-2, -1, 1, 2, 3]);
    const m2 = rng.pick([-2, -1, 1, 2, 3]);
    if (m1 === m2) continue;
    const n1 = S[1] - m1 * S[0];
    const n2 = S[1] - m2 * S[0];
    if (n1 < -1 || n2 < -1 || n1 > 7 || n2 > 7 || n1 === n2 || (S[0] === 0 && S[1] === 0)) continue;
    return graphExercise(S, { m: m1, n: n1 }, { m: m2, n: n2 });
  }
}

function substitutionTask(rng: Rng): Exercise {
  const form = rng.pick(["ykx", "yxd", "xky", "xyd"] as const);
  for (;;) {
    const p = rng.pick([1, 1, 2, 3]);
    let s: Solved;
    let e: Std;
    let sol: Pt;
    if (form === "ykx" || form === "xky") {
      const k = rng.int(2, 4);
      const small = rng.int(1, 5);
      const q = rng.pick([1, 1, 2]);
      if (form === "ykx") {
        sol = [small, k * small];
        s = { v: "y", m: k, n: 0 };
        e = { x: p, y: q, c: p * sol[0] + q * sol[1] };
      } else {
        sol = [k * small, small];
        s = { v: "x", m: k, n: 0 };
        e = { x: q, y: p, c: q * sol[0] + p * sol[1] };
      }
    } else {
      const d = rng.nonZero(-5, 6);
      const base = rng.int(1, 8);
      if (base + d < 1) continue;
      if (form === "yxd") {
        sol = [base, base + d];
        s = { v: "y", m: 1, n: d };
        e = { x: p, y: 1, c: p * sol[0] + sol[1] };
      } else {
        sol = [base + d, base];
        s = { v: "x", m: 1, n: d };
        e = { x: 1, y: p, c: sol[0] + p * sol[1] };
      }
    }
    if (e.c > 40) continue;
    return substitutionExercise(s, e, sol);
  }
}

/** Level 1 practice: check a pair, find the solution among pairs, tables, graphs, substitution and stories. */
export function generate1(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.13) return checkPairTask(rng);
  if (r < 0.25) return whichPairTask(rng);
  if (r < 0.41) return tableTask(rng);
  if (r < 0.55) return graphTask(rng);
  if (r < 0.72) return substitutionTask(rng);
  if (r < 0.89) return storyExercise(makeStory(rng, rng.pick(STORY_KINDS)));
  return setupExercise(makeStory(rng, rng.pick(STORY_KINDS)), rng);
}

// ---------------------------------------------------------------------------
// Lesson

const COINS1: Std = { x: 1, y: 1, c: 8 };
const COINS2: Std = { x: 1, y: 2, c: 11 };
const pairsOfI = [1, 2, 3, 4, 5, 6].map((x) => [x, 8 - x] as Pt);
const pairList = (style: (p: Pt) => string) => pairsOfI.map((p) => style(p)).join(" \\quad ");

const coinFrames: Frame[] = [
  {
    math: `\\blob{"(I)"#L1 ${stdSrc(COINS1, "1")}}#G1`,
    note: tx(
      "Call the number of 1-€ coins $x$ and the number of 2-€ coins $y$. **Condition (I)**: Mia has 8 coins, so $x + y = 8$.",
      "Nenne die Anzahl der 1-€-Münzen $x$ und die Anzahl der 2-€-Münzen $y$. **Bedingung (I)**: Mia hat 8 Münzen, also $x + y = 8$.",
    ),
  },
  {
    math: sysSrc(stdSrc(COINS1, "1"), stdSrc(COINS2, "2")),
    note: tx(
      "**Condition (II)**: each 1-€ coin is worth 1 €, each 2-€ coin 2 €, together 11 €: $x + 2y = 11$.",
      "**Bedingung (II)**: Jede 1-€-Münze ist 1 € wert, jede 2-€-Münze 2 €, zusammen 11 €: $x + 2y = 11$.",
    ),
  },
  {
    math: sysSrc(stdSrc(COINS1, "1"), stdSrc(COINS2, "2")),
    highlight: ["L1", "L2"],
    note: tx(
      "Two equations with the same two unknowns that must be true **at the same time**: that's a **linear system of equations** (in German: LGS).",
      "Zwei Gleichungen mit denselben zwei Unbekannten, die **gleichzeitig** gelten müssen: Das ist ein **lineares Gleichungssystem**, kurz **LGS**.",
    ),
  },
  {
    math: pairList((p) => `${pt(p[0], p[1])}#P${p[0]}`),
    note: tx(
      "(I) on its own allows lots of pairs: 1 and 7, 2 and 6, 3 and 5, … Each one is a **pair of numbers** $(x | y)$: $x$ first, then $y$.",
      "(I) allein lässt viele Paare zu: 1 und 7, 2 und 6, 3 und 5, … Jedes ist ein **Zahlenpaar** $(x | y)$: zuerst $x$, dann $y$.",
    ),
  },
  {
    math: pairList((p) => (p[0] === 5 ? `\\green{${pt(p[0], p[1])}#P${p[0]}}#H${p[0]}` : `\\fade{${pt(p[0], p[1])}#P${p[0]}}#H${p[0]}`)),
    note: tx(
      "Now test (II) with each of them. Only one pair works: $5 + 2 \\cdot 3 = 11$.",
      "Teste jetzt jedes davon mit (II). Nur ein Paar passt: $5 + 2 \\cdot 3 = 11$.",
    ),
  },
  {
    math: resultSrc(5, 3),
    note: tx(
      "Mia has **5** one-euro coins and **3** two-euro coins. The **solution** of the system is the pair that makes **both** equations true: $L = \\{ (5 | 3) \\}$.",
      "Mia hat **5** Ein-Euro-Münzen und **3** Zwei-Euro-Münzen. Die **Lösung** des LGS ist das Zahlenpaar, das **beide** Gleichungen erfüllt: $L = \\{ (5 | 3) \\}$.",
    ),
  },
];

const T1: Std = { x: 2, y: 1, c: 10 };
const T2: Std = { x: 1, y: -1, c: 2 };
const [tryPut, tryVerdict] = testFrames(T1, T2, [3, 4]);
const [goodPut, goodVerdict] = testFrames(T1, T2, [4, 2]);
const testLessonFrames: Frame[] = [
  { math: sysSrc(stdSrc(T1, "1"), stdSrc(T2, "2")), note: tx("Is $(3 | 4)$ a solution? Put in $x = 3$ and $y = 4$.", "Ist $(3 | 4)$ eine Lösung? Setze $x = 3$ und $y = 4$ ein.") },
  {
    math: tryPut,
    note: tx("The first number goes in for $x$, the second for $y$. Now work out each left side.", "Die erste Zahl kommt für $x$, die zweite für $y$. Rechne jetzt jeweils die linke Seite aus."),
  },
  {
    math: tryVerdict,
    note: tx(
      "(I) is true, but (II) gives $-1$ instead of $2$. One false equation is enough: $(3 | 4)$ is **not** a solution.",
      "(I) stimmt, aber (II) ergibt $-1$ statt $2$. Eine falsche Gleichung reicht: $(3 | 4)$ ist **keine** Lösung.",
    ),
  },
  { math: goodPut, note: tx("Next try: $(4 | 2)$.", "Nächster Versuch: $(4 | 2)$.") },
  {
    math: goodVerdict,
    note: tx(
      "Both true! So $L = \\{ (4 | 2) \\}$. Putting a pair into **both** equations like this is called **checking** it (in German: die Probe). Always do it at the end.",
      "Beide stimmen! Also ist $L = \\{ (4 | 2) \\}$. Ein Zahlenpaar so in **beide** Gleichungen einzusetzen, heißt **Probe**. Mach sie am Ende immer.",
    ),
  },
];

const G1: Rule = { m: 1, n: 1 };
const G2: Rule = { m: -1, n: 5 };
const graphLessonFrames: Frame[] = [
  {
    math: sysSrc(solvedSrc({ v: "y", ...G1 }, "1"), solvedSrc({ v: "y", ...G2 }, "2")),
    note: tx(
      "Both equations are solved for $y$. Each one gives a line: all its fitting pairs lie on it. Line I is purple, line II is labelled II.",
      "Beide Gleichungen sind nach $y$ aufgelöst. Jede ergibt eine Gerade: Alle passenden Paare liegen darauf. Gerade I ist lila, Gerade II ist mit II beschriftet.",
    ),
  },
  {
    math: `S#S ${pt("2#rx", "3#ry")}`,
    note: tx(
      "The lines cross at $S(2 | 3)$, the **intersection point** (Schnittpunkt). Read $x$ on the $x$-axis first, then $y$ on the $y$-axis.",
      "Die Geraden schneiden sich in $S(2 | 3)$, dem **Schnittpunkt**. Lies zuerst $x$ auf der $x$-Achse ab, dann $y$ auf der $y$-Achse.",
    ),
  },
  {
    math: sysSrc(`3#1v =#e1 ${rightAt(1, 1, 2)}`, `3#2v =#e2 ${rightAt(-1, 5, 2)}`, "(I)", "(II)", ["green", "green"]),
    note: tx("Check: $3 = 2 + 1$ and $3 = 5 - 2$. Both true!", "Probe: $3 = 2 + 1$ und $3 = 5 - 2$. Beide stimmen!"),
  },
  {
    math: resultSrc(2, 3),
    note: tx(
      "So $L = \\{ (2 | 3) \\}$. Reading a graph can be a little off, so the check is a must.",
      "Also ist $L = \\{ (2 | 3) \\}$. Beim Ablesen kann man sich leicht verschätzen, deshalb ist die Probe Pflicht.",
    ),
  },
];

/** y = 2x and x + y = 9: the 2x slides into the place of y. */
const aloneFrames: Frame[] = [
  {
    math: sysSrc(`y#Y1 =#e1 2#k x#kx`, `x#X2 +#p2 y#Y2 =#e2 9#c2`),
    highlight: ["k", "kx"],
    note: tx("(I) says: $y$ is the same as $2x$.", "(I) sagt: $y$ ist dasselbe wie $2x$."),
  },
  {
    math: `x#X2 +#p2 2#k x#kx =#e2 9#c2`,
    highlight: ["k", "kx"],
    note: tx("So in (II), **replace** $y$ by $2x$. Now there's only one unknown left: $x$.", "Also **ersetzt** du in (II) das $y$ durch $2x$. Jetzt gibt es nur noch eine Unbekannte: $x$."),
  },
  {
    math: `3#k x#kx =#e2 9#c2 \\quad \\blob{|#opb \\, :#ops 3#op}#opg`,
    note: tx("Combine: $x + 2x = 3x$. Then divide both sides by $3$.", "Fasse zusammen: $x + 2x = 3x$. Teile dann beide Seiten durch $3$."),
  },
  { math: `x#kx =#e2 3#c2`, note: tx("So $x = 3$. Half way there!", "Also ist $x = 3$. Halbzeit!") },
  {
    math: `y#Y1 =#e1 2#k \\cdot#d 3#c2 =#e3 6#r`,
    note: tx("Put $x = 3$ into (I): $y = 2 \\cdot 3 = 6$.", "Setze $x = 3$ in (I) ein: $y = 2 \\cdot 3 = 6$."),
  },
  {
    math: resultSrc(3, 6),
    note: tx("Check in (II): $3 + 6 = 9$. True! So $L = \\{ (3 | 6) \\}$.", "Probe mit (II): $3 + 6 = 9$. Stimmt! Also ist $L = \\{ (3 | 6) \\}$."),
  },
];

const AGES: Story = {
  text: "",
  defs: tx(`x#X ": Emma's age"#DX \\quad y#Y ": Ben's age"#DY`, `x#X ": Emmas Alter"#DX \\quad y#Y ": Bens Alter"#DY`),
  s: { v: "y", m: 1, n: 4 },
  e: { x: 1, y: 1, c: 30 },
  sol: [13, 17],
  setup: tx(`"4 years older": $y = x + 4$. "Together 30": $x + y = 30$.`, `„4 Jahre älter“: $y = x + 4$. „Zusammen 30“: $x + y = 30$.`),
  answer: tx("Emma is 13 and Ben is 17. Check: 17 is 4 more than 13, and $13 + 17 = 30$.", "Emma ist 13 und Ben 17 Jahre alt. Probe: 17 ist 4 mehr als 13, und $13 + 17 = 30$."),
  swapped: "",
  extra: [],
  wrong: [],
};
const agesFrames: Frame[] = (() => {
  const frames = substitution(AGES.s, AGES.e, AGES.sol);
  frames[0] = { ...frames[0], note: AGES.setup };
  frames[frames.length - 1] = { ...frames[frames.length - 1], note: AGES.answer };
  return [{ math: AGES.defs, note: tx("Choose letters for the unknowns: $x$ is Emma's age, $y$ is Ben's age.", "Wähle Buchstaben für die Unbekannten: $x$ ist Emmas Alter, $y$ ist Bens Alter.") }, ...frames];
})();

const PIZZA: Story = {
  text: tx(
    "A pizza costs 3 € more than a salad. Together they cost 13 €. Find both prices. ($x$: price of the salad in €, $y$: price of the pizza in €)",
    "Eine Pizza kostet 3 € mehr als ein Salat. Zusammen kosten sie 13 €. Bestimme beide Preise. ($x$: Preis für den Salat in €, $y$: Preis für die Pizza in €)",
  ),
  defs: tx(`x#X ": salad (€)"#DX \\quad y#Y ": pizza (€)"#DY`, `x#X ": Salat (€)"#DX \\quad y#Y ": Pizza (€)"#DY`),
  s: { v: "y", m: 1, n: 3 },
  e: { x: 1, y: 1, c: 13 },
  sol: [5, 8],
  setup: tx(`"3 € more": $y = x + 3$. "Together 13 €": $x + y = 13$.`, `„3 € mehr“: $y = x + 3$. „Zusammen 13 €“: $x + y = 13$.`),
  answer: tx("The salad costs 5 €, the pizza 8 €.", "Der Salat kostet 5 €, die Pizza 8 €."),
  swapped: tx("Ha, swapped! $x$ is the price of the **salad**, the cheaper one.", "Ha, vertauscht! $x$ ist der Preis für den **Salat**, das ist das Günstigere."),
  extra: [
    [
      xyWhen(6.5, 6.5),
      [
        tx("Not half and half", "Nicht halb und halb"),
        tx("Half each doesn't work: the pizza costs 3 € **more**. Use both pieces of information.", "Halbe-halbe geht nicht: Die Pizza kostet 3 € **mehr**. Nutze beide Angaben."),
      ],
    ],
  ],
  wrong: [],
};

/** Level 1: what a system is, testing a pair, tables, the crossing point and simple substitution. */
export const level1: LevelLesson = {
  summary: [
    {
      title: tx("What a solution is", "Was eine Lösung ist"),
      body: tx(
        "A linear system (LGS) is two equations that must be true **at the same time**. Its solution is a pair $(x | y)$ that makes **both** equations true.",
        "Ein lineares Gleichungssystem (LGS) besteht aus zwei Gleichungen, die **gleichzeitig** gelten müssen. Seine Lösung ist ein Zahlenpaar $(x | y)$, das **beide** Gleichungen erfüllt.",
      ),
      examples: ['"(I)" x + y = 8 \\quad "(II)" x + 2y = 11', 'L = "{" (5 \\, | \\, 3) "}"'],
      tone: "rule",
    },
    {
      title: tx("Checking a pair (Probe)", "Ein Zahlenpaar prüfen (Probe)"),
      body: tx(
        "Put the first number in for $x$ and the second for $y$, in **both** equations. One false equation is enough to rule the pair out.",
        "Setze die erste Zahl für $x$ und die zweite für $y$ ein, und zwar in **beide** Gleichungen. Eine falsche Gleichung reicht, und das Paar fällt raus.",
      ),
      examples: ["(4 \\, | \\, 2): \\quad 2 \\cdot 4 + 2 = 10 , \\quad 4 - 2 = 2"],
      tone: "rule",
    },
    {
      title: tx("Table of values", "Wertetabelle"),
      body: tx(
        "Work out $y$ in both equations for $x = 0, 1, 2, …$ The solution is the column where both rows show the **same** $y$.",
        "Rechne in beiden Gleichungen $y$ für $x = 0, 1, 2, …$ aus. Die Lösung steht in der Spalte, in der beide Zeilen **dasselbe** $y$ zeigen.",
      ),
      examples: ["y = 3x + 1 , \\quad y = x + 7", "x = 3: \\quad 10 = 10"],
      tone: "rule",
    },
    {
      title: tx("Crossing point", "Schnittpunkt"),
      body: tx(
        "Each equation is a line. The point where the lines cross is the solution. Reading can be inexact, so always check it.",
        "Jede Gleichung ist eine Gerade. Ihr Schnittpunkt ist die Lösung. Ablesen ist manchmal ungenau, deshalb immer die Probe machen.",
      ),
      examples: ["y = x + 1 , \\quad y = -x + 5 \\quad \\Rightarrow \\quad S(2 \\, | \\, 3)"],
      tone: "tip",
    },
    {
      title: tx("One variable alone: substitute", "Eine Variable allein: einsetzen"),
      body: tx(
        "If one equation says what $y$ is, replace $y$ in the other equation by that term. Solve for $x$, then work out $y$.",
        "Sagt eine Gleichung, was $y$ ist, ersetzt du $y$ in der anderen Gleichung durch diesen Term. Löse nach $x$ auf und rechne dann $y$ aus.",
      ),
      examples: ["y = 2x , \\quad x + y = 9", "x + 2x = 9 \\Rightarrow x = 3 , \\; y = 6"],
      tone: "rule",
    },
    {
      title: tx("x first, then y", "Erst x, dann y"),
      body: tx(
        "In a pair $(x | y)$ the first number is always $x$. In word problems, say what $x$ and $y$ stand for and answer in a sentence.",
        "In einem Zahlenpaar $(x | y)$ steht immer zuerst $x$. Schreib bei Textaufgaben auf, wofür $x$ und $y$ stehen, und antworte mit einem Satz.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Two conditions at once", "Zwei Bedingungen auf einmal"),
      blob: tx("Two clues, one answer. Let's play detective!", "Zwei Hinweise, eine Lösung. Wir spielen Detektiv!"),
      body: tx(
        "Mia has 8 coins in her pocket, only 1-€ and 2-€ coins. Together they are worth 11 €. How many of each kind does she have?",
        "Mia hat 8 Münzen in der Tasche, nur 1-€- und 2-€-Münzen. Zusammen sind sie 11 € wert. Wie viele Münzen hat sie von jeder Sorte?",
      ),
      frames: coinFrames,
    },
    {
      type: "explain",
      title: tx("Checking a pair", "Ein Zahlenpaar prüfen"),
      blob: tx("Got a guess? Put it in and check both equations!", "Du hast eine Vermutung? Setz sie ein und prüf beide Gleichungen!"),
      body: tx(
        "To test a pair, put $x$ and $y$ into **each** equation. Only if both are true is the pair a solution.",
        "Um ein Zahlenpaar zu testen, setzt du $x$ und $y$ in **jede** Gleichung ein. Nur wenn beide stimmen, ist das Paar eine Lösung.",
      ),
      frames: testLessonFrames,
    },
    {
      type: "widget",
      title: tx("The pair tester", "Der Zahlenpaar-Tester"),
      blob: tx("Drag the point around. Where do both turn green?", "Zieh den Punkt herum. Wo leuchten beide grün?"),
      body: tx(
        "Every point $P(x | y)$ on the grid is a pair of numbers. Drag it and watch both equations. Pairs that fit leave a mark, and soon you'll see that they lie on a **line**.",
        "Jeder Punkt $P(x | y)$ im Gitter ist ein Zahlenpaar. Zieh ihn herum und beobachte beide Gleichungen. Passende Paare hinterlassen eine Markierung, und bald siehst du: Sie liegen auf einer **Geraden**.",
      ),
      widget: PairTester,
    },
    {
      type: "check",
      blob: tx("Four pairs, one solution. Test them!", "Vier Paare, eine Lösung. Teste sie!"),
      exercise: whichPairExercise(
        { x: 1, y: 1, c: 7 },
        { x: 3, y: -1, c: 5 },
        [3, 4],
        [
          { p: [4, 3], why: "swapped" },
          { p: [2, 5], why: "onlyI" },
          { p: [2, 1], why: "onlyII" },
        ],
        [1, 3, 0, 2],
      ),
    },
    {
      type: "widget",
      title: tx("Solving with a table of values", "Mit einer Wertetabelle lösen"),
      blob: tx("Step through the table. When do both rows show the same number?", "Geh die Tabelle durch. Wann steht in beiden Zeilen dieselbe Zahl?"),
      body: tx(
        "When both equations say what $y$ is, make a table: for each $x$, work out $y$ in both. Where the values are equal, both conditions hold at once.",
        "Sagen beide Gleichungen, was $y$ ist, legst du eine Tabelle an: Für jedes $x$ rechnest du $y$ in beiden aus. Wo die Werte gleich sind, gelten beide Bedingungen gleichzeitig.",
      ),
      widget: TableLab,
    },
    {
      type: "check",
      blob: tx("Continue the table until both rows agree.", "Setz die Tabelle fort, bis beide Zeilen übereinstimmen."),
      exercise: tableExercise({ m: 2, n: 1 }, { m: 1, n: 4 }),
    },
    {
      type: "explain",
      title: tx("Reading the crossing point", "Den Schnittpunkt ablesen"),
      blob: tx("Every equation is a line. Two lines, one crossing!", "Jede Gleichung ist eine Gerade. Zwei Geraden, ein Schnittpunkt!"),
      body: tx(
        "Draw both equations as lines. A point on **both** lines fits both equations, so the intersection point is the solution.",
        "Zeichne beide Gleichungen als Geraden. Ein Punkt auf **beiden** Geraden passt zu beiden Gleichungen, also ist der Schnittpunkt die Lösung.",
      ),
      visual: visual(LegendGraph, {
        xRange: [-1, 6],
        yRange: [-1, 6],
        functions: [
          // Drawn up to x = 5, where it leaves the picture at the top: that way its label sits inside.
          { f: (t: number) => t + 1, key: "I", color: "blob", label: "I", to: 5 },
          { f: (t: number) => -t + 5, key: "II", color: "ink", label: "II" },
        ],
        points: [{ x: 2, y: 3, label: "S(2 | 3)", color: "blob", key: "S" }],
        legend: [
          { name: "I", src: plain(solvedSrc({ v: "y", ...G1 }, "1")) },
          { name: "II", src: plain(solvedSrc({ v: "y", ...G2 }, "2")) },
        ],
      }),
      frames: graphLessonFrames,
    },
    {
      type: "check",
      blob: tx("Find the crossing, then check it!", "Such den Schnittpunkt und mach die Probe!"),
      exercise: graphExercise(
        [1, 3],
        { m: 1, n: 2 },
        { m: -2, n: 5 },
      ),
    },
    {
      type: "explain",
      title: tx("When y is already alone", "Wenn y schon allein steht"),
      blob: tx("If y is already alone, just swap it in!", "Steht y schon allein, setz es einfach ein!"),
      body: tx(
        "If one equation says what $y$ is, you can **replace** $y$ in the other equation. Then only $x$ is left, and you solve an ordinary equation. This is the substitution method (Einsetzungsverfahren).",
        "Sagt eine Gleichung, was $y$ ist, kannst du $y$ in der anderen Gleichung **ersetzen**. Dann bleibt nur $x$ übrig, und du löst eine ganz normale Gleichung. Das ist das **Einsetzungsverfahren**.",
      ),
      frames: aloneFrames,
    },
    {
      type: "explain",
      title: tx("Stories with two unknowns", "Textaufgaben mit zwei Unbekannten"),
      blob: tx("Every sentence with a number hides an equation.", "In jedem Satz mit einer Zahl steckt eine Gleichung."),
      body: tx(
        "Ben is 4 years older than Emma. Together they are 30 years old. Choose letters, turn each piece of information into an equation, solve, and answer in a sentence. Put the term in brackets when you substitute.",
        "Ben ist 4 Jahre älter als Emma. Zusammen sind sie 30 Jahre alt. Wähle Buchstaben, mach aus jeder Angabe eine Gleichung, löse sie und antworte mit einem Satz. Setz den Term beim Einsetzen in Klammern.",
      ),
      frames: agesFrames,
    },
    {
      type: "check",
      blob: tx("Your turn: set it up and solve it.", "Jetzt du: aufstellen und lösen."),
      exercise: storyExercise(PIZZA),
    },
  ],
};
