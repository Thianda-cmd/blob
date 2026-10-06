"use client";

import { resolveText, tx, type Text } from "@/i18n/text";
import { DnaCodeSun } from "@/learn/biology/visuals/DnaCodeSun";
import { DnaMutation } from "@/learn/biology/visuals/DnaMutation";
import { DnaNucleotide } from "@/learn/biology/visuals/DnaNucleotide";
import { DnaReplication } from "@/learn/biology/visuals/DnaReplication";
import { DnaRibosome } from "@/learn/biology/visuals/DnaRibosome";
import { DnaTranscription } from "@/learn/biology/visuals/DnaTranscription";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson, Mistake } from "@/learn/types";
import {
  aminoAccept,
  aminoLetter,
  aminoOf,
  anticodonOf,
  choiceOf,
  complement,
  isStop,
  leader,
  mistakeList,
  numberMistakes,
  pairs,
  peptideRich,
  peptideText,
  reversed,
  senseCodon,
  seq,
  seqAnswer,
  strand,
  toDna,
  toRna,
  transcribe,
  translate,
  triplets,
  uniqueOpts,
  variedDna,
  type Opt,
} from "./data";

const en = (t: Text) => resolveText(t, "en");
const de = (t: Text) => resolveText(t, "de");
const sunVisual = { component: DnaCodeSun as never, props: { compact: true } };

// ---------------------------------------------------------------------------
// Transcription

type TranscribeKind = "template" | "both" | "coding";

/** mRNA from a short gene section (6 bases, typed exactly). */
export function transcribeTask(coding: string, kind: TranscribeKind, templateOnTop = false): Exercise {
  const template = complement(coding); // written 3′→5′ under the coding strand
  const mrna = toRna(coding);
  const m = mistakeList();
  const tInMrna = tx(
    "Right partners, but this is RNA: there's no **thymine** in RNA. Opposite A it gets **U (uracil)**.",
    "Richtige Partner, aber das ist RNA: In der RNA gibt es kein **Thymin**. Gegenüber von A kommt **U (Uracil)**.",
  );
  if (kind === "coding") {
    m.add(mrna, coding, tx("T in the mRNA", "T in der mRNA"), tInMrna);
    m.add(
      mrna,
      transcribe(coding),
      tx("Coding strand used as template", "Codierenden Strang abgelesen"),
      tx(
        "You paired against the **coding** strand. RNA polymerase reads the other one, the template. So the mRNA has the same sequence as the coding strand, just with U instead of T.",
        "Du hast zum **codierenden** Strang komplementär gepaart. Die RNA-Polymerase liest aber den anderen, den codogenen Strang. Deshalb hat die mRNA dieselbe Basenfolge wie der codierende Strang, nur mit U statt T.",
      ),
    );
  } else {
    m.add(mrna, coding, tx("T in the mRNA", "T in der mRNA"), tInMrna);
    m.add(
      mrna,
      toRna(template),
      tx("Template copied", "Matrize abgeschrieben"),
      kind === "both"
        ? tx(
            "You read the wrong strand: that's the template strand with U. The mRNA is **complementary** to the template strand (or: like the coding strand, with U).",
            "Du hast den falschen Strang genommen: Das ist der codogene Strang mit U. Die mRNA ist **komplementär** zum codogenen Strang (oder: wie der codierende Strang, mit U).",
          )
        : tx(
            "You copied the template and only swapped T for U. But the mRNA is built **complementary** to it: opposite T comes A, opposite A comes U.",
            "Du hast die Matrize abgeschrieben und nur T gegen U getauscht. Die mRNA wird aber **komplementär** dazu gebaut: Gegenüber von T kommt A, gegenüber von A kommt U.",
          ),
    );
  }
  m.add(
    mrna,
    reversed(mrna),
    tx("Wrong direction", "Falsche Richtung"),
    tx("The bases are right, but backwards. Write the mRNA from its 5′ end to its 3′ end, base by base under the template.", "Die Basen stimmen, aber rückwärts. Schreib die mRNA von ihrem 5′-Ende zum 3′-Ende, Base für Base unter der Matrize."),
  );
  const shown =
    kind === "template"
      ? strand(template, "3")
      : kind === "coding"
        ? strand(coding, "5")
        : templateOnTop
          ? pairs(template, coding, { ends: ["3′", "5′", "5′", "3′"] })
          : pairs(coding, template, { ends: ["5′", "3′", "3′", "5′"] });
  const text: Text =
    kind === "template"
      ? tx("This is the template (codogenic) strand of a gene. Write the mRNA that is made from it (5′→3′).", "Das ist der codogene Strang (Matrizenstrang) eines Gens. Schreib die mRNA auf, die daran entsteht (5′→3′).")
      : kind === "coding"
        ? tx("This is the coding strand of a gene (not the template). Write the mRNA of this section (5′→3′).", "Das ist der codierende Strang eines Gens (nicht die Matrize). Schreib die mRNA dieses Abschnitts auf (5′→3′).")
        : templateOnTop
          ? tx("The **top** strand is the template (codogenic) strand. Write the mRNA (5′→3′).", "Der **obere** Strang ist der codogene Strang. Schreib die mRNA auf (5′→3′).")
          : tx("The **bottom** strand is the template (codogenic) strand. Write the mRNA (5′→3′).", "Der **untere** Strang ist der codogene Strang. Schreib die mRNA auf (5′→3′).");
  return {
    instruction: kind === "coding" ? tx("Transcribe from the coding strand", "Leite die mRNA vom codierenden Strang ab") : tx("Transcribe the gene section", "Transkribiere den Genabschnitt"),
    text,
    math: shown,
    answer: seqAnswer(mrna, tx("mRNA 5′→3′:", "mRNA 5′→3′:")),
    hint:
      kind === "coding"
        ? tx("The mRNA is complementary to the template, so it looks like the coding strand. Only one letter changes.", "Die mRNA ist komplementär zur Matrize, sieht also aus wie der codierende Strang. Nur ein Buchstabe ändert sich.")
        : tx("Pair against the template: A → U, T → A, G → C, C → G. RNA has U instead of T.", "Paare zur Matrize: A → U, T → A, G → C, C → G. RNA hat U statt T."),
    solution: [
      { math: pairs(template, " ".repeat(6), { ends: ["3′", "5′", "", ""] }), note: tx("Start from the template strand (3′→5′).", "Geh vom codogenen Strang aus (3′→5′).") },
      {
        math: pairs(template, mrna, { ends: ["3′", "5′", "5′", "3′"], mark: [...mrna].flatMap((b, i) => (b === "U" ? [i] : [])) }),
        note: tx(`Pair base by base, with U opposite A. mRNA: **5′-${mrna}-3′**, the coding strand with U instead of T.`, `Base für Base paaren, gegenüber von A kommt U. mRNA: **5′-${mrna}-3′**, der codierende Strang mit U statt T.`),
      },
    ],
    mistakes: m.list,
  };
}

function transcribeGen(rng: Rng): Exercise {
  const kind = rng.pick(["template", "template", "both", "coding"] as const);
  let coding = variedDna(rng, 6, 3);
  for (let k = 0; k < 30 && !coding.includes("T"); k++) coding = variedDna(rng, 6, 3);
  return transcribeTask(coding, kind, rng.chance(0.5));
}

// ---------------------------------------------------------------------------
// Genetic code

/** Amino acid of an mRNA codon (or of a template triplet that has to be transcribed first). */
function codonTask(rng: Rng): Exercise {
  const fromTemplate = rng.chance(0.35);
  const codon = senseCodon(rng);
  const aa = aminoOf(codon);
  const template = complement(toDna(codon));
  const mistakes: Mistake[] = [];
  const seen = new Set([aa.one]);
  const add = (c: string, title: Text, say: Text) => {
    const w = aminoOf(c);
    if (seen.has(w.one) || w.one === "*") return;
    seen.add(w.one);
    mistakes.push({ when: { kind: "word", accept: aminoAccept(w) }, title, say });
  };
  if (fromTemplate) {
    add(toRna(template), tx("Template looked up directly", "Matrize direkt nachgeschlagen"), tx("You looked up the DNA triplet itself. First build the mRNA codon (complementary, with U), then use the code sun.", "Du hast das DNA-Triplett selbst nachgeschlagen. Bilde zuerst das mRNA-Codon (komplementär, mit U), dann geht's in die Codesonne."));
    add(
      reversed(codon),
      tx("Read from the outside in", "Von außen nach innen gelesen"),
      tx("The mRNA codon is right, but the code sun is read **from the inside out**: 1st base in the middle.", "Das mRNA-Codon stimmt, aber die Codesonne liest man **von innen nach außen**: 1. Base in der Mitte."),
    );
  } else
    add(
      reversed(codon),
      tx("Read from the outside in", "Von außen nach innen gelesen"),
      tx("Ah, you started on the outside. The code sun is read **from the inside out**: the 1st base (5′ end) is in the middle.", "Ah, du hast außen angefangen. Die Codesonne liest man **von innen nach außen**: Die 1. Base (5′-Ende) steht in der Mitte."),
    );
  if (!fromTemplate) add(anticodonOf(codon), tx("Anticodon looked up", "Anticodon nachgeschlagen"), tx("That's the amino acid of the complementary triplet. The code sun works with the **mRNA codon** itself.", "Das ist die Aminosäure des komplementären Tripletts. Die Codesonne gilt für das **mRNA-Codon** selbst."));
  return {
    instruction: tx("Use the code sun", "Lies die Codesonne ab"),
    text: fromTemplate
      ? tx(`A triplet of the template (codogenic) strand reads $${strand(template, "3")}$. Which amino acid does it code for?`, `Ein Triplett des codogenen Strangs lautet $${strand(template, "3")}$. Für welche Aminosäure codiert es?`)
      : tx(`Which amino acid does the mRNA codon $${strand(codon, "5")}$ code for?`, `Für welche Aminosäure codiert das mRNA-Codon $${strand(codon, "5")}$?`),
    visual: sunVisual,
    answer: { kind: "word", accept: aminoAccept(aa), placeholder: tx("name or 3-letter code", "Name oder Dreibuchstabencode") },
    hint: fromTemplate ? tx("First the mRNA codon: complementary, with U instead of T. Then from the inside out.", "Zuerst das mRNA-Codon: komplementär, mit U statt T. Dann von innen nach außen.") : tx("1st base in the middle, 2nd in the next ring, 3rd outside.", "1. Base in der Mitte, 2. im nächsten Ring, 3. außen."),
    solution: [
      ...(fromTemplate ? [{ math: pairs(template, codon, { ends: ["3′", "5′", "5′", "3′"] }), note: tx(`Template ${template} → mRNA codon **${codon}**.`, `Matrize ${template} → mRNA-Codon **${codon}**.`) }] : []),
      { math: `${seq(codon)} \\to \\text{${aa.abbr}}`, note: tx(`In the code sun: ${codon[0]} (inside) → ${codon[1]} → ${codon[2]} (outside): **${en(aa.name)} (${aa.abbr})**.`, `In der Codesonne: ${codon[0]} (innen) → ${codon[1]} → ${codon[2]} (außen): **${de(aa.name)} (${aa.abbr})**.`) },
    ],
    mistakes,
  };
}

