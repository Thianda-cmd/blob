"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { ACTIVE, FlowerABC, FlowerABCDiagram, IDENTITY, ORGAN_NAME, type Mutant } from "@/learn/biology/visuals/FlowerABC";
import { FlowerDoubleFert } from "@/learn/biology/visuals/FlowerDoubleFert";
import { FlowerEmbryoSac, FlowerGametophytes } from "@/learn/biology/visuals/FlowerEmbryoSac";
import { FlowerIncompat } from "@/learn/biology/visuals/FlowerIncompat";
import { FlowerLifeCycle } from "@/learn/biology/visuals/FlowerLifeCycle";
import { FlowerPollenGrain } from "@/learn/biology/visuals/FlowerPollenGrain";
import { CHAINS3, PLOIDY_NAME, SPECIES, STRUCTURES, type Ploidy, type Structure } from "./data";
import { cap, capT, choice, de, en, join, multi, numberMistakes, q, some, visual, type MultiOpt, type MultiSlip, type Opt } from "./kit";

// Level 3 (Experte, Oberstufe): the embryo sac and the pollen grain as gametophytes, double
// fertilisation with n/2n/3n, alternation of generations, self-incompatibility with S-alleles,
// what becomes what in the seed, ethylene and the ABC model of flower organ identity.

// ---------------------------------------------------------------------------
// Embryo sac and pollen grain: name the structure

type SacId = "integuments" | "nucellus" | "sac" | "antipodes" | "central" | "polar" | "egg" | "synergids" | "micropyle" | "funiculus" | "chalaza";
const SAC: Record<SacId, { name: Text; where: Text }> = {
  integuments: { name: tx("integuments", "Integumente"), where: tx("The integuments are the two outer protective layers of the ovule.", "Die Integumente sind die zwei äußeren Hüllschichten der Samenanlage.") },
  nucellus: { name: tx("nucellus", "Nucellus"), where: tx("The nucellus is the tissue inside the integuments that surrounds the embryo sac.", "Der Nucellus ist das Gewebe innerhalb der Integumente, das den Embryosack umgibt.") },
  sac: { name: tx("embryo sac", "Embryosack"), where: tx("The embryo sac is the whole oval gametophyte with its seven cells.", "Der Embryosack ist der ganze ovale Gametophyt mit seinen sieben Zellen.") },
  antipodes: { name: tx("antipodal cells", "Antipoden"), where: tx("The three antipodal cells sit at the chalazal end, far away from the micropyle.", "Die drei Antipoden sitzen am chalazalen Ende, weit weg von der Mikropyle.") },
  central: { name: tx("central cell", "Zentralzelle"), where: tx("The central cell is the large middle cell of the embryo sac.", "Die Zentralzelle ist die große mittlere Zelle des Embryosacks.") },
  polar: { name: tx("polar nuclei", "Polkerne"), where: tx("The polar nuclei are the two nuclei in the middle of the central cell.", "Die Polkerne sind die zwei Kerne in der Mitte der Zentralzelle.") },
  egg: { name: tx("egg cell", "Eizelle"), where: tx("The egg cell sits at the micropylar end, between and slightly above the two synergids.", "Die Eizelle sitzt am mikropylaren Ende, zwischen und etwas über den zwei Synergiden.") },
  synergids: { name: tx("synergids", "Synergiden"), where: tx("The two synergids sit right at the micropyle, next to the egg cell.", "Die zwei Synergiden sitzen direkt an der Mikropyle, neben der Eizelle.") },
  micropyle: { name: tx("micropyle", "Mikropyle"), where: tx("The micropyle is the narrow gap in the integuments.", "Die Mikropyle ist der enge Spalt in den Integumenten.") },
  funiculus: { name: tx("funiculus", "Funiculus"), where: tx("The funiculus is the stalk that attaches the ovule.", "Der Funiculus ist der Stiel, an dem die Samenanlage hängt.") },
  chalaza: { name: tx("chalaza", "Chalaza"), where: tx("The chalaza is the base of the ovule opposite the micropyle.", "Die Chalaza ist die Basis der Samenanlage gegenüber der Mikropyle.") },
};
const SAC_NEAR: Record<SacId, SacId[]> = {
  integuments: ["nucellus", "sac", "funiculus"],
  nucellus: ["integuments", "sac", "central"],
  sac: ["nucellus", "central", "integuments"],
  antipodes: ["synergids", "polar", "egg"],
  central: ["sac", "polar", "nucellus"],
  polar: ["egg", "antipodes", "central"],
  egg: ["synergids", "polar", "antipodes"],
  synergids: ["egg", "antipodes", "polar"],
  micropyle: ["chalaza", "funiculus", "integuments"],
  funiculus: ["micropyle", "chalaza", "integuments"],
  chalaza: ["micropyle", "antipodes", "funiculus"],
};
const SAC_ASK: SacId[] = ["integuments", "nucellus", "antipodes", "central", "polar", "egg", "synergids", "micropyle", "chalaza", "funiculus"];

function sacSay(right: SacId, picked: SacId): { title: Text; say: Text } {
  if (right === "egg" && picked === "synergids")
    return { title: tx("Egg apparatus", "Eiapparat"), say: tx("Close: egg cell and synergids form the egg apparatus together. There are two synergids, but only one egg cell, sitting a little higher.", "Knapp: Eizelle und Synergiden bilden zusammen den Eiapparat. Synergiden gibt es zwei, die Eizelle nur einmal, und sie sitzt etwas höher.") };
  if (right === "synergids" && picked === "egg")
    return { title: tx("Egg apparatus", "Eiapparat"), say: tx("Close: they belong to the egg apparatus. But there are two of them, right at the micropyle: the egg cell is the single one between them.", "Knapp: Sie gehören zum Eiapparat. Aber es sind zwei, direkt an der Mikropyle: Die Eizelle ist die einzelne dazwischen.") };
  if ((right === "antipodes" && picked === "synergids") || (right === "synergids" && picked === "antipodes"))
    return { title: tx("Wrong end", "Falsches Ende"), say: tx("Check the pole: the egg apparatus faces the micropyle, the antipodal cells face the chalaza.", "Prüf den Pol: Der Eiapparat liegt an der Mikropyle, die Antipoden an der Chalaza.") };
  if ((right === "micropyle" && picked === "chalaza") || (right === "chalaza" && picked === "micropyle"))
    return { title: tx("Opposite ends", "Gegenüberliegende Enden"), say: tx("Micropyle and chalaza lie at opposite ends. The micropyle is the opening where the pollen tube enters.", "Mikropyle und Chalaza liegen an entgegengesetzten Enden. Die Mikropyle ist die Öffnung, durch die der Pollenschlauch eindringt.") };
  return { title: tx(`Not the ${en(SAC[picked].name)}`, `${de(SAC[picked].name)}?`), say: tx(`Not quite. ${en(SAC[picked].where)}`, `Nicht ganz. ${de(SAC[picked].where)}`) };
}

export function sacPartTask(rng: Rng, fixed?: SacId): Exercise {
  const id = fixed ?? rng.pick(SAC_ASK);
  const { answer, mistakes } = choice(rng, [{ text: SAC[id].name }, ...SAC_NEAR[id].map((o) => ({ text: SAC[o].name, ...sacSay(id, o) }))]);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("An ovule with a mature embryo sac. What is the structure marked with **?**", "Eine Samenanlage mit reifem Embryosack. Wie heißt die Struktur mit dem **?**"),
    visual: visual(FlowerEmbryoSac, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("Orientation first: micropyle (pollen tube entrance) at the bottom, chalaza at the top. The egg apparatus faces the micropyle.", "Erst orientieren: Mikropyle (Eingang des Pollenschlauchs) unten, Chalaza oben. Der Eiapparat liegt an der Mikropyle."),
    solution: [{ math: q(SAC[id].name, "a"), note: SAC[id].where }],
    mistakes,
  };
}

type PollenId = "exine" | "intine" | "aperture" | "vegetative" | "vnucleus" | "generative";
const POLLEN: Record<PollenId, { name: Text; what: Text }> = {
  exine: { name: tx("exine", "Exine"), what: tx("the tough, sculptured outer wall", "die feste, gemusterte Außenwand") },
  intine: { name: tx("intine", "Intine"), what: tx("the thin inner wall", "die dünne Innenwand") },
  aperture: { name: tx("aperture (germ pore)", "Keimpore (Apertur)"), what: tx("the thin spot where the tube grows out", "die dünne Stelle, an der der Schlauch auswächst") },
  vegetative: { name: tx("vegetative cell", "vegetative Zelle"), what: tx("the large cell that forms the pollen tube", "die große Zelle, die den Pollenschlauch bildet") },
  vnucleus: { name: tx("vegetative nucleus", "vegetativer Kern"), what: tx("the nucleus of the large cell; it controls the tube", "der Kern der großen Zelle; er steuert den Schlauch") },
  generative: { name: tx("generative cell", "generative Zelle"), what: tx("the small cell inside the large one; it divides into two sperm cells", "die kleine Zelle in der großen; sie teilt sich in zwei Spermazellen") },
};
const POLLEN_NEAR: Record<PollenId, PollenId[]> = {
  exine: ["intine", "aperture", "vegetative"],
  intine: ["exine", "vegetative", "aperture"],
  aperture: ["exine", "intine", "generative"],
  vegetative: ["generative", "vnucleus", "intine"],
  vnucleus: ["generative", "vegetative", "aperture"],
  generative: ["vnucleus", "vegetative", "aperture"],
};

