"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Combine, Minus, Plus, Shuffle, Split } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, SingleLessonTopic as Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Small helpers for writing powers with stable animation keys. Decimals use a
// comma, as in German schools.

/** "3,6", "-0,5", "12". */
function dec(v: number): string {
  return String(Math.round(v * 1e9) / 1e9).replace(".", ",");
}

/** A number on its own, keyed: "5#k" or "-#ks 2#k". */
function num(n: number, k: string): string {
  return n < 0 ? `-#${k}s ${dec(-n)}#${k}` : `${dec(n)}#${k}`;
}

/** A number inside a sum or product, keyed; negative ones get brackets. */
function inner(n: number, k: string): string {
  return n < 0 ? `(-#${k}s ${dec(-n)}#${k})#${k}b` : `${dec(n)}#${k}`;
}

/** Plain number for notes, in brackets when negative: "(-2)". */
const par = (n: number) => (n < 0 ? `(${dec(n)})` : dec(n));

/** Plain power: "x", "x^{5}", "x^{-2}". */
const pp = (base: string | number, e: number) => (e === 1 ? `${base}` : `${base}^{${e}}`);

/** Keyed power with base key `b` and exponent key `ek`. A lone base hides its 1 unless `showOne`. */
function kp(base: string | number, b: string, e: number, ek: string, showOne = false): string {
  return e === 1 && !showOne ? `${base}#${b}` : `${base}#${b}^{${num(e, ek)}}`;
}

/** Keyed exponent sum like "4 + 5 + (-2)" (op keys `${opKey}1`, `${opKey}2`…). */
function keyedSum(list: { v: number; k: string }[], op: string, opKey: string): string {
  return list.map((t, i) => (i === 0 ? num(t.v, t.k) : `${op}#${opKey}${i} ${inner(t.v, t.k)}`)).join(" ");
}

const plainSum = (vals: number[]) => vals.map((v, i) => (i === 0 ? dec(v) : `+ ${par(v)}`)).join(" ");

/** Coefficient in front of a variable: "" for 1, "-" for -1, else the number. */
const coef = (c: number) => (c === 1 ? "" : c === -1 ? "-" : dec(c));

/** Digits grouped in threes with thin spaces: "36\,000\,000". The first group gets key `k`. */
function grouped(digits: string, k?: string): string {
  if (digits.length < 5) return k ? `${digits}#${k}` : digits;
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return groups.map((g, i) => (i === 0 && k ? `${g}#${k}` : g)).join(" \\,");
}

function largestSquareRoot(n: number): number {
  for (let k = Math.floor(Math.sqrt(n)); k >= 1; k--) if (n % (k * k) === 0) return k;
  return 1;
}

const gcdInt = (a: number, b: number): number => (b ? gcdInt(b, a % b) : Math.abs(a));

// ---------------------------------------------------------------------------
// Bilingual helpers

/** Joins bilingual pieces, language by language. */
const cat = (...parts: (Text | undefined)[]): Text => txMap((_, locale) => parts.map((part) => resolveText(part, locale)).join(""));

/** " So $c = 8$ and $n = 3$." */
const soBoth = (n1: string, v1: number | string, n2: string, v2: number | string) =>
  tx(` So $${n1} = ${v1}$ and $${n2} = ${v2}$.`, ` Also ist $${n1} = ${v1}$ und $${n2} = ${v2}$.`);

/** " So $n = 5$." */
const soN = (v: number) => tx(` So $n = ${v}$.`, ` Also ist $n = ${v}$.`);

/** German article for a lone base: "Ein einzelnes $x$" but "Eine einzelne $2$". */
const loneDe = (v: string) => (/^\d/.test(v) ? `Eine einzelne $${v}$` : `Ein einzelnes $${v}$`);

// ---------------------------------------------------------------------------
// Worked solutions (also used by the lesson checks)

/** (−2)^5 = −32 etc.: written out, then multiplied step by step. */
function evalPowerFrames(b: number, n: number): Frame[] {
  const value = b ** n;
  const bp = par(b);
  const factor = (i: number) => (b < 0 ? `(-#f${i}s ${-b}#f${i})#f${i}b` : `${b}#f${i}`);
  const frames: Frame[] = [
    {
      math: `${factor(0)}^{${n}#e}`,
      note: tx(`$${pp(bp, n)}$ means: $${n}$ factors of $${bp}$, multiplied together.`, `$${pp(bp, n)}$ bedeutet: $${n}$ Faktoren $${bp}$, miteinander multipliziert.`),
    },
  ];
  const signNote: Text =
    b < 0
      ? n % 2 === 0
        ? tx(" An even number of minus signs gives plus.", " Eine gerade Anzahl von Minuszeichen ergibt Plus.")
        : tx(" An odd number of minus signs: the result is negative.", " Eine ungerade Anzahl von Minuszeichen: Das Ergebnis ist negativ.")
      : "";
  if (b === -1) {
    frames.push({
      math: num(value, "f0"),
      note: cat(
        tx("$(-1) \\cdot (-1) = 1$, so every pair of factors gives $1$.", "$(-1) \\cdot (-1) = 1$, also ergibt jedes Paar von Faktoren $1$."),
        signNote,
        tx(` So $(-1)^{${n}} = ${value}$.`, ` Also ist $(-1)^{${n}} = ${value}$.`),
      ),
    });
    return frames;
  }
  const rest = (from: number) =>
    Array.from({ length: n - from }, (_, j) => `\\cdot#d${from + j} ${factor(from + j)}`).join(" ");
  frames.push({ math: `${factor(0)} ${rest(1)}`, note: tx(`Written out: $${n}$ factors.`, `Ausgeschrieben: $${n}$ Faktoren.`) });
  if (n <= 5) {
    let acc = b;
    for (let i = 1; i < n; i++) {
      const prev = acc;
      acc *= b;
      frames.push({ math: `${num(acc, "f0")} ${rest(i + 1)}`.trim(), note: `$${par(prev)} \\cdot ${bp} = ${acc}$.` });
    }
  } else {
    const chain: number[] = [];
    for (let i = 1, acc = b; i <= n; i++, acc *= b) chain.push(acc);
    frames.push({
      math: num(value, "f0"),
      note: tx(`Multiply step by step: $${chain.join(", ")}$.`, `Multipliziere Schritt für Schritt: $${chain.join("; ")}$.`),
    });
  }
  const last = frames[frames.length - 1];
  last.note = cat(last.note, signNote, tx(` So $${pp(bp, n)} = ${value}$.`, ` Also ist $${pp(bp, n)} = ${value}$.`));
  return frames;
}

/** −3² = −9: the exponent only belongs to the 3. */
function minusTrapFrames(b: number, n: number): Frame[] {
  const factors = Array.from({ length: n }, (_, i) => (i === 0 ? `${b}#f0` : `\\cdot#d${i} ${b}#f${i}`)).join(" ");
  const product = Array.from({ length: n }, () => b).join(" \\cdot ");
  return [
    {
      math: `-#m ${b}#f0^{${n}#e}`,
      note: tx(
        `The exponent belongs only to the $${b}$. The minus is not part of the base.`,
        `Der Exponent gehört nur zur $${b}$. Das Minus gehört nicht zur Basis.`,
      ),
      highlight: ["f0", "e"],
    },
    { math: `-#m (${factors})#br`, note: tx(`So it means $-(${product})$.`, `Es bedeutet also $-(${product})$.`) },
    {
      math: `-#m ${b ** n}#f0`,
      note: tx(
        `$-${b}^{${n}} = ${-(b ** n)}$. With brackets, $(-${b})^{${n}}$ would be $+${b ** n}$.`,
        `$-${b}^{${n}} = ${-(b ** n)}$. Mit Klammern wäre $(-${b})^{${n}} = +${b ** n}$.`,
      ),
    },
  ];
}

/** x^4 · x^5 · x: add the exponents. `unknown` adds "So n = …". */
function productFrames(v: string, exps: number[], unknown = true): Frame[] {
  const total = exps.reduce((s, e) => s + e, 0);
  const lhs = (showOne: boolean) => exps.map((e, i) => (i === 0 ? "" : `\\cdot#d${i} `) + kp(v, `b${i}`, e, `e${i}`, showOne)).join(" ");
  const frames: Frame[] = [{ math: lhs(false), note: tx(`All factors have the same base $${v}$.`, `Alle Faktoren haben die gleiche Basis $${v}$.`) }];
  const lone = exps.indexOf(1);
  if (lone >= 0) frames.push({ math: lhs(true), note: tx(`A lone $${v}$ counts as $${v}^1$.`, `${loneDe(v)} zählt als $${v}^1$.`), highlight: [`e${lone}`] });
  frames.push({
    math: `${v}#b0^{${keyedSum(exps.map((e, i) => ({ v: e, k: `e${i}` })), "+", "p")}}`,
    note: tx("Same base, multiplied: keep the base and **add** the exponents.", "Gleiche Basis, multipliziert: Behalte die Basis und **addiere** die Exponenten."),
  });
  frames.push({
    math: kp(v, "b0", total, "e0", true),
    note: cat(
      `$${plainSum(exps)} = ${total}$.`,
      unknown ? soN(total) : "",
      total < 0 ? tx(` (That's $\\frac{1}{${pp(v, -total)}}$.)`, ` (Das ist $\\frac{1}{${pp(v, -total)}}$.)`) : "",
    ),
  });
  return frames;
}

/** x^9 : x^4 or as a fraction: subtract the exponents. */
function quotientFrames(v: string, e1: number, e2: number, frac: boolean, unknown = true): Frame[] {
  const n = e1 - e2;
  const a = kp(v, "b0", e1, "e0");
  const b = kp(v, "b1", e2, "e1");
  const after: Text =
    n < 0
      ? tx(` That means $${pp(v, n)} = \\frac{1}{${pp(v, -n)}}$.`, ` Das heißt: $${pp(v, n)} = \\frac{1}{${pp(v, -n)}}$.`)
      : n === 0
        ? tx(` And $${v}^0 = 1$.`, ` Und $${v}^0 = 1$.`)
        : "";
  return [
    {
      math: frac ? `\\frac{${a}}{${b}}#F` : `${a} :#dv ${b}`,
      note: tx(`Two powers with the same base $${v}$, divided.`, `Zwei Potenzen mit der gleichen Basis $${v}$ werden dividiert.`),
    },
    {
      math: `${v}#b0^{${num(e1, "e0")} -#mi ${inner(e2, "e1")}}`,
      note: cat(
        tx("Keep the base and **subtract** the exponents.", "Behalte die Basis und **subtrahiere** die Exponenten."),
        e2 < 0 ? tx(" Minus a negative number is plus.", " Eine negative Zahl abziehen heißt addieren.") : "",
      ),
    },
    { math: kp(v, "b0", n, "e0", true), note: cat(`$${e1} - ${par(e2)} = ${n}$.`, unknown ? soN(n) : "", after) },
  ];
}

/** (x^3)^4 (· x^2): multiply, then maybe add. */
function powerOfPowerFrames(v: string, e1: number, k: number, extra: number | null): Frame[] {
  const tail = (showOne = false) => (extra === null ? "" : ` \\cdot#d ${kp(v, "b1", extra, "e1", showOne)}`);
  const inside = e1 * k;
  const frames: Frame[] = [
    {
      math: `(${kp(v, "b0", e1, "e0")})#br^{${k}#k}${tail()}`,
      note: tx(
        `A power of a power: $${pp(v, e1)}$ is taken $${k}$ times.`,
        `Eine Potenz wird potenziert: $${pp(v, e1)}$ wird $${k}$-mal mit sich selbst multipliziert.`,
      ),
    },
    {
      math: `${v}#b0^{${inner(e1, "e0")} \\cdot#t ${k}#k}${tail()}`,
      note: tx("Keep the base and **multiply** the exponents.", "Behalte die Basis und **multipliziere** die Exponenten."),
    },
    { math: `${kp(v, "b0", inside, "e0", true)}${tail(true)}`, note: cat(`$${par(e1)} \\cdot ${k} = ${inside}$.`, extra === null ? soN(inside) : "") },
  ];
  if (extra !== null) {
    const total = inside + extra;
    frames.push({
      math: `${v}#b0^{${num(inside, "e0")} +#p ${inner(extra, "e1")}}`,
      note: cat(
        tx(
          "Now two powers with the same base are multiplied: add the exponents.",
          "Jetzt werden zwei Potenzen mit gleicher Basis multipliziert: Addiere die Exponenten.",
        ),
        extra === 1 ? tx(` (A lone $${v}$ is $${v}^1$.)`, ` (${loneDe(v)} ist $${v}^1$.)`) : "",
      ),
    });
    frames.push({ math: kp(v, "b0", total, "e0", true), note: cat(`$${inside} + ${par(extra)} = ${total}$.`, soN(total)) });
  }
  return frames;
}

const NEG_MEANS = tx("A negative exponent means: **one divided by** the power.", "Ein negativer Exponent bedeutet: **eins geteilt durch** die Potenz.");

/** 2^{-3} = 1/8 */
function negativeToFractionFrames(b: number, e: number): Frame[] {
  const frames: Frame[] = [
    { math: `${b}#b^{-#s ${e}#e}`, note: NEG_MEANS },
    {
      math: `\\frac{1#one}{${kp(b, "b", e, "e")}}#F`,
      note: tx(
        `$${b}^{-${e}} = \\frac{1}{${pp(b, e)}}$. In the fraction, the exponent is positive.`,
        `$${b}^{-${e}} = \\frac{1}{${pp(b, e)}}$. Im Bruch ist der Exponent positiv.`,
      ),
    },
  ];
  if (e > 1)
    frames.push({
      math: `\\frac{1#one}{${b ** e}#b}#F`,
      note: tx(`$${pp(b, e)} = ${b ** e}$. So $${b}^{-${e}} = \\frac{1}{${b ** e}}$.`, `$${pp(b, e)} = ${b ** e}$. Also ist $${b}^{-${e}} = \\frac{1}{${b ** e}}$.`),
    });
  return frames;
}

/** (2x^3)^4 · 3x^{-2}: bracket first, then numbers and exponents. */
function bracketPowerFrames(v: string, k: number, e1: number, j: number, extra: { d: number; e2: number } | null): Frame[] {
  const K = k ** j;
  const kTok = k === -1 ? "-#c1s " : `${num(k, "c1")} `;
  const extraSrc = (showOne: boolean) => {
    if (!extra) return "";
    const pw = kp(v, "b2", extra.e2, "e2", showOne);
    if (extra.d === 1) return ` \\cdot#dot ${pw}`;
    if (extra.d < 0) return ` \\cdot#dot (-#c2s ${-extra.d}#c2 ${pw})#g`;
    return ` \\cdot#dot ${extra.d}#c2 ${pw}`;
  };
  const kHead = (c: number) => (c === 1 ? "" : c === -1 ? "-#c1s " : `${num(c, "c1")} `);
  const inner2 = e1 === 1 ? v : `(${pp(v, e1)})`;
  const frames: Frame[] = [
    {
      math: `(${kTok}${kp(v, "b1", e1, "e1")})#br^{${j}#j}${extraSrc(false)}`,
      note: tx(
        `The bracket comes first. Its exponent $${j}$ belongs to **every factor** inside.`,
        `Zuerst die Klammer. Ihr Exponent $${j}$ gehört zu **jedem Faktor** darin.`,
      ),
    },
    {
      math: `${inner(k, "c1")}^{${j}#j} \\cdot#d1 ${v}#b1^{${inner(e1, "e1")} \\cdot#jt ${j}#j2}${extraSrc(false)}`,
      note: tx(
        `So you get $${par(k)}^{${j}}$ and $${inner2}^{${j}}$. For a power of a power, multiply the exponents.`,
        `Du bekommst also $${par(k)}^{${j}}$ und $${inner2}^{${j}}$. Bei einer Potenz einer Potenz multiplizierst du die Exponenten.`,
      ),
    },
    {
      math: `${kHead(K)}${kp(v, "b1", e1 * j, "e1", true)}${extraSrc(true)}`,
      note: cat(
        tx(`$${par(k)}^{${j}} = ${K}$ and $${par(e1)} \\cdot ${j} = ${e1 * j}$.`, `$${par(k)}^{${j}} = ${K}$ und $${par(e1)} \\cdot ${j} = ${e1 * j}$.`),
        extra ? "" : soBoth("c", K, "n", e1 * j),
      ),
    },
  ];
  if (extra) {
    const c = K * extra.d;
    const n = e1 * j + extra.e2;
    frames.push({
      math: `${kHead(c)}${v}#b1^{${num(e1 * j, "e1")} +#p ${inner(extra.e2, "e2")}}`,
      note: tx(
        `Multiply the numbers: $${K} \\cdot ${par(extra.d)} = ${c}$. Same base: add the exponents.`,
        `Multipliziere die Zahlen: $${K} \\cdot ${par(extra.d)} = ${c}$. Gleiche Basis: Addiere die Exponenten.`,
      ),
    });
    frames.push({ math: `${kHead(c)}${kp(v, "b1", n, "e1", true)}`, note: cat(`$${e1 * j} + ${par(extra.e2)} = ${n}$.`, soBoth("c", c, "n", n)) });
  }
  return frames;
}

const places = (k: number) => tx(k === 1 ? "place" : "places", k === 1 ? "Stelle" : "Stellen");

/** 36 000 000 = 3,6 · 10^7 and 0,00036 = 3,6 · 10^{-4}. */
function sciFrames(digits: string, e: number): Frame[] {
  const mant = Number(digits) / 10 ** (digits.length - 1);
  if (e > 0) {
    const raw = digits + "0".repeat(e - digits.length + 1);
    const power = "1" + "0".repeat(e);
    return [
      {
        math: grouped(raw, "m"),
        note: cat(
          tx(
            `Move the comma to the left until exactly one digit is in front of it: $${dec(mant)}$. That's $${e}$ `,
            `Verschiebe das Komma nach links, bis genau eine Ziffer davor steht: $${dec(mant)}$. Das sind $${e}$ `,
          ),
          places(e),
          ".",
        ),
      },
      {
        math: `${dec(mant)}#m \\cdot#d ${grouped(power, "t")}`,
        note: tx(`To keep the value, multiply by $${grouped(power)}$ again.`, `Damit der Wert gleich bleibt, multiplizierst du wieder mit $${grouped(power)}$.`),
      },
      {
        math: `${dec(mant)}#m \\cdot#d 10#t^{${e}#e}`,
        note: cat(
          tx(`$${grouped(power)} = 10^{${e}}$ (a $1$ with $${e}$ zeros).`, `$${grouped(power)} = 10^{${e}}$ (eine $1$ mit $${e}$ Nullen).`),
          soBoth("a", dec(mant), "n", e),
        ),
      },
    ];
  }
  const raw = `0,${"0".repeat(-e - 1)}${digits}`;
  const small = `0,${"0".repeat(-e - 1)}1`;
  return [
    {
      math: `${raw}#m`,
      note: cat(
        tx(
          `Move the comma to the **right** until one digit (not $0$) is in front of it: $${dec(mant)}$. That's $${-e}$ `,
          `Verschiebe das Komma nach **rechts**, bis eine Ziffer (nicht $0$) davor steht: $${dec(mant)}$. Das sind $${-e}$ `,
        ),
        places(-e),
        ".",
      ),
    },
    {
      math: `${dec(mant)}#m \\cdot#d ${small}#t`,
      note: tx(
        `Now the number is too big. To keep the value, multiply by $${small}$.`,
        `Jetzt ist die Zahl zu groß. Damit der Wert gleich bleibt, multiplizierst du mit $${small}$.`,
      ),
    },
    { math: `${dec(mant)}#m \\cdot#d 10#t^{-#es ${-e}#e}`, note: cat(`$${small} = 10^{${e}}$.`, soBoth("a", dec(mant), "n", e)) },
  ];
}

const COMES_OUT = (s: number) =>
  tx(`$\\sqrt{${s * s}} = ${s}$ comes out of the root.`, `$\\sqrt{${s * s}} = ${s}$ kommt vor die Wurzel.`);

