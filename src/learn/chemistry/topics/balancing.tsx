"use client";

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Mistake, SingleLessonTopic as Topic } from "@/learn/types";
import { balanceMistakes, ceEquation, coefSrc, elementKeys, parts, reaction, REACTIONS, solve, strategy, type Reaction } from "../balancing-core";
import { element } from "../elements";
import { parseEquation, parseFormula, sideCounts, unbalanced } from "../formula";
import { BalancingScale } from "../visuals/BalancingScale";

// ---------------------------------------------------------------------------
// Helpers

const BALANCE = tx("Balance the equation", "Gleiche die Reaktionsgleichung aus");
const countsOf = (f: string) => {
  const p = parseFormula(f);
  return p.ok ? p.species.counts : {};
};

const choiceMistake = (options: Text[], i: number, title: Text, say: Text, close = false): Mistake => ({ when: { kind: "choice", options, correct: i }, title, say, close });

/** Options in random order; `index(tag)` finds where each ended up. */
function arrange<T extends string>(rng: Rng, items: { tag: T; text: Text }[]) {
  const order = rng.shuffle(items);
  return { options: order.map((o) => o.text), index: (tag: T) => order.findIndex((o) => o.tag === tag) };
}

function hintFor(rx: Reaction): Text {
  const unit = rx.units?.[0];
  const unitNote = unit ? tx(` Count $\\ce{${unit}}$ as one unit.`, ` Zähl $\\ce{${unit}}$ als eine Einheit.`) : tx("", "");
  const base: Record<Reaction["kind"], Text> = {
    combustion: tx("**C** first, then **H**, **O** last. A half in front of $\\ce{O2}$? Double everything.", "Zuerst **C**, dann **H**, **O** zuletzt. Ein Halbes vor $\\ce{O2}$? Alles verdoppeln."),
    "metal-acid": tx("Metal first, then the acid part, then **H**. Hydrogen gas is $\\ce{H2}$.", "Zuerst das Metall, dann den Säurerest, dann **H**. Wasserstoffgas ist $\\ce{H2}$."),
    "metal-water": tx("Metal first, then **H**. Hydrogen gas is $\\ce{H2}$: a half? Double everything.", "Zuerst das Metall, dann **H**. Wasserstoffgas ist $\\ce{H2}$: ein Halbes? Alles verdoppeln."),
    neutralisation: tx("Metal first, then the acid part. Then the water: each H of the acid and each OH of the base make one $\\ce{H2O}$.", "Zuerst das Metall, dann den Säurerest. Dann das Wasser: Jedes H der Säure und jedes OH der Base bilden ein $\\ce{H2O}$."),
    "metal-oxygen": tx("Metal first, then oxygen. Remember: $\\ce{O2}$ brings two O atoms.", "Zuerst das Metall, dann den Sauerstoff. Denk dran: $\\ce{O2}$ bringt zwei O-Atome mit."),
    synthesis: tx("Count each element on both sides. Gases like $\\ce{O2}$, $\\ce{H2}$ or $\\ce{Cl2}$ bring two atoms each.", "Zähl jedes Element auf beiden Seiten. Gase wie $\\ce{O2}$, $\\ce{H2}$ oder $\\ce{Cl2}$ bringen je zwei Atome mit."),
    decomposition: tx("Count each element on both sides. Oxygen gas is $\\ce{O2}$, hydrogen gas is $\\ce{H2}$.", "Zähl jedes Element auf beiden Seiten. Sauerstoffgas ist $\\ce{O2}$, Wasserstoffgas ist $\\ce{H2}$."),
    redox: tx("Metals first, then the other non-metals, **O** last. If one gets unbalanced again, fix it again.", "Zuerst die Metalle, dann die anderen Nichtmetalle, **O** zuletzt. Passt eins nicht mehr, gleich es noch mal aus."),
    precipitation: tx("Metals first. Groups like $\\ce{NO3}$ or $\\ce{SO4}$ stay together.", "Zuerst die Metalle. Gruppen wie $\\ce{NO3}$ oder $\\ce{SO4}$ bleiben zusammen."),
  };
  return txMap((_, l) => `${resolveText(base[rx.kind], l)}${resolveText(unitNote, l)}`);
}

const wordText = (rx: Reaction): Text => txMap((t, l) => `${t("Word equation:", "Wortgleichung:")} ${resolveText(rx.words, l)}`);

function balanceExercise(rx: Reaction, text?: Text): Exercise {
  const st = strategy(rx)!;
  return {
    instruction: BALANCE,
    text: text ?? wordText(rx),
    answer: { kind: "balance", equation: rx.eq, coefficients: rx.coefs },
    hint: hintFor(rx),
    solution: st.frames,
    mistakes: balanceMistakes(rx, { half: st.half }),
  };
}

// ---------------------------------------------------------------------------
// Counting atoms

type Count = { f: string; el: string; name: Text; level: 1 | 2 | 3 };
const COUNTS: Count[] = [
  { f: "H2O", el: "H", name: tx("water", "Wasser"), level: 1 },
  { f: "H2O", el: "O", name: tx("water", "Wasser"), level: 1 },
  { f: "CO2", el: "O", name: tx("carbon dioxide", "Kohlenstoffdioxid"), level: 1 },
  { f: "NH3", el: "H", name: tx("ammonia", "Ammoniak"), level: 1 },
  { f: "CH4", el: "H", name: tx("methane", "Methan"), level: 1 },
  { f: "O2", el: "O", name: tx("oxygen", "Sauerstoff"), level: 1 },
  { f: "H2SO4", el: "O", name: tx("sulfuric acid", "Schwefelsäure"), level: 1 },
  { f: "H2SO4", el: "H", name: tx("sulfuric acid", "Schwefelsäure"), level: 1 },
  { f: "C3H8", el: "H", name: tx("propane", "Propan"), level: 1 },
  { f: "Ca(OH)2", el: "H", name: tx("calcium hydroxide", "Calciumhydroxid"), level: 2 },
  { f: "Ca(OH)2", el: "O", name: tx("calcium hydroxide", "Calciumhydroxid"), level: 2 },
  { f: "Al2(SO4)3", el: "O", name: tx("aluminium sulfate", "Aluminiumsulfat"), level: 2 },
  { f: "Al2(SO4)3", el: "S", name: tx("aluminium sulfate", "Aluminiumsulfat"), level: 2 },
  { f: "Mg(NO3)2", el: "O", name: tx("magnesium nitrate", "Magnesiumnitrat"), level: 2 },
  { f: "Mg(NO3)2", el: "N", name: tx("magnesium nitrate", "Magnesiumnitrat"), level: 2 },
  { f: "Ca3(PO4)2", el: "O", name: tx("calcium phosphate", "Calciumphosphat"), level: 2 },
  { f: "Al(OH)3", el: "H", name: tx("aluminium hydroxide", "Aluminiumhydroxid"), level: 2 },
  { f: "Fe2(SO4)3", el: "O", name: tx("iron(III) sulfate", "Eisen(III)-sulfat"), level: 2 },
];

