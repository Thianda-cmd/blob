"use client";

import type { ComponentType } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { add, div as divF, frac, mul as mulF, sub, type Frac } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { bi, dec, decStr, dotsSrc, fracDots, periodOf, primeFactors, r6, terminates } from "./decimals";
import {
  addSub,
  appendNote,
  board,
  bracketTask,
  CALCULATE,
  coprime,
  div,
  doubleTask,
  finish,
  fr,
  frf,
  kf,
  lcdNote,
  mImproper,
  mSrc,
  mTx,
  mul,
  mWork,
  orderTask,
  pickWeighted,
  put,
  simplify,
  src,
  type Board,
  type Gen,
  type KF,
  type MixedN,
} from "./level1";
import { FractionsDecimalKinds, FractionsDivisionMachine, FractionsLinePicture, FractionsNumberLine, FractionsPeriodicPicture } from "./widgets2";

// Level 2: fractions, decimals and percentages both ways, repeating decimals, comparing and
// ordering (also negative numbers), the order of operations and double fractions.

const E = (t: Text) => resolveText(t, "en");
const visual = (component: unknown, props: Record<string, unknown>) => ({ component: component as ComponentType<Record<string, unknown>>, props });

/** A signed fraction in the display language: "-\frac{3}{4}", "\frac{3}{4}", "-2". */
const sfr = (f: Frac) => (f.d === 1 ? String(f.n) : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`);

/** A typical mistake: the value it leads to and what Blob says. */
type Slip = { v: Frac | null | undefined; title: Text; say: Text; close?: boolean } | null | false | undefined;

/** Mistakes for a fraction or number answer; values equal to the answer or to earlier slips are dropped. */
function mistakesFor(answer: AnswerSpec, slips: Slip[]): Mistake[] {
  const right = answer.kind === "fraction" ? answer.n / answer.d : answer.kind === "number" ? answer.value : NaN;
  const seen = [right];
  const out: Mistake[] = [];
  for (const s of slips) {
    if (!s || !s.v || s.v.d === 0) continue;
    const v = s.v.n / s.v.d;
    if (!Number.isFinite(v) || seen.some((x) => Math.abs(x - v) < 1e-9)) continue;
    let when: AnswerSpec;
    if (answer.kind === "fraction") when = { kind: "fraction", n: s.v.n, d: s.v.d };
    else if (answer.kind === "number") {
      // A number answer is typed: only values with at most three decimals.
      if (Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-9) continue;
      when = { kind: "number", value: r6(v), ...(answer.unit ? { unit: answer.unit } : {}) };
    } else continue;
    seen.push(v);
    out.push({ when, title: s.title, say: s.say, ...(s.close ? { close: true } : {}) });
  }
  return out;
}

/** A fraction answer (fully simplified), or a number when it is whole. */
const answerOf = (r: Frac): AnswerSpec => (r.d === 1 ? { kind: "number", value: r.n } : { kind: "fraction", n: r.n, d: r.d, mustReduce: true });

/** Safe fraction for slips: null for a zero denominator or non-integers. */
const fv = (n: number, d: number): Frac | null => (d !== 0 && Number.isInteger(n) && Number.isInteger(d) ? frac(n, d) : null);

const PLACE: Record<number, [string, string]> = { 10: ["tenths", "Zehntel"], 100: ["hundredths", "Hundertstel"], 1000: ["thousandths", "Tausendstel"] };
const placeNo: Record<number, [string, string]> = { 10: ["first", "ersten"], 100: ["second", "zweiten"], 1000: ["third", "dritten"] };

const PERCENT = "%";
const WRITE_DECIMAL = tx("Write as a decimal", "Schreib als Dezimalzahl");
const WRITE_PERCENT = tx("Write as a percentage", "Schreib in Prozent");
const WRITE_FRACTION = tx("Write as a fraction", "Schreib als Bruch");

// ---------------------------------------------------------------------------
// Fraction → decimal

/** The power of ten a denominator goes into (2, 4, 5, 8, 20, 25, 40, 50 …), or 0. */
const tenPower = (d: number) => [10, 100, 1000].find((p) => p % d === 0) ?? 0;

function toDecimalExercise(n: number, d: number): Exercise {
  const v = n / d;
  const p = tenPower(d);
  const k = p / d;
  const de = decStr(v, "de");
  const b = board();
  put(
    b,
    `\\frac{${n}#n}{${d}#d}#f`,
    tx(`Expand so that the denominator becomes $10$, $100$ or $1000$. Here: $${d} \\cdot ${k} = ${p}$.`, `Erweitere so, dass im Nenner $10$, $100$ oder $1000$ steht. Hier: $${d} \\cdot ${k} = ${p}$.`),
    { highlight: ["d"] },
  );
  if (k > 1)
    put(b, `\\frac{${n}#n \\cdot#m1 ${k}#k1}{${d}#d \\cdot#m2 ${k}#k2}#f`, tx(`Multiply top **and** bottom by $${k}$.`, `Zähler **und** Nenner mal $${k}$.`), { highlight: ["k1", "k2"] });
  put(
    b,
    `\\frac{${n * k}#n}{${p}#d}#f`,
    tx(`$${n * k}$ ${PLACE[p][0]}.`, `$${n * k}$ ${PLACE[p][1]}.`),
  );
  put(
    b,
    bi(`\\frac{${n * k}#n}{${p}#d}#f =#e ${de}#v`),
    tx(
      `${PLACE[p][0][0].toUpperCase()}${PLACE[p][0].slice(1)} end at the ${placeNo[p][0]} place after the decimal point: $${decStr(v, "en")}$.`,
      `${PLACE[p][1]} enden an der ${placeNo[p][1]} Stelle nach dem Komma: $${de}$.`,
    ),
    { highlight: ["v"] },
  );
  const answer: AnswerSpec = { kind: "number", value: r6(v) };
  const glue = (a: string) => Number(a);
  const concat = n < d ? glue(`0.${n}${d}`) : null;
  const comma = glue(`${n}.${d}`);
  const NOT_COMMA = tx("Fraction bar read as a comma", "Bruchstrich als Komma gelesen");
  const notCommaSay = tx(
    `Ah, I see what happened! You wrote numerator and denominator next to each other as a decimal. But the fraction bar isn't a decimal point: $\\frac{${n}}{${d}}$ means $${n} : ${d}$.`,
    `Ah, ich seh, was passiert ist! Du hast Zähler und Nenner einfach als Dezimalzahl hintereinandergeschrieben. Der Bruchstrich ist aber kein Komma: $\\frac{${n}}{${d}}$ heißt $${n} : ${d}$.`,
  );
  return {
    instruction: WRITE_DECIMAL,
    math: `\\frac{${n}}{${d}}`,
    answer,
    hint: tx(
      `Expand to a denominator of $10$, $100$ or $1000$, or work out $${n} : ${d}$.`,
      `Erweitere auf den Nenner $10$, $100$ oder $1000$ oder rechne $${n} : ${d}$.`,
    ),
    solution: b.frames,
    mistakes: mistakesFor(answer, [
      concat !== null && { v: fv(Math.round(concat * 1e6), 1e6), title: NOT_COMMA, say: notCommaSay },
      { v: fv(Math.round(comma * 1e6), 1e6), title: NOT_COMMA, say: notCommaSay },
      k > 1 && {
        v: fv(n, p),
        title: tx("Only the denominator expanded", "Nur den Nenner erweitert"),
        say: tx(
          `Nearly! You turned the denominator into $${p}$, but the numerator stayed $${n}$. Multiply it by $${k}$ too.`,
          `Fast! Den Nenner hast du zu $${p}$ gemacht, aber der Zähler ist $${n}$ geblieben. Den musst du auch mal $${k}$ nehmen.`,
        ),
      },
      n > 1 && terminates(d, n) && {
        v: fv(d, n),
        title: tx("Divided the wrong way round", "Andersherum geteilt"),
        say: tx(
          `I think you worked out $${d} : ${n}$. A fraction is numerator **divided by** denominator: $${n} : ${d}$.`,
          `Ich glaub, du hast $${d} : ${n}$ gerechnet. Ein Bruch ist Zähler **geteilt durch** Nenner: $${n} : ${d}$.`,
        ),
      },
    ]),
  };
}

function toDecimalTask(rng: Rng): Exercise | null {
  const d = rng.pick([2, 4, 5, 8, 20, 25, 40, 50, 4, 5, 8, 20, 25]);
  const n = rng.chance(0.2) ? coprime(rng, d, d + 1, 2 * d - 1) : coprime(rng, d, 1, d - 1);
  if (n === null || n > 60) return null;
  return toDecimalExercise(n, d);
}

// ---------------------------------------------------------------------------
// Fraction → percentage

const PERCENT_STORIES: { total: number[]; text: (k: number, N: number) => Text }[] = [
  {
    total: [20, 25, 40, 50],
    text: (k, N) => tx(`${k} of the ${N} students in class 7a come to school by bus. What percentage is that?`, `${k} der ${N} Kinder der Klasse 7a kommen mit dem Bus zur Schule. Wie viel Prozent sind das?`),
  },
  {
    total: [20, 25, 40, 50],
    text: (k, N) => tx(`Ida scores ${k} out of ${N} points in a test. What percentage of the points is that?`, `Ida hat im Test ${k} von ${N} Punkten. Wie viel Prozent der Punkte sind das?`),
  },
  {
    total: [20, 25, 50, 200],
    text: (k, N) => tx(`In a survey, ${k} of ${N} people say yes. What percentage is that?`, `Bei einer Umfrage sagen ${k} von ${N} Personen ja. Wie viel Prozent sind das?`),
  },
];

function toPercentExercise(n: number, d: number, story?: { k: number; N: number; text: Text }): Exercise {
  const v = n / d;
  const p = tenPower(d);
  const b = board();
  if (story) {
    put(
      b,
      `\\frac{${story.k}#sn}{${story.N}#sd}#sf`,
      tx(`$${story.k}$ out of $${story.N}$: that's the fraction $\\frac{${story.k}}{${story.N}}$.`, `$${story.k}$ von $${story.N}$: Das ist der Bruch $\\frac{${story.k}}{${story.N}}$.`),
    );
    if (story.N !== d) {
      b.pre = "";
      simplify(b, kf(story.k, story.N, "s"));
    }
  }
  if (p === 100 || p === 10) {
    const kk = 100 / d;
    put(b, `\\frac{${n}#n \\cdot#m1 ${kk}#k1}{${d}#d \\cdot#m2 ${kk}#k2}#f`, tx(`Expand to the denominator $100$: multiply by $${kk}$.`, `Erweitere auf den Nenner $100$: mal $${kk}$.`), {
      highlight: ["k1", "k2"],
    });
    put(b, `\\frac{${n * kk}#n}{100#d}#f`, tx(`$${n * kk}$ hundredths.`, `$${n * kk}$ Hundertstel.`));
    put(b, `\\frac{${n * kk}#n}{100#d}#f =#e ${n * kk}#p %#pc`, tx("**Per cent** means hundredths.", "**Prozent** heißt Hundertstel."), { highlight: ["p", "pc"] });
  } else {
    const pct = r6(v * 100);
    put(b, bi(`${n}#n :#dv ${d}#d =#e ${decStr(v, "de")}#v`), tx(`$${d}$ doesn't go into $100$, so divide: $${n} : ${d} = ${decStr(v, "en")}$.`, `$${d}$ passt nicht in $100$, also teil: $${n} : ${d} = ${decStr(v, "de")}$.`));
    put(
      b,
      bi(`${decStr(v, "de")}#v =#e2 \\frac{${decStr(pct, "de")}#p}{100#h}#f`),
      tx(`$${decStr(v, "en")}$ is $${decStr(pct, "en")}$ hundredths.`, `$${decStr(v, "de")}$ sind $${decStr(pct, "de")}$ Hundertstel.`),
    );
    put(b, bi(`${decStr(v, "de")}#v =#e2 ${decStr(pct, "de")}#p %#pc`), tx("**Per cent** means hundredths.", "**Prozent** heißt Hundertstel."), { highlight: ["p", "pc"] });
  }
  const answer: AnswerSpec = { kind: "number", value: r6(v * 100), unit: PERCENT };
  const shownN = story ? story.k : n;
  const shownD = story ? story.N : d;
  return {
    instruction: story ? tx("Word problem", "Textaufgabe") : WRITE_PERCENT,
    ...(story ? { text: story.text } : { math: `\\frac{${n}}{${d}}` }),
    answer,
    hint: tx("Per cent means hundredths: expand to the denominator $100$ (or divide and multiply by $100$).", "Prozent heißt Hundertstel: Erweitere auf den Nenner $100$ (oder teile und nimm mal $100$)."),
    solution: b.frames,
    mistakes: mistakesFor(answer, [
      {
        v: fv(Math.round(v * 1e6), 1e6),
        title: tx("Not turned into per cent", "Nicht in Prozent umgerechnet"),
        say: tx(
          `Halfway there! $${decStr(v, "en")}$ is the decimal. Per cent means hundredths, so $${decStr(v, "en")} = ${decStr(v * 100, "en")}\\,\\%$.`,
          `Halb geschafft! $${decStr(v, "de")}$ ist die Dezimalzahl. Prozent heißt Hundertstel, also $${decStr(v, "de")} = ${decStr(v * 100, "de")}\\,\\%$.`,
        ),
      },
      shownD !== 100 && {
        v: fv(shownN, 1),
        title: tx("Numerator taken as the percentage", "Zähler als Prozentsatz genommen"),
        say: tx(
          `Careful: $\\frac{${shownN}}{${shownD}}$ is only $${shownN}\\,\\%$ if the denominator is $100$. Expand to hundredths first.`,
          `Vorsicht: $\\frac{${shownN}}{${shownD}}$ sind nur dann $${shownN}\\,\\%$, wenn der Nenner $100$ ist. Erweitere zuerst auf Hundertstel.`,
        ),
      },
      n > 1 &&
        100 % d === 0 && {
          v: fv(100 / d, 1),
          title: tx("Numerator forgotten", "Zähler vergessen"),
          say: tx(
            `Nearly! $\\frac{1}{${d}}$ is $${100 / d}\\,\\%$. But you have $${n}$ of these parts: multiply by $${n}$.`,
            `Fast! $\\frac{1}{${d}}$ sind $${100 / d}\\,\\%$. Du hast aber $${n}$ solche Teile: mal $${n}$.`,
          ),
        },
    ]),
  };
}