/** √72 = √(36·2) = √36·√2 = 6√2 */
function partialRootFrames(N: number, prefix = 1): Frame[] {
  const s = largestSquareRoot(N);
  const r = N / (s * s);
  const pre = prefix === 1 ? "" : `${prefix}#t `;
  const frames: Frame[] = [
    {
      math: `${pre}\\sqrt{${N}#s}#R`,
      note: tx(
        `Find the **biggest square number** that divides $${N}$: it's $${s * s}$.`,
        `Suche die **größte Quadratzahl**, durch die sich $${N}$ teilen lässt: Das ist $${s * s}$.`,
      ),
    },
    { math: `${pre}\\sqrt{${s * s}#s \\cdot#d ${r}#r}#R`, note: `$${N} = ${s * s} \\cdot ${r}$.`, highlight: ["s"] },
  ];
  if (prefix === 1) {
    frames.push({
      math: `\\sqrt{${s * s}#s}#R0 \\cdot#d \\sqrt{${r}#r}#R`,
      note: tx("Split the root: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$.", "Teile die Wurzel auf: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$."),
    });
    frames.push({ math: `${s}#s \\sqrt{${r}#r}#R`, note: cat(COMES_OUT(s), soBoth("a", s, "b", r)) });
  } else {
    frames.push({ math: `${prefix}#t \\cdot#d0 ${s}#s \\sqrt{${r}#r}#R`, note: COMES_OUT(s) });
    frames.push({ math: `${prefix * s}#t \\sqrt{${r}#r}#R`, note: cat(`$${prefix} \\cdot ${s} = ${prefix * s}$.`, soBoth("a", prefix * s, "b", r)) });
  }
  return frames;
}

