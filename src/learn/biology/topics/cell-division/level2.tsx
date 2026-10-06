"use client";

// Level 2 (Klasse 9–10): the cell cycle, one- and two-chromatid chromosomes, the phases of
// mitosis, and meiosis as the division that makes haploid sex cells.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { DivisionChromosomes } from "@/learn/biology/visuals/DivisionChromosomes";
import { DivisionPhase, type ModelSize, type MitosisStage } from "@/learn/biology/visuals/DivisionScene";
import { DivisionScrubber } from "@/learn/biology/visuals/DivisionScrubber";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { HUMAN, ORGANISMS, type Organism } from "./data";
import { choice, inOrder, mistakesFor, num, some, visual, weighted, type Opt } from "./kit";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

const PH = {
  inter: tx("Interphase", "Interphase"),
  g1: tx("G1 phase", "G1-Phase"),
  s: tx("S phase", "S-Phase"),
  g2: tx("G2 phase", "G2-Phase"),
  pro: tx("Prophase", "Prophase"),
  meta: tx("Metaphase", "Metaphase"),
  ana: tx("Anaphase", "Anaphase"),
  telo: tx("Telophase", "Telophase"),
  cyto: tx("Cytokinesis", "Cytokinese"),
  mitosis: tx("Mitosis", "Mitose"),
};

// ---------------------------------------------------------------------------
// Put in order

const MITO_NAMES = [PH.inter, PH.pro, PH.meta, PH.ana, PH.telo, PH.cyto];
const EV = {
  rep: tx("The DNA is replicated.", "Die DNA wird repliziert."),
  cond: tx("The chromosomes condense, the nuclear envelope breaks down.", "Die Chromosomen kondensieren, die Kernhülle löst sich auf."),
  plate: tx("The chromosomes lie in the equatorial plane.", "Die Chromosomen liegen in der Äquatorialebene."),
  apart: tx("The sister chromatids move to opposite poles.", "Die Schwesterchromatiden wandern zu entgegengesetzten Polen."),
  nuclei: tx("New nuclear envelopes form.", "Neue Kernhüllen bilden sich."),
  cyto: tx("The cytoplasm is divided.", "Das Zellplasma wird geteilt."),
};
const MITO_EVENTS = Object.values(EV);
const CYCLE = [PH.g1, PH.s, PH.g2, PH.mitosis, PH.cyto];
const MEIO = {
  rep: tx("The DNA is replicated.", "Die DNA wird repliziert."),
  pair: tx("Homologous chromosomes pair up.", "Homologe Chromosomen legen sich paarweise zusammen."),
  hom: tx("Homologous chromosomes are separated.", "Homologe Chromosomen werden getrennt."),
  two: tx("Two haploid cells form.", "Zwei haploide Zellen entstehen."),
  sis: tx("Sister chromatids are separated.", "Schwesterchromatiden werden getrennt."),
  four: tx("Four haploid sex cells form.", "Vier haploide Keimzellen entstehen."),
};
const MEIO_LIST = Object.values(MEIO);

type OrderKind = "names" | "events" | "cycle" | "meiosis";

function orderExercise(kind: OrderKind, items: Text[]): Exercise {
  const mistakes: Mistake[] = [];
  const add = (a: Text, b: Text, title: Text, say: Text) => {
    if (items.includes(a) && items.includes(b)) mistakes.push({ when: { kind: "order", items: [a, b] }, title, say });
  };
  const metaAna = [tx("Line up before separating", "Erst anordnen, dann trennen"), tx("Nearly! The chromatids can only be pulled apart once all chromosomes are lined up in the equatorial plane (metaphase).", "Fast! Die Chromatiden können erst getrennt werden, wenn alle Chromosomen in der Äquatorialebene stehen (Metaphase).")] as const;
  if (kind === "names") {
    add(PH.ana, PH.meta, ...metaAna);
    add(PH.meta, PH.pro, tx("Condense first", "Erst kondensieren"), tx("Before the chromosomes can line up, they have to condense and the nuclear envelope has to break down: that's prophase.", "Bevor sich die Chromosomen anordnen können, müssen sie kondensieren und die Kernhülle muss sich auflösen: Das ist die Prophase."));
    add(PH.pro, PH.inter, tx("Interphase comes first", "Interphase zuerst"), tx("The chromosomes have to be replicated before mitosis, and that happens in interphase.", "Die Chromosomen müssen vor der Mitose verdoppelt werden, und das passiert in der Interphase."));
    add(PH.cyto, PH.telo, tx("Nuclei before cytoplasm", "Erst Kerne, dann Zellplasma"), tx("First the nuclei are finished (telophase), then the cytoplasm is split (cytokinesis).", "Erst werden die Kerne fertig (Telophase), dann wird das Zellplasma geteilt (Cytokinese)."));
  } else if (kind === "events") {
    add(EV.apart, EV.plate, ...metaAna);
    add(EV.cond, EV.rep, tx("Replicate first", "Erst replizieren"), tx("The DNA is replicated in interphase, while it is still decondensed. Condensing comes later, in prophase.", "Die DNA wird in der Interphase repliziert, solange sie noch entspiralisiert ist. Kondensiert wird erst später, in der Prophase."));
    add(EV.nuclei, EV.apart, tx("Nuclei at the end", "Kerne am Ende"), tx("The new nuclear envelopes form around the chromatids once they have arrived at the poles.", "Die neuen Kernhüllen bilden sich um die Chromatiden, wenn sie an den Polen angekommen sind."));
  } else if (kind === "cycle") {
    add(PH.g2, PH.s, tx("Replication before G2", "Replikation vor G2"), tx("G2 comes after the S phase: the cell checks and prepares after the DNA has been replicated.", "G2 kommt nach der S-Phase: Die Zelle bereitet sich vor, nachdem die DNA repliziert wurde."));
    add(PH.s, PH.g1, tx("G1 comes first", "G1 kommt zuerst"), tx("After a division the cell first grows (G1). Only then does it replicate its DNA.", "Nach einer Teilung wächst die Zelle zuerst (G1). Erst danach repliziert sie ihre DNA."));
  } else {
    add(MEIO.sis, MEIO.hom, tx("Homologues first", "Erst die Homologen"), tx("Meiosis I separates the homologous chromosomes. Only meiosis II separates the sister chromatids.", "Die Meiose I trennt die homologen Chromosomen. Erst die Meiose II trennt die Schwesterchromatiden."));
    add(MEIO.hom, MEIO.pair, tx("Pair up first", "Erst paaren"), tx("The homologues can only be separated after they have paired up.", "Die Homologen können erst getrennt werden, nachdem sie sich gepaart haben."));
  }
  const how: Record<OrderKind, [Text, Text, Text]> = {
    names: [
      tx("Put the stages of the cell cycle in order.", "Bring die Abschnitte der Zellteilung in die richtige Reihenfolge."),
      tx('"P" \\to "M" \\to "A" \\to "T"', '"P" \\to "M" \\to "A" \\to "T"'),
      tx("Interphase (replication), then prophase, metaphase, anaphase, telophase, and finally cytokinesis.", "Interphase (Replikation), dann Prophase, Metaphase, Anaphase, Telophase und zum Schluss die Cytokinese."),
    ],
    events: [
      tx("Put these events of a cell division in order.", "Bring diese Ereignisse einer Zellteilung in die richtige Reihenfolge."),
      tx('"S" \\to "P" \\to "M" \\to "A" \\to "T" \\to "C"', '"S" \\to "P" \\to "M" \\to "A" \\to "T" \\to "C"'),
      tx("Replication (S phase), condensing (prophase), equatorial plane (metaphase), separation (anaphase), new nuclei (telophase), cytoplasm divided (cytokinesis).", "Replikation (S-Phase), Kondensieren (Prophase), Äquatorialebene (Metaphase), Trennung (Anaphase), neue Kerne (Telophase), Zellplasma geteilt (Cytokinese)."),
    ],
    cycle: [
      tx("Put the phases of the cell cycle in order, starting right after a division.", "Bring die Phasen des Zellzyklus in die richtige Reihenfolge, beginnend direkt nach einer Teilung."),
      tx('"G1" \\to "S" \\to "G2" \\to "M"', '"G1" \\to "S" \\to "G2" \\to "M"'),
      tx("Growth (G1), replication (S), preparation (G2), then mitosis and cytokinesis.", "Wachstum (G1), Replikation (S), Vorbereitung (G2), dann Mitose und Cytokinese."),
    ],
    meiosis: [
      tx("Put the steps of meiosis in order.", "Bring die Schritte der Meiose in die richtige Reihenfolge."),
      tx('2n \\to "meiosis I" \\to n \\to "meiosis II" \\to n', '2n \\to "Meiose I" \\to n \\to "Meiose II" \\to n'),
      tx("Replication, pairing and separation of the homologues (meiosis I, two haploid cells), then separation of the sister chromatids (meiosis II, four sex cells).", "Replikation, Paarung und Trennung der Homologen (Meiose I, zwei haploide Zellen), dann Trennung der Schwesterchromatiden (Meiose II, vier Keimzellen)."),
    ],
  };
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: how[kind][0],
    answer: { kind: "order", items },
    hint:
      kind === "meiosis"
        ? tx("In meiosis I the pairs are separated, in meiosis II the chromatids.", "In der Meiose I werden die Paare getrennt, in der Meiose II die Chromatiden.")
        : tx("Think of the chromosomes: replicated, condensed, lined up, pulled apart.", "Denk an die Chromosomen: repliziert, kondensiert, angeordnet, auseinandergezogen."),
    solution: [{ math: how[kind][1], note: how[kind][2] }],
    mistakes,
  };
}

