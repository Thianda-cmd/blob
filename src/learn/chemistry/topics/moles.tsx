"use client";

import type { Locale } from "@/i18n/config";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import { ceEquation } from "../balancing-core";
import { element } from "../elements";
import { molarMass, parseFormula } from "../formula";
import { answerTolerance, elementsOf, fx, M, massSum, NA, PARTICLES, roundText, roundTo, sci, sig3, substance, SUBSTANCES, tolerance, type Substance } from "../moles-core";
import { visual } from "../visuals/AtomsVisuals";
import { MolesCounter } from "../visuals/MolesCounter";
import { MolesMassTable } from "../visuals/MolesMassTable";

// ---------------------------------------------------------------------------
// Helpers

const ce = (f: string) => `\\ce{${f}}`;
const nameOf = (s: Substance, l: Locale) => resolveText(s.name, l);
/** Name with the formula: "Natriumchlorid ($\ce{NaCl}$)". */
const named = (s: Substance, l: Locale) => `${nameOf(s, l)} ($${ce(s.f)}$)`;
const isExact = (v: number, d: number) => Math.abs(v - roundTo(v, d)) < 1e-9;
/** "=" when the shown number is exact, "≈" otherwise. */
const eq = (v: number, d: number) => (isExact(v, d) ? "=" : "\\approx");
/** Decimals for an intermediate result: four significant figures. */
const d4 = (v: number) => Math.max(0, Math.min(5, 3 - Math.floor(Math.log10(Math.abs(v) || 1))));
/** Number in one language, keeping up to `d` decimals but dropping trailing zeros (given quantities). */
const given = (v: number, l: Locale, d = 3) => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: d, useGrouping: false }).format(v);

const chips = (f: string | string[]) => visual(MolesMassTable, { symbols: [...new Set((Array.isArray(f) ? f : [f]).flatMap(elementsOf))] });

type Num = Extract<AnswerSpec, { kind: "number" }>;

function answer(value: number, d: number, unit: string, label: string): Num {
  const v = roundTo(value, d);
  return { kind: "number", value: v, tolerance: answerTolerance(v, d), unit, label };
}

/** Rounding instruction, left out when the answer comes out exact. */
const rounding = (value: number, d: number, grams = false): Text => (isExact(value, d) ? tx("", "") : roundText(d, grams));

/** Typical wrong results, kept only when clearly apart from the answer and from each other. */
function mistakes(right: Num) {
  const list: Mistake[] = [];
  const rightAbs = (right.tolerance ?? 0) * Math.max(1, Math.abs(right.value));
  const add = (raw: number, title: Text, say: Text, close = false) => {
    if (!Number.isFinite(raw) || raw < 1e-6) return;
    const v = roundTo(raw, Math.max(0, 3 - Math.floor(Math.log10(raw))));
    const abs = 0.012 * v;
    if (Math.abs(v - right.value) <= rightAbs + abs) return;
    if (list.some((m) => m.when.kind === "number" && Math.abs(m.when.value - v) <= 0.012 * Math.max(v, m.when.value))) return;
    list.push({ when: { kind: "number", value: v, tolerance: tolerance(v, abs), unit: right.unit }, title, say, ...(close ? { close: true } : {}) });
  };
  return { list, add };
}

/** Options with the right one first, shuffled; wrong options with `say` become mistakes. */
type Opt = { text: Text; title?: Text; say?: Text };
function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

/** Frames: the molar mass as a sum of atomic masses (a hydrate first as salt + water). */
function massFrames(f: string, note?: Text): Frame[] {
  const m = M(f);
  const fallback = tx("First the molar mass: add up the atomic masses from the periodic table.", "Zuerst die molare Masse: Addiere die Atommassen aus dem Periodensystem.");
  const hyd = f.match(/^(.+)\*(\d+)H2O$/);
  if (hyd) {
    const [, base, k] = hyd;
    const exact = (x: string) => {
      const p = parseFormula(x);
      return p.ok ? molarMass(p.species.counts) : 0;
    };
    return [
      { math: `\\group{M(${ce(f)})} = \\group{M(${ce(base)})} + ${k} \\cdot \\group{M(\\ce{H2O})}`, note: tx(`A hydrate: the salt plus ${k} water molecules of crystallisation.`, `Ein Hydrat: das Salz plus ${k} Moleküle Kristallwasser.`) },
      {
        math: txMap((_, l) => `\\group{M(${ce(f)})} = \\group{${fx(exact(base), l, 3)} "g/mol"} + ${k} \\cdot \\group{${fx(exact("H2O"), l, 3)} "g/mol"} \\approx \\group{${fx(m, l, 2)} "g/mol"}`),
        note: note ?? fallback,
      },
    ];
  }
  return [
    {
      math: txMap((_, l) => {
        const sum = massSum(f, l, true);
        const single = !/[+\\]/.test(sum);
        return single ? `\\group{M(${ce(f)})} = ${sum}` : `\\group{M(${ce(f)})} = ${sum} \\approx \\group{${fx(m, l, 2)} "g/mol"}`;
      }),
      note: note ?? fallback,
    },
  ];
}

// ---------------------------------------------------------------------------
// Wrong molar masses a student with a typical misconception would get

type WrongM = { v: number; title: Text; say: Text; close?: boolean };

