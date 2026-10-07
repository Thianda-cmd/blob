"use client";

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import type { Locale } from "@/i18n/config";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { smoothFracExits } from "../equations/level1";
import { choice, clean, dec, FormulaBoard, numberMistakes, type Opt } from "./kit";
import { LensLab, PendulumLab } from "./widgets3";

// ---------------------------------------------------------------------------
// Expert level: the letter appears twice (collect, factor out, divide),
// reciprocal formulas (one fraction per side, then the reciprocal), roots and
// powers, and the conditions a rearranged formula needs.

type Values = Record<string, number>;

/** A typical wrong result: as a formula (`plain`, for expression answers) and/or as a number. */
type Slip = { plain?: string; value?: (v: Values) => number; title: Text; say: Text; close?: boolean };

/** When a result has a denominator: which value of which letter makes it 0, and wrong candidates. */
type Cond = { den: string; letter: string; value: string; others: { text: string; kind: "zero" | "num" | "sign" }[] };

type Derivation = {
  /** The formula, display source. */
  formula: string;
  target: string;
  /** Right answer for the checker. */
  answer: string;
  /** Right answer, display source. */
  result: string;
  frames: Frame[];
  slips: Slip[];
  cond?: Cond;
  hint: Text;
  /** What the letters mean, for formulas from science. */
  legend?: Text;
};

/** A letter as a keyed token; R_1 keeps its subscript: R#k_{1#ks}. */
const K = (x: string, key: string) => {
  const m = /^([A-Za-z])_(\w)$/.exec(x);
  return m ? `${m[1]}#${key}_{${m[2]}#${key}s}` : `${x}#${key}`;
};

const SIGN = tx("Sign didn't change", "Vorzeichen nicht gewechselt");
const UPSIDE = tx("Fraction upside down", "Bruch auf dem Kopf");
const ONE_MISSING = tx("The 1 is missing", "Die 1 fehlt");
const ONLY_ONE = tx("Only one summand multiplied", "Nur ein Summand multipliziert");
const TERM_LOST = tx("One term forgotten", "Einen Term vergessen");

const onlyOneSay = (factor: string, bracket: string) =>
  tx(
    `Ah, I see what happened! When you multiply $${bracket}$ by $${factor}$, **every** summand gets the $${factor}$, not just the first one.`,
    `Ah, ich seh, was passiert ist! Wenn du $${bracket}$ mit $${factor}$ multiplizierst, bekommt **jeder** Summand das $${factor}$, nicht nur der erste.`,
  );

// ---------------------------------------------------------------------------
// The letter appears twice

/** a x + k₁ = k₂ x + b */
function twiceA1(k1: number, k2: number): Derivation {
  return {
    formula: `a x + ${k1} = ${k2} x + b`,
    target: "x",
    answer: `(b-${k1})/(a-${k2})`,
    result: `\\frac{b - ${k1}}{a - ${k2}}`,
    frames: [
      { math: `a#a x#x1 +#p1 ${k1}#k1 =#eq ${k2}#k2 x#x2 +#p2 b#b`, note: tx(`$x$ appears **twice**: in $ax$ and in $${k2}x$. Step 1: collect the x-terms on one side.`, `$x$ kommt **zweimal** vor: in $ax$ und in $${k2}x$. Schritt 1: Sammle die x-Terme auf einer Seite.`), highlight: ["x1", "x2"] },
      { math: `a#a x#x1 +#p1 ${k1}#k1 =#eq ${k2}#k2 x#x2 +#p2 b#b \\quad |#bar \\, -#m1 ${k2}#q2 x#qx -#m2 ${k1}#q1`, note: tx(`Subtract $${k2}x$ and $${k1}$ on both sides.`, `Subtrahiere auf beiden Seiten $${k2}x$ und $${k1}$.`) },
      { math: `a#a x#x1 -#m1 ${k2}#k2 x#x2 =#eq b#b -#m2 ${k1}#k1`, note: tx("All x-terms on the left, the rest on the right.", "Alle x-Terme links, der Rest rechts.") },
      { math: `x#x1 (a#a -#m1 ${k2}#k2)#br =#eq b#b -#m2 ${k1}#k1`, note: tx(`Step 2: factor out $x$: $ax - ${k2}x = x(a - ${k2})$.`, `Schritt 2: Klammere $x$ aus: $ax - ${k2}x = x(a - ${k2})$.`), highlight: ["x1"] },
      { math: `x#x1 =#eq \\frac{b#b -#m2 ${k1}#k1}{a#a -#m1 ${k2}#k2}#fr`, note: tx(`Step 3: divide by the bracket. Condition: $a \\ne ${k2}$, because the bracket must not be $0$.`, `Schritt 3: Teile durch die Klammer. Bedingung: $a \\ne ${k2}$, denn die Klammer darf nicht $0$ sein.`) },
    ],
    slips: [
      { plain: `(b-${k1})/(a+${k2})`, title: SIGN, say: tx(`Ah, I see what happened! $${k2}x$ went over to the left but kept its plus. Bringing it over means **subtracting** it: $ax - ${k2}x$.`, `Ah, ich seh, was passiert ist! $${k2}x$ ist nach links gewandert, hat aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $ax - ${k2}x$.`) },
      { plain: `(b+${k1})/(a-${k2})`, title: SIGN, say: tx(`Nearly! The $+ ${k1}$ went to the right but kept its plus. It has to be **subtracted**: $b - ${k1}$.`, `Fast! Das $+ ${k1}$ ist nach rechts gewandert, hat aber sein Plus behalten. Es muss **subtrahiert** werden: $b - ${k1}$.`) },
      { plain: `(b-${k1})/a`, title: TERM_LOST, say: tx(`Hmm, you only divided by $a$. But $${k2}x$ is an x-term too: collect it on the left first, then factor out $x$.`, `Hmm, du hast nur durch $a$ geteilt. Aber $${k2}x$ ist auch ein x-Term: Hol ihn erst nach links, dann klammere $x$ aus.`) },
    ],
    cond: { den: `a - ${k2}`, letter: "a", value: `${k2}`, others: [{ text: "a = 0", kind: "zero" }, { text: `b = ${k1}`, kind: "num" }, { text: `a = -${k2}`, kind: "sign" }] },
    hint: tx("Collect both x-terms on the left and everything else on the right. Then factor out $x$.", "Sammle beide x-Terme links und alles andere rechts. Dann klammere $x$ aus."),
  };
}

/** a x − k = b x */
function twiceA2(k: number): Derivation {
  return {
    formula: `a x - ${k} = b x`,
    target: "x",
    answer: `${k}/(a-b)`,
    result: `\\frac{${k}}{a - b}`,
    frames: [
      { math: `a#a x#x1 -#s ${k}#k =#eq b#b x#x2`, note: tx("$x$ appears on both sides. Step 1: collect the x-terms on the left.", "$x$ steht auf beiden Seiten. Schritt 1: Sammle die x-Terme links."), highlight: ["x1", "x2"] },
      { math: `a#a x#x1 -#s ${k}#k =#eq b#b x#x2 \\quad |#bar \\, -#m b#qb x#qx +#p ${k}#qk`, note: tx(`Subtract $bx$ and add $${k}$ on both sides.`, `Subtrahiere auf beiden Seiten $bx$ und addiere $${k}$.`) },
      { math: `a#a x#x1 -#m b#b x#x2 =#eq ${k}#k`, note: tx("Now the x-terms are together on the left.", "Jetzt stehen die x-Terme zusammen links.") },
      { math: `x#x1 (a#a -#m b#b)#br =#eq ${k}#k`, note: tx("Step 2: factor out $x$.", "Schritt 2: Klammere $x$ aus."), highlight: ["x1"] },
      { math: `x#x1 =#eq \\frac{${k}#k}{a#a -#m b#b}#fr`, note: tx("Step 3: divide by the bracket. Condition: $a \\ne b$.", "Schritt 3: Teile durch die Klammer. Bedingung: $a \\ne b$.") },
    ],
    slips: [
      { plain: `${k}/(a+b)`, title: SIGN, say: tx("Ah, I see what happened! $bx$ went over to the left but kept its plus. Bringing it over means **subtracting** it: $ax - bx$.", "Ah, ich seh, was passiert ist! $bx$ ist nach links gewandert, hat aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $ax - bx$.") },
      { plain: `(a-b)/${k}`, title: UPSIDE, say: tx(`Upside down! You divide **by** the bracket $(a - b)$, so it goes **under** the fraction bar.`, `Andersrum! Du teilst **durch** die Klammer $(a - b)$, also kommt sie **unter** den Bruchstrich.`) },
      { plain: `${k}/a`, title: TERM_LOST, say: tx("Hmm, you only divided by $a$. But $bx$ is an x-term too: collect it on the left first, then factor out $x$.", "Hmm, du hast nur durch $a$ geteilt. Aber $bx$ ist auch ein x-Term: Hol ihn erst nach links, dann klammere $x$ aus.") },
    ],
    cond: { den: "a - b", letter: "a", value: "b", others: [{ text: "a = 0", kind: "zero" }, { text: "b = 0", kind: "zero" }, { text: "a = -b", kind: "sign" }] },
    hint: tx("Bring $bx$ to the left and the number to the right. Then factor out $x$.", "Bring $bx$ nach links und die Zahl nach rechts. Dann klammere $x$ aus."),
  };
}

/** k₁ x + a = b x − k₂ */
function twiceA3(k1: number, k2: number): Derivation {
  return {
    formula: `${k1} x + a = b x - ${k2}`,
    target: "x",
    answer: `(a+${k2})/(b-${k1})`,
    result: `\\frac{a + ${k2}}{b - ${k1}}`,
    frames: [
      { math: `${k1}#k1 x#x1 +#p a#a =#eq b#b x#x2 -#s ${k2}#k2`, note: tx("$x$ appears on both sides. Step 1: collect the x-terms on the left.", "$x$ steht auf beiden Seiten. Schritt 1: Sammle die x-Terme links."), highlight: ["x1", "x2"] },
      { math: `${k1}#k1 x#x1 +#p a#a =#eq b#b x#x2 -#s ${k2}#k2 \\quad |#bar \\, -#m b#qb x#qx -#m2 a#qa`, note: tx("Subtract $bx$ and $a$ on both sides.", "Subtrahiere auf beiden Seiten $bx$ und $a$.") },
      { math: `${k1}#k1 x#x1 -#m b#b x#x2 =#eq -#s ${k2}#k2 -#m2 a#a`, note: tx("x-terms on the left, the rest on the right.", "x-Terme links, der Rest rechts.") },
      { math: `x#x1 (${k1}#k1 -#m b#b)#br =#eq -#s ${k2}#k2 -#m2 a#a`, note: tx("Step 2: factor out $x$.", "Schritt 2: Klammere $x$ aus."), highlight: ["x1"] },
      { math: `x#x1 =#eq \\frac{-#s ${k2}#k2 -#m2 a#a}{${k1}#k1 -#m b#b}#fr`, note: tx("Step 3: divide by the bracket.", "Schritt 3: Teile durch die Klammer.") },
      { math: `x#x1 =#eq \\frac{a#a +#m2 ${k2}#k2}{b#b -#m ${k1}#k1}#fr`, note: tx(`Tidy up: multiply numerator **and** denominator by $-1$. Condition: $b \\ne ${k1}$.`, `Aufräumen: Zähler **und** Nenner mit $-1$ multiplizieren. Bedingung: $b \\ne ${k1}$.`) },
    ],
    slips: [
      { plain: `(a-${k2})/(b-${k1})`, title: SIGN, say: tx(`Nearly! $a$ went to the right but kept its plus. Bringing it over means **subtracting** it: $-${k2} - a$.`, `Fast! $a$ ist nach rechts gewandert, hat aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $-${k2} - a$.`) },
      { plain: `(a+${k2})/(${k1}-b)`, title: tx("Only the numerator times −1", "Nur den Zähler mal −1"), say: tx("When you multiply by $-1$ to tidy up, the numerator **and** the denominator change their signs.", "Wenn du zum Aufräumen mit $-1$ multiplizierst, ändern Zähler **und** Nenner ihre Vorzeichen.") },
      { plain: `-(a+${k2})/(${k1}+b)`, title: SIGN, say: tx("Ah, I see what happened! $bx$ went over to the left but kept its plus. Bringing it over means **subtracting** it.", "Ah, ich seh, was passiert ist! $bx$ ist nach links gewandert, hat aber sein Plus behalten. Rüberbringen heißt **subtrahieren**.") },
    ],
    cond: { den: `b - ${k1}`, letter: "b", value: `${k1}`, others: [{ text: "b = 0", kind: "zero" }, { text: `a = -${k2}`, kind: "num" }, { text: `b = -${k1}`, kind: "sign" }] },
    hint: tx("Collect the x-terms on the left, the rest on the right, then factor out $x$.", "Sammle die x-Terme links, den Rest rechts, dann klammere $x$ aus."),
  };
}

/** a (x − k) = b x */
function twiceA4(k: number): Derivation {
  return {
    formula: `a (x - ${k}) = b x`,
    target: "x",
    answer: `${k}*a/(a-b)`,
    result: `\\frac{${k} a}{a - b}`,
    frames: [
      { math: `a#a (x#x1 -#s ${k}#k)#br =#eq b#b x#x2`, note: tx("$x$ appears twice, once inside a bracket. Expand the bracket first.", "$x$ kommt zweimal vor, einmal in einer Klammer. Löse zuerst die Klammer auf.") },
      { math: `a#a x#x1 -#s ${k}#k a#a2 =#eq b#b x#x2`, note: tx(`$a(x - ${k}) = ax - ${k}a$: **both** summands times $a$.`, `$a(x - ${k}) = ax - ${k}a$: **beide** Summanden mal $a$.`) },
      { math: `a#a x#x1 -#s ${k}#k a#a2 =#eq b#b x#x2 \\quad |#bar \\, -#m b#qb x#qx +#p ${k}#qk a#qa`, note: tx(`Subtract $bx$ and add $${k}a$ on both sides.`, `Subtrahiere auf beiden Seiten $bx$ und addiere $${k}a$.`) },
      { math: `a#a x#x1 -#m b#b x#x2 =#eq ${k}#k a#a2`, note: tx("x-terms on the left, the rest on the right.", "x-Terme links, der Rest rechts.") },
      { math: `x#x1 (a#a -#m b#b)#br2 =#eq ${k}#k a#a2`, note: tx("Factor out $x$.", "Klammere $x$ aus."), highlight: ["x1"] },
      { math: `x#x1 =#eq \\frac{${k}#k a#a2}{a#a -#m b#b}#fr`, note: tx("Divide by the bracket. Condition: $a \\ne b$.", "Teile durch die Klammer. Bedingung: $a \\ne b$.") },
    ],
    slips: [
      { plain: `${k}/(a-b)`, title: ONLY_ONE, say: onlyOneSay("a", `(x - ${k})`) },
      { plain: `${k}*a/(a+b)`, title: SIGN, say: tx("Ah, I see what happened! $bx$ went over to the left but kept its plus. Bringing it over means **subtracting** it: $ax - bx$.", "Ah, ich seh, was passiert ist! $bx$ ist nach links gewandert, hat aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $ax - bx$.") },
      { plain: `(a-b)/(${k}*a)`, title: UPSIDE, say: tx("Upside down! You divide **by** the bracket $(a - b)$, so it goes **under** the fraction bar.", "Andersrum! Du teilst **durch** die Klammer $(a - b)$, also kommt sie **unter** den Bruchstrich.") },
    ],
    cond: { den: "a - b", letter: "a", value: "b", others: [{ text: "a = 0", kind: "num" }, { text: "b = 0", kind: "zero" }, { text: "a = -b", kind: "sign" }] },
    hint: tx("Expand the bracket first. Then collect the x-terms and factor out $x$.", "Löse zuerst die Klammer auf. Dann sammle die x-Terme und klammere $x$ aus."),
  };
}

