"use client";

// Level 3 (Klasse 10 and Oberstufe): nth roots and rational exponents, root laws, rationalising
// denominators, logarithms and the log rules, lg and ln, exponential equations and change of base.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { asFrac, asNum, choice, collect, framesIn, gcdInt, kp, maths, pairOf, pp, say, weighted, type Lang, type Opt } from "./kit";
import { LogHunter } from "./LogHunter";
import { RationalPowers } from "./RationalPowers";

// ---------------------------------------------------------------------------
// Fractions as exponents

type Q = { n: number; d: number };

function q(n: number, d = 1): Q {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcdInt(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
}
const qAdd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qMul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qv = (a: Q) => a.n / a.d;
/** Display: "\frac{2}{3}", "-\frac{1}{2}", "5". */
const qs = (a: Q) => (a.d === 1 ? `${a.n}` : `${a.n < 0 ? "-" : ""}\\frac{${Math.abs(a.n)}}{${a.d}}`);
/** Keyed: "\frac{2}{3}#k", "-#ks \frac{1}{2}#k", "5#k". */
const qk = (a: Q, k: string) =>
  a.d === 1 ? (a.n < 0 ? `-#${k}s ${-a.n}#${k}` : `${a.n}#${k}`) : `${a.n < 0 ? `-#${k}s ` : ""}\\frac{${Math.abs(a.n)}}{${a.d}}#${k}`;

/** Root sign: \sqrt{…} for n = 2, else \sqrt[n]{…}. */
const rt = (n: number, inner: string) => (n === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${n}]{${inner}}`);
/** Keyed root (radical key R, index key `ik`). */
const rtk = (n: number, inner: string, R = "R", ik = "q") => (n === 2 ? `\\sqrt{${inner}}#${R}` : `\\sqrt[${n}#${ik}]{${inner}}#${R}`);

/** The log sign: \lg for base 10, \ln for e, else \log_{b} with a thin space after it. */
const LOG = (b: string) => (b === "10" ? "\\lg " : b === "e" ? "\\ln " : `\\log_{${b}} \\, `);

const r2 = (v: number) => Math.round(v * 100) / 100;
const stable = (v: number) => Number(v.toPrecision(12));
/** A calculator value shown in a worked solution: 6 significant digits, so the shown quotient gives the rounded answer. */
const sig6 = (v: number) => Number(v.toPrecision(6));
const lg = (v: number) => stable(Math.log10(v));

/** A rounded answer (2 decimal places) that accepts the correctly rounded value. */
const rounded = (v: number, label?: Text): AnswerSpec => ({ kind: "number", value: r2(v), tolerance: 0.0061 / Math.max(1, Math.abs(r2(v))), ...(label ? { label } : {}) });

// ---------------------------------------------------------------------------
// Instructions

const CALC = tx("Calculate without a calculator", "Berechne ohne Taschenrechner");
const AS_FRACTION = tx("Write as a fraction", "Schreib als Bruch");
const AS_POWER = tx("Write as a power of x", "Schreib als Potenz von x");
const ROOT_LAWS = tx("Simplify with the root laws", "Vereinfache mit den Wurzelgesetzen");
const RATIONAL = tx("Make the denominator rational", "Mach den Nenner rational");
const LOG_VALUE = tx("Calculate the logarithm", "Berechne den Logarithmus");
const LOG_RULES = tx("Use the log rules", "Wende die Logarithmengesetze an");
const SOLVE = tx("Solve the exponential equation", "Löse die Exponentialgleichung");
const SOLVE_CALC = tx("Solve. Round to 2 decimal places.", "Löse. Runde auf 2 Nachkommastellen.");
const CHANGE_BASE = tx("Calculate with lg. Round to 2 decimal places.", "Berechne mit lg. Runde auf 2 Nachkommastellen.");
const MATCH = tx("Match the equal terms", "Ordne die gleichwertigen Terme zu");
const WHICH = tx("Which statement is true?", "Welche Aussage ist richtig?");

const AS_FRACTION_TEXT = tx("Type $n$ as a fraction like 3/4, or as a whole number.", "Gib $n$ als Bruch wie 3/4 oder als ganze Zahl ein.");
const RESULT_FRACTION_TEXT = tx("Type the result as a fraction like 3/4 if needed.", "Gib das Ergebnis wenn nötig als Bruch wie 3/4 ein.");

// Shared mistake titles
const T_BASE_TIMES = tx("Base times exponent", "Basis mal Exponent");
const T_ONLY_ROOT = tx("Power missing", "Potenz fehlt");
const T_ONLY_POWER = tx("Root missing", "Wurzel fehlt");
const T_SWAPPED = tx("Numerator and denominator swapped", "Zähler und Nenner vertauscht");
const T_SIGN = tx("Sign of the exponent", "Vorzeichen vom Exponenten");
const T_NOT_DIVISION = tx("A log isn't a division", "Logarithmus ist keine Division");
const T_STOPPED = tx("One step missing", "Ein Schritt fehlt");
const T_DIVIDE_FIRST = tx("Divide first", "Erst teilen");
const T_MERGED = tx("Factor merged into the base", "Faktor in die Basis gezogen");
const T_LOG_QUOTIENT = tx("Quotient of logs", "Quotient von Logarithmen");
const T_UPSIDE = tx("Upside down", "Kehrwert erwischt");
const T_FRACTIONS = tx("Adding fractions", "Brüche addieren");
const T_NEEDS_LOG = tx("Division instead of a log", "Division statt Logarithmus");

const SWAPPED = tx(
  "Ah, I see what happened! You swapped numerator and denominator. In $a^{\\frac{m}{n}}$ the **denominator** $n$ is the root and the **numerator** $m$ is the power.",
  "Ah, ich seh, was passiert ist! Du hast Zähler und Nenner vertauscht. Bei $a^{\\frac{m}{n}}$ ist der **Nenner** $n$ die Wurzel und der **Zähler** $m$ die Potenz.",
);
/** log_b V asks "b to the power of what gives V?"; the student divided num by den (V by b unless given). */
const NOT_DIVISION = (b: string, V: string, num = V, den = b) =>
  tx(
    `I think I know what you did: you divided $${num}$ by $${den}$. But a logarithm asks for an **exponent**: $${b}$ to the power of what gives $${V}$?`,
    `Ich glaub, ich weiß, was du gemacht hast: Du hast $${num}$ durch $${den}$ geteilt. Der Logarithmus fragt aber nach einem **Exponenten**: $${b}$ hoch wie viel ergibt $${V}$?`,
  );

// ---------------------------------------------------------------------------
// 1. Rational exponents: 27^{2/3} = 9

/** base = r^qd, exponent p/qd (p, qd coprime). Style: fraction exponent, root sign, or decimal exponent. */
function ratPowEx(r: number, p: number, qd: number, style: "frac" | "root" | "dec"): Exercise {
  const base = r ** qd;
  const ap = Math.abs(p);
  const neg = p < 0;
  const e = q(p, qd);
  const val = r ** ap;
  const task = maths((L) => (style === "root" ? rt(qd, ap === 1 ? `${base}` : `${base}^{${ap}}`) : `${base}^{${style === "dec" ? L.n(p / qd) : qs(e)}}`));
  const rootOf = rt(qd, `${base}`);
  const asked = (L: Lang) => L.t(`Which number, raised to the power $${qd}$, gives $${base}$?`, `Welche Zahl hoch $${qd}$ ergibt $${base}$?`);
  const frames = framesIn((L) => {
    const out: Frame[] = [];
    if (style === "root" && ap === 1)
      // a plain nth root: no detour through the fraction exponent
      return [
        { math: rtk(qd, `${base}#b`), note: asked(L) },
        { math: `${r}#b`, note: L.t(`$${r}^{${qd}} = ${base}$, so $${rootOf} = ${r}$.`, `$${r}^{${qd}} = ${base}$, also ist $${rootOf} = ${r}$.`), highlight: ["b"] },
      ];
    if (style === "dec")
      out.push({
        math: `${base}#b^{${L.n(p / qd)}#x}`,
        note: L.t(`Write the exponent as a fraction: $${L.n(p / qd)} = ${qs(e)}$.`, `Schreib den Exponenten als Bruch: $${L.n(p / qd)} = ${qs(e)}$.`),
      });
    if (style === "root")
      out.push({
        math: rtk(qd, ap === 1 ? `${base}#b` : `${base}#b^{${ap}#p}`),
        note: L.t(
          `A root is a power with a fraction as exponent: $\\sqrt[n]{a^m} = a^{\\frac{m}{n}}$.`,
          `Eine Wurzel ist eine Potenz mit einem Bruch als Exponenten: $\\sqrt[n]{a^m} = a^{\\frac{m}{n}}$.`,
        ),
      });
    out.push({
      math: `${base}#b^{${qk(e, "x")}}`,
      note: neg
        ? L.t(`The minus means **one divided by**. Then: denominator $${qd}$ = root, numerator $${ap}$ = power.`, `Das Minus bedeutet **eins geteilt durch**. Dann gilt: Nenner $${qd}$ = Wurzel, Zähler $${ap}$ = Potenz.`)
        : L.t(`The denominator $${qd}$ tells you the root, the numerator $${ap}$ the power.`, `Der Nenner $${qd}$ gibt die Wurzel an, der Zähler $${ap}$ die Potenz.`),
    });
    const wrap = (inner: string) => (neg ? `\\frac{1#o}{${inner}}#F` : inner);
    const rootPow = ap === 1 ? rtk(qd, `${base}#b`) : `(${rtk(qd, `${base}#b`)})#br^{${ap}#p}`;
    out.push({
      math: wrap(rootPow),
      note: L.t(
        `$a^{\\frac{m}{n}} = (\\sqrt[n]{a})^m$. Root first: then the numbers stay small.`,
        `$a^{\\frac{m}{n}} = (\\sqrt[n]{a})^m$. Zuerst die Wurzel: Dann bleiben die Zahlen klein.`,
      ),
    });
    const result = neg ? L.t(` So the result is $\\frac{1}{${val}}$.`, ` Das Ergebnis ist also $\\frac{1}{${val}}$.`) : L.t(` So the result is $${val}$.`, ` Das Ergebnis ist also $${val}$.`);
    out.push({
      math: wrap(ap === 1 ? `${r}#b` : `${r}#b^{${ap}#p}`),
      note: L.t(`$${rootOf} = ${r}$, because $${r}^{${qd}} = ${base}$.`, `$${rootOf} = ${r}$, denn $${r}^{${qd}} = ${base}$.`) + (ap === 1 ? result : ""),
      highlight: ["b"],
    });
    if (ap > 1) out.push({ math: wrap(`${val}#b`), note: `$${r}^{${ap}} = ${val}$.` + result });
    return out;
  });
  const hint = tx(`Denominator = root, numerator = power: $${base}^{${qs(e)}} = (${rootOf})^{${p}}$.`, `Nenner = Wurzel, Zähler = Potenz: $${base}^{${qs(e)}} = (${rootOf})^{${p}}$.`);
  if (neg) {
    return {
      instruction: AS_FRACTION,
      math: task,
      answer: { kind: "fraction", n: 1, d: val },
      hint: tx("A negative exponent means one divided by the power. Then take the root first.", "Ein negativer Exponent bedeutet: eins geteilt durch die Potenz. Dann zuerst die Wurzel ziehen."),
      solution: frames,
      mistakes: collect(asFrac(1, val), (add) => {
        add(
          asFrac(-1, val),
          tx("Not a negative number", "Keine negative Zahl"),
          tx(
            "Ooh, classic trap! A negative exponent doesn't make the number negative. It means **one divided by** the power.",
            "Ooh, die klassische Falle! Ein negativer Exponent macht die Zahl nicht negativ. Er bedeutet: **eins geteilt durch** die Potenz.",
          ),
        );
        add(
          asFrac(val, 1),
          T_SIGN,
          tx(`Nearly! $${base}^{${qs(q(ap, qd))}} = ${val}$ is right, but the exponent has a **minus**: one divided by it.`, `Fast! $${base}^{${qs(q(ap, qd))}} = ${val}$ stimmt, aber der Exponent hat ein **Minus**: eins geteilt dadurch.`),
          true,
        );
        if (ap > 1) add(asFrac(1, r), T_ONLY_ROOT, tx(`The root is right! But the numerator $${ap}$ still asks for a power: $${r}^{${ap}}$.`, `Die Wurzel stimmt! Aber der Zähler $${ap}$ verlangt noch eine Potenz: $${r}^{${ap}}$.`), true);
      }),
    };
  }
  return {
    instruction: CALC,
    math: task,
    answer: { kind: "number", value: val },
    hint: style === "root" ? (ap === 1 ? say(asked) : tx(`$\\sqrt[n]{a^m} = (\\sqrt[n]{a})^m$. Root first.`, `$\\sqrt[n]{a^m} = (\\sqrt[n]{a})^m$. Zuerst die Wurzel.`)) : hint,
    solution: frames,
    mistakes: collect(asNum(val), (add) => {
      if (style !== "root")
        add(
          asNum((base * ap) / qd),
          T_BASE_TIMES,
          tx(
            `I think I know what you did: you multiplied $${base}$ by $${qs(e)}$. But a fraction in the exponent means **root and power**, not times.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast $${base}$ mal $${qs(e)}$ gerechnet. Ein Bruch im Exponenten bedeutet aber **Wurzel und Potenz**, nicht mal.`,
          ),
        );
      else if (ap === 1)
        add(
          asNum(base / qd),
          tx("Root is not division", "Wurzel ist keine Division"),
          tx(
            `I think I know what you did: you calculated $${base} : ${qd}$. But the ${qd === 3 ? "cube" : `${qd}th`} root isn't a ${qd === 3 ? "third" : qd === 4 ? "quarter" : "fifth"}: you want the number that gives $${base}$ when raised to the power $${qd}$.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast $${base} : ${qd}$ gerechnet. Die ${qd}. Wurzel ist aber nicht ${qd === 3 ? "ein Drittel" : qd === 4 ? "ein Viertel" : "ein Fünftel"}: Gesucht ist die Zahl, die hoch $${qd}$ genommen $${base}$ ergibt.`,
          ),
        );
      const isRoot = style === "root";
      if (ap > 1)
        add(
          asNum(r),
          T_ONLY_ROOT,
          isRoot
            ? tx(`The root is right: $${rootOf} = ${r}$! But under the root there's $${base}^{${ap}}$: raise the result to the power $${ap}$.`, `Die Wurzel stimmt: $${rootOf} = ${r}$! Unter der Wurzel steht aber $${base}^{${ap}}$: Nimm das Ergebnis noch hoch $${ap}$.`)
            : tx(`The root is right: $${rootOf} = ${r}$! Now the numerator $${ap}$: raise the result to that power.`, `Die Wurzel stimmt: $${rootOf} = ${r}$! Jetzt noch der Zähler $${ap}$: Nimm das Ergebnis hoch $${ap}$.`),
          true,
        );
      if (ap > 1 && base ** ap < 1e7)
        add(
          asNum(base ** ap),
          T_ONLY_POWER,
          isRoot
            ? tx(`You worked out $${base}^{${ap}} = ${base ** ap}$, good. But the ${qd === 2 ? "square" : qd === 3 ? "cube" : `${qd}th`} root is still missing.`, `Du hast $${base}^{${ap}} = ${base ** ap}$ ausgerechnet, gut. Aber die ${qd === 2 ? "Quadratwurzel" : `${qd}. Wurzel`} fehlt noch.`)
            : tx(`You raised $${base}$ to the power $${ap}$, good. But the denominator $${qd}$ still asks for a root.`, `Du hast $${base}$ hoch $${ap}$ genommen, gut. Aber der Nenner $${qd}$ verlangt noch eine Wurzel.`),
          true,
        );
      if (qd !== 2 && Number.isInteger(Math.sqrt(base)))
        add(
          asNum(Math.sqrt(base) ** ap),
          tx("Wrong root", "Falsche Wurzel"),
          style === "root"
            ? tx(`Nearly! You took the square root. Here it's the ${qd === 3 ? "cube" : `${qd}th`} root: look at the small $${qd}$ on the root sign.`, `Fast! Du hast die Quadratwurzel gezogen. Hier ist es die ${qd}. Wurzel: Schau auf die kleine $${qd}$ am Wurzelzeichen.`)
            : tx(`Nearly! You took the square root. The denominator $${qd}$ asks for the ${qd === 3 ? "cube" : `${qd}th`} root.`, `Fast! Du hast die Quadratwurzel gezogen. Der Nenner $${qd}$ verlangt die ${qd}. Wurzel.`),
        );
      const swapped = Math.pow(base, qd / ap);
      if (ap > 1 && Number.isInteger(Math.round(swapped * 1e6) / 1e6) && swapped < 1e7) add(asNum(Math.round(swapped)), T_SWAPPED, SWAPPED);
    }),
  };
}

// ---------------------------------------------------------------------------
// 2. Roots as powers: \sqrt[3]{x^2} = x^{2/3}

type PowerKind = "root" | "inv" | "prod" | "times" | "quot" | "nest";

function asPowerEx(kind: PowerKind, a: number, b: number): Exercise {
  // a, b: small numbers whose meaning depends on the kind (see below)
  let math: string;
  let res: Q;
  let frames: Frame[];
  const wrongs: [Q, Text, Text, boolean?][] = [];
  const x = "x";
  const toPow = tx("Write every root as a power: $\\sqrt[n]{x^m} = x^{\\frac{m}{n}}$.", "Schreib jede Wurzel als Potenz: $\\sqrt[n]{x^m} = x^{\\frac{m}{n}}$.");
  if (kind === "root" || kind === "inv") {
    // \sqrt[b]{x^a}  (or 1 over it)
    res = q(kind === "inv" ? -a : a, b);
    const inner = rtk(b, a === 1 ? `${x}#x` : `${x}#x^{${a}#p}`);
    const wrap = (s: string) => (kind === "inv" ? `\\frac{1#o}{${s}}#F` : s);
    math = kind === "inv" ? `\\frac{1}{${rt(b, a === 1 ? x : `${x}^{${a}}`)}}` : rt(b, a === 1 ? x : `${x}^{${a}}`);
    frames = [
      { math: wrap(inner), note: toPow },
      {
        // "1 : x^{a/b}" instead of a fraction: a raised fraction exponent below a fraction bar would touch the bar
        math: kind === "inv" ? `1#o :#dv ${x}#x^{\\frac{${a}}{${b}}#p}` : `${x}#x^{\\frac{${a}}{${b}}#p}`,
        note: tx(`The power $${a}$ goes on top, the root $${b}$ below: $${x}^{\\frac{${a}}{${b}}}$.`, `Die Potenz $${a}$ kommt nach oben, die Wurzel $${b}$ nach unten: $${x}^{\\frac{${a}}{${b}}}$.`),
      },
    ];
    if (kind === "inv")
      frames.push({ math: `${x}#x^{-#ps \\frac{${a}}{${b}}#p}`, note: tx("One divided by a power: the exponent gets a minus.", "Eins geteilt durch eine Potenz: Der Exponent bekommt ein Minus.") });
    if (res.d !== b) frames.push({ math: `${x}#x^{${qk(res, "p")}}`, note: tx(`Reduce: $\\frac{${a}}{${b}} = ${qs(q(a, b))}$.`, `Kürzen: $\\frac{${a}}{${b}} = ${qs(q(a, b))}$.`) });
    wrongs.push([q(kind === "inv" ? -b : b, a), T_SWAPPED, SWAPPED]);
    if (kind === "inv")
      wrongs.push([
        q(a, b),
        T_SIGN,
        tx("Nearly! The root is right, but it's **one divided by** it, so the exponent is negative.", "Fast! Die Wurzel stimmt, aber es heißt **eins geteilt durch**, also ist der Exponent negativ."),
        true,
      ]);
    else
      wrongs.push([
        q(a * b),
        T_BASE_TIMES,
        tx(`Careful: a root **divides** the exponent. $${rt(b, `x^{${a}}`)} = x^{${a} : ${b}}$, not $x^{${a} \\cdot ${b}}$.`, `Vorsicht: Eine Wurzel **teilt** den Exponenten. $${rt(b, `x^{${a}}`)} = x^{${a} : ${b}}$, nicht $x^{${a} \\cdot ${b}}$.`),
      ]);
  } else if (kind === "prod") {
    // \sqrt[a]{x} · \sqrt[b]{x} = x^{1/a + 1/b}
    res = qAdd(q(1, a), q(1, b));
    math = `${rt(a, x)} \\cdot ${rt(b, x)}`;
    frames = [
      { math: `${rtk(a, `${x}#x1`, "R1", "q1")} \\cdot#d ${rtk(b, `${x}#x2`, "R2", "q2")}`, note: toPow },
      { math: `${x}#x1^{\\frac{1}{${a}}#e1} \\cdot#d ${x}#x2^{\\frac{1}{${b}}#e2}`, note: tx("Two powers with the same base, multiplied: add the exponents.", "Zwei Potenzen mit gleicher Basis, multipliziert: Addiere die Exponenten.") },
      { math: `${x}#x1^{\\frac{1}{${a}}#e1 +#pl \\frac{1}{${b}}#e2}`, note: tx(`Common denominator $${(a * b) / gcdInt(a, b)}$.`, `Hauptnenner $${(a * b) / gcdInt(a, b)}$.`) },
      { math: `${x}#x1^{${qk(res, "e1")}}`, note: tx(`$\\frac{1}{${a}} + \\frac{1}{${b}} = ${qs(res)}$.`, `$\\frac{1}{${a}} + \\frac{1}{${b}} = ${qs(res)}$.`) },
    ];
    wrongs.push([
      q(2, a + b),
      T_FRACTIONS,
      tx(`Ooh, classic trap! You added top and bottom: $\\frac{1 + 1}{${a} + ${b}}$. Fractions need a common denominator first.`, `Ooh, die klassische Falle! Du hast Zähler und Nenner einzeln addiert: $\\frac{1 + 1}{${a} + ${b}}$. Brüche brauchen erst einen Hauptnenner.`),
    ]);
    wrongs.push([q(1, a * b), tx("Exponents multiplied", "Exponenten multipliziert"), tx("Ah, I see what happened! You multiplied the exponents. Powers with the same base are multiplied by **adding** the exponents.", "Ah, ich seh, was passiert ist! Du hast die Exponenten multipliziert. Bei gleicher Basis werden die Exponenten beim Multiplizieren **addiert**.")]);
    wrongs.push([q(1, a + b), T_FRACTIONS, tx(`Nearly! $\\frac{1}{${a}} + \\frac{1}{${b}}$ isn't $\\frac{1}{${a + b}}$. Use the common denominator.`, `Fast! $\\frac{1}{${a}} + \\frac{1}{${b}}$ ist nicht $\\frac{1}{${a + b}}$. Nimm den Hauptnenner.`)]);
  } else if (kind === "times" || kind === "quot") {
    // x^a · \sqrt[b]{x}  or  x^a / \sqrt[b]{x}
    const div = kind === "quot";
    res = div ? qAdd(q(a), q(-1, b)) : qAdd(q(a), q(1, b));
    const xa = pp(x, a);
    const xaK = kp(x, "x1", a, "e1");
    math = div ? `\\frac{${xa}}{${rt(b, x)}}` : `${xa} \\cdot ${rt(b, x)}`;
    const first = div ? `\\frac{${xaK}}{${rtk(b, `${x}#x2`)}}#F` : `${xaK} \\cdot#d ${rtk(b, `${x}#x2`)}`;
    // the quotient as "x^a : x^{1/b}": a raised fraction exponent below a fraction bar would touch the bar
    const second = div ? `${xaK} :#d ${x}#x2^{\\frac{1}{${b}}#e2}` : `${xaK} \\cdot#d ${x}#x2^{\\frac{1}{${b}}#e2}`;
    frames = [
      { math: first, note: toPow },
      { math: second, note: div ? tx("Same base, divided: subtract the exponents.", "Gleiche Basis, dividiert: Subtrahiere die Exponenten.") : tx("Same base, multiplied: add the exponents.", "Gleiche Basis, multipliziert: Addiere die Exponenten.") },
      { math: `${x}#x1^{${a}#e1 ${div ? "-" : "+"}#pl \\frac{1}{${b}}#e2}`, note: tx(`$${a} = \\frac{${a * b}}{${b}}$.`, `$${a} = \\frac{${a * b}}{${b}}$.`) },
      { math: `${x}#x1^{${qk(res, "e1")}}`, note: `$\\frac{${a * b}}{${b}} ${div ? "-" : "+"} \\frac{1}{${b}} = ${qs(res)}$.` },
    ];
    if (div) {
      wrongs.push([qAdd(q(a), q(1, b)), tx("Added instead of subtracted", "Addiert statt subtrahiert"), tx("Nearly! The root is **below** the fraction bar, so its exponent is subtracted.", "Fast! Die Wurzel steht **unter** dem Bruchstrich, also wird ihr Exponent subtrahiert."), true]);
      wrongs.push([q(a * b), tx("Exponents divided", "Exponenten dividiert"), tx(`I think I know what you did: you divided $${a} : \\frac{1}{${b}}$. Dividing powers with the same base means **subtracting** the exponents.`, `Ich glaub, ich weiß, was du gemacht hast: Du hast $${a} : \\frac{1}{${b}}$ gerechnet. Beim Dividieren von Potenzen mit gleicher Basis werden die Exponenten aber **subtrahiert**.`)]);
    } else {
      wrongs.push([q(a, b), tx("Exponents multiplied", "Exponenten multipliziert"), tx(`Ah, I see what happened! You multiplied $${a} \\cdot \\frac{1}{${b}}$. Multiplying powers with the same base means **adding** the exponents.`, `Ah, ich seh, was passiert ist! Du hast $${a} \\cdot \\frac{1}{${b}}$ gerechnet. Beim Multiplizieren von Potenzen mit gleicher Basis werden die Exponenten aber **addiert**.`)]);
      wrongs.push([q(a + 1, b), T_FRACTIONS, tx(`Nearly! $${a} + \\frac{1}{${b}}$ isn't $\\frac{${a} + 1}{${b}}$: write $${a}$ as $\\frac{${a * b}}{${b}}$ first.`, `Fast! $${a} + \\frac{1}{${b}}$ ist nicht $\\frac{${a} + 1}{${b}}$: Schreib $${a}$ zuerst als $\\frac{${a * b}}{${b}}$.`), true]);
    }
  } else {
    // nest: \sqrt[b]{x^a \sqrt{x}} = x^{(a + 1/2)/b}
    const innerE = qAdd(q(a), q(1, 2));
    res = qMul(innerE, q(1, b));
    const xaK = kp(x, "x1", a, "e1");
    math = rt(b, `${pp(x, a)} \\sqrt{${x}}`);
    frames = [
      { math: rtk(b, `${xaK} \\sqrt{${x}#x2}#R2`), note: tx("Work from the inside out. The inner root first.", "Arbeite von innen nach außen. Zuerst die innere Wurzel.") },
      { math: rtk(b, `${xaK} \\cdot#d ${x}#x2^{\\frac{1}{2}#e2}`), note: tx("$\\sqrt{x} = x^{\\frac{1}{2}}$.", "$\\sqrt{x} = x^{\\frac{1}{2}}$.") },
      { math: rtk(b, `${x}#x1^{${qk(innerE, "e1")}}`), note: tx(`Inside, add the exponents: $${a} + \\frac{1}{2} = ${qs(innerE)}$.`, `Innen die Exponenten addieren: $${a} + \\frac{1}{2} = ${qs(innerE)}$.`) },
      { math: `(${x}#x1^{${qk(innerE, "e1")}})#br^{\\frac{1}{${b}}#e3}`, note: tx(`The outer root is the power $\\frac{1}{${b}}$ of **everything** inside.`, `Die äußere Wurzel ist die Potenz $\\frac{1}{${b}}$ von **allem**, was darin steht.`) },
      { math: `${x}#x1^{${qk(res, "e1")}}`, note: tx(`Power of a power: $${qs(innerE)} \\cdot \\frac{1}{${b}} = ${qs(res)}$.`, `Potenz einer Potenz: $${qs(innerE)} \\cdot \\frac{1}{${b}} = ${qs(res)}$.`) },
    ];
    wrongs.push([
      qAdd(q(a, b), q(1, 2)),
      tx("Outer root only on one factor", "Äußere Wurzel nur auf einem Faktor"),
      tx(`Nearly! The outer root belongs to the **whole** product, $\\sqrt{x}$ included. Combine inside first, then divide by $${b}$.`, `Fast! Die äußere Wurzel gehört zum **ganzen** Produkt, auch zu $\\sqrt{x}$. Fass erst innen zusammen, dann teile durch $${b}$.`),
      true,
    ]);
    wrongs.push([q(a, b), tx("Inner root lost", "Innere Wurzel verloren"), tx("Hmm, the inner $\\sqrt{x}$ got lost. It's $x^{\\frac{1}{2}}$ and adds to the exponent inside.", "Hm, das innere $\\sqrt{x}$ ist verloren gegangen. Es ist $x^{\\frac{1}{2}}$ und kommt innen zum Exponenten dazu.")]);
  }
  frames[frames.length - 1].note = { en: `${(frames[frames.length - 1].note as { en: string }).en ?? ""} So $n = ${qs(res)}$.`.trim(), de: `${(frames[frames.length - 1].note as { de: string }).de ?? ""} Also ist $n = ${qs(res)}$.`.trim() };
  return {
    instruction: AS_POWER,
    text: AS_FRACTION_TEXT,
    math: `${math} = x^{\\blob{n}}`,
    answer: { kind: "number", value: qv(res), label: "n =" },
    hint: tx("Write roots as powers: $\\sqrt[n]{x} = x^{\\frac{1}{n}}$. Then use the power rules.", "Schreib Wurzeln als Potenzen: $\\sqrt[n]{x} = x^{\\frac{1}{n}}$. Dann helfen die Potenzgesetze."),
    solution: frames,
    mistakes: collect(asNum(qv(res)), (add) => wrongs.forEach(([w, title, msg, close]) => add(asNum(qv(w)), title, msg, close))),
  };
}

// ---------------------------------------------------------------------------
// 3. Root laws: \sqrt[3]{2} · \sqrt[3]{4} = 2

function rootLawEx(kind: "mul" | "div" | "nest", n: number, a: number, b: number): Exercise {
  if (kind === "nest") {
    // \sqrt[n]{\sqrt[b]{a}} = a^{1/(nb)}
    const k = n * b;
    const val = Math.round(Math.pow(a, 1 / k));
    return {
      instruction: ROOT_LAWS,
      math: rt(n, rt(b, `${a}`)),
      answer: { kind: "number", value: val },
      hint: tx("Write both roots as powers and multiply the exponents.", "Schreib beide Wurzeln als Potenzen und multipliziere die Exponenten."),
      solution: [
        { math: rtk(n, rtk(b, `${a}#a`, "R2", "q2"), "R1", "q1"), note: tx("A root of a root.", "Eine Wurzel aus einer Wurzel.") },
        { math: `(${a}#a^{\\frac{1}{${b}}#e2})#br^{\\frac{1}{${n}}#e1}`, note: tx("As powers: the inner root is the exponent $\\frac{1}{" + b + "}$, the outer one $\\frac{1}{" + n + "}$.", "Als Potenzen: Die innere Wurzel ist der Exponent $\\frac{1}{" + b + "}$, die äußere $\\frac{1}{" + n + "}$.") },
        { math: `${a}#a^{\\frac{1}{${k}}#e1} =#eq ${rt(k, `${a}`)}`, note: tx(`Power of a power: multiply, $\\frac{1}{${b}} \\cdot \\frac{1}{${n}} = \\frac{1}{${k}}$.`, `Potenz einer Potenz: multiplizieren, $\\frac{1}{${b}} \\cdot \\frac{1}{${n}} = \\frac{1}{${k}}$.`) },
        { math: `${val}#a`, note: tx(`$${val}^{${k}} = ${a}$, so the result is $${val}$.`, `$${val}^{${k}} = ${a}$, also ist das Ergebnis $${val}$.`) },
      ],
      mistakes: collect(asNum(val), (add) => {
        for (const only of [b, n]) {
          const v = Math.pow(a, 1 / only);
          if (Math.abs(v - Math.round(v)) < 1e-9)
            add(asNum(Math.round(v)), tx("One root missing", "Eine Wurzel fehlt"), tx("Good start! But there are **two** roots. After the first one, take the second.", "Guter Anfang! Aber es sind **zwei** Wurzeln. Nach der ersten kommt noch die zweite."), true);
        }
        const s = Math.pow(a, 1 / (n + b));
        if (Math.abs(s - Math.round(s)) < 1e-9)
          add(asNum(Math.round(s)), tx("Root indices added", "Wurzelexponenten addiert"), tx(`Careful: a root of a root **multiplies** the indices: $\\frac{1}{${b}} \\cdot \\frac{1}{${n}}$, not $${b} + ${n}$.`, `Vorsicht: Bei einer Wurzel aus einer Wurzel werden die Wurzelexponenten **multipliziert**: $\\frac{1}{${b}} \\cdot \\frac{1}{${n}}$, nicht $${b} + ${n}$.`));
      }),
    };
  }
  const div = kind === "div";
  const inside = div ? a / b : a * b;
  const val = Math.round(Math.pow(inside, 1 / n));
  const op = div ? ":" : "\\cdot";
  return {
    instruction: ROOT_LAWS,
    math: div ? `\\frac{${rt(n, `${a}`)}}{${rt(n, `${b}`)}}` : `${rt(n, `${a}`)} \\cdot ${rt(n, `${b}`)}`,
    answer: { kind: "number", value: val },
    hint: div
      ? tx("Same root index: $\\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}}$.", "Gleicher Wurzelexponent: $\\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}}$.")
      : tx("Same root index: $\\sqrt[n]{a} \\cdot \\sqrt[n]{b} = \\sqrt[n]{a \\cdot b}$.", "Gleicher Wurzelexponent: $\\sqrt[n]{a} \\cdot \\sqrt[n]{b} = \\sqrt[n]{a \\cdot b}$."),
    solution: [
      {
        math: div ? `\\frac{${rtk(n, `${a}#a`, "R1", "q1")}}{${rtk(n, `${b}#b`, "R2", "q2")}}#F` : `${rtk(n, `${a}#a`, "R1", "q1")} \\cdot#d ${rtk(n, `${b}#b`, "R2", "q2")}`,
        note: tx(`Neither root is a whole number on its own. But both have the same index $${n}$.`, `Keine der Wurzeln ist für sich eine ganze Zahl. Aber beide haben denselben Wurzelexponenten $${n}$.`),
      },
      { math: rtk(n, div ? `\\frac{${a}#a}{${b}#b}#F` : `${a}#a \\cdot#d ${b}#b`, "R1", "q1"), note: tx("So they go under one root.", "Also kommen sie unter eine Wurzel.") },
      { math: rtk(n, `${inside}#a`, "R1", "q1"), note: `$${a} ${op} ${b} = ${inside}$.` },
      { math: `${val}#a`, note: tx(`$${val}^{${n}} = ${inside}$, so the result is $${val}$.`, `$${val}^{${n}} = ${inside}$, also ist das Ergebnis $${val}$.`) },
    ],
    mistakes: collect(asNum(val), (add) => {
      add(asNum(inside), T_STOPPED, tx(`One root for both was right: $${rt(n, `${a} ${op} ${b}`)}$. But you still have to take the root of $${inside}$!`, `Beide unter eine Wurzel, richtig: $${rt(n, `${a} ${op} ${b}`)}$. Aber aus $${inside}$ musst du noch die Wurzel ziehen!`), true);
      const sq = Math.sqrt(inside);
      if (n !== 2 && Number.isInteger(sq)) add(asNum(sq), tx("Wrong root", "Falsche Wurzel"), tx(`Nearly! That's the square root. Here the root index is $${n}$.`, `Fast! Das ist die Quadratwurzel. Hier ist der Wurzelexponent $${n}$.`), true);
    }),
  };
}

// ---------------------------------------------------------------------------
// 4. Rationalising denominators

/** k / √b = a√b (k = a·b). */
function rationalSimpleEx(a: number, b: number): Exercise {
  const k = a * b;
  return {
    instruction: RATIONAL,
    math: `\\frac{${k}}{\\sqrt{${b}}} = \\blob{u} \\sqrt{\\blob{v}}`,
    answer: { kind: "pair", names: ["u", "v"], values: [a, b] },
    hint: tx(`Expand the fraction with $\\sqrt{${b}}$.`, `Erweitere den Bruch mit $\\sqrt{${b}}$.`),
    solution: [
      { math: `\\frac{${k}#k}{\\sqrt{${b}#b}#R}#F`, note: tx("A root in the denominator. Expand with exactly that root.", "Eine Wurzel im Nenner. Erweitere mit genau dieser Wurzel.") },
      { math: `\\frac{${k}#k \\cdot#d1 \\sqrt{${b}#c}#R2}{\\sqrt{${b}#b}#R \\cdot#d2 \\sqrt{${b}#c2}#R3}#F`, note: tx(`Top and bottom times $\\sqrt{${b}}$: the value stays the same.`, `Zähler und Nenner mal $\\sqrt{${b}}$: Der Wert bleibt gleich.`) },
      { math: `\\frac{${k}#k \\sqrt{${b}#c}#R2}{${b}#b}#F`, note: tx(`$\\sqrt{${b}} \\cdot \\sqrt{${b}} = ${b}$: the root below is gone.`, `$\\sqrt{${b}} \\cdot \\sqrt{${b}} = ${b}$: Die Wurzel im Nenner ist weg.`) },
      { math: `${a === 1 ? "" : `${a}#k `}\\sqrt{${b}#c}#R2`, note: tx(`Cancel: $${k} : ${b} = ${a}$. So $u = ${a}$ and $v = ${b}$.`, `Kürzen: $${k} : ${b} = ${a}$. Also ist $u = ${a}$ und $v = ${b}$.`) },
    ],
    mistakes: collect(pairOf(["u", "v"])(a, b), (add) => {
      add(pairOf(["u", "v"])(k, b), tx("Not cancelled yet", "Noch nicht gekürzt"), tx(`Good, the root is out of the denominator! But now there's a $${b}$ below: cancel it with the $${k}$.`, `Gut, die Wurzel ist aus dem Nenner raus! Aber jetzt steht unten eine $${b}$: Kürze sie mit der $${k}$.`), true);
      add(
        pairOf(["u", "v"])(a, 1),
        tx("Only the denominator expanded", "Nur den Nenner erweitert"),
        tx(`Careful: expanding means top **and** bottom times $\\sqrt{${b}}$. The numerator becomes $${k}\\sqrt{${b}}$, so the root stays in the result.`, `Vorsicht: Erweitern heißt Zähler **und** Nenner mal $\\sqrt{${b}}$. Im Zähler steht dann $${k}\\sqrt{${b}}$, die Wurzel bleibt also im Ergebnis.`),
      );
    }),
  };
}

/** k / (c√b) = u√b / v (reduced, v > 1). */
function rationalFracEx(k: number, c: number, b: number): Exercise | null {
  const den = c * b;
  const g = gcdInt(k, den);
  const u = k / g;
  const v = den / g;
  if (v === 1) return null;
  const at = pairOf(["u", "v"]);
  const cS = c === 1 ? "" : `${c}`;
  return {
    instruction: RATIONAL,
    math: `\\frac{${k}}{${cS}\\sqrt{${b}}} = \\frac{\\blob{u} \\sqrt{${b}}}{\\blob{v}}`,
    answer: { kind: "pair", names: ["u", "v"], values: [u, v] },
    hint: tx(`Expand with $\\sqrt{${b}}$, then reduce the fraction.`, `Erweitere mit $\\sqrt{${b}}$ und kürze dann.`),
    solution: [
      { math: `\\frac{${k}#k}{${c === 1 ? "" : `${c}#c `}\\sqrt{${b}#b}#R}#F`, note: tx(`Expand with $\\sqrt{${b}}$.`, `Erweitere mit $\\sqrt{${b}}$.`) },
      {
        math: `\\frac{${k}#k \\sqrt{${b}#e}#R2}{${c === 1 ? "" : `${c}#c \\cdot#dc `}\\sqrt{${b}#b}#R \\cdot#d \\sqrt{${b}#e2}#R3}#F`,
        note: tx(`Top and bottom times $\\sqrt{${b}}$.`, `Zähler und Nenner mal $\\sqrt{${b}}$.`),
      },
      { math: `\\frac{${k}#k \\sqrt{${b}#e}#R2}{${den}#b}#F`, note: tx(`$${c === 1 ? "" : `${c} \\cdot `}\\sqrt{${b}} \\cdot \\sqrt{${b}} = ${den}$.`, `$${c === 1 ? "" : `${c} \\cdot `}\\sqrt{${b}} \\cdot \\sqrt{${b}} = ${den}$.`) },
      {
        math: `\\frac{${u === 1 ? "" : `${u}#k `}\\sqrt{${b}#e}#R2}{${v}#b}#F`,
        note: g > 1 ? tx(`Reduce by $${g}$. So $u = ${u}$ and $v = ${v}$.`, `Kürze mit $${g}$. Also ist $u = ${u}$ und $v = ${v}$.`) : tx(`Nothing to reduce. So $u = ${u}$ and $v = ${v}$.`, `Hier lässt sich nichts kürzen. Also ist $u = ${u}$ und $v = ${v}$.`),
      },
    ],
    mistakes: collect(at(u, v), (add) => {
      if (g > 1) add(at(k, den), tx("Not reduced yet", "Noch nicht gekürzt"), tx(`Right value, nice! Now reduce: $${k}$ and $${den}$ share the factor $${g}$.`, `Richtiger Wert, stark! Jetzt noch kürzen: $${k}$ und $${den}$ haben den gemeinsamen Teiler $${g}$.`), true);
      add(at(k, c * b * b), tx("Root times root", "Wurzel mal Wurzel"), tx(`Careful: $\\sqrt{${b}} \\cdot \\sqrt{${b}} = ${b}$, not $${b * b}$.`, `Vorsicht: $\\sqrt{${b}} \\cdot \\sqrt{${b}} = ${b}$, nicht $${b * b}$.`));
      if (c > 1) add(at(u * c, v), tx("Number in front lost", "Faktor davor verloren"), tx(`Nearly! The $${c}$ in front of the root stays in the denominator.`, `Fast! Die $${c}$ vor der Wurzel bleibt im Nenner stehen.`), true);
    }),
  };
}

/** k / (√b ∓ c) = u√b + v via the third binomial formula. `minus`: the denominator is √b − c. */
function rationalBinomEx(k: number, b: number, c: number, minus: boolean): Exercise | null {
  const D = b - c * c;
  if (D === 0 || k % D !== 0) return null;
  const m = k / D;
  const s = minus ? 1 : -1; // sign of c in the expansion factor
  const u = m;
  const v = m * s * c;
  const at = pairOf(["u", "v"]);
  const op = minus ? "-" : "+";
  const opp = minus ? "+" : "-";
  return {
    instruction: RATIONAL,
    text: tx("Write the result as $u\\sqrt{" + b + "} + v$ ($v$ may be negative).", "Schreib das Ergebnis als $u\\sqrt{" + b + "} + v$ ($v$ darf negativ sein)."),
    math: `\\frac{${k}}{\\sqrt{${b}} ${op} ${c}} = \\blob{u} \\sqrt{${b}} + \\blob{v}`,
    answer: { kind: "pair", names: ["u", "v"], values: [u, v] },
    hint: tx(`Expand with $\\sqrt{${b}} ${opp} ${c}$: third binomial formula.`, `Erweitere mit $\\sqrt{${b}} ${opp} ${c}$: dritte binomische Formel.`),
    solution: [
      {
        math: `\\frac{${k}#k}{\\sqrt{${b}#b}#R ${op}#s ${c}#c}#F`,
        note: tx("A root plus or minus a number below. Expanding with the root alone won't help here.", "Unten steht eine Wurzel plus oder minus eine Zahl. Mit der Wurzel allein zu erweitern hilft hier nicht."),
      },
      {
        math: `\\frac{${k}#k (\\sqrt{${b}#b2}#R2 ${opp}#s2 ${c}#c2)#br2}{(\\sqrt{${b}#b}#R ${op}#s ${c}#c)#br1 (\\sqrt{${b}#b3}#R3 ${opp}#s3 ${c}#c3)#br3}#F`,
        note: tx(`Expand with $\\sqrt{${b}} ${opp} ${c}$: the same terms with the **opposite sign**.`, `Erweitere mit $\\sqrt{${b}} ${opp} ${c}$: dieselben Glieder mit dem **anderen Vorzeichen**.`),
      },
      {
        math: `\\frac{${k}#k (\\sqrt{${b}#b2}#R2 ${opp}#s2 ${c}#c2)#br2}{${b}#b -#s ${c * c}#c}#F`,
        note: tx(`Third binomial formula: $(a - b)(a + b) = a^2 - b^2$, here $${b} - ${c * c} = ${D}$. No root left below!`, `Dritte binomische Formel: $(a - b)(a + b) = a^2 - b^2$, hier $${b} - ${c * c} = ${D}$. Unten keine Wurzel mehr!`),
      },
      {
        math: `${u === 1 ? "" : u === -1 ? "-#k " : `${u}#k `}\\sqrt{${b}#b2}#R2 ${v < 0 ? "-" : "+"}#s2 ${Math.abs(v)}#c2`,
        note: tx(
          `Divide by $${D}$${D === 1 ? "" : ` ($\\frac{${k}}{${D}} = ${m}$)`} and multiply out. So $u = ${u}$ and $v = ${v}$.`,
          `Durch $${D}$ teilen${D === 1 ? "" : ` ($\\frac{${k}}{${D}} = ${m}$)`} und ausmultiplizieren. Also ist $u = ${u}$ und $v = ${v}$.`,
        ),
      },
    ],
    mistakes: collect(at(u, v), (add) => {
      add(at(u, -v), tx("Signs mixed up", "Vorzeichen durcheinander"), tx(`Nearly! You have to expand with the **opposite** sign: $\\sqrt{${b}} ${opp} ${c}$. That sign then shows up in the result.`, `Fast! Du musst mit dem **anderen** Vorzeichen erweitern: $\\sqrt{${b}} ${opp} ${c}$. Dieses Vorzeichen steht dann auch im Ergebnis.`), true);
      if (D !== 1) add(at(k, k * s * c), T_STOPPED, tx(`Good expansion! But the denominator is now $${D}$: divide by it.`, `Gut erweitert! Aber im Nenner steht jetzt $${D}$: Teile noch dadurch.`), true);
      const D2 = b + c * c;
      if (k % D2 === 0) add(at(k / D2, (k / D2) * s * c), tx("Third binomial formula", "Dritte binomische Formel"), tx(`Careful: $(\\sqrt{${b}} - ${c})(\\sqrt{${b}} + ${c}) = ${b} - ${c * c}$, a **minus**.`, `Vorsicht: $(\\sqrt{${b}} - ${c})(\\sqrt{${b}} + ${c}) = ${b} - ${c * c}$, mit **Minus**.`));
    }),
  };
}

// ---------------------------------------------------------------------------
// 5. The value of a logarithm: log_2 32 = 5

type LogKind = "pow" | "inv" | "frac" | "root" | "dec" | "ln";

/** Builds log tasks. b: base, k: exponent; frac uses b = g^i, value = j/i. */
function logValueEx(kind: LogKind, b: number, k: number, j = 1): Exercise {
  const B = String(b);
  if (kind === "frac") {
    // log_{g^i} g^j = j/i with g = b, i = k
    const base = b ** k;
    const arg = b ** j;
    const res = q(j, k);
    return {
      instruction: LOG_VALUE,
      text: RESULT_FRACTION_TEXT,
      math: `${LOG(String(base))}${arg}`,
      answer: { kind: "number", value: qv(res) },
      hint: tx(`Write both numbers as powers of $${b}$.`, `Schreib beide Zahlen als Potenzen von $${b}$.`),
      solution: [
        { math: `${LOG(String(base))}${arg}#v`, note: tx(`The question: $${base}$ to the power of what gives $${arg}$?`, `Die Frage: $${base}$ hoch wie viel ergibt $${arg}$?`) },
        { math: `${base}#B^{\\blob{y}#y} =#eq ${arg}#v`, note: tx(`Both are powers of $${b}$: $${base} = ${b}^{${k}}$ and $${arg} = ${b}^{${j}}$.`, `Beide sind Potenzen von $${b}$: $${base} = ${b}^{${k}}$ und $${arg} = ${b}^{${j}}$.`) },
        { math: `(${b}#g^{${k}#k})#br^{y#y} =#eq ${b}#g2^{${j}#j}`, note: tx(`So $${k} \\cdot y = ${j}$.`, `Also gilt $${k} \\cdot y = ${j}$.`) },
        { math: `y#y =#eq ${qk(res, "r")}`, note: tx(`$y = ${qs(res)}$. Check: $${base}^{${qs(res)}} = ${arg}$.`, `$y = ${qs(res)}$. Probe: $${base}^{${qs(res)}} = ${arg}$.`) },
      ],
      mistakes: collect(asNum(qv(res)), (add) => {
        add(asNum(k / j), T_UPSIDE, tx(`Ah, I see what happened! You found $${arg}^{?} = ${base}$. But the question is the other way round: $${base}^{?} = ${arg}$.`, `Ah, ich seh, was passiert ist! Du hast $${arg}^{?} = ${base}$ gelöst. Die Frage ist aber andersherum: $${base}^{?} = ${arg}$.`));
        if (base % arg === 0) add(asNum(base / arg), T_NOT_DIVISION, NOT_DIVISION(String(base), String(arg), String(base), String(arg)));
      }),
    };
  }
  const isLn = kind === "ln";
  const sym = isLn ? "e" : B;
  const logS = LOG(sym);
  let math: Text;
  let res: Q;
  let argPow: string; // the argument written as a power of the base
  let argPlain: Text;
  if (kind === "pow") {
    res = q(k);
    argPlain = String(b ** k);
    argPow = `${B}^{${k}}`;
    math = `${logS}${b ** k}`;
  } else if (kind === "inv") {
    res = q(-k);
    argPlain = `\\frac{1}{${b ** k}}`;
    argPow = `${B}^{-${k}}`;
    math = `${logS}\\frac{1}{${b ** k}}`;
  } else if (kind === "dec") {
    res = q(-k);
    argPlain = maths((L) => L.n(10 ** -k));
    argPow = `10^{-${k}}`;
    math = maths((L) => `\\lg ${L.n(10 ** -k)}`);
  } else if (kind === "root") {
    // log_b \sqrt[j]{b^k} = k/j
    res = q(k, j);
    argPlain = rt(j, k === 1 ? B : `${b ** k}`);
    argPow = `${B}^{${qs(res)}}`;
    math = `${logS}${rt(j, k === 1 ? B : `${b ** k}`)}`;
  } else {
    // ln: e^k, 1/e^k or \sqrt{e}
    res = j === 2 ? q(1, 2) : q(k);
    argPlain = j === 2 ? "\\sqrt{e}" : k < 0 ? `\\frac{1}{e^{${-k}}}` : `e^{${k}}`;
    argPow = `e^{${qs(res)}}`;
    math = `\\ln ${argPlain}`;
  }
  const mathEn = typeof math === "string" ? math : math.en;
  const mathDe = typeof math === "string" ? math : math.de;
  const argEn = typeof argPlain === "string" ? argPlain : argPlain.en;
  const argDe = typeof argPlain === "string" ? argPlain : argPlain.de;
  const frames: Frame[] = [
    {
      math: mathEn === mathDe ? mathEn : { en: mathEn, de: mathDe },
      note: tx(`The logarithm asks: $${sym}$ to the power of what gives $${argEn}$?`, `Der Logarithmus fragt: $${sym}$ hoch wie viel ergibt $${argDe}$?`),
    },
    {
      math: { en: `${sym}#B^{\\blob{y}#y} =#eq ${argEn}#v`, de: `${sym}#B^{\\blob{y}#y} =#eq ${argDe}#v` },
      note:
        kind === "inv"
          ? tx(`Use $\\frac{1}{${b}^{${k}}} = ${b}^{-${k}}$.`, `Nutze $\\frac{1}{${b}^{${k}}} = ${b}^{-${k}}$.`)
          : kind === "root"
            ? tx(`A root is a power: $${argEn} = ${argPow}$.`, `Eine Wurzel ist eine Potenz: $${argDe} = ${argPow}$.`)
            : kind === "dec"
              ? tx(`$${argEn} = \\frac{1}{${10 ** k}} = 10^{-${k}}$.`, `$${argDe} = \\frac{1}{${10 ** k}} = 10^{-${k}}$.`)
              : tx(`Write $${argEn}$ as a power of $${sym}$.`, `Schreib $${argDe}$ als Potenz von $${sym}$.`),
    },
    {
      math: { en: `${sym}#B^{${qk(res, "y")}} =#eq ${argEn}#v`, de: `${sym}#B^{${qk(res, "y")}} =#eq ${argDe}#v` },
      note: tx(`$${argEn} = ${argPow}$, so the exponent is $${qs(res)}$.`, `$${argDe} = ${argPow}$, der Exponent ist also $${qs(res)}$.`),
    },
    { math: { en: `${mathEn} =#eq ${qk(res, "y")}`, de: `${mathDe} =#eq ${qk(res, "y")}` }, note: tx(`So $${mathEn} = ${qs(res)}$.`, `Also ist $${mathDe} = ${qs(res)}$.`) },
  ];
  return {
    instruction: LOG_VALUE,
    ...(res.d > 1 ? { text: RESULT_FRACTION_TEXT } : {}),
    math: mathEn === mathDe ? mathEn : { en: mathEn, de: mathDe },
    answer: { kind: "number", value: qv(res) },
    hint: tx(`$${sym}$ to the power of what gives the number? Write it as a power of $${sym}$.`, `$${sym}$ hoch wie viel ergibt die Zahl? Schreib sie als Potenz von $${sym}$.`),
    solution: frames,
    mistakes: collect(asNum(qv(res)), (add) => {
      if (kind === "pow" && (b ** k) % b === 0 && b !== 10) add(asNum((b ** k) / b), T_NOT_DIVISION, NOT_DIVISION(B, String(b ** k)));
      if (kind === "pow" && b === 10) add(asNum(k + 1), tx("Counted the digits", "Ziffern gezählt"), tx(`Nearly! $\\lg$ counts the zeros: $10^{${k}}$ has $${k}$ zeros, not $${k + 1}$ digits.`, `Fast! $\\lg$ zählt die Nullen: $10^{${k}}$ hat $${k}$ Nullen, nicht $${k + 1}$ Ziffern.`), true);
      if (kind === "inv" || kind === "dec" || (isLn && k < 0))
        add(asNum(-qv(res)), T_SIGN, tx("Nearly! The number is smaller than $1$, so the exponent has to be **negative**: $\\frac{1}{a^k} = a^{-k}$.", "Fast! Die Zahl ist kleiner als $1$, also muss der Exponent **negativ** sein: $\\frac{1}{a^k} = a^{-k}$."), true);
      if (kind === "dec" && k > 1)
        add(asNum(-(k - 1)), tx("Count places, not zeros", "Stellen zählen, nicht Nullen"), tx(`Nearly! Count the places after the comma, not the zeros: the $1$ sits at place $${k}$.`, `Fast! Zähl die Stellen nach dem Komma, nicht die Nullen: Die $1$ steht an der $${k}$. Stelle.`), true);
      if (kind === "root") {
        add(asNum(k), T_ONLY_POWER, tx("Nearly! The root is a power too: $\\sqrt[n]{a} = a^{\\frac{1}{n}}$. It changes the exponent.", "Fast! Auch die Wurzel ist eine Potenz: $\\sqrt[n]{a} = a^{\\frac{1}{n}}$. Sie verändert den Exponenten."), true);
        add(asNum(k * j), T_SWAPPED, tx(`Careful: a root **divides** the exponent by $${j}$, it doesn't multiply it.`, `Vorsicht: Eine Wurzel **teilt** den Exponenten durch $${j}$, sie multipliziert ihn nicht.`));
      }
    }),
  };
}

// ---------------------------------------------------------------------------
// 6. Log rules: lg 4 + lg 25 = 2

type RuleKind = "sum" | "diff" | "power" | "coef" | "half" | "change";

function logRuleEx(kind: RuleKind, b: number, u: number, v: number): Exercise {
  const B = String(b);
  const lgOf = (x: string | number) => `${LOG(B)}${x}`;
  let math: string;
  let res: number;
  let frames: Frame[];
  let stop: number | null = null;
  let stopMsg: Text = "";
  const extra: [number, Text, Text, boolean?][] = [];
  const asPowerNote = (V: number, k: number) => tx(`$${V} = ${B}^{${k}}$, so the logarithm is $${k}$.`, `$${V} = ${B}^{${k}}$, der Logarithmus ist also $${k}$.`);
  if (kind === "sum" || kind === "diff") {
    const V = kind === "sum" ? u * v : u / v;
    res = Math.round(Math.log(V) / Math.log(b));
    const op = kind === "sum" ? "+" : "-";
    const inner = kind === "sum" ? `(${u} \\cdot ${v})` : `\\frac{${u}}{${v}}`;
    math = `${lgOf(u)} ${op} ${lgOf(v)}`;
    frames = [
      { math: `${lgOf(`${u}#u`)} ${op}#op ${lgOf(`${v}#v`)}`, note: kind === "sum" ? tx("Neither log is nice on its own. **Product rule** backwards: a sum of logs is the log of the product.", "Keiner der Logarithmen ist für sich schön. **Produktregel** rückwärts: Eine Summe von Logarithmen ist der Logarithmus des Produkts.") : tx("**Quotient rule** backwards: a difference of logs is the log of the quotient.", "**Quotientenregel** rückwärts: Eine Differenz von Logarithmen ist der Logarithmus des Quotienten.") },
      { math: kind === "sum" ? `${LOG(B)}(${u}#u \\cdot#op ${v}#v)#br` : `${LOG(B)}\\frac{${u}#u}{${v}#v}#F`, note: kind === "sum" ? tx(`$${lgOf("u")} + ${lgOf("v")} = ${lgOf("(u \\cdot v)")}$.`, `$${lgOf("u")} + ${lgOf("v")} = ${lgOf("(u \\cdot v)")}$.`) : tx(`$${lgOf("u")} - ${lgOf("v")} = ${lgOf("\\frac{u}{v}")}$.`, `$${lgOf("u")} - ${lgOf("v")} = ${lgOf("\\frac{u}{v}")}$.`) },
      { math: `${lgOf(`${V}#u`)}`, note: `$${kind === "sum" ? `${u} \\cdot ${v}` : `${u} : ${v}`} = ${V}$.` },
      { math: `${lgOf(`${V}#u`)} =#eq ${res}#r`, note: asPowerNote(V, res) },
    ];
    stop = V;
    stopMsg = tx(`The ${kind === "sum" ? "product" : "quotient"} rule worked: $${LOG(B)}${inner} = ${lgOf(V)}$! Now one step more: $${B}$ to the power of what gives $${V}$?`, `Die ${kind === "sum" ? "Produktregel" : "Quotientenregel"} hat geklappt: $${LOG(B)}${inner} = ${lgOf(V)}$! Jetzt noch ein Schritt: $${B}$ hoch wie viel ergibt $${V}$?`);
    if (kind === "diff") extra.push([-res, tx("Subtracted the wrong way round", "Andersrum subtrahiert"), tx(`Nearly! It's $${lgOf(u)} - ${lgOf(v)} = ${LOG(B)}\\frac{${u}}{${v}}$: first number on top.`, `Fast! Es gilt $${lgOf(u)} - ${lgOf(v)} = ${LOG(B)}\\frac{${u}}{${v}}$: die erste Zahl nach oben.`), true]);
  } else if (kind === "power") {
    // log_b (u^v) with u = b^j
    const j = Math.round(Math.log(u) / Math.log(b));
    res = v * j;
    math = `${LOG(B)}(${u}^{${v}})`;
    frames = [
      { math: `${LOG(B)}(${u}#u^{${v}#r})#br`, note: tx("**Power rule**: the exponent comes down in front as a factor.", "**Potenzregel**: Der Exponent wandert als Faktor nach vorn.") },
      { math: `${v}#r \\cdot#d ${lgOf(`${u}#u`)}`, note: tx(`$${LOG(B)}(${u}^{${v}}) = ${v} \\cdot ${lgOf(u)}$.`, `$${LOG(B)}(${u}^{${v}}) = ${v} \\cdot ${lgOf(u)}$.`) },
      { math: `${v}#r \\cdot#d ${j}#u`, note: asPowerNote(u, j) },
      { math: `${res}#r`, note: `$${v} \\cdot ${j} = ${res}$.` },
    ];
    extra.push([v + j, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("Ah, I see what happened! The power rule gives a **factor**: $\\log_b (u^r) = r \\cdot \\log_b u$. Multiply, don't add.", "Ah, ich seh, was passiert ist! Die Potenzregel liefert einen **Faktor**: $\\log_b (u^r) = r \\cdot \\log_b u$. Multiplizieren, nicht addieren.")]);
    if (j > 1) extra.push([j ** v, tx("Log raised to a power", "Logarithmus potenziert"), tx(`Careful: $\\log_b (u^r) = r \\cdot \\log_b u$, not $(\\log_b u)^r$. The $${v}$ becomes a factor.`, `Vorsicht: $\\log_b (u^r) = r \\cdot \\log_b u$, nicht $(\\log_b u)^r$. Die $${v}$ wird ein Faktor.`)]);
  } else if (kind === "coef") {
    // 2 log u + log v
    const V = u * u * v;
    res = Math.round(Math.log(V) / Math.log(b));
    math = `2 ${lgOf(u)} + ${lgOf(v)}`;
    frames = [
      { math: `2#t ${lgOf(`${u}#u`)} +#op ${lgOf(`${v}#v`)}`, note: tx("**Power rule** backwards: a factor in front becomes an exponent.", "**Potenzregel** rückwärts: Ein Faktor davor wird zum Exponenten.") },
      { math: `${lgOf(`${u}#u^{2#t}`)} +#op ${lgOf(`${v}#v`)}`, note: tx(`$2 ${lgOf(u)} = ${lgOf(`${u}^2`)} = ${lgOf(u * u)}$.`, `$2 ${lgOf(u)} = ${lgOf(`${u}^2`)} = ${lgOf(u * u)}$.`) },
      { math: `${LOG(B)}(${u * u}#u \\cdot#op ${v}#v)#br`, note: tx("**Product rule** backwards.", "**Produktregel** rückwärts.") },
      { math: `${lgOf(`${V}#u`)} =#eq ${res}#r`, note: asPowerNote(V, res) },
    ];
    stop = V;
    stopMsg = tx(`The rules worked: $${lgOf(V)}$! Now: $${B}$ to the power of what gives $${V}$?`, `Die Gesetze hast du richtig angewendet: $${lgOf(V)}$! Jetzt noch: $${B}$ hoch wie viel ergibt $${V}$?`);
    const w = 2 * u * v;
    const lw = Math.log(w) / Math.log(b);
    if (Math.abs(lw - Math.round(lw)) < 1e-9) extra.push([Math.round(lw), tx("Factor 2 inside", "Faktor 2 hineingezogen"), tx(`Careful: $2 ${lgOf(u)} = ${lgOf(`${u}^2`)}$, not $${lgOf(`(2 \\cdot ${u})`)}$. The factor becomes an **exponent**.`, `Vorsicht: $2 ${lgOf(u)} = ${lgOf(`${u}^2`)}$, nicht $${lgOf(`(2 \\cdot ${u})`)}$. Der Faktor wird zum **Exponenten**.`)]);
  } else if (kind === "half") {
    // 1/2 log V with V = b^(2k): u = V
    const full = Math.round(Math.log(u) / Math.log(b));
    res = full / 2;
    math = `\\frac{1}{2} ${lgOf(u)}`;
    frames = [
      { math: `\\frac{1}{2}#h ${lgOf(`${u}#u`)}`, note: tx(`First the log: $${u} = ${B}^{${full}}$.`, `Zuerst der Logarithmus: $${u} = ${B}^{${full}}$.`) },
      { math: `\\frac{1}{2}#h \\cdot#d ${full}#u`, note: tx(`$${lgOf(u)} = ${full}$.`, `$${lgOf(u)} = ${full}$.`) },
      { math: `${res}#u`, note: tx(`Half of it: $${res}$. (Or: $\\frac{1}{2} ${lgOf(u)} = ${LOG(B)}\\sqrt{${u}}$.)`, `Die Hälfte davon: $${res}$. (Oder: $\\frac{1}{2} ${lgOf(u)} = ${LOG(B)}\\sqrt{${u}}$.)`) },
    ];
    extra.push([full, tx("The ½ got lost", "Das ½ ist verloren gegangen"), tx(`The log is right: $${lgOf(u)} = ${full}$! Don't forget the $\\frac{1}{2}$ in front.`, `Der Logarithmus stimmt: $${lgOf(u)} = ${full}$! Vergiss das $\\frac{1}{2}$ davor nicht.`), true]);
    extra.push([u / 2, T_NOT_DIVISION, tx(`I think you halved $${u}$. But the $\\frac{1}{2}$ multiplies the **logarithm**: work out $${lgOf(u)}$ first.`, `Ich glaub, du hast $${u}$ halbiert. Aber das $\\frac{1}{2}$ multipliziert den **Logarithmus**: Rechne zuerst $${lgOf(u)}$ aus.`)]);
  } else {
    // change: lg V / lg b  (u = V) or with ln
    const useLn = v === 1;
    const s = useLn ? "\\ln" : "\\lg";
    const k = Math.round(Math.log(u) / Math.log(b));
    res = k;
    math = `\\frac{${s} ${u}}{${s} ${b}}`;
    frames = [
      { math: `\\frac{${s} ${u}#u}{${s} ${b}#b}#F`, note: tx("**Change of base** backwards: a quotient of two logs with the same base.", "**Basiswechsel** rückwärts: ein Quotient zweier Logarithmen mit derselben Basis.") },
      { math: `\\log_{${b}#b} \\, ${u}#u`, note: tx(`$\\frac{${s} x}{${s} b} = \\log_b x$.`, `$\\frac{${s} x}{${s} b} = \\log_b x$.`) },
      { math: `\\log_{${b}#b} \\, ${u}#u =#eq ${k}#r`, note: tx(`$${b}^{${k}} = ${u}$, so the result is $${k}$.`, `$${b}^{${k}} = ${u}$, also ist das Ergebnis $${k}$.`) },
    ];
    extra.push([u / b, tx("Logs cancelled", "Logarithmen gekürzt"), tx(`Ooh, classic trap! You can't cancel ${useLn ? "ln" : "lg"} like a factor: $\\frac{${s} ${u}}{${s} ${b}}$ is not $\\frac{${u}}{${b}}$. It's $\\log_{${b}} ${u}$.`, `Ooh, die klassische Falle! ${useLn ? "ln" : "lg"} kannst du nicht wie einen Faktor kürzen: $\\frac{${s} ${u}}{${s} ${b}}$ ist nicht $\\frac{${u}}{${b}}$, sondern $\\log_{${b}} ${u}$.`)]);
  }
  return {
    instruction: LOG_RULES,
    math,
    answer: { kind: "number", value: res },
    hint:
      kind === "change"
        ? tx("$\\log_b x = \\frac{\\lg x}{\\lg b}$, read backwards.", "$\\log_b x = \\frac{\\lg x}{\\lg b}$, rückwärts gelesen.")
        : tx("Combine everything into one logarithm first, then work it out.", "Fass zuerst alles zu einem einzigen Logarithmus zusammen, dann rechne ihn aus."),
    solution: frames,
    mistakes: collect(asNum(res), (add) => {
      if (stop !== null) add(asNum(stop), T_STOPPED, stopMsg, true);
      for (const [w, t, m, c] of extra) add(asNum(w), t, m, c);
    }),
  };
}

// ---------------------------------------------------------------------------
// 7. Exponential equations without a calculator: 2^{x+1} = 32

type ExactKind = "plain" | "shift" | "times" | "coef" | "bases" | "twox";

function expExactEx(kind: ExactKind, p: { b: number; k: number; c?: number; m?: number; a?: number; g?: number; i?: number; j?: number }): Exercise {
  const { b, k } = p;
  const at = asNum;
  let math: string;
  let x: Q;
  let frames: Frame[];
  const wrongs: [number, Text, Text, boolean?][] = [];
  const V = b ** Math.abs(k);
  const Vs = k < 0 ? `\\frac{1}{${V}}` : `${V}`;
  const asPow = k < 0 ? tx(`$\\frac{1}{${V}} = ${b}^{-${-k}}$.`, `$\\frac{1}{${V}} = ${b}^{-${-k}}$.`) : tx(`$${V} = ${b}^{${k}}$.`, `$${V} = ${b}^{${k}}$.`);
  const compare = tx("Same base on both sides: the exponents must be equal.", "Gleiche Basis auf beiden Seiten: Die Exponenten müssen gleich sein.");
  if (kind === "plain") {
    x = q(k);
    math = `${b}^{x} = ${Vs}`;
    frames = [
      { math: `${b}#b^{x#x} =#eq ${Vs}#v`, note: tx(`Write $${Vs}$ as a power of $${b}$.`, `Schreib $${Vs}$ als Potenz von $${b}$.`) },
      { math: `${b}#b^{x#x} =#eq ${b}#b2^{${k}#v}`, note: asPow },
      { math: `x#x =#eq ${k}#v`, note: compare },
    ];
    if (k > 0) wrongs.push([V / b, T_NOT_DIVISION, tx(`I think I know what you did: you divided $${V} : ${b}$. But $x$ is the **exponent**: $${b}$ to the power of what gives $${V}$?`, `Ich glaub, ich weiß, was du gemacht hast: Du hast $${V} : ${b}$ gerechnet. Aber $x$ ist der **Exponent**: $${b}$ hoch wie viel ergibt $${V}$?`)]);
    if (k < 0) wrongs.push([-k, T_SIGN, tx("Nearly! A fraction $\\frac{1}{…}$ means a **negative** exponent.", "Fast! Ein Bruch $\\frac{1}{…}$ bedeutet einen **negativen** Exponenten."), true]);
  } else if (kind === "shift") {
    const c = p.c!;
    x = q(k - c);
    const cs = c > 0 ? `+ ${c}` : `- ${-c}`;
    math = `${b}^{x ${cs}} = ${Vs}`;
    frames = [
      { math: `${b}#b^{x#x ${c > 0 ? "+" : "-"}#o ${Math.abs(c)}#c} =#eq ${Vs}#v`, note: tx(`Write $${Vs}$ as a power of $${b}$.`, `Schreib $${Vs}$ als Potenz von $${b}$.`) },
      { math: `${b}#b^{x#x ${c > 0 ? "+" : "-"}#o ${Math.abs(c)}#c} =#eq ${b}#b2^{${k}#v}`, note: asPow },
      { math: `x#x ${c > 0 ? "+" : "-"}#o ${Math.abs(c)}#c =#eq ${k}#v`, note: compare },
      { math: `x#x =#eq ${k - c}#v`, note: tx(`${c > 0 ? `Subtract $${c}$` : `Add $${-c}$`}: $x = ${k - c}$.`, `${c > 0 ? `Subtrahiere $${c}$` : `Addiere $${-c}$`}: $x = ${k - c}$.`) },
    ];
    wrongs.push([k + c, tx("Wrong direction", "Falsche Richtung"), tx(`Nearly! From $x ${cs} = ${k}$ you have to ${c > 0 ? "**subtract**" : "**add**"} $${Math.abs(c)}$.`, `Fast! Aus $x ${cs} = ${k}$ musst du $${Math.abs(c)}$ ${c > 0 ? "**subtrahieren**" : "**addieren**"}.`), true]);
  } else if (kind === "times") {
    const m = p.m!;
    x = q(k, m);
    math = `${b}^{${m}x} = ${Vs}`;
    frames = [
      { math: `${b}#b^{${m}#m x#x} =#eq ${Vs}#v`, note: tx(`Write $${Vs}$ as a power of $${b}$.`, `Schreib $${Vs}$ als Potenz von $${b}$.`) },
      { math: `${b}#b^{${m}#m x#x} =#eq ${b}#b2^{${k}#v}`, note: asPow },
      { math: `${m}#m x#x =#eq ${k}#v`, note: compare },
      { math: `x#x =#eq ${qk(x, "v")}`, note: tx(`Divide by $${m}$: $x = ${qs(x)}$.`, `Teile durch $${m}$: $x = ${qs(x)}$.`) },
    ];
    wrongs.push([k * m, tx("Multiplied instead of divided", "Multipliziert statt geteilt"), tx(`Nearly! From $${m}x = ${k}$ you **divide** by $${m}$.`, `Fast! Aus $${m}x = ${k}$ wird durch $${m}$ **geteilt**.`), true]);
  } else if (kind === "coef") {
    const a = p.a!;
    x = q(k);
    const W = a * V;
    math = `${a} \\cdot ${b}^{x} = ${W}`;
    frames = [
      { math: `${a}#a \\cdot#d ${b}#b^{x#x} =#eq ${W}#w`, note: tx(`First get the power alone: divide by $${a}$.`, `Stell zuerst die Potenz frei: Teile durch $${a}$.`) },
      { math: `${b}#b^{x#x} =#eq ${V}#w`, note: `$${W} : ${a} = ${V}$.` },
      { math: `${b}#b^{x#x} =#eq ${b}#b2^{${k}#v}`, note: asPow },
      { math: `x#x =#eq ${k}#v`, note: compare },
    ];
    wrongs.push([V, T_STOPPED, tx(`You got the power alone: $${b}^x = ${V}$, great! Now write $${V}$ as a power of $${b}$.`, `Die Potenz steht allein: $${b}^x = ${V}$, super! Jetzt schreib $${V}$ als Potenz von $${b}$.`), true]);
    const lab = Math.log(W) / Math.log(a * b);
    if (Math.abs(lab - Math.round(lab)) < 1e-9) wrongs.push([Math.round(lab), T_MERGED, tx(`Ooh, classic trap! $${a} \\cdot ${b}^x$ is not $${a * b}^x$: the exponent belongs only to the $${b}$.`, `Ooh, die klassische Falle! $${a} \\cdot ${b}^x$ ist nicht $${a * b}^x$: Der Exponent gehört nur zur $${b}$.`)]);
  } else if (kind === "bases") {
    // (g^i)^x = g^j
    const g = p.g!;
    const i = p.i!;
    const j = p.j!;
    x = q(j, i);
    const left = g ** i;
    const right = g ** Math.abs(j);
    const rs = j < 0 ? `\\frac{1}{${right}}` : `${right}`;
    math = `${left}^{x} = ${rs}`;
    frames = [
      { math: `${left}#l^{x#x} =#eq ${rs}#r`, note: tx(`Different bases, but both are powers of $${g}$.`, `Verschiedene Basen, aber beide sind Potenzen von $${g}$.`) },
      { math: `(${g}#l^{${i}#i})#br^{x#x} =#eq ${g}#r^{${j}#j}`, note: tx(`$${left} = ${g}^{${i}}$ and $${rs} = ${g}^{${j}}$.`, `$${left} = ${g}^{${i}}$ und $${rs} = ${g}^{${j}}$.`) },
      { math: `${g}#l^{${i}#i x#x} =#eq ${g}#r^{${j}#j}`, note: tx("Power of a power: multiply the exponents.", "Potenz einer Potenz: Exponenten multiplizieren.") },
      { math: `${i}#i x#x =#eq ${j}#j`, note: compare },
      { math: `x#x =#eq ${qk(x, "j")}`, note: tx(`Divide by $${i}$: $x = ${qs(x)}$.`, `Teile durch $${i}$: $x = ${qs(x)}$.`) },
    ];
    wrongs.push([i / j, T_UPSIDE, tx(`Nearly! From $${i}x = ${j}$ you get $x = \\frac{${j}}{${i}}$, not the other way round.`, `Fast! Aus $${i}x = ${j}$ folgt $x = \\frac{${j}}{${i}}$, nicht umgekehrt.`), true]);
    if (j > 0 && right % left === 0) wrongs.push([right / left, T_NOT_DIVISION, tx(`I think you divided $${right} : ${left}$. But $x$ is an **exponent**: write both sides as powers of $${g}$.`, `Ich glaub, du hast $${right} : ${left}$ gerechnet. Aber $x$ ist ein **Exponent**: Schreib beide Seiten als Potenzen von $${g}$.`)]);
  } else {
    // b^{2x - 1} = V → x = (k + 1)/2
    x = q(k + 1, 2);
    math = `${b}^{2x - 1} = ${Vs}`;
    frames = [
      { math: `${b}#b^{2#m x#x -#o 1#c} =#eq ${Vs}#v`, note: tx(`Write $${Vs}$ as a power of $${b}$.`, `Schreib $${Vs}$ als Potenz von $${b}$.`) },
      { math: `${b}#b^{2#m x#x -#o 1#c} =#eq ${b}#b2^{${k}#v}`, note: asPow },
      { math: `2#m x#x -#o 1#c =#eq ${k}#v`, note: compare },
      { math: `2#m x#x =#eq ${k + 1}#v`, note: tx("Add $1$.", "Addiere $1$.") },
      { math: `x#x =#eq ${qk(x, "v")}`, note: tx(`Divide by $2$: $x = ${qs(x)}$.`, `Teile durch $2$: $x = ${qs(x)}$.`) },
    ];
    wrongs.push([(k - 1) / 2, tx("Wrong direction", "Falsche Richtung"), tx("Nearly! From $2x - 1 = …$ you **add** $1$ first.", "Fast! Aus $2x - 1 = …$ addierst du zuerst $1$."), true]);
    wrongs.push([k / 2 + 1, tx("Divided only one term", "Nur einen Teil geteilt"), tx("Careful with the order: first add $1$, then divide **everything** by $2$.", "Vorsicht mit der Reihenfolge: zuerst $1$ addieren, dann **alles** durch $2$ teilen.")]);
  }
  frames[frames.length - 1].note = { en: `${(frames[frames.length - 1].note as { en: string }).en} So $L = \\{ ${qs(x)} \\}$.`, de: `${(frames[frames.length - 1].note as { de: string }).de} Also ist $L = \\{ ${qs(x)} \\}$.` };
  return {
    instruction: SOLVE,
    ...(x.d > 1 ? { text: tx("Without a calculator. Type $x$ as a fraction like 3/2 if needed.", "Ohne Taschenrechner. Gib $x$ wenn nötig als Bruch wie 3/2 ein.") } : { text: tx("Without a calculator.", "Ohne Taschenrechner.") }),
    math,
    answer: { kind: "number", value: qv(x), label: "x =" },
    hint: tx("Write both sides as powers of the same base. Then compare the exponents.", "Schreib beide Seiten als Potenzen derselben Basis. Dann vergleiche die Exponenten."),
    solution: frames,
    mistakes: collect(at(qv(x)), (add) => wrongs.forEach(([w, t, m, c]) => add(at(w), t, m, c))),
  };
}

// ---------------------------------------------------------------------------
// 8. Exponential equations with a calculator: 3 · 1,05^x = 6

/** A word problem around the equation: its text and the answer sentence (x already rounded). */
type Story = { v: string; text: (L: Lang) => string; end: (L: Lang, x: string) => string };

function expCalcEx(a: number, b: number, t: number, story?: Story): Exercise {
  const W = a * t;
  const xv = Math.log(t) / Math.log(b);
  const v = story?.v ?? "x";
  const tol = (val: number): AnswerSpec => ({ kind: "number", value: r2(val), tolerance: 0.0061 / Math.max(1, Math.abs(r2(val))) });
  const right = rounded(xv, `${v} =`);
  const frames = framesIn((L) => {
    const out: Frame[] = [];
    if (a !== 1) {
      out.push({ math: `${L.n(a)}#a \\cdot#d ${L.n(b)}#b^{${v}#x} =#eq ${L.n(W)}#w`, note: L.t(`Get the power alone first: divide by $${L.n(a)}$.`, `Stell zuerst die Potenz frei: Teile durch $${L.n(a)}$.`) });
    }
    out.push({
      math: `${L.n(b)}#b^{${v}#x} =#eq ${L.n(t)}#w`,
      note: a !== 1 ? `$${L.n(W)} : ${L.n(a)} = ${L.n(t)}$.` : L.t(`No nice power of $${L.n(b)}$ gives $${L.n(t)}$. So: logarithms.`, `Keine schöne Potenz von $${L.n(b)}$ ergibt $${L.n(t)}$. Also: Logarithmus.`),
    });
    out.push({ math: `\\lg (${L.n(b)}#b^{${v}#x})#br =#eq \\lg ${L.n(t)}#w`, note: L.t("Take lg of both sides.", "Wende auf beiden Seiten lg an.") });
    out.push({ math: `${v}#x \\cdot#d \\lg ${L.n(b)}#b =#eq \\lg ${L.n(t)}#w`, note: L.t("Power rule: the exponent comes down as a factor.", "Potenzregel: Der Exponent wandert als Faktor nach vorn.") });
    out.push({ math: `${v}#x =#eq \\frac{\\lg ${L.n(t)}#w}{\\lg ${L.n(b)}#b}#F`, note: L.t(`Divide by $\\lg ${L.n(b)}$. (That's $\\log_{${L.n(b)}} ${L.n(t)}$.)`, `Teile durch $\\lg ${L.n(b)}$. (Das ist $\\log_{${L.n(b)}} ${L.n(t)}$.)`) });
    out.push({
      math: `${v}#x \\approx#eq ${L.n(r2(xv))}#v`,
      note: L.t(
        `Calculator: $\\frac{${L.n(sig6(lg(t)))}}{${L.n(sig6(lg(b)))}} \\approx ${L.n(r2(xv))}$.`,
        `Taschenrechner: $\\frac{${L.n(sig6(lg(t)))}}{${L.n(sig6(lg(b)))}} \\approx ${L.n(r2(xv))}$.`,
      ) + (story ? ` ${story.end(L, L.n(r2(xv)))}` : ""),
    });
    return out;
  });
  const mistakes: Mistake[] = [];
  const add = (val: number, title: Text, msg: Text, close?: boolean) => {
    if (!Number.isFinite(val) || Math.abs(val) > 1e6) return;
    const w = tol(val);
    const tolRight = right.kind === "number" ? (right.tolerance ?? 0) * Math.max(1, Math.abs(right.value)) : 0;
    if (Math.abs(w.kind === "number" ? w.value - r2(xv) : 0) <= tolRight * 2 + 1e-9) return;
    if (mistakes.some((m) => m.when.kind === "number" && Math.abs(m.when.value - r2(val)) < 0.02)) return;
    mistakes.push(close ? { when: w, title, say: msg, close } : { when: w, title, say: msg });
  };
  const aS = (L: Lang) => L.n(a);
  if (a !== 1) {
    add(
      Math.log(W) / Math.log(b),
      T_DIVIDE_FIRST,
      say((L) => L.t(`Nearly! Before you take the log, get the power alone: divide by $${aS(L)}$ first.`, `Fast! Bevor du logarithmierst, stell die Potenz frei: Teile zuerst durch $${aS(L)}$.`)),
      true,
    );
    add(
      Math.log(W) / Math.log(a * b),
      T_MERGED,
      say((L) => L.t(`Ooh, classic trap! $${aS(L)} \\cdot ${L.n(b)}^${v}$ is not $${L.n(a * b)}^${v}$: the exponent belongs only to the $${L.n(b)}$.`, `Ooh, die klassische Falle! $${aS(L)} \\cdot ${L.n(b)}^${v}$ ist nicht $${L.n(a * b)}^${v}$: Der Exponent gehört nur zur $${L.n(b)}$.`)),
    );
  }
  add(
    lg(t) - lg(b),
    T_LOG_QUOTIENT,
    say((L) => L.t(`Careful: $\\frac{\\lg ${L.n(t)}}{\\lg ${L.n(b)}}$ is a quotient of two logs. It is **not** $\\lg ${L.n(t)} - \\lg ${L.n(b)}$.`, `Vorsicht: $\\frac{\\lg ${L.n(t)}}{\\lg ${L.n(b)}}$ ist ein Quotient zweier Logarithmen. Das ist **nicht** $\\lg ${L.n(t)} - \\lg ${L.n(b)}$.`)),
  );
  add(lg(b) / lg(t), T_UPSIDE, say((L) => L.t(`Nearly! Upside down: it's $\\frac{\\lg ${L.n(t)}}{\\lg ${L.n(b)}}$, the number on the right on top.`, `Fast! Andersrum: Es ist $\\frac{\\lg ${L.n(t)}}{\\lg ${L.n(b)}}$, die Zahl von der rechten Seite nach oben.`)), true);
  add(t / b, T_NEEDS_LOG, say((L) => L.t(`I think you divided $${L.n(t)} : ${L.n(b)}$. But $${v}$ sits in the **exponent**, so you need a logarithm.`, `Ich glaub, du hast $${L.n(t)} : ${L.n(b)}$ gerechnet. Aber $${v}$ steht im **Exponenten**, also brauchst du einen Logarithmus.`)));
  return {
    instruction: SOLVE_CALC,
    ...(story ? { text: say(story.text) } : {}),
    math: maths((L) => `${a !== 1 ? `${L.n(a)} \\cdot ` : ""}${L.n(b)}^{${v}} = ${L.n(W)}`),
    answer: right,
    hint: say((L) =>
      a !== 1
        ? L.t(`Divide by $${L.n(a)}$ first. Then take lg of both sides and use the power rule.`, `Teile zuerst durch $${L.n(a)}$. Dann wende lg auf beiden Seiten an und nutze die Potenzregel.`)
        : L.t("Take lg of both sides and use the power rule.", "Wende lg auf beiden Seiten an und nutze die Potenzregel."),
    ),
    solution: frames,
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// 9. Change of base: log_3 20 ≈ 2,73

function changeBaseEx(b: number, V: number): Exercise {
  const xv = Math.log(V) / Math.log(b);
  const right = rounded(xv);
  const frames = framesIn((L) => [
    { math: `\\log_{${L.n(b)}#b} \\, ${V}#v`, note: L.t(`The calculator has no $\\log_{${L.n(b)}}$ key. Change the base to $10$.`, `Der Taschenrechner hat keine Taste für $\\log_{${L.n(b)}}$. Wechsle zur Basis $10$.`) },
    { math: `\\frac{\\lg ${V}#v}{\\lg ${L.n(b)}#b}#F`, note: L.t("Change of base: $\\log_b x = \\frac{\\lg x}{\\lg b}$.", "Basiswechsel: $\\log_b x = \\frac{\\lg x}{\\lg b}$.") },
    {
      math: `\\frac{${L.n(sig6(lg(V)))}#v}{${L.n(sig6(lg(b)))}#b}#F \\approx#eq ${L.n(r2(xv))}#r`,
      note: L.t(`So $\\log_{${L.n(b)}} ${V} \\approx ${L.n(r2(xv))}$. Check: $${L.n(b)}^{${L.n(r2(xv))}} \\approx ${V}$.`, `Also ist $\\log_{${L.n(b)}} ${V} \\approx ${L.n(r2(xv))}$. Probe: $${L.n(b)}^{${L.n(r2(xv))}} \\approx ${V}$.`),
    },
  ]);
  const tolSpec = (val: number): AnswerSpec => ({ kind: "number", value: r2(val), tolerance: 0.0061 / Math.max(1, Math.abs(r2(val))) });
  const mistakes: Mistake[] = [];
  const add = (val: number, title: Text, msg: Text, close?: boolean) => {
    if (Math.abs(r2(val) - r2(xv)) < 0.02 || mistakes.some((m) => m.when.kind === "number" && Math.abs(m.when.value - r2(val)) < 0.02)) return;
    mistakes.push(close ? { when: tolSpec(val), title, say: msg, close } : { when: tolSpec(val), title, say: msg });
  };
  add(lg(b) / lg(V), T_UPSIDE, say((L) => L.t(`Nearly! Upside down: $\\log_b x = \\frac{\\lg x}{\\lg b}$, so $\\lg ${V}$ goes on top.`, `Fast! Andersrum: $\\log_b x = \\frac{\\lg x}{\\lg b}$, also kommt $\\lg ${V}$ nach oben.`)), true);
  add(lg(V) - lg(b), T_LOG_QUOTIENT, say((L) => L.t(`Careful: $\\frac{\\lg ${V}}{\\lg ${L.n(b)}}$ is a quotient of logs, not $\\lg ${V} - \\lg ${L.n(b)}$.`, `Vorsicht: $\\frac{\\lg ${V}}{\\lg ${L.n(b)}}$ ist ein Quotient von Logarithmen, nicht $\\lg ${V} - \\lg ${L.n(b)}$.`)));
  add(V / b, T_NOT_DIVISION, say((L) => NOT_DIVISION_L(L, L.n(b), String(V))));
  return {
    instruction: CHANGE_BASE,
    math: maths((L) => `\\log_{${L.n(b)}} \\, ${V}`),
    answer: right,
    hint: tx("$\\log_b x = \\frac{\\lg x}{\\lg b}$.", "$\\log_b x = \\frac{\\lg x}{\\lg b}$."),
    solution: frames,
    mistakes,
  };
}

const NOT_DIVISION_L = (L: Lang, b: string, V: string) =>
  L.t(
    `I think I know what you did: you divided $${V}$ by $${b}$. But a logarithm asks for an **exponent**: $${b}$ to the power of what gives $${V}$?`,
    `Ich glaub, ich weiß, was du gemacht hast: Du hast $${V}$ durch $${b}$ geteilt. Der Logarithmus fragt aber nach einem **Exponenten**: $${b}$ hoch wie viel ergibt $${V}$?`,
  );

// ---------------------------------------------------------------------------
// 10. Match equal terms

type Ident = { id: string; left: string; right: string; wrong?: string; why?: Text; whyTitle?: Text };

const IDENTS: Ident[] = [
  {
    id: "prod",
    left: "\\log_b (u \\cdot v)",
    right: "\\log_b u + \\log_b v",
    wrong: "\\log_b u \\cdot \\log_b v",
    whyTitle: tx("Product rule", "Produktregel"),
    why: tx("The log of a product is a **sum** of logs, not a product: $\\log_b (u \\cdot v) = \\log_b u + \\log_b v$.", "Der Logarithmus eines Produkts ist eine **Summe** von Logarithmen, kein Produkt: $\\log_b (u \\cdot v) = \\log_b u + \\log_b v$."),
  },
  {
    id: "quot",
    left: "\\log_b \\frac{u}{v}",
    right: "\\log_b u - \\log_b v",
    wrong: "\\frac{\\log_b u}{\\log_b v}",
    whyTitle: tx("Quotient rule", "Quotientenregel"),
    why: tx("The log of a quotient is a **difference** of logs: $\\log_b \\frac{u}{v} = \\log_b u - \\log_b v$.", "Der Logarithmus eines Quotienten ist eine **Differenz** von Logarithmen: $\\log_b \\frac{u}{v} = \\log_b u - \\log_b v$."),
  },
  {
    id: "pow",
    left: "\\log_b (u^r)",
    right: "r \\cdot \\log_b u",
    wrong: "(\\log_b u)^r",
    whyTitle: tx("Power rule", "Potenzregel"),
    why: tx("The exponent comes down as a **factor**: $\\log_b (u^r) = r \\cdot \\log_b u$.", "Der Exponent wird zum **Faktor**: $\\log_b (u^r) = r \\cdot \\log_b u$."),
  },
  {
    id: "root",
    left: "\\sqrt[n]{a^m}",
    right: "a^{\\frac{m}{n}}",
    wrong: "a^{\\frac{n}{m}}",
    whyTitle: T_SWAPPED,
    why: SWAPPED,
  },
  { id: "neg", left: "a^{-\\frac{1}{n}}", right: "\\frac{1}{\\sqrt[n]{a}}", wrong: "-\\sqrt[n]{a}", whyTitle: tx("Not a negative number", "Keine negative Zahl"), why: tx("A negative exponent means **one divided by**, the result is not negative.", "Ein negativer Exponent bedeutet **eins geteilt durch**, das Ergebnis ist nicht negativ.") },
  { id: "change", left: "\\log_b x", right: "\\frac{\\lg x}{\\lg b}", wrong: "\\frac{\\lg b}{\\lg x}", whyTitle: T_UPSIDE, why: tx("Change of base: $\\log_b x = \\frac{\\lg x}{\\lg b}$, the $x$ goes on top.", "Basiswechsel: $\\log_b x = \\frac{\\lg x}{\\lg b}$, das $x$ kommt nach oben.") },
  { id: "one", left: "\\log_b 1", right: "0" },
  { id: "base", left: "\\log_b b", right: "1" },
];

function matchEx(rng: Rng): Exercise {
  const pool = rng.shuffle(IDENTS);
  const chosen = [...pool.filter((i) => i.wrong).slice(0, 3), ...pool.filter((i) => !i.wrong).slice(0, 1)];
  const withWrong = chosen.filter((i) => i.wrong);
  const distractors = rng.shuffle(withWrong).slice(0, 2).map((i) => `$${i.wrong}$`);
  const pairs: [Text, Text][] = chosen.map((i) => [`$${i.left}$`, `$${i.right}$`]);
  const mistakes: Mistake[] = withWrong
    .filter((i) => distractors.includes(`$${i.wrong}$`))
    .map((i) => ({ when: { kind: "match", pairs: [[`$${i.left}$`, `$${i.wrong}$`]] }, title: i.whyTitle, say: i.why! }));
  return {
    instruction: MATCH,
    text: tx("Two terms on the right are left over: they look tempting, but they're wrong.", "Zwei Terme rechts bleiben übrig: Sie sehen verlockend aus, sind aber falsch."),
    answer: { kind: "match", pairs, distractors },
    hint: tx("Product → sum, quotient → difference, power → factor. Denominator = root.", "Produkt → Summe, Quotient → Differenz, Potenz → Faktor. Nenner = Wurzel."),
    solution: [
      { math: chosen.map((i) => `${i.left} = ${i.right}`).join(" \\\\ "), note: tx("These belong together.", "Diese gehören zusammen.") },
      { math: withWrong.filter((i) => distractors.includes(`$${i.wrong}$`)).map((i) => `${i.left} \\ne ${i.wrong}`).join(" \\\\ "), note: tx("The two leftover terms are typical traps.", "Die beiden übrigen Terme sind typische Fallen.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// 11. Which statement is true?

const TRUE_POOL: string[] = ["\\lg (100x) = 2 + \\lg x", "\\log_2 (8^x) = 3x", "\\lg \\frac{x}{10} = \\lg x - 1", "\\sqrt[3]{x^2} = x^{\\frac{2}{3}}", "\\ln (e^{2x}) = 2x", "\\frac{1}{\\sqrt{x}} = x^{-\\frac{1}{2}}", "\\lg 5 + \\lg 2 = 1"];
const FALSE_POOL: Opt[] = [
  { text: "$\\lg (x + 10) = \\lg x + 1$", title: tx("No rule for sums", "Keine Regel für Summen"), say: tx("Ooh, classic trap! There's no log rule for a **sum** inside. $\\lg(x + 10)$ can't be split.", "Ooh, die klassische Falle! Für eine **Summe** im Logarithmus gibt es kein Gesetz. $\\lg(x + 10)$ lässt sich nicht aufteilen.") },
  { text: "$\\lg (2x) = 2 \\lg x$", title: tx("Factor or exponent?", "Faktor oder Exponent?"), say: tx("Careful: $2 \\lg x = \\lg (x^2)$. A factor inside gives $\\lg(2x) = \\lg 2 + \\lg x$.", "Vorsicht: $2 \\lg x = \\lg (x^2)$. Ein Faktor im Logarithmus ergibt $\\lg(2x) = \\lg 2 + \\lg x$.") },
  { text: "$\\lg (x^2) = (\\lg x)^2$", title: tx("Power rule", "Potenzregel"), say: tx("The exponent comes down as a **factor**: $\\lg (x^2) = 2 \\lg x$.", "Der Exponent wird zum **Faktor**: $\\lg (x^2) = 2 \\lg x$.") },
  { text: "$\\frac{\\lg 8}{\\lg 2} = \\lg 4$", title: tx("Logs cancelled", "Logarithmen gekürzt"), say: tx("You can't cancel lg like a number. $\\frac{\\lg 8}{\\lg 2} = \\log_2 8 = 3$.", "lg kannst du nicht wie eine Zahl kürzen. $\\frac{\\lg 8}{\\lg 2} = \\log_2 8 = 3$.") },
  { text: "$\\sqrt[3]{x^2} = x^{\\frac{3}{2}}$", title: T_SWAPPED, say: SWAPPED },
  { text: "$x^{-\\frac{1}{2}} = -\\sqrt{x}$", title: tx("Not a negative number", "Keine negative Zahl"), say: tx("A negative exponent means **one divided by**: $x^{-\\frac{1}{2}} = \\frac{1}{\\sqrt{x}}$.", "Ein negativer Exponent bedeutet **eins geteilt durch**: $x^{-\\frac{1}{2}} = \\frac{1}{\\sqrt{x}}$.") },
  { text: "$\\lg (3 \\cdot 5) = \\lg 3 \\cdot \\lg 5$", title: tx("Product rule", "Produktregel"), say: tx("The log of a product is a **sum**: $\\lg (3 \\cdot 5) = \\lg 3 + \\lg 5$.", "Der Logarithmus eines Produkts ist eine **Summe**: $\\lg (3 \\cdot 5) = \\lg 3 + \\lg 5$.") },
  { text: "$\\sqrt{x^2 + 9} = x + 3$", title: tx("No root of a sum", "Keine Wurzel aus Summen"), say: tx("Roots can't be split over a **sum**: try $x = 4$: $\\sqrt{25} = 5$, but $4 + 3 = 7$.", "Wurzeln darfst du bei einer **Summe** nicht aufteilen: Probier $x = 4$: $\\sqrt{25} = 5$, aber $4 + 3 = 7$.") },
  { text: "$2 \\cdot 3^x = 6^x$", title: T_MERGED, say: tx("The exponent belongs only to the $3$: $2 \\cdot 3^x$ is not $6^x$ (try $x = 2$: $18 \\ne 36$).", "Der Exponent gehört nur zur $3$: $2 \\cdot 3^x$ ist nicht $6^x$ (probier $x = 2$: $18 \\ne 36$).") },
];

function whichEx(rng: Rng): Exercise {
  const right = rng.pick(TRUE_POOL);
  const wrong = rng.shuffle(FALSE_POOL).slice(0, 3);
  const c = choice(rng, [{ text: `$${right}$` }, ...wrong]);
  return {
    instruction: WHICH,
    answer: c.answer,
    hint: tx("Check each one against the rules, or test it with a number.", "Prüf jede Aussage mit den Gesetzen oder teste sie mit einer Zahl."),
    solution: [
      { math: right, note: tx("This one is true: it follows from the power and log rules.", "Diese Aussage stimmt: Sie folgt aus den Potenz- und Logarithmengesetzen.") },
      {
        math: wrong.map((w) => (typeof w.text === "string" ? w.text : w.text.en).replace(/^\$|\$$/g, "").replace(" = ", " \\ne ")).join(" \\\\ "),
        note: tx("The others are typical traps.", "Die anderen sind typische Fallen."),
      },
    ],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Practice

/** (r, q) with base r^q, and the numerators p that keep the result friendly. */
const RAT: [number, number, number[]][] = [
  [2, 2, [1, 3, 5]],
  [3, 2, [1, 3]],
  [4, 2, [1, 3]],
  [5, 2, [1, 3]],
  [6, 2, [1, 3]],
  [7, 2, [1, 3]],
  [8, 2, [1, 3]],
  [9, 2, [1, 3]],
  [10, 2, [1, 3]],
  [2, 3, [1, 2, 4, 5]],
  [3, 3, [1, 2, 4]],
  [4, 3, [1, 2, 4]],
  [5, 3, [1, 2]],
  [2, 4, [1, 3, 5]],
  [3, 4, [1, 3]],
  [2, 5, [1, 2, 3]],
  [3, 5, [1, 2]],
];

function ratTask(rng: Rng): Exercise | null {
  const [r, qd, ps] = rng.pick(RAT);
  let p = rng.pick(ps);
  const style = rng.pick(["frac", "frac", "frac", "root", "dec"] as const);
  if (style === "dec" && ![2, 4, 5].includes(qd)) return null;
  // a plain square root like \sqrt{49} is level 1 content
  if (style === "root" && p === 1 && qd === 2) return null;
  if (style !== "root" && rng.chance(0.25)) {
    p = -p;
    if (r ** -p > 64) return null;
  }
  return ratPowEx(r, p, qd, style);
}

function asPowerTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["root", "root", "inv", "prod", "times", "quot", "nest"] as const);
  if (kind === "root" || kind === "inv") {
    const b = rng.int(2, 5);
    const a = rng.int(1, 7);
    if (a % b === 0) return null;
    return asPowerEx(kind, a, b);
  }
  if (kind === "prod") {
    const [a, b] = rng.pick([
      [2, 3],
      [2, 4],
      [3, 4],
      [2, 5],
      [3, 6],
      [4, 6],
      [3, 2],
      [4, 2],
    ]);
    return asPowerEx(kind, a, b);
  }
  if (kind === "nest") return asPowerEx(kind, rng.int(1, 3), rng.int(2, 3));
  return asPowerEx(kind, rng.int(1, 4), rng.int(2, 4));
}

const ROOT_MUL: [number, number, number][] = [
  [3, 2, 4],
  [3, 4, 16],
  [3, 3, 9],
  [3, 2, 32],
  [3, 4, 54],
  [3, 9, 24],
  [3, 5, 25],
  [3, 25, 40],
  [4, 2, 8],
  [4, 8, 32],
  [4, 3, 27],
  [4, 4, 64],
  [5, 4, 8],
  [5, 16, 2],
];
const ROOT_DIV: [number, number, number][] = [
  [3, 16, 2],
  [3, 54, 2],
  [3, 128, 2],
  [3, 250, 2],
  [3, 24, 3],
  [3, 81, 3],
  [3, 192, 3],
  [4, 32, 2],
  [4, 162, 2],
  [4, 48, 3],
  [5, 64, 2],
];
const ROOT_NEST: [number, number, number][] = [
  [2, 3, 64],
  [3, 2, 64],
  [2, 2, 16],
  [2, 2, 81],
  [2, 2, 625],
  [3, 3, 512],
  [2, 3, 729],
  [3, 2, 729],
  [2, 2, 256],
];

function rootLawTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["mul", "mul", "div", "nest"] as const);
  if (kind === "nest") {
    const [n, b, a] = rng.pick(ROOT_NEST);
    return rootLawEx("nest", n, a, b);
  }
  const [n, a, b] = rng.pick(kind === "mul" ? ROOT_MUL : ROOT_DIV);
  return rootLawEx(kind, n, a, b);
}

function rationalTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["simple", "frac", "frac", "binom", "binom"] as const);
  if (kind === "simple") return rationalSimpleEx(rng.int(1, 6), rng.pick([2, 3, 5, 6, 7, 10]));
  if (kind === "frac") return rationalFracEx(rng.int(1, 9), rng.pick([1, 1, 2, 3]), rng.pick([2, 3, 5, 6, 7]));
  const b = rng.pick([2, 3, 5, 6, 7, 10, 11]);
  const c = rng.int(1, 3);
  const D = b - c * c;
  if (D === 0) return null;
  const m = rng.int(1, 4) * Math.sign(D);
  const k = m * D;
  if (k < 1 || k > 12) return null;
  return rationalBinomEx(k, b, c, rng.chance(0.5));
}

function logValueTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["pow", "pow", "pow", "inv", "dec", "frac", "frac", "root", "ln"] as const);
  if (kind === "pow") {
    const b = rng.pick([2, 2, 3, 4, 5, 6, 7, 10, 10]);
    const k = b === 2 ? rng.int(2, 10) : b === 3 ? rng.int(2, 6) : b === 10 ? rng.int(1, 6) : b <= 5 ? rng.int(2, 4) : rng.int(2, 3);
    return logValueEx("pow", b, k);
  }
  if (kind === "inv") {
    const b = rng.pick([2, 3, 4, 5]);
    const k = b === 2 ? rng.int(1, 6) : rng.int(1, 3);
    return logValueEx("inv", b, k);
  }
  if (kind === "dec") return logValueEx("dec", 10, rng.int(1, 4));
  if (kind === "frac") {
    const [g, i, j] = rng.pick([
      [2, 2, 1],
      [2, 3, 1],
      [2, 3, 2],
      [2, 2, 3],
      [2, 4, 1],
      [2, 4, 3],
      [3, 2, 1],
      [3, 3, 1],
      [3, 3, 2],
      [3, 2, 3],
      [5, 2, 1],
      [5, 2, 3],
      [2, 3, 4],
    ]);
    return logValueEx("frac", g, i, j);
  }
  if (kind === "root") {
    const b = rng.pick([2, 3, 5, 10]);
    const [k, j] = rng.pick([
      [1, 2],
      [3, 2],
      [1, 3],
      [2, 3],
      [5, 2],
    ]);
    if (b ** k > 1000) return null;
    return logValueEx("root", b, k, j);
  }
  const which = rng.int(0, 2);
  return which === 0 ? logValueEx("ln", 0, rng.int(2, 5)) : which === 1 ? logValueEx("ln", 0, -rng.int(1, 4)) : logValueEx("ln", 0, 1, 2);
}

const SUM: [number, number, number][] = [
  [10, 4, 25],
  [10, 2, 50],
  [10, 5, 20],
  [10, 8, 125],
  [10, 4, 250],
  [10, 25, 40],
  [10, 20, 50],
  [10, 2, 5],
  [6, 2, 3],
  [6, 4, 9],
  [6, 3, 12],
  [6, 8, 27],
  [12, 3, 4],
  [15, 3, 5],
];
const DIFF: [number, number, number][] = [
  [2, 12, 3],
  [2, 40, 5],
  [2, 96, 3],
  [2, 48, 3],
  [2, 20, 5],
  [2, 56, 7],
  [2, 80, 5],
  [3, 54, 2],
  [3, 18, 2],
  [3, 162, 2],
  [3, 45, 5],
  [10, 300, 3],
  [10, 5000, 5],
  [10, 20, 2],
  [5, 50, 2],
  [5, 375, 3],
];
const POWER: [number, number, number][] = [
  [3, 9, 4],
  [10, 100, 3],
  [2, 8, 5],
  [2, 4, 7],
  [5, 25, 3],
  [3, 27, 2],
  [10, 1000, 2],
  [2, 16, 3],
];
const COEF: [number, number, number][] = [
  [10, 5, 4],
  [10, 2, 25],
  [10, 50, 4],
  [10, 20, 25],
  [6, 3, 4],
  [6, 2, 9],
  [2, 6, 32],
];
const HALF: [number, number][] = [
  [2, 64],
  [10, 10000],
  [3, 81],
  [2, 16],
  [5, 625],
  [2, 256],
  [10, 100],
];
const CHANGE: [number, number][] = [
  [2, 8],
  [3, 81],
  [5, 125],
  [2, 32],
  [4, 64],
  [3, 27],
  [2, 64],
];

function logRuleTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["sum", "sum", "diff", "diff", "power", "coef", "half", "change"] as const);
  if (kind === "sum") return logRuleEx("sum", ...rng.pick(SUM));
  if (kind === "diff") return logRuleEx("diff", ...rng.pick(DIFF));
  if (kind === "power") return logRuleEx("power", ...rng.pick(POWER));
  if (kind === "coef") return logRuleEx("coef", ...rng.pick(COEF));
  if (kind === "half") {
    const [b, V] = rng.pick(HALF);
    return logRuleEx("half", b, V, 0);
  }
  const [b, V] = rng.pick(CHANGE);
  return logRuleEx("change", b, V, rng.chance(0.4) ? 1 : 0);
}

function exactTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["plain", "shift", "times", "coef", "bases", "bases", "twox"] as const);
  const b = rng.pick([2, 2, 3, 4, 5, 10]);
  const kMax = b === 2 ? 7 : b === 3 ? 4 : b === 10 ? 5 : 3;
  let k = rng.int(1, kMax);
  if (kind === "plain" || kind === "shift" || kind === "twox") {
    if (rng.chance(0.25)) k = -rng.int(1, Math.min(kMax, 3));
  }
  if (kind === "plain" && k === 1) return null; // 3^x = 3 is too easy here
  if (kind === "shift") return expExactEx(kind, { b, k, c: rng.nonZero(-3, 3) });
  if (kind === "times") {
    const m = rng.int(2, 3);
    if (k % m === 0 && rng.chance(0.5)) return null;
    return expExactEx(kind, { b, k, m });
  }
  if (kind === "coef") {
    const a = rng.int(2, 5);
    if (a * b ** k > 2000) return null;
    return expExactEx(kind, { b, k, a });
  }
  if (kind === "bases") {
    const [g, i, j] = rng.pick([
      [2, 2, 3],
      [2, 2, 5],
      [3, 2, 3],
      [2, 3, 2],
      [3, 3, 2],
      [2, 4, 3],
      [5, 2, 3],
      [2, 2, -3],
      [3, 2, -1],
      [2, 3, -2],
      [2, 3, 4],
    ]);
    return expExactEx(kind, { b: g, k: 1, g, i, j });
  }
  return expExactEx(kind, { b, k });
}

const CALC_SET: [number, number, number][] = [
  [3, 1.05, 2],
  [2, 1.5, 4],
  [5, 2, 7],
  [4, 3, 25],
  [10, 1.2, 3],
  [2, 1.1, 2],
  [100, 0.9, 0.5],
  [8, 0.5, 0.1],
  [1, 2, 20],
  [1, 3, 50],
  [1, 1.5, 10],
  [1, 5, 40],
  [6, 1.04, 2],
  [3, 2, 9],
  [20, 0.8, 0.25],
  [1, 1.08, 2],
];

const STORIES: [number, number, number, Story][] = [
  [
    500,
    1.2,
    6,
    {
      v: "t",
      text: (L) =>
        L.t(
          `A culture starts with 500 bacteria and grows by 20 % per hour: $N(t) = 500 \\cdot ${L.n(1.2)}^t$ ($t$ in hours). When are there 3000 bacteria?`,
          `Eine Kultur startet mit 500 Bakterien und wächst um 20 % pro Stunde: $N(t) = 500 \\cdot ${L.n(1.2)}^t$ ($t$ in Stunden). Wann sind es 3000 Bakterien?`,
        ),
      end: (L, x) => L.t(`So after about ${x} hours.`, `Also nach etwa ${x} Stunden.`),
    },
  ],
  [
    80,
    0.9,
    0.25,
    {
      v: "t",
      text: (L) =>
        L.t(
          `A patient has 80 mg of a medicine in the blood. Each hour 10 % of it is broken down: $m(t) = 80 \\cdot ${L.n(0.9)}^t$ ($t$ in hours). When are only 20 mg left?`,
          `Im Blut eines Patienten sind 80 mg eines Medikaments. Pro Stunde werden 10 % davon abgebaut: $m(t) = 80 \\cdot ${L.n(0.9)}^t$ ($t$ in Stunden). Wann sind nur noch 20 mg übrig?`,
        ),
      end: (L, x) => L.t(`So after about ${x} hours.`, `Also nach etwa ${x} Stunden.`),
    },
  ],
  [
    2000,
    1.03,
    1.5,
    {
      v: "n",
      text: (L) =>
        L.t(
          `Mia saves 2000 €. The bank pays 3 % interest per year: $K(n) = 2000 \\cdot ${L.n(1.03)}^n$. After how many years has it grown to 3000 €?`,
          `Mia legt 2000 € an. Die Bank zahlt 3 % Zinsen pro Jahr: $K(n) = 2000 \\cdot ${L.n(1.03)}^n$. Nach wie vielen Jahren sind daraus 3000 € geworden?`,
        ),
      end: (L, x) => L.t(`So after about ${x} years (in practice: in the 14th year).`, `Also nach etwa ${x} Jahren (in der Praxis: im 14. Jahr).`),
    },
  ],
];

function calcTask(rng: Rng): Exercise | null {
  if (rng.chance(0.15)) {
    const [a, b, t, s] = rng.pick(STORIES);
    return expCalcEx(a, b, t, s);
  }
  const [a0, b, t] = rng.pick(CALC_SET);
  const a = a0 === 1 || a0 >= 10 ? a0 : rng.int(2, 9);
  return expCalcEx(a, b, t);
}

function changeTask(rng: Rng): Exercise | null {
  const b = rng.pick([2, 3, 5, 7, 1.5]);
  const V = rng.pick([5, 6, 7, 10, 12, 15, 20, 30, 50, 100]);
  const lv = Math.log(V) / Math.log(b);
  if (Math.abs(lv - Math.round(lv)) < 0.05) return null;
  return changeBaseEx(b, V);
}

export function generate3(rng: Rng): Exercise {
  return weighted(
    rng,
    [
      [2, () => ratTask(rng)],
      [1.6, () => asPowerTask(rng)],
      [1.1, () => rootLawTask(rng)],
      [1.6, () => rationalTask(rng)],
      [2, () => logValueTask(rng)],
      [1.6, () => logRuleTask(rng)],
      [1.6, () => exactTask(rng)],
      [1.6, () => calcTask(rng)],
      [0.8, () => changeTask(rng)],
      [0.6, () => matchEx(rng)],
      [0.6, () => whichEx(rng)],
    ],
    () => ratPowEx(2, 3, 3, "frac"),
  );
}

// ---------------------------------------------------------------------------
// Lesson

const rootFrames: Frame[] = [
  { math: "2#b^{3#e} =#eq 8#v", note: tx("The third power: $2^3 = 8$.", "Die dritte Potenz: $2^3 = 8$.") },
  {
    math: "\\sqrt[3#e]{8#v}#R =#eq 2#b",
    note: tx("The **cube root** goes back: $\\sqrt[3]{8} = 2$, because $2^3 = 8$.", "Die **dritte Wurzel** geht zurück: $\\sqrt[3]{8} = 2$, denn $2^3 = 8$."),
    highlight: ["e"],
  },
  {
    math: "\\sqrt[4#e]{81#v}#R =#eq 3#b",
    note: tx(
      "In general $\\sqrt[n]{a}$ is the number $x \\ge 0$ with $x^n = a$ (for $a \\ge 0$). $3^4 = 81$, so $\\sqrt[4]{81} = 3$. (The equation $x^4 = 81$ also has $-3$ as a solution, but the root is never negative.)",
      "Allgemein ist $\\sqrt[n]{a}$ die Zahl $x \\ge 0$ mit $x^n = a$ (für $a \\ge 0$). $3^4 = 81$, also ist $\\sqrt[4]{81} = 3$. (Die Gleichung $x^4 = 81$ hat auch $-3$ als Lösung, aber die Wurzel ist nie negativ.)",
    ),
  },
  {
    math: "(a#a^{\\frac{1}{3}#f})#br^{3#e} =#eq a#a2^{\\frac{1}{3} \\cdot 3} =#eq2 a#a3",
    note: tx(
      "What could $a^{\\frac{1}{3}}$ mean? The power rule says $(a^{\\frac{1}{3}})^3 = a^1 = a$. So $a^{\\frac{1}{3}}$ is the number whose cube is $a$.",
      "Was könnte $a^{\\frac{1}{3}}$ bedeuten? Das Potenzgesetz sagt $(a^{\\frac{1}{3}})^3 = a^1 = a$. Also ist $a^{\\frac{1}{3}}$ die Zahl, deren dritte Potenz $a$ ist.",
    ),
  },
  {
    math: "a#a^{\\frac{1}{n}#f} =#eq \\sqrt[n]{a#a2}#R",
    note: tx("**Roots are powers with a fraction as exponent:** $a^{\\frac{1}{n}} = \\sqrt[n]{a}$.", "**Wurzeln sind Potenzen mit einem Bruch als Exponent:** $a^{\\frac{1}{n}} = \\sqrt[n]{a}$."),
  },
  {
    math: "8#b^{\\frac{2#m}{3#n}#f} =#eq (\\sqrt[3#n2]{8#b2}#R)#br^{2#m2} =#eq2 2#r^{2#m3} =#eq3 4#v",
    note: tx("$a^{\\frac{m}{n}} = (\\sqrt[n]{a})^m$: the **denominator** is the root, the **numerator** the power. Root first keeps the numbers small.", "$a^{\\frac{m}{n}} = (\\sqrt[n]{a})^m$: Der **Nenner** ist die Wurzel, der **Zähler** die Potenz. Zuerst die Wurzel, dann bleiben die Zahlen klein."),
  },
  {
    math: "16#b^{-#s \\frac{3}{4}#f} =#eq \\frac{1}{(\\sqrt[4]{16})^{3}}#G =#eq2 \\frac{1}{8}#H",
    note: tx("A negative exponent still means **one divided by**. And $16^{\\frac{3}{4}} = (\\sqrt[4]{16})^3 = 2^3 = 8$, so $16^{-\\frac{3}{4}} = \\frac{1}{8}$.", "Ein negativer Exponent bedeutet weiterhin **eins geteilt durch**. Und $16^{\\frac{3}{4}} = (\\sqrt[4]{16})^3 = 2^3 = 8$, also ist $16^{-\\frac{3}{4}} = \\frac{1}{8}$."),
  },
];

const lawFrames: Frame[] = framesIn((L) => [
  { math: "\\sqrt[3]{2#a}#R1 \\cdot#d \\sqrt[3]{4#b}#R2", note: L.t("Two cube roots, multiplied. Neither is a whole number.", "Zwei dritte Wurzeln, multipliziert. Keine ist eine ganze Zahl.") },
  {
    math: "\\sqrt[3]{2#a \\cdot#d 4#b}#R1 =#eq \\sqrt[3]{8} =#eq2 2#r",
    note: L.t(
      "Same root index: one root for both. $\\sqrt[n]{a} \\cdot \\sqrt[n]{b} = \\sqrt[n]{a \\cdot b}$, because $a^{\\frac{1}{n}} \\cdot b^{\\frac{1}{n}} = (ab)^{\\frac{1}{n}}$.",
      "Gleicher Wurzelexponent: eine Wurzel für beide. $\\sqrt[n]{a} \\cdot \\sqrt[n]{b} = \\sqrt[n]{a \\cdot b}$, denn $a^{\\frac{1}{n}} \\cdot b^{\\frac{1}{n}} = (ab)^{\\frac{1}{n}}$.",
    ),
  },
  {
    math: "\\frac{\\sqrt[3]{54#a}#R1}{\\sqrt[3]{2#b}#R2}#F =#eq \\sqrt[3]{\\frac{54}{2}}#R3 =#eq2 \\sqrt[3]{27} =#eq3 3#r",
    note: L.t(
      "Dividing works the same way: $\\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}}$. Here $54 : 2 = 27$ and $3^3 = 27$.",
      "Beim Dividieren genauso: $\\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}}$. Hier ist $54 : 2 = 27$ und $3^3 = 27$.",
    ),
  },
  {
    math: "\\sqrt{\\sqrt{625#a}#R2}#R1 =#eq \\sqrt[4]{625}#R3 =#eq2 5#r",
    note: L.t(
      "A root of a root: **multiply** the root indices. $\\sqrt[m]{\\sqrt[n]{a}} = \\sqrt[m \\cdot n]{a}$, because $(a^{\\frac{1}{n}})^{\\frac{1}{m}} = a^{\\frac{1}{m \\cdot n}}$. And $5^4 = 625$.",
      "Eine Wurzel aus einer Wurzel: Die Wurzelexponenten werden **multipliziert**. $\\sqrt[m]{\\sqrt[n]{a}} = \\sqrt[m \\cdot n]{a}$, denn $(a^{\\frac{1}{n}})^{\\frac{1}{m}} = a^{\\frac{1}{m \\cdot n}}$. Und $5^4 = 625$.",
    ),
  },
  {
    math: "\\frac{1#o}{\\sqrt{2#a}#R}#F",
    note: L.t("A root in the denominator is awkward to work with. We make the denominator **rational** (root-free).", "Mit einer Wurzel im Nenner rechnet es sich schlecht. Wir machen den Nenner **rational** (wurzelfrei)."),
  },
  {
    math: "\\frac{1#o \\cdot#d1 \\sqrt{2#c}#R2}{\\sqrt{2#a}#R \\cdot#d2 \\sqrt{2#c2}#R3}#F",
    note: L.t("Expand the fraction with $\\sqrt{2}$. Its value doesn't change.", "Erweitere den Bruch mit $\\sqrt{2}$. Sein Wert ändert sich nicht."),
  },
  {
    math: "\\frac{\\sqrt{2#c}#R2}{2#a}#F",
    note: L.t(`$\\sqrt{2} \\cdot \\sqrt{2} = 2$. So $\\frac{1}{\\sqrt{2}} = \\frac{\\sqrt{2}}{2} \\approx ${L.n(0.71)}$.`, `$\\sqrt{2} \\cdot \\sqrt{2} = 2$. Also ist $\\frac{1}{\\sqrt{2}} = \\frac{\\sqrt{2}}{2} \\approx ${L.n(0.71)}$.`),
  },
  {
    math: "\\frac{2#o}{\\sqrt{3#a}#R -#m 1#b}#F",
    note: L.t("A difference with a root below? Expand with the same terms and the **opposite sign**.", "Unten eine Differenz mit Wurzel? Erweitere mit denselben Gliedern und dem **anderen Vorzeichen**."),
  },
  {
    math: "\\frac{2#o (\\sqrt{3#a2}#R2 +#p 1#b2)#br2}{(\\sqrt{3#a}#R -#m 1#b)#br1 (\\sqrt{3#a3}#R3 +#p3 1#b3)#br3}#F",
    note: L.t("Below is now $(a - b)(a + b) = a^2 - b^2$, the third binomial formula.", "Unten steht jetzt $(a - b)(a + b) = a^2 - b^2$, die dritte binomische Formel."),
  },
  {
    math: "\\frac{2#o (\\sqrt{3#a2}#R2 +#p 1#b2)#br2}{3#a -#m 1#b}#F",
    note: L.t("$(\\sqrt{3})^2 - 1^2 = 3 - 1 = 2$: no root left below.", "$(\\sqrt{3})^2 - 1^2 = 3 - 1 = 2$: unten keine Wurzel mehr."),
  },
  { math: "\\sqrt{3#a2}#R2 +#p 1#b2", note: L.t("Cancel the $2$: $\\frac{2}{\\sqrt{3} - 1} = \\sqrt{3} + 1$.", "Kürze die $2$: $\\frac{2}{\\sqrt{3} - 1} = \\sqrt{3} + 1$.") },
]);

const logFrames: Frame[] = framesIn((L) => [
  { math: "2#b^{x#x} =#eq 32#v", note: L.t("Which exponent turns $2$ into $32$?", "Welcher Exponent macht aus $2$ die $32$?") },
  { math: "2#b^{5#x} =#eq 32#v", note: L.t("Try it: $2^5 = 32$. The exponent is $5$.", "Probier es: $2^5 = 32$. Der Exponent ist $5$.") },
  {
    math: "\\log_{2#b} \\, 32#v =#eq 5#x",
    note: L.t(
      'That\'s the **logarithm**: $\\log_2 32 = 5$, read "log to the base 2 of 32". **The logarithm is the exponent.**',
      "Genau das ist der **Logarithmus**: $\\log_2 32 = 5$, gelesen „Logarithmus von 32 zur Basis 2“. **Der Logarithmus ist der Exponent.**",
    ),
  },
  {
    math: "\\log_{b} \\, x = y \\quad \\Leftrightarrow \\quad b^{y} = x",
    note: L.t("In general, for $b > 0$, $b \\ne 1$ and $x > 0$. Only positive numbers have a logarithm, because $b^y$ is always positive.", "Allgemein gilt das für $b > 0$, $b \\ne 1$ und $x > 0$. Nur positive Zahlen haben einen Logarithmus, denn $b^y$ ist immer positiv."),
  },
  {
    math: "\\log_{3} \\, \\frac{1}{9} = -2 \\quad \\log_{5} \\, 1 = 0 \\quad \\log_{4} \\, 2 = \\frac{1}{2}",
    note: L.t("Logarithms can be negative, zero or fractions: $3^{-2} = \\frac{1}{9}$, $5^0 = 1$, $4^{\\frac{1}{2}} = 2$.", "Logarithmen können negativ, null oder Brüche sein: $3^{-2} = \\frac{1}{9}$, $5^0 = 1$, $4^{\\frac{1}{2}} = 2$."),
  },
  {
    math: `\\lg 1000 = 3 \\quad \\ln e = 1`,
    note: L.t(
      `On the calculator: **lg** is $\\log_{10}$, **ln** is $\\log_e$, the natural logarithm with Euler's number $e \\approx ${L.n(2.718)}$.`,
      `Auf dem Taschenrechner: **lg** ist $\\log_{10}$, **ln** ist $\\log_e$, der natürliche Logarithmus mit der eulerschen Zahl $e \\approx ${L.n(2.718)}$.`,
    ),
  },
]);

const ruleFrames: Frame[] = framesIn((L) => [
  {
    math: "\\log_{b} \\, (u \\cdot v) = \\log_{b} \\, u + \\log_{b} \\, v",
    note: L.t("**Product rule**: a product inside becomes a sum outside. Reason: $b^m \\cdot b^n = b^{m+n}$, exponents add.", "**Produktregel**: Aus einem Produkt innen wird eine Summe außen. Grund: $b^m \\cdot b^n = b^{m+n}$, Exponenten werden addiert."),
  },
  { math: "\\log_{b} \\, \\frac{u}{v} = \\log_{b} \\, u - \\log_{b} \\, v", note: L.t("**Quotient rule**: a quotient becomes a difference.", "**Quotientenregel**: Aus einem Quotienten wird eine Differenz.") },
  {
    math: "\\log_{b} \\, (u^{r}) = r \\cdot \\log_{b} \\, u",
    note: L.t("**Power rule**: the exponent comes down as a factor. This is the key to exponential equations.", "**Potenzregel**: Der Exponent wandert als Faktor nach vorn. Das ist der Schlüssel für Exponentialgleichungen."),
  },
  { math: "\\lg 4 + \\lg 25 = \\lg 100 = 2", note: L.t("Example: two awkward logs make one nice one.", "Beispiel: Zwei krumme Logarithmen ergeben einen glatten.") },
  {
    math: "\\log_{b} \\, x = \\frac{\\lg x}{\\lg b}",
    note: L.t(`**Change of base**: any logarithm with the lg key (or ln). $\\log_2 20 = \\frac{\\lg 20}{\\lg 2} \\approx ${L.n(4.32)}$.`, `**Basiswechsel**: jeder Logarithmus mit der lg-Taste (oder ln). $\\log_2 20 = \\frac{\\lg 20}{\\lg 2} \\approx ${L.n(4.32)}$.`),
  },
  { math: "\\lg (u + v) \\ne \\lg u + \\lg v", note: L.t("Careful: there's **no** rule for sums inside a logarithm.", "Vorsicht: Für Summen im Logarithmus gibt es **kein** Gesetz.") },
]);

const eqFrames: Frame[] = framesIn((L) => [
  { math: "2#b^{x#x} =#eq 32#v", note: L.t("If both sides are powers of the same base, compare exponents.", "Sind beide Seiten Potenzen derselben Basis, vergleichst du die Exponenten.") },
  { math: "2#b^{x#x} =#eq 2#b2^{5#v}", note: L.t("$32 = 2^5$, so $x = 5$.", "$32 = 2^5$, also ist $x = 5$.") },
  { math: `3#a \\cdot#d ${L.n(1.05)}#b^{x#x} =#eq 6#v`, note: L.t("No common base here. First get the power alone: divide by $3$.", "Hier gibt es keine gemeinsame Basis. Stell zuerst die Potenz frei: Teile durch $3$.") },
  { math: `${L.n(1.05)}#b^{x#x} =#eq 2#v`, note: L.t(`$x$ is the exponent that turns $${L.n(1.05)}$ into $2$: $x = \\log_{${L.n(1.05)}} 2$.`, `$x$ ist der Exponent, der aus $${L.n(1.05)}$ die $2$ macht: $x = \\log_{${L.n(1.05)}} 2$.`) },
  { math: `\\lg (${L.n(1.05)}#b^{x#x})#br =#eq \\lg 2#v`, note: L.t("To calculate it, take lg of both sides.", "Zum Ausrechnen wendest du auf beiden Seiten lg an.") },
  { math: `x#x \\cdot#d \\lg ${L.n(1.05)}#b =#eq \\lg 2#v`, note: L.t("Power rule: the $x$ comes down as a factor.", "Potenzregel: Das $x$ wandert als Faktor nach vorn.") },
  { math: `x#x =#eq \\frac{\\lg 2#v}{\\lg ${L.n(1.05)}#b}#F \\approx#eq2 ${L.n(14.21)}#r`, note: L.t(`Divide by $\\lg ${L.n(1.05)}$. Calculator: $x \\approx ${L.n(14.21)}$.`, `Teile durch $\\lg ${L.n(1.05)}$. Taschenrechner: $x \\approx ${L.n(14.21)}$.`) },
]);

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Roots as powers", "Wurzeln als Potenzen"),
      body: tx("Denominator = root, numerator = power. A negative exponent means one divided by.", "Nenner = Wurzel, Zähler = Potenz. Ein negativer Exponent bedeutet eins geteilt durch."),
      examples: ["\\sqrt[n]{a} = a^{\\frac{1}{n}}", "a^{\\frac{m}{n}} = \\sqrt[n]{a^m} = (\\sqrt[n]{a})^m", "8^{\\frac{2}{3}} = 2^2 = 4 \\quad 16^{-\\frac{3}{4}} = \\frac{1}{8}"],
      tone: "rule",
    },
    {
      title: tx("Root laws and rational denominators", "Wurzelgesetze und rationale Nenner"),
      body: tx("Same root index: one root. Root of a root: multiply the indices. A root in the denominator: expand.", "Gleicher Wurzelexponent: eine Wurzel. Wurzel aus einer Wurzel: Wurzelexponenten multiplizieren. Wurzel im Nenner: erweitern."),
      examples: [
        "\\sqrt[n]{a} \\cdot \\sqrt[n]{b} = \\sqrt[n]{a \\cdot b} \\quad \\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}}",
        "\\sqrt[m]{\\sqrt[n]{a}} = \\sqrt[m \\cdot n]{a}",
        "\\frac{1}{\\sqrt{2}} = \\frac{\\sqrt{2}}{2}",
        "\\frac{2}{\\sqrt{3} - 1} = \\frac{2(\\sqrt{3} + 1)}{3 - 1} = \\sqrt{3} + 1",
      ],
      tone: "rule",
    },
    {
      title: tx("Logarithm", "Logarithmus"),
      body: tx("The logarithm is the exponent. lg is base 10, ln is base e.", "Der Logarithmus ist der Exponent. lg hat die Basis 10, ln die Basis e."),
      examples: [
        "\\log_{b} \\, x = y \\Leftrightarrow b^y = x",
        tx("\\log_{2} \\, 32 = 5 \\quad \\lg 0.01 = -2", "\\log_{2} \\, 32 = 5 \\quad \\lg 0,01 = -2"),
        "\\log_{b} \\, 1 = 0 \\quad \\log_{b} \\, b = 1",
      ],
      tone: "rule",
    },
    {
      title: tx("Log rules", "Logarithmengesetze"),
      body: tx("Product → sum, quotient → difference, power → factor.", "Produkt → Summe, Quotient → Differenz, Potenz → Faktor."),
      examples: ["\\log_{b} \\, (uv) = \\log_{b} \\, u + \\log_{b} \\, v", "\\log_{b} \\, \\frac{u}{v} = \\log_{b} \\, u - \\log_{b} \\, v", "\\log_{b} \\, (u^r) = r \\cdot \\log_{b} \\, u", "\\log_{b} \\, x = \\frac{\\lg x}{\\lg b}"],
      tone: "rule",
    },
    {
      title: tx("Exponential equations", "Exponentialgleichungen"),
      body: tx("Same base: compare exponents. Otherwise: get the power alone, take lg, power rule, divide.", "Gleiche Basis: Exponenten vergleichen. Sonst: Potenz freistellen, lg anwenden, Potenzregel, teilen."),
      examples: [
        "2^{x + 1} = 32 = 2^5 \\Rightarrow x = 4",
        tx("3 \\cdot 1.05^x = 6 \\Rightarrow x = \\frac{\\lg 2}{\\lg 1.05} \\approx 14.21", "3 \\cdot 1,05^x = 6 \\Rightarrow x = \\frac{\\lg 2}{\\lg 1,05} \\approx 14,21"),
      ],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx("No rules for sums. And a factor in front never joins the base.", "Für Summen gibt es keine Regeln. Und ein Faktor davor gehört nie zur Basis."),
      examples: ["\\lg (u + v) \\ne \\lg u + \\lg v", "\\frac{\\lg 8}{\\lg 2} \\ne \\lg 4", tx("3 \\cdot 1.05^x \\ne 3.15^x", "3 \\cdot 1,05^x \\ne 3,15^x")],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("nth roots and fractions as exponents", "n-te Wurzeln und Brüche als Exponenten"),
      blob: tx("Exponents can be fractions. Sounds wild? It's just a root in disguise!", "Exponenten können Brüche sein. Klingt verrückt? Das ist nur eine verkleidete Wurzel!"),
      body: tx(
        "The $n$th root undoes the power $n$. And because of the power rules, a root is the same as a power with exponent $\\frac{1}{n}$.",
        "Die $n$-te Wurzel macht die Potenz $n$ rückgängig. Und wegen der Potenzgesetze ist eine Wurzel dasselbe wie eine Potenz mit dem Exponenten $\\frac{1}{n}$.",
      ),
      frames: rootFrames,
    },
    {
      type: "widget",
      title: tx("Between the powers", "Zwischen den Potenzen"),
      blob: tx("Set the denominator to 2 and slide between the dots!", "Stell den Nenner auf 2 und schieb zwischen die Punkte!"),
      body: tx(
        "The dots are the powers with whole exponents. Pick a base and a denominator, then slide the exponent: fractions fill the gaps on the curve $y = b^x$, and the formula shows root first, then power.",
        "Die Punkte sind die Potenzen mit ganzzahligem Exponenten. Wähl eine Basis und einen Nenner und verschieb dann den Exponenten: Brüche füllen die Lücken auf der Kurve $y = b^x$, und die Formel zeigt erst die Wurzel, dann die Potenz.",
      ),
      widget: RationalPowers,
    },
    {
      type: "check",
      blob: tx("Denominator first, then numerator!", "Erst der Nenner, dann der Zähler!"),
      exercise: ratPowEx(2, 3, 4, "frac"),
    },
    {
      type: "explain",
      title: tx("Root laws and rational denominators", "Wurzelgesetze und rationale Nenner"),
      blob: tx("Roots like to share. And they hate sitting in the denominator!", "Wurzeln teilen gern. Und im Nenner sitzen mögen sie gar nicht!"),
      body: tx(
        "Roots with the same index can go under one root, when multiplying and when dividing. A root of a root is one root with the indices multiplied. And a root in the denominator disappears if you expand the fraction cleverly.",
        "Wurzeln mit gleichem Wurzelexponenten kommen unter eine Wurzel, beim Multiplizieren und beim Dividieren. Eine Wurzel aus einer Wurzel wird eine Wurzel mit multiplizierten Wurzelexponenten. Und eine Wurzel im Nenner verschwindet, wenn du den Bruch geschickt erweiterst.",
      ),
      frames: lawFrames,
    },
    {
      type: "check",
      blob: tx("Expand with the root, then cancel.", "Mit der Wurzel erweitern, dann kürzen."),
      exercise: rationalSimpleEx(4, 3),
    },
    {
      type: "explain",
      title: tx("Logarithms: looking for the exponent", "Logarithmen: Wir suchen den Exponenten"),
      blob: tx("Logarithms sound scary, but they only ask one question: which exponent?", "Logarithmus klingt gruselig, stellt aber nur eine Frage: welcher Exponent?"),
      body: tx("$b^x = y$: if you know $b$ and $y$, the logarithm gives you the exponent $x$.", "$b^x = y$: Wenn du $b$ und $y$ kennst, liefert dir der Logarithmus den Exponenten $x$."),
      frames: logFrames,
    },
    {
      type: "widget",
      title: tx("Hunt the exponent", "Jagd auf den Exponenten"),
      blob: tx("Slide until you hit the target. Then I'll show you the calculator trick!", "Schieb, bis du das Ziel triffst. Dann zeig ich dir den Trick mit dem Taschenrechner!"),
      body: tx(
        "Choose a base $b$ and a target $y$. Slide $x$ until $b^x$ hits the target: the $x$ you find is $\\log_b y$. The calculator gets it with $\\frac{\\lg y}{\\lg b}$.",
        "Wähl eine Basis $b$ und ein Ziel $y$. Schieb $x$, bis $b^x$ das Ziel trifft: Das gefundene $x$ ist $\\log_b y$. Der Taschenrechner bekommt es mit $\\frac{\\lg y}{\\lg b}$.",
      ),
      widget: LogHunter,
    },
    {
      type: "check",
      blob: tx("3 to the power of what gives 81?", "3 hoch wie viel ergibt 81?"),
      exercise: logValueEx("pow", 3, 4),
    },
    {
      type: "explain",
      title: tx("The log rules", "Die Logarithmengesetze"),
      blob: tx("The power rules in a new costume. You already know them!", "Die Potenzgesetze im neuen Kostüm. Die kennst du schon!"),
      body: tx("Logarithms are exponents, so the power rules turn into log rules.", "Logarithmen sind Exponenten, deshalb werden aus den Potenzgesetzen Logarithmengesetze."),
      frames: ruleFrames,
    },
    {
      type: "explain",
      title: tx("Exponential equations", "Exponentialgleichungen"),
      blob: tx("The unknown sits up in the exponent. Let's get it down!", "Die Unbekannte sitzt oben im Exponenten. Holen wir sie runter!"),
      body: tx("When $x$ is in the exponent: compare exponents if you can, otherwise use a logarithm.", "Steht $x$ im Exponenten: Vergleich die Exponenten, wenn es geht, sonst hilft der Logarithmus."),
      frames: eqFrames,
    },
    {
      type: "check",
      blob: tx("Last one! Power alone first, then lg.", "Letzte Aufgabe! Erst die Potenz freistellen, dann lg."),
      exercise: expCalcEx(4, 3, 25),
    },
  ],
};