/** (3·10^4)·(2·10^5) or (8·10^9):(2·10^3), normalised to a·10^n. */
function sciCalcFrames(a1: number, e1: number, a2: number, e2: number, div: boolean): Frame[] {
  const P = div ? a1 / a2 : a1 * a2;
  const E = div ? e1 - e2 : e1 + e2;
  const t = (a: number, ak: string, e: number, i: number) => `(${a}#${ak} \\cdot#d${i} 10#t${i}^{${num(e, `e${i}`)}})#g${i}`;
  const together = tx("Numbers together, powers of ten together.", "Zahlen zusammen, Zehnerpotenzen zusammen.");
  const frames: Frame[] = [
    {
      math: `${t(a1, "a1", e1, 1)} ${div ? ":" : "\\cdot"}#dot ${t(a2, "a2", e2, 2)}`,
      note: div
        ? tx("Divide the numbers and the powers of ten separately.", "Teile die Zahlen und die Zehnerpotenzen getrennt.")
        : tx("Multiply the numbers and the powers of ten separately.", "Multipliziere die Zahlen und die Zehnerpotenzen getrennt."),
    },
    div
      ? { math: `\\frac{${a1}#a1}{${a2}#a2}#F \\cdot#dot \\frac{10#t1^{${num(e1, "e1")}}}{10#t2^{${num(e2, "e2")}}}#G`, note: together }
      : { math: `${a1}#a1 \\cdot#d1 ${a2}#a2 \\cdot#dot 10#t1^{${num(e1, "e1")}} \\cdot#d2 10#t2^{${num(e2, "e2")}}`, note: together },
    {
      math: `${dec(P)}#a1 \\cdot#dot 10#t1^{${num(e1, "e1")} ${div ? "-" : "+"}#op ${inner(e2, "e2")}}`,
      note: div
        ? tx(`$${a1} : ${a2} = ${dec(P)}$. Divide powers: subtract the exponents.`, `$${a1} : ${a2} = ${dec(P)}$. Potenzen dividieren: Subtrahiere die Exponenten.`)
        : tx(`$${a1} \\cdot ${a2} = ${dec(P)}$. Multiply powers: add the exponents.`, `$${a1} \\cdot ${a2} = ${dec(P)}$. Potenzen multiplizieren: Addiere die Exponenten.`),
    },
    { math: `${dec(P)}#a1 \\cdot#dot 10#t1^{${num(E, "e1")}}`, note: `$${e1} ${div ? "-" : "+"} ${par(e2)} = ${E}$.` },
  ];
  if (P >= 10 || P < 1) {
    const up = P >= 10;
    const mant = up ? P / 10 : P * 10;
    const n = up ? E + 1 : E - 1;
    frames.push({
      math: `${dec(mant)}#a1 \\cdot#dn 10#tn^{${up ? "1#en" : "-#ens 1#en"}} \\cdot#dot 10#t1^{${num(E, "e1")}}`,
      note: up
        ? tx(`But $${dec(P)}$ is not below $10$: $${dec(P)} = ${dec(mant)} \\cdot 10^1$.`, `Aber $${dec(P)}$ ist nicht kleiner als $10$: $${dec(P)} = ${dec(mant)} \\cdot 10^1$.`)
        : tx(`But $${dec(P)}$ is below $1$: $${dec(P)} = ${dec(mant)} \\cdot 10^{-1}$.`, `Aber $${dec(P)}$ ist kleiner als $1$: $${dec(P)} = ${dec(mant)} \\cdot 10^{-1}$.`),
    });
    frames.push({ math: `${dec(mant)}#a1 \\cdot#dot 10#t1^{${num(n, "e1")}}`, note: cat(`$${E} ${up ? "+ 1" : "- 1"} = ${n}$.`, soBoth("a", dec(mant), "n", n)) });
  } else {
    const last = frames[frames.length - 1];
    last.note = cat(last.note, soBoth("a", dec(P), "n", E));
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Typical mistakes, simulated from the task's numbers: each wrong answer is
// exactly what a student with that misconception gets. A mistake is only kept
// when it differs from the right answer and from the ones before it.

const sameValue = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function sameAnswer(a: AnswerSpec, b: AnswerSpec): boolean {
  if (a.kind === "number" && b.kind === "number") return sameValue(a.value, b.value, 1e-6);
  if (a.kind === "fraction" && b.kind === "fraction") return sameValue(a.n / a.d, b.n / b.d, 1e-9);
  if (a.kind === "pair" && b.kind === "pair") return a.values.every((v, i) => sameValue(v, b.values[i], 1e-4));
  return false;
}

/** A value a student could actually type: finite, not absurdly big or tiny. */
const typeable = (v: number) => Number.isFinite(v) && Math.abs(v) < 1e7 && (v === 0 || Math.abs(v) >= 1e-6);

function usable(s: AnswerSpec): boolean {
  if (s.kind === "number") return typeable(s.value);
  if (s.kind === "fraction") return Number.isInteger(s.n) && Number.isInteger(s.d) && s.d !== 0 && Math.abs(s.n) < 1e7 && Math.abs(s.d) < 1e7;
  if (s.kind === "pair") return s.values.every(typeable);
  return false;
}

/** `close`: a near miss (a sign, a count, not finished yet): Blob looks thoughtful instead of worried. */
type AddMistake = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => void;

/** The typical mistakes for one answer, in the order given (first match wins). */
function collect(right: AnswerSpec, fill: (add: AddMistake) => void): Mistake[] {
  const list: Mistake[] = [];
  fill((when, title, say, close) => {
    if (list.length >= 5 || !usable(when) || sameAnswer(when, right) || list.some((m) => sameAnswer(m.when, when))) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  });
  return list;
}

const asNum = (value: number): AnswerSpec => ({ kind: "number", value });
const asFrac = (n: number, d: number): AnswerSpec => ({ kind: "fraction", n, d });
const pairOf =
  (names: [string, string]) =>
  (a: number, b: number): AnswerSpec => ({ kind: "pair", names, values: [a, b] });

// Titles and lines shared by several shapes.
const T_BASE_TIMES = tx("Base times exponent", "Basis mal Exponent");
const T_EXP_MUL = tx("Exponents multiplied", "Exponenten multipliziert");
const T_EXP_ADD = tx("Added instead of subtracted", "Addiert statt subtrahiert");
const T_EXP_DIV = tx("Exponents divided", "Exponenten dividiert");
const T_POW_ADD = tx("Added instead of multiplied", "Addiert statt multipliziert");
const T_ORDER = tx("Subtracted the wrong way round", "Andersrum subtrahiert");
const T_LOST_MINUS = tx("Minus in the exponent lost", "Minus im Exponenten verloren");
const T_MINUS_MINUS = tx("Minus a negative", "Minus minus");
const T_COUNT_MINUS = tx("Count the minus signs", "Zähl die Minuszeichen");
const T_NOT_NEG = tx("Not a negative number", "Keine negative Zahl");
const T_NEG_IGNORED = tx("Negative exponent ignored", "Negativen Exponenten übersehen");
const T_HALF = tx("A root isn't half", "Wurzel ist nicht die Hälfte");
const T_ROOT_LEFT = tx("Root not taken yet", "Wurzel noch nicht gezogen");
const T_PLACES = tx("Count places, not zeros", "Stellen zählen, nicht Nullen");
const T_ZEROS = tx("Counted the zeros", "Nullen gezählt");
const T_DIRECTION = tx("Wrong direction", "Falsche Richtung");
const T_OUTER_LOST = tx("Outer exponent lost", "Äußerer Exponent verloren");

const EXP_MUL = tx(
  "Ah, I see what happened! You multiplied the exponents. That's the rule for a power of a power, $(a^m)^n$. Here powers are multiplied with each other, so the exponents are **added**.",
  "Ah, ich seh, was passiert ist! Du hast die Exponenten multipliziert. Das ist die Regel für eine Potenz einer Potenz, $(a^m)^n$. Hier werden Potenzen miteinander multipliziert, also werden die Exponenten **addiert**.",
);
const EXP_ADD = tx(
  "Ah, I see what happened! You added the exponents, like for a product. But here the powers are **divided**, so you subtract them.",
  "Ah, ich seh, was passiert ist! Du hast die Exponenten addiert, wie beim Multiplizieren. Hier wird aber **dividiert**, also subtrahierst du sie.",
);
const EXP_DIV = tx(
  "I think I know what you did: you divided the exponents. But when you divide powers with the same base, you **subtract** them.",
  "Ich glaub, ich weiß, was du gemacht hast: Du hast die Exponenten geteilt. Beim Dividieren von Potenzen mit gleicher Basis werden sie aber **subtrahiert**.",
);
const NOT_NEG = tx(
  "Ooh, classic trap! A negative exponent doesn't make the number negative. It means **one divided by** the power.",
  "Ooh, die klassische Falle! Ein negativer Exponent macht die Zahl nicht negativ. Er bedeutet: **eins geteilt durch** die Potenz.",
);
const NOT_NEG_FLIP = tx(
  "Careful! A negative exponent never makes the result negative. It flips the fraction, that's all.",
  "Vorsicht! Ein negativer Exponent macht das Ergebnis nie negativ. Er dreht den Bruch um, mehr nicht.",
);

const order = (frac: boolean) =>
  frac
    ? tx(
        "Nearly! You subtracted the wrong way round. It's always the exponent on top minus the exponent below.",
        "Fast! Du hast andersrum subtrahiert. Es ist immer der Exponent oben minus der Exponent unten.",
      )
    : tx(
        "Nearly! You subtracted the wrong way round. It's always the exponent of the first power minus the exponent of the second.",
        "Fast! Du hast andersrum subtrahiert. Es ist immer der Exponent der ersten Potenz minus der Exponent der zweiten.",
      );

/** "You calculated 2 · 5. But 2^5 means 5 factors 2." */
const baseTimes = (B: string, n: number) =>
  tx(
    `I think I know what you did: you calculated $${B} \\cdot ${n}$. But $${pp(B, n)}$ means $${n}$ factors $${B}$, multiplied together.`,
    `Ich glaub, ich weiß, was du gemacht hast: Du hast $${B} \\cdot ${n}$ gerechnet. Aber $${pp(B, n)}$ bedeutet $${n}$ Faktoren $${B}$, miteinander multipliziert.`,
  );

/** Rule applied right, then b^r taken as b · r. */
const ruleThenTimes = (b: number, r: number) =>
  tx(
    `The power rule worked, nice! But $${pp(b, r)}$ means $${r}$ factors $${b}$, not $${b} \\cdot ${r}$.`,
    `Das Potenzgesetz hast du richtig angewendet, stark! Aber $${pp(b, r)}$ bedeutet $${r}$ Faktoren $${b}$, nicht $${b} \\cdot ${r}$.`,
  );

const countMinus = (n: number, B: string) =>
  n % 2 === 0
    ? tx(
        `Nearly! Count the minus signs: $${n}$ factors $${B}$ means $${n}$ minus signs, and every two of them make a plus.`,
        `Fast! Zähl die Minuszeichen: $${n}$ Faktoren $${B}$ heißt $${n}$ Minuszeichen, und je zwei davon ergeben Plus.`,
      )
    : tx(
        `Nearly! Count the minus signs: $${n}$ factors $${B}$ means $${n}$ minus signs. Two at a time make a plus, but one is left over.`,
        `Fast! Zähl die Minuszeichen: $${n}$ Faktoren $${B}$ heißt $${n}$ Minuszeichen. Je zwei ergeben Plus, aber eins bleibt übrig.`,
      );

const lostMinusAdd = (v: string, neg: number) =>
  tx(
    `Careful with the negative exponent! $${pp(v, neg)}$ adds $${neg}$, so the exponent goes **down** by $${-neg}$.`,
    `Vorsicht beim negativen Exponenten! Bei $${pp(v, neg)}$ addierst du $${neg}$, der Exponent wird also um $${-neg}$ **kleiner**.`,
  );

const loneTitle = (v: string) => tx(`The lone ${v} counts too`, /^\d/.test(v) ? `Die einzelne ${v} zählt mit` : `Das einzelne ${v} zählt mit`);
const loneSay = (v: string) =>
  tx(
    `Nearly! The lone $${v}$ is $${v}^1$, so it adds $1$ to the exponent too.`,
    `Fast! ${/^\d/.test(v) ? "Die einzelne" : "Das einzelne"} $${v}$ ist $${v}^1$, also kommt beim Exponenten noch $1$ dazu.`,
  );

const powAdd = (v: string, e1: number, k: number) =>
  tx(
    `Ah, I see what happened! In $(${pp(v, e1)})^{${k}}$ you added the exponents. But a power of a power means $${pp(v, e1)}$ taken $${k}$ times, so the exponents are **multiplied**.`,
    `Ah, ich seh, was passiert ist! Bei $(${pp(v, e1)})^{${k}}$ hast du die Exponenten addiert. Eine Potenz einer Potenz heißt aber: $${pp(v, e1)}$ wird $${k}$-mal mit sich selbst multipliziert, also werden die Exponenten **multipliziert**.`,
  );

const half = (x: string) =>
  tx(
    `Ah, I see what happened: you halved $${x}$. But the root asks which number **times itself** gives $${x}$.`,
    `Ah, ich seh, was passiert ist: Du hast $${x}$ halbiert. Aber die Wurzel fragt, welche Zahl **mal sich selbst** $${x}$ ergibt.`,
  );

/** b^n, (−b)^n and −b^n worked out. */
function powerValueMistakes(b: number, n: number, minusTrap: boolean): Mistake[] {
  if (minusTrap) {
    return collect(asNum(-(b ** n)), (add) => {
      add(
        asNum(b ** n),
        tx("Minus taken into the power", "Minus mitpotenziert"),
        tx(
          `Ooh, classic trap! Without brackets the exponent belongs only to the $${b}$. The minus isn't raised to the power, it just stays in front.`,
          `Ooh, die klassische Falle! Ohne Klammern gehört der Exponent nur zur $${b}$. Das Minus wird nicht mitpotenziert, es bleibt einfach davor.`,
        ),
      );
      add(asNum(-b * n), T_BASE_TIMES, baseTimes(String(b), n));
    });
  }
  const B = par(b);
  return collect(asNum(b ** n), (add) => {
    if (b < 0) add(asNum(-(b ** n)), T_COUNT_MINUS, countMinus(n, B), true);
    add(asNum(b * n), T_BASE_TIMES, baseTimes(B, n));
    if (b > 0)
      add(
        asNum(n ** b),
        tx("Base and exponent swapped", "Basis und Exponent vertauscht"),
        tx(
          `Ah, I see what happened! You calculated $${pp(n, b)}$. In $${pp(b, n)}$ the $${b}$ is the factor, and the $${n}$ counts how often it appears.`,
          `Ah, ich seh, was passiert ist! Du hast $${pp(n, b)}$ gerechnet. Bei $${pp(b, n)}$ ist die $${b}$ der Faktor, und die $${n}$ zählt, wie oft er vorkommt.`,
        ),
      );
    if (n > 2 && Math.abs(b) !== 1)
      add(
        asNum(b ** (n - 1)),
        tx("One factor short", "Ein Faktor zu wenig"),
        tx(
          `Nearly! That's $${pp(B, n - 1)}$: one factor is missing. $${pp(B, n)}$ has exactly $${n}$ factors $${B}$, so count them once more.`,
          `Fast! Das ist $${pp(B, n - 1)}$: Ein Faktor fehlt. $${pp(B, n)}$ hat genau $${n}$ Faktoren $${B}$, zähl sie noch mal nach.`,
        ),
        true,
      );
  });
}

/** x^a · x^b · … = x^n: find n. */
function productMistakes(v: string, exps: number[]): Mistake[] {
  const total = exps.reduce((s, e) => s + e, 0);
  const lone = exps.filter((e) => e === 1).length;
  const neg = exps.find((e) => e < 0);
  return collect(asNum(total), (add) => {
    add(
      asNum(exps.reduce((p, e) => p * e, 1)),
      T_EXP_MUL,
      EXP_MUL,
    );
    if (lone) add(asNum(total - lone), loneTitle(v), loneSay(v), true);
    if (neg !== undefined) add(asNum(exps.reduce((s, e) => s + Math.abs(e), 0)), T_LOST_MINUS, lostMinusAdd(v, neg), true);
  });
}

/** x^e1 : x^e2 = x^n: find n. */
function quotientMistakes(e1: number, e2: number, frac: boolean): Mistake[] {
  return collect(asNum(e1 - e2), (add) => {
    if (e2 > 0) add(asNum(e1 + e2), T_EXP_ADD, EXP_ADD);
    if (e2 < 0)
      add(
        asNum(e1 + e2),
        T_MINUS_MINUS,
        tx(
          `Careful: you're subtracting $${e2}$, a negative number. Minus a negative is **plus**: $${e1} - (${e2})$.`,
          `Vorsicht: Du ziehst $${e2}$ ab, also eine negative Zahl. Minus minus ergibt **plus**: $${e1} - (${e2})$.`,
        ),
        true,
      );
    add(asNum(e2 - e1), T_ORDER, order(frac), true);
    if (e1 % e2 === 0) add(asNum(e1 / e2), T_EXP_DIV, EXP_DIV);
    if (e1 < 0)
      add(
        asNum(-e1 - e2),
        T_LOST_MINUS,
        tx(
          `Careful, the first exponent is $${e1}$, so it's negative! Start at $${e1}$ and then subtract.`,
          `Vorsicht, der erste Exponent ist $${e1}$, also negativ! Fang bei $${e1}$ an und zieh dann ab.`,
        ),
        true,
      );
  });
}

/** b^e1 · b^e2 or b^e1 : b^e2, worked out to a number. */
function rulesMistakes(b: number, e1: number, e2: number, div: boolean): Mistake[] {
  const r = div ? e1 - e2 : e1 + e2;
  return collect(asNum(b ** r), (add) => {
    if (div) {
      add(
        asNum(1),
        tx("Bases divided too", "Basen auch geteilt"),
        tx(
          `Ooh, I see! You divided the bases too: $${b} : ${b} = 1$. But the base stays $${b}$, only the exponents change.`,
          `Ooh, ich seh's! Du hast auch die Basen geteilt: $${b} : ${b} = 1$. Die Basis bleibt aber $${b}$, nur die Exponenten ändern sich.`,
        ),
      );
      if (e1 % e2 === 0) add(asNum(b ** (e1 / e2)), T_EXP_DIV, EXP_DIV);
    } else {
      if (e1 === 1 || e2 === 1) add(asNum(b ** (r - 1)), loneTitle(String(b)), loneSay(String(b)), true);
      add(
        asNum((b * b) ** r),
        tx("Bases multiplied too", "Basen mitmultipliziert"),
        tx(
          `Ah, I see what happened! You multiplied the bases too: $${b} \\cdot ${b} = ${b * b}$. But the base stays $${b}$, only the exponents are added.`,
          `Ah, ich seh, was passiert ist! Du hast auch die Basen multipliziert: $${b} \\cdot ${b} = ${b * b}$. Die Basis bleibt aber $${b}$, nur die Exponenten werden addiert.`,
        ),
      );
      add(asNum(b ** (e1 * e2)), T_EXP_MUL, EXP_MUL);
    }
    add(asNum(b * r), T_BASE_TIMES, ruleThenTimes(b, r));
  });
}

/** (x^e1)^k (· x^extra) = x^n: find n. */
function powerOfPowerMistakes(v: string, e1: number, k: number, extra: number | null): Mistake[] {
  const x = extra ?? 0;
  return collect(asNum(e1 * k + x), (add) => {
    add(asNum(e1 + k + x), T_POW_ADD, powAdd(v, e1, k));
    if (e1 > 0)
      add(
        asNum(e1 ** k + x),
        tx("Exponent raised to a power", "Exponent potenziert"),
        tx(
          `I think I know what you did: you worked out $${pp(e1, k)}$. But $(${pp(v, e1)})^{${k}}$ means $${pp(v, e1)}$ taken $${k}$ times, so it's $${e1} \\cdot ${k}$ in the exponent.`,
          `Ich glaub, ich weiß, was du gemacht hast: Du hast $${pp(e1, k)}$ gerechnet. Aber $(${pp(v, e1)})^{${k}}$ heißt: $${pp(v, e1)}$ wird $${k}$-mal mit sich selbst multipliziert, im Exponenten steht also $${e1} \\cdot ${k}$.`,
        ),
      );
    if (extra === 1) add(asNum(e1 * k), loneTitle(v), loneSay(v), true);
    else if (extra !== null)
      add(
        asNum(e1 * k * extra),
        tx("Multiplied once too often", "Einmal zu viel multipliziert"),
        tx(
          `The bracket is right! But $${pp(v, extra)}$ is just one more factor with the same base, so its exponent is **added**, not multiplied.`,
          `Die Klammer stimmt! Aber $${pp(v, extra)}$ ist einfach ein weiterer Faktor mit gleicher Basis, sein Exponent wird also **addiert**, nicht multipliziert.`,
        ),
      );
    if (e1 < 0)
      add(
        asNum(-e1 * k + x),
        T_LOST_MINUS,
        tx(
          `Careful with the sign: the exponent in the bracket is $${e1}$, and $${par(e1)} \\cdot ${k}$ is negative.`,
          `Vorsicht mit dem Vorzeichen: Der Exponent in der Klammer ist $${e1}$, und $${par(e1)} \\cdot ${k}$ ist negativ.`,
        ),
        true,
      );
    if (extra !== null && extra < 0) add(asNum(e1 * k - extra), T_LOST_MINUS, lostMinusAdd(v, extra), true);
    add(
      asNum(e1 + x),
      T_OUTER_LOST,
      tx(
        `Hmm, it looks like the outer exponent $${k}$ got lost. $(${pp(v, e1)})^{${k}}$ means $${pp(v, e1)}$ taken $${k}$ times.`,
        `Hm, sieht so aus, als wäre der äußere Exponent $${k}$ verloren gegangen. $(${pp(v, e1)})^{${k}}$ heißt: $${pp(v, e1)}$ wird $${k}$-mal mit sich selbst multipliziert.`,
      ),
    );
  });
}

/** b^{-e} as a fraction. */
function negPowerMistakes(b: number, e: number): Mistake[] {
  const P = b ** e;
  return collect(asFrac(1, P), (add) => {
    add(asFrac(-1, P), T_NOT_NEG, NOT_NEG);
    add(
      asFrac(P, 1),
      T_NEG_IGNORED,
      tx(
        `Nearly! $${pp(b, e)}$ is the right power, but the exponent has a **minus**. That means one divided by the power.`,
        `Fast! $${pp(b, e)}$ ist die richtige Potenz, aber der Exponent hat ein **Minus**. Das heißt: eins geteilt durch die Potenz.`,
      ),
    );
    add(asFrac(-P, 1), T_NOT_NEG, NOT_NEG);
    add(
      asFrac(1, b * e),
      T_BASE_TIMES,
      tx(
        `The **one divided by** part is right! But $${pp(b, e)}$ means $${e}$ factors $${b}$, not $${b} \\cdot ${e}$.`,
        `Das **eins geteilt durch** stimmt! Aber $${pp(b, e)}$ bedeutet $${e}$ Faktoren $${b}$, nicht $${b} \\cdot ${e}$.`,
      ),
    );
  });
}

/** 10^{-e} as a decimal. */
function tenPowerMistakes(e: number): Mistake[] {
  return collect(asNum(Number(`1e-${e}`)), (add) => {
    if (e >= 2)
      add(
        asNum(Number(`1e-${e + 1}`)),
        T_PLACES,
        tx(
          `Nearly! Count the places, not the zeros: the $1$ itself is one of the $${e}$ places after the comma.`,
          `Fast! Zähl die Stellen, nicht die Nullen: Die $1$ selbst ist eine der $${e}$ Stellen nach dem Komma.`,
        ),
        true,
      );
    add(asNum(-(10 ** e)), T_NOT_NEG, NOT_NEG);
    add(asNum(-Number(`1e-${e}`)), T_NOT_NEG, NOT_NEG);
    add(
      asNum(10 ** e),
      T_NEG_IGNORED,
      tx(
        `You worked out $${pp(10, e)}$, but the exponent is **negative**. A negative exponent means one divided by the power.`,
        `Du hast $${pp(10, e)}$ ausgerechnet, aber der Exponent ist **negativ**. Ein negativer Exponent bedeutet: eins geteilt durch die Potenz.`,
      ),
    );
  });
}

/** (1/b)^{-e} as a number. */
function flipPowerMistakes(b: number, e: number): Mistake[] {
  return collect(asNum(b ** e), (add) => {
    add(
      asNum(1 / b ** e),
      T_NEG_IGNORED,
      tx(
        `You worked out $(\\frac{1}{${b}})^{${e}}$. But the exponent is $-${e}$, and that minus **flips** the fraction first.`,
        `Du hast $(\\frac{1}{${b}})^{${e}}$ ausgerechnet. Aber der Exponent ist $-${e}$, und dieses Minus **dreht** den Bruch erst um.`,
      ),
    );
    add(asNum(-(b ** e)), T_NOT_NEG, NOT_NEG_FLIP);
    add(asNum(-1 / b ** e), T_NOT_NEG, NOT_NEG_FLIP);
    add(
      asNum(b * e),
      T_BASE_TIMES,
      tx(
        `Flipping the fraction was right! But $${pp(b, e)}$ means $${e}$ factors $${b}$, not $${b} \\cdot ${e}$.`,
        `Den Bruch umdrehen war richtig! Aber $${pp(b, e)}$ bedeutet $${e}$ Faktoren $${b}$, nicht $${b} \\cdot ${e}$.`,
      ),
    );
  });
}

/** b^{-e1} · b^{e2} as a number. */
function negProductMistakes(b: number, e1: number, e2: number): Mistake[] {
  const r = e2 - e1;
  return collect(asNum(b ** r), (add) => {
    if (r === 0)
      add(
        asNum(0),
        tx("Power of zero", "Hoch null"),
        tx(
          `Nearly! The exponent $0$ is right. But $${b}^0$ isn't $0$: think of $${b} : ${b}$, a number divided by itself.`,
          `Fast! Der Exponent $0$ stimmt. Aber $${b}^0$ ist nicht $0$: Denk an $${b} : ${b}$, eine Zahl geteilt durch sich selbst.`,
        ),
        true,
      );
    if (b ** (e1 + e2) <= 1000) add(asNum(b ** (e1 + e2)), T_LOST_MINUS, lostMinusAdd(String(b), -e1), true);
    add(asNum(b * r), T_BASE_TIMES, ruleThenTimes(b, r));
    add(asNum(-(b ** r)), T_NOT_NEG, NOT_NEG);
  });
}

/** A number written as a · 10^n (digits like "36", exponent n). */
function sciMistakes(digits: string, e: number): Mistake[] {
  const mant = Number(digits) / 10 ** (digits.length - 1);
  const at = pairOf(["a", "n"]);
  const two = digits.length === 2;
  return collect(at(mant, e), (add) => {
    if (e < 0) {
      add(
        at(mant, -e),
        tx("Sign of the exponent", "Vorzeichen vom Exponenten"),
        tx(
          "Nearly! The number is smaller than $1$ and the comma moved to the **right**, so the exponent is negative.",
          "Fast! Die Zahl ist kleiner als $1$, und das Komma ist nach **rechts** gerutscht, also ist der Exponent negativ.",
        ),
        true,
      );
      add(
        at(mant, e + 1),
        T_ZEROS,
        tx(
          `Ah, I see what happened! You counted the zeros after the comma. But the comma also has to jump over the $${digits[0]}$, so count the places it moves.`,
          `Ah, ich seh, was passiert ist! Du hast die Nullen nach dem Komma gezählt. Aber das Komma muss auch noch über die $${digits[0]}$ springen. Zähl die Stellen, um die es rutscht.`,
        ),
        true,
      );
    } else {
      if (two)
        add(
          at(mant, e - 1),
          T_ZEROS,
          tx(
            `Ah, I see what happened! You counted the zeros. But the comma also jumps over the $${digits[1]}$, so count the places it moves.`,
            `Ah, ich seh, was passiert ist! Du hast die Nullen gezählt. Aber das Komma springt auch über die $${digits[1]}$. Zähl die Stellen, um die es rutscht.`,
          ),
          true,
        );
      add(
        at(mant, -e),
        T_DIRECTION,
        tx(
          "Nearly! The number is big and the comma moved to the **left**, so the exponent is positive.",
          "Fast! Die Zahl ist groß, und das Komma ist nach **links** gerutscht, also ist der Exponent positiv.",
        ),
        true,
      );
    }
    if (two)
      add(
        at(Number(digits), e - 1),
        tx("a is too big", "a ist zu groß"),
        tx(
          `The value is right, nice! But $a$ has to be between $1$ and $10$, and $${digits}$ is too big. Move the comma one more place.`,
          `Der Wert stimmt, stark! Aber $a$ muss zwischen $1$ und $10$ liegen, und $${digits}$ ist zu groß. Verschieb das Komma noch um eine Stelle.`,
        ),
        true,
      );
  });
}

/** a · 10^e (e < 0) back to a decimal. */
function sciBackMistakes(digits: string, mant: number, e: number): Mistake[] {
  const k = -e;
  return collect(asNum(Number(`${mant}e${e}`)), (add) => {
    add(
      asNum(Number(`${mant}e${k}`)),
      T_DIRECTION,
      tx(
        "Oops, the comma went the wrong way! A negative exponent makes the number **smaller**, so the comma moves to the left.",
        "Hoppla, das Komma ist in die falsche Richtung gerutscht! Ein negativer Exponent macht die Zahl **kleiner**, also rutscht das Komma nach links.",
      ),
    );
    add(
      asNum(Number(`${mant}e${e - 1}`)),
      T_PLACES,
      k === 1
        ? tx(
            `Nearly! The comma moves $1$ place, but that doesn't add a zero: the $${digits[0]}$ itself takes that place.`,
            `Fast! Das Komma rutscht um $1$ Stelle, dabei kommt aber keine Null dazu: Die $${digits[0]}$ selbst belegt diese Stelle.`,
          )
        : tx(
            `Nearly! The comma moves $${k}$ places, but that's not $${k}$ zeros: the $${digits[0]}$ itself takes one of the places.`,
            `Fast! Das Komma rutscht um $${k}$ Stellen, das sind aber nicht $${k}$ Nullen: Die $${digits[0]}$ selbst belegt eine der Stellen.`,
          ),
      true,
    );
  });
}

/** (k·x^e1)^j · d·x^e2, or divided by d·x^e2: c and n. */
function bracketMistakes(v: string, k: number, e1: number, j: number, d: number, e2: number, divide: boolean): Mistake[] {
  const K = k ** j;
  const by = (x: number) => (divide ? x / d : x * d);
  const n = divide ? e1 * j - e2 : e1 * j + e2;
  const at = pairOf(["c", "n"]);
  return collect(at(by(K), n), (add) => {
    add(
      at(by(k), n),
      k === -1 ? tx("Minus left out of the power", "Minus nicht mitpotenziert") : tx("Number left out of the power", "Zahl nicht mitpotenziert"),
      k === -1
        ? tx(
            `Ooh, classic trap! The exponent $${j}$ belongs to **every** factor in the bracket, so the minus in front gets it too.`,
            `Ooh, die klassische Falle! Der Exponent $${j}$ gehört zu **jedem** Faktor in der Klammer, also auch zum Minus davor.`,
          )
        : tx(
            `Ooh, classic trap! The exponent $${j}$ belongs to **every** factor in the bracket, so the number $${par(k)}$ gets it too.`,
            `Ooh, die klassische Falle! Der Exponent $${j}$ gehört zu **jedem** Faktor in der Klammer, also auch zur Zahl $${par(k)}$.`,
          ),
    );
    if (Math.abs(k) !== 1) add(at(by(k * j), n), T_BASE_TIMES, baseTimes(par(k), j));
    if (e1 !== 1) add(at(by(K), divide ? e1 + j - e2 : e1 + j + e2), T_POW_ADD, powAdd(v, e1, j));
    if (k < 0) add(at(by(-K), n), T_COUNT_MINUS, countMinus(j, par(k)), true);
  });
}

/** √N = a√b, possibly with a number t in front: a not fully simplified, or the square itself pulled out. */
function rootSplitSlips(N: number, t: number, add: AddMistake, at: (a: number, b: number) => AnswerSpec) {
  const s = largestSquareRoot(N);
  const r = N / (s * s);
  for (let u = 2; u < s; u++) {
    if (s % u !== 0) continue;
    add(
      at(t * u, N / (u * u)),
      tx("Not finished yet", "Noch nicht fertig"),
      tx(
        `Good start, and the value is right! But $${N / (u * u)}$ still hides a square number. Look for the **biggest** square in $${N}$.`,
        `Guter Anfang, und der Wert stimmt! Aber in $${N / (u * u)}$ steckt noch eine Quadratzahl. Such die **größte** Quadratzahl in $${N}$.`,
      ),
      true,
    );
  }
  add(
    at(t * s * s, r),
    tx("Root of the square", "Wurzel aus der Quadratzahl"),
    tx(
      `Nearly! You found the square $${s * s}$, great. But what comes out in front is its root, $\\sqrt{${s * s}}$, not $${s * s}$ itself.`,
      `Fast! Die Quadratzahl $${s * s}$ hast du gefunden, super. Aber vor die Wurzel kommt ihre Wurzel, $\\sqrt{${s * s}}$, nicht die $${s * s}$ selbst.`,
    ),
    true,
  );
}

function rootMistakes(N: number, t = 1): Mistake[] {
  const s = largestSquareRoot(N);
  const r = N / (s * s);
  const at = pairOf(["a", "b"]);
  return collect(at(t * s, r), (add) => {
    if (t !== 1) {
      add(
        at(s, r),
        tx("The number in front", "Die Zahl davor"),
        tx(
          `You simplified $\\sqrt{${N}}$ correctly! But the $${t}$ in front is still there: multiply it by the number that comes out.`,
          `$\\sqrt{${N}}$ hast du richtig vereinfacht! Aber die $${t}$ davor ist ja noch da: Multipliziere sie mit der Zahl, die herauskommt.`,
        ),
        true,
      );
      add(
        at(t + s, r),
        T_POW_ADD,
        tx(
          `Nearly! The $${t}$ in front means $${t}$ **times** the root. So multiply it by the number that comes out, don't add.`,
          `Fast! Die $${t}$ davor heißt $${t}$ **mal** die Wurzel. Multipliziere sie also mit der Zahl, die herauskommt, statt zu addieren.`,
        ),
      );
    }
    rootSplitSlips(N, t, add, at);
  });
}

/** √a · √b = a√b: multiplied under one root, then not (fully) simplified. */
function rootPairMistakes(a: number, b: number): Mistake[] {
  const N = a * b;
  const s = largestSquareRoot(N);
  const at = pairOf(["a", "b"]);
  return collect(at(s, N / (s * s)), (add) => {
    add(
      at(1, N),
      tx("Not simplified yet", "Noch nicht vereinfacht"),
      tx(
        `$\\sqrt{${a}} \\cdot \\sqrt{${b}} = \\sqrt{${N}}$ is right, nice! Now simplify it: look for the biggest square in $${N}$.`,
        `$\\sqrt{${a}} \\cdot \\sqrt{${b}} = \\sqrt{${N}}$ stimmt, stark! Jetzt noch vereinfachen: Such die größte Quadratzahl in $${N}$.`,
      ),
      true,
    );
    rootSplitSlips(N, 1, add, at);
  });
}

/** √(s1²·r) ± √(s2²·r) = a√r. */
function rootSumMistakes(r: number, s1: number, s2: number, minus: boolean): Mistake[] {
  const op = minus ? "-" : "+";
  const a = minus ? s1 - s2 : s1 + s2;
  const N1 = s1 * s1 * r;
  const N2 = s2 * s2 * r;
  const at = pairOf(["a", "b"]);
  const out = (s: number) => `${s === 1 ? "" : s}\\sqrt{${r}}`;
  const asX = (s: number) => `${s === 1 ? "" : s}x`;
  return collect(at(a, r), (add) => {
    const M = minus ? N1 - N2 : N1 + N2;
    const m = largestSquareRoot(M);
    add(
      at(m, M / (m * m)),
      minus ? tx("Subtracted under one root", "Unter einer Wurzel subtrahiert") : tx("Added under one root", "Unter einer Wurzel addiert"),
      tx(
        `Ooh, classic trap! $\\sqrt{${N1}} ${op} \\sqrt{${N2}}$ is **not** $\\sqrt{${N1} ${op} ${N2}}$. Simplify each root on its own first, then combine.`,
        `Ooh, die klassische Falle! $\\sqrt{${N1}} ${op} \\sqrt{${N2}}$ ist **nicht** $\\sqrt{${N1} ${op} ${N2}}$. Vereinfache zuerst jede Wurzel für sich, dann fass zusammen.`,
      ),
    );
    if (!minus)
      add(
        at(a, 2 * r),
        tx("The root got added too", "Wurzel mitaddiert"),
        tx(
          `Nearly! $${out(s1)} + ${out(s2)}$ works like $${asX(s1)} + ${asX(s2)}$: the numbers in front add up, but $\\sqrt{${r}}$ stays as it is.`,
          `Fast! $${out(s1)} + ${out(s2)}$ funktioniert wie $${asX(s1)} + ${asX(s2)}$: Die Zahlen davor werden addiert, aber $\\sqrt{${r}}$ bleibt, wie es ist.`,
        ),
      );
    if (s1 === 1 || s2 === 1) {
      const c = (s: number) => (s === 1 ? 0 : s);
      add(
        at(minus ? c(s1) - c(s2) : c(s1) + c(s2), r),
        tx("The lone root counts too", "Die einzelne Wurzel zählt mit"),
        tx(
          `Nearly! A root on its own, $\\sqrt{${r}}$, counts as $1\\sqrt{${r}}$. Don't forget that $1$.`,
          `Fast! Eine Wurzel ganz allein, $\\sqrt{${r}}$, zählt als $1\\sqrt{${r}}$. Vergiss diese $1$ nicht.`,
        ),
        true,
      );
    }
  });
}

/** Check by squaring: x² isn't the number under the root. */
const squareCheck = (x: number, target: number) =>
  tx(
    `Nearly, the digits are right! But check by squaring: $${dec(x)}^2 = ${dec(x * x)}$, not $${dec(target)}$.`,
    `Fast, die Ziffern stimmen! Aber mach die Probe: $${dec(x)}^2 = ${dec(x * x)}$, nicht $${dec(target)}$.`,
  );

/** √(k²/100) as a decimal. */
function decimalRootMistakes(k: number): Mistake[] {
  const N = (k * k) / 100;
  const T_SQUARE = tx("Check by squaring", "Mach die Quadratprobe");
  return collect(asNum(k / 10), (add) => {
    add(asNum(k / 100), T_SQUARE, squareCheck(k / 100, N), true);
    add(asNum(k), T_SQUARE, squareCheck(k, N), true);
    add(asNum(N / 2), T_HALF, half(dec(N)));
  });
}

/** √(a²/b²) as a fraction. */
function fractionRootMistakes(a: number, b: number): Mistake[] {
  return collect(asFrac(a, b), (add) => {
    add(
      asFrac(a, b * b),
      tx("Only the top", "Nur der Zähler"),
      tx(
        "You took the root of the top, nice! But the bottom needs its root too: take the root of top **and** bottom.",
        "Die Wurzel aus dem Zähler hast du gezogen, gut! Der Nenner braucht aber auch seine Wurzel: Zieh sie aus Zähler **und** Nenner.",
      ),
    );
    add(
      asFrac(a * a, b),
      tx("Only the bottom", "Nur der Nenner"),
      tx(
        "You took the root of the bottom, nice! But the top needs its root too: take the root of top **and** bottom.",
        "Die Wurzel aus dem Nenner hast du gezogen, gut! Der Zähler braucht aber auch seine Wurzel: Zieh sie aus Zähler **und** Nenner.",
      ),
    );
  });
}

/** √a · √b or √a : √b as a whole number: put under one root, then the root forgotten or halved. */
function rootCalcMistakes(a: number, b: number, value: number, divide: boolean): Mistake[] {
  const inside = divide ? a / b : a * b;
  const op = divide ? ":" : "\\cdot";
  return collect(asNum(value), (add) => {
    add(
      asNum(inside),
      T_ROOT_LEFT,
      tx(
        `One root for both was right: $\\sqrt{${a} ${op} ${b}}$. But then you still need the root of $${inside}$!`,
        `Beide unter eine Wurzel, richtig: $\\sqrt{${a} ${op} ${b}}$. Aber dann musst du aus $${inside}$ noch die Wurzel ziehen!`,
      ),
      true,
    );
    add(asNum(inside / 2), T_HALF, half(String(inside)));
  });
}

/** c1·x^e1 · c2·x^e2 = c·x^n. */
function coefProductMistakes(v: string, c1: number, c2: number, e1: number, e2: number): Mistake[] {
  const at = pairOf(["c", "n"]);
  const n = e1 + e2;
  return collect(at(c1 * c2, n), (add) => {
    add(
      at(c1 + c2, n),
      tx("Numbers added", "Zahlen addiert"),
      tx(
        "The exponent is right! But the numbers in front get **multiplied** too: it's all one big product.",
        "Der Exponent stimmt! Aber die Zahlen davor werden auch **multipliziert**: Das ist alles ein einziges Produkt.",
      ),
    );
    add(at(c1 * c2, e1 * e2), T_EXP_MUL, EXP_MUL);
    if (e2 < 0) add(at(c1 * c2, e1 - e2), T_LOST_MINUS, lostMinusAdd(v, e2), true);
  });
}

/** top·x^e1 / (d·x^e2) = c·x^n. */
function coefQuotientMistakes(top: number, d: number, e1: number, e2: number): Mistake[] {
  const at = pairOf(["c", "n"]);
  const c = top / d;
  return collect(at(c, e1 - e2), (add) => {
    add(
      at(top - d, e1 - e2),
      tx("Numbers subtracted", "Zahlen subtrahiert"),
      tx(
        "The exponent is right! But the numbers form a fraction too, so **divide** them.",
        "Der Exponent stimmt! Aber die Zahlen bilden auch einen Bruch, also **teilst** du sie.",
      ),
    );
    add(at(c, e2 - e1), T_ORDER, order(true), true);
    add(at(c, e1 + e2), T_EXP_ADD, EXP_ADD);
    if (e1 % e2 === 0) add(at(c, e1 / e2), T_EXP_DIV, EXP_DIV);
  });
}

/** (u^p1 w^q1)^k · u^p2 w^q2 = u^m w^n. */
function twoVarBracketMistakes(u: string, w: string, k: number, p1: number, q1: number, p2: number, q2: number): Mistake[] {
  const at = pairOf(["m", "n"]);
  return collect(at(p1 * k + p2, q1 * k + q2), (add) => {
    add(
      at(p1 * k + p2, q1 + q2),
      tx("Only the first factor", "Nur der erste Faktor"),
      tx(
        `The outer exponent $${k}$ only reached $${u}$! It belongs to **every** factor in the bracket, so to $${w}$ as well.`,
        `Der äußere Exponent $${k}$ hat nur $${u}$ erwischt! Er gehört zu **jedem** Faktor in der Klammer, also auch zu $${w}$.`,
      ),
    );
    add(
      at(p1 + k + p2, q1 + k + q2),
      T_POW_ADD,
      tx(
        `Ah, I see what happened! You added the outer $${k}$ to the exponents in the bracket. A power of a power **multiplies** the exponents.`,
        `Ah, ich seh, was passiert ist! Du hast die äußere $${k}$ zu den Exponenten in der Klammer addiert. Bei einer Potenz einer Potenz werden die Exponenten **multipliziert**.`,
      ),
    );
    add(
      at(p1 + p2, q1 + q2),
      T_OUTER_LOST,
      tx(
        `Hmm, it looks like the outer exponent $${k}$ got lost. Multiply every exponent in the bracket by $${k}$ first.`,
        `Hm, sieht so aus, als wäre der äußere Exponent $${k}$ verloren gegangen. Multipliziere zuerst jeden Exponenten in der Klammer mit $${k}$.`,
      ),
    );
  });
}

/** u^p1 w^q1 / (u^p2 w^q2) = u^m w^n. */
function twoVarQuotientMistakes(p1: number, q1: number, p2: number, q2: number): Mistake[] {
  const at = pairOf(["m", "n"]);
  return collect(at(p1 - p2, q1 - q2), (add) => {
    add(at(p2 - p1, q2 - q1), T_ORDER, order(true), true);
    add(at(p1 + p2, q1 + q2), T_EXP_ADD, EXP_ADD);
  });
}

/** (a1 · 10^e1) · or : (a2 · 10^e2) = a · 10^n. */
function sciCalcMistakes(a1: number, e1: number, a2: number, e2: number, div: boolean): Mistake[] {
  const at = pairOf(["a", "n"]);
  const P = div ? a1 / a2 : a1 * a2;
  const E = div ? e1 - e2 : e1 + e2;
  const up = P >= 10;
  const shift = up ? 1 : P < 1 ? -1 : 0;
  const mant = P / 10 ** shift;
  return collect(at(mant, E + shift), (add) => {
    if (shift) {
      add(
        at(P, E),
        up ? tx("a must be below 10", "a muss kleiner als 10 sein") : tx("a must be at least 1", "a muss mindestens 1 sein"),
        tx(
          `The calculation is right! But $a = ${dec(P)}$ isn't between $1$ and $10$. Move the comma and adjust $n$ so the value stays the same.`,
          `Die Rechnung stimmt! Aber $a = ${dec(P)}$ liegt nicht zwischen $1$ und $10$. Verschieb das Komma und pass $n$ so an, dass der Wert gleich bleibt.`,
        ),
        true,
      );
      add(
        at(mant, E - shift),
        tx("n adjusted the wrong way", "n in die falsche Richtung angepasst"),
        up
          ? tx(
              "Nearly! $a$ got 10 times smaller, so $10^n$ has to get 10 times bigger to keep the value: $n$ goes **up** by one.",
              "Fast! $a$ ist 10-mal kleiner geworden, also muss $10^n$ 10-mal größer werden, damit der Wert gleich bleibt: $n$ wird um eins **größer**.",
            )
          : tx(
              "Nearly! $a$ got 10 times bigger, so $10^n$ has to get 10 times smaller to keep the value: $n$ goes **down** by one.",
              "Fast! $a$ ist 10-mal größer geworden, also muss $10^n$ 10-mal kleiner werden, damit der Wert gleich bleibt: $n$ wird um eins **kleiner**.",
            ),
        true,
      );
    }
    if (div) {
      add(at(mant, e2 - e1 + shift), T_ORDER, order(false), true);
      add(at(mant, e1 + e2 + shift), T_EXP_ADD, EXP_ADD);
    } else add(at(mant, e1 * e2 + shift), T_EXP_MUL, EXP_MUL);
  });
}

/** (a/b)^{-e} as a fraction. */
function negFractionMistakes(a: number, b: number, e: number): Mistake[] {
  return collect(asFrac(b ** e, a ** e), (add) => {
    add(
      asFrac(a ** e, b ** e),
      T_NEG_IGNORED,
      tx(
        `You raised the fraction to the power $${e}$, nice! But the exponent is $-${e}$, and the minus **flips** the fraction.`,
        `Den Bruch hoch $${e}$ hast du richtig genommen, gut! Aber der Exponent ist $-${e}$, und das Minus **dreht** den Bruch um.`,
      ),
    );
    add(asFrac(-(b ** e), a ** e), T_NOT_NEG, NOT_NEG_FLIP);
    add(
      asFrac(b ** e, a),
      tx("Only the top", "Nur der Zähler"),
      tx("Flipping was right! But the exponent belongs to the top **and** the bottom.", "Das Umdrehen war richtig! Aber der Exponent gilt für Zähler **und** Nenner."),
    );
    add(
      asFrac(b, a),
      tx("Exponent forgotten", "Exponent vergessen"),
      tx(
        `Flipping was right! But the power $${e}$ still has to go to the top and the bottom.`,
        `Das Umdrehen war richtig! Aber Zähler und Nenner müssen noch hoch $${e}$ genommen werden.`,
      ),
    );
  });
}

/** b^{-e1} / b^{-e2} as a number. */
function negQuotientMistakes(b: number, e1: number, e2: number): Mistake[] {
  const r = e2 - e1;
  return collect(asNum(b ** r), (add) => {
    if (b ** (e1 + e2) <= 1000)
      add(
        asNum(b ** -(e1 + e2)),
        T_MINUS_MINUS,
        tx(
          `Careful: you subtract $-${e2}$, a negative number. Minus a negative is **plus**: $-${e1} - (-${e2})$.`,
          `Vorsicht: Du ziehst $-${e2}$ ab, also eine negative Zahl. Minus minus ergibt **plus**: $-${e1} - (-${e2})$.`,
        ),
        true,
      );
    add(asNum(b ** -r), T_ORDER, order(true), true);
    add(asNum(b * r), T_BASE_TIMES, ruleThenTimes(b, r));
  });
}

// ---------------------------------------------------------------------------
// Exercise generator. Each shape returns null for a degenerate draw (retried).

const VARS = ["x", "a", "y", "b", "z"] as const;
const LETTER_PAIRS: [string, string][] = [
  ["a", "b"],
  ["x", "y"],
  ["r", "s"],
];
const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

type Shape = (rng: Rng, level: Level) => Exercise | null;

const CALCULATE = tx("Calculate", "Berechne");
const SIMPLIFY = tx("Simplify", "Vereinfache");
const SIMPLIFY_ROOT = tx("Simplify the root", "Vereinfache die Wurzel");
const AS_FRACTION = tx("Write as a fraction", "Schreib als Bruch");
const AS_DECIMAL = tx("Write as a decimal number", "Schreib als Dezimalzahl");
const SAME_BASE_ADD = tx("Same base: add the exponents.", "Gleiche Basis: Addiere die Exponenten.");
const DIVIDE_POWERS = tx("Divide powers: subtract the exponents.", "Potenzen dividieren: Subtrahiere die Exponenten.");
const NO_WHOLE_ROOT = tx("Neither root is a whole number on its own.", "Keine der beiden Wurzeln ist für sich allein eine ganze Zahl.");
const ROOT_TOP_BOTTOM = tx("Take the root of the top and of the bottom.", "Zieh die Wurzel aus Zähler und Nenner.");
const ONE_ROOT_RULE = tx(
  "Put both under one root: $\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{a \\cdot b}$.",
  "Schreib beide unter eine Wurzel: $\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{a \\cdot b}$.",
);

const findN = (math: string, n: number, hint: Text, solution: Frame[], mistakes?: Mistake[]): Exercise => ({
  instruction: tx("Find the exponent n", "Bestimme den Exponenten n"),
  math,
  answer: { kind: "number", value: n, label: "n =" },
  hint,
  solution,
  mistakes,
});

const evalPower: Shape = (rng, level) => {
  if (level >= 2 && rng.chance(0.4)) {
    const b = rng.int(2, 5);
    const n = b === 2 ? rng.pick([2, 4]) : 2;
    return {
      instruction: CALCULATE,
      math: `-${b}^{${n}}`,
      answer: { kind: "number", value: -(b ** n) },
      hint: tx("Which number does the exponent belong to? Is the minus part of the base?", "Zu welcher Zahl gehört der Exponent? Gehört das Minus zur Basis?"),
      solution: minusTrapFrames(b, n),
      mistakes: powerValueMistakes(b, n, true),
    };
  }
  let b: number;
  let n: number;
  if (rng.chance(level === 1 ? 0.3 : 0.65)) {
    b = rng.pick([-2, -2, -3, -1, -4, -5]);
    n = b === -2 ? rng.int(2, 6) : b === -3 ? rng.int(2, 4) : b === -1 ? rng.int(5, 12) : rng.int(2, 3);
  } else {
    b = rng.pick([2, 2, 3, 3, 4, 5, 6, 7, 8]);
    n = b === 2 ? rng.int(3, 8) : b === 3 ? rng.int(3, 5) : b <= 5 ? rng.int(3, 4) : 3;
  }
  if (Math.abs(b ** n) > 650) return null;
  return {
    instruction: CALCULATE,
    math: pp(par(b), n),
    answer: { kind: "number", value: b ** n },
    hint:
      b < 0
        ? tx(
            "Write out the factors. Count the minus signs: even gives plus, odd gives minus.",
            "Schreib die Faktoren aus. Zähl die Minuszeichen: Eine gerade Anzahl ergibt Plus, eine ungerade Minus.",
          )
        : tx(`$${pp(b, n)}$ means $${n}$ factors $${b}$, not $${b} \\cdot ${n}$.`, `$${pp(b, n)}$ bedeutet $${n}$ Faktoren $${b}$, nicht $${b} \\cdot ${n}$.`),
    solution: evalPowerFrames(b, n),
    mistakes: powerValueMistakes(b, n, false),
  };
};

const productExponent: Shape = (rng, level) => {
  const v = rng.chance(0.25) ? rng.pick(["2", "3", "5", "10"]) : rng.pick(VARS);
  const count = rng.chance(0.35) ? 3 : 2;
  const exps: number[] = [];
  for (let i = 0; i < count; i++) {
    const lone = i === count - 1 && count === 3 && rng.chance(0.5);
    exps.push(lone ? 1 : level === 1 ? rng.int(2, 9) : rng.chance(0.35) ? -rng.int(1, 6) : rng.int(2, 9));
  }
  if (level >= 2 && !exps.some((e) => e < 0)) exps[rng.int(0, count - 1)] = -rng.int(1, 6);
  const total = exps.reduce((s, e) => s + e, 0);
  if (total === 0 || total === 1 || Math.abs(total) > 20) return null;
  const lhs = exps.map((e) => pp(v, e)).join(" \\cdot ");
  const hint = exps.includes(1)
    ? tx(`A lone $${v}$ counts as $${v}^1$.`, `${loneDe(v)} zählt als $${v}^1$.`)
    : exps.some((e) => e < 0)
      ? tx("Add the exponents and watch the signs: $5 + (-2) = 3$.", "Addiere die Exponenten und achte auf die Vorzeichen: $5 + (-2) = 3$.")
      : SAME_BASE_ADD;
  return findN(`${lhs} = ${v}^{\\blob{n}}`, total, hint, productFrames(v, exps), productMistakes(v, exps));
};

const quotientExponent: Shape = (rng, level) => {
  const v = rng.chance(0.25) ? rng.pick(["2", "3", "10"]) : rng.pick(VARS);
  let e1: number;
  let e2: number;
  if (level === 1) {
    e1 = rng.int(5, 12);
    e2 = rng.int(2, e1 - 1);
  } else {
    const kind = rng.int(0, 2);
    if (kind === 0) {
      e1 = rng.int(2, 6);
      e2 = e1 + rng.int(1, 6);
    } else if (kind === 1) {
      e1 = rng.int(2, 7);
      e2 = -rng.int(1, 5);
    } else {
      e1 = -rng.int(1, 4);
      e2 = rng.int(2, 5);
    }
  }
  const frac = rng.chance(0.5);
  const lhs = frac ? `\\frac{${pp(v, e1)}}{${pp(v, e2)}}` : `${pp(v, e1)} : ${pp(v, e2)}`;
  const hint =
    e2 < 0
      ? tx("Subtract the exponents. Minus a negative number is plus.", "Subtrahiere die Exponenten. Eine negative Zahl abziehen heißt addieren.")
      : tx("Same base, divided: subtract the exponents (top minus bottom).", "Gleiche Basis, dividiert: Subtrahiere die Exponenten (oben minus unten).");
  return findN(`${lhs} = ${v}^{\\blob{n}}`, e1 - e2, hint, quotientFrames(v, e1, e2, frac), quotientMistakes(e1, e2, frac));
};

const evalWithRules: Shape = (rng) => {
  const b = rng.pick([2, 2, 3, 5, 10]);
  const r = b === 2 ? rng.int(2, 6) : b === 3 ? rng.int(2, 4) : rng.int(2, 3);
  const kind = rng.int(0, 2);
  let e1: number;
  let e2: number;
  let math: string;
  let frames: Frame[];
  if (kind < 2) {
    e2 = rng.int(2, 6);
    e1 = r + e2;
    math = kind === 0 ? `${pp(b, e1)} : ${pp(b, e2)}` : `\\frac{${pp(b, e1)}}{${pp(b, e2)}}`;
    frames = quotientFrames(String(b), e1, e2, kind === 1, false);
  } else {
    if (r < 3) return null;
    e1 = rng.int(1, r - 1);
    e2 = r - e1;
    math = `${pp(b, e1)} \\cdot ${pp(b, e2)}`;
    frames = productFrames(String(b), [e1, e2], false);
  }
  const last = frames[frames.length - 1];
  frames.push({ math: `${resolveText(last.math, "en")} =#eq ${b ** r}#r`, note: `$${pp(b, r)} = ${b ** r}$.` });
  return {
    instruction: CALCULATE,
    math,
    answer: { kind: "number", value: b ** r },
    hint: tx("Use a power rule first. Then calculate the small power that's left.", "Wende zuerst ein Potenzgesetz an. Dann berechne die kleine Potenz, die übrig bleibt."),
    solution: frames,
    mistakes: rulesMistakes(b, e1, e2, kind < 2),
  };
};

const powerOfPower: Shape = (rng) => {
  const v = rng.chance(0.2) ? rng.pick(["2", "3", "10"]) : rng.pick(VARS);
  const e1 = rng.chance(0.25) ? -rng.int(1, 4) : rng.int(2, 5);
  const k = rng.int(2, 4);
  if (Math.abs(e1 * k) > 16) return null;
  const extra = rng.chance(0.45) ? rng.nonZero(-5, 6) : null;
  const total = e1 * k + (extra ?? 0);
  if (total === 0 || total === 1) return null;
  const math = `(${pp(v, e1)})^{${k}}${extra !== null ? ` \\cdot ${pp(v, extra)}` : ""} = ${v}^{\\blob{n}}`;
  return findN(
    math,
    total,
    tx(
      "Power of a power: multiply the exponents. Then add the exponent of the extra factor.",
      "Potenz einer Potenz: Multipliziere die Exponenten. Dann addiere den Exponenten des zusätzlichen Faktors.",
    ),
    powerOfPowerFrames(v, e1, k, extra),
    powerOfPowerMistakes(v, e1, k, extra),
  );
};

const negativeExponent: Shape = (rng) => {
  const kind = rng.int(0, 3);
  if (kind === 0) {
    const b = rng.pick([2, 2, 3, 4, 5, 10]);
    const e = b === 2 ? rng.int(1, 5) : rng.int(1, 3);
    if (e === 1 && rng.chance(0.6)) return null;
    return {
      instruction: AS_FRACTION,
      math: `${b}^{-${e}}`,
      answer: { kind: "fraction", n: 1, d: b ** e },
      hint: "$a^{-n} = \\frac{1}{a^n}$.",
      solution: negativeToFractionFrames(b, e),
      mistakes: negPowerMistakes(b, e),
    };
  }
  if (kind === 1) {
    const e = rng.int(1, 4);
    const value = Number(`1e-${e}`);
    const big = grouped("1" + "0".repeat(e));
    return {
      instruction: AS_DECIMAL,
      math: `10^{-${e}}`,
      answer: { kind: "number", value },
      mistakes: tenPowerMistakes(e),
      hint: tx(`$10^{-${e}} = \\frac{1}{10^{${e}}}$. How many places after the comma?`, `$10^{-${e}} = \\frac{1}{10^{${e}}}$. Wie viele Stellen nach dem Komma?`),
      solution: [
        { math: `10#b^{-#s ${e}#e}`, note: tx("A negative exponent means: one divided by the power.", "Ein negativer Exponent bedeutet: eins geteilt durch die Potenz.") },
        { math: `\\frac{1#one}{${kp(10, "b", e, "e")}}#F`, note: `$10^{-${e}} = \\frac{1}{${pp(10, e)}}$.` },
        {
          math: `\\frac{1#one}{${big}#b}#F =#eq ${dec(value)}#r`,
          note: tx(
            `Divide by $${big}$: the $1$ moves $${e}$ ${e === 1 ? "place" : "places"} behind the comma. So $10^{-${e}} = ${dec(value)}$.`,
            `Teile durch $${big}$: Die $1$ steht dann an der $${e}$. Stelle nach dem Komma. Also ist $10^{-${e}} = ${dec(value)}$.`,
          ),
        },
      ],
    };
  }
  if (kind === 2) {
    const b = rng.int(2, 5);
    const e = b <= 3 ? rng.int(2, 4) : rng.int(2, 3);
    if (b ** e > 125) return null;
    return {
      instruction: CALCULATE,
      math: `(\\frac{1}{${b}})^{-${e}}`,
      answer: { kind: "number", value: b ** e },
      mistakes: flipPowerMistakes(b, e),
      hint: tx("A negative exponent flips the fraction.", "Ein negativer Exponent dreht den Bruch um (Kehrwert)."),
      solution: [
        {
          math: `(\\frac{1#one}{${b}#b}#F)#br^{-#s ${e}#e}`,
          note: tx(
            "A negative exponent means: one divided by the power. That flips the fraction.",
            "Ein negativer Exponent bedeutet: eins geteilt durch die Potenz. Dadurch wird der Bruch umgedreht.",
          ),
        },
        {
          math: `${b}#b^{${e}#e}`,
          note: tx(`$(\\frac{1}{${b}})^{-${e}} = ${b}^{${e}}$, now with a positive exponent.`, `$(\\frac{1}{${b}})^{-${e}} = ${b}^{${e}}$, jetzt mit positivem Exponenten.`),
        },
        { math: `${b ** e}#b`, note: `$${b}^{${e}} = ${b ** e}$.` },
      ],
    };
  }
  const b = rng.int(2, 5);
  const e1 = rng.int(1, 4);
  const r = rng.int(0, 2);
  const e2 = e1 + r;
  return {
    instruction: CALCULATE,
    math: `${b}^{-${e1}} \\cdot ${pp(b, e2)}`,
    answer: { kind: "number", value: b ** r },
    mistakes: negProductMistakes(b, e1, e2),
    hint: tx("Same base: add the exponents first.", "Gleiche Basis: Addiere zuerst die Exponenten."),
    solution: [
      { math: `${kp(b, "b0", -e1, "e0")} \\cdot#d ${kp(b, "b1", e2, "e1")}`, note: tx(`Same base $${b}$, multiplied.`, `Gleiche Basis $${b}$, multipliziert.`) },
      { math: `${b}#b0^{${num(-e1, "e0")} +#p ${e2}#e1}`, note: tx("Add the exponents.", "Addiere die Exponenten.") },
      {
        math: `${kp(b, "b0", r, "e0", true)} =#eq ${b ** r}#r`,
        note: cat(
          `$-${e1} + ${e2} = ${r}$.`,
          r === 0
            ? tx(" Any number (except $0$) to the power $0$ is $1$.", " Jede Zahl (außer $0$) hoch $0$ ist $1$.")
            : r === 1
              ? tx(` And $${b}^1 = ${b}$.`, ` Und $${b}^1 = ${b}$.`)
              : tx(` And $${pp(b, r)} = ${b ** r}$.`, ` Und $${pp(b, r)} = ${b ** r}$.`),
        ),
      },
    ],
  };
};

const sciNotation: Shape = (rng) => {
  const single = rng.chance(0.25);
  const digits = String(single ? rng.int(2, 9) : rng.nonZero(11, 99, [20, 30, 40, 50, 60, 70, 80, 90]));
  const mant = Number(digits) / 10 ** (digits.length - 1);
  const kind = rng.pick(["big", "big", "small", "small", "back"] as const);
  if (kind === "back") {
    const e = -rng.int(1, 5);
    const value = Number(`${mant}e${e}`);
    return {
      instruction: AS_DECIMAL,
      math: `${dec(mant)} \\cdot 10^{${e}}`,
      answer: { kind: "number", value },
      mistakes: sciBackMistakes(digits, mant, e),
      hint: cat(
        tx(`The exponent $${e}$ means: move the comma $${-e}$ `, `Der Exponent $${e}$ bedeutet: Verschiebe das Komma um $${-e}$ `),
        places(-e),
        tx(" to the left.", " nach links."),
      ),
      solution: [
        {
          math: `${dec(mant)}#m \\cdot#d 10#t^{-#es ${-e}#e}`,
          note: cat(
            tx(`$10^{${e}}$ makes the number smaller: move the comma $${-e}$ `, `$10^{${e}}$ macht die Zahl kleiner: Verschiebe das Komma um $${-e}$ `),
            places(-e),
            tx(" to the **left**.", " nach **links**."),
          ),
        },
        {
          math: `${dec(value)}#m`,
          note: tx(
            `Fill the gaps with zeros. So $${dec(mant)} \\cdot 10^{${e}} = ${dec(value)}$.`,
            `Füll die Lücken mit Nullen auf. Also ist $${dec(mant)} \\cdot 10^{${e}} = ${dec(value)}$.`,
          ),
        },
      ],
    };
  }
  const e = kind === "big" ? rng.int(4, 9) : -rng.int(2, 6);
  const raw = kind === "big" ? digits + "0".repeat(e - digits.length + 1) : `0,${"0".repeat(-e - 1)}${digits}`;
  return {
    instruction: tx("Write in scientific notation", "Schreib in wissenschaftlicher Schreibweise"),
    text: tx("Write it as $a \\cdot 10^n$ with $1 \\le a < 10$.", "Schreib die Zahl als $a \\cdot 10^n$ mit $1 \\le a < 10$."),
    math: `${kind === "big" ? grouped(raw) : raw} = \\blob{a} \\cdot 10^{\\blob{n}}`,
    answer: { kind: "pair", names: ["a", "n"], values: [mant, e] },
    mistakes: sciMistakes(digits, e),
    hint:
      kind === "big"
        ? tx("Count how many places the comma moves to the left. That's $n$.", "Zähl, um wie viele Stellen das Komma nach links rutscht. Das ist $n$.")
        : tx("The comma moves to the right, so $n$ is negative.", "Das Komma rutscht nach rechts, also ist $n$ negativ."),
    solution: sciFrames(digits, e),
  };
};

const simpleRoot: Shape = (rng) => {
  const kind = rng.int(0, 4);
  if (kind === 0) {
    const k = rng.int(11, 20);
    const which = tx(`Which number times itself gives $${k * k}$?`, `Welche Zahl mal sich selbst ergibt $${k * k}$?`);
    return {
      instruction: CALCULATE,
      math: `\\sqrt{${k * k}}`,
      answer: { kind: "number", value: k },
      mistakes: collect(asNum(k), (add) => add(asNum((k * k) / 2), T_HALF, half(String(k * k)))),
      hint: which,
      solution: [
        { math: `\\sqrt{${k * k}#n}#R`, note: which },
        { math: `\\sqrt{${k}#a \\cdot#d ${k}#b}#R`, note: `$${k} \\cdot ${k} = ${k * k}$.` },
        { math: `${k}#a`, note: tx(`So $\\sqrt{${k * k}} = ${k}$.`, `Also ist $\\sqrt{${k * k}} = ${k}$.`) },
      ],
    };
  }
  if (kind === 1) {
    const k = rng.nonZero(2, 15, [10]);
    const N = k * k;
    return {
      instruction: CALCULATE,
      math: `\\sqrt{${dec(N / 100)}}`,
      answer: { kind: "number", value: k / 10 },
      mistakes: decimalRootMistakes(k),
      hint: tx(`Write it as a fraction: $${dec(N / 100)} = \\frac{${N}}{100}$.`, `Schreib die Zahl als Bruch: $${dec(N / 100)} = \\frac{${N}}{100}$.`),
      solution: [
        {
          math: `\\sqrt{${dec(N / 100)}#n}#R`,
          note: tx("A root of a decimal number. Write it as a fraction first.", "Die Wurzel aus einer Dezimalzahl. Schreib die Zahl zuerst als Bruch."),
        },
        { math: `\\sqrt{\\frac{${N}#a}{100#b}#F}#R`, note: `$${dec(N / 100)} = \\frac{${N}}{100}$.` },
        { math: `\\frac{\\sqrt{${N}#a}#R}{\\sqrt{100#b}#R2}#F`, note: ROOT_TOP_BOTTOM },
        {
          math: `\\frac{${k}#a}{10#b}#F =#eq ${dec(k / 10)}#r`,
          note: tx(
            `$\\sqrt{${N}} = ${k}$ and $\\sqrt{100} = 10$. So the result is $${dec(k / 10)}$.`,
            `$\\sqrt{${N}} = ${k}$ und $\\sqrt{100} = 10$. Das Ergebnis ist also $${dec(k / 10)}$.`,
          ),
        },
      ],
    };
  }
  if (kind === 2) {
    const b = rng.int(2, 12);
    const a = rng.int(1, b - 1);
    if (gcdInt(a, b) !== 1) return null;
    return {
      instruction: AS_FRACTION,
      math: `\\sqrt{\\frac{${a * a}}{${b * b}}}`,
      answer: { kind: "fraction", n: a, d: b },
      mistakes: fractionRootMistakes(a, b),
      hint: tx("Take the root of the top and of the bottom separately.", "Zieh die Wurzel aus Zähler und Nenner getrennt."),
      solution: [
        { math: `\\sqrt{\\frac{${a * a}#a}{${b * b}#b}#F}#R`, note: tx("The root of a fraction.", "Die Wurzel aus einem Bruch.") },
        { math: `\\frac{\\sqrt{${a * a}#a}#R}{\\sqrt{${b * b}#b}#R2}#F`, note: ROOT_TOP_BOTTOM },
        {
          math: `\\frac{${a}#a}{${b}#b}#F`,
          note: tx(`$\\sqrt{${a * a}} = ${a}$ and $\\sqrt{${b * b}} = ${b}$.`, `$\\sqrt{${a * a}} = ${a}$ und $\\sqrt{${b * b}} = ${b}$.`),
        },
      ],
    };
  }
  if (kind === 3) {
    const r = rng.pick([2, 3, 5, 6, 7, 10]);
    const s1 = rng.int(1, 5);
    const s2 = rng.int(1, 5);
    const a = r * s1 * s1;
    const b = r * s2 * s2;
    if (s1 === s2 || a > 100 || b > 100) return null;
    const value = r * s1 * s2;
    return {
      instruction: CALCULATE,
      math: `\\sqrt{${a}} \\cdot \\sqrt{${b}}`,
      answer: { kind: "number", value },
      mistakes: rootCalcMistakes(a, b, value, false),
      hint: "$\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{a \\cdot b}$.",
      solution: [
        { math: `\\sqrt{${a}#a}#R \\cdot#d \\sqrt{${b}#b}#R2`, note: NO_WHOLE_ROOT },
        { math: `\\sqrt{${a}#a \\cdot#d ${b}#b}#R`, note: ONE_ROOT_RULE },
        { math: `\\sqrt{${a * b}#a}#R`, note: `$${a} \\cdot ${b} = ${a * b}$.` },
        {
          math: `${value}#a`,
          note: tx(`$${value} \\cdot ${value} = ${a * b}$, so the result is $${value}$.`, `$${value} \\cdot ${value} = ${a * b}$, also ist das Ergebnis $${value}$.`),
        },
      ],
    };
  }
  const b = rng.pick([2, 3, 5, 6, 7]);
  const k = rng.int(2, 9);
  const a = b * k * k;
  if (a > 300) return null;
  const frac = rng.chance(0.5);
  return {
    instruction: CALCULATE,
    math: frac ? `\\frac{\\sqrt{${a}}}{\\sqrt{${b}}}` : `\\sqrt{${a}} : \\sqrt{${b}}`,
    answer: { kind: "number", value: k },
    mistakes: rootCalcMistakes(a, b, k, true),
    hint: "$\\sqrt{a} : \\sqrt{b} = \\sqrt{a : b}$.",
    solution: [
      { math: frac ? `\\frac{\\sqrt{${a}#a}#R}{\\sqrt{${b}#b}#R2}#F` : `\\sqrt{${a}#a}#R :#dv \\sqrt{${b}#b}#R2`, note: NO_WHOLE_ROOT },
      {
        math: frac ? `\\sqrt{\\frac{${a}#a}{${b}#b}#F}#R` : `\\sqrt{${a}#a :#dv ${b}#b}#R`,
        note: tx("Put both under one root.", "Schreib beide unter eine Wurzel."),
      },
      { math: `\\sqrt{${k * k}#a}#R`, note: `$${a} : ${b} = ${k * k}$.` },
      { math: `${k}#a`, note: `$\\sqrt{${k * k}} = ${k}$.` },
    ],
  };
};

const coefficientProduct: Shape = (rng) => {
  const v = rng.pick(VARS);
  if (rng.chance(0.6)) {
    const c1 = rng.nonZero(-9, 9, [1, -1]);
    const c2 = rng.int(2, 9) * (rng.chance(0.25) ? -1 : 1);
    const e1 = rng.int(1, 7);
    const e2 = rng.chance(0.3) ? -rng.int(1, 4) : rng.int(1, 7);
    const n = e1 + e2;
    const c = c1 * c2;
    if (n === 0 || n === 1 || Math.abs(c) > 72) return null;
    const second = c2 < 0 ? `(${c2}${pp(v, e2)})` : `${c2}${pp(v, e2)}`;
    const f2 = (showOne: boolean) => kp(v, "b2", e2, "e2", showOne);
    return {
      instruction: SIMPLIFY,
      math: `${c1}${pp(v, e1)} \\cdot ${second} = \\blob{c} ${v}^{\\blob{n}}`,
      answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
      mistakes: coefProductMistakes(v, c1, c2, e1, e2),
      hint: tx("Multiply the numbers. Add the exponents.", "Multipliziere die Zahlen. Addiere die Exponenten."),
      solution: [
        {
          math: `${num(c1, "c1")} ${kp(v, "b1", e1, "e1")} \\cdot#dot ${c2 < 0 ? `(${num(c2, "c2")} ${f2(false)})#g` : `${c2}#c2 ${f2(false)}`}`,
          note: tx("Numbers and powers, all multiplied.", "Zahlen und Potenzen, alles multipliziert."),
        },
        {
          math: `${num(c1, "c1")} \\cdot#dc ${inner(c2, "c2")} \\cdot#dot ${kp(v, "b1", e1, "e1", true)} \\cdot#dv ${f2(true)}`,
          note: tx("Sort them: numbers together, powers together.", "Sortiere: Zahlen zusammen, Potenzen zusammen."),
        },
        {
          math: `${num(c, "c1")} ${v}#b1^{${num(e1, "e1")} +#p ${inner(e2, "e2")}}`,
          note: tx(
            `Multiply the numbers: $${c1} \\cdot ${par(c2)} = ${c}$. Add the exponents.`,
            `Multipliziere die Zahlen: $${c1} \\cdot ${par(c2)} = ${c}$. Addiere die Exponenten.`,
          ),
        },
        { math: `${num(c, "c1")} ${kp(v, "b1", n, "e1", true)}`, note: cat(`$${e1} + ${par(e2)} = ${n}$.`, soBoth("c", c, "n", n)) },
      ],
    };
  }
  const c = rng.nonZero(-9, 9, [1, -1]);
  const d = rng.int(2, 6);
  const top = c * d;
  const e1 = rng.int(3, 9);
  const e2 = rng.int(1, e1 + 3);
  const n = e1 - e2;
  if (n === 0 || n === 1 || Math.abs(top) > 60) return null;
  return {
    instruction: SIMPLIFY,
    math: `\\frac{${top}${pp(v, e1)}}{${d}${pp(v, e2)}} = \\blob{c} ${v}^{\\blob{n}}`,
    answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
    mistakes: coefQuotientMistakes(top, d, e1, e2),
    hint: tx("Divide the numbers. Subtract the exponents.", "Teile die Zahlen. Subtrahiere die Exponenten."),
    solution: [
      {
        math: `\\frac{${num(top, "c1")} ${kp(v, "b1", e1, "e1")}}{${d}#c2 ${kp(v, "b2", e2, "e2")}}#F`,
        note: tx("A fraction with numbers and powers.", "Ein Bruch mit Zahlen und Potenzen."),
      },
      {
        math: `\\frac{${num(top, "c1")}}{${d}#c2}#F \\cdot#dot \\frac{${kp(v, "b1", e1, "e1", true)}}{${kp(v, "b2", e2, "e2", true)}}#G`,
        note: tx("Split it: numbers on their own, powers on their own.", "Teile ihn auf: Zahlen für sich, Potenzen für sich."),
      },
      { math: `${num(c, "c1")} ${v}#b1^{${num(e1, "e1")} -#mi ${inner(e2, "e2")}}`, note: cat(`$${top} : ${d} = ${c}$. `, DIVIDE_POWERS) },
      { math: `${num(c, "c1")} ${kp(v, "b1", n, "e1", true)}`, note: cat(`$${e1} - ${e2} = ${n}$.`, soBoth("c", c, "n", n)) },
    ],
  };
};

const mixedTwoVars: Shape = (rng) => {
  const [u, w] = rng.pick(LETTER_PAIRS);
  if (rng.chance(0.55)) {
    const k = rng.int(2, 3);
    const p1 = rng.nonZero(-3, 4);
    const q1 = rng.nonZero(-3, 4);
    const p2 = rng.nonZero(-5, 5);
    const q2 = rng.nonZero(-5, 5);
    const m = p1 * k + p2;
    const n = q1 * k + q2;
    if ((p1 < 0 && q1 < 0) || !m || !n || Math.abs(m) > 15 || Math.abs(n) > 15) return null;
    return {
      instruction: SIMPLIFY,
      math: `(${pp(u, p1)} ${pp(w, q1)})^{${k}} \\cdot ${pp(u, p2)} ${pp(w, q2)} = ${u}^{\\blob{m}} ${w}^{\\blob{n}}`,
      answer: { kind: "pair", names: ["m", "n"], values: [m, n] },
      mistakes: twoVarBracketMistakes(u, w, k, p1, q1, p2, q2),
      hint: tx(
        "Bracket first: multiply each exponent inside by the outer one. Then add exponents of the same letter.",
        "Zuerst die Klammer: Multipliziere jeden Exponenten darin mit dem äußeren. Dann addiere die Exponenten gleicher Buchstaben.",
      ),
      solution: [
        {
          math: `(${kp(u, "u1", p1, "pu")} ${kp(w, "w1", q1, "pw")})#br^{${k}#k} \\cdot#dot ${kp(u, "u2", p2, "ru")} ${kp(w, "w2", q2, "rw")}`,
          note: tx("Start with the bracket.", "Fang mit der Klammer an."),
        },
        {
          math: `${u}#u1^{${inner(p1, "pu")} \\cdot#ku ${k}#k} ${w}#w1^{${inner(q1, "pw")} \\cdot#kw ${k}#k2} \\cdot#dot ${kp(u, "u2", p2, "ru", true)} ${kp(w, "w2", q2, "rw", true)}`,
          note: tx(
            `The outer exponent $${k}$ multiplies **every** exponent inside.`,
            `Der äußere Exponent $${k}$ wird mit **jedem** Exponenten in der Klammer multipliziert.`,
          ),
        },
        {
          math: `${kp(u, "u1", p1 * k, "pu", true)} ${kp(w, "w1", q1 * k, "pw", true)} \\cdot#dot ${kp(u, "u2", p2, "ru", true)} ${kp(w, "w2", q2, "rw", true)}`,
          note: tx(
            `$${par(p1)} \\cdot ${k} = ${p1 * k}$ and $${par(q1)} \\cdot ${k} = ${q1 * k}$.`,
            `$${par(p1)} \\cdot ${k} = ${p1 * k}$ und $${par(q1)} \\cdot ${k} = ${q1 * k}$.`,
          ),
        },
        {
          math: `${u}#u1^{${num(p1 * k, "pu")} +#su ${inner(p2, "ru")}} ${w}#w1^{${num(q1 * k, "pw")} +#sw ${inner(q2, "rw")}}`,
          note: tx(
            `Same letter, multiplied: add the exponents. $${u}$ with $${u}$, $${w}$ with $${w}$.`,
            `Gleicher Buchstabe, multipliziert: Addiere die Exponenten. $${u}$ mit $${u}$, $${w}$ mit $${w}$.`,
          ),
        },
        { math: `${kp(u, "u1", m, "pu", true)} ${kp(w, "w1", n, "pw", true)}`, note: tx(`So $m = ${m}$ and $n = ${n}$.`, `Also ist $m = ${m}$ und $n = ${n}$.`) },
      ],
    };
  }
  const p1 = rng.int(1, 9);
  const q1 = rng.int(1, 9);
  const p2 = rng.int(1, 9);
  const q2 = rng.int(1, 9);
  const m = p1 - p2;
  const n = q1 - q2;
  if (!m || !n || (m > 0 && n > 0 && rng.chance(0.6))) return null;
  const neg = m < 0 ? pp(u, m) : n < 0 ? pp(w, n) : null;
  const negPlain = m < 0 ? pp(u, -m) : pp(w, -n);
  return {
    instruction: SIMPLIFY,
    math: `\\frac{${pp(u, p1)} ${pp(w, q1)}}{${pp(u, p2)} ${pp(w, q2)}} = ${u}^{\\blob{m}} ${w}^{\\blob{n}}`,
    answer: { kind: "pair", names: ["m", "n"], values: [m, n] },
    mistakes: twoVarQuotientMistakes(p1, q1, p2, q2),
    hint: tx("Each letter on its own: exponent on top minus exponent below.", "Jeder Buchstabe für sich: Exponent oben minus Exponent unten."),
    solution: [
      {
        math: `\\frac{${kp(u, "u1", p1, "pu")} ${kp(w, "w1", q1, "pw")}}{${kp(u, "u2", p2, "ru")} ${kp(w, "w2", q2, "rw")}}#F`,
        note: tx("Two letters. Treat each one on its own.", "Zwei Buchstaben. Behandle jeden für sich."),
      },
      {
        math: `${u}#u1^{${num(p1, "pu")} -#su ${inner(p2, "ru")}} ${w}#w1^{${num(q1, "pw")} -#sw ${inner(q2, "rw")}}`,
        note: tx(
          "Divide powers with the same base: subtract the exponents (top minus bottom).",
          "Potenzen mit gleicher Basis dividieren: Subtrahiere die Exponenten (oben minus unten).",
        ),
      },
      {
        math: `${kp(u, "u1", m, "pu", true)} ${kp(w, "w1", n, "pw", true)}`,
        note: cat(
          tx(`So $m = ${m}$ and $n = ${n}$.`, `Also ist $m = ${m}$ und $n = ${n}$.`),
          neg ? tx(` A negative exponent is fine: $${neg} = \\frac{1}{${negPlain}}$.`, ` Ein negativer Exponent ist okay: $${neg} = \\frac{1}{${negPlain}}$.`) : "",
        ),
      },
    ],
  };
};

const mixedCoefficient: Shape = (rng) => {
  const v = rng.pick(VARS);
  const k = rng.pick([2, 2, 3, -2, -1]);
  const j = k === 3 ? 2 : rng.int(2, 3);
  const e1 = rng.chance(0.2) ? -rng.int(1, 2) : rng.int(1, 4);
  const K = k ** j;
  const head = `${coef(k)}${pp(v, e1)}`;
  if (rng.chance(0.6)) {
    const d = rng.pick([1, 2, 3, 4, 5, -2, -3]);
    const e2 = rng.nonZero(-6, 5);
    const c = K * d;
    const n = e1 * j + e2;
    if (Math.abs(c) < 2 || Math.abs(c) > 100 || n === 0 || n === 1) return null;
    const second = d === 1 ? pp(v, e2) : d < 0 ? `(${d}${pp(v, e2)})` : `${d}${pp(v, e2)}`;
    const split = `$(${head})^{${j}} = ${par(k)}^{${j}} \\cdot (${pp(v, e1)})^{${j}}$.`;
    return {
      instruction: SIMPLIFY,
      math: `(${head})^{${j}} \\cdot ${second} = \\blob{c} ${v}^{\\blob{n}}`,
      answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
      mistakes: bracketMistakes(v, k, e1, j, d, e2, false),
      hint: tx(`Bracket first: ${split}`, `Zuerst die Klammer: ${split}`),
      solution: bracketPowerFrames(v, k, e1, j, { d, e2 }),
    };
  }
  if (K < 0 || Math.abs(K) < 4) return null;
  const divisors = [2, 3, 4, 9].filter((d) => d < Math.abs(K) && K % d === 0);
  if (!divisors.length) return null;
  const d = rng.pick(divisors);
  const c = K / d;
  const e2 = rng.int(1, 9);
  const n = e1 * j - e2;
  if (n === 0 || n === 1) return null;
  return {
    instruction: SIMPLIFY,
    math: `\\frac{(${head})^{${j}}}{${d}${pp(v, e2)}} = \\blob{c} ${v}^{\\blob{n}}`,
    answer: { kind: "pair", names: ["c", "n"], values: [c, n] },
    mistakes: bracketMistakes(v, k, e1, j, d, e2, true),
    hint: tx(
      "Work out the bracket on top first. Then divide the numbers and subtract the exponents.",
      "Berechne zuerst die Klammer oben. Dann teile die Zahlen und subtrahiere die Exponenten.",
    ),
    solution: [
      {
        math: `\\frac{(${coef(k) === "-" ? "-#c1s " : `${num(k, "c1")} `}${kp(v, "b1", e1, "e1")})#br^{${j}#j}}{${d}#c2 ${kp(v, "b2", e2, "e2")}}#F`,
        note: tx("Start with the bracket on top.", "Fang mit der Klammer oben an."),
      },
      {
        math: `\\frac{${num(K, "c1")} ${kp(v, "b1", e1 * j, "e1", true)}}{${d}#c2 ${kp(v, "b2", e2, "e2")}}#F`,
        note: tx(
          `The exponent goes to both factors: $${par(k)}^{${j}} = ${K}$ and $(${pp(v, e1)})^{${j}} = ${pp(v, e1 * j)}$.`,
          `Der Exponent gilt für beide Faktoren: $${par(k)}^{${j}} = ${K}$ und $(${pp(v, e1)})^{${j}} = ${pp(v, e1 * j)}$.`,
        ),
      },
      { math: `${num(c, "c1")} ${v}#b1^{${num(e1 * j, "e1")} -#mi ${inner(e2, "e2")}}`, note: cat(`$${K} : ${d} = ${c}$. `, DIVIDE_POWERS) },
      { math: `${num(c, "c1")} ${kp(v, "b1", n, "e1", true)}`, note: cat(`$${e1 * j} - ${e2} = ${n}$.`, soBoth("c", c, "n", n)) },
    ],
  };
};

const partialRoot: Shape = (rng) => {
  const kind = rng.pick(["plain", "plain", "prefix", "sum", "product"] as const);
  const unknown = "\\blob{a} \\sqrt{\\blob{b}}";
  const pair = (a: number, b: number) => ({ kind: "pair" as const, names: ["a", "b"] as [string, string], values: [a, b] as [number, number] });
  if (kind === "plain") {
    const s = rng.int(2, 10);
    const r = rng.pick(SQUAREFREE);
    const N = s * s * r;
    if (N > 300) return null;
    return {
      instruction: SIMPLIFY_ROOT,
      math: `\\sqrt{${N}} = ${unknown}`,
      answer: pair(s, r),
      mistakes: rootMistakes(N),
      hint: tx(
        `Look for the biggest square number that divides $${N}$ (like $4, 9, 16, 25, 36, …$).`,
        `Suche die größte Quadratzahl, durch die sich $${N}$ teilen lässt (zum Beispiel $4; 9; 16; 25; 36; …$).`,
      ),
      solution: partialRootFrames(N),
    };
  }
  if (kind === "prefix") {
    const t = rng.int(2, 5);
    const s = rng.int(2, 5);
    const r = rng.pick([2, 3, 5, 6, 7]);
    const N = s * s * r;
    if (N > 150) return null;
    return {
      instruction: SIMPLIFY_ROOT,
      math: `${t}\\sqrt{${N}} = ${unknown}`,
      answer: pair(t * s, r),
      mistakes: rootMistakes(N, t),
      hint: tx(`First simplify $\\sqrt{${N}}$. Then multiply by $${t}$.`, `Vereinfache zuerst $\\sqrt{${N}}$. Dann multipliziere mit $${t}$.`),
      solution: partialRootFrames(N, t),
    };
  }
  if (kind === "sum") {
    const r = rng.pick([2, 3, 5, 6, 7]);
    const s1 = rng.int(1, 6);
    const s2 = rng.int(1, 6);
    const minus = rng.chance(0.4);
    const a = minus ? s1 - s2 : s1 + s2;
    const N1 = s1 * s1 * r;
    const N2 = s2 * s2 * r;
    if (s1 === s2 || a < 2 || N1 > 200 || N2 > 200 || (s1 === 1 && s2 === 1)) return null;
    const op = minus ? "-" : "+";
    const rootSrc = (s: number, i: number) => (s === 1 ? `\\sqrt{${r}#r${i}}#R${i}` : `\\sqrt{${s * s}#s${i} \\cdot#d${i} ${r}#r${i}}#R${i}`);
    const outSrc = (s: number, i: number) => `${s === 1 ? "" : `${s}#s${i} `}\\sqrt{${r}#r${i}}#R${i}`;
    const outPlain = (s: number) => `${s === 1 ? "" : s}\\sqrt{${r}}`;
    const squares = [
      [N1, s1],
      [N2, s2],
    ]
      .filter(([, s]) => s > 1)
      .map(([N, s]) => `$${N} = ${s * s} \\cdot ${r}$`);
    return {
      instruction: SIMPLIFY,
      math: `\\sqrt{${N1}} ${op} \\sqrt{${N2}} = ${unknown}`,
      answer: pair(a, r),
      mistakes: rootSumMistakes(r, s1, s2, minus),
      hint: tx(
        "Simplify each root first. Then they have the same root and can be combined.",
        "Vereinfache zuerst jede Wurzel. Dann haben beide dieselbe Wurzel und lassen sich zusammenfassen.",
      ),
      solution: [
        {
          math: `\\sqrt{${N1}#s1}#R1 ${op}#op \\sqrt{${N2}#s2}#R2`,
          note: tx(
            "You can't add the numbers under the roots. Simplify each root first.",
            "Die Zahlen unter den Wurzeln darfst du nicht addieren. Vereinfache zuerst jede Wurzel.",
          ),
        },
        {
          math: `${rootSrc(s1, 1)} ${op}#op ${rootSrc(s2, 2)}`,
          note: tx(`Square factors: ${squares.join(" and ")}.`, `Die Quadratzahlen darin: ${squares.join(" und ")}.`),
        },
        {
          math: `${outSrc(s1, 1)} ${op}#op ${outSrc(s2, 2)}`,
          note: tx(`Take them out: $${outPlain(s1)} ${op} ${outPlain(s2)}$.`, `Zieh sie vor die Wurzel: $${outPlain(s1)} ${op} ${outPlain(s2)}$.`),
        },
        {
          math: `${a}#s1 \\sqrt{${r}#r1}#R1`,
          note: cat(
            tx(
              `Both have $\\sqrt{${r}}$, so combine them like $x$-terms: $${s1} ${op} ${s2} = ${a}$.`,
              `Beide haben $\\sqrt{${r}}$, also fasst du sie wie $x$-Terme zusammen: $${s1} ${op} ${s2} = ${a}$.`,
            ),
            soBoth("a", a, "b", r),
          ),
        },
      ],
    };
  }
  const r = rng.pick([2, 3, 5, 6]);
  const s = rng.int(2, 6);
  const N = s * s * r;
  if (N > 200) return null;
  const options: [number, number][] = [];
  for (let a = 2; a * a < N; a++) {
    if (N % a !== 0) continue;
    const b = N / a;
    if (largestSquareRoot(a) ** 2 === a || largestSquareRoot(b) ** 2 === b) continue;
    options.push([a, b]);
  }
  if (!options.length) return null;
  const [a, b] = rng.pick(options);
  return {
    instruction: SIMPLIFY,
    math: `\\sqrt{${a}} \\cdot \\sqrt{${b}} = ${unknown}`,
    answer: pair(s, r),
    mistakes: rootPairMistakes(a, b),
    hint: tx(
      "Put both under one root first. Then look for the biggest square factor.",
      "Schreib zuerst beide unter eine Wurzel. Dann such die größte Quadratzahl darin.",
    ),
    solution: [
      { math: `\\sqrt{${a}#x}#R \\cdot#d \\sqrt{${b}#y}#R2`, note: tx("Two roots, multiplied.", "Zwei Wurzeln, multipliziert.") },
      { math: `\\sqrt{${a}#x \\cdot#d ${b}#y}#R`, note: ONE_ROOT_RULE },
      { math: `\\sqrt{${N}#x}#R`, note: `$${a} \\cdot ${b} = ${N}$.` },
      {
        math: `\\sqrt{${s * s}#x \\cdot#d2 ${r}#r}#R`,
        note: tx(`The biggest square factor: $${N} = ${s * s} \\cdot ${r}$.`, `Die größte Quadratzahl darin: $${N} = ${s * s} \\cdot ${r}$.`),
        highlight: ["x"],
      },
      {
        math: `${s}#x \\sqrt{${r}#r}#R`,
        note: cat(tx(`$\\sqrt{${s * s}} = ${s}$ comes out.`, `$\\sqrt{${s * s}} = ${s}$ kommt vor die Wurzel.`), soBoth("a", s, "b", r)),
      },
    ],
  };
};

const SCI_DIV: [number, number][] = [
  [8, 2],
  [9, 3],
  [6, 2],
  [6, 3],
  [8, 4],
  [9, 2],
  [7, 2],
  [3, 6],
  [2, 8],
  [4, 8],
  [1, 2],
  [3, 4],
  [1, 4],
  [5, 2],
];

const sciCalc: Shape = (rng) => {
  const div = rng.chance(0.4);
  const [a1, a2] = div ? rng.pick(SCI_DIV) : [rng.int(2, 9), rng.int(2, 9)];
  const e1 = rng.nonZero(-8, 9);
  const e2 = rng.nonZero(-8, 9);
  const P = div ? a1 / a2 : a1 * a2;
  const E = div ? e1 - e2 : e1 + e2;
  const mant = P >= 10 ? P / 10 : P < 1 ? P * 10 : P;
  const n = P >= 10 ? E + 1 : P < 1 ? E - 1 : E;
  if (n === 0 || Math.abs(n) > 15 || Math.abs(E) > 15) return null;
  const t = (a: number, e: number) => `(${a} \\cdot 10^{${e}})`;
  return {
    instruction: CALCULATE,
    text: tx("Give the result as $a \\cdot 10^n$ with $1 \\le a < 10$.", "Gib das Ergebnis als $a \\cdot 10^n$ mit $1 \\le a < 10$ an."),
    math: `${t(a1, e1)} ${div ? ":" : "\\cdot"} ${t(a2, e2)} = \\blob{a} \\cdot 10^{\\blob{n}}`,
    answer: { kind: "pair", names: ["a", "n"], values: [mant, n] },
    mistakes: sciCalcMistakes(a1, e1, a2, e2, div),
    hint: tx(
      `${div ? "Divide" : "Multiply"} the numbers and the powers of ten separately. Check that $a$ is between $1$ and $10$.`,
      `${div ? "Teile" : "Multipliziere"} die Zahlen und die Zehnerpotenzen getrennt. Prüf, ob $a$ zwischen $1$ und $10$ liegt.`,
    ),
    solution: sciCalcFrames(a1, e1, a2, e2, div),
  };
};

const negativeFraction: Shape = (rng) => {
  if (rng.chance(0.6)) {
    const a = rng.int(2, 5);
    const b = rng.int(2, 5);
    const e = rng.int(2, 3);
    if (a === b || gcdInt(a, b) !== 1 || Math.max(a, b) ** e > 125) return null;
    return {
      instruction: AS_FRACTION,
      math: `(\\frac{${a}}{${b}})^{-${e}}`,
      answer: { kind: "fraction", n: b ** e, d: a ** e },
      mistakes: negFractionMistakes(a, b, e),
      hint: tx(
        "A negative exponent flips the fraction. Then the exponent is positive.",
        "Ein negativer Exponent dreht den Bruch um (Kehrwert). Dann ist der Exponent positiv.",
      ),
      solution: [
        { math: `(\\frac{${a}#a}{${b}#b}#F)#br^{-#s ${e}#e}`, note: tx("A negative exponent means: one divided by the power.", "Ein negativer Exponent bedeutet: eins geteilt durch die Potenz.") },
        {
          math: `(\\frac{${b}#b}{${a}#a}#F)#br^{${e}#e}`,
          note: tx("That flips the fraction, and the exponent becomes positive.", "Dadurch wird der Bruch umgedreht, und der Exponent wird positiv."),
        },
        { math: `\\frac{${b}#b^{${e}#e}}{${a}#a^{${e}#e2}}#F`, note: tx("The exponent goes to the top and to the bottom.", "Der Exponent gilt für Zähler und Nenner.") },
        {
          math: `\\frac{${b ** e}#b}{${a ** e}#a}#F`,
          note: tx(`$${b}^{${e}} = ${b ** e}$ and $${a}^{${e}} = ${a ** e}$.`, `$${b}^{${e}} = ${b ** e}$ und $${a}^{${e}} = ${a ** e}$.`),
        },
      ],
    };
  }
  const b = rng.int(2, 5);
  const e1 = rng.int(1, 5);
  const r = rng.int(1, 3);
  const e2 = e1 + r;
  if (b ** r > 125) return null;
  const frames = quotientFrames(String(b), -e1, -e2, true, false);
  const last = frames[frames.length - 1];
  frames.push({ math: `${resolveText(last.math, "en")} =#eq ${b ** r}#r`, note: `$${pp(b, r)} = ${b ** r}$.` });
  return {
    instruction: CALCULATE,
    math: `\\frac{${b}^{-${e1}}}{${b}^{-${e2}}}`,
    answer: { kind: "number", value: b ** r },
    mistakes: negQuotientMistakes(b, e1, e2),
    hint: tx(
      "Same base: subtract the exponents. Minus a negative number is plus.",
      "Gleiche Basis: Subtrahiere die Exponenten. Eine negative Zahl abziehen heißt addieren.",
    ),
    solution: frames,
  };
};

const SHAPES: Record<Level, [Shape, number][]> = {
  1: [
    [evalPower, 3],
    [productExponent, 3],
    [quotientExponent, 2],
    [evalWithRules, 2],
  ],
  2: [
    [powerOfPower, 2],
    [negativeExponent, 2],
    [quotientExponent, 1],
    [productExponent, 1],
    [sciNotation, 2],
    [simpleRoot, 2],
    [coefficientProduct, 2],
    [evalPower, 1],
  ],
  3: [
    [mixedTwoVars, 2],
    [mixedCoefficient, 2],
    [partialRoot, 3],
    [sciCalc, 2],
    [negativeFraction, 1],
  ],
};

function generate(level: Level, rng: Rng): Exercise {
  const shapes = SHAPES[level];
  const total = shapes.reduce((s, [, w]) => s + w, 0);
  for (let tries = 0; tries < 60; tries++) {
    let pick = rng.next() * total;
    const shape = shapes.find(([, w]) => (pick -= w) < 0)?.[0] ?? shapes[0][0];
    const ex = shape(rng, level);
    if (ex) return ex;
  }
  return productExponent(rng, 1) ?? findN("x^2 \\cdot x^3 = x^{\\blob{n}}", 5, SAME_BASE_ADD, productFrames("x", [2, 3]));
}

// ---------------------------------------------------------------------------
// Interactive 1: the power lab. Every factor is a tile; the rules are just
// counting tiles.

type Rule = "mul" | "div" | "pow";

const RULES: { id: Rule; label: string }[] = [
  { id: "mul", label: "a^m \\cdot a^n" },
  { id: "div", label: "a^m : a^n" },
  { id: "pow", label: "(a^m)^n" },
];

const MAX: Record<Rule, { m: number; n: number }> = { mul: { m: 6, n: 6 }, div: { m: 6, n: 6 }, pow: { m: 4, n: 3 } };

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

type Piece = { key: string; kind: "tile"; tone: number } | { key: string; kind: "open" | "close" | "dot" };

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const de = useLocale() === "de";
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 font-math text-[18px] italic text-ink-2">{label} =</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={de ? `${label} verringern` : `Decrease ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-7 text-center font-math text-[20px] tabular-nums">
        {value}
      </motion.span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={de ? `${label} erhöhen` : `Increase ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function tileClass(tone: number) {
  return cn(
    "grid size-10 place-items-center rounded-[11px] font-math text-[22px] italic select-none",
    tone % 2 === 0 ? "bg-blob text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]" : "bg-blob-soft text-blob-ink ring-1 ring-inset ring-blob/35",
  );
}

function rowPieces(rule: Rule, m: number, n: number, joined: boolean): Piece[] {
  const sizes = rule === "mul" ? [m, n] : Array.from({ length: n }, () => m);
  const out: Piece[] = [];
  let i = 0;
  sizes.forEach((size, g) => {
    if (!joined && g > 0) out.push({ key: `dot${g}`, kind: "dot" });
    if (!joined) out.push({ key: `open${g}`, kind: "open" });
    for (let j = 0; j < size; j++, i++) out.push({ key: `t${i}`, kind: "tile", tone: g });
    if (!joined) out.push({ key: `close${g}`, kind: "close" });
  });
  return out;
}

const factors = (k: number) => tx(k === 1 ? "1 factor" : `${k} factors`, k === 1 ? "1 Faktor" : `${k} Faktoren`);
const pairs = (k: number) => tx(k === 1 ? "1 pair" : `${k} pairs`, k === 1 ? "1 Paar" : `${k} Paare`);

/** The power lab caption, in both languages. */
function labCaption(rule: Rule, m: number, n: number, joined: boolean): Text {
  const result = rule === "mul" ? m + n : rule === "div" ? m - n : m * n;
  const cancel = Math.min(m, n);
  return txMap((t, locale) => {
    const f = (k: number) => resolveText(factors(k), locale);
    const p = (k: number) => resolveText(pairs(k), locale);
    const press = t("Press Combine.", "Drück auf Zusammenfassen.");
    // German verbs agree with the count: "1 Paar kürzt sich", "2 Paare kürzen sich".
    const cancelled = (k: number) => t(`${p(k)} cancel`, k === 1 ? "1 Paar kürzt sich weg" : `${p(k)} kürzen sich weg`);
    const left = (k: number) => (k === 1 ? "bleibt" : "bleiben");
    if (!joined) {
      if (rule === "mul") return `${f(m)} ${t("times", "mal")} ${f(n)}. ${press}`;
      if (rule === "div") return t(`${f(m)} on top, ${f(n)} below. ${press}`, `${f(m)} oben, ${f(n)} unten. ${press}`);
      return t(
        `${n === 1 ? "1 bracket" : `${n} brackets`}, each with ${f(m)}. ${press}`,
        `${n === 1 ? "1 Klammer" : `${n} Klammern`}, jede mit ${f(m)}. ${press}`,
      );
    }
    if (rule === "mul") return `${m} + ${n} = ${f(result)}: ${t("add the exponents.", "Addiere die Exponenten.")}`;
    if (rule === "pow") return `${n} × ${m} = ${f(result)}: ${t("multiply the exponents.", "Multipliziere die Exponenten.")}`;
    if (result > 0)
      return t(
        `${cancelled(cancel)}, ${f(result)} left on top: subtract the exponents.`,
        `${cancelled(cancel)}, ${f(result)} ${left(result)} oben übrig: Subtrahiere die Exponenten.`,
      );
    if (result === 0) return t("Everything cancels, so 1 is left. That's why a⁰ = 1.", "Alles kürzt sich weg, also bleibt 1 übrig. Deshalb ist a⁰ = 1.");
    return t(
      `${cancelled(cancel)}, ${f(-result)} left below. That's what the negative exponent means.`,
      `${cancelled(cancel)}, ${f(-result)} ${left(-result)} unten übrig. Genau das bedeutet der negative Exponent.`,
    );
  });
}