function countTask(rng: Rng, level: Level): Exercise {
  const c = rng.pick(COUNTS.filter((x) => x.level === (level === 1 ? 1 : 2)));
  const k = rng.int(2, level === 1 ? 4 : 5);
  const per = countsOf(c.f)[c.el];
  const value = k * per;
  const elName = element(c.el)!.name;
  const mistakes: Mistake[] = [];
  const add = (v: number, title: Text, say: Text, close = false) => {
    if (v === value || v <= 0 || mistakes.some((m) => m.when.kind === "number" && m.when.value === v)) return;
    mistakes.push({ when: { kind: "number", value: v }, title, say, close });
  };
  add(
    per,
    tx("Coefficient forgotten", "Koeffizient vergessen"),
    tx(`That's the count for **one** ${resolveText(c.name, "en")} particle. The ${k} in front means ${k} of them.`, `Das ist die Anzahl in **einem** Teilchen ${resolveText(c.name, "de")}. Die ${k} davor heißt: ${k} davon.`),
  );
  if (per > 1) {
    add(
      k + per,
      tx("Added instead of multiplied", "Addiert statt multipliziert"),
      tx(`The coefficient **multiplies**: ${k} particles, each with ${per} ${c.el} atoms.`, `Der Koeffizient wird **multipliziert**: ${k} Teilchen mit je ${per} ${c.el}-Atomen.`),
    );
  }
  const bracket = c.f.match(/\(([A-Za-z0-9]+)\)(\d+)/);
  if (bracket && c.f.includes(`(`) && (countsOf(bracket[1])[c.el] ?? 0) > 0) {
    const flat = countsOf(c.f.replace(bracket[0], bracket[1]))[c.el];
    add(
      k * flat,
      tx("Bracket factor missed", "Faktor hinter der Klammer"),
      tx(`The ${bracket[2]} after the bracket counts for the **whole** group: every ${c.el} inside is there ${bracket[2]} times.`, `Die ${bracket[2]} hinter der Klammer gilt für die **ganze** Gruppe: Jedes ${c.el} darin ist ${bracket[2]}-mal da.`),
    );
    add(
      flat,
      tx("Bracket and coefficient missed", "Klammer und Koeffizient übersehen"),
      tx("Two multipliers here: the number after the bracket **and** the coefficient in front. Both count.", "Hier gibt es zwei Faktoren: die Zahl hinter der Klammer **und** den Koeffizienten davor. Beide zählen."),
    );
  }
  const keyed = `${k}#k \\ce{${c.f}}`;
  const frames: Frame[] = [
    { math: `\\ce{${c.f}}`, highlight: elementKeys(`\\ce{${c.f}}`, c.el), note: txMap((t, l) => t(`One particle of ${resolveText(c.name, l)} contains ${per} ${c.el} atoms.`, `Ein Teilchen ${resolveText(c.name, l)} enthält ${per} ${c.el}-Atome.`)) },
    { math: keyed, highlight: ["k", ...elementKeys(keyed, c.el)], note: tx(`The coefficient ${k} means: ${k} of these particles.`, `Der Koeffizient ${k} heißt: ${k} solche Teilchen.`) },
    { math: `${k}#k \\cdot ${per}#p = ${value}#v`, highlight: ["v"], note: tx(`${k} times ${per} makes ${value} ${c.el} atoms.`, `${k}-mal ${per} ergibt ${value} ${c.el}-Atome.`) },
  ];
  if (bracket && (countsOf(bracket[1])[c.el] ?? 0) > 0) {
    const inner = countsOf(bracket[1])[c.el];
    frames[0] = {
      ...frames[0],
      note: txMap((t, l) =>
        t(
          `In $\\ce{${bracket[1]}}$ there ${inner === 1 ? "is" : "are"} ${inner} ${c.el}, and the ${bracket[2]} after the bracket takes the group ${bracket[2]} times: ${per} ${c.el} atoms per particle of ${resolveText(c.name, l)}.`,
          `In $\\ce{${bracket[1]}}$ ${inner === 1 ? "steckt" : "stecken"} ${inner} ${c.el}, und die ${bracket[2]} hinter der Klammer nimmt die Gruppe ${bracket[2]}-mal: ${per} ${c.el}-Atome pro Teilchen ${resolveText(c.name, l)}.`,
        ),
      ),
    };
  }
  return {
    instruction: tx("Count the atoms", "Zähl die Atome"),
    text: txMap((t, l) => t(`How many ${resolveText(elName, l).toLowerCase()} atoms (${c.el}) are there in total?`, `Wie viele ${resolveText(elName, l)}-Atome (${c.el}) sind das insgesamt?`)),
    math: `\\ce{${k}${c.f}}`,
    answer: { kind: "number", value },
    hint: tx("Atoms in one particle (index, brackets) times the coefficient in front.", "Atome in einem Teilchen (Index, Klammer) mal den Koeffizienten davor."),
    solution: frames,
    mistakes,
  };
}

