"use client";

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { GeneticsAlleleLab } from "@/learn/biology/visuals/GeneticsAlleleLab";
import { GeneticsChromosomes, GeneticsChromosomesExplore } from "@/learn/biology/visuals/GeneticsChromosomes";
import { PeaPlant } from "@/learn/biology/visuals/GeneticsPea";
import { GeneticsPunnettP } from "@/learn/biology/visuals/GeneticsPunnett";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { ALL_TRAITS, dominanceLine, PEA_TRAITS, peaLook, TRAITS, type TraitId } from "./data";
import { choice, count, matchTask, mistakeList, multi, weighted, type Opt } from "./kit";

const E = (t: Text) => resolveText(t, "en");
const D = (t: Text) => resolveText(t, "de");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const visual = (component: unknown, props: Record<string, unknown>) => ({ component: component as ComponentType<Record<string, unknown>>, props });

/** "A pea plant" / "Eine Erbsenpflanze", with the matching pronoun. */
function subject(id: TraitId) {
  return id === "fur" ? { a: tx("A guinea pig", "Ein Meerschweinchen"), it: tx("it", "es") } : { a: tx("A pea plant", "Eine Erbsenpflanze"), it: tx("it", "sie") };
}

// ---------------------------------------------------------------------------
// 1. Genotype → phenotype

function phenoExercise(rng: Rng | null, id: TraitId, g: string): Exercise {
  const t = TRAITS[id];
  const L = t.letter;
  const l = L.toLowerCase();
  const dom = g.includes(L);
  const s = subject(id);
  const opts: Opt[] = [
    { text: dom ? t.hasDom : t.hasRec },
    dom
      ? {
          text: t.hasRec,
          title: g === L + l ? tx("The capital letter wins", "Der Großbuchstabe gewinnt") : tx("No recessive allele here", "Hier ist kein rezessives Allel"),
          say:
            g === L + l
              ? tx(`The recessive allele $${l}$ is there, but hidden. In $${L}${l}$ the dominant $${L}$ decides what you see.`, `Das rezessive Allel $${l}$ ist zwar da, aber verborgen. Bei $${L}${l}$ bestimmt das dominante $${L}$, was man sieht.`)
              : tx(`Two capital letters: both alleles are dominant. There's no recessive $${l}$ in this plant at all.`, `Zwei Großbuchstaben: Beide Allele sind dominant. Ein rezessives $${l}$ gibt es hier gar nicht.`),
        }
      : {
          text: t.hasDom,
          title: tx("Two small letters", "Zwei Kleinbuchstaben"),
          say: tx(`$${l}${l}$ means two recessive alleles. That's exactly when the recessive trait shows, and no dominant $${L}$ can cover it.`, `$${l}${l}$ heißt: zwei rezessive Allele. Genau dann zeigt sich das rezessive Merkmal, kein dominantes $${L}$ kann es überdecken.`),
        },
    {
      text: tx("a mix of both forms", "eine Mischform aus beidem"),
      title: tx("Nothing gets mixed", "Hier mischt sich nichts"),
      say: dom
        ? tx("In dominant-recessive inheritance nothing is blended: the dominant allele shows completely. In-between forms only appear in intermediate inheritance.", "Beim dominant-rezessiven Erbgang wird nichts gemischt: Das dominante Allel setzt sich ganz durch. Mischformen gibt es nur beim intermediären Erbgang.")
        : tx(`With $${l}${l}$ there are only recessive alleles, so there's nothing to mix.`, `Bei $${l}${l}$ gibt es nur rezessive Allele, da kann sich nichts mischen.`),
    },
    {
      text: tx("can't be told from the genotype", "lässt sich am Genotyp nicht erkennen"),
      title: tx("It works this way round", "Andersherum klappt's"),
      say: tx("From the phenotype you often can't read the genotype. But the genotype always tells you the phenotype, once you know which allele is dominant.", "Vom Phänotyp kann man oft nicht auf den Genotyp schließen. Aber der Genotyp verrät immer den Phänotyp, wenn man weiß, welches Allel dominant ist."),
    },
  ];
  const c = choice(rng, opts);
  const look = dom ? t.dom : t.rec;
  return {
    instruction: tx("From genotype to phenotype", "Vom Genotyp zum Phänotyp"),
    text: tx(`${E(dominanceLine(t))} ${E(s.a)} has the genotype $${g}$. What is its phenotype?`, `${D(dominanceLine(t))} ${D(s.a)} hat den Genotyp $${g}$. Welchen Phänotyp hat ${D(s.it)}?`),
    answer: c.answer,
    hint: tx(`Is there at least one capital $${L}$? Then the dominant trait shows.`, `Ist mindestens ein großes $${L}$ dabei? Dann zeigt sich das dominante Merkmal.`),
    solution: [
      {
        math: tx(`${g} \\to "${E(look)}"`, `${g} \\to "${D(look)}"`),
        note: dom
          ? g === L + L
            ? tx(`Two dominant alleles $${L}$: the phenotype is **${E(t.hasDom)}**.`, `Zwei dominante Allele $${L}$: Der Phänotyp ist **${D(t.hasDom)}**.`)
            : tx(`One dominant $${L}$ is enough. The recessive $${l}$ stays hidden: **${E(t.hasDom)}**.`, `Ein dominantes $${L}$ reicht. Das rezessive $${l}$ bleibt verborgen: **${D(t.hasDom)}**.`)
          : tx(`Only recessive alleles, so the recessive trait shows: **${E(t.hasRec)}**.`, `Nur rezessive Allele, also zeigt sich das rezessive Merkmal: **${D(t.hasRec)}**.`),
      },
    ],
    mistakes: c.mistakes,
  };
}

function phenoTask(rng: Rng) {
  const id = rng.pick(ALL_TRAITS);
  const L = TRAITS[id].letter;
  const g = rng.pick([L + L, L + L.toLowerCase(), L + L.toLowerCase(), L.toLowerCase() + L.toLowerCase()]);
  return phenoExercise(rng, id, g);
}

// ---------------------------------------------------------------------------
// 2. Phenotype (picture) → possible genotypes

