"use client";

// Probability, level 2 (Klasse 8–10): multi-stage experiments, tree diagrams, the path rules
// (multiply along a path, add the paths), with and without replacement, the complementary event
// and "at least once" = 1 − P(never).

import { tx, type Text } from "@/i18n/text";
import { add, frac, sub, type Frac } from "@/learn/engine/frac";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson } from "@/learn/types";
import { choiceMistakes, fr, frChain, fracAnswer, fracMistakes, frS, numAnswer, numMistakes, round, say, shuffled, visual } from "./kit";
import { BALL, ProbabilityTree, ProbabilityUrn, type Ball, type TreeBranch } from "./pictures";
import { ProbabilityAtLeastOnce, ProbabilityTreeBuilder } from "./widgets2";

const I = {
  withRep: tx("Two draws with replacement", "Zweimal ziehen mit Zurücklegen"),
  withoutRep: tx("Two draws without replacement", "Zweimal ziehen ohne Zurücklegen"),
  stages: tx("Multi-stage: find the probability", "Mehrstufig: Berechne die Wahrscheinlichkeit"),
  atLeast: tx("At least once", "Mindestens einmal"),
  tree: tx("Use the tree diagram", "Nutze das Baumdiagramm"),
  missing: tx("Fill in the tree", "Vervollständige das Baumdiagramm"),
  branches: tx("Which branches are right?", "Welche Äste stimmen?"),
};

const en = (t: Text) => (typeof t === "string" ? t : t.en);
const de = (t: Text) => (typeof t === "string" ? t : t.de);
const q = (n: number, d: number) => frac(n, d);
const qs = (x: Frac) => `${x.n}/${x.d}`;

// ---------------------------------------------------------------------------
// Shared mistake messages

const ADDED: { title: Text; say: Text } = {
  title: tx("Added along the path", "Entlang des Pfades addiert"),
  say: tx(
    "Along a path you **multiply**, you don't add. Otherwise two hits in a row would be more likely than one!",
    "Entlang eines Pfades wird **multipliziert**, nicht addiert. Sonst wären zwei Treffer hintereinander ja wahrscheinlicher als einer!",
  ),
};
const ONE_PATH: { title: Text; say: Text } = {
  title: tx("Only one path", "Nur ein Pfad"),
  say: tx("That's just one path. Several paths belong to this event: add them all (path rule 2).", "Das ist nur ein Pfad. Zu diesem Ereignis gehören mehrere Pfade: Addiere alle (2. Pfadregel)."),
};
const NP: (n: number) => { title: Text; say: Text } = (n) => ({
  title: tx("The classic trap", "Die klassische Falle"),
  say: tx(
    `Ah, the classic trap: ${n} times the single probability. That counts the paths with several hits more than once (and can even go above $1$). Use the complement: $1 - P(\\text{never})$.`,
    `Ah, die klassische Falle: ${n}-mal die Einzelwahrscheinlichkeit. Damit zählst du Pfade mit mehreren Treffern mehrfach (und kannst sogar über $1$ landen). Nimm das Gegenereignis: $1 - P(\\text{nie})$.`,
  ),
});

// ---------------------------------------------------------------------------
// Urn trees

type Urn = { c1: Ball; c2: Ball; a: number; b: number };
const L = (c: Ball) => BALL[c].letter;

/** The two-stage tree of an urn with a balls of colour 1 and b of colour 2. */
function urnTree(u: Urn, replace: boolean): { branches: TreeBranch[]; leaf: Frac[] } {
  const n = u.a + u.b;
  const m = replace ? n : n - 1;
  const after1 = replace ? [u.a, u.b] : [u.a - 1, u.b];
  const after2 = replace ? [u.a, u.b] : [u.a, u.b - 1];
  return {
    branches: [
      { node: L(u.c1), p: `${u.a}/${n}`, kids: [{ node: L(u.c1), p: `${after1[0]}/${m}` }, { node: L(u.c2), p: `${after1[1]}/${m}` }] },
      { node: L(u.c2), p: `${u.b}/${n}`, kids: [{ node: L(u.c1), p: `${after2[0]}/${m}` }, { node: L(u.c2), p: `${after2[1]}/${m}` }] },
    ],
    leaf: [q(u.a * after1[0], n * m), q(u.a * after1[1], n * m), q(u.b * after2[0], n * m), q(u.b * after2[1], n * m)],
  };
}

/** "P(rr)" with the colour letters in the current language. */
const pathName = (cs: Ball[]) => tx(cs.map((c) => en(L(c))).join(""), cs.map((c) => de(L(c))).join(""));

type UrnEvent = { id: "11" | "22" | "12" | "diff" | "same" | "least1"; leaves: number[] };

function urnEventText(e: UrnEvent, u: Urn): { en: string; de: string; label: Text } {
  const a1 = BALL[u.c1];
  const a2 = BALL[u.c2];
  switch (e.id) {
    case "11":
      return { en: `two ${en(a1.adj)} balls`, de: `zwei ${de(a1.adj)} Kugeln`, label: tx(`"2 × ${en(a1.name)}"`, `"2 × ${de(a1.name)}"`) };
    case "22":
      return { en: `two ${en(a2.adj)} balls`, de: `zwei ${de(a2.adj)} Kugeln`, label: tx(`"2 × ${en(a2.name)}"`, `"2 × ${de(a2.name)}"`) };
    case "12":
      return { en: `first a ${en(a1.adj)}, then a ${en(a2.adj)} ball`, de: `erst eine ${de(a1.adj)}, dann eine ${de(a2.adj)} Kugel`, label: pathName([u.c1, u.c2]) };
    case "diff":
      return { en: "two different colours", de: "zwei verschiedene Farben", label: tx(`"different"`, `"verschieden"`) };
    case "same":
      return { en: "two balls of the same colour", de: "zwei Kugeln derselben Farbe", label: tx(`"same colour"`, `"gleiche Farbe"`) };
    case "least1":
      return { en: `at least one ${en(a1.adj)} ball`, de: `mindestens eine ${de(a1.adj)} Kugel`, label: tx(`"at least 1 × ${en(a1.name)}"`, `"mind. 1 × ${de(a1.name)}"`) };
  }
}

const URN_EVENTS: UrnEvent[] = [
  { id: "11", leaves: [0] },
  { id: "22", leaves: [3] },
  { id: "12", leaves: [1] },
  { id: "diff", leaves: [1, 2] },
  { id: "same", leaves: [0, 3] },
  { id: "least1", leaves: [0, 1, 2] },
];

const WORDS = ["11", "12", "21", "22"];

