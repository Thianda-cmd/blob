"use client";

// Shared by the three percentage levels: numbers in both languages, answers, typical-mistake helpers,
// growth factors and small widget parts.

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, txMap, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Numbers

export const r2 = (v: number) => Math.round(v * 100) / 100;
export const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** "0.15", "297.5", "1500" */
export const num = (v: number) => String(r6(v));
/** Money: "60" or "297.50". */
export const cash = (v: number) => (Number.isInteger(r2(v)) ? String(r2(v)) : r2(v).toFixed(2));

/** Units of the quantities in the tasks. Word units get a German name. */
export type Unit = "" | "€" | "kg" | "m" | "L" | "g" | "km" | "mg" | "students" | "members" | "pages" | "inhabitants" | "years" | "months" | "days" | "hours" | "minutes";
const UNIT_DE: Partial<Record<Unit, string>> = {
  students: "Schüler",
  members: "Mitglieder",
  pages: "Seiten",
  inhabitants: "Einwohner",
  years: "Jahre",
  months: "Monate",
  days: "Tage",
  hours: "Stunden",
  minutes: "Minuten",
};
const unitName = (unit: Unit, l: Locale) => (l === "de" ? (UNIT_DE[unit] ?? unit) : unit);
export const unitText = (unit: Unit): Text => {
  const de = UNIT_DE[unit];
  return de ? tx(unit, de) : unit;
};

/** Number formatting and wording for one language: decimal comma and German unit names in German. */
export type Fmt = {
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
  /** A number in a story sentence; German prose groups 5+ digits with a dot (I18N.md): "25.000". 4 digits stay "2500", as everywhere in the maths. */
  big: (s: string) => string;
};

export function fmt(t: Fmt["t"], l: Locale): Fmt {
  const comma = (s: string) => (l === "de" ? s.replace(".", ",") : s);
  return {
    t,
    l,
    n: (v) => comma(num(v)),
    c: (v) => comma(cash(v)),
    a: (v, unit) => comma(unit === "€" ? cash(v) : num(v)),
    ut: (unit, key) => (unit ? ` "${unitName(unit, l)}"#${key}` : ""),
    uw: (unit) => (unit ? `${l === "de" ? "\u00a0" : " "}${unitName(unit, l)}` : ""),
    big: (s) => (l === "de" && /^\d{5,}/.test(s) ? comma(s).replace(/^\d+/, (d) => d.replace(/\B(?=(\d{3})+$)/g, ".")) : comma(s)),
  };
}

/** Money in a sentence: "297.50 €" / "297,50 €" (German keeps the unit on the same line). */
export const euro = (f: Fmt, v: number) => `${f.big(cash(v))}${f.l === "de" ? "\u00a0" : " "}€`;
/** Money with both cents shown, as on an invoice: "250.00" / "250,00". */
export const cents2 = (f: Fmt, v: number) => (f.l === "de" ? r2(v).toFixed(2).replace(".", ",") : r2(v).toFixed(2));
/** A rate in a sentence: "2.5 %" / "2,5 %". */
export const perc = (f: Fmt, p: number) => `${f.n(p)}${f.l === "de" ? "\u00a0" : " "}%`;

/** Builds a text in both languages from one template function. */
export const say = (build: (f: Fmt) => string): Text => txMap((t, l) => build(fmt(t, l)));

/** Money answers accept one cent either way; everything else must be exact. */
export function amount(v: number, unit: Unit, label?: string): AnswerSpec {
  const value = unit === "€" ? r2(v) : r6(v);
  return {
    kind: "number",
    value,
    unit: unitText(unit),
    ...(label ? { label } : {}),
    ...(unit === "€" ? { tolerance: 0.0101 / Math.max(1, Math.abs(value)) } : {}),
  };
}
export const rateAnswer = (p: number, label?: string): AnswerSpec => ({ kind: "number", value: r6(p), unit: "%", ...(label ? { label } : {}) });

// ---------------------------------------------------------------------------
// Growth factors

export type Change = { up: boolean; p: number };
export const factorOf = (c: Change) => 1 + (c.up ? c.p : -c.p) / 100;

/** A change by p %: growth factor q, new value G · q. */
export function changeFrames(G: number, p: number, up: boolean, unit: Unit): Frame[] {
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
export function reverseFrames(N: number, p: number, up: boolean, unit: Unit): Frame[] {
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

// ---------------------------------------------------------------------------
// Exercise generator

export type Gen = (rng: Rng) => Exercise | null;

export function pickWeighted(rng: Rng, list: [number, Gen][]): Gen {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, g] of list) {
    r -= w;
    if (r < 0) return g;
  }
  return list[list.length - 1][1];
}

