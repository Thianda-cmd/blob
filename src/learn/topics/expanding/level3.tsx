"use client";

import type { ComponentType } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { equivalentText } from "@/learn/engine/expr";
import { createRng, gcd, type Rng } from "@/learn/engine/rng";
import { plainPoly, polyMul, showPoly, type Poly } from "@/learn/engine/terms";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { EXPAND_SIMPLIFY, polySrc } from "./level2";
import { choose, ExpandingBinomCard, ExpandingBinomTask, ExpandingCube, ExpandingPascal, ExpandingSquarePuzzle } from "./widgets3";

// ---------------------------------------------------------------------------
// Binomials p·v ± q·w (w = "" for a plain number) and how they are written.

type Bin = { p: number; v: string; q: number; w: string };

/** "3x", "x", "5", "2y". */
const mono = (c: number, v: string) => (v ? `${c === 1 ? "" : c}${v}` : String(c));
const A_ = (b: Bin) => mono(b.p, b.v);
const B_ = (b: Bin) => mono(b.q, b.w);
/** The square written out: "9x^2", "25". */
const sqOf = (c: number, v: string) => (v ? `${c * c === 1 ? "" : c * c}${v}^2` : String(c * c));
const A2 = (b: Bin) => sqOf(b.p, b.v);
const B2 = (b: Bin) => sqOf(b.q, b.w);
const MID = (b: Bin) => `${2 * b.p * b.q}${b.v}${b.w}`;
/** "(3x)^2", "x^2", "5^2". */
const asSquare = (c: number, v: string) => (v && c !== 1 ? `(${mono(c, v)})^2` : `${mono(c, v)}^2`);
const sgn = (s: number) => (s > 0 ? "+" : "-");
const expandedSq = (b: Bin, s: number) => `${A2(b)} ${sgn(s)} ${MID(b)} + ${B2(b)}`;
const expandedConj = (b: Bin) => `${A2(b)} - ${B2(b)}`;
const factSq = (b: Bin, s: number) => `(${A_(b)} ${sgn(s)} ${B_(b)})^2`;
const factConj = (b: Bin) => `(${A_(b)} + ${B_(b)})(${A_(b)} - ${B_(b)})`;