/** y = (x + k) / x */
function twiceA5(k: number): Derivation {
  return {
    formula: `y = \\frac{x + ${k}}{x}`,
    target: "x",
    answer: `${k}/(y-1)`,
    result: `\\frac{${k}}{y - 1}`,
    frames: [
      { math: `y#y =#eq \\frac{x#x1 +#p ${k}#k}{x#x2}#fr`, note: tx("$x$ is in the numerator **and** in the denominator. First get rid of the fraction.", "$x$ steht im Zähler **und** im Nenner. Werde zuerst den Bruch los."), highlight: ["x1", "x2"] },
      { math: `y#y \\cdot#d x#x2 =#eq x#x1 +#p ${k}#k`, note: tx("Multiply both sides by $x$ (for $x \\ne 0$).", "Multipliziere beide Seiten mit $x$ (für $x \\ne 0$).") },
      { math: `y#y x#x2 -#m x#x1 =#eq ${k}#k`, note: tx("Collect the x-terms on the left: subtract $x$.", "Sammle die x-Terme links: Subtrahiere $x$.") },
      { math: `x#x2 (y#y -#m 1#one)#br =#eq ${k}#k`, note: tx("Factor out $x$. Careful: $x = x \\cdot 1$, so a $1$ stays in the bracket.", "Klammere $x$ aus. Vorsicht: $x = x \\cdot 1$, also bleibt eine $1$ in der Klammer."), highlight: ["one"] },
      { math: `x#x2 =#eq \\frac{${k}#k}{y#y -#m 1#one}#fr2`, note: tx("Divide by the bracket. Condition: $y \\ne 1$.", "Teile durch die Klammer. Bedingung: $y \\ne 1$.") },
    ],
    slips: [
      { plain: `${k}/y`, title: ONE_MISSING, say: tx("So close! When you factor out $x$ from $yx - x$, a $1$ stays behind: $x(y - 1)$. It doesn't just vanish.", "Ganz knapp! Wenn du $x$ aus $yx - x$ ausklammerst, bleibt eine $1$ übrig: $x(y - 1)$. Die verschwindet nicht einfach."), close: true },
      { plain: `${k}/(y+1)`, title: SIGN, say: tx("Ah, I see what happened! The $x$ went over to the left but kept its plus. Bringing it over means **subtracting** it: $yx - x$.", "Ah, ich seh, was passiert ist! Das $x$ ist nach links gewandert, hat aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $yx - x$.") },
      { plain: `(y-1)/${k}`, title: UPSIDE, say: tx("Upside down! You divide **by** the bracket $(y - 1)$, so it goes **under** the fraction bar.", "Andersrum! Du teilst **durch** die Klammer $(y - 1)$, also kommt sie **unter** den Bruchstrich.") },
    ],
    cond: { den: "y - 1", letter: "y", value: "1", others: [{ text: "y = 0", kind: "zero" }, { text: "y = -1", kind: "sign" }, { text: `y = ${k}`, kind: "zero" }] },
    hint: tx("Multiply by $x$ first. Then collect the x-terms on one side and factor out $x$.", "Multipliziere zuerst mit $x$. Dann sammle die x-Terme auf einer Seite und klammere $x$ aus."),
  };
}

/** y = a x / (x + k) */
function twiceA6(k: number): Derivation {
  return {
    formula: `y = \\frac{a x}{x + ${k}}`,
    target: "x",
    answer: `${k}*y/(a-y)`,
    result: `\\frac{${k} y}{a - y}`,
    frames: [
      { math: `y#y =#eq \\frac{a#a x#x1}{x#x2 +#p ${k}#k}#fr`, note: tx("$x$ appears twice: in the numerator and in the denominator.", "$x$ kommt zweimal vor: im Zähler und im Nenner."), highlight: ["x1", "x2"] },
      { math: `y#y (x#x2 +#p ${k}#k)#br =#eq a#a x#x1`, note: tx(`Multiply both sides by the denominator $x + ${k}$.`, `Multipliziere beide Seiten mit dem Nenner $x + ${k}$.`) },
      { math: `y#y x#x2 +#p ${k}#k y#y2 =#eq a#a x#x1`, note: tx("Expand: **both** summands times $y$.", "Ausmultiplizieren: **beide** Summanden mal $y$.") },
      { math: `${k}#k y#y2 =#eq a#a x#x1 -#m y#y x#x2`, note: tx("Collect the x-terms on the **right** this time (so they stay positive): subtract $yx$.", "Sammle die x-Terme diesmal **rechts** (dann bleiben sie positiv): Subtrahiere $yx$.") },
      { math: `${k}#k y#y2 =#eq x#x1 (a#a -#m y#y)#br2`, note: tx("Factor out $x$.", "Klammere $x$ aus."), highlight: ["x1"] },
      { math: `x#x1 =#eq \\frac{${k}#k y#y2}{a#a -#m y#y}#fr2`, note: tx("Divide by the bracket and swap the sides. Condition: $y \\ne a$.", "Teile durch die Klammer und tausche die Seiten. Bedingung: $y \\ne a$.") },
    ],
    slips: [
      { plain: `${k}/(a-y)`, title: ONLY_ONE, say: onlyOneSay("y", `(x + ${k})`) },
      { plain: `${k}*y/(a+y)`, title: SIGN, say: tx("Ah, I see what happened! $yx$ changed sides but kept its plus. Bringing it over means **subtracting** it: $ax - yx$.", "Ah, ich seh, was passiert ist! $yx$ hat die Seite gewechselt, aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $ax - yx$.") },
      { plain: `${k}*y/a`, title: TERM_LOST, say: tx("Hmm, you only divided by $a$. But $yx$ is an x-term too: collect both x-terms and factor out $x$.", "Hmm, du hast nur durch $a$ geteilt. Aber $yx$ ist auch ein x-Term: Sammle beide x-Terme und klammere $x$ aus.") },
    ],
    cond: { den: "a - y", letter: "y", value: "a", others: [{ text: "y = 0", kind: "num" }, { text: "a = 0", kind: "zero" }, { text: "y = -a", kind: "sign" }] },
    hint: tx("Multiply by the denominator, expand, collect the x-terms on one side, then factor out $x$.", "Multipliziere mit dem Nenner, multipliziere aus, sammle die x-Terme auf einer Seite und klammere $x$ aus."),
  };
}

/** y = (x + a) / (x − k) */
function twiceA7(k: number): Derivation {
  return {
    formula: `y = \\frac{x + a}{x - ${k}}`,
    target: "x",
    answer: `(a+${k}*y)/(y-1)`,
    result: `\\frac{a + ${k} y}{y - 1}`,
    frames: [
      { math: `y#y =#eq \\frac{x#x1 +#p a#a}{x#x2 -#s ${k}#k}#fr`, note: tx("$x$ appears in the numerator and in the denominator.", "$x$ steht im Zähler und im Nenner."), highlight: ["x1", "x2"] },
      { math: `y#y (x#x2 -#s ${k}#k)#br =#eq x#x1 +#p a#a`, note: tx(`Multiply both sides by the denominator $x - ${k}$.`, `Multipliziere beide Seiten mit dem Nenner $x - ${k}$.`) },
      { math: `y#y x#x2 -#s ${k}#k y#y2 =#eq x#x1 +#p a#a`, note: tx("Expand: **both** summands times $y$.", "Ausmultiplizieren: **beide** Summanden mal $y$.") },
      { math: `y#y x#x2 -#m x#x1 =#eq a#a +#s ${k}#k y#y2`, note: tx(`x-terms to the left, the rest to the right: subtract $x$, add $${k}y$.`, `x-Terme nach links, der Rest nach rechts: Subtrahiere $x$, addiere $${k}y$.`) },
      { math: `x#x2 (y#y -#m 1#one)#br2 =#eq a#a +#s ${k}#k y#y2`, note: tx("Factor out $x$; the $1$ stays in the bracket.", "Klammere $x$ aus; die $1$ bleibt in der Klammer."), highlight: ["one"] },
      { math: `x#x2 =#eq \\frac{a#a +#s ${k}#k y#y2}{y#y -#m 1#one}#fr2`, note: tx("Divide by the bracket. Condition: $y \\ne 1$.", "Teile durch die Klammer. Bedingung: $y \\ne 1$.") },
    ],
    slips: [
      { plain: `(a+${k})/(y-1)`, title: ONLY_ONE, say: onlyOneSay("y", `(x - ${k})`) },
      { plain: `(a+${k}*y)/y`, title: ONE_MISSING, say: tx("So close! When you factor out $x$ from $yx - x$, a $1$ stays behind: $x(y - 1)$.", "Ganz knapp! Wenn du $x$ aus $yx - x$ ausklammerst, bleibt eine $1$ übrig: $x(y - 1)$."), close: true },
      { plain: `(a-${k}*y)/(y-1)`, title: SIGN, say: tx(`Nearly! $-${k}y$ went to the right but kept its minus. Bringing it over means **adding** it: $a + ${k}y$.`, `Fast! $-${k}y$ ist nach rechts gewandert, hat aber sein Minus behalten. Rüberbringen heißt **addieren**: $a + ${k}y$.`) },
    ],
    cond: { den: "y - 1", letter: "y", value: "1", others: [{ text: "y = 0", kind: "zero" }, { text: "y = -1", kind: "sign" }, { text: `y = ${k}`, kind: "zero" }] },
    hint: tx("Multiply by the denominator, expand, collect the x-terms, factor out $x$.", "Multipliziere mit dem Nenner, multipliziere aus, sammle die x-Terme, klammere $x$ aus."),
  };
}

/** E = m g h + ½ m v² for m */
function twiceEnergy(): Derivation {
  return {
    formula: `E = m g h + \\frac{1}{2} m v^2`,
    target: "m",
    answer: "2*E/(2*g*h+v^2)",
    result: `\\frac{2 E}{2 g h + v^2}`,
    legend: tx("Energy $E$ of a mass $m$ at the height $h$ moving at the speed $v$ ($g$: gravity).", "Energie $E$ einer Masse $m$ in der Höhe $h$ mit der Geschwindigkeit $v$ ($g$: Fallbeschleunigung)."),
    frames: [
      { math: `E#E =#eq m#m1 g#g h#h +#p \\frac{1#o}{2#t}#hf m#m2 v#v^{2#e}`, note: tx("Potential plus kinetic energy. $m$ appears in **both** summands.", "Lageenergie plus Bewegungsenergie. $m$ steht in **beiden** Summanden."), highlight: ["m1", "m2"] },
      { math: `E#E =#eq m#m1 (g#g h#h +#p \\frac{1#o}{2#t}#hf v#v^{2#e})#br`, note: tx("Factor out $m$.", "Klammere $m$ aus."), highlight: ["m1"] },
      { math: `m#m1 =#eq \\frac{E#E}{g#g h#h +#p \\frac{1#o}{2#t}#hf v#v^{2#e}}#fr`, note: tx("Divide by the bracket and swap the sides.", "Teile durch die Klammer und tausche die Seiten.") },
      { math: `m#m1 =#eq \\frac{2#t2 E#E}{2#t3 g#g h#h +#p v#v^{2#e}}#fr`, note: tx("Nicer without a fraction in the denominator: multiply numerator and denominator by $2$.", "Schöner ohne Bruch im Nenner: Zähler und Nenner mit $2$ multiplizieren.") },
    ],
    slips: [
      { plain: "E/(g*h*v^2/2)", title: tx("Product instead of sum", "Produkt statt Summe"), say: tx("When you factor out $m$, the rest stays a **sum**: $m(gh + \\frac{1}{2}v^2)$. The two parts are added, not multiplied.", "Wenn du $m$ ausklammerst, bleibt der Rest eine **Summe**: $m(gh + \\frac{1}{2}v^2)$. Die Teile werden addiert, nicht multipliziert.") },
      { plain: "E-g*h-v^2/2", title: tx("Subtracted instead of divided", "Subtrahiert statt geteilt"), say: tx("$m$ is **multiplied** by the bracket, so you **divide** by the whole bracket.", "$m$ wird mit der Klammer **multipliziert**, also **teilst** du durch die ganze Klammer.") },
      { plain: "E/(g*h)", title: TERM_LOST, say: tx("Hmm, the kinetic part $\\frac{1}{2}mv^2$ got lost. It contains $m$ too: factor $m$ out of **both** summands.", "Hmm, der Teil $\\frac{1}{2}mv^2$ ist verloren gegangen. Da steckt auch $m$ drin: Klammere $m$ aus **beiden** Summanden aus.") },
    ],
    hint: tx("$m$ is in both summands: factor it out, then divide by the bracket.", "$m$ steht in beiden Summanden: Klammere es aus und teile dann durch die Klammer."),
  };
}

