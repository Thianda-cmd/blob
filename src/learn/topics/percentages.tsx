"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, txMap, type Text } from "@/i18n/text";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import { gcd, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Numbers

const r2 = (v: number) => Math.round(v * 100) / 100;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** "0.15", "297.5", "1500" */
const num = (v: number) => String(r6(v));
/** Money: "60" or "297.50". */
const cash = (v: number) => (Number.isInteger(r2(v)) ? String(r2(v)) : r2(v).toFixed(2));

/** Units of the quantities in the tasks. Word units get a German name. */
type Unit = "" | "€" | "kg" | "m" | "L" | "g" | "km" | "students" | "members" | "pages" | "inhabitants";
const UNIT_DE: Partial<Record<Unit, string>> = { students: "Schüler", members: "Mitglieder", pages: "Seiten", inhabitants: "Einwohner" };
const unitName = (unit: Unit, l: Locale) => (l === "de" ? (UNIT_DE[unit] ?? unit) : unit);
const unitText = (unit: Unit): Text => {
  const de = UNIT_DE[unit];
  return de ? tx(unit, de) : unit;
};

/** Number formatting and wording for one language: decimal comma and German unit names in German. */
type Fmt = {
  /** Picks the English or the German wording. */
  t: (en: string, de: string) => string;
  l: Locale;
  /** A number: "0.15" / "0,15". */
  n: (v: number) => string;
  /** Money: "297.50" / "297,50". */
  c: (v: number) => string;
  /** An amount in a unit (money with cents). */
  a: (v: number, unit: Unit) => string;
  /** A quoted unit token for the display language: ` "kg"#u`. */
  ut: (unit: Unit, key: string) => string;
  /** The unit after a number in a sentence: ` kg`. */
  uw: (unit: Unit) => string;
  /** A number in a story sentence; German groups big numbers: "25 000". */
  big: (s: string) => string;
};

function fmt(t: Fmt["t"], l: Locale): Fmt {
  const comma = (s: string) => (l === "de" ? s.replace(".", ",") : s);
  return {
    t,
    l,
    n: (v) => comma(num(v)),
    c: (v) => comma(cash(v)),
    a: (v, unit) => comma(unit === "€" ? cash(v) : num(v)),
    ut: (unit, key) => (unit ? ` "${unitName(unit, l)}"#${key}` : ""),
    uw: (unit) => (unit ? `${l === "de" ? "\u00a0" : " "}${unitName(unit, l)}` : ""),
    big: (s) => (l === "de" && /^\d{5,}/.test(s) ? comma(s).replace(/^\d+/, (d) => d.replace(/\B(?=(\d{3})+$)/g, " ")) : comma(s)),
  };
}

/** Builds a text in both languages from one template function. */
const say = (build: (f: Fmt) => string): Text => txMap((t, l) => build(fmt(t, l)));

/** Money answers accept one cent either way; everything else must be exact. */
function amount(v: number, unit: Unit, label?: string): AnswerSpec {
  const value = unit === "€" ? r2(v) : r6(v);
  return {
    kind: "number",
    value,
    unit: unitText(unit),
    ...(label ? { label } : {}),
    ...(unit === "€" ? { tolerance: 0.0101 / Math.max(1, Math.abs(value)) } : {}),
  };
}
const rateAnswer = (p: number, label?: string): AnswerSpec => ({ kind: "number", value: r6(p), unit: "%", ...(label ? { label } : {}) });

// ---------------------------------------------------------------------------
// Worked solutions

const SHORTCUTS: Record<number, (G: string, W: string, t: Fmt["t"]) => string> = {
  50: (G, W, t) => t(`Shortcut: $50 %$ is half, so $${G} : 2 = ${W}$.`, `Rechentrick: $50 %$ ist die Hälfte, also $${G} : 2 = ${W}$.`),
  25: (G, W, t) => t(`Shortcut: $25 %$ is a quarter, so $${G} : 4 = ${W}$.`, `Rechentrick: $25 %$ ist ein Viertel, also $${G} : 4 = ${W}$.`),
  10: (G, W, t) => t(`Shortcut: $10 %$ is a tenth, so $${G} : 10 = ${W}$.`, `Rechentrick: $10 %$ ist ein Zehntel, also $${G} : 10 = ${W}$.`),
  20: (G, W, t) => t(`Shortcut: $20 %$ is a fifth, so $${G} : 5 = ${W}$.`, `Rechentrick: $20 %$ ist ein Fünftel, also $${G} : 5 = ${W}$.`),
  1: (G, W, t) => t(`Shortcut: $1 %$ is a hundredth, so $${G} : 100 = ${W}$.`, `Rechentrick: $1 %$ ist ein Hundertstel, also $${G} : 100 = ${W}$.`),
  75: (G, W, t) => t(`Shortcut: $75 %$ is three quarters, so $${G} : 4 \\cdot 3 = ${W}$.`, `Rechentrick: $75 %$ sind drei Viertel, also $${G} : 4 \\cdot 3 = ${W}$.`),
};

/** W = G · p/100 */
function findWFrames(p: number, G: number, unit: Unit): Frame[] {
  const q = p / 100;
  const W = G * q;
  return [
    {
      math: say(({ a, ut }) => `W#W =#e ${a(G, unit)}#G${ut(unit, "u")} \\cdot#m \\frac{${p}#p}{100#h}#f`),
      note: tx("Percentage = base value times rate: $W = G \\cdot \\frac{p}{100}$.", "Prozentwert = Grundwert mal Prozentsatz: $W = G \\cdot \\frac{p}{100}$."),
      highlight: ["G", "p"],
    },
    {
      math: say(({ a, n, ut }) => `W#W =#e ${a(G, unit)}#G${ut(unit, "u")} \\cdot#m ${n(q)}#q`),
      note: say(({ t, n }) => t(`Write the rate as a decimal: $${p} % = ${n(q)}$.`, `Schreib den Prozentsatz als Dezimalzahl: $${p} % = ${n(q)}$.`)),
      highlight: ["q"],
    },
    {
      math: say(({ a, ut }) => `W#W =#e ${a(W, unit)}#G${ut(unit, "u")}`),
      note: say(({ t, a, n, uw }) => {
        const shortcut = SHORTCUTS[p]?.(a(G, unit), a(W, unit), t);
        return `$${a(G, unit)} \\cdot ${n(q)} = ${a(W, unit)}$${uw(unit)}.${shortcut ? ` ${shortcut}` : ""}`;
      }),
    },
  ];
}

/** p % = W / G */
function findPFrames(W: number, G: number): Frame[] {
  const q = W / G;
  return [
    {
      math: "p#p %#pc =#e \\frac{W#Wv}{G#Gv}#f",
      note: tx("The rate is the part divided by the whole: $p % = \\frac{W}{G}$.", "Der Prozentsatz ist der Teil geteilt durch das Ganze: $p % = \\frac{W}{G}$."),
    },
    {
      math: say(({ n }) => `p#p %#pc =#e \\frac{${n(W)}#W}{${n(G)}#G}#f`),
      note: say(({ t, n }) =>
        t(`Here the part is $W = ${n(W)}$ and the whole is $G = ${n(G)}$.`, `Hier ist der Prozentwert $W = ${n(W)}$ und der Grundwert $G = ${n(G)}$.`),
      ),
      highlight: ["W", "G"],
    },
    { math: say(({ n }) => `p#p %#pc =#e ${n(q)}#q`), note: say(({ n }) => `$${n(W)} : ${n(G)} = ${n(q)}$.`) },
    {
      math: say(({ n }) => `p#p %#pc =#e ${n(q * 100)}#q %#pc2`),
      note: say(({ t, n }) =>
        t(
          `As a percentage: $${n(q)} = ${n(q * 100)} %$. Move the point two places to the right.`,
          `In Prozent: $${n(q)} = ${n(q * 100)} %$. Das Komma rückt zwei Stellen nach rechts.`,
        ),
      ),
      highlight: ["q"],
    },
  ];
}

/** G from W and p with the rule of three (Dreisatz). */
function findGFrames(p: number, W: number, unit: Unit): Frame[] {
  const one = W / p;
  const G = W * (100 / p);
  return [
    {
      math: say(({ a, ut }) => `${p}#a %#ap \\to#to ${a(W, unit)}#b${ut(unit, "u")}`),
      note: say(({ t, a, uw }) =>
        t(
          `Write down what you know: $${p} %$ of the whole are $${a(W, unit)}$${uw(unit)}.`,
          `Schreib auf, was du weißt: $${p} %$ des Ganzen sind $${a(W, unit)}$${uw(unit)}.`,
        ),
      ),
    },
    {
      math: say(({ a, ut }) => `1#a %#ap \\to#to ${a(one, unit)}#b${ut(unit, "u")} \\quad \\fade{:#s1 ${p}#s2}`),
      note: tx(`Rule of three (Dreisatz): divide both sides by $${p}$. That gives $1 %$.`, `Dreisatz: Teile beide Seiten durch $${p}$. So bekommst du $1 %$.`),
      highlight: ["a", "b"],
    },
    {
      math: say(({ a, ut }) => `100#a %#ap \\to#to ${a(G, unit)}#b${ut(unit, "u")} \\quad \\fade{\\cdot#s1 100#s2}`),
      note: say(({ t, a, uw }) =>
        t(
          `Multiply by $100$: $100 %$ is the base value, $G = ${a(G, unit)}$${uw(unit)}.`,
          `Multipliziere mit $100$: $100 %$ sind der Grundwert, $G = ${a(G, unit)}$${uw(unit)}.`,
        ),
      ),
      highlight: ["a", "b"],
    },
  ];
}

/** A change by p %: growth factor q, new value G · q. */
function changeFrames(G: number, p: number, up: boolean, unit: Unit): Frame[] {
  const q = 1 + (up ? p : -p) / 100;
  const N = G * q;
  const left = up ? 100 + p : 100 - p;
  return [
    {
      math: `100#a %#ap ${up ? "+" : "-"}#pm ${p}#b %#bp =#e ${left}#c %#cp`,
      note: up
        ? tx(
            `The old value is $100 %$. After the rise, the new value is $${left} %$ of it.`,
            `Der alte Wert ist $100 %$. Nach der Erhöhung ist der neue Wert $${left} %$ davon.`,
          )
        : tx(`The old value is $100 %$. After $${p} %$ off, $${left} %$ is left.`, `Der alte Wert ist $100 %$. Nach $${p} %$ Abzug bleiben $${left} %$ übrig.`),
    },
    {
      math: say(({ n }) => `q#q =#e ${left}#c %#cp =#e2 ${n(q)}#f`),
      note: say(({ t, n }) => t(`As a decimal, that's the growth factor $q = ${n(q)}$ (Wachstumsfaktor).`, `Als Dezimalzahl ist das der Wachstumsfaktor $q = ${n(q)}$.`)),
      highlight: ["f"],
    },
    {
      math: say(({ a, n, ut }) => `${a(G, unit)}#G${ut(unit, "u")} \\cdot#t ${n(q)}#f =#e3 ${a(N, unit)}#r${ut(unit, "u2")}`),
      note: say(({ t, a, n, uw }) =>
        t(
          `New value = old value $\\cdot\\, q$: $${a(G, unit)} \\cdot ${n(q)} = ${a(N, unit)}$${uw(unit)}.`,
          `Neuer Wert = alter Wert $\\cdot\\, q$: $${a(G, unit)} \\cdot ${n(q)} = ${a(N, unit)}$${uw(unit)}.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
}

/** Back to the original value: divide by the growth factor. */
function reverseFrames(N: number, p: number, up: boolean, unit: Unit): Frame[] {
  const q = 1 + (up ? p : -p) / 100;
  const G = N / q;
  return [
    {
      math: say(({ a, n, ut }) => `G#G \\cdot#t ${n(q)}#f =#e ${a(N, unit)}#W${ut(unit, "u")}`),
      note: say(({ t, a, n, uw }) =>
        up
          ? t(
              `A rise of $${p} %$ means: old value $G$ times $${n(q)}$ gives the new value $${a(N, unit)}$${uw(unit)}.`,
              `Eine Erhöhung um $${p} %$ heißt: Der alte Wert $G$ mal $${n(q)}$ ergibt den neuen Wert $${a(N, unit)}$${uw(unit)}.`,
            )
          : t(
              `$${p} %$ off means: old value $G$ times $${n(q)}$ gives the new value $${a(N, unit)}$${uw(unit)}.`,
              `$${p} %$ weniger heißt: Der alte Wert $G$ mal $${n(q)}$ ergibt den neuen Wert $${a(N, unit)}$${uw(unit)}.`,
            ),
      ),
      highlight: ["f"],
    },
    {
      math: say(({ a, n, ut }) => `G#G =#e ${a(N, unit)}#W${ut(unit, "u")} :#t2 ${n(q)}#f`),
      note: tx("Undo the multiplication: divide by the growth factor.", "Mach die Multiplikation rückgängig: Teile durch den Wachstumsfaktor."),
      highlight: ["t2", "f"],
    },
    {
      math: say(({ a, ut }) => `G#G =#e ${a(G, unit)}#W${ut(unit, "u")}`),
      note: say(({ t, a, n }) =>
        t(
          `$${a(N, unit)} : ${n(q)} = ${a(G, unit)}$. Check: $${a(G, unit)} \\cdot ${n(q)} = ${a(N, unit)}$.`,
          `$${a(N, unit)} : ${n(q)} = ${a(G, unit)}$. Probe: $${a(G, unit)} \\cdot ${n(q)} = ${a(N, unit)}$.`,
        ),
      ),
      highlight: ["W"],
    },
  ];
}

type Change = { up: boolean; p: number };
const factorOf = (c: Change) => 1 + (c.up ? c.p : -c.p) / 100;
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

// ---------------------------------------------------------------------------
// Exercise generator

type Gen = (rng: Rng) => Exercise | null;

function pickWeighted(rng: Rng, list: [number, Gen][]): Gen {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, g] of list) {
    r -= w;
    if (r < 0) return g;
  }
  return list[list.length - 1][1];
}

