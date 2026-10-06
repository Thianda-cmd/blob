"use client";

import { tx, type Text } from "@/i18n/text";
import { DnaHelix, DnaLadderFigure } from "@/learn/biology/visuals/DnaHelix";
import { DnaPairing } from "@/learn/biology/visuals/DnaPairing";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { BASE_NAME, choiceOf, complement, mistakeList, numberMistakes, PAIR, pairs, reversed, seq, variedDna, type Opt } from "./data";

// ---------------------------------------------------------------------------
// Task builders (also used by the lesson checks)

const PURINE_SWAP: Record<string, string> = { A: "G", G: "A", T: "C", C: "T" };
const spaced = (s: string) => `\\text{${[...s].join(" ")}}`;

/** The complementary strand of a short strand, typed (exact, ≤ 6 bases). */
export function complementTask(strand: string): Exercise {
  const right = complement(strand);
  const m = mistakeList();
  m.add(
    right,
    strand,
    tx("Just copied", "Nur abgeschrieben"),
    tx(
      "Ah, you copied the strand itself! The other strand isn't the same, it's the **partner**: under every A goes a T, under every G a C.",
      "Ah, du hast den Strang einfach abgeschrieben! Der Gegenstrang ist nicht gleich, sondern der **Partner**: Unter jedes A kommt ein T, unter jedes G ein C.",
    ),
  );
  m.add(
    right,
    [...strand].map((b) => PURINE_SWAP[b]).join(""),
    tx("Wrong partners", "Falsche Partner"),
    tx("I think you paired A with G and T with C. The pairs are **A–T** and **G–C**. Tip: the straight letters A and T belong together, the round ones G and C.", "Ich glaub, du hast A mit G und T mit C gepaart. Die Paare sind **A–T** und **G–C**. Tipp: Die eckigen Buchstaben A und T gehören zusammen, die runden G und C."),
  );
  m.add(
    right,
    reversed(right),
    tx("Written backwards", "Rückwärts geschrieben"),
    tx("The right partners, but in reverse order! Write each partner directly under its base, from left to right.", "Die richtigen Partner, aber in umgekehrter Reihenfolge! Schreib jeden Partner direkt unter seine Base, von links nach rechts."),
  );
  return {
    instruction: tx("Write the complementary strand", "Ergänze den Gegenstrang"),
    text: tx("Write the bases of the other strand in the same order, from left to right.", "Schreib die Basen des Gegenstrangs in derselben Reihenfolge auf, von links nach rechts."),
    math: spaced(strand),
    answer: { kind: "word", accept: [right], label: tx("Other strand:", "Gegenstrang:"), placeholder: tx("bases, e.g. TAC…", "Basen, z. B. TAC…") },
    hint: tx("A always pairs with T, G always with C. Go base by base.", "A paart immer mit T, G immer mit C. Geh Base für Base vor."),
    solution: [
      { math: pairs(strand, " ".repeat(strand.length)), note: tx("Go from left to right and find the partner for each base.", "Geh von links nach rechts und such zu jeder Base ihren Partner.") },
      { math: pairs(strand, right), note: tx(`A–T and G–C: the other strand is **${right}**.`, `A–T und G–C: Der Gegenstrang lautet **${right}**.`) },
    ],
    mistakes: m.list,
  };
}

function partnerTask(rng: Rng): Exercise {
  const b = rng.pick(["A", "T", "G", "C"] as const);
  const p = PAIR[b];
  const name = (x: string): Text => tx(`${resolveEn(BASE_NAME[x])} (${x})`, `${resolveDe(BASE_NAME[x])} (${x})`);
  const others = (["A", "T", "G", "C"] as const).filter((x) => x !== p && x !== b);
  const ch = choiceOf(rng, [
    { text: name(p) },
    {
      text: name(b),
      title: tx("Pairs with itself?", "Paart mit sich selbst?"),
      say: tx("A base never pairs with itself. Each one has exactly one partner: A with T, G with C.", "Eine Base paart nie mit sich selbst. Jede hat genau einen Partner: A mit T, G mit C."),
    },
    ...others.map((o) => ({
      text: name(o),
      title: tx("Wrong partner", "Falscher Partner"),
      say: tx(`${o} doesn't fit opposite ${b}. Remember the two pairs: A–T and G–C.`, `${o} passt nicht gegenüber von ${b}. Denk an die beiden Paare: A–T und G–C.`),
    })),
  ]);
  return {
    instruction: tx("Find the partner base", "Finde die Partnerbase"),
    text: tx(`Which base sits opposite ${resolveEn(BASE_NAME[b])} (${b}) in the other strand?`, `Welche Base steht im Gegenstrang gegenüber von ${resolveDe(BASE_NAME[b])} (${b})?`),
    answer: ch.answer,
    hint: tx("There are only two pairs in DNA.", "In der DNA gibt es nur zwei Basenpaare."),
    solution: [{ math: `\\frac{\\text{${b}}}{\\text{${p}}}`, note: tx(`${b} pairs with **${p}**: A–T and G–C.`, `${b} paart mit **${p}**: A–T und G–C.`) }],
    mistakes: ch.mistakes,
  };
}

const resolveEn = (t: Text) => (typeof t === "string" ? t : t.en);
const resolveDe = (t: Text) => (typeof t === "string" ? t : t.de);