/** h = 2ab / (a + b) for a (the harmonic mean) */
function twiceHarmonic(): Derivation {
  return {
    formula: `h = \\frac{2 a b}{a + b}`,
    target: "a",
    answer: "h*b/(2*b-h)",
    result: `\\frac{h b}{2 b - h}`,
    legend: tx("The harmonic mean $h$ of two numbers $a$ and $b$.", "Das harmonische Mittel $h$ zweier Zahlen $a$ und $b$."),
    frames: [
      { math: `h#h =#eq \\frac{2#two a#a1 b#b1}{a#a2 +#p b#b2}#fr`, note: tx("$a$ appears twice: in the numerator and in the denominator.", "$a$ kommt zweimal vor: im Zähler und im Nenner."), highlight: ["a1", "a2"] },
      { math: `h#h (a#a2 +#p b#b2)#br =#eq 2#two a#a1 b#b1`, note: tx("Multiply by the denominator.", "Multipliziere mit dem Nenner.") },
      { math: `h#h a#a2 +#p h#h2 b#b2 =#eq 2#two a#a1 b#b1`, note: tx("Expand the bracket.", "Löse die Klammer auf.") },
      { math: `h#h2 b#b2 =#eq 2#two a#a1 b#b1 -#m h#h a#a2`, note: tx("Collect the a-terms on the right: subtract $ha$.", "Sammle die a-Terme rechts: Subtrahiere $ha$.") },
      { math: `h#h2 b#b2 =#eq a#a1 (2#two b#b1 -#m h#h)#br2`, note: tx("Factor out $a$.", "Klammere $a$ aus."), highlight: ["a1"] },
      { math: `a#a1 =#eq \\frac{h#h2 b#b2}{2#two b#b1 -#m h#h}#fr2`, note: tx("Divide by the bracket and swap the sides. Condition: $h \\ne 2b$.", "Teile durch die Klammer und tausche die Seiten. Bedingung: $h \\ne 2b$.") },
    ],
    slips: [
      { plain: "b/(2*b-h)", title: ONLY_ONE, say: onlyOneSay("h", "(a + b)") },
      { plain: "h*b/(2*b+h)", title: SIGN, say: tx("Ah, I see what happened! $ha$ changed sides but kept its plus. Bringing it over means **subtracting** it: $2ab - ha$.", "Ah, ich seh, was passiert ist! $ha$ hat die Seite gewechselt, aber sein Plus behalten. Rüberbringen heißt **subtrahieren**: $2ab - ha$.") },
      { plain: "h*b/(2*b)", title: TERM_LOST, say: tx("Hmm, $ha$ got lost. It contains $a$ too: collect both a-terms and factor out $a$.", "Hmm, $ha$ ist verloren gegangen. Da steckt auch $a$ drin: Sammle beide a-Terme und klammere $a$ aus.") },
    ],
    cond: { den: "2 b - h", letter: "h", value: "2 b", others: [{ text: "h = 0", kind: "num" }, { text: "b = 0", kind: "zero" }, { text: "h = -2 b", kind: "sign" }] },
    hint: tx("Multiply by the denominator, expand, collect the a-terms on one side and factor out $a$.", "Multipliziere mit dem Nenner, löse die Klammer auf, sammle die a-Terme auf einer Seite und klammere $a$ aus."),
  };
}

// ---------------------------------------------------------------------------
// Reciprocal formulas: 1/S = 1/P + 1/Q

type Names = { S: string; P: string; Q: string };

