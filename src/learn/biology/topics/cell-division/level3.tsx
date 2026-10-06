"use client";

// Level 3 (Oberstufe): meiosis I and II in detail, chromosome sets and DNA content (n, c),
// recombination, nondisjunction and karyograms, and the control of the cell cycle.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { dec } from "@/learn/chemistry/format";
import { DivisionAssortment } from "@/learn/biology/visuals/DivisionAssortment";
import { DivisionCheckpoints } from "@/learn/biology/visuals/DivisionCheckpoints";
import { DivisionKaryogram, KARYOTYPES, type Karyotype } from "@/learn/biology/visuals/DivisionKaryogram";
import { DivisionNdjLab } from "@/learn/biology/visuals/DivisionNdjLab";
import { DivisionPhase, type DivisionKind, type ModelSize, type Stage } from "@/learn/biology/visuals/DivisionScene";
import { DivisionDnaGraph, DivisionScrubber } from "@/learn/biology/visuals/DivisionScrubber";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson } from "@/learn/types";
import { ORGANISMS, type Organism } from "./data";
import { choice, mistakesFor, num, some, visual, weighted, type Opt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

// ---------------------------------------------------------------------------
// DNA content in pg

type CStage = "g2" | "pro" | "daughter" | "pro1" | "meta1" | "telo1" | "meta2" | "gamete";
const C_OF: Record<CStage, number> = { g2: 4, pro: 4, daughter: 2, pro1: 4, meta1: 4, telo1: 2, meta2: 2, gamete: 1 };
const C_NAME: Record<CStage, Text> = {
  g2: tx("a cell of the same kind in the G2 phase", "eine Zelle derselben Art in der G2-Phase"),
  pro: tx("a cell in prophase of mitosis", "eine Zelle in der Prophase der Mitose"),
  daughter: tx("a daughter cell right after mitosis", "eine Tochterzelle direkt nach der Mitose"),
  pro1: tx("a cell in prophase I", "eine Zelle in der Prophase I"),
  meta1: tx("a cell in metaphase I", "eine Zelle in der Metaphase I"),
  telo1: tx("one of the two cells after meiosis I", "eine der beiden Zellen nach der Meiose I"),
  meta2: tx("a cell in metaphase II", "eine Zelle in der Metaphase II"),
  gamete: tx("a sex cell at the end of meiosis", "eine Keimzelle am Ende der Meiose"),
};
const C_PATH: Record<CStage, [string, Text]> = {
  g2: ["2c \\to 4c", tx("Replication in the S phase doubles the DNA content.", "Die Replikation in der S-Phase verdoppelt den DNA-Gehalt.")],
  pro: ["2c \\to 4c", tx("The DNA was replicated before mitosis: prophase still has 4c.", "Vor der Mitose wurde repliziert: Die Prophase hat noch 4c.")],
  daughter: ["2c \\to 4c \\to 2c", tx("Replication doubles, mitosis shares the chromatids out: 2c again.", "Die Replikation verdoppelt, die Mitose verteilt die Chromatiden: wieder 2c.")],
  pro1: ["2c \\to 4c", tx("Before meiosis the DNA is replicated: prophase I has 4c.", "Vor der Meiose wird repliziert: Die Prophase I hat 4c.")],
  meta1: ["2c \\to 4c", tx("Replicated before meiosis, nothing separated yet: 4c.", "Vor der Meiose repliziert, noch nichts getrennt: 4c.")],
  telo1: ["2c \\to 4c \\to 2c", tx("Meiosis I separates the homologues, each still with two chromatids: n, 2c.", "Die Meiose I trennt die Homologen, jedes noch mit zwei Chromatiden: n, 2c.")],
  meta2: ["2c \\to 4c \\to 2c", tx("After meiosis I: n chromosomes with two chromatids each, 2c. No replication before meiosis II.", "Nach der Meiose I: n Chromosomen mit je zwei Chromatiden, 2c. Vor der Meiose II wird nicht repliziert.")],
  gamete: ["2c \\to 4c \\to 2c \\to 1c", tx("Meiosis II separates the sister chromatids: n, 1c.", "Die Meiose II trennt die Schwesterchromatiden: n, 1c.")],
};

function cExercise(pg: number, stage: CStage): Exercise {
  const c = C_OF[stage];
  const value = (pg * c) / 2;
  const unit = "pg";
  const ans = num(value, unit, 0.001);
  const m = mistakesFor(ans);
  const add = (v: number, title: Text, say: Text) => m.add(num(v, unit, 0.001), title, say);
  if (stage === "g2" || stage === "pro") add(value / 2, tx("Replication forgotten", "Replikation vergessen"), tx("Don't forget the S phase: before every division the DNA content doubles from 2c to 4c.", "Denk an die S-Phase: Vor jeder Teilung verdoppelt sich der DNA-Gehalt von 2c auf 4c."));
  if (stage === "daughter") {
    add(value / 2, tx("Mitosis doesn't halve", "Mitose halbiert nicht"), tx("Mitosis takes the cell from 4c back to 2c, the same as in G1. It doesn't halve below that.", "Die Mitose bringt die Zelle von 4c zurück auf 2c, wie in G1. Weiter halbiert sie nicht."));
    add(value * 2, tx("The chromatids are shared", "Die Chromatiden werden verteilt"), tx("Before mitosis the cell had 4c, but the chromatids are shared between the two daughter cells: 2c each.", "Vor der Mitose hatte die Zelle 4c, aber die Chromatiden werden auf zwei Tochterzellen verteilt: je 2c."));
  }
  if (stage === "pro1" || stage === "meta1") {
    add(value / 2, tx("Still 4c", "Noch 4c"), tx("The S phase has doubled the DNA, and nothing has been separated yet: the cell still has 4c.", "Die S-Phase hat die DNA verdoppelt, und getrennt ist noch nichts: Die Zelle hat noch 4c."));
    add(value / 4, tx("That's a sex cell", "Das wäre eine Keimzelle"), tx("1c is reached only at the very end of meiosis. In this phase nothing has been separated yet.", "1c ist erst ganz am Ende der Meiose erreicht. In dieser Phase ist noch nichts getrennt."));
  }
  if (stage === "telo1" || stage === "meta2") {
    add(value / 2, tx("Haploid isn't 1c", "Haploid heißt nicht 1c"), tx("The cell is haploid (n), but its chromosomes still have two chromatids: 2c, not 1c.", "Die Zelle ist haploid (n), aber ihre Chromosomen haben noch zwei Chromatiden: 2c, nicht 1c."));
    add(value * 2, tx("Meiosis I halves", "Meiose I halbiert"), tx("Meiosis I has already separated the homologues: the DNA content went from 4c down to 2c.", "Die Meiose I hat die Homologen schon getrennt: Der DNA-Gehalt ging von 4c auf 2c zurück."));
  }
  if (stage === "gamete") {
    add(value / 2, tx("Replication forgotten", "Replikation vergessen"), tx("Halved twice, but the DNA was doubled before meiosis started: 2c → 4c → 2c → 1c.", "Zweimal halbiert, aber vor der Meiose wurde die DNA verdoppelt: 2c → 4c → 2c → 1c."));
    add(value * 2, tx("Meiosis II halves too", "Auch die Meiose II halbiert"), tx("Meiosis II separates the sister chromatids, so the DNA content halves a second time: 1c.", "Die Meiose II trennt die Schwesterchromatiden, der DNA-Gehalt halbiert sich also ein zweites Mal: 1c."));
  }
  const [path, note] = C_PATH[stage];
  return {
    instruction: tx("Work out the DNA content", "Berechne den DNA-Gehalt"),
    text: txMap((t, l) =>
      t(
        `A body cell in the G1 phase contains ${dec(pg, "en")} pg of DNA. How much DNA does ${resolveText(C_NAME[stage], l)} contain?`,
        `Eine Körperzelle in der G1-Phase enthält ${dec(pg, "de")} pg DNA. Wie viel DNA enthält ${resolveText(C_NAME[stage], l)}?`,
      ),
    ),
    answer: ans,
    hint: tx("G1 is 2c. Follow the c value: S phase doubles, every separation of homologues or chromatids halves.", "G1 entspricht 2c. Verfolge den c-Wert: Die S-Phase verdoppelt, jede Trennung von Homologen oder Chromatiden halbiert."),
    solution: [
      { math: tx(`"G1 phase:" \\; 2c = ${dec(pg, "en")} "pg"`, `"G1-Phase:" \\; 2c = ${dec(pg, "de")} "pg"`), note: tx(`2c = ${dec(pg, "en")} pg, so 1c = ${dec(pg / 2, "en")} pg.`, `2c = ${dec(pg, "de")} pg, also 1c = ${dec(pg / 2, "de")} pg.`) },
      { math: path, note },
      {
        math: tx(`"so" \\; ${c}c = ${dec(value, "en")}#r "pg"`, `"also" \\; ${c}c = ${dec(value, "de")}#r "pg"`),
        note: tx(`So the cell contains **${dec(value, "en")} pg** of DNA.`, `Die Zelle enthält also **${dec(value, "de")} pg** DNA.`),
      },
    ],
    mistakes: m.list,
  };
}

const PGS = [4, 5, 6, 8, 10, 12, 14, 16, 20];
const cTask = (rng: Rng) => cExercise(rng.pick(PGS), rng.pick(["g2", "pro", "daughter", "pro1", "meta1", "telo1", "meta2", "meta2", "gamete", "gamete"] as const));

// ---------------------------------------------------------------------------
// n and c of a stage

const NC = ["2n, 2c", "2n, 4c", "n, 2c", "n, 1c"] as const;
type NcStage = { name: Text; right: (typeof NC)[number]; traps: Partial<Record<(typeof NC)[number], [Text, Text]>> };
const NC_STAGES: NcStage[] = [
  {
    name: tx("a body cell in the G1 phase", "eine Körperzelle in der G1-Phase"),
    right: "2n, 2c",
    traps: { "2n, 4c": [tx("Not replicated yet", "Noch nicht repliziert"), tx("4c only after the S phase. In G1 every chromosome has one chromatid.", "4c erst nach der S-Phase. In G1 hat jedes Chromosom ein Chromatid.")] },
  },
  {
    name: tx("a body cell in the G2 phase", "eine Körperzelle in der G2-Phase"),
    right: "2n, 4c",
    traps: { "2n, 2c": [tx("Replication doubles c", "Die Replikation verdoppelt c"), tx("After the S phase the DNA content is doubled (4c). The chromosome set (2n) stays the same.", "Nach der S-Phase ist der DNA-Gehalt verdoppelt (4c). Der Chromosomensatz (2n) bleibt gleich.")] },
  },
  {
    name: tx("a cell in metaphase of mitosis", "eine Zelle in der Metaphase der Mitose"),
    right: "2n, 4c",
    traps: { "2n, 2c": [tx("Still two chromatids", "Noch zwei Chromatiden"), tx("In metaphase the chromosomes still have two chromatids each: 4c.", "In der Metaphase haben die Chromosomen noch je zwei Chromatiden: 4c.")] },
  },
  {
    name: tx("a cell in metaphase I", "eine Zelle in der Metaphase I"),
    right: "2n, 4c",
    traps: { "n, 2c": [tx("Not separated yet", "Noch nicht getrennt"), tx("In metaphase I the homologues are still together in one cell: 2n, 4c. They are only separated in anaphase I.", "In der Metaphase I sind die Homologen noch zusammen in einer Zelle: 2n, 4c. Getrennt werden sie erst in der Anaphase I.")] },
  },
  {
    name: tx("one of the two cells after meiosis I", "eine der beiden Zellen nach der Meiose I"),
    right: "n, 2c",
    traps: {
      "n, 1c": [tx("Still two chromatids", "Noch zwei Chromatiden"), tx("Haploid, yes, but each chromosome still has two chromatids: 2c.", "Haploid, ja, aber jedes Chromosom hat noch zwei Chromatiden: 2c.")],
      "2n, 2c": [tx("Meiosis I halves the set", "Meiose I halbiert den Satz"), tx("Meiosis I is the reduction division: the homologues are separated, so the cell is haploid (n).", "Die Meiose I ist die Reduktionsteilung: Die Homologen wurden getrennt, die Zelle ist haploid (n).")],
    },
  },
  {
    name: tx("a cell in metaphase II", "eine Zelle in der Metaphase II"),
    right: "n, 2c",
    traps: {
      "n, 1c": [tx("Still two chromatids", "Noch zwei Chromatiden"), tx("In metaphase II the chromatids haven't been separated yet: n chromosomes with two chromatids, 2c.", "In der Metaphase II sind die Chromatiden noch nicht getrennt: n Chromosomen mit zwei Chromatiden, 2c.")],
      "2n, 4c": [tx("Already after meiosis I", "Schon nach der Meiose I"), tx("Metaphase II comes after the reduction division: the cell is already haploid.", "Die Metaphase II kommt nach der Reduktionsteilung: Die Zelle ist schon haploid.")],
    },
  },
  {
    name: tx("a sex cell (sperm cell)", "eine Keimzelle (Spermienzelle)"),
    right: "n, 1c",
    traps: { "n, 2c": [tx("Meiosis II halves c", "Meiose II halbiert c"), tx("Meiosis II separates the sister chromatids: one-chromatid chromosomes, 1c.", "Die Meiose II trennt die Schwesterchromatiden: Ein-Chromatid-Chromosomen, 1c.")] },
  },
  {
    name: tx("a zygote right after fertilisation", "eine Zygote direkt nach der Befruchtung"),
    right: "2n, 2c",
    traps: { "n, 1c": [tx("Two sex cells fused", "Zwei Keimzellen verschmolzen"), tx("Egg cell (n, 1c) and sperm cell (n, 1c) together give 2n, 2c.", "Eizelle (n, 1c) und Spermienzelle (n, 1c) zusammen ergeben 2n, 2c.")] },
  },
  {
    name: tx("a daughter cell right after mitosis", "eine Tochterzelle direkt nach der Mitose"),
    right: "2n, 2c",
    traps: { "n, 1c": [tx("Mitosis doesn't halve the set", "Mitose halbiert den Satz nicht"), tx("Mitosis keeps the chromosome set (2n). It only separates the chromatids: 4c → 2c.", "Die Mitose behält den Chromosomensatz (2n). Sie trennt nur die Chromatiden: 4c → 2c.")] },
  },
];

const ncText = (s: string) => {
  const [a, b] = s.split(", ");
  return `$${a}$, $${b}$`;
};

function ncTask(rng: Rng): Exercise {
  const st = rng.pick(NC_STAGES);
  const opts: Opt[] = [
    { text: ncText(st.right) },
    ...NC.filter((x) => x !== st.right).map((x) => ({ text: ncText(x), title: st.traps[x]?.[0], say: st.traps[x]?.[1] })),
  ];
  const c = choice(rng, opts);
  return {
    instruction: tx("Chromosome set and DNA content", "Chromosomensatz und DNA-Gehalt"),
    text: txMap((t, l) => t(`Which description fits ${resolveText(st.name, l)}?`, `Welche Angabe beschreibt ${resolveText(st.name, l)} richtig?`)),
    answer: c.answer,
    hint: tx("n counts the chromosome sets, c the amount of DNA. Replication doubles c only; meiosis I halves n and c; meiosis II and mitosis halve c only.", "n zählt die Chromosomensätze, c die DNA-Menge. Die Replikation verdoppelt nur c; die Meiose I halbiert n und c; Meiose II und Mitose halbieren nur c."),
    solution: [{ math: st.right, note: txMap((t, l) => `${t("For", "Für")} ${resolveText(st.name, l)}: **${st.right}**.`) }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Counting structures in meiosis

type MStage = "biv" | "ctMeta1" | "chrMeta2" | "ctMeta2" | "chrTelo1" | "ctGamete";
const M_TEXT: Record<MStage, [Text, Text]> = {
  biv: [tx("How many bivalents form in prophase I?", "Wie viele Bivalente entstehen in der Prophase I?"), tx("Bivalents", "Bivalente")],
  ctMeta1: [tx("How many chromatids does a cell in metaphase I contain?", "Wie viele Chromatiden enthält eine Zelle in der Metaphase I?"), tx("Chromatids", "Chromatiden")],
  chrMeta2: [tx("How many chromosomes does a cell in metaphase II contain?", "Wie viele Chromosomen enthält eine Zelle in der Metaphase II?"), tx("Chromosomes", "Chromosomen")],
  ctMeta2: [tx("How many chromatids does a cell in metaphase II contain?", "Wie viele Chromatiden enthält eine Zelle in der Metaphase II?"), tx("Chromatids", "Chromatiden")],
  chrTelo1: [tx("How many chromosomes does each cell contain after meiosis I?", "Wie viele Chromosomen enthält jede Zelle nach der Meiose I?"), tx("Chromosomes", "Chromosomen")],
  ctGamete: [tx("How many chromatids does a sex cell contain?", "Wie viele Chromatiden enthält eine Keimzelle?"), tx("Chromatids", "Chromatiden")],
};

function meiosisCountExercise(o: Organism, stage: MStage): Exercise {
  const N = o.n2;
  const n = N / 2;
  const value = { biv: n, ctMeta1: 2 * N, chrMeta2: n, ctMeta2: N, chrTelo1: n, ctGamete: n }[stage];
  const m = mistakesFor(num(value));
  if (stage === "biv") {
    m.add(num(N), tx("A bivalent is a pair", "Ein Bivalent ist ein Paar"), tx("A bivalent consists of two homologous chromosomes. So there are as many bivalents as chromosome pairs.", "Ein Bivalent besteht aus zwei homologen Chromosomen. Es gibt also so viele Bivalente wie Chromosomenpaare."));
    m.add(num(2 * N), tx("That's the chromatids", "Das sind die Chromatiden"), tx("You counted the chromatids. Four of them form one bivalent (tetrad).", "Du hast die Chromatiden gezählt. Vier davon bilden ein Bivalent (Tetrade)."));
  }
  if (stage === "ctMeta1") m.add(num(N), tx("Two chromatids each", "Je zwei Chromatiden"), tx("That's the number of chromosomes. Each of them has two chromatids in metaphase I.", "Das ist die Zahl der Chromosomen. In der Metaphase I hat jedes davon zwei Chromatiden."));
  if (stage === "chrMeta2" || stage === "chrTelo1") m.add(num(N), tx("Meiosis I has halved", "Die Meiose I hat halbiert"), tx("Meiosis I separated the homologues: each cell is haploid now, n chromosomes.", "Die Meiose I hat die Homologen getrennt: Jede Zelle ist jetzt haploid, n Chromosomen."));
  if (stage === "ctMeta2") {
    m.add(num(n), tx("Two chromatids each", "Je zwei Chromatiden"), tx("In metaphase II there are n chromosomes, but each still has two chromatids.", "In der Metaphase II gibt es n Chromosomen, aber jedes hat noch zwei Chromatiden."));
    m.add(num(2 * N), tx("Meiosis I has halved", "Die Meiose I hat halbiert"), tx("That's metaphase I. After meiosis I the cell has only half as many chromatids.", "Das wäre die Metaphase I. Nach der Meiose I hat die Zelle nur noch halb so viele Chromatiden."));
  }
  if (stage === "ctGamete") m.add(num(N), tx("Sex cells are haploid", "Keimzellen sind haploid"), tx("A sex cell has n one-chromatid chromosomes, so n chromatids.", "Eine Keimzelle hat n Ein-Chromatid-Chromosomen, also n Chromatiden."));
  const [q] = M_TEXT[stage];
  const sol: Record<MStage, [string, Text]> = {
    biv: [`n = ${N} : 2 = ${n}`, tx(`One bivalent per pair of homologues: **${n} bivalents**, each with 4 chromatids.`, `Ein Bivalent pro Homologenpaar: **${n} Bivalente**, jedes aus 4 Chromatiden.`)],
    ctMeta1: [`2n \\cdot 2 = ${N} \\cdot 2 = ${2 * N}`, tx(`${N} two-chromatid chromosomes: **${2 * N} chromatids**.`, `${N} Zwei-Chromatid-Chromosomen: **${2 * N} Chromatiden**.`)],
    chrMeta2: [`n = ${n}`, tx(`After meiosis I the cell is haploid: **${n} chromosomes** (with two chromatids each).`, `Nach der Meiose I ist die Zelle haploid: **${n} Chromosomen** (mit je zwei Chromatiden).`)],
    ctMeta2: [`n \\cdot 2 = ${n} \\cdot 2 = ${N}`, tx(`${n} two-chromatid chromosomes: **${N} chromatids**.`, `${n} Zwei-Chromatid-Chromosomen: **${N} Chromatiden**.`)],
    chrTelo1: [`n = ${n}`, tx(`The homologues were shared between two cells: **${n} chromosomes** each.`, `Die Homologen wurden auf zwei Zellen verteilt: je **${n} Chromosomen**.`)],
    ctGamete: [`n = ${n}`, tx(`A sex cell has ${n} one-chromatid chromosomes: **${n} chromatids**.`, `Eine Keimzelle hat ${n} Ein-Chromatid-Chromosomen: **${n} Chromatiden**.`)],
  };
  return {
    instruction: tx("Count in meiosis", "Zähle in der Meiose"),
    text: txMap((t, l) => `${t(`${resolveText(o.cells, l)} have 2n = ${N} chromosomes.`, `${resolveText(o.cells, l)} haben 2n = ${N} Chromosomen.`)} ${resolveText(q, l)}`),
    answer: num(value),
    hint: tx("First decide: 2n or n? Then: one or two chromatids per chromosome?", "Entscheide zuerst: 2n oder n? Dann: ein oder zwei Chromatiden pro Chromosom?"),
    solution: [{ math: sol[stage][0], note: sol[stage][1] }],
    mistakes: m.list,
  };
}

const meiosisCountTask = (rng: Rng) => meiosisCountExercise(rng.pick(ORGANISMS), rng.pick(["biv", "ctMeta1", "chrMeta2", "ctMeta2", "chrTelo1", "ctGamete"] as const));

// ---------------------------------------------------------------------------
// Recombination: 2^n

function combosExercise(n2: number, who: Text | null): Exercise {
  const n = n2 / 2;
  const value = 2 ** n;
  const m = mistakesFor(num(value));
  if (n2 <= 30) m.add(num(2 ** n2), tx("Pairs, not chromosomes", "Paare, nicht Chromosomen"), tx(`The exponent is the number of **pairs** (n = ${n}), not of all chromosomes. Each pair can face either way.`, `Im Exponenten steht die Zahl der **Paare** (n = ${n}), nicht aller Chromosomen. Jedes Paar kann sich so oder so herum anordnen.`));
  m.add(num(2 * n), tx("Multiplied instead of powers", "Multipliziert statt potenziert"), tx("Each pair doubles the number of possibilities, so you multiply 2 by itself n times: a power.", "Jedes Paar verdoppelt die Zahl der Möglichkeiten, du musst also n-mal mit 2 malnehmen: eine Potenz."));
  m.add(num(n * n), tx("Wrong power", "Falsche Potenz"), tx(`Not n², but 2ⁿ: 2 possibilities for every one of the ${n} pairs.`, `Nicht n², sondern 2ⁿ: 2 Möglichkeiten für jedes der ${n} Paare.`));
  return {
    instruction: tx("Count the combinations", "Berechne die Kombinationen"),
    text: who
      ? txMap((t, l) => t(`${resolveText(who, l)} have 2n = ${n2} chromosomes. How many genetically different sex cells are possible just through the random distribution of the homologues (without crossing over)?`, `${resolveText(who, l)} haben 2n = ${n2} Chromosomen. Wie viele genetisch verschiedene Keimzellen sind allein durch die zufällige Verteilung der Homologen möglich (ohne Crossing-over)?`))
      : tx(`A cell has 2n = ${n2} chromosomes. How many genetically different sex cells are possible just through the random distribution of the homologues (without crossing over)?`, `Eine Zelle hat 2n = ${n2} Chromosomen. Wie viele genetisch verschiedene Keimzellen sind allein durch die zufällige Verteilung der Homologen möglich (ohne Crossing-over)?`),
    answer: num(value),
    hint: tx("Every pair of homologues can face either way in metaphase I: 2 possibilities per pair.", "Jedes Homologenpaar kann sich in der Metaphase I so oder so herum anordnen: 2 Möglichkeiten pro Paar."),
    solution: [
      { math: `n = ${n2} : 2 = ${n}`, note: tx(`${n} pairs of homologues.`, `${n} Homologenpaare.`) },
      { math: `2^{${n}} = ${value}`, note: tx(`Every pair has 2 possibilities: **${value}** combinations (interchromosomal recombination).`, `Jedes Paar hat 2 Möglichkeiten: **${value}** Kombinationen (interchromosomale Rekombination).`) },
    ],
    mistakes: m.list,
  };
}

function probabilityExercise(n2: number): Exercise {
  const n = n2 / 2;
  const value = 100 / 2 ** n;
  const ans = num(value, "%", 0.005);
  const m = mistakesFor(ans);
  m.add(num(50, "%", 0.005), tx("All pairs at once", "Alle Paare gleichzeitig"), tx("50 % is right for one pair. But all pairs have to send the maternal chromosome the same way: multiply the probabilities.", "50 % stimmt für ein Paar. Aber alle Paare müssen das mütterliche Chromosom in dieselbe Richtung schicken: Multipliziere die Wahrscheinlichkeiten."));
  m.add(num(100 / n, "%", 0.005), tx("Not 1 in n", "Nicht 1 zu n"), tx(`There are 2ⁿ = ${2 ** n} equally likely combinations, and only one of them is all maternal.`, `Es gibt 2ⁿ = ${2 ** n} gleich wahrscheinliche Kombinationen, und nur eine davon ist rein mütterlich.`));
  return {
    instruction: tx("Probability", "Wahrscheinlichkeit"),
    text: tx(
      `An organism has 2n = ${n2} chromosomes. How likely is it (in %) that a sex cell gets only chromosomes that came from the mother? Ignore crossing over.`,
      `Ein Lebewesen hat 2n = ${n2} Chromosomen. Wie wahrscheinlich ist es (in %), dass eine Keimzelle nur Chromosomen bekommt, die von der Mutter stammen? Crossing-over wird nicht berücksichtigt.`,
    ),
    answer: ans,
    hint: tx("For each pair the chance is 1/2. The pairs are independent.", "Für jedes Paar ist die Chance 1/2. Die Paare sind unabhängig voneinander."),
    solution: [
      { math: `(\\frac{1}{2})^{${n}} = \\frac{1}{${2 ** n}}`, note: tx(`${n} pairs, each with a chance of 1/2: multiply.`, `${n} Paare, jedes mit der Chance 1/2: multiplizieren.`) },
      { math: tx(`\\frac{1}{${2 ** n}} = ${dec(value, "en", 3)} "%"`, `\\frac{1}{${2 ** n}} = ${dec(value, "de", 3)} "%"`), note: tx(`About **${dec(value, "en", 3)} %**.`, `Etwa **${dec(value, "de", 3)} %**.`) },
    ],
    mistakes: m.list,
  };
}

function zygoteExercise(n2: number): Exercise {
  const n = n2 / 2;
  const g = 2 ** n;
  const value = g * g;
  const m = mistakesFor(num(value));
  m.add(num(2 * g), tx("Multiply, don't add", "Multiplizieren, nicht addieren"), tx(`Every one of the ${g} egg cells can meet every one of the ${g} sperm cells: multiply.`, `Jede der ${g} Eizellen kann auf jede der ${g} Spermienzellen treffen: multiplizieren.`));
  m.add(num(g), tx("Two parents", "Zwei Eltern"), tx(`${g} is the number of sex cells of one parent. The zygote combines one from each.`, `${g} ist die Zahl der Keimzellen eines Elternteils. Die Zygote kombiniert je eine von beiden.`));
  return {
    instruction: tx("Combinations in the zygote", "Kombinationen in der Zygote"),
    text: tx(
      `Two parents of a species with 2n = ${n2} have children. How many genetically different zygotes are possible just through the random distribution in meiosis (without crossing over)?`,
      `Zwei Eltern einer Art mit 2n = ${n2} bekommen Nachwuchs. Wie viele genetisch verschiedene Zygoten sind allein durch die zufällige Verteilung in der Meiose möglich (ohne Crossing-over)?`,
    ),
    answer: num(value),
    hint: tx("First the sex cells of one parent (2ⁿ), then combine egg and sperm cells.", "Erst die Keimzellen eines Elternteils (2ⁿ), dann Eizellen und Spermienzellen kombinieren."),
    solution: [{ math: `2^{${n}} \\cdot 2^{${n}} = ${g} \\cdot ${g} = ${value}`, note: tx(`${g} kinds of egg cells times ${g} kinds of sperm cells: **${value}** zygotes.`, `${g} Sorten Eizellen mal ${g} Sorten Spermienzellen: **${value}** Zygoten.`) }],
    mistakes: m.list,
  };
}

function recombTask(rng: Rng): Exercise {
  const kind = rng.pick(["combos", "combos", "prob", "zyg"] as const);
  if (kind === "prob") return probabilityExercise(rng.pick([4, 6, 8, 10]));
  if (kind === "zyg") return zygoteExercise(rng.pick([4, 6, 8]));
  const o = rng.pick(ORGANISMS.filter((x) => x.n2 <= 48));
  return rng.chance(0.4) ? combosExercise(rng.pick([4, 6, 8, 10, 12]), null) : combosExercise(o.n2, o.cells);
}

// ---------------------------------------------------------------------------
// Nondisjunction

function ndjCountExercise(when: "I" | "II", sex: "sperm" | "egg"): Exercise {
  const value = when === "I" ? 4 : 2;
  const m = mistakesFor(num(value));
  m.add(
    num(when === "I" ? 2 : 4),
    when === "I" ? tx("Meiosis I affects all four", "Meiose I trifft alle vier") : tx("Only one cell was affected", "Nur eine Zelle war betroffen"),
    when === "I"
      ? tx("If the homologues don't separate in meiosis I, one cell gets both and the other none. Both pass the error on in meiosis II: all four sex cells are faulty.", "Trennen sich die Homologen in der Meiose I nicht, bekommt eine Zelle beide und die andere keins. Beide geben den Fehler in der Meiose II weiter: Alle vier Keimzellen sind fehlerhaft.")
      : tx("In meiosis II only one of the two cells divides wrongly. The other cell makes two normal sex cells.", "In der Meiose II teilt sich nur eine der beiden Zellen falsch. Die andere Zelle bildet zwei normale Keimzellen."),
  );
  m.add(num(1), tx("Two faulty products", "Zwei fehlerhafte Produkte"), tx("A failed separation always makes one cell with an extra chromosome and one with one missing.", "Eine Fehlverteilung liefert immer eine Zelle mit einem Chromosom zu viel und eine mit einem zu wenig."));
  return {
    instruction: tx("Nondisjunction", "Fehlverteilung (Nondisjunction)"),
    text:
      when === "I"
        ? tx(
            `During the formation of four ${sex === "sperm" ? "sperm cells" : "cells (one egg cell and three polar bodies)"}, one pair of homologous chromosomes is not separated in meiosis I. How many of the four products have a wrong chromosome number?`,
            `Bei der Bildung von vier ${sex === "sperm" ? "Spermienzellen" : "Zellen (einer Eizelle und drei Polkörperchen)"} wird in der Meiose I ein Paar homologer Chromosomen nicht getrennt. Wie viele der vier Produkte haben eine falsche Chromosomenzahl?`,
          )
        : tx(
            `During the formation of four ${sex === "sperm" ? "sperm cells" : "cells (one egg cell and three polar bodies)"}, the sister chromatids of one chromosome are not separated in one of the two cells in meiosis II. How many of the four products have a wrong chromosome number?`,
            `Bei der Bildung von vier ${sex === "sperm" ? "Spermienzellen" : "Zellen (einer Eizelle und drei Polkörperchen)"} werden in der Meiose II in einer der beiden Zellen die Schwesterchromatiden eines Chromosoms nicht getrennt. Wie viele der vier Produkte haben eine falsche Chromosomenzahl?`,
          ),
    answer: num(value),
    hint: tx("Follow the faulty cell: after meiosis I there are two cells, each of them divides once more.", "Verfolge die fehlerhafte Zelle: Nach der Meiose I gibt es zwei Zellen, jede teilt sich noch einmal."),
    solution:
      when === "I"
        ? [
            { math: "n + 1 \\quad n - 1", note: tx("Meiosis I: one cell gets both homologues, the other none.", "Meiose I: Eine Zelle bekommt beide Homologen, die andere keins.") },
            { math: "n+1 , n+1 , n-1 , n-1", note: tx("Meiosis II copies the error into both daughter cells: **all 4** products are faulty.", "Die Meiose II gibt den Fehler an beide Tochterzellen weiter: **alle 4** Produkte sind fehlerhaft.") },
          ]
        : [{ math: "n+1 , n-1 , n , n", note: tx("Only the cell with the error makes faulty products: **2** of 4 (one n + 1, one n − 1); the other two are normal.", "Nur die Zelle mit dem Fehler bildet fehlerhafte Produkte: **2** von 4 (einmal n + 1, einmal n − 1); die anderen beiden sind normal.") }],
    mistakes: m.list,
  };
}

function ndjZygoteExercise(o: Organism, extra: 1 | -1): Exercise {
  const N = o.n2;
  const n = N / 2;
  const value = N + extra;
  const m = mistakesFor(num(value));
  m.add(num(N + 2 * extra), tx("Only one sex cell is faulty", "Nur eine Keimzelle ist fehlerhaft"), tx(`The male sex cell is normal (n = ${n}). Only the egg cell has ${extra > 0 ? "one too many" : "one too few"}.`, `Die männliche Keimzelle ist normal (n = ${n}). Nur die Eizelle hat ${extra > 0 ? "eins zu viel" : "eins zu wenig"}.`));
  m.add(num(N), tx("The error stays", "Der Fehler bleibt"), tx("The extra or missing chromosome doesn't disappear at fertilisation: it ends up in the zygote.", "Das zusätzliche oder fehlende Chromosom verschwindet bei der Befruchtung nicht: Es landet in der Zygote."));
  m.add(num(n + extra), tx("Add both sex cells", "Beide Keimzellen addieren"), tx("That's the egg cell. The zygote also gets the chromosomes of the male sex cell.", "Das ist die Eizelle. Die Zygote bekommt auch die Chromosomen der männlichen Keimzelle."));
  return {
    instruction: tx("Chromosomes of the zygote", "Chromosomen der Zygote"),
    text: txMap((t, l) =>
      t(
        `${resolveText(o.cells, l)} have 2n = ${N} chromosomes. Because of a nondisjunction, an egg cell has ${n + extra} chromosomes. It is fertilised by a normal male sex cell. How many chromosomes does the zygote have?`,
        `${resolveText(o.cells, l)} haben 2n = ${N} Chromosomen. Durch eine Nondisjunction hat eine Eizelle ${n + extra} Chromosomen. Sie wird von einer normalen männlichen Keimzelle befruchtet. Wie viele Chromosomen hat die Zygote?`,
      ),
    ),
    answer: num(value),
    hint: tx("Egg cell plus normal male sex cell (n).", "Eizelle plus normale männliche Keimzelle (n)."),
    solution: [
      {
        math: `(n ${extra > 0 ? "+" : "-"} 1) + n = ${n + extra} + ${n} = ${value}`,
        note: extra > 0 ? tx(`The zygote has ${value} chromosomes: a **trisomy** (2n + 1).`, `Die Zygote hat ${value} Chromosomen: eine **Trisomie** (2n + 1).`) : tx(`The zygote has ${value} chromosomes: a **monosomy** (2n − 1).`, `Die Zygote hat ${value} Chromosomen: eine **Monosomie** (2n − 1).`),
      },
    ],
    mistakes: m.list,
  };
}

type Gono = { result: string; right: [string, string]; wrong: [string, string, Text, Text][] };
const GONO: Gono[] = [
  {
    result: "47,XXY",
    right: ["X", "XY"],
    wrong: [
      ["XX", "X", tx("That gives XXX", "Das ergibt XXX"), tx("XX + X makes three X chromosomes and no Y: triple X, not XXY.", "XX + X ergibt drei X-Chromosomen und kein Y: Triple-X, nicht XXY.")],
      ["X", "YY", tx("That gives XYY", "Das ergibt XYY"), tx("X + YY makes XYY. For XXY you need two X chromosomes and one Y.", "X + YY ergibt XYY. Für XXY brauchst du zwei X und ein Y.")],
      ["0", "X", tx("That gives X0", "Das ergibt X0"), tx("An egg cell without a sex chromosome plus X gives 45,X: Turner syndrome.", "Eine Eizelle ohne Gonosom plus X ergibt 45,X: Turner-Syndrom.")],
    ],
  },
  {
    result: "47,XXY",
    right: ["XX", "Y"],
    wrong: [
      ["XX", "X", tx("That gives XXX", "Das ergibt XXX"), tx("XX + X makes three X chromosomes and no Y.", "XX + X ergibt drei X-Chromosomen und kein Y.")],
      ["X", "Y", tx("That's a normal boy", "Das ist ein normaler Junge"), tx("X + Y gives 46,XY. For XXY one sex cell needs an extra X.", "X + Y ergibt 46,XY. Für XXY braucht eine Keimzelle ein zusätzliches X.")],
      ["X", "YY", tx("That gives XYY", "Das ergibt XYY"), tx("X + YY makes XYY, not XXY.", "X + YY ergibt XYY, nicht XXY.")],
    ],
  },
  {
    result: "45,X",
    right: ["X", "0"],
    wrong: [
      ["X", "Y", tx("That's a normal boy", "Das ist ein normaler Junge"), tx("X + Y gives 46,XY. For 45,X one sex cell must lack a sex chromosome.", "X + Y ergibt 46,XY. Für 45,X muss einer Keimzelle das Gonosom fehlen.")],
      ["0", "Y", tx("Not viable", "Nicht lebensfähig"), tx("0 + Y would leave the embryo without any X chromosome. That is not viable.", "0 + Y ließe den Embryo ganz ohne X-Chromosom. Das ist nicht lebensfähig.")],
      ["XX", "0", tx("That gives XX", "Das ergibt XX"), tx("XX + 0 gives 46,XX: a normal number of sex chromosomes.", "XX + 0 ergibt 46,XX: eine normale Zahl an Gonosomen.")],
    ],
  },
  {
    result: "47,XXX",
    right: ["XX", "X"],
    wrong: [
      ["X", "XY", tx("That gives XXY", "Das ergibt XXY"), tx("X + XY makes XXY (Klinefelter), not XXX.", "X + XY ergibt XXY (Klinefelter), nicht XXX.")],
      ["X", "X", tx("That's a normal girl", "Das ist ein normales Mädchen"), tx("X + X gives 46,XX. For XXX one sex cell needs an extra X.", "X + X ergibt 46,XX. Für XXX braucht eine Keimzelle ein zusätzliches X.")],
      ["XX", "Y", tx("That gives XXY", "Das ergibt XXY"), tx("XX + Y makes XXY, not XXX.", "XX + Y ergibt XXY, nicht XXX.")],
    ],
  },
  {
    result: "47,XYY",
    right: ["X", "YY"],
    wrong: [
      ["XX", "Y", tx("That gives XXY", "Das ergibt XXY"), tx("XX + Y makes XXY (Klinefelter).", "XX + Y ergibt XXY (Klinefelter).")],
      ["X", "XY", tx("That gives XXY", "Das ergibt XXY"), tx("X + XY makes XXY, not XYY.", "X + XY ergibt XXY, nicht XYY.")],
      ["0", "YY", tx("No X at all", "Gar kein X"), tx("0 + YY has no X chromosome. That is not viable, and it isn't XYY either.", "0 + YY hat kein X-Chromosom. Das ist nicht lebensfähig und auch nicht XYY.")],
    ],
  },
];

const gonoText = (egg: string, sperm: string) => tx(`egg cell ${egg === "0" ? "without a sex chromosome" : egg} + sperm cell ${sperm === "0" ? "without a sex chromosome" : sperm}`, `Eizelle ${egg === "0" ? "ohne Gonosom" : egg} + Spermienzelle ${sperm === "0" ? "ohne Gonosom" : sperm}`);

function gonoTask(rng: Rng): Exercise {
  const g = rng.pick(GONO);
  const c = choice(rng, [{ text: gonoText(...g.right) }, ...g.wrong.map(([e, s, title, say]) => ({ text: gonoText(e, s), title, say }))]);
  return {
    instruction: tx("Origin of a karyotype", "Entstehung eines Karyotyps"),
    text: tx(`A child has the karyotype ${g.result}. Which sex cells can have fused?`, `Ein Kind hat den Karyotyp ${g.result}. Welche Keimzellen können verschmolzen sein?`),
    answer: c.answer,
    hint: tx("Add up the sex chromosomes of egg cell and sperm cell. Egg cells can only bring X (or none).", "Zähl die Gonosomen von Eizelle und Spermienzelle zusammen. Eizellen können nur X mitbringen (oder keins)."),
    solution: [{ math: tx(`"egg:" \\; "${g.right[0] === "0" ? "–" : g.right[0]}" \\quad "sperm:" \\; "${g.right[1] === "0" ? "–" : g.right[1]}" \\to "${g.result}"`, `"Eizelle:" \\; "${g.right[0] === "0" ? "–" : g.right[0]}" \\quad "Spermium:" \\; "${g.right[1] === "0" ? "–" : g.right[1]}" \\to "${g.result}"`), note: txMap((t, l) => `${resolveText(gonoText(...g.right), l)} → ${g.result}. ${t("One of the sex cells came from a meiosis with nondisjunction of the sex chromosomes.", "Eine der Keimzellen stammt aus einer Meiose mit Nondisjunction der Gonosomen.")}`) }],
    mistakes: c.mistakes,
  };
}

function ndjTask(rng: Rng): Exercise {
  const kind = rng.pick(["count", "zyg", "gono", "gono"] as const);
  if (kind === "count") return ndjCountExercise(rng.pick(["I", "II"] as const), rng.pick(["sperm", "egg"] as const));
  if (kind === "zyg") return ndjZygoteExercise(rng.pick(ORGANISMS), rng.pick([1, 1, -1] as const));
  return gonoTask(rng);
}

// ---------------------------------------------------------------------------
// Reading karyograms

const DIAG: Record<string, Text> = {
  t21: tx("trisomy 21 (Down syndrome)", "Trisomie 21 (Down-Syndrom)"),
  t18: tx("trisomy 18 (Edwards syndrome)", "Trisomie 18 (Edwards-Syndrom)"),
  t13: tx("trisomy 13 (Patau syndrome)", "Trisomie 13 (Pätau-Syndrom)"),
  turner: tx("Turner syndrome", "Turner-Syndrom"),
  kline: tx("Klinefelter syndrome", "Klinefelter-Syndrom"),
  xxx: tx("triple X syndrome", "Triple-X-Syndrom"),
  xyy: tx("XYY syndrome", "XYY-Syndrom"),
  normal: tx("no abnormality (normal karyotype)", "kein Befund (normaler Karyotyp)"),
};
const DIAG_OF: Record<Karyotype, string> = {
  "46,XX": "normal",
  "46,XY": "normal",
  "47,XX,+21": "t21",
  "47,XY,+21": "t21",
  "47,XY,+18": "t18",
  "47,XX,+13": "t13",
  "45,X": "turner",
  "47,XXY": "kline",
  "47,XXX": "xxx",
  "47,XYY": "xyy",
};
/** Which wrong diagnoses tempt for each right one, and why they're wrong. */
const DIAG_TRAPS: Record<string, [string, Text, Text][]> = {
  t21: [
    ["t18", tx("Count to the right pair", "Zähl bis zum richtigen Paar"), tx("Look at the numbers: the extra chromosome is one of the smallest, number 21, not 18.", "Schau auf die Nummern: Das zusätzliche Chromosom ist eins der kleinsten, Nummer 21, nicht 18.")],
    ["t13", tx("Count to the right pair", "Zähl bis zum richtigen Paar"), tx("Chromosome 13 is much bigger. The triple one here is number 21.", "Chromosom 13 ist viel größer. Dreifach ist hier Nummer 21.")],
  ],
  t18: [["t21", tx("Check the number", "Prüf die Nummer"), tx("There is a third chromosome, but look at its number: 18, not 21.", "Es gibt ein drittes Chromosom, aber schau auf die Nummer: 18, nicht 21.")]],
  t13: [["t21", tx("Check the number", "Prüf die Nummer"), tx("The triple chromosome is a big one from group D: number 13.", "Das dreifache Chromosom ist ein großes aus der Gruppe D: Nummer 13.")]],
  turner: [["normal", tx("Count the sex chromosomes", "Zähl die Gonosomen"), tx("Look at the end: there is only one X and no Y. That's 45 chromosomes.", "Schau ans Ende: Da ist nur ein X und kein Y. Das sind 45 Chromosomen.")]],
  kline: [
    ["xxx", tx("Look for the Y", "Such das Y"), tx("There are two X chromosomes, but also a Y: XXY, not XXX.", "Es gibt zwei X-Chromosomen, aber auch ein Y: XXY, nicht XXX.")],
    ["xyy", tx("Which one is doubled?", "Was ist doppelt?"), tx("Here the X is doubled, not the Y.", "Hier ist das X doppelt, nicht das Y.")],
  ],
  xxx: [["kline", tx("No Y here", "Hier ist kein Y"), tx("Three X chromosomes and no Y: that's triple X.", "Drei X-Chromosomen und kein Y: Das ist Triple-X.")]],
  xyy: [["kline", tx("Which one is doubled?", "Was ist doppelt?"), tx("Here the Y is doubled, not the X.", "Hier ist das Y doppelt, nicht das X.")]],
  normal: [["turner", tx("Count again", "Zähl noch mal"), tx("All 23 pairs are complete: 46 chromosomes, a normal karyotype.", "Alle 23 Paare sind vollständig: 46 Chromosomen, ein normaler Karyotyp.")]],
};

function karyoExercise(k: Karyotype, rng: Rng | null): Exercise {
  const d = DIAG_OF[k];
  const traps = DIAG_TRAPS[d].map(([id, title, say]) => ({ text: DIAG[id], title, say }));
  const pool = Object.keys(DIAG).filter((id) => id !== d && !DIAG_TRAPS[d].some((x) => x[0] === id));
  const fill = (rng ? rng.shuffle(pool) : pool).slice(0, 3 - traps.length).map((id) => ({ text: DIAG[id] }));
  const c = choice(rng, [{ text: DIAG[d] }, ...traps, ...fill]);
  const total = k.split(",")[0];
  return {
    instruction: tx("Read the karyogram", "Werte das Karyogramm aus"),
    text: tx("What does this karyogram show?", "Was zeigt dieses Karyogramm?"),
    visual: visual(DivisionKaryogram, { karyotype: k }),
    answer: c.answer,
    hint: tx("Check three things: how many chromosomes in total? Which sex chromosomes? Is any chromosome there three times?", "Prüf drei Dinge: Wie viele Chromosomen insgesamt? Welche Gonosomen? Ist ein Chromosom dreimal da?"),
    solution: [
      { math: tx(`${total} "chromosomes"`, `${total} "Chromosomen"`), note: tx(`Counting gives ${total} chromosomes.`, `Zählen ergibt ${total} Chromosomen.`) },
      { math: tx(`"karyotype" \\; "${k}"`, `"Karyotyp" \\; "${k}"`), note: txMap((t, l) => `${t("Karyotype", "Karyotyp")} ${k}: **${resolveText(DIAG[d], l)}**.`) },
    ],
    mistakes: c.mistakes,
  };
}

const FORMULA_TRAPS = (k: Karyotype): [string, Text, Text][] => {
  const out: [string, Text, Text][] = [];
  const [total, sex, extra] = k.split(",");
  const other = sex === "XX" ? "XY" : sex === "XY" ? "XX" : null;
  if (other) out.push([[total, other, ...(extra ? [extra] : [])].join(","), tx("Check the sex chromosomes", "Prüf die Gonosomen"), tx(`Look at the end of the karyogram: the sex chromosomes are ${sex}.`, `Schau ans Ende des Karyogramms: Die Gonosomen sind ${sex}.`)]);
  if (extra) out.push([`46,${sex}`, tx("One too many", "Eins zu viel"), tx("Count again: there are 47 chromosomes. One chromosome is there three times.", "Zähl noch mal: Es sind 47 Chromosomen. Ein Chromosom ist dreimal da.")]);
  if (extra) out.push([`47,${sex},+${extra === "+21" ? "18" : "21"}`, tx("Which chromosome?", "Welches Chromosom?"), tx("Look closely which pair has a third chromosome.", "Schau genau, bei welchem Paar ein drittes Chromosom liegt.")]);
  if (!extra && k !== "46,XX" && k !== "46,XY") out.push([sex.length > 2 ? `46,${sex.slice(0, 2)}` : "46,XX", tx("Count the sex chromosomes", "Zähl die Gonosomen"), tx("Count the sex chromosomes at the end one by one.", "Zähl die Gonosomen am Ende einzeln.")]);
  return out;
};

function formulaExercise(k: Karyotype, rng: Rng): Exercise {
  const traps = FORMULA_TRAPS(k).filter(([f], i, a) => f !== k && a.findIndex((x) => x[0] === f) === i);
  const pool = (KARYOTYPES as string[]).filter((f) => f !== k && !traps.some((t) => t[0] === f));
  const f$ = (f: string) => `$"${f}"$`;
  const opts: Opt[] = [{ text: f$(k) }, ...traps.slice(0, 3).map(([f, title, say]) => ({ text: f$(f), title, say })), ...rng.shuffle(pool).slice(0, Math.max(0, 3 - traps.length)).map((f) => ({ text: f$(f) }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Karyotype formula", "Karyotyp-Formel"),
    text: tx("Which karyotype formula describes this karyogram?", "Welche Karyotyp-Formel beschreibt dieses Karyogramm?"),
    visual: visual(DivisionKaryogram, { karyotype: k }),
    answer: c.answer,
    hint: tx("The formula is: total number, sex chromosomes, then any extra chromosome with +.", "Die Formel lautet: Gesamtzahl, Gonosomen, dann ein zusätzliches Chromosom mit +."),
    solution: [{ math: tx(`"karyotype" \\; "${k}"`, `"Karyotyp" \\; "${k}"`), note: txMap((t, l) => `${t("Total number, sex chromosomes and extra chromosome", "Gesamtzahl, Gonosomen und zusätzliches Chromosom")}: **${k}**, ${resolveText(DIAG[DIAG_OF[k]], l)}.`) }],
    mistakes: c.mistakes,
  };
}

function karyoTask(rng: Rng): Exercise {
  const k = rng.pick(KARYOTYPES);
  return rng.chance(0.6) ? karyoExercise(k, rng) : formulaExercise(k, rng);
}

// ---------------------------------------------------------------------------
// Which phase of meiosis?

type MPic = { kind: DivisionKind; stage: Stage; name: Text; why: Text };
const MPICS: Record<string, MPic> = {
  pro1: { kind: "meiosis", stage: "pro1", name: tx("prophase I", "Prophase I"), why: tx("Homologous chromosomes lie side by side as bivalents, the nuclear envelope is breaking down.", "Homologe Chromosomen liegen als Bivalente nebeneinander, die Kernhülle löst sich auf.") },
  meta1: { kind: "meiosis", stage: "meta1", name: tx("metaphase I", "Metaphase I"), why: tx("Bivalents (pairs of homologues) are lined up in the equatorial plane.", "Bivalente (Homologenpaare) stehen in der Äquatorialebene.") },
  ana1: { kind: "meiosis", stage: "ana1", name: tx("anaphase I", "Anaphase I"), why: tx("Whole two-chromatid chromosomes move to the poles: the homologues are being separated.", "Ganze Zwei-Chromatid-Chromosomen wandern zu den Polen: Die Homologen werden getrennt.") },
  meta2: { kind: "meiosis", stage: "meta2", name: tx("metaphase II", "Metaphase II"), why: tx("Two cells, each with n two-chromatid chromosomes in the equatorial plane.", "Zwei Zellen mit je n Zwei-Chromatid-Chromosomen in der Äquatorialebene.") },
  ana2: { kind: "meiosis", stage: "ana2", name: tx("anaphase II", "Anaphase II"), why: tx("In two cells at once the sister chromatids are pulled apart.", "In zwei Zellen gleichzeitig werden die Schwesterchromatiden getrennt.") },
  telo2: { kind: "meiosis", stage: "telo2", name: tx("telophase II", "Telophase II"), why: tx("Four haploid cells with one-chromatid chromosomes.", "Vier haploide Zellen mit Ein-Chromatid-Chromosomen.") },
  meta: { kind: "mitosis", stage: "meta", name: tx("metaphase of mitosis", "Metaphase der Mitose"), why: tx("Each two-chromatid chromosome lines up on its own in the equatorial plane; the homologues are not paired.", "Jedes Zwei-Chromatid-Chromosom steht einzeln in der Äquatorialebene, die Homologen sind nicht gepaart.") },
  ana: { kind: "mitosis", stage: "ana", name: tx("anaphase of mitosis", "Anaphase der Mitose"), why: tx("One cell with 2n chromosomes: sister chromatids (V shapes) move to the poles.", "Eine Zelle mit 2n Chromosomen: Schwesterchromatiden (V-Formen) wandern zu den Polen.") },
};
const MPIC_TRAPS: Record<string, [string, Text, Text][]> = {
  meta1: [["meta", tx("Look for pairs", "Achte auf Paare"), tx("In mitosis every chromosome lines up on its own. Here the homologues lie side by side as pairs: bivalents.", "In der Mitose steht jedes Chromosom einzeln. Hier liegen die Homologen als Paare nebeneinander: Bivalente.")]],
  meta: [
    ["meta1", tx("No pairs here", "Hier gibt es keine Paare"), tx("In metaphase I the homologues lie side by side as bivalents. Here every chromosome stands on its own.", "In der Metaphase I liegen die Homologen als Bivalente nebeneinander. Hier steht jedes Chromosom einzeln.")],
    ["meta2", tx("One cell, 2n", "Eine Zelle, 2n"), tx("In metaphase II there are two cells with n chromosomes each. Here one cell holds both chromosomes of every pair.", "In der Metaphase II gibt es zwei Zellen mit je n Chromosomen. Hier enthält eine Zelle beide Chromosomen jedes Paares.")],
  ],
  meta2: [["meta", tx("Two cells, n each", "Zwei Zellen mit je n"), tx("There are two cells, and each has only one chromosome of every pair: that's already the second meiotic division.", "Es sind zwei Zellen, und jede hat von jedem Paar nur ein Chromosom: Das ist schon die zweite Reifeteilung.")]],
  ana1: [["ana", tx("Whole chromosomes move", "Ganze Chromosomen wandern"), tx("In anaphase of mitosis single chromatids (V shapes) move. Here whole two-chromatid chromosomes are moving: the homologues are separated.", "In der Anaphase der Mitose wandern einzelne Chromatiden (V-Formen). Hier wandern ganze Zwei-Chromatid-Chromosomen: Die Homologen werden getrennt.")]],
  ana: [["ana1", tx("Chromatids move", "Chromatiden wandern"), tx("In anaphase I whole two-chromatid chromosomes move. Here the sister chromatids are separated, in a single diploid cell.", "In der Anaphase I wandern ganze Zwei-Chromatid-Chromosomen. Hier werden Schwesterchromatiden getrennt, in einer einzigen diploiden Zelle.")]],
  ana2: [["ana", tx("Two cells at once", "Zwei Zellen gleichzeitig"), tx("Two cells divide at the same time, and each has only n chromosomes: anaphase II.", "Zwei Zellen teilen sich gleichzeitig, und jede hat nur n Chromosomen: Anaphase II.")]],
  pro1: [["meta1", tx("Not lined up yet", "Noch nicht angeordnet"), tx("The bivalents are still in the region of the nucleus, not in the equatorial plane.", "Die Bivalente liegen noch im Bereich des Kerns, nicht in der Äquatorialebene.")]],
  telo2: [["ana2", tx("Already four cells", "Schon vier Zellen"), tx("The division is finished: four cells with their own nuclei.", "Die Teilung ist abgeschlossen: vier Zellen mit eigenen Kernen.")]],
};

function meiosisPicExercise(id: string, n2: ModelSize, rng: Rng | null): Exercise {
  const p = MPICS[id];
  const traps = (MPIC_TRAPS[id] ?? []).map(([w, title, say]) => ({ text: MPICS[w].name, title, say }));
  const pool = Object.keys(MPICS).filter((x) => x !== id && !(MPIC_TRAPS[id] ?? []).some((t) => t[0] === x));
  const fill = (rng ? rng.shuffle(pool) : pool).slice(0, 3 - traps.length).map((x) => ({ text: MPICS[x].name }));
  const c = choice(rng, [{ text: p.name }, ...traps, ...fill]);
  return {
    instruction: tx("Name the phase", "Benenne die Phase"),
    text: tx(`Which phase does the picture show? (Model cells with 2n = ${n2}; red: maternal, blue: paternal chromosomes.)`, `Welche Phase zeigt das Bild? (Modellzellen mit 2n = ${n2}; rot: mütterliche, blau: väterliche Chromosomen.)`),
    visual: visual(DivisionPhase, { kind: p.kind, stage: p.stage, n2, crossing: p.kind === "meiosis" }),
    answer: c.answer,
    hint: tx("How many cells? Are homologues paired? Do whole chromosomes or single chromatids move?", "Wie viele Zellen? Liegen Homologe gepaart? Wandern ganze Chromosomen oder einzelne Chromatiden?"),
    solution: [{ math: tx(`"${en(p.name)}"`, `"${de(p.name)}"`), note: p.why }],
    mistakes: c.mistakes,
  };
}

const meiosisPicTask = (rng: Rng) => meiosisPicExercise(rng.pick(["pro1", "meta1", "meta1", "ana1", "ana1", "meta2", "ana2", "telo2", "meta", "ana"]), rng.pick([4, 6] as const), rng);

// ---------------------------------------------------------------------------
// Cell cycle control and cancer

const CONTROL_TRUE: Text[] = [
  tx("p53 can stop the cell cycle at the G1 checkpoint when the DNA is damaged.", "p53 kann den Zellzyklus am G1-Kontrollpunkt anhalten, wenn die DNA geschädigt ist."),
  tx("If DNA damage cannot be repaired, p53 can trigger apoptosis.", "Lässt sich ein DNA-Schaden nicht reparieren, kann p53 die Apoptose auslösen."),
  tx("At the spindle checkpoint the cell checks whether every chromosome is attached to spindle fibres.", "Am Spindelkontrollpunkt prüft die Zelle, ob jedes Chromosom an Spindelfasern hängt."),
  tx("Cancer usually arises from several mutations in proto-oncogenes and tumour suppressor genes.", "Krebs entsteht meist durch mehrere Mutationen in Proto-Onkogenen und Tumorsuppressorgenen."),
  tx("Cells in the G0 phase have left the cell cycle and no longer divide.", "Zellen in der G0-Phase haben den Zellzyklus verlassen und teilen sich nicht mehr."),
  tx("At the G2 checkpoint the cell checks whether the DNA has been replicated completely.", "Am G2-Kontrollpunkt prüft die Zelle, ob die DNA vollständig repliziert ist."),
];
const CONTROL_FALSE: Opt[] = [
  { text: tx("p53 is an oncogene that drives cell division.", "p53 ist ein Onkogen, das die Zellteilung antreibt."), title: tx("p53 is a brake", "p53 ist eine Bremse"), say: tx("p53 is a tumour suppressor: it brakes the cell cycle. Oncogenes are mutated proto-oncogenes, like a stuck accelerator.", "p53 ist ein Tumorsuppressor: Es bremst den Zellzyklus. Onkogene sind mutierte Proto-Onkogene, wie ein klemmendes Gaspedal.") },
  { text: tx("A mutated p53 protects the cell especially well against cancer.", "Ein mutiertes p53 schützt die Zelle besonders gut vor Krebs."), title: tx("Broken brake", "Kaputte Bremse"), say: tx("A mutated p53 no longer works: damaged cells are no longer stopped. That makes cancer more likely.", "Ein mutiertes p53 funktioniert nicht mehr: Geschädigte Zellen werden nicht mehr gestoppt. Das macht Krebs wahrscheinlicher.") },
  { text: tx("Apoptosis means a cell dies by accident, for example from an injury.", "Apoptose bedeutet, dass eine Zelle zufällig stirbt, zum Beispiel durch eine Verletzung."), title: tx("Programmed, not an accident", "Programmiert, kein Unfall"), say: tx("Apoptosis is programmed cell death: the cell takes itself apart in an orderly way. Death by injury is necrosis.", "Apoptose ist der programmierte Zelltod: Die Zelle baut sich geordnet selbst ab. Der Tod durch Verletzung heißt Nekrose.") },
  { text: tx("At the checkpoints the DNA is replicated.", "An den Kontrollpunkten wird die DNA repliziert."), title: tx("Checking, not copying", "Prüfen, nicht kopieren"), say: tx("Checkpoints only check (size, DNA damage, replication, spindle). The DNA is replicated in the S phase.", "Kontrollpunkte prüfen nur (Größe, DNA-Schäden, Replikation, Spindel). Repliziert wird in der S-Phase.") },
  { text: tx("One single mutation is almost always enough for cancer.", "Eine einzige Mutation reicht fast immer für Krebs aus."), title: tx("Several steps", "Mehrere Schritte"), say: tx("Usually several mutations have to come together (multi-step model): accelerator stuck and brakes broken.", "Meist müssen mehrere Mutationen zusammenkommen (Mehrschritt-Modell): Gaspedal klemmt und Bremsen versagen.") },
  { text: tx("Benign tumours form metastases.", "Gutartige Tumoren bilden Metastasen."), title: tx("Only malignant ones", "Nur bösartige"), say: tx("Metastases (secondary tumours) are formed by malignant tumours, whose cells spread through blood and lymph.", "Metastasen (Tochtergeschwülste) bilden bösartige Tumoren, deren Zellen über Blut und Lymphe streuen.") },
  { text: tx("Cancer cells divide because they have especially many chromosomes.", "Krebszellen teilen sich, weil sie besonders viele Chromosomen haben."), title: tx("Lost control", "Kontrolle verloren"), say: tx("Cancer cells divide because the control of the cell cycle has failed through mutations, not because of their chromosome number.", "Krebszellen teilen sich, weil die Kontrolle des Zellzyklus durch Mutationen ausgefallen ist, nicht wegen ihrer Chromosomenzahl.") },
];

function controlTask(rng: Rng): Exercise {
  const right = rng.pick(CONTROL_TRUE);
  const c = choice(rng, [{ text: right }, ...some(rng, CONTROL_FALSE, 3)]);
  return {
    instruction: tx("Which statement is true?", "Welche Aussage stimmt?"),
    text: tx("Cell cycle control and cancer: only one statement is true.", "Kontrolle des Zellzyklus und Krebs: Nur eine Aussage ist richtig."),
    answer: c.answer,
    hint: tx("Proto-oncogenes are the accelerator, tumour suppressor genes like p53 the brake.", "Proto-Onkogene sind das Gaspedal, Tumorsuppressorgene wie p53 die Bremse."),
    solution: [{ math: '"p53"', note: right }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Reading the DNA graph

type GraphQ = { kind: DivisionKind; labels: boolean; q: Text; right: Text; wrong: Opt[]; why: Text };
const GRAPH_QS: GraphQ[] = [
  {
    kind: "meiosis",
    labels: false,
    q: tx("Which process does the graph of the DNA content per cell show?", "Welchen Vorgang zeigt die Grafik zum DNA-Gehalt pro Zelle?"),
    right: tx("meiosis (after replication)", "Meiose (nach der Replikation)"),
    wrong: [
      { text: tx("mitosis (after replication)", "Mitose (nach der Replikation)"), title: tx("Two drops", "Zwei Abfälle"), say: tx("Mitosis only goes back down to 2c once. Here the content halves twice, down to 1c: that's meiosis.", "Die Mitose geht nur einmal zurück auf 2c. Hier halbiert sich der Gehalt zweimal bis auf 1c: Das ist die Meiose.") },
      { text: tx("fertilisation", "Befruchtung"), title: tx("Fertilisation adds", "Befruchtung addiert"), say: tx("Fertilisation would raise the DNA content (1c + 1c = 2c), not halve it.", "Eine Befruchtung würde den DNA-Gehalt erhöhen (1c + 1c = 2c), nicht halbieren.") },
      { text: tx("two mitoses in a row", "zwei Mitosen nacheinander") },
    ],
    why: tx("Rise from 2c to 4c (S phase), then two halvings without replication in between, down to 1c: meiosis.", "Anstieg von 2c auf 4c (S-Phase), dann zwei Halbierungen ohne Replikation dazwischen bis auf 1c: Meiose."),
  },
  {
    kind: "mitosis",
    labels: false,
    q: tx("Which process does the graph of the DNA content per cell show?", "Welchen Vorgang zeigt die Grafik zum DNA-Gehalt pro Zelle?"),
    right: tx("a cell cycle with mitosis", "ein Zellzyklus mit Mitose"),
    wrong: [
      { text: tx("meiosis", "Meiose"), title: tx("Only one drop", "Nur ein Abfall"), say: tx("Meiosis would halve twice, down to 1c. Here the content only goes back to 2c: mitosis.", "Die Meiose würde zweimal halbieren, bis auf 1c. Hier geht der Gehalt nur zurück auf 2c: Mitose.") },
      { text: tx("fertilisation", "Befruchtung") },
      { text: tx("crossing over", "Crossing-over"), title: tx("No change in amount", "Keine Mengenänderung"), say: tx("Crossing over swaps pieces between chromatids. The amount of DNA stays the same.", "Beim Crossing-over werden Stücke zwischen Chromatiden getauscht. Die DNA-Menge bleibt gleich.") },
    ],
    why: tx("Rise from 2c to 4c (replication in the S phase), then one drop back to 2c (mitosis and cytokinesis).", "Anstieg von 2c auf 4c (Replikation in der S-Phase), dann ein Abfall zurück auf 2c (Mitose und Cytokinese)."),
  },
  {
    kind: "meiosis",
    labels: true,
    q: tx("What causes the rise from 2c to 4c?", "Wodurch kommt der Anstieg von 2c auf 4c zustande?"),
    right: tx("replication of the DNA in the S phase", "Replikation der DNA in der S-Phase"),
    wrong: [
      { text: tx("pairing of the homologues", "Paarung der Homologen"), title: tx("Pairing adds no DNA", "Paarung bringt keine DNA"), say: tx("Pairing only puts the homologues side by side. New DNA is made by replication.", "Bei der Paarung legen sich die Homologen nur nebeneinander. Neue DNA entsteht durch Replikation.") },
      { text: tx("condensing of the chromosomes", "Kondensation der Chromosomen"), title: tx("Packing isn't copying", "Verpacken ist nicht kopieren"), say: tx("Condensing packs the DNA more tightly, it doesn't make more of it.", "Beim Kondensieren wird die DNA nur dichter verpackt, nicht vermehrt.") },
      { text: tx("crossing over", "Crossing-over") },
    ],
    why: tx("In the S phase every DNA molecule is replicated: 2c → 4c, and every chromosome gets a second chromatid.", "In der S-Phase wird jedes DNA-Molekül repliziert: 2c → 4c, jedes Chromosom bekommt ein zweites Chromatid."),
  },
  {
    kind: "meiosis",
    labels: true,
    q: tx("What causes the first drop from 4c to 2c?", "Wodurch kommt der erste Abfall von 4c auf 2c zustande?"),
    right: tx("separation of the homologous chromosomes into two cells (meiosis I)", "Trennung der homologen Chromosomen auf zwei Zellen (Meiose I)"),
    wrong: [
      { text: tx("separation of the sister chromatids (meiosis II)", "Trennung der Schwesterchromatiden (Meiose II)"), title: tx("That's the second drop", "Das ist der zweite Abfall"), say: tx("The sister chromatids are separated in meiosis II, the second drop. The first one is the reduction division.", "Die Schwesterchromatiden werden in der Meiose II getrennt, beim zweiten Abfall. Der erste ist die Reduktionsteilung.") },
      { text: tx("crossing over", "Crossing-over"), title: tx("No change in amount", "Keine Mengenänderung"), say: tx("Crossing over swaps pieces, the amount of DNA stays the same.", "Beim Crossing-over werden Stücke getauscht, die DNA-Menge bleibt gleich.") },
      { text: tx("breakdown of DNA", "Abbau von DNA") },
    ],
    why: tx("Anaphase I and cytokinesis: the homologues go into two cells. Each cell is haploid with two-chromatid chromosomes: n, 2c.", "Anaphase I und Cytokinese: Die Homologen kommen in zwei Zellen. Jede Zelle ist haploid mit Zwei-Chromatid-Chromosomen: n, 2c."),
  },
  {
    kind: "meiosis",
    labels: true,
    q: tx("What causes the second drop from 2c to 1c?", "Wodurch kommt der zweite Abfall von 2c auf 1c zustande?"),
    right: tx("separation of the sister chromatids (meiosis II)", "Trennung der Schwesterchromatiden (Meiose II)"),
    wrong: [
      { text: tx("separation of the homologous chromosomes (meiosis I)", "Trennung der homologen Chromosomen (Meiose I)"), title: tx("That's the first drop", "Das ist der erste Abfall"), say: tx("The homologues were already separated in meiosis I, at the first drop.", "Die Homologen wurden schon in der Meiose I getrennt, beim ersten Abfall.") },
      { text: tx("fertilisation", "Befruchtung") },
      { text: tx("a second replication", "eine zweite Replikation"), title: tx("Replication raises", "Replikation erhöht"), say: tx("Replication would raise the DNA content. Before meiosis II there isn't one.", "Eine Replikation würde den DNA-Gehalt erhöhen. Vor der Meiose II gibt es keine.") },
    ],
    why: tx("Anaphase II: the sister chromatids are separated, four cells with n, 1c form.", "Anaphase II: Die Schwesterchromatiden werden getrennt, es entstehen vier Zellen mit n, 1c."),
  },
];

function graphTask(rng: Rng): Exercise {
  const g = rng.pick(GRAPH_QS);
  const c = choice(rng, [{ text: g.right }, ...g.wrong]);
  return {
    instruction: tx("Read the graph", "Werte die Grafik aus"),
    text: g.q,
    visual: visual(DivisionDnaGraph, { kind: g.kind, labels: g.labels, className: "mx-auto block h-auto w-full max-w-[420px]" }),
    answer: c.answer,
    hint: tx("Rises mean replication, drops mean that DNA is shared between two cells.", "Anstiege bedeuten Replikation, Abfälle bedeuten, dass DNA auf zwei Zellen verteilt wird."),
    solution: [{ math: g.kind === "meiosis" ? "2c \\to 4c \\to 2c \\to 1c" : "2c \\to 4c \\to 2c", note: g.why }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [1.4, () => cTask(rng)],
    [1.1, () => ncTask(rng)],
    [1.2, () => meiosisCountTask(rng)],
    [1.1, () => recombTask(rng)],
    [1.3, () => ndjTask(rng)],
    [1.3, () => karyoTask(rng)],
    [1.2, () => meiosisPicTask(rng)],
    [0.9, () => controlTask(rng)],
    [0.8, () => graphTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

function MeiosisWidget() {
  return <DivisionScrubber kind="meiosis" depth={3} />;
}


export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Meiosis I: the reduction division", "Meiose I: die Reduktionsteilung"),
      blob: tx("Meiosis in Abitur detail. Let's go!", "Meiose in Abitur-Tiefe. Los geht's!"),
      body: tx(
        "Meiosis consists of two divisions with no replication in between. In **meiosis I** it isn't chromatids that are separated, but **homologous chromosomes**. That's why it is called the **reduction division**.",
        "Die Meiose besteht aus zwei Teilungen ohne Replikation dazwischen. In der **Meiose I** werden nicht Chromatiden, sondern **homologe Chromosomen** getrennt. Darum heißt sie **Reduktionsteilung**.",
      ),
      frames: [
        {
          math: tx('"prophase I:" \\; "bivalent"', '"Prophase I:" \\; "Bivalent"'),
          note: tx("The homologous chromosomes pair up along their whole length (synapsis) and form **bivalents**: tetrads of four chromatids.", "Die homologen Chromosomen lagern sich der Länge nach aneinander (Synapsis) und bilden **Bivalente**: Tetraden aus vier Chromatiden."),
        },
        {
          math: tx('"chiasma" \\to "crossing over"', '"Chiasma" \\to "Crossing-over"'),
          note: tx("Non-sister chromatids cross at **chiasmata**. There they break and exchange matching segments: **crossing over**.", "Nicht-Schwesterchromatiden überkreuzen sich an **Chiasmata**. Dort brechen sie und tauschen einander entsprechende Abschnitte aus: **Crossing-over**."),
        },
        {
          math: tx('"metaphase I:" \\; "bivalents in the plane"', '"Metaphase I:" \\; "Bivalente in der Ebene"'),
          note: tx("The bivalents line up in the equatorial plane. The spindle fibres from one pole attach to both chromatids of one homologue.", "Die Bivalente ordnen sich in der Äquatorialebene an. Die Spindelfasern eines Pols setzen an beiden Chromatiden eines Homologs an."),
        },
        {
          math: tx('"anaphase I:" \\; "homologues apart"', '"Anaphase I:" \\; "Homologe trennen sich"'),
          note: tx("The homologues are separated; the sister chromatids stay joined at the centromere. Which homologue goes to which pole is random.", "Die Homologen werden getrennt, die Schwesterchromatiden bleiben am Zentromer verbunden. Welches Homolog zu welchem Pol wandert, ist zufällig."),
        },
        {
          math: tx('"telophase I:" \\; 2n , 4c \\to n , 2c', '"Telophase I:" \\; 2n , 4c \\to n , 2c'),
          note: tx("Two haploid cells (n), every chromosome still with two chromatids: DNA content 2c.", "Zwei haploide Zellen (n), jedes Chromosom noch mit zwei Chromatiden: DNA-Gehalt 2c."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Meiosis step by step", "Meiose Schritt für Schritt"),
      blob: tx("Look out for the purple rings in prophase I!", "Achte auf die lila Ringe in der Prophase I!"),
      body: tx(
        "Red: chromosomes from the mother, blue: from the father. Watch the chiasmata in prophase I and how the colours are mixed in the four cells at the end. The counter shows n and c.",
        "Rot: Chromosomen der Mutter, blau: des Vaters. Achte auf die Chiasmata in der Prophase I und darauf, wie die Farben in den vier Zellen am Ende gemischt sind. Der Zähler zeigt n und c.",
      ),
      widget: MeiosisWidget,
    },
    {
      type: "explain",
      title: tx("Meiosis II and the DNA content", "Meiose II und der DNA-Gehalt"),
      blob: tx("Now we count like in the Abitur: with n and c.", "Jetzt zählen wir wie im Abitur: mit n und c."),
      body: tx(
        "**n** is the number of chromosome sets, **c** the amount of DNA. 1c is the DNA content of one chromosome set made of one-chromatid chromosomes. **Meiosis II** is the **equational division**: like mitosis, it separates the sister chromatids.",
        "**n** steht für die Zahl der Chromosomensätze, **c** für die DNA-Menge. 1c ist der DNA-Gehalt eines Chromosomensatzes aus Ein-Chromatid-Chromosomen. Die **Meiose II** ist die **Äquationsteilung**: Wie die Mitose trennt sie die Schwesterchromatiden.",
      ),
      frames: [
        { math: '"G1:" \\; 2n , 2c', note: tx("Before replication: diploid, one-chromatid chromosomes.", "Vor der Replikation: diploid, Ein-Chromatid-Chromosomen.") },
        { math: '"G2:" \\; 2n , 4c', note: tx("After the S phase the DNA content has doubled; the chromosome set stays 2n.", "Nach der S-Phase hat sich der DNA-Gehalt verdoppelt, der Chromosomensatz bleibt 2n.") },
        { math: tx('"meiosis I:" \\; 2n , 4c \\to n , 2c', '"Meiose I:" \\; 2n , 4c \\to n , 2c'), note: tx("Reduction division: half the chromosome set, half the DNA content.", "Reduktionsteilung: halber Chromosomensatz, halber DNA-Gehalt.") },
        { math: tx('"meiosis II:" \\; n , 2c \\to n , 1c', '"Meiose II:" \\; n , 2c \\to n , 1c'), note: tx("Equational division: the chromatids are separated, the chromosome set stays n. No S phase before it!", "Äquationsteilung: Die Chromatiden werden getrennt, der Chromosomensatz bleibt n. Davor keine S-Phase!") },
        { math: tx('"mitosis:" \\; 2n , 4c \\to 2n , 2c', '"Mitose:" \\; 2n , 4c \\to 2n , 2c'), note: tx("For comparison, mitosis: chromatids are separated, the set stays 2n.", "Zum Vergleich die Mitose: Chromatiden werden getrennt, der Satz bleibt 2n.") },
      ],
    },
    {
      type: "check",
      blob: tx("Follow the c value step by step.", "Verfolge den c-Wert Schritt für Schritt."),
      exercise: cExercise(6, "meta2"),
    },
    {
      type: "explain",
      title: tx("Recombination: why every sex cell is unique", "Rekombination: Warum jede Keimzelle einzigartig ist"),
      blob: tx("Time for some big numbers.", "Zeit für ein paar große Zahlen."),
      frames: [
        {
          math: tx('"interchromosomal recombination"', '"interchromosomale Rekombination"'),
          note: tx("**Interchromosomal recombination**: in metaphase I every bivalent faces either way by chance. The maternal and paternal chromosomes are distributed independently of each other.", "**Interchromosomale Rekombination**: In der Metaphase I liegt jedes Bivalent zufällig so oder so herum. Die mütterlichen und väterlichen Chromosomen werden unabhängig voneinander verteilt."),
        },
        { math: "2^n", note: tx("With n pairs of chromosomes there are $2^n$ possible combinations.", "Bei n Chromosomenpaaren gibt es $2^n$ mögliche Kombinationen.") },
        { math: "2^{23} = 8388608", note: tx("In humans: about 8.4 million different sex cells just from the distribution.", "Beim Menschen: rund 8,4 Millionen verschiedene Keimzellen allein durch die Verteilung.") },
        { math: tx('2^{23} \\cdot 2^{23} \\approx 7 \\cdot 10^{13}', '2^{23} \\cdot 2^{23} \\approx 7 \\cdot 10^{13}'), note: tx("At fertilisation one of 2²³ egg cells meets one of 2²³ sperm cells: about 70 trillion possible zygotes.", "Bei der Befruchtung trifft eine von 2²³ Eizellen auf eine von 2²³ Spermienzellen: rund 70 Billionen mögliche Zygoten.") },
        {
          math: tx('"intrachromosomal recombination"', '"intrachromosomale Rekombination"'),
          note: tx("**Intrachromosomal recombination**: crossing over recombines the alleles on one chromosome. Together, practically every sex cell is unique.", "**Intrachromosomale Rekombination**: Durch Crossing-over werden die Allele auf einem Chromosom neu kombiniert. Zusammen wird praktisch jede Keimzelle einzigartig."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The distribution lottery", "Das Verteilungslotto"),
      blob: tx("Can you find all 8 combinations?", "Findest du alle 8 Kombinationen?"),
      body: tx(
        "A model cell with 2n = 6 in metaphase I. Flip the pairs or let chance decide, and collect all combinations of sex cells. Then add crossing over.",
        "Eine Modellzelle mit 2n = 6 in der Metaphase I. Dreh die Paare um oder lass den Zufall entscheiden und sammle alle Kombinationen von Keimzellen. Nimm dann das Crossing-over dazu.",
      ),
      widget: DivisionAssortment,
    },
    {
      type: "check",
      blob: tx("Now with a bit more chromosomes.", "Jetzt mit ein paar Chromosomen mehr."),
      exercise: combosExercise(8, null),
    },
    {
      type: "explain",
      title: tx("When chromosomes don't separate: nondisjunction", "Wenn Chromosomen sich nicht trennen: Nondisjunction"),
      blob: tx("Sometimes meiosis makes a mistake. Here's what follows.", "Manchmal passiert in der Meiose ein Fehler. Das sind die Folgen."),
      body: tx(
        "If chromosomes are not separated in meiosis (**nondisjunction**), sex cells with one chromosome too many (n + 1) or too few (n − 1) form. After fertilisation the zygote has 47 or 45 chromosomes: a **numerical chromosome aberration** (genome mutation).",
        "Werden Chromosomen in der Meiose nicht getrennt (**Nondisjunction**), entstehen Keimzellen mit einem Chromosom zu viel (n + 1) oder zu wenig (n − 1). Nach der Befruchtung hat die Zygote 47 oder 45 Chromosomen: eine **numerische Chromosomenaberration** (Genommutation).",
      ),
      frames: [
        { math: tx('"meiosis I:" \\; n+1 , n+1 , n-1 , n-1', '"Meiose I:" \\; n+1 , n+1 , n-1 , n-1'), note: tx("Error in meiosis I (homologues not separated): **all four** sex cells are faulty.", "Fehler in der Meiose I (Homologe nicht getrennt): **alle vier** Keimzellen sind fehlerhaft.") },
        { math: tx('"meiosis II:" \\; n+1 , n-1 , n , n', '"Meiose II:" \\; n+1 , n-1 , n , n'), note: tx("Error in meiosis II (chromatids not separated): two sex cells are faulty, two are normal.", "Fehler in der Meiose II (Chromatiden nicht getrennt): Zwei Keimzellen sind fehlerhaft, zwei normal.") },
        { math: "(n + 1) + n = 2n + 1", note: tx("Fertilised by a normal sex cell: **trisomy** (47 chromosomes), for example trisomy 21 (Down syndrome). The risk rises with the mother's age.", "Befruchtung mit einer normalen Keimzelle: **Trisomie** (47 Chromosomen), zum Beispiel Trisomie 21 (Down-Syndrom). Das Risiko steigt mit dem Alter der Mutter.") },
        { math: "(n - 1) + n = 2n - 1", note: tx("Or **monosomy** (45 chromosomes). With autosomes this isn't viable; only 45,X (Turner syndrome) survives.", "Oder **Monosomie** (45 Chromosomen). Bei Autosomen nicht lebensfähig, nur 45,X (Turner-Syndrom) überlebt.") },
        { math: tx('"for example" \\; "47,XXY" \\quad "47,XXX" \\quad "45,X"', '"zum Beispiel" \\; "47,XXY" \\quad "47,XXX" \\quad "45,X"'), note: tx("Sex chromosomes can be misdistributed too: Klinefelter (47,XXY), triple X (47,XXX), Turner (45,X).", "Auch Gonosomen können fehlverteilt werden: Klinefelter (47,XXY), Triple-X (47,XXX), Turner (45,X).") },
      ],
    },
    {
      type: "widget",
      title: tx("Nondisjunction and karyograms", "Fehlverteilung und Karyogramme"),
      blob: tx("Make meiosis go wrong on purpose, then read real karyograms.", "Lass die Meiose absichtlich schiefgehen und lies dann Karyogramme."),
      body: tx(
        "In the first tab, compare an error in meiosis I with one in meiosis II: count the chromosomes in the four sex cells. In the second tab you see karyograms: chromosomes sorted by size and centromere position into 22 pairs of autosomes plus the sex chromosomes.",
        "Vergleich im ersten Reiter einen Fehler in der Meiose I mit einem in der Meiose II: Zähl die Chromosomen in den vier Keimzellen. Im zweiten Reiter siehst du Karyogramme: Chromosomen nach Größe und Lage des Zentromers sortiert, 22 Autosomenpaare plus die Gonosomen.",
      ),
      widget: DivisionNdjLab,
    },
    {
      type: "check",
      blob: tx("You're the geneticist now. What's the result?", "Jetzt bist du die Genetikerin oder der Genetiker. Was ist der Befund?"),
      exercise: karyoExercise("47,XY,+21", createRng(7)),
    },
    {
      type: "widget",
      title: tx("Control of the cell cycle and cancer", "Kontrolle des Zellzyklus und Krebs"),
      blob: tx("Last topic: who makes sure cells only divide when they should?", "Letztes Thema: Wer passt auf, dass sich Zellen nur teilen, wenn sie sollen?"),
      body: tx(
        "The cell cycle is checked at **checkpoints**: at the end of G1, at the end of G2 and in metaphase (spindle checkpoint). Proteins (cyclins and cyclin-dependent kinases) drive the cycle on. The protein **p53**, a **tumour suppressor**, is activated by DNA damage: it stops the cycle for repair or triggers **apoptosis** (programmed cell death).\n\n**Cancer** develops when mutations knock out this control: proto-oncogenes become **oncogenes** (stuck accelerator), tumour suppressor genes like p53 fail (broken brake). The cells divide without control. Try it: add DNA damage and switch p53 off.",
        "Der Zellzyklus wird an **Kontrollpunkten** überwacht: am Ende von G1, am Ende von G2 und in der Metaphase (Spindelkontrollpunkt). Proteine (Cycline und cyclinabhängige Kinasen) treiben den Zyklus voran. Das Protein **p53**, ein **Tumorsuppressor**, wird bei DNA-Schäden aktiviert: Es stoppt den Zyklus für die Reparatur oder löst die **Apoptose** aus (programmierter Zelltod).\n\n**Krebs** entsteht, wenn Mutationen diese Kontrolle ausschalten: Aus Proto-Onkogenen werden **Onkogene** (klemmendes Gaspedal), Tumorsuppressorgene wie p53 fallen aus (defekte Bremse). Die Zellen teilen sich unkontrolliert. Probier es aus: Setz einen DNA-Schaden und schalte p53 aus.",
      ),
      widget: DivisionCheckpoints,
    },
  ],
  summary: [
    {
      title: tx("Meiosis I = reduction division", "Meiose I = Reduktionsteilung"),
      body: tx(
        "Prophase I: homologues pair into bivalents, crossing over at chiasmata. Metaphase I: bivalents in the equatorial plane. Anaphase I: the homologues are separated. Result: 2 cells, n, 2c.",
        "Prophase I: Homologe paaren sich zu Bivalenten, Crossing-over an Chiasmata. Metaphase I: Bivalente in der Äquatorialebene. Anaphase I: Die Homologen werden getrennt. Ergebnis: 2 Zellen, n, 2c.",
      ),
      examples: ["2n , 4c \\to n , 2c"],
      tone: "rule",
    },
    {
      title: tx("Meiosis II = equational division", "Meiose II = Äquationsteilung"),
      body: tx("Like mitosis: the sister chromatids are separated. No replication before it! Result: 4 cells, n, 1c.", "Wie eine Mitose: Die Schwesterchromatiden werden getrennt. Davor keine Replikation! Ergebnis: 4 Zellen, n, 1c."),
      examples: ["n , 2c \\to n , 1c"],
      tone: "rule",
    },
    {
      title: tx("Recombination", "Rekombination"),
      body: tx(
        "Interchromosomal: random distribution of the homologues in anaphase I, $2^n$ combinations (humans: $2^{23}$ ≈ 8.4 million). Intrachromosomal: crossing over in prophase I.",
        "Interchromosomal: zufällige Verteilung der Homologen in der Anaphase I, $2^n$ Kombinationen (Mensch: $2^{23}$ ≈ 8,4 Millionen). Intrachromosomal: Crossing-over in der Prophase I.",
      ),
      examples: ["2^{23} = 8388608"],
      tone: "rule",
    },
    {
      title: tx("Nondisjunction and karyogram", "Nondisjunction und Karyogramm"),
      body: tx(
        "Error in meiosis I: all 4 sex cells faulty (n+1, n+1, n−1, n−1). Error in meiosis II: 2 normal, n+1, n−1. Results: trisomy 21 (47,+21), Turner (45,X), Klinefelter (47,XXY). Karyogram: count, check the sex chromosomes, look for a triple chromosome.",
        "Fehler in Meiose I: alle 4 Keimzellen fehlerhaft (n+1, n+1, n−1, n−1). Fehler in Meiose II: 2 normal, n+1, n−1. Folgen: Trisomie 21 (47,+21), Turner (45,X), Klinefelter (47,XXY). Karyogramm: zählen, Gonosomen prüfen, nach einem dreifachen Chromosom suchen.",
      ),
      examples: ["(n + 1) + n = 2n + 1"],
      tone: "rule",
    },
    {
      title: tx("Cell cycle control and cancer", "Zellzykluskontrolle und Krebs"),
      body: tx(
        "Checkpoints at the end of G1, at the end of G2 and in metaphase. p53 (tumour suppressor) stops the cycle when the DNA is damaged: repair or apoptosis. Cancer: mutations in proto-oncogenes (→ oncogenes) and tumour suppressor genes, uncontrolled division.",
        "Kontrollpunkte am Ende von G1, am Ende von G2 und in der Metaphase. p53 (Tumorsuppressor) stoppt bei DNA-Schäden den Zyklus: Reparatur oder Apoptose. Krebs: Mutationen in Proto-Onkogenen (→ Onkogene) und Tumorsuppressorgenen, unkontrollierte Teilung.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Meiosis I separates homologues, not chromatids. There is no S phase before meiosis II. Haploid doesn't mean 1c: after meiosis I a cell has n, 2c.",
        "Die Meiose I trennt Homologe, keine Chromatiden. Vor der Meiose II gibt es keine S-Phase. Haploid heißt nicht 1c: Nach der Meiose I hat eine Zelle n, 2c.",
      ),
      tone: "warning",
    },
  ],
};

