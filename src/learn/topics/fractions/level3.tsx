"use client";

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { equivalentText } from "@/learn/engine/expr";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { addP, domainSrc, lin, linP, mulP, numL, par, pExpr, poly, pSrc, scaleP, setSrc, solSrc, subP, type Poly } from "./algebra";
import { decStr } from "./decimals";
import { pickWeighted, type Gen } from "./level1";
import { FractionsCancelWorkshop, FractionsDomainExplorer } from "./widgets3";

// Level 3: algebraic fractions (Bruchterme). The domain, simplifying by factorising (only
// factors cancel), the common denominator, multiplying and dividing, fractional equations.

const OR = (l: "en" | "de") => (l === "de" ? '"oder"' : '"or"');

type SlipObj = { values?: number[]; expr?: string; title: Text; say: Text; close?: boolean };
type Slip = SlipObj | null | false | undefined;

/** Typical mistakes for a solutions or expr answer; slips equal to the answer or to earlier slips are dropped. */
function mistakesFor(answer: AnswerSpec, slips: Slip[]): Mistake[] {
  const out: Mistake[] = [];
  const seen: string[] = [];
  const key = (s: SlipObj) => (s.values ? [...s.values].sort((a, b) => a - b).join(",") : (s.expr ?? ""));
  if (answer.kind === "solutions") seen.push([...answer.values].sort((a, b) => a - b).join(","));
  for (const s of slips) {
    if (!s) continue;
    const k = key(s);
    if (seen.includes(k)) continue;
    let when: AnswerSpec | null = null;
    if (answer.kind === "solutions" && s.values) when = { kind: "solutions", variable: answer.variable, values: s.values, ...(answer.allowNone ? { allowNone: true } : {}) };
    if (answer.kind === "expr" && s.expr !== undefined) {
      if (sameExpr(s.expr, answer.value)) continue;
      when = { kind: "expr", value: s.expr };
    }
    if (!when) continue;
    seen.push(k);
    out.push({ when, title: s.title, say: s.say, ...(s.close ? { close: true } : {}) });
  }
  return out;
}

const sameExpr = (a: string, b: string) => equivalentText(a, b);

const STEPS_D = tx("Find the domain", "Bestimme die Definitionsmenge");

// ---------------------------------------------------------------------------
// The domain

type DomainSpec = {
  term: string;
  /** Denominators set to 0, one line each (several for a sum of fractions). */
  zero: string[];
  factored?: string;
  gaps: number[];
  /** Extra steps for 2x − m = 0. */
  linear?: { a: number; m: number };
  slips: Slip[];
};

function domainExercise(s: DomainSpec): Exercise {
  const frames: Frame[] = [];
  frames.push({
    math: s.term,
    note: tx("A denominator must never be $0$. So: when is it $0$? Set it equal to $0$.", "Ein Nenner darf nie $0$ sein. Also: Wann wird er $0$? Setz ihn gleich $0$."),
  });
  frames.push({
    math: s.zero.map((z) => `${z} = 0`).join(" \\quad "),
    note: s.zero.length > 1 ? tx("Both denominators must not be $0$.", "Beide Nenner dürfen nicht $0$ werden.") : tx("The denominator equal to $0$.", "Den Nenner gleich $0$ setzen."),
  });
  if (s.factored)
    frames.push({
      math: `${s.factored} = 0`,
      note: tx("Factorise. A product is $0$ when one of its factors is $0$.", "Faktorisiere. Ein Produkt ist $0$, wenn einer der Faktoren $0$ ist."),
    });
  if (s.linear) {
    const { a, m } = s.linear;
    frames.push({
      math: `${a}x = ${m}`,
      note: m > 0 ? tx(`Add $${m}$ on both sides. Then divide by $${a}$.`, `Auf beiden Seiten $${m}$ addieren. Dann durch $${a}$ teilen.`) : tx(`Subtract $${-m}$ on both sides. Then divide by $${a}$.`, `Auf beiden Seiten $${-m}$ abziehen. Dann durch $${a}$ teilen.`),
    });
  }
  frames.push({
    math: txMap((_, l) => s.gaps.map((g) => `x = ${numL(g, l)}`).join(` \\quad ${OR(l)} \\quad `)),
    note: s.gaps.length > 1 ? tx("These are the gaps in the domain.", "Das sind die Definitionslücken.") : tx("That's the gap in the domain.", "Das ist die Definitionslücke."),
  });
  frames.push({
    math: domainSrc(s.gaps),
    note: tx(
      `You may put in any number except ${s.gaps.length > 1 ? "these" : "this one"}. The answer: $x = ${s.gaps.map((g) => decStr(g, "en")).join("$ and $x = ")}$.`,
      `Einsetzen darfst du jede Zahl außer ${s.gaps.length > 1 ? "diesen" : "dieser"}. Die Antwort: $x = ${s.gaps.map((g) => decStr(g, "de")).join("$ und $x = ")}$.`,
    ),
  });
  const answer: AnswerSpec = { kind: "solutions", variable: "x", values: [...s.gaps].sort((a, b) => a - b) };
  return {
    instruction: STEPS_D,
    text: tx("For which values of $x$ is the term **not** defined? Give all of them.", "Für welche Zahlen $x$ ist der Term **nicht** definiert? Gib alle an."),
    math: s.term,
    answer,
    hint: tx("Set each denominator equal to $0$ and solve. Factorise first if you can.", "Setz jeden Nenner gleich $0$ und löse. Faktorisiere vorher, wenn es geht."),
    solution: frames,
    mistakes: mistakesFor(answer, s.slips),
  };
}

/** Every gap with the wrong sign. `z = 0` is the factor that has the solution `root`. */
const SIGN_SLIP = (gaps: number[], z: string, root: number): Slip => ({
  values: gaps.map((g) => -g),
  title: tx("Sign flipped", "Vorzeichen vertauscht"),
  say: txMap((_, l) =>
    l === "de"
      ? `Vorsicht beim Vorzeichen: $${z} = 0$ gilt für $x = ${numL(root, l)}$, nicht für $x = ${numL(-root, l)}$. Setz zur Probe ein: Der Nenner muss $0$ werden.`
      : `Careful with the sign: $${z} = 0$ holds for $x = ${numL(root, l)}$, not for $x = ${numL(-root, l)}$. Put the value in to check: the denominator must become $0$.`,
  ),
});
const NUMERATOR_SLIP = (c: number): Slip => ({
  values: [-c],
  title: tx("That's where the numerator is 0", "Da wird der Zähler 0"),
  say: tx(
    `For $x = ${-c}$ the **numerator** is $0$. That's allowed: $\\frac{0}{5} = 0$. Only the denominator must not be $0$.`,
    `Für $x = ${-c}$ wird der **Zähler** $0$. Das ist erlaubt: $\\frac{0}{5} = 0$. Nur der Nenner darf nicht $0$ werden.`,
  ),
});

function domainTask(rng: Rng): Exercise | null {
  const kind = rng.int(1, 7);
  const a = rng.pick([1, 2, 3, 4, 5, 6, 7]) * rng.pick([1, -1]);
  const c = rng.pick([1, 2, 3, 4, 5]) * rng.pick([1, -1]);
  const k = rng.int(2, 9);
  if (kind === 1) {
    const z = lin(-a);
    return domainExercise({ term: `\\frac{${k}}{${z}}`, zero: [z], gaps: [a], slips: [SIGN_SLIP([a], z, a)] });
  }
  if (kind === 2) {
    const m = rng.int(1, 9) * rng.pick([1, -1]);
    const g = m / 2;
    if (-c === g) return null;
    const z = pSrc(poly(-m, 2));
    return domainExercise({
      term: `\\frac{${lin(c)}}{${z}}`,
      zero: [z],
      linear: { a: 2, m },
      gaps: [g],
      slips: [
        SIGN_SLIP([g], z, g),
        {
          values: [m],
          title: tx("Divided too early", "Nicht durch 2 geteilt"),
          say: tx(`Nearly! From $2x = ${m}$ you still have to divide by $2$.`, `Fast! Aus $2x = ${m}$ musst du noch durch $2$ teilen.`),
        },
        NUMERATOR_SLIP(c),
      ],
    });
  }
  if (kind === 3) {
    const z = pSrc(poly(0, -a, 1));
    return domainExercise({
      term: `\\frac{${k}}{${z}}`,
      zero: [z],
      factored: `x${par(-a)}`,
      gaps: [0, a],
      slips: [
        {
          values: [a],
          title: tx("x = 0 forgotten", "x = 0 vergessen"),
          say: tx(
            `Half of it! $${z} = x${par(-a)}$ is also $0$ for $x = 0$. Factor out $x$ instead of dividing by it.`,
            `Die Hälfte! $${z} = x${par(-a)}$ wird auch für $x = 0$ null. Klammere $x$ aus, statt durch $x$ zu teilen.`,
          ),
          close: true,
        },
        SIGN_SLIP([0, a], lin(-a), a),
      ],
    });
  }
  if (kind === 4) {
    const b = Math.abs(a) + (Math.abs(a) === 1 ? 1 : 0);
    const z = pSrc(poly(-b * b, 0, 1));
    if (c === b || c === -b) return null;
    return domainExercise({
      term: `\\frac{${lin(c)}}{${z}}`,
      zero: [z],
      factored: `(x + ${b})(x - ${b})`,
      gaps: [-b, b],
      slips: [
        {
          values: [b],
          title: tx("Only one solution", "Nur eine Lösung"),
          say: tx(`$x^2 = ${b * b}$ has **two** solutions: $${b}$ and $-${b}$. Both make the denominator $0$.`, `$x^2 = ${b * b}$ hat **zwei** Lösungen: $${b}$ und $-${b}$. Beide machen den Nenner $0$.`),
          close: true,
        },
        NUMERATOR_SLIP(c),
      ],
    });
  }
  if (kind === 5) {
    const b = rng.pick([1, 2, 3, 4, 5]) * rng.pick([1, -1]);
    if (a === -b) return null;
    const z = `${par(-a)}${par(b)}`;
    return domainExercise({
      term: `\\frac{${k}}{${z}}`,
      zero: [z],
      gaps: [a, -b],
      slips: [SIGN_SLIP([a, -b], lin(-a), a)],
    });
  }
  if (kind === 6) {
    const b = rng.pick([1, 2, 3, 4, 5, 6]) * rng.pick([1, -1]);
    const k2 = rng.int(1, 9);
    return domainExercise({
      term: `\\frac{${k}}{x} + \\frac{${k2}}{${lin(b)}}`,
      zero: ["x", lin(b)],
      gaps: [0, -b],
      slips: [
        {
          values: [-b],
          title: tx("One denominator forgotten", "Einen Nenner vergessen"),
          say: tx("Each fraction has its own denominator, and **none** of them may be $0$. The first one is just $x$.", "Jeder Bruch hat seinen eigenen Nenner, und **keiner** darf $0$ werden. Der erste ist einfach $x$."),
          close: true,
        },
        { values: [0, b], title: tx("Sign flipped", "Vorzeichen vertauscht"), say: tx(`$${lin(b)} = 0$ gives $x = ${-b}$, the opposite number.`, `$${lin(b)} = 0$ ergibt $x = ${-b}$, die Gegenzahl.`) },
      ],
    });
  }
  const b = Math.abs(a);
  const z = pSrc(poly(b * b, -2 * b, 1));
  return domainExercise({
    term: `\\frac{x}{${z}}`,
    zero: [z],
    factored: `(x - ${b})^2`,
    gaps: [b],
    slips: [SIGN_SLIP([b], `x - ${b}`, b), { values: [0], title: tx("That's where the numerator is 0", "Da wird der Zähler 0"), say: tx("For $x = 0$ only the **numerator** is $0$, and that's allowed. Use the second binomial formula on the denominator.", "Für $x = 0$ wird nur der **Zähler** $0$, und das ist erlaubt. Nimm für den Nenner die 2. binomische Formel.") }],
  });
}

