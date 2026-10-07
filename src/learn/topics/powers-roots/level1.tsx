"use client";

// Level 1 (Klasse 5–7): powers as repeated multiplication, square and cube numbers, powers of ten and
// big numbers, square roots of square numbers, the order of operations with powers and −3² vs (−3)².

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { asNum, choice, collect, framesIn, grouped, maths, say, weighted, type Opt } from "./kit";
import { baseTimes, evalPowerFrames, minusTrapFrames, powerValueMistakes, T_BASE_TIMES, T_HALF } from "./level2";
import { SquareCubeBuilder } from "./SquareCubeBuilder";
import { bigName, TenPowers } from "./TenPowers";

// ---------------------------------------------------------------------------
// Small pieces

/** "1" followed by n zeros, as display digits with thin spaces (first group keyed). */
const tenDigits = (lead: number, n: number, k?: string) => grouped(String(lead) + "0".repeat(n), k);

/** Plain-text number for notes: 4 000 000 with thin spaces in maths. */
const bigPlain = (v: number) => grouped(String(v));

const T_PLUS_FIRST = tx("× and ÷ before + and −", "Punkt vor Strich");
const T_POWER_FIRST = tx("Powers come first", "Potenz zuerst");
const T_MINUS_IN = tx("Minus taken into the power", "Minus mitpotenziert");
const T_SQUARE_CHECK = tx("Check by squaring", "Mach die Quadratprobe");
const T_ZEROS = tx("Count the zeros", "Zähl die Nullen");
const T_DIGITS = tx("Counted all digits", "Alle Ziffern gezählt");
const T_BOTH_SIDES = tx("Work out both sides", "Rechne beide Seiten aus");

const POWER_FIRST = (c: number) =>
  tx(
    `Nearly! The power comes first: work out $${c}^2$ before you multiply. Powers, then × and ÷, then + and −.`,
    `Fast! Die Potenz kommt zuerst: Rechne $${c}^2$ aus, bevor du multiplizierst. Potenz vor Punkt vor Strich.`,
  );

const MINUS_IN = (a: number) =>
  tx(
    `Ooh, classic trap! In $-${a}^2$ the exponent belongs only to the $${a}$. The minus isn't squared, it stays in front.`,
    `Ooh, die klassische Falle! Bei $-${a}^2$ gehört der Exponent nur zur $${a}$. Das Minus wird nicht mitquadriert, es bleibt davor.`,
  );

// ---------------------------------------------------------------------------
// Worked solutions

/** 10^n: n factors 10, a 1 with n zeros. */
function tenFrames(n: number): Frame[] {
  const factors = Array.from({ length: n }, (_, i) => (i === 0 ? "10#f0" : `\\cdot#d${i} 10#f${i}`)).join(" ");
  return [
    { math: `10#t^{${n}#e}`, note: tx(`$10^{${n}}$ means $${n}$ factors $10$.`, `$10^{${n}}$ bedeutet $${n}$ Faktoren $10$.`) },
    { math: factors, note: tx("Each factor $10$ adds one zero to the result.", "Jeder Faktor $10$ hängt an das Ergebnis eine Null an.") },
    {
      math: tenDigits(1, n, "f0"),
      note: tx(`A $1$ with $${n}$ zeros: $10^{${n}} = ${bigPlain(10 ** n)}$.`, `Eine $1$ mit $${n}$ Nullen: $10^{${n}} = ${bigPlain(10 ** n)}$.`),
    },
  ];
}

/** √N for a square number N = k². */
function rootFrames(k: number): Frame[] {
  const N = k * k;
  return [
    {
      math: `\\sqrt{${N}#n}#R`,
      note: tx(`The square root asks: which number **times itself** gives $${N}$?`, `Die Wurzel fragt: Welche Zahl ergibt **mal sich selbst** $${N}$?`),
    },
    { math: `${k}#a \\cdot#d ${k}#b =#eq ${N}#n`, note: tx(`Try it: $${k} \\cdot ${k} = ${N}$.`, `Probier es aus: $${k} \\cdot ${k} = ${N}$.`), highlight: ["a", "b"] },
    { math: `\\sqrt{${N}#n}#R =#eq ${k}#a`, note: tx(`So $\\sqrt{${N}} = ${k}$.`, `Also ist $\\sqrt{${N}} = ${k}$.`) },
  ];
}

/** √0,49 = 0,7: the digits from 7 · 7 = 49, half as many decimal places. */
function decRootFrames(k: number): Frame[] {
  const r = k / 10;
  const N = (k * k) / 100;
  return framesIn((L) => [
    {
      math: `\\sqrt{${L.n(N)}#n}#R`,
      note: L.t(
        `A root of a decimal number. Which number times itself gives $${L.n(N)}$?`,
        `Die Wurzel aus einer Dezimalzahl. Welche Zahl ergibt mal sich selbst $${L.n(N)}$?`,
      ),
    },
    {
      math: `${L.n(r)}#a \\cdot#d ${L.n(r)}#b =#eq ${L.n(N)}#n`,
      note: L.t(
        `$${k} \\cdot ${k} = ${k * k}$. And $${L.n(r)} \\cdot ${L.n(r)}$ has two decimal places: $${L.n(N)}$.`,
        `$${k} \\cdot ${k} = ${k * k}$. Und $${L.n(r)} \\cdot ${L.n(r)}$ hat zwei Nachkommastellen: $${L.n(N)}$.`,
      ),
      highlight: ["a", "b"],
    },
    {
      math: `\\sqrt{${L.n(N)}#n}#R =#eq ${L.n(r)}#a`,
      note: L.t(
        `So $\\sqrt{${L.n(N)}} = ${L.n(r)}$: half as many decimal places as under the root.`,
        `Also ist $\\sqrt{${L.n(N)}} = ${L.n(r)}$: halb so viele Nachkommastellen wie unter der Wurzel.`,
      ),
    },
  ]);
}

// ---------------------------------------------------------------------------
// Typical mistakes

/** √(k²/100) = k/10 as a decimal. */
function decRootMistakes(k: number): Mistake[] {
  const N = (k * k) / 100;
  const right = k / 10;
  const check = (x: number) =>
    say((L) =>
      L.t(
        `Nearly, the digits are right! But check by squaring: $${L.n(x)} \\cdot ${L.n(x)} = ${L.n(x * x)}$, not $${L.n(N)}$.`,
        `Fast, die Ziffern stimmen! Aber mach die Probe: $${L.n(x)} \\cdot ${L.n(x)} = ${L.n(x * x)}$, nicht $${L.n(N)}$.`,
      ),
    );
  return collect(asNum(right), (add) => {
    add(asNum(k / 100), T_SQUARE_CHECK, check(k / 100), true);
    add(asNum(k), T_SQUARE_CHECK, check(k), true);
    add(
      asNum(N / 2),
      T_HALF,
      say((L) =>
        L.t(
          `Ah, I see what happened: you halved $${L.n(N)}$. But the root asks which number **times itself** gives $${L.n(N)}$.`,
          `Ah, ich seh, was passiert ist: Du hast $${L.n(N)}$ halbiert. Aber die Wurzel fragt, welche Zahl **mal sich selbst** $${L.n(N)}$ ergibt.`,
        ),
      ),
    );
  });
}

/** √N for N = k² (whole numbers). */
function rootMistakes(k: number): Mistake[] {
  const N = k * k;
  return collect(asNum(k), (add) => {
    add(
      asNum(N / 2),
      T_HALF,
      tx(
        `Ah, I see what happened: you halved $${N}$. But the root asks which number **times itself** gives $${N}$.`,
        `Ah, ich seh, was passiert ist: Du hast $${N}$ halbiert. Aber die Wurzel fragt, welche Zahl **mal sich selbst** $${N}$ ergibt.`,
      ),
    );
    if (k % 10 === 0) {
      for (const x of [k / 10, k * 10])
        add(
          asNum(x),
          T_SQUARE_CHECK,
          tx(
            `Nearly, the digits are right! But check: $${x} \\cdot ${x} = ${bigPlain(x * x)}$, not $${bigPlain(N)}$. Count the zeros.`,
            `Fast, die Ziffern stimmen! Aber mach die Probe: $${x} \\cdot ${x} = ${bigPlain(x * x)}$, nicht $${bigPlain(N)}$. Zähl die Nullen.`,
          ),
          true,
        );
    }
    add(
      asNum(N * N),
      tx("Squared instead", "Quadriert statt Wurzel gezogen"),
      tx(
        `Careful, you squared $${N}$. The root goes the other way: find the number whose square is $${N}$.`,
        `Vorsicht, du hast $${N}$ quadriert. Die Wurzel geht andersherum: Such die Zahl, deren Quadrat $${N}$ ist.`,
      ),
    );
  });
}

// ---------------------------------------------------------------------------
// Practice

const POWER = tx("Calculate the power", "Berechne die Potenz");
const ROOT = tx("Calculate the square root", "Berechne die Wurzel");
const MISSING = tx("Find the missing number", "Finde die fehlende Zahl");
const AS_NUMBER = tx("Write as a number", "Schreib als Zahl");
const WITH_TEN = tx("Write with a power of ten", "Schreib mit einer Zehnerpotenz");
const ORDER = tx("Calculate. Mind the order!", "Berechne. Achte auf die Reihenfolge!");
const COMPARE = tx("Compare: <, = or >?", "Vergleiche: <, = oder >?");
const WHICH = tx("Pick the right term", "Wähle den richtigen Term");
const STORY = tx("Word problem", "Sachaufgabe");

function powerTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["square", "square", "cube", "two", "small", "ten", "neg", "neg", "trap", "trap", "one"] as const);
  if (kind === "trap") {
    const [b, n] = rng.pick<[number, number]>([
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
      [6, 2],
      [7, 2],
      [8, 2],
      [9, 2],
      [10, 2],
      [2, 4],
      [3, 4],
    ]);
    return {
      instruction: POWER,
      math: `-${b}^{${n}}`,
      answer: { kind: "number", value: -(b ** n) },
      hint: tx("Which number does the exponent belong to? Is the minus part of the base?", "Zu welcher Zahl gehört der Exponent? Gehört das Minus zur Basis?"),
      solution: minusTrapFrames(b, n),
      mistakes: powerValueMistakes(b, n, true),
    };
  }
  if (kind === "one") {
    const b = rng.pick([0, 1]);
    const n = rng.int(3, 9);
    return {
      instruction: POWER,
      math: `${b}^{${n}}`,
      answer: { kind: "number", value: b },
      hint: tx(`Write out the $${n}$ factors $${b}$ and multiply.`, `Schreib die $${n}$ Faktoren $${b}$ aus und multipliziere.`),
      solution: evalPowerFrames(b, n),
      mistakes: collect(asNum(b), (add) => {
        add(asNum(b * n), T_BASE_TIMES, baseTimes(String(b), n));
        if (b === 0)
          add(
            asNum(1),
            tx("Zero times zero", "Null mal null"),
            tx(
              `Careful: $0 \\cdot 0 = 0$. As soon as one factor is $0$, the whole product is $0$.`,
              `Vorsicht: $0 \\cdot 0 = 0$. Sobald ein Faktor $0$ ist, ist das ganze Produkt $0$.`,
            ),
          );
        else add(asNum(n), T_BASE_TIMES, baseTimes("1", n));
      }),
    };
  }
  let b: number;
  let n: number;
  if (kind === "square") [b, n] = [rng.int(2, 15), 2];
  else if (kind === "cube") [b, n] = [rng.pick([2, 3, 4, 5, 6, 10]), 3];
  else if (kind === "two") [b, n] = [2, rng.int(4, 10)];
  else if (kind === "small")
    [b, n] = rng.pick<[number, number]>([
      [3, 4],
      [3, 5],
      [4, 4],
      [5, 4],
      [7, 3],
      [8, 3],
      [9, 3],
    ]);
  else if (kind === "ten") [b, n] = [10, rng.int(2, 7)];
  else {
    b = rng.pick([-2, -2, -3, -1, -4, -5, -10]);
    n = b === -2 ? rng.int(2, 5) : b === -3 ? rng.int(2, 3) : b === -1 ? rng.int(3, 9) : b === -10 ? rng.int(2, 3) : 2;
  }
  const value = b ** n;
  return {
    instruction: POWER,
    math: b < 0 ? `(${b})^{${n}}` : `${b}^{${n}}`,
    answer: { kind: "number", value },
    hint:
      b < 0
        ? tx("Write out the factors. Count the minus signs: even gives plus, odd gives minus.", "Schreib die Faktoren aus. Zähl die Minuszeichen: Eine gerade Anzahl ergibt Plus, eine ungerade Minus.")
        : b === 10
          ? tx("Each factor $10$ adds one zero.", "Jeder Faktor $10$ hängt eine Null an.")
          : tx(`$${b}^{${n}}$ means $${n}$ factors $${b}$, not $${b} \\cdot ${n}$.`, `$${b}^{${n}}$ bedeutet $${n}$ Faktoren $${b}$, nicht $${b} \\cdot ${n}$.`),
    solution: b === 10 ? tenFrames(n) : evalPowerFrames(b, n),
    mistakes: powerValueMistakes(b, n, false),
  };
}

function rootTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["int", "int", "int", "big", "dec", "dec", "dec2"] as const);
  if (kind === "dec" || kind === "dec2") {
    const k = kind === "dec" ? rng.int(1, 9) : rng.int(11, 19);
    const N = (k * k) / 100;
    return {
      instruction: ROOT,
      math: maths((L) => `\\sqrt{${L.n(N)}}`),
      answer: { kind: "number", value: k / 10 },
      hint: say((L) =>
        L.t(
          `Think of $\\sqrt{${k * k}} = ${k}$. How many decimal places does the result need so that it squares to $${L.n(N)}$?`,
          `Denk an $\\sqrt{${k * k}} = ${k}$. Wie viele Nachkommastellen braucht das Ergebnis, damit sein Quadrat $${L.n(N)}$ ergibt?`,
        ),
      ),
      solution: decRootFrames(k),
      mistakes: decRootMistakes(k),
    };
  }
  const k = kind === "big" ? rng.pick([20, 30, 40, 50, 60, 70, 80, 90]) : rng.int(2, 20);
  const N = k * k;
  return {
    instruction: ROOT,
    math: `\\sqrt{${bigPlain(N)}}`,
    answer: { kind: "number", value: k },
    hint:
      kind === "big"
        ? tx(`Look at the digits without the zeros first: $\\sqrt{${N / 100}} = ${k / 10}$.`, `Schau dir zuerst die Ziffern ohne die Nullen an: $\\sqrt{${N / 100}} = ${k / 10}$.`)
        : tx(`Which number times itself gives $${N}$?`, `Welche Zahl ergibt mal sich selbst $${N}$?`),
    solution: rootFrames(k),
    mistakes: rootMistakes(k),
  };
}

function missingTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["exp", "exp", "exp", "base2", "base3"] as const);
  if (kind === "exp") {
    const b = rng.pick([2, 2, 3, 4, 5, 10, 10]);
    const n = b === 2 ? rng.int(3, 10) : b === 3 ? rng.int(2, 6) : b === 4 ? rng.int(2, 5) : b === 5 ? rng.int(2, 4) : rng.int(2, 7);
    const V = b ** n;
    const chain = Array.from({ length: n }, (_, i) => b ** (i + 1));
    const frames: Frame[] = [
      {
        math: `${b}#b^{\\blob{n}#n} =#eq ${bigPlain(V)}#v`,
        note: tx(`How many factors $${b}$ do you need to get $${bigPlain(V)}$?`, `Wie viele Faktoren $${b}$ brauchst du, um $${bigPlain(V)}$ zu bekommen?`),
      },
    ];
    if (n <= 6)
      frames.push({
        math: `${Array.from({ length: n }, (_, i) => (i === 0 ? `${b}#f0` : `\\cdot#d${i} ${b}#f${i}`)).join(" ")} =#eq ${bigPlain(V)}#v`,
        note: tx(`Multiply step by step: $${chain.map(bigPlain).join(", ")}$. That's $${n}$ factors.`, `Multipliziere Schritt für Schritt: $${chain.map(bigPlain).join("; ")}$. Das sind $${n}$ Faktoren.`),
      });
    frames.push({
      math: `${b}#b^{${n}#n} =#eq ${bigPlain(V)}#v`,
      note: n <= 6 ? tx(`So $n = ${n}$.`, `Also ist $n = ${n}$.`) : tx(`Count the steps: $${chain.join(", ")}$. So $n = ${n}$.`, `Zähl die Schritte: $${chain.join("; ")}$. Also ist $n = ${n}$.`),
    });
    return {
      instruction: MISSING,
      math: `${b}^{\\blob{n}} = ${bigPlain(V)}`,
      answer: { kind: "number", value: n, label: "n =" },
      hint: b === 10 ? tx("Count the zeros.", "Zähl die Nullen.") : tx(`Multiply $${b} \\cdot ${b} \\cdot …$ and count the factors.`, `Multipliziere $${b} \\cdot ${b} \\cdot …$ und zähl die Faktoren.`),
      solution: frames,
      mistakes: collect(asNum(n), (add) => {
        if (b === 10)
          add(
            asNum(n + 1),
            T_DIGITS,
            tx(
              `Nearly! You counted all the digits, the $1$ as well. The exponent counts only the **zeros**.`,
              `Fast! Du hast alle Ziffern gezählt, auch die $1$. Der Exponent zählt nur die **Nullen**.`,
            ),
            true,
          );
        if (V % b === 0)
          add(
            asNum(V / b),
            tx("Divided by the base", "Durch die Basis geteilt"),
            tx(
              `Ah, I see what happened: you calculated $${bigPlain(V)} : ${b}$. But $n$ counts **how many** factors $${b}$ you need.`,
              `Ah, ich seh, was passiert ist: Du hast $${bigPlain(V)} : ${b}$ gerechnet. Aber $n$ zählt, **wie viele** Faktoren $${b}$ du brauchst.`,
            ),
          );
        add(
          asNum(n - 1),
          tx("One factor short", "Ein Faktor zu wenig"),
          tx(`Nearly! Check: $${b}^{${n - 1}} = ${bigPlain(b ** (n - 1))}$. One more factor $${b}$ is needed.`, `Fast! Probe: $${b}^{${n - 1}} = ${bigPlain(b ** (n - 1))}$. Es fehlt noch ein Faktor $${b}$.`),
          true,
        );
      }),
    };
  }
  const e = kind === "base2" ? 2 : 3;
  const a = e === 2 ? rng.int(3, 15) : rng.pick([2, 3, 4, 5, 6, 10]);
  const V = a ** e;
  const factors = Array.from({ length: e }, (_, i) => (i === 0 ? `${a}#a` : `\\cdot#d${i} ${a}#a${i}`)).join(" ");
  return {
    instruction: MISSING,
    math: `\\blob{a}^{${e}} = ${bigPlain(V)}`,
    answer: { kind: "number", value: a, label: "a =" },
    hint:
      e === 2
        ? tx(`Which number times itself gives $${V}$?`, `Welche Zahl ergibt mal sich selbst $${V}$?`)
        : tx(`Which number, used three times as a factor, gives $${bigPlain(V)}$?`, `Welche Zahl ergibt dreimal als Faktor genommen $${bigPlain(V)}$?`),
    solution: [
      {
        math: `\\blob{a}#a^{${e}#e} =#eq ${bigPlain(V)}#v`,
        note:
          e === 2
            ? tx(`You need a number that gives $${V}$ when multiplied by itself.`, `Gesucht ist eine Zahl, die mit sich selbst multipliziert $${V}$ ergibt.`)
            : tx(`You need a number that gives $${bigPlain(V)}$ as a product of three equal factors.`, `Gesucht ist eine Zahl, die als Produkt aus drei gleichen Faktoren $${bigPlain(V)}$ ergibt.`),
      },
      { math: `${factors} =#eq ${bigPlain(V)}#v`, note: tx(`Try $${a}$: it works.`, `Probier $${a}$: Das passt.`), highlight: ["a"] },
      { math: `${a}#a^{${e}#e} =#eq ${bigPlain(V)}#v`, note: tx(`So $a = ${a}$.`, `Also ist $a = ${a}$.`) },
    ],
    mistakes: collect(asNum(a), (add) => {
      if (V % e === 0)
        add(
          asNum(V / e),
          tx("Divided by the exponent", "Durch den Exponenten geteilt"),
          tx(
            `I think I know what you did: you calculated $${bigPlain(V)} : ${e}$. But $a^{${e}}$ means $${e}$ **factors** $a$, not $${e} \\cdot a$.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast $${bigPlain(V)} : ${e}$ gerechnet. Aber $a^{${e}}$ bedeutet $${e}$ **Faktoren** $a$, nicht $${e} \\cdot a$.`,
          ),
        );
    }),
  };
}

function tensTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["toNumber", "toNumber", "toPower", "toPower", "words", "words"] as const);
  const a = rng.int(2, 9);
  if (kind === "toNumber") {
    const n = rng.int(2, 6);
    const v = a * 10 ** n;
    return {
      instruction: AS_NUMBER,
      math: `${a} \\cdot 10^{${n}}`,
      answer: { kind: "number", value: v },
      hint: tx(`$10^{${n}}$ is a $1$ with $${n}$ zeros.`, `$10^{${n}}$ ist eine $1$ mit $${n}$ Nullen.`),
      solution: [
        { math: `${a}#a \\cdot#d 10#t^{${n}#e}`, note: tx(`$10^{${n}}$ is a $1$ with $${n}$ zeros.`, `$10^{${n}}$ ist eine $1$ mit $${n}$ Nullen.`) },
        { math: `${a}#a \\cdot#d ${tenDigits(1, n, "t")}`, note: tx(`$10^{${n}} = ${bigPlain(10 ** n)}$.`, `$10^{${n}} = ${bigPlain(10 ** n)}$.`) },
        {
          math: tenDigits(a, n, "a"),
          note: tx(`Times $${a}$: write $${a}$ and then the $${n}$ zeros. So $${a} \\cdot 10^{${n}} = ${bigPlain(v)}$.`, `Mal $${a}$: Schreib $${a}$ und dahinter die $${n}$ Nullen. Also ist $${a} \\cdot 10^{${n}} = ${bigPlain(v)}$.`),
        },
      ],
      mistakes: collect(asNum(v), (add) => {
        add(
          asNum(a * 10 * n),
          T_BASE_TIMES,
          tx(
            `I think I know what you did: you took $10^{${n}}$ as $10 \\cdot ${n} = ${10 * n}$. But $10^{${n}}$ means $${n}$ factors $10$.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast $10^{${n}}$ als $10 \\cdot ${n} = ${10 * n}$ gerechnet. Aber $10^{${n}}$ bedeutet $${n}$ Faktoren $10$.`,
          ),
        );
        add(asNum(a * 10 ** (n + 1)), T_ZEROS, tx(`Nearly! That's one zero too many. $10^{${n}}$ gives exactly $${n}$ zeros.`, `Fast! Das ist eine Null zu viel. $10^{${n}}$ ergibt genau $${n}$ Nullen.`), true);
        add(asNum(a * 10 ** (n - 1)), T_ZEROS, tx(`Nearly! One zero is missing. $10^{${n}}$ gives exactly $${n}$ zeros.`, `Fast! Eine Null fehlt. $10^{${n}}$ ergibt genau $${n}$ Nullen.`), true);
      }),
    };
  }
  if (kind === "toPower") {
    const n = rng.int(3, 9);
    const v = a * 10 ** n;
    return {
      instruction: WITH_TEN,
      math: `${bigPlain(v)} = ${a} \\cdot 10^{\\blob{n}}`,
      answer: { kind: "number", value: n, label: "n =" },
      hint: tx("Count the zeros.", "Zähl die Nullen."),
      solution: [
        { math: `${tenDigits(a, n, "a")}`, note: tx(`Count the zeros behind the $${a}$: there are $${n}$.`, `Zähl die Nullen hinter der $${a}$: Es sind $${n}$.`) },
        { math: `${a}#a \\cdot#d ${tenDigits(1, n, "t")}`, note: tx(`So the number is $${a}$ times a $1$ with $${n}$ zeros.`, `Die Zahl ist also $${a}$ mal eine $1$ mit $${n}$ Nullen.`) },
        { math: `${a}#a \\cdot#d 10#t^{${n}#e}`, note: tx(`So $n = ${n}$.`, `Also ist $n = ${n}$.`) },
      ],
      mistakes: collect(asNum(n), (add) => {
        add(
          asNum(n + 1),
          T_DIGITS,
          tx(
            `Nearly! You counted all ${n + 1} digits, the $${a}$ as well. The exponent counts only the **zeros**.`,
            `Fast! Du hast alle ${n + 1} Ziffern gezählt, auch die $${a}$. Der Exponent zählt nur die **Nullen**.`,
          ),
          true,
        );
        add(asNum(n - 1), T_ZEROS, tx("Nearly! Count the zeros once more, one by one.", "Fast! Zähl die Nullen noch mal einzeln nach."), true);
      }),
    };
  }
  const g = rng.int(1, 3);
  const r = g === 1 ? rng.int(1, 2) : rng.int(0, 2);
  const n = 3 * g + r;
  const lead = a * 10 ** r;
  const word = (l: "en" | "de") => bigName(a, n, l);
  const nameEn = ["A thousand", "A million", "A billion"][g - 1];
  const nameDe = ["Tausend", "Eine Million", "Eine Milliarde"][g - 1];
  return {
    instruction: WITH_TEN,
    math: tx(`"${word("en")}" = ${a} \\cdot 10^{\\blob{n}}`, `"${word("de")}" = ${a} \\cdot 10^{\\blob{n}}`),
    answer: { kind: "number", value: n, label: "n =" },
    hint: say((L) =>
      L.t(
        `${nameEn} has $${3 * g}$ zeros. ${r ? `And $${lead}$ adds $${r}$ more.` : ""}`.trim(),
        `${nameDe} hat $${3 * g}$ Nullen. ${r ? `Und $${lead}$ bringt noch $${r}$ dazu.` : ""}`.trim(),
      ),
    ),
    solution: [
      {
        math: tx(`"${word("en")}"#w`, `"${word("de")}"#w`),
        note: tx(`${nameEn} is $${bigPlain(10 ** (3 * g))}$: $${3 * g}$ zeros.`, `${nameDe} ist $${bigPlain(10 ** (3 * g))}$: $${3 * g}$ Nullen.`),
      },
      { math: tenDigits(a, n, "a"), note: tx(`So it's $${bigPlain(lead * 10 ** (3 * g))}$.`, `Es ist also $${bigPlain(lead * 10 ** (3 * g))}$.`) },
      {
        math: `${a}#a \\cdot#d 10#t^{${n}#e}`,
        note: r
          ? tx(`Count the zeros: $${r}$ from the $${lead}$ and $${3 * g}$ more, $${n}$ in total. So $n = ${n}$.`, `Zähl die Nullen: $${r}$ aus der $${lead}$ und noch $${3 * g}$, zusammen $${n}$. Also ist $n = ${n}$.`)
          : tx(`$${n}$ zeros, so $n = ${n}$.`, `$${n}$ Nullen, also ist $n = ${n}$.`),
      },
    ],
    mistakes: collect(asNum(n), (add) => {
      if (r)
        add(
          asNum(3 * g),
          T_ZEROS,
          tx(`Nearly! ${nameEn} has $${3 * g}$ zeros, but the $${lead}$ brings $${r}$ more.`, `Fast! ${nameDe} hat $${3 * g}$ Nullen, aber die $${lead}$ bringt noch $${r}$ dazu.`),
          true,
        );
      add(
        asNum(n + 1),
        T_DIGITS,
        tx("Nearly! You counted all the digits. The exponent counts only the **zeros**.", "Fast! Du hast alle Ziffern gezählt. Der Exponent zählt nur die **Nullen**."),
        true,
      );
    }),
  };
}

function orderTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["p1", "p1", "p2", "p3", "p3", "p4", "p4", "p5", "p6"] as const);
  if (kind === "p1") {
    const a = rng.int(2, 20);
    const b = rng.int(2, 5);
    const c = rng.int(3, 5);
    const v = a + b * c * c;
    return {
      instruction: ORDER,
      math: `${a} + ${b} \\cdot ${c}^2`,
      answer: { kind: "number", value: v },
      hint: tx("Powers first, then multiply, then add.", "Erst die Potenz, dann Punkt vor Strich."),
      solution: [
        { math: `${a}#a +#p ${b}#b \\cdot#d ${c}#c^{2#e}`, note: tx("Powers first, then multiplication, then addition.", "Zuerst die Potenz, dann Punktrechnung, dann Strichrechnung.") },
        { math: `${a}#a +#p ${b}#b \\cdot#d ${c * c}#c`, note: tx(`$${c}^2 = ${c} \\cdot ${c} = ${c * c}$.`, `$${c}^2 = ${c} \\cdot ${c} = ${c * c}$.`), highlight: ["c"] },
        { math: `${a}#a +#p ${b * c * c}#b`, note: tx(`Multiply before you add: $${b} \\cdot ${c * c} = ${b * c * c}$.`, `Punkt vor Strich: $${b} \\cdot ${c * c} = ${b * c * c}$.`) },
        { math: `${v}#a`, note: tx(`Finally $${a} + ${b * c * c} = ${v}$.`, `Zum Schluss $${a} + ${b * c * c} = ${v}$.`) },
      ],
      mistakes: collect(asNum(v), (add) => {
        add(
          asNum((a + b) * c * c),
          T_PLUS_FIRST,
          tx(`Ah, I see what happened! You added $${a} + ${b}$ first. But multiplication comes before addition.`, `Ah, ich seh, was passiert ist! Du hast zuerst $${a} + ${b}$ gerechnet. Aber Punkt geht vor Strich.`),
        );
        add(
          asNum(a + (b * c) ** 2),
          T_POWER_FIRST,
          tx(`Nearly! The exponent belongs only to the $${c}$, not to $${b} \\cdot ${c}$. Work out $${c}^2$ first.`, `Fast! Der Exponent gehört nur zur $${c}$, nicht zu $${b} \\cdot ${c}$. Rechne zuerst $${c}^2$ aus.`),
        );
        add(asNum(a + b * 2 * c), T_BASE_TIMES, baseTimes(String(c), 2));
        add(asNum((a + b * c) ** 2), T_POWER_FIRST, POWER_FIRST(c));
      }),
    };
  }
  if (kind === "p2") {
    const a = rng.int(2, 9);
    const b = rng.int(3, 9);
    const v = a * b * b;
    return {
      instruction: ORDER,
      math: `${a} \\cdot ${b}^2`,
      answer: { kind: "number", value: v },
      hint: tx(`The exponent belongs only to the $${b}$.`, `Der Exponent gehört nur zur $${b}$.`),
      solution: [
        { math: `${a}#a \\cdot#d ${b}#b^{2#e}`, note: tx(`The exponent $2$ belongs only to the $${b}$. Power first.`, `Der Exponent $2$ gehört nur zur $${b}$. Zuerst die Potenz.`), highlight: ["b", "e"] },
        { math: `${a}#a \\cdot#d ${b * b}#b`, note: `$${b}^2 = ${b * b}$.` },
        { math: `${v}#a`, note: tx(`Then $${a} \\cdot ${b * b} = ${v}$.`, `Dann $${a} \\cdot ${b * b} = ${v}$.`) },
      ],
      mistakes: collect(asNum(v), (add) => {
        add(
          asNum((a * b) ** 2),
          T_POWER_FIRST,
          tx(`Ooh, I see! You squared $${a} \\cdot ${b}$. But without brackets the exponent belongs only to the $${b}$.`, `Ooh, ich seh's! Du hast $${a} \\cdot ${b}$ quadriert. Ohne Klammern gehört der Exponent aber nur zur $${b}$.`),
        );
        add(asNum(a * 2 * b), T_BASE_TIMES, baseTimes(String(b), 2));
      }),
    };
  }
  if (kind === "p3") {
    const a = rng.int(1, 9);
    const b = rng.int(2, 9);
    const s = a + b;
    const v = s * s;
    return {
      instruction: ORDER,
      math: `(${a} + ${b})^2`,
      answer: { kind: "number", value: v },
      hint: tx("Brackets first.", "Zuerst die Klammer."),
      solution: [
        { math: `(${a}#a +#p ${b}#b)#br^{2#e}`, note: tx("The bracket comes first.", "Zuerst kommt die Klammer.") },
        { math: `${s}#a^{2#e}`, note: `$${a} + ${b} = ${s}$.` },
        { math: `${v}#a`, note: tx(`Then square: $${s} \\cdot ${s} = ${v}$.`, `Dann quadrieren: $${s} \\cdot ${s} = ${v}$.`) },
      ],
      mistakes: collect(asNum(v), (add) => {
        add(
          asNum(a * a + b * b),
          tx("Squared each number", "Einzeln quadriert"),
          tx(
            `Ooh, classic trap! You squared $${a}$ and $${b}$ separately. But the bracket comes first: add, then square the result.`,
            `Ooh, die klassische Falle! Du hast $${a}$ und $${b}$ einzeln quadriert. Aber die Klammer kommt zuerst: erst addieren, dann das Ergebnis quadrieren.`,
          ),
        );
        add(asNum(2 * s), T_BASE_TIMES, baseTimes(String(s), 2));
      }),
    };
  }
  if (kind === "p4") {
    const a = rng.int(3, 7);
    const b = rng.int(a * a - 10 > 2 ? a * a - 10 : 3, a * a + 30);
    const v = b - a * a;
    if (b === a * a) return null;
    return {
      instruction: ORDER,
      math: `-${a}^2 + ${b}`,
      answer: { kind: "number", value: v },
      hint: tx(`The exponent belongs only to the $${a}$. The minus stays in front.`, `Der Exponent gehört nur zur $${a}$. Das Minus bleibt davor.`),
      solution: [
        { math: `-#m ${a}#a^{2#e} +#p ${b}#b`, note: tx(`Power first. The exponent belongs only to the $${a}$, not to the minus.`, `Zuerst die Potenz. Der Exponent gehört nur zur $${a}$, nicht zum Minus.`), highlight: ["a", "e"] },
        { math: `-#m ${a * a}#a +#p ${b}#b`, note: tx(`$${a}^2 = ${a * a}$, and the minus stays in front: $-${a * a}$.`, `$${a}^2 = ${a * a}$, und das Minus bleibt davor: $-${a * a}$.`) },
        { math: `${v < 0 ? `-#m ${-v}#a` : `${v}#a`}`, note: tx(`$-${a * a} + ${b} = ${v}$.`, `$-${a * a} + ${b} = ${v}$.`) },
      ],
      mistakes: collect(asNum(v), (add) => {
        add(asNum(a * a + b), T_MINUS_IN, MINUS_IN(a));
        add(asNum(b - 2 * a), T_BASE_TIMES, baseTimes(String(a), 2));
      }),
    };
  }
  if (kind === "p5") {
    const c = rng.int(2, 5);
    const a = rng.int(2, 3);
    const cube = -(a ** 3);
    const v = c * cube;
    return {
      instruction: ORDER,
      math: `${c} \\cdot (-${a})^3`,
      answer: { kind: "number", value: v },
      hint: tx(`Work out $(-${a})^3$ first. Count the minus signs.`, `Rechne zuerst $(-${a})^3$ aus. Zähl die Minuszeichen.`),
      solution: [
        { math: `${c}#c \\cdot#d (-#m ${a}#a)#br^{3#e}`, note: tx("Power first.", "Zuerst die Potenz.") },
        {
          math: `${c}#c \\cdot#d (-#m ${a ** 3}#a)#br`,
          note: tx(`$(-${a})^3 = (-${a}) \\cdot (-${a}) \\cdot (-${a}) = ${cube}$: three minus signs, so negative.`, `$(-${a})^3 = (-${a}) \\cdot (-${a}) \\cdot (-${a}) = ${cube}$: drei Minuszeichen, also negativ.`),
        },
        { math: `-#m ${-v}#a`, note: tx(`Then $${c} \\cdot (${cube}) = ${v}$.`, `Dann $${c} \\cdot (${cube}) = ${v}$.`) },
      ],
      mistakes: collect(asNum(v), (add) => {
        add(
          asNum((-c * a) ** 3),
          T_POWER_FIRST,
          tx(`Ooh, I see! You cubed $${c} \\cdot (-${a})$. But the exponent belongs only to the bracket $(-${a})$.`, `Ooh, ich seh's! Du hast $${c} \\cdot (-${a})$ hoch 3 genommen. Der Exponent gehört aber nur zur Klammer $(-${a})$.`),
        );
        add(
          asNum(-v),
          tx("Count the minus signs", "Zähl die Minuszeichen"),
          tx(`Nearly! $(-${a})^3$ has three minus signs. Two make plus, but one is left over.`, `Fast! $(-${a})^3$ hat drei Minuszeichen. Zwei ergeben Plus, aber eins bleibt übrig.`),
          true,
        );
        add(asNum(c * -3 * a), T_BASE_TIMES, baseTimes(`(-${a})`, 3));
      }),
    };
  }
  // p6: (a − b)² with a < b
  const a = rng.int(1, 6);
  const b = a + rng.int(2, 6);
  const d = b - a;
  const v = d * d;
  return {
    instruction: ORDER,
    math: `(${a} - ${b})^2`,
    answer: { kind: "number", value: v },
    hint: tx("Brackets first. Then: minus times minus is plus.", "Zuerst die Klammer. Dann gilt: Minus mal Minus ergibt Plus."),
    solution: [
      { math: `(${a}#a -#m ${b}#b)#br^{2#e}`, note: tx("The bracket comes first.", "Zuerst kommt die Klammer.") },
      { math: `(-#m ${d}#a)#br^{2#e}`, note: `$${a} - ${b} = -${d}$.` },
      { math: `${v}#a`, note: tx(`$(-${d}) \\cdot (-${d}) = ${v}$: two minus signs make plus.`, `$(-${d}) \\cdot (-${d}) = ${v}$: Zwei Minuszeichen ergeben Plus.`) },
    ],
    mistakes: collect(asNum(v), (add) => {
      add(
        asNum(a * a - b * b),
        tx("Squared each number", "Einzeln quadriert"),
        tx(
          `Ooh, classic trap! You squared $${a}$ and $${b}$ separately. The bracket comes first: subtract, then square the result.`,
          `Ooh, die klassische Falle! Du hast $${a}$ und $${b}$ einzeln quadriert. Die Klammer kommt zuerst: erst subtrahieren, dann das Ergebnis quadrieren.`,
        ),
      );
      add(asNum(-v), tx("Minus times minus", "Minus mal Minus"), tx(`Nearly! The bracket is $-${d}$, and $(-${d})^2$ has two minus signs: that makes plus.`, `Fast! Die Klammer ist $-${d}$, und $(-${d})^2$ hat zwei Minuszeichen: Das ergibt Plus.`), true);
    }),
  };
}

const REL = ["$<$", "$=$", "$>$"];

function compareTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["swap", "swap", "minus", "double", "one", "rebase", "rebase"] as const);
  // The wrong option the typical mistake leads to (mostly "="); -1: the message fits every wrong option.
  let tempting = 1;
  let left: string;
  let right: string;
  let lv: number;
  let rv: number;
  let hint: Text;
  let wrongSay: Text;
  let wrongTitle: Text;
  if (kind === "swap") {
    const [p, q] = rng.pick<[number, number]>([
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 4],
      [2, 6],
      [3, 5],
      [4, 5],
      [1, 4],
      [2, 7],
    ]);
    const [x, y] = rng.chance(0.5) ? [p, q] : [q, p];
    left = `${x}^{${y}}`;
    right = `${y}^{${x}}`;
    lv = x ** y;
    rv = y ** x;
    hint = tx("Work out both powers, then compare.", "Rechne beide Potenzen aus und vergleiche dann.");
    wrongTitle = T_BOTH_SIDES;
    wrongSay = tx(
      "Hmm, not quite. Swapping base and exponent usually changes the value, so work out both powers before you compare.",
      "Hm, nicht ganz. Wenn du Basis und Exponent vertauschst, ändert sich meistens der Wert. Rechne also beide Potenzen aus, bevor du vergleichst.",
    );
  } else if (kind === "minus") {
    const a = rng.int(2, 9);
    const flip = rng.chance(0.5);
    left = flip ? `(-${a})^2` : `-${a}^2`;
    right = flip ? `-${a}^2` : `(-${a})^2`;
    lv = flip ? a * a : -a * a;
    rv = flip ? -a * a : a * a;
    hint = tx("Is the minus part of the base? Only with brackets.", "Gehört das Minus zur Basis? Nur mit Klammern.");
    wrongTitle = T_MINUS_IN;
    wrongSay = MINUS_IN(a);
  } else if (kind === "double") {
    const a = rng.int(1, 6);
    const e = rng.pick([2, 3]);
    const swap = rng.chance(0.5);
    left = swap ? `${e} \\cdot ${a}` : `${a}^{${e}}`;
    right = swap ? `${a}^{${e}}` : `${e} \\cdot ${a}`;
    lv = swap ? e * a : a ** e;
    rv = swap ? a ** e : e * a;
    hint = tx(`$${a}^{${e}}$ means $${e}$ factors $${a}$.`, `$${a}^{${e}}$ bedeutet $${e}$ Faktoren $${a}$.`);
    wrongTitle = T_BASE_TIMES;
    wrongSay = baseTimes(String(a), e);
  } else if (kind === "rebase") {
    // Different bases and exponents, often with the same value: 2^6 = 4^3 = 8^2.
    const [x1, y1, x2, y2] = rng.pick<[number, number, number, number]>([
      [2, 6, 4, 3],
      [2, 6, 8, 2],
      [4, 3, 8, 2],
      [3, 4, 9, 2],
      [2, 8, 4, 4],
      [2, 8, 16, 2],
      [2, 9, 8, 3],
      [3, 3, 5, 2],
      [2, 7, 5, 3],
      [2, 10, 10, 3],
      [6, 2, 2, 5],
      [2, 6, 7, 2],
    ]);
    const swap = rng.chance(0.5);
    left = swap ? `${x2}^{${y2}}` : `${x1}^{${y1}}`;
    right = swap ? `${x1}^{${y1}}` : `${x2}^{${y2}}`;
    lv = swap ? x2 ** y2 : x1 ** y1;
    rv = swap ? x1 ** y1 : x2 ** y2;
    tempting = -1;
    hint = tx("Work out both powers, then compare the numbers.", "Rechne beide Potenzen aus und vergleiche dann die Zahlen.");
    wrongTitle = T_BOTH_SIDES;
    wrongSay = tx(
      `Hmm, not quite. A bigger base or a bigger exponent alone doesn't decide it. Work out $${left}$ and $${right}$ and compare the numbers.`,
      `Hm, nicht ganz. Eine größere Basis oder ein größerer Exponent allein entscheidet das nicht. Rechne $${left}$ und $${right}$ aus und vergleiche die Zahlen.`,
    );
  } else {
    const m = 2 * rng.int(1, 5);
    const n = 2 * rng.int(1, 5) + 1;
    const swap = rng.chance(0.5);
    left = swap ? `(-1)^{${n}}` : `(-1)^{${m}}`;
    right = swap ? `(-1)^{${m}}` : `(-1)^{${n}}`;
    lv = swap ? -1 : 1;
    rv = swap ? 1 : -1;
    tempting = -1;
    hint = tx("Count the minus signs: even gives plus, odd gives minus.", "Zähl die Minuszeichen: gerade ergibt Plus, ungerade Minus.");
    wrongTitle = tx("Count the minus signs", "Zähl die Minuszeichen");
    wrongSay = tx(
      "Nearly! Every two factors $(-1)$ make $+1$. With an even exponent everything pairs up, with an odd one a minus is left over.",
      "Fast! Je zwei Faktoren $(-1)$ ergeben $+1$. Bei geradem Exponenten geht alles auf, bei ungeradem bleibt ein Minus übrig.",
    );
  }
  const correct = lv < rv ? 0 : lv === rv ? 1 : 2;
  const rel = ["<", "=", ">"][correct];
  const options = REL;
  // Any other wrong option: no typical mistake leads there, so Blob just asks to work out both sides.
  const generic = tx(`Not quite. Work out $${left}$ and $${right}$ as numbers first, then compare.`, `Nicht ganz. Rechne $${left}$ und $${right}$ zuerst als Zahlen aus und vergleiche dann.`);
  const mistakes: Mistake[] = [0, 1, 2]
    .filter((i) => i !== correct)
    .map((i) => {
      const typical = tempting === -1 || i === tempting;
      return { when: { kind: "choice", options, correct: i } as AnswerSpec, title: typical ? wrongTitle : T_BOTH_SIDES, say: typical ? wrongSay : generic };
    });
  return {
    instruction: COMPARE,
    math: `${left} \\quad \\box{?} \\quad ${right}`,
    answer: { kind: "choice", options, correct },
    hint,
    solution: [
      { math: `${left}#L \\quad \\box{?}#q \\quad ${right}#R`, note: tx("Work out both sides first.", "Rechne zuerst beide Seiten aus.") },
      { math: `${lv < 0 ? `-#lm ${-lv}#L` : `${lv}#L`} \\quad \\box{?}#q \\quad ${rv < 0 ? `-#rm ${-rv}#R` : `${rv}#R`}`, note: tx(`Left: $${left} = ${lv}$. Right: $${right} = ${rv}$.`, `Links: $${left} = ${lv}$. Rechts: $${right} = ${rv}$.`) },
      { math: `${left} \\; ${rel}#q \\; ${right}`, note: tx(`So $${left} ${rel} ${right}$.`, `Also gilt $${left} ${rel} ${right}$.`) },
    ],
    mistakes,
  };
}

function whichTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["pos", "neg", "cube"] as const);
  const a = kind === "cube" ? rng.int(2, 4) : rng.int(3, 9);
  let V: number;
  let opts: Opt[];
  if (kind === "pos") {
    V = a * a;
    opts = [
      { text: `$(-${a})^2$` },
      { text: `$-${a}^2$`, title: T_MINUS_IN, say: MINUS_IN(a) },
      { text: `$-(${a}^2)$`, title: tx("Minus outside", "Minus außerhalb"), say: tx(`Here the minus is outside the power, so the result is negative.`, `Hier steht das Minus außerhalb der Potenz, also ist das Ergebnis negativ.`) },
      { text: `$2 \\cdot (-${a})$`, title: T_BASE_TIMES, say: tx(`$2 \\cdot (-${a})$ is $-${2 * a}$. A square means $(-${a}) \\cdot (-${a})$.`, `$2 \\cdot (-${a})$ ist $-${2 * a}$. Ein Quadrat bedeutet $(-${a}) \\cdot (-${a})$.`) },
    ];
  } else if (kind === "neg") {
    V = -a * a;
    opts = [
      { text: `$-${a}^2$` },
      {
        text: `$(-${a})^2$`,
        title: T_MINUS_IN,
        say: tx(`Careful: in $(-${a})^2$ the minus is inside the bracket, so it's squared too: two minus signs make plus.`, `Vorsicht: Bei $(-${a})^2$ steht das Minus in der Klammer und wird mitquadriert: Zwei Minuszeichen ergeben Plus.`),
      },
      { text: `$(-${a}) \\cdot (-${a})$`, title: tx("Minus times minus", "Minus mal Minus"), say: tx("Minus times minus is plus, so that's positive.", "Minus mal Minus ergibt Plus, das ist also positiv.") },
      { text: `$-2 \\cdot ${a}$`, title: T_BASE_TIMES, say: tx(`$-2 \\cdot ${a} = -${2 * a}$. A square means $${a} \\cdot ${a}$.`, `$-2 \\cdot ${a} = -${2 * a}$. Ein Quadrat bedeutet $${a} \\cdot ${a}$.`) },
    ];
  } else {
    V = -(a ** 3);
    opts = [
      { text: `$(-${a})^3$` },
      { text: `$(-${a})^2$`, title: tx("Count the minus signs", "Zähl die Minuszeichen"), say: tx("With two factors the minus signs cancel, so that's positive.", "Bei zwei Faktoren heben sich die Minuszeichen auf, das ist also positiv.") },
      { text: `$3 \\cdot (-${a})$`, title: T_BASE_TIMES, say: baseTimes(`(-${a})`, 3) },
      { text: `$${a}^3$`, title: tx("Sign missing", "Vorzeichen fehlt"), say: tx("No minus anywhere, so this power is positive.", "Hier gibt es gar kein Minus, diese Potenz ist also positiv.") },
    ];
  }
  const c = choice(rng, opts);
  return {
    instruction: WHICH,
    text: tx(`Which term has the value $${V}$?`, `Welcher Term hat den Wert $${V}$?`),
    answer: c.answer,
    hint: tx("Brackets decide: is the minus part of the base?", "Die Klammern entscheiden: Gehört das Minus zur Basis?"),
    solution: [
      {
        math:
          kind === "pos"
            ? `(-${a})^2 = ${a * a} \\\\ -${a}^2 = -${a * a} \\\\ -(${a}^2) = -${a * a} \\\\ 2 \\cdot (-${a}) = -${2 * a}`
            : kind === "neg"
              ? `-${a}^2 = -${a * a} \\\\ (-${a})^2 = ${a * a} \\\\ (-${a}) \\cdot (-${a}) = ${a * a} \\\\ -2 \\cdot ${a} = -${2 * a}`
              : `(-${a})^3 = -${a ** 3} \\\\ (-${a})^2 = ${a * a} \\\\ 3 \\cdot (-${a}) = -${3 * a} \\\\ ${a}^3 = ${a ** 3}`,
        note: tx(`Work out every term. Only the first one gives $${V}$.`, `Rechne jeden Term aus. Nur der erste ergibt $${V}$.`),
      },
    ],
    mistakes: c.mistakes,
  };
}

function storyTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["garden", "cubes", "fold", "chain"] as const);
  if (kind === "garden") {
    const k = rng.int(4, 15);
    const A = k * k;
    return {
      instruction: STORY,
      text: tx(`A square garden has an area of $${A}$ m². How long is one side?`, `Ein quadratischer Garten hat eine Fläche von $${A}$ m². Wie lang ist eine Seite?`),
      answer: { kind: "number", value: k, unit: "m" },
      hint: tx("The area of a square is side times side.", "Die Fläche eines Quadrats ist Seite mal Seite."),
      solution: [
        { math: `s#s^{2#e} =#eq ${A}#A`, note: tx("Area of a square: side $\\cdot$ side $= s^2$.", "Fläche eines Quadrats: Seite $\\cdot$ Seite $= s^2$.") },
        { math: `s#s =#eq \\sqrt{${A}#A}#R`, note: tx("Which number squared gives the area? That's the square root.", "Welche Zahl ergibt quadriert die Fläche? Das ist die Wurzel.") },
        { math: `s#s =#eq ${k}#A "m"#u`, note: tx(`$${k} \\cdot ${k} = ${A}$, so each side is $${k}$ m long.`, `$${k} \\cdot ${k} = ${A}$, also ist jede Seite $${k}$ m lang.`) },
      ],
      mistakes: collect({ kind: "number", value: k, unit: "m" }, (add) => {
        add(
          asNum(A / 4),
          tx("Divided by 4", "Durch 4 geteilt"),
          tx("I think I know what you did: you divided by the 4 sides. That works for the perimeter. For the area, side times side must give the area.", "Ich glaub, ich weiß, was du gemacht hast: Du hast durch die 4 Seiten geteilt. Das passt beim Umfang. Bei der Fläche muss Seite mal Seite die Fläche ergeben."),
        );
        add(
          asNum(A / 2),
          T_HALF,
          tx(`Ah, I see what happened: you halved $${A}$. But you need the number that gives $${A}$ **times itself**.`, `Ah, ich seh, was passiert ist: Du hast $${A}$ halbiert. Gesucht ist aber die Zahl, die **mal sich selbst** $${A}$ ergibt.`),
        );
      }),
    };
  }
  if (kind === "cubes") {
    const k = rng.int(2, 6);
    const name = rng.pick(["Mia", "Jonas", "Elif", "Paul"]);
    return {
      instruction: STORY,
      text: tx(
        `${name} builds a big cube out of small cubes. Each edge is $${k}$ small cubes long. How many small cubes does ${name} need?`,
        `${name} baut aus kleinen Würfeln einen großen Würfel. Jede Kante ist $${k}$ kleine Würfel lang. Wie viele kleine Würfel braucht ${name}?`,
      ),
      answer: { kind: "number", value: k ** 3 },
      hint: tx("How many cubes are in one layer? How many layers are there?", "Wie viele Würfel liegen in einer Schicht? Wie viele Schichten gibt es?"),
      solution: [
        { math: `${k}#a \\cdot#d1 ${k}#b =#eq ${k * k}#l`, note: tx(`One layer: $${k} \\cdot ${k} = ${k * k}$ cubes.`, `Eine Schicht: $${k} \\cdot ${k} = ${k * k}$ Würfel.`) },
        { math: `${k * k}#l \\cdot#d2 ${k}#c =#eq ${k ** 3}#r`, note: tx(`$${k}$ layers: $${k * k} \\cdot ${k} = ${k ** 3}$.`, `$${k}$ Schichten: $${k * k} \\cdot ${k} = ${k ** 3}$.`) },
        { math: `${k}#a^{3#e} =#eq ${k ** 3}#r`, note: tx(`That's a cube number: $${k}^3 = ${k ** 3}$ small cubes.`, `Das ist eine Kubikzahl: $${k}^3 = ${k ** 3}$ kleine Würfel.`) },
      ],
      mistakes: collect(asNum(k ** 3), (add) => {
        add(
          asNum(k * k),
          tx("Only one layer", "Nur eine Schicht"),
          tx(`That's one layer, nice! But the cube has $${k}$ layers on top of each other.`, `Das ist eine Schicht, gut! Aber der Würfel hat $${k}$ Schichten übereinander.`),
          true,
        );
        add(asNum(3 * k), T_BASE_TIMES, baseTimes(String(k), 3));
      }),
    };
  }
  if (kind === "fold") {
    const n = rng.int(3, 7);
    return {
      instruction: STORY,
      text: tx(
        `You fold a sheet of paper in half, then in half again, $${n}$ times in total. How many layers of paper lie on top of each other?`,
        `Du faltest ein Blatt Papier in der Mitte, dann noch mal in der Mitte, insgesamt $${n}$-mal. Wie viele Lagen Papier liegen übereinander?`,
      ),
      answer: { kind: "number", value: 2 ** n },
      hint: tx("Each fold doubles the layers: 2, 4, …", "Jedes Falten verdoppelt die Lagen: 2, 4, …"),
      solution: [
        { math: `1#a \\to#t1 2#b \\to#t2 4#c \\to#t3 8#d`, note: tx("Each fold **doubles** the number of layers.", "Jedes Falten **verdoppelt** die Anzahl der Lagen.") },
        { math: `2#b^{${n}#e}`, note: tx(`$${n}$ folds: $${n}$ factors $2$.`, `$${n}$-mal falten: $${n}$ Faktoren $2$.`) },
        { math: `2#b^{${n}#e} =#eq ${2 ** n}#r`, note: tx(`So there are $${2 ** n}$ layers.`, `Es liegen also $${2 ** n}$ Lagen übereinander.`) },
      ],
      mistakes: collect(asNum(2 ** n), (add) => {
        add(
          asNum(2 * n),
          tx("Added instead of doubled", "Addiert statt verdoppelt"),
          tx("Ah, I see what happened: you added 2 for each fold. But each fold **doubles** the layers.", "Ah, ich seh, was passiert ist: Du hast pro Falten 2 dazugezählt. Aber jedes Falten **verdoppelt** die Lagen."),
        );
        add(asNum(2 ** (n - 1)), tx("One fold short", "Einmal zu wenig gefaltet"), tx(`Nearly! That's $${n - 1}$ folds. Count the doublings once more.`, `Fast! Das sind $${n - 1}$ Faltungen. Zähl die Verdopplungen noch mal nach.`), true);
      }),
    };
  }
  const b = rng.int(2, 5);
  const r = b === 2 ? rng.int(3, 6) : b === 3 ? rng.int(3, 5) : rng.int(2, 4);
  const name = rng.pick(["Ben", "Lea", "Can", "Ida"]);
  return {
    instruction: STORY,
    text: tx(
      `A secret: in round 1, ${name} tells it to $${b}$ friends. In every further round, everyone who just heard it tells $${b}$ new people. How many new people hear the secret in round $${r}$?`,
      `Ein Geheimnis: In Runde 1 erzählt ${name} es $${b}$ Freunden. In jeder weiteren Runde erzählt jeder, der es gerade gehört hat, es $${b}$ neuen Leuten. Wie viele Leute hören das Geheimnis in Runde $${r}$ neu?`,
    ),
    answer: { kind: "number", value: b ** r },
    hint: tx(`Round 1: $${b}$. Round 2: $${b} \\cdot ${b}$. And so on.`, `Runde 1: $${b}$. Runde 2: $${b} \\cdot ${b}$. Und so weiter.`),
    solution: [
      {
        math: Array.from({ length: Math.min(r, 3) }, (_, i) => `${b ** (i + 1)}#r${i}`).join(" \\to ") + (r > 3 ? " \\to …" : ""),
        note: tx(`Each round, the number is multiplied by $${b}$.`, `In jeder Runde wird die Anzahl mit $${b}$ multipliziert.`),
      },
      { math: `${b}#b^{${r}#e}`, note: tx(`Round $${r}$: $${r}$ factors $${b}$.`, `Runde $${r}$: $${r}$ Faktoren $${b}$.`) },
      { math: `${b}#b^{${r}#e} =#eq ${b ** r}#v`, note: tx(`So $${b ** r}$ people hear it in round $${r}$.`, `In Runde $${r}$ hören es also $${b ** r}$ Leute.`) },
    ],
    mistakes: collect(asNum(b ** r), (add) => {
      add(asNum(b * r), T_BASE_TIMES, baseTimes(String(b), r));
      add(asNum(b ** (r - 1)), tx("One round short", "Eine Runde zu wenig"), tx(`Nearly! That's round $${r - 1}$. One more round multiplies by $${b}$ again.`, `Fast! Das ist Runde $${r - 1}$. Eine Runde mehr multipliziert noch mal mit $${b}$.`), true);
    }),
  };
}

export function generate1(rng: Rng): Exercise {
  return weighted(
    rng,
    [
      [3, () => powerTask(rng)],
      [2.5, () => rootTask(rng)],
      [1.5, () => missingTask(rng)],
      [2, () => tensTask(rng)],
      [2.5, () => orderTask(rng)],
      [1.2, () => compareTask(rng)],
      [1, () => whichTask(rng)],
      [1.3, () => storyTask(rng)],
    ],
    () => powerTask(rng) ?? { instruction: POWER, math: "2^{3}", answer: { kind: "number", value: 8 }, solution: evalPowerFrames(2, 3) },
  );
}

// ---------------------------------------------------------------------------
// Lesson