function genoMultiTask(rng: Rng): Exercise {
  const id = rng.pick(PEA_TRAITS);
  const t = TRAITS[id];
  const L = t.letter;
  const l = L.toLowerCase();
  const dom = rng.chance(0.6);
  const opts = [
    { text: `$${L}${L}$`, ok: dom },
    { text: `$${L}${l}$`, ok: dom },
    { text: `$${l}${l}$`, ok: !dom },
  ];
  const wrong = dom
    ? [
        { pick: [0], title: tx("Mixed ones look the same", "Mischerbige sehen gleich aus"), say: tx(`Ooh, $${L}${l}$ looks exactly the same! The hidden recessive allele doesn't change the phenotype.`, `Oh, $${L}${l}$ sieht genauso aus! Das verborgene rezessive Allel ändert nichts am Phänotyp.`) },
        { pick: [1], title: tx("Pure-breeding counts too", "Reinerbig zählt auch"), say: tx(`$${L}${L}$ shows the dominant trait too: it has two dominant alleles.`, `Auch $${L}${L}$ zeigt das dominante Merkmal: Es hat sogar zwei dominante Allele.`) },
      ]
    : [{ pick: [1, 2], title: tx("Dominant would win", "Dominant würde gewinnen"), say: tx(`In $${L}${l}$ the dominant $${L}$ would show. A recessive trait means: two recessive alleles.`, `Bei $${L}${l}$ würde sich das dominante $${L}$ zeigen. Ein rezessives Merkmal heißt: zwei rezessive Allele.`) }];
  const m = multi(rng, opts, wrong);
  return {
    instruction: tx("Select all possible genotypes", "Wähle alle möglichen Genotypen"),
    text: tx(`${E(dominanceLine(t))} This plant has ${E(dom ? t.hasDom : t.hasRec)}. Which genotypes can it have?`, `${D(dominanceLine(t))} Diese Pflanze hat ${D(dom ? t.hasDom : t.hasRec)}. Welche Genotypen kann sie haben?`),
    visual: visual(PeaPlant, peaLook(id, dom)),
    answer: m.answer,
    hint: tx("Which genotypes have at least one dominant allele?", "Welche Genotypen haben mindestens ein dominantes Allel?"),
    solution: dom
      ? [
          { math: tx(`${L}${L} \\to "${E(t.dom)}" \\quad ${L}${l} \\to "${E(t.dom)}"`, `${L}${L} \\to "${D(t.dom)}" \\quad ${L}${l} \\to "${D(t.dom)}"`), note: tx(`Both $${L}${L}$ and $${L}${l}$ look ${E(t.dom)}: one dominant allele is enough.`, `$${L}${L}$ und $${L}${l}$ sehen beide ${D(t.dom)} aus: Ein dominantes Allel reicht.`) },
          { math: tx(`${l}${l} \\to "${E(t.rec)}"`, `${l}${l} \\to "${D(t.rec)}"`), note: tx(`Only $${l}${l}$ would look different. So: **$${L}${L}$ or $${L}${l}$**. From the picture alone you can't tell which.`, `Nur $${l}${l}$ sähe anders aus. Also: **$${L}${L}$ oder $${L}${l}$**. Am Bild allein kann man das nicht unterscheiden.`) },
        ]
      : [{ math: tx(`"${E(t.rec)}" \\Rightarrow ${l}${l}`, `"${D(t.rec)}" \\Rightarrow ${l}${l}`), note: tx(`A recessive trait only shows with two recessive alleles: **$${l}${l}$**. Here you know the genotype for sure.`, `Ein rezessives Merkmal zeigt sich nur mit zwei rezessiven Allelen: **$${l}${l}$**. Hier kennst du den Genotyp sicher.`) }],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// 3. Homozygous or heterozygous? (match)

const HOM_DOM = tx("homozygous (pure-breeding), dominant", "reinerbig (homozygot), dominant");
const HET = tx("heterozygous (mixed)", "mischerbig (heterozygot)");
const HOM_REC = tx("homozygous (pure-breeding), recessive", "reinerbig (homozygot), rezessiv");

function zygosityTask(rng: Rng): Exercise {
  const [a, b, c] = rng.shuffle(ALL_TRAITS).map((id) => TRAITS[id].letter);
  const gd = `$${a}${a}$`;
  const gh = `$${b}${b.toLowerCase()}$`;
  const gr = `$${c.toLowerCase()}${c.toLowerCase()}$`;
  const pairs = rng.shuffle([
    [gd, HOM_DOM],
    [gh, HET],
    [gr, HOM_REC],
  ] as [Text, Text][]);
  const m = matchTask(pairs, [], [
    { pairs: [[gh, HOM_DOM]], title: tx("Mixed means different", "Mischerbig heißt verschieden"), say: tx("Two **different** alleles (one capital, one small) make a plant heterozygous, even if it shows the dominant trait.", "Zwei **verschiedene** Allele (ein großer, ein kleiner Buchstabe) machen mischerbig, auch wenn sich das dominante Merkmal zeigt.") },
    { pairs: [[gr, HET]], title: tx("Small letters can be pure", "Auch Kleine sind reinerbig"), say: tx("Two equal letters mean homozygous (pure-breeding), even when both are small.", "Zwei gleiche Buchstaben heißen reinerbig, auch wenn beide klein sind.") },
    { pairs: [[gd, HET]], title: tx("Two equal alleles", "Zwei gleiche Allele"), say: tx(`$${a}${a}$ has two identical alleles: that's homozygous, not mixed.`, `$${a}${a}$ hat zwei gleiche Allele: Das ist reinerbig, nicht mischerbig.`) },
  ]);
  return {
    instruction: tx("Match each genotype", "Ordne jedem Genotyp den Begriff zu"),
    text: tx("Capital letter = dominant allele, small letter = recessive allele. Which term fits each genotype?", "Großbuchstabe = dominantes Allel, Kleinbuchstabe = rezessives Allel. Welcher Begriff passt zu welchem Genotyp?"),
    answer: m.answer,
    hint: tx("Same letters twice: homozygous. Two different letters: heterozygous.", "Zweimal derselbe Buchstabe: reinerbig. Zwei verschiedene: mischerbig."),
    solution: [
      { math: tx(`${a}${a} \\quad ${c.toLowerCase()}${c.toLowerCase()} \\to "homozygous"`, `${a}${a} \\quad ${c.toLowerCase()}${c.toLowerCase()} \\to "reinerbig"`), note: tx("Two equal alleles: **homozygous** (pure-breeding), dominant with capitals, recessive with small letters.", "Zwei gleiche Allele: **reinerbig** (homozygot), dominant bei großen, rezessiv bei kleinen Buchstaben.") },
      { math: tx(`${b}${b.toLowerCase()} \\to "heterozygous"`, `${b}${b.toLowerCase()} \\to "mischerbig"`), note: tx("Two different alleles: **heterozygous** (mixed).", "Zwei verschiedene Allele: **mischerbig** (heterozygot).") },
    ],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// 4./5. Terms

type Term = { id: string; term: Text; def: Text; accept: Text[]; partner?: string };

const TERMS: Term[] = [
  { id: "gene", term: tx("gene", "Gen"), def: tx("a section of DNA with the information for one trait", "ein DNA-Abschnitt mit der Information für ein Merkmal"), accept: [tx("gene", "Gen"), "Gene", "genes"], partner: "allele" },
  { id: "allele", term: tx("allele", "Allel"), def: tx("one of the variants of a gene, e.g. A or a", "eine der Varianten eines Gens, z. B. A oder a"), accept: [tx("allele", "Allel"), "Allele", "alleles"], partner: "gene" },
  { id: "genotype", term: tx("genotype", "Genotyp"), def: tx("the combination of alleles of an organism, e.g. Aa", "die Kombination der Allele eines Lebewesens, z. B. Aa"), accept: [tx("genotype", "Genotyp"), "Genotypus"], partner: "phenotype" },
  { id: "phenotype", term: tx("phenotype", "Phänotyp"), def: tx("the appearance: all the traits you can observe", "das Erscheinungsbild: alle Merkmale, die man beobachten kann"), accept: [tx("phenotype", "Phänotyp"), "Erscheinungsbild", "Phänotypus"], partner: "genotype" },
  { id: "dominant", term: tx("dominant allele", "dominantes Allel"), def: tx("an allele that shows even when it is there only once", "ein Allel, das sich schon zeigt, wenn es nur einmal vorhanden ist"), accept: ["dominant", tx("dominant allele", "dominantes Allel")], partner: "recessive" },
  { id: "recessive", term: tx("recessive allele", "rezessives Allel"), def: tx("an allele that only shows when it is there twice", "ein Allel, das sich nur zeigt, wenn es doppelt vorhanden ist"), accept: [tx("recessive", "rezessiv"), tx("recessive allele", "rezessives Allel")], partner: "dominant" },
  { id: "homo", term: tx("homozygous", "homozygot (reinerbig)"), def: tx("both alleles of a gene are the same", "beide Allele eines Gens sind gleich"), accept: [tx("homozygous", "homozygot"), "reinerbig", "pure-breeding", "true-breeding"], partner: "hetero" },
  { id: "hetero", term: tx("heterozygous", "heterozygot (mischerbig)"), def: tx("the two alleles of a gene are different", "die beiden Allele eines Gens sind verschieden"), accept: [tx("heterozygous", "heterozygot"), "mischerbig"], partner: "homo" },
  { id: "chromosome", term: tx("chromosome", "Chromosom"), def: tx("a carrier of genes in the cell nucleus, made of DNA", "ein Träger der Gene im Zellkern, aus DNA aufgebaut"), accept: [tx("chromosome", "Chromosom"), "Chromosomen", "chromosomes"] },
  { id: "trait", term: tx("trait", "Merkmal"), def: tx("a feature of an organism, e.g. its flower colour", "eine Eigenschaft eines Lebewesens, z. B. die Blütenfarbe"), accept: [tx("trait", "Merkmal"), "Merkmale", "characteristic"] },
  { id: "gamete", term: tx("gamete", "Keimzelle"), def: tx("an egg or sperm cell with only one allele of each gene", "eine Ei- oder Spermienzelle mit nur einem Allel jedes Gens"), accept: [tx("gamete", "Keimzelle"), "Gamet", "Gameten", "Keimzellen", "gametes", "Geschlechtszelle", "sex cell"] },
];
const termById = (id: string) => TERMS.find((t) => t.id === id)!;

const CONFUSE: Record<string, [Text, Text]> = {
  gene: [tx("Gene vs allele", "Gen oder Allel?"), tx("Close! The **gene** is the section for a trait, an **allele** is one of its variants ($A$ or $a$).", "Knapp! Das **Gen** ist der Abschnitt für ein Merkmal, ein **Allel** ist eine seiner Varianten ($A$ oder $a$).")],
  allele: [tx("Gene vs allele", "Gen oder Allel?"), tx("Close! The **gene** is the section for a trait, an **allele** is one of its variants ($A$ or $a$).", "Knapp! Das **Gen** ist der Abschnitt für ein Merkmal, ein **Allel** ist eine seiner Varianten ($A$ oder $a$).")],
  genotype: [tx("Genotype vs phenotype", "Genotyp oder Phänotyp?"), tx("Classic mix-up! **Genotype** = the alleles ($Aa$), **phenotype** = what you see (purple flowers). Remember: phenotype, like a photo.", "Die klassische Verwechslung! **Genotyp** = die Allele ($Aa$), **Phänotyp** = was man sieht (violette Blüten). Merk dir: Phänotyp wie Foto.")],
  phenotype: [tx("Genotype vs phenotype", "Genotyp oder Phänotyp?"), tx("Classic mix-up! **Genotype** = the alleles ($Aa$), **phenotype** = what you see (purple flowers). Remember: phenotype, like a photo.", "Die klassische Verwechslung! **Genotyp** = die Allele ($Aa$), **Phänotyp** = was man sieht (violette Blüten). Merk dir: Phänotyp wie Foto.")],
  dominant: [tx("Dominant vs recessive", "Dominant oder rezessiv?"), tx("Swapped! **Dominant** shows even once ($Aa$), **recessive** only twice ($aa$).", "Vertauscht! **Dominant** zeigt sich schon einfach ($Aa$), **rezessiv** nur doppelt ($aa$).")],
  recessive: [tx("Dominant vs recessive", "Dominant oder rezessiv?"), tx("Swapped! **Dominant** shows even once ($Aa$), **recessive** only twice ($aa$).", "Vertauscht! **Dominant** zeigt sich schon einfach ($Aa$), **rezessiv** nur doppelt ($aa$).")],
  homo: [tx("Homo = same", "Homo = gleich"), tx("Swapped! **Homo**zygous = the **same** alleles ($AA$, $aa$), **hetero**zygous = different ($Aa$).", "Vertauscht! **Homo**zygot = **gleiche** Allele ($AA$, $aa$), **hetero**zygot = verschiedene ($Aa$).")],
  hetero: [tx("Homo = same", "Homo = gleich"), tx("Swapped! **Homo**zygous = the **same** alleles ($AA$, $aa$), **hetero**zygous = different ($Aa$).", "Vertauscht! **Homo**zygot = **gleiche** Allele ($AA$, $aa$), **hetero**zygot = verschiedene ($Aa$).")],
};

function termMatchTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(TERMS).slice(0, 4);
  const extra = rng.pick(TERMS.filter((t) => !chosen.includes(t)));
  const pairs = chosen.map((t) => [t.term, t.def] as [Text, Text]);
  const wrong = chosen
    .filter((t) => t.partner && chosen.some((o) => o.id === t.partner))
    .map((t) => ({ pairs: [[t.term, termById(t.partner!).def]] as [Text, Text][], title: CONFUSE[t.id][0], say: CONFUSE[t.id][1] }));
  const m = matchTask(pairs, [extra.def], wrong);
  return {
    instruction: tx("Match term and meaning", "Ordne Begriff und Bedeutung zu"),
    text: tx("Which description belongs to which term? One description is left over.", "Welche Beschreibung gehört zu welchem Begriff? Eine Beschreibung bleibt übrig."),
    answer: m.answer,
    hint: tx("Start with the terms you're sure about. Genotype is about letters, phenotype about looks.", "Fang mit den Begriffen an, bei denen du sicher bist. Beim Genotyp geht es um Buchstaben, beim Phänotyp ums Aussehen."),
    solution: chosen.slice(0, 2).map((t, i) => ({
      math: tx(`"${E(t.term)}"`, `"${D(t.term)}"`),
      note: i === 0 ? tx(`**${cap(E(t.term))}**: ${E(t.def)}.`, `**${cap(D(t.term))}**: ${D(t.def)}.`) : tx(`**${cap(E(t.term))}**: ${E(t.def)}. ${chosen.slice(2).map((o) => `**${cap(E(o.term))}**: ${E(o.def)}.`).join(" ")}`, `**${cap(D(t.term))}**: ${D(t.def)}. ${chosen.slice(2).map((o) => `**${cap(D(o.term))}**: ${D(o.def)}.`).join(" ")}`),
    })),
    mistakes: m.mistakes,
  };
}

const WORD_PROMPTS: { id: string; q: Text }[] = [
  { id: "phenotype", q: tx("What do you call the appearance of an organism, i.e. all its traits you can observe?", "Wie nennt man das Erscheinungsbild eines Lebewesens, also alle Merkmale, die man beobachten kann?") },
  { id: "genotype", q: tx("What do you call the combination of alleles an organism has, e.g. $Rr$?", "Wie nennt man die Kombination der Allele eines Lebewesens, z. B. $Rr$?") },
  { id: "allele", q: tx("The gene for flower colour comes in two variants, $A$ and $a$. What are these variants called?", "Das Gen für die Blütenfarbe gibt es in zwei Varianten, $A$ und $a$. Wie heißen diese Varianten?") },
  { id: "gene", q: tx("What do you call a section of DNA that carries the information for one trait?", "Wie nennt man einen DNA-Abschnitt, der die Information für ein Merkmal trägt?") },
  { id: "dominant", q: tx("An allele that already shows when it is there only once is called …", "Ein Allel, das sich schon zeigt, wenn es nur einmal vorhanden ist, nennt man …") },
  { id: "recessive", q: tx("An allele that only shows when it is there twice ($aa$) is called …", "Ein Allel, das sich nur zeigt, wenn es doppelt vorhanden ist ($aa$), nennt man …") },
  { id: "homo", q: tx("A plant has the genotype $RR$: two identical alleles. What is it called?", "Eine Pflanze hat den Genotyp $RR$: zwei gleiche Allele. Wie nennt man sie?") },
  { id: "hetero", q: tx("A plant has the genotype $Gg$: two different alleles. What is it called?", "Eine Pflanze hat den Genotyp $Gg$: zwei verschiedene Allele. Wie nennt man sie?") },
  { id: "gamete", q: tx("Egg cells and sperm cells carry only one allele of each gene. What are they called as a group?", "Eizellen und Spermienzellen tragen nur ein Allel jedes Gens. Wie nennt man sie zusammen?") },
  { id: "chromosome", q: tx("Genes lie on threads of DNA in the cell nucleus. What are these called?", "Gene liegen auf DNA-Fäden im Zellkern. Wie heißen diese?") },
];

function termWordTask(rng: Rng): Exercise {
  const p = rng.pick(WORD_PROMPTS);
  const t = termById(p.id);
  const answer: AnswerSpec = { kind: "word", accept: t.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakeList(answer);
  if (t.partner) m.add({ kind: "word", accept: termById(t.partner).accept }, CONFUSE[t.id][0], CONFUSE[t.id][1]);
  if (t.id === "phenotype" || t.id === "trait") m.add({ kind: "word", accept: [tx("trait", "Merkmal"), "Merkmale"] }, tx("One trait vs all of them", "Ein Merkmal oder alle?"), tx("A trait is a single feature, like flower colour. The appearance as a whole has its own name.", "Ein Merkmal ist eine einzelne Eigenschaft wie die Blütenfarbe. Das gesamte Erscheinungsbild hat einen eigenen Namen."));
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: p.q,
    answer,
    hint: tx(`It starts with “${E(t.term)[0].toUpperCase()}”.`, `Er beginnt mit „${D(t.term)[0].toUpperCase()}“.`),
    solution: [{ math: tx(`"${E(t.term)}"`, `"${D(t.term)}"`), note: tx(`**${cap(E(t.term))}**: ${E(t.def)}.`, `**${cap(D(t.term))}**: ${D(t.def)}.`) }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 6. Read the chromosome picture

const FIG_SHORT: Record<string, Text> = {
  locus: tx("gene (locus)", "Gen (Genort)"),
  alleleA: tx("dominant allele", "dominantes Allel"),
  allelea: tx("recessive allele", "rezessives Allel"),
  homo: tx("homozygous", "reinerbig"),
};

const FIG_LABEL: Record<string, Text> = {
  locus: tx("the gene (locus) for flower colour", "das Gen (der Genort) für die Blütenfarbe"),
  alleleA: tx("a dominant allele", "ein dominantes Allel"),
  allelea: tx("a recessive allele", "ein rezessives Allel"),
  homo: tx("two identical alleles (homozygous)", "zwei gleiche Allele (reinerbig)"),
};

function figureTask(rng: Rng): Exercise {
  const ask = rng.pick(["locus", "alleleA", "allelea", "homo"]);
  const others = rng.shuffle(Object.keys(FIG_LABEL).filter((k) => k !== ask));
  const say: Record<string, [Text, Text]> = {
    locus: [tx("The place, not a variant", "Der Ort, nicht die Variante"), tx("The dashed line marks the place where the gene sits on both chromosomes. The single letters are its alleles.", "Die gestrichelte Linie markiert den Ort, an dem das Gen auf beiden Chromosomen liegt. Die einzelnen Buchstaben sind seine Allele.")],
    alleleA: [tx("Capital = dominant", "Groß = dominant"), tx("A capital letter stands for a **dominant** allele, a small one for a recessive allele.", "Ein Großbuchstabe steht für ein **dominantes** Allel, ein Kleinbuchstabe für ein rezessives.")],
    allelea: [tx("Small = recessive", "Klein = rezessiv"), tx("A small letter stands for a **recessive** allele.", "Ein Kleinbuchstabe steht für ein **rezessives** Allel.")],
    homo: [tx("Look at both letters", "Schau auf beide Buchstaben"), tx("Here both chromosomes carry the **same** letter: two identical alleles.", "Hier tragen beide Chromosomen **denselben** Buchstaben: zwei gleiche Allele.")],
  };
  const opts: Opt[] = [{ text: FIG_LABEL[ask] }, ...others.map((k) => ({ text: FIG_LABEL[k], title: say[ask][0], say: say[ask][1] }))];
  const c = choice(rng, opts);
  return {
    instruction: tx("Read the picture", "Lies die Abbildung"),
    text: tx("The picture shows a pair of chromosomes of a pea plant: one from each parent. What is marked with “?”?", "Die Abbildung zeigt ein Chromosomenpaar einer Erbsenpflanze: eins von jedem Elternteil. Was ist mit „?“ markiert?"),
    visual: visual(GeneticsChromosomes, { mode: "numbers", ask, legend: "none" }),
    answer: c.answer,
    hint: tx("Letters are alleles. Capital = dominant, small = recessive. The dashed line joins the same place on both chromosomes.", "Buchstaben sind Allele. Groß = dominant, klein = rezessiv. Die gestrichelte Linie verbindet dieselbe Stelle auf beiden Chromosomen."),
    solution: [{ math: tx(`"?" = "${E(FIG_SHORT[ask])}"`, `"?" = "${D(FIG_SHORT[ask])}"`), note: say[ask][1] }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// 7./8. The F1 of a cross between two pure-breeding parents

function crossText(id: TraitId): Text {
  const t = TRAITS[id];
  return tx(`Pure-breeding ${E(t.many)} ${E(t.withDom)} are crossed with pure-breeding ${E(t.many)} ${E(t.withRec)}.`, `Reinerbige ${D(t.many)} ${D(t.withDom)} werden mit reinerbigen ${D(t.many)} ${D(t.withRec)} gekreuzt.`);
}

function f1Task(rng: Rng): Exercise {
  const id = rng.pick(ALL_TRAITS);
  const t = TRAITS[id];
  const L = t.letter;
  const l = L.toLowerCase();
  const askGeno = rng.chance(0.4);
  const ratio = (a: number, b: number): Text => tx(`${E(t.dom)} : ${E(t.rec)} = ${a} : ${b}`, `${D(t.dom)} : ${D(t.rec)} = ${a} : ${b}`);
  const f2Say = tx("Ooh, classic trap: 3 : 1 is the **F2**, the grandchildren! In the F1 all offspring are the same.", "Oh, die klassische Falle: 3 : 1 gibt es erst in der **F2**, bei den Enkeln! In der F1 sind alle Nachkommen gleich.");
  const opts: Opt[] = askGeno
    ? [
        { text: tx(`all $${L}${l}$`, `alle $${L}${l}$`) },
        { text: tx(`all $${L}${L}$`, `alle $${L}${L}$`), title: tx("One allele from each parent", "Ein Allel von jedem Elternteil"), say: tx(`They look dominant, but every offspring got an $${l}$ from the recessive parent. So they can't be $${L}${L}$.`, `Sie sehen dominant aus, aber jeder Nachkomme hat vom rezessiven Elternteil ein $${l}$ bekommen. $${L}${L}$ geht also nicht.`) },
        { text: tx(`half $${L}${L}$, half $${l}${l}$`, `je zur Hälfte $${L}${L}$ und $${l}${l}$`), title: tx("Alleles get mixed", "Die Allele werden gemischt"), say: tx(`Each parent gives one allele: $${L}$ from one, $${l}$ from the other. Nobody ends up like a parent here.`, `Jeder Elternteil gibt ein Allel: $${L}$ vom einen, $${l}$ vom anderen. Keiner wird hier wie ein Elternteil.`) },
        { text: tx(`$${L}${L}$ : $${L}${l}$ : $${l}${l}$ = 1 : 2 : 1`, `$${L}${L}$ : $${L}${l}$ : $${l}${l}$ = 1 : 2 : 1`), title: tx("That's the F2", "Das ist die F2"), say: tx("1 : 2 : 1 shows up when you cross two **heterozygous** plants (F1 × F1). The parents here are both pure-breeding.", "1 : 2 : 1 entsteht, wenn man zwei **mischerbige** Pflanzen kreuzt (F1 × F1). Hier sind beide Eltern reinerbig.") },
      ]
    : [
        { text: tx(`all ${E(t.withDom)}`, `alle ${D(t.withDom)}`) },
        { text: ratio(3, 1), title: tx("3 : 1 in the F1?", "3 : 1 in der F1?"), say: f2Say },
        { text: tx(`all ${E(t.withRec)}`, `alle ${D(t.withRec)}`), title: tx("Dominant shows", "Dominant setzt sich durch"), say: tx(`All F1 offspring are $${L}${l}$. The dominant allele $${L}$ shows, the recessive one stays hidden.`, `Alle F1-Nachkommen sind $${L}${l}$. Das dominante Allel $${L}$ zeigt sich, das rezessive bleibt verborgen.`) },
        { text: rng.chance(0.5) ? ratio(1, 1) : t.mix, title: tx("No splitting, no blending", "Keine Aufspaltung, keine Mischung"), say: tx(`Every offspring gets $${L}$ from one parent and $${l}$ from the other: all are $${L}${l}$, and $${L}$ is dominant. So all look the same.`, `Jeder Nachkomme bekommt $${L}$ vom einen und $${l}$ vom anderen Elternteil: Alle sind $${L}${l}$, und $${L}$ ist dominant. Also sehen alle gleich aus.`) },
      ];
  const c = choice(rng, opts);
  return {
    instruction: tx("Predict the F1", "Sag die F1 voraus"),
    text: tx(`${E(dominanceLine(t))} ${E(crossText(id))} ${askGeno ? "Which genotype do the offspring of the F1 have?" : "What do the offspring of the F1 look like?"}`, `${D(dominanceLine(t))} ${D(crossText(id))} ${askGeno ? "Welchen Genotyp haben die Nachkommen der F1?" : "Wie sehen die Nachkommen der F1 aus?"}`),
    answer: c.answer,
    hint: tx("Pure-breeding parents can only pass on one kind of allele each.", "Reinerbige Eltern können jeweils nur eine Sorte Allel weitergeben."),
    solution: [
      { math: tx(`"P:" \\; ${L}${L} \\times ${l}${l}`, `"P:" \\; ${L}${L} \\times ${l}${l}`), note: tx(`Pure-breeding: one parent is $${L}${L}$, the other $${l}${l}$.`, `Reinerbig: Ein Elternteil ist $${L}${L}$, der andere $${l}${l}$.`) },
      { math: tx(`"gametes:" \\; ${L} \\quad ${l}`, `"Keimzellen:" \\; ${L} \\quad ${l}`), note: tx(`Their gametes carry only $${L}$ or only $${l}$.`, `Ihre Keimzellen tragen nur $${L}$ bzw. nur $${l}$.`) },
      { math: tx(`"F1:" \\; ${L}${l} \\to "all ${E(t.dom)}"`, `"F1:" \\; ${L}${l} \\to "alle ${D(t.dom)}"`), note: tx(`Every offspring is $${L}${l}$ and shows the dominant trait. **Uniformity rule**: the F1 is uniform.`, `Jeder Nachkomme ist $${L}${l}$ und zeigt das dominante Merkmal. **Uniformitätsregel**: Die F1 ist einheitlich.`) },
    ],
    mistakes: c.mistakes,
  };
}

function f1CountExercise(id: TraitId, n: number, askDom: boolean): Exercise {
  const t = TRAITS[id];
  const L = t.letter;
  const l = L.toLowerCase();
  const answer = count(askDom ? n : 0);
  const m = mistakeList(answer);
  m.add(count(askDom ? (3 * n) / 4 : n / 4), tx("3 : 1 in the F1?", "3 : 1 in der F1?"), tx("Ooh, classic trap! 3 : 1 only appears in the **F2**, when you cross the F1 plants with each other. The F1 itself is uniform.", "Oh, die klassische Falle! 3 : 1 gibt es erst in der **F2**, wenn man die F1-Pflanzen untereinander kreuzt. Die F1 selbst ist einheitlich."));
  m.add(count(n / 2), tx("Not half and half", "Nicht halb und halb"), tx(`Each offspring gets one $${L}$ and one $${l}$, so all are $${L}${l}$. Nothing splits up here.`, `Jeder Nachkomme bekommt ein $${L}$ und ein $${l}$, alle sind also $${L}${l}$. Hier spaltet sich nichts auf.`));
  if (!askDom) m.add(count(n), tx("Recessive stays hidden", "Rezessiv bleibt verborgen"), tx(`All F1 offspring are $${L}${l}$, and $${L}$ is dominant. The recessive trait doesn't show in a single one.`, `Alle F1-Nachkommen sind $${L}${l}$, und $${L}$ ist dominant. Das rezessive Merkmal zeigt sich bei keinem einzigen.`));
  else m.add(count(0), tx("Dominant shows", "Dominant zeigt sich"), tx(`All offspring are $${L}${l}$: the dominant trait shows in every single one.`, `Alle Nachkommen sind $${L}${l}$: Das dominante Merkmal zeigt sich bei jedem.`));
  const seeds = id === "shape" || id === "colour";
  return {
    instruction: tx("How many in the F1?", "Wie viele in der F1?"),
    text: tx(
      `${E(dominanceLine(t))} A pure-breeding plant ${E(t.withDom)} ($${L}${L}$) is crossed with a pure-breeding plant ${E(t.withRec)} ($${l}${l}$). The F1 has ${n} ${E(t.ind)}. How many of them ${E(askDom ? t.qDom : t.qRec)}?`,
      `${D(dominanceLine(t))} Eine reinerbige Pflanze ${D(t.withDom)} ($${L}${L}$) wird mit einer reinerbigen Pflanze ${D(t.withRec)} ($${l}${l}$) gekreuzt. Die F1 besteht aus ${n} ${D(t.ind)}. Wie viele davon ${D(askDom ? t.qDom : t.qRec)}?`,
    ),
    answer,
    hint: tx("Work out the genotype of the F1 first. Is there more than one?", "Bestimme zuerst den Genotyp der F1. Gibt es mehr als einen?"),
    solution: [
      { math: `${L}${L} \\times ${l}${l} \\to ${L}${l}`, note: tx(`Every ${seeds ? "seed" : "offspring"} gets $${L}$ and $${l}$: all are $${L}${l}$.`, `${seeds ? "Jeder Samen" : "Jeder Nachkomme"} bekommt $${L}$ und $${l}$: Alle sind $${L}${l}$.`) },
      {
        math: tx(`${askDom ? n : 0} "of" ${n}`, `${askDom ? n : 0} "von" ${n}`),
        note: askDom ? tx(`So **all ${n}** show the dominant trait (uniformity rule).`, `Also zeigen **alle ${n}** das dominante Merkmal (Uniformitätsregel).`) : tx("So **none** shows the recessive trait (uniformity rule). It's hidden, not gone!", "Also zeigt es **keiner** (Uniformitätsregel). Das rezessive Allel ist verborgen, nicht weg!"),
      },
    ],
    mistakes: m.list,
  };
}

function f1CountTask(rng: Rng) {
  return f1CountExercise(rng.pick(PEA_TRAITS), rng.int(10, 60) * 4, rng.chance(0.55));
}

// ---------------------------------------------------------------------------
// 9. Gametes

function gameteTask(rng: Rng): Exercise {
  const id = rng.pick(ALL_TRAITS);
  const L = TRAITS[id].letter;
  const l = L.toLowerCase();
  const g = rng.pick([L + L, L + l, L + l, l + l]);
  const opts = [
    { text: `$${L}$`, ok: g.includes(L) },
    { text: `$${l}$`, ok: g.includes(l) },
    { text: `$${L}${l}$`, ok: false },
    { text: `$${g[0] === g[1] ? g : L + L}$`, ok: false },
  ];
  const right = opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
  const wrong = [
    { pick: [...right, 2], title: tx("Only one allele per gamete", "Nur ein Allel pro Keimzelle"), say: tx("A gamete carries only **one** allele of each gene. Two come together again only at fertilisation.", "Eine Keimzelle trägt nur **ein** Allel jedes Gens. Zwei kommen erst bei der Befruchtung wieder zusammen.") },
    ...(g[0] === g[1] ? [{ pick: [0, 1], title: tx("Only what's there", "Nur was da ist"), say: tx(`$${g}$ has two identical alleles. It can only pass on $${g[0]}$.`, `$${g}$ hat zwei gleiche Allele. Es kann nur $${g[0]}$ weitergeben.`) }] : [{ pick: [0], title: tx("Both alleles get passed on", "Beide Allele werden weitergegeben"), say: tx(`Half of the gametes get $${L}$, the other half $${l}$. The recessive allele is passed on too!`, `Die Hälfte der Keimzellen bekommt $${L}$, die andere Hälfte $${l}$. Auch das rezessive Allel wird weitergegeben!`) }]),
  ];
  const m = multi(rng, opts, wrong);
  const s = subject(id);
  return {
    instruction: tx("Select all possible gametes", "Wähle alle möglichen Keimzellen"),
    text: tx(`${E(s.a)} has the genotype $${g}$. Which gametes (egg or sperm cells) can it form?`, `${D(s.a)} hat den Genotyp $${g}$. Welche Keimzellen (Ei- oder Spermienzellen) kann ${D(s.it)} bilden?`),
    answer: m.answer,
    hint: tx("Each gamete gets one of the two alleles.", "Jede Keimzelle bekommt eines der beiden Allele."),
    solution: [
      {
        math: g[0] === g[1] ? `${g} \\to ${g[0]}` : `${g} \\to ${L} \\quad ${l}`,
        note: g[0] === g[1] ? tx(`Both alleles are $${g[0]}$, so every gamete carries **$${g[0]}$**.`, `Beide Allele sind $${g[0]}$, also trägt jede Keimzelle **$${g[0]}$**.`) : tx(`Half of the gametes carry **$${L}$**, half carry **$${l}$**. Each gets just one allele.`, `Die Hälfte der Keimzellen trägt **$${L}$**, die andere Hälfte **$${l}$**. Jede bekommt nur ein Allel.`),
      },
    ],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// 10. Facts

type Fact = { q: Text; opts: Opt[]; hint: Text; note: Text; math: Text };

const FACTS: Fact[] = [
  {
    q: tx("From whom does a child get the two alleles of a gene?", "Von wem bekommt ein Kind die beiden Allele eines Gens?"),
    opts: [
      { text: tx("one from the mother, one from the father", "eins von der Mutter, eins vom Vater") },
      { text: tx("both from the mother", "beide von der Mutter"), title: tx("Both parents give", "Beide Eltern geben"), say: tx("The egg cell brings one allele, the sperm cell the other. Both parents contribute.", "Die Eizelle bringt ein Allel mit, die Spermienzelle das andere. Beide Eltern tragen bei.") },
      { text: tx("both from the parent with the dominant allele", "beide vom Elternteil mit dem dominanten Allel"), title: tx("Dominance doesn't decide who gives", "Dominanz entscheidet nicht, wer gibt"), say: tx("Every child gets exactly one allele from each parent, no matter which one is dominant.", "Jedes Kind bekommt genau ein Allel von jedem Elternteil, egal welches dominant ist.") },
      { text: tx("a random number from each parent", "eine zufällige Anzahl von jedem Elternteil"), title: tx("Exactly one each", "Genau eins von jedem"), say: tx("It's not random: a gamete carries exactly one allele of each gene.", "Das ist nicht zufällig: Eine Keimzelle trägt genau ein Allel jedes Gens.") },
    ],
    hint: tx("Think of the egg cell and the sperm cell.", "Denk an Eizelle und Spermienzelle."),
    math: tx('"egg:" A \\quad "sperm:" a \\to Aa', '"Eizelle:" A \\quad "Spermium:" a \\to Aa'),
    note: tx("Each gamete brings **one** allele. At fertilisation they meet: one from the mother, one from the father.", "Jede Keimzelle bringt **ein** Allel mit. Bei der Befruchtung treffen sie sich: eins von der Mutter, eins vom Vater."),
  },
  {
    q: tx("Purple ($A$) is dominant over white ($a$). What does that mean?", "Violett ($A$) ist dominant über weiß ($a$). Was bedeutet das?"),
    opts: [
      { text: tx("Plants with $Aa$ have purple flowers.", "Pflanzen mit $Aa$ blühen violett.") },
      { text: tx("Purple flowers are more common than white ones.", "Violette Blüten sind häufiger als weiße."), title: tx("Dominant ≠ more common", "Dominant ≠ häufiger"), say: tx("Ooh, a famous misconception! Dominant only says which allele shows in $Aa$. How common an allele is has nothing to do with it.", "Oh, ein berühmter Irrtum! Dominant sagt nur, welches Allel sich bei $Aa$ zeigt. Wie häufig ein Allel ist, hat damit nichts zu tun.") },
      { text: tx("The purple allele is better for the plant.", "Das violette Allel ist besser für die Pflanze."), title: tx("Dominant ≠ better", "Dominant ≠ besser"), say: tx("Dominant doesn't mean better or stronger. Some hereditary diseases are caused by dominant alleles.", "Dominant heißt nicht besser oder stärker. Manche Erbkrankheiten werden von dominanten Allelen verursacht.") },
      { text: tx("Plants with $Aa$ have light purple flowers.", "Pflanzen mit $Aa$ blühen hellviolett."), title: tx("Nothing blends", "Nichts vermischt sich"), say: tx("With dominance nothing is blended: $Aa$ looks just like $AA$.", "Bei Dominanz wird nichts gemischt: $Aa$ sieht genauso aus wie $AA$.") },
    ],
    hint: tx("Dominance is about what you see when both alleles are there.", "Bei Dominanz geht es darum, was man sieht, wenn beide Allele da sind."),
    math: tx('AA \\quad Aa \\to "purple"', 'AA \\quad Aa \\to "violett"'),
    note: tx("Dominant means: one $A$ is enough to show. Nothing more!", "Dominant heißt: Ein $A$ genügt, damit es sich zeigt. Mehr nicht!"),
  },
  {
    q: tx("When does a recessive trait show?", "Wann zeigt sich ein rezessives Merkmal?"),
    opts: [
      { text: tx("only when both alleles are recessive", "nur wenn beide Allele rezessiv sind") },
      { text: tx("as soon as one recessive allele is there", "sobald ein rezessives Allel da ist"), title: tx("One isn't enough", "Eins reicht nicht"), say: tx("With one recessive and one dominant allele, the dominant one shows. Recessive needs two.", "Bei einem rezessiven und einem dominanten Allel zeigt sich das dominante. Rezessiv braucht zwei.") },
      { text: tx("only when the mother has it", "nur wenn die Mutter es hat"), title: tx("Both parents count", "Beide Eltern zählen"), say: tx("The recessive allele can come from both parents, even if they don't show the trait themselves.", "Das rezessive Allel kann von beiden Eltern kommen, auch wenn sie das Merkmal selbst nicht zeigen.") },
      { text: tx("never, it gets lost", "nie, es geht verloren"), title: tx("Hidden, not lost", "Verborgen, nicht verloren"), say: tx("A recessive allele is only hidden in $Aa$. In $aa$ it shows.", "Ein rezessives Allel ist bei $Aa$ nur verborgen. Bei $aa$ zeigt es sich.") },
    ],
    hint: tx("Think of $Aa$ and $aa$.", "Denk an $Aa$ und $aa$."),
    math: tx('aa \\to "white"', 'aa \\to "weiß"'),
    note: tx("A recessive trait only shows in **homozygous** recessive organisms, e.g. $aa$.", "Ein rezessives Merkmal zeigt sich nur bei **reinerbig** rezessiven Lebewesen, z. B. $aa$."),
  },
  {
    q: tx("Where are the genes of a pea plant?", "Wo befinden sich die Gene einer Erbsenpflanze?"),
    opts: [
      { text: tx("on the chromosomes in the cell nucleus", "auf den Chromosomen im Zellkern") },
      { text: tx("only in the flowers", "nur in den Blüten"), title: tx("In every cell", "In jeder Zelle"), say: tx("Almost every cell has a nucleus with all the genes, also cells in leaves and roots.", "Fast jede Zelle hat einen Zellkern mit allen Genen, auch Zellen in Blättern und Wurzeln.") },
      { text: tx("in the cell wall", "in der Zellwand"), title: tx("The wall just protects", "Die Wand schützt nur"), say: tx("The cell wall gives shape and support. The genetic information is stored in the nucleus.", "Die Zellwand gibt Form und Halt. Die Erbinformation steckt im Zellkern.") },
      { text: tx("in the vacuole", "in der Vakuole"), title: tx("The vacuole stores sap", "Die Vakuole speichert Zellsaft"), say: tx("The vacuole holds cell sap. The genes are on the chromosomes in the nucleus.", "Die Vakuole enthält Zellsaft. Die Gene liegen auf den Chromosomen im Zellkern.") },
    ],
    hint: tx("Where is the genetic information of a cell?", "Wo steckt die Erbinformation einer Zelle?"),
    math: tx('"gene" \\to "chromosome" \\to "nucleus"', '"Gen" \\to "Chromosom" \\to "Zellkern"'),
    note: tx("Genes are sections of DNA on the **chromosomes** in the **cell nucleus**.", "Gene sind DNA-Abschnitte auf den **Chromosomen** im **Zellkern**."),
  },
  {
    q: tx("Which organism did Gregor Mendel use for his crossing experiments?", "Mit welchem Lebewesen machte Gregor Mendel seine Kreuzungsversuche?"),
    opts: [
      { text: tx("the garden pea", "mit der Gartenerbse") },
      { text: tx("the fruit fly", "mit der Taufliege"), title: tx("That was Morgan", "Das war Morgan"), say: tx("The fruit fly came later: Thomas Hunt Morgan used it around 1910. Mendel crossed peas in his monastery garden.", "Die Taufliege kam später: Thomas Hunt Morgan nutzte sie um 1910. Mendel kreuzte Erbsen im Klostergarten.") },
      { text: tx("the guinea pig", "mit dem Meerschweinchen"), title: tx("Plants, not animals", "Pflanzen, keine Tiere"), say: tx("Mendel worked with plants: garden peas, which he could pollinate by hand.", "Mendel arbeitete mit Pflanzen: Gartenerbsen, die er von Hand bestäuben konnte.") },
      { text: tx("the four o'clock flower", "mit der Wunderblume"), title: tx("Correns used it", "Die nutzte Correns"), say: tx("Carl Correns studied the four o'clock flower around 1900. Mendel's plant was the pea.", "Carl Correns untersuchte um 1900 die Wunderblume. Mendels Pflanze war die Erbse.") },
    ],
    hint: tx("He wrote about seed shape and seed colour.", "Er schrieb über Samenform und Samenfarbe."),
    math: tx('"Mendel" \\to "pea"', '"Mendel" \\to "Erbse"'),
    note: tx("Gregor Mendel crossed **garden peas** in Brünn (today Brno) from 1856 to 1863 and published his results in 1866.", "Gregor Mendel kreuzte von 1856 bis 1863 in Brünn (heute Brno) **Gartenerbsen** und veröffentlichte seine Ergebnisse 1866."),
  },
  {
    q: tx("How many alleles of each gene does a body cell have?", "Wie viele Allele jedes Gens hat eine Körperzelle?"),
    opts: [
      { text: tx("two", "zwei") },
      { text: tx("one", "eins"), title: tx("That's a gamete", "Das ist eine Keimzelle"), say: tx("Only gametes have one allele per gene. Body cells have two: one from each parent.", "Nur Keimzellen haben ein Allel pro Gen. Körperzellen haben zwei: von jedem Elternteil eins.") },
      { text: tx("four", "vier"), title: tx("One pair", "Ein Paar"), say: tx("A body cell has each chromosome twice, so each gene twice: two alleles.", "Eine Körperzelle hat jedes Chromosom doppelt, also jedes Gen doppelt: zwei Allele.") },
      { text: tx("as many as there are traits", "so viele, wie es Merkmale gibt"), title: tx("Per gene, not per trait", "Pro Gen, nicht pro Merkmal"), say: tx("The question is about one gene. Each gene is there twice.", "Gefragt ist nach einem Gen. Jedes Gen ist doppelt vorhanden.") },
    ],
    hint: tx("Chromosomes come in pairs.", "Chromosomen kommen in Paaren vor."),
    math: tx('"body cell:" \\; 2 "alleles"', '"Körperzelle:" \\; 2 "Allele"'),
    note: tx("Chromosomes come in pairs, so every gene is there **twice**: two alleles, one from each parent.", "Chromosomen kommen paarweise vor, also ist jedes Gen **doppelt** da: zwei Allele, von jedem Elternteil eins."),
  },
  {
    q: tx("Why did Mendel start with pure-breeding plants?", "Warum begann Mendel mit reinerbigen Pflanzen?"),
    opts: [
      { text: tx("Their offspring always look the same, so he knew their alleles.", "Ihre Nachkommen sehen immer gleich aus, so kannte er ihre Allele.") },
      { text: tx("They grow faster.", "Sie wachsen schneller."), title: tx("Not about speed", "Es geht nicht ums Tempo"), say: tx("Pure-breeding has nothing to do with growth. It means: two identical alleles.", "Reinerbig hat nichts mit Wachstum zu tun. Es heißt: zwei gleiche Allele.") },
      { text: tx("Only pure-breeding plants have flowers.", "Nur reinerbige Pflanzen haben Blüten."), title: tx("All of them flower", "Alle blühen"), say: tx("Heterozygous plants flower too. Mendel wanted to know exactly which alleles the parents had.", "Mischerbige Pflanzen blühen auch. Mendel wollte genau wissen, welche Allele die Eltern hatten.") },
      { text: tx("Pure-breeding plants are dominant.", "Reinerbige Pflanzen sind dominant."), title: tx("Pure can be recessive", "Reinerbig kann rezessiv sein"), say: tx("A pure-breeding plant can be $AA$ or $aa$. Pure-breeding only means two identical alleles.", "Eine reinerbige Pflanze kann $AA$ oder $aa$ sein. Reinerbig heißt nur: zwei gleiche Allele.") },
    ],
    hint: tx("What does pure-breeding mean for the offspring if they self-pollinate?", "Was bedeutet reinerbig für die Nachkommen, wenn sie sich selbst bestäuben?"),
    math: tx('AA \\times AA \\to AA', 'AA \\times AA \\to AA'),
    note: tx("Pure-breeding plants pass on only one kind of allele. Their offspring look like them generation after generation, so Mendel knew their genotype.", "Reinerbige Pflanzen geben nur eine Sorte Allel weiter. Ihre Nachkommen sehen Generation für Generation gleich aus, so kannte Mendel ihren Genotyp."),
  },
];

function factTask(rng: Rng): Exercise {
  const f = rng.pick(FACTS);
  const c = choice(rng, f.opts);
  return { instruction: tx("Pick the right answer", "Wähle die richtige Antwort"), text: f.q, answer: c.answer, hint: f.hint, solution: [{ math: f.math, note: f.note }], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [1.6, () => phenoTask(rng)],
    [1.2, () => genoMultiTask(rng)],
    [1, () => zygosityTask(rng)],
    [1.1, () => termMatchTask(rng)],
    [1.1, () => termWordTask(rng)],
    [0.7, () => figureTask(rng)],
    [1.3, () => f1Task(rng)],
    [1.1, () => f1CountTask(rng)],
    [0.9, () => gameteTask(rng)],
    [1, () => factTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const zygCheck: Exercise = (() => {
  const pairs: [Text, Text][] = [
    ["$GG$", HOM_DOM],
    ["$Rr$", HET],
    ["$aa$", HOM_REC],
  ];
  const m = matchTask(pairs, [], [
    { pairs: [["$Rr$", HOM_DOM]], title: tx("Mixed means different", "Mischerbig heißt verschieden"), say: tx("$Rr$ has two **different** alleles: heterozygous, even though it shows the dominant trait.", "$Rr$ hat zwei **verschiedene** Allele: mischerbig, auch wenn sich das dominante Merkmal zeigt.") },
    { pairs: [["$aa$", HET]], title: tx("Small letters can be pure", "Auch Kleine sind reinerbig"), say: tx("Two equal letters mean homozygous, even when both are small.", "Zwei gleiche Buchstaben heißen reinerbig, auch wenn beide klein sind.") },
  ]);
  return {
    instruction: tx("Match each genotype", "Ordne jedem Genotyp den Begriff zu"),
    text: tx("Which term fits each genotype?", "Welcher Begriff passt zu welchem Genotyp?"),
    answer: m.answer,
    hint: tx("Same letters twice: homozygous. Two different letters: heterozygous.", "Zweimal derselbe Buchstabe: reinerbig. Zwei verschiedene: mischerbig."),
    solution: [
      { math: tx('GG \\quad aa \\to "homozygous"', 'GG \\quad aa \\to "reinerbig"'), note: tx("$GG$: homozygous dominant. $aa$: homozygous recessive.", "$GG$: reinerbig dominant. $aa$: reinerbig rezessiv.") },
      { math: tx('Rr \\to "heterozygous"', 'Rr \\to "mischerbig"'), note: tx("$Rr$: two different alleles, heterozygous.", "$Rr$: zwei verschiedene Allele, mischerbig.") },
    ],
    mistakes: m.mistakes as Mistake[],
  };
})();

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Why do children look like their parents?", "Warum ähneln Kinder ihren Eltern?"),
      blob: tx("Ever been told you have your mum's eyes? Let's find out why!", "Hat dir schon mal jemand gesagt, du hast die Augen deiner Mutter? Finden wir raus, warum!"),
      body: tx(
        "Features like flower colour, fur colour or blood group are called **traits**. Parents pass them on to their offspring: traits are **inherited**. The instructions for them are stored in the **genes**.",
        "Eigenschaften wie Blütenfarbe, Fellfarbe oder Blutgruppe heißen **Merkmale**. Eltern geben sie an ihre Nachkommen weiter: Merkmale werden **vererbt**. Die Anleitung dafür steckt in den **Genen**.",
      ),
      frames: [
        { math: tx('"gene" \\to "trait"', '"Gen" \\to "Merkmal"'), note: tx("Behind a trait there is a **gene** (often several). A gene is a section of DNA with the information for one trait.", "Hinter einem Merkmal steckt ein **Gen** (oft auch mehrere). Ein Gen ist ein DNA-Abschnitt mit der Information für ein Merkmal.") },
        { math: tx('"gene" \\to "chromosome" \\to "nucleus"', '"Gen" \\to "Chromosom" \\to "Zellkern"'), note: tx("Genes lie on the **chromosomes** in the cell nucleus.", "Gene liegen auf den **Chromosomen** im Zellkern.") },
        { math: tx('46 "chromosomes" = 23 "pairs"', '46 "Chromosomen" = 23 "Paare"'), note: tx("Your body cells have 46 chromosomes: 23 pairs. One chromosome of each pair comes from your mother, the other from your father.", "Deine Körperzellen haben 46 Chromosomen: 23 Paare. Ein Chromosom jedes Paares stammt von deiner Mutter, das andere von deinem Vater.") },
        { math: tx('"1 gene" \\to 2 "alleles"', '"1 Gen" \\to 2 "Allele"'), note: tx("So every gene is there **twice**. The two copies can differ a little: these variants are called **alleles**.", "Jedes Gen ist also **doppelt** da. Die beiden Kopien können sich ein wenig unterscheiden: Diese Varianten heißen **Allele**.") },
        { math: "A \\quad a", note: tx("We write alleles as letters, the same letter for the same gene: e.g. $A$ and $a$ for the flower colour of peas.", "Allele schreibt man als Buchstaben, für dasselbe Gen denselben Buchstaben: z. B. $A$ und $a$ für die Blütenfarbe von Erbsen.") },
      ],
    },
    {
      type: "widget",
      title: tx("A pair of chromosomes", "Ein Chromosomenpaar"),
      blob: tx("Two chromosomes, two genes, four letters. Tap around!", "Zwei Chromosomen, zwei Gene, vier Buchstaben. Tipp dich durch!"),
      body: tx("Tap the numbers or the names. Where is the gene? Which letters are alleles? Where are both alleles the same?", "Tipp auf die Nummern oder die Namen. Wo liegt das Gen? Welche Buchstaben sind Allele? Wo sind beide Allele gleich?"),
      widget: GeneticsChromosomesExplore,
    },
    {
      type: "explain",
      title: tx("Dominant and recessive", "Dominant und rezessiv"),
      blob: tx("Two alleles, one flower. Who wins?", "Zwei Allele, eine Blüte. Wer gewinnt?"),
      body: tx("In peas, the gene for flower colour has two alleles: $A$ (purple) and $a$ (white).", "Bei Erbsen hat das Gen für die Blütenfarbe zwei Allele: $A$ (violett) und $a$ (weiß)."),
      frames: [
        { math: tx('AA#g \\to "purple"#p', 'AA#g \\to "violett"#p'), note: tx("Two $A$ alleles: purple flowers.", "Zwei $A$-Allele: violette Blüten.") },
        { math: tx('aa#g \\to "white"#p', 'aa#g \\to "weiß"#p'), note: tx("Two $a$ alleles: white flowers.", "Zwei $a$-Allele: weiße Blüten.") },
        { math: "Aa#g \\to ?#p", note: tx("And with one of each?", "Und mit je einem?") },
        { math: tx('Aa#g \\to \\hl{"purple"#p}', 'Aa#g \\to \\hl{"violett"#p}'), note: tx("Purple! $A$ wins: it is **dominant** (capital letter). $a$ stays hidden: it is **recessive** (small letter).", "Violett! $A$ setzt sich durch: Es ist **dominant** (Großbuchstabe). $a$ bleibt verborgen: Es ist **rezessiv** (Kleinbuchstabe).") },
        { math: tx('"dominant" \\ne "more common"', '"dominant" \\ne "häufiger"'), note: tx("Careful: dominant does **not** mean more common or better. It only means: one copy is enough to show.", "Vorsicht: Dominant heißt **nicht** häufiger oder besser. Es heißt nur: Ein Exemplar reicht, damit es sich zeigt.") },
      ],
    },
    {
      type: "explain",
      title: tx("Genotype and phenotype", "Genotyp und Phänotyp"),
      blob: tx("Two words that sound alike but mean very different things.", "Zwei Wörter, die ähnlich klingen, aber ganz Verschiedenes meinen."),
      frames: [
        { math: tx('"genotype:" \\; Aa#g', '"Genotyp:" \\; Aa#g'), note: tx("The **genotype** is the combination of alleles: $AA$, $Aa$ or $aa$.", "Der **Genotyp** ist die Kombination der Allele: $AA$, $Aa$ oder $aa$.") },
        { math: tx('Aa#g \\to "phenotype: purple"#p', 'Aa#g \\to "Phänotyp: violett"#p'), note: tx("The **phenotype** is what you can see: the appearance. Here: purple flowers. Think of a photo!", "Der **Phänotyp** ist das, was man sieht: das Erscheinungsbild. Hier: violette Blüten. Denk an ein Foto!") },
        { math: tx('AA , Aa#g \\to "purple" \\quad aa \\to "white"', 'AA , Aa#g \\to "violett" \\quad aa \\to "weiß"'), note: tx("Two genotypes, one phenotype: you can't tell $AA$ from $Aa$ just by looking.", "Zwei Genotypen, ein Phänotyp: $AA$ und $Aa$ kann man nicht am Aussehen unterscheiden.") },
        { math: tx('AA , aa: "homozygous" \\quad Aa: "heterozygous"', 'AA , aa: "reinerbig" \\quad Aa: "mischerbig"'), note: tx("Two equal alleles: **homozygous** (pure-breeding). Two different alleles: **heterozygous**.", "Zwei gleiche Allele: **reinerbig** (homozygot). Zwei verschiedene Allele: **mischerbig** (heterozygot).") },
      ],
    },
    {
      type: "widget",
      title: tx("The allele lab", "Das Allel-Labor"),
      blob: tx("Your turn to play with the genes!", "Jetzt spielst du mit den Genen!"),
      body: tx("For each gene pick one allele from the mother and one from the father. Watch the pea plant, its genotype and its phenotype.", "Wähle für jedes Gen ein Allel von der Mutter und eins vom Vater. Beobachte die Erbsenpflanze, ihren Genotyp und ihren Phänotyp."),
      widget: GeneticsAlleleLab,
    },
    { type: "check", blob: tx("Let's see if you've got it!", "Mal sehen, ob du's raushast!"), exercise: phenoExercise(createRng(11), "shape", "Rr") },
    {
      type: "explain",
      title: tx("Mendel's peas", "Mendels Erbsen"),
      blob: tx("Meet the monk who counted thousands of peas.", "Darf ich vorstellen: der Mönch, der Tausende Erbsen gezählt hat."),
      body: tx(
        "From 1856 to 1863 the monk **Gregor Mendel** crossed pea plants in his monastery garden in Brünn (Brno). He chose plants with clear traits that were **pure-breeding**: their offspring always looked the same.",
        "Von 1856 bis 1863 kreuzte der Mönch **Gregor Mendel** im Klostergarten in Brünn Erbsenpflanzen. Er wählte Pflanzen mit klaren Merkmalen, die **reinerbig** waren: Ihre Nachkommen sahen immer gleich aus.",
      ),
      frames: [
        { math: tx('"P:" \\; "purple"#a \\times "white"#b', '"P:" \\; "violett"#a \\times "weiß"#b'), note: tx("He put pollen from a purple-flowered plant onto a white-flowered one (and the other way round). These parents are the **P generation**.", "Er brachte Pollen einer violett blühenden Pflanze auf die Narbe einer weiß blühenden (und umgekehrt). Diese Eltern sind die **Parentalgeneration P**.") },
        { math: '"P:" \\; AA#a \\times aa#b', note: tx("In letters: $AA \\times aa$. Both are pure-breeding.", "In Buchstaben: $AA \\times aa$. Beide sind reinerbig.") },
        { math: tx('"gametes:" \\; A#a \\quad a#b', '"Keimzellen:" \\; A#a \\quad a#b'), note: tx("Each parent gives only **one** allele per gene to its gametes: here only $A$ and only $a$.", "Jeder Elternteil gibt seinen Keimzellen nur **ein** Allel pro Gen mit: hier nur $A$ und nur $a$.") },
        { math: '"F1:" \\; Aa#c', note: tx("Every offspring gets $A$ from one parent and $a$ from the other: all are $Aa$.", "Jeder Nachkomme bekommt $A$ vom einen und $a$ vom anderen Elternteil: Alle sind $Aa$.") },
        { math: tx('"F1:" \\; Aa#c \\to "all purple"', '"F1:" \\; Aa#c \\to "alle violett"'), note: tx("All plants of the first offspring generation (**F1**) have purple flowers. They're all the same: **uniform**.", "Alle Pflanzen der ersten Tochtergeneration (**F1**) blühen violett. Sie sind alle gleich: **uniform**.") },
        { math: tx('"1st law:" \\; "P pure-breeding" \\Rightarrow "F1 uniform"', '"1. Regel:" \\; "P reinerbig" \\Rightarrow "F1 uniform"'), note: tx("**Mendel's 1st law (uniformity rule)**: cross two pure-breeding parents that differ in one trait, and all F1 offspring are the same.", "**1. Mendelsche Regel (Uniformitätsregel)**: Kreuzt man zwei reinerbige Eltern, die sich in einem Merkmal unterscheiden, sind alle Nachkommen der F1 gleich.") },
      ],
    },
    {
      type: "widget",
      title: tx("Cross pure-breeding plants", "Reinerbige Pflanzen kreuzen"),
      blob: tx("Brush, pollen, go!", "Pinsel, Pollen, los!"),
      body: tx("Pick the two parents of the P generation. Watch the gametes and the F1. Is the F1 uniform every time?", "Wähle die beiden Eltern der P-Generation. Beobachte die Keimzellen und die F1. Ist die F1 jedes Mal einheitlich?"),
      widget: GeneticsPunnettP,
    },
    { type: "check", blob: tx("Count with me!", "Zähl mal mit!"), exercise: f1CountExercise("shape", 120, true) },
    { type: "check", blob: tx("Last one: sort the terms.", "Die letzte: Sortier die Begriffe."), exercise: zygCheck },
  ],
  summary: [
    {
      title: tx("Gene and allele", "Gen und Allel"),
      body: tx(
        "A **gene** is a section of DNA for a trait, on a chromosome in the nucleus. Body cells have every gene twice: one from the mother, one from the father. The variants of a gene are **alleles**.",
        "Ein **Gen** ist ein DNA-Abschnitt für ein Merkmal, auf einem Chromosom im Zellkern. Körperzellen haben jedes Gen doppelt: eins von der Mutter, eins vom Vater. Die Varianten eines Gens heißen **Allele**.",
      ),
      examples: [tx('"flower colour:" \\; A , a', '"Blütenfarbe:" \\; A , a')],
      tone: "rule",
    },
    {
      title: tx("Dominant and recessive", "Dominant und rezessiv"),
      body: tx("The **dominant** allele (capital letter) shows even once. The **recessive** one (small letter) only shows when it's there twice.", "Das **dominante** Allel (Großbuchstabe) zeigt sich schon einfach. Das **rezessive** (Kleinbuchstabe) nur, wenn es doppelt da ist."),
      examples: [tx('AA , Aa \\to "purple" \\quad aa \\to "white"', 'AA , Aa \\to "violett" \\quad aa \\to "weiß"')],
      tone: "rule",
    },
    {
      title: tx("Genotype and phenotype", "Genotyp und Phänotyp"),
      body: tx("**Genotype**: the alleles ($Aa$). **Phenotype**: the appearance (purple flowers). Equal alleles: **homozygous** (pure-breeding), different ones: **heterozygous**.", "**Genotyp**: die Allele ($Aa$). **Phänotyp**: das Erscheinungsbild (violette Blüten). Gleiche Allele: **reinerbig** (homozygot), verschiedene: **mischerbig** (heterozygot)."),
      examples: [tx('AA , aa: "homozygous" \\quad Aa: "heterozygous"', 'AA , aa: "reinerbig" \\quad Aa: "mischerbig"')],
      tone: "rule",
    },
    {
      title: tx("Gametes", "Keimzellen"),
      body: tx("Egg and sperm cells carry only **one** allele of each gene. Fertilisation brings two together again.", "Ei- und Spermienzellen tragen nur **ein** Allel jedes Gens. Bei der Befruchtung kommen wieder zwei zusammen."),
      examples: [tx('Aa \\to "gametes:" \\; A , a', 'Aa \\to "Keimzellen:" \\; A , a')],
      tone: "tip",
    },
    {
      title: tx("1st Mendelian law: uniformity rule", "1. Mendelsche Regel: Uniformitätsregel"),
      body: tx("Cross two pure-breeding parents that differ in one trait: all F1 offspring are the same (and heterozygous).", "Kreuzt man zwei reinerbige Eltern, die sich in einem Merkmal unterscheiden, sind alle Nachkommen der F1 gleich (und mischerbig)."),
      examples: [tx('"P:" \\; AA \\times aa \\to "F1:" \\; Aa', '"P:" \\; AA \\times aa \\to "F1:" \\; Aa')],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Dominant does **not** mean more common or better. And there's no 3 : 1 in the F1: the F1 is uniform.", "Dominant heißt **nicht** häufiger oder besser. Und in der F1 gibt es kein 3 : 1: Die F1 ist einheitlich."),
      examples: [tx('"F1:" \\; "100 % purple"', '"F1:" \\; "100 % violett"')],
      tone: "warning",
    },
  ],
};