function toPercentTask(rng: Rng): Exercise | null {
  if (rng.chance(0.35)) {
    const st = rng.pick(PERCENT_STORIES);
    const N = rng.pick(st.total);
    const k = rng.int(1, N - 1);
    const f = frac(k, N);
    if (k === N / 2 || !tenPower(f.d) || f.d > 100) return null;
    return toPercentExercise(f.n, f.d, { k, N, text: st.text(k, N) });
  }
  const d = rng.pick([2, 4, 5, 10, 20, 25, 50, 8, 40]);
  const n = rng.chance(0.15) ? coprime(rng, d, d + 1, 2 * d - 1) : coprime(rng, d, 1, d - 1);
  if (n === null || n > 60) return null;
  return toPercentExercise(n, d);
}

// ---------------------------------------------------------------------------
// Decimal or percentage → fraction

function fromDecimalExercise(v: number, percent: boolean): Exercise {
  // Digits: v = m / 10^places.
  const shown = percent ? r6(v * 100) : v;
  const places = (String(shown).split(".")[1] ?? "").length + (percent ? 2 : 0);
  const p = 10 ** places;
  const m = Math.round(v * p);
  const r = frac(m, p);
  const b = board();
  const showDe = decStr(shown, "de");
  if (percent) {
    put(b, bi(`${showDe}#q %#pc`), tx("Per cent means hundredths.", "Prozent heißt Hundertstel."), { highlight: ["pc"] });
    if (places === 2) put(b, bi(`${showDe}#q %#pc =#e \\frac{${m}#an}{${p}#ad}#af`), tx(`$${decStr(shown, "en")}\\,\\% = \\frac{${m}}{100}$.`, `$${showDe}\\,\\% = \\frac{${m}}{100}$.`));
    else {
      put(
        b,
        bi(`${showDe}#q %#pc =#e \\frac{${showDe}#an}{100#ad}#af`),
        tx(`$${decStr(shown, "en")}\\,\\% = \\frac{${decStr(shown, "en")}}{100}$. A decimal in the numerator? Expand by $10$.`, `$${showDe}\\,\\% = \\frac{${showDe}}{100}$. Eine Kommazahl im Zähler? Erweitere mit $10$.`),
      );
      put(b, bi(`${showDe}#q %#pc =#e \\frac{${m}#an}{${p}#ad}#af`), tx(`$\\frac{${m}}{${p}}$: no comma left.`, `$\\frac{${m}}{${p}}$: Jetzt ohne Komma.`));
    }
    b.pre = bi(`${showDe}#q %#pc =#e `).de;
  } else {
    put(
      b,
      bi(`${decStr(v, "de")}#q`),
      tx(`Read the places: the last digit is in the ${PLACE[p]?.[0] ?? "thousandths"} place.`, `Lies die Stellen: Die letzte Ziffer steht bei den ${PLACE[p]?.[1] ?? "Tausendsteln"}.`),
    );
    put(b, bi(`${decStr(v, "de")}#q =#e \\frac{${m}#an}{${p}#ad}#af`), tx(`$${decStr(v, "en")} = \\frac{${m}}{${p}}$.`, `$${decStr(v, "de")} = \\frac{${m}}{${p}}$.`));
    b.pre = bi(`${decStr(v, "de")}#q =#e `).de;
  }
  // The board helpers write German decimals; build the English frames from them.
  const preDe = b.pre;
  simplify(b, kf(m, p, "a"));
  b.pre = "";
  const frames = b.frames.map((f) => (typeof f.math === "string" && preDe && f.math.startsWith(preDe) ? { ...f, math: bi(f.math) } : f));
  finish(frames, r);
  const answer = answerOf(r);
  // Typical slips: wrong place value, or the comma read as a fraction bar.
  const digits = String(shown).replace(".", "");
  const twoDigits = !percent && v < 1 && digits.length === 3 && digits[0] === "0" && digits[2] !== "0";
  return {
    instruction: WRITE_FRACTION,
    math: bi(percent ? `${showDe} %` : decStr(v, "de")),
    answer,
    hint: percent
      ? tx("Per cent means hundredths: write it over $100$, then simplify.", "Prozent heißt Hundertstel: Schreib es über $100$ und kürze dann.")
      : tx("Which place does the last digit stand in? Tenths, hundredths or thousandths? Then simplify.", "An welcher Stelle steht die letzte Ziffer? Zehntel, Hundertstel oder Tausendstel? Dann kürzen."),
    solution: frames,
    mistakes: mistakesFor(answer, [
      {
        v: fv(m, p / 10),
        title: tx("One place too few", "Eine Stelle zu wenig"),
        say: percent
          ? tx("Per cent means **hundredths**, not tenths: write it over $100$.", "Prozent heißt **Hundertstel**, nicht Zehntel: Schreib es über $100$.")
          : tx(
              `Count the places again: $${decStr(v, "en")}$ has ${places} decimal place${places > 1 ? "s" : ""}, so the denominator is $${p}$.`,
              `Zähl die Stellen noch mal: $${decStr(v, "de")}$ hat ${places} Nachkommastelle${places > 1 ? "n" : ""}, also ist der Nenner $${p}$.`,
            ),
      },
      !percent && {
        v: fv(m, p * 10),
        title: tx("One place too many", "Eine Stelle zu viel"),
        say: tx(
          `Count the places again: $${decStr(v, "en")}$ has ${places} decimal place${places > 1 ? "s" : ""}, so the denominator is $${p}$.`,
          `Zähl die Stellen noch mal: $${decStr(v, "de")}$ hat ${places} Nachkommastelle${places > 1 ? "n" : ""}, also ist der Nenner $${p}$.`,
        ),
      },
      twoDigits && {
        v: fv(Number(digits[1]), Number(digits[2])),
        title: tx("Comma read as a fraction bar", "Komma als Bruchstrich gelesen"),
        say: tx(
          `Ooh, tempting! But the digits after the comma aren't numerator and denominator. $${decStr(v, "en")}$ means $${m}$ ${PLACE[p][0]}.`,
          `Ooh, verlockend! Die Ziffern nach dem Komma sind aber nicht Zähler und Nenner. $${decStr(v, "de")}$ heißt $${m}$ ${PLACE[p][1]}.`,
        ),
      },
      percent &&
        Number.isInteger(shown) && {
          v: fv(1, shown),
          title: tx("Percentage as the denominator", "Prozentsatz als Nenner"),
          say: tx(
            `Careful: $${shown}\\,\\%$ isn't $\\frac{1}{${shown}}$. It means $${shown}$ hundredths: $\\frac{${shown}}{100}$.`,
            `Vorsicht: $${shown}\\,\\%$ ist nicht $\\frac{1}{${shown}}$. Es heißt $${shown}$ Hundertstel: $\\frac{${shown}}{100}$.`,
          ),
        },
    ]),
  };
}

function fromDecimalTask(rng: Rng): Exercise | null {
  const d = rng.pick([2, 4, 5, 8, 10, 20, 25, 40, 50]);
  const n = rng.chance(0.2) ? coprime(rng, d, d + 1, 2 * d - 1) : coprime(rng, d, 1, d - 1);
  if (n === null || d === 2 || (d === 10 && rng.chance(0.5))) return null;
  return fromDecimalExercise(n / d, false);
}

const PERCENTS = [5, 15, 35, 45, 55, 65, 85, 95, 12.5, 37.5, 62.5, 87.5, 2.5, 7.5, 120, 125, 150, 175, 60, 80, 24, 36, 64, 16];
function fromPercentTask(rng: Rng): Exercise | null {
  return fromDecimalExercise(rng.pick(PERCENTS) / 100, true);
}

// ---------------------------------------------------------------------------
// Repeating decimals → fraction (the 10x trick)

type Periodic = { int: number; pre: string; period: string };

/** Frames and value for a repeating decimal int,pre(period). */
function periodicFrames(P: Periodic): { frames: Frame[]; value: Frac; raw: Frac } {
  const m = P.pre.length;
  const k = P.period.length;
  const big = 10 ** (m + k);
  const small = 10 ** m;
  const nBig = Number(`${P.int}${P.pre}${P.period}`);
  const nSmall = Number(`${P.int}${P.pre}`);
  const raw = { n: nBig - nSmall, d: big - small };
  const value = frac(raw.n, raw.d);
  const line = (factor: number, shift: number, key: string, l: "en" | "de") => {
    // factor · x = the number with the comma moved `shift` places to the right.
    const all = `${P.int}${P.pre}${P.period.repeat(4)}`;
    const head = String(Number(all.slice(0, String(P.int).length + shift)));
    const tail = all.slice(String(P.int).length + shift);
    const shownTail = tail.slice(0, Math.max(0, m - shift) + (k === 1 ? 3 : k * 2));
    const left = factor === 1 ? `x#${key}x` : `${factor}#${key}k x#${key}x`;
    return `${left} =#${key}e ${head}${l === "de" ? "," : "."}${shownTail}#${key}v …#${key}dots`;
  };
  const both = (build: (l: "en" | "de") => string): Text => ({ en: build("en"), de: build("de") });
  const frames: Frame[] = [];
  const name = both((l) => line(1, 0, "a", l));
  frames.push({
    math: name,
    note: tx(
      `Call the number $x$. The period is $${P.period}$ (${k} digit${k > 1 ? "s" : ""})${m ? `, and before it comes the digit${m > 1 ? "s" : ""} $${P.pre}$` : ""}.`,
      `Nenn die Zahl $x$. Die Periode ist $${P.period}$ (${k === 1 ? "eine Ziffer" : `${k} Ziffern`})${m ? `, davor ${m === 1 ? "steht die Ziffer" : "stehen die Ziffern"} $${P.pre}$` : ""}.`,
    ),
  });
  const two = both((l) => `${line(big, m + k, "b", l)} \\\\ ${line(small, m, "a", l)}`);
  frames.push({
    math: two,
    note:
      m === 0
        ? tx(
            `Multiply by $${big}$: the comma moves ${k} place${k > 1 ? "s" : ""} to the right. Behind the comma it looks exactly the same.`,
            `Mal $${big}$: Das Komma rutscht um ${k === 1 ? "eine Stelle" : `${k} Stellen`} nach rechts. Hinter dem Komma sieht alles genauso aus.`,
          )
        : tx(
            `Move the comma behind the period ($\\cdot ${big}$) and in front of the period ($\\cdot ${small}$). Behind the comma, both lines look the same.`,
            `Verschieb das Komma einmal hinter die Periode ($\\cdot ${big}$) und einmal vor die Periode ($\\cdot ${small}$). Hinter dem Komma sehen beide Zeilen gleich aus.`,
          ),
    highlight: ["bv", "av"],
  });
  frames.push({
    math: `${big - small}#bk x#bx =#be ${raw.n}#bv`,
    note: tx(
      `Subtract the lower line from the upper one: the endless tails cancel out. $${big}x - ${small === 1 ? "" : small}x = ${big - small}x$ and $${nBig} - ${nSmall} = ${raw.n}$.`,
      `Zieh die untere Zeile von der oberen ab: Die endlosen Schwänze heben sich weg. $${big}x - ${small === 1 ? "" : small}x = ${big - small}x$ und $${nBig} - ${nSmall} = ${raw.n}$.`,
    ),
  });
  const b: Board = { frames, pre: "x#bx =#be ", post: "" };
  put(b, `\\frac{${raw.n}#bv}{${raw.d}#bk}#bf`, tx(`Divide by $${raw.d}$.`, `Teile durch $${raw.d}$.`));
  simplify(b, { n: raw.n, d: raw.d, kn: "bv", kd: "bk", kf: "bf" });
  return { frames: b.frames, value, raw };
}