function urnTask(rng: Rng, replace: boolean): Exercise {
  const [c1, c2] = rng.shuffle<Ball>(["red", "green", "purple"]).slice(0, 2);
  const u: Urn = { c1, c2, a: rng.int(2, 6), b: rng.int(2, 6) };
  const e = rng.pick(URN_EVENTS);
  const ev = urnEventText(e, u);
  const n = u.a + u.b;
  const tree = urnTree(u, replace);
  const other = urnTree(u, !replace);
  const right = e.leaves.reduce((s, i) => add(s, tree.leaf[i]), q(0, 1));
  const otherValue = e.leaves.reduce((s, i) => add(s, other.leaf[i]), q(0, 1));
  const paths = e.leaves.map((i) => WORDS[i].split("").map((d) => (d === "1" ? c1 : c2)));
  const first = (c: Ball) => (c === c1 ? u.a : u.b);
  const m = replace ? n : n - 1;
  const second = (x: Ball, y: Ball) => (replace ? first(y) : first(y) - (x === y ? 1 : 0));
  const prodSrc = paths.map(([x, y]) => `${fr(first(x), n)} \\cdot ${fr(second(x, y), m)}`).join(" + ");
  const leafSrc = paths.map(([x, y]) => fr(first(x) * second(x, y), n * m)).join(" + ");
  const sumN = paths.reduce((s, [x, y]) => s + first(x) * second(x, y), 0);
  const cands: { v: Frac | null; title: Text; say: Text }[] = [];
  if (paths.length === 1) {
    const [x, y] = paths[0];
    cands.push({ v: add(q(first(x), n), q(second(x, y), m)), ...ADDED });
  } else {
    const [x, y] = paths[0];
    cands.push({ v: q(first(x) * second(x, y), n * m), ...ONE_PATH });
  }
  cands.push(
    replace
      ? {
          v: otherValue,
          title: tx("Calculated without replacement", "Ohne Zurücklegen gerechnet"),
          say: tx("You calculated as if the first ball stayed out. Here it goes back: the urn is full again for the second draw.", "Du hast so gerechnet, als bliebe die erste Kugel draußen. Hier wird sie zurückgelegt: Beim zweiten Zug ist die Urne wieder voll."),
        }
      : {
          v: otherValue,
          title: tx("Calculated with replacement", "Mit Zurücklegen gerechnet"),
          say: tx(`The first ball stays out! For the second draw there are only $${n - 1}$ balls left.`, `Die erste Kugel bleibt draußen! Beim zweiten Zug liegen nur noch $${n - 1}$ Kugeln in der Urne.`),
        },
  );
  if (!replace) {
    // Only the denominator or only the numerator changed.
    const onlyDen = paths.reduce((s, [x, y]) => add(s, q(first(x) * first(y), n * (n - 1))), q(0, 1));
    const onlyNum = paths.reduce((s, [x, y]) => add(s, q(first(x) * second(x, y), n * n)), q(0, 1));
    cands.push({
      v: onlyDen,
      title: tx("Colour count not reduced", "Farbe nicht verringert"),
      say: tx("You reduced the total, good. But if the second ball has the same colour, there's also one fewer of **that** colour.", "Die Gesamtzahl hast du verringert, gut. Hat die zweite Kugel dieselbe Farbe, ist aber auch von **dieser** Farbe eine weniger da."),
    });
    cands.push({
      v: onlyNum,
      title: tx("Total not reduced", "Gesamtzahl nicht verringert"),
      say: tx(`The total gets smaller too: after the first draw only $${n - 1}$ balls are left.`, `Auch die Gesamtzahl wird kleiner: Nach dem ersten Zug sind nur noch $${n - 1}$ Kugeln übrig.`),
    });
  }
  if (e.id === "least1") {
    cands.push({
      v: q(first(c1) * 2, n),
      ...NP(2),
    });
  }
  const label = ev.label;
  const pre = tx(`P(${en(label)})`, `P(${de(label)})`);
  return {
    instruction: replace ? I.withRep : I.withoutRep,
    text: tx(
      `An urn holds $${u.a}$ ${en(BALL[c1].adj)} and $${u.b}$ ${en(BALL[c2].adj)} balls. You draw two balls one after the other, ${replace ? "putting the first one **back**" : "**without** putting the first one back"}. What is the probability of ${ev.en}?`,
      `In einer Urne liegen $${u.a}$ ${de(BALL[c1].adj)} und $${u.b}$ ${de(BALL[c2].adj)} Kugeln. Du ziehst nacheinander zwei Kugeln${replace ? " und legst die erste **zurück**" : " **ohne** Zurücklegen"}. Wie groß ist die Wahrscheinlichkeit für ${ev.de}?`,
    ),
    visual: visual(ProbabilityUrn, { balls: [{ color: c1, n: u.a }, { color: c2, n: u.b }] }),
    answer: fracAnswer(right),
    hint: replace
      ? tx("Draw the tree: both stages look the same. Multiply along each path, add the paths you need.", "Zeichne den Baum: Beide Stufen sehen gleich aus. Multipliziere entlang der Pfade und addiere die Pfade, die du brauchst.")
      : tx("Draw the tree: on the second stage there is one ball fewer, of the colour you drew first.", "Zeichne den Baum: Auf der zweiten Stufe fehlt eine Kugel, und zwar von der Farbe, die du zuerst gezogen hast."),
    solution: [
      ...(e.id === "12"
        ? []
        : [
            {
              math: tx(`${en(pre)} = ${paths.map((p) => `P(${p.map((c) => en(L(c))).join("")})`).join(" + ")}`, `${de(pre)} = ${paths.map((p) => `P(${p.map((c) => de(L(c))).join("")})`).join(" + ")}`),
              note: paths.length === 1 ? tx("One path belongs to this event.", "Zu diesem Ereignis gehört ein Pfad.") : tx(`${paths.length} paths belong to this event.`, `Zu diesem Ereignis gehören ${paths.length} Pfade.`),
            },
          ]),
      {
        math: `P = ${prodSrc}`,
        note: replace
          ? tx("Multiply along each path. With replacement, the second stage looks like the first.", "Multipliziere entlang jedes Pfades. Mit Zurücklegen sieht die zweite Stufe aus wie die erste.")
          : tx(`Multiply along each path. Without replacement, the second stage has only $${n - 1}$ balls.`, `Multipliziere entlang jedes Pfades. Ohne Zurücklegen hat die zweite Stufe nur noch $${n - 1}$ Kugeln.`),
      },
      ...(paths.length > 1 ? [{ math: `P = ${leafSrc}`, note: tx("Work out each path.", "Jeden Pfad ausrechnen.") }] : []),
      { math: `P = ${frChain(sumN, n * m)}`, note: paths.length > 1 ? tx("Add the paths (path rule 2) and simplify.", "Pfade addieren (2. Pfadregel) und kürzen.") : tx("Simplify if you can.", "Kürzen, wenn es geht.") },
    ],
    mistakes: fracMistakes(right, cands),
  };
}

// ---------------------------------------------------------------------------
// Coins and dice