// ---------------------------------------------------------------------------
// Simplifying by factorising (fill the gap)

type Simp = {
  num: string;
  den: string;
  nf: string;
  df: string;
  /** Factored form with the common factors struck out. */
  struck: string;
  res: [string, string];
  ask: "num" | "den";
  ans: string;
  how: Text;
  gaps: number[];
  slips: Slip[];
};

function simplifyExercise(s: Simp): Exercise {
  const box = "\\box{?}";
  const gapForm = s.ask === "num" ? `\\frac{${box}}{${s.res[1]}}` : `\\frac{${s.res[0]}}{${box}}`;
  const filled = s.ask === "num" ? `\\frac{\\hl{${s.res[0]}}}{${s.res[1]}}` : `\\frac{${s.res[0]}}{\\hl{${s.res[1]}}}`;
  const answer: AnswerSpec = { kind: "expr", value: s.ans };
  const frames: Frame[] = [
    { math: `\\frac{${s.num}}{${s.den}}`, note: tx("Only factors may be cancelled. So factorise top and bottom first.", "Kürzen darfst du nur Faktoren. Faktorisiere also zuerst Zähler und Nenner.") },
    { math: `\\frac{${s.nf}}{${s.df}}`, note: s.how },
    { math: s.struck, note: tx("The same factor on top and bottom: cancel it.", "Oben und unten steht derselbe Faktor: kürzen.") },
    {
      math: `\\frac{${s.res[0]}}{${s.res[1]}}`,
      note: tx(
        `Fully simplified. It holds for every $x$ in the domain of the original term ($x \\ne ${s.gaps.join("$, $x \\ne ")}$).`,
        `Vollständig gekürzt. Das gilt für alle $x$ aus der Definitionsmenge des Ausgangsterms ($x \\ne ${s.gaps.join("$, $x \\ne ")}$).`,
      ),
    },
    { math: `\\frac{${s.num}}{${s.den}} = ${filled}`, note: tx("That's what goes into the gap.", "Das gehört in die Lücke.") },
  ];
  return {
    instruction: tx("Simplify the term", "Kürze den Bruchterm"),
    text: tx("Simplify fully and fill the gap.", "Kürze vollständig und ergänze die Lücke."),
    math: `\\frac{${s.num}}{${s.den}} = ${gapForm}`,
    answer,
    hint: tx("Factor out, or use a binomial formula. Then cancel the common factor.", "Klammere aus oder nimm eine binomische Formel. Dann kürzt du den gemeinsamen Faktor."),
    solution: frames,
    mistakes: mistakesFor(answer, s.slips),
  };
}

const NOT_CANCELLED = tx("Not cancelled yet", "Noch nicht gekürzt");
const WRONG_FACTOR = tx("The wrong factor kept", "Den falschen Faktor behalten");

function simpSpec(t: number, a: number, k: number, m: number): Simp | null {
  const A = Math.abs(a);
  if (t === 1) {
    return {
      num: pSrc(scaleP(linP(a), k)),
      den: pSrc(mulP([0, 1], linP(a))),
      nf: `${k}${par(a)}`,
      df: `x${par(a)}`,
      struck: `\\frac{${k}\\strike{${par(a)}}}{x\\strike{${par(a)}}}`,
      res: [String(k), "x"],
      ask: "den",
      ans: "x",
      how: tx(`Factor out: $${k}$ on top, $x$ at the bottom.`, `Ausklammern: oben $${k}$, unten $x$.`),
      gaps: [0, -a],
      slips: [{ expr: lin(a), title: WRONG_FACTOR, say: tx(`$${par(a)}$ is the common factor, so that's the one that goes. What's left at the bottom is $x$.`, `$${par(a)}$ ist der gemeinsame Faktor, der fällt weg. Unten bleibt das $x$ übrig.`) }],
    };
  }
  if (t === 2) {
    return {
      num: pSrc(poly(-A * A, 0, 1)),
      den: pSrc(scaleP(linP(A), k)),
      nf: `(x + ${A})(x - ${A})`,
      df: `${k}(x + ${A})`,
      struck: `\\frac{\\strike{(x + ${A})}(x - ${A})}{${k}\\strike{(x + ${A})}}`,
      res: [`x - ${A}`, String(k)],
      ask: "num",
      ans: `x-${A}`,
      how: tx(`Third binomial formula on top: $x^2 - ${A * A} = (x + ${A})(x - ${A})$. Factor out $${k}$ at the bottom.`, `Oben die 3. binomische Formel: $x^2 - ${A * A} = (x + ${A})(x - ${A})$. Unten $${k}$ ausklammern.`),
      gaps: [-A],
      slips: [
        { expr: `x+${A}`, title: WRONG_FACTOR, say: tx(`$(x + ${A})$ appears top and bottom, so it cancels. What stays on top is $(x - ${A})$.`, `$(x + ${A})$ steht oben und unten, der kürzt sich weg. Oben bleibt $(x - ${A})$.`) },
        { expr: `x^2-${A * A}`, title: NOT_CANCELLED, say: tx(`You haven't cancelled yet: write $x^2 - ${A * A}$ as a product first (third binomial formula).`, `Du hast noch nicht gekürzt: Schreib $x^2 - ${A * A}$ zuerst als Produkt (3. binomische Formel).`) },
      ],
    };
  }
  if (t === 3) {
    return {
      num: pSrc(scaleP(linP(-A), k)),
      den: pSrc(poly(A * A, -2 * A, 1)),
      nf: `${k}(x - ${A})`,
      df: `(x - ${A})(x - ${A})`,
      struck: `\\frac{${k}\\strike{(x - ${A})}}{\\strike{(x - ${A})}(x - ${A})}`,
      res: [String(k), `x - ${A}`],
      ask: "den",
      ans: `x-${A}`,
      how: tx(`Factor out $${k}$ on top. At the bottom, the second binomial formula: $(x - ${A})^2$.`, `Oben $${k}$ ausklammern. Unten die 2. binomische Formel: $(x - ${A})^2$.`),
      gaps: [A],
      slips: [
        { expr: `(x-${A})^2`, title: NOT_CANCELLED, say: tx(`$(x - ${A})^2 = (x - ${A})(x - ${A})$: one of these two factors cancels with the numerator.`, `$(x - ${A})^2 = (x - ${A})(x - ${A})$: Einer der beiden Faktoren kürzt sich mit dem Zähler weg.`) },
        { expr: `x+${A}`, title: tx("Sign flipped", "Vorzeichen vertauscht"), say: tx(`Check the binomial formula: $x^2 - ${2 * A}x + ${A * A} = (x - ${A})^2$, with a minus.`, `Prüf die binomische Formel: $x^2 - ${2 * A}x + ${A * A} = (x - ${A})^2$, mit Minus.`) },
      ],
    };
  }
  if (t === 4) {
    return {
      num: pSrc(poly(0, A, 1)),
      den: pSrc(poly(-A * A, 0, 1)),
      nf: `x(x + ${A})`,
      df: `(x + ${A})(x - ${A})`,
      struck: `\\frac{x\\strike{(x + ${A})}}{\\strike{(x + ${A})}(x - ${A})}`,
      res: ["x", `x - ${A}`],
      ask: "den",
      ans: `x-${A}`,
      how: tx(`Factor out $x$ on top. At the bottom, the third binomial formula.`, `Oben $x$ ausklammern. Unten die 3. binomische Formel.`),
      gaps: [-A, A],
      slips: [
        { expr: `x+${A}`, title: WRONG_FACTOR, say: tx(`$(x + ${A})$ is the common factor, it cancels. At the bottom $(x - ${A})$ stays.`, `$(x + ${A})$ ist der gemeinsame Faktor, er kürzt sich. Unten bleibt $(x - ${A})$.`) },
        { expr: `x^2-${A * A}`, title: NOT_CANCELLED, say: tx(`Not cancelled yet: factorise $x^2 - ${A * A}$ first.`, `Noch nicht gekürzt: Faktorisiere zuerst $x^2 - ${A * A}$.`) },
      ],
    };
  }
  if (t === 5) {
    return {
      num: pSrc(poly(A * A, 2 * A, 1)),
      den: pSrc(poly(-A * A, 0, 1)),
      nf: `(x + ${A})(x + ${A})`,
      df: `(x + ${A})(x - ${A})`,
      struck: `\\frac{\\strike{(x + ${A})}(x + ${A})}{\\strike{(x + ${A})}(x - ${A})}`,
      res: [`x + ${A}`, `x - ${A}`],
      ask: "num",
      ans: `x+${A}`,
      how: tx(`First binomial formula on top, third at the bottom.`, `Oben die 1. binomische Formel, unten die 3.`),
      gaps: [-A, A],
      slips: [{ expr: `(x+${A})^2`, title: NOT_CANCELLED, say: tx(`$(x + ${A})^2$ has the factor $(x + ${A})$ twice. One of them cancels with the bottom.`, `In $(x + ${A})^2$ steckt der Faktor $(x + ${A})$ zweimal. Einer davon kürzt sich mit unten.`) }],
    };
  }
  if (t === 6) {
    const g = gcd(m, k);
    if (k / g < 2 || g < 2) return null;
    const top = scaleP(linP(a), m / g);
    return {
      num: pSrc(mulP([0, m], linP(a))),
      den: `${k}x`,
      nf: `${m}x${par(a)}`,
      df: `${k}x`,
      struck: `\\frac{${m}\\strike{x}${par(a)}}{${k}\\strike{x}}`,
      res: [pSrc(top), String(k / g)],
      ask: "num",
      ans: pExpr(top),
      how: tx(`Factor out $${m}x$ on top.`, `Oben $${m}x$ ausklammern.`),
      gaps: [0],
      slips: [
        { expr: pExpr(scaleP(linP(a), m)), title: tx("Numbers not simplified", "Zahlen nicht gekürzt"), say: tx(`Nearly! Also simplify the numbers: $${m}$ and $${k}$ are both divisible by $${g}$.`, `Fast! Kürze auch die Zahlen: $${m}$ und $${k}$ sind beide durch $${g}$ teilbar.`), close: true },
        { expr: pExpr(mulP([0, m / g], linP(a))), title: tx("x not cancelled", "x nicht gekürzt"), say: tx("There's an $x$ top and bottom: it cancels too.", "Oben und unten steht ein $x$: Das kürzt sich auch weg.") },
      ],
    };
  }
  // t === 7: the −1 trick
  return {
    num: pSrc(poly(k * A, -k)),
    den: pSrc(poly(0, -A, 1)),
    nf: `-${k}(x - ${A})`,
    df: `x(x - ${A})`,
    struck: `\\frac{-${k}\\strike{(x - ${A})}}{x\\strike{(x - ${A})}}`,
    res: [`-${k}`, "x"],
    ask: "num",
    ans: `-${k}`,
    how: tx(`Factor out $-${k}$ on top: $${k * A} - ${k}x = -${k}(x - ${A})$. Now the brackets match.`, `Oben $-${k}$ ausklammern: $${k * A} - ${k}x = -${k}(x - ${A})$. Jetzt passen die Klammern.`),
    gaps: [0, A],
    slips: [
      {
        expr: String(k),
        title: tx("The minus got lost", "Das Minus ist verloren gegangen"),
        say: tx(`$${k * A} - ${k}x$ isn't $${k}(x - ${A})$ but $-${k}(x - ${A})$. Factor out $-${k}$.`, `$${k * A} - ${k}x$ ist nicht $${k}(x - ${A})$, sondern $-${k}(x - ${A})$. Klammere $-${k}$ aus.`),
        close: true,
      },
    ],
  };
}

