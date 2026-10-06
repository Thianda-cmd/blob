"use client";

// Level 3 (Experte, Oberstufe): the system of plants (green algae, mosses, ferns and allies,
// gymnosperms, angiosperms with monocots and dicots), the move onto land, alternation of generations
// in mosses and ferns, taxonomic ranks, binomial names after Linnaeus and reading a cladogram.

import { tx, type Text } from "@/i18n/text";
import { BARS, DiversityCladogram, DiversityCladogramPicture, TIPS, type CladeTip } from "@/learn/biology/visuals/DiversityCladogram";
import { CYCLES, DiversityCyclePicture, DiversityLifeCycle, type CyclePlant } from "@/learn/biology/visuals/DiversityLifeCycle";
import { DiversityMonoDi, DiversityMonoDiPicture, FEATURES, type Group, type MonoDiFeature } from "@/learn/biology/visuals/DiversityMonoDi";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson, Mistake } from "@/learn/types";
import { capT, choice, de, en, join, multi, pickSome, q, visual, type MultiOpt, type Opt } from "./kit";

/** A cycle picture at task size. */
function CyclePicture(props: { plant: CyclePlant; ask?: string }) {
  return (
    <div className="mx-auto w-full max-w-[460px]">
      <DiversityCyclePicture {...props} />
    </div>
  );
}

/** Scientific names, quoted the way each language quotes. */
const sci = (name: string): Text => tx(`“${name}”`, `„${name}“`);

// ---------------------------------------------------------------------------
// Alternation of generations: put the cycle in order

const MOSS_STEPS: Text[] = [
  tx("A spore (n) germinates.", "Eine Spore (n) keimt."),
  tx("A green thread, the protonema, grows.", "Ein fadenförmiger Vorkeim (Protonema) wächst."),
  tx("Leafy moss plants (gametophyte, n) form antheridia and archegonia.", "Moospflänzchen (Gametophyt, n) bilden Antheridien und Archegonien."),
  tx("Sperm cells swim through water to the egg cell: fertilisation.", "Spermatozoiden schwimmen im Wasser zur Eizelle: Befruchtung."),
  tx("The zygote (2n) is formed.", "Die Zygote (2n) entsteht."),
  tx("The sporophyte grows on the moss plant: a stalk with a capsule.", "Der Sporophyt wächst auf dem Moospflänzchen: ein Stiel mit Kapsel."),
  tx("Meiosis in the capsule: spores (n) are formed.", "Meiose in der Kapsel: Sporen (n) entstehen."),
];
const FERN_STEPS: Text[] = [
  tx("A spore (n) germinates.", "Eine Spore (n) keimt."),
  tx("A small heart-shaped prothallium (gametophyte, n) grows.", "Ein kleiner, herzförmiger Vorkeim (Prothallium, Gametophyt, n) wächst."),
  tx("Antheridia and archegonia form on the underside of the prothallium.", "An der Unterseite des Vorkeims entstehen Antheridien und Archegonien."),
  tx("Sperm cells swim through water to the egg cell: fertilisation.", "Spermatozoiden schwimmen im Wasser zur Eizelle: Befruchtung."),
  tx("The zygote (2n) grows into a young fern on the prothallium.", "Aus der Zygote (2n) wächst auf dem Vorkeim ein junger Farn."),
  tx("The fern plant (sporophyte, 2n) forms sori under its fronds.", "Die Farnpflanze (Sporophyt, 2n) bildet Sporangienhäufchen unter den Wedeln."),
  tx("Meiosis in the sporangia: spores (n) are formed.", "Meiose in den Sporangien: Sporen (n) entstehen."),
];

