"use client";

import { AnimatePresence, motion } from "motion/react";
import { Dices, RotateCcw } from "lucide-react";
import { useId, useState, type ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import { MathView } from "@/learn/components/MathView";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { pow } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import {
  amount,
  cash,
  euro,
  FACTOR_OFF,
  factorOff,
  findTask,
  mistakesFor,
  num,
  perc,
  Pill,
  r2,
  r6,
  rateAnswer,
  say,
  unitText,
  useFmt,
  WORD_PROBLEM,
  type Fmt,
  type Gen,
  type Slip,
  type Unit,
} from "./shared";

/**
 * Level 3 (Klasse 10 and Oberstufe): compound interest K_n = K_0 · q^n, exponential growth and decay,
 * growth factor and percentage both ways, doubling time and half-life (by trial and with logarithms),
 * radioactive decay, and linear versus exponential (constant difference or constant factor).
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
/** At most two decimal places (so a value can be shown exactly). */
const exact2 = (v: number) => Math.abs(r2(v) - v) < 1e-9;
const UNIT_WORDS: Partial<Record<Unit, [string, string]>> = { years: ["years", "Jahre"], hours: ["hours", "Stunden"], days: ["days", "Tage"], minutes: ["minutes", "Minuten"] };
/** A time unit in a sentence ("years" / "Jahren" after "nach"). */
const unitWord = (unit: Unit, f: Fmt, dative = false) => {
  const w = UNIT_WORDS[unit] ?? [unit, unit];
  return f.t(w[0], dative && unit !== "minutes" && !w[1].endsWith("n") ? `${w[1]}n` : w[1]);
};
const ROUND_1 = (f: Fmt) => f.t("Round to one decimal place.", "Runde auf eine Nachkommastelle.");
const ROUND_CENT = (f: Fmt) => f.t("Round to the cent.", "Runde auf Cent.");

type NumberSpec = Extract<AnswerSpec, { kind: "number" }>;

/** A calculator answer rounded to one decimal place. */
function oneDecimal(v: number, unit: Unit): NumberSpec {
  const value = r1(v);
  return { kind: "number", value, unit: unitText(unit), tolerance: 0.051 / Math.max(1, Math.abs(value)) };
}

/** Typical mistakes for a one-decimal answer: rounded like the answer, apart from it and from each other. */
function oneDecimalMistakes(answer: NumberSpec, slips: Slip[]): Mistake[] {
  const seen = [answer.value];
  const out: Mistake[] = [];
  for (const s of slips) {
    if (!s) continue;
    const [raw, title, said] = s;
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const value = r1(raw);
    if (value <= 0 || seen.some((v) => Math.abs(v - value) < 0.099)) continue;
    seen.push(value);
    out.push({ when: { kind: "number", value, ...(answer.unit ? { unit: answer.unit } : {}), tolerance: 0.051 / Math.max(1, value) }, title, say: said });
  }
  return out;
}

const SIMPLE = tx("Interest on interest forgotten", "Zinseszins vergessen");
const TIMES_N = (n: number) => tx(`Times ${n} instead of to the power ${n}`, `Mal ${n} statt hoch ${n}`);
const LINEAR = tx("Linear instead of exponential", "Linear statt exponentiell");
const UPSIDE_DOWN = tx("Fraction upside down", "Bruch umgedreht");

// ---------------------------------------------------------------------------
// Compound interest: K_n = K_0 · q^n

const SAVERS = ["Paul", "Mila", "Jonas", "Ella", "Emil", "Lina"];

function compoundExercise(K0: number, p: number, n: number, who: string, ask: "balance" | "interest"): Exercise {
  const q = 1 + p / 100;
  const Kn = K0 * q ** n;
  const value = ask === "balance" ? Kn : Kn - K0;
  const answer = amount(value, "€");
  const rel = (v: number) => (exact2(v) ? "=" : "\\approx");
  const frames: Frame[] = [
    {
      math: "K_n#Kn =#e K_0#K0 \\cdot#t q#q^n#nn",
      note: say((f) =>
        f.t(
          `Compound interest: $K_n = K_0 \\cdot q^n$ with the growth factor $q = 1 + \\frac{${f.n(p)}}{100} = ${f.n(q)}$.`,
          `Zinseszins: $K_n = K_0 \\cdot q^n$ mit dem Wachstumsfaktor $q = 1 + \\frac{${f.n(p)}}{100} = ${f.n(q)}$.`,
        ),
      ),
    },
    {
      math: say((f) => `K_{${n}}#Kn =#e ${f.c(K0)}#K0 "€"#u \\cdot#t ${f.n(q)}#q^{${n}}#nn`),
      note: say((f) =>
        f.t(`Put in $K_0 = ${f.c(K0)}$ €, $q = ${f.n(q)}$ and $n = ${n}$.`, `Setz $K_0 = ${f.c(K0)}$\u00a0€, $q = ${f.n(q)}$ und $n = ${n}$ ein.`),
      ),
      highlight: ["K0", "q", "nn"],
    },
    {
      math: say((f) => `K_{${n}}#Kn ${rel(Kn)}#e ${f.c(Kn)}#r "€"#u`),
      note: say((f) =>
        f.t(
          `With the calculator: $${f.c(K0)} \\cdot ${f.n(q)}^{${n}} ${rel(Kn)} ${f.c(Kn)}$ €.`,
          `Mit dem Taschenrechner: $${f.c(K0)} \\cdot ${f.n(q)}^{${n}} ${rel(Kn)} ${f.c(Kn)}$\u00a0€.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
  if (ask === "interest")
    frames.push({
      math: say((f) => `Z#Z =#e2 ${f.c(Kn)}#r "€"#u -#m ${f.c(K0)}#K0 "€"#u2 ${rel(Kn - K0)}#e3 ${f.c(Kn - K0)}#z "€"#u3`),
      note: say((f) =>
        f.t(`The interest is what came on top: balance minus start capital.`, `Die Zinsen sind das, was dazugekommen ist: Kontostand minus Startkapital.`),
      ),
      highlight: ["z"],
    });
  const simple = (K0 * p * n) / 100;
  return {
    instruction: tx("Compound interest", "Zinseszins"),
    text: say((f) =>
      f.t(
        `${who} invests ${euro(f, K0)} at ${perc(f, p)} interest per year. The interest stays in the account and earns interest too. ${
          ask === "balance" ? `How much money is in the account after ${n} years?` : `How much interest does ${who} earn in ${n} years altogether?`
        } ${ROUND_CENT(f)}`,
        `${who} legt ${euro(f, K0)} zu ${perc(f, p)} Zinsen pro Jahr an. Die Zinsen bleiben auf dem Konto und werden mitverzinst. ${
          ask === "balance" ? `Wie viel Geld ist nach ${n} Jahren auf dem Konto?` : `Wie viel Zinsen bekommt ${who} in ${n} Jahren insgesamt?`
        } ${ROUND_CENT(f)}`,
      ),
    ),
    answer,
    hint: say((f) => f.t(`$K_n = K_0 \\cdot q^n$ with $q = ${f.n(q)}$.`, `$K_n = K_0 \\cdot q^n$ mit $q = ${f.n(q)}$.`)),
    solution: frames,
    mistakes: mistakesFor(answer, [
      [
        ask === "balance" ? K0 + simple : simple,
        SIMPLE,
        say((f) =>
          f.t(
            `Ah, you added $${f.n(p)} %$ of the **start** capital every year. But the interest earns interest too: each year it's $${f.n(p)} %$ of the **new** balance.`,
            `Ah, du hast jedes Jahr $${f.n(p)} %$ vom **Startkapital** dazugerechnet. Aber die Zinsen werden mitverzinst: Jedes Jahr kommen $${f.n(p)} %$ vom **neuen** Kontostand dazu.`,
          ),
        ),
      ],
      ask === "balance" && [
        K0 * q * n,
        TIMES_N(n),
        say((f) =>
          f.t(
            `Close idea! But multiplying by $${n}$ isn't the same as multiplying by $${f.n(q)}$ ${n} times. Use the power $${f.n(q)}^{${n}}$.`,
            `Gute Idee, aber mal $${n}$ ist nicht dasselbe wie ${n}-mal mit $${f.n(q)}$ malnehmen. Nimm die Potenz $${f.n(q)}^{${n}}$.`,
          ),
        ),
      ],
      p < 10 && [ask === "balance" ? K0 * (1 + p / 10) ** n : K0 * (1 + p / 10) ** n - K0, FACTOR_OFF, factorOff(p, true)],
      ask === "interest"
        ? [
            Kn,
            tx("Balance, not interest", "Kontostand statt Zinsen"),
            tx("Nearly! That's the whole balance. The question only asks for the interest: subtract the start capital.", "Fast! Das ist der ganze Kontostand. Gefragt sind nur die Zinsen: Zieh das Startkapital ab."),
          ]
        : [
            Kn - K0,
            tx("Only the interest", "Nur die Zinsen"),
            tx("Nearly! That's only the interest. The question asks for the whole balance.", "Fast! Das sind nur die Zinsen. Gefragt ist der ganze Kontostand."),
          ],
    ]),
  };
}

function compoundInterestTask(rng: Rng): Exercise | null {
  const K0 = rng.pick([500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 8000, 10000]);
  const p = rng.pick([1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6]);
  const n = rng.int(3, 12);
  return compoundExercise(K0, p, n, rng.pick(SAVERS), rng.chance(0.7) ? "balance" : "interest");
}

/** K_0 = K_n : q^n */
function startValueExercise(target: number, p: number, n: number, who: string): Exercise {
  const q = 1 + p / 100;
  const K0 = target / q ** n;
  const answer = amount(K0, "€");
  return {
    instruction: tx("Find the start capital", "Berechne das Anfangskapital"),
    text: say((f) =>
      f.t(
        `${who} wants to have ${euro(f, target)} in ${n} years. The bank pays ${perc(f, p)} interest per year, with compound interest. How much does ${who} have to invest today? ${ROUND_CENT(f)}`,
        `${who} möchte in ${n} Jahren ${euro(f, target)} haben. Die Bank zahlt ${perc(f, p)} Zinsen pro Jahr, mit Zinseszins. Wie viel muss ${who} heute anlegen? ${ROUND_CENT(f)}`,
      ),
    ),
    answer,
    hint: say((f) => f.t(`$K_n = K_0 \\cdot ${f.n(q)}^{${n}}$: solve for $K_0$.`, `$K_n = K_0 \\cdot ${f.n(q)}^{${n}}$: nach $K_0$ auflösen.`)),
    solution: [
      {
        math: say((f) => `${f.c(target)}#Kn "€"#u =#e K_0#K0 \\cdot#t ${f.n(q)}#q^{${n}}#nn`),
        note: say((f) =>
          f.t(`The end value is known: $K_{${n}} = ${f.c(target)}$ €. The start capital $K_0$ is wanted.`, `Der Endwert ist bekannt: $K_{${n}} = ${f.c(target)}$\u00a0€. Gesucht ist das Startkapital $K_0$.`),
        ),
      },
      {
        math: say((f) => `K_0#K0 =#e ${f.c(target)}#Kn "€"#u :#t ${f.n(q)}#q^{${n}}#nn`),
        note: tx("Undo the growth: divide by $q^n$.", "Mach das Wachstum rückgängig: Teile durch $q^n$."),
        highlight: ["t", "nn"],
      },
      {
        math: say((f) => `K_0#K0 \\approx#e ${f.c(K0)}#r "€"#u`),
        note: say((f) =>
          f.t(
            `$${f.c(target)} : ${f.n(q)}^{${n}} \\approx ${f.c(K0)}$ €. Check: $${f.c(K0)} \\cdot ${f.n(q)}^{${n}} \\approx ${f.c(target)}$ €.`,
            `$${f.c(target)} : ${f.n(q)}^{${n}} \\approx ${f.c(K0)}$\u00a0€. Probe: $${f.c(K0)} \\cdot ${f.n(q)}^{${n}} \\approx ${f.c(target)}$\u00a0€.`,
          ),
        ),
        highlight: ["r"],
      },
    ],
    mistakes: mistakesFor(answer, [
      [
        target * (1 - p / 100) ** n,
        tx("Percent of the end value", "Prozent vom Endwert"),
        say((f) =>
          f.t(
            `Ooh, classic trap! You took $${f.n(p)} %$ off the **end** value every year. But the interest was $${f.n(p)} %$ of the **smaller** amount before. Divide by $${f.n(q)}^{${n}}$ instead.`,
            `Die klassische Falle! Du hast jedes Jahr $${f.n(p)} %$ vom **Endwert** abgezogen. Die Zinsen waren aber $${f.n(p)} %$ vom **kleineren** Betrag davor. Teile stattdessen durch $${f.n(q)}^{${n}}$.`,
          ),
        ),
      ],
      [
        target / (1 + (p * n) / 100),
        SIMPLE,
        tx(
          `Hmm, that's going back with simple interest, $${n}$ times the same interest. With compound interest, divide by the power $q^${n}$.`,
          `Hm, so rechnest du mit einfachen Zinsen zurück, $${n}$-mal dieselben Zinsen. Mit Zinseszins teilst du durch die Potenz $q^${n}$.`,
        ),
      ],
      [target / (q * n), TIMES_N(n), tx(`Close! But divide by $q^${n}$, not by $q \\cdot ${n}$.`, `Fast! Teile aber durch $q^${n}$, nicht durch $q \\cdot ${n}$.`)],
    ]),
  };
}

function startValueTask(rng: Rng): Exercise | null {
  return startValueExercise(rng.pick([2000, 5000, 10000, 15000, 20000, 25000]), rng.pick([1.5, 2, 2.5, 3, 4, 5]), rng.int(3, 15), rng.pick(SAVERS));
}

// ---------------------------------------------------------------------------
// Growth factor and percentage, both ways

type FactorStory = { up: boolean; ps: number[]; per: [string, string]; text: (p: number, f: Fmt) => string };

const FACTOR_STORIES: FactorStory[] = [
  {
    up: true,
    ps: [1.5, 2, 2.5, 3, 4],
    per: ["year", "Jahr"],
    text: (p, f) => f.t(`A town grows by ${perc(f, p)} per year.`, `Eine Stadt wächst um ${perc(f, p)} pro Jahr.`),
  },
  {
    up: true,
    ps: [10, 15, 20, 25, 30, 40, 60],
    per: ["week", "Woche"],
    text: (p, f) => f.t(`The area of algae on a pond grows by ${perc(f, p)} per week.`, `Die Algenfläche auf einem Teich wächst pro Woche um ${perc(f, p)}.`),
  },
  {
    up: false,
    ps: [5, 8, 10, 12, 15, 20, 25],
    per: ["hour", "Stunde"],
    text: (p, f) => f.t(`The body breaks down ${perc(f, p)} of a medicine per hour.`, `Der Körper baut pro Stunde ${perc(f, p)} eines Medikaments ab.`),
  },
  {
    up: false,
    ps: [10, 12, 15, 20, 25, 30],
    per: ["year", "Jahr"],
    text: (p, f) => f.t(`A new phone loses ${perc(f, p)} of its value every year.`, `Ein neues Handy verliert jedes Jahr ${perc(f, p)} seines Werts.`),
  },
  {
    up: false,
    ps: [1, 2, 3, 4],
    per: ["year", "Jahr"],
    text: (p, f) => f.t(`A glacier loses ${perc(f, p)} of its ice every year.`, `Ein Gletscher verliert jedes Jahr ${perc(f, p)} seines Eises.`),
  },
];

function factorExercise(story: FactorStory, p: number): Exercise {
  const q = 1 + (story.up ? p : -p) / 100;
  const answer: AnswerSpec = { kind: "number", value: r6(q), label: "q =" };
  return {
    instruction: tx("Find the growth factor", "Bestimme den Wachstumsfaktor"),
    text: say((f) => `${story.text(p, f)} ${f.t("What is the growth factor $q$?", "Wie groß ist der Wachstumsfaktor $q$?")}`),
    answer,
    hint: story.up
      ? tx("Growth by $p %$: $q = 1 + \\frac{p}{100}$.", "Zunahme um $p %$: $q = 1 + \\frac{p}{100}$.")
      : tx("Decay by $p %$: what stays is $100 % - p %$.", "Abnahme um $p %$: Es bleiben $100 % - p %$."),
    solution: [
      {
        math: say(({ n }) => `100#a %#ap ${story.up ? "+" : "-"}#pm ${n(p)}#b %#bp =#e ${n(100 + (story.up ? p : -p))}#c %#cp`),
        note: say((f) =>
          story.up
            ? f.t(`Every ${story.per[0]} the amount grows to $${f.n(100 + p)} %$ of the amount before.`, `Pro ${story.per[1]} wächst die Menge auf $${f.n(100 + p)} %$ der Menge davor.`)
            : f.t(`Every ${story.per[0]}, $${f.n(100 - p)} %$ of the amount stay.`, `Pro ${story.per[1]} bleiben $${f.n(100 - p)} %$ der Menge übrig.`),
        ),
      },
      {
        math: say(({ n }) => `q#q =#e ${n(100 + (story.up ? p : -p))}#c %#cp =#e2 ${n(q)}#f`),
        note: say((f) => f.t(`As a decimal: $q = ${f.n(q)}$.`, `Als Dezimalzahl: $q = ${f.n(q)}$.`)),
        highlight: ["f"],
      },
    ],
    mistakes: mistakesFor(answer, [
      [
        p / 100,
        tx("Only the change", "Nur die Änderung"),
        say((f) =>
          story.up
            ? f.t(
                `Hmm, $${f.n(p)} %$ is only what comes on top. The factor has to keep the old amount too: $1 + …$`,
                `Hm, $${f.n(p)} %$ sind nur das, was dazukommt. Der Faktor muss die alte Menge mit enthalten: $1 + …$`,
              )
            : f.t(
                `Ooh, classic trap! $${f.n(p)} %$ is the part that **disappears**. The growth factor is the part that **stays**.`,
                `Die klassische Falle! $${f.n(p)} %$ sind der Teil, der **verschwindet**. Der Wachstumsfaktor ist der Teil, der **bleibt**.`,
              ),
        ),
      ],
      [
        1 + (story.up ? -p : p) / 100,
        tx("Wrong direction", "Falsche Richtung"),
        story.up
          ? tx("Careful: the amount **grows**, so the factor must be bigger than $1$.", "Vorsicht: Die Menge **wächst**, der Faktor muss also größer als $1$ sein.")
          : tx("Careful: the amount **shrinks**, so the factor must be smaller than $1$.", "Vorsicht: Die Menge **schrumpft**, der Faktor muss also kleiner als $1$ sein."),
      ],
      p < 10 && [1 + (story.up ? p : -p) / 10, FACTOR_OFF, factorOff(p, story.up)],
    ]),
  };
}

const REVERSE_FACTORS: { q: number; a: number; what: [string, string]; text: (a: number, q: number, f: Fmt) => string; per: [string, string] }[] = [
  {
    what: ["the number of fish", "die Zahl der Fische"],
    q: 0.94,
    a: 2400,
    per: ["year", "Jahr"],
    text: (a, q, f) =>
      f.t(
        `The number of fish in a lake is described by $N(t) = ${a} \\cdot ${f.n(q)}^t$ ($t$ in years).`,
        `Die Zahl der Fische in einem See wird durch $N(t) = ${a} \\cdot ${f.n(q)}^t$ beschrieben ($t$ in Jahren).`,
      ),
  },
  {
    what: ["the number of bacteria", "die Zahl der Bakterien"],
    q: 1.35,
    a: 500,
    per: ["hour", "Stunde"],
    text: (a, q, f) =>
      f.t(`A bacteria culture grows like $B(t) = ${a} \\cdot ${f.n(q)}^t$ ($t$ in hours).`, `Eine Bakterienkultur wächst nach $B(t) = ${a} \\cdot ${f.n(q)}^t$ ($t$ in Stunden).`),
  },
  {
    what: ["the value", "der Wert"],
    q: 0.85,
    a: 24000,
    per: ["year", "Jahr"],
    text: (a, q, f) =>
      f.t(`The value of a car is $W(t) = ${a} \\cdot ${f.n(q)}^t$ euros after $t$ years.`, `Der Wert eines Autos beträgt nach $t$ Jahren $W(t) = ${a} \\cdot ${f.n(q)}^t$ Euro.`),
  },
  {
    what: ["the number of users", "die Nutzerzahl"],
    q: 1.08,
    a: 1200,
    per: ["month", "Monat"],
    text: (a, q, f) =>
      f.t(`The number of users of an app is $U(t) = ${a} \\cdot ${f.n(q)}^t$ after $t$ months.`, `Die Zahl der Nutzer einer App beträgt nach $t$ Monaten $U(t) = ${a} \\cdot ${f.n(q)}^t$.`),
  },
  {
    what: ["the ice", "das Eis"],
    q: 0.97,
    a: 800,
    per: ["year", "Jahr"],
    text: (a, q, f) =>
      f.t(`The ice of a glacier is $V(t) = ${a} \\cdot ${f.n(q)}^t$ million m³ after $t$ years.`, `Das Eis eines Gletschers beträgt nach $t$ Jahren $V(t) = ${a} \\cdot ${f.n(q)}^t$ Millionen m³.`),
  },
  {
    what: ["the population", "die Einwohnerzahl"],
    q: 1.025,
    a: 50000,
    per: ["year", "Jahr"],
    text: (a, q, f) =>
      f.t(`The population of a town is $E(t) = ${a} \\cdot ${f.n(q)}^t$ after $t$ years.`, `Die Einwohnerzahl einer Stadt beträgt nach $t$ Jahren $E(t) = ${a} \\cdot ${f.n(q)}^t$.`),
  },
];

function percentFromFactorExercise(item: (typeof REVERSE_FACTORS)[number], q: number): Exercise {
  const up = q > 1;
  const p = r6(Math.abs(q - 1) * 100);
  const answer = rateAnswer(p);
  return {
    instruction: tx("From the factor to the percentage", "Vom Faktor zum Prozentsatz"),
    text: say((f) =>
      `${item.text(item.a, q, f)} ${
        up
          ? f.t(`By how many percent does ${item.what[0]} grow per ${item.per[0]}?`, `Um wie viel Prozent wächst ${item.what[1]} pro ${item.per[1]}?`)
          : f.t(`By how many percent does ${item.what[0]} shrink per ${item.per[0]}?`, `Um wie viel Prozent nimmt ${item.what[1]} pro ${item.per[1]} ab?`)
      }`,
    ),
    answer,
    hint: tx("The base of the power is the growth factor $q$. Compare it with $1 = 100 %$.", "Die Basis der Potenz ist der Wachstumsfaktor $q$. Vergleich ihn mit $1 = 100 %$."),
    solution: [
      {
        math: say(({ n }) => `q#q =#e ${n(q)}#f =#e2 ${n(q * 100)}#c %#cp`),
        note: say((f) =>
          f.t(`The growth factor is $q = ${f.n(q)}$: after each step, $${f.n(q * 100)} %$ of the amount before.`, `Der Wachstumsfaktor ist $q = ${f.n(q)}$: Nach jedem Schritt sind es $${f.n(q * 100)} %$ der Menge davor.`),
        ),
      },
      {
        math: say(({ n }) => (up ? `${n(q * 100)}#c %#cp -#m 100#a %#ap =#e3 ${n(p)}#r %#rp` : `100#a %#ap -#m ${n(q * 100)}#c %#cp =#e3 ${n(p)}#r %#rp`)),
        note: say((f) =>
          up
            ? f.t(`That's $${f.n(p)} %$ more each ${item.per[0]}.`, `Das sind $${f.n(p)} %$ mehr pro ${item.per[1]}.`)
            : f.t(`That's $${f.n(p)} %$ less each ${item.per[0]}.`, `Das sind $${f.n(p)} %$ weniger pro ${item.per[1]}.`),
        ),
        highlight: ["r"],
      },
    ],
    mistakes: mistakesFor(answer, [
      [
        q * 100,
        up ? tx("New amount, not the growth", "Neue Menge statt Wachstum") : tx("What remains, not the loss", "Rest statt Abnahme"),
        up
          ? say((f) =>
              f.t(
                `Nearly! $${f.n(q * 100)} %$ is the new amount compared with the old one. The growth is only the part above $100 %$.`,
                `Fast! $${f.n(q * 100)} %$ ist die neue Menge im Vergleich zur alten. Das Wachstum ist nur der Teil über $100 %$.`,
              ),
            )
          : say((f) =>
              f.t(
                `Nearly! $${f.n(q * 100)} %$ is what **remains** each step. The question asks how much **disappears**.`,
                `Fast! $${f.n(q * 100)} %$ ist das, was jedes Mal **übrig bleibt**. Gefragt ist, wie viel **verschwindet**.`,
              ),
            ),
      ],
    ]),
  };
}

function factorTask(rng: Rng): Exercise | null {
  if (rng.chance(0.55)) {
    const story = rng.pick(FACTOR_STORIES);
    return factorExercise(story, rng.pick(story.ps));
  }
  const item = rng.pick(REVERSE_FACTORS);
  const q = rng.chance(0.5) ? item.q : rng.pick(item.q > 1 ? [1.02, 1.04, 1.06, 1.12, 1.15, 1.2, 1.25, 1.5] : [0.75, 0.8, 0.88, 0.9, 0.92, 0.95, 0.96, 0.98]);
  return percentFromFactorExercise(item, q > 1 === item.q > 1 ? q : item.q);
}

// ---------------------------------------------------------------------------
// The rate from two values: q^n = K_n : K_0

type TwoValueStory = { up: boolean; whole?: boolean; text: (a: number, b: number, n: number, f: Fmt) => string };

const TWO_VALUE_STORIES: TwoValueStory[] = [
  {
    up: true,
    text: (a, b, n, f) =>
      f.t(
        `Mila's savings grew from ${euro(f, a)} to ${euro(f, b)} in ${n} years, with the same interest rate and compound interest. What was the interest rate?`,
        `Milas Erspartes ist in ${n} Jahren bei gleichem Zinssatz mit Zinseszins von ${euro(f, a)} auf ${euro(f, b)} gewachsen. Wie hoch war der Zinssatz?`,
      ),
  },
  {
    up: true,
    whole: true,
    text: (a, b, n, f) =>
      f.t(
        `A town grew from ${f.big(String(a))} to ${f.big(String(b))} inhabitants in ${n} years, by the same percentage every year. By how many percent per year?`,
        `Eine Stadt ist in ${n} Jahren von ${f.big(String(a))} auf ${f.big(String(b))} Einwohner gewachsen, jedes Jahr um denselben Prozentsatz. Um wie viel Prozent pro Jahr?`,
      ),
  },
  {
    up: false,
    text: (a, b, n, f) =>
      f.t(
        `The value of a car fell from ${euro(f, a)} to ${euro(f, b)} in ${n} years, by the same percentage every year. By how many percent per year?`,
        `Der Wert eines Autos ist in ${n} Jahren von ${euro(f, a)} auf ${euro(f, b)} gefallen, jedes Jahr um denselben Prozentsatz. Um wie viel Prozent pro Jahr?`,
      ),
  },
];

function rateFromTwoTask(rng: Rng): Exercise | null {
  const story = rng.pick(TWO_VALUE_STORIES);
  const n = rng.chance(0.7) ? 2 : 3;
  const q = story.up ? rng.pick(n === 2 ? [1.02, 1.03, 1.05, 1.1, 1.2] : [1.1, 1.2]) : rng.pick(n === 2 ? [0.9, 0.8, 0.95, 0.85] : [0.9, 0.8]);
  const a = story.whole ? rng.pick([10000, 20000, 40000, 50000]) : rng.pick(story.up ? [1000, 2000, 5000, 8000, 10000] : [10000, 20000, 25000, 30000, 40000]);
  const b = a * q ** n;
  if (!exact2(b) || (story.whole && !Number.isInteger(r6(b)))) return null;
  const p = r6(Math.abs(q - 1) * 100);
  const ratio = b / a;
  const total = r6(Math.abs(ratio - 1) * 100);
  const answer = rateAnswer(p);
  const root = n === 2 ? (v: string) => `\\sqrt{${v}}` : (v: string) => `\\sqrt[3]{${v}}`;
  return {
    instruction: tx("Find the rate per year", "Bestimme den jährlichen Prozentsatz"),
    text: say((f) => story.text(a, r2(b), n, f)),
    answer,
    hint: tx(`$K_0 \\cdot q^${n} = K_${n}$: solve for $q$ with a root.`, `$K_0 \\cdot q^${n} = K_${n}$: Löse mit einer Wurzel nach $q$ auf.`),
    solution: [
      {
        math: say((f) => `${f.c(a)}#a \\cdot#t q#q^${n}#nn =#e ${f.c(r2(b))}#b`),
        note: tx(`Start value times $q^${n}$ gives the value after ${n} years.`, `Startwert mal $q^${n}$ ergibt den Wert nach ${n} Jahren.`),
      },
      {
        math: say((f) => `q#q^${n}#nn =#e \\frac{${f.c(r2(b))}#b}{${f.c(a)}#a}#fr =#e2 ${f.n(r6(ratio))}#rt`),
        note: tx("Divide by the start value.", "Teile durch den Startwert."),
        highlight: ["rt"],
      },
      {
        math: say((f) => `q#q =#e ${root(f.n(r6(ratio)))}#rt =#e2 ${f.n(q)}#v`),
        note: tx(n === 2 ? "Take the square root." : "Take the cube root.", n === 2 ? "Zieh die Wurzel." : "Zieh die dritte Wurzel."),
        highlight: ["v"],
      },
      {
        math: say((f) => `q#q =#e2 ${f.n(q)}#v \\Rightarrow#to ${story.up ? "+" : "-"}#s ${f.n(p)}#r %#rp`),
        note: say((f) =>
          story.up ? f.t(`$q = ${f.n(q)}$ means $${f.n(p)} %$ more per year.`, `$q = ${f.n(q)}$ heißt $${f.n(p)} %$ mehr pro Jahr.`) : f.t(`$q = ${f.n(q)}$ means $${f.n(p)} %$ less per year.`, `$q = ${f.n(q)}$ heißt $${f.n(p)} %$ weniger pro Jahr.`),
        ),
        highlight: ["r"],
      },
    ],
    mistakes: mistakesFor(answer, [
      [
        total,
        tx("Total change, not per year", "Gesamtänderung statt pro Jahr"),
        tx(
          `Nearly! That's the change over all ${n} years together. The question asks for the percentage of **one** year.`,
          `Fast! Das ist die Änderung über alle ${n} Jahre zusammen. Gefragt ist der Prozentsatz für **ein** Jahr.`,
        ),
      ],
      [
        total / n,
        tx("Total divided by the years", "Gesamtänderung durch die Jahre geteilt"),
        tx(
          `So close! Dividing the total change by $${n}$ ignores the compound effect: each year's change works on a new value. Take the root of the total factor instead.`,
          `Ganz knapp! Wenn du die Gesamtänderung durch $${n}$ teilst, übersiehst du den Zinseszins-Effekt: Jede Änderung bezieht sich auf einen neuen Wert. Zieh stattdessen die Wurzel aus dem Gesamtfaktor.`,
        ),
      ],
      [
        q * 100,
        tx("Factor as a percentage", "Faktor als Prozentsatz"),
        tx(
          "Nearly! That's the growth factor as a percentage. The change per year is only the difference to $100 %$.",
          "Fast! Das ist der Wachstumsfaktor in Prozent. Die Änderung pro Jahr ist nur der Unterschied zu $100 %$.",
        ),
      ],
    ]),
  };
}

// ---------------------------------------------------------------------------
// Doubling time and half-life with logarithms

type TimeStory = { up: boolean; ps: number[]; unit: Unit; text: (p: number, f: Fmt) => string };

const TIME_STORIES: TimeStory[] = [
  {
    up: true,
    ps: [1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8],
    unit: "years",
    text: (p, f) =>
      f.t(
        `Money is invested at ${perc(f, p)} interest per year with compound interest. After how many years has it doubled?`,
        `Geld wird zu ${perc(f, p)} Zinsen pro Jahr mit Zinseszins angelegt. Nach wie vielen Jahren hat es sich verdoppelt?`,
      ),
  },
  {
    up: true,
    ps: [0.8, 1, 1.2, 1.5, 2, 2.5, 3],
    unit: "years",
    text: (p, f) =>
      f.t(
        `The population of a country grows by ${perc(f, p)} per year. If that stays the same, after how many years will it have doubled?`,
        `Die Bevölkerung eines Landes wächst um ${perc(f, p)} pro Jahr. Nach wie vielen Jahren hat sie sich verdoppelt, wenn das so bleibt?`,
      ),
  },
  {
    up: true,
    ps: [10, 15, 20, 25, 30, 40, 50],
    unit: "hours",
    text: (p, f) =>
      f.t(
        `A bacteria culture grows by ${perc(f, p)} per hour. After how many hours has the number of bacteria doubled?`,
        `Eine Bakterienkultur wächst pro Stunde um ${perc(f, p)}. Nach wie vielen Stunden hat sich die Zahl der Bakterien verdoppelt?`,
      ),
  },
  {
    up: false,
    ps: [5, 8, 10, 12, 15, 20, 25, 30],
    unit: "hours",
    text: (p, f) =>
      f.t(
        `The body breaks down ${perc(f, p)} of a medicine per hour. After how many hours is only half of it left?`,
        `Der Körper baut pro Stunde ${perc(f, p)} eines Medikaments ab. Nach wie vielen Stunden ist nur noch die Hälfte übrig?`,
      ),
  },
  {
    up: false,
    ps: [10, 12, 15, 20, 25],
    unit: "years",
    text: (p, f) =>
      f.t(
        `A car loses ${perc(f, p)} of its value every year. After how many years is it only worth half its price?`,
        `Ein Auto verliert jedes Jahr ${perc(f, p)} seines Werts. Nach wie vielen Jahren ist es nur noch die Hälfte wert?`,
      ),
  },
  {
    up: false,
    ps: [2, 3, 4, 5, 8, 10],
    unit: "years",
    text: (p, f) =>
      f.t(
        `A radioactive substance decays by ${perc(f, p)} per year. What is its half-life?`,
        `Ein radioaktiver Stoff zerfällt um ${perc(f, p)} pro Jahr. Wie groß ist seine Halbwertszeit?`,
      ),
  },
];

function timeExercise(story: TimeStory, p: number): Exercise {
  const q = 1 + (story.up ? p : -p) / 100;
  const target = story.up ? 2 : 0.5;
  const T = Math.log(target) / Math.log(q);
  const answer = oneDecimal(T, story.unit);
  const fq = (f: Fmt) => f.n(q);
  const ft = (f: Fmt) => f.n(target);
  return {
    instruction: story.up ? tx("Find the doubling time", "Berechne die Verdopplungszeit") : tx("Find the half-life", "Berechne die Halbwertszeit"),
    text: say((f) => `${story.text(p, f)} ${ROUND_1(f)}`),
    answer,
    hint: say((f) =>
      f.t(
        `Solve $${fq(f)}^t = ${ft(f)}$: $t = \\frac{\\log(${ft(f)})}{\\log(${fq(f)})}$.`,
        `Löse $${fq(f)}^t = ${ft(f)}$: $t = \\frac{\\log(${ft(f)})}{\\log(${fq(f)})}$.`,
      ),
    ),
    solution: [
      {
        math: say((f) => `${fq(f)}#q^t#l =#e ${ft(f)}#r`),
        note: say((f) =>
          f.t(
            `Growth factor $q = ${fq(f)}$. The start value doesn't matter: the amount has ${story.up ? "doubled" : "halved"} when $q^t = ${ft(f)}$.`,
            `Wachstumsfaktor $q = ${fq(f)}$. Der Startwert spielt keine Rolle: Die Menge hat sich ${story.up ? "verdoppelt" : "halbiert"}, wenn $q^t = ${ft(f)}$.`,
          ),
        ),
      },
      {
        math: say((f) => `t#l =#e \\log_{${fq(f)}}#g (${ft(f)})#r`),
        note: tx("The exponent you're looking for is a logarithm.", "Der gesuchte Exponent ist ein Logarithmus."),
      },
      {
        math: say((f) => `t#l =#e \\frac{\\log(${ft(f)})}{\\log(${fq(f)})}#g \\approx#e2 ${f.n(r1(T))}#v`),
        note: say((f) =>
          f.t(
            `With the calculator (log or ln, both work): $t \\approx ${f.n(r1(T))}$ ${unitWord(story.unit, f)}.${story.up ? "" : " Both logarithms are negative, so $t$ is positive."}`,
            `Mit dem Taschenrechner (log oder ln, beides geht): $t \\approx ${f.n(r1(T))}$ ${unitWord(story.unit, f)}.${story.up ? "" : " Beide Logarithmen sind negativ, $t$ ist also positiv."}`,
          ),
        ),
        highlight: ["v"],
      },
    ],
    mistakes: oneDecimalMistakes(answer, [
      [
        (story.up ? 100 : 50) / p,
        LINEAR,
        say((f) =>
          story.up
            ? f.t(
                `Ah, you added $${f.n(p)} %$ of the **start** value each time until you reached $200 %$. But every step adds $${f.n(p)} %$ of the **current** value, so it doubles sooner.`,
                `Ah, du hast jedes Mal $${f.n(p)} %$ vom **Startwert** dazugezählt, bis $200 %$ erreicht waren. Aber jeder Schritt bringt $${f.n(p)} %$ vom **aktuellen** Wert, es verdoppelt sich also schneller.`,
              )
            : f.t(
                `Ah, you took $${f.n(p)} %$ of the **start** value away each time until $50 %$ were gone. But every step takes $${f.n(p)} %$ of what's **left**, so it takes longer.`,
                `Ah, du hast jedes Mal $${f.n(p)} %$ vom **Startwert** abgezogen, bis $50 %$ weg waren. Aber jeder Schritt nimmt $${f.n(p)} %$ vom **Rest**, es dauert also länger.`,
              ),
        ),
      ],
      [
        Math.log(q) / Math.log(target),
        UPSIDE_DOWN,
        tx(
          "Upside down! The logarithm of the target factor goes on top, the logarithm of $q$ below.",
          "Andersrum! Der Logarithmus des Zielfaktors kommt nach oben, der Logarithmus von $q$ nach unten.",
        ),
      ],
      !story.up && [
        Math.log(0.5) / Math.log(p / 100),
        tx("Wrong growth factor", "Falscher Wachstumsfaktor"),
        say((f) =>
          f.t(
            `Careful: $q$ is the part that **stays**, $1 - \\frac{${f.n(p)}}{100}$, not the part that disappears.`,
            `Vorsicht: $q$ ist der Teil, der **bleibt**, also $1 - \\frac{${f.n(p)}}{100}$, nicht der Teil, der verschwindet.`,
          ),
        ),
      ],
      p < 10 && [Math.log(target) / Math.log(1 + (story.up ? p : -p) / 10), FACTOR_OFF, factorOff(p, story.up)],
    ]),
  };
}

function timeTask(rng: Rng): Exercise | null {
  const story = rng.pick(TIME_STORIES);
  return timeExercise(story, rng.pick(story.ps));
}

// ---------------------------------------------------------------------------
// By trial: the first whole year above (or below) a limit

function trialTask(rng: Rng): Exercise | null {
  const up = rng.chance(0.55);
  const start = up ? rng.pick([2000, 4000, 5000, 8000, 10000]) : rng.pick([20000, 24000, 30000, 40000]);
  const p = up ? rng.pick([2, 2.5, 3, 4, 5, 6]) : rng.pick([10, 12, 15, 20]);
  const r = up ? rng.pick([1.2, 1.25, 1.5, 2]) : rng.pick([0.5, 0.4, 0.25]);
  const q = 1 + (up ? p : -p) / 100;
  const limit = start * r;
  let years = 0;
  let v = start;
  while (up ? v <= limit : v >= limit) {
    v *= q;
    years++;
  }
  const before = start * q ** (years - 1);
  if (Math.abs(v - limit) < 1 || Math.abs(before - limit) < 1 || years < 2) return null;
  const answer = amount(years, "years");
  const exact = Math.log(r) / Math.log(q);
  const linear = Math.ceil(Math.abs(r - 1) / (p / 100) - 1e-9);
  const sign = up ? ">" : "<";
  return {
    instruction: tx("Find the first whole year", "Bestimme das erste volle Jahr"),
    text: say((f) =>
      up
        ? f.t(
            `Lea invests ${euro(f, start)} at ${perc(f, p)} interest per year with compound interest. After how many whole years does she have more than ${euro(f, limit)} for the first time?`,
            `Lea legt ${euro(f, start)} zu ${perc(f, p)} Zinsen pro Jahr mit Zinseszins an. Nach wie vielen vollen Jahren hat sie zum ersten Mal mehr als ${euro(f, limit)}?`,
          )
        : f.t(
            `A car costs ${euro(f, start)} and loses ${perc(f, p)} of its value every year. After how many whole years is it worth less than ${euro(f, limit)} for the first time?`,
            `Ein Auto kostet ${euro(f, start)} und verliert jedes Jahr ${perc(f, p)} seines Werts. Nach wie vielen vollen Jahren ist es zum ersten Mal weniger als ${euro(f, limit)} wert?`,
          ),
    ),
    answer,
    hint: say((f) => f.t(`Solve $${f.n(q)}^n ${sign} ${f.n(r)}$ with a logarithm, or try whole years.`, `Löse $${f.n(q)}^n ${sign} ${f.n(r)}$ mit einem Logarithmus oder probier ganze Jahre aus.`)),
    solution: [
      {
        math: say((f) => `${f.c(start)}#s \\cdot#t ${f.n(q)}#q^n#nn ${sign}#rel ${f.c(limit)}#L`),
        note: say((f) => f.t(`After $n$ years the value is $${f.c(start)} \\cdot ${f.n(q)}^n$.`, `Nach $n$ Jahren ist der Wert $${f.c(start)} \\cdot ${f.n(q)}^n$.`)),
      },
      {
        math: say((f) => `${f.n(q)}#q^n#nn ${sign}#rel ${f.n(r)}#L`),
        note: say((f) => f.t(`Divide by $${f.c(start)}$.`, `Teile durch $${f.c(start)}$.`)),
      },
      {
        math: say((f) => `n#n >#rel \\frac{\\log(${f.n(r)})}{\\log(${f.n(q)})}#L \\approx#e ${f.n(r6(Math.round(exact * 100) / 100))}#v`),
        note: up
          ? tx("Take the logarithm. $\\log(q)$ is positive here, so the sign stays.", "Logarithmieren. $\\log(q)$ ist hier positiv, das Zeichen bleibt also.")
          : tx("Take the logarithm and divide by $\\log(q)$. That's **negative**, so the sign flips to $>$.", "Logarithmieren und durch $\\log(q)$ teilen. Der ist **negativ**, also dreht sich das Zeichen zu $>$."),
        highlight: ["rel"],
      },
      {
        math: `n#n =#rel ${years}#v`,
        note: say((f) =>
          f.t(
            `The first whole year is $n = ${years}$. Check: after ${years - 1} years about $${f.c(before)}$ €, after ${years} years about $${f.c(v)}$ €.`,
            `Das erste volle Jahr ist $n = ${years}$. Probe: nach ${years - 1} Jahren etwa $${f.c(before)}$\u00a0€, nach ${years} Jahren etwa $${f.c(v)}$\u00a0€.`,
          ),
        ),
        highlight: ["v"],
      },
    ],
    mistakes: mistakesFor(answer, [
      [
        years - 1,
        tx("One year too early", "Ein Jahr zu früh"),
        say((f) =>
          f.t(
            `So close! After ${years - 1} years it's about $${f.c(before)}$ €, not yet ${up ? "above" : "below"} $${f.c(limit)}$ €. Round **up** to the next whole year.`,
            `Ganz knapp! Nach ${years - 1} Jahren sind es etwa $${f.c(before)}$\u00a0€, noch nicht ${up ? "über" : "unter"} $${f.c(limit)}$\u00a0€. Runde auf das nächste volle Jahr **auf**.`,
          ),
        ),
      ],
      [
        linear,
        LINEAR,
        up
          ? tx(
              `Ah, that's what you'd get with the same interest every year. With compound interest the money grows faster.`,
              `Ah, das käme mit jedes Jahr gleich viel Zinsen heraus. Mit Zinseszins wächst das Geld schneller.`,
            )
          : tx(
              `Ah, that's what you'd get if the car lost $${p} %$ of its **new** price every year. But it loses $${p} %$ of its **current** value, so less and less.`,
              `Ah, das käme heraus, wenn das Auto jedes Jahr $${p} %$ vom **Neupreis** verlöre. Es verliert aber $${p} %$ vom **aktuellen** Wert, also immer weniger.`,
            ),
      ],
    ]),
  };
}

// ---------------------------------------------------------------------------
// Radioactive decay with a known half-life: N(t) = N_0 · (1/2)^(t/T)

const NUCLIDES: { en: string; de: string; T: number; unit: Unit }[] = [
  { en: "Iodine-131", de: "Iod-131", T: 8, unit: "days" },
  { en: "Technetium-99m", de: "Technetium-99m", T: 6, unit: "hours" },
  { en: "Caesium-137", de: "Caesium-137", T: 30, unit: "years" },
  { en: "Fluorine-18", de: "Fluor-18", T: 110, unit: "minutes" },
  { en: "Phosphorus-32", de: "Phosphor-32", T: 14, unit: "days" },
];

const HALVES = tx("Halving", "Halbieren");

function halfLifeTask(rng: Rng): Exercise | null {
  const nu = rng.pick(NUCLIDES);
  const k = rng.int(2, 5);
  const kind = rng.pick(["amount", "amount", "time", "T"] as const);
  const t = k * nu.T;
  const T = nu.T;
  const uw = (f: Fmt, dative = false) => unitWord(nu.unit, f, dative);
  if (kind === "amount") {
    const N0 = rng.pick([40, 80, 120, 160, 200, 240, 320, 400, 480, 640, 800, 1000]);
    const N = N0 / 2 ** k;
    if (!exact2(N)) return null;
    const answer = amount(N, "mg");
    return {
      instruction: tx("Radioactive decay", "Radioaktiver Zerfall"),
      text: say((f) =>
        f.t(
          `${nu.en} has a half-life of ${T} ${uw(f)}. A sample contains ${N0} mg of it. How much ${nu.en} is left after ${t} ${uw(f)}?`,
          `${nu.de} hat eine Halbwertszeit von ${T} ${uw(f, true)}. Eine Probe enthält ${N0} mg davon. Wie viel ${nu.de} ist nach ${t} ${uw(f, true)} noch übrig?`,
        ),
      ),
      answer,
      hint: say((f) => f.t(`How many half-lives are $${t}$ ${uw(f)}? Each one halves the amount.`, `Wie viele Halbwertszeiten sind $${t}$ ${uw(f)}? Jede halbiert die Menge.`)),
      solution: [
        {
          math: `\\frac{t}{T} =#e \\frac{${t}}{${T}} =#e2 ${k}#k`,
          note: say((f) => f.t(`$${t}$ ${uw(f)} are $${k}$ half-lives.`, `$${t}$ ${uw(f)} sind $${k}$ Halbwertszeiten.`)),
        },
        {
          math: say((f) => Array.from({ length: k + 1 }, (_, i) => `${i ? ` \\to#a${i} ` : ""}${f.n(N0 / 2 ** i)}#v${i}`).join("")),
          note: tx(`Halve it ${k} times.`, `${k}-mal halbieren.`),
        },
        {
          math: say((f) => `N#N =#e ${N0}#n0 \\cdot#t (\\frac{1}{2})^{${k}}#p =#e2 ${f.n(N)}#r "mg"#u`),
          note: say((f) => f.t(`With the formula: $${N0} \\cdot (\\frac{1}{2})^{${k}} = ${f.n(N)}$ mg.`, `Mit der Formel: $${N0} \\cdot (\\frac{1}{2})^{${k}} = ${f.n(N)}$ mg.`)),
          highlight: ["r"],
        },
      ],
      mistakes: mistakesFor(answer, [
        [
          N0 / (2 * k),
          tx("Divided by 2 · " + k, "Durch 2 · " + k + " geteilt"),
          tx(
            `Ah, you divided by $2 \\cdot ${k} = ${2 * k}$. But every half-life halves the amount **again**: $${k}$ times halving means dividing by $2^${k} = ${2 ** k}$.`,
            `Ah, du hast durch $2 \\cdot ${k} = ${2 * k}$ geteilt. Aber jede Halbwertszeit halbiert die Menge **erneut**: $${k}$-mal halbieren heißt durch $2^${k} = ${2 ** k}$ teilen.`,
          ),
        ],
        [
          N0 / 2,
          tx("Only halved once", "Nur einmal halbiert"),
          say((f) => f.t(`That's after one half-life. But $${t}$ ${uw(f)} are $${k}$ half-lives.`, `Das ist nach einer Halbwertszeit. Aber $${t}$ ${uw(f)} sind $${k}$ Halbwertszeiten.`)),
        ],
        [
          N0 - N,
          tx("The decayed part", "Der zerfallene Teil"),
          tx("Nearly! That's how much has **decayed**. The question asks what is **left**.", "Fast! So viel ist **zerfallen**. Gefragt ist, wie viel **übrig** ist."),
        ],
      ]),
    };
  }
  if (kind === "time") {
    const answer = amount(t, nu.unit);
    return {
      instruction: tx("Radioactive decay", "Radioaktiver Zerfall"),
      text: say((f) =>
        f.t(
          `${nu.en} has a half-life of ${T} ${uw(f)}. After how long is only $\\frac{1}{${2 ** k}}$ of a sample left?`,
          `${nu.de} hat eine Halbwertszeit von ${T} ${uw(f, true)}. Nach welcher Zeit ist nur noch $\\frac{1}{${2 ** k}}$ einer Probe übrig?`,
        ),
      ),
      answer,
      hint: tx(`How many times do you have to halve to get to $\\frac{1}{${2 ** k}}$?`, `Wie oft musst du halbieren, um auf $\\frac{1}{${2 ** k}}$ zu kommen?`),
      solution: [
        {
          math: Array.from({ length: k + 1 }, (_, i) => `${i ? ` \\to#a${i} ` : ""}${i ? `\\frac{1}{${2 ** i}}` : "1"}#v${i}`).join(""),
          note: tx(`Halving $${k}$ times gets you to $\\frac{1}{${2 ** k}}$, because $2^${k} = ${2 ** k}$.`, `$${k}$-mal halbieren führt zu $\\frac{1}{${2 ** k}}$, weil $2^${k} = ${2 ** k}$.`),
        },
        {
          math: say((f) => `t#t =#e ${k}#k \\cdot#m ${T}#T =#e2 ${t}#r "${uw(f)}"#u`),
          note: say((f) => f.t(`$${k}$ half-lives of $${T}$ ${uw(f)} each.`, `$${k}$ Halbwertszeiten zu je $${T}$ ${uw(f, true)}.`)),
          highlight: ["r"],
        },
      ],
      mistakes: mistakesFor(answer, [
        [
          T * 2 ** k,
          tx(`${2 ** k} half-lives?`, `${2 ** k} Halbwertszeiten?`),
          tx(
            `Hmm, $\\frac{1}{${2 ** k}}$ doesn't mean ${2 ** k} half-lives. Each half-life halves again: $\\frac{1}{2}, \\frac{1}{4}, \\frac{1}{8}, …$ Count the halvings.`,
            `Hm, $\\frac{1}{${2 ** k}}$ heißt nicht ${2 ** k} Halbwertszeiten. Jede Halbwertszeit halbiert erneut: $\\frac{1}{2}, \\frac{1}{4}, \\frac{1}{8}, …$ Zähl die Halbierungen.`,
          ),
        ],
        [
          T / 2 ** k,
          HALVES,
          tx("Careful: the **amount** gets smaller, the time gets longer. Each halving takes one more half-life.", "Vorsicht: Die **Menge** wird kleiner, die Zeit wird länger. Jede Halbierung dauert eine weitere Halbwertszeit."),
        ],
      ]),
    };
  }
  const N0 = rng.pick([80, 160, 320, 640, 960]);
  const N = N0 / 2 ** k;
  const answer = amount(T, nu.unit);
  return {
    instruction: tx("Radioactive decay", "Radioaktiver Zerfall"),
    text: say((f) =>
      f.t(
        `In a lab, a sample of a radioactive substance shrinks from ${N0} mg to ${f.n(N)} mg in ${t} ${uw(f)}. What is its half-life?`,
        `In einem Labor schrumpft eine Probe eines radioaktiven Stoffs in ${t} ${uw(f, true)} von ${N0} mg auf ${f.n(N)} mg. Wie groß ist seine Halbwertszeit?`,
      ),
    ),
    answer,
    hint: tx(`How many times was the amount halved? Share the time out among the halvings.`, `Wie oft wurde die Menge halbiert? Verteil die Zeit auf die Halbierungen.`),
    solution: [
      {
        math: say((f) => `\\frac{${N0}}{${f.n(N)}} =#e ${2 ** k}#q =#e2 2^{${k}}#k`),
        note: tx(`The amount shrank to $\\frac{1}{${2 ** k}}$: that's $${k}$ halvings.`, `Die Menge ist auf $\\frac{1}{${2 ** k}}$ geschrumpft: Das sind $${k}$ Halbierungen.`),
      },
      {
        math: say((f) => `T#T =#e \\frac{${t}}{${k}#k} =#e2 ${T}#r "${uw(f)}"#u`),
        note: say((f) => f.t(`$${t}$ ${uw(f)} for $${k}$ halvings: $T = ${T}$ ${uw(f)}.`, `$${t}$ ${uw(f)} für $${k}$ Halbierungen: $T = ${T}$ ${uw(f)}.`)),
        highlight: ["r"],
      },
    ],
    mistakes: mistakesFor(answer, [
      [
        t / 2 ** k,
        tx("Divided by the factor", "Durch den Faktor geteilt"),
        tx(`Ah, you divided by $${2 ** k}$. But the amount was halved only $${k}$ times, since $2^${k} = ${2 ** k}$.`, `Ah, du hast durch $${2 ** k}$ geteilt. Halbiert wurde aber nur $${k}$-mal, denn $2^${k} = ${2 ** k}$.`),
      ],
      [
        t / 2,
        tx("Half the time", "Die halbe Zeit"),
        tx("Hmm, half the time isn't the half-life here: the amount was halved several times.", "Hm, die halbe Zeit ist hier nicht die Halbwertszeit: Die Menge wurde mehrmals halbiert."),
      ],
    ]),
  };
}

// ---------------------------------------------------------------------------
// Compound growth and decay over a few years (tasks from the old one-lesson topic)

/** Compound growth or decay over n years. */
function compoundFrames(K: number, p: number, up: boolean, n: number, unit: Unit, whole = false): Frame[] {
  const q = 1 + (up ? p : -p) / 100;
  const exact = K * q ** n;
  const shown = whole ? String(Math.round(exact)) : unit === "€" ? cash(exact) : num(exact);
  const isExact = Math.abs(Number(shown) - exact) < 1e-9;
  const show = (f: Fmt) => (f.l === "de" ? shown.replace(".", ",") : shown);
  // Money keeps its unit on the board; counts (inhabitants) only get it in the result.
  const money = unit === "€";
  const L = money ? "K" : "N";
  const factors = (f: Fmt) => Array.from({ length: n }, (_, i) => ` \\cdot#t${i} ${f.n(q)}#q${i}`).join("");
  return [
    {
      math: say((f) => `${L}_${n} =#e ${K}#k${money ? f.ut(unit, "u") : ""}${factors(f)}`),
      note: say(({ t, n: N }) =>
        t(
          `Each year the value is multiplied by $q = ${N(q)}$. After ${n} years, that's ${n} times.`,
          `Jedes Jahr wird der Wert mit $q = ${N(q)}$ multipliziert. Nach ${n} Jahren also ${n}-mal.`,
        ),
      ),
    },
    {
      math: say((f) => `${L}_${n} =#e ${K}#k${money ? f.ut(unit, "u") : ""} \\cdot#t0 ${f.n(q)}#q0^{${n}#n}`),
      note: say(({ t, n: N }) => t(`Write it as a power: $${L}_${n} = ${K} \\cdot ${N(q)}^${n}$.`, `Schreib das als Potenz: $${L}_${n} = ${K} \\cdot ${N(q)}^${n}$.`)),
      highlight: ["n"],
    },
    {
      math: say((f) => `${L}_${n} ${isExact ? "=" : "\\approx"}#e ${show(f)}#k${f.ut(unit, "u")}`),
      note: say((f) =>
        f.t(
          `With a calculator: $${K} \\cdot ${f.n(q)}^${n} ${isExact ? "=" : "\\approx"} ${show(f)}$${f.uw(unit)}.${isExact ? "" : whole ? " Rounded to a whole number." : " Rounded to the cent."}`,
          `Mit dem Taschenrechner: $${K} \\cdot ${f.n(q)}^${n} ${isExact ? "=" : "\\approx"} ${show(f)}$${f.uw(unit)}.${isExact ? "" : whole ? " Auf eine ganze Zahl gerundet." : " Auf Cent gerundet."}`,
        ),
      ),
    },
  ];
}

const COMPOUND_STORIES: { up: boolean; whole?: boolean; unit: Unit; text: (K: string, p: number, n: number, f: Fmt) => string }[] = [
  {
    up: true,
    unit: "€",
    text: (K, p, n, { t }) =>
      t(
        `Mia puts ${K} € into a savings account with ${p} % interest per year. The interest stays in the account and earns interest too (Zinseszins). How much money is in the account after ${n} years? Round to the cent.`,
        `Mia legt ${K}\u00a0€ auf ein Sparkonto mit ${p}\u00a0% Zinsen pro Jahr. Die Zinsen bleiben auf dem Konto und werden mitverzinst (Zinseszins). Wie viel Geld ist nach ${n} Jahren auf dem Konto? Runde auf Cent.`,
      ),
  },
  {
    up: false,
    unit: "€",
    text: (K, p, n, { t }) =>
      t(
        `A new car costs ${K} €. It loses ${p} % of its value every year. What is it worth after ${n} years? Round to the cent.`,
        `Ein Neuwagen kostet ${K}\u00a0€. Er verliert jedes Jahr ${p}\u00a0% seines Werts. Wie viel ist er nach ${n} Jahren noch wert? Runde auf Cent.`,
      ),
  },
  {
    up: true,
    whole: true,
    unit: "inhabitants",
    text: (K, p, n, { t }) =>
      t(
        `A town has ${K} inhabitants. The population grows by ${p} % each year. How many inhabitants will it have after ${n} years? Round to a whole number.`,
        `Eine Stadt hat ${K} Einwohner. Die Einwohnerzahl wächst jedes Jahr um ${p}\u00a0%. Wie viele Einwohner hat sie nach ${n} Jahren? Runde auf eine ganze Zahl.`,
      ),
  },
];

function compoundTask(rng: Rng): Exercise | null {
  const story = rng.pick(COMPOUND_STORIES);
  const p = story.up ? rng.pick([2, 3, 4, 5]) : rng.pick([10, 15, 20, 25]);
  const n = rng.int(2, 3);
  const K = story.whole ? rng.int(5, 40) * 1000 : story.up ? rng.pick([500, 1000, 2000, 2500, 5000]) : rng.pick([10000, 12000, 15000, 20000, 25000, 30000]);
  const q = 1 + (story.up ? p : -p) / 100;
  const exact = K * q ** n;
  const value = story.whole ? Math.round(exact) : r2(exact);
  const answer: AnswerSpec = story.whole ? { kind: "number", value, unit: unitText(story.unit), tolerance: 1.01 / Math.max(1, value) } : amount(value, "€");
  const linear = !story.up
    ? tx(
        `Ah, I see what happened! You took $${p} %$ of the **original** price off every year. But each year it loses $${p} %$ of its **current** value.`,
        `Ah, ich seh, was passiert ist! Du hast jedes Jahr $${p} %$ vom **ursprünglichen** Preis abgezogen. Aber jedes Jahr verliert er $${p} %$ von seinem **aktuellen** Wert.`,
      )
    : story.whole
      ? tx(
          `Ah, I see what happened! You added $${p} %$ of the **original** population every year. But each year it grows by $${p} %$ of the **current** population.`,
          `Ah, ich seh, was passiert ist! Du hast jedes Jahr $${p} %$ der **ursprünglichen** Einwohnerzahl dazugezählt. Aber jedes Jahr wächst sie um $${p} %$ der **aktuellen** Einwohnerzahl.`,
        )
      : tx(
          `Ah, I see what happened! You added $${p} %$ of the **starting** amount every year. But the interest earns interest too: each year it's $${p} %$ of the **new** balance.`,
          `Ah, ich seh, was passiert ist! Du hast jedes Jahr $${p} %$ vom **Startbetrag** draufgerechnet. Aber die Zinsen werden mitverzinst: Jedes Jahr kommen $${p} %$ vom **neuen** Kontostand dazu.`,
        );
  return {
    instruction: WORD_PROBLEM,
    text: say((f) => story.text(f.big(String(K)), p, n, f)),
    answer,
    hint: say(({ t, n: N }) =>
      t(
        `Growth factor $q = ${N(1 + (story.up ? p : -p) / 100)}$, once per year: multiply by $q^${n}$.`,
        `Wachstumsfaktor $q = ${N(1 + (story.up ? p : -p) / 100)}$, einmal pro Jahr: Multipliziere mit $q^${n}$.`,
      ),
    ),
    solution: compoundFrames(K, p, story.up, n, story.unit, story.whole),
    mistakes: mistakesFor(answer, [
      [
        K * (1 + ((story.up ? p : -p) * n) / 100),
        story.up && !story.whole ? tx("Interest on interest forgotten", "Zinseszins vergessen") : tx("Same amount every year", "Jedes Jahr gleich viel"),
        linear,
      ],
      [
        K * q * n,
        tx(`Times ${n} instead of to the power ${n}`, `Mal ${n} statt hoch ${n}`),
        say(({ t, n: N }) =>
          t(
            `Close idea! But multiplying by $${n}$ isn't the same as multiplying by $${N(q)}$ ${n} times. Use the power $${N(q)}^${n}$.`,
            `Gute Idee, aber mal $${n}$ ist nicht dasselbe wie ${n}-mal mit $${N(q)}$ malnehmen. Nimm die Potenz $${N(q)}^${n}$.`,
          ),
        ),
      ],
      story.up && p < 10 && [K * (1 + p / 10) ** n, FACTOR_OFF, factorOff(p, true)],
    ]),
  };
}

// ---------------------------------------------------------------------------
// Linear or exponential? A table of values

/** A table of values in a row, as in German textbooks (Wertetabelle). */
function ValueTable({ xs, ys, xName = "x", yName = "f(x)" }: { xs: number[]; ys: number[]; xName?: string; yName?: string }) {
  const { n } = useFmt();
  const cell = "border border-line px-3 py-1.5 text-center";
  return (
    <div className="grid place-items-center py-2">
      <div className="max-w-full overflow-x-auto">
        <table className="border-collapse font-math text-[17px] tabular-nums">
          <tbody>
            <tr>
              <th className={cn(cell, "bg-surface font-semibold italic")}>{xName}</th>
              {xs.map((x, i) => (
                <td key={i} className={cell}>
                  {n(x)}
                </td>
              ))}
            </tr>
            <tr>
              <th className={cn(cell, "bg-surface font-semibold italic")}>{yName}</th>
              {ys.map((y, i) => (
                <motion.td key={i} className={cell} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
                  {n(y)}
                </motion.td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const linTerm = (m: number, b: number, f: Fmt) => `f(x) = ${f.n(m)}x ${b < 0 ? "-" : "+"} ${f.n(Math.abs(b))}`;
const expTerm = (a: number, q: number, f: Fmt) => `f(x) = ${f.n(a)} \\cdot ${f.n(q)}^x`;

function linExpTask(rng: Rng): Exercise | null {
  const kind = rng.pick(["exp", "exp", "lin", "lin", "neither"] as const);
  const xs = [0, 1, 2, 3];
  let ys: number[];
  let a: number;
  let m = 0;
  let q = 1;
  if (kind === "exp") {
    a = rng.pick([50, 80, 100, 120, 160, 200, 250, 400, 500, 1000]);
    q = rng.pick([1.5, 2, 0.5, 1.2, 0.8, 3, 1.1, 0.9]);
    ys = xs.map((x) => a * q ** x);
  } else if (kind === "lin") {
    a = rng.pick([20, 40, 50, 60, 80, 100, 120, 150, 200, 300]);
    m = rng.pick([10, 15, 20, 25, 30, 40, 50, 60, -10, -15, -20, -5]);
    ys = xs.map((x) => a + m * x);
  } else {
    a = rng.pick([2, 3, 4, 5, 10, 20, 25]);
    ys = xs.map((x) => a * (x + 1) ** 2);
  }
  ys = ys.map(r6);
  if (!ys.every(exact2) || ys.some((y) => y <= 0)) return null;
  const d1 = r6(ys[1] - ys[0]);
  const q1 = r6(ys[1] / ys[0]);
  const q2 = r6(ys[2] / ys[1]);
  if (!exact2(q1) || (kind === "neither" && !exact2(q2))) return null;
  const neither = tx("neither linear nor exponential", "weder linear noch exponentiell");
  const term = (build: (f: Fmt) => string): Text => say((f) => `$${build(f)}$`);
  // Options: [correct, tempting, …]
  let opts: { text: Text; title?: Text; say?: Text }[];
  if (kind === "exp")
    opts = [
      { text: term((f) => expTerm(a, q, f)) },
      {
        text: term((f) => linTerm(d1, a, f)),
        title: tx("Only the first step", "Nur der erste Schritt"),
        say: tx(
          "Only the first difference fits: after that, the differences change. Look at the quotients of neighbouring values instead.",
          "Nur die erste Differenz passt: Danach ändern sich die Differenzen. Schau dir stattdessen die Quotienten benachbarter Werte an.",
        ),
      },
      {
        text: term((f) => `f(x) = ${f.n(q)} \\cdot ${f.n(a)}^x`),
        title: tx("a and q swapped", "a und q vertauscht"),
        say: tx("Swapped! $a$ is the start value $f(0)$, and $q$ is the base of the power.", "Vertauscht! $a$ ist der Startwert $f(0)$, und $q$ ist die Basis der Potenz."),
      },
      {
        text: neither,
        title: tx("Look at the quotients", "Schau auf die Quotienten"),
        say: tx("Hmm, divide each value by the one before: the quotient is always the same.", "Hm, teil jeden Wert durch den davor: Der Quotient ist immer gleich."),
      },
    ];
  else if (kind === "lin")
    opts = [
      { text: term((f) => linTerm(m, a, f)) },
      {
        text: term((f) => expTerm(a, q1, f)),
        title: tx("Only the first step", "Nur der erste Schritt"),
        say: tx(
          "Only the first quotient fits: after that, the quotients change. Look at the differences of neighbouring values instead.",
          "Nur der erste Quotient passt: Danach ändern sich die Quotienten. Schau dir stattdessen die Differenzen benachbarter Werte an.",
        ),
      },
      {
        text: term((f) => linTerm(a, m, f)),
        title: tx("m and b swapped", "m und b vertauscht"),
        say: tx("Swapped! In $f(x) = m x + b$, $m$ is the step per $x$ and $b = f(0)$ is the start value.", "Vertauscht! In $f(x) = m x + b$ ist $m$ der Schritt pro $x$ und $b = f(0)$ der Startwert."),
      },
      {
        text: neither,
        title: tx("Look at the differences", "Schau auf die Differenzen"),
        say: tx("Hmm, subtract each value from the next: the difference is always the same.", "Hm, zieh jeden Wert vom nächsten ab: Die Differenz ist immer gleich."),
      },
    ];
  else
    opts = [
      { text: neither },
      {
        text: term((f) => linTerm(d1, a, f)),
        title: tx("Only the first step", "Nur der erste Schritt"),
        say: tx("Only the first difference fits. Check all the differences: are they the same?", "Nur die erste Differenz passt. Prüf alle Differenzen: Sind sie gleich?"),
      },
      {
        text: term((f) => expTerm(a, q1, f)),
        title: tx("Only the first step", "Nur der erste Schritt"),
        say: tx("Only the first quotient fits. Check all the quotients: are they the same?", "Nur der erste Quotient passt. Prüf alle Quotienten: Sind sie gleich?"),
      },
      {
        text: term((f) => expTerm(a, q2, f)),
        title: tx("Quotients not constant", "Quotienten nicht konstant"),
        say: tx("That quotient only fits one step. Check all the quotients: are they the same?", "Dieser Quotient passt nur zu einem Schritt. Prüf alle Quotienten: Sind sie gleich?"),
      },
    ];
  if (new Set(opts.map((o) => JSON.stringify(o.text))).size < opts.length) return null;
  const order = rng.shuffle([0, 1, 2, 3]);
  const options = order.map((i) => opts[i].text);
  const pos = (i: number) => order.indexOf(i);
  const diffs = [1, 2, 3].map((i) => r6(ys[i] - ys[i - 1]));
  const quots = [1, 2, 3].map((i) => r6(ys[i] / ys[i - 1]));
  const showList = (list: number[], f: Fmt) => list.map((v) => f.n(Math.round(v * 100) / 100)).join(" ,\\quad ");
  const isConst = (list: number[]) => list.every((v) => Math.abs(v - list[0]) < 1e-9);
  return {
    instruction: tx("Linear or exponential?", "Linear oder exponentiell?"),
    text: tx("Which function fits the table of values?", "Welche Funktion passt zur Wertetabelle?"),
    visual: { component: ValueTable as unknown as ComponentType<Record<string, unknown>>, props: { xs, ys } },
    answer: { kind: "choice", options, correct: pos(0) },
    hint: tx(
      "Work out the differences and the quotients of neighbouring values. Which one is constant?",
      "Bestimme die Differenzen und die Quotienten benachbarter Werte. Was davon ist konstant?",
    ),
    solution: [
      {
        math: say((f) => `\\Delta#D :#c ${showList(diffs, f)}`),
        note: isConst(diffs)
          ? tx("The differences are all the same: **linear**.", "Die Differenzen sind alle gleich: **linear**.")
          : tx("The differences are not all the same: not linear.", "Die Differenzen sind nicht alle gleich: nicht linear."),
      },
      {
        math: say((f) => `q#D :#c ${showList(quots, f)}`),
        note: isConst(quots)
          ? tx("The quotients are all the same: **exponential**.", "Die Quotienten sind alle gleich: **exponentiell**.")
          : tx(
              `The quotients are not all the same either${isConst(diffs) ? "" : ": neither linear nor exponential"}.`,
              `Die Quotienten sind auch nicht alle gleich${isConst(diffs) ? "" : ": weder linear noch exponentiell"}.`,
            ),
      },
      {
        math: kind === "exp" ? say((f) => expTerm(a, q, f)) : kind === "lin" ? say((f) => linTerm(m, a, f)) : tx('"neither"', '"weder noch"'),
        note:
          kind === "exp"
            ? say((f) => f.t(`Start value $a = f(0) = ${f.n(a)}$, factor $q = ${f.n(q)}$.`, `Startwert $a = f(0) = ${f.n(a)}$, Faktor $q = ${f.n(q)}$.`))
            : kind === "lin"
              ? say((f) => f.t(`Start value $b = f(0) = ${f.n(a)}$, step $m = ${f.n(m)}$.`, `Startwert $b = f(0) = ${f.n(a)}$, Steigung $m = ${f.n(m)}$.`))
              : tx("Neither the differences nor the quotients are constant.", "Weder die Differenzen noch die Quotienten sind konstant."),
      },
    ],
    mistakes: [1, 2, 3].map((i) => ({ when: { kind: "choice" as const, options, correct: pos(i) }, title: opts[i].title, say: opts[i].say! })),
  };
}

// ---------------------------------------------------------------------------
// f(x) = a · q^x through two points

function pairTask(rng: Rng): Exercise | null {
  const variant = rng.pick(["01", "02", "12"] as const);
  const a = rng.pick([50, 80, 100, 200, 250, 400, 500, 1000]);
  const q = rng.pick([1.1, 1.2, 1.5, 2, 0.8, 0.5, 0.9, 3]);
  const at = (x: number) => r6(a * q ** x);
  const [x1, x2] = variant === "01" ? [0, 1] : variant === "02" ? [0, 2] : [1, 2];
  const y1 = at(x1);
  const y2 = at(x2);
  if (!exact2(y1) || !exact2(y2)) return null;
  const answer: AnswerSpec = { kind: "pair", names: ["a", "q"], values: [a, q] };
  const when = (va: number, vq: number): AnswerSpec => ({ kind: "pair", names: ["a", "q"], values: [r6(va), r6(vq)] });
  const P = (f: Fmt, x: number, y: number) => `(${x} | ${f.n(y)})`;
  const frames: Frame[] =
    variant === "01"
      ? [
          { math: say((f) => `a#a =#e f(0)#f0 =#e2 ${f.n(y1)}#y1`), note: tx("At $x = 0$ the power is $q^0 = 1$, so $f(0) = a$.", "Bei $x = 0$ ist $q^0 = 1$, also ist $f(0) = a$.") },
          {
            math: say((f) => `q#q =#e \\frac{f(1)}{f(0)}#fr =#e2 \\frac{${f.n(y2)}}{${f.n(y1)}}#fr2 =#e3 ${f.n(q)}#v`),
            note: tx("One step further, the value is multiplied by $q$ once.", "Einen Schritt weiter wird der Wert einmal mit $q$ multipliziert."),
            highlight: ["v"],
          },
        ]
      : variant === "02"
        ? [
            { math: say((f) => `a#a =#e f(0)#f0 =#e2 ${f.n(y1)}#y1`), note: tx("At $x = 0$: $f(0) = a$.", "Bei $x = 0$ gilt $f(0) = a$.") },
            {
              math: say((f) => `q^2#q =#e \\frac{f(2)}{f(0)}#fr =#e2 \\frac{${f.n(y2)}}{${f.n(y1)}}#fr2 =#e3 ${f.n(r6(q * q))}#v`),
              note: tx("From $x = 0$ to $x = 2$ are two steps: $q^2$.", "Von $x = 0$ bis $x = 2$ sind es zwei Schritte: $q^2$."),
            },
            {
              math: say((f) => `q#q =#e \\sqrt{${f.n(r6(q * q))}}#fr =#e3 ${f.n(q)}#v`),
              note: tx("Take the root. $q$ is always positive.", "Zieh die Wurzel. $q$ ist immer positiv."),
              highlight: ["v"],
            },
          ]
        : [
            {
              math: say((f) => `q#q =#e \\frac{f(2)}{f(1)}#fr =#e2 \\frac{${f.n(y2)}}{${f.n(y1)}}#fr2 =#e3 ${f.n(q)}#v`),
              note: tx("Neighbouring values: the quotient is $q$.", "Benachbarte Werte: Der Quotient ist $q$."),
            },
            {
              math: say((f) => `a#a =#e \\frac{f(1)}{q}#fr =#e2 \\frac{${f.n(y1)}}{${f.n(q)}}#fr2 =#e3 ${f.n(a)}#y1`),
              note: tx("$f(1) = a \\cdot q$, so go one step back: divide by $q$.", "$f(1) = a \\cdot q$, also einen Schritt zurück: durch $q$ teilen."),
              highlight: ["y1"],
            },
          ];
  frames.push({
    math: say((f) => `f(x)#fx =#e ${f.n(a)}#y1 \\cdot#t ${f.n(q)}#v^x#xx`),
    note: say((f) =>
      f.t(`So $f(x) = ${f.n(a)} \\cdot ${f.n(q)}^x$. Check: $f(${x2}) = ${f.n(y2)}$.`, `Also $f(x) = ${f.n(a)} \\cdot ${f.n(q)}^x$. Probe: $f(${x2}) = ${f.n(y2)}$.`),
    ),
  });
  const mistakes: Mistake[] = [];
  const add = (m: Mistake) => {
    const v = (m.when as { values: number[] }).values;
    if (v[0] === a && v[1] === q) return;
    if (mistakes.some((o) => JSON.stringify((o.when as { values: number[] }).values) === JSON.stringify(v))) return;
    if (v[1] <= 0) return;
    mistakes.push(m);
  };
  if (variant !== "02")
    add({
      when: when(a, y2 - y1),
      title: tx("Difference instead of quotient", "Differenz statt Quotient"),
      say: tx(
        "Ah, that's the **difference** of the two values. For an exponential function, $q$ is the **quotient**: one value divided by the one before.",
        "Ah, das ist die **Differenz** der beiden Werte. Bei einer Exponentialfunktion ist $q$ der **Quotient**: ein Wert geteilt durch den davor.",
      ),
    });
  if (variant === "02")
    add({
      when: when(a, q * q),
      title: tx("Root forgotten", "Wurzel vergessen"),
      say: tx("So close! From $x = 0$ to $x = 2$ are **two** steps, so the quotient is $q^2$. Take the root.", "Ganz knapp! Von $x = 0$ bis $x = 2$ sind es **zwei** Schritte, der Quotient ist also $q^2$. Zieh die Wurzel."),
    });
  if (variant === "12")
    add({
      when: when(y1, q),
      title: tx("f(1) taken as a", "f(1) als a genommen"),
      say: tx("Nearly! $a$ is the value at $x = 0$, one step **before** $f(1)$. Divide $f(1)$ by $q$.", "Fast! $a$ ist der Wert bei $x = 0$, einen Schritt **vor** $f(1)$. Teile $f(1)$ durch $q$."),
    });
  return {
    instruction: tx("Find a and q", "Bestimme a und q"),
    text: say((f) =>
      f.t(
        `The graph of the exponential function $f(x) = a \\cdot q^x$ passes through the points $P${P(f, x1, y1)}$ and $Q${P(f, x2, y2)}$. Find $a$ and $q$.`,
        `Der Graph der Exponentialfunktion $f(x) = a \\cdot q^x$ verläuft durch die Punkte $P${P(f, x1, y1)}$ und $Q${P(f, x2, y2)}$. Bestimme $a$ und $q$.`,
      ),
    ),
    answer,
    hint: tx("Divide the two values: that gives $q$ (or a power of $q$).", "Teile die beiden Werte durcheinander: Das ergibt $q$ (oder eine Potenz von $q$)."),
    solution: frames,
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Widget: the growth lab. Choose a percentage, watch N(t) = 100 · q^t

const LAB_PRESETS = [3, 7, 25, 100, -20, -50];
const LAB_YEARS = 10;
const LAB_START = 100;

/** A round grid step: 1, 2 or 5 times a power of ten, at least v. */
function niceStep(v: number) {
  let e = 1;
  while (e * 10 <= v) e *= 10;
  while (e > v) e /= 10;
  const m = v / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e;
}

/** SVG coordinates rounded, so the server and the browser write the same markup. */
const fix = (v: number) => Math.round(v * 10) / 10;

const SVG_TEXT = { fill: "var(--ink-3)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

function GrowthLab() {
  const scope = useId();
  const f = useFmt();
  const { t, n } = f;
  const [p, setP] = useState(7);
  const [compare, setCompare] = useState(false);

  const q = 1 + p / 100;
  const val = (x: number) => LAB_START * pow(q, x);
  const lin = (x: number) => Math.max(0, LAB_START * (1 + (p / 100) * x));
  const target = p >= 0 ? 2 * LAB_START : LAB_START / 2;
  const T = p === 0 ? 0 : Math.log(target / LAB_START) / Math.log(q);
  const showT = p !== 0 && T > 0 && T <= LAB_YEARS;
  const top = Math.max(val(LAB_YEARS), LAB_START, compare ? lin(LAB_YEARS) : 0, p > 0 ? target : 0) * 1.05;
  const step = niceStep(top / 4);
  const yMax = Math.ceil(top / step - 1e-9) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const W = 360;
  const H = 230;
  const L = 50;
  const R = 14;
  const TOP = 14;
  const B = 30;
  const X = (x: number) => fix(L + (x / LAB_YEARS) * (W - L - R));
  const Y = (v: number) => fix(H - B - (Math.min(v, yMax) / yMax) * (H - TOP - B));
  const path = (g: (x: number) => number) =>
    Array.from({ length: 101 }, (_, i) => {
      const x = i / 10;
      return `${i ? "L" : "M"}${X(x)},${Y(g(x))}`;
    }).join(" ");
  const spring = { type: "spring" as const, stiffness: 200, damping: 26 };
  const sign = p > 0 ? "+" : p < 0 ? "−" : "±";
  const readout =
    p === 0
      ? t("q = 1: nothing changes.", "q = 1: Es ändert sich nichts.")
      : p > 0
        ? t(
            `q = ${n(q)}: every year ${n(p)} % more than the year before. Doubling time about ${n(r1(T))} ${r1(T) === 1 ? "year" : "years"}.`,
            `q = ${n(q)}: jedes Jahr ${n(p)} % mehr als im Jahr davor. Verdopplungszeit etwa ${n(r1(T))} ${r1(T) === 1 ? "Jahr" : "Jahre"}.`,
          )
        : t(
            `q = ${n(q)}: every year ${n(-p)} % less than the year before. Half-life about ${n(r1(T))} ${r1(T) === 1 ? "year" : "years"}.`,
            `q = ${n(q)}: jedes Jahr ${n(-p)} % weniger als im Jahr davor. Halbwertszeit etwa ${n(r1(T))} ${r1(T) === 1 ? "Jahr" : "Jahre"}.`,
          );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="flex items-baseline justify-between gap-3 text-[13px] text-ink-2">
            <span>{t("Change per year", "Änderung pro Jahr")}</span>
            <span className="font-math text-[18px] font-semibold tabular-nums text-blob-ink">
              {sign}
              {n(Math.abs(p))} %
            </span>
          </span>
          <input
            type="range"
            min={-50}
            max={100}
            step={1}
            value={p}
            onChange={(e) => setP(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: "var(--blob)" }}
            aria-label={t("Change per year in percent", "Änderung pro Jahr in Prozent")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Try", "Probier")}</span>
          {LAB_PRESETS.map((v) => (
            <Pill key={v} active={p === v} onClick={() => setP(v)}>
              {v > 0 ? "+" : "−"}
              {Math.abs(v)} %
            </Pill>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <Pill active={compare} onClick={() => setCompare((c) => !c)}>
            {t("Compare with linear", "Mit linear vergleichen")}
          </Pill>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-line bg-surface p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={readout}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={L - 6} y={Y(v) + 3.5} textAnchor="end" {...SVG_TEXT}>
                {f.big(String(v))}
              </text>
            </g>
          ))}
          {Array.from({ length: LAB_YEARS / 2 + 1 }, (_, i) => i * 2).map((x) => (
            <text key={x} x={X(x)} y={H - B + 15} textAnchor="middle" {...SVG_TEXT}>
              {x}
            </text>
          ))}
          <text x={W - R} y={H - 3} textAnchor="end" {...SVG_TEXT} fontStyle="italic">
            {t("t in years", "t in Jahren")}
          </text>
          <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="var(--ink-3)" strokeWidth={1.2} />
          <line x1={L} x2={L} y1={TOP} y2={Y(0)} stroke="var(--ink-3)" strokeWidth={1.2} />

          <AnimatePresence>
            {showT && (
              <motion.g key="T" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.line
                  initial={false}
                  animate={{ x1: L, x2: X(T), y1: Y(target), y2: Y(target) }}
                  transition={spring}
                  stroke="var(--ink-2)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <motion.line initial={false} animate={{ x1: X(T), x2: X(T), y1: Y(target), y2: Y(0) }} transition={spring} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 3" />
              </motion.g>
            )}
          </AnimatePresence>

          {showT && (
            <g>
              <line x1={L + 8} x2={L + 26} y1={TOP + 8} y2={TOP + 8} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={L + 31} y={TOP + 11.5} {...SVG_TEXT} fill="var(--ink)">
                {p > 0 ? t(`doubled after ${n(r1(T))} ${r1(T) === 1 ? "year" : "years"}`, `verdoppelt nach ${n(r1(T))} ${r1(T) === 1 ? "Jahr" : "Jahren"}`) : t(`halved after ${n(r1(T))} ${r1(T) === 1 ? "year" : "years"}`, `halbiert nach ${n(r1(T))} ${r1(T) === 1 ? "Jahr" : "Jahren"}`)}
              </text>
            </g>
          )}
          {compare && <motion.path initial={false} animate={{ d: path(lin) }} transition={spring} fill="none" stroke="var(--ink-2)" strokeWidth={1.8} strokeDasharray="5 4" />}
          <motion.path initial={false} animate={{ d: path(val) }} transition={spring} fill="none" stroke="var(--blob)" strokeWidth={2.6} strokeLinecap="round" />
          {Array.from({ length: LAB_YEARS + 1 }, (_, x) => (
            <motion.circle key={x} initial={false} animate={{ cx: X(x), cy: Y(val(x)) }} transition={spring} r={3.2} fill="var(--blob)" stroke="var(--surface)" strokeWidth={1.2} />
          ))}
        </svg>
      </div>

      <div className="space-y-3">
        <div className="overflow-x-auto">
          <MathView src={`N(t)#N =#e 100#a \\cdot#m ${n(q)}#q^t#tt`} size="md" scope={`${scope}-f`} highlight={["q"]} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] border-collapse text-center font-math text-[14px] tabular-nums">
            <tbody>
              <tr className="text-ink-3">
                <th className="py-1 pr-2 text-left font-normal italic">t</th>
                {[0, 1, 2, 3, 4, 5].map((x) => (
                  <td key={x} className="py-1">
                    {x}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="py-1 pr-2 text-left font-normal text-blob-ink">{t("exp.", "exp.")}</th>
                {[0, 1, 2, 3, 4, 5].map((x) => (
                  <td key={x} className="border-t border-line py-1">
                    {n(r1(val(x)))}
                  </td>
                ))}
              </tr>
              {compare && (
                <tr className="text-ink-2">
                  <th className="py-1 pr-2 text-left font-normal">{t("lin.", "lin.")}</th>
                  {[0, 1, 2, 3, 4, 5].map((x) => (
                    <td key={x} className="border-t border-line py-1">
                      {n(r1(lin(x)))}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">{readout}</strong>
          {compare &&
            (p > 0
              ? t(
                  ` Dashed: linear growth with the same first step, exactly ${n(p)} more every year. The exponential curve always multiplies by q.`,
                  ` Gestrichelt: lineares Wachstum mit demselben ersten Schritt, jedes Jahr genau ${n(p)} mehr. Die Exponentialkurve multipliziert immer mit q.`,
                )
              : p < 0
                ? t(
                    ` Dashed: linear decay with the same first step, exactly ${n(-p)} less every year, down to 0. The exponential curve always multiplies by q.`,
                    ` Gestrichelt: lineare Abnahme mit demselben ersten Schritt, jedes Jahr genau ${n(-p)} weniger, bis 0. Die Exponentialkurve multipliziert immer mit q.`,
                  )
                : t(" Dashed: the linear model. With q = 1 both stay at 100.", " Gestrichelt: das lineare Modell. Mit q = 1 bleiben beide bei 100."))}
        </p>
      </div>
      </div>
      <p className="text-[13px] text-ink-3">
        {t("Move the slider or pick a value. The start value is 100.", "Beweg den Schieberegler oder wähl einen Wert. Der Startwert ist 100.")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: radioactive decay with dice. Every six is taken out.

const DICE = 300;
const DICE_COLS = 20;
const MAX_THROWS = 20;
const DICE_Q = 5 / 6;
const DICE_HALF = Math.log(0.5) / Math.log(DICE_Q);

function DiceDecay() {
  const { t, n } = useFmt();
  const [gone, setGone] = useState<number[]>(() => Array.from({ length: DICE }, () => 0));
  const [history, setHistory] = useState<number[]>([DICE]);
  const throws = history.length - 1;
  const left = history[throws];
  const theory = DICE * pow(DICE_Q, throws);
  const halfAt = history.findIndex((v) => v <= DICE / 2);

  const roll = (times: number) => {
    let g = gone;
    const h = [...history];
    for (let k = 0; k < times && h.length - 1 < MAX_THROWS; k++) {
      const round = h.length;
      g = g.map((v) => (v === 0 && Math.random() < 1 / 6 ? round : v));
      h.push(g.filter((v) => v === 0).length);
    }
    setGone(g);
    setHistory(h);
  };
  const reset = () => {
    setGone(Array.from({ length: DICE }, () => 0));
    setHistory([DICE]);
  };

  const W = 360;
  const H = 170;
  const L = 34;
  const R = 10;
  const TOP = 10;
  const B = 26;
  const slot = (W - L - R) / MAX_THROWS;
  const X = (i: number) => fix(L + i * slot);
  const Y = (v: number) => fix(H - B - (v / DICE) * (H - TOP - B));
  const theoryPath = Array.from({ length: MAX_THROWS * 4 + 1 }, (_, i) => `${i ? "L" : "M"}${X(i / 4)},${Y(DICE * pow(DICE_Q, i / 4))}`).join(" ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => roll(1)}
          disabled={throws >= MAX_THROWS}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-blob px-3.5 text-[13.5px] font-semibold text-white hover:bg-blob-deep disabled:opacity-40"
        >
          <Dices className="size-4" /> {t("Throw all dice", "Alle Würfel werfen")}
        </button>
        <button
          type="button"
          onClick={() => roll(5)}
          disabled={throws >= MAX_THROWS}
          className="h-9 rounded-lg border border-line px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        >
          {t("5 throws", "5 Würfe")}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={throws === 0}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" /> {t("Start again", "Neu starten")}
        </button>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-surface p-3">
          <div
            className="mx-auto grid max-w-[280px] gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${DICE_COLS}, minmax(0, 1fr))` }}
            role="img"
            aria-label={t(`${left} of ${DICE} dice left`, `${left} von ${DICE} Würfeln übrig`)}
          >
            {gone.map((g, i) => (
              <motion.span
                key={i}
                className={cn("aspect-square rounded-[3px]", g === 0 ? "bg-blob" : g === throws ? "bg-danger" : "bg-ink-3")}
                initial={false}
                animate={g === 0 ? { scale: 1, opacity: 1 } : g === throws ? { scale: 0.8, opacity: 0.9 } : { scale: 0.45, opacity: 0.2 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[12.5px] text-ink-2">
            <span>
              {t("Throw", "Wurf")} {throws}
            </span>
            <span className="font-semibold text-ink tabular-nums">
              {left} {t("left", "übrig")}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t("Dice left after each throw", "Übrige Würfel nach jedem Wurf")}>
            {[0, DICE / 2, DICE].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} strokeDasharray={v === DICE / 2 ? "4 3" : undefined} />
                <text x={L - 5} y={Y(v) + 3.5} textAnchor="end" {...SVG_TEXT}>
                  {v}
                </text>
              </g>
            ))}
            {[0, 5, 10, 15, 20].map((i) => (
              <text key={i} x={X(i)} y={H - B + 14} textAnchor="middle" {...SVG_TEXT}>
                {i}
              </text>
            ))}
            <text x={W - R} y={H - 2} textAnchor="end" {...SVG_TEXT} fontStyle="italic">
              {t("throws", "Würfe")}
            </text>
            {history.map((v, i) => (
              <motion.rect
                key={i}
                x={fix(X(i) - slot * 0.32)}
                width={fix(slot * 0.64)}
                initial={{ y: Y(0), height: 0 }}
                animate={{ y: Y(v), height: fix(Y(0) - Y(v)) }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                rx={1.5}
                fill={i === halfAt ? "var(--danger)" : "var(--blob)"}
                opacity={i === throws ? 1 : 0.75}
              />
            ))}
            <path d={theoryPath} fill="none" stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="4 3" />
            <line x1={X(DICE_HALF)} x2={X(DICE_HALF)} y1={Y(DICE / 2)} y2={Y(0)} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="2 3" />
          </svg>
          <MathView src="N(n) = 300 \cdot (\frac{5}{6})^n" size="sm" />
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {throws === 0
              ? t(
                  "Each throw, every die showing a six is taken out. That's about 1/6 of the dice still there, so 5/6 stay: q = 5/6.",
                  "Bei jedem Wurf fliegt jeder Würfel mit einer Sechs raus. Das ist etwa 1/6 der übrigen Würfel, 5/6 bleiben: q = 5/6.",
                )
              : t(
                  `After ${throws} ${throws === 1 ? "throw" : "throws"}: ${left} dice left. The formula expects about ${Math.round(theory)}.`,
                  `Nach ${throws} ${throws === 1 ? "Wurf" : "Würfen"}: ${left} Würfel übrig. Die Formel erwartet etwa ${Math.round(theory)}.`,
                )}{" "}
            <strong className="font-semibold text-ink">
              {halfAt > 0
                ? t(`Half were gone after ${halfAt} throws; the half-life is about ${n(r1(DICE_HALF))} throws.`, `Die Hälfte war nach ${halfAt} Würfen weg; die Halbwertszeit liegt bei etwa ${n(r1(DICE_HALF))} Würfen.`)
                : t(`Half-life: about ${n(r1(DICE_HALF))} throws.`, `Halbwertszeit: etwa ${n(r1(DICE_HALF))} Würfe.`)}
            </strong>
          </p>
        </div>
      </div>
      <p className="text-[13px] text-ink-3">
        {t(
          "Purple: dice still in the game. Red: just thrown out. The dashed curve is the formula, the red bar marks when half were gone.",
          "Lila: Würfel noch im Spiel. Rot: gerade rausgeflogen. Die gestrichelte Kurve ist die Formel, der rote Balken zeigt, wann die Hälfte weg war.",
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picture: two tables, one linear, one exponential

function TwoTables({ start, d, q, steps = 4 }: { start: number; d: number; q: number; steps?: number }) {
  const { t, n } = useFmt();
  const lin = Array.from({ length: steps }, (_, x) => start + d * x);
  const exp = Array.from({ length: steps }, (_, x) => r6(start * q ** x));
  const card = (key: string, title: string, sub: string, ys: number[], chip: string, delay: number) => (
    <div key={key} className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      <div className="mb-2 text-[12.5px] text-ink-3">{sub}</div>
      <div className="grid grid-cols-[22px_minmax(0,1fr)_52px] items-center gap-x-2 font-math text-[16px] tabular-nums">
        <span className="pb-1 italic text-ink-3">x</span>
        <span className="pb-1 italic text-ink-3">y</span>
        <span />
        {ys.map((y, i) => (
          <div key={i} className="contents">
            <span className="border-t border-line py-1.5 text-ink-2">{i}</span>
            <motion.span className="border-t border-line py-1.5" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + i * 0.12 }}>
              {n(y)}
            </motion.span>
            <span className="relative h-full border-t border-line">
              {i < ys.length - 1 && (
                <motion.span
                  className="absolute left-0 top-full z-10 -translate-y-1/2 whitespace-nowrap rounded-md bg-blob-soft px-1.5 py-0.5 text-[12.5px] font-semibold text-blob-ink"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: delay + 0.5 + i * 0.12, type: "spring", stiffness: 400, damping: 24 }}
                >
                  {chip}
                </motion.span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="mx-auto grid max-w-[560px] grid-cols-2 gap-3">
      {card("a", t("Table A: linear", "Tabelle A: linear"), t("same difference each step", "jeder Schritt gleiche Differenz"), lin, `+ ${n(d)}`, 0.1)}
      {card("b", t("Table B: exponential", "Tabelle B: exponentiell"), t("same factor each step", "jeder Schritt gleicher Faktor"), exp, `· ${n(q)}`, 0.4)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson boards

const compoundLessonFrames: Frame[] = [
  {
    math: 'K_0#Kn =#e 5000#v "€"#u',
    note: tx(
      "Start capital $K_0 = 5000$ € at $3 %$ interest per year. The interest stays in the account.",
      "Startkapital $K_0 = 5000$\u00a0€ zu $3 %$ Zinsen pro Jahr. Die Zinsen bleiben auf dem Konto.",
    ),
  },
  {
    math: say((f) => `K_1#Kn =#e 5000#v \\cdot#t1 ${f.n(1.03)}#q1 =#e2 ${f.c(5000 * 1.03)}#r "€"#u2`),
    note: say((f) => f.t(`After 1 year: $5000 \\cdot 1.03 = ${f.c(5150)}$ €.`, `Nach 1 Jahr: $5000 \\cdot 1,03 = ${f.c(5150)}$\u00a0€.`)),
    highlight: ["r"],
  },
  {
    math: say((f) => `K_2#Kn =#e 5000#v \\cdot#t1 ${f.n(1.03)}#q1 \\cdot#t2 ${f.n(1.03)}#q2 =#e2 ${f.c(5000 * 1.03 ** 2)}#r "€"#u2`),
    note: say((f) =>
      f.t(
        `After 2 years: $${f.c(5000 * 1.03 ** 2)}$ €. The $150$ € interest from year 1 earn interest too: that's **compound interest** (Zinseszins).`,
        `Nach 2 Jahren: $${f.c(5000 * 1.03 ** 2)}$\u00a0€. Die $150$\u00a0€ Zinsen aus Jahr 1 werden mitverzinst: Das ist der **Zinseszins**.`,
      ),
    ),
    highlight: ["r"],
  },
  {
    math: say((f) => `K_3#Kn =#e 5000#v \\cdot#t1 ${f.n(1.03)}#q1 \\cdot#t2 ${f.n(1.03)}#q2 \\cdot#t3 ${f.n(1.03)}#q3 \\approx#e2 ${f.c(5000 * 1.03 ** 3)}#r "€"#u2`),
    note: tx("After 3 years: the factor $1.03$ three times.", "Nach 3 Jahren: dreimal der Faktor $1,03$."),
    highlight: ["q1", "q2", "q3"],
  },
  {
    math: "K_n#Kn =#e K_0#v \\cdot#t1 q#q1^n#x",
    note: tx(
      "In general, the **compound interest formula**: $K_n = K_0 \\cdot q^n$ with $q = 1 + \\frac{p}{100}$.",
      "Allgemein die **Zinseszinsformel**: $K_n = K_0 \\cdot q^n$ mit $q = 1 + \\frac{p}{100}$.",
    ),
  },
  {
    math: say((f) => `K_{10}#Kn =#e 5000#v \\cdot#t1 ${f.n(1.03)}#q1^{10}#x \\approx#e2 ${f.c(5000 * 1.03 ** 10)}#r "€"#u2`),
    note: say((f) =>
      f.t(
        `After 10 years (calculator): $${f.c(5000 * 1.03 ** 10)}$ €. With the same $150$ € every year, it would only be $6500$ €.`,
        `Nach 10 Jahren (Taschenrechner): $${f.c(5000 * 1.03 ** 10)}$\u00a0€. Mit jedes Jahr gleich $150$\u00a0€ wären es nur $6500$\u00a0€.`,
      ),
    ),
    highlight: ["r"],
  },
  {
    math: say((f) => `K_0#Kn =#e 10000#v :#t1 ${f.n(1.03)}#q1^5#x \\approx#e2 ${f.c(10000 / 1.03 ** 5)}#r "€"#u2`),
    note: say((f) =>
      f.t(
        `Backwards: to have $10000$ € after 5 years, invest $10000 : 1.03^5 \\approx ${f.c(10000 / 1.03 ** 5)}$ € today.`,
        `Rückwärts: Um nach 5 Jahren $10000$\u00a0€ zu haben, legst du heute $10000 : 1,03^5 \\approx ${f.c(10000 / 1.03 ** 5)}$\u00a0€ an.`,
      ),
    ),
    highlight: ["r"],
  },
];

const factorLessonFrames: Frame[] = [
  {
    math: "q#q =#e 1#o +#pl \\frac{p#p}{100#h}#f",
    note: tx("Growth by $p %$ per step: the growth factor is $q = 1 + \\frac{p}{100}$.", "Wachstum um $p %$ pro Schritt: Der Wachstumsfaktor ist $q = 1 + \\frac{p}{100}$."),
  },
  {
    math: tx("+#s 8#p %#pc \\Rightarrow#to q#q =#e 1.08#v", "+#s 8#p %#pc \\Rightarrow#to q#q =#e 1,08#v"),
    note: tx("$+8 %$ per year: $q = 1.08$.", "$+8 %$ pro Jahr: $q = 1,08$."),
    highlight: ["v"],
  },
  {
    math: tx("-#s 15#p %#pc \\Rightarrow#to q#q =#e 0.85#v", "-#s 15#p %#pc \\Rightarrow#to q#q =#e 0,85#v"),
    note: tx(
      "Decay by $15 %$: $q = 1 - 0.15 = 0.85$. **Not** $0.15$: that's what disappears, not what stays.",
      "Abnahme um $15 %$: $q = 1 - 0,15 = 0,85$. **Nicht** $0,15$: Das ist der Teil, der verschwindet, nicht der, der bleibt.",
    ),
    highlight: ["v"],
  },
  {
    math: tx("q#q =#e 0.7#v \\Rightarrow#to -#s 30#p %#pc", "q#q =#e 0,7#v \\Rightarrow#to -#s 30#p %#pc"),
    note: tx(
      "Backwards: $q = 0.7$ means $70 %$ stay, so $-30 %$. And $q = 2$ means $+100 %$: doubling every step.",
      "Rückwärts: $q = 0,7$ heißt, $70 %$ bleiben, also $-30 %$. Und $q = 2$ heißt $+100 %$: Verdopplung in jedem Schritt.",
    ),
  },
  {
    math: "N(t)#N =#e 50#a \\cdot#m 2#q^t#x",
    note: tx(
      "Bacteria: $50$ at the start, doubling every hour. After $5$ hours: $50 \\cdot 2^5 = 1600$.",
      "Bakterien: $50$ am Anfang, Verdopplung jede Stunde. Nach $5$ Stunden: $50 \\cdot 2^5 = 1600$.",
    ),
  },
  {
    math: tx('N(t)#N =#e 400#a "mg"#u \\cdot#m 0.8#q^t#x', 'N(t)#N =#e 400#a "mg"#u \\cdot#m 0,8#q^t#x'),
    note: tx(
      "Medicine: $400$ mg, $20 %$ broken down per hour, so $q = 0.8$. After $3$ hours: $400 \\cdot 0.8^3 = 204.8$ mg.",
      "Medikament: $400$ mg, pro Stunde werden $20 %$ abgebaut, also $q = 0,8$. Nach $3$ Stunden: $400 \\cdot 0,8^3 = 204,8$ mg.",
    ),
  },
  {
    math: tx("q^2#x =#e \\frac{11025}{10000}#fr =#e2 1.1025#v", "q^2#x =#e \\frac{11025}{10000}#fr =#e2 1,1025#v"),
    note: tx(
      "From two values: $10000$ € grew to $11025$ € in $2$ years. So $10000 \\cdot q^2 = 11025$.",
      "Aus zwei Werten: $10000$\u00a0€ sind in $2$ Jahren auf $11025$\u00a0€ gewachsen. Also gilt $10000 \\cdot q^2 = 11025$.",
    ),
  },
  {
    math: tx("q#x =#e \\sqrt{1.1025}#fr =#e2 1.05#v", "q#x =#e \\sqrt{1,1025}#fr =#e2 1,05#v"),
    note: tx("Take the root: $q = 1.05$, that's $5 %$ per year.", "Wurzel ziehen: $q = 1,05$, das sind $5 %$ pro Jahr."),
    highlight: ["v"],
  },
];

const halfLifeFrames: Frame[] = [
  {
    math: tx("1.05#q^t#l =#e 2#r", "1,05#q^t#l =#e 2#r"),
    note: tx(
      "Money at $5 %$: when has it doubled? $K_0 \\cdot 1.05^t = 2 \\cdot K_0$, so $1.05^t = 2$. The start value doesn't matter.",
      "Geld zu $5 %$: Wann hat es sich verdoppelt? $K_0 \\cdot 1,05^t = 2 \\cdot K_0$, also $1,05^t = 2$. Der Startwert spielt keine Rolle.",
    ),
  },
  {
    math: say((f) => `${f.n(1.05)}^{14}#a \\approx#e ${f.n(1.98)}#b ,\\quad ${f.n(1.05)}^{15}#c \\approx#e2 ${f.n(2.08)}#d`),
    note: tx("By trial: after 14 years not quite, after 15 years more than double.", "Durch Probieren: Nach 14 Jahren noch nicht ganz, nach 15 Jahren mehr als das Doppelte."),
  },
  {
    math: tx("t#l =#e \\log_{1.05}#g (2)#r", "t#l =#e \\log_{1,05}#g (2)#r"),
    note: tx(
      "Exactly: the **logarithm** $\\log_{1.05}(2)$ is the exponent that turns $1.05$ into $2$.",
      "Genau: Der **Logarithmus** $\\log_{1,05}(2)$ ist der Exponent, der aus $1,05$ eine $2$ macht.",
    ),
  },
  {
    math: tx("t#l =#e \\frac{\\log(2)}{\\log(1.05)}#g \\approx#e2 14.2#v", "t#l =#e \\frac{\\log(2)}{\\log(1,05)}#g \\approx#e2 14,2#v"),
    note: tx(
      "On the calculator ($\\log$ or $\\ln$, both work): $t \\approx 14.2$ years. That's the **doubling time**.",
      "Mit dem Taschenrechner ($\\log$ oder $\\ln$, beides geht): $t \\approx 14,2$ Jahre. Das ist die **Verdopplungszeit**.",
    ),
    highlight: ["v"],
  },
  {
    math: tx("t#l =#e \\frac{\\log(0.5)}{\\log(0.8)}#g \\approx#e2 3.1#v", "t#l =#e \\frac{\\log(0,5)}{\\log(0,8)}#g \\approx#e2 3,1#v"),
    note: tx(
      "Medicine with $q = 0.8$: when is only half left? $0.8^t = 0.5$ gives $t \\approx 3.1$ hours, the **half-life**.",
      "Medikament mit $q = 0,8$: Wann ist nur noch die Hälfte da? $0,8^t = 0,5$ ergibt $t \\approx 3,1$ Stunden, die **Halbwertszeit**.",
    ),
    highlight: ["v"],
  },
  {
    math: "N(t)#N =#e N_0#a \\cdot#m (\\frac{1}{2})#q^{\\frac{t}{T}}#x",
    note: tx(
      "Radioactive substances come with their half-life $T$: after every $T$, half of what's there is left.",
      "Radioaktive Stoffe werden über ihre Halbwertszeit $T$ beschrieben: Nach jeder Zeit $T$ ist noch die Hälfte übrig.",
    ),
  },
  {
    math: '80#a "mg"#u \\to#t1 40#b \\to#t2 20#c \\to#t3 10#d "mg"#u2',
    note: tx(
      "Iodine-131 has $T = 8$ days. After $24$ days, that's $3$ half-lives: $80 \\cdot (\\frac{1}{2})^3 = 10$ mg.",
      "Iod-131 hat $T = 8$ Tage. Nach $24$ Tagen sind das $3$ Halbwertszeiten: $80 \\cdot (\\frac{1}{2})^3 = 10$ mg.",
    ),
    highlight: ["d"],
  },
];

const linExpFrames: Frame[] = [
  {
    math: "300#a -#m 200#b =#e 100#d ,\\quad 400#c -#m2 300#a2 =#e2 100#d2",
    note: tx("Table A: the **differences** of neighbouring values are always $100$.", "Tabelle A: Die **Differenzen** benachbarter Werte sind immer $100$."),
    highlight: ["d", "d2"],
  },
  {
    math: "f(x)#f =#e 100#d x#x +#p 200#b",
    note: tx(
      "Constant difference: **linear** growth, $f(x) = m \\cdot x + b$ with step $m = 100$ and start value $b = 200$.",
      "Konstante Differenz: **lineares** Wachstum, $f(x) = m \\cdot x + b$ mit $m = 100$ und Startwert $b = 200$.",
    ),
  },
  {
    math: tx("\\frac{300}{200}#q1 =#e 1.5#d ,\\quad \\frac{450}{300}#q2 =#e2 1.5#d2", "\\frac{300}{200}#q1 =#e 1,5#d ,\\quad \\frac{450}{300}#q2 =#e2 1,5#d2"),
    note: tx("Table B: the **quotients** of neighbouring values are always $1.5$.", "Tabelle B: Die **Quotienten** benachbarter Werte sind immer $1,5$."),
    highlight: ["d", "d2"],
  },
  {
    math: tx("g(x)#f =#e 200#b \\cdot#m 1.5#d^x#x", "g(x)#f =#e 200#b \\cdot#m 1,5#d^x#x"),
    note: tx(
      "Constant factor: **exponential** growth, $g(x) = a \\cdot q^x$ with start value $a = 200$ and factor $q = 1.5$.",
      "Konstanter Faktor: **exponentielles** Wachstum, $g(x) = a \\cdot q^x$ mit Startwert $a = 200$ und Faktor $q = 1,5$.",
    ),
  },
  {
    math: `g(10)#f \\approx#e ${Math.round(200 * 1.5 ** 10)}#v \\quad >#gt \\quad f(10)#f2 =#e2 1200#w`,
    note: tx(
      "Both start the same, but in the long run exponential growth wins by far.",
      "Beide starten gleich, aber auf lange Sicht gewinnt das exponentielle Wachstum mit riesigem Abstand.",
    ),
    highlight: ["v"],
  },
];

// ---------------------------------------------------------------------------

const MEDICINE = FACTOR_STORIES[2];
const COUNTRY = TIME_STORIES[1];

const tableCheck = (): Exercise => {
  const xs = [0, 1, 2, 3];
  const ys = [80, 120, 180, 270];
  const options: Text[] = [
    tx("$f(x) = 40x + 80$", "$f(x) = 40x + 80$"),
    tx("$f(x) = 80 \\cdot 1.5^x$", "$f(x) = 80 \\cdot 1,5^x$"),
    tx("$f(x) = 1.5 \\cdot 80^x$", "$f(x) = 1,5 \\cdot 80^x$"),
    tx("neither linear nor exponential", "weder linear noch exponentiell"),
  ];
  const pick = (i: number, title: Text, said: Text): Mistake => ({ when: { kind: "choice", options, correct: i }, title, say: said });
  return {
    instruction: tx("Linear or exponential?", "Linear oder exponentiell?"),
    text: tx("Which function fits the table of values?", "Welche Funktion passt zur Wertetabelle?"),
    visual: { component: ValueTable as unknown as ComponentType<Record<string, unknown>>, props: { xs, ys } },
    answer: { kind: "choice", options, correct: 1 },
    hint: tx("Work out the differences, then the quotients of neighbouring values.", "Bestimme die Differenzen, dann die Quotienten benachbarter Werte."),
    solution: [
      { math: "\\Delta#D :#c 40 ,\\quad 60 ,\\quad 90", note: tx("Differences: $40$, $60$, $90$. Not constant: not linear.", "Differenzen: $40$, $60$, $90$. Nicht konstant: nicht linear.") },
      { math: tx("q#D :#c 1.5 ,\\quad 1.5 ,\\quad 1.5", "q#D :#c 1,5 ,\\quad 1,5 ,\\quad 1,5"), note: tx("Quotients: always $1.5$. Exponential!", "Quotienten: immer $1,5$. Exponentiell!") },
      { math: tx("f(x) = 80 \\cdot 1.5^x", "f(x) = 80 \\cdot 1,5^x"), note: tx("Start value $a = f(0) = 80$, factor $q = 1.5$.", "Startwert $a = f(0) = 80$, Faktor $q = 1,5$.") },
    ],
    mistakes: [
      pick(
        0,
        tx("Only the first step", "Nur der erste Schritt"),
        tx("Only the first difference is $40$: then it's $60$ and $90$. Look at the quotients instead.", "Nur die erste Differenz ist $40$: Danach kommen $60$ und $90$. Schau dir stattdessen die Quotienten an."),
      ),
      pick(2, tx("a and q swapped", "a und q vertauscht"), tx("Swapped! $a$ is the start value $f(0)$, and $q$ is the base of the power.", "Vertauscht! $a$ ist der Startwert $f(0)$, und $q$ ist die Basis der Potenz.")),
      pick(3, tx("Look at the quotients", "Schau auf die Quotienten"), tx("Hmm, divide each value by the one before: the quotient is always the same.", "Hm, teil jeden Wert durch den davor: Der Quotient ist immer gleich.")),
    ],
  };
};

export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Compound interest", "Zinseszins"),
      body: tx("The interest earns interest too: multiply by $q$ once per year.", "Die Zinsen werden mitverzinst: pro Jahr einmal mit $q$ multiplizieren."),
      examples: ["K_n = K_0 \\cdot q^n", "q = 1 + \\frac{p}{100}", "K_0 = K_n : q^n"],
      tone: "rule",
    },
    {
      title: tx("Exponential growth and decay", "Exponentielles Wachstum und exponentielle Abnahme"),
      body: tx(
        "Same percentage in every step: $N(t) = N_0 \\cdot q^t$. $q > 1$ growth, $0 < q < 1$ decay.",
        "In jedem Schritt derselbe Prozentsatz: $N(t) = N_0 \\cdot q^t$. $q > 1$ Wachstum, $0 < q < 1$ Abnahme.",
      ),
      examples: [tx("+8 % \\Rightarrow q = 1.08", "+8 % \\Rightarrow q = 1,08"), tx("-15 % \\Rightarrow q = 0.85", "-15 % \\Rightarrow q = 0,85")],
      tone: "rule",
    },
    {
      title: tx("Doubling time and half-life", "Verdopplungszeit und Halbwertszeit"),
      body: tx("Solve $q^T = 2$ (or $q^T = 0.5$) with a logarithm, or try whole steps.", "Löse $q^T = 2$ (oder $q^T = 0,5$) mit einem Logarithmus oder probier ganze Schritte aus."),
      examples: [
        tx('"doubling:" \\; T = \\frac{\\log(2)}{\\log(q)}', '"Verdopplung:" \\; T = \\frac{\\log(2)}{\\log(q)}'),
        tx('"half-life:" \\; T = \\frac{\\log(0.5)}{\\log(q)}', '"Halbierung:" \\; T = \\frac{\\log(0,5)}{\\log(q)}'),
        "N(t) = N_0 \\cdot (\\frac{1}{2})^{\\frac{t}{T}}",
      ],
      tone: "rule",
    },
    {
      title: tx("Linear or exponential?", "Linear oder exponentiell?"),
      body: tx("Constant differences in a table: linear. Constant quotients: exponential.", "Konstante Differenzen in der Tabelle: linear. Konstante Quotienten: exponentiell."),
      examples: ["f(x) = m \\cdot x + b", "f(x) = a \\cdot q^x"],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx(
        "$3 %$ for $10$ years is **more** than $30 %$. A decay of $15 %$ is $q = 0.85$, not $0.15$. And $5 %$ is $q = 1.05$, not $1.5$.",
        "$3 %$ über $10$ Jahre sind **mehr** als $30 %$. Eine Abnahme um $15 %$ ist $q = 0,85$, nicht $0,15$. Und $5 %$ sind $q = 1,05$, nicht $1,5$.",
      ),
      examples: [tx("1.03^{10} \\approx 1.34 \\ne 1.30", "1,03^{10} \\approx 1,34 \\ne 1,30")],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Compound interest", "Zinseszins"),
      blob: tx("Leave the interest in the bank and watch it work for you!", "Lass die Zinsen auf der Bank und schau zu, wie sie für dich arbeiten!"),
      body: tx(
        "If the interest stays in the account, it earns interest the next year too. So every year the balance is multiplied by the same **growth factor** $q$.",
        "Bleiben die Zinsen auf dem Konto, werden sie im nächsten Jahr mitverzinst. Jedes Jahr wird der Kontostand also mit demselben **Wachstumsfaktor** $q$ multipliziert.",
      ),
      frames: compoundLessonFrames,
    },
    {
      type: "widget",
      title: tx("The growth lab", "Das Wachstumslabor"),
      blob: tx("Slide to a percentage and watch the curve take off, or melt away.", "Schieb auf einen Prozentsatz und schau, wie die Kurve abhebt oder dahinschmilzt."),
      body: tx(
        "The same percentage every year makes a curve that bends: **exponential** growth or decay. Compare it with linear growth, and watch the doubling time or half-life.",
        "Jedes Jahr derselbe Prozentsatz ergibt eine Kurve, die sich krümmt: **exponentielles** Wachstum oder exponentielle Abnahme. Vergleich sie mit linearem Wachstum und achte auf Verdopplungszeit und Halbwertszeit.",
      ),
      widget: GrowthLab,
    },
    {
      type: "check",
      blob: tx("Power, not times. Calculator ready?", "Hoch, nicht mal. Taschenrechner bereit?"),
      exercise: compoundExercise(2000, 2.5, 6, "Lina", "balance"),
    },
    {
      type: "explain",
      title: tx("Growth factor and percentage", "Wachstumsfaktor und Prozentsatz"),
      blob: tx("One number tells you everything: the growth factor q.", "Eine Zahl verrät alles: der Wachstumsfaktor q."),
      body: tx(
        "When a quantity changes by the same percentage in every time step, $N(t) = N_0 \\cdot q^t$. From the percentage you get $q$, and from $q$ the percentage.",
        "Ändert sich eine Größe in jedem Zeitschritt um denselben Prozentsatz, gilt $N(t) = N_0 \\cdot q^t$. Aus dem Prozentsatz bekommst du $q$, und aus $q$ den Prozentsatz.",
      ),
      frames: factorLessonFrames,
    },
    {
      type: "check",
      blob: tx("What stays, not what goes!", "Was bleibt, nicht was geht!"),
      exercise: factorExercise(MEDICINE, 12),
    },
    {
      type: "explain",
      title: tx("Doubling time and half-life", "Verdopplungszeit und Halbwertszeit"),
      blob: tx("How long until it's twice as much, or half? Logarithms know.", "Wie lange, bis es doppelt so viel ist oder nur noch die Hälfte? Der Logarithmus weiß es."),
      body: tx(
        "The **doubling time** is how long a growing quantity takes to double, the **half-life** how long a shrinking one takes to halve. For exponential change, they're the same from any starting point.",
        "Die **Verdopplungszeit** ist die Zeit, in der sich eine wachsende Größe verdoppelt, die **Halbwertszeit** die Zeit, in der sich eine abnehmende halbiert. Bei exponentieller Änderung sind sie von jedem Startpunkt aus gleich.",
      ),
      frames: halfLifeFrames,
    },
    {
      type: "widget",
      title: tx("Decay with dice", "Zerfall mit Würfeln"),
      blob: tx("300 dice, every six is out. Will half be gone after 3 or 4 throws?", "300 Würfel, jede Sechs fliegt raus. Ist nach 3 oder 4 Würfen die Hälfte weg?"),
      body: tx(
        "A classic experiment for radioactive decay: every die is an atom, and each throw about $\\frac{1}{6}$ of the dice left decay. Throw and compare your bars with the formula.",
        "Ein klassisches Experiment zum radioaktiven Zerfall: Jeder Würfel ist ein Atom, und bei jedem Wurf zerfällt etwa $\\frac{1}{6}$ der übrigen Würfel. Würfle und vergleich deine Balken mit der Formel.",
      ),
      widget: DiceDecay,
    },
    {
      type: "check",
      blob: tx("Doubling time: log of 2 over log of q.", "Verdopplungszeit: log von 2 durch log von q."),
      exercise: timeExercise(COUNTRY, 2),
    },
    {
      type: "explain",
      title: tx("Linear or exponential?", "Linear oder exponentiell?"),
      blob: tx("Two tables, the same start. Spot the difference!", "Zwei Tabellen, gleicher Start. Finde den Unterschied!"),
      body: tx(
        "In a table of values, compare neighbouring values: subtract them, and divide them. Whatever stays constant tells you the type of growth.",
        "Vergleich in einer Wertetabelle benachbarte Werte: Zieh sie voneinander ab und teile sie durcheinander. Was konstant bleibt, verrät die Art des Wachstums.",
      ),
      visual: { component: TwoTables as unknown as ComponentType<Record<string, unknown>>, props: { start: 200, d: 100, q: 1.5 } },
      frames: linExpFrames,
    },
    {
      type: "check",
      blob: tx("Differences or quotients: which ones stay the same?", "Differenzen oder Quotienten: Was bleibt gleich?"),
      exercise: tableCheck(),
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 3 practice: exam-style tasks, calculator allowed

const TASKS: [number, Gen][] = [
  [2, compoundInterestTask],
  [0.8, compoundTask],
  [1.3, startValueTask],
  [1.6, factorTask],
  [1.2, rateFromTwoTask],
  [2, timeTask],
  [1.2, trialTask],
  [1.6, halfLifeTask],
  [1.6, linExpTask],
  [1, pairTask],
];

export function generate3(rng: Rng): Exercise {
  return findTask(rng, TASKS, () => compoundExercise(2000, 2.5, 6, "Lina", "balance"));
}
