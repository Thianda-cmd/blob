"use client";

import type { ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { choiceOf, distinct, kn, kp, numberAnswer, numberMistakes, par, weighted, type Opt, type Slip } from "./shared";
import { NegLineFigure } from "./visuals";
import { NegCleverSum, NegDistance, NegPowerLab } from "./widgets3";

const asVisual = (c: unknown) => c as ComponentType<Record<string, unknown>>;
const DEG: Text = "°C";
const CALC = tx("Calculate", "Berechne");

/** |…| kept together, so a minus right after it is read as "minus", not as a sign. */
const ab = (inner: string, k = "") => `\\group{|${k ? `#${k}l` : ""} ${inner} |${k ? `#${k}r` : ""}}`;
const strip = (s: string) => s.replace(/#[A-Za-z0-9_-]+/g, "").replace(/(^|\(|\| |= |\{)- /g, "$1-");

/** Lösungsmenge: "L = {−4; 4}" in German, "L = {−4, 4}" in English. */
const setOf = (vals: number[]): Text => {
  const sorted = [...vals].sort((a, b) => a - b);
  return vals.length ? tx(`L = \\{${sorted.join(", ")}\\}`, `L = \\{${sorted.join("; ")}\\}`) : "L = \\{ \\}";
};

// ---------------------------------------------------------------------------
// Practice: absolute values

function absTask(rng: Rng): Exercise {
  for (let i = 0; i < 50; i++) {
    const kind = rng.int(0, 4);
    const a = -rng.int(2, 15);
    const b = rng.sign() * rng.int(2, 15);
    if (kind === 0) {
      // |a| + |b|
      const r = -a + Math.abs(b);
      return absExercise(
        `${ab(kn(a, "a"), "A")} +#p ${ab(kn(b, "b"), "B")}`,
        `${-a}#a +#p ${Math.abs(b)}#b`,
        r,
        tx(`Each absolute value is a distance: $|${a}| = ${-a}$ and $|${b}| = ${Math.abs(b)}$.`, `Jeder Betrag ist ein Abstand: $|${a}| = ${-a}$ und $|${b}| = ${Math.abs(b)}$.`),
        [{ v: a + b, title: tx("Kept the signs", "Vorzeichen behalten"), say: tx("The bars are not brackets! $|a|$ is a distance and never negative: $|" + a + "| = " + -a + "$.", "Die Striche sind keine Klammern! $|a|$ ist ein Abstand und nie negativ: $|" + a + "| = " + -a + "$.") }],
      );
    }
    if (kind === 1) {
      // |a| − |b| can be negative
      const c = -rng.int(2, 15);
      if (Math.abs(c) <= Math.abs(a)) continue;
      const r = -a - -c;
      return absExercise(
        `${ab(kn(a, "a"), "A")} -#m ${ab(kn(c, "b"), "B")}`,
        `${-a}#a -#m ${-c}#b`,
        r,
        tx(`First the absolute values: $|${a}| = ${-a}$ and $|${c}| = ${-c}$. The result itself may be negative.`, `Zuerst die Beträge: $|${a}| = ${-a}$ und $|${c}| = ${-c}$. Das Ergebnis selbst darf negativ sein.`),
        [
          { v: -r, title: tx("The result may be negative", "Das Ergebnis darf negativ sein"), say: tx(`Only the absolute values are positive. $${-a} - ${-c}$ is still $${r}$.`, `Nur die Beträge sind positiv. $${-a} - ${-c}$ bleibt $${r}$.`) },
          { v: a - c, title: tx("Kept the signs", "Vorzeichen behalten"), say: tx("The bars are not brackets: inside them the minus disappears, because a distance is never negative.", "Die Striche sind keine Klammern: Darin verschwindet das Minus, weil ein Abstand nie negativ ist.") },
        ],
      );
    }
    if (kind === 2) {
      // −|a| + c
      const c = rng.int(1, 12);
      const r = a + c;
      return absExercise(
        `-#o ${ab(kn(a, "a"), "A")} +#p ${c}#c`,
        `-#o ${-a}#a +#p ${c}#c`,
        r,
        tx(`$|${a}| = ${-a}$, but the minus **outside** the bars stays.`, `$|${a}| = ${-a}$, aber das Minus **vor** den Strichen bleibt.`),
        [{ v: -a + c, title: tx("The outer minus stays", "Das Minus davor bleibt"), say: tx(`Careful: $-|${a}|$ is minus the absolute value: $-${-a}$. Only the minus **inside** the bars disappears.`, `Vorsicht: $-|${a}|$ ist minus der Betrag, also $-${-a}$. Nur das Minus **zwischen** den Strichen verschwindet.`) }],
      );
    }
    if (kind === 3) {
      // |a − b| with a < 0 < b or both negative
      const p = rng.int(2, 15);
      const r = Math.abs(a - p);
      return absExercise(
        ab(`${kn(a, "a")} -#m ${p}#b`, "A"),
        ab(`-#ms ${-(a - p)}#a`, "A"),
        r,
        tx(`Inside first: $${a} - ${p} = ${a - p}$. Then the distance from $0$: $${r}$.`, `Zuerst innen: $${a} - ${p} = ${a - p}$. Dann der Abstand zur $0$: $${r}$.`),
        [
          { v: -a - p, title: tx("Not the difference of the absolute values", "Nicht die Differenz der Beträge"), say: tx(`$|${a} - ${p}|$ is not $|${a}| - |${p}|$. Work out the inside first, then take the absolute value.`, `$|${a} - ${p}|$ ist nicht $|${a}| - |${p}|$. Rechne zuerst innen, dann nimm den Betrag.`) },
          { v: a - p, title: tx("Bars forgotten", "Betrag vergessen"), say: tx("Nearly! You worked out the inside. Now the bars: the absolute value is never negative.", "Fast! Das Innere stimmt. Jetzt noch die Betragsstriche: Ein Betrag ist nie negativ."), close: true },
        ],
      );
    }
    // |a| · |b − c|
    const c = rng.int(2, 9);
    const d = rng.int(c + 1, c + 9);
    const r = -a * (d - c);
    if (r > 120) continue;
    return absExercise(
      `${ab(kn(a, "a"), "A")} \\cdot#d ${ab(`${c}#c -#m ${d}#e`, "B")}`,
      `${-a}#a \\cdot#d ${d - c}#c`,
      r,
      tx(`$|${a}| = ${-a}$ and $|${c} - ${d}| = |${c - d}| = ${d - c}$.`, `$|${a}| = ${-a}$ und $|${c} - ${d}| = |${c - d}| = ${d - c}$.`),
      [
        { v: a * (d - c), title: tx("Kept the signs", "Vorzeichen behalten"), say: tx(`$|${a}|$ is a distance: $${-a}$, not $${a}$.`, `$|${a}|$ ist ein Abstand: $${-a}$, nicht $${a}$.`) },
        { v: -r, title: tx("Kept the signs", "Vorzeichen behalten"), say: tx("Both absolute values are positive, so the product is positive.", "Beide Beträge sind positiv, also ist auch das Produkt positiv.") },
      ],
    );
  }
  return absTask(rng);
}

function absExercise(src: string, mid: string, r: number, note: Text, slips: Slip[]): Exercise {
  return {
    instruction: CALC,
    math: strip(src),
    answer: numberAnswer(r),
    hint: tx("Work out each absolute value first: it's the distance from $0$, never negative.", "Berechne zuerst jeden Betrag: Er ist der Abstand zur $0$, nie negativ."),
    solution: [
      { math: src, note: tx("Absolute values first.", "Zuerst die Beträge.") },
      { math: mid, note },
      { math: `${mid} =#e ${kn(r, "r")}`, note: tx(`Result: $${r}$.`, `Ergebnis: $${r}$.`) },
    ],
    mistakes: numberMistakes(r, slips),
  };
}

/** The distance between two numbers, plain or in a story. */
function distanceTask(rng: Rng): Exercise {
  const [a, b] = distinct(rng, 2, () => rng.int(-30, 25)).sort((x, y) => x - y);
  if (a === b || b - a < 4 || (a >= 0 && rng.chance(0.8))) return distanceTask(rng);
  const d = b - a;
  const story = rng.int(0, 2);
  const cross = a < 0 && b > 0;
  const slips: Slip[] = [
    cross && { v: Math.abs(Math.abs(b) - Math.abs(a)), title: tx("Subtracted the digits", "Ziffern abgezogen"), say: tx("The two numbers lie on **different sides** of zero. The distance goes across zero: the two parts add up.", "Die beiden Zahlen liegen auf **verschiedenen Seiten** der Null. Der Abstand geht über die Null: Die beiden Teile werden addiert.") },
    { v: -d, title: tx("A distance is positive", "Ein Abstand ist positiv"), say: tx("Use the absolute value: $|a - b|$ is never negative.", "Nimm den Betrag: $|a - b|$ ist nie negativ."), close: true },
  ];
  const solution: Frame[] = [
    { math: ab(`${kn(b, "b")} -#m ${par(a)}#a`, "D"), note: tx("Distance = absolute value of the difference.", "Abstand = Betrag der Differenz.") },
    { math: `${ab(`${kn(b, "b")} -#m ${par(a)}#a`, "D")} =#e ${d}#r`, note: tx(`$${b} - ${par(a)} = ${d}$.`, `$${b} - ${par(a)} = ${d}$.`) },
  ];
  if (story === 0 || !cross) {
    return {
      instruction: tx("Find the distance", "Bestimme den Abstand"),
      text: tx(`How far apart are $${a}$ and $${b}$ on the number line?`, `Wie weit liegen $${a}$ und $${b}$ auf der Zahlengeraden auseinander?`),
      answer: numberAnswer(d),
      hint: tx("Subtract the two numbers and take the absolute value.", "Subtrahiere die beiden Zahlen und nimm den Betrag."),
      solution,
      mistakes: numberMistakes(d, slips),
    };
  }
  const texts: Text[] = [
    tx(
      `In one year, the lowest temperature in a town was $${a}$ °C and the highest $${b}$ °C. How big is the difference between them?`,
      `In einem Jahr lag die tiefste Temperatur in einer Stadt bei $${a}$ °C und die höchste bei $${b}$ °C. Wie groß ist der Unterschied?`,
    ),
    tx(
      `A submarine is at $${a}$ m. A drone hovers right above it at $${b}$ m. How far apart are they?`,
      `Ein U-Boot ist bei $${a}$ m. Eine Drohne schwebt genau darüber bei $${b}$ m. Wie weit sind die beiden voneinander entfernt?`,
    ),
  ];
  return {
    instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
    text: texts[story - 1],
    answer: numberAnswer(d, story === 1 ? DEG : "m"),
    hint: tx("The difference is a distance: subtract and take the absolute value.", "Der Unterschied ist ein Abstand: subtrahieren und den Betrag nehmen."),
    solution,
    mistakes: numberMistakes(d, slips, story === 1 ? DEG : "m"),
  };
}

// ---------------------------------------------------------------------------
// Practice: equations as distances

function solveTask(rng: Rng): Exercise {
  const kind = rng.pick(["abs", "abs", "sq", "sq", "absNeg", "sqNeg", "shift", "sqShift", "twice", "zero"] as const);
  const a = rng.int(2, 12);
  let task = "";
  let values: number[] = [];
  let frames: Frame[] = [];
  const slips: { values: number[]; title: Text; say: Text; close?: boolean }[] = [];
  const two = (k: number) => [-k, k];
  const ONE_MORE = tx("One solution is missing", "Eine Lösung fehlt");
  if (kind === "abs") {
    task = `${ab("x")} = ${a}`;
    values = two(a);
    frames = [
      { math: `|#l x#x |#r =#e ${a}#a`, note: tx(`Which numbers are exactly ${a} away from $0$?`, `Welche Zahlen sind genau ${a} von $0$ entfernt?`) },
      { math: `x_1#x =#e -#s ${a}#a \\quad x_2#x2 =#e2 ${a}#a2`, note: tx(`${a} to the left and ${a} to the right of zero.`, `${a} links und ${a} rechts von der Null.`) },
    ];
    slips.push({ values: [a], title: ONE_MORE, say: tx(`$${-a}$ is also ${a} away from zero: $|${-a}| = ${a}$.`, `Auch $${-a}$ ist ${a} von der Null entfernt: $|${-a}| = ${a}$.`), close: true });
  } else if (kind === "sq") {
    task = `x^2 = ${a * a}`;
    values = two(a);
    frames = [
      { math: `x#x ^{2#p} =#e ${a * a}#a`, note: tx(`Which numbers squared give ${a * a}?`, `Welche Zahlen ergeben quadriert ${a * a}?`) },
      { math: `x_1#x =#e -#s ${a}#a \\quad x_2#x2 =#e2 ${a}#a2`, note: tx(`$${a}^2 = ${a * a}$ and $(-${a})^2 = ${a * a}$ too.`, `$${a}^2 = ${a * a}$ und auch $(-${a})^2 = ${a * a}$.`) },
    ];
    slips.push({ values: [a], title: ONE_MORE, say: tx(`$(-${a})^2 = ${a * a}$ as well: minus times minus is plus.`, `Auch $(-${a})^2 = ${a * a}$: Minus mal minus ergibt plus.`), close: true });
    if ((a * a) % 2 === 0) slips.push({ values: [(a * a) / 2], title: tx("Squared is not doubled", "Quadrieren ist nicht verdoppeln"), say: tx("$x^2$ means $x \\cdot x$, not $2 \\cdot x$.", "$x^2$ heißt $x \\cdot x$, nicht $2 \\cdot x$.") });
  } else if (kind === "absNeg") {
    task = `${ab("x")} = -${a}`;
    values = [];
    frames = [{ math: `|#l x#x |#r =#e -#s ${a}#a`, note: tx("An absolute value is a distance, and a distance is never negative.", "Ein Betrag ist ein Abstand, und ein Abstand ist nie negativ.") }];
    slips.push({ values: two(a), title: tx("Distances aren't negative", "Abstände sind nie negativ"), say: tx(`Check: $|${a}| = ${a}$, not $-${a}$. No number has a negative distance from zero.`, `Mach die Probe: $|${a}| = ${a}$, nicht $-${a}$. Keine Zahl hat einen negativen Abstand zur Null.`) });
    slips.push({ values: [-a], title: tx("Distances aren't negative", "Abstände sind nie negativ"), say: tx(`Check: $|-${a}| = ${a}$, not $-${a}$. An absolute value can't be negative.`, `Mach die Probe: $|-${a}| = ${a}$, nicht $-${a}$. Ein Betrag kann nicht negativ sein.`) });
  } else if (kind === "sqNeg") {
    task = `x^2 = -${a * a}`;
    values = [];
    frames = [{ math: `x#x ^{2#p} =#e -#s ${a * a}#a`, note: tx("A square is never negative: $x \\cdot x$ is positive or zero.", "Ein Quadrat ist nie negativ: $x \\cdot x$ ist positiv oder null.") }];
    slips.push({ values: two(a), title: tx("Squares aren't negative", "Quadrate sind nie negativ"), say: tx(`Check: $(-${a})^2 = ${a * a}$, not $-${a * a}$. Minus times minus is plus.`, `Mach die Probe: $(-${a})^2 = ${a * a}$, nicht $-${a * a}$. Minus mal minus ergibt plus.`) });
    slips.push({ values: [-a], title: tx("Squares aren't negative", "Quadrate sind nie negativ"), say: tx(`$(-${a})^2 = (-${a}) \\cdot (-${a}) = ${a * a}$: positive!`, `$(-${a})^2 = (-${a}) \\cdot (-${a}) = ${a * a}$: positiv!`) });
  } else if (kind === "shift") {
    const c = rng.int(1, 9);
    const neg = rng.chance(0.25);
    const d = neg ? c - a : c + a;
    task = `${ab("x")} + ${c} = ${d}`;
    values = neg ? [] : two(a);
    frames = [
      { math: `|#l x#x |#r +#p ${c}#c =#e ${d}#d`, note: tx(`Subtract ${c} on both sides.`, `Subtrahiere auf beiden Seiten ${c}.`) },
      { math: `|#l x#x |#r =#e ${neg ? `-#s ${a}` : a}#d`, note: neg ? tx("A distance can't be negative.", "Ein Abstand kann nicht negativ sein.") : tx(`Now: which numbers are ${a} away from zero?`, `Jetzt: Welche Zahlen sind ${a} von der Null entfernt?`) },
    ];
    if (!neg) {
      frames.push({ math: `x_1#x =#e -#s ${a}#a \\quad x_2#x2 =#e2 ${a}#a2`, note: tx(`${a} to the left and ${a} to the right of zero.`, `${a} links und ${a} rechts von der Null.`) });
      slips.push({ values: two(c + d), title: tx("Wrong inverse operation", "Falsche Umkehroperation"), say: tx(`To undo $+ ${c}$, subtract ${c}: $${d} - ${c} = ${a}$.`, `Um $+ ${c}$ rückgängig zu machen, ziehst du ${c} ab: $${d} - ${c} = ${a}$.`) });
      slips.push({ values: [a], title: ONE_MORE, say: tx(`$|${-a}| = ${a}$ too, so $${-a}$ is a solution as well.`, `Auch $|${-a}| = ${a}$, also ist $${-a}$ ebenfalls eine Lösung.`), close: true });
    } else {
      slips.push({ values: two(a), title: tx("Distances aren't negative", "Abstände sind nie negativ"), say: tx(`After subtracting ${c} you get $|x| = -${a}$. No number has a negative absolute value.`, `Nach dem Subtrahieren von ${c} steht da $|x| = -${a}$. Keine Zahl hat einen negativen Betrag.`) });
    }
  } else if (kind === "sqShift") {
    const c = rng.int(1, 20);
    task = `x^2 - ${c} = ${a * a - c}`;
    values = two(a);
    frames = [
      { math: `x#x ^{2#p} -#m ${c}#c =#e ${a * a - c}#d`, note: tx(`Add ${c} on both sides.`, `Addiere auf beiden Seiten ${c}.`) },
      { math: `x#x ^{2#p} =#e ${a * a}#d`, note: tx(`Which numbers squared give ${a * a}?`, `Welche Zahlen ergeben quadriert ${a * a}?`) },
      { math: `x_1#x =#e -#s ${a}#a \\quad x_2#x2 =#e2 ${a}#a2`, note: tx(`$${a}^2 = ${a * a}$ and $(-${a})^2 = ${a * a}$.`, `$${a}^2 = ${a * a}$ und $(-${a})^2 = ${a * a}$.`) },
    ];
    slips.push({ values: [a], title: ONE_MORE, say: tx(`$(-${a})^2 = ${a * a}$ as well.`, `Auch $(-${a})^2 = ${a * a}$.`), close: true });
  } else if (kind === "twice") {
    task = `2 \\cdot ${ab("x")} = ${2 * a}`;
    values = two(a);
    frames = [
      { math: `2#t \\cdot#d |#l x#x |#r =#e ${2 * a}#a`, note: tx("Divide both sides by 2.", "Teile beide Seiten durch 2.") },
      { math: `|#l x#x |#r =#e ${a}#a`, note: tx(`Which numbers are ${a} away from zero?`, `Welche Zahlen sind ${a} von der Null entfernt?`) },
      { math: `x_1#x =#e -#s ${a}#a \\quad x_2#x2 =#e2 ${a}#a2`, note: tx(`${a} to the left and ${a} to the right of zero.`, `${a} links und ${a} rechts von der Null.`) },
    ];
    slips.push({ values: two(2 * a), title: tx("Forgot to divide", "Teilen vergessen"), say: tx(`$|x|$ is multiplied by 2. Divide first: $|x| = ${a}$.`, `$|x|$ wird mit 2 multipliziert. Teile zuerst: $|x| = ${a}$.`) });
    slips.push({ values: [a], title: ONE_MORE, say: tx(`$|${-a}| = ${a}$ too.`, `Auch $|${-a}| = ${a}$.`), close: true });
  } else {
    const sq = rng.chance(0.5);
    task = sq ? "x^2 = 0" : `${ab("x")} = 0`;
    values = [0];
    frames = [{ math: sq ? "x#x ^{2#p} =#e 0#a" : "|#l x#x |#r =#e 0#a", note: tx("Only one number is $0$ away from zero: zero itself.", "Nur eine Zahl ist $0$ von der Null entfernt: die Null selbst.") }];
    slips.push({ values: [], title: tx("There is a solution", "Es gibt eine Lösung"), say: tx("Try $x = 0$: it works! It's the only solution, because $0$ has no opposite.", "Probier $x = 0$: Das passt! Es ist die einzige Lösung, denn $0$ hat keine Gegenzahl.") });
  }
  frames.push({ math: setOf(values), note: values.length === 2 ? tx("Two solutions.", "Zwei Lösungen.") : values.length === 1 ? tx("Exactly one solution.", "Genau eine Lösung.") : tx("No solution: the solution set is empty.", "Keine Lösung: Die Lösungsmenge ist leer.") });
  const mistakes: Mistake[] = slips
    .filter((s) => JSON.stringify([...s.values].sort()) !== JSON.stringify([...values].sort()))
    .map((s) => ({ when: { kind: "solutions", variable: "x", values: s.values, allowNone: true }, title: s.title, say: s.say, ...(s.close ? { close: true } : {}) }));
  return {
    instruction: tx("Solve the equation", "Löse die Gleichung"),
    math: task,
    answer: { kind: "solutions", variable: "x", values, allowNone: true },
    hint: kind.startsWith("sq") ? tx("Think: which numbers squared give the right side? Watch out for the negative one.", "Überleg: Welche Zahlen ergeben quadriert die rechte Seite? Denk an die negative.") : tx("Think of distances on the number line: a distance is never negative.", "Denk an Abstände auf der Zahlengeraden: Ein Abstand ist nie negativ."),
    solution: frames,
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Practice: powers with negative bases

type PowerTerm = { src: string; v: number; why: Text };

/** One power term in one of the classic forms, with its value and the reason. */
function powerTerm(a: number, n: number, form: "br" | "nobr" | "minusbr"): PowerTerm {
  const pos = a ** n;
  if (form === "br") {
    const v = n % 2 ? -pos : pos;
    return {
      src: `(-${a})^{${n}}`,
      v,
      why: n % 2 ? tx(`Odd exponent: $(-${a})^{${n}} = ${v}$ is negative.`, `Ungerader Exponent: $(-${a})^{${n}} = ${v}$ ist negativ.`) : tx(`Even exponent: the minus signs pair up, $(-${a})^{${n}} = ${v}$.`, `Gerader Exponent: Die Minuszeichen bilden Paare, $(-${a})^{${n}} = ${v}$.`),
    };
  }
  if (form === "nobr")
    return { src: `-${a}^{${n}}`, v: -pos, why: tx(`Without brackets the exponent belongs only to the ${a}: $-${a}^{${n}} = -${pos}$.`, `Ohne Klammer gehört der Exponent nur zur ${a}: $-${a}^{${n}} = -${pos}$.`) };
  const inner = n % 2 ? -pos : pos;
  return { src: `-(-${a})^{${n}}`, v: -inner, why: tx(`$(-${a})^{${n}} = ${inner}$, and the minus in front turns it into $${-inner}$.`, `$(-${a})^{${n}} = ${inner}$, und das Minus davor macht daraus $${-inner}$.`) };
}

function powerTask(rng: Rng): Exercise {
  const kind = rng.pick(["br", "br", "nobr", "minusbr", "one", "sum", "sum"] as const);
  const pick = () => {
    const a = rng.pick([2, 2, 3, 3, 4, 5, 10]);
    const maxN = a === 2 ? 7 : a === 3 ? 5 : a === 10 ? 5 : 4;
    return { a, n: rng.int(2, maxN) };
  };
  if (kind === "one") {
    const n = rng.pick([7, 10, 15, 20, 51, 99, 100, 2025, 2026]);
    const minus = rng.chance(0.3);
    const v = minus ? -1 : n % 2 ? -1 : 1;
    const src = minus ? `-1^{${n}}` : `(-1)^{${n}}`;
    return {
      instruction: CALC,
      math: src,
      answer: numberAnswer(v),
      hint: tx("Don't multiply it all out. Is the exponent even or odd? Are there brackets?", "Nicht alles ausrechnen. Ist der Exponent gerade oder ungerade? Gibt es eine Klammer?"),
      solution: [
        {
          math: `${src} = ${v}`,
          note: minus
            ? tx(`Without brackets: $1^{${n}} = 1$, and the minus stays in front.`, `Ohne Klammer: $1^{${n}} = 1$, und das Minus bleibt davor.`)
            : tx(`${n} is ${n % 2 ? "odd: one minus sign is left over" : "even: all minus signs pair up"}.`, `${n} ist ${n % 2 ? "ungerade: Ein Minuszeichen bleibt übrig" : "gerade: Alle Minuszeichen bilden Paare"}.`),
        },
      ],
      mistakes: numberMistakes(v, [
        { v: -v, title: minus ? tx("Brackets make the difference", "Die Klammer macht den Unterschied") : tx("Even or odd?", "Gerade oder ungerade?"), say: minus ? tx(`Without brackets the exponent only belongs to the $1$: $-1^{${n}} = -(1^{${n}}) = -1$.`, `Ohne Klammer gehört der Exponent nur zur $1$: $-1^{${n}} = -(1^{${n}}) = -1$.`) : tx(`Is ${n} even or odd? Even: positive. Odd: negative.`, `Ist ${n} gerade oder ungerade? Gerade: positiv. Ungerade: negativ.`) },
        { v: minus ? -n : n % 2 ? -n : n, title: tx("Exponent is not a factor", "Exponent ist kein Faktor"), say: tx(`The exponent counts the factors: $(-1)^{${n}}$ is $(-1) \\cdot (-1) \\cdot …$, ${n} times.`, `Der Exponent zählt die Faktoren: $(-1)^{${n}}$ ist $(-1) \\cdot (-1) \\cdot …$, ${n}-mal.`) },
      ]),
    };
  }
  if (kind === "sum") {
    for (let i = 0; i < 40; i++) {
      const p = pick();
      const q = pick();
      if (p.a > 5 || q.a > 5) continue;
      const t1 = powerTerm(p.a, p.n, rng.pick(["br", "nobr"] as const));
      const t2 = powerTerm(q.a, q.n, rng.pick(["br", "nobr", "minusbr"] as const));
      if (t1.src === t2.src || Math.abs(t1.v) > 100 || Math.abs(t2.v) > 100) continue;
      const v = t1.v + t2.v;
      // The typical wrong value of a term: the sign flipped (−a^n read as (−a)^n, parity mixed up, outer minus lost).
      const slipOf = (tm: PowerTerm, k: number) => (tm.src.startsWith("-") && !tm.src.startsWith("-(") && k % 2 === 1 ? null : -tm.v);
      const wrong1 = slipOf(t1, p.n);
      const wrong2 = slipOf(t2, q.n);
      const t2plain = t2.src.startsWith("-") ? t2.src : `+ ${t2.src}`;
      return {
        instruction: CALC,
        math: `${t1.src} ${t2plain.startsWith("-") ? `- ${t2.src.slice(1)}` : t2plain}`,
        answer: numberAnswer(v),
        hint: tx("Work out each power on its own. Brackets or not? Even or odd exponent?", "Berechne jede Potenz für sich. Mit oder ohne Klammer? Gerader oder ungerader Exponent?"),
        solution: [
          { math: `${t1.src} ${t2plain.startsWith("-") ? `- ${t2.src.slice(1)}` : t2plain}`, note: tx("Powers first, each on its own.", "Zuerst die Potenzen, jede für sich.") },
          { math: `${par(t1.v)} + ${par(t2.v)}`.replace(/^\((-\d+)\)/, "$1"), note: tx(`${(t1.why as { en: string }).en} ${(t2.why as { en: string }).en}`, `${(t1.why as { de: string }).de} ${(t2.why as { de: string }).de}`) },
          { math: `${t1.v} ${t2.v < 0 ? "-" : "+"} ${Math.abs(t2.v)} = ${v}`, note: tx(`Result: $${v}$.`, `Ergebnis: $${v}$.`) },
        ],
        mistakes: numberMistakes(v, [
          wrong1 !== null && { v: wrong1 + t2.v, title: tx("Check the first power", "Prüf die erste Potenz"), say: t1.why },
          wrong2 !== null && { v: t1.v + wrong2, title: tx("Check the second power", "Prüf die zweite Potenz"), say: t2.why },
          wrong1 !== null && wrong2 !== null && { v: wrong1 + wrong2, title: tx("Two sign slips", "Zwei Vorzeichenfehler"), say: tx(`${(t1.why as { en: string }).en} ${(t2.why as { en: string }).en}`, `${(t1.why as { de: string }).de} ${(t2.why as { de: string }).de}`) },
        ]),
      };
    }
  }
  const { a, n } = pick();
  const form = kind === "sum" ? "br" : kind;
  const term = powerTerm(a, n, form);
  const factors = Array.from({ length: n }, () => (form === "nobr" ? String(a) : `(-${a})`)).join(" \\cdot ");
  const chain = form === "br" ? factors : form === "nobr" ? `-(${factors})` : `-[${factors}]`;
  return {
    instruction: CALC,
    math: term.src,
    answer: numberAnswer(term.v),
    hint: form === "nobr" ? tx("Careful: is the minus part of the base? Look for brackets.", "Vorsicht: Gehört das Minus zur Basis? Achte auf Klammern.") : tx("Count the factors: even exponent gives plus, odd gives minus.", "Zähl die Faktoren: Gerader Exponent ergibt plus, ungerader minus."),
    solution: [
      { math: `${term.src} = ${chain}`, note: form === "nobr" ? tx(`The base is ${a}, not $-${a}$: there are no brackets.`, `Die Basis ist ${a}, nicht $-${a}$: Es gibt keine Klammer.`) : tx(`The exponent ${n} says: ${n} factors.`, `Der Exponent ${n} sagt: ${n} Faktoren.`) },
      { math: `${term.src} = ${term.v}`, note: term.why },
    ],
    mistakes: numberMistakes(term.v, [
      form === "nobr" && n % 2 === 0 && { v: a ** n, title: tx("Brackets make the difference", "Die Klammer macht den Unterschied"), say: tx(`That would be $(-${a})^{${n}}$. Without brackets, the minus is not part of the base.`, `Das wäre $(-${a})^{${n}}$. Ohne Klammer gehört das Minus nicht zur Basis.`) },
      form !== "nobr" && { v: -term.v, title: tx("Even or odd?", "Gerade oder ungerade?"), say: term.why },
      { v: Math.sign(term.v) * a * n, title: tx("Exponent is not a factor", "Exponent ist kein Faktor"), say: tx(`The exponent counts the factors: $${a}^{${n}}$ means ${n} factors ${a}, not $${a} \\cdot ${n}$.`, `Der Exponent zählt die Faktoren: $${a}^{${n}}$ heißt ${n}-mal der Faktor ${a}, nicht $${a} \\cdot ${n}$.`) },
    ]),
  };
}

/** Which power term is largest / smallest / the only negative one? */
function powerChoiceTask(rng: Rng): Exercise {
  for (let i = 0; i < 60; i++) {
    const a = rng.pick([2, 3]);
    const pool: PowerTerm[] = [
      powerTerm(a, 2, "br"),
      powerTerm(a, 2, "nobr"),
      powerTerm(a, 3, "br"),
      powerTerm(a, 3, "minusbr"),
      powerTerm(a, 4, "br"),
      powerTerm(a, 4, "nobr"),
      powerTerm(a, 2, "minusbr"),
      { src: `${a}^{3}`, v: a ** 3, why: tx(`$${a}^{3} = ${a ** 3}$.`, `$${a}^{3} = ${a ** 3}$.`) },
    ];
    const ask = rng.pick(["max", "min", "neg"] as const);
    let chosen: PowerTerm[];
    if (ask === "neg") {
      const neg = rng.pick(pool.filter((p) => p.v < 0));
      const pos = rng.shuffle(pool.filter((p) => p.v > 0)).slice(0, 3);
      chosen = [neg, ...pos];
    } else chosen = rng.shuffle(pool).slice(0, 4);
    const vals = chosen.map((c) => c.v);
    if (new Set(vals).size !== 4) continue;
    const target = ask === "max" ? Math.max(...vals) : ask === "min" ? Math.min(...vals) : vals.find((v) => v < 0)!;
    const opts: Opt[] = chosen.map((c) =>
      c.v === target
        ? { text: `$${c.src}$`, ok: true }
        : {
            text: `$${c.src}$`,
            title: tx("Check this term", "Prüf diesen Term"),
            say: tx(`${(c.why as { en: string }).en}${ask === "neg" ? "" : ` There is a ${ask === "max" ? "larger" : "smaller"} value.`}`, `${(c.why as { de: string }).de}${ask === "neg" ? "" : ` Es gibt einen ${ask === "max" ? "größeren" : "kleineren"} Wert.`}`),
          },
    );
    const { answer, mistakes } = choiceOf(opts, rng);
    const sorted = [...chosen].sort((x, y) => x.v - y.v);
    return {
      instruction: ask === "max" ? tx("Which term has the largest value?", "Welcher Term hat den größten Wert?") : ask === "min" ? tx("Which term has the smallest value?", "Welcher Term hat den kleinsten Wert?") : tx("Which term is negative?", "Welcher Term ist negativ?"),
      answer,
      hint: tx("Work out each term. Brackets or not? Even or odd exponent?", "Berechne jeden Term. Mit oder ohne Klammer? Gerader oder ungerader Exponent?"),
      solution: [
        { math: chosen.map((c) => `${c.src} = ${c.v}`).join(" \\\\ "), note: tx("Each term worked out.", "Jeder Term ausgerechnet.") },
        { math: sorted.map((c) => c.src).join(" < "), note: ask === "neg" ? tx(`Only $${chosen.find((c) => c.v === target)!.src} = ${target}$ is negative.`, `Nur $${chosen.find((c) => c.v === target)!.src} = ${target}$ ist negativ.`) : tx(`Sorted by size. ${ask === "max" ? "Largest" : "Smallest"}: $${target}$.`, `Der Größe nach geordnet. ${ask === "max" ? "Am größten" : "Am kleinsten"}: $${target}$.`) },
      ],
      mistakes,
    };
  }
  return powerTask(rng);
}

// ---------------------------------------------------------------------------
// Practice: calculating cleverly

function cleverTask(rng: Rng): Exercise {
  const instruction = tx("Calculate cleverly", "Rechne geschickt");
  const kind = rng.pick(["sum", "sum", "product", "product", "dist", "dist", "near"] as const);
  if (kind === "sum") {
    let p = rng.int(12, 89);
    if (p % 10 === 0) p += 3;
    const u = rng.int(1, 9);
    let q = 10 * rng.int(2, 9);
    if (q + u === p) q += 10;
    const s = rng.sign();
    const terms = [-p, p, s * (q + u), -s * u];
    const order = rng.shuffle([0, 1, 2, 3]);
    const shown = order.map((i) => terms[i]);
    const src = (list: number[], keys: number[]) => list.map((v, j) => `${j === 0 ? (v < 0 ? `-#s${keys[j]} ` : "") : v < 0 ? `-#s${keys[j]} ` : `+#s${keys[j]} `}${Math.abs(v)}#n${keys[j]}`).join(" ");
    const v = s * q;
    return {
      instruction,
      math: strip(src(shown, order)),
      answer: numberAnswer(v),
      hint: tx("Look for partners: two numbers that cancel, or that give a round number.", "Such Partner: zwei Zahlen, die sich aufheben oder eine glatte Zahl ergeben."),
      solution: [
        { math: src(shown, order), note: tx(`Partners: $${-p}$ and $${p}$ cancel, $${terms[2]}$ and $${terms[3]}$ give a round number.`, `Partner: $${-p}$ und $${p}$ heben sich auf, $${terms[2]}$ und $${terms[3]}$ ergeben eine glatte Zahl.`) },
        { math: src(terms, [0, 1, 2, 3]), note: tx("**Commutative law**: swap the summands, each with its sign.", "**Kommutativgesetz**: Vertausch die Summanden, jeden mit seinem Vorzeichen.") },
        { math: `0#n0 ${v < 0 ? "-" : "+"}#s2 ${q}#n2`, note: tx(`**Associative law**: group the partners. $${-p} + ${p} = 0$ and $${terms[2]} ${terms[3] < 0 ? "-" : "+"} ${Math.abs(terms[3])} = ${v}$.`, `**Assoziativgesetz**: Fass die Partner zusammen. $${-p} + ${p} = 0$ und $${terms[2]} ${terms[3] < 0 ? "-" : "+"} ${Math.abs(terms[3])} = ${v}$.`) },
        { math: `${kn(v, "n2")}`, note: tx(`Result: $${v}$.`, `Ergebnis: $${v}$.`) },
      ],
      mistakes: numberMistakes(v, [
        { v: v - 2 * terms[3], title: tx("A sign got lost", "Ein Vorzeichen ging verloren"), say: tx(`Each number takes its sign along when you move it: $${terms[3]}$ stays $${terms[3]}$.`, `Jede Zahl nimmt beim Verschieben ihr Vorzeichen mit: $${terms[3]}$ bleibt $${terms[3]}$.`) },
        { v: -v, title: tx("Check the sign", "Prüf das Vorzeichen"), say: tx(`$${terms[2]}$ and $${terms[3]}$ together: which one is bigger, the plus part or the minus part?`, `$${terms[2]}$ und $${terms[3]}$ zusammen: Was ist größer, der Plus-Teil oder der Minus-Teil?`), close: true },
      ]),
    };
  }
  if (kind === "product") {
    const [x, y] = rng.pick([
      [4, 25],
      [2, 5],
      [5, 20],
      [2, 50],
      [8, 125],
      [4, 5],
    ]);
    const m = rng.int(3, 19);
    const fs = [x * rng.sign(), m * rng.sign(), y * rng.sign()];
    if (fs.every((f) => f > 0)) fs[0] = -fs[0];
    const order = rng.shuffle([0, 1, 2]);
    while (order[1] !== 1 && rng.chance(0.7)) order.push(order.shift()!);
    const shown = order.map((i) => fs[i]);
    const v = fs[0] * fs[1] * fs[2];
    const pair = fs[0] * fs[2];
    const negs = fs.filter((f) => f < 0).length;
    return {
      instruction,
      math: shown.map((f) => par(f)).join(" \\cdot "),
      answer: numberAnswer(v),
      hint: tx(`Find the two factors that give a round number together.`, `Such die beiden Faktoren, die zusammen eine glatte Zahl ergeben.`),
      solution: [
        { math: shown.map((f, j) => kp(f, `f${order[j]}`)).join(" \\cdot "), note: tx(`$${x}$ and $${y}$ are great partners: $${x} \\cdot ${y} = ${x * y}$.`, `$${x}$ und $${y}$ sind tolle Partner: $${x} \\cdot ${y} = ${x * y}$.`) },
        { math: `(${kp(fs[0], "f0")} \\cdot ${kp(fs[2], "f2")})#g \\cdot ${kp(fs[1], "f1")}`, note: tx("Swap and group: commutative and associative law.", "Vertauschen und zusammenfassen: Kommutativ- und Assoziativgesetz.") },
        { math: `${kp(pair, "p")} \\cdot ${kp(fs[1], "f1")}`, note: tx(`$${par(fs[0])} \\cdot ${par(fs[2])} = ${pair}$.`, `$${par(fs[0])} \\cdot ${par(fs[2])} = ${pair}$.`) },
        { math: kn(v, "r"), note: tx(`Result: $${v}$.`, `Ergebnis: $${v}$.`) },
      ],
      mistakes: numberMistakes(v, [{ v: -v, title: tx("Count the minus signs", "Zähl die Minuszeichen"), say: tx(`There are ${negs} minus signs: ${negs % 2 ? "odd, so negative" : "even, so positive"}.`, `Es sind ${negs} Minuszeichen: ${negs % 2 ? "ungerade, also negativ" : "gerade, also positiv"}.`) }]),
    };
  }
  if (kind === "dist") {
    let a = rng.sign() * rng.int(3, 49);
    if (a % 10 === 0) a += a > 0 ? 3 : -3;
    const T = rng.pick([-10, -10, 10, -100, 100]);
    let b = 0;
    for (let i = 0; i < 20; i++) {
      b = rng.sign() * rng.int(2, Math.abs(T) === 10 ? 9 : 95);
      if (b !== T - b && b % 10 !== 0 && T - b !== 0) break;
    }
    const c = T - b;
    const v = a * T;
    return {
      instruction,
      math: `${par(a)} \\cdot ${par(b)} + ${par(a)} \\cdot ${par(c)}`,
      answer: numberAnswer(v),
      hint: tx("Both products share a factor. Factor it out: distributive law.", "Beide Produkte haben einen gemeinsamen Faktor. Klammer ihn aus: Distributivgesetz."),
      solution: [
        { math: `${kp(a, "a")} \\cdot#d1 ${kp(b, "b")} +#p ${kp(a, "a2")} \\cdot#d2 ${kp(c, "c")}`, highlight: ["a", "a2"], note: tx(`Both products contain the factor $${a}$.`, `Beide Produkte enthalten den Faktor $${a}$.`) },
        { math: `${kp(a, "a")} \\cdot#d1 (${kp(b, "b")} +#p ${kp(c, "c")})#k`, note: tx("**Distributive law**: factor it out. Each number keeps its sign.", "**Distributivgesetz**: ausklammern. Jede Zahl behält ihr Vorzeichen.") },
        { math: `${kp(a, "a")} \\cdot#d1 ${kp(T, "t")}`, note: tx(`$${b} + ${par(c)} = ${T}$: a round number!`, `$${b} + ${par(c)} = ${T}$: eine glatte Zahl!`) },
        { math: kn(v, "r"), note: tx(`Result: $${v}$.`, `Ergebnis: $${v}$.`) },
      ],
      mistakes: numberMistakes(v, [
        c < 0 && { v: a * (b - c), title: tx("A sign got lost", "Ein Vorzeichen ging verloren"), say: tx(`In the bracket, $${par(c)}$ keeps its sign: $${par(a)} \\cdot (${b} + ${par(c)})$.`, `In der Klammer behält $${par(c)}$ sein Vorzeichen: $${par(a)} \\cdot (${b} + ${par(c)})$.`) },
        { v: -v, title: tx("Check the sign", "Prüf das Vorzeichen"), say: tx(`$${par(a)} \\cdot ${par(T)}$: same or different signs?`, `$${par(a)} \\cdot ${par(T)}$: gleiche oder verschiedene Vorzeichen?`), close: true },
      ]),
    };
  }
  // a · 99 = a · (100 − 1)
  const a = rng.sign() * rng.int(3, 19);
  const near = rng.pick([99, 101, 98, 102]);
  const off = near - 100;
  const v = a * near;
  return {
    instruction,
    math: `${par(a)} \\cdot ${near}`,
    answer: numberAnswer(v),
    hint: tx(`Write ${near} as $100 ${off < 0 ? "-" : "+"} ${Math.abs(off)}$ and use the distributive law.`, `Schreib ${near} als $100 ${off < 0 ? "-" : "+"} ${Math.abs(off)}$ und nutze das Distributivgesetz.`),
    solution: [
      { math: `${kp(a, "a")} \\cdot#d ${near}#n`, note: tx(`${near} is close to 100.`, `${near} liegt nah bei 100.`) },
      { math: `${kp(a, "a")} \\cdot#d (100#h ${off < 0 ? "-" : "+"}#o ${Math.abs(off)}#m)#k`, note: tx(`$${near} = 100 ${off < 0 ? "-" : "+"} ${Math.abs(off)}$.`, `$${near} = 100 ${off < 0 ? "-" : "+"} ${Math.abs(off)}$.`) },
      { math: `${par(a)} \\cdot 100 ${off < 0 ? "-" : "+"} ${par(a)} \\cdot ${Math.abs(off)}`, note: tx("Distributive law: multiply both parts.", "Distributivgesetz: beide Teile malnehmen.") },
      { math: `${100 * a} ${off * a < 0 ? "-" : "+"} ${Math.abs(off * a)} = ${v}`, note: tx(`$${par(a)} \\cdot ${par(off)} = ${a * off}$. Result: $${v}$.`, `$${par(a)} \\cdot ${par(off)} = ${a * off}$. Ergebnis: $${v}$.`) },
    ],
    mistakes: numberMistakes(v, [
      { v: 100 * a - off * a, title: tx("Sign slip", "Vorzeichenfehler"), say: tx(`Watch the second product: $${par(a)} \\cdot ${par(off)} = ${a * off}$.`, `Achte auf das zweite Produkt: $${par(a)} \\cdot ${par(off)} = ${a * off}$.`) },
      { v: -v, title: tx("Check the sign", "Prüf das Vorzeichen"), say: tx(`$${par(a)} \\cdot ${near}$: ${a < 0 ? "minus times plus is minus" : "plus times plus is plus"}.`, `$${par(a)} \\cdot ${near}$: ${a < 0 ? "Minus mal plus ergibt minus" : "Plus mal plus ergibt plus"}.`), close: true },
    ]),
  };
}

const COMM: Text = tx("Commutative law", "Kommutativgesetz");
const ASSOC: Text = tx("Associative law", "Assoziativgesetz");
const DIST: Text = tx("Distributive law", "Distributivgesetz");
const NOLAW: Text = tx("Wrong: you can't swap in a subtraction", "Falsch: Bei Minus darf man nicht tauschen");

function lawTask(rng: Rng): Exercise {
  const n = () => rng.sign() * rng.int(2, 12);
  const p = n();
  const q = -rng.int(2, 12);
  const r = n();
  const mulComm = rng.chance(0.5);
  const comm = mulComm ? `$${par(p)} \\cdot ${par(q)} = ${par(q)} \\cdot ${par(p)}$` : `$${p} + ${par(q)} = ${q} + ${par(p)}$`;
  const mulAssoc = rng.chance(0.5);
  const assoc = mulAssoc ? `$(${par(p)} \\cdot ${par(q)}) \\cdot ${par(r)} = ${par(p)} \\cdot (${par(q)} \\cdot ${par(r)})$` : `$(${p} + ${par(q)}) + ${par(r)} = ${p} + (${q} + ${par(r)})$`;
  const dist = `$${par(q)} \\cdot (${Math.abs(p)} + ${par(r)}) = ${par(q)} \\cdot ${Math.abs(p)} + ${par(q)} \\cdot ${par(r)}$`;
  const withWrong = rng.chance(0.5);
  const a = rng.int(3, 15);
  const wrong = `$${a} - ${par(q)} = ${q} - ${a}$`;
  const pairs: [Text, Text][] = [
    [comm, COMM],
    [assoc, ASSOC],
    [dist, DIST],
  ];
  if (withWrong) pairs.push([wrong, NOLAW]);
  const mistakes: Mistake[] = [
    { when: { kind: "match", pairs: [[comm, ASSOC], [assoc, COMM]] }, title: tx("Swapped the two names", "Die beiden Namen vertauscht"), say: tx("**Commutative** means swapping places (vertauschen). **Associative** means moving the brackets, grouping differently.", "**Kommutativ** heißt Plätze tauschen (Vertauschungsgesetz). **Assoziativ** heißt Klammern versetzen, also anders zusammenfassen (Verbindungsgesetz).") },
  ];
  if (withWrong)
    mistakes.push({
      when: { kind: "match", pairs: [[wrong, COMM]] },
      title: tx("Subtraction can't be swapped", "Minus darf man nicht tauschen"),
      say: tx(`Check it: $${a} - ${par(q)} = ${a - q}$, but $${q} - ${a} = ${q - a}$. With subtraction, swapping changes the result.`, `Rechne nach: $${a} - ${par(q)} = ${a - q}$, aber $${q} - ${a} = ${q - a}$. Bei Minus ändert Tauschen das Ergebnis.`),
    });
  else mistakes.push({ when: { kind: "match", pairs: [[dist, ASSOC]] }, title: tx("Look at the bracket", "Schau auf die Klammer"), say: tx("A factor in front of a bracket with a sum, multiplied into both parts: that's the **distributive** law.", "Ein Faktor vor einer Klammer mit einer Summe, in beide Teile hineinmultipliziert: Das ist das **Distributivgesetz**.") });
  return {
    instruction: tx("Which law is used?", "Welches Gesetz wird benutzt?"),
    answer: { kind: "match", pairs, ...(withWrong ? {} : { distractors: [NOLAW] }) },
    hint: tx("Swapped places? Moved brackets? A factor multiplied into a bracket?", "Plätze getauscht? Klammern versetzt? Ein Faktor in eine Klammer hineinmultipliziert?"),
    solution: [
      { math: comm.slice(1, -1), note: tx("Same numbers, swapped places: **commutative law**.", "Gleiche Zahlen, Plätze getauscht: **Kommutativgesetz**.") },
      { math: assoc.slice(1, -1), note: tx("Same order, the brackets moved: **associative law**.", "Gleiche Reihenfolge, die Klammern sind versetzt: **Assoziativgesetz**.") },
      { math: dist.slice(1, -1), note: tx("A factor multiplied into a sum: **distributive law**.", "Ein Faktor in eine Summe hineinmultipliziert: **Distributivgesetz**.") },
      ...(withWrong ? [{ math: `${wrong.slice(1, -1).replace("=", "\\ne")}`, note: tx(`$${a - q} \\ne ${q - a}$: with subtraction you must **not** swap.`, `$${a - q} \\ne ${q - a}$: Bei Minus darfst du **nicht** tauschen.`) }] : []),
    ],
    mistakes,
  };
}

/** Select every true statement. */
function truthTask(rng: Rng): Exercise {
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  const n = rng.int(10, 40);
  const c = b + a;
  const even = n % 2 === 0;
  const bank: { text: string; ok: boolean; classic?: boolean; why: Text }[] = [
    { text: `$|-${a}| = ${a}$`, ok: true, why: tx(`The distance from $-${a}$ to $0$ is ${a}.`, `Der Abstand von $-${a}$ zur $0$ ist ${a}.`) },
    { text: `$|-${a}| = -${a}$`, ok: false, why: tx(`An absolute value is never negative: $|-${a}| = ${a}$.`, `Ein Betrag ist nie negativ: $|-${a}| = ${a}$.`) },
    { text: `$-${a}^2 = ${a * a}$`, ok: false, classic: true, why: tx(`No brackets: $-${a}^2 = -(${a}^2) = -${a * a}$.`, `Keine Klammer: $-${a}^2 = -(${a}^2) = -${a * a}$.`) },
    { text: `$(-${a})^2 = ${a * a}$`, ok: true, why: tx("Minus times minus is plus.", "Minus mal minus ergibt plus.") },
    { text: `$(-1)^{${n}} = ${even ? 1 : -1}$`, ok: true, why: tx(`${n} is ${even ? "even" : "odd"}.`, `${n} ist ${even ? "gerade" : "ungerade"}.`) },
    { text: `$(-1)^{${n}} = ${even ? -1 : 1}$`, ok: false, why: tx(`${n} is ${even ? "even, so the result is $1$" : "odd, so the result is $-1$"}.`, `${n} ist ${even ? "gerade, also ist das Ergebnis $1$" : "ungerade, also ist das Ergebnis $-1$"}.`) },
    { text: `$|${a} - ${c}| = |${c} - ${a}|$`, ok: true, why: tx("A distance doesn't depend on the order: both sides are " + b + ".", "Ein Abstand hängt nicht von der Reihenfolge ab: Beide Seiten sind " + b + ".") },
    { text: `$|${a} + (-${c})| = ${a} + ${c}$`, ok: false, why: tx(`Inside first: $${a} + (-${c}) = -${b}$, so the absolute value is ${b}.`, `Zuerst innen: $${a} + (-${c}) = -${b}$, der Betrag ist also ${b}.`) },
    { text: `$(-${a})^3 = -${a}^3$`, ok: true, why: tx(`Odd exponent: both sides are $-${a ** 3}$.`, `Ungerader Exponent: Beide Seiten sind $-${a ** 3}$.`) },
    { text: `$-(-${a}) = ${a}$`, ok: true, why: tx(`The opposite of $-${a}$ is ${a}.`, `Die Gegenzahl von $-${a}$ ist ${a}.`) },
    { text: `$-|-${a}| = ${a}$`, ok: false, why: tx(`The minus in front stays: $-|-${a}| = -${a}$.`, `Das Minus davor bleibt: $-|-${a}| = -${a}$.`) },
  ];
  for (let i = 0; i < 40; i++) {
    const pick = rng.shuffle(bank).slice(0, 5);
    const sameNumbers = new Set(pick.map((p) => p.text.replace(/= .*/, ""))).size !== 5;
    if (sameNumbers || pick.every((p) => p.ok) || pick.every((p) => !p.ok)) continue;
    const options = pick.map((p) => p.text);
    const correct = pick.map((p, j) => (p.ok ? j : -1)).filter((j) => j >= 0);
    const mistakes: Mistake[] = [];
    const classic = pick.findIndex((p) => p.classic);
    if (classic >= 0) mistakes.push({ when: { kind: "multi", options, correct: [...correct, classic].sort((x, y) => x - y) }, title: tx("The classic trap", "Die klassische Falle"), say: tx(`$-${a}^2$ has no brackets: the square belongs only to the ${a}. So $-${a}^2 = -${a * a}$.`, `$-${a}^2$ hat keine Klammer: Das Quadrat gehört nur zur ${a}. Also ist $-${a}^2 = -${a * a}$.`) });
    const minusAbs = pick.findIndex((p) => p.text.startsWith("$-|"));
    if (minusAbs >= 0) mistakes.push({ when: { kind: "multi", options, correct: [...correct, minusAbs].sort((x, y) => x - y) }, title: tx("The outer minus stays", "Das Minus davor bleibt"), say: tx(`$|-${a}| = ${a}$, but the minus in front stays: $-|-${a}| = -${a}$.`, `$|-${a}| = ${a}$, aber das Minus davor bleibt: $-|-${a}| = -${a}$.`) });
    const real = mistakes.filter((m) => m.when.kind === "multi" && m.when.correct.length !== correct.length);
    return {
      instruction: tx("Select all true statements", "Wähle alle wahren Aussagen aus"),
      answer: { kind: "multi", options, correct },
      hint: tx("Check each one on its own: brackets, signs, absolute values.", "Prüf jede Aussage für sich: Klammern, Vorzeichen, Beträge."),
      solution: pick.map((p) => ({
        math: p.text.slice(1, -1).replace(/ = /, p.ok ? " = " : " \\ne "),
        note: tx(`${p.ok ? "True" : "False"}: ${(p.why as { en: string }).en}`, `${p.ok ? "Wahr" : "Falsch"}: ${(p.why as { de: string }).de}`),
      })),
      mistakes: real,
    };
  }
  return powerTask(rng);
}

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [1.0, () => absTask(rng)],
    [0.9, () => distanceTask(rng)],
    [1.3, () => solveTask(rng)],
    [1.2, () => powerTask(rng)],
    [0.7, () => powerChoiceTask(rng)],
    [1.3, () => cleverTask(rng)],
    [0.6, () => lawTask(rng)],
    [0.6, () => truthTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const distanceCheck: Exercise = {
  instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
  text: tx("In one year, the lowest temperature in a town was $-17$ °C and the highest $29$ °C. How big is the difference between them?", "In einem Jahr lag die tiefste Temperatur in einer Stadt bei $-17$ °C und die höchste bei $29$ °C. Wie groß ist der Unterschied?"),
  answer: numberAnswer(46, DEG),
  hint: tx("The difference is the distance between $-17$ and $29$: $|29 - (-17)|$.", "Der Unterschied ist der Abstand zwischen $-17$ und $29$: $|29 - (-17)|$."),
  solution: [
    { math: ab("29#b -#m (-#as 17#a)#ab", "D"), note: tx("Distance = absolute value of the difference.", "Abstand = Betrag der Differenz.") },
    { math: ab("29#b +#as 17#a", "D"), note: tx("Two minus signs make a plus.", "Zwei Minuszeichen ergeben plus.") },
    { math: `${ab("29#b +#as 17#a", "D")} =#e 46#r "°C"#u`, note: tx("17 degrees up to zero and 29 more: 46 degrees.", "17 Grad bis zur Null und 29 weitere: 46 Grad.") },
  ],
  mistakes: numberMistakes(
    46,
    [
      { v: 12, title: tx("Subtracted the digits", "Ziffern abgezogen"), say: tx("The two temperatures lie on **different sides** of zero. Count 17 up to zero and then 29 more.", "Die beiden Temperaturen liegen auf **verschiedenen Seiten** der Null. Zähl 17 bis zur Null und dann noch 29.") },
      { v: -46, title: tx("A distance is positive", "Ein Abstand ist positiv"), say: tx("$-17 - 29 = -46$, but a difference is a distance: take the absolute value.", "$-17 - 29 = -46$, aber ein Unterschied ist ein Abstand: Nimm den Betrag."), close: true },
    ],
    DEG,
  ),
};

const squareCheck: Exercise = {
  instruction: tx("Solve the equation", "Löse die Gleichung"),
  math: "x^2 = 49",
  answer: { kind: "solutions", variable: "x", values: [-7, 7], allowNone: true },
  hint: tx("Which numbers squared give 49? There are two.", "Welche Zahlen ergeben quadriert 49? Es sind zwei."),
  solution: [
    { math: "x#x ^{2#p} =#e 49#a", note: tx("Which numbers squared give 49?", "Welche Zahlen ergeben quadriert 49?") },
    { math: "x_1#x =#e -#s 7#a \\quad x_2#x2 =#e2 7#a2", note: tx("$7^2 = 49$ and $(-7)^2 = 49$ too.", "$7^2 = 49$ und auch $(-7)^2 = 49$.") },
    { math: setOf([-7, 7]), note: tx("Two solutions.", "Zwei Lösungen.") },
  ],
  mistakes: [
    { when: { kind: "solutions", variable: "x", values: [7], allowNone: true }, title: tx("One solution is missing", "Eine Lösung fehlt"), say: tx("Nearly! $(-7)^2 = 49$ too, so there's a second solution.", "Fast! Auch $(-7)^2 = 49$, es gibt also eine zweite Lösung."), close: true },
    { when: { kind: "solutions", variable: "x", values: [24.5], allowNone: true }, title: tx("Squared is not doubled", "Quadrieren ist nicht verdoppeln"), say: tx("$x^2$ means $x \\cdot x$, not $2 \\cdot x$.", "$x^2$ heißt $x \\cdot x$, nicht $2 \\cdot x$.") },
    { when: { kind: "solutions", variable: "x", values: [], allowNone: true }, title: tx("There are solutions", "Es gibt Lösungen"), say: tx("$49$ is positive, so there are numbers whose square is 49. Try $7$.", "$49$ ist positiv, also gibt es Zahlen, deren Quadrat 49 ist. Probier mal $7$.") },
  ],
};

const powerCheck: Exercise = {
  instruction: CALC,
  math: "-3^2 + (-2)^3",
  answer: numberAnswer(-17),
  hint: tx("Without brackets, $-3^2 = -(3 \\cdot 3)$. With brackets, $(-2)^3 = (-2) \\cdot (-2) \\cdot (-2)$.", "Ohne Klammer ist $-3^2 = -(3 \\cdot 3)$. Mit Klammer ist $(-2)^3 = (-2) \\cdot (-2) \\cdot (-2)$."),
  solution: [
    { math: "-#a 3#b ^{2#e} +#p (-#cs 2#c)#k ^{3#f}", note: tx("Two powers. Look closely at the brackets.", "Zwei Potenzen. Schau genau auf die Klammern.") },
    { math: "-#a 9#b +#p (-#cs 8#c)#k", note: tx("$-3^2 = -9$ (no brackets: the minus stays in front) and $(-2)^3 = -8$ (odd exponent).", "$-3^2 = -9$ (ohne Klammer: das Minus bleibt davor) und $(-2)^3 = -8$ (ungerader Exponent).") },
    { math: "-#a 9#b -#cs 8#c", note: tx("Plus a negative number is minus.", "Plus eine negative Zahl ist minus.") },
    { math: "-#a 17#b", note: tx("Result: $-17$.", "Ergebnis: $-17$.") },
  ],
  mistakes: numberMistakes(-17, [
    { v: 1, title: tx("Brackets make the difference", "Die Klammer macht den Unterschied"), say: tx("$-3^2$ has no brackets: the square belongs only to the 3. So $-3^2 = -9$, not $9$.", "$-3^2$ hat keine Klammer: Das Quadrat gehört nur zur 3. Also ist $-3^2 = -9$, nicht $9$.") },
    { v: -1, title: tx("Even or odd?", "Gerade oder ungerade?"), say: tx("$(-2)^3$ has an odd exponent: one minus sign is left over, so it's $-8$.", "$(-2)^3$ hat einen ungeraden Exponenten: Ein Minus bleibt übrig, also $-8$.") },
    { v: 17, title: tx("Two sign slips", "Zwei Vorzeichenfehler"), say: tx("Both powers are negative here: $-3^2 = -9$ and $(-2)^3 = -8$.", "Beide Potenzen sind hier negativ: $-3^2 = -9$ und $(-2)^3 = -8$.") },
    { v: -15, title: tx("Exponent is not a factor", "Exponent ist kein Faktor"), say: tx("$2^3 = 2 \\cdot 2 \\cdot 2 = 8$, not $2 \\cdot 3 = 6$.", "$2^3 = 2 \\cdot 2 \\cdot 2 = 8$, nicht $2 \\cdot 3 = 6$.") },
  ]),
};

const distributiveCheck: Exercise = {
  instruction: tx("Calculate cleverly", "Rechne geschickt"),
  math: "47 \\cdot (-6) + 47 \\cdot (-4)",
  answer: numberAnswer(-470),
  hint: tx("Both products contain 47. Factor it out.", "Beide Produkte enthalten 47. Klammer die 47 aus."),
  solution: [
    { math: "47#a \\cdot#d1 (-#bs 6#b)#bb +#p 47#a2 \\cdot#d2 (-#cs 4#c)#cb", highlight: ["a", "a2"], note: tx("Both products contain the factor 47.", "Beide Produkte enthalten den Faktor 47.") },
    { math: "47#a \\cdot#d1 ((-#bs 6#b)#bb +#p (-#cs 4#c)#cb)#k", note: tx("Distributive law: factor out 47. Each number keeps its sign.", "Distributivgesetz: 47 ausklammern. Jede Zahl behält ihr Vorzeichen.") },
    { math: "47#a \\cdot#d1 (-#ts 10#t)#tb", note: tx("$(-6) + (-4) = -10$.", "$(-6) + (-4) = -10$.") },
    { math: "-#ts 470#a", note: tx("$47 \\cdot (-10) = -470$. No long multiplication needed!", "$47 \\cdot (-10) = -470$. Ganz ohne schriftliches Multiplizieren!") },
  ],
  mistakes: numberMistakes(-470, [
    { v: 470, title: tx("Check the sign", "Prüf das Vorzeichen"), say: tx("$47 \\cdot (-10)$: plus times minus is minus.", "$47 \\cdot (-10)$: Plus mal minus ergibt minus.") },
    { v: -94, title: tx("A sign got lost", "Ein Vorzeichen ging verloren"), say: tx("In the bracket both numbers keep their minus: $(-6) + (-4) = -10$, not $-2$.", "In der Klammer behalten beide Zahlen ihr Minus: $(-6) + (-4) = -10$, nicht $-2$.") },
  ]),
};

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Absolute value: the distance from 0", "Der Betrag: Abstand zur Null"),
      blob: tx("How far is it to zero? That's all the absolute value asks.", "Wie weit ist es bis zur Null? Mehr will der Betrag nicht wissen."),
      body: tx(
        "The **absolute value** $|a|$ is the distance of $a$ from $0$ on the number line. A distance is never negative, so $|a| \\ge 0$. The distance between two numbers $a$ and $b$ is $|a - b|$.",
        "Der **Betrag** $|a|$ ist der Abstand der Zahl $a$ von der $0$ auf der Zahlengeraden. Ein Abstand ist nie negativ, also gilt $|a| \\ge 0$. Der Abstand zweier Zahlen $a$ und $b$ ist $|a - b|$.",
      ),
      visual: {
        component: asVisual(NegLineFigure),
        props: {
          from: -6,
          to: 6,
          marks: [{ at: -5, tone: "blob" }, { at: 5, tone: "blob" }],
          braces: [
            { a: -5, b: 0, label: "|−5| = 5" },
            { a: 0, b: 5, label: "|5| = 5" },
          ],
          caption: tx("$-5$ and $5$ are both 5 away from zero.", "$-5$ und $5$ sind beide 5 von der Null entfernt."),
        },
      },
      frames: [
        { math: "|#l -#s 5#a |#r", note: tx('Read: "the absolute value of $-5$". How far is $-5$ from $0$?', "Lies: „Betrag von $-5$“. Wie weit ist $-5$ von der $0$ entfernt?") },
        { math: "|#l -#s 5#a |#r =#e 5#b", note: tx("5 steps. So $|-5| = 5$.", "5 Schritte. Also ist $|-5| = 5$.") },
        { math: "|#l 5#a |#r =#e 5#b \\quad |#l2 0#z |#r2 =#e2 0#z2", note: tx("$5$ is also 5 away: $|5| = 5$. And $|0| = 0$. Opposite numbers have the same absolute value.", "Auch $5$ ist 5 entfernt: $|5| = 5$. Und $|0| = 0$. Gegenzahlen haben denselben Betrag.") },
        { math: `${ab("3#p -#m (-#s 4#a)#k", "D")}`, note: tx("The distance between $3$ and $-4$: subtract and take the absolute value.", "Der Abstand von $3$ und $-4$: subtrahieren und den Betrag nehmen.") },
        { math: `${ab("3#p -#m (-#s 4#a)#k", "D")} =#e ${ab("7#r", "E")} =#e2 7#d`, note: tx("$3 - (-4) = 7$, so the distance is $7$.", "$3 - (-4) = 7$, der Abstand ist also $7$.") },
        { math: `${ab("-#s 4#a -#m 3#p", "D")} =#e ${ab("-#rs 7#r", "E")} =#e2 7#d`, note: tx("The other way round gives $-7$, but the absolute value is $7$ again. Order doesn't matter.", "Andersherum ergibt sich $-7$, der Betrag ist aber wieder $7$. Die Reihenfolge ist egal.") },
      ],
    },
    {
      type: "widget",
      title: tx("Measure distances on the number line", "Abstände auf der Zahlengeraden messen"),
      blob: tx("Drag a and b. The distance never goes negative, whichever way round you subtract.", "Zieh a und b. Der Abstand wird nie negativ, egal wie herum du subtrahierst."),
      body: tx(
        "Switch between the distances from $0$ and the distance between $a$ and $b$. Notice: $|a - b|$ and $|b - a|$ are always equal.",
        "Wechsle zwischen den Abständen zur $0$ und dem Abstand zwischen $a$ und $b$. Fällt dir etwas auf? $|a - b|$ und $|b - a|$ sind immer gleich.",
      ),
      widget: NegDistance,
    },
    { type: "check", blob: tx("A real-world distance. Across zero!", "Ein Abstand aus dem echten Leben. Über die Null hinweg!"), exercise: distanceCheck },
    {
      type: "explain",
      title: tx("Equations as distances", "Gleichungen mit Abständen lösen"),
      blob: tx("Some equations have two answers. Think in distances and you'll find both.", "Manche Gleichungen haben zwei Lösungen. Denk in Abständen, dann findest du beide."),
      body: tx(
        "$|x| = 4$ asks: which numbers are exactly $4$ away from $0$? There are two: $4$ and $-4$. The same happens with $x^2 = 16$, because $(-4)^2 = 16$ too.",
        "$|x| = 4$ fragt: Welche Zahlen sind genau $4$ von der $0$ entfernt? Es gibt zwei: $4$ und $-4$. Dasselbe passiert bei $x^2 = 16$, denn auch $(-4)^2 = 16$.",
      ),
      frames: [
        { math: "|#l x#x |#r =#e 4#a", note: tx("Which numbers are exactly $4$ away from $0$?", "Welche Zahlen sind genau $4$ von der $0$ entfernt?") },
        { math: "x_1#x =#e -#s 4#a \\quad x_2#x2 =#e2 4#a2", note: tx("One to the left of $0$, one to the right.", "Eine links von der $0$, eine rechts.") },
        { math: setOf([-4, 4]), note: tx("Two solutions. The solution set has two elements.", "Zwei Lösungen. Die Lösungsmenge hat zwei Elemente.") },
        { math: "x#x ^{2#p} =#e 16#a", note: tx("Now $x^2 = 16$: which numbers squared give 16?", "Jetzt $x^2 = 16$: Welche Zahlen ergeben quadriert 16?") },
        { math: "x_1#x =#e -#s 4#a \\quad x_2#x2 =#e2 4#a2", note: tx("$4^2 = 16$ and $(-4)^2 = 16$. Again the two numbers that are $4$ away from zero.", "$4^2 = 16$ und $(-4)^2 = 16$. Wieder die beiden Zahlen, die $4$ von der Null entfernt sind.") },
        { math: tx('|x| = -3 \\quad "or" \\quad x^2 = -9 \\quad \\Rightarrow \\quad L = \\{ \\}', '|x| = -3 \\quad "oder" \\quad x^2 = -9 \\quad \\Rightarrow \\quad L = \\{ \\}'), note: tx("But $|x| = -3$ has **no** solution: a distance can't be negative. Neither can a square: $x^2 = -9$ has no solution.", "Aber $|x| = -3$ hat **keine** Lösung: Ein Abstand kann nicht negativ sein. Ein Quadrat auch nicht: $x^2 = -9$ hat keine Lösung.") },
      ],
    },
    { type: "check", blob: tx("Find both solutions!", "Finde beide Lösungen!"), exercise: squareCheck },
    {
      type: "explain",
      title: tx("Powers with negative bases", "Potenzen mit negativer Basis"),
      blob: tx("Minus signs love to pair up. In powers they do it again!", "Minuszeichen bilden gern Paare. In Potenzen machen sie das wieder!"),
      body: tx(
        "$(-2)^3$ means $(-2) \\cdot (-2) \\cdot (-2)$. Each pair of minus signs gives a plus. So: **even exponent, positive result**; **odd exponent, negative result**. But watch the brackets: in $-2^4$ the exponent belongs only to the $2$.",
        "$(-2)^3$ heißt $(-2) \\cdot (-2) \\cdot (-2)$. Je zwei Minuszeichen ergeben ein Plus. Also: **gerader Exponent, positives Ergebnis**; **ungerader Exponent, negatives Ergebnis**. Aber Achtung bei Klammern: In $-2^4$ gehört der Exponent nur zur $2$.",
      ),
      frames: [
        { math: "(-#s 2#a)#k ^{3#e}", note: tx("The base is $-2$ (in brackets), the exponent is $3$.", "Die Basis ist $-2$ (in Klammern), der Exponent ist $3$.") },
        { math: "(-#s 2#a)#k \\cdot#d1 (-#s2 2#a2)#k2 \\cdot#d2 (-#s3 2#a3)#k3", highlight: ["s", "s2"], note: tx("Three factors $-2$. The first two minus signs make a pair.", "Dreimal der Faktor $-2$. Die ersten beiden Minuszeichen bilden ein Paar.") },
        { math: "4#a \\cdot#d2 (-#s3 2#a3)#k3", note: tx("$(-2) \\cdot (-2) = 4$.", "$(-2) \\cdot (-2) = 4$.") },
        { math: "-#s3 8#a", note: tx("One minus is left over: $(-2)^3 = -8$.", "Ein Minus bleibt übrig: $(-2)^3 = -8$.") },
        { math: "(-#s 2#a)#k ^{4#e} =#q 16#r", note: tx("With exponent $4$, all four minus signs pair up: $(-2)^4 = 16$.", "Beim Exponenten $4$ bilden alle vier Minuszeichen Paare: $(-2)^4 = 16$.") },
        { math: "-#s 2#a ^{4#e} =#q -#t 16#r", note: tx("**Without** brackets the exponent belongs only to the $2$: $-2^4 = -(2^4) = -16$.", "**Ohne** Klammer gehört der Exponent nur zur $2$: $-2^4 = -(2^4) = -16$.") },
      ],
    },
    {
      type: "widget",
      title: tx("Power lab: negative bases", "Potenz-Labor: negative Basis"),
      blob: tx("Change the exponent and watch the sign flip back and forth!", "Ändere den Exponenten und schau, wie das Vorzeichen hin- und herspringt!"),
      body: tx("Choose a base and an exponent. Then switch the brackets off and see what changes.", "Wähl eine Basis und einen Exponenten. Schalte dann die Klammer aus und schau, was sich ändert."),
      widget: NegPowerLab,
    },
    { type: "check", blob: tx("Two powers, two traps. Brackets or not?", "Zwei Potenzen, zwei Fallen. Klammer oder nicht?"), exercise: powerCheck },
    {
      type: "explain",
      title: tx("Laws of arithmetic: calculate cleverly", "Rechengesetze: geschickt rechnen"),
      blob: tx("Work smarter, not harder: swap and group to make the numbers friendly.", "Clever statt mühsam: Vertauschen und zusammenfassen macht die Zahlen freundlich."),
      body: tx(
        "**Commutative law**: you may swap summands or factors. **Associative law**: you may group them however you like. **Distributive law**: $a \\cdot b + a \\cdot c = a \\cdot (b + c)$. With negative numbers, each number takes its sign along.",
        "**Kommutativgesetz** (Vertauschungsgesetz): Du darfst Summanden und Faktoren vertauschen. **Assoziativgesetz** (Verbindungsgesetz): Du darfst sie beliebig zusammenfassen. **Distributivgesetz** (Verteilungsgesetz): $a \\cdot b + a \\cdot c = a \\cdot (b + c)$. Bei negativen Zahlen nimmt jede Zahl ihr Vorzeichen mit.",
      ),
      frames: [
        { math: "-#a 17#a1 +#p 48#b +#q 17#c", note: tx("Look for partners: $-17$ and $17$ cancel out.", "Such Partner: $-17$ und $17$ heben sich auf.") },
        { math: "(-#a 17#a1 +#q 17#c)#k +#p 48#b", note: tx("**Commutative law**: swap $48$ and $17$. **Associative law**: group the partners.", "**Kommutativgesetz**: $48$ und $17$ tauschen. **Assoziativgesetz**: die Partner zusammenfassen.") },
        { math: "0#a1 +#p 48#b =#e 48#r", note: tx("$-17 + 17 = 0$, so the result is $48$. No column addition needed!", "$-17 + 17 = 0$, das Ergebnis ist also $48$. Ganz ohne schriftliches Rechnen!") },
        { math: "(-#s 4#a)#k1 \\cdot#d1 17#b \\cdot#d2 (-#t 25#c)#k2", note: tx("Products too: $(-4)$ and $(-25)$ make a great pair.", "Auch bei Produkten: $(-4)$ und $(-25)$ sind ein tolles Paar.") },
        { math: "[(-#s 4#a)#k1 \\cdot#d2 (-#t 25#c)#k2]#g \\cdot#d1 17#b", note: tx("Swap and group the partners.", "Partner tauschen und zusammenfassen.") },
        { math: "100#a \\cdot#d1 17#b =#e 1700#r", note: tx("$(-4) \\cdot (-25) = 100$, and $100 \\cdot 17 = 1700$.", "$(-4) \\cdot (-25) = 100$ und $100 \\cdot 17 = 1700$.") },
        { math: "13 \\cdot (-7) + 13 \\cdot (-3) = 13 \\cdot (-10) = -130", note: tx("**Distributive law**: both products share the $13$. Factor it out: $(-7) + (-3) = -10$.", "**Distributivgesetz**: Beide Produkte haben die $13$. Klammer sie aus: $(-7) + (-3) = -10$.") },
      ],
    },
    {
      type: "widget",
      title: tx("Clever adding", "Geschickt addieren"),
      blob: tx("Find the partners! The fewer ugly steps, the better.", "Finde die Partner! Je weniger krumme Schritte, desto besser."),
      body: tx(
        "Tap two numbers to add them. Because you may swap and group (commutative and associative law), any two numbers can be partners. Look for pairs that give round numbers.",
        "Tipp zwei Zahlen an, um sie zu addieren. Weil du vertauschen und zusammenfassen darfst (Kommutativ- und Assoziativgesetz), können zwei beliebige Zahlen Partner sein. Such Paare, die glatte Zahlen ergeben.",
      ),
      widget: NegCleverSum,
    },
    { type: "check", blob: tx("Last one! Spot the common factor.", "Die letzte! Erkennst du den gemeinsamen Faktor?"), exercise: distributiveCheck },
  ],
  summary: [
    {
      title: tx("Absolute value", "Betrag"),
      body: tx("$|a|$ is the distance of $a$ from $0$. It is never negative.", "$|a|$ ist der Abstand von $a$ zur $0$. Er ist nie negativ."),
      examples: ["|-7| = 7", "|7| = 7", "|0| = 0"],
      tone: "rule",
    },
    {
      title: tx("Distance between two numbers", "Abstand zweier Zahlen"),
      body: tx("$|a - b|$ is the distance between $a$ and $b$. The order doesn't matter.", "$|a - b|$ ist der Abstand von $a$ und $b$. Die Reihenfolge ist egal."),
      examples: ["|3 - (-4)| = |7| = 7", "|-4 - 3| = |-7| = 7"],
      tone: "rule",
    },
    {
      title: tx("Equations with distances", "Gleichungen mit Abständen"),
      body: tx("$|x| = a$ and $x^2 = a^2$ (with $a > 0$) have two solutions: $a$ and $-a$. A negative distance or square: no solution.", "$|x| = a$ und $x^2 = a^2$ (mit $a > 0$) haben zwei Lösungen: $a$ und $-a$. Negativer Abstand oder negatives Quadrat: keine Lösung."),
      examples: [tx("|x| = 4 \\Rightarrow L = \\{-4, 4\\}", "|x| = 4 \\Rightarrow L = \\{-4; 4\\}"), tx("x^2 = 16 \\Rightarrow L = \\{-4, 4\\}", "x^2 = 16 \\Rightarrow L = \\{-4; 4\\}"), "|x| = -2 \\Rightarrow L = \\{ \\}"],
      tone: "tip",
    },
    {
      title: tx("Powers with negative bases", "Potenzen mit negativer Basis"),
      body: tx("Even exponent: positive. Odd exponent: negative.", "Gerader Exponent: positiv. Ungerader Exponent: negativ."),
      examples: ["(-2)^3 = -8", "(-2)^4 = 16", "(-1)^{100} = 1"],
      tone: "rule",
    },
    {
      title: tx("Brackets make the difference", "Die Klammer macht den Unterschied"),
      body: tx("Without brackets the exponent belongs only to the number, and the minus stays in front.", "Ohne Klammer gehört der Exponent nur zur Zahl, und das Minus bleibt davor."),
      examples: ["-2^4 = -16", "(-2)^4 = 16"],
      tone: "warning",
    },
    {
      title: tx("Laws of arithmetic", "Rechengesetze"),
      body: tx("Swap (commutative), group (associative), factor out (distributive). Each number keeps its sign. Never swap in a subtraction!", "Vertauschen (Kommutativgesetz), zusammenfassen (Assoziativgesetz), ausklammern (Distributivgesetz). Jede Zahl behält ihr Vorzeichen. Bei Minus nie einfach tauschen!"),
      examples: ["-17 + 48 + 17 = 48", "(-4) \\cdot 17 \\cdot (-25) = 1700", "13 \\cdot (-7) + 13 \\cdot (-3) = -130"],
      tone: "tip",
    },
  ],
};