function cycleOrderTask(rng: Rng, fixedPlant?: CyclePlant, fixedStart?: number): Exercise {
  const plant = fixedPlant ?? (rng.chance(0.5) ? "moss" : "fern");
  const steps = plant === "moss" ? MOSS_STEPS : FERN_STEPS;
  const start = fixedStart ?? rng.int(0, steps.length - 1);
  const items = Array.from({ length: 5 }, (_, k) => steps[(start + k) % steps.length]);
  const pos = (i: number) => items.indexOf(steps[i]);
  // A typical slip: b put before a, where a really comes first in this part of the cycle.
  const before = (a: number, b: number) => pos(a) >= 0 && pos(b) >= 0 && pos(a) < pos(b);
  const list: Mistake[] = [];
  if (before(3, 4)) list.push({ when: { kind: "order", items: [steps[4], steps[3]] }, title: tx("Zygote after fertilisation", "Zygote nach der Befruchtung"), say: tx("The zygote is what fertilisation produces: egg cell (n) + sperm cell (n) = zygote (2n).", "Die Zygote ist das Ergebnis der Befruchtung: Eizelle (n) + Spermatozoid (n) = Zygote (2n).") });
  if (plant === "fern" && before(1, 4)) list.push({ when: { kind: "order", items: [steps[4], steps[1]] }, title: tx("First the prothallium", "Erst der Vorkeim"), say: tx("A spore never grows straight into a fern. First comes the tiny prothallium; the fern grows out of it after fertilisation.", "Aus einer Spore wächst nie direkt ein Farn. Zuerst kommt der winzige Vorkeim; aus ihm wächst nach der Befruchtung der Farn.") });
  if (plant === "moss" && before(3, 5)) list.push({ when: { kind: "order", items: [steps[5], steps[3]] }, title: tx("The capsule needs a zygote", "Die Kapsel braucht eine Zygote"), say: tx("The capsule on its stalk is the sporophyte: it grows from the zygote, so it comes after fertilisation.", "Die Kapsel mit Stiel ist der Sporophyt: Er wächst aus der Zygote, kommt also nach der Befruchtung.") });
  if (plant === "fern" && before(5, 6)) list.push({ when: { kind: "order", items: [steps[6], steps[5]] }, title: tx("Meiosis in the sporangia", "Meiose in den Sporangien"), say: tx("Meiosis happens in the sporangia of the grown fern: the sporophyte must be there first.", "Die Meiose findet in den Sporangien des fertigen Farns statt: Der Sporophyt muss also schon da sein.") });
  return {
    instruction: tx("Order the life cycle", "Ordne den Entwicklungszyklus"),
    text: tx(`Part of the life cycle of a ${plant === "moss" ? "moss" : "fern"}. Start with "${en(items[0])}" and put the steps in order.`, `Ein Ausschnitt aus dem Entwicklungszyklus eines ${plant === "moss" ? "Mooses" : "Farns"}. Beginne mit „${de(items[0])}“ und bring die Schritte in die richtige Reihenfolge.`),
    answer: { kind: "order", items },
    hint: tx("Spore → gametophyte → gametes → fertilisation → zygote → sporophyte → meiosis → spore.", "Spore → Gametophyt → Keimzellen → Befruchtung → Zygote → Sporophyt → Meiose → Spore."),
    solution: [
      { math: tx('"spore (n)"#a \\to "gametophyte (n)"#b \\to "fertilisation"#c', '"Spore (n)"#a \\to "Gametophyt (n)"#b \\to "Befruchtung"#c'), note: tx("The haploid phase: from the spore to the gametes.", "Die haploide Phase: von der Spore bis zu den Keimzellen.") },
      { math: tx('"zygote (2n)"#d \\to "sporophyte (2n)"#e \\to "meiosis"#f', '"Zygote (2n)"#d \\to "Sporophyt (2n)"#e \\to "Meiose"#f'), note: tx("The diploid phase: from the zygote to meiosis, which closes the cycle.", "Die diploide Phase: von der Zygote bis zur Meiose, die den Kreis schließt.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Haploid or diploid?

const PLOIDY: Text[] = [tx("haploid (n): one set of chromosomes", "haploid (n): ein Chromosomensatz"), tx("diploid (2n): two sets of chromosomes", "diploid (2n): zwei Chromosomensätze")];

type Struct = { name: Text; n: boolean; say: Text; title: Text };
const gameteSay = tx("Gametes are always haploid. In mosses and ferns they form by mitosis on the haploid gametophyte.", "Keimzellen sind immer haploid. Bei Moos und Farn entstehen sie durch Mitose am haploiden Gametophyten.");
const STRUCTS: Struct[] = [
  { name: tx("a moss spore", "eine Moosspore"), n: true, title: tx("Spores come from meiosis", "Sporen kommen aus der Meiose"), say: tx("Spores are made by meiosis. So they are haploid.", "Sporen entstehen durch Meiose. Also sind sie haploid.") },
  { name: tx("a fern spore", "eine Farnspore"), n: true, title: tx("Spores come from meiosis", "Sporen kommen aus der Meiose"), say: tx("Spores are made by meiosis in the sporangia. So they are haploid.", "Sporen entstehen durch Meiose in den Sporangien. Also sind sie haploid.") },
  { name: tx("the protonema of a moss", "der Vorkeim (Protonema) eines Mooses"), n: true, title: tx("Grown from a spore", "Aus einer Spore gewachsen"), say: tx("It grows from a haploid spore by mitosis: haploid.", "Er wächst durch Mitosen aus einer haploiden Spore: haploid.") },
  { name: tx("a cell of the green moss plant", "eine Zelle des grünen Moospflänzchens"), n: true, title: tx("The moss plant is the gametophyte", "Das Moospflänzchen ist der Gametophyt"), say: tx("Surprise: the green moss plant you know is the gametophyte. It is haploid.", "Überraschung: Das grüne Moospflänzchen, das du kennst, ist der Gametophyt. Es ist haploid.") },
  { name: tx("the egg cell in an archegonium", "die Eizelle im Archegonium"), n: true, title: tx("Gametes are haploid", "Keimzellen sind haploid"), say: gameteSay },
  { name: tx("a sperm cell of a fern", "ein Spermatozoid eines Farns"), n: true, title: tx("Gametes are haploid", "Keimzellen sind haploid"), say: gameteSay },
  { name: tx("a cell of the fern prothallium", "eine Zelle des Farnvorkeims (Prothallium)"), n: true, title: tx("The prothallium is the gametophyte", "Der Vorkeim ist der Gametophyt"), say: tx("The prothallium grows from a haploid spore: it is the haploid gametophyte.", "Der Vorkeim wächst aus einer haploiden Spore: Er ist der haploide Gametophyt.") },
  { name: tx("a pollen grain", "ein Pollenkorn"), n: true, title: tx("A tiny gametophyte", "Ein winziger Gametophyt"), say: tx("The pollen grain is the much reduced male gametophyte of seed plants: haploid.", "Das Pollenkorn ist der stark reduzierte männliche Gametophyt der Samenpflanzen: haploid.") },
  { name: tx("the nutritive tissue in a pine seed", "das Nährgewebe im Kiefernsamen"), n: true, title: tx("Gymnosperms are special", "Nacktsamer sind besonders"), say: tx("In gymnosperms the nutritive tissue is the female gametophyte: haploid. (In angiosperms the endosperm is triploid.)", "Bei Nacktsamern ist das Nährgewebe der weibliche Gametophyt: haploid. (Bei Bedecktsamern ist das Endosperm dagegen triploid.)") },
  { name: tx("the zygote of a moss", "die Zygote eines Mooses"), n: false, title: tx("n + n = 2n", "n + n = 2n"), say: tx("The zygote is made when two haploid gametes fuse: n + n = 2n.", "Die Zygote entsteht, wenn zwei haploide Keimzellen verschmelzen: n + n = 2n.") },
  { name: tx("the spore capsule of a moss", "die Sporenkapsel eines Mooses"), n: false, title: tx("Part of the sporophyte", "Teil des Sporophyten"), say: tx("Stalk and capsule are the sporophyte. It grows from the zygote: diploid, even though it is small and sits on the gametophyte.", "Stiel und Kapsel sind der Sporophyt. Er wächst aus der Zygote: diploid, auch wenn er klein ist und auf dem Gametophyten sitzt.") },
  { name: tx("a cell of a fern frond", "eine Zelle eines Farnwedels"), n: false, title: tx("The fern is the sporophyte", "Der Farn ist der Sporophyt"), say: tx("The big fern plant is the sporophyte: diploid.", "Die große Farnpflanze ist der Sporophyt: diploid.") },
  { name: tx("the rhizome of a fern", "das Rhizom eines Farns"), n: false, title: tx("The fern is the sporophyte", "Der Farn ist der Sporophyt"), say: tx("The rhizome belongs to the fern plant, the sporophyte: diploid.", "Das Rhizom gehört zur Farnpflanze, dem Sporophyten: diploid.") },
  { name: tx("a spore mother cell in a sporangium", "eine Sporenmutterzelle im Sporangium"), n: false, title: tx("Before meiosis", "Vor der Meiose"), say: tx("It is still diploid. Only its meiosis produces haploid spores.", "Sie ist noch diploid. Erst ihre Meiose ergibt haploide Sporen.") },
  { name: tx("the embryo in a bean seed", "der Embryo im Bohnensamen"), n: false, title: tx("From the zygote", "Aus der Zygote"), say: tx("The embryo grows from the zygote: diploid.", "Der Embryo wächst aus der Zygote: diploid.") },
  { name: tx("a leaf cell of an oak", "eine Blattzelle einer Eiche"), n: false, title: tx("The tree is the sporophyte", "Der Baum ist der Sporophyt"), say: tx("In seed plants the whole plant you see is the sporophyte: diploid.", "Bei Samenpflanzen ist die ganze sichtbare Pflanze der Sporophyt: diploid.") },
];

function ploidyTask(rng: Rng, fixed?: Struct): Exercise {
  const s = fixed ?? rng.pick(STRUCTS);
  const right = s.n ? 0 : 1;
  return {
    instruction: tx("Haploid or diploid?", "Haploid oder diploid?"),
    text: tx(`Is ${en(s.name)} haploid or diploid?`, `Ist ${de(s.name)} haploid oder diploid?`),
    answer: { kind: "choice", options: PLOIDY, correct: right },
    hint: tx("Meiosis makes spores (n); fertilisation makes the zygote (2n). Everything that grows from a spore is n, everything from a zygote is 2n.", "Meiose bildet Sporen (n), Befruchtung bildet die Zygote (2n). Alles, was aus einer Spore wächst, ist n; alles aus einer Zygote ist 2n."),
    solution: [{ math: q(PLOIDY[right], "ans"), note: s.say, highlight: ["ans"] }],
    mistakes: [{ when: { kind: "choice", options: PLOIDY, correct: 1 - right }, title: s.title, say: s.say }],
  };
}

function cyclePictureTask(rng: Rng): Exercise {
  const plant: CyclePlant = rng.chance(0.5) ? "moss" : "fern";
  const stages = CYCLES[plant].stages;
  const s = rng.pick(stages);
  if (rng.chance(0.5)) {
    const right = s.ploidy === "n" ? 0 : 1;
    const say = s.ploidy === "n" ? tx("Look where the stage sits: after meiosis and before fertilisation. That part of the cycle is haploid.", "Schau, wo das Stadium liegt: nach der Meiose und vor der Befruchtung. Dieser Teil des Zyklus ist haploid.") : tx("Look where the stage sits: after fertilisation and before meiosis. That part of the cycle is diploid.", "Schau, wo das Stadium liegt: nach der Befruchtung und vor der Meiose. Dieser Teil des Zyklus ist diploid.");
    return {
      instruction: tx("Which generation?", "Welche Generation?"),
      text: tx(`The life cycle of a ${plant === "moss" ? "moss" : "fern"} (without labels). Is the stage marked "?" haploid or diploid?`, `Der Entwicklungszyklus eines ${plant === "moss" ? "Mooses" : "Farns"} (ohne Beschriftung). Ist das mit „?“ markierte Stadium haploid oder diploid?`),
      visual: visual(CyclePicture, { plant, ask: s.id }),
      answer: { kind: "choice", options: PLOIDY, correct: right },
      hint: tx("Find meiosis and fertilisation in the ring: between them lie the haploid and the diploid phase.", "Such Meiose und Befruchtung im Ring: Zwischen ihnen liegen die haploide und die diploide Phase."),
      solution: [{ math: q(capT(s.name), "s"), note: s.info }, { math: q(PLOIDY[right], "ans"), note: s.ploidy === "n" ? tx("It belongs to the haploid phase.", "Es gehört zur haploiden Phase.") : tx("It belongs to the diploid phase.", "Es gehört zur diploiden Phase."), highlight: ["ans"] }],
      mistakes: [{ when: { kind: "choice", options: PLOIDY, correct: 1 - right }, title: tx("Check the phase", "Prüf die Phase"), say }],
    };
  }
  const wrong = pickSome(rng, stages.filter((x) => x.id !== s.id), 3);
  const { answer, mistakes } = choice(rng, [{ text: capT(s.name) }, ...wrong.map((w) => ({ text: capT(w.name), title: tx("Another stage", "Ein anderes Stadium"), say: tx(`${en(w.name)}: ${en(w.info)} Follow the arrows to the "?".`, `${de(w.name)}: ${de(w.info)} Folge den Pfeilen bis zum „?“.`) }))]);
  return {
    instruction: tx("Name the stage", "Benenne das Stadium"),
    text: tx(`The life cycle of a ${plant === "moss" ? "moss" : "fern"} (without labels). What is the stage marked "?"?`, `Der Entwicklungszyklus eines ${plant === "moss" ? "Mooses" : "Farns"} (ohne Beschriftung). Wie heißt das mit „?“ markierte Stadium?`),
    visual: visual(CyclePicture, { plant, ask: s.id }),
    answer,
    hint: tx("Start at the spores and follow the arrows round.", "Beginne bei den Sporen und folge den Pfeilen im Kreis."),
    solution: [{ math: q(capT(s.name), "ans"), note: s.info, highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Chromosome numbers through the cycle

type Organism = { name: Text; latin: string; group: "fern" | "moss" | "seed"; n: number; pine?: boolean };
const ORGANISMS: Organism[] = [
  { name: tx("male fern", "Wurmfarn"), latin: "Dryopteris filix-mas", group: "fern", n: 82 },
  { name: tx("bracken", "Adlerfarn"), latin: "Pteridium aquilinum", group: "fern", n: 52 },
  { name: tx("field horsetail", "Ackerschachtelhalm"), latin: "Equisetum arvense", group: "fern", n: 108 },
  { name: tx("common haircap moss", "Goldenes Frauenhaarmoos"), latin: "Polytrichum commune", group: "moss", n: 7 },
  { name: tx("common liverwort", "Brunnenlebermoos"), latin: "Marchantia polymorpha", group: "moss", n: 9 },
  { name: tx("Scots pine", "Waldkiefer"), latin: "Pinus sylvestris", group: "seed", n: 12, pine: true },
  { name: tx("maize", "Mais"), latin: "Zea mays", group: "seed", n: 10 },
  { name: tx("pea", "Erbse"), latin: "Pisum sativum", group: "seed", n: 7 },
  { name: tx("daisy", "Gänseblümchen"), latin: "Bellis perennis", group: "seed", n: 9 },
];
type Stage = { name: Text; two: boolean };
const STAGES: Record<Organism["group"], Stage[]> = {
  fern: [
    { name: tx("a cell of a frond", "eine Zelle eines Wedels"), two: true },
    { name: tx("a cell of the prothallium", "eine Zelle des Vorkeims (Prothallium)"), two: false },
    { name: tx("a spore", "eine Spore"), two: false },
    { name: tx("a sperm cell", "ein Spermatozoid"), two: false },
    { name: tx("the zygote", "die Zygote"), two: true },
    { name: tx("a spore mother cell before meiosis", "eine Sporenmutterzelle vor der Meiose"), two: true },
  ],
  moss: [
    { name: tx("a cell of a moss leaflet", "eine Zelle eines Moosblättchens"), two: false },
    { name: tx("a cell of the capsule stalk", "eine Zelle des Kapselstiels"), two: true },
    { name: tx("a spore", "eine Spore"), two: false },
    { name: tx("the egg cell", "die Eizelle"), two: false },
    { name: tx("the zygote", "die Zygote"), two: true },
  ],
  seed: [
    { name: tx("a leaf cell", "eine Blattzelle"), two: true },
    { name: tx("a pollen grain (its cell nuclei)", "ein Pollenkorn (seine Zellkerne)"), two: false },
    { name: tx("the egg cell", "die Eizelle"), two: false },
    { name: tx("the embryo in the seed", "der Embryo im Samen"), two: true },
  ],
};

function chromosomeTask(rng: Rng, fixed?: { o: Organism; known: Stage; asked: Stage }): Exercise {
  const o = fixed?.o ?? rng.pick(ORGANISMS);
  const stages = [...STAGES[o.group], ...(o.pine ? [{ name: tx("the nutritive tissue in the seed", "das Nährgewebe im Samen"), two: false }] : [])];
  let known = fixed?.known ?? rng.pick(stages);
  let asked = fixed?.asked ?? rng.pick(stages.filter((s) => s !== known));
  // Mostly across the generations, so the task needs thinking.
  if (!fixed && known.two === asked.two && rng.chance(0.7)) {
    const other = stages.filter((s) => s.two !== known.two);
    asked = rng.pick(other);
  }
  if (!fixed && rng.chance(0.15)) [known, asked] = [asked, known];
  const kv = known.two ? 2 * o.n : o.n;
  const av = asked.two ? 2 * o.n : o.n;
  const list: Mistake[] = [];
  const add = (v: number, title: Text, say: Text) => {
    if (v !== av && !list.some((m) => m.when.kind === "number" && m.when.value === v)) list.push({ when: { kind: "number", value: v }, title, say });
  };
  if (known.two && !asked.two) {
    add(kv, tx("Not halved", "Nicht halbiert"), tx(`${cap1(en(asked.name))} belongs to the haploid phase: after meiosis, only one set of chromosomes.`, `${cap1(de(asked.name))} gehört zur haploiden Phase: nach der Meiose nur noch ein Chromosomensatz.`));
    add(2 * kv, tx("Doubled instead of halved", "Verdoppelt statt halbiert"), tx("From the diploid to the haploid phase the number is halved by meiosis, not doubled.", "Von der diploiden zur haploiden Phase halbiert die Meiose die Zahl, sie verdoppelt sie nicht."));
  } else if (!known.two && asked.two) {
    add(kv, tx("Not doubled", "Nicht verdoppelt"), tx(`${cap1(en(asked.name))} belongs to the diploid phase: two gametes fused, so two sets of chromosomes.`, `${cap1(de(asked.name))} gehört zur diploiden Phase: Zwei Keimzellen sind verschmolzen, also zwei Chromosomensätze.`));
    add(kv / 2, tx("Halved instead of doubled", "Halbiert statt verdoppelt"), tx("Going from the haploid to the diploid phase (fertilisation) doubles the number.", "Von der haploiden zur diploiden Phase (Befruchtung) verdoppelt sich die Zahl."));
  } else {
    add(kv / 2, tx("Same phase", "Gleiche Phase"), tx("Both belong to the same phase of the cycle, so they have the same number of chromosomes.", "Beide gehören zur selben Phase des Zyklus, haben also gleich viele Chromosomen."));
    add(kv * 2, tx("Same phase", "Gleiche Phase"), tx("Both belong to the same phase of the cycle, so they have the same number of chromosomes.", "Beide gehören zur selben Phase des Zyklus, haben also gleich viele Chromosomen."));
  }
  return {
    instruction: tx("Chromosome numbers", "Chromosomenzahlen"),
    text: tx(`The ${en(o.name)} (${o.latin}): ${en(known.name)} has ${kv} chromosomes. How many chromosomes does ${en(asked.name)} have?`, `${de(o.name)} (${o.latin}): ${cap1(de(known.name))} hat ${kv} Chromosomen. Wie viele Chromosomen hat ${de(asked.name)}?`),
    answer: { kind: "number", value: av, label: tx("chromosomes", "Chromosomen") },
    hint: tx("Is each structure part of the haploid (n) or the diploid (2n) phase?", "Gehört die jeweilige Struktur zur haploiden (n) oder zur diploiden (2n) Phase?"),
    solution: [
      { math: tx(`"${known.two ? "2n" : "n"}" = ${kv} \\Rightarrow "n" = ${o.n}`, `"${known.two ? "2n" : "n"}" = ${kv} \\Rightarrow "n" = ${o.n}`), note: tx(`${cap1(en(known.name))} is ${known.two ? "diploid" : "haploid"}.`, `${cap1(de(known.name))} ist ${known.two ? "diploid" : "haploid"}.`) },
      { math: tx(`"${asked.two ? "2n" : "n"}" = ${av}#ans`, `"${asked.two ? "2n" : "n"}" = ${av}#ans`), note: tx(`${cap1(en(asked.name))} is ${asked.two ? "diploid" : "haploid"}: **${av}** chromosomes.`, `${cap1(de(asked.name))} ist ${asked.two ? "diploid" : "haploid"}: **${av}** Chromosomen.`), highlight: ["ans"] },
    ],
    mistakes: list,
  };
}
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Features of the groups

type GroupId = "mosses" | "ferns" | "gymno" | "angio";
const GROUP_NAME: Record<GroupId, Text> = { mosses: tx("mosses", "Moose"), ferns: tx("ferns and allies", "Farnpflanzen"), gymno: tx("gymnosperms", "Nacktsamer"), angio: tx("angiosperms", "Bedecktsamer") };
const GROUP_DAT: Record<GroupId, string> = { mosses: "Moosen", ferns: "Farnpflanzen", gymno: "Nacktsamern", angio: "Bedecktsamern" };

type Feat = { text: Text; in: GroupId[]; traps?: Partial<Record<GroupId, Text>> };
const FEATS: Feat[] = [
  { text: tx("true roots", "echte Wurzeln"), in: ["ferns", "gymno", "angio"], traps: { mosses: tx("Mosses have no true roots: they hold on with rhizoids and take up water over their whole surface.", "Moose haben keine echten Wurzeln: Sie halten sich mit Rhizoiden fest und nehmen Wasser über die ganze Oberfläche auf.") } },
  { text: tx("rhizoids instead of true roots", "Rhizoide statt echter Wurzeln"), in: ["mosses"], traps: { ferns: tx("Ferns have true roots on their rhizome. Only the tiny prothallium has rhizoids.", "Farne haben echte Wurzeln an ihrem Rhizom. Rhizoide hat nur der winzige Vorkeim.") } },
  { text: tx("vascular tissue with lignified walls", "Leitgewebe mit verholzten Zellwänden (Lignin)"), in: ["ferns", "gymno", "angio"], traps: { mosses: tx("Mosses have no lignified vascular tissue. That's why they stay small.", "Moose haben kein verholztes Leitgewebe. Deshalb bleiben sie klein.") } },
  { text: tx("seeds", "Samen"), in: ["gymno", "angio"], traps: { mosses: tx("Mosses make no seeds. They spread by spores.", "Moose bilden keine Samen. Sie verbreiten sich mit Sporen."), ferns: tx("Ferns have no seeds: the brown dots under the fronds contain spores.", "Farne haben keine Samen: Die braunen Häufchen unter den Wedeln enthalten Sporen.") } },
  { text: tx("spreading by spores instead of seeds", "Verbreitung durch Sporen statt Samen"), in: ["mosses", "ferns"] },
  { text: tx("fertilisation needs water (swimming sperm)", "Befruchtung nur mit Wasser (schwimmende Spermatozoiden)"), in: ["mosses", "ferns"], traps: { gymno: tx("Seed plants don't need water for fertilisation: pollen is carried by the wind and a pollen tube brings the sperm cells to the egg.", "Samenpflanzen brauchen zur Befruchtung kein Wasser: Der Wind trägt den Pollen, ein Pollenschlauch bringt die Spermazellen zur Eizelle.") } },
  { text: tx("pollen and a pollen tube", "Pollen und Pollenschlauch"), in: ["gymno", "angio"] },
  { text: tx("ovary and fruits", "Fruchtknoten und Früchte"), in: ["angio"], traps: { gymno: tx("Gymnosperms have no ovary and no fruits. Even the yew's red cup is a seed coat (aril), not a fruit.", "Nacktsamer haben keinen Fruchtknoten und keine Früchte. Auch der rote Becher der Eibe ist ein Samenmantel, keine Frucht.") } },
  { text: tx("ovules lying open on scales", "Samenanlagen frei auf Samenschuppen"), in: ["gymno"], traps: { angio: tx("In angiosperms the ovules are enclosed in the ovary: that's where their name comes from.", "Bei Bedecktsamern sind die Samenanlagen im Fruchtknoten eingeschlossen: Daher kommt ihr Name.") } },
  { text: tx("the gametophyte is the dominant generation", "der Gametophyt ist die vorherrschende Generation"), in: ["mosses"], traps: { ferns: tx("The big fern plant is the sporophyte. The gametophyte is the tiny prothallium.", "Die große Farnpflanze ist der Sporophyt. Der Gametophyt ist der winzige Vorkeim.") } },
  { text: tx("the sporophyte is the dominant generation", "der Sporophyt ist die vorherrschende Generation"), in: ["ferns", "gymno", "angio"], traps: { mosses: tx("In mosses the green plant is the gametophyte; the sporophyte is just the stalk with its capsule.", "Beim Moos ist die grüne Pflanze der Gametophyt; der Sporophyt ist nur der Stiel mit Kapsel.") } },
  { text: tx("flowers with a perianth (calyx and corolla)", "Blüten mit Blütenhülle (Kelch und Krone)"), in: ["angio"], traps: { gymno: tx("Conifers have no flowers with calyx and corolla, but cones.", "Nadelbäume haben keine Blüten mit Kelch und Krone, sondern Zapfen.") } },
  { text: tx("an embryo fed by the mother plant", "ein Embryo, der von der Mutterpflanze versorgt wird"), in: ["mosses", "ferns", "gymno", "angio"] },
];

function groupMultiTask(rng: Rng): Exercise {
  const g = rng.pick(["mosses", "ferns", "gymno", "angio"] as GroupId[]);
  const yes = FEATS.filter((f) => f.in.includes(g));
  const no = FEATS.filter((f) => !f.in.includes(g));
  const k = rng.int(2, 3);
  // Prefer the classic traps among the wrong ones.
  const trapNo = no.filter((f) => f.traps?.[g]);
  const wrongs = [...pickSome(rng, trapNo, Math.min(2, trapNo.length)), ...pickSome(rng, no.filter((f) => !f.traps?.[g]), 5)].slice(0, 5 - k);
  const opts: MultiOpt[] = [
    ...pickSome(rng, yes, k).map((f) => ({ text: capT(f.text), right: true })),
    ...wrongs.map((f) => ({ text: capT(f.text), right: false, title: tx("Not this group", "Nicht diese Gruppe"), say: f.traps?.[g] ?? tx(`That fits ${f.in.map((x) => en(GROUP_NAME[x])).join(", ")}, not the ${en(GROUP_NAME[g])}.`, `Das passt zu ${f.in.map((x) => GROUP_DAT[x]).join(", ")}, nicht zu ${GROUP_DAT[g]}.`) })),
  ];
  const { answer, mistakes } = multi(rng, opts);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx(`Which features do **${en(GROUP_NAME[g])}** have?`, `Welche Merkmale haben **${de(GROUP_NAME[g])}**?`),
    answer,
    hint: tx("Go up the cladogram: land plants, vascular plants, seed plants, angiosperms. Each step adds new features.", "Geh das Kladogramm hinauf: Landpflanzen, Gefäßpflanzen, Samenpflanzen, Bedecktsamer. Jede Stufe bringt neue Merkmale."),
    solution: [{ math: q(capT(GROUP_NAME[g]), "g"), note: tx(`${cap1(en(GROUP_NAME[g]))}: ${yes.map((f) => en(f.text)).join("; ")}.`, `${de(GROUP_NAME[g])}: ${yes.map((f) => de(f.text)).join("; ")}.`) }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Cladogram

const BAR_SHORT: Text[] = [
  tx("embryo, cuticle, spores with a tough wall", "Embryo, Cuticula, Sporen mit fester Wand"),
  tx("lignified vascular tissue, true roots", "Leitgewebe mit Lignin, echte Wurzeln"),
  tx("seeds and pollen", "Samen und Pollen"),
  tx("ovary, flower, fruit", "Fruchtknoten, Blüte, Frucht"),
];
const FIRST_ABOVE: CladeTip[] = ["mosses", "ferns", "gymno", "angio"];
const tipName = (t: CladeTip) => TIPS.find((x) => x.id === t)!.name;

function barTask(rng: Rng, fixed?: number): Exercise {
  const n = fixed ?? rng.int(1, 4);
  const opts: Opt[] = [{ text: BAR_SHORT[n - 1] }];
  const others = pickSome(rng, [1, 2, 3, 4].filter((m) => m !== n), 2);
  for (const m of others) {
    const say =
      m > n
        ? tx(`The ${en(tipName(FIRST_ABOVE[n - 1])).toLowerCase()} sit above bar ${n} but don't have ${en(BAR_SHORT[m - 1])}. So that feature arises further up.`, `${de(tipName(FIRST_ABOVE[n - 1]))} liegen oberhalb von Strich ${n}, haben aber nicht ${de(BAR_SHORT[m - 1])}. Dieses Merkmal entsteht also weiter oben.`)
        : tx(`${cap1(en(BAR_SHORT[m - 1]))}: the ${en(tipName(FIRST_ABOVE[m - 1])).toLowerCase()} have that too, and they branch off below bar ${n}. So it belongs further down.`, `${de(BAR_SHORT[m - 1])}: Das haben auch ${de(tipName(FIRST_ABOVE[m - 1]))}, und die zweigen unterhalb von Strich ${n} ab. Es gehört also weiter nach unten.`);
    opts.push({ text: BAR_SHORT[m - 1], title: tx("Wrong place on the stem", "Falsche Stelle am Stamm"), say });
  }
  opts.push({ text: tx("chlorophyll a and b, starch", "Chlorophyll a und b, Stärke"), title: tx("Older than land plants", "Älter als die Landpflanzen"), say: tx("Green algae have chlorophyll a and b and starch too. These features are shared by the whole group, not new on the stem.", "Auch Grünalgen haben Chlorophyll a und b und Stärke. Diese Merkmale teilen alle Gruppen, sie entstehen nicht neu am Stamm.") });
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Read the cladogram", "Lies das Kladogramm"),
    text: tx(`Which new features (apomorphies) belong at bar ${n}?`, `Welche neuen Merkmale (Apomorphien) gehören an Strich ${n}?`),
    visual: visual(DiversityCladogramPicture, { ask: n }),
    answer,
    hint: tx("A bar's features are shared by all groups above it and by none below it.", "Die Merkmale eines Strichs haben alle Gruppen oberhalb davon und keine darunter."),
    solution: [{ math: q(BAR_SHORT[n - 1], "ans"), note: tx(`Bar ${n} marks the ${en(BARS[n - 1].group)}: ${en(BARS[n - 1].features)}.`, `Strich ${n} kennzeichnet die ${de(BARS[n - 1].group)}: ${de(BARS[n - 1].features)}.`), highlight: ["ans"] }],
    mistakes,
  };
}

type Rel = { q: Text; right: Text; wrong: Opt[]; why: Text; tip?: CladeTip };
const RELS: Rel[] = [
  {
    q: tx("Which group is most closely related to the angiosperms?", "Welche Gruppe ist am nächsten mit den Bedecktsamern verwandt?"),
    right: tx("gymnosperms", "Nacktsamer"),
    wrong: [
      { text: tx("ferns and allies", "Farnpflanzen"), title: tx("Find the last common branch", "Such die letzte gemeinsame Verzweigung"), say: tx("Ferns branch off before bar 3. Angiosperms share their most recent ancestor with the gymnosperms: both have seeds.", "Farnpflanzen zweigen vor Strich 3 ab. Den jüngsten gemeinsamen Vorfahren teilen die Bedecktsamer mit den Nacktsamern: Beide haben Samen.") },
      { text: tx("mosses", "Moose"), title: tx("Too far down", "Zu weit unten"), say: tx("Mosses branch off right after bar 1. The closest relatives sit on the neighbouring branch.", "Moose zweigen gleich nach Strich 1 ab. Die nächsten Verwandten sitzen am Nachbarast.") },
      { text: tx("green algae", "Grünalgen"), title: tx("Too far down", "Zu weit unten"), say: tx("Green algae branch off first of all. The closest relatives sit on the neighbouring branch.", "Grünalgen zweigen als Allererste ab. Die nächsten Verwandten sitzen am Nachbarast.") },
    ],
    why: tx("Gymnosperms and angiosperms share a common ancestor that already had seeds (bar 3). They are sister groups.", "Nackt- und Bedecktsamer haben einen gemeinsamen Vorfahren, der schon Samen hatte (Strich 3). Sie sind Schwestergruppen."),
    tip: "angio",
  },
  {
    q: tx("Which feature do ferns share with seed plants but not with mosses?", "Welches Merkmal haben Farnpflanzen mit den Samenpflanzen gemeinsam, aber nicht mit den Moosen?"),
    right: tx("lignified vascular tissue and true roots", "Leitgewebe mit Lignin und echte Wurzeln"),
    wrong: [
      { text: tx("seeds", "Samen"), title: tx("Ferns have spores", "Farne haben Sporen"), say: tx("Ferns spread by spores. Seeds only come with bar 3.", "Farne verbreiten sich mit Sporen. Samen kommen erst mit Strich 3.") },
      { text: tx("an embryo and a cuticle", "Embryo und Cuticula"), title: tx("Mosses have that too", "Das haben Moose auch"), say: tx("Embryo and cuticle came with bar 1, so mosses have them too.", "Embryo und Cuticula kamen mit Strich 1, Moose haben sie also auch.") },
      { text: tx("fertilisation in water", "Befruchtung im Wasser"), title: tx("Not seed plants", "Nicht bei Samenpflanzen"), say: tx("Ferns and mosses need water for fertilisation; seed plants don't.", "Farne und Moose brauchen Wasser zur Befruchtung, Samenpflanzen nicht.") },
    ],
    why: tx("Bar 2 lies above the mosses and below ferns and seed plants: lignified vascular tissue and true roots.", "Strich 2 liegt oberhalb der Moose und unterhalb von Farn- und Samenpflanzen: verholztes Leitgewebe und echte Wurzeln."),
    tip: "ferns",
  },
  {
    q: tx("Which statement about the cladogram is right?", "Welche Aussage zum Kladogramm stimmt?"),
    right: tx("Ferns are more closely related to seed plants than to mosses.", "Farnpflanzen sind näher mit den Samenpflanzen verwandt als mit den Moosen."),
    wrong: [
      { text: tx("Today's mosses are the ancestors of today's ferns.", "Die heutigen Moose sind die Vorfahren der heutigen Farne."), title: tx("Cousins, not parents", "Cousins, keine Eltern"), say: tx("All groups at the tips live today. They share common ancestors at the branch points, but none of them is the ancestor of another.", "Alle Gruppen an den Spitzen leben heute. Sie haben gemeinsame Vorfahren an den Verzweigungen, aber keine ist der Vorfahr einer anderen.") },
      { text: tx("Gymnosperms are more closely related to mosses than to angiosperms.", "Nacktsamer sind näher mit den Moosen verwandt als mit den Bedecktsamern."), title: tx("Look for the last branch", "Such die letzte Verzweigung"), say: tx("Gymnosperms and angiosperms share the youngest common ancestor (after bar 3).", "Nackt- und Bedecktsamer haben den jüngsten gemeinsamen Vorfahren (nach Strich 3).") },
      { text: tx("Green algae are land plants without roots.", "Grünalgen sind Landpflanzen ohne Wurzeln."), title: tx("Before bar 1", "Vor Strich 1"), say: tx("Green algae branch off before bar 1: they don't have the features of land plants and live in water.", "Grünalgen zweigen vor Strich 1 ab: Sie haben die Merkmale der Landpflanzen nicht und leben im Wasser.") },
    ],
    why: tx("Ferns and seed plants share a common ancestor after bar 2; the mosses branched off earlier.", "Farn- und Samenpflanzen haben einen gemeinsamen Vorfahren nach Strich 2; die Moose sind früher abgezweigt."),
  },
];

function relTask(rng: Rng): Exercise {
  const r = rng.pick(RELS);
  const { answer, mistakes } = choice(rng, [{ text: capT(r.right) }, ...r.wrong.map((w) => ({ ...w, text: capT(w.text) }))]);
  return {
    instruction: tx("Relationships", "Verwandtschaft"),
    text: r.q,
    visual: visual(DiversityCladogramPicture, { tip: r.tip }),
    answer,
    hint: tx("The closer two groups are, the younger their last common branch point.", "Je näher zwei Gruppen verwandt sind, desto jünger ist ihre letzte gemeinsame Verzweigung."),
    solution: [{ math: q(capT(r.right), "ans"), note: r.why, highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Gymnosperm or angiosperm? Monocot or dicot?

type Ex = { name: Text; yes: boolean; trap?: Text };
const NAKED: Ex[] = [
  { name: tx("Scots pine", "Waldkiefer"), yes: true },
  { name: tx("spruce", "Fichte"), yes: true },
  { name: tx("silver fir", "Weißtanne"), yes: true },
  { name: tx("larch", "Lärche"), yes: true, trap: tx("It sheds its needles like a broadleaf tree, but its seeds lie open on cone scales: a gymnosperm.", "Sie wirft ihre Nadeln ab wie ein Laubbaum, aber ihre Samen liegen frei auf Zapfenschuppen: ein Nacktsamer.") },
  { name: tx("yew", "Eibe"), yes: true, trap: tx("The red cup is a seed coat (aril), not a fruit: there is no ovary. The yew is a gymnosperm.", "Der rote Becher ist ein Samenmantel, keine Frucht: Es gibt keinen Fruchtknoten. Die Eibe ist ein Nacktsamer.") },
  { name: tx("ginkgo", "Ginkgo"), yes: true, trap: tx("The ginkgo looks like a broadleaf tree and drops its leaves, but its ovules lie open: a gymnosperm and a living fossil.", "Der Ginkgo sieht aus wie ein Laubbaum und wirft sein Laub ab, aber seine Samenanlagen liegen frei: ein Nacktsamer und ein lebendes Fossil.") },
  { name: tx("juniper", "Wacholder"), yes: true, trap: tx("Juniper \"berries\" are fleshy cones, not fruits: a gymnosperm.", "„Wacholderbeeren“ sind fleischige Beerenzapfen, keine Früchte: ein Nacktsamer.") },
  { name: tx("cycad (sago palm)", "Palmfarn"), yes: true, trap: tx("Neither palm nor fern: it makes seeds on open ovules, a gymnosperm.", "Weder Palme noch Farn: Er bildet Samen an freien Samenanlagen, ein Nacktsamer.") },
  { name: tx("oak", "Eiche"), yes: false },
  { name: tx("silver birch", "Hängebirke"), yes: false, trap: tx("Catkins aren't cones: the birch has ovaries in its female catkins and forms small winged fruits.", "Kätzchen sind keine Zapfen: Die Birke hat Fruchtknoten in den weiblichen Kätzchen und bildet kleine geflügelte Früchte.") },
  { name: tx("apple tree", "Apfelbaum"), yes: false },
  { name: tx("tulip", "Tulpe"), yes: false },
  { name: tx("wheat", "Weizen"), yes: false, trap: tx("Wheat flowers look plain, but each grain is a fruit grown from an ovary: an angiosperm.", "Weizenblüten sehen unscheinbar aus, aber jedes Korn ist eine Frucht aus einem Fruchtknoten: ein Bedecktsamer.") },
  { name: tx("horse chestnut", "Rosskastanie"), yes: false },
];
const NAKED_OPTS: Text[] = [tx("gymnosperm (seeds open on scales)", "Nacktsamer (Samen frei auf Schuppen)"), tx("angiosperm (seeds enclosed in an ovary)", "Bedecktsamer (Samen im Fruchtknoten)")];

function nakedTask(rng: Rng): Exercise {
  const e = rng.pick(NAKED);
  const right = e.yes ? 0 : 1;
  const say = e.trap ?? (e.yes ? tx("Its seeds lie open on cone scales, no ovary around them: a gymnosperm.", "Seine Samen liegen frei auf Zapfenschuppen, ohne Fruchtknoten: ein Nacktsamer.") : tx("It has flowers with an ovary and forms fruits: an angiosperm.", "Er hat Blüten mit Fruchtknoten und bildet Früchte: ein Bedecktsamer."));
  return {
    instruction: tx("Gymnosperm or angiosperm?", "Nacktsamer oder Bedecktsamer?"),
    text: tx(`**${cap1(en(e.name))}**: gymnosperm or angiosperm?`, `**${de(e.name)}**: Nacktsamer oder Bedecktsamer?`),
    answer: { kind: "choice", options: NAKED_OPTS, correct: right },
    hint: tx("Does it have an ovary that becomes a fruit, or do the seeds lie open on scales?", "Gibt es einen Fruchtknoten, aus dem eine Frucht wird, oder liegen die Samen frei auf Schuppen?"),
    solution: [{ math: join(q(capT(e.name), "p"), "\\Rightarrow#r", q(NAKED_OPTS[right], "ans")), note: say, highlight: ["ans"] }],
    mistakes: [{ when: { kind: "choice", options: NAKED_OPTS, correct: 1 - right }, title: e.trap ? tx("Looks can deceive", "Der Schein trügt") : tx("Look at the seeds", "Schau auf die Samen"), say }],
  };
}

const MONO_OPTS: Text[] = [tx("monocot", "einkeimblättrig"), tx("dicot", "zweikeimblättrig")];
const MONO_EX: Ex[] = [
  { name: tx("tulip", "Tulpe"), yes: true },
  { name: tx("maize", "Mais"), yes: true },
  { name: tx("wheat", "Weizen"), yes: true },
  { name: tx("snowdrop", "Schneeglöckchen"), yes: true },
  { name: tx("orchid", "Orchidee"), yes: true },
  { name: tx("onion", "Küchenzwiebel"), yes: true },
  { name: tx("lily of the valley", "Maiglöckchen"), yes: true },
  { name: tx("coconut palm", "Kokospalme"), yes: true, trap: tx("Palms are monocots too: parallel-veined leaves, scattered bundles. Their trunk thickens without a cambium.", "Auch Palmen sind einkeimblättrig: parallelnervige Blätter, zerstreute Leitbündel. Ihr Stamm wird ohne Kambium dick.") },
  { name: tx("bamboo", "Bambus"), yes: true, trap: tx("Bamboo is a grass and so a monocot, even if it grows as tall as a tree.", "Bambus ist ein Gras und damit einkeimblättrig, auch wenn er so hoch wird wie ein Baum.") },
  { name: tx("oak", "Eiche"), yes: false },
  { name: tx("rose", "Rose"), yes: false },
  { name: tx("pea", "Erbse"), yes: false },
  { name: tx("sunflower", "Sonnenblume"), yes: false },
  { name: tx("oilseed rape", "Raps"), yes: false },
  { name: tx("wood anemone", "Buschwindröschen"), yes: false, trap: tx("Not every early bloomer is a monocot: the wood anemone has net-veined, divided leaves and a ring of bundles. It's a dicot.", "Nicht jeder Frühblüher ist einkeimblättrig: Das Buschwindröschen hat netznervige, geteilte Blätter und ringförmige Leitbündel. Es ist zweikeimblättrig.") },
  { name: tx("dandelion", "Löwenzahn"), yes: false },
  { name: tx("bean", "Bohne"), yes: false },
];

function monoDiTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const f = rng.pick(FEATURES);
    const g: Group = rng.chance(0.5) ? "mono" : "di";
    const right = g === "mono" ? 0 : 1;
    return {
      instruction: tx("Monocot or dicot?", "Ein- oder zweikeimblättrig?"),
      text: tx(`${en(f.name)}: which group does a plant with this feature belong to?`, `${de(f.name)}: Zu welcher Gruppe gehört eine Pflanze mit diesem Merkmal?`),
      visual: visual(DiversityMonoDiPicture, { f: f.id as MonoDiFeature, group: g }),
      answer: { kind: "choice", options: MONO_OPTS, correct: right },
      hint: tx("Monocots: parallel veins, scattered bundles, parts in threes, fibrous roots, one seed leaf.", "Einkeimblättrige: parallelnervig, zerstreute Leitbündel, dreizählig, Büschelwurzeln, ein Keimblatt."),
      solution: [{ math: q(MONO_OPTS[right], "ans"), note: tx(`The picture shows: ${en(f[g])}.`, `Das Bild zeigt: ${de(f[g])}.`), highlight: ["ans"] }],
      mistakes: [{ when: { kind: "choice", options: MONO_OPTS, correct: 1 - right }, title: tx("Look again", "Schau noch mal"), say: tx(`Monocots: ${en(f.mono)}. Dicots: ${en(f.di)}. Which one does the picture show?`, `Einkeimblättrige: ${de(f.mono)}. Zweikeimblättrige: ${de(f.di)}. Was zeigt das Bild?`) }],
    };
  }
  const e = rng.pick(MONO_EX);
  const right = e.yes ? 0 : 1;
  const say = e.trap ?? (e.yes ? tx("Parallel-veined leaves, flower parts in threes, one seed leaf: a monocot.", "Parallelnervige Blätter, dreizählige Blüten, ein Keimblatt: einkeimblättrig.") : tx("Net-veined leaves, flower parts in fours or fives, two seed leaves: a dicot.", "Netznervige Blätter, vier- oder fünfzählige Blüten, zwei Keimblätter: zweikeimblättrig."));
  return {
    instruction: tx("Monocot or dicot?", "Ein- oder zweikeimblättrig?"),
    text: tx(`**${cap1(en(e.name))}**: monocot or dicot?`, `**${de(e.name)}**: ein- oder zweikeimblättrig?`),
    answer: { kind: "choice", options: MONO_OPTS, correct: right },
    hint: tx("Picture the leaves: parallel veins or a net? And the flower: in threes or in fives?", "Stell dir die Blätter vor: parallele Nerven oder ein Netz? Und die Blüte: dreizählig oder fünfzählig?"),
    solution: [{ math: join(q(capT(e.name), "p"), "\\Rightarrow#r", q(MONO_OPTS[right], "ans")), note: say, highlight: ["ans"] }],
    mistakes: [{ when: { kind: "choice", options: MONO_OPTS, correct: 1 - right }, title: e.trap ? tx("Looks can deceive", "Der Schein trügt") : tx("Check the leaves", "Prüf die Blätter"), say }],
  };
}

// ---------------------------------------------------------------------------
// Ranks and names

const RANKS: Text[] = [tx("kingdom", "Reich"), tx("division (phylum)", "Abteilung"), tx("class", "Klasse"), tx("order", "Ordnung"), tx("family", "Familie"), tx("genus", "Gattung"), tx("species", "Art")];

function ranksTask(rng: Rng, fixed?: number[]): Exercise {
  const k = rng.int(5, 6);
  const idx = fixed ?? pickSome(rng, [0, 1, 2, 3, 4, 5, 6], k).sort((a, b) => a - b);
  const items = idx.map((i) => capT(RANKS[i]));
  const list: Mistake[] = [];
  const has = (i: number) => idx.includes(i);
  if (has(4) && has(5)) list.push({ when: { kind: "order", items: [capT(RANKS[5]), capT(RANKS[4])] }, title: tx("A family holds genera", "Eine Familie umfasst Gattungen"), say: tx("A family contains several genera, a genus several species. So: family above genus above species.", "Eine Familie umfasst mehrere Gattungen, eine Gattung mehrere Arten. Also: Familie über Gattung über Art.") });
  if (has(2) && has(3)) list.push({ when: { kind: "order", items: [capT(RANKS[3]), capT(RANKS[2])] }, title: tx("Class above order", "Klasse über Ordnung"), say: tx("A class contains several orders, an order several families.", "Eine Klasse umfasst mehrere Ordnungen, eine Ordnung mehrere Familien.") });
  if (has(5) && has(6)) list.push({ when: { kind: "order", items: [capT(RANKS[6]), capT(RANKS[5])] }, title: tx("Species is the smallest", "Die Art ist am kleinsten"), say: tx("The species is the basic unit; several species form a genus.", "Die Art ist die Grundeinheit; mehrere Arten bilden eine Gattung.") });
  return {
    instruction: tx("Order the ranks", "Ordne die Rangstufen"),
    text: tx("Put the taxonomic ranks in order, from the largest group to the smallest.", "Ordne die systematischen Rangstufen von der größten Gruppe zur kleinsten."),
    answer: { kind: "order", items },
    hint: tx("Kingdom … species. Remember: a family contains genera, a genus contains species.", "Reich … Art. Merk dir: Eine Familie umfasst Gattungen, eine Gattung umfasst Arten."),
    solution: [{ math: join(...idx.map((i, j) => q(capT(RANKS[i]), `r${j}`)).flatMap((t, j) => (j ? ["\\to", t] : [t]))), note: tx("From kingdom down to species, every rank contains several of the next.", "Vom Reich bis zur Art enthält jede Rangstufe mehrere der nächsten.") }],
    mistakes: list,
  };
}

const RANK_A: Record<number, [string, string]> = { 0: ["a kingdom", "ein Reich"], 3: ["an order", "eine Ordnung"], 4: ["a family", "eine Familie"], 5: ["a genus", "eine Gattung"], 6: ["a species", "eine Art"] };

type Named = { name: string; rank: 0 | 3 | 4 | 5 | 6; de: Text };
const NAMES: Named[] = [
  { name: "Plantae", rank: 0, de: tx("the plant kingdom", "das Pflanzenreich") },
  { name: "Asterales", rank: 3, de: tx("the aster order", "die Asternartigen") },
  { name: "Rosales", rank: 3, de: tx("the rose order", "die Rosenartigen") },
  { name: "Fabales", rank: 3, de: tx("the legume order", "die Schmetterlingsblütenartigen") },
  { name: "Lamiales", rank: 3, de: tx("the mint order", "die Lippenblütlerartigen") },
  { name: "Pinales", rank: 3, de: tx("the conifers", "die Kiefernartigen") },
  { name: "Asteraceae", rank: 4, de: tx("the daisy family", "die Korbblütler") },
  { name: "Rosaceae", rank: 4, de: tx("the rose family", "die Rosengewächse") },
  { name: "Fabaceae", rank: 4, de: tx("the pea family", "die Hülsenfrüchtler") },
  { name: "Lamiaceae", rank: 4, de: tx("the mint family", "die Lippenblütler") },
  { name: "Brassicaceae", rank: 4, de: tx("the crucifers", "die Kreuzblütler") },
  { name: "Poaceae", rank: 4, de: tx("the grasses", "die Süßgräser") },
  { name: "Pinaceae", rank: 4, de: tx("the pine family", "die Kieferngewächse") },
  { name: "Bellis", rank: 5, de: tx("the daisies", "die Gänseblümchen") },
  { name: "Quercus", rank: 5, de: tx("the oaks", "die Eichen") },
  { name: "Acer", rank: 5, de: tx("the maples", "die Ahorne") },
  { name: "Pinus", rank: 5, de: tx("the pines", "die Kiefern") },
  { name: "Taraxacum", rank: 5, de: tx("the dandelions", "die Löwenzähne") },
  { name: "Bellis perennis", rank: 6, de: tx("the common daisy", "das Gänseblümchen") },
  { name: "Quercus robur", rank: 6, de: tx("the pedunculate oak", "die Stieleiche") },
  { name: "Acer platanoides", rank: 6, de: tx("the Norway maple", "der Spitzahorn") },
  { name: "Pinus sylvestris", rank: 6, de: tx("the Scots pine", "die Waldkiefer") },
  { name: "Rosa canina", rank: 6, de: tx("the dog rose", "die Hundsrose") },
];

function rankNameTask(rng: Rng): Exercise {
  const N = rng.pick(NAMES);
  const pool = [0, 3, 4, 5, 6].filter((r) => r !== N.rank);
  const wrongRanks = pickSome(rng, pool.filter((r) => Math.abs(r - N.rank) <= 2 && r !== 0), 3).concat(pickSome(rng, pool, 3)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
  const says: Record<string, [Text, Text]> = {
    "4>3": [tx("-aceae is a family", "-aceae ist eine Familie"), tx("Family names end in -aceae (Rosaceae), order names in -ales (Rosales).", "Familiennamen enden auf -aceae (Rosaceae), Ordnungsnamen auf -ales (Rosales).")],
    "3>4": [tx("-ales is an order", "-ales ist eine Ordnung"), tx("Order names end in -ales, family names in -aceae.", "Ordnungsnamen enden auf -ales, Familiennamen auf -aceae.")],
    "6>5": [tx("Two words: a species", "Zwei Wörter: eine Art"), tx("A species name always has two parts: genus + specific epithet. One word alone is the genus.", "Ein Artname hat immer zwei Teile: Gattung + Artepitheton. Ein einzelnes Wort ist die Gattung.")],
    "5>6": [tx("One word: a genus", "Ein Wort: eine Gattung"), tx("A single capitalised word is the genus. A species needs a second word, the specific epithet.", "Ein einzelnes großgeschriebenes Wort ist die Gattung. Zur Art gehört ein zweites Wort, das Artepitheton.")],
    "5>4": [tx("No -aceae ending", "Keine Endung -aceae"), tx("Family names end in -aceae. This one-word name without that ending is a genus.", "Familiennamen enden auf -aceae. Dieser einteilige Name ohne diese Endung ist eine Gattung.")],
    "4>5": [tx("-aceae is a family", "-aceae ist eine Familie"), tx("The ending -aceae marks a family. A genus name has no fixed ending.", "Die Endung -aceae kennzeichnet eine Familie. Gattungsnamen haben keine feste Endung.")],
  };
  const opts: Opt[] = [{ text: capT(RANKS[N.rank]) }, ...wrongRanks.map((r) => {
    const s = says[`${N.rank}>${r}`];
    return s ? { text: capT(RANKS[r]), title: s[0], say: s[1] } : { text: capT(RANKS[r]) };
  })];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Which rank?", "Welche Rangstufe?"),
    text: tx(`Which rank does the scientific name **${N.name}** (${en(N.de)}) stand for?`, `Für welche Rangstufe steht der wissenschaftliche Name **${N.name}** (${de(N.de)})?`),
    answer,
    hint: tx("Two words: species. One word: genus. Ending -aceae: family. Ending -ales: order.", "Zwei Wörter: Art. Ein Wort: Gattung. Endung -aceae: Familie. Endung -ales: Ordnung."),
    solution: [{ math: join(q(sci(N.name), "n"), "\\Rightarrow#r", q(capT(RANKS[N.rank]), "ans")), note: tx(`**${N.name}** names ${RANK_A[N.rank][0]}.`, `**${N.name}** bezeichnet ${RANK_A[N.rank][1]}.`), highlight: ["ans"] }],
    mistakes,
  };
}

type Spelled = { right: string; de: Text };
const SPELL: Spelled[] = [
  { right: "Bellis perennis", de: tx("common daisy", "Gänseblümchen") },
  { right: "Quercus robur", de: tx("pedunculate oak", "Stieleiche") },
  { right: "Fagus sylvatica", de: tx("common beech", "Rotbuche") },
  { right: "Taxus baccata", de: tx("yew", "Eibe") },
  { right: "Larix decidua", de: tx("European larch", "Europäische Lärche") },
  { right: "Taraxacum officinale", de: tx("dandelion", "Löwenzahn") },
  { right: "Aesculus hippocastanum", de: tx("horse chestnut", "Rosskastanie") },
];

function spellTask(rng: Rng): Exercise {
  const s = rng.pick(SPELL);
  const [g, e] = s.right.split(" ");
  const C = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const opts: Opt[] = [
    { text: sci(s.right) },
    { text: sci(`${g.toLowerCase()} ${e}`), title: tx("Genus with a capital", "Gattung groß"), say: tx("The genus name is always written with a capital letter.", "Der Gattungsname wird immer großgeschrieben.") },
    { text: sci(`${g} ${C(e)}`), title: tx("Epithet in lower case", "Artepitheton klein"), say: tx("The specific epithet is always written in lower case, even if it comes from a name.", "Das Artepitheton wird immer kleingeschrieben, auch wenn es von einem Namen abgeleitet ist.") },
    { text: sci(`${C(e)} ${g.toLowerCase()}`), title: tx("Genus first", "Gattung zuerst"), say: tx("The genus comes first, then the specific epithet: like a surname followed by a first name.", "Zuerst kommt die Gattung, dann das Artepitheton: wie Nachname und Vorname.") },
  ];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Binomial names", "Binäre Nomenklatur"),
    text: tx(`Which is the correct scientific name of the ${en(s.de)}? (In print it is written in italics.)`, `Wie lautet der korrekte wissenschaftliche Name: ${de(s.de)}? (Gedruckt wird er kursiv gesetzt.)`),
    answer,
    hint: tx("Linnaeus: genus (capital letter) + specific epithet (lower case).", "Linné: Gattung (groß) + Artepitheton (klein)."),
    solution: [{ math: join(q(tx("genus", "Gattung"), "g"), "+", q(tx("specific epithet", "Artepitheton"), "e")), note: tx(`So: **${s.right}**. Genus ${g}, epithet ${e}.`, `Also: **${s.right}**. Gattung ${g}, Artepitheton ${e}.`) }],
    mistakes,
  };
}

type Kin = { right: Text; wrong: Opt[]; why: Text };
const KIN: Kin[] = [
  {
    right: tx("Acer pseudoplatanus and Acer campestre", "Acer pseudoplatanus und Acer campestre"),
    wrong: [
      { text: tx("Acer pseudoplatanus and Platanus orientalis", "Acer pseudoplatanus und Platanus orientalis"), title: tx("A false plane", "Eine falsche Platane"), say: tx("pseudoplatanus means \"false plane\": the sycamore maple only looks a bit like a plane tree. Its genus is Acer.", "pseudoplatanus heißt „falsche Platane“: Der Bergahorn sieht einer Platane nur ähnlich. Seine Gattung ist Acer.") },
      { text: tx("Quercus robur and Fagus sylvatica", "Quercus robur und Fagus sylvatica"), title: tx("Different genera", "Verschiedene Gattungen"), say: tx("Oak and beech are in the same family, but in different genera. Two species of one genus are closer.", "Eiche und Buche gehören zur selben Familie, aber zu verschiedenen Gattungen. Zwei Arten einer Gattung sind näher verwandt.") },
      { text: tx("Pinus sylvestris and Fagus sylvatica", "Pinus sylvestris und Fagus sylvatica"), title: tx("The epithet says little", "Das Epitheton sagt wenig"), say: tx("sylvestris and sylvatica both just mean \"of the forest\". Relationship shows in the genus, the first word.", "sylvestris und sylvatica heißen beide nur „im Wald wachsend“. Verwandtschaft zeigt die Gattung, das erste Wort.") },
    ],
    why: tx("Same genus name, Acer: sycamore maple and field maple are the closest relatives here.", "Gleicher Gattungsname Acer: Bergahorn und Feldahorn sind hier am nächsten verwandt."),
  },
  {
    right: tx("Lamium album and Lamium purpureum", "Lamium album und Lamium purpureum"),
    wrong: [
      { text: tx("Lamium album and Urtica dioica", "Lamium album und Urtica dioica"), title: tx("Common names deceive", "Deutsche Namen täuschen"), say: tx("White dead-nettle and stinging nettle share \"nettle\" in their common names, but they are in different families. The genus name tells the truth.", "Weiße Taubnessel und Brennnessel teilen sich nur das Wort „Nessel“, gehören aber zu verschiedenen Familien. Der Gattungsname verrät die Wahrheit.") },
      { text: tx("Lamium album and Bellis perennis", "Lamium album und Bellis perennis"), title: tx("Different families", "Verschiedene Familien"), say: tx("Different genera and even different families: mint family and daisy family.", "Verschiedene Gattungen und sogar Familien: Lippenblütler und Korbblütler.") },
      { text: tx("Urtica dioica and Bellis perennis", "Urtica dioica und Bellis perennis"), title: tx("Different families", "Verschiedene Familien"), say: tx("Different genera and families. Look for two species of the same genus.", "Verschiedene Gattungen und Familien. Such zwei Arten derselben Gattung.") },
    ],
    why: tx("Both are Lamium: white and red dead-nettle are two species of one genus.", "Beide heißen Lamium: Weiße und Purpurrote Taubnessel sind zwei Arten einer Gattung."),
  },
  {
    right: tx("Quercus robur and Quercus petraea", "Quercus robur und Quercus petraea"),
    wrong: [
      { text: tx("Quercus robur and Fagus sylvatica", "Quercus robur und Fagus sylvatica"), title: tx("Different genera", "Verschiedene Gattungen"), say: tx("Oak and beech share a family (Fagaceae) but not a genus.", "Eiche und Buche teilen sich die Familie (Fagaceae), aber nicht die Gattung.") },
      { text: tx("Quercus robur and Rosa canina", "Quercus robur und Rosa canina"), title: tx("Different families", "Verschiedene Familien"), say: tx("Oak and rose aren't even in the same family.", "Eiche und Rose gehören nicht einmal zur selben Familie.") },
      { text: tx("Fagus sylvatica and Pinus sylvestris", "Fagus sylvatica und Pinus sylvestris"), title: tx("The epithet says little", "Das Epitheton sagt wenig"), say: tx("A similar epithet means nothing: one is an angiosperm, the other a gymnosperm.", "Ein ähnliches Epitheton heißt nichts: Das eine ist ein Bedecktsamer, das andere ein Nacktsamer.") },
    ],
    why: tx("Same genus Quercus: pedunculate and sessile oak are two species of oak.", "Gleiche Gattung Quercus: Stiel- und Traubeneiche sind zwei Eichenarten."),
  },
  {
    right: tx("Trifolium pratense and Trifolium repens", "Trifolium pratense und Trifolium repens"),
    wrong: [
      { text: tx("Trifolium pratense and Bellis perennis", "Trifolium pratense und Bellis perennis"), title: tx("Heads deceive", "Köpfchen täuschen"), say: tx("A clover head looks like a daisy head, but clover belongs to the pea family, the daisy to the composites.", "Ein Kleeköpfchen sieht aus wie ein Körbchen, aber Klee gehört zu den Schmetterlingsblütlern, das Gänseblümchen zu den Korbblütlern.") },
      { text: tx("Bellis perennis and Taraxacum officinale", "Bellis perennis und Taraxacum officinale"), title: tx("Same family only", "Nur gleiche Familie"), say: tx("Daisy and dandelion are both composites, but in different genera.", "Gänseblümchen und Löwenzahn sind beide Korbblütler, aber verschiedene Gattungen.") },
      { text: tx("Trifolium repens and Taraxacum officinale", "Trifolium repens und Taraxacum officinale"), title: tx("Different families", "Verschiedene Familien"), say: tx("Different genera and families. Look for the same first word.", "Verschiedene Gattungen und Familien. Such das gleiche erste Wort.") },
    ],
    why: tx("Both are Trifolium: red and white clover belong to one genus.", "Beide heißen Trifolium: Rot- und Weißklee gehören zu einer Gattung."),
  },
];

function kinTask(rng: Rng, fixed?: Kin): Exercise {
  const k = fixed ?? rng.pick(KIN);
  const { answer, mistakes } = choice(rng, [{ text: k.right }, ...k.wrong]);
  return {
    instruction: tx("Closest relatives", "Nächste Verwandte"),
    text: tx("Which two species are most closely related?", "Welche zwei Arten sind am nächsten miteinander verwandt?"),
    answer,
    hint: tx("The first word of a species name is the genus. Species of one genus are the closest relatives.", "Das erste Wort eines Artnamens ist die Gattung. Arten einer Gattung sind am nächsten verwandt."),
    solution: [{ math: q(k.right, "ans"), note: k.why, highlight: ["ans"] }],
    mistakes,
  };
}

type GenusQ = { name: string; de: Text };
const GENUS_Q: GenusQ[] = [
  { name: "Quercus robur", de: tx("pedunculate oak", "Stieleiche") },
  { name: "Fagus sylvatica", de: tx("common beech", "Rotbuche") },
  { name: "Acer platanoides", de: tx("Norway maple", "Spitzahorn") },
  { name: "Tilia cordata", de: tx("small-leaved lime", "Winterlinde") },
  { name: "Betula pendula", de: tx("silver birch", "Hängebirke") },
  { name: "Picea abies", de: tx("Norway spruce", "Gemeine Fichte") },
  { name: "Abies alba", de: tx("silver fir", "Weißtanne") },
  { name: "Pinus sylvestris", de: tx("Scots pine", "Waldkiefer") },
  { name: "Galanthus nivalis", de: tx("snowdrop", "Schneeglöckchen") },
  { name: "Anemone nemorosa", de: tx("wood anemone", "Buschwindröschen") },
  { name: "Pisum sativum", de: tx("pea", "Erbse") },
  { name: "Lamium album", de: tx("white dead-nettle", "Weiße Taubnessel") },
  { name: "Helianthus annuus", de: tx("sunflower", "Sonnenblume") },
  { name: "Dryopteris filix-mas", de: tx("male fern", "Wurmfarn") },
];

function genusTask(rng: Rng): Exercise {
  const G = rng.pick(GENUS_Q);
  const [g, e] = G.name.split(" ");
  const askGenus = rng.chance(0.65);
  const right = askGenus ? g : e;
  const wrong = askGenus ? e : g;
  return {
    instruction: askGenus ? tx("Name the genus", "Nenne die Gattung") : tx("Name the epithet", "Nenne das Artepitheton"),
    text: askGenus
      ? tx(`The scientific name of the ${en(G.de)} is **${G.name}**. What is its genus name?`, `Der wissenschaftliche Name: ${de(G.de)} heißt **${G.name}**. Wie lautet der Gattungsname?`)
      : tx(`The scientific name of the ${en(G.de)} is **${G.name}**. What is its specific epithet?`, `Der wissenschaftliche Name: ${de(G.de)} heißt **${G.name}**. Wie lautet das Artepitheton?`),
    answer: { kind: "word", accept: [right], placeholder: askGenus ? tx("genus", "Gattung") : tx("epithet", "Artepitheton") },
    hint: tx("Binomial name = genus (first word, capital letter) + specific epithet (second word, lower case).", "Binärer Name = Gattung (erstes Wort, groß) + Artepitheton (zweites Wort, klein)."),
    solution: [{ math: join(q(tx("genus", "Gattung"), "g"), "+", q(tx("specific epithet", "Artepitheton"), "e")), note: tx(`${G.name}: genus **${g}**, specific epithet **${e}**.`, `${G.name}: Gattung **${g}**, Artepitheton **${e}**.`) }],
    mistakes: [
      { when: { kind: "word", accept: [wrong] }, title: askGenus ? tx("That's the epithet", "Das ist das Artepitheton") : tx("That's the genus", "Das ist die Gattung"), say: askGenus ? tx("The second word is the specific epithet. The genus is the first word.", "Das zweite Wort ist das Artepitheton. Die Gattung ist das erste Wort.") : tx("The first word is the genus. The specific epithet is the second word.", "Das erste Wort ist die Gattung. Das Artepitheton ist das zweite Wort.") },
      { when: { kind: "word", accept: [G.name] }, title: tx("Only one part", "Nur ein Teil"), say: tx("The whole name is the species. The question asks for just one of its two parts.", "Der ganze Name ist die Art. Gefragt ist nur einer der beiden Teile.") },
    ],
  };
}

// ---------------------------------------------------------------------------
// The move onto land

const ADAPT: [Text, Text][] = [
  [tx("cuticle", "Cuticula"), tx("protects against drying out", "schützt vor Austrocknung")],
  [tx("stomata", "Spaltöffnungen"), tx("let CO₂ in despite the wax layer, adjustable", "lassen trotz Wachsschicht regelbar CO₂ hinein")],
  [tx("lignified vascular tissue", "verholztes Leitgewebe"), tx("supports the plant and carries water up: tall growth", "stützt und leitet Wasser nach oben: Höhenwachstum")],
  [tx("roots", "Wurzeln"), tx("take up water and minerals from the soil", "nehmen Wasser und Mineralstoffe aus dem Boden auf")],
  [tx("pollen with a pollen tube", "Pollen mit Pollenschlauch"), tx("fertilisation without water", "Befruchtung ohne Wasser")],
  [tx("seed", "Samen"), tx("protects the embryo with food, survives dry times", "schützt den Embryo mit Vorrat, übersteht Trockenzeiten")],
];

function adaptTask(rng: Rng): Exercise {
  const idx = pickSome(rng, [0, 1, 2, 3, 4, 5], 4).sort((a, b) => a - b);
  const pairs = idx.map((i) => [capT(ADAPT[i][0]), ADAPT[i][1]] as [Text, Text]);
  const list: Mistake[] = [];
  const swap = (a: number, b: number, title: Text, say: Text) => {
    if (idx.includes(a) && idx.includes(b))
      list.push({
        when: {
          kind: "match",
          pairs: [
            [capT(ADAPT[a][0]), ADAPT[b][1]],
            [capT(ADAPT[b][0]), ADAPT[a][1]],
          ],
        },
        title,
        say,
      });
  };
  swap(0, 1, tx("Seal and door", "Abdichtung und Tür"), tx("The cuticle seals the leaf against water loss. Stomata are the adjustable doors that still let CO₂ in.", "Die Cuticula dichtet das Blatt gegen Wasserverlust ab. Spaltöffnungen sind die regelbaren Türen, durch die trotzdem CO₂ hineinkommt."));
  swap(4, 5, tx("Pollen or seed?", "Pollen oder Samen?"), tx("Pollen brings the sperm cells to the egg (fertilisation). The seed comes afterwards: it protects and spreads the embryo.", "Pollen bringt die Spermazellen zur Eizelle (Befruchtung). Der Samen kommt danach: Er schützt und verbreitet den Embryo."));
  swap(2, 3, tx("Support or uptake?", "Stütze oder Aufnahme?"), tx("Roots take water up from the soil; lignified vascular tissue carries it up and keeps the plant upright.", "Wurzeln nehmen das Wasser aus dem Boden auf; verholztes Leitgewebe leitet es nach oben und hält die Pflanze aufrecht."));
  const rest = [0, 1, 2, 3, 4, 5].filter((i) => !idx.includes(i));
  return {
    instruction: tx("Life on land", "Leben an Land"),
    text: tx("Match each adaptation of land plants to the problem it solves.", "Ordne jede Angepasstheit der Landpflanzen dem Problem zu, das sie löst."),
    answer: { kind: "match", pairs, distractors: rng.chance(0.5) ? [ADAPT[rng.pick(rest)][1]] : undefined },
    hint: tx("On land a plant must not dry out, must stand without buoyancy, get water from the soil and reproduce without water.", "An Land darf eine Pflanze nicht austrocknen, muss ohne Auftrieb stehen, Wasser aus dem Boden holen und sich ohne Wasser fortpflanzen."),
    solution: [{ math: join(q(capT(ADAPT[idx[0]][0]), "a"), "\\to", q(ADAPT[idx[0]][1], "b")), note: tx("Each adaptation answers one problem of life on land.", "Jede Angepasstheit beantwortet ein Problem des Landlebens.") }, { math: join(q(capT(ADAPT[idx[1]][0]), "c"), "\\to", q(ADAPT[idx[1]][1], "d")), note: tx("And so on for the others.", "Und so weiter für die anderen.") }],
    mistakes: list,
  };
}

/** Experiment: water loss of a moss cushion and a twig with leaves (example values). */
function dryTask(rng: Rng): Exercise {
  const moss = rng.int(11, 15) * 5;
  const twig = rng.int(2, 4) * 4;
  const variant = rng.int(0, 1);
  const right = variant === 0 ? tx("Mosses have hardly any cuticle and no regulated stomata on their leaflets: they lose water over their whole surface.", "Moose haben kaum Cuticula und keine regelbaren Spaltöffnungen an den Blättchen: Sie verlieren Wasser über die ganze Oberfläche.") : tx("It takes up water over its whole surface and becomes active again: mosses are poikilohydric (their water content follows the surroundings).", "Es nimmt über die ganze Oberfläche Wasser auf und wird wieder aktiv: Moose sind wechselfeucht (poikilohydr).");
  const wrong: Opt[] =
    variant === 0
      ? [
          { text: tx("Mosses use up more water in photosynthesis.", "Moose verbrauchen bei der Fotosynthese mehr Wasser."), title: tx("Evaporation, not use", "Verdunstung, nicht Verbrauch"), say: tx("Photosynthesis uses only a tiny part of the water. The loss is evaporation through the unprotected surface.", "Die Fotosynthese verbraucht nur einen winzigen Teil des Wassers. Der Verlust ist Verdunstung über die ungeschützte Oberfläche.") },
          { text: tx("Mosses have more stomata than oak leaves.", "Moose haben mehr Spaltöffnungen als Eichenblätter."), title: tx("No stomata on the leaflets", "Keine Spaltöffnungen an den Blättchen"), say: tx("Moss leaflets have no stomata at all. Without a cuticle, water simply evaporates through the cells.", "Moosblättchen haben gar keine Spaltöffnungen. Ohne Cuticula verdunstet das Wasser einfach durch die Zellen.") },
          { text: tx("Mosses have roots that pump water out.", "Moose haben Wurzeln, die Wasser hinauspumpen."), title: tx("No roots", "Keine Wurzeln"), say: tx("Mosses have no roots, only rhizoids for holding on.", "Moose haben keine Wurzeln, nur Rhizoide zum Festhalten.") },
        ]
      : [
          { text: tx("It stays dead: dried-out mosses can't recover.", "Es bleibt tot: Ausgetrocknete Moose erholen sich nicht."), title: tx("Mosses can wait", "Moose können warten"), say: tx("Many mosses survive drying out for weeks and come back to life when wet: they are poikilohydric.", "Viele Moose überstehen wochenlanges Austrocknen und werden bei Nässe wieder aktiv: Sie sind wechselfeucht.") },
          { text: tx("It takes up water only through its roots, very slowly.", "Es nimmt Wasser nur über seine Wurzeln auf, sehr langsam."), title: tx("No roots", "Keine Wurzeln"), say: tx("Mosses have no roots. They soak up water like a sponge over their whole surface.", "Moose haben keine Wurzeln. Sie saugen Wasser wie ein Schwamm über die ganze Oberfläche auf.") },
          { text: tx("It immediately forms seeds to survive.", "Es bildet sofort Samen, um zu überleben."), title: tx("Mosses have no seeds", "Moose haben keine Samen"), say: tx("Mosses make no seeds, only spores.", "Moose bilden keine Samen, nur Sporen.") },
        ];
  const { answer, mistakes } = choice(rng, [{ text: right }, ...wrong]);
  return {
    instruction: tx("Interpret the experiment", "Werte den Versuch aus"),
    text:
      variant === 0
        ? tx(`A moss cushion and a twig with leaves are weighed and left in a dry room. After 6 hours the moss has lost ${moss} % of its mass, the twig ${twig} % (example values). How do you explain the difference?`, `Ein Moospolster und ein beblätterter Zweig werden gewogen und in einem trockenen Raum liegen gelassen. Nach 6 Stunden hat das Moos ${moss} % seiner Masse verloren, der Zweig ${twig} % (Beispielwerte). Wie erklärst du den Unterschied?`)
        : tx(`A moss cushion has lost ${moss} % of its mass after a few dry days and looks grey and dead. What happens when it rains?`, `Ein Moospolster hat nach einigen trockenen Tagen ${moss} % seiner Masse verloren und sieht grau und tot aus. Was passiert, wenn es regnet?`),
    answer,
    hint: tx("Think of the adaptations to life on land that mosses lack: cuticle, stomata, vascular tissue, roots.", "Denk an die Angepasstheiten an das Landleben, die Moosen fehlen: Cuticula, Spaltöffnungen, Leitgewebe, Wurzeln."),
    solution: [{ math: tx('"no cuticle" \\Rightarrow "water exchange over the surface"', '"keine Cuticula" \\Rightarrow "Wasseraustausch über die Oberfläche"'), note: right }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  switch (rng.int(0, 15)) {
    case 0:
      return cycleOrderTask(rng);
    case 1:
    case 2:
      return ploidyTask(rng);
    case 3:
      return cyclePictureTask(rng);
    case 4:
      return chromosomeTask(rng);
    case 5:
      return groupMultiTask(rng);
    case 6:
      return barTask(rng);
    case 7:
      return relTask(rng);
    case 8:
      return nakedTask(rng);
    case 9:
      return monoDiTask(rng);
    case 10:
      return ranksTask(rng);
    case 11:
      return rankNameTask(rng);
    case 12:
      return rng.chance(0.5) ? spellTask(rng) : kinTask(rng);
    case 13:
      return genusTask(rng);
    case 14:
      return adaptTask(rng);
    default:
      return dryTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const checkBar = barTask(createRng(17), 2);
const checkProthallium = ploidyTask(createRng(2), STRUCTS.find((s) => en(s.name).includes("prothallium"))!);
const malefern = ORGANISMS[0];
const checkChromosomes = chromosomeTask(createRng(5), { o: malefern, known: STAGES.fern[0], asked: STAGES.fern[1] });
const checkKin = kinTask(createRng(12), KIN[0]);

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Out of the water: the move onto land", "Raus aus dem Wasser: der Landgang"),
      blob: tx("Half a billion years ago, plants left the water. It wasn't easy!", "Vor fast einer halben Milliarde Jahren verließen die Pflanzen das Wasser. Leicht war das nicht!"),
      body: tx("Land plants descend from freshwater green algae (their closest living relatives are stoneworts and conjugating algae). Like them they have chlorophyll a and b, store starch and build cellulose walls. On land, every problem needed a new answer.", "Die Landpflanzen stammen von Grünalgen des Süßwassers ab (heute lebende nächste Verwandte: Armleuchter- und Jochalgen). Wie diese haben sie Chlorophyll a und b, speichern Stärke und bauen Zellwände aus Cellulose. An Land brauchte jedes Problem eine neue Lösung."),
      frames: [
        { math: tx('"drying out"#p \\to "cuticle, stomata"#s', '"Austrocknung"#p \\to "Cuticula, Spaltöffnungen"#s'), note: tx("Against drying out: a waxy **cuticle**. So that CO₂ still gets in: adjustable **stomata**.", "Gegen Austrocknung: eine wachsartige **Cuticula**. Damit trotzdem CO₂ hineinkommt: regelbare **Spaltöffnungen**.") },
        { math: tx('"no buoyancy"#p \\to "lignin, vascular tissue"#s', '"kein Auftrieb"#p \\to "Lignin, Leitgewebe"#s'), note: tx("Without the buoyancy of water: **lignin** stiffens the cell walls, **vascular tissue** (xylem, phloem) carries water and sugar over long distances. Plants can grow tall.", "Ohne den Auftrieb des Wassers: **Lignin** verholzt die Zellwände, **Leitgewebe** (Xylem, Phloem) transportiert Wasser und Zucker über weite Strecken. Pflanzen können hoch wachsen.") },
        { math: tx('"water in the soil"#p \\to "roots"#s', '"Wasser im Boden"#p \\to "Wurzeln"#s'), note: tx("True **roots** take up water and minerals and anchor the plant.", "Echte **Wurzeln** nehmen Wasser und Mineralstoffe auf und verankern die Pflanze.") },
        { math: tx('"reproduction"#p \\to "spores, pollen, seeds"#s', '"Fortpflanzung"#p \\to "Sporen, Pollen, Samen"#s'), note: tx("Spores with a tough wall survive the dry air. Mosses and ferns still need water for fertilisation; seed plants bring the sperm cells to the egg in a **pollen tube**, and the **seed** protects the embryo.", "Sporen mit fester Wand überstehen die trockene Luft. Moose und Farne brauchen zur Befruchtung noch Wasser; Samenpflanzen bringen die Spermazellen im **Pollenschlauch** zur Eizelle, und der **Samen** schützt den Embryo.") },
      ],
    },
    {
      type: "widget",
      title: tx("The family tree of land plants", "Der Stammbaum der Landpflanzen"),
      blob: tx("Tap the bars and the groups. Who has which feature?", "Tipp auf die Striche und die Gruppen. Wer hat welches Merkmal?"),
      body: tx("In a **cladogram** the groups sit at the tips. Each bar on the stem marks new features (apomorphies). All groups above a bar share it, because they descend from one common ancestor.", "In einem **Kladogramm** stehen die Gruppen an den Spitzen. Jeder Strich am Stamm markiert neue Merkmale (Apomorphien). Alle Gruppen oberhalb eines Strichs teilen sie, weil sie von einem gemeinsamen Vorfahren abstammen."),
      widget: DiversityCladogram,
    },
    { type: "check", blob: tx("Which features came with bar 2?", "Welche Merkmale kamen mit Strich 2?"), exercise: checkBar },
    {
      type: "explain",
      title: tx("Alternation of generations", "Generationswechsel"),
      blob: tx("Two generations take turns: one haploid, one diploid!", "Zwei Generationen wechseln sich ab: eine haploid, eine diploid!"),
      body: tx("All land plants alternate between a haploid **gametophyte** (n), which makes gametes, and a diploid **sporophyte** (2n), which makes spores.", "Alle Landpflanzen wechseln zwischen einem haploiden **Gametophyten** (n), der Keimzellen bildet, und einem diploiden **Sporophyten** (2n), der Sporen bildet."),
      frames: [
        { math: tx('"sporophyte (2n)"#a \\to "meiosis"#m \\to "spores (n)"#b', '"Sporophyt (2n)"#a \\to "Meiose"#m \\to "Sporen (n)"#b'), note: tx("The sporophyte forms spores by **meiosis**: they are haploid.", "Der Sporophyt bildet durch **Meiose** Sporen: Sie sind haploid."), highlight: ["m"] },
        { math: tx('"spores (n)"#b \\to "gametophyte (n)"#c \\to "gametes (n)"#d', '"Sporen (n)"#b \\to "Gametophyt (n)"#c \\to "Keimzellen (n)"#d'), note: tx("From the spore grows the gametophyte. It forms egg and sperm cells by **mitosis**: it is already haploid.", "Aus der Spore wächst der Gametophyt. Er bildet Eizellen und Spermatozoiden durch **Mitose**: Er ist ja schon haploid."), highlight: ["c"] },
        { math: tx('"gametes (n)"#d \\to "fertilisation"#f \\to "zygote (2n)"#e', '"Keimzellen (n)"#d \\to "Befruchtung"#f \\to "Zygote (2n)"#e'), note: tx("Sperm cells swim through water to the egg cell. **Fertilisation** gives the diploid zygote, and from it the sporophyte grows again.", "Spermatozoiden schwimmen durch Wasser zur Eizelle. Die **Befruchtung** ergibt die diploide Zygote, aus ihr wächst wieder der Sporophyt."), highlight: ["f"] },
        { math: tx('"moss: gametophyte" \\quad "fern: sporophyte"', '"Moos: Gametophyt" \\quad "Farn: Sporophyt"'), note: tx("The big difference: in the moss the green plant is the **gametophyte** and the sporophyte lives on it. In the fern the big plant is the **sporophyte** and the gametophyte is a tiny prothallium.", "Der große Unterschied: Beim Moos ist die grüne Pflanze der **Gametophyt**, der Sporophyt lebt auf ihm. Beim Farn ist die große Pflanze der **Sporophyt**, der Gametophyt ist ein winziger Vorkeim.") },
      ],
    },
    {
      type: "widget",
      title: tx("Moss and fern life cycles", "Entwicklungszyklus von Moos und Farn"),
      blob: tx("Step through both cycles. Spot the dominant generation!", "Geh beide Zyklen durch. Finde die vorherrschende Generation!"),
      body: tx("Purple: haploid phase (gametophyte). Orange: diploid phase (sporophyte). The bars mark meiosis and fertilisation. The dominant generation is drawn larger.", "Lila: haploide Phase (Gametophyt). Orange: diploide Phase (Sporophyt). Die Balken markieren Meiose und Befruchtung. Die vorherrschende Generation ist größer gezeichnet."),
      widget: DiversityLifeCycle,
    },
    { type: "check", blob: tx("A tiny green heart on the forest floor. Haploid or diploid?", "Ein winziges grünes Herz auf dem Waldboden. Haploid oder diploid?"), exercise: checkProthallium },
    { type: "check", blob: tx("Let's count chromosomes through the cycle.", "Zählen wir Chromosomen durch den Zyklus."), exercise: checkChromosomes },
    {
      type: "widget",
      title: tx("Seed plants: naked and enclosed seeds", "Samenpflanzen: nackte und bedeckte Samen"),
      blob: tx("Open the rows and compare the two big groups of flowering plants.", "Öffne die Zeilen und vergleich die beiden großen Gruppen der Blütenpflanzen."),
      body: tx("**Gymnosperms** (conifers, ginkgo) carry their ovules openly on scales; they form no fruits. **Angiosperms** enclose their ovules in an ovary that becomes the fruit. Angiosperms are divided into **monocots** and **dicots**. (Modern systematics replaces the dicots by the true dicots, the eudicots, because a few old lineages don't fit.)", "**Nacktsamer** (Nadelbäume, Ginkgo) tragen ihre Samenanlagen frei auf Schuppen; sie bilden keine Früchte. **Bedecktsamer** schließen ihre Samenanlagen in einen Fruchtknoten ein, aus dem die Frucht wird. Die Bedecktsamer teilt man in **Einkeimblättrige** und **Zweikeimblättrige**. (Die moderne Systematik ersetzt die Zweikeimblättrigen durch die „echten Zweikeimblättrigen“, die Eudikotyledonen, weil einige alte Linien nicht passen.)"),
      widget: DiversityMonoDi,
    },
    {
      type: "explain",
      title: tx("Ranks and names", "Rangstufen und Namen"),
      blob: tx("Every plant has a name that biologists understand worldwide!", "Jede Pflanze hat einen Namen, den Biologen weltweit verstehen!"),
      body: tx("Carl Linnaeus (1707–1778) sorted living things into ranks and gave every species a two-part name: the **binomial nomenclature**.", "Carl von Linné (1707–1778) ordnete die Lebewesen in Rangstufen und gab jeder Art einen zweiteiligen Namen: die **binäre Nomenklatur**."),
      frames: [
        { math: tx('"kingdom" \\to "division" \\to "class" \\to "order" \\\\ \\to "family" \\to "genus" \\to "species"', '"Reich" \\to "Abteilung" \\to "Klasse" \\to "Ordnung" \\\\ \\to "Familie" \\to "Gattung" \\to "Art"'), note: tx("From large to small. Each rank contains several of the next. (For animals the division is called phylum, Stamm.)", "Von groß nach klein. Jede Rangstufe enthält mehrere der nächsten. (Bei Tieren heißt die Abteilung Stamm.)") },
        { math: tx('"family:"#a \\; "Asteraceae"#b \\quad "order:"#c \\; "Asterales"#d', '"Familie:"#a \\; "Asteraceae"#b \\quad "Ordnung:"#c \\; "Asterales"#d'), note: tx("Family names end in **-aceae** (Asteraceae, the daisy family), order names in **-ales** (Asterales).", "Familiennamen enden auf **-aceae** (Asteraceae, die Korbblütler), Ordnungsnamen auf **-ales** (Asterales).") },
        { math: tx('"Bellis"#g \\; "perennis"#e \\; "(daisy)"#x', '"Bellis"#g \\; "perennis"#e \\; "(Gänseblümchen)"#x'), note: tx("The species name has two parts: the **genus** (capital letter) and the **specific epithet** (lower case). In print both are in italics.", "Der Artname hat zwei Teile: die **Gattung** (groß) und das **Artepitheton** (klein). Gedruckt stehen beide kursiv."), highlight: ["g"] },
        { math: tx('"Acer"#g \\; "platanoides" \\; "(Norway maple)" \\\\ "Acer"#h \\; "pseudoplatanus" \\; "(sycamore)"', '"Acer"#g \\; "platanoides" \\; "(Spitzahorn)" \\\\ "Acer"#h \\; "pseudoplatanus" \\; "(Bergahorn)"'), note: tx("Same genus, close relatives: Norway maple and sycamore maple. The genus name shows the relationship.", "Gleiche Gattung, nahe Verwandte: Spitzahorn und Bergahorn. Der Gattungsname zeigt die Verwandtschaft."), highlight: ["g", "h"] },
      ],
    },
    { type: "check", blob: tx("Watch out, one name is a trick!", "Vorsicht, ein Name ist eine Falle!"), exercise: checkKin },
  ],
  summary: [
    {
      title: tx("The groups of land plants", "Die Gruppen der Landpflanzen"),
      examples: [
        tx('"mosses: no true roots, no lignin"', '"Moose: keine echten Wurzeln, kein Lignin"'),
        tx('"ferns: vascular tissue, roots, spores"', '"Farnpflanzen: Leitgewebe, Wurzeln, Sporen"'),
        tx('"gymnosperms: seeds open on scales"', '"Nacktsamer: Samen frei auf Schuppen"'),
        tx('"angiosperms: ovary, flower, fruit"', '"Bedecktsamer: Fruchtknoten, Blüte, Frucht"'),
      ],
      tone: "rule",
    },
    {
      title: tx("The move onto land", "Der Landgang"),
      body: tx("Cuticle and stomata against drying out, lignified vascular tissue for support and transport, roots for water uptake, pollen and seeds for reproduction without water.", "Cuticula und Spaltöffnungen gegen Austrocknung, verholztes Leitgewebe für Stütze und Transport, Wurzeln zur Wasseraufnahme, Pollen und Samen für die Fortpflanzung ohne Wasser."),
      tone: "rule",
    },
    {
      title: tx("Alternation of generations", "Generationswechsel"),
      examples: [
        tx('"sporophyte (2n)" \\to "meiosis" \\to "spore (n)"', '"Sporophyt (2n)" \\to "Meiose" \\to "Spore (n)"'),
        tx('"gametophyte (n)" \\to "mitosis" \\to "gametes"', '"Gametophyt (n)" \\to "Mitose" \\to "Keimzellen"'),
        tx('"fertilisation" \\to "zygote (2n)"', '"Befruchtung" \\to "Zygote (2n)"'),
      ],
      body: tx("Moss: the green plant is the gametophyte, the sporophyte (stalk and capsule) lives on it. Fern: the plant is the sporophyte, the gametophyte is a small prothallium.", "Moos: Die grüne Pflanze ist der Gametophyt, der Sporophyt (Stiel und Kapsel) lebt auf ihm. Farn: Die Pflanze ist der Sporophyt, der Gametophyt ist ein kleiner Vorkeim."),
      tone: "rule",
    },
    {
      title: tx("Monocots and dicots", "Ein- und Zweikeimblättrige"),
      examples: [
        tx('"monocots: 1 seed leaf, parallel veins, parts in threes"', '"Einkeimblättrige: 1 Keimblatt, parallelnervig, dreizählig"'),
        tx('"dicots: 2 seed leaves, net veins, ring of bundles"', '"Zweikeimblättrige: 2 Keimblätter, netznervig, Leitbündelring"'),
      ],
      tone: "tip",
    },
    {
      title: tx("Ranks and names", "Rangstufen und Namen"),
      examples: [tx('"kingdom, division, class, order, family, genus, species"', '"Reich, Abteilung, Klasse, Ordnung, Familie, Gattung, Art"'), tx('"Bellis perennis = genus + epithet"', '"Bellis perennis = Gattung + Artepitheton"')],
      body: tx("Family names end in -aceae, orders in -ales. Genus capitalised, epithet in lower case, both in italics.", "Familien enden auf -aceae, Ordnungen auf -ales. Gattung groß, Artepitheton klein, beide kursiv."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Mosses have neither roots nor seeds. Spores are haploid; plant gametes form by mitosis. The green moss plant is the gametophyte, the fern plant the sporophyte. Ginkgo, yew and larch are gymnosperms. Living groups are not each other's ancestors.", "Moose haben weder Wurzeln noch Samen. Sporen sind haploid; Keimzellen der Pflanzen entstehen durch Mitose. Das grüne Moospflänzchen ist der Gametophyt, die Farnpflanze der Sporophyt. Ginkgo, Eibe und Lärche sind Nacktsamer. Heutige Gruppen sind nicht die Vorfahren voneinander."),
      tone: "warning",
    },
  ],
};