function recip(n: Names, target: string, legend?: Text): Derivation {
  const { S, P, Q } = n;
  const frac = (num: string, den: string, key: string) => `\\frac{${num}}{${den}}#${key}`;
  const plainName = (x: string) => x.replace(/_(\w)/, "$1");
  if (target === S) {
    return {
      formula: `\\frac{1}{${S}} = \\frac{1}{${P}} + \\frac{1}{${Q}}`,
      target,
      answer: `${plainName(P)}*${plainName(Q)}/(${plainName(P)}+${plainName(Q)})`,
      result: `\\frac{${P} ${Q}}{${P} + ${Q}}`,
      legend,
      frames: [
        { math: `${frac("1#n1", K(S, "S"), "F")} =#eq ${frac("1#n2", K(P, "P"), "G")} +#p ${frac("1#n3", K(Q, "Q"), "H")}`, note: tx(`We want $${S}$. Step 1: add the two fractions on the right.`, `Wir suchen $${S}$. Schritt 1: Addiere die beiden Brüche rechts.`) },
        {
          math: `${frac("1#n1", K(S, "S"), "F")} =#eq ${frac(K(Q, "n2"), `${K(P, "P")} ${K(Q, "Q2")}`, "G")} +#p ${frac(K(P, "n3"), `${K(P, "P2")} ${K(Q, "Q")}`, "H")}`,
          note: tx(`Common denominator $${P}${Q}$: expand $\\frac{1}{${P}}$ by $${Q}$ and $\\frac{1}{${Q}}$ by $${P}$.`, `Hauptnenner $${P}${Q}$: Erweitere $\\frac{1}{${P}}$ mit $${Q}$ und $\\frac{1}{${Q}}$ mit $${P}$.`),
        },
        { math: `${frac("1#n1", K(S, "S"), "F")} =#eq ${frac(`${K(Q, "n2")} +#p ${K(P, "n3")}`, `${K(P, "P")} ${K(Q, "Q2")}`, "G")}`, note: tx("Add the numerators. Now each side is **one** fraction.", "Addiere die Zähler. Jetzt ist jede Seite **ein** Bruch.") },
        { math: `${frac(K(S, "S"), "1#n1", "F")} =#eq ${frac(`${K(P, "P")} ${K(Q, "Q2")}`, `${K(Q, "n2")} +#p ${K(P, "n3")}`, "G")}`, note: tx("Step 2: take the reciprocal (Kehrwert) of both sides: flip both fractions.", "Schritt 2: Bilde auf beiden Seiten den Kehrwert: Dreh beide Brüche um.") },
        { math: `${K(S, "S")} =#eq ${frac(`${K(P, "P")} ${K(Q, "Q2")}`, `${K(P, "n3")} +#p ${K(Q, "n2")}`, "G")}`, note: tx(`Done. Note: $${S}$ is **not** $${P} + ${Q}$.`, `Fertig. Merke: $${S}$ ist **nicht** $${P} + ${Q}$.`) },
      ],
      slips: [
        { plain: `${plainName(P)}+${plainName(Q)}`, value: (v) => v[P] + v[Q], title: tx("Flipped each fraction", "Jeden Bruch einzeln umgedreht"), say: tx("Ooh, classic trap! You can't flip fractions one by one: $\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6}$, but $2 \\ne 3 + 6$. First add them to **one** fraction, then take the reciprocal.", "Die klassische Falle! Du darfst die Brüche nicht einzeln umdrehen: $\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6}$, aber $2 \\ne 3 + 6$. Addiere sie erst zu **einem** Bruch, dann bildest du den Kehrwert.") },
        { plain: `(${plainName(P)}+${plainName(Q)})/(${plainName(P)}*${plainName(Q)})`, value: (v) => (v[P] + v[Q]) / (v[P] * v[Q]), title: tx("Reciprocal missing", "Kehrwert fehlt"), say: tx(`So close! That's $\\frac{1}{${S}}$, not $${S}$. Take the reciprocal at the end: flip the fraction.`, `Ganz knapp! Das ist $\\frac{1}{${S}}$, nicht $${S}$. Bilde am Ende noch den Kehrwert: Dreh den Bruch um.`), close: true },
      ],
      cond: undefined,
      hint: tx(`Add the fractions on the right to one fraction (common denominator $${P}${Q}$), then take the reciprocal of both sides.`, `Fasse die Brüche rechts zu einem Bruch zusammen (Hauptnenner $${P}${Q}$) und bilde dann auf beiden Seiten den Kehrwert.`),
    };
  }
  // The target is one of the summands; O is the other one.
  const T = target;
  const O = T === P ? Q : P;
  const [pO, pS] = [plainName(O), plainName(S)];
  const fS = frac("1#n1", K(S, "S"), "F");
  const fO = frac("1#n2", K(O, "O"), "G");
  const fT = frac("1#n3", K(T, "T"), "H");
  // Same order as the formula, keys by role (T: the target, O: the other summand).
  const first = T === Q ? `${fS} =#eq ${fO} +#p ${fT}` : `${fS} =#eq ${fT} +#p ${fO}`;
  return {
    formula: `\\frac{1}{${S}} = \\frac{1}{${P}} + \\frac{1}{${Q}}`,
    target,
    answer: `${pS}*${pO}/(${pO}-${pS})`,
    result: `\\frac{${S} ${O}}{${O} - ${S}}`,
    legend,
    frames: [
      { math: first, note: tx(`We want $${T}$, and it sits in a denominator. Step 1: get $\\frac{1}{${T}}$ alone.`, `Wir suchen $${T}$, und das steht im Nenner. Schritt 1: Bring $\\frac{1}{${T}}$ allein auf eine Seite.`) },
      { math: `${fS} -#p ${fO} =#eq ${fT}`, note: tx(`Subtract $\\frac{1}{${O}}$ on both sides.`, `Subtrahiere auf beiden Seiten $\\frac{1}{${O}}$.`) },
      {
        math: `${frac(K(O, "n1"), `${K(S, "S")} ${K(O, "O2")}`, "F")} -#p ${frac(K(S, "n2"), `${K(S, "S2")} ${K(O, "O")}`, "G")} =#eq ${frac("1#n3", K(T, "T"), "H")}`,
        note: tx(`Step 2: common denominator $${S}${O}$. Expand $\\frac{1}{${S}}$ by $${O}$ and $\\frac{1}{${O}}$ by $${S}$.`, `Schritt 2: Hauptnenner $${S}${O}$. Erweitere $\\frac{1}{${S}}$ mit $${O}$ und $\\frac{1}{${O}}$ mit $${S}$.`),
      },
      { math: `${frac(`${K(O, "n1")} -#p ${K(S, "n2")}`, `${K(S, "S")} ${K(O, "O2")}`, "F")} =#eq ${frac("1#n3", K(T, "T"), "H")}`, note: tx("Subtract the numerators. Now each side is **one** fraction.", "Subtrahiere die Zähler. Jetzt ist jede Seite **ein** Bruch.") },
      { math: `${frac(`${K(S, "S")} ${K(O, "O2")}`, `${K(O, "n1")} -#p ${K(S, "n2")}`, "F")} =#eq ${frac(K(T, "T"), "1#n3", "H")}`, note: tx("Step 3: take the reciprocal (Kehrwert) of both sides: flip both fractions.", "Schritt 3: Bilde auf beiden Seiten den Kehrwert: Dreh beide Brüche um.") },
      { math: `${K(T, "T")} =#eq ${frac(`${K(S, "S")} ${K(O, "O2")}`, `${K(O, "n1")} -#p ${K(S, "n2")}`, "F")}`, note: tx(`Swap the sides. Done, with the condition $${O} \\ne ${S}$.`, `Seiten tauschen. Fertig, mit der Bedingung $${O} \\ne ${S}$.`) },
    ],
    slips: [
      { plain: `${pS}-${pO}`, value: (v) => v[S] - v[O], title: tx("Flipped each fraction", "Jeden Bruch einzeln umgedreht"), say: tx("Ooh, classic trap! You can't flip fractions one by one: $\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6}$, but $2 \\ne 3 + 6$. First make **one** fraction on each side, then take the reciprocal.", "Die klassische Falle! Du darfst die Brüche nicht einzeln umdrehen: $\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6}$, aber $2 \\ne 3 + 6$. Mach erst auf jeder Seite **einen** Bruch, dann bildest du den Kehrwert.") },
      { plain: `(${pO}-${pS})/(${pS}*${pO})`, value: (v) => (v[O] - v[S]) / (v[S] * v[O]), title: tx("Reciprocal missing", "Kehrwert fehlt"), say: tx(`So close! That's $\\frac{1}{${T}}$, not $${T}$. Take the reciprocal at the end: flip the fraction.`, `Ganz knapp! Das ist $\\frac{1}{${T}}$, nicht $${T}$. Bilde am Ende noch den Kehrwert: Dreh den Bruch um.`), close: true },
      { plain: `${pS}*${pO}/(${pS}+${pO})`, value: (v) => (v[S] * v[O]) / (v[S] + v[O]), title: SIGN, say: tx(`Ah, I see what happened! $\\frac{1}{${O}}$ went over but kept its plus. It has to be **subtracted**: $\\frac{1}{${S}} - \\frac{1}{${O}}$.`, `Ah, ich seh, was passiert ist! $\\frac{1}{${O}}$ ist rübergewandert, hat aber sein Plus behalten. Es muss **subtrahiert** werden: $\\frac{1}{${S}} - \\frac{1}{${O}}$.`) },
      { plain: `${pS}*${pO}/(${pS}-${pO})`, value: (v) => (v[S] * v[O]) / (v[S] - v[O]), title: tx("Subtracted the wrong way round", "Falsch herum subtrahiert"), say: tx(`Almost! $\\frac{1}{${S}} - \\frac{1}{${O}} = \\frac{${O} - ${S}}{${S}${O}}$: after expanding, the numerator is $${O} - ${S}$.`, `Fast! $\\frac{1}{${S}} - \\frac{1}{${O}} = \\frac{${O} - ${S}}{${S}${O}}$: Nach dem Erweitern lautet der Zähler $${O} - ${S}$.`), close: true },
    ],
    cond: { den: `${O} - ${S}`, letter: O, value: S, others: [] },
    hint: tx(`First get $\\frac{1}{${T}}$ alone. Then make one fraction (common denominator $${S}${O}$) and take the reciprocal of both sides.`, `Bring zuerst $\\frac{1}{${T}}$ allein auf eine Seite. Dann mach einen Bruch daraus (Hauptnenner $${S}${O}$) und bilde auf beiden Seiten den Kehrwert.`),
  };
}

const LENS_LEGEND = tx("The lens equation: focal length $f$, object distance $g$, image distance $b$.", "Die Linsengleichung: Brennweite $f$, Gegenstandsweite $g$, Bildweite $b$.");
const PUMP_LEGEND = tx("Two pumps fill a tank together in the time $t$. Alone, the first needs the time $a$, the second the time $b$.", "Zwei Pumpen füllen ein Becken zusammen in der Zeit $t$. Allein braucht die erste die Zeit $a$, die zweite die Zeit $b$.");
const RES_LEGEND = tx("Two resistors $R_1$ and $R_2$ connected in parallel have the total resistance $R$.", "Zwei parallel geschaltete Widerstände $R_1$ und $R_2$ haben den Gesamtwiderstand $R$.");
const LENS: Names = { S: "f", P: "g", Q: "b" };
const PUMPS: Names = { S: "t", P: "a", Q: "b" };
const RESISTORS: Names = { S: "R", P: "R_1", Q: "R_2" };

// ---------------------------------------------------------------------------
// Roots and powers

const PENDULUM_LEGEND = tx("Period $T$ of a pendulum with the length $l$ ($g$: gravity).", "Periodendauer $T$ eines Pendels mit der Länge $l$ ($g$: Fallbeschleunigung).");

function pendulum(target: "l" | "g"): Derivation {
  const head: Frame[] = [
    { math: "T#T =#eq 2#two \\pi#pi \\sqrt{\\frac{l#l}{g#g}#fr}#rt", note: tx(`$${target}$ sits under a root, inside a fraction. Undo from the outside in.`, `$${target}$ steht unter einer Wurzel, in einem Bruch. Mach es von außen nach innen rückgängig.`) },
    { math: "\\frac{T#T}{2#two \\pi#pi}#F =#eq \\sqrt{\\frac{l#l}{g#g}#fr}#rt", note: tx("First divide by $2\\pi$.", "Teile zuerst durch $2\\pi$.") },
    { math: "\\frac{T#T^{2#e1}}{4#two \\pi#pi^{2#e2}}#F =#eq \\frac{l#l}{g#g}#fr", note: tx("Square both sides, the **whole** fraction: $(\\frac{T}{2\\pi})^2 = \\frac{T^2}{4\\pi^2}$. The root is gone.", "Quadriere beide Seiten, den **ganzen** Bruch: $(\\frac{T}{2\\pi})^2 = \\frac{T^2}{4\\pi^2}$. Die Wurzel ist weg.") },
  ];
  if (target === "l")
    return {
      formula: "T = 2 \\pi \\sqrt{\\frac{l}{g}}",
      target,
      answer: "g*T^2/(4*pi^2)",
      result: "\\frac{g T^2}{4 \\pi^2}",
      legend: PENDULUM_LEGEND,
      frames: [
        ...head,
        { math: "\\frac{g#g T#T^{2#e1}}{4#two \\pi#pi^{2#e2}}#F =#eq l#l", note: tx("Multiply both sides by $g$.", "Multipliziere beide Seiten mit $g$.") },
        { math: "l#l =#eq \\frac{g#g T#T^{2#e1}}{4#two \\pi#pi^{2#e2}}#F", note: tx("Swap the sides. Done.", "Seiten tauschen. Fertig.") },
      ],
      slips: [
        { plain: "g*T^2/(2*pi)", value: (v) => (v.g * v.T ** 2) / (2 * Math.PI), title: tx("Only the numerator squared", "Nur den Zähler quadriert"), say: tx("When you square a fraction, square the numerator **and** the denominator: $(2\\pi)^2 = 4\\pi^2$.", "Wenn du einen Bruch quadrierst, quadrierst du Zähler **und** Nenner: $(2\\pi)^2 = 4\\pi^2$.") },
        { plain: "g*T/(2*pi)", value: (v) => (v.g * v.T) / (2 * Math.PI), title: tx("Root not undone", "Wurzel nicht aufgelöst"), say: tx("Almost! $l$ is under a square root, and that root never got undone. **Square** both sides.", "Fast! $l$ steht unter einer Wurzel, und die hast du nicht rückgängig gemacht. **Quadriere** beide Seiten.") },
        { plain: "T^2/(4*pi^2*g)", value: (v) => v.T ** 2 / (4 * Math.PI ** 2 * v.g), title: tx("Divided instead of multiplied", "Geteilt statt multipliziert"), say: tx("$l$ is **divided** by $g$, so you undo that by **multiplying** by $g$.", "$l$ wird durch $g$ **geteilt**. Das machst du mit **Multiplizieren** mit $g$ rückgängig.") },
      ],
      hint: tx("Divide by $2\\pi$, square both sides, then multiply by $g$.", "Teile durch $2\\pi$, quadriere beide Seiten und multipliziere dann mit $g$."),
    };
  return {
    formula: "T = 2 \\pi \\sqrt{\\frac{l}{g}}",
    target,
    answer: "4*pi^2*l/T^2",
    result: "\\frac{4 \\pi^2 l}{T^2}",
    legend: PENDULUM_LEGEND,
    frames: [
      ...head,
      { math: "g#g T#T^{2#e1} =#eq 4#two \\pi#pi^{2#e2} l#l", note: tx("$g$ is in a denominator: multiply both sides by $g$ and by $4\\pi^2$.", "$g$ steht im Nenner: Multipliziere beide Seiten mit $g$ und mit $4\\pi^2$.") },
      { math: "g#g =#eq \\frac{4#two \\pi#pi^{2#e2} l#l}{T#T^{2#e1}}#F2", note: tx("Divide by $T^2$. Done.", "Teile durch $T^2$. Fertig.") },
    ],
    slips: [
      { plain: "2*pi*l/T^2", title: tx("Only the numerator squared", "Nur den Zähler quadriert"), say: tx("When you square a fraction, square the numerator **and** the denominator: $(2\\pi)^2 = 4\\pi^2$.", "Wenn du einen Bruch quadrierst, quadrierst du Zähler **und** Nenner: $(2\\pi)^2 = 4\\pi^2$.") },
      { plain: "T^2/(4*pi^2*l)", title: UPSIDE, say: tx("Upside down! $g$ was in the **denominator** of $\\frac{l}{g}$; in the end $g = \\frac{4\\pi^2 l}{T^2}$ has $l$ on top.", "Andersrum! $g$ stand im **Nenner** von $\\frac{l}{g}$; am Ende steht bei $g = \\frac{4\\pi^2 l}{T^2}$ das $l$ oben.") },
      { plain: "2*pi*l/T", title: tx("Root not undone", "Wurzel nicht aufgelöst"), say: tx("Almost! $g$ is under a square root, and that root never got undone. **Square** both sides.", "Fast! $g$ steht unter einer Wurzel, und die hast du nicht rückgängig gemacht. **Quadriere** beide Seiten.") },
    ],
    hint: tx("Divide by $2\\pi$ and square both sides. Then get $g$ out of the denominator.", "Teile durch $2\\pi$ und quadriere beide Seiten. Dann hol $g$ aus dem Nenner."),
  };
}

function gravity(target: "r" | "M"): Derivation {
  const legend = tx("Gravitational force $F$ between two masses $m$ and $M$ at the distance $r$ ($G$: gravitational constant).", "Gravitationskraft $F$ zwischen zwei Massen $m$ und $M$ im Abstand $r$ ($G$: Gravitationskonstante).");
  const start: Frame = { math: "F#F =#eq \\frac{G#G m#m M#M}{r#r^{2#e}}#fr", note: tx(`We want $${target}$.`, `Wir suchen $${target}$.`) };
  const cross: Frame = { math: "F#F r#r^{2#e} =#eq G#G m#m M#M", note: tx("Multiply both sides by $r^2$.", "Multipliziere beide Seiten mit $r^2$.") };
  if (target === "r")
    return {
      formula: "F = \\frac{G m M}{r^2}",
      target,
      answer: "sqrt(G*m*M/F)",
      result: "\\sqrt{\\frac{G m M}{F}}",
      legend,
      frames: [
        start,
        cross,
        { math: "r#r^{2#e} =#eq \\frac{G#G m#m M#M}{F#F}#fr2", note: tx("Divide by $F$.", "Teile durch $F$.") },
        { math: "r#r =#eq \\sqrt{\\frac{G#G m#m M#M}{F#F}#fr2}#rt", note: tx("Take the square root. $r$ is a distance, so only the positive root counts.", "Zieh die Wurzel. $r$ ist ein Abstand, also zählt nur die positive Wurzel.") },
      ],
      slips: [
        { plain: "G*m*M/F", title: tx("Square root missing", "Wurzel vergessen"), say: tx("So close! That's $r^2$. You still need the **square root** to get $r$.", "Ganz knapp! Das ist $r^2$. Für $r$ fehlt noch die **Wurzel**."), close: true },
        { plain: "sqrt(F/(G*m*M))", title: UPSIDE, say: tx("Upside down! $r^2 = \\frac{GmM}{F}$: the force $F$ goes **under** the fraction bar.", "Andersrum! $r^2 = \\frac{GmM}{F}$: Die Kraft $F$ kommt **unter** den Bruchstrich.") },
        { plain: "G*m*M/F^2", title: tx("Squared instead of root", "Quadriert statt Wurzel gezogen"), say: tx("To undo a square you take the **square root**, not another square.", "Ein Quadrat machst du mit der **Wurzel** rückgängig, nicht mit noch einem Quadrat.") },
      ],
      hint: tx("Get $r^2$ out of the denominator, isolate it, then take the square root.", "Hol $r^2$ aus dem Nenner, bring es allein auf eine Seite und zieh dann die Wurzel."),
    };
  return {
    formula: "F = \\frac{G m M}{r^2}",
    target,
    answer: "F*r^2/(G*m)",
    result: "\\frac{F r^2}{G m}",
    legend,
    frames: [start, cross, { math: "\\frac{F#F r#r^{2#e}}{G#G m#m}#fr2 =#eq M#M", note: tx("Divide by $Gm$. Done: $M = \\frac{F r^2}{G m}$.", "Teile durch $Gm$. Fertig: $M = \\frac{F r^2}{G m}$.") }],
    slips: [
      { plain: "F*r/(G*m)", title: tx("The square got lost", "Das Quadrat ging verloren"), say: tx("Hmm, where did the square go? You multiply by $r^2$, not by $r$.", "Hmm, wo ist das Quadrat geblieben? Du multiplizierst mit $r^2$, nicht mit $r$.") },
      { plain: "G*m/(F*r^2)", title: UPSIDE, say: tx("Upside down! $M$ is multiplied by $Gm$ and divided by $r^2$, so $M = \\frac{F r^2}{G m}$.", "Andersrum! $M$ wird mit $Gm$ multipliziert und durch $r^2$ geteilt, also ist $M = \\frac{F r^2}{G m}$.") },
      { plain: "F/(G*m*r^2)", title: tx("Divided instead of multiplied", "Geteilt statt multipliziert"), say: tx("$r^2$ is in the **denominator**, so you **multiply** by $r^2$ to get it out.", "$r^2$ steht im **Nenner**, also **multiplizierst** du mit $r^2$, um es herauszuholen.") },
    ],
    hint: tx("Multiply by $r^2$, then divide by $Gm$.", "Multipliziere mit $r^2$ und teile dann durch $Gm$."),
  };
}

function sphereSurface(): Derivation {
  return {
    formula: "O = 4 \\pi r^2",
    target: "r",
    answer: "sqrt(O/(4*pi))",
    result: "\\sqrt{\\frac{O}{4 \\pi}}",
    legend: tx("Surface area $O$ of a sphere with the radius $r$.", "Oberfläche $O$ einer Kugel mit dem Radius $r$."),
    frames: [
      { math: "O#O =#eq 4#four \\pi#pi r#r^{2#e}", note: tx("$r$ is squared and multiplied by $4\\pi$. The square comes off last.", "$r$ wird quadriert und mit $4\\pi$ multipliziert. Das Quadrat kommt zuletzt weg.") },
      { math: "\\frac{O#O}{4#four \\pi#pi}#fr =#eq r#r^{2#e}", note: tx("Divide by $4\\pi$.", "Teile durch $4\\pi$.") },
      { math: "r#r =#eq \\sqrt{\\frac{O#O}{4#four \\pi#pi}#fr}#rt", note: tx("Take the square root of the **whole** side. A radius is positive.", "Zieh die Wurzel aus der **ganzen** Seite. Ein Radius ist positiv.") },
    ],
    slips: [
      { plain: "O/(4*pi)", value: (v) => v.O / (4 * Math.PI), title: tx("Square root missing", "Wurzel vergessen"), say: tx("So close! That's $r^2$. You still need the **square root** to get $r$.", "Ganz knapp! Das ist $r^2$. Für $r$ fehlt noch die **Wurzel**."), close: true },
      { plain: "sqrt(O/pi)", value: (v) => Math.sqrt(v.O / Math.PI), title: tx("The 4 got lost", "Die 4 ging verloren"), say: tx("Where did the $4$ go? Divide by $4\\pi$, then take the root.", "Wo ist die $4$ geblieben? Teile durch $4\\pi$ und zieh dann die Wurzel.") },
      { plain: "sqrt(O)/(4*pi)", value: (v) => Math.sqrt(v.O) / (4 * Math.PI), title: tx("Root over only part", "Wurzel nur über einem Teil"), say: tx("The root has to cover the **whole** fraction $\\frac{O}{4\\pi}$, because the whole side equals $r^2$.", "Die Wurzel muss über dem **ganzen** Bruch $\\frac{O}{4\\pi}$ stehen, denn die ganze Seite ist $r^2$.") },
    ],
    hint: tx("Divide by $4\\pi$ first. The square root comes last.", "Teile zuerst durch $4\\pi$. Die Wurzel kommt zuletzt."),
  };
}

function cylinder(): Derivation {
  return {
    formula: "V = \\pi r^2 h",
    target: "r",
    answer: "sqrt(V/(pi*h))",
    result: "\\sqrt{\\frac{V}{\\pi h}}",
    legend: tx("Volume $V$ of a cylinder with the radius $r$ and the height $h$.", "Volumen $V$ eines Zylinders mit dem Radius $r$ und der Höhe $h$."),
    frames: [
      { math: "V#V =#eq \\pi#pi r#r^{2#e} h#h", note: tx("$r$ is squared, then multiplied by $\\pi$ and $h$.", "$r$ wird quadriert und dann mit $\\pi$ und $h$ multipliziert.") },
      { math: "\\frac{V#V}{\\pi#pi h#h}#fr =#eq r#r^{2#e}", note: tx("Divide by $\\pi h$.", "Teile durch $\\pi h$.") },
      { math: "r#r =#eq \\sqrt{\\frac{V#V}{\\pi#pi h#h}#fr}#rt", note: tx("Take the square root. A radius is positive.", "Zieh die Wurzel. Ein Radius ist positiv.") },
    ],
    slips: [
      { plain: "V/(pi*h)", value: (v) => v.V / (Math.PI * v.h), title: tx("Square root missing", "Wurzel vergessen"), say: tx("So close! That's $r^2$. You still need the **square root** to get $r$.", "Ganz knapp! Das ist $r^2$. Für $r$ fehlt noch die **Wurzel**."), close: true },
      { plain: "sqrt(V*h/pi)", value: (v) => Math.sqrt((v.V * v.h) / Math.PI), title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), say: tx("$r^2$ is **multiplied** by $h$, so you **divide** by $h$.", "$r^2$ wird mit $h$ **multipliziert**, also **teilst** du durch $h$.") },
      { plain: "sqrt(V/pi)/h", value: (v) => Math.sqrt(v.V / Math.PI) / v.h, title: tx("Root over only part", "Wurzel nur über einem Teil"), say: tx("The root has to cover the **whole** fraction $\\frac{V}{\\pi h}$.", "Die Wurzel muss über dem **ganzen** Bruch $\\frac{V}{\\pi h}$ stehen.") },
    ],
    hint: tx("Divide by $\\pi h$, then take the square root.", "Teile durch $\\pi h$ und zieh dann die Wurzel."),
  };
}

function cylinderSurface(): Derivation {
  return {
    formula: "A = 2 \\pi r^2 + 2 \\pi r h",
    target: "h",
    answer: "(A-2*pi*r^2)/(2*pi*r)",
    result: "\\frac{A - 2 \\pi r^2}{2 \\pi r}",
    legend: tx("Surface area $A$ of a cylinder with the radius $r$ and the height $h$.", "Oberfläche $A$ eines Zylinders mit dem Radius $r$ und der Höhe $h$."),
    frames: [
      { math: "A#A =#eq 2#t1 \\pi#p1 r#r1^{2#e} +#p 2#t2 \\pi#p2 r#r2 h#h", note: tx("$r$ appears twice, but we want $h$, and $h$ appears only **once**. So no factoring out: just undo.", "$r$ kommt zweimal vor, aber wir suchen $h$, und $h$ kommt nur **einmal** vor. Also kein Ausklammern: einfach rückgängig machen.") },
      { math: "A#A -#p 2#t1 \\pi#p1 r#r1^{2#e} =#eq 2#t2 \\pi#p2 r#r2 h#h", note: tx("Subtract $2\\pi r^2$.", "Subtrahiere $2\\pi r^2$.") },
      { math: "\\frac{A#A -#p 2#t1 \\pi#p1 r#r1^{2#e}}{2#t2 \\pi#p2 r#r2}#fr =#eq h#h", note: tx("Divide by $2\\pi r$, the **whole** left side.", "Teile die **ganze** linke Seite durch $2\\pi r$.") },
      { math: "h#h =#eq \\frac{A#A -#p 2#t1 \\pi#p1 r#r1^{2#e}}{2#t2 \\pi#p2 r#r2}#fr", note: tx("Swap. Split up, it reads $h = \\frac{A}{2\\pi r} - r$.", "Tauschen. Aufgeteilt heißt das $h = \\frac{A}{2\\pi r} - r$.") },
    ],
    slips: [
      { plain: "A/(2*pi*r)-2*pi*r^2", title: tx("Not every term divided", "Nicht jeden Summanden geteilt"), say: tx("Ah, I see what happened! Only $A$ got divided by $2\\pi r$, but $2\\pi r^2$ has to be divided too.", "Ah, ich seh, was passiert ist! Nur $A$ wurde durch $2\\pi r$ geteilt, aber $2\\pi r^2$ muss auch geteilt werden.") },
      { plain: "(A+2*pi*r^2)/(2*pi*r)", title: SIGN, say: tx("Ah, I see what happened! $2\\pi r^2$ went over but kept its plus. **Subtract** it: $A - 2\\pi r^2$.", "Ah, ich seh, was passiert ist! $2\\pi r^2$ ist rübergewandert, hat aber sein Plus behalten. **Subtrahiere** es: $A - 2\\pi r^2$.") },
      { plain: "A-2*pi*r^2-2*pi*r", title: tx("Subtracted instead of divided", "Subtrahiert statt geteilt"), say: tx("$h$ is **multiplied** by $2\\pi r$, so you **divide** by $2\\pi r$.", "$h$ wird mit $2\\pi r$ **multipliziert**, also **teilst** du durch $2\\pi r$.") },
    ],
    hint: tx("$h$ appears only once. Subtract $2\\pi r^2$, then divide by $2\\pi r$.", "$h$ kommt nur einmal vor. Subtrahiere $2\\pi r^2$ und teile dann durch $2\\pi r$."),
  };
}

// ---------------------------------------------------------------------------
// Task shapes

function exprMistakes(d: Derivation): Mistake[] {
  return d.slips.filter((s) => s.plain).map((s) => ({ when: { kind: "expr", value: s.plain!, positive: true }, title: s.title, say: s.say, ...(s.close ? { close: true } : {}) }));
}

const markTarget = (formula: string, target: string) => formula.replace(new RegExp(`(^|[^A-Za-z\\\\])${target}(?![A-Za-z_])`, "g"), `$1\\blob{${target}}`);

/** Solve for the letter (expression answer). */
function solveTask(d: Derivation, instruction: Text): Exercise {
  return {
    instruction,
    text: txMap((t, l) => {
      const ask = t(`Solve $${d.formula}$ for $${d.target}$.`, `Stelle $${d.formula}$ nach $${d.target}$ um.`);
      return d.legend ? `${resolveText(d.legend, l)} ${ask}` : ask;
    }),
    answer: { kind: "expr", value: d.answer, prefix: `${d.target} =`, positive: true },
    hint: d.hint,
    solution: smoothFracExits(d.frames),
    visual: { component: FormulaBoard, props: { src: markTarget(d.formula, d.target) } },
    mistakes: exprMistakes(d),
  };
}

const TWICE = tx("Factor out and solve", "Ausklammern und auflösen");
const REARRANGE = tx("Rearrange the formula", "Stelle die Formel um");

function twiceTask(rng: Rng): Exercise {
  const k1 = rng.int(2, 9);
  let k2 = rng.int(2, 9);
  if (k2 === k1) k2 = k1 === 9 ? 2 : k1 + 1;
  const k = rng.int(2, 9);
  const d = rng.pick([() => twiceA1(k1, k2), () => twiceA2(k), () => twiceA3(k1, k2), () => twiceA4(k), () => twiceA5(k), () => twiceA6(k), () => twiceA7(k), twiceEnergy, twiceHarmonic])();
  return solveTask(d, TWICE);
}

function formulaTask(rng: Rng): Exercise {
  const d = rng.pick([
    () => recip(LENS, "b", LENS_LEGEND),
    () => recip(LENS, "g", LENS_LEGEND),
    () => recip(LENS, "f", LENS_LEGEND),
    () => recip(PUMPS, "t", PUMP_LEGEND),
    () => recip(PUMPS, "a", PUMP_LEGEND),
    () => pendulum("l"),
    () => pendulum("g"),
    () => gravity("r"),
    () => gravity("M"),
    sphereSurface,
    cylinder,
    cylinderSurface,
  ])();
  return solveTask(d, REARRANGE);
}

// ---------------------------------------------------------------------------
// Rearrange and calculate

/** Friendly lens/resistor triples: 1/s = 1/p + 1/q with whole numbers. */
const TRIPLES: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let p = 3; p <= 60; p++)
    for (let q = 3; q <= 60; q++) {
      const s = (p * q) / (p + q);
      if (Number.isInteger(s) && s >= 2) out.push([p, q, s]);
    }
  return out;
})();

type Unit = string | Text;
const unitText = (u: Unit, l: Locale) => resolveText(u, l);

/** "$g = 15 "cm"$" */
const qty = (x: string, v: number, u: Unit, l: Locale, digits = 3) => `$${x} = ${dec(v, l, digits)}${unitText(u, l) ? ` "${unitText(u, l)}"` : ""}$`;

type NumberCase = {
  d: Derivation;
  vals: Values;
  units: Record<string, Unit>;
  /** Display source of the calculation with numbers, per language: "\frac{10 \cdot 15}{15 - 10} = \frac{150}{5}". */
  calc: (l: Locale) => string;
  intro?: Text;
  /** The given values as text, when the default list won't do (values with π: "$V = 288\\pi$ cm³"). */
  given?: (l: Locale) => string;
  tolerance?: number;
  round?: boolean;
};

function numberTask(c: NumberCase): Exercise {
  const { d, vals, units } = c;
  const T = d.target;
  const value = vals[T];
  const given = Object.keys(units).filter((x) => x !== T);
  const right: Extract<AnswerSpec, { kind: "number" }> = {
    kind: "number",
    value: c.round ? Math.round(value * 100) / 100 : value,
    label: `${T} =`,
    ...(resolveText(units[T], "en") ? { unit: units[T] } : {}),
    ...(c.tolerance ? { tolerance: c.tolerance } : {}),
  };
  const res = (l: Locale) => `${dec(right.value, l, 2)}${unitText(units[T], l) ? ` "${unitText(units[T], l)}"` : ""}`;
  const frames: Frame[] = [
    ...d.frames,
    { math: txMap((_, l) => `${T} = ${c.calc(l)}`), note: tx("Now put in the values.", "Jetzt setzt du die Werte ein.") },
    {
      math: txMap((_, l) => `${T} = ${c.calc(l)} ${c.round ? "\\approx" : "="} ${res(l)}`),
      note: txMap((t, l) => (c.round ? t(`Rounded to two decimal places: $${T} \\approx ${res(l)}$.`, `Auf zwei Nachkommastellen gerundet: $${T} \\approx ${res(l)}$.`) : t(`So $${T} = ${res(l)}$.`, `Also ist $${T} = ${res(l)}$.`))),
    },
  ];
  const mistakes = numberMistakes(
    right,
    d.slips
      .filter((s) => s.value)
      .map((s) => {
        const v = clean(s.value!(vals));
        const whole = Math.abs(v - Math.round(v)) < 1e-9;
        return { value: v, title: s.title, say: s.say, close: s.close, tolerance: whole ? undefined : Math.max(0.006, 0.005 / Math.max(1, Math.abs(v))) };
      }),
  );
  return {
    instruction: tx("Rearrange and calculate", "Stelle um und berechne"),
    text: txMap((t, l) => {
      const intro = resolveText(c.intro ?? d.legend, l);
      const list = c.given ? c.given(l) : given.map((x) => qty(x, vals[x], units[x], l)).join(", ");
      const round = c.round ? t(" Round to two decimal places.", " Runde auf zwei Nachkommastellen.") : "";
      return `${intro} $${d.formula}$. ${t("Given:", "Gegeben:")} ${list}. ${t(`Calculate $${T}$.`, `Berechne $${T}$.`)}${round}`;
    }),
    answer: right,
    hint: txMap((t, l) => t(`Solve for $${T}$ first, then put in the numbers. ${resolveText(d.hint, l)}`, `Stell zuerst nach $${T}$ um, dann setzt du die Zahlen ein. ${resolveText(d.hint, l)}`)),
    solution: smoothFracExits(frames),
    mistakes,
  };
}

/** The lens equation or parallel resistors with whole numbers. */
function reciprocalNumbers(rng: Rng): Exercise {
  const [p, q, s] = rng.pick(TRIPLES.filter(([a, b, c]) => a <= 40 && b <= 40 && c <= 24));
  const lens = rng.chance(0.55);
  const n = lens ? LENS : RESISTORS;
  const unit = lens ? "cm" : "Ω";
  const vals: Values = { [n.S]: s, [n.P]: p, [n.Q]: q };
  const target = lens ? rng.pick([n.Q, n.Q, n.P, n.S]) : rng.pick([n.S, n.Q]);
  const d = recip(n, target, lens ? LENS_LEGEND : RES_LEGEND);
  const N = (x: string, l: Locale) => dec(vals[x], l);
  const calc = (l: Locale) => {
    if (target === n.S) return `\\frac{${N(n.P, l)} \\cdot ${N(n.Q, l)}}{${N(n.P, l)} + ${N(n.Q, l)}} = \\frac{${dec(p * q, l)}}{${dec(p + q, l)}}`;
    const O = target === n.P ? n.Q : n.P;
    return `\\frac{${N(n.S, l)} \\cdot ${N(O, l)}}{${N(O, l)} - ${N(n.S, l)}} = \\frac{${dec(vals[n.S] * vals[O], l)}}{${dec(vals[O] - vals[n.S], l)}}`;
  };
  return numberTask({ d, vals, units: { [n.S]: unit, [n.P]: unit, [n.Q]: unit }, calc });
}

/** Sphere and cylinder with π in the given value: V = 288π cm³ → r = 6 cm. */
function roundBodyNumbers(rng: Rng): Exercise {
  const kind = rng.pick(["ball", "surface", "cylinder"] as const);
  if (kind === "ball") {
    const r = rng.pick([3, 6, 9, 12]);
    return numberTask(sphereVolumeCase(r));
  }
  if (kind === "surface") {
    const r = rng.int(2, 12);
    const k = 4 * r * r;
    const d = sphereSurface();
    return numberTask({
      d,
      vals: { O: k * Math.PI, r },
      units: { O: "cm²", r: "cm" },
      calc: (l) => `\\sqrt{\\frac{${dec(k, l)} \\pi}{4 \\pi}} = \\sqrt{${dec(r * r, l)}}`,
      given: () => `$O = ${k}\\pi "cm²"$`,
    });
  }
  const r = rng.int(2, 6);
  const h = rng.int(2, 10);
  const k = r * r * h;
  return numberTask({
    d: cylinder(),
    vals: { V: k * Math.PI, h, r },
    units: { V: "cm³", h: "cm", r: "cm" },
    calc: (l) => `\\sqrt{\\frac{${dec(k, l)} \\pi}{\\pi \\cdot ${dec(h, l)}}} = \\sqrt{${dec(r * r, l)}}`,
    given: (l) => `$V = ${k}\\pi "cm³"$, $h = ${dec(h, l)} "cm"$`,
  });
}

/** Given values with π show as "288π", not as a decimal. */
function sphereVolumeCase(r: number): NumberCase {
  const k = (4 * r ** 3) / 3;
  return {
    d: sphereVolume(),
    vals: { V: k * Math.PI, r },
    units: { V: "cm³", r: "cm" },
    calc: (l) => `\\sqrt[3]{\\frac{3 \\cdot ${dec(k, l)} \\pi}{4 \\pi}} = \\sqrt[3]{${dec(r ** 3, l)}}`,
    given: () => `$V = ${k}\\pi "cm³"$`,
  };
}

function sphereVolume(): Derivation {
  return {
    formula: "V = \\frac{4}{3} \\pi r^3",
    target: "r",
    answer: "",
    result: "\\sqrt[3]{\\frac{3 V}{4 \\pi}}",
    legend: tx("Volume $V$ of a sphere with the radius $r$.", "Volumen $V$ einer Kugel mit dem Radius $r$."),
    frames: [
      { math: "V#V =#eq \\frac{4#n4}{3#n3}#fr \\pi#pi r#r^{3#e}", note: tx("Volume of a sphere: $r$ is **cubed**.", "Volumen einer Kugel: $r$ steht **hoch 3**.") },
      { math: "3#n3 V#V =#eq 4#n4 \\pi#pi r#r^{3#e}", note: tx("Multiply both sides by $3$.", "Multipliziere beide Seiten mit $3$.") },
      { math: "\\frac{3#n3 V#V}{4#n4 \\pi#pi}#fr2 =#eq r#r^{3#e}", note: tx("Divide by $4\\pi$.", "Teile durch $4\\pi$.") },
      { math: "r#r =#eq \\sqrt[3]{\\frac{3#n3 V#V}{4#n4 \\pi#pi}#fr2}#rt", note: tx("A cube is undone by the **cube root** (dritte Wurzel). Swap the sides.", "Hoch 3 machst du mit der **dritten Wurzel** rückgängig. Seiten tauschen.") },
    ],
    slips: [
      { value: (v) => (3 * v.V) / (4 * Math.PI), title: tx("Cube root missing", "Dritte Wurzel vergessen"), say: tx("So close! That's $r^3$. You still need the **cube root** to get $r$.", "Ganz knapp! Das ist $r^3$. Für $r$ fehlt noch die **dritte Wurzel**."), close: true },
      { value: (v) => Math.sqrt((3 * v.V) / (4 * Math.PI)), title: tx("Square root instead of cube root", "Quadratwurzel statt dritter Wurzel"), say: tx("$r$ is **cubed**, so you need the **cube root** $\\sqrt[3]{\\;}$, not the square root.", "$r$ steht **hoch 3**, also brauchst du die **dritte Wurzel** $\\sqrt[3]{\\;}$, nicht die Quadratwurzel.") },
      { value: (v) => Math.cbrt((4 * v.V) / (3 * Math.PI)), title: tx("Fraction the wrong way round", "Bruch falsch herum"), say: tx("$V = \\frac{4}{3}\\pi r^3$, so you multiply by $3$ and divide by $4$: $r^3 = \\frac{3V}{4\\pi}$.", "$V = \\frac{4}{3}\\pi r^3$, also multiplizierst du mit $3$ und teilst durch $4$: $r^3 = \\frac{3V}{4\\pi}$.") },
    ],
    hint: tx("Multiply by $3$, divide by $4\\pi$, then take the cube root.", "Multipliziere mit $3$, teile durch $4\\pi$ und zieh dann die dritte Wurzel."),
  };
}

/** R = R₀ (1 + α ΔT): resistance of a wire that warms up. */
const ALPHA = 0.004;

function resistanceDerivation(target: "R_0" | "\\Delta T"): Derivation {
  const legend = tx("A wire has the resistance $R_0$ at the start. Warmed up by $\\Delta T$, it has the resistance $R$ ($\\alpha$: temperature coefficient).", "Ein Draht hat anfangs den Widerstand $R_0$. Um $\\Delta T$ erwärmt, hat er den Widerstand $R$ ($\\alpha$: Temperaturkoeffizient).");
  const start = "R#R =#eq R#z0_{0#z0s} (1#one +#p \\alpha#al \\Delta#dl T#dt)#br";
  if (target === "R_0")
    return {
      formula: "R = R_0 (1 + \\alpha \\Delta T)",
      target,
      answer: "",
      result: "\\frac{R}{1 + \\alpha \\Delta T}",
      legend,
      frames: [
        { math: start, note: tx("$R_0$ is multiplied by the whole bracket.", "$R_0$ wird mit der ganzen Klammer multipliziert.") },
        { math: "R#z0_{0#z0s} =#eq \\frac{R#R}{1#one +#p \\alpha#al \\Delta#dl T#dt}#fr", note: tx("Divide by the bracket and swap the sides.", "Teile durch die Klammer und tausche die Seiten.") },
      ],
      slips: [
        { value: (v) => v.R / (ALPHA * v.dT), title: ONE_MISSING, say: tx("Hmm, the $1$ in the bracket got lost. Divide by the whole bracket $(1 + \\alpha \\Delta T)$.", "Hmm, die $1$ in der Klammer ist verloren gegangen. Teile durch die ganze Klammer $(1 + \\alpha \\Delta T)$.") },
        { value: (v) => v.R * (1 + ALPHA * v.dT), title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), say: tx("$R_0$ is **multiplied** by the bracket, so you **divide** by it.", "$R_0$ wird mit der Klammer **multipliziert**, also **teilst** du durch sie.") },
      ],
      hint: tx("$R_0$ is multiplied by the whole bracket: divide by it.", "$R_0$ wird mit der ganzen Klammer multipliziert: Teile durch sie."),
    };
  return {
    formula: "R = R_0 (1 + \\alpha \\Delta T)",
    target,
    answer: "",
    result: "\\frac{R - R_0}{\\alpha R_0}",
    legend,
    frames: [
      { math: start, note: tx("$\\Delta T$ is deep inside: in the bracket, times $\\alpha$.", "$\\Delta T$ steckt tief drin: in der Klammer, mal $\\alpha$.") },
      { math: "\\frac{R#R}{R#z0_{0#z0s}}#fr =#eq 1#one +#p \\alpha#al \\Delta#dl T#dt", note: tx("Divide by $R_0$: the bracket opens up.", "Teile durch $R_0$: Die Klammer fällt weg.") },
      { math: "\\frac{R#R}{R#z0_{0#z0s}}#fr -#m 1#one =#eq \\alpha#al \\Delta#dl T#dt", note: tx("Subtract $1$.", "Subtrahiere $1$.") },
      { math: "\\Delta#dl T#dt =#eq \\frac{R#R -#m R#z1_{0#z1s}}{\\alpha#al R#z0_{0#z0s}}#fr2", note: tx("Divide by $\\alpha$ and write it as one fraction: $\\frac{R}{R_0} - 1 = \\frac{R - R_0}{R_0}$.", "Teile durch $\\alpha$ und schreib es als einen Bruch: $\\frac{R}{R_0} - 1 = \\frac{R - R_0}{R_0}$.") },
    ],
    slips: [
      { value: (v) => (v.R - v.R0) / ALPHA, title: tx("Not divided by R₀", "Nicht durch R₀ geteilt"), say: tx("Hmm, the $R_0$ under the fraction bar got lost: $\\Delta T = \\frac{R - R_0}{\\alpha R_0}$.", "Hmm, das $R_0$ unter dem Bruchstrich ist verloren gegangen: $\\Delta T = \\frac{R - R_0}{\\alpha R_0}$.") },
      { value: (v) => (v.R - v.R0) / v.R0, title: tx("α forgotten", "α vergessen"), say: tx("Almost! That's $\\alpha \\Delta T$. Divide by $\\alpha$ as well.", "Fast! Das ist $\\alpha \\Delta T$. Teile noch durch $\\alpha$."), close: true },
    ],
    hint: tx("Divide by $R_0$, subtract $1$, then divide by $\\alpha$.", "Teile durch $R_0$, subtrahiere $1$ und teile dann durch $\\alpha$."),
  };
}

function resistanceNumbers(rng: Rng): Exercise {
  const R0 = rng.pick([10, 20, 25, 40, 50, 80, 100, 200]);
  const dT = rng.pick([25, 50, 75, 100, 125, 150, 200, 250]);
  const R = clean(R0 * (1 + ALPHA * dT));
  const forR0 = rng.chance(0.5);
  const d = resistanceDerivation(forR0 ? "R_0" : "\\Delta T");
  const vals: Values = { R, R0, dT, "R_0": R0, "\\Delta T": dT };
  const alpha = (l: Locale) => dec(ALPHA, l, 3);
  const units: Record<string, Unit> = forR0 ? { R: "Ω", "\\Delta T": "K", "R_0": "Ω" } : { R: "Ω", "R_0": "Ω", "\\Delta T": "K" };
  return numberTask({
    d,
    vals,
    units,
    calc: (l) =>
      forR0
        ? `\\frac{${dec(R, l)}}{1 + ${alpha(l)} \\cdot ${dec(dT, l)}} = \\frac{${dec(R, l)}}{${dec(1 + ALPHA * dT, l)}}`
        : `\\frac{${dec(R, l)} - ${dec(R0, l)}}{${alpha(l)} \\cdot ${dec(R0, l)}} = \\frac{${dec(clean(R - R0), l)}}{${dec(clean(ALPHA * R0), l, 3)}}`,
    intro: txMap((t, l) => `${resolveText(d.legend, l)} ${t("Copper:", "Kupfer:")} $\\alpha = ${alpha(l)} "1/K"$.`),
  });
}

function pendulumNumbers(rng: Rng): Exercise {
  const T = rng.pick([0.8, 1, 1.2, 1.5, 2, 2.5, 3]);
  const g = 9.81;
  const l = (g * T * T) / (4 * Math.PI * Math.PI);
  return numberTask({
    d: pendulum("l"),
    vals: { T, g, l },
    units: { T: "s", g: "m/s²", l: "m" },
    calc: (loc) => `\\frac{${dec(g, loc)} \\cdot ${dec(T, loc)}^2}{4 \\pi^2}`,
    tolerance: 0.0051 / Math.max(1, l),
    round: true,
    intro: tx("A pendulum clock should tick with the period $T$.", "Eine Pendeluhr soll mit der Periodendauer $T$ ticken."),
  });
}

function calcTask(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.4) return reciprocalNumbers(rng);
  if (r < 0.7) return roundBodyNumbers(rng);
  if (r < 0.88) return resistanceNumbers(rng);
  return pendulumNumbers(rng);
}