const introFrames: Frame[] = [
  {
    math: "3#a \\cdot#d1 3#b \\cdot#d2 3#c \\cdot#d3 3#d",
    note: tx("Four times the same factor $3$. Writing that out gets long.", "Viermal derselbe Faktor $3$. Das auszuschreiben wird lang."),
  },
  {
    math: "3#a^{4#n}",
    note: tx(
      'Short: $3^4$, read "3 to the power of 4". The **base** $3$ is the factor, the **exponent** $4$ counts how often it appears.',
      "Kurz: $3^4$, gelesen „3 hoch 4“. Die **Basis** $3$ ist der Faktor, der **Exponent** $4$ zählt, wie oft er vorkommt.",
    ),
    highlight: ["a", "n"],
  },
  {
    math: "3#a^{4#n} =#eq 81#r",
    note: tx("Step by step: $3 \\cdot 3 = 9$, $9 \\cdot 3 = 27$, $27 \\cdot 3 = 81$.", "Schritt für Schritt: $3 \\cdot 3 = 9$, $9 \\cdot 3 = 27$, $27 \\cdot 3 = 81$."),
  },
  {
    math: "2#a^{3#n} =#eq 2#x1 \\cdot#m1 2#x2 \\cdot#m2 2#x3 =#eq2 8#r",
    note: tx("Careful: $2^3$ means $2 \\cdot 2 \\cdot 2 = 8$. It's **not** $2 \\cdot 3 = 6$.", "Vorsicht: $2^3$ bedeutet $2 \\cdot 2 \\cdot 2 = 8$. Es ist **nicht** $2 \\cdot 3 = 6$."),
    highlight: ["n"],
  },
  {
    math: "a#a^{n#n} =#eq a#x1 \\cdot#m1 a#x2 \\cdot#m2 …#dots \\cdot#m3 a#x3",
    note: tx(
      "In general: $a^n$ is $n$ factors $a$. The whole thing is called a **power**. And $a^1 = a$: just one factor.",
      "Allgemein: $a^n$ sind $n$ Faktoren $a$. Das Ganze heißt **Potenz**. Und $a^1 = a$: nur ein Faktor.",
    ),
  },
];

const tenFramesLesson: Frame[] = [
  { math: "10#t^{2#e} =#eq 10#f1 \\cdot#d1 10#f2 =#eq2 100#v", note: tx("$10^2 = 10 \\cdot 10 = 100$: a $1$ with two zeros.", "$10^2 = 10 \\cdot 10 = 100$: eine $1$ mit zwei Nullen.") },
  {
    math: "10#t^{3#e} =#eq 10#f1 \\cdot#d1 10#f2 \\cdot#d2 10#f3 =#eq2 1000#v",
    note: tx("Every further factor $10$ adds one zero: $10^3 = 1000$.", "Jeder weitere Faktor $10$ hängt eine Null an: $10^3 = 1000$."),
  },
  {
    math: "10#t^{6#e} =#eq 1#v \\,000 \\,000",
    note: tx("**The exponent counts the zeros.** $10^6 = 1\\,000\\,000$, one million.", "**Der Exponent zählt die Nullen.** $10^6 = 1\\,000\\,000$, eine Million."),
    highlight: ["e"],
  },
  {
    math: "3#a \\cdot#d 10#t^{6#e} =#eq 3#v \\,000 \\,000",
    note: tx("Big numbers become short: $3 \\cdot 10^6$ is $3$ million, a $3$ with six zeros.", "Große Zahlen werden kurz: $3 \\cdot 10^6$ sind $3$ Millionen, eine $3$ mit sechs Nullen."),
  },
  {
    math: "7#v \\,000 \\,000 \\,000 =#eq 7#a \\cdot#d 10#t^{9#e}",
    note: tx("Backwards: count the zeros. $7$ billion has $9$ zeros, so it's $7 \\cdot 10^9$.", "Rückwärts: Zähl die Nullen. $7$ Milliarden haben $9$ Nullen, also $7 \\cdot 10^9$."),
  },
  {
    math: tx(
      '10^{3} \\; "thousand" \\quad 10^{6} \\; "million" \\\\ 10^{9} \\; "billion" \\quad 10^{12} \\; "trillion"',
      '10^{3} \\; "Tausend" \\quad 10^{6} \\; "Million" \\\\ 10^{9} \\; "Milliarde" \\quad 10^{12} \\; "Billion"',
    ),
    note: tx(
      "The names go up in steps of three zeros. Careful with German: a billion is a „Milliarde“ there, and a German „Billion“ is a trillion.",
      "Die Namen gehen in Dreierschritten. Vorsicht beim Englischen: Unsere Milliarde heißt dort „billion“, unsere Billion heißt „trillion“.",
    ),
  },
];

const rootFramesLesson: Frame[] = framesIn((L) => [
  { math: "7#a^{2#e} =#eq 49#n", note: L.t("Squaring: $7^2 = 49$. So $49$ is a **square number**.", "Quadrieren: $7^2 = 49$. Also ist $49$ eine **Quadratzahl**.") },
  {
    math: "\\sqrt{49#n}#R =#eq 7#a",
    note: L.t(
      "The **square root** goes backwards: $\\sqrt{49}$ asks which number times itself gives $49$. That's $7$.",
      "Die **Wurzel** geht rückwärts: $\\sqrt{49}$ fragt, welche Zahl mal sich selbst $49$ ergibt. Das ist $7$.",
    ),
  },
  {
    math: "\\sqrt{144#n}#R =#eq 12#a",
    note: L.t("Know the square numbers and you know the roots: $12 \\cdot 12 = 144$, so $\\sqrt{144} = 12$.", "Wer die Quadratzahlen kennt, kennt die Wurzeln: $12 \\cdot 12 = 144$, also ist $\\sqrt{144} = 12$."),
  },
  {
    math: `\\sqrt{${L.n(0.25)}#n}#R =#eq ${L.n(0.5)}#a`,
    note: L.t(
      `Decimals work too: $${L.n(0.5)} \\cdot ${L.n(0.5)} = ${L.n(0.25)}$. So $\\sqrt{${L.n(0.25)}} = ${L.n(0.5)}$, not $${L.n(0.05)}$!`,
      `Auch mit Dezimalzahlen: $${L.n(0.5)} \\cdot ${L.n(0.5)} = ${L.n(0.25)}$. Also ist $\\sqrt{${L.n(0.25)}} = ${L.n(0.5)}$, nicht $${L.n(0.05)}$!`,
    ),
  },
  {
    math: `\\sqrt{0#n}#R =#eq 0#a \\quad \\sqrt{1#n2}#R2 =#eq2 1#a2`,
    note: L.t("Two special ones: $0 \\cdot 0 = 0$ and $1 \\cdot 1 = 1$.", "Zwei Sonderfälle: $0 \\cdot 0 = 0$ und $1 \\cdot 1 = 1$."),
  },
  {
    math: "(-#m 7#a)#br^{2#e} =#eq 49#n",
    note: L.t(
      "Also $(-7)^2 = 49$. But $\\sqrt{49}$ always means the **positive** number $7$. A square root is never negative.",
      "Auch $(-7)^2 = 49$. Aber $\\sqrt{49}$ meint immer die **positive** Zahl $7$. Eine Wurzel ist nie negativ.",
    ),
  },
]);

const orderFramesLesson: Frame[] = [
  {
    math: "2#a +#p 3#b \\cdot#d 4#c^{2#e}",
    note: tx("Which first? **Brackets, then powers, then × and ÷, then + and −.**", "Was zuerst? **Klammern, dann Potenzen, dann Punkt vor Strich.**"),
  },
  { math: "2#a +#p 3#b \\cdot#d 16#c", note: tx("The power first: $4^2 = 16$.", "Zuerst die Potenz: $4^2 = 16$."), highlight: ["c"] },
  { math: "2#a +#p 48#b", note: tx("Then multiply: $3 \\cdot 16 = 48$.", "Dann Punkt: $3 \\cdot 16 = 48$.") },
  { math: "50#a", note: tx("Finally add: $2 + 48 = 50$.", "Zum Schluss Strich: $2 + 48 = 50$.") },
  {
    math: "(2#a +#p 3#b)#br^{2#e} =#eq 5#f^{2#e2} =#eq2 25#r",
    note: tx("Brackets change the order: bracket first, then square. ($2^2 + 3^2$ would only be $13$.)", "Klammern ändern die Reihenfolge: erst die Klammer, dann quadrieren. ($2^2 + 3^2$ wäre nur $13$.)"),
  },
  {
    math: "-#m 3#a^{2#e} =#eq -#m2 9#r",
    note: tx(
      "Careful with minus: $-3^2$ means $-(3 \\cdot 3) = -9$. The exponent belongs only to the $3$.",
      "Vorsicht mit dem Minus: $-3^2$ bedeutet $-(3 \\cdot 3) = -9$. Der Exponent gehört nur zur $3$.",
    ),
    highlight: ["a", "e"],
  },
  {
    math: "(-#m 3#a)#br^{2#e} =#eq (-3) \\cdot (-3) =#eq2 9#r",
    note: tx("With brackets the minus is squared too: $(-3)^2 = 9$. Minus times minus is plus.", "Mit Klammern wird das Minus mitquadriert: $(-3)^2 = 9$. Minus mal Minus ergibt Plus."),
    highlight: ["m", "e"],
  },
];

