"use client";

import { tx, type Text } from "@/i18n/text";
import { dec } from "@/learn/chemistry/format";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson } from "@/learn/types";
import { EvolutionDrift } from "@/learn/biology/visuals/EvolutionDrift";
import { EvolutionHardyWeinberg } from "@/learn/biology/visuals/EvolutionHardyWeinberg";
import { EvolutionSelection, SEL_TRAITS, SelectionGraph, type SelForm } from "@/learn/biology/visuals/EvolutionSelection";
import { EvolutionTable } from "@/learn/biology/visuals/EvolutionTable";
import { EvolutionCladogram, EvolutionCladogramFigure } from "@/learn/biology/visuals/EvolutionTree";
import { CHARACTERS, GROUPS, LEAVES, PHYLY, type CharacterId, type LeafId, type Phyly } from "./data";
import { category, choice, de, en, listText, mistakes, q, round, visual } from "./kit";

/** A number in both languages for prose ("0.04" / "0,04"). */
const N = (v: number, digits = 4): Text => tx(dec(v, "en", digits), dec(v, "de", digits));
/** Builds a display-language line from a function of the language (numbers get the right decimal mark). */
const line = (f: (n: (v: number, digits?: number) => string, lang: "en" | "de") => string): Text => tx(f((v, d = 4) => dec(v, "en", d), "en"), f((v, d = 4) => dec(v, "de", d), "de"));
/** Whole numbers with a thousands separator in prose ("10,000" / "10.000"). */
const big = (v: number): Text => tx(v.toLocaleString("en-GB"), v.toLocaleString("de-DE"));

// ---------------------------------------------------------------------------
// Hardy-Weinberg from the share of recessive homozygotes

type HwAsk = "q" | "p" | "carriers" | "dominant" | "count";

type HwCase = { text: Text; q: number; people: boolean };

const ORGS: { who: Text; trait: Text }[] = [
  { who: tx("a population of mice", "einer Mäusepopulation"), trait: tx("white fur", "weißes Fell") },
  { who: tx("a population of banded snails", "einer Population von Bänderschnecken"), trait: tx("a yellow shell", "ein gelbes Gehäuse") },
  { who: tx("a fruit fly culture", "einer Taufliegenzucht"), trait: tx("stubby wings", "Stummelflügel") },
  { who: tx("a herd of cattle", "einer Rinderherde"), trait: tx("a red coat", "eine rote Fellfarbe") },
  { who: tx("a population of cats", "einer Katzenpopulation"), trait: tx("long hair", "langes Fell") },
];
const QS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.05, 0.15, 0.25, 0.35, 0.45];

const CF: HwCase = {
  q: 0.02,
  people: true,
  text: tx("Cystic fibrosis is inherited recessively (genotype aa). In Central Europe about 1 in 2,500 newborns has it.", "Mukoviszidose wird rezessiv vererbt (Genotyp aa). In Mitteleuropa ist etwa eines von 2500 Neugeborenen betroffen."),
};
const PKU: HwCase = {
  q: 0.01,
  people: true,
  text: tx("Phenylketonuria (PKU) is inherited recessively (genotype aa) and affects about 1 in 10,000 newborns.", "Phenylketonurie (PKU) wird rezessiv vererbt (Genotyp aa) und betrifft etwa eines von 10.000 Neugeborenen."),
};

function hwCase(rng: Rng): HwCase {
  const roll = rng.int(0, 5);
  if (roll === 0) return CF;
  if (roll === 1) return PKU;
  const o = rng.pick(ORGS);
  const qv = rng.pick(QS);
  const pct = N(qv * qv * 100, 2);
  return {
    q: qv,
    people: false,
    text: tx(`In ${en(o.who)}, ${en(pct)} % of the animals show ${en(o.trait)}, a trait inherited recessively (genotype aa).`, `In ${de(o.who)} zeigen ${de(pct)} % der Tiere ${de(o.trait)}, ein rezessiv vererbtes Merkmal (Genotyp aa).`),
  };
}

function hwTask(rng: Rng, fixed?: { c: HwCase; ask: HwAsk }): Exercise {
  const c = fixed?.c ?? hwCase(rng);
  const ask: HwAsk = fixed?.ask ?? rng.pick(["q", "p", "carriers", "carriers", "dominant", "count"] as HwAsk[]);
  const qv = c.q;
  const p = 1 - qv;
  const q2 = qv * qv;
  const pq2 = 2 * p * qv;
  const pop = c.people ? rng.pick([10000, 100000]) : rng.pick([1000, 2000, 5000]);
  const value = round(ask === "q" ? qv : ask === "p" ? p : ask === "carriers" ? pq2 * 100 : ask === "dominant" ? p * p * 100 : Math.round(pq2 * pop), 6);
  const answer: AnswerSpec = {
    kind: "number",
    value,
    tolerance: 0.012,
    unit: ask === "carriers" || ask === "dominant" ? "%" : ask === "count" ? (c.people ? tx("people", "Menschen") : tx("animals", "Tiere")) : undefined,
    label: ask === "q" ? "q =" : ask === "p" ? "p =" : undefined,
  };
  const m = mistakes(answer);
  const num = (v: number) => ({ kind: "number" as const, value: round(v, 6), tolerance: 0.012 });
  if (ask === "q") {
    m.add(num(q2), tx("The root is missing", "Die Wurzel fehlt"), tx("That's q², the share of aa individuals. The allele frequency q is its square root.", "Das ist q², der Anteil der aa-Individuen. Die Allelfrequenz q ist die Wurzel daraus."));
    m.add(num(p), tx("That's p", "Das ist p"), tx("That's the frequency of the dominant allele A. Asked is q, the recessive allele a.", "Das ist die Frequenz des dominanten Allels A. Gefragt ist q, das rezessive Allel a."));
  }
  if (ask === "p") {
    m.add(num(1 - q2), tx("1 − q² isn't p", "1 − q² ist nicht p"), tx("1 − q² is the share of everyone without the trait (AA and Aa). For p, first take the root of q², then p = 1 − q.", "1 − q² ist der Anteil aller ohne das Merkmal (AA und Aa). Für p ziehst du erst die Wurzel aus q², dann p = 1 − q."));
    m.add(num(p * p), tx("Genotype, not allele", "Genotyp, nicht Allel"), tx("That's p², the share of the genotype AA. The allele frequency is p itself.", "Das ist p², der Anteil des Genotyps AA. Die Allelfrequenz ist p selbst."));
    m.add(num(qv), tx("That's q", "Das ist q"), tx("That's the frequency of the recessive allele. p is the other one: p = 1 − q.", "Das ist die Frequenz des rezessiven Allels. p ist die andere: p = 1 − q."));
  }
  if (ask === "carriers") {
    m.add(num(p * qv * 100), tx("Times 2 missing", "Mal 2 fehlt"), tx("Heterozygotes arise in two ways (A from the father and a from the mother, or the other way round): 2pq.", "Heterozygote entstehen auf zwei Wegen (A vom Vater und a von der Mutter oder umgekehrt): 2pq."));
    m.add(num(qv * 100), tx("Allele, not genotype", "Allel, nicht Genotyp"), tx("That's q, the allele frequency of a. Carriers are the heterozygotes Aa: 2pq.", "Das ist q, die Allelfrequenz von a. Überträger sind die Heterozygoten Aa: 2pq."));
    m.add(num((1 - q2) * 100), tx("AA counted too", "AA mitgezählt"), tx("That's everyone without the trait, AA and Aa together. Carriers are only the heterozygotes: 2pq.", "Das sind alle ohne das Merkmal, AA und Aa zusammen. Überträger sind nur die Heterozygoten: 2pq."));
    m.add(num(2 * (1 - q2) * q2 * 100), tx("q² isn't q", "q² ist nicht q"), tx("Looks like you used q² instead of q in 2pq. First take the root: q = √q².", "Sieht aus, als hättest du q² statt q in 2pq eingesetzt. Zieh zuerst die Wurzel: q = √q²."));
  }
  if (ask === "dominant") {
    m.add(num(p * 100), tx("p isn't p²", "p ist nicht p²"), tx("p is the frequency of the allele A. The share of the genotype AA is p² = p · p.", "p ist die Frequenz des Allels A. Der Anteil des Genotyps AA ist p² = p · p."));
    m.add(num((1 - q2) * 100), tx("Aa counted too", "Aa mitgezählt"), tx("That's everyone without the trait, AA and Aa together. Homozygous dominant means only AA: p².", "Das sind alle ohne das Merkmal, AA und Aa zusammen. Homozygot dominant heißt nur AA: p²."));
    m.add(num((1 - q2) * (1 - q2) * 100), tx("q² isn't q", "q² ist nicht q"), tx("Looks like you used q² as q. First take the root, then p = 1 − q and p².", "Sieht aus, als hättest du q² als q genommen. Zieh zuerst die Wurzel, dann p = 1 − q und p²."));
  }
  if (ask === "count") {
    m.add(num(Math.round(p * qv * pop)), tx("Times 2 missing", "Mal 2 fehlt"), tx("The share of heterozygotes is 2pq, not pq.", "Der Anteil der Heterozygoten ist 2pq, nicht pq."));
    m.add(num(Math.round(q2 * pop)), tx("Those are the aa", "Das sind die aa"), tx("That's how many show the trait (aa). Carriers are heterozygous (Aa) and healthy-looking: 2pq.", "So viele zeigen das Merkmal (aa). Überträger sind heterozygot (Aa) und äußerlich unauffällig: 2pq."));
    m.add(num(Math.round(qv * pop)), tx("Allele, not genotype", "Allel, nicht Genotyp"), tx("q is an allele frequency, not a share of individuals. Carriers: 2pq · number of individuals.", "q ist eine Allelfrequenz, kein Anteil von Individuen. Überträger: 2pq · Anzahl der Individuen."));
  }

  const asks: Record<HwAsk, { instruction: Text; question: Text }> = {
    q: { instruction: tx("Calculate the allele frequency", "Berechne die Allelfrequenz"), question: tx("Calculate the frequency q of the recessive allele a.", "Berechne die Frequenz q des rezessiven Allels a.") },
    p: { instruction: tx("Calculate the allele frequency", "Berechne die Allelfrequenz"), question: tx("Calculate the frequency p of the dominant allele A.", "Berechne die Frequenz p des dominanten Allels A.") },
    carriers: { instruction: tx("Calculate the share of carriers", "Berechne den Anteil der Überträger"), question: tx("How many percent are heterozygous carriers (Aa)?", "Wie viel Prozent sind heterozygote Überträger (Aa)?") },
    dominant: { instruction: tx("Calculate a genotype frequency", "Berechne eine Genotypfrequenz"), question: tx("How many percent are homozygous dominant (AA)?", "Wie viel Prozent sind homozygot dominant (AA)?") },
    count: {
      instruction: tx("Calculate the number of carriers", "Berechne die Zahl der Überträger"),
      question: tx(`About how many of ${en(big(pop))} ${c.people ? "people" : "animals"} are heterozygous carriers (Aa)?`, `Etwa wie viele von ${de(big(pop))} ${c.people ? "Menschen" : "Tieren"} sind heterozygote Überträger (Aa)?`),
    },
  };

  const d6 = q2 < 0.001 ? 6 : 4;
  const frames: Frame[] = [
    { math: line((n) => `q^2 = ${n(q2, d6)}#q2`), note: tx("The individuals with the recessive trait are aa: their share is q².", "Die Individuen mit dem rezessiven Merkmal sind aa: Ihr Anteil ist q².") },
    { math: line((n) => `q = \\sqrt{${n(q2, d6)}} = ${n(qv, 3)}#q`), note: tx("The allele frequency q is the square root.", "Die Allelfrequenz q ist die Wurzel daraus."), highlight: ask === "q" ? ["q"] : undefined },
  ];
  if (ask !== "q") frames.push({ math: line((n) => `p = 1 - ${n(qv, 3)} = ${n(p, 3)}#p`), note: tx("Only two alleles: p + q = 1.", "Es gibt nur zwei Allele: p + q = 1."), highlight: ask === "p" ? ["p"] : undefined });
  if (ask === "carriers") frames.push({ math: line((n) => `2pq = 2 \\cdot ${n(p, 3)} \\cdot ${n(qv, 3)} = ${n(pq2, 4)} = ${n(pq2 * 100, 2)}#r "%"`), note: tx("Heterozygous carriers: 2pq.", "Heterozygote Überträger: 2pq."), highlight: ["r"] });
  if (ask === "dominant") frames.push({ math: line((n) => `p^2 = ${n(p, 3)}^2 = ${n(p * p, 4)} = ${n(p * p * 100, 2)}#r "%"`), note: tx("Homozygous dominant: p².", "Homozygot dominant: p²."), highlight: ["r"] });
  if (ask === "count")
    frames.push({
      math: line((n, l) => `2pq \\cdot ${resolve(big(pop), l)} = ${n(pq2, 4)} \\cdot ${resolve(big(pop), l)} = ${Math.round(pq2 * pop)}#r`),
      note: tx(`About ${Math.round(pq2 * pop)} carriers.`, `Etwa ${Math.round(pq2 * pop)} Überträger.`),
      highlight: ["r"],
    });

  return {
    instruction: asks[ask].instruction,
    text: tx(`${en(c.text)} Assume Hardy-Weinberg equilibrium. ${en(asks[ask].question)}`, `${de(c.text)} Nimm ein Hardy-Weinberg-Gleichgewicht an. ${de(asks[ask].question)}`),
    answer,
    hint: tx("Start with q²: the share of aa individuals. Then q = √q², p = 1 − q.", "Fang mit q² an: dem Anteil der aa-Individuen. Dann q = √q², p = 1 − q."),
    solution: frames,
    mistakes: m.list,
  };
}