// ---------------------------------------------------------------------------
// When does the formula not work?

function condTask(d: Derivation, rng: Rng | null): Exercise {
  const c = d.cond!;
  const say = (o: { text: string; kind: "zero" | "num" | "sign" }): [Text, Text] => {
    if (o.kind === "num")
      return [
        tx("The numerator may be 0", "Der Zähler darf 0 sein"),
        tx(`For $${o.text}$ the numerator is $0$, and that's fine: then $${d.target} = 0$. Only the **denominator** $${c.den}$ must not be $0$.`, `Für $${o.text}$ ist der Zähler $0$, und das ist erlaubt: Dann ist $${d.target} = 0$. Nur der **Nenner** $${c.den}$ darf nicht $0$ sein.`),
      ];
    if (o.kind === "sign")
      return [
        tx("Check the sign", "Prüf das Vorzeichen"),
        tx(`Careful with the sign: $${c.den} = 0$ gives $${c.letter} = ${c.value}$, not $${o.text}$.`, `Vorsicht mit dem Vorzeichen: $${c.den} = 0$ ergibt $${c.letter} = ${c.value}$, nicht $${o.text}$.`),
      ];
    return [
      tx("Only the denominator counts", "Nur der Nenner zählt"),
      tx(`Look at the denominator $${c.den}$: it becomes $0$ exactly when $${c.letter} = ${c.value}$. $${o.text}$ doesn't do that.`, `Schau auf den Nenner $${c.den}$: Er wird genau dann $0$, wenn $${c.letter} = ${c.value}$ ist. $${o.text}$ macht das nicht.`),
    ];
  };
  const opts: Opt[] = [{ text: `$${c.letter} = ${c.value}$` }, ...c.others.map((o) => { const [title, s] = say(o); return { text: `$${o.text}$`, title, say: s }; })];
  const ch = choice(rng, opts);
  return {
    instruction: tx("When doesn't the formula work?", "Wann gilt die Formel nicht?"),
    text: tx(
      `You solved $${d.formula}$ for $${d.target}$ and got $${d.target} = ${d.result}$. For which value can you **not** use this formula?`,
      `Du hast $${d.formula}$ nach $${d.target}$ umgestellt und $${d.target} = ${d.result}$ erhalten. Für welchen Wert darfst du diese Formel **nicht** benutzen?`,
    ),
    answer: ch.answer,
    hint: tx("You can't divide by $0$. When is the denominator $0$?", "Durch $0$ darfst du nicht teilen. Wann ist der Nenner $0$?"),
    solution: [
      { math: `${d.target} = ${d.result}`, note: tx(`The denominator is $${c.den}$.`, `Der Nenner ist $${c.den}$.`) },
      { math: `${c.den} = 0 \\Leftrightarrow ${c.letter} = ${c.value}`, note: tx(`It is $0$ exactly for $${c.letter} = ${c.value}$.`, `Er ist genau für $${c.letter} = ${c.value}$ gleich $0$.`) },
      { math: `${c.letter} \\ne ${c.value}`, note: tx(`So the formula needs the condition $${c.letter} \\ne ${c.value}$. Everything else is allowed, even a numerator of $0$.`, `Die Formel braucht also die Bedingung $${c.letter} \\ne ${c.value}$. Alles andere ist erlaubt, sogar ein Zähler von $0$.`) },
    ],
    mistakes: ch.mistakes,
  };
}