function simplifyTask(rng: Rng): Exercise | null {
  const t = rng.int(1, 7);
  const a = rng.int(1, 6) * (t === 1 || t === 6 ? rng.pick([1, -1]) : 1);
  const s = simpSpec(t, a, rng.int(2, 9), rng.pick([2, 3, 4, 6, 8, 9, 10]));
  return s ? simplifyExercise(s) : null;
}

// ---------------------------------------------------------------------------
// Which cancellations are right? (select all)

type Claim = { src: string; ok: boolean; why: Text; title?: Text };
const CLAIMS: Claim[] = [
  { src: "\\frac{6x}{9x} = \\frac{2}{3}", ok: true, why: tx("$3x$ is a factor of both: right (for $x \\ne 0$).", "$3x$ ist Faktor von beiden: richtig (für $x \\ne 0$).") },
  { src: "\\frac{2(x + 1)}{4} = \\frac{x + 1}{2}", ok: true, why: tx("The factor $2$ cancels: right.", "Der Faktor $2$ kürzt sich: richtig.") },
  { src: "\\frac{x(x - 2)}{x^2} = \\frac{x - 2}{x}", ok: true, why: tx("$x^2 = x \\cdot x$, one factor $x$ cancels: right.", "$x^2 = x \\cdot x$, ein Faktor $x$ kürzt sich: richtig.") },
  { src: "\\frac{3x + 3}{x + 1} = 3", ok: true, why: tx("$3x + 3 = 3(x + 1)$, then $(x + 1)$ cancels: right.", "$3x + 3 = 3(x + 1)$, dann kürzt sich $(x + 1)$: richtig.") },
  { src: "\\frac{x^2 - 4}{x + 2} = x - 2", ok: true, why: tx("$x^2 - 4 = (x + 2)(x - 2)$: right.", "$x^2 - 4 = (x + 2)(x - 2)$: richtig.") },
  { src: "\\frac{4 - 2x}{x - 2} = -2", ok: true, why: tx("$4 - 2x = -2(x - 2)$: right.", "$4 - 2x = -2(x - 2)$: richtig.") },
  { src: "\\frac{x + 3}{x + 5} = \\frac{3}{5}", ok: false, why: tx("$x$ is a **summand** here, not a factor. Test with $x = 1$: $\\frac{4}{6} \\ne \\frac{3}{5}$.", "$x$ ist hier ein **Summand**, kein Faktor. Probe mit $x = 1$: $\\frac{4}{6} \\ne \\frac{3}{5}$.") },
  { src: "\\frac{x^2 + 1}{x} = x + 1", ok: false, why: tx("Only $x^2$ was divided by $x$, the $1$ wasn't. Test with $x = 2$: $\\frac{5}{2} \\ne 3$.", "Nur $x^2$ wurde durch $x$ geteilt, die $1$ nicht. Probe mit $x = 2$: $\\frac{5}{2} \\ne 3$.") },
  { src: "\\frac{5 + x}{5} = x", ok: false, why: tx("The $5$ on top is a summand. Test with $x = 5$: $\\frac{10}{5} = 2 \\ne 5$.", "Die $5$ oben ist ein Summand. Probe mit $x = 5$: $\\frac{10}{5} = 2 \\ne 5$.") },
  { src: "\\frac{2x + 6}{2} = x + 6", ok: false, why: tx("Divide **every** summand by $2$: $\\frac{2x + 6}{2} = x + 3$.", "Teile **jeden** Summanden durch $2$: $\\frac{2x + 6}{2} = x + 3$.") },
  { src: "\\frac{x - 4}{4 - x} = 1", ok: false, title: tx("The minus overlooked", "Das Minus übersehen"), why: tx("$4 - x = -(x - 4)$, so the result is $-1$.", "$4 - x = -(x - 4)$, das Ergebnis ist also $-1$.") },
  { src: "\\frac{x^2 + 9}{x + 3} = x + 3", ok: false, title: tx("Can't be factorised", "Nicht faktorisierbar"), why: tx("$x^2 + 9$ can't be factorised: $(x + 3)^2 = x^2 + 6x + 9$. Test with $x = 1$: $\\frac{10}{4} \\ne 4$.", "$x^2 + 9$ lässt sich nicht faktorisieren: $(x + 3)^2 = x^2 + 6x + 9$. Probe mit $x = 1$: $\\frac{10}{4} \\ne 4$.") },
];