function PowerLab() {
  const scope = useId();
  const t = useText();
  const [rule, setRule] = useState<Rule>("mul");
  const [m, setM] = useState(3);
  const [n, setN] = useState(2);
  const [joined, setJoined] = useState(false);

  function pickRule(r: Rule) {
    setRule(r);
    setM((x) => Math.min(x, MAX[r].m));
    setN((x) => Math.min(x, MAX[r].n));
  }

  const result = rule === "mul" ? m + n : rule === "div" ? m - n : m * n;
  const cancel = Math.min(m, n);

  let formula: string;
  if (rule === "mul") {
    formula = `a#A^{${m}#M} \\cdot#d a#B^{${n}#N}`;
    if (joined) formula += ` =#e1 a#C^{${m}#M2 +#op ${n}#N2} =#e2 a#D^{${result}#R}`;
  } else if (rule === "div") {
    formula = `a#A^{${m}#M} :#d a#B^{${n}#N}`;
    if (joined) {
      formula += ` =#e1 a#C^{${m}#M2 -#op ${n}#N2} =#e2 a#D^{${num(result, "R")}}`;
      if (result === 0) formula += " =#e3 1#one";
      if (result < 0) formula += ` =#e3 \\frac{1#one}{${kp("a", "E", -result, "R2")}}#F`;
    }
  } else {
    formula = `(a#A^{${m}#M})#br^{${n}#N}`;
    if (joined) formula += ` =#e1 a#C^{${m}#M2 \\cdot#op ${n}#N2} =#e2 a#D^{${result}#R}`;
  }

  const caption = t(labCaption(rule, m, n, joined));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex rounded-lg border border-line p-0.5">
          {RULES.map((r) => (
            <button
              key={r.id}
              onClick={() => pickRule(r.id)}
              className={cn("relative rounded-md px-3 py-1.5", rule === r.id ? "text-ink" : "text-ink-3 hover:text-ink")}
              aria-pressed={rule === r.id}
            >
              {rule === r.id && <motion.span layoutId={`${scope}-rule`} className="absolute inset-0 rounded-md bg-hover" transition={spring} />}
              <MathView src={r.label} size="sm" animate={false} className="relative" />
            </button>
          ))}
        </div>
        <Stepper label="m" value={m} min={1} max={MAX[rule].m} onChange={setM} />
        <Stepper label="n" value={n} min={1} max={MAX[rule].n} onChange={setN} />
      </div>

      <div className="relative grid min-h-[190px] place-items-center overflow-hidden rounded-xl border border-line bg-surface px-4 py-6">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
        {rule === "div" ? (
          <div
            className="relative grid gap-x-1.5 gap-y-2"
            style={{ gridTemplateColumns: `repeat(${Math.max(m, n)}, 2.5rem)` }}
          >
            <AnimatePresence initial={false}>
              {Array.from({ length: m }, (_, i) => (
                <DivTile key={`t${i}`} col={i} row={1} tone={0} gone={joined && i < cancel} delay={i * 0.12} />
              ))}
              {Array.from({ length: n }, (_, i) => (
                <DivTile key={`b${i}`} col={i} row={3} tone={1} gone={joined && i < cancel} delay={i * 0.12 + 0.06} />
              ))}
            </AnimatePresence>
            <motion.div layout transition={spring} className="h-[3px] rounded-full bg-ink-2" style={{ gridColumn: "1 / -1", gridRow: 2 }} />
          </div>
        ) : (
          <div className="relative flex max-w-full flex-wrap items-center justify-center gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {rowPieces(rule, m, n, joined).map((pc) =>
                pc.kind === "tile" ? (
                  <motion.span
                    key={pc.key}
                    layout
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={spring}
                    className={tileClass(pc.tone)}
                  >
                    a
                  </motion.span>
                ) : (
                  <motion.span
                    key={pc.key}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                    className={cn("font-math leading-none text-ink-3", pc.kind === "dot" ? "px-1 text-[26px]" : "text-[40px] font-light")}
                  >
                    {pc.kind === "open" ? "(" : pc.kind === "close" ? ")" : "·"}
                  </motion.span>
                ),
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          onClick={() => setJoined((j) => !j)}
          className={cn(
            "flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors active:scale-[0.97]",
            joined ? "border border-line text-ink-2 hover:bg-hover hover:text-ink" : "bg-blob text-white hover:bg-blob-deep",
          )}
        >
          {joined ? <Split className="size-4" /> : <Combine className="size-4" />}
          {joined ? t(tx("Write out again", "Wieder ausschreiben")) : t(tx("Combine", "Zusammenfassen"))}
        </button>
        <MathView src={formula} size="md" scope={`${scope}-f`} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={caption} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] text-ink-2">
          {caption}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function DivTile({ col, row, tone, gone, delay }: { col: number; row: number; tone: number; gone: boolean; delay: number }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: gone ? 0.25 : 1, scale: gone ? 0.86 : 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ ...spring, delay: gone ? delay : 0 }}
      className={cn(tileClass(tone), "relative")}
      style={{ gridColumn: col + 1, gridRow: row }}
    >
      a
      <motion.span
        initial={false}
        animate={{ scaleX: gone ? 1 : 0 }}
        transition={{ duration: 0.25, delay: gone ? delay + 0.1 : 0 }}
        className="absolute left-[-3px] right-[-3px] top-1/2 h-[2.5px] origin-left -rotate-[28deg] rounded-full bg-ink"
      />
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Interactive 2: the root splitter. Pick a square factor and see the number
// as squares of equal size.

const SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196];
const ROOT_PRESETS = [72, 50, 12, 75, 98, 48, 200, 18, 180, 27, 128, 45, 20];

