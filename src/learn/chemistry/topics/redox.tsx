"use client";

import type { Locale } from "@/i18n/config";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import { balanceMistakes, coefSrc, solve, strategy } from "../balancing-core";
import { element } from "../elements";
import { HALVES, LAB_METALS, OX_CHANGES, metal, metalSwap, oxidationNumbers, reacts, roman, signed, type Half, type Metal, type OxChange } from "../redox-data";
import { RedoxSeries } from "../visuals/RedoxSeries";
import { RedoxTransfer } from "../visuals/RedoxTransfer";

// ---------------------------------------------------------------------------
// Helpers

const m = (build: (r: (t: Text) => string, l: Locale) => string): Text => txMap((_, l) => build((t) => resolveText(t, l), l));
const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ce = (s: string) => `\\ce{${s}}`;
const f$ = (s: string) => `$\\ce{${s}}$`;
/** "+3", "-2", "0" for display maths. */
const sgn = (v: number) => (v > 0 ? `+${v}` : `${v}`);
/** A signed number in brackets for sums: (+1), (-2). */
const br = (v: number) => `(${sgn(v)})`;

type Wrong = { text: Text; title: Text; say: Text; close?: boolean };

function oneOf(rng: Rng | null, right: Text, wrongs: Wrong[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const items = [{ text: right, w: null as Wrong | null }, ...wrongs.map((w) => ({ text: w.text, w }))];
  const order = rng ? rng.shuffle(items) : items;
  const options = order.map((o) => o.text);
  return {
    answer: { kind: "choice", options, correct: order.findIndex((o) => o.w === null) },
    mistakes: order.flatMap((o, i): Mistake[] => (o.w ? [{ when: { kind: "choice", options, correct: i }, title: o.w.title, say: o.w.say, close: o.w.close }] : [])),
  };
}

function numberMistakes(right: number, list: [number, Text, Text, boolean?][]): Mistake[] {
  const out: Mistake[] = [];
  for (const [v, title, say, close] of list) {
    if (!Number.isFinite(v) || Math.abs(v - right) < 1e-9) continue;
    if (out.some((o) => o.when.kind === "number" && Math.abs(o.when.value - v) < 1e-9)) continue;
    out.push({ when: { kind: "number", value: v }, title, say, close });
  }
  return out;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

function multiMistakes(options: Text[], right: number[], list: [number[], Text, Text][]): Mistake[] {
  const out: Mistake[] = [];
  for (const [picked, title, say] of list) {
    if (!picked.length || sameSet(picked, right) || out.some((o) => o.when.kind === "multi" && sameSet(o.when.correct, picked))) continue;
    out.push({ when: { kind: "multi", options, correct: [...picked].sort((a, b) => a - b) }, title, say });
  }
  return out;
}

const elName = (symbol: string): Text => element(symbol)?.name ?? symbol;

/** Lines like "Oxidation: …" / "Reduktion: …" for display maths, labels in both languages. */
function halfLines(rows: { label: "ox" | "red" | "redox"; src: string }[]): Text {
  const label = { ox: tx('"Oxidation:"', '"Oxidation:"'), red: tx('"Reduction:"', '"Reduktion:"'), redox: tx('"Redox:"', '"Redox:"') };
  return m((r) => rows.map((x) => `${r(label[x.label])} \\; ${x.src}`).join(" \\\\ "));
}

// ---------------------------------------------------------------------------
// Oxidation numbers

type OxTask = { formula: string; target: string; level: 1 | 2 | 3 };

const OX_TASKS: OxTask[] = [
  // elements
  ...["Fe", "Cu", "Na", "Mg", "Zn"].map((s) => ({ formula: s, target: s, level: 1 as const })),
  ...[["O2", "O"], ["Cl2", "Cl"], ["N2", "N"], ["H2", "H"], ["S8", "S"], ["Br2", "Br"]].map(([formula, target]) => ({ formula, target, level: 1 as const })),
  // single ions
  ...[["Na+", "Na"], ["Cl-", "Cl"], ["Fe^3+", "Fe"], ["Fe^2+", "Fe"], ["O^2-", "O"], ["Al^3+", "Al"], ["S^2-", "S"], ["Cu^2+", "Cu"], ["Br-", "Br"], ["Mg^2+", "Mg"], ["Ag+", "Ag"]].map(([formula, target]) => ({ formula, target, level: 1 as const })),
  // simple compounds
  ...[["H2O", "O"], ["H2O", "H"], ["HCl", "Cl"], ["NaCl", "Na"], ["MgO", "Mg"]].map(([formula, target]) => ({ formula, target, level: 1 as const })),
  // binary compounds
  ...[["CO2", "C"], ["CO", "C"], ["SO2", "S"], ["SO3", "S"], ["NH3", "N"], ["H2S", "S"], ["CH4", "C"], ["Fe2O3", "Fe"], ["FeO", "Fe"], ["CuO", "Cu"], ["Cu2O", "Cu"], ["MnO2", "Mn"], ["NO2", "N"], ["NO", "N"], ["N2O", "N"], ["P4O10", "P"], ["PCl5", "P"], ["FeCl3", "Fe"], ["CCl4", "C"], ["SiO2", "Si"], ["PbO2", "Pb"], ["Cr2O3", "Cr"]].map(([formula, target]) => ({ formula, target, level: 2 as const })),
  // ions, oxoacids, exceptions
  ...[["H2SO4", "S"], ["HNO3", "N"], ["H3PO4", "P"], ["H2CO3", "C"], ["SO4^2-", "S"], ["SO3^2-", "S"], ["NO3-", "N"], ["NO2-", "N"], ["PO4^3-", "P"], ["CO3^2-", "C"], ["NH4+", "N"], ["MnO4-", "Mn"], ["KMnO4", "Mn"], ["K2Cr2O7", "Cr"], ["Cr2O7^2-", "Cr"], ["CrO4^2-", "Cr"], ["ClO3-", "Cl"], ["ClO4-", "Cl"], ["ClO-", "Cl"], ["H2O2", "O"], ["NaH", "H"], ["CaH2", "H"], ["OF2", "O"], ["Na2SO4", "S"], ["KNO3", "N"], ["H2SO3", "S"]].map(([formula, target]) => ({ formula, target, level: 3 as const })),
];

/** Typical oxidation numbers in compounds (what students wrongly give elements). */
const TYPICAL: Record<string, number> = { O: -2, H: 1, Cl: -1, Br: -1, N: -3, S: -2, Na: 1, Mg: 2, Zn: 2, Fe: 3, Cu: 2 };

const OZ_INSTR = tx("Find the oxidation number", "Bestimme die Oxidationszahl");

/** The sum of oxidation numbers as display maths, with x for the unknown element. */
function sumSrc(formula: string, values: Record<string, number>, counts: Record<string, number>, unknown: string, charge: number) {
  const terms = Object.keys(counts).map((el) => {
    const c = counts[el];
    if (el === unknown) return c === 1 ? "x" : `${c}x`;
    return c === 1 ? br(values[el]) : `${c} \\cdot ${br(values[el])}`;
  });
  return `${terms.join(" + ")} = ${charge}`;
}

function ozExercise(task: OxTask): Exercise {
  const res = oxidationNumbers(task.formula)!;
  const { values, counts, charge } = res;
  const v = values[task.target];
  const els = Object.keys(counts);
  const name = elName(task.target);
  const text = tx(
    `What is the oxidation number of **${en(name).toLowerCase()}** in $\\ce{${task.formula}}$? Type it as a number with its sign, e.g. +6 for +VI.`,
    `Welche Oxidationszahl hat **${de(name)}** in $\\ce{${task.formula}}$? Gib sie als Zahl mit Vorzeichen ein, z. B. +6 für +VI.`,
  );
  const base = { instruction: OZ_INSTR, text, math: ce(task.formula), answer: { kind: "number", value: v, label: `\\ce{${task.target}}:` } as AnswerSpec };
  const list: [number, Text, Text, boolean?][] = [];

  // An element on its own
  if (els.length === 1 && charge === 0) {
    list.push([
      TYPICAL[task.target] ?? 1,
      tx("Elements are 0", "Elemente haben 0"),
      tx(
        `That's what ${en(name).toLowerCase()} has in many compounds. But here it's the pure element: no electrons have moved, so every atom has oxidation number 0.`,
        `Das hat ${de(name)} in vielen Verbindungen. Hier ist es aber das reine Element: Es sind keine Elektronen gewandert, also hat jedes Atom die Oxidationszahl 0.`,
      ),
    ]);
    if (counts[task.target] > 1)
      list.push([
        counts[task.target],
        tx("The index counts atoms", "Der Index zählt Atome"),
        tx(`The ${counts[task.target]} in $\\ce{${task.formula}}$ just tells you how many atoms are bonded together. It's not a charge.`, `Die ${counts[task.target]} in $\\ce{${task.formula}}$ sagt nur, wie viele Atome aneinander gebunden sind. Das ist keine Ladung.`),
      ]);
    return {
      ...base,
      mistakes: numberMistakes(v, list),
      hint: tx("Is it an element, an ion or a compound?", "Ist das ein Element, ein Ion oder eine Verbindung?"),
      solution: [{ math: ce(task.formula), note: tx(`An element: every atom keeps its own electrons. Oxidation number **0**.`, `Ein Element: Jedes Atom behält seine eigenen Elektronen. Oxidationszahl **0**.`) }],
    };
  }

  // A single ion
  if (els.length === 1) {
    list.push([0, tx("It's an ion", "Es ist ein Ion"), tx("This isn't the element, it's an ion: it has given away or taken up electrons. Its charge tells you how many.", "Das ist nicht das Element, sondern ein Ion: Es hat Elektronen abgegeben oder aufgenommen. Seine Ladung verrät, wie viele.")]);
    list.push([
      -v,
      tx("Sign of the charge", "Vorzeichen der Ladung"),
      v > 0
        ? tx("The sign carries straight over from the charge: a positive ion has a positive oxidation number.", "Das Vorzeichen wird direkt von der Ladung übernommen: Ein positives Ion hat eine positive Oxidationszahl.")
        : tx("The sign carries straight over from the charge: a negative ion has a negative oxidation number.", "Das Vorzeichen wird direkt von der Ladung übernommen: Ein negatives Ion hat eine negative Oxidationszahl."),
      true,
    ]);
    return {
      ...base,
      mistakes: numberMistakes(v, list),
      hint: tx("For a single-atom ion, look at the charge.", "Bei einem einatomigen Ion schau auf die Ladung."),
      solution: [{ math: ce(task.formula), note: tx(`A single-atom ion: its oxidation number is its charge, **${roman(v)}**.`, `Ein einatomiges Ion: Seine Oxidationszahl ist seine Ladung, **${roman(v)}**.`) }],
    };
  }

  // A compound or a polyatomic ion
  const u = res.unknown ?? task.target;
  const unknownIsTarget = u === task.target;
  const known = els.filter((el) => el !== u);
  const rest = known.reduce((s, el) => s + values[el] * counts[el], 0);
  const cu = counts[u];
  const knownNote = (l: Locale) =>
    known
      .map((el) => `${resolveText(elName(el), l)} ${roman(values[el])}`)
      .join(l === "de" ? ", " : ", ");
  const special =
    task.formula === "H2O2" || task.formula === "Na2O2"
      ? tx("Careful: it's a **peroxide** (O–O bond), so O is −I here.", "Achtung: Das ist ein **Peroxid** (O–O-Bindung), O hat hier −I.")
      : task.formula === "OF2"
        ? tx("Fluorine always wins: F is −I, so here oxygen has to be positive.", "Fluor gewinnt immer: F ist −I, also muss Sauerstoff hier positiv sein.")
        : (task.formula === "NaH" || task.formula === "CaH2")
          ? tx("A **metal hydride**: the metal is positive, so hydrogen is −I here.", "Ein **Metallhydrid**: Das Metall ist positiv, also hat Wasserstoff hier −I.")
          : null;

  if (unknownIsTarget) {
    // indices ignored: every known element counted once, the unknown once
    const once = charge - known.reduce((s, el) => s + values[el], 0);
    const multi = known.find((el) => counts[el] > 1);
    if (multi)
      list.push([
        once,
        tx("Indices forgotten", "Indizes vergessen"),
        tx(
          `Close, but each atom counts! Multiply every oxidation number by its index: $\\ce{${multi}${counts[multi]}}$ means ${counts[multi]} times ${roman(values[multi])}.`,
          `Fast, aber jedes Atom zählt! Multipliziere jede Oxidationszahl mit ihrem Index: $\\ce{${multi}${counts[multi]}}$ heißt ${counts[multi]}-mal ${roman(values[multi])}.`,
        ),
      ]);
    if (cu > 1) list.push([v * cu, tx(`Divide by ${cu}`, `Durch ${cu} teilen`), tx(`That's the total for all ${cu} ${en(name).toLowerCase()} atoms together. Each single atom gets its share: divide by ${cu}.`, `Das ist die Summe für alle ${cu} ${de(name)}-Atome zusammen. Jedes einzelne Atom bekommt seinen Anteil: Teile durch ${cu}.`)]);
    if (charge !== 0) {
      list.push([(0 - rest) / cu, tx("The sum is the charge", "Die Summe ist die Ladung"), tx(`In an ion the oxidation numbers don't add up to 0 but to the ion's charge, here ${signed(charge)}.`, `In einem Ion ergeben die Oxidationszahlen zusammen nicht 0, sondern die Ladung des Ions, hier ${signed(charge)}.`)]);
      list.push([charge, tx("Charge of the whole ion", "Ladung des ganzen Ions"), tx("The charge belongs to the **whole** ion, not to one atom. Work out the atom's share with the sum rule.", "Die Ladung gehört zum **ganzen** Ion, nicht zu einem Atom. Rechne den Anteil des Atoms mit der Summenregel aus.")]);
    }
    if ("H" in counts && u !== "H") {
      const noH = (charge - (rest - values.H * counts.H)) / cu;
      if (Number.isInteger(noH))
        list.push([
          noH,
          tx("Hydrogen forgotten", "Wasserstoff vergessen"),
          counts.H === 1
            ? tx(`Did you leave out the hydrogen? The H in $\\ce{${task.formula}}$ has +I, and it counts too.`, `Hast du den Wasserstoff weggelassen? Das H in $\\ce{${task.formula}}$ hat +I, und das zählt mit.`)
            : tx(`Did you leave out the hydrogen? $\\ce{${task.formula}}$ has ${counts.H} H with +I each, and they count too.`, `Hast du den Wasserstoff weggelassen? $\\ce{${task.formula}}$ hat ${counts.H} H mit je +I, die zählen mit.`),
        ]);
    }
    if (v !== 0) list.push([-v, tx("Check the sign", "Prüf das Vorzeichen"), tx(`Nearly! Look at the sign again: the known oxidation numbers add up to ${signed(rest)}, so the unknown one has to balance that.`, `Fast! Schau noch mal aufs Vorzeichen: Die bekannten Oxidationszahlen ergeben zusammen ${signed(rest)}, die unbekannte muss das ausgleichen.`), true]);
  }
  if (task.formula === "H2O2" || task.formula === "Na2O2") list.unshift([-2, tx("A peroxide!", "Ein Peroxid!"), tx("Usually O is −II, but this is a peroxide: the two O atoms are bonded to each other. Work it out with the sum rule.", "Normalerweise hat O −II, aber das ist ein Peroxid: Die beiden O-Atome sind aneinander gebunden. Rechne mit der Summenregel.")]);
  if (task.formula === "NaH" || task.formula === "CaH2") list.unshift([1, tx("A metal hydride!", "Ein Metallhydrid!"), tx("Usually H is +I, but here it's bonded to a metal, and the metal is always positive. So hydrogen must be negative.", "Normalerweise hat H +I, aber hier hängt es an einem Metall, und das ist immer positiv. Also muss Wasserstoff negativ sein.")]);
  if (task.formula === "OF2") list.unshift([-2, tx("Fluorine wins", "Fluor gewinnt"), tx("Usually O is −II, but fluorine is even more electronegative: F is always −I. Work it out with the sum rule.", "Normalerweise hat O −II, aber Fluor ist noch elektronegativer: F hat immer −I. Rechne mit der Summenregel.")]);

  const solution: Frame[] = [
    {
      math: ce(task.formula),
      note: txMap((t, l) =>
        [special ? resolveText(special, l) : "", known.length ? t(`Known: ${knownNote(l)}. Call ${resolveText(elName(u), l).toLowerCase()} $x$.`, `Bekannt: ${knownNote(l)}. Nenn ${resolveText(elName(u), l)} $x$.`) : ""].filter(Boolean).join(" "),
      ),
    },
    {
      math: sumSrc(task.formula, values, counts, u, charge),
      note: charge === 0 ? tx("In a compound all oxidation numbers add up to 0.", "In einer Verbindung ergeben alle Oxidationszahlen zusammen 0.") : tx(`In an ion they add up to the charge, ${signed(charge)}.`, `In einem Ion ergeben sie zusammen die Ladung, ${signed(charge)}.`),
    },
  ];
  if (cu > 1) solution.push({ math: `${cu}x = ${charge - rest} \\quad \\Rightarrow \\quad x = ${sgn(values[u])}`, note: tx(`Divide by ${cu}: each atom has ${roman(values[u])}.`, `Durch ${cu} teilen: Jedes Atom hat ${roman(values[u])}.`) });
  else solution.push({ math: `x = ${sgn(values[u])}`, note: tx(`So ${en(elName(u)).toLowerCase()} has the oxidation number **${roman(values[u])}**.`, `${de(elName(u))} hat also die Oxidationszahl **${roman(values[u])}**.`) });
  if (!unknownIsTarget) solution.push({ math: `${ce(task.target)}: \\; ${sgn(v)}`, note: tx(`The question was about ${en(name).toLowerCase()}: **${roman(v)}**.`, `Gefragt war nach ${de(name)}: **${roman(v)}**.`) });

  return {
    ...base,
    mistakes: numberMistakes(v, list),
    hint: special ?? tx("Start with what you know (H +I, O −II, metals positive). All oxidation numbers together give 0, or the charge of an ion.", "Fang mit dem an, was du kennst (H +I, O −II, Metalle positiv). Alle Oxidationszahlen zusammen ergeben 0, bei Ionen die Ladung."),
    solution,
  };
}

function ozTask(rng: Rng, level: Level): Exercise {
  return ozExercise(rng.pick(OX_TASKS.filter((x) => x.level === level)));
}

// ---------------------------------------------------------------------------
// Half-equations

/** The half-equation with a box instead of the electron count. */
function halfGap(eq: string) {
  const mm = eq.match(/(\d*)e-/)!;
  const i = mm.index!;
  const before = eq.slice(0, i).trim();
  const after = eq.slice(i + mm[0].length).trim();
  return `${before ? `\\ce{${before}} ` : ""}\\box{?} \\ce{e-${after ? ` ${after}` : ""}}`;
}

/** Charges on each side without the electrons. */
function charges(eq: string) {
  const [l, r] = eq.split(" -> ");
  const q = (side: string) =>
    side
      .split(" + ")
      .map((s) => s.trim())
      .filter((s) => !/^\d*e-$/.test(s))
      .reduce((sum, s) => {
        const mm = s.match(/^(\d*)(.*)$/)!;
        const c = s.match(/\^(\d*)([+-])$|([+-])$/);
        const z = c ? (c[2] ?? c[3]) === "-" ? -Number(c[1] || 1) : Number(c[1] || 1) : 0;
        return sum + (mm[1] ? Number(mm[1]) : 1) * z;
      }, 0);
  return [q(l), q(r)];
}

function halfElectrons(rng: Rng, level: Level): Exercise {
  const h = rng.pick(HALVES.filter((x) => x.level <= level && (level === 1 || x.level >= level - 1)));
  const [ql, qr] = charges(h.eq);
  const list: [number, Text, Text, boolean?][] = [];
  if (h.slip) list.push([h.slip.value, h.slip.title, h.slip.say]);
  list.push([-h.electrons, tx("Electrons are counted positive", "Elektronen zählt man positiv"), tx("Just the number of electrons, without a minus: the minus is already in $\\ce{e-}$.", "Nur die Anzahl der Elektronen, ohne Minus: Das Minus steckt schon im $\\ce{e-}$."), true]);
  list.push([0, tx("Charges must match", "Die Ladungen müssen stimmen"), tx(`Check the charges: without electrons the left side has ${signed(ql)}, the right side ${signed(qr)}. The electrons make up the difference.`, `Prüf die Ladungen: Ohne Elektronen hat die linke Seite ${signed(ql)}, die rechte ${signed(qr)}. Die Elektronen gleichen den Unterschied aus.`)]);
  return {
    instruction: tx("How many electrons?", "Wie viele Elektronen?"),
    text: tx("Fill in the number of electrons so that the charges on both sides match.", "Ergänze die Zahl der Elektronen, sodass die Ladungen auf beiden Seiten übereinstimmen."),
    math: halfGap(h.eq),
    answer: { kind: "number", value: h.electrons },
    mistakes: numberMistakes(h.electrons, list),
    hint: tx("Add up the charges on each side. Each electron brings one negative charge.", "Zähl die Ladungen auf jeder Seite zusammen. Jedes Elektron bringt eine negative Ladung mit."),
    solution: [
      { math: halfGap(h.eq), note: tx(`Without electrons: left ${signed(ql)}, right ${signed(qr)}.`, `Ohne Elektronen: links ${signed(ql)}, rechts ${signed(qr)}.`) },
      {
        math: ce(h.eq),
        note: tx(
          `**${h.electrons}** electron${h.electrons > 1 ? "s" : ""} make${h.electrons > 1 ? "" : "s"} both sides equal. Electrons on the ${h.kind === "ox" ? "right: given away, an **oxidation**" : "left: taken up, a **reduction**"}.`,
          `**${h.electrons}** Elektron${h.electrons > 1 ? "en gleichen" : " gleicht"} beide Seiten aus. Elektronen ${h.kind === "ox" ? "rechts: abgegeben, eine **Oxidation**" : "links: aufgenommen, eine **Reduktion**"}.`,
        ),
      },
    ],
  };
}

const OX_OPT = tx("Oxidation: electrons are given away.", "Oxidation: Elektronen werden abgegeben.");
const RED_OPT = tx("Reduction: electrons are taken up.", "Reduktion: Elektronen werden aufgenommen.");

function halfType(rng: Rng): Exercise {
  const h: Half = rng.pick(HALVES.filter((x) => x.level <= 2));
  const ox = h.kind === "ox";
  const options = [OX_OPT, RED_OPT];
  return {
    instruction: tx("Oxidation or reduction?", "Oxidation oder Reduktion?"),
    text: tx("Which process does this half-equation show?", "Welchen Vorgang zeigt diese Teilgleichung?"),
    math: ce(h.eq),
    answer: { kind: "choice", options, correct: ox ? 0 : 1 },
    mistakes: [
      {
        when: { kind: "choice", options, correct: ox ? 1 : 0 },
        title: tx("Where are the electrons?", "Wo stehen die Elektronen?"),
        say: ox
          ? tx("Look where the electrons are: on the **right**, so they come **out** of the particle. It gives them away.", "Schau, wo die Elektronen stehen: **rechts**, sie kommen also **aus** dem Teilchen heraus. Es gibt sie ab.")
          : tx("Look where the electrons are: on the **left**, so they go **into** the reaction. The particle takes them up.", "Schau, wo die Elektronen stehen: **links**, sie gehen also **in** die Reaktion hinein. Das Teilchen nimmt sie auf."),
      },
    ],
    hint: tx("Electrons on the right: given away. Electrons on the left: taken up.", "Elektronen rechts: abgegeben. Elektronen links: aufgenommen."),
    solution: [{ math: ce(h.eq), note: ox ? tx("The electrons are on the right: they are given away. That's an **oxidation**.", "Die Elektronen stehen rechts: Sie werden abgegeben. Das ist eine **Oxidation**.") : tx("The electrons are on the left: they are taken up. That's a **reduction**.", "Die Elektronen stehen links: Sie werden aufgenommen. Das ist eine **Reduktion**.") }],
  };
}

// ---------------------------------------------------------------------------
// Concepts

type Concept = { q: Text; right: Text; wrongs: Wrong[]; math: Text; note: Text; hint: Text };

const ELECTRONS_UP: Wrong = {
  text: tx("taking up electrons", "Elektronenaufnahme"),
  title: tx("The other way round", "Andersherum"),
  say: tx("The classic mix-up! Taking up electrons is **reduction**. Oxidation is the opposite.", "Die klassische Verwechslung! Elektronen aufnehmen ist eine **Reduktion**. Oxidation ist das Gegenteil."),
};

const CONCEPTS_1: Concept[] = [
  {
    q: tx("Today, **oxidation** is defined as…", "Nach der heutigen Definition ist eine **Oxidation** …"),
    right: tx("giving away electrons", "Elektronenabgabe"),
    wrongs: [
      ELECTRONS_UP,
      { text: tx("taking up protons", "Protonenaufnahme"), title: tx("Protons belong to acids", "Protonen gehören zu Säuren"), say: tx("Protons moving: that's acids and bases. Redox is about **electrons**.", "Wandernde Protonen: Das sind Säuren und Basen. Bei Redoxreaktionen geht es um **Elektronen**.") },
      { text: tx("giving away oxygen", "Sauerstoffabgabe"), title: tx("That's reduction", "Das ist eine Reduktion"), say: tx("In the old definition, giving away oxygen was **reduction**. And today we look at electrons anyway.", "Nach der alten Definition ist Sauerstoffabgabe eine **Reduktion**. Und heute schaut man sowieso auf die Elektronen.") },
    ],
    math: "\\ce{Mg -> Mg^2+ + 2e-}",
    note: tx("Magnesium gives away two electrons: an **oxidation**.", "Magnesium gibt zwei Elektronen ab: eine **Oxidation**."),
    hint: tx("Think of magnesium becoming $\\ce{Mg^2+}$. What happens to its electrons?", "Denk an Magnesium, das zu $\\ce{Mg^2+}$ wird. Was passiert mit seinen Elektronen?"),
  },
  {
    q: tx("Today, **reduction** is defined as…", "Nach der heutigen Definition ist eine **Reduktion** …"),
    right: tx("taking up electrons", "Elektronenaufnahme"),
    wrongs: [
      { text: tx("giving away electrons", "Elektronenabgabe"), title: tx("The other way round", "Andersherum"), say: tx("Giving away electrons is **oxidation**. Reduction is the opposite.", "Elektronen abgeben ist eine **Oxidation**. Reduktion ist das Gegenteil.") },
      { text: tx("giving away protons", "Protonenabgabe"), title: tx("Protons belong to acids", "Protonen gehören zu Säuren"), say: tx("Giving away protons is what acids do. Redox is about **electrons**.", "Protonen abgeben machen Säuren. Bei Redoxreaktionen geht es um **Elektronen**.") },
      { text: tx("taking up oxygen", "Sauerstoffaufnahme"), title: tx("That's oxidation", "Das ist eine Oxidation"), say: tx("In the old definition, taking up oxygen was **oxidation**. And today we look at electrons anyway.", "Nach der alten Definition ist Sauerstoffaufnahme eine **Oxidation**. Und heute schaut man sowieso auf die Elektronen.") },
    ],
    math: "\\ce{Cu^2+ + 2e- -> Cu}",
    note: tx("The copper ion takes up two electrons: a **reduction**.", "Das Kupfer-Ion nimmt zwei Elektronen auf: eine **Reduktion**."),
    hint: tx("Think of $\\ce{Cu^2+}$ becoming copper metal. What does it need?", "Denk an $\\ce{Cu^2+}$, das zu Kupfer wird. Was braucht es dafür?"),
  },
  {
    q: tx("Why do oxidation and reduction always happen together?", "Warum laufen Oxidation und Reduktion immer gemeinsam ab?"),
    right: tx("Electrons can't just vanish: what one particle gives away, another must take up.", "Elektronen verschwinden nicht einfach: Was ein Teilchen abgibt, muss ein anderes aufnehmen."),
    wrongs: [
      { text: tx("Because oxygen is always involved.", "Weil immer Sauerstoff beteiligt ist."), title: tx("Not always oxygen", "Nicht immer Sauerstoff"), say: tx("Sodium and chlorine react to sodium chloride without any oxygen, and it's still a redox reaction.", "Natrium und Chlor reagieren ganz ohne Sauerstoff zu Natriumchlorid, und das ist trotzdem eine Redoxreaktion.") },
      { text: tx("Because oxidation and reduction are the same thing.", "Weil Oxidation und Reduktion dasselbe sind."), title: tx("Two different halves", "Zwei verschiedene Hälften"), say: tx("They are opposites: one gives electrons away, the other takes them up. Why do they need each other?", "Sie sind Gegenteile: Eins gibt Elektronen ab, das andere nimmt sie auf. Warum brauchen sie einander?") },
      { text: tx("Because every reaction gives off heat.", "Weil jede Reaktion Wärme abgibt."), title: tx("Heat is another story", "Wärme ist eine andere Geschichte"), say: tx("Not every reaction gives off heat, and heat doesn't explain it. Follow the electrons.", "Nicht jede Reaktion gibt Wärme ab, und Wärme erklärt das nicht. Verfolge die Elektronen.") },
    ],
    math: "\\ce{2Na + Cl2 -> 2NaCl}",
    note: tx("Sodium gives away electrons only because chlorine takes them up: a **redox reaction** is an electron transfer.", "Natrium gibt nur Elektronen ab, weil Chlor sie aufnimmt: Eine **Redoxreaktion** ist ein Elektronenübergang."),
    hint: tx("Where do the electrons go that one particle gives away?", "Wo bleiben die Elektronen, die ein Teilchen abgibt?"),
  },
  {
    q: tx("In the **old** definition, an oxidation is…", "Nach der **alten** Definition ist eine Oxidation …"),
    right: tx("a reaction with oxygen.", "eine Reaktion mit Sauerstoff."),
    wrongs: [
      { text: tx("giving away oxygen.", "die Abgabe von Sauerstoff."), title: tx("That's reduction", "Das ist eine Reduktion"), say: tx("Giving away oxygen was called **reduction**, like copper oxide turning back into copper.", "Sauerstoffabgabe hieß **Reduktion**, z. B. wenn Kupferoxid wieder zu Kupfer wird.") },
      { text: tx("a reaction with hydrogen.", "eine Reaktion mit Wasserstoff."), title: tx("The name gives it away", "Der Name verrät es"), say: tx("Oxidation comes from oxygen (Latin *oxygenium*). Which element is it about?", "Oxidation kommt von Oxygenium, dem lateinischen Namen von Sauerstoff. Um welches Element geht es?") },
      { text: tx("a reaction with acids.", "eine Reaktion mit Säuren."), title: tx("Not acids", "Nicht Säuren"), say: tx("Acids are about protons. The old definition of oxidation is about one particular element.", "Bei Säuren geht es um Protonen. Die alte Definition der Oxidation dreht sich um ein bestimmtes Element.") },
    ],
    math: "\\ce{2Mg + O2 -> 2MgO}",
    note: tx("Magnesium burns: it reacts with oxygen. In the old definition, that's an **oxidation**.", "Magnesium verbrennt: Es reagiert mit Sauerstoff. Nach der alten Definition ist das eine **Oxidation**."),
    hint: tx("Listen to the word: oxi-dation.", "Hör auf das Wort: Oxi-dation."),
  },
];

const CONCEPTS_2: Concept[] = [
  {
    q: tx("An **oxidising agent**…", "Ein **Oxidationsmittel** …"),
    right: tx("takes up electrons and is reduced itself.", "nimmt Elektronen auf und wird dabei selbst reduziert."),
    wrongs: [
      { text: tx("gives away electrons and is oxidised itself.", "gibt Elektronen ab und wird dabei selbst oxidiert."), title: tx("That's the reducing agent", "Das ist das Reduktionsmittel"), say: tx("That describes the **reducing agent**. The oxidising agent oxidises the other particle by taking its electrons.", "Das beschreibt das **Reduktionsmittel**. Das Oxidationsmittel oxidiert das andere Teilchen, indem es ihm Elektronen abnimmt.") },
      { text: tx("takes up electrons and is oxidised itself.", "nimmt Elektronen auf und wird dabei selbst oxidiert."), title: tx("Taking up is reduction", "Aufnehmen ist Reduktion"), say: tx("The first half is right! But taking up electrons is a **reduction**, not an oxidation.", "Die erste Hälfte stimmt! Aber Elektronen aufnehmen ist eine **Reduktion**, keine Oxidation."), close: true },
      { text: tx("is always oxygen.", "ist immer Sauerstoff."), title: tx("Not only oxygen", "Nicht nur Sauerstoff"), say: tx("Oxygen is a famous one, but chlorine or copper ions are oxidising agents too. What do they all do?", "Sauerstoff ist ein berühmtes, aber auch Chlor oder Kupfer-Ionen sind Oxidationsmittel. Was tun sie alle?") },
    ],
    math: "\\ce{Fe + Cu^2+ -> Fe^2+ + Cu}",
    note: tx("$\\ce{Cu^2+}$ takes electrons from iron: it oxidises the iron and is reduced itself. It's the **oxidising agent**.", "$\\ce{Cu^2+}$ nimmt dem Eisen Elektronen ab: Es oxidiert das Eisen und wird selbst reduziert. Es ist das **Oxidationsmittel**."),
    hint: tx("An oxidising agent makes the **other** particle be oxidised. What does it have to do with the electrons?", "Ein Oxidationsmittel sorgt dafür, dass das **andere** Teilchen oxidiert wird. Was muss es dafür mit den Elektronen tun?"),
  },
  {
    q: tx("A **reducing agent**…", "Ein **Reduktionsmittel** …"),
    right: tx("gives away electrons and is oxidised itself.", "gibt Elektronen ab und wird dabei selbst oxidiert."),
    wrongs: [
      { text: tx("takes up electrons and is reduced itself.", "nimmt Elektronen auf und wird dabei selbst reduziert."), title: tx("That's the oxidising agent", "Das ist das Oxidationsmittel"), say: tx("That describes the **oxidising agent**. The reducing agent reduces the other particle by giving it electrons.", "Das beschreibt das **Oxidationsmittel**. Das Reduktionsmittel reduziert das andere Teilchen, indem es ihm Elektronen gibt.") },
      { text: tx("gives away electrons and is reduced itself.", "gibt Elektronen ab und wird dabei selbst reduziert."), title: tx("Giving away is oxidation", "Abgeben ist Oxidation"), say: tx("The first half is right! But giving away electrons is an **oxidation**, not a reduction.", "Die erste Hälfte stimmt! Aber Elektronen abgeben ist eine **Oxidation**, keine Reduktion."), close: true },
      { text: tx("removes oxygen from the air.", "entfernt Sauerstoff aus der Luft."), title: tx("Think electrons", "Denk an Elektronen"), say: tx("Reducing agents don't clean the air. Think about what happens to the electrons.", "Reduktionsmittel reinigen nicht die Luft. Denk daran, was mit den Elektronen passiert.") },
    ],
    math: "\\ce{Fe + Cu^2+ -> Fe^2+ + Cu}",
    note: tx("Iron gives its electrons to $\\ce{Cu^2+}$: it reduces the copper ions and is oxidised itself. It's the **reducing agent**.", "Eisen gibt seine Elektronen an $\\ce{Cu^2+}$ ab: Es reduziert die Kupfer-Ionen und wird selbst oxidiert. Es ist das **Reduktionsmittel**."),
    hint: tx("A reducing agent makes the **other** particle be reduced. What does it have to do with the electrons?", "Ein Reduktionsmittel sorgt dafür, dass das **andere** Teilchen reduziert wird. Was muss es dafür mit den Elektronen tun?"),
  },
  {
    q: tx("What happens to the oxidation number of an atom that is **oxidised**?", "Was passiert mit der Oxidationszahl eines Atoms, das **oxidiert** wird?"),
    right: tx("It goes up.", "Sie steigt."),
    wrongs: [
      { text: tx("It goes down.", "Sie sinkt."), title: tx("Electrons are negative", "Elektronen sind negativ"), say: tx("The atom gives away electrons, and electrons are **negative**. Losing negative charge makes the number go… which way?", "Das Atom gibt Elektronen ab, und Elektronen sind **negativ**. Wer negative Ladung verliert, dessen Zahl geht … in welche Richtung?") },
      { text: tx("It stays the same.", "Sie bleibt gleich."), title: tx("Something changes", "Da ändert sich was"), say: tx("If an atom gives away electrons, its charge changes, and so does its oxidation number.", "Wenn ein Atom Elektronen abgibt, ändert sich seine Ladung und damit auch seine Oxidationszahl.") },
      { text: tx("It becomes 0.", "Sie wird 0."), title: tx("0 is for elements", "0 haben Elemente"), say: tx("0 is the oxidation number of elements. Think of iron becoming $\\ce{Fe^3+}$: from 0 to …?", "0 ist die Oxidationszahl von Elementen. Denk an Eisen, das zu $\\ce{Fe^3+}$ wird: von 0 nach …?") },
    ],
    math: "\\ce{Fe -> Fe^3+ + 3e-}",
    note: tx("Iron goes from 0 to +III: oxidation means the oxidation number **rises**.", "Eisen geht von 0 auf +III: Bei einer Oxidation **steigt** die Oxidationszahl."),
    hint: tx("Think of iron becoming $\\ce{Fe^3+}$.", "Denk an Eisen, das zu $\\ce{Fe^3+}$ wird."),
  },
];

function concept(rng: Rng, list: Concept[]): Exercise {
  const c = rng.pick(list);
  const { answer, mistakes } = oneOf(rng, c.right, c.wrongs);
  return { instruction: tx("Choose the right answer", "Wähle die richtige Antwort"), text: c.q, answer, mistakes, hint: c.hint, solution: [{ math: c.math, note: c.note }] };
}

// ---------------------------------------------------------------------------
// Who is oxidised, who is reduced?

/** Old definition: who takes up oxygen, who gives it away? */
function oxygenTransfer(rng: Rng): Exercise {
  const x = rng.pick(OX_CHANGES.filter((c) => ["CuO + H2 -> Cu + H2O", "2CuO + C -> 2Cu + CO2", "Fe2O3 + 3CO -> 2Fe + 3CO2", "Fe2O3 + 2Al -> Al2O3 + 2Fe", "2Mg + CO2 -> 2MgO + C"].includes(c.ce)));
  const askOx = rng.chance(0.5);
  const [l, r] = x.ce.split(" -> ");
  const strip = (s: string) => s.replace(/^\d+/, "");
  const leftsRaw = l.split(" + ");
  const rights = r.split(" + ").map(strip);
  const right = askOx ? x.reducer : x.oxidiser;
  const other = askOx ? x.oxidiser : x.reducer;
  const wrongs: Wrong[] = [
    {
      text: f$(other),
      title: askOx ? tx("That one loses oxygen", "Der gibt Sauerstoff ab") : tx("That one gains oxygen", "Der nimmt Sauerstoff auf"),
      say: askOx
        ? tx(`$\\ce{${other}}$ gives its oxygen away: that's a **reduction**. Which substance takes the oxygen?`, `$\\ce{${other}}$ gibt seinen Sauerstoff ab: Das ist eine **Reduktion**. Welcher Stoff nimmt den Sauerstoff auf?`)
        : tx(`$\\ce{${other}}$ takes oxygen up: that's an **oxidation**. Which substance loses its oxygen?`, `$\\ce{${other}}$ nimmt Sauerstoff auf: Das ist eine **Oxidation**. Welcher Stoff verliert seinen Sauerstoff?`),
    },
    ...rights.map((s) => ({
      text: f$(s),
      title: tx("That's a product", "Das ist ein Produkt"),
      say: tx("That substance only forms in the reaction. Look at the starting substances on the left.", "Dieser Stoff entsteht erst bei der Reaktion. Schau auf die Ausgangsstoffe links."),
    })),
  ];
  const { answer, mistakes } = oneOf(rng, f$(right), wrongs);
  return {
    instruction: askOx ? tx("What is oxidised?", "Was wird oxidiert?") : tx("What is reduced?", "Was wird reduziert?"),
    text: askOx
      ? tx("Old definition: which substance is **oxidised**, so it takes up oxygen?", "Alte Definition: Welcher Stoff wird **oxidiert**, nimmt also Sauerstoff auf?")
      : tx("Old definition: which substance is **reduced**, so it gives oxygen away?", "Alte Definition: Welcher Stoff wird **reduziert**, gibt also Sauerstoff ab?"),
    math: ce(x.ce),
    answer,
    mistakes,
    hint: tx("Follow the oxygen atoms: who has them before, who has them afterwards?", "Verfolge die Sauerstoffatome: Wer hat sie vorher, wer hat sie danach?"),
    solution: [
      { math: ce(x.ce), note: tx(`$\\ce{${x.oxidiser}}$ gives its oxygen to $\\ce{${x.reducer}}$.`, `$\\ce{${x.oxidiser}}$ gibt seinen Sauerstoff an $\\ce{${x.reducer}}$ ab.`) },
      {
        math: leftsRaw.map((s) => (strip(s) === right ? `\\hl{\\ce{${s}}}` : ce(s))).join(" + ") + ` \\ce{->} ${ce(r)}`,
        note: askOx ? tx(`$\\ce{${right}}$ takes up oxygen: it is **oxidised**. At the same time $\\ce{${other}}$ is reduced.`, `$\\ce{${right}}$ nimmt Sauerstoff auf: Es wird **oxidiert**. Gleichzeitig wird $\\ce{${other}}$ reduziert.`) : tx(`$\\ce{${right}}$ gives oxygen away: it is **reduced**. At the same time $\\ce{${other}}$ is oxidised.`, `$\\ce{${right}}$ gibt Sauerstoff ab: Es wird **reduziert**. Gleichzeitig wird $\\ce{${other}}$ oxidiert.`),
      },
    ],
  };
}

type Role = "oxidised" | "reduced" | "oxidiser" | "reducer";

const ROLE_Q: Record<Role, Text> = {
  oxidised: tx("Which particle is **oxidised**?", "Welches Teilchen wird **oxidiert**?"),
  reduced: tx("Which particle is **reduced**?", "Welches Teilchen wird **reduziert**?"),
  oxidiser: tx("Which particle is the **oxidising agent**?", "Welches Teilchen ist das **Oxidationsmittel**?"),
  reducer: tx("Which particle is the **reducing agent**?", "Welches Teilchen ist das **Reduktionsmittel**?"),
};

/** Pairs (reducing metal, ions of a nobler metal) for ionic equations. */
const SWAPS: [string, string][] = [
  ["Zn", "Cu"],
  ["Fe", "Cu"],
  ["Mg", "Cu"],
  ["Cu", "Ag"],
  ["Zn", "Ag"],
  ["Mg", "Zn"],
  ["Zn", "Fe"],
  ["Fe", "Ag"],
  ["Al", "Cu"],
  ["Mg", "Ag"],
  ["Mg", "Fe"],
];

/** Halogens: the stronger one takes electrons from the ions of the weaker one. */
const HALOGEN_SWAPS = [
  { ce: "Cl2 + 2Br- -> 2Cl- + Br2", species: ["Cl2", "Br-", "Cl-", "Br2"], reducer: "Br-", oxidiser: "Cl2" },
  { ce: "Cl2 + 2I- -> 2Cl- + I2", species: ["Cl2", "I-", "Cl-", "I2"], reducer: "I-", oxidiser: "Cl2" },
  { ce: "Br2 + 2I- -> 2Br- + I2", species: ["Br2", "I-", "Br-", "I2"], reducer: "I-", oxidiser: "Br2" },
];

function agentChoice(rng: Rng, level: Level): Exercise {
  let ceq: string;
  let reducer: string;
  let oxidiser: string;
  let products: string[];
  if (level === 3 && rng.chance(0.4)) {
    const h = rng.pick(HALOGEN_SWAPS);
    ceq = h.ce;
    reducer = h.reducer;
    oxidiser = h.oxidiser;
    products = h.species.slice(2);
  } else {
    const [a, b] = rng.pick(SWAPS);
    const M = metal(a);
    const N = metal(b);
    const s = metalSwap(M, N);
    ceq = s.total;
    reducer = M.symbol;
    oxidiser = s.red.split(" + ")[0];
    products = [s.ox.split(" -> ")[1].split(" + ")[0], N.symbol];
  }
  const role: Role = rng.pick(["oxidised", "reduced", "oxidiser", "reducer"]);
  const right = role === "oxidised" || role === "reducer" ? reducer : oxidiser;
  const other = right === reducer ? oxidiser : reducer;
  const otherSay: Record<Role, [Text, Text]> = {
    oxidised: [tx("Taking up is reduction", "Aufnehmen ist Reduktion"), tx(`$\\ce{${other}}$ takes electrons **up**: that's a reduction. Oxidised is the particle that gives electrons away.`, `$\\ce{${other}}$ nimmt Elektronen **auf**: Das ist eine Reduktion. Oxidiert wird das Teilchen, das Elektronen abgibt.`)],
    reduced: [tx("Giving away is oxidation", "Abgeben ist Oxidation"), tx(`$\\ce{${other}}$ gives electrons **away**: that's an oxidation. Reduced is the particle that takes electrons up.`, `$\\ce{${other}}$ gibt Elektronen **ab**: Das ist eine Oxidation. Reduziert wird das Teilchen, das Elektronen aufnimmt.`)],
    oxidiser: [tx("Agent and process mixed up", "Mittel und Vorgang verwechselt"), tx(`$\\ce{${other}}$ is oxidised, so it is the **reducing** agent. The oxidising agent is the one that takes the electrons and gets **reduced**.`, `$\\ce{${other}}$ wird oxidiert, ist also das **Reduktions**mittel. Das Oxidationsmittel nimmt die Elektronen auf und wird dabei **reduziert**.`)],
    reducer: [tx("Agent and process mixed up", "Mittel und Vorgang verwechselt"), tx(`$\\ce{${other}}$ is reduced, so it is the **oxidising** agent. The reducing agent is the one that gives the electrons away and gets **oxidised**.`, `$\\ce{${other}}$ wird reduziert, ist also das **Oxidations**mittel. Das Reduktionsmittel gibt die Elektronen ab und wird dabei **oxidiert**.`)],
  };
  const wrongs: Wrong[] = [
    { text: f$(other), title: otherSay[role][0], say: otherSay[role][1] },
    ...products.map((p) => ({ text: f$(p), title: tx("That's a product", "Das ist ein Produkt"), say: tx("That particle only forms in the reaction. Look at the particles before the arrow.", "Dieses Teilchen entsteht erst bei der Reaktion. Schau auf die Teilchen vor dem Pfeil.") })),
  ];
  const { answer, mistakes } = oneOf(rng, f$(right), wrongs);
  const [l, r] = ceq.split(" -> ");
  return {
    instruction: tx("Electron transfer", "Elektronenübergang"),
    text: ROLE_Q[role],
    math: ce(ceq),
    answer,
    mistakes,
    hint: tx("First decide who gives electrons away (oxidised, reducing agent) and who takes them (reduced, oxidising agent).", "Entscheide zuerst, wer Elektronen abgibt (oxidiert, Reduktionsmittel) und wer sie aufnimmt (reduziert, Oxidationsmittel)."),
    solution: [
      { math: ce(ceq), note: tx(`$\\ce{${reducer}}$ gives electrons to $\\ce{${oxidiser}}$.`, `$\\ce{${reducer}}$ gibt Elektronen an $\\ce{${oxidiser}}$ ab.`) },
      {
        math: `${l.split(" + ").map((s) => (s.replace(/^\d+/, "") === right ? `\\hl{\\ce{${s}}}` : ce(s))).join(" + ")} \\ce{->} ${ce(r)}`,
        note:
          right === reducer
            ? tx(`$\\ce{${reducer}}$ gives electrons away: it is **oxidised** and is the **reducing agent**.`, `$\\ce{${reducer}}$ gibt Elektronen ab: Es wird **oxidiert** und ist das **Reduktionsmittel**.`)
            : tx(`$\\ce{${oxidiser}}$ takes electrons up: it is **reduced** and is the **oxidising agent**.`, `$\\ce{${oxidiser}}$ nimmt Elektronen auf: Es wird **reduziert** und ist das **Oxidationsmittel**.`),
      },
    ],
  };
}

/** Which element is oxidised, judged by oxidation numbers. */
function ozChange(rng: Rng, level: Level): Exercise {
  const x: OxChange = rng.pick(OX_CHANGES.filter((c) => c.level >= 2 && c.level <= level));
  const askOx = rng.chance(0.6);
  const right = askOx ? x.oxidised : x.reduced;
  const other = askOx ? x.reduced : x.oxidised;
  const els = Object.keys(x.change);
  const wrongs: Wrong[] = els
    .filter((el) => el !== right)
    .map((el) => {
      const [a, b] = x.change[el];
      if (el === other)
        return {
          text: f$(el),
          title: askOx ? tx("Its number goes down", "Seine Zahl sinkt") : tx("Its number goes up", "Seine Zahl steigt"),
          say: askOx
            ? tx(`The oxidation number of ${el} goes **down**, from ${roman(a)} to ${roman(b)}: it takes up electrons, so it's reduced.`, `Die Oxidationszahl von ${el} **sinkt**, von ${roman(a)} auf ${roman(b)}: Es nimmt Elektronen auf, wird also reduziert.`)
            : tx(`The oxidation number of ${el} goes **up**, from ${roman(a)} to ${roman(b)}: it gives away electrons, so it's oxidised.`, `Die Oxidationszahl von ${el} **steigt**, von ${roman(a)} auf ${roman(b)}: Es gibt Elektronen ab, wird also oxidiert.`),
        };
      return {
        text: f$(el),
        title: tx("No change", "Keine Änderung"),
        say: tx(`${el} has ${roman(a)} before and after: it's neither oxidised nor reduced. Look for a number that changes.`, `${el} hat vorher und nachher ${roman(a)}: Es wird weder oxidiert noch reduziert. Such eine Zahl, die sich ändert.`),
      };
    });
  const { answer, mistakes } = oneOf(rng, f$(right), wrongs);
  const lines = els.map((el) => {
    const [a, b] = x.change[el];
    const line = `\\ce{${el}}: \\; ${sgn(a)} \\to ${sgn(b)}`;
    return el === right ? `\\hl{${line}}` : line;
  });
  const [a, b] = x.change[right];
  return {
    instruction: tx("Use oxidation numbers", "Nutze die Oxidationszahlen"),
    text: askOx
      ? tx(`${x.where ? `This reaction happens ${en(x.where)}. ` : ""}Which element is **oxidised**?`, `${x.where ? `Diese Reaktion läuft ${de(x.where)} ab. ` : ""}Welches Element wird **oxidiert**?`)
      : tx(`${x.where ? `This reaction happens ${en(x.where)}. ` : ""}Which element is **reduced**?`, `${x.where ? `Diese Reaktion läuft ${de(x.where)} ab. ` : ""}Welches Element wird **reduziert**?`),
    math: ce(x.ce),
    answer,
    mistakes,
    hint: tx("Write the oxidation number above every element, before and after. Oxidation: it rises. Reduction: it falls.", "Schreib über jedes Element die Oxidationszahl, vorher und nachher. Oxidation: Sie steigt. Reduktion: Sie sinkt."),
    solution: [
      { math: ce(x.ce), note: tx("Find each element's oxidation number on both sides.", "Bestimme die Oxidationszahl jedes Elements auf beiden Seiten.") },
      { math: lines.join(" \\\\ "), note: askOx ? tx(`${right} goes up from ${roman(a)} to ${roman(b)}: it is **oxidised**. $\\ce{${x.reducer}}$ is the reducing agent.`, `${right} steigt von ${roman(a)} auf ${roman(b)}: Es wird **oxidiert**. $\\ce{${x.reducer}}$ ist das Reduktionsmittel.`) : tx(`${right} goes down from ${roman(a)} to ${roman(b)}: it is **reduced**. $\\ce{${x.oxidiser}}$ is the oxidising agent.`, `${right} sinkt von ${roman(a)} auf ${roman(b)}: Es wird **reduziert**. $\\ce{${x.oxidiser}}$ ist das Oxidationsmittel.`) },
    ],
  };
}

// ---------------------------------------------------------------------------
// The redox series

const stripName = (M: Metal, l: Locale) => (l === "de" ? `${resolveText(M.name, l)}streifen` : `${resolveText(M.name, l)} strip`);
const solutionName = (N: Metal, l: Locale) => (l === "de" ? `${resolveText(N.salt!.name, l)}-Lösung` : `${resolveText(N.salt!.name, l)} solution`);

function seriesPredict(rng: Rng): Exercise {
  const pairs = LAB_METALS.flatMap((a) => LAB_METALS.filter((b) => b !== a).map((b) => [a, b] as const));
  const [M, N] = rng.pick(pairs);
  const yes = reacts(M, N);
  const optYes = m((_, l) => (l === "de" ? `Ja: Auf dem ${stripName(M, l)} scheidet sich ${resolveText(N.name, l)} ab.` : `Yes: ${resolveText(N.name, l)} is deposited on the ${stripName(M, l)}.`));
  const optNo = tx("No: nothing happens.", "Nein: Es passiert nichts.");
  const optBack = m((_, l) => (l === "de" ? `Ja: Der ${stripName(M, l)} nimmt Elektronen von den ${resolveText(N.ions, l)} auf.` : `Yes: the ${stripName(M, l)} takes electrons from the ${resolveText(N.ions, l)}.`));
  const series: Text = tx(`In the redox series, ${en(M.name)} is ${yes ? "further left (less noble)" : "further right (nobler)"} than ${en(N.name)}.`, `In der Redoxreihe steht ${de(M.name)} ${yes ? "weiter links (unedler)" : "weiter rechts (edler)"} als ${de(N.name)}.`);
  const back: Wrong = {
    text: optBack,
    title: tx("Metals give, they don't take", "Metalle geben ab, nicht auf"),
    say: tx("Metal atoms can only **give** electrons away. The only question is whether the ions in the solution take them.", "Metallatome können Elektronen nur **abgeben**. Die Frage ist nur, ob die Ionen in der Lösung sie nehmen."),
  };
  const right = yes ? optYes : optNo;
  const wrongs: Wrong[] = yes
    ? [{ text: optNo, title: tx("Check the series", "Schau in die Redoxreihe"), say: tx(`Look at the redox series: which of the two metals is less noble? That one gives its electrons to the ions of the other.`, `Schau in die Redoxreihe: Welches der beiden Metalle ist unedler? Das gibt seine Elektronen an die Ionen des anderen ab.`) }, back]
    : [{ text: optYes, title: tx("The wrong way round", "Falsch herum"), say: tx(`${cap(en(M.name))} is the **nobler** metal here. A noble metal holds on to its electrons: it can't reduce the ions of a less noble one.`, `${de(M.name)} ist hier das **edlere** Metall. Ein edles Metall hält seine Elektronen fest: Es kann die Ionen eines unedleren Metalls nicht reduzieren.`) }, back];
  const { answer, mistakes } = oneOf(rng, right, wrongs);
  const solution: Frame[] = [{ math: "\\ce{Mg} < \\ce{Zn} < \\ce{Fe} < \\ce{Cu} < \\ce{Ag}", note: series }];
  if (yes) {
    const s = metalSwap(M, N);
    solution.push({
      math: halfLines([
        { label: "ox", src: `\\ce{${s.ox}}` },
        { label: "red", src: `\\ce{${s.red}}` },
        { label: "redox", src: `\\ce{${s.total}}` },
      ]),
      note: tx(`So ${en(M.name)} gives electrons to the ${en(N.ions)}: ${en(N.name)} is deposited.`, `Also gibt ${de(M.name)} Elektronen an die ${de(N.ions)} ab: ${de(N.name)} scheidet sich ab.`),
    });
  } else solution.push({ math: ce(`${M.symbol} + ${N.symbol}^${N.charge > 1 ? N.charge : ""}+`), note: tx(`${cap(en(M.name))} keeps its electrons: **no reaction**.`, `${de(M.name)} behält seine Elektronen: **keine Reaktion**.`) });
  return {
    instruction: tx("Does it react?", "Reagiert das?"),
    text: m((_, l) => (l === "de" ? `Du stellst einen ${stripName(M, l)} in eine ${solutionName(N, l)}. Was passiert?` : `You put a ${stripName(M, l)} into a ${solutionName(N, l)}. What happens?`)),
    answer,
    mistakes,
    hint: tx("The redox series of metals: Mg, Zn, Fe, Cu, Ag, from less noble to noble. A metal only reacts with the ions of a **nobler** metal.", "Die Redoxreihe der Metalle: Mg, Zn, Fe, Cu, Ag, von unedel nach edel. Ein Metall reagiert nur mit den Ionen eines **edleren** Metalls."),
    solution,
  };
}

const METAL_OPTS = ["Mg", "Zn", "Fe", "Pb", "Cu", "Ag", "Au"].map(metal);

function seriesMulti(rng: Rng, level: Level): Exercise {
  const byStrip = level === 3 && rng.chance(0.5);
  if (byStrip) {
    // one metal, several solutions: whose ions can it reduce?
    const M = rng.pick(LAB_METALS.filter((x) => ["Zn", "Fe"].includes(x.symbol)));
    const sols = LAB_METALS.filter((x) => x !== M);
    const options = sols.map((N) => m((_, l) => `${solutionName(N, l)} ($\\ce{${N.salt!.formula}}$)`));
    const right = sols.flatMap((N, i) => (reacts(M, N) ? [i] : []));
    const wrongSide = sols.flatMap((N, i) => (!reacts(M, N) ? [i] : []));
    return {
      instruction: tx("Which solutions react?", "Welche Lösungen reagieren?"),
      text: tx(`In which solutions does a **${en(M.name)} strip** get a metal coating?`, `In welchen Lösungen bekommt ein **${de(M.name)}streifen** einen Metallbelag?`),
      answer: { kind: "multi", options, correct: right },
      mistakes: multiMistakes(options, right, [
        [wrongSide, tx("The wrong side of the series", "Die falsche Seite der Reihe"), tx(`You picked the ions of **less noble** metals. ${cap(en(M.name))} can only reduce the ions of metals that are **nobler** than itself.`, `Du hast die Ionen der **unedleren** Metalle gewählt. ${de(M.name)} kann nur die Ionen von Metallen reduzieren, die **edler** sind als es selbst.`)],
        [sols.map((_, i) => i), tx("Not every solution", "Nicht jede Lösung"), tx("A metal can't reduce the ions of a **less noble** metal. Where in the series does each one stand?", "Ein Metall kann die Ionen eines **unedleren** Metalls nicht reduzieren. Wo in der Reihe steht jedes?")],
      ]),
      hint: tx("Mg, Zn, Fe, Cu, Ag: from less noble to noble. A coating forms only from the ions of a nobler metal.", "Mg, Zn, Fe, Cu, Ag: von unedel nach edel. Ein Belag entsteht nur aus den Ionen eines edleren Metalls."),
      solution: [
        { math: "\\ce{Mg} < \\ce{Zn} < \\ce{Fe} < \\ce{Cu} < \\ce{Ag}", note: tx(`${cap(en(M.name))} reacts with the ions of every metal to its right.`, `${de(M.name)} reagiert mit den Ionen aller Metalle rechts davon.`) },
        { math: right.map((i) => ce(sols[i].salt!.formula)).join(" \\quad "), note: tx("These solutions leave a coating.", "Diese Lösungen hinterlassen einen Belag.") },
      ],
    };
  }
  const N = rng.pick(LAB_METALS.filter((x) => ["Cu", "Ag", "Fe"].includes(x.symbol)));
  const pool = METAL_OPTS.filter((x) => x !== N);
  const picks = rng.shuffle(pool).slice(0, 5);
  const sorted = picks.sort((a, b) => a.e0 - b.e0);
  const options = sorted.map((x) => m((r) => `${r(x.name)} ($\\ce{${x.symbol}}$)`));
  const right = sorted.flatMap((x, i) => (reacts(x, N) ? [i] : []));
  const nobler = sorted.flatMap((x, i) => (!reacts(x, N) ? [i] : []));
  return {
    instruction: tx("Which metals react?", "Welche Metalle reagieren?"),
    text: m((_, l) => (l === "de" ? `Welche Metalle bekommen in einer ${solutionName(N, l)} einen Belag aus ${resolveText(N.name, l)}?` : `Which metals get a coating of ${resolveText(N.name, l)} in a ${solutionName(N, l)}?`)),
    answer: { kind: "multi", options, correct: right },
    mistakes: multiMistakes(options, right, [
      [nobler, tx("The wrong side of the series", "Die falsche Seite der Reihe"), tx(`You picked the **nobler** metals. To reduce the ${en(N.ions)}, a metal must be **less noble** than ${en(N.name)}.`, `Du hast die **edleren** Metalle gewählt. Um die ${de(N.ions)} zu reduzieren, muss ein Metall **unedler** sein als ${de(N.name)}.`)],
      [sorted.map((_, i) => i), tx("Not every metal", "Nicht jedes Metall"), tx(`Noble metals like gold hold on to their electrons. Which ones are less noble than ${en(N.name)}?`, `Edle Metalle wie Gold halten ihre Elektronen fest. Welche sind unedler als ${de(N.name)}?`)],
    ]),
    hint: tx("Redox series: Mg, Zn, Fe, Pb, Cu, Ag, Au, from less noble to noble.", "Redoxreihe: Mg, Zn, Fe, Pb, Cu, Ag, Au, von unedel nach edel."),
    solution: [
      { math: "\\ce{Mg} < \\ce{Zn} < \\ce{Fe} < \\ce{Pb} < \\ce{Cu} < \\ce{Ag} < \\ce{Au}", note: tx(`Every metal left of ${en(N.name)} gives electrons to the ${en(N.ions)}.`, `Jedes Metall links von ${de(N.name)} gibt Elektronen an die ${de(N.ions)} ab.`) },
      { math: right.map((i) => ce(sorted[i].symbol)).join(" \\quad "), note: tx(`These get a ${en(N.name)} coating.`, `Diese bekommen einen ${de(N.name)}belag.`) },
    ],
  };
}

function electronsTotal(rng: Rng): Exercise {
  const [a, b] = rng.pick([
    ["Al", "Cu"],
    ["Al", "Fe"],
    ["Al", "Zn"],
    ["Al", "Ag"],
    ["Mg", "Ag"],
    ["Cu", "Ag"],
    ["Zn", "Ag"],
    ["Fe", "Ag"],
  ] as [string, string][]);
  const M = metal(a);
  const N = metal(b);
  const s = metalSwap(M, N);
  return {
    instruction: tx("Count the electrons", "Zähl die Elektronen"),
    text: tx("How many electrons are transferred in total in this equation, as written?", "Wie viele Elektronen werden in dieser Gleichung insgesamt übertragen?"),
    math: ce(s.total),
    answer: { kind: "number", value: s.electrons },
    mistakes: numberMistakes(s.electrons, [
      [M.charge, tx(`Only one ${en(M.name)} atom`, `Nur ein ${de(M.name)}-Atom`), tx(`That's what **one** ${en(M.name)} atom gives away. But there ${s.a > 1 ? `are ${s.a} of them` : "is more to count"}: count all electrons in the equation.`, `So viele gibt **ein** ${de(M.name)}-Atom ab. Aber in der Gleichung stehen ${s.a > 1 ? `${s.a} davon` : "mehr"}: Zähl alle Elektronen.`)],
      [N.charge, tx("Only one ion", "Nur ein Ion"), tx(`That's what **one** $\\ce{${N.symbol}^${N.charge > 1 ? N.charge : ""}+}$ ion takes up. The equation has ${s.b} of them.`, `So viele nimmt **ein** $\\ce{${N.symbol}^${N.charge > 1 ? N.charge : ""}+}$-Ion auf. In der Gleichung stehen ${s.b} davon.`)],
      [M.charge + N.charge, tx("Given and taken added up", "Abgegebene und aufgenommene addiert"), tx("The electrons that are given away are the **same** ones that are taken up. Don't count them twice!", "Die abgegebenen Elektronen sind **dieselben**, die aufgenommen werden. Zähl sie nicht doppelt!")],
      [2 * s.electrons, tx("Counted twice", "Doppelt gezählt"), tx("The electrons given away are the same ones that are taken up. Count them only once.", "Die abgegebenen Elektronen sind dieselben, die aufgenommen werden. Zähl sie nur einmal."), true],
    ]),
    hint: tx("Write the oxidation half-equation and multiply it by the coefficient of the metal.", "Schreib die Teilgleichung der Oxidation auf und multipliziere sie mit dem Koeffizienten des Metalls."),
    solution: [
      {
        math: halfLines([
          { label: "ox", src: `\\ce{${s.ox}}${s.a > 1 ? ` \\quad | \\cdot ${s.a}` : ""}` },
          { label: "red", src: `\\ce{${s.red}}${s.b > 1 ? ` \\quad | \\cdot ${s.b}` : ""}` },
        ]),
        note: tx(`${cap(en(M.name))} gives ${M.charge}, each ion takes ${N.charge}. Common multiple: ${s.electrons}.`, `${de(M.name)} gibt ${M.charge} ab, jedes Ion nimmt ${N.charge} auf. Gemeinsames Vielfaches: ${s.electrons}.`),
      },
      { math: ce(s.total), note: tx(`${s.a} × ${M.charge} = ${s.b} × ${N.charge} = **${s.electrons}** electrons change hands.`, `${s.a} · ${M.charge} = ${s.b} · ${N.charge} = **${s.electrons}** Elektronen wechseln den Besitzer.`) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Balancing redox equations

type RB = { eq: string; level: 1 | 2 | 3; units?: string[]; why: Text };

const REDOX_BALANCE: RB[] = [
  { eq: "Mg + O2 -> MgO", level: 1, why: tx("Each Mg gives 2 electrons, each $\\ce{O2}$ takes 4.", "Jedes Mg gibt 2 Elektronen ab, jedes $\\ce{O2}$ nimmt 4 auf.") },
  { eq: "Zn + O2 -> ZnO", level: 1, why: tx("Each Zn gives 2 electrons, each $\\ce{O2}$ takes 4.", "Jedes Zn gibt 2 Elektronen ab, jedes $\\ce{O2}$ nimmt 4 auf.") },
  { eq: "Cu + O2 -> CuO", level: 1, why: tx("Each Cu gives 2 electrons, each $\\ce{O2}$ takes 4.", "Jedes Cu gibt 2 Elektronen ab, jedes $\\ce{O2}$ nimmt 4 auf.") },
  { eq: "Ca + O2 -> CaO", level: 1, why: tx("Each Ca gives 2 electrons, each $\\ce{O2}$ takes 4.", "Jedes Ca gibt 2 Elektronen ab, jedes $\\ce{O2}$ nimmt 4 auf.") },
  { eq: "Na + Cl2 -> NaCl", level: 1, why: tx("Each Na gives 1 electron, each $\\ce{Cl2}$ takes 2.", "Jedes Na gibt 1 Elektron ab, jedes $\\ce{Cl2}$ nimmt 2 auf.") },
  { eq: "Fe + O2 -> Fe2O3", level: 2, why: tx("Each Fe gives 3 electrons, each $\\ce{O2}$ takes 4: 12 is the common multiple.", "Jedes Fe gibt 3 Elektronen ab, jedes $\\ce{O2}$ nimmt 4 auf: 12 ist das gemeinsame Vielfache.") },
  { eq: "Al + O2 -> Al2O3", level: 2, why: tx("Each Al gives 3 electrons, each $\\ce{O2}$ takes 4: 12 is the common multiple.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{O2}$ nimmt 4 auf: 12 ist das gemeinsame Vielfache.") },
  { eq: "Na + O2 -> Na2O", level: 2, why: tx("Each Na gives 1 electron, each $\\ce{O2}$ takes 4.", "Jedes Na gibt 1 Elektron ab, jedes $\\ce{O2}$ nimmt 4 auf.") },
  { eq: "Al + Cl2 -> AlCl3", level: 2, why: tx("Each Al gives 3 electrons, each $\\ce{Cl2}$ takes 2: 6 is the common multiple.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{Cl2}$ nimmt 2 auf: 6 ist das gemeinsame Vielfache.") },
  { eq: "Mg + AgNO3 -> Mg(NO3)2 + Ag", level: 2, units: ["NO3"], why: tx("Each Mg gives 2 electrons, each $\\ce{Ag+}$ takes 1.", "Jedes Mg gibt 2 Elektronen ab, jedes $\\ce{Ag+}$ nimmt 1 auf.") },
  { eq: "Zn + AgNO3 -> Zn(NO3)2 + Ag", level: 2, units: ["NO3"], why: tx("Each Zn gives 2 electrons, each $\\ce{Ag+}$ takes 1.", "Jedes Zn gibt 2 Elektronen ab, jedes $\\ce{Ag+}$ nimmt 1 auf.") },
  { eq: "Cu + AgNO3 -> Cu(NO3)2 + Ag", level: 2, units: ["NO3"], why: tx("Each Cu gives 2 electrons, each $\\ce{Ag+}$ takes 1.", "Jedes Cu gibt 2 Elektronen ab, jedes $\\ce{Ag+}$ nimmt 1 auf.") },
  { eq: "Mg + HCl -> MgCl2 + H2", level: 2, why: tx("Each Mg gives 2 electrons, each $\\ce{H+}$ takes 1.", "Jedes Mg gibt 2 Elektronen ab, jedes $\\ce{H+}$ nimmt 1 auf.") },
  { eq: "Al + CuCl2 -> AlCl3 + Cu", level: 3, why: tx("Each Al gives 3 electrons, each $\\ce{Cu^2+}$ takes 2: 6 is the common multiple.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{Cu^2+}$ nimmt 2 auf: 6 ist das gemeinsame Vielfache.") },
  { eq: "Al + CuSO4 -> Al2(SO4)3 + Cu", level: 3, units: ["SO4"], why: tx("Each Al gives 3 electrons, each $\\ce{Cu^2+}$ takes 2: 6 is the common multiple.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{Cu^2+}$ nimmt 2 auf: 6 ist das gemeinsame Vielfache.") },
  { eq: "Mg + FeCl3 -> MgCl2 + Fe", level: 3, why: tx("Each Mg gives 2 electrons, each $\\ce{Fe^3+}$ takes 3: 6 is the common multiple.", "Jedes Mg gibt 2 Elektronen ab, jedes $\\ce{Fe^3+}$ nimmt 3 auf: 6 ist das gemeinsame Vielfache.") },
  { eq: "Al + AgNO3 -> Al(NO3)3 + Ag", level: 3, units: ["NO3"], why: tx("Each Al gives 3 electrons, each $\\ce{Ag+}$ takes 1.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{Ag+}$ nimmt 1 auf.") },
  { eq: "Al + HCl -> AlCl3 + H2", level: 3, why: tx("Each Al gives 3 electrons, each $\\ce{H+}$ takes 1, and $\\ce{H2}$ needs 2 of them.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{H+}$ nimmt 1 auf, und $\\ce{H2}$ braucht 2 davon.") },
  { eq: "Fe2O3 + CO -> Fe + CO2", level: 3, why: tx("$\\ce{Fe2O3}$ gives 3 O atoms away, each CO takes just 1.", "$\\ce{Fe2O3}$ gibt 3 O-Atome ab, jedes CO nimmt nur 1 auf.") },
  { eq: "Fe2O3 + C -> Fe + CO2", level: 3, why: tx("$\\ce{Fe2O3}$ gives 3 O atoms away, each C takes 2.", "$\\ce{Fe2O3}$ gibt 3 O-Atome ab, jedes C nimmt 2 auf.") },
  { eq: "Fe2O3 + Al -> Al2O3 + Fe", level: 3, why: tx("Each Al gives 3 electrons, each $\\ce{Fe^3+}$ takes 3.", "Jedes Al gibt 3 Elektronen ab, jedes $\\ce{Fe^3+}$ nimmt 3 auf.") },
  { eq: "CuO + C -> Cu + CO2", level: 3, why: tx("Each C takes 2 O atoms, each CuO gives 1.", "Jedes C nimmt 2 O-Atome auf, jedes CuO gibt 1 ab.") },
];

function redoxBalance(rng: Rng, level: Level): Exercise {
  const x = rng.pick(REDOX_BALANCE.filter((r) => r.level === level));
  const coefs = solve(x.eq)!;
  const strat = strategy({ eq: x.eq, units: x.units });
  const out: Mistake[] = balanceMistakes({ eq: x.eq, coefs, units: x.units });
  const ones = coefs.map(() => 1);
  if (!ones.every((v, i) => v === coefs[i]) && !out.some((o) => o.when.kind === "balance" && o.when.coefficients.every((v) => v === 1)))
    out.push({ when: { kind: "balance", equation: x.eq, coefficients: ones }, title: tx("One of each doesn't work", "Je eins geht nicht"), say: txMap((t, l) => `${t("One of each doesn't work here.", "Je eins geht hier nicht.")} ${resolveText(x.why, l)}`) });
  return {
    instruction: tx("Balance the redox equation", "Gleiche die Redoxgleichung aus"),
    answer: { kind: "balance", equation: x.eq, coefficients: coefs },
    mistakes: out,
    hint: x.why,
    solution: strat?.frames.length ? strat.frames : [{ math: coefSrc(x.eq, ones), note: x.why }, { math: coefSrc(x.eq, coefs), note: tx("Now every element is balanced.", "Jetzt ist jedes Element ausgeglichen.") }],
  };
}

// ---------------------------------------------------------------------------
// Redox in everyday life

type Everyday = { q: Text; right: Text; wrongs: Wrong[]; math: string; note: Text; hint: Text };

const EVERYDAY: Everyday[] = [
  {
    q: tx("Why does a zinc coating protect steel from rusting, even when it's scratched?", "Warum schützt eine Zinkschicht Stahl vor dem Rosten, sogar wenn sie zerkratzt ist?"),
    right: tx("Zinc is less noble than iron, so zinc is oxidised instead of the iron.", "Zink ist unedler als Eisen und wird deshalb statt des Eisens oxidiert."),
    wrongs: [
      { text: tx("Zinc is nobler than iron, so it never reacts.", "Zink ist edler als Eisen und reagiert deshalb nie."), title: tx("Check the series", "Schau in die Redoxreihe"), say: tx("In the redox series zinc stands **left** of iron: it's less noble and gives electrons away more easily.", "In der Redoxreihe steht Zink **links** von Eisen: Es ist unedler und gibt Elektronen leichter ab.") },
      { text: tx("Zinc takes electrons away from the iron.", "Zink nimmt dem Eisen Elektronen weg."), title: tx("The other direction", "Andere Richtung"), say: tx("If zinc took electrons from iron, the iron would be oxidised: it would rust! It's the other way round.", "Würde Zink dem Eisen Elektronen wegnehmen, würde das Eisen oxidiert: Es würde rosten! Es ist andersherum.") },
      { text: tx("Zinc keeps the water away, and that's all.", "Zink hält nur das Wasser fern, sonst nichts."), title: tx("Not just a lid", "Nicht nur ein Deckel"), say: tx("That would stop working at the first scratch. Zinc protects the iron chemically, through the redox series.", "Das würde beim ersten Kratzer nicht mehr funktionieren. Zink schützt das Eisen chemisch, über die Redoxreihe.") },
    ],
    math: "\\ce{Zn -> Zn^2+ + 2e-}",
    note: tx("Zinc is less noble than iron: it gives away its electrons first. As long as there is zinc, the iron isn't oxidised. A sacrificial metal!", "Zink ist unedler als Eisen: Es gibt seine Elektronen zuerst ab. Solange Zink da ist, wird das Eisen nicht oxidiert. Ein Opfermetall!"),
    hint: tx("Where do zinc and iron stand in the redox series?", "Wo stehen Zink und Eisen in der Redoxreihe?"),
  },
  {
    q: tx("A simple battery is made of zinc and copper (Daniell cell). Which metal is the **negative pole**?", "Eine einfache Batterie besteht aus Zink und Kupfer (Daniell-Element). Welches Metall ist der **Minuspol**?"),
    right: tx("Zinc: it is oxidised and leaves its electrons in the wire.", "Zink: Es wird oxidiert und gibt seine Elektronen an den Draht ab."),
    wrongs: [
      { text: tx("Copper: it takes up the electrons.", "Kupfer: Es nimmt die Elektronen auf."), title: tx("That's the plus pole", "Das ist der Pluspol"), say: tx("Where electrons are **taken up** is the plus pole. The minus pole is where electrons are produced: by the less noble metal.", "Wo Elektronen **aufgenommen** werden, ist der Pluspol. Der Minuspol ist dort, wo Elektronen entstehen: beim unedleren Metall.") },
      { text: tx("Copper: it is the nobler metal.", "Kupfer: Es ist das edlere Metall."), title: tx("Noble metals keep their electrons", "Edle Metalle behalten ihre Elektronen"), say: tx("Noble metals hold on to their electrons. The negative pole is where there are extra electrons.", "Edle Metalle halten ihre Elektronen fest. Der Minuspol ist dort, wo Elektronen übrig sind.") },
    ],
    math: "\\ce{Zn -> Zn^2+ + 2e-}",
    note: tx("Zinc is oxidised: its electrons flow through the wire and the device to the copper side. Zinc is the **minus pole**.", "Zink wird oxidiert: Seine Elektronen fließen durch den Draht und das Gerät zur Kupferseite. Zink ist der **Minuspol**."),
    hint: tx("At the negative pole, electrons are produced. Which metal gives them away?", "Am Minuspol entstehen Elektronen. Welches Metall gibt sie ab?"),
  },
  {
    q: tx("In the blast furnace: $\\ce{Fe2O3 + 3CO -> 2Fe + 3CO2}$. What is carbon monoxide's job?", "Im Hochofen: $\\ce{Fe2O3 + 3CO -> 2Fe + 3CO2}$. Welche Aufgabe hat Kohlenstoffmonoxid?"),
    right: tx("It's the reducing agent: it takes the oxygen from the iron ore.", "Es ist das Reduktionsmittel: Es nimmt dem Eisenerz den Sauerstoff ab."),
    wrongs: [
      { text: tx("It's the oxidising agent: it oxidises the iron.", "Es ist das Oxidationsmittel: Es oxidiert das Eisen."), title: tx("Iron is reduced", "Eisen wird reduziert"), say: tx("The iron goes from +III to 0: it's **reduced**. So CO must be the agent that does the reducing.", "Eisen geht von +III auf 0: Es wird **reduziert**. CO muss also das Mittel sein, das reduziert.") },
      { text: tx("It's a catalyst: it isn't used up.", "Es ist ein Katalysator: Es wird nicht verbraucht."), title: tx("CO is used up", "CO wird verbraucht"), say: tx("Look at the equation: CO turns into $\\ce{CO2}$. A catalyst would come out unchanged.", "Schau auf die Gleichung: CO wird zu $\\ce{CO2}$. Ein Katalysator käme unverändert heraus.") },
    ],
    math: "\\ce{Fe2O3 + 3CO -> 2Fe + 3CO2}",
    note: tx("C goes from +II to +IV: CO is oxidised and is the **reducing agent**. Iron goes from +III to 0: it's reduced.", "C geht von +II auf +IV: CO wird oxidiert und ist das **Reduktionsmittel**. Eisen geht von +III auf 0: Es wird reduziert."),
    hint: tx("Is the iron oxidised or reduced? Then what must CO be?", "Wird das Eisen oxidiert oder reduziert? Was muss CO dann sein?"),
  },
  {
    q: tx("Why can aluminium turn iron oxide into iron (thermite reaction)?", "Warum kann Aluminium Eisenoxid zu Eisen machen (Thermitverfahren)?"),
    right: tx("Aluminium is less noble than iron: it gives electrons to the iron ions more easily.", "Aluminium ist unedler als Eisen: Es gibt seine Elektronen leichter an die Eisen-Ionen ab."),
    wrongs: [
      { text: tx("Aluminium is nobler than iron.", "Aluminium ist edler als Eisen."), title: tx("Check the series", "Schau in die Redoxreihe"), say: tx("A nobler metal would hold on to its electrons. Where does aluminium stand compared with iron?", "Ein edleres Metall würde seine Elektronen festhalten. Wo steht Aluminium im Vergleich zu Eisen?") },
      { text: tx("Iron oxide takes electrons from aluminium oxide.", "Eisenoxid nimmt Aluminiumoxid Elektronen ab."), title: tx("Look at the start", "Schau auf den Anfang"), say: tx("At the start there's aluminium **metal**, not aluminium oxide. Who gives electrons to whom?", "Am Anfang ist **metallisches** Aluminium da, kein Aluminiumoxid. Wer gibt wem Elektronen?") },
    ],
    math: "\\ce{Fe2O3 + 2Al -> Al2O3 + 2Fe}",
    note: tx("Aluminium is oxidised (0 to +III), the iron ions are reduced (+III to 0). The reaction is so exothermic that the iron comes out molten: used to weld rails.", "Aluminium wird oxidiert (0 auf +III), die Eisen-Ionen werden reduziert (+III auf 0). Die Reaktion ist so exotherm, dass das Eisen flüssig herauskommt: So schweißt man Schienen."),
    hint: tx("Compare aluminium and iron in the redox series.", "Vergleiche Aluminium und Eisen in der Redoxreihe."),
  },
];

function everyday(rng: Rng): Exercise {
  if (rng.chance(0.3)) {
    const items = rng.shuffle([
      { text: tx("oxygen from the air", "Sauerstoff aus der Luft"), ok: true, id: "o2" },
      { text: tx("water", "Wasser"), ok: true, id: "h2o" },
      { text: tx("nitrogen", "Stickstoff"), ok: false, id: "n2" },
      { text: tx("light", "Licht"), ok: false, id: "light" },
    ]);
    const options = items.map((x) => x.text);
    const right = items.flatMap((x, i) => (x.ok ? [i] : []));
    const idx = (ids: string[]) => items.flatMap((x, i) => (ids.includes(x.id) ? [i] : []));
    return {
      instruction: tx("Rust", "Rost"),
      text: tx("What does iron need to rust?", "Was braucht Eisen, um zu rosten?"),
      answer: { kind: "multi", options, correct: right },
      mistakes: multiMistakes(options, right, [
        [idx(["o2"]), tx("Water is needed too", "Wasser gehört dazu"), tx("A nail in completely dry air stays shiny for years. Without water, iron hardly rusts.", "Ein Nagel in ganz trockener Luft bleibt jahrelang blank. Ohne Wasser rostet Eisen kaum.")],
        [idx(["h2o"]), tx("Oxygen is needed too", "Sauerstoff gehört dazu"), tx("A nail in boiled water under a layer of oil, without air, hardly rusts. Rusting is an oxidation: who takes the electrons?", "Ein Nagel in abgekochtem Wasser unter einer Ölschicht, ohne Luft, rostet kaum. Rosten ist eine Oxidation: Wer nimmt die Elektronen auf?")],
        [idx(["o2", "h2o", "n2"]), tx("Nitrogen doesn't join in", "Stickstoff macht nicht mit"), tx("Nitrogen is very unreactive and doesn't take part in rusting.", "Stickstoff ist sehr reaktionsträge und ist am Rosten nicht beteiligt.")],
      ]),
      hint: tx("Think of the classic experiment with nails in dry air, in boiled water and in normal water.", "Denk an den klassischen Versuch mit Nägeln in trockener Luft, in abgekochtem Wasser und in normalem Wasser."),
      solution: [{ math: "\\ce{4Fe + 3O2 -> 2Fe2O3}", note: tx("Rusting is a slow oxidation of iron by oxygen, and it only happens with **water** (simplified equation; real rust also contains water).", "Rosten ist eine langsame Oxidation von Eisen durch Sauerstoff, und sie läuft nur mit **Wasser** ab (vereinfachte Gleichung; echter Rost enthält auch Wasser).") }],
    };
  }
  const c = rng.pick(EVERYDAY);
  const { answer, mistakes } = oneOf(rng, c.right, c.wrongs);
  return { instruction: tx("Redox in everyday life", "Redox im Alltag"), text: c.q, answer, mistakes, hint: c.hint, solution: [{ math: c.math, note: c.note }] };
}

// ---------------------------------------------------------------------------
// The generator

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1) {
    return rng.pick([() => ozTask(rng, 1), () => ozTask(rng, 1), () => halfType(rng), () => halfElectrons(rng, 1), () => oxygenTransfer(rng), () => concept(rng, CONCEPTS_1), () => redoxBalance(rng, 1)])();
  }
  if (level === 2) {
    return rng.pick([() => ozTask(rng, 2), () => ozTask(rng, 2), () => agentChoice(rng, 2), () => seriesPredict(rng), () => seriesMulti(rng, 2), () => halfElectrons(rng, 2), () => redoxBalance(rng, 2), () => concept(rng, CONCEPTS_2), () => ozChange(rng, 2)])();
  }
  return rng.pick([() => ozTask(rng, 3), () => ozTask(rng, 3), () => electronsTotal(rng), () => redoxBalance(rng, 3), () => ozChange(rng, 3), () => agentChoice(rng, 3), () => everyday(rng), () => seriesMulti(rng, 3), () => halfElectrons(rng, 3)])();
}

// ---------------------------------------------------------------------------
// Lesson

const lessonOz = ozExercise({ formula: "HNO3", target: "N", level: 3 });

const lessonHalf = (() => {
  const options = ["\\ce{Zn -> Zn^2+ + 2e-}", "\\ce{Cu^2+ + 2e- -> Cu}", "\\ce{Cl2 + 2e- -> 2Cl-}", "\\ce{Ag+ + e- -> Ag}"].map((s) => `$${s}$`);
  const say = tx("Here the electrons are on the **left**: they are taken up. That's a reduction. Oxidation means giving electrons away.", "Hier stehen die Elektronen **links**: Sie werden aufgenommen. Das ist eine Reduktion. Oxidation heißt Elektronen abgeben.");
  return {
    answer: { kind: "choice", options, correct: 0 } as AnswerSpec,
    mistakes: [1, 2, 3].map((i): Mistake => ({ when: { kind: "choice", options, correct: i }, title: tx("That's a reduction", "Das ist eine Reduktion"), say })),
  };
})();

const lessonAgent = (() => {
  const options = ["$\\ce{Zn}$", "$\\ce{Cu^2+}$", "$\\ce{Zn^2+}$", "$\\ce{Cu}$"];
  return {
    answer: { kind: "choice", options, correct: 1 } as AnswerSpec,
    mistakes: [
      { when: { kind: "choice", options, correct: 0 }, title: tx("Agent and process mixed up", "Mittel und Vorgang verwechselt"), say: tx("Zinc is **oxidised**, so it's the **reducing** agent. The oxidising agent is the one that takes the electrons and gets reduced.", "Zink wird **oxidiert**, ist also das **Reduktions**mittel. Das Oxidationsmittel nimmt die Elektronen auf und wird dabei reduziert.") },
      { when: { kind: "choice", options, correct: 2 }, title: tx("That's a product", "Das ist ein Produkt"), say: tx("$\\ce{Zn^2+}$ only forms in the reaction. Look at the particles before the arrow.", "$\\ce{Zn^2+}$ entsteht erst bei der Reaktion. Schau auf die Teilchen vor dem Pfeil.") },
      { when: { kind: "choice", options, correct: 3 }, title: tx("That's a product", "Das ist ein Produkt"), say: tx("Copper metal only forms in the reaction. Look at the particles before the arrow.", "Das Kupfer entsteht erst bei der Reaktion. Schau auf die Teilchen vor dem Pfeil.") },
    ] as Mistake[],
  };
})();

const lessonCoating = (() => {
  const list = ["Mg", "Zn", "Fe", "Ag", "Au"].map(metal);
  const options = list.map((x) => m((r) => `${r(x.name)} ($\\ce{${x.symbol}}$)`));
  const right = [0, 1, 2];
  return {
    answer: { kind: "multi", options, correct: right } as AnswerSpec,
    mistakes: multiMistakes(options, right, [
      [[3, 4], tx("The wrong side of the series", "Die falsche Seite der Reihe"), tx("You picked the **nobler** metals. To reduce copper ions, a metal must be **less noble** than copper.", "Du hast die **edleren** Metalle gewählt. Um Kupfer-Ionen zu reduzieren, muss ein Metall **unedler** sein als Kupfer.")],
      [[0, 1, 2, 3, 4], tx("Not every metal", "Nicht jedes Metall"), tx("Silver and gold are nobler than copper: they hold on to their electrons.", "Silber und Gold sind edler als Kupfer: Sie halten ihre Elektronen fest.")],
      [[0, 1], tx("Iron too!", "Eisen auch!"), tx("Iron is also less noble than copper: an iron nail in copper sulfate solution turns copper-coloured.", "Auch Eisen ist unedler als Kupfer: Ein Eisennagel in Kupfersulfat-Lösung bekommt einen Kupferbelag.")],
    ]),
  };
})();

const redox: Topic = {
  ...topicMeta("redox"),
  summary: [
    {
      title: tx("Oxidation and reduction", "Oxidation und Reduktion"),
      body: tx(
        "**Oxidation** = giving away electrons, **reduction** = taking up electrons. They always happen together: a **redox reaction** is an electron transfer. (Old definition: oxidation = reaction with oxygen.)",
        "**Oxidation** = Elektronenabgabe, **Reduktion** = Elektronenaufnahme. Beide laufen immer gemeinsam ab: Eine **Redoxreaktion** ist ein Elektronenübergang. (Alte Definition: Oxidation = Reaktion mit Sauerstoff.)",
      ),
      examples: [halfLines([{ label: "ox", src: "\\ce{Fe -> Fe^2+ + 2e-}" }, { label: "red", src: "\\ce{Cu^2+ + 2e- -> Cu}" }])],
      tone: "rule",
    },
    {
      title: tx("Oxidising and reducing agents", "Oxidations- und Reduktionsmittel"),
      body: tx(
        "The **oxidising agent** takes up electrons and is reduced itself. The **reducing agent** gives electrons away and is oxidised itself.",
        "Das **Oxidationsmittel** nimmt Elektronen auf und wird selbst reduziert. Das **Reduktionsmittel** gibt Elektronen ab und wird selbst oxidiert.",
      ),
      examples: ["\\ce{Zn + Cu^2+ -> Zn^2+ + Cu}"],
      tone: "rule",
    },
    {
      title: tx("Oxidation numbers", "Oxidationszahlen"),
      body: tx(
        "Elements: 0. Single-atom ions: their charge. F always −I, metals positive, H usually +I, O usually −II. All together give 0 (in an ion: the charge). In books they're written as Roman numerals above the symbol.",
        "Elemente: 0. Einatomige Ionen: ihre Ladung. F immer −I, Metalle positiv, H meist +I, O meist −II. Alle zusammen ergeben 0 (im Ion: die Ladung). Im Buch stehen sie als römische Zahlen über dem Symbol.",
      ),
      examples: ["\\ce{H2SO4}: \\; 2 \\cdot (+1) + x + 4 \\cdot (-2) = 0 \\Rightarrow x = +6"],
      tone: "rule",
    },
    {
      title: tx("Balancing electrons", "Elektronen ausgleichen"),
      body: tx("Electrons given away = electrons taken up. Multiply the half-equations to the smallest common multiple.", "Abgegebene Elektronen = aufgenommene Elektronen. Multipliziere die Teilgleichungen auf das kleinste gemeinsame Vielfache."),
      examples: [halfLines([{ label: "ox", src: "\\ce{Al -> Al^3+ + 3e-} \\quad | \\cdot 2" }, { label: "red", src: "\\ce{Cu^2+ + 2e- -> Cu} \\quad | \\cdot 3" }, { label: "redox", src: "\\ce{2Al + 3Cu^2+ -> 2Al^3+ + 3Cu}" }])],
      tone: "tip",
    },
    {
      title: tx("The redox series", "Die Redoxreihe"),
      body: tx(
        "From less noble to noble: K, Ca, Na, Mg, Al, Zn, Fe, Pb, Cu, Ag, Au. A metal gives electrons to the ions of every **nobler** metal, never the other way round.",
        "Von unedel nach edel: K, Ca, Na, Mg, Al, Zn, Fe, Pb, Cu, Ag, Au. Ein Metall gibt Elektronen an die Ionen jedes **edleren** Metalls ab, nie umgekehrt.",
      ),
      examples: ["\\ce{Fe + Cu^2+ -> Fe^2+ + Cu}", tx('\\ce{Cu + Zn^2+} \\; "no reaction"', '\\ce{Cu + Zn^2+} \\; "keine Reaktion"')],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx(
        "Oxidation is **not** gaining electrons. The oxidising agent is **reduced**, not oxidised. Elements always have 0, even $\\ce{O2}$. Peroxides like $\\ce{H2O2}$: O is −I.",
        "Oxidation ist **nicht** Elektronenaufnahme. Das Oxidationsmittel wird **reduziert**, nicht oxidiert. Elemente haben immer 0, auch $\\ce{O2}$. Peroxide wie $\\ce{H2O2}$: O hat −I.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Oxidation: it started with oxygen", "Oxidation: Alles begann mit Sauerstoff"),
      blob: tx("Burning, rusting, batteries: all redox! Let's start with the oldest idea.", "Verbrennen, Rosten, Batterien: alles Redox! Fangen wir mit der ältesten Idee an."),
      frames: [
        { math: "\\ce{2Mg + O2 -> 2MgO}", note: tx("Magnesium burns with a bright white flame. It reacts with oxygen. Originally, that's what **oxidation** meant: a reaction with oxygen.", "Magnesium verbrennt mit grellweißer Flamme. Es reagiert mit Sauerstoff. Genau das hieß ursprünglich **Oxidation**: eine Reaktion mit Sauerstoff.") },
        { math: "\\ce{CuO + H2 -> Cu + H2O}", note: tx("Black copper oxide in a stream of hydrogen turns into shiny copper. It **loses** its oxygen: that's a **reduction**.", "Schwarzes Kupferoxid wird im Wasserstoffstrom zu glänzendem Kupfer. Es **verliert** seinen Sauerstoff: Das ist eine **Reduktion**.") },
        { math: "\\hl{\\ce{CuO}} \\ce{+ H2 -> Cu + H2O}", note: tx("Copper oxide gives its oxygen away: it is **reduced**.", "Kupferoxid gibt seinen Sauerstoff ab: Es wird **reduziert**.") },
        { math: "\\ce{CuO +} \\hl{\\ce{H2}} \\ce{-> Cu + H2O}", note: tx("Hydrogen takes the oxygen up: it is **oxidised**. Both happen at the same time: a **redox reaction**.", "Wasserstoff nimmt den Sauerstoff auf: Er wird **oxidiert**. Beides passiert gleichzeitig: eine **Redoxreaktion**.") },
      ],
    },
    {
      type: "explain",
      title: tx("What really happens: electrons", "Was wirklich passiert: Elektronen"),
      blob: tx("Look closer and it's all about electrons moving from one particle to another.", "Wenn man genauer hinschaut, geht es um Elektronen, die von einem Teilchen zum anderen wandern."),
      body: tx(
        "Today we define it with electrons: **oxidation = giving away electrons**, **reduction = taking up electrons**. Each half gets its own **half-equation** (Teilgleichung).",
        "Heute definiert man es über Elektronen: **Oxidation = Elektronenabgabe**, **Reduktion = Elektronenaufnahme**. Jede Hälfte bekommt eine eigene **Teilgleichung**.",
      ),
      frames: [
        { math: "\\ce{2Mg + O2 -> 2MgO}", note: tx("Magnesium oxide is a salt made of $\\ce{Mg^2+}$ and $\\ce{O^2-}$ ions. So electrons must have moved.", "Magnesiumoxid ist ein Salz aus $\\ce{Mg^2+}$- und $\\ce{O^2-}$-Ionen. Also müssen Elektronen gewandert sein.") },
        { math: "\\ce{2Mg -> 2Mg^2+ + 4e-}", note: tx("Each magnesium atom gives away 2 electrons: that's the **oxidation**.", "Jedes Magnesiumatom gibt 2 Elektronen ab: Das ist die **Oxidation**.") },
        { math: "\\ce{2Mg -> 2Mg^2+ + 4e-} \\\\ \\ce{O2 + 4e- -> 2O^2-}", note: tx("The oxygen molecule takes up these 4 electrons: that's the **reduction**.", "Das Sauerstoffmolekül nimmt diese 4 Elektronen auf: Das ist die **Reduktion**.") },
        {
          math: halfLines([
            { label: "ox", src: "\\ce{2Mg -> 2Mg^2+ + 4e-}" },
            { label: "red", src: "\\ce{O2 + 4e- -> 2O^2-}" },
            { label: "redox", src: "\\ce{2Mg + O2 -> 2MgO}" },
          ]),
          note: tx("Add both halves: the electrons cancel out. They don't appear in the overall equation.", "Addiere beide Hälften: Die Elektronen heben sich weg. In der Gesamtgleichung tauchen sie nicht auf."),
        },
        { math: "\\ce{2Na + Cl2 -> 2NaCl}", note: tx("This works without oxygen too: sodium gives electrons to chlorine. That's also a redox reaction.", "Das klappt auch ohne Sauerstoff: Natrium gibt Elektronen an Chlor ab. Auch das ist eine Redoxreaktion.") },
      ],
    },
    {
      type: "widget",
      title: tx("Send the electrons across", "Schick die Elektronen rüber"),
      blob: tx("Press the button and watch the oxidation numbers change!", "Drück auf den Knopf und schau, wie sich die Oxidationszahlen ändern!"),
      body: tx(
        "The pills show each particle's **oxidation number**, written in Roman numerals as in your textbook. Giving away electrons makes it rise, taking them up makes it fall.",
        "Die Kärtchen zeigen die **Oxidationszahl** jedes Teilchens, mit römischen Zahlen wie im Schulbuch. Elektronen abgeben lässt sie steigen, aufnehmen lässt sie sinken.",
      ),
      widget: RedoxTransfer,
    },
    {
      type: "check",
      blob: tx("Where are the electrons? That tells you everything.", "Wo stehen die Elektronen? Das verrät alles."),
      exercise: {
        instruction: tx("Find the oxidation", "Finde die Oxidation"),
        text: tx("Which half-equation shows an **oxidation**?", "Welche Teilgleichung zeigt eine **Oxidation**?"),
        ...lessonHalf,
        hint: tx("Oxidation = giving away electrons. On which side do the electrons stand then?", "Oxidation = Elektronenabgabe. Auf welcher Seite stehen die Elektronen dann?"),
        solution: [{ math: "\\ce{Zn -> Zn^2+ + 2e-}", note: tx("The electrons are on the right: zinc gives them away. That's the **oxidation**. The others all take electrons up.", "Die Elektronen stehen rechts: Zink gibt sie ab. Das ist die **Oxidation**. Alle anderen nehmen Elektronen auf.") }],
      },
    },
    {
      type: "explain",
      title: tx("Oxidation numbers", "Oxidationszahlen"),
      blob: tx("A little bookkeeping trick: who has how many electrons?", "Ein kleiner Buchhaltungstrick: Wer hat wie viele Elektronen?"),
      body: tx(
        "**Rules:** elements 0 · single-atom ions: their charge · F always −I · metals positive (alkali metals +I, alkaline earth metals +II, Al +III) · H usually +I · O usually −II · the sum is 0 in a molecule and the charge in an ion.",
        "**Regeln:** Elemente 0 · einatomige Ionen: ihre Ladung · F immer −I · Metalle positiv (Alkalimetalle +I, Erdalkalimetalle +II, Al +III) · H meist +I · O meist −II · die Summe ist 0 im Molekül und die Ladung im Ion.",
      ),
      frames: [
        { math: "\\ce{H2O}: \\; 2 \\cdot (+1) + (-2) = 0", note: tx("In water: H is +I, O is −II. Together: 0. It works!", "Im Wasser: H hat +I, O hat −II. Zusammen: 0. Passt!") },
        { math: "\\ce{SO2}: \\; x + 2 \\cdot (-2) = 0", note: tx("Sulfur dioxide: O is −II, sulfur is unknown. Call it $x$.", "Schwefeldioxid: O hat −II, Schwefel ist unbekannt. Nenn es $x$.") },
        { math: "\\ce{SO2}: \\; x = +4", note: tx("So sulfur has **+IV** here.", "Schwefel hat hier also **+IV**.") },
        { math: "\\ce{SO4^2-}: \\; x + 4 \\cdot (-2) = -2", note: tx("In the sulfate ion the sum isn't 0 but the ion's charge: −2.", "Im Sulfat-Ion ist die Summe nicht 0, sondern die Ladung des Ions: −2.") },
        { math: "\\ce{SO4^2-}: \\; x = +6", note: tx("Sulfur has **+VI** here. In textbooks you write it as a Roman numeral above the S. Here you can type +6.", "Schwefel hat hier **+VI**. Im Heft schreibst du das als römische Zahl über das S. Hier tippst du einfach +6.") },
        { math: tx('\\ce{Fe -> Fe^3+ + 3e-} \\\\ "oxidation number of Fe:" \\; 0 \\to +3', '\\ce{Fe -> Fe^3+ + 3e-} \\\\ "Oxidationszahl von Fe:" \\; 0 \\to +3'), note: tx("And the key point: **oxidation = oxidation number rises**, reduction = it falls.", "Und das Wichtigste: **Oxidation = Oxidationszahl steigt**, Reduktion = sie sinkt.") },
      ],
    },
    {
      type: "check",
      blob: tx("Nitric acid: H, N and three O. You know two of them!", "Salpetersäure: H, N und drei O. Zwei davon kennst du schon!"),
      exercise: { ...lessonOz, hint: tx("H is +I, each O is −II. All together give 0.", "H hat +I, jedes O hat −II. Alle zusammen ergeben 0.") },
    },
    {
      type: "explain",
      title: tx("Oxidising and reducing agents", "Oxidations- und Reduktionsmittel"),
      blob: tx("Now the names everyone mixes up. Let's make them stick!", "Jetzt die Namen, die alle verwechseln. Lass sie uns gut merken!"),
      frames: [
        { math: "\\ce{Fe + Cu^2+ -> Fe^2+ + Cu}", note: tx("An iron nail in copper sulfate solution gets a coating of copper.", "Ein Eisennagel in Kupfersulfat-Lösung bekommt einen Kupferbelag.") },
        { math: halfLines([{ label: "ox", src: "\\ce{Fe -> Fe^2+ + 2e-}" }, { label: "red", src: "\\ce{Cu^2+ + 2e- -> Cu}" }]), note: tx("Iron gives 2 electrons away: it is oxidised. The copper ion takes them up: it is reduced.", "Eisen gibt 2 Elektronen ab: Es wird oxidiert. Das Kupfer-Ion nimmt sie auf: Es wird reduziert.") },
        {
          math: tx('"reducing agent:" \\; \\ce{Fe} \\\\ "oxidising agent:" \\; \\ce{Cu^2+}', '"Reduktionsmittel:" \\; \\ce{Fe} \\\\ "Oxidationsmittel:" \\; \\ce{Cu^2+}'),
          note: tx("Iron **reduces** the copper ions: it's the **reducing agent**, and is oxidised itself. $\\ce{Cu^2+}$ **oxidises** the iron: it's the **oxidising agent**, and is reduced itself.", "Eisen **reduziert** die Kupfer-Ionen: Es ist das **Reduktionsmittel** und wird selbst oxidiert. $\\ce{Cu^2+}$ **oxidiert** das Eisen: Es ist das **Oxidationsmittel** und wird selbst reduziert."),
        },
        { math: halfLines([{ label: "ox", src: "\\ce{Al -> Al^3+ + 3e-} \\quad | \\cdot 2" }, { label: "red", src: "\\ce{Cu^2+ + 2e- -> Cu} \\quad | \\cdot 3" }]), note: tx("With aluminium: Al gives 3 electrons, $\\ce{Cu^2+}$ takes 2. Multiply both to 6, the smallest common multiple.", "Mit Aluminium: Al gibt 3 Elektronen ab, $\\ce{Cu^2+}$ nimmt 2 auf. Multipliziere beide auf 6, das kleinste gemeinsame Vielfache.") },
        { math: "\\ce{2Al + 3Cu^2+ -> 2Al^3+ + 3Cu}", note: tx("Electrons given = electrons taken: 6 = 6. Check the charges: $3 \\cdot (+2) = 2 \\cdot (+3)$.", "Abgegebene = aufgenommene Elektronen: 6 = 6. Prüf die Ladungen: $3 \\cdot (+2) = 2 \\cdot (+3)$.") },
      ],
    },
    {
      type: "check",
      blob: tx("Careful, this is the classic trap!", "Vorsicht, das ist die klassische Falle!"),
      exercise: {
        instruction: tx("Electron transfer", "Elektronenübergang"),
        text: tx("Which particle is the **oxidising agent**?", "Welches Teilchen ist das **Oxidationsmittel**?"),
        math: "\\ce{Zn + Cu^2+ -> Zn^2+ + Cu}",
        ...lessonAgent,
        hint: tx("The oxidising agent takes electrons up. Which particle does that?", "Das Oxidationsmittel nimmt Elektronen auf. Welches Teilchen macht das?"),
        solution: [
          { math: halfLines([{ label: "ox", src: "\\ce{Zn -> Zn^2+ + 2e-}" }, { label: "red", src: "\\ce{Cu^2+ + 2e- -> Cu}" }]), note: tx("Zinc gives electrons away, $\\ce{Cu^2+}$ takes them up.", "Zink gibt Elektronen ab, $\\ce{Cu^2+}$ nimmt sie auf.") },
          { math: "\\ce{Zn +} \\hl{\\ce{Cu^2+}} \\ce{-> Zn^2+ + Cu}", note: tx("$\\ce{Cu^2+}$ is reduced and oxidises the zinc: it's the **oxidising agent**.", "$\\ce{Cu^2+}$ wird reduziert und oxidiert dabei das Zink: Es ist das **Oxidationsmittel**.") },
        ],
      },
    },
    {
      type: "widget",
      title: tx("The redox series", "Die Redoxreihe"),
      blob: tx("Guess first, then dip! Which strips get a coating?", "Erst tippen, dann eintauchen! Welche Streifen bekommen einen Belag?"),
      body: tx(
        "Metals differ in how easily they give away electrons. Ordered from **less noble** (gives electrons easily) to **noble**, they form the **redox series**. A metal only reacts with the ions of a nobler metal.",
        "Metalle geben ihre Elektronen unterschiedlich leicht ab. Geordnet von **unedel** (gibt leicht Elektronen ab) bis **edel** ergeben sie die **Redoxreihe**. Ein Metall reagiert nur mit den Ionen eines edleren Metalls.",
      ),
      widget: RedoxSeries,
    },
    {
      type: "check",
      blob: tx("Use the series. Which ones are less noble than copper?", "Nutze die Reihe. Welche sind unedler als Kupfer?"),
      exercise: {
        instruction: tx("Which metals react?", "Welche Metalle reagieren?"),
        text: tx("You put strips of these metals into copper(II) sulfate solution. Which get a copper coating?", "Du stellst Streifen dieser Metalle in Kupfer(II)-sulfat-Lösung. Welche bekommen einen Kupferbelag?"),
        ...lessonCoating,
        hint: tx("Redox series: Mg, Zn, Fe, Pb, Cu, Ag, Au. Copper ions take electrons from every metal on the left of copper.", "Redoxreihe: Mg, Zn, Fe, Pb, Cu, Ag, Au. Kupfer-Ionen nehmen jedem Metall links vom Kupfer Elektronen ab."),
        solution: [
          { math: "\\ce{Mg} < \\ce{Zn} < \\ce{Fe} < \\ce{Cu} < \\ce{Ag} < \\ce{Au}", note: tx("Magnesium, zinc and iron are less noble than copper: they give electrons to the copper ions.", "Magnesium, Zink und Eisen sind unedler als Kupfer: Sie geben Elektronen an die Kupfer-Ionen ab.") },
          { math: "\\ce{Fe + Cu^2+ -> Fe^2+ + Cu}", note: tx("For example iron. Silver and gold are nobler: nothing happens.", "Zum Beispiel Eisen. Silber und Gold sind edler: Da passiert nichts.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Redox all around you", "Redox überall um dich herum"),
      blob: tx("Once you see it, you'll find redox reactions everywhere!", "Wenn du es einmal siehst, findest du Redoxreaktionen überall!"),
      frames: [
        { math: "\\ce{4Fe + 3O2 -> 2Fe2O3}", note: tx("**Rusting**: iron is slowly oxidised by oxygen, but only when **water** is there too. (Simplified: real rust also contains water.)", "**Rosten**: Eisen wird langsam von Sauerstoff oxidiert, aber nur, wenn auch **Wasser** da ist. (Vereinfacht: Echter Rost enthält auch Wasser.)") },
        { math: "\\ce{Zn -> Zn^2+ + 2e-}", note: tx("**Galvanised steel**: zinc is less noble than iron and is oxidised first. It sacrifices itself for the iron.", "**Verzinkter Stahl**: Zink ist unedler als Eisen und wird zuerst oxidiert. Es opfert sich für das Eisen.") },
        { math: halfLines([{ label: "ox", src: "\\ce{Zn -> Zn^2+ + 2e-}" }, { label: "red", src: "\\ce{Cu^2+ + 2e- -> Cu}" }]), note: tx("**Batteries**: in a zinc–copper cell the two halves are separated. The electrons have to take the long way through the wire, from zinc (minus pole) to copper (plus pole). That's electric current!", "**Batterien**: In einer Zink-Kupfer-Zelle sind die beiden Hälften getrennt. Die Elektronen müssen den Umweg durch den Draht nehmen, vom Zink (Minuspol) zum Kupfer (Pluspol). Das ist elektrischer Strom!") },
        { math: "\\ce{Fe2O3 + 3CO -> 2Fe + 3CO2}", note: tx("**Blast furnace**: carbon monoxide reduces iron ore to iron. CO is the reducing agent.", "**Hochofen**: Kohlenstoffmonoxid reduziert Eisenerz zu Eisen. CO ist das Reduktionsmittel.") },
      ],
    },
  ],
  generate,
};

export default redox;