function cancelTask(rng: Rng): Exercise | null {
  const good = rng.shuffle(CLAIMS.filter((c) => c.ok)).slice(0, rng.int(2, 3));
  const bad = rng.shuffle(CLAIMS.filter((c) => !c.ok)).slice(0, 5 - good.length);
  const list = rng.shuffle([...good, ...bad]);
  const options: Text[] = list.map((c) => `$${c.src}$`);
  const correct = list.flatMap((c, i) => (c.ok ? [i] : []));
  const mistakes: Mistake[] = list.flatMap((c, i) =>
    c.ok
      ? []
      : [
          {
            when: { kind: "multi" as const, options, correct: [...correct, i].sort((x, y) => x - y) },
            title: c.title ?? tx("Summands cancelled", "Summanden gekürzt"),
            say: txMap((_, l) => `${l === "de" ? "Fast! Aber" : "Nearly! But"} $${c.src.replace(" = ", " \\ne ")}$: ${resolveText(c.why, l)}`),
          },
        ],
  );
  return {
    instruction: tx("Select all that are right", "Kreuze alle richtigen an"),
    text: tx("Which of these simplifications are **correct** (for all allowed $x$)?", "Welche dieser Kürzungen sind **richtig** (für alle erlaubten $x$)?"),
    answer: { kind: "multi", options, correct },
    hint: tx("Only factors may be cancelled. Is the thing you cancel multiplied with everything else? Test with a number if unsure.", "Kürzen darfst du nur Faktoren. Ist das Gekürzte mit allem anderen malgenommen? Mach im Zweifel eine Probe mit einer Zahl."),
    solution: list.map((c) => ({ math: c.ok ? c.src : c.src.replace(" = ", " \\ne "), note: c.why })),
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// The lowest common denominator

type HN = { a: string; b: string; fa: string; fb: string; hn: string; hnPoly: Poly; slips: Slip[] };

function hnExercise(s: HN, ka: number, kb: number): Exercise {
  const answer: AnswerSpec = { kind: "expr", value: pExpr(s.hnPoly) };
  return {
    instruction: tx("Find the lowest common denominator", "Bestimme den Hauptnenner"),
    text: tx("What is the lowest common denominator of the two fractions?", "Wie heißt der Hauptnenner der beiden Brüche?"),
    math: `\\frac{${ka}}{${s.a}} + \\frac{${kb}}{${s.b}}`,
    answer,
    hint: tx("Factorise both denominators. The common denominator needs every factor, but each one only as often as needed.", "Faktorisiere beide Nenner. Der Hauptnenner braucht jeden Faktor, aber jeden nur so oft wie nötig."),
    solution: [
      { math: `\\frac{${ka}}{${s.a}} \\quad \\frac{${kb}}{${s.b}}`, note: tx("Factorise both denominators.", "Faktorisiere beide Nenner.") },
      { math: `${s.fa} \\quad ${s.fb}`, note: tx("Collect every factor, but common factors only once.", "Sammle jeden Faktor, gemeinsame aber nur einmal.") },
      { math: tx(`"LCD" = ${s.hn}`, `"HN" = ${s.hn}`), note: tx(`So the lowest common denominator is $${s.hn}$ (or multiplied out: $${pSrc(s.hnPoly)}$).`, `Der Hauptnenner ist also $${s.hn}$ (ausmultipliziert: $${pSrc(s.hnPoly)}$).`) },
    ],
    mistakes: mistakesFor(answer, s.slips),
  };
}

const PRODUCT_SLIP = (prod: Poly): Slip => ({
  expr: pExpr(prod),
  title: tx("A common denominator, but not the lowest", "Gemeinsamer Nenner, aber nicht der kleinste"),
  say: tx(
    "That works as a common denominator, but it's bigger than necessary. A factor that both denominators share only goes in **once**.",
    "Das ist zwar ein gemeinsamer Nenner, aber größer als nötig. Ein Faktor, den beide Nenner haben, kommt nur **einmal** hinein.",
  ),
  close: true,
});
const SUM_SLIP = (sum: Poly): Slip => ({
  expr: pExpr(sum),
  title: tx("Denominators added", "Nenner addiert"),
  say: tx("Denominators are never added. The common denominator is a **multiple** of both.", "Nenner werden nie addiert. Der Hauptnenner ist ein **Vielfaches** von beiden."),
});

function hnTask(rng: Rng): Exercise | null {
  const t = rng.int(1, 5);
  const c = rng.int(1, 6);
  let ka = rng.int(1, 9);
  let kb = rng.int(1, 9);
  // A numerator that shares a factor with its denominator's number could be simplified first,
  // and then the common denominator would be smaller. So: numerators coprime to that number.
  const coprimeTo = (k: number, m: number) => (gcd(k, m) === 1 ? k : rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((j) => gcd(j, m) === 1)));
  let s: HN;
  if (t === 1) {
    const [p, q] = rng.shuffle([2, 3, 4, 6, 8, 9, 10, 12]).slice(0, 2);
    const L = lcm(p, q);
    if (L === p * q && rng.chance(0.5)) return null;
    const sq = rng.chance(0.4);
    ka = coprimeTo(ka, p);
    kb = coprimeTo(kb, q);
    const deg = (n: number, two: boolean) => (two ? poly(0, 0, n) : poly(0, n));
    s = {
      a: pSrc(deg(p, sq)),
      b: pSrc(deg(q, false)),
      fa: sq ? `${p} \\cdot x \\cdot x` : `${p} \\cdot x`,
      fb: `${q} \\cdot x`,
      hn: pSrc(deg(L, sq)),
      hnPoly: deg(L, sq),
      slips: [PRODUCT_SLIP(sq ? poly(0, 0, 0, p * q) : poly(0, 0, p * q)), SUM_SLIP(sq ? poly(0, q, p) : poly(0, p + q))],
    };
  } else if (t === 2) {
    s = { a: "x", b: lin(c), fa: "x", fb: par(c), hn: `x${par(c)}`, hnPoly: mulP([0, 1], linP(c)), slips: [{ expr: lin(c), title: tx("Only one denominator", "Nur ein Nenner"), say: tx(`$${lin(c)}$ is not a multiple of $x$. The common denominator needs both factors: $x$ and $${par(c)}$.`, `$${lin(c)}$ ist kein Vielfaches von $x$. Der Hauptnenner braucht beide Faktoren: $x$ und $${par(c)}$.`) }, SUM_SLIP(poly(c, 2))] };
  } else if (t === 3) {
    const D = poly(-c * c, 0, 1);
    s = { a: pSrc(D), b: lin(c), fa: `(x + ${c})(x - ${c})`, fb: `(x + ${c})`, hn: `(x + ${c})(x - ${c})`, hnPoly: D, slips: [PRODUCT_SLIP(mulP(D, linP(c)))] };
  } else if (t === 4) {
    const A = poly(0, c, 1);
    const B = poly(-c * c, 0, 1);
    s = { a: pSrc(A), b: pSrc(B), fa: `x(x + ${c})`, fb: `(x + ${c})(x - ${c})`, hn: `x(x + ${c})(x - ${c})`, hnPoly: mulP([0, 1], B), slips: [PRODUCT_SLIP(mulP(A, B))] };
  } else {
    const [p, q] = rng.shuffle([2, 3, 4, 5, 6]).slice(0, 2);
    const L = lcm(p, q);
    ka = coprimeTo(ka, p);
    kb = coprimeTo(kb, q);
    s = {
      a: pSrc(scaleP(linP(c), p)),
      b: pSrc(scaleP(linP(c), q)),
      fa: `${p}(x + ${c})`,
      fb: `${q}(x + ${c})`,
      hn: `${L}(x + ${c})`,
      hnPoly: scaleP(linP(c), L),
      slips: [PRODUCT_SLIP(scaleP(mulP(linP(c), linP(c)), p * q)), ...(L !== p * q ? [PRODUCT_SLIP(scaleP(linP(c), p * q))] : [])],
    };
  }
  return hnExercise(s, ka, kb);
}

// ---------------------------------------------------------------------------
// Adding and subtracting (fill in the numerator)

type AddSub = {
  A: Poly;
  dA: string;
  /** What A's fraction is expanded by (null: nothing). */
  eA: Poly | null;
  B: Poly;
  dB: string;
  eB: Poly | null;
  sign: 1 | -1;
  /** The common denominator, factorised. */
  hn: string;
};

const terms = (p: Poly) => p.filter((c) => c !== 0).length;
const wrapSum = (p: Poly) => (terms(p) > 1 ? `(${pSrc(p)})` : pSrc(p));

/** "2(x + 1)", "3 \cdot 2", "3x", "(x + 1)(x - 1)" … `alone`: written on its own (no brackets needed around a sum). */
function prodSrc(A: Poly, e: Poly | null, alone = true): string {
  if (!e) return alone || terms(A) === 1 ? pSrc(A) : `(${pSrc(A)})`;
  const isNum = (p: Poly) => p.length === 1;
  if (isNum(A) && A[0] === 1) return alone || terms(e) === 1 ? pSrc(e) : `(${pSrc(e)})`;
  if (terms(A) === 1 && terms(e) === 1) return isNum(A) && isNum(e) ? `${pSrc(A)} \\cdot ${pSrc(e)}` : pSrc(mulP(A, e));
  if (terms(A) === 1) return `${pSrc(A)}${wrapSum(e)}`;
  if (terms(e) === 1) return `${pSrc(e)}${wrapSum(A)}`;
  return `${wrapSum(A)}${wrapSum(e)}`;
}

/** Appends a signed sum: "6" + "-x - 1" → "6 - x - 1". */
const join = (a: string, b: string) => (b.startsWith("-") ? `${a} - ${b.slice(1)}` : `${a} + ${b}`);

function addSubExercise(s: AddSub): Exercise {
  const AeA = s.eA ? mulP(s.A, s.eA) : s.A;
  const BeB = s.eB ? mulP(s.B, s.eB) : s.B;
  const N = addP(AeA, scaleP(BeB, s.sign));
  const op = s.sign > 0 ? "+" : "-";
  const answer: AnswerSpec = { kind: "expr", value: pExpr(N), form: "simplified" };
  const pa = prodSrc(s.A, s.eA);
  const pb = prodSrc(s.B, s.eB);
  const pbInBar = prodSrc(s.B, s.eB, s.sign > 0);
  const frames: Frame[] = [
    {
      math: `\\frac{${pSrc(s.A)}}{${s.dA}} ${op} \\frac{${pSrc(s.B)}}{${s.dB}}`,
      note: tx(`Common denominator: $${s.hn}$. Each fraction gets the factor it's missing.`, `Hauptnenner: $${s.hn}$. Jeder Bruch bekommt den Faktor, der ihm fehlt.`),
    },
    {
      math: `\\frac{${pa}}{${s.hn}} ${op} \\frac{${pb}}{${s.hn}}`,
      note: tx("Expand: numerator and denominator by the same factor.", "Erweitern: Zähler und Nenner mit demselben Faktor."),
    },
    {
      math: `\\frac{${pa} ${op} ${pbInBar}}{${s.hn}}`,
      note:
        s.sign < 0 && terms(BeB) > 1
          ? tx("One fraction bar. Careful: the minus applies to the **whole** second numerator.", "Ein Bruchstrich. Vorsicht: Das Minus gilt für den **ganzen** zweiten Zähler.")
          : tx("Now on one fraction bar.", "Jetzt auf einem Bruchstrich."),
    },
    {
      math: `\\frac{${join(pSrc(AeA), pSrc(scaleP(BeB, s.sign)))}}{${s.hn}}`,
      note:
        s.sign < 0 && terms(BeB) > 1
          ? tx("Multiply out. The minus in front of the bracket flips every sign inside.", "Ausmultiplizieren. Das Minus vor der Klammer dreht jedes Vorzeichen darin um.")
          : tx("Multiply out.", "Ausmultiplizieren."),
    },
    { math: `\\frac{\\hl{${pSrc(N)}}}{${s.hn}}`, note: tx("Combine like terms. That's the numerator.", "Gleichartige Terme zusammenfassen. Das ist der Zähler.") },
  ].filter((f, i, all) => i === 0 || f.math !== all[i - 1].math);
  const lead = (p: Poly) => {
    const i = p.length - 1;
    const out = new Array(p.length).fill(0);
    out[i] = p[i];
    return out as Poly;
  };
  const bracketTrap = s.sign < 0 && terms(BeB) > 1 ? addP(subP(AeA, lead(BeB)), subP(BeB, lead(BeB))) : null;
  const plain = addP(s.A, scaleP(s.B, s.sign));
  // Both slips can lead to the same numerator (5/(x − 5) − 5/(x + 5): both give 0). Then Blob names both.
  const bothSlips = !!bracketTrap && pExpr(bracketTrap) === pExpr(plain);
  return {
    instruction: tx("Calculate", "Berechne"),
    text: tx("Bring the fractions to the common denominator and fill in the numerator (fully simplified).", "Bring die Brüche auf den Hauptnenner und ergänze den Zähler (vollständig zusammengefasst)."),
    math: `\\frac{${pSrc(s.A)}}{${s.dA}} ${op} \\frac{${pSrc(s.B)}}{${s.dB}} = \\frac{\\box{?}}{${s.hn}}`,
    answer,
    hint: tx(`Expand each fraction to $${s.hn}$. ${s.sign < 0 ? "Put the second numerator in brackets." : ""}`.trim(), `Erweitere jeden Bruch auf $${s.hn}$. ${s.sign < 0 ? "Setz den zweiten Zähler in Klammern." : ""}`.trim()),
    solution: frames,
    mistakes: mistakesFor(answer, [
      bothSlips
        ? {
            expr: pExpr(plain),
            title: tx("Numerators or the minus?", "Zähler oder Minus?"),
            say: tx(
              `Check two things. Did you multiply each numerator by the same factor as its denominator? And the minus belongs to the **whole** second numerator $${pSrc(BeB)}$: put it in brackets, then every sign inside flips.`,
              `Prüf zwei Dinge. Hast du jeden Zähler mit demselben Faktor multipliziert wie seinen Nenner? Und das Minus gehört zum **ganzen** zweiten Zähler $${pSrc(BeB)}$: Setz ihn in Klammern, dann dreht sich jedes Vorzeichen darin um.`,
            ),
          }
        : {
            expr: pExpr(plain),
            title: tx("Numerators not expanded", "Zähler nicht erweitert"),
            say: tx("You changed the denominators, but not the numerators. Whatever a denominator is multiplied by, its numerator is multiplied by too.", "Du hast die Nenner verändert, aber nicht die Zähler. Womit ein Nenner multipliziert wird, damit auch sein Zähler."),
          },
      bracketTrap && {
        expr: pExpr(bracketTrap),
        title: tx("Bracket forgotten", "Klammer vergessen"),
        say: tx(
          `Ooh, the minus trap! The minus belongs to the **whole** numerator $${pSrc(BeB)}$: put it in brackets, then every sign inside flips.`,
          `Die Minus-Falle! Das Minus gehört zum **ganzen** Zähler $${pSrc(BeB)}$: Setz ihn in Klammern, dann dreht sich jedes Vorzeichen darin um.`,
        ),
      },
      s.eA && {
        expr: pExpr(addP(s.A, scaleP(BeB, s.sign))),
        title: tx("One numerator not expanded", "Einen Zähler nicht erweitert"),
        say: tx(`The first fraction is expanded by $${pSrc(s.eA)}$: its numerator $${pSrc(s.A)}$ has to be multiplied by it too.`, `Der erste Bruch wird mit $${pSrc(s.eA)}$ erweitert: Sein Zähler $${pSrc(s.A)}$ muss auch damit multipliziert werden.`),
      },
      s.eB && {
        expr: pExpr(addP(AeA, scaleP(s.B, s.sign))),
        title: tx("One numerator not expanded", "Einen Zähler nicht erweitert"),
        say: tx(`The second fraction is expanded by $${pSrc(s.eB)}$: its numerator $${pSrc(s.B)}$ has to be multiplied by it too.`, `Der zweite Bruch wird mit $${pSrc(s.eB)}$ erweitert: Sein Zähler $${pSrc(s.B)}$ muss auch damit multipliziert werden.`),
      },
    ]),
  };
}

function addSubTask(rng: Rng): Exercise | null {
  const t = rng.int(1, 5);
  const a = rng.int(1, 7);
  const b = rng.int(1, 7);
  const c = rng.int(1, 5) * rng.pick([1, -1]);
  const sign: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  if (t === 1) return addSubExercise({ A: poly(a), dA: "x", eA: linP(c), B: poly(b), dB: lin(c), eB: poly(0, 1), sign, hn: `x${par(c)}` });
  if (t === 2) {
    const [p, q] = rng.shuffle([2, 3, 4, 5, 6]).slice(0, 2);
    const L = lcm(p, q);
    if (L === Math.max(p, q)) return null;
    return addSubExercise({ A: poly(a), dA: `${p}x`, eA: poly(L / p), B: poly(b), dB: `${q}x`, eB: poly(L / q), sign, hn: `${L}x` });
  }
  if (t === 3) {
    const C = Math.abs(c);
    return addSubExercise({ A: poly(a), dA: `x - ${C}`, eA: linP(C), B: poly(b), dB: `x + ${C}`, eB: linP(-C), sign, hn: `(x - ${C})(x + ${C})` });
  }
  if (t === 4) {
    // a/x − (x + c)/(2x): the minus trap.
    const k = rng.pick([2, 3]);
    return addSubExercise({ A: poly(a), dA: "x", eA: poly(k), B: linP(c), dB: `${k}x`, eB: null, sign: -1, hn: `${k}x` });
  }
  const C = Math.abs(c);
  return addSubExercise({ A: poly(a), dA: pSrc(poly(-C * C, 0, 1)), eA: null, B: poly(b), dB: `x + ${C}`, eB: linP(-C), sign, hn: `(x + ${C})(x - ${C})` });
}

// ---------------------------------------------------------------------------
// Multiplying and dividing (fill the gap)

type MulDiv = { task: string; times?: string; factored: string; struck: string; res: [string, string]; ask: "num" | "den"; ans: string; slips: Slip[] };

function mulDivExercise(s: MulDiv, divide: boolean): Exercise {
  const box = "\\box{?}";
  const gapForm = s.ask === "num" ? `\\frac{${box}}{${s.res[1]}}` : `\\frac{${s.res[0]}}{${box}}`;
  const answer: AnswerSpec = { kind: "expr", value: s.ans };
  const frames: Frame[] = [{ math: s.task, note: divide ? tx("Dividing means multiplying by the reciprocal, just like with numbers.", "Dividieren heißt: mit dem Kehrwert multiplizieren, wie bei Zahlen.") : tx("Factorise everything first. Then cancel crosswise.", "Faktorisiere zuerst alles. Dann über Kreuz kürzen.") }];
  if (s.times) frames.push({ math: s.times, note: tx("Flip the second fraction and multiply.", "Zweiten Bruch umdrehen und multiplizieren.") });
  frames.push({ math: s.factored, note: tx("Factorise numerators and denominators, all on one fraction bar.", "Zähler und Nenner faktorisieren, alles auf einen Bruchstrich.") });
  frames.push({ math: s.struck, note: tx("Cancel the factors that appear top and bottom.", "Kürze die Faktoren, die oben und unten vorkommen.") });
  frames.push({ math: `\\frac{${s.res[0]}}{${s.res[1]}}`, note: tx("What's left, fully simplified.", "Was übrig bleibt, vollständig gekürzt.") });
  return {
    instruction: divide ? tx("Divide and simplify", "Dividiere und kürze") : tx("Multiply and simplify", "Multipliziere und kürze"),
    text: tx("Simplify fully and fill the gap.", "Kürze vollständig und ergänze die Lücke."),
    math: `${s.task} = ${gapForm}`,
    answer,
    hint: divide
      ? tx("Multiply by the reciprocal of the second fraction. Then factorise and cancel.", "Multipliziere mit dem Kehrwert des zweiten Bruchs. Dann faktorisieren und kürzen.")
      : tx("Factorise first (factor out, binomial formulas), then cancel crosswise.", "Erst faktorisieren (ausklammern, binomische Formeln), dann über Kreuz kürzen."),
    solution: frames,
    mistakes: mistakesFor(answer, s.slips),
  };
}

function mulDivTask(rng: Rng): Exercise | null {
  const t = rng.int(1, 4);
  const A = rng.int(1, 6);
  if (t === 1) {
    // (x² − A²)/(k x) · (m x)/(x + A), with m | k.
    const m = rng.pick([2, 3]);
    const r = rng.pick([2, 3]);
    const k = m * r;
    return mulDivExercise(
      {
        task: `\\frac{${pSrc(poly(-A * A, 0, 1))}}{${k}x} \\cdot \\frac{${m}x}{x + ${A}}`,
        factored: `\\frac{(x + ${A})(x - ${A}) \\cdot ${m}x}{${k}x \\cdot (x + ${A})}`,
        struck: `\\frac{\\strike{(x + ${A})}(x - ${A}) \\cdot \\strike{${m}x}}{${r} \\cdot \\strike{${m}x} \\cdot \\strike{(x + ${A})}}`,
        res: [`x - ${A}`, String(r)],
        ask: "num",
        ans: `x-${A}`,
        slips: [{ expr: `x+${A}`, title: WRONG_FACTOR, say: tx(`$(x + ${A})$ cancels with the second denominator. On top, $(x - ${A})$ stays.`, `$(x + ${A})$ kürzt sich mit dem zweiten Nenner. Oben bleibt $(x - ${A})$.`) }],
      },
      false,
    );
  }
  if (t === 2) {
    // (p x)/(x − A) : (q x²)/(x² − A²) = (x + A)/(r x), with q = p r.
    const p = rng.pick([2, 3, 4]);
    const r = rng.pick([2, 3]);
    const q = p * r;
    return mulDivExercise(
      {
        task: `\\frac{${p}x}{x - ${A}} : \\frac{${q}x^2}{${pSrc(poly(-A * A, 0, 1))}}`,
        times: `\\frac{${p}x}{x - ${A}} \\cdot \\frac{${pSrc(poly(-A * A, 0, 1))}}{${q}x^2}`,
        factored: `\\frac{${p}x \\cdot (x + ${A})(x - ${A})}{(x - ${A}) \\cdot ${q} \\cdot x \\cdot x}`,
        struck: `\\frac{\\strike{${p}x} \\cdot (x + ${A})\\strike{(x - ${A})}}{\\strike{(x - ${A})} \\cdot ${r} \\cdot \\strike{${p}x} \\cdot x}`,
        res: [`x + ${A}`, `${r}x`],
        ask: "num",
        ans: `x+${A}`,
        slips: [{ expr: `x-${A}`, title: WRONG_FACTOR, say: tx(`$(x - ${A})$ cancels with the first denominator. On top, $(x + ${A})$ stays.`, `$(x - ${A})$ kürzt sich mit dem ersten Nenner. Oben bleibt $(x + ${A})$.`) }],
      },
      true,
    );
  }
  if (t === 3) {
    // (x² + A x)/k · m/(x + A) = (m/g) x / (k/g)
    const k = rng.pick([4, 6, 8, 9, 10]);
    const m = rng.pick([2, 3, 4, 6]);
    const g = gcd(m, k);
    if (k / g < 2 || g < 2) return null;
    return mulDivExercise(
      {
        task: `\\frac{${pSrc(poly(0, A, 1))}}{${k}} \\cdot \\frac{${m}}{x + ${A}}`,
        factored: `\\frac{x(x + ${A}) \\cdot ${m}}{${k} \\cdot (x + ${A})}`,
        struck: `\\frac{x\\strike{(x + ${A})} \\cdot ${m}}{${k} \\cdot \\strike{(x + ${A})}}`,
        res: [pSrc(poly(0, m / g)), String(k / g)],
        ask: "num",
        ans: pExpr(poly(0, m / g)),
        slips: [
          { expr: pExpr(poly(0, m)), title: tx("Numbers not simplified", "Zahlen nicht gekürzt"), say: tx(`Nearly! $${m}$ and $${k}$ can still be simplified by $${g}$.`, `Fast! $${m}$ und $${k}$ kannst du noch durch $${g}$ kürzen.`), close: true },
          { expr: pExpr(mulP(poly(0, m / g), linP(A))), title: NOT_CANCELLED, say: tx(`$(x + ${A})$ appears top and bottom: cancel it.`, `$(x + ${A})$ steht oben und unten: kürzen.`) },
        ],
      },
      false,
    );
  }
  // p/(x + A) : q/(x² + A x) = (p/g) x / (q/g)
  const p = rng.pick([2, 3, 4, 6, 8]);
  const q = rng.pick([3, 4, 6, 9, 10]);
  const g = gcd(p, q);
  if (q / g < 2 || p === q) return null;
  return mulDivExercise(
    {
      task: `\\frac{${p}}{x + ${A}} : \\frac{${q}}{${pSrc(poly(0, A, 1))}}`,
      times: `\\frac{${p}}{x + ${A}} \\cdot \\frac{${pSrc(poly(0, A, 1))}}{${q}}`,
      factored: `\\frac{${p} \\cdot x(x + ${A})}{(x + ${A}) \\cdot ${q}}`,
      struck: `\\frac{${p} \\cdot x\\strike{(x + ${A})}}{\\strike{(x + ${A})} \\cdot ${q}}`,
      res: [pSrc(poly(0, p / g)), String(q / g)],
      ask: "num",
      ans: pExpr(poly(0, p / g)),
      slips: [
        g > 1 && { expr: pExpr(poly(0, p)), title: tx("Numbers not simplified", "Zahlen nicht gekürzt"), say: tx(`Nearly! $${p}$ and $${q}$ can still be simplified by $${g}$.`, `Fast! $${p}$ und $${q}$ kannst du noch durch $${g}$ kürzen.`), close: true },
        { expr: String(p / g), title: tx("An x got lost", "Ein x ist verloren gegangen"), say: tx(`$${pSrc(poly(0, A, 1))} = x(x + ${A})$: only $(x + ${A})$ cancels, the $x$ stays.`, `$${pSrc(poly(0, A, 1))} = x(x + ${A})$: Nur $(x + ${A})$ kürzt sich, das $x$ bleibt.`) },
      ],
    },
    true,
  );
}

// ---------------------------------------------------------------------------
// Fractional equations

const SOLVE = tx("Solve the fractional equation", "Löse die Bruchgleichung");

type Eq = { eq: string; gaps: number[]; steps: { math: Text; note: Text }[]; sols: number[]; candidates: number[]; slips: Slip[] };

function equationExercise(s: Eq): Exercise {
  const frames: Frame[] = [
    {
      math: txMap((_, l) => `${s.eq} \\quad ${resolveText(domainSrc(s.gaps), l)}`),
      note: tx(
        `First the domain: the denominators must not be $0$, so $x \\ne ${s.gaps.join("$ and $x \\ne ")}$.`,
        `Zuerst die Definitionsmenge: Die Nenner dürfen nicht $0$ werden, also $x \\ne ${s.gaps.join("$ und $x \\ne ")}$.`,
      ),
    },
    // A step that only repeats the line before it (a factor 1) is left out.
    ...s.steps.filter((st, i, all) => i === 0 || resolveText(st.math, "de") !== resolveText(all[i - 1].math, "de")),
  ];
  const bad = s.candidates.filter((c) => s.gaps.includes(c));
  frames.push({
    math: txMap((_, l) => {
      const check = s.candidates.map((c) => (s.gaps.includes(c) ? `${numL(c, l)} ∉ D` : `${numL(c, l)} \\in D`)).join(" \\quad ");
      return `${check} \\quad \\Rightarrow \\quad ${resolveText(solSrc(s.sols), l)}`;
    }),
    note: bad.length
      ? tx(
          `Check against the domain: $x = ${bad.join(", ")}$ is not allowed. It's a **false solution** (Scheinlösung).${s.sols.length ? "" : " So the equation has no solution."}`,
          `Abgleich mit der Definitionsmenge: $x = ${bad.join("; ")}$ ist nicht erlaubt. Das ist eine **Scheinlösung**.${s.sols.length ? "" : " Die Gleichung hat also keine Lösung."}`,
        )
      : tx("Check against the domain: allowed. That's the solution set.", "Abgleich mit der Definitionsmenge: erlaubt. Das ist die Lösungsmenge."),
  });
  const answer: AnswerSpec = { kind: "solutions", variable: "x", values: s.sols, allowNone: true };
  const notChecked: Slip = bad.length
    ? {
        values: s.candidates,
        title: tx("Domain not checked", "Definitionsmenge nicht geprüft"),
        say: tx(
          `Well calculated, but put $x = ${bad[0]}$ back in: a denominator becomes $0$! Compare with the domain: $x = ${bad[0]}$ is a false solution.`,
          `Gut gerechnet, aber setz mal $x = ${bad[0]}$ ein: Ein Nenner wird $0$! Gleich mit der Definitionsmenge ab: $x = ${bad[0]}$ ist eine Scheinlösung.`,
        ),
        close: true,
      }
    : null;
  return {
    instruction: SOLVE,
    math: s.eq,
    answer,
    hint: tx("Domain first. Then multiply both sides by the common denominator, solve, and compare with the domain.", "Zuerst die Definitionsmenge. Dann beide Seiten mit dem Hauptnenner multiplizieren, lösen und mit der Definitionsmenge abgleichen."),
    solution: frames,
    mistakes: mistakesFor(answer, [notChecked, ...s.slips]),
  };
}

const step = (math: Text, note: Text): { math: Text; note: Text } => ({ math, note });
/** k · x without a written 1: "x", "-x", "3x". */
const kx = (k: number) => pSrc(poly(0, k));
/** k · (x + a) without a written 1: "x + 3" or "4(x + 3)". */
const kPar = (k: number, a: number) => (k === 1 ? lin(a) : `${k}${par(a)}`);
/** The last step k x = k·x0 → x = x0 (for k = 1 the equation only needs reading the other way round). */
const divideStep = (k: number, x: number) =>
  step(`x = ${x}`, k === 1 ? tx(`So $x = ${x}$.`, `Also ist $x = ${x}$.`) : tx(`Divide by $${k}$.`, `Durch $${k}$ teilen.`));

function equationTask(rng: Rng): Exercise | null {
  const t = rng.pick([1, 1, 2, 3, 4, 4, 5, 6, 7]);
  if (t === 1) {
    // a/x = b/(x + c)  →  a(x + c) = b x  →  x = ac/(b − a)
    const a = rng.int(1, 6);
    const b = rng.int(1, 9);
    const c = rng.int(1, 6) * rng.pick([1, -1]);
    if (a === b || (a * c) % (b - a) !== 0) return null;
    const x = (a * c) / (b - a);
    if (x === 0 || x === -c || Math.abs(x) > 20) return null;
    const wrong = (b * c) % (a - b) === 0 ? (b * c) / (a - b) : null;
    return equationExercise({
      eq: `\\frac{${a}}{x} = \\frac{${b}}{${lin(c)}}`,
      gaps: [0, -c].sort((p, q) => p - q),
      steps: [
        step(`${kPar(a, c)} = ${kx(b)}`, tx(`Multiply both sides by the common denominator $x${par(c)}$: the denominators cancel ("cross-multiply").`, `Beide Seiten mal den Hauptnenner $x${par(c)}$: Die Nenner fallen weg („über Kreuz multiplizieren“).`)),
        step(`${pSrc(poly(a * c, a))} = ${kx(b)}`, tx("Multiply out.", "Ausmultiplizieren.")),
        step(`${a * c} = ${pSrc(poly(0, b - a))}`, tx(`Subtract $${kx(a)}$.`, `$${kx(a)}$ abziehen.`)),
        divideStep(b - a, x),
      ],
      sols: [x],
      candidates: [x],
      slips: [
        wrong !== null &&
          wrong !== x && {
            values: [wrong],
            title: tx("Crossed the wrong way", "Falsch über Kreuz"),
            say: tx(`Cross-multiplying pairs each numerator with the **other** denominator: $${a} \\cdot ${par(c)} = ${b} \\cdot x$.`, `Über Kreuz multiplizieren heißt: jeder Zähler mal den **anderen** Nenner: $${a} \\cdot ${par(c)} = ${b} \\cdot x$.`),
          },
      ],
    });
  }
  if (t === 2) {
    // a/x + b = c/x  →  a + b x = c  →  x = (c − a)/b
    const b = rng.int(1, 5) * rng.pick([1, -1]);
    const x = rng.int(1, 6) * rng.pick([1, -1]);
    const a = rng.int(1, 9);
    const c = a + b * x;
    if (c === 0 || c === a) return null;
    return equationExercise({
      eq: `\\frac{${a}}{x} ${b < 0 ? "-" : "+"} ${Math.abs(b)} = \\frac{${c}}{x}`,
      gaps: [0],
      steps: [
        step(`${a} ${b < 0 ? "-" : "+"} ${kx(Math.abs(b))} = ${c}`, tx(`Multiply **every** term by $x$: $\\frac{${a}}{x} \\cdot x = ${a}$ and $${Math.abs(b)} \\cdot x = ${kx(Math.abs(b))}$.`, `Multipliziere **jeden** Summanden mit $x$: $\\frac{${a}}{x} \\cdot x = ${a}$ und $${Math.abs(b)} \\cdot x = ${kx(Math.abs(b))}$.`)),
        step(`${pSrc(poly(0, b))} = ${c - a}`, tx(`Subtract $${a}$.`, `$${a}$ abziehen.`)),
        divideStep(b, x),
      ],
      sols: [x],
      candidates: [x],
      slips: [
        {
          values: [],
          title: tx("Not every term multiplied", "Nicht jeden Summanden multipliziert"),
          say: tx(`Did $${Math.abs(b)}$ get multiplied by $x$ too? When you multiply an equation, **every** term gets multiplied.`, `Hast du die $${Math.abs(b)}$ auch mit $x$ multipliziert? Wenn du eine Gleichung multiplizierst, wird **jeder** Summand multipliziert.`),
        },
      ],
    });
  }
  if (t === 3) {
    // a/(x − p) = b  →  x = a/b + p
    const b = rng.int(2, 6) * rng.pick([1, -1]);
    const q = rng.int(1, 5) * rng.pick([1, -1]);
    const a = b * q;
    const p = rng.int(1, 6) * rng.pick([1, -1]);
    const x = q + p;
    if (x === p) return null;
    return equationExercise({
      eq: `\\frac{${a}}{${lin(-p)}} = ${b}`,
      gaps: [p],
      steps: [
        step(`${a} = ${b}${par(-p)}`, tx(`Multiply both sides by $${par(-p)}$.`, `Beide Seiten mal $${par(-p)}$.`)),
        step(`${a} = ${pSrc(poly(-b * p, b))}`, tx("Multiply out.", "Ausmultiplizieren.")),
        step(`${a + b * p} = ${b}x`, tx(`${-b * p > 0 ? "Subtract" : "Add"} $${Math.abs(b * p)}$.`, `$${Math.abs(b * p)}$ ${-b * p > 0 ? "abziehen" : "addieren"}.`)),
        divideStep(b, x),
      ],
      sols: [x],
      candidates: [x],
      slips: [
        { values: [q - p], title: tx("Sign of the bracket", "Vorzeichen der Klammer"), say: tx(`Check the bracket: $${b} \\cdot ${par(-p)} = ${pSrc(poly(-b * p, b))}$.`, `Prüf die Klammer: $${b} \\cdot ${par(-p)} = ${pSrc(poly(-b * p, b))}$.`) },
        { values: [q], title: tx("Not solved for x yet", "Noch nicht nach x aufgelöst"), say: tx(`$\\frac{${a}}{${b}} = ${q}$ is only the bracket $${lin(-p)}$. Solve for $x$ itself.`, `$\\frac{${a}}{${b}} = ${q}$ ist erst die Klammer $${lin(-p)}$. Löse nach $x$ selbst auf.`) },
      ],
    });
  }
  if (t === 4) {
    // (x + a)/(x − b) = k  →  x = (a + k b)/(k − 1)
    const k = rng.int(2, 5);
    const b = rng.int(1, 6) * rng.pick([1, -1]);
    const a = rng.int(1, 8) * rng.pick([1, -1]);
    if ((a + k * b) % (k - 1) !== 0) return null;
    const x = (a + k * b) / (k - 1);
    if (x === b || Math.abs(x) > 20) return null;
    const wrongNum = a + b;
    const wrong = wrongNum % (k - 1) === 0 ? wrongNum / (k - 1) : null;
    return equationExercise({
      eq: `\\frac{${lin(a)}}{${lin(-b)}} = ${k}`,
      gaps: [b],
      steps: [
        step(`${lin(a)} = ${k}${par(-b)}`, tx(`Multiply both sides by $${par(-b)}$.`, `Beide Seiten mal $${par(-b)}$.`)),
        step(`${lin(a)} = ${pSrc(poly(-k * b, k))}`, tx(`Multiply out: **both** terms in the bracket times $${k}$.`, `Ausmultiplizieren: **beide** Summanden in der Klammer mal $${k}$.`)),
        step(`${a + k * b} = ${pSrc(poly(0, k - 1))}`, tx("Collect $x$ on one side, numbers on the other.", "Bring $x$ auf eine Seite, die Zahlen auf die andere.")),
        divideStep(k - 1, x),
      ],
      sols: [x],
      candidates: [x],
      slips: [
        wrong !== null &&
          wrong !== b && {
            values: [wrong],
            title: tx("Bracket only half multiplied", "Klammer nur halb ausmultipliziert"),
            say: tx(`$${k}${par(-b)}$: the $${-b}$ has to be multiplied by $${k}$ too.`, `$${k}${par(-b)}$: Auch die $${-b}$ muss mit $${k}$ multipliziert werden.`),
          },
      ],
    });
  }
  if (t === 5) {
    // x/(x − p) = p/(x − p) + k  →  x = p, not allowed: L = { }.
    const p = rng.int(1, 6) * rng.pick([1, -1]);
    const k = rng.int(2, 4);
    return equationExercise({
      eq: `\\frac{x}{${lin(-p)}} = \\frac{${p}}{${lin(-p)}} + ${k}`,
      gaps: [p],
      steps: [
        step(`x = ${p} + ${k}${par(-p)}`, tx(`Multiply every term by $${par(-p)}$.`, `Jeden Summanden mit $${par(-p)}$ multiplizieren.`)),
        step(`x = ${pSrc(poly(p - k * p, k))}`, tx("Multiply out and combine.", "Ausmultiplizieren und zusammenfassen.")),
        step(`${pSrc(poly(0, 1 - k))} = ${p - k * p}`, tx(`Subtract $${k}x$.`, `$${k}x$ abziehen.`)),
        divideStep(1 - k, p),
      ],
      sols: [],
      candidates: [p],
      slips: [],
    });
  }
  if (t === 6) {
    // x/(x − a) = a²/(x² − a x)  →  x² = a²  →  x = ±a, x = a is not allowed.
    const a = rng.int(2, 6) * rng.pick([1, -1]);
    const A = Math.abs(a);
    return equationExercise({
      eq: `\\frac{x}{${lin(-a)}} = \\frac{${A * A}}{${pSrc(poly(0, -a, 1))}}`,
      gaps: [0, a].sort((p, q) => p - q),
      steps: [
        step(`x \\cdot x = ${A * A}`, tx(`$x^2 ${a > 0 ? "-" : "+"} ${A}x = x${par(-a)}$, so the common denominator is $x${par(-a)}$. Multiply both sides by it.`, `$x^2 ${a > 0 ? "-" : "+"} ${A}x = x${par(-a)}$, der Hauptnenner ist also $x${par(-a)}$. Beide Seiten damit multiplizieren.`)),
        step(`x^2 = ${A * A}`, tx("A pure quadratic equation.", "Eine reinquadratische Gleichung.")),
        step(txMap((_, l) => `x = ${A} \\quad ${OR(l)} \\quad x = -${A}`), tx("Two solutions, at first.", "Zunächst zwei Lösungen.")),
      ],
      sols: [-a],
      candidates: [-A, A],
      slips: [
        {
          values: [a],
          title: tx("The false one kept", "Die falsche behalten"),
          say: tx(`$x = ${a}$ makes $${lin(-a)} = 0$: it's not in $D$. And $x^2 = ${A * A}$ has another solution!`, `$x = ${a}$ macht $${lin(-a)} = 0$: Die liegt nicht in $D$. Und $x^2 = ${A * A}$ hat noch eine Lösung!`),
        },
        { values: [], title: tx("One solution is fine", "Eine Lösung passt"), say: tx(`$x = ${a}$ is excluded, right. But $x = ${-a}$ is allowed: it stays in the solution set.`, `$x = ${a}$ fällt raus, stimmt. Aber $x = ${-a}$ ist erlaubt: Die bleibt in der Lösungsmenge.`) },
      ],
    });
  }
  // a/x + b/(x − p) = 0  →  (a + b)x = a p
  const a = rng.int(1, 5);
  const b = rng.int(1, 5) * rng.pick([1, -1]);
  const p = rng.int(1, 6) * rng.pick([1, -1]);
  if (a + b === 0 || (a * p) % (a + b) !== 0) return null;
  const x = (a * p) / (a + b);
  if (x === 0 || x === p) return null;
  const B = Math.abs(b);
  const sg = b < 0 ? "-" : "+";
  const lhs1 = `${kPar(a, -p)} ${sg} ${kx(B)} = 0`;
  return equationExercise({
    eq: `\\frac{${a}}{x} ${sg} \\frac{${B}}{${lin(-p)}} = 0`,
    gaps: [0, p].sort((u, v) => u - v),
    steps: [
      step(lhs1, tx(`Multiply by the common denominator $x${par(-p)}$. Each fraction loses its own denominator.`, `Mal den Hauptnenner $x${par(-p)}$. Jeder Bruch verliert seinen eigenen Nenner.`)),
      step(`${pSrc(poly(-a * p, a))} ${sg} ${kx(B)} = 0`, tx("Multiply out.", "Ausmultiplizieren.")),
      step(`${pSrc(poly(0, a + b))} = ${a * p}`, tx("Combine and move the number across.", "Zusammenfassen und die Zahl rüberbringen.")),
      divideStep(a + b, x),
    ],
    sols: [x],
    candidates: [x],
    slips: [
      // a(x − p) + |b|x = 0
      b < 0 && {
        values: [(a * p) / (a + B)],
        title: tx("The minus got lost", "Das Minus ist verloren gegangen"),
        say: tx(
          `The minus in front of the second fraction stays when you multiply: $${lhs1}$.`,
          `Das Minus vor dem zweiten Bruch bleibt beim Multiplizieren stehen: $${lhs1}$.`,
        ),
      },
      // a/x = b/(x − p) instead of a/x = −b/(x − p): a(x − p) = b x
      b > 0 && {
        values: a === b ? [] : [(a * p) / (a - b)],
        title: tx("Sign lost on the way across", "Beim Rüberbringen das Vorzeichen verloren"),
        say: tx(
          `If you bring $\\frac{${B}}{${lin(-p)}}$ to the other side, it becomes **minus**: $\\frac{${a}}{x} = -\\frac{${B}}{${lin(-p)}}$. Or multiply straight away: $${lhs1}$.`,
          `Bringst du $\\frac{${B}}{${lin(-p)}}$ auf die andere Seite, wird daraus **minus**: $\\frac{${a}}{x} = -\\frac{${B}}{${lin(-p)}}$. Oder multiplizier gleich: $${lhs1}$.`,
        ),
      },
      // a x + b(x − p) = 0
      {
        values: [(b * p) / (a + b)],
        title: tx("Wrong factor kept", "Falschen Faktor behalten"),
        say: tx(
          `Multiplying by $x${par(-p)}$ cancels each fraction's **own** denominator: $\\frac{${a}}{x} \\cdot x${par(-p)} = ${kPar(a, -p)}$, not $${kx(a)}$.`,
          `Beim Multiplizieren mit $x${par(-p)}$ kürzt sich bei jedem Bruch sein **eigener** Nenner: $\\frac{${a}}{x} \\cdot x${par(-p)} = ${kPar(a, -p)}$, nicht $${kx(a)}$.`,
        ),
      },
      // a x − p + b x = 0
      a > 1 && {
        values: [p / (a + b)],
        title: tx("Bracket only half multiplied", "Klammer nur halb ausmultipliziert"),
        say: tx(`$${a}${par(-p)}$: the $${-p}$ has to be multiplied by $${a}$ too.`, `$${a}${par(-p)}$: Auch die $${-p}$ muss mit $${a}$ multipliziert werden.`),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Practice

const LEVEL3: [number, Gen][] = [
  [2, domainTask],
  [2, simplifyTask],
  [1, cancelTask],
  [1.2, hnTask],
  [2, addSubTask],
  [1.3, mulDivTask],
  [2.5, equationTask],
];

export function generate3(rng: Rng): Exercise {
  for (let tries = 0; tries < 80; tries++) {
    const ex = pickWeighted(rng, LEVEL3)(rng);
    if (ex) return ex;
  }
  for (;;) {
    const ex = domainTask(rng);
    if (ex) return ex;
  }
}

// ---------------------------------------------------------------------------
// Lesson boards

const domainFrames: Frame[] = [
  { math: "\\frac{5#n}{x#x -#m 3#c}#f", note: tx("An **algebraic fraction** (Bruchterm): a variable in the denominator.", "Ein **Bruchterm**: Im Nenner steht eine Variable.") },
  {
    math: "\\frac{5#n}{3#x -#m 3#c}#f =#e \\frac{5#n2}{\\red{0#z}}#f2",
    note: tx("Put in $x = 3$: the denominator becomes $0$. Dividing by $0$ is impossible!", "Setz $x = 3$ ein: Der Nenner wird $0$. Durch $0$ teilen geht nicht!"),
  },
  {
    math: txMap((_, l) => `D = ℚ ∖ ${setSrc([3], l)}`),
    note: tx("The **domain** $D$ holds every number you may put in: all except $3$.", "Die **Definitionsmenge** $D$ enthält alle Zahlen, die du einsetzen darfst: alle außer $3$."),
  },
  { math: "\\frac{x + 1}{x^2#a -#m 4x#b}#f", note: tx("And here? Set the denominator equal to $0$.", "Und hier? Setz den Nenner gleich $0$.") },
  { math: "x^2#a -#m 4x#b =#e 0#z", note: tx("When is $x^2 - 4x = 0$?", "Wann ist $x^2 - 4x = 0$?") },
  { math: "x#a (x#b -#m 4#c)#br =#e 0#z", note: tx("Factor out $x$. A product is $0$ when one of its factors is $0$.", "Klammere $x$ aus. Ein Produkt ist $0$, wenn einer der Faktoren $0$ ist.") },
  { math: txMap((_, l) => `x#a =#e 0#z \\quad ${OR(l)} \\quad x#b =#e2 4#c`), note: tx("Two gaps in the domain.", "Zwei Definitionslücken.") },
  { math: txMap((_, l) => `D = ℚ ∖ ${setSrc([0, 4], l)}`), note: tx("Never divide by $x$ to solve $x^2 - 4x = 0$: you'd lose $x = 0$.", "Teile nie durch $x$, um $x^2 - 4x = 0$ zu lösen: Dabei verlierst du $x = 0$.") },
];

const cancelFrames: Frame[] = [
  { math: "\\frac{3x + 6}{x^2 + 2x}", note: tx("You may only cancel **factors**: things joined by $\\cdot$, not by $+$ or $-$.", "Kürzen darfst du nur **Faktoren**: Dinge, die mit $\\cdot$ verbunden sind, nicht mit $+$ oder $-$.") },
  { math: "\\frac{3#k (x + 2)#p}{x#y (x + 2)#q}", note: tx("So factorise first: factor out $3$ on top and $x$ at the bottom.", "Also zuerst faktorisieren: oben $3$ ausklammern, unten $x$.") },
  { math: "\\frac{3#k \\strike{(x + 2)#p}}{x#y \\strike{(x + 2)#q}}", note: tx("Now $(x + 2)$ is a factor top and bottom: cancel it.", "Jetzt ist $(x + 2)$ oben und unten ein Faktor: kürzen.") },
  { math: "\\frac{3#k}{x#y}", note: tx("Done. It holds for $x \\ne 0$ and $x \\ne -2$, the domain of the original term.", "Fertig. Das gilt für $x \\ne 0$ und $x \\ne -2$, die Definitionsmenge des Ausgangsterms.") },
  {
    math: "\\frac{\\red{x} + 3}{\\red{x} + 5} \\ne \\frac{3}{5}",
    note: tx("Forbidden! Here $x$ is a **summand**, not a factor. Test with $x = 1$: $\\frac{4}{6} \\ne \\frac{3}{5}$.", "Verboten! Hier ist $x$ ein **Summand**, kein Faktor. Probe mit $x = 1$: $\\frac{4}{6} \\ne \\frac{3}{5}$."),
  },
];

const addFrames = addSubExercise({ A: poly(3), dA: "x", eA: poly(2), B: linP(1), dB: "2x", eB: null, sign: -1, hn: "2x" }).solution;

const mulDivFrames: Frame[] = [
  { math: "\\frac{x^2 - 1}{4x} :#op \\frac{x + 1#c}{6x#d}", note: tx("Dividing means multiplying by the reciprocal, just like with numbers.", "Dividieren heißt: mit dem Kehrwert multiplizieren, wie bei Zahlen.") },
  { math: "\\frac{x^2 - 1}{4x} \\cdot#op \\frac{6x#d}{x + 1#c}", note: tx("Flip the second fraction: $\\frac{x + 1}{6x}$ becomes $\\frac{6x}{x + 1}$.", "Zweiten Bruch umdrehen: Aus $\\frac{x + 1}{6x}$ wird $\\frac{6x}{x + 1}$.") },
  { math: "\\frac{(x + 1)(x - 1) \\cdot 6x}{4x \\cdot (x + 1)}", note: tx("Factorise ($x^2 - 1 = (x + 1)(x - 1)$) and put everything on one fraction bar.", "Faktorisieren ($x^2 - 1 = (x + 1)(x - 1)$) und alles auf einen Bruchstrich.") },
  { math: "\\frac{\\strike{(x + 1)}(x - 1) \\cdot 6\\strike{x}}{4\\strike{x} \\cdot \\strike{(x + 1)}}", note: tx("Cancel the common factors $(x + 1)$ and $x$.", "Kürze die gemeinsamen Faktoren $(x + 1)$ und $x$.") },
  { math: "\\frac{6(x - 1)}{4}", note: tx("Left over.", "Das bleibt übrig.") },
  { math: "\\frac{3(x - 1)}{2}", note: tx("And simplify the numbers: $6$ and $4$ by $2$. Valid for $x \\ne 0$ and $x \\ne -1$.", "Und die Zahlen kürzen: $6$ und $4$ durch $2$. Gilt für $x \\ne 0$ und $x \\ne -1$.") },
];

const eqFrames: Frame[] = [
  { math: "\\frac{2}{x - 1} = \\frac{3}{x + 1}", note: tx("A **fractional equation** (Bruchgleichung): $x$ in a denominator. Step 1: the domain.", "Eine **Bruchgleichung**: $x$ steht im Nenner. Schritt 1: die Definitionsmenge.") },
  { math: txMap((_, l) => `\\frac{2}{x - 1} = \\frac{3}{x + 1} \\quad D = ℚ ∖ ${setSrc([-1, 1], l)}`), note: tx("$x = 1$ and $x = -1$ are not allowed.", "$x = 1$ und $x = -1$ sind verboten.") },
  { math: "2(x + 1) = 3(x - 1)", note: tx("Step 2: multiply both sides by the common denominator $(x - 1)(x + 1)$. The denominators cancel.", "Schritt 2: Beide Seiten mal den Hauptnenner $(x - 1)(x + 1)$. Die Nenner fallen weg.") },
  { math: "2x + 2 = 3x - 3", note: tx("Step 3: solve as usual.", "Schritt 3: wie gewohnt lösen.") },
  { math: "5 = x", note: tx("Subtract $2x$, add $3$.", "$2x$ abziehen, $3$ addieren.") },
  { math: txMap((_, l) => `5 \\in D \\quad \\Rightarrow \\quad L = ${setSrc([5], l)}`), note: tx("Step 4: compare with the domain. $5$ is allowed.", "Schritt 4: Abgleich mit der Definitionsmenge. $5$ ist erlaubt.") },
  { math: "\\frac{x}{x - 2} = \\frac{2}{x - 2} + 3", note: tx("Why step 4 matters: this one has $D = ℚ ∖ \\{ 2 \\}$.", "Warum Schritt 4 wichtig ist: Hier ist $D = ℚ ∖ \\{ 2 \\}$.") },
  { math: "x = 2 + 3(x - 2)", note: tx("Times $(x - 2)$, every term.", "Mal $(x - 2)$, jeder Summand.") },
  { math: "x = 3x - 4 \\quad \\Rightarrow \\quad x = 2", note: tx("Solved: $x = 2$.", "Gelöst: $x = 2$.") },
  {
    math: txMap((_, l) => `2 ∉ D \\quad \\Rightarrow \\quad L = ${setSrc([], l)}`),
    note: tx("But $2$ is not in the domain: a **false solution** (Scheinlösung). No solution at all!", "Aber $2$ liegt nicht in $D$: eine **Scheinlösung**. Es gibt gar keine Lösung!"),
  },
];

// ---------------------------------------------------------------------------
// Checks

const check1 = domainExercise({
  term: "\\frac{x + 2}{x^2 - 9}",
  zero: ["x^2 - 9"],
  factored: "(x + 3)(x - 3)",
  gaps: [-3, 3],
  slips: [
    { values: [3], title: tx("Only one solution", "Nur eine Lösung"), say: tx("$x^2 = 9$ has **two** solutions: $3$ and $-3$. Both make the denominator $0$.", "$x^2 = 9$ hat **zwei** Lösungen: $3$ und $-3$. Beide machen den Nenner $0$."), close: true },
    NUMERATOR_SLIP(2),
    { values: [-2, -3, 3], title: tx("Numerator included", "Zähler mitgenommen"), say: tx("$-3$ and $3$ are right. But $x = -2$ only makes the **numerator** $0$, and that's allowed.", "$-3$ und $3$ stimmen. Aber $x = -2$ macht nur den **Zähler** $0$, und das ist erlaubt.") },
  ],
});
const check2 = simplifyExercise(simpSpec(2, 3, 2, 2)!);
const check3 = addSubExercise({ A: poly(2), dA: "x", eA: linP(1), B: poly(3), dB: "x + 1", eB: poly(0, 1), sign: 1, hn: "x(x + 1)" });
const check4 = equationExercise({
  eq: "\\frac{x}{x - 3} = \\frac{9}{x^2 - 3x}",
  gaps: [0, 3],
  steps: [
    { math: "x \\cdot x = 9", note: tx("$x^2 - 3x = x(x - 3)$ is the common denominator. Multiply both sides by it.", "$x^2 - 3x = x(x - 3)$ ist der Hauptnenner. Beide Seiten damit multiplizieren.") },
    { math: "x^2 = 9", note: tx("A pure quadratic equation.", "Eine reinquadratische Gleichung.") },
    { math: txMap((_, l) => `x = 3 \\quad ${OR(l)} \\quad x = -3`), note: tx("Two solutions, at first.", "Zunächst zwei Lösungen.") },
  ],
  sols: [-3],
  candidates: [-3, 3],
  slips: [
    { values: [3], title: tx("The false one kept", "Die falsche behalten"), say: tx("$x = 3$ makes $x - 3 = 0$: it's not in $D$. And $x^2 = 9$ has another solution!", "$x = 3$ macht $x - 3 = 0$: Die liegt nicht in $D$. Und $x^2 = 9$ hat noch eine Lösung!") },
    { values: [], title: tx("One solution is fine", "Eine Lösung passt"), say: tx("$x = 3$ is excluded, right. But $x = -3$ is allowed: it stays in the solution set.", "$x = 3$ fällt raus, stimmt. Aber $x = -3$ ist erlaubt: Die bleibt in der Lösungsmenge.") },
  ],
});

// ---------------------------------------------------------------------------

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("The domain", "Die Definitionsmenge"),
      body: tx("A denominator must never be $0$. Set every denominator equal to $0$ (factorise first) and leave those numbers out.", "Ein Nenner darf nie $0$ sein. Setz jeden Nenner gleich $0$ (vorher faktorisieren) und nimm diese Zahlen heraus."),
      examples: [txMap((_, l) => `\\frac{x + 1}{x^2 - 4x} = \\frac{x + 1}{x(x - 4)} \\quad D = ℚ ∖ ${setSrc([0, 4], l)}`)],
      tone: "rule",
    },
    {
      title: tx("Simplify: only factors!", "Kürzen: nur Faktoren!"),
      body: tx("Factorise top and bottom (factor out, binomial formulas). Then cancel common factors. Summands never cancel.", "Zähler und Nenner faktorisieren (ausklammern, binomische Formeln). Dann gemeinsame Faktoren kürzen. Summanden kürzt man nie."),
      examples: ["\\frac{3x + 6}{x^2 + 2x} = \\frac{3(x + 2)}{x(x + 2)} = \\frac{3}{x}", "\\frac{x + 3}{x + 5} \\ne \\frac{3}{5}"],
      tone: "warning",
    },
    {
      title: tx("Add and subtract", "Addieren und subtrahieren"),
      body: tx("Factorise the denominators, build the common denominator, expand. A minus in front of a fraction: put its numerator in brackets.", "Nenner faktorisieren, Hauptnenner bilden, erweitern. Minus vor einem Bruch: dessen Zähler in Klammern setzen."),
      examples: ["\\frac{3}{x} - \\frac{x + 1}{2x} = \\frac{6 - (x + 1)}{2x} = \\frac{5 - x}{2x}"],
      tone: "rule",
    },
    {
      title: tx("Multiply and divide", "Multiplizieren und dividieren"),
      body: tx("Like with numbers: top times top, bottom times bottom; dividing means multiplying by the reciprocal. Factorise and cancel before multiplying out.", "Wie bei Zahlen: Zähler mal Zähler, Nenner mal Nenner; Dividieren heißt mit dem Kehrwert multiplizieren. Vor dem Ausmultiplizieren faktorisieren und kürzen."),
      examples: ["\\frac{x^2 - 1}{4x} : \\frac{x + 1}{6x} = \\frac{(x + 1)(x - 1) \\cdot 6x}{4x(x + 1)} = \\frac{3(x - 1)}{2}"],
      tone: "rule",
    },
    {
      title: tx("Fractional equations", "Bruchgleichungen"),
      body: tx(
        "1. Domain. 2. Multiply both sides by the common denominator. 3. Solve. 4. Compare with the domain: excluded values are false solutions.",
        "1. Definitionsmenge. 2. Beide Seiten mit dem Hauptnenner multiplizieren. 3. Lösen. 4. Mit der Definitionsmenge abgleichen: Ausgeschlossene Werte sind Scheinlösungen.",
      ),
      examples: [
        txMap((_, l) => `\\frac{2}{x - 1} = \\frac{3}{x + 1} \\Rightarrow 2(x + 1) = 3(x - 1) \\Rightarrow L = ${setSrc([5], l)}`),
        txMap((_, l) => `\\frac{x}{x - 2} = \\frac{2}{x - 2} + 3 \\Rightarrow x = 2 ∉ D \\Rightarrow L = ${setSrc([], l)}`),
      ],
      tone: "rule",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Algebraic fractions and their domain", "Bruchterme und ihre Definitionsmenge"),
      blob: tx("Rule number one: never divide by zero!", "Regel Nummer eins: Niemals durch null teilen!"),
      body: tx(
        "In an **algebraic fraction** the variable stands in a denominator. Numbers that make a denominator $0$ are not allowed: they are left out of the **domain** $D$.",
        "Bei einem **Bruchterm** steht die Variable im Nenner. Zahlen, die einen Nenner $0$ machen, sind verboten: Sie gehören nicht zur **Definitionsmenge** $D$.",
      ),
      frames: domainFrames,
    },
    {
      type: "widget",
      title: tx("Where the denominator becomes zero", "Wo der Nenner null wird"),
      blob: tx("Hunt for the gaps! Where does the graph tear apart?", "Auf Lückenjagd! Wo reißt der Graph auseinander?"),
      body: tx(
        "Move $x$ and watch the value of the term. Where the denominator becomes $0$, the term has no value and the graph breaks apart. Find all the gaps.",
        "Verschieb $x$ und beobachte den Wert des Terms. Wo der Nenner $0$ wird, hat der Term keinen Wert und der Graph reißt auseinander. Finde alle Lücken.",
      ),
      widget: FractionsDomainExplorer,
    },
    { type: "check", blob: tx("Careful, there are two of them.", "Vorsicht, es sind zwei."), exercise: check1 },
    {
      type: "explain",
      title: tx("Simplifying: only factors", "Kürzen: nur Faktoren"),
      blob: tx("The most famous trap in algebra. Let's dodge it!", "Die berühmteste Falle der Algebra. Wir weichen ihr aus!"),
      body: tx(
        "You may only cancel **factors**, never summands. So factorise first: factor out, or use a binomial formula. Then cancel what appears on top and at the bottom.",
        "Kürzen darfst du nur **Faktoren**, nie Summanden. Also zuerst faktorisieren: ausklammern oder eine binomische Formel benutzen. Dann kürzt du, was oben und unten vorkommt.",
      ),
      frames: cancelFrames,
    },
    {
      type: "widget",
      title: tx("The cancelling workshop", "Die Kürzwerkstatt"),
      blob: tx("Try cancelling summands. I dare you!", "Versuch ruhig mal, Summanden zu kürzen. Trau dich!"),
      body: tx(
        "Tap a piece on top and one at the bottom to cancel them. With summands that's not allowed. Factorise the term, then cancel the matching factors.",
        "Tipp oben und unten je ein Teil an, um beide zu kürzen. Bei Summanden geht das nicht. Faktorisiere den Term und kürze dann die passenden Faktoren.",
      ),
      widget: FractionsCancelWorkshop,
    },
    { type: "check", blob: tx("A binomial formula is hiding on top.", "Oben versteckt sich eine binomische Formel."), exercise: check2 },
    {
      type: "explain",
      title: tx("Adding and subtracting", "Addieren und subtrahieren"),
      blob: tx("Same idea as with numbers, plus one sneaky minus.", "Dieselbe Idee wie bei Zahlen, plus ein fieses Minus."),
      body: tx(
        "Factorise the denominators and build the **common denominator** (Hauptnenner). Expand every fraction to it. A minus in front of a fraction applies to its whole numerator: brackets!",
        "Faktorisiere die Nenner und bilde den **Hauptnenner**. Erweitere jeden Bruch darauf. Ein Minus vor einem Bruch gilt für seinen ganzen Zähler: Klammern!",
      ),
      frames: addFrames,
    },
    { type: "check", blob: tx("Two different denominators. What's missing in each?", "Zwei verschiedene Nenner. Was fehlt jedem?"), exercise: check3 },
    {
      type: "explain",
      title: tx("Multiplying and dividing", "Multiplizieren und dividieren"),
      blob: tx("Factorise, cancel crosswise, done.", "Faktorisieren, über Kreuz kürzen, fertig."),
      body: tx(
        "As with numbers: top times top, bottom times bottom, and dividing means multiplying by the reciprocal. Factorise and cancel **before** you multiply out.",
        "Wie bei Zahlen: Zähler mal Zähler, Nenner mal Nenner, und Dividieren heißt mit dem Kehrwert multiplizieren. Faktorisiere und kürze, **bevor** du ausmultiplizierst.",
      ),
      frames: mulDivFrames,
    },
    {
      type: "explain",
      title: tx("Fractional equations", "Bruchgleichungen"),
      blob: tx("Four steps. And step four saves the day.", "Vier Schritte. Und Schritt vier rettet dir den Tag."),
      body: tx(
        "1. Domain. 2. Multiply both sides by the common denominator. 3. Solve. 4. Compare every solution with the domain: excluded values are **false solutions** (Scheinlösungen).",
        "1. Definitionsmenge. 2. Beide Seiten mit dem Hauptnenner multiplizieren. 3. Lösen. 4. Jede Lösung mit der Definitionsmenge abgleichen: Ausgeschlossene Werte sind **Scheinlösungen**.",
      ),
      frames: eqFrames,
    },
    { type: "check", blob: tx("Last one! Don't forget step four.", "Die letzte! Vergiss Schritt vier nicht."), exercise: check4 },
  ],
};