/** Draws tasks until one has friendly numbers (a generator returns null to reject its draw). */
export function findTask(rng: Rng, list: [number, Gen][], fallback: () => Exercise): Exercise {
  for (let tries = 0; tries < 80; tries++) {
    const ex = pickWeighted(rng, list)(rng);
    if (ex) return ex;
  }
  return fallback();
}

export const CALCULATE = tx("Calculate", "Berechne");
export const WORD_PROBLEM = tx("Word problem", "Textaufgabe");

// ---------------------------------------------------------------------------
// Typical mistakes. Each one is simulated from the task's numbers, so the wrong
// value is exactly what a student with that misconception gets.

/** A misconception: the (unrounded) value it leads to, a title, what Blob says, and an absolute `tol` when students usually round that value. */
export type Slip = [value: number, title: Text, say: Text, tol?: number] | null | false;
type NumberSpec = Extract<AnswerSpec, { kind: "number" }>;

/** How far a typed number may be from `v`: cents for money, whole numbers when the answer is rounded, else rounding of long decimals. */
function slack(v: number, answer: NumberSpec): number {
  if (answer.unit === "€") return 0.0101;
  if ((answer.tolerance ?? 0) * Math.max(1, Math.abs(answer.value)) >= 1) return 1.01;
  return Math.abs(r2(v) - v) < 1e-9 ? 0 : Math.min(0.051, Math.abs(v) * 0.005);
}

/** The slips as Mistakes for a number answer: only those clearly apart from the right value and from each other. */
export function mistakesFor(answer: AnswerSpec, slips: Slip[]): Mistake[] {
  if (answer.kind !== "number") return [];
  const taken: [number, number][] = [[answer.value, slack(answer.value, answer)]];
  const out: Mistake[] = [];
  for (const s of slips) {
    if (!s) continue;
    const [raw, title, say, own] = s;
    if (!Number.isFinite(raw) || raw < 0) continue;
    const value = answer.unit === "€" ? r2(raw) : slack(raw, answer) >= 1 ? Math.round(raw) : r6(raw);
    const tol = own ?? slack(value, answer);
    if (taken.some(([v, t]) => Math.abs(v - value) <= t + tol + 1e-9)) continue;
    taken.push([value, tol]);
    const when: NumberSpec = { kind: "number", value, ...(answer.unit ? { unit: answer.unit } : {}), ...(tol ? { tolerance: tol / Math.max(1, Math.abs(value)) } : {}) };
    out.push({ when, title, say });
  }
  return out;
}

/** An amount in a sentence: "$45$ €", "$300$ g", "$24$ Schüler". */
export const amt = (f: Fmt, v: number, unit: Unit) => `$${f.a(v, unit)}$${f.uw(unit)}`;

export const FACTOR_OFF = tx("Growth factor off", "Wachstumsfaktor falsch");
/** "1.5 instead of 1.05": a rate below 10 % written with one zero too few. */
export const factorOff = (p: number, up: boolean) =>
  say(({ t, n }) =>
    t(
      `So close! For ${up ? "a rise" : "a drop"} of $${n(p)} %$ the growth factor is $${n(1 + (up ? p : -p) / 100)}$, not $${n(1 + (up ? p : -p) / 10)}$: percent means **hundredths**.`,
      `Ganz knapp! Bei ${up ? "einer Zunahme" : "einer Abnahme"} um $${n(p)} %$ ist der Wachstumsfaktor $${n(1 + (up ? p : -p) / 100)}$, nicht $${n(1 + (up ? p : -p) / 10)}$: Prozent heißt **Hundertstel**.`,
    ),
  );

/** A rise or drop by p %: new value G · (1 ± p/100). */
export function changeSlips(G: number, p: number, up: boolean, unit: Unit, vat = false): Slip[] {
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
export function reverseSlips(N: number, p: number, up: boolean, vat = false): Slip[] {
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

// ---------------------------------------------------------------------------
// Widgets

export const EMPTY = "color-mix(in oklab, var(--ink) 8%, transparent)";

/** Number formatting and wording for the widgets in the current language. */
export function useFmt(): Fmt {
  const l = useLocale();
  return fmt((en, de) => (l === "de" ? de : en), l);
}

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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

/** Two or three choices in one row (days or months, linear or not…). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("relative h-7 rounded-md px-2.5 text-[13px] font-medium", value === o.value ? "text-white" : "text-ink-2 hover:text-ink")}
        >
          {value === o.value && <motion.span layoutId={`${id}-seg`} className="absolute inset-0 rounded-md bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
