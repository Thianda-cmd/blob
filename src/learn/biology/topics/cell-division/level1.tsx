"use client";

// Level 1 (Klasse 7–8): growing by dividing, chromosomes, two identical daughter cells,
// sex cells with half the chromosome number and fertilisation.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { DivisionFertilisation } from "@/learn/biology/visuals/DivisionFertilisation";
import { DivisionPhase, type ModelSize } from "@/learn/biology/visuals/DivisionScene";
import { DivisionScrubber } from "@/learn/biology/visuals/DivisionScrubber";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { ANIMALS, HUMAN, ORGANISMS, type Organism } from "./data";
import { choice, inOrder, mistakesFor, num, some, visual, weighted, type Opt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const an = (word: string) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Daughter cells after mitosis

function daughterExercise(o: Organism): Exercise {
  const n2 = o.n2;
  const m = mistakesFor(num(n2));
  m.add(
    num(n2 / 2),
    tx("Mitosis doesn't halve", "Mitose halbiert nicht"),
    tx(
      `Ah, I think you shared the ${n2} chromosomes between the two cells. But every chromosome is **copied** first, so each daughter cell gets the full set.`,
      `Ah, ich glaub, du hast die ${n2} Chromosomen auf die zwei Zellen aufgeteilt. Aber vorher wird jedes Chromosom **kopiert**, darum bekommt jede Tochterzelle den vollen Satz.`,
    ),
  );
  m.add(
    num(2 * n2),
    tx("The copies are shared", "Die Kopien werden verteilt"),
    tx(
      "Before the division there are copies of everything, right! But they are shared out: one copy goes into each daughter cell.",
      "Vor der Teilung ist alles doppelt da, stimmt! Aber die Kopien werden verteilt: Je eine Kopie kommt in jede Tochterzelle.",
    ),
  );
  if (n2 !== 46)
    m.add(
      num(46),
      tx("That's the human number", "Das ist die Zahl beim Menschen"),
      tx("46 is the number for humans. Here the mother cell has a different number, and the daughter cells get exactly that.", "46 ist die Zahl beim Menschen. Hier hat die Mutterzelle eine andere Zahl, und genau die bekommen auch die Tochterzellen."),
    );
  const cell = o.bodyCell;
  return {
    instruction: tx("Count the chromosomes", "Zähle die Chromosomen"),
    text: txMap((t, l) =>
      t(
        `${resolveText(o.cells, l)} have ${n2} chromosomes. ${cap(an(resolveText(cell, l)))} divides by mitosis. How many chromosomes does each daughter cell have?`,
        `${resolveText(o.cells, l)} haben ${n2} Chromosomen. Eine ${resolveText(cell, l)} teilt sich durch Mitose. Wie viele Chromosomen hat jede Tochterzelle?`,
      ),
    ),
    answer: num(n2),
    hint: tx("Before a cell divides, every chromosome is copied. What does each daughter cell get then?", "Bevor sich eine Zelle teilt, wird jedes Chromosom kopiert. Was bekommt dann jede Tochterzelle?"),
    solution: [
      { math: tx(`"mother cell:" \\; ${n2}#m`, `"Mutterzelle:" \\; ${n2}#m`), note: tx(`The mother cell has ${n2} chromosomes. Before dividing, it copies each of them.`, `Die Mutterzelle hat ${n2} Chromosomen. Vor der Teilung kopiert sie jedes davon.`) },
      {
        math: tx(`"mother cell:" \\; ${n2}#m \\to#t ${n2}#a , ${n2}#b`, `"Mutterzelle:" \\; ${n2}#m \\to#t ${n2}#a , ${n2}#b`),
        note: tx(`One copy goes into each daughter cell: **${n2} chromosomes** each, with the same genetic information. Mitosis doesn't halve!`, `Je eine Kopie kommt in jede Tochterzelle: jeweils **${n2} Chromosomen** mit derselben Erbinformation. Die Mitose halbiert nicht!`),
      },
    ],
    mistakes: m.list,
  };
}

const daughterTask = (rng: Rng) => daughterExercise(rng.pick(ORGANISMS));

// ---------------------------------------------------------------------------
// Rounds of division: 1 → 2 → 4 → 8

const STARTS: { en: string; de: string }[] = [
  { en: "A skin cell", de: "Eine Hautzelle" },
  { en: "A cell in the root tip of a bean", de: "Eine Zelle in der Wurzelspitze einer Bohne" },
  { en: "A fertilised egg cell", de: "Eine befruchtete Eizelle" },
  { en: "A cell in the bone marrow", de: "Eine Zelle im Knochenmark" },
];

function roundsTask(rng: Rng): Exercise {
  const k = rng.int(2, 6);
  const s = rng.pick(STARTS);
  const value = 2 ** k;
  const m = mistakesFor(num(value));
  m.add(
    num(2 * k),
    tx("Added instead of doubled", "Addiert statt verdoppelt"),
    tx("I think you added 2 cells per round. But in every round **each** cell divides, so the number doubles.", "Ich glaub, du hast pro Runde 2 Zellen dazugezählt. Aber in jeder Runde teilt sich **jede** Zelle, die Zahl verdoppelt sich also."),
  );
  m.add(
    num(k + 1),
    tx("One cell more per round?", "Pro Runde eine Zelle mehr?"),
    tx("Not just one new cell per round: every cell that is there splits into two.", "Nicht nur eine neue Zelle pro Runde: Jede Zelle, die da ist, wird zu zwei."),
  );
  m.add(
    num(2 ** (k - 1)),
    tx("One round missing", "Eine Runde fehlt"),
    tx("Nearly! Count again: after 1 round there are 2 cells, after 2 rounds 4.", "Fast! Zähl noch mal: Nach 1 Runde sind es 2 Zellen, nach 2 Runden 4."),
    true,
  );
  const chain = Array.from({ length: k + 1 }, (_, i) => `${2 ** i}#c${i}`).join(" \\to ");
  return {
    instruction: tx("Count the cells", "Zähle die Zellen"),
    text: tx(
      `${s.en} divides by mitosis. Then both daughter cells divide again, and so on. How many cells are there after ${k} rounds of division?`,
      `${s.de} teilt sich durch Mitose. Danach teilen sich beide Tochterzellen wieder, und so weiter. Wie viele Zellen sind es nach ${k} Teilungsrunden?`,
    ),
    answer: num(value),
    hint: tx("Each round, every cell becomes two cells. Start with 1 and double.", "In jeder Runde wird aus jeder Zelle zwei. Fang bei 1 an und verdopple."),
    solution: [
      { math: chain, note: tx("Every round doubles the number of cells.", "Jede Runde verdoppelt die Zahl der Zellen.") },
      { math: `2^{${k}} = ${value}`, note: tx(`After ${k} rounds: **${value} cells**. This is how a living thing grows.`, `Nach ${k} Runden: **${value} Zellen**. So wächst ein Lebewesen.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Sex cells: half the chromosome number

/** "a dog's egg cell" / "eine Eizelle eines Hundes" */
const OF: Record<string, [string, string]> = {
  human: ["a human", "des Menschen"],
  chimp: ["a chimpanzee's", "eines Schimpansen"],
  dog: ["a dog's", "eines Hundes"],
  cat: ["a cat's", "einer Katze"],
  horse: ["a horse's", "eines Pferdes"],
  cattle: ["a cow's", "eines Rindes"],
  mouse: ["a mouse's", "einer Maus"],
  rabbit: ["a rabbit's", "eines Kaninchens"],
  sheep: ["a sheep's", "eines Schafes"],
  chicken: ["a hen's", "eines Huhns"],
  fly: ["a fruit fly's", "einer Taufliege"],
  pea: ["a pea plant's", "einer Erbsenpflanze"],
  maize: ["a maize plant's", "einer Maispflanze"],
  rye: ["a rye plant's", "einer Roggenpflanze"],
  tomato: ["a tomato plant's", "einer Tomatenpflanze"],
};

function gameteExercise(o: Organism, variant: "down" | "up" | "zygote", sperm: boolean): Exercise {
  const n2 = o.n2;
  const n = n2 / 2;
  const [ofEn, ofDe] = OF[o.id];
  const cellEn = sperm ? "sperm cell" : "egg cell";
  const cellDe = sperm ? "Spermienzelle" : "Eizelle";
  let text: Text;
  let value: number;
  let solution: Exercise["solution"];
  const m = mistakesFor(num(variant === "down" ? n : n2));
  if (variant === "down") {
    value = n;
    text = tx(`${en(o.cells)} have ${n2} chromosomes. How many chromosomes does ${ofEn} ${cellEn} have?`, `${de(o.cells)} haben ${n2} Chromosomen. Wie viele Chromosomen hat eine ${cellDe} ${ofDe}?`);
    m.add(num(n2), tx("Sex cells have half", "Keimzellen haben die Hälfte"), tx(`That's the number in body cells. Sex cells only carry **half** of it, one chromosome of every pair.`, `Das ist die Zahl der Körperzellen. Keimzellen tragen nur die **Hälfte** davon, von jedem Paar ein Chromosom.`));
    m.add(num(2 * n2), tx("Doubled instead of halved", "Verdoppelt statt halbiert"), tx("Other way round! Sex cells have fewer chromosomes than body cells, not more.", "Andersrum! Keimzellen haben weniger Chromosomen als Körperzellen, nicht mehr."));
    if (n2 !== 46) m.add(num(23), tx("That's the human number", "Das ist die Zahl beim Menschen"), tx("23 is right for human sex cells. Here you need half of this species' own number.", "23 stimmt für die Keimzellen des Menschen. Hier brauchst du die Hälfte der Zahl dieser Art."));
    solution = [
      { math: tx(`"body cell:" \\; ${n2}#b`, `"Körperzelle:" \\; ${n2}#b`), note: tx(`Body cells: ${n2} chromosomes, that is ${n} pairs.`, `Körperzellen: ${n2} Chromosomen, also ${n} Paare.`) },
      { math: tx(`"${cellEn}:" \\; ${n2}#b : 2 = ${n}#r`, `"${cellDe}:" \\; ${n2}#b : 2 = ${n}#r`), note: tx(`A sex cell gets one chromosome of every pair: **${n} chromosomes**.`, `Eine Keimzelle bekommt von jedem Paar ein Chromosom: **${n} Chromosomen**.`) },
    ];
  } else if (variant === "up") {
    value = n2;
    text = tx(`${cap(ofEn)} ${cellEn} has ${n} chromosomes. How many chromosomes do its body cells have?`, `Eine ${cellDe} ${ofDe} hat ${n} Chromosomen. Wie viele Chromosomen haben die Körperzellen?`);
    m.add(num(n), tx("Body cells have the full set", "Körperzellen haben den vollen Satz"), tx("Sex cells and body cells don't have the same number. Body cells have **twice** as many as sex cells.", "Keimzellen und Körperzellen haben nicht gleich viele. Körperzellen haben **doppelt** so viele wie Keimzellen."));
    m.add(num(n / 2), tx("Halved again", "Noch mal halbiert"), tx("You halved, but the sex cell is the one that already has half. Body cells have twice as many.", "Du hast halbiert, aber die Keimzelle ist ja schon die Hälfte. Körperzellen haben doppelt so viele."));
    solution = [
      { math: tx(`"${cellEn}:" \\; ${n}#g`, `"${cellDe}:" \\; ${n}#g`), note: tx("A sex cell has half the chromosome number of a body cell.", "Eine Keimzelle hat die halbe Chromosomenzahl einer Körperzelle.") },
      { math: tx(`"body cell:" \\; ${n}#g \\cdot 2 = ${n2}#r`, `"Körperzelle:" \\; ${n}#g \\cdot 2 = ${n2}#r`), note: tx(`So the body cells have **${n2} chromosomes**.`, `Die Körperzellen haben also **${n2} Chromosomen**.`) },
    ];
  } else {
    value = n2;
    text = tx(
      `${cap(ofEn)} egg cell with ${n} chromosomes is fertilised by a sperm cell with ${n} chromosomes. How many chromosomes does the zygote have?`,
      `Eine Eizelle ${ofDe} mit ${n} Chromosomen wird von einer Spermienzelle mit ${n} Chromosomen befruchtet. Wie viele Chromosomen hat die Zygote?`,
    );
    m.add(num(n), tx("Both bring chromosomes", "Beide bringen Chromosomen mit"), tx("At fertilisation the nuclei of egg and sperm cell fuse. Their chromosomes add up.", "Bei der Befruchtung verschmelzen die Zellkerne von Ei- und Spermienzelle. Ihre Chromosomen zählen zusammen."));
    m.add(num(n / 2), tx("Nothing is halved here", "Hier wird nichts halbiert"), tx("Halving happens when sex cells are made. At fertilisation the chromosomes of both cells come together.", "Halbiert wird bei der Bildung der Keimzellen. Bei der Befruchtung kommen die Chromosomen beider Zellen zusammen."));
    solution = [
      { math: `${n}#e + ${n}#s = ${n2}#z`, note: tx(`Egg cell and sperm cell each bring ${n} chromosomes. The zygote has **${n2}**: the full number again.`, `Eizelle und Spermienzelle bringen je ${n} Chromosomen mit. Die Zygote hat **${n2}**: wieder die volle Zahl.`) },
    ];
  }
  return {
    instruction: tx("Chromosome number", "Chromosomenzahl"),
    text,
    answer: num(value),
    hint: variant === "zygote" ? tx("At fertilisation two sex cells fuse. Add up.", "Bei der Befruchtung verschmelzen zwei Keimzellen. Zähl zusammen.") : tx("Sex cells have half as many chromosomes as body cells.", "Keimzellen haben halb so viele Chromosomen wie Körperzellen."),
    solution,
    mistakes: m.list,
  };
}

function gameteTask(rng: Rng): Exercise {
  const variant = rng.pick(["down", "down", "up", "zygote"] as const);
  const o = variant === "zygote" ? rng.pick(ANIMALS) : rng.pick(ORGANISMS);
  return gameteExercise(o, variant, !o.plant && variant !== "zygote" && rng.chance(0.5));
}

// ---------------------------------------------------------------------------
// Which cells have half the chromosomes?

const EGG = tx("egg cell", "Eizelle");
const SPERM = tx("sperm cell", "Spermienzelle");
const ZYGOTE = tx("zygote (fertilised egg cell)", "Zygote (befruchtete Eizelle)");
const FULL_CELLS: Text[] = [
  tx("skin cell", "Hautzelle"),
  tx("muscle cell", "Muskelzelle"),
  tx("nerve cell", "Nervenzelle"),
  tx("liver cell", "Leberzelle"),
  tx("intestinal cell", "Darmzelle"),
  tx("white blood cell", "weiße Blutzelle"),
  tx("bone cell", "Knochenzelle"),
];

function halfTask(rng: Rng): Exercise {
  const halves = rng.chance(0.7) ? [EGG, SPERM] : [rng.pick([EGG, SPERM])];
  const zyg = rng.chance(0.65);
  const fulls = [...(zyg ? [ZYGOTE] : []), ...some(rng, FULL_CELLS, 5 - halves.length - (zyg ? 1 : 0))];
  const options = rng.shuffle([...halves, ...fulls]);
  const idx = (t: Text) => options.indexOf(t);
  const correct = halves.map(idx).sort((a, b) => a - b);
  const right: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakesFor(right);
  if (zyg)
    m.add(
      { kind: "multi", options, correct: [...correct, idx(ZYGOTE)].sort((a, b) => a - b) },
      tx("The zygote is fertilised", "Die Zygote ist befruchtet"),
      tx("The zygote is an egg cell, but a **fertilised** one: egg and sperm cell have fused, so it has the full 46 again.", "Die Zygote ist zwar eine Eizelle, aber eine **befruchtete**: Ei- und Spermienzelle sind verschmolzen, sie hat also wieder alle 46."),
    );
  if (halves.length === 2)
    for (const h of halves) {
      const other = halves.find((x) => x !== h)!;
      m.add(
        { kind: "multi", options, correct: [idx(h)] },
        tx("Both sex cells", "Beide Keimzellen"),
        tx(`You found one! But ${en(other)}s are sex cells too, and they also carry only 23 chromosomes.`, `Eine hast du! Aber auch die ${de(other)} ist eine Keimzelle und trägt nur 23 Chromosomen.`),
      );
    }
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which human cells have only 23 chromosomes instead of 46?", "Welche Zellen des Menschen haben nur 23 statt 46 Chromosomen?"),
    answer: right,
    hint: tx("Only the sex cells carry half the chromosomes. Which of these cells fuse at fertilisation?", "Nur die Keimzellen tragen die Hälfte der Chromosomen. Welche dieser Zellen verschmelzen bei der Befruchtung?"),
    solution: [
      {
        math: tx('"egg cell:" 23 \\quad "sperm cell:" 23', '"Eizelle:" 23 \\quad "Spermienzelle:" 23'),
        note: tx(
          `Only sex cells have 23 chromosomes. All other body cells${zyg ? ", and the zygote," : ""} have 46.`,
          `Nur Keimzellen haben 23 Chromosomen. Alle anderen Körperzellen${zyg ? " und auch die Zygote" : ""} haben 46.`,
        ),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Put things in order

const STEPS = {
  grow: tx("The cell grows.", "Die Zelle wächst."),
  copy: tx("Every chromosome is copied.", "Jedes Chromosom wird kopiert."),
  thick: tx("The chromosomes get short and thick.", "Die Chromosomen werden kurz und dick."),
  middle: tx("The chromosomes line up in the middle.", "Die Chromosomen ordnen sich in der Mitte an."),
  apart: tx("The two halves of each chromosome are pulled apart.", "Die beiden Hälften jedes Chromosoms werden auseinandergezogen."),
  pinch: tx("The cell pinches in: two daughter cells.", "Die Zelle schnürt sich durch: zwei Tochterzellen."),
};
const STEP_LIST = Object.values(STEPS);

const LIFE = {
  gametes: tx("Egg cells and sperm cells form (23 chromosomes).", "Eizellen und Spermienzellen entstehen (23 Chromosomen)."),
  fert: tx("An egg cell and a sperm cell fuse (fertilisation).", "Eine Eizelle und eine Spermienzelle verschmelzen (Befruchtung)."),
  zyg: tx("The zygote has 46 chromosomes.", "Die Zygote hat 46 Chromosomen."),
  mito: tx("The zygote divides again and again by mitosis.", "Die Zygote teilt sich immer wieder durch Mitose."),
  embryo: tx("An embryo grows.", "Ein Embryo wächst heran."),
};
const LIFE_LIST = Object.values(LIFE);

const SIZE = {
  gene: tx("gene", "Gen"),
  chrom: tx("chromosome", "Chromosom"),
  nucleus: tx("nucleus", "Zellkern"),
  cell: tx("cell", "Zelle"),
  tissue: tx("tissue", "Gewebe"),
  organ: tx("organ", "Organ"),
};
const SIZE_LIST = Object.values(SIZE);

function orderExercise(kind: "steps" | "life" | "size", items: Text[]): Exercise {
  const answer: AnswerSpec = { kind: "order", items, ...(kind === "size" ? { label: tx("Sort from smallest to biggest.", "Sortiere vom kleinsten zum größten.") } : {}) };
  const mistakes: Mistake[] = [];
  const add = (a: Text, b: Text, title: Text, say: Text) => {
    if (items.includes(a) && items.includes(b)) mistakes.push({ when: { kind: "order", items: [a, b] }, title, say });
  };
  if (kind === "steps") {
    add(STEPS.apart, STEPS.middle, tx("Line up first", "Erst aufstellen"), tx("Nearly! Before the halves are pulled apart, all chromosomes have to line up in the middle.", "Fast! Bevor die Hälften auseinandergezogen werden, müssen sich alle Chromosomen in der Mitte aufstellen."));
    add(STEPS.thick, STEPS.copy, tx("Copy while thin", "Kopiert wird im Fadenzustand"), tx("The copying happens while the chromosomes are still long, thin threads. Only then do they get short and thick.", "Kopiert wird, solange die Chromosomen noch lange, dünne Fäden sind. Erst danach werden sie kurz und dick."));
    add(STEPS.pinch, STEPS.apart, tx("Pinching comes last", "Einschnüren kommt zum Schluss"), tx("The cell can only pinch in once the chromosome halves have reached the two ends.", "Die Zelle schnürt sich erst durch, wenn die Chromosomenhälften an den beiden Enden angekommen sind."));
  } else if (kind === "life") {
    add(LIFE.fert, LIFE.gametes, tx("Sex cells come first", "Erst die Keimzellen"), tx("Before fertilisation can happen, the egg cell and the sperm cell have to be made.", "Bevor es zur Befruchtung kommt, müssen Eizelle und Spermienzelle erst entstehen."));
    add(LIFE.mito, LIFE.zyg, tx("Zygote first", "Erst die Zygote"), tx("The zygote is the first cell of the new living thing. Only then does it start to divide.", "Die Zygote ist die erste Zelle des neuen Lebewesens. Erst danach beginnt sie sich zu teilen."));
  } else {
    add(SIZE.chrom, SIZE.gene, tx("A gene is a piece", "Ein Gen ist ein Abschnitt"), tx("A gene is just a section of the DNA on a chromosome, so it is smaller than the chromosome.", "Ein Gen ist nur ein Abschnitt der DNA auf einem Chromosom, also kleiner als das Chromosom."));
    add(SIZE.nucleus, SIZE.chrom, tx("Chromosomes are inside", "Chromosomen liegen innen"), tx("The chromosomes lie inside the nucleus, so the nucleus is bigger.", "Die Chromosomen liegen im Zellkern, der Kern ist also größer."));
    add(SIZE.cell, SIZE.nucleus, tx("The nucleus is inside the cell", "Der Kern liegt in der Zelle"), tx("The nucleus is one part of the cell, so the cell is bigger.", "Der Zellkern ist ein Teil der Zelle, die Zelle ist also größer."));
  }
  const solutionNote: Text =
    kind === "steps"
      ? tx("First copy, then line up, then pull apart, then pinch in. Each daughter cell gets a complete set of chromosomes.", "Erst kopieren, dann aufstellen, dann auseinanderziehen, dann durchschnüren. Jede Tochterzelle bekommt einen vollständigen Chromosomensatz.")
      : kind === "life"
        ? tx("Sex cells with 23 chromosomes fuse to the zygote with 46. Mitosis then makes all the cells of the body.", "Keimzellen mit 23 Chromosomen verschmelzen zur Zygote mit 46. Durch Mitose entstehen dann alle Zellen des Körpers.")
        : tx("A gene is a section of DNA on a chromosome, the chromosomes lie in the nucleus, the nucleus is part of a cell; cells form tissues and organs.", "Ein Gen ist ein DNA-Abschnitt auf einem Chromosom, die Chromosomen liegen im Zellkern, der Kern ist Teil einer Zelle; Zellen bilden Gewebe und Organe.");
  const words: Record<typeof kind, [Text, Text]> = {
    steps: [tx('"copy" \\to "line up" \\to "pull apart" \\to "pinch in"', '"kopieren" \\to "aufstellen" \\to "trennen" \\to "durchschnüren"'), tx("Put the steps of cell division in order.", "Bring die Schritte der Zellteilung in die richtige Reihenfolge.")],
    life: [tx('23 + 23 \\to 46 \\to "mitosis" \\to "embryo"', '23 + 23 \\to 46 \\to "Mitose" \\to "Embryo"'), tx("Put the steps from sex cell to embryo in order.", "Bring die Schritte von der Keimzelle zum Embryo in die richtige Reihenfolge.")],
    size: [tx('"gene" < "chromosome" < "nucleus" < "cell"', '"Gen" < "Chromosom" < "Zellkern" < "Zelle"'), tx("Sort by size, starting with the smallest.", "Sortiere nach der Größe, beginne mit dem kleinsten.")],
  };
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: words[kind][1],
    answer,
    hint:
      kind === "steps"
        ? tx("What has to happen before the cell can share its chromosomes fairly?", "Was muss passieren, bevor die Zelle ihre Chromosomen gerecht verteilen kann?")
        : kind === "life"
          ? tx("Start with the cells of the parents that are needed for fertilisation.", "Beginne mit den Zellen der Eltern, die für die Befruchtung gebraucht werden.")
          : tx("What lies inside what?", "Was liegt worin?"),
    solution: [{ math: words[kind][0], note: solutionNote }],
    mistakes,
  };
}

function orderTask(rng: Rng): Exercise {
  const kind = rng.pick(["steps", "steps", "life", "size"] as const);
  if (kind === "steps") return orderExercise(kind, inOrder(STEP_LIST, some(rng, STEP_LIST, rng.int(4, 5))));
  if (kind === "life") return orderExercise(kind, inOrder(LIFE_LIST, some(rng, LIFE_LIST, rng.int(4, 5))));
  return orderExercise(kind, inOrder(SIZE_LIST, some(rng, SIZE_LIST, rng.int(4, 5))));
}

// ---------------------------------------------------------------------------
// Terms and what they mean

const TERMS: { id: string; term: Text; desc: Text }[] = [
  { id: "chrom", term: tx("chromosome", "Chromosom"), desc: tx("carrier of genetic information in the nucleus", "Träger der Erbinformation im Zellkern") },
  { id: "dna", term: tx("DNA", "DNA"), desc: tx("the substance the genetic information is made of", "Stoff, aus dem die Erbinformation besteht") },
  { id: "mother", term: tx("mother cell", "Mutterzelle"), desc: tx("the cell that divides", "die Zelle, die sich teilt") },
  { id: "daughter", term: tx("daughter cells", "Tochterzellen"), desc: tx("the two new cells after a division", "die zwei neuen Zellen nach einer Teilung") },
  { id: "gametes", term: tx("sex cells", "Keimzellen"), desc: tx("egg cells and sperm cells", "Eizellen und Spermienzellen") },
  { id: "zygote", term: tx("zygote", "Zygote"), desc: tx("the fertilised egg cell", "die befruchtete Eizelle") },
  { id: "fert", term: tx("fertilisation", "Befruchtung"), desc: tx("an egg cell and a sperm cell fuse", "Eizelle und Spermienzelle verschmelzen") },
  { id: "mitosis", term: tx("mitosis", "Mitose"), desc: tx("division into two genetically identical cells", "Teilung in zwei erbgleiche Zellen") },
  { id: "nucleus", term: tx("nucleus", "Zellkern"), desc: tx("contains the chromosomes", "enthält die Chromosomen") },
];
const CONFUSED: [string, string, Text, Text][] = [
  ["chrom", "dna", tx("Chromosome or DNA?", "Chromosom oder DNA?"), tx("Close! DNA is the substance. A chromosome is a long DNA thread packed into a compact package.", "Knapp! Die DNA ist der Stoff. Ein Chromosom ist ein langer, verpackter DNA-Faden.")],
  ["zygote", "gametes", tx("Zygote is fertilised", "Die Zygote ist befruchtet"), tx("Egg and sperm cells are the sex cells. The zygote is what you get when they have fused.", "Ei- und Spermienzellen sind die Keimzellen. Die Zygote entsteht erst, wenn sie verschmolzen sind.")],
  ["zygote", "fert", tx("Process or cell?", "Vorgang oder Zelle?"), tx("Fertilisation is the process, the fusing. The zygote is the cell that results from it.", "Die Befruchtung ist der Vorgang, das Verschmelzen. Die Zygote ist die Zelle, die dabei entsteht.")],
  ["mother", "daughter", tx("Mother or daughter?", "Mutter oder Tochter?"), tx("The mother cell is the one that divides. The daughter cells are the new ones.", "Die Mutterzelle ist die, die sich teilt. Die Tochterzellen sind die neuen.")],
  ["nucleus", "chrom", tx("Container and content", "Behälter und Inhalt"), tx("The nucleus is the container, the chromosomes are inside it.", "Der Zellkern ist der Behälter, die Chromosomen liegen darin.")],
];

function matchTask(rng: Rng): Exercise {
  const picked = some(rng, TERMS, 4);
  const rest = TERMS.filter((x) => !picked.includes(x));
  const distractor = rng.pick(rest).desc;
  const pairs = picked.map((x) => [x.term, x.desc] as [Text, Text]);
  const mistakes: Mistake[] = [];
  for (const [a, b, title, say] of CONFUSED) {
    const A = picked.find((x) => x.id === a);
    const B = picked.find((x) => x.id === b);
    if (A && B) mistakes.push({ when: { kind: "match", pairs: [[A.term, B.desc], [B.term, A.desc]] }, title, say });
  }
  return {
    instruction: tx("Match the terms", "Ordne die Begriffe zu"),
    text: tx("Give every term its meaning. One meaning is left over.", "Gib jedem Begriff seine Bedeutung. Eine Bedeutung bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [distractor] },
    hint: tx("Start with the terms you are sure about.", "Fang mit den Begriffen an, bei denen du dir sicher bist."),
    solution: [
      {
        math: tx(picked.map((x) => `"${en(x.term)}"`).join(" \\quad "), picked.map((x) => `"${de(x.term)}"`).join(" \\quad ")),
        note: txMap((t, l) => picked.map((x) => `**${resolveText(x.term, l)}**: ${resolveText(x.desc, l)}`).join(". ") + "."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// True or false

const TRUE_FACTS: Text[] = [
  tx("Mitosis produces two daughter cells with the same genetic information.", "Bei der Mitose entstehen zwei Tochterzellen mit der gleichen Erbinformation."),
  tx("Before a cell divides, every chromosome is copied.", "Bevor sich eine Zelle teilt, wird jedes Chromosom kopiert."),
  tx("Egg cells and sperm cells have half the chromosome number.", "Eizellen und Spermienzellen haben die halbe Chromosomenzahl."),
  tx("The chromosomes lie in the nucleus.", "Die Chromosomen liegen im Zellkern."),
  tx("Living things grow because their cells divide.", "Lebewesen wachsen, weil sich ihre Zellen teilen."),
  tx("At fertilisation the full chromosome number is restored.", "Bei der Befruchtung entsteht wieder die volle Chromosomenzahl."),
];
const FALSE_FACTS: Opt[] = [
  {
    text: tx("In mitosis the chromosome number is halved.", "Bei der Mitose halbiert sich die Chromosomenzahl."),
    title: tx("Mitosis doesn't halve", "Mitose halbiert nicht"),
    say: tx("The classic trap! Before mitosis every chromosome is copied, so each daughter cell gets all of them.", "Die klassische Falle! Vor der Mitose wird jedes Chromosom kopiert, darum bekommt jede Tochterzelle alle."),
  },
  {
    text: tx("An egg cell has as many chromosomes as a skin cell.", "Eine Eizelle hat genauso viele Chromosomen wie eine Hautzelle."),
    title: tx("Sex cells have half", "Keimzellen haben die Hälfte"),
    say: tx("Egg cells are sex cells: 23 chromosomes. A skin cell is a body cell with 46.", "Eizellen sind Keimzellen: 23 Chromosomen. Eine Hautzelle ist eine Körperzelle mit 46."),
  },
  {
    text: tx("Living things with more chromosomes are more highly developed.", "Lebewesen mit mehr Chromosomen sind höher entwickelt."),
    title: tx("The number says nothing", "Die Zahl sagt nichts aus"),
    say: tx("Not at all: a dog has 78 chromosomes, a human 46, a potato 48. The number tells you nothing about how complex a living thing is.", "Gar nicht: Ein Hund hat 78 Chromosomen, ein Mensch 46, eine Kartoffel 48. Die Zahl sagt nichts darüber, wie komplex ein Lebewesen ist."),
  },
  {
    text: tx("When you grow, your cells only get bigger, not more.", "Wenn du wächst, werden deine Zellen nur größer, aber nicht mehr."),
    title: tx("Growing means more cells", "Wachsen heißt mehr Zellen"),
    say: tx("A body grows mainly because the number of cells goes up. Each cell stays roughly the same size.", "Ein Körper wächst vor allem, weil die Zahl der Zellen steigt. Jede einzelne Zelle bleibt ungefähr gleich groß."),
  },
  {
    text: tx("In adults, cells no longer divide.", "Bei Erwachsenen teilen sich keine Zellen mehr."),
    title: tx("Adults need divisions too", "Auch Erwachsene brauchen Teilungen"),
    say: tx("Cells divide all your life: skin, gut lining and blood cells are constantly renewed, and wounds heal.", "Zellen teilen sich ein Leben lang: Haut, Darmschleimhaut und Blutzellen werden ständig erneuert, und Wunden heilen."),
  },
  {
    text: tx("A zygote has 23 chromosomes.", "Eine Zygote hat 23 Chromosomen."),
    title: tx("The zygote is complete", "Die Zygote ist komplett"),
    say: tx("23 come from the egg cell and 23 from the sperm cell: the zygote has 46.", "23 kommen aus der Eizelle und 23 aus der Spermienzelle: Die Zygote hat 46."),
  },
  {
    text: tx("The two daughter cells get different genetic information.", "Die beiden Tochterzellen bekommen unterschiedliche Erbinformation."),
    title: tx("Identical copies", "Identische Kopien"),
    say: tx("In mitosis each daughter cell gets an exact copy of every chromosome. That's why they are genetically identical.", "Bei der Mitose bekommt jede Tochterzelle eine genaue Kopie jedes Chromosoms. Deshalb sind sie erbgleich."),
  },
];

function statementExercise(rng: Rng): Exercise {
  const right = rng.pick(TRUE_FACTS);
  const wrong = some(rng, FALSE_FACTS, 3);
  const c = choice(rng, [{ text: right }, ...wrong]);
  return {
    instruction: tx("Which statement is true?", "Welche Aussage stimmt?"),
    text: tx("Only one of these statements is true.", "Nur eine dieser Aussagen ist richtig."),
    answer: c.answer,
    hint: tx("Think of the rule: mitosis keeps the number, sex cells have half.", "Denk an die Regel: Mitose behält die Zahl, Keimzellen haben die Hälfte."),
    solution: [{ math: tx('"true:"', '"richtig:"'), note: right }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Count the chromosomes in a picture

function pictureTask(rng: Rng): Exercise {
  const n2 = rng.pick([4, 6, 8] as const) as ModelSize;
  const stage = rng.pick(["pro", "meta"] as const);
  const ask = rng.pick(["now", "daughter"] as const);
  const m = mistakesFor(num(n2));
  m.add(
    num(2 * n2),
    tx("You counted the halves", "Du hast die Hälften gezählt"),
    tx("Each X is **one** chromosome, made of two identical halves. Count the X shapes, not the halves.", "Jedes X ist **ein** Chromosom aus zwei gleichen Hälften. Zähl die X, nicht die Hälften."),
  );
  if (ask === "daughter")
    m.add(
      num(n2 / 2),
      tx("Mitosis doesn't halve", "Mitose halbiert nicht"),
      tx("The two halves of each X are separated: one half goes into each daughter cell. So each daughter cell gets one of every chromosome.", "Die beiden Hälften jedes X werden getrennt: Je eine Hälfte kommt in jede Tochterzelle. Jede Tochterzelle bekommt also jedes Chromosom einmal."),
    );
  return {
    instruction: tx("Count in the picture", "Zähle im Bild"),
    text:
      ask === "now"
        ? tx("The picture shows a cell just before it divides. How many chromosomes does it have?", "Das Bild zeigt eine Zelle kurz vor der Teilung. Wie viele Chromosomen hat sie?")
        : tx("This cell is about to divide by mitosis. How many chromosomes will each daughter cell have?", "Diese Zelle teilt sich gleich durch Mitose. Wie viele Chromosomen wird jede Tochterzelle haben?"),
    visual: visual(DivisionPhase, { kind: "mitosis", stage, n2 }),
    answer: num(n2),
    hint: tx("Each X shape is one chromosome that has already been copied.", "Jedes X ist ein Chromosom, das schon kopiert wurde."),
    solution: [
      { math: `${n2} "X"`, note: tx(`There are ${n2} X shapes, so ${n2} chromosomes. Each consists of two identical halves.`, `Es sind ${n2} X-Formen, also ${n2} Chromosomen. Jedes besteht aus zwei gleichen Hälften.`) },
      ...(ask === "daughter"
        ? [{ math: `${n2} \\to ${n2} , ${n2}`, note: tx(`The halves are pulled apart: each daughter cell gets **${n2} chromosomes**.`, `Die Hälften werden getrennt: Jede Tochterzelle bekommt **${n2} Chromosomen**.`) }]
        : []),
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Name the term

const WORDS: { q: Text; accept: Text[]; show: Text; note: Text; wrong?: [Text, Text, Text][] }[] = [
  {
    q: tx("What is the fertilised egg cell called?", "Wie heißt die befruchtete Eizelle?"),
    accept: [tx("zygote", "Zygote")],
    show: tx('"zygote"', '"Zygote"'),
    note: tx("The fertilised egg cell is the **zygote**, the first cell of a new living thing.", "Die befruchtete Eizelle heißt **Zygote**. Sie ist die erste Zelle eines neuen Lebewesens."),
    wrong: [[tx("embryo", "Embryo"), tx("Not an embryo yet", "Noch kein Embryo"), tx("It only becomes an embryo after many divisions. The single fertilised cell has its own name.", "Zum Embryo wird sie erst nach vielen Teilungen. Die einzelne befruchtete Zelle hat einen eigenen Namen.")]],
  },
  {
    q: tx("What are the two new cells called that form when a cell divides?", "Wie heißen die beiden neuen Zellen, die bei einer Zellteilung entstehen?"),
    accept: [tx("daughter cells", "Tochterzellen"), tx("daughter cell", "Tochterzelle")],
    show: tx('"daughter cells"', '"Tochterzellen"'),
    note: tx("The **mother cell** divides into two **daughter cells**.", "Die **Mutterzelle** teilt sich in zwei **Tochterzellen**."),
    wrong: [[tx("mother cells", "Mutterzellen"), tx("Other way round", "Andersrum"), tx("The mother cell is the one that divides. The new ones are its children.", "Die Mutterzelle ist die, die sich teilt. Die neuen sind sozusagen ihre Kinder.")]],
  },
  {
    q: tx("What are the structures in the nucleus called that carry the genetic information?", "Wie heißen die Strukturen im Zellkern, die die Erbinformation tragen?"),
    accept: [tx("chromosomes", "Chromosomen"), tx("chromosome", "Chromosom")],
    show: tx('"chromosomes"', '"Chromosomen"'),
    note: tx("The genetic information (DNA) is packed into **chromosomes**: 46 in every human body cell.", "Die Erbinformation (DNA) ist in **Chromosomen** verpackt: 46 in jeder Körperzelle des Menschen."),
  },
  {
    q: tx("What do you call egg cells and sperm cells together?", "Wie nennt man Eizellen und Spermienzellen zusammen?"),
    accept: [tx("sex cells", "Keimzellen"), tx("gametes", "Geschlechtszellen"), "Gameten", tx("germ cells", "Keimzelle")],
    show: tx('"sex cells"', '"Keimzellen"'),
    note: tx("Egg and sperm cells are **sex cells** (gametes). They carry half the chromosomes.", "Ei- und Spermienzellen sind **Keimzellen** (Geschlechtszellen). Sie tragen die halbe Chromosomenzahl."),
    wrong: [[tx("daughter cells", "Tochterzellen"), tx("That's after a division", "Das ist nach einer Teilung"), tx("Daughter cells are the result of any division. Egg and sperm cells have a special name.", "Tochterzellen entstehen bei jeder Teilung. Ei- und Spermienzellen haben einen eigenen Namen.")]],
  },
  {
    q: tx("What is the cell division called that makes two genetically identical daughter cells?", "Wie heißt die Zellteilung, bei der zwei erbgleiche Tochterzellen entstehen?"),
    accept: [tx("mitosis", "Mitose")],
    show: tx('"mitosis"', '"Mitose"'),
    note: tx("**Mitosis** makes two genetically identical daughter cells, for growth and repair.", "Die **Mitose** liefert zwei erbgleiche Tochterzellen, für Wachstum und Erneuerung."),
    wrong: [[tx("meiosis", "Meiose"), tx("That's the other one", "Das ist die andere"), tx("Meiosis makes the sex cells and halves the chromosome number. The cells it makes are not identical.", "Die Meiose bildet die Keimzellen und halbiert die Chromosomenzahl. Ihre Zellen sind nicht erbgleich.")]],
  },
  {
    q: tx("What is it called when an egg cell and a sperm cell fuse?", "Wie heißt die Verschmelzung von Eizelle und Spermienzelle?"),
    accept: [tx("fertilisation", "Befruchtung"), "fertilization"],
    show: tx('"fertilisation"', '"Befruchtung"'),
    note: tx("At **fertilisation** the nuclei of egg and sperm cell fuse: the zygote forms.", "Bei der **Befruchtung** verschmelzen die Zellkerne von Ei- und Spermienzelle: Die Zygote entsteht."),
    wrong: [[tx("pollination", "Bestäubung"), tx("Pollination is different", "Bestäubung ist etwas anderes"), tx("Pollination only brings pollen to a flower. The fusing of the sex cells comes later and has another name.", "Bei der Bestäubung kommt nur der Pollen auf die Blüte. Das Verschmelzen der Keimzellen kommt später und heißt anders.")]],
  },
  {
    q: tx("What is the cell called that divides into two new cells?", "Wie heißt die Zelle, die sich in zwei neue Zellen teilt?"),
    accept: [tx("mother cell", "Mutterzelle"), "parent cell"],
    show: tx('"mother cell"', '"Mutterzelle"'),
    note: tx("The **mother cell** divides, the two new cells are its daughter cells.", "Die **Mutterzelle** teilt sich, die beiden neuen Zellen sind ihre Tochterzellen."),
    wrong: [[tx("daughter cell", "Tochterzelle"), tx("Other way round", "Andersrum"), tx("The daughter cells are the new ones. The one that divides has the opposite name.", "Die Tochterzellen sind die neuen. Die Zelle, die sich teilt, heißt umgekehrt.")]],
  },
  {
    q: tx("Which substance is the genetic information made of? Give the short name.", "Aus welchem Stoff besteht die Erbinformation? Gib die Abkürzung an."),
    accept: [tx("DNA", "DNA"), "DNS"],
    show: '"DNA"',
    note: tx("The genetic information is stored in **DNA** (deoxyribonucleic acid).", "Die Erbinformation ist in der **DNA** gespeichert (Desoxyribonukleinsäure)."),
  },
];

function wordTask(rng: Rng): Exercise {
  const w = rng.pick(WORDS);
  return {
    instruction: tx("Name it", "Nenne den Fachbegriff"),
    text: w.q,
    answer: { kind: "word", accept: w.accept, placeholder: tx("term", "Fachbegriff") },
    hint: tx("Think back to the lesson: which word was used for this?", "Denk an die Lektion: Welches Wort wurde dafür benutzt?"),
    solution: [{ math: w.show, note: w.note }],
    mistakes: (w.wrong ?? []).map(([word, title, say]) => ({ when: { kind: "word", accept: [word] }, title, say })),
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [1.6, () => daughterTask(rng)],
    [1, () => roundsTask(rng)],
    [1.8, () => gameteTask(rng)],
    [1, () => halfTask(rng)],
    [1.2, () => orderTask(rng)],
    [1, () => matchTask(rng)],
    [1.2, () => statementExercise(rng)],
    [1, () => pictureTask(rng)],
    [1, () => wordTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

function MitosisWidget() {
  return <DivisionScrubber kind="mitosis" depth={1} />;
}

const dogCheck = gameteExercise(ORGANISMS.find((o) => o.id === "dog")!, "down", true);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Why cells divide", "Warum sich Zellen teilen"),
      blob: tx("Ever wondered how one tiny cell turns into a whole person?", "Hast du dich schon mal gefragt, wie aus einer winzigen Zelle ein ganzer Mensch wird?"),
      body: tx(
        "Your body is made of about 30 trillion cells. All of them come from one single cell: the fertilised egg cell. New cells only come from **cell division**: a **mother cell** divides into two **daughter cells**.",
        "Dein Körper besteht aus etwa 30 Billionen Zellen. Alle stammen von einer einzigen Zelle ab: der befruchteten Eizelle. Neue Zellen entstehen nur durch **Zellteilung**: Aus einer **Mutterzelle** werden zwei **Tochterzellen**.",
      ),
      frames: [
        { math: "1#c0", note: tx("It all starts with a single cell.", "Am Anfang steht eine einzige Zelle.") },
        { math: "1#c0 \\to#a1 2#c1", note: tx("It divides: one mother cell becomes two daughter cells.", "Sie teilt sich: Aus einer Mutterzelle werden zwei Tochterzellen.") },
        { math: "1#c0 \\to#a1 2#c1 \\to#a2 4#c2 \\to#a3 8#c3", note: tx("Then each of them divides again. Every round **doubles** the number of cells.", "Dann teilt sich jede davon wieder. Jede Runde **verdoppelt** die Zahl der Zellen.") },
        { math: "2^{10} = 1024", note: tx("After just 10 rounds there are more than 1000 cells. That's how a living thing grows.", "Schon nach 10 Runden sind es über 1000 Zellen. So wächst ein Lebewesen.") },
        {
          math: tx('"growth" \\quad "renewal" \\quad "healing"', '"Wachstum" \\quad "Erneuerung" \\quad "Heilung"'),
          note: tx(
            "You need cell division to **grow**, to **renew** worn-out cells (skin, gut lining, blood cells) and to **heal** wounds. Even as an adult, millions of your cells divide every second.",
            "Zellteilung brauchst du zum **Wachsen**, zur **Erneuerung** verbrauchter Zellen (Haut, Darmschleimhaut, Blutzellen) und zur **Heilung** von Wunden. Auch bei Erwachsenen teilen sich jede Sekunde Millionen Zellen.",
          ),
        },
      ],
    },
    {
      type: "explain",
      title: tx("Chromosomes carry the genetic information", "Chromosomen tragen die Erbinformation"),
      blob: tx("Where exactly is the genetic information? Let's zoom in!", "Wo steckt eigentlich die Erbinformation? Zoomen wir rein!"),
      body: tx(
        "The genetic information sits in the **nucleus**. It is stored in **DNA**, an extremely long thread-like molecule. The DNA is split into several pieces: the **chromosomes**. Before a division they coil up and become short and thick. Then you can see them under the light microscope.",
        "Die Erbinformation liegt im **Zellkern**. Sie ist in der **DNA** gespeichert, einem extrem langen, fadenförmigen Molekül. Die DNA ist auf mehrere Stücke verteilt: die **Chromosomen**. Vor einer Teilung werden sie kurz und dick. Dann kann man sie im Lichtmikroskop sehen.",
      ),
      frames: [
        {
          math: tx('"cell" \\to "nucleus" \\to "chromosome" \\to "DNA"', '"Zelle" \\to "Zellkern" \\to "Chromosom" \\to "DNA"'),
          note: tx("From big to small: the nucleus lies in the cell, the chromosomes in the nucleus, and they are made of DNA.", "Von groß nach klein: In der Zelle liegt der Zellkern, darin die Chromosomen, und die bestehen aus DNA."),
        },
        { math: tx('46#n "chromosomes"', '46#n "Chromosomen"'), note: tx("Every human body cell has **46 chromosomes**.", "Jede Körperzelle des Menschen hat **46 Chromosomen**.") },
        { math: "46#n = 23 \\cdot 2", note: tx("They form **23 pairs**: you have two of each chromosome. One comes from your mother, one from your father.", "Sie bilden **23 Paare**: Von jedem Chromosom hast du zwei. Eins stammt von deiner Mutter, eins von deinem Vater.") },
        {
          math: tx('"dog:" \\; 78 \\quad "pea:" \\; 14 \\quad "fruit fly:" \\; 8', '"Hund:" \\; 78 \\quad "Erbse:" \\; 14 \\quad "Taufliege:" \\; 8'),
          note: tx("Every species has its own chromosome number. More chromosomes doesn't mean bigger or cleverer: a dog has 78!", "Jede Art hat ihre eigene Chromosomenzahl. Mehr Chromosomen heißt nicht größer oder klüger: Ein Hund hat 78!"),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Watch a cell divide", "Schau einer Zelle beim Teilen zu"),
      blob: tx("Drag the time bar. The chromosomes really move!", "Zieh mal am Zeitstrahl. Die Chromosomen bewegen sich wirklich!"),
      body: tx(
        "This model cell has 4 chromosomes: two pairs, one chromosome of each pair from the mother (red) and one from the father (blue). Drag the bar or press play. Count the chromosomes before and after the division.",
        "Diese Modellzelle hat 4 Chromosomen: zwei Paare, von jedem Paar eins von der Mutter (rot) und eins vom Vater (blau). Zieh am Zeitstrahl oder drück auf Abspielen. Zähl die Chromosomen vor und nach der Teilung.",
      ),
      widget: MitosisWidget,
    },
    {
      type: "check",
      blob: tx("Your turn! Think about what you just saw.", "Du bist dran! Denk daran, was du gerade gesehen hast."),
      exercise: daughterExercise(HUMAN),
    },
    {
      type: "explain",
      title: tx("Copy first, then share", "Erst kopieren, dann teilen"),
      blob: tx("Here's the trick that makes it fair.", "Hier ist der Trick, der die Teilung gerecht macht."),
      body: tx(
        "So that both daughter cells get the complete genetic information, every chromosome is **copied** before the division. A copied chromosome consists of two identical halves joined in the middle. That's why it looks like an X.",
        "Damit beide Tochterzellen die komplette Erbinformation bekommen, wird vor der Teilung jedes Chromosom **kopiert**. Ein kopiertes Chromosom besteht aus zwei gleichen Hälften, die in der Mitte zusammenhängen. Darum sieht es aus wie ein X.",
      ),
      frames: [
        { math: tx('"mother cell:" \\; 46#m', '"Mutterzelle:" \\; 46#m'), note: tx("The mother cell has 46 chromosomes.", "Die Mutterzelle hat 46 Chromosomen.") },
        { math: tx('"mother cell:" \\; 46#m "X"#x', '"Mutterzelle:" \\; 46#m "X"#x'), note: tx("Each one is copied. There are still 46 chromosomes, but each now has two identical halves: 46 X shapes.", "Jedes wird kopiert. Es sind immer noch 46 Chromosomen, aber jedes hat jetzt zwei gleiche Hälften: 46 X-Formen.") },
        {
          math: tx('46#m "X"#x \\to#t 46#a , 46#b', '46#m "X"#x \\to#t 46#a , 46#b'),
          note: tx("In the division the halves are pulled apart: one half goes into each daughter cell.", "Bei der Teilung werden die Hälften getrennt: Je eine Hälfte kommt in jede Tochterzelle."),
        },
        {
          math: tx('"daughter cells:" \\; 46#a , 46#b', '"Tochterzellen:" \\; 46#a , 46#b'),
          note: tx("Each daughter cell has 46 chromosomes again, with exactly the same genetic information as the mother cell. They are **genetically identical**.", "Jede Tochterzelle hat wieder 46 Chromosomen, mit genau derselben Erbinformation wie die Mutterzelle. Sie sind **erbgleich**."),
        },
        { math: tx('"mitosis"', '"Mitose"'), note: tx("This kind of division is called **mitosis**: one cell becomes two genetically identical cells.", "Diese Teilung heißt **Mitose**: Aus einer Zelle werden zwei erbgleiche Zellen.") },
      ],
    },
    {
      type: "check",
      blob: tx("Can you put the steps in order?", "Bekommst du die Schritte in die richtige Reihenfolge?"),
      exercise: orderExercise("steps", [STEPS.copy, STEPS.thick, STEPS.middle, STEPS.apart, STEPS.pinch]),
    },
    {
      type: "explain",
      title: tx("Sex cells: only half the chromosomes", "Keimzellen: nur die halbe Chromosomenzahl"),
      blob: tx("Now for the cells that make a new living thing.", "Jetzt zu den Zellen, aus denen ein neues Lebewesen entsteht."),
      body: tx(
        "In sexual reproduction an **egg cell** from the mother and a **sperm cell** from the father fuse: **fertilisation**. These **sex cells** have only half as many chromosomes as body cells.",
        "Bei der Fortpflanzung verschmelzen eine **Eizelle** der Mutter und eine **Spermienzelle** des Vaters: die **Befruchtung**. Diese **Keimzellen** haben nur halb so viele Chromosomen wie Körperzellen.",
      ),
      frames: [
        { math: tx('"egg cell:" \\; 23#e', '"Eizelle:" \\; 23#e'), note: tx("A human egg cell has 23 chromosomes: one of every pair.", "Eine Eizelle des Menschen hat 23 Chromosomen: von jedem Paar eins.") },
        { math: tx('"egg cell:" \\; 23#e \\quad "sperm cell:" \\; 23#s', '"Eizelle:" \\; 23#e \\quad "Spermienzelle:" \\; 23#s'), note: tx("A sperm cell also has 23.", "Eine Spermienzelle hat auch 23.") },
        { math: "23#e + 23#s = 46#z", note: tx("At fertilisation they come together. The fertilised egg cell, the **zygote**, has 46 chromosomes again.", "Bei der Befruchtung kommen beide zusammen. Die befruchtete Eizelle, die **Zygote**, hat wieder 46 Chromosomen.") },
        {
          math: tx('"zygote" \\to "mitosis" \\to "baby"', '"Zygote" \\to "Mitose" \\to "Baby"'),
          note: tx("By countless mitoses the zygote grows into a whole human. That's why every body cell has the same 46 chromosomes.", "Durch unzählige Mitosen wächst aus der Zygote ein ganzer Mensch. Darum hat jede Körperzelle dieselben 46 Chromosomen."),
        },
        {
          math: "46 \\to 23",
          note: tx("Sex cells are made by a special division that halves the chromosome number: **meiosis**. More about it in level 2.", "Keimzellen entstehen durch eine besondere Teilung, die die Chromosomenzahl halbiert: die **Meiose**. Mehr dazu in Stufe 2."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Fertilisation lab", "Befruchtungslabor"),
      blob: tx("Pick an animal or a plant and bring the two cells together!", "Such dir ein Tier oder eine Pflanze aus und bring die beiden Zellen zusammen!"),
      body: tx("Choose a living thing and fertilise. Then find out what would happen if sex cells were not halved.", "Wähle ein Lebewesen und befruchte. Probier dann aus, was passieren würde, wenn Keimzellen nicht halbiert wären."),
      widget: DivisionFertilisation,
    },
    {
      type: "check",
      blob: tx("A question about dogs.", "Eine Frage zum Hund."),
      exercise: dogCheck,
    },
    {
      type: "check",
      blob: tx("Last one! Read every statement carefully.", "Die letzte! Lies jede Aussage genau."),
      exercise: statementExercise(createRng(11)),
    },
  ],
  summary: [
    {
      title: tx("Cell division (mitosis)", "Zellteilung (Mitose)"),
      body: tx(
        "A mother cell divides into two **genetically identical** daughter cells. Needed for growth, for renewing cells and for healing wounds.",
        "Aus einer Mutterzelle entstehen zwei **erbgleiche** Tochterzellen. Wichtig für Wachstum, Erneuerung von Zellen und Wundheilung.",
      ),
      examples: [tx('"1 cell" \\to "2 cells" \\to "4 cells"', '"1 Zelle" \\to "2 Zellen" \\to "4 Zellen"')],
      tone: "rule",
    },
    {
      title: tx("Chromosomes", "Chromosomen"),
      body: tx(
        "Carriers of the genetic information (DNA) in the nucleus. Humans: **46 chromosomes = 23 pairs**, one of each pair from the mother, one from the father.",
        "Träger der Erbinformation (DNA) im Zellkern. Mensch: **46 Chromosomen = 23 Paare**, von jedem Paar eins von der Mutter, eins vom Vater.",
      ),
      examples: ["46 = 23 \\cdot 2"],
      tone: "rule",
    },
    {
      title: tx("Copy first, then share", "Erst kopieren, dann teilen"),
      body: tx(
        "Before the division every chromosome is copied (X shape). The two halves are separated, so each daughter cell gets all chromosomes again.",
        "Vor der Teilung wird jedes Chromosom kopiert (X-Form). Die beiden Hälften werden getrennt, so bekommt jede Tochterzelle wieder alle Chromosomen.",
      ),
      examples: [tx('"mother cell:" 46 \\to 46 , 46', '"Mutterzelle:" 46 \\to 46 , 46')],
      tone: "rule",
    },
    {
      title: tx("Sex cells and fertilisation", "Keimzellen und Befruchtung"),
      body: tx(
        "Egg cells and sperm cells have **half** the chromosome number. At fertilisation they fuse to the zygote, which has the full number again.",
        "Eizellen und Spermienzellen haben die **halbe** Chromosomenzahl. Bei der Befruchtung verschmelzen sie zur Zygote, die wieder die volle Zahl hat.",
      ),
      examples: ["23 + 23 = 46"],
      tone: "rule",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx(
        "Mitosis does **not** halve the chromosome number! Only sex cells have half. And more chromosomes doesn't mean a more developed living thing.",
        "Die Mitose halbiert die Chromosomenzahl **nicht**! Nur Keimzellen haben die Hälfte. Und mehr Chromosomen heißt nicht höher entwickelt.",
      ),
      examples: [tx('"skin cell:" 46 \\to 46 , 46', '"Hautzelle:" 46 \\to 46 , 46')],
      tone: "warning",
    },
  ],
};
