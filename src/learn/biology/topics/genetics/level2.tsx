"use client";

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { GeneticsDihybrid } from "@/learn/biology/visuals/GeneticsDihybrid";
import { GeneticsCrossPicture } from "@/learn/biology/visuals/GeneticsPea";
import { GeneticsPedigreeChart, GeneticsPedigreeDetective } from "@/learn/biology/visuals/GeneticsPedigree";
import { GeneticsPunnett, GeneticsPunnettGrid, PUNNETT_GENOTYPES, type PunnettKind } from "@/learn/biology/visuals/GeneticsPunnett";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson } from "@/learn/types";
import { bgName, BLOOD_GROUPS, bloodChildren, bloodGroup, INTER_COLOUR, INTERMEDIATE, MENDEL_F2, monoCounts, PEA_TRAITS, peaLook, punnett, TRAITS, ALL_TRAITS, dominanceLine, type BloodGroup, type TraitId } from "./data";
import { choice, count, matchTask, mistakeList, multi, percent, weighted, type Opt } from "./kit";
import { exclusion, generatePedigree, possibleGenotypes, type Mode, type Pedigree } from "./pedigree";

const E = (t: Text) => resolveText(t, "en");
const D = (t: Text) => resolveText(t, "de");
const visual = (component: unknown, props: Record<string, unknown>) => ({ component: component as ComponentType<Record<string, unknown>>, props });
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const red = (xs: number[]) => {
  const g = xs.filter((x) => x).reduce((a, b) => gcd(a, b));
  return xs.map((x) => x / g);
};

// ---------------------------------------------------------------------------
// Monohybrid crosses: ratio texts

type Cross = [string, string];

function crossInfo(id: TraitId, [g1, g2]: Cross) {
  const t = TRAITS[id];
  const L = t.letter;
  const l = L.toLowerCase();
  const c = monoCounts(g1, g2);
  const dom = c.DD + c.Dd;
  const rec = c.dd;
  const phen: Text = rec === 0 ? tx(`all ${E(t.dom)}`, `alle ${D(t.dom)}`) : dom === 0 ? tx(`all ${E(t.rec)}`, `alle ${D(t.rec)}`) : (() => {
    const [a, b] = red([dom, rec]);
    return tx(`${E(t.dom)} : ${E(t.rec)} = ${a} : ${b}`, `${D(t.dom)} : ${D(t.rec)} = ${a} : ${b}`);
  })();
  const names = [`$${L}${L}$`, `$${L}${l}$`, `$${l}${l}$`];
  const vals = [c.DD, c.Dd, c.dd];
  const present = vals.map((v, i) => [v, i] as const).filter(([v]) => v > 0);
  const plain = [`${L}${L}`, `${L}${l}`, `${l}${l}`];
  const r = present.length > 1 ? red(present.map(([v]) => v)) : [1];
  const geno: Text = present.length === 1 ? tx(`all ${names[present[0][1]]}`, `alle ${names[present[0][1]]}`) : `${present.map(([, i]) => names[i]).join(" : ")} = ${r.join(" : ")}`;
  const genoMath: Text = present.length === 1 ? tx(`"all" \\; ${plain[present[0][1]]}`, `"alle" \\; ${plain[present[0][1]]}`) : `${present.map(([, i]) => plain[i]).join(" : ")} = ${r.join(" : ")}`;
  return { t, L, l, c, dom, rec, phen, geno, genoMath };
}

function ratioExercise(rng: Rng | null, id: TraitId, cross: Cross, askGeno: boolean): Exercise {
  const info = crossInfo(id, cross);
  const { t, L, l } = info;
  const [g1, g2] = cross;
  const het = `${L}${l}`;
  const all = [
    ["Dd×Dd", crossInfo(id, [het, het])],
    ["Dd×dd", crossInfo(id, [het, l + l])],
    ["DD×dd", crossInfo(id, [L + L, l + l])],
    ["DD×Dd", crossInfo(id, [L + L, het])],
  ] as const;
  const key = `${g1 === het ? "Dd" : g1 === L + L ? "DD" : "dd"}×${g2 === het ? "Dd" : g2 === L + L ? "DD" : "dd"}`;
  const right = askGeno ? info.geno : info.phen;
  const say = (k: string, geno: boolean): [Text, Text] => {
    if (!askGeno && geno)
      return [tx("That's the genotype ratio", "Das ist das Genotypverhältnis"), tx(`You counted genotypes. But $${L}${L}$ and $${L}${l}$ **look the same**, so they belong to one phenotype.`, `Du hast Genotypen gezählt. $${L}${L}$ und $${L}${l}$ **sehen aber gleich aus**, sie gehören also zu einem Phänotyp.`)];
    if (askGeno && !geno)
      return [tx("That's the phenotype ratio", "Das ist das Phänotypverhältnis"), tx(`You counted what the offspring look like. For the genotypes, count $${L}${L}$, $${L}${l}$ and $${l}${l}$ separately.`, `Du hast gezählt, wie die Nachkommen aussehen. Für die Genotypen musst du $${L}${L}$, $${L}${l}$ und $${l}${l}$ einzeln zählen.`)];
    if (k === "Dd×Dd")
      return [tx("3 : 1 needs two heterozygotes", "3 : 1 braucht zwei Mischerbige"), tx(`3 : 1 (or 1 : 2 : 1) only comes from $${het} \\times ${het}$. Draw the square for $${g1} \\times ${g2}$ and count again.`, `3 : 1 (bzw. 1 : 2 : 1) kommt nur bei $${het} \\times ${het}$ heraus. Zeichne das Quadrat für $${g1} \\times ${g2}$ und zähl noch mal.`)];
    if (k === "Dd×dd") return [tx("That's a test cross", "Das wäre eine Rückkreuzung"), tx(`1 : 1 comes from $${het} \\times ${l}${l}$. Here the gametes are $${g1[0]}$, $${g1[1]}$ and $${g2[0]}$, $${g2[1]}$: combine them all.`, `1 : 1 kommt bei $${het} \\times ${l}${l}$ heraus. Hier sind die Keimzellen $${g1[0]}$, $${g1[1]}$ und $${g2[0]}$, $${g2[1]}$: Kombinier sie alle.`)];
    return [tx("Count every cell", "Zähl jedes Feld"), tx(`Write the gametes $${g1[0]}$, $${g1[1]}$ and $${g2[0]}$, $${g2[1]}$ on the edges of a square and count all four cells.`, `Schreib die Keimzellen $${g1[0]}$, $${g1[1]}$ und $${g2[0]}$, $${g2[1]}$ an die Ränder eines Quadrats und zähl alle vier Felder.`)];
  };
  const seen = new Set([E(right)]);
  const opts: Opt[] = [{ text: right }];
  const cands: [string, Text, boolean][] = [];
  for (const [k, inf] of all) {
    cands.push([k, inf.phen, false]);
    cands.push([k, inf.geno, true]);
  }
  // prefer the classic confusions first
  const order = rng ? rng.shuffle(cands) : cands;
  order.sort((a, b) => Number(b[0] === key) - Number(a[0] === key) || Number(b[0] === "Dd×Dd") - Number(a[0] === "Dd×Dd"));
  for (const [k, text, geno] of order) {
    if (opts.length >= 4 || seen.has(E(text))) continue;
    seen.add(E(text));
    const [title, s] = say(k, geno);
    opts.push({ text, title, say: s });
  }
  const c = choice(rng, opts);
  const cells = punnett(g1, g2);
  return {
    instruction: askGeno ? tx("Find the genotype ratio", "Bestimme das Genotypverhältnis") : tx("Find the phenotype ratio", "Bestimme das Phänotypverhältnis"),
    text: tx(
      `${E(dominanceLine(t))} Two ${E(t.many)} are crossed: $${g1} \\times ${g2}$. Which ${askGeno ? "genotype" : "phenotype"} ratio do you expect among the offspring?`,
      `${D(dominanceLine(t))} Zwei ${D(t.many)} werden gekreuzt: $${g1} \\times ${g2}$. Welches ${askGeno ? "Genotypverhältnis" : "Phänotypverhältnis"} erwartest du bei den Nachkommen?`,
    ),
    answer: c.answer,
    hint: tx("Write the gametes of each parent on the edges of a Punnett square and fill in the four cells.", "Schreib die Keimzellen jedes Elternteils an die Ränder eines Kreuzungsschemas und füll die vier Felder aus."),
    solution: [
      { math: tx(`"gametes:" \\; ${g1[0]} , ${g1[1]} \\quad ${g2[0]} , ${g2[1]}`, `"Keimzellen:" \\; ${g1[0]} , ${g1[1]} \\quad ${g2[0]} , ${g2[1]}`), note: tx("Each parent passes on one of its two alleles.", "Jeder Elternteil gibt eines seiner beiden Allele weiter.") },
      { math: cells.join(" \\quad "), note: tx("The four cells of the square, each equally likely.", "Die vier Felder des Quadrats, jedes gleich wahrscheinlich.") },
      {
        math: askGeno ? info.genoMath : tx(`"${E(info.phen)}"`, `"${D(info.phen)}"`),
        note: askGeno ? tx(`Genotypes: **${E(info.geno)}**.`, `Genotypen: **${D(info.geno)}**.`) : tx(`$${L}${L}$ and $${L}${l}$ look the same. Phenotypes: **${E(info.phen)}**.`, `$${L}${L}$ und $${L}${l}$ sehen gleich aus. Phänotypen: **${D(info.phen)}**.`),
      },
    ],
    mistakes: c.mistakes,
  };
}

function ratioTask(rng: Rng): Exercise {
  const id = rng.pick(ALL_TRAITS);
  const L = TRAITS[id].letter;
  const l = L.toLowerCase();
  const cross = rng.pick<Cross>([
    [L + l, L + l],
    [L + l, L + l],
    [L + l, l + l],
    [l + l, L + l],
    [L + L, l + l],
    [L + L, L + l],
  ]);
  return ratioExercise(rng, id, cross, rng.chance(0.4));
}

// ---------------------------------------------------------------------------
// Expected numbers of offspring

type Ask = "dom" | "rec" | "het" | "homdom";