function conditionTask(rng: Rng): Exercise {
  const k1 = rng.int(2, 9);
  let k2 = rng.int(2, 9);
  if (k2 === k1) k2 = k1 === 9 ? 2 : k1 + 1;
  const k = rng.int(2, 9);
  const d = rng.pick([() => twiceA1(k1, k2), () => twiceA2(k), () => twiceA3(k1, k2), () => twiceA4(k), () => twiceA5(k), () => twiceA6(k), () => twiceA7(k), twiceHarmonic])();
  return condTask(d, rng);
}

// ---------------------------------------------------------------------------
// Find the mistake: a worked rearrangement with one wrong line.

type Line = { src: string; why: Text };
type Spot = { start: string; target: string; lines: Line[]; wrongAt: number; wrongTitle: Text; wrongSay: Text; fix: Derivation };

const OK_LINE = tx("That line is right", "Diese Zeile stimmt");
const LATER = tx("Look further up", "Schau weiter oben");
const FOLLOWS = tx("This line follows correctly from the line before it. The mistake happens **earlier**.", "Diese Zeile folgt richtig aus der Zeile davor. Der Fehler passiert **früher**.");

function spots(k: number, k1: number, k2: number): Spot[] {
  const lens = recip(LENS, "b", LENS_LEGEND);
  const L = {
    sub: { src: "\\frac{1}{f} - \\frac{1}{g} = \\frac{1}{b}", why: tx("This line is right: $\\frac{1}{g}$ was subtracted on both sides.", "Diese Zeile stimmt: $\\frac{1}{g}$ wurde auf beiden Seiten subtrahiert.") },
    common: { src: "\\frac{g - f}{f g} = \\frac{1}{b}", why: tx("This line is right: common denominator $fg$, numerators subtracted.", "Diese Zeile stimmt: Hauptnenner $fg$, Zähler subtrahiert.") },
  };
  const a5 = twiceA5(k);
  const Y = {
    mul: { src: `y x = x + ${k}`, why: tx("This line is right: both sides were multiplied by $x$.", "Diese Zeile stimmt: Beide Seiten wurden mit $x$ multipliziert.") },
    collect: { src: `y x - x = ${k}`, why: tx("This line is right: $x$ was subtracted on both sides.", "Diese Zeile stimmt: $x$ wurde auf beiden Seiten subtrahiert.") },
    factor: { src: `x (y - 1) = ${k}`, why: tx("This line is right: $x$ factored out, the $1$ stays.", "Diese Zeile stimmt: $x$ ausgeklammert, die $1$ bleibt.") },
  };
  const P = {
    div: { src: "\\frac{T}{2 \\pi} = \\sqrt{\\frac{l}{g}}", why: tx("This line is right: divided by $2\\pi$.", "Diese Zeile stimmt: durch $2\\pi$ geteilt.") },
    sq: { src: "\\frac{T^2}{4 \\pi^2} = \\frac{l}{g}", why: tx("This line is right: the whole fraction squared.", "Diese Zeile stimmt: der ganze Bruch quadriert.") },
  };
  const V = {
    mul: { src: "3 V = 4 \\pi r^3", why: tx("This line is right: multiplied by $3$.", "Diese Zeile stimmt: mit $3$ multipliziert.") },
    div: { src: "\\frac{3 V}{4 \\pi} = r^3", why: tx("This line is right: divided by $4\\pi$.", "Diese Zeile stimmt: durch $4\\pi$ geteilt.") },
  };
  const a1 = twiceA1(k1, k2);
  const A = {
    collect: { src: `a x - ${k2} x = b - ${k1}`, why: tx(`This line is right: $${k2}x$ and $${k1}$ were subtracted on both sides.`, `Diese Zeile stimmt: $${k2}x$ und $${k1}$ wurden auf beiden Seiten subtrahiert.`) },
    factor: { src: `x (a - ${k2}) = b - ${k1}`, why: tx("This line is right: $x$ factored out.", "Diese Zeile stimmt: $x$ ausgeklammert.") },
  };
  const bad = (src: string): Line => ({ src, why: FOLLOWS });
  const lensStart = "\\frac{1}{f} = \\frac{1}{g} + \\frac{1}{b}";
  const yStart = `y = \\frac{x + ${k}}{x}`;
  const pStart = "T = 2 \\pi \\sqrt{\\frac{l}{g}}";
  const vStart = "V = \\frac{4}{3} \\pi r^3";
  const aStart = `a x + ${k1} = ${k2} x + b`;
  const KEPT = tx("Sign didn't change", "Vorzeichen nicht gewechselt");
  return [
    { start: lensStart, target: "b", lines: [bad("\\frac{1}{f} + \\frac{1}{g} = \\frac{1}{b}"), bad("\\frac{g + f}{f g} = \\frac{1}{b}"), bad("b = \\frac{f g}{g + f}")], wrongAt: 0, wrongTitle: KEPT, wrongSay: tx("In the first step $\\frac{1}{g}$ changed sides but kept its plus. It must be **subtracted**.", "Im ersten Schritt hat $\\frac{1}{g}$ die Seite gewechselt, aber sein Plus behalten. Es muss **subtrahiert** werden."), fix: lens },
    { start: lensStart, target: "b", lines: [L.sub, bad("\\frac{g - f}{f + g} = \\frac{1}{b}"), bad("b = \\frac{f + g}{g - f}")], wrongAt: 1, wrongTitle: tx("Wrong common denominator", "Falscher Hauptnenner"), wrongSay: tx("The common denominator of $\\frac{1}{f}$ and $\\frac{1}{g}$ is $f \\cdot g$, not $f + g$.", "Der Hauptnenner von $\\frac{1}{f}$ und $\\frac{1}{g}$ ist $f \\cdot g$, nicht $f + g$."), fix: lens },
    { start: lensStart, target: "b", lines: [L.sub, L.common, bad("b = \\frac{g - f}{f g}")], wrongAt: 2, wrongTitle: tx("Reciprocal missing", "Kehrwert fehlt"), wrongSay: tx("$\\frac{1}{b} = \\frac{g - f}{fg}$, so $b$ is the **reciprocal**: flip the fraction.", "$\\frac{1}{b} = \\frac{g - f}{fg}$, also ist $b$ der **Kehrwert**: Dreh den Bruch um."), fix: lens },
    { start: lensStart, target: "b", lines: [L.sub, bad("b = f - g"), bad("b = -(g - f)")], wrongAt: 1, wrongTitle: tx("Flipped each fraction", "Jeden Bruch einzeln umgedreht"), wrongSay: tx("Fractions can't be flipped one by one: $\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6}$, but $2 \\ne 3 + 6$. Make one fraction first.", "Brüche darf man nicht einzeln umdrehen: $\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6}$, aber $2 \\ne 3 + 6$. Mach erst einen Bruch."), fix: lens },
    { start: yStart, target: "x", lines: [Y.mul, bad(`y x + x = ${k}`), bad(`x (y + 1) = ${k}`), bad(`x = \\frac{${k}}{y + 1}`)], wrongAt: 1, wrongTitle: KEPT, wrongSay: tx("Moving $x$ to the left means **subtracting** it: $yx - x$.", "$x$ nach links bringen heißt **subtrahieren**: $yx - x$."), fix: a5 },
    { start: yStart, target: "x", lines: [Y.mul, Y.collect, bad(`x \\cdot y = ${k}`), bad(`x = \\frac{${k}}{y}`)], wrongAt: 2, wrongTitle: ONE_MISSING, wrongSay: tx("Factoring $x$ out of $yx - x$ leaves $y - 1$: the $1$ must not vanish.", "Klammerst du $x$ aus $yx - x$ aus, bleibt $y - 1$: Die $1$ darf nicht verschwinden."), fix: a5 },
    { start: yStart, target: "x", lines: [Y.mul, Y.collect, Y.factor, bad(`x = ${k} (y - 1)`)], wrongAt: 3, wrongTitle: tx("Multiplied instead of divided", "Multipliziert statt geteilt"), wrongSay: tx("$x$ is **multiplied** by $(y - 1)$, so you **divide** by the bracket.", "$x$ wird mit $(y - 1)$ **multipliziert**, also **teilst** du durch die Klammer."), fix: a5 },
    { start: pStart, target: "l", lines: [bad("T - 2 \\pi = \\sqrt{\\frac{l}{g}}"), bad("(T - 2 \\pi)^2 = \\frac{l}{g}"), bad("l = g (T - 2 \\pi)^2")], wrongAt: 0, wrongTitle: tx("Subtracted instead of divided", "Subtrahiert statt geteilt"), wrongSay: tx("$2\\pi$ is a **factor**, so you divide by it. Subtracting undoes a plus, not a times.", "$2\\pi$ ist ein **Faktor**, also teilst du durch ihn. Subtrahieren macht ein Plus rückgängig, kein Mal."), fix: pendulum("l") },
    { start: pStart, target: "l", lines: [P.div, bad("\\frac{T^2}{2 \\pi} = \\frac{l}{g}"), bad("l = \\frac{g T^2}{2 \\pi}")], wrongAt: 1, wrongTitle: tx("Only the numerator squared", "Nur den Zähler quadriert"), wrongSay: tx("When you square a fraction, square the numerator **and** the denominator: $(2\\pi)^2 = 4\\pi^2$.", "Wenn du einen Bruch quadrierst, quadrierst du Zähler **und** Nenner: $(2\\pi)^2 = 4\\pi^2$."), fix: pendulum("l") },
    { start: pStart, target: "l", lines: [P.div, P.sq, bad("l = \\frac{T^2}{4 \\pi^2 g}")], wrongAt: 2, wrongTitle: tx("Divided instead of multiplied", "Geteilt statt multipliziert"), wrongSay: tx("$l$ is **divided** by $g$, so you **multiply** by $g$.", "$l$ wird durch $g$ **geteilt**, also **multiplizierst** du mit $g$."), fix: pendulum("l") },
    { start: vStart, target: "r", lines: [bad("\\frac{V}{3} = 4 \\pi r^3"), bad("\\frac{V}{12 \\pi} = r^3"), bad("r = \\sqrt[3]{\\frac{V}{12 \\pi}}")], wrongAt: 0, wrongTitle: tx("Divided instead of multiplied", "Geteilt statt multipliziert"), wrongSay: tx("The $3$ is in the denominator: to undo $: 3$ you **multiply** by $3$.", "Die $3$ steht im Nenner: $: 3$ machst du mit **Multiplizieren** mit $3$ rückgängig."), fix: sphereVolume() },
    { start: vStart, target: "r", lines: [V.mul, bad("3 V - 4 \\pi = r^3"), bad("r = \\sqrt[3]{3 V - 4 \\pi}")], wrongAt: 1, wrongTitle: tx("Subtracted instead of divided", "Subtrahiert statt geteilt"), wrongSay: tx("$4\\pi$ **multiplies** $r^3$: divide by it, don't subtract.", "$4\\pi$ wird mit $r^3$ **multipliziert**: Teile durch $4\\pi$, statt es abzuziehen."), fix: sphereVolume() },
    { start: vStart, target: "r", lines: [V.mul, V.div, bad("r = \\sqrt{\\frac{3 V}{4 \\pi}}")], wrongAt: 2, wrongTitle: tx("Square root instead of cube root", "Quadratwurzel statt dritter Wurzel"), wrongSay: tx("$r$ is **cubed**: you need the **cube root** $\\sqrt[3]{\\;}$, not the square root.", "$r$ steht **hoch 3**: Du brauchst die **dritte Wurzel** $\\sqrt[3]{\\;}$, nicht die Quadratwurzel."), fix: sphereVolume() },
    { start: aStart, target: "x", lines: [bad(`a x + ${k2} x = b - ${k1}`), bad(`x (a + ${k2}) = b - ${k1}`), bad(`x = \\frac{b - ${k1}}{a + ${k2}}`)], wrongAt: 0, wrongTitle: KEPT, wrongSay: tx(`Bringing $${k2}x$ to the left means **subtracting** it: $ax - ${k2}x$.`, `$${k2}x$ nach links bringen heißt **subtrahieren**: $ax - ${k2}x$.`), fix: a1 },
    { start: aStart, target: "x", lines: [A.collect, bad(`x a - ${k2} = b - ${k1}`), bad(`x = \\frac{b - ${k1} + ${k2}}{a}`)], wrongAt: 1, wrongTitle: tx("Bracket forgotten", "Klammer vergessen"), wrongSay: tx(`When you factor out $x$, **both** coefficients go into the bracket: $x(a - ${k2})$.`, `Wenn du $x$ ausklammerst, kommen **beide** Koeffizienten in die Klammer: $x(a - ${k2})$.`), fix: a1 },
    { start: aStart, target: "x", lines: [A.collect, A.factor, bad(`x = \\frac{b - ${k1}}{a} - ${k2}`)], wrongAt: 2, wrongTitle: tx("Not the whole bracket", "Nicht durch die ganze Klammer"), wrongSay: tx(`Divide by the **whole** bracket $(a - ${k2})$: all of it goes under the fraction bar.`, `Teile durch die **ganze** Klammer $(a - ${k2})$: Sie kommt komplett unter den Bruchstrich.`), fix: a1 },
  ];
}