export const level1: LevelLesson = {
  summary: [
    {
      title: tx("Powers", "Potenzen"),
      body: tx("$a^n$ is $n$ factors $a$. $a$ is the base, $n$ the exponent.", "$a^n$ sind $n$ Faktoren $a$. $a$ ist die Basis, $n$ der Exponent."),
      examples: ["2^5 = 2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32", "5^1 = 5"],
      tone: "rule",
    },
    {
      title: tx("Square and cube numbers", "Quadrat- und Kubikzahlen"),
      body: tx("A number squared is a square number, a number cubed is a cube number.", "Eine Zahl hoch 2 ergibt eine Quadratzahl, eine Zahl hoch 3 eine Kubikzahl."),
      examples: [tx("1, 4, 9, 16, 25, 36, 49, 64, 81, 100", "1; 4; 9; 16; 25; 36; 49; 64; 81; 100"), tx("1, 8, 27, 64, 125", "1; 8; 27; 64; 125")],
      tone: "rule",
    },
    {
      title: tx("Powers of ten", "Zehnerpotenzen"),
      body: tx("The exponent counts the zeros.", "Der Exponent zählt die Nullen."),
      examples: [
        "10^6 = 1\\,000\\,000",
        "3 \\cdot 10^6 = 3\\,000\\,000",
        tx('10^3 \\; "thousand" \\quad 10^6 \\; "million" \\quad 10^9 \\; "billion"', '10^3 \\; "Tausend" \\quad 10^6 \\; "Million" \\quad 10^9 \\; "Milliarde"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Square roots", "Quadratwurzeln"),
      body: tx("$\\sqrt{a}$ is the non-negative number that gives $a$ when multiplied by itself.", "$\\sqrt{a}$ ist die nicht negative Zahl, die mit sich selbst multipliziert $a$ ergibt."),
      examples: [tx('\\sqrt{49} = 7, \\; "since" \\; 7 \\cdot 7 = 49', '\\sqrt{49} = 7, \\; "denn" \\; 7 \\cdot 7 = 49'), tx("\\sqrt{0.25} = 0.5", "\\sqrt{0,25} = 0,5")],
      tone: "rule",
    },
    {
      title: tx("Order of operations", "Reihenfolge"),
      body: tx("Brackets first, then powers, then × and ÷, then + and −.", "Klammern zuerst, dann Potenzen, dann Punkt vor Strich."),
      examples: ["2 + 3 \\cdot 4^2 = 2 + 3 \\cdot 16 = 50", "(2 + 3)^2 = 25"],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx("The exponent counts factors. Without brackets, the minus is not part of the base.", "Der Exponent zählt Faktoren. Ohne Klammern gehört das Minus nicht zur Basis."),
      examples: ["2^3 = 8 \\ne 2 \\cdot 3", "-3^2 = -9", "(-3)^2 = 9"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Powers: the same factor again and again", "Potenzen: immer derselbe Faktor"),
      blob: tx("Powers are lazy multiplication. I love lazy!", "Potenzen sind faules Multiplizieren. Faul find ich super!"),
      body: tx("When the same factor appears again and again, we write it as a **power**.", "Wenn derselbe Faktor immer wieder vorkommt, schreiben wir ihn als **Potenz**."),
      frames: introFrames,
    },
    {
      type: "widget",
      title: tx("Build square and cube numbers", "Quadrat- und Kubikzahlen bauen"),
      blob: tx("Make the square bigger. Then switch to the cube!", "Mach das Quadrat größer. Dann schalt um auf den Würfel!"),
      body: tx(
        "A square with side $n$ is made of $n \\cdot n = n^2$ small squares, a cube with edge $n$ of $n^3$ small cubes. That's where the names **square number** and **cube number** come from.",
        "Ein Quadrat mit Seitenlänge $n$ besteht aus $n \\cdot n = n^2$ kleinen Quadraten, ein Würfel mit Kantenlänge $n$ aus $n^3$ kleinen Würfeln. Daher kommen die Namen **Quadratzahl** und **Kubikzahl**.",
      ),
      widget: SquareCubeBuilder,
    },
    {
      type: "check",
      blob: tx("Your turn! Count the factors.", "Du bist dran! Zähl die Faktoren."),
      exercise: {
        instruction: POWER,
        math: "4^{3}",
        answer: { kind: "number", value: 64 },
        hint: tx("$4^3$ means $4 \\cdot 4 \\cdot 4$.", "$4^3$ bedeutet $4 \\cdot 4 \\cdot 4$."),
        solution: evalPowerFrames(4, 3),
        mistakes: powerValueMistakes(4, 3, false),
      },
    },
    {
      type: "explain",
      title: tx("Powers of ten and big numbers", "Zehnerpotenzen und große Zahlen"),
      blob: tx("Millions, billions… Powers of ten make huge numbers tiny to write!", "Millionen, Milliarden… Mit Zehnerpotenzen schreibst du riesige Zahlen ganz kurz!"),
      body: tx("Every factor $10$ adds a zero. So the exponent of $10$ tells you how many zeros there are.", "Jeder Faktor $10$ hängt eine Null an. Der Exponent von $10$ verrät also, wie viele Nullen es sind."),
      frames: tenFramesLesson,
    },
    {
      type: "widget",
      title: tx("The power-of-ten machine", "Die Zehnerpotenz-Maschine"),
      blob: tx("Turn the exponent up and watch the zeros fly in!", "Dreh den Exponenten hoch und sieh zu, wie die Nullen anfliegen!"),
      body: tx(
        "Choose a digit $a$ and an exponent $n$. The machine writes $a \\cdot 10^n$ as a number and names it. Then build the number in the task below.",
        "Wähl eine Ziffer $a$ und einen Exponenten $n$. Die Maschine schreibt $a \\cdot 10^n$ als Zahl und nennt ihren Namen. Dann bau die Zahl aus der Aufgabe darunter.",
      ),
      widget: TenPowers,
    },
    {
      type: "check",
      blob: tx("How many zeros hide in 80 million?", "Wie viele Nullen stecken in 80 Millionen?"),
      exercise: {
        instruction: WITH_TEN,
        math: tx('"80 million" = 8 \\cdot 10^{\\blob{n}}', '"80 Millionen" = 8 \\cdot 10^{\\blob{n}}'),
        answer: { kind: "number", value: 7, label: "n =" },
        hint: tx("A million has $6$ zeros. And the $80$?", "Eine Million hat $6$ Nullen. Und die $80$?"),
        solution: [
          { math: tx('"80 million"#w', '"80 Millionen"#w'), note: tx("A million is $1\\,000\\,000$: six zeros.", "Eine Million ist $1\\,000\\,000$: sechs Nullen.") },
          { math: "80#a \\,000 \\,000", note: tx("So $80$ million is $80\\,000\\,000$.", "$80$ Millionen sind also $80\\,000\\,000$.") },
          { math: "8#a \\cdot#d 10#t^{7#e}", note: tx("Count the zeros: $1$ from the $80$ and $6$ from the million, $7$ in total. So $n = 7$.", "Zähl die Nullen: $1$ aus der $80$ und $6$ aus der Million, zusammen $7$. Also ist $n = 7$.") },
        ],
        mistakes: [
          {
            when: { kind: "number", value: 6 },
            title: T_ZEROS,
            say: tx("Nearly! A million has $6$ zeros, but the $80$ brings one more zero.", "Fast! Eine Million hat $6$ Nullen, aber die $80$ bringt noch eine Null mit."),
            close: true,
          },
          {
            when: { kind: "number", value: 8 },
            title: T_DIGITS,
            say: tx("Nearly! You counted all digits, the $8$ as well. The exponent counts only the **zeros**.", "Fast! Du hast alle Ziffern gezählt, auch die $8$. Der Exponent zählt nur die **Nullen**."),
            close: true,
          },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Square roots", "Quadratwurzeln"),
      blob: tx("Roots run squaring backwards. Let's go!", "Wurzeln drehen das Quadrieren um. Los geht's!"),
      body: tx("The square root of a square number is the number you squared.", "Die Wurzel aus einer Quadratzahl ist die Zahl, die du quadriert hast."),
      frames: rootFramesLesson,
    },
    {
      type: "check",
      blob: tx("Watch the decimal places!", "Achte auf die Nachkommastellen!"),
      exercise: {
        instruction: ROOT,
        math: tx("\\sqrt{0.36}", "\\sqrt{0,36}"),
        answer: { kind: "number", value: 0.6 },
        hint: tx("$6 \\cdot 6 = 36$. How many decimal places does the result need?", "$6 \\cdot 6 = 36$. Wie viele Nachkommastellen braucht das Ergebnis?"),
        solution: decRootFrames(6),
        mistakes: decRootMistakes(6),
      },
    },
    {
      type: "explain",
      title: tx("Powers in longer calculations", "Potenzen in längeren Rechnungen"),
      blob: tx("Who goes first? Powers do. And watch that minus!", "Wer ist zuerst dran? Die Potenz. Und Achtung beim Minus!"),
      body: tx("Powers are worked out before multiplication and addition. Brackets still come first.", "Potenzen rechnest du vor Punkt- und Strichrechnung aus. Klammern kommen aber immer zuerst."),
      frames: orderFramesLesson,
    },
    {
      type: "check",
      blob: tx("Last one! Who belongs to the exponent?", "Letzte Aufgabe! Wer gehört zum Exponenten?"),
      exercise: {
        instruction: ORDER,
        math: "-3^2 + 2 \\cdot 5",
        answer: { kind: "number", value: 1 },
        hint: tx("Power first: the exponent belongs only to the $3$. Then multiply before you add.", "Zuerst die Potenz: Der Exponent gehört nur zur $3$. Dann Punkt vor Strich."),
        solution: [
          { math: "-#m 3#a^{2#e} +#p 2#b \\cdot#d 5#c", note: tx("Power first. The exponent belongs only to the $3$.", "Zuerst die Potenz. Der Exponent gehört nur zur $3$."), highlight: ["a", "e"] },
          { math: "-#m 9#a +#p 2#b \\cdot#d 5#c", note: tx("$3^2 = 9$, the minus stays in front.", "$3^2 = 9$, das Minus bleibt davor.") },
          { math: "-#m 9#a +#p 10#b", note: tx("Then multiply before you add: $2 \\cdot 5 = 10$.", "Dann Punkt vor Strich: $2 \\cdot 5 = 10$.") },
          { math: "1#a", note: tx("$-9 + 10 = 1$.", "$-9 + 10 = 1$.") },
        ],
        mistakes: [
          { when: { kind: "number", value: 19 }, title: T_MINUS_IN, say: MINUS_IN(3) },
          { when: { kind: "number", value: 4 }, title: T_BASE_TIMES, say: baseTimes("3", 2) },
          {
            when: { kind: "number", value: -35 },
            title: T_PLUS_FIRST,
            say: tx("Ah, I see what happened! You calculated from left to right. But multiplication comes before addition: $2 \\cdot 5$ first.", "Ah, ich seh, was passiert ist! Du hast von links nach rechts gerechnet. Aber Punkt vor Strich: $2 \\cdot 5$ kommt zuerst."),
          },
        ],
      },
    },
  ],
};