/** Smallest base value step that makes p % of it a whole number. */
const stepFor = (p: number) => 100 / gcd(p, 100);

const UNITS: Unit[] = ["€", "kg", "m", "L", "g", "km"];

const CALCULATE = tx("Calculate", "Berechne");
const WORD_PROBLEM = tx("Word problem", "Textaufgabe");
const AS_PERCENT = tx("Write as a percentage", "Schreib in Prozent");
const OF = (en: string) => tx(en, en.replace('"of"', '"von"'));

// ---------------------------------------------------------------------------
// Typical mistakes. Each one is simulated from the task's numbers, so the wrong
// value is exactly what a student with that misconception gets.

/** A misconception: the (unrounded) value it leads to, a title and what Blob says. */
type Slip = [value: number, title: Text, say: Text] | null | false;
type NumberSpec = Extract<AnswerSpec, { kind: "number" }>;

/** How far a typed number may be from `v`: cents for money, whole numbers when the answer is rounded, else rounding of long decimals. */
function slack(v: number, answer: NumberSpec): number {
  if (answer.unit === "€") return 0.0101;
  if ((answer.tolerance ?? 0) * Math.max(1, Math.abs(answer.value)) >= 1) return 1.01;
  return Math.abs(r2(v) - v) < 1e-9 ? 0 : Math.min(0.051, Math.abs(v) * 0.005);
}

/** The slips as Mistakes for a number answer: only those clearly apart from the right value and from each other. */
function mistakesFor(answer: AnswerSpec, slips: Slip[]): Mistake[] {
  if (answer.kind !== "number") return [];
  const taken: [number, number][] = [[answer.value, slack(answer.value, answer)]];
  const out: Mistake[] = [];
  for (const s of slips) {
    if (!s) continue;
    const [raw, title, say] = s;
    if (!Number.isFinite(raw) || raw < 0) continue;
    const value = answer.unit === "€" ? r2(raw) : slack(raw, answer) >= 1 ? Math.round(raw) : r6(raw);
    const tol = slack(value, answer);
    if (taken.some(([v, t]) => Math.abs(v - value) <= t + tol + 1e-9)) continue;
    taken.push([value, tol]);
    const when: NumberSpec = { kind: "number", value, ...(answer.unit ? { unit: answer.unit } : {}), ...(tol ? { tolerance: tol / Math.max(1, Math.abs(value)) } : {}) };
    out.push({ when, title, say });
  }
  return out;
}

/** An amount in a sentence: "$45$ €", "$300$ g", "$24$ Schüler". */
const amt = (f: Fmt, v: number, unit: Unit) => `$${f.a(v, unit)}$${f.uw(unit)}`;

const OTHER_PART = tx("The other part", "Der andere Teil");
const WRONG_WAY = tx("Point moved the wrong way", "Komma in die falsche Richtung");
const FACTOR_OFF = tx("Growth factor off", "Wachstumsfaktor falsch");
/** "1.5 instead of 1.05": a rate below 10 % written with one zero too few. */
const factorOff = (p: number, up: boolean) =>
  say(({ t, n }) =>
    t(
      `So close! For ${up ? "a rise" : "a drop"} of $${p} %$ the growth factor is $${n(1 + (up ? p : -p) / 100)}$, not $${n(1 + (up ? p : -p) / 10)}$: percent means **hundredths**.`,
      `Ganz knapp! Bei ${up ? "einer Zunahme" : "einer Abnahme"} um $${p} %$ ist der Wachstumsfaktor $${n(1 + (up ? p : -p) / 100)}$, nicht $${n(1 + (up ? p : -p) / 10)}$: Prozent heißt **Hundertstel**.`,
    ),
  );

/** p % of G. */
function wSlips(p: number, G: number, unit: Unit, story = false): Slip[] {
  const W = (G * p) / 100;
  return [
    story && [
      G - W,
      OTHER_PART,
      say(({ t }) =>
        t(
          `Careful, that's the **other** part, the $${100 - p} %$. The question asks for the $${p} %$.`,
          `Vorsicht, das ist der **andere** Teil, die $${100 - p} %$. Gefragt sind die $${p} %$.`,
        ),
      ),
    ],
    p !== 1 && [
      G / p,
      tx("Divided by the percent", "Durch die Prozentzahl geteilt"),
      say(({ t }) =>
        t(
          `Ah, you divided by $${p}$! That only works for $10 %$, because $10 %$ is a tenth. $${p} %$ means $\\frac{${p}}{100}$, so multiply by that.`,
          `Ah, du hast durch $${p}$ geteilt! Das klappt nur bei $10 %$, weil $10 %$ ein Zehntel ist. $${p} %$ heißt $\\frac{${p}}{100}$, damit multiplizierst du.`,
        ),
      ),
    ],
    p < 10 && [
      (G * p) / 10,
      tx("One zero missing", "Eine Null fehlt"),
      say(({ t, n }) =>
        t(
          `Nearly! $${p} %$ is $${n(p / 100)}$, not $${n(p / 10)}$. Percent means hundredths, so the point moves **two** places.`,
          `Fast! $${p} %$ ist $${n(p / 100)}$, nicht $${n(p / 10)}$. Prozent heißt Hundertstel, das Komma rückt also **zwei** Stellen.`,
        ),
      ),
    ],
    [
      (G * 100) / p,
      tx("Base value and percentage mixed up", "Grundwert und Prozentwert verwechselt"),
      say((f) =>
        f.t(
          `I think I know what you did: you treated ${amt(f, G, unit)} as the part and worked out the whole. But ${amt(f, G, unit)} already **is** the whole ($100 %$), and you need $${p} %$ of it.`,
          `Ich glaub, ich weiß, was du gemacht hast: Du hast ${amt(f, G, unit)} als Prozentwert genommen und das Ganze ausgerechnet. Aber ${amt(f, G, unit)} sind schon das Ganze ($100 %$), gesucht sind $${p} %$ davon.`,
        ),
      ),
    ],
  ];
}

/** The rate p % = W / G. */
function pSlips(W: number, G: number, p: number, story: boolean): Slip[] {
  return [
    [
      10000 / p,
      tx("Whole divided by the part", "Ganzes durch Teil geteilt"),
      say(({ t, n }) =>
        t(
          `I think I know what you did: you divided $${n(G)}$ by $${n(W)}$. It's the other way round: the part divided by the whole.`,
          `Ich glaub, ich weiß, was du gemacht hast: Du hast $${n(G)}$ durch $${n(W)}$ geteilt. Andersrum: der Teil geteilt durch das Ganze.`,
        ),
      ),
    ],
    G !== 100 && [
      W,
      tx("The part isn't the rate", "Der Teil ist kein Prozentsatz"),
      say(({ t, n }) =>
        t(
          `Hmm, $${n(W)}$ is the part itself, not a percentage yet. Compare it with the whole, $${n(G)}$: part divided by whole.`,
          `Hm, $${n(W)}$ ist der Teil selbst, noch kein Prozentsatz. Vergleich ihn mit dem Ganzen, $${n(G)}$: Teil geteilt durch Ganzes.`,
        ),
      ),
    ],
    story && [
      100 - p,
      OTHER_PART,
      say(({ t, n }) =>
        t(`Careful, that's the share of the **rest**. The question asks for the share of the $${n(W)}$.`, `Vorsicht, das ist der Anteil vom **Rest**. Gefragt ist der Anteil von $${n(W)}$.`),
      ),
    ],
  ];
}

/** The base value G from W = p % of G. */
function gSlips(W: number, p: number, unit: Unit): Slip[] {
  return [
    [
      (W * p) / 100,
      tx("Percentage worked out instead", "Prozentwert statt Grundwert"),
      say((f) =>
        f.t(
          `Ah, I see what happened! You worked out $${p} %$ **of** ${amt(f, W, unit)}. But ${amt(f, W, unit)} already **is** the $${p} %$, and you're looking for the whole, the $100 %$.`,
          `Ah, ich seh, was passiert ist! Du hast $${p} %$ **von** ${amt(f, W, unit)} ausgerechnet. Aber ${amt(f, W, unit)} **sind** schon die $${p} %$. Gesucht ist das Ganze, also $100 %$.`,
        ),
      ),
    ],
    [
      W * (1 + p / 100),
      tx("Percent added on", "Prozente draufgerechnet"),
      say((f) =>
        f.t(
          `Hmm, you added $${p} %$ on top of ${amt(f, W, unit)}. But ${amt(f, W, unit)} is only $${p} %$ of the whole: go via $1 %$ to $100 %$.`,
          `Hm, du hast $${p} %$ auf ${amt(f, W, unit)} draufgerechnet. Aber ${amt(f, W, unit)} sind nur $${p} %$ vom Ganzen: Geh über $1 %$ zu $100 %$.`,
        ),
      ),
    ],
  ];
}

/** A rise or drop by p %: new value G · (1 ± p/100). */
function changeSlips(G: number, p: number, up: boolean, unit: Unit, vat = false): Slip[] {
  const money = unit === "€";
  return [
    [
      (G * p) / 100,
      vat ? tx("Only the VAT", "Nur die Mehrwertsteuer") : up ? tx("Only the increase", "Nur die Zunahme") : tx("Only the discount", "Nur der Rabatt"),
      vat
        ? tx(
            "Nearly! That's just the **VAT** itself. The question asks for the price including it, so it still has to go on top.",
            "Fast! Das ist nur die **Mehrwertsteuer** selbst. Gefragt ist der Preis mit Steuer, sie muss also noch drauf.",
          )
        : up
          ? tx(
              "Nearly! That's just the **increase**. The question asks for the new value, so it still has to go on top of the old one.",
              "Fast! Das ist nur die **Zunahme**. Gefragt ist der neue Wert, sie muss also noch auf den alten drauf.",
            )
          : tx(
              "Nearly! That's just the **discount**. The question asks for the new price, so it still has to come off the old one.",
              "Fast! Das ist nur der **Rabatt**. Gefragt ist der neue Preis, er muss also noch vom alten weg.",
            ),
    ],
    [
      up ? G + p : G - p,
      tx("Percent taken as a number", "Prozent als feste Zahl genommen"),
      say(({ t }) =>
        up
          ? t(
              `Ah, I see what happened! You added $${p}$${money ? " €" : ""} straight on. But $${p} %$ means $${p}$ hundredths **of** the old value.`,
              `Ah, ich seh, was passiert ist! Du hast einfach $${p}$${money ? "\u00a0€" : ""} draufgerechnet. Aber $${p} %$ heißt $${p}$ Hundertstel **vom** alten Wert.`,
            )
          : t(
              `Ah, I see what happened! You took $${p}$${money ? " €" : ""} straight off. But $${p} %$ means $${p}$ hundredths **of** the price.`,
              `Ah, ich seh, was passiert ist! Du hast einfach $${p}$${money ? "\u00a0€" : ""} abgezogen. Aber $${p} %$ heißt $${p}$ Hundertstel **vom** Preis.`,
            ),
      ),
    ],
    p < 10 && [G * (1 + (up ? p : -p) / 10), FACTOR_OFF, factorOff(p, up)],
  ];
}