/** Atoms of one element on one side of a balanced equation (level 3). */
function sideCountTask(rng: Rng): Exercise {
  const rx = rng.pick(REACTIONS.filter((r) => r.level >= 2 && r.coefs.some((c) => c > 1) && parts(r.eq).right.length >= 2));
  const eq = parseEquation(rx.eq)!;
  const right = rng.chance(0.5);
  const counts = sideCounts(eq, rx.coefs);
  const side = right ? counts.right : counts.left;
  const els = Object.keys(side).filter((e) => side[e] > 1);
  const el = els.includes("O") && rng.chance(0.6) ? "O" : rng.pick(els);
  const value = side[el];
  const p = parts(rx.eq);
  const idx = right ? p.right.map((_, i) => p.left.length + i) : p.left.map((_, i) => i);
  const species = [...p.left, ...p.right];
  const noCoef = idx.reduce((s, i) => s + (countsOf(species[i])[el] ?? 0), 0);
  const firstOnly = idx.reduce((s, i, j) => s + (j === 0 ? rx.coefs[i] : 1) * (countsOf(species[i])[el] ?? 0), 0);
  const mistakes: Mistake[] = [];
  const add = (v: number, title: Text, say: Text) => {
    if (v === value || v <= 0 || mistakes.some((m) => m.when.kind === "number" && m.when.value === v)) return;
    mistakes.push({ when: { kind: "number", value: v }, title, say });
  };
  add(noCoef, tx("Coefficients forgotten", "Koeffizienten vergessen"), tx("You counted each formula once. But the coefficients in front say how many particles there are: multiply by them.", "Du hast jede Formel einmal gezählt. Aber die Koeffizienten davor sagen, wie viele Teilchen es sind: Multiplizier mit ihnen."));
  add(firstOnly, tx("Not every species counted", "Nicht jedes Teilchen gezählt"), tx(`${el} is in more than one substance on this side. Each one gets multiplied by its **own** coefficient.`, `${el} steckt auf dieser Seite in mehreren Stoffen. Jeder wird mit seinem **eigenen** Koeffizienten multipliziert.`));
  const src = coefSrc(rx.eq, rx.coefs);
  // Keys of the left side are the same whether it's parsed alone or as part of the whole equation.
  const leftKeys = elementKeys(coefSrc(p.left.join(" + ") + " -> X", rx.coefs).split(" -> ")[0], el);
  const sideKeys = right ? elementKeys(src, el).filter((k) => !leftKeys.includes(k)) : leftKeys;
  const terms = idx.filter((i) => (countsOf(species[i])[el] ?? 0) > 0);
  const sum = terms.map((i) => `${rx.coefs[i]} \\cdot ${countsOf(species[i])[el]}`).join(" + ");
  return {
    instruction: tx("Count the atoms", "Zähl die Atome"),
    text: right ? tx(`How many ${el} atoms are on the **right** side (products)?`, `Wie viele ${el}-Atome stehen auf der **rechten** Seite (Produkte)?`) : tx(`How many ${el} atoms are on the **left** side (reactants)?`, `Wie viele ${el}-Atome stehen auf der **linken** Seite (Edukte)?`),
    math: ceEquation(rx.eq, rx.coefs),
    answer: { kind: "number", value },
    hint: tx("For each substance on that side: coefficient times the atoms in one particle. Then add.", "Für jeden Stoff auf dieser Seite: Koeffizient mal Atome in einem Teilchen. Dann addieren."),
    solution: [
      { math: src, highlight: sideKeys, note: tx(`Find every ${el} on the ${right ? "right" : "left"} side.`, `Such jedes ${el} auf der ${right ? "rechten" : "linken"} Seite.`) },
      { math: `${sum} = ${value}#v`, highlight: ["v"], note: tx(`Coefficient times atoms per particle, then add: ${value} ${el} atoms.`, `Koeffizient mal Atome pro Teilchen, dann addieren: ${value} ${el}-Atome.`) },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Elements as they appear in equations

type Elem = { sym: string; f: string };
const ELEMS: Elem[] = [
  { sym: "H", f: "H2" },
  { sym: "O", f: "O2" },
  { sym: "N", f: "N2" },
  { sym: "Cl", f: "Cl2" },
  { sym: "Br", f: "Br2" },
  { sym: "I", f: "I2" },
  { sym: "F", f: "F2" },
  { sym: "Fe", f: "Fe" },
  { sym: "Mg", f: "Mg" },
  { sym: "Na", f: "Na" },
  { sym: "Cu", f: "Cu" },
  { sym: "Zn", f: "Zn" },
  { sym: "Al", f: "Al" },
  { sym: "C", f: "C" },
];

function elementFormula(rng: Rng): Exercise {
  const e = rng.pick(ELEMS);
  const name = element(e.sym)!.name;
  const pair = e.f.endsWith("2");
  const mistakes: Mistake[] = pair
    ? [
        {
          when: { kind: "formula", value: e.sym },
          title: tx("It comes in pairs", "Im Doppelpack"),
          say: tx(
            `As an element, ${resolveText(name, "en").toLowerCase()} doesn't exist as single atoms. It's one of the seven elements made of **two-atom molecules**.`,
            `${resolveText(name, "de")} gibt es als Element nicht in einzelnen Atomen. Es gehört zu den sieben Elementen aus **zweiatomigen Molekülen**.`,
          ),
        },
        ...(e.sym === "O"
          ? [
              {
                when: { kind: "formula" as const, value: "O3" },
                title: tx("That's ozone", "Das ist Ozon"),
                say: tx("$\\ce{O3}$ is ozone, a different substance. The oxygen we breathe and that burns things is made of two-atom molecules.", "$\\ce{O3}$ ist Ozon, ein anderer Stoff. Der Sauerstoff, den wir atmen und der Verbrennungen ermöglicht, besteht aus zweiatomigen Molekülen."),
              },
            ]
          : []),
      ]
    : [
        {
          when: { kind: "formula", value: `${e.sym}2` },
          title: tx("Single atoms here", "Hier einzelne Atome"),
          say: tx(
            "Only seven elements come in pairs: hydrogen, nitrogen, oxygen and the halogens. Metals and carbon are written as a single symbol.",
            "Nur sieben Elemente kommen im Doppelpack: Wasserstoff, Stickstoff, Sauerstoff und die Halogene. Metalle und Kohlenstoff schreibst du als einzelnes Symbol.",
          ),
        },
      ];
  return {
    instruction: tx("Write the formula", "Schreib die Formel"),
    text: txMap((t, l) => t(`How do you write the element **${resolveText(name, l).toLowerCase()}** in a reaction equation?`, `Wie schreibst du das Element **${resolveText(name, l)}** in einer Reaktionsgleichung?`)),
    answer: { kind: "formula", value: e.f, label: tx("Formula:", "Formel:") },
    hint: tx("Seven elements form two-atom molecules: H, N, O, F, Cl, Br, I. The rest are written as single atoms.", "Sieben Elemente bilden zweiatomige Moleküle: H, N, O, F, Cl, Br, I. Den Rest schreibst du als einzelne Atome."),
    solution: [
      { math: `\\ce{H2} \\quad \\ce{N2} \\quad \\ce{O2} \\quad \\ce{F2} \\quad \\ce{Cl2} \\quad \\ce{Br2} \\quad \\ce{I2}`, note: tx("The seven diatomic elements.", "Die sieben zweiatomigen Elemente.") },
      {
        math: `\\ce{${e.f}}#z`,
        highlight: ["z"],
        note: pair
          ? txMap((t, l) => t(`${resolveText(name, l)} is one of them: $\\ce{${e.f}}$.`, `${resolveText(name, l)} gehört dazu: $\\ce{${e.f}}$.`))
          : txMap((t, l) => t(`${resolveText(name, l)} isn't one of them, so just the symbol: $\\ce{${e.f}}$.`, `${resolveText(name, l)} gehört nicht dazu, also nur das Symbol: $\\ce{${e.f}}$.`)),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Coefficient or index?

type Particle = { f: string; el: string; plural: Text };
const PARTICLES: Particle[] = [
  { f: "H2O", el: "H", plural: tx("water molecules", "Wassermoleküle") },
  { f: "CO2", el: "O", plural: tx("carbon dioxide molecules", "Kohlenstoffdioxid-Moleküle") },
  { f: "NH3", el: "H", plural: tx("ammonia molecules", "Ammoniakmoleküle") },
  { f: "O2", el: "O", plural: tx("oxygen molecules", "Sauerstoffmoleküle") },
  { f: "CH4", el: "H", plural: tx("methane molecules", "Methanmoleküle") },
  { f: "SO2", el: "O", plural: tx("sulfur dioxide molecules", "Schwefeldioxid-Moleküle") },
];

function coefOrIndex(rng: Rng): Exercise {
  const p = rng.pick(PARTICLES);
  const n = countsOf(p.f)[p.el];
  const askCoef = rng.chance(0.5);
  const k = rng.int(2, 5);
  if (askCoef) {
    const items = [
      { tag: "ok", text: txMap((_, l) => `${k} ${resolveText(p.plural, l)}`) },
      { tag: "atoms", text: tx(`${k} atoms of the first element in one molecule`, `${k} Atome des ersten Elements in einem Molekül`) },
      { tag: "new", text: tx("a new substance with a different formula", "einen neuen Stoff mit anderer Formel") },
      { tag: "mass", text: tx(`the mass of one molecule in grams`, `die Masse eines Moleküls in Gramm`) },
    ];
    const { options, index } = arrange(rng, items);
    const src = `${k}#k \\ce{${p.f}}`;
    return {
      instruction: tx("Coefficient or index?", "Koeffizient oder Index?"),
      text: txMap((t) => t(`What does the **${k}** in front tell you?`, `Was sagt dir die **${k}** davor?`)),
      math: src,
      answer: { kind: "choice", options, correct: index("ok") },
      hint: tx("A big number **in front** of a formula is a coefficient.", "Eine große Zahl **vor** einer Formel ist ein Koeffizient."),
      solution: [
        { math: src, highlight: ["k"], note: tx("The big number in front is the **coefficient**.", "Die große Zahl davor ist der **Koeffizient**.") },
        { math: src, highlight: ["k"], note: txMap((t, l) => t(`It counts whole particles: ${k} ${resolveText(p.plural, l)}. The formula itself stays the same.`, `Er zählt ganze Teilchen: ${k} ${resolveText(p.plural, l)}. Die Formel selbst bleibt gleich.`)) },
      ],
      mistakes: [
        choiceMistake(options, index("atoms"), tx("That would be an index", "Das wäre ein Index"), tx("Atoms inside one molecule are shown by the **small** number behind a symbol (index). The big number in front counts whole molecules.", "Atome in einem Molekül zeigt die **kleine** Zahl hinter einem Symbol (Index). Die große Zahl davor zählt ganze Moleküle.")),
        choiceMistake(options, index("new"), tx("Still the same substance", "Immer noch derselbe Stoff"), tx("A coefficient never changes the substance. It just says how many particles of it there are.", "Ein Koeffizient ändert nie den Stoff. Er sagt nur, wie viele Teilchen davon da sind.")),
        choiceMistake(options, index("mass"), tx("No mass in there", "Keine Masse"), tx("Equations don't show masses directly. The number in front counts particles.", "Reaktionsgleichungen zeigen keine Massen direkt. Die Zahl davor zählt Teilchen.")),
      ],
    };
  }
  const items = [
    { tag: "ok", text: tx(`One molecule contains ${n} ${p.el} atoms.`, `Ein Molekül enthält ${n} ${p.el}-Atome.`) },
    { tag: "coef", text: txMap((_, l) => (l === "de" ? `Es sind ${n} ${resolveText(p.plural, l)}.` : `There are ${n} ${resolveText(p.plural, l)}.`)) },
    { tag: "before", text: tx(`The atom before the ${p.el} is there ${n} times.`, `Das Atom vor dem ${p.el} ist ${n}-mal da.`) },
    { tag: "react", text: tx(`The substance reacts ${n} times.`, `Der Stoff reagiert ${n}-mal.`) },
  ];
  const { options, index } = arrange(rng, items);
  const src = `\\ce{${p.f}}`;
  return {
    instruction: tx("Coefficient or index?", "Koeffizient oder Index?"),
    text: tx(`What does the small **${n}** in this formula tell you?`, `Was sagt dir die kleine **${n}** in dieser Formel?`),
    math: src,
    answer: { kind: "choice", options, correct: index("ok") },
    hint: tx("A small number **behind** a symbol is an index. It belongs to the symbol right in front of it.", "Eine kleine Zahl **hinter** einem Symbol ist ein Index. Sie gehört zum Symbol direkt davor."),
    solution: [
      { math: src, highlight: elementKeys(src, p.el), note: tx(`The small ${n} is an **index**. It belongs to the ${p.el} right in front of it.`, `Die kleine ${n} ist ein **Index**. Sie gehört zum ${p.el} direkt davor.`) },
      { math: src, highlight: elementKeys(src, p.el), note: tx(`So one molecule contains ${n} ${p.el} atoms. Change it and you get a different substance.`, `Also enthält ein Molekül ${n} ${p.el}-Atome. Änderst du sie, entsteht ein anderer Stoff.`) },
    ],
    mistakes: [
      choiceMistake(options, index("coef"), tx("That's what a coefficient does", "Das macht ein Koeffizient"), tx("Counting molecules is the job of the big number **in front** (coefficient). The small number behind a symbol is inside the molecule.", "Moleküle zählt die große Zahl **davor** (Koeffizient). Die kleine Zahl hinter einem Symbol steckt im Molekül.")),
      choiceMistake(options, index("before"), tx("It looks backwards", "Er schaut nach vorn"), tx("Careful: the index belongs to the symbol **right in front** of it, not to the next one.", "Vorsicht: Der Index gehört zum Symbol **direkt davor**, nicht zum nächsten.")),
      choiceMistake(options, index("react"), tx("Not about reacting", "Hat nichts mit Reagieren zu tun"), tx("The index describes the molecule itself: how many atoms of one kind are in it.", "Der Index beschreibt das Molekül selbst: wie viele Atome einer Sorte darin stecken.")),
    ],
  };
}

// ---------------------------------------------------------------------------
// Which equation is right? / Missing coefficient / Find the error

/** A balanced equation that cheats by changing an index (synthesis with one product). */
function indexCheat(rx: Reaction): string | null {
  const p = parts(rx.eq);
  if (p.right.length !== 1) return null;
  const sum: Record<string, number> = {};
  for (const s of p.left) for (const [el, n] of Object.entries(countsOf(s))) sum[el] = (sum[el] ?? 0) + n;
  const prod = Object.entries(countsOf(p.right[0]));
  if (prod.length !== Object.keys(sum).length) return null;
  const f = prod.map(([el]) => `${el}${sum[el] === 1 ? "" : sum[el]}`).join("");
  if (f === p.right[0]) return null;
  return `\\ce{${p.left.join(" + ")} -> ${f}}`;
}

/** A diatomic element written as single atoms, balanced that way. */
function atomCheat(rx: Reaction): string | null {
  const p = parts(rx.eq);
  const all = [...p.left, ...p.right];
  const i = all.findIndex((s) => ["O2", "Cl2", "H2", "N2", "Br2"].includes(s));
  if (i < 0) return null;
  const swapped = [...all];
  swapped[i] = all[i].slice(0, -1);
  const eq = `${swapped.slice(0, p.left.length).join(" + ")} -> ${swapped.slice(p.left.length).join(" + ")}`;
  const c = solve(eq);
  return c ? ceEquation(eq, c) : null;
}

function whichIsRight(rng: Rng): Exercise {
  for (let tries = 0; tries < 30; tries++) {
    const rx = rng.pick(REACTIONS.filter((r) => r.level <= 2 && r.coefs.some((c) => c > 1)));
    const eq = parseEquation(rx.eq)!;
    // One coefficient off by one.
    const j = rng.int(0, rx.coefs.length - 1);
    const off = rx.coefs.map((c, i) => (i === j ? (c > 1 && rng.chance(0.5) ? c - 1 : c + 1) : c));
    if (!unbalanced(eq, off).length) continue;
    type Tag = "ok" | "off" | "index" | "atoms" | "double";
    const items: { tag: Tag; text: Text }[] = [
      { tag: "ok", text: `$${ceEquation(rx.eq, rx.coefs)}$` },
      { tag: "off", text: `$${ceEquation(rx.eq, off)}$` },
    ];
    const ic = indexCheat(rx);
    const ac = atomCheat(rx);
    const extra: { tag: Tag; text: Text }[] = [];
    if (ic) extra.push({ tag: "index", text: `$${ic}$` });
    if (ac) extra.push({ tag: "atoms", text: `$${ac}$` });
    extra.push({ tag: "double", text: `$${ceEquation(rx.eq, rx.coefs.map((c) => 2 * c))}$` });
    items.push(...rng.shuffle(extra).slice(0, 2));
    const { options, index } = arrange(rng, items);
    const say: Record<Exclude<Tag, "ok">, [Text, Text]> = {
      off: [tx("Count again", "Zähl noch mal"), tx("Count the atoms of each element on both sides in that one: one of them doesn't match.", "Zähl in dieser Gleichung die Atome jedes Elements auf beiden Seiten: Eins passt nicht.")],
      index: [tx("An index was changed", "Ein Index wurde geändert"), tx("It's balanced, but by cheating: an index in the product was changed. That's a different substance! Only coefficients may change.", "Ausgeglichen, aber geschummelt: Im Produkt wurde ein Index geändert. Das ist ein anderer Stoff! Ändern darfst du nur Koeffizienten.")],
      atoms: [tx("A diatomic element split up", "Ein zweiatomiges Element zerlegt"), tx("Balanced, but one element is written as single atoms. Elements like $\\ce{O2}$, $\\ce{H2}$ or $\\ce{Cl2}$ always come in pairs.", "Ausgeglichen, aber ein Element steht als einzelnes Atom da. Elemente wie $\\ce{O2}$, $\\ce{H2}$ oder $\\ce{Cl2}$ kommen immer im Doppelpack.")],
      double: [tx("Not the smallest numbers", "Nicht die kleinsten Zahlen"), tx("Balanced, true! But all numbers can be divided by 2. Equations use the **smallest** whole numbers.", "Ausgeglichen, stimmt! Aber alle Zahlen lassen sich durch 2 teilen. In Reaktionsgleichungen stehen die **kleinsten** ganzen Zahlen.")],
    };
    const st = strategy(rx)!;
    return {
      instruction: tx("Which equation is right?", "Welche Gleichung stimmt?"),
      text: txMap((t, l) => `${t("Word equation:", "Wortgleichung:")} ${resolveText(rx.words, l)}`),
      answer: { kind: "choice", options, correct: index("ok") },
      hint: tx("Check three things: right formulas (no changed index, $\\ce{O2}$ not O), every element balanced, smallest whole numbers.", "Prüf drei Dinge: richtige Formeln (kein geänderter Index, $\\ce{O2}$ statt O), jedes Element ausgeglichen, kleinste ganze Zahlen."),
      solution: st.frames,
      mistakes: items.filter((x) => x.tag !== "ok").map((x) => choiceMistake(options, index(x.tag), ...say[x.tag as Exclude<Tag, "ok">])),
    };
  }
  return balanceExercise(reaction("Fe + O2 -> Fe2O3"));
}

function missingCoefficient(rng: Rng, level: Level): Exercise {
  for (let tries = 0; tries < 30; tries++) {
    const rx = rng.pick(REACTIONS.filter((r) => r.level === level || (level === 3 && r.level === 2)));
    const cands = rx.coefs.map((c, i) => (c > 1 ? i : -1)).filter((i) => i >= 0);
    if (!cands.length) continue;
    const i = rng.pick(cands);
    const species = [...parts(rx.eq).left, ...parts(rx.eq).right];
    const s = species[i];
    const nl = parts(rx.eq).left.length;
    const value = rx.coefs[i];
    const piece = (sp: string, j: number) => `\\group{${j === i ? `\\box{"?"}#q ` : rx.coefs[j] > 1 ? `${rx.coefs[j]}#k${j} ` : ""}\\ce{${sp}}}`;
    const math = `${species.slice(0, nl).map(piece).join(" + ")} -> ${species.slice(nl).map((sp, j) => piece(sp, nl + j)).join(" + ")}`;
    const per = countsOf(s);
    const mistakes: Mistake[] = [];
    for (const [el, n] of Object.entries(per)) {
      const atoms = value * n;
      if (n > 1 && atoms !== value && !mistakes.some((m) => m.when.kind === "number" && m.when.value === atoms)) {
        mistakes.push({
          when: { kind: "number", value: atoms },
          title: tx("Atoms instead of particles", "Atome statt Teilchen"),
          say: tx(
            `${atoms} is the number of ${el} **atoms** in all the $\\ce{${s}}$ together. But every $\\ce{${s}}$ already brings ${n} of them: the coefficient counts whole particles, not atoms.`,
            `${atoms} ist die Zahl der ${el}-**Atome** in allen $\\ce{${s}}$ zusammen. Aber jedes $\\ce{${s}}$ bringt schon ${n} davon mit: Der Koeffizient zählt ganze Teilchen, nicht Atome.`,
          ),
        });
      }
    }
    const done = coefSrc(rx.eq, rx.coefs);
    const off = unbalanced(parseEquation(rx.eq)!, rx.coefs.map((c, j) => (j === i ? 1 : c)));
    const el = off[0]?.[0] ?? Object.keys(per)[0];
    return {
      instruction: tx("Find the missing coefficient", "Finde den fehlenden Koeffizienten"),
      math,
      answer: { kind: "number", value },
      hint: txMap((t) => t(`Count the ${el} atoms on the other side. How many $\\ce{${s}}$ do you need for that?`, `Zähl die ${el}-Atome auf der anderen Seite. Wie viele $\\ce{${s}}$ brauchst du dafür?`)),
      solution: [
        { math: done.replace(new RegExp(`${value}#k${i} `), `\\box{"?"}#k${i} `), note: tx(`Count the ${el} atoms that $\\ce{${s}}$ has to match.`, `Zähl die ${el}-Atome, die $\\ce{${s}}$ ausgleichen muss.`) },
        { math: done, highlight: [`k${i}`, ...elementKeys(done, el)], note: tx(`With ${value} $\\ce{${s}}$ every element is balanced.`, `Mit ${value} $\\ce{${s}}$ ist jedes Element ausgeglichen.`) },
      ],
      mistakes,
    };
  }
  return balanceExercise(reaction("Al + Cl2 -> AlCl3"));
}

/** The half-trick: rewrite an equation that still has a fraction. */
function halvesTask(rng: Rng): Exercise {
  const pool = REACTIONS.filter((r) => strategy(r)?.half?.den === 2 && r.level >= 2);
  const rx = rng.pick(pool);
  const st = strategy(rx)!;
  const h = st.half!;
  const shown = h.before.map((c, i) => (i === h.index ? { n: h.num, d: 2 } : c));
  const math = coefSrc(rx.eq, shown).replace(/#[A-Za-z0-9]+/g, "");
  const name = rng.pick([tx("Tom", "Tom"), tx("Mia", "Mia"), tx("Ben", "Ben"), tx("Lea", "Lea")]);
  const st2 = { ...st, frames: st.frames.slice(st.frames.findIndex((f) => /frac/.test(typeof f.math === "string" ? f.math : f.math.en))) };
  return {
    instruction: BALANCE,
    text: txMap((t, l) => t(`${resolveText(name, l)} balanced with a fraction: $${math}$ Write it with the smallest whole numbers.`, `${resolveText(name, l)} hat mit einem Bruch ausgeglichen: $${math}$ Schreib die Gleichung mit den kleinsten ganzen Zahlen.`)),
    answer: { kind: "balance", equation: rx.eq, coefficients: rx.coefs },
    hint: tx("Half a molecule doesn't exist. Multiply **every** coefficient by 2.", "Halbe Moleküle gibt es nicht. Nimm **jeden** Koeffizienten mal 2."),
    solution: st2.frames.length ? st2.frames : st.frames,
    mistakes: balanceMistakes(rx, { half: h }),
  };
}

function findError(rng: Rng): Exercise {
  type Kind = "index" | "atoms" | "double" | "half";
  const kind = rng.pick<Kind>(["index", "atoms", "double", "half"]);
  let shown = "";
  let rx: Reaction | undefined;
  for (let tries = 0; tries < 40 && !shown; tries++) {
    rx = rng.pick(REACTIONS.filter((r) => r.level <= (kind === "half" ? 3 : 2)));
    if (kind === "index") shown = indexCheat(rx) ?? "";
    else if (kind === "atoms") shown = atomCheat(rx) ?? "";
    else if (kind === "double") shown = rx.coefs.every((c) => c === 1) ? "" : ceEquation(rx.eq, rx.coefs.map((c) => 2 * c));
    else {
      const h = strategy(rx)?.half;
      shown = h?.den === 2 ? coefSrc(rx.eq, h.before.map((c, i) => (i === h.index ? { n: h.num, d: 2 } : c))).replace(/#[A-Za-z0-9]+/g, "") : "";
    }
  }
  if (!shown || !rx) return balanceExercise(reaction("Na + Cl2 -> NaCl"));
  const R = rx;
  type Tag = Kind | "fine";
  const texts: Record<Tag, Text> = {
    index: tx("An index was changed: that's a different substance.", "Ein Index wurde geändert: Das ist ein anderer Stoff."),
    atoms: tx("An element that comes in pairs was written as single atoms.", "Ein Element aus zweiatomigen Molekülen steht als einzelnes Atom da."),
    double: tx("Balanced, but not with the smallest numbers.", "Ausgeglichen, aber nicht mit den kleinsten Zahlen."),
    half: tx("A fraction is left: whole numbers are missing.", "Es steht noch ein Bruch da: Ganze Zahlen fehlen."),
    fine: tx("Nothing, the equation is correct.", "Nichts, die Gleichung ist richtig."),
  };
  const tags = rng.shuffle((["index", "atoms", "double", "half"] as Kind[]).filter((k) => k !== kind)).slice(0, 2);
  const { options, index } = arrange(rng, [kind, ...tags, "fine"].map((tag) => ({ tag: tag as Tag, text: texts[tag as Tag] })));
  const why: Record<Tag, Text> = {
    index: tx("Look closely at the formulas: are they all the real ones? Changing an index makes a different substance.", "Schau dir die Formeln genau an: Stimmen sie alle? Ein geänderter Index macht einen anderen Stoff."),
    atoms: tx("Check how the elements are written: oxygen, hydrogen or chlorine as elements always come in pairs.", "Prüf, wie die Elemente geschrieben sind: Sauerstoff, Wasserstoff oder Chlor kommen als Element immer im Doppelpack."),
    double: tx("Look at the coefficients: can they all be divided by the same number?", "Schau auf die Koeffizienten: Lassen sie sich alle durch dieselbe Zahl teilen?"),
    half: tx("Look at the coefficients: are they all whole numbers?", "Schau auf die Koeffizienten: Sind alle ganze Zahlen?"),
    fine: tx("Something is wrong here! Count the atoms and check the formulas and the numbers in front.", "Hier stimmt etwas nicht! Zähl die Atome und prüf die Formeln und die Zahlen davor."),
  };
  const right = ceEquation(R.eq, R.coefs);
  return {
    instruction: tx("Find the error", "Finde den Fehler"),
    text: txMap((t, l) => t(`A classmate wrote for "${resolveText(R.words, l)}":`, `Ein Mitschüler hat für „${resolveText(R.words, l)}“ aufgeschrieben:`)),
    math: shown,
    answer: { kind: "choice", options, correct: index(kind) },
    hint: tx("Check the formulas first, then the atom counts, then whether the numbers are the smallest whole ones.", "Prüf zuerst die Formeln, dann die Atomzahlen, dann ob es die kleinsten ganzen Zahlen sind."),
    solution: [
      { math: shown, note: texts[kind] },
      { math: right, note: txMap((t) => t("Correct:", "Richtig:") + ` $${right}$`) },
    ],
    mistakes: [...tags, "fine" as const].map((tag) =>
      tag === "fine"
        ? choiceMistake(options, index(tag), tx("Something's wrong here", "Da stimmt was nicht"), why.fine)
        : choiceMistake(options, index(tag), tx("A different error", "Ein anderer Fehler"), why[kind]),
    ),
  };
}

// ---------------------------------------------------------------------------

function balanceTask(rng: Rng, level: Level): Exercise {
  const pool = REACTIONS.filter((r) => r.level === level);
  return balanceExercise(rng.pick(pool));
}

function generate(level: Level, rng: Rng): Exercise {
  const r = rng.next();
  if (level === 1) {
    if (r < 0.45) return balanceTask(rng, 1);
    if (r < 0.62) return countTask(rng, 1);
    if (r < 0.8) return elementFormula(rng);
    return coefOrIndex(rng);
  }
  if (level === 2) {
    if (r < 0.6) return balanceTask(rng, 2);
    if (r < 0.72) return countTask(rng, 2);
    if (r < 0.87) return whichIsRight(rng);
    return missingCoefficient(rng, 2);
  }
  if (r < 0.58) return balanceTask(rng, 3);
  if (r < 0.72) return halvesTask(rng);
  if (r < 0.86) return findError(rng);
  if (r < 0.94) return sideCountTask(rng);
  return missingCoefficient(rng, 3);
}

// ---------------------------------------------------------------------------
// Lesson

const H2O = "H2 + O2 -> H2O";
const waterFrames: Frame[] = (() => {
  const s1 = coefSrc(H2O, [1, 1, 1]);
  const s2 = coefSrc(H2O, [1, 1, 2]);
  const s3 = coefSrc(H2O, [2, 1, 2]);
  return [
    { math: tx('"hydrogen" + "oxygen" -> "water"', '"Wasserstoff" + "Sauerstoff" -> "Wasser"'), note: tx("The word equation: hydrogen and oxygen react to form water.", "Die Wortgleichung: Wasserstoff und Sauerstoff reagieren zu Wasser.") },
    { math: s1, note: tx("Now formulas. Careful: hydrogen and oxygen exist as molecules of **two** atoms, $\\ce{H2}$ and $\\ce{O2}$.", "Jetzt die Formeln. Vorsicht: Wasserstoff und Sauerstoff bestehen aus Molekülen mit **zwei** Atomen, $\\ce{H2}$ und $\\ce{O2}$.") },
    { math: s1, highlight: elementKeys(s1, "O"), note: tx("Count the O atoms: 2 on the left, only 1 on the right. But atoms can't just vanish!", "Zähl die O-Atome: links 2, rechts nur 1. Aber Atome können nicht einfach verschwinden!") },
    { math: s2, highlight: ["k2", ...elementKeys(s2, "O")], note: tx("A **2** in front of $\\ce{H2O}$ means two water molecules: now 2 O atoms on the right.", "Eine **2** vor $\\ce{H2O}$ heißt: zwei Wassermoleküle. Jetzt stehen rechts 2 O-Atome.") },
    { math: s2, highlight: elementKeys(s2, "H"), note: tx("But now H is off: 2 on the left, 4 on the right.", "Aber jetzt passt H nicht: links 2, rechts 4.") },
    { math: s3, highlight: ["k0", ...elementKeys(s3, "H")], note: tx("A **2** in front of $\\ce{H2}$: 4 H on each side.", "Eine **2** vor $\\ce{H2}$: auf jeder Seite 4 H.") },
    { math: s3, note: tx("Check: H 4 | 4, O 2 | 2. Balanced! Two hydrogen molecules and one oxygen molecule form two water molecules.", "Probe: H 4 | 4, O 2 | 2. Ausgeglichen! Zwei Wasserstoffmoleküle und ein Sauerstoffmolekül bilden zwei Wassermoleküle.") },
  ];
})();

const pairFrames: Frame[] = [
  { math: "\\ce{H2} \\quad \\ce{N2} \\quad \\ce{O2}", note: tx("Hydrogen, nitrogen, oxygen: gases made of two-atom molecules.", "Wasserstoff, Stickstoff, Sauerstoff: Gase aus zweiatomigen Molekülen.") },
  { math: "\\ce{H2} \\quad \\ce{N2} \\quad \\ce{O2} \\quad \\ce{F2} \\quad \\ce{Cl2} \\quad \\ce{Br2} \\quad \\ce{I2}", note: tx("Plus the halogens fluorine, chlorine, bromine and iodine. Seven in total.", "Dazu die Halogene Fluor, Chlor, Brom und Iod. Sieben insgesamt.") },
  { math: "\\ce{Fe} \\quad \\ce{Mg} \\quad \\ce{Na} \\quad \\ce{Cu} \\quad \\ce{C} \\quad \\ce{S} \\quad \\ce{He}", note: tx("All other elements are written as a single symbol: metals, carbon, sulfur, noble gases.", "Alle anderen Elemente schreibst du als einzelnes Symbol: Metalle, Kohlenstoff, Schwefel, Edelgase.") },
];

const indexFrames: Frame[] = [
  { math: "\\ce{H2O}", note: tx("One water molecule: the **index** 2 says 2 H atoms, and there's 1 O atom.", "Ein Wassermolekül: Der **Index** 2 sagt 2 H-Atome, dazu 1 O-Atom.") },
  { math: "3#k \\ce{H2O}", highlight: ["k"], note: tx("The **coefficient** 3 in front: three water molecules, 6 H and 3 O. Still water!", "Der **Koeffizient** 3 davor: drei Wassermoleküle, 6 H und 3 O. Immer noch Wasser!") },
  { math: "\\ce{H2O2}", note: tx("Change the index instead and you get $\\ce{H2O2}$: hydrogen peroxide, a bleach. A completely different substance!", "Änderst du stattdessen den Index, bekommst du $\\ce{H2O2}$: Wasserstoffperoxid, ein Bleichmittel. Ein ganz anderer Stoff!") },
  { math: "2#k \\ce{H2O} \\ne \\ce{H2O2}", highlight: ["k"], note: tx("So: balance **only with coefficients**. The formulas themselves stay exactly as they are.", "Also: Ausgleichen **nur mit Koeffizienten**. Die Formeln selbst bleiben genau so, wie sie sind.") },
];

const indexCheckOptions: Text[] = ["$\\ce{H2 + O2 -> H2O2}$", "$\\ce{2H2 + O2 -> 2H2O}$", "$\\ce{H2 + O -> H2O}$", "$\\ce{H4 + O2 -> 2H2O}$"];
const indexCheck: Exercise = {
  instruction: tx("Which one is balanced correctly?", "Welche ist richtig ausgeglichen?"),
  text: tx("Hydrogen burns with oxygen to form water. Which equation is correct?", "Wasserstoff verbrennt mit Sauerstoff zu Wasser. Welche Gleichung ist richtig?"),
  answer: { kind: "choice", options: indexCheckOptions, correct: 1 },
  hint: tx("Only the numbers **in front** may change. The formulas $\\ce{H2}$, $\\ce{O2}$ and $\\ce{H2O}$ stay as they are.", "Nur die Zahlen **davor** dürfen sich ändern. Die Formeln $\\ce{H2}$, $\\ce{O2}$ und $\\ce{H2O}$ bleiben, wie sie sind."),
  solution: waterFrames.slice(1),
  mistakes: [
    choiceMistake(indexCheckOptions, 0, tx("An index was changed", "Ein Index wurde geändert"), tx("The atoms add up, yes, but you changed an index: $\\ce{H2O2}$ is hydrogen peroxide, not water. Only change the numbers **in front**.", "Die Atome stimmen, ja, aber du hast einen Index geändert: $\\ce{H2O2}$ ist Wasserstoffperoxid, kein Wasser. Ändere nur die Zahlen **davor**.")),
    choiceMistake(indexCheckOptions, 2, tx("Oxygen comes in pairs", "Sauerstoff im Doppelpack"), tx("Oxygen never comes as a single atom: as an element it's always $\\ce{O2}$. The formulas of the starting substances stay as they are.", "Sauerstoff kommt nie als einzelnes Atom: Als Element ist er immer $\\ce{O2}$. Die Formeln der Ausgangsstoffe bleiben, wie sie sind.")),
    choiceMistake(indexCheckOptions, 3, tx("H₄ doesn't exist", "H₄ gibt es nicht"), tx("$\\ce{H4}$ isn't hydrogen, that's a changed index. Hydrogen is $\\ce{H2}$: put a 2 **in front** of it instead.", "$\\ce{H4}$ ist kein Wasserstoff, da wurde ein Index geändert. Wasserstoff ist $\\ce{H2}$: Schreib die 2 lieber **davor**.")),
  ],
};

const RUST = reaction("Fe + O2 -> Fe2O3");
const ALCL3 = reaction("Al + Cl2 -> AlCl3");
const ETHANE = reaction("C2H6 + O2 -> CO2 + H2O");
const PROPANE = reaction("C3H8 + O2 -> CO2 + H2O");
const ALSO4 = reaction("Al + H2SO4 -> Al2(SO4)3 + H2");
const PHOS = reaction("H3PO4 + NaOH -> Na3PO4 + H2O");

const balancing: Topic = {
  ...topicMeta("balancing"),
  summary: [
    {
      title: tx("Coefficients, never indices", "Koeffizienten, nie Indizes"),
      body: tx(
        "Balance only with the big numbers **in front** (coefficients). The small numbers in a formula (indices) stay: changing them makes a different substance.",
        "Ausgleichen nur mit den großen Zahlen **davor** (Koeffizienten). Die kleinen Zahlen in einer Formel (Indizes) bleiben: Wer sie ändert, macht einen anderen Stoff.",
      ),
      examples: [tx('\\ce{2H2O} \\quad "= 2 water molecules"', '\\ce{2H2O} \\quad "= 2 Wassermoleküle"'), tx('\\ce{H2O2} \\quad "= hydrogen peroxide!"', '\\ce{H2O2} \\quad "= Wasserstoffperoxid!"')],
      tone: "rule",
    },
    {
      title: tx("Seven diatomic elements", "Sieben zweiatomige Elemente"),
      body: tx("As elements, these always come as pairs of atoms. Everything else is written as a single symbol (Fe, Mg, C).", "Als Element kommen diese immer als Atompaar vor. Alles andere schreibst du als einzelnes Symbol (Fe, Mg, C)."),
      examples: ["\\ce{H2} \\quad \\ce{N2} \\quad \\ce{O2} \\quad \\ce{F2} \\quad \\ce{Cl2} \\quad \\ce{Br2} \\quad \\ce{I2}"],
      tone: "rule",
    },
    {
      title: tx("Blob's strategy", "Blobs Strategie"),
      body: tx(
        "1. Word equation. 2. Formulas. 3. Count the atoms on both sides. 4. Balance: **metals**, then the other **non-metals**, then **H**, **O** last. Groups like $\\ce{SO4}$ count as one unit. 5. Check.",
        "1. Wortgleichung. 2. Formeln. 3. Atome auf beiden Seiten zählen. 4. Ausgleichen: **Metalle**, dann die anderen **Nichtmetalle**, dann **H**, **O** zuletzt. Gruppen wie $\\ce{SO4}$ zählen als eine Einheit. 5. Probe.",
      ),
      examples: ["\\ce{4Fe + 3O2 -> 2Fe2O3}", "\\ce{2Al + 3H2SO4 -> Al2(SO4)3 + 3H2}"],
      tone: "rule",
    },
    {
      title: tx("Halves? Double!", "Halbe? Verdoppeln!"),
      body: tx("A fraction in front of $\\ce{O2}$ is fine as an in-between step. Then multiply **every** coefficient by 2.", "Ein Bruch vor $\\ce{O2}$ ist als Zwischenschritt okay. Dann nimmst du **jeden** Koeffizienten mal 2."),
      examples: ["\\ce{C2H6} + \\frac{7}{2} \\ce{O2} -> 2 \\ce{CO2} + 3 \\ce{H2O}", "\\ce{2C2H6 + 7O2 -> 4CO2 + 6H2O}"],
      tone: "tip",
    },
    {
      title: tx("Reactions you'll meet", "Typische Reaktionen"),
      body: tx("Combustion, metal + acid, neutralisation:", "Verbrennung, Metall + Säure, Neutralisation:"),
      examples: ["\\ce{CH4 + 2O2 -> CO2 + 2H2O}", "\\ce{Mg + 2HCl -> MgCl2 + H2}", "\\ce{Ca(OH)2 + 2HCl -> CaCl2 + 2H2O}"],
      tone: "tip",
    },
    {
      title: tx("Smallest whole numbers", "Kleinste ganze Zahlen"),
      body: tx("Balanced isn't finished if all coefficients share a factor: divide them.", "Ausgeglichen heißt noch nicht fertig, wenn alle Koeffizienten einen gemeinsamen Teiler haben: Kürze sie."),
      examples: [tx('\\ce{4H2 + 2O2 -> 4H2O} \\quad "becomes" \\quad \\ce{2H2 + O2 -> 2H2O}', '\\ce{4H2 + 2O2 -> 4H2O} \\quad "wird zu" \\quad \\ce{2H2 + O2 -> 2H2O}')],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("From word equation to reaction equation", "Von der Wortgleichung zur Reaktionsgleichung"),
      blob: tx("Words are nice, but chemists count atoms. Let's translate!", "Wörter sind schön, aber Chemiker zählen Atome. Lass uns übersetzen!"),
      body: tx(
        "A reaction equation uses formulas instead of names. Atoms are never lost or created, so every kind of atom has to appear equally often on both sides.",
        "Eine Reaktionsgleichung nutzt Formeln statt Namen. Atome gehen nie verloren und entstehen nie neu, also muss jede Atomsorte auf beiden Seiten gleich oft vorkommen.",
      ),
      frames: waterFrames,
    },
    {
      type: "explain",
      title: tx("The seven diatomic elements", "Die sieben zweiatomigen Elemente"),
      blob: tx("Some elements never travel alone. Remember these seven!", "Manche Elemente sind nie allein unterwegs. Merk dir diese sieben!"),
      body: tx("As elements, hydrogen, nitrogen, oxygen and the halogens form molecules of two atoms. You always write them with a 2.", "Als Elemente bilden Wasserstoff, Stickstoff, Sauerstoff und die Halogene Moleküle aus zwei Atomen. Du schreibst sie immer mit einer 2."),
      frames: pairFrames,
    },
    {
      type: "explain",
      title: tx("Coefficient or index?", "Koeffizient oder Index?"),
      blob: tx("The most important rule of the day!", "Die wichtigste Regel des Tages!"),
      body: tx(
        "The big number **in front** (coefficient) counts whole particles. The small number **behind** a symbol (index) is part of the formula itself.",
        "Die große Zahl **davor** (Koeffizient) zählt ganze Teilchen. Die kleine Zahl **hinter** einem Symbol (Index) gehört zur Formel selbst.",
      ),
      frames: indexFrames,
    },
    { type: "check", blob: tx("Three of these cheat. Which one plays fair?", "Drei davon schummeln. Welche spielt fair?"), exercise: indexCheck },
    {
      type: "widget",
      title: tx("Balance it yourself", "Gleich selbst aus"),
      blob: tx("Tap plus and minus until the scale levels out!", "Tipp auf Plus und Minus, bis die Waage im Gleichgewicht ist!"),
      body: tx(
        "Every atom lands on the scale. It only levels out when **every** kind of atom is the same on both sides, and then the mass is equal too: the law of conservation of mass.",
        "Jedes Atom landet auf der Waage. Sie ist erst im Gleichgewicht, wenn **jede** Atomsorte auf beiden Seiten gleich oft da ist, und dann ist auch die Masse gleich: das Gesetz von der Erhaltung der Masse.",
      ),
      widget: BalancingScale,
    },
    {
      type: "explain",
      title: tx("Blob's strategy, step by step", "Blobs Strategie, Schritt für Schritt"),
      blob: tx("This works for every equation. Watch it on rust!", "Das klappt bei jeder Gleichung. Schau's dir am Rost an!"),
      body: tx(
        "1. Count the atoms. 2. Balance in this order: **metals**, then the other **non-metals**, then **H**, **O** last. 3. If an element gets unbalanced again, fix it again. 4. Check at the end.",
        "1. Atome zählen. 2. In dieser Reihenfolge ausgleichen: **Metalle**, dann die anderen **Nichtmetalle**, dann **H**, **O** zuletzt. 3. Passt ein Element nicht mehr, gleich es noch mal aus. 4. Zum Schluss die Probe.",
      ),
      frames: strategy(RUST)!.frames,
    },
    {
      type: "check",
      blob: tx("Your turn! Metal first, then chlorine.", "Du bist dran! Erst das Metall, dann das Chlor."),
      exercise: balanceExercise(ALCL3),
    },
    {
      type: "explain",
      title: tx("Burning hydrocarbons: the half trick", "Kohlenwasserstoffe verbrennen: der Trick mit dem Halben"),
      blob: tx("Hydrocarbons burn to carbon dioxide and water. Sometimes a half sneaks in!", "Kohlenwasserstoffe verbrennen zu Kohlenstoffdioxid und Wasser. Manchmal schleicht sich ein Halbes ein!"),
      body: tx(
        "Hydrocarbons like methane or ethane burn with oxygen to form $\\ce{CO2}$ and $\\ce{H2O}$. Order: **C** first, then **H**, **O** last. A half in front of $\\ce{O2}$? Double everything.",
        "Kohlenwasserstoffe wie Methan oder Ethan verbrennen mit Sauerstoff zu $\\ce{CO2}$ und $\\ce{H2O}$. Reihenfolge: zuerst **C**, dann **H**, **O** zuletzt. Ein Halbes vor $\\ce{O2}$? Alles verdoppeln.",
      ),
      frames: strategy(ETHANE)!.frames,
    },
    {
      type: "check",
      blob: tx("Camping gas! Propane burns. C, then H, then O.", "Campinggas! Propan verbrennt. Erst C, dann H, dann O."),
      exercise: balanceExercise(PROPANE),
    },
    {
      type: "explain",
      title: tx("Groups that stick together", "Gruppen, die zusammenbleiben"),
      blob: tx("Sulfate, nitrate, phosphate: these groups travel as a team.", "Sulfat, Nitrat, Phosphat: Diese Gruppen reisen im Team."),
      body: tx(
        "If a group like $\\ce{SO4}$ stays unchanged from left to right, count it as **one unit**. Typical: metal + acid → salt + hydrogen, and acid + base → salt + water (neutralisation).",
        "Bleibt eine Gruppe wie $\\ce{SO4}$ von links nach rechts unverändert, zählst du sie als **eine Einheit**. Typisch: Metall + Säure → Salz + Wasserstoff, und Säure + Base → Salz + Wasser (Neutralisation).",
      ),
      frames: strategy(ALSO4)!.frames,
    },
    {
      type: "check",
      blob: tx("A neutralisation with phosphate. Keep the team together!", "Eine Neutralisation mit Phosphat. Halt das Team zusammen!"),
      exercise: balanceExercise(PHOS),
    },
  ],
  generate,
};

export default balancing;