/** Anticodon of a codon, written 3′→5′ under the codon. */
export function anticodonTask(codon: string): Exercise {
  const right = anticodonOf(codon);
  const m = mistakeList();
  m.add(right, codon, tx("That's the codon", "Das ist das Codon"), tx("You wrote the codon again. The **anti**codon on the tRNA is its complementary partner.", "Du hast das Codon noch einmal geschrieben. Das **Anti**codon an der tRNA ist sein komplementärer Partner."));
  m.add(right, complement(toDna(codon)), tx("T in RNA", "T in der RNA"), tx("Right idea, but the tRNA is RNA too: no T! Opposite A it has **U**.", "Richtige Idee, aber auch die tRNA ist RNA: kein T! Gegenüber von A steht **U**."));
  m.add(right, reversed(right), tx("Other direction", "Andere Richtung"), tx("You wrote it 5′→3′. Here we want it lined up base by base under the codon, so 3′→5′.", "Du hast es 5′→3′ geschrieben. Hier soll es Base für Base unter dem Codon stehen, also 3′→5′."));
  return {
    instruction: tx("Find the anticodon", "Bestimme das Anticodon"),
    text: tx("Which anticodon does the tRNA need for this mRNA codon? Write it 3′→5′, base by base under the codon.", "Welches Anticodon braucht die tRNA für dieses mRNA-Codon? Schreib es 3′→5′, Base für Base unter das Codon."),
    math: strand(codon, "5"),
    answer: seqAnswer(right, tx("anticodon 3′→5′:", "Anticodon 3′→5′:")),
    hint: tx("Codon and anticodon pair like RNA bases: A–U and G–C.", "Codon und Anticodon paaren wie RNA-Basen: A–U und G–C."),
    solution: [
      { math: pairs(codon, right, { ends: ["5′", "3′", "3′", "5′"] }), note: tx(`A–U and G–C: the anticodon is **${right}** (3′→5′).`, `A–U und G–C: Das Anticodon lautet **${right}** (3′→5′).`) },
    ],
    mistakes: m.list,
  };
}

/** Build an mRNA: leader without AUG, AUG, sense codons, a stop codon and a trailer codon. */
function buildMrna(rng: Rng, k: number) {
  const lead = leader(rng, rng.pick([2, 4, 5]));
  const body: string[] = ["AUG"];
  for (let i = 0; i < k; i++) body.push(senseCodon(rng, { noStart: true }));
  const stop = rng.pick(["UAA", "UAG", "UGA"]);
  const after = senseCodon(rng, { noStart: true });
  return { lead, body, stop, after, mrna: lead + body.join("") + stop + after };
}

/** Translate an mRNA (choice of peptides; distractors are the typical reading mistakes). */
export function translateTask(rng: Rng | null, fixed?: { lead: string; body: string[]; stop: string; after: string }): Exercise {
  const r = rng ?? null;
  const x = fixed ?? buildMrna(r!, r!.int(2, 3));
  const mrna = x.lead + x.body.join("") + x.stop + x.after;
  const right = translate(mrna).aas;
  const fromFirst = translate(mrna, 0).aas.filter((a) => a !== "*");
  const through = [...right, aminoLetter(x.after)];
  const antis: string[] = [];
  for (const c of x.body) {
    const a = aminoLetter(anticodonOf(c));
    if (a === "*") break;
    antis.push(a);
  }
  const opts: Opt[] = uniqueOpts([
    { text: peptideRich(right) },
    {
      text: peptideRich(fromFirst),
      title: tx("Started at the first base", "Ab der ersten Base gelesen"),
      say: tx("The ribosome doesn't start at the first base: it looks for the **start codon AUG**. Everything is read from there in steps of three.", "Das Ribosom beginnt nicht bei der ersten Base: Es sucht das **Startcodon AUG**. Ab dort wird in Dreierschritten gelesen."),
    },
    {
      text: peptideRich(through),
      title: tx("Read past the stop", "Über das Stopp gelesen"),
      say: tx(`${x.stop} is a **stop codon**: no tRNA fits, translation ends there. Nothing after it belongs to the protein.`, `${x.stop} ist ein **Stoppcodon**: Keine tRNA passt, die Translation endet dort. Was danach kommt, gehört nicht mehr zum Protein.`),
    },
    {
      text: peptideRich(antis),
      title: tx("Anticodons looked up", "Anticodons nachgeschlagen"),
      say: tx("You looked up the complementary triplets (the anticodons). The code sun is made for the **codons of the mRNA**.", "Du hast die komplementären Tripletts (die Anticodons) nachgeschlagen. Die Codesonne gilt für die **Codons der mRNA**."),
    },
    {
      text: peptideRich(right.slice(1)),
      title: tx("Methionine forgotten", "Methionin vergessen"),
      say: tx("AUG is the start signal **and** codes for methionine. Every new protein starts with Met.", "AUG ist Startsignal **und** codiert Methionin. Jedes neue Protein beginnt mit Met."),
    },
  ]).slice(0, 4);
  const ch = choiceOf(r, opts);
  return {
    instruction: tx("Translate the mRNA", "Übersetze die mRNA"),
    text: tx("Which peptide does the ribosome make from this mRNA?", "Welches Peptid bildet das Ribosom aus dieser mRNA?"),
    math: strand(mrna, "5"),
    visual: sunVisual,
    answer: ch.answer,
    hint: tx("Find AUG first. Then read in steps of three until a stop codon.", "Such zuerst AUG. Dann lies in Dreierschritten bis zu einem Stoppcodon."),
    solution: [
      { math: `\\text{${x.lead}} \\; \\hl{\\text{AUG}} \\; ${seq(x.body.slice(1).join(""), true)} \\; \\text{${x.stop}} \\; \\text{${x.after}}`, note: tx("Start codon AUG found; from there in triplets.", "Startcodon AUG gefunden, ab da in Tripletts.") },
      { math: `\\text{${peptideText(right)}}`, note: tx(`Stop at ${x.stop}. The peptide: **${peptideText(right)}**.`, `Stopp bei ${x.stop}. Das Peptid: **${peptideText(right)}**.`) },
    ],
    mistakes: ch.mistakes,
  };
}