/** Back to the old value G = N / q. */
function reverseSlips(N: number, p: number, up: boolean, vat = false): Slip[] {
  const q = 1 + (up ? p : -p) / 100;
  const qWrong = 1 + (up ? -p : p) / 100;
  return [
    [
      N * qWrong,
      tx("Percent of the new price", "Prozent vom neuen Preis"),
      vat
        ? tx(
            `Ooh, classic trap! You took $${p} %$ of the price **with** VAT off. But the VAT is $${p} %$ of the price **without** VAT, so divide by the growth factor instead.`,
            `Die klassische Falle! Du hast $${p} %$ vom Preis **mit** Steuer abgezogen. Die Mehrwertsteuer beträgt aber $${p} %$ vom Preis **ohne** Steuer, also teile durch den Wachstumsfaktor.`,
          )
        : up
        ? tx(
            `Ooh, classic trap! You took $${p} %$ of the **new** price off. But the rise was $${p} %$ of the **old** price, so divide by the growth factor instead.`,
            `Die klassische Falle! Du hast $${p} %$ vom **neuen** Preis abgezogen. Die Erhöhung betrug aber $${p} %$ vom **alten** Preis, also teile durch den Wachstumsfaktor.`,
          )
        : tx(
            `Ooh, classic trap! You added $${p} %$ of the **new** price. But the discount was $${p} %$ of the **old** price, so divide by the growth factor instead.`,
            `Die klassische Falle! Du hast $${p} %$ vom **neuen** Preis draufgerechnet. Der Rabatt betrug aber $${p} %$ vom **alten** Preis, also teile durch den Wachstumsfaktor.`,
          ),
    ],
    [
      N * q,
      tx("Changed it once more", "Noch mal verändert"),
      say(({ t, c, n }) =>
        vat
          ? t(
              `Hmm, you added the VAT once more. But $${c(N)}$ € already includes it: undo it by dividing by $${n(q)}$.`,
              `Hm, du hast die Mehrwertsteuer noch mal draufgerechnet. Aber in $${c(N)}$\u00a0€ ist sie schon drin: Mach sie rückgängig, indem du durch $${n(q)}$ teilst.`,
            )
          : up
          ? t(
              `Hmm, you raised the price by another $${p} %$. But $${c(N)}$ € is already the price **after** the rise: undo it by dividing by $${n(q)}$.`,
              `Hm, du hast den Preis noch mal um $${p} %$ erhöht. Aber $${c(N)}$\u00a0€ ist schon der Preis **nach** der Erhöhung: Mach sie rückgängig, indem du durch $${n(q)}$ teilst.`,
            )
          : t(
              `Hmm, you took another $${p} %$ off. But $${c(N)}$ € is already the price **after** the discount: undo it by dividing by $${n(q)}$.`,
              `Hm, du hast noch mal $${p} %$ abgezogen. Aber $${c(N)}$\u00a0€ ist schon der Preis **nach** dem Rabatt: Mach ihn rückgängig, indem du durch $${n(q)}$ teilst.`,
            ),
      ),
    ],
    [
      N / qWrong,
      tx("Wrong growth factor", "Falscher Wachstumsfaktor"),
      up
        ? tx(
            `Dividing is the right idea! But after a **rise** of $${p} %$ the growth factor is bigger than $1$.`,
            `Teilen ist die richtige Idee! Aber nach einer **Erhöhung** um $${p} %$ ist der Wachstumsfaktor größer als $1$.`,
          )
        : tx(
            `Dividing is the right idea! But after a **discount** of $${p} %$ the growth factor is smaller than $1$.`,
            `Teilen ist die richtige Idee! Aber nach einem **Rabatt** von $${p} %$ ist der Wachstumsfaktor kleiner als $1$.`,
          ),
    ],
    !up && [
      (N * 100) / p,
      tx(`New price taken as ${p} %`, `Neuer Preis als ${p}\u00a0% genommen`),
      say(({ t, c }) =>
        t(
          `I think you treated $${c(N)}$ € as $${p} %$ of the old price. But after $${p} %$ off, the new price is $${100 - p} %$ of the old one.`,
          `Ich glaub, du hast $${c(N)}$\u00a0€ als $${p} %$ vom alten Preis genommen. Nach $${p} %$ Rabatt ist der neue Preis aber $${100 - p} %$ vom alten.`,
        ),
      ),
    ],
  ];
}

// Level 1 ---------------------------------------------------------------------

function wTask(rng: Rng): Exercise | null {
  const p = rng.pick([1, 2, 5, 10, 10, 15, 20, 25, 25, 30, 40, 50, 50, 60, 75, 80]);
  const unit = rng.pick(UNITS);
  const step = Math.max(stepFor(p), 10);
  const G = step * rng.int(2, Math.floor(1200 / step));
  if (G < 20 || (G % 10 !== 0 && rng.chance(0.6))) return null;
  const W = (G * p) / 100;
  return {
    instruction: CALCULATE,
    math: OF(`${p} % "of" ${G} "${unit}"`),
    answer: amount(W, unit),
    hint: SHORTCUTS[p]
      ? tx("Use a shortcut, or $W = G \\cdot \\frac{p}{100}$.", "Nutze einen Rechentrick oder $W = G \\cdot \\frac{p}{100}$.")
      : say(({ t, n }) => t(`$${p} % = ${n(p / 100)}$. Multiply the base value by it.`, `$${p} % = ${n(p / 100)}$. Multipliziere den Grundwert damit.`)),
    solution: findWFrames(p, G, unit),
    mistakes: mistakesFor(amount(W, unit), wSlips(p, G, unit)),
  };
}

const W_STORIES: { unit: Unit; bases: number[]; text: (p: number, G: number) => Text }[] = [
  {
    unit: "students",
    bases: [20, 24, 25, 28, 30, 32],
    text: (p, G) =>
      tx(
        `Class 8b has ${G} students. ${p} % of them come to school by bike. How many students is that?`,
        `Die Klasse 8b hat ${G} Schülerinnen und Schüler. ${p}\u00a0% davon kommen mit dem Fahrrad zur Schule. Wie viele sind das?`,
      ),
  },
  {
    unit: "members",
    bases: [60, 80, 120, 150, 200, 240, 300, 400],
    text: (p, G) =>
      tx(
        `A sports club has ${G} members. ${p} % of them are under 18. How many members is that?`,
        `Ein Sportverein hat ${G} Mitglieder. ${p}\u00a0% davon sind unter 18. Wie viele Mitglieder sind das?`,
      ),
  },
  {
    unit: "g",
    bases: [200, 250, 300, 400, 500, 750, 1000],
    text: (p, G) =>
      tx(
        `A bag of trail mix weighs ${G} g. ${p} % of it is nuts. How many grams of nuts are in the bag?`,
        `Eine Tüte Studentenfutter wiegt ${G} g. ${p}\u00a0% davon sind Nüsse. Wie viel Gramm Nüsse sind in der Tüte?`,
      ),
  },
  {
    unit: "€",
    bases: [600, 750, 800, 900, 1000, 1200],
    text: (p, G) =>
      tx(
        `Jonas earns ${G} € a month as an apprentice. He saves ${p} % of it. How much does he save each month?`,
        `Jonas verdient in seiner Ausbildung ${G}\u00a0€ im Monat. Davon spart er ${p}\u00a0%. Wie viel spart er jeden Monat?`,
      ),
  },
  {
    unit: "students",
    bases: [300, 400, 450, 500, 600, 800, 1200],
    text: (p, G) =>
      tx(
        `A school has ${G} students. ${p} % of them take part in the sports day. How many students take part?`,
        `Eine Schule hat ${G} Schülerinnen und Schüler. ${p}\u00a0% davon machen beim Sportfest mit. Wie viele sind das?`,
      ),
  },
];

function wStoryTask(rng: Rng): Exercise | null {
  const story = rng.pick(W_STORIES);
  const G = rng.pick(story.bases);
  const rates = [5, 10, 20, 25, 30, 40, 50, 60, 75, 80, 15].filter((p) => Number.isInteger((G * p) / 100));
  if (!rates.length) return null;
  const p = rng.pick(rates);
  const W = (G * p) / 100;
  return {
    instruction: WORD_PROBLEM,
    text: story.text(p, G),
    answer: amount(W, story.unit),
    hint: tx(
      "What is the whole (base value $G$), and what is the rate? Then $W = G \\cdot \\frac{p}{100}$.",
      "Was ist das Ganze (Grundwert $G$), und wie groß ist der Prozentsatz? Dann gilt $W = G \\cdot \\frac{p}{100}$.",
    ),
    solution: findWFrames(p, G, story.unit),
    mistakes: mistakesFor(amount(W, story.unit), wSlips(p, G, story.unit, true)),
  };
}

function convertTask(rng: Rng): Exercise | null {
  const kind = rng.int(0, 2);
  if (kind === 0) {
    const p = rng.pick([3, 5, 8, 12, 15, 19, 25, 35, 40, 64, 70, 99, 120, 150, 7.5, 2.5]);
    const v = p / 100;
    return {
      instruction: tx("Write as a decimal", "Schreib als Dezimalzahl"),
      math: say(({ n }) => `${n(p)} %`),
      answer: { kind: "number", value: r6(v) },
      hint: tx("Percent means per hundred: divide by $100$.", "Prozent heißt „von Hundert“: Teile durch $100$."),
      solution: [
        { math: say(({ n }) => `${n(p)}#p %#pc`), note: tx("Percent means per hundred.", "Prozent heißt „von Hundert“.") },
        {
          math: say(({ n }) => `${n(p)}#p %#pc =#e \\frac{${n(p)}#n}{100#h}#f`),
          note: say(({ t, n }) => t(`$${n(p)} %$ is $${n(p)}$ hundredths.`, `$${n(p)} %$ sind $${n(p)}$ Hundertstel.`)),
          highlight: ["h"],
        },
        {
          math: say(({ n }) => `${n(p)}#p %#pc =#e \\frac{${n(p)}#n}{100#h}#f =#e2 ${n(v)}#v`),
          note: say(({ t, n }) =>
            t(
              `Divide by $100$: the decimal point moves two places to the left. $${n(p)} % = ${n(v)}$.`,
              `Teile durch $100$: Das Komma rückt zwei Stellen nach links. $${n(p)} % = ${n(v)}$.`,
            ),
          ),
          highlight: ["v"],
        },
      ],
      mistakes: mistakesFor({ kind: "number", value: r6(v) }, [
        p < 10 && [
          p / 10,
          tx("One zero missing", "Eine Null fehlt"),
          say(({ t, n }) =>
            t(
              `Nearly! $${n(p)} %$ is $${n(p)}$ hundredths, so you need a zero right after the point. The point moves **two** places to the left.`,
              `Fast! $${n(p)} %$ sind $${n(p)}$ Hundertstel, direkt nach dem Komma brauchst du also eine Null. Das Komma rückt **zwei** Stellen nach links.`,
            ),
          ),
        ],
        [
          p * 100,
          WRONG_WAY,
          tx(
            "Ah, you moved the point to the **right**! From percent to decimal it moves two places to the **left**, because you divide by $100$.",
            "Ah, du hast das Komma nach **rechts** verschoben! Von Prozent zur Dezimalzahl rückt es zwei Stellen nach **links**, weil du durch $100$ teilst.",
          ),
        ],
      ]),
    };
  }
  if (kind === 1) {
    const v = rng.pick([0.07, 0.3, 0.45, 0.08, 0.125, 0.6, 0.03, 0.95, 1.2, 0.005, 0.72, 0.19]);
    const p = v * 100;
    return {
      instruction: AS_PERCENT,
      math: say(({ n }) => n(v)),
      answer: rateAnswer(p),
      hint: tx("Multiply by $100$: move the decimal point two places to the right.", "Multipliziere mit $100$: Das Komma rückt zwei Stellen nach rechts."),
      solution: [
        { math: say(({ n }) => `${n(v)}#v`), note: tx("A percentage counts hundredths.", "Prozente zählen Hundertstel.") },
        {
          math: say(({ n }) => `${n(v)}#v =#e \\frac{${n(p)}#n}{100#h}#f`),
          note: say(({ t, n }) => t(`$${n(v)}$ is $${n(p)}$ hundredths.`, `$${n(v)}$ sind $${n(p)}$ Hundertstel.`)),
        },
        {
          math: say(({ n }) => `${n(v)}#v =#e \\frac{${n(p)}#n}{100#h}#f =#e2 ${n(p)}#p %#pc`),
          note: say(({ t, n }) => t(`Hundredths are percent: $${n(v)} = ${n(p)} %$.`, `Hundertstel sind Prozent: $${n(v)} = ${n(p)} %$.`)),
          highlight: ["p"],
        },
      ],
      mistakes: mistakesFor(rateAnswer(p), [
        v < 1 && [
          Number(String(v).split(".")[1]),
          tx("Digits copied", "Ziffern abgeschrieben"),
          tx(
            "I think I know what you did: you just took the digits after the point. But percent counts **hundredths**: the point moves two places to the right.",
            "Ich glaub, ich weiß, was du gemacht hast: Du hast einfach die Ziffern nach dem Komma genommen. Aber Prozent zählt **Hundertstel**: Das Komma rückt zwei Stellen nach rechts.",
          ),
        ],
        [
          v / 100,
          WRONG_WAY,
          tx(
            "Ah, you moved the point to the **left**! From decimal to percent it moves two places to the **right**, because you multiply by $100$.",
            "Ah, du hast das Komma nach **links** verschoben! Von der Dezimalzahl zu Prozent rückt es zwei Stellen nach **rechts**, weil du mit $100$ multiplizierst.",
          ),
        ],
      ]),
    };
  }
  const d = rng.pick([2, 4, 5, 10, 20, 25, 50]);
  const n = rng.int(1, d - 1);
  if (gcd(n, d) !== 1) return null;
  const k = 100 / d;
  const p = n * k;
  return {
    instruction: AS_PERCENT,
    math: `\\frac{${n}}{${d}}`,
    answer: rateAnswer(p),
    hint: tx(
      `Expand the fraction so that the denominator is $100$: multiply top and bottom by $${k}$.`,
      `Erweitere den Bruch so, dass im Nenner $100$ steht: Zähler und Nenner mal $${k}$.`,
    ),
    solution: [
      { math: `\\frac{${n}#n}{${d}#d}#f`, note: tx("Percent means hundredths. So aim for the denominator $100$.", "Prozent heißt Hundertstel. Ziel ist also der Nenner $100$.") },
      {
        math: `\\frac{${n}#n \\cdot#m1 ${k}#k1}{${d}#d \\cdot#m2 ${k}#k2}#f`,
        note: tx(`$${d} \\cdot ${k} = 100$, so expand by $${k}$.`, `$${d} \\cdot ${k} = 100$, also mit $${k}$ erweitern.`),
        highlight: ["k1", "k2"],
      },
      { math: `\\frac{${p}#n}{100#d}#f`, note: tx(`That's $${p}$ hundredths.`, `Das sind $${p}$ Hundertstel.`) },
      { math: `\\frac{${p}#n}{100#d}#f =#e ${p}#p %#pc`, note: tx(`$${p}$ hundredths are $${p} %$.`, `$${p}$ Hundertstel sind $${p} %$.`), highlight: ["p"] },
    ],
    mistakes: mistakesFor(rateAnswer(p), [
      [
        n,
        tx("Only the denominator made 100", "Nur den Nenner auf 100 gebracht"),
        tx(
          "Nearly! You turned the denominator into $100$, but left the numerator as it was. Expanding means top **and** bottom times the same number.",
          "Fast! Du hast den Nenner auf $100$ gebracht, aber den Zähler so gelassen. Erweitern heißt: Zähler **und** Nenner mal dieselbe Zahl.",
        ),
      ],
      [
        n + 100 - d,
        tx("Added instead of multiplied", "Addiert statt multipliziert"),
        tx(
          `Ah, I see what happened! You added $${100 - d}$ to get from $${d}$ to $100$, and the same on top. But expanding means **multiplying** top and bottom by the same number.`,
          `Ah, ich seh, was passiert ist! Du hast $${100 - d}$ addiert, um von $${d}$ auf $100$ zu kommen, und oben dasselbe. Erweitern heißt aber: Zähler und Nenner mit derselben Zahl **multiplizieren**.`,
        ),
      ],
    ]),
  };
}