function spotTask(s: Spot): Exercise {
  const opts: Opt[] = s.lines.map((ln, i) => ({
    text: `$${ln.src}$`,
    ...(i === s.wrongAt ? {} : i < s.wrongAt ? { title: OK_LINE, say: ln.why } : { title: LATER, say: FOLLOWS }),
  }));
  // Keep the lines in their order: the right option is the wrong line.
  const options = opts.map((o) => o.text);
  const mistakes: Mistake[] = opts.flatMap((o, i) => (i === s.wrongAt || !o.say ? [] : [{ when: { kind: "choice", options, correct: i }, title: o.title, say: o.say }]));
  return {
    instruction: tx("Find the mistake", "Finde den Fehler"),
    text: tx(`Someone solved $${s.start}$ for $${s.target}$, line by line. Which line is the **first** wrong one?`, `Jemand hat $${s.start}$ Zeile für Zeile nach $${s.target}$ umgestellt. Welche Zeile ist die **erste** falsche?`),
    answer: { kind: "choice", options, correct: s.wrongAt },
    hint: tx("Check each line against the one before it: was the same done on both sides, and was it the right opposite?", "Prüf jede Zeile gegen die Zeile davor: Wurde auf beiden Seiten dasselbe gemacht, und war es die richtige Umkehrung?"),
    solution: [{ math: `\\red{${s.lines[s.wrongAt].src}}`, note: s.wrongSay }, ...smoothFracExits(s.fix.frames)],
    mistakes,
  };
}

function findTask(rng: Rng): Exercise {
  const k1 = rng.int(2, 9);
  let k2 = rng.int(2, 9);
  if (k2 === k1) k2 = k1 === 9 ? 2 : k1 + 1;
  return spotTask(rng.pick(spots(rng.int(2, 9), k1, k2)));
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.25) return twiceTask(rng);
  if (r < 0.48) return formulaTask(rng);
  if (r < 0.7) return calcTask(rng);
  if (r < 0.83) return conditionTask(rng);
  return findTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const generalTwice: Frame[] = [
  { math: "a#a x#x1 +#p b#b =#eq c#c x#x2 +#q d#d", note: tx("We want $x$, but it appears **twice**: in $ax$ and in $cx$. Undoing one operation can't free both.", "Wir suchen $x$, aber es kommt **zweimal** vor: in $ax$ und in $cx$. Eine Umkehroperation allein befreit nicht beide."), highlight: ["x1", "x2"] },
  { math: "a#a x#x1 +#p b#b =#eq c#c x#x2 +#q d#d \\quad |#bar \\, -#m1 c#qc x#qx -#m2 b#qb", note: tx("Step 1, **collect**: all terms with $x$ to one side, everything else to the other. Subtract $cx$ and $b$.", "Schritt 1, **sammeln**: alle Terme mit $x$ auf eine Seite, alles andere auf die andere. Subtrahiere $cx$ und $b$.") },
  { math: "a#a x#x1 -#m1 c#c x#x2 =#eq d#d -#m2 b#b", note: tx("Now both x-terms stand together on the left.", "Jetzt stehen beide x-Terme zusammen links."), highlight: ["x1", "x2"] },
  { math: "x#x1 (a#a -#m1 c#c)#br =#eq d#d -#m2 b#b", note: tx("Step 2, **factor out** (ausklammern): $ax - cx = x(a - c)$. Now $x$ appears only once!", "Schritt 2, **ausklammern**: $ax - cx = x(a - c)$. Jetzt kommt $x$ nur noch einmal vor!"), highlight: ["x1"] },
  { math: "x#x1 =#eq \\frac{d#d -#m2 b#b}{a#a -#m1 c#c}#fr", note: tx("Step 3, **divide** by the bracket. Condition: $a \\ne c$, because you can't divide by $0$.", "Schritt 3, durch die Klammer **teilen**. Bedingung: $a \\ne c$, denn durch $0$ darfst du nicht teilen.") },
];

