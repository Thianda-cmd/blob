"use client";

import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { add, div, frac, mul, sub, type Frac } from "@/learn/engine/frac";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { builder, evaluate, evalLeftToRight, render, solveFrames, steps, type Node, type Op4 } from "./ops";
import { choiceOf, dmath, kp, num, numberAnswer, numberMistakes, par, r9, say, weighted, type Opt, type Slip } from "./shared";
import { NegPattern, NegSignCounter } from "./widgets2";

const DEG: Text = "°C";
const EURO: Text = "€";
const CALC = tx("Calculate", "Berechne");

// ---------------------------------------------------------------------------
// Sign-rule feedback, shared by many task shapes.

const SIGN_TITLE = tx("Check the sign", "Prüf das Vorzeichen");
function signSay(negs: number, divide = false): Text {
  if (negs === 2)
    return divide
      ? tx("Minus divided by minus is **plus**! Two negative numbers give a positive result.", "Minus durch minus ergibt **plus**! Zwei negative Zahlen ergeben ein positives Ergebnis.")
      : tx("Minus times minus is **plus**! Two negative numbers give a positive result.", "Minus mal minus ergibt **plus**! Zwei negative Zahlen ergeben ein positives Ergebnis.");
  if (negs === 1)
    return divide
      ? tx("Minus divided by plus, or plus divided by minus, is **minus**: if exactly one number is negative, the result is negative.", "Minus durch plus oder plus durch minus ergibt **minus**: Ist genau eine Zahl negativ, ist das Ergebnis negativ.")
      : tx("Plus times minus is **minus**: if exactly one number is negative, the result is negative.", "Plus mal minus ergibt **minus**: Ist genau eine Zahl negativ, ist das Ergebnis negativ.");
  return tx(
    `Count the minus signs again: there are ${negs}. Every pair makes a plus. Is ${negs} even or odd?`,
    `Zähl die Minuszeichen noch mal: Es sind ${negs}. Jedes Paar ergibt ein Plus. Ist ${negs} gerade oder ungerade?`,
  );
}

// ---------------------------------------------------------------------------
// Practice