const GRIDS: [number, number][] = [
  [10, 10],
  [5, 10],
  [5, 5],
  [4, 5],
  [2, 5],
  [4, 10],
];

function gridTask(rng: Rng): Exercise | null {
  const [rows, cols] = rng.pick(GRIDS);
  const total = rows * cols;
  const k = rng.int(1, total - 1);
  const p = (k * 100) / total;
  if (!Number.isInteger(p) && rng.chance(0.85)) return null;
  const m = 100 / total;
  const frames: Frame[] = [{ math: `\\frac{${k}#n}{${total}#d}#f`, note: tx(`$${k}$ of the $${total}$ squares are shaded.`, `$${k}$ von $${total}$ Kästchen sind gefärbt.`) }];
  if (total !== 100) {
    frames.push({
      math: say(({ n }) => `\\frac{${k}#n \\cdot#m1 ${n(m)}#k1}{${total}#d \\cdot#m2 ${n(m)}#k2}#f`),
      note: say(({ t, n }) => t(`Expand to hundredths: $${total} \\cdot ${n(m)} = 100$.`, `Auf Hundertstel erweitern: $${total} \\cdot ${n(m)} = 100$.`)),
      highlight: ["k1", "k2"],
    });
    frames.push({ math: say(({ n }) => `\\frac{${n(p)}#n}{100#d}#f`), note: say(({ n }) => `$${k} \\cdot ${n(m)} = ${n(p)}$.`) });
  }
  frames.push({
    math: say(({ n }) => `\\frac{${n(p)}#n}{100#d}#f =#e ${n(p)}#p %#pc`),
    note: say(({ t, n }) => t(`$${n(p)}$ hundredths are $${n(p)} %$.`, `$${n(p)}$ Hundertstel sind $${n(p)} %$.`)),
    highlight: ["p"],
  });
  return {
    instruction: tx("Read the picture", "Lies am Bild ab"),
    text: tx("What percentage of the grid is shaded?", "Wie viel Prozent der Kästchen sind gefärbt?"),
    answer: rateAnswer(p),
    hint:
      total === 100
        ? tx("Each square is $1 %$.", "Jedes Kästchen ist $1 %$.")
        : say(({ t, n }) =>
            t(`There are $${total}$ squares, so each one is $100 : ${total} = ${n(m)} %$.`, `Es sind $${total}$ Kästchen, also ist jedes $100 : ${total} = ${n(m)} %$.`),
          ),
    solution: frames,
    visual: { component: PercentGrid as unknown as ComponentType<Record<string, unknown>>, props: { rows, cols, k } },
    mistakes: mistakesFor(rateAnswer(p), [
      total !== 100 && [
        k,
        tx("Squares counted as percent", "Kästchen als Prozent gezählt"),
        tx(
          `Ah, you counted each square as $1 %$. But there are only $${total}$ squares here, not $100$, so each one is worth more.`,
          `Ah, du hast jedes Kästchen als $1 %$ gezählt. Hier sind es aber nur $${total}$ Kästchen, nicht $100$, also ist jedes mehr wert.`,
        ),
      ],
      [
        100 - p,
        tx("Counted the white squares", "Die weißen Kästchen gezählt"),
        tx(
          "Ah, I see what happened! You counted the squares that are **not** shaded. The question asks for the coloured ones.",
          "Ah, ich seh, was passiert ist! Du hast die **nicht** gefärbten Kästchen gezählt. Gefragt sind die gefärbten.",
        ),
      ],
    ]),
  };
}

// Level 2 ---------------------------------------------------------------------

const P_STORIES: { text: (W: number, G: number) => Text; maxG: number }[] = [
  {
    text: (W, G) =>
      tx(
        `In a survey, ${W} of ${G} students said maths is their favourite subject. What percentage is that?`,
        `Bei einer Umfrage sagten ${W} von ${G} Schülerinnen und Schülern, dass Mathe ihr Lieblingsfach ist. Wie viel Prozent sind das?`,
      ),
    maxG: 200,
  },
  {
    text: (W, G) =>
      tx(
        `A football team won ${W} of its ${G} games this season. What percentage of its games did it win?`,
        `Eine Fußballmannschaft hat in dieser Saison ${W} von ${G} Spielen gewonnen. Wie viel Prozent ihrer Spiele hat sie gewonnen?`,
      ),
    maxG: 40,
  },
  {
    text: (W, G) =>
      tx(
        `A chocolate bar weighs ${G} g and contains ${W} g of sugar. What percentage of the bar is sugar?`,
        `Eine Tafel Schokolade wiegt ${G} g und enthält ${W} g Zucker. Wie viel Prozent der Tafel sind Zucker?`,
      ),
    maxG: 300,
  },
  {
    text: (W, G) =>
      tx(
        `${W} of the ${G} seats in a cinema are taken. What percentage of the seats are taken?`,
        `In einem Kino sind ${W} von ${G} Plätzen besetzt. Wie viel Prozent der Plätze sind besetzt?`,
      ),
    maxG: 400,
  },
  {
    text: (W, G) =>
      tx(`Mira answered ${W} of ${G} quiz questions correctly. What percentage is that?`, `Mira hat ${W} von ${G} Quizfragen richtig beantwortet. Wie viel Prozent sind das?`),
    maxG: 50,
  },
];

function pTask(rng: Rng): Exercise | null {
  const p = rng.pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 64, 75, 80, 12, 8, 90]);
  const step = stepFor(p);
  const asText = rng.chance(0.6);
  const story = rng.pick(P_STORIES);
  const maxG = asText ? story.maxG : 800;
  if (step > maxG) return null;
  const G = step * rng.int(1, Math.floor(maxG / step));
  const W = (G * p) / 100;
  if (G < 8 || W < 1) return null;
  const unit = rng.pick(UNITS);
  return {
    instruction: asText ? WORD_PROBLEM : tx("Find the percent rate", "Berechne den Prozentsatz"),
    ...(asText ? { text: story.text(W, G) } : { math: say(({ a }) => `G = ${a(G, unit)} "${unit}" ,\\quad W = ${a(W, unit)} "${unit}"`) }),
    answer: rateAnswer(p, asText ? undefined : "p ="),
    hint: tx(
      "Part divided by whole: $p % = \\frac{W}{G}$. Then turn the decimal into a percentage.",
      "Teil durch Ganzes: $p % = \\frac{W}{G}$. Dann die Dezimalzahl in Prozent umwandeln.",
    ),
    solution: findPFrames(W, G),
    mistakes: mistakesFor(rateAnswer(p), pSlips(W, G, p, asText)),
  };
}

const G_STORIES: { unit: Unit; min: number; max: number; text: (W: string, p: number, f: Fmt) => string; counts?: boolean }[] = [
  {
    unit: "€",
    min: 200,
    max: 1500,
    text: (W, p, { t }) =>
      t(
        `Paul has saved ${W} €. That is ${p} % of the price of a new bike. How much does the bike cost?`,
        `Paul hat ${W}\u00a0€ gespart. Das sind ${p}\u00a0% vom Preis eines neuen Fahrrads. Wie viel kostet das Fahrrad?`,
      ),
  },
  {
    unit: "students",
    min: 300,
    max: 1500,
    counts: true,
    text: (W, p, { t }) =>
      t(
        `${W} students of a school take the bus. That is ${p} % of all students. How many students go to the school?`,
        `An einer Schule fahren ${W} Schülerinnen und Schüler mit dem Bus. Das sind ${p}\u00a0% von allen. Wie viele Schülerinnen und Schüler hat die Schule?`,
      ),
  },
  {
    unit: "pages",
    min: 80,
    max: 600,
    counts: true,
    text: (W, p, { t }) =>
      t(
        `Lea has read ${W} pages of her book. That is ${p} % of the book. How many pages does the book have?`,
        `Lea hat ${W} Seiten ihres Buches gelesen. Das sind ${p}\u00a0% des Buches. Wie viele Seiten hat das Buch?`,
      ),
  },
  {
    unit: "L",
    min: 100,
    max: 1500,
    text: (W, p, { t }) =>
      t(
        `A water tank holds ${W} L. It is ${p} % full. How many litres does the full tank hold?`,
        `In einem Wassertank sind ${W} L. Er ist zu ${p}\u00a0% gefüllt. Wie viele Liter passen in den vollen Tank?`,
      ),
  },
];

function gTask(rng: Rng): Exercise | null {
  const p = rng.pick([4, 5, 10, 15, 20, 25, 30, 40, 60, 75, 80, 12, 35]);
  const asText = rng.chance(0.6);
  const story = rng.pick(G_STORIES);
  const unit = asText ? story.unit : rng.pick(UNITS);
  const step = stepFor(p);
  const G = step * rng.int(1, Math.floor(1500 / step));
  const W = (G * p) / 100;
  if (G < 40 || G % 10 !== 0) return null;
  if (asText && (G < story.min || G > story.max || (story.counts && !Number.isInteger(W)))) return null;
  return {
    instruction: asText ? WORD_PROBLEM : tx("Find the base value", "Berechne den Grundwert"),
    ...(asText ? { text: say((f) => story.text(f.a(W, unit), p, f)) } : { math: say(({ a }) => `W = ${a(W, unit)} "${unit}" ,\\quad p % = ${p} %`) }),
    answer: amount(G, unit, asText ? undefined : "G ="),
    hint: say(({ t, a }) =>
      t(
        `Rule of three: if $${p} %$ are $${a(W, unit)}$, what is $1 %$? And then $100 %$?`,
        `Dreisatz: Wenn $${p} %$ genau $${a(W, unit)}$ sind, wie viel ist dann $1 %$? Und $100 %$?`,
      ),
    ),
    solution: findGFrames(p, W, unit),
    mistakes: mistakesFor(amount(G, unit), gSlips(W, p, unit)),
  };
}