const resistanceFrames: Frame[] = [
  { math: "R#R =#eq R#z0_{0#z0s} +#p R#z1_{0#z1s} \\alpha#al \\Delta#dl T#dt", note: tx("A wire warms up by $\\Delta T$: its resistance grows from $R_0$ to $R$. We want $R_0$, and it appears twice.", "Ein Draht erwärmt sich um $\\Delta T$: Sein Widerstand wächst von $R_0$ auf $R$. Wir suchen $R_0$, und das kommt zweimal vor."), highlight: ["z0", "z0s", "z1", "z1s"] },
  { math: "R#R =#eq R#z0_{0#z0s} (1#one +#p \\alpha#al \\Delta#dl T#dt)#br", note: tx("Factor out $R_0$. From the first summand a $1$ stays behind: $R_0 = R_0 \\cdot 1$.", "Klammere $R_0$ aus. Vom ersten Summanden bleibt eine $1$ übrig: $R_0 = R_0 \\cdot 1$."), highlight: ["one"] },
  { math: "R#z0_{0#z0s} =#eq \\frac{R#R}{1#one +#p \\alpha#al \\Delta#dl T#dt}#fr", note: tx("Divide by the bracket and swap the sides. That's $R_0$.", "Teile durch die Klammer und tausche die Seiten. Das ist $R_0$.") },
  { math: "\\frac{R#R}{R#z0_{0#z0s}}#fr =#eq 1#one +#p \\alpha#al \\Delta#dl T#dt", note: tx("And $\\Delta T$? Back to $R = R_0(1 + \\alpha \\Delta T)$, but this time divide by $R_0$.", "Und $\\Delta T$? Zurück zu $R = R_0(1 + \\alpha \\Delta T)$, aber diesmal teilst du durch $R_0$.") },
  { math: "\\frac{R#R}{R#z0_{0#z0s}}#fr -#m 1#one =#eq \\alpha#al \\Delta#dl T#dt", note: tx("Subtract $1$.", "Subtrahiere $1$.") },
  { math: "\\Delta#dl T#dt =#eq \\frac{R#R -#m R#z2_{0#z2s}}{\\alpha#al R#z0_{0#z0s}}#fr2", note: tx("Divide by $\\alpha$ and write one fraction ($\\frac{R}{R_0} - 1 = \\frac{R - R_0}{R_0}$). $\\Delta T$ is **one** symbol: the change in temperature.", "Teile durch $\\alpha$ und schreib einen Bruch ($\\frac{R}{R_0} - 1 = \\frac{R - R_0}{R_0}$). $\\Delta T$ ist **ein** Zeichen: die Temperaturänderung.") },
];

const lensFrames: Frame[] = [
  ...recip(LENS, "b").frames.map((f, i) => (i === 0 ? { ...f, note: tx("The lens equation: focal length $f$, object distance $g$, image distance $b$. We want $b$, and it sits in a denominator.", "Die Linsengleichung: Brennweite $f$, Gegenstandsweite $g$, Bildweite $b$. Wir suchen $b$, und das steht im Nenner.") } : f)),
  {
    math: tx('\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6} \\quad "but" \\quad \\red{2 \\ne 3 + 6}', '\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6} \\quad "aber" \\quad \\red{2 \\ne 3 + 6}'),
    note: tx("The big trap: never flip the fractions of a sum **one by one**. Numbers show why. Only flip when each side is **one** fraction.", "Die große Falle: Dreh die Brüche einer Summe nie **einzeln** um. Zahlen zeigen, warum. Umdrehen darfst du erst, wenn jede Seite **ein** Bruch ist."),
  },
];

const rootFrames: Frame[] = [
  ...pendulum("l").frames.map((f, i) => (i === 0 ? { ...f, note: tx("A pendulum: period $T$, length $l$, gravity $g$. We want $l$, under a root, inside a fraction. Undo from the outside in.", "Ein Pendel: Periodendauer $T$, Länge $l$, Fallbeschleunigung $g$. Wir suchen $l$, unter einer Wurzel, in einem Bruch. Von außen nach innen rückgängig machen.") } : f)),
  ...sphereVolume().frames.map((f, i) => (i === 0 ? { ...f, note: tx("Now a sphere: $V = \\frac{4}{3}\\pi r^3$. This time $r$ is **cubed**.", "Jetzt eine Kugel: $V = \\frac{4}{3}\\pi r^3$. Diesmal steht $r$ **hoch 3**.") } : f)),
];

const conditionFrames: Frame[] = [
  { math: "x = \\frac{d - b}{a - c} \\quad a \\ne c", note: tx("Every division is a promise: the divisor is not $0$. Here $a - c \\ne 0$, so $a \\ne c$.", "Jede Division ist ein Versprechen: Der Teiler ist nicht $0$. Hier $a - c \\ne 0$, also $a \\ne c$.") },
  { math: "b = \\frac{f g}{g - f} \\quad g \\ne f", note: tx("The lens: $g \\ne f$. Physically, a candle at the focal point sends out parallel rays: no image.", "Die Linse: $g \\ne f$. Physikalisch: Eine Kerze im Brennpunkt sendet parallele Strahlen aus, es gibt kein Bild.") },
  { math: tx('x^2 = 9 \\Rightarrow x = 3 \\; "or" \\; x = -3', 'x^2 = 9 \\Rightarrow x = 3 \\; "oder" \\; x = -3'), note: tx("In pure maths, a square has **two** roots.", "In der reinen Mathematik hat ein Quadrat **zwei** Wurzeln.") },
  { math: "r^2 = 9 \\Rightarrow r = 3", note: tx("But a radius, a length or a time is **positive**: only $r = 3$ makes sense. That's why formulas keep just the positive root.", "Aber ein Radius, eine Länge oder eine Zeit ist **positiv**: Nur $r = 3$ ergibt Sinn. Deshalb behalten Formeln nur die positive Wurzel.") },
  { math: "v = \\sqrt{2 g h} \\quad h \\ge 0", note: tx("And under a square root nothing negative may stand: here $h \\ge 0$.", "Und unter einer Quadratwurzel darf nichts Negatives stehen: Hier ist $h \\ge 0$.") },
];

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Letter twice: collect, factor out, divide", "Buchstabe doppelt: sammeln, ausklammern, teilen"),
      body: tx("Bring all terms with the letter to one side, factor it out, divide by the bracket.", "Bring alle Terme mit dem Buchstaben auf eine Seite, klammere ihn aus und teile durch die Klammer."),
      examples: ["a x + b = c x + d", "x (a - c) = d - b", "x = \\frac{d - b}{a - c} \\quad (a \\ne c)"],
      tone: "rule",
    },
    {
      title: tx("Reciprocal formulas", "Kehrwertformeln"),
      body: tx("Isolate the fraction with the letter, make one fraction per side (common denominator), then take the reciprocal.", "Bring den Bruch mit dem Buchstaben allein auf eine Seite, mach pro Seite einen Bruch (Hauptnenner) und bilde dann den Kehrwert."),
      examples: ["\\frac{1}{f} = \\frac{1}{g} + \\frac{1}{b}", "\\frac{1}{b} = \\frac{g - f}{f g}", "b = \\frac{f g}{g - f}"],
      tone: "rule",
    },
    {
      title: tx("Never flip one by one", "Nie einzeln umdrehen"),
      body: tx("The reciprocal of a sum is not the sum of the reciprocals.", "Der Kehrwert einer Summe ist nicht die Summe der Kehrwerte."),
      examples: ["\\frac{1}{b} = \\frac{1}{f} - \\frac{1}{g} \\quad b \\ne f - g", "\\frac{1}{2} = \\frac{1}{3} + \\frac{1}{6} \\quad 2 \\ne 3 + 6"],
      tone: "warning",
    },
    {
      title: tx("Roots and powers", "Wurzeln und Potenzen"),
      body: tx("Undo from the outside in. A square needs the square root, a cube the cube root. Square whole sides.", "Von außen nach innen rückgängig machen. Ein Quadrat braucht die Quadratwurzel, hoch 3 die dritte Wurzel. Quadriere immer ganze Seiten."),
      examples: ["T = 2 \\pi \\sqrt{\\frac{l}{g}} \\Rightarrow l = \\frac{g T^2}{4 \\pi^2}", "V = \\frac{4}{3} \\pi r^3 \\Rightarrow r = \\sqrt[3]{\\frac{3 V}{4 \\pi}}"],
      tone: "rule",
    },
    {
      title: tx("Conditions", "Bedingungen"),
      body: tx("A denominator must not be 0, nothing negative under a square root. Lengths, times and masses are positive.", "Ein Nenner darf nicht 0 sein, unter einer Quadratwurzel steht nichts Negatives. Längen, Zeiten und Massen sind positiv."),
      examples: ["x = \\frac{4}{y - 1} \\quad y \\ne 1", "r^2 = 9 \\Rightarrow r = 3"],
      tone: "tip",
    },
    {
      title: tx("Check with numbers", "Probe mit Zahlen"),
      body: tx("Pick easy numbers, work out the original formula, then see if your rearranged one gives them back.", "Nimm einfache Zahlen, rechne die ursprüngliche Formel aus und schau, ob deine umgestellte Formel sie zurückliefert."),
      examples: ["f = 2, \\; g = 3 \\Rightarrow b = \\frac{2 \\cdot 3}{3 - 2} = 6", "\\frac{1}{3} + \\frac{1}{6} = \\frac{1}{2}"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The letter appears twice", "Der Buchstabe kommt zweimal vor"),
      blob: tx("Two x's? No problem. Herd them together first!", "Zwei x? Kein Problem. Treib sie erst zusammen!"),
      body: tx(
        "When the letter you want appears in two places, undoing operations is not enough. Three steps: **collect** all terms with the letter on one side, **factor it out** (ausklammern), then **divide** by the bracket.",
        "Kommt der gesuchte Buchstabe an zwei Stellen vor, reicht Rückgängigmachen nicht. Drei Schritte: alle Terme mit dem Buchstaben auf einer Seite **sammeln**, ihn **ausklammern** und dann durch die Klammer **teilen**.",
      ),
      frames: smoothFracExits(generalTwice),
    },
    {
      type: "explain",
      title: tx("In physics: resistance and temperature", "In der Physik: Widerstand und Temperatur"),
      blob: tx("Same trick, real formula.", "Gleicher Trick, echte Formel."),
      body: tx(
        "A wire's resistance grows when it warms up: $R = R_0 + R_0 \\alpha \\Delta T$. The start value $R_0$ appears twice, so we factor it out. Then we solve the same formula for $\\Delta T$.",
        "Der Widerstand eines Drahts wächst, wenn er sich erwärmt: $R = R_0 + R_0 \\alpha \\Delta T$. Der Anfangswert $R_0$ kommt zweimal vor, also klammern wir ihn aus. Danach stellen wir dieselbe Formel nach $\\Delta T$ um.",
      ),
      frames: smoothFracExits(resistanceFrames),
    },
    {
      type: "check",
      blob: tx("Collect, factor out, divide. Your turn!", "Sammeln, ausklammern, teilen. Du bist dran!"),
      exercise: solveTask(twiceA1(3, 2), TWICE),
    },
    {
      type: "explain",
      title: tx("Reciprocal formulas", "Kehrwertformeln"),
      blob: tx("Fractions with the letter downstairs: here's the clean way.", "Brüche mit dem Buchstaben unten: So geht es sauber."),
      body: tx(
        "In formulas like $\\frac{1}{f} = \\frac{1}{g} + \\frac{1}{b}$ the letter sits in a denominator. First get its fraction alone, then make **one** fraction on each side, and only then take the reciprocal (Kehrwert) of both sides.",
        "In Formeln wie $\\frac{1}{f} = \\frac{1}{g} + \\frac{1}{b}$ steht der Buchstabe im Nenner. Bring zuerst seinen Bruch allein auf eine Seite, mach dann auf jeder Seite **einen** Bruch und bilde erst dann auf beiden Seiten den Kehrwert.",
      ),
      frames: smoothFracExits(lensFrames),
    },
    {
      type: "widget",
      title: tx("The lens lab", "Das Linsen-Labor"),
      blob: tx("Drag the candle and watch the image jump around!", "Zieh die Kerze und schau, wie das Bild herumspringt!"),
      body: tx(
        "A converging lens makes an image of a candle. Drag the candle along the axis: the rays and the image follow, and $b = \\frac{fg}{g - f}$ is worked out live. Try $g = f$ and $g < f$.",
        "Eine Sammellinse erzeugt ein Bild einer Kerze. Zieh die Kerze entlang der Achse: Strahlen und Bild folgen, und $b = \\frac{fg}{g - f}$ wird live ausgerechnet. Probier $g = f$ und $g < f$.",
      ),
      widget: LensLab,
    },
    {
      type: "check",
      blob: tx("Same equation, different letter.", "Gleiche Gleichung, anderer Buchstabe."),
      exercise: solveTask(recip(LENS, "g", LENS_LEGEND), REARRANGE),
    },
    {
      type: "explain",
      title: tx("Roots and powers", "Wurzeln und Potenzen"),
      blob: tx("Peel it like an onion: outside first.", "Schäl es wie eine Zwiebel: außen zuerst."),
      body: tx(
        "Undo from the outside in. A square root is undone by squaring (square the **whole** side), a square by the square root, a cube by the cube root (dritte Wurzel).",
        "Mach von außen nach innen rückgängig. Eine Wurzel machst du mit Quadrieren rückgängig (quadriere die **ganze** Seite), ein Quadrat mit der Wurzel, hoch 3 mit der dritten Wurzel.",
      ),
      frames: smoothFracExits(rootFrames),
    },
    {
      type: "widget",
      title: tx("The pendulum lab", "Das Pendel-Labor"),
      blob: tx("Build a pendulum that ticks exactly when you want.", "Bau ein Pendel, das genau so tickt, wie du willst."),
      body: tx(
        "Choose the period $T$. The rearranged formula $l = \\frac{gT^2}{4\\pi^2}$ gives the length, and the pendulum swings in real time. A seconds pendulum ($T = 2$ s) is almost exactly $1$ m long.",
        "Wähle die Periodendauer $T$. Die umgestellte Formel $l = \\frac{gT^2}{4\\pi^2}$ liefert die Länge, und das Pendel schwingt in Echtzeit. Ein Sekundenpendel ($T = 2$ s) ist fast genau $1$ m lang.",
      ),
      widget: PendulumLab,
    },
    {
      type: "check",
      blob: tx("A cube needs the cube root. Rearrange first, then calculate.", "Hoch 3 braucht die dritte Wurzel. Erst umstellen, dann rechnen."),
      exercise: numberTask(sphereVolumeCase(6)),
    },
    {
      type: "explain",
      title: tx("Conditions", "Bedingungen"),
      blob: tx("A good formula also says when it works.", "Eine gute Formel sagt auch, wann sie gilt."),
      body: tx(
        "Rearranging can divide by something that might be $0$, or take a root. Then the formula needs a **condition**: a denominator $\\ne 0$, nothing negative under a square root, and in science only positive lengths, times and masses.",
        "Beim Umstellen teilst du manchmal durch etwas, das $0$ sein könnte, oder ziehst eine Wurzel. Dann braucht die Formel eine **Bedingung**: Nenner $\\ne 0$, nichts Negatives unter einer Quadratwurzel und in den Naturwissenschaften nur positive Längen, Zeiten und Massen.",
      ),
      frames: conditionFrames,
    },
    {
      type: "check",
      blob: tx("Last one: when does this formula break?", "Die letzte: Wann versagt diese Formel?"),
      exercise: condTask(twiceA5(4), createRng(11)),
    },
  ],
};