function orderTask(rng: Rng): Exercise {
  const kind = rng.pick(["names", "events", "events", "cycle", "meiosis", "meiosis"] as const);
  if (kind === "names") return orderExercise(kind, inOrder(MITO_NAMES, [PH.pro, PH.meta, PH.ana, PH.telo, ...(rng.chance(0.5) ? [PH.inter] : []), ...(rng.chance(0.5) ? [PH.cyto] : [])]));
  if (kind === "events") return orderExercise(kind, inOrder(MITO_EVENTS, some(rng, MITO_EVENTS, rng.int(4, 5))));
  if (kind === "cycle") return orderExercise(kind, inOrder(CYCLE, some(rng, CYCLE, rng.int(4, 5))));
  return orderExercise(kind, inOrder(MEIO_LIST, some(rng, MEIO_LIST, rng.int(4, 5))));
}

// ---------------------------------------------------------------------------
// Which phase is shown?

type PicStage = Extract<MitosisStage, "g2" | "pro" | "meta" | "ana" | "telo">;
const STAGE_NAME: Record<PicStage, Text> = { g2: PH.inter, pro: PH.pro, meta: PH.meta, ana: PH.ana, telo: PH.telo };
const LOOK: Record<PicStage, Text> = {
  g2: tx("The nucleus is intact and the chromosomes are long, thin threads: the cell is in **interphase**.", "Der Zellkern ist intakt, die Chromosomen sind lange, dünne Fäden: Die Zelle ist in der **Interphase**."),
  pro: tx("The chromosomes are condensed (X shapes) but still scattered, the nuclear envelope is breaking down and the spindle is forming: **prophase**.", "Die Chromosomen sind kondensiert (X-Form), liegen aber noch verstreut, die Kernhülle löst sich auf, die Spindel bildet sich: **Prophase**."),
  meta: tx("All chromosomes are lined up in the equatorial plane, spindle fibres from both poles hold every centromere: **metaphase**.", "Alle Chromosomen stehen in der Äquatorialebene, Spindelfasern von beiden Polen halten jedes Zentromer: **Metaphase**."),
  ana: tx("The sister chromatids have been separated and are being pulled to the poles (V shapes): **anaphase**.", "Die Schwesterchromatiden sind getrennt und werden zu den Polen gezogen (V-Form): **Anaphase**."),
  telo: tx("The chromatids have arrived at the poles, new nuclear envelopes form and the cell pinches in: **telophase**.", "Die Chromatiden sind an den Polen angekommen, neue Kernhüllen bilden sich, die Zelle schnürt sich ein: **Telophase**."),
};
const CONFUSE: Partial<Record<PicStage, Partial<Record<PicStage, [Text, Text]>>>> = {
  g2: { pro: [tx("Not condensed yet", "Noch nicht kondensiert"), tx("In prophase the chromosomes are already short and thick. Here they are still thin threads in an intact nucleus.", "In der Prophase sind die Chromosomen schon kurz und dick. Hier sind sie noch dünne Fäden in einem intakten Zellkern.")] },
  pro: {
    meta: [tx("Not lined up yet", "Noch nicht angeordnet"), tx("In metaphase all chromosomes stand neatly in one plane in the middle. Here they are still scattered.", "In der Metaphase stehen alle Chromosomen ordentlich in einer Ebene in der Mitte. Hier liegen sie noch verstreut.")],
    telo: [tx("One nucleus, not two", "Ein Kern, nicht zwei"), tx("In telophase two new nuclei form at the poles. Here there is one nucleus that is dissolving.", "In der Telophase entstehen an den Polen zwei neue Kerne. Hier gibt es einen Kern, der sich gerade auflöst.")],
    g2: [tx("Already condensed", "Schon kondensiert"), tx("In interphase you can't see single chromosomes. Here they are already condensed into X shapes.", "In der Interphase sieht man keine einzelnen Chromosomen. Hier sind sie schon zu X-Formen kondensiert.")],
  },
  meta: {
    ana: [tx("Still joined", "Noch verbunden"), tx("In anaphase the chromatids are already separated. Here every chromosome is still an X in the middle.", "In der Anaphase sind die Chromatiden schon getrennt. Hier ist jedes Chromosom noch ein X in der Mitte.")],
    pro: [tx("Already lined up", "Schon angeordnet"), tx("In prophase the chromosomes lie scattered. Here they are lined up in the equatorial plane.", "In der Prophase liegen die Chromosomen verstreut. Hier stehen sie geordnet in der Äquatorialebene.")],
  },
  ana: {
    meta: [tx("Already separated", "Schon getrennt"), tx("In metaphase the chromosomes still stand as X shapes in the middle. Here the chromatids are already on their way to the poles.", "In der Metaphase stehen die Chromosomen noch als X in der Mitte. Hier sind die Chromatiden schon auf dem Weg zu den Polen.")],
    telo: [tx("No new nuclei yet", "Noch keine neuen Kerne"), tx("In telophase new nuclear envelopes form and the cell pinches in. Here the chromatids are still moving.", "In der Telophase bilden sich neue Kernhüllen und die Zelle schnürt sich ein. Hier wandern die Chromatiden noch.")],
  },
  telo: {
    ana: [tx("Look for the new nuclei", "Achte auf die neuen Kerne"), tx("The chromatids have already arrived, new nuclear envelopes form and the cell pinches in: that's later than anaphase.", "Die Chromatiden sind schon angekommen, neue Kernhüllen bilden sich und die Zelle schnürt sich ein: Das ist später als die Anaphase.")],
    pro: [tx("Two nuclei form", "Zwei Kerne entstehen"), tx("In prophase one nucleus dissolves. Here two new nuclei are forming, one at each pole.", "In der Prophase löst sich ein Kern auf. Hier entstehen zwei neue Kerne, an jedem Pol einer.")],
  },
};