const CHANGE_STORIES: { up: boolean; vat?: boolean; unit: Unit; base: (rng: Rng) => number; text: (G: string, p: number, f: Fmt) => string }[] = [
  {
    up: false,
    unit: "€",
    base: (rng) => 10 * rng.int(4, 30),
    text: (G, p, { t }) =>
      t(
        `A jacket costs ${G} €. In the sale, the price is reduced by ${p} %. What is the sale price?`,
        `Eine Jacke kostet ${G}\u00a0€. Im Schlussverkauf wird der Preis um ${p}\u00a0% reduziert. Wie viel kostet sie jetzt?`,
      ),
  },
  {
    up: false,
    unit: "€",
    base: (rng) => 10 * rng.int(2, 8),
    text: (G, p, { t }) =>
      t(
        `A video game costs ${G} €. Club members get ${p} % off. How much do members pay?`,
        `Ein Videospiel kostet ${G}\u00a0€. Clubmitglieder bekommen ${p}\u00a0% Rabatt. Wie viel zahlen Mitglieder?`,
      ),
  },
  {
    up: true,
    vat: true,
    unit: "€",
    base: (rng) => 5 * rng.int(4, 60),
    text: (G, _p, { t }) =>
      t(
        `Headphones cost ${G} € before VAT. VAT (Mehrwertsteuer) is 19 %. What is the price including VAT?`,
        `Kopfhörer kosten ohne Mehrwertsteuer ${G}\u00a0€. Die Mehrwertsteuer beträgt 19\u00a0%. Wie viel kosten sie mit Mehrwertsteuer?`,
      ),
  },
  {
    up: true,
    unit: "€",
    base: (rng) => 10 * rng.int(40, 120),
    text: (G, p, { t }) =>
      t(
        `The rent for a flat is ${G} € a month. It goes up by ${p} %. What is the new rent?`,
        `Die Miete für eine Wohnung beträgt ${G}\u00a0€ im Monat. Sie steigt um ${p}\u00a0%. Wie hoch ist die neue Miete?`,
      ),
  },
  {
    up: true,
    unit: "inhabitants",
    base: (rng) => 100 * rng.int(20, 300),
    text: (G, p, { t }) =>
      t(
        `A town has ${G} inhabitants. In one year the population grows by ${p} %. How many inhabitants does it have now?`,
        `Eine Stadt hat ${G} Einwohner. In einem Jahr wächst die Einwohnerzahl um ${p}\u00a0%. Wie viele Einwohner hat sie jetzt?`,
      ),
  },
];

function changeTask(rng: Rng): Exercise | null {
  const story = rng.pick(CHANGE_STORIES);
  const p = story.vat ? 19 : story.up ? rng.pick([2, 3, 4, 5, 8, 10, 12, 15, 20]) : rng.pick([10, 15, 20, 25, 30, 40, 50, 35]);
  const G = story.base(rng);
  const N = G * factorOf({ up: story.up, p });
  if (story.unit === "inhabitants" && !Number.isInteger(r6(N))) return null;
  return {
    instruction: WORD_PROBLEM,
    text: say((f) => story.text(f.big(cash(G)), p, f)),
    answer: amount(N, story.unit),
    hint: say(({ t, n }) =>
      story.up
        ? t(
            `The new value is $${100 + p} %$ of the old one. Multiply by the growth factor $${n(1 + p / 100)}$.`,
            `Der neue Wert ist $${100 + p} %$ des alten. Multipliziere mit dem Wachstumsfaktor $${n(1 + p / 100)}$.`,
          )
        : t(`$${p} %$ off leaves $${100 - p} %$. Multiply by $${n(1 - p / 100)}$.`, `Bei $${p} %$ Rabatt bleiben $${100 - p} %$. Multipliziere mit $${n(1 - p / 100)}$.`),
    ),
    solution: changeFrames(G, p, story.up, story.unit),
    mistakes: mistakesFor(amount(N, story.unit), changeSlips(G, p, story.up, story.unit, story.vat)),
  };
}

// Level 3 ---------------------------------------------------------------------

const REVERSE_STORIES: { up: boolean; vat?: boolean; base: (rng: Rng) => number; text: (N: string, p: number, f: Fmt) => string }[] = [
  {
    up: false,
    base: (rng) => 10 * rng.int(4, 30),
    text: (N, p, { t }) =>
      t(
        `After a discount of ${p} %, a jacket costs ${N} €. What was the original price?`,
        `Nach einem Preisnachlass von ${p}\u00a0% kostet eine Jacke ${N}\u00a0€. Wie hoch war der ursprüngliche Preis?`,
      ),
  },
  {
    up: true,
    vat: true,
    base: (rng) => 10 * rng.int(10, 100),
    text: (N, _p, { t }) =>
      t(
        `A phone costs ${N} € including 19 % VAT. What is the price without VAT?`,
        `Ein Handy kostet ${N}\u00a0€ inklusive 19\u00a0% Mehrwertsteuer. Wie hoch ist der Preis ohne Mehrwertsteuer?`,
      ),
  },
  {
    up: true,
    base: (rng) => 5 * rng.int(4, 30),
    text: (N, p, { t }) =>
      t(
        `After a price rise of ${p} %, a concert ticket costs ${N} €. What did it cost before?`,
        `Nach einer Preiserhöhung um ${p}\u00a0% kostet ein Konzertticket ${N}\u00a0€. Wie viel hat es vorher gekostet?`,
      ),
  },
  {
    up: true,
    base: (rng) => 50 * rng.int(30, 70),
    text: (N, p, { t }) =>
      t(
        `After a pay rise of ${p} %, Sara earns ${N} € a month. How much did she earn before?`,
        `Nach einer Gehaltserhöhung um ${p}\u00a0% verdient Sara ${N}\u00a0€ im Monat. Wie viel hat sie vorher verdient?`,
      ),
  },
  {
    up: false,
    base: (rng) => 10 * rng.int(4, 20),
    text: (N, p, { t }) =>
      t(
        `In the sale, everything is ${p} % off. Tom pays ${N} € for a pair of shoes. What was the normal price?`,
        `Im Schlussverkauf ist alles um ${p}\u00a0% reduziert. Tom zahlt ${N}\u00a0€ für ein Paar Schuhe. Wie viel haben die Schuhe vorher gekostet?`,
      ),
  },
];

function reverseTask(rng: Rng): Exercise | null {
  const story = rng.pick(REVERSE_STORIES);
  const p = story.vat ? 19 : story.up ? rng.pick([5, 10, 15, 20, 25, 4, 8]) : rng.pick([10, 15, 20, 25, 30, 40, 35]);
  const G = story.base(rng);
  const N = r2(G * factorOf({ up: story.up, p }));
  return {
    instruction: WORD_PROBLEM,
    text: say((f) => story.text(f.c(N), p, f)),
    answer: amount(G, "€"),
    hint: say(({ t, n }) =>
      t(
        `The new price is $${story.up ? 100 + p : 100 - p} %$ of the old one. So divide by $${n(factorOf({ up: story.up, p }))}$. Careful: don't just ${story.up ? "subtract" : "add"} $${p} %$ of the new price!`,
        `Der neue Preis ist $${story.up ? 100 + p : 100 - p} %$ des alten. Teile also durch $${n(factorOf({ up: story.up, p }))}$. Vorsicht: ${story.up ? `Zieh nicht einfach $${p} %$ vom neuen Preis ab!` : `Rechne nicht einfach $${p} %$ auf den neuen Preis drauf!`}`,
      ),
    ),
    solution: reverseFrames(N, p, story.up, "€"),
    mistakes: mistakesFor(amount(G, "€"), reverseSlips(N, p, story.up, story.vat)),
  };
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

const POINT_STORIES: { intro: (a: number, b: number) => Text; what: string }[] = [
  {
    intro: (a, b) =>
      tx(
        `The share of students who cycle to school rises from ${a} % to ${b} %.`,
        `Der Anteil der Schülerinnen und Schüler, die mit dem Rad zur Schule kommen, steigt von ${a}\u00a0% auf ${b}\u00a0%.`,
      ),
    what: "der Anteil",
  },
  { intro: (a, b) => tx(`A bank raises its interest rate from ${a} % to ${b} %.`, `Eine Bank erhöht ihren Zinssatz von ${a}\u00a0% auf ${b}\u00a0%.`), what: "der Zinssatz" },
  {
    intro: (a, b) => tx(`A party's result in an election goes up from ${a} % to ${b} %.`, `Bei einer Wahl steigt das Ergebnis einer Partei von ${a}\u00a0% auf ${b}\u00a0%.`),
    what: "das Ergebnis",
  },
];
const POINT_PAIRS: [number, number][] = [
  [20, 25],
  [2, 3],
  [4, 5],
  [10, 12],
  [40, 50],
  [5, 6],
  [8, 10],
  [25, 30],
  [30, 36],
  [16, 20],
];

const POINTS_NOT_PERCENT = tx("Points, not percent", "Prozentpunkte, nicht Prozent");
/** Taking the difference of two percentages as the change in percent. */
const pointsNotPercent = (a: number, what: string) =>
  tx(
    `Ooh, the classic trap! ${what} is the rise in **percentage points**. A change in percent compares the rise with the old value $${a} %$.`,
    `Die klassische Falle! ${what} ist der Anstieg in **Prozentpunkten**. Eine Änderung in Prozent vergleicht den Anstieg mit dem alten Wert $${a} %$.`,
  );

/** "1 Prozentpunkt", "5 Prozentpunkte". */
const pointsDe = (v: number | string) => `${v} ${String(v) === "1" ? "Prozentpunkt" : "Prozentpunkte"}`;

function pointsTask(rng: Rng): Exercise | null {
  const [a, b] = rng.pick(POINT_PAIRS);
  const diff = b - a;
  const rel = (diff / a) * 100;
  const story = rng.pick(POINT_STORIES);
  const intro = story.intro(a, b);
  const frames: Frame[] = [
    { math: `${a}#a %#ap \\to#to ${b}#b %#bp`, note: tx(`From $${a} %$ to $${b} %$.`, `Von $${a} %$ auf $${b} %$.`) },
    {
      math: tx(`${b}#b %#bp -#m ${a}#a %#ap =#e ${diff}#c "percentage points"#pp`, `${b}#b %#bp -#m ${a}#a %#ap =#e ${diff}#c "${diff === 1 ? "Prozentpunkt" : "Prozentpunkte"}"#pp`),
      note: tx(`The difference is $${diff}$ **percentage points** (Prozentpunkte).`, `Der Unterschied beträgt $${diff}$ **${diff === 1 ? "Prozentpunkt" : "Prozentpunkte"}**.`),
    },
    {
      math: say(({ n }) => `\\frac{${diff}#c}{${a}#a}#f =#e ${n(diff / a)}#h =#e2 ${n(rel)}#r %#rp`),
      note: say(({ t, n }) =>
        t(
          `Compared with the old value: $${diff} : ${a} = ${n(diff / a)}$. So it rose by $${n(rel)} %$.`,
          `Im Vergleich zum alten Wert: $${diff} : ${a} = ${n(diff / a)}$. Das ist also ein Anstieg um $${n(rel)} %$.`,
        ),
      ),
      highlight: ["r"],
    },
  ];
  const de = (s: Text) => (typeof s === "string" ? s : s.de);
  const en = (s: Text) => (typeof s === "string" ? s : s.en);
  if (rng.chance(0.45)) {
    const options: Text[] = [
      tx(`It rose by ${diff} percentage points.`, `Das ist ein Anstieg um ${pointsDe(diff)}.`),
      tx(`It rose by ${diff} %.`, `Das ist ein Anstieg um ${diff}\u00a0%.`),
      tx(`It rose by ${b} percentage points.`, `Das ist ein Anstieg um ${pointsDe(b)}.`),
      rel === b
        ? tx(`It fell by ${diff} percentage points.`, `Das ist ein Rückgang um ${pointsDe(diff)}.`)
        : say(({ t, n }) => t(`It rose by ${n(rel)} percentage points.`, `Das ist ein Anstieg um ${pointsDe(n(rel))}.`)),
    ];
    const order = rng.shuffle([0, 1, 2, 3]);
    const shown = order.map((i) => options[i]);
    const pick = (i: number, title: Text, said: Text): Mistake => ({ when: { kind: "choice", options: shown, correct: order.indexOf(i) }, title, say: said });
    return {
      instruction: tx("Percent or percentage points?", "Prozent oder Prozentpunkte?"),
      text: tx(`${en(intro)} Which statement is correct?`, `${de(intro)} Welche Aussage stimmt?`),
      answer: { kind: "choice", options: shown, correct: order.indexOf(0) },
      mistakes: [
        pick(1, POINTS_NOT_PERCENT, pointsNotPercent(a, `$${b} % - ${a} %$`)),
        pick(
          2,
          tx("That's the new value", "Das ist der neue Wert"),
          tx(
            `Hmm, $${b} %$ is where it ended up, not how much it rose. Look at the difference between old and new.`,
            `Hm, $${b} %$ ist der neue Stand, nicht der Anstieg. Schau dir den Unterschied zwischen alt und neu an.`,
          ),
        ),
        rel === b
          ? pick(
              3,
              tx("It went up", "Es ist gestiegen"),
              tx(`Look again: from $${a} %$ to $${b} %$ is a **rise**, not a drop.`, `Schau noch mal hin: Von $${a} %$ auf $${b} %$ ist ein **Anstieg**, kein Rückgang.`),
            )
          : pick(
              3,
              tx("Percent, not points", "Prozent, nicht Prozentpunkte"),
              say(({ t, n }) =>
                t(
                  `Nearly! $${n(rel)}$ is the rise **in percent**, compared with the old value. In percentage points it's simply the difference of the two values.`,
                  `Fast! $${n(rel)}$ ist der Anstieg **in Prozent**, verglichen mit dem alten Wert. In Prozentpunkten ist es einfach die Differenz der beiden Werte.`,
                ),
              ),
            ),
      ],
      hint: tx(
        "Subtracting two percentages gives percentage points. A change in percent compares with the old value.",
        "Die Differenz zweier Prozentsätze misst man in Prozentpunkten. Eine Änderung in Prozent vergleicht immer mit dem alten Wert.",
      ),
      solution: frames,
    };
  }
  return {
    instruction: WORD_PROBLEM,
    text: tx(`${en(intro)} By how many percent did it rise?`, `${de(intro)} Um wie viel Prozent ist ${story.what} gestiegen?`),
    answer: rateAnswer(rel),
    mistakes: mistakesFor(rateAnswer(rel), [
      [diff, POINTS_NOT_PERCENT, pointsNotPercent(a, `$${diff}$`)],
      [
        (diff / b) * 100,
        tx("Compared with the new value", "Mit dem neuen Wert verglichen"),
        tx(
          `Nearly! You compared the rise with the **new** value $${b} %$. A change in percent always compares with the **old** value.`,
          `Fast! Du hast den Anstieg mit dem **neuen** Wert $${b} %$ verglichen. Eine Änderung in Prozent vergleicht immer mit dem **alten** Wert.`,
        ),
      ],
      [
        (b / a) * 100,
        tx("New value as a percentage", "Neuer Wert in Prozent"),
        tx(
          "Almost! That's the new value as a percentage of the old one. The rise is only the part above $100 %$.",
          "Fast! Das ist der neue Wert in Prozent vom alten. Der Anstieg ist nur der Teil über $100 %$.",
        ),
      ],
    ]),
    hint: tx(
      `It rose by $${diff}$ percentage points. But in percent, compare the rise with the old value $${a} %$.`,
      `Der Anstieg beträgt $${diff}$ ${diff === 1 ? "Prozentpunkt" : "Prozentpunkte"}. In Prozent vergleichst du den Anstieg aber mit dem alten Wert $${a} %$.`,
    ),
    solution: frames,
  };
}

const LEVELS: Record<Level, [number, Gen][]> = {
  1: [
    [3, wTask],
    [3, wStoryTask],
    [2, convertTask],
    [2, gridTask],
  ],
  2: [
    [3, pTask],
    [3, gTask],
    [4, changeTask],
  ],
  3: [
    [3, reverseTask],
    [2, chainTask],
    [2, totalChangeTask],
    [2, compoundTask],
    [1.5, pointsTask],
  ],
};

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 80; tries++) {
    const ex = pickWeighted(rng, LEVELS[level])(rng);
    if (ex) return ex;
  }
  return {
    instruction: CALCULATE,
    math: OF(`10 % "of" 300 "€"`),
    answer: amount(30, "€"),
    hint: tx("$10 %$ is a tenth.", "$10 %$ ist ein Zehntel."),
    solution: findWFrames(10, 300, "€"),
  };
}