export function pollenPartTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(POLLEN) as PollenId[]);
  const opts: Opt[] = [
    { text: POLLEN[id].name },
    ...POLLEN_NEAR[id].map((o) => ({
      text: POLLEN[o].name,
      ...(id === "generative" && o === "vnucleus"
        ? { title: tx("Cell vs nucleus", "Zelle oder Kern?"), say: tx("The marked structure is a whole small cell with its own nucleus, lying inside the big cell. It will divide into the two sperm cells.", "Die markierte Struktur ist eine ganze kleine Zelle mit eigenem Kern, die in der großen Zelle liegt. Aus ihr werden die zwei Spermazellen.") }
        : id === "vnucleus" && o === "generative"
          ? { title: tx("Nucleus vs cell", "Kern oder Zelle?"), say: tx("This is the nucleus of the large cell, not the small cell inside it.", "Das ist der Kern der großen Zelle, nicht die kleine Zelle darin.") }
          : { title: tx(`Not the ${en(POLLEN[o].name)}`, `${de(POLLEN[o].name)}?`), say: tx(`Not quite: that would be ${en(POLLEN[o].what)}.`, `Nicht ganz: Das wäre ${de(POLLEN[o].what)}.`) }),
    })),
  ];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("A mature, two-celled pollen grain. What is the structure marked with **?**", "Ein reifes, zweizelliges Pollenkorn. Wie heißt die Struktur mit dem **?**"),
    visual: visual(FlowerPollenGrain, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("Two walls (exine, intine), two cells: a big vegetative cell and a small generative cell inside it.", "Zwei Wände (Exine, Intine), zwei Zellen: eine große vegetative Zelle und eine kleine generative Zelle darin."),
    solution: [{ math: q(POLLEN[id].name, "a"), note: tx(`It's ${en(POLLEN[id].what)}.`, `Das ist ${de(POLLEN[id].what)}.`) }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// How many? (numbers about the gametophytes)

const COUNTS: { ask: Text; value: number; wrong: { value: number; title: Text; say: Text }[]; note: Text }[] = [
  {
    ask: tx("How many **cells** does a mature embryo sac (Polygonum type) have?", "Wie viele **Zellen** hat ein reifer Embryosack (Polygonum-Typ)?"),
    value: 7,
    wrong: [{ value: 8, title: tx("Nuclei ≠ cells", "Kerne ≠ Zellen"), say: tx("8 is the number of nuclei. One cell has two of them: the central cell with its polar nuclei.", "8 ist die Zahl der Kerne. Eine Zelle hat zwei davon: die Zentralzelle mit ihren Polkernen.") }],
    note: tx("3 antipodal cells + egg cell + 2 synergids + central cell = 7 cells.", "3 Antipoden + Eizelle + 2 Synergiden + Zentralzelle = 7 Zellen."),
  },
  {
    ask: tx("How many **nuclei** does a mature embryo sac (Polygonum type) have?", "Wie viele **Kerne** hat ein reifer Embryosack (Polygonum-Typ)?"),
    value: 8,
    wrong: [{ value: 7, title: tx("Cells ≠ nuclei", "Zellen ≠ Kerne"), say: tx("7 is the number of cells. The central cell holds two polar nuclei.", "7 ist die Zahl der Zellen. Die Zentralzelle enthält zwei Polkerne.") }],
    note: tx("Three mitoses: 1 → 2 → 4 → 8 nuclei.", "Drei Mitosen: 1 → 2 → 4 → 8 Kerne."),
  },
  {
    ask: tx("How many mitoses lead from the functional megaspore to the eight-nucleate embryo sac?", "Wie viele Mitosen führen von der funktionsfähigen Megaspore zum achtkernigen Embryosack?"),
    value: 3,
    wrong: [
      { value: 8, title: tx("Count divisions, not nuclei", "Teilungen zählen, nicht Kerne"), say: tx("Each mitosis doubles the nuclei. How often do you have to double 1 to get 8?", "Jede Mitose verdoppelt die Kerne. Wie oft musst du 1 verdoppeln, um 8 zu bekommen?") },
      { value: 7, title: tx("Not one per nucleus", "Nicht eine pro Kern"), say: tx("All nuclei divide at the same time. 1 → 2 → 4 → 8: how many steps?", "Alle Kerne teilen sich gleichzeitig. 1 → 2 → 4 → 8: Wie viele Schritte sind das?") },
    ],
    note: tx("1 → 2 → 4 → 8: three mitoses (without cell division at first).", "1 → 2 → 4 → 8: drei Mitosen (zunächst ohne Zellteilung)."),
  },
  {
    ask: tx("Meiosis of a megaspore mother cell gives megaspores. How many of them **die**?", "Bei der Meiose einer Megasporenmutterzelle entstehen Megasporen. Wie viele davon **gehen zugrunde**?"),
    value: 3,
    wrong: [
      { value: 4, title: tx("One survives", "Eine überlebt"), say: tx("If all died, there would be no embryo sac. One of the four survives.", "Gingen alle zugrunde, gäbe es keinen Embryosack. Eine der vier überlebt.") },
      { value: 1, title: tx("The other way round", "Andersherum"), say: tx("Only one survives, not only one dies. Meiosis gives four.", "Nur eine überlebt, nicht nur eine geht zugrunde. Die Meiose liefert vier.") },
    ],
    note: tx("Meiosis gives 4 megaspores; 3 die, the chalazal one forms the embryo sac.", "Die Meiose liefert 4 Megasporen; 3 gehen zugrunde, die chalazale bildet den Embryosack."),
  },
  {
    ask: tx("How many sperm cells does one pollen tube deliver into the embryo sac?", "Wie viele Spermazellen bringt ein Pollenschlauch in den Embryosack?"),
    value: 2,
    wrong: [{ value: 1, title: tx("Double fertilisation", "Doppelte Befruchtung"), say: tx("Double fertilisation needs two partners for two fusions: egg cell and central cell.", "Die doppelte Befruchtung braucht zwei Partner für zwei Verschmelzungen: Eizelle und Zentralzelle.") }],
    note: tx("The generative cell divides into two sperm cells: one for the egg cell, one for the central cell.", "Die generative Zelle teilt sich in zwei Spermazellen: eine für die Eizelle, eine für die Zentralzelle."),
  },
  {
    ask: tx("How many haploid nuclei fuse to form the primary endosperm nucleus?", "Wie viele haploide Kerne verschmelzen zum primären Endospermkern?"),
    value: 3,
    wrong: [{ value: 2, title: tx("Two polar nuclei", "Zwei Polkerne"), say: tx("The central cell brings two polar nuclei, plus the sperm cell.", "Die Zentralzelle bringt zwei Polkerne mit, dazu kommt die Spermazelle.") }],
    note: tx("Two polar nuclei + one sperm nucleus = 3 nuclei: the endosperm is triploid.", "Zwei Polkerne + ein Spermakern = 3 Kerne: Das Endosperm ist triploid."),
  },
  {
    ask: tx("How many cells does the male gametophyte have after the second pollen mitosis (pollen tube included)?", "Wie viele Zellen hat der männliche Gametophyt nach der zweiten Pollenmitose (mit Pollenschlauch)?"),
    value: 3,
    wrong: [{ value: 2, title: tx("Count again", "Nachzählen"), say: tx("The generative cell has divided: two sperm cells plus the vegetative (tube) cell.", "Die generative Zelle hat sich geteilt: zwei Spermazellen plus die vegetative (Schlauch-)Zelle.") }],
    note: tx("Vegetative cell + two sperm cells = 3 cells. The male gametophyte is tiny.", "Vegetative Zelle + zwei Spermazellen = 3 Zellen. Der männliche Gametophyt ist winzig."),
  },
  {
    ask: tx("How many pollen grains form from one pollen mother cell?", "Wie viele Pollenkörner entstehen aus einer Pollenmutterzelle?"),
    value: 4,
    wrong: [{ value: 2, title: tx("Meiosis gives four", "Meiose liefert vier"), say: tx("Meiosis has two divisions, so one mother cell gives four microspores. Unlike in the ovule, none of them dies.", "Die Meiose hat zwei Teilungen, aus einer Mutterzelle werden also vier Mikrosporen. Anders als in der Samenanlage geht keine zugrunde.") }],
    note: tx("Meiosis: 1 pollen mother cell → tetrad of 4 microspores → 4 pollen grains.", "Meiose: 1 Pollenmutterzelle → Tetrade aus 4 Mikrosporen → 4 Pollenkörner."),
  },
];

export function countTask(rng: Rng): Exercise {
  const c = rng.pick(COUNTS);
  return {
    instruction: tx("How many?", "Wie viele?"),
    text: c.ask,
    answer: { kind: "number", value: c.value },
    hint: tx("Picture the development: meiosis, then mitoses. Cells and nuclei are not always the same number.", "Stell dir die Entwicklung vor: erst Meiose, dann Mitosen. Zellen und Kerne sind nicht immer gleich viele."),
    solution: [{ math: String(c.value), note: c.note }],
    mistakes: numberMistakes(c.value, c.wrong),
  };
}

// ---------------------------------------------------------------------------
// n, 2n or 3n?

export function ploidyMatchTask(rng: Rng): Exercise {
  const pick = (p: Ploidy) => rng.pick(STRUCTURES.filter((s) => s.ploidy === p));
  const items = rng.shuffle([pick(1), pick(2), pick(3)]);
  const extra = rng.chance(0.4);
  const pairs: [Text, Text][] = items.map((s) => [s.name, PLOIDY_NAME[s.ploidy]]);
  const mistakes: Mistake[] = [];
  const endo = items.find((s) => s.ploidy === 3)!;
  const two = items.find((s) => s.ploidy === 2)!;
  const one = items.find((s) => s.ploidy === 1)!;
  mistakes.push({
    when: { kind: "match", pairs: [[endo.name, "2n"]] },
    title: tx("Endosperm is triploid", "Endosperm ist triploid"),
    say: tx("Like the zygote? Not quite: the central cell brings **two** polar nuclei, the sperm cell a third set.", "Wie die Zygote? Nicht ganz: Die Zentralzelle bringt **zwei** Polkerne mit, die Spermazelle einen dritten Satz."),
  });
  if (two.maternal)
    mistakes.push({
      when: { kind: "match", pairs: [[two.name, "3n"]] },
      title: tx("Mother plant tissue", "Gewebe der Mutterpflanze"),
      say: tx("This tissue belongs to the diploid mother plant. Fertilisation doesn't change it at all.", "Dieses Gewebe gehört zur diploiden Mutterpflanze. Die Befruchtung verändert es überhaupt nicht."),
    });
  mistakes.push({
    when: { kind: "match", pairs: [[one.name, "2n"]] },
    title: tx("Gametophyte = haploid", "Gametophyt = haploid"),
    say: tx("Everything that belongs to the pollen grain or the embryo sac (or comes straight from meiosis) is haploid.", "Alles, was zum Pollenkorn oder Embryosack gehört (oder direkt aus der Meiose kommt), ist haploid."),
  });
  return {
    instruction: tx("Match each with its chromosome set", "Ordne jeder Struktur ihren Chromosomensatz zu"),
    text: tx("In a flowering plant: haploid (n), diploid (2n) or triploid (3n)?", "Bei einer Blütenpflanze: haploid (n), diploid (2n) oder triploid (3n)?"),
    answer: { kind: "match", pairs, ...(extra ? { distractors: ["4n"] } : {}) },
    hint: tx("Gametophytes are n. Zygote and mother plant are 2n. Only one tissue gets three sets.", "Gametophyten sind n. Zygote und Mutterpflanze sind 2n. Nur ein Gewebe bekommt drei Sätze."),
    solution: [
      {
        math: tx(items.map((s, i) => `"${cap(en(s.name))}:"#n${i} ${PLOIDY_NAME[s.ploidy].replace("n", '"n"')}#p${i}`).join(" \\\\ "), items.map((s, i) => `"${de(s.name)}:"#n${i} ${PLOIDY_NAME[s.ploidy].replace("n", '"n"')}#p${i}`).join(" \\\\ ")),
        note: tx(items.map((s) => en(s.why)).join(" "), items.map((s) => de(s.why)).join(" ")),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Chromosome numbers

export function chromosomeTask(rng: Rng, fixedSpecies?: number, fixedStructure?: string): Exercise {
  const sp = fixedSpecies !== undefined ? SPECIES[fixedSpecies] : rng.pick(SPECIES);
  const st: Structure = fixedStructure ? STRUCTURES.find((s) => s.id === fixedStructure)! : rng.pick(STRUCTURES.filter((s) => s.id !== "megaspore" && s.id !== "mmc"));
  const n = sp.n2 / 2;
  const value = n * st.ploidy;
  const wrong: { value: number; title: Text; say: Text }[] = [];
  if (st.ploidy === 3) {
    wrong.push({ value: sp.n2, title: tx("Endosperm is triploid", "Endosperm ist triploid"), say: tx("Two polar nuclei (n + n) plus a sperm cell (n): that's three sets, not two.", "Zwei Polkerne (n + n) plus eine Spermazelle (n): Das sind drei Sätze, nicht zwei.") });
    wrong.push({ value: n, title: tx("Three sets", "Drei Sätze"), say: tx("This tissue arises from a fusion of three haploid nuclei.", "Dieses Gewebe entsteht aus der Verschmelzung von drei haploiden Kernen.") });
  } else if (st.ploidy === 1) {
    wrong.push({ value: sp.n2, title: tx("Only one set", "Haploid!"), say: tx(`The ${en(st.name)} belongs to a gametophyte (or comes from meiosis): only one set of chromosomes.`, `${cap(de(st.name))}: Sie gehört zu einem Gametophyten (oder stammt aus der Meiose) und hat nur einen Chromosomensatz.`) });
    wrong.push({ value: n * 3, title: tx("Only one set", "Haploid!"), say: tx("Three sets only appear in the endosperm.", "Drei Sätze gibt es nur im Endosperm.") });
  } else {
    if (st.maternal) {
      wrong.push({ value: n * 3, title: tx("Mother plant tissue", "Gewebe der Mutterpflanze"), say: tx("This tissue belongs to the diploid mother plant. It isn't involved in fertilisation at all.", "Dieses Gewebe gehört zur diploiden Mutterpflanze. An der Befruchtung ist es gar nicht beteiligt.") });
      wrong.push({ value: n, title: tx("Not a gametophyte", "Kein Gametophyt"), say: tx("It lies close to the embryo sac, but it's tissue of the diploid sporophyte.", "Es liegt nahe am Embryosack, ist aber Gewebe des diploiden Sporophyten.") });
    } else {
      wrong.push({ value: n, title: tx("After fertilisation", "Nach der Befruchtung"), say: tx("Sperm cell (n) + egg cell (n): the zygote and everything that grows from it are diploid.", "Spermazelle (n) + Eizelle (n): Die Zygote und alles, was aus ihr wächst, ist diploid.") });
      wrong.push({ value: n * 3, title: tx("That's the endosperm", "Das ist das Endosperm"), say: tx("Three sets belong to the endosperm. The zygote line gets two.", "Drei Sätze hat das Endosperm. Die Zygote und ihre Nachkommen haben zwei.") });
    }
  }
  return {
    instruction: tx("Count the chromosomes", "Bestimme die Chromosomenzahl"),
    text: tx(`In ${en(sp.name)}, the body cells have $2n = ${sp.n2}$ chromosomes. How many chromosomes does **${en(st.obj)}** have?`, `Die Körperzellen von ${de(sp.name)} haben $2n = ${sp.n2}$ Chromosomen. Wie viele Chromosomen hat **${de(st.obj)}**?`),
    answer: { kind: "number", value, unit: tx("chromosomes", "Chromosomen") },
    hint: tx("First decide: n, 2n or 3n? Then calculate with n = 2n : 2.", "Entscheide zuerst: n, 2n oder 3n? Dann rechne mit n = 2n : 2."),
    solution: [
      { math: tx(`2n = ${sp.n2} \\Rightarrow "n" = ${n}`, `2n = ${sp.n2} \\Rightarrow "n" = ${n}`), note: tx("One set of chromosomes: n is half of 2n.", "Ein Chromosomensatz: n ist die Hälfte von 2n.") },
      { math: tx(`"${en(st.name)}:" ${PLOIDY_NAME[st.ploidy].replace("n", '"n"')} = ${value}`, `"${de(st.name)}:" ${PLOIDY_NAME[st.ploidy].replace("n", '"n"')} = ${value}`), note: st.why },
    ],
    mistakes: numberMistakes(value, wrong, tx("chromosomes", "Chromosomen")),
  };
}

// ---------------------------------------------------------------------------
// Order a process

export function chain3Task(rng: Rng, fixed?: number): Exercise {
  const c = CHAINS3[fixed ?? rng.int(0, CHAINS3.length - 1)];
  const n = Math.min(c.items.length, rng.int(4, 5));
  const start = fixed !== undefined ? 0 : rng.int(0, c.items.length - n);
  const idx = Array.from({ length: n }, (_, i) => start + i);
  const mistakes: Mistake[] = c.slips.filter((s) => idx.includes(s.first) && idx.includes(s.then)).map((s) => ({ when: { kind: "order", items: [c.items[s.first], c.items[s.then]] }, title: s.title, say: s.say }));
  return {
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: tx(`**${en(c.name)}**`, `**${de(c.name)}**`),
    answer: { kind: "order", items: idx.map((i) => c.items[i]) },
    hint: tx("Meiosis comes before the mitoses; fusion comes after delivery.", "Die Meiose kommt vor den Mitosen; Verschmelzen kommt nach dem Anliefern."),
    solution: [
      {
        math: tx(idx.map((i, k) => `"${k + 1}."#k${k} "${en(c.short[i])}"#s${k}`).join(" \\\\ "), idx.map((i, k) => `"${k + 1}."#k${k} "${de(c.short[i])}"#s${k}`).join(" \\\\ ")),
        note: tx("Follow the chromosome sets: 2n → meiosis → n → mitoses → fusion → 2n (or 3n).", "Folge den Chromosomensätzen: 2n → Meiose → n → Mitosen → Verschmelzung → 2n (bzw. 3n)."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Alternation of generations

const ALT: { ask: Text; right: Text; short: Text; wrong: Opt[]; note: Text }[] = [
  {
    ask: tx("Which cells arise **directly by meiosis** in seed plants?", "Welche Zellen entstehen bei Samenpflanzen **direkt durch Meiose**?"),
    right: tx("Spores (microspores and megaspores)", "Sporen (Mikrosporen und Megasporen)"),
    short: tx("spores", "Sporen"),
    wrong: [
      { text: tx("Egg cells and sperm cells", "Eizellen und Spermazellen"), title: tx("Plants aren't animals", "Pflanzen sind keine Tiere"), say: tx("In animals meiosis makes gametes directly. In plants it makes spores; gametes come later by mitosis in the gametophyte.", "Bei Tieren bildet die Meiose direkt Gameten. Bei Pflanzen bildet sie Sporen; die Gameten entstehen später durch Mitose im Gametophyten.") },
      { text: tx("Zygotes", "Zygoten"), title: tx("That's fertilisation", "Das ist Befruchtung"), say: tx("A zygote arises from the fusion of two gametes, not from meiosis.", "Eine Zygote entsteht durch Verschmelzung zweier Gameten, nicht durch Meiose.") },
      { text: tx("Endosperm cells", "Endospermzellen"), title: tx("That's fertilisation", "Das ist Befruchtung"), say: tx("Endosperm arises from the second fertilisation (3n), not from meiosis.", "Endosperm entsteht durch die zweite Befruchtung (3n), nicht durch Meiose.") },
    ],
    note: tx("Meiosis in the anther gives microspores, in the ovule megaspores. Both are spores.", "Die Meiose im Staubbeutel liefert Mikrosporen, in der Samenanlage Megasporen. Beides sind Sporen."),
  },
  {
    ask: tx("Which structure is the **female gametophyte** of a flowering plant?", "Welche Struktur ist der **weibliche Gametophyt** einer Blütenpflanze?"),
    right: tx("The embryo sac", "Der Embryosack"),
    short: tx("embryo sac", "Embryosack"),
    wrong: [
      { text: tx("The egg cell", "Die Eizelle"), title: tx("Gamete ≠ gametophyte", "Gamet ≠ Gametophyt"), say: tx("The egg cell is the gamete. The gametophyte is the haploid structure that makes it.", "Die Eizelle ist der Gamet. Der Gametophyt ist das haploide Gebilde, das ihn bildet.") },
      { text: tx("The ovule", "Die Samenanlage"), title: tx("Too big", "Zu groß"), say: tx("The ovule also contains diploid tissue of the mother plant (integuments, nucellus). Only the part inside is haploid.", "Die Samenanlage enthält auch diploides Gewebe der Mutterpflanze (Integumente, Nucellus). Haploid ist nur der Teil darin.") },
      { text: tx("The ovary", "Der Fruchtknoten"), title: tx("Far too big", "Viel zu groß"), say: tx("The ovary is diploid tissue of the mother plant. The gametophyte is a tiny haploid structure inside the ovule.", "Der Fruchtknoten ist diploides Gewebe der Mutterpflanze. Der Gametophyt ist ein winziges haploides Gebilde in der Samenanlage.") },
    ],
    note: tx("The embryo sac (7 cells, 8 nuclei) is the haploid female gametophyte.", "Der Embryosack (7 Zellen, 8 Kerne) ist der haploide weibliche Gametophyt."),
  },
  {
    ask: tx("Which structure is the **male gametophyte** of a flowering plant?", "Welche Struktur ist der **männliche Gametophyt** einer Blütenpflanze?"),
    right: tx("The pollen grain (with its pollen tube)", "Das Pollenkorn (mit Pollenschlauch)"),
    short: tx("pollen grain", "Pollenkorn"),
    wrong: [
      { text: tx("The anther", "Der Staubbeutel"), title: tx("That's the sporangium", "Das ist das Sporangium"), say: tx("The anther is diploid tissue of the sporophyte; its pollen sacs are the sporangia. The gametophytes develop inside.", "Der Staubbeutel ist diploides Gewebe des Sporophyten; seine Pollensäcke sind die Sporangien. Die Gametophyten entstehen darin.") },
      { text: tx("The sperm cell", "Die Spermazelle"), title: tx("Gamete ≠ gametophyte", "Gamet ≠ Gametophyt"), say: tx("The sperm cell is the gamete. The gametophyte is the structure that produces it.", "Die Spermazelle ist der Gamet. Der Gametophyt ist das Gebilde, das sie hervorbringt.") },
      { text: tx("The stamen", "Das Staubblatt"), title: tx("Sporophyte organ", "Organ des Sporophyten"), say: tx("The stamen is a diploid organ of the sporophyte. The male gametophytes develop inside its anther.", "Das Staubblatt ist ein diploides Organ des Sporophyten. In seinem Staubbeutel entstehen die männlichen Gametophyten.") },
    ],
    note: tx("The pollen grain (2 to 3 cells) is the haploid male gametophyte.", "Das Pollenkorn (2 bis 3 Zellen) ist der haploide männliche Gametophyt."),
  },
  {
    ask: tx("In which group of plants is the **gametophyte** the dominant, green generation?", "Bei welcher Pflanzengruppe ist der **Gametophyt** die dominante, grüne Generation?"),
    right: tx("Mosses", "Moose"),
    short: tx("mosses", "Moose"),
    wrong: [
      { text: tx("Ferns", "Farne"), title: tx("Fern plant = sporophyte", "Farnpflanze = Sporophyt"), say: tx("The fern plant you know carries sporangia: it's the sporophyte. Its gametophyte is the small prothallus.", "Die Farnpflanze, die du kennst, trägt Sporangien: Sie ist der Sporophyt. Ihr Gametophyt ist der kleine Vorkeim.") },
      { text: tx("Flowering plants", "Blütenpflanzen"), title: tx("Reduced", "Reduziert"), say: tx("In flowering plants the gametophyte is reduced to a few cells (pollen grain, embryo sac).", "Bei Blütenpflanzen ist der Gametophyt auf wenige Zellen reduziert (Pollenkorn, Embryosack).") },
      { text: tx("Conifers", "Nadelbäume"), title: tx("Seed plants too", "Auch Samenpflanzen"), say: tx("Conifers are seed plants: the tree is the sporophyte, the gametophytes are tiny.", "Nadelbäume sind Samenpflanzen: Der Baum ist der Sporophyt, die Gametophyten sind winzig.") },
    ],
    note: tx("In mosses the green moss plant is the haploid gametophyte; the sporophyte (spore capsule) lives on it.", "Bei Moosen ist das grüne Moospflänzchen der haploide Gametophyt; der Sporophyt (Sporenkapsel) lebt auf ihm."),
  },
  {
    ask: tx("How are the gametes of a seed plant formed?", "Wie entstehen die Gameten einer Samenpflanze?"),
    right: tx("By mitosis in the haploid gametophyte", "Durch Mitose im haploiden Gametophyten"),
    short: tx("mitosis in the gametophyte", "Mitose im Gametophyten"),
    wrong: [
      { text: tx("By meiosis in the diploid sporophyte", "Durch Meiose im diploiden Sporophyten"), title: tx("Meiosis makes spores", "Meiose bildet Sporen"), say: tx("In plants meiosis gives spores. The gametophyte that grows from them is already haploid, so it can only use mitosis.", "Bei Pflanzen liefert die Meiose Sporen. Der Gametophyt, der daraus wächst, ist schon haploid und kann nur noch Mitosen nutzen.") },
      { text: tx("By meiosis in the gametophyte", "Durch Meiose im Gametophyten"), title: tx("Already haploid", "Schon haploid"), say: tx("The gametophyte is haploid: a meiosis can't halve a single set again.", "Der Gametophyt ist haploid: Einen einfachen Satz kann eine Meiose nicht noch einmal halbieren.") },
      { text: tx("By fusion of two spores", "Durch Verschmelzung zweier Sporen"), title: tx("Spores don't fuse", "Sporen verschmelzen nicht"), say: tx("Spores grow on their own into gametophytes. Only gametes fuse.", "Sporen wachsen allein zu Gametophyten heran. Verschmelzen tun nur Gameten.") },
    ],
    note: tx("Spores (n) grow by mitosis into gametophytes (n), which make gametes (n) by mitosis.", "Sporen (n) wachsen durch Mitosen zu Gametophyten (n), die durch Mitose Gameten (n) bilden."),
  },
  {
    ask: tx("Why don't seed plants need water for fertilisation, unlike ferns?", "Warum brauchen Samenpflanzen zur Befruchtung kein Wasser, Farne aber schon?"),
    right: tx("The pollen tube carries the sperm cells right to the egg cell.", "Der Pollenschlauch bringt die Spermazellen direkt zur Eizelle."),
    short: tx("pollen tube", "Pollenschlauch"),
    wrong: [
      { text: tx("Their sperm cells swim especially fast.", "Ihre Spermazellen schwimmen besonders schnell."), title: tx("No flagella", "Keine Geißeln"), say: tx("Sperm cells of flowering plants have no flagella and can't swim at all.", "Spermazellen der Blütenpflanzen haben keine Geißeln und können gar nicht schwimmen.") },
      { text: tx("They reproduce only vegetatively.", "Sie vermehren sich nur ungeschlechtlich."), title: tx("They do have sex", "Sie vermehren sich geschlechtlich"), say: tx("Seed plants reproduce sexually: seeds come from fertilisation. The trick lies in how the sperm reaches the egg.", "Samenpflanzen vermehren sich geschlechtlich: Samen entstehen durch Befruchtung. Der Trick liegt darin, wie die Spermazelle zur Eizelle kommt.") },
      { text: tx("The wind carries the egg cells to the pollen.", "Der Wind trägt die Eizellen zum Pollen."), title: tx("The egg stays put", "Die Eizelle bleibt"), say: tx("The egg cell stays in the embryo sac inside the ovule. The pollen comes to it.", "Die Eizelle bleibt im Embryosack in der Samenanlage. Der Pollen kommt zu ihr.") },
    ],
    note: tx("Pollen and pollen tube made seed plants independent of water: a key to conquering dry land.", "Pollen und Pollenschlauch machten Samenpflanzen unabhängig vom Wasser: ein Schlüssel zur Eroberung des trockenen Landes."),
  },
];

export function alternationTask(rng: Rng): Exercise {
  const a = rng.pick(ALT);
  const { answer, mistakes } = choice(rng, [{ text: a.right }, ...a.wrong]);
  return {
    instruction: tx("Alternation of generations", "Generationswechsel"),
    text: a.ask,
    answer,
    hint: tx("Sporophyte (2n) → meiosis → spores (n) → gametophyte (n) → mitosis → gametes (n).", "Sporophyt (2n) → Meiose → Sporen (n) → Gametophyt (n) → Mitose → Gameten (n)."),
    solution: [{ math: q(a.short, "a"), note: tx(`${en(a.right)} ${en(a.note)}`, `${de(a.right)} ${de(a.note)}`) }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Self-incompatibility

const SUB = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const S = (i: number) => `S${SUB[i]}`;
const G = (a: number, b: number) => `${S(Math.min(a, b))}${S(Math.max(a, b))}`;
/** The same in the display language (frames): S_1S_2. */
const Sd = (i: number) => `S_${i}`;
const Gd = (a: number, b: number) => `${Sd(Math.min(a, b))}${Sd(Math.max(a, b))}`;

function siSetup(rng: Rng, share: 0 | 1 | 2) {
  const all = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const style: [number, number] = [all[0], all[1]];
  const donor: [number, number] = share === 2 ? [style[0], style[1]] : share === 1 ? [style[rng.int(0, 1)], all[2]] : [all[2], all[3]];
  return { style, donor };
}

export function siPercentTask(rng: Rng, fixed?: { sporo: boolean; share: 0 | 1 | 2 }): Exercise {
  const sporo = fixed?.sporo ?? rng.chance(0.35);
  const share = fixed?.share ?? (sporo ? rng.pick([0, 1, 1] as const) : rng.pick([0, 1, 1, 1, 2] as const));
  const { style, donor } = siSetup(rng, share);
  const shared = donor.filter((a) => style.includes(a));
  const value = sporo ? (share ? 0 : 100) : share === 0 ? 100 : share === 1 ? 50 : 0;
  const wrong: { value: number; title: Text; say: Text }[] = [];
  if (sporo && share === 1)
    wrong.push({ value: 50, title: tx("Sporophytic!", "Sporophytisch!"), say: tx(`That would be gametophytic SI. Here the pollen coat carries the S-proteins of **both** parent alleles, so every grain shows ${S(shared[0])}.`, `Das wäre gametophytische SI. Hier trägt die Pollenhülle die S-Proteine **beider** Eltern-Allele, also zeigt jedes Korn ${S(shared[0])}.`) });
  if (!sporo && share === 1) {
    wrong.push({ value: 0, title: tx("Gametophytic!", "Gametophytisch!"), say: tx(`Each grain counts with its **own** allele. Half of the grains carry ${S(donor.find((a) => !style.includes(a))!)}, which isn't in the style.`, `Jedes Korn zählt mit seinem **eigenen** Allel. Die Hälfte der Körner trägt ${S(donor.find((a) => !style.includes(a))!)}, und das kommt im Griffel nicht vor.`) });
    wrong.push({ value: 100, title: tx("One allele matches", "Ein Allel passt"), say: tx(`The grains with ${S(shared[0])} find the same allele in the style: their tubes stop.`, `Die Körner mit ${S(shared[0])} treffen im Griffel auf dasselbe Allel: Ihre Schläuche stoppen.`) });
  }
  if (share === 0) wrong.push({ value: 50, title: tx("No match at all", "Gar keine Übereinstimmung"), say: tx("None of the donor's alleles occurs in the style, so no tube is stopped.", "Keins der Allele des Spenders kommt im Griffel vor, also wird kein Schlauch gestoppt.") });
  if (share === 2) wrong.push({ value: 50, title: tx("Both alleles match", "Beide Allele passen"), say: tx("Both of the donor's alleles also occur in the style: every pollen tube stops.", "Beide Allele des Spenders kommen auch im Griffel vor: Jeder Pollenschlauch stoppt.") });
  return {
    instruction: tx("Self-incompatibility", "Selbstinkompatibilität"),
    text: tx(
      `${sporo ? "Sporophytic" : "Gametophytic"} self-incompatibility: a plant with the genotype **${G(...style)}** is pollinated with pollen from a plant with **${G(...donor)}**. What percentage of the pollen grains can grow a tube down to the ovules?${sporo ? " (Both alleles of the pollen parent act equally.)" : ""}`,
      `${sporo ? "Sporophytische" : "Gametophytische"} Selbstinkompatibilität: Eine Pflanze mit dem Genotyp **${G(...style)}** wird mit Pollen einer Pflanze mit **${G(...donor)}** bestäubt. Wie viel Prozent der Pollenkörner können einen Schlauch bis zu den Samenanlagen bilden?${sporo ? " (Beide Allele der Pollen-Elternpflanze wirken gleich stark.)" : ""}`,
    ),
    answer: { kind: "number", value, unit: "%" },
    hint: sporo
      ? tx("Sporophytic: the genotype of the pollen's parent plant decides for every grain.", "Sporophytisch: Der Genotyp der Pollen-Elternpflanze entscheidet für jedes Korn.")
      : tx("Gametophytic: each haploid grain carries one of the two donor alleles. Which ones are not in the style?", "Gametophytisch: Jedes haploide Korn trägt eins der beiden Spender-Allele. Welche kommen im Griffel nicht vor?"),
    solution: [
      {
        math: tx(`"style:" ${Gd(...style)} \\quad "pollen:" ${Sd(donor[0])} , ${Sd(donor[1])}`, `"Griffel:" ${Gd(...style)} \\quad "Pollen:" ${Sd(donor[0])} , ${Sd(donor[1])}`),
        note: sporo
          ? tx("Every grain carries the S-proteins of both alleles of its parent plant.", "Jedes Korn trägt die S-Proteine beider Allele seiner Elternpflanze.")
          : tx("Half of the grains carry the first allele, half the second.", "Die Hälfte der Körner trägt das erste Allel, die Hälfte das zweite."),
      },
      {
        math: `${value} "%"`,
        note: sporo
          ? share
            ? tx(`The parent has ${S(shared[0])}, which is also in the stigma: all grains are rejected.`, `Die Elternpflanze hat ${S(shared[0])}, das auch in der Narbe vorkommt: Alle Körner werden abgewiesen.`)
            : tx("No allele matches: all grains can grow.", "Kein Allel passt: Alle Körner können wachsen.")
          : share === 0
            ? tx("No allele matches: all tubes grow.", "Kein Allel passt: Alle Schläuche wachsen.")
            : share === 1
              ? tx(`Only grains with ${S(donor.find((a) => !style.includes(a))!)} grow: half of them.`, `Nur Körner mit ${S(donor.find((a) => !style.includes(a))!)} wachsen: die Hälfte.`)
              : tx("Both alleles occur in the style: no tube gets through.", "Beide Allele kommen im Griffel vor: Kein Schlauch kommt durch."),
      },
    ],
    mistakes: numberMistakes(value, wrong, "%"),
  };
}

export function siCountTask(rng: Rng): Exercise {
  const { style, donor } = siSetup(rng, 1);
  const total = rng.pick([120, 160, 180, 200, 240, 300, 360]);
  const value = total / 2;
  const free = donor.find((a) => !style.includes(a))!;
  const shared = donor.find((a) => style.includes(a))!;
  return {
    instruction: tx("Self-incompatibility: calculate", "Selbstinkompatibilität: berechnen"),
    text: tx(
      `A sweet cherry tree (**${G(...style)}**, gametophytic SI) receives ${total} pollen grains from a tree with **${G(...donor)}**. How many pollen tubes are expected to reach the ovules?`,
      `Ein Süßkirschbaum (**${G(...style)}**, gametophytische SI) erhält ${total} Pollenkörner von einem Baum mit **${G(...donor)}**. Wie viele Pollenschläuche erreichen erwartungsgemäß die Samenanlagen?`,
    ),
    answer: { kind: "number", value, unit: tx("tubes", "Schläuche") },
    hint: tx("Meiosis in the donor: half of the grains get each allele. Which allele is stopped?", "Meiose beim Spender: Die Hälfte der Körner bekommt je ein Allel. Welches Allel wird gestoppt?"),
    solution: [
      { math: `${Sd(free)} : ${Sd(shared)} = 1 : 1`, note: tx(`Half of the grains carry ${S(free)}, half ${S(shared)}. ${S(shared)} is also in the style.`, `Die Hälfte der Körner trägt ${S(free)}, die andere Hälfte ${S(shared)}. ${S(shared)} kommt auch im Griffel vor.`) },
      { math: `${total} : 2 = ${value}`, note: tx(`Only the ${S(free)} tubes grow through: ${value} of ${total}.`, `Nur die ${S(free)}-Schläuche wachsen durch: ${value} von ${total}.`) },
    ],
    mistakes: numberMistakes(
      value,
      [
        { value: 0, title: tx("Gametophytic!", "Gametophytisch!"), say: tx("Not the whole donor counts, but each grain's own allele. Some grains carry an allele that isn't in the style.", "Es zählt nicht der ganze Spender, sondern das eigene Allel jedes Korns. Manche Körner tragen ein Allel, das im Griffel fehlt.") },
        { value: total, title: tx("One allele matches", "Ein Allel passt"), say: tx(`Grains with ${S(shared)} are stopped in the style.`, `Körner mit ${S(shared)} werden im Griffel gestoppt.`) },
      ],
      tx("tubes", "Schläuche"),
    ),
  };
}

export function siOffspringTask(rng: Rng): Exercise {
  const { style, donor } = siSetup(rng, 1);
  const a = donor.find((x) => style.includes(x))!;
  const c = donor.find((x) => !style.includes(x))!;
  const b = style.find((x) => x !== a)!;
  const opts: MultiOpt[] = [
    { text: G(a, c), ok: true },
    { text: G(b, c), ok: true },
    { text: G(a, a), ok: false },
    { text: G(a, b), ok: false },
    { text: G(c, c), ok: false },
  ];
  const slips: MultiSlip[] = [
    { pick: [0, 1, 2, 3], title: tx("Without SI", "Ohne SI gerechnet"), say: tx(`That would be the cross without SI. But pollen with ${S(a)} stops in the style, so it can't fertilise.`, `So wäre die Kreuzung ohne SI. Pollen mit ${S(a)} stoppt aber im Griffel und kann nicht befruchten.`) },
    { pick: [0, 1, 4], title: tx("The egg cell is from the mother", "Die Eizelle kommt von der Mutter"), say: tx(`Every offspring gets one allele from the mother plant (${G(...style)}), so ${G(c, c)} is impossible.`, `Jeder Nachkomme bekommt ein Allel von der Mutterpflanze (${G(...style)}), ${G(c, c)} ist also unmöglich.`) },
  ];
  const { answer, mistakes } = multi(rng, opts, slips);
  return {
    instruction: tx("Which offspring are possible?", "Welche Nachkommen sind möglich?"),
    text: tx(
      `Gametophytic SI: a mother plant **${G(...style)}** is pollinated by a plant **${G(...donor)}**. Which genotypes can the seeds have? Select all.`,
      `Gametophytische SI: Eine Mutterpflanze **${G(...style)}** wird von einer Pflanze **${G(...donor)}** bestäubt. Welche Genotypen können die Samen haben? Wähle alle aus.`,
    ),
    answer,
    hint: tx("First find out which pollen grains get through. Then combine them with both egg cell types.", "Finde erst heraus, welche Pollenkörner durchkommen. Kombiniere sie dann mit beiden Eizell-Typen."),
    solution: [
      { math: tx(`"pollen" ${Sd(a)} \\to "stops" \\quad "pollen" ${Sd(c)} \\to "grows"`, `"Pollen" ${Sd(a)} \\to "stoppt" \\quad "Pollen" ${Sd(c)} \\to "wächst"`), note: tx(`${S(a)} is also in the style, ${S(c)} isn't.`, `${S(a)} kommt auch im Griffel vor, ${S(c)} nicht.`) },
      { math: `${Gd(a, c)} , ${Gd(b, c)}`, note: tx(`Egg cells carry ${S(a)} or ${S(b)}; the only sperm cells get there carry ${S(c)}.`, `Eizellen tragen ${S(a)} oder ${S(b)}; die einzigen Spermazellen, die ankommen, tragen ${S(c)}.`) },
    ],
    mistakes,
  };
}

export function siOrchardTask(rng: Rng): Exercise {
  const { answer, mistakes } = choice(rng, [
    { text: tx("Its own pollen is rejected (self-incompatibility). A pollinator variety with other S-alleles is missing.", "Der eigene Pollen wird abgewiesen (Selbstinkompatibilität). Es fehlt eine Befruchtersorte mit anderen S-Allelen.") },
    {
      text: tx("All trees of one variety have identical pollen, which is too heavy for bees.", "Alle Bäume einer Sorte haben gleichen Pollen, der für Bienen zu schwer ist."),
      title: tx("It's about genes", "Es geht um Gene"),
      say: tx("The bees carry the pollen just fine. The problem is recognition in the style: the S-alleles are the same.", "Die Bienen transportieren den Pollen problemlos. Das Problem ist die Erkennung im Griffel: Die S-Allele sind gleich."),
    },
    {
      text: tx("Trees of the same variety flower at different times.", "Bäume einer Sorte blühen zu verschiedenen Zeiten."),
      title: tx("Same variety, same time", "Gleiche Sorte, gleiche Zeit"),
      say: tx("Trees of one variety are clones (grafted) and flower at the same time. Their pollen still doesn't work on each other.", "Bäume einer Sorte sind Klone (veredelt) und blühen gleichzeitig. Ihr Pollen funktioniert trotzdem nicht untereinander."),
    },
    {
      text: tx("Cherries need wind pollination, which an orchard blocks.", "Kirschen brauchen Windbestäubung, die eine Plantage verhindert."),
      title: tx("Insect flowers", "Insektenblüten"),
      say: tx("Cherry blossoms are classic insect flowers: colourful, scented, with nectar.", "Kirschblüten sind klassische Insektenblüten: auffällig, duftend, mit Nektar."),
    },
  ]);
  return {
    instruction: tx("Self-incompatibility in the orchard", "Selbstinkompatibilität in der Obstplantage"),
    text: tx(
      "A fruit grower plants 200 sweet cherry trees, all of the same grafted variety. Bees visit the trees busily, yet hardly any cherries form. Why?",
      "Ein Obstbauer pflanzt 200 Süßkirschbäume, alle von derselben veredelten Sorte. Bienen besuchen die Bäume fleißig, trotzdem bilden sich kaum Kirschen. Warum?",
    ),
    answer,
    hint: tx("Grafted trees of one variety are genetically identical. What does that mean for their S-alleles?", "Veredelte Bäume einer Sorte sind genetisch gleich. Was bedeutet das für ihre S-Allele?"),
    solution: [{ math: q(tx("same S-alleles = self", "gleiche S-Allele = selbst"), "a"), note: tx("All trees carry the same S-alleles: to the style, every pollen grain looks like its own. Growers plant pollinator varieties with different S-alleles in between.", "Alle Bäume tragen dieselben S-Allele: Für den Griffel sieht jedes Pollenkorn aus wie eigenes. Obstbauern pflanzen deshalb Befruchtersorten mit anderen S-Allelen dazwischen.") }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// ABC model

const MUT_NAME: Record<Exclude<Mutant, "wt">, string> = { a: "A", b: "B", c: "C" };
const seqText = (m: Mutant): Text => tx(IDENTITY[m].map((o) => en(ORGAN_NAME[o])).join(", "), IDENTITY[m].map((o) => de(ORGAN_NAME[o])).join(", "));

const MISSING: Record<Exclude<Mutant, "wt">, Text> = {
  a: tx("no sepals and petals, only stamens and carpels", "keine Kelch- und Kronblätter, nur Staubblätter und Fruchtblätter"),
  b: tx("sepals and carpels only, whorls 2 and 3 empty", "nur Kelchblätter und Fruchtblätter, Wirtel 2 und 3 leer"),
  c: tx("sepals and petals only, no organs inside", "nur Kelch- und Kronblätter, innen keine Organe"),
};

export function abcTask(rng: Rng, fixed?: { kind: number; mutant?: Exclude<Mutant, "wt">; whorl?: number }): Exercise {
  const kind = fixed?.kind ?? rng.int(0, 2);
  if (kind === 0) {
    const m = fixed?.mutant ?? rng.pick(["a", "b", "c"] as const);
    const others = (["a", "b", "c"] as const).filter((x) => x !== m);
    const confused = rng.pick(others);
    const opts: Opt[] = [
      { text: capT(seqText(m)) },
      { text: capT(seqText("wt")), title: tx("Something changes", "Es ändert sich etwas"), say: tx(`Without the ${MUT_NAME[m]} function, the code in some whorls changes. Read the table again without ${MUT_NAME[m]}.`, `Ohne die ${MUT_NAME[m]}-Funktion ändert sich der Code in manchen Wirteln. Lies die Tabelle noch einmal ohne ${MUT_NAME[m]}.`) },
      { text: capT(MISSING[m]), title: tx("The whorls stay", "Die Wirtel bleiben"), say: tx(m === "b" ? "The whorls don't disappear: they get a different identity from the genes that are left (A or C)." : "The whorls don't disappear. A and C inhibit each other: if one is missing, the other spreads into its whorls.", m === "b" ? "Die Wirtel verschwinden nicht: Sie bekommen eine andere Identität durch die übrigen Gene (A oder C)." : "Die Wirtel verschwinden nicht. A und C hemmen sich gegenseitig: Fehlt eins, breitet sich das andere in seine Wirtel aus.") },
      { text: capT(seqText(confused)), title: tx(`That's the ${MUT_NAME[confused]} mutant`, `Das ist die ${MUT_NAME[confused]}-Mutante`), say: tx(`That pattern appears when ${MUT_NAME[confused]} is missing. Here ${MUT_NAME[m]} is knocked out.`, `Dieses Muster entsteht, wenn ${MUT_NAME[confused]} fehlt. Hier ist ${MUT_NAME[m]} ausgefallen.`) },
    ];
    const { answer, mistakes } = choice(rng, opts);
    return {
      instruction: tx("ABC model: predict the flower", "ABC-Modell: Sag die Blüte voraus"),
      text: tx(`In an Arabidopsis mutant the **${MUT_NAME[m]} function** has failed. Which organs form, from whorl 1 (outside) to whorl 4 (inside)?`, `Bei einer Mutante der Ackerschmalwand ist die **${MUT_NAME[m]}-Funktion** ausgefallen. Welche Organe bilden sich von Wirtel 1 (außen) bis Wirtel 4 (innen)?`),
      visual: visual(FlowerABCDiagram, { mutant: "wt" }),
      answer,
      hint: tx("A: sepals. A + B: petals. B + C: stamens. C: carpels. A and C inhibit each other.", "A: Kelchblätter. A + B: Kronblätter. B + C: Staubblätter. C: Fruchtblätter. A und C hemmen sich gegenseitig."),
      solution: [
        { math: tx(`"without" "${MUT_NAME[m]}"`, `"ohne" "${MUT_NAME[m]}"`), note: m === "b" ? tx("Without B, whorls 2 and 3 only have A or C left.", "Ohne B bleibt in Wirtel 2 und 3 nur A bzw. C übrig.") : m === "a" ? tx("Without A, C spreads into all four whorls.", "Ohne A breitet sich C in alle vier Wirtel aus.") : tx("Without C, A spreads into all four whorls.", "Ohne C breitet sich A in alle vier Wirtel aus.") },
        { math: q(seqText(m), "a"), note: tx("Each whorl gets the organ that its new gene combination codes for.", "Jeder Wirtel bekommt das Organ, für das seine neue Genkombination steht.") },
      ],
      mistakes,
    };
  }
  if (kind === 1) {
    const m = fixed?.mutant ?? rng.pick(["a", "b", "c"] as const);
    const opts: Opt[] = [
      { text: tx(`The ${MUT_NAME[m]} function`, `Die ${MUT_NAME[m]}-Funktion`) },
      ...(["a", "b", "c"] as const)
        .filter((x) => x !== m)
        .map((x) => ({
          text: tx(`The ${MUT_NAME[x]} function`, `Die ${MUT_NAME[x]}-Funktion`),
          title: tx("Check the table", "Prüf die Tabelle"),
          say:
            m === "c" && x === "a"
              ? tx("A is clearly working: there are sepals and petals, even in the middle. What normally stops A from spreading inwards?", "A arbeitet offensichtlich: Es gibt Kelch- und Kronblätter, sogar innen. Was hindert A normalerweise daran, sich nach innen auszubreiten?")
              : m === "a" && x === "c"
                ? tx("Carpels and stamens need C, and here they are everywhere. Which gene normally keeps C out of whorls 1 and 2?", "Fruchtblätter und Staubblätter brauchen C, und die gibt es hier überall. Welches Gen hält C normalerweise aus Wirtel 1 und 2 heraus?")
                : tx(`If ${MUT_NAME[x]} were missing, the flower would look different. Compare whorl by whorl.`, `Fehlte ${MUT_NAME[x]}, sähe die Blüte anders aus. Vergleich Wirtel für Wirtel.`),
        })),
      { text: tx("None: it's the wild type", "Keine: Es ist der Wildtyp"), title: tx("Look again", "Schau noch mal"), say: tx("The wild type has sepals, petals, stamens and carpels. This flower doesn't.", "Der Wildtyp hat Kelchblätter, Kronblätter, Staubblätter und Fruchtblätter. Diese Blüte nicht.") },
    ];
    const { answer, mistakes } = choice(rng, opts);
    return {
      instruction: tx("ABC model: find the mutation", "ABC-Modell: Finde die Mutation"),
      text: tx(`A mutant flower forms, from outside to inside: **${en(seqText(m))}**. Which function has failed?`, `Eine Mutante bildet von außen nach innen: **${de(seqText(m))}**. Welche Funktion ist ausgefallen?`),
      visual: visual(FlowerABCDiagram, { mutant: m }),
      answer,
      hint: tx("Which organ type is missing completely? And which gene was needed for it?", "Welcher Organtyp fehlt ganz? Und welches Gen war dafür nötig?"),
      solution: [{ math: tx(`"${MUT_NAME[m]} function lost"`, `"${MUT_NAME[m]}-Funktion ausgefallen"`), note: m === "b" ? tx("No petals and no stamens: both need B.", "Keine Kronblätter und keine Staubblätter: Beide brauchen B.") : m === "a" ? tx("No sepals and petals, and carpels outside: C has spread because A is missing.", "Keine Kelch- und Kronblätter, außen Fruchtblätter: C hat sich ausgebreitet, weil A fehlt.") : tx("No stamens and carpels, but petals and sepals inside: A has spread because C is missing.", "Keine Staub- und Fruchtblätter, innen Kron- und Kelchblätter: A hat sich ausgebreitet, weil C fehlt.") }],
      mistakes,
    };
  }
  const w = fixed?.whorl ?? rng.int(1, 4);
  const code = (["A", "B", "C"] as const).filter((g) => ACTIVE.wt[g][w - 1]).join(" + ");
  const all = ["A", "A + B", "B + C", "C"];
  const organ = IDENTITY.wt[w - 1];
  const opts: Opt[] = [
    { text: code },
    ...all
      .filter((x) => x !== code)
      .map((x) => {
        const which = IDENTITY.wt[all.indexOf(x)];
        return { text: x, title: tx(`That gives ${en(ORGAN_NAME[which])}`, `Das ergibt ${de(ORGAN_NAME[which])}`), say: tx(`${x} codes for ${en(ORGAN_NAME[which])}. Whorl ${w} forms ${en(ORGAN_NAME[organ])}.`, `${x} steht für ${de(ORGAN_NAME[which])}. Wirtel ${w} bildet ${de(ORGAN_NAME[organ])}.`) };
      }),
  ];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("ABC model: the code", "ABC-Modell: der Code"),
    text: tx(`Which gene functions are active in **whorl ${w}** of a wild-type flower (it forms ${en(ORGAN_NAME[organ])})?`, `Welche Genfunktionen sind im **Wirtel ${w}** einer Wildtyp-Blüte aktiv (er bildet ${de(ORGAN_NAME[organ])})?`),
    answer,
    hint: tx("A is active in the outer two whorls, B in the middle two, C in the inner two.", "A ist in den äußeren zwei Wirteln aktiv, B in den mittleren zwei, C in den inneren zwei."),
    solution: [{ math: join(tx(`"whorl" ${w}:`, `"Wirtel" ${w}:`), code, "\\to", q(ORGAN_NAME[organ], "o")), note: tx("A: whorls 1 + 2. B: whorls 2 + 3. C: whorls 3 + 4.", "A: Wirtel 1 + 2. B: Wirtel 2 + 3. C: Wirtel 3 + 4.") }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// What becomes what? And ethylene.

const BECOME3: { from: Text; to: Text }[] = [
  { from: tx("zygote", "Zygote"), to: tx("embryo", "Embryo") },
  { from: tx("primary endosperm nucleus", "primärer Endospermkern"), to: tx("endosperm (nutritive tissue)", "Endosperm (Nährgewebe)") },
  { from: tx("integuments", "Integumente"), to: tx("seed coat", "Samenschale") },
  { from: tx("ovary wall", "Fruchtknotenwand"), to: tx("fruit wall", "Fruchtwand") },
  { from: tx("ovule", "Samenanlage"), to: tx("seed", "Samen") },
];

export function become3Task(rng: Rng): Exercise {
  const set = some(rng, [0, 1, 2, 3, 4], 4).sort((a, b) => a - b);
  const pairs: [Text, Text][] = set.map((i) => [BECOME3[i].from, BECOME3[i].to]);
  const mistakes: Mistake[] = [];
  if (set.includes(2) && set.includes(3))
    mistakes.push({
      when: { kind: "match", pairs: [[BECOME3[3].from, BECOME3[2].to]] },
      title: tx("Seed coat vs fruit wall", "Samenschale oder Fruchtwand?"),
      say: tx("The seed coat belongs to the seed and comes from the ovule's integuments. The ovary wall becomes the fruit wall around it.", "Die Samenschale gehört zum Samen und kommt von den Integumenten der Samenanlage. Die Fruchtknotenwand wird zur Fruchtwand drumherum."),
    });
  if (set.includes(1) && set.includes(2))
    mistakes.push({
      when: { kind: "match", pairs: [[BECOME3[2].from, BECOME3[1].to]] },
      title: tx("Integuments protect", "Integumente schützen"),
      say: tx("The integuments are diploid tissue of the mother plant; they harden into the seed coat. The food store comes from the fertilised central cell.", "Die Integumente sind diploides Gewebe der Mutterpflanze und verhärten zur Samenschale. Der Nährstoffspeicher kommt aus der befruchteten Zentralzelle."),
    });
  return {
    instruction: tx("What becomes what?", "Was wird woraus?"),
    text: tx("After double fertilisation: match each structure with what it develops into.", "Nach der doppelten Befruchtung: Ordne jeder Struktur zu, was aus ihr wird."),
    answer: { kind: "match", pairs },
    hint: tx("Ovary → fruit, ovule → seed. Inside the seed: integuments, zygote, endosperm nucleus.", "Fruchtknoten → Frucht, Samenanlage → Samen. Im Samen: Integumente, Zygote, Endospermkern."),
    solution: [
      {
        math: tx(set.map((i, k) => `"${cap(en(BECOME3[i].from))}"#f${k} \\to "${en(BECOME3[i].to)}"#t${k}`).join(" \\\\ "), set.map((i, k) => `"${de(BECOME3[i].from)}"#f${k} \\to "${de(BECOME3[i].to)}"#t${k}`).join(" \\\\ ")),
        note: tx("Seed coat and fruit wall are tissue of the mother plant (2n). Embryo (2n) and endosperm (3n) come from fertilisation.", "Samenschale und Fruchtwand sind Gewebe der Mutterpflanze (2n). Embryo (2n) und Endosperm (3n) stammen aus der Befruchtung."),
      },
    ],
    mistakes,
  };
}

const ETHYLENE: { text: Text; right: Text; short: Text; wrong: Opt[]; note: Text }[] = [
  {
    text: tx("Unripe green bananas are put into a paper bag together with a ripe apple. They ripen much faster than bananas without an apple. Why?", "Unreife grüne Bananen werden mit einem reifen Apfel in eine Papiertüte gelegt. Sie reifen viel schneller als Bananen ohne Apfel. Warum?"),
    right: tx("The ripe apple gives off the gaseous plant hormone ethylene, which triggers ripening.", "Der reife Apfel gibt das gasförmige Pflanzenhormon Ethylen ab, das die Reifung auslöst."),
    short: tx("ethylene", "Ethylen"),
    wrong: [
      { text: tx("The apple gives off heat that speeds up ripening.", "Der Apfel gibt Wärme ab, die die Reifung beschleunigt."), title: tx("Not the heat", "Nicht die Wärme"), say: tx("The bag is at room temperature either way. A signal substance is at work: a gaseous hormone.", "Die Tüte hat so oder so Zimmertemperatur. Hier wirkt ein Signalstoff: ein gasförmiges Hormon.") },
      { text: tx("The apple gives off carbon dioxide, which makes fruit ripen.", "Der Apfel gibt Kohlenstoffdioxid ab, das Früchte reifen lässt."), title: tx("CO₂ slows ripening", "CO₂ bremst die Reifung"), say: tx("Respiration does release CO₂, but CO₂ rather slows ripening (that's how fruit is stored). The active gas is a different one.", "Bei der Zellatmung entsteht zwar CO₂, aber CO₂ bremst die Reifung eher (so wird Obst gelagert). Das wirksame Gas ist ein anderes.") },
      { text: tx("The bananas absorb sugar from the apple.", "Die Bananen nehmen Zucker aus dem Apfel auf."), title: tx("No contact needed", "Kein Kontakt nötig"), say: tx("The fruits don't exchange any substances by touching. Something spreads through the air in the bag.", "Die Früchte tauschen durch Berührung keine Stoffe aus. Etwas verteilt sich durch die Luft in der Tüte.") },
    ],
    note: tx("Ethylene (ethene, C₂H₄) is the ripening hormone. Climacteric fruits like apples, bananas and tomatoes produce a lot of it while ripening.", "Ethylen (Ethen, C₂H₄) ist das Reifehormon. Klimakterische Früchte wie Äpfel, Bananen und Tomaten bilden beim Reifen viel davon."),
  },
  {
    text: tx(
      "Green tomatoes in three boxes, 5 days at 20 °C. Box A: with a ripe apple, 80 % turn red. Box B: no apple, 20 % red. Box C: ripe apple plus 1-MCP, a substance that blocks the ethylene receptors, 22 % red. What do the results show?",
      "Grüne Tomaten in drei Kisten, 5 Tage bei 20 °C. Kiste A: mit reifem Apfel, 80 % werden rot. Kiste B: ohne Apfel, 20 % rot. Kiste C: reifer Apfel und 1-MCP, ein Stoff, der die Ethylen-Rezeptoren blockiert, 22 % rot. Was zeigen die Ergebnisse?",
    ),
    right: tx("The apple speeds up ripening through ethylene, which acts via receptors.", "Der Apfel beschleunigt die Reifung über Ethylen, das über Rezeptoren wirkt."),
    short: tx("effect via ethylene receptors", "Wirkung über Ethylen-Rezeptoren"),
    wrong: [
      { text: tx("1-MCP makes tomatoes ripen faster.", "1-MCP lässt Tomaten schneller reifen."), title: tx("Compare A and C", "Vergleich A und C"), say: tx("With 1-MCP only 22 % turned red, about as few as without an apple. It blocks the effect.", "Mit 1-MCP wurden nur 22 % rot, fast so wenige wie ohne Apfel. Es blockiert die Wirkung.") },
      { text: tx("Tomatoes don't need ethylene: they also ripen in box B.", "Tomaten brauchen kein Ethylen: Sie reifen auch in Kiste B."), title: tx("Own ethylene", "Eigenes Ethylen"), say: tx("In B some tomatoes ripen with their own ethylene. But the big difference between A and C shows the effect of the hormone.", "In B reifen einige Tomaten mit ihrem eigenen Ethylen. Der große Unterschied zwischen A und C zeigt aber die Wirkung des Hormons.") },
      { text: tx("The apple speeds up ripening by giving off heat.", "Der Apfel beschleunigt die Reifung durch Wärme."), title: tx("Look at box C", "Schau auf Kiste C"), say: tx("Box C has the same warm apple, but with blocked ethylene receptors the effect is gone. So it isn't heat.", "Kiste C hat denselben warmen Apfel, aber mit blockierten Ethylen-Rezeptoren ist der Effekt weg. Wärme ist es also nicht.") },
    ],
    note: tx("A vs B: the apple speeds up ripening. A vs C: if the ethylene receptors are blocked, the effect is gone. So ethylene is the signal.", "A gegen B: Der Apfel beschleunigt die Reifung. A gegen C: Sind die Ethylen-Rezeptoren blockiert, ist der Effekt weg. Also ist Ethylen das Signal."),
  },
  {
    text: tx("\"One rotten apple spoils the whole barrel.\" Why does a single ripening apple make the whole box ripen?", "„Ein fauler Apfel verdirbt den ganzen Korb.“ Warum lässt ein einziger reifender Apfel die ganze Kiste reifen?"),
    right: tx("Ethylene makes the neighbouring fruits produce more ethylene themselves (positive feedback).", "Ethylen regt in den Nachbarfrüchten die eigene Ethylenbildung an (positive Rückkopplung)."),
    short: tx("positive feedback", "positive Rückkopplung"),
    wrong: [
      { text: tx("Ethylene slows down the ripening of the neighbours.", "Ethylen hemmt die Reifung der Nachbarn."), title: tx("The opposite", "Das Gegenteil"), say: tx("Ethylene promotes ripening. Think of the bananas in the bag with the apple.", "Ethylen fördert die Reifung. Denk an die Bananen mit dem Apfel in der Tüte.") },
      { text: tx("The neighbouring fruits only absorb the ethylene without making any.", "Die Nachbarfrüchte nehmen nur Ethylen auf, ohne selbst welches zu bilden."), title: tx("It spreads like an avalanche", "Es breitet sich lawinenartig aus"), say: tx("If they only absorbed it, the effect would fade. But each ripening fruit starts making ethylene itself.", "Würden sie es nur aufnehmen, ließe der Effekt nach. Aber jede reifende Frucht bildet selbst Ethylen.") },
      { text: tx("The apple passes on bacteria that cause ripening.", "Der Apfel überträgt Bakterien, die die Reifung auslösen."), title: tx("Ripening isn't rotting", "Reifen ist nicht Faulen"), say: tx("Ripening is controlled by the plant itself, with a hormone. Bacteria would make the fruit rot.", "Die Reifung steuert die Pflanze selbst, mit einem Hormon. Bakterien würden die Früchte faulen lassen.") },
    ],
    note: tx("Ethylene triggers its own synthesis: ripening spreads like an avalanche. That's why ripe fruit should be stored separately.", "Ethylen löst seine eigene Bildung aus: Die Reifung breitet sich lawinenartig aus. Deshalb lagert man reifes Obst getrennt."),
  },
];

export function ethyleneTask(rng: Rng): Exercise {
  const e = rng.pick(ETHYLENE);
  const { answer, mistakes } = choice(rng, [{ text: e.right }, ...e.wrong]);
  return {
    instruction: tx("Fruit ripening", "Fruchtreife"),
    text: e.text,
    answer,
    hint: tx("Ripening is controlled by a gaseous plant hormone.", "Die Reifung wird von einem gasförmigen Pflanzenhormon gesteuert."),
    solution: [{ math: q(e.short, "a"), note: e.note }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  switch (rng.int(0, 14)) {
    case 0:
      return sacPartTask(rng);
    case 1:
      return pollenPartTask(rng);
    case 2:
      return countTask(rng);
    case 3:
      return ploidyMatchTask(rng);
    case 4:
    case 5:
      return chromosomeTask(rng);
    case 6:
      return chain3Task(rng);
    case 7:
      return alternationTask(rng);
    case 8:
      return siPercentTask(rng);
    case 9:
      return siCountTask(rng);
    case 10:
      return siOffspringTask(rng);
    case 11:
      return siOrchardTask(rng);
    case 12:
      return abcTask(rng);
    case 13:
      return become3Task(rng);
    default:
      return ethyleneTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const genFrames: Frame[] = [
  {
    math: tx('"sporophyte (2n)"#a \\to#m1 "spores (n)"#b', '"Sporophyt (2n)"#a \\to#m1 "Sporen (n)"#b'),
    note: tx("Plants alternate between two generations. The diploid **sporophyte** makes haploid **spores** by **meiosis**: spores, not gametes!", "Pflanzen wechseln zwischen zwei Generationen. Der diploide **Sporophyt** bildet durch **Meiose** haploide **Sporen**: Sporen, keine Gameten!"),
    highlight: ["b"],
  },
  {
    math: tx('"sporophyte (2n)"#a \\to#m1 "spores (n)"#b \\\\ \\to#m2 "gametophyte (n)"#c \\to#m3 "gametes (n)"#d', '"Sporophyt (2n)"#a \\to#m1 "Sporen (n)"#b \\\\ \\to#m2 "Gametophyt (n)"#c \\to#m3 "Gameten (n)"#d'),
    note: tx("A spore grows by mitosis into the haploid **gametophyte**. It makes the gametes by **mitosis**.", "Aus einer Spore wächst durch Mitosen der haploide **Gametophyt**. Er bildet die Gameten durch **Mitose**."),
    highlight: ["c"],
  },
  {
    math: tx('"gametes (n)"#d \\to#m4 "zygote (2n)"#z \\to#m5 "sporophyte (2n)"#a', '"Gameten (n)"#d \\to#m4 "Zygote (2n)"#z \\to#m5 "Sporophyt (2n)"#a'),
    note: tx("Fertilisation gives the diploid zygote, which grows into a new sporophyte. The cycle is closed.", "Die Befruchtung liefert die diploide Zygote, aus der wieder ein Sporophyt wächst. Der Kreis ist geschlossen."),
    highlight: ["z"],
  },
  {
    math: tx('"♂ gametophyte:"#g1 \\; "pollen grain"#p \\\\ "♀ gametophyte:"#g2 \\; "embryo sac"#e', '"♂ Gametophyt:"#g1 \\; "Pollenkorn"#p \\\\ "♀ Gametophyt:"#g2 \\; "Embryosack"#e'),
    note: tx("In seed plants the gametophyte is extremely reduced: the **pollen grain** (2 to 3 cells) and the **embryo sac** (7 cells). Both live on the sporophyte.", "Bei Samenpflanzen ist der Gametophyt extrem reduziert: das **Pollenkorn** (2 bis 3 Zellen) und der **Embryosack** (7 Zellen). Beide leben auf dem Sporophyten."),
    highlight: ["p", "e"],
  },
];

const seedFrames: Frame[] = [
  {
    math: tx('"zygote (2n)"#z \\to "embryo (2n)"#e', '"Zygote (2n)"#z \\to "Embryo (2n)"#e'),
    note: tx("The zygote divides by mitosis: the embryo with cotyledons, shoot tip and root tip forms.", "Die Zygote teilt sich mitotisch: Der Embryo mit Keimblättern, Sprossspitze und Wurzelspitze entsteht."),
  },
  {
    math: tx('"zygote (2n)"#z \\to "embryo (2n)"#e \\\\ "endosperm nucleus (3n)"#n \\to "endosperm (3n)"#en', '"Zygote (2n)"#z \\to "Embryo (2n)"#e \\\\ "Endospermkern (3n)"#n \\to "Endosperm (3n)"#en'),
    note: tx("The triploid endosperm feeds the embryo. In beans and peas the embryo absorbs it into the cotyledons while the seed forms; in cereals it stays (that's flour!).", "Das triploide Endosperm ernährt den Embryo. Bei Bohne und Erbse nimmt der Embryo es schon bei der Samenbildung in die Keimblätter auf; bei Getreide bleibt es erhalten (das ist Mehl!)."),
    highlight: ["en"],
  },
  {
    math: tx('"integuments (2n)"#i \\to "seed coat"#s \\\\ "ovary wall (2n)"#o \\to "fruit wall"#f', '"Integumente (2n)"#i \\to "Samenschale"#s \\\\ "Fruchtknotenwand (2n)"#o \\to "Fruchtwand"#f'),
    note: tx("Seed coat and fruit wall are tissue of the mother plant (2n), not touched by fertilisation. So a seed combines tissues with different genomes.", "Samenschale und Fruchtwand sind Gewebe der Mutterpflanze (2n), von der Befruchtung unberührt. Ein Samen vereint also Gewebe mit verschiedenem Erbgut."),
  },
  {
    math: tx('"ethylene"#et : \\ce{C2H4}', '"Ethylen"#et : \\ce{C2H4}'),
    note: tx("Ripening is controlled by the gaseous plant hormone **ethylene** (ethene). It makes fruits soft, sweet and colourful.", "Die Fruchtreife steuert das gasförmige Pflanzenhormon **Ethylen** (Ethen). Es macht Früchte weich, süß und farbig."),
  },
  {
    math: tx('"ripe apple"#ap \\to "ethylene"#et \\to "more ethylene"#mo', '"reifer Apfel"#ap \\to "Ethylen"#et \\to "mehr Ethylen"#mo'),
    note: tx("Ethylene makes neighbouring fruits produce ethylene too (positive feedback). That's why a ripe apple makes bananas in the bag ripen faster.", "Ethylen regt Nachbarfrüchte zur eigenen Ethylenbildung an (positive Rückkopplung). Deshalb reifen Bananen mit einem reifen Apfel in der Tüte schneller."),
    highlight: ["mo"],
  },
];

function LifeCycleWidget() {
  return <FlowerLifeCycle />;
}
function GametophyteWidget() {
  return <FlowerGametophytes />;
}
function DoubleFertWidget() {
  return <FlowerDoubleFert />;
}
function IncompatWidget() {
  return <FlowerIncompat />;
}
function AbcWidget() {
  return <FlowerABC />;
}

const checkSac = sacPartTask(createRng(17), "synergids");
const checkChromo = chromosomeTask(createRng(5), 0, "endo");
const checkSi = siPercentTask(createRng(23), { sporo: false, share: 1 });
const checkAbc = abcTask(createRng(31), { kind: 0, mutant: "b" });

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Alternation of generations", "Generationswechsel"),
      blob: tx("Plot twist: every plant lives two lives, one haploid and one diploid!", "Plot-Twist: Jede Pflanze führt zwei Leben, ein haploides und ein diploides!"),
      body: tx(
        "In land plants a diploid generation (**sporophyte**) and a haploid generation (**gametophyte**) alternate. Meiosis and fertilisation are the switches between them.",
        "Bei Landpflanzen wechseln sich eine diploide Generation (**Sporophyt**) und eine haploide Generation (**Gametophyt**) ab. Meiose und Befruchtung sind die Weichen dazwischen.",
      ),
      frames: genFrames,
    },
    {
      type: "widget",
      title: tx("Moss, fern, seed plant", "Moos, Farn, Samenpflanze"),
      blob: tx("Compare the three groups. Watch the gametophyte shrink!", "Vergleich die drei Gruppen. Schau, wie der Gametophyt schrumpft!"),
      body: tx(
        "Switch between the plant groups and tap the stages. The size of each circle shows which generation dominates.",
        "Wechsle zwischen den Pflanzengruppen und tipp auf die Stadien. Die Größe der Kreise zeigt, welche Generation dominiert.",
      ),
      widget: LifeCycleWidget,
    },
    {
      type: "widget",
      title: tx("The gametophytes of the flower", "Die Gametophyten der Blüte"),
      blob: tx("Seven cells, eight nuclei. Let's build an embryo sac!", "Sieben Zellen, acht Kerne. Bauen wir einen Embryosack!"),
      body: tx(
        "Step through the development of the **embryo sac** (female) and the **pollen grain** (male). At the end you can tap every structure.",
        "Geh die Entwicklung des **Embryosacks** (weiblich) und des **Pollenkorns** (männlich) Schritt für Schritt durch. Am Ende kannst du jede Struktur antippen.",
      ),
      widget: GametophyteWidget,
    },
    { type: "check", blob: tx("A classic Abitur figure. Orientation is everything!", "Eine klassische Abiturabbildung. Orientierung ist alles!"), exercise: checkSac },
    {
      type: "widget",
      title: tx("Double fertilisation", "Doppelte Befruchtung"),
      blob: tx("Two sperm cells, two fusions. Only flowering plants do this!", "Zwei Spermazellen, zwei Verschmelzungen. Das machen nur Blütenpflanzen!"),
      body: tx(
        "Follow the pollen tube into the embryo sac. Watch the chromosome sets: n + n = 2n, but n + n + n = 3n.",
        "Folge dem Pollenschlauch in den Embryosack. Achte auf die Chromosomensätze: n + n = 2n, aber n + n + n = 3n.",
      ),
      widget: DoubleFertWidget,
    },
    { type: "check", blob: tx("Time to count chromosomes!", "Zeit, Chromosomen zu zählen!"), exercise: checkChromo },
    {
      type: "explain",
      title: tx("From ovule to seed, and ripe fruit", "Von der Samenanlage zum Samen und zur reifen Frucht"),
      blob: tx("What becomes what? And who decides when a cherry is ripe?", "Was wird woraus? Und wer entscheidet, wann eine Kirsche reif ist?"),
      frames: seedFrames,
    },
    {
      type: "widget",
      title: tx("Self-incompatibility", "Selbstinkompatibilität"),
      blob: tx("Many plants say no to their own pollen. Clever, right?", "Viele Pflanzen sagen Nein zu ihrem eigenen Pollen. Clever, oder?"),
      body: tx(
        "Many plants prevent self-fertilisation genetically with **S-alleles** (multiple alleles of one S-locus). If pollen and style share an S-allele, fertilisation fails. The style here is **S₁S₂**. Choose the pollen donor and the type of SI.",
        "Viele Pflanzen verhindern Selbstbefruchtung genetisch mit **S-Allelen** (multiple Allele eines S-Locus). Teilen Pollen und Griffel ein S-Allel, scheitert die Befruchtung. Der Griffel hier ist **S₁S₂**. Wähle den Pollenspender und die Art der SI.",
      ),
      widget: IncompatWidget,
    },
    { type: "check", blob: tx("Gametophytic: every grain for itself!", "Gametophytisch: Jedes Korn zählt für sich!"), exercise: checkSi },
    {
      type: "widget",
      title: tx("The ABC model", "Das ABC-Modell"),
      blob: tx("Three gene functions, four kinds of organs. Let's break some genes!", "Drei Genfunktionen, vier Organtypen. Lass uns ein paar Gene kaputt machen!"),
      body: tx(
        "Organ identity genes (homeotic genes, studied in thale cress) decide which organ forms in each whorl: **A** alone gives sepals, **A + B** petals, **B + C** stamens, **C** alone carpels. Switch off one function.",
        "Organidentitätsgene (homöotische Gene, untersucht an der Ackerschmalwand) bestimmen, welches Organ in jedem Wirtel entsteht: **A** allein ergibt Kelchblätter, **A + B** Kronblätter, **B + C** Staubblätter, **C** allein Fruchtblätter. Schalte eine Funktion aus.",
      ),
      widget: AbcWidget,
    },
    { type: "check", blob: tx("Predict the mutant!", "Sag die Mutante voraus!"), exercise: checkAbc },
  ],
  summary: [
    {
      title: tx("The gametophytes", "Die Gametophyten"),
      body: tx(
        "Embryo sac (♀): 7 cells, 8 nuclei: egg cell and 2 synergids (micropyle), central cell with 2 polar nuclei, 3 antipodal cells. Pollen grain (♂): vegetative cell (pollen tube) and generative cell → 2 sperm cells.",
        "Embryosack (♀): 7 Zellen, 8 Kerne: Eizelle und 2 Synergiden (Mikropyle), Zentralzelle mit 2 Polkernen, 3 Antipoden. Pollenkorn (♂): vegetative Zelle (Pollenschlauch) und generative Zelle → 2 Spermazellen.",
      ),
      examples: [tx('"megaspore" \\to "3 mitoses" \\to "7 cells, 8 nuclei"', '"Megaspore" \\to "3 Mitosen" \\to "7 Zellen, 8 Kerne"')],
      tone: "rule",
    },
    {
      title: tx("Double fertilisation", "Doppelte Befruchtung"),
      body: tx("Only in angiosperms. One pollen tube, two sperm cells, two fusions.", "Nur bei Bedecktsamern. Ein Pollenschlauch, zwei Spermazellen, zwei Verschmelzungen."),
      examples: [tx('"sperm" + "egg cell" \\to "zygote (2n)"', '"Spermazelle" + "Eizelle" \\to "Zygote (2n)"'), tx('"sperm" + "central cell" \\to "endosperm (3n)"', '"Spermazelle" + "Zentralzelle" \\to "Endosperm (3n)"')],
      tone: "rule",
    },
    {
      title: tx("Alternation of generations", "Generationswechsel"),
      body: tx(
        "Meiosis makes spores, gametes arise by mitosis in the gametophyte. Moss: gametophyte dominates. Fern and seed plant: sporophyte dominates; in seed plants the gametophyte is reduced to a few cells.",
        "Die Meiose bildet Sporen, Gameten entstehen durch Mitose im Gametophyten. Moos: Gametophyt dominiert. Farn und Samenpflanze: Sporophyt dominiert; bei Samenpflanzen ist der Gametophyt auf wenige Zellen reduziert.",
      ),
      examples: [tx('"sporophyte (2n)" \\to "spores (n)" \\to "gametophyte (n)"', '"Sporophyt (2n)" \\to "Sporen (n)" \\to "Gametophyt (n)"')],
      tone: "rule",
    },
    {
      title: tx("Self-incompatibility", "Selbstinkompatibilität"),
      body: tx(
        "Gametophytic (cherry): a tube stops in the style if its own S-allele is also in the style. Sporophytic (cabbage): the genotype of the pollen's parent decides, rejection on the stigma.",
        "Gametophytisch (Kirsche): Ein Schlauch stoppt im Griffel, wenn sein eigenes S-Allel auch im Griffel vorkommt. Sporophytisch (Kohl): Der Genotyp der Pollen-Elternpflanze entscheidet, Abweisung auf der Narbe.",
      ),
      examples: [tx('S_1S_2 \\times S_1S_3 : \\; 50 "% of the tubes grow"', 'S_1S_2 \\times S_1S_3 : \\; 50 "% der Schläuche wachsen"')],
      tone: "tip",
    },
    {
      title: tx("ABC model and ethylene", "ABC-Modell und Ethylen"),
      body: tx(
        "A: sepals. A + B: petals. B + C: stamens. C: carpels. A and C inhibit each other. Ethylene: gaseous ripening hormone with positive feedback.",
        "A: Kelchblätter. A + B: Kronblätter. B + C: Staubblätter. C: Fruchtblätter. A und C hemmen sich. Ethylen: gasförmiges Reifehormon mit positiver Rückkopplung.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Endosperm is 3n, not 2n. Seed coat and fruit wall are 2n tissue of the mother plant. In plants meiosis makes spores, not gametes. The pollen grain is a gametophyte, not a gamete.",
        "Endosperm ist 3n, nicht 2n. Samenschale und Fruchtwand sind 2n-Gewebe der Mutterpflanze. Bei Pflanzen bildet die Meiose Sporen, keine Gameten. Das Pollenkorn ist ein Gametophyt, kein Gamet.",
      ),
      tone: "warning",
    },
  ],
};