function SquaresPicture({ k, r }: { k: number; r: number }) {
  const de = useLocale() === "de";
  const W = 360;
  const H = 168;
  const left = 40;
  const gap = 8;
  let best = { cols: 1, c: 0 };
  for (let cols = 1; cols <= r; cols++) {
    const rows = Math.ceil(r / cols);
    const c = Math.min((W - left - 4 - (cols - 1) * gap) / (cols * k), (H - 8 - (rows - 1) * gap) / (rows * k));
    if (c > best.c) best = { cols, c };
  }
  const c = Math.min(best.c, 24);
  const cols = best.cols;
  const rows = Math.ceil(r / cols);
  const side = k * c;
  const ox = left + (W - left - (cols * side + (cols - 1) * gap)) / 2;
  const oy = (H - (rows * side + (rows - 1) * gap)) / 2;
  const total = k * k * r;
  const inset = Math.min(1.6, c * 0.12);
  const cells = Array.from({ length: total }, (_, i) => {
    const j = Math.floor(i / (k * k));
    const w = i % (k * k);
    return {
      i,
      j,
      x: ox + (j % cols) * (side + gap) + (w % k) * c + inset / 2,
      y: oy + Math.floor(j / cols) * (side + gap) + Math.floor(w / k) * c + inset / 2,
    };
  });
  const size = Math.max(0.5, c - inset);
  const fill = (j: number) => (k === 1 ? "color-mix(in oklab, var(--ink) 22%, transparent)" : j % 2 === 0 ? "var(--blob)" : "color-mix(in oklab, var(--blob) 45%, transparent)");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px]" role="img" aria-label={de ? `${total} als ${r} Quadrate mit je ${k} mal ${k}` : `${total} as ${r} squares of ${k} by ${k}`}>
      <AnimatePresence initial={false}>
        {cells.map((cell) => (
          <motion.rect
            key={cell.i}
            initial={{ opacity: 0, x: cell.x, y: cell.y, width: size, height: size }}
            animate={{ opacity: 1, x: cell.x, y: cell.y, width: size, height: size, fill: fill(cell.j) }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 210, damping: 26, delay: Math.min(cell.i * 0.002, 0.3) }}
            rx={Math.min(3, c * 0.2)}
          />
        ))}
      </AnimatePresence>
      {k > 1 && (
        <motion.g initial={false} animate={{ x: ox - 10, y: oy }} transition={{ type: "spring", stiffness: 210, damping: 26 }}>
          <motion.line initial={false} animate={{ y2: side }} x1={0} x2={0} y1={0} stroke="var(--ink-3)" strokeWidth={1.2} />
          <motion.text initial={false} animate={{ y: side / 2 + 8 }} x={-8} textAnchor="end" fontSize={24} fill="var(--ink-2)" fontFamily="var(--font-math)">
            {k}
          </motion.text>
        </motion.g>
      )}
    </svg>
  );
}