// ---------------------------------------------------------------------------
// Pictures

const EMPTY = "color-mix(in oklab, var(--ink) 8%, transparent)";

/** Number formatting and wording for the widgets in the current language. */
function useFmt(): Fmt {
  const l = useLocale();
  return fmt((en, de) => (l === "de" ? de : en), l);
}

/** A grid of squares with the first k shaded (row by row). */
function PercentGrid({ rows, cols, k }: { rows: number; cols: number; k: number }) {
  const { t } = useFmt();
  return (
    <div className="grid place-items-center py-4">
      <div
        className="grid w-full gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols * 42 }}
        role="img"
        aria-label={t(`${k} of ${rows * cols} squares shaded`, `${k} von ${rows * cols} Kästchen gefärbt`)}
      >
        {Array.from({ length: rows * cols }, (_, i) => (
          <div key={i} className="relative aspect-square rounded-[4px]" style={{ background: EMPTY }}>
            {i < k && (
              <motion.div
                className="absolute inset-0 rounded-[4px] bg-blob"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.15 + i * 0.006 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive 1: drag the rate, watch the percentage.

const BASES: { G: number; unit: Unit }[] = [
  { G: 200, unit: "€" },
  { G: 80, unit: "kg" },
  { G: 1500, unit: "m" },
  { G: 50, unit: "L" },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
        active ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Scale labels: centred on their tick, but kept inside the bar at both ends. */
const edge = (t: number) => (t === 0 ? "" : t === 100 ? "-translate-x-full" : "-translate-x-1/2");

function PercentExplorer() {
  const scope = useId();
  const { t, a } = useFmt();
  const [bi, setBi] = useState(0);
  const [p, setP] = useState(15);
  const [dragging, setDragging] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const { G, unit } = BASES[bi];
  const W = (G * p) / 100;

  const fromPointer = (clientX: number) => {
    const el = bar.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setP(Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100))));
  };

  const formula = `W#W =#e ${a(G, unit)}#G "${unit}"#u \\cdot#m \\frac{${p}#p}{100#h}#f =#e2 ${a(W, unit)}#r "${unit}"#u2`;
  const spring = { type: "spring" as const, stiffness: 320, damping: 32 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Base value G", "Grundwert G")}</span>
          {BASES.map((b, i) => (
            <Pill key={b.unit} active={bi === i} onClick={() => setBi(i)}>
              {b.G} {b.unit}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Try", "Probier")}</span>
          {[1, 10, 25, 50, 75].map((v) => (
            <Pill key={v} active={p === v} onClick={() => setP(v)}>
              {v} %
            </Pill>
          ))}
        </div>
      </div>

      <div className="grid items-center gap-6 rounded-xl border border-line bg-surface p-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="mx-auto grid w-full max-w-[200px] grid-cols-10 gap-[3px]" role="img" aria-label={t(`${p} of 100 squares shaded`, `${p} von 100 Kästchen gefärbt`)}>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i} className="relative aspect-square rounded-[3px]" style={{ background: EMPTY }}>
              <motion.div
                className="absolute inset-0 rounded-[3px] bg-blob"
                initial={false}
                animate={{ scale: i < p ? 1 : 0.3, opacity: i < p ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 34, delay: dragging ? 0 : (i < p ? i : 99 - i) * 0.003 }}
              />
            </div>
          ))}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="relative px-1 pb-9 pt-9">
            <div className="pointer-events-none absolute inset-x-1 top-0 h-6 text-[11.5px] text-ink-3">
              {[0, 25, 50, 75, 100].map((v) => (
                <span key={v} className={cn("absolute whitespace-nowrap tabular-nums", edge(v))} style={{ left: `${v}%` }}>
                  {v} %
                </span>
              ))}
            </div>
            <div
              ref={bar}
              role="slider"
              tabIndex={0}
              aria-label={t("Percent rate", "Prozentsatz")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={p}
              aria-valuetext={`${p} %`}
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
                const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
                if (!step) return;
                e.preventDefault();
                e.stopPropagation();
                setP((v) => Math.max(0, Math.min(100, v + step)));
              }}
              className="relative h-12 cursor-ew-resize touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blob/50"
              style={{ background: EMPTY }}
            >
              <motion.div className="absolute inset-y-0 left-0 rounded-xl bg-blob" initial={false} animate={{ width: `${p}%` }} transition={dragging ? { duration: 0.06 } : spring} />
              <motion.div className="absolute inset-y-[-6px] w-0" initial={false} animate={{ left: `${p}%` }} transition={dragging ? { duration: 0.06 } : spring}>
                <div className="absolute inset-y-0 left-[-3px] w-[6px] rounded-full bg-ink shadow-card" />
                <div className="absolute bottom-full left-0 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-blob px-1.5 py-0.5 font-math text-[14px] font-semibold text-white tabular-nums">
                  {p} %
                </div>
                <div className="absolute left-0 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 font-math text-[14px] text-paper tabular-nums">
                  {a(W, unit)} {unit}
                </div>
              </motion.div>
            </div>
            <div className="pointer-events-none absolute inset-x-1 bottom-0 h-5 text-[11.5px] text-ink-3">
              {[0, 50, 100].map((v) => (
                <span key={v} className={cn("absolute whitespace-nowrap tabular-nums", edge(v))} style={{ left: `${v}%` }}>
                  {a((G * v) / 100, unit)} {unit}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <MathView src={formula} size="md" scope={`${scope}-f`} highlight={["p", "r"]} />
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {t("Each small square is ", "Jedes kleine Kästchen ist ")}
            <strong className="font-semibold text-ink">1 %</strong>
            {t(
              ` of ${G} ${unit}, that is ${a(G / 100, unit)} ${unit}. So ${p} squares are ${a(W, unit)} ${unit}.`,
              ` von ${G} ${unit}, also ${a(G / 100, unit)} ${unit}. ${p === 1 ? "1 Kästchen ist" : `${p} Kästchen sind`} also ${a(W, unit)} ${unit}.`,
            )}
          </p>
        </div>
      </div>
      <p className="text-[13px] text-ink-3">{t("Drag the bar or use the arrow keys.", "Zieh am Balken oder nutze die Pfeiltasten.")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive 2: a chain of changes, each one a growth factor.

type Step = Change & { id: number };

const PRESETS: { label: Text; changes: Change[] }[] = [
  {
    label: tx("+20 %, then −20 %", "+20\u00a0%, dann −20\u00a0%"),
    changes: [
      { up: true, p: 20 },
      { up: false, p: 20 },
    ],
  },
  { label: tx("VAT +19 %", "MwSt. +19\u00a0%"), changes: [{ up: true, p: 19 }] },
  { label: tx("Sale −25 %", "Rabatt −25\u00a0%"), changes: [{ up: false, p: 25 }] },
  {
    label: tx("3 years at +5 %", "3 Jahre je +5\u00a0%"),
    changes: [
      { up: true, p: 5 },
      { up: true, p: 5 },
      { up: true, p: 5 },
    ],
  },
];

function GrowthChain() {
  const scope = useId();
  const { t, l, n, c } = useFmt();
  const [start, setStart] = useState(100);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, up: true, p: 20 },
    { id: 2, up: false, p: 20 },
  ]);
  const [nextId, setNextId] = useState(3);

  const values = steps.reduce<number[]>((list, s) => [...list, list[list.length - 1] * factorOf(s)], [start]);
  const Q = values[values.length - 1] / start;
  const maxV = Math.max(...values);
  const H = 130;
  const scale = H / maxV;
  const final = values[values.length - 1];
  const signedSum = steps.reduce((s, x) => s + (x.up ? x.p : -x.p), 0);
  const pct = r2(Math.abs(Q - 1) * 100);

  const update = (id: number, patch: Partial<Change>) => setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const load = (changes: Change[]) => {
    setSteps(changes.map((x, i) => ({ ...x, id: nextId + i })));
    setNextId((k) => k + changes.length);
  };

  const formula = `${start}#s "€"#u${steps.map((s) => ` \\cdot#t${s.id} ${n(factorOf(s))}#q${s.id}`).join("")} =#e ${c(final)}#r "€"#u2`;
  const verdict =
    Math.abs(Q - 1) < 1e-9
      ? t("Overall factor 1: back where you started.", "Gesamtfaktor 1: wieder genau am Anfang.")
      : t(
          `Overall factor ${n(r6(Q))}: the price ${Q > 1 ? "rose" : "fell"} by ${n(pct)} % in total.`,
          `Gesamtfaktor ${n(r6(Q))}: Der Preis ist insgesamt um ${n(pct)}\u00a0% ${Q > 1 ? "gestiegen" : "gesunken"}.`,
        );
  const trap =
    steps.length > 1 && signedSum === 0 && Math.abs(Q - 1) > 1e-9
      ? t(
          " The percentages add up to 0, but the price doesn't come back: each change works on a different base value.",
          " Die Prozente ergeben zusammen 0, aber der Preis kommt nicht zurück: Jede Änderung bezieht sich auf einen anderen Grundwert.",
        )
      : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Start", "Start")}</span>
          {[100, 80, 250].map((v) => (
            <Pill key={v} active={start === v} onClick={() => setStart(v)}>
              {v} €
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">{t("Try", "Probier")}</span>
          {PRESETS.map((pr, i) => (
            <Pill key={i} active={false} onClick={() => load(pr.changes)}>
              {typeof pr.label === "string" ? pr.label : pr.label[l]}
            </Pill>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="relative flex items-end gap-2 sm:gap-4" style={{ height: H + 64 }}>
          <motion.div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3/60"
            initial={false}
            animate={{ bottom: start * scale + 22 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
          <AnimatePresence initial={false}>
            {values.map((v, i) => {
              const s = i > 0 ? steps[i - 1] : null;
              return (
                <motion.div
                  key={s ? s.id : "start"}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="whitespace-nowrap font-math text-[15px] tabular-nums sm:text-[17px]">{c(v)} €</span>
                  <motion.div
                    className="w-full max-w-[72px] rounded-t-lg"
                    style={{ background: i === 0 ? "color-mix(in oklab, var(--ink-3) 45%, transparent)" : s?.up ? "var(--blob)" : "var(--blob-light)" }}
                    initial={false}
                    animate={{ height: Math.max(4, v * scale) }}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                  />
                  <span className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-3">{n(r2((v / start) * 100))} %</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="mt-4 overflow-x-auto">
          <MathView src={formula} size="md" scope={`${scope}-f`} highlight={["r"]} />
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-0.5">
                <span className="w-[70px] text-[12.5px] text-ink-2">
                  {t("Change", "Änderung")} {i + 1}
                </span>
                <div className="flex rounded-lg border border-line p-0.5">
                  {[true, false].map((up) => (
                    <button
                      key={String(up)}
                      type="button"
                      onClick={() => update(s.id, { up, p: up ? s.p : Math.min(s.p, 95) })}
                      className={cn("relative grid h-7 w-9 place-items-center rounded-md text-[16px] font-semibold", s.up === up ? "text-white" : "text-ink-2 hover:text-ink")}
                      aria-label={up ? t("Increase", "Erhöhen") : t("Decrease", "Senken")}
                    >
                      {s.up === up && <motion.span layoutId={`${scope}-sign-${s.id}`} className="absolute inset-0 rounded-md bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
                      <span className="relative">{up ? "+" : "−"}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => update(s.id, { p: Math.max(5, Math.ceil(s.p / 5) * 5 - 5) })}
                    disabled={s.p <= 5}
                    className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
                    aria-label={t("Less", "Weniger")}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-12 text-center font-math text-[17px] tabular-nums">{s.p} %</span>
                  <button
                    type="button"
                    onClick={() => update(s.id, { p: Math.min(s.up ? 100 : 95, Math.floor(s.p / 5) * 5 + 5) })}
                    disabled={s.p >= (s.up ? 100 : 95)}
                    className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
                    aria-label={t("More", "Mehr")}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <span className="font-math text-[16px] text-ink-2">→ · {n(factorOf(s))}</span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps((list) => list.filter((x) => x.id !== s.id))}
                    className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
                    aria-label={t("Remove change", "Änderung entfernen")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {steps.length < 3 && (
          <button
            type="button"
            onClick={() => {
              setSteps((list) => [...list, { id: nextId, up: true, p: 10 }]);
              setNextId((k) => k + 1);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Plus className="size-3.5" /> {t("Add a change", "Änderung hinzufügen")}
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={verdict + trap} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">{verdict}</strong>
          {trap}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson boards

const perHundredFrames: Frame[] = [
  { math: "25#p %#pc", note: tx("Percent comes from Latin **per centum**: per hundred.", "Prozent kommt vom lateinischen **pro centum**: „von Hundert“.") },
  { math: "25#p %#pc =#e1 \\frac{25#n}{100#h}#f", note: tx("So $25 %$ means $25$ out of $100$.", "$25 %$ heißt also $25$ von $100$."), highlight: ["h"] },
  {
    math: tx("25#p %#pc =#e1 \\frac{25#n}{100#h}#f =#e2 0.25#dec", "25#p %#pc =#e1 \\frac{25#n}{100#h}#f =#e2 0,25#dec"),
    note: tx("As a decimal: $25 : 100 = 0.25$. The point moves two places to the left.", "Als Dezimalzahl: $25 : 100 = 0,25$. Das Komma rückt zwei Stellen nach links."),
    highlight: ["dec"],
  },
  {
    math: tx("25#p %#pc =#e1 \\frac{25#n}{100#h}#f =#e2 0.25#dec =#e3 \\frac{1#n2}{4#d2}#f2", "25#p %#pc =#e1 \\frac{25#n}{100#h}#f =#e2 0,25#dec =#e3 \\frac{1#n2}{4#d2}#f2"),
    note: tx("Simplified, it's $\\frac{1}{4}$: a quarter. Three ways to write the same share.", "Gekürzt ist das $\\frac{1}{4}$: ein Viertel. Drei Schreibweisen für denselben Anteil."),
  },
];

const formulaFrames: Frame[] = [
  { math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f", note: tx("The basic formula of percentages: three quantities, one rule.", "Die Grundformel der Prozentrechnung: drei Größen, eine Regel.") },
  {
    math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f",
    note: tx("$G$ is the **base value** (Grundwert): the whole, $100 %$.", "$G$ ist der **Grundwert**: das Ganze, also $100 %$."),
    highlight: ["G"],
  },
  {
    math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f",
    note: tx("$p %$ is the **percent rate** (Prozentsatz): how many hundredths you take.", "$p %$ ist der **Prozentsatz**: wie viele Hundertstel du nimmst."),
    highlight: ["p", "h"],
  },
  {
    math: "W#W =#e G#G \\cdot#m \\frac{p#p}{100#h}#f",
    note: tx("$W$ is the **percentage** (Prozentwert): the part you get.", "$W$ ist der **Prozentwert**: der Teil, der dabei herauskommt."),
    highlight: ["W"],
  },
  {
    math: 'W#W =#e 200#G "€"#u \\cdot#m \\frac{15#p}{100#h}#f',
    note: tx("Example: $15 %$ of $200$ €. Put in $G = 200$ and $p = 15$.", "Beispiel: $15 %$ von $200$\u00a0€. Setze $G = 200$ und $p = 15$ ein."),
    highlight: ["G", "p"],
  },
  {
    math: tx('W#W =#e 200#G "€"#u \\cdot#m 0.15#q', 'W#W =#e 200#G "€"#u \\cdot#m 0,15#q'),
    note: tx("Write $15 %$ as a decimal: $0.15$.", "Schreib $15 %$ als Dezimalzahl: $0,15$."),
    highlight: ["q"],
  },
  {
    math: 'W#W =#e 30#G "€"#u',
    note: tx("$200 \\cdot 0.15 = 30$. So $15 %$ of $200$ € is $30$ €.", "$200 \\cdot 0,15 = 30$. Also sind $15 %$ von $200$\u00a0€ genau $30$\u00a0€."),
  },
];

const rearrangeFrames: Frame[] = [
  {
    math: "W#W =#e G#G \\cdot#m p#p %#pc",
    note: tx("Short form: $W = G \\cdot p %$, with $p %$ written as a decimal.", "Kurzform: $W = G \\cdot p %$, dabei schreibst du $p %$ als Dezimalzahl."),
  },
  {
    math: "\\frac{W#W}{G#G}#f =#e p#p %#pc",
    note: tx("To find the **rate**, divide both sides by $G$.", "Für den **Prozentsatz** teilst du beide Seiten durch $G$."),
    highlight: ["G"],
  },
  { math: "p#p %#pc =#e \\frac{W#W}{G#G}#f", note: tx("Rate = part divided by whole.", "Prozentsatz = Prozentwert geteilt durch Grundwert.") },
  {
    math: "p#p %#pc =#e \\frac{12#W}{30#G}#f",
    note: tx("Example: $12$ of $30$ students are in a club.", "Beispiel: $12$ von $30$ Schülerinnen und Schülern sind in einer AG."),
  },
  { math: tx("p#p %#pc =#e 0.4#v", "p#p %#pc =#e 0,4#v"), note: tx("$12 : 30 = 0.4$.", "$12 : 30 = 0,4$.") },
  {
    math: "p#p %#pc =#e 40#v %#pc2",
    note: tx("$0.4 = 40 %$. Move the point two places to the right.", "$0,4 = 40 %$. Das Komma rückt zwei Stellen nach rechts."),
  },
  {
    math: "G#G =#e \\frac{W#W}{p#p %#pc}#f",
    note: tx("To find the **base value**, divide $W$ by the rate instead.", "Für den **Grundwert** teilst du stattdessen $W$ durch den Prozentsatz."),
    highlight: ["G"],
  },
  {
    math: tx('G#G =#e \\frac{30#W "€"#u}{0.2#p}#f', 'G#G =#e \\frac{30#W "€"#u}{0,2#p}#f'),
    note: tx("Example: $30$ € are $20 %$ of a price. $20 % = 0.2$.", "Beispiel: $30$\u00a0€ sind $20 %$ eines Preises. $20 % = 0,2$."),
  },
  {
    math: 'G#G =#e 150#W "€"#u',
    note: tx("$30 : 0.2 = 150$. The full price is $150$ €.", "$30 : 0,2 = 150$. Der volle Preis ist $150$\u00a0€."),
  },
];

const factorFrames: Frame[] = [
  {
    math: "100#a %#ap +#pl 19#b %#bp =#e 119#c %#cp",
    note: tx("VAT (Mehrwertsteuer) adds $19 %$. The new price is $119 %$ of the old one.", "Die Mehrwertsteuer schlägt $19 %$ auf. Der neue Preis ist $119 %$ des alten."),
  },
  {
    math: tx("q#q =#e 119#c %#cp =#e2 1.19#f", "q#q =#e 119#c %#cp =#e2 1,19#f"),
    note: tx("As a decimal, that's the **growth factor** $q = 1.19$ (Wachstumsfaktor).", "Als Dezimalzahl ist das der **Wachstumsfaktor** $q = 1,19$."),
    highlight: ["f"],
  },
  {
    math: tx('120#G "€"#u \\cdot#t 1.19#f =#e3 142.80#r "€"#u2', '120#G "€"#u \\cdot#t 1,19#f =#e3 142,80#r "€"#u2'),
    note: tx("One multiplication does it all: $120 \\cdot 1.19 = 142.80$ €.", "Eine einzige Multiplikation erledigt alles: $120 \\cdot 1,19 = 142,80$\u00a0€."),
    highlight: ["r"],
  },
  {
    math: "100#a %#ap -#mi 20#b %#bp =#e 80#c %#cp",
    note: tx("A discount works the same way. $20 %$ off leaves $80 %$.", "Ein Rabatt funktioniert genauso. Bei $20 %$ Rabatt bleiben $80 %$."),
  },
  {
    math: tx("q#q =#e 80#c %#cp =#e2 0.8#f", "q#q =#e 80#c %#cp =#e2 0,8#f"),
    note: tx("Growth factor $q = 0.8$. Smaller than $1$: the value shrinks.", "Wachstumsfaktor $q = 0,8$. Kleiner als $1$: Der Wert schrumpft."),
    highlight: ["f"],
  },
  {
    math: tx('120#G "€"#u \\cdot#t 0.8#f =#e3 96#r "€"#u2', '120#G "€"#u \\cdot#t 0,8#f =#e3 96#r "€"#u2'),
    note: tx("$120 \\cdot 0.8 = 96$ €.", "$120 \\cdot 0,8 = 96$ €."),
    highlight: ["r"],
  },
];

const reverseLesson: Frame[] = [
  ...reverseFrames(64, 20, false, "€"),
  {
    math: tx(
      '\\red{64#m1 "€"#m2 \\cdot#m3 1.2#m4 =#m5 76.80#m6 "€"#m7} \\ne#ne 80#W "€"#u',
      '\\red{64#m1 "€"#m2 \\cdot#m3 1,2#m4 =#m5 76,80#m6 "€"#m7} \\ne#ne 80#W "€"#u',
    ),
    note: tx(
      "Classic mistake: adding $20 %$ to $64$ € gives $76.80$ €, not $80$ €. The $20 %$ belonged to the **old** price, not the new one.",
      "Typischer Fehler: $20 %$ auf $64$\u00a0€ draufrechnen ergibt $76,80$\u00a0€, nicht $80$\u00a0€. Die $20 %$ gehören zum **alten** Preis, nicht zum neuen.",
    ),
  },
];
reverseLesson[0] = {
  ...reverseLesson[0],
  note: tx(
    "After $20 %$ off, a jacket costs $64$ €. So the old price $G$ times $0.8$ gives $64$ €.",
    "Nach $20 %$ Rabatt kostet eine Jacke $64$\u00a0€. Der alte Preis $G$ mal $0,8$ ergibt also $64$\u00a0€.",
  ),
};

const pointsFrames: Frame[] = [
  {
    math: "2#a %#ap \\to#to 3#b %#bp",
    note: tx("A bank raises its interest rate from $2 %$ to $3 %$. How big is the rise?", "Eine Bank erhöht ihren Zinssatz von $2 %$ auf $3 %$. Wie groß ist der Anstieg?"),
  },
  {
    math: tx('3#b %#bp -#m 2#a %#ap =#e 1#c "percentage point"#pp', '3#b %#bp -#m 2#a %#ap =#e 1#c "Prozentpunkt"#pp'),
    note: tx(
      "The difference of two percentages is measured in **percentage points** (Prozentpunkte): $1$ point.",
      "Die Differenz zweier Prozentsätze misst man in **Prozentpunkten**: Hier ist es $1$ Prozentpunkt.",
    ),
  },
  {
    math: tx("\\frac{1#c}{2#a}#f =#e 0.5#h =#e2 50#r %#rp", "\\frac{1#c}{2#a}#f =#e 0,5#h =#e2 50#r %#rp"),
    note: tx(
      "But compared with the old rate, $1$ is half of $2$. In percent, the rate rose by $50 %$!",
      "Aber im Vergleich zum alten Zinssatz ist $1$ die Hälfte von $2$. In Prozent ist der Zinssatz um $50 %$ gestiegen!",
    ),
    highlight: ["r"],
  },
];

// ---------------------------------------------------------------------------

const PER_HUNDRED = tx("Percent means per hundred", "Prozent heißt „von Hundert“");
const POINTS_TITLE = tx("Percent or percentage points?", "Prozent oder Prozentpunkte?");

const percentages: Topic = {
  ...topicMeta("percentages"),
  summary: [
    {
      title: PER_HUNDRED,
      body: tx("Fractions, decimals and percentages are three ways to write the same share.", "Brüche, Dezimalzahlen und Prozente sind drei Schreibweisen für denselben Anteil."),
      examples: [tx("25 % = \\frac{25}{100} = 0.25", "25 % = \\frac{25}{100} = 0,25"), "50 % = \\frac{1}{2} ,\\quad 10 % = \\frac{1}{10} ,\\quad 1 % = \\frac{1}{100}"],
      tone: "rule",
    },
    {
      title: tx("Base value, percentage, rate", "Grundwert, Prozentwert, Prozentsatz"),
      body: tx(
        "$G$ is the whole (Grundwert), $W$ the part (Prozentwert), $p %$ the rate (Prozentsatz).",
        "$G$ ist das Ganze (Grundwert), $W$ der Teil (Prozentwert), $p %$ der Anteil in Prozent (Prozentsatz).",
      ),
      examples: ["W = G \\cdot \\frac{p}{100}", "p % = \\frac{W}{G}", "G = \\frac{W}{p %}"],
      tone: "rule",
    },
    {
      title: tx("Growth factor", "Wachstumsfaktor"),
      body: tx(
        "A rise of $p %$: multiply by $1 + \\frac{p}{100}$. A drop of $p %$: multiply by $1 - \\frac{p}{100}$.",
        "Zunahme um $p %$: mit $1 + \\frac{p}{100}$ multiplizieren. Abnahme um $p %$: mit $1 - \\frac{p}{100}$ multiplizieren.",
      ),
      examples: [tx('120 "€" \\cdot 1.19 = 142.80 "€"', '120 "€" \\cdot 1,19 = 142,80 "€"'), tx('120 "€" \\cdot 0.8 = 96 "€"', '120 "€" \\cdot 0,8 = 96 "€"')],
      tone: "rule",
    },
    {
      title: tx("Back to the original", "Zurück zum Ausgangswert"),
      body: tx(
        "To undo a change, divide by the growth factor. Several changes: multiply all their factors.",
        "Eine Änderung machst du rückgängig, indem du durch den Wachstumsfaktor teilst. Mehrere Änderungen: alle Faktoren multiplizieren.",
      ),
      examples: [tx("G \\cdot 0.8 = 64 \\Rightarrow G = 64 : 0.8 = 80", "G \\cdot 0,8 = 64 \\Rightarrow G = 64 : 0,8 = 80"), tx("1.2 \\cdot 0.8 = 0.96", "1,2 \\cdot 0,8 = 0,96")],
      tone: "tip",
    },
    {
      title: POINTS_TITLE,
      body: tx(
        "$+20 %$ then $-20 %$ is **not** back to the start. And from $2 %$ to $3 %$ is $1$ percentage point, but $50 %$ more.",
        "$+20 %$ und dann $-20 %$ führt **nicht** zurück zum Anfang. Und von $2 %$ auf $3 %$ ist $1$ Prozentpunkt, aber $50 %$ mehr.",
      ),
      examples: [tx('3 % - 2 % = 1 "percentage point"', '3 % - 2 % = 1 "Prozentpunkt"'), "\\frac{1}{2} = 50 %"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: PER_HUNDRED,
      blob: tx("Percent is everywhere: sales, phone batteries, test results. Let's crack it!", "Prozente sind überall: Rabatte, Handyakku, Testergebnisse. Packen wir's an!"),
      body: tx(
        "Percentages make shares easy to compare, because everything is measured out of $100$.\n\nWorth knowing by heart: $50 % = \\frac{1}{2}$, $25 % = \\frac{1}{4}$, $20 % = \\frac{1}{5}$, $10 % = \\frac{1}{10}$, $1 % = \\frac{1}{100}$.",
        "Mit Prozenten lassen sich Anteile leicht vergleichen, weil sich alles auf $100$ bezieht.\n\nDas solltest du auswendig wissen: $50 % = \\frac{1}{2}$, $25 % = \\frac{1}{4}$, $20 % = \\frac{1}{5}$, $10 % = \\frac{1}{10}$, $1 % = \\frac{1}{100}$.",
      ),
      frames: perHundredFrames,
    },
    {
      type: "explain",
      title: tx("Base value, percentage and rate", "Grundwert, Prozentwert und Prozentsatz"),
      blob: tx("Three quantities, one formula. Know which is which and you've won!", "Drei Größen, eine Formel. Wenn du sie auseinanderhalten kannst, hast du gewonnen!"),
      body: tx(
        "Every percentage problem is about a whole, a part, and the rate that connects them.",
        "Bei jeder Prozentaufgabe geht es um ein Ganzes, einen Teil und den Prozentsatz, der beide verbindet.",
      ),
      frames: formulaFrames,
    },
    {
      type: "widget",
      title: tx("Drag the rate", "Zieh am Prozentsatz"),
      blob: tx("Drag the bar and watch the squares fill up. Each one is one percent!", "Zieh am Balken und schau, wie sich die Kästchen füllen. Jedes ist ein Prozent!"),
      body: tx(
        "The hundred square is the base value $G$, cut into $100$ equal pieces. Choose $G$, drag the rate and watch the percentage $W$.",
        "Das Hunderterfeld ist der Grundwert $G$, aufgeteilt in $100$ gleich große Kästchen. Wähle $G$, zieh am Prozentsatz und beobachte den Prozentwert $W$.",
      ),
      widget: PercentExplorer,
    },
    {
      type: "check",
      blob: tx("Your turn! Rate as a decimal, then multiply.", "Du bist dran! Prozentsatz als Dezimalzahl, dann multiplizieren."),
      exercise: {
        instruction: CALCULATE,
        math: OF('18 % "of" 250 "€"'),
        answer: amount(45, "€"),
        hint: tx("$18 % = 0.18$. Then $250 \\cdot 0.18$.", "$18 % = 0,18$. Dann $250 \\cdot 0,18$."),
        solution: findWFrames(18, 250, "€"),
        mistakes: mistakesFor(amount(45, "€"), wSlips(18, 250, "€")),
      },
    },
    {
      type: "explain",
      title: tx("Finding the rate or the base value", "Prozentsatz oder Grundwert berechnen"),
      blob: tx("Same formula, just turned around. Watch the letters move!", "Gleiche Formel, nur umgestellt. Schau, wie die Buchstaben wandern!"),
      body: tx(
        "Prefer the rule of three (Dreisatz)? For the base value: $20 % \\to 30$ €, so $1 % \\to 1.50$ € and $100 % \\to 150$ €. Same answer.",
        "Lieber mit dem Dreisatz? Für den Grundwert: $20 % \\to 30$\u00a0€, also $1 % \\to 1,50$\u00a0€ und $100 % \\to 150$\u00a0€. Gleiches Ergebnis.",
      ),
      frames: rearrangeFrames,
    },
    {
      type: "check",
      blob: tx("Part divided by whole. You've got this!", "Teil durch Ganzes. Das schaffst du!"),
      exercise: {
        instruction: WORD_PROBLEM,
        text: tx(
          "In class 9a, 7 of the 28 students wear glasses. What percentage is that?",
          "In der Klasse 9a tragen 7 von 28 Schülerinnen und Schülern eine Brille. Wie viel Prozent sind das?",
        ),
        answer: rateAnswer(25),
        hint: tx(
          "$p % = \\frac{W}{G} = \\frac{7}{28}$. Then turn the decimal into a percentage.",
          "$p % = \\frac{W}{G} = \\frac{7}{28}$. Dann die Dezimalzahl in Prozent umwandeln.",
        ),
        solution: findPFrames(7, 28),
        mistakes: mistakesFor(rateAnswer(25), pSlips(7, 28, 25, true)),
      },
    },
    {
      type: "explain",
      title: tx("Increase and decrease: the growth factor", "Zu- und Abnahme: der Wachstumsfaktor"),
      blob: tx("This trick saves so much time: one multiplication instead of two steps!", "Dieser Trick spart richtig Zeit: eine Multiplikation statt zwei Schritte!"),
      body: tx(
        "You could work out $19 %$ and add it on. Faster: multiply by the **growth factor** right away.",
        "Du könntest $19 %$ ausrechnen und dazuzählen. Schneller geht's: Multipliziere gleich mit dem **Wachstumsfaktor**.",
      ),
      frames: factorFrames,
    },
    {
      type: "widget",
      title: tx("One change after another", "Eine Änderung nach der anderen"),
      blob: tx("Up 20 %, then down 20 %. Back to the start? Let's see!", "Erst 20\u00a0% rauf, dann 20\u00a0% runter. Wieder am Anfang? Mal sehen!"),
      body: tx(
        "Every change is one growth factor. Several changes in a row: multiply the factors. Change the steps, or try the examples.",
        "Jede Änderung ist ein Wachstumsfaktor. Mehrere Änderungen nacheinander: Faktoren multiplizieren. Ändere die Schritte oder probier die Beispiele aus.",
      ),
      widget: GrowthChain,
    },
    {
      type: "check",
      blob: tx("15 % off. What's left, as a factor?", "15\u00a0% Rabatt. Was bleibt übrig, als Faktor?"),
      exercise: {
        instruction: WORD_PROBLEM,
        text: tx(
          "A bike costs 480 €. In the sale, the price is reduced by 15 %. What is the sale price?",
          "Ein Fahrrad kostet 480\u00a0€. Im Schlussverkauf wird der Preis um 15\u00a0% reduziert. Wie viel kostet es jetzt?",
        ),
        answer: amount(408, "€"),
        hint: tx("$15 %$ off leaves $85 %$. Multiply by $0.85$.", "Bei $15 %$ Rabatt bleiben $85 %$. Multipliziere mit $0,85$."),
        solution: changeFrames(480, 15, false, "€"),
        mistakes: mistakesFor(amount(408, "€"), changeSlips(480, 15, false, "€")),
      },
    },
    {
      type: "explain",
      title: tx("Back to the original price", "Zurück zum ursprünglichen Preis"),
      blob: tx("Going backwards is where most people slip. Not you, though!", "Beim Rückwärtsrechnen stolpern die meisten. Du aber nicht!"),
      body: tx(
        "If you know the price **after** a change, divide by the growth factor to get the price before.",
        "Kennst du den Preis **nach** einer Änderung, teilst du durch den Wachstumsfaktor. So bekommst du den Preis vorher.",
      ),
      frames: reverseLesson,
    },
    {
      type: "check",
      blob: tx("Price after a rise. Divide, don't subtract!", "Preis nach einer Erhöhung. Teilen, nicht abziehen!"),
      exercise: {
        instruction: WORD_PROBLEM,
        text: tx(
          "After a price rise of 25 %, a video game costs 60 €. What did it cost before?",
          "Nach einer Preiserhöhung um 25\u00a0% kostet ein Videospiel 60\u00a0€. Wie viel hat es vorher gekostet?",
        ),
        answer: amount(48, "€"),
        hint: tx("The new price is $125 %$ of the old one: $G \\cdot 1.25 = 60$.", "Der neue Preis ist $125 %$ des alten: $G \\cdot 1,25 = 60$."),
        solution: reverseFrames(60, 25, true, "€"),
        mistakes: mistakesFor(amount(48, "€"), reverseSlips(60, 25, true)),
      },
    },
    {
      type: "explain",
      title: POINTS_TITLE,
      blob: tx("Last one: a trap even the news falls into!", "Zum Schluss: eine Falle, in die sogar die Nachrichten tappen!"),
      body: tx(
        "When a percentage itself changes, there are two ways to describe it. Both are correct, but they mean different things.",
        "Wenn sich ein Prozentsatz selbst ändert, kann man das auf zwei Arten beschreiben. Beide sind richtig, meinen aber Verschiedenes.",
      ),
      frames: pointsFrames,
    },
  ],
  generate,
};

export default percentages;
