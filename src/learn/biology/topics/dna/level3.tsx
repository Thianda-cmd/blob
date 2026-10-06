"use client";

import { resolveText, tx, type Text } from "@/i18n/text";
import { DnaFork, DnaForkFigure } from "@/learn/biology/visuals/DnaFork";
import { DnaGel } from "@/learn/biology/visuals/DnaGel";
import { DnaLacOperon } from "@/learn/biology/visuals/DnaLacOperon";
import { DnaPcr } from "@/learn/biology/visuals/DnaPcr";
import { DnaRibosome } from "@/learn/biology/visuals/DnaRibosome";
import { DnaSplicing } from "@/learn/biology/visuals/DnaSplicing";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson, Mistake } from "@/learn/types";
import { bigText, choiceOf, complement, mistakeList, numberMistakes, pairs, reversed, seqAnswer, toRna, variedDna, type Opt } from "./data";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");

// ---------------------------------------------------------------------------
// Replication

function forkTask(rng: Rng): Exercise {
  const dir = rng.pick([1, -1] as const);
  const topLeft = rng.pick(["3", "5"] as const);
  const askLagging = rng.chance(0.5);
  const topLeading = (dir === 1) === (topLeft === "3");
  const answerTop = askLagging ? !topLeading : topLeading;
  const s1 = tx("parent strand 1", "Elternstrang 1");
  const s2 = tx("parent strand 2", "Elternstrang 2");
  const why = tx(
    "DNA polymerase reads the template 3′→5′ and builds only 5′→3′. So only one new strand can grow continuously towards the fork.",
    "Die DNA-Polymerase liest die Matrize 3′→5′ und baut nur 5′→3′. Deshalb kann nur ein neuer Strang durchgehend zur Gabel hin wachsen.",
  );
  const opts: Opt[] = [
    { text: answerTop ? s1 : s2 },
    {
      text: answerTop ? s2 : s1,
      title: tx("Direction mixed up", "Richtung verwechselt"),
      say: tx(
        "Check the direction: the new strand grows 5′→3′, so its template has to run 3′→5′ **in the direction the fork moves** to give the leading strand.",
        "Prüf die Richtung: Der neue Strang wächst 5′→3′, seine Matrize muss also **in Bewegungsrichtung der Gabel** 3′→5′ verlaufen, damit der Leitstrang entsteht.",
      ),
    },
    {
      text: tx("both parent strands", "beide Elternstränge"),
      title: tx("Antiparallel strands", "Antiparallele Stränge"),
      say: tx("The two parent strands run in opposite directions. So the new strands are built differently: one continuously, one in pieces.", "Die beiden Elternstränge verlaufen gegenläufig. Deshalb entstehen die neuen Stränge unterschiedlich: einer durchgehend, einer in Stücken."),
    },
    { text: tx("neither, both are made in pieces", "keiner, beide entstehen in Stücken") },
  ];
  const ch = choiceOf(rng, opts);
  return {
    instruction: askLagging ? tx("Find the template of the lagging strand", "Finde die Matrize des Folgestrangs") : tx("Find the template of the leading strand", "Finde die Matrize des Leitstrangs"),
    text: askLagging
      ? tx("The fork moves in the direction of the arrow. At which parent strand is the new strand made discontinuously, as Okazaki fragments?", "Die Gabel wandert in Pfeilrichtung. An welchem Elternstrang wird der neue Strang diskontinuierlich, in Okazaki-Fragmenten, gebildet?")
      : tx("The fork moves in the direction of the arrow. At which parent strand is the new strand made continuously (leading strand)?", "Die Gabel wandert in Pfeilrichtung. An welchem Elternstrang wird der neue Strang kontinuierlich gebildet (Leitstrang)?"),
    visual: { component: DnaForkFigure as never, props: { dir, topLeft } },
    answer: ch.answer,
    hint: tx("Follow each parent strand in the direction the fork moves: does it run 3′→5′ or 5′→3′?", "Folge jedem Elternstrang in Bewegungsrichtung der Gabel: Verläuft er 3′→5′ oder 5′→3′?"),
    solution: [
      {
        math: tx(`"strand ${topLeading ? 1 : 2}:" \\; "3′ → 5′ along the fork" \\Rightarrow "leading strand"`, `"Strang ${topLeading ? 1 : 2}:" \\; "3′ → 5′ in Gabelrichtung" \\Rightarrow "Leitstrang"`),
        note: tx(`${en(why)} Leading strand at strand ${topLeading ? 1 : 2}, lagging strand at strand ${topLeading ? 2 : 1}.`, `${de(why)} Leitstrang an Strang ${topLeading ? 1 : 2}, Folgestrang an Strang ${topLeading ? 2 : 1}.`),
      },
    ],
    mistakes: ch.mistakes,
  };
}

const LAGGING: Text[] = [
  tx("Helicase separates the strands", "Helikase trennt die Stränge"),
  tx("Primase lays an RNA primer", "Primase setzt einen RNA-Primer"),
  tx("DNA polymerase III builds an Okazaki fragment", "DNA-Polymerase III baut ein Okazaki-Fragment"),
  tx("DNA polymerase I replaces the primer with DNA", "DNA-Polymerase I ersetzt den Primer durch DNA"),
  tx("Ligase joins the fragments", "Ligase verknüpft die Fragmente"),
];

export function replicationOrderTask(n: number, start: number): Exercise {
  const items = LAGGING.slice(start, start + n);
  const has = (i: number) => i >= start && i < start + n;
  const mistakes: Mistake[] = [];
  if (has(1) && has(2)) mistakes.push({ when: { kind: "order", items: [LAGGING[2], LAGGING[1]] }, title: tx("No start without primer", "Kein Start ohne Primer"), say: tx("DNA polymerase can't start on its own: it needs a free 3′-OH end. The primer has to come first.", "Die DNA-Polymerase kann nicht von allein anfangen: Sie braucht ein freies 3′-OH-Ende. Der Primer muss zuerst da sein.") });
  if (has(3) && has(4)) mistakes.push({ when: { kind: "order", items: [LAGGING[4], LAGGING[3]] }, title: tx("Ligase comes last", "Die Ligase kommt zuletzt"), say: tx("Ligase can only close the gap once the RNA primer has been replaced by DNA.", "Die Ligase kann die Lücke erst schließen, wenn der RNA-Primer durch DNA ersetzt ist.") });
  if (has(2) && has(3)) mistakes.push({ when: { kind: "order", items: [LAGGING[3], LAGGING[2]] }, title: tx("Primer first, then removed", "Erst Primer, dann weg"), say: tx("Polymerase I removes the primer that sits in front of the next fragment. So the fragment has to be built first.", "Die Polymerase I entfernt den Primer, auf den das nächste Fragment trifft. Das Fragment muss also zuerst gebaut sein.") });
  return {
    instruction: tx("Order the steps on the lagging strand", "Ordne die Schritte am Folgestrang"),
    answer: { kind: "order", items },
    hint: tx("What does polymerase need before it can start? What is the very last thing?", "Was braucht die Polymerase, bevor sie starten kann? Was passiert ganz zum Schluss?"),
    solution: [
      {
        math: tx('"helicase" \\to "primase" \\to "pol III" \\to "pol I" \\to "ligase"', '"Helikase" \\to "Primase" \\to "Pol III" \\to "Pol I" \\to "Ligase"'),
        note: tx("Open, prime, extend, replace the primer, seal the gap.", "Öffnen, Primer setzen, verlängern, Primer ersetzen, Lücke schließen."),
      },
    ],
    mistakes,
  };
}

const ENZYMES: { id: string; pair: [Text, Text] }[] = [
  { id: "helicase", pair: [tx("helicase", "Helikase"), tx("breaks the hydrogen bonds and opens the helix", "löst die Wasserstoffbrücken und öffnet die Helix")] },
  { id: "topo", pair: [tx("topoisomerase", "Topoisomerase"), tx("relieves the twisting ahead of the fork", "entspannt die Verdrillung vor der Gabel")] },
  { id: "primase", pair: [tx("primase", "Primase"), tx("makes short RNA primers", "bildet kurze RNA-Primer")] },
  { id: "pol3", pair: [tx("DNA polymerase III", "DNA-Polymerase III"), tx("extends the new strand 5′→3′ and proofreads", "verlängert den neuen Strang 5′→3′ und liest Korrektur")] },
  { id: "pol1", pair: [tx("DNA polymerase I", "DNA-Polymerase I"), tx("replaces RNA primers with DNA", "ersetzt RNA-Primer durch DNA")] },
  { id: "ligase", pair: [tx("DNA ligase", "DNA-Ligase"), tx("joins DNA pieces in the backbone", "verknüpft DNA-Stücke im Rückgrat")] },
  { id: "restr", pair: [tx("restriction enzyme", "Restriktionsenzym"), tx("cuts DNA at a specific sequence", "schneidet DNA an einer bestimmten Sequenz")] },
  { id: "taq", pair: [tx("Taq polymerase", "Taq-Polymerase"), tx("heat-stable polymerase used in PCR", "hitzestabile Polymerase für die PCR")] },
  { id: "rnapol", pair: [tx("RNA polymerase", "RNA-Polymerase"), tx("builds RNA along the template strand", "baut RNA am codogenen Strang")] },
];
const ENZ_SWAPS: [string, string, Text, Text][] = [
  ["pol1", "pol3", tx("Pol I or pol III?", "Pol I oder Pol III?"), tx("Polymerase III does the main work of extending. Polymerase I is the repair crew that swaps primers for DNA.", "Die Polymerase III erledigt die Hauptarbeit beim Verlängern. Die Polymerase I ist der Reparaturtrupp, der Primer gegen DNA tauscht.")],
  ["pol3", "pol1", tx("Pol I or pol III?", "Pol I oder Pol III?"), tx("Swapped: polymerase III extends the strand, polymerase I replaces the primers.", "Vertauscht: Die Polymerase III verlängert den Strang, die Polymerase I ersetzt die Primer.")],
  ["primase", "pol1", tx("Making or removing?", "Bilden oder entfernen?"), tx("Primase **makes** the RNA primers. Removing them is the job of polymerase I.", "Die Primase **bildet** die RNA-Primer. Entfernt werden sie von der Polymerase I.")],
  ["ligase", "restr", tx("Joining or cutting?", "Verknüpfen oder schneiden?"), tx("Ligase **joins** DNA pieces. Cutting at a specific sequence is what restriction enzymes do.", "Die Ligase **verknüpft** DNA-Stücke. An einer bestimmten Sequenz schneiden die Restriktionsenzyme.")],
  ["restr", "ligase", tx("Joining or cutting?", "Verknüpfen oder schneiden?"), tx("Restriction enzymes **cut**. Joining is the job of ligase.", "Restriktionsenzyme **schneiden**. Verknüpfen ist die Aufgabe der Ligase.")],
  ["helicase", "topo", tx("Opening or relaxing?", "Öffnen oder entspannen?"), tx("Helicase opens the strands. The twisting that builds up ahead is relieved by topoisomerase.", "Die Helikase öffnet die Stränge. Die Verdrillung, die sich davor aufstaut, entspannt die Topoisomerase.")],
];

function enzymeMatchTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(ENZYMES).slice(0, 4);
  const distractor = rng.pick(ENZYMES.filter((x) => !chosen.includes(x)));
  const left = new Set(chosen.map((c) => c.id));
  const right = new Set([...left, distractor.id]);
  const def = (id: string) => ENZYMES.find((x) => x.id === id)!.pair;
  const mistakes: Mistake[] = ENZ_SWAPS.filter(([a, b]) => left.has(a) && right.has(b)).map(([a, b, title, say]) => ({ when: { kind: "match", pairs: [[def(a)[0], def(b)[1]]] }, title, say }));
  return {
    instruction: tx("Match each enzyme to its job", "Ordne jedem Enzym seine Aufgabe zu"),
    answer: { kind: "match", pairs: chosen.map((c) => c.pair), distractors: [distractor.pair[1]] },
    hint: tx("Think of the order at the replication fork, and of the tools of gene technology.", "Denk an die Reihenfolge an der Replikationsgabel und an die Werkzeuge der Gentechnik."),
    solution: [{ math: tx('"enzyme" \\to "job"', '"Enzym" \\to "Aufgabe"'), note: tx(chosen.map((c) => `**${en(c.pair[0])}**: ${en(c.pair[1])}.`).join(" "), chosen.map((c) => `**${de(c.pair[0])}**: ${de(c.pair[1])}.`).join(" ")) }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Transcription, processing, translation

/** Which strand is the template? RNA polymerase reads 3′→5′ in the direction of transcription. */
function templateStrandTask(rng: Rng): Exercise {
  const top = variedDna(rng, 6, 4);
  const bottom = complement(top);
  const topLeft = rng.pick(["3", "5"] as const);
  const right = rng.chance(0.5);
  const topIsTemplate = right === (topLeft === "3");
  const ends: [string, string, string, string] = topLeft === "5" ? ["5′", "3′", "3′", "5′"] : ["3′", "5′", "5′", "3′"];
  const coding = topIsTemplate ? bottom : top;
  const codingLeft5 = topIsTemplate ? topLeft === "3" : topLeft === "5";
  const coding53 = codingLeft5 ? coding : reversed(coding);
  const templ53 = topIsTemplate ? (topLeft === "5" ? top : reversed(top)) : topLeft === "5" ? reversed(bottom) : bottom;
  const mrna = toRna(coding53);
  const arrow = right ? tx("from left to right (→)", "von links nach rechts (→)") : tx("from right to left (←)", "von rechts nach links (←)");
  if (rng.chance(0.5)) {
    const opts: Opt[] = [
      { text: topIsTemplate ? tx("the top strand", "der obere Strang") : tx("the bottom strand", "der untere Strang") },
      {
        text: topIsTemplate ? tx("the bottom strand", "der untere Strang") : tx("the top strand", "der obere Strang"),
        title: tx("Reading direction", "Leserichtung"),
        say: tx("RNA polymerase reads the template **3′→5′** (and builds the mRNA 5′→3′). Which strand runs 3′→5′ in the direction of transcription?", "Die RNA-Polymerase liest die Matrize **3′→5′** (und baut die mRNA 5′→3′). Welcher Strang verläuft in Transkriptionsrichtung 3′→5′?"),
      },
      { text: tx("both strands, one after the other", "beide Stränge nacheinander"), title: tx("Only one strand", "Nur ein Strang"), say: tx("For a given gene only one strand is transcribed: the template (codogenic) strand.", "Für ein Gen wird nur ein Strang abgelesen: der codogene Strang.") },
    ];
    const ch = choiceOf(rng, opts);
    return {
      instruction: tx("Find the template strand", "Bestimme den codogenen Strang"),
      text: tx(`Transcription of this gene runs ${en(arrow)}. Which strand is the template (codogenic) strand?`, `Die Transkription dieses Gens verläuft ${de(arrow)}. Welcher Strang ist der codogene Strang?`),
      math: pairs(top, bottom, { ends }),
      answer: ch.answer,
      hint: tx("The template is read 3′→5′.", "Die Matrize wird 3′→5′ gelesen."),
      solution: [{ math: pairs(top, bottom, { ends }), note: tx(`In the direction of transcription the ${topIsTemplate ? "top" : "bottom"} strand runs 3′→5′: it is the template strand.`, `In Transkriptionsrichtung verläuft der ${topIsTemplate ? "obere" : "untere"} Strang 3′→5′: Er ist der codogene Strang.`) }],
      mistakes: ch.mistakes,
    };
  }
  const m = mistakeList();
  m.add(mrna, toRna(templ53), tx("Wrong strand", "Falscher Strang"), tx("You transcribed the other strand. Find the strand that runs 3′→5′ in the direction of transcription: that one is read.", "Du hast den anderen Strang abgeschrieben. Such den Strang, der in Transkriptionsrichtung 3′→5′ verläuft: Der wird gelesen."));
  m.add(mrna, coding53, tx("T in the mRNA", "T in der mRNA"), tx("Right strand, right direction, but mRNA contains **U** instead of T.", "Richtiger Strang, richtige Richtung, aber die mRNA enthält **U** statt T."));
  m.add(mrna, reversed(mrna), tx("Written 3′→5′", "3′→5′ geschrieben"), tx("The bases are right, but write the mRNA from its 5′ end, i.e. in the direction of transcription.", "Die Basen stimmen, aber schreib die mRNA vom 5′-Ende her, also in Transkriptionsrichtung."));
  return {
    instruction: tx("Transcribe in the right direction", "Transkribiere in der richtigen Richtung"),
    text: tx(`Transcription runs ${en(arrow)}. Write the mRNA of this section, 5′→3′.`, `Die Transkription verläuft ${de(arrow)}. Schreib die mRNA dieses Abschnitts auf, 5′→3′.`),
    math: pairs(top, bottom, { ends }),
    answer: seqAnswer(mrna, tx("mRNA 5′→3′:", "mRNA 5′→3′:")),
    hint: tx("Template = the strand that runs 3′→5′ in the direction of transcription. mRNA = the other strand, 5′→3′, with U.", "Matrize = der Strang, der in Transkriptionsrichtung 3′→5′ verläuft. mRNA = der andere Strang, 5′→3′, mit U."),
    solution: [
      { math: pairs(top, bottom, { ends }), note: tx(`The ${topIsTemplate ? "top" : "bottom"} strand is the template. The other one is the coding strand.`, `Der ${topIsTemplate ? "obere" : "untere"} Strang ist die Matrize. Der andere ist der codierende Strang.`) },
      { math: `\\text{5′-${mrna}-3′}`, note: tx(`Coding strand read 5′→3′, with U: **${mrna}**.`, `Codierender Strang 5′→3′ gelesen, mit U: **${mrna}**.`) },
    ],
    mistakes: m.list,
  };
}

function splicingTask(rng: Rng): Exercise {
  const k = rng.int(3, 4);
  const exons = Array.from({ length: k }, () => 3 * rng.int(20, 70));
  const introns = Array.from({ length: k - 1 }, () => rng.int(8, 60) * 10);
  const sumE = exons.reduce((a, b) => a + b, 0);
  const sumI = introns.reduce((a, b) => a + b, 0);
  const variant = rng.int(0, 2);
  const list = exons.flatMap((e, i) => (i < k - 1 ? [`E${i + 1}: ${e}`, `I${i + 1}: ${introns[i]}`] : [`E${i + 1}: ${e}`])).join(", ");
  const base = tx(
    `A gene's pre-mRNA consists of exons (E) and introns (I) with these lengths in nucleotides: ${list}. The exons contain only the coding sequence, from the start codon up to and including the stop codon.`,
    `Die prä-mRNA eines Gens besteht aus Exons (E) und Introns (I) mit diesen Längen in Nukleotiden: ${list}. Die Exons enthalten nur die codierende Sequenz, vom Startcodon bis einschließlich Stoppcodon.`,
  );
  if (variant === 0) {
    const value = sumE / 3 - 1;
    const m = numberMistakes(value);
    m.add(sumE / 3, tx("Stop codon counted", "Stoppcodon mitgezählt"), tx("The last codon is the stop codon: it codes for no amino acid.", "Das letzte Codon ist das Stoppcodon: Es codiert keine Aminosäure."));
    m.add((sumE + sumI) / 3 - 1, tx("Introns included", "Introns mitgerechnet"), tx("The introns are spliced out before translation. Only the exons are translated.", "Die Introns werden vor der Translation herausgespleißt. Übersetzt werden nur die Exons."));
    m.add(sumE, tx("Nucleotides, not amino acids", "Nukleotide statt Aminosäuren"), tx("That's the number of nucleotides. Three nucleotides make one codon.", "Das ist die Zahl der Nukleotide. Drei Nukleotide bilden ein Codon."));
    return {
      instruction: tx("Calculate the length of the protein", "Berechne die Länge des Proteins"),
      text: tx(`${en(base)} How many amino acids does the protein have?`, `${de(base)} Aus wie vielen Aminosäuren besteht das Protein?`),
      answer: { kind: "number", value },
      hint: tx("Only exons stay. Three nucleotides per codon; the stop codon has no amino acid.", "Nur die Exons bleiben. Drei Nukleotide pro Codon; das Stoppcodon hat keine Aminosäure."),
      solution: [
        { math: `${exons.join(" + ")} = ${sumE}`, note: tx("Splicing removes the introns: the mature mRNA has only the exons.", "Beim Spleißen fallen die Introns heraus: Die reife mRNA enthält nur die Exons.") },
        { math: `${sumE} : 3 - 1 = ${value}`, note: tx(`${sumE / 3} codons, minus the stop codon: **${value} amino acids**.`, `${sumE / 3} Codons, minus Stoppcodon: **${value} Aminosäuren**.`) },
      ],
      mistakes: m.list,
    };
  }
  if (variant === 1) {
    const m = numberMistakes(sumE);
    m.add(sumI, tx("Introns kept", "Introns behalten"), tx("Swapped: the introns are cut out, the exons stay.", "Vertauscht: Die Introns werden herausgeschnitten, die Exons bleiben."));
    m.add(sumE + sumI, tx("Nothing removed", "Nichts entfernt"), tx("That's the pre-mRNA. Splicing removes the introns.", "Das ist die prä-mRNA. Beim Spleißen werden die Introns entfernt."));
    return {
      instruction: tx("Calculate the mature mRNA", "Berechne die reife mRNA"),
      text: tx(`${en(base)} How many nucleotides of this sequence are left in the mature mRNA (without cap and poly-A tail)?`, `${de(base)} Wie viele Nukleotide dieser Sequenz bleiben in der reifen mRNA übrig (ohne Cap und Poly-A-Schwanz)?`),
      answer: { kind: "number", value: sumE },
      hint: tx("Exons are expressed, introns are cut out.", "Exons werden exprimiert, Introns herausgeschnitten."),
      solution: [{ math: `${exons.join(" + ")} = ${sumE}`, note: tx(`Only the exons: **${sumE} nucleotides**.`, `Nur die Exons: **${sumE} Nukleotide**.`) }],
      mistakes: m.list,
    };
  }
  const skip = rng.int(2, k - 1);
  const value = (sumE - exons[skip - 1]) / 3 - 1;
  const m = numberMistakes(value);
  m.add(sumE / 3 - 1, tx("Exon still in", "Exon noch drin"), tx(`In this splice variant exon ${skip} is left out. Take its nucleotides away too.`, `In dieser Spleißvariante fehlt Exon ${skip}. Zieh auch seine Nukleotide ab.`));
  m.add((sumE - exons[skip - 1]) / 3, tx("Stop codon counted", "Stoppcodon mitgezählt"), tx("The stop codon (in the last exon) codes for no amino acid.", "Das Stoppcodon (im letzten Exon) codiert keine Aminosäure."));
  return {
    instruction: tx("Calculate an alternative splice variant", "Berechne eine alternative Spleißvariante"),
    text: tx(`${en(base)} In one tissue, exon ${skip} is also spliced out (alternative splicing). How many amino acids does this protein variant have?`, `${de(base)} In einem Gewebe wird zusätzlich Exon ${skip} herausgespleißt (alternatives Spleißen). Aus wie vielen Aminosäuren besteht diese Proteinvariante?`),
    answer: { kind: "number", value },
    hint: tx("Add the remaining exons, divide by 3 and subtract the stop codon.", "Addiere die übrigen Exons, teile durch 3 und zieh das Stoppcodon ab."),
    solution: [
      { math: `${exons.filter((_, i) => i !== skip - 1).join(" + ")} = ${sumE - exons[skip - 1]}`, note: tx(`All exons except exon ${skip}.`, `Alle Exons außer Exon ${skip}.`) },
      { math: `${sumE - exons[skip - 1]} : 3 - 1 = ${value}`, note: tx(`**${value} amino acids**. All exons are multiples of 3, so the reading frame stays.`, `**${value} Aminosäuren**. Alle Exons sind Vielfache von 3, das Leseraster bleibt erhalten.`) },
    ],
    mistakes: m.list,
  };
}

/** Length of the coding sequence (start to stop) for a protein of n amino acids. */
export function codingLengthTask(n: number): Exercise {
  const value = 3 * (n + 1);
  const m = numberMistakes(value);
  m.add(3 * n, tx("Stop codon missing", "Stoppcodon fehlt"), tx("The mRNA also needs a stop codon at the end: one more triplet.", "Die mRNA braucht am Ende noch ein Stoppcodon: ein Triplett mehr."));
  m.add(n, tx("One base per amino acid?", "Eine Base pro Aminosäure?"), tx("One amino acid needs a whole codon: three nucleotides.", "Eine Aminosäure braucht ein ganzes Codon: drei Nukleotide."));
  m.add(6 * (n + 1), tx("Two strands counted", "Zwei Stränge gezählt"), tx("The mRNA is single-stranded. Count only one strand.", "Die mRNA ist einzelsträngig. Zähl nur einen Strang."));
  return {
    instruction: tx("Calculate the coding sequence", "Berechne die codierende Sequenz"),
    text: tx(
      `A protein consists of ${n} amino acids. How many nucleotides does the coding part of its mature mRNA have at least (from the start codon up to and including the stop codon)?`,
      `Ein Protein besteht aus ${n} Aminosäuren. Wie viele Nukleotide umfasst der codierende Teil seiner reifen mRNA mindestens (vom Startcodon bis einschließlich Stoppcodon)?`,
    ),
    answer: { kind: "number", value },
    hint: tx("One codon per amino acid, plus the stop codon.", "Ein Codon pro Aminosäure, dazu das Stoppcodon."),
    solution: [{ math: `(${n} + 1) \\cdot 3 = ${value}`, note: tx(`${n} codons for the amino acids, one stop codon, three nucleotides each: **${value}**.`, `${n} Codons für die Aminosäuren, ein Stoppcodon, je drei Nukleotide: **${value}**.`) }],
    mistakes: m.list,
  };
}

type Fact = { q: Text; opts: Opt[]; hint: Text; why: Text; key: Text };
const RIBO: Fact[] = [
  {
    q: tx("Where does a new aminoacyl-tRNA bind at the ribosome during elongation?", "Wo bindet während der Elongation eine neue Aminoacyl-tRNA am Ribosom?"),
    opts: [
      { text: tx("at the A site", "an der A-Stelle") },
      { text: tx("at the P site", "an der P-Stelle"), title: tx("P holds the chain", "P hält die Kette"), say: tx("The P site holds the tRNA with the growing chain (P for peptidyl). New tRNAs arrive at the A site (aminoacyl).", "An der P-Stelle sitzt die tRNA mit der wachsenden Kette (P wie Peptidyl). Neue tRNAs kommen an die A-Stelle (Aminoacyl).") },
      { text: tx("at the E site", "an der E-Stelle"), title: tx("E is the exit", "E ist der Ausgang"), say: tx("E stands for exit: empty tRNAs leave from there.", "E steht für Exit: Dort verlassen leere tRNAs das Ribosom.") },
      { text: tx("directly at the start codon of the small subunit only", "nur direkt am Startcodon der kleinen Untereinheit") },
    ],
    hint: tx("A for aminoacyl, P for peptidyl, E for exit.", "A wie Aminoacyl, P wie Peptidyl, E wie Exit."),
    why: tx("New aminoacyl-tRNAs bind at the **A site**.", "Neue Aminoacyl-tRNAs binden an der **A-Stelle**."),
    key: tx('"E" \\quad "P" \\quad \\hl{"A"}', '"E" \\quad "P" \\quad \\hl{"A"}'),
  },
  {
    q: tx("In which site does the initiator tRNA with methionine sit at the start of translation?", "An welcher Stelle sitzt die Start-tRNA mit Methionin zu Beginn der Translation?"),
    opts: [
      { text: tx("in the P site", "an der P-Stelle") },
      { text: tx("in the A site", "an der A-Stelle"), title: tx("The exception", "Die Ausnahme"), say: tx("The initiator tRNA is the exception: it goes straight into the P site. All later tRNAs arrive at the A site.", "Die Start-tRNA ist die Ausnahme: Sie kommt direkt an die P-Stelle. Alle späteren tRNAs kommen an die A-Stelle.") },
      { text: tx("in the E site", "an der E-Stelle") },
      { text: tx("outside the ribosome", "außerhalb des Ribosoms") },
    ],
    hint: tx("The A site has to stay free for the second tRNA.", "Die A-Stelle muss frei bleiben für die zweite tRNA."),
    why: tx("At initiation the Met-tRNA sits in the **P site**, the A site is free for the next tRNA.", "Bei der Initiation sitzt die Met-tRNA an der **P-Stelle**, die A-Stelle ist frei für die nächste tRNA."),
    key: tx('"E" \\quad \\hl{"P"} \\quad "A"', '"E" \\quad \\hl{"P"} \\quad "A"'),
  },
  {
    q: tx("What ends translation?", "Was beendet die Translation?"),
    opts: [
      { text: tx("a stop codon in the A site, recognised by a release factor", "ein Stoppcodon an der A-Stelle, das ein Freisetzungsfaktor erkennt") },
      { text: tx("a tRNA with the anticodon for the stop codon", "eine tRNA mit dem Anticodon zum Stoppcodon"), title: tx("No tRNA fits", "Keine tRNA passt"), say: tx("There is no tRNA for stop codons. A protein, the release factor, binds instead.", "Für Stoppcodons gibt es keine tRNA. Stattdessen bindet ein Protein, der Freisetzungsfaktor.") },
      { text: tx("the end of the mRNA", "das Ende der mRNA") },
      { text: tx("the poly-A tail entering the ribosome", "der Poly-A-Schwanz, der ins Ribosom gelangt") },
    ],
    hint: tx("UAA, UAG, UGA.", "UAA, UAG, UGA."),
    why: tx("A **stop codon** in the A site binds a release factor; the chain is released and the ribosome falls apart.", "Ein **Stoppcodon** an der A-Stelle bindet einen Freisetzungsfaktor; die Kette wird frei, und das Ribosom zerfällt."),
    key: tx('"UAA, UAG, UGA" \\to "release factor"', '"UAA, UAG, UGA" \\to "Freisetzungsfaktor"'),
  },
  {
    q: tx("What happens during translocation?", "Was passiert bei der Translokation?"),
    opts: [
      { text: tx("the ribosome moves one codon towards the 3′ end", "das Ribosom rückt ein Codon in Richtung 3′-Ende") },
      { text: tx("the ribosome moves one codon towards the 5′ end", "das Ribosom rückt ein Codon in Richtung 5′-Ende"), title: tx("Direction", "Richtung"), say: tx("The mRNA is read 5′→3′, so the ribosome moves towards the 3′ end.", "Die mRNA wird 5′→3′ gelesen, das Ribosom wandert also zum 3′-Ende.") },
      { text: tx("the peptide bond is formed", "die Peptidbindung wird geknüpft"), title: tx("One step earlier", "Ein Schritt früher"), say: tx("The peptide bond is formed before: then the ribosome moves on (translocation).", "Die Peptidbindung entsteht vorher: Danach rückt das Ribosom weiter (Translokation).") },
      { text: tx("the mRNA is spliced", "die mRNA wird gespleißt") },
    ],
    hint: tx("Elongation: binding, peptide bond, translocation.", "Elongation: Bindung, Peptidbindung, Translokation."),
    why: tx("Translocation: the ribosome moves **one codon towards 3′**; P → E, A → P.", "Translokation: Das Ribosom rückt **ein Codon Richtung 3′**; P → E, A → P."),
    key: tx('"A" \\to "P" \\to "E"', '"A" \\to "P" \\to "E"'),
  },
  {
    q: tx("What do transcription factors do in eukaryotes?", "Was machen Transkriptionsfaktoren bei Eukaryoten?"),
    opts: [
      { text: tx("they bind at the promoter (e.g. the TATA box) and allow RNA polymerase II to bind", "sie binden am Promotor (z. B. an der TATA-Box) und ermöglichen das Binden der RNA-Polymerase II") },
      { text: tx("they cut out the introns", "sie schneiden die Introns heraus"), title: tx("That's the spliceosome", "Das ist das Spleißosom"), say: tx("Introns are removed by the spliceosome. Transcription factors act at the promoter, before transcription starts.", "Introns entfernt das Spleißosom. Transkriptionsfaktoren wirken am Promotor, bevor die Transkription startet.") },
      { text: tx("they bring amino acids to the ribosome", "sie bringen Aminosäuren zum Ribosom"), title: tx("That's tRNA", "Das ist die tRNA"), say: tx("Amino acids are brought by tRNAs. Transcription factors act on the DNA.", "Aminosäuren bringen die tRNAs. Transkriptionsfaktoren wirken an der DNA.") },
      { text: tx("they add the poly-A tail", "sie hängen den Poly-A-Schwanz an") },
    ],
    hint: tx("Before RNA polymerase II can start …", "Bevor die RNA-Polymerase II starten kann …"),
    why: tx("**Transcription factors** bind at the promoter (TATA box); only then can RNA polymerase II bind and start.", "**Transkriptionsfaktoren** binden am Promotor (TATA-Box); erst dann kann die RNA-Polymerase II binden und starten."),
    key: tx('"TATA box" \\to "RNA pol II"', '"TATA-Box" \\to "RNA-Pol II"'),
  },
  {
    q: tx("How does CRISPR/Cas9 find the place in the genome where it cuts?", "Wie findet CRISPR/Cas9 die Stelle im Genom, an der es schneidet?"),
    opts: [
      { text: tx("a guide RNA pairs with the matching DNA sequence", "eine Leit-RNA (guide RNA) paart mit der passenden DNA-Sequenz") },
      { text: tx("Cas9 recognises a palindrome like a restriction enzyme", "Cas9 erkennt ein Palindrom wie ein Restriktionsenzym"), title: tx("Programmable", "Programmierbar"), say: tx("Restriction enzymes recognise fixed short sites. Cas9 is led by a guide RNA, so it can be programmed for almost any sequence.", "Restriktionsenzyme erkennen feste, kurze Stellen. Cas9 wird von einer Leit-RNA geführt und lässt sich so auf fast jede Sequenz programmieren.") },
      { text: tx("it cuts at random places", "es schneidet an zufälligen Stellen") },
      { text: tx("it binds the TATA box", "es bindet an die TATA-Box") },
    ],
    hint: tx("Base pairing again!", "Wieder Basenpaarung!"),
    why: tx("A **guide RNA** pairs with the target DNA and leads Cas9 there; Cas9 cuts both strands.", "Eine **Leit-RNA** paart mit der Ziel-DNA und führt Cas9 dorthin; Cas9 schneidet beide Stränge."),
    key: tx('"guide RNA" + "Cas9"', '"Leit-RNA" + "Cas9"'),
  },
];

function riboFactTask(rng: Rng): Exercise {
  const f = rng.pick(RIBO);
  const ch = choiceOf(rng, f.opts);
  return { instruction: tx("Choose the right answer", "Wähle die richtige Antwort"), text: f.q, answer: ch.answer, hint: f.hint, solution: [{ math: f.key, note: f.why }], mistakes: ch.mistakes };
}

function peptideBondTask(rng: Rng): Exercise {
  const n = rng.int(40, 400);
  const m = numberMistakes(n - 1);
  m.add(n, tx("One too many", "Eine zu viel"), tx("Between n amino acids there are only n − 1 links, like the gaps between fence posts.", "Zwischen n Aminosäuren gibt es nur n − 1 Verbindungen, wie die Lücken zwischen Zaunpfählen."), true);
  m.add(n + 1, tx("Stop codon counted", "Stoppcodon mitgezählt"), tx("The stop codon brings no amino acid, so no bond either.", "Das Stoppcodon bringt keine Aminosäure, also auch keine Bindung."));
  return {
    instruction: tx("Count the peptide bonds", "Zähle die Peptidbindungen"),
    text: tx(`A ribosome builds a protein of ${n} amino acids. How many peptide bonds does it form?`, `Ein Ribosom baut ein Protein aus ${n} Aminosäuren. Wie viele Peptidbindungen knüpft es?`),
    answer: { kind: "number", value: n - 1 },
    hint: tx("Each peptide bond links two neighbouring amino acids.", "Jede Peptidbindung verknüpft zwei benachbarte Aminosäuren."),
    solution: [{ math: `${n} - 1 = ${n - 1}`, note: tx(`A chain of ${n} links has **${n - 1}** bonds between them.`, `Eine Kette aus ${n} Gliedern hat **${n - 1}** Verbindungen dazwischen.`) }],
    mistakes: m.list,
  };
}

function processingMultiTask(rng: Rng): Exercise {
  const ALL: { text: Text; ok: boolean }[] = [
    { text: tx("a 5′ cap is added", "ein 5′-Cap wird angehängt"), ok: true },
    { text: tx("a poly-A tail is added at the 3′ end", "am 3′-Ende wird ein Poly-A-Schwanz angehängt"), ok: true },
    { text: tx("introns are cut out", "Introns werden herausgeschnitten"), ok: true },
    { text: tx("exons are joined", "Exons werden verknüpft"), ok: true },
    { text: tx("exons are cut out and introns joined", "Exons werden herausgeschnitten und Introns verknüpft"), ok: false },
    { text: tx("thymine is replaced by uracil", "Thymin wird durch Uracil ersetzt"), ok: false },
    { text: tx("it takes place at the ribosomes in the cytoplasm", "sie findet an den Ribosomen im Zellplasma statt"), ok: false },
    { text: tx("it happens the same way in bacteria", "sie läuft bei Bakterien genauso ab"), ok: false },
  ];
  const opts = [...rng.shuffle(ALL.filter((x) => x.ok)).slice(0, rng.int(2, 3)), ...rng.shuffle(ALL.filter((x) => !x.ok)).slice(0, 2)];
  const shown = rng.shuffle(opts);
  const correct = shown.flatMap((x, i) => (x.ok ? [i] : []));
  const mistakes: Mistake[] = [];
  const swap = shown.findIndex((x) => x.text === ALL[4].text);
  if (swap >= 0) mistakes.push({ when: { kind: "multi", options: shown.map((x) => x.text), correct: [...correct, swap].sort((a, b) => a - b) }, title: tx("Exons stay", "Exons bleiben"), say: tx("**Ex**ons are **ex**pressed and stay; **in**trons are **in** between and get cut out.", "**Ex**ons werden **ex**primiert und bleiben; **In**trons liegen da**zwischen** und fliegen raus.") });
  const tu = shown.findIndex((x) => x.text === ALL[5].text);
  if (tu >= 0) mistakes.push({ when: { kind: "multi", options: shown.map((x) => x.text), correct: [...correct, tu].sort((a, b) => a - b) }, title: tx("U from the start", "U von Anfang an"), say: tx("RNA polymerase builds the RNA with U right away. No T has to be replaced afterwards.", "Die RNA-Polymerase baut die RNA gleich mit U. Es muss nachträglich kein T ersetzt werden.") });
  return {
    instruction: tx("Select all that apply", "Wähle alle zutreffenden aus"),
    text: tx("Which statements are true for the processing of the pre-mRNA in eukaryotes?", "Welche Aussagen treffen auf die Prozessierung der prä-mRNA bei Eukaryoten zu?"),
    answer: { kind: "multi", options: shown.map((x) => x.text), correct },
    hint: tx("Cap, tail and splicing, all in the nucleus.", "Cap, Schwanz und Spleißen, alles im Zellkern."),
    solution: [{ math: tx('"cap" + "splicing" + "poly-A"', '"Cap" + "Spleißen" + "Poly-A"'), note: tx("In the nucleus: 5′ cap, poly-A tail, introns out and exons joined. Bacteria have no nucleus and (almost) no introns.", "Im Zellkern: 5′-Cap, Poly-A-Schwanz, Introns raus und Exons verknüpft. Bakterien haben keinen Zellkern und (fast) keine Introns.") }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Gene regulation

type Pick = "normal" | "inverse" | "always" | "never";
type Scenario = { op: "lac" | "trp"; text: Text; result: Pick; why: Text; traps?: Partial<Record<Pick, Text>> };

const SCENARIOS: Scenario[] = [
  {
    op: "lac",
    text: tx("wild type (no mutation)", "Wildtyp (keine Mutation)"),
    result: "normal",
    why: tx("Without lactose the repressor blocks the operator; lactose (allolactose) inactivates it: substrate induction.", "Ohne Lactose blockiert der Repressor den Operator; Lactose (Allolactose) inaktiviert ihn: Substratinduktion."),
    traps: {
      inverse: tx("That's the trp logic. In the lac operon the substrate lactose switches the genes **on**.", "Das ist die trp-Logik. Beim lac-Operon schaltet das Substrat Lactose die Gene **an**."),
      always: tx("Without lactose the repressor sits on the operator and blocks RNA polymerase.", "Ohne Lactose sitzt der Repressor auf dem Operator und blockiert die RNA-Polymerase."),
    },
  },
  {
    op: "lac",
    text: tx("operator mutation: the repressor can no longer bind to the operator", "Operatormutation: Der Repressor kann nicht mehr an den Operator binden"),
    result: "always",
    why: tx("Nothing can block the operator any more: the genes are transcribed all the time (constitutively).", "Nichts kann den Operator mehr blockieren: Die Gene werden ständig abgelesen (konstitutiv)."),
    traps: { normal: tx("Lactose is only needed to remove the repressor. Here the repressor can't bind anyway.", "Lactose braucht es nur, um den Repressor zu entfernen. Hier kann der Repressor sowieso nicht binden.") },
  },
  {
    op: "lac",
    text: tx("the regulator gene is defective: no working repressor is made", "das Regulatorgen ist defekt: Es entsteht kein funktionsfähiger Repressor"),
    result: "always",
    why: tx("Without a repressor the operator is always free: constitutive transcription.", "Ohne Repressor ist der Operator immer frei: konstitutive Transkription."),
    traps: { never: tx("The repressor is the brake. Without the brake, nothing stops transcription.", "Der Repressor ist die Bremse. Ohne Bremse stoppt nichts die Transkription.") },
  },
  {
    op: "lac",
    text: tx("the repressor can no longer bind the inducer (allolactose)", "der Repressor kann den Induktor (Allolactose) nicht mehr binden"),
    result: "never",
    why: tx("The repressor stays on the operator even with lactose: the genes can't be switched on.", "Der Repressor bleibt auch mit Lactose am Operator: Die Gene lassen sich nicht anschalten."),
    traps: { normal: tx("Lactose only works by binding the repressor. If it can't bind, the repressor stays on the operator.", "Lactose wirkt nur, indem sie an den Repressor bindet. Kann sie das nicht, bleibt der Repressor am Operator.") },
  },
  {
    op: "lac",
    text: tx("promoter mutation: RNA polymerase can no longer bind", "Promotormutation: Die RNA-Polymerase kann nicht mehr binden"),
    result: "never",
    why: tx("Without a working promoter RNA polymerase can't start: no transcription at all.", "Ohne funktionierenden Promotor kann die RNA-Polymerase nicht starten: gar keine Transkription."),
    traps: { normal: tx("Lactose removes the repressor, but RNA polymerase still can't bind to the broken promoter.", "Lactose entfernt zwar den Repressor, aber die RNA-Polymerase kann trotzdem nicht an den defekten Promotor binden.") },
  },
  {
    op: "trp",
    text: tx("wild type (no mutation)", "Wildtyp (keine Mutation)"),
    result: "normal",
    why: tx("Tryptophan activates the repressor as corepressor: end product repression. Without tryptophan the genes are on.", "Tryptophan aktiviert als Corepressor den Repressor: Endproduktrepression. Ohne Tryptophan sind die Gene an."),
    traps: { inverse: tx("That's the lac logic. Tryptophan is the **end product**: when there's plenty, the genes for making it are switched off.", "Das ist die lac-Logik. Tryptophan ist das **Endprodukt**: Ist genug da, werden die Gene für seine Herstellung abgeschaltet.") },
  },
  {
    op: "trp",
    text: tx("the repressor can no longer bind tryptophan", "der Repressor kann kein Tryptophan mehr binden"),
    result: "always",
    why: tx("The repressor never becomes active, so it never blocks the operator: the genes stay on.", "Der Repressor wird nie aktiv und blockiert den Operator nie: Die Gene bleiben an."),
    traps: { normal: tx("Tryptophan can only switch the genes off via the repressor. If it can't bind, nothing switches off.", "Tryptophan kann die Gene nur über den Repressor abschalten. Kann es nicht binden, schaltet nichts ab.") },
  },
  {
    op: "trp",
    text: tx("operator mutation: the active repressor can no longer bind", "Operatormutation: Der aktive Repressor kann nicht mehr binden"),
    result: "always",
    why: tx("The operator can't be blocked: the genes are transcribed all the time.", "Der Operator lässt sich nicht blockieren: Die Gene werden ständig abgelesen."),
  },
  {
    op: "trp",
    text: tx("the repressor binds to the operator even without tryptophan", "der Repressor bindet auch ohne Tryptophan an den Operator"),
    result: "never",
    why: tx("The operator is always blocked: the cell can't make its own tryptophan any more.", "Der Operator ist immer blockiert: Die Zelle kann kein eigenes Tryptophan mehr herstellen."),
    traps: { normal: tx("Normally the repressor needs tryptophan to bind. This one binds without it, so it never lets go.", "Normalerweise braucht der Repressor Tryptophan zum Binden. Dieser bindet ohne, lässt also nie los.") },
  },
];

const PICK_TEXT: Record<"lac" | "trp", Record<Pick, Text>> = {
  lac: {
    normal: tx("only when lactose is present", "nur, wenn Lactose vorhanden ist"),
    inverse: tx("only when there is no lactose", "nur, wenn keine Lactose vorhanden ist"),
    always: tx("always, with or without lactose", "immer, mit oder ohne Lactose"),
    never: tx("never, not even with lactose", "nie, auch nicht mit Lactose"),
  },
  trp: {
    normal: tx("only when there is little tryptophan", "nur, wenn wenig Tryptophan vorhanden ist"),
    inverse: tx("only when there is plenty of tryptophan", "nur, wenn viel Tryptophan vorhanden ist"),
    always: tx("always, whatever the tryptophan level", "immer, egal wie viel Tryptophan da ist"),
    never: tx("never", "nie"),
  },
};

export function operonTask(sc: Scenario, rng: Rng | null): Exercise {
  const picks: Pick[] = ["normal", "inverse", "always", "never"];
  const opts: Opt[] = [
    { text: PICK_TEXT[sc.op][sc.result] },
    ...picks
      .filter((p) => p !== sc.result)
      .map((p) => {
        const say = sc.traps?.[p];
        return say ? { text: PICK_TEXT[sc.op][p], title: tx("Think it through", "Denk es durch"), say } : { text: PICK_TEXT[sc.op][p] };
      }),
  ];
  const ch = choiceOf(rng, opts);
  return {
    instruction: sc.op === "lac" ? tx("Predict the lac operon", "Sag das lac-Operon voraus") : tx("Predict the trp operon", "Sag das trp-Operon voraus"),
    text: tx(
      `E. coli, ${sc.op} operon: ${en(sc.text)}. When are the structural genes transcribed?`,
      `E. coli, ${sc.op}-Operon: ${de(sc.text).charAt(0).toUpperCase()}${de(sc.text).slice(1)}. Wann werden die Strukturgene abgelesen?`,
    ),
    answer: ch.answer,
    hint: sc.op === "lac" ? tx("Who blocks the operator, and what removes the blocker?", "Wer blockiert den Operator, und was entfernt die Blockade?") : tx("The trp repressor is only active together with tryptophan.", "Der trp-Repressor ist nur zusammen mit Tryptophan aktiv."),
    solution: [{ math: tx(`"${en(PICK_TEXT[sc.op][sc.result])}"`, `"${de(PICK_TEXT[sc.op][sc.result])}"`), note: sc.why }],
    mistakes: ch.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Gene technology

/** PCR: copies after n cycles, or cycles needed. */
export function pcrTask(start: number, n: number, askCycles = false): Exercise {
  if (!askCycles) {
    const value = start * 2 ** n;
    const m = numberMistakes(value);
    m.add(start * 2 * n, tx("Added instead of doubled", "Addiert statt verdoppelt"), tx("Each cycle **doubles** the number: multiply by 2 each time, so $2^n$, not $2 · n$.", "Jeder Zyklus **verdoppelt** die Zahl: jedes Mal mal 2, also $2^n$, nicht $2 · n$."));
    m.add(start * 2 ** (n - 1), tx("One doubling short", "Eine Verdopplung zu wenig"), tx(`After ${n} cycles there were ${n} doublings, so $2^{${n}}$.`, `Nach ${n} Zyklen gab es ${n} Verdopplungen, also $2^{${n}}$.`));
    m.add(2 ** n, tx("Start copies forgotten", "Startkopien vergessen"), tx(`$2^{${n}}$ is the factor. You started with ${start} copies, so multiply by ${start}.`, `$2^{${n}}$ ist der Faktor. Am Anfang waren es ${start} Kopien, also noch mal ${start}.`));
    m.add(start * n ** 2, tx("Squared", "Quadriert"), tx("It's $2^n$ (doubling n times), not $n^2$.", "Es ist $2^n$ (n-mal verdoppeln), nicht $n^2$."));
    return {
      instruction: tx("Calculate the PCR copies", "Berechne die PCR-Kopien"),
      text: tx(
        `A PCR starts with ${start} ${start === 1 ? "copy" : "copies"} of a DNA section. How many copies are there after ${n} cycles, if every cycle works perfectly?`,
        `Eine PCR startet mit ${start} ${start === 1 ? "Kopie" : "Kopien"} eines DNA-Abschnitts. Wie viele Kopien sind es nach ${n} Zyklen, wenn jeder Zyklus perfekt klappt?`,
      ),
      answer: { kind: "number", value, unit: tx("copies", "Kopien") },
      hint: tx("Each cycle doubles the DNA: N = N₀ · 2ⁿ.", "Jeder Zyklus verdoppelt die DNA: N = N₀ · 2ⁿ."),
      solution: [
        { math: `N = N_0 \\cdot 2^n`, note: tx("Each cycle doubles every double strand.", "Jeder Zyklus verdoppelt jeden Doppelstrang.") },
        { math: tx(`N = ${start} \\cdot 2^{${n}} = ${en(bigText(value)).replace(/,/g, "\\,")}`, `N = ${start} \\cdot 2^{${n}} = ${de(bigText(value)).replace(/\./g, "\\,")}`), note: tx(`**${en(bigText(value))}** copies.`, `**${de(bigText(value))}** Kopien.`) },
      ],
      mistakes: m.list,
    };
  }
  const target = start * 2 ** n;
  // A round target somewhere between the previous doubling and this one.
  const raw = target * (0.55 + (0.4 * ((n * 7) % 10)) / 10);
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  const want = Math.max(start * 2 ** (n - 1) + 1, Math.round(raw / mag) * mag);
  const value = Math.ceil(Math.log2(want / start));
  const m = numberMistakes(value);
  m.add(value - 1, tx("Not quite enough", "Noch nicht genug"), tx(`After ${value - 1} cycles you only have ${start * 2 ** (value - 1)} copies, fewer than ${want}.`, `Nach ${value - 1} Zyklen hast du erst ${start * 2 ** (value - 1)} Kopien, weniger als ${want}.`), true);
  m.add(Math.ceil(want / start / 2), tx("Not doubling", "Nicht verdoppelt"), tx("Each cycle doubles: the copies grow like 2, 4, 8, 16, … not in equal steps.", "Jeder Zyklus verdoppelt: Die Kopien wachsen wie 2, 4, 8, 16, … nicht in gleichen Schritten."));
  return {
    instruction: tx("Find the number of cycles", "Bestimme die Zahl der Zyklen"),
    text: tx(
      `A PCR starts with ${start} ${start === 1 ? "copy" : "copies"}. How many cycles are needed at least to get ${want} copies or more?`,
      `Eine PCR startet mit ${start} ${start === 1 ? "Kopie" : "Kopien"}. Wie viele Zyklen braucht man mindestens, um ${want} oder mehr Kopien zu erhalten?`,
    ),
    answer: { kind: "number", value },
    hint: tx("Double step by step, or solve N₀ · 2ⁿ ≥ target.", "Verdopple Schritt für Schritt oder löse N₀ · 2ⁿ ≥ Ziel."),
    solution: [
      { math: `${start} \\cdot 2^{${value - 1}} = ${start * 2 ** (value - 1)} < ${want}`, note: tx(`${value - 1} cycles are not enough.`, `${value - 1} Zyklen reichen nicht.`) },
      { math: `${start} \\cdot 2^{${value}} = ${start * 2 ** value} \\ge ${want}`, note: tx(`**${value} cycles**.`, `**${value} Zyklen**.`) },
    ],
    mistakes: m.list,
  };
}

function pcrStepsTask(rng: Rng): Exercise {
  const pairsList: [Text, Text][] = [
    [tx("denaturation", "Denaturierung"), tx("about 95 °C", "etwa 95 °C")],
    [tx("primer annealing", "Primeranlagerung"), tx("about 55 °C", "etwa 55 °C")],
    [tx("elongation", "Elongation"), tx("about 72 °C", "etwa 72 °C")],
  ];
  const distractor = rng.pick([tx("about 37 °C", "etwa 37 °C"), tx("about 4 °C", "etwa 4 °C"), tx("about 120 °C", "etwa 120 °C")]);
  return {
    instruction: tx("Match each PCR step to its temperature", "Ordne jedem PCR-Schritt seine Temperatur zu"),
    answer: { kind: "match", pairs: pairsList, distractors: [distractor] },
    hint: tx("Hottest: separating the strands. Taq polymerase works best at its own optimum.", "Am heißesten: Stränge trennen. Die Taq-Polymerase arbeitet bei ihrem eigenen Optimum."),
    solution: [{ math: "95 \\deg\\text{C} \\to 55 \\deg\\text{C} \\to 72 \\deg\\text{C}", note: tx("95 °C separates the strands, at 55 °C the primers bind, at 72 °C Taq polymerase extends them.", "Bei 95 °C trennen sich die Stränge, bei 55 °C binden die Primer, bei 72 °C verlängert die Taq-Polymerase.") }],
    mistakes: [
      {
        when: { kind: "match", pairs: [[pairsList[1][0], pairsList[2][1]], [pairsList[2][0], pairsList[1][1]]] },
        title: tx("Annealing and elongation swapped", "Anlagerung und Elongation vertauscht"),
        say: tx("Swapped: the primers bind when it's cooled down (about 55 °C). Taq polymerase then works at 72 °C, its optimum.", "Vertauscht: Die Primer binden nach dem Abkühlen (etwa 55 °C). Die Taq-Polymerase arbeitet danach bei 72 °C, ihrem Optimum."),
      },
    ],
  };
}

type Enzyme = { name: string; site: string; cut: number };
const RESTRICTION: Enzyme[] = [
  { name: "EcoRI", site: "GAATTC", cut: 1 },
  { name: "BamHI", site: "GGATCC", cut: 1 },
  { name: "HindIII", site: "AAGCTT", cut: 1 },
  { name: "XbaI", site: "TCTAGA", cut: 1 },
  { name: "SalI", site: "GTCGAC", cut: 1 },
  { name: "XhoI", site: "CTCGAG", cut: 1 },
];

export function stickyEndTask(e: Enzyme, flankL: string, flankR: string): Exercise {
  const overhang = e.site.slice(e.cut, e.site.length - e.cut);
  const top = flankL + e.site + flankR;
  const m = mistakeList();
  m.add(overhang, e.site, tx("Whole site", "Ganze Erkennungsstelle"), tx("That's the whole recognition site. The sticky end is only the single-stranded part that sticks out after the staggered cut.", "Das ist die ganze Erkennungsstelle. Das klebrige Ende ist nur der einzelsträngige Teil, der nach dem versetzten Schnitt übersteht."));
  m.add(overhang, complement(overhang), tx("Complement written", "Komplement geschrieben"), tx(`The overhang read 5′→3′ is part of the top strand: just after the cut (${e.site.slice(0, e.cut)}^${e.site.slice(e.cut)}).`, `Der Überhang 5′→3′ ist ein Stück des oberen Strangs: direkt nach dem Schnitt (${e.site.slice(0, e.cut)}^${e.site.slice(e.cut)}).`));
  m.add(overhang, e.site.slice(e.cut), tx("Too long", "Zu lang"), tx(`Not everything after the cut is single-stranded: the last ${e.cut} base pair${e.cut > 1 ? "s are" : " is"} still paired.`, `Nicht alles nach dem Schnitt ist einzelsträngig: ${e.cut === 1 ? "Das letzte Basenpaar ist" : `Die letzten ${e.cut} Basenpaare sind`} noch gepaart.`));
  return {
    instruction: tx("Find the sticky end", "Bestimme das klebrige Ende"),
    text: tx(
      `The restriction enzyme ${e.name} recognises the palindrome ${e.site} and cuts both strands between ${e.site[e.cut - 1]} and ${e.site[e.cut]} (${e.site.slice(0, e.cut)}^${e.site.slice(e.cut)}). Which single-stranded overhang (5′→3′) does it leave?`,
      `Das Restriktionsenzym ${e.name} erkennt das Palindrom ${e.site} und schneidet beide Stränge zwischen ${e.site[e.cut - 1]} und ${e.site[e.cut]} (${e.site.slice(0, e.cut)}^${e.site.slice(e.cut)}). Welcher einzelsträngige Überhang (5′→3′) bleibt übrig?`,
    ),
    math: pairs(top, complement(top), { ends: ["5′", "3′", "3′", "5′"] }),
    answer: seqAnswer(overhang, tx("Overhang 5′→3′:", "Überhang 5′→3′:")),
    hint: tx("The bottom strand is cut at the same place, read from its own 5′ end. What is left between the two cuts?", "Der untere Strang wird an der gleichen Stelle geschnitten, von seinem eigenen 5′-Ende aus. Was bleibt zwischen den beiden Schnitten?"),
    solution: [
      { math: `\\text{${flankL}${e.site.slice(0, e.cut)}} \\quad \\hl{\\text{${overhang}}}\\text{${e.site.slice(e.site.length - e.cut)}${flankR}}`, note: tx("The top strand is cut after the first base of the site.", "Der obere Strang wird nach der ersten Base der Erkennungsstelle geschnitten.") },
      { math: `\\text{${complement(flankL)}${complement(e.site.slice(0, e.cut))}}\\hl{\\text{${complement(overhang)}}} \\quad \\text{${complement(e.site.slice(e.site.length - e.cut) + flankR)}}`, note: tx(`The bottom strand is cut staggered. Sticky end: **${overhang}** (5′→3′). Any DNA cut with ${e.name} has the same ends and fits.`, `Der untere Strang wird versetzt geschnitten. Klebriges Ende: **${overhang}** (5′→3′). Jede DNA, die mit ${e.name} geschnitten wurde, hat dieselben Enden und passt.`) },
    ],
    mistakes: m.list,
  };
}

function fragmentCountTask(rng: Rng): Exercise {
  const k = rng.int(1, 5);
  const circular = rng.chance(0.5);
  const value = circular ? k : k + 1;
  const m = numberMistakes(value);
  if (circular) m.add(k + 1, tx("It's a ring", "Es ist ein Ring"), tx("A plasmid is a ring: k cuts give k pieces (one cut just opens the ring).", "Ein Plasmid ist ein Ring: k Schnitte ergeben k Stücke (ein Schnitt öffnet nur den Ring)."));
  else m.add(k, tx("Linear DNA", "Lineare DNA"), tx("Linear DNA has two ends: k cuts give k + 1 pieces.", "Lineare DNA hat zwei Enden: k Schnitte ergeben k + 1 Stücke."));
  m.add(2 * k, tx("Two strands?", "Zwei Stränge?"), tx("Both strands are cut at the same site: each cut counts once for the double strand.", "Beide Stränge werden an derselben Stelle geschnitten: Jeder Schnitt zählt für den Doppelstrang nur einmal."));
  return {
    instruction: tx("Count the fragments", "Zähle die Fragmente"),
    text: circular
      ? tx(`A plasmid (circular DNA) has ${k} recognition ${k === 1 ? "site" : "sites"} for a restriction enzyme. How many fragments are there after complete digestion?`, `Ein Plasmid (ringförmige DNA) hat ${k} Erkennungsstelle${k === 1 ? "" : "n"} für ein Restriktionsenzym. Wie viele Fragmente entstehen bei vollständigem Verdau?`)
      : tx(`A linear DNA molecule has ${k} recognition ${k === 1 ? "site" : "sites"} for a restriction enzyme. How many fragments are there after complete digestion?`, `Ein lineares DNA-Molekül hat ${k} Erkennungsstelle${k === 1 ? "" : "n"} für ein Restriktionsenzym. Wie viele Fragmente entstehen bei vollständigem Verdau?`),
    answer: { kind: "number", value },
    hint: tx("Draw it: a line or a circle, and k cuts.", "Zeichne es: eine Linie oder einen Kreis und k Schnitte."),
    solution: [{ math: circular ? `${k} \\to ${k}` : `${k} + 1 = ${value}`, note: circular ? tx(`Circular: ${k} cuts → **${k} fragments**.`, `Ringförmig: ${k} Schnitte → **${k} Fragmente**.`) : tx(`Linear: ${k} cuts → **${k + 1} fragments**.`, `Linear: ${k} Schnitte → **${k + 1} Fragmente**.`) }],
    mistakes: m.list,
  };
}

function gelTask(rng: Rng): Exercise {
  const L = rng.pick([3000, 4000, 5000]);
  let p1 = 0;
  let p2 = 0;
  for (let k = 0; k < 50; k++) {
    p1 = rng.int(3, L / 100 - 6) * 100;
    p2 = rng.int(p1 / 100 + 3, L / 100 - 3) * 100;
    const fr = [p1, p2 - p1, L - p2];
    if (new Set(fr).size === 3 && fr.every((f) => f >= 300) && Math.abs(L - p1 - p2) >= 300) break;
  }
  const sorted = (a: number[]) => [...a].sort((x, y) => y - x);
  const lanes: { frags: number[]; kind: "right" | "positions" | "onecut" | "uncut" }[] = [
    { frags: sorted([p1, p2 - p1, L - p2]), kind: "right" },
    { frags: sorted([p1, p2]), kind: "positions" },
    { frags: sorted([p1, L - p1]), kind: "onecut" },
    { frags: [L], kind: "uncut" },
  ];
  const order = rng.shuffle([0, 1, 2, 3]);
  const shown = order.map((i) => lanes[i]);
  const laneText = (k: number) => tx(`lane ${k + 1}`, `Spur ${k + 1}`);
  const say: Record<string, { title: Text; say: Text }> = {
    positions: { title: tx("Positions, not lengths", "Positionen statt Längen"), say: tx(`Those are the cutting positions (${p1} and ${p2}). The fragment lengths are the distances between the cuts and the ends.`, `Das sind die Schnittpositionen (${p1} und ${p2}). Die Fragmentlängen sind die Abstände zwischen Schnitten und Enden.`) },
    onecut: { title: tx("One cut missing", "Ein Schnitt fehlt"), say: tx("This lane shows only one cut. With two sites, linear DNA gives three fragments.", "Diese Spur zeigt nur einen Schnitt. Mit zwei Schnittstellen ergibt lineare DNA drei Fragmente.") },
    uncut: { title: tx("Uncut", "Ungeschnitten"), say: tx("That's the uncut DNA: one band at the full length.", "Das ist die ungeschnittene DNA: eine Bande bei der vollen Länge.") },
  };
  const rightPos = shown.findIndex((l) => l.kind === "right");
  // The options stay in lane order (lane 1 … 4), so the letters match the lanes.
  const options = shown.map((_, k) => laneText(k));
  const answer = { kind: "choice" as const, options, correct: rightPos };
  const mistakes: Mistake[] = shown.flatMap((l, k) => (l.kind === "right" ? [] : [{ when: { kind: "choice" as const, options, correct: k }, ...say[l.kind] }]));
  return {
    instruction: tx("Read the gel", "Werte das Gel aus"),
    text: tx(
      `A linear DNA of ${L} bp is cut with a restriction enzyme that cuts at positions ${p1} and ${p2}. Which lane shows the result? (M: size marker in bp)`,
      `Eine lineare DNA von ${L} bp wird mit einem Restriktionsenzym geschnitten, das an den Positionen ${p1} und ${p2} schneidet. Welche Spur zeigt das Ergebnis? (M: Größenmarker in bp)`,
    ),
    visual: { component: DnaGel as never, props: { lanes: shown.map((l) => l.frags) } },
    answer,
    hint: tx("Work out the three fragment lengths first. Short fragments run further.", "Berechne zuerst die drei Fragmentlängen. Kurze Fragmente wandern weiter."),
    solution: [
      { math: `${p1} \\quad ${p2} - ${p1} = ${p2 - p1} \\quad ${L} - ${p2} = ${L - p2}`, note: tx("Three fragments: from the start to the 1st cut, between the cuts, from the 2nd cut to the end.", "Drei Fragmente: vom Anfang bis zum 1. Schnitt, zwischen den Schnitten, vom 2. Schnitt bis zum Ende.") },
      { math: tx(`"lane ${rightPos + 1}"`, `"Spur ${rightPos + 1}"`), note: tx(`Lane ${rightPos + 1} has bands at ${sorted([p1, p2 - p1, L - p2]).join(", ")} bp.`, `Spur ${rightPos + 1} hat Banden bei ${sorted([p1, p2 - p1, L - p2]).join(", ")} bp.`) },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Practice

const SHAPES: [number, (rng: Rng) => Exercise][] = [
  [1.5, forkTask],
  [1, (rng) => replicationOrderTask(rng.int(4, 5), 0 + (rng.chance(0.3) ? 1 : 0))],
  [1.2, enzymeMatchTask],
  [1.5, templateStrandTask],
  [1.8, splicingTask],
  [1, (rng) => codingLengthTask(rng.int(50, 400))],
  [1.5, riboFactTask],
  [0.8, peptideBondTask],
  [1, processingMultiTask],
  [2.2, (rng) => operonTask(rng.pick(SCENARIOS), rng)],
  [1.6, (rng) => pcrTask(rng.pick([1, 1, 2, 4, 5, 10]), rng.int(5, 12), rng.chance(0.35))],
  [0.8, pcrStepsTask],
  [1.3, (rng) => stickyEndTask(rng.pick(RESTRICTION), rng.pick(["A", "T", "G", "C"]), rng.pick(["A", "T", "G", "C"]))],
  [0.8, fragmentCountTask],
  [1.4, gelTask],
];

export function generate3(rng: Rng): Exercise {
  const total = SHAPES.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, make] of SHAPES) if ((r -= w) < 0) return make(rng);
  return SHAPES[0][1](rng);
}

// ---------------------------------------------------------------------------
// Lesson

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Replication in detail", "Replikation im Detail"),
      blob: tx("One rule explains almost everything at the fork. Ready?", "Eine Regel erklärt fast alles an der Gabel. Bereit?"),
      body: tx(
        "Replication starts at origins of replication. Two replication forks run away from each origin in opposite directions.",
        "Die Replikation beginnt an Replikationsursprüngen (Origins). Von jedem Origin laufen zwei Replikationsgabeln in entgegengesetzte Richtungen.",
      ),
      frames: [
        {
          math: "\\text{5′}#e5 \\; \\text{ATGC}#s \\; \\hl{\\text{3′-OH}#oh}",
          note: tx("DNA polymerase can only attach new nucleotides to a free **3′-OH end**. New DNA therefore always grows **5′→3′**; the template is read 3′→5′.", "Die DNA-Polymerase kann neue Nukleotide nur an ein freies **3′-OH-Ende** hängen. Neue DNA wächst deshalb immer **5′→3′**; die Matrize wird 3′→5′ gelesen."),
        },
        {
          math: "\\text{5′}#e5 \\; \\text{ATGC}#s \\; \\text{A}#n \\; \\hl{\\text{3′-OH}#oh}",
          note: tx("The building blocks are nucleoside triphosphates (dATP, dTTP, dGTP, dCTP). Splitting off two phosphates provides the energy for the bond.", "Die Bausteine sind Nukleosidtriphosphate (dATP, dTTP, dGTP, dCTP). Die Abspaltung von zwei Phosphaten liefert die Energie für die Bindung."),
        },
        {
          math: tx('"no 3′-OH?" \\Rightarrow "RNA primer"', '"kein 3′-OH?" \\Rightarrow "RNA-Primer"'),
          note: tx("Polymerase can't start on a bare strand. **Primase** first builds a short **RNA primer** that provides the 3′-OH end.", "An einem nackten Strang kann die Polymerase nicht starten. Die **Primase** baut zuerst einen kurzen **RNA-Primer**, der das 3′-OH-Ende liefert."),
        },
        {
          math: tx('"leading strand: continuous" \\\\ "lagging strand: Okazaki fragments"', '"Leitstrang: kontinuierlich" \\\\ "Folgestrang: Okazaki-Fragmente"'),
          note: tx(
            "Because the strands are antiparallel, only one new strand can grow continuously towards the fork: the **leading strand**. The other, the **lagging strand**, is made in pieces of about 1000 to 2000 nucleotides (in bacteria): **Okazaki fragments**.",
            "Weil die Stränge antiparallel sind, kann nur ein neuer Strang durchgehend zur Gabel hin wachsen: der **Leitstrang**. Der andere, der **Folgestrang**, entsteht in Stücken von etwa 1000 bis 2000 Nukleotiden (bei Bakterien): den **Okazaki-Fragmenten**.",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The replication fork", "Die Replikationsgabel"),
      blob: tx("Step by step: watch the lagging strand closely!", "Schritt für Schritt: Schau dir den Folgestrang genau an!"),
      body: tx("Go through the work at the fork: helicase, primase, DNA polymerase III, DNA polymerase I and ligase. Watch which way each new strand grows.", "Geh die Arbeit an der Gabel durch: Helikase, Primase, DNA-Polymerase III, DNA-Polymerase I und Ligase. Achte darauf, in welche Richtung jeder neue Strang wächst."),
      widget: DnaFork,
    },
    {
      type: "check",
      blob: tx("Put the lagging strand in order!", "Bring den Folgestrang in Ordnung!"),
      exercise: replicationOrderTask(5, 0),
    },
    {
      type: "explain",
      title: tx("Eukaryotic transcription and RNA processing", "Transkription und RNA-Prozessierung bei Eukaryoten"),
      blob: tx("In our cells the mRNA needs a makeover before it may leave.", "In unseren Zellen braucht die mRNA erst ein Umstyling, bevor sie raus darf."),
      frames: [
        {
          math: tx('"TATA box" \\to "promoter" \\to "gene"', '"TATA-Box" \\to "Promotor" \\to "Gen"'),
          note: tx(
            "**Transcription factors** bind to the **promoter**, for example to the **TATA box** about 25 to 30 base pairs before the start. Only then can **RNA polymerase II** bind and start.",
            "**Transkriptionsfaktoren** binden an den **Promotor**, zum Beispiel an die **TATA-Box** etwa 25 bis 30 Basenpaare vor dem Startpunkt. Erst dann kann die **RNA-Polymerase II** binden und loslegen.",
          ),
        },
        {
          math: "\\text{E1}#e1 \\; \\fade{\\text{I1}#i1} \\; \\text{E2}#e2 \\; \\fade{\\text{I2}#i2} \\; \\text{E3}#e3",
          note: tx("The first copy is the **pre-mRNA**. It contains **exons** (expressed) and **introns** (intervening sequences) that are not translated.", "Die erste Abschrift ist die **prä-mRNA**. Sie enthält **Exons** (werden exprimiert) und **Introns** (dazwischenliegende Sequenzen), die nicht übersetzt werden."),
        },
        {
          math: "\\hl{\\text{Cap}#cap} \\; \\text{E1}#e1 \\; \\fade{\\text{I1}#i1} \\; \\text{E2}#e2 \\; \\fade{\\text{I2}#i2} \\; \\text{E3}#e3 \\; \\hl{\\text{AAAA…}#pa}",
          note: tx("**5′ cap** (a modified guanine) and **poly-A tail** protect the mRNA from being broken down and help with export and translation.", "**5′-Cap** (ein verändertes Guanin) und **Poly-A-Schwanz** schützen die mRNA vor dem Abbau und helfen beim Export und bei der Translation."),
        },
        {
          math: "\\text{Cap}#cap \\; \\text{E1}#e1 \\; \\text{E2}#e2 \\; \\text{E3}#e3 \\; \\text{AAAA…}#pa",
          note: tx("**Splicing**: the spliceosome cuts out the introns and joins the exons. Only now does the **mature mRNA** leave the nucleus.", "**Spleißen**: Das Spleißosom schneidet die Introns heraus und verknüpft die Exons. Erst jetzt verlässt die **reife mRNA** den Zellkern."),
        },
        {
          math: "\\text{Cap}#cap \\; \\text{E1}#e1 \\; \\text{E3}#e3 \\; \\text{AAAA…}#pa",
          note: tx(
            "**Alternative splicing**: if exon 2 is cut out too, a different mRNA and so a different protein results. That's how about 20,000 human genes give rise to far more different proteins.",
            "**Alternatives Spleißen**: Wird Exon 2 mit herausgeschnitten, entsteht eine andere mRNA und damit ein anderes Protein. So entstehen aus den etwa 20.000 Genen des Menschen weit mehr verschiedene Proteine.",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Process a pre-mRNA", "Prozessiere eine prä-mRNA"),
      blob: tx("Cap on, tail on, introns out!", "Cap drauf, Schwanz dran, Introns raus!"),
      body: tx("Go through the processing step by step. Then leave out exon 3 and compare the two proteins.", "Geh die Prozessierung Schritt für Schritt durch. Lass dann Exon 3 weg und vergleich die beiden Proteine."),
      widget: DnaSplicing,
    },
    {
      type: "widget",
      title: tx("Translation: A, P and E site", "Translation: A-, P- und E-Stelle"),
      blob: tx("Three seats in the ribosome. Who sits where?", "Drei Plätze im Ribosom. Wer sitzt wo?"),
      body: tx(
        "**Initiation**: the small subunit binds the mRNA and finds AUG; the initiator tRNA (Met) sits in the P site, then the large subunit joins. **Elongation** repeats three steps: a tRNA binds in the **A site** (aminoacyl), the chain is moved onto it (**peptide bond**), and the ribosome moves on one codon (**translocation**); the empty tRNA leaves via the **E site** (exit). **Termination**: a stop codon in the A site binds a release factor.",
        "**Initiation**: Die kleine Untereinheit bindet die mRNA und sucht AUG; die Start-tRNA (Met) sitzt an der P-Stelle, dann kommt die große Untereinheit dazu. Die **Elongation** wiederholt drei Schritte: Eine tRNA bindet an der **A-Stelle** (Aminoacyl), die Kette wird auf sie übertragen (**Peptidbindung**), und das Ribosom rückt ein Codon weiter (**Translokation**); die leere tRNA verlässt es über die **E-Stelle** (Exit). **Termination**: Ein Stoppcodon an der A-Stelle bindet einen Freisetzungsfaktor.",
      ),
      widget: RibosomeSites,
    },
    {
      type: "check",
      blob: tx("A quick calculation with codons.", "Eine kurze Rechnung mit Codons."),
      exercise: codingLengthTask(150),
    },
    {
      type: "widget",
      title: tx("Gene regulation: the operon model", "Genregulation: das Operon-Modell"),
      blob: tx("Bacteria only make what they need. Flip the switch!", "Bakterien stellen nur her, was sie brauchen. Leg den Schalter um!"),
      body: tx(
        "Jacob and Monod (1961) explained gene regulation in bacteria with the **operon**: promoter, operator and structural genes in a row. A **repressor** from the regulator gene can block the operator. **lac operon** (sugar breakdown): lactose inactivates the repressor, the genes are switched on (**substrate induction**). **trp operon** (synthesis): the end product tryptophan activates the repressor, the genes are switched off (**end product repression**).",
        "Jacob und Monod (1961) erklärten die Genregulation bei Bakterien mit dem **Operon**: Promotor, Operator und Strukturgene hintereinander. Ein **Repressor** vom Regulatorgen kann den Operator blockieren. **lac-Operon** (Zuckerabbau): Lactose inaktiviert den Repressor, die Gene werden angeschaltet (**Substratinduktion**). **trp-Operon** (Synthese): Das Endprodukt Tryptophan aktiviert den Repressor, die Gene werden abgeschaltet (**Endproduktrepression**).",
      ),
      widget: DnaLacOperon,
    },
    {
      type: "check",
      blob: tx("Now a mutant. Think like a geneticist!", "Jetzt eine Mutante. Denk wie eine Genetikerin!"),
      exercise: operonTask(SCENARIOS[1], createRng(4)),
    },
    {
      type: "explain",
      title: tx("Gene technology: cut, paste, copy", "Gentechnik: schneiden, kleben, kopieren"),
      blob: tx("Molecular scissors and glue. Let's build something!", "Molekulare Schere und Kleber. Lass uns was bauen!"),
      frames: [
        {
          math: pairs("GAATTC", "CTTAAG", { ends: ["5′", "3′", "3′", "5′"] }),
          note: tx("**Restriction enzymes** recognise short palindromes: read 5′→3′, both strands are the same. EcoRI cuts G^AATTC, in both strands between G and A.", "**Restriktionsenzyme** erkennen kurze Palindrome: 5′→3′ gelesen sind beide Stränge gleich. EcoRI schneidet G^AATTC, in beiden Strängen zwischen G und A."),
        },
        {
          math: "\\text{G}#a \\quad \\quad \\text{AATTC}#b \\\\ \\text{CTTAA}#c \\quad \\quad \\text{G}#d",
          note: tx("The cuts are staggered, so single-stranded overhangs remain: **sticky ends** (here AATT). They pair with every other end cut by EcoRI.", "Die Schnitte sind versetzt, deshalb bleiben einzelsträngige Überhänge: **klebrige Enden** (sticky ends, hier AATT). Sie paaren mit jedem anderen von EcoRI geschnittenen Ende."),
        },
        {
          math: tx('"plasmid" + "gene" \\to "recombinant plasmid"', '"Plasmid" + "Gen" \\to "rekombinantes Plasmid"'),
          note: tx(
            "Cut a plasmid and foreign DNA with the same enzyme: the ends fit, and **DNA ligase** joins them. Bacteria take up this **vector** (transformation) and make, for example, human insulin.",
            "Schneidet man Plasmid und Fremd-DNA mit demselben Enzym, passen die Enden zusammen, und die **DNA-Ligase** verknüpft sie. Bakterien nehmen diesen **Vektor** auf (Transformation) und bilden dann zum Beispiel Humaninsulin.",
          ),
        },
        {
          math: tx('"short fragments" \\to "+"', '"kurze Fragmente" \\to "+"'),
          note: tx("**Gel electrophoresis**: DNA is negatively charged (phosphate groups) and moves through the gel towards the positive pole. Short fragments move faster and further; a size marker shows the lengths.", "**Gelelektrophorese**: DNA ist negativ geladen (Phosphatgruppen) und wandert im Gel zum Pluspol. Kurze Fragmente wandern schneller und weiter; ein Größenmarker zeigt die Längen."),
        },
        {
          math: tx('"guide RNA" + "Cas9" \\to "cut"', '"Leit-RNA" + "Cas9" \\to "Schnitt"'),
          note: tx("**CRISPR/Cas9**: a guide RNA pairs with a matching DNA sequence and leads the enzyme Cas9 there, which cuts both strands. Genes can be switched off or changed precisely (Nobel Prize 2020: Charpentier and Doudna).", "**CRISPR/Cas9**: Eine Leit-RNA paart mit einer passenden DNA-Sequenz und führt das Enzym Cas9 dorthin, das beide Stränge schneidet. So lassen sich Gene gezielt ausschalten oder verändern (Nobelpreis 2020: Charpentier und Doudna)."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("PCR: the copying machine", "PCR: die Kopiermaschine"),
      blob: tx("Three temperatures, over and over. Count the copies!", "Drei Temperaturen, immer wieder. Zähl die Kopien!"),
      body: tx(
        "The **polymerase chain reaction** copies a DNA section in a test tube: denaturation (~95 °C), primer annealing (~55 °C), elongation (~72 °C) with the heat-stable Taq polymerase. Each cycle doubles the DNA: after n cycles $N = N_0 · 2^n$.",
        "Die **Polymerase-Kettenreaktion** vervielfältigt einen DNA-Abschnitt im Reagenzglas: Denaturierung (~95 °C), Primeranlagerung (~55 °C), Elongation (~72 °C) mit der hitzestabilen Taq-Polymerase. Jeder Zyklus verdoppelt die DNA: Nach n Zyklen gilt $N = N_0 · 2^n$.",
      ),
      widget: DnaPcr,
    },
    {
      type: "check",
      blob: tx("Last one: exponential growth!", "Die letzte: exponentielles Wachstum!"),
      exercise: pcrTask(5, 10),
    },
  ],
  summary: [
    {
      title: tx("Replication at the fork", "Replikation an der Gabel"),
      body: tx(
        "Helicase opens, primase sets RNA primers, DNA polymerase III builds only 5′→3′ (and proofreads): leading strand continuous, lagging strand in Okazaki fragments. Polymerase I replaces the primers, ligase joins the fragments.",
        "Helikase öffnet, Primase setzt RNA-Primer, DNA-Polymerase III baut nur 5′→3′ (und liest Korrektur): Leitstrang kontinuierlich, Folgestrang in Okazaki-Fragmenten. Polymerase I ersetzt die Primer, Ligase verknüpft die Fragmente.",
      ),
      tone: "rule",
    },
    {
      title: tx("Eukaryotic gene expression", "Genexpression bei Eukaryoten"),
      body: tx("Transcription factors at the promoter (TATA box), RNA polymerase II → pre-mRNA. Processing: 5′ cap, poly-A tail, splicing (introns out, exons joined), alternative splicing.", "Transkriptionsfaktoren am Promotor (TATA-Box), RNA-Polymerase II → prä-mRNA. Prozessierung: 5′-Cap, Poly-A-Schwanz, Spleißen (Introns raus, Exons zusammen), alternatives Spleißen."),
      examples: ["\\text{Cap} \\; \\text{E1} \\; \\text{E2} \\; \\text{E3} \\; \\text{AAAA…}"],
      tone: "rule",
    },
    {
      title: tx("Translation at the ribosome", "Translation am Ribosom"),
      body: tx("Initiation (AUG, Met-tRNA in the P site), elongation (A site → peptide bond → translocation, exit via E), termination (stop codon in A, release factor).", "Initiation (AUG, Met-tRNA an der P-Stelle), Elongation (A-Stelle → Peptidbindung → Translokation, Ausgang über E), Termination (Stoppcodon an A, Freisetzungsfaktor)."),
      examples: [tx('"E" \\quad "P" \\quad "A"', '"E" \\quad "P" \\quad "A"')],
      tone: "rule",
    },
    {
      title: tx("Operon model", "Operon-Modell"),
      body: tx("lac operon: lactose (inducer) inactivates the repressor → genes on (substrate induction). trp operon: tryptophan (corepressor) activates the repressor → genes off (end product repression).", "lac-Operon: Lactose (Induktor) inaktiviert den Repressor → Gene an (Substratinduktion). trp-Operon: Tryptophan (Corepressor) aktiviert den Repressor → Gene aus (Endproduktrepression)."),
      tone: "rule",
    },
    {
      title: tx("Gene technology", "Gentechnik"),
      body: tx("Restriction enzymes (EcoRI: G^AATTC, sticky ends), ligase, plasmid vector, gel electrophoresis (short fragments run further), CRISPR/Cas9. PCR: 95 °C, 55 °C, 72 °C per cycle.", "Restriktionsenzyme (EcoRI: G^AATTC, klebrige Enden), Ligase, Plasmidvektor, Gelelektrophorese (kurze Fragmente wandern weiter), CRISPR/Cas9. PCR: 95 °C, 55 °C, 72 °C pro Zyklus."),
      examples: ["N = N_0 \\cdot 2^n"],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Klassische Fallen"),
      body: tx("Polymerases build only 5′→3′. Okazaki fragments only on the lagging strand. Linear DNA: k cuts → k + 1 fragments, a plasmid: k fragments. Exons stay, introns go.", "Polymerasen bauen nur 5′→3′. Okazaki-Fragmente nur am Folgestrang. Lineare DNA: k Schnitte → k + 1 Fragmente, ein Plasmid: k Fragmente. Exons bleiben, Introns fliegen raus."),
      tone: "warning",
    },
  ],
};

/** The translation widget with the A, P and E sites labelled. */
function RibosomeSites() {
  return <DnaRibosome sites />;
}