const PERIODICS: Periodic[] = [
  ...[1, 2, 4, 5, 7, 8].map((a) => ({ int: 0, pre: "", period: String(a) })),
  ...[3, 6].map((a) => ({ int: 0, pre: "", period: String(a) })),
  ...["09", "18", "27", "36", "45", "54", "63", "72", "81", "12", "15", "21", "24", "42", "57", "13", "37"].map((p) => ({ int: 0, pre: "", period: p })),
  ...[
    [1, "3"],
    [1, "6"],
    [2, "3"],
    [2, "5"],
    [1, "2"],
    [3, "1"],
  ].map(([i, p]) => ({ int: i as number, pre: "", period: p as string })),
  ...["16", "83", "13", "23", "46", "86", "03", "41", "38"].map((x) => ({ int: 0, pre: x[0], period: x[1] })),
];

function periodicExercise(P: Periodic): Exercise {
  const { frames, value } = periodicFrames(P);
  const m = P.pre.length;
  const k = P.period.length;
  const digits = `${P.pre}${P.period}`;
  const answer = answerOf(value);
  const cut = frac(Number(`${P.int}${digits}`), 10 ** (m + k));
  return {
    instruction: WRITE_FRACTION,
    text: tx("This decimal repeats forever. Write it as a fully simplified fraction.", "Diese Dezimalzahl ist periodisch. Schreib sie als vollständig gekürzten Bruch."),
    visual: visual(FractionsPeriodicPicture, { int: String(P.int), pre: P.pre, period: P.period }),
    answer,
    hint:
      m === 0
        ? tx(
            `Call it $x$ and multiply by $${10 ** k}$: the comma moves past one period. Then subtract $x$.`,
            `Nenn die Zahl $x$ und nimm sie mal $${10 ** k}$: Das Komma rutscht über eine Periode. Dann zieh $x$ ab.`,
          )
        : tx(
            `Call it $x$. Move the comma behind the period ($\\cdot ${10 ** (m + k)}$) and in front of it ($\\cdot ${10 ** m}$), then subtract.`,
            `Nenn die Zahl $x$. Verschieb das Komma hinter die Periode ($\\cdot ${10 ** (m + k)}$) und davor ($\\cdot ${10 ** m}$) und zieh dann ab.`,
          ),
    solution: frames,
    mistakes: mistakesFor(answer, [
      {
        v: cut,
        title: tx("The period ignored", "Periode übersehen"),
        say: tx(
          "Ah, you treated it like a terminating decimal. But the period goes on forever, so the number is a little bigger. Use the trick with $x$.",
          "Ah, du hast sie wie eine abbrechende Dezimalzahl behandelt. Aber die Periode geht endlos weiter, die Zahl ist also etwas größer. Nimm den Trick mit $x$.",
        ),
      },
      m > 0 && {
        v: frac(Number(`${P.int}${digits}`), 10 ** (m + k) - 1),
        title: tx("Treated the whole thing as the period", "Alles als Periode genommen"),
        say: tx(
          `Careful: only $${P.period}$ repeats, the $${P.pre}$ in front doesn't. Your fraction would be $0.${digits}${digits} …$. Also move the comma to just in front of the period, then subtract.`,
          `Vorsicht: Nur die $${P.period}$ wiederholt sich, die $${P.pre}$ davor nicht. Dein Bruch wäre $0,${digits}${digits} …$. Verschieb das Komma auch direkt vor die Periode und zieh dann ab.`,
        ),
      },
      m === 0 &&
        k === 2 &&
        P.int === 0 && {
          v: frac(Number(P.period), 90),
          title: tx("One nine too few", "Eine Neun zu wenig"),
          say: tx(
            `Nearly! A period of two digits goes over $99$, not $90$: $100x - x = 99x$.`,
            `Fast! Eine zweistellige Periode kommt über $99$, nicht über $90$: $100x - x = 99x$.`,
          ),
        },
    ]),
  };
}

function periodicTask(rng: Rng): Exercise | null {
  return periodicExercise(rng.pick(PERIODICS));
}

// ---------------------------------------------------------------------------
// Fraction → repeating decimal (choice)

type Opt = { text: Text; title?: Text; say?: Text };