/** Two numbers multiplied or divided. */
function twoFactorTask(rng: Rng): Exercise {
  const a = rng.int(2, 12);
  const b = rng.int(2, 12);
  const [x, y] = rng.pick([
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]);
  const divide = rng.chance(0.45);
  const p = x * a;
  const q = y * b;
  const first = divide ? p * q : p;
  const second = q;
  const right = divide ? p : p * q;
  const sym = divide ? ":" : "\\cdot";
  const negs = (first < 0 ? 1 : 0) + (second < 0 ? 1 : 0);
  const bare = rng.chance(0.3) && first < 0;
  const firstSrc = bare ? `-#as ${Math.abs(first)}#a` : kp(first, "a");
  const math = `${firstSrc} ${sym}#d ${kp(second, "b")}`;
  const same = negs !== 1;
  return {
    instruction: CALC,
    math: math.replace(/#[A-Za-z0-9_-]+/g, "").replace(/(^|\()- /g, "$1-"),
    answer: numberAnswer(right),
    hint: tx("First the sign: same signs give plus, different signs give minus. Then calculate without signs.", "Zuerst das Vorzeichen: Gleiche Vorzeichen ergeben plus, verschiedene minus. Dann rechnest du ohne Vorzeichen."),
    solution: [
      { math, highlight: ["as", "bs"], note: same ? tx("Both numbers are negative: same signs, so the result is **positive**.", "Beide Zahlen sind negativ: gleiche Vorzeichen, also ist das Ergebnis **positiv**.") : tx("One number is negative: different signs, so the result is **negative**.", "Eine Zahl ist negativ: verschiedene Vorzeichen, also ist das Ergebnis **negativ**.") },
      {
        math: `${math} =#e ${right < 0 ? `-#rs ${-right}#r` : `${right}#r`}`,
        note: tx(`$${Math.abs(first)} ${sym} ${Math.abs(second)} = ${Math.abs(right)}$, with the sign: $${right}$.`, `$${Math.abs(first)} ${sym} ${Math.abs(second)} = ${Math.abs(right)}$, mit Vorzeichen: $${right}$.`),
      },
    ],
    mistakes: numberMistakes(right, [
      { v: -right, title: SIGN_TITLE, say: signSay(negs, divide) },
      !divide && {
        v: first + second,
        title: tx("Added instead of multiplied", "Addiert statt multipliziert"),
        say: tx(`You added: $${first} + (${second}) = ${first + second}$. But here we multiply.`, `Du hast addiert: $${first} + (${second}) = ${first + second}$. Hier wird aber multipliziert.`),
      },
    ]),
  };
}

/** A product of three to five factors. */
function productTask(rng: Rng): Exercise {
  let fs: number[] = [];
  for (let i = 0; i < 40; i++) {
    const n = rng.int(3, 5);
    fs = Array.from({ length: n }, () => rng.pick([1, 2, 2, 3, 3, 4, 5, 10]) * (rng.chance(0.55) ? -1 : 1));
    const prod = fs.reduce((p, f) => p * f, 1);
    if (Math.abs(prod) <= 400 && fs.some((f) => f < 0) && fs.filter((f) => Math.abs(f) === 1).length <= 1) break;
  }
  const prod = fs.reduce((p, f) => p * f, 1);
  const negs = fs.filter((f) => f < 0).length;
  const keys = fs.map((_, i) => `f${i}`);
  const src = fs.map((f, i) => `${i ? `\\cdot#d${i} ` : ""}${kp(f, keys[i])}`).join(" ");
  const abs = fs.map((f, i) => `${i ? `\\cdot#d${i} ` : ""}${Math.abs(f)}#f${i}`).join(" ");
  const neg = prod < 0;
  return {
    instruction: tx("Calculate the product", "Berechne das Produkt"),
    math: fs.map((f) => par(f)).join(" \\cdot "),
    answer: numberAnswer(prod),
    hint: tx("Count the minus signs first: even means positive, odd means negative.", "Zähl zuerst die Minuszeichen: gerade Anzahl heißt positiv, ungerade negativ."),
    solution: [
      { math: src, highlight: fs.map((f, i) => (f < 0 ? `f${i}s` : "")).filter(Boolean), note: tx(`Count the minus signs: ${negs}. That's ${negs % 2 ? "odd" : "even"}, so the product is ${neg ? "negative" : "positive"}.`, `Zähl die Minuszeichen: ${negs}. Das ist ${negs % 2 ? "ungerade" : "gerade"}, also ist das Produkt ${neg ? "negativ" : "positiv"}.`) },
      { math: `${neg ? "-#sg " : ""}(${abs})#all`, note: tx("Put the sign in front and multiply the numbers without their signs.", "Schreib das Vorzeichen davor und multipliziere die Zahlen ohne Vorzeichen.") },
      { math: neg ? `-#sg ${-prod}#r` : `${prod}#r`, note: tx(`Result: $${prod}$.`, `Ergebnis: $${prod}$.`) },
    ],
    mistakes: numberMistakes(prod, [{ v: -prod, title: tx("Miscounted the minus signs", "Minuszeichen falsch gezählt"), say: signSay(negs) }]),
  };
}

/** Positive, negative or zero, without calculating. */
function signOnlyTask(rng: Rng): Exercise {
  const n = rng.int(5, 7);
  const zero = rng.chance(0.15);
  const fs = Array.from({ length: n }, () => rng.int(2, 39) * (rng.chance(0.5) ? -1 : 1));
  if (zero) fs[rng.int(1, n - 1)] = 0;
  const ops = fs.slice(1).map(() => (rng.chance(0.25) ? ":" : "\\cdot"));
  if (zero) ops.forEach((o, i) => fs[i + 1] === 0 && (ops[i] = "\\cdot"));
  const negs = fs.filter((f) => f < 0).length;
  const result = zero ? 0 : negs % 2 ? -1 : 1;
  const POS = tx("positive", "positiv");
  const NEG = tx("negative", "negativ");
  const ZERO = tx("zero", "null");
  const zeroSay = tx("There's a $0$ among the factors: anything times $0$ is $0$.", "Unter den Faktoren ist eine $0$: Alles mal $0$ ist $0$.");
  const noZeroSay = tx("Look again: there's no $0$ among the numbers, so the result can't be zero.", "Schau noch mal: Unter den Zahlen ist keine $0$, also kann das Ergebnis nicht null sein.");
  const opts: Opt[] = [
    result === 1 ? { text: POS, ok: true } : { text: POS, title: zero ? tx("There's a zero", "Da ist eine Null") : tx("Miscounted", "Verzählt"), say: zero ? zeroSay : signSay(negs) },
    result === -1 ? { text: NEG, ok: true } : { text: NEG, title: zero ? tx("There's a zero", "Da ist eine Null") : tx("Miscounted", "Verzählt"), say: zero ? zeroSay : signSay(negs) },
    result === 0 ? { text: ZERO, ok: true } : { text: ZERO, title: tx("No zero here", "Keine Null dabei"), say: noZeroSay },
  ];
  const { answer, mistakes } = choiceOf(opts);
  const src = fs.map((f, i) => `${i ? `${ops[i - 1]} ` : ""}${kp(f, `f${i}`)}`).join(" ");
  return {
    instruction: tx("Positive, negative or zero?", "Positiv, negativ oder null?"),
    text: tx("Decide without calculating.", "Entscheide, ohne zu rechnen."),
    math: src.replace(/#[A-Za-z0-9_-]+/g, "").replace(/(^|\()- /g, "$1-"),
    answer,
    hint: tx("Is there a $0$? If not, count the minus signs. Dividing follows the same sign rules as multiplying.", "Ist eine $0$ dabei? Wenn nicht, zähl die Minuszeichen. Beim Dividieren gelten dieselben Vorzeichenregeln wie beim Multiplizieren."),
    solution: [
      {
        math: src,
        highlight: zero ? fs.map((f, i) => (f === 0 ? `f${i}` : "")).filter(Boolean) : fs.map((f, i) => (f < 0 ? `f${i}s` : "")).filter(Boolean),
        note: zero
          ? tx("There's a $0$ among the factors, so the whole product is $0$.", "Unter den Faktoren ist eine $0$, also ist das ganze Produkt $0$.")
          : tx(`${negs} minus sign${negs === 1 ? "" : "s"}: ${negs % 2 ? "odd, so the result is **negative**" : "even, so the result is **positive**"}.`, `${negs} Minuszeichen: ${negs % 2 ? "ungerade, also ist das Ergebnis **negativ**" : "gerade, also ist das Ergebnis **positiv**"}.`),
      },
    ],
    mistakes,
  };
}

/** Order of operations with negative numbers. */
function orderOpsRoot(rng: Rng): { root: Node; kind: number } {
  const B = builder();
  const kind = rng.int(0, 6);
  const s = () => rng.sign();
  const pm = (): Op4 => rng.pick(["+", "-"] as const);
  const small = () => s() * rng.int(2, 9);
  switch (kind) {
    case 0:
      return { root: B.op(pm(), B.n(s() * rng.int(1, 15)), B.op("*", B.n(small()), B.n(small()))), kind };
    case 1:
      return { root: B.op(pm(), B.op("*", B.n(small()), B.n(small())), B.op("*", B.n(small()), B.n(small()))), kind };
    case 2: {
      const c = small();
      const q = small();
      return { root: B.op(pm(), B.n(s() * rng.int(1, 15)), B.op(":", B.n(c * q), B.n(c))), kind };
    }
    case 3:
      return { root: B.op("*", B.br(B.op(pm(), B.n(s() * rng.int(1, 12)), B.n(rng.int(1, 12)))), B.n(small())), kind };
    case 4: {
      const e = small();
      const b = rng.nonZero(-9, 9);
      return { root: B.op(pm(), B.op(":", B.n(e * small()), B.br(B.op("-", B.n(b), B.n(b - e)))), B.n(s() * rng.int(1, 12))), kind };
    }
    case 5: {
      const k = rng.int(2, 6);
      const a = s() * rng.int(1, 20);
      return rng.chance(0.65)
        ? { root: B.op(pm(), B.n(a), B.sq(B.n(-k))), kind }
        : { root: B.op("*", B.n(small()), B.sq(B.n(-k))), kind };
    }
    default:
      return { root: B.op("*", B.n(small()), B.br(B.op(pm(), B.n(s() * rng.int(1, 12)), B.n(s() * rng.int(1, 12))))), kind };
  }
}

const hasNeg = (n: Node): boolean => (n.t === "n" ? n.v < 0 : n.t === "op" ? hasNeg(n.l) || hasNeg(n.r) : hasNeg(n.e));

function stripBrackets(n: Node): Node {
  if (n.t === "br") return stripBrackets(n.e);
  if (n.t === "op") return { ...n, l: stripBrackets(n.l), r: stripBrackets(n.r) };
  if (n.t === "sq") return { ...n, e: stripBrackets(n.e) };
  return n;
}

function opsMistakes(root: Node, right: number): Mistake[] {
  const slips: Slip[] = [];
  const lr = evalLeftToRight(root);
  if (Number.isInteger(lr))
    slips.push({
      v: lr,
      title: tx("Point before line", "Punkt vor Strich"),
      say: tx("Ah, you worked from left to right. But multiplying and dividing come **before** adding and subtracting.", "Ah, du hast von links nach rechts gerechnet. Aber Mal und Geteilt kommen **vor** Plus und Minus."),
    });
  if (root.t === "op" && (root.l.t === "br" || root.r.t === "br")) {
    const nb = evaluate(stripBrackets(root));
    if (Number.isInteger(nb))
      slips.push({ v: nb, title: tx("Brackets first", "Klammer zuerst"), say: tx("The bracket has to be worked out **first**. It is stronger than point before line.", "Die Klammer musst du **zuerst** ausrechnen. Sie ist stärker als Punkt vor Strich.") });
  }
  const sq = evaluate(root, { squareSlip: true });
  slips.push({
    v: sq,
    title: tx("Square of a negative number", "Quadrat einer negativen Zahl"),
    say: tx("A square of a negative number is **positive**: $(-3)^2 = (-3) \\cdot (-3) = 9$.", "Das Quadrat einer negativen Zahl ist **positiv**: $(-3)^2 = (-3) \\cdot (-3) = 9$."),
  });
  const slipped = steps(root, 0);
  const sv = slipped.length ? evaluate(slipped[slipped.length - 1].n) : NaN;
  slips.push({ v: sv, title: SIGN_TITLE, say: tx("One of your intermediate results has the wrong sign. Check each step with the sign rules.", "Eines deiner Zwischenergebnisse hat das falsche Vorzeichen. Prüf jeden Schritt mit den Vorzeichenregeln.") });
  return numberMistakes(right, slips);
}

const OPS_FIRST = tx("Brackets first, then powers, then point before line.", "Zuerst Klammern, dann Potenzen, dann Punkt vor Strich.");

function orderOpsTask(rng: Rng): Exercise {
  for (let i = 0; i < 60; i++) {
    const { root } = orderOpsRoot(rng);
    const right = evaluate(root);
    if (!Number.isInteger(right) || Math.abs(right) > 120 || !hasNeg(root)) continue;
    if (steps(root).some((s) => s.calcs.some((c) => Math.abs(c.v) > 150 || !Number.isInteger(c.v)))) continue;
    return {
      instruction: tx("Mind the order of operations", "Beachte die Rechenreihenfolge"),
      math: render(root, "en", false),
      answer: numberAnswer(right),
      hint: OPS_FIRST,
      solution: solveFrames(root, OPS_FIRST),
      mistakes: opsMistakes(root, right),
    };
  }
  return orderOpsTask(createRng(rng.int(1, 1e6)));
}

/** A gap in a product or quotient. */
function gapTask(rng: Rng): Exercise {
  const a = rng.int(2, 9) * rng.sign();
  let x = rng.int(2, 9) * rng.sign();
  if (a > 0 && x > 0) x = -x;
  const kind = rng.int(0, 3);
  let src = "";
  let solved = "";
  let note: Text = "";
  let slips: Slip[] = [];
  if (kind === 0) {
    src = `${kp(a, "a")} \\cdot#d \\box{?#q} =#e ${kp(a * x, "p").replace(/^\(|\)#pb$/g, "")}`;
    solved = `${kp(a, "a")} \\cdot#d \\green{${kp(x, "x")}} =#e ${num(a * x)}#p`;
    note = tx(`$${a * x} : ${par(a)} = ${x}$. Check: $${par(a)} \\cdot ${par(x)} = ${a * x}$.`, `$${a * x} : ${par(a)} = ${x}$. Probe: $${par(a)} \\cdot ${par(x)} = ${a * x}$.`);
  } else if (kind === 1) {
    src = `\\box{?#q} \\cdot#d ${kp(a, "a")} =#e ${num(a * x)}#p`;
    solved = `\\green{${kp(x, "x")}} \\cdot#d ${kp(a, "a")} =#e ${num(a * x)}#p`;
    note = tx(`$${a * x} : ${par(a)} = ${x}$. Check: $${par(x)} \\cdot ${par(a)} = ${a * x}$.`, `$${a * x} : ${par(a)} = ${x}$. Probe: $${par(x)} \\cdot ${par(a)} = ${a * x}$.`);
  } else if (kind === 2) {
    // ? : a = x  →  ? = x · a
    src = `\\box{?#q} :#d ${kp(a, "a")} =#e ${num(x)}#p`;
    solved = `\\green{${kp(a * x, "x")}} :#d ${kp(a, "a")} =#e ${num(x)}#p`;
    note = tx(`Undo the division by multiplying: $${par(x)} \\cdot ${par(a)} = ${a * x}$.`, `Mach die Division rückgängig, indem du multiplizierst: $${par(x)} \\cdot ${par(a)} = ${a * x}$.`);
    slips.push({ v: x / a, title: tx("Divided instead of multiplied", "Dividiert statt multipliziert"), say: tx(`To undo dividing by $${par(a)}$, you **multiply** by $${par(a)}$.`, `Um die Division durch $${par(a)}$ rückgängig zu machen, **multiplizierst** du mit $${par(a)}$.`) });
  } else {
    // p : ? = x  →  ? = p : x
    src = `${kp(a * x, "a")} :#d \\box{?#q} =#e ${num(a)}#p`;
    solved = `${kp(a * x, "a")} :#d \\green{${kp(x, "x")}} =#e ${num(a)}#p`;
    note = tx(`$${a * x} : ${par(a)} = ${x}$. Check: $${par(a * x)} : ${par(x)} = ${a}$.`, `$${a * x} : ${par(a)} = ${x}$. Probe: $${par(a * x)} : ${par(x)} = ${a}$.`);
  }
  const value = kind === 2 ? a * x : x;
  slips = [
    {
      v: -value,
      title: SIGN_TITLE,
      say: tx(`Check with the sign rules: does the left side really give the right side with your number? Same signs give plus, different signs minus.`, `Mach die Probe mit den Vorzeichenregeln: Ergibt die linke Seite mit deiner Zahl wirklich die rechte? Gleiche Vorzeichen ergeben plus, verschiedene minus.`),
    },
    ...slips,
  ];
  return {
    instruction: tx("Fill in the gap", "Ergänze die Lücke"),
    math: src.replace(/#[A-Za-z0-9_-]+/g, "").replace(/(^|\(|= )- /g, "$1-"),
    answer: numberAnswer(value),
    hint: tx("Use the inverse operation, then decide the sign with the sign rules.", "Nimm die Umkehroperation und bestimm dann das Vorzeichen mit den Vorzeichenregeln."),
    solution: [
      { math: src, note: tx("Which number belongs in the box?", "Welche Zahl gehört in das Kästchen?") },
      { math: solved, note },
    ],
    mistakes: numberMistakes(value, slips),
  };
}

/** Decimals: multiply, divide, add. */
function decimalTask(rng: Rng): Exercise {
  for (let i = 0; i < 60; i++) {
    const B = builder();
    const kind = rng.int(0, 3);
    let root: Node;
    if (kind === 0) {
      const x = rng.pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.2, 1.5, 2.5, 0.25]);
      const y = rng.pick([2, 3, 4, 5, 6, 0.5, 0.4, 0.2]);
      root = B.op("*", B.n(x * rng.sign()), B.n(y * rng.sign()));
    } else if (kind === 1) {
      const x = rng.pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.2, 1.5, 2, 3, 4]);
      const y = rng.pick([2, 3, 4, 5, 0.5, 0.4, 0.2]);
      root = B.op(":", B.n(r9(x * y) * rng.sign()), B.n(y * rng.sign()));
    } else if (kind === 2) {
      root = B.op(rng.pick(["+", "-"] as const), B.n(-rng.int(5, 95) / 10), B.n(rng.int(5, 95) / 10 * rng.sign()));
    } else {
      const x = rng.pick([0.5, 1.5, 2.5, 0.4, 0.8]);
      root = B.op(rng.pick(["+", "-"] as const), B.op("*", B.n(-x), B.n(rng.pick([2, 3, 4, 6]))), B.n(rng.int(5, 45) / 10));
    }
    const right = evaluate(root);
    if (!hasNeg(root) || Math.abs(right) > 50 || r9(right * 100) % 1 !== 0 || right === 0) continue;
    const slips: Slip[] = [];
    if (root.t === "op" && (root.op === "*" || root.op === ":")) slips.push({ v: -right, title: SIGN_TITLE, say: signSay((evaluate(root.l) < 0 ? 1 : 0) + (evaluate(root.r) < 0 ? 1 : 0), root.op === ":") });
    if (root.t === "op" && (root.op === "+" || root.op === "-") && root.l.t === "n" && root.r.t === "n") {
      const a = root.l.v;
      const b = root.op === "+" ? root.r.v : -root.r.v;
      if (Math.sign(a) !== Math.sign(b))
        slips.push({
          v: -(Math.abs(a) + Math.abs(b)),
          title: tx("Went the wrong way", "In die falsche Richtung"),
          say: say((t, l) =>
            t(
              `You added $${num(Math.abs(a), l)}$ and $${num(Math.abs(b), l)}$ and kept the minus. But the two numbers pull in **different directions**: subtract and take the sign of the bigger one.`,
              `Du hast $${num(Math.abs(a), l)}$ und $${num(Math.abs(b), l)}$ addiert und das Minus behalten. Aber die beiden Zahlen ziehen in **verschiedene Richtungen**: Subtrahiere und nimm das Vorzeichen der größeren.`,
            ),
          ),
        });
      else slips.push({ v: r9(a - b), title: tx("Went the wrong way", "In die falsche Richtung"), say: tx("Both numbers point the same way on the number line: the result moves further from zero.", "Beide Zahlen zeigen auf der Zahlengeraden in dieselbe Richtung: Das Ergebnis entfernt sich weiter von der Null.") });
    }
    const slipped = steps(root, 0);
    if (kind === 3 && slipped.length) slips.push({ v: evaluate(slipped[slipped.length - 1].n), title: SIGN_TITLE, say: tx("Check the sign of the product first: minus times plus is **minus**.", "Prüf zuerst das Vorzeichen des Produkts: Minus mal plus ergibt **minus**.") });
    slips.push({ v: -right, title: SIGN_TITLE, say: tx("Nearly! Decide the sign first, then calculate without the signs.", "Fast! Bestimm zuerst das Vorzeichen, dann rechne ohne Vorzeichen."), close: true });
    return {
      instruction: tx("Calculate with decimals", "Rechne mit Dezimalzahlen"),
      math: dmath((l) => render(root, l, false)),
      answer: numberAnswer(right),
      hint: tx("The sign rules are the same as for whole numbers. Decide the sign first.", "Die Vorzeichenregeln sind dieselben wie bei ganzen Zahlen. Bestimm zuerst das Vorzeichen."),
      solution: solveFrames(root, tx("First the sign, then calculate without the signs.", "Zuerst das Vorzeichen, dann rechnest du ohne Vorzeichen.")),
      mistakes: numberMistakes(right, slips),
    };
  }
  return decimalTask(createRng(rng.int(1, 1e6)));
}

// Fractions -----------------------------------------------------------------

const fsrc = (f: Frac, bracket = false) => {
  const body = `\\frac{${Math.abs(f.n)}}{${f.d}}`;
  if (f.n >= 0) return body;
  return bracket ? `(-${body})` : `-${body}`;
};

/** A fraction as it stands, not reduced: "-\\frac{4}{12}". */
const fr = (n: number, d: number, bracket = false) => (n < 0 ? (bracket ? `(-\\frac{${-n}}{${d}})` : `-\\frac{${-n}}{${d}}`) : `\\frac{${n}}{${d}}`);

const FRACS: [number, number][] = [
  [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 8], [5, 8], [2, 9], [4, 9], [7, 10], [9, 10], [3, 2], [5, 4], [9, 4], [4, 3], [6, 5], [5, 12], [7, 12],
];

function fractionTask(rng: Rng): Exercise {
  for (let i = 0; i < 80; i++) {
    const kind = rng.pick(["mul", "div", "add", "sub"] as const);
    const [an, ad] = rng.pick(FRACS);
    const [bn, bd] = rng.pick(FRACS);
    const a = frac(an * (rng.chance(0.7) ? -1 : 1), ad);
    const b = frac(bn * (rng.chance(0.4) ? -1 : 1), bd);
    if (a.n > 0 && b.n > 0) continue;
    const r = kind === "mul" ? mul(a, b) : kind === "div" ? div(a, b) : kind === "add" ? add(a, b) : sub(a, b);
    if (r.d === 1 || r.n === 0 || r.d > 24 || Math.abs(r.n) > 30) continue;
    if ((kind === "add" || kind === "sub") && (ad === bd || (ad * bd) / gcdInt(ad, bd) > 24)) continue;
    const sym = kind === "mul" ? "\\cdot" : kind === "div" ? ":" : kind === "add" ? "+" : "-";
    const task = `${fsrc(a)} ${sym} ${fsrc(b, true)}`;
    const frames: Frame[] = [{ math: task, note: tx("Fractions follow the same sign rules.", "Für Brüche gelten dieselben Vorzeichenregeln.") }];
    const slips: { v: Frac; title: Text; say: Text }[] = [];
    if (kind === "mul" || kind === "div") {
      const bb = kind === "div" ? frac(b.d * Math.sign(b.n), Math.abs(b.n)) : b;
      const neg = (a.n < 0) !== (b.n < 0);
      if (kind === "div") frames.push({ math: `${fsrc(a)} \\cdot ${fsrc(bb, true)}`, note: tx("Dividing by a fraction: multiply by its reciprocal.", "Durch einen Bruch teilen: mit dem Kehrwert malnehmen.") });
      const top = Math.abs(a.n) * Math.abs(bb.n);
      const bottom = a.d * bb.d;
      frames.push({ math: `${neg ? "-" : ""}\\frac{${Math.abs(a.n)} \\cdot ${Math.abs(bb.n)}}{${a.d} \\cdot ${bb.d}}`, note: neg ? tx("Different signs: the result is negative.", "Verschiedene Vorzeichen: Das Ergebnis ist negativ.") : tx("Same signs: the result is positive.", "Gleiche Vorzeichen: Das Ergebnis ist positiv.") });
      const reducible = gcdInt(top, bottom) !== 1;
      frames.push({ math: `${neg ? "-" : ""}\\frac{${top}}{${bottom}}${reducible ? ` = ${fsrc(r)}` : ""}`, note: reducible ? tx("Multiply, then reduce the fraction.", "Multiplizieren, dann den Bruch kürzen.") : tx("Multiply. The fraction can't be reduced.", "Multiplizieren. Kürzen geht hier nicht.") });
      slips.push({ v: frac(-r.n, r.d), title: SIGN_TITLE, say: signSay((a.n < 0 ? 1 : 0) + (b.n < 0 ? 1 : 0), kind === "div") });
      if (kind === "div") {
        const m = mul(a, b);
        slips.push({ v: m, title: tx("No reciprocal", "Kehrwert vergessen"), say: tx("To divide by a fraction, multiply by its **reciprocal**: flip the second fraction first.", "Durch einen Bruch teilst du, indem du mit dem **Kehrwert** malnimmst: Dreh zuerst den zweiten Bruch um.") });
      }
    } else {
      const d = (a.d * b.d) / gcdInt(a.d, b.d);
      const an2 = (a.n * d) / a.d;
      const bn2 = (b.n * d) / b.d;
      const op = kind === "add" ? "+" : "-";
      frames.push({ math: `${fr(an2, d)} ${op} ${fr(bn2, d, true)}`, note: tx(`Common denominator ${d}.`, `Hauptnenner ${d}.`) });
      const top = kind === "add" ? an2 + bn2 : an2 - bn2;
      const inner = `${an2} ${op} ${bn2 < 0 ? `(${bn2})` : bn2}`;
      frames.push({ math: `\\frac{${inner}}{${d}}`, note: tx("Now calculate with the numerators like with whole numbers.", "Jetzt rechnest du mit den Zählern wie mit ganzen Zahlen.") });
      const reduced = gcdInt(top, d) !== 1;
      frames.push({
        math: `${fr(top, d)}${reduced ? ` = ${fsrc(r)}` : ""}`,
        note: reduced ? tx(`$${inner} = ${top}$. Then reduce.`, `$${inner} = ${top}$. Dann kürzen.`) : tx(`$${inner} = ${top}$.`, `$${inner} = ${top}$.`),
      });
      const naive = frac(kind === "add" ? a.n + b.n : a.n - b.n, a.d + b.d);
      if (naive.n !== 0) slips.push({ v: naive, title: tx("Added the denominators", "Nenner addiert"), say: tx("Oh no, you added the denominators too! Bring both fractions to a common denominator first, then only the numerators are added.", "Oh nein, du hast auch die Nenner addiert! Bring beide Brüche zuerst auf den Hauptnenner, dann werden nur die Zähler verrechnet.") });
      const eff = kind === "add" ? bn2 : -bn2;
      slips.push({
        v: frac(-r.n, r.d),
        title: SIGN_TITLE,
        say:
          an2 < 0 && eff < 0
            ? tx("Both parts are negative, so the result is negative too.", "Beide Teile sind negativ, also ist auch das Ergebnis negativ.")
            : an2 > 0 && eff > 0
              ? tx("Minus a negative number means plus: both parts are positive, so the result is positive too.", "Minus eine negative Zahl heißt plus: Beide Teile sind positiv, also ist auch das Ergebnis positiv.")
              : tx("Check the sign of the numerator: which part is bigger, the negative or the positive one?", "Prüf das Vorzeichen im Zähler: Welcher Teil ist größer, der negative oder der positive?"),
      });
    }
    const mistakes: Mistake[] = [];
    const seen = [r.n / r.d];
    for (const sl of slips) {
      const v = sl.v.n / sl.v.d;
      if (seen.some((x) => Math.abs(x - v) < 1e-9)) continue;
      seen.push(v);
      mistakes.push({ when: { kind: "fraction", n: sl.v.n, d: sl.v.d }, title: sl.title, say: sl.say });
    }
    return {
      instruction: tx("Calculate and reduce fully", "Berechne und kürze vollständig"),
      math: task,
      answer: { kind: "fraction", n: r.n, d: r.d, mustReduce: true },
      hint: tx("Put the minus sign of the result into the numerator, e.g. $\\frac{-3}{4}$.", "Schreib das Minus des Ergebnisses in den Zähler, z. B. $\\frac{-3}{4}$."),
      solution: frames,
      mistakes,
    };
  }
  return fractionTask(createRng(rng.int(1, 1e6)));
}

function gcdInt(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Word problems: multiplying changes, averages. */
function storyTask(rng: Rng): Exercise {
  const kind = rng.pick(["drop", "drop", "mean", "dive", "bank"] as const);
  const instruction = tx("Solve the word problem", "Löse die Textaufgabe");
  if (kind === "mean") {
    const n = rng.pick([4, 5]);
    let vals: number[] = [];
    for (let i = 0; i < 60; i++) {
      vals = Array.from({ length: n }, () => rng.int(-12, 8));
      const sum = vals.reduce((s, v) => s + v, 0);
      if (sum % n === 0 && sum < 0 && vals.some((v) => v > 0) && vals.filter((v) => v < 0).length >= 2) break;
    }
    const sum = vals.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const days = n === 4 ? tx("four days", "vier Tagen") : tx("five days", "fünf Tagen");
    const list = vals.map((v) => `$${v}$ °C`).join(", ");
    const sumSrc = vals.map((v, i) => (i ? `+ ${par(v)}` : num(v))).join(" ");
    return {
      instruction: tx("Calculate the average", "Berechne den Durchschnitt"),
      text: tx(`On ${(days as { en: string }).en} in winter, these morning temperatures were measured: ${list}. What was the average temperature?`, `An ${(days as { de: string }).de} im Winter wurden morgens diese Temperaturen gemessen: ${list}. Wie hoch war die Durchschnittstemperatur?`),
      answer: numberAnswer(mean, DEG),
      hint: tx("Add all the temperatures (mind the signs), then divide by the number of days.", "Addiere alle Temperaturen (achte auf die Vorzeichen) und teile dann durch die Anzahl der Tage."),
      solution: [
        { math: `(${sumSrc})#b : ${n}#n`, note: tx("Average = sum of all values : number of values.", "Durchschnitt = Summe aller Werte : Anzahl der Werte.") },
        { math: `${par(sum)}#s : ${n}#n`, note: tx(`The sum is $${sum}$.`, `Die Summe ist $${sum}$.`) },
        { math: `${par(sum)}#s : ${n}#n = ${mean}#r "°C"#u`, note: tx(`Negative divided by positive is negative: the average is $${mean}$ °C.`, `Negativ geteilt durch positiv ergibt negativ: Der Durchschnitt ist $${mean}$ °C.`) },
      ],
      mistakes: numberMistakes(
        mean,
        [
          { v: sum, title: tx("Forgot to divide", "Teilen vergessen"), say: tx(`$${sum}$ is the sum. For the average, divide it by the number of days, ${n}.`, `$${sum}$ ist die Summe. Für den Durchschnitt teilst du noch durch die Anzahl der Tage, also ${n}.`) },
          { v: r9(vals.reduce((s, v) => s + Math.abs(v), 0) / n), title: tx("Signs dropped", "Vorzeichen weggelassen"), say: tx("You left out the minus signs. Below-zero temperatures pull the average down.", "Du hast die Minuszeichen weggelassen. Temperaturen unter null ziehen den Durchschnitt nach unten.") },
          { v: -mean, title: SIGN_TITLE, say: tx("Nearly! The sum is negative, so the average is negative too.", "Fast! Die Summe ist negativ, also ist auch der Durchschnitt negativ."), close: true },
        ],
        DEG,
      ),
    };
  }
  if (kind === "drop") {
    // A cold evening: 2 or 3 degrees per hour, and below zero at the end.
    const k = rng.int(2, 3);
    const h = rng.int(2, 6);
    const t0 = rng.int(-4, Math.min(12, k * h - 1));
    const r = t0 - k * h;
    return {
      instruction,
      text: tx(`At 6 p.m. it is $${t0}$ °C. Then the temperature falls by ${k} degrees every hour. What is the temperature ${h} hours later?`, `Um 18 Uhr sind es $${t0}$ °C. Danach sinkt die Temperatur jede Stunde um ${k} Grad. Wie warm ist es ${h} Stunden später?`),
      answer: numberAnswer(r, DEG),
      hint: tx(`The change is ${h} times $-${k}$ degrees.`, `Die Änderung ist ${h}-mal $-${k}$ Grad.`),
      solution: [
        { math: `${num(t0)}#a + ${h}#h \\cdot (-#ks ${k}#k)#kb`, note: tx(`Start $${t0}$ °C, plus ${h} times a change of $-${k}$ degrees.`, `Start $${t0}$ °C, dazu ${h}-mal eine Änderung um $-${k}$ Grad.`) },
        { math: `${num(t0)}#a + (-#ks ${k * h}#k)#kb`, note: tx(`Point before line: $${h} \\cdot (-${k}) = -${k * h}$.`, `Punkt vor Strich: $${h} \\cdot (-${k}) = -${k * h}$.`) },
        { math: `${num(t0)}#a -#ks ${k * h}#k = ${num(r)}#r "°C"#u`, note: tx(`So it is $${r}$ °C after ${h} hours.`, `Nach ${h} Stunden sind es also $${r}$ °C.`) },
      ],
      mistakes: numberMistakes(
        r,
        [
          { v: t0 + k * h, title: tx("Wrong direction", "Falsche Richtung"), say: tx("The temperature **falls**, so the change is negative.", "Die Temperatur **sinkt**, die Änderung ist also negativ.") },
          { v: -k * h, title: tx("Start forgotten", "Start vergessen"), say: tx(`$${-k * h}$ degrees is only the change. Add it to the start temperature $${t0}$ °C.`, `$${-k * h}$ Grad ist nur die Änderung. Rechne sie zur Starttemperatur $${t0}$ °C dazu.`) },
          { v: t0 - k - h, title: tx("Multiply the change", "Änderung malnehmen"), say: tx(`${k} degrees every hour for ${h} hours: that's ${h} times ${k}, not ${k} plus ${h}.`, `${k} Grad pro Stunde, ${h} Stunden lang: Das ist ${h} mal ${k}, nicht ${k} plus ${h}.`) },
        ],
        DEG,
      ),
    };
  }
  if (kind === "dive") {
    const d0 = rng.pick([0, 0, 5, 10]);
    const k = rng.int(2, 6);
    const m = rng.int(3, 8);
    const r = -d0 - k * m;
    const start = d0 === 0 ? tx("at the surface", "an der Wasseroberfläche") : tx(`at $-${d0}$ m`, `bei $-${d0}$ m`);
    const s = start as { en: string; de: string };
    return {
      instruction,
      text: tx(`A diver starts ${s.en} and sinks ${k} m every minute. At what depth is she after ${m} minutes? (Give the height as a negative number.)`, `Eine Taucherin startet ${s.de} und sinkt jede Minute ${k} m tiefer. In welcher Tiefe ist sie nach ${m} Minuten? (Gib die Höhe als negative Zahl an.)`),
      answer: numberAnswer(r, "m"),
      hint: tx(`The change is ${m} times $-${k}$ m.`, `Die Änderung ist ${m}-mal $-${k}$ m.`),
      solution: [
        { math: `${num(-d0)}#a + ${m}#h \\cdot (-#ks ${k}#k)#kb`, note: tx(`${m} minutes, each $-${k}$ m.`, `${m} Minuten, jede $-${k}$ m.`) },
        { math: `${num(-d0)}#a -#ks ${k * m}#k = ${num(r)}#r "m"#u`, note: tx(`$${m} \\cdot (-${k}) = -${k * m}$, so she is at $${r}$ m.`, `$${m} \\cdot (-${k}) = -${k * m}$, sie ist also bei $${r}$ m.`) },
      ],
      mistakes: numberMistakes(
        r,
        [
          { v: -r, title: tx("Above or below?", "Über oder unter?"), say: tx("Below sea level means a **negative** height.", "Unter dem Meeresspiegel heißt: **negative** Höhe."), close: true },
          d0 !== 0 && { v: -k * m, title: tx("Start forgotten", "Start vergessen"), say: tx(`She didn't start at $0$ m but at $-${d0}$ m.`, `Sie ist nicht bei $0$ m gestartet, sondern bei $-${d0}$ m.`) },
          { v: -d0 - k - m, title: tx("Multiply the change", "Änderung malnehmen"), say: tx(`${k} m every minute for ${m} minutes: that's ${m} times ${k}.`, `${k} m pro Minute, ${m} Minuten lang: Das ist ${m} mal ${k}.`) },
        ],
        "m",
      ),
    };
  }
  let b0 = 0;
  let w = 0;
  let months = 0;
  for (let i = 0; i < 40; i++) {
    b0 = 10 * rng.int(2, 12);
    w = 5 * rng.int(3, 9);
    months = rng.int(3, 8);
    if (b0 - w * months < 0 && b0 - w * months >= -200) break;
  }
  const r = b0 - w * months;
  const name = rng.pick(["Lea", "Finn", "Elif", "Jonas", "Mia", "Can"]);
  return {
    instruction,
    text: tx(`${name} has $${b0}$ € in the account. Every month ${w} € are taken off for a subscription, and nothing is paid in. What is the balance after ${months} months?`, `${name} hat $${b0}$ € auf dem Konto. Jeden Monat werden ${w} € für ein Abo abgebucht, eingezahlt wird nichts. Wie hoch ist der Kontostand nach ${months} Monaten?`),
    answer: numberAnswer(r, EURO),
    hint: tx(`The change is ${months} times $-${w}$ €.`, `Die Änderung ist ${months}-mal $-${w}$ €.`),
    solution: [
      { math: `${b0}#a + ${months}#h \\cdot (-#ks ${w}#k)#kb`, note: tx(`${months} times a change of $-${w}$ €.`, `${months}-mal eine Änderung um $-${w}$ €.`) },
      { math: `${b0}#a -#ks ${w * months}#k = ${num(r)}#r "€"#u`, note: tx(`$${months} \\cdot (-${w}) = -${w * months}$, so the balance is $${r}$ €.`, `$${months} \\cdot (-${w}) = -${w * months}$, der Kontostand ist also $${r}$ €.`) },
    ],
    mistakes: numberMistakes(
      r,
      [
        { v: -w * months, title: tx("Start forgotten", "Start vergessen"), say: tx(`$${-w * months}$ € is only the change. ${name} started with ${b0} €.`, `$${-w * months}$ € ist nur die Änderung. ${name} hatte am Anfang ${b0} €.`) },
        { v: -r, title: tx("In debt or not?", "Schulden oder nicht?"), say: tx("Nearly! More was taken off than was in the account, so it's in the minus.", "Fast! Es wurde mehr abgebucht, als auf dem Konto war: Es ist im Minus."), close: true },
      ],
      EURO,
    ),
  };
}

/** Find the first wrong line in a worked calculation. */
function findMistakeTask(rng: Rng): Exercise {
  for (let i = 0; i < 60; i++) {
    const { root } = orderOpsRoot(rng);
    const right = evaluate(root);
    if (!Number.isInteger(right) || Math.abs(right) > 120 || !hasNeg(root)) continue;
    const good = steps(root);
    const evalCount = good.filter((s) => s.kind !== "merge").length;
    if (good.length < 2 || good.length > 4) continue;
    const ok = rng.chance(0.2);
    const slipAt = ok ? -1 : rng.int(0, evalCount - 1);
    const shown = steps(root, slipAt);
    if (shown.some((s) => s.calcs.some((c) => !Number.isInteger(c.v) || Math.abs(c.v) > 150))) continue;
    const plainOf = (n: Node) => render(n, "en", false);
    const badLine = ok ? -1 : shown.findIndex((s, j) => !good[j] || plainOf(s.n) !== plainOf(good[j].n));
    if (!ok && (badLine < 0 || evaluate(shown[shown.length - 1].n) === right)) continue;
    const name = rng.pick(["Tim", "Lena", "Emil", "Aylin", "Noah", "Ida"]);
    const lines = shown.map((s, j) => `"(${j + 1})" \\quad = ${render(s.n, "en", false)}`);
    const math = [render(root, "en", false), ...lines].join(" \\\\ ");
    const label = (j: number) => tx(`Line (${j + 1})`, `Zeile (${j + 1})`);
    const opts: Opt[] = shown.map((_, j) => {
      if (j === badLine) return { text: label(j), ok: true };
      if (badLine >= 0 && j > badLine)
        return { text: label(j), title: tx("The slip comes earlier", "Der Fehler steckt früher"), say: tx("This line follows correctly from the line before. The slip happens earlier.", "Diese Zeile folgt richtig aus der Zeile davor. Der Fehler passiert früher.") };
      return { text: label(j), title: tx("That line is right", "Diese Zeile stimmt"), say: tx("Check this line again with the sign rules: it is correct.", "Prüf diese Zeile noch mal mit den Vorzeichenregeln: Sie stimmt.") };
    });
    opts.push(
      ok
        ? { text: tx("There is no mistake", "Es gibt keinen Fehler"), ok: true }
        : { text: tx("There is no mistake", "Es gibt keinen Fehler"), title: tx("There is a slip", "Da steckt ein Fehler"), say: tx("There is a slip hidden in there. Check each line on its own with the sign rules.", "Da hat sich ein Fehler versteckt. Prüf jede Zeile einzeln mit den Vorzeichenregeln.") },
    );
    const { answer, mistakes } = choiceOf(opts);
    const frames = solveFrames(root, OPS_FIRST);
    const bad = badLine >= 0 ? shown[badLine] : null;
    const goodStep = badLine >= 0 ? good[badLine] : null;
    if (bad && goodStep) {
      frames.push({
        math: render(goodStep.n, "en"),
        highlight: goodStep.made,
        note: say((t, l) => {
          const right = goodStep.calcs.map((c) => `$${c.src(l)}$`).join(t(" and ", " und "));
          return t(`${name}'s slip is in line (${badLine + 1}): it should say ${right}.`, `${name}s Fehler steckt in Zeile (${badLine + 1}): Richtig ist ${right}.`);
        }),
      });
    } else {
      frames.push({ math: render(root, "en") + ` = ${num(right)}`, note: tx(`Every line is right: ${name} calculated correctly.`, `Jede Zeile stimmt: ${name} hat richtig gerechnet.`) });
    }
    return {
      instruction: tx("Find the mistake", "Finde den Fehler"),
      text: tx(`${name} calculated like this. In which line is the first mistake?`, `${name} hat so gerechnet. In welcher Zeile steckt der erste Fehler?`),
      math,
      answer,
      hint: tx("Check each line on its own: order of operations and sign rules.", "Prüf jede Zeile für sich: Rechenreihenfolge und Vorzeichenregeln."),
      solution: frames,
      mistakes,
    };
  }
  return twoFactorTask(rng);
}

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [1.4, () => twoFactorTask(rng)],
    [1.0, () => productTask(rng)],
    [0.7, () => signOnlyTask(rng)],
    [1.8, () => orderOpsTask(rng)],
    [0.8, () => gapTask(rng)],
    [1.0, () => decimalTask(rng)],
    [1.0, () => fractionTask(rng)],
    [1.0, () => storyTask(rng)],
    [0.8, () => findMistakeTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const B1 = builder("x");
const opsExample = B1.op("+", B1.n(-3), B1.op("*", B1.n(4), B1.n(-2)));
const B2 = builder("y");
const opsCheckRoot = B2.op("+", B2.op(":", B2.n(-20), B2.br(B2.op("-", B2.n(4), B2.n(9)))), B2.op("*", B2.n(3), B2.n(-2)));
const B3 = builder("z");
const decimalCheckRoot = B3.op("+", B3.op(":", B3.n(-0.8), B3.n(0.2)), B3.n(1.5));

const de = (l: Locale, en: string, d: string) => (l === "de" ? d : en);

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Multiplying with negative numbers", "Multiplizieren mit negativen Zahlen"),
      blob: tx("Multiplying is just fast adding. Let's see what that means for debts.", "Multiplizieren ist nur schnelles Addieren. Schauen wir, was das für Schulden heißt."),
      body: tx(
        "$3 \\cdot (-4)$ means three times the number $-4$, so $(-4) + (-4) + (-4)$. Three debts of 4 € are a debt of 12 €.",
        "$3 \\cdot (-4)$ heißt dreimal die Zahl $-4$, also $(-4) + (-4) + (-4)$. Dreimal 4 € Schulden sind 12 € Schulden.",
      ),
      frames: [
        { math: "3#a \\cdot#d (-#s 4#b)#k", note: tx("Three times $-4$: what does that mean?", "Dreimal $-4$: Was heißt das?") },
        { math: "(-#s 4#b)#k +#p1 (-#s2 4#b2)#k2 +#p2 (-#s3 4#b3)#k3", note: tx("Multiplying is repeated adding: the number $-4$, three times.", "Multiplizieren ist wiederholtes Addieren: dreimal die Zahl $-4$.") },
        { math: "-#s 12#b", note: tx("Three debts of 4 € make 12 € of debt: $3 \\cdot (-4) = -12$.", "Dreimal 4 € Schulden sind 12 € Schulden: $3 \\cdot (-4) = -12$.") },
        { math: "(-#s 4#a)#k \\cdot#d 3#b =#e -#s2 12#r", note: tx("Swapping the factors changes nothing: $(-4) \\cdot 3 = -12$ too. So **plus times minus is minus**.", "Vertauschen ändert nichts: Auch $(-4) \\cdot 3 = -12$. Also gilt: **Plus mal minus ergibt minus**.") },
      ],
    },
    {
      type: "widget",
      title: tx("Follow the pattern", "Folge dem Muster"),
      blob: tx("Now for the big mystery: what is minus times minus? Follow the pattern!", "Jetzt kommt das große Rätsel: Was ist minus mal minus? Folge dem Muster!"),
      body: tx(
        "Each row the first factor gets 1 smaller, and the result goes up by the same amount. If the pattern keeps going below zero, $(-1) \\cdot (-4)$ must be $+4$. That's why **minus times minus is plus**.",
        "In jeder Zeile wird der erste Faktor um 1 kleiner, und das Ergebnis steigt immer um denselben Wert. Geht das Muster unter null weiter, muss $(-1) \\cdot (-4)$ gleich $+4$ sein. Deshalb gilt: **Minus mal minus ergibt plus**.",
      ),
      widget: NegPattern,
    },
    {
      type: "explain",
      title: tx("The sign rules", "Die Vorzeichenregeln"),
      blob: tx("Two rules are all you need, for multiplying and for dividing.", "Zwei Regeln reichen, fürs Multiplizieren und fürs Dividieren."),
      body: tx("First decide the sign, then calculate with the numbers without their signs.", "Bestimm zuerst das Vorzeichen, dann rechne mit den Zahlen ohne Vorzeichen."),
      frames: [
        { math: "3 \\cdot 4 = \\green{12#r1} \\\\ 3 \\cdot (-4) = \\red{-#s2 12#r2} \\\\ (-3) \\cdot 4 = \\red{-#s3 12#r3} \\\\ (-3) \\cdot (-4) = \\green{12#r4}", note: tx("All four cases at a glance.", "Alle vier Fälle auf einen Blick.") },
        { math: "(+) \\cdot (+) = (+) \\quad (-) \\cdot (-) = (+)", note: tx("**Same signs**: the result is **positive**.", "**Gleiche Vorzeichen**: Das Ergebnis ist **positiv**.") },
        { math: "(+) \\cdot (-) = (-) \\quad (-) \\cdot (+) = (-)", note: tx("**Different signs**: the result is **negative**.", "**Verschiedene Vorzeichen**: Das Ergebnis ist **negativ**.") },
        { math: "(-#s 12#a)#k :#d 3#b =#e ?#q", note: tx("Dividing is multiplying backwards. Which number times $3$ gives $-12$?", "Dividieren ist Multiplizieren rückwärts. Welche Zahl mal $3$ ergibt $-12$?") },
        { math: "(-#s 12#a)#k :#d 3#b =#e -#rs 4#r", note: tx("$(-4) \\cdot 3 = -12$, so $(-12) : 3 = -4$. The same sign rules apply to dividing.", "$(-4) \\cdot 3 = -12$, also ist $(-12) : 3 = -4$. Fürs Dividieren gelten dieselben Vorzeichenregeln.") },
        { math: "(-#s 12#a)#k :#d (-#s2 3#b)#k2 =#e 4#r", note: tx("And $(-12) : (-3) = 4$, because $4 \\cdot (-3) = -12$.", "Und $(-12) : (-3) = 4$, denn $4 \\cdot (-3) = -12$.") },
      ],
    },
    {
      type: "check",
      blob: tx("Your turn. First the sign, then the number.", "Du bist dran. Erst das Vorzeichen, dann die Zahl."),
      exercise: {
        instruction: CALC,
        math: "(-6) \\cdot (-7)",
        answer: numberAnswer(42),
        hint: tx("Two negative factors: same signs.", "Zwei negative Faktoren: gleiche Vorzeichen."),
        solution: [
          { math: "(-#as 6#a)#ab \\cdot#d (-#bs 7#b)#bb", highlight: ["as", "bs"], note: tx("Same signs, so the result is positive.", "Gleiche Vorzeichen, also ist das Ergebnis positiv.") },
          { math: "6#a \\cdot#d 7#b =#e 42#r", note: tx("$6 \\cdot 7 = 42$.", "$6 \\cdot 7 = 42$.") },
        ],
        mistakes: numberMistakes(42, [
          { v: -42, title: tx("Minus times minus", "Minus mal minus"), say: signSay(2) },
          { v: -13, title: tx("Added instead of multiplied", "Addiert statt multipliziert"), say: tx("You added: $(-6) + (-7) = -13$. But here we multiply.", "Du hast addiert: $(-6) + (-7) = -13$. Hier wird aber multipliziert.") },
        ]),
      },
    },
    {
      type: "explain",
      title: tx("Several factors", "Mehrere Faktoren"),
      blob: tx("Lots of minus signs? Just count them!", "Viele Minuszeichen? Zähl sie einfach!"),
      body: tx(
        "Every two minus signs make a plus. So count the minus signs: an **even** number gives a positive product, an **odd** number a negative one.",
        "Je zwei Minuszeichen ergeben ein Plus. Zähl also die Minuszeichen: Eine **gerade** Anzahl ergibt ein positives Produkt, eine **ungerade** ein negatives.",
      ),
      frames: [
        { math: "(-#s1 2#a)#k1 \\cdot#d1 3#b \\cdot#d2 (-#s2 5#c)#k2 \\cdot#d3 (-#s3 1#e)#k3", note: tx("Four factors, three of them negative. First the sign, then the numbers.", "Vier Faktoren, drei davon negativ. Erst das Vorzeichen, dann die Zahlen.") },
        { math: "(-#s1 2#a)#k1 \\cdot#d1 3#b \\cdot#d2 (-#s2 5#c)#k2 \\cdot#d3 (-#s3 1#e)#k3", highlight: ["s1", "s2"], arrows: [["s1", "s2"]], note: tx("Two minus signs make a plus: they cancel as a pair.", "Zwei Minuszeichen ergeben plus: Als Paar heben sie sich auf.") },
        { math: "(-#s1 2#a)#k1 \\cdot#d1 3#b \\cdot#d2 (-#s2 5#c)#k2 \\cdot#d3 (-#s3 1#e)#k3", highlight: ["s3"], note: tx("One minus is left over, so the product is negative.", "Ein Minus bleibt übrig, also ist das Produkt negativ.") },
        { math: "-#s3 (2#a \\cdot#d1 3#b \\cdot#d2 5#c \\cdot#d3 1#e)#all", note: tx("Sign in front, then multiply the numbers without signs.", "Vorzeichen davor, dann die Zahlen ohne Vorzeichen malnehmen.") },
        { math: "-#s3 30#a", note: tx("Result: $-30$. Even number of minus signs: plus. Odd number: minus.", "Ergebnis: $-30$. Gerade Anzahl Minuszeichen: plus. Ungerade Anzahl: minus.") },
      ],
    },
    {
      type: "widget",
      title: tx("Count the minus signs", "Zähl die Minuszeichen"),
      blob: tx("Tap the factors to flip their signs. Watch the minus signs pair up!", "Tipp die Faktoren an, um ihre Vorzeichen zu wechseln. Schau, wie die Minuszeichen Paare bilden!"),
      body: tx("Each pair of minus signs turns into a plus. If one minus is left over, the product is negative.", "Jedes Paar Minuszeichen wird zu einem Plus. Bleibt ein Minus übrig, ist das Produkt negativ."),
      widget: NegSignCounter,
    },
    {
      type: "check",
      blob: tx("Count first, then multiply.", "Erst zählen, dann malnehmen."),
      exercise: {
        instruction: tx("Calculate the product", "Berechne das Produkt"),
        math: "(-2) \\cdot 5 \\cdot (-3) \\cdot (-2)",
        answer: numberAnswer(-60),
        hint: tx("Three minus signs: odd or even?", "Drei Minuszeichen: gerade oder ungerade?"),
        solution: [
          { math: "(-#f0s 2#f0)#f0b \\cdot#d1 5#f1 \\cdot#d2 (-#f2s 3#f2)#f2b \\cdot#d3 (-#f3s 2#f3)#f3b", highlight: ["f0s", "f2s", "f3s"], note: tx("Three minus signs: odd, so the product is negative.", "Drei Minuszeichen: ungerade, also ist das Produkt negativ.") },
          { math: "-#sg (2#f0 \\cdot#d1 5#f1 \\cdot#d2 3#f2 \\cdot#d3 2#f3)#all", note: tx("Sign in front, then the numbers.", "Vorzeichen davor, dann die Zahlen.") },
          { math: "-#sg 60#r", note: tx("$2 \\cdot 5 \\cdot 3 \\cdot 2 = 60$. Result: $-60$.", "$2 \\cdot 5 \\cdot 3 \\cdot 2 = 60$. Ergebnis: $-60$.") },
        ],
        mistakes: numberMistakes(-60, [{ v: 60, title: tx("Miscounted the minus signs", "Minuszeichen falsch gezählt"), say: signSay(3) }]),
      },
    },
    {
      type: "explain",
      title: tx("Order of operations", "Die Rechenreihenfolge"),
      blob: tx("Brackets first, then powers, then point before line. Same as always, now with minus signs.", "Klammer vor Potenz vor Punkt vor Strich. Wie immer, jetzt mit Minuszeichen."),
      body: tx(
        "The rules don't change for negative numbers: **brackets** first, then **powers**, then **multiplying and dividing**, and only then **adding and subtracting**.",
        "Für negative Zahlen ändern sich die Regeln nicht: zuerst **Klammern**, dann **Potenzen**, dann **Punktrechnung** ($\\cdot$ und $:$) und erst danach **Strichrechnung** ($+$ und $-$).",
      ),
      frames: [
        ...solveFrames(opsExample, tx("Which operation comes first?", "Welche Rechnung kommt zuerst?"), tx("If you had simply gone in order, ignoring point before line, you would get $1 \\cdot (-2) = -2$: wrong!", "Hättest du stur der Reihe nach gerechnet (ohne Punkt vor Strich), käme $1 \\cdot (-2) = -2$ heraus: falsch!")),
        { math: "(-3 + 4)#br \\cdot (-2) = 1 \\cdot (-2) = -2", note: tx("With brackets it's different: the bracket comes first.", "Mit Klammern ist es anders: Die Klammer kommt zuerst.") },
        { math: "2 - (-3)^2 = 2 - 9 = -7", note: tx("Powers before point and line: $(-3)^2 = (-3) \\cdot (-3) = 9$.", "Potenzen vor Punkt und Strich: $(-3)^2 = (-3) \\cdot (-3) = 9$.") },
      ],
    },
    {
      type: "check",
      blob: tx("A longer one. Take it step by step.", "Eine längere. Schritt für Schritt."),
      exercise: {
        instruction: tx("Mind the order of operations", "Beachte die Rechenreihenfolge"),
        math: render(opsCheckRoot, "en", false),
        answer: numberAnswer(-2),
        hint: tx("First the bracket $(4 - 9)$, then both point calculations, then the line calculation.", "Zuerst die Klammer $(4 - 9)$, dann beide Punktrechnungen, dann die Strichrechnung."),
        solution: solveFrames(opsCheckRoot, OPS_FIRST),
        mistakes: numberMistakes(-2, [
          { v: -14, title: tx("Point before line", "Punkt vor Strich"), say: tx("Ah, you worked from left to right. But $3 \\cdot (-2)$ has to be done **before** the addition.", "Ah, du hast von links nach rechts gerechnet. Aber $3 \\cdot (-2)$ kommt **vor** der Addition dran.") },
          { v: -10, title: SIGN_TITLE, say: tx("Check $(-20) : (-5)$: minus divided by minus is **plus**.", "Prüf $(-20) : (-5)$: Minus geteilt durch minus ergibt **plus**.") },
          { v: 10, title: SIGN_TITLE, say: tx("Check $3 \\cdot (-2)$: plus times minus is **minus**.", "Prüf $3 \\cdot (-2)$: Plus mal minus ergibt **minus**.") },
        ]),
      },
    },
    {
      type: "explain",
      title: tx("Fractions and decimals", "Brüche und Dezimalzahlen"),
      blob: tx("Good news: the rules stay exactly the same for fractions and decimals.", "Gute Nachricht: Für Brüche und Dezimalzahlen bleiben die Regeln genau gleich."),
      body: tx(
        "Positive and negative fractions and decimals together form the **rational numbers**. You calculate with them just like with whole numbers: first the sign, then the numbers without their signs.",
        "Positive und negative Brüche und Dezimalzahlen bilden zusammen die **rationalen Zahlen**. Du rechnest mit ihnen genau wie mit ganzen Zahlen: zuerst das Vorzeichen, dann die Zahlen ohne Vorzeichen.",
      ),
      frames: [
        { math: "-#m \\frac{3}{4} = \\frac{-3}{4} = \\frac{3}{-4}", note: tx("A negative fraction: the minus can stand in front, in the numerator or in the denominator. Usually it goes in front.", "Ein negativer Bruch: Das Minus kann davor, im Zähler oder im Nenner stehen. Meistens schreibt man es davor.") },
        { math: dmath((l) => `(-#s1 ${num(0.5, l)}#a)#k1 \\cdot#d (-#s2 ${num(0.4, l)}#b)#k2`), highlight: ["s1", "s2"], note: tx("Decimals: minus times minus is plus...", "Dezimalzahlen: Minus mal minus ergibt plus …") },
        { math: dmath((l) => `${num(0.5, l)}#a \\cdot#d ${num(0.4, l)}#b =#e ${num(0.2, l)}#r`), note: dmath((l) => de(l, "...then calculate as usual: $0.5 \\cdot 0.4 = 0.2$.", "… dann rechnest du wie gewohnt: $0,5 \\cdot 0,4 = 0,2$.")) },
        { math: "-\\frac{1}{2} + \\frac{3}{4}", note: tx("Adding: find a common denominator first.", "Addieren: Zuerst brauchst du einen gemeinsamen Nenner.") },
        { math: "-\\frac{2}{4} + \\frac{3}{4} = \\frac{-2 + 3}{4} = \\frac{1}{4}", note: tx("Then add the numerators like whole numbers: $-2 + 3 = 1$.", "Dann rechnest du mit den Zählern wie mit ganzen Zahlen: $-2 + 3 = 1$.") },
      ],
    },
    {
      type: "check",
      blob: tx("Last one! Decimals, a quotient and a sum.", "Die letzte! Dezimalzahlen, ein Quotient und eine Summe."),
      exercise: {
        instruction: tx("Calculate with decimals", "Rechne mit Dezimalzahlen"),
        math: dmath((l) => render(decimalCheckRoot, l, false)),
        answer: numberAnswer(-2.5),
        hint: dmath((l) => de(l, "Point before line: first $(-0.8) : 0.2$.", "Punkt vor Strich: zuerst $(-0,8) : 0,2$.")),
        solution: solveFrames(decimalCheckRoot, tx("Point before line: divide first.", "Punkt vor Strich: Zuerst wird dividiert.")),
        mistakes: numberMistakes(-2.5, [
          { v: -5.5, title: tx("Went the wrong way", "In die falsche Richtung"), say: dmath((l) => de(l, "$-4 + 1.5$: from $-4$ you go $1.5$ steps to the **right**, towards zero.", "$-4 + 1,5$: Von $-4$ aus gehst du $1,5$ Schritte nach **rechts**, Richtung Null.")) },
          { v: 5.5, title: SIGN_TITLE, say: dmath((l) => de(l, "Check $(-0.8) : 0.2$: minus divided by plus is **minus**.", "Prüf $(-0,8) : 0,2$: Minus geteilt durch plus ergibt **minus**.")) },
          { v: 1.1, title: tx("Decimal point slipped", "Komma verrutscht"), say: dmath((l) => de(l, "$0.8 : 0.2 = 4$, not $0.4$: how many times does $0.2$ fit into $0.8$?", "$0,8 : 0,2 = 4$, nicht $0,4$: Wie oft passt $0,2$ in $0,8$?")) },
        ]),
      },
    },
  ],
  summary: [
    {
      title: tx("Sign rules for multiplying and dividing", "Vorzeichenregeln beim Multiplizieren und Dividieren"),
      body: tx("Same signs give plus. Different signs give minus.", "Gleiche Vorzeichen ergeben plus. Verschiedene Vorzeichen ergeben minus."),
      examples: ["(-6) \\cdot (-7) = 42", "(-48) : 6 = -8", "(-12) : (-3) = 4"],
      tone: "rule",
    },
    {
      title: tx("Why minus times minus is plus", "Warum minus mal minus plus ergibt"),
      body: tx("Follow the pattern: each time the first factor drops by 1, the result goes up.", "Folge dem Muster: Jedes Mal, wenn der erste Faktor um 1 kleiner wird, steigt das Ergebnis."),
      examples: ["1 \\cdot (-4) = -4", "0 \\cdot (-4) = 0", "(-1) \\cdot (-4) = 4"],
      tone: "tip",
    },
    {
      title: tx("Several factors", "Mehrere Faktoren"),
      body: tx("Count the minus signs. Even: positive. Odd: negative.", "Zähl die Minuszeichen. Gerade Anzahl: positiv. Ungerade Anzahl: negativ."),
      examples: ["(-2) \\cdot 3 \\cdot (-5) \\cdot (-1) = -30"],
      tone: "rule",
    },
    {
      title: tx("Order of operations", "Rechenreihenfolge"),
      body: tx("Brackets, then powers, then point before line. Each number keeps its sign.", "Klammer vor Potenz vor Punkt vor Strich. Jede Zahl behält ihr Vorzeichen."),
      examples: ["-3 + 4 \\cdot (-2) = -11", "2 - (-3)^2 = -7"],
      tone: "rule",
    },
    {
      title: tx("Fractions and decimals", "Brüche und Dezimalzahlen"),
      body: tx("Decide the sign first, then calculate without the signs.", "Bestimm zuerst das Vorzeichen, dann rechne ohne Vorzeichen."),
      examples: [dmath((l) => `(-${num(0.5, l)}) \\cdot (-${num(0.4, l)}) = ${num(0.2, l)}`), "-\\frac{1}{2} + \\frac{3}{4} = \\frac{1}{4}"],
      tone: "tip",
    },
    {
      title: tx("Don't mix up the rules", "Bring die Regeln nicht durcheinander"),
      body: tx("Minus **times** minus is plus. But minus **plus** minus stays minus.", "Minus **mal** minus ergibt plus. Aber minus **plus** minus bleibt minus."),
      examples: ["(-3) \\cdot (-4) = 12", "(-3) + (-4) = -7"],
      tone: "warning",
    },
  ],
};