/** Chargaff: one share given, another asked (A = T, G = C, all four add up to 100 %). */
export function chargaffTask(given: "A" | "G", pct: number, ask: "A" | "T" | "G" | "C"): Exercise {
  const share: Record<string, number> = given === "A" ? { A: pct, T: pct, G: 50 - pct, C: 50 - pct } : { G: pct, C: pct, A: 50 - pct, T: 50 - pct };
  const value = share[ask];
  const sameKind = (x: string) => (x === "A" || x === "T" ? "AT" : "GC");
  const m = numberMistakes(value);
  if (sameKind(ask) !== sameKind(given)) {
    m.add(pct, tx("Not the same share", "Nicht derselbe Anteil"), tx(`Only the **partner** of ${given} has the same share. ${ask} belongs to the other pair: the rest is shared by ${ask === "G" || ask === "C" ? "G and C" : "A and T"}.`, `Nur der **Partner** von ${given} hat denselben Anteil. ${ask} gehört zum anderen Paar: Den Rest teilen sich ${ask === "G" || ask === "C" ? "G und C" : "A und T"}.`));
    m.add(100 - pct, tx("Partner forgotten", "Partner vergessen"), tx(`You took 100 % minus ${pct} %. But ${given}'s partner has ${pct} % too, so take away twice that.`, `Du hast 100 % minus ${pct} % gerechnet. Aber der Partner von ${given} hat auch ${pct} %, also zieh das doppelt ab.`));
    m.add(100 - 2 * pct, tx("Not split up", "Nicht aufgeteilt"), tx(`Good start: ${100 - 2 * pct} % is left for the other pair. But that's two bases together, so halve it.`, `Guter Anfang: ${100 - 2 * pct} % bleiben für das andere Paar. Das sind aber zwei Basen zusammen, also halbieren.`));
  } else {
    m.add(50 - pct, tx("Other pair worked out", "Anderes Paar berechnet"), tx(`That's the share of the other pair. ${ask} is the partner of ${given}, so it has exactly the same share.`, `Das ist der Anteil des anderen Paars. ${ask} ist der Partner von ${given}, hat also genau denselben Anteil.`));
    m.add(100 - pct, tx("Subtracted from 100 %", "Von 100 % abgezogen"), tx(`No need to subtract: ${ask} pairs with ${given}, so there are exactly as many.`, `Du musst nichts abziehen: ${ask} paart mit ${given}, also gibt es genau gleich viele.`));
  }
  const nm = (x: string) => BASE_NAME[x];
  return {
    instruction: tx("Work out the share of a base", "Berechne den Anteil einer Base"),
    text: tx(
      `In a DNA double strand, ${pct} % of all bases are ${resolveEn(nm(given))}. What percentage are ${resolveEn(nm(ask))}?`,
      `In einem DNA-Doppelstrang sind ${pct} % aller Basen ${resolveDe(nm(given))}. Wie viel Prozent sind ${resolveDe(nm(ask))}?`,
    ),
    answer: { kind: "number", value, unit: "%" },
    hint: tx("Every A has a T as partner, every G a C. Together all four make 100 %.", "Jedes A hat ein T als Partner, jedes G ein C. Alle vier zusammen ergeben 100 %."),
    solution:
      sameKind(ask) === sameKind(given)
        ? [{ math: `\\text{${ask}} = \\text{${given}} = ${pct} "%"`, note: tx(`${ask} is the partner of ${given}: same number, same share.`, `${ask} ist der Partner von ${given}: gleich viele, gleicher Anteil.`) }]
        : [
            { math: `\\text{${given}} + \\text{${PAIR[given]}} = 2 \\cdot ${pct} "%" = ${2 * pct} "%"`, note: tx(`${given} and its partner ${PAIR[given]} together: ${2 * pct} %.`, `${given} und sein Partner ${PAIR[given]} zusammen: ${2 * pct} %.`) },
            { math: `100 "%" - ${2 * pct} "%" = ${100 - 2 * pct} "%"`, note: tx("The rest belongs to the other pair.", "Der Rest gehört zum anderen Paar.") },
            { math: `\\text{${ask}} = ${100 - 2 * pct} "%" : 2 = ${value} "%"`, note: tx(`Split between two partners: **${value} %** ${resolveEn(nm(ask))}.`, `Aufgeteilt auf zwei Partner: **${value} %** ${resolveDe(nm(ask))}.`) },
          ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Banks

type Pair = [Text, Text];
const TERMS: { id: string; pair: Pair }[] = [
  { id: "dna", pair: [tx("DNA", "DNA"), tx("molecule that carries the genetic information", "Molekül, das die Erbinformation trägt")] },
  { id: "gene", pair: [tx("gene", "Gen"), tx("section of DNA with the information for one protein", "DNA-Abschnitt mit der Information für ein Protein")] },
  { id: "chromosome", pair: [tx("chromosome", "Chromosom"), tx("tightly coiled DNA thread in the nucleus", "eng aufgewickelter DNA-Faden im Zellkern")] },
  { id: "pair", pair: [tx("base pair", "Basenpaar"), tx("two bases that fit together, e.g. A and T", "zwei Basen, die zusammenpassen, z. B. A und T")] },
  { id: "helix", pair: [tx("double helix", "Doppelhelix"), tx("shape of DNA, like a twisted rope ladder", "Form der DNA, wie eine verdrehte Strickleiter")] },
  { id: "nucleus", pair: [tx("nucleus", "Zellkern"), tx("where the DNA of animal and plant cells is kept", "Ort der DNA in Tier- und Pflanzenzellen")] },
  { id: "rail", pair: [tx("rail of the ladder", "Holm der Leiter"), tx("made of sugar and phosphate in turns", "abwechselnd aus Zucker und Phosphat")] },
  { id: "compl", pair: [tx("complementary", "komplementär"), tx("fitting together like A to T and G to C", "passend ergänzend wie A zu T und G zu C")] },
];
const term = (id: string) => TERMS.find((x) => x.id === id)!.pair;

function matchTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(TERMS).slice(0, 4);
  const rest = TERMS.filter((x) => !chosen.includes(x));
  const distractor = rng.pick(rest).pair[1];
  const ids = new Set(chosen.map((c) => c.id));
  const mistakes: Mistake[] = [];
  const spec: AnswerSpec = { kind: "match", pairs: chosen.map((c) => c.pair), distractors: [distractor] };
  const has = (id: string) => ids.has(id) || TERMS.find((x) => x.id === id)!.pair[1] === distractor;
  if (ids.has("gene") && has("chromosome"))
    mistakes.push({
      when: { kind: "match", pairs: [[term("gene")[0], term("chromosome")[1]]] },
      title: tx("Gene and chromosome", "Gen und Chromosom"),
      say: tx("Close, but a gene is only a **section** of the DNA. A chromosome is the whole coiled DNA thread with many genes on it.", "Knapp daneben: Ein Gen ist nur ein **Abschnitt** der DNA. Ein Chromosom ist der ganze aufgewickelte DNA-Faden mit vielen Genen darauf."),
    });
  if (ids.has("chromosome") && has("gene"))
    mistakes.push({
      when: { kind: "match", pairs: [[term("chromosome")[0], term("gene")[1]]] },
      title: tx("Chromosome and gene", "Chromosom und Gen"),
      say: tx("A chromosome holds a whole DNA thread with **many** genes. The information for one protein is just one gene.", "Ein Chromosom enthält einen ganzen DNA-Faden mit **vielen** Genen. Die Information für ein Protein ist nur ein Gen."),
    });
  if (ids.has("dna") && has("nucleus"))
    mistakes.push({
      when: { kind: "match", pairs: [[term("dna")[0], term("nucleus")[1]]] },
      title: tx("Molecule or place?", "Molekül oder Ort?"),
      say: tx("The nucleus is the **place** where the DNA is kept. DNA itself is the molecule with the information.", "Der Zellkern ist der **Ort**, an dem die DNA liegt. Die DNA selbst ist das Molekül mit der Information."),
    });
  return {
    instruction: tx("Match each term to its meaning", "Ordne jedem Begriff seine Bedeutung zu"),
    answer: spec,
    hint: tx("Start with the ones you're sure about. One meaning is left over.", "Fang mit denen an, bei denen du sicher bist. Eine Bedeutung bleibt übrig."),
    solution: [
      {
        math: tx(chosen.map((c) => `"${resolveEn(c.pair[0])}"`).join(" \\quad "), chosen.map((c) => `"${resolveDe(c.pair[0])}"`).join(" \\quad ")),
        note: tx(chosen.map((c) => `**${resolveEn(c.pair[0])}**: ${resolveEn(c.pair[1])}.`).join(" "), chosen.map((c) => `**${resolveDe(c.pair[0])}**: ${resolveDe(c.pair[1])}.`).join(" ")),
      },
    ],
    mistakes,
  };
}

const SIZES: Text[] = [tx("cell", "Zelle"), tx("nucleus", "Zellkern"), tx("chromosome", "Chromosom"), tx("gene", "Gen"), tx("base pair", "Basenpaar")];

function orderTask(rng: Rng): Exercise {
  const drop = rng.int(0, 4);
  const items = SIZES.filter((_, i) => i !== drop);
  const bigFirst = rng.chance(0.5);
  const ordered = bigFirst ? items : [...items].reverse();
  const mistakes: Mistake[] = [];
  const gene = SIZES[3];
  const chrom = SIZES[2];
  if (drop !== 2 && drop !== 3)
    mistakes.push({
      when: { kind: "order", items: bigFirst ? [gene, chrom] : [chrom, gene] },
      title: tx("Gene and chromosome swapped", "Gen und Chromosom vertauscht"),
      say: tx("A chromosome is much bigger than a gene: one chromosome carries hundreds to thousands of genes.", "Ein Chromosom ist viel größer als ein Gen: Auf einem Chromosom liegen Hunderte bis Tausende Gene."),
    });
  if (drop !== 1 && drop !== 2)
    mistakes.push({
      when: { kind: "order", items: bigFirst ? [chrom, SIZES[1]] : [SIZES[1], chrom] },
      title: tx("Nucleus and chromosome", "Zellkern und Chromosom"),
      say: tx("The chromosomes lie **inside** the nucleus, so the nucleus is bigger.", "Die Chromosomen liegen **im** Zellkern, der Zellkern ist also größer."),
    });
  return {
    instruction: bigFirst ? tx("Order from the largest to the smallest", "Ordne vom Größten zum Kleinsten") : tx("Order from the smallest to the largest", "Ordne vom Kleinsten zum Größten"),
    answer: { kind: "order", items: ordered },
    hint: tx("What lies inside what? The cell contains the nucleus, the nucleus contains …", "Was liegt worin? Die Zelle enthält den Zellkern, der Zellkern enthält …"),
    solution: [
      {
        math: tx(ordered.map((x) => `"${resolveEn(x)}"`).join(bigFirst ? " > " : " < "), ordered.map((x) => `"${resolveDe(x)}"`).join(bigFirst ? " > " : " < ")),
        note: tx("Each one lies inside the one before: cell, nucleus, chromosome, gene, base pair.", "Jedes steckt im vorherigen: Zelle, Zellkern, Chromosom, Gen, Basenpaar."),
      },
    ],
    mistakes,
  };
}

type Fact = { q: Text; opts: Opt[]; hint: Text; why: Text; key: Text };
const FACTS: Fact[] = [
  {
    q: tx("Where is the DNA in an animal or plant cell?", "Wo liegt die DNA in einer Tier- oder Pflanzenzelle?"),
    opts: [
      { text: tx("in the nucleus, in the chromosomes", "im Zellkern, in den Chromosomen") },
      { text: tx("in the cell membrane", "in der Zellmembran"), title: tx("Membrane is the border", "Membran ist die Grenze"), say: tx("The cell membrane is the border of the cell. The DNA is safely packed in the nucleus.", "Die Zellmembran ist die Grenze der Zelle. Die DNA liegt gut geschützt im Zellkern.") },
      { text: tx("in the vacuole", "in der Vakuole") },
      { text: tx("only in the egg and sperm cells", "nur in Ei- und Spermienzellen"), title: tx("In every cell", "In jeder Zelle"), say: tx("Almost every cell of your body has the complete DNA in its nucleus, not just the sex cells.", "Fast jede Zelle deines Körpers hat die vollständige DNA im Zellkern, nicht nur die Keimzellen.") },
    ],
    hint: tx("Think of the control centre of the cell.", "Denk an die Steuerzentrale der Zelle."),
    why: tx("The DNA lies in the **nucleus**, divided among the chromosomes.", "Die DNA liegt im **Zellkern**, verteilt auf die Chromosomen."),
    key: tx('"nucleus"', '"Zellkern"'),
  },
  {
    q: tx("What does a gene contain?", "Was enthält ein Gen?"),
    opts: [
      { text: tx("the information for one protein", "die Information für ein Protein") },
      { text: tx("all the genetic information of a living thing", "die gesamte Erbinformation eines Lebewesens"), title: tx("Only one part", "Nur ein Teil"), say: tx("That's the whole DNA (the genome). A gene is just one section of it.", "Das ist die ganze DNA (das Genom). Ein Gen ist nur ein Abschnitt davon.") },
      { text: tx("a finished protein", "ein fertiges Protein"), title: tx("Plan, not product", "Bauplan, kein Produkt"), say: tx("A gene is the **building plan**, made of DNA. The protein is built later from this plan.", "Ein Gen ist der **Bauplan** aus DNA. Das Protein wird erst danach nach diesem Plan gebaut.") },
      { text: tx("only one single base", "nur eine einzige Base") },
    ],
    hint: tx("A gene is a section of DNA. What is it a plan for?", "Ein Gen ist ein DNA-Abschnitt. Wofür ist es ein Bauplan?"),
    why: tx("A gene is a section of DNA with the **information for one protein**.", "Ein Gen ist ein DNA-Abschnitt mit der **Information für ein Protein**."),
    key: tx('"gene" \\to "protein"', '"Gen" \\to "Protein"'),
  },
  {
    q: tx("Where exactly is the genetic information stored in DNA?", "Worin genau steckt die Erbinformation der DNA?"),
    opts: [
      { text: tx("in the order of the bases", "in der Reihenfolge der Basen") },
      { text: tx("in the length of the rails", "in der Länge der Holme") },
      { text: tx("in the number of sugars", "in der Zahl der Zuckermoleküle"), title: tx("Sugars are all the same", "Zucker sind alle gleich"), say: tx("All sugars and phosphates in the rails are the same. Only the bases differ, and their order is the message.", "Alle Zucker und Phosphate in den Holmen sind gleich. Nur die Basen unterscheiden sich, und ihre Reihenfolge ist die Botschaft.") },
      { text: tx("in how tightly the helix is twisted", "darin, wie stark die Helix verdreht ist") },
    ],
    hint: tx("Like letters in a word: what makes \"REGEN\" different from \"GERNE\"?", "Wie Buchstaben in einem Wort: Was unterscheidet „REGEN“ von „GERNE“?"),
    why: tx("The information is the **order of the bases**, like the order of letters in a word.", "Die Information ist die **Reihenfolge der Basen**, wie die Reihenfolge der Buchstaben in einem Wort."),
    key: tx('"order of the bases"', '"Reihenfolge der Basen"'),
  },
  {
    q: tx("What are the rails of the DNA ladder made of?", "Woraus bestehen die Holme der DNA-Strickleiter?"),
    opts: [
      { text: tx("sugar and phosphate, taking turns", "abwechselnd aus Zucker und Phosphat") },
      { text: tx("base pairs", "aus Basenpaaren"), title: tx("Those are the rungs", "Das sind die Sprossen"), say: tx("The base pairs are the **rungs** of the ladder. The rails on the outside are sugar and phosphate.", "Die Basenpaare sind die **Sprossen** der Leiter. Die Holme außen bestehen aus Zucker und Phosphat.") },
      { text: tx("proteins", "aus Proteinen") },
      { text: tx("fat", "aus Fett") },
    ],
    hint: tx("The rungs are the base pairs. What's on the outside?", "Die Sprossen sind die Basenpaare. Was ist außen?"),
    why: tx("The rails (the backbone) are made of **sugar (deoxyribose) and phosphate** in turns.", "Die Holme (das Rückgrat) bestehen abwechselnd aus **Zucker (Desoxyribose) und Phosphat**."),
    key: tx('"sugar + phosphate"', '"Zucker + Phosphat"'),
  },
  {
    q: tx("How many different bases are there in DNA?", "Wie viele verschiedene Basen gibt es in der DNA?"),
    opts: [{ text: tx("four", "vier") }, { text: tx("two", "zwei"), title: tx("Two pairs, four bases", "Zwei Paare, vier Basen"), say: tx("There are two **pairs**, but four different bases: A, T, G and C.", "Es gibt zwei **Paare**, aber vier verschiedene Basen: A, T, G und C.") }, { text: tx("twenty", "zwanzig") }, { text: tx("46", "46"), title: tx("That's chromosomes", "Das sind Chromosomen"), say: tx("46 is the number of chromosomes in a human body cell, not the number of bases.", "46 ist die Zahl der Chromosomen in einer Körperzelle des Menschen, nicht die Zahl der Basen.") }],
    hint: tx("A, T, G, …", "A, T, G, …"),
    why: tx("Four bases: **adenine, thymine, guanine and cytosine**.", "Vier Basen: **Adenin, Thymin, Guanin und Cytosin**."),
    key: "\\text{A, T, G, C}",
  },
  {
    q: tx("Who published the double helix model in 1953?", "Wer stellte 1953 das Doppelhelix-Modell vor?"),
    opts: [{ text: tx("James Watson and Francis Crick", "James Watson und Francis Crick") }, { text: tx("Gregor Mendel (pea experiments)", "Gregor Mendel (Erbsenversuche)"), title: tx("Mendel was earlier", "Mendel war früher"), say: tx("Mendel found the rules of inheritance around 1865, long before anyone knew about DNA.", "Mendel fand um 1865 die Vererbungsregeln, lange bevor man von der DNA wusste.") }, { text: tx("Charles Darwin (evolution)", "Charles Darwin (Evolution)") }, { text: tx("Robert Koch (bacteria)", "Robert Koch (Bakterien)") }],
    hint: tx("Two researchers in Cambridge.", "Zwei Forscher in Cambridge."),
    why: tx("**Watson and Crick** built the model in 1953, using Rosalind Franklin's X-ray image.", "**Watson und Crick** bauten 1953 das Modell, mithilfe von Rosalind Franklins Röntgenbild."),
    key: "\\text{Watson & Crick, 1953}",
  },
  {
    q: tx("Whose X-ray image showed that DNA is a helix?", "Wessen Röntgenbild zeigte, dass die DNA eine Helix ist?"),
    opts: [{ text: tx("Rosalind Franklin's", "das von Rosalind Franklin") }, { text: tx("Marie Curie's", "das von Marie Curie") }, { text: tx("Gregor Mendel's", "das von Gregor Mendel") }, { text: tx("Charles Darwin's", "das von Charles Darwin") }],
    hint: tx("Her \"Photo 51\" became famous.", "Ihr „Foto 51“ wurde berühmt."),
    why: tx("**Rosalind Franklin's** \"Photo 51\" showed the helix shape.", "**Rosalind Franklins** „Foto 51“ zeigte die Helix-Form."),
    key: "\\text{Rosalind Franklin}",
  },
  {
    q: tx("Why do only A–T and G–C fit together?", "Warum passen nur A–T und G–C zusammen?"),
    opts: [
      { text: tx("their shapes and sizes fit exactly, so the ladder stays equally wide", "Form und Größe passen genau, so bleibt die Leiter überall gleich breit") },
      { text: tx("they have the same colour", "sie haben dieselbe Farbe"), title: tx("Colours are made up", "Farben sind ausgedacht"), say: tx("The colours are just in our drawings! What matters is that the shapes fit together.", "Die Farben gibt es nur in unseren Zeichnungen! Es kommt darauf an, dass die Formen zusammenpassen.") },
      { text: tx("by chance, it could just as well be A–G", "aus Zufall, es könnte genauso gut A–G sein") },
      { text: tx("because A and T are the most common", "weil A und T am häufigsten sind") },
    ],
    hint: tx("Think of the rungs of a ladder: they all need the same length.", "Denk an die Sprossen einer Leiter: Sie müssen alle gleich lang sein."),
    why: tx("A–T and G–C fit like puzzle pieces: every rung has the **same width**.", "A–T und G–C passen wie Puzzleteile: Jede Sprosse hat die **gleiche Breite**."),
    key: "\\frac{\\text{A}}{\\text{T}} \\quad \\frac{\\text{G}}{\\text{C}}",
  },
  {
    q: tx("What does \"complementary\" mean for the two DNA strands?", "Was bedeutet „komplementär“ bei den beiden DNA-Strängen?"),
    opts: [
      { text: tx("they complete each other: knowing one strand tells you the other", "sie ergänzen sich: Kennt man einen Strang, kennt man den anderen") },
      { text: tx("they are exactly the same", "sie sind genau gleich"), title: tx("Partners, not twins", "Partner, keine Zwillinge"), say: tx("Complementary strands are partners, not copies: opposite A there is T, not A.", "Komplementäre Stränge sind Partner, keine Kopien: Gegenüber von A steht T, nicht A.") },
      { text: tx("they carry different genes", "sie tragen verschiedene Gene") },
      { text: tx("they are not connected at all", "sie sind gar nicht verbunden") },
    ],
    hint: tx("Look at a base pair: A and T.", "Schau auf ein Basenpaar: A und T."),
    why: tx("**Complementary** means the strands complete each other: A–T and G–C.", "**Komplementär** heißt, die Stränge ergänzen sich: A–T und G–C."),
    key: pairs("ATG", "TAC"),
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const ch = choiceOf(rng, f.opts);
  return {
    instruction: tx("Choose the right answer", "Wähle die richtige Antwort"),
    text: f.q,
    answer: ch.answer,
    hint: f.hint,
    solution: [{ math: f.key, note: f.why }],
    mistakes: ch.mistakes,
  };
}

const LADDER_NAMES: Record<string, Text> = {
  rail: tx("rail (sugar-phosphate backbone)", "Holm (Zucker-Phosphat-Rückgrat)"),
  sugar: tx("sugar (deoxyribose)", "Zucker (Desoxyribose)"),
  phosphate: tx("phosphate", "Phosphat"),
  base: tx("one base", "eine einzelne Base"),
  pair: tx("base pair (rung)", "Basenpaar (Sprosse)"),
};

function ladderTask(rng: Rng): Exercise {
  const ask = rng.pick(Object.keys(LADDER_NAMES));
  const wrong = rng.shuffle(Object.keys(LADDER_NAMES).filter((k) => k !== ask)).slice(0, 3);
  const msg = (pick: string): Opt => {
    const text = LADDER_NAMES[pick];
    const pentagon = tx("In the drawing the sugars are the pentagons, the phosphates the small circles between them.", "In der Zeichnung sind die Zucker die Fünfecke, die Phosphate die kleinen Kreise dazwischen.");
    if (ask === "pair" && pick === "base")
      return { text, title: tx("Half a rung", "Eine halbe Sprosse"), say: tx("One base is only half a rung. The marked part is the whole rung: two bases, a base pair.", "Eine Base ist nur eine halbe Sprosse. Markiert ist die ganze Sprosse: zwei Basen, ein Basenpaar.") };
    if (ask === "base" && pick === "pair")
      return { text, title: tx("Just one half", "Nur eine Hälfte"), say: tx("Look again: the mark points at only one half of the rung, a single base.", "Schau noch mal: Die Markierung zeigt nur auf eine Hälfte der Sprosse, eine einzelne Base.") };
    if ((ask === "sugar" && pick === "phosphate") || (ask === "phosphate" && pick === "sugar")) return { text, title: tx("Pentagon or circle?", "Fünfeck oder Kreis?"), say: pentagon };
    if ((ask === "sugar" || ask === "phosphate") && pick === "rail")
      return { text, title: tx("Smaller part", "Kleineres Teil"), say: tx("The rail is the whole side of the ladder. The mark points at one single building block of it.", "Der Holm ist die ganze Seite der Leiter. Die Markierung zeigt auf einen einzelnen Baustein davon.") };
    if (ask === "rail" && (pick === "sugar" || pick === "phosphate"))
      return { text, title: tx("The whole side", "Die ganze Seite"), say: tx("The mark sits on the line that links everything: the whole side of the ladder, made of sugar and phosphate.", "Die Markierung sitzt auf der Linie, die alles verbindet: die ganze Seite der Leiter aus Zucker und Phosphat.") };
    return { text };
  };
  const opts: Opt[] = [{ text: LADDER_NAMES[ask] }, ...wrong.map(msg)];
  const ch = choiceOf(rng, opts);
  return {
    instruction: tx("Name the marked part", "Benenne das markierte Teil"),
    text: tx("What is marked with ? in the DNA ladder?", "Was ist in der DNA-Strickleiter mit ? markiert?"),
    visual: { component: DnaLadderFigure as never, props: { mode: "numbers", ask, legend: "none" } },
    answer: ch.answer,
    hint: tx("Rails: sugar (pentagon) and phosphate (circle). Rungs: base pairs.", "Holme: Zucker (Fünfeck) und Phosphat (Kreis). Sprossen: Basenpaare."),
    solution: [{ math: tx(`"${resolveEn(LADDER_NAMES[ask])}"`, `"${resolveDe(LADDER_NAMES[ask])}"`), note: tx("Rails of sugar and phosphate, rungs of base pairs.", "Holme aus Zucker und Phosphat, Sprossen aus Basenpaaren.") }],
    mistakes: ch.mistakes,
  };
}

function mismatchTask(rng: Rng): Exercise {
  const top = variedDna(rng, 6, 4);
  const bottom = [...complement(top)];
  const m = rng.int(0, 5);
  const wrongBase = rng.pick(["A", "T", "G", "C"].filter((b) => b !== PAIR[top[m]]));
  bottom[m] = wrongBase;
  const bot = bottom.join("");
  const pairText = (i: number) => tx(`pair ${i + 1}: ${top[i]}–${bot[i]}`, `Paar ${i + 1}: ${top[i]}–${bot[i]}`);
  // Distractors: other positions, preferring pairs written "T–A" or "C–G" (the order doesn't matter!).
  const others = rng.shuffle([0, 1, 2, 3, 4, 5].filter((i) => i !== m));
  others.sort((a, b) => Number("TC".includes(top[b])) - Number("TC".includes(top[a])));
  const opts: Opt[] = [
    { text: pairText(m) },
    ...others.slice(0, 3).map((i) =>
      "TC".includes(top[i])
        ? {
            text: pairText(i),
            title: tx("Order doesn't matter", "Reihenfolge egal"),
            say: tx(`${top[i]}–${bot[i]} is fine: it's the same pair as ${bot[i]}–${top[i]}, just seen from the other strand.`, `${top[i]}–${bot[i]} ist richtig: Es ist dasselbe Paar wie ${bot[i]}–${top[i]}, nur vom anderen Strang aus gesehen.`),
          }
        : { text: pairText(i) },
    ),
  ];
  const ch = choiceOf(rng, opts);
  return {
    instruction: tx("Find the wrong base pair", "Finde das falsche Basenpaar"),
    text: tx("One base pair in this DNA section can't be right. Which one?", "Ein Basenpaar in diesem DNA-Abschnitt kann nicht stimmen. Welches?"),
    math: pairs(top, bot),
    answer: ch.answer,
    hint: tx("Check each rung: only A–T (or T–A) and G–C (or C–G) are allowed.", "Prüf jede Sprosse: Erlaubt sind nur A–T (oder T–A) und G–C (oder C–G)."),
    solution: [{ math: pairs(top, bot, { mark: [m] }), note: tx(`Pair ${m + 1}: ${top[m]} needs ${PAIR[top[m]]} as its partner, not ${wrongBase}.`, `Paar ${m + 1}: ${top[m]} braucht ${PAIR[top[m]]} als Partner, nicht ${wrongBase}.`) }],
    mistakes: ch.mistakes,
  };
}

type WordQ = { q: Text; accept: Text[]; wrong?: { w: string; title: Text; say: Text; close?: boolean }[]; why: Text };
const WORDS: WordQ[] = [
  {
    q: tx("What is the section of DNA called that holds the information for one protein?", "Wie heißt der DNA-Abschnitt, der die Information für ein Protein enthält?"),
    accept: [tx("gene", "Gen")],
    wrong: [{ w: "Chromosom", title: tx("Too big", "Zu groß"), say: tx("A chromosome is the whole DNA thread with many of these sections. One section is a …?", "Ein Chromosom ist der ganze DNA-Faden mit vielen solchen Abschnitten. Ein Abschnitt ist ein …?") }],
    why: tx("A **gene**: a section of DNA with the information for one protein.", "Ein **Gen**: ein DNA-Abschnitt mit der Information für ein Protein."),
  },
  {
    q: tx("What is the shape of DNA called, the twisted rope ladder?", "Wie heißt die Form der DNA, die verdrehte Strickleiter?"),
    accept: [tx("double helix", "Doppelhelix")],
    wrong: [{ w: "Helix", title: tx("Almost", "Fast"), say: tx("Almost! There are two strands twisted around each other. So it's a … helix?", "Fast! Es sind zwei Stränge umeinander gewunden. Also eine …-Helix?"), close: true }],
    why: tx("The **double helix**: two strands twisted around each other.", "Die **Doppelhelix**: zwei umeinander gewundene Stränge."),
  },
  {
    q: tx("Which base pairs with adenine in DNA?", "Welche Base paart in der DNA mit Adenin?"),
    accept: [tx("thymine", "Thymin"), "T"],
    wrong: [{ w: "Guanin", title: tx("Wrong partner", "Falscher Partner"), say: tx("Guanine pairs with cytosine. Adenine has a different partner.", "Guanin paart mit Cytosin. Adenin hat einen anderen Partner.") }],
    why: tx("A–T: adenine pairs with **thymine**.", "A–T: Adenin paart mit **Thymin**."),
  },
  {
    q: tx("Which base pairs with cytosine in DNA?", "Welche Base paart in der DNA mit Cytosin?"),
    accept: [tx("guanine", "Guanin"), "G"],
    wrong: [{ w: "Thymin", title: tx("Wrong partner", "Falscher Partner"), say: tx("Thymine pairs with adenine. Cytosine has a different partner.", "Thymin paart mit Adenin. Cytosin hat einen anderen Partner.") }],
    why: tx("G–C: cytosine pairs with **guanine**.", "G–C: Cytosin paart mit **Guanin**."),
  },
  {
    q: tx("Which base pairs with thymine in DNA?", "Welche Base paart in der DNA mit Thymin?"),
    accept: [tx("adenine", "Adenin"), "A"],
    wrong: [{ w: "Cytosin", title: tx("Wrong partner", "Falscher Partner"), say: tx("Cytosine pairs with guanine. Thymine has a different partner.", "Cytosin paart mit Guanin. Thymin hat einen anderen Partner.") }],
    why: tx("A–T: thymine pairs with **adenine**.", "A–T: Thymin paart mit **Adenin**."),
  },
  {
    q: tx("Which base pairs with guanine in DNA?", "Welche Base paart in der DNA mit Guanin?"),
    accept: [tx("cytosine", "Cytosin"), "C", "Zytosin"],
    wrong: [{ w: "Adenin", title: tx("Wrong partner", "Falscher Partner"), say: tx("Adenine pairs with thymine. Guanine has a different partner.", "Adenin paart mit Thymin. Guanin hat einen anderen Partner.") }],
    why: tx("G–C: guanine pairs with **cytosine**.", "G–C: Guanin paart mit **Cytosin**."),
  },
  {
    q: tx("What does DNA stand for? Write the full name.", "Wofür steht DNA? Schreib den vollen Namen."),
    accept: [tx("deoxyribonucleic acid", "Desoxyribonukleinsäure"), "Desoxyribonucleinsäure"],
    why: tx("DNA = **deoxyribonucleic acid** (German: Desoxyribonukleinsäure).", "DNA = **Desoxyribonukleinsäure** (englisch deoxyribonucleic acid, daher das A)."),
  },
  {
    q: tx("In which part of an animal or plant cell is the DNA kept?", "In welchem Teil einer Tier- oder Pflanzenzelle liegt die DNA?"),
    accept: [tx("nucleus", "Zellkern"), "Kern", "Nukleus", "cell nucleus"],
    wrong: [{ w: "Zellplasma", title: tx("Not loose in the cell", "Nicht lose in der Zelle"), say: tx("In animal and plant cells the DNA isn't loose in the cytoplasm. It's packed in its own compartment.", "Bei Tier- und Pflanzenzellen liegt die DNA nicht lose im Zellplasma, sondern gut verpackt in einem eigenen Raum.") }],
    why: tx("In the **nucleus**.", "Im **Zellkern**."),
  },
  {
    q: tx("Which word describes two strands whose bases fit together like A to T and G to C?", "Mit welchem Fachwort beschreibt man zwei Stränge, deren Basen sich ergänzen wie A zu T und G zu C?"),
    accept: [tx("complementary", "komplementär")],
    wrong: [{ w: "identisch", title: tx("Not identical", "Nicht identisch"), say: tx("The strands aren't identical: opposite A there's T. They complete each other.", "Die Stränge sind nicht identisch: Gegenüber von A steht T. Sie ergänzen sich.") }],
    why: tx("**Complementary**: the strands complete each other.", "**Komplementär**: Die Stränge ergänzen sich."),
  },
];

function wordTask(rng: Rng): Exercise {
  const w = rng.pick(WORDS);
  const mistakes: Mistake[] = (w.wrong ?? []).map((x) => ({ when: { kind: "word", accept: [x.w] }, title: x.title, say: x.say, ...(x.close ? { close: true } : {}) }));
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: w.q,
    answer: { kind: "word", accept: w.accept },
    hint: tx("One word is enough.", "Ein Wort reicht."),
    solution: [{ math: tx(`"${resolveEn(w.accept[0])}"`, `"${resolveDe(w.accept[0])}"`), note: w.why }],
    mistakes,
  };
}

function countTask(rng: Rng): Exercise {
  const v = rng.int(0, 2);
  if (v === 0) {
    const a = rng.int(4, 12);
    const tt = rng.int(3, 12);
    const g = rng.int(3, 10);
    const c = rng.int(3, 10);
    const askT = rng.chance(0.5);
    const value = askT ? a : g;
    const m = numberMistakes(value);
    m.add(askT ? tt : c, tx("Same strand counted", "Im selben Strang gezählt"), tx(`That's the number in the **same** strand. In the other strand, the partners of ${askT ? "A" : "G"} are what counts.`, `Das ist die Anzahl im **selben** Strang. Im Gegenstrang zählen die Partner von ${askT ? "A" : "G"}.`));
    m.add(askT ? a + tt : g + c, tx("Added up", "Zusammengezählt"), tx("No need to add: each base in the other strand is exactly the partner of one base here.", "Du musst nichts addieren: Jede Base im Gegenstrang ist genau der Partner einer Base hier."));
    return {
      instruction: tx("Count bases in the other strand", "Zähle Basen im Gegenstrang"),
      text: tx(
        `One strand of a DNA section has ${a} adenine, ${tt} thymine, ${g} guanine and ${c} cytosine. How many bases of the other strand are ${askT ? "thymine" : "cytosine"}?`,
        `Ein Strang eines DNA-Abschnitts hat ${a} Adenin, ${tt} Thymin, ${g} Guanin und ${c} Cytosin. Wie viele Basen im Gegenstrang sind ${askT ? "Thymin" : "Cytosin"}?`,
      ),
      answer: { kind: "number", value },
      hint: tx(`Opposite every ${askT ? "A" : "G"} in this strand there is a ${askT ? "T" : "C"} in the other one.`, `Gegenüber von jedem ${askT ? "A" : "G"} in diesem Strang steht im anderen ein ${askT ? "T" : "C"}.`),
      solution: [{ math: `\\text{${askT ? "T" : "C"}} = \\text{${askT ? "A" : "G"}} = ${value}`, note: tx(`Every ${askT ? "A" : "G"} gets a ${askT ? "T" : "C"} as partner: **${value}**.`, `Jedes ${askT ? "A" : "G"} bekommt ein ${askT ? "T" : "C"} als Partner: **${value}**.`) }],
      mistakes: m.list,
    };
  }
  if (v === 1) {
    const bp = rng.pick([12, 15, 18, 20, 24, 25, 30, 36, 40, 50]);
    const m = numberMistakes(2 * bp);
    m.add(bp, tx("Only one strand", "Nur ein Strang"), tx("That's one strand. Every base pair consists of **two** bases.", "Das ist nur ein Strang. Jedes Basenpaar besteht aus **zwei** Basen."));
    m.add(bp / 2, tx("Halved", "Halbiert"), tx("You halved, but a pair has two bases, so double it.", "Du hast halbiert, aber ein Paar hat zwei Basen, also verdoppeln."));
    return {
      instruction: tx("Count the bases", "Zähle die Basen"),
      text: tx(`A DNA section has ${bp} base pairs. How many bases is that in total?`, `Ein DNA-Abschnitt hat ${bp} Basenpaare. Wie viele Basen sind das insgesamt?`),
      answer: { kind: "number", value: 2 * bp },
      hint: tx("How many bases make one pair?", "Wie viele Basen bilden ein Paar?"),
      solution: [{ math: `${bp} \\cdot 2 = ${2 * bp}`, note: tx(`Two bases per pair: **${2 * bp}** bases.`, `Zwei Basen pro Paar: **${2 * bp}** Basen.`) }],
      mistakes: m.list,
    };
  }
  const total = rng.pick([20, 30, 40, 50, 60]);
  const a = rng.int(2, total / 2 - 2);
  const value = (total - 2 * a) / 2;
  const m = numberMistakes(value);
  m.add(a, tx("Not the same number", "Nicht gleich viele"), tx("Only A and T come in equal numbers. G pairs with C, so G and C share what's left.", "Nur A und T gibt es gleich oft. G paart mit C, also teilen sich G und C den Rest."));
  m.add(total - a, tx("Partner forgotten", "Partner vergessen"), tx(`Each A has a T, so ${2 * a} bases are A and T together. Then split the rest.`, `Jedes A hat ein T, also sind ${2 * a} Basen A und T zusammen. Dann den Rest aufteilen.`));
  m.add(total - 2 * a, tx("Not split up", "Nicht aufgeteilt"), tx("That's G and C together. Halve it for G alone.", "Das sind G und C zusammen. Halbier es für G allein."));
  return {
    instruction: tx("Work out the number of guanine", "Berechne die Zahl der Guanin-Basen"),
    text: tx(`A DNA double strand has ${total} bases in total, ${a} of them adenine. How many bases are guanine?`, `Ein DNA-Doppelstrang hat insgesamt ${total} Basen, davon ${a} Adenin. Wie viele Basen sind Guanin?`),
    answer: { kind: "number", value },
    hint: tx("Every A has a T. The rest are G and C in equal numbers.", "Jedes A hat ein T. Der Rest sind G und C, gleich viele."),
    solution: [
      { math: `\\text{A} + \\text{T} = ${a} + ${a} = ${2 * a}`, note: tx("As many T as A.", "Genauso viele T wie A.") },
      { math: `\\text{G} = (${total} - ${2 * a}) : 2 = ${value}`, note: tx(`The rest is shared by G and C: **${value}** guanine.`, `Den Rest teilen sich G und C: **${value}** Guanin.`) },
    ],
    mistakes: m.list,
  };
}

function combosTask(rng: Rng): Exercise {
  const n = rng.int(2, 5);
  const value = 4 ** n;
  const m = numberMistakes(value);
  m.add(4 * n, tx("Multiplied by n", "Mal n gerechnet"), tx(`Each place has 4 choices, and these multiply: 4 · 4 · … (${n} times), not 4 · ${n}.`, `Jede Stelle hat 4 Möglichkeiten, und die werden multipliziert: 4 · 4 · … (${n}-mal), nicht 4 · ${n}.`));
  m.add(n ** 4, tx("Base and exponent swapped", "Basis und Hochzahl vertauscht"), tx(`It's 4 choices at each of ${n} places: $4^{${n}}$, not $${n}^4$.`, `Es sind 4 Möglichkeiten an jeder der ${n} Stellen: $4^{${n}}$, nicht $${n}^4$.`));
  m.add(4, tx("Only one place", "Nur eine Stelle"), tx("4 is right for one single place. With more places the choices multiply.", "4 stimmt für eine einzige Stelle. Bei mehr Stellen multiplizieren sich die Möglichkeiten."));
  return {
    instruction: tx("Count the possible sequences", "Zähle die möglichen Basenfolgen"),
    text: tx(`How many different base sequences are possible for a DNA strand of ${n} bases?`, `Wie viele verschiedene Basenfolgen sind für einen DNA-Strang aus ${n} Basen möglich?`),
    answer: { kind: "number", value },
    hint: tx("Each place can be A, T, G or C, independently of the others.", "Jede Stelle kann A, T, G oder C sein, unabhängig von den anderen."),
    solution: [
      { math: `${Array(n).fill("4").join(" \\cdot ")}`, note: tx(`4 choices for each of the ${n} places.`, `4 Möglichkeiten für jede der ${n} Stellen.`) },
      { math: `4^{${n}} = ${value}`, note: tx(`**${value}** possible sequences. That's why four bases are enough for a huge amount of information.`, `**${value}** mögliche Basenfolgen. Darum reichen vier Basen für riesig viel Information.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Practice

const SHAPES: [number, (rng: Rng) => Exercise][] = [
  [3, (rng) => complementTask(variedDna(rng, 6, 3))],
  [1, partnerTask],
  [
    2,
    (rng) => {
      const given = rng.pick(["A", "G"] as const);
      return chargaffTask(given, rng.int(12, 38), rng.pick((["A", "T", "G", "C"] as const).filter((b) => b !== given)));
    },
  ],
  [1.5, matchTask],
  [1, orderTask],
  [2.5, factTask],
  [1.2, ladderTask],
  [1.5, mismatchTask],
  [2, wordTask],
  [1.5, countTask],
  [0.8, combosTask],
];

export function generate1(rng: Rng): Exercise {
  const total = SHAPES.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, make] of SHAPES) {
    if ((r -= w) < 0) return make(rng);
  }
  return SHAPES[0][1](rng);
}

// ---------------------------------------------------------------------------
// Lesson

const geneCheck = choiceOf(createRng(3), [
  { text: tx("a section of DNA with the information for one protein", "ein Abschnitt der DNA mit der Information für ein Protein") },
  { text: tx("another word for chromosome", "ein anderes Wort für Chromosom"), title: tx("Gene ≠ chromosome", "Gen ≠ Chromosom"), say: tx("A chromosome is a whole DNA thread with **many** genes. A gene is just one section of it.", "Ein Chromosom ist ein ganzer DNA-Faden mit **vielen** Genen. Ein Gen ist nur ein Abschnitt davon.") },
  { text: tx("one of the four bases", "eine der vier Basen") },
  { text: tx("a protein that makes a trait", "ein Protein, das ein Merkmal bildet"), title: tx("Plan, not product", "Bauplan, kein Produkt"), say: tx("The gene is the **plan** made of DNA. The protein is what's built from it.", "Das Gen ist der **Bauplan** aus DNA. Das Protein ist das, was danach gebaut wird.") },
]);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Where is the genetic information?", "Wo steckt die Erbinformation?"),
      blob: tx("Today we look at the building plan of life!", "Heute schauen wir uns den Bauplan des Lebens an!"),
      body: tx(
        "Almost every cell of your body contains a complete building plan of you. It is stored in a molecule called **DNA** (deoxyribonucleic acid).",
        "Fast jede Zelle deines Körpers enthält einen kompletten Bauplan von dir. Er ist in einem Molekül gespeichert: der **DNA** (Desoxyribonukleinsäure, englisch deoxyribonucleic acid, daher das A).",
      ),
      frames: [
        { math: tx('"cell"#c', '"Zelle"#c'), note: tx("Let's zoom into a cell, for example a skin cell.", "Wir zoomen in eine Zelle, zum Beispiel eine Hautzelle.") },
        { math: tx('"cell"#c \\to#a1 "nucleus"#n', '"Zelle"#c \\to#a1 "Zellkern"#n'), note: tx("In animal and plant cells the genetic information lies in the **nucleus**.", "Bei Tieren und Pflanzen liegt die Erbinformation im **Zellkern**.") },
        {
          math: tx('"cell"#c \\to#a1 "nucleus"#n \\to#a2 "chromosomes"#ch', '"Zelle"#c \\to#a1 "Zellkern"#n \\to#a2 "Chromosomen"#ch'),
          note: tx("It is divided among the **chromosomes**. A human body cell has 46 of them.", "Sie ist auf die **Chromosomen** verteilt. Eine Körperzelle des Menschen hat 46 davon."),
        },
        {
          math: tx('"cell"#c \\to#a1 "nucleus"#n \\to#a2 "chromosomes"#ch \\to#a3 \\hl{"DNA"#d}', '"Zelle"#c \\to#a1 "Zellkern"#n \\to#a2 "Chromosomen"#ch \\to#a3 \\hl{"DNA"#d}'),
          note: tx("Each chromosome is one very long, tightly coiled DNA thread. Unrolled, the DNA of one single cell would be about 2 metres long!", "Jedes Chromosom ist ein einziger, sehr langer, eng aufgewickelter DNA-Faden. Ausgerollt wäre die DNA einer einzigen Zelle etwa 2 Meter lang!"),
        },
      ],
    },
    {
      type: "widget",
      title: tx("A twisted rope ladder", "Eine verdrehte Strickleiter"),
      blob: tx("Give it a twist! What happens when you untwist the helix?", "Dreh mal dran! Was passiert, wenn du die Helix aufdrehst?"),
      body: tx(
        "DNA is a **double helix**: two strands wound around each other like a twisted rope ladder. The **rails** are made of sugar and phosphate in turns, the **rungs** are pairs of two **bases**. Untwist the helix into a ladder and tap a rung.",
        "Die DNA ist eine **Doppelhelix**: zwei Stränge, die wie eine verdrehte Strickleiter umeinander gewunden sind. Die **Holme** bestehen abwechselnd aus Zucker und Phosphat, die **Sprossen** sind Paare aus zwei **Basen**. Dreh die Helix zur Leiter auf und tipp auf eine Sprosse.",
      ),
      widget: DnaHelix,
    },
    {
      type: "explain",
      title: tx("Four bases, two pairs", "Vier Basen, zwei Paare"),
      blob: tx("Only four letters. But they're picky about their partners!", "Nur vier Buchstaben. Aber sie sind wählerisch bei ihren Partnern!"),
      frames: [
        { math: "\\text{A}#A \\quad \\text{T}#T \\quad \\text{G}#G \\quad \\text{C}#C", note: tx("There are only four bases: **adenine (A)**, **thymine (T)**, **guanine (G)** and **cytosine (C)**.", "Es gibt nur vier Basen: **Adenin (A)**, **Thymin (T)**, **Guanin (G)** und **Cytosin (C)**.") },
        {
          math: "\\frac{\\text{A}#A }{\\text{T}#T }#p1 \\quad \\frac{\\text{G}#G }{\\text{C}#C }#p2",
          note: tx("They fit together in only one way: **A with T** and **G with C**. This is called **complementary base pairing**.", "Sie passen nur auf eine Art zusammen: **A mit T** und **G mit C**. Das nennt man **komplementäre Basenpaarung**."),
        },
        { math: pairs("ATGCAG", "TACGTC"), note: tx("So if you know one strand, you know the other: A-T-G-C-A-G belongs to T-A-C-G-T-C.", "Kennst du einen Strang, kennst du also auch den anderen: Zu A-T-G-C-A-G gehört T-A-C-G-T-C.") },
        {
          math: pairs("ATGCAG", "TACGTC", { mark: [0, 1, 4] }),
          note: tx("Memory trick: the angular letters **A and T** belong together, the round letters **G and C** too.", "Merkhilfe: Die eckigen Buchstaben **A und T** gehören zusammen, die runden Buchstaben **G und C** auch."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Build the other strand", "Bau den Gegenstrang"),
      blob: tx("Your turn: find the partner for every base!", "Jetzt du: Finde zu jeder Base ihren Partner!"),
      body: tx("Tap the base that fits below the marked one. A wrong partner wobbles back.", "Tipp unten die Base an, die zur markierten passt. Ein falscher Partner wackelt zurück."),
      widget: DnaPairing,
    },
    {
      type: "check",
      blob: tx("Now without help. Base by base!", "Jetzt ohne Hilfe. Base für Base!"),
      exercise: complementTask("GATTCA"),
    },
    {
      type: "explain",
      title: tx("The order is the information", "Die Reihenfolge ist die Information"),
      blob: tx("Four letters can say a lot. It's all about the order.", "Mit vier Buchstaben kann man viel sagen. Es kommt auf die Reihenfolge an."),
      frames: [
        {
          math: tx('"LISTEN" \\ne "SILENT"', '"REGEN" \\ne "GERNE"'),
          note: tx("Same letters, different order, completely different meaning. It's the same with DNA: the information lies in the **order of the bases**.", "Gleiche Buchstaben, andere Reihenfolge, ganz andere Bedeutung. Genauso bei der DNA: Die Information steckt in der **Reihenfolge der Basen**."),
        },
        {
          math: `\\text{…TTC}#l \\hl{\\text{ATGCCGTAG}#g} \\text{GTA…}#r`,
          note: tx("A **gene** is a section of DNA. It contains the information for one particular **protein**.", "Ein **Gen** ist ein Abschnitt der DNA. Es enthält die Information für ein bestimmtes **Protein**."),
        },
        {
          math: tx('"gene"#g \\to "protein"#p \\to "trait"#m', '"Gen"#g \\to "Protein"#p \\to "Merkmal"#m'),
          note: tx(
            "Proteins shape your **traits**. One gene, for example, holds the plan for an enzyme that makes the pigment melanin. That's how it affects the colour of your skin, hair and eyes.",
            "Proteine prägen deine **Merkmale**. Ein Gen enthält zum Beispiel den Bauplan für ein Enzym, das den Farbstoff Melanin herstellt. So beeinflusst es die Farbe deiner Haut, Haare und Augen.",
          ),
        },
        {
          math: "4 \\cdot 4 \\cdot 4 = 64",
          note: tx(
            "With only 4 bases there are huge numbers of sequences: for 3 places already $4 · 4 · 4 = 64$, for 10 places over a million. Human DNA has about 3 billion base pairs per set of chromosomes, with roughly 20,000 genes.",
            "Mit nur 4 Basen gibt es riesig viele Reihenfolgen: für 3 Stellen schon $4 · 4 · 4 = 64$, für 10 Stellen über eine Million. Die DNA des Menschen hat etwa 3 Milliarden Basenpaare pro Chromosomensatz mit rund 20.000 Genen.",
          ),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Quick question about genes.", "Kurze Frage zu Genen."),
      exercise: {
        instruction: tx("Choose the right answer", "Wähle die richtige Antwort"),
        text: tx("What is a gene?", "Was ist ein Gen?"),
        answer: geneCheck.answer,
        hint: tx("Gene, chromosome, DNA: which one is a section of which?", "Gen, Chromosom, DNA: Was ist ein Abschnitt wovon?"),
        solution: [{ math: tx('"DNA" \\to "gene" \\to "protein"', '"DNA" \\to "Gen" \\to "Protein"'), note: tx("A gene is a **section of DNA** with the information for one protein.", "Ein Gen ist ein **Abschnitt der DNA** mit der Information für ein Protein.") }],
        mistakes: geneCheck.mistakes,
      },
    },
    {
      type: "explain",
      title: tx("How the double helix was discovered", "Wie die Doppelhelix entdeckt wurde"),
      blob: tx("A story with an X-ray photo and a Nobel Prize.", "Eine Geschichte mit Röntgenfoto und Nobelpreis."),
      frames: [
        { math: "1953", note: tx("In 1953, **James Watson** and **Francis Crick** presented their model of DNA: the double helix.", "1953 stellten **James Watson** und **Francis Crick** ihr Modell der DNA vor: die Doppelhelix.") },
        {
          math: tx('"Photo 51"', '"Foto 51"'),
          note: tx(
            "A key clue was an X-ray image from the lab of **Rosalind Franklin**. Her \"Photo 51\" showed the helix shape. Watson got to see it without Franklin knowing.",
            "Ein entscheidender Hinweis war ein Röntgenbild aus dem Labor von **Rosalind Franklin**. Ihr „Foto 51“ zeigte die Helix-Form. Watson bekam es zu sehen, ohne dass Franklin davon wusste.",
          ),
        },
        {
          math: "1962",
          note: tx(
            "In 1962 Watson, Crick and Maurice Wilkins received the Nobel Prize. Franklin had died in 1958, and the prize is never given after death.",
            "1962 erhielten Watson, Crick und Maurice Wilkins den Nobelpreis. Franklin war 1958 gestorben, und der Preis wird nicht nach dem Tod verliehen.",
          ),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Last one! Use the pairing rule to calculate.", "Die letzte! Rechne mit der Paarungsregel."),
      exercise: chargaffTask("A", 30, "G"),
    },
  ],
  summary: [
    {
      title: tx("DNA carries the genetic information", "Die DNA trägt die Erbinformation"),
      body: tx("DNA (deoxyribonucleic acid) lies in the nucleus, divided among the chromosomes.", "Die DNA (Desoxyribonukleinsäure) liegt im Zellkern, verteilt auf die Chromosomen."),
      examples: [tx('"nucleus" \\to "chromosome" \\to "DNA"', '"Zellkern" \\to "Chromosom" \\to "DNA"')],
      tone: "rule",
    },
    {
      title: tx("Double helix", "Doppelhelix"),
      body: tx("Two strands like a twisted rope ladder: rails of sugar and phosphate, rungs of base pairs.", "Zwei Stränge wie eine verdrehte Strickleiter: Holme aus Zucker und Phosphat, Sprossen aus Basenpaaren."),
      tone: "rule",
    },
    {
      title: tx("Base pairing", "Basenpaarung"),
      body: tx("Four bases: adenine, thymine, guanine, cytosine. Always **A–T** and **G–C** (complementary).", "Vier Basen: Adenin, Thymin, Guanin, Cytosin. Immer **A–T** und **G–C** (komplementär)."),
      examples: ["\\frac{\\text{A}}{\\text{T}} \\quad \\frac{\\text{G}}{\\text{C}}", pairs("ATGC", "TACG")],
      tone: "rule",
    },
    {
      title: tx("Gene", "Gen"),
      body: tx("A section of DNA with the information for one protein. The information is the order of the bases.", "Ein DNA-Abschnitt mit der Information für ein Protein. Die Information ist die Reihenfolge der Basen."),
      examples: [tx('"gene" \\to "protein" \\to "trait"', '"Gen" \\to "Protein" \\to "Merkmal"')],
      tone: "tip",
    },
    {
      title: tx("Complementary is not the same", "Komplementär heißt nicht gleich"),
      body: tx("The other strand is not a copy: ATG goes with TAC. A never pairs with G, and never with itself.", "Der Gegenstrang ist keine Kopie: Zu ATG gehört TAC. A paart nie mit G und nie mit sich selbst."),
      examples: [`${seq("ATG")} \\to ${seq("TAC")}`],
      tone: "warning",
    },
    {
      title: tx("Discovery", "Entdeckung"),
      body: tx("1953: Watson and Crick's double helix model, based on Rosalind Franklin's X-ray image.", "1953: Doppelhelix-Modell von Watson und Crick, mithilfe von Rosalind Franklins Röntgenbild."),
      tone: "tip",
    },
  ],
};