function stagesTask(rng: Rng): Exercise {
  if (rng.chance(0.45)) {
    // coin three times
    const kind = rng.pick(["all", "exact2", "exact1", "none", "order"] as const);
    const right = kind === "exact2" || kind === "exact1" ? q(3, 8) : q(1, 8);
    const ev: Record<typeof kind, [string, string]> = {
      all: ["heads three times", "dreimal Wappen"],
      exact2: ["exactly two heads", "genau zweimal Wappen"],
      exact1: ["exactly one head", "genau einmal Wappen"],
      none: ["no heads at all", "kein einziges Mal Wappen"],
      order: ["heads, tails, heads in this order", "Wappen, Zahl, Wappen in dieser Reihenfolge"],
    };
    const exact = kind === "exact2" || kind === "exact1";
    const paths = kind === "exact2" ? ["HHT", "HTH", "THH"] : kind === "exact1" ? ["HTT", "THT", "TTH"] : [];
    const deP = (s: string) => s.replace(/H/g, "W").replace(/T/g, "Z");
    return {
      instruction: I.stages,
      text: tx(`You toss a fair coin three times. What is the probability of ${ev[kind][0]}?`, `Du wirfst eine faire Münze dreimal. Wie groß ist die Wahrscheinlichkeit für ${ev[kind][1]}?`),
      answer: fracAnswer(right),
      hint: tx("The tree has $2 \\cdot 2 \\cdot 2 = 8$ paths, each with probability $\\frac{1}{8}$. How many paths fit?", "Der Baum hat $2 \\cdot 2 \\cdot 2 = 8$ Pfade, jeder mit der Wahrscheinlichkeit $\\frac{1}{8}$. Wie viele Pfade passen?"),
      solution: [
        { math: "\\frac{1}{2} \\cdot \\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{8}", note: tx("Every path of the tree has the probability $\\frac{1}{8}$ (path rule 1).", "Jeder Pfad im Baum hat die Wahrscheinlichkeit $\\frac{1}{8}$ (1. Pfadregel).") },
        exact
          ? { math: tx(`${paths.join(", \\; ")}`, `${paths.map(deP).join(", \\; ")}`), note: tx("Three paths fit.", "Drei Pfade passen.") }
          : { math: tx(kind === "all" ? "HHH" : kind === "none" ? "TTT" : "HTH", kind === "all" ? "WWW" : kind === "none" ? "ZZZ" : "WZW"), note: tx("Only one path fits.", "Nur ein Pfad passt.") },
        { math: exact ? "P = \\frac{1}{8} + \\frac{1}{8} + \\frac{1}{8} = \\frac{3}{8}" : "P = \\frac{1}{8}", note: exact ? tx("Add the paths (path rule 2).", "Pfade addieren (2. Pfadregel).") : tx("That's the answer.", "Das ist das Ergebnis.") },
      ],
      mistakes: fracMistakes(right, [
        ...(exact ? [{ v: q(1, 8), ...ONE_PATH }] : []),
        ...(exact ? [{ v: q(kind === "exact2" ? 2 : 1, 3), title: tx("Counted heads, not paths", "Würfe statt Pfade gezählt"), say: tx("Probabilities don't come from counting tosses. Draw the tree and count the paths that fit.", "Wahrscheinlichkeiten kommen nicht vom Zählen der Würfe. Zeichne den Baum und zähle die passenden Pfade.") }] : []),
        ...(kind === "all" || kind === "none" ? [{ v: q(3, 2), ...ADDED }] : []),
        ...(kind === "all" || kind === "none" ? [{ v: q(1, 6), title: tx("Added the stages", "Stufen addiert"), say: tx("Three stages with two branches each give $2 \\cdot 2 \\cdot 2 = 8$ paths, not $2 + 2 + 2 = 6$.", "Drei Stufen mit je zwei Ästen ergeben $2 \\cdot 2 \\cdot 2 = 8$ Pfade, nicht $2 + 2 + 2 = 6$.") }] : []),
      ]),
    };
  }
  // die twice
  const kind = rng.pick(["66", "double", "sum", "sum", "6then", "evenEven"] as const);
  if (kind === "sum") {
    const s = rng.pick([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const pairs: [number, number][] = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) pairs.push([a, b]);
    const right = q(pairs.length, 36);
    return {
      instruction: I.stages,
      text: tx(`You roll two dice (or one die twice). What is the probability that the sum is $${s}$?`, `Du würfelst mit zwei Würfeln (oder zweimal mit einem). Wie groß ist die Wahrscheinlichkeit für die Augensumme $${s}$?`),
      answer: fracAnswer(right),
      hint: tx("There are $6 \\cdot 6 = 36$ equally likely pairs. List the pairs with this sum.", "Es gibt $6 \\cdot 6 = 36$ gleich wahrscheinliche Paare. Schreib die Paare mit dieser Summe auf."),
      solution: [
        { math: "6 \\cdot 6 = 36", note: tx("Every pair (first die, second die) has the probability $\\frac{1}{36}$.", "Jedes Paar (erster Wurf, zweiter Wurf) hat die Wahrscheinlichkeit $\\frac{1}{36}$.") },
        { math: pairs.map(([a, b]) => `(${a}, ${b})`).join(" \\; "), note: tx(`$${pairs.length}$ pairs give the sum $${s}$. Note: $(1, 2)$ and $(2, 1)$ are different paths.`, `$${pairs.length}$ Paare ergeben die Summe $${s}$. Achtung: $(1, 2)$ und $(2, 1)$ sind verschiedene Pfade.`) },
        { math: `P = ${frChain(pairs.length, 36)}`, note: tx("Add the paths.", "Pfade addieren.") },
      ],
      mistakes: fracMistakes(right, [
        { v: q(1, 11), title: tx("Sums aren't equally likely", "Summen sind nicht gleich wahrscheinlich"), say: tx("There are $11$ possible sums from $2$ to $12$, but they're **not** equally likely: $7$ can happen in many ways, $2$ in only one. Count the pairs.", "Es gibt $11$ mögliche Summen von $2$ bis $12$, aber die sind **nicht** gleich wahrscheinlich: Die $7$ kann auf viele Arten entstehen, die $2$ nur auf eine. Zähl die Paare.") },
        { v: pairs.length > 1 ? q(Math.ceil(pairs.length / 2), 36) : null, title: tx("Order forgotten", "Reihenfolge vergessen"), say: tx("$(1, 2)$ and $(2, 1)$ are two different paths: the first die can show either number.", "$(1, 2)$ und $(2, 1)$ sind zwei verschiedene Pfade: Der erste Würfel kann jede der beiden Zahlen zeigen.") },
      ]),
    };
  }
  const data: Record<Exclude<typeof kind, "sum">, { en: string; de: string; right: Frac; src: string; note: Text; wrong: { v: Frac; title: Text; say: Text }[] }> = {
    "66": {
      en: "two sixes",
      de: "zwei Sechsen",
      right: q(1, 36),
      src: "\\frac{1}{6} \\cdot \\frac{1}{6} = \\frac{1}{36}",
      note: tx("One path: six and six. Multiply.", "Ein Pfad: Sechs und Sechs. Multiplizieren."),
      wrong: [{ v: q(1, 3), ...ADDED }],
    },
    double: {
      en: "a double (both dice show the same number)",
      de: "einen Pasch (beide Würfel zeigen dieselbe Zahl)",
      right: q(1, 6),
      src: "6 \\cdot \\frac{1}{36} = \\frac{6}{36} = \\frac{1}{6}",
      note: tx("Six paths: $(1, 1)$ to $(6, 6)$, each $\\frac{1}{36}$.", "Sechs Pfade: $(1, 1)$ bis $(6, 6)$, jeder $\\frac{1}{36}$."),
      wrong: [{ v: q(1, 36), ...ONE_PATH }],
    },
    "6then": {
      en: "first a six, then no six",
      de: "erst eine Sechs, dann keine Sechs",
      right: q(5, 36),
      src: "\\frac{1}{6} \\cdot \\frac{5}{6} = \\frac{5}{36}",
      note: tx("One path: six, then not six.", "Ein Pfad: Sechs, dann keine Sechs."),
      wrong: [
        { v: q(1, 1), ...ADDED },
        { v: q(10, 36), title: tx("Order matters here", "Hier zählt die Reihenfolge"), say: tx("“First a six, then no six” is one path. The other order doesn't count.", "„Erst eine Sechs, dann keine“ ist ein Pfad. Die andere Reihenfolge zählt hier nicht.") },
      ],
    },
    evenEven: {
      en: "two even numbers",
      de: "zwei gerade Zahlen",
      right: q(1, 4),
      src: "\\frac{3}{6} \\cdot \\frac{3}{6} = \\frac{9}{36} = \\frac{1}{4}",
      note: tx("Even on the first **and** on the second roll: multiply.", "Gerade beim ersten **und** beim zweiten Wurf: multiplizieren."),
      wrong: [{ v: q(1, 1), ...ADDED }, { v: q(1, 2), title: tx("Only one roll", "Nur ein Wurf"), say: tx("That's one roll. Both rolls have to be even: multiply the two stages.", "Das ist nur ein Wurf. Beide Würfe müssen gerade sein: Multipliziere die beiden Stufen.") }],
    },
  };
  const d = data[kind];
  return {
    instruction: I.stages,
    text: tx(`You roll a die twice. What is the probability of ${d.en}?`, `Du würfelst zweimal. Wie groß ist die Wahrscheinlichkeit für ${d.de}?`),
    answer: fracAnswer(d.right),
    hint: tx("Think of the tree: which paths belong to the event? Multiply along them, add them up.", "Denk an den Baum: Welche Pfade gehören zum Ereignis? Entlang multiplizieren, Pfade addieren."),
    solution: [
      { math: "6 \\cdot 6 = 36", note: tx("Two rolls: $36$ equally likely paths.", "Zwei Würfe: $36$ gleich wahrscheinliche Pfade.") },
      { math: `P = ${d.src}`, note: d.note },
    ],
    mistakes: fracMistakes(d.right, d.wrong),
  };
}

// ---------------------------------------------------------------------------
// At least once

function atLeastTask(rng: Rng): Exercise {
  const kind = rng.pick(["die", "die", "coin", "wheel", "urn"] as const);
  let p: Frac;
  let n: number;
  let enT: string;
  let deT: string;
  let enE: string;
  let deE: string;
  if (kind === "die") {
    p = q(1, 6);
    n = rng.int(2, 3);
    enT = `You roll a die $${n}$ times.`;
    deT = `Du würfelst $${n}$-mal.`;
    enE = "at least one six";
    deE = "mindestens eine Sechs";
  } else if (kind === "coin") {
    p = q(1, 2);
    n = rng.int(2, 5);
    enT = `You toss a coin $${n}$ times.`;
    deT = `Du wirfst eine Münze $${n}$-mal.`;
    enE = "heads at least once";
    deE = "mindestens einmal Wappen";
  } else if (kind === "wheel") {
    const d = rng.pick([3, 4, 5]);
    p = q(1, d);
    n = rng.int(2, 3);
    enT = `A spinner has $${d}$ equal fields, one of them is purple. You spin it $${n}$ times.`;
    deT = `Ein Glücksrad hat $${d}$ gleich große Felder, eins davon ist lila. Du drehst $${n}$-mal.`;
    enE = "purple at least once";
    deE = "mindestens einmal Lila";
  } else {
    const r = rng.int(1, 3);
    const g = rng.int(2, 5);
    p = q(r, r + g);
    n = 2;
    enT = `An urn holds $${r}$ red and $${g}$ green balls. You draw twice, putting the ball back each time.`;
    deT = `In einer Urne liegen $${r}$ rote und $${g}$ grüne Kugeln. Du ziehst zweimal mit Zurücklegen.`;
    enE = "at least one red ball";
    deE = "mindestens eine rote Kugel";
  }
  const notP = sub(q(1, 1), p);
  const never = q(notP.n ** n, notP.d ** n);
  const right = sub(q(1, 1), never);
  const pw = (x: Frac) => `(${frS(x)})^{${n}}`;
  return {
    instruction: I.atLeast,
    text: tx(`${enT} What is the probability of ${enE}?`, `${deT} Wie groß ist die Wahrscheinlichkeit für ${deE}?`),
    answer: fracAnswer(right),
    hint: tx("Use the complement: “at least once” is everything except “never”.", "Nimm das Gegenereignis: „Mindestens einmal“ ist alles außer „nie“."),
    solution: [
      { math: tx(`P("at least once") = 1 - P("never")`, `P("mindestens einmal") = 1 - P("nie")`), note: tx("“At least once” has many paths. Its complement “never” has just one.", "„Mindestens einmal“ hat viele Pfade. Das Gegenereignis „nie“ hat nur einen.") },
      { math: tx(`P("never") = ${pw(notP)} = ${frS(never)}`, `P("nie") = ${pw(notP)} = ${frS(never)}`), note: tx(`Never means: a miss $${n}$ times in a row, each with probability $${frS(notP)}$.`, `Nie heißt: $${n}$-mal hintereinander kein Treffer, jedes Mal mit der Wahrscheinlichkeit $${frS(notP)}$.`) },
      { math: tx(`P("at least once") = 1 - ${frS(never)} = ${frS(right)}`, `P("mindestens einmal") = 1 - ${frS(never)} = ${frS(right)}`), note: tx("Subtract from $1$.", "Von $1$ abziehen.") },
    ],
    mistakes: fracMistakes(right, [
      { v: q(p.n * n, p.d), ...NP(n) },
      { v: never, title: tx("Forgot the 1 −", "Das „1 −“ vergessen"), say: tx("That's the probability of **never**. You still need $1$ minus that.", "Das ist die Wahrscheinlichkeit für **nie**. Du brauchst noch $1$ minus das.") },
      { v: q(p.n ** n, p.d ** n), title: tx("Every time, not at least once", "Jedes Mal statt mindestens einmal"), say: tx(`That's the probability of a hit **every** time. “At least once” is much more likely.`, `Das ist die Wahrscheinlichkeit für **jedes Mal** einen Treffer. „Mindestens einmal“ ist viel wahrscheinlicher.`) },
      { v: sub(q(1, 1), q(p.n ** n, p.d ** n)), title: tx("Wrong complement", "Falsches Gegenereignis"), say: tx("The complement of “at least once” is “never”, not “every time”. Use the probability of a miss.", "Das Gegenereignis von „mindestens einmal“ ist „nie“, nicht „jedes Mal“. Nimm die Wahrscheinlichkeit für keinen Treffer.") },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Trees with decimals

type Ctx = { en: string; de: string; a: Text; b: Text; dep: boolean };
const CONTEXTS: Ctx[] = [
  { en: "Tom takes a bus and then a train.", de: "Tom fährt erst mit dem Bus und dann mit der Bahn.", a: tx("the bus is on time", "der Bus ist pünktlich"), b: tx("the train is on time", "die Bahn ist pünktlich"), dep: false },
  { en: "Mia takes two penalties.", de: "Mia schießt zwei Elfmeter.", a: tx("she scores with the first", "sie trifft beim ersten"), b: tx("she scores with the second", "sie trifft beim zweiten"), dep: true },
  { en: "On the way to school Lena passes two traffic lights.", de: "Auf dem Schulweg kommt Lena an zwei Ampeln vorbei.", a: tx("the first light is green", "die erste Ampel ist grün"), b: tx("the second light is green", "die zweite Ampel ist grün"), dep: true },
  { en: "The weather forecast for the weekend.", de: "Die Wettervorhersage fürs Wochenende.", a: tx("it rains on Saturday", "es regnet am Samstag"), b: tx("it rains on Sunday", "es regnet am Sonntag"), dep: true },
  { en: "A machine part goes through two independent checks.", de: "Ein Bauteil durchläuft zwei unabhängige Prüfungen.", a: tx("it passes the first check", "es besteht die erste Prüfung"), b: tx("it passes the second check", "es besteht die zweite Prüfung"), dep: false },
];

const tenths = (rng: Rng, lo = 2, hi = 9) => rng.int(lo, hi) / 10;

function decTreeTask(rng: Rng): Exercise {
  const c = rng.pick(CONTEXTS);
  const pa = tenths(rng);
  const pb1 = tenths(rng);
  let pb2 = c.dep ? tenths(rng, 1, 8) : pb1;
  if (c.dep && pb2 === pb1) pb2 = pb1 > 0.5 ? round(pb1 - 0.3, 1) : round(pb1 + 0.3, 1);
  const ask = rng.pick(["both", "exact", "least", "none"] as const);
  const paths = [round(pa * pb1, 4), round(pa * (1 - pb1), 4), round((1 - pa) * pb2, 4), round((1 - pa) * (1 - pb2), 4)];
  const leaves = { both: [0], exact: [1, 2], least: [0, 1, 2], none: [3] }[ask];
  const right = round(leaves.reduce((s, i) => s + paths[i], 0), 4);
  const branches: TreeBranch[] = [
    { node: "A", p: pa, kids: [{ node: "B", p: pb1 }, { node: "~B", p: round(1 - pb1, 1) }] },
    { node: "~A", p: round(1 - pa, 1), kids: [{ node: "B", p: pb2 }, { node: "~B", p: round(1 - pb2, 1) }] },
  ];
  const askText = {
    both: tx("both $A$ and $B$ happen", "$A$ und $B$ beide eintreten"),
    exact: tx("exactly one of the two happens", "genau eins von beiden eintritt"),
    least: tx("at least one of the two happens", "mindestens eins von beiden eintritt"),
    none: tx("neither of them happens", "keins von beiden eintritt"),
  }[ask];
  const factors = [
    [pa, pb1],
    [pa, round(1 - pb1, 1)],
    [round(1 - pa, 1), pb2],
    [round(1 - pa, 1), round(1 - pb2, 1)],
  ];
  const cands: { v: number | null; title: Text; say: Text }[] = [];
  if (ask === "both") cands.push({ v: pa + pb1, ...ADDED });
  if (ask === "exact") cands.push({ v: paths[1], ...ONE_PATH }, { v: paths[2], ...ONE_PATH });
  if (ask === "least") {
    cands.push({ v: pa + pb1, title: tx("Added the branches", "Äste addiert"), say: tx("Adding $P(A)$ and $P(B)$ counts the path where both happen twice. Easier: $1 - P(\\text{neither})$.", "Wenn du $P(A)$ und $P(B)$ addierst, zählst du den Pfad, auf dem beides eintritt, doppelt. Einfacher: $1 - P(\\text{keins})$.") });
    cands.push({ v: paths[1] + paths[2], title: tx("“Both” forgotten", "„Beide“ vergessen"), say: tx("At least one includes the path where **both** happen.", "Mindestens eins schließt den Pfad mit ein, auf dem **beides** eintritt.") });
  }
  if (ask === "none") cands.push({ v: 1 - paths[0], title: tx("Wrong complement", "Falsches Gegenereignis"), say: tx("$1 - P(A \\text{ and } B)$ is “not both”. “Neither” is only the bottom path.", "$1 - P(A \\text{ und } B)$ heißt „nicht beide“. „Keins von beiden“ ist nur der unterste Pfad.") });
  const sumSrc = (f: { n: (v: number, d?: number) => string }) => leaves.map((i) => `${f.n(factors[i][0])} \\cdot ${f.n(factors[i][1])}`).join(" + ");
  const valSrc = (f: { n: (v: number, d?: number) => string }) => leaves.map((i) => f.n(paths[i])).join(" + ");
  return {
    instruction: I.tree,
    text: tx(
      `${c.en} $A$: ${en(c.a)}. $B$: ${en(c.b)}. The tree shows the probabilities. What is the probability that ${en(askText)}?`,
      `${c.de} $A$: ${de(c.a)}. $B$: ${de(c.b)}. Das Baumdiagramm zeigt die Wahrscheinlichkeiten. Wie groß ist die Wahrscheinlichkeit, dass ${de(askText)}?`,
    ),
    visual: visual(ProbabilityTree, { branches }),
    answer: numAnswer(right),
    hint: tx("Find the paths that fit. Multiply along each, then add them.", "Such die passenden Pfade. Multipliziere entlang jedes Pfades, dann addiere."),
    solution: [
      { math: say((f) => `P = ${sumSrc(f)}`), note: leaves.length === 1 ? tx("One path: multiply along it.", "Ein Pfad: entlang multiplizieren.") : tx(`${leaves.length} paths: multiply along each one.`, `${leaves.length} Pfade: entlang jedes Pfades multiplizieren.`) },
      ...(leaves.length > 1 ? [{ math: say((f) => `P = ${valSrc(f)}`), note: tx("Add the paths.", "Pfade addieren.") }] : []),
      { math: say((f) => `P = ${f.n(right)}`), note: say((f) => f.t(`That's $\\group{${f.pc(right)} \\, %}$.`, `Das sind $\\group{${f.pc(right)} \\, %}$.`)) },
    ],
    mistakes: numMistakes(right, 1e-6, cands),
  };
}

// ---------------------------------------------------------------------------
// Missing branch

function missingTask(rng: Rng): Exercise {
  const pa = tenths(rng);
  const pb = tenths(rng, 1, 9);
  const pb2 = tenths(rng, 1, 9);
  const mode = rng.pick(["sum", "sum", "path"] as const);
  if (mode === "sum") {
    const which = rng.pick(["a", "b", "c"] as const);
    const branches: TreeBranch[] = [
      { node: "A", p: pa, kids: [{ node: "B", p: pb }, { node: "~B", p: which === "b" ? "?" : round(1 - pb, 1) }] },
      { node: "~A", p: which === "a" ? "?" : round(1 - pa, 1), kids: [{ node: "B", p: which === "c" ? "?" : pb2 }, { node: "~B", p: round(1 - pb2, 1) }] },
    ];
    const given = which === "a" ? pa : which === "b" ? pb : round(1 - pb2, 1);
    const right = round(1 - given, 1);
    return {
      instruction: I.missing,
      text: tx("What probability belongs on the branch marked “?”", "Welche Wahrscheinlichkeit gehört an den Ast mit dem „?“?"),
      visual: visual(ProbabilityTree, { branches }),
      answer: numAnswer(right),
      hint: tx("The branches leaving one point always add up to $1$.", "Die Äste, die von einem Punkt ausgehen, ergeben zusammen immer $1$."),
      solution: [
        { math: say((f) => `${f.n(given)} + x = 1`), note: tx("Something always happens: at each point the branches add up to $1$.", "Irgendwas passiert immer: An jedem Punkt ergeben die Äste zusammen $1$.") },
        { math: say((f) => `x = 1 - ${f.n(given)} = ${f.n(right)}`), note: tx("Subtract.", "Subtrahieren.") },
      ],
      mistakes: numMistakes(right, 1e-6, [
        { v: given, title: tx("Copied", "Abgeschrieben"), say: tx("Both branches can only have the same probability if it's $0.5$. They have to add up to $1$.", "Beide Äste haben nur dann dieselbe Wahrscheinlichkeit, wenn es $0,5$ ist. Zusammen müssen sie $1$ ergeben.") },
        { v: round(1 + given, 1), title: tx("Added", "Addiert"), say: tx("More than $1$ is impossible for a probability. The two branches **together** make $1$.", "Mehr als $1$ geht bei einer Wahrscheinlichkeit nicht. Die beiden Äste ergeben **zusammen** $1$.") },
      ]),
    };
  }
  const path = round(pa * pb, 4);
  const branches: TreeBranch[] = [
    { node: "A", p: pa, kids: [{ node: "B", p: "?" }, { node: "~B", p: "" }] },
    { node: "~A", p: round(1 - pa, 1), kids: [{ node: "B", p: "" }, { node: "~B", p: "" }] },
  ];
  return {
    instruction: I.missing,
    text: say((f) =>
      f.t(
        `The path $A$, then $B$ has the probability $${f.n(path)}$. What probability belongs on the branch marked “?”`,
        `Der Pfad $A$, dann $B$ hat die Wahrscheinlichkeit $${f.n(path)}$. Welche Wahrscheinlichkeit gehört an den Ast mit dem „?“?`,
      ),
    ),
    visual: visual(ProbabilityTree, { branches }),
    answer: numAnswer(pb),
    hint: tx("Path rule 1 backwards: path probability = first branch · second branch.", "1. Pfadregel rückwärts: Pfadwahrscheinlichkeit = erster Ast · zweiter Ast."),
    solution: [
      { math: say((f) => `${f.n(pa)} \\cdot x = ${f.n(path)}`), note: tx("Along the path you multiply.", "Entlang des Pfades wird multipliziert.") },
      { math: say((f) => `x = ${f.n(path)} : ${f.n(pa)} = ${f.n(pb)}`), note: tx("So divide the path probability by the first branch.", "Also teilst du die Pfadwahrscheinlichkeit durch den ersten Ast.") },
    ],
    mistakes: numMistakes(pb, 1e-6, [
      { v: round(path * pa, 4), title: tx("Multiplied again", "Noch mal multipliziert"), say: tx("The path is already the product. To get the missing factor, **divide** by the first branch.", "Der Pfad ist schon das Produkt. Für den fehlenden Faktor **teilst** du durch den ersten Ast.") },
      { v: round(path - pa, 4) > 0 ? round(path - pa, 4) : null, title: tx("Subtracted", "Subtrahiert"), say: tx("Along a path you multiply, so undo it by dividing.", "Entlang eines Pfades wird multipliziert, also machst du es mit Teilen rückgängig.") },
      { v: round(1 - path, 4), title: tx("Complement of the path", "Gegenwahrscheinlichkeit des Pfades"), say: tx("$1 - $ path is the probability of all the other paths together. Divide by the first branch instead.", "$1 -$ Pfad ist die Wahrscheinlichkeit aller anderen Pfade zusammen. Teile stattdessen durch den ersten Ast.") },
    ]),
  };
}

// ---------------------------------------------------------------------------
// Second stage without replacement (choice)

function branchesTask(rng: Rng): Exercise {
  const r = rng.int(2, 6);
  const g = rng.int(2, 6);
  const n = r + g;
  const firstRed = rng.chance(0.6);
  const opt = (a: number, b: number, c: number, d: number) => tx(`red: $${fr(a, b)}$, green: $${fr(c, d)}$`, `rot: $${fr(a, b)}$, grün: $${fr(c, d)}$`);
  const right = firstRed ? opt(r - 1, n - 1, g, n - 1) : opt(r, n - 1, g - 1, n - 1);
  const same = opt(r, n, g, n);
  const numOnly = firstRed ? opt(r - 1, n, g, n) : opt(r, n, g - 1, n);
  const denOnly = opt(r, n - 1, g, n - 1);
  const items = [right, same, numOnly, denOnly];
  const s = shuffled(rng.shuffle, items, 0);
  const col = firstRed ? tx("red", "rote") : tx("green", "grüne");
  const colName = firstRed ? tx("red", "rot") : tx("green", "grün");
  return {
    instruction: I.branches,
    text: tx(
      `An urn holds $${r}$ red and $${g}$ green balls. You draw twice **without** replacement. Your first ball was ${en(colName)}. Which probabilities belong on the branches of the second stage?`,
      `In einer Urne liegen $${r}$ rote und $${g}$ grüne Kugeln. Du ziehst zweimal **ohne** Zurücklegen. Die erste Kugel war ${de(colName)}. Welche Wahrscheinlichkeiten stehen an den Ästen der zweiten Stufe?`,
    ),
    visual: visual(ProbabilityUrn, { balls: [{ color: "red", n: r }, { color: "green", n: g }] }),
    answer: { kind: "choice", options: s.options, correct: s.correct },
    hint: tx("After the first draw: how many balls are left in total, and how many of each colour?", "Nach dem ersten Zug: Wie viele Kugeln sind insgesamt noch da, und wie viele von jeder Farbe?"),
    solution: [
      { math: tx(`${n} - 1 = ${n - 1} \\; "balls left"`, `${n} - 1 = ${n - 1} \\; "Kugeln übrig"`), note: tx(`One ${en(col)} ball is gone.`, `Eine ${de(col)} Kugel ist weg.`) },
      {
        math: firstRed ? tx(`"red:" \\; ${fr(r - 1, n - 1)} \\quad "green:" \\; ${fr(g, n - 1)}`, `"rot:" \\; ${fr(r - 1, n - 1)} \\quad "grün:" \\; ${fr(g, n - 1)}`) : tx(`"red:" \\; ${fr(r, n - 1)} \\quad "green:" \\; ${fr(g - 1, n - 1)}`, `"rot:" \\; ${fr(r, n - 1)} \\quad "grün:" \\; ${fr(g - 1, n - 1)}`),
        note: tx("Check: the two branches add up to $1$.", "Probe: Die beiden Äste ergeben zusammen $1$."),
      },
    ],
    mistakes: choiceMistakes(s.options, s.correct, [
      { i: s.at(1), title: tx("That's with replacement", "Das wäre mit Zurücklegen"), say: tx("These are the probabilities of the first draw. Without replacement, the urn has changed.", "Das sind die Wahrscheinlichkeiten vom ersten Zug. Ohne Zurücklegen hat sich die Urne verändert.") },
      { i: s.at(2), title: tx("Total not reduced", "Gesamtzahl nicht verringert"), say: tx(`One ball fewer in the urn: only $${n - 1}$ are left. Check: your branches don't add up to $1$.`, `Eine Kugel weniger in der Urne: Es sind nur noch $${n - 1}$. Probe: Deine Äste ergeben nicht $1$.`) },
      { i: s.at(3), title: tx("Colour not reduced", "Farbe nicht verringert"), say: tx(`The missing ball was ${en(colName)}: there's one ${en(col)} ball fewer too. Check: your branches don't add up to $1$.`, `Die fehlende Kugel war ${de(colName)}: Davon gibt es jetzt auch eine weniger. Probe: Deine Äste ergeben nicht $1$.`) },
    ]),
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  const shape = rng.pick(["with", "with", "without", "without", "stages", "stages", "least", "least", "tree", "tree", "missing", "branches"] as const);
  switch (shape) {
    case "with":
      return urnTask(rng, true);
    case "without":
      return urnTask(rng, false);
    case "stages":
      return stagesTask(rng);
    case "least":
      return atLeastTask(rng);
    case "tree":
      return decTreeTask(rng);
    case "missing":
      return missingTask(rng);
    case "branches":
      return branchesTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const coinTree: TreeBranch[] = [
  { node: tx("H", "W"), p: "1/2", kids: [{ node: tx("H", "W"), p: "1/2" }, { node: tx("T", "Z"), p: "1/2" }] },
  { node: tx("T", "Z"), p: "1/2", kids: [{ node: tx("H", "W"), p: "1/2" }, { node: tx("T", "Z"), p: "1/2" }] },
];

const demo = urnTree({ c1: "red", c2: "green", a: 3, b: 2 }, true);
const demoNo = urnTree({ c1: "red", c2: "green", a: 3, b: 2 }, false);
const ends = (leaf: Frac[], keep: number[]) => leaf.map((x, i) => (keep.includes(i) ? qs(x) : null));

const multistage: Frame[] = [
  { math: tx("S#S =#eq \\{#o HH#a ,#c1 HT#b ,#c2 TH#c ,#c3 TT#d \\}#cl", "S#S =#eq \\{#o WW#a ,#c1 WZ#b ,#c2 ZW#c ,#c3 ZZ#d \\}#cl"), note: tx("Four outcomes. The first letter is the first toss, the second letter the second toss.", "Vier Ergebnisse. Der erste Buchstabe steht für den ersten Wurf, der zweite für den zweiten Wurf.") },
  { math: tx(`2#x \\cdot#t 2#y =#eq 4#z \\; "paths"`, `2#x \\cdot#t 2#y =#eq 4#z \\; "Pfade"`), note: tx("Two possibilities at each stage: $2 \\cdot 2 = 4$ paths, one for each outcome.", "Zwei Möglichkeiten auf jeder Stufe: $2 \\cdot 2 = 4$ Pfade, einer für jedes Ergebnis.") },
  { math: "\\frac{1}{2}#x + \\frac{1}{2}#y =#eq 1#z", note: tx("At every branching point, the probabilities add up to $1$: something always happens.", "An jeder Verzweigung ergeben die Wahrscheinlichkeiten zusammen $1$: Irgendwas passiert immer.") },
];

const rule1: Frame[] = [
  { math: "P(rr) =#eq \\frac{3}{5}#f1 \\cdot#t \\frac{3}{5}#f2", note: tx("First ball red: $\\frac{3}{5}$. It goes back, so the second ball is red with $\\frac{3}{5}$ again.", "Erste Kugel rot: $\\frac{3}{5}$. Sie kommt zurück, also ist auch die zweite mit $\\frac{3}{5}$ rot.") },
  { math: "P(rr) =#eq \\frac{3}{5}#f1 \\cdot#t \\frac{3}{5}#f2 =#e2 \\frac{9}{25}#r", note: tx("Numerator times numerator, denominator times denominator.", "Zähler mal Zähler, Nenner mal Nenner.") },
  { math: say((f) => `P(rr) =#eq \\frac{9}{25}#r =#e2 ${f.n(0.36)}#d =#e3 \\group{36 \\, %}`), note: tx("So you draw red twice in a bit more than a third of all cases.", "In gut einem Drittel aller Fälle ziehst du also zweimal Rot.") },
];

const rule2: Frame[] = [
  { math: "E#E =#eq \\{#o rg#a ,#c gr#b \\}#cl", note: tx("Event $E$: two different colours. Two paths belong to it: red then green, and green then red.", "Ereignis $E$: zwei verschiedene Farben. Dazu gehören zwei Pfade: erst rot, dann grün, und erst grün, dann rot.") },
  { math: "P(E) =#eq P(rg)#a +#p P(gr)#b", note: tx("Path rule 2: add the probabilities of the paths.", "2. Pfadregel: Die Wahrscheinlichkeiten der Pfade werden addiert.") },
  { math: "P(E) =#eq \\frac{3}{5} \\cdot \\frac{2}{5} +#p \\frac{2}{5} \\cdot \\frac{3}{5}", note: tx("Each path on its own, with path rule 1.", "Jeden Pfad einzeln, mit der 1. Pfadregel.") },
  { math: "P(E) =#eq \\frac{6}{25}#a +#p \\frac{6}{25}#b", note: tx("Both paths have the same probability here.", "Beide Pfade haben hier dieselbe Wahrscheinlichkeit.") },
  { math: say((f) => `P(E) =#eq \\frac{12}{25}#a =#e2 ${f.n(0.48)} =#e3 \\group{48 \\, %}`), note: tx("Add them up. Done!", "Addieren. Fertig!") },
];

const noReplace: Frame[] = [
  { math: "P(rr) =#eq \\frac{3}{5}#f1 \\cdot#t \\frac{2}{4}#f2", note: tx("First red: $\\frac{3}{5}$. Now only $4$ balls are left, and only $2$ of them are red.", "Erst rot: $\\frac{3}{5}$. Jetzt liegen nur noch $4$ Kugeln drin, davon nur $2$ rote."), highlight: ["2#0", "4#0"] },
  { math: "P(rr) =#eq \\frac{3}{5}#f1 \\cdot#t \\frac{2}{4}#f2 =#e2 \\frac{6}{20}#r =#e3 \\frac{3}{10}#s", note: tx("Multiply and simplify.", "Multiplizieren und kürzen.") },
  { math: "P(gg) =#eq \\frac{2}{5}#f1 \\cdot#t \\frac{1}{4}#f2 =#e2 \\frac{2}{20}#r =#e3 \\frac{1}{10}#s", note: tx("With replacement $P(gg)$ would be $\\frac{4}{25}$. Without replacement, the same colour twice is less likely.", "Mit Zurücklegen wäre $P(gg) = \\frac{4}{25}$. Ohne Zurücklegen ist zweimal dieselbe Farbe seltener.") },
];

const atLeast: Frame[] = [
  { math: tx(`P("at least one 6") =#eq 1#o -#m P("no 6")#n`, `P("mindestens eine 6") =#eq 1#o -#m P("keine 6")#n`), note: tx("Three rolls. “At least one six” has seven paths. Its **complement** “no six” has only one!", "Drei Würfe. „Mindestens eine Sechs“ hat sieben Pfade. Das **Gegenereignis** „keine Sechs“ hat nur einen!") },
  { math: tx(`P("at least one 6") =#eq 1#o -#m \\frac{5}{6} \\cdot \\frac{5}{6} \\cdot \\frac{5}{6}`, `P("mindestens eine 6") =#eq 1#o -#m \\frac{5}{6} \\cdot \\frac{5}{6} \\cdot \\frac{5}{6}`), note: tx("No six three times in a row: path rule 1.", "Dreimal hintereinander keine Sechs: 1. Pfadregel.") },
  { math: tx(`P("at least one 6") =#eq 1#o -#m \\frac{125}{216}#f`, `P("mindestens eine 6") =#eq 1#o -#m \\frac{125}{216}#f`), note: tx("$5 \\cdot 5 \\cdot 5 = 125$ and $6 \\cdot 6 \\cdot 6 = 216$.", "$5 \\cdot 5 \\cdot 5 = 125$ und $6 \\cdot 6 \\cdot 6 = 216$.") },
  {
    math: say((f) => f.t(`P("at least one 6") =#eq \\frac{91}{216}#f \\approx \\group{${f.n(42.1)} \\, %}`, `P("mindestens eine 6") =#eq \\frac{91}{216}#f \\approx \\group{${f.n(42.1)} \\, %}`)),
    note: say((f) => f.t(`Not $\\frac{3}{6} = \\group{50 \\, %}$! Adding $\\frac{1}{6}$ three times counts the paths with several sixes more than once.`, `Nicht $\\frac{3}{6} = \\group{50 \\, %}$! Wer dreimal $\\frac{1}{6}$ addiert, zählt die Pfade mit mehreren Sechsen mehrfach.`)),
  },
];

const withCheck: Exercise = {
  instruction: I.withRep,
  text: tx("An urn holds $2$ red and $4$ green balls. You draw twice and put the ball back after the first draw. What is the probability of **two red** balls?", "In einer Urne liegen $2$ rote und $4$ grüne Kugeln. Du ziehst zweimal und legst die Kugel nach dem ersten Zug zurück. Wie groß ist die Wahrscheinlichkeit für **zwei rote** Kugeln?"),
  visual: visual(ProbabilityUrn, { balls: [{ color: "red", n: 2 }, { color: "green", n: 4 }] }),
  answer: fracAnswer(q(1, 9)),
  hint: tx("Red is $\\frac{2}{6}$ on both draws. Multiply along the path.", "Rot hat bei beiden Zügen $\\frac{2}{6}$. Entlang des Pfades multiplizieren."),
  solution: [
    { math: "P(rr) =#eq \\frac{2}{6}#a \\cdot#t \\frac{2}{6}#b", note: tx("The ball goes back, so both stages look the same.", "Die Kugel kommt zurück, also sehen beide Stufen gleich aus.") },
    { math: "P(rr) =#eq \\frac{2}{6}#a \\cdot#t \\frac{2}{6}#b =#e2 \\frac{4}{36}#r", note: tx("Path rule 1: multiply.", "1. Pfadregel: multiplizieren.") },
    { math: "P(rr) =#eq \\frac{4}{36}#r =#e2 \\frac{1}{9}#s", note: tx("Simplify by $4$.", "Mit $4$ kürzen.") },
  ],
  mistakes: fracMistakes(q(1, 9), [
    { v: q(2, 3), ...ADDED },
    { v: q(1, 15), title: tx("Calculated without replacement", "Ohne Zurücklegen gerechnet"), say: tx("You calculated as if the first ball stayed out. Here it goes back: the urn is full again for the second draw.", "Du hast so gerechnet, als bliebe die erste Kugel draußen. Hier wird sie zurückgelegt: Beim zweiten Zug ist die Urne wieder voll.") },
    { v: q(1, 3), title: tx("Only one stage", "Nur eine Stufe"), say: tx("That's just the first draw. For two red balls, multiply both stages.", "Das ist nur der erste Zug. Für zwei rote Kugeln multiplizierst du beide Stufen.") },
  ]),
};

const exactlyCheck: Exercise = {
  instruction: I.stages,
  text: tx("You roll a die twice. What is the probability of **exactly one** six?", "Du würfelst zweimal. Wie groß ist die Wahrscheinlichkeit für **genau eine** Sechs?"),
  answer: fracAnswer(q(5, 18)),
  hint: tx("Two paths: six then no six, or no six then six.", "Zwei Pfade: erst Sechs, dann keine, oder erst keine, dann Sechs."),
  solution: [
    { math: "P(E) =#eq \\frac{1}{6} \\cdot \\frac{5}{6} +#p \\frac{5}{6} \\cdot \\frac{1}{6}", note: tx("Two paths: six then no six, or no six then six. Multiply along each.", "Zwei Pfade: erst Sechs, dann keine Sechs, oder erst keine, dann Sechs. Entlang jedes Pfades multiplizieren.") },
    { math: "P(E) =#eq \\frac{5}{36}#a +#p \\frac{5}{36}#b", note: tx("Both paths have the same probability.", "Beide Pfade haben dieselbe Wahrscheinlichkeit.") },
    { math: "P(E) =#eq \\frac{10}{36}#a =#e2 \\frac{5}{18}#s", note: tx("Add (path rule 2) and simplify.", "Addieren (2. Pfadregel) und kürzen.") },
  ],
  mistakes: fracMistakes(q(5, 18), [
    { v: q(1, 3), title: tx("Single probabilities added", "Einzelwahrscheinlichkeiten addiert"), say: tx("You added $\\frac{1}{6} + \\frac{1}{6}$. But each path needs both rolls: a six **and** no six. Multiply along the paths first.", "Du hast $\\frac{1}{6} + \\frac{1}{6}$ gerechnet. Jeder Pfad braucht aber beide Würfe: Sechs **und** keine Sechs. Multipliziere erst entlang der Pfade.") },
    { v: q(5, 36), ...ONE_PATH },
    { v: q(11, 36), title: tx("At least, not exactly", "Mindestens statt genau"), say: tx("$\\frac{11}{36}$ would be “at least one six”. With **exactly** one, the path with two sixes doesn't count.", "$\\frac{11}{36}$ wäre „mindestens eine Sechs“. Bei **genau** einer zählt der Pfad mit zwei Sechsen nicht mit.") },
    { v: q(1, 36), title: tx("Two sixes", "Zwei Sechsen"), say: tx("That's the probability of two sixes. You need exactly one.", "Das ist die Wahrscheinlichkeit für zwei Sechsen. Gesucht ist genau eine.") },
  ]),
};

const raffleCheck: Exercise = {
  instruction: I.withoutRep,
  text: tx(
    "A raffle drum holds $10$ tickets, $3$ of them are winners. You draw $2$ tickets one after the other without putting them back. What is the probability that **both** are winners?",
    "In einer Lostrommel sind $10$ Lose, $3$ davon sind Gewinne. Du ziehst nacheinander $2$ Lose, ohne sie zurückzulegen. Wie groß ist die Wahrscheinlichkeit, dass **beide** Gewinne sind?",
  ),
  answer: fracAnswer(q(1, 15)),
  hint: tx("After the first winner, how many tickets and how many winners are left?", "Wie viele Lose und wie viele Gewinne sind nach dem ersten Gewinn noch übrig?"),
  solution: [
    { math: "P(E) =#eq \\frac{3}{10}#a \\cdot#t \\frac{2}{9}#b", note: tx("First a winner: $\\frac{3}{10}$. Then $9$ tickets are left, $2$ of them winners.", "Erst ein Gewinn: $\\frac{3}{10}$. Dann sind noch $9$ Lose übrig, davon $2$ Gewinne.") },
    { math: "P(E) =#eq \\frac{3}{10}#a \\cdot#t \\frac{2}{9}#b =#e2 \\frac{6}{90}#r", note: tx("Path rule 1.", "1. Pfadregel.") },
    { math: "P(E) =#eq \\frac{6}{90}#r =#e2 \\frac{1}{15}#s", note: tx("Simplify by $6$. That's only about $\\group{6.7 \\, %}$.", "Mit $6$ kürzen. Das sind nur etwa $\\group{6,7 \\, %}$.") },
  ],
  mistakes: fracMistakes(q(1, 15), [
    { v: q(9, 100), title: tx("Calculated with replacement", "Mit Zurücklegen gerechnet"), say: tx("The first ticket stays out! For the second draw only $9$ tickets are left, and only $2$ winners.", "Das erste Los bleibt draußen! Beim zweiten Zug sind nur noch $9$ Lose da, davon $2$ Gewinne.") },
    { v: q(1, 10), title: tx("Winners not reduced", "Gewinne nicht verringert"), say: tx("One winner is already gone after the first draw: only $2$ winners are left.", "Nach dem ersten Zug ist schon ein Gewinn weg: Es sind nur noch $2$ Gewinne übrig.") },
    { v: q(3, 50), title: tx("Total not reduced", "Gesamtzahl nicht verringert"), say: tx("The total gets smaller too: after the first draw only $9$ tickets are left.", "Auch die Gesamtzahl wird kleiner: Nach dem ersten Zug sind nur noch $9$ Lose übrig.") },
    { v: q(47, 90), ...ADDED },
  ]),
};

const leastCheck: Exercise = {
  instruction: I.atLeast,
  text: tx("You roll a die twice. What is the probability of **at least one** six?", "Du würfelst zweimal. Wie groß ist die Wahrscheinlichkeit für **mindestens eine** Sechs?"),
  answer: fracAnswer(q(11, 36)),
  hint: tx("Complement: $1 - P(\\text{no six})$.", "Gegenereignis: $1 - P(\\text{keine Sechs})$."),
  solution: [
    { math: tx(`P("at least one 6") =#eq 1#o -#m \\frac{5}{6} \\cdot \\frac{5}{6}`, `P("mindestens eine 6") =#eq 1#o -#m \\frac{5}{6} \\cdot \\frac{5}{6}`), note: tx("The complement “no six” is one path: no six, then no six again.", "Das Gegenereignis „keine Sechs“ ist ein Pfad: keine Sechs und noch mal keine Sechs.") },
    { math: tx(`P("at least one 6") =#eq 1#o -#m \\frac{25}{36}#f`, `P("mindestens eine 6") =#eq 1#o -#m \\frac{25}{36}#f`), note: tx("Path rule 1.", "1. Pfadregel.") },
    { math: tx(`P("at least one 6") =#eq \\frac{11}{36}#f`, `P("mindestens eine 6") =#eq \\frac{11}{36}#f`), note: tx("$1 = \\frac{36}{36}$, take away $\\frac{25}{36}$.", "$1 = \\frac{36}{36}$, davon $\\frac{25}{36}$ abziehen.") },
  ],
  mistakes: fracMistakes(q(11, 36), [
    { v: q(1, 3), ...NP(2) },
    { v: q(5, 18), title: tx("Exactly, not at least", "Genau statt mindestens"), say: tx("$\\frac{10}{36}$ is “exactly one six”. “At least one” also includes two sixes.", "$\\frac{10}{36}$ ist „genau eine Sechs“. „Mindestens eine“ schließt auch zwei Sechsen mit ein.") },
    { v: q(25, 36), title: tx("Forgot the 1 −", "Das „1 −“ vergessen"), say: tx("That's the probability of **no** six. You still need $1$ minus that.", "Das ist die Wahrscheinlichkeit für **keine** Sechs. Du brauchst noch $1$ minus das.") },
    { v: q(1, 36), title: tx("Two sixes", "Zwei Sechsen"), say: tx("That's two sixes. At least one six is far more likely.", "Das sind zwei Sechsen. Mindestens eine Sechs ist viel wahrscheinlicher.") },
  ]),
};

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Multi-stage experiments", "Mehrstufige Zufallsexperimente"),
      blob: tx("Toss twice and a tree starts to grow!", "Zweimal werfen, und schon wächst ein Baum!"),
      body: tx(
        "If you toss a coin twice, that's a **two-stage** chance experiment. A **tree diagram** shows every possibility: each stage branches, and every **path** from left to right is one outcome.",
        "Wirfst du eine Münze zweimal, ist das ein **zweistufiges** Zufallsexperiment. Ein **Baumdiagramm** zeigt alle Möglichkeiten: Jede Stufe verzweigt sich, und jeder **Pfad** von links nach rechts ist ein Ergebnis.",
      ),
      visual: visual(ProbabilityTree, { branches: coinTree, ends: ["1/4", "1/4", "1/4", "1/4"] }),
      frames: multistage,
    },
    {
      type: "explain",
      title: tx("Path rule 1: multiply along the path", "1. Pfadregel: entlang des Pfades multiplizieren"),
      blob: tx("Along a path: multiply!", "Entlang eines Pfades: multiplizieren!"),
      body: tx(
        "The probability of a path is the **product** of the probabilities along it (**path rule 1**, product rule). Example: an urn holds $3$ red and $2$ green balls, and you draw twice **with replacement**.",
        "Die Wahrscheinlichkeit eines Pfades ist das **Produkt** der Wahrscheinlichkeiten entlang des Pfades (**1. Pfadregel**, Produktregel). Beispiel: In einer Urne liegen $3$ rote und $2$ grüne Kugeln, und du ziehst zweimal **mit Zurücklegen**.",
      ),
      visual: visual(ProbabilityTree, { branches: demo.branches, hl: [0], ends: ends(demo.leaf, [0]) }),
      frames: rule1,
    },
    {
      type: "widget",
      title: tx("Build a tree diagram", "Bau ein Baumdiagramm"),
      blob: tx("Change the urn, switch the replacement and tap paths!", "Verändere die Urne, schalte das Zurücklegen um und tippe auf Pfade!"),
      body: tx(
        "Choose how many red and green balls are in the urn, and whether the first ball goes back. The tree shows both draws with all branch probabilities. Pick paths: Blob multiplies along each path and adds the paths you picked.",
        "Stell ein, wie viele rote und grüne Kugeln in der Urne liegen und ob die erste Kugel zurückkommt. Der Baum zeigt beide Züge mit allen Wahrscheinlichkeiten. Wähle Pfade aus: Blob multipliziert entlang jedes Pfades und addiert die gewählten Pfade.",
      ),
      widget: ProbabilityTreeBuilder,
    },
    { type: "check", blob: tx("Both stages look the same here. Multiply!", "Hier sehen beide Stufen gleich aus. Multiplizieren!"), exercise: withCheck },
    {
      type: "explain",
      title: tx("Path rule 2: add the paths", "2. Pfadregel: Pfade addieren"),
      blob: tx("Several paths for one event? Add them up!", "Mehrere Pfade für ein Ereignis? Addieren!"),
      body: tx(
        "If several paths belong to an event, you **add** their probabilities (**path rule 2**, sum rule). “Two different colours” means red then green **or** green then red.",
        "Gehören zu einem Ereignis mehrere Pfade, **addierst** du ihre Wahrscheinlichkeiten (**2. Pfadregel**, Summenregel). „Zwei verschiedene Farben“ heißt: erst rot, dann grün, **oder** erst grün, dann rot.",
      ),
      visual: visual(ProbabilityTree, { branches: demo.branches, hl: [1, 2], ends: ends(demo.leaf, [1, 2]) }),
      frames: rule2,
    },
    { type: "check", blob: tx("The six can come first or second.", "Die Sechs kann zuerst oder als Zweites kommen."), exercise: exactlyCheck },
    {
      type: "explain",
      title: tx("Without replacement", "Ohne Zurücklegen"),
      blob: tx("If the ball stays out, the urn changes.", "Bleibt die Kugel draußen, verändert sich die Urne."),
      body: tx(
        "If you **don't** put the ball back, the second draw is different: there is one ball fewer, and it's one of the colour you drew. The path rules work just the same.",
        "Legst du die Kugel **nicht** zurück, sieht der zweite Zug anders aus: Es ist eine Kugel weniger drin, und zwar eine von der Farbe, die du gezogen hast. Die Pfadregeln gelten genauso.",
      ),
      visual: visual(ProbabilityTree, { branches: demoNo.branches, hl: [0, 3], ends: ends(demoNo.leaf, [0, 3]) }),
      frames: noReplace,
    },
    { type: "check", blob: tx("A ticket that's drawn stays out!", "Ein gezogenes Los bleibt draußen!"), exercise: raffleCheck },
    {
      type: "explain",
      title: tx("The complement and “at least once”", "Gegenereignis und „mindestens einmal“"),
      blob: tx("At least once? Think about never!", "Mindestens einmal? Denk an nie!"),
      body: tx(
        "The **complementary event** happens exactly when $E$ doesn't. Together they have the probability $1$, so $P(E) = 1 - P(\\text{not } E)$. For “at least once” the complement is “never”, and that's just one path.",
        "Das **Gegenereignis** tritt genau dann ein, wenn $E$ nicht eintritt. Zusammen haben beide die Wahrscheinlichkeit $1$, also $P(E) = 1 - P(\\text{nicht } E)$. Bei „mindestens einmal“ ist das Gegenereignis „nie“, und das ist nur ein Pfad.",
      ),
      frames: atLeast,
    },
    {
      type: "widget",
      title: tx("How many tries until it's likely?", "Wie oft muss ich es versuchen?"),
      blob: tx("Drag the slider: when is a six more likely than not?", "Zieh am Regler: Ab wann ist eine Sechs wahrscheinlicher als keine?"),
      body: tx(
        "Pick an experiment and drag the slider for the number of tries $n$. The purple bars show $P(\\text{at least once}) = 1 - (1 - p)^n$. The red dashed line is the tempting wrong rule $n \\cdot p$: it shoots past $1$.",
        "Wähle ein Experiment und zieh am Regler für die Anzahl der Versuche $n$. Die lila Säulen zeigen $P(\\text{mindestens einmal}) = 1 - (1 - p)^n$. Die rote gestrichelte Linie ist die verlockende falsche Rechnung $n \\cdot p$: Sie schießt über $1$ hinaus.",
      ),
      widget: ProbabilityAtLeastOnce,
    },
    { type: "check", blob: tx("The classic! Don't fall for 2/6.", "Der Klassiker! Fall nicht auf 2/6 rein."), exercise: leastCheck },
  ],
  summary: [
    {
      title: tx("Tree diagram", "Baumdiagramm"),
      body: tx("Each stage branches. Every path is one outcome. At each branching point the probabilities add up to $1$.", "Jede Stufe verzweigt sich. Jeder Pfad ist ein Ergebnis. An jeder Verzweigung ergeben die Wahrscheinlichkeiten zusammen $1$."),
      examples: ["\\frac{3}{5} + \\frac{2}{5} = 1"],
      tone: "rule",
    },
    {
      title: tx("Path rule 1 (product rule)", "1. Pfadregel (Produktregel)"),
      body: tx("Multiply the probabilities along a path.", "Multipliziere die Wahrscheinlichkeiten entlang eines Pfades."),
      examples: ["P(rr) = \\frac{3}{5} \\cdot \\frac{3}{5} = \\frac{9}{25}"],
      tone: "rule",
    },
    {
      title: tx("Path rule 2 (sum rule)", "2. Pfadregel (Summenregel)"),
      body: tx("If several paths belong to an event, add their probabilities.", "Gehören mehrere Pfade zu einem Ereignis, addiere ihre Wahrscheinlichkeiten."),
      examples: ["P(rg) + P(gr) = \\frac{6}{25} + \\frac{6}{25} = \\frac{12}{25}"],
      tone: "rule",
    },
    {
      title: tx("Without replacement", "Ohne Zurücklegen"),
      body: tx("On the next stage: one ball fewer in total, and one fewer of the colour you drew.", "Auf der nächsten Stufe: insgesamt eine Kugel weniger, und eine weniger von der gezogenen Farbe."),
      examples: ["P(rr) = \\frac{3}{5} \\cdot \\frac{2}{4} = \\frac{3}{10}"],
      tone: "tip",
    },
    {
      title: tx("Complement and “at least once”", "Gegenereignis und „mindestens einmal“"),
      body: tx("$P(E) = 1 - P(\\text{not } E)$. At least once $= 1 -$ never.", "$P(E) = 1 - P(\\text{nicht } E)$. Mindestens einmal $= 1 -$ nie."),
      examples: [tx(`P("at least one 6 in 3 rolls") = 1 - (\\frac{5}{6})^3 = \\frac{91}{216}`, `P("mind. eine 6 bei 3 Würfen") = 1 - (\\frac{5}{6})^3 = \\frac{91}{216}`)],
      tone: "rule",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx("At least one six in two rolls is **not** $\\frac{2}{6}$: adding counts the path with two sixes twice.", "Mindestens eine Sechs bei zwei Würfen ist **nicht** $\\frac{2}{6}$: Beim Addieren zählt der Pfad mit zwei Sechsen doppelt."),
      examples: [tx(`P("at least one 6") = \\frac{11}{36} \\ne \\frac{2}{6}`, `P("mind. eine 6") = \\frac{11}{36} \\ne \\frac{2}{6}`)],
      tone: "warning",
    },
  ],
};
