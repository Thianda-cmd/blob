"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Check, Minus, Plus } from "lucide-react";
import { useId, useRef, useState, type ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import { MathView } from "@/learn/components/MathView";
import { gcd, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { cn } from "@/lib/utils";
import {
  amount,
  cents2,
  changeSlips,
  EMPTY,
  euro,
  FACTOR_OFF,
  factorOf,
  factorOff,
  findTask,
  mistakesFor,
  perc,
  Pill,
  r2,
  r6,
  rateAnswer,
  reverseSlips,
  say,
  Segmented,
  useFmt,
  WORD_PROBLEM,
  type Change,
  type Fmt,
  type Gen,
  type Slip,
  type Unit,
} from "./shared";

/**
 * Level 2 (Klasse 7–8): interest for years, months and days (Zinsrechnung with the banking year of
 * 360 days) and solving for capital, rate or time; VAT from net to gross and back; several discounts
 * and surcharges in a row (discount, then Skonto) and why +20 % then −20 % is not the start value.
 */

const cents = (v: number) => Math.abs(r2(v) - v) < 1e-9;

// ---------------------------------------------------------------------------
// Interest: Z = K · p/100 for a year, · m/12 for months, · t/360 for days

/** How long the money is lent: one year, m months or t days (banking year: 360 days, 30 per month). */
type Span = { kind: "year" } | { kind: "months"; m: number } | { kind: "days"; t: number };

const spanPart = (s: Span) => (s.kind === "year" ? 1 : s.kind === "months" ? s.m / 12 : s.t / 360);
const spanTop = (s: Span) => (s.kind === "months" ? s.m : s.kind === "days" ? s.t : 1);
const spanBottom = (s: Span) => (s.kind === "months" ? 12 : 360);

/** The time factor of the interest formula on the board, " · 5/12" (nothing for a year). */
function spanTail(s: Span, letters = false) {
  if (s.kind === "year") return "";
  const top = letters ? (s.kind === "months" ? "m" : "t") : String(spanTop(s));
  return ` \\cdot#m2 \\frac{${top}#tt}{${spanBottom(s)}#tb}#f2`;
}

/** "5 months", "75 days", "one year"; German needs the dative after "in" and "nach". */
function spanWords(s: Span, f: Fmt, dative = false) {
  if (s.kind === "year") return f.t("one year", dative ? "einem Jahr" : "ein Jahr");
  if (s.kind === "months") return s.m === 1 ? f.t("1 month", dative ? "einem Monat" : "einen Monat") : f.t(`${s.m} months`, `${s.m} ${dative ? "Monaten" : "Monate"}`);
  return f.t(`${s.t} days`, `${s.t} ${dative ? "Tagen" : "Tage"}`);
}

/** The time on the board for the formula tasks: "m = 5 months". */
const spanMath = (s: Span, f: Fmt) =>
  s.kind === "year" ? "" : s.kind === "months" ? ` ,\\quad m = ${s.m} "${f.t("months", "Monate")}"` : ` ,\\quad t = ${s.t} "${f.t("days", "Tage")}"`;

/** Z = K · p/100 · (time), worked step by step. */
function interestFrames(K: number, p: number, s: Span): Frame[] {
  const Zy = (K * p) / 100;
  const Z = Zy * spanPart(s);
  const frames: Frame[] = [
    {
      math: `Z#Z =#e K#K \\cdot#m1 \\frac{p#p}{100#h}#f1${spanTail(s, true)}`,
      note:
        s.kind === "year"
          ? tx("Interest for one year: capital times interest rate.", "Zinsen für ein Jahr: Kapital mal Zinssatz.")
          : s.kind === "months"
            ? tx("For $m$ months you get $\\frac{m}{12}$ of the yearly interest.", "Für $m$ Monate bekommst du $\\frac{m}{12}$ der Jahreszinsen.")
            : tx(
                "For $t$ days you get $\\frac{t}{360}$ of the yearly interest. Banks count $360$ days a year.",
                "Für $t$ Tage bekommst du $\\frac{t}{360}$ der Jahreszinsen. Banken rechnen mit $360$ Tagen im Jahr.",
              ),
    },
    {
      math: say(({ c, n }) => `Z#Z =#e ${c(K)}#K "€"#u \\cdot#m1 \\frac{${n(p)}#p}{100#h}#f1${spanTail(s)}`),
      note: say((f) =>
        f.t(
          `Put in the numbers: $K = ${f.c(K)}$ €, $p = ${f.n(p)}$${s.kind === "year" ? "" : s.kind === "months" ? ` and $m = ${s.m}$` : ` and $t = ${s.t}$`}.`,
          `Setz die Zahlen ein: $K = ${f.c(K)}$\u00a0€, $p = ${f.n(p)}$${s.kind === "year" ? "" : s.kind === "months" ? ` und $m = ${s.m}$` : ` und $t = ${s.t}$`}.`,
        ),
      ),
      highlight: ["K", "p", "tt"],
    },
  ];
  if (s.kind !== "year") {
    frames.push({
      math: say(({ c }) => `Z#Z =#e ${c(Zy)}#J "€"#u${spanTail(s)}`),
      note: say((f) =>
        f.t(
          `Yearly interest first: $${f.c(K)} \\cdot ${f.n(p / 100)} = ${f.c(Zy)}$ €.`,
          `Zuerst die Jahreszinsen: $${f.c(K)} \\cdot ${f.n(p / 100)} = ${f.c(Zy)}$\u00a0€.`,
        ),
      ),
      highlight: ["J"],
    });
  }
  const perMonth = s.kind === "months" && cents(Zy / 12) && s.m > 1;
  frames.push({
    math: say(({ c }) => `Z#Z =#e ${c(Z)}#r "€"#u`),
    note: say((f) =>
      s.kind === "year"
        ? f.t(`$${f.c(K)} \\cdot ${f.n(p / 100)} = ${f.c(Z)}$ €.`, `$${f.c(K)} \\cdot ${f.n(p / 100)} = ${f.c(Z)}$\u00a0€.`)
        : f.t(
            `$${f.c(Zy)} \\cdot \\frac{${spanTop(s)}}{${spanBottom(s)}} = ${f.c(Z)}$ €.${perMonth ? ` That's $${f.c(Zy / 12)}$ € a month, times $${spanTop(s)}$.` : ""}`,
            `$${f.c(Zy)} \\cdot \\frac{${spanTop(s)}}{${spanBottom(s)}} = ${f.c(Z)}$\u00a0€.${perMonth ? ` Das sind $${f.c(Zy / 12)}$\u00a0€ pro Monat, mal $${spanTop(s)}$.` : ""}`,
          ),
    ),
    highlight: ["r"],
  });
  return frames;
}

/** Interest for part of a year scaled up to a whole year (rule of three). */
function toYearFrames(Z: number, s: Span): Frame[] {
  if (s.kind === "year") return [];
  const Zy = Z / spanPart(s);
  const unitWord = (f: Fmt, k: number) => (s.kind === "months" ? (k === 1 ? f.t("month", "Monat") : f.t("months", "Monate")) : f.t("days", "Tage"));
  return [
    {
      math: say((f) => `${spanTop(s)}#a "${unitWord(f, spanTop(s))}"#am \\to#to ${f.c(Z)}#b "€"#u`),
      note: say((f) =>
        f.t(
          `Interest rates are per year. So first find the interest for a whole year: in ${spanWords(s, f)} it's $${f.c(Z)}$ €.`,
          `Zinssätze gelten pro Jahr. Rechne also zuerst die Zinsen für ein ganzes Jahr aus: In ${spanWords(s, f, true)} sind es $${f.c(Z)}$\u00a0€.`,
        ),
      ),
    },
    {
      math: say((f) => `${spanBottom(s)}#a "${unitWord(f, 12)}"#am \\to#to ${f.c(Zy)}#b "€"#u`),
      note: say((f) =>
        f.t(
          `Rule of three up to a whole year: $${f.c(Z)} : ${spanTop(s)} \\cdot ${spanBottom(s)} = ${f.c(Zy)}$ €.`,
          `Mit dem Dreisatz auf ein ganzes Jahr: $${f.c(Z)} : ${spanTop(s)} \\cdot ${spanBottom(s)} = ${f.c(Zy)}$\u00a0€.`,
        ),
      ),
      highlight: ["a", "b"],
    },
  ];
}

/** The capital from the interest: K = Z · 100 : p (with the yearly interest Z). */
function capitalFrames(Z: number, p: number, s: Span): Frame[] {
  const Zy = Z / spanPart(s);
  const K = (Zy * 100) / p;
  return [
    ...toYearFrames(Z, s),
    {
      math: say(({ c, n }) => `${c(Zy)}#b "€"#u =#e K#K \\cdot#m \\frac{${n(p)}#p}{100#h}#f`),
      note: say((f) =>
        f.t(
          `The yearly interest $${f.c(Zy)}$ € is $${f.n(p)} %$ of the unknown capital $K$.`,
          `Die Jahreszinsen von $${f.c(Zy)}$\u00a0€ sind $${f.n(p)} %$ des unbekannten Kapitals $K$.`,
        ),
      ),
    },
    {
      math: say(({ c, n }) => `K#K =#e \\frac{${c(Zy)}#b \\cdot#m 100#h}{${n(p)}#p}#f "€"#u`),
      note: tx("Rearrange for $K$: $K = \\frac{Z \\cdot 100}{p}$.", "Nach $K$ umstellen: $K = \\frac{Z \\cdot 100}{p}$."),
      highlight: ["h", "p"],
    },
    {
      math: say(({ c }) => `K#K =#e ${c(K)}#r "€"#u`),
      note: say((f) =>
        f.t(
          `$${f.c(Zy)} \\cdot 100 : ${f.n(p)} = ${f.c(K)}$ €. Check: $${f.n(p)} %$ of $${f.c(K)}$ € are $${f.c(Zy)}$ €.`,
          `$${f.c(Zy)} \\cdot 100 : ${f.n(p)} = ${f.c(K)}$\u00a0€. Probe: $${f.n(p)} %$ von $${f.c(K)}$\u00a0€ sind $${f.c(Zy)}$\u00a0€.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
}

/** The rate from capital and interest: p % = yearly interest : capital. */
function rateFrames(K: number, Z: number, s: Span): Frame[] {
  const Zy = Z / spanPart(s);
  const q = Zy / K;
  return [
    ...toYearFrames(Z, s),
    {
      math: say(({ c }) => `p#p %#pc =#e \\frac{${c(Zy)}#b}{${c(K)}#K}#f`),
      note: tx("The rate is the yearly interest divided by the capital.", "Der Zinssatz ist: Jahreszinsen geteilt durch Kapital."),
      highlight: ["b", "K"],
    },
    {
      math: say(({ n }) => `p#p %#pc =#e ${n(q)}#q =#e2 ${n(q * 100)}#r %#rp`),
      note: say((f) =>
        f.t(
          `$${f.c(Zy)} : ${f.c(K)} = ${f.n(q)}$, that's $${f.n(q * 100)} %$.`,
          `$${f.c(Zy)} : ${f.c(K)} = ${f.n(q)}$, das sind $${f.n(q * 100)} %$.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
}

/** The time: which part of the yearly interest is wanted, times 12 months or 360 days. */
function timeFrames(K: number, p: number, Z: number, s: Span): Frame[] {
  const Zy = (K * p) / 100;
  const total = spanBottom(s);
  const letter = s.kind === "months" ? "m" : "t";
  const ans = (Z / Zy) * total;
  return [
    {
      math: say(({ c, n }) => `${c(K)}#K "€"#u \\cdot#m ${n(p / 100)}#q =#e ${c(Zy)}#J "€"#u2`),
      note: say((f) =>
        f.t(`In a whole year, the capital would earn $${f.c(Zy)}$ € interest.`, `In einem ganzen Jahr brächte das Kapital $${f.c(Zy)}$\u00a0€ Zinsen.`),
      ),
      highlight: ["J"],
    },
    {
      math: say(({ c }) => `${letter}#t =#e \\frac{${c(Z)}#Z}{${c(Zy)}#J}#f \\cdot#m2 ${total}#y`),
      note: say((f) =>
        f.t(
          `Only $${f.c(Z)}$ € are wanted: that's the part $\\frac{${f.c(Z)}}{${f.c(Zy)}}$ of the year. A year has $${total}$ ${s.kind === "months" ? "months" : "days"}.`,
          `Gebraucht werden nur $${f.c(Z)}$\u00a0€: Das ist der Anteil $\\frac{${f.c(Z)}}{${f.c(Zy)}}$ am Jahr. Ein Jahr hat $${total}$ ${s.kind === "months" ? "Monate" : "Tage"}.`,
        ),
      ),
      highlight: ["Z", "J"],
    },
    {
      math: say((f) => `${letter}#t =#e ${ans}#r "${s.kind === "months" ? f.t("months", "Monate") : f.t("days", "Tage")}"#d`),
      note: say((f) =>
        f.t(
          `$${f.c(Z)} : ${f.c(Zy)} \\cdot ${total} = ${ans}$. Check: $${f.c(Zy)} \\cdot \\frac{${ans}}{${total}} = ${f.c(Z)}$ €.`,
          `$${f.c(Z)} : ${f.c(Zy)} \\cdot ${total} = ${ans}$. Probe: $${f.c(Zy)} \\cdot \\frac{${ans}}{${total}} = ${f.c(Z)}$\u00a0€.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
}

// Typical mistakes with interest ------------------------------------------------

const WHOLE_YEAR = tx("A whole year's interest", "Zinsen für ein ganzes Jahr");
const NOT_SCALED = tx("Not scaled to a year", "Nicht aufs Jahr hochgerechnet");

function interestSlips(K: number, p: number, s: Span): Slip[] {
  const Zy = (K * p) / 100;
  const Z = Zy * spanPart(s);
  return [
    [
      K + Z,
      tx("Capital plus interest", "Kapital plus Zinsen"),
      tx(
        "Nearly! That's the new balance, capital **plus** interest. The question only asks for the interest.",
        "Fast! Das ist der neue Kontostand, Kapital **plus** Zinsen. Gefragt sind nur die Zinsen.",
      ),
    ],
    s.kind !== "year" && [
      Zy,
      WHOLE_YEAR,
      say((f) =>
        f.t(
          `Ah, that's the interest for a **whole year**. But it's only about ${spanWords(s, f)}: take just that part of the year.`,
          `Ah, das sind die Zinsen für ein **ganzes Jahr**. Es geht aber nur um ${spanWords(s, f)}: Nimm nur diesen Teil des Jahres.`,
        ),
      ),
    ],
    s.kind === "months" &&
      s.m > 1 && [
        Zy * s.m,
        tx("Divided by 12 forgotten", "Durch 12 teilen vergessen"),
        tx(
          `Ooh, you multiplied the yearly interest by $${s.m}$. But $${s.m}$ months are only $\\frac{${s.m}}{12}$ of a year, so divide by $12$ as well.`,
          `Ooh, du hast die Jahreszinsen mal $${s.m}$ genommen. Aber $${s.m}$ Monate sind nur $\\frac{${s.m}}{12}$ eines Jahres, teil also auch noch durch $12$.`,
        ),
      ],
    s.kind === "days" && [
      (Zy * s.t) / 365,
      tx("365 instead of 360 days", "365 statt 360 Tage"),
      tx(
        "So close! Banks count a year as **360 days** and every month as $30$ days (banking year). So take $\\frac{t}{360}$ of the yearly interest.",
        "Ganz knapp! Banken rechnen das Jahr mit **360 Tagen** und jeden Monat mit $30$ Tagen (Bankjahr). Nimm also $\\frac{t}{360}$ der Jahreszinsen.",
      ),
    ],
    s.kind === "days" && [
      (Zy * s.t) / 12,
      tx("Days treated as months", "Tage wie Monate behandelt"),
      tx(
        `Hmm, you divided by $12$ as if the $${s.t}$ were months. For days, it's $\\frac{${s.t}}{360}$ of a year.`,
        `Hm, du hast durch $12$ geteilt, als wären die $${s.t}$ Monate. Bei Tagen ist es $\\frac{${s.t}}{360}$ eines Jahres.`,
      ),
    ],
  ];
}

function capitalSlips(Z: number, p: number, s: Span): Slip[] {
  const K = ((Z / spanPart(s)) * 100) / p;
  return [
    s.kind !== "year" && [
      K * spanPart(s),
      NOT_SCALED,
      say((f) =>
        f.t(
          `I think you treated the $${f.c(Z)}$ € as yearly interest. But they're the interest for only ${spanWords(s, f)}: scale them up to a whole year first.`,
          `Ich glaub, du hast die $${f.c(Z)}$\u00a0€ als Jahreszinsen genommen. Das sind aber die Zinsen für nur ${spanWords(s, f)}: Rechne sie zuerst auf ein ganzes Jahr hoch.`,
        ),
      ),
    ],
    [
      (Z * p) / 100,
      tx("Percent of the interest", "Prozent von den Zinsen"),
      say((f) =>
        f.t(
          `Ah, you took $${f.n(p)} %$ **of** the interest. But the interest already **is** $${f.n(p)} %$ of the capital: rearrange $Z = K \\cdot \\frac{p}{100}$ for $K$.`,
          `Ah, du hast $${f.n(p)} %$ **von** den Zinsen genommen. Die Zinsen **sind** aber schon $${f.n(p)} %$ des Kapitals: Stell $Z = K \\cdot \\frac{p}{100}$ nach $K$ um.`,
        ),
      ),
    ],
  ];
}

function rateSlips(K: number, Z: number, s: Span): Slip[] {
  const p = ((Z / spanPart(s)) * 100) / K;
  return [
    s.kind !== "year" && [
      p * spanPart(s),
      NOT_SCALED,
      say((f) =>
        f.t(
          `That would be the rate for only ${spanWords(s, f)}. Interest rates are always **per year**: scale the $${f.c(Z)}$ € up to a whole year first.`,
          `Das wäre der Zinssatz für nur ${spanWords(s, f)}. Zinssätze gelten aber immer **pro Jahr**: Rechne die $${f.c(Z)}$\u00a0€ zuerst auf ein ganzes Jahr hoch.`,
        ),
      ),
    ],
    Z < 100 && [
      Z,
      tx("Interest isn't the rate", "Zinsen sind kein Zinssatz"),
      say((f) =>
        f.t(
          `Hmm, $${f.c(Z)}$ is the interest in euros, not a rate yet. Compare it with the capital: yearly interest divided by capital.`,
          `Hm, $${f.c(Z)}$ sind die Zinsen in Euro, noch kein Zinssatz. Vergleich sie mit dem Kapital: Jahreszinsen geteilt durch Kapital.`,
        ),
      ),
    ],
  ];
}

function timeSlips(K: number, p: number, Z: number, s: Span): Slip[] {
  const Zy = (K * p) / 100;
  const total = spanBottom(s);
  return [
    [
      Z / Zy,
      tx("Time in years", "Zeit in Jahren"),
      s.kind === "months"
        ? tx("Nearly! That's the time in **years**. The question asks for months: a year has $12$ of them.", "Fast! Das ist die Zeit in **Jahren**. Gefragt sind Monate: Ein Jahr hat $12$ davon.")
        : tx("Nearly! That's the time in **years**. The question asks for days: a banking year has $360$ of them.", "Fast! Das ist die Zeit in **Jahren**. Gefragt sind Tage: Ein Bankjahr hat $360$ davon."),
      0.0051,
    ],
    [
      (Zy / Z) * total,
      tx("Fraction upside down", "Bruch umgedreht"),
      say((f) =>
        f.t(
          `Ah, upside down! You need the part of the year: the interest you want ($${f.c(Z)}$ €) divided by the yearly interest ($${f.c(Zy)}$ €).`,
          `Ah, andersrum! Du brauchst den Anteil am Jahr: die gewünschten Zinsen ($${f.c(Z)}$\u00a0€) geteilt durch die Jahreszinsen ($${f.c(Zy)}$\u00a0€).`,
        ),
      ),
    ],
    s.kind === "days" && [
      (Z / Zy) * 365,
      tx("365 instead of 360 days", "365 statt 360 Tage"),
      tx("So close! Banks count a year as **360 days** (banking year).", "Ganz knapp! Banken rechnen das Jahr mit **360 Tagen** (Bankjahr)."),
      0.51,
    ],
  ];
}

// Interest tasks ---------------------------------------------------------------

type Kind = Span["kind"];

/** A word problem about interest; `short` stories (overdrafts) last only a few days. */
type InterestStory = { kinds: Kind[]; rates: number[]; caps: number[]; short?: boolean; text: (K: number, p: number, s: Span, f: Fmt) => string };

const INTEREST_STORIES: InterestStory[] = [
  {
    kinds: ["year"],
    rates: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
    caps: [2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000],
    text: (K, p, _s, f) =>
      f.t(
        `Grandma Hilde puts ${euro(f, K)} into a fixed-term deposit (Festgeld) for one year. The bank pays ${perc(f, p)} interest. How much interest does she get?`,
        `Oma Hilde legt ${euro(f, K)} für ein Jahr als Festgeld an. Die Bank zahlt ${perc(f, p)} Zinsen. Wie viel Zinsen bekommt sie?`,
      ),
  },
  {
    kinds: ["year", "months"],
    rates: [3, 4, 4.5, 5, 6, 7.5, 8],
    caps: [1200, 1800, 2400, 3000, 3600, 4800, 6000, 9000, 12000],
    text: (K, p, s, f) =>
      s.kind === "year"
        ? f.t(
            `A bakery takes out a loan of ${euro(f, K)} at ${perc(f, p)} interest per year. How much interest does it pay for one year?`,
            `Eine Bäckerei nimmt einen Kredit über ${euro(f, K)} zu ${perc(f, p)} Zinsen pro Jahr auf. Wie viel Zinsen zahlt sie für ein Jahr?`,
          )
        : f.t(
            `Mr Berger borrows ${euro(f, K)} at ${perc(f, p)} interest per year and pays it back after ${spanWords(s, f)}. How much interest does he pay?`,
            `Herr Berger leiht sich ${euro(f, K)} zu ${perc(f, p)} Zinsen pro Jahr und zahlt das Geld nach ${spanWords(s, f, true)} zurück. Wie viel Zinsen zahlt er?`,
          ),
  },
  {
    kinds: ["months"],
    rates: [1, 1.5, 2, 2.5, 3, 3.5, 4],
    caps: [600, 1200, 1500, 1800, 2400, 3000, 3600, 4800, 6000],
    text: (K, p, s, f) =>
      f.t(
        `Mia puts ${euro(f, K)} into an instant-access savings account (Tagesgeld) at ${perc(f, p)} interest per year. After ${spanWords(s, f)} she takes the money out again. How much interest does she get?`,
        `Mia legt ${euro(f, K)} auf ein Tagesgeldkonto mit ${perc(f, p)} Zinsen pro Jahr. Nach ${spanWords(s, f, true)} hebt sie das Geld wieder ab. Wie viel Zinsen bekommt sie?`,
      ),
  },
  {
    kinds: ["days"],
    short: true,
    rates: [9, 10, 11, 12, 13.5],
    caps: [300, 400, 500, 600, 800, 900, 1200, 1500],
    text: (K, p, s, f) =>
      f.t(
        `Leon's account was ${euro(f, K)} overdrawn for ${spanWords(s, f)}. The bank charges ${perc(f, p)} overdraft interest (Dispozinsen) per year. How much interest does he have to pay?`,
        `Leons Konto war ${spanWords(s, f)} lang mit ${euro(f, K)} im Minus. Die Bank verlangt dafür ${perc(f, p)} Dispozinsen pro Jahr. Wie viel Zinsen muss er zahlen?`,
      ),
  },
  {
    kinds: ["days"],
    rates: [1, 1.5, 2, 2.5, 3, 4],
    caps: [1800, 2400, 3600, 4500, 7200, 9000, 12000, 18000],
    text: (K, p, s, f) =>
      f.t(
        `Ms Özdemir invests ${euro(f, K)} for ${spanWords(s, f)} at ${perc(f, p)} interest per year. How much interest does she get?`,
        `Frau Özdemir legt ${euro(f, K)} für ${spanWords(s, f)} zu ${perc(f, p)} Zinsen pro Jahr an. Wie viel Zinsen bekommt sie?`,
      ),
  },
];

const DAYS_SHORT = [6, 8, 9, 10, 12, 15, 18, 20, 24, 25, 30, 36, 40, 45];
const DAYS_LONG = [20, 30, 36, 40, 45, 50, 60, 72, 75, 80, 90, 100, 120, 135, 144, 150, 180, 200, 210, 225, 240, 270, 300];

const drawSpan = (rng: Rng, kind: Kind, short = false): Span =>
  kind === "year" ? { kind } : kind === "months" ? { kind, m: rng.int(1, 11) } : { kind, t: rng.pick(short ? DAYS_SHORT : DAYS_LONG) };

const INTEREST_INSTRUCTION: Record<Kind, Text> = {
  year: tx("Calculate the yearly interest", "Berechne die Jahreszinsen"),
  months: tx("Calculate the interest for the months", "Berechne die Monatszinsen"),
  days: tx("Calculate the interest for the days", "Berechne die Tageszinsen"),
};

const INTEREST_HINT: Record<Kind, Text> = {
  year: tx("Capital times rate: $Z = K \\cdot \\frac{p}{100}$.", "Kapital mal Zinssatz: $Z = K \\cdot \\frac{p}{100}$."),
  months: tx("Yearly interest first, then take $\\frac{m}{12}$ of it.", "Erst die Jahreszinsen, davon dann $\\frac{m}{12}$."),
  days: tx(
    "Yearly interest first, then take $\\frac{t}{360}$ of it. A banking year has $360$ days.",
    "Erst die Jahreszinsen, davon dann $\\frac{t}{360}$. Ein Bankjahr hat $360$ Tage.",
  ),
};

/** Interest for a year, months or days; a word problem when `text` is given, else the bare numbers. */
function interestExercise(K: number, p: number, s: Span, text?: Text): Exercise {
  const Z = ((K * p) / 100) * spanPart(s);
  const answer = amount(Z, "€", text ? undefined : "Z =");
  return {
    instruction: INTEREST_INSTRUCTION[s.kind],
    ...(text ? { text } : { math: say((f) => `K = ${f.c(K)} "€" ,\\quad p % = ${f.n(p)} %${spanMath(s, f)}`) }),
    answer,
    hint: INTEREST_HINT[s.kind],
    solution: interestFrames(K, p, s),
    mistakes: mistakesFor(answer, interestSlips(K, p, s)),
  };
}

function interestTask(kind: Kind): Gen {
  return (rng) => {
    const story = rng.pick(INTEREST_STORIES.filter((st) => st.kinds.includes(kind)));
    const K = rng.pick(story.caps);
    const p = rng.pick(story.rates);
    const s = drawSpan(rng, kind, story.short);
    const Z = ((K * p) / 100) * spanPart(s);
    if (!cents(Z) || Z < 0.5) return null;
    return interestExercise(K, p, s, rng.chance(0.7) ? say((f) => story.text(K, p, s, f)) : undefined);
  };
}

function capitalTask(rng: Rng): Exercise | null {
  const K = rng.pick([1200, 1500, 1800, 2000, 2400, 2500, 3000, 3600, 4000, 4500, 4800, 5000, 6000, 7200, 8000, 9000, 10000, 12000]);
  const p = rng.pick([1, 1.5, 2, 2.5, 3, 4, 5, 6]);
  const s = drawSpan(rng, rng.pick(["year", "months", "months", "days"] as const));
  const Z = ((K * p) / 100) * spanPart(s);
  if (!cents(Z) || Z < 2) return null;
  return capitalExercise(K, p, s);
}

function capitalExercise(K: number, p: number, s: Span): Exercise {
  const Z = ((K * p) / 100) * spanPart(s);
  const answer = amount(K, "€");
  return {
    instruction: tx("Find the capital", "Berechne das Kapital"),
    text: say((f) =>
      s.kind === "year"
        ? f.t(
            `Lisa gets ${euro(f, Z)} interest after one year. The interest rate was ${perc(f, p)}. How much money had she put in?`,
            `Lisa bekommt nach einem Jahr ${euro(f, Z)} Zinsen. Der Zinssatz betrug ${perc(f, p)}. Wie viel Geld hatte sie angelegt?`,
          )
        : f.t(
            `Which capital earns ${euro(f, Z)} interest in ${spanWords(s, f)} at ${perc(f, p)} per year?`,
            `Welches Kapital bringt in ${spanWords(s, f, true)} bei ${perc(f, p)} pro Jahr ${euro(f, Z)} Zinsen?`,
          ),
    ),
    answer,
    hint:
      s.kind === "year"
        ? tx("The interest is $p %$ of the capital: $K = \\frac{Z \\cdot 100}{p}$.", "Die Zinsen sind $p %$ des Kapitals: $K = \\frac{Z \\cdot 100}{p}$.")
        : tx(
            "Scale the interest up to a whole year first. Then $K = \\frac{Z \\cdot 100}{p}$.",
            "Rechne die Zinsen zuerst auf ein ganzes Jahr hoch. Dann gilt $K = \\frac{Z \\cdot 100}{p}$.",
          ),
    solution: capitalFrames(Z, p, s),
    mistakes: mistakesFor(answer, capitalSlips(Z, p, s)),
  };
}

function rateTask(rng: Rng): Exercise | null {
  const K = rng.pick([800, 1000, 1200, 1500, 2000, 2400, 2500, 3000, 3600, 4000, 4500, 5000, 6000, 7200, 8000, 10000]);
  const p = rng.pick([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8]);
  const s = drawSpan(rng, rng.pick(["year", "months", "months", "days"] as const));
  const Z = ((K * p) / 100) * spanPart(s);
  if (!cents(Z) || Z < 2) return null;
  return rateExercise(K, p, s);
}

function rateExercise(K: number, p: number, s: Span): Exercise {
  const Z = ((K * p) / 100) * spanPart(s);
  const answer = rateAnswer(p);
  return {
    instruction: tx("Find the interest rate", "Berechne den Zinssatz"),
    text: say((f) =>
      s.kind === "year"
        ? f.t(
            `A savings account turns ${euro(f, K)} into ${euro(f, K + Z)} in one year. What is the interest rate?`,
            `Auf einem Sparkonto werden aus ${euro(f, K)} in einem Jahr ${euro(f, K + Z)}. Wie hoch ist der Zinssatz?`,
          )
        : s.kind === "months"
          ? f.t(
              `Mr Yilmaz borrows ${euro(f, K)}. After ${spanWords(s, f)} he pays it back with ${euro(f, Z)} interest. What is the interest rate per year?`,
              `Herr Yilmaz leiht sich ${euro(f, K)}. Nach ${spanWords(s, f, true)} zahlt er das Geld mit ${euro(f, Z)} Zinsen zurück. Wie hoch ist der Zinssatz pro Jahr?`,
            )
          : f.t(
              `${euro(f, K)} earn ${euro(f, Z)} interest in ${spanWords(s, f)}. What is the interest rate per year?`,
              `${euro(f, K)} bringen in ${spanWords(s, f, true)} ${euro(f, Z)} Zinsen. Wie hoch ist der Zinssatz pro Jahr?`,
            ),
    ),
    answer,
    hint: tx(
      "Find the interest for a whole year, then divide by the capital: $p % = \\frac{Z}{K}$.",
      "Bestimme die Zinsen für ein ganzes Jahr und teile durch das Kapital: $p % = \\frac{Z}{K}$.",
    ),
    solution: rateFrames(K, Z, s),
    mistakes: mistakesFor(answer, [
      ...rateSlips(K, Z, s),
      s.kind === "year" && [
        ((K + Z) / K) * 100,
        tx("New balance compared", "Neuen Kontostand verglichen"),
        tx(
          "Nearly! That's the new balance as a percentage of the old one. The interest rate is only the part above $100 %$.",
          "Fast! Das ist der neue Kontostand in Prozent vom alten. Der Zinssatz ist nur der Teil über $100 %$.",
        ),
      ],
    ]),
  };
}

function timeTask(rng: Rng): Exercise | null {
  const K = rng.pick([1200, 1800, 2400, 3000, 3600, 4000, 4800, 6000, 7200, 9000, 12000]);
  const p = rng.pick([1, 1.5, 2, 2.5, 3, 4, 5, 6]);
  const s = drawSpan(rng, rng.chance(0.5) ? "months" : "days");
  const Z = ((K * p) / 100) * spanPart(s);
  if (!cents(Z) || Z < 2) return null;
  return timeExercise(K, p, s);
}

function timeExercise(K: number, p: number, s: Span): Exercise {
  const Z = ((K * p) / 100) * spanPart(s);
  const months = s.kind === "months";
  const answer = amount(spanTop(s), months ? "months" : "days");
  return {
    instruction: tx("Find the time", "Berechne die Zeit"),
    text: say((f) =>
      months
        ? f.t(
            `For how long must ${euro(f, K)} be invested at ${perc(f, p)} per year to earn ${euro(f, Z)} interest? Give the time in months.`,
            `Wie lange muss man ${euro(f, K)} zu ${perc(f, p)} pro Jahr anlegen, um ${euro(f, Z)} Zinsen zu bekommen? Gib die Zeit in Monaten an.`,
          )
        : f.t(
            `For how many days must ${euro(f, K)} be invested at ${perc(f, p)} per year to earn ${euro(f, Z)} interest? (Banking year: 360 days)`,
            `Wie viele Tage muss man ${euro(f, K)} zu ${perc(f, p)} pro Jahr anlegen, um ${euro(f, Z)} Zinsen zu bekommen? (Bankjahr: 360 Tage)`,
          ),
    ),
    answer,
    hint: months
      ? tx("Work out the interest for a whole year. Which part of it do you need? A year has $12$ months.", "Rechne die Zinsen für ein ganzes Jahr aus. Welchen Teil davon brauchst du? Ein Jahr hat $12$ Monate.")
      : tx("Work out the interest for a whole year. Which part of it do you need? A banking year has $360$ days.", "Rechne die Zinsen für ein ganzes Jahr aus. Welchen Teil davon brauchst du? Ein Bankjahr hat $360$ Tage."),
    solution: timeFrames(K, p, Z, s),
    mistakes: mistakesFor(answer, timeSlips(K, p, Z, s)),
  };
}


// ---------------------------------------------------------------------------
// Several changes in a row (tasks from the old one-lesson topic)

const changeNote = (c: Change, { t, n }: Fmt) =>
  c.up
    ? t(`a rise of $${c.p} %$ means $\\cdot\\, ${n(factorOf(c))}$`, `eine Zunahme um $${c.p} %$ heißt $\\cdot\\, ${n(factorOf(c))}$`)
    : t(`a drop of $${c.p} %$ means $\\cdot\\, ${n(factorOf(c))}$`, `eine Abnahme um $${c.p} %$ heißt $\\cdot\\, ${n(factorOf(c))}$`);
const changeList = (changes: Change[], f: Fmt) => changes.map((c) => changeNote(c, f)).join(f.t(", and ", " und "));

/** Two changes in a row, step by step. */
function chainFrames(G: number, changes: Change[], unit: Unit): Frame[] {
  const fac = changes.map(factorOf);
  const tail = (from: number, n: Fmt["n"]) =>
    fac
      .slice(from)
      .map((q, i) => ` \\cdot#t${from + i} ${n(q)}#q${from + i}`)
      .join("");
  const frames: Frame[] = [
    {
      math: say(({ a, n, ut }) => `${a(G, unit)}#v${ut(unit, "u")}${tail(0, n)}`),
      note: say((f) => f.t(`Each change is one growth factor: ${changeList(changes, f)}.`, `Jede Änderung ist ein Wachstumsfaktor: ${changeList(changes, f)}.`)),
    },
  ];
  let v = G;
  fac.forEach((q, i) => {
    const before = v;
    v *= q;
    const now = v;
    frames.push({
      math: say(({ a, n, ut }) => `${a(now, unit)}#v${ut(unit, "u")}${tail(i + 1, n)}`),
      note: say(
        ({ t, a, n, uw }) => `${i === 0 ? t("First change", "Erste Änderung") : t("Next change", "Nächste Änderung")}: $${a(before, unit)} \\cdot ${n(q)} = ${a(now, unit)}$${uw(unit)}.`,
      ),
    });
  });
  return frames;
}

/** Total change of several changes: multiply the factors. */
function totalFrames(changes: Change[]): Frame[] {
  const fac = changes.map(factorOf);
  const Q = fac.reduce((a, b) => a * b, 1);
  const prod = (n: Fmt["n"]) => fac.map((q, i) => `${i ? ` \\cdot#t${i} ` : ""}${n(q)}#q${i}`).join("");
  const pct = r6(Math.abs(Q - 1) * 100);
  return [
    {
      math: say(({ n }) => prod(n)),
      note: say((f) => f.t(`Turn each change into a growth factor: ${changeList(changes, f)}.`, `Mach aus jeder Änderung einen Wachstumsfaktor: ${changeList(changes, f)}.`)),
    },
    {
      math: say(({ n }) => `${prod(n)} =#e ${n(Q)}#Q`),
      note: say(({ t, n }) => t(`Multiply the factors: $q = ${n(Q)}$.`, `Multipliziere die Faktoren: $q = ${n(Q)}$.`)),
      highlight: ["Q"],
    },
    {
      math: say(({ n }) => `${n(Q)}#Q =#e2 ${n(Q * 100)}#P %#pc`),
      note: say(({ t, n }) => t(`The final value is $${n(Q * 100)} %$ of the original.`, `Der Endwert ist $${n(Q * 100)} %$ des Anfangswerts.`)),
      highlight: ["P"],
    },
    {
      math: say(({ n }) =>
        Q > 1 ? `${n(Q * 100)}#P %#pc -#m 100#H %#hp =#e3 ${n(pct)}#A %#ap` : `100#H %#hp -#m ${n(Q * 100)}#P %#pc =#e3 ${n(pct)}#A %#ap`,
      ),
      note: say(({ t, n }) =>
        Q > 1
          ? t(`Compared with the $100 %$ at the start, that's $${n(pct)} %$ more.`, `Verglichen mit den $100 %$ am Anfang sind das $${n(pct)} %$ mehr.`)
          : t(`Compared with the $100 %$ at the start, that's $${n(pct)} %$ less.`, `Verglichen mit den $100 %$ am Anfang sind das $${n(pct)} %$ weniger.`),
      ),
      highlight: ["A"],
    },
  ];
}

const CHAIN_STORIES: { text: (G: string, a: Change, b: Change) => Text; signs: [boolean, boolean] }[] = [
  {
    signs: [true, false],
    text: (G, a, b) =>
      tx(
        `A bike costs ${G} €. First the price goes up by ${a.p} %, later it is reduced by ${b.p} %. What does the bike cost now?`,
        `Ein Fahrrad kostet ${G}\u00a0€. Zuerst steigt der Preis um ${a.p}\u00a0%, später wird er um ${b.p}\u00a0% gesenkt. Wie viel kostet das Fahrrad jetzt?`,
      ),
  },
  {
    signs: [true, false],
    text: (G, a, b) =>
      tx(
        `A share is worth ${G} €. On Monday its value rises by ${a.p} %, on Tuesday it falls by ${b.p} %. What is it worth now?`,
        `Eine Aktie ist ${G}\u00a0€ wert. Am Montag steigt ihr Wert um ${a.p}\u00a0%, am Dienstag fällt er um ${b.p}\u00a0%. Wie viel ist sie jetzt wert?`,
      ),
  },
  {
    signs: [false, true],
    text: (G, a, b) =>
      tx(
        `In a sale, a TV is reduced from ${G} € by ${a.p} %. After the sale, the reduced price goes up by ${b.p} %. What does the TV cost after the sale?`,
        `Im Angebot wird ein Fernseher von ${G}\u00a0€ um ${a.p}\u00a0% reduziert. Nach der Aktion steigt der reduzierte Preis um ${b.p}\u00a0%. Wie viel kostet der Fernseher nach der Aktion?`,
      ),
  },
  {
    signs: [true, true],
    text: (G, a, b) =>
      tx(
        `A shop raises a price of ${G} € by ${a.p} %. A month later it raises the new price by another ${b.p} %. What is the final price?`,
        `Ein Laden erhöht einen Preis von ${G}\u00a0€ um ${a.p}\u00a0%. Einen Monat später erhöht er den neuen Preis noch einmal um ${b.p}\u00a0%. Wie hoch ist der Endpreis?`,
      ),
  },
];

function chainTask(rng: Rng): Exercise | null {
  const story = rng.pick(CHAIN_STORIES);
  const pa = rng.pick([10, 20, 25, 50, 5]);
  const pb = rng.chance(0.4) ? pa : rng.pick([10, 20, 25, 50, 5]);
  const a: Change = { up: story.signs[0], p: pa };
  const b: Change = { up: story.signs[1], p: pb };
  const G = rng.pick([100, 200, 400, 500, 800, 1000, 50, 300, 250]);
  const N = G * factorOf(a) * factorOf(b);
  if (Math.abs(r2(N) - N) > 1e-9) return null;
  const same = a.p === b.p && a.up !== b.up;
  return {
    instruction: WORD_PROBLEM,
    text: story.text(String(G), a, b),
    answer: amount(N, "€"),
    hint: same
      ? tx(
          "Careful: the second change works on the **new** price. Multiply by both growth factors.",
          "Vorsicht: Die zweite Änderung bezieht sich auf den **neuen** Preis. Multipliziere mit beiden Wachstumsfaktoren.",
        )
      : tx("One growth factor per change. Multiply the price by both.", "Ein Wachstumsfaktor pro Änderung. Multipliziere den Preis mit beiden."),
    solution: chainFrames(G, [a, b], "€"),
    mistakes: mistakesFor(amount(N, "€"), chainSlips(G, a, b)),
  };
}

/** Two changes in a row. */
function chainSlips(G: number, a: Change, b: Change): Slip[] {
  const signed = (c: Change) => `${c.up ? "+" : "-"}${c.p} %`;
  const cancel = a.p === b.p && a.up !== b.up;
  const small = [a, b].find((c) => c.p < 10);
  const tenths = (c: Change) => (c.p < 10 ? 1 + (c.up ? c.p : -c.p) / 10 : factorOf(c));
  return [
    [
      G * (1 + ((a.up ? a.p : -a.p) + (b.up ? b.p : -b.p)) / 100),
      cancel ? tx("Back to the start?", "Wieder am Anfang?") : tx("Percentages added", "Prozente addiert"),
      cancel
        ? tx(
            `Ooh, tempting! But $${signed(a)}$ and $${signed(b)}$ don't cancel out: the second change works on the **new** price, not on the original one.`,
            `Ooh, verlockend! Aber $${signed(a)}$ und $${signed(b)}$ heben sich nicht auf: Die zweite Änderung bezieht sich auf den **neuen** Preis, nicht auf den ursprünglichen.`,
          )
        : tx(
            "Ooh, tempting! You just added up the percentages. But the second change works on the **new** price, not on the original one.",
            "Ooh, verlockend! Du hast die Prozentsätze einfach zusammengerechnet. Die zweite Änderung bezieht sich aber auf den **neuen** Preis, nicht auf den ursprünglichen.",
          ),
    ],
    small ? [G * tenths(a) * tenths(b), FACTOR_OFF, factorOff(small.p, small.up)] : null,
  ];
}

function totalChangeTask(rng: Rng): Exercise | null {
  const kind = rng.int(0, 2);
  const p1 = rng.pick([10, 20, 25, 30, 50]);
  const p2 = rng.pick([10, 20, 25, 30, 50]);
  let changes: Change[];
  let text: Text;
  if (kind === 0) {
    changes = [
      { up: true, p: p1 },
      { up: false, p: p1 },
    ];
    text = tx(
      `A price goes up by ${p1} % and later goes down by ${p1} %. By how many percent is the final price lower than the original price?`,
      `Ein Preis steigt um ${p1}\u00a0% und sinkt später wieder um ${p1}\u00a0%. Um wie viel Prozent ist der Endpreis niedriger als der ursprüngliche Preis?`,
    );
  } else if (kind === 1) {
    changes = [
      { up: true, p: p1 },
      { up: true, p: p2 },
    ];
    text = tx(
      `A price rises by ${p1} %, and later by another ${p2} %. By how many percent has it risen in total?`,
      `Ein Preis steigt um ${p1}\u00a0% und später noch einmal um ${p2}\u00a0%. Um wie viel Prozent ist er insgesamt gestiegen?`,
    );
  } else {
    changes = [
      { up: false, p: p1 },
      { up: false, p: p2 },
    ];
    text = tx(
      `In a sale, a price is reduced by ${p1} %. On the last day, the sale price is cut by another ${p2} %. By how many percent is the final price lower than the original price?`,
      `Im Schlussverkauf wird ein Preis um ${p1}\u00a0% reduziert. Am letzten Tag wird der reduzierte Preis noch einmal um ${p2}\u00a0% gesenkt. Um wie viel Prozent ist der Endpreis niedriger als der ursprüngliche Preis?`,
    );
  }
  const Q = changes.map(factorOf).reduce((x, y) => x * y, 1);
  const pct = r6(Math.abs(Q - 1) * 100);
  if (pct === 0 || pct >= 100) return null;
  return {
    instruction: WORD_PROBLEM,
    text,
    answer: rateAnswer(pct),
    hint: tx(
      "Don't just add the percentages. Multiply the growth factors, then compare with $1$.",
      "Nicht einfach die Prozentsätze addieren! Multipliziere die Wachstumsfaktoren und vergleiche dann mit $1$.",
    ),
    solution: totalFrames(changes),
    mistakes: mistakesFor(rateAnswer(pct), [
      kind === 0
        ? [
            0,
            tx("Back to the start?", "Wieder am Anfang?"),
            tx(
              `Ooh, the classic trap! It feels like $+${p1} %$ and $-${p1} %$ cancel out. But the drop is $${p1} %$ of the **new**, higher price.`,
              `Die klassische Falle! Es fühlt sich an, als würden sich $+${p1} %$ und $-${p1} %$ aufheben. Aber die Senkung beträgt $${p1} %$ vom **neuen**, höheren Preis.`,
            ),
          ]
        : [
            p1 + p2,
            tx("Percentages added", "Prozente addiert"),
            kind === 1
              ? tx(
                  `Ooh, tempting! But you can't just add the percentages: the second rise is $${p2} %$ of the **new**, higher price. Multiply the growth factors instead.`,
                  `Ooh, verlockend! Aber Prozentsätze darfst du nicht einfach addieren: Die zweite Erhöhung beträgt $${p2} %$ vom **neuen**, höheren Preis. Multipliziere stattdessen die Wachstumsfaktoren.`,
                )
              : tx(
                  `Ooh, tempting! But you can't just add the percentages: the second cut is $${p2} %$ of the **reduced** price. Multiply the growth factors instead.`,
                  `Ooh, verlockend! Aber Prozentsätze darfst du nicht einfach addieren: Die zweite Senkung beträgt $${p2} %$ vom **reduzierten** Preis. Multipliziere stattdessen die Wachstumsfaktoren.`,
                ),
          ],
      [
        Q * 100,
        tx("Final value, not the change", "Endwert statt Änderung"),
        say(({ t, n }) =>
          t(
            `Nearly! $${n(Q * 100)} %$ is the final price compared with the original. But the question asks how much it **changed**.`,
            `Fast! $${n(Q * 100)} %$ ist der Endpreis im Vergleich zum Anfang. Gefragt ist aber, um wie viel er sich **verändert** hat.`,
          ),
        ),
      ],
    ]),
  };
}

// ---------------------------------------------------------------------------
// VAT (Mehrwertsteuer): net · 1.19 = gross, gross : 1.19 = net

type VatAsk = "gross" | "net" | "tax";

function vatFrames(net: number, rate: number, ask: VatAsk): Frame[] {
  const q = 1 + rate / 100;
  const gross = net * q;
  if (ask === "gross")
    return [
      {
        math: `100#a %#ap +#pl ${rate}#b %#bp =#e ${100 + rate}#c %#cp`,
        note: tx(
          `The net price is $100 %$. With $${rate} %$ VAT on top, the gross price is $${100 + rate} %$ of it.`,
          `Der Nettopreis ist $100 %$. Mit $${rate} %$ Mehrwertsteuer obendrauf ist der Bruttopreis $${100 + rate} %$ davon.`,
        ),
      },
      {
        math: say(({ n }) => `q#q =#e ${100 + rate}#c %#cp =#e2 ${n(q)}#f`),
        note: say((f) => f.t(`As a factor: $q = ${f.n(q)}$.`, `Als Faktor: $q = ${f.n(q)}$.`)),
        highlight: ["f"],
      },
      {
        math: say(({ c, n }) => `${c(net)}#N "€"#u \\cdot#t ${n(q)}#f =#e3 ${c(gross)}#B "€"#u2`),
        note: say((f) =>
          f.t(`Net price times $${f.n(q)}$: $${f.c(net)} \\cdot ${f.n(q)} = ${f.c(gross)}$ €.`, `Nettopreis mal $${f.n(q)}$: $${f.c(net)} \\cdot ${f.n(q)} = ${f.c(gross)}$\u00a0€.`),
        ),
        highlight: ["B"],
      },
    ];
  const back: Frame[] = [
    {
      math: say(({ c, n }) => `N#N \\cdot#t ${n(q)}#f =#e ${c(gross)}#B "€"#u`),
      note: say((f) =>
        f.t(
          `The unknown net price $N$ times $${f.n(q)}$ gives the gross price $${f.c(gross)}$ €.`,
          `Der unbekannte Nettopreis $N$ mal $${f.n(q)}$ ergibt den Bruttopreis $${f.c(gross)}$\u00a0€.`,
        ),
      ),
      highlight: ["f"],
    },
    {
      math: say(({ c, n }) => `N#N =#e ${c(gross)}#B "€"#u :#t2 ${n(q)}#f`),
      note: say((f) => f.t(`So divide by $${f.n(q)}$.`, `Also teilst du durch $${f.n(q)}$.`)),
      highlight: ["t2", "f"],
    },
    {
      math: say(({ c }) => `N#N =#e ${c(net)}#r "€"#u`),
      note: say((f) =>
        f.t(
          `$${f.c(gross)} : ${f.n(q)} = ${f.c(net)}$ €. Check: $${f.c(net)} \\cdot ${f.n(q)} = ${f.c(gross)}$.`,
          `$${f.c(gross)} : ${f.n(q)} = ${f.c(net)}$\u00a0€. Probe: $${f.c(net)} \\cdot ${f.n(q)} = ${f.c(gross)}$.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
  if (ask === "net") return back;
  return [
    ...back,
    {
      math: say(({ c }) => `${c(gross)}#B "€"#u -#m ${c(net)}#r "€"#u3 =#e2 ${c(gross - net)}#T "€"#u4`),
      note: say((f) =>
        f.t(`The VAT is the difference between gross and net: $${f.c(gross - net)}$ €.`, `Die Mehrwertsteuer ist der Unterschied zwischen brutto und netto: $${f.c(gross - net)}$\u00a0€.`),
      ),
      highlight: ["T"],
    },
  ];
}

const VAT_ITEMS: { rate: 19 | 7; nets: number[]; en: string; de: string }[] = [
  { rate: 19, nets: [250, 300, 350, 400, 450, 500, 600, 700, 800], en: "A bike", de: "Ein Fahrrad" },
  { rate: 19, nets: [400, 450, 500, 550, 600, 700, 800, 900, 1000], en: "A laptop", de: "Ein Laptop" },
  { rate: 19, nets: [300, 350, 400, 450, 500, 600], en: "A washing machine", de: "Eine Waschmaschine" },
  { rate: 19, nets: [120, 150, 180, 200, 250, 300], en: "A desk", de: "Ein Schreibtisch" },
  { rate: 19, nets: [200, 250, 300, 400, 500, 600, 700], en: "A smartphone", de: "Ein Smartphone" },
  { rate: 7, nets: [20, 25, 30, 40, 50, 60], en: "A dictionary", de: "Ein Wörterbuch" },
  { rate: 7, nets: [100, 150, 200, 250, 300, 400], en: "A set of school books", de: "Ein Satz Schulbücher" },
  { rate: 7, nets: [200, 300, 400, 500, 600, 800], en: "A food delivery for the school canteen", de: "Eine Lebensmittellieferung für die Schulmensa" },
];

const VAT_INSTRUCTION: Record<VatAsk, Text> = {
  gross: tx("Find the gross price", "Berechne den Bruttopreis"),
  net: tx("Find the net price", "Berechne den Nettopreis"),
  tax: tx("Find the VAT included", "Berechne die enthaltene Mehrwertsteuer"),
};

function vatTask(rng: Rng): Exercise | null {
  const item = rng.pick(VAT_ITEMS);
  return vatExercise(item, rng.pick(item.nets), rng.pick(["gross", "net", "net", "tax", "tax"] as const));
}

function vatExercise(item: (typeof VAT_ITEMS)[number], net: number, ask: VatAsk): Exercise {
  const rate = item.rate;
  const q = 1 + rate / 100;
  const gross = r2(net * q);
  const reduced = (f: Fmt) => (rate === 7 ? f.t(" (the reduced rate for food and books)", " (der ermäßigte Satz für Lebensmittel und Bücher)") : "");
  const text = say((f) =>
    ask === "gross"
      ? f.t(
          `${item.en} costs ${euro(f, net)} before VAT (net price). VAT is ${perc(f, rate)}${reduced(f)}. What is the price including VAT (gross price)?`,
          `${item.de} kostet netto ${euro(f, net)}. Dazu kommen ${perc(f, rate)} Mehrwertsteuer${reduced(f)}. Wie hoch ist der Bruttopreis?`,
        )
      : ask === "net"
        ? f.t(
            `${item.en} costs ${euro(f, gross)} including ${perc(f, rate)} VAT. What is the price without VAT (net price)?`,
            `${item.de} kostet ${euro(f, gross)} inklusive ${perc(f, rate)} Mehrwertsteuer. Wie hoch ist der Nettopreis?`,
          )
        : f.t(
            `${item.en} costs ${euro(f, gross)} including ${perc(f, rate)} VAT. How much VAT is included in the price?`,
            `${item.de} kostet ${euro(f, gross)} inklusive ${perc(f, rate)} Mehrwertsteuer. Wie viel Mehrwertsteuer ist im Preis enthalten?`,
          ),
  );
  const value = ask === "gross" ? gross : ask === "net" ? net : gross - net;
  const answer = amount(value, "€");
  const slips: Slip[] =
    ask === "gross"
      ? changeSlips(net, rate, true, "€", true)
      : ask === "net"
        ? reverseSlips(gross, rate, true, true)
        : [
            [
              (gross * rate) / 100,
              tx("VAT of the gross price", "Steuer vom Bruttopreis"),
              tx(
                `Ooh, classic trap! You took $${rate} %$ of the price **with** VAT. But the VAT is $${rate} %$ of the **net** price, so find the net price first.`,
                `Die klassische Falle! Du hast $${rate} %$ vom Preis **mit** Steuer genommen. Die Mehrwertsteuer beträgt aber $${rate} %$ vom **Nettopreis**, also bestimm zuerst den Nettopreis.`,
              ),
            ],
            [
              net,
              tx("That's the net price", "Das ist der Nettopreis"),
              tx("Nearly! That's the net price. The VAT is the difference between gross and net.", "Fast! Das ist der Nettopreis. Die Mehrwertsteuer ist der Unterschied zwischen brutto und netto."),
            ],
          ];
  return {
    instruction: VAT_INSTRUCTION[ask],
    text,
    answer,
    hint: say((f) =>
      ask === "gross"
        ? f.t(`Net price times $${f.n(q)}$.`, `Nettopreis mal $${f.n(q)}$.`)
        : ask === "net"
          ? f.t(
              `The gross price is $${100 + rate} %$ of the net price: divide by $${f.n(q)}$.`,
              `Der Bruttopreis ist $${100 + rate} %$ des Nettopreises: Teile durch $${f.n(q)}$.`,
            )
          : f.t(`Find the net price first (divide by $${f.n(q)}$), then gross minus net.`, `Bestimm zuerst den Nettopreis (durch $${f.n(q)}$ teilen), dann brutto minus netto.`),
    ),
    solution: vatFrames(net, rate, ask),
    mistakes: mistakesFor(answer, slips),
  };
}

// ---------------------------------------------------------------------------
// Invoices: discount, cash discount (Skonto) and VAT in a row

const ADDED = tx("Percentages added", "Prozente addiert");

const CRAFTS: { en: string; de: string }[] = [
  { en: "a painter", de: "eines Malers" },
  { en: "an electrician", de: "einer Elektrikerin" },
  { en: "a roofer", de: "eines Dachdeckers" },
  { en: "a carpenter", de: "einer Tischlerin" },
  { en: "a plumber", de: "eines Installateurs" },
];

/** Net invoice + 19 % VAT − s % Skonto. */
function invoiceTask(rng: Rng): Exercise | null {
  const N = 100 * rng.int(3, 40);
  const s = rng.pick([2, 2, 3]);
  if (!cents(N * 1.19 * (1 - s / 100))) return null;
  return invoiceExercise(N, s, rng.pick(CRAFTS));
}

function invoiceExercise(N: number, s: number, who: (typeof CRAFTS)[number]): Exercise {
  const changes: Change[] = [
    { up: true, p: 19 },
    { up: false, p: s },
  ];
  const pay = N * 1.19 * (1 - s / 100);
  const answer = amount(pay, "€");
  return {
    instruction: tx("Invoice with VAT and Skonto", "Rechnung mit Mehrwertsteuer und Skonto"),
    text: say((f) =>
      f.t(
        `The Weber family gets an invoice from ${who.en}: ${euro(f, N)} net, plus ${perc(f, 19)} VAT. If the family pays within 10 days, they may take off ${perc(f, s)} cash discount (Skonto). How much do they pay if they pay straight away?`,
        `Die Rechnung ${who.de} beträgt netto ${euro(f, N)}. Dazu kommen ${perc(f, 19)} Mehrwertsteuer. Bei Zahlung innerhalb von 10 Tagen darf Familie Weber ${perc(f, s)} Skonto abziehen. Wie viel zahlt sie, wenn sie sofort zahlt?`,
      ),
    ),
    answer,
    hint: say((f) =>
      f.t(
        `One factor per change: $\\cdot\\, 1.19$ for the VAT and $\\cdot\\, ${f.n(1 - s / 100)}$ for the Skonto.`,
        `Ein Faktor pro Änderung: $\\cdot\\, 1,19$ für die Mehrwertsteuer und $\\cdot\\, ${f.n(1 - s / 100)}$ für das Skonto.`,
      ),
    ),
    solution: chainFrames(N, changes, "€"),
    mistakes: mistakesFor(answer, [
      [
        N * (1 + (19 - s) / 100),
        ADDED,
        tx(
          `Ooh, tempting! You calculated $+19 % - ${s} % = +${19 - s} %$. But the Skonto comes off the price **with** VAT, a bigger base value. Multiply the two factors.`,
          `Ooh, verlockend! Du hast $+19 % - ${s} % = +${19 - s} %$ gerechnet. Das Skonto wird aber vom Preis **mit** Steuer abgezogen, also von einem größeren Grundwert. Multipliziere die beiden Faktoren.`,
        ),
      ],
      [
        N * 1.19,
        tx("Skonto forgotten", "Skonto vergessen"),
        tx("Nearly! That's the gross price. They pay straight away, so the Skonto still comes off.", "Fast! Das ist der Bruttopreis. Familie Weber zahlt sofort, das Skonto kommt also noch weg."),
      ],
      [
        N * (1 - s / 100),
        tx("VAT forgotten", "Mehrwertsteuer vergessen"),
        tx("Hmm, the VAT is missing. The invoice is a net amount: the $19 %$ still have to go on top.", "Hm, da fehlt die Mehrwertsteuer. Die Rechnung ist ein Nettobetrag: Die $19 %$ kommen noch dazu."),
      ],
    ]),
  };
}

/** List price − r % discount − s % Skonto on the reduced price. */
function discountSkontoTask(rng: Rng): Exercise | null {
  const L = 100 * rng.int(2, 30);
  const r = rng.pick([5, 10, 15, 20, 25, 30]);
  const s = rng.pick([2, 3]);
  const changes: Change[] = [
    { up: false, p: r },
    { up: false, p: s },
  ];
  const Q = (1 - r / 100) * (1 - s / 100);
  const story = say((f) =>
    f.t(
      `A bike shop orders bikes at a list price of ${euro(f, L)}. The wholesaler gives ${perc(f, r)} discount. For paying within 14 days, there is another ${perc(f, s)} cash discount (Skonto) on the reduced price.`,
      `Ein Fahrradladen bestellt Räder zum Listenpreis von ${euro(f, L)}. Der Großhändler gewährt ${perc(f, r)} Rabatt. Bei Zahlung innerhalb von 14 Tagen gibt es auf den reduzierten Preis noch ${perc(f, s)} Skonto.`,
    ),
  );
  const join = (q: Text) => (typeof story === "string" || typeof q === "string" ? story : tx(`${story.en} ${q.en}`, `${story.de} ${q.de}`));
  const instruction = tx("Discount, then Skonto", "Rabatt, dann Skonto");
  if (rng.chance(0.65)) {
    const answer = amount(L * Q, "€");
    return {
      instruction,
      text: join(tx("How much does the shop pay?", "Wie viel zahlt der Laden?")),
      answer,
      hint: say((f) =>
        f.t(`Two factors: $${f.n(1 - r / 100)}$ for the discount, then $${f.n(1 - s / 100)}$ for the Skonto.`, `Zwei Faktoren: $${f.n(1 - r / 100)}$ für den Rabatt, dann $${f.n(1 - s / 100)}$ für das Skonto.`),
      ),
      solution: chainFrames(L, changes, "€"),
      mistakes: mistakesFor(answer, [
        [
          L * (1 - (r + s) / 100),
          ADDED,
          tx(
            `Ooh, tempting! But the Skonto is $${s} %$ of the **reduced** price, not of the list price. Multiply the two factors.`,
            `Ooh, verlockend! Das Skonto beträgt aber $${s} %$ vom **reduzierten** Preis, nicht vom Listenpreis. Multipliziere die beiden Faktoren.`,
          ),
        ],
        [
          L * (1 - r / 100),
          tx("Skonto forgotten", "Skonto vergessen"),
          tx("Nearly! That's the price after the discount. The shop pays quickly, so the Skonto still comes off.", "Fast! Das ist der Preis nach dem Rabatt. Der Laden zahlt schnell, das Skonto kommt also noch weg."),
        ],
      ]),
    };
  }
  const pct = r6((1 - Q) * 100);
  const answer = rateAnswer(pct);
  return {
    instruction,
    text: join(tx("By how many percent is the amount paid lower than the list price?", "Um wie viel Prozent liegt der Zahlbetrag unter dem Listenpreis?")),
    answer,
    hint: tx("Multiply the two factors, then compare with $1$.", "Multipliziere die beiden Faktoren und vergleiche dann mit $1$."),
    solution: totalFrames(changes),
    mistakes: mistakesFor(answer, [
      [
        r + s,
        ADDED,
        tx(
          `Ooh, tempting! But the $${s} %$ are taken from the **reduced** price, so together it's a bit less than $${r + s} %$.`,
          `Ooh, verlockend! Die $${s} %$ werden aber vom **reduzierten** Preis abgezogen, zusammen ist es also etwas weniger als $${r + s} %$.`,
        ),
      ],
      [
        Q * 100,
        tx("Amount paid, not the saving", "Zahlbetrag statt Ersparnis"),
        say((f) =>
          f.t(
            `Nearly! The shop pays $${f.n(Q * 100)} %$ of the list price. But the question asks how much **less** that is.`,
            `Fast! Der Laden zahlt $${f.n(Q * 100)} %$ des Listenpreises. Gefragt ist aber, um wie viel **weniger** das ist.`,
          ),
        ),
      ],
    ]),
  };
}

// ---------------------------------------------------------------------------
// Which offer is cheaper? One big discount or two smaller ones in a row

const OFFER_PAIRS: [number, number][] = [
  [20, 10],
  [10, 10],
  [20, 20],
  [30, 10],
  [50, 10],
  [20, 5],
  [10, 5],
  [40, 10],
  [25, 20],
  [30, 20],
  [50, 20],
  [15, 10],
  [10, 20],
];

const OFFER_ITEMS: { en: string; de: string; prices: number[] }[] = [
  { en: "A jacket", de: "Eine Jacke", prices: [80, 100, 120, 150, 200] },
  { en: "A pair of trainers", de: "Ein Paar Turnschuhe", prices: [60, 80, 100, 120, 150] },
  { en: "A bike", de: "Ein Fahrrad", prices: [400, 500, 600, 800] },
  { en: "A games console", de: "Eine Spielkonsole", prices: [250, 300, 400, 500] },
];

function offerTask(rng: Rng): Exercise | null {
  const [r, s] = rng.pick(OFFER_PAIRS);
  const item = rng.pick(OFFER_ITEMS);
  const P = rng.pick(item.prices);
  const both = r6(100 - ((100 - r) * (100 - s)) / 100);
  const kind = rng.pick(["added", "added", "same", "two"] as const);
  let d: number;
  if (kind === "added") d = r + s;
  else if (kind === "same") d = both;
  else {
    const options = [5 * Math.floor((both - 0.5) / 5), Math.floor(both) - 1, Math.floor(both) - 2].filter((x) => x > Math.max(r, s) && x < both);
    if (!options.length) return null;
    d = rng.pick(options);
  }
  if (!Number.isInteger(d) || d >= 100) return null;
  const singleIsA = rng.chance(0.5);
  const qd = 1 - d / 100;
  const qt = (1 - r / 100) * (1 - s / 100);
  const options: Text[] = [tx("Offer A is cheaper.", "Angebot A ist günstiger."), tx("Offer B is cheaper.", "Angebot B ist günstiger."), tx("Both cost the same.", "Beide kosten gleich viel.")];
  const single = singleIsA ? 0 : 1;
  const two = singleIsA ? 1 : 0;
  const correct = kind === "added" ? single : kind === "same" ? 2 : two;
  const offerSingle = (f: Fmt) => f.t(`${perc(f, d)} off the price`, `${perc(f, d)} Rabatt auf den Preis`);
  const offerTwo = (f: Fmt) =>
    f.t(`${perc(f, r)} off, and at the till another ${perc(f, s)} off the reduced price`, `${perc(f, r)} Rabatt und an der Kasse noch einmal ${perc(f, s)} auf den reduzierten Preis`);
  const pick = (i: number, title: Text, said: Text): Mistake => ({ when: { kind: "choice", options, correct: i }, title, say: said });
  const compare = tx(
    "Hmm, compare the total factors. Two discounts in a row multiply; the smaller factor means the lower price.",
    "Hm, vergleich die Gesamtfaktoren. Zwei Rabatte nacheinander werden multipliziert; der kleinere Faktor bedeutet den niedrigeren Preis.",
  );
  const mistakes: Mistake[] = [0, 1, 2]
    .filter((i) => i !== correct)
    .map((i) =>
      kind === "added" && i === 2
        ? pick(
            i,
            ADDED,
            tx(
              `Ooh, tempting! But $${r} %$ and then $${s} %$ are not $${r + s} %$ together: the second discount is taken from the **reduced** price.`,
              `Ooh, verlockend! Aber $${r} %$ und danach $${s} %$ sind zusammen nicht $${r + s} %$: Der zweite Rabatt wird vom **reduzierten** Preis abgezogen.`,
            ),
          )
        : kind === "same" && i === two
          ? pick(
              i,
              ADDED,
              tx(
                `I think you added $${r} % + ${s} % = ${r + s} %$. But the second discount is taken from the **reduced** price, so together it's less.`,
                `Ich glaub, du hast $${r} % + ${s} % = ${r + s} %$ gerechnet. Der zweite Rabatt wird aber vom **reduzierten** Preis abgezogen, zusammen ist es also weniger.`,
              ),
            )
          : pick(i, tx("Compare the factors", "Vergleich die Faktoren"), compare),
    );
  const fd = (f: Fmt) => f.n(qd);
  const ft = (f: Fmt) => f.n(r6(qt));
  const L1 = singleIsA ? "A" : "B";
  const L2 = singleIsA ? "B" : "A";
  return {
    instruction: tx("Which offer is cheaper?", "Welches Angebot ist günstiger?"),
    text: say((f) =>
      f.t(
        `${item.en} costs ${euro(f, P)} in two shops. Shop A: ${singleIsA ? offerSingle(f) : offerTwo(f)}. Shop B: ${singleIsA ? offerTwo(f) : offerSingle(f)}.`,
        `${item.de} kostet in zwei Läden ${euro(f, P)}. Laden A: ${singleIsA ? offerSingle(f) : offerTwo(f)}. Laden B: ${singleIsA ? offerTwo(f) : offerSingle(f)}.`,
      ),
    ),
    answer: { kind: "choice", options, correct },
    hint: tx("Turn each offer into one total factor and compare.", "Mach aus jedem Angebot einen Gesamtfaktor und vergleiche."),
    solution: [
      {
        math: say((f) => `q_${L1}#qa =#e 1#o -#m ${f.n(d / 100)}#d =#e2 ${fd(f)}#fa`),
        note: say((f) =>
          f.t(`Offer ${L1}: $${f.n(d)} %$ off leaves $${f.n(100 - d)} %$, so the factor is $${fd(f)}$.`, `Angebot ${L1}: Bei $${f.n(d)} %$ Rabatt bleiben $${f.n(100 - d)} %$, der Faktor ist also $${fd(f)}$.`),
        ),
      },
      {
        math: say((f) => `q_${L2}#qb =#e ${f.n(1 - r / 100)}#b1 \\cdot#t ${f.n(1 - s / 100)}#b2 =#e3 ${ft(f)}#fb`),
        note: say((f) =>
          f.t(
            `Offer ${L2}: two discounts in a row, so multiply: $${f.n(1 - r / 100)} \\cdot ${f.n(1 - s / 100)} = ${ft(f)}$.`,
            `Angebot ${L2}: zwei Rabatte nacheinander, also multiplizieren: $${f.n(1 - r / 100)} \\cdot ${f.n(1 - s / 100)} = ${ft(f)}$.`,
          ),
        ),
      },
      {
        math: say((f) => `${f.c(P)}#P \\cdot#t ${fd(f)}#fa =#e ${f.c(P * qd)}#ra "€"#u \\\\ ${f.c(P)}#P2 \\cdot#t2 ${ft(f)}#fb =#e2 ${f.c(P * qt)}#rb "€"#u2`),
        note: say((f) =>
          Math.abs(qd - qt) < 1e-9
            ? f.t("Same factor, same price: both offers cost the same.", "Gleicher Faktor, gleicher Preis: Beide Angebote kosten gleich viel.")
            : f.t(
                `The smaller factor gives the lower price: offer ${qd < qt ? L1 : L2} is cheaper.`,
                `Der kleinere Faktor ergibt den niedrigeren Preis: Angebot ${qd < qt ? L1 : L2} ist günstiger.`,
              ),
        ),
        highlight: Math.abs(qd - qt) < 1e-9 ? ["ra", "rb"] : [qd < qt ? "ra" : "rb"],
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Match each change with its factor

type FactorCard = { en: string; de: string; op: "·" | ":"; v: number; trap: number; trapOp?: "·" | ":"; why: Text; frame: Text; note: Text };

const FACTOR_CARDS: FactorCard[] = [
  {
    en: "19 % VAT on top",
    de: "19\u00a0% Mehrwertsteuer dazu",
    op: "·",
    v: 1.19,
    trap: 0.19,
    why: tx("$\\cdot\\, 0.19$ only gives the VAT itself, not the new price. What percentage is the new price?", "$\\cdot\\, 0,19$ ergibt nur die Steuer selbst, nicht den neuen Preis. Wie viel Prozent ist der neue Preis?"),
    frame: tx("100 % + 19 % = 119 % = 1.19", "100 % + 19 % = 119 % = 1,19"),
    note: tx("VAT on top: $119 %$ of the net price.", "Mehrwertsteuer dazu: $119 %$ vom Nettopreis."),
  },
  {
    en: "7 % VAT on top",
    de: "7\u00a0% Mehrwertsteuer dazu",
    op: "·",
    v: 1.07,
    trap: 1.7,
    why: tx("So close! $7 %$ are $0.07$: percent means **hundredths**.", "Ganz knapp! $7 %$ sind $0,07$: Prozent heißt **Hundertstel**."),
    frame: tx("100 % + 7 % = 107 % = 1.07", "100 % + 7 % = 107 % = 1,07"),
    note: tx("Reduced VAT: $107 %$ of the net price.", "Ermäßigte Mehrwertsteuer: $107 %$ vom Nettopreis."),
  },
  {
    en: "2 % Skonto off",
    de: "2\u00a0% Skonto abziehen",
    op: "·",
    v: 0.98,
    trap: 0.02,
    why: tx("$\\cdot\\, 0.02$ only gives the Skonto itself. What's left after $2 %$ off?", "$\\cdot\\, 0,02$ ergibt nur das Skonto selbst. Was bleibt nach $2 %$ Abzug übrig?"),
    frame: tx("100 % - 2 % = 98 % = 0.98", "100 % - 2 % = 98 % = 0,98"),
    note: tx("$2 %$ off leaves $98 %$.", "Nach $2 %$ Abzug bleiben $98 %$."),
  },
  {
    en: "3 % Skonto off",
    de: "3\u00a0% Skonto abziehen",
    op: "·",
    v: 0.97,
    trap: 0.7,
    why: tx("Careful: $3 %$ are $0.03$, not $0.3$. Percent means hundredths.", "Vorsicht: $3 %$ sind $0,03$, nicht $0,3$. Prozent heißt Hundertstel."),
    frame: tx("100 % - 3 % = 97 % = 0.97", "100 % - 3 % = 97 % = 0,97"),
    note: tx("$3 %$ off leaves $97 %$.", "Nach $3 %$ Abzug bleiben $97 %$."),
  },
  {
    en: "25 % discount",
    de: "25\u00a0% Rabatt",
    op: "·",
    v: 0.75,
    trap: 0.25,
    why: tx("$\\cdot\\, 0.25$ gives the discount itself. But you pay what's left.", "$\\cdot\\, 0,25$ ergibt den Rabatt selbst. Bezahlen musst du aber den Rest."),
    frame: tx("100 % - 25 % = 75 % = 0.75", "100 % - 25 % = 75 % = 0,75"),
    note: tx("$25 %$ off leaves $75 %$.", "Nach $25 %$ Rabatt bleiben $75 %$."),
  },
  {
    en: "price rise of 5 %",
    de: "Preiserhöhung um 5\u00a0%",
    op: "·",
    v: 1.05,
    trap: 1.5,
    why: tx("So close! $5 %$ are $0.05$: percent means **hundredths**.", "Ganz knapp! $5 %$ sind $0,05$: Prozent heißt **Hundertstel**."),
    frame: tx("100 % + 5 % = 105 % = 1.05", "100 % + 5 % = 105 % = 1,05"),
    note: tx("$5 %$ more: $105 %$.", "$5 %$ mehr: $105 %$."),
  },
  {
    en: "from gross back to net (19 % VAT)",
    de: "von brutto zurück zu netto (19\u00a0% MwSt.)",
    op: ":",
    v: 1.19,
    trap: 0.81,
    trapOp: "·",
    why: tx(
      "Classic trap! The $19 %$ belong to the **net** price, so you can't take $19 %$ off the gross price. Undo the factor instead.",
      "Die klassische Falle! Die $19 %$ gehören zum **Nettopreis**, du darfst sie nicht vom Bruttopreis abziehen. Mach den Faktor rückgängig.",
    ),
    frame: tx('"net" \\cdot 1.19 = "gross" \\quad \\Rightarrow \\quad "gross" : 1.19 = "net"', '"netto" \\cdot 1,19 = "brutto" \\quad \\Rightarrow \\quad "brutto" : 1,19 = "netto"'),
    note: tx("Going back: divide by the factor.", "Zurück: durch den Faktor teilen."),
  },
  {
    en: "+20 %, then −20 %",
    de: "+20\u00a0%, dann −20\u00a0%",
    op: "·",
    v: 0.96,
    trap: 1,
    why: tx(
      "Ooh, tempting! But $+20 %$ and $-20 %$ don't cancel out: the $20 %$ off are taken from the bigger price.",
      "Ooh, verlockend! Aber $+20 %$ und $-20 %$ heben sich nicht auf: Die $20 %$ Abzug werden vom größeren Preis genommen.",
    ),
    frame: tx("1.2 \\cdot 0.8 = 0.96", "1,2 \\cdot 0,8 = 0,96"),
    note: tx("Two changes: multiply the factors.", "Zwei Änderungen: Faktoren multiplizieren."),
  },
  {
    en: "10 % discount, then 2 % Skonto",
    de: "10\u00a0% Rabatt, dann 2\u00a0% Skonto",
    op: "·",
    v: 0.882,
    trap: 0.88,
    why: tx("Nearly! Percentages in a row don't add up: multiply the two factors.", "Fast! Prozente nacheinander darfst du nicht addieren: Multipliziere die beiden Faktoren."),
    frame: tx("0.9 \\cdot 0.98 = 0.882", "0,9 \\cdot 0,98 = 0,882"),
    note: tx("Discount, then Skonto: multiply the factors.", "Rabatt, dann Skonto: Faktoren multiplizieren."),
  },
  {
    en: "capital plus interest after half a year at 4 %",
    de: "Kapital plus Zinsen nach einem halben Jahr zu 4\u00a0%",
    op: "·",
    v: 1.02,
    trap: 1.04,
    why: tx("$4 %$ is the rate for a whole **year**. Half a year brings only half the interest.", "$4 %$ ist der Zinssatz für ein ganzes **Jahr**. Ein halbes Jahr bringt nur die Hälfte der Zinsen."),
    frame: tx("4 % \\cdot \\frac{6}{12} = 2 % \\Rightarrow 1.02", "4 % \\cdot \\frac{6}{12} = 2 % \\Rightarrow 1,02"),
    note: tx("Half a year: half the yearly interest.", "Ein halbes Jahr: die Hälfte der Jahreszinsen."),
  },
  {
    en: "30 % discount",
    de: "30\u00a0% Rabatt",
    op: "·",
    v: 0.7,
    trap: 0.3,
    why: tx("$\\cdot\\, 0.3$ gives the discount itself. But you pay what's left.", "$\\cdot\\, 0,3$ ergibt den Rabatt selbst. Bezahlen musst du aber den Rest."),
    frame: tx("100 % - 30 % = 70 % = 0.7", "100 % - 30 % = 70 % = 0,7"),
    note: tx("$30 %$ off leaves $70 %$.", "Nach $30 %$ Rabatt bleiben $70 %$."),
  },
];

const factorText = (op: "·" | ":", v: number): Text => say(({ n }) => `$${op === "·" ? "\\cdot" : ":"}\\, ${n(v)}$`);
const factorKey = (op: "·" | ":", v: number) => `${op}${v}`;

function factorMatchTask(rng: Rng): Exercise | null {
  const cards = rng.shuffle(FACTOR_CARDS).slice(0, 4);
  const rights = new Set(cards.map((c) => factorKey(c.op, c.v)));
  if (rights.size < 4) return null;
  const taken = new Set(rights);
  const traps: FactorCard[] = [];
  for (const c of cards) {
    const k = factorKey(c.trapOp ?? "·", c.trap);
    if (traps.length >= 2 || taken.has(k)) continue;
    taken.add(k);
    traps.push(c);
  }
  const left = (c: FactorCard) => tx(c.en, c.de);
  return {
    instruction: tx("Match each change with its factor", "Ordne jeder Änderung ihren Faktor zu"),
    answer: {
      kind: "match",
      pairs: cards.map((c) => [left(c), factorText(c.op, c.v)]),
      distractors: traps.map((c) => factorText(c.trapOp ?? "·", c.trap)),
      label: tx("Which factor turns the old price into the new one?", "Welcher Faktor macht aus dem alten Preis den neuen?"),
    },
    hint: tx(
      "Write the new value as a percentage of the old one, then as a decimal. Changes in a row: multiply.",
      "Schreib den neuen Wert in Prozent vom alten, dann als Dezimalzahl. Änderungen nacheinander: multiplizieren.",
    ),
    solution: cards.map((c) => ({ math: c.frame, note: c.note })),
    mistakes: traps.map((c) => ({
      when: { kind: "match" as const, pairs: [[left(c), factorText(c.trapOp ?? "·", c.trap)]] as [Text, Text][] },
      title: tx("Factor mixed up", "Faktor verwechselt"),
      say: c.why,
    })),
  };
}

// ---------------------------------------------------------------------------
// Widget: drag through the banking year, the interest grows with the time

const CAPITALS = [1800, 3600, 7200];
const RATES = [1, 2, 2.5, 3, 4, 5];
const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Labels under a bar: centred on their tick, but kept inside the bar at both ends. */
const edge = (x: number) => (x <= 0 ? "" : x >= 100 ? "-translate-x-full" : "-translate-x-1/2");

function InterestYear() {
  const scope = useId();
  const f = useFmt();
  const { t, c, n } = f;
  const [K, setK] = useState(3600);
  const [p, setP] = useState(4);
  const [days, setDays] = useState(90);
  const [unit, setUnit] = useState<"days" | "months">("days");
  const [dragging, setDragging] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  const months = unit === "months";
  const Zy = (K * p) / 100;
  const Z = (Zy * days) / 360;
  const pct = (days / 360) * 100;
  const g = gcd(days, 360);
  const m = days / 30;

  const fromPointer = (clientX: number) => {
    const el = bar.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setDays(months ? Math.round(frac * 12) * 30 : Math.round(frac * 360));
  };
  const switchUnit = (u: "days" | "months") => {
    setUnit(u);
    if (u === "months") setDays((d) => Math.round(d / 30) * 30);
  };

  const time = months ? `\\frac{${m}#tt}{12#tb}#f2` : `\\frac{${days}#tt}{360#tb}#f2`;
  const formula = `Z#Z =#e ${c(K)}#K "€"#u \\cdot#m1 \\frac{${n(p)}#p}{100#h}#f1 \\cdot#m2 ${time} ${cents(Z) ? "=" : "\\approx"}#e2 ${c(Z)}#r "€"#u2`;
  const spring = { type: "spring" as const, stiffness: 320, damping: 32 };
  const move = dragging ? { duration: 0.06 } : spring;
  const label = months ? (m === 1 ? t("1 month", "1 Monat") : t(`${m} months`, `${m} Monate`)) : days === 1 ? t("1 day", "1 Tag") : t(`${days} days`, `${days} Tage`);
  const part = months ? `${m / gcd(m, 12)}/${12 / gcd(m, 12)}` : `${days / g}/${360 / g}`;
  const explain =
    days === 0
      ? t("No time, no interest.", "Keine Zeit, keine Zinsen.")
      : days === 360
        ? t("A whole year: the full yearly interest.", "Ein ganzes Jahr: die vollen Jahreszinsen.")
        : months
          ? t(`${m} of 12 months are ${part} of the year, so you get ${part} of the yearly interest.`, `${m} von 12 Monaten sind ${part} des Jahres, du bekommst also ${part} der Jahreszinsen.`)
          : t(`${days} of 360 days are ${part} of the year, so you get ${part} of the yearly interest.`, `${days} von 360 Tagen sind ${part} des Jahres, du bekommst also ${part} der Jahreszinsen.`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Capital K", "Kapital K")}</span>
          {CAPITALS.map((v) => (
            <Pill key={v} active={K === v} onClick={() => setK(v)}>
              {v} €
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Rate p", "Zinssatz p")}</span>
          {RATES.map((v) => (
            <Pill key={v} active={p === v} onClick={() => setP(v)}>
              {n(v)} %
            </Pill>
          ))}
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-ink-2">{t("A banking year: 12 months of 30 days", "Ein Bankjahr: 12 Monate zu je 30 Tagen")}</span>
          <Segmented
            value={unit}
            onChange={switchUnit}
            label={t("Count in", "Zählen in")}
            options={[
              { value: "days", label: t("Days", "Tage") },
              { value: "months", label: t("Months", "Monate") },
            ]}
          />
        </div>

        <div className="relative px-1 pb-7 pt-9">
          <div
            ref={bar}
            role="slider"
            tabIndex={0}
            aria-label={t("Time the money is in the bank", "Zeit, die das Geld angelegt ist")}
            aria-valuemin={0}
            aria-valuemax={months ? 12 : 360}
            aria-valuenow={months ? m : days}
            aria-valuetext={label}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              fromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (dragging) fromPointer(e.clientX);
            }}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onKeyDown={(e) => {
              const one = months ? 30 : 1;
              const step =
                e.key === "ArrowRight" || e.key === "ArrowUp" ? one : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -one : e.key === "PageUp" ? 30 : e.key === "PageDown" ? -30 : 0;
              const to = e.key === "Home" ? 0 : e.key === "End" ? 360 : null;
              if (!step && to === null) return;
              e.preventDefault();
              e.stopPropagation();
              setDays((d) => (to !== null ? to : Math.max(0, Math.min(360, d + step))));
            }}
            className="relative h-11 cursor-ew-resize touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blob/50"
            style={{ background: EMPTY }}
          >
            <div className="absolute inset-0 grid grid-cols-12">
              {MONTH_LETTERS.map((ml, i) => (
                <div key={i} className={cn("grid place-items-center text-[11px] font-medium text-ink-3", i > 0 && "border-l border-line")}>
                  {ml}
                </div>
              ))}
            </div>
            <motion.div
              className="absolute inset-0 grid grid-cols-12 rounded-xl bg-blob"
              initial={false}
              animate={{ clipPath: `inset(0% ${100 - pct}% 0% 0% round 12px)` }}
              transition={move}
            >
              {MONTH_LETTERS.map((ml, i) => (
                <div key={i} className={cn("grid place-items-center text-[11px] font-medium text-white", i > 0 && "border-l border-white/25")}>
                  {ml}
                </div>
              ))}
            </motion.div>
            <motion.div className="absolute inset-y-[-6px] w-0" initial={false} animate={{ left: `${pct}%` }} transition={move}>
              <div className="absolute inset-y-0 left-[-3px] w-[6px] rounded-full bg-ink shadow-card" />
              <div
                className={cn(
                  "absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md bg-blob px-1.5 py-0.5 text-[13px] font-semibold text-white tabular-nums",
                  pct < 10 ? "-translate-x-2" : pct > 90 ? "-translate-x-[calc(100%-8px)]" : "-translate-x-1/2",
                )}
              >
                {label}
              </div>
            </motion.div>
          </div>
          <div className="pointer-events-none absolute inset-x-1 bottom-0 h-5 text-[11.5px] text-ink-3">
            {(months ? [0, 3, 6, 9, 12] : [0, 90, 180, 270, 360]).map((v, i) => (
              <span key={v} className={cn("absolute whitespace-nowrap tabular-nums", edge(i * 25))} style={{ left: `${i * 25}%` }}>
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
            <span className="font-semibold text-ink">
              {t("Interest", "Zinsen")} Z = {c(Z)} €
            </span>
            <span className="text-ink-3 tabular-nums">{t(`whole year: ${c(Zy)} €`, `ganzes Jahr: ${c(Zy)} €`)}</span>
          </div>
          <div className="relative h-7 overflow-hidden rounded-lg" style={{ background: EMPTY }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-lg"
              style={{ background: "color-mix(in oklab, var(--blob) 55%, transparent)" }}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={move}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <MathView src={formula} size="md" scope={`${scope}-f`} highlight={["tt", "r"]} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">{explain}</p>
      </div>
      <p className="text-[13px] text-ink-3">{t("Drag along the year or use the arrow keys.", "Zieh am Jahr entlang oder nutze die Pfeiltasten.")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: build an invoice from discount, Skonto and VAT, in any order

type LineKind = "discount" | "skonto" | "vat";
type InvoiceLine = { kind: LineKind; on: boolean; p: number };
const LINE_STEPS: Record<LineKind, number[]> = { discount: [5, 10, 15, 20, 25, 30, 40, 50], skonto: [1, 2, 3], vat: [7, 19] };
const lineFactor = (l: InvoiceLine) => 1 + (l.kind === "vat" ? l.p : -l.p) / 100;

function InvoiceBuilder() {
  const scope = useId();
  const f = useFmt();
  const { t, c, n } = f;
  const [base, setBase] = useState(800);
  const [lines, setLines] = useState<InvoiceLine[]>([
    { kind: "discount", on: true, p: 10 },
    { kind: "skonto", on: true, p: 2 },
    { kind: "vat", on: true, p: 19 },
  ]);

  const names: Record<LineKind, string> = { discount: t("Discount", "Rabatt"), skonto: t("Skonto (cash discount)", "Skonto"), vat: t("VAT", "Mehrwertsteuer") };
  const rows = lines.reduce<{ line: InvoiceLine; before: number; after: number }[]>((acc, line) => {
    const before = acc.length ? acc[acc.length - 1].after : base;
    return [...acc, { line, before, after: line.on ? before * lineFactor(line) : before }];
  }, []);
  const final = rows[rows.length - 1].after;
  const active = lines.filter((l) => l.on);
  const Q = active.reduce((q, l) => q * lineFactor(l), 1);
  const change = r6(Math.abs(Q - 1) * 100);
  const sum = active.reduce((s, l) => s + (l.kind === "vat" ? l.p : -l.p), 0);

  const patch = (kind: LineKind, change: Partial<InvoiceLine>) => setLines((list) => list.map((l) => (l.kind === kind ? { ...l, ...change } : l)));
  const stepP = (l: InvoiceLine, by: -1 | 1) => {
    const steps = LINE_STEPS[l.kind];
    const i = Math.max(0, Math.min(steps.length - 1, steps.indexOf(l.p) + by));
    patch(l.kind, { p: steps[i] });
  };
  const moveLine = (i: number, by: -1 | 1) =>
    setLines((list) => {
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const formula = `${c(base)}#s "€"#u${active.map((l) => ` \\cdot#t-${l.kind} ${n(lineFactor(l))}#q-${l.kind}`).join("")} ${cents(final) ? "=" : "\\approx"}#e ${c(final)}#r "€"#u2`;
  const verdict = !active.length
    ? t("No changes: you pay the list price.", "Keine Änderung: Du zahlst den Listenpreis.")
    : Math.abs(Q - 1) < 1e-9
      ? t("Total factor 1: exactly the list price.", "Gesamtfaktor 1: genau der Listenpreis.")
      : t(
          `Total factor ${n(r6(Q))}: ${n(change)} % ${Q > 1 ? "above" : "below"} the list price.`,
          `Gesamtfaktor ${n(r6(Q))}: ${n(change)} % ${Q > 1 ? "über" : "unter"} dem Listenpreis.`,
        );
  const added =
    active.length > 1 && Math.abs(Math.abs(sum) - change) > 1e-6
      ? t(
          ` Simply adding the percentages would give ${sum >= 0 ? "+" : "−"}${Math.abs(sum)} %. That's wrong, because every change has a different base value.`,
          ` Die Prozentsätze einfach zu addieren, ergäbe ${sum >= 0 ? "+" : "−"}${Math.abs(sum)} %. Das stimmt nicht, weil jede Änderung einen anderen Grundwert hat.`,
        )
      : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12.5px] text-ink-2">{t("List price", "Listenpreis")}</span>
        {[800, 1500, 240].map((v) => (
          <Pill key={v} active={base === v} onClick={() => setBase(v)}>
            {v} €
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <motion.li
              key={l.kind}
              layout
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-2 sm:gap-2 sm:px-2.5"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={l.on}
                aria-label={names[l.kind]}
                onClick={() => patch(l.kind, { on: !l.on })}
                className={cn("grid size-6 shrink-0 place-items-center rounded-md border transition-colors", l.on ? "border-blob bg-blob text-white" : "border-line text-transparent hover:border-ink-3")}
              >
                <Check className="size-3.5" />
              </button>
              <span className={cn("min-w-0 flex-1 text-[13.5px] font-medium leading-tight", !l.on && "text-ink-3")}>{names[l.kind]}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => stepP(l, -1)}
                  disabled={!l.on || LINE_STEPS[l.kind].indexOf(l.p) === 0}
                  className="grid size-6 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35 sm:size-7"
                  aria-label={t(`Less ${names[l.kind]}`, `Weniger ${names[l.kind]}`)}
                >
                  <Minus className="size-3.5" />
                </button>
                <span className={cn("w-[46px] text-center font-math text-[15px] tabular-nums sm:w-[52px]", !l.on && "text-ink-3")}>
                  {l.kind === "vat" ? "+" : "−"}
                  {l.p} %
                </span>
                <button
                  type="button"
                  onClick={() => stepP(l, 1)}
                  disabled={!l.on || LINE_STEPS[l.kind].indexOf(l.p) === LINE_STEPS[l.kind].length - 1}
                  className="grid size-6 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35 sm:size-7"
                  aria-label={t(`More ${names[l.kind]}`, `Mehr ${names[l.kind]}`)}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="flex shrink-0 items-center border-l border-line pl-0.5 sm:pl-1">
                <button
                  type="button"
                  onClick={() => moveLine(i, -1)}
                  disabled={i === 0}
                  className="grid size-6 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30 sm:size-7"
                  aria-label={t(`Move ${names[l.kind]} up`, `${names[l.kind]} nach oben`)}
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveLine(i, 1)}
                  disabled={i === lines.length - 1}
                  className="grid size-6 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30 sm:size-7"
                  aria-label={t(`Move ${names[l.kind]} down`, `${names[l.kind]} nach unten`)}
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>

        <div className="rounded-xl border border-line bg-surface p-4 text-[13.5px]">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Invoice", "Rechnung")}</div>
          <div className="flex justify-between gap-3">
            <span>{t("List price", "Listenpreis")}</span>
            <span className="font-math tabular-nums">{cents2(f, base)} €</span>
          </div>
          <AnimatePresence initial={false}>
            {rows
              .filter((r) => r.line.on)
              .map((r) => (
                <motion.div
                  key={r.line.kind}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="overflow-hidden"
                >
                  <div className="flex justify-between gap-3 pt-1.5 text-ink-2">
                    <span className="min-w-0 truncate">
                      {r.line.kind === "vat" ? "+" : "−"} {r.line.p} % {names[r.line.kind]}
                    </span>
                    <span className="font-math tabular-nums">
                      {r.line.kind === "vat" ? "+" : "−"} {cents2(f, Math.abs(r.after - r.before))} €
                    </span>
                  </div>
                  <div className="flex justify-end border-t border-line pt-0.5">
                    <span className="font-math tabular-nums">{cents2(f, r.after)} €</span>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
          <div className="mt-2 flex justify-between gap-3 border-t-2 border-ink pt-1.5 font-semibold">
            <span>{t("To pay", "Zu zahlen")}</span>
            <span className="font-math tabular-nums">{cents2(f, final)} €</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <MathView src={formula} size="md" scope={`${scope}-f`} highlight={["r"]} />
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        <strong className="font-semibold text-ink">{verdict}</strong>
        {added}
      </p>
      <p className="text-[13px] text-ink-3">
        {t(
          "Tick lines on or off, change the percentages, and move lines up or down. Does the price at the end change?",
          "Hak Zeilen an oder ab, ändere die Prozentsätze und verschieb die Zeilen nach oben oder unten. Ändert sich der Endpreis?",
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picture: net price, VAT and gross price as one bar

function VatBar({ net, rate }: { net: number; rate: number }) {
  const f = useFmt();
  const { t, n } = f;
  const vat = (net * rate) / 100;
  const gross = net + vat;
  const q = 1 + rate / 100;
  const w = (100 / (100 + rate)) * 100;
  const spring = { type: "spring" as const, stiffness: 140, damping: 22 };
  const light = "color-mix(in oklab, var(--blob) 30%, var(--surface))";
  return (
    <div className="mx-auto max-w-[640px] space-y-4 py-1">
      <div>
        <div className="flex h-14 overflow-hidden rounded-xl">
          <motion.div className="grid min-w-0 place-items-center bg-blob text-[14px] font-semibold text-white" initial={{ width: "0%" }} animate={{ width: `${w}%` }} transition={spring}>
            <span className="whitespace-nowrap">{t("net", "netto")} · 100 %</span>
          </motion.div>
          <motion.div
            className="grid min-w-0 place-items-center text-[13px] font-semibold text-ink"
            style={{ background: light }}
            initial={{ width: "0%" }}
            animate={{ width: `${100 - w}%` }}
            transition={{ ...spring, delay: 0.35 }}
          >
            <span className="whitespace-nowrap">{rate} %</span>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <div className="mx-0.5 mt-1.5 h-2.5 rounded-b-lg border-x-2 border-b-2 border-ink-3" />
          <div className="mt-1 text-center text-[13px] font-semibold text-ink">
            {t("gross", "brutto")} · {100 + rate} %
          </div>
        </motion.div>
      </div>
      <div className="space-y-1.5 rounded-xl border border-line bg-surface p-3.5 text-[14px]">
        <div className="flex items-center gap-2.5">
          <span className="size-3 shrink-0 rounded-sm bg-blob" />
          <span className="flex-1">{t("Net price", "Nettopreis")}</span>
          <span className="font-math tabular-nums">{cents2(f, net)} €</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="size-3 shrink-0 rounded-sm" style={{ background: light }} />
          <span className="flex-1">
            {t("VAT", "Mehrwertsteuer")} ({rate} %)
          </span>
          <span className="font-math tabular-nums">+ {cents2(f, vat)} €</span>
        </div>
        <div className="flex items-center gap-2.5 border-t border-line pt-1.5 font-semibold">
          <span className="size-3 shrink-0" />
          <span className="flex-1">{t("Gross price", "Bruttopreis")}</span>
          <span className="font-math tabular-nums">{cents2(f, gross)} €</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <MathView src={`"${t("net", "netto")}" \\cdot ${n(q)} = "${t("gross", "brutto")}"`} size="sm" />
        <MathView src={`"${t("gross", "brutto")}" : ${n(q)} = "${t("net", "netto")}"`} size="sm" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson boards

const interestIntroFrames: Frame[] = [
  { math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f", note: tx("From level 1: percentage = base value times rate.", "Aus Stufe 1 kennst du: Prozentwert = Grundwert mal Prozentsatz.") },
  {
    math: "Z#W =#e K#G \\cdot#m \\frac{p#p}{100#h}#f",
    note: tx(
      "For interest, it's the same formula with new names: the **capital** $K$ (Kapital) is the base value, the **interest** $Z$ (Zinsen) is the percentage, and $p %$ is the **interest rate** (Zinssatz).",
      "Bei der Zinsrechnung gilt dieselbe Formel, nur mit neuen Namen: Das **Kapital** $K$ ist der Grundwert, die **Zinsen** $Z$ sind der Prozentwert, und $p %$ heißt **Zinssatz**.",
    ),
    highlight: ["W", "G"],
  },
  {
    math: tx('Z#W =#e 1200#G "€"#u \\cdot#m \\frac{2.5#p}{100#h}#f', 'Z#W =#e 1200#G "€"#u \\cdot#m \\frac{2,5#p}{100#h}#f'),
    note: tx("Example: $1200$ € in a savings account at $2.5 %$ interest per year.", "Beispiel: $1200$\u00a0€ auf einem Sparkonto mit $2,5 %$ Zinsen pro Jahr."),
    highlight: ["G", "p"],
  },
  {
    math: tx('Z#W =#e 1200#G "€"#u \\cdot#m 0.025#q', 'Z#W =#e 1200#G "€"#u \\cdot#m 0,025#q'),
    note: tx("$2.5 % = 0.025$.", "$2,5 % = 0,025$."),
    highlight: ["q"],
  },
  {
    math: 'Z#W =#e 30#r "€"#u',
    note: tx(
      "After one year the bank pays $30$ € interest. The interest rate always means **per year** (p. a., per annum).",
      "Nach einem Jahr zahlt die Bank $30$\u00a0€ Zinsen. Der Zinssatz gilt immer **pro Jahr** (p. a., per annum).",
    ),
    highlight: ["r"],
  },
];

const withNote = (frames: Frame[], i: number, note: Text): Frame[] => frames.map((fr, k) => (k === i ? { ...fr, note } : fr));

const solveFrames: Frame[] = [
  ...withNote(
    rateFrames(2000, 25, { kind: "months", m: 5 }),
    0,
    tx(
      "**Rate wanted.** $2000$ € earn $25$ € interest in $5$ months. Rates are per year, so scale up to a whole year first.",
      "**Zinssatz gesucht.** $2000$\u00a0€ bringen in $5$ Monaten $25$\u00a0€ Zinsen. Zinssätze gelten pro Jahr, also rechnest du zuerst auf ein ganzes Jahr hoch.",
    ),
  ),
  ...withNote(
    capitalFrames(45, 1.5, { kind: "year" }),
    0,
    tx(
      "**Capital wanted.** Which capital earns $45$ € a year at $1.5 %$? The $45$ € are $1.5 %$ of the unknown $K$.",
      "**Kapital gesucht.** Welches Kapital bringt bei $1,5 %$ im Jahr $45$\u00a0€? Die $45$\u00a0€ sind $1,5 %$ des unbekannten $K$.",
    ),
  ),
  ...withNote(
    timeFrames(4800, 3, 36, { kind: "days", t: 90 }),
    0,
    tx(
      "**Time wanted.** How many days until $4800$ € at $3 %$ earn $36$ €? In a whole year they would earn $144$ €.",
      "**Zeit gesucht.** Nach wie vielen Tagen bringen $4800$\u00a0€ bei $3 %$ genau $36$\u00a0€? In einem ganzen Jahr wären es $144$\u00a0€.",
    ),
  ),
];

const vatLessonFrames: Frame[] = [
  {
    math: tx('"net"#n \\cdot#m 1.19#q =#e "gross"#b', '"netto"#n \\cdot#m 1,19#q =#e "brutto"#b'),
    note: tx(
      "VAT (Mehrwertsteuer) is $19 %$ of the **net** price. Food and books only get the reduced rate of $7 %$.",
      "Die Mehrwertsteuer beträgt $19 %$ vom **Nettopreis**. Lebensmittel und Bücher haben den ermäßigten Satz von $7 %$.",
    ),
  },
  {
    math: tx('250#n "€"#u \\cdot#m 1.19#q =#e 297.50#b "€"#u2', '250#n "€"#u \\cdot#m 1,19#q =#e 297,50#b "€"#u2'),
    note: tx("Net price $250$ € → gross price $297.50$ €. The VAT in it is $47.50$ €.", "Nettopreis $250$\u00a0€ → Bruttopreis $297,50$\u00a0€. Darin stecken $47,50$\u00a0€ Mehrwertsteuer."),
    highlight: ["b"],
  },
  {
    math: tx('297.50#b "€"#u2 :#m 1.19#q =#e 250#n "€"#u', '297,50#b "€"#u2 :#m 1,19#q =#e 250#n "€"#u'),
    note: tx("Backwards: gross price divided by $1.19$ gives the net price.", "Rückwärts: Bruttopreis geteilt durch $1,19$ ergibt den Nettopreis."),
    highlight: ["n"],
  },
  {
    math: tx(
      '\\red{297.50#a1 \\cdot#a2 0.19#a3 \\approx#a4 56.53#a5} \\ne#ne 47.50#v "€"#u3',
      '\\red{297,50#a1 \\cdot#a2 0,19#a3 \\approx#a4 56,53#a5} \\ne#ne 47,50#v "€"#u3',
    ),
    note: tx(
      "Classic mistake: $19 %$ of the **gross** price is too much. The $19 %$ belong to the net price.",
      "Typischer Fehler: $19 %$ vom **Bruttopreis** sind zu viel. Die $19 %$ gehören zum Nettopreis.",
    ),
  },
  {
    math: tx('297.50#a1 "€"#u2 \\cdot#a2 \\frac{19#n1}{119#d1}#f =#e 47.50#v "€"#u3', '297,50#a1 "€"#u2 \\cdot#a2 \\frac{19#n1}{119#d1}#f =#e 47,50#v "€"#u3'),
    note: tx(
      "Shortcut for the VAT inside a gross price: the gross price is $119 %$, the VAT is $19$ of those $119$ parts.",
      "Abkürzung für die Steuer in einem Bruttopreis: Der Bruttopreis sind $119 %$, die Steuer davon $19$ der $119$ Teile.",
    ),
    highlight: ["f", "v"],
  },
];

const chainLessonFrames: Frame[] = [
  {
    math: tx('800#v "€"#u \\cdot#t0 0.9#q0 \\cdot#t1 0.98#q1', '800#v "€"#u \\cdot#t0 0,9#q0 \\cdot#t1 0,98#q1'),
    note: tx(
      "List price $800$ €. $10 %$ discount means $\\cdot\\, 0.9$; then $2 %$ Skonto on the reduced price means $\\cdot\\, 0.98$.",
      "Listenpreis $800$\u00a0€. $10 %$ Rabatt heißt $\\cdot\\, 0,9$; danach $2 %$ Skonto auf den reduzierten Preis heißt $\\cdot\\, 0,98$.",
    ),
    highlight: ["q0", "q1"],
  },
  {
    math: tx('720#v "€"#u \\cdot#t1 0.98#q1', '720#v "€"#u \\cdot#t1 0,98#q1'),
    note: tx("After the discount: $800 \\cdot 0.9 = 720$ €.", "Nach dem Rabatt: $800 \\cdot 0,9 = 720$\u00a0€."),
  },
  {
    math: tx('705.60#v "€"#u', '705,60#v "€"#u'),
    note: tx("After the Skonto: $720 \\cdot 0.98 = 705.60$ €.", "Nach dem Skonto: $720 \\cdot 0,98 = 705,60$\u00a0€."),
    highlight: ["v"],
  },
  {
    math: tx("0.9#q0 \\cdot#t1 0.98#q1 =#e 0.882#Q", "0,9#q0 \\cdot#t1 0,98#q1 =#e 0,882#Q"),
    note: tx(
      "Both at once: factor $0.882$, so you pay $88.2 %$. That's $11.8 %$ off, **not** $12 %$: the Skonto is taken from the smaller price.",
      "Beides auf einmal: Faktor $0,882$, du zahlst also $88,2 %$. Das sind $11,8 %$ weniger, **nicht** $12 %$: Das Skonto wird vom kleineren Preis abgezogen.",
    ),
    highlight: ["Q"],
  },
  {
    math: tx("1.2#q0 \\cdot#t1 0.8#q1 =#e 0.96#Q", "1,2#q0 \\cdot#t1 0,8#q1 =#e 0,96#Q"),
    note: tx(
      "Same reason: $+20 %$, then $-20 %$ gives $0.96$. You end $4 %$ **below** the start, because the $20 %$ off are taken from the bigger price.",
      "Derselbe Grund: $+20 %$ und danach $-20 %$ ergibt $0,96$. Du landest $4 %$ **unter** dem Start, weil die $20 %$ Abzug vom größeren Preis genommen werden.",
    ),
    highlight: ["Q"],
  },
  {
    math: tx("0.9#q0 \\cdot#t1 1.19#q1 =#e 1.19#q1b \\cdot#t2 0.9#q0b", "0,9#q0 \\cdot#t1 1,19#q1 =#e 1,19#q1b \\cdot#t2 0,9#q0b"),
    note: tx(
      "And the order doesn't matter: discount first or VAT first, the factors multiply to the same price.",
      "Und die Reihenfolge ist egal: Erst Rabatt oder erst Mehrwertsteuer, die Faktoren ergeben denselben Preis.",
    ),
  },
];

// ---------------------------------------------------------------------------

const BIKE = VAT_ITEMS[0];
const ELECTRICIAN = CRAFTS[1];

export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Interest", "Zinsen"),
      body: tx(
        "Capital $K$, interest rate $p %$ (always per year), interest $Z$: the percentage formula with new names.",
        "Kapital $K$, Zinssatz $p %$ (immer pro Jahr), Zinsen $Z$: die Prozentformel mit neuen Namen.",
      ),
      examples: ["Z = K \\cdot \\frac{p}{100}", tx('1200 "€" \\cdot 0.025 = 30 "€"', '1200 "€" \\cdot 0,025 = 30 "€"')],
      tone: "rule",
    },
    {
      title: tx("Months and days", "Monate und Tage"),
      body: tx(
        "Take that part of the yearly interest. Banking year: $360$ days, every month $30$ days.",
        "Nimm den passenden Teil der Jahreszinsen. Bankjahr: $360$ Tage, jeder Monat $30$ Tage.",
      ),
      examples: ["Z = K \\cdot \\frac{p}{100} \\cdot \\frac{m}{12}", "Z = K \\cdot \\frac{p}{100} \\cdot \\frac{t}{360}"],
      tone: "rule",
    },
    {
      title: tx("Capital, rate or time wanted", "Kapital, Zinssatz oder Zeit gesucht"),
      body: tx(
        "Rearrange $Z = \\frac{K \\cdot p \\cdot t}{100 \\cdot 360}$ ($t$ in days). Or turn the interest into yearly interest first and use level 1.",
        "Stell $Z = \\frac{K \\cdot p \\cdot t}{100 \\cdot 360}$ um ($t$ in Tagen). Oder rechne die Zinsen zuerst in Jahreszinsen um und nutze Stufe 1.",
      ),
      examples: ["K = \\frac{Z \\cdot 100 \\cdot 360}{p \\cdot t}", "p = \\frac{Z \\cdot 100 \\cdot 360}{K \\cdot t}", "t = \\frac{Z \\cdot 100 \\cdot 360}{K \\cdot p}"],
      tone: "tip",
    },
    {
      title: tx("VAT: net and gross", "Mehrwertsteuer: netto und brutto"),
      body: tx(
        "VAT is $19 %$ of the **net** price ($7 %$ for food and books). Back to net: divide, never take $19 %$ off.",
        "Die Mehrwertsteuer beträgt $19 %$ vom **Nettopreis** ($7 %$ bei Lebensmitteln und Büchern). Zurück zu netto: teilen, nie $19 %$ abziehen.",
      ),
      examples: [tx('"net" \\cdot 1.19 = "gross"', '"netto" \\cdot 1,19 = "brutto"'), tx('"gross" : 1.19 = "net"', '"brutto" : 1,19 = "netto"')],
      tone: "rule",
    },
    {
      title: tx("Changes in a row: multiply", "Änderungen nacheinander: multiplizieren"),
      body: tx(
        "Discount, Skonto, VAT: one factor each, in any order. The percentages of changes in a row don't add up.",
        "Rabatt, Skonto, Mehrwertsteuer: je ein Faktor, in beliebiger Reihenfolge. Prozentsätze nacheinander darfst du nicht addieren.",
      ),
      examples: [tx("0.9 \\cdot 0.98 = 0.882 \\Rightarrow -11.8 %", "0,9 \\cdot 0,98 = 0,882 \\Rightarrow -11,8 %"), tx("1.2 \\cdot 0.8 = 0.96 \\ne 1", "1,2 \\cdot 0,8 = 0,96 \\ne 1")],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Interest: percentages with new names", "Zinsrechnung: Prozente mit neuen Namen"),
      blob: tx("Banks do percentages all day long. Same maths, new names!", "Banken rechnen den ganzen Tag mit Prozenten. Gleiche Mathe, neue Namen!"),
      body: tx(
        "If you put money in the bank, the bank pays you **interest**. If you borrow money, you pay interest. Either way, it's percentage maths.",
        "Legst du Geld bei der Bank an, zahlt sie dir **Zinsen**. Leihst du dir Geld, zahlst du Zinsen. So oder so ist es Prozentrechnung.",
      ),
      frames: interestIntroFrames,
    },
    {
      type: "explain",
      title: tx("Interest for months and days", "Zinsen für Monate und Tage"),
      blob: tx("Interest rates are always per year. So what about half a year?", "Zinssätze gelten immer pro Jahr. Und was ist mit einem halben Jahr?"),
      body: tx(
        "For part of a year, you get that part of the yearly interest. Banks count every month as $30$ days and the year as $360$ days (banking year, Bankjahr).",
        "Für einen Teil des Jahres bekommst du den entsprechenden Teil der Jahreszinsen. Banken rechnen jeden Monat mit $30$ Tagen und das Jahr mit $360$ Tagen (Bankjahr).",
      ),
      frames: [...interestFrames(2400, 3, { kind: "months", m: 5 }), ...interestFrames(3600, 4, { kind: "days", t: 50 })],
    },
    {
      type: "widget",
      title: tx("Drag through the year", "Zieh durchs Jahr"),
      blob: tx("Drag through the year and watch the interest grow day by day.", "Zieh durchs Jahr und schau, wie die Zinsen Tag für Tag wachsen."),
      body: tx(
        "The bar is one banking year. Choose the capital and the rate, then drag: the interest is always the same part of the yearly interest as the time is of the year.",
        "Der Balken ist ein Bankjahr. Wähle Kapital und Zinssatz und zieh dann: Die Zinsen sind immer derselbe Teil der Jahreszinsen wie die Zeit vom Jahr.",
      ),
      widget: InterestYear,
    },
    {
      type: "check",
      blob: tx("Yearly interest first, then the part of the year.", "Erst die Jahreszinsen, dann der Teil vom Jahr."),
      exercise: interestExercise(
        1800,
        2,
        { kind: "months", m: 8 },
        tx(
          "Jonas has 1800 € in an instant-access account at 2 % interest per year. After 8 months he takes the money out for a moped. How much interest does he get?",
          "Jonas hat 1800\u00a0€ auf einem Tagesgeldkonto mit 2\u00a0% Zinsen pro Jahr. Nach 8 Monaten hebt er das Geld für ein Moped ab. Wie viel Zinsen bekommt er?",
        ),
      ),
    },
    {
      type: "explain",
      title: tx("Finding the rate, the capital or the time", "Zinssatz, Kapital oder Zeit gesucht"),
      blob: tx("Now backwards. The trick: always think in whole years.", "Jetzt rückwärts. Der Trick: immer in ganzen Jahren denken."),
      body: tx(
        "Turn the interest into **yearly interest** first. Then it's level 1 again: the rate is part divided by whole, the capital is the whole.",
        "Rechne die Zinsen zuerst in **Jahreszinsen** um. Dann ist es wieder Stufe 1: Der Zinssatz ist Teil durch Ganzes, das Kapital ist das Ganze.",
      ),
      frames: solveFrames,
    },
    {
      type: "check",
      blob: tx("Scale up to a year, then part divided by whole.", "Erst aufs Jahr hochrechnen, dann Teil durch Ganzes."),
      exercise: rateExercise(4500, 4, { kind: "months", m: 4 }),
    },
    {
      type: "explain",
      title: tx("VAT: net and gross", "Mehrwertsteuer: netto und brutto"),
      blob: tx("It's on every receipt: the VAT. Let's see where it hides.", "Sie steht auf jedem Kassenzettel: die Mehrwertsteuer. Mal sehen, wo sie sich versteckt."),
      body: tx(
        "The **net** price (netto) is without VAT, the **gross** price (brutto) includes it. The VAT is always a percentage of the net price.",
        "Der **Nettopreis** ist ohne Mehrwertsteuer, der **Bruttopreis** mit. Die Mehrwertsteuer ist immer ein Prozentsatz vom Nettopreis.",
      ),
      visual: { component: VatBar as unknown as ComponentType<Record<string, unknown>>, props: { net: 250, rate: 19 } },
      frames: vatLessonFrames,
    },
    {
      type: "check",
      blob: tx("The 19 % belong to the net price. Divide first!", "Die 19\u00a0% gehören zum Nettopreis. Erst teilen!"),
      exercise: vatExercise(BIKE, 500, "tax"),
    },
    {
      type: "explain",
      title: tx("Discount, Skonto and VAT in a row", "Rabatt, Skonto und Mehrwertsteuer nacheinander"),
      blob: tx("Discount, Skonto, VAT: one factor each, then multiply.", "Rabatt, Skonto, Mehrwertsteuer: je ein Faktor, dann multiplizieren."),
      body: tx(
        "**Skonto** is a small discount (often $2 %$ or $3 %$) for paying quickly. It's taken off the price **after** the discount.",
        "**Skonto** ist ein kleiner Nachlass (oft $2 %$ oder $3 %$) für schnelles Bezahlen. Es wird vom Preis **nach** dem Rabatt abgezogen.",
      ),
      frames: chainLessonFrames,
    },
    {
      type: "widget",
      title: tx("Build an invoice", "Bau eine Rechnung"),
      blob: tx("Shuffle the lines of the invoice. Does the final price change?", "Misch die Zeilen der Rechnung. Ändert sich der Endpreis?"),
      body: tx(
        "Each line of the invoice is one factor. Switch lines on and off, change them, and move them up or down: watch the amounts in between and the price at the end.",
        "Jede Zeile der Rechnung ist ein Faktor. Schalte Zeilen an und aus, ändere sie und verschieb sie: Achte auf die Beträge dazwischen und auf den Endpreis.",
      ),
      widget: InvoiceBuilder,
    },
    {
      type: "check",
      blob: tx("Last one! Two factors, one multiplication.", "Die letzte! Zwei Faktoren, eine Multiplikation."),
      exercise: invoiceExercise(2400, 2, ELECTRICIAN),
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 2 practice

const TASKS: [number, Gen][] = [
  [1.4, interestTask("year")],
  [2, interestTask("months")],
  [2, interestTask("days")],
  [1.3, capitalTask],
  [1.3, rateTask],
  [1.3, timeTask],
  [3, vatTask],
  [1.2, invoiceTask],
  [1.2, discountSkontoTask],
  [0.8, chainTask],
  [0.8, totalChangeTask],
  [1.2, offerTask],
  [1, factorMatchTask],
];

export function generate2(rng: Rng): Exercise {
  return findTask(rng, TASKS, () => interestExercise(2400, 3, { kind: "months", m: 5 }));
}