function phaseExercise(stage: PicStage, n2: ModelSize, rng: Rng | null): Exercise {
  const others = (["g2", "pro", "meta", "ana", "telo"] as PicStage[]).filter((s) => s !== stage);
  const tempting = Object.keys(CONFUSE[stage] ?? {}) as PicStage[];
  const rest = others.filter((s) => !tempting.includes(s));
  const wrong = [...tempting, ...(rng ? rng.shuffle(rest) : rest)].slice(0, 3);
  const opts: Opt[] = [{ text: STAGE_NAME[stage] }, ...wrong.map((w) => ({ text: STAGE_NAME[w], title: CONFUSE[stage]?.[w]?.[0], say: CONFUSE[stage]?.[w]?.[1] }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Name the phase", "Benenne die Phase"),
    text: tx("Which stage of the cell cycle does the picture show?", "Welchen Abschnitt des Zellzyklus zeigt das Bild?"),
    visual: visual(DivisionPhase, { kind: "mitosis", stage, n2 }),
    answer: c.answer,
    hint: tx("Look at three things: Is there a nucleus? Where are the chromosomes? Are the chromatids still joined?", "Achte auf drei Dinge: Gibt es einen Zellkern? Wo liegen die Chromosomen? Hängen die Chromatiden noch zusammen?"),
    solution: [{ math: tx(`"${en(STAGE_NAME[stage])}"`, `"${de(STAGE_NAME[stage])}"`), note: LOOK[stage] }],
    mistakes: c.mistakes,
  };
}

const phaseTask = (rng: Rng) => phaseExercise(rng.pick(["g2", "pro", "pro", "meta", "ana", "ana", "telo", "telo"] as const), rng.pick([4, 6, 8] as const), rng);

// ---------------------------------------------------------------------------
// Phase and what happens in it

const EVENTS: { id: string; phase: Text; event: Text }[] = [
  { id: "g1", phase: PH.g1, event: tx("the cell grows, chromosomes have one chromatid", "die Zelle wächst, Chromosomen mit einem Chromatid") },
  { id: "s", phase: PH.s, event: tx("the DNA is replicated", "die DNA wird repliziert") },
  { id: "pro", phase: PH.pro, event: tx("chromosomes condense, nuclear envelope breaks down", "Chromosomen kondensieren, Kernhülle löst sich auf") },
  { id: "meta", phase: PH.meta, event: tx("chromosomes line up in the equatorial plane", "Chromosomen ordnen sich in der Äquatorialebene an") },
  { id: "ana", phase: PH.ana, event: tx("sister chromatids are pulled to the poles", "Schwesterchromatiden werden zu den Polen gezogen") },
  { id: "telo", phase: PH.telo, event: tx("new nuclear envelopes form", "neue Kernhüllen bilden sich") },
  { id: "cyto", phase: PH.cyto, event: tx("the cytoplasm is divided", "das Zellplasma wird geteilt") },
];
const EVENT_DISTRACTORS: Text[] = [tx("homologous chromosomes pair up", "homologe Chromosomen paaren sich"), tx("the chromosome number is halved", "die Chromosomenzahl wird halbiert")];
const SWAPS: [string, string, Text, Text][] = [
  ["meta", "ana", tx("Metaphase or anaphase?", "Metaphase oder Anaphase?"), tx("Swapped! **Meta**phase: chromosomes in the **middle**. **Ana**phase: chromatids move **apart**.", "Vertauscht! **Meta**phase: Chromosomen in der **Mitte**. **Ana**phase: Chromatiden wandern **auseinander**.")],
  ["pro", "telo", tx("Prophase or telophase?", "Prophase oder Telophase?"), tx("Swapped! In prophase the nuclear envelope breaks down, in telophase new ones form. Think of the order: prophase is first, telophase last.", "Vertauscht! In der Prophase löst sich die Kernhülle auf, in der Telophase bilden sich neue. Denk an die Reihenfolge: Pro ist vorne, Telo am Ende.")],
  ["s", "ana", tx("Copying or separating?", "Verdoppeln oder trennen?"), tx("In the S phase the DNA is replicated. In anaphase the copies (sister chromatids) are separated.", "In der S-Phase wird die DNA repliziert. In der Anaphase werden die Kopien (Schwesterchromatiden) getrennt.")],
  ["telo", "cyto", tx("Nucleus or cytoplasm?", "Kern oder Zellplasma?"), tx("Telophase finishes the two nuclei. Cytokinesis then divides the cytoplasm.", "Die Telophase stellt die beiden Kerne fertig. Die Cytokinese teilt danach das Zellplasma.")],
];

function matchTask(rng: Rng): Exercise {
  const picked = some(rng, EVENTS, 4);
  const pairs = picked.map((e) => [e.phase, e.event] as [Text, Text]);
  const distractor = rng.chance(0.6) ? rng.pick(EVENT_DISTRACTORS) : rng.pick(EVENTS.filter((e) => !picked.includes(e))).event;
  const mistakes: Mistake[] = [];
  for (const [a, b, title, say] of SWAPS) {
    const A = picked.find((e) => e.id === a);
    const B = picked.find((e) => e.id === b);
    if (A && B) mistakes.push({ when: { kind: "match", pairs: [[A.phase, B.event], [B.phase, A.event]] }, title, say });
  }
  return {
    instruction: tx("Match phase and event", "Ordne Phase und Vorgang zu"),
    text: tx("What happens in which phase? One event is left over.", "Was passiert in welcher Phase? Ein Vorgang bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [distractor] },
    hint: tx("Go through the cell cycle in order: G1, S, G2, prophase, metaphase, anaphase, telophase, cytokinesis.", "Geh den Zellzyklus der Reihe nach durch: G1, S, G2, Prophase, Metaphase, Anaphase, Telophase, Cytokinese."),
    solution: [
      {
        math: tx(picked.map((e) => `"${en(e.phase)}"`).join(" \\quad "), picked.map((e) => `"${de(e.phase)}"`).join(" \\quad ")),
        note: txMap((t, l) => picked.map((e) => `**${resolveText(e.phase, l)}**: ${resolveText(e.event, l)}`).join(". ") + "."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Count chromosomes and chromatids

type CountStage = "g1" | "g2" | "meta" | "daughter" | "gamete";
const COUNT_STAGE: Record<CountStage, Text> = {
  g1: tx("a body cell in the G1 phase", "eine Körperzelle in der G1-Phase"),
  g2: tx("a body cell in the G2 phase", "eine Körperzelle in der G2-Phase"),
  meta: tx("a body cell in metaphase of mitosis", "eine Körperzelle in der Metaphase der Mitose"),
  daughter: tx("a daughter cell right after mitosis", "eine Tochterzelle direkt nach der Mitose"),
  gamete: tx("a sex cell after meiosis", "eine Keimzelle nach der Meiose"),
};

function countExercise(o: Organism, stage: CountStage, what: "chromosomes" | "chromatids"): Exercise {
  const n2 = o.n2;
  const two = stage === "g2" || stage === "meta";
  const chromosomes = stage === "gamete" ? n2 / 2 : n2;
  const value = what === "chromosomes" ? chromosomes : two ? 2 * chromosomes : chromosomes;
  const m = mistakesFor(num(value));
  if (what === "chromatids" && two)
    m.add(num(chromosomes), tx("Those are the chromosomes", "Das sind die Chromosomen"), tx("That's the number of chromosomes. After the S phase every chromosome has **two** chromatids.", "Das ist die Zahl der Chromosomen. Nach der S-Phase hat jedes Chromosom **zwei** Chromatiden."));
  if (what === "chromosomes" && two)
    m.add(num(2 * chromosomes), tx("You counted chromatids", "Du hast Chromatiden gezählt"), tx("A two-chromatid chromosome still counts as **one** chromosome: one centromere, one chromosome.", "Ein Zwei-Chromatid-Chromosom zählt als **ein** Chromosom: ein Zentromer, ein Chromosom."));
  if (what === "chromatids" && (stage === "g1" || stage === "daughter"))
    m.add(num(2 * chromosomes), tx("Not replicated yet", "Noch nicht repliziert"), tx(stage === "g1" ? "Replication only happens in the S phase. In G1 every chromosome has just one chromatid." : "After mitosis the sister chromatids have been separated: each chromosome has one chromatid.", stage === "g1" ? "Repliziert wird erst in der S-Phase. In G1 hat jedes Chromosom nur ein Chromatid." : "Nach der Mitose sind die Schwesterchromatiden getrennt: Jedes Chromosom hat ein Chromatid."));
  if (stage === "daughter") m.add(num(n2 / 2), tx("Mitosis doesn't halve", "Mitose halbiert nicht"), tx("The classic trap! Mitosis gives each daughter cell the full chromosome set (2n).", "Die klassische Falle! Die Mitose gibt jeder Tochterzelle den vollen Chromosomensatz (2n)."));
  if (stage === "gamete") m.add(num(n2), tx("Sex cells are haploid", "Keimzellen sind haploid"), tx("Meiosis halves the chromosome set: sex cells are haploid (n).", "Die Meiose halbiert den Chromosomensatz: Keimzellen sind haploid (n)."));
  if (stage !== "gamete" && stage !== "daughter") m.add(num(n2 / 2), tx("Body cells are diploid", "Körperzellen sind diploid"), tx("A body cell is diploid (2n): it has the full number. Only sex cells have half.", "Eine Körperzelle ist diploid (2n): Sie hat die volle Zahl. Nur Keimzellen haben die Hälfte."));
  const whatEn = what === "chromosomes" ? "chromosomes" : "chromatids";
  const whatDe = what === "chromosomes" ? "Chromosomen" : "Chromatiden";
  const perChrom = two ? 2 : 1;
  return {
    instruction: what === "chromosomes" ? tx("Count chromosomes", "Zähle Chromosomen") : tx("Count chromatids", "Zähle Chromatiden"),
    text: txMap((t, l) =>
      t(
        `${resolveText(o.cells, l)} have 2n = ${n2} chromosomes. How many ${whatEn} does ${resolveText(COUNT_STAGE[stage], l)} contain?`,
        `${resolveText(o.cells, l)} haben 2n = ${n2} Chromosomen. Wie viele ${whatDe} enthält ${resolveText(COUNT_STAGE[stage], l)}?`,
      ),
    ),
    answer: num(value),
    hint: tx("First: how many chromosomes (2n or n)? Then: one or two chromatids each?", "Zuerst: Wie viele Chromosomen (2n oder n)? Dann: ein oder zwei Chromatiden pro Chromosom?"),
    solution: [
      {
        math: tx(`"chromosomes:" \\; ${chromosomes}#c`, `"Chromosomen:" \\; ${chromosomes}#c`),
        note:
          stage === "gamete"
            ? tx(`A sex cell is haploid: n = ${chromosomes} chromosomes.`, `Eine Keimzelle ist haploid: n = ${chromosomes} Chromosomen.`)
            : tx(`A body cell is diploid: 2n = ${n2} chromosomes, also ${stage === "daughter" ? "after mitosis" : "in this phase"}.`, `Eine Körperzelle ist diploid: 2n = ${n2} Chromosomen, auch ${stage === "daughter" ? "nach der Mitose" : "in dieser Phase"}.`),
      },
      {
        math: tx(`"chromatids:" \\; ${chromosomes}#c \\cdot ${perChrom} = ${chromosomes * perChrom}#r`, `"Chromatiden:" \\; ${chromosomes}#c \\cdot ${perChrom} = ${chromosomes * perChrom}#r`),
        note: two
          ? tx("After replication in the S phase each chromosome has two sister chromatids.", "Nach der Replikation in der S-Phase hat jedes Chromosom zwei Schwesterchromatiden.")
          : tx("Here each chromosome has just one chromatid.", "Hier hat jedes Chromosom nur ein Chromatid."),
      },
    ],
    mistakes: m.list,
  };
}

function countTask(rng: Rng): Exercise {
  return countExercise(rng.pick(ORGANISMS), rng.pick(["g1", "g2", "g2", "meta", "meta", "daughter", "gamete"] as const), rng.pick(["chromosomes", "chromatids", "chromatids"] as const));
}

// ---------------------------------------------------------------------------
// In which phase…?

type Q = { q: Text; right: Text; tempt: [Text, Text, Text][] };
const PHASE_POOL = [PH.g1, PH.s, PH.g2, PH.pro, PH.meta, PH.ana, PH.telo, PH.cyto];
const QUESTIONS: Q[] = [
  {
    q: tx("In which phase is the DNA replicated?", "In welcher Phase wird die DNA repliziert?"),
    right: PH.s,
    tempt: [
      [PH.g2, tx("G2 is after replication", "G2 ist nach der Replikation"), tx("In G2 the replication is already finished. The S stands for synthesis: that's where the DNA is copied.", "In G2 ist die Replikation schon fertig. Das S steht für Synthese: Dort wird die DNA verdoppelt.")],
      [PH.pro, tx("Already doubled", "Schon verdoppelt"), tx("In prophase the chromosomes condense, but they were already replicated before, in interphase.", "In der Prophase kondensieren die Chromosomen, verdoppelt wurden sie aber schon vorher in der Interphase.")],
    ],
  },
  {
    q: tx("In which phase are the sister chromatids separated?", "In welcher Phase werden die Schwesterchromatiden getrennt?"),
    right: PH.ana,
    tempt: [
      [PH.meta, tx("Lined up, not separated", "Angeordnet, nicht getrennt"), tx("In metaphase the chromosomes are lined up but still joined at the centromere.", "In der Metaphase sind die Chromosomen angeordnet, hängen aber noch am Zentromer zusammen.")],
      [PH.telo, tx("Already arrived", "Schon angekommen"), tx("In telophase the chromatids have already arrived at the poles. They were separated before.", "In der Telophase sind die Chromatiden schon an den Polen angekommen. Getrennt wurden sie vorher.")],
    ],
  },
  {
    q: tx("In which phase are the chromosomes lined up in the equatorial plane?", "In welcher Phase liegen die Chromosomen in der Äquatorialebene?"),
    right: PH.meta,
    tempt: [[PH.ana, tx("Separating already", "Da wird schon getrennt"), tx("In anaphase the chromatids are leaving the equatorial plane, moving to the poles.", "In der Anaphase verlassen die Chromatiden die Äquatorialebene und wandern zu den Polen.")]],
  },
  {
    q: tx("In which phase does the nuclear envelope break down and the spindle apparatus form?", "In welcher Phase löst sich die Kernhülle auf und der Spindelapparat bildet sich?"),
    right: PH.pro,
    tempt: [[PH.telo, tx("Telophase rebuilds", "In der Telophase wird aufgebaut"), tx("In telophase the nuclear envelope forms again. It breaks down at the very beginning of mitosis.", "In der Telophase bildet sich die Kernhülle wieder. Aufgelöst wird sie ganz am Anfang der Mitose.")]],
  },
  {
    q: tx("In which phase do new nuclear envelopes form and the chromosomes uncoil?", "In welcher Phase bilden sich neue Kernhüllen und die Chromosomen entspiralisieren sich?"),
    right: PH.telo,
    tempt: [[PH.pro, tx("Prophase breaks down", "In der Prophase wird abgebaut"), tx("In prophase it's the other way round: chromosomes condense and the nuclear envelope breaks down.", "In der Prophase ist es umgekehrt: Die Chromosomen kondensieren und die Kernhülle löst sich auf.")]],
  },
  {
    q: tx("In which phase is the cytoplasm divided?", "In welcher Phase wird das Zellplasma geteilt?"),
    right: PH.cyto,
    tempt: [[PH.telo, tx("Telophase makes nuclei", "Die Telophase bildet Kerne"), tx("Telophase finishes the two nuclei. Dividing the cytoplasm has its own name.", "Die Telophase stellt die beiden Zellkerne fertig. Die Teilung des Zellplasmas hat einen eigenen Namen.")]],
  },
  {
    q: tx("In which phase does the cell grow and make new organelles, while its chromosomes have one chromatid?", "In welcher Phase wächst die Zelle und bildet neue Organellen, während ihre Chromosomen ein Chromatid haben?"),
    right: PH.g1,
    tempt: [[PH.g2, tx("Two chromatids in G2", "In G2 zwei Chromatiden"), tx("In G2 the chromosomes already have two chromatids, because the S phase came before.", "In G2 haben die Chromosomen schon zwei Chromatiden, weil die S-Phase vorher war.")]],
  },
  {
    q: tx("In which phase are the chromosomes most condensed and easiest to count?", "In welcher Phase sind die Chromosomen am stärksten kondensiert und am besten zu zählen?"),
    right: PH.meta,
    tempt: [[PH.pro, tx("Still condensing", "Noch beim Kondensieren"), tx("In prophase the chromosomes are still condensing and lie scattered. They are most compact and neatly lined up a bit later.", "In der Prophase kondensieren die Chromosomen noch und liegen verstreut. Am kompaktesten und schön aufgereiht sind sie etwas später.")]],
  },
  {
    q: tx("In which phase does the cell prepare for mitosis after its DNA has been replicated?", "In welcher Phase bereitet sich die Zelle auf die Mitose vor, nachdem ihre DNA repliziert wurde?"),
    right: PH.g2,
    tempt: [[PH.g1, tx("G1 is before replication", "G1 ist vor der Replikation"), tx("G1 comes before the S phase. After replication comes the second gap phase.", "G1 kommt vor der S-Phase. Nach der Replikation folgt die zweite Zwischenphase.")]],
  },
];

function questionTask(rng: Rng): Exercise {
  const q = rng.pick(QUESTIONS);
  const tempt = q.tempt.map(([text, title, say]) => ({ text, title, say }));
  const fill = rng.shuffle(PHASE_POOL.filter((p) => p !== q.right && !q.tempt.some((t) => t[0] === p))).slice(0, 3 - tempt.length);
  const c = choice(rng, [{ text: q.right }, ...tempt, ...fill.map((text) => ({ text }))]);
  return {
    instruction: tx("Which phase?", "Welche Phase?"),
    text: q.q,
    answer: c.answer,
    hint: tx("Walk through the cell cycle: G1, S, G2, prophase, metaphase, anaphase, telophase, cytokinesis.", "Geh den Zellzyklus durch: G1, S, G2, Prophase, Metaphase, Anaphase, Telophase, Cytokinese."),
    solution: [{ math: tx(`"${en(q.right)}"`, `"${de(q.right)}"`), note: txMap((t, l) => `${t("Answer:", "Antwort:")} **${resolveText(q.right, l)}**.`) }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Mitosis or meiosis?

type Stmt = { text: Text; mito: boolean; meio: boolean; trap?: [Text, Text] };
const STMTS: Stmt[] = [
  {
    text: tx("Two daughter cells form.", "Es entstehen zwei Tochterzellen."),
    mito: true,
    meio: false,
    trap: [tx("Meiosis divides twice", "Die Meiose teilt zweimal"), tx("Meiosis consists of two divisions, so at the end there are four cells.", "Die Meiose besteht aus zwei Teilungen, am Ende sind es also vier Zellen.")],
  },
  {
    text: tx("Four daughter cells form.", "Es entstehen vier Tochterzellen."),
    mito: false,
    meio: true,
    trap: [tx("Mitosis divides once", "Die Mitose teilt einmal"), tx("Mitosis is a single division: one mother cell, two daughter cells.", "Die Mitose ist eine einzige Teilung: eine Mutterzelle, zwei Tochterzellen.")],
  },
  {
    text: tx("The daughter cells are genetically identical.", "Die Tochterzellen sind erbgleich."),
    mito: true,
    meio: false,
    trap: [tx("Meiosis mixes", "Die Meiose mischt"), tx("Meiosis doesn't make identical cells: crossing over and the random distribution of the homologues make every sex cell different.", "Die Meiose macht keine identischen Zellen: Crossing-over und die zufällige Verteilung der Homologen machen jede Keimzelle anders.")],
  },
  {
    text: tx("The daughter cells are genetically different.", "Die Tochterzellen sind genetisch verschieden."),
    mito: false,
    meio: true,
    trap: [tx("Mitosis copies exactly", "Die Mitose kopiert genau"), tx("In mitosis every daughter cell gets an exact copy of every chromosome: they are genetically identical.", "Bei der Mitose bekommt jede Tochterzelle eine genaue Kopie jedes Chromosoms: Sie sind erbgleich.")],
  },
  {
    text: tx("The chromosome set is halved (2n → n).", "Der Chromosomensatz wird halbiert (2n → n)."),
    mito: false,
    meio: true,
    trap: [tx("Mitosis doesn't halve", "Mitose halbiert nicht"), tx("The classic trap! In mitosis the chromosome set stays the same: 2n → 2n.", "Die klassische Falle! Bei der Mitose bleibt der Chromosomensatz gleich: 2n → 2n.")],
  },
  {
    text: tx("The chromosome set stays the same (2n → 2n).", "Der Chromosomensatz bleibt gleich (2n → 2n)."),
    mito: true,
    meio: false,
    trap: [tx("Meiosis halves", "Die Meiose halbiert"), tx("Meiosis makes haploid sex cells: the chromosome set is halved from 2n to n.", "Die Meiose bildet haploide Keimzellen: Der Chromosomensatz wird von 2n auf n halbiert.")],
  },
  {
    text: tx("Homologous chromosomes pair up.", "Homologe Chromosomen paaren sich."),
    mito: false,
    meio: true,
    trap: [tx("No pairs in mitosis", "Keine Paare in der Mitose"), tx("In mitosis the homologous chromosomes don't pair up: each chromosome lines up on its own.", "In der Mitose paaren sich die homologen Chromosomen nicht: Jedes Chromosom ordnet sich einzeln an.")],
  },
  {
    text: tx("There are two divisions, one after the other.", "Es gibt zwei Teilungen nacheinander."),
    mito: false,
    meio: true,
    trap: [tx("Mitosis divides once", "Die Mitose teilt einmal"), tx("Mitosis is one single division. Two divisions in a row are typical of meiosis.", "Die Mitose ist eine einzige Teilung. Zwei Teilungen nacheinander sind typisch für die Meiose.")],
  },
  {
    text: tx("It serves growth and the renewal of tissues.", "Sie dient dem Wachstum und der Erneuerung von Geweben."),
    mito: true,
    meio: false,
    trap: [tx("That's mitosis", "Das ist die Mitose"), tx("Growth and renewal need identical cells: that's the job of mitosis. Meiosis makes sex cells.", "Für Wachstum und Erneuerung braucht man erbgleiche Zellen: Das ist die Aufgabe der Mitose. Die Meiose bildet Keimzellen.")],
  },
  {
    text: tx("It makes sex cells.", "Sie bildet Keimzellen."),
    mito: false,
    meio: true,
    trap: [tx("That's meiosis", "Das ist die Meiose"), tx("Sex cells are made by meiosis. Mitosis makes body cells for growth and renewal.", "Keimzellen entstehen durch die Meiose. Die Mitose bildet Körperzellen für Wachstum und Erneuerung.")],
  },
  { text: tx("The DNA is replicated before it starts.", "Vorher wird die DNA repliziert."), mito: true, meio: true },
  { text: tx("Sister chromatids are separated from each other.", "Schwesterchromatiden werden voneinander getrennt."), mito: true, meio: true },
];

function compareExercise(rng: Rng, which: "mito" | "meio"): Exercise {
  const yes = STMTS.filter((s) => s[which]);
  const no = STMTS.filter((s) => !s[which]);
  const k = rng.int(2, 3);
  const picked = rng.shuffle([...some(rng, yes, k), ...some(rng, no, 5 - k)]);
  const options = picked.map((s) => s.text);
  const correct = picked.map((s, i) => (s[which] ? i : -1)).filter((i) => i >= 0);
  const right: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakesFor(right);
  picked.forEach((s, i) => {
    if (!s[which] && s.trap) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, s.trap[0], s.trap[1]);
  });
  const name = which === "mito" ? PH.mitosis : tx("Meiosis", "Meiose");
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: txMap((t, l) => t(`Which statements are true for ${resolveText(name, l).toLowerCase()}?`, `Welche Aussagen treffen auf die ${resolveText(name, l)} zu?`)),
    answer: right,
    hint: tx("Mitosis: 1 division, 2 identical cells, 2n → 2n. Meiosis: 2 divisions, 4 different cells, 2n → n.", "Mitose: 1 Teilung, 2 erbgleiche Zellen, 2n → 2n. Meiose: 2 Teilungen, 4 verschiedene Zellen, 2n → n."),
    solution: [
      { math: tx('"mitosis:" \\; 2n \\to 2n , 2n', '"Mitose:" \\; 2n \\to 2n , 2n'), note: tx("Mitosis: one division, two genetically identical diploid cells, for growth and renewal.", "Mitose: eine Teilung, zwei erbgleiche diploide Zellen, für Wachstum und Erneuerung.") },
      { math: tx('"meiosis:"#e0 \\; 2#e1 n#e2 \\to#e3 n#e4 , n#e5 , n#e6 , n#e7', '"Meiose:"#e0 \\; 2#e1 n#e2 \\to#e3 n#e4 , n#e5 , n#e6 , n#e7'), note: tx("Meiosis: two divisions, four genetically different haploid sex cells. The homologues pair up and are separated.", "Meiose: zwei Teilungen, vier genetisch verschiedene haploide Keimzellen. Die Homologen paaren sich und werden getrennt.") },
    ],
    mistakes: m.list,
  };
}

const compareTask = (rng: Rng) => compareExercise(rng, rng.pick(["mito", "meio"] as const));

// ---------------------------------------------------------------------------
// Parts of a chromosome

const PART_NAMES: Record<string, Text> = {
  one: tx("one-chromatid chromosome", "Ein-Chromatid-Chromosom"),
  two: tx("two-chromatid chromosome", "Zwei-Chromatid-Chromosom"),
  chromatid: tx("chromatid", "Chromatid"),
  centromere: tx("centromere", "Zentromer"),
  homologs: tx("homologous chromosomes", "homologe Chromosomen"),
  locus: tx("gene locus", "Genort"),
};
const EXTRA_NAMES: Text[] = [tx("sister chromatids", "Schwesterchromatiden"), tx("spindle fibre", "Spindelfaser"), tx("nucleolus", "Kernkörperchen")];
const PART_TRAPS: Record<string, [string | Text, Text, Text][]> = {
  one: [["two", tx("Count the halves", "Zähl die Hälften"), tx("A two-chromatid chromosome has two halves joined like an X. This one is a single rod.", "Ein Zwei-Chromatid-Chromosom hat zwei Hälften, die wie ein X verbunden sind. Das hier ist ein einzelnes Stäbchen.")]],
  two: [["chromatid", tx("The whole, not the half", "Das Ganze, nicht die Hälfte"), tx("A chromatid is only one half. The marked structure is the whole X with both halves.", "Ein Chromatid ist nur eine Hälfte. Markiert ist das ganze X mit beiden Hälften.")]],
  chromatid: [["two", tx("Just one half", "Nur eine Hälfte"), tx("The whole X is the two-chromatid chromosome. The marked part is one of its two halves.", "Das ganze X ist das Zwei-Chromatid-Chromosom. Markiert ist eine seiner beiden Hälften.")]],
  centromere: [["chromatid", tx("The joining point", "Die Verbindungsstelle"), tx("The marked spot is where the two chromatids are held together, the constriction.", "Markiert ist die Stelle, an der die beiden Chromatiden zusammengehalten werden: die Einschnürung.")]],
  homologs: [
    [EXTRA_NAMES[0], tx("Not sisters", "Keine Schwestern"), tx("Sister chromatids are identical copies joined at one centromere. These are two separate chromosomes, one from the mother (red) and one from the father (blue).", "Schwesterchromatiden sind identische Kopien an einem Zentromer. Das hier sind zwei getrennte Chromosomen, eins von der Mutter (rot), eins vom Vater (blau).")],
  ],
  locus: [["centromere", tx("Not the centromere", "Nicht das Zentromer"), tx("The centromere is the constriction in the middle. The marked line shows the same position on both homologues: a gene locus.", "Das Zentromer ist die Einschnürung in der Mitte. Die markierte Linie zeigt dieselbe Stelle auf beiden Homologen: einen Genort.")]],
};

function partTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(PART_NAMES));
  const traps = PART_TRAPS[id].map(([w, title, say]) => ({ text: typeof w === "string" ? PART_NAMES[w] : w, title, say }));
  const pool = [...Object.entries(PART_NAMES).filter(([k]) => k !== id).map(([, v]) => v), ...EXTRA_NAMES].filter((t) => !traps.some((x) => x.text === t));
  const c = choice(rng, [{ text: PART_NAMES[id] }, ...traps, ...some(rng, pool, 3 - traps.length).map((text) => ({ text }))]);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("What is the structure marked with a question mark called?", "Wie heißt die mit dem Fragezeichen markierte Struktur?"),
    visual: visual(DivisionChromosomes, { mode: "numbers", ask: id, legend: "none" }),
    answer: c.answer,
    hint: tx("Is it a whole chromosome, a half, a joining point or a pair?", "Ist es ein ganzes Chromosom, eine Hälfte, eine Verbindungsstelle oder ein Paar?"),
    solution: [{ math: tx(`"${en(PART_NAMES[id])}"`, `"${de(PART_NAMES[id])}"`), note: txMap((t, l) => `${t("It is the", "Das ist")} **${resolveText(PART_NAMES[id], l)}**.`) }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Haploid or diploid?

const PLOIDY: { cell: Text; haploid: boolean; why: Text }[] = [
  { cell: tx("a human skin cell", "eine Hautzelle des Menschen"), haploid: false, why: tx("Body cells have two chromosome sets: 2n = 46.", "Körperzellen haben zwei Chromosomensätze: 2n = 46.") },
  { cell: tx("a human egg cell", "eine Eizelle des Menschen"), haploid: true, why: tx("Sex cells have one chromosome set: n = 23.", "Keimzellen haben einen Chromosomensatz: n = 23.") },
  { cell: tx("a human sperm cell", "eine Spermienzelle des Menschen"), haploid: true, why: tx("Sex cells have one chromosome set: n = 23.", "Keimzellen haben einen Chromosomensatz: n = 23.") },
  { cell: tx("a zygote", "eine Zygote"), haploid: false, why: tx("Egg and sperm cell (n + n) have fused: the zygote has 2n again.", "Eizelle und Spermienzelle (n + n) sind verschmolzen: Die Zygote hat wieder 2n.") },
  { cell: tx("a cell right after meiosis I", "eine Zelle direkt nach der Meiose I"), haploid: true, why: tx("Meiosis I separates the homologues, so the cells are already haploid (n), with two-chromatid chromosomes.", "Die Meiose I trennt die Homologen, die Zellen sind also schon haploid (n), mit Zwei-Chromatid-Chromosomen.") },
  { cell: tx("a daughter cell after mitosis", "eine Tochterzelle nach der Mitose"), haploid: false, why: tx("Mitosis keeps the chromosome set: 2n → 2n.", "Die Mitose behält den Chromosomensatz: 2n → 2n.") },
  { cell: tx("a human liver cell in the G2 phase", "eine Leberzelle des Menschen in der G2-Phase"), haploid: false, why: tx("Replication doubles the chromatids, not the chromosome sets: still 2n.", "Die Replikation verdoppelt die Chromatiden, nicht die Chromosomensätze: weiterhin 2n.") },
];

function ploidyTask(rng: Rng): Exercise {
  const p = rng.pick(PLOIDY);
  const right = p.haploid ? "haploid" : "diploid";
  const wrong = p.haploid ? "diploid" : "haploid";
  return {
    instruction: tx("Haploid or diploid?", "Haploid oder diploid?"),
    text: txMap((t, l) => t(`Is ${resolveText(p.cell, l)} haploid or diploid? Type the word.`, `Ist ${resolveText(p.cell, l)} haploid oder diploid? Schreib das Fachwort.`)),
    answer: { kind: "word", accept: [right, p.haploid ? "n" : "2n"], placeholder: tx("haploid or diploid", "haploid oder diploid") },
    hint: tx("Diploid = two chromosome sets (2n), haploid = one set (n). Only sex cells and cells after meiosis I are haploid.", "Diploid = zwei Chromosomensätze (2n), haploid = ein Satz (n). Nur Keimzellen und Zellen nach der Meiose I sind haploid."),
    solution: [{ math: p.haploid ? "n" : "2n", note: txMap((t, l) => `**${right}**: ${resolveText(p.why, l)}`) }],
    mistakes: [
      {
        when: { kind: "word", accept: [wrong] },
        title: p.haploid ? tx("Only one set", "Nur ein Satz") : tx("Two sets", "Zwei Sätze"),
        say: p.haploid
          ? tx("Diploid would mean two complete chromosome sets. This cell has only one chromosome of each pair.", "Diploid hieße zwei vollständige Chromosomensätze. Diese Zelle hat von jedem Paar nur ein Chromosom.")
          : tx("Haploid would mean only one chromosome of each pair. This cell has both: two sets.", "Haploid hieße nur ein Chromosom von jedem Paar. Diese Zelle hat beide: zwei Sätze."),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// True statements about meiosis and chromosomes

const MEIO_TRUE: Text[] = [
  tx("In meiosis I the homologous chromosomes are separated.", "In der Meiose I werden die homologen Chromosomen getrennt."),
  tx("Meiosis turns one diploid cell into four haploid cells.", "Bei der Meiose entstehen aus einer diploiden Zelle vier haploide Zellen."),
  tx("Homologous chromosomes carry the same genes, but one comes from the mother and one from the father.", "Homologe Chromosomen tragen die gleichen Gene, aber eins stammt von der Mutter, eins vom Vater."),
  tx("After meiosis I the chromosomes still have two chromatids.", "Nach der Meiose I haben die Chromosomen noch zwei Chromatiden."),
  tx("The DNA is not replicated between meiosis I and meiosis II.", "Zwischen Meiose I und Meiose II wird die DNA nicht repliziert."),
];
const MEIO_FALSE: Opt[] = [
  { text: tx("Meiosis makes four genetically identical cells.", "Die Meiose liefert vier erbgleiche Zellen."), title: tx("Meiosis mixes", "Die Meiose mischt"), say: tx("No, the four cells are genetically different: crossing over and the random distribution of the homologues see to that.", "Nein, die vier Zellen sind genetisch verschieden: Dafür sorgen Crossing-over und die zufällige Verteilung der Homologen.") },
  { text: tx("In meiosis I the sister chromatids are separated.", "In der Meiose I werden die Schwesterchromatiden getrennt."), title: tx("Meiosis I separates pairs", "Meiose I trennt Paare"), say: tx("Meiosis I separates the homologous chromosomes. The sister chromatids are separated in meiosis II.", "Die Meiose I trennt die homologen Chromosomen. Die Schwesterchromatiden werden in der Meiose II getrennt.") },
  { text: tx("Homologous chromosomes are the two chromatids of one chromosome.", "Homologe Chromosomen sind die beiden Chromatiden eines Chromosoms."), title: tx("Homologues aren't sisters", "Homologe sind keine Schwestern"), say: tx("The two chromatids of one chromosome are sister chromatids, identical copies. Homologues are two different chromosomes of a pair, from mother and father.", "Die beiden Chromatiden eines Chromosoms sind Schwesterchromatiden, also identische Kopien. Homologe sind zwei verschiedene Chromosomen eines Paares, von Mutter und Vater.") },
  { text: tx("After meiosis the sex cells are diploid.", "Nach der Meiose sind die Keimzellen diploid."), title: tx("Sex cells are haploid", "Keimzellen sind haploid"), say: tx("Meiosis halves the chromosome set: sex cells are haploid (n). Only fertilisation makes 2n again.", "Die Meiose halbiert den Chromosomensatz: Keimzellen sind haploid (n). Erst die Befruchtung macht wieder 2n.") },
  { text: tx("Before meiosis II the DNA is replicated again.", "Vor der Meiose II wird die DNA noch einmal repliziert."), title: tx("No second S phase", "Keine zweite S-Phase"), say: tx("There is no replication between the two meiotic divisions. That's exactly why the DNA content halves twice.", "Zwischen den beiden Reifeteilungen wird nicht repliziert. Genau deshalb halbiert sich der DNA-Gehalt zweimal.") },
  { text: tx("Meiosis takes place in all body cells.", "Die Meiose findet in allen Körperzellen statt."), title: tx("Only in the gonads", "Nur in den Keimdrüsen"), say: tx("Meiosis only happens where sex cells are made: in the ovaries and testes (in plants in the anthers and ovules).", "Die Meiose findet nur dort statt, wo Keimzellen entstehen: in Eierstöcken und Hoden (bei Pflanzen in Staubbeuteln und Samenanlagen).") },
];

function meiosisFactTask(rng: Rng): Exercise {
  const right = rng.pick(MEIO_TRUE);
  const c = choice(rng, [{ text: right }, ...some(rng, MEIO_FALSE, 3)]);
  return {
    instruction: tx("Which statement is true?", "Welche Aussage stimmt?"),
    text: tx("Only one of these statements about meiosis is true.", "Nur eine dieser Aussagen zur Meiose ist richtig."),
    answer: c.answer,
    hint: tx("Meiosis I: homologues apart (2n → n). Meiosis II: chromatids apart (n → n).", "Meiose I: Homologe trennen (2n → n). Meiose II: Chromatiden trennen (n → n)."),
    solution: [{ math: tx('"meiosis I:" \\; 2n \\to n \\quad "meiosis II:" \\; n \\to n', '"Meiose I:" \\; 2n \\to n \\quad "Meiose II:" \\; n \\to n'), note: right }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [1.3, () => orderTask(rng)],
    [1.6, () => phaseTask(rng)],
    [1, () => matchTask(rng)],
    [1.6, () => countTask(rng)],
    [1.2, () => questionTask(rng)],
    [1.2, () => compareTask(rng)],
    [0.9, () => partTask(rng)],
    [0.7, () => ploidyTask(rng)],
    [1, () => meiosisFactTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

function ChromosomeExplorer() {
  return <DivisionChromosomes mode="explore" />;
}
function MitosisWidget() {
  return <DivisionScrubber kind="mitosis" depth={2} />;
}
function MeiosisWidget() {
  return <DivisionScrubber kind="meiosis" depth={2} />;
}

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The cell cycle", "Der Zellzyklus"),
      blob: tx("Cells follow a fixed timetable. Let's look at it!", "Zellen haben einen festen Fahrplan. Schauen wir ihn uns an!"),
      body: tx(
        "A dividing cell runs through the same cycle again and again: the **cell cycle**. It consists of the long **interphase** and the short **M phase**: **mitosis** (division of the nucleus) followed by **cytokinesis** (division of the cytoplasm).",
        "Eine Zelle, die sich teilt, durchläuft immer wieder denselben Kreislauf: den **Zellzyklus**. Er besteht aus der langen **Interphase** und der kurzen **M-Phase**: der **Mitose** (Kernteilung) und der anschließenden **Cytokinese** (Teilung des Zellplasmas).",
      ),
      frames: [
        { math: '"G1"#g1', note: tx("**G1 phase**: the cell grows and makes proteins and organelles. Each chromosome consists of **one chromatid**.", "**G1-Phase**: Die Zelle wächst und bildet Proteine und Zellorganellen. Jedes Chromosom besteht aus **einem Chromatid**.") },
        { math: '"G1"#g1 \\to#a1 "S"#s', note: tx("**S phase** (synthesis): the DNA is copied, the **replication**. Afterwards each chromosome consists of **two chromatids**.", "**S-Phase** (Synthese): Die DNA wird verdoppelt, die **Replikation**. Danach besteht jedes Chromosom aus **zwei Chromatiden**.") },
        { math: '"G1"#g1 \\to#a1 "S"#s \\to#a2 "G2"#g2', note: tx("**G2 phase**: the cell prepares for division. G1, S and G2 together are the **interphase**.", "**G2-Phase**: Die Zelle bereitet die Teilung vor. G1, S und G2 bilden zusammen die **Interphase**.") },
        { math: '"G1"#g1 \\to#a1 "S"#s \\to#a2 "G2"#g2 \\to#a3 "M"#m', note: tx("**M phase**: mitosis and cytokinesis. Then the cycle starts again, now with two cells.", "**M-Phase**: Mitose und Cytokinese. Danach beginnt der Kreislauf von vorn, jetzt mit zwei Zellen.") },
        { math: '"G0"', note: tx("Cells that no longer divide, like most nerve cells, leave the cycle after mitosis and stay in the **G0 phase**.", "Zellen, die sich nicht mehr teilen, zum Beispiel die meisten Nervenzellen, verlassen den Zyklus nach der Mitose und bleiben in der **G0-Phase**.") },
      ],
    },
    {
      type: "widget",
      title: tx("How a chromosome is built", "Wie ein Chromosom gebaut ist"),
      blob: tx("Tap the parts. These words will come up all the time!", "Tipp die Teile an. Diese Wörter brauchst du ständig!"),
      body: tx(
        "After the S phase each **one-chromatid chromosome** has become a **two-chromatid chromosome**: two identical **sister chromatids**, held together at the **centromere**. **Homologous chromosomes** are the two chromosomes of a pair: built the same way, with the same genes, but one from the mother and one from the father.",
        "Nach der S-Phase ist aus jedem **Ein-Chromatid-Chromosom** ein **Zwei-Chromatid-Chromosom** geworden: zwei identische **Schwesterchromatiden**, die am **Zentromer** zusammenhängen. **Homologe Chromosomen** sind die beiden Chromosomen eines Paares: gleich gebaut, mit denselben Genen, aber eins von der Mutter, eins vom Vater.",
      ),
      widget: ChromosomeExplorer,
    },
    {
      type: "check",
      blob: tx("Careful: chromosomes or chromatids?", "Aufgepasst: Chromosomen oder Chromatiden?"),
      exercise: countExercise(HUMAN, "g2", "chromatids"),
    },
    {
      type: "explain",
      title: tx("The phases of mitosis", "Die Phasen der Mitose"),
      blob: tx("Four phases, one goal: every daughter cell gets a complete set.", "Vier Phasen, ein Ziel: Jede Tochterzelle bekommt einen kompletten Satz."),
      body: tx("Mitosis is a continuous process. To describe it, it is divided into four phases.", "Die Mitose ist ein fließender Vorgang. Um sie zu beschreiben, teilt man sie in vier Phasen ein."),
      frames: [
        {
          math: tx('\\hl{"prophase"} \\to "metaphase" \\to "anaphase" \\to "telophase"', '\\hl{"Prophase"} \\to "Metaphase" \\to "Anaphase" \\to "Telophase"'),
          note: tx("**Prophase**: the chromosomes condense (shorten and thicken) and become visible. The nuclear envelope breaks down, the **spindle apparatus** of spindle fibres forms between the poles.", "**Prophase**: Die Chromosomen kondensieren (verkürzen und verdicken sich) und werden sichtbar. Die Kernhülle löst sich auf, zwischen den Zellpolen bildet sich der **Spindelapparat** aus Spindelfasern."),
        },
        {
          math: tx('"prophase" \\to \\hl{"metaphase"} \\to "anaphase" \\to "telophase"', '"Prophase" \\to \\hl{"Metaphase"} \\to "Anaphase" \\to "Telophase"'),
          note: tx("**Metaphase**: the two-chromatid chromosomes line up in the **equatorial plane**. Spindle fibres from both poles attach at each centromere.", "**Metaphase**: Die Zwei-Chromatid-Chromosomen ordnen sich in der **Äquatorialebene** an. Spindelfasern von beiden Polen setzen an jedem Zentromer an."),
        },
        {
          math: tx('"prophase" \\to "metaphase" \\to \\hl{"anaphase"} \\to "telophase"', '"Prophase" \\to "Metaphase" \\to \\hl{"Anaphase"} \\to "Telophase"'),
          note: tx("**Anaphase**: the sister chromatids are separated at the centromere and pulled to opposite poles. Each chromatid is now a one-chromatid chromosome.", "**Anaphase**: Die Schwesterchromatiden werden am Zentromer getrennt und zu entgegengesetzten Polen gezogen. Jedes Chromatid ist jetzt ein Ein-Chromatid-Chromosom."),
        },
        {
          math: tx('"prophase" \\to "metaphase" \\to "anaphase" \\to \\hl{"telophase"}', '"Prophase" \\to "Metaphase" \\to "Anaphase" \\to \\hl{"Telophase"}'),
          note: tx("**Telophase**: at each pole a new nuclear envelope forms, the chromosomes uncoil and the spindle disappears.", "**Telophase**: An jedem Pol bildet sich eine neue Kernhülle, die Chromosomen entspiralisieren sich, der Spindelapparat zerfällt."),
        },
        {
          math: tx('"cytokinesis"', '"Cytokinese"'),
          note: tx("**Cytokinesis**: the cytoplasm is divided. Animal cells pinch in, plant cells build a new cell wall in the middle (cell plate).", "**Cytokinese**: Das Zellplasma wird geteilt. Tierzellen schnüren sich ein, Pflanzenzellen bauen in der Mitte eine neue Zellwand auf (Zellplatte)."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Mitosis to play with", "Mitose zum Durchspielen"),
      blob: tx("Watch the counter while you drag!", "Behalt beim Ziehen den Zähler im Blick!"),
      body: tx(
        "Drag the time bar and watch the chromosomes. The counter shows how the chromatids and the DNA content (in c) change. Switch to “Human” too.",
        "Zieh am Zeitstrahl und beobachte die Chromosomen. Der Zähler zeigt, wie sich Chromatiden und DNA-Gehalt (in c) ändern. Schalte auch auf „Mensch“ um.",
      ),
      widget: MitosisWidget,
    },
    {
      type: "check",
      blob: tx("Detective time: which phase is this?", "Detektivarbeit: Welche Phase ist das?"),
      exercise: phaseExercise("ana", 6, createRng(4)),
    },
    {
      type: "explain",
      title: tx("Meiosis: sex cells with half a set", "Meiose: Keimzellen mit halbem Satz"),
      blob: tx("Now the special division for sex cells.", "Jetzt die besondere Teilung für die Keimzellen."),
      body: tx(
        "Body cells are **diploid** (2n): they have two chromosome sets, so every chromosome comes as a **homologous** pair. Sex cells are **haploid** (n): one set. **Meiosis** halves the chromosome set in two divisions.",
        "Körperzellen sind **diploid** (2n): Sie haben zwei Chromosomensätze, jedes Chromosom gibt es also als **homologes** Paar. Keimzellen sind **haploid** (n): ein Satz. Die **Meiose** halbiert den Chromosomensatz in zwei Teilungen.",
      ),
      frames: [
        { math: "2n = 46 \\quad n = 23", note: tx("In humans: 2n = 46 in body cells, n = 23 in egg and sperm cells.", "Beim Menschen: 2n = 46 in Körperzellen, n = 23 in Ei- und Spermienzellen.") },
        {
          math: tx('"meiosis I:" \\; 2n \\to n', '"Meiose I:" \\; 2n \\to n'),
          note: tx("**Meiosis I**: the homologous chromosomes pair up and are then separated. Each daughter cell gets **one** chromosome of every pair (still with two chromatids). This is where the set is halved!", "**Meiose I**: Die homologen Chromosomen legen sich paarweise zusammen und werden dann getrennt. Jede Tochterzelle bekommt von jedem Paar **ein** Chromosom (noch mit zwei Chromatiden). Hier wird halbiert!"),
        },
        {
          math: tx('"meiosis II:" \\; n \\to n', '"Meiose II:" \\; n \\to n'),
          note: tx("**Meiosis II**: just like in mitosis, the sister chromatids are separated. The chromosome number stays n.", "**Meiose II**: Wie bei einer Mitose werden die Schwesterchromatiden getrennt. Die Chromosomenzahl bleibt n."),
        },
        {
          math: tx('1 "cell" (2n) \\to 4 "cells" (n)', '1 "Zelle" (2n) \\to 4 "Zellen" (n)'),
          note: tx("Result: one diploid cell gives **four haploid sex cells**.", "Ergebnis: Aus einer diploiden Zelle entstehen **vier haploide Keimzellen**."),
        },
        {
          math: tx('"crossing over" + "chance"', '"Crossing-over" + "Zufall"'),
          note: tx(
            "The four sex cells are genetically different: homologues swap pieces (crossing over) and are shared out randomly. That's why siblings are never identical (except identical twins).",
            "Die vier Keimzellen sind genetisch verschieden: Homologe tauschen Stücke aus (Crossing-over) und werden zufällig verteilt. Darum gleichen sich Geschwister nie (außer eineiige Zwillinge).",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Meiosis to play with", "Meiose zum Durchspielen"),
      blob: tx("Red from mum, blue from dad. Watch them mix!", "Rot von Mama, blau von Papa. Schau, wie sie sich mischen!"),
      body: tx(
        "Watch the pairs of red and blue chromosomes. When is the chromosome number halved? And how do the four cells at the end differ?",
        "Beobachte die Paare aus roten und blauen Chromosomen. Wann wird die Chromosomenzahl halbiert? Und wie unterscheiden sich die vier Zellen am Ende?",
      ),
      widget: MeiosisWidget,
    },
    {
      type: "check",
      blob: tx("Mitosis or meiosis? Let's see.", "Mitose oder Meiose? Mal sehen."),
      exercise: compareExercise(createRng(21), "meio"),
    },
    {
      type: "check",
      blob: tx("Last one: the whole cycle in order.", "Zum Schluss: der ganze Ablauf in der richtigen Reihenfolge."),
      exercise: orderExercise("names", MITO_NAMES),
    },
  ],
  summary: [
    {
      title: tx("Cell cycle", "Zellzyklus"),
      body: tx(
        "Interphase (G1: growth, S: replication of the DNA, G2: preparation), then mitosis (division of the nucleus) and cytokinesis (division of the cytoplasm). G0: cells that no longer divide.",
        "Interphase (G1: Wachstum, S: Replikation der DNA, G2: Vorbereitung), dann Mitose (Kernteilung) und Cytokinese (Zellplasmateilung). G0: Zellen, die sich nicht mehr teilen.",
      ),
      examples: ['"G1" \\to "S" \\to "G2" \\to "M"'],
      tone: "rule",
    },
    {
      title: tx("Building a chromosome", "Bau der Chromosomen"),
      body: tx(
        "One-chromatid chromosome (G1). After replication: two-chromatid chromosome, two identical sister chromatids joined at the centromere. Homologous chromosomes: a pair from mother and father with the same genes.",
        "Ein-Chromatid-Chromosom (G1). Nach der Replikation: Zwei-Chromatid-Chromosom, zwei identische Schwesterchromatiden am Zentromer verbunden. Homologe Chromosomen: ein Paar von Mutter und Vater mit denselben Genen.",
      ),
      examples: [tx('"G2:" \\; 46 "chromosomes" , 92 "chromatids"', '"G2:" \\; 46 "Chromosomen" , 92 "Chromatiden"')],
      tone: "rule",
    },
    {
      title: tx("Phases of mitosis", "Phasen der Mitose"),
      body: tx(
        "Prophase: chromosomes condense, nuclear envelope breaks down, spindle forms. Metaphase: chromosomes in the equatorial plane. Anaphase: sister chromatids pulled to the poles. Telophase: new nuclear envelopes, chromosomes uncoil.",
        "Prophase: Chromosomen kondensieren, Kernhülle löst sich auf, Spindel bildet sich. Metaphase: Chromosomen in der Äquatorialebene. Anaphase: Schwesterchromatiden werden zu den Polen gezogen. Telophase: neue Kernhüllen, Chromosomen entspiralisieren sich.",
      ),
      examples: ['"P" \\to "M" \\to "A" \\to "T"'],
      tone: "rule",
    },
    {
      title: tx("Meiosis", "Meiose"),
      body: tx(
        "One diploid cell (2n) gives four haploid (n), genetically different sex cells. Meiosis I separates the homologous chromosomes, meiosis II the sister chromatids.",
        "Aus einer diploiden Zelle (2n) entstehen vier haploide (n), genetisch verschiedene Keimzellen. Meiose I trennt die homologen Chromosomen, Meiose II die Schwesterchromatiden.",
      ),
      examples: ["2n = 46 \\to n = 23"],
      tone: "rule",
    },
    {
      title: tx("Mitosis vs meiosis", "Mitose und Meiose im Vergleich"),
      body: tx(
        "Mitosis: 1 division, 2 identical cells, 2n → 2n, for growth and renewal. Meiosis: 2 divisions, 4 different cells, 2n → n, for sex cells.",
        "Mitose: 1 Teilung, 2 erbgleiche Zellen, 2n → 2n, für Wachstum und Erneuerung. Meiose: 2 Teilungen, 4 verschiedene Zellen, 2n → n, für Keimzellen.",
      ),
      examples: [tx('"mitosis:" \\; 2n \\to 2n \\quad "meiosis:" \\; 2n \\to n', '"Mitose:" \\; 2n \\to 2n \\quad "Meiose:" \\; 2n \\to n')],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Mitosis does **not** halve! Meiosis does **not** make identical cells. And chromatids aren't chromosomes: in G2 a human cell has 46 chromosomes but 92 chromatids.",
        "Die Mitose halbiert **nicht**! Die Meiose macht **keine** erbgleichen Zellen. Und Chromatiden sind keine Chromosomen: In G2 hat eine menschliche Zelle 46 Chromosomen, aber 92 Chromatiden.",
      ),
      tone: "warning",
    },
  ],
};