function countExercise(id: TraitId, cross: Cross, n: number, ask: Ask): Exercise {
  const info = crossInfo(id, cross);
  const { t, L, l, c } = info;
  const share = { dom: (c.DD + c.Dd) / 4, rec: c.dd / 4, het: c.Dd / 4, homdom: c.DD / 4 }[ask];
  const value = n * share;
  const answer = count(value);
  const m = mistakeList(answer);
  const [g1, g2] = cross;
  const twoHet = g1 === g2;
  if (ask === "rec") {
    m.add(count((n * (c.DD + c.Dd)) / 4), tx("Counted the dominant ones", "Die Dominanten gezählt"), tx(`That's the number that **${E(t.qDom)}**. The question asks about the recessive ones.`, `Das ist die Zahl derer, die **${D(t.qDom)}**. Gefragt sind aber die Rezessiven.`));
    if (twoHet) m.add(count(n / 2), tx("Not 1 : 1", "Nicht 1 : 1"), tx("Two heterozygous parents give 3 : 1, not 1 : 1. Only one cell in four is recessive.", "Zwei mischerbige Eltern ergeben 3 : 1, nicht 1 : 1. Nur eins von vier Feldern ist rezessiv."));
    else m.add(count(n / 4), tx("3 : 1 doesn't fit here", "3 : 1 passt hier nicht"), tx(`3 : 1 needs two heterozygous parents. With $${g1} \\times ${g2}$ half of the cells are $${l}${l}$.`, `3 : 1 braucht zwei mischerbige Eltern. Bei $${g1} \\times ${g2}$ ist die Hälfte der Felder $${l}${l}$.`));
  }
  if (ask === "dom") {
    m.add(count((n * c.dd) / 4), tx("Counted the recessive ones", "Die Rezessiven gezählt"), tx(`That's the number that **${E(t.qRec)}**. The question asks about the dominant phenotype.`, `Das ist die Zahl derer, die **${D(t.qRec)}**. Gefragt ist der dominante Phänotyp.`));
    m.add(count((n * c.Dd) / 4), tx("Not only the heterozygotes", "Nicht nur die Mischerbigen"), tx(`You only counted $${L}${l}$. But $${L}${L}$ shows the dominant trait as well.`, `Du hast nur $${L}${l}$ gezählt. Aber auch $${L}${L}$ zeigt das dominante Merkmal.`));
    if (twoHet) m.add(count(n / 2), tx("Not 1 : 1", "Nicht 1 : 1"), tx("Two heterozygous parents give 3 : 1: three cells in four show the dominant trait.", "Zwei mischerbige Eltern ergeben 3 : 1: Drei von vier Feldern zeigen das dominante Merkmal."));
  }
  if (ask === "het" || ask === "homdom") {
    m.add(count((n * (c.DD + c.Dd)) / 4), tx("Genotype or phenotype?", "Genotyp oder Phänotyp?"), tx(`You counted everybody who shows the dominant trait. But only some of them are $${ask === "het" ? L + l : L + L}$: count the genotype on its own.`, `Du hast alle gezählt, die das dominante Merkmal zeigen. Nur ein Teil davon ist aber $${ask === "het" ? L + l : L + L}$: Zähl den Genotyp einzeln.`));
    m.add(count(ask === "het" ? (n * c.DD) / 4 : (n * c.Dd) / 4), tx("The other genotype", "Der andere Genotyp"), ask === "het" ? tx(`That's the number of $${L}${L}$. Heterozygous means $${L}${l}$.`, `Das ist die Zahl der $${L}${L}$. Mischerbig heißt $${L}${l}$.`) : tx(`That's the number of $${L}${l}$. Homozygous dominant means $${L}${L}$.`, `Das ist die Zahl der $${L}${l}$. Reinerbig dominant heißt $${L}${L}$.`));
    m.add(count(n / 4 === value ? n / 2 : n / 4), tx("Count the cells again", "Zähl die Felder noch mal"), tx(`In $${g1} \\times ${g2}$ the genotype ratio is ${E(info.geno).replace(/\$/g, "")}. Which share is that?`, `Bei $${g1} \\times ${g2}$ ist das Genotypverhältnis ${D(info.geno).replace(/\$/g, "")}. Welcher Anteil ist das?`));
  }
  const seeds = id === "shape" || id === "colour";
  const what = { dom: tx(`${E(t.qDom)}`, `${D(t.qDom)}`), rec: tx(`${E(t.qRec)}`, `${D(t.qRec)}`), het: tx(`are heterozygous ($${L}${l}$)`, `sind mischerbig ($${L}${l}$)`), homdom: tx(`are homozygous dominant ($${L}${L}$)`, `sind reinerbig dominant ($${L}${L}$)`) }[ask];
  const sh = Math.round(share * 100);
  return {
    instruction: tx("Expected number of offspring", "Erwartete Anzahl der Nachkommen"),
    text: tx(
      `${E(dominanceLine(t))} ${twoHet ? `Two heterozygous plants are crossed ($${g1} \\times ${g2}$).` : `The cross is $${g1} \\times ${g2}$.`} ${seeds ? `It gives ${n} seeds.` : `${n} offspring plants grow.`} How many of them ${E(what)}?`,
      `${D(dominanceLine(t))} ${twoHet ? `Zwei mischerbige Pflanzen werden gekreuzt ($${g1} \\times ${g2}$).` : `Gekreuzt wird $${g1} \\times ${g2}$.`} ${seeds ? `Dabei entstehen ${n} Samen.` : `Es wachsen ${n} Nachkommen heran.`} Wie viele davon ${D(what)}?`,
    ),
    answer,
    hint: tx("Draw the Punnett square. Which share of the four cells fits the question?", "Zeichne das Kreuzungsschema. Welcher Anteil der vier Felder passt zur Frage?"),
    solution: [
      { math: punnett(g1, g2).join(" \\quad "), note: tx(`The four equally likely cells of $${g1} \\times ${g2}$.`, `Die vier gleich wahrscheinlichen Felder von $${g1} \\times ${g2}$.`) },
      { math: tx(`${share * 4} "of" 4 = ${sh} "%"`, `${share * 4} "von" 4 = ${sh} "%"`), note: tx(`${share * 4} of the 4 cells fit: that's ${sh}%.`, `${share * 4} der 4 Felder passen: Das sind ${sh} %.`) },
      { math: `${n} \\cdot \\frac{${share * 4}}{4} = ${value}`, note: tx(`Expected: **${value}**. Real counts vary a little around this value (chance!).`, `Erwartet: **${value}**. Echte Zählungen schwanken etwas um diesen Wert (Zufall!).`) },
    ],
    mistakes: m.list,
  };
}

function countTask(rng: Rng): Exercise {
  const id = rng.pick(PEA_TRAITS);
  const L = TRAITS[id].letter;
  const l = L.toLowerCase();
  const twoHet = rng.chance(0.7);
  const cross: Cross = twoHet ? [L + l, L + l] : [L + l, l + l];
  const ask: Ask = twoHet ? rng.pick(["dom", "rec", "rec", "het", "homdom"] as const) : rng.pick(["dom", "rec"] as const);
  return countExercise(id, cross, rng.int(10, 120) * 4, ask);
}

// ---------------------------------------------------------------------------
// Mendel's own numbers