function RootSplitter() {
  const scope = useId();
  const t = useText();
  const [n, setN] = useState(72);
  const [pick, setPick] = useState<number | null>(null);
  const [preset, setPreset] = useState(0);
  const fits = SQUARES.filter((s) => s <= n && n % s === 0);
  const best = fits.length ? fits[fits.length - 1] : 1;
  const sq = pick !== null && fits.includes(pick) ? pick : best;
  const k = Math.round(Math.sqrt(sq));
  const r = n / sq;
  const restRoot = largestSquareRoot(r);

  function setNumber(next: number) {
    setN(Math.min(200, Math.max(2, next)));
    setPick(null);
  }

  let formula: string;
  if (sq === 1) formula = `\\sqrt{${n}#N}#W`;
  else if (r === 1) formula = `\\sqrt{${n}#N}#W =#e1 \\sqrt{${k}#S \\cdot#d ${k}#R}#W1 =#e3 \\blob{${k}#K}`;
  else formula = `\\sqrt{${n}#N}#W =#e1 \\sqrt{${sq}#S \\cdot#d ${r}#R}#W1 =#e2 \\sqrt{${sq}#S2}#W2 \\cdot#d2 \\sqrt{${r}#R2}#W3 =#e3 ${restRoot > 1 ? `${k}#K \\sqrt{${r}#R3}#W4` : `\\blob{${k}#K \\sqrt{${r}#R3}#W4}`}`;

  const status: { ok: boolean; text: string } =
    sq === 1
      ? {
          ok: true,
          text: t(
            tx(
              `No square number (except 1) divides $${n}$. So $\\sqrt{${n}}$ stays as it is.`,
              `$${n}$ ist durch keine Quadratzahl (außer 1) teilbar. $\\sqrt{${n}}$ bleibt also so stehen.`,
            ),
          ),
        }
      : r === 1
        ? { ok: true, text: t(tx(`$${n}$ is a square number itself: $\\sqrt{${n}} = ${k}$.`, `$${n}$ ist selbst eine Quadratzahl: $\\sqrt{${n}} = ${k}$.`)) }
        : restRoot > 1
          ? {
              ok: false,
              text: t(
                tx(
                  `Not finished: $${r}$ still contains the square number $${restRoot * restRoot}$. Pick a bigger square.`,
                  `Noch nicht fertig: In $${r}$ steckt noch die Quadratzahl $${restRoot * restRoot}$. Wähl eine größere Quadratzahl.`,
                ),
              ),
            }
          : { ok: true, text: t(tx(`Fully simplified: $\\sqrt{${n}} = ${k}\\sqrt{${r}}$.`, `Fertig vereinfacht: $\\sqrt{${n}} = ${k}\\sqrt{${r}}$.`)) };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[13px] text-ink-2">{t(tx("Number under the root", "Zahl unter der Wurzel"))}</span>
          <button onClick={() => setNumber(n - 1)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Decrease", "Verringern"))}>
            <Minus className="size-3.5" />
          </button>
          <motion.span key={n} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-10 text-center font-math text-[20px] tabular-nums">
            {n}
          </motion.span>
          <button onClick={() => setNumber(n + 1)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Increase", "Erhöhen"))}>
            <Plus className="size-3.5" />
          </button>
        </div>
        <button
          onClick={() => {
            const next = (preset + 1) % ROOT_PRESETS.length;
            setPreset(next);
            setNumber(ROOT_PRESETS[next]);
          }}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Shuffle className="size-3.5" /> {t(tx("Another number", "Andere Zahl"))}
        </button>
      </div>

      <div>
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Square factors", "Quadratzahlen"))}</div>
        <div className="flex flex-wrap gap-1.5">
          {SQUARES.filter((s) => s <= Math.max(n, 4)).map((s) => {
            const ok = n % s === 0;
            const on = ok && s === sq;
            return (
              <button
                key={s}
                disabled={!ok}
                onClick={() => setPick(s)}
                className={cn(
                  "relative h-9 min-w-11 rounded-lg border px-2.5 font-math text-[17px] tabular-nums transition-colors",
                  on ? "border-transparent text-white" : ok ? "border-blob/40 text-ink hover:bg-blob-soft" : "border-line text-ink-3/60",
                )}
                aria-pressed={on}
              >
                {on && <motion.span layoutId={`${scope}-sq`} className="absolute inset-0 rounded-lg bg-blob" transition={spring} />}
                <span className="relative">{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <div className="flex min-h-[64px] items-center">
          <MathView src={formula} size="lg" scope={`${scope}-f`} />
        </div>
        <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={status.text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("flex items-start gap-2 text-[13.5px] leading-relaxed", status.ok ? "text-ok" : "text-ink-2")}
            >
              {status.ok && <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />}
              <span>
                <Inline text={status.text} />
              </span>
            </motion.div>
          </AnimatePresence>
          <div className="space-y-1">
            <SquaresPicture k={k} r={r} />
            <div className="flex justify-center">
              <MathView src={k === 1 ? `${n} = ${n} \\cdot 1^2` : `${n} = ${r} \\cdot ${k}^2`} size="sm" animate={false} className="text-ink-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const introFrames: Frame[] = [
  {
    math: "2#a \\cdot#d1 2#b \\cdot#d2 2#c \\cdot#d3 2#d \\cdot#d4 2#e",
    note: tx("Five times the same factor $2$. Writing that out gets long.", "Fünfmal derselbe Faktor $2$. Das auszuschreiben wird ganz schön lang."),
  },
  {
    math: "2#a^{5#n}",
    note: tx(
      'Short: $2^5$, read "2 to the power of 5". The **base** $2$ is the factor, the **exponent** $5$ counts the factors.',
      "Kurz: $2^5$, gelesen „2 hoch 5“. Die **Basis** $2$ ist der Faktor, der **Exponent** (die Hochzahl) $5$ zählt die Faktoren.",
    ),
    highlight: ["a", "n"],
  },
  {
    math: "2#a^{5#n} =#eq 32#r",
    note: tx("Worked out: $2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32$.", "Ausgerechnet: $2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32$."),
  },
  {
    math: "2#a^{3#n} =#eq 2#x1 \\cdot#m1 2#x2 \\cdot#m2 2#x3 =#eq2 8#r",
    note: tx(
      "Careful: $2^3$ means $2 \\cdot 2 \\cdot 2 = 8$. It's **not** $2 \\cdot 3 = 6$.",
      "Vorsicht: $2^3$ bedeutet $2 \\cdot 2 \\cdot 2 = 8$. Es ist **nicht** $2 \\cdot 3 = 6$.",
    ),
    highlight: ["n"],
  },
  {
    // German: a semicolon separates the two equations (the comma is the decimal comma).
    math: tx("(-#m 3#a)#br^{2#n} =#eq 9#r ,#c -#m2 3#a2^{2#n2} =#eq2 -#m3 9#r2", "(-#m 3#a)#br^{2#n} =#eq 9#r ;#c -#m2 3#a2^{2#n2} =#eq2 -#m3 9#r2"),
    note: tx(
      "Brackets matter: in $(-3)^2$ the minus is squared too. In $-3^2$ only the $3$ is squared.",
      "Klammern sind wichtig: Bei $(-3)^2$ wird das Minus mitquadriert. Bei $-3^2$ wird nur die $3$ quadriert.",
    ),
  },
];

const productFramesLesson: Frame[] = [
  {
    math: "a#a1^{3#e1} \\cdot#dot a#a4^{2#e2}",
    note: tx("Two powers with the **same base** $a$, multiplied.", "Zwei Potenzen mit **gleicher Basis** $a$ werden multipliziert."),
  },
  {
    math: "(a#a1 \\cdot#m1 a#a2 \\cdot#m2 a#a3)#L \\cdot#dot (a#a4 \\cdot#m4 a#a5)#R",
    note: tx("Write them out: three factors $a$, then two more.", "Schreib sie aus: drei Faktoren $a$, dann noch zwei."),
  },
  {
    math: "a#a1 \\cdot#m1 a#a2 \\cdot#m2 a#a3 \\cdot#dot a#a4 \\cdot#m4 a#a5",
    note: tx("Without brackets it's one long product of $3 + 2 = 5$ factors.", "Ohne Klammern ist es ein langes Produkt aus $3 + 2 = 5$ Faktoren."),
    highlight: ["a1", "a2", "a3", "a4", "a5"],
  },
  { math: "a#a1^{3#e1 +#pl 2#e2}", note: tx("So the exponents add up: $a^{3+2}$.", "Die Exponenten werden also addiert: $a^{3+2}$.") },
  {
    math: "a#a1^{5#e1}",
    note: tx(
      "$a^3 \\cdot a^2 = a^5$. **Same base: keep it and add the exponents.** In general $a^m \\cdot a^n = a^{m+n}$.",
      "$a^3 \\cdot a^2 = a^5$. **Gleiche Basis: Basis behalten, Exponenten addieren.** Allgemein gilt $a^m \\cdot a^n = a^{m+n}$.",
    ),
  },
];

const quotientFramesLesson: Frame[] = [
  {
    math: "\\frac{a#a1^{5#e1}}{a#b1^{2#e2}}#F",
    note: tx("Now divide: $a^5 : a^2$, written as a fraction.", "Jetzt wird dividiert: $a^5 : a^2$, als Bruch geschrieben."),
  },
  {
    math: "\\frac{\\strike{a#a1} \\cdot#m1 \\strike{a#a2} \\cdot#m2 a#a3 \\cdot#m3 a#a4 \\cdot#m4 a#a5}{\\strike{a#b1} \\cdot#n1 \\strike{a#b2}}#F",
    note: tx("Write it out. Each $a$ below cancels one $a$ on top.", "Schreib alles aus. Jedes $a$ unten kürzt sich mit einem $a$ oben weg."),
  },
  {
    math: "a#a3 \\cdot#m3 a#a4 \\cdot#m4 a#a5 =#eq a#r^{3#e3}",
    note: tx(
      "Three factors are left: $a^5 : a^2 = a^{5-2} = a^3$. So **subtract** the exponents.",
      "Drei Faktoren bleiben übrig: $a^5 : a^2 = a^{5-2} = a^3$. Die Exponenten werden also **subtrahiert**.",
    ),
  },
  {
    math: "a#a3^{3#e1} :#dv a#b1^{3#e2} =#eq a#r^{0#e3} =#eq2 1#one",
    note: tx(
      "Same exponents? Everything cancels and $1$ is left. That's why $a^0 = 1$.",
      "Gleiche Exponenten? Dann kürzt sich alles weg und $1$ bleibt übrig. Deshalb ist $a^0 = 1$.",
    ),
  },
  {
    math: "a#a3^{2#e1} :#dv a#b1^{5#e2} =#eq a#r^{-#ns 3#e3} =#eq2 \\frac{1#one}{a#q^{3#e4}}#G",
    note: tx(
      "More factors below? Then three $a$ stay **below**: $a^{-3} = \\frac{1}{a^3}$. A negative exponent means **one divided by**.",
      "Mehr Faktoren unten? Dann bleiben drei $a$ **unten** stehen: $a^{-3} = \\frac{1}{a^3}$. Ein negativer Exponent bedeutet **eins geteilt durch**.",
    ),
  },
];

const bracketFramesLesson: Frame[] = [
  { math: "(a#a^{2#e1})#br^{3#e2}", note: tx("A power of a power: $a^2$, three times.", "Eine Potenz wird potenziert: $a^2$, dreimal.") },
  {
    math: "a#a^{2#e1} \\cdot#d1 a#a2^{2#f1} \\cdot#d2 a#a3^{2#f2}",
    note: tx("Written out: $a^2 \\cdot a^2 \\cdot a^2 = a^{2+2+2}$.", "Ausgeschrieben: $a^2 \\cdot a^2 \\cdot a^2 = a^{2+2+2}$."),
  },
  {
    math: "a#a^{2#e1 \\cdot#t 3#e2} =#eq a#r^{6#e3}",
    note: tx(
      "That's $2 \\cdot 3$. So for a power of a power, **multiply** the exponents.",
      "Das ist $2 \\cdot 3$. Beim Potenzieren einer Potenz werden die Exponenten also **multipliziert**.",
    ),
  },
  { math: "(2#c x#x)#br^{3#e}", note: tx("A product in brackets, with an exponent.", "Ein Produkt in Klammern, mit Exponent.") },
  { math: "2#c^{3#e} \\cdot#d x#x^{3#e2}", note: tx("The exponent goes to **every factor** in the bracket.", "Der Exponent gilt für **jeden Faktor** in der Klammer.") },
  { math: "8#c x#x^{3#e2}", note: tx("$2^3 = 8$, so $(2x)^3 = 8x^3$.", "$2^3 = 8$, also ist $(2x)^3 = 8x^3$.") },
  {
    math: "(a#a +#p b#b)#br^{2#e} \\ne#ne a#a2^{2#e2} +#p2 b#b2^{2#e3}",
    note: tx(
      "But only for products! A **sum** in brackets is different: $(a + b)^2 = a^2 + 2ab + b^2$.",
      "Aber nur bei Produkten! Bei einer **Summe** in Klammern ist es anders: $(a + b)^2 = a^2 + 2ab + b^2$ (binomische Formel).",
    ),
  },
];

const tenFramesLesson: Frame[] = [
  { math: "10#t^{3#e} =#eq 1#v1 \\,000#v2", note: tx("$10^3$ is a $1$ with three zeros.", "$10^3$ ist eine $1$ mit drei Nullen.") },
  {
    math: "10#t^{-#es 3#e} =#eq \\frac{1#o}{1\\,000}#F =#eq2 0,001#v2",
    note: tx(
      "A negative exponent gives a small number: $10^{-3} = 0,001$, three places after the comma.",
      "Ein negativer Exponent ergibt eine kleine Zahl: $10^{-3} = 0,001$, drei Stellen nach dem Komma.",
    ),
  },
  { math: "4#m \\,500\\,000", note: tx("Big numbers are easier to read with powers of ten.", "Große Zahlen lassen sich mit Zehnerpotenzen leichter lesen.") },
  {
    math: "4,5#m \\cdot#d 1#t \\,000\\,000",
    note: tx(
      "Move the comma $6$ places to the left: $4,5$. To keep the value, multiply by $1\\,000\\,000$.",
      "Verschiebe das Komma um $6$ Stellen nach links: $4,5$. Damit der Wert gleich bleibt, multiplizierst du mit $1\\,000\\,000$.",
    ),
  },
  {
    math: "4,5#m \\cdot#d 10#t^{6#e}",
    note: tx(
      "$1\\,000\\,000 = 10^6$. This is **scientific notation**: a number from $1$ to below $10$, times a power of ten.",
      "$1\\,000\\,000 = 10^6$. Das ist die **wissenschaftliche Schreibweise**: eine Zahl von $1$ bis unter $10$, mal eine Zehnerpotenz.",
    ),
  },
  {
    math: "0,00072#s =#eq 7,2#m \\cdot#d 10#t^{-#es 4#e}",
    note: tx(
      "Small numbers work the same way. The comma moves $4$ places to the **right**, so the exponent is $-4$.",
      "Kleine Zahlen funktionieren genauso. Das Komma rutscht $4$ Stellen nach **rechts**, also ist der Exponent $-4$.",
    ),
  },
];

const rootFramesLesson: Frame[] = [
  { math: "\\sqrt{50#s}#R", note: tx("How can you simplify $\\sqrt{50}$?", "Wie kannst du $\\sqrt{50}$ vereinfachen?") },
  {
    math: "\\sqrt{25#s \\cdot#d 2#r}#R",
    note: tx(
      "Split $50$ into a **square number** times the rest: $50 = 25 \\cdot 2$.",
      "Zerlege $50$ in eine **Quadratzahl** mal den Rest: $50 = 25 \\cdot 2$.",
    ),
    highlight: ["s"],
  },
  {
    math: "\\sqrt{25#s}#R0 \\cdot#d \\sqrt{2#r}#R",
    note: tx(
      "Take the root of each factor: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$.",
      "Zieh die Wurzel aus jedem Faktor: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$.",
    ),
  },
  {
    math: "5#s \\sqrt{2#r}#R",
    note: tx(
      "$\\sqrt{25} = 5$ comes out. So $\\sqrt{50} = 5\\sqrt{2}$. That's called **partially taking the root**.",
      "$\\sqrt{25} = 5$ kommt vor die Wurzel. Also ist $\\sqrt{50} = 5\\sqrt{2}$. Das nennt man **teilweises Wurzelziehen**.",
    ),
  },
  {
    math: "\\sqrt{(-#m 3#a)#br^{2#e}}#R =#eq \\sqrt{9#n}#R2 =#eq2 3#r",
    note: tx(
      "Careful: $\\sqrt{(-3)^2} = 3$, not $-3$. A square root is never negative. So $\\sqrt{a^2} = |a|$, the absolute value.",
      "Vorsicht: $\\sqrt{(-3)^2} = 3$, nicht $-3$. Eine Quadratwurzel ist nie negativ. Also ist $\\sqrt{a^2} = |a|$, der Betrag von $a$.",
    ),
  },
  {
    math: "\\sqrt{a#a}#R =#eq a#a2^{\\frac{1}{2}#F}",
    note: tx(
      "A square root is a power too: $a^{\\frac{1}{2}} \\cdot a^{\\frac{1}{2}} = a^{\\frac{1}{2} + \\frac{1}{2}} = a^1 = a$.",
      "Eine Quadratwurzel ist auch eine Potenz: $a^{\\frac{1}{2}} \\cdot a^{\\frac{1}{2}} = a^{\\frac{1}{2} + \\frac{1}{2}} = a^1 = a$.",
    ),
  },
  {
    math: "\\sqrt{9 + 16} \\ne \\sqrt{9} + \\sqrt{16}",
    note: tx(
      "Never split a root over a **sum**: $\\sqrt{25} = 5$, but $3 + 4 = 7$.",
      "Teile eine Wurzel nie bei einer **Summe** auf: $\\sqrt{25} = 5$, aber $3 + 4 = 7$.",
    ),
  },
];

const powersRoots: Topic = {
  ...topicMeta("powers-roots"),
  summary: [
    {
      title: tx("Same base", "Gleiche Basis"),
      body: tx(
        "Multiply: add the exponents. Divide: subtract them. Power of a power: multiply them.",
        "Multiplizieren: Exponenten addieren. Dividieren: Exponenten subtrahieren. Potenz einer Potenz: Exponenten multiplizieren.",
      ),
      examples: ["a^m \\cdot a^n = a^{m+n}", "a^m : a^n = a^{m-n}", "(a^m)^n = a^{m \\cdot n}"],
      tone: "rule",
    },
    {
      title: tx("Exponent outside a product", "Potenz eines Produkts"),
      body: tx("The exponent goes to every factor in the bracket.", "Der Exponent gilt für jeden Faktor in der Klammer."),
      examples: ["(a \\cdot b)^n = a^n \\cdot b^n", "(2x)^3 = 8x^3"],
      tone: "rule",
    },
    {
      title: tx("Zero and negative exponents", "Exponent null und negative Exponenten"),
      body: tx("A negative exponent means one divided by the power.", "Ein negativer Exponent bedeutet: eins geteilt durch die Potenz (Kehrwert)."),
      examples: ["a^0 = 1", "a^{-n} = \\frac{1}{a^n}", "2^{-3} = \\frac{1}{8}"],
      tone: "rule",
    },
    {
      title: tx("Square roots", "Quadratwurzeln"),
      body: tx(
        "Split off the biggest square number and take its root (teilweise Wurzelziehen).",
        "Spalte die größte Quadratzahl ab und zieh aus ihr die Wurzel (teilweises Wurzelziehen).",
      ),
      examples: ["\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}", "\\sqrt{50} = \\sqrt{25 \\cdot 2} = 5\\sqrt{2}", "\\sqrt{a^2} = |a| \\quad \\sqrt{a} = a^{\\frac{1}{2}}"],
      tone: "rule",
    },
    {
      title: tx("Scientific notation", "Wissenschaftliche Schreibweise"),
      body: tx(
        "A number from 1 to below 10, times a power of ten. Count how far the comma moves.",
        "Eine Zahl von 1 bis unter 10, mal eine Zehnerpotenz. Zähl, um wie viele Stellen das Komma rutscht.",
      ),
      examples: ["4\\,500\\,000 = 4,5 \\cdot 10^6", "0,00072 = 7,2 \\cdot 10^{-4}"],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "The exponent counts factors. And the rules only work for products, never for sums.",
        "Der Exponent zählt Faktoren. Und die Regeln gelten nur für Produkte, nie für Summen.",
      ),
      examples: ["2^3 = 8 \\ne 2 \\cdot 3", "(a + b)^2 \\ne a^2 + b^2", "\\sqrt{a + b} \\ne \\sqrt{a} + \\sqrt{b}"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Powers: a short way to multiply", "Potenzen: Multiplizieren in Kurzform"),
      blob: tx("Ready? Powers are just lazy multiplication. I like lazy!", "Bereit? Potenzen sind einfach faules Multiplizieren. Faul find ich gut!"),
      body: tx(
        "When the same factor appears again and again, we write it as a **power**.",
        "Wenn derselbe Faktor immer wieder vorkommt, schreiben wir ihn als **Potenz**.",
      ),
      frames: introFrames,
    },
    {
      type: "explain",
      title: tx("Same base: add the exponents", "Gleiche Basis: Exponenten addieren"),
      blob: tx("Let's multiply two powers. Count the factors with me!", "Lass uns zwei Potenzen multiplizieren. Zähl die Faktoren mit mir!"),
      body: tx("Write powers out and the rule appears by itself.", "Schreib die Potenzen aus, dann zeigt sich die Regel von selbst."),
      frames: productFramesLesson,
    },
    {
      type: "widget",
      title: tx("The power lab", "Das Potenzlabor"),
      blob: tx("Every tile is one factor a. Press Combine and watch them!", "Jede Kachel ist ein Faktor a. Drück auf Zusammenfassen und schau zu!"),
      body: tx(
        "Pick a rule, change $m$ and $n$ and press **Combine**. Try $:$ with a bigger $n$ than $m$. What happens?",
        "Wähl eine Regel, ändere $m$ und $n$ und drück auf **Zusammenfassen**. Probier $:$ mit einem größeren $n$ als $m$. Was passiert?",
      ),
      widget: PowerLab,
    },
    {
      type: "check",
      blob: tx("Your turn! Watch out for the lonely x at the end.", "Du bist dran! Achte auf das einsame x am Ende."),
      exercise: {
        instruction: tx("Find the exponent n", "Bestimme den Exponenten n"),
        math: "x^4 \\cdot x^5 \\cdot x = x^{\\blob{n}}",
        answer: { kind: "number", value: 10, label: "n =" },
        mistakes: productMistakes("x", [4, 5, 1]),
        hint: tx("A single $x$ counts as $x^1$.", "Ein einzelnes $x$ zählt als $x^1$."),
        solution: productFrames("x", [4, 5, 1]),
      },
    },
    {
      type: "explain",
      title: tx("Dividing: subtract the exponents", "Dividieren: Exponenten subtrahieren"),
      blob: tx(
        "Dividing is cancelling. And it explains the strange exponents 0 and −3!",
        "Dividieren ist Kürzen. Und das erklärt die seltsamen Exponenten 0 und −3!",
      ),
      body: tx(
        "Same base, divided: keep the base and subtract the exponents. The result can be $0$ or negative.",
        "Gleiche Basis, dividiert: Basis behalten, Exponenten subtrahieren. Das Ergebnis kann $0$ oder negativ sein.",
      ),
      frames: quotientFramesLesson,
    },
    {
      type: "check",
      blob: tx("A negative exponent. What does it mean again?", "Ein negativer Exponent. Was bedeutet der noch mal?"),
      exercise: {
        instruction: tx("Write as a fraction", "Schreib als Bruch"),
        math: "2^{-3}",
        answer: { kind: "fraction", n: 1, d: 8 },
        mistakes: negPowerMistakes(2, 3),
        hint: tx("$a^{-n} = \\frac{1}{a^n}$, so $2^{-3} = \\frac{1}{2^3}$.", "$a^{-n} = \\frac{1}{a^n}$, also ist $2^{-3} = \\frac{1}{2^3}$."),
        solution: negativeToFractionFrames(2, 3),
      },
    },
    {
      type: "explain",
      title: tx("Brackets with an exponent", "Klammern mit Exponent"),
      blob: tx("Brackets with an exponent outside. Two rules, one trap!", "Klammern mit einem Exponenten außen. Zwei Regeln, eine Falle!"),
      body: tx(
        "A power of a power: multiply the exponents. A product to a power: every factor gets the exponent.",
        "Potenz einer Potenz: Exponenten multiplizieren. Potenz eines Produkts: Jeder Faktor bekommt den Exponenten.",
      ),
      frames: bracketFramesLesson,
    },
    {
      type: "check",
      blob: tx("Don't forget the 2 in the bracket!", "Vergiss die 2 in der Klammer nicht!"),
      exercise: {
        instruction: tx("Simplify", "Vereinfache"),
        math: "(2x^3)^4 = \\blob{c} x^{\\blob{n}}",
        answer: { kind: "pair", names: ["c", "n"], values: [16, 12] },
        mistakes: bracketMistakes("x", 2, 3, 4, 1, 0, false),
        hint: tx("Both factors get the exponent $4$: $2^4$ and $(x^3)^4$.", "Beide Faktoren bekommen den Exponenten $4$: $2^4$ und $(x^3)^4$."),
        solution: bracketPowerFrames("x", 2, 3, 4, null),
      },
    },
    {
      type: "explain",
      title: tx("Powers of ten", "Zehnerpotenzen"),
      blob: tx("Huge and tiny numbers, made easy. Scientists do it like this!", "Riesige und winzige Zahlen, ganz einfach. So machen das auch Profis in der Forschung!"),
      body: tx(
        "Positive exponents make big numbers, negative exponents make small ones.",
        "Positive Exponenten ergeben große Zahlen, negative Exponenten kleine.",
      ),
      frames: tenFramesLesson,
    },
    {
      type: "check",
      blob: tx("Count the places the comma moves.", "Zähl, um wie viele Stellen das Komma rutscht."),
      exercise: {
        instruction: tx("Write in scientific notation", "Schreib in wissenschaftlicher Schreibweise"),
        text: tx("Write it as $a \\cdot 10^n$ with $1 \\le a < 10$.", "Schreib die Zahl als $a \\cdot 10^n$ mit $1 \\le a < 10$."),
        math: "0,00036 = \\blob{a} \\cdot 10^{\\blob{n}}",
        answer: { kind: "pair", names: ["a", "n"], values: [3.6, -4] },
        mistakes: sciMistakes("36", -4),
        hint: tx(
          "Move the comma to the right until one digit (not $0$) is in front of it. Right means negative.",
          "Verschiebe das Komma nach rechts, bis eine Ziffer (nicht $0$) davor steht. Rechts heißt negativ.",
        ),
        solution: sciFrames("36", -4),
      },
    },
    {
      type: "explain",
      title: tx("Square roots: pull out squares", "Quadratwurzeln: Quadratzahlen herausziehen"),
      blob: tx("Roots undo squares. Let's make them as simple as possible.", "Wurzeln machen das Quadrieren rückgängig. Machen wir sie so einfach wie möglich!"),
      body: tx(
        "The rule behind it: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$, for $a, b \\ge 0$.",
        "Die Regel dahinter: $\\sqrt{a \\cdot b} = \\sqrt{a} \\cdot \\sqrt{b}$ für $a, b \\ge 0$.",
      ),
      frames: rootFramesLesson,
    },
    {
      type: "widget",
      title: tx("The root splitter", "Der Wurzelzerleger"),
      blob: tx("Find the biggest square inside the number. Try a smaller one too!", "Finde die größte Quadratzahl, die in der Zahl steckt. Probier auch mal eine kleinere!"),
      body: tx(
        "Pick a square factor. The picture shows the number as equal squares. The side of one square comes out of the root.",
        "Wähl eine Quadratzahl als Faktor. Das Bild zeigt die Zahl als gleich große Quadrate. Die Seitenlänge eines Quadrats kommt vor die Wurzel.",
      ),
      widget: RootSplitter,
    },
    {
      type: "check",
      blob: tx("Last one! Which square fits into 72?", "Letzte Aufgabe! Welche Quadratzahl steckt in 72?"),
      exercise: {
        instruction: tx("Simplify the root", "Vereinfache die Wurzel"),
        math: "\\sqrt{72} = \\blob{a} \\sqrt{\\blob{b}}",
        answer: { kind: "pair", names: ["a", "b"], values: [6, 2] },
        mistakes: rootMistakes(72),
        hint: tx("The biggest square number that divides $72$ is $36$.", "Die größte Quadratzahl, durch die sich $72$ teilen lässt, ist $36$."),
        solution: partialRootFrames(72),
      },
    },
  ],
  generate,
};

export default powersRoots;