function wrongMolarMasses(f: string): WrongM[] {
  const out: WrongM[] = [];
  const right = M(f);
  const p = parseFormula(f);
  if (!p.ok) return out;
  const counts = p.species.counts;
  const mm = (formula: string) => {
    const q = parseFormula(formula);
    return q.ok ? Math.round(molarMass(q.species.counts) * 100) / 100 : NaN;
  };
  const push = (v: number, title: Text, say: Text, close = false) => {
    if (!Number.isFinite(v) || Math.abs(v - right) < 0.5 || out.some((w) => Math.abs(w.v - v) < 0.05)) return;
    out.push({ v, title, say, close });
  };
  const bracket = f.match(/\(([A-Za-z0-9]+)\)(\d+)/);
  const hydrate = f.match(/^(.+)\*(\d+)H2O$/);
  if (bracket) {
    const k = bracket[2];
    push(
      mm(f.replace(bracket[0], bracket[1])),
      tx("Bracket factor missed", "Faktor hinter der Klammer"),
      tx(`The ${k} after the bracket counts for the **whole** group: every atom inside the bracket is there ${k} times.`, `Die ${k} hinter der Klammer gilt für die **ganze** Gruppe: Jedes Atom in der Klammer ist ${k}-mal da.`),
    );
    if (/[A-Za-z]$/.test(bracket[1]))
      push(
        mm(f.replace(bracket[0], `${bracket[1]}${k}`)),
        tx("Only the last atom multiplied", "Nur das letzte Atom vervielfacht"),
        tx(`I think you multiplied only the last atom by ${k}. The bracket means: the whole group $${ce(bracket[1])}$ is there ${k} times.`, `Ich glaub, du hast nur das letzte Atom mal ${k} genommen. Die Klammer heißt: Die ganze Gruppe $${ce(bracket[1])}$ ist ${k}-mal da.`),
      );
  }
  if (hydrate) {
    const k = hydrate[2];
    push(
      M(hydrate[1]),
      tx("Water of crystallisation forgotten", "Kristallwasser vergessen"),
      tx(`The dot in the formula means: ${k} water molecules belong to each formula unit. Their mass counts too.`, `Der Punkt in der Formel heißt: Zu jeder Formeleinheit gehören ${k} Wassermoleküle. Ihre Masse zählt mit.`),
    );
    push(
      mm(`${hydrate[1]}*H2O`),
      tx("Only one water molecule", "Nur ein Wassermolekül"),
      tx(`The ${k} in front of $\\ce{H2O}$ counts for the whole water molecule: ${k} times the mass of water.`, `Die ${k} vor $\\ce{H2O}$ gilt für das ganze Wassermolekül: ${k}-mal die Masse von Wasser.`),
    );
  }
  // Every element counted once.
  push(
    roundTo(Object.keys(counts).reduce((s, el) => s + element(el)!.mass, 0), 2),
    tx("Indices forgotten", "Indizes vergessen"),
    tx("I think you counted each kind of atom only **once**. The small numbers (indices) say how often an atom appears, and each one adds its mass again.", "Ich glaub, du hast jede Atomsorte nur **einmal** gezählt. Die kleinen Zahlen (Indizes) sagen, wie oft ein Atom vorkommt, und jedes bringt seine Masse mit."),
  );
  // Atomic numbers instead of atomic masses.
  push(
    Object.entries(counts).reduce((s, [el, n]) => s + element(el)!.z * n, 0),
    tx("Atomic number taken", "Ordnungszahl erwischt"),
    tx("You added the **atomic numbers**. For the molar mass you need the atomic masses (the number in u in the periodic table).", "Du hast die **Ordnungszahlen** addiert. Für die molare Masse brauchst du die Atommassen (die Zahl in u im Periodensystem)."),
  );
  // An index read as belonging to the next symbol (H2O as H O2).
  if (!bracket && !hydrate) {
    const tokens = [...f.matchAll(/([A-Z][a-z]?)(\d*)/g)].map((m) => ({ el: m[1], n: m[2] ? Number(m[2]) : 1 }));
    const first = tokens.findIndex((t, i) => t.n > 1 && i < tokens.length - 1);
    if (first >= 0) {
      const shifted = tokens.reduce((s, t, i) => s + element(t.el)!.mass * (i === 0 ? 1 : tokens[i - 1].n), 0);
      push(
        roundTo(shifted, 2),
        tx("Index on the wrong atom", "Index beim falschen Atom"),
        tx(`Careful: an index always belongs to the symbol **right in front** of it. In $${ce(f)}$ the ${tokens[first].n} belongs to ${tokens[first].el}.`, `Vorsicht: Ein Index gehört immer zum Symbol **direkt davor**. In $${ce(f)}$ gehört die ${tokens[first].n} zum ${tokens[first].el}.`),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Molar mass

function molarMassExercise(s: Substance): Exercise {
  const right = answer(M(s.f), 2, "g/mol", "M =");
  const m = mistakes(right);
  for (const w of wrongMolarMasses(s.f)) m.add(w.v, w.title, w.say, w.close);
  const hydrate = s.f.includes("*");
  const bracket = s.f.includes("(");
  return {
    instruction: tx("Work out the molar mass", "Berechne die molare Masse"),
    text: txMap((t, l) => `${t(`What is the molar mass of ${named(s, l)}?`, `Wie groß ist die molare Masse von ${named(s, l)}?`)} ${resolveText(roundText(2), l)}`),
    visual: chips(s.f),
    answer: right,
    hint: hydrate
      ? tx("Add the atomic masses of all atoms. The water of crystallisation counts too: the number in front of $\\ce{H2O}$ multiplies the whole water molecule.", "Addiere die Atommassen aller Atome. Das Kristallwasser zählt mit: Die Zahl vor $\\ce{H2O}$ vervielfacht das ganze Wassermolekül.")
      : bracket
        ? tx("Add the atomic masses of all atoms. The number after a bracket multiplies everything inside it.", "Addiere die Atommassen aller Atome. Die Zahl hinter einer Klammer vervielfacht alles in der Klammer.")
        : tx("Add the atomic masses of all atoms. An index says how often the atom right in front of it appears.", "Addiere die Atommassen aller Atome. Ein Index sagt, wie oft das Atom direkt davor vorkommt."),
    solution: [
      ...massFrames(
        s.f,
        hydrate
          ? tx("Every atom counts, the water of crystallisation too.", "Jedes Atom zählt, auch das Kristallwasser.")
          : bracket
            ? tx("Every atom counts. The factor after the bracket applies to the whole group.", "Jedes Atom zählt. Der Faktor hinter der Klammer gilt für die ganze Gruppe.")
            : tx("Every atom counts: atomic mass times index, then add.", "Jedes Atom zählt: Atommasse mal Index, dann addieren."),
      ),
      { math: txMap((_, l) => `\\group{M(${ce(s.f)})} \\approx \\group{${fx(right.value, l, 2)}#r "g/mol"}`), highlight: ["r"], note: tx("Same number as the mass of one particle in u, now in g/mol: the mass of 1 mol.", "Derselbe Zahlenwert wie die Teilchenmasse in u, jetzt in g/mol: die Masse von 1 mol.") },
    ],
    mistakes: m.list,
  };
}

function molarMassTask(rng: Rng, level: Level): Exercise {
  const pool = SUBSTANCES.filter((s) => s.kind !== "atom" && (level === 3 ? s.level === 3 || s.f.includes("(") : level === 2 ? s.level === 2 : s.level === 1));
  return molarMassExercise(rng.pick(pool));
}

// ---------------------------------------------------------------------------
// n = m / M and m = n · M

const NICE_N = [0.1, 0.2, 0.25, 0.5, 1.5, 2, 2.5, 3, 4, 5];
const NICE_M = [2, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 250, 500];

/** n = m/M. `mGiven` in g (or kg when `kg`); `showM` gives the molar mass in the text. */
function amountExercise(s: Substance, mass: number, opts: { showM?: boolean; kg?: boolean } = {}): Exercise {
  const molar = M(s.f);
  const grams = opts.kg ? mass * 1000 : mass;
  const n = grams / molar;
  const d = sig3(n);
  const right = answer(n, d, "mol", "n =");
  const m = mistakes(right);
  m.add(molar / grams, tx("Upside down", "Kehrwert erwischt"), tx("You divided the molar mass by the mass. It's the other way round: $n = \\frac{m}{M}$, mass on top.", "Du hast die molare Masse durch die Masse geteilt. Es ist andersherum: $n = \\frac{m}{M}$, die Masse steht oben."));
  m.add(grams * molar, tx("Multiplied instead of divided", "Multipliziert statt geteilt"), tx("Mass times molar mass gives no amount of substance. Look at the units: g · g/mol doesn't make mol. Divide instead.", "Masse mal molare Masse ergibt keine Stoffmenge. Schau auf die Einheiten: g · g/mol ergibt nicht mol. Teile stattdessen."));
  if (opts.kg) m.add(n / 1000, tx("kg not converted", "kg nicht umgerechnet"), tx("The molar mass is in **grams** per mol. Turn the kilograms into grams first: 1 kg = 1000 g.", "Die molare Masse steht in **Gramm** pro mol. Rechne die Kilogramm zuerst in Gramm um: 1 kg = 1000 g."));
  if (!opts.showM) for (const w of wrongMolarMasses(s.f)) m.add(grams / w.v, w.title, w.say);
  const massText = (l: Locale) => `${given(mass, l)} ${opts.kg ? "kg" : "g"}`;
  const solution: Frame[] = [{ math: "n = \\frac{m}{M}", note: tx("Amount of substance = mass divided by molar mass.", "Stoffmenge = Masse geteilt durch molare Masse.") }];
  if (opts.kg) solution.push({ math: txMap((_, l) => `m = \\group{${given(mass, l)} "kg"} = \\group{${given(grams, l)} "g"}`), note: tx("Molar masses are in g/mol, so turn kg into g.", "Molare Massen stehen in g/mol, also kg in g umrechnen.") });
  if (!opts.showM) solution.push(...massFrames(s.f));
  solution.push({
    math: txMap((_, l) => `n = \\frac{\\group{${given(grams, l)} "g"}}{\\group{${fx(molar, l, 2)} "g/mol"}} ${eq(n, d)} \\group{${fx(right.value, l, d)}#r "mol"}`),
    highlight: ["r"],
    note: tx("Put in the numbers: grams cancel, mol stays.", "Einsetzen: Gramm kürzt sich weg, mol bleibt."),
  });
  return {
    instruction: tx("Work out the amount of substance", "Berechne die Stoffmenge"),
    text: txMap((t, l) => {
      const base = t(`What is the amount of substance in ${massText(l)} of ${named(s, l)}?`, `Wie groß ist die Stoffmenge von ${massText(l)} ${named(s, l)}?`);
      const mm = opts.showM ? ` $M = ${fx(molar, l, 2)}$ g/mol.` : "";
      return `${base}${mm} ${resolveText(rounding(n, d), l)}`.trim();
    }),
    visual: opts.showM ? undefined : chips(s.f),
    answer: right,
    hint: tx("$n = \\frac{m}{M}$: mass in grams divided by the molar mass in g/mol.", "$n = \\frac{m}{M}$: Masse in Gramm geteilt durch die molare Masse in g/mol."),
    solution,
    mistakes: m.list,
  };
}

/** m = n · M. */
function massExercise(s: Substance, n: number, showM: boolean): Exercise {
  const molar = M(s.f);
  const mass = n * molar;
  const d = sig3(mass);
  const right = answer(mass, d, "g", "m =");
  const m = mistakes(right);
  m.add(n / molar, tx("Divided instead of multiplied", "Geteilt statt multipliziert"), tx("Rearrange $n = \\frac{m}{M}$ for m: multiply both sides by M. So $m = n \\cdot M$.", "Stell $n = \\frac{m}{M}$ nach m um: Beide Seiten mal M. Also $m = n \\cdot M$."));
  m.add(molar / n, tx("Divided the wrong way", "Falsch herum geteilt"), tx("The mass grows with the amount: twice the moles, twice the grams. So multiply, don't divide.", "Die Masse wächst mit der Stoffmenge: doppelt so viel mol, doppelt so viele Gramm. Also multiplizieren, nicht teilen."));
  m.add(molar, tx("That's the mass of 1 mol", "Das ist die Masse von 1 mol"), tx(`That's the molar mass, the mass of exactly 1 mol. Here you have a different amount of substance.`, `Das ist die molare Masse, also die Masse von genau 1 mol. Hier ist die Stoffmenge eine andere.`));
  if (!showM) for (const w of wrongMolarMasses(s.f)) m.add(n * w.v, w.title, w.say);
  const solution: Frame[] = [{ math: "m = n \\cdot M", note: tx("Rearranged: mass = amount of substance times molar mass.", "Umgestellt: Masse = Stoffmenge mal molare Masse.") }];
  if (!showM) solution.push(...massFrames(s.f));
  solution.push({
    math: txMap((_, l) => `m = \\group{${given(n, l)} "mol"} \\cdot \\group{${fx(molar, l, 2)} "g/mol"} ${eq(mass, d)} \\group{${fx(right.value, l, d)}#r "g"}`),
    highlight: ["r"],
    note: tx("mol cancels, grams stay.", "mol kürzt sich weg, Gramm bleibt."),
  });
  return {
    instruction: tx("Work out the mass", "Berechne die Masse"),
    text: txMap((t, l) => {
      const base = t(`What is the mass of ${given(n, l)} mol of ${named(s, l)}?`, `Welche Masse haben ${given(n, l)} mol ${named(s, l)}?`);
      const mm = showM ? ` $M = ${fx(molar, l, 2)}$ g/mol.` : "";
      return `${base}${mm} ${resolveText(rounding(mass, d, true), l)}`.trim();
    }),
    visual: showM ? undefined : chips(s.f),
    answer: right,
    hint: tx("Rearrange $n = \\frac{m}{M}$: $m = n \\cdot M$.", "Stell $n = \\frac{m}{M}$ um: $m = n \\cdot M$."),
    solution,
    mistakes: m.list,
  };
}

function amountTask(rng: Rng, level: Level): Exercise {
  if (level === 1) {
    const s = rng.pick(SUBSTANCES.filter((x) => x.level === 1));
    const n = rng.pick(NICE_N);
    return amountExercise(s, roundTo(n * M(s.f), 2), { showM: true });
  }
  if (level === 3) {
    const s = rng.pick(SUBSTANCES.filter((x) => x.level >= 2 || x.kind === "atom"));
    const kg = rng.chance(0.45);
    for (let i = 0; i < 20; i++) {
      const mass = kg ? rng.pick([0.5, 1, 1.5, 2, 2.5, 5]) : rng.pick(NICE_M);
      const n = (kg ? mass * 1000 : mass) / M(s.f);
      if (n >= 0.02 && n <= 60) return amountExercise(s, mass, { kg });
    }
  }
  const s = rng.pick(SUBSTANCES.filter((x) => x.level <= 2));
  for (let i = 0; i < 20; i++) {
    const mass = rng.pick(NICE_M);
    const n = mass / M(s.f);
    if (n >= 0.02 && n <= 20) return amountExercise(s, mass);
  }
  return amountExercise(substance("H2O"), 36);
}

function massTask(rng: Rng, level: Level): Exercise {
  const s = rng.pick(SUBSTANCES.filter((x) => x.level <= (level === 1 ? 1 : 2)));
  const n = rng.pick(level === 1 ? NICE_N : [0.05, 0.1, 0.2, 0.25, 0.4, 0.5, 0.75, 1.5, 2, 2.5, 3, 5]);
  return massExercise(s, n, level === 1);
}

/** M = m / n: identify a gas from mass and amount. */
const GASES = ["O2", "N2", "CO2", "CH4", "NH3", "Cl2", "SO2", "HCl", "C3H8"];
function molarFromMassTask(rng: Rng): Exercise {
  const s = substance(rng.pick(GASES));
  const n = rng.pick([0.1, 0.2, 0.25, 0.5, 1.5, 2, 2.5, 3]);
  const mass = roundTo(n * M(s.f), 2);
  const molar = mass / n;
  const right = answer(molar, 2, "g/mol", "M =");
  const m = mistakes(right);
  m.add(n / mass, tx("Upside down", "Kehrwert erwischt"), tx("Molar mass is grams **per** mol: mass on top, amount of substance below.", "Molare Masse heißt Gramm **pro** mol: Masse oben, Stoffmenge unten."));
  m.add(mass * n, tx("Multiplied instead of divided", "Multipliziert statt geteilt"), tx("Rearrange $n = \\frac{m}{M}$ for M: $M = \\frac{m}{n}$. Check the unit: g/mol.", "Stell $n = \\frac{m}{M}$ nach M um: $M = \\frac{m}{n}$. Prüf die Einheit: g/mol."));
  return {
    instruction: tx("Work out the molar mass", "Berechne die molare Masse"),
    text: txMap((t, l) => `${t(`A portion of a gas with an amount of substance of ${given(n, l)} mol has a mass of ${fx(mass, l, 2)} g. Work out the molar mass of the gas.`, `Eine Gasportion mit der Stoffmenge ${given(n, l)} mol hat die Masse ${fx(mass, l, 2)} g. Berechne die molare Masse des Gases.`)} ${resolveText(roundText(2), l)}`),
    answer: right,
    hint: tx("Rearrange $n = \\frac{m}{M}$ for M.", "Stell $n = \\frac{m}{M}$ nach M um."),
    solution: [
      { math: "M = \\frac{m}{n}", note: tx("Rearranged for the molar mass.", "Nach der molaren Masse umgestellt.") },
      { math: txMap((_, l) => `M = \\frac{\\group{${fx(mass, l, 2)} "g"}}{\\group{${given(n, l)} "mol"}} ${eq(molar, 2)} \\group{${fx(right.value, l, 2)}#r "g/mol"}`), highlight: ["r"], note: txMap((t, l) => `${t("That matches", "Das passt zu")} ${named(s, l)}: $${massSum(s.f, l)} \\approx ${fx(M(s.f), l, 2)}$ g/mol.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Particles: N = n · N_A

const E23 = "· 10²³";

function particleExercise(s: Substance, n: number, atom?: { el: string; k: number }): Exercise {
  const k = atom?.k ?? 1;
  const value = n * k * 6.022;
  const right = answer(value, 2, E23, "N =");
  const m = mistakes(right);
  const what = (l: Locale) => (atom ? `${atom.el}${l === "de" ? "-Atome" : " atoms"}` : resolveText(PARTICLES[s.kind], l));
  if (atom) m.add(n * 6.022, tx("Molecules, not atoms", "Moleküle statt Atome"), tx(`That's the number of molecules. Each $${ce(s.f)}$ contains ${k} ${atom.el} atoms: multiply by ${k}.`, `Das ist die Zahl der Moleküle. Jedes $${ce(s.f)}$ enthält ${k} ${atom.el}-Atome: Nimm noch mal ${k}.`));
  m.add(6.022 * k, tx("That's 1 mol", "Das ist 1 mol"), txMap((t, l) => t(`That's the number for exactly 1 mol. Here you have ${given(n, l)} mol, so multiply by the amount of substance.`, `Das ist die Zahl für genau 1 mol. Hier sind es ${given(n, l)} mol, also mal die Stoffmenge.`)));
  m.add(n * k, tx("N_A forgotten", "N_A vergessen"), tx("You still need the Avogadro constant: every mole contains $6.022 \\cdot 10^{23}$ particles.", "Es fehlt noch die Avogadro-Konstante: Jedes Mol enthält $6,022 \\cdot 10^{23}$ Teilchen."));
  return {
    instruction: tx("Work out the number of particles", "Berechne die Teilchenzahl"),
    text: txMap((t, l) =>
      t(
        `How many ${what(l)} are there in ${given(n, l)} mol of ${named(s, l)}? Give the result as a multiple of $10^{23}$ and round to 2 decimal places.`,
        `Wie viele ${what(l)} sind in ${given(n, l)} mol ${named(s, l)}? Gib das Ergebnis als Vielfaches von $10^{23}$ an und runde auf zwei Nachkommastellen.`,
      ),
    ),
    answer: right,
    hint: atom ? tx("$N = n \\cdot N_A$ gives the molecules. Then: atoms per molecule.", "$N = n \\cdot N_A$ ergibt die Moleküle. Dann: Atome pro Molekül.") : tx('$N = n \\cdot N_A$ with $N_A = 6.022 \\cdot 10^{23}\\,\\frac{1}{"mol"}$.', '$N = n \\cdot N_A$ mit $N_A = 6,022 \\cdot 10^{23}\\,\\frac{1}{"mol"}$.'),
    solution: [
      { math: "N = n \\cdot N_A", note: tx("Number of particles = amount of substance times Avogadro constant.", "Teilchenzahl = Stoffmenge mal Avogadro-Konstante.") },
      {
        math: txMap((_, l) => `N = \\group{${given(n, l)} "mol"} \\cdot ${fx(6.022, l, 3)} \\cdot 10^{23} \\frac{1}{"mol"} ${eq(n * 6.022, 3)} ${fx(n * 6.022, l, 3)} \\cdot 10^{23}${n * 6.022 >= 10 && !atom ? ` = ${sci(n * NA, l, 3)}` : ""}`),
        note: atom ? tx("That many molecules.", "So viele Moleküle.") : tx(`That's the number of ${resolveText(PARTICLES[s.kind], "en")}.`, `Das ist die Zahl der ${resolveText(PARTICLES[s.kind], "de")}.`),
      },
      ...(atom
        ? [{ math: txMap((_, l) => `N(\\ce{${atom.el}}) = ${k} \\cdot ${fx(n * 6.022, l, 3)} \\cdot 10^{23} \\approx ${fx(right.value, l, 2)}#r \\cdot 10^{23}`), highlight: ["r"], note: tx(`Each molecule brings ${k} ${atom.el} atoms.`, `Jedes Molekül bringt ${k} ${atom.el}-Atome mit.`) }]
        : []),
    ],
    mistakes: m.list,
  };
}

const ATOMS: { f: string; el: string }[] = [
  { f: "H2O", el: "H" },
  { f: "CO2", el: "O" },
  { f: "CH4", el: "H" },
  { f: "NH3", el: "H" },
  { f: "O2", el: "O" },
  { f: "C6H12O6", el: "C" },
  { f: "H2SO4", el: "O" },
  { f: "C3H8", el: "H" },
];

function particleTask(rng: Rng, level: Level): Exercise {
  const n = rng.pick([0.5, 1.5, 2, 2.5, 3, 4, 5, 0.25]);
  if (level >= 2 && rng.chance(0.5)) {
    const a = rng.pick(ATOMS);
    const s = substance(a.f);
    const p = parseFormula(a.f);
    const k = p.ok ? p.species.counts[a.el] : 1;
    return particleExercise(s, rng.pick([0.5, 1.5, 2, 0.25]), { el: a.el, k });
  }
  return particleExercise(rng.pick(SUBSTANCES.filter((x) => x.level === 1)), n);
}

/** n = N / N_A. */
function amountFromParticlesTask(rng: Rng): Exercise {
  const s = rng.pick(SUBSTANCES.filter((x) => x.level <= 2 && !x.f.includes("(")));
  const n = rng.pick([0.1, 0.25, 0.5, 1.5, 2, 2.5, 3, 4, 5]);
  const N = n * NA;
  const e = Math.floor(Math.log10(N));
  const mant = roundTo(N / 10 ** e, 3);
  const Nshown = mant * 10 ** e;
  const value = Nshown / NA;
  const d = sig3(value);
  const right = answer(value, d, "mol", "n =");
  const m = mistakes(right);
  m.add(NA / Nshown, tx("Upside down", "Kehrwert erwischt"), tx("You divided $N_A$ by N. It's the other way round: $n = \\frac{N}{N_A}$.", "Du hast $N_A$ durch N geteilt. Andersherum: $n = \\frac{N}{N_A}$."));
  m.add(mant, tx("Still the particle number", "Noch die Teilchenzahl"), tx("That's the number of particles without its power of ten. To get mol, divide by the Avogadro constant.", "Das ist die Teilchenzahl ohne ihre Zehnerpotenz. Für mol teilst du noch durch die Avogadro-Konstante."));
  if (e !== 23) m.add(mant / 6.022, tx("Power of ten", "Zehnerpotenz beachten"), tx(`Careful with the powers of ten: $10^{${e}}$ divided by $10^{23}$ is $10^{${e - 23}}$, not 1.`, `Vorsicht mit den Zehnerpotenzen: $10^{${e}}$ geteilt durch $10^{23}$ ist $10^{${e - 23}}$, nicht 1.`));
  const Nsrc = (l: Locale) => `${fx(mant, l, 3)} \\cdot 10^{${e}}`;
  return {
    instruction: tx("Work out the amount of substance", "Berechne die Stoffmenge"),
    text: txMap((t, l) => `${t(`A sample of ${named(s, l)} contains $${Nsrc(l)}$ ${resolveText(PARTICLES[s.kind], l)}. What amount of substance is that?`, `Eine Portion ${named(s, l)} enthält $${Nsrc(l)}$ ${resolveText(PARTICLES[s.kind], l)}. Welche Stoffmenge ist das?`)} ${resolveText(rounding(value, d), l)}`.trim()),
    answer: right,
    hint: tx("Rearrange $N = n \\cdot N_A$ for n.", "Stell $N = n \\cdot N_A$ nach n um."),
    solution: [
      { math: "n = \\frac{N}{N_A}", note: tx("Number of particles divided by the Avogadro constant.", "Teilchenzahl geteilt durch die Avogadro-Konstante.") },
      { math: txMap((_, l) => `n = \\frac{${Nsrc(l)}}{${fx(6.022, l, 3)} \\cdot 10^{23} \\frac{1}{"mol"}} ${eq(value, d)} \\group{${fx(right.value, l, d)}#r "mol"}`), highlight: ["r"], note: tx("Divide the numbers in front and the powers of ten separately.", "Teile die Zahlen vorne und die Zehnerpotenzen getrennt.") },
    ],
    mistakes: m.list,
  };
}

/** Atoms in a given mass: m → n → N → atoms. */
function atomsInMassTask(rng: Rng): Exercise {
  for (let i = 0; i < 30; i++) {
    const a = rng.pick(ATOMS);
    const s = substance(a.f);
    const p = parseFormula(a.f);
    const k = p.ok ? p.species.counts[a.el] : 1;
    const mass = rng.pick([1, 2, 4, 5, 8, 9, 10, 16, 18, 20, 32, 36, 44, 50]);
    const molar = M(a.f);
    const n = mass / molar;
    if (n < 0.04 || n > 4) continue;
    const value = n * k * 6.022;
    const right = answer(value, 2, E23, "N =");
    const m = mistakes(right);
    m.add(n * 6.022, tx("Molecules, not atoms", "Moleküle statt Atome"), tx(`That's the number of molecules. Each one contains ${k} ${a.el} atoms.`, `Das ist die Zahl der Moleküle. Jedes enthält ${k} ${a.el}-Atome.`));
    m.add(mass * k * 6.022, tx("Mass used as amount", "Masse als Stoffmenge"), tx("You put the mass in grams where the amount of substance belongs. First $n = \\frac{m}{M}$, then $N = n \\cdot N_A$.", "Du hast die Masse in Gramm statt der Stoffmenge eingesetzt. Zuerst $n = \\frac{m}{M}$, dann $N = n \\cdot N_A$."));
    m.add((molar / mass) * k * 6.022, tx("Upside down", "Kehrwert erwischt"), tx("For the amount of substance, mass goes on top: $n = \\frac{m}{M}$.", "Bei der Stoffmenge steht die Masse oben: $n = \\frac{m}{M}$."));
    return {
      instruction: tx("Count atoms by weighing", "Atome zählen durch Wiegen"),
      text: txMap((t, l) =>
        t(
          `How many ${a.el} atoms are in ${given(mass, l)} g of ${named(s, l)}? Give the result as a multiple of $10^{23}$ and round to 2 decimal places.`,
          `Wie viele ${a.el}-Atome stecken in ${given(mass, l)} g ${named(s, l)}? Gib das Ergebnis als Vielfaches von $10^{23}$ an und runde auf zwei Nachkommastellen.`,
        ),
      ),
      visual: chips(a.f),
      answer: right,
      hint: tx("Three steps: $n = \\frac{m}{M}$, then $N = n \\cdot N_A$, then atoms per molecule.", "Drei Schritte: $n = \\frac{m}{M}$, dann $N = n \\cdot N_A$, dann Atome pro Molekül."),
      solution: [
        ...massFrames(a.f),
        { math: txMap((_, l) => `n = \\frac{\\group{${given(mass, l)} "g"}}{\\group{${fx(molar, l, 2)} "g/mol"}} \\approx \\group{${fx(n, l, d4(n))} "mol"}`), note: tx("Amount of substance from the mass.", "Stoffmenge aus der Masse.") },
        { math: txMap((_, l) => `N = \\group{${fx(n, l, d4(n))} "mol"} \\cdot ${fx(6.022, l, 3)} \\cdot 10^{23} \\frac{1}{"mol"} \\approx ${fx(n * 6.022, l, 3)} \\cdot 10^{23}`), note: tx("That many molecules.", "So viele Moleküle.") },
        { math: txMap((_, l) => `N(\\ce{${a.el}}) = ${k} \\cdot ${fx(n * 6.022, l, 3)} \\cdot 10^{23} \\approx ${fx(right.value, l, 2)}#r \\cdot 10^{23}`), highlight: ["r"], note: tx(`${k} ${a.el} atoms in each molecule.`, `${k} ${a.el}-Atome in jedem Molekül.`) },
      ],
      mistakes: m.list,
    };
  }
  return particleExercise(substance("H2O"), 2);
}

// ---------------------------------------------------------------------------
// Concentration c = n / V

const SOLUTES = ["NaCl", "NaOH", "KCl", "C6H12O6", "CuSO4", "KNO3", "CaCl2", "HCl", "Na2CO3", "C12H22O11"];
const VOLUMES_ML = [100, 200, 250, 500, 750, 1000, 2000];

const volText = (ml: number) => (ml >= 1000 && ml % 1000 === 0 ? `${ml / 1000} L` : `${ml} mL`);
const litres = (ml: number, l: Locale) => given(ml / 1000, l, 3);

function concentrationExercise(s: Substance, n: number, ml: number): Exercise {
  const V = ml / 1000;
  const c = n / V;
  const d = sig3(c);
  const right = answer(c, d, "mol/L", "c =");
  const m = mistakes(right);
  if (ml !== 1000) m.add(n / ml, tx("mL not converted", "mL nicht umgerechnet"), tx("Concentration is in mol per **litre**. Turn the millilitres into litres first: 1000 mL = 1 L.", "Die Konzentration steht in mol pro **Liter**. Rechne die Milliliter zuerst in Liter um: 1000 mL = 1 L."), true);
  m.add(V / n, tx("Upside down", "Kehrwert erwischt"), tx("It's amount of substance **per** volume: n on top, V below.", "Es heißt Stoffmenge **pro** Volumen: n oben, V unten."));
  m.add(n * V, tx("Multiplied instead of divided", "Multipliziert statt geteilt"), tx("Look at the unit mol/L: that's mol **divided** by L.", "Schau auf die Einheit mol/L: Das ist mol **geteilt** durch L."));
  return {
    instruction: tx("Work out the concentration", "Berechne die Konzentration"),
    text: txMap((t, l) => `${t(`${given(n, l)} mol of ${named(s, l)} are dissolved, giving ${volText(ml)} of solution. What is the concentration?`, `${given(n, l)} mol ${named(s, l)} werden gelöst, es entstehen ${volText(ml)} Lösung. Wie groß ist die Stoffmengenkonzentration?`)} ${resolveText(rounding(c, d), l)}`.trim()),
    answer: right,
    hint: tx("$c = \\frac{n}{V}$ with V in litres.", "$c = \\frac{n}{V}$ mit V in Litern."),
    solution: [
      { math: "c = \\frac{n}{V}", note: tx("Concentration = amount of substance per volume of solution.", "Konzentration = Stoffmenge pro Volumen der Lösung.") },
      ...(ml % 1000 !== 0 ? [{ math: txMap((_, l) => `V = ${ml} "mL" = \\group{${litres(ml, l)} "L"}`), note: tx("Millilitres into litres: divide by 1000.", "Milliliter in Liter: durch 1000 teilen.") }] : []),
      { math: txMap((_, l) => `c = \\frac{\\group{${given(n, l)} "mol"}}{\\group{${litres(ml, l)} "L"}} ${eq(c, d)} ${fx(right.value, l, isExact(c, d) ? Math.min(d, (String(roundTo(c, d)).split(".")[1] ?? "").length) : d)}#r "mol/L"`), highlight: ["r"], note: tx("The solution contains that much substance per litre.", "So viel Stoff enthält die Lösung pro Liter.") },
    ],
    mistakes: m.list,
  };
}

function concentrationTask(rng: Rng): Exercise {
  const s = substance(rng.pick(SOLUTES));
  const n = rng.pick([0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 1.5, 2]);
  const ml = rng.pick(VOLUMES_ML);
  return concentrationExercise(s, n, ml);
}

/** c from a mass: c = m / (M · V). */
function concentrationFromMassTask(rng: Rng): Exercise {
  for (let i = 0; i < 30; i++) {
    const s = substance(rng.pick(SOLUTES.filter((f) => f !== "HCl")));
    const mass = rng.pick([1, 2, 4, 5, 10, 20, 25, 50]);
    const ml = rng.pick([100, 250, 500, 1000]);
    const molar = M(s.f);
    const n = mass / molar;
    const c = n / (ml / 1000);
    if (c < 0.01 || c > 5) continue;
    const d = sig3(c);
    const right = answer(c, d, "mol/L", "c =");
    const m = mistakes(right);
    if (ml !== 1000) m.add(n / ml, tx("mL not converted", "mL nicht umgerechnet"), tx("Concentration is in mol per **litre**. Turn the millilitres into litres first.", "Die Konzentration steht in mol pro **Liter**. Rechne die Milliliter zuerst in Liter um."), true);
    m.add(mass / (ml / 1000), tx("Mass instead of amount", "Masse statt Stoffmenge"), tx("That's grams per litre (the mass concentration). For mol/L you first need the amount of substance: $n = \\frac{m}{M}$.", "Das sind Gramm pro Liter (die Massenkonzentration). Für mol/L brauchst du zuerst die Stoffmenge: $n = \\frac{m}{M}$."));
    m.add(n, tx("Volume forgotten", "Volumen vergessen"), tx("That's the amount of substance. Now divide by the volume in litres.", "Das ist die Stoffmenge. Jetzt noch durch das Volumen in Litern teilen."));
    return {
      instruction: tx("Work out the concentration", "Berechne die Konzentration"),
      text: txMap((t, l) => `${t(`${given(mass, l)} g of ${named(s, l)} are dissolved in water to make ${volText(ml)} of solution. What is the concentration?`, `${given(mass, l)} g ${named(s, l)} werden in Wasser gelöst, es entstehen ${volText(ml)} Lösung. Wie groß ist die Stoffmengenkonzentration?`)} ${resolveText(rounding(c, d), l)}`.trim()),
      visual: chips(s.f),
      answer: right,
      hint: tx("Two steps: $n = \\frac{m}{M}$, then $c = \\frac{n}{V}$ with V in litres.", "Zwei Schritte: $n = \\frac{m}{M}$, dann $c = \\frac{n}{V}$ mit V in Litern."),
      solution: [
        ...massFrames(s.f),
        { math: txMap((_, l) => `n = \\frac{\\group{${given(mass, l)} "g"}}{\\group{${fx(molar, l, 2)} "g/mol"}} \\approx \\group{${fx(n, l, d4(n))} "mol"}`), note: tx("Amount of substance from the mass.", "Stoffmenge aus der Masse.") },
        { math: txMap((_, l) => `c = \\frac{\\group{${fx(n, l, d4(n))} "mol"}}{\\group{${litres(ml, l)} "L"}} \\approx \\group{${fx(right.value, l, d)}#r "mol/L"}`), highlight: ["r"], note: tx("Divide by the volume in litres.", "Durch das Volumen in Litern teilen.") },
      ],
      mistakes: m.list,
    };
  }
  return concentrationExercise(substance("NaOH"), 0.05, 250);
}

/** n = c · V, and (level 3) the mass needed for a solution. */
function fromConcentrationTask(rng: Rng, withMass: boolean): Exercise {
  const s = substance(rng.pick(SOLUTES.filter((f) => !withMass || f !== "HCl")));
  const c = rng.pick([0.05, 0.1, 0.2, 0.25, 0.5, 1, 2]);
  const ml = rng.pick([100, 200, 250, 500, 750]);
  const V = ml / 1000;
  const n = c * V;
  const solution: Frame[] = [
    { math: "n = c \\cdot V", note: tx("Rearrange $c = \\frac{n}{V}$: multiply by V.", "Stell $c = \\frac{n}{V}$ um: mal V.") },
    { math: txMap((_, l) => `n = \\group{${given(c, l)} "mol/L"} \\cdot \\group{${litres(ml, l)} "L"} ${eq(n, 5)} \\group{${given(n, l, 5)} "mol"}`), note: tx("Volume in litres!", "Volumen in Litern!") },
  ];
  if (!withMass) {
    const d = sig3(n);
    const right = answer(n, d, "mol", "n =");
    const m = mistakes(right);
    m.add(c * ml, tx("mL not converted", "mL nicht umgerechnet"), tx("The concentration is per **litre**, so put the volume in litres: 1000 mL = 1 L.", "Die Konzentration gilt pro **Liter**, also das Volumen in Litern einsetzen: 1000 mL = 1 L."), true);
    m.add(c / V, tx("Divided instead of multiplied", "Geteilt statt multipliziert"), tx("Rearrange $c = \\frac{n}{V}$ for n: multiply both sides by V.", "Stell $c = \\frac{n}{V}$ nach n um: Beide Seiten mal V."));
    m.add(V / c, tx("Divided the wrong way", "Falsch herum geteilt"), tx("More solution contains more substance, so the volume multiplies: $n = c \\cdot V$.", "Mehr Lösung enthält mehr Stoff, das Volumen wird also multipliziert: $n = c \\cdot V$."));
    return {
      instruction: tx("Work out the amount of substance", "Berechne die Stoffmenge"),
      text: txMap((t, l) => `${t(`How many moles of ${named(s, l)} are in ${ml} mL of a solution with $c = ${given(c, l)}$ mol/L?`, `Welche Stoffmenge ${named(s, l)} ist in ${ml} mL einer Lösung mit $c = ${given(c, l)}$ mol/L enthalten?`)} ${resolveText(rounding(n, d), l)}`.trim()),
      answer: right,
      hint: tx("$n = c \\cdot V$ with V in litres.", "$n = c \\cdot V$ mit V in Litern."),
      solution,
      mistakes: m.list,
    };
  }
  const molar = M(s.f);
  const mass = n * molar;
  const d = sig3(mass);
  const right = answer(mass, d, "g", "m =");
  const m = mistakes(right);
  m.add(n, tx("That's the amount", "Das ist die Stoffmenge"), tx("That's the amount of substance in mol. To weigh it out you need grams: $m = n \\cdot M$.", "Das ist die Stoffmenge in mol. Zum Abwiegen brauchst du Gramm: $m = n \\cdot M$."));
  m.add(mass * 1000, tx("mL not converted", "mL nicht umgerechnet"), tx("The concentration is per **litre**: put the volume in litres.", "Die Konzentration gilt pro **Liter**: Setz das Volumen in Litern ein."), true);
  m.add(n / molar, tx("Divided by M", "Durch M geteilt"), tx("From mol to grams you multiply by the molar mass: $m = n \\cdot M$.", "Von mol zu Gramm multiplizierst du mit der molaren Masse: $m = n \\cdot M$."));
  return {
    instruction: tx("Prepare a solution", "Stell eine Lösung her"),
    text: txMap((t, l) => `${t(`You want to make ${ml} mL of a ${named(s, l)} solution with $c = ${given(c, l)}$ mol/L. How many grams do you have to weigh out?`, `Du willst ${ml} mL einer Lösung von ${named(s, l)} mit $c = ${given(c, l)}$ mol/L herstellen. Wie viel Gramm musst du abwiegen?`)} ${resolveText(rounding(mass, d, true), l)}`.trim()),
    visual: chips(s.f),
    answer: right,
    hint: tx("First $n = c \\cdot V$ (V in litres), then $m = n \\cdot M$.", "Zuerst $n = c \\cdot V$ (V in Litern), dann $m = n \\cdot M$."),
    solution: [...solution, ...massFrames(s.f), { math: txMap((_, l) => `m = \\group{${given(n, l, 5)} "mol"} \\cdot \\group{${fx(molar, l, 2)} "g/mol"} ${eq(mass, d)} \\group{${fx(right.value, l, d)}#r "g"}`), highlight: ["r"], note: tx("From mol to grams.", "Von mol zu Gramm.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Stoichiometry: mass of a product from the mass of a reactant

type Stoich = { eq: string; coefs: number[]; words: Text; pairs: [number, number][]; masses: number[] };

const ST = (eq: string, coefs: number[], en: string, de: string, pairs: [number, number][], masses: number[]): Stoich => ({ eq, coefs, words: tx(en, de), pairs, masses });

/** Curated reactions (coefficients checked by the solver in tests). pairs: [given, wanted] species index. */
const STOICH: Stoich[] = [
  ST("H2O -> H2 + O2", [2, 2, 1], "Water is split by electrolysis.", "Wasser wird durch Elektrolyse zerlegt.", [[0, 2], [0, 1]], [9, 18, 36, 45, 90]),
  ST("Mg + O2 -> MgO", [2, 1, 2], "Magnesium burns in air.", "Magnesium verbrennt an der Luft.", [[0, 2], [0, 1]], [2.4, 4.8, 6, 12, 24]),
  ST("CH4 + O2 -> CO2 + H2O", [1, 2, 1, 2], "Methane (natural gas) burns completely.", "Methan (Erdgas) verbrennt vollständig.", [[0, 2], [0, 3], [0, 1]], [4, 8, 16, 32, 100]),
  ST("C3H8 + O2 -> CO2 + H2O", [1, 5, 3, 4], "Propane (camping gas) burns completely.", "Propan (Campinggas) verbrennt vollständig.", [[0, 2], [0, 3], [0, 1]], [11, 22, 44, 88, 100]),
  ST("C + O2 -> CO2", [1, 1, 1], "Carbon (charcoal) burns completely.", "Kohlenstoff (Holzkohle) verbrennt vollständig.", [[0, 2]], [3, 6, 12, 24, 36]),
  ST("Fe + S -> FeS", [1, 1, 1], "Iron reacts with sulfur to form iron sulfide.", "Eisen reagiert mit Schwefel zu Eisensulfid.", [[0, 2], [1, 2]], [5.6, 11.2, 28, 56, 10]),
  ST("Na + Cl2 -> NaCl", [2, 1, 2], "Sodium reacts with chlorine to form table salt.", "Natrium reagiert mit Chlor zu Kochsalz.", [[0, 2], [0, 1]], [2.3, 4.6, 11.5, 23, 46]),
  ST("Zn + HCl -> ZnCl2 + H2", [1, 2, 1, 1], "Zinc reacts with hydrochloric acid.", "Zink reagiert mit Salzsäure.", [[0, 3], [0, 2]], [6.5, 13, 32.7, 65.4, 10]),
  ST("CaCO3 -> CaO + CO2", [1, 1, 1], "Limestone is heated (lime burning).", "Kalkstein wird erhitzt (Kalkbrennen).", [[0, 1], [0, 2]], [10, 50, 100, 250, 500]),
  ST("Fe2O3 + Al -> Al2O3 + Fe", [1, 2, 1, 2], "Thermite reaction: iron(III) oxide reacts with aluminium.", "Thermitreaktion: Eisen(III)-oxid reagiert mit Aluminium.", [[0, 3], [1, 3]], [16, 32, 80, 160, 50]),
  ST("Al + O2 -> Al2O3", [4, 3, 2], "Aluminium powder burns.", "Aluminiumpulver verbrennt.", [[0, 2]], [2.7, 5.4, 10.8, 27, 54]),
  ST("H2 + O2 -> H2O", [2, 1, 2], "Hydrogen burns (oxyhydrogen reaction).", "Wasserstoff verbrennt (Knallgasreaktion).", [[0, 2], [0, 1]], [1, 2, 4, 10, 20]),
  ST("C6H12O6 + O2 -> CO2 + H2O", [1, 6, 6, 6], "Glucose is broken down in cell respiration.", "Glucose wird bei der Zellatmung abgebaut.", [[0, 2], [0, 3]], [18, 45, 90, 180]),
  ST("N2 + H2 -> NH3", [1, 3, 2], "Ammonia synthesis (Haber-Bosch).", "Ammoniaksynthese (Haber-Bosch-Verfahren).", [[0, 2], [1, 2]], [14, 28, 56, 100]),
  ST("CuO + C -> Cu + CO2", [2, 1, 2, 1], "Copper(II) oxide is reduced with carbon.", "Kupfer(II)-oxid wird mit Kohlenstoff reduziert.", [[0, 2], [1, 2]], [8, 16, 40, 80]),
  ST("H2O2 -> H2O + O2", [2, 2, 1], "Hydrogen peroxide decomposes.", "Wasserstoffperoxid zerfällt.", [[0, 2]], [3.4, 6.8, 17, 34]),
  ST("Fe + O2 -> Fe2O3", [4, 3, 2], "Iron rusts to iron(III) oxide.", "Eisen rostet zu Eisen(III)-oxid.", [[0, 2]], [5.6, 11.2, 56, 112]),
];

const species = (eqn: string) => eqn.split("->").flatMap((side) => side.split(" + ").map((x) => x.trim()));
const SPECIES_NAMES: Record<string, Text> = {
  H2: tx("hydrogen", "Wasserstoff"),
  S: tx("sulfur", "Schwefel"),
  FeS: tx("iron sulfide", "Eisensulfid"),
  ZnCl2: tx("zinc chloride", "Zinkchlorid"),
  HCl: tx("hydrochloric acid (HCl)", "Salzsäure (HCl)"),
  H2O2: tx("hydrogen peroxide", "Wasserstoffperoxid"),
  CuO: tx("copper(II) oxide", "Kupfer(II)-oxid"),
  Mg: tx("magnesium", "Magnesium"),
  Na: tx("sodium", "Natrium"),
  Zn: tx("zinc", "Zink"),
};
const nameOfF = (f: string, l: Locale) => resolveText(SPECIES_NAMES[f] ?? SUBSTANCES.find((s) => s.f === f)?.name ?? f, l);

function stoichExercise(rx: Stoich, pair: [number, number], mass: number): Exercise {
  const sp = species(rx.eq);
  const [gi, wi] = pair;
  const fg = sp[gi];
  const fw = sp[wi];
  const Mg = M(fg);
  const Mw = M(fw);
  const vg = rx.coefs[gi];
  const vw = rx.coefs[wi];
  const ng = mass / Mg;
  const nw = (ng * vw) / vg;
  const mw = nw * Mw;
  const d = sig3(mw);
  const right = answer(mw, d, "g", `m =`);
  const m = mistakes(right);
  const ratio = vw / vg;
  if (ratio !== 1) {
    m.add(ng * Mw, tx("Mole ratio forgotten", "Stoffmengenverhältnis vergessen"), tx(`Nearly! Look at the numbers in front in the equation: ${vg} $${ce(fg)}$ give ${vw} $${ce(fw)}$. The amounts of substance are in that ratio, not 1 : 1.`, `Fast! Schau auf die Zahlen vor den Formeln: ${vg} $${ce(fg)}$ ergeben ${vw} $${ce(fw)}$. In diesem Verhältnis stehen die Stoffmengen, nicht 1 : 1.`));
    m.add((ng * vg) / vw * Mw, tx("Ratio upside down", "Verhältnis umgedreht"), tx(`The ratio is the right idea, but upside down. Ask: ${vg} $${ce(fg)}$ give how many $${ce(fw)}$?`, `Das Verhältnis ist die richtige Idee, nur umgedreht. Frag dich: ${vg} $${ce(fg)}$ ergeben wie viele $${ce(fw)}$?`));
    m.add(mass * ratio, tx("Masses aren't in that ratio", "Massen stehen nicht im Verhältnis"), tx("The coefficients give the ratio of the **amounts of substance** (particles), not of the masses. Go via mol: $n = \\frac{m}{M}$ first.", "Die Koeffizienten geben das Verhältnis der **Stoffmengen** (Teilchen) an, nicht der Massen. Geh über mol: zuerst $n = \\frac{m}{M}$."));
  }
  m.add(mass, tx("Same mass?", "Gleiche Masse?"), tx("The product doesn't simply weigh as much as the one reactant: the other reactants add mass too, and the particles weigh differently. Go via the amount of substance.", "Das Produkt wiegt nicht einfach so viel wie dieses eine Edukt: Andere Stoffe reagieren mit, und die Teilchen sind verschieden schwer. Geh über die Stoffmenge."));
  m.add(nw, tx("That's the amount in mol", "Das ist die Stoffmenge"), tx("You've got the amount of substance, great! Asked is the mass: one last step, $m = n \\cdot M$.", "Die Stoffmenge hast du, super! Gefragt ist aber die Masse: ein letzter Schritt, $m = n \\cdot M$."), true);
  if (vw !== 1) m.add(nw * vw * Mw, tx("Coefficient counted twice", "Koeffizient doppelt gezählt"), tx("The coefficient is already in the mole ratio. The molar mass is for **one** particle: don't multiply it by the coefficient again.", "Der Koeffizient steckt schon im Stoffmengenverhältnis. Die molare Masse gilt für **ein** Teilchen: Nimm sie nicht noch mal mit dem Koeffizienten mal."));
  m.add(ng * Mg, tx("Molar mass of the wrong substance", "Molare Masse vom falschen Stoff"), tx(`For the last step you need the molar mass of $${ce(fw)}$, the substance you're looking for.`, `Für den letzten Schritt brauchst du die molare Masse von $${ce(fw)}$, also vom gesuchten Stoff.`));
  const eqSrc = ceEquation(rx.eq, rx.coefs);
  const ratioSrc = ratio === 1 ? "" : Number.isInteger(ratio) ? `${ratio} \\cdot ` : `\\frac{${vw / gcd(vw, vg)}}{${vg / gcd(vw, vg)}} \\cdot `;
  return {
    instruction: tx("Calculate with the equation", "Rechne mit der Reaktionsgleichung"),
    text: txMap((t, l) => {
      const words = resolveText(rx.words, l);
      return `${words} ${t(`How many grams of ${nameOfF(fw, l)} ($${ce(fw)}$) form from ${given(mass, l)} g of ${nameOfF(fg, l)}?`, `Wie viel Gramm ${nameOfF(fw, l)} ($${ce(fw)}$) entstehen aus ${given(mass, l)} g ${nameOfF(fg, l)}?`)} ${resolveText(rounding(mw, d, true), l)}`.trim();
    }),
    math: eqSrc,
    visual: chips([fg, fw]),
    answer: right,
    hint: tx("Four steps: equation, $n = \\frac{m}{M}$ of the given substance, mole ratio from the coefficients, $m = n \\cdot M$ of the wanted one.", "Vier Schritte: Gleichung, $n = \\frac{m}{M}$ vom gegebenen Stoff, Stoffmengenverhältnis aus den Koeffizienten, $m = n \\cdot M$ vom gesuchten Stoff."),
    solution: [
      { math: eqSrc, note: txMap((t, l) => `${t("1. The balanced equation. Given:", "1. Die ausgeglichene Gleichung. Gegeben:")} ${given(mass, l)} g $${ce(fg)}$, ${t("wanted:", "gesucht:")} m($${ce(fw)}$).`) },
      { math: txMap((_, l) => `\\group{n(${ce(fg)})} = \\frac{\\group{${given(mass, l)} "g"}}{\\group{${fx(Mg, l, 2)} "g/mol"}} \\approx \\group{${fx(ng, l, d4(ng))} "mol"}`), note: tx("2. Amount of substance of the given substance.", "2. Stoffmenge des gegebenen Stoffs.") },
      {
        math: txMap((_, l) => `\\group{n(${ce(fw)})} = ${ratioSrc}\\group{n(${ce(fg)})} \\approx \\group{${fx(nw, l, d4(nw))} "mol"}`),
        note: ratio === 1 ? tx(`3. Mole ratio from the equation: ${vg} : ${vw}, so the same amount.`, `3. Stoffmengenverhältnis aus der Gleichung: ${vg} : ${vw}, also gleich viel.`) : tx(`3. Mole ratio from the coefficients: ${vg} $${ce(fg)}$ give ${vw} $${ce(fw)}$.`, `3. Stoffmengenverhältnis aus den Koeffizienten: ${vg} $${ce(fg)}$ ergeben ${vw} $${ce(fw)}$.`),
      },
      { math: txMap((_, l) => `\\group{m(${ce(fw)})} = \\group{${fx(nw, l, d4(nw))} "mol"} \\cdot \\group{${fx(Mw, l, 2)} "g/mol"} \\approx \\group{${fx(right.value, l, d)}#r "g"}`), highlight: ["r"], note: tx("4. Back to the mass: $m = n \\cdot M$.", "4. Zurück zur Masse: $m = n \\cdot M$.") },
    ],
    mistakes: m.list,
  };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function stoichTask(rng: Rng, level: Level): Exercise {
  const options = STOICH.flatMap((rx) => rx.pairs.map((p) => ({ rx, p }))).filter(({ rx, p }) => (level === 2 ? rx.coefs[p[0]] === rx.coefs[p[1]] : true));
  const { rx, p } = rng.pick(options);
  return stoichExercise(rx, p, rng.pick(rx.masses));
}

// ---------------------------------------------------------------------------
// Concepts (level 1)

function conceptTask(rng: Rng): Exercise {
  const kind = rng.int(0, 3);
  if (kind === 0) {
    const { answer, mistakes } = choice(rng, [
      { text: tx("how many particles there are in 1 mol", "wie viele Teilchen in 1 mol stecken") },
      { text: tx("the mass of 1 mol of a substance", "die Masse von 1 mol eines Stoffs"), title: tx("That's the molar mass", "Das ist die molare Masse"), say: tx("The mass of 1 mol is the molar mass M, and it's different for every substance. The Avogadro constant is the same for all.", "Die Masse von 1 mol ist die molare Masse M, und die ist für jeden Stoff anders. Die Avogadro-Konstante ist für alle gleich.") },
      { text: tx("how many atoms there are in one molecule", "wie viele Atome in einem Molekül stecken"), title: tx("That's the formula", "Das sagt die Formel"), say: tx("Atoms per molecule come from the formula (the indices). $N_A$ counts particles in a whole mole.", "Atome pro Molekül verrät die Formel (die Indizes). $N_A$ zählt die Teilchen in einem ganzen Mol.") },
      { text: tx("how much 1 g of a substance weighs in mol", "wie viel 1 g eines Stoffs in mol wiegt"), title: tx("Mixed up the units", "Einheiten durcheinander"), say: tx("Grams measure mass, mol counts particles. $N_A$ links mol to the number of particles.", "Gramm misst die Masse, mol zählt Teilchen. $N_A$ verbindet mol mit der Teilchenzahl.") },
    ]);
    return {
      instruction: tx("The Avogadro constant", "Die Avogadro-Konstante"),
      text: tx('$N_A = 6.022 \\cdot 10^{23}\\,\\frac{1}{"mol"}$ tells you…', '$N_A = 6,022 \\cdot 10^{23}\\,\\frac{1}{"mol"}$ gibt an, …'),
      answer,
      hint: tx("Look at the unit: 1 per mol, that is particles per mol.", "Schau auf die Einheit: 1 pro mol, also Teilchen pro mol."),
      solution: [{ math: txMap((_, l) => `1 "mol" = ${fx(6.022, l, 3)} \\cdot 10^{23}`), note: tx("1 mol of any substance contains $6.022 \\cdot 10^{23}$ particles: atoms, molecules or formula units.", "1 mol jedes Stoffs enthält $6,022 \\cdot 10^{23}$ Teilchen: Atome, Moleküle oder Formeleinheiten.") }],
      mistakes,
    };
  }
  if (kind === 1) {
    const { answer, mistakes } = choice(rng, [
      { text: '$"g/mol"$' },
      { text: '$"mol"$', title: tx("That's the amount", "Das ist die Stoffmenge"), say: tx("mol is the unit of the amount of substance n. The molar mass says how many grams **one** mol weighs.", "mol ist die Einheit der Stoffmenge n. Die molare Masse sagt, wie viel Gramm **ein** Mol wiegt.") },
      { text: '$"g"$', title: tx("Only half of it", "Nur die Hälfte"), say: tx("Grams alone is a mass. The molar mass is grams **per** mol.", "Gramm allein ist eine Masse. Die molare Masse ist Gramm **pro** mol.") },
      { text: '$"mol/L"$', title: tx("That's concentration", "Das ist die Konzentration"), say: tx("mol/L is the unit of the concentration c.", "mol/L ist die Einheit der Konzentration c.") },
    ]);
    return {
      instruction: tx("Units", "Einheiten"),
      text: tx("Which unit does the molar mass $M$ have?", "Welche Einheit hat die molare Masse $M$?"),
      answer,
      hint: tx("$M = \\frac{m}{n}$: a mass divided by an amount of substance.", "$M = \\frac{m}{n}$: eine Masse geteilt durch eine Stoffmenge."),
      solution: [{ math: tx('M = \\frac{m}{n} \\quad "unit: g/mol"', 'M = \\frac{m}{n} \\quad "Einheit: g/mol"'), note: tx("Mass per amount of substance: grams per mol.", "Masse pro Stoffmenge: Gramm pro mol.") }],
      mistakes,
    };
  }
  if (kind === 2) {
    const pairs: [string, string][] = [
      ["H2O", "Fe"],
      ["NaCl", "C12H22O11"],
      ["CO2", "O2"],
      ["Cu", "Al"],
    ];
    const [a, b] = rng.pick(pairs);
    const A = substance(a);
    const B = substance(b);
    const heavier = M(a) > M(b) ? A : B;
    const { answer, mistakes } = choice(rng, [
      { text: tx("Both contain the same number of particles.", "Beide enthalten gleich viele Teilchen.") },
      { text: tx("Both have the same mass.", "Beide haben dieselbe Masse."), title: tx("Same count, different mass", "Gleiche Anzahl, andere Masse"), say: tx("1 mol always has the same number of particles, but the particles weigh differently. So the masses differ.", "1 mol hat immer gleich viele Teilchen, aber die Teilchen sind verschieden schwer. Also unterscheiden sich die Massen.") },
      { text: txMap((t, l) => t(`The ${nameOf(heavier, l)} contains more particles.`, `Im ${nameOf(heavier, l)} stecken mehr Teilchen.`)), title: tx("Heavier isn't more", "Schwerer heißt nicht mehr"), say: tx("It's heavier because each particle is heavier, not because there are more. 1 mol is always $6.022 \\cdot 10^{23}$ particles.", "Es ist schwerer, weil jedes Teilchen schwerer ist, nicht weil es mehr sind. 1 mol sind immer $6,022 \\cdot 10^{23}$ Teilchen.") },
      { text: tx("You can't compare them, they're different substances.", "Das kann man nicht vergleichen, es sind verschiedene Stoffe."), title: tx("You can!", "Doch!"), say: tx("That's exactly what the mole is for: it counts particles of any substance in the same unit.", "Genau dafür gibt es das Mol: Es zählt Teilchen jedes Stoffs in derselben Einheit.") },
    ]);
    return {
      instruction: tx("Same amount, different substances", "Gleiche Stoffmenge, verschiedene Stoffe"),
      text: txMap((t, l) => t(`You have 1 mol of ${named(A, l)} and 1 mol of ${named(B, l)}. Which statement is true?`, `Du hast 1 mol ${named(A, l)} und 1 mol ${named(B, l)}. Welche Aussage stimmt?`)),
      answer,
      hint: tx("What does 1 mol count?", "Was zählt 1 mol?"),
      solution: [
        { math: txMap((_, l) => `1 "mol" = ${fx(6.022, l, 3)} \\cdot 10^{23}`), note: tx("1 mol is always the same number of particles.", "1 mol ist immer dieselbe Anzahl von Teilchen.") },
        { math: txMap((_, l) => `\\group{M(${ce(a)})} = \\group{${fx(M(a), l, 2)} "g/mol"} \\quad \\group{M(${ce(b)})} = \\group{${fx(M(b), l, 2)} "g/mol"}`), note: tx("But the masses differ, because the particles weigh differently.", "Die Massen unterscheiden sich aber, weil die Teilchen verschieden schwer sind.") },
      ],
      mistakes,
    };
  }
  const c = rng.pick([0.1, 0.2, 0.5, 1, 2]);
  const { answer, mistakes } = choice(rng, [
    { text: txMap((t, l) => t(`1 L of the solution contains ${given(c, l)} mol of salt.`, `1 L der Lösung enthält ${given(c, l)} mol Salz.`)) },
    { text: txMap((t, l) => t(`${given(c, l)} mol of salt were dissolved in exactly 1 L of water.`, `${given(c, l)} mol Salz wurden in genau 1 L Wasser gelöst.`)), title: tx("Solution, not water", "Lösung, nicht Wasser"), say: tx("Careful: the volume is the volume of the **solution**. You fill up to 1 L in total, you don't take 1 L of water.", "Vorsicht: Gemeint ist das Volumen der **Lösung**. Man füllt insgesamt auf 1 L auf und nimmt nicht 1 L Wasser.") },
    { text: txMap((t, l) => t(`1 L of the solution contains ${given(c, l)} g of salt.`, `1 L der Lösung enthält ${given(c, l)} g Salz.`)), title: tx("mol, not grams", "mol, nicht Gramm"), say: tx("mol/L counts particles (amount of substance) per litre, not grams.", "mol/L zählt Teilchen (Stoffmenge) pro Liter, nicht Gramm.") },
    { text: txMap((t, l) => t(`${given(c, l)} L of the solution contain 1 mol of salt.`, `${given(c, l)} L der Lösung enthalten 1 mol Salz.`)), title: tx("Upside down", "Umgedreht"), say: tx("mol/L means mol **per** litre: the litre is below the fraction line.", "mol/L heißt mol **pro** Liter: Der Liter steht unter dem Bruchstrich.") },
  ]);
  return {
    instruction: tx("Reading a concentration", "Eine Konzentration lesen"),
    text: txMap((t, l) => t(`A salt solution has the concentration $c = ${given(c, l)}$ mol/L. What does that mean?`, `Eine Salzlösung hat die Konzentration $c = ${given(c, l)}$ mol/L. Was heißt das?`)),
    answer,
    hint: tx("mol/L: amount of substance per litre of solution.", "mol/L: Stoffmenge pro Liter Lösung."),
    solution: [{ math: tx('c = \\frac{n}{V} \\quad "unit: mol/L"', 'c = \\frac{n}{V} \\quad "Einheit: mol/L"'), note: tx("Amount of substance per volume of **solution**.", "Stoffmenge pro Volumen der **Lösung**.") }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------

function generate(level: Level, rng: Rng): Exercise {
  const r = rng.next();
  if (level === 1) {
    if (r < 0.25) return molarMassTask(rng, 1);
    if (r < 0.45) return amountTask(rng, 1);
    if (r < 0.6) return massTask(rng, 1);
    if (r < 0.75) return particleTask(rng, 1);
    return conceptTask(rng);
  }
  if (level === 2) {
    if (r < 0.18) return molarMassTask(rng, 2);
    if (r < 0.35) return amountTask(rng, 2);
    if (r < 0.47) return massTask(rng, 2);
    if (r < 0.6) return concentrationTask(rng);
    if (r < 0.68) return fromConcentrationTask(rng, false);
    if (r < 0.82) return stoichTask(rng, 2);
    if (r < 0.92) return rng.chance(0.5) ? amountFromParticlesTask(rng) : particleTask(rng, 2);
    return molarFromMassTask(rng);
  }
  if (r < 0.35) return stoichTask(rng, 3);
  if (r < 0.47) return rng.chance(0.5) ? molarMassTask(rng, 3) : amountExercise(rng.pick(SUBSTANCES.filter((s) => s.level === 3)), rng.pick([10, 25, 50, 100]));
  if (r < 0.6) return concentrationFromMassTask(rng);
  if (r < 0.7) return fromConcentrationTask(rng, true);
  if (r < 0.8) return atomsInMassTask(rng);
  if (r < 0.9) return amountTask(rng, 3);
  return molarFromMassTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const moleFrames: Frame[] = [
  { math: tx('1#o "dozen"#u =#e 12#v "eggs"#p', '1#o "Dutzend"#u =#e 12#v "Eier"#p'), note: tx("A dozen eggs are 12 eggs. A dozen is a **counting unit**.", "Ein Dutzend Eier sind 12 Eier. Ein Dutzend ist eine **Zähleinheit**.") },
  { math: tx('1#o "mol"#u =#e 6.022#v \\cdot#d 10^{23}#x "particles"#p', '1#o "mol"#u =#e 6,022#v \\cdot#d 10^{23}#x "Teilchen"#p'), note: tx("Chemists count particles in **moles**. 1 mol is $6.022 \\cdot 10^{23}$ particles: atoms, molecules or formula units.", "Chemiker zählen Teilchen in **Mol**. 1 mol sind $6,022 \\cdot 10^{23}$ Teilchen: Atome, Moleküle oder Formeleinheiten.") },
  { math: txMap((_, l) => `N_A#u =#e ${fx(6.022, l, 3)}#v \\cdot#d 10^{23}#x \\frac{1}{"mol"}#p`), note: tx("This number is the **Avogadro constant** $N_A$. The amount of substance $n$ counts particles in mol.", "Diese Zahl heißt **Avogadro-Konstante** $N_A$. Die Stoffmenge $n$ zählt Teilchen in mol.") },
  {
    math: tx('6.022#v \\cdot#d 10^{23}#x "s"#p \\approx 1.9 \\cdot 10^{16} "years"', '6,022#v \\cdot#d 10^{23}#x "s"#p \\approx 1,9 \\cdot 10^{16} "Jahre"'),
    note: tx("Huge! Counting one particle per second would take about 19 million billion years. The universe is only about 14 billion years old.", "Riesig! Würdest du jede Sekunde ein Teilchen zählen, bräuchtest du rund 19 Billiarden Jahre. Das Universum ist erst etwa 14 Milliarden Jahre alt."),
  },
  { math: tx('n("water") = 2 "mol"', 'n("Wasser") = 2 "mol"'), note: tx("So when you read $n = 2$ mol of water, think: twice $6.022 \\cdot 10^{23}$ water molecules.", "Liest du also $n = 2$ mol Wasser, denk: zweimal $6,022 \\cdot 10^{23}$ Wassermoleküle.") },
];

const molarFrames: Frame[] = [
  { math: tx('m_A(\\ce{C}) = 12.011 "u"', 'm_A(\\ce{C}) = 12,011 "u"'), note: tx("A carbon atom has the atomic mass 12.011 u (from the periodic table).", "Ein Kohlenstoffatom hat die Atommasse 12,011 u (aus dem Periodensystem).") },
  { math: tx('\\group{M(\\ce{C})} = 12.011 "g/mol"', '\\group{M(\\ce{C})} = 12,011 "g/mol"'), note: tx("The **molar mass** M is the mass of 1 mol. Same number as the atomic mass, but in g/mol: 1 mol of carbon weighs about 12 g.", "Die **molare Masse** M ist die Masse von 1 mol. Derselbe Zahlenwert wie die Atommasse, aber in g/mol: 1 mol Kohlenstoff wiegt etwa 12 g.") },
  ...massFrames("H2O", tx("For compounds add up the atomic masses of **all** atoms. The index 2 means two H atoms. 1 mol of water weighs about 18 g, just a sip.", "Bei Verbindungen addierst du die Atommassen **aller** Atome. Der Index 2 heißt: zwei H-Atome. 1 mol Wasser wiegt rund 18 g, nur ein Schluck.")),
  ...massFrames("Ca(OH)2", tx("Brackets: the 2 after the bracket counts for the whole OH group, so O and H twice each.", "Klammern: Die 2 hinter der Klammer gilt für die ganze OH-Gruppe, also O und H je zweimal.")),
  ...massFrames("CuSO4*5H2O", tx("Hydrates: the water of crystallisation counts too. $\\ce{5H2O}$ means five whole water molecules.", "Hydrate: Das Kristallwasser zählt mit. $\\ce{5H2O}$ heißt fünf ganze Wassermoleküle.")),
];

const formulaFrames: Frame[] = [
  { math: "n#n =#e \\frac{m#m}{M#M}", note: tx("Amount of substance = mass divided by molar mass.", "Stoffmenge = Masse geteilt durch molare Masse.") },
  { math: txMap((_, l) => `n#n =#e \\frac{36#m "g"#g}{${fx(M("H2O"), l, 2)}#M "g/mol"#gm} \\approx \\group{${fx(2, l, 2)}#r "mol"}#mol`), note: tx("Example: 36 g of water. Grams cancel, mol stays: 2 mol of water molecules.", "Beispiel: 36 g Wasser. Gramm kürzt sich weg, mol bleibt: 2 mol Wassermoleküle.") },
  { math: "m#m =#e n#n \\cdot M#M", note: tx("Looking for the mass? Rearrange: multiply the amount of substance by the molar mass.", "Gesucht ist die Masse? Umstellen: Stoffmenge mal molare Masse.") },
  { math: "M#M =#e \\frac{m#m}{n#n}", note: tx("Looking for the molar mass? Divide the mass by the amount of substance.", "Gesucht ist die molare Masse? Masse geteilt durch Stoffmenge.") },
  { math: "N#N =#e n#n \\cdot N_A", note: tx("And the number of particles: amount of substance times Avogadro constant.", "Und die Teilchenzahl: Stoffmenge mal Avogadro-Konstante.") },
  { math: txMap((_, l) => `N#N =#e \\group{${fx(2, l, 2)} "mol"} \\cdot ${fx(6.022, l, 3)} \\cdot 10^{23} \\frac{1}{"mol"} \\approx ${fx(1.2, l, 2)} \\cdot 10^{24}`), note: tx("So 36 g of water contain about $1.2 \\cdot 10^{24}$ water molecules.", "36 g Wasser enthalten also rund $1,2 \\cdot 10^{24}$ Wassermoleküle.") },
];

const concFrames: Frame[] = [
  { math: "c = \\frac{n}{V}", note: tx("The **concentration** c: amount of substance per volume of solution, in mol/L.", "Die **Stoffmengenkonzentration** c: Stoffmenge pro Volumen der Lösung, in mol/L.") },
  { math: txMap((_, l) => `\\group{n(\\ce{NaOH})} = \\frac{2 "g"}{\\group{${fx(M("NaOH"), l, 2)} "g/mol"}} = \\group{${fx(0.05, l, 2)} "mol"}`), note: tx("Example: 2 g of sodium hydroxide are dissolved in water. First the amount of substance.", "Beispiel: 2 g Natriumhydroxid werden in Wasser gelöst. Zuerst die Stoffmenge.") },
  { math: tx('V = 250 "mL" = 0.25 "L"', 'V = 250 "mL" = 0,25 "L"'), note: tx("The solution is filled up to 250 mL. Careful: turn millilitres into **litres**.", "Die Lösung wird auf 250 mL aufgefüllt. Vorsicht: Rechne Milliliter in **Liter** um.") },
  { math: tx('c = \\frac{0.05 "mol"}{0.25 "L"} = 0.2 "mol/L"', 'c = \\frac{0,05 "mol"}{0,25 "L"} = 0,2 "mol/L"'), note: tx("This sodium hydroxide solution has a concentration of 0.2 mol/L.", "Diese Natronlauge hat die Konzentration 0,2 mol/L.") },
];

const WATER_SPLIT = STOICH[0];
const stoichFrames: Frame[] = (() => {
  const ex = stoichExercise(WATER_SPLIT, [0, 2], 36);
  const frames = ex.solution;
  return [
    ...frames.slice(0, 3),
    {
      ...frames[3],
      note: tx("4. Back to the mass: $m = n \\cdot M$. From 36 g of water you get 32 g of oxygen (and 4 g of hydrogen). The masses are **not** 2 : 1, the amounts of substance are!", "4. Zurück zur Masse: $m = n \\cdot M$. Aus 36 g Wasser entstehen 32 g Sauerstoff (und 4 g Wasserstoff). Nicht die Massen stehen im Verhältnis 2 : 1, sondern die Stoffmengen!"),
    },
  ];
})();

const moles: Topic = {
  ...topicMeta("moles"),
  summary: [
    {
      title: tx("The mole", "Das Mol"),
      body: tx(
        "The amount of substance n counts particles in mol. 1 mol is $6.022 \\cdot 10^{23}$ particles (Avogadro constant).",
        "Die Stoffmenge n zählt Teilchen in mol. 1 mol sind $6,022 \\cdot 10^{23}$ Teilchen (Avogadro-Konstante).",
      ),
      examples: [tx('N_A = 6.022 \\cdot 10^{23} \\frac{1}{"mol"}', 'N_A = 6,022 \\cdot 10^{23} \\frac{1}{"mol"}'), "N = n \\cdot N_A"],
      tone: "rule",
    },
    {
      title: tx("Molar mass", "Molare Masse"),
      body: tx(
        "The mass of 1 mol, in g/mol: add up the atomic masses of all atoms. Indices, bracket factors and water of crystallisation count.",
        "Die Masse von 1 mol, in g/mol: Addiere die Atommassen aller Atome. Indizes, Faktoren hinter Klammern und Kristallwasser zählen mit.",
      ),
      examples: [txMap((_, l) => `\\group{M(\\ce{H2O})} = ${massSum("H2O", l, true)} \\approx \\group{${fx(M("H2O"), l, 2)} "g/mol"}`), txMap((_, l) => `\\group{M(\\ce{Ca(OH)2})} \\approx ${fx(M("Ca(OH)2"), l, 2)} "g/mol"`)],
      tone: "rule",
    },
    {
      title: tx("Amount, mass, molar mass", "Stoffmenge, Masse, molare Masse"),
      body: tx("One formula, three ways round. Check the units: g divided by g/mol gives mol.", "Eine Formel, drei Richtungen. Prüf die Einheiten: g geteilt durch g/mol ergibt mol."),
      examples: ["n = \\frac{m}{M} \\quad m = n \\cdot M \\quad M = \\frac{m}{n}"],
      tone: "rule",
    },
    {
      title: tx("Concentration", "Stoffmengenkonzentration"),
      body: tx("Amount of substance per volume of solution, in mol/L. Always put the volume in litres.", "Stoffmenge pro Volumen der Lösung, in mol/L. Setz das Volumen immer in Litern ein."),
      examples: ["c = \\frac{n}{V}", tx('250 "mL" = 0.25 "L"', '250 "mL" = 0,25 "L"')],
      tone: "tip",
    },
    {
      title: tx("Calculating with equations", "Mit Reaktionsgleichungen rechnen"),
      body: tx(
        "1. Balanced equation. 2. $n = \\frac{m}{M}$ of the given substance. 3. Mole ratio from the coefficients. 4. $m = n \\cdot M$ of the wanted substance. Round only at the end.",
        "1. Ausgeglichene Gleichung. 2. $n = \\frac{m}{M}$ vom gegebenen Stoff. 3. Stoffmengenverhältnis aus den Koeffizienten. 4. $m = n \\cdot M$ vom gesuchten Stoff. Erst am Ende runden.",
      ),
      examples: ["\\ce{2H2O -> 2H2 + O2}", "\\group{n(\\ce{O2})} = \\frac{1}{2} \\cdot \\group{n(\\ce{H2O})}"],
      tone: "tip",
    },
    {
      title: tx("Masses aren't in the ratio", "Massen stehen nicht im Verhältnis"),
      body: tx(
        "The coefficients give the ratio of **amounts of substance**, never of masses. 36 g of water don't give 18 g of oxygen, but 32 g.",
        "Die Koeffizienten geben das Verhältnis der **Stoffmengen** an, nie der Massen. Aus 36 g Wasser entstehen nicht 18 g Sauerstoff, sondern 32 g.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("The mole: a counting unit", "Das Mol: eine Zähleinheit"),
      blob: tx("Atoms are way too small to count one by one. So chemists count in packs!", "Atome sind viel zu klein zum Einzeln-Zählen. Also zählen Chemiker in Päckchen!"),
      body: tx(
        "The **amount of substance** n tells you how many particles a portion of a substance contains. Its unit is the **mole** (mol).",
        "Die **Stoffmenge** n gibt an, wie viele Teilchen eine Stoffportion enthält. Ihre Einheit ist das **Mol** (mol).",
      ),
      frames: moleFrames,
    },
    {
      type: "explain",
      title: tx("Molar mass", "Die molare Masse"),
      blob: tx("Counting by weighing: that's the trick. You just need the molar mass.", "Zählen durch Wiegen: Das ist der Trick. Du brauchst nur die molare Masse."),
      body: tx(
        "The atomic masses in the periodic table (in u) are also the molar masses in g/mol. For a compound you add up all its atoms.",
        "Die Atommassen im Periodensystem (in u) sind zugleich die molaren Massen in g/mol. Bei einer Verbindung addierst du alle ihre Atome.",
      ),
      frames: molarFrames,
    },
    { type: "check", blob: tx("Carbon dioxide: one C, two O. Your turn!", "Kohlenstoffdioxid: ein C, zwei O. Du bist dran!"), exercise: molarMassExercise(substance("CO2")) },
    {
      type: "widget",
      title: tx("The mole counter", "Der Molzähler"),
      blob: tx("Put something on the scale and watch the mol packets fill up!", "Leg etwas auf die Waage und schau, wie sich die Mol-Päckchen füllen!"),
      body: tx(
        "Slide the mass. The counter works out $n = \\frac{m}{M}$ and the number of particles live. Switch substances: the same mass gives a different number of particles, because the particles weigh differently.",
        "Verschieb die Masse. Der Zähler rechnet $n = \\frac{m}{M}$ und die Teilchenzahl live aus. Wechsle den Stoff: Dieselbe Masse ergibt eine andere Teilchenzahl, weil die Teilchen verschieden schwer sind.",
      ),
      widget: MolesCounter,
    },
    {
      type: "explain",
      title: tx("n = m/M and its friends", "n = m/M und ihre Freunde"),
      blob: tx("One formula, rearranged three ways. Units are your safety net.", "Eine Formel, dreimal umgestellt. Die Einheiten sind dein Sicherheitsnetz."),
      body: tx("From mass to amount of substance and back, and from there to the number of particles.", "Von der Masse zur Stoffmenge und zurück, und von dort zur Teilchenzahl."),
      frames: formulaFrames,
    },
    { type: "check", blob: tx("A classic: a spoonful of table salt.", "Ein Klassiker: ein Löffel Kochsalz."), exercise: amountExercise(substance("NaCl"), 11.7) },
    {
      type: "explain",
      title: tx("Concentration", "Die Stoffmengenkonzentration"),
      blob: tx("How strong is a solution? Count the mol per litre.", "Wie stark ist eine Lösung? Zähl die mol pro Liter."),
      body: tx("The concentration tells you how much substance is dissolved in each litre of solution.", "Die Konzentration sagt, wie viel Stoff in jedem Liter Lösung gelöst ist."),
      frames: concFrames,
    },
    { type: "check", blob: tx("Watch the millilitres!", "Achte auf die Milliliter!"), exercise: concentrationExercise(substance("NaCl"), 0.1, 500) },
    {
      type: "explain",
      title: tx("Calculating with reaction equations", "Mit Reaktionsgleichungen rechnen"),
      blob: tx("How much product do I get? Four steps, always the same.", "Wie viel Produkt bekomme ich? Vier Schritte, immer gleich."),
      body: tx(
        "The coefficients of a balanced equation tell you the ratio of the **amounts of substance**. So you always go via mol: mass → amount → ratio → amount → mass.",
        "Die Koeffizienten einer ausgeglichenen Gleichung geben das Verhältnis der **Stoffmengen** an. Du gehst also immer über mol: Masse → Stoffmenge → Verhältnis → Stoffmenge → Masse.",
      ),
      frames: stoichFrames,
    },
    { type: "check", blob: tx("Natural gas burns. How much water forms?", "Erdgas verbrennt. Wie viel Wasser entsteht?"), exercise: stoichExercise(STOICH[2], [0, 3], 8) },
  ],
  generate,
};

export default moles;