function countAaTask(rng: Rng): Exercise {
  const k = rng.int(2, 5);
  const x = buildMrna(rng, k);
  const value = k + 1;
  const m = numberMistakes(value);
  m.add(value + 1, tx("Stop codon counted", "Stoppcodon mitgezählt"), tx("The stop codon doesn't code for an amino acid. It only ends the translation.", "Das Stoppcodon codiert keine Aminosäure. Es beendet nur die Translation."));
  m.add(value - 1, tx("Start codon not counted", "Startcodon nicht gezählt"), tx("AUG counts too: it codes for methionine, the first amino acid.", "AUG zählt mit: Es codiert Methionin, die erste Aminosäure."));
  m.add(Math.floor(x.mrna.length / 3), tx("All triplets counted", "Alle Tripletts gezählt"), tx("Not every triplet counts: only from the start codon AUG up to (not including) the stop codon.", "Nicht jedes Triplett zählt: nur vom Startcodon AUG bis vor das Stoppcodon."));
  return {
    instruction: tx("Count the amino acids", "Zähle die Aminosäuren"),
    text: tx("How many amino acids does the peptide made from this mRNA have?", "Wie viele Aminosäuren hat das Peptid, das aus dieser mRNA entsteht?"),
    math: strand(x.mrna, "5"),
    answer: { kind: "number", value },
    hint: tx("From AUG to the stop codon. The stop codon itself has no amino acid.", "Von AUG bis zum Stoppcodon. Das Stoppcodon selbst hat keine Aminosäure."),
    solution: [
      { math: `\\text{${x.lead}} \\; \\hl{${seq(x.body.join(""), true)}} \\; \\text{${x.stop}} \\; \\text{${x.after}}`, note: tx(`From AUG: ${x.body.length} codons before the stop codon ${x.stop}.`, `Ab AUG: ${x.body.length} Codons vor dem Stoppcodon ${x.stop}.`) },
      { math: `${value}`, note: tx(`**${value}** amino acids (Met included, stop not).`, `**${value}** Aminosäuren (Met mitgezählt, Stopp nicht).`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Mutations

type MutType = "silent" | "missense" | "nonsense" | "frameshift";
const MUT_NAME: Record<MutType, Text> = {
  silent: tx("silent mutation", "stumme Mutation"),
  missense: tx("missense mutation", "Missense-Mutation"),
  nonsense: tx("nonsense mutation", "Nonsense-Mutation"),
  frameshift: tx("frameshift mutation", "Rastermutation (Leserasterverschiebung)"),
};

type Mutation = { before: string[]; after: string[]; at: number; type: MutType; from: string; to: string; note: Text };

/** Finds a point mutation of the wanted type in codons 1…3, or an insertion/deletion. */
function makeMutation(rng: Rng, type: MutType): Mutation | null {
  for (let tries = 0; tries < 40; tries++) {
    const before = ["AUG", senseCodon(rng, { noStart: true }), senseCodon(rng, { noStart: true }), senseCodon(rng, { noStart: true })];
    if (type === "frameshift") {
      const at = rng.int(1, 2);
      const pos = rng.int(0, 2);
      const flat = before.join("");
      const idx = at * 3 + pos;
      const ins = rng.chance(0.5);
      const b = rng.pick(["A", "U", "G", "C"]);
      const mutated = ins ? flat.slice(0, idx) + b + flat.slice(idx) : flat.slice(0, idx) + flat.slice(idx + 1);
      const after = triplets(mutated);
      return {
        before,
        after,
        at,
        type,
        from: before[at],
        to: after[at],
        note: ins ? tx(`One base (${b}) inserted in codon ${at + 1}.`, `In Codon ${at + 1} ist eine Base (${b}) eingefügt.`) : tx(`One base deleted in codon ${at + 1}.`, `In Codon ${at + 1} fehlt eine Base.`),
      };
    }
    const at = rng.int(1, 3);
    const c = before[at];
    const cands: string[] = [];
    for (let p = 0; p < 3; p++)
      for (const b of ["A", "U", "G", "C"]) {
        if (b === c[p]) continue;
        const n = c.slice(0, p) + b + c.slice(p + 1);
        const same = aminoLetter(n) === aminoLetter(c);
        if (type === "silent" && same) cands.push(n);
        if (type === "missense" && !same && !isStop(n)) cands.push(n);
        if (type === "nonsense" && isStop(n)) cands.push(n);
      }
    if (!cands.length) continue;
    const to = rng.pick(cands);
    const after = before.map((x, i) => (i === at ? to : x));
    return { before, after, at, type, from: c, to, note: tx(`In codon ${at + 1}, ${c} became ${to}.`, `In Codon ${at + 1} wurde aus ${c} ${to}.`) };
  }
  return null;
}

export function mutationExercise(mu: Mutation, rng: Rng | null): Exercise {
  const right = mu.type;
  const pep = (codons: string[]) => translate(codons.join("")).aas;
  const p0 = pep(mu.before);
  const p1 = pep(mu.after);
  const say = (picked: MutType): Opt => {
    const text = MUT_NAME[picked];
    if (right === "silent" && picked === "missense")
      return { text, title: tx("Same amino acid", "Gleiche Aminosäure"), say: tx(`The base changed, but check the code sun: ${mu.from} and ${mu.to} code for the same amino acid. The code is degenerate.`, `Die Base ist anders, aber schau in die Codesonne: ${mu.from} und ${mu.to} codieren dieselbe Aminosäure. Der Code ist degeneriert.`) };
    if (right === "missense" && picked === "silent")
      return { text, title: tx("Look it up", "Schlag nach"), say: tx(`Look closely: ${mu.from} and ${mu.to} code for **different** amino acids.`, `Schau genau hin: ${mu.from} und ${mu.to} codieren **verschiedene** Aminosäuren.`) };
    if (right === "nonsense" && (picked === "missense" || picked === "silent"))
      return { text, title: tx("That's a stop codon", "Das ist ein Stoppcodon"), say: tx(`${mu.to} isn't an amino acid at all: it's a **stop codon**. The protein breaks off early.`, `${mu.to} ist gar keine Aminosäure, sondern ein **Stoppcodon**. Das Protein bricht vorzeitig ab.`) };
    if (right === "frameshift" && picked !== "frameshift")
      return { text, title: tx("Count the bases", "Zähl die Basen"), say: tx("Count the bases: one is added or missing. From there on, the reading frame shifts and every following codon changes.", "Zähl die Basen: Eine ist dazugekommen oder fehlt. Ab da verschiebt sich das Leseraster, und jedes folgende Codon ändert sich.") };
    if (right !== "frameshift" && picked === "frameshift")
      return { text, title: tx("Same length", "Gleiche Länge"), say: tx("The number of bases stays the same: one base was **exchanged**, so the reading frame stays.", "Die Zahl der Basen bleibt gleich: Eine Base wurde **ausgetauscht**, das Leseraster bleibt also erhalten.") };
    return { text };
  };
  const all: MutType[] = ["silent", "missense", "nonsense", "frameshift"];
  const ch = choiceOf(rng, [{ text: MUT_NAME[right] }, ...all.filter((t) => t !== right).map(say)]);
  const line = (codons: string[], mark: number) => codons.map((c, i) => (i === mark ? `\\hl{\\text{${c}}}` : `\\text{${c}}`)).join(" ");
  return {
    instruction: tx("Classify the mutation", "Bestimme die Art der Mutation"),
    text: tx("A mutation changed this mRNA. What kind of mutation is it?", "Durch eine Mutation hat sich diese mRNA verändert. Welche Art von Mutation ist das?"),
    math: tx(`"before:" \\; ${line(mu.before, mu.at)} \\\\ "after:" \\; ${line(mu.after, mu.at)}`, `"vorher:" \\; ${line(mu.before, mu.at)} \\\\ "nachher:" \\; ${line(mu.after, mu.at)}`),
    visual: sunVisual,
    answer: ch.answer,
    hint: tx("Count the bases first. Same number? Then look up the old and the new codon.", "Zähl zuerst die Basen. Gleich viele? Dann schlag altes und neues Codon nach."),
    solution: [
      { math: `\\text{${peptideText(p0)}}`, note: tx(`Before: ${peptideText(p0)}. ${en(mu.note)}`, `Vorher: ${peptideText(p0)}. ${de(mu.note)}`) },
      {
        math: `\\text{${peptideText(p1) || "–"}}`,
        note:
          right === "silent"
            ? tx("After: the same protein. **Silent mutation**.", "Nachher: dasselbe Protein. **Stumme Mutation**.")
            : right === "missense"
              ? tx(`After: one amino acid exchanged. **Missense mutation**.`, `Nachher: eine Aminosäure ausgetauscht. **Missense-Mutation**.`)
              : right === "nonsense"
                ? tx(`After: ${mu.to} is a stop codon, the protein is too short. **Nonsense mutation**.`, `Nachher: ${mu.to} ist ein Stoppcodon, das Protein ist zu kurz. **Nonsense-Mutation**.`)
                : tx("After: from the mutation on, every codon is read differently. **Frameshift mutation**.", "Nachher: Ab der Mutation wird jedes Codon anders gelesen. **Rastermutation**."),
      },
    ],
    mistakes: ch.mistakes,
  };
}

function mutationTask(rng: Rng): Exercise {
  const type = rng.pick(["silent", "missense", "missense", "nonsense", "frameshift"] as const);
  const mu = makeMutation(rng, type) ?? makeMutation(rng, "missense")!;
  return mutationExercise(mu, rng);
}

/** What does deleting 1, 2 or 3 bases do? (A whole triplet keeps the reading frame.) */
function indelTask(rng: Rng): Exercise {
  const n = rng.pick([1, 3, 3, 2]);
  const correct: Opt =
    n === 3
      ? { text: tx("One amino acid is missing (or one changes), the rest of the protein stays the same.", "Eine Aminosäure fehlt (oder eine ändert sich), der Rest des Proteins bleibt gleich.") }
      : { text: tx("The reading frame shifts: almost all following amino acids change.", "Das Leseraster verschiebt sich: Fast alle folgenden Aminosäuren ändern sich.") };
  const opts: Opt[] = [
    correct,
    n === 3
      ? {
          text: tx("The reading frame shifts: almost all following amino acids change.", "Das Leseraster verschiebt sich: Fast alle folgenden Aminosäuren ändern sich."),
          title: tx("3 bases = 1 codon", "3 Basen = 1 Codon"),
          say: tx("Classic trap! Three bases are exactly one codon. After the gap, the triplets line up again: the reading frame stays.", "Die klassische Falle! Drei Basen sind genau ein Codon. Nach der Lücke stimmen die Tripletts wieder: Das Leseraster bleibt erhalten."),
        }
      : {
          text: tx("One amino acid is missing (or one changes), the rest of the protein stays the same.", "Eine Aminosäure fehlt (oder eine ändert sich), der Rest des Proteins bleibt gleich."),
          title: tx("Not a whole codon", "Kein ganzes Codon"),
          say: tx(`${n} ${n === 1 ? "base is" : "bases are"} not a whole codon. Everything after it is read in the wrong triplets.`, `${n} ${n === 1 ? "Base ist" : "Basen sind"} kein ganzes Codon. Alles danach wird in falschen Tripletts gelesen.`),
        },
    { text: tx("Nothing changes, the code is degenerate.", "Nichts ändert sich, der Code ist degeneriert."), title: tx("Degenerate means something else", "Degeneriert heißt etwas anderes"), say: tx("Degenerate means: several codons for one amino acid. That only helps with some exchanges, not when bases go missing.", "Degeneriert heißt: mehrere Codons für eine Aminosäure. Das hilft nur bei manchen Austauschen, nicht wenn Basen fehlen.") },
    { text: tx("Only the start codon stops working.", "Nur das Startcodon funktioniert nicht mehr.") },
  ];
  const ch = choiceOf(rng, opts);
  const where = rng.int(3, 9);
  return {
    instruction: tx("Predict the effect of a deletion", "Sag die Folge einer Deletion voraus"),
    text: tx(
      `In the middle of a gene (around codon ${where}), ${n} neighbouring ${n === 1 ? "base is" : "bases are"} deleted. What happens to the protein?`,
      `Mitten in einem Gen (etwa bei Codon ${where}) ${n === 1 ? "wird eine Base" : `werden ${n} benachbarte Basen`} deletiert. Was passiert mit dem Protein?`,
    ),
    answer: ch.answer,
    hint: tx("The ribosome reads in steps of three. Is the deletion a multiple of 3?", "Das Ribosom liest in Dreierschritten. Ist die Deletion ein Vielfaches von 3?"),
    solution: [
      n === 3
        ? { math: `${seq("AUGGCUUUCGGA", true)} \\to ${seq("AUGGCUGGA", true)}`, note: tx("3 bases = one codon: one amino acid is gone, the frame stays.", "3 Basen = ein Codon: Eine Aminosäure fehlt, das Raster bleibt.") }
        : { math: `${seq("AUGGCUUUCGGA", true)} \\to ${seq(n === 1 ? "AUGGCUUCGGA" : "AUGGCUCGGA", true)}`, note: tx("The frame shifts: every codon after the deletion is different.", "Das Raster verschiebt sich: Jedes Codon nach der Deletion ist anders.") },
    ],
    mistakes: ch.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Nucleotides, hydrogen bonds, base ratios, replication

function hbondTask(rng: Rng): Exercise {
  const s = variedDna(rng, rng.int(6, 8), 4);
  const at = [...s].filter((b) => b === "A" || b === "T").length;
  const gc = s.length - at;
  const value = 2 * at + 3 * gc;
  const m = numberMistakes(value);
  m.add(3 * at + 2 * gc, tx("2 and 3 swapped", "2 und 3 vertauscht"), tx("Swapped: A–T has **2** hydrogen bonds, G–C has **3**. (G–C holds tighter.)", "Vertauscht: A–T hat **2** Wasserstoffbrücken, G–C hat **3**. (G–C hält fester.)"));
  m.add(2 * s.length, tx("Always 2", "Immer 2"), tx("Not every pair has 2: G–C pairs have **3** hydrogen bonds.", "Nicht jedes Paar hat 2: G–C-Paare haben **3** Wasserstoffbrücken."));
  m.add(3 * s.length, tx("Always 3", "Immer 3"), tx("Not every pair has 3: A–T pairs have only **2** hydrogen bonds.", "Nicht jedes Paar hat 3: A–T-Paare haben nur **2** Wasserstoffbrücken."));
  m.add(s.length, tx("Pairs counted", "Paare gezählt"), tx("That's the number of base pairs. Each pair is held by 2 or 3 hydrogen bonds.", "Das ist die Zahl der Basenpaare. Jedes Paar wird von 2 oder 3 Wasserstoffbrücken gehalten."));
  return {
    instruction: tx("Count the hydrogen bonds", "Zähle die Wasserstoffbrücken"),
    text: tx("One strand of a DNA double strand is shown. How many hydrogen bonds hold the two strands together in this section?", "Gezeigt ist ein Strang eines DNA-Doppelstrangs. Wie viele Wasserstoffbrücken halten die beiden Stränge in diesem Abschnitt zusammen?"),
    math: strand(s, "5"),
    answer: { kind: "number", value },
    hint: tx("A–T: 2 hydrogen bonds. G–C: 3 hydrogen bonds.", "A–T: 2 Wasserstoffbrücken. G–C: 3 Wasserstoffbrücken."),
    solution: [
      { math: pairs(s, complement(s)), note: tx(`${at} A–T pairs and ${gc} G–C pairs.`, `${at} A–T-Paare und ${gc} G–C-Paare.`) },
      { math: `${at} \\cdot 2 + ${gc} \\cdot 3 = ${value}`, note: tx(`**${value}** hydrogen bonds.`, `**${value}** Wasserstoffbrücken.`) },
    ],
    mistakes: m.list,
  };
}

function gcTask(rng: Rng): Exercise {
  const gc = 2 * rng.int(18, 32);
  const askA = rng.chance(0.5);
  const value = askA ? (100 - gc) / 2 : gc / 2;
  const m = numberMistakes(value);
  if (askA) {
    m.add(100 - gc, tx("Not split up", "Nicht aufgeteilt"), tx(`${100 - gc} % are A and T **together**. Adenine alone is half of it.`, `${100 - gc} % sind A und T **zusammen**. Adenin allein ist die Hälfte davon.`));
    m.add(gc / 2, tx("That's guanine", "Das ist Guanin"), tx("That's the share of G (or C). Adenine belongs to the A–T pairs: they share the rest.", "Das ist der Anteil von G (oder C). Adenin gehört zu den A–T-Paaren: Die teilen sich den Rest."));
    m.add(gc, tx("GC content taken", "GC-Gehalt übernommen"), tx("The GC content is G and C together. Adenine is part of the rest.", "Der GC-Gehalt ist G und C zusammen. Adenin gehört zum Rest."));
  } else {
    m.add(gc, tx("Not split up", "Nicht aufgeteilt"), tx(`${gc} % are G and C **together**. Cytosine alone is half of it.`, `${gc} % sind G und C **zusammen**. Cytosin allein ist die Hälfte davon.`));
    m.add((100 - gc) / 2, tx("That's adenine", "Das ist Adenin"), tx("That's the share of A (or T). Cytosine is half of the GC content.", "Das ist der Anteil von A (oder T). Cytosin ist die Hälfte des GC-Gehalts."));
  }
  return {
    instruction: tx("Calculate from the GC content", "Rechne mit dem GC-Gehalt"),
    text: tx(
      `The GC content of a bacterial DNA (share of G and C together) is ${gc} %. What percentage of the bases are ${askA ? "adenine" : "cytosine"}?`,
      `Der GC-Gehalt einer Bakterien-DNA (Anteil von G und C zusammen) beträgt ${gc} %. Wie viel Prozent der Basen sind ${askA ? "Adenin" : "Cytosin"}?`,
    ),
    answer: { kind: "number", value, unit: "%" },
    hint: tx("G = C and A = T (Chargaff's rule). All four add up to 100 %.", "G = C und A = T (Chargaff-Regel). Alle vier zusammen ergeben 100 %."),
    solution: askA
      ? [
          { math: `\\text{A} + \\text{T} = 100 "%" - ${gc} "%" = ${100 - gc} "%"`, note: tx("A and T together are the rest.", "A und T zusammen sind der Rest.") },
          { math: `\\text{A} = ${100 - gc} "%" : 2 = ${value} "%"`, note: tx(`As many A as T: **${value} %** adenine.`, `Gleich viele A wie T: **${value} %** Adenin.`) },
        ]
      : [{ math: `\\text{C} = ${gc} "%" : 2 = ${value} "%"`, note: tx(`As many C as G: **${value} %** cytosine.`, `Gleich viele C wie G: **${value} %** Cytosin.`) }],
    mistakes: m.list,
  };
}

function meselsonTask(rng: Rng): Exercise {
  const n = rng.int(1, 3);
  if (rng.chance(0.55)) {
    const both = tx("one middle and one light band", "eine mittlere und eine leichte Bande");
    const middle = tx("only one middle band (hybrid DNA)", "nur eine mittlere Bande (Hybrid-DNA)");
    const opts: Opt[] = [
      { text: n === 1 ? middle : both },
      n === 1
        ? { text: both, title: tx("Too early for light DNA", "Zu früh für leichte DNA"), say: tx("After one copy, every molecule still contains one old heavy strand. Completely light molecules appear only from the 2nd generation.", "Nach einer Verdopplung enthält jedes Molekül noch einen alten, schweren Strang. Ganz leichte Moleküle gibt es erst ab der 2. Generation.") }
        : { text: middle, title: tx("Light molecules forgotten", "Leichte Moleküle vergessen"), say: tx("Only two molecules keep an old strand. All others are made only of new, light strands: a second band.", "Nur zwei Moleküle behalten einen alten Strang. Alle anderen bestehen nur aus neuen, leichten Strängen: eine zweite Bande.") },
      { text: tx("one heavy and one light band", "eine schwere und eine leichte Bande"), title: tx("That's the conservative model", "Das wäre das konservative Modell"), say: tx("That would be conservative replication: the old double strand stays together. Meselson and Stahl never found a heavy band again.", "Das wäre konservative Replikation: Der alte Doppelstrang bliebe zusammen. Eine schwere Bande fanden Meselson und Stahl nie wieder.") },
      { text: tx("only one light band", "nur eine leichte Bande"), title: tx("Old strands stay", "Alte Stränge bleiben"), say: tx("The old heavy strands are never lost: each one ends up in a hybrid molecule.", "Die alten, schweren Stränge gehen nie verloren: Jeder steckt in einem Hybrid-Molekül.") },
    ];
    const ch = choiceOf(rng, opts);
    return {
      instruction: tx("Predict the bands", "Sag die Banden voraus"),
      text: tx(
        `Bacteria with heavy DNA (¹⁵N) are moved to a medium with light nitrogen (¹⁴N). Which bands appear after ${n} ${n === 1 ? "copy" : "copies"} of the DNA in the density gradient, if replication is semiconservative?`,
        `Bakterien mit schwerer DNA (¹⁵N) kommen in ein Medium mit leichtem Stickstoff (¹⁴N). Welche Banden zeigen sich nach ${n} ${n === 1 ? "Verdopplung" : "Verdopplungen"} der DNA im Dichtegradienten, wenn die Replikation semikonservativ ist?`,
      ),
      answer: ch.answer,
      hint: tx("Each new molecule gets one old strand and one new strand. Follow the two old strands.", "Jedes neue Molekül bekommt einen alten und einen neuen Strang. Verfolge die zwei alten Stränge."),
      solution: [
        {
          math: `2^{${n}} = ${2 ** n}`,
          note: tx(`After ${n} ${n === 1 ? "copy" : "copies"}: ${2 ** n} molecules, 2 of them hybrid (old + new), ${2 ** n - 2} completely light.`, `Nach ${n} ${n === 1 ? "Verdopplung" : "Verdopplungen"}: ${2 ** n} Moleküle, davon 2 Hybrid (alt + neu), ${2 ** n - 2} ganz leicht.`),
        },
      ],
      mistakes: ch.mistakes,
    };
  }
  const g = rng.int(1, 4);
  const value = (2 / 2 ** g) * 100;
  const m = numberMistakes(value);
  m.add((1 / 2 ** g) * 100, tx("Only one old strand", "Nur ein alter Strang"), tx("There are **two** old strands, and each one ends up in its own hybrid molecule.", "Es gibt **zwei** alte Stränge, und jeder landet in einem eigenen Hybrid-Molekül."));
  m.add(0, tx("Hybrids don't disappear", "Hybride verschwinden nicht"), tx("The two old strands are never lost, so 2 hybrid molecules always stay.", "Die zwei alten Stränge gehen nie verloren, also bleiben immer 2 Hybrid-Moleküle."));
  m.add(100 / g, tx("Not linear", "Nicht linear"), tx("The number of molecules doubles each time, so divide 2 by $2^n$.", "Die Zahl der Moleküle verdoppelt sich jedes Mal, also teil 2 durch $2^n$."));
  return {
    instruction: tx("Work out the share of hybrid DNA", "Berechne den Anteil der Hybrid-DNA"),
    text: tx(
      `One heavy DNA molecule (¹⁵N) is copied ${g} ${g === 1 ? "time" : "times"} in ¹⁴N medium. What percentage of all DNA molecules are hybrid molecules (one heavy, one light strand)?`,
      `Ein schweres DNA-Molekül (¹⁵N) wird in ¹⁴N-Medium ${g}-mal verdoppelt. Wie viel Prozent aller DNA-Moleküle sind Hybrid-Moleküle (ein schwerer, ein leichter Strang)?`,
    ),
    answer: { kind: "number", value, unit: "%", tolerance: 0.01 },
    hint: tx("How many molecules are there after n copies? How many of them have an old strand?", "Wie viele Moleküle gibt es nach n Verdopplungen? Wie viele davon haben einen alten Strang?"),
    solution: [
      { math: `2^{${g}} = ${2 ** g}`, note: tx(`${2 ** g} molecules in total.`, `Insgesamt ${2 ** g} Moleküle.`) },
      { math: tx(`\\frac{2}{${2 ** g}} = ${value} "%"`, `\\frac{2}{${2 ** g}} = ${String(value).replace(".", ",")} "%"`), note: tx(`2 of them are hybrids: **${value} %**.`, `2 davon sind Hybride: **${String(value).replace(".", ",")} %**.`) },
    ],
    mistakes: m.list,
  };
}

const NUC_NAMES: Record<string, Text> = {
  phosphate: tx("phosphate group", "Phosphatrest"),
  sugar: tx("deoxyribose", "Desoxyribose"),
  base: tx("base", "Base"),
  nucleotide: tx("nucleotide", "Nukleotid"),
  hbond: tx("hydrogen bonds", "Wasserstoffbrücken"),
  backbone: tx("sugar-phosphate backbone", "Zucker-Phosphat-Rückgrat"),
};

function nucleotideFigureTask(rng: Rng): Exercise {
  const ask = rng.pick(Object.keys(NUC_NAMES));
  const wrong = rng.shuffle(Object.keys(NUC_NAMES).filter((k) => k !== ask)).slice(0, 3);
  const msg = (pick: string): Opt => {
    const text = NUC_NAMES[pick];
    if (ask === "nucleotide" && ["base", "sugar", "phosphate"].includes(pick))
      return { text, title: tx("The whole building block", "Der ganze Baustein"), say: tx("The frame holds three things together: phosphate, sugar and base. That's one nucleotide.", "Der Rahmen umfasst drei Teile: Phosphat, Zucker und Base. Das ist ein Nukleotid.") };
    if (ask === "sugar" && pick === "phosphate") return { text, title: tx("Pentagon = sugar", "Fünfeck = Zucker"), say: tx("The pentagon is the sugar deoxyribose. The phosphate is the round part between the sugars.", "Das Fünfeck ist der Zucker Desoxyribose. Das Phosphat ist der runde Teil zwischen den Zuckern.") };
    if (ask === "phosphate" && pick === "sugar") return { text, title: tx("Circle = phosphate", "Kreis = Phosphat"), say: tx("The circle is the phosphate group. The sugars are the pentagons.", "Der Kreis ist der Phosphatrest. Die Zucker sind die Fünfecke.") };
    if (ask === "backbone" && (pick === "sugar" || pick === "phosphate"))
      return { text, title: tx("The whole strand", "Der ganze Strang"), say: tx("The marked part is the whole outer chain of sugars and phosphates: the backbone.", "Markiert ist die ganze äußere Kette aus Zuckern und Phosphaten: das Rückgrat.") };
    return { text };
  };
  const ch = choiceOf(rng, [{ text: NUC_NAMES[ask] }, ...wrong.map(msg)]);
  return {
    instruction: tx("Name the marked structure", "Benenne die markierte Struktur"),
    text: tx("What is marked with ? in the drawing of the DNA double strand?", "Was ist in der Zeichnung des DNA-Doppelstrangs mit ? markiert?"),
    visual: { component: DnaNucleotide as never, props: { mode: "numbers", ask, legend: "none" } },
    answer: ch.answer,
    hint: tx("A nucleotide = phosphate + deoxyribose + base. The bases are held together in the middle.", "Ein Nukleotid = Phosphat + Desoxyribose + Base. In der Mitte werden die Basen zusammengehalten."),
    solution: [{ math: tx(`"${en(NUC_NAMES[ask])}"`, `"${de(NUC_NAMES[ask])}"`), note: tx("Phosphate (circle), deoxyribose (pentagon), base; dashed lines are hydrogen bonds.", "Phosphat (Kreis), Desoxyribose (Fünfeck), Base; gestrichelt die Wasserstoffbrücken.") }],
    mistakes: ch.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Terms, steps, facts

const TERMS2: { id: string; pair: [Text, Text] }[] = [
  { id: "helicase", pair: [tx("helicase", "Helikase"), tx("unwinds the DNA and separates the strands", "entwindet die DNA und trennt die Stränge")] },
  { id: "dnapol", pair: [tx("DNA polymerase", "DNA-Polymerase"), tx("builds a new DNA strand complementary to the old one", "baut einen neuen DNA-Strang komplementär zum alten")] },
  { id: "rnapol", pair: [tx("RNA polymerase", "RNA-Polymerase"), tx("builds the mRNA during transcription", "baut bei der Transkription die mRNA")] },
  { id: "ribosome", pair: [tx("ribosome", "Ribosom"), tx("where translation takes place", "Ort der Translation")] },
  { id: "trna", pair: [tx("tRNA", "tRNA"), tx("brings the matching amino acid", "bringt die passende Aminosäure")] },
  { id: "mrna", pair: [tx("mRNA", "mRNA"), tx("copy of a gene that travels to the ribosome", "Abschrift eines Gens, die zum Ribosom wandert")] },
  { id: "codon", pair: [tx("codon", "Codon"), tx("base triplet of the mRNA for one amino acid", "Basentriplett der mRNA für eine Aminosäure")] },
  { id: "anticodon", pair: [tx("anticodon", "Anticodon"), tx("base triplet of the tRNA that fits the codon", "Basentriplett der tRNA, das zum Codon passt")] },
  { id: "peptide", pair: [tx("peptide bond", "Peptidbindung"), tx("links two amino acids", "verknüpft zwei Aminosäuren")] },
];
const SWAPS: [string, string, Text, Text][] = [
  ["codon", "anticodon", tx("Codon and anticodon", "Codon und Anticodon"), tx("Swapped: the **codon** sits on the mRNA, the **anticodon** on the tRNA.", "Vertauscht: Das **Codon** sitzt auf der mRNA, das **Anticodon** auf der tRNA.")],
  ["anticodon", "codon", tx("Codon and anticodon", "Codon und Anticodon"), tx("Swapped: the anticodon belongs to the tRNA, the codon to the mRNA.", "Vertauscht: Das Anticodon gehört zur tRNA, das Codon zur mRNA.")],
  ["dnapol", "rnapol", tx("Which polymerase?", "Welche Polymerase?"), tx("DNA polymerase builds DNA (replication). The mRNA is built by **RNA** polymerase.", "Die DNA-Polymerase baut DNA (Replikation). Die mRNA baut die **RNA**-Polymerase.")],
  ["rnapol", "dnapol", tx("Which polymerase?", "Welche Polymerase?"), tx("RNA polymerase builds RNA. Copying DNA is the job of DNA polymerase.", "Die RNA-Polymerase baut RNA. DNA kopieren ist die Aufgabe der DNA-Polymerase.")],
  ["mrna", "trna", tx("mRNA and tRNA", "mRNA und tRNA"), tx("The **t**RNA transports amino acids. The **m**RNA is the messenger copy of the gene.", "Die **t**RNA transportiert Aminosäuren (t wie Transfer). Die **m**RNA ist die Abschrift des Gens (m wie messenger, Bote).")],
  ["trna", "mrna", tx("mRNA and tRNA", "mRNA und tRNA"), tx("The **m**RNA is the copy of the gene. The **t**RNA brings the amino acids.", "Die **m**RNA ist die Abschrift des Gens. Die **t**RNA bringt die Aminosäuren.")],
];

function matchTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(TERMS2).slice(0, 4);
  const rest = TERMS2.filter((x) => !chosen.includes(x));
  const distractor = rng.pick(rest);
  const inLeft = new Set(chosen.map((c) => c.id));
  const inRight = new Set([...chosen.map((c) => c.id), distractor.id]);
  const def = (id: string) => TERMS2.find((x) => x.id === id)!.pair;
  const mistakes: Mistake[] = SWAPS.filter(([a, b]) => inLeft.has(a) && inRight.has(b)).map(([a, b, title, say]) => ({ when: { kind: "match", pairs: [[def(a)[0], def(b)[1]]] }, title, say }));
  return {
    instruction: tx("Match each term to its job", "Ordne jedem Begriff seine Aufgabe zu"),
    answer: { kind: "match", pairs: chosen.map((c) => c.pair), distractors: [distractor.pair[1]] },
    hint: tx("Replication (DNA), transcription (mRNA), translation (ribosome, tRNA).", "Replikation (DNA), Transkription (mRNA), Translation (Ribosom, tRNA)."),
    solution: [{ math: tx('"DNA" \\to "mRNA" \\to "protein"', '"DNA" \\to "mRNA" \\to "Protein"'), note: tx(chosen.map((c) => `**${en(c.pair[0])}**: ${en(c.pair[1])}.`).join(" "), chosen.map((c) => `**${de(c.pair[0])}**: ${de(c.pair[1])}.`).join(" ")) }],
    mistakes,
  };
}

const STEPS2: Text[] = [
  tx("RNA polymerase binds at the start of the gene", "RNA-Polymerase bindet am Anfang des Gens"),
  tx("mRNA is built complementary to the template strand", "mRNA entsteht komplementär zum codogenen Strang"),
  tx("mRNA leaves the nucleus through a nuclear pore", "mRNA verlässt den Zellkern durch eine Kernpore"),
  tx("A ribosome binds and finds the start codon AUG", "Ein Ribosom bindet und findet das Startcodon AUG"),
  tx("tRNAs bring amino acids, peptide bonds link them", "tRNAs bringen Aminosäuren, Peptidbindungen verknüpfen sie"),
  tx("At a stop codon the finished protein is released", "Am Stoppcodon wird das fertige Protein frei"),
];

function orderTask(rng: Rng): Exercise {
  const n = rng.int(4, 5);
  const startAt = rng.int(0, 6 - n);
  const items = STEPS2.slice(startAt, startAt + n);
  const mistakes: Mistake[] = [];
  const has = (i: number) => i >= startAt && i < startAt + n;
  if (has(1) && has(3)) mistakes.push({ when: { kind: "order", items: [STEPS2[3], STEPS2[1]] }, title: tx("Translation first?", "Translation zuerst?"), say: tx("The ribosome needs the mRNA first. Transcription (in the nucleus) always comes before translation.", "Das Ribosom braucht erst die mRNA. Die Transkription (im Zellkern) kommt immer vor der Translation.") });
  if (has(2) && has(3)) mistakes.push({ when: { kind: "order", items: [STEPS2[3], STEPS2[2]] }, title: tx("Ribosomes are outside", "Ribosomen sind draußen"), say: tx("The ribosomes sit in the cytoplasm. So the mRNA has to leave the nucleus before a ribosome can bind.", "Die Ribosomen liegen im Zellplasma. Die mRNA muss also erst den Zellkern verlassen, bevor ein Ribosom binden kann.") });
  if (has(1) && has(2)) mistakes.push({ when: { kind: "order", items: [STEPS2[2], STEPS2[1]] }, title: tx("Built before it leaves", "Erst bauen, dann raus"), say: tx("The mRNA can only leave the nucleus once it has been built.", "Die mRNA kann den Zellkern erst verlassen, wenn sie fertig gebaut ist.") });
  return {
    instruction: tx("Put the steps of protein synthesis in order", "Bring die Schritte der Proteinbiosynthese in die richtige Reihenfolge"),
    answer: { kind: "order", items },
    hint: tx("First transcription in the nucleus, then translation at the ribosome.", "Erst Transkription im Zellkern, dann Translation am Ribosom."),
    solution: [{ math: tx('"transcription" \\to "translation"', '"Transkription" \\to "Translation"'), note: tx("Transcription in the nucleus, transport through a pore, translation at the ribosome until the stop codon.", "Transkription im Zellkern, Transport durch eine Kernpore, Translation am Ribosom bis zum Stoppcodon.") }],
    mistakes,
  };
}

function rnaMultiTask(rng: Rng): Exercise {
  const askRna = rng.chance(0.6);
  const FEAT: { text: Text; rna: boolean; dna: boolean }[] = [
    { text: tx("contains the sugar ribose", "enthält den Zucker Ribose"), rna: true, dna: false },
    { text: tx("contains the sugar deoxyribose", "enthält den Zucker Desoxyribose"), rna: false, dna: true },
    { text: tx("contains uracil", "enthält Uracil"), rna: true, dna: false },
    { text: tx("contains thymine", "enthält Thymin"), rna: false, dna: true },
    { text: tx("is single-stranded", "ist einzelsträngig"), rna: true, dna: false },
    { text: tx("forms a double helix", "bildet eine Doppelhelix"), rna: false, dna: true },
    { text: tx("contains adenine, guanine and cytosine", "enthält Adenin, Guanin und Cytosin"), rna: true, dna: true },
    { text: tx("is built from nucleotides", "ist aus Nukleotiden aufgebaut"), rna: true, dna: true },
  ];
  const pick = rng.shuffle(FEAT).slice(0, 5);
  if (!pick.some((f) => (askRna ? f.rna : f.dna))) pick[0] = FEAT[askRna ? 2 : 3];
  if (pick.every((f) => (askRna ? f.rna : f.dna))) pick[4] = FEAT[askRna ? 3 : 2];
  const opts = [...new Set(pick)];
  const correct = opts.flatMap((f, i) => ((askRna ? f.rna : f.dna) ? [i] : []));
  const mistakes: Mistake[] = [];
  const thy = opts.findIndex((f) => f.text === FEAT[3].text);
  if (askRna && thy >= 0)
    mistakes.push({ when: { kind: "multi", options: opts.map((f) => f.text), correct: [...correct, thy].sort((a, b) => a - b) }, title: tx("RNA has no thymine", "RNA hat kein Thymin"), say: tx("Almost! But RNA has **uracil** instead of thymine.", "Fast! Aber RNA hat **Uracil** statt Thymin.") });
  const uri = opts.findIndex((f) => f.text === FEAT[2].text);
  if (!askRna && uri >= 0)
    mistakes.push({ when: { kind: "multi", options: opts.map((f) => f.text), correct: [...correct, uri].sort((a, b) => a - b) }, title: tx("DNA has no uracil", "DNA hat kein Uracil"), say: tx("Almost! Uracil only occurs in RNA. DNA has thymine.", "Fast! Uracil kommt nur in RNA vor. DNA hat Thymin.") });
  return {
    instruction: tx("Select all that apply", "Wähle alle zutreffenden aus"),
    text: askRna ? tx("Which statements are true for mRNA?", "Welche Aussagen treffen auf die mRNA zu?") : tx("Which statements are true for DNA?", "Welche Aussagen treffen auf die DNA zu?"),
    answer: { kind: "multi", options: opts.map((f) => f.text), correct },
    hint: tx("RNA: ribose, uracil, single strand. DNA: deoxyribose, thymine, double helix.", "RNA: Ribose, Uracil, Einzelstrang. DNA: Desoxyribose, Thymin, Doppelhelix."),
    solution: [{ math: tx('"DNA: deoxyribose, T" \\quad "RNA: ribose, U"', '"DNA: Desoxyribose, T" \\quad "RNA: Ribose, U"'), note: tx("Both are made of nucleotides with A, G and C. RNA has ribose and uracil and is single-stranded.", "Beide bestehen aus Nukleotiden mit A, G und C. RNA hat Ribose und Uracil und ist einzelsträngig.") }],
    mistakes,
  };
}

type Fact = { q: Text; opts: Opt[]; hint: Text; why: Text; key: string };
const FACTS2: Fact[] = [
  {
    q: tx("What does \"the genetic code is degenerate\" mean?", "Was bedeutet „Der genetische Code ist degeneriert“?"),
    opts: [
      { text: tx("most amino acids are coded by several codons", "die meisten Aminosäuren werden von mehreren Codons codiert") },
      { text: tx("one codon can code for several amino acids", "ein Codon kann für mehrere Aminosäuren stehen"), title: tx("The other way round", "Andersherum"), say: tx("The other way round! Each codon is unambiguous: it always means the same amino acid. But one amino acid can have several codons.", "Andersherum! Jedes Codon ist eindeutig: Es bedeutet immer dieselbe Aminosäure. Aber eine Aminosäure kann mehrere Codons haben.") },
      { text: tx("the code gets worse with age", "der Code wird mit dem Alter schlechter") },
      { text: tx("the code is different in every species", "der Code ist bei jeder Art anders"), title: tx("Universal!", "Universell!"), say: tx("The code is almost **universal**: bacteria, plants and humans use the same one.", "Der Code ist nahezu **universell**: Bakterien, Pflanzen und Menschen nutzen denselben.") },
    ],
    hint: tx("Look at the code sun: how many codons lead to leucine?", "Schau in die Codesonne: Wie viele Codons führen zu Leucin?"),
    why: tx("64 codons, but only 20 amino acids: most amino acids have **several codons**.", "64 Codons, aber nur 20 Aminosäuren: Die meisten Aminosäuren haben **mehrere Codons**."),
    key: "\\text{CUU, CUC, CUA, CUG} \\to \\text{Leu}",
  },
  {
    q: tx("Why does a codon consist of three bases?", "Warum besteht ein Codon aus drei Basen?"),
    opts: [
      { text: tx("with 3 bases there are 4³ = 64 combinations, enough for 20 amino acids", "mit 3 Basen gibt es 4³ = 64 Kombinationen, genug für 20 Aminosäuren") },
      { text: tx("with 2 bases there would be enough combinations too", "mit 2 Basen gäbe es auch genug Kombinationen"), title: tx("Count again", "Nachzählen"), say: tx("With 2 bases there are only 4² = 16 combinations: too few for 20 amino acids.", "Mit 2 Basen gibt es nur 4² = 16 Kombinationen: zu wenig für 20 Aminosäuren.") },
      { text: tx("because there are three kinds of RNA", "weil es drei Arten von RNA gibt") },
      { text: tx("because every protein has three parts", "weil jedes Protein drei Teile hat") },
    ],
    hint: tx("4 bases, 20 amino acids. How many places do you need?", "4 Basen, 20 Aminosäuren. Wie viele Stellen brauchst du?"),
    why: tx("$4^2 = 16$ is too few, $4^3 = 64$ is enough for 20 amino acids plus stop signals.", "$4^2 = 16$ ist zu wenig, $4^3 = 64$ reicht für 20 Aminosäuren plus Stoppsignale."),
    key: "4^3 = 64",
  },
  {
    q: tx("Where does transcription take place in an animal cell?", "Wo findet die Transkription in einer Tierzelle statt?"),
    opts: [
      { text: tx("in the nucleus", "im Zellkern") },
      { text: tx("at the ribosomes", "an den Ribosomen"), title: tx("That's translation", "Das ist die Translation"), say: tx("At the ribosomes, translation takes place. Transcription happens where the DNA is: in the nucleus.", "An den Ribosomen findet die Translation statt. Die Transkription passiert dort, wo die DNA ist: im Zellkern.") },
      { text: tx("in the mitochondria only", "nur in den Mitochondrien") },
      { text: tx("in the cell membrane", "in der Zellmembran") },
    ],
    hint: tx("Transcription needs the DNA.", "Für die Transkription braucht man die DNA."),
    why: tx("Transcription takes place in the **nucleus**, translation in the cytoplasm at the ribosomes.", "Die Transkription findet im **Zellkern** statt, die Translation im Zellplasma an den Ribosomen."),
    key: "\\text{DNA} \\to \\text{mRNA}",
  },
  {
    q: tx("What causes sickle cell anaemia?", "Was ist die Ursache der Sichelzellanämie?"),
    opts: [
      { text: tx("a point mutation: in the haemoglobin gene, GAG becomes GTG, so valine replaces glutamic acid", "eine Punktmutation: Im Hämoglobin-Gen wird aus GAG GTG, sodass Valin statt Glutaminsäure eingebaut wird") },
      { text: tx("a missing chromosome", "ein fehlendes Chromosom") },
      { text: tx("a deletion of the whole haemoglobin gene", "eine Deletion des ganzen Hämoglobin-Gens") },
      { text: tx("a lack of iron in food", "Eisenmangel in der Nahrung"), title: tx("Inherited, not eaten", "Vererbt, nicht gegessen"), say: tx("Iron deficiency causes a different anaemia. Sickle cell anaemia is inherited: one base in the gene is changed.", "Eisenmangel verursacht eine andere Anämie. Die Sichelzellanämie ist erblich: Eine Base im Gen ist verändert.") },
    ],
    hint: tx("One single base makes the difference.", "Eine einzige Base macht den Unterschied."),
    why: tx("A **missense mutation**: GAG → GTG, glutamic acid → valine at position 6 of the β chain.", "Eine **Missense-Mutation**: GAG → GTG, Glutaminsäure → Valin an Position 6 der β-Kette."),
    key: "\\text{GAG} \\to \\text{GTG}",
  },
  {
    q: tx("Which codon is the start signal of translation?", "Welches Codon ist das Startsignal der Translation?"),
    opts: [
      { text: tx("AUG (methionine)", "AUG (Methionin)") },
      { text: "$\\text{UAA}$", title: tx("That's a stop", "Das ist ein Stopp"), say: tx("UAA is one of the three **stop** codons. Translation starts at AUG.", "UAA ist eines der drei **Stopp**codons. Die Translation startet bei AUG.") },
      { text: "$\\text{TAC}$", title: tx("DNA, not mRNA", "DNA, nicht mRNA"), say: tx("TAC is the DNA triplet on the template strand. The codon on the mRNA is AUG.", "TAC ist das DNA-Triplett im codogenen Strang. Das Codon auf der mRNA heißt AUG.") },
      { text: "$\\text{UAC}$", title: tx("That's the anticodon", "Das ist das Anticodon"), say: tx("UAC is the anticodon of the start tRNA. The codon itself is AUG.", "UAC ist das Anticodon der Start-tRNA. Das Codon selbst ist AUG.") },
    ],
    hint: tx("Every protein starts with methionine.", "Jedes Protein beginnt mit Methionin."),
    why: tx("**AUG** codes for methionine and marks the start.", "**AUG** codiert Methionin und markiert den Start."),
    key: "\\text{AUG} \\to \\text{Met}",
  },
  {
    q: tx("Why does a frameshift usually do much more damage than an exchange of one base?", "Warum schadet eine Rastermutation meist viel mehr als der Austausch einer Base?"),
    opts: [
      { text: tx("all codons after it are read differently", "alle Codons danach werden anders gelesen") },
      { text: tx("only the start codon is affected", "nur das Startcodon ist betroffen") },
      { text: tx("it always removes the whole gene", "sie entfernt immer das ganze Gen") },
      { text: tx("it changes exactly one amino acid", "sie ändert genau eine Aminosäure"), title: tx("That's a missense", "Das ist Missense"), say: tx("Exactly one amino acid changes with a missense mutation. A frameshift changes everything after it.", "Genau eine Aminosäure ändert sich bei einer Missense-Mutation. Eine Rastermutation ändert alles danach.") },
    ],
    hint: tx("The ribosome reads in steps of three, with no commas.", "Das Ribosom liest in Dreierschritten, ohne Kommas."),
    why: tx("The code is read without gaps: after an insertion or deletion, **every following triplet** is shifted.", "Der Code wird lückenlos gelesen: Nach einer Insertion oder Deletion ist **jedes folgende Triplett** verschoben."),
    key: "\\text{AUG GCU UCG GA…}",
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS2);
  const ch = choiceOf(rng, f.opts);
  return { instruction: tx("Choose the right answer", "Wähle die richtige Antwort"), text: f.q, answer: ch.answer, hint: f.hint, solution: [{ math: f.key, note: f.why }], mistakes: ch.mistakes };
}

// ---------------------------------------------------------------------------
// Practice

const SHAPES: [number, (rng: Rng) => Exercise][] = [
  [3, transcribeGen],
  [2, codonTask],
  [1.5, (rng) => anticodonTask(senseCodon(rng))],
  [2, (rng) => translateTask(rng)],
  [1.5, countAaTask],
  [2.5, mutationTask],
  [1, indelTask],
  [1.5, hbondTask],
  [1, gcTask],
  [1.5, meselsonTask],
  [1, nucleotideFigureTask],
  [1.2, matchTask],
  [1, orderTask],
  [1, rnaMultiTask],
  [1.5, factTask],
];

export function generate2(rng: Rng): Exercise {
  const total = SHAPES.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, make] of SHAPES) if ((r -= w) < 0) return make(rng);
  return SHAPES[0][1](rng);
}

// ---------------------------------------------------------------------------
// Lesson

const checkTranslate = translateTask(createRng(11), { lead: "GC", body: ["AUG", "GGA", "UUC"], stop: "UAG", after: "CCA" });
const checkMutation = mutationExercise(
  { before: ["AUG", "CCU", "GAG", "GAG"], after: ["AUG", "CCU", "GUG", "GAG"], at: 2, type: "missense", from: "GAG", to: "GUG", note: tx("In codon 3, GAG became GUG.", "In Codon 3 wurde aus GAG GUG.") },
  createRng(5),
);

/** The nucleotide drawing as a tap-to-explore widget. */
function NucleotideExplore() {
  return <DnaNucleotide mode="explore" />;
}

export const level2: LevelLesson = {
  lesson: [
    {
      type: "widget",
      title: tx("Nucleotides: the building blocks", "Nukleotide: die Bausteine"),
      blob: tx("Time to look closer at the ladder. Tap the parts!", "Zeit für einen genaueren Blick auf die Leiter. Tipp die Teile an!"),
      body: tx(
        "DNA is a chain of **nucleotides**. Each one has three parts: a **phosphate group**, the sugar **deoxyribose** and one of the four **bases**. Sugar and phosphate form the **backbone**, the bases point inwards.",
        "Die DNA ist eine Kette aus **Nukleotiden**. Jedes besteht aus drei Teilen: einem **Phosphatrest**, dem Zucker **Desoxyribose** und einer der vier **Basen**. Zucker und Phosphat bilden das **Rückgrat**, die Basen zeigen nach innen.",
      ),
      widget: NucleotideExplore,
    },
    {
      type: "explain",
      title: tx("Two strands, running in opposite directions", "Zwei gegenläufige Stränge"),
      blob: tx("5′ and 3′ sound strange, but you'll need them all the time.", "5′ und 3′ klingen komisch, aber du brauchst sie ständig."),
      frames: [
        {
          math: pairs("ATG", "TAC"),
          note: tx("The bases are held together by **hydrogen bonds**: weak bonds that can open easily, like a zip.", "Die Basen werden durch **Wasserstoffbrücken** zusammengehalten: schwache Bindungen, die sich leicht öffnen lassen, wie ein Reißverschluss."),
        },
        {
          math: "\\text{A=T} \\quad \\text{G≡C}",
          note: tx("**A–T: 2** hydrogen bonds, **G–C: 3** hydrogen bonds. So G–C pairs hold together more tightly.", "**A–T: 2** Wasserstoffbrücken, **G–C: 3** Wasserstoffbrücken. G–C-Paare halten also fester zusammen."),
        },
        {
          math: pairs("ATG", "TAC", { ends: ["5′", "3′", "3′", "5′"] }),
          note: tx("Each strand has a direction, from its **5′ end** to its **3′ end** (named after the carbon atoms of the sugar). The two strands run **antiparallel**: one 5′→3′, the other 3′→5′.", "Jeder Strang hat eine Richtung, vom **5′-Ende** zum **3′-Ende** (benannt nach den C-Atomen des Zuckers). Die beiden Stränge verlaufen **antiparallel**: einer 5′→3′, der andere 3′→5′."),
        },
        {
          math: "2 + 2 + 3 = 7",
          note: tx("Counting for ATG / TAC: A–T 2, T–A 2, G–C 3, so **7 hydrogen bonds**.", "Gezählt für ATG / TAC: A–T 2, T–A 2, G–C 3, also **7 Wasserstoffbrücken**."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Replication: copying DNA", "Replikation: DNA wird kopiert"),
      blob: tx("Before a cell divides, it copies all its DNA. But how exactly?", "Bevor sich eine Zelle teilt, kopiert sie ihre ganze DNA. Aber wie genau?"),
      body: tx(
        "The enzyme **helicase** unwinds the double helix and separates the two strands. **DNA polymerase** then adds complementary nucleotides to each old strand. Each new molecule has one old and one new strand: replication is **semiconservative**. Meselson and Stahl proved this in 1958 with heavy nitrogen. Step through the generations and compare the three models.",
        "Das Enzym **Helikase** entwindet die Doppelhelix und trennt die beiden Stränge. Die **DNA-Polymerase** ergänzt dann an jedem alten Strang komplementäre Nukleotide. Jedes neue Molekül hat einen alten und einen neuen Strang: Die Replikation ist **semikonservativ**. Meselson und Stahl bewiesen das 1958 mit schwerem Stickstoff. Geh die Generationen durch und vergleich die drei Modelle.",
      ),
      widget: DnaReplication,
    },
    {
      type: "explain",
      title: tx("Transcription: DNA → mRNA", "Transkription: DNA → mRNA"),
      blob: tx("The DNA stays safe in the nucleus. A copy goes out to work.", "Die DNA bleibt sicher im Zellkern. Eine Abschrift geht arbeiten."),
      body: tx(
        "Proteins are made at the ribosomes, outside the nucleus. So first a working copy of the gene is made: the **mRNA** (messenger RNA). This is **transcription**.",
        "Proteine entstehen an den Ribosomen, außerhalb des Zellkerns. Deshalb wird zuerst eine Arbeitskopie des Gens hergestellt: die **mRNA** (Boten-RNA, messenger RNA). Das ist die **Transkription**.",
      ),
      frames: [
        {
          math: pairs("ATGGCA", "TACCGT", { ends: ["5′", "3′", "3′", "5′"], key: "d" }),
          note: tx("**RNA polymerase** opens the DNA at a gene. Only one strand is read: the **template strand** (codogenic strand), here at the bottom.", "Die **RNA-Polymerase** öffnet die DNA an einem Gen. Abgelesen wird nur ein Strang: der **codogene Strang** (Matrizenstrang), hier unten."),
        },
        {
          math: pairs("TACCGT", "AUGGCA", { ends: ["3′", "5′", "5′", "3′"], key: "r", mark: [1] }),
          note: tx("It builds the mRNA complementary to it, from 5′ to 3′. Important: RNA contains **uracil (U)** instead of thymine. Opposite A comes U.", "Sie baut die mRNA komplementär dazu, von 5′ nach 3′. Wichtig: RNA enthält **Uracil (U)** statt Thymin. Gegenüber von A kommt U."),
        },
        {
          math: `\\text{5′-ATGGCA-3′} \\\\ \\text{5′-AUGGCA-3′}`,
          note: tx("Compare: the mRNA has the same sequence as the other strand, the **coding strand**, just with U instead of T.", "Vergleich: Die mRNA hat dieselbe Basenfolge wie der andere Strang, der **codierende Strang**, nur mit U statt T."),
        },
        {
          math: tx('"DNA:" \\; "deoxyribose, T, double strand" \\\\ "RNA:" \\; "ribose, U, single strand"', '"DNA:" \\; "Desoxyribose, T, Doppelstrang" \\\\ "RNA:" \\; "Ribose, U, Einzelstrang"'),
          note: tx("RNA differs from DNA in three ways: the sugar **ribose**, the base **uracil**, and it is **single-stranded**. The mRNA leaves the nucleus through the nuclear pores.", "RNA unterscheidet sich in drei Punkten von DNA: Zucker **Ribose**, Base **Uracil**, und sie ist **einzelsträngig**. Die mRNA verlässt den Zellkern durch die Kernporen."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Watch the RNA polymerase", "Schau der RNA-Polymerase zu"),
      blob: tx("Step through it base by base. Watch out for the U!", "Geh Base für Base durch. Achte auf das U!"),
      body: tx("The polymerase moves along the template strand and adds one RNA nucleotide at a time.", "Die Polymerase wandert am codogenen Strang entlang und hängt ein RNA-Nukleotid nach dem anderen an."),
      widget: DnaTranscription,
    },
    {
      type: "check",
      blob: tx("Now you are the RNA polymerase!", "Jetzt bist du die RNA-Polymerase!"),
      exercise: transcribeTask("ATGGCT", "template"),
    },
    {
      type: "widget",
      title: tx("The genetic code", "Der genetische Code"),
      blob: tx("64 codons, 20 amino acids. Let's read the code sun!", "64 Codons, 20 Aminosäuren. Lass uns die Codesonne lesen!"),
      body: tx(
        "Three bases of the mRNA, a **codon** (triplet), stand for one amino acid. Read the code sun **from the inside out**: 1st base in the middle, 2nd in the middle ring, 3rd outside. **AUG** is the start codon (methionine), **UAA, UAG, UGA** are stop codons. The code is **degenerate** (most amino acids have several codons), **unambiguous** and almost **universal**: bacteria and humans use the same code.",
        "Drei Basen der mRNA, ein **Codon** (Triplett), stehen für eine Aminosäure. Lies die Codesonne **von innen nach außen**: 1. Base in der Mitte, 2. im mittleren Ring, 3. außen. **AUG** ist das Startcodon (Methionin), **UAA, UAG, UGA** sind Stoppcodons. Der Code ist **degeneriert** (die meisten Aminosäuren haben mehrere Codons), **eindeutig** und nahezu **universell**: Bakterien und Menschen nutzen denselben Code.",
      ),
      widget: DnaCodeSun,
    },
    {
      type: "widget",
      title: tx("Translation at the ribosome", "Translation am Ribosom"),
      blob: tx("Codon by codon, the protein grows. Press Next!", "Codon für Codon wächst das Protein. Drück auf Weiter!"),
      body: tx(
        "At the **ribosome** the mRNA is translated into a chain of amino acids. **tRNAs** bring the amino acids. Each tRNA has an **anticodon** that pairs with exactly one codon. Neighbouring amino acids are linked by **peptide bonds**.",
        "Am **Ribosom** wird die mRNA in eine Kette aus Aminosäuren übersetzt. **tRNAs** bringen die Aminosäuren. Jede tRNA hat ein **Anticodon**, das genau zu einem Codon passt. Benachbarte Aminosäuren werden durch **Peptidbindungen** verknüpft.",
      ),
      widget: DnaRibosome,
    },
    {
      type: "check",
      blob: tx("Translate it yourself. Where does the ribosome start?", "Übersetz selbst. Wo fängt das Ribosom an?"),
      exercise: checkTranslate,
    },
    {
      type: "explain",
      title: tx("Mutations", "Mutationen"),
      blob: tx("One wrong letter, and what happens? It depends!", "Ein falscher Buchstabe, und was passiert? Kommt drauf an!"),
      body: tx("A **mutation** is a change in the DNA. **Point mutations** change a single base; **frameshift mutations** insert or delete bases.", "Eine **Mutation** ist eine Veränderung der DNA. **Punktmutationen** verändern eine einzelne Base; bei **Rastermutationen** werden Basen eingefügt (Insertion) oder entfernt (Deletion)."),
      frames: [
        { math: `\\text{AUG}#c1 \\; \\text{CCU}#c2 \\; \\text{GAG}#c3 \\; \\text{GAG}#c4 \\\\ \\text{Met}#a1 \\; \\text{Pro}#a2 \\; \\text{Glu}#a3 \\; \\text{Glu}#a4`, note: tx("The start of an mRNA and its amino acids.", "Der Anfang einer mRNA und ihre Aminosäuren.") },
        {
          math: `\\text{AUG}#c1 \\; \\text{CCU}#c2 \\; \\text{GAG}#c3 \\; \\hl{\\text{GAA}#c4} \\\\ \\text{Met}#a1 \\; \\text{Pro}#a2 \\; \\text{Glu}#a3 \\; \\text{Glu}#a4`,
          note: tx("**Silent mutation**: GAG → GAA still codes for glutamic acid. The protein stays the same, because the code is degenerate.", "**Stumme Mutation**: GAG → GAA codiert immer noch Glutaminsäure. Das Protein bleibt gleich, weil der Code degeneriert ist."),
        },
        {
          math: `\\text{AUG}#c1 \\; \\text{CCU}#c2 \\; \\hl{\\text{GUG}#c3} \\; \\text{GAG}#c4 \\\\ \\text{Met}#a1 \\; \\text{Pro}#a2 \\; \\hl{\\text{Val}#a3} \\; \\text{Glu}#a4`,
          note: tx("**Missense mutation**: GAG → GUG, valine instead of glutamic acid. Exactly this happens in **sickle cell anaemia**: the haemoglobin clumps, red blood cells become sickle-shaped.", "**Missense-Mutation**: GAG → GUG, Valin statt Glutaminsäure. Genau das passiert bei der **Sichelzellanämie**: Das Hämoglobin verklumpt, die roten Blutzellen werden sichelförmig."),
        },
        {
          math: tx(
            `\\text{AUG}#c1 \\; \\text{CCU}#c2 \\; \\hl{\\text{UAG}#c3} \\; \\text{GAG}#c4 \\\\ \\text{Met}#a1 \\; \\text{Pro}#a2 \\; \\hl{"stop"#a3}`,
            `\\text{AUG}#c1 \\; \\text{CCU}#c2 \\; \\hl{\\text{UAG}#c3} \\; \\text{GAG}#c4 \\\\ \\text{Met}#a1 \\; \\text{Pro}#a2 \\; \\hl{"Stopp"#a3}`,
          ),
          note: tx("**Nonsense mutation**: GAG → UAG is a stop codon. The protein breaks off and is usually useless.", "**Nonsense-Mutation**: GAG → UAG ist ein Stoppcodon. Das Protein bricht ab und ist meist funktionslos."),
        },
        {
          math: `\\text{AUG}#c1 \\; \\text{CCU}#c2 \\; \\hl{\\text{AGG}#c3} \\; \\hl{\\text{AG…}#c4} \\\\ \\text{Met}#a1 \\; \\text{Pro}#a2 \\; \\hl{\\text{Arg}#a3} \\; \\text{…}#a4`,
          note: tx("**Frameshift**: one G deleted. From there every triplet is read wrongly. Careful: if 3 bases are deleted, only one codon is missing and the frame stays!", "**Rastermutation**: ein G deletiert. Ab da wird jedes Triplett falsch gelesen. Vorsicht: Fehlen 3 Basen, fehlt nur ein Codon, und das Raster bleibt erhalten!"),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Mutation lab", "Mutationslabor"),
      blob: tx("Go on, break the gene! What happens to the protein?", "Los, mach das Gen kaputt! Was passiert mit dem Protein?"),
      body: tx(
        "Here is the start of the gene for the β chain of haemoglobin. Exchange, insert or delete bases in the DNA and watch the mRNA and the protein. Try deleting three bases in a row!",
        "Hier siehst du den Anfang des Gens für die β-Kette des Hämoglobins. Tausch Basen in der DNA aus, füge welche ein oder lösch sie, und beobachte mRNA und Protein. Probier mal, drei Basen hintereinander zu löschen!",
      ),
      widget: DnaMutation,
    },
    {
      type: "check",
      blob: tx("Last one. Which kind of mutation is this?", "Die letzte. Welche Art von Mutation ist das?"),
      exercise: checkMutation,
    },
  ],
  summary: [
    {
      title: tx("Nucleotides and structure", "Nukleotide und Bau"),
      body: tx("Nucleotide = phosphate + deoxyribose + base. A=T: 2 hydrogen bonds, G≡C: 3. The strands run antiparallel (5′→3′ and 3′→5′).", "Nukleotid = Phosphat + Desoxyribose + Base. A=T: 2 Wasserstoffbrücken, G≡C: 3. Die Stränge verlaufen antiparallel (5′→3′ und 3′→5′)."),
      examples: [pairs("ATG", "TAC", { ends: ["5′", "3′", "3′", "5′"] })],
      tone: "rule",
    },
    {
      title: tx("Replication is semiconservative", "Replikation ist semikonservativ"),
      body: tx("Helicase separates the strands, DNA polymerase adds complementary nucleotides. Each new double strand = one old + one new strand (Meselson and Stahl).", "Die Helikase trennt die Stränge, die DNA-Polymerase ergänzt komplementär. Jeder neue Doppelstrang = ein alter + ein neuer Strang (Meselson und Stahl)."),
      tone: "rule",
    },
    {
      title: tx("Transcription (nucleus)", "Transkription (Zellkern)"),
      body: tx("RNA polymerase reads the template strand 3′→5′ and builds the mRNA 5′→3′, with U instead of T. mRNA = coding strand with U.", "Die RNA-Polymerase liest den codogenen Strang 3′→5′ und baut die mRNA 5′→3′, mit U statt T. mRNA = codierender Strang mit U."),
      examples: [pairs("TAC", "AUG", { ends: ["3′", "5′", "5′", "3′"] })],
      tone: "rule",
    },
    {
      title: tx("Translation and the genetic code", "Translation und genetischer Code"),
      body: tx("At the ribosome, tRNAs with matching anticodons bring amino acids; peptide bonds link them. Codon = triplet. Start: AUG (Met). Stop: UAA, UAG, UGA. The code is degenerate and universal.", "Am Ribosom bringen tRNAs mit passendem Anticodon die Aminosäuren; Peptidbindungen verknüpfen sie. Codon = Triplett. Start: AUG (Met). Stopp: UAA, UAG, UGA. Der Code ist degeneriert und universell."),
      examples: [`${seq("AUGGGAUUCUAG", true)} \\to \\text{Met–Gly–Phe}`],
      tone: "rule",
    },
    {
      title: tx("Mutations", "Mutationen"),
      body: tx("Point mutation: silent (same amino acid), missense (other amino acid, e.g. sickle cell anaemia GAG → GTG), nonsense (stop codon). Insertion or deletion of 1 or 2 bases: frameshift.", "Punktmutation: stumm (gleiche Aminosäure), Missense (andere Aminosäure, z. B. Sichelzellanämie GAG → GTG), Nonsense (Stoppcodon). Insertion oder Deletion von 1 oder 2 Basen: Rastermutation."),
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Klassische Fallen"),
      body: tx("mRNA never contains T. The codon is on the mRNA, the anticodon on the tRNA. Read the template strand, not the coding strand. Deleting 3 bases removes one codon: no frameshift.", "mRNA enthält nie T. Das Codon sitzt auf der mRNA, das Anticodon auf der tRNA. Abgelesen wird der codogene Strang, nicht der codierende. 3 deletierte Basen entfernen ein Codon: kein Rasterschub."),
      tone: "warning",
    },
  ],
};