function mendelTask(rng: Rng): Exercise {
  const row = rng.shuffle(MENDEL_F2)[rng.int(0, MENDEL_F2.length - 1)];
  const ratio = Math.round((row.a / row.b) * 100) / 100;
  const answer: AnswerSpec = { kind: "number", value: ratio, tolerance: 0.006 / ratio + 0.002 };
  const m = mistakeList(answer);
  m.add({ kind: "number", value: Math.round((row.b / row.a) * 100) / 100, tolerance: 0.01 }, tx("Upside down", "Andersherum geteilt"), tx(`You divided ${E(row.rec)} by ${E(row.dom)}. For “x : 1” divide the bigger (dominant) number by the smaller one.`, `Du hast ${D(row.rec)} durch ${D(row.dom)} geteilt. Für „x : 1“ teilst du die größere (dominante) Zahl durch die kleinere.`));
  m.add({ kind: "number", value: Math.round((row.a / (row.a + row.b)) * 100) / 100, tolerance: 0.01 }, tx("That's the share", "Das ist der Anteil"), tx("That's the share of the dominant ones in all seeds (about 0.75). The ratio compares the two groups with each other.", "Das ist der Anteil der Dominanten an allen (etwa 0,75). Das Verhältnis vergleicht die beiden Gruppen miteinander."));
  m.add({ kind: "number", value: 3 }, tx("Calculate, don't remember", "Rechnen statt erinnern"), tx("3 is the ideal value. Mendel's real counts give a value close to it: calculate it from his numbers.", "3 ist der Idealwert. Mendels echte Zählung ergibt einen Wert in der Nähe: Rechne ihn aus seinen Zahlen aus."), true);
  return {
    instruction: tx("Evaluate Mendel's data", "Werte Mendels Daten aus"),
    text: tx(
      `In the F2 Mendel found for the trait ${E(row.trait)}: ${row.a} × “${E(row.dom)}” and ${row.b} × “${E(row.rec)}”. Calculate the ratio ${E(row.dom)} : ${E(row.rec)} in the form x : 1 (two decimal places).`,
      `In der F2 fand Mendel beim Merkmal ${D(row.trait)}: ${row.a}-mal „${D(row.dom)}“ und ${row.b}-mal „${D(row.rec)}“. Berechne das Verhältnis ${D(row.dom)} : ${D(row.rec)} in der Form x : 1 (zwei Nachkommastellen).`,
    ),
    answer,
    hint: tx("Divide the dominant number by the recessive one.", "Teile die dominante Zahl durch die rezessive."),
    solution: [
      { math: tx(`\\frac{${row.a}}{${row.b}} \\approx ${ratio}`, `\\frac{${row.a}}{${row.b}} \\approx ${String(ratio).replace(".", ",")}`), note: tx(`${row.a} : ${row.b} ≈ **${ratio} : 1**.`, `${row.a} : ${row.b} ≈ **${String(ratio).replace(".", ",")} : 1**.`) },
      { math: tx(`${ratio} : 1 \\approx 3 : 1`, `${String(ratio).replace(".", ",")} : 1 \\approx 3 : 1`), note: tx("Close to 3 : 1, as the splitting rule predicts. Chance makes real counts scatter a little; large numbers make the ratio reliable.", "Nahe an 3 : 1, wie die Spaltungsregel vorhersagt. Durch Zufall streuen echte Zählungen etwas; große Zahlen machen das Verhältnis zuverlässig.") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Intermediate inheritance

const ICOL = (g: string) => INTER_COLOUR[g];

function interExercise(rng: Rng | null, org: number, cross: Cross, asPercent: boolean, target: string): Exercise {
  const o = INTERMEDIATE[org];
  const cells = punnett(cross[0], cross[1]);
  const n = (g: string) => cells.filter((c) => c === g).length;
  const present = ["RR", "RW", "WW"].filter((g) => n(g));
  const r = red(present.map(n));
  const ratioText = (gs: string[], rs: number[]): Text => (gs.length === 1 ? tx(`all ${E(ICOL(gs[0]))}`, `alle ${D(ICOL(gs[0]))}`) : tx(`${gs.map((g) => E(ICOL(g))).join(" : ")} = ${rs.join(" : ")}`, `${gs.map((g) => D(ICOL(g))).join(" : ")} = ${rs.join(" : ")}`));
  const right = ratioText(present, r);
  const [g1, g2] = cross;
  const intro = tx(
    `${E(o.name)[0].toUpperCase() + E(o.name).slice(1)}: the alleles for red ($R$) and white ($W$) are inherited intermediately: $RW$ plants are pink. Cross: $${g1} \\times ${g2}$ (${E(ICOL(g1))} × ${E(ICOL(g2))}).`,
    `${D(o.name)}: Die Allele für rot ($R$) und weiß ($W$) werden intermediär vererbt: $RW$-Pflanzen blühen rosa. Kreuzung: $${g1} \\times ${g2}$ (${D(ICOL(g1))} × ${D(ICOL(g2))}).`,
  );
  const solution = [
    { math: cells.join(" \\quad "), note: tx("The four cells of the Punnett square.", "Die vier Felder des Kreuzungsschemas.") },
    { math: tx(`"${E(right)}"`, `"${D(right)}"`), note: tx("Every genotype has its own colour, so phenotype ratio = genotype ratio.", "Jeder Genotyp hat seine eigene Farbe, also Phänotypverhältnis = Genotypverhältnis.") },
  ];
  if (asPercent) {
    const v = (n(target) / 4) * 100;
    const answer = percent(v);
    const m = mistakeList(answer);
    if (g1 === "RW" && g2 === "RW") {
      if (target === "RW") m.add(percent(100), tx("Pink doesn't stay pink", "Rosa bleibt nicht rosa"), tx("The colours don't blend for good: in the gametes $R$ and $W$ separate again. So red and white offspring turn up too.", "Die Farben vermischen sich nicht dauerhaft: In den Keimzellen trennen sich $R$ und $W$ wieder. Darum gibt es auch wieder rote und weiße Nachkommen."));
      if (target === "RR") m.add(percent(75), tx("No dominance here", "Hier dominiert nichts"), tx("You treated red as dominant (3 : 1). But here $RW$ is pink, not red: only $RR$ is red.", "Du hast rot wie dominant behandelt (3 : 1). Hier ist $RW$ aber rosa, nicht rot: Nur $RR$ ist rot."));
      if (target === "WW") m.add(percent(0), tx("White comes back", "Weiß kommt wieder"), tx("Both pink parents carry a $W$. A quarter of the offspring get $W$ from both: white.", "Beide rosa Eltern tragen ein $W$. Ein Viertel der Nachkommen bekommt von beiden $W$: weiß."));
    }
    if (target === "RW" && v !== 100) m.add(percent(100), tx("Not all pink", "Nicht alle rosa"), tx("Only the uniform F1 (red × white) is all pink. Draw the square for this cross.", "Nur die einheitliche F1 (rot × weiß) ist ganz rosa. Zeichne das Quadrat für diese Kreuzung."));
    m.add(percent(v === 50 ? 25 : 50), tx("Count the cells", "Zähl die Felder"), tx(`Each cell is 25%. Count how many of the four cells are $${target}$.`, `Jedes Feld sind 25 %. Zähl, wie viele der vier Felder $${target}$ sind.`));
    return {
      instruction: tx("Calculate the probability", "Berechne die Wahrscheinlichkeit"),
      text: tx(`${E(intro)} What percentage of the offspring are expected to be ${E(ICOL(target))}?`, `${D(intro)} Wie viel Prozent der Nachkommen blühen voraussichtlich ${D(ICOL(target))}?`),
      answer,
      hint: tx("Draw the square. Each cell is 25%.", "Zeichne das Quadrat. Jedes Feld sind 25 %."),
      solution: [...solution, { math: `${n(target)} \\cdot 25 "%" = ${v} "%"`, note: tx(`${n(target)} of 4 cells are $${target}$: **${v}%**.`, `${n(target)} von 4 Feldern sind $${target}$: **${v} %**.`) }],
      mistakes: m.list,
    };
  }
  const opts: Opt[] = [{ text: right }];
  const add = (text: Text, title: Text, say: Text) => {
    if (opts.some((o) => E(o.text) === E(text))) return;
    opts.push({ text, title, say });
  };
  const dom31 = tx(`${E(ICOL("RR"))} : ${E(ICOL("WW"))} = 3 : 1`, `${D(ICOL("RR"))} : ${D(ICOL("WW"))} = 3 : 1`);
  add(dom31, tx("No dominance here", "Hier dominiert nichts"), tx("3 : 1 belongs to dominant-recessive inheritance. Here $RW$ is pink, so it gets its own class.", "3 : 1 gehört zum dominant-rezessiven Erbgang. Hier ist $RW$ rosa und bildet eine eigene Gruppe."));
  add(tx(`all ${E(ICOL("RW"))}`, `alle ${D(ICOL("RW"))}`), tx("Alleles don't blend", "Allele vermischen sich nicht"), tx("Only red × white gives all pink. The alleles $R$ and $W$ stay separate and are passed on unchanged.", "Nur rot × weiß ergibt nur rosa. Die Allele $R$ und $W$ bleiben getrennt und werden unverändert weitergegeben."));
  add(tx(`${E(ICOL("RR"))} : ${E(ICOL("RW"))} : ${E(ICOL("WW"))} = 1 : 2 : 1`, `${D(ICOL("RR"))} : ${D(ICOL("RW"))} : ${D(ICOL("WW"))} = 1 : 2 : 1`), tx("1 : 2 : 1 is for pink × pink", "1 : 2 : 1 gilt für rosa × rosa"), tx("1 : 2 : 1 only appears when both parents are $RW$. Look at the parents in this cross.", "1 : 2 : 1 entsteht nur, wenn beide Eltern $RW$ sind. Schau dir die Eltern dieser Kreuzung an."));
  add(tx(`${E(ICOL("RW"))} : ${E(ICOL("WW"))} = 1 : 1`, `${D(ICOL("RW"))} : ${D(ICOL("WW"))} = 1 : 1`), tx("Check the gametes", "Prüf die Keimzellen"), tx("Write down the gametes of both parents and combine them in the square.", "Schreib die Keimzellen beider Eltern auf und kombiniere sie im Quadrat."));
  add(tx(`${E(ICOL("RR"))} : ${E(ICOL("RW"))} = 1 : 1`, `${D(ICOL("RR"))} : ${D(ICOL("RW"))} = 1 : 1`), tx("Check the gametes", "Prüf die Keimzellen"), tx("Write down the gametes of both parents and combine them in the square.", "Schreib die Keimzellen beider Eltern auf und kombiniere sie im Quadrat."));
  const c = choice(rng, opts.slice(0, 4));
  return {
    instruction: tx("Intermediate inheritance", "Intermediärer Erbgang"),
    text: tx(`${E(intro)} Which phenotype ratio do you expect?`, `${D(intro)} Welches Phänotypverhältnis erwartest du?`),
    answer: c.answer,
    hint: tx("Here every genotype has its own colour.", "Hier hat jeder Genotyp seine eigene Farbe."),
    solution,
    mistakes: c.mistakes,
  };
}

function interTask(rng: Rng): Exercise {
  const cross = rng.pick<Cross>([
    ["RW", "RW"],
    ["RW", "RW"],
    ["RR", "WW"],
    ["RW", "RR"],
    ["RW", "WW"],
  ]);
  const asPercent = rng.chance(0.45);
  const targets = ["RR", "RW", "WW"].filter((g) => !asPercent || punnett(cross[0], cross[1]).includes(g) || rng.chance(0.15));
  return interExercise(rng, rng.int(0, 1), cross, asPercent, rng.pick(targets));
}

// ---------------------------------------------------------------------------
// Test cross

function testCrossExercise(rng: Rng | null, id: TraitId, het: boolean, n1: number, n2: number): Exercise {
  const t = TRAITS[id];
  const L = t.letter;
  const l = L.toLowerCase();
  const opts: Opt[] = het
    ? [
        { text: `$${L}${l}$` },
        { text: `$${L}${L}$`, title: tx("Then no recessive offspring", "Dann keine rezessiven Nachkommen"), say: tx(`A $${L}${L}$ plant gives every offspring an $${L}$: all would show the dominant trait. The ${n2} recessive offspring prove it carries $${l}$.`, `Eine $${L}${L}$-Pflanze gibt jedem Nachkommen ein $${L}$: Alle würden das dominante Merkmal zeigen. Die ${n2} rezessiven Nachkommen beweisen, dass sie $${l}$ trägt.`) },
        { text: `$${l}${l}$`, title: tx("Look at the parent", "Schau auf den Elternteil"), say: tx(`The tested plant itself shows the dominant trait, so it has at least one $${L}$.`, `Die getestete Pflanze zeigt selbst das dominante Merkmal, hat also mindestens ein $${L}$.`) },
        { text: tx("can't be determined", "lässt sich nicht bestimmen"), title: tx("That's what a test cross is for", "Genau dafür gibt's die Rückkreuzung"), say: tx(`The recessive partner only passes on $${l}$, so each offspring shows directly which allele the tested plant gave.`, `Der rezessive Partner gibt nur $${l}$ weiter, also zeigt jeder Nachkomme direkt, welches Allel die getestete Pflanze beigesteuert hat.`) },
      ]
    : [
        { text: `$${L}${L}$` },
        { text: `$${L}${l}$`, title: tx("Then about half recessive", "Dann etwa die Hälfte rezessiv"), say: tx(`If it were $${L}${l}$, about half of the ${n1} offspring would be $${l}${l}$ and show the recessive trait. Not a single one does.`, `Wäre sie $${L}${l}$, wäre etwa die Hälfte der ${n1} Nachkommen $${l}${l}$ und zeigte das rezessive Merkmal. Kein einziger tut das.`) },
        { text: `$${l}${l}$`, title: tx("Look at the parent", "Schau auf den Elternteil"), say: tx(`The tested plant itself shows the dominant trait, so it has at least one $${L}$.`, `Die getestete Pflanze zeigt selbst das dominante Merkmal, hat also mindestens ein $${L}$.`) },
        { text: tx("can't be determined", "lässt sich nicht bestimmen"), title: tx("That's what a test cross is for", "Genau dafür gibt's die Rückkreuzung"), say: tx(`The recessive partner only passes on $${l}$, so each offspring shows directly which allele the tested plant gave.`, `Der rezessive Partner gibt nur $${l}$ weiter, also zeigt jeder Nachkomme direkt, welches Allel die getestete Pflanze beigesteuert hat.`) },
      ];
  const c = choice(rng, opts);
  const counts = [{ look: peaLook(id, true), n: n1, label: t.dom }, ...(n2 ? [{ look: peaLook(id, false), n: n2, label: t.rec }] : [])];
  return {
    instruction: tx("Evaluate the test cross", "Werte die Rückkreuzung aus"),
    text: tx(
      `${E(dominanceLine(t))} A plant ${E(t.withDom)} whose genotype is unknown is crossed with a plant ${E(t.withRec)} ($${l}${l}$). Offspring: ${n1} ${E(t.dom)}${n2 ? ` and ${n2} ${E(t.rec)}` : ", none " + E(t.rec)}. What is the genotype of the tested plant?`,
      `${D(dominanceLine(t))} Eine Pflanze ${D(t.withDom)}, deren Genotyp unbekannt ist, wird mit einer Pflanze ${D(t.withRec)} ($${l}${l}$) gekreuzt. Nachkommen: ${n1}-mal ${D(t.dom)}${n2 ? ` und ${n2}-mal ${D(t.rec)}` : `, keiner ${D(t.rec)}`}. Welchen Genotyp hat die getestete Pflanze?`,
    ),
    visual: visual(GeneticsCrossPicture, { left: peaLook(id, true), right: peaLook(id, false), captions: [`${L}?`, `${l}${l}`], counts }),
    answer: c.answer,
    hint: tx(`The partner $${l}${l}$ can only give $${l}$. Where could recessive offspring get their second $${l}$?`, `Der Partner $${l}${l}$ kann nur $${l}$ geben. Woher bekämen rezessive Nachkommen ihr zweites $${l}$?`),
    solution: het
      ? [
          { math: `${L}${l} \\times ${l}${l} \\to 1 ${L}${l} : 1 ${l}${l}`, note: tx("A heterozygous plant gives $" + L + "$ to half of its offspring and $" + l + "$ to the other half: about 1 : 1.", "Eine mischerbige Pflanze gibt der Hälfte ihrer Nachkommen $" + L + "$, der anderen Hälfte $" + l + "$: etwa 1 : 1.") },
          { math: tx(`${n1} : ${n2} \\approx 1 : 1 \\Rightarrow ${L}${l}`, `${n1} : ${n2} \\approx 1 : 1 \\Rightarrow ${L}${l}`), note: tx(`${n1} : ${n2} is about 1 : 1, and recessive offspring exist: the plant is **$${L}${l}$**.`, `${n1} : ${n2} ist etwa 1 : 1, und es gibt rezessive Nachkommen: Die Pflanze ist **$${L}${l}$**.`) },
        ]
      : [
          { math: `${L}${L} \\times ${l}${l} \\to ${L}${l}`, note: tx("A homozygous plant gives every offspring $" + L + "$: all are uniform and dominant.", "Eine reinerbige Pflanze gibt jedem Nachkommen $" + L + "$: Alle sind einheitlich dominant.") },
          { math: tx(`${n1} : 0 \\Rightarrow ${L}${L}`, `${n1} : 0 \\Rightarrow ${L}${L}`), note: tx(`Not one recessive offspring among ${n1}: the plant is (almost certainly) **$${L}${L}$**.`, `Kein einziger rezessiver Nachkomme unter ${n1}: Die Pflanze ist (so gut wie sicher) **$${L}${L}$**.`) },
        ],
    mistakes: c.mistakes,
  };
}

function testCrossTask(rng: Rng): Exercise {
  const het = rng.chance(0.55);
  const n = rng.int(20, 60) * 2;
  const n1 = het ? n / 2 + rng.int(-4, 4) : n;
  return testCrossExercise(rng, rng.pick(PEA_TRAITS), het, n1, het ? n - n1 : 0);
}

// ---------------------------------------------------------------------------
// Two traits: 9 : 3 : 3 : 1

type Cls = "YR" | "Yr" | "yR" | "yr";
const CLS_TEXT: Record<Cls, Text> = {
  YR: tx("yellow and round", "gelb und rund"),
  Yr: tx("yellow and wrinkled", "gelb und runzlig"),
  yR: tx("green and round", "grün und rund"),
  yr: tx("green and wrinkled", "grün und runzlig"),
};

function dihybridExercise(kind: "f2" | "test", cls: Cls, n: number): Exercise {
  const f2: Record<Cls, number> = { YR: 9, Yr: 3, yR: 3, yr: 1 };
  const frac = kind === "f2" ? f2[cls] / 16 : 1 / 4;
  const value = n * frac;
  const answer = count(value);
  const m = mistakeList(answer);
  const pY = kind === "f2" ? (cls[0] === "Y" ? 3 / 4 : 1 / 4) : 1 / 2;
  const pR = kind === "f2" ? (cls[1] === "R" ? 3 / 4 : 1 / 4) : 1 / 2;
  if (kind === "test") {
    m.add(count((n * f2[cls]) / 16), tx("That's the F2 ratio", "Das ist das F2-Verhältnis"), tx("9 : 3 : 3 : 1 is for $GgRr \\times GgRr$. A test cross with $ggrr$ gives all four phenotypes **1 : 1 : 1 : 1**.", "9 : 3 : 3 : 1 gilt für $GgRr \\times GgRr$. Eine Rückkreuzung mit $ggrr$ ergibt alle vier Phänotypen im Verhältnis **1 : 1 : 1 : 1**."));
    m.add(count(n / 2), tx("Both traits at once", "Beide Merkmale zugleich"), tx("Half of them have the one trait, and of those half have the other: $\\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{4}$.", "Die Hälfte hat das eine Merkmal, davon die Hälfte das andere: $\\frac{1}{2} \\cdot \\frac{1}{2} = \\frac{1}{4}$."));
  } else {
    if (pY + pR < 1) m.add(count(n * (pY + pR)), tx("Added instead of multiplied", "Addiert statt multipliziert"), tx(`Both traits must occur **together**: multiply, $${pY === 0.75 ? "\\frac{3}{4}" : "\\frac{1}{4}"} \\cdot ${pR === 0.75 ? "\\frac{3}{4}" : "\\frac{1}{4}"}$. Adding gives the chance for one **or** the other.`, `Beide Merkmale müssen **zugleich** auftreten: Multiplizieren, $${pY === 0.75 ? "\\frac{3}{4}" : "\\frac{1}{4}"} \\cdot ${pR === 0.75 ? "\\frac{3}{4}" : "\\frac{1}{4}"}$. Addieren ergibt die Chance für das eine **oder** das andere.`));
    m.add(count(n * (cls[0] === "y" ? 1 / 4 : cls[1] === "r" ? 1 / 4 : 3 / 4)), tx("Only one trait counted", "Nur ein Merkmal beachtet"), tx("You looked at just one trait. The seed has to fit **both**: colour and shape.", "Du hast nur ein Merkmal betrachtet. Der Samen muss aber **beides** erfüllen: Farbe und Form."));
    for (const other of ["YR", "Yr", "yR", "yr"] as Cls[])
      if (f2[other] !== f2[cls]) m.add(count((n * f2[other]) / 16), tx("Wrong class of 9 : 3 : 3 : 1", "Falsche Gruppe von 9 : 3 : 3 : 1"), tx(`That's the number for “${E(CLS_TEXT[other])}”. ${E(CLS_TEXT[cls])[0].toUpperCase() + E(CLS_TEXT[cls]).slice(1)} is ${f2[cls]} of 16.`, `Das ist die Zahl für „${D(CLS_TEXT[other])}“. ${D(CLS_TEXT[cls])[0].toUpperCase() + D(CLS_TEXT[cls]).slice(1)} sind ${f2[cls]} von 16.`));
  }
  const fy = pY === 0.75 ? "\\frac{3}{4}" : pY === 0.5 ? "\\frac{1}{2}" : "\\frac{1}{4}";
  const fr = pR === 0.75 ? "\\frac{3}{4}" : pR === 0.5 ? "\\frac{1}{2}" : "\\frac{1}{4}";
  const fTot = kind === "f2" ? `\\frac{${f2[cls]}}{16}` : "\\frac{1}{4}";
  return {
    instruction: tx("Two traits at once", "Zwei Merkmale zugleich"),
    text: tx(
      `Pea seeds: yellow ($G$) is dominant over green ($g$), round ($R$) over wrinkled ($r$). ${kind === "f2" ? "The F1 plants $GgRr$ are crossed with each other" : "A plant $GgRr$ is crossed with a plant $ggrr$ (test cross)"}. ${n} seeds result. How many of them are expected to be ${E(CLS_TEXT[cls])}?`,
      `Erbsensamen: gelb ($G$) ist dominant über grün ($g$), rund ($R$) über runzlig ($r$). ${kind === "f2" ? "Die F1-Pflanzen $GgRr$ werden untereinander gekreuzt" : "Eine Pflanze $GgRr$ wird mit einer Pflanze $ggrr$ gekreuzt (Rückkreuzung)"}. Es entstehen ${n} Samen. Wie viele davon sind voraussichtlich ${D(CLS_TEXT[cls])}?`,
    ),
    answer,
    hint: kind === "f2" ? tx("Each trait splits 3 : 1 on its own. Multiply the shares of colour and shape.", "Jedes Merkmal spaltet für sich 3 : 1 auf. Multipliziere die Anteile von Farbe und Form.") : tx("In a test cross each trait splits 1 : 1.", "Bei einer Rückkreuzung spaltet jedes Merkmal 1 : 1 auf."),
    solution: [
      { math: `${fy} \\cdot ${fr} = ${fTot}`, note: tx("The genes are inherited independently: multiply the share for the colour by the share for the shape.", "Die Gene werden unabhängig vererbt: Multipliziere den Anteil für die Farbe mit dem für die Form.") },
      { math: `${n} \\cdot ${fTot} = ${value}`, note: tx(`Expected: **${value}** seeds ${E(CLS_TEXT[cls])}.`, `Erwartet: **${value}** Samen ${D(CLS_TEXT[cls])}.`) },
    ],
    mistakes: m.list,
  };
}

function dihybridTask(rng: Rng): Exercise {
  const kind = rng.chance(0.75) ? "f2" : "test";
  return dihybridExercise(kind, rng.pick(["YR", "Yr", "yR", "yr", "yr", "Yr", "yR"] as Cls[]), kind === "f2" ? rng.int(10, 50) * 16 : rng.int(20, 100) * 4);
}

function gameteTask(rng: Rng): Exercise {
  const g = rng.pick(["GgRr", "GgRr", "GGRr", "Ggrr", "ggRr", "GgRR"]);
  const a = [...new Set([g[0], g[1]])];
  const b = [...new Set([g[2], g[3]])];
  const combos = a.flatMap((x) => b.map((y) => x + y));
  const ALL = ["GR", "Gr", "gR", "gr"];
  const opts = [...ALL.map((x) => ({ text: `$${x}$`, ok: combos.includes(x) })), { text: `$${g.slice(0, 2)}$`, ok: false }, { text: `$${g.slice(2)}$`, ok: false }];
  const right = opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
  const wrong = [{ pick: [...right, 4, 5], title: tx("One allele of each gene", "Ein Allel von jedem Gen"), say: tx("A gamete gets **one** allele of **each** gene: one of $G/g$ and one of $R/r$. $Gg$ would be two alleles of the same gene.", "Eine Keimzelle bekommt **ein** Allel von **jedem** Gen: eins von $G/g$ und eins von $R/r$. $Gg$ wären zwei Allele desselben Gens.") }];
  if (g === "GgRr") wrong.push({ pick: [0, 3], title: tx("New combinations too", "Auch Neukombinationen"), say: tx("The alleles of different genes are distributed independently (3rd law). So $Gr$ and $gR$ are just as likely as $GR$ and $gr$.", "Die Allele verschiedener Gene werden unabhängig verteilt (3. Regel). $Gr$ und $gR$ sind darum genauso wahrscheinlich wie $GR$ und $gr$.") });
  const m = multi(rng, opts, wrong);
  return {
    instruction: tx("Select all possible gametes", "Wähle alle möglichen Keimzellen"),
    text: tx(`A pea plant has the genotype $${g}$ (seed colour $G/g$, seed shape $R/r$, on different chromosomes). Which gametes can it form?`, `Eine Erbsenpflanze hat den Genotyp $${g}$ (Samenfarbe $G/g$, Samenform $R/r$, auf verschiedenen Chromosomen). Welche Keimzellen kann sie bilden?`),
    answer: m.answer,
    hint: tx("Pick one allele for colour and combine it with one allele for shape, in every possible way.", "Nimm ein Allel für die Farbe und kombiniere es mit einem für die Form, auf jede mögliche Art."),
    solution: [
      { math: `${a.join(" , ")} \\quad \\times \\quad ${b.join(" , ")}`, note: tx(`Colour: ${a.map((x) => `$${x}$`).join(" or ")}. Shape: ${b.map((x) => `$${x}$`).join(" or ")}.`, `Farbe: ${a.map((x) => `$${x}$`).join(" oder ")}. Form: ${b.map((x) => `$${x}$`).join(" oder ")}.`) },
      { math: combos.join(" \\quad "), note: tx(`Every combination works: **${combos.length} kinds of gametes**, equally frequent.`, `Jede Kombination ist möglich: **${combos.length} Sorten Keimzellen**, gleich häufig.`) },
    ],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Blood groups

const BG_OPT = (bg: BloodGroup): Text => tx(`group ${bg}`, `Gruppe ${bg}`);

function bloodChildrenExercise(rng: Rng | null, g1: string, g2: string): Exercise {
  const p = bloodChildren(g1, g2);
  const opts = BLOOD_GROUPS.map((bg) => ({ text: BG_OPT(bg), ok: p[bg] > 0 }));
  const idx = (bgs: BloodGroup[]) => bgs.map((b) => BLOOD_GROUPS.indexOf(b));
  const right = BLOOD_GROUPS.filter((bg) => p[bg] > 0);
  const wrong: { pick: number[]; title: Text; say: Text }[] = [];
  const bg1 = bloodGroup(g1);
  const bg2 = bloodGroup(g2);
  if (p["0"] > 0) wrong.push({ pick: idx(right.filter((b) => b !== "0")), title: tx("The hidden 0", "Die verborgene 0"), say: tx("Both parents carry a hidden $0$ allele. A child that gets $0$ from both is $00$: blood group 0.", "Beide Eltern tragen ein verborgenes $0$-Allel. Ein Kind, das von beiden $0$ bekommt, ist $00$: Blutgruppe 0.") });
  if (p.AB > 0) wrong.push({ pick: idx(right.filter((b) => b !== "AB")), title: tx("A and B together", "A und B zusammen"), say: tx("A child can get $A$ from one parent and $B$ from the other. $A$ and $B$ are codominant: blood group AB.", "Ein Kind kann $A$ vom einen und $B$ vom anderen Elternteil bekommen. $A$ und $B$ sind kodominant: Blutgruppe AB.") });
  if ((bg1 === "AB" || bg2 === "AB") && p.AB === 0) wrong.push({ pick: idx([...right, "AB"]), title: tx("AB is not passed on as a whole", "AB wird nicht als Ganzes vererbt"), say: tx("The AB parent passes on **either** $A$ **or** $B$, never both. The other parent has no $A$ or $B$ to add.", "Der AB-Elternteil gibt **entweder** $A$ **oder** $B$ weiter, nie beides. Der andere Elternteil hat kein passendes $A$ oder $B$ dazu.") });
  if ((bg1 === "AB" || bg2 === "AB") && p["0"] === 0) wrong.push({ pick: idx([...right, "0"]), title: tx("AB has no 0 to give", "AB hat keine 0 abzugeben"), say: tx("For blood group 0 a child needs $0$ from **both** parents. The AB parent only has $A$ and $B$.", "Für Blutgruppe 0 braucht ein Kind $0$ von **beiden** Eltern. Der AB-Elternteil hat nur $A$ und $B$.") });
  const parents = [...new Set([bg1, bg2])].filter((b) => right.includes(b));
  if (parents.length && parents.length < right.length) wrong.push({ pick: idx(parents), title: tx("Not just the parents' groups", "Nicht nur die Gruppen der Eltern"), say: tx("Children get one allele from each parent. New combinations can give blood groups the parents don't have.", "Kinder bekommen von jedem Elternteil ein Allel. Neue Kombinationen können Blutgruppen ergeben, die die Eltern nicht haben.") });
  const m = multi(rng, opts, wrong);
  const cells = punnett(g1, g2);
  return {
    instruction: tx("Select all possible blood groups", "Wähle alle möglichen Blutgruppen"),
    text: tx(`A mother has the genotype $${g1}$ (${E(bgName(bg1))}), the father $${g2}$ (${E(bgName(bg2))}). Which blood groups can their children have?`, `Eine Mutter hat den Genotyp $${g1}$ (${D(bgName(bg1))}), der Vater $${g2}$ (${D(bgName(bg2))}). Welche Blutgruppen können ihre Kinder haben?`),
    visual: visual(GeneticsPunnettGrid, { kind: "blood", g1: g2, g2: g1, hidden: true }),
    answer: m.answer,
    hint: tx("Fill in the square. $A$ and $B$ are codominant, $0$ is recessive.", "Füll das Quadrat aus. $A$ und $B$ sind kodominant, $0$ ist rezessiv."),
    solution: [
      { math: cells.join(" \\quad "), note: tx("The four possible genotypes of the children.", "Die vier möglichen Genotypen der Kinder.") },
      { math: tx(`"${right.map((b) => E(BG_OPT(b))).join(", ")}"`, `"${right.map((b) => D(BG_OPT(b))).join(", ")}"`), note: tx(`Translated into blood groups: **${right.join(", ")}**.`, `In Blutgruppen übersetzt: **${right.join(", ")}**.`) },
    ],
    mistakes: m.mistakes,
  };
}

const BLOOD_CROSSES: [string, string][] = [
  ["A0", "B0"],
  ["A0", "B0"],
  ["AB", "00"],
  ["AB", "A0"],
  ["AB", "B0"],
  ["A0", "A0"],
  ["B0", "B0"],
  ["AA", "B0"],
  ["BB", "A0"],
  ["AB", "AB"],
  ["A0", "00"],
  ["B0", "00"],
];

function bloodChildrenTask(rng: Rng) {
  const [a, b] = rng.pick(BLOOD_CROSSES);
  return rng.chance(0.5) ? bloodChildrenExercise(rng, a, b) : bloodChildrenExercise(rng, b, a);
}

function bloodPercentTask(rng: Rng): Exercise {
  const [g1, g2] = rng.pick(BLOOD_CROSSES);
  const p = bloodChildren(g1, g2);
  const bg = rng.chance(0.8) ? rng.pick(BLOOD_GROUPS.filter((b) => p[b] > 0)) : rng.pick(BLOOD_GROUPS);
  const v = p[bg] * 100;
  const answer = percent(v);
  const m = mistakeList(answer);
  if (bg === "0" && v > 0) m.add(percent(0), tx("Hidden 0 alleles", "Verborgene 0-Allele"), tx("Neither parent has blood group 0, but both can carry a hidden $0$. Then a quarter of the children are $00$.", "Keiner der Eltern hat Blutgruppe 0, aber beide können eine verborgene $0$ tragen. Dann ist ein Viertel der Kinder $00$."));
  if (bg === "AB" && v === 0) m.add(percent(25), tx("A and B from different parents", "A und B von verschiedenen Eltern"), tx("For AB the child needs $A$ from one parent **and** $B$ from the other. Check whether that's possible here.", "Für AB braucht das Kind $A$ vom einen **und** $B$ vom anderen Elternteil. Prüf, ob das hier geht."));
  const genos = punnett(g1, g2).filter((c) => bloodGroup(c) === bg);
  if (bg === "A" || bg === "B") {
    const strict = punnett(g1, g2).filter((c) => c === bg + bg).length;
    if (genos.length > strict) m.add(percent(strict * 25), tx("A0 counts too", "A0 zählt auch"), tx(`Blood group ${bg} means $${bg}${bg}$ **or** $${bg}0$. $0$ is recessive and hidden.`, `Blutgruppe ${bg} heißt $${bg}${bg}$ **oder** $${bg}0$. $0$ ist rezessiv und verborgen.`));
  }
  m.add(percent(v === 50 ? 25 : 50), tx("Count the cells", "Zähl die Felder"), tx("Each of the four cells stands for 25%. Count how many give this blood group.", "Jedes der vier Felder steht für 25 %. Zähl, wie viele diese Blutgruppe ergeben."));
  return {
    instruction: tx("Calculate the probability", "Berechne die Wahrscheinlichkeit"),
    text: tx(`Parents with the genotypes $${g1}$ and $${g2}$ have a child. How likely is it (in %) that the child has ${E(bgName(bg))}?`, `Eltern mit den Genotypen $${g1}$ und $${g2}$ bekommen ein Kind. Mit welcher Wahrscheinlichkeit (in %) hat es ${D(bgName(bg))}?`),
    answer,
    hint: tx("Fill in the square and translate each genotype into a blood group.", "Füll das Quadrat aus und übersetze jeden Genotyp in eine Blutgruppe."),
    solution: [
      { math: punnett(g1, g2).join(" \\quad "), note: tx("The four equally likely genotypes.", "Die vier gleich wahrscheinlichen Genotypen.") },
      { math: `${genos.length} \\cdot 25 "%" = ${v} "%"`, note: tx(`${genos.length ? genos.map((g) => `$${g}$`).join(", ") : "None"}: ${E(bgName(bg))}. Probability **${v}%**.`, `${genos.length ? genos.map((g) => `$${g}$`).join(", ") : "Keins"}: ${D(bgName(bg))}. Wahrscheinlichkeit **${v} %**.`) },
    ],
    mistakes: m.list,
  };
}

type BloodQ = { text: Text; right: string; opts: string[]; why: Text; wrong: Record<string, [Text, Text]> };
const BLOOD_PARENT: BloodQ[] = [
  {
    text: tx("A mother has blood group A, her child blood group 0. What is the mother's genotype?", "Eine Mutter hat Blutgruppe A, ihr Kind Blutgruppe 0. Welchen Genotyp hat die Mutter?"),
    right: "A0",
    opts: ["AA", "A0", "00", "AB"],
    why: tx("The child is $00$ and got one $0$ from its mother. With group A she must be $A0$.", "Das Kind ist $00$ und hat ein $0$ von der Mutter. Mit Gruppe A muss sie $A0$ sein."),
    wrong: {
      AA: [tx("The child needs a 0", "Das Kind braucht eine 0"), tx("A child with group 0 is $00$: it got a $0$ from each parent. So the mother carries a hidden $0$.", "Ein Kind mit Gruppe 0 ist $00$: Es hat von jedem Elternteil eine $0$. Die Mutter trägt also eine verborgene $0$.")],
      "00": [tx("She has group A", "Sie hat Gruppe A"), tx("With $00$ she would have blood group 0 herself.", "Mit $00$ hätte sie selbst Blutgruppe 0.")],
      AB: [tx("AB has no 0", "AB hat keine 0"), tx("$AB$ would be blood group AB, and it has no $0$ to pass on.", "$AB$ wäre Blutgruppe AB und hat keine $0$ zum Weitergeben.")],
    },
  },
  {
    text: tx("Mother group A, father group B, their child has blood group 0. What is the father's genotype?", "Mutter Gruppe A, Vater Gruppe B, ihr Kind hat Blutgruppe 0. Welchen Genotyp hat der Vater?"),
    right: "B0",
    opts: ["BB", "B0", "00", "AB"],
    why: tx("The child ($00$) got a $0$ from the father. With group B he must be $B0$.", "Das Kind ($00$) hat ein $0$ vom Vater. Mit Gruppe B muss er $B0$ sein."),
    wrong: {
      BB: [tx("The child needs a 0", "Das Kind braucht eine 0"), tx("A $00$ child got a $0$ from the father too. $BB$ has none.", "Ein $00$-Kind hat auch vom Vater eine $0$. $BB$ hat keine.")],
      "00": [tx("He has group B", "Er hat Gruppe B"), tx("With $00$ he would have blood group 0 himself.", "Mit $00$ hätte er selbst Blutgruppe 0.")],
      AB: [tx("AB has no 0", "AB hat keine 0"), tx("$AB$ would be blood group AB, with no $0$ to pass on.", "$AB$ wäre Blutgruppe AB, ohne $0$ zum Weitergeben.")],
    },
  },
  {
    text: tx("Can a man with blood group AB be the biological father of a child with blood group 0?", "Kann ein Mann mit Blutgruppe AB der leibliche Vater eines Kindes mit Blutgruppe 0 sein?"),
    right: "no",
    opts: ["no", "yes0", "yesA", "maybe"],
    why: tx("A child with group 0 is $00$ and needs a $0$ from the father. An AB man only passes on $A$ or $B$.", "Ein Kind mit Gruppe 0 ist $00$ und braucht eine $0$ vom Vater. Ein AB-Mann gibt nur $A$ oder $B$ weiter."),
    wrong: {
      yes0: [tx("Both parents must give 0", "Beide Eltern müssen 0 geben"), tx("Even if the mother is $00$: the child needs a second $0$ from the father, and AB has none.", "Selbst wenn die Mutter $00$ ist: Das Kind braucht eine zweite $0$ vom Vater, und AB hat keine.")],
      yesA: [tx("A wouldn't be hidden", "A wäre nicht verborgen"), tx("If the child got $A$ from him, it would have group A or AB, never 0.", "Bekäme das Kind von ihm ein $A$, hätte es Gruppe A oder AB, nie 0.")],
      maybe: [tx("The genotype is clear here", "Der Genotyp ist hier klar"), tx("Blood group AB always means genotype $AB$: no hidden $0$ possible.", "Blutgruppe AB heißt immer Genotyp $AB$: Eine verborgene $0$ ist unmöglich.")],
    },
  },
  {
    text: tx("A child has blood group AB, the mother blood group A. Which genotype can the father NOT have?", "Ein Kind hat Blutgruppe AB, die Mutter Blutgruppe A. Welchen Genotyp kann der Vater NICHT haben?"),
    right: "A0",
    opts: ["A0", "B0", "BB", "AB"],
    why: tx("The child's $B$ must come from the father. $A0$ has no $B$.", "Das $B$ des Kindes muss vom Vater stammen. $A0$ hat kein $B$."),
    wrong: {
      B0: [tx("B0 can give B", "B0 kann B geben"), tx("$B0$ passes on $B$ to half of the children: possible.", "$B0$ gibt der Hälfte der Kinder $B$ weiter: möglich.")],
      BB: [tx("BB always gives B", "BB gibt immer B"), tx("$BB$ always passes on $B$: possible.", "$BB$ gibt immer $B$ weiter: möglich.")],
      AB: [tx("AB can give B", "AB kann B geben"), tx("$AB$ passes on $B$ to half of the children: possible.", "$AB$ gibt der Hälfte der Kinder $B$ weiter: möglich.")],
    },
  },
];

const BP_TEXT: Record<string, Text> = {
  no: tx("No, he can only pass on A or B.", "Nein, er kann nur A oder B weitergeben."),
  yes0: tx("Yes, if the mother has blood group 0.", "Ja, wenn die Mutter Blutgruppe 0 hat."),
  yesA: tx("Yes, because A can be hidden.", "Ja, denn A kann verborgen sein."),
  maybe: tx("Only if he carries a hidden 0.", "Nur wenn er eine verborgene 0 trägt."),
};

function bloodParentTask(rng: Rng): Exercise {
  const q = rng.pick(BLOOD_PARENT);
  const opt = (o: string): Text => BP_TEXT[o] ?? `$${o}$`;
  const c = choice(rng, [{ text: opt(q.right) }, ...q.opts.filter((o) => o !== q.right).map((o) => ({ text: opt(o), title: q.wrong[o][0], say: q.wrong[o][1] }))]);
  return {
    instruction: tx("Blood groups", "Blutgruppen"),
    text: q.text,
    answer: c.answer,
    hint: tx("Blood group 0 is always $00$: one $0$ from each parent.", "Blutgruppe 0 ist immer $00$: eine $0$ von jedem Elternteil."),
    solution: [{ math: q.right === "no" ? tx('"no"', '"nein"') : q.right, note: q.why }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Pedigrees: dominant or recessive?

const MODE_OPT: Record<string, Text> = {
  AD: tx("autosomal dominant", "autosomal-dominant"),
  AR: tx("autosomal recessive", "autosomal-rezessiv"),
  both: tx("both are possible", "beides ist möglich"),
};

function decisivePedigree(rng: Rng, mode?: Mode) {
  const m: Mode = mode ?? (rng.chance(0.5) ? "AR" : "AD");
  const ped = generatePedigree(rng, m, ["AD", "AR"], (p) => p.length === 1, 9);
  const trio = exclusion(ped, m === "AD" ? "AR" : "AD")!;
  return { ped, mode: m, trio };
}

function trioText(trio: { father: number; mother: number; child: number }, mode: Mode): Text {
  const f = trio.father + 1;
  const m = trio.mother + 1;
  const c = trio.child + 1;
  return mode === "AR"
    ? tx(`Persons ${f} and ${m} are healthy, but their child ${c} is affected. The allele was hidden in both parents: it is **recessive**.`, `${f} und ${m} sind gesund, ihr Kind ${c} ist aber krank. Das Allel war bei beiden Eltern verborgen: Es ist **rezessiv**.`)
    : tx(`Persons ${f} and ${m} are both affected, but their child ${c} is healthy. Both parents must be $Aa$: the allele is **dominant**.`, `${f} und ${m} sind beide krank, ihr Kind ${c} ist aber gesund. Beide Eltern müssen $Aa$ sein: Das Allel ist **dominant**.`);
}

function pedigreeModeExercise(rng: Rng | null, ped: Pedigree, mode: Mode, trio: { father: number; mother: number; child: number }): Exercise {
  const other = mode === "AD" ? "AR" : "AD";
  const why = trioText(trio, mode);
  const c = choice(rng, [
    { text: MODE_OPT[mode] },
    { text: MODE_OPT[other], title: tx("Look at one family", "Schau auf eine Familie"), say: why },
    { text: MODE_OPT.both, title: tx("One family decides", "Eine Familie entscheidet"), say: why },
  ]);
  return {
    instruction: tx("Analyse the pedigree", "Analysiere den Stammbaum"),
    text: tx("The pedigree shows a family with a hereditary disease (filled = affected). Is the disease allele dominant or recessive?", "Der Stammbaum zeigt eine Familie mit einer Erbkrankheit (gefüllt = krank). Ist das Krankheitsallel dominant oder rezessiv?"),
    visual: visual(GeneticsPedigreeChart, { ped }),
    answer: c.answer,
    hint: tx("Look for parents whose child doesn't match them: two healthy parents with an affected child, or two affected parents with a healthy child.", "Such Eltern, deren Kind nicht zu ihnen passt: zwei gesunde Eltern mit krankem Kind oder zwei kranke Eltern mit gesundem Kind."),
    solution: [
      { math: tx(`"parents ${trio.father + 1}, ${trio.mother + 1}" \\to "child ${trio.child + 1}"`, `"Eltern ${trio.father + 1}, ${trio.mother + 1}" \\to "Kind ${trio.child + 1}"`), note: why },
      { math: tx(`"${E(MODE_OPT[mode])}"`, `"${D(MODE_OPT[mode])}"`), note: mode === "AR" ? tx("Healthy × healthy → affected child: **autosomal recessive** (like cystic fibrosis).", "Gesund × gesund → krankes Kind: **autosomal-rezessiv** (wie Mukoviszidose).") : tx("Affected × affected → healthy child: **autosomal dominant** (like Huntington's disease).", "Krank × krank → gesundes Kind: **autosomal-dominant** (wie Chorea Huntington).") },
    ],
    mistakes: c.mistakes,
  };
}

function pedigreeModeTask(rng: Rng): Exercise {
  const { ped, mode, trio } = decisivePedigree(rng);
  return pedigreeModeExercise(rng, ped, mode, trio);
}

function pedigreeGenoTask(rng: Rng): Exercise {
  const { ped, mode } = decisivePedigree(rng);
  const sets = possibleGenotypes(ped, mode);
  const P = ped.people;
  // carriers / heterozygous affected people are the interesting ones; sometimes an undecidable one
  const sure = P.map((_, i) => i).filter((i) => sets[i].length === 1 && sets[i][0] === 1);
  const open = P.map((_, i) => i).filter((i) => sets[i].length === 2);
  const pickOpen = open.length && (!sure.length || rng.chance(0.25));
  const who = pickOpen ? rng.pick(open) : sure.length ? rng.pick(sure) : rng.pick(P.map((_, i) => i));
  const set = sets[who];
  const label = (d: number) => (mode === "AR" ? ["AA", "Aa", "aa"][d] : ["aa", "Aa", "AA"][d]);
  const undecided = tx(`$${label(set[0])}$ or $${label(set[1] ?? set[0])}$: can't be decided`, `$${label(set[0])}$ oder $${label(set[1] ?? set[0])}$: nicht entscheidbar`);
  const p = P[who];
  const n = who + 1;
  const kids = P.map((q, i) => [q, i] as const).filter(([q]) => q.father === who || q.mother === who);
  const par = [p.father, p.mother].filter((x): x is number => x !== null);
  const rightText: Text = set.length > 1 ? undecided : `$${label(set[0])}$`;
  let reason: Text;
  if (set.length > 1)
    reason = mode === "AR" ? tx(`Person ${n} is healthy. Nothing in the tree shows whether ${n} carries a hidden $a$.`, `Person ${n} ist gesund. Nichts im Stammbaum zeigt, ob ${n} ein verborgenes $a$ trägt.`) : tx(`Person ${n} is affected. Nothing in the tree shows whether ${n} also has a healthy $a$.`, `Person ${n} ist krank. Nichts im Stammbaum zeigt, ob ${n} auch ein gesundes $a$ hat.`);
  else if (mode === "AR" && !p.affected) {
    const ak = kids.find(([q]) => q.affected);
    const ap = par.find((x) => P[x].affected);
    reason = ak
      ? tx(`Person ${n} is healthy, but child ${ak[1] + 1} is affected ($aa$) and got one $a$ from ${n}. So ${n} is a carrier: $Aa$.`, `Person ${n} ist gesund, aber Kind ${ak[1] + 1} ist krank ($aa$) und hat ein $a$ von ${n}. Also ist ${n} Überträger(in): $Aa$.`)
      : tx(`Person ${n} is healthy, but parent ${(ap ?? 0) + 1} is affected ($aa$) and passed on an $a$. So ${n} is a carrier: $Aa$.`, `Person ${n} ist gesund, aber Elternteil ${(ap ?? 0) + 1} ist krank ($aa$) und hat ein $a$ weitergegeben. Also ist ${n} Überträger(in): $Aa$.`);
  } else if (mode === "AD" && p.affected) {
    const hk = kids.find(([q]) => !q.affected);
    const hp = par.find((x) => !P[x].affected);
    reason = hk
      ? tx(`Person ${n} is affected, but child ${hk[1] + 1} is healthy ($aa$) and got an $a$ from ${n}. So ${n} is $Aa$.`, `Person ${n} ist krank, aber Kind ${hk[1] + 1} ist gesund ($aa$) und hat ein $a$ von ${n}. Also ist ${n} $Aa$.`)
      : tx(`Person ${n} is affected, but parent ${(hp ?? 0) + 1} is healthy ($aa$) and could only pass on $a$. So ${n} is $Aa$.`, `Person ${n} ist krank, aber Elternteil ${(hp ?? 0) + 1} ist gesund ($aa$) und konnte nur $a$ weitergeben. Also ist ${n} $Aa$.`);
  } else reason = p.affected ? tx(`Person ${n} is affected: with a recessive allele that means $aa$.`, `Person ${n} ist krank: Bei einem rezessiven Allel heißt das $aa$.`) : tx(`Person ${n} is healthy: with a dominant disease allele that means $aa$.`, `Person ${n} ist gesund: Bei einem dominanten Krankheitsallel heißt das $aa$.`);
  const optsAll: Opt[] = [{ text: rightText }];
  for (const d of [0, 1, 2]) {
    const txt: Text = `$${label(d)}$`;
    if (E(txt) === E(rightText)) continue;
    let title: Text = tx("Check the phenotype", "Prüf den Phänotyp");
    let say: Text = reason;
    if (set.length === 1 && set[0] === 1 && ((mode === "AR" && d === 0) || (mode === "AD" && d === 2))) {
      title = mode === "AR" ? tx("Carrier forgotten", "Überträger vergessen") : tx("Look at the family", "Schau auf die Familie");
      say = reason;
    }
    if (set.length > 1 && set.includes(d)) {
      title = tx("Possible, but not certain", "Möglich, aber nicht sicher");
      say = tx(`$${label(d)}$ fits, but so does $${label(set.find((x) => x !== d)!)}$. The tree doesn't decide.`, `$${label(d)}$ passt, aber $${label(set.find((x) => x !== d)!)}$ passt genauso. Der Stammbaum entscheidet das nicht.`);
    }
    optsAll.push({ text: txt, title, say });
  }
  if (set.length === 1) {
    const und = tx("can't be decided", "nicht entscheidbar");
    optsAll.push({ text: und, title: tx("Here you can be sure", "Hier geht's eindeutig"), say: reason });
  }
  const c = choice(rng, optsAll);
  const name = mode === "AR" ? tx("autosomal recessive", "autosomal-rezessiv") : tx("autosomal dominant", "autosomal-dominant");
  return {
    instruction: tx("Find the genotype", "Bestimme den Genotyp"),
    text: tx(
      `This disease is inherited ${E(name)} (alleles $A$ and $a$, ${mode === "AR" ? "$a$ causes the disease" : "$A$ causes the disease"}). What is the genotype of person ${n}?`,
      `Diese Krankheit wird ${D(name)} vererbt (Allele $A$ und $a$, ${mode === "AR" ? "$a$ verursacht die Krankheit" : "$A$ verursacht die Krankheit"}). Welchen Genotyp hat Person ${n}?`,
    ),
    visual: visual(GeneticsPedigreeChart, { ped, ask: who }),
    answer: c.answer,
    hint: tx(`Look at the parents and children of person ${n}. Who must have passed on which allele?`, `Schau auf die Eltern und Kinder von Person ${n}. Wer muss welches Allel weitergegeben haben?`),
    solution: [{ math: set.length > 1 ? tx(`${label(set[0])} "or" ${label(set[1])}`, `${label(set[0])} "oder" ${label(set[1])}`) : label(set[0]), note: reason }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Rules and terms (match)

type Rule = { id: string; term: Text; def: Text };
const RULES: Rule[] = [
  { id: "uni", term: tx("uniformity rule (1st law)", "Uniformitätsregel (1. Regel)"), def: tx("pure-breeding parents → all F1 offspring the same", "reinerbige Eltern → alle F1-Nachkommen gleich") },
  { id: "split", term: tx("segregation rule (2nd law)", "Spaltungsregel (2. Regel)"), def: tx("F1 × F1 → the traits split again, e.g. 3 : 1", "F1 × F1 → die Merkmale spalten wieder auf, z. B. 3 : 1") },
  { id: "indep", term: tx("independence rule (3rd law)", "Unabhängigkeitsregel (3. Regel)"), def: tx("alleles of different genes are inherited independently: 9 : 3 : 3 : 1", "Allele verschiedener Gene werden unabhängig vererbt: 9 : 3 : 3 : 1") },
  { id: "test", term: tx("test cross", "Rückkreuzung"), def: tx("cross with a homozygous recessive partner reveals the genotype", "Kreuzung mit einem rezessiv Reinerbigen verrät den Genotyp") },
  { id: "inter", term: tx("intermediate inheritance", "intermediärer Erbgang"), def: tx("heterozygotes show an in-between phenotype, e.g. pink", "Mischerbige zeigen eine Zwischenform, z. B. rosa") },
  { id: "codom", term: tx("codominance", "Kodominanz"), def: tx("both alleles show fully, e.g. blood group AB", "beide Allele zeigen sich voll, z. B. Blutgruppe AB") },
];

function rulesTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(RULES).slice(0, 4);
  const extra = RULES.filter((r) => !chosen.includes(r));
  const has = (id: string) => chosen.some((r) => r.id === id);
  const get = (id: string) => RULES.find((r) => r.id === id)!;
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("uni") && has("split")) wrong.push({ pairs: [[get("uni").term, get("split").def]], title: tx("1st and 2nd law swapped", "1. und 2. Regel vertauscht"), say: tx("Uniformity rule = the F1 is uniform. The splitting into 3 : 1 is the 2nd law, in the F2.", "Uniformitätsregel = die F1 ist einheitlich. Das Aufspalten in 3 : 1 ist die 2. Regel, in der F2.") });
  if (has("inter") && has("codom")) wrong.push({ pairs: [[get("inter").term, get("codom").def]], title: tx("Blend or both?", "Mischung oder beides?"), say: tx("Intermediate = an in-between form (pink). Codominant = both alleles show fully side by side (AB).", "Intermediär = eine Zwischenform (rosa). Kodominant = beide Allele zeigen sich voll nebeneinander (AB).") });
  if (has("test") && has("split")) wrong.push({ pairs: [[get("test").term, get("split").def]], title: tx("Different partners", "Andere Partner"), say: tx("A test cross uses a homozygous recessive partner. Crossing F1 with F1 is what the splitting rule describes.", "Bei der Rückkreuzung kreuzt man mit einem rezessiv Reinerbigen. F1 × F1 beschreibt die Spaltungsregel.") });
  const m = matchTask(
    chosen.map((r) => [r.term, r.def]),
    extra.length ? [rng.pick(extra).def] : [],
    wrong,
  );
  return {
    instruction: tx("Match the rules", "Ordne die Regeln zu"),
    text: tx("Which statement belongs to which term? One statement is left over.", "Welche Aussage gehört zu welchem Begriff? Eine Aussage bleibt übrig."),
    answer: m.answer,
    hint: tx("1st law: F1. 2nd law: F2. 3rd law: two genes.", "1. Regel: F1. 2. Regel: F2. 3. Regel: zwei Gene."),
    solution: chosen.slice(0, 2).map((r, i) => ({
      math: tx(`"${E(r.term)}"`, `"${D(r.term)}"`),
      note: i === 0 ? tx(`${E(r.term)}: ${E(r.def)}.`, `${D(r.term)}: ${D(r.def)}.`) : tx(chosen.slice(1).map((o) => `${E(o.term)}: ${E(o.def)}.`).join(" "), chosen.slice(1).map((o) => `${D(o.term)}: ${D(o.def)}.`).join(" ")),
    })),
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// One cell of a Punnett square

function punnettCellTask(rng: Rng): Exercise {
  const kind = rng.pick<PunnettKind>(["flower", "shape", "mirabilis", "blood", "blood"]);
  const list = PUNNETT_GENOTYPES[kind];
  const het = list.filter((g) => g[0] !== g[1]);
  const g1 = rng.pick(het);
  const g2 = rng.pick(kind === "blood" ? list.filter((g) => g !== "00" || rng.chance(0.3)) : het);
  const cells = punnett(g1, g2);
  const idx = rng.int(0, 3);
  const right = cells[idx];
  const r = Math.floor(idx / 2);
  const col = idx % 2;
  const sameCol = [g1[col], g1[col]].sort().join("");
  const sameRow = [g2[r], g2[r]].sort().join("");
  const norm = (g: string) => list.find((x) => [...x].sort().join("") === [...g].sort().join("")) ?? g;
  const opts: Opt[] = [{ text: `$${right}$` }];
  const say = tx("Each cell combines **one** gamete from the top with **one** from the side: the one in its column and the one in its row.", "Jedes Feld kombiniert **eine** Keimzelle von oben mit **einer** von der Seite: die aus seiner Spalte und die aus seiner Zeile.");
  for (const g of [norm(sameCol), norm(sameRow), ...rng.shuffle(list)]) {
    if (opts.length >= 4 || opts.some((o) => E(o.text) === `$${g}$`)) continue;
    opts.push({ text: `$${g}$`, title: tx("Column and row", "Spalte und Zeile"), say });
  }
  const c = choice(rng, opts);
  const names: Record<PunnettKind, Text> = {
    flower: tx("Pea flower colour: $A$ purple, $a$ white.", "Erbse, Blütenfarbe: $A$ violett, $a$ weiß."),
    shape: tx("Pea seed shape: $R$ round, $r$ wrinkled.", "Erbse, Samenform: $R$ rund, $r$ runzlig."),
    mirabilis: tx("Four o'clock flower: $R$ red, $W$ white (intermediate).", "Wunderblume: $R$ rot, $W$ weiß (intermediär)."),
    blood: tx("Blood groups: alleles $A$, $B$ and $0$.", "Blutgruppen: Allele $A$, $B$ und $0$."),
  };
  return {
    instruction: tx("Complete the Punnett square", "Vervollständige das Kreuzungsschema"),
    text: tx(`${E(names[kind])} Cross $${g1} \\times ${g2}$. Which genotype belongs in the marked cell?`, `${D(names[kind])} Kreuzung $${g1} \\times ${g2}$. Welcher Genotyp gehört in das markierte Feld?`),
    visual: visual(GeneticsPunnettGrid, { kind, g1, g2, ask: idx }),
    answer: c.answer,
    hint: tx("Take the gamete above the cell and the gamete to its left.", "Nimm die Keimzelle über dem Feld und die links daneben."),
    solution: [{ math: `${g1[col]} + ${g2[r]} = ${right}`, note: tx(`Column: $${g1[col]}$, row: $${g2[r]}$. Together: **$${right}$**.`, `Spalte: $${g1[col]}$, Zeile: $${g2[r]}$. Zusammen: **$${right}$**.`) }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [1.3, () => ratioTask(rng)],
    [1.3, () => countTask(rng)],
    [0.5, () => mendelTask(rng)],
    [1, () => interTask(rng)],
    [1, () => testCrossTask(rng)],
    [1.1, () => dihybridTask(rng)],
    [0.6, () => gameteTask(rng)],
    [0.8, () => bloodChildrenTask(rng)],
    [0.6, () => bloodPercentTask(rng)],
    [0.5, () => bloodParentTask(rng)],
    [1, () => pedigreeModeTask(rng)],
    [0.8, () => pedigreeGenoTask(rng)],
    [0.5, () => rulesTask(rng)],
    [0.6, () => punnettCellTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

function PunnettL2() {
  return <GeneticsPunnett kinds={["flower", "mirabilis", "blood"]} />;
}

const lessonPedigree = decisivePedigree(createRng(2024), "AR");

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The Punnett square", "Das Kreuzungsschema"),
      blob: tx("Mendel's F1 plants were all purple. But what happens in the next generation?", "Mendels F1-Pflanzen waren alle violett. Aber was passiert in der nächsten Generation?"),
      body: tx(
        "To find all possible offspring, write the gametes of both parents on the edges of a square and combine them: the **Punnett square** (Kreuzungsschema). Each cell is equally likely.",
        "Um alle möglichen Nachkommen zu finden, schreibst du die Keimzellen beider Eltern an die Ränder eines Quadrats und kombinierst sie: das **Kreuzungsschema** (Punnett-Quadrat). Jedes Feld ist gleich wahrscheinlich.",
      ),
      frames: [
        { math: '"F1:" \\; Aa#p1 \\times Aa#p2', note: tx("Mendel let the purple F1 plants ($Aa$) pollinate themselves: $Aa \\times Aa$.", "Mendel ließ die violetten F1-Pflanzen ($Aa$) sich selbst bestäuben: $Aa \\times Aa$.") },
        { math: tx('"gametes:" \\; A#g1 , a#g2 \\quad A#g3 , a#g4', '"Keimzellen:" \\; A#g1 , a#g2 \\quad A#g3 , a#g4'), note: tx("Each plant forms two kinds of gametes, $A$ and $a$, in equal numbers.", "Jede Pflanze bildet zwei Sorten Keimzellen, $A$ und $a$, gleich häufig.") },
        { math: "AA#c1 \\quad Aa#c2 \\quad Aa#c3 \\quad aa#c4", note: tx("Combine each gamete with each: four equally likely cells.", "Kombiniere jede Keimzelle mit jeder: vier gleich wahrscheinliche Felder.") },
        { math: "1 AA#c1 : 2 Aa#c2 : 1 aa#c4", note: tx("**Genotype ratio** 1 : 2 : 1.", "**Genotypverhältnis** 1 : 2 : 1.") },
        { math: tx('3 "purple" : 1 "white"', '3 "violett" : 1 "weiß"'), note: tx("$AA$ and $Aa$ look the same: **phenotype ratio** 3 : 1. White is back!", "$AA$ und $Aa$ sehen gleich aus: **Phänotypverhältnis** 3 : 1. Weiß ist wieder da!") },
        { math: tx('"2nd law:" \\; "F1" \\times "F1" \\to 3 : 1', '"2. Regel:" \\; "F1" \\times "F1" \\to 3 : 1'), note: tx("**Mendel's 2nd law (segregation rule)**: if you cross the heterozygous F1 among themselves, the traits split again in the F2: 3 : 1 in the phenotype, 1 : 2 : 1 in the genotype.", "**2. Mendelsche Regel (Spaltungsregel)**: Kreuzt man die mischerbige F1 untereinander, spalten die Merkmale in der F2 wieder auf: 3 : 1 im Phänotyp, 1 : 2 : 1 im Genotyp.") },
      ],
    },
    {
      type: "widget",
      title: tx("The Punnett square builder", "Der Kreuzungsschema-Baukasten"),
      blob: tx("Pick parents and watch the square fill up!", "Wähl Eltern aus und schau zu, wie sich das Quadrat füllt!"),
      body: tx("Pick the genotypes of both parents. Which cross gives 3 : 1? Which gives 1 : 1? Then try the four o'clock flower and the blood groups.", "Wähle die Genotypen beider Eltern. Welche Kreuzung ergibt 3 : 1? Welche 1 : 1? Probier dann die Wunderblume und die Blutgruppen."),
      widget: PunnettL2,
    },
    { type: "check", blob: tx("Now with real numbers!", "Jetzt mit echten Zahlen!"), exercise: countExercise("colour", ["Gg", "Gg"], 400, "rec") },
    {
      type: "explain",
      title: tx("Intermediate inheritance", "Intermediärer Erbgang"),
      blob: tx("Sometimes nobody wins and you get pink!", "Manchmal gewinnt keiner, und es wird rosa!"),
      body: tx(
        "Not every pair of alleles has a winner. In the four o'clock flower (*Mirabilis jalapa*) red × white gives pink: the heterozygote shows an in-between form. This is **intermediate inheritance**. Both alleles get capitals: $R$ (red) and $W$ (white).",
        "Nicht jedes Allelpaar hat einen Gewinner. Bei der Wunderblume (*Mirabilis jalapa*) ergibt rot × weiß rosa: Die Mischerbigen zeigen eine Zwischenform. Das ist der **intermediäre Erbgang**. Beide Allele bekommen Großbuchstaben: $R$ (rot) und $W$ (weiß).",
      ),
      frames: [
        { math: tx('"P:" \\; RR#a \\times WW#b', '"P:" \\; RR#a \\times WW#b'), note: tx("Red × white, both pure-breeding.", "Rot × weiß, beide reinerbig.") },
        { math: tx('"F1:" \\; RW#c \\to "pink"', '"F1:" \\; RW#c \\to "rosa"'), note: tx("All F1 plants are pink: uniform, but in between.", "Alle F1-Pflanzen blühen rosa: einheitlich, aber dazwischen.") },
        { math: '"F2:" \\; 1 RR : 2 RW : 1 WW', note: tx("F1 × F1: the alleles separate again in the gametes. They never blended.", "F1 × F1: In den Keimzellen trennen sich die Allele wieder. Vermischt haben sie sich nie.") },
        { math: tx('1 "red" : 2 "pink" : 1 "white"', '1 "rot" : 2 "rosa" : 1 "weiß"'), note: tx("Phenotype ratio = genotype ratio = 1 : 2 : 1. Here you can read the genotype from the flower!", "Phänotypverhältnis = Genotypverhältnis = 1 : 2 : 1. Hier kannst du den Genotyp an der Blüte ablesen!") },
      ],
    },
    {
      type: "explain",
      title: tx("The test cross", "Die Rückkreuzung"),
      blob: tx("Purple outside, but what's inside? Here's the trick.", "Außen violett, aber was steckt drin? Hier kommt der Trick."),
      body: tx("A purple-flowered pea can be $AA$ or $Aa$: you can't see the difference. The trick: cross it with a white plant ($aa$). That one can only pass on $a$.", "Eine violett blühende Erbse kann $AA$ oder $Aa$ sein: Den Unterschied sieht man nicht. Der Trick: Kreuze sie mit einer weißen Pflanze ($aa$). Die kann nur $a$ weitergeben."),
      frames: [
        { math: '"A?" \\times aa', note: tx("Unknown genotype × homozygous recessive: this is the **test cross** (Rückkreuzung).", "Unbekannter Genotyp × rezessiv reinerbig: Das ist die **Rückkreuzung** (Testkreuzung).") },
        { math: tx('AA \\times aa \\to "all" Aa', 'AA \\times aa \\to "alle" Aa'), note: tx("If it is $AA$: all offspring are $Aa$, all purple.", "Ist sie $AA$: Alle Nachkommen sind $Aa$, alle violett.") },
        { math: "Aa \\times aa \\to 1 Aa : 1 aa", note: tx("If it is $Aa$: half $Aa$ (purple), half $aa$ (white): 1 : 1.", "Ist sie $Aa$: Hälfte $Aa$ (violett), Hälfte $aa$ (weiß): 1 : 1.") },
        { math: tx('"white offspring" \\Rightarrow Aa', '"weiße Nachkommen" \\Rightarrow Aa'), note: tx("Even one white offspring proves that the purple parent carries $a$. Many offspring that are all purple point to $AA$.", "Schon ein weißer Nachkomme beweist, dass die violette Pflanze $a$ trägt. Viele Nachkommen, die alle violett sind, sprechen für $AA$.") },
      ],
    },
    { type: "check", blob: tx("Detective time: what's inside this plant?", "Detektivarbeit: Was steckt in dieser Pflanze?"), exercise: testCrossExercise(createRng(7), "flower", true, 47, 45) },
    {
      type: "widget",
      title: tx("Two traits at once", "Zwei Merkmale gleichzeitig"),
      blob: tx("Sixteen cells, four kinds of seeds. Let's count!", "Sechzehn Felder, vier Sorten Samen. Zählen wir!"),
      body: tx(
        "Mendel also followed two traits together: seed colour ($G$ yellow, $g$ green) and seed shape ($R$ round, $r$ wrinkled). P: $GGRR \\times ggrr$, F1: all $GgRr$. Each F1 plant forms four kinds of gametes. **3rd law (independence rule)**: alleles of different genes are inherited independently (if the genes lie on different chromosomes). New combinations appear.",
        "Mendel verfolgte auch zwei Merkmale gleichzeitig: Samenfarbe ($G$ gelb, $g$ grün) und Samenform ($R$ rund, $r$ runzlig). P: $GGRR \\times ggrr$, F1: alle $GgRr$. Jede F1-Pflanze bildet vier Sorten Keimzellen. **3. Mendelsche Regel (Unabhängigkeitsregel)**: Allele verschiedener Gene werden unabhängig voneinander vererbt (wenn die Gene auf verschiedenen Chromosomen liegen). Es entstehen Neukombinationen.",
      ),
      widget: GeneticsDihybrid,
    },
    {
      type: "explain",
      title: tx("Blood groups: three alleles", "Blutgruppen: drei Allele"),
      blob: tx("Your own blood is a genetics lesson!", "Dein eigenes Blut ist eine Genetikstunde!"),
      body: tx("Human blood groups (AB0 system) depend on one gene with **three** alleles: $A$, $B$ and $0$. Each person has two of them.", "Die Blutgruppen des Menschen (AB0-System) hängen von einem Gen mit **drei** Allelen ab: $A$, $B$ und $0$. Jeder Mensch hat zwei davon."),
      frames: [
        { math: tx('AA , A0 \\to "group A"', 'AA , A0 \\to "Gruppe A"'), note: tx("$A$ is dominant over $0$: $AA$ and $A0$ both give blood group A.", "$A$ ist dominant über $0$: $AA$ und $A0$ ergeben beide Blutgruppe A.") },
        { math: tx('BB , B0 \\to "group B"', 'BB , B0 \\to "Gruppe B"'), note: tx("Same for $B$: $BB$ and $B0$ give blood group B.", "Genauso bei $B$: $BB$ und $B0$ ergeben Blutgruppe B.") },
        { math: tx('AB \\to "group AB"', 'AB \\to "Gruppe AB"'), note: tx("$A$ and $B$ are **codominant**: both show fully. $AB$ gives blood group AB.", "$A$ und $B$ sind **kodominant**: Beide zeigen sich voll. $AB$ ergibt Blutgruppe AB.") },
        { math: tx('00 \\to "group 0"', '00 \\to "Gruppe 0"'), note: tx("Only $00$ gives blood group 0: the $0$ allele is recessive.", "Nur $00$ ergibt Blutgruppe 0: Das $0$-Allel ist rezessiv.") },
        { math: "A0 \\times B0 \\to AB , A0 , B0 , 00", note: tx("So parents with groups A and B can have children with **all four** blood groups!", "Eltern mit den Gruppen A und B können also Kinder mit **allen vier** Blutgruppen haben!") },
      ],
    },
    { type: "check", blob: tx("Which blood groups are possible?", "Welche Blutgruppen sind möglich?"), exercise: bloodChildrenExercise(createRng(5), "AB", "00") },
    {
      type: "widget",
      title: tx("Reading pedigrees", "Stammbäume lesen"),
      blob: tx("Time for some genetic detective work!", "Zeit für genetische Detektivarbeit!"),
      body: tx(
        "A **pedigree** shows a family over several generations: square = man, circle = woman, filled = affected. A line joins a couple, their children hang below. Two clues decide: **two healthy parents with an affected child → recessive** (e.g. cystic fibrosis). **Two affected parents with a healthy child → dominant** (e.g. Huntington's disease).",
        "Ein **Stammbaum** zeigt eine Familie über mehrere Generationen: Quadrat = Mann, Kreis = Frau, gefüllt = krank. Eine Linie verbindet ein Paar, die Kinder hängen darunter. Zwei Hinweise entscheiden: **Zwei gesunde Eltern mit krankem Kind → rezessiv** (z. B. Mukoviszidose). **Zwei kranke Eltern mit gesundem Kind → dominant** (z. B. Chorea Huntington).",
      ),
      widget: GeneticsPedigreeDetective,
    },
    { type: "check", blob: tx("Your turn, detective!", "Du bist dran, Detektiv!"), exercise: pedigreeModeExercise(createRng(9), lessonPedigree.ped, lessonPedigree.mode, lessonPedigree.trio) },
  ],
  summary: [
    {
      title: tx("Punnett square and 2nd law", "Kreuzungsschema und 2. Regel"),
      body: tx("Gametes on the edges, offspring in the cells, each cell equally likely. **Segregation rule**: F1 × F1 ($Aa \\times Aa$) splits 3 : 1 in the phenotype and 1 : 2 : 1 in the genotype.", "Keimzellen an die Ränder, Nachkommen in die Felder, jedes Feld gleich wahrscheinlich. **Spaltungsregel**: F1 × F1 ($Aa \\times Aa$) spaltet 3 : 1 im Phänotyp und 1 : 2 : 1 im Genotyp auf."),
      examples: ["Aa \\times Aa \\to 1 AA : 2 Aa : 1 aa"],
      tone: "rule",
    },
    {
      title: tx("Intermediate and codominant", "Intermediär und kodominant"),
      body: tx("Intermediate: the heterozygote shows an in-between form (pink), F2 1 : 2 : 1. Codominant: both alleles show (blood group AB).", "Intermediär: Mischerbige zeigen eine Zwischenform (rosa), F2 1 : 2 : 1. Kodominant: Beide Allele zeigen sich (Blutgruppe AB)."),
      examples: [tx('RW \\to "pink" \\quad AB \\to "group AB"', 'RW \\to "rosa" \\quad AB \\to "Gruppe AB"')],
      tone: "rule",
    },
    {
      title: tx("Test cross", "Rückkreuzung"),
      body: tx("Cross the dominant-looking organism with $aa$: all dominant → $AA$; 1 : 1 → $Aa$.", "Kreuze das dominant aussehende Lebewesen mit $aa$: alle dominant → $AA$; 1 : 1 → $Aa$."),
      examples: ["Aa \\times aa \\to 1 Aa : 1 aa"],
      tone: "rule",
    },
    {
      title: tx("3rd law: independence rule", "3. Regel: Unabhängigkeitsregel"),
      body: tx("Genes on different chromosomes are inherited independently. Dihybrid F2: 9 : 3 : 3 : 1. Multiply the shares: $\\frac{3}{4} \\cdot \\frac{1}{4} = \\frac{3}{16}$.", "Gene auf verschiedenen Chromosomen werden unabhängig vererbt. Dihybride F2: 9 : 3 : 3 : 1. Anteile multiplizieren: $\\frac{3}{4} \\cdot \\frac{1}{4} = \\frac{3}{16}$."),
      examples: ["GgRr \\times GgRr \\to 9 : 3 : 3 : 1"],
      tone: "rule",
    },
    {
      title: tx("Pedigrees", "Stammbäume"),
      body: tx("Healthy × healthy → affected child: **recessive**. Affected × affected → healthy child: **dominant**. Then fill in the genotypes: healthy parents of an affected child are carriers ($Aa$).", "Gesund × gesund → krankes Kind: **rezessiv**. Krank × krank → gesundes Kind: **dominant**. Dann Genotypen eintragen: Gesunde Eltern eines kranken Kindes sind Überträger ($Aa$)."),
      examples: [tx('Aa \\times Aa \\to aa \\; "(affected)"', 'Aa \\times Aa \\to aa \\; "(krank)"')],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Don't mix up the genotype ratio (1 : 2 : 1) and the phenotype ratio (3 : 1). And 3 : 1 only comes from $Aa \\times Aa$: $Aa \\times aa$ gives 1 : 1.", "Verwechsle nicht Genotypverhältnis (1 : 2 : 1) und Phänotypverhältnis (3 : 1). Und 3 : 1 gibt es nur bei $Aa \\times Aa$: $Aa \\times aa$ ergibt 1 : 1."),
      examples: [tx('"genotype" \\; 1 : 2 : 1 \\ne "phenotype" \\; 3 : 1', '"Genotyp" \\; 1 : 2 : 1 \\ne "Phänotyp" \\; 3 : 1')],
      tone: "warning",
    },
  ],
};