// Keyed pieces for the animations: coefficient `${id}c`, variable `${id}v`, exponent `${id}e`, bracket `${id}b`.
const monoK = (c: number, v: string, id: string) => (v ? `${c === 1 ? "" : `${c}#${id}c `}${v}#${id}v` : `${c}#${id}c`);
const sqK = (c: number, v: string, id: string) => (v ? `${c * c === 1 ? "" : `${c * c}#${id}c `}${v}#${id}v ^{2#${id}e}` : `${c * c}#${id}c`);
const powK = (c: number, v: string, id: string) => (v && c !== 1 ? `(${monoK(c, v, id)})#${id}b ^{2#${id}e}` : `${monoK(c, v, id)} ^{2#${id}e}`);
const midK = (b: Bin) => `${2 * b.p * b.q}#mc ${b.v}#mv${b.w ? ` ${b.w}#mw` : ""}`;

/** Letters for the tasks: not a or b, which name the parts of the binomial formulas. */
const VARS3 = ["x", "x", "y", "z"];
/** Two letters in alphabetical order, so the middle term reads "xy" or "yz". */
const PAIRS: [string, string][] = [
  ["x", "y"],
  ["x", "y"],
  ["y", "z"],
];

/** "$25 = 5^2$", or just "$x^2$" when there is nothing to see. */
const squareNote = (c: number, v: string) => (v && c === 1 ? `$${v}^2$` : `$${sqOf(c, v)} = ${asSquare(c, v)}$`);

/** a² ± 2ab + b² → (a ± b)². */
function squareFrames(b: Bin, s: number): Frame[] {
  const A = A_(b);
  const B = B_(b);
  const formula = s > 0 ? tx("Plus in the middle: the **1st binomial formula**.", "Plus in der Mitte: die **1. binomische Formel**.") : tx("Minus in the middle: the **2nd binomial formula**.", "Minus in der Mitte: die **2. binomische Formel**.");
  return [
    {
      math: `${sqK(b.p, b.v, "A")} ${sgn(s)}#s ${midK(b)} +#p ${sqK(b.q, b.w, "B")}`,
      note: tx(`The first and the last term are squares: ${squareNote(b.p, b.v)} and ${squareNote(b.q, b.w)}. Smells like a binomial formula!`, `Der erste und der letzte Term sind Quadrate: ${squareNote(b.p, b.v)} und ${squareNote(b.q, b.w)}. Das riecht nach einer binomischen Formel!`),
      highlight: ["Ac", "Av", "Ae", "Bc", "Bv", "Be"],
    },
    { math: `${powK(b.p, b.v, "A")} ${sgn(s)}#s ${midK(b)} +#p ${powK(b.q, b.w, "B")}`, note: tx(`So $a = ${A}$ and $b = ${B}$.`, `Also ist $a = ${A}$ und $b = ${B}$.`) },
    {
      math: `${powK(b.p, b.v, "A")} ${sgn(s)}#s \\hl{2 \\cdot ${A} \\cdot ${B}} +#p ${powK(b.q, b.w, "B")}`,
      note: txMap((t, l) => `${t("Check the middle term", "Prüf den Mittelterm")}: $2ab = 2 \\cdot ${A} \\cdot ${B} = ${MID(b)}$. ${t("It fits!", "Passt!")} ${resolveText(formula, l)}`),
    },
    { math: `(${monoK(b.p, b.v, "A")} ${sgn(s)}#s ${monoK(b.q, b.w, "B")})#R ^{2#Ae}`, note: tx(`So $${expandedSq(b, s)} = ${factSq(b, s)}$.`, `Also ist $${expandedSq(b, s)} = ${factSq(b, s)}$.`) },
  ];
}

/** a² − b² → (a + b)(a − b). */
function conjFrames(b: Bin): Frame[] {
  const A = A_(b);
  const B = B_(b);
  return [
    {
      math: `${sqK(b.p, b.v, "A")} -#s ${sqK(b.q, b.w, "B")}`,
      note: tx("Two squares with a **minus** between them and no middle term: the **3rd binomial formula** backwards.", "Zwei Quadrate mit einem **Minus** dazwischen und kein Mittelterm: die **3. binomische Formel** rückwärts."),
      highlight: ["s"],
    },
    { math: `${powK(b.p, b.v, "A")} -#s ${powK(b.q, b.w, "B")}`, note: tx(`$a = ${A}$ and $b = ${B}$.`, `$a = ${A}$ und $b = ${B}$.`) },
    {
      math: `(${monoK(b.p, b.v, "A")} +#p ${monoK(b.q, b.w, "C")})#L (${monoK(b.p, b.v, "D")} -#s ${monoK(b.q, b.w, "B")})#R`,
      note: tx(`$a^2 - b^2 = (a + b)(a - b)$, so $${expandedConj(b)} = ${factConj(b)}$.`, `$a^2 - b^2 = (a + b)(a - b)$, also $${expandedConj(b)} = ${factConj(b)}$.`),
    },
  ];
}

// ---------------------------------------------------------------------------
// Typical mistakes

function exprMistakes(right: string) {
  const out: Mistake[] = [];
  const add = (value: Poly, v: string, title: Text, say: Text) => {
    const text = plainPoly(value, v);
    if (equivalentText(text, right) || out.some((x) => x.when.kind === "expr" && equivalentText(x.when.value, text))) return;
    out.push({ when: { kind: "expr", value: text }, title, say });
  };
  return { out, add };
}

function numberMistakes(right: number) {
  const out: Mistake[] = [];
  const add = (value: number, title: Text, say: Text) => {
    if (value === right || !Number.isFinite(value) || out.some((x) => x.when.kind === "number" && x.when.value === value)) return;
    out.push({ when: { kind: "number", value }, title, say });
  };
  return { out, add };
}

type Opt = { text: Text; title?: Text; say?: Text };

/** Choice options: the right one plus three distractors (each with Blob's line), shuffled. */
function choiceTask(rng: Rng, right: Text, wrong: Opt[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const seen = new Set([JSON.stringify(right)]);
  const picked: Opt[] = [];
  for (const w of wrong) {
    const k = JSON.stringify(w.text);
    if (seen.has(k) || picked.length === 3) continue;
    seen.add(k);
    picked.push(w);
  }
  const options = rng.shuffle([{ text: right } as Opt, ...picked]);
  const texts = options.map((o) => o.text);
  const correct = options.findIndex((o) => o.text === right);
  return {
    answer: { kind: "choice", options: texts, correct },
    mistakes: options.flatMap((o, i) => (o.say ? [{ when: { kind: "choice" as const, options: texts, correct: i }, title: o.title, say: o.say }] : [])),
  };
}

const $ = (s: string) => `$${s}$`;

// ---------------------------------------------------------------------------
// Task builders

const FACTOR_BINOMIAL = tx("Factorise with a binomial formula", "Faktorisiere mit einer binomischen Formel");
const FACTOR_COMPLETE = tx("Factorise completely", "Faktorisiere vollständig");
const FIND_MN = tx("Find m and n", "Bestimme m und n");
const COMPLETE = tx("Complete to a perfect square", "Ergänze zu einem vollständigen Quadrat");
const CLEVER = tx("Calculate cleverly", "Rechne geschickt");
const PASCAL = tx("Expand with Pascal's triangle", "Multipliziere mit dem Pascalschen Dreieck aus");
const COEFFICIENT = tx("Find the coefficient", "Bestimme den Koeffizienten");
const BINOM = tx("Calculate the binomial coefficient", "Berechne den Binomialkoeffizienten");

const NOT_POSSIBLE = tx("Not possible with a binomial formula", "Mit keiner binomischen Formel möglich");

const SIGN_SAY = (s: number) =>
  s < 0
    ? tx("The middle term has a **minus**, so it's the 2nd binomial formula: $(a - b)^2$.", "Der Mittelterm hat ein **Minus**, also ist es die 2. binomische Formel: $(a - b)^2$.")
    : tx("The middle term has a **plus**, so it's the 1st binomial formula: $(a + b)^2$.", "Der Mittelterm hat ein **Plus**, also ist es die 1. binomische Formel: $(a + b)^2$.");

/** Which factorisation is right? kind: square (s = ±1), conjugate, or none at all. */
function factorBinomialTask(rng: Rng, b: Bin, kind: "sq" | "conj" | "sum" | "negLast", s = 1): Exercise {
  const A = A_(b);
  const B = B_(b);
  let math: string;
  let right: Text;
  let wrong: Opt[];
  let solution: Frame[];
  const take = (title: Text, say: Text, text: string): Opt => ({ text: $(text), title, say });
  // "Not possible" is offered in about half of the tasks that do factorise, so it isn't a giveaway when it shows up.
  const notPossible = (say: Text): Opt[] => (rng.chance(0.5) ? [{ text: NOT_POSSIBLE, title: tx("It does work", "Es geht doch"), say }] : []);
  if (kind === "sq") {
    math = expandedSq(b, s);
    right = $(factSq(b, s));
    const np = notPossible(
      s > 0
        ? tx(`It does work: $${A2(b)}$ and $${B2(b)}$ are squares, and the middle term $${MID(b)} = 2 \\cdot ${A} \\cdot ${B}$ is exactly $2ab$. That's the 1st binomial formula.`, `Es geht doch: $${A2(b)}$ und $${B2(b)}$ sind Quadrate, und der Mittelterm $${MID(b)} = 2 \\cdot ${A} \\cdot ${B}$ ist genau $2ab$. Das ist die 1. binomische Formel.`)
        : tx(`It does work: $${A2(b)}$ and $${B2(b)}$ are squares, and the middle term $-${MID(b)} = -2 \\cdot ${A} \\cdot ${B}$ is exactly $-2ab$. That's the 2nd binomial formula.`, `Es geht doch: $${A2(b)}$ und $${B2(b)}$ sind Quadrate, und der Mittelterm $-${MID(b)} = -2 \\cdot ${A} \\cdot ${B}$ ist genau $-2ab$. Das ist die 2. binomische Formel.`),
    );
    wrong = [...np, ...rng.shuffle([
      take(tx("Look at the middle sign", "Schau aufs Vorzeichen in der Mitte"), SIGN_SAY(s), factSq(b, -s)),
      take(tx("The 3rd formula has no middle term", "Die 3. Formel hat keinen Mittelterm"), tx(`$(a + b)(a - b) = a^2 - b^2$ has no middle term. But your term has one: $${MID(b)}$.`, `$(a + b)(a - b) = a^2 - b^2$ hat keinen Mittelterm. Dein Term hat aber einen: $${MID(b)}$.`), factConj(b)),
      take(tx("Take the root", "Zieh die Wurzel"), tx(`$b^2 = ${B2(b)}$, so $b$ is its **root**: which term squared gives $${B2(b)}$?`, `$b^2 = ${B2(b)}$, also ist $b$ die **Wurzel** daraus: Welcher Term hoch 2 ergibt $${B2(b)}$?`), factSq({ ...b, q: b.q * b.q }, s)),
      ...(b.p === 1 && !b.w
        ? [take(tx("b isn't the middle number", "b ist nicht die mittlere Zahl"), tx(`The middle term is $2ab$, so $b$ is only **half** of $${2 * b.q}$.`, `Der Mittelterm ist $2ab$, also ist $b$ nur die **Hälfte** von $${2 * b.q}$.`), factSq({ ...b, q: 2 * b.q }, s))]
        : []),
      ...(b.p > 1
        ? [take(tx("Take the root of the first term too", "Auch vorne die Wurzel ziehen"), tx(`$a^2 = ${A2(b)}$, so $a$ is the root of it, not $${b.p * b.p}${b.v}$.`, `$a^2 = ${A2(b)}$, also ist $a$ die Wurzel daraus, nicht $${b.p * b.p}${b.v}$.`), factSq({ ...b, p: b.p * b.p }, s))]
        : []),
    ])];
    solution = squareFrames(b, s);
  } else if (kind === "conj") {
    math = expandedConj(b);
    right = $(factConj(b));
    const np = notPossible(
      tx(
        `It does work: $${A2(b)}$ and $${B2(b)}$ are squares with a **minus** between them. That's the 3rd binomial formula: $a^2 - b^2 = (a + b)(a - b)$.`,
        `Es geht doch: $${A2(b)}$ und $${B2(b)}$ sind Quadrate mit einem **Minus** dazwischen. Das ist die 3. binomische Formel: $a^2 - b^2 = (a + b)(a - b)$.`,
      ),
    );
    wrong = [...np, ...rng.shuffle([
      take(tx("That would have a middle term", "Das hätte einen Mittelterm"), tx(`$(a - b)^2 = a^2 - 2ab + b^2$ has a middle term and ends with **plus** $b^2$. Here: no middle term, minus between the squares.`, `$(a - b)^2 = a^2 - 2ab + b^2$ hat einen Mittelterm und endet mit **plus** $b^2$. Hier: kein Mittelterm, Minus zwischen den Quadraten.`), factSq(b, -1)),
      take(tx("That would have a middle term", "Das hätte einen Mittelterm"), tx("$(a + b)^2 = a^2 + 2ab + b^2$: middle term and plus at the end. Here it's two squares with a **minus**: the 3rd formula.", "$(a + b)^2 = a^2 + 2ab + b^2$: Mittelterm und Plus am Ende. Hier sind es zwei Quadrate mit **Minus**: die 3. Formel."), factSq(b, 1)),
      take(tx("Take the root", "Zieh die Wurzel"), tx(`$b^2 = ${B2(b)}$, so $b$ is its **root**, not $${B2(b)}$ itself.`, `$b^2 = ${B2(b)}$, also ist $b$ die **Wurzel** daraus, nicht $${B2(b)}$ selbst.`), factConj({ ...b, q: b.q * b.q })),
      ...(b.p > 1
        ? [take(tx("Take the root of the first term too", "Auch vorne die Wurzel ziehen"), tx(`$a^2 = ${A2(b)}$, so $a$ is the root of it, not $${b.p * b.p}${b.v}$.`, `$a^2 = ${A2(b)}$, also ist $a$ die Wurzel daraus, nicht $${b.p * b.p}${b.v}$.`), factConj({ ...b, p: b.p * b.p }))]
        : []),
    ])];
    solution = conjFrames(b);
  } else {
    math = kind === "sum" ? `${A2(b)} + ${B2(b)}` : `${A2(b)} + ${MID(b)} - ${B2(b)}`;
    right = NOT_POSSIBLE;
    const why =
      kind === "sum"
        ? tx(`Check it: $${factSq(b, 1)}$ has a middle term, and $${factConj(b)} = ${expandedConj(b)}$ has a minus. A **sum** of two squares fits no binomial formula.`, `Prüf es nach: $${factSq(b, 1)}$ hat einen Mittelterm, und $${factConj(b)} = ${expandedConj(b)}$ hat ein Minus. Eine **Summe** von zwei Quadraten passt zu keiner binomischen Formel.`)
        : tx(`In the 1st and 2nd formula the last term is always **plus** $b^2$. Here it's $-${B2(b)}$, so no formula fits.`, `In der 1. und 2. Formel ist der letzte Term immer **plus** $b^2$. Hier steht $-${B2(b)}$, also passt keine Formel.`);
    wrong = [
      take(tx("Expand it to check", "Multiplizier zur Probe aus"), why, factSq(b, 1)),
      take(tx("Expand it to check", "Multiplizier zur Probe aus"), why, factConj(b)),
      take(tx("Expand it to check", "Multiplizier zur Probe aus"), why, factSq(b, -1)),
    ];
    solution =
      kind === "sum"
        ? [
            { math, note: tx("Two squares, but a **plus** between them and no middle term.", "Zwei Quadrate, aber ein **Plus** dazwischen und kein Mittelterm.") },
            { math: `${factSq(b, 1)} = ${expandedSq(b, 1)}`, note: tx(`The 1st formula would need the middle term $${MID(b)}$.`, `Die 1. Formel bräuchte den Mittelterm $${MID(b)}$.`) },
            { math: `${factConj(b)} = ${expandedConj(b)}`, note: tx("The 3rd formula gives a **minus** between the squares.", "Die 3. Formel ergibt ein **Minus** zwischen den Quadraten.") },
            { math: `${math} \\quad \\red{\\ne} \\quad ${factSq(b, 1)}`, note: tx("So no binomial formula fits. A sum of two squares can't be factorised like this.", "Also passt keine binomische Formel. Eine Summe aus zwei Quadraten lässt sich so nicht faktorisieren.") },
          ]
        : [
            { math, note: tx(`$${A2(b)}$ is a square and the middle term $${MID(b)} = 2 \\cdot ${A} \\cdot ${B}$ looks good. But look at the end.`, `$${A2(b)}$ ist ein Quadrat, und der Mittelterm $${MID(b)} = 2 \\cdot ${A} \\cdot ${B}$ sieht gut aus. Aber schau aufs Ende.`) },
            { math: `${factSq(b, 1)} = ${expandedSq(b, 1)}`, note: tx(`The 1st formula ends with $+${B2(b)}$, not $-${B2(b)}$.`, `Die 1. Formel endet mit $+${B2(b)}$, nicht mit $-${B2(b)}$.`) },
            { math: `${math} \\quad \\red{\\ne} \\quad ${factSq(b, 1)}`, note: tx("So no binomial formula fits.", "Also passt keine binomische Formel.") },
          ];
  }
  const { answer, mistakes } = choiceTask(rng, right, wrong);
  return {
    instruction: FACTOR_BINOMIAL,
    math,
    answer,
    hint: tx("Are the first and last term squares? Then check the middle term: is it $2ab$?", "Sind der erste und der letzte Term Quadrate? Dann prüf den Mittelterm: Ist er $2ab$?"),
    solution,
    mistakes,
  };
}

const EARLY = { title: tx("Not finished yet", "Noch nicht fertig"), say: tx("Factoring out was the right start! But the bracket still hides a binomial formula. Factorise it too.", "Ausklammern war der richtige Anfang! Aber in der Klammer steckt noch eine binomische Formel. Faktorisiere sie auch.") };

/** Factor out first, then a binomial formula: k(x ± q)², k(x + q)(x − q), x(x ± q)², kx(x + q)(x − q). */
function factorCompleteTask(rng: Rng, kind: "kSq" | "kConj" | "xSq" | "kxConj", k: number, q: number, v: string, s = 1): Exercise {
  const K = kind === "xSq" ? v : kind === "kxConj" ? mono(k, v) : String(k);
  const inner: Poly = kind === "kSq" || kind === "xSq" ? [q * q, 2 * s * q, 1] : [-q * q, 0, 1];
  const outer: Poly = kind === "xSq" ? [0, 1] : kind === "kxConj" ? [0, k] : [k];
  const full = polyMul(outer, inner);
  const math = showPoly(full, v);
  const innerSrc = showPoly(inner, v);
  const b: Bin = { p: 1, v, q, w: "" };
  const factored = kind === "kSq" || kind === "xSq" ? factSq(b, s) : factConj(b);
  const right = `${K}${factored}`;
  // Stopping after factoring out is always offered; the other slips take turns for the last two places.
  const wrong: Opt[] = [];
  if (kind === "kSq" || kind === "xSq") {
    wrong.push({ text: $(`${K}${factSq(b, -s)}`), title: tx("Look at the middle sign", "Schau aufs Vorzeichen in der Mitte"), say: SIGN_SAY(s) });
    wrong.push({ text: $(`${K}${factConj(b)}`), title: tx("The 3rd formula has no middle term", "Die 3. Formel hat keinen Mittelterm"), say: tx(`Inside the bracket there's a middle term $${2 * q}${v}$, so it's the 1st or 2nd formula.`, `In der Klammer steht ein Mittelterm $${2 * q}${v}$, also ist es die 1. oder 2. Formel.`) });
  } else {
    wrong.push({ text: $(`${K}${factSq(b, -1)}`), title: tx("That would have a middle term", "Das hätte einen Mittelterm"), say: tx(`$${innerSrc}$ is a difference of two squares without a middle term: the 3rd formula $(a + b)(a - b)$.`, `$${innerSrc}$ ist eine Differenz von zwei Quadraten ohne Mittelterm: die 3. Formel $(a + b)(a - b)$.`) });
  }
  if (kind === "kSq" || kind === "kConj") {
    wrong.push({ text: $(factored), title: tx("The common factor got lost", "Der gemeinsame Faktor ging verloren"), say: tx(`You forgot the $${k}$ you factored out. It stays in front of the brackets.`, `Du hast die ausgeklammerte $${k}$ vergessen. Sie bleibt vor den Klammern stehen.`) });
  } else {
    wrong.push({ text: $(kind === "xSq" ? factored : `${k}${factored}`), title: tx(`The ${v} got lost`, `Das ${v} ging verloren`), say: tx(`You forgot the $${v}$ you factored out. It stays in front of the brackets.`, `Du hast das ausgeklammerte $${v}$ vergessen. Es bleibt vor den Klammern stehen.`) });
  }
  const { answer, mistakes } = choiceTask(rng, $(right), [{ text: $(`${K}(${innerSrc})`), ...EARLY }, ...rng.shuffle(wrong)]);
  const common = kind === "xSq" ? tx(`Every term contains $${v}$.`, `Jeder Term enthält $${v}$.`) : kind === "kxConj" ? tx(`Every term contains $${K}$.`, `Jeder Term enthält $${K}$.`) : tx(`Every term is divisible by $${k}$.`, `Jeder Term ist durch $${k}$ teilbar.`);
  return {
    instruction: FACTOR_COMPLETE,
    math,
    answer,
    hint: tx("First factor out what all terms have in common. Then look for a binomial formula in the bracket.", "Klammere zuerst aus, was alle Terme gemeinsam haben. Dann such in der Klammer nach einer binomischen Formel."),
    solution: [
      { math: `${polySrc(full, v, "a")}`, note: txMap((t, l) => `${resolveText(common, l)} ${t("Factor it out first.", "Klammere das zuerst aus.")}`) },
      { math: `${K}#K (${polySrc(inner, v, "a")})#br`, note: tx(`After factoring out: $${K}(${innerSrc})$. Now look inside the bracket.`, `Nach dem Ausklammern: $${K}(${innerSrc})$. Jetzt schau in die Klammer.`) },
      {
        math: `${K}#K ${factored}`,
        note:
          kind === "kSq" || kind === "xSq"
            ? tx(`$${innerSrc} = ${factSq(b, s)}$ (${s > 0 ? "1st" : "2nd"} binomial formula). Completely factorised: $${math} = ${right}$.`, `$${innerSrc} = ${factSq(b, s)}$ (${s > 0 ? "1." : "2."} binomische Formel). Vollständig faktorisiert: $${math} = ${right}$.`)
            : tx(`$${innerSrc} = ${factConj(b)}$ (3rd binomial formula). Completely factorised: $${math} = ${right}$.`, `$${innerSrc} = ${factConj(b)}$ (3. binomische Formel). Vollständig faktorisiert: $${math} = ${right}$.`),
      },
    ],
    mistakes,
  };
}

/** a²x² ± 2abx + b² = (mx + n)² or a²x² − b² = (mx + n)(mx − n): find m and n. */
function findMNTask(b: Bin, kind: "sq" | "conj", s = 1): Exercise {
  const v = b.v;
  const values: [number, number] = kind === "sq" ? [b.p, s * b.q] : [b.p, b.q];
  const out: Mistake[] = [];
  const add = (m: number, n: number, title: Text, say: Text) => {
    if ((m === values[0] && n === values[1]) || out.some((x) => x.when.kind === "pair" && x.when.values[0] === m && x.when.values[1] === n)) return;
    out.push({ when: { kind: "pair", names: ["m", "n"], values: [m, n] }, title, say });
  };
  add(b.p * b.p, kind === "sq" ? s * b.q * b.q : b.q * b.q, tx("Roots, not squares", "Wurzeln, nicht Quadrate"), tx("$m^2$ and $n^2$ are the numbers at the ends. You need $m$ and $n$ themselves: take the square roots.", "$m^2$ und $n^2$ sind die Zahlen an den Enden. Gesucht sind $m$ und $n$ selbst: Zieh die Wurzeln."));
  if (kind === "sq") {
    add(b.p, -s * b.q, s < 0 ? tx("n is negative here", "n ist hier negativ") : tx("n is positive here", "n ist hier positiv"), s < 0 ? tx("The middle term has a **minus**, so $2mn$ is negative. With $m > 0$, $n$ must be negative.", "Der Mittelterm hat ein **Minus**, also ist $2mn$ negativ. Mit $m > 0$ muss $n$ negativ sein.") : tx("The middle term is **plus**, so $2mn > 0$ and $n$ is positive.", "Der Mittelterm ist **plus**, also ist $2mn > 0$ und $n$ positiv."));
    if (b.p > 1) add(b.p, s * b.p * b.q, tx("Half the middle is m · n", "Die halbe Mitte ist m · n"), tx(`Half of the middle coefficient is $m \\cdot n = ${b.p * b.q}$, not $n$ alone. Divide by $m$ as well.`, `Die Hälfte des mittleren Koeffizienten ist $m \\cdot n = ${b.p * b.q}$, nicht $n$ allein. Teil noch durch $m$.`));
    add(b.p, s * 2 * b.p * b.q, tx("That's 2mn", "Das ist 2mn"), tx(`$${2 * b.p * b.q}$ is the whole middle coefficient $2mn$. $n$ is a lot smaller.`, `$${2 * b.p * b.q}$ ist der ganze mittlere Koeffizient $2mn$. $n$ ist viel kleiner.`));
  }
  const lhs = kind === "sq" ? expandedSq(b, s) : expandedConj(b);
  const form = kind === "sq" ? `(m${v} + n)^2` : `(m${v} + n)(m${v} - n)`;
  const general = kind === "sq" ? `(m${v} + n)^2 = m^2 ${v}^2 + 2mn${v} + n^2` : `(m${v} + n)(m${v} - n) = m^2 ${v}^2 - n^2`;
  const done = kind === "sq" ? `(${A_(b)} ${sgn(s)} ${b.q})^2` : `(${A_(b)} + ${b.q})(${A_(b)} - ${b.q})`;
  return {
    instruction: FIND_MN,
    text: kind === "sq" ? tx("Find $m > 0$ and $n$ so that the equation is true. $n$ may be negative.", "Bestimme $m > 0$ und $n$ so, dass die Gleichung stimmt. $n$ darf negativ sein.") : tx("Find $m > 0$ and $n > 0$ so that the equation is true.", "Bestimme $m > 0$ und $n > 0$ so, dass die Gleichung stimmt."),
    math: `${lhs} = ${form}`,
    answer: { kind: "pair", names: ["m", "n"], values },
    hint:
      kind === "sq"
        ? tx(`Expand $(m${v} + n)^2$ in your head and compare: $m^2$ in front, $n^2$ at the end, $2mn$ in the middle.`, `Multipliziere $(m${v} + n)^2$ im Kopf aus und vergleiche: $m^2$ vorne, $n^2$ hinten, $2mn$ in der Mitte.`)
        : tx(`$(m${v} + n)(m${v} - n) = m^2${v}^2 - n^2$. Compare.`, `$(m${v} + n)(m${v} - n) = m^2${v}^2 - n^2$. Vergleiche.`),
    solution: [
      { math: general, note: tx("Expand the right side in general and compare it with the left side.", "Multipliziere die rechte Seite allgemein aus und vergleiche sie mit der linken.") },
      {
        math: `m^2 = ${b.p * b.p} \\quad n^2 = ${b.q * b.q}`,
        note: kind === "sq" ? tx(`Compare front and end: $m^2 = ${b.p * b.p}$ and $n^2 = ${b.q * b.q}$.`, `Vergleiche vorne und hinten: $m^2 = ${b.p * b.p}$ und $n^2 = ${b.q * b.q}$.`) : tx(`Compare: $m^2 = ${b.p * b.p}$ and $n^2 = ${b.q * b.q}$.`, `Vergleiche: $m^2 = ${b.p * b.p}$ und $n^2 = ${b.q * b.q}$.`),
      },
      {
        math: `m = ${values[0]} \\quad n = ${values[1]}`,
        note:
          kind === "sq"
            ? tx(`$m > 0$ gives $m = ${b.p}$. The middle term $${sgn(s)}${2 * b.p * b.q}${v} = 2mn${v}$ decides the sign: $n = ${values[1]}$.`, `Aus $m > 0$ folgt $m = ${b.p}$. Der Mittelterm $${sgn(s)}${2 * b.p * b.q}${v} = 2mn${v}$ entscheidet das Vorzeichen: $n = ${values[1]}$.`)
            : tx(`Both positive: $m = ${b.p}$ and $n = ${b.q}$.`, `Beide positiv: $m = ${b.p}$ und $n = ${b.q}$.`),
      },
      { math: `${lhs} = ${done}`, note: tx("Check by expanding: it fits.", "Probe durch Ausmultiplizieren: Es passt.") },
    ],
    mistakes: out,
  };
}

/** Fill a gap so that a binomial square appears: the end, the middle or the front. */
function completeTask(b: Bin, gap: "last" | "middle" | "first", s: number): Exercise {
  const v = b.v;
  const A = A_(b);
  const right = gap === "last" ? b.q * b.q : gap === "middle" ? 2 * b.p * b.q : b.p * b.p;
  const { out, add } = numberMistakes(right);
  let math: string;
  let solution: Frame[];
  const box = "\\box{?#g}";
  if (gap === "last") {
    math = `${A2(b)} ${sgn(s)} ${MID(b)} + \\box{?}`;
    add(b.q, tx("Square it", "Noch quadrieren"), tx(`You found $b = ${b.q}$, great! But the last term is $b^2$.`, `Du hast $b = ${b.q}$ gefunden, super! Der letzte Term ist aber $b^2$.`));
    if (b.p > 1) add((b.p * b.q) ** 2, tx(`a is ${A}, not ${v}`, `a ist ${A}, nicht ${v}`), tx(`Careful: $a = ${A}$. From $2ab = ${MID(b)}$ you get $b$ by dividing by $2 \\cdot ${A}$, not just by $2${v}$.`, `Vorsicht: $a = ${A}$. Aus $2ab = ${MID(b)}$ bekommst du $b$, wenn du durch $2 \\cdot ${A}$ teilst, nicht nur durch $2${v}$.`));
    add(2 * b.p * b.q, tx("That's the middle number", "Das ist die mittlere Zahl"), tx(`$${2 * b.p * b.q}$ is already in the middle. The end needs $b^2$.`, `$${2 * b.p * b.q}$ steht schon in der Mitte. Ans Ende gehört $b^2$.`));
    solution = [
      {
        math: `${A2(b)} ${sgn(s)} ${MID(b)} + ${box}`,
        note:
          b.p === 1
            ? tx(`$${A2(b)}$ is the square of $${v}$, so $a = ${v}$. The middle term is $2ab = ${MID(b)}$.`, `$${A2(b)}$ ist das Quadrat von $${v}$, also ist $a = ${v}$. Der Mittelterm ist $2ab = ${MID(b)}$.`)
            : tx(`$${A2(b)} = ${asSquare(b.p, v)}$, so $a = ${A}$. The middle term is $2ab = ${MID(b)}$.`, `$${A2(b)} = ${asSquare(b.p, v)}$, also ist $a = ${A}$. Der Mittelterm ist $2ab = ${MID(b)}$.`),
      },
      { math: `2 \\cdot ${A} \\cdot b = ${MID(b)} \\quad \\Rightarrow \\quad b = ${b.q}`, note: tx(`Divide by $2 \\cdot ${A} = ${2 * b.p}${v}$: $b = ${b.q}$.`, `Teile durch $2 \\cdot ${A} = ${2 * b.p}${v}$: $b = ${b.q}$.`) },
      { math: `${A2(b)} ${sgn(s)} ${MID(b)} + \\hl{${right}#g} = ${factSq(b, s)}`, note: tx(`The end is $b^2 = ${right}$.`, `Ans Ende kommt $b^2 = ${right}$.`) },
    ];
  } else if (gap === "middle") {
    math = `${A2(b)} ${sgn(s)} \\box{?} ${v} + ${B2(b)}`;
    add(b.p * b.q, tx("The 2 is missing", "Die 2 fehlt"), tx(`Nearly! You took $a \\cdot b$. The middle term is $2ab$.`, `Fast! Du hast $a \\cdot b$ genommen. Der Mittelterm ist $2ab$.`));
    if (b.p > 1) add(2 * b.q, tx(`The ${b.p} got lost`, `Die ${b.p} ging verloren`), tx(`$a = ${A}$, so the $${b.p}$ belongs into $2ab$ too.`, `$a = ${A}$, also gehört die $${b.p}$ auch in $2ab$.`));
    add(b.p * b.p + b.q * b.q, tx("Not a sum", "Keine Summe"), tx("The middle term is a product: $2 \\cdot a \\cdot b$.", "Der Mittelterm ist ein Produkt: $2 \\cdot a \\cdot b$."));
    solution = [
      {
        math: `${A2(b)} ${sgn(s)} \\box{?#g} ${v}#v + ${B2(b)}`,
        note:
          b.p === 1
            ? tx(`$a = ${v}$ and $b = ${b.q}$, because $${B2(b)} = ${b.q}^2$.`, `$a = ${v}$ und $b = ${b.q}$, denn $${B2(b)} = ${b.q}^2$.`)
            : tx(`$a = ${A}$ and $b = ${b.q}$, because $${A2(b)} = ${asSquare(b.p, v)}$ and $${B2(b)} = ${b.q}^2$.`, `$a = ${A}$ und $b = ${b.q}$, denn $${A2(b)} = ${asSquare(b.p, v)}$ und $${B2(b)} = ${b.q}^2$.`),
      },
      { math: `2 \\cdot ${A} \\cdot ${b.q} = ${right}#g ${v}#v`, note: tx("The middle term is $2ab$.", "Der Mittelterm ist $2ab$.") },
      { math: `${A2(b)} ${sgn(s)} \\hl{${right}#g} ${v}#v + ${B2(b)} = ${factSq(b, s)}`, note: tx(`So the gap is $${right}$.`, `In die Lücke kommt also $${right}$.`) },
    ];
  } else {
    math = `\\box{?} ${v}^2 ${sgn(s)} ${MID(b)} + ${B2(b)}`;
    add(b.p, tx("Square it", "Noch quadrieren"), tx(`You found $a = ${b.p}${v}$, great! But the front term is $a^2$.`, `Du hast $a = ${b.p}${v}$ gefunden, super! Vorne steht aber $a^2$.`));
    add(2 * b.p, tx("The 2 is missing", "Die 2 fehlt"), tx("The middle term is $2ab$: divide by $2b$, not only by $b$.", "Der Mittelterm ist $2ab$: Teile durch $2b$, nicht nur durch $b$."));
    solution = [
      { math: `\\box{?#g} ${v}#v ^{2} ${sgn(s)} ${MID(b)} + ${B2(b)}`, note: tx(`$${B2(b)} = ${b.q}^2$, so $b = ${b.q}$. The middle term is $2ab = ${MID(b)}$.`, `$${B2(b)} = ${b.q}^2$, also ist $b = ${b.q}$. Der Mittelterm ist $2ab = ${MID(b)}$.`) },
      { math: `2 \\cdot a \\cdot ${b.q} = ${MID(b)} \\quad \\Rightarrow \\quad a = ${A}`, note: tx(`Divide by $2 \\cdot ${b.q} = ${2 * b.q}$: $a = ${A}$.`, `Teile durch $2 \\cdot ${b.q} = ${2 * b.q}$: $a = ${A}$.`) },
      { math: `\\hl{${right}#g} ${v}#v ^{2} ${sgn(s)} ${MID(b)} + ${B2(b)} = ${factSq(b, s)}`, note: tx(`The front is $a^2 = ${A2(b)}$, so the gap is $${right}$.`, `Vorne steht $a^2 = ${A2(b)}$, in die Lücke kommt also $${right}$.`) },
    ];
  }
  return {
    instruction: COMPLETE,
    text: tx("Fill in the gap so that you can write the term as a square with a binomial formula.", "Füll die Lücke so, dass du den Term mit einer binomischen Formel als Quadrat schreiben kannst."),
    math,
    answer: { kind: "number", value: right, label: "? =" },
    hint: tx("Find $a$ and $b$ from the parts you know, then use $a^2$, $2ab$ and $b^2$.", "Bestimme $a$ und $b$ aus den bekannten Teilen und nutze dann $a^2$, $2ab$ und $b^2$."),
    solution,
    mistakes: out,
  };
}

/** 53² − 47² with the 3rd formula, or 57² − 2 · 57 · 7 + 7² with the 2nd. */
function cleverTask(kind: "conj" | "sq", a: number, b: number, s = 1): Exercise {
  if (kind === "conj") {
    const S = a + b;
    const D = a - b;
    const right = S * D;
    const { out, add } = numberMistakes(right);
    add(D * D, tx("Not (a − b)²", "Nicht (a − b)²"), tx("$a^2 - b^2$ is **not** $(a - b)^2$. The 3rd binomial formula says $a^2 - b^2 = (a + b)(a - b)$.", "$a^2 - b^2$ ist **nicht** $(a - b)^2$. Die 3. binomische Formel sagt $a^2 - b^2 = (a + b)(a - b)$."));
    add(S * S, tx("Not (a + b)²", "Nicht (a + b)²"), tx("Close, but it's $(a + b)$ **times** $(a - b)$.", "Knapp, aber es ist $(a + b)$ **mal** $(a - b)$."));
    return {
      instruction: CLEVER,
      math: `${a}^2 - ${b}^2`,
      answer: { kind: "number", value: right },
      hint: tx("Two squares with a minus: that's $a^2 - b^2$.", "Zwei Quadrate mit Minus: Das ist $a^2 - b^2$."),
      solution: [
        { math: `${a}#a ^{2#e} -#s ${b}#b ^{2#f}`, note: tx(`Squaring $${a}$ and $${b}$ is hard work. But this is $a^2 - b^2$!`, `$${a}$ und $${b}$ zu quadrieren ist mühsam. Aber das ist $a^2 - b^2$!`) },
        { math: `(${a}#a +#p ${b}#b)#L (${a}#a2 -#s ${b}#b2)#R`, note: tx("3rd binomial formula backwards: $a^2 - b^2 = (a + b)(a - b)$.", "3. binomische Formel rückwärts: $a^2 - b^2 = (a + b)(a - b)$.") },
        { math: `${S}#a \\cdot#d ${D}#b2`, note: tx(`$${a} + ${b} = ${S}$ and $${a} - ${b} = ${D}$.`, `$${a} + ${b} = ${S}$ und $${a} - ${b} = ${D}$.`) },
        { math: `${right}#a`, note: tx(`So $${a}^2 - ${b}^2 = ${right}$.`, `Also ist $${a}^2 - ${b}^2 = ${right}$.`) },
      ],
      mistakes: out,
    };
  }
  const R = a + s * b;
  const right = R * R;
  const { out, add } = numberMistakes(right);
  add((a - s * b) ** 2, tx("Wrong formula", "Falsche Formel"), SIGN_SAY(s));
  add(a * a - b * b, tx("That's the 3rd formula", "Das ist die 3. Formel"), tx("With the middle term $2ab$ it's the 1st or 2nd formula, not $a^2 - b^2$.", "Mit dem Mittelterm $2ab$ ist es die 1. oder 2. Formel, nicht $a^2 - b^2$."));
  const expr = `${a}^2 ${sgn(s)} 2 \\cdot ${a} \\cdot ${b} + ${b}^2`;
  return {
    instruction: CLEVER,
    math: expr,
    answer: { kind: "number", value: right },
    hint: tx("Look for $a^2 \\pm 2ab + b^2$.", "Such nach $a^2 \\pm 2ab + b^2$."),
    solution: [
      { math: expr, note: tx(`That's exactly $a^2 ${sgn(s)} 2ab + b^2$ with $a = ${a}$ and $b = ${b}$.`, `Das ist genau $a^2 ${sgn(s)} 2ab + b^2$ mit $a = ${a}$ und $b = ${b}$.`) },
      { math: `(${a}#a ${sgn(s)}#s ${b}#b)#br ^{2#e}`, note: s > 0 ? tx("1st binomial formula backwards.", "1. binomische Formel rückwärts.") : tx("2nd binomial formula backwards.", "2. binomische Formel rückwärts.") },
      { math: `${R}#a ^{2#e}`, note: tx(`$${a} ${sgn(s)} ${b} = ${R}$. A round number!`, `$${a} ${sgn(s)} ${b} = ${R}$. Eine runde Zahl!`) },
      { math: `${right}#a`, note: tx(`So the result is $${right}$.`, `Das Ergebnis ist also $${right}$.`) },
    ],
    mistakes: out,
  };
}

/** (p·v ± q)³ with the formula a³ ± 3a²b + 3ab² ± b³. */
function cubeTask(p: number, q: number, s: number, v: string): Exercise {
  const lin: Poly = [s * q, p];
  const right = polyMul(polyMul(lin, lin), lin);
  const value = plainPoly(right, v);
  const { out, add } = exprMistakes(value);
  add([s * q * q * q, 0, 0, p * p * p], v, tx("The middle terms are missing", "Die Mittelterme fehlen"), tx("Cubing a sum is not cubing each part: $(a + b)^3 \\ne a^3 + b^3$. Two middle terms belong in between: $3a^2b + 3ab^2$.", "Eine Summe hoch 3 ist nicht jeder Teil hoch 3: $(a + b)^3 \\ne a^3 + b^3$. Dazwischen gehören zwei Mittelterme: $3a^2b + 3ab^2$."));
  if (s < 0) add([-q * q * q, -3 * p * q * q, -3 * p * p * q, p * p * p], v, tx("The signs alternate", "Die Vorzeichen wechseln sich ab"), tx("With $(a - b)^3$ the signs alternate: $+, -, +, -$. The third term is plus, because $(-b)^2$ is positive.", "Bei $(a - b)^3$ wechseln die Vorzeichen: $+, -, +, -$. Der dritte Term ist plus, weil $(-b)^2$ positiv ist."));
  if (p > 1) add([s * q * q * q, 3 * p * q * q, 3 * p * s * q, p], v, tx(`Raise the ${p} too`, `Die ${p} auch potenzieren`), tx(`$(${p}${v})^3 = ${p ** 3}${v}^3$ and $(${p}${v})^2 = ${p * p}${v}^2$: the number in front gets the power too.`, `$(${p}${v})^3 = ${p ** 3}${v}^3$ und $(${p}${v})^2 = ${p * p}${v}^2$: Auch die Zahl davor wird potenziert.`));
  add([s * q * q * q, 2 * p * q * q, 2 * s * p * p * q, p * p * p], v, tx("3, not 2", "3, nicht 2"), tx("That's the pattern of the square. For the cube the numbers in front are $1, 3, 3, 1$.", "Das ist das Muster vom Quadrat. Bei hoch 3 sind die Zahlen davor $1, 3, 3, 1$."));
  const A = p === 1 ? v : `${p}${v}`;
  const Ap = p === 1 ? v : `(${p}${v})`;
  const formula = s > 0 ? "(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3" : "(a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3";
  return {
    instruction: EXPAND_SIMPLIFY,
    math: `(${A} ${sgn(s)} ${q})^3`,
    answer: { kind: "expr", value, form: "simplified" },
    hint: tx(`Use $${formula}$.`, `Nutze $${formula}$.`),
    solution: [
      { math: `(${A} ${sgn(s)} ${q})^3`, note: tx(`$${formula}$ with $a = ${A}$ and $b = ${q}$.`, `$${formula}$ mit $a = ${A}$ und $b = ${q}$.`) },
      {
        math: `${Ap}^3 ${sgn(s)} 3 \\cdot ${Ap}^2 \\cdot ${q} + 3 \\cdot ${A} \\cdot ${q}^2 ${sgn(s)} ${q}^3`,
        note: tx("Insert. The numbers in front come from $1, 3, 3, 1$.", "Einsetzen. Die Zahlen davor sind $1, 3, 3, 1$."),
      },
      { math: polySrc(right, v, "r"), note: tx("Work out each term.", "Rechne jeden Term aus.") },
    ],
    mistakes: out,
  };
}

const power = (p: Poly, n: number) => Array.from({ length: n }).reduce<Poly>((acc) => polyMul(acc, p), [1]);
const pow = (b: number, e: number) => b ** e;

/** (v ± c)ⁿ term by term with row n of Pascal's triangle. */
function pascalFrames(n: number, c: number, v: string): Frame[] {
  const row = Array.from({ length: n + 1 }, (_, k) => choose(n, k));
  const cs = c < 0 ? `(${c})` : String(c);
  const termSrc = (k: number) => {
    const vp = n - k === 0 ? "" : n - k === 1 ? v : `${v}^{${n - k}}`;
    const cp = k === 0 ? "" : k === 1 ? cs : `${cs}^{${k}}`;
    const lead = [row[k] === 1 ? "" : `${row[k]}#k${k}`, vp].filter(Boolean).join(" ");
    return [lead, cp].filter(Boolean).join(" \\cdot ");
  };
  const result = power([c, 1], n);
  return [
    { math: `(${v} ${c < 0 ? "-" : "+"} ${Math.abs(c)})^{${n}}`, note: tx(`Row ${n} of Pascal's triangle: $${row.join(", ")}$.`, `Zeile ${n} des Pascalschen Dreiecks: $${row.join(", ")}$.`) },
    {
      math: row.map((_, k) => termSrc(k)).join(" + "),
      highlight: row.map((_, k) => `k${k}`),
      note: tx(`The powers of $${v}$ go **down** from $${n}$ to $0$, the powers of $${cs}$ go **up** from $0$ to $${n}$. In front: the numbers from the row.`, `Die Exponenten von $${v}$ gehen **runter** von $${n}$ bis $0$, die von $${cs}$ gehen **hoch** von $0$ bis $${n}$. Davor: die Zahlen aus der Zeile.`),
    },
    { math: polySrc(result, v, "r"), note: c < 0 ? tx("Work out each term. Odd powers of a negative number are negative, so the signs alternate.", "Rechne jeden Term aus. Ungerade Potenzen einer negativen Zahl sind negativ, darum wechseln die Vorzeichen.") : tx("Work out each term.", "Rechne jeden Term aus.") },
  ];
}

function pascalTask(n: number, c: number, v: string): Exercise {
  const right = power([c, 1], n);
  const value = plainPoly(right, v);
  const { out, add } = exprMistakes(value);
  const row = Array.from({ length: n + 1 }, (_, k) => choose(n, k));
  const build = (coef: (k: number) => number) => {
    const p: Poly = new Array(n + 1).fill(0);
    for (let k = 0; k <= n; k++) p[n - k] = coef(k);
    return p;
  };
  add(build((k) => pow(c, k)), v, tx("The binomial coefficients are missing", "Die Binomialkoeffizienten fehlen"), tx(`Every term needs its number from row ${n} of Pascal's triangle in front: $${row.join(", ")}$.`, `Jeder Term braucht seine Zahl aus Zeile ${n} des Pascalschen Dreiecks davor: $${row.join(", ")}$.`));
  if (Math.abs(c) > 1) add(build((k) => row[k] * (k === 0 ? 1 : c)), v, tx(`Powers of ${Math.abs(c)}`, `Potenzen von ${Math.abs(c)}`), tx(`The $${Math.abs(c)}$ gets a power too: $${Math.abs(c)}^2, ${Math.abs(c)}^3, …$, just like the $b^k$ in $a^{n-k}b^k$.`, `Auch die $${Math.abs(c)}$ wird potenziert: $${Math.abs(c)}^2, ${Math.abs(c)}^3, …$, genau wie $b^k$ in $a^{n-k}b^k$.`));
  if (c < 0) add(build((k) => (k === 0 ? 1 : -row[k] * pow(-c, k))), v, tx("The signs alternate", "Die Vorzeichen wechseln sich ab"), tx(`$(${c})^2$ is positive, $(${c})^3$ is negative: the signs go $+, -, +, -, …$`, `$(${c})^2$ ist positiv, $(${c})^3$ ist negativ: Die Vorzeichen gehen $+, -, +, -, …$`));
  return {
    instruction: PASCAL,
    math: `(${v} ${c < 0 ? "-" : "+"} ${Math.abs(c)})^{${n}}`,
    answer: { kind: "expr", value, form: "simplified" },
    hint: tx(`Row ${n} of Pascal's triangle gives the numbers in front.`, `Zeile ${n} des Pascalschen Dreiecks liefert die Zahlen davor.`),
    solution: pascalFrames(n, c, v),
    mistakes: out,
  };
}

/** The coefficient of vʲ in (v ± c)ⁿ. */
function coefficientTask(n: number, c: number, j: number, v: string): Exercise {
  const k = n - j;
  const vj = j === 1 ? v : `${v}^{${j}}`;
  const C = choose(n, k);
  const right = C * pow(c, k);
  const { out, add } = numberMistakes(right);
  if (Math.abs(c) > 1) add(C, tx("Only the binomial coefficient", "Nur der Binomialkoeffizient"), tx(`$${C}$ is the number from Pascal's triangle. But the $${c}$ is raised to a power too: multiply by $${c < 0 ? `(${c})` : c}^{${k}}$.`, `$${C}$ ist die Zahl aus dem Pascalschen Dreieck. Aber auch die $${c}$ wird potenziert: Multipliziere mit $${c < 0 ? `(${c})` : c}^{${k}}$.`));
  if (j !== k && Math.abs(c) > 1) add(C * pow(c, j), tx("Wrong power", "Falscher Exponent"), tx(`The powers add up to $${n}$: with $${vj}$ the $${c}$ gets the power $${n} - ${j} = ${k}$.`, `Die Exponenten ergeben zusammen $${n}$: Zu $${vj}$ gehört die $${c}$ hoch $${n} - ${j} = ${k}$.`));
  if (C !== 1) add(pow(c, k), tx("The binomial coefficient is missing", "Der Binomialkoeffizient fehlt"), tx(`Don't forget the number from row ${n} of Pascal's triangle in front.`, `Vergiss die Zahl aus Zeile ${n} des Pascalschen Dreiecks davor nicht.`));
  const cs = c < 0 ? `(${c})` : String(c);
  const csk = k === 1 ? cs : `${cs}^{${k}}`;
  return {
    instruction: COEFFICIENT,
    text: tx(`Which number stands in front of $${vj}$ when you expand this?`, `Welche Zahl steht vor $${vj}$, wenn du das ausmultiplizierst?`),
    math: `(${v} ${c < 0 ? "-" : "+"} ${Math.abs(c)})^{${n}}`,
    answer: { kind: "number", value: right },
    hint: tx(`In the term with $${vj}$ the $${cs}$ has the power $k = ${n} - ${j}$. In front stands “${n} choose k”.`, `Im Term mit $${vj}$ hat die $${cs}$ den Exponenten $k = ${n} - ${j}$. Davor steht „${n} über k“.`),
    solution: [
      { math: `(${v} ${c < 0 ? "-" : "+"} ${Math.abs(c)})^{${n}}`, note: tx(`In each term the powers add up to $${n}$. With $${vj}$ the $${cs}$ has the power $${n} - ${j} = ${k}$.`, `In jedem Term ergeben die Exponenten zusammen $${n}$. Bei $${vj}$ hat die $${cs}$ den Exponenten $${n} - ${j} = ${k}$.`) },
      { math: `${C}#C \\cdot#d ${vj} \\cdot#d2 ${csk}#p`, note: tx(`In front stands the binomial coefficient “${n} choose ${k}” $= ${C}$ (row ${n}, place ${k} of Pascal's triangle).`, `Davor steht der Binomialkoeffizient „${n} über ${k}“ $= ${C}$ (Zeile ${n}, Stelle ${k} im Pascalschen Dreieck).`) },
      { math: `${C}#C \\cdot#d ${pow(c, k) < 0 ? `(${pow(c, k)})` : pow(c, k)}#p \\cdot#d2 ${vj} = ${right} ${vj}`, note: tx(`$${csk} = ${pow(c, k)}$, so the coefficient is $${C} \\cdot ${pow(c, k) < 0 ? `(${pow(c, k)})` : pow(c, k)} = ${right}$.`, `$${csk} = ${pow(c, k)}$, der Koeffizient ist also $${C} \\cdot ${pow(c, k) < 0 ? `(${pow(c, k)})` : pow(c, k)} = ${right}$.`) },
    ],
    mistakes: out,
  };
}

const fall = (n: number, m: number) => Array.from({ length: m }, (_, i) => n - i).join(" \\cdot ");
const fact = (m: number) => fall(m, m) || "1";

/** (n über k) from the factorial formula. */
function binomTask(n: number, k: number): Exercise {
  const right = choose(n, k);
  const { out, add } = numberMistakes(right);
  const falling = Array.from({ length: k }, (_, i) => n - i).reduce((a, b) => a * b, 1);
  add(falling, tx("k! is missing", "k! fehlt"), tx(`$${fall(n, k)} = ${falling}$ is a good start, but you still have to divide by $${k}! = ${fact(k)}$.`, `$${fall(n, k)} = ${falling}$ ist ein guter Anfang, aber du musst noch durch $${k}! = ${fact(k)}$ teilen.`));
  add(n * k, tx("Not n · k", "Nicht n · k"), tx("The binomial coefficient isn't $n \\cdot k$. Use $\\frac{n!}{k! \\cdot (n - k)!}$ or Pascal's triangle.", "Der Binomialkoeffizient ist nicht $n \\cdot k$. Nimm $\\frac{n!}{k! \\cdot (n - k)!}$ oder das Pascalsche Dreieck."));
  add(choose(n - 1, k), tx("One row too high", "Eine Zeile zu hoch"), tx("In Pascal's triangle the rows are counted from 0: the single 1 at the top is row 0.", "Im Pascalschen Dreieck zählst du die Zeilen ab 0: Die einzelne 1 ganz oben ist Zeile 0."));
  add(choose(n, k - 1), tx("One place too far left", "Eine Stelle zu weit links"), tx("The places in a row are counted from 0 too: the first 1 is place 0.", "Auch die Stellen in einer Zeile zählst du ab 0: Die erste 1 ist Stelle 0."));
  return {
    instruction: BINOM,
    visual: { component: ExpandingBinomTask as ComponentType<Record<string, unknown>>, props: { n, k } },
    answer: { kind: "number", value: right },
    hint: tx("$\\frac{n!}{k! \\cdot (n - k)!}$, or row n, place k of Pascal's triangle (both counted from 0).", "$\\frac{n!}{k! \\cdot (n - k)!}$, oder Zeile n, Stelle k im Pascalschen Dreieck (beide ab 0 gezählt)."),
    solution: [
      { math: `\\frac{${n}!}{${k}! \\cdot ${n - k}!}`, note: tx(`“${n} choose ${k}” $= \\frac{n!}{k! \\cdot (n - k)!}$ with $n = ${n}$ and $k = ${k}$.`, `„${n} über ${k}“ $= \\frac{n!}{k! \\cdot (n - k)!}$ mit $n = ${n}$ und $k = ${k}$.`) },
      { math: `\\frac{${fall(n, k)} \\cdot ${n - k}!}{${k}! \\cdot ${n - k}!}`, note: tx(`$${n}! = ${fall(n, k)} \\cdot ${n - k}!$, so $${n - k}!$ cancels.`, `$${n}! = ${fall(n, k)} \\cdot ${n - k}!$, also kürzt sich $${n - k}!$ weg.`) },
      { math: `\\frac{${fall(n, k)}}{${fact(k)}} = \\frac{${falling}}{${falling / right}} = ${right}`, note: tx(`So it's $${right}$. Check in Pascal's triangle: row ${n}, place ${k}.`, `Also $${right}$. Probe im Pascalschen Dreieck: Zeile ${n}, Stelle ${k}.`) },
    ],
    mistakes: out,
  };
}

// ---------------------------------------------------------------------------
// Practice

/** p·v ± q·w with no common factor (else factoring out would come first). */
function randomBin(rng: Rng, two = false): Bin {
  const [v, w]: [string, string] = two ? rng.pick(PAIRS) : [rng.pick(VARS3), ""];
  for (;;) {
    const b = { p: rng.pick([1, 1, 2, 3, 4, 5]), v, q: rng.int(1, 9), w };
    if (gcd(b.p, b.q) === 1 && b.p * b.q > 1) return b;
  }
}

function genFactorBinomial(rng: Rng): Exercise {
  const r = rng.int(1, 100);
  if (r <= 45) return factorBinomialTask(rng, randomBin(rng, rng.chance(0.2)), "sq", rng.sign());
  if (r <= 82) return factorBinomialTask(rng, randomBin(rng, rng.chance(0.25)), "conj");
  return factorBinomialTask(rng, randomBin(rng), rng.chance(0.6) ? "sum" : "negLast");
}

function genFactorComplete(rng: Rng): Exercise {
  const v = rng.pick(VARS3);
  const kind = rng.pick(["kSq", "kSq", "kConj", "kConj", "xSq", "kxConj"] as const);
  return factorCompleteTask(rng, kind, rng.int(2, 5), rng.int(1, kind === "xSq" ? 5 : 6), v, rng.sign());
}

function genFindMN(rng: Rng): Exercise {
  const v = rng.pick(VARS3);
  for (;;) {
    const b: Bin = { p: rng.pick([1, 2, 2, 3, 3, 4, 5]), v, q: rng.int(1, 9), w: "" };
    if (gcd(b.p, b.q) !== 1 || b.p * b.q === 1) continue;
    return rng.chance(0.65) ? findMNTask(b, "sq", rng.sign()) : findMNTask(b, "conj");
  }
}

function genComplete(rng: Rng): Exercise {
  const v = rng.pick(VARS3);
  const gap = rng.pick(["last", "last", "middle", "first"] as const);
  for (;;) {
    const b: Bin = { p: gap === "first" ? rng.int(2, 5) : rng.pick([1, 1, 2, 3]), v, q: rng.int(2, 9), w: "" };
    if (gcd(b.p, b.q) === 1) return completeTask(b, gap, rng.sign());
  }
}

function genClever(rng: Rng): Exercise {
  if (rng.chance(0.6)) {
    for (;;) {
      const S = rng.pick([20, 50, 100, 100, 200]);
      const D = rng.int(2, 14);
      if ((S + D) % 2 || D >= S / 2) continue;
      return cleverTask("conj", (S + D) / 2, (S - D) / 2);
    }
  }
  const s = rng.sign();
  const R = rng.pick([20, 30, 40, 50, 60, 100]);
  const b = rng.int(2, 9);
  return s > 0 ? cleverTask("sq", R - b, b, 1) : cleverTask("sq", R + b, b, -1);
}

function genCube(rng: Rng): Exercise {
  const v = rng.pick(VARS3);
  const p = rng.chance(0.25) ? 2 : 1;
  // (2x ± 2)³ would have a common factor 2, so with p = 2 the number is odd.
  return cubeTask(p, p === 2 ? rng.pick([1, 3]) : rng.int(1, 4), rng.sign(), v);
}

function genPascal(rng: Rng): Exercise {
  const v = rng.pick(VARS3);
  const n = rng.pick([4, 4, 4, 5, 5, 6]);
  const c = (n === 4 ? rng.int(1, 3) : n === 5 ? rng.int(1, 2) : 1) * rng.sign();
  return pascalTask(n, c, v);
}

function genCoefficient(rng: Rng): Exercise {
  const v = rng.pick(VARS3);
  for (;;) {
    const n = rng.int(4, 7);
    const c = rng.pick([1, 2, 2, 3, -1, -2]);
    const j = rng.int(1, n - 1);
    const val = choose(n, n - j) * pow(c, n - j);
    if (Math.abs(val) > 400 || Math.abs(pow(c, n - j)) > 32 || choose(n, n - j) === 1) continue;
    return coefficientTask(n, c, j, v);
  }
}

function genBinom(rng: Rng): Exercise {
  const n = rng.int(4, 10);
  const k = rng.int(2, Math.floor(n / 2));
  return binomTask(n, k);
}

/** Level 3 practice: factorising with the binomial formulas, cubes, Pascal's triangle and the binomial theorem. */
export function generate3(rng: Rng): Exercise {
  const r = rng.int(1, 100);
  if (r <= 14) return genFactorBinomial(rng);
  if (r <= 25) return genFactorComplete(rng);
  if (r <= 37) return genFindMN(rng);
  if (r <= 47) return genComplete(rng);
  if (r <= 55) return genClever(rng);
  if (r <= 68) return genCube(rng);
  if (r <= 80) return genPascal(rng);
  if (r <= 91) return genCoefficient(rng);
  return genBinom(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const lessonRng = createRng(20261007);

const check1 = findMNTask({ p: 3, v: "x", q: 2, w: "" }, "sq", -1);
const check2 = factorCompleteTask(lessonRng, "kConj", 2, 3, "x");
const check3 = cubeTask(1, 2, -1, "x");
const check4 = coefficientTask(5, 2, 3, "x");

const cubeFrames: Frame[] = [
  { math: "(a#a +#p b#b)#br ^{3#e}", note: tx("Cubed means: three brackets. $(a + b)^3 = (a + b)^2 \\cdot (a + b)$.", "Hoch 3 heißt: drei Klammern. $(a + b)^3 = (a + b)^2 \\cdot (a + b)$.") },
  { math: "(a^2 + 2ab + b^2)#sq (a#a +#p b#b)#br", note: tx("Use the 1st binomial formula for the square first.", "Nimm für das Quadrat zuerst die 1. binomische Formel.") },
  { math: "a^3 + a^2 b + 2a^2 b + 2a b^2 + a b^2 + b^3", note: tx("Every term of the first bracket meets every term of the second: six products.", "Jeder Term der ersten Klammer trifft jeden der zweiten: sechs Produkte.") },
  { math: "a^3 + \\hl{3a^2 b} + \\hl{3a b^2} + b^3", note: tx("Combine: $a^2b + 2a^2b = 3a^2b$ and $2ab^2 + ab^2 = 3ab^2$. Compare with the cube above: 1 big cube, 3 slabs, 3 rods, 1 small cube!", "Zusammenfassen: $a^2b + 2a^2b = 3a^2b$ und $2ab^2 + ab^2 = 3ab^2$. Vergleich mit dem Würfel oben: 1 großer Würfel, 3 Platten, 3 Stangen, 1 kleiner Würfel!") },
  { math: "(a - b)^3 = a^3 - 3a^2 b + 3a b^2 - b^3", note: tx("With a minus the signs alternate: $+, -, +, -$. Each $b$ brings a factor $-1$ with it.", "Mit Minus wechseln die Vorzeichen: $+, -, +, -$. Jedes $b$ bringt einen Faktor $-1$ mit.") },
];

const theoremFrames: Frame[] = [
  { math: "(x#x +#p 2#two)#br ^{4#e}", note: tx("Expand $(x + 2)^4$ without multiplying four brackets: row 4 of Pascal's triangle is $1, 4, 6, 4, 1$.", "$(x + 2)^4$ ausmultiplizieren, ohne vier Klammern zu multiplizieren: Zeile 4 des Pascalschen Dreiecks ist $1, 4, 6, 4, 1$.") },
  {
    math: "x^4 + 4#k1 x^3 \\cdot 2 + 6#k2 x^2 \\cdot 2^2 + 4#k3 x \\cdot 2^3 + 2^4#k4",
    note: tx("The powers of $x$ go **down** from $4$ to $0$, the powers of $2$ go **up** from $0$ to $4$. In every term they add up to $4$.", "Die Exponenten von $x$ gehen **runter** von $4$ bis $0$, die von $2$ gehen **hoch** von $0$ bis $4$. In jedem Term ergeben sie zusammen $4$."),
    highlight: ["k1", "k2", "k3"],
  },
  { math: "x^4 + 8#k1 x^3 + 24#k2 x^2 + 32#k3 x + 16#k4", note: tx("Work out each term: $4 \\cdot 2 = 8$, $6 \\cdot 4 = 24$, $4 \\cdot 8 = 32$ and $2^4 = 16$.", "Rechne jeden Term aus: $4 \\cdot 2 = 8$, $6 \\cdot 4 = 24$, $4 \\cdot 8 = 32$ und $2^4 = 16$.") },
];

const factorOutFrames: Frame[] = [
  { math: "3#k x#a ^{2#e} -#s 12#m x#mv +#p 12#n", note: tx("No squares in sight: $3x^2$ and $12$ aren't squares. But every term is divisible by $3$.", "Keine Quadrate in Sicht: $3x^2$ und $12$ sind keine Quadrate. Aber jeder Term ist durch $3$ teilbar."), highlight: ["k", "m", "n"] },
  { math: "3#k (x#a ^{2#e} -#s 4#m x#mv +#p 4#n)#br", note: tx("So factor out the $3$ first.", "Also klammerst du zuerst die $3$ aus.") },
  { math: "3#k (x#a ^{2#e} -#s 4#m x#mv +#p 2#n ^{2#e2})#br", note: tx("Inside the bracket: $x^2$, $4 = 2^2$ and $2 \\cdot x \\cdot 2 = 4x$. The 2nd binomial formula!", "In der Klammer: $x^2$, $4 = 2^2$ und $2 \\cdot x \\cdot 2 = 4x$. Die 2. binomische Formel!") },
  { math: "3#k (x#a -#s 2#n)#br ^{2#e}", note: tx("Completely factorised: $3x^2 - 12x + 12 = 3(x - 2)^2$.", "Vollständig faktorisiert: $3x^2 - 12x + 12 = 3(x - 2)^2$.") },
];

const conjLesson = conjFrames({ p: 2, v: "x", q: 3, w: "y" });

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Factorising with the binomial formulas", "Faktorisieren mit binomischen Formeln"),
      body: tx("Read the formulas from right to left: a sum becomes a product.", "Lies die Formeln von rechts nach links: Aus einer Summe wird ein Produkt."),
      examples: ["x^2 + 6x + 9 = (x + 3)^2", "x^2 - 10x + 25 = (x - 5)^2", "4x^2 - 9y^2 = (2x + 3y)(2x - 3y)"],
      tone: "rule",
    },
    {
      title: tx("Spot the formula", "Die Formel erkennen"),
      body: tx(
        "First and last term squares? Then check the middle term: is it $2ab$? Plus: 1st formula, minus: 2nd. No middle term, but a minus between two squares: 3rd.",
        "Erster und letzter Term Quadrate? Dann prüf den Mittelterm: Ist er $2ab$? Plus: 1. Formel, Minus: 2. Formel. Kein Mittelterm, aber ein Minus zwischen zwei Quadraten: 3. Formel.",
      ),
      examples: ["9x^2 - 12x + 4: \\quad 2 \\cdot 3x \\cdot 2 = 12x \\quad \\Rightarrow \\quad (3x - 2)^2"],
      tone: "tip",
    },
    {
      title: tx("Factor out first", "Erst ausklammern"),
      body: tx("If all terms share a factor, factor it out first. Then look for a binomial formula in the bracket.", "Haben alle Terme einen gemeinsamen Faktor, klammerst du ihn zuerst aus. Dann suchst du in der Klammer nach einer binomischen Formel."),
      examples: ["3x^2 - 12x + 12 = 3(x^2 - 4x + 4) = 3(x - 2)^2", "2x^2 - 18 = 2(x^2 - 9) = 2(x + 3)(x - 3)"],
      tone: "rule",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx("A sum of two squares can't be factorised with a binomial formula. In the 1st and 2nd formula, $b^2$ at the end is always plus.", "Eine Summe aus zwei Quadraten lässt sich mit keiner binomischen Formel faktorisieren. In der 1. und 2. Formel ist $b^2$ am Ende immer plus."),
      examples: ["x^2 + 9 \\ne (x + 3)^2", "x^2 + 9 \\ne (x + 3)(x - 3)", "x^2 + 6x - 9 \\ne (x + 3)^2", "(a + b)^3 \\ne a^3 + b^3"],
      tone: "warning",
    },
    {
      title: tx("Cubes", "Hoch 3"),
      body: tx("The numbers in front are $1, 3, 3, 1$. With a minus the signs alternate.", "Die Zahlen davor sind $1, 3, 3, 1$. Mit Minus wechseln die Vorzeichen."),
      examples: ["(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3", "(a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3"],
      tone: "rule",
    },
    {
      title: tx("Pascal's triangle and the binomial theorem", "Pascalsches Dreieck und binomischer Lehrsatz"),
      body: tx(
        "Row n holds the coefficients of $(a + b)^n$, the binomial coefficients “n choose k” $= \\frac{n!}{k! \\cdot (n - k)!}$. Powers of $a$ go down, powers of $b$ go up.",
        "Zeile n enthält die Koeffizienten von $(a + b)^n$, die Binomialkoeffizienten „n über k“ $= \\frac{n!}{k! \\cdot (n - k)!}$. Die Exponenten von $a$ gehen runter, die von $b$ hoch.",
      ),
      examples: ["(a + b)^4 = a^4 + 4a^3b + 6a^2b^2 + 4ab^3 + b^4", "(x + 2)^4 = x^4 + 8x^3 + 24x^2 + 32x + 16"],
      tone: "rule",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Backwards: from sum to product", "Rückwärts: von der Summe zum Produkt"),
      blob: tx("You know the binomial formulas forwards. Now let's read them backwards!", "Die binomischen Formeln kennst du vorwärts. Jetzt lesen wir sie rückwärts!"),
      body: tx(
        "**Factorising** means writing a sum as a product. The binomial formulas work in both directions: $x^2 - 10x + 25 = (x - 5)^2$. This is useful for solving equations, simplifying fractions and finding vertices.",
        "**Faktorisieren** heißt: eine Summe als Produkt schreiben. Die binomischen Formeln gelten in beide Richtungen: $x^2 - 10x + 25 = (x - 5)^2$. Das brauchst du zum Lösen von Gleichungen, zum Kürzen von Bruchtermen und für Scheitelpunkte.",
      ),
      frames: squareFrames({ p: 1, v: "x", q: 5, w: "" }, -1),
    },
    {
      type: "widget",
      id: "square-puzzle",
      title: tx("The square puzzle", "Das Quadrat-Puzzle"),
      blob: tx("Change the numbers until the tiles make a perfect square!", "Ändere die Zahlen, bis die Kacheln ein perfektes Quadrat bilden!"),
      body: tx(
        "$x^2 + px + q$ as tiles: one $x^2$ square, $p$ strips and $q$ small squares. Only if $q$ is exactly $(\\frac{p}{2})^2$ do they form a square: then $x^2 + px + q = (x + \\frac{p}{2})^2$.",
        "$x^2 + px + q$ als Kacheln: ein $x^2$-Quadrat, $p$ Streifen und $q$ kleine Quadrate. Nur wenn $q$ genau $(\\frac{p}{2})^2$ ist, bilden sie ein Quadrat: Dann ist $x^2 + px + q = (x + \\frac{p}{2})^2$.",
      ),
      widget: ExpandingSquarePuzzle,
    },
    {
      type: "check",
      blob: tx("Compare the front, the end and the middle.", "Vergleiche vorne, hinten und in der Mitte."),
      exercise: check1,
    },
    {
      type: "explain",
      title: tx("The 3rd formula backwards", "Die 3. Formel rückwärts"),
      blob: tx("Two squares and a minus? That's the easiest one!", "Zwei Quadrate und ein Minus? Das ist die leichteste!"),
      body: tx(
        "How to spot the formula: Are the first and the last term squares? With a middle term $\\pm 2ab$ it's the 1st or 2nd formula. Without a middle term and with a **minus** between the squares, it's the 3rd. A **sum** of two squares like $x^2 + 9$ can't be factorised this way.",
        "So erkennst du die Formel: Sind der erste und der letzte Term Quadrate? Mit Mittelterm $\\pm 2ab$ ist es die 1. oder 2. Formel. Ohne Mittelterm und mit **Minus** zwischen den Quadraten ist es die 3. Eine **Summe** aus zwei Quadraten wie $x^2 + 9$ lässt sich so nicht faktorisieren.",
      ),
      frames: conjLesson,
    },
    {
      type: "explain",
      title: tx("Factor out first", "Erst ausklammern"),
      blob: tx("Sometimes the formula hides behind a common factor.", "Manchmal versteckt sich die Formel hinter einem gemeinsamen Faktor."),
      body: tx("Factorising **completely** means: first factor out what all terms have in common, then use a binomial formula on the bracket.", "**Vollständig** faktorisieren heißt: zuerst ausklammern, was alle Terme gemeinsam haben, dann die Klammer mit einer binomischen Formel faktorisieren."),
      frames: factorOutFrames,
    },
    {
      type: "check",
      blob: tx("Factor out first, then look inside.", "Erst ausklammern, dann in die Klammer schauen."),
      exercise: check2,
    },
    {
      type: "explain",
      id: "cube-of-a-sum",
      title: tx("(a + b)³: the cube", "(a + b)³: der Würfel"),
      blob: tx("Squares are flat. Now we go 3D!", "Quadrate sind flach. Jetzt wird's dreidimensional!"),
      body: tx(
        "A cube with edge $a + b$ has the volume $(a + b)^3$. Cut it at $a$ in all three directions: you get 8 blocks. Pull them apart and count.",
        "Ein Würfel mit der Kante $a + b$ hat das Volumen $(a + b)^3$. Schneid ihn in alle drei Richtungen bei $a$ durch: Es entstehen 8 Quader. Zieh sie auseinander und zähl nach.",
      ),
      visual: { component: ExpandingCube as ComponentType<Record<string, unknown>>, props: {} },
      frames: cubeFrames,
    },
    {
      type: "check",
      blob: tx("Use the formula for (a − b)³. Mind the signs!", "Nimm die Formel für (a − b)³. Achte auf die Vorzeichen!"),
      exercise: check3,
    },
    {
      type: "widget",
      id: "pascals-triangle",
      title: tx("Pascal's triangle", "Das Pascalsche Dreieck"),
      blob: tx("1, 3, 3, 1 isn't a coincidence. Build the triangle!", "1, 3, 3, 1 ist kein Zufall. Bau das Dreieck!"),
      body: tx(
        "Every number is the sum of the two numbers above it. Row n gives the coefficients of $(a + b)^n$: row 2 is $1, 2, 1$, row 3 is $1, 3, 3, 1$. Add rows and tap any number.",
        "Jede Zahl ist die Summe der beiden Zahlen darüber. Zeile n liefert die Koeffizienten von $(a + b)^n$: Zeile 2 ist $1, 2, 1$, Zeile 3 ist $1, 3, 3, 1$. Füg Zeilen hinzu und tipp auf eine Zahl.",
      ),
      widget: ExpandingPascal,
    },
    {
      type: "explain",
      id: "binomial-coefficients",
      title: tx("The binomial theorem", "Der binomische Lehrsatz"),
      blob: tx("One formula for every power. Mathematicians love this one!", "Eine Formel für jeden Exponenten. Die lieben Mathematiker!"),
      body: tx(
        "The numbers in row n are the **binomial coefficients** “n choose k”, written as n above k in round brackets. You calculate them with factorials: “n choose k” $= \\frac{n!}{k! \\cdot (n - k)!}$ with $n! = 1 \\cdot 2 \\cdot … \\cdot n$ and $0! = 1$. Change n and k in the box.",
        "Die Zahlen in Zeile n sind die **Binomialkoeffizienten** „n über k“, geschrieben als n und k übereinander in runden Klammern. Du berechnest sie mit Fakultäten: „n über k“ $= \\frac{n!}{k! \\cdot (n - k)!}$ mit $n! = 1 \\cdot 2 \\cdot … \\cdot n$ und $0! = 1$. Ändere n und k im Kasten.",
      ),
      visual: { component: ExpandingBinomCard as ComponentType<Record<string, unknown>>, props: {} },
      frames: theoremFrames,
    },
    {
      type: "check",
      blob: tx("Find the right term first, then calculate.", "Such erst den passenden Term, dann rechne."),
      exercise: check4,
    },
  ],
};