/** Shuffles options; returns the answer and the mistakes of the wrong options. */
function choice(rng: Rng | null, right: Text, wrong: Opt[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const seen = new Set([E(right)]);
  const opts: Opt[] = [{ text: right }];
  for (const o of wrong) {
    if (seen.has(E(o.text)) || opts.length >= 4) continue;
    seen.add(E(o.text));
    opts.push(o);
  }
  const order = rng ? rng.shuffle(opts) : opts;
  const options = order.map((o) => o.text);
  const correct = order.findIndex((o) => o === opts[0]);
  const mistakes: Mistake[] = [];
  order.forEach((o, i) => {
    if (i !== correct && o.say) mistakes.push({ when: { kind: "choice", options, correct: i }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

const asOpt = (t: Text): Text => txMap((_, l) => `$${resolveText(t, l)}$`);

function toPeriodicTask(rng: Rng): Exercise | null {
  const d = rng.pick([3, 6, 9, 11, 12, 15, 18, 30, 33]);
  const n = coprime(rng, d, 1, d - 1);
  if (n === null || terminates(n, d)) return null;
  const p = periodOf(n, d);
  if (p.period.length > 2) return null;
  const right = asOpt(fracDots(n, d));
  const wrong: Opt[] = [];
  if (n < 10)
    wrong.push({
      text: asOpt(dec(Number(`0.${n}${d}`))),
      title: tx("Fraction bar read as a comma", "Bruchstrich als Komma gelesen"),
      say: tx(`The fraction bar isn't a comma: $\\frac{${n}}{${d}}$ means $${n} : ${d}$.`, `Der Bruchstrich ist kein Komma: $\\frac{${n}}{${d}}$ heißt $${n} : ${d}$.`),
    });
  wrong.push({
    text: asOpt(dec(Number(`${p.int}.${p.pre}${p.period}`))),
    title: tx("Stopped too early", "Zu früh aufgehört"),
    say: tx(
      `That's only the start. $${n} : ${d}$ never ends: a remainder keeps coming back, so the digits repeat forever.`,
      `Das ist nur der Anfang. $${n} : ${d}$ geht nie auf: Ein Rest kommt immer wieder, also wiederholen sich die Ziffern endlos.`,
    ),
  });
  if (p.pre)
    wrong.push({
      text: asOpt(txMap((_, l) => dotsSrc(String(p.int), "", p.pre + p.period, l))),
      title: tx("Wrong period", "Falsche Periode"),
      say: tx(
        `Close! But only $${p.period}$ repeats. Divide by hand and watch which remainder comes back.`,
        `Knapp! Aber nur die $${p.period}$ wiederholt sich. Teil schriftlich und schau, welcher Rest wiederkommt.`,
      ),
    });
  if (n > 1 && !terminates(1, d)) {
    const q = periodOf(1, d);
    if (q.period.length <= 2)
      wrong.push({
        text: asOpt(fracDots(1, d)),
        title: tx("That's one part", "Das ist ein Teil"),
        say: tx(`That's $\\frac{1}{${d}}$. You need $${n}$ of these parts: work out $${n} : ${d}$.`, `Das ist $\\frac{1}{${d}}$. Du brauchst $${n}$ solche Teile: Rechne $${n} : ${d}$.`),
      });
  }
  if (terminates(d, n) || periodOf(d, n).period.length <= 2)
    wrong.push({
      text: asOpt(fracDots(d, n)),
      title: tx("Divided the wrong way round", "Andersherum geteilt"),
      say: tx(`That's $${d} : ${n}$. A fraction is numerator divided by denominator: $${n} : ${d}$.`, `Das ist $${d} : ${n}$. Ein Bruch ist Zähler geteilt durch Nenner: $${n} : ${d}$.`),
    });
  const c = choice(rng, right, wrong);
  if (c.answer.kind !== "choice" || c.answer.options.length < 3) return null;
  const b = board();
  put(b, `\\frac{${n}#n}{${d}#d}#f =#e ${n}#n2 :#dv ${d}#d2`, tx("A fraction is a division: numerator divided by denominator.", "Ein Bruch ist eine Division: Zähler geteilt durch Nenner."));
  b.frames.push({
    math: txMap((_, l) => `\\frac{${n}#n}{${d}#d}#f =#e ${resolveText(fracDots(n, d, "v"), l)}`),
    note: tx(
      `Dividing by hand, a remainder comes back, so the digits repeat: the period is $${p.period}$${p.pre ? ` (with $${p.pre}$ in front)` : ""}.`,
      `Beim schriftlichen Teilen kommt ein Rest wieder, also wiederholen sich die Ziffern: Die Periode ist $${p.period}$${p.pre ? ` (davor steht $${p.pre}$)` : ""}.`,
    ),
  });
  return {
    instruction: tx("Which decimal is it?", "Welche Dezimalzahl ist es?"),
    math: `\\frac{${n}}{${d}}`,
    answer: c.answer,
    hint: tx(`Work out $${n} : ${d}$ by hand. Does a remainder come back?`, `Rechne $${n} : ${d}$ schriftlich. Kommt ein Rest wieder?`),
    solution: b.frames,
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Which fractions terminate? (select all)

function terminatingTask(rng: Rng): Exercise | null {
  const pool: [number, number][] = [
    [3, 12],
    [6, 15],
    [7, 14],
    [9, 24],
    [14, 35],
    [3, 30],
    [21, 28],
    [5, 12],
    [7, 15],
    [2, 9],
    [5, 6],
    [4, 11],
    [7, 20],
    [3, 8],
    [11, 40],
    [1, 7],
    [10, 12],
    [9, 45],
    [4, 18],
    [5, 22],
  ];
  const picked = rng.shuffle(pool).slice(0, 5);
  const ok = picked.map(([n, d]) => terminates(n, d));
  const byRaw = picked.map(([, d]) => terminates(1, d));
  if (!ok.some(Boolean) || ok.every(Boolean) || ok.every((x, i) => x === byRaw[i])) return null;
  const options: Text[] = picked.map(([n, d]) => `$\\frac{${n}}{${d}}$`);
  const correct = ok.flatMap((x, i) => (x ? [i] : []));
  const raw = byRaw.flatMap((x, i) => (x ? [i] : []));
  const inverse = ok.flatMap((x, i) => (x ? [] : [i]));
  const frames: Frame[] = picked.map(([n, d]) => {
    const r = frac(n, d);
    const pf = primeFactors(r.d);
    const fs = pf.length > 1 ? ` = ${pf.join(" \\cdot ")}` : "";
    const other = pf.find((q) => q !== 2 && q !== 5);
    return {
      math: r.d === d ? `\\frac{${n}}{${d}}` : `\\frac{${n}}{${d}} = \\frac{${r.n}}{${r.d}}`,
      note: !other
        ? tx(`${r.d === d ? "Denominator" : "Simplified denominator"} $${r.d}${fs}$: only 2s and 5s, so it **terminates**.`, `${r.d === d ? "Nenner" : "Gekürzter Nenner"} $${r.d}${fs}$: nur Zweien und Fünfen, also **abbrechend**.`)
        : tx(
            `${r.d === d ? "Denominator" : "Simplified denominator"} $${r.d}${fs}$: the prime factor $${other}$ makes it **repeat**.`,
            `${r.d === d ? "Nenner" : "Gekürzter Nenner"} $${r.d}${fs}$: Der Primfaktor $${other}$ macht ihn **periodisch**.`,
          ),
    };
  });
  frames.unshift({
    math: picked.map(([n, d]) => `\\frac{${n}}{${d}}`).join(" \\quad "),
    note: tx(
      "Simplify each fraction first. Then look at the prime factors of the denominator: only 2s and 5s means it terminates.",
      "Kürze zuerst jeden Bruch. Dann schau auf die Primfaktoren des Nenners: nur Zweien und Fünfen heißt abbrechend.",
    ),
  });
  const mistakes: Mistake[] = [];
  const add2 = (idx: number[], title: Text, say: Text) => {
    if (!idx.length || JSON.stringify(idx) === JSON.stringify(correct) || mistakes.some((m) => m.when.kind === "multi" && JSON.stringify(m.when.correct) === JSON.stringify(idx))) return;
    mistakes.push({ when: { kind: "multi", options, correct: idx }, title, say });
  };
  const trapIdx = ok.findIndex((x, i) => x !== byRaw[i]);
  const [tn, td] = picked[trapIdx];
  const tr = frac(tn, td);
  add2(
    raw,
    tx("Simplify first", "Erst kürzen"),
    tx(
      `Ah, you looked at the denominators before simplifying! $\\frac{${tn}}{${td}} = \\frac{${tr.n}}{${tr.d}}$, and that ${terminates(tn, td) ? "terminates" : "repeats"}. Always simplify first.`,
      `Ah, du hast auf die Nenner vor dem Kürzen geschaut! $\\frac{${tn}}{${td}} = \\frac{${tr.n}}{${tr.d}}$, und das ist ${terminates(tn, td) ? "abbrechend" : "periodisch"}. Immer zuerst kürzen.`,
    ),
  );
  add2(
    inverse,
    tx("The repeating ones", "Die periodischen erwischt"),
    tx("You picked exactly the **repeating** ones. The question asks for the ones that terminate.", "Du hast genau die **periodischen** angekreuzt. Gefragt sind die abbrechenden."),
  );
  return {
    instruction: tx("Select all that terminate", "Kreuze alle abbrechenden an"),
    text: tx("Which of these fractions give a **terminating** decimal?", "Welche dieser Brüche ergeben eine **abbrechende** Dezimalzahl?"),
    answer: { kind: "multi", options, correct },
    hint: tx("Simplify first. Then: does the denominator have prime factors other than 2 and 5?", "Kürze zuerst. Dann: Hat der Nenner andere Primfaktoren als 2 und 5?"),
    solution: frames,
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Comparing (choice <, =, >)

/** A number to compare or order: its value, how it is written, and the exact fraction (null for a decimal). */
type Num = { v: number; src: Text; f: Frac | null };
const fracNum = (n: number, d: number): Num => ({ v: n / d, src: sfr(frac(n, d)), f: frac(n, d) });
const decNum = (v: number): Num => ({ v, src: dec(v), f: null });

/** A number as a decimal in one language; repeating decimals with dots. */
function decOf(x: Num, l: "en" | "de"): string {
  if (!x.f || terminates(Math.abs(x.f.n), x.f.d)) return decStr(x.v, l);
  return `${x.f.n < 0 ? "-" : ""}${resolveText(fracDots(Math.abs(x.f.n), x.f.d), l)}`;
}
const relOptions = (A: Num, B: Num): Text[] => ["<", "=", ">"].map((op) => txMap((_, l) => `$${resolveText(A.src, l)} ${op} ${resolveText(B.src, l)}$`));

function compareTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["sameNum", "diff", "fracDec", "neg", "negMixed", "dec", "equal", "diff", "neg"] as const);
  let A: Num;
  let B: Num;
  let trap: number | null = null; // index of the tempting wrong relation
  let trapTitle: Text = "";
  let trapSay: Text = "";
  const dens = [3, 4, 5, 6, 7, 8, 9, 10, 12];
  const proper = (d: number) => coprime(rng, d, 1, d - 1);
  const rel = (a: number, b: number) => (Math.abs(a - b) < 1e-12 ? 1 : a < b ? 0 : 2);
  if (kind === "sameNum") {
    const [d1, d2] = rng.shuffle(dens).slice(0, 2);
    const n = rng.int(1, Math.min(d1, d2) - 1);
    if (gcd(n, d1) > 1 || gcd(n, d2) > 1) return null;
    A = fracNum(n, d1);
    B = fracNum(n, d2);
    trap = rel(d1, d2);
    trapTitle = tx("Bigger denominator, bigger fraction?", "Größerer Nenner, größerer Bruch?");
    trapSay = tx(
      `Careful! The denominator says how many pieces the whole is cut into. More pieces means **smaller** pieces: $\\frac{${n}}{${Math.max(d1, d2)}}$ is less than $\\frac{${n}}{${Math.min(d1, d2)}}$.`,
      `Vorsicht! Der Nenner sagt, in wie viele Stücke das Ganze geteilt wird. Mehr Stücke heißt **kleinere** Stücke: $\\frac{${n}}{${Math.max(d1, d2)}}$ ist weniger als $\\frac{${n}}{${Math.min(d1, d2)}}$.`,
    );
  } else if (kind === "diff" || kind === "neg") {
    const [d1, d2] = rng.shuffle(dens).slice(0, 2);
    const n1 = proper(d1);
    const n2 = proper(d2);
    if (n1 === null || n2 === null || n1 * d2 === n2 * d1 || lcm(d1, d2) > 40) return null;
    const s = kind === "neg" ? -1 : 1;
    A = fracNum(s * n1, d1);
    B = fracNum(s * n2, d2);
    if (kind === "neg") {
      trap = rel(-A.v, -B.v);
      trapTitle = tx("Compared without the minus", "Ohne Minus verglichen");
      trapSay = tx(
        "Ooh, classic trap! Without the minus signs your answer would be right. But negative numbers are mirrored: the one further from $0$ is further **left**, so it's smaller.",
        "Die klassische Falle! Ohne Minuszeichen würde deine Antwort stimmen. Negative Zahlen sind aber gespiegelt: Die weiter von $0$ entfernte liegt weiter **links**, ist also kleiner.",
      );
    } else if (rel(n1, n2) !== rel(A.v, B.v)) {
      trap = rel(n1, n2);
      trapTitle = tx("Only the numerators compared", "Nur die Zähler verglichen");
      trapSay = tx(
        "You compared the numerators only. But the pieces have different sizes! Make the denominators the same first (or turn both into decimals).",
        "Du hast nur die Zähler verglichen. Die Stücke sind aber verschieden groß! Mach zuerst die Nenner gleich (oder rechne beide in Dezimalzahlen um).",
      );
    }
  } else if (kind === "fracDec" || kind === "negMixed") {
    const d = rng.pick([3, 4, 5, 6, 8, 9]);
    const n = proper(d);
    if (n === null) return null;
    const near = Math.round((n / d) * 10 + rng.pick([-1, 1]) * (rng.chance(0.5) ? 0.5 : 1)) / 10;
    if (near <= 0 || near >= 1 || Math.abs(near - n / d) < 1e-9) return null;
    const s = kind === "negMixed" ? -1 : 1;
    A = fracNum(s * n, d);
    B = decNum(s * near);
    if (rng.chance(0.5)) [A, B] = [B, A];
    if (s < 0) {
      trap = rel(-A.v, -B.v);
      trapTitle = tx("Compared without the minus", "Ohne Minus verglichen");
      trapSay = tx(
        "Ooh, classic trap! Without the minus signs your answer would be right. But on the left of $0$ it's the other way round: further from $0$ means smaller.",
        "Die klassische Falle! Ohne Minuszeichen würde deine Antwort stimmen. Links von der $0$ ist es aber andersherum: weiter weg von $0$ heißt kleiner.",
      );
    }
  } else if (kind === "dec") {
    const a = rng.int(2, 8) / 10;
    const b = r6(a - rng.int(1, 9) / 100 - (rng.chance(0.4) ? 0.1 : 0));
    if (b <= 0 || Number.isInteger(b * 10)) return null;
    A = decNum(a);
    B = decNum(b);
    if (rng.chance(0.5)) [A, B] = [B, A];
    trap = rel(-A.v, -B.v);
    trapTitle = tx("More digits, bigger number?", "Mehr Ziffern, größere Zahl?");
    trapSay = tx(
      `Careful: more digits don't make a decimal bigger. Compare place by place: tenths first. Fill up with a zero if it helps: $${decStr(a, "en")} = ${decStr(a, "en")}0$.`,
      `Vorsicht: Mehr Ziffern machen eine Dezimalzahl nicht größer. Vergleich Stelle für Stelle, zuerst die Zehntel. Füll notfalls mit einer Null auf: $${decStr(a, "de")} = ${decStr(a, "de")}0$.`,
    );
  } else {
    const d = rng.pick([4, 5, 8, 20, 25]);
    const n = proper(d);
    const k = rng.int(2, 4);
    if (n === null) return null;
    A = { v: n / d, src: fr(n * k, d * k), f: frac(n, d) };
    B = decNum(n / d);
    if (rng.chance(0.5)) [A, B] = [B, A];
  }
  const right = rel(A.v, B.v);
  const options = relOptions(A, B);
  const mistakes: Mistake[] = [];
  if (trap !== null && trap !== right) mistakes.push({ when: { kind: "choice", options, correct: trap }, title: trapTitle, say: trapSay });
  // Frames: both as fractions with the same denominator, or both as decimals.
  const frames: Frame[] = [];
  const aSrc = (l: "en" | "de") => resolveText(A.src, l);
  const bSrc = (l: "en" | "de") => resolveText(B.src, l);
  const relSym = ["<", "=", ">"][right];
  const pair = (a: string, b: string, r = "\\quad") => `${keyTokens(a, "a")} ${r === "\\quad" ? r : `${r}#r`} ${keyTokens(b, "b")}`;
  frames.push({ math: txMap((_, l) => pair(aSrc(l), bSrc(l))), note: tx("Which number is bigger?", "Welche Zahl ist größer?") });
  if (A.f && B.f && E(A.src).includes("frac") && E(B.src).includes("frac")) {
    const fa = A.f;
    const fb = B.f;
    const L = lcm(fa.d, fb.d);
    const ea = (fa.n * L) / fa.d;
    const eb = (fb.n * L) / fb.d;
    const ex = sfr({ n: ea, d: L });
    const eb2 = sfr({ n: eb, d: L });
    frames.push({ math: pair(ex, eb2), note: tx(`Same denominator $${L}$: now compare the numerators.`, `Gleicher Nenner $${L}$: Jetzt vergleichst du die Zähler.`) });
    frames.push({
      math: pair(ex, eb2, relSym),
      note:
        ea < 0
          ? tx(`$${ea} ${relSym} ${eb}$: with negative numbers, further left is smaller.`, `$${ea} ${relSym} ${eb}$: Bei negativen Zahlen ist weiter links kleiner.`)
          : tx(`$${ea} ${relSym} ${eb}$: same-sized pieces, so just count.`, `$${ea} ${relSym} ${eb}$: Gleich große Stücke, also einfach zählen.`),
    });
  } else {
    // Terminating decimals get the same number of places (0,3 → 0,30) so they can be compared digit by digit.
    const places = (x: Num) => (x.f && !terminates(Math.abs(x.f.n), x.f.d) ? 0 : (String(r6(x.v)).split(".")[1] ?? "").length);
    const pl = Math.max(places(A), places(B));
    const padded = (x: Num, l: "en" | "de") => {
      const p0 = places(x);
      if (x.f && !terminates(Math.abs(x.f.n), x.f.d)) return decOf(x, l);
      const t = decStr(x.v, l);
      return p0 < pl ? `${t}${p0 === 0 ? (l === "de" ? "," : ".") : ""}${"0".repeat(pl - p0)}` : t;
    };
    frames.push({
      math: txMap((_, l) => pair(padded(A, l), padded(B, l))),
      note: tx("Write both as decimals with the same number of places. Then compare place by place.", "Schreib beide als Dezimalzahlen mit gleich vielen Stellen. Dann vergleichst du Stelle für Stelle."),
    });
    frames.push({
      math: txMap((_, l) => pair(padded(A, l), padded(B, l), relSym)),
      note: A.v < 0 && B.v < 0 ? tx("Negative numbers: the one further left is smaller.", "Negative Zahlen: Die weiter links liegende ist kleiner.") : tx("Tenths first, then hundredths.", "Erst die Zehntel, dann die Hundertstel."),
    });
  }
  frames.push({ math: txMap((_, l) => pair(aSrc(l), bSrc(l), relSym)), note: tx(`So the sign is $${relSym}$.`, `Das Zeichen ist also $${relSym}$.`) });
  return {
    instruction: tx("Compare", "Vergleiche"),
    text: tx("Which sign is right: $<$, $=$ or $>$?", "Welches Zeichen stimmt: $<$, $=$ oder $>$?"),
    math: txMap((_, l) => `${aSrc(l)} \\quad \\box{?} \\quad ${bSrc(l)}`),
    answer: { kind: "choice", options, correct: right },
    hint: tx("Same denominator, or both as decimals. And for negative numbers: further left is smaller.", "Gleicher Nenner oder beide als Dezimalzahl. Und bei negativen Zahlen: weiter links ist kleiner."),
    solution: frames,
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Ordering (order task)

type Item = Num & { key: string };

/** Gives the tokens of a simple number (−3/4, 1 1/3, 0,45, 0,333 …) fixed keys, so it can glide as a whole. */
function keyTokens(body: string, key: string): string {
  let s = body.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, `\\frac{$1#${key}n}{$2#${key}d}#${key}f`);
  s = s.replace(/^-/, `-#${key}s `);
  s = s.replace(/^((?:-#\S+ )?)(\d+)\\frac/, (_, neg: string, w: string) => `${neg}${w}#${key}w \\frac`);
  s = s.replace(/^((?:-#\S+ )?)(\d+(?:[.,]\d+)?)(?= |$)/, (_, neg: string, num: string) => `${neg}${num}#${key}v`);
  return s.replace(/…/, `…#${key}e`);
}

function orderExercise(items: Item[], traps: { a: Item; b: Item; title: Text; say: Text }[]): Exercise {
  const sorted = [...items].sort((x, y) => x.v - y.v);
  const opt = (it: Item) => txMap((_, l) => `$${resolveText(it.src, l)}$`);
  const keyed = (it: Item, l: "en" | "de", what: "src" | "dec") => keyTokens(what === "src" ? resolveText(it.src, l) : decOf(it, l), it.key);
  const frames: Frame[] = [
    {
      math: txMap((_, l) => items.map((it) => keyed(it, l, "src")).join(" \\quad ")),
      note: tx("Turn everything into decimals: then you can compare place by place.", "Schreib alles als Dezimalzahl: Dann kannst du Stelle für Stelle vergleichen."),
    },
    {
      math: txMap((_, l) => items.map((it) => keyed(it, l, "dec")).join(" \\quad ")),
      note: tx("Negative numbers first. Among them, the one furthest from $0$ is the smallest.", "Zuerst die negativen Zahlen. Unter ihnen ist die am weitesten von $0$ entfernte die kleinste."),
    },
    {
      math: txMap((_, l) => sorted.map((it) => keyed(it, l, "dec")).join(" < ")),
      note: tx("Sorted from smallest to largest.", "Vom kleinsten zum größten sortiert."),
    },
    {
      math: txMap((_, l) => sorted.map((it) => keyed(it, l, "src")).join(" < ")),
      note: tx("And in the original form.", "Und in der ursprünglichen Form."),
    },
  ];
  return {
    instruction: tx("Order the numbers", "Ordne die Zahlen"),
    text: tx("Put the numbers in order, **smallest first**.", "Bring die Zahlen in die richtige Reihenfolge, **die kleinste zuerst**."),
    answer: { kind: "order", items: sorted.map(opt), label: tx("Smallest at the top", "Die kleinste nach oben") },
    hint: tx("Write them all as decimals. Negative numbers come first, and $-0{,}8$ is smaller than $-0{,}7$.", "Schreib alle als Dezimalzahlen. Negative Zahlen kommen zuerst, und $-0,8$ ist kleiner als $-0,7$."),
    solution: frames,
    mistakes: traps.map((t) => ({ when: { kind: "order" as const, items: [opt(t.a), opt(t.b)] }, title: t.title, say: t.say })),
  };
}

const NEG_TRAP = {
  title: tx("Negatives the wrong way round", "Negative andersherum"),
  say: tx(
    "Ooh, classic trap! Among negative numbers, the one that looks bigger without its minus is the **smaller** one: it lies further left.",
    "Die klassische Falle! Bei negativen Zahlen ist die, die ohne Minus größer aussieht, die **kleinere**: Sie liegt weiter links.",
  ),
};
/** a has fewer digits but is bigger than b (0,5 and 0,45). */
const decTrap = (a: number, b: number) => ({
  title: tx("More digits, bigger number?", "Mehr Ziffern, größere Zahl?"),
  say: tx(
    `Careful: a decimal with more digits isn't automatically bigger. Compare the tenths first: $${decStr(a, "en")} = ${decStr(a, "en")}0 > ${decStr(b, "en")}$.`,
    `Vorsicht: Eine Dezimalzahl mit mehr Ziffern ist nicht automatisch größer. Vergleich zuerst die Zehntel: $${decStr(a, "de")} = ${decStr(a, "de")}0 > ${decStr(b, "de")}$.`,
  ),
});
const DEN_TRAP = {
  title: tx("Bigger denominator, bigger fraction?", "Größerer Nenner, größerer Bruch?"),
  say: tx(
    "With the same numerator, the bigger denominator means smaller pieces, so the fraction is **smaller**.",
    "Bei gleichem Zähler heißt ein größerer Nenner kleinere Stücke, der Bruch ist also **kleiner**.",
  ),
};

function orderNumbersTask(rng: Rng): Exercise | null {
  const items: Item[] = [];
  const traps: { a: Item; b: Item; title: Text; say: Text }[] = [];
  let key = 0;
  const mk = (v: number, s: Text, f: Frac | null = null): Item => ({ v, src: s, f, key: `i${key++}` });
  // A negative pair: a fraction and a decimal close to it.
  const d = rng.pick([3, 4, 5, 6, 8]);
  const n = coprime(rng, d, 1, d - 1);
  if (n === null) return null;
  const negF = mk(-n / d, sfr(frac(-n, d)), frac(-n, d));
  const nd = r6(-(Math.round((n / d) * 10) / 10 + rng.pick([-0.1, 0.1])));
  if (nd >= 0 || nd <= -1 || Math.abs(nd + n / d) < 1e-9) return null;
  const negD = mk(nd, dec(nd));
  items.push(negF, negD);
  const [lo, hi] = negF.v < negD.v ? [negF, negD] : [negD, negF];
  traps.push({ a: hi, b: lo, ...NEG_TRAP });
  // A decimal pair with different lengths: 0,5 and 0,45.
  if (rng.chance(0.6)) {
    const a = rng.int(2, 8) / 10;
    const b = r6(a - rng.int(1, 9) / 100);
    const A = mk(a, dec(a));
    const B = mk(b, dec(b));
    items.push(A, B);
    traps.push({ a: A, b: B, ...decTrap(a, b) });
  } else {
    const [d1, d2] = rng.shuffle([3, 4, 5, 6, 7, 8]).slice(0, 2);
    const m = rng.int(1, Math.min(d1, d2) - 1);
    if (gcd(m, d1) > 1 || gcd(m, d2) > 1) return null;
    const A = mk(m / d1, fr(m, d1), frac(m, d1));
    const B = mk(m / d2, fr(m, d2), frac(m, d2));
    items.push(A, B);
    const [small, big] = A.v < B.v ? [A, B] : [B, A];
    traps.push({ a: big, b: small, ...DEN_TRAP });
  }
  if (rng.chance(0.5)) {
    const w = rng.int(1, 2);
    const dd = rng.pick([2, 3, 4]);
    items.push(mk(w + 1 / dd, `${w}\\frac{1}{${dd}}`, frac(w * dd + 1, dd)));
  }
  const vals = items.map((it) => it.v);
  if (new Set(vals.map((v) => Math.round(v * 1e6))).size !== vals.length) return null;
  return orderExercise(rng.shuffle(items), traps);
}

// ---------------------------------------------------------------------------
// Reading the number line

function lineTask(rng: Rng): Exercise | null {
  const from = rng.pick([-3, -2, -2, -1, -1, 0]);
  const to = from + 3;
  const d = rng.pick([2, 3, 4, 5, 6, 8, 10]);
  const k = rng.int(from * d + 1, to * d - 1);
  if (k % d === 0 || (k > 0 && rng.chance(0.6))) return null;
  const r = frac(k, d);
  const v = k / d;
  const whole = v < 0 ? Math.ceil(v) : Math.floor(v);
  const j = Math.abs(k - whole * d);
  const answer = answerOf(r);
  const b = board();
  b.frames.push({
    math: `1#one :#dv ${d}#d =#e \\frac{1#one2}{${d}#d2}#f`,
    note: tx(`Between two whole numbers there are ${d} equal steps. So one step is $\\frac{1}{${d}}$.`, `Zwischen zwei ganzen Zahlen liegen ${d} gleich große Abschnitte. Ein Abschnitt ist also $\\frac{1}{${d}}$.`),
  });
  const dir = v < 0 ? "-" : "+";
  b.frames.push({
    math: `${whole}#w ${dir}#s \\frac{${j}#j}{${d}#d2}#f`,
    note:
      v < 0
        ? tx(`The point is $${j}$ steps to the **left** of $${whole}$ (away from $0$).`, `Der Punkt liegt $${j}$ Abschnitte **links** von $${whole}$ (weg von der $0$).`)
        : tx(`The point is $${j}$ steps to the right of $${whole}$.`, `Der Punkt liegt $${j}$ Abschnitte rechts von $${whole}$.`),
  });
  b.frames.push({
    math: `${v < 0 ? "-#neg " : ""}\\frac{${Math.abs(k)}#j}{${d}#d2}#f`,
    note: tx(`Counted from $0$, that's $${Math.abs(k)}$ steps: $${sfr({ n: k, d })}$.`, `Von $0$ aus gezählt sind es $${Math.abs(k)}$ Abschnitte: $${sfr({ n: k, d })}$.`),
  });
  if (r.d !== d) {
    b.pre = v < 0 ? "-#neg " : "";
    simplify(b, { n: Math.abs(k), d, kn: "j", kd: "d2", kf: "f" });
    b.pre = "";
  }
  return {
    instruction: tx("Read the number line", "Lies am Zahlenstrahl ab"),
    text: tx("Which number is marked? Give it as a fully simplified fraction (with a minus sign if it's negative).", "Welche Zahl ist markiert? Gib sie als vollständig gekürzten Bruch an (mit Minus, wenn sie negativ ist)."),
    visual: visual(FractionsLinePicture, { from, to, d, n: k }),
    answer,
    hint: tx(`How many steps are there between $0$ and $1$? Count them from $0$ to the point.`, `Wie viele Abschnitte liegen zwischen $0$ und $1$? Zähl sie von $0$ bis zum Punkt.`),
    solution: b.frames,
    mistakes: mistakesFor(answer, [
      v < 0 && {
        v: fv(-k, d),
        title: tx("The minus is missing", "Das Minus fehlt"),
        say: tx("The point is to the **left** of $0$, so the number is negative.", "Der Punkt liegt **links** von der $0$, die Zahl ist also negativ."),
      },
      v < -1 && {
        v: fv(whole * d + j, d),
        title: tx("Counted the wrong way", "In die falsche Richtung gezählt"),
        say: tx(
          `I think you went from $${whole}$ to the right. But the point is on the side away from $0$: it's $${whole}$ **minus** $\\frac{${j}}{${d}}$.`,
          `Ich glaub, du bist von $${whole}$ aus nach rechts gegangen. Der Punkt liegt aber auf der Seite weg von der $0$: Es ist $${whole}$ **minus** $\\frac{${j}}{${d}}$.`,
        ),
      },
      d > 2 &&
        j < d - 1 && {
        v: fv(whole * (d - 1) + (v < 0 ? -j : j), d - 1),
        title: tx("Counted the lines, not the steps", "Striche statt Abschnitte gezählt"),
        say: tx(
          `Count the **steps** between two whole numbers, not the small lines: there are $${d}$ steps, so each is $\\frac{1}{${d}}$.`,
          `Zähl die **Abschnitte** zwischen zwei ganzen Zahlen, nicht die kleinen Striche: Es sind $${d}$ Abschnitte, jeder ist also $\\frac{1}{${d}}$.`,
        ),
      },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Order of operations with a negative fraction or a mixed number

/** X ± P where X may be negative (sign key `${X.kf}s`) and P is positive. Returns the result. */
function signedAddSub(b: Board, X: KF, xs: 1 | -1, P: KF, sign: 1 | -1, opKey: string): Frac {
  const op = sign > 0 ? "+" : "-";
  const sx = (body: string) => (xs < 0 ? `-#${X.kf}s ${body}` : body);
  const both = (x: KF, y: KF) => `${sx(src(x))} ${op}#${opKey} ${src(y)}`;
  let A = X;
  let B = P;
  if (B.d === 1 && A.d > 1) {
    B = { ...B, n: B.n * A.d, d: A.d, asFrac: true };
    put(b, both(A, B), tx(`Write $${P.n}$ as a fraction with the denominator $${A.d}$: $${P.n} = \\frac{${B.n}}{${A.d}}$.`, `Schreib $${P.n}$ als Bruch mit dem Nenner $${A.d}$: $${P.n} = \\frac{${B.n}}{${A.d}}$.`), { highlight: [B.kn, B.kd] });
  } else if (A.d !== B.d) {
    const L = lcm(A.d, B.d);
    put(b, both(A, B), lcdNote(A.d, B.d), { highlight: [A.kd, B.kd] });
    const ka = L / A.d;
    const kb = L / B.d;
    const ex = (f: KF, k: number) => (k === 1 ? src({ ...f, asFrac: true }) : `\\frac{${f.n}#${f.kn} \\cdot#${f.kf}p ${k}#${f.kf}k}{${f.d}#${f.kd} \\cdot#${f.kf}q ${k}#${f.kf}l}#${f.kf}`);
    put(b, `${sx(ex(A, ka))} ${op}#${opKey} ${ex(B, kb)}`, tx("Expand both fractions to the common denominator.", "Erweitere beide Brüche auf den Hauptnenner."), {
      highlight: [...(ka > 1 ? [`${A.kf}k`, `${A.kf}l`] : []), ...(kb > 1 ? [`${B.kf}k`, `${B.kf}l`] : [])],
    });
    A = { ...A, n: A.n * ka, d: L, asFrac: true };
    B = { ...B, n: B.n * kb, d: L, asFrac: true };
    put(b, both(A, B), tx(`Both have the denominator $${L}$ now.`, `Beide haben jetzt den Nenner $${L}$.`));
  }
  const N = xs * A.n + sign * B.n;
  put(
    b,
    `\\frac{${xs < 0 ? `-#${X.kf}s ` : ""}${A.n}#${A.kn} ${op}#${opKey} ${B.n}#${B.kn}}{${A.d}#${A.kd}}#${A.kf}`,
    xs < 0
      ? tx(`Combine the numerators. The minus belongs to the $${A.n}$ only.`, `Fasse die Zähler zusammen. Das Minus gehört nur zur $${A.n}$.`)
      : tx("Same denominator: combine the numerators.", "Gleicher Nenner: Fasse die Zähler zusammen."),
  );
  const R: KF = { ...A, n: Math.abs(N), asFrac: false };
  const neg = N < 0;
  put(
    b,
    `${neg ? `-#${X.kf}s ` : ""}${src(R)}`,
    neg
      ? tx(`$${xs * A.n} ${op} ${B.n} = ${N}$. The result is negative: the minus goes in front of the fraction.`, `$${xs * A.n} ${op} ${B.n} = ${N}$. Das Ergebnis ist negativ: Das Minus kommt vor den Bruch.`)
      : tx(`$${xs * A.n} ${op} ${B.n} = ${N}$.`, `$${xs * A.n} ${op} ${B.n} = ${N}$.`),
  );
  b.pre = neg ? `-#${X.kf}s ` : "";
  simplify(b, R);
  b.pre = "";
  return frac(N, A.d);
}

type NegOps = { X: Frac; mixed: boolean; op1: 1 | -1; Y: Frac; Z: Frac; zNeg: boolean; times: boolean };

function negOpsExercise(t: NegOps): Exercise | null {
  const { X, Y, Z, zNeg, times, op1, mixed } = t;
  const P = times ? mulF(Y, Z) : divF(Y, Z);
  const eff: 1 | -1 = zNeg ? (op1 > 0 ? -1 : 1) : op1;
  const R = eff > 0 ? add(X, P) : sub(X, P);
  if (R.n === 0) return null;
  const xs: 1 | -1 = X.n < 0 ? -1 : 1;
  const ax = { n: Math.abs(X.n), d: X.d };
  const w = mixed ? Math.floor(ax.n / ax.d) : 0;
  const M: MixedN = { w, n: ax.n - w * ax.d, d: ax.d, id: "a" };
  const XK = kf(ax.n, ax.d, "a");
  const YK = kf(Y.n, Y.d, "b");
  const ZK = kf(Z.n, Z.d, "c");
  const sym1 = (s: 1 | -1) => (s > 0 ? "+" : "-");
  const sym2 = times ? "\\cdot" : ":";
  const xsrc = (form: "mixed" | "work" | "plain") => `${xs < 0 ? `-#${XK.kf}s ` : ""}${form === "mixed" ? mSrc(M) : form === "work" ? mWork(M) : src(XK)}`;
  const zsrc = zNeg ? `(-#cs ${src(ZK)})#cb` : src(ZK);
  const b = board();
  put(
    b,
    `${xsrc(mixed ? "mixed" : "plain")} ${sym1(op1)}#o1 ${src(YK)} ${sym2}#o2 ${zsrc}`,
    mixed
      ? tx(`**Punkt vor Strich**: $${sym2 === ":" ? ":" : "\\cdot"}$ comes first. But first turn the mixed number into an improper fraction.`, `**Punkt vor Strich**: Erst kommt das $${sym2 === ":" ? ":" : "\\cdot"}$. Vorher wandelst du die gemischte Zahl in einen unechten Bruch um.`)
      : tx(`**Punkt vor Strich**: work out $${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}$ first.`, `**Punkt vor Strich**: Rechne zuerst $${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}$ aus.`),
    { highlight: ["o2"] },
  );
  if (mixed) {
    put(b, `${xsrc("work")} ${sym1(op1)}#o1 ${src(YK)} ${sym2}#o2 ${zsrc}`, tx("Whole number times denominator, plus numerator.", "Ganze Zahl mal Nenner, plus Zähler."), { highlight: ["aw", "ak"] });
    put(b, `${xsrc("plain")} ${sym1(op1)}#o1 ${src(YK)} ${sym2}#o2 ${zsrc}`, tx(`$${mTx(M)} = ${fr(ax.n, ax.d)}$. The minus stays in front.`, `$${mTx(M)} = ${fr(ax.n, ax.d)}$. Das Minus bleibt davor.`));
  }
  if (zNeg) {
    put(
      b,
      `${xsrc("plain")} ${sym1(eff)}#o1 ${src(YK)} ${sym2}#o2 ${src(ZK)}`,
      op1 > 0
        ? tx(
            `Sign rule: a negative number in the ${times ? "product" : "division"} makes the result negative. Plus and minus give **minus**.`,
            `Vorzeichenregel: Eine negative Zahl macht ${times ? "das Produkt" : "den Quotienten"} negativ. Plus und Minus ergibt **Minus**.`,
          )
        : tx(
            `Sign rule: a negative number in the ${times ? "product" : "division"} makes the result negative. Minus and minus give **plus**.`,
            `Vorzeichenregel: Eine negative Zahl macht ${times ? "das Produkt" : "den Quotienten"} negativ. Minus und Minus ergibt **Plus**.`,
          ),
      { highlight: ["o1"] },
    );
  }
  b.pre = `${xsrc("plain")} ${sym1(eff)}#o1 `;
  const PK = times ? mul(b, YK, ZK, "o2") : div(b, YK, ZK, "o2");
  b.pre = "";
  const RR = signedAddSub(b, XK, xs, PK, eff, "o1");
  if (RR.n !== R.n || RR.d !== R.d) return null;
  finish(b.frames, R);
  const answer = answerOf(R);
  const shown = `${xs < 0 ? "-" : ""}${mixed ? mTx(M) : frf(ax)} ${sym1(op1)} ${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}`;
  const Zs = zNeg ? frac(-Z.n, Z.d) : Z;
  const calc2 = (y: Frac, z: Frac) => (times ? mulF(y, z) : divF(y, z));
  const leftToRight = calc2(op1 > 0 ? add(X, Y) : sub(X, Y), Zs);
  const noSignRule = op1 > 0 ? add(X, P) : sub(X, P);
  const spread = xs < 0 && eff > 0 ? frac(-(ax.n * P.d + P.n * ax.d), ax.d * P.d) : null;
  return {
    instruction: CALCULATE,
    math: shown,
    answer,
    hint: tx(
      `Punkt vor Strich: start with $${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}$.${zNeg ? " Mind the sign rule." : ""}${mixed ? " Turn the mixed number into an improper fraction first." : ""}`,
      `Punkt vor Strich: Fang mit $${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}$ an.${zNeg ? " Denk an die Vorzeichenregel." : ""}${mixed ? " Wandle die gemischte Zahl vorher in einen unechten Bruch um." : ""}`,
    ),
    solution: b.frames,
    mistakes: mistakesFor(answer, [
      {
        v: leftToRight,
        title: tx("Left to right", "Von links nach rechts gerechnet"),
        say: tx(
          `Ah, you worked from left to right! But Punkt vor Strich also holds for fractions: start with $${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}$.`,
          `Ah, du hast von links nach rechts gerechnet! Aber Punkt vor Strich gilt auch bei Brüchen: Fang mit $${frf(Y)} ${sym2} ${zNeg ? `(-${frf(Z)})` : frf(Z)}$ an.`,
        ),
      },
      zNeg && {
        v: noSignRule,
        title: tx("Minus in the bracket lost", "Minus in der Klammer verloren"),
        say: tx(
          `I think the minus in $(-${frf(Z)})$ got lost. It makes the ${times ? "product" : "quotient"} negative, and that changes the sign in front of it.`,
          `Ich glaub, das Minus in $(-${frf(Z)})$ ist verloren gegangen. Es macht ${times ? "das Produkt" : "den Quotienten"} negativ, und das dreht das Rechenzeichen davor um.`,
        ),
      },
      spread && {
        v: spread,
        title: tx("The minus spread too far", "Minus zu weit gezogen"),
        say: tx(
          `Careful: the minus in front of $${mixed ? mTx(M) : frf(ax)}$ belongs to that number only. $${-ax.n}/${ax.d} + …$ means: start below zero and go **up**.`,
          `Vorsicht: Das Minus vor $${mixed ? mTx(M) : frf(ax)}$ gehört nur zu dieser Zahl. Du startest unter null und gehst dann **nach oben**.`,
        ),
      },
      R.n < 0 && {
        v: frac(-R.n, R.d),
        title: tx("The minus is missing", "Das Minus fehlt"),
        say: tx("The size is right, but the result is negative: you end up left of $0$.", "Der Betrag stimmt, aber das Ergebnis ist negativ: Du landest links von der $0$."),
        close: true,
      },
      !times && {
        v: eff > 0 ? add(X, mulF(Y, Z)) : sub(X, mulF(Y, Z)),
        title: tx("Forgot to flip", "Kehrwert vergessen"),
        say: tx("Ah, you multiplied straight away! To divide, multiply by the **reciprocal** of the second fraction.", "Ah, du hast direkt multipliziert! Beim Dividieren nimmst du mal den **Kehrwert** des zweiten Bruchs."),
      },
    ]),
  };
}

function negOpsTask(rng: Rng): Exercise | null {
  const xd = rng.pick([2, 3, 4, 5, 6, 8]);
  const mixed = rng.chance(0.3);
  const xn = mixed ? coprime(rng, xd, xd + 1, 2 * xd - 1) : coprime(rng, xd, 1, xd - 1);
  const Y = { n: 0, d: rng.pick([2, 3, 4, 5, 6, 8, 9]) };
  const Z = { n: 0, d: rng.pick([2, 3, 4, 5, 6, 8, 9]) };
  const yn = coprime(rng, Y.d, 1, Y.d + 2);
  const zn = coprime(rng, Z.d, 1, Z.d - 1);
  if (xn === null || yn === null || zn === null) return null;
  Y.n = yn;
  Z.n = zn;
  const times = rng.chance(0.55);
  const cross = times ? gcd(Y.n, Z.d) > 1 || gcd(Z.n, Y.d) > 1 : gcd(Y.n, Z.n) > 1 || gcd(Y.d, Z.d) > 1;
  if (!cross) return null;
  const zNeg = rng.chance(0.4);
  const xNeg = !zNeg || rng.chance(0.5);
  const X = frac(xNeg ? -xn : xn, xd);
  const P = times ? mulF(Y, Z) : divF(Y, Z);
  if (P.d === 1 || P.n > 20 || lcm(xd, P.d) > 36) return null;
  const op1: 1 | -1 = rng.chance(0.6) ? 1 : -1;
  if (!xNeg && !zNeg) return null;
  const ex = negOpsExercise({ X, mixed, op1, Y, Z, zNeg, times });
  if (!ex) return null;
  const a = ex.answer;
  if (a.kind === "fraction" && (Math.abs(a.n) > 60 || a.d > 48)) return null;
  return ex;
}

// ---------------------------------------------------------------------------
// Double fractions with sums on top and bottom

type Part = { f: Frac; whole: boolean };

function complexDoubleExercise(A: Part, B: Part, s1: 1 | -1, C: Part, Dp: Part, s2: 1 | -1): Exercise | null {
  const T = s1 > 0 ? add(A.f, B.f) : sub(A.f, B.f);
  const U = s2 > 0 ? add(C.f, Dp.f) : sub(C.f, Dp.f);
  if (T.n <= 0 || U.n <= 0) return null;
  const R = divF(T, U);
  const k = (p: Part, id: string): KF => kf(p.f.n, p.f.d, id);
  let AK = k(A, "a");
  const BK = k(B, "b");
  let CK = k(C, "c");
  const DK = k(Dp, "e");
  const o = (s: 1 | -1) => (s > 0 ? "+" : "-");
  const top = (x: KF, y: KF) => `${src(x)} ${o(s1)}#t1 ${src(y)}`;
  const bot = (x: KF, y: KF) => `${src(x)} ${o(s2)}#u1 ${src(y)}`;
  const b = board();
  put(
    b,
    `\\frac{\\,\\, ${top(AK, BK)} \\,\\,}{\\,\\, ${bot(CK, DK)} \\,\\,}#big`,
    tx("A **double fraction**: the long main bar means numerator **divided by** denominator.", "Ein **Doppelbruch**: Der lange Hauptbruchstrich bedeutet Zähler **geteilt durch** Nenner."),
    { highlight: ["big-bar"] },
  );
  put(
    b,
    `(${top(AK, BK)})#tb :#big-bar (${bot(CK, DK)})#ub`,
    tx("Write it as a division. Top and bottom get brackets: they are worked out first.", "Schreib ihn als Division. Zähler und Nenner bekommen Klammern: Die rechnest du zuerst aus."),
    { highlight: ["tb(", "tb)", "ub(", "ub)"] },
  );
  // A whole number next to a fraction becomes a fraction with that denominator.
  const wholeFirst = (W: KF, other: KF, render: (w: KF) => string): KF => {
    const F: KF = { ...W, n: W.n * other.d, d: other.d, asFrac: true };
    put(b, render(F), tx(`Write $${W.n}$ as $\\frac{${F.n}}{${F.d}}$.`, `Schreib $${W.n}$ als $\\frac{${F.n}}{${F.d}}$.`), { highlight: [W.kn, W.kd] });
    return F;
  };
  if (A.whole) AK = wholeFirst(AK, BK, (F) => `(${top(F, BK)})#tb :#big-bar (${bot(CK, DK)})#ub`);
  b.pre = "(";
  b.post = `)#tb :#big-bar (${bot(CK, DK)})#ub`;
  const TK = addSub(b, AK, BK, s1, "t1");
  b.pre = "";
  b.post = "";
  if (C.whole) CK = wholeFirst(CK, DK, (F) => `(${src(TK)})#tb :#big-bar (${bot(F, DK)})#ub`);
  b.pre = `(${src(TK)})#tb :#big-bar (`;
  b.post = ")#ub";
  const UK = addSub(b, CK, DK, s2, "u1");
  b.pre = "";
  b.post = "";
  div(
    b,
    TK,
    UK,
    "big-bar",
    tx("Top and bottom are single numbers now, so the brackets can go. To divide, multiply by the reciprocal.", "Zähler und Nenner sind ausgerechnet, die Klammern können weg. Dividieren heißt: mit dem Kehrwert multiplizieren."),
  );
  finish(b.frames, R);
  const answer = answerOf(R);
  const f = (p: Part) => (p.whole ? String(p.f.n) : frf(p.f));
  const topS = `${f(A)} ${o(s1)} ${f(B)}`;
  const botS = `${f(C)} ${o(s2)} ${f(Dp)}`;
  const wrongTop = A.whole ? null : fv(A.f.n + s1 * B.f.n, A.f.d + s1 * B.f.d);
  return {
    instruction: tx("Simplify the double fraction", "Vereinfache den Doppelbruch"),
    math: `\\frac{\\,\\, ${topS} \\,\\,}{\\,\\, ${botS} \\,\\,}`,
    answer,
    hint: tx("Work out the top and the bottom separately first. Then divide: top $:$ bottom.", "Rechne zuerst Zähler und Nenner getrennt aus. Dann teilen: oben $:$ unten."),
    solution: b.frames,
    mistakes: mistakesFor(answer, [
      {
        v: mulF(T, U),
        title: tx("Multiplied instead of divided", "Multipliziert statt geteilt"),
        say: tx(
          `Top $= ${frf(T)}$ and bottom $= ${frf(U)}$, great! But the main bar means **divide**: multiply by the reciprocal of the bottom.`,
          `Oben $= ${frf(T)}$ und unten $= ${frf(U)}$, super! Aber der Hauptbruchstrich heißt **geteilt**: mal den Kehrwert von unten.`,
        ),
      },
      {
        v: divF(U, T),
        title: tx("Top and bottom swapped", "Oben und unten vertauscht"),
        say: tx("So close! The main bar means **top : bottom**, so the bottom one gets flipped.", "Ganz knapp! Der Hauptbruchstrich heißt **oben : unten**, umgedreht wird also der untere Bruch."),
      },
      wrongTop &&
        wrongTop.n > 0 && {
          v: divF(wrongTop, U),
          title: tx("Denominators added", "Nenner addiert"),
          say: tx(
            `Ooh, classic trap! In the top part you ${s1 > 0 ? "added" : "subtracted"} the denominators too. Make them the same first.`,
            `Die klassische Falle! Oben hast du auch die Nenner ${s1 > 0 ? "addiert" : "subtrahiert"}. Mach sie erst gleich.`,
          ),
        },
    ]),
  };
}

function complexDoubleTask(rng: Rng): Exercise | null {
  const part = (wholeOk: boolean): Part | null => {
    if (wholeOk && rng.chance(0.3)) return { f: frac(rng.int(1, 2)), whole: true };
    const d = rng.pick([2, 3, 4, 5, 6, 8]);
    const n = coprime(rng, d, 1, d - 1);
    return n === null ? null : { f: frac(n, d), whole: false };
  };
  const A = part(true);
  const B = part(false);
  const C = part(true);
  const Dp = part(false);
  if (!A || !B || !C || !Dp) return null;
  if ((!A.whole && A.f.d === B.f.d) || (!C.whole && C.f.d === Dp.f.d)) return null;
  if (lcm(A.f.d, B.f.d) > 24 || lcm(C.f.d, Dp.f.d) > 24) return null;
  const s1: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const s2: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const ex = complexDoubleExercise(A, B, s1, C, Dp, s2);
  if (!ex) return null;
  const a = ex.answer;
  if (a.kind === "fraction" && (a.n > 60 || a.d > 48)) return null;
  return ex;
}

// ---------------------------------------------------------------------------
// Practice

const LEVEL2: [number, Gen][] = [
  [2, toDecimalTask],
  [2, toPercentTask],
  [1.5, fromDecimalTask],
  [1.5, fromPercentTask],
  [2, periodicTask],
  [1, toPeriodicTask],
  [1, terminatingTask],
  [2, compareTask],
  [1.5, orderNumbersTask],
  [1.5, lineTask],
  [1, orderTask],
  [1, bracketTask],
  [1, doubleTask],
  [2.5, negOpsTask],
  [1.5, complexDoubleTask],
];

export function generate2(rng: Rng): Exercise {
  for (let tries = 0; tries < 80; tries++) {
    const ex = pickWeighted(rng, LEVEL2)(rng);
    if (ex) return ex;
  }
  for (;;) {
    const ex = toDecimalTask(rng);
    if (ex) return ex;
  }
}

// ---------------------------------------------------------------------------
// Lesson boards

const namesFrames: Frame[] = [
  { math: "\\frac{3#n}{4#d}#f", note: tx("One number, three ways to write it. We start with $\\frac{3}{4}$.", "Eine Zahl, drei Schreibweisen. Wir starten mit $\\frac{3}{4}$.") },
  {
    math: "\\frac{3#n \\cdot#m1 25#k1}{4#d \\cdot#m2 25#k2}#f",
    note: tx("Expand to the denominator $100$: $4 \\cdot 25 = 100$.", "Erweitere auf den Nenner $100$: $4 \\cdot 25 = 100$."),
    highlight: ["k1", "k2"],
  },
  { math: "\\frac{75#n}{100#d}#f", note: tx("$75$ hundredths.", "$75$ Hundertstel.") },
  {
    math: bi("\\frac{75#n}{100#d}#f =#e1 0,75#v"),
    note: tx("Hundredths are the second place after the decimal point: $0.75$.", "Hundertstel sind die zweite Stelle nach dem Komma: $0,75$."),
    highlight: ["v"],
  },
  {
    math: bi("\\frac{75#n}{100#d}#f =#e1 0,75#v =#e2 75#p %#pc"),
    note: tx("**Per cent** means hundredths: $\\frac{75}{100} = 75\\,\\%$.", "**Prozent** heißt Hundertstel: $\\frac{75}{100} = 75\\,\\%$."),
    highlight: ["p", "pc"],
  },
  {
    math: bi("\\frac{3#n}{8#d}#f =#e0 3#n2 :#dv 8#d2 =#e1 0,375#v =#e2 37,5#p %#pc"),
    note: tx(
      "No easy way to $100$? Then divide: $3 : 8 = 0.375 = 37.5\\,\\%$.",
      "Kein leichter Weg zur $100$? Dann teil einfach: $3 : 8 = 0,375 = 37,5\\,\\%$.",
    ),
  },
  {
    math: bi("0,45#v =#e1 \\frac{45#n}{100#d}#f"),
    note: tx("And backwards: $0.45$ is $45$ hundredths.", "Und rückwärts: $0,45$ sind $45$ Hundertstel."),
  },
  {
    math: bi("0,45#v =#e1 \\frac{45#n :#s1 5#k1}{100#d :#s2 5#k2}#f =#e2 \\frac{9#n2}{20#d2}#f2"),
    note: tx("Then simplify: $0.45 = \\frac{9}{20} = 45\\,\\%$.", "Dann kürzen: $0,45 = \\frac{9}{20} = 45\\,\\%$."),
    highlight: ["k1", "k2"],
  },
];

const repeatFrames: Frame[] = [
  {
    math: bi("1#n :#dv 3#d =#e 0,333#v …#dots"),
    note: tx(
      "$1 : 3$ never ends: the remainder is always $1$, so a $3$ comes again and again.",
      "$1 : 3$ geht nie auf: Es bleibt immer Rest $1$, also kommt immer wieder eine $3$.",
    ),
  },
  {
    math: bi("\\frac{1#n}{3#d}#f =#e 0,333#v …#dots"),
    note: tx(
      "A **repeating decimal**. The repeating part is the **period**. You write a bar over it (see the picture).",
      "Eine **periodische Dezimalzahl**. Der Teil, der sich wiederholt, heißt **Periode**. Man schreibt einen Strich darüber (siehe Bild).",
    ),
  },
  { math: bi("x#x =#e 0,777#v …#dots"), note: tx("And back to a fraction? Call the number $x$.", "Und zurück zum Bruch? Nenn die Zahl $x$.") },
  {
    math: bi("10#k x#x2 =#e2 7,777#v2 …#dots2 \\\\ x#x =#e 0,777#v …#dots"),
    note: tx("Times $10$: the comma moves one place. Behind the comma nothing changes.", "Mal $10$: Das Komma rutscht eine Stelle. Hinter dem Komma ändert sich nichts."),
    highlight: ["v2", "v"],
  },
  {
    math: "9#k x#x2 =#e2 7#v2",
    note: tx("Subtract the lower line: the endless tails cancel. $10x - x = 9x$.", "Zieh die untere Zeile ab: Die endlosen Schwänze heben sich weg. $10x - x = 9x$."),
  },
  {
    math: "x#x2 =#e2 \\frac{7#v2}{9#k}#f",
    note: tx(
      "So $0.777… = \\frac{7}{9}$. Rule: the period over as many nines as it has digits: $0.3636… = \\frac{36}{99} = \\frac{4}{11}$.",
      "Also ist $0,777… = \\frac{7}{9}$. Merke: die Periode über so viele Neunen, wie sie Ziffern hat: $0,3636… = \\frac{36}{99} = \\frac{4}{11}$.",
    ),
  },
];

const compareFrames: Frame[] = [
  { math: "\\frac{5#an}{6#ad}#af \\quad \\frac{7#bn}{9#bd}#bf", note: tx("Which is bigger: $\\frac{5}{6}$ or $\\frac{7}{9}$?", "Was ist größer: $\\frac{5}{6}$ oder $\\frac{7}{9}$?") },
  {
    math: "\\frac{15#an}{18#ad}#af \\quad \\frac{14#bn}{18#bd}#bf",
    note: tx("Give them the same denominator ($18$). Now the pieces have the same size.", "Bring sie auf denselben Nenner ($18$). Jetzt sind die Stücke gleich groß."),
    highlight: ["ad", "bd"],
  },
  { math: "\\frac{15#an}{18#ad}#af >#r \\frac{14#bn}{18#bd}#bf", note: tx("$15$ pieces are more than $14$.", "$15$ Stücke sind mehr als $14$."), highlight: ["an", "bn"] },
  { math: "\\frac{5#an}{6#ad}#af >#r \\frac{7#bn}{9#bd}#bf", note: tx("So $\\frac{5}{6} > \\frac{7}{9}$.", "Also ist $\\frac{5}{6} > \\frac{7}{9}$.") },
  {
    math: "-#as \\frac{5#an}{6#ad}#af <#r -#bs \\frac{7#bn}{9#bd}#bf",
    note: tx(
      "With minus signs it flips! $-\\frac{5}{6}$ is further from $0$, so it lies further **left**: $-\\frac{5}{6} < -\\frac{7}{9}$.",
      "Mit Minus dreht es sich um! $-\\frac{5}{6}$ ist weiter von $0$ weg, liegt also weiter **links**: $-\\frac{5}{6} < -\\frac{7}{9}$.",
    ),
    highlight: ["r"],
  },
  {
    math: bi("0,5#a =#e 0,50#a2 >#r 0,45#b"),
    note: tx(
      "Decimals: compare place by place, tenths first. $0.5 > 0.45$, although $45$ looks bigger than $5$.",
      "Dezimalzahlen: Stelle für Stelle vergleichen, zuerst die Zehntel. $0,5 > 0,45$, obwohl $45$ größer aussieht als $5$.",
    ),
    highlight: ["a2"],
  },
];

// Order of operations: −3/4 + 1 1/2 : (2/3 − 1/6)
const opsBoard = board();
{
  const X = kf(3, 4, "x");
  const M: MixedN = { w: 1, n: 1, d: 2, id: "m" };
  const A = kf(2, 3, "a");
  const B = kf(1, 6, "b");
  const lead = `-#${X.kf}s ${src(X)} +#o1 `;
  put(
    opsBoard,
    `${lead}${mSrc(M)} :#o2 (${src(A)} -#o3 ${src(B)})#br`,
    tx("The same order as with whole numbers: **brackets first**, then $\\cdot$ and $:$, then $+$ and $-$.", "Dieselbe Reihenfolge wie bei ganzen Zahlen: **Klammer zuerst**, dann Punkt-, dann Strichrechnung."),
    { highlight: ["br(", "br)"] },
  );
  opsBoard.pre = `${lead}${mSrc(M)} :#o2 (`;
  opsBoard.post = ")#br";
  const S = addSub(opsBoard, A, B, -1, "o3");
  opsBoard.pre = "";
  opsBoard.post = "";
  put(opsBoard, `${lead}${mSrc(M)} :#o2 ${src(S)}`, tx("The bracket is done. Now the division, before the plus.", "Die Klammer ist fertig. Jetzt die Division, vor dem Plus."), { highlight: ["o2"] });
  put(opsBoard, `${lead}${mWork(M)} :#o2 ${src(S)}`, tx("Turn the mixed number into an improper fraction first.", "Wandle vorher die gemischte Zahl in einen unechten Bruch um."), { highlight: ["mw", "mk"] });
  const MI = mImproper(M);
  put(opsBoard, `${lead}${src(MI)} :#o2 ${src(S)}`, tx("$1 \\cdot 2 + 1 = 3$, so $1\\frac{1}{2} = \\frac{3}{2}$.", "$1 \\cdot 2 + 1 = 3$, also ist $1\\frac{1}{2} = \\frac{3}{2}$."));
  opsBoard.pre = lead;
  const Q = div(opsBoard, MI, S, "o2");
  opsBoard.pre = "";
  signedAddSub(opsBoard, X, -1, Q, 1, "o1");
  appendNote(opsBoard.frames, tx("As a mixed number: $2\\frac{1}{4}$.", "Als gemischte Zahl: $2\\frac{1}{4}$."));
}

// Double fraction: (1 − 1/4) / (1/2 + 1/8)
const doubleBoard = (() => {
  const ex = complexDoubleExercise({ f: frac(1), whole: true }, { f: frac(1, 4), whole: false }, -1, { f: frac(1, 2), whole: false }, { f: frac(1, 8), whole: false }, 1);
  return ex ? ex.solution : [];
})();

// ---------------------------------------------------------------------------
// Checks

const check1 = toPercentExercise(7, 20);
const check2 = periodicExercise({ int: 0, pre: "", period: "36" });
const check3 = (() => {
  let key = 0;
  const mk = (v: number, s: Text, f: Frac | null = null): Item => ({ v, src: s, f, key: `c${key++}` });
  const a = mk(-0.75, "-\\frac{3}{4}", frac(-3, 4));
  const b = mk(-0.7, bi("-0,7"));
  const c = mk(0.45, bi("0,45"));
  const d = mk(0.5, "\\frac{1}{2}", frac(1, 2));
  const e = mk(2 / 3, "\\frac{2}{3}", frac(2, 3));
  return orderExercise([e, b, d, a, c], [
    { a: b, b: a, ...NEG_TRAP },
    { a: d, b: c, ...decTrap(0.5, 0.45) },
  ]);
})();
const check4 = complexDoubleExercise({ f: frac(2, 3), whole: false }, { f: frac(1, 6), whole: false }, 1, { f: frac(1), whole: true }, { f: frac(1, 2), whole: false }, -1);

// ---------------------------------------------------------------------------

export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Fraction, decimal, percentage", "Bruch, Dezimalzahl, Prozent"),
      body: tx(
        "Expand to $10$, $100$ or $1000$, or divide numerator by denominator. Per cent means hundredths.",
        "Erweitere auf $10$, $100$ oder $1000$ oder teile Zähler durch Nenner. Prozent heißt Hundertstel.",
      ),
      examples: [bi("\\frac{3}{4} = \\frac{75}{100} = 0,75 = 75 %"), bi("\\frac{3}{8} = 3 : 8 = 0,375 = 37,5 %")],
      tone: "rule",
    },
    {
      title: tx("Decimal or percentage to fraction", "Dezimalzahl oder Prozent zum Bruch"),
      body: tx(
        "The last digit tells you the denominator: tenths, hundredths, thousandths. Then simplify.",
        "Die letzte Stelle verrät den Nenner: Zehntel, Hundertstel, Tausendstel. Dann kürzen.",
      ),
      examples: [bi("0,45 = \\frac{45}{100} = \\frac{9}{20}"), bi("12,5 % = \\frac{125}{1000} = \\frac{1}{8}")],
      tone: "rule",
    },
    {
      title: tx("Repeating decimals", "Periodische Dezimalzahlen"),
      body: tx(
        "A fully simplified fraction terminates only if its denominator has no prime factors except 2 and 5. Otherwise a period repeats forever. Back to a fraction: the period over as many nines as it has digits.",
        "Ein vollständig gekürzter Bruch bricht nur ab, wenn sein Nenner nur die Primfaktoren 2 und 5 hat. Sonst wiederholt sich eine Periode endlos. Zurück zum Bruch: Periode über so viele Neunen, wie sie Ziffern hat.",
      ),
      examples: [bi("\\frac{1}{6} = 0,1666 …"), bi("0,3636 … = \\frac{36}{99} = \\frac{4}{11}")],
      tone: "rule",
    },
    {
      title: tx("Comparing and ordering", "Vergleichen und Ordnen"),
      body: tx(
        "Same denominator, or both as decimals. On the number line, further right is bigger, also for negative numbers.",
        "Gleicher Nenner oder beide als Dezimalzahl. Am Zahlenstrahl ist weiter rechts größer, auch bei negativen Zahlen.",
      ),
      examples: ["-\\frac{5}{6} < -\\frac{7}{9}", bi("0,5 > 0,45")],
      tone: "tip",
    },
    {
      title: tx("Order of operations and double fractions", "Rechenreihenfolge und Doppelbrüche"),
      body: tx(
        "Brackets, then $\\cdot$ and $:$, then $+$ and $-$. Mixed numbers become improper fractions first. A double fraction is top $:$ bottom, with top and bottom worked out first.",
        "Klammer vor Punkt vor Strich. Gemischte Zahlen zuerst in unechte Brüche umwandeln. Ein Doppelbruch ist oben $:$ unten, wobei du oben und unten zuerst ausrechnest.",
      ),
      examples: ["\\frac{1 - \\frac{1}{4}}{\\frac{1}{2} + \\frac{1}{8}} = \\frac{3}{4} : \\frac{5}{8} = \\frac{3}{4} \\cdot \\frac{8}{5} = \\frac{6}{5}"],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "More digits don't make a decimal bigger. With negative numbers, the one further from $0$ is smaller. And the fraction bar is not a comma.",
        "Mehr Ziffern machen eine Dezimalzahl nicht größer. Bei negativen Zahlen ist die weiter von $0$ entfernte kleiner. Und der Bruchstrich ist kein Komma.",
      ),
      examples: [bi("\\frac{3}{4} \\ne 3,4"), bi("-0,8 < -0,7")],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Fraction, decimal, percentage", "Bruch, Dezimalzahl, Prozent"),
      blob: tx("Three outfits, one number. Let's try them on!", "Drei Outfits, eine Zahl. Probieren wir sie an!"),
      body: tx(
        "The same amount can be written as a fraction, a decimal or a percentage. To switch, use hundredths: expand, or divide numerator by denominator.",
        "Derselbe Anteil lässt sich als Bruch, als Dezimalzahl oder in Prozent schreiben. Zum Wechseln helfen dir die Hundertstel: erweitern oder Zähler durch Nenner teilen.",
      ),
      frames: namesFrames,
    },
    {
      type: "check",
      blob: tx("Hundredths are your friend here.", "Hundertstel sind hier deine Freunde."),
      exercise: check1,
    },
    {
      type: "widget",
      title: tx("The division machine", "Die Divisionsmaschine"),
      blob: tx("Some divisions never end. Watch the remainders!", "Manche Divisionen gehen nie auf. Behalte die Reste im Blick!"),
      body: tx(
        "The machine divides numerator by denominator by hand, one digit at a time. When the remainder is $0$, the decimal ends. When a remainder comes back, the digits repeat forever.",
        "Die Maschine teilt Zähler durch Nenner schriftlich, Ziffer für Ziffer. Ist der Rest $0$, bricht die Dezimalzahl ab. Kommt ein Rest wieder, wiederholen sich die Ziffern endlos.",
      ),
      widget: FractionsDivisionMachine,
    },
    {
      type: "explain",
      title: tx("Repeating decimals", "Periodische Dezimalzahlen"),
      blob: tx("Endless digits, but a neat trick to tame them.", "Endlose Ziffern, aber ein schlauer Trick bändigt sie."),
      body: tx(
        "A **repeating decimal** has a part that repeats forever, the **period**. With a little trick you can turn it back into a fraction.",
        "Eine **periodische Dezimalzahl** hat einen Teil, der sich endlos wiederholt: die **Periode**. Mit einem kleinen Trick wird daraus wieder ein Bruch.",
      ),
      visual: visual(FractionsDecimalKinds, {}),
      frames: repeatFrames,
    },
    {
      type: "check",
      blob: tx("Two digits in the period. How many nines?", "Zwei Ziffern in der Periode. Wie viele Neunen?"),
      exercise: check2,
    },
    {
      type: "explain",
      title: tx("Comparing and ordering", "Vergleichen und Ordnen"),
      blob: tx("Which one is bigger? Sometimes it's sneaky.", "Was ist größer? Manchmal ist das ganz schön tückisch."),
      body: tx(
        "Give fractions the same denominator, or turn everything into decimals. For negative numbers, think of the number line: further left means smaller.",
        "Bring Brüche auf denselben Nenner oder mach aus allem Dezimalzahlen. Bei negativen Zahlen hilft der Zahlenstrahl: Weiter links heißt kleiner.",
      ),
      frames: compareFrames,
    },
    {
      type: "widget",
      title: tx("One point, three names", "Ein Punkt, drei Namen"),
      blob: tx("Drag me along the number line! Then try a target.", "Zieh mich über den Zahlenstrahl! Dann probier ein Ziel."),
      body: tx(
        "Drag the point along the number line, also into the negative numbers. You see its value as a fraction, a decimal and a percentage. Change the ticks to reach other fractions.",
        "Zieh den Punkt über den Zahlenstrahl, auch zu den negativen Zahlen. Du siehst seinen Wert als Bruch, als Dezimalzahl und in Prozent. Mit der Einteilung erreichst du andere Brüche.",
      ),
      widget: FractionsNumberLine,
    },
    {
      type: "check",
      blob: tx("Negative numbers, decimals, fractions: line them up!", "Negative Zahlen, Dezimalzahlen, Brüche: Stell sie in eine Reihe!"),
      exercise: check3,
    },
    {
      type: "explain",
      title: tx("Order of operations", "Die Rechenreihenfolge"),
      blob: tx("Same rules as always, just with fractions.", "Dieselben Regeln wie immer, nur mit Brüchen."),
      body: tx(
        "Brackets first, then multiply and divide, then add and subtract. Turn mixed numbers into improper fractions, and mind the signs of negative fractions.",
        "Klammer vor Punkt vor Strich. Gemischte Zahlen werden zu unechten Brüchen, und bei negativen Brüchen achtest du auf die Vorzeichen.",
      ),
      frames: opsBoard.frames,
    },
    {
      type: "explain",
      title: tx("Double fractions", "Doppelbrüche"),
      blob: tx("A fraction made of fractions. Looks scary, isn't!", "Ein Bruch aus Brüchen. Sieht wild aus, ist es aber nicht!"),
      body: tx(
        "In a **double fraction** the long main bar means: top divided by bottom. Work out the top and the bottom first, as if they were in brackets.",
        "Beim **Doppelbruch** bedeutet der lange Hauptbruchstrich: oben geteilt durch unten. Rechne Zähler und Nenner zuerst aus, als stünden sie in Klammern.",
      ),
      frames: doubleBoard,
    },
    {
      type: "check",
      blob: tx("Last one! Top first, then bottom, then divide.", "Die letzte! Erst oben, dann unten, dann teilen."),
      exercise: check4 ?? check1,
    },
  ],
};