const resolve = (t: Text, l: "en" | "de") => (l === "en" ? en(t) : de(t));

// ---------------------------------------------------------------------------
// Allele frequency by counting alleles

function alleleCountTask(rng: Rng): Exercise {
  const n = rng.pick([100, 200, 400, 500]);
  const aa = rng.int(Math.round(n * 0.04), Math.round(n * 0.35));
  const het = rng.int(Math.round(n * 0.15), Math.round(n * 0.5));
  const AA = n - aa - het;
  const askA = rng.chance(0.5);
  const value = round(askA ? (2 * AA + het) / (2 * n) : (2 * aa + het) / (2 * n), 6);
  const answer: AnswerSpec = { kind: "number", value, tolerance: 0.01, label: askA ? "p =" : "q =" };
  const m = mistakes(answer);
  const hom = askA ? AA : aa;
  const num = (v: number) => ({ kind: "number" as const, value: round(v, 6), tolerance: 0.01 });
  m.add(num(hom / n), tx("Genotype, not allele", "Genotyp, nicht Allel"), tx(`That's the share of the genotype ${askA ? "AA" : "aa"}, not the allele frequency. Heterozygotes carry the allele too.`, `Das ist der Anteil des Genotyps ${askA ? "AA" : "aa"}, nicht die Allelfrequenz. Heterozygote tragen das Allel auch.`));
  m.add(num((hom + het) / n), tx("Count alleles, not individuals", "Allele zählen, nicht Individuen"), tx(`That's the share of individuals carrying ${askA ? "A" : "a"}. But every individual has two alleles: divide by ${2 * n}.`, `Das ist der Anteil der Individuen, die ${askA ? "A" : "a"} tragen. Jedes Individuum hat aber zwei Allele: Teile durch ${2 * n}.`));
  m.add(num((hom + het) / (2 * n)), tx("Homozygotes count twice", "Homozygote zählen doppelt"), tx(`Each ${askA ? "AA" : "aa"} individual carries the allele twice, so count it twice.`, `Jedes ${askA ? "AA" : "aa"}-Individuum trägt das Allel zweimal, zähl es also doppelt.`));
  return {
    instruction: tx("Count the alleles", "Zähle die Allele"),
    text: tx(
      `A sample of ${n} individuals: ${AA} AA, ${het} Aa and ${aa} aa. Calculate the allele frequency ${askA ? "p of A" : "q of a"}.`,
      `Eine Stichprobe von ${n} Individuen: ${AA} AA, ${het} Aa und ${aa} aa. Berechne die Allelfrequenz ${askA ? "p von A" : "q von a"}.`,
    ),
    answer,
    hint: tx("Each individual has two alleles. Homozygotes carry the allele twice, heterozygotes once.", "Jedes Individuum hat zwei Allele. Homozygote tragen das Allel zweimal, Heterozygote einmal."),
    solution: [
      { math: tx(`2 \\cdot ${n} = ${2 * n} "alleles"#all`, `2 \\cdot ${n} = ${2 * n} "Allele"#all`), note: tx("First count all the alleles in the gene pool.", "Zähle zuerst alle Allele im Genpool.") },
      {
        math: line((d) => `${askA ? "p" : "q"} = \\frac{2 \\cdot ${hom} + ${het}}{${2 * n}} = ${d(value, 4)}#r`),
        note: tx(`${askA ? "AA" : "aa"} counts twice, Aa once.`, `${askA ? "AA" : "aa"} zählt doppelt, Aa einfach.`),
        highlight: ["r"],
      },
    ],
    mistakes: m.list,
  };
}

// Is the population in Hardy-Weinberg equilibrium?

const HW_VERDICT: Text[] = [
  tx("Yes: the genotypes match p², 2pq and q².", "Ja: Die Genotypen passen zu p², 2pq und q²."),
  tx("No: there are fewer heterozygotes than expected.", "Nein: Es gibt weniger Heterozygote als erwartet."),
  tx("No: there are more heterozygotes than expected.", "Nein: Es gibt mehr Heterozygote als erwartet."),
];

function hwCheckTask(rng: Rng): Exercise {
  const n = 400;
  const p = rng.pick([0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75]);
  const qv = 1 - p;
  let AA = Math.round(n * p * p);
  let het = Math.round(n * 2 * p * qv);
  let aa = n - AA - het;
  const mode = rng.int(0, 2) as 0 | 1 | 2;
  const s = Math.max(6, Math.round(het * 0.18));
  if (mode === 1) {
    AA += s;
    aa += s;
    het -= 2 * s;
  }
  if (mode === 2) {
    const t = Math.min(s, Math.floor(Math.min(AA, aa) / 2));
    AA -= t;
    aa -= t;
    het += 2 * t;
  }
  const pObs = (2 * AA + het) / (2 * n);
  const expected = Math.round(2 * pObs * (1 - pObs) * n);
  const { answer, mistakes: list } = category(HW_VERDICT, mode, {
    0: { title: tx("Compare with 2pq · N", "Vergleiche mit 2pq · N"), say: tx(`Compute p from the counts, then the expected heterozygotes 2pq · ${n}. Do they really match the observed ${het}?`, `Berechne p aus den Zahlen und dann die erwarteten Heterozygoten 2pq · ${n}. Passen sie wirklich zu den beobachteten ${het}?`) },
    1: { title: tx("Check the direction", "Prüf die Richtung"), say: tx(`Expected are about ${expected} heterozygotes. Are the observed ${het} really fewer?`, `Erwartet werden etwa ${expected} Heterozygote. Sind die beobachteten ${het} wirklich weniger?`) },
    2: { title: tx("Check the direction", "Prüf die Richtung"), say: tx(`Expected are about ${expected} heterozygotes. Are the observed ${het} really more?`, `Erwartet werden etwa ${expected} Heterozygote. Sind die beobachteten ${het} wirklich mehr?`) },
  }, rng);
  const why = [
    tx("Observed and expected match: the population is in Hardy-Weinberg equilibrium.", "Beobachtet und erwartet stimmen überein: Die Population ist im Hardy-Weinberg-Gleichgewicht."),
    tx("Too few heterozygotes: typical when mating isn't random, e.g. inbreeding or partners of the same phenotype (no panmixia).", "Zu wenige Heterozygote: typisch, wenn die Partnerwahl nicht zufällig ist, z. B. bei Inzucht oder Partnern mit gleichem Phänotyp (keine Panmixie)."),
    tx("Too many heterozygotes: for example when heterozygotes have an advantage (like sickle cell carriers in malaria regions).", "Zu viele Heterozygote: z. B. wenn Heterozygote einen Vorteil haben (wie Sichelzell-Überträger in Malariagebieten)."),
  ];
  return {
    instruction: tx("Check the equilibrium", "Prüfe das Gleichgewicht"),
    text: tx(`In a sample of ${n} individuals you find ${AA} AA, ${het} Aa and ${aa} aa. Is the population in Hardy-Weinberg equilibrium?`, `In einer Stichprobe von ${n} Individuen findest du ${AA} AA, ${het} Aa und ${aa} aa. Ist die Population im Hardy-Weinberg-Gleichgewicht?`),
    answer,
    hint: tx("First calculate p by counting alleles. Then compare the expected number of heterozygotes (2pq · N) with the observed one.", "Berechne zuerst p durch Allelzählen. Vergleiche dann die erwartete Zahl der Heterozygoten (2pq · N) mit der beobachteten."),
    solution: [
      { math: line((d) => `p = \\frac{2 \\cdot ${AA} + ${het}}{${2 * n}} = ${d(pObs, 3)}`), note: tx("Allele frequency from the counts.", "Die Allelfrequenz aus den Zahlen.") },
      { math: line((d) => `2pq \\cdot ${n} = 2 \\cdot ${d(pObs, 3)} \\cdot ${d(1 - pObs, 3)} \\cdot ${n} \\approx ${expected}#e`), note: tx(`Expected about ${expected} heterozygotes, observed ${het}.`, `Erwartet etwa ${expected} Heterozygote, beobachtet ${het}.`), highlight: ["e"] },
      { math: q(HW_VERDICT[mode], "v"), note: why[mode] },
    ],
    mistakes: list,
  };
}

// Which condition of the ideal population is violated?

type Cond = "large" | "panmixia" | "mutation" | "selection" | "migration";
const COND: Record<Cond, Text> = {
  large: tx("very large population (no drift)", "sehr große Population (keine Drift)"),
  panmixia: tx("random mating (panmixia)", "zufällige Partnerwahl (Panmixie)"),
  mutation: tx("no mutations", "keine Mutationen"),
  selection: tx("no selection", "keine Selektion"),
  migration: tx("no migration (gene flow)", "keine Zu- oder Abwanderung (Genfluss)"),
};
const COND_CASES: { c: Cond; text: Text }[] = [
  { c: "panmixia", text: tx("Most of the plants pollinate themselves.", "Die meisten Pflanzen bestäuben sich selbst.") },
  { c: "panmixia", text: tx("Individuals mostly mate with partners of the same colour.", "Die Individuen paaren sich meist mit Partnern gleicher Färbung.") },
  { c: "migration", text: tx("Every year, birds from a neighbouring population settle here.", "Jedes Jahr wandern Vögel aus einer Nachbarpopulation zu.") },
  { c: "migration", text: tx("Pollen from a field of another maize variety is blown into the field.", "Pollen von einem Feld einer anderen Maissorte weht in das Feld.") },
  { c: "large", text: tx("The island population consists of only 30 animals.", "Die Inselpopulation besteht aus nur 30 Tieren.") },
  { c: "large", text: tx("A forest fire kills a random half of a small population.", "Ein Waldbrand tötet zufällig die Hälfte einer kleinen Population.") },
  { c: "mutation", text: tx("Radiation creates a new allele in the germ cells.", "Strahlung erzeugt in den Keimzellen ein neues Allel.") },
  { c: "selection", text: tx("On light sand, owls catch dark mice more often than light ones.", "Auf hellem Sand fangen Eulen dunkle Mäuse häufiger als helle.") },
  { c: "selection", text: tx("Homozygous recessive individuals die before they can reproduce.", "Homozygot rezessive Individuen sterben, bevor sie sich fortpflanzen können.") },
];

const condSay = (right: Cond, picked: Cond) => {
  const what: Record<Cond, Text> = {
    large: tx("Drift happens when chance plays a big role: in small populations or random catastrophes.", "Drift tritt auf, wenn der Zufall eine große Rolle spielt: in kleinen Populationen oder bei zufälligen Katastrophen."),
    panmixia: tx("Panmixia is violated when partners are not chosen at random.", "Panmixie ist verletzt, wenn Partner nicht zufällig gewählt werden."),
    mutation: tx("That condition is about new alleles arising.", "Diese Bedingung betrifft die Entstehung neuer Allele."),
    selection: tx("Selection means some genotypes leave more offspring because of their traits.", "Selektion heißt: Manche Genotypen hinterlassen wegen ihrer Merkmale mehr Nachkommen."),
    migration: tx("Gene flow means alleles come in from, or leave for, another population.", "Genfluss heißt: Allele kommen aus einer anderen Population hinzu oder wandern ab."),
  };
  return { title: tx("Another condition", "Eine andere Bedingung"), say: tx(`${en(what[picked])} Is that what happens here?`, `${de(what[picked])} Passiert das hier?`) };
};

function conditionTask(rng: Rng): Exercise {
  const c = rng.pick(COND_CASES);
  const others = rng.shuffle((Object.keys(COND) as Cond[]).filter((x) => x !== c.c)).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: COND[c.c] }, ...others.map((o) => ({ text: COND[o], ...condSay(c.c, o) }))]);
  return {
    instruction: tx("Which condition is violated?", "Welche Bedingung ist verletzt?"),
    text: tx(`Which condition of an ideal (Hardy-Weinberg) population is violated? **${en(c.text)}**`, `Welche Bedingung einer idealen Population (Hardy-Weinberg) ist verletzt? **${de(c.text)}**`),
    answer,
    hint: tx("Ideal population: very large, random mating, no mutation, no selection, no migration.", "Ideale Population: sehr groß, zufällige Partnerwahl, keine Mutation, keine Selektion, keine Wanderung."),
    solution: [{ math: q(COND[c.c], "c"), note: c.text }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Forms of selection

const FORMS: Text[] = [tx("stabilising selection", "stabilisierende Selektion"), tx("directional selection", "transformierende (gerichtete) Selektion"), tx("disruptive selection", "disruptive Selektion")];
const FORM_IDX: Record<SelForm, 0 | 1 | 2> = { stabilizing: 0, directional: 1, disruptive: 2 };
const FORM_WHAT: Text[] = [
  tx("Extremes are at a disadvantage, the mean is favoured: the curve gets narrower and higher, the mean stays.", "Extreme sind im Nachteil, der Mittelwert wird begünstigt: Die Kurve wird schmaler und höher, der Mittelwert bleibt."),
  tx("One extreme is favoured: the whole curve shifts in one direction.", "Eine Extremform ist im Vorteil: Die ganze Kurve verschiebt sich in eine Richtung."),
  tx("Both extremes are favoured, the middle loses: two peaks arise.", "Beide Extreme sind im Vorteil, die Mitte verliert: Es entstehen zwei Gipfel."),
];

function formWrong(right: number) {
  const out: Partial<Record<number, { title: Text; say: Text }>> = {};
  const say = [
    { title: tx("Is the mean the same?", "Bleibt der Mittelwert?"), say: tx("Stabilising selection keeps the mean and narrows the curve. Look again at what happens to the peak.", "Stabilisierende Selektion behält den Mittelwert und macht die Kurve schmaler. Schau noch mal, was mit dem Gipfel passiert.") },
    { title: tx("Does the curve shift?", "Verschiebt sich die Kurve?"), say: tx("Directional selection shifts the whole curve to one side. Is that what you see?", "Transformierende Selektion verschiebt die ganze Kurve zu einer Seite. Siehst du das hier?") },
    { title: tx("Are there two peaks?", "Gibt es zwei Gipfel?"), say: tx("Disruptive selection splits the curve into two peaks, because the middle loses out. Is that what happens?", "Disruptive Selektion spaltet die Kurve in zwei Gipfel, weil die Mitte im Nachteil ist. Passiert das hier?") },
  ];
  [0, 1, 2].forEach((i) => i !== right && (out[i] = say[i]));
  return out;
}

function selGraphTask(rng: Rng, fixed?: { form: SelForm; dir: 1 | -1; trait: number }): Exercise {
  const form: SelForm = fixed?.form ?? rng.pick(["stabilizing", "directional", "disruptive"] as SelForm[]);
  const dir = fixed?.dir ?? (rng.chance(0.5) ? 1 : -1);
  const trait = fixed?.trait ?? rng.int(0, SEL_TRAITS.length - 1);
  const right = FORM_IDX[form];
  const { answer, mistakes: list } = category(FORMS, right, formWrong(right), rng);
  return {
    instruction: tx("Read the graph", "Werte das Diagramm aus"),
    text: tx(`The graph shows the ${en(SEL_TRAITS[trait])} in a population before and after many generations of selection. Which form of selection is this?`, `Das Diagramm zeigt die ${de(SEL_TRAITS[trait])} in einer Population vor und nach vielen Generationen Selektion. Welche Selektionsform liegt vor?`),
    visual: visual(SelectionGraph, { form, dir, trait }),
    answer,
    hint: tx("Compare the curves: does the mean shift, does the curve get narrower, or does it split?", "Vergleiche die Kurven: Verschiebt sich der Mittelwert, wird die Kurve schmaler, oder spaltet sie sich?"),
    solution: [{ math: q(FORMS[right], "f"), note: FORM_WHAT[right] }],
    mistakes: list,
  };
}

const FORM_CASES: { f: 0 | 1 | 2; text: Text }[] = [
  { f: 0, text: tx("Babies with very low or very high birth weight used to survive less often than babies of average weight.", "Babys mit sehr niedrigem oder sehr hohem Geburtsgewicht überlebten früher seltener als Babys mit mittlerem Gewicht.") },
  { f: 0, text: tx("Great tits that lay a medium number of eggs raise the most young that survive.", "Kohlmeisen mit einer mittleren Zahl an Eiern ziehen die meisten überlebenden Jungen groß.") },
  { f: 0, text: tx("After a winter storm, mostly sparrows of average wing length were found alive.", "Nach einem Wintersturm wurden vor allem Sperlinge mit mittlerer Flügellänge lebend gefunden.") },
  { f: 0, text: tx("Gall flies in medium-sized galls survive best: wasps attack small galls, birds peck open large ones.", "Gallfliegen in mittelgroßen Gallen überleben am besten: Wespen befallen kleine Gallen, Vögel hacken große auf.") },
  { f: 1, text: tx("After a drought, the average beak of the ground finches on an island is larger, because only hard seeds were left.", "Nach einer Dürre ist der Schnabel der Grundfinken auf einer Insel im Mittel größer, weil nur harte Samen übrig waren.") },
  { f: 1, text: tx("Within a few years, most mosquitoes in a region are resistant to an insecticide.", "Innerhalb weniger Jahre sind die meisten Stechmücken einer Region gegen ein Insektizid resistent.") },
  { f: 1, text: tx("In sooty industrial forests, dark peppered moths became more and more common.", "In rußigen Industriewäldern wurden dunkle Birkenspanner immer häufiger.") },
  { f: 2, text: tx("Seedcrackers with small beaks crack soft seeds, those with large beaks hard seeds; birds with medium beaks do worst.", "Purpurastrilde mit kleinen Schnäbeln knacken weiche Samen, die mit großen Schnäbeln harte; Vögel mit mittleren Schnäbeln schneiden am schlechtesten ab."),
  },
  { f: 2, text: tx("Small salmon males sneak matings, large males win fights; medium-sized males are the least successful.", "Kleine Lachsmännchen schleichen sich zur Paarung, große gewinnen Kämpfe; mittelgroße Männchen sind am wenigsten erfolgreich.") },
];

function selScenarioTask(rng: Rng): Exercise {
  const c = rng.pick(FORM_CASES);
  const { answer, mistakes: list } = category(FORMS, c.f, formWrong(c.f), rng);
  return {
    instruction: tx("Name the form of selection", "Nenne die Selektionsform"),
    text: tx(`Which form of selection is described? **${en(c.text)}**`, `Welche Selektionsform wird beschrieben? **${de(c.text)}**`),
    answer,
    hint: tx("Who is at a disadvantage: both extremes, one extreme, or the middle?", "Wer ist im Nachteil: beide Extreme, eine Extremform oder die Mitte?"),
    solution: [{ math: q(FORMS[c.f], "f"), note: FORM_WHAT[c.f] }],
    mistakes: list,
  };
}

// Sexual selection

const SEX: Text[] = [tx("intrasexual selection (competition)", "intrasexuelle Selektion (Konkurrenz)"), tx("intersexual selection (mate choice)", "intersexuelle Selektion (Partnerwahl)"), tx("natural selection by predators", "natürliche Selektion durch Fressfeinde")];
const SEX_CASES: { s: 0 | 1 | 2; text: Text }[] = [
  { s: 0, text: tx("Red deer stags fight with their antlers for a group of females.", "Rothirsche kämpfen mit ihren Geweihen um ein Rudel Weibchen.") },
  { s: 0, text: tx("Elephant seal bulls fight on the beach for a harem; only a few bulls mate.", "See-Elefantenbullen kämpfen am Strand um einen Harem; nur wenige Bullen paaren sich.") },
  { s: 0, text: tx("Stag beetle males wrestle with their huge jaws for access to females.", "Hirschkäfermännchen ringen mit ihren riesigen Oberkiefern um den Zugang zu Weibchen.") },
  { s: 1, text: tx("Peahens prefer males whose tails have many eyespots.", "Pfauenhennen bevorzugen Männchen, deren Schwanz viele Augenflecken hat.") },
  { s: 1, text: tx("Female widowbirds prefer males with long tails; males with experimentally lengthened tails got more females.", "Witwenvogel-Weibchen bevorzugen Männchen mit langen Schwänzen; Männchen mit künstlich verlängerten Schwänzen bekamen mehr Weibchen.") },
  { s: 1, text: tx("Female bowerbirds choose the male that has built and decorated the most impressive bower.", "Laubenvogel-Weibchen wählen das Männchen, das die eindrucksvollste Laube gebaut und geschmückt hat.") },
  { s: 2, text: tx("Guppies with very bright colours are eaten more often by predatory fish.", "Sehr bunte Guppys werden häufiger von Raubfischen gefressen.") },
];

function sexTask(rng: Rng): Exercise {
  const c = rng.pick(SEX_CASES);
  const { answer, mistakes: list } = category(SEX, c.s, {
    0: { title: tx("Is there a fight?", "Gibt es einen Kampf?"), say: tx("Intrasexual means competition within one sex, e.g. males fighting. Who decides here?", "Intrasexuell heißt Konkurrenz innerhalb eines Geschlechts, z. B. Kämpfe unter Männchen. Wer entscheidet hier?") },
    1: { title: tx("Is there a choice?", "Gibt es eine Wahl?"), say: tx("Intersexual means one sex chooses partners from the other. Does anyone choose here?", "Intersexuell heißt: Ein Geschlecht wählt Partner aus dem anderen. Wählt hier jemand?") },
    2: { title: tx("Mating success, not survival", "Paarungserfolg, nicht Überleben"), say: tx("This is about getting mates, not about surviving predators: sexual selection.", "Hier geht es darum, Partner zu bekommen, nicht darum, Fressfeinden zu entgehen: sexuelle Selektion.") },
  }, rng);
  const notes = [
    tx("Members of one sex compete with each other: intrasexual selection. It favours weapons like antlers and large bodies.", "Angehörige eines Geschlechts konkurrieren miteinander: intrasexuelle Selektion. Sie begünstigt Waffen wie Geweihe und große Körper."),
    tx("One sex (usually the females) chooses: intersexual selection. It favours ornaments like long tails, even if they are a burden for survival.", "Ein Geschlecht (meist die Weibchen) wählt: intersexuelle Selektion. Sie begünstigt Schmuckmerkmale wie lange Schwänze, selbst wenn sie das Überleben erschweren."),
    tx("Here predators decide who survives: natural selection, which works against the bright colours that females like.", "Hier entscheiden Fressfeinde, wer überlebt: natürliche Selektion, die gegen die bunten Farben wirkt, die Weibchen mögen."),
  ];
  return {
    instruction: tx("Which kind of selection?", "Welche Art von Selektion?"),
    text: c.text,
    answer,
    hint: tx("Fight within one sex, choice by the other sex, or survival?", "Kampf innerhalb eines Geschlechts, Wahl durch das andere Geschlecht oder Überleben?"),
    solution: [{ math: q(SEX[c.s], "s"), note: notes[c.s] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Coevolution, adaptive radiation, speciation

type Concept = "coevolution" | "radiation" | "sympatric" | "allopatric" | "convergence";
const CONCEPT: Record<Concept, Text> = {
  coevolution: tx("coevolution", "Koevolution"),
  radiation: tx("adaptive radiation", "adaptive Radiation"),
  sympatric: tx("sympatric speciation", "sympatrische Artbildung"),
  allopatric: tx("allopatric speciation", "allopatrische Artbildung"),
  convergence: tx("convergence (analogy)", "Konvergenz (Analogie)"),
};
const CONCEPT_CASES: { c: Concept; text: Text }[] = [
  { c: "coevolution", text: tx("An orchid in Madagascar hides its nectar at the end of a 30 cm long spur. Its pollinator, a hawk moth, has a proboscis just as long.", "Eine Orchidee auf Madagaskar versteckt ihren Nektar am Ende eines 30 cm langen Sporns. Ihr Bestäuber, ein Schwärmer, hat einen ebenso langen Rüssel.") },
  { c: "coevolution", text: tx("Hosts evolve better defences, parasites evolve new ways to infect them: an evolutionary arms race.", "Wirte entwickeln bessere Abwehr, Parasiten neue Wege, sie zu befallen: ein evolutionäres Wettrüsten.") },
  { c: "coevolution", text: tx("Yucca plants are pollinated only by yucca moths, whose caterpillars grow up only in yucca seeds.", "Yuccapalmen werden nur von Yuccamotten bestäubt, deren Raupen nur in Yuccasamen heranwachsen.") },
  { c: "radiation", text: tx("From one ancestral finch species on the Galápagos Islands, more than a dozen species with different beaks evolved, each using different food.", "Aus einer Finkenart auf den Galápagosinseln entstanden über ein Dutzend Arten mit verschiedenen Schnäbeln, die jeweils andere Nahrung nutzen.") },
  { c: "radiation", text: tx("In Lake Victoria, hundreds of cichlid species arose from a few ancestors in a short time, each specialised on different food.", "Im Viktoriasee entstanden aus wenigen Vorfahren in kurzer Zeit Hunderte Buntbarscharten, jede auf andere Nahrung spezialisiert.") },
  { c: "sympatric", text: tx("In a plant, a fault in meiosis doubles the chromosome set. The tetraploid plant can no longer produce fertile offspring with the diploid plants growing next to it.", "Bei einer Pflanze verdoppelt ein Fehler in der Meiose den Chromosomensatz. Die tetraploide Pflanze kann mit den diploiden Pflanzen daneben keine fruchtbaren Nachkommen mehr bilden.") },
  { c: "sympatric", text: tx("Some apple maggot flies switched from hawthorn to apple trees in the same area. They mate on their host fruit, so the two groups hardly mix any more.", "Einige Apfelfruchtfliegen wechselten im selben Gebiet vom Weißdorn auf Apfelbäume. Sie paaren sich auf ihrer Wirtsfrucht, deshalb mischen sich die beiden Gruppen kaum noch.") },
  { c: "allopatric", text: tx("The Grand Canyon separates two squirrel populations. Over a long time they become separate species.", "Der Grand Canyon trennt zwei Hörnchenpopulationen. Im Lauf langer Zeit werden sie zu getrennten Arten.") },
  { c: "convergence", text: tx("Moles and mole crickets have very similar digging legs, although one is a mammal and the other an insect.", "Maulwürfe und Maulwurfsgrillen haben sehr ähnliche Grabbeine, obwohl das eine ein Säugetier und das andere ein Insekt ist.") },
  { c: "convergence", text: tx("Sharks, extinct ichthyosaurs and dolphins all have a streamlined body.", "Haie, ausgestorbene Ichthyosaurier und Delfine haben alle einen stromlinienförmigen Körper.") },
];

const CONCEPT_TRAPS: Partial<Record<string, { title: Text; say: Text }>> = {
  "radiation>allopatric": { title: tx("Many species at once", "Viele Arten auf einmal"), say: tx("Separation by islands plays a part, true. But here one species gave rise to many, each adapted to a different niche: adaptive radiation.", "Trennung durch Inseln spielt eine Rolle, stimmt. Hier entstehen aber aus einer Art viele, jede an eine andere Nische angepasst: adaptive Radiation.") },
  "sympatric>allopatric": { title: tx("Same area", "Gleiches Gebiet"), say: tx("No barrier separates them in space: they live in the same area. Speciation without geographic separation is sympatric.", "Keine räumliche Barriere trennt sie: Sie leben im selben Gebiet. Artbildung ohne geografische Trennung ist sympatrisch.") },
  "allopatric>sympatric": { title: tx("Separated in space", "Räumlich getrennt"), say: tx("Here a geographic barrier separates the populations: allopatric speciation.", "Hier trennt eine geografische Barriere die Populationen: allopatrische Artbildung.") },
  "coevolution>convergence": { title: tx("Two species interact", "Zwei Arten wirken aufeinander"), say: tx("Here two species shape each other as selection factors. Convergence would be unrelated species becoming similar.", "Hier formen sich zwei Arten gegenseitig als Selektionsfaktoren. Konvergenz wären nicht verwandte Arten, die sich ähnlich werden.") },
  "convergence>coevolution": { title: tx("No interaction", "Keine Wechselwirkung"), say: tx("These animals don't influence each other. They became similar independently under similar conditions: convergence.", "Diese Tiere beeinflussen sich nicht. Sie wurden unabhängig unter ähnlichen Bedingungen ähnlich: Konvergenz.") },
};

function conceptTask(rng: Rng): Exercise {
  const c = rng.pick(CONCEPT_CASES);
  const others = rng.shuffle((Object.keys(CONCEPT) as Concept[]).filter((x) => x !== c.c)).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [
    { text: CONCEPT[c.c] },
    ...others.map((o) => ({
      text: CONCEPT[o],
      ...(CONCEPT_TRAPS[`${c.c}>${o}`] ?? { title: tx("Another process", "Ein anderer Vorgang"), say: tx(`Think about what exactly happens here. ${en(CONCEPT[o]).replace(/^./, (x) => x.toUpperCase())} describes something else.`, `Überleg, was hier genau passiert. ${de(CONCEPT[o]).replace(/^./, (x) => x.toUpperCase())} beschreibt etwas anderes.`) }),
    })),
  ]);
  const what: Record<Concept, Text> = {
    coevolution: tx("Coevolution: two species act as selection factors on each other and evolve in step.", "Koevolution: Zwei Arten wirken als Selektionsfaktoren aufeinander und entwickeln sich wechselseitig."),
    radiation: tx("Adaptive radiation: from one ancestral species, many species arise, each adapted to a different ecological niche.", "Adaptive Radiation: Aus einer Stammart entstehen viele Arten, jede an eine andere ökologische Nische angepasst."),
    sympatric: tx("Sympatric speciation: a new species arises in the same area, e.g. by polyploidy or a switch of host.", "Sympatrische Artbildung: Eine neue Art entsteht im selben Gebiet, z. B. durch Polyploidie oder Wirtswechsel."),
    allopatric: tx("Allopatric speciation: a geographic barrier separates populations, which then evolve apart.", "Allopatrische Artbildung: Eine geografische Barriere trennt Populationen, die sich dann auseinanderentwickeln."),
    convergence: tx("Convergence: unrelated species become similar under similar selection pressures (analogous organs).", "Konvergenz: Nicht verwandte Arten werden sich unter ähnlichem Selektionsdruck ähnlich (analoge Organe)."),
  };
  return {
    instruction: tx("Name the evolutionary process", "Benenne den Evolutionsvorgang"),
    text: tx(`Which term fits? **${en(c.text)}**`, `Welcher Begriff passt? **${de(c.text)}**`),
    answer,
    hint: tx("Two species interacting? One species becoming many? Same area or separated? Unrelated but similar?", "Zwei Arten im Wechselspiel? Eine Art wird zu vielen? Gleiches Gebiet oder getrennt? Nicht verwandt, aber ähnlich?"),
    solution: [{ math: q(CONCEPT[c.c], "c"), note: what[c.c] }],
    mistakes: list,
  };
}

// Polyploidy

const PLANTS: { name: Text; n2: number }[] = [
  { name: tx("rye", "Der Roggen"), n2: 14 },
  { name: tx("onion", "Die Küchenzwiebel"), n2: 16 },
  { name: tx("cabbage", "Der Kohl"), n2: 18 },
  { name: tx("maize", "Der Mais"), n2: 20 },
  { name: tx("tomato", "Die Tomate"), n2: 24 },
];

function polyploidTask(rng: Rng): Exercise {
  const pl = rng.pick(PLANTS);
  const x = pl.n2;
  const ask = rng.int(0, 2);
  const value = ask === 0 ? 2 * x : ask === 1 ? x : x + x / 2;
  const answer: AnswerSpec = { kind: "number", value, unit: tx("chromosomes", "Chromosomen") };
  const m = mistakes(answer);
  const nm = (v: number) => ({ kind: "number" as const, value: v });
  if (ask === 0) {
    m.add(nm(x), tx("Not doubled", "Nicht verdoppelt"), tx("Tetraploid means four sets instead of two: the chromosome number doubles.", "Tetraploid heißt vier Sätze statt zwei: Die Chromosomenzahl verdoppelt sich."));
    m.add(nm(4 * x), tx("Doubled twice", "Doppelt verdoppelt"), tx(`2n = ${x} already contains two sets. Four sets are twice that, not four times.`, `2n = ${x} enthält schon zwei Sätze. Vier Sätze sind das Doppelte, nicht das Vierfache.`));
  }
  if (ask === 1) {
    m.add(nm(2 * x), tx("Meiosis halves", "Die Meiose halbiert"), tx("Gametes arise by meiosis, which halves the chromosome number of the body cells.", "Keimzellen entstehen durch Meiose, und die halbiert die Chromosomenzahl der Körperzellen."));
    m.add(nm(x / 2), tx("Halved twice", "Doppelt halbiert"), tx(`The tetraploid plant has ${2 * x} chromosomes; its gametes get half of them.`, `Die tetraploide Pflanze hat ${2 * x} Chromosomen; ihre Keimzellen bekommen die Hälfte davon.`));
  }
  if (ask === 2) {
    m.add(nm(3 * x), tx("Gametes, not body cells", "Keimzellen, keine Körperzellen"), tx("The offspring arises from two gametes, not from two body cells. Halve each parent's number first.", "Der Nachkomme entsteht aus zwei Keimzellen, nicht aus zwei Körperzellen. Halbiere zuerst die Zahl jedes Elternteils."));
    m.add(nm(2 * x), tx("Both parents count", "Beide Eltern zählen"), tx(`The gamete of the tetraploid plant has ${x} chromosomes, that of the diploid plant ${x / 2}.`, `Die Keimzelle der tetraploiden Pflanze hat ${x} Chromosomen, die der diploiden Pflanze ${x / 2}.`));
  }
  const questions = [
    tx(`How many chromosomes do the body cells of a tetraploid (4n) ${en(pl.name)} plant have?`, `Wie viele Chromosomen haben die Körperzellen einer tetraploiden (4n) Pflanze?`),
    tx(`A tetraploid (4n) ${en(pl.name)} plant forms gametes. How many chromosomes does each gamete have?`, `Eine tetraploide (4n) Pflanze bildet Keimzellen. Wie viele Chromosomen hat jede Keimzelle?`),
    tx(`The tetraploid (4n) plant is crossed back with a diploid (2n) ${en(pl.name)} plant. How many chromosomes do the offspring have?`, `Die tetraploide (4n) Pflanze wird mit einer diploiden (2n) Pflanze rückgekreuzt. Wie viele Chromosomen haben die Nachkommen?`),
  ];
  const sol: Frame[] = [
    { math: tx(`2n = ${x} \\Rightarrow n = ${x / 2}`, `2n = ${x} \\Rightarrow n = ${x / 2}`), note: tx("One chromosome set (n) is half of the diploid number.", "Ein Chromosomensatz (n) ist die Hälfte der diploiden Zahl.") },
    ask === 0
      ? { math: tx(`4n = 4 \\cdot ${x / 2} = ${2 * x}#r`, `4n = 4 \\cdot ${x / 2} = ${2 * x}#r`), note: tx("Four sets.", "Vier Sätze."), highlight: ["r"] }
      : ask === 1
        ? { math: tx(`\\frac{4n}{2} = 2n = ${x}#r`, `\\frac{4n}{2} = 2n = ${x}#r`), note: tx("Meiosis halves: the gametes of a tetraploid plant are diploid.", "Die Meiose halbiert: Die Keimzellen einer tetraploiden Pflanze sind diploid."), highlight: ["r"] }
        : { math: tx(`2n + n = 3n = ${x} + ${x / 2} = ${x + x / 2}#r`, `2n + n = 3n = ${x} + ${x / 2} = ${x + x / 2}#r`), note: tx("A diploid gamete (2n) meets a haploid one (n): the offspring is triploid (3n) and sterile, because three sets can't be paired and split evenly in meiosis.", "Eine diploide Keimzelle (2n) trifft eine haploide (n): Der Nachkomme ist triploid (3n) und unfruchtbar, weil sich drei Sätze in der Meiose nicht paarweise verteilen lassen."), highlight: ["r"] },
  ];
  return {
    instruction: tx("Calculate the chromosome number", "Berechne die Chromosomenzahl"),
    text: tx(`Diploid ${en(pl.name)} plants have 2n = ${x} chromosomes. A fault in meiosis produces a tetraploid plant. ${en(questions[ask])}`, `${de(pl.name)} ist diploid mit 2n = ${x} Chromosomen. Durch einen Fehler in der Meiose entsteht eine tetraploide Pflanze. ${de(questions[ask])}`),
    answer,
    hint: tx("n is one chromosome set. Gametes get half of the body cell's sets.", "n ist ein Chromosomensatz. Keimzellen bekommen die Hälfte der Sätze der Körperzelle."),
    solution: sol,
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Molecular evidence

const CYTO: { name: Text; d: number }[] = [
  { name: tx("chimpanzee", "Schimpanse"), d: 0 },
  { name: tx("rhesus monkey", "Rhesusaffe"), d: 1 },
  { name: tx("rabbit", "Kaninchen"), d: 9 },
  { name: tx("horse", "Pferd"), d: 12 },
  { name: tx("chicken", "Huhn"), d: 13 },
  { name: tx("rattlesnake", "Klapperschlange"), d: 14 },
  { name: tx("tuna", "Thunfisch"), d: 21 },
  { name: tx("silk moth", "Seidenspinner"), d: 31 },
  { name: tx("wheat", "Weizen"), d: 43 },
  { name: tx("baker's yeast", "Bäckerhefe"), d: 45 },
];

function cytoTask(rng: Rng): Exercise {
  const picked = rng
    .shuffle(CYTO)
    .slice(0, 5)
    .filter((x, i, arr) => arr.findIndex((y) => y.d === x.d) === i);
  const closest = rng.chance(0.6);
  const sorted = [...picked].sort((a, b) => a.d - b.d);
  const right = closest ? sorted[0] : sorted[sorted.length - 1];
  const opposite = closest ? sorted[sorted.length - 1] : sorted[0];
  const options = rng.shuffle(picked);
  const { answer, mistakes: list } = choice(rng, [
    { text: right.name },
    ...options
      .filter((o) => o !== right)
      .map((o) =>
        o === opposite
          ? {
              text: o.name,
              title: tx("The other end", "Das andere Ende"),
              say: closest
                ? tx("That one has the most differences. More differences mean the lineages split earlier: less closely related.", "Hier gibt es die meisten Unterschiede. Mehr Unterschiede heißt: Die Linien haben sich früher getrennt, also weniger nah verwandt.")
                : tx("That one has the fewest differences: it's the closest relative here.", "Hier gibt es die wenigsten Unterschiede: Das ist hier der nächste Verwandte."),
            }
          : { text: o.name, title: tx("Compare all values", "Vergleiche alle Werte"), say: tx("Look at all the numbers in the table, not just a few.", "Schau dir alle Zahlen in der Tabelle an, nicht nur einige.") },
      ),
  ]);
  return {
    instruction: tx("Interpret the sequence data", "Werte die Sequenzdaten aus"),
    text: closest
      ? tx("The table shows how many amino acids of cytochrome c differ from the human protein. Which species is most closely related to humans?", "Die Tabelle zeigt, in wie vielen Aminosäuren sich das Cytochrom c vom menschlichen Protein unterscheidet. Welche Art ist am nächsten mit dem Menschen verwandt?")
      : tx("The table shows how many amino acids of cytochrome c differ from the human protein. Which species is most distantly related to humans?", "Die Tabelle zeigt, in wie vielen Aminosäuren sich das Cytochrom c vom menschlichen Protein unterscheidet. Welche Art ist am entferntesten mit dem Menschen verwandt?"),
    visual: visual(EvolutionTable, { head: [tx("species", "Art"), tx("differences", "Unterschiede")], rows: options.map((o) => [o.name, String(o.d)] as [Text, string]), caption: tx("Cytochrome c, 104 amino acids, compared with humans", "Cytochrom c, 104 Aminosäuren, verglichen mit dem Menschen") }),
    answer,
    hint: tx("Fewer differences in the sequence mean a more recent common ancestor.", "Weniger Unterschiede in der Sequenz bedeuten einen jüngeren gemeinsamen Vorfahren."),
    solution: [
      { math: tx('"fewer differences"#a \\Rightarrow "closer relatives"#b', '"weniger Unterschiede"#a \\Rightarrow "näher verwandt"#b'), note: tx("Mutations accumulate over time. The longer two lineages have been separate, the more differences.", "Mutationen sammeln sich im Lauf der Zeit an. Je länger zwei Linien getrennt sind, desto mehr Unterschiede.") },
      { math: join2(right.name, right.d), note: closest ? tx(`${en(right.name)}: only ${right.d} difference${right.d === 1 ? "" : "s"}.`, `${de(right.name)}: nur ${right.d} Unterschied${right.d === 1 ? "" : "e"}.`) : tx(`${en(right.name)}: ${right.d} differences, the most here.`, `${de(right.name)}: ${right.d} Unterschiede, die meisten hier.`) },
    ],
    mistakes: list,
  };
}

const join2 = (name: Text, d: number): Text => tx(`"${en(name)}"#n \\; ${d}#d`, `"${de(name)}"#n \\; ${d}#d`);

/** Molecular clock: differences grow in proportion to the time since the split. */
function clockTask(rng: Rng): Exercise {
  for (let tries = 0; tries < 50; tries++) {
    const t1 = rng.pick([20, 30, 40, 60, 80, 90, 120]);
    const n1 = rng.pick([4, 6, 8, 10, 12, 15, 20, 24]);
    const n2 = rng.int(2, 40);
    if (n2 === n1 || (t1 * n2) % n1) continue;
    const t2 = (t1 * n2) / n1;
    if (t2 > 400 || t2 < 5) continue;
    const answer: AnswerSpec = { kind: "number", value: t2, unit: tx("million years", "Mio. Jahre"), tolerance: 0.01 };
    const m = mistakes(answer);
    const nm = (v: number) => ({ kind: "number" as const, value: round(v, 6), tolerance: 0.01 });
    m.add(nm((t1 * n1) / n2), tx("Ratio upside down", "Verhältnis verkehrt"), tx("More differences mean more time, not less. Time and differences grow in proportion.", "Mehr Unterschiede bedeuten mehr Zeit, nicht weniger. Zeit und Unterschiede wachsen proportional."));
    m.add(nm(t1 + n2 - n1), tx("Proportional, not added", "Proportional, nicht addiert"), tx("A molecular clock ticks at a constant rate: work out the time per difference first.", "Eine molekulare Uhr tickt gleichmäßig: Berechne zuerst die Zeit pro Unterschied."));
    m.add(nm(t1 * n2), tx("Divide by the differences", "Durch die Unterschiede teilen"), tx(`${t1} million years belong to ${n1} differences, not to one.`, `${t1} Millionen Jahre gehören zu ${n1} Unterschieden, nicht zu einem.`));
    const rate = t1 / n1;
    return {
      instruction: tx("Use the molecular clock", "Nutze die molekulare Uhr"),
      text: tx(
        `In a gene, species A and B differ in ${n1} positions. Fossils show that their lineages split ${t1} million years ago. Species A and C differ in ${n2} positions. Assuming a constant rate of change, when did A and C split?`,
        `In einem Gen unterscheiden sich die Arten A und B an ${n1} Positionen. Fossilien zeigen, dass sich ihre Linien vor ${t1} Millionen Jahren getrennt haben. Die Arten A und C unterscheiden sich an ${n2} Positionen. Wann haben sich A und C getrennt, wenn die Änderungsrate konstant ist?`,
      ),
      answer,
      hint: tx("How many million years correspond to one difference?", "Wie viele Millionen Jahre entsprechen einem Unterschied?"),
      solution: [
        { math: line((d) => `\\frac{${t1}}{${n1}} = ${d(rate, 3)}#k`), note: tx(`Calibration: ${en(N(rate, 3))} million years per difference.`, `Eichung: ${de(N(rate, 3))} Millionen Jahre pro Unterschied.`) },
        { math: line((d) => `${n2} \\cdot ${d(rate, 3)}#k = ${t2}#r`), note: tx(`A and C split about ${t2} million years ago.`, `A und C haben sich vor etwa ${t2} Millionen Jahren getrennt.`), highlight: ["r"] },
      ],
      mistakes: m.list,
    };
  }
  return cytoTask(rng);
}

// ---------------------------------------------------------------------------
// Cladistics

const TERM3: Text[] = [tx("synapomorphy", "Synapomorphie"), tx("plesiomorphy", "Plesiomorphie"), tx("autapomorphy", "Autapomorphie")];
const charNo = (id: CharacterId) => CHARACTERS.findIndex((c) => c.id === id) + 1;
const charName = (id: CharacterId) => CHARACTERS.find((c) => c.id === id)!.name;

const TERM_CASES: { ch: CharacterId; leaves: LeafId[]; t: 0 | 1 | 2; compare: boolean; why: Text }[] = [
  { ch: "amnion", leaves: ["mouse", "lizard", "croc", "bird"], t: 0, compare: false, why: tx("The amnion arose in their common ancestor and is shared by all its descendants: a synapomorphy of the amniotes.", "Das Amnion entstand bei ihrem gemeinsamen Vorfahren und ist allen Nachfahren gemeinsam: eine Synapomorphie der Amnioten.") },
  { ch: "window", leaves: ["croc", "bird"], t: 0, compare: false, why: tx("This skull opening is a derived character only crocodiles and birds share: a synapomorphy of the archosaurs.", "Diese Schädelöffnung ist ein abgeleitetes Merkmal, das nur Krokodile und Vögel teilen: eine Synapomorphie der Archosaurier.") },
  { ch: "limbs", leaves: ["frog", "mouse", "lizard", "croc", "bird"], t: 0, compare: false, why: tx("Four limbs arose in the ancestor of all tetrapods: a synapomorphy of the tetrapods.", "Vier Gliedmaßen entstanden beim Vorfahren aller Tetrapoden: eine Synapomorphie der Tetrapoden.") },
  { ch: "bone", leaves: ["trout", "frog", "mouse", "lizard", "croc", "bird"], t: 0, compare: false, why: tx("The bony skeleton is shared by the trout and all tetrapods, but not by the shark: a synapomorphy of this group.", "Das Knochenskelett teilen die Forelle und alle Tetrapoden, aber nicht der Hai: eine Synapomorphie dieser Gruppe.") },
  { ch: "limbs", leaves: ["lizard", "bird"], t: 1, compare: true, why: tx("Lizard and bird both have four limbs, but so do frogs and mice: the character is older than their common ancestor. It says nothing about their closer relationship: a plesiomorphy.", "Eidechse und Vogel haben vier Gliedmaßen, aber Frosch und Maus auch: Das Merkmal ist älter als ihr gemeinsamer Vorfahre. Es sagt nichts über ihre nähere Verwandtschaft: eine Plesiomorphie.") },
  { ch: "jaws", leaves: ["frog", "mouse"], t: 1, compare: true, why: tx("All vertebrates here have jaws. For frog and mouse it is an original, ancestral character: a plesiomorphy.", "Alle Wirbeltiere hier haben Kiefer. Für Frosch und Maus ist das ein ursprüngliches Merkmal: eine Plesiomorphie.") },
  { ch: "amnion", leaves: ["croc", "bird"], t: 1, compare: true, why: tx("Crocodile and bird have an amnion, but so do lizards and mice. Within this comparison it is ancestral: a plesiomorphy.", "Krokodil und Vogel haben ein Amnion, aber Eidechse und Maus auch. Innerhalb dieses Vergleichs ist es ursprünglich: eine Plesiomorphie.") },
  { ch: "feathers", leaves: ["bird"], t: 2, compare: false, why: tx("Only birds have feathers here: a derived character of a single taxon, an autapomorphy.", "Nur Vögel haben hier Federn: ein abgeleitetes Merkmal eines einzelnen Taxons, eine Autapomorphie.") },
  { ch: "hair", leaves: ["mouse"], t: 2, compare: false, why: tx("Only the mouse (mammals) has hair and mammary glands: an autapomorphy.", "Nur die Maus (Säugetiere) hat Haare und Milchdrüsen: eine Autapomorphie.") },
];

function cladeTermTask(rng: Rng): Exercise {
  const c = rng.pick(TERM_CASES);
  const names = listText(c.leaves.map((l) => LEAVES[l]));
  const { answer, mistakes: list } = category(TERM3, c.t, {
    0: { title: tx("Shared, but not new for them", "Geteilt, aber für sie nicht neu"), say: c.t === 1 ? tx("They share it, but so do others outside their group: it's older than their common ancestor.", "Sie teilen es, aber andere außerhalb ihrer Gruppe auch: Es ist älter als ihr gemeinsamer Vorfahre.") : tx("A synapomorphy is shared by several taxa. Here only one taxon has it.", "Eine Synapomorphie teilen mehrere Taxa. Hier hat es nur ein Taxon.") },
    1: { title: tx("Derived, not original", "Abgeleitet, nicht ursprünglich"), say: tx("A plesiomorphy is an original character that others outside the group have too. Does anyone outside have it here?", "Eine Plesiomorphie ist ein ursprüngliches Merkmal, das auch andere außerhalb der Gruppe haben. Hat es hier jemand außerhalb?") },
    2: { title: tx("More than one taxon", "Mehr als ein Taxon"), say: tx("An autapomorphy belongs to one single taxon. Here several share the character.", "Eine Autapomorphie gehört zu einem einzigen Taxon. Hier teilen sich mehrere das Merkmal.") },
  }, rng);
  return {
    instruction: tx("Read the cladogram", "Lies das Kladogramm"),
    text: c.compare
      ? tx(`Character ${charNo(c.ch)} (${en(charName(c.ch))}): what is it when comparing ${en(names)}?`, `Merkmal ${charNo(c.ch)} (${de(charName(c.ch))}): Was ist es beim Vergleich von ${de(names)}?`)
      : tx(`Character ${charNo(c.ch)} (${en(charName(c.ch))}): what is it for the group ${en(names)}?`, `Merkmal ${charNo(c.ch)} (${de(charName(c.ch))}): Was ist es für die Gruppe ${de(names)}?`),
    visual: visual(EvolutionCladogramFigure, { lit: [c.ch], leaves: c.leaves }),
    answer,
    hint: tx("Where on the tree did the character arise? Who else has it?", "Wo im Baum ist das Merkmal entstanden? Wer hat es noch?"),
    solution: [{ math: q(TERM3[c.t], "t"), note: c.why }],
    mistakes: list,
  };
}

const PHYLY_OPTS: Text[] = [PHYLY.mono, PHYLY.para, PHYLY.poly];
const PHYLY_IDX: Record<Phyly, 0 | 1 | 2> = { mono: 0, para: 1, poly: 2 };
const EXTRA_GROUPS = [
  { id: "anamnia", name: tx("animals without an amnion (shark, trout, frog)", "Tiere ohne Amnion (Hai, Forelle, Frosch)"), leaves: ["shark", "trout", "frog"] as LeafId[], phyly: "para" as Phyly, why: tx("Their last common ancestor is the ancestor of all vertebrates here, but the amniotes are left out: paraphyletic.", "Ihr letzter gemeinsamer Vorfahre ist der aller Wirbeltiere hier, doch die Amnioten fehlen: paraphyletisch.") },
  { id: "sauropsids", name: tx("lizard, crocodile and bird", "Eidechse, Krokodil und Vogel"), leaves: ["lizard", "croc", "bird"] as LeafId[], phyly: "mono" as Phyly, why: tx("Their last common ancestor and all its descendants: monophyletic. Reptiles in this sense include the birds.", "Ihr letzter gemeinsamer Vorfahre mit allen Nachfahren: monophyletisch. Reptilien in diesem Sinn schließen die Vögel ein.") },
];

function cladeGroupTask(rng: Rng, fixedId?: string): Exercise {
  const all = [...GROUPS, ...EXTRA_GROUPS];
  const g = fixedId ? all.find((x) => x.id === fixedId)! : rng.pick(all);
  const right = PHYLY_IDX[g.phyly];
  const { answer, mistakes: list } = category(PHYLY_OPTS, right, {
    0: {
      title: tx("Someone is missing", "Da fehlt jemand"),
      say: right === 1 ? tx("Look at all descendants of their last common ancestor. Is any of them left out?", "Schau dir alle Nachfahren ihres letzten gemeinsamen Vorfahren an. Fehlt einer davon?") : tx("Is their last common ancestor part of the group? Did the shared trait arise once, or twice independently?", "Gehört ihr letzter gemeinsamer Vorfahre zur Gruppe? Ist das gemeinsame Merkmal einmal entstanden oder zweimal unabhängig?"),
    },
    1: {
      title: tx("Check the ancestor", "Prüf den Vorfahren"),
      say: right === 0 ? tx("Paraphyletic would mean some descendants are left out. Here the group holds the ancestor and all its descendants.", "Paraphyletisch hieße, dass Nachfahren fehlen. Hier enthält die Gruppe den Vorfahren und alle seine Nachfahren.") : tx("Paraphyletic groups contain their common ancestor. Here the shared trait arose twice: the ancestor isn't part of the group.", "Paraphyletische Gruppen enthalten ihren gemeinsamen Vorfahren. Hier ist das gemeinsame Merkmal zweimal entstanden: Der Vorfahre gehört nicht dazu."),
    },
    2: { title: tx("One common origin", "Ein gemeinsamer Ursprung"), say: tx("Polyphyletic groups are based on traits that arose independently. Here the group goes back to one common ancestor.", "Polyphyletische Gruppen beruhen auf unabhängig entstandenen Merkmalen. Hier geht die Gruppe auf einen gemeinsamen Vorfahren zurück.") },
  }, rng);
  return {
    instruction: tx("Classify the group", "Ordne die Gruppe ein"),
    text: tx(`Look at the cladogram. Is the group **${en(g.name)}** monophyletic, paraphyletic or polyphyletic?`, `Schau dir das Kladogramm an. Ist die Gruppe **${de(g.name)}** monophyletisch, paraphyletisch oder polyphyletisch?`),
    visual: visual(EvolutionCladogramFigure, { leaves: g.leaves }),
    answer,
    hint: tx("Find the last common ancestor of the group. Are all its descendants in the group? Is the ancestor itself part of it?", "Such den letzten gemeinsamen Vorfahren der Gruppe. Gehören alle seine Nachfahren dazu? Gehört er selbst dazu?"),
    solution: [{ math: q(PHYLY[g.phyly], "p"), note: g.why }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  switch (rng.int(0, 15)) {
    case 0:
    case 1:
    case 2:
      return hwTask(rng);
    case 3:
      return alleleCountTask(rng);
    case 4:
      return hwCheckTask(rng);
    case 5:
      return conditionTask(rng);
    case 6:
      return selGraphTask(rng);
    case 7:
      return selScenarioTask(rng);
    case 8:
      return sexTask(rng);
    case 9:
      return conceptTask(rng);
    case 10:
      return polyploidTask(rng);
    case 11:
      return cytoTask(rng);
    case 12:
      return clockTask(rng);
    case 13:
      return cladeTermTask(rng);
    default:
      return cladeGroupTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const checkHw = hwTask(createRng(1), { c: CF, ask: "carriers" });
const checkSel = selGraphTask(createRng(2), { form: "disruptive", dir: 1, trait: 0 });
const checkClade = cladeGroupTask(createRng(3), "reptiles");

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Gene pool and the Hardy-Weinberg law", "Genpool und Hardy-Weinberg-Gesetz"),
      blob: tx("Evolution in numbers: let's count alleles!", "Evolution in Zahlen: Zählen wir Allele!"),
      body: tx(
        "In the **synthetic theory of evolution**, the unit of evolution is the **population**: all individuals of a species in one area that can interbreed. All the alleles of all its individuals form the **gene pool**.",
        "In der **synthetischen Evolutionstheorie** ist die Einheit der Evolution die **Population**: alle Individuen einer Art in einem Gebiet, die sich miteinander fortpflanzen können. Alle Allele aller ihrer Individuen bilden den **Genpool**.",
      ),
      frames: [
        { math: tx('36 "AA"#g1 + 48 "Aa"#g2 + 16 "aa"#g3 = 100 "individuals"#n', '36 "AA"#g1 + 48 "Aa"#g2 + 16 "aa"#g3 = 100 "Individuen"#n'), note: tx("Example: 100 individuals with the genotypes AA, Aa and aa. Together they carry 200 alleles.", "Beispiel: 100 Individuen mit den Genotypen AA, Aa und aa. Zusammen tragen sie 200 Allele.") },
        { math: tx("p = \\frac{2 \\cdot 36 + 48}{200} = 0.6#p", "p = \\frac{2 \\cdot 36 + 48}{200} = 0,6#p"), note: tx("**Allele frequency** p of A: AA carries A twice, Aa once. Divide by all 200 alleles.", "**Allelfrequenz** p von A: AA trägt A zweimal, Aa einmal. Geteilt durch alle 200 Allele.") },
        { math: tx("p + q = 1 \\Rightarrow q = 0.4#q", "p + q = 1 \\Rightarrow q = 0,4#q"), note: tx("With only two alleles, their frequencies add up to 1.", "Bei nur zwei Allelen ergeben ihre Frequenzen zusammen 1.") },
        {
          math: tx("p^2 + 2pq + q^2 = 1", "p^2 + 2pq + q^2 = 1"),
          note: tx(
            "**Hardy-Weinberg law**: in an ideal population, allele and genotype frequencies stay the same from generation to generation. The genotypes then occur as p² (AA), 2pq (Aa) and q² (aa).",
            "**Hardy-Weinberg-Gesetz**: In einer idealen Population bleiben Allel- und Genotypfrequenzen von Generation zu Generation gleich. Die Genotypen treten dann mit p² (AA), 2pq (Aa) und q² (aa) auf.",
          ),
        },
        { math: tx("0.36 + 0.48 + 0.16 = 1", "0,36 + 0,48 + 0,16 = 1"), note: tx("Check: p² = 0.36, 2pq = 0.48, q² = 0.16. Exactly what we counted: this population is in equilibrium.", "Probe: p² = 0,36, 2pq = 0,48, q² = 0,16. Genau das haben wir gezählt: Diese Population ist im Gleichgewicht.") },
        {
          math: tx('"ideal population"#i', '"ideale Population"#i'),
          note: tx(
            "Conditions: very large (no drift), random mating (panmixia), no mutation, no selection, no migration. Real populations never meet them all. That's exactly why **evolution = change of allele frequencies** happens.",
            "Bedingungen: sehr groß (keine Drift), zufällige Partnerwahl (Panmixie), keine Mutation, keine Selektion, keine Zu- und Abwanderung. Echte Populationen erfüllen sie nie alle. Genau deshalb findet **Evolution = Änderung der Allelfrequenzen** statt.",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("The Hardy-Weinberg calculator", "Der Hardy-Weinberg-Rechner"),
      blob: tx("You can't see carriers. But you can calculate them!", "Überträger sieht man nicht. Aber man kann sie berechnen!"),
      body: tx(
        "Usually you only see phenotypes. Homozygous recessive individuals (aa) can be recognised, so their share q² is known. From it: q = √q², p = 1 − q, and the carriers 2pq. Try the presets and the slider.",
        "Meist sieht man nur die Phänotypen. Homozygot rezessive Individuen (aa) erkennt man, ihr Anteil q² ist also bekannt. Daraus folgt q = √q², p = 1 − q und der Anteil der Überträger 2pq. Probier die Beispiele und den Regler aus.",
      ),
      widget: EvolutionHardyWeinberg,
    },
    { type: "check", blob: tx("A classic exam task. Take it step by step!", "Eine klassische Abituraufgabe. Schritt für Schritt!"), exercise: checkHw },
    {
      type: "widget",
      title: tx("Genetic drift and selection", "Gendrift und Selektion"),
      blob: tx("Roll the dice for whole populations!", "Würfle mit ganzen Populationen!"),
      body: tx(
        "Six populations each start with p(A) = 0.5. In every generation the alleles of the next generation are drawn at random from the gene pool. Compare small and large populations, with and without selection.",
        "Sechs Populationen starten jeweils mit p(A) = 0,5. In jeder Generation werden die Allele der nächsten Generation zufällig aus dem Genpool gezogen. Vergleiche kleine und große Populationen, mit und ohne Selektion.",
      ),
      widget: EvolutionDrift,
    },
    {
      type: "explain",
      title: tx("Forms of selection", "Selektionsformen"),
      blob: tx("Selection can push, squeeze or split a population.", "Selektion kann eine Population verschieben, zusammendrücken oder aufspalten."),
      body: tx("Selection acts on the phenotypes of a population. Depending on which phenotypes are favoured, the frequency distribution changes in different ways.", "Selektion wirkt auf die Phänotypen einer Population. Je nachdem, welche Phänotypen begünstigt werden, verändert sich die Häufigkeitsverteilung unterschiedlich."),
      frames: [
        { math: tx('"stabilising"#s', '"stabilisierend"#s'), note: tx("**Stabilising**: extremes are at a disadvantage, the mean is favoured; the variation shrinks. In a constant environment. Example: human birth weight.", "**Stabilisierend**: Extreme sind im Nachteil, der Mittelwert wird begünstigt; die Variationsbreite sinkt. Bei konstanter Umwelt. Beispiel: Geburtsgewicht des Menschen.") },
        { math: tx('"stabilising"#s \\quad "directional"#t', '"stabilisierend"#s \\quad "transformierend"#t'), note: tx("**Directional (transforming)**: one extreme is favoured, the mean shifts. After an environmental change. Examples: peppered moth, antibiotic resistance.", "**Transformierend (gerichtet)**: Eine Extremform ist im Vorteil, der Mittelwert verschiebt sich. Nach einer Umweltänderung. Beispiele: Birkenspanner, Antibiotikaresistenz.") },
        { math: tx('"stabilising"#s \\quad "directional"#t \\\\ "disruptive"#d', '"stabilisierend"#s \\quad "transformierend"#t \\\\ "disruptiv"#d'), note: tx("**Disruptive**: both extremes are favoured, the middle loses. Two peaks can arise, a possible start of new species.", "**Disruptiv**: Beide Extreme sind im Vorteil, die Mitte verliert. Es können zwei Gipfel entstehen, ein möglicher Anfang neuer Arten.") },
        {
          math: tx('"sexual selection"#x', '"sexuelle Selektion"#x'),
          note: tx(
            "**Sexual selection** favours traits that bring more mates. Intrasexual: competition within one sex (stags fighting with antlers). Intersexual: choice by the other sex (peahens choose males with many eyespots). Such traits may even hinder survival, as long as they bring more offspring.",
            "**Sexuelle Selektion** begünstigt Merkmale, die mehr Partner bringen. Intrasexuell: Konkurrenz innerhalb eines Geschlechts (Hirsche kämpfen mit Geweihen). Intersexuell: Wahl durch das andere Geschlecht (Pfauenhennen wählen Männchen mit vielen Augenflecken). Solche Merkmale dürfen das Überleben sogar erschweren, solange sie mehr Nachkommen bringen.",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Selection forms in motion", "Selektionsformen in Bewegung"),
      blob: tx("Watch the curve: does it slide, shrink or split?", "Beobachte die Kurve: Rutscht sie, schrumpft sie oder spaltet sie sich?"),
      body: tx("The red zones show where selection works against the individuals. Choose a form and let the generations pass.", "Die roten Bereiche zeigen, wo die Selektion gegen die Individuen wirkt. Wähle eine Form und lass die Generationen ablaufen."),
      widget: EvolutionSelection,
    },
    { type: "check", blob: tx("Read the graph like in the Abitur.", "Lies das Diagramm wie im Abitur."), exercise: checkSel },
    {
      type: "explain",
      title: tx("Coevolution, radiation and polyploidy", "Koevolution, Radiation und Polyploidie"),
      blob: tx("Species shape each other, and sometimes one becomes many.", "Arten formen sich gegenseitig, und manchmal wird aus einer viele."),
      frames: [
        {
          math: tx('"coevolution"#k', '"Koevolution"#k'),
          note: tx(
            "**Coevolution**: two species act as selection factors on each other. The orchid Angraecum sesquipedale hides its nectar 30 cm deep; Darwin predicted a moth with an equally long proboscis. It was found in 1903. Host and parasite: an arms race.",
            "**Koevolution**: Zwei Arten wirken wechselseitig als Selektionsfaktoren. Die Orchidee Angraecum sesquipedale versteckt ihren Nektar 30 cm tief; Darwin sagte einen Falter mit ebenso langem Rüssel voraus. Er wurde 1903 gefunden. Wirt und Parasit: ein Wettrüsten.",
          ),
        },
        { math: tx('"adaptive radiation"#r', '"adaptive Radiation"#r'), note: tx("**Adaptive radiation**: from one ancestral species, many species arise in a short time, each adapted to a different niche: Darwin's finches, cichlids in Lake Victoria.", "**Adaptive Radiation**: Aus einer Stammart entstehen in kurzer Zeit viele Arten, jede an eine andere Nische angepasst: Darwinfinken, Buntbarsche im Viktoriasee.") },
        { math: tx('"sympatric speciation"#s', '"sympatrische Artbildung"#s'), note: tx("**Sympatric speciation**: new species arise in the same area, without geographic separation. In plants often by **polyploidy**: a fault in meiosis doubles the chromosome set (2n → 4n).", "**Sympatrische Artbildung**: Neue Arten entstehen im selben Gebiet, ohne geografische Trennung. Bei Pflanzen oft durch **Polyploidie**: Ein Meiosefehler verdoppelt den Chromosomensatz (2n → 4n).") },
        {
          math: tx("4n \\times 2n \\to 3n", "4n \\times 2n \\to 3n"),
          note: tx(
            "A tetraploid plant crossed with its diploid parent species gives triploid (3n) offspring. They are sterile: three sets can't be paired and split evenly in meiosis. A new species in one step. Bread wheat, for example, is hexaploid (6n).",
            "Kreuzt man eine tetraploide Pflanze mit ihrer diploiden Ausgangsart, entstehen triploide (3n) Nachkommen. Sie sind unfruchtbar: Drei Sätze lassen sich in der Meiose nicht paarweise verteilen. Eine neue Art in einem Schritt. Brotweizen zum Beispiel ist hexaploid (6n).",
          ),
        },
      ],
    },
    {
      type: "explain",
      title: tx("Molecular evidence and cladistics", "Molekulare Belege und Kladistik"),
      blob: tx("Relationships written in the DNA!", "Verwandtschaft, geschrieben in der DNA!"),
      frames: [
        {
          math: tx('"chimpanzee"#a \\; 0 \\quad "horse"#b \\; 12 \\quad "yeast"#c \\; 45', '"Schimpanse"#a \\; 0 \\quad "Pferd"#b \\; 12 \\quad "Hefe"#c \\; 45'),
          note: tx("**Sequence comparison**: the more amino acids (or DNA bases) differ, the longer ago the lineages split. Cytochrome c compared with humans: chimpanzee 0, horse 12, yeast about 45 differences.", "**Sequenzvergleich**: Je mehr Aminosäuren (oder DNA-Basen) sich unterscheiden, desto länger sind die Linien getrennt. Cytochrom c verglichen mit dem Menschen: Schimpanse 0, Pferd 12, Hefe etwa 45 Unterschiede."),
        },
        { math: tx('"differences"#d \\sim "time"#t', '"Unterschiede"#d \\sim "Zeit"#t'), note: tx("**Molecular clock**: mutations accumulate at a roughly constant rate. Calibrated with a fossil date, the number of differences tells when two lineages split.", "**Molekulare Uhr**: Mutationen sammeln sich mit etwa konstanter Rate an. Mit einem Fossildatum geeicht, verrät die Zahl der Unterschiede, wann sich zwei Linien getrennt haben.") },
        { math: tx('"apomorphy"#a \\quad "plesiomorphy"#p', '"Apomorphie"#a \\quad "Plesiomorphie"#p'), note: tx("**Cladistics** (Willi Hennig): an **apomorphy** is a new, derived character; a **plesiomorphy** is an original, ancestral one.", "**Kladistik** (Willi Hennig): Eine **Apomorphie** ist ein neues, abgeleitetes Merkmal; eine **Plesiomorphie** ein ursprüngliches.") },
        { math: tx('"synapomorphy"#s', '"Synapomorphie"#s'), note: tx("A **synapomorphy** is a derived character shared by several taxa. Only synapomorphies prove a close relationship.", "Eine **Synapomorphie** ist ein abgeleitetes Merkmal, das mehrere Taxa gemeinsam haben. Nur Synapomorphien belegen nahe Verwandtschaft.") },
        {
          math: tx('"monophyletic"#m', '"monophyletisch"#m'),
          note: tx(
            "A **monophyletic** group contains an ancestor and **all** its descendants. Paraphyletic: the ancestor, but not all descendants (reptiles without birds). Polyphyletic: without their common ancestor (warm-blooded animals).",
            "Eine **monophyletische** Gruppe enthält einen Vorfahren und **alle** seine Nachfahren. Paraphyletisch: der Vorfahre, aber nicht alle Nachfahren (Reptilien ohne Vögel). Polyphyletisch: ohne ihren gemeinsamen Vorfahren (Gleichwarme).",
          ),
        },
      ],
    },
    {
      type: "widget",
      title: tx("Explore the cladogram", "Das Kladogramm erkunden"),
      blob: tx("Tap a character and see which group it defines!", "Tipp ein Merkmal an und sieh, welche Gruppe es begründet!"),
      body: tx("Each numbered bar marks where a character arose. Everything to the right of it has the character. Switch to the groups to test familiar groups like reptiles or fish.", "Jeder nummerierte Balken zeigt, wo ein Merkmal entstanden ist. Alles rechts davon hat das Merkmal. Wechsle zu den Gruppen und prüfe bekannte Gruppen wie Reptilien oder Fische."),
      widget: EvolutionCladogram,
    },
    { type: "check", blob: tx("Are reptiles a natural group? Let's see!", "Sind Reptilien eine natürliche Gruppe? Schauen wir mal!"), exercise: checkClade },
  ],
  summary: [
    {
      title: tx("Population genetics", "Populationsgenetik"),
      body: tx(
        "Population, gene pool, allele frequency. Evolution = change of allele frequencies in the gene pool. Ideal population (Hardy-Weinberg): very large, panmixia, no mutation, no selection, no migration.",
        "Population, Genpool, Allelfrequenz. Evolution = Änderung der Allelfrequenzen im Genpool. Ideale Population (Hardy-Weinberg): sehr groß, Panmixie, keine Mutation, keine Selektion, keine Wanderung.",
      ),
      examples: ["p + q = 1", "p^2 + 2pq + q^2 = 1"],
      tone: "rule",
    },
    {
      title: tx("Calculating with Hardy-Weinberg", "Rechnen mit Hardy-Weinberg"),
      body: tx("Start with the share of recessive homozygotes q². Then q = √q², p = 1 − q, carriers 2pq, homozygous dominant p².", "Start mit dem Anteil der rezessiv Homozygoten q². Dann q = √q², p = 1 − q, Überträger 2pq, homozygot dominant p²."),
      examples: [tx("q^2 = 0.0004 \\Rightarrow q = 0.02", "q^2 = 0,0004 \\Rightarrow q = 0,02"), tx("2pq = 2 \\cdot 0.98 \\cdot 0.02 \\approx 0.039", "2pq = 2 \\cdot 0,98 \\cdot 0,02 \\approx 0,039")],
      tone: "rule",
    },
    {
      title: tx("Forms of selection", "Selektionsformen"),
      body: tx(
        "Stabilising: extremes lose, the curve narrows. Directional: one extreme wins, the curve shifts. Disruptive: the middle loses, two peaks. Sexual selection: intrasexual (competition) and intersexual (mate choice).",
        "Stabilisierend: Extreme verlieren, die Kurve wird schmaler. Transformierend: eine Extremform gewinnt, die Kurve verschiebt sich. Disruptiv: Die Mitte verliert, zwei Gipfel. Sexuelle Selektion: intrasexuell (Konkurrenz) und intersexuell (Partnerwahl).",
      ),
      tone: "rule",
    },
    {
      title: tx("Coevolution, radiation, polyploidy", "Koevolution, Radiation, Polyploidie"),
      body: tx(
        "Coevolution: species are selection factors for each other (flower and pollinator, host and parasite). Adaptive radiation: one species becomes many (Darwin's finches). Sympatric speciation by polyploidy: 4n × 2n gives sterile 3n.",
        "Koevolution: Arten sind füreinander Selektionsfaktoren (Blüte und Bestäuber, Wirt und Parasit). Adaptive Radiation: Aus einer Art werden viele (Darwinfinken). Sympatrische Artbildung durch Polyploidie: 4n × 2n ergibt unfruchtbare 3n.",
      ),
      tone: "tip",
    },
    {
      title: tx("Molecular evidence and cladistics", "Molekulare Belege und Kladistik"),
      body: tx(
        "More sequence differences mean an earlier split (molecular clock). Synapomorphies define monophyletic groups; plesiomorphies say nothing about close relationship. Monophyletic: ancestor and all descendants.",
        "Mehr Sequenzunterschiede bedeuten eine frühere Trennung (molekulare Uhr). Synapomorphien begründen monophyletische Gruppen; Plesiomorphien sagen nichts über nahe Verwandtschaft. Monophyletisch: Vorfahre und alle Nachfahren.",
      ),
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "p² is not the frequency of allele A, p is. From q² to q you need the square root. Carriers are 2pq, not pq. Reptiles and fish are paraphyletic, not natural groups.",
        "p² ist nicht die Frequenz des Allels A, sondern p. Von q² zu q brauchst du die Wurzel. Überträger sind 2pq, nicht pq. Reptilien und Fische sind paraphyletisch, keine natürlichen Gruppen.",
      ),
      tone: "warning",
    },
  ],
};
