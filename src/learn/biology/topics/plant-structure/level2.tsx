"use client";

// Level 2 (Klasse 7–9): the leaf in cross-section, stomata, vascular bundles (xylem and
// phloem), how water rises (transpiration pull, cohesion, capillarity, root pressure) and
// what speeds transpiration up or slows it down.

import { tx, type Text } from "@/i18n/text";
import { decText } from "@/learn/chemistry/format";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { PlantLeafExplorer, PlantLeafSection } from "@/learn/biology/visuals/PlantLeafSection";
import { PlantPotometer, PlantVaselineChart, type Coat } from "@/learn/biology/visuals/PlantLab";
import { PlantTranspiration } from "@/learn/biology/visuals/PlantTranspiration";
import { PlantVascularBundle } from "@/learn/biology/visuals/PlantVascularBundle";
import { capT, choice, de, en, join, mistakes, pickTask, q, visual, where, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Names in the leaf section

type W = { accept: Text[]; title: Text; say: Text; close?: boolean };
const EPI = ["Epidermis", "epidermis"];

const LEAF_WORDS: Record<string, { accept: Text[]; why: Text; wrong: W[] }> = {
  cuticle: {
    accept: [tx("cuticle", "Cuticula"), "Kutikula", "wax layer", "Wachsschicht"],
    why: tx("The thin layer of wax right on top: the cuticle.", "Die dünne Wachsschicht ganz außen: die Cuticula."),
    wrong: [{ accept: [tx("upper epidermis", "obere Epidermis"), ...EPI], title: tx("Even further out", "Noch weiter außen"), say: tx("The epidermis is the layer of cells underneath. This is the thin wax layer on top of it.", "Die Epidermis ist die Zellschicht darunter. Gesucht ist die dünne Wachsschicht darauf.") }],
  },
  upper: {
    accept: [tx("upper epidermis", "obere Epidermis")],
    why: tx("One layer of tightly joined cells without chloroplasts, on the upper side: the upper epidermis.", "Eine Schicht lückenloser Zellen ohne Chloroplasten auf der Oberseite: die obere Epidermis."),
    wrong: [
      { accept: EPI, title: tx("Which epidermis?", "Welche Epidermis?"), say: tx("Right, an epidermis! But which one, the upper or the lower?", "Richtig, eine Epidermis! Aber welche, die obere oder die untere?"), close: true },
      { accept: [tx("lower epidermis", "untere Epidermis")], title: tx("Look where it is", "Schau, wo sie liegt"), say: tx("It's at the top, right under the cuticle. So it's the upper one.", "Sie liegt oben, direkt unter der Cuticula. Also ist es die obere.") },
      { accept: [tx("cuticle", "Cuticula")], title: tx("Cells, not wax", "Zellen, kein Wachs"), say: tx("The cuticle is the thin wax layer above. The marker points to the row of cells under it.", "Die Cuticula ist die dünne Wachsschicht darüber. Die Markierung zeigt auf die Zellreihe darunter.") },
    ],
  },
  palisade: {
    accept: [tx("palisade tissue", "Palisadengewebe"), "Palisadenparenchym", "palisade mesophyll", "palisade layer", "Palisadenschicht"],
    why: tx("Long cells standing close together like fence posts, full of chloroplasts: the palisade tissue.", "Lange Zellen, dicht wie Zaunpfähle, voller Chloroplasten: das Palisadengewebe."),
    wrong: [{ accept: [tx("spongy tissue", "Schwammgewebe"), "Schwammparenchym"], title: tx("Packed tightly", "Dicht gepackt"), say: tx("The spongy tissue lies below and is loose. Here the cells stand close together like fence posts (palisades).", "Das Schwammgewebe liegt darunter und ist locker. Hier stehen die Zellen dicht wie Zaunpfähle (Palisaden).") }],
  },
  spongy: {
    accept: [tx("spongy tissue", "Schwammgewebe"), "Schwammparenchym", "spongy mesophyll", "spongy layer"],
    why: tx("Loose, irregular cells with air spaces between them: the spongy tissue.", "Lockere, unregelmäßige Zellen mit Hohlräumen dazwischen: das Schwammgewebe."),
    wrong: [
      { accept: [tx("palisade tissue", "Palisadengewebe")], title: tx("Loosely packed", "Locker gelagert"), say: tx("The palisade cells are long and tightly packed. These cells lie loosely with spaces between them, like a sponge.", "Palisadenzellen sind lang und dicht gepackt. Diese Zellen liegen locker mit Lücken dazwischen, wie ein Schwamm.") },
      { accept: [tx("air space", "Interzellulare"), "Interzellularen"], title: tx("The cells, not the gaps", "Die Zellen, nicht die Lücken"), say: tx("The gaps are the air spaces. The marker points to the tissue made of the loose cells.", "Die Lücken sind die Interzellularen. Die Markierung zeigt auf das Gewebe aus den lockeren Zellen."), close: true },
    ],
  },
  air: {
    accept: [tx("air space", "Interzellulare"), "Interzellularen", "Interzellularraum", "Interzellularräume", "Zellzwischenraum", "Zellzwischenräume", "air spaces", "intercellular space", "intercellular spaces"],
    why: tx("The air-filled space between the cells: an air space (intercellular space).", "Der luftgefüllte Raum zwischen den Zellen: eine Interzellulare."),
    wrong: [
      { accept: [tx("spongy tissue", "Schwammgewebe")], title: tx("The space between", "Der Raum dazwischen"), say: tx("Nearly: the spongy tissue is the cells. The marker points to the air between them.", "Fast: Das Schwammgewebe sind die Zellen. Die Markierung zeigt auf die Luft dazwischen."), close: true },
      { accept: [tx("substomatal cavity", "Atemhöhle")], title: tx("Not above the stoma", "Nicht über der Spaltöffnung"), say: tx("The substomatal cavity sits right above the stoma. This is an ordinary gap between two cells.", "Die Atemhöhle liegt direkt über der Spaltöffnung. Das hier ist eine gewöhnliche Lücke zwischen zwei Zellen.") },
    ],
  },
  cavity: {
    accept: [tx("substomatal cavity", "Atemhöhle"), "air chamber", "Atemraum"],
    why: tx("The large air space right above the stoma: the substomatal cavity.", "Der große Luftraum direkt über der Spaltöffnung: die Atemhöhle."),
    wrong: [{ accept: [tx("air space", "Interzellulare"), "Interzellularen"], title: tx("A special air space", "Ein besonderer Luftraum"), say: tx("Nearly, it is an air space, but a special one: right above the stoma.", "Fast, es ist ein Luftraum, aber ein besonderer: direkt über der Spaltöffnung."), close: true }],
  },
  lower: {
    accept: [tx("lower epidermis", "untere Epidermis")],
    why: tx("The bottom layer of cells with the stomata: the lower epidermis.", "Die unterste Zellschicht mit den Spaltöffnungen: die untere Epidermis."),
    wrong: [
      { accept: EPI, title: tx("Which epidermis?", "Welche Epidermis?"), say: tx("Right, an epidermis! Upper or lower?", "Richtig, eine Epidermis! Obere oder untere?"), close: true },
      { accept: [tx("upper epidermis", "obere Epidermis")], title: tx("Look where it is", "Schau, wo sie liegt"), say: tx("It's at the very bottom, with the stomata. So it's the lower one.", "Sie liegt ganz unten, bei den Spaltöffnungen. Also ist es die untere.") },
    ],
  },
  guard: {
    accept: [tx("guard cell", "Schließzelle"), "Schließzellen", "guard cells"],
    why: tx("One of the two bean-shaped cells around the pore: a guard cell.", "Eine der beiden bohnenförmigen Zellen am Spalt: eine Schließzelle."),
    wrong: [{ accept: [tx("stoma", "Spaltöffnung"), "Stoma", "Spaltöffnungen"], title: tx("One of the two cells", "Eine der beiden Zellen"), say: tx("Nearly! The stoma is the whole thing. The marker points to one of the two cells that form it.", "Fast! Die Spaltöffnung ist das Ganze. Die Markierung zeigt auf eine der beiden Zellen, die sie bilden."), close: true }],
  },
  stoma: {
    accept: [tx("stoma", "Spaltöffnung"), "Spaltöffnungen", "stomata", "Stoma", "Stomata", "pore", "Spalt"],
    why: tx("The opening between the two guard cells: the stoma.", "Die Öffnung zwischen den beiden Schließzellen: die Spaltöffnung."),
    wrong: [{ accept: [tx("guard cell", "Schließzelle"), "Schließzellen"], title: tx("The opening itself", "Die Öffnung selbst"), say: tx("The guard cells form the stoma. The marker points to the opening between them.", "Die Schließzellen bilden die Spaltöffnung. Die Markierung zeigt auf die Öffnung zwischen ihnen."), close: true }],
  },
  xylem: {
    accept: ["Xylem", "Holzteil", "xylem vessels", "Gefäße"],
    why: tx("The big, thick-walled tubes at the top of the vein: the xylem (wood part).", "Die großen, dickwandigen Röhren oben in der Blattader: das Xylem (Holzteil)."),
    wrong: [
      { accept: ["Phloem", "Siebteil"], title: tx("Top or bottom?", "Oben oder unten?"), say: tx("In a leaf the xylem is on top and the phloem below. The marker points to the big tubes at the top.", "Im Blatt liegt das Xylem oben und das Phloem unten. Die Markierung zeigt auf die großen Röhren oben."), close: false },
      { accept: [tx("vascular bundle", "Leitbündel"), "Blattader"], title: tx("Which part of it?", "Welcher Teil davon?"), say: tx("Right, it's in the vascular bundle! Which part: the big tubes on top?", "Richtig, es liegt im Leitbündel! Welcher Teil davon: die großen Röhren oben?"), close: true },
    ],
  },
  phloem: {
    accept: ["Phloem", "Siebteil", "sieve tubes", "Siebröhren"],
    why: tx("The small cells at the bottom of the vein: the phloem (sieve part).", "Die kleinen Zellen unten in der Blattader: das Phloem (Siebteil)."),
    wrong: [
      { accept: ["Xylem", "Holzteil"], title: tx("Top or bottom?", "Oben oder unten?"), say: tx("In a leaf the xylem is on top and the phloem below. The marker points to the small cells at the bottom.", "Im Blatt liegt das Xylem oben und das Phloem unten. Die Markierung zeigt auf die kleinen Zellen unten.") },
      { accept: [tx("vascular bundle", "Leitbündel"), "Blattader"], title: tx("Which part of it?", "Welcher Teil davon?"), say: tx("Right, it's in the vascular bundle! Which part: the small cells at the bottom?", "Richtig, es liegt im Leitbündel! Welcher Teil davon: die kleinen Zellen unten?"), close: true },
    ],
  },
  bundle: {
    accept: [tx("vascular bundle", "Leitbündel"), "Blattader", "leaf vein", "vein"],
    why: tx("The whole leaf vein with xylem and phloem: a vascular bundle.", "Die ganze Blattader mit Xylem und Phloem: ein Leitbündel."),
    wrong: [{ accept: ["Xylem", "Phloem"], title: tx("The whole bundle", "Das ganze Bündel"), say: tx("That's only one part of it. The marker means the whole vein with its sheath.", "Das ist nur ein Teil davon. Gemeint ist die ganze Blattader mit ihrer Hülle."), close: true }],
  },
  chloroplast: {
    accept: [tx("chloroplast", "Chloroplast"), "Chloroplasten", "chloroplasts"],
    why: tx("The small green bodies with chlorophyll: chloroplasts.", "Die kleinen grünen Körperchen mit Chlorophyll: Chloroplasten."),
    wrong: [{ accept: [tx("nucleus", "Zellkern")], title: tx("The green ones", "Die grünen"), say: tx("The nucleus is the purple dot. The marker points to the small green bodies.", "Der Zellkern ist der lila Punkt. Die Markierung zeigt auf die kleinen grünen Körperchen.") }],
  },
};

function leafWordTask(rng: Rng): Exercise {
  const part = rng.pick(Object.keys(LEAF_WORDS));
  const P = LEAF_WORDS[part];
  const answer: AnswerSpec = { kind: "word", accept: P.accept, placeholder: tx("name of the structure", "Name der Struktur") };
  const m = mistakes(answer);
  for (const w of P.wrong) m.add({ kind: "word", accept: w.accept }, w.title, w.say, w.close);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("The picture shows a cross-section through a leaf. What is the structure with the question mark called?", "Das Bild zeigt einen Querschnitt durch ein Laubblatt. Wie heißt die Struktur mit dem Fragezeichen?"),
    visual: visual(PlantLeafSection, { mode: "numbers", ask: part, legend: "none" }),
    answer,
    hint: tx("Go through the layers from top to bottom: cuticle, epidermis, palisade, spongy tissue, epidermis.", "Geh die Schichten von oben nach unten durch: Cuticula, Epidermis, Palisaden, Schwammgewebe, Epidermis."),
    solution: [{ math: q(capT(P.accept[0]), "a"), note: P.why, highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Structure and function

const FUNCS: { id: string; name: Text; job: Text }[] = [
  { id: "cuticle", name: tx("Cuticle", "Cuticula"), job: tx("wax layer, protects against water loss", "Wachsschicht, schützt vor Wasserverlust") },
  { id: "upper", name: tx("Upper epidermis", "Obere Epidermis"), job: tx("transparent cells without chloroplasts", "durchsichtige Zellen ohne Chloroplasten") },
  { id: "palisade", name: tx("Palisade tissue", "Palisadengewebe"), job: tx("main site of photosynthesis", "Hauptort der Fotosynthese") },
  { id: "spongy", name: tx("Spongy tissue", "Schwammgewebe"), job: tx("air spaces for gas exchange", "Hohlräume für den Gasaustausch") },
  { id: "guard", name: tx("Guard cells", "Schließzellen"), job: tx("open and close the stoma", "öffnen und schließen den Spalt") },
  { id: "xylem", name: tx("Xylem", "Xylem"), job: tx("brings water and minerals into the leaf", "bringt Wasser und Mineralstoffe ins Blatt") },
  { id: "phloem", name: tx("Phloem", "Phloem"), job: tx("carries sugar solution out of the leaf", "führt Zuckerlösung aus dem Blatt ab") },
];
const F = (id: string) => FUNCS.find((f) => f.id === id)!;

function functionMatchTask(rng: Rng): Exercise {
  const want = rng.chance(0.6) ? ["xylem", "phloem"] : [];
  const rest = rng.shuffle(FUNCS.filter((f) => !want.includes(f.id))).slice(0, 4 - want.length);
  const chosen = FUNCS.filter((f) => want.includes(f.id) || rest.includes(f));
  const left = FUNCS.filter((f) => !chosen.includes(f));
  const extra = rng.pick(left);
  const has = (id: string) => chosen.some((f) => f.id === id);
  const list: Mistake[] = [];
  if (has("xylem") && has("phloem"))
    list.push({ when: { kind: "match", pairs: [[F("xylem").name, F("phloem").job]] }, title: tx("Xylem carries no sugar", "Xylem leitet keinen Zucker"), say: tx("The classic mix-up! The xylem carries water and minerals upwards. Sugar travels in the phloem (sieve part).", "Die klassische Verwechslung! Das Xylem leitet Wasser und Mineralstoffe nach oben. Zucker reist im Phloem (Siebteil).") });
  if (has("palisade") && has("spongy"))
    list.push({ when: { kind: "match", pairs: [[F("spongy").name, F("palisade").job]] }, title: tx("Fewer chloroplasts", "Weniger Chloroplasten"), say: tx("The spongy tissue has chloroplasts too, but far fewer. The tightly packed palisade cells right under the epidermis do most of the photosynthesis.", "Das Schwammgewebe hat auch Chloroplasten, aber viel weniger. Die meiste Fotosynthese machen die dicht gepackten Palisadenzellen direkt unter der Epidermis.") });
  if (has("cuticle") && has("upper"))
    list.push({ when: { kind: "match", pairs: [[F("upper").name, F("cuticle").job]] }, title: tx("Wax isn't cells", "Wachs sind keine Zellen"), say: tx("The protective wax layer is the cuticle. It lies on top of the epidermis cells, which make it.", "Die schützende Wachsschicht ist die Cuticula. Sie liegt auf den Epidermiszellen, die sie bilden.") });
  return {
    instruction: tx("Structure and function", "Bau und Funktion"),
    text: tx("Match each structure of the leaf with its job. One card is left over.", "Ordne jeder Struktur des Blattes ihre Aufgabe zu. Eine Karte bleibt übrig."),
    answer: { kind: "match", pairs: chosen.map((f) => [f.name, f.job] as [Text, Text]), distractors: [extra.job] },
    hint: tx("Think about where each structure lies and what it is made of.", "Überleg, wo jede Struktur liegt und woraus sie besteht."),
    solution: [
      { math: chosen.slice(0, 2).map((f, i) => join(q(f.name, `n${i}`), "\\to", q(f.job, `j${i}`))).reduce((a, b) => join(a, "\\\\", b)), note: tx(`${en(chosen[0].name)}: ${en(chosen[0].job)}. ${en(chosen[1].name)}: ${en(chosen[1].job)}.`, `${de(chosen[0].name)}: ${de(chosen[0].job)}. ${de(chosen[1].name)}: ${de(chosen[1].job)}.`) },
      { math: chosen.map((f, i) => join(q(f.name, `n${i}`), "\\to", q(f.job, `j${i}`))).reduce((a, b) => join(a, "\\\\", b)), note: tx(`${en(chosen[2].name)}: ${en(chosen[2].job)}. ${en(chosen[3].name)}: ${en(chosen[3].job)}.`, `${de(chosen[2].name)}: ${de(chosen[2].job)}. ${de(chosen[3].name)}: ${de(chosen[3].job)}.`) },
    ],
    mistakes: list,
  };
}

const LAYERS: Text[] = [tx("Cuticle", "Cuticula"), tx("Upper epidermis", "Obere Epidermis"), tx("Palisade tissue", "Palisadengewebe"), tx("Spongy tissue", "Schwammgewebe"), tx("Lower epidermis", "Untere Epidermis")];

function layerOrderTask(rng: Rng): Exercise {
  const up = rng.chance(0.35);
  const base = rng.chance(0.5) ? LAYERS : LAYERS.slice(1);
  const items = up ? [...base].reverse() : base;
  const list: Mistake[] = [];
  const [pal, spo, epi, cut] = [LAYERS[2], LAYERS[3], LAYERS[1], LAYERS[0]];
  list.push({
    when: { kind: "order", items: up ? [pal, spo] : [spo, pal] },
    title: tx("Palisades face the light", "Palisaden zum Licht"),
    say: tx("The palisade tissue lies right under the upper epidermis, where most light arrives. The spongy tissue is below it.", "Das Palisadengewebe liegt direkt unter der oberen Epidermis, wo das meiste Licht ankommt. Darunter folgt das Schwammgewebe."),
  });
  if (base.includes(cut)) list.push({ when: { kind: "order", items: up ? [cut, epi] : [epi, cut] }, title: tx("Wax on the outside", "Wachs außen"), say: tx("The cuticle is the wax layer on the outside of the epidermis.", "Die Cuticula ist die Wachsschicht außen auf der Epidermis.") });
  return {
    instruction: tx("Order the layers", "Ordne die Schichten"),
    text: up ? tx("Put the layers of a leaf in order **from bottom to top**.", "Bring die Schichten eines Laubblatts in die richtige Reihenfolge, **von unten nach oben**.") : tx("Put the layers of a leaf in order **from top to bottom**.", "Bring die Schichten eines Laubblatts in die richtige Reihenfolge, **von oben nach unten**."),
    answer: { kind: "order", items },
    hint: tx("The light comes from above. Which cells catch most of it?", "Das Licht kommt von oben. Welche Zellen fangen das meiste davon ein?"),
    solution: [{ math: items.map((it, i) => q(it, `l${i}`)).reduce((a, b) => join(a, "\\\\", b)), note: up ? tx("From the bottom: lower epidermis with stomata, spongy tissue, palisade tissue, upper epidermis, cuticle.", "Von unten: untere Epidermis mit Spaltöffnungen, Schwammgewebe, Palisadengewebe, obere Epidermis, Cuticula.") : tx("From the top: cuticle, upper epidermis, palisade tissue, spongy tissue, lower epidermis.", "Von oben: Cuticula, obere Epidermis, Palisadengewebe, Schwammgewebe, untere Epidermis.") }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Xylem or phloem?

const XP: Text[] = [tx("Xylem (wood part)", "Xylem (Holzteil)"), tx("Phloem (sieve part)", "Phloem (Siebteil)"), tx("Both", "Beide")];
const XP_FACTS: { s: Text; a: 0 | 1 | 2 }[] = [
  { s: tx("carries water from the root to the leaves", "leitet Wasser von der Wurzel in die Blätter"), a: 0 },
  { s: tx("carries minerals such as nitrate upwards", "leitet Mineralstoffe wie Nitrat nach oben"), a: 0 },
  { s: tx("is made of dead, lignified tubes", "besteht aus toten, verholzten Röhren"), a: 0 },
  { s: tx("transports only from bottom to top", "transportiert nur von unten nach oben"), a: 0 },
  { s: tx("lies on the upper side of a leaf vein", "liegt in der Blattader oben"), a: 0 },
  { s: tx("is pulled upwards by the transpiration pull", "wird vom Transpirationssog nach oben gezogen"), a: 0 },
  { s: tx("lies on the inner side of a bundle in the stem", "liegt im Leitbündel der Sprossachse innen"), a: 0 },
  { s: tx("carries sugar solution out of the leaves", "leitet Zuckerlösung aus den Blättern ab"), a: 1 },
  { s: tx("brings sugar to fruits and buds", "bringt Zucker zu Früchten und Knospen"), a: 1 },
  { s: tx("is made of living sieve tubes", "besteht aus lebenden Siebröhren"), a: 1 },
  { s: tx("has sieve plates and companion cells", "hat Siebplatten und Geleitzellen"), a: 1 },
  { s: tx("transports both upwards and downwards", "transportiert nach oben und nach unten"), a: 1 },
  { s: tx("lies on the lower side of a leaf vein", "liegt in der Blattader unten"), a: 1 },
  { s: tx("supplies a potato tuber with sugar for its starch", "versorgt die Kartoffelknolle mit Zucker für ihre Stärke"), a: 1 },
  { s: tx("lies on the outer side of a bundle in the stem", "liegt im Leitbündel der Sprossachse außen"), a: 1 },
  { s: tx("is part of the vascular bundles", "ist ein Teil der Leitbündel"), a: 2 },
  { s: tx("runs from the root right into every leaf", "zieht sich von der Wurzel bis in jedes Blatt"), a: 2 },
  { s: tx("transports substances dissolved in water", "transportiert in Wasser gelöste Stoffe"), a: 2 },
];

function xpSay(right: 0 | 1 | 2, picked: number): [Text, Text] {
  if (right === 1 && picked === 0)
    return [tx("Xylem carries no sugar", "Xylem leitet keinen Zucker"), tx("The classic mix-up! The xylem only carries water and minerals upwards. Sugar solution travels in the living sieve tubes of the phloem.", "Die klassische Verwechslung! Das Xylem leitet nur Wasser und Mineralstoffe nach oben. Zuckerlösung reist in den lebenden Siebröhren des Phloems.")];
  if (right === 0 && picked === 1)
    return [tx("Water goes up in the xylem", "Wasser steigt im Xylem"), tx("The phloem carries sugar solution. Water and minerals rise in the dead tubes of the xylem (wood part).", "Das Phloem leitet Zuckerlösung. Wasser und Mineralstoffe steigen in den toten Röhren des Xylems (Holzteil).")];
  if (picked === 2)
    return [tx("Only one of them", "Nur einer von beiden"), tx("This one fits only one of the two. Think: water and minerals in dead tubes, or sugar in living sieve tubes?", "Das passt nur zu einem der beiden. Überleg: Wasser und Mineralstoffe in toten Röhren oder Zucker in lebenden Siebröhren?")];
  return [tx("Both do that", "Das machen beide"), tx("This is true for xylem and phloem alike: both are parts of the vascular bundles and carry dissolved substances.", "Das gilt für Xylem und Phloem gleichermaßen: Beide sind Teile der Leitbündel und leiten gelöste Stoffe.")];
}

function xpTask(rng: Rng): Exercise {
  const f = rng.pick(XP_FACTS);
  const answer: AnswerSpec = { kind: "choice", options: XP, correct: f.a };
  const list: Mistake[] = [0, 1, 2]
    .filter((i) => i !== f.a)
    .map((i) => {
      const [title, say] = xpSay(f.a, i);
      return { when: { kind: "choice", options: XP, correct: i } as AnswerSpec, title, say };
    });
  return {
    instruction: tx("Xylem or phloem?", "Xylem oder Phloem?"),
    text: tx(`Which part of the vascular bundle **${en(f.s)}**?`, `Welcher Teil des Leitbündels **${de(f.s)}**?`),
    answer,
    hint: tx("Xylem: water and minerals, dead tubes, upwards. Phloem: sugar solution, living sieve tubes, both directions.", "Xylem: Wasser und Mineralstoffe, tote Röhren, nach oben. Phloem: Zuckerlösung, lebende Siebröhren, in beide Richtungen."),
    solution: [{ math: q(XP[f.a], "a"), note: tx(`${en(XP[f.a])}: it ${en(f.s)}.`, `${de(XP[f.a])}: ${de(f.s)}.`), highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Transpiration factors

const UPDOWN: Text[] = [tx("It increases", "Sie steigt"), tx("It decreases", "Sie sinkt"), tx("It stays (almost) the same", "Sie bleibt (fast) gleich")];
const CHANGES: { c: Text; a: 0 | 1 | 2; why: Text; key: Text }[] = [
  { c: tx("the sun comes out", "die Sonne herauskommt"), a: 0, key: tx("light", "Licht"), why: tx("Light opens the stomata, so more water vapour escapes.", "Licht öffnet die Spaltöffnungen, also entweicht mehr Wasserdampf.") },
  { c: tx("night falls", "es Nacht wird"), a: 1, key: tx("darkness", "Dunkelheit"), why: tx("In the dark the stomata close, so hardly any water vapour escapes.", "Im Dunkeln schließen sich die Spaltöffnungen, kaum noch Wasserdampf entweicht.") },
  { c: tx("it gets warmer", "es wärmer wird"), a: 0, key: tx("warmth", "Wärme"), why: tx("Warm air takes up more water vapour, and water evaporates faster.", "Warme Luft nimmt mehr Wasserdampf auf, und Wasser verdunstet schneller.") },
  { c: tx("it gets colder", "es kühler wird"), a: 1, key: tx("cold", "Kälte"), why: tx("Cold air takes up less water vapour, and water evaporates more slowly.", "Kalte Luft nimmt weniger Wasserdampf auf, und Wasser verdunstet langsamer.") },
  { c: tx("the wind picks up", "Wind aufkommt"), a: 0, key: tx("wind", "Wind"), why: tx("Wind blows away the moist air in front of the stomata, so the difference stays large.", "Wind weht die feuchte Luft vor den Spaltöffnungen weg, der Unterschied bleibt groß.") },
  { c: tx("a fan blows at the plant", "ein Ventilator auf die Pflanze bläst"), a: 0, key: tx("wind", "Wind"), why: tx("Moving air carries the moist air away from the leaf, so more water evaporates.", "Bewegte Luft trägt die feuchte Luft vom Blatt weg, also verdunstet mehr Wasser.") },
  { c: tx("the wind dies down", "der Wind sich legt"), a: 1, key: tx("still air", "Windstille"), why: tx("Without wind, a layer of moist air stays in front of the stomata and slows evaporation.", "Ohne Wind bleibt eine feuchte Luftschicht vor den Spaltöffnungen und bremst die Verdunstung.") },
  { c: tx("the air becomes more humid", "die Luft feuchter wird"), a: 1, key: tx("humid air", "feuchte Luft"), why: tx("Humid air already holds a lot of water vapour, so the difference to the inside of the leaf is small.", "Feuchte Luft enthält schon viel Wasserdampf, der Unterschied zum Blattinneren ist klein.") },
  { c: tx("the air becomes drier", "die Luft trockener wird"), a: 0, key: tx("dry air", "trockene Luft"), why: tx("Dry air takes up water vapour eagerly: the difference to the moist leaf inside grows.", "Trockene Luft nimmt gierig Wasserdampf auf: Der Unterschied zum feuchten Blattinneren wächst.") },
  { c: tx("the soil dries out", "der Boden austrocknet"), a: 1, key: tx("water shortage", "Wassermangel"), why: tx("When water runs short, the plant closes its stomata to save water.", "Bei Wassermangel schließt die Pflanze ihre Spaltöffnungen, um Wasser zu sparen.") },
  { c: tx("a clear plastic bag is put over the plant", "eine durchsichtige Plastiktüte über die Pflanze gestülpt wird"), a: 1, key: tx("humid air", "feuchte Luft"), why: tx("The air in the bag soon fills up with water vapour, so less and less evaporates.", "Die Luft in der Tüte füllt sich schnell mit Wasserdampf, also verdunstet immer weniger.") },
  { c: tx("the undersides of the leaves are coated with Vaseline", "die Blattunterseiten mit Vaseline bestrichen werden"), a: 1, key: tx("stomata blocked", "Spaltöffnungen dicht"), why: tx("Most stomata are on the underside: blocking them stops most of the transpiration.", "Die meisten Spaltöffnungen liegen unten: Werden sie verschlossen, stoppt der Großteil der Transpiration.") },
  { c: tx("the upper sides of the leaves are coated with Vaseline", "die Blattoberseiten mit Vaseline bestrichen werden"), a: 2, key: tx("few stomata on top", "oben kaum Spaltöffnungen"), why: tx("The upper side has a thick cuticle and few or no stomata, so little changes.", "Die Oberseite hat eine dicke Cuticula und kaum Spaltöffnungen, also ändert sich wenig.") },
  { c: tx("the plant is moved from the sun into the shade", "die Pflanze aus der Sonne in den Schatten gestellt wird"), a: 1, key: tx("less light", "weniger Licht"), why: tx("Less light: the stomata open less, and the leaf stays cooler.", "Weniger Licht: Die Spaltöffnungen öffnen sich weniger, und das Blatt bleibt kühler.") },
];

function factorTask(rng: Rng, fixed?: number): Exercise {
  const ch = CHANGES[fixed ?? rng.int(0, CHANGES.length - 1)];
  const opts: Opt[] = [{ text: UPDOWN[ch.a] }];
  for (const i of [0, 1, 2].filter((i) => i !== ch.a))
    opts.push({
      text: UPDOWN[i],
      title: i === 2 ? tx("It does change", "Es ändert sich doch") : tx("The other way round", "Andersherum"),
      say: tx(`Not quite. ${en(ch.why)}`, `Nicht ganz. ${de(ch.why)}`),
    });
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("How does transpiration change?", "Wie ändert sich die Transpiration?"),
    text: tx(`A plant stands outside. How does its transpiration change when **${en(ch.c)}**?`, `Eine Pflanze steht im Freien. Wie verändert sich ihre Transpiration, wenn **${de(ch.c)}**?`),
    answer,
    hint: tx("Ask two things: are the stomata open or closed? And how easily can the air take up water vapour?", "Frag dich zweierlei: Sind die Spaltöffnungen offen oder zu? Und wie leicht kann die Luft Wasserdampf aufnehmen?"),
    solution: [{ math: join(q(ch.key, "k"), "\\Rightarrow", q(UPDOWN[ch.a], "a")), note: ch.why, highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The way of the water

const PATH: Text[] = [
  tx("Water in the soil", "Wasser im Boden"),
  tx("Root hair", "Wurzelhaar"),
  tx("Root cortex", "Wurzelrinde"),
  tx("Xylem of the root", "Xylem der Wurzel"),
  tx("Xylem of the shoot axis", "Xylem der Sprossachse"),
  tx("Xylem of the leaf vein", "Xylem der Blattader"),
  tx("Air spaces in the leaf", "Interzellularen im Blatt"),
  tx("Stoma", "Spaltöffnung"),
];

function pathTask(rng: Rng): Exercise {
  const n = rng.int(5, 6);
  const start = rng.int(0, PATH.length - n);
  const items = PATH.slice(start, start + n);
  const list: Mistake[] = [];
  const has = (i: number) => items.includes(PATH[i]);
  if (has(6) && has(5)) list.push({ when: { kind: "order", items: [PATH[6], PATH[5]] }, title: tx("Vein first", "Erst die Blattader"), say: tx("The water reaches the leaf through the xylem of the vein. Only then does it leave the vein and evaporate into the air spaces.", "Das Wasser kommt über das Xylem der Blattader ins Blatt. Erst dann verlässt es die Ader und verdunstet in die Interzellularen.") });
  if (has(1) && has(2)) list.push({ when: { kind: "order", items: [PATH[2], PATH[1]] }, title: tx("In through the hairs", "Durch die Haare hinein"), say: tx("The root hairs are the outermost cells: water enters there first, then crosses the root cortex.", "Die Wurzelhaare sind die äußersten Zellen: Dort kommt das Wasser zuerst hinein und durchquert dann die Wurzelrinde.") });
  if (has(3) && has(4)) list.push({ when: { kind: "order", items: [PATH[4], PATH[3]] }, title: tx("From bottom to top", "Von unten nach oben"), say: tx("The xylem is one continuous pipe: from the root through the shoot axis into the leaves.", "Das Xylem ist ein durchgehendes Rohrsystem: von der Wurzel durch die Sprossachse in die Blätter.") });
  return {
    instruction: tx("The way of the water", "Der Weg des Wassers"),
    text: tx("Put the stations of the water on its way through the plant in the right order.", "Bring die Stationen des Wassers auf seinem Weg durch die Pflanze in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("Start where the water enters the plant and end where it leaves it.", "Beginne dort, wo das Wasser in die Pflanze kommt, und ende dort, wo es sie verlässt."),
    solution: [
      { math: items.slice(0, 3).map((it, i) => q(it, `p${i}`)).reduce((a, b) => join(a, "\\\\ \\to", b)), note: tx("In through the root hairs and on into the xylem.", "Über die Wurzelhaare hinein und weiter ins Xylem.") },
      { math: items.map((it, i) => q(it, `p${i}`)).reduce((a, b) => join(a, "\\\\ \\to", b)), note: tx("Up through the xylem and out of the leaf as water vapour: the transpiration stream.", "Im Xylem nach oben und als Wasserdampf aus dem Blatt hinaus: der Transpirationsstrom.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// How water rises

const MECH: { term: Text; desc: Text }[] = [
  { term: tx("Transpiration pull", "Transpirationssog"), desc: tx("Water evaporating from the leaves pulls the water column up behind it.", "Wasser, das aus den Blättern verdunstet, zieht den Wasserfaden hinter sich her nach oben.") },
  { term: tx("Cohesion", "Kohäsion"), desc: tx("Water molecules hold on to each other, so the water column in the vessels doesn't break.", "Wassermoleküle halten aneinander fest, darum reißt der Wasserfaden in den Gefäßen nicht ab.") },
  { term: tx("Adhesion", "Adhäsion"), desc: tx("Water sticks to the walls of the vessels.", "Wasser haftet an den Wänden der Gefäße.") },
  { term: tx("Capillarity", "Kapillarität"), desc: tx("In very narrow tubes water rises a little all by itself.", "In sehr engen Röhren steigt Wasser von selbst ein kleines Stück nach oben.") },
  { term: tx("Root pressure", "Wurzeldruck"), desc: tx("Root cells push water from below into the xylem.", "Wurzelzellen drücken Wasser von unten ins Xylem.") },
  { term: tx("Guttation", "Guttation (Tropfenbildung)"), desc: tx("In the morning, droplets of water are pressed out at the edges of the leaves.", "Am Morgen werden an den Blatträndern Wassertropfen herausgedrückt.") },
  { term: tx("Transpiration", "Transpiration (Verdunstung)"), desc: tx("The plant gives off water vapour through its stomata.", "Die Pflanze gibt über ihre Spaltöffnungen Wasserdampf ab.") },
];
const MECH_CONFUSE: Record<string, string[]> = {
  "Transpiration pull": ["Root pressure", "Transpiration", "Capillarity"],
  Cohesion: ["Adhesion", "Capillarity", "Transpiration pull"],
  Adhesion: ["Cohesion", "Capillarity", "Root pressure"],
  Capillarity: ["Adhesion", "Cohesion", "Transpiration pull"],
  "Root pressure": ["Transpiration pull", "Guttation", "Capillarity"],
  Guttation: ["Transpiration", "Root pressure", "Cohesion"],
  Transpiration: ["Guttation", "Transpiration pull", "Adhesion"],
};
const MECH_SAY: Record<string, Text> = {
  "Transpiration pull": tx("The transpiration pull comes from above: evaporation at the leaves pulls the water up.", "Der Transpirationssog wirkt von oben: Die Verdunstung an den Blättern zieht das Wasser nach oben."),
  Cohesion: tx("Cohesion is water holding on to water: molecules among themselves.", "Kohäsion heißt: Wasser hält an Wasser fest, die Moleküle untereinander."),
  Adhesion: tx("Adhesion is water sticking to something else, such as the vessel wall.", "Adhäsion heißt: Wasser haftet an etwas anderem, zum Beispiel an der Gefäßwand."),
  Capillarity: tx("Capillarity is water rising by itself in narrow tubes, only a short way.", "Kapillarität heißt: Wasser steigt in engen Röhren von selbst, aber nur ein kleines Stück."),
  "Root pressure": tx("Root pressure pushes from below, out of the root.", "Der Wurzeldruck schiebt von unten, aus der Wurzel."),
  Guttation: tx("Guttation means liquid droplets pressed out at the leaf edge.", "Guttation heißt: flüssige Tropfen, die am Blattrand herausgedrückt werden."),
  Transpiration: tx("Transpiration means giving off water vapour through the stomata.", "Transpiration heißt: Abgabe von Wasserdampf über die Spaltöffnungen."),
};

function mechTask(rng: Rng): Exercise {
  const m = rng.pick(MECH);
  const wrong = MECH_CONFUSE[en(m.term)].map((t) => MECH.find((x) => en(x.term) === t)!);
  const { answer, mistakes: list } = choice(rng, [
    { text: m.term },
    ...wrong.map((w) => ({ text: w.term, title: tx("A different process", "Ein anderer Vorgang"), say: MECH_SAY[en(w.term)] })),
  ]);
  return {
    instruction: tx("Which process is it?", "Welcher Vorgang ist gemeint?"),
    text: m.desc,
    answer,
    hint: tx("Pull from above, push from below, sticking to each other or to the wall?", "Zug von oben, Druck von unten, Zusammenhalt untereinander oder Haften an der Wand?"),
    solution: [{ math: q(m.term, "a"), note: m.desc, highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Experiments: potometer, Vaseline, ink

function potometerTask(rng: Rng): Exercise | null {
  const t = rng.pick([2, 3, 4, 5, 6, 8, 10]);
  const rate = rng.pick([1.5, 2, 2.5, 3, 4, 4.5, 5, 6]);
  const d = rate * t;
  if (d < 10 || d > 48 || !Number.isInteger(d)) return null;
  const start = rng.int(1, Math.floor((56 - d) / 2)) * 2;
  const end = start + d;
  const answer: AnswerSpec = { kind: "number", value: rate, unit: "mm/min", tolerance: 0.01 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: end / t, tolerance: 0.01 }, tx("Start isn't zero", "Der Start ist nicht null"), tx(`The bubble didn't start at 0 but at ${start} mm. The distance is end minus start.`, `Die Blase startete nicht bei 0, sondern bei ${start} mm. Die Strecke ist Ende minus Start.`));
  m.add({ kind: "number", value: d, tolerance: 0.01 }, tx("Per minute!", "Pro Minute!"), tx(`That's the whole distance in ${t} minutes. Divide by the time to get the speed per minute.`, `Das ist die ganze Strecke in ${t} Minuten. Teil sie durch die Zeit, dann hast du die Geschwindigkeit pro Minute.`), true);
  m.add({ kind: "number", value: t / d, tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("You divided time by distance. Speed is distance divided by time: mm per min.", "Du hast Zeit durch Strecke geteilt. Geschwindigkeit ist Strecke durch Zeit: mm pro min."));
  return {
    instruction: tx("Read the potometer", "Lies das Potometer ab"),
    text: tx(
      `A leafy shoot sits in a potometer. As it takes up water, the air bubble in the capillary moves towards it. In ${t} minutes the bubble moves from the dashed position to the solid one. How fast does it move, in mm per minute?`,
      `Ein beblätterter Spross steckt in einem Potometer. Nimmt er Wasser auf, wandert die Luftblase in der Kapillare auf ihn zu. In ${t} Minuten wandert sie von der gestrichelten zur durchgezogenen Position. Wie schnell wandert sie in mm pro Minute?`,
    ),
    visual: visual(PlantPotometer, { start, end }),
    answer,
    hint: tx("Read off start and end, subtract, then divide by the time.", "Lies Start und Ende ab, zieh sie voneinander ab und teile durch die Zeit."),
    solution: [
      { math: `${end}#e "mm" - ${start}#s "mm" = ${d}#d "mm"`, note: tx("The distance the bubble moved.", "Die Strecke, die die Blase gewandert ist.") },
      { math: tx(`\\frac{${d}#d "mm"}{${t} "min"} = ${en(decText(rate, 1))}#r "mm/min"`, `\\frac{${d}#d "mm"}{${t} "min"} = ${de(decText(rate, 1))}#r "mm/min"`), note: tx("Distance divided by time. The faster the bubble, the more water the shoot takes up and gives off.", "Strecke geteilt durch Zeit. Je schneller die Blase, desto mehr Wasser nimmt der Spross auf und gibt es wieder ab."), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

const COAT_NAME: Record<Coat, Text> = {
  none: tx("not coated", "nicht bestrichen"),
  top: tx("upper side coated", "Oberseite bestrichen"),
  bottom: tx("underside coated", "Unterseite bestrichen"),
  both: tx("both sides coated", "beide Seiten bestrichen"),
};
const LOSS: Record<Coat, number> = { none: 1, top: 0.88, bottom: 0.2, both: 0.1 };

function vaselineData(rng: Rng, shuffle: boolean) {
  const order: Coat[] = shuffle ? rng.shuffle(["none", "top", "bottom", "both"] as Coat[]) : ["none", "top", "bottom", "both"];
  const base = rng.pick([1.8, 2, 2.2, 2.4, 2.6, 3]);
  const values = order.map((c) => Math.round(base * (LOSS[c] + (rng.int(-2, 2) * 0.01)) * 10) / 10);
  return { order, values };
}

function vaselineTask(rng: Rng, fixed?: "conclude"): Exercise {
  const mode = fixed ?? rng.pick(["conclude", "which"] as const);
  if (mode === "conclude") {
    const { order, values } = vaselineData(rng, false);
    const { answer, mistakes: list } = choice(rng, [
      { text: tx("Most stomata are on the underside of the leaf.", "Die meisten Spaltöffnungen liegen auf der Blattunterseite.") },
      { text: tx("Most stomata are on the upper side of the leaf.", "Die meisten Spaltöffnungen liegen auf der Blattoberseite."), title: tx("Look at leaf C", "Schau auf Blatt C"), say: tx("If the upper side had most stomata, coating it (leaf B) would stop most of the loss. But leaf B loses almost as much as A. Coating the underside (C) is what makes the difference.", "Lägen die meisten Spaltöffnungen oben, würde Bestreichen der Oberseite (Blatt B) den Verlust fast stoppen. Blatt B verliert aber fast so viel wie A. Den Unterschied macht das Bestreichen der Unterseite (C).") },
      { text: tx("Leaves lose the same amount of water on both sides.", "Blätter verlieren auf beiden Seiten gleich viel Wasser."), title: tx("Compare B and C", "Vergleich B und C"), say: tx("Then leaves B and C would lose the same amount. Compare their bars: they are very different.", "Dann müssten Blatt B und C gleich viel verlieren. Vergleich ihre Säulen: Sie sind sehr verschieden.") },
      { text: tx("Vaseline makes leaves heavier.", "Vaseline macht Blätter schwerer."), title: tx("It's about water loss", "Es geht um Wasserverlust"), say: tx("The bars show how much mass each leaf lost, which is the water that evaporated. Vaseline blocks the stomata it covers.", "Die Säulen zeigen, wie viel Masse jedes Blatt verloren hat, also das verdunstete Wasser. Vaseline verschließt die Spaltöffnungen, die sie bedeckt.") },
    ]);
    return {
      instruction: tx("Interpret the experiment", "Werte den Versuch aus"),
      text: tx("Four leaves of the same size were coated with Vaseline in different ways and weighed again after three days. What does the result show?", "Vier gleich große Blätter wurden unterschiedlich mit Vaseline bestrichen und nach drei Tagen wieder gewogen. Was zeigt das Ergebnis?"),
      visual: visual(PlantVaselineChart, { values, coat: order }),
      answer,
      hint: tx("Vaseline seals the side it covers. Which coating reduces the water loss the most?", "Vaseline dichtet die Seite ab, die sie bedeckt. Welches Bestreichen senkt den Wasserverlust am stärksten?"),
      solution: [
        { math: tx(`"B:"#b \\; ${en(decText(values[1], 1))} "g" \\quad "C:"#c \\; ${en(decText(values[2], 1))} "g"`, `"B:"#b \\; ${de(decText(values[1], 1))} "g" \\quad "C:"#c \\; ${de(decText(values[2], 1))} "g"`), note: tx("Coating the upper side (B) hardly changes anything. Coating the underside (C) cuts the loss sharply.", "Bestreichen der Oberseite (B) ändert kaum etwas. Bestreichen der Unterseite (C) senkt den Verlust stark.") },
        { math: tx('"stomata:"#s \\; "mostly underneath"#u', '"Spaltöffnungen:"#s \\; "meist unten"#u'), note: tx("So most water vapour escapes through the underside: that's where most stomata are.", "Der meiste Wasserdampf entweicht also über die Unterseite: Dort liegen die meisten Spaltöffnungen."), highlight: ["u"] },
      ],
      mistakes: list,
    };
  }
  const { order, values } = vaselineData(rng, true);
  const hide = rng.int(0, 3);
  const coat = order.map((c, i) => (i === hide ? null : c));
  const right = order[hide];
  const others = (["none", "top", "bottom", "both"] as Coat[]).filter((c) => c !== right);
  const saysFor = (picked: Coat): Text => {
    if (picked === "top" && right === "bottom") return tx("If only the upper side were coated, the leaf would still lose almost as much as an uncoated one. Its bar is low, so the stomata must be blocked: the underside.", "Wäre nur die Oberseite bestrichen, verlöre das Blatt fast so viel wie ein unbestrichenes. Seine Säule ist niedrig, also sind die Spaltöffnungen verschlossen: die Unterseite.");
    if (picked === "bottom" && right === "top") return tx("A coated underside would block most stomata and the loss would be small. This leaf loses a lot, so its underside is still open.", "Eine bestrichene Unterseite würde die meisten Spaltöffnungen verschließen, der Verlust wäre klein. Dieses Blatt verliert viel, seine Unterseite ist also noch offen.");
    return tx("Compare its bar with the others: which treatment fits a loss this big or this small?", "Vergleich seine Säule mit den anderen: Welche Behandlung passt zu einem so großen oder so kleinen Verlust?");
  };
  const { answer, mistakes: list } = choice(rng, [
    { text: capT(COAT_NAME[right]) },
    ...others.map((o) => ({ text: capT(COAT_NAME[o]), title: tx("Check the bar", "Prüf die Säule"), say: saysFor(o) })),
  ]);
  const L = "ABCD"[hide];
  return {
    instruction: tx("Vaseline experiment", "Vaseline-Versuch"),
    text: tx(`Four leaves were treated with Vaseline in different ways and weighed after three days. How was leaf **${L}** treated?`, `Vier Blätter wurden unterschiedlich mit Vaseline behandelt und nach drei Tagen gewogen. Wie wurde Blatt **${L}** behandelt?`),
    visual: visual(PlantVaselineChart, { values, coat }),
    answer,
    hint: tx("Most stomata are on the underside. Coating it stops most of the water loss.", "Die meisten Spaltöffnungen liegen unten. Wird die Unterseite bestrichen, stoppt der meiste Wasserverlust."),
    solution: [{ math: tx(`"${L}:"#l \\; "${en(COAT_NAME[right])}"#a`, `"${L}:"#l \\; "${de(COAT_NAME[right])}"#a`), note: tx(`Leaf ${L} lost ${en(decText(values[hide], 1))} g. That fits: ${en(COAT_NAME[right])}.`, `Blatt ${L} hat ${de(decText(values[hide], 1))} g verloren. Das passt zu: ${de(COAT_NAME[right])}.`), highlight: ["a"] }],
    mistakes: list,
  };
}

const INK_PLANTS: Text[] = [tx("a celery stalk", "eine Selleriestange"), tx("a white carnation", "eine weiße Nelke"), tx("a white tulip", "eine weiße Tulpe"), tx("a busy Lizzie shoot", "einen Spross vom Fleißigen Lieschen")];

function inkTask(rng: Rng): Exercise {
  const plant = rng.pick(INK_PLANTS);
  const ask = rng.pick(["where", "shows"] as const);
  const opts: Opt[] =
    ask === "where"
      ? [
          { text: tx("The xylem of the vascular bundles", "Das Xylem der Leitbündel") },
          { text: tx("The phloem of the vascular bundles", "Das Phloem der Leitbündel"), title: tx("Phloem comes from the leaves", "Phloem kommt von den Blättern"), say: tx("The phloem carries sugar solution from the leaves. Water from below, and the ink with it, rises in the xylem.", "Das Phloem leitet Zuckerlösung aus den Blättern. Wasser von unten, und mit ihm die Tinte, steigt im Xylem.") },
          { text: tx("The whole cross-section evenly", "Der ganze Querschnitt gleichmäßig"), title: tx("Only in certain tubes", "Nur in bestimmten Röhren"), say: tx("The ink doesn't seep through everything: it rises only in the water tubes. That's why you see red dots, the vascular bundles.", "Die Tinte sickert nicht durch alles: Sie steigt nur in den Wasserleitungen. Deshalb siehst du rote Punkte, die Leitbündel.") },
          { text: tx("Only the epidermis", "Nur die Epidermis"), title: tx("Inside, not outside", "Innen, nicht außen"), say: tx("The epidermis is the skin on the outside. Water rises inside the stem, in the vascular bundles.", "Die Epidermis ist die Haut außen. Wasser steigt im Inneren, in den Leitbündeln.") },
        ]
      : [
          { text: tx("Water rises in the xylem of the vascular bundles.", "Wasser steigt im Xylem der Leitbündel nach oben.") },
          { text: tx("Water rises in the phloem.", "Wasser steigt im Phloem nach oben."), title: tx("Phloem carries sugar", "Phloem leitet Zucker"), say: tx("The phloem carries sugar solution from the leaves. Water rises in the xylem.", "Das Phloem leitet Zuckerlösung aus den Blättern. Wasser steigt im Xylem.") },
          { text: tx("The plant takes up ink as food.", "Die Pflanze nimmt Tinte als Nahrung auf."), title: tx("Ink is just a marker", "Tinte ist nur ein Marker"), say: tx("The ink only makes the way of the water visible. Plants make their food in the leaves.", "Die Tinte macht nur den Weg des Wassers sichtbar. Ihre Nahrung stellen Pflanzen im Blatt her.") },
          { text: tx("Water moves through the whole stem evenly.", "Wasser bewegt sich gleichmäßig durch den ganzen Stängel."), title: tx("Only in certain tubes", "Nur in bestimmten Röhren"), say: tx("Then the whole cross-section would be red. But only certain spots are coloured: the vascular bundles.", "Dann wäre der ganze Querschnitt rot. Gefärbt sind aber nur bestimmte Stellen: die Leitbündel.") },
        ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Ink experiment", "Tintenversuch"),
    text:
      ask === "where"
        ? tx(`You put ${en(plant)} into water with red ink. After a few hours you cut the stem across. Which part is coloured red?`, `Du stellst ${de(plant)} in Wasser mit roter Tinte. Nach einigen Stunden schneidest du den Stängel quer durch. Welcher Teil ist rot gefärbt?`)
        : tx(`You put ${en(plant)} into water with red ink. After a few hours there are red dots in the cut stem and red veins in the leaves. What does this show?`, `Du stellst ${de(plant)} in Wasser mit roter Tinte. Nach einigen Stunden siehst du im Querschnitt rote Punkte und in den Blättern rote Adern. Was zeigt das?`),
    answer,
    hint: tx("Which tubes carry water from the bottom upwards?", "Welche Röhren leiten Wasser von unten nach oben?"),
    solution: [{ math: tx('"ink"#t \\to "xylem"#x \\to "leaf veins"#b', '"Tinte"#t \\to "Xylem"#x \\to "Blattadern"#b'), note: tx("The ink travels with the water in the xylem of the vascular bundles, right into the leaf veins.", "Die Tinte wandert mit dem Wasser im Xylem der Leitbündel nach oben, bis in die Blattadern."), highlight: ["x"] }],
    mistakes: list,
  };
}

const GAS: { text: Text; right: boolean; title?: Text; say?: Text }[] = [
  { text: tx("Carbon dioxide goes in", "Kohlenstoffdioxid hinein"), right: true },
  { text: tx("Oxygen goes out", "Sauerstoff hinaus"), right: true },
  { text: tx("Water vapour goes out", "Wasserdampf hinaus"), right: true },
  { text: tx("Liquid water goes in", "Flüssiges Wasser hinein"), right: false, title: tx("Water comes from the roots", "Wasser kommt von der Wurzel"), say: tx("Stomata don't take in liquid water. The water comes from the roots through the xylem and leaves the stomata as vapour.", "Spaltöffnungen nehmen kein flüssiges Wasser auf. Das Wasser kommt über das Xylem aus der Wurzel und verlässt die Spaltöffnungen als Dampf.") },
  { text: tx("Sugar goes out", "Zucker hinaus"), right: false, title: tx("Sugar stays inside", "Zucker bleibt drin"), say: tx("The sugar is carried away in the phloem. Only gases pass through the stomata.", "Der Zucker wird im Phloem abtransportiert. Durch die Spaltöffnungen gehen nur Gase.") },
  { text: tx("Minerals go in", "Mineralstoffe hinein"), right: false, title: tx("Minerals come from the soil", "Mineralstoffe kommen aus dem Boden"), say: tx("Minerals are taken up by the root hairs and rise in the xylem.", "Mineralstoffe nehmen die Wurzelhaare auf, sie steigen im Xylem nach oben.") },
];

function gasTask(rng: Rng): Exercise {
  const items = rng.shuffle([...GAS.filter((g) => g.right), ...rng.shuffle(GAS.filter((g) => !g.right)).slice(0, rng.int(2, 3))]);
  const options = items.map((g) => g.text);
  const correct = where(items, (g) => g.right);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((g, i) => {
    if (!g.right) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, g.title!, g.say!);
  });
  const vapour = items.findIndex((g) => en(g.text).startsWith("Water vapour"));
  m.add({ kind: "multi", options, correct: correct.filter((i) => i !== vapour) }, tx("Water vapour too", "Wasserdampf auch"), tx("Almost! Water vapour escapes through the open stomata as well: that's transpiration.", "Fast! Durch die offenen Spaltöffnungen entweicht auch Wasserdampf: Das ist die Transpiration."), true);
  return {
    instruction: tx("Through the stomata", "Durch die Spaltöffnungen"),
    text: tx("A leaf is in the light, its stomata are open. What passes through them? Select all that apply.", "Ein Blatt ist im Licht, seine Spaltöffnungen sind offen. Was strömt hindurch? Wähle alle passenden aus."),
    answer,
    hint: tx("Only gases pass through stomata. Which gases does photosynthesis use and make?", "Durch Spaltöffnungen gehen nur Gase. Welche Gase braucht und bildet die Fotosynthese?"),
    solution: [{ math: tx('"in:" \\; \\ce{CO2} \\quad "out:" \\; \\ce{O2} , \\ce{H2O}', '"hinein:" \\; \\ce{CO2} \\quad "hinaus:" \\; \\ce{O2} , \\ce{H2O}'), note: tx("Carbon dioxide for photosynthesis comes in; oxygen and water vapour go out.", "Kohlenstoffdioxid für die Fotosynthese kommt hinein, Sauerstoff und Wasserdampf gehen hinaus.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Statements

const TRUE2: Text[] = [
  tx("The palisade tissue contains the most chloroplasts.", "Das Palisadengewebe enthält die meisten Chloroplasten."),
  tx("The phloem carries sugar solution upwards and downwards.", "Das Phloem leitet Zuckerlösung nach oben und nach unten."),
  tx("Most stomata are on the underside of the leaf.", "Die meisten Spaltöffnungen liegen auf der Blattunterseite."),
  tx("Wind increases transpiration.", "Wind erhöht die Transpiration."),
  tx("The transpiration pull is the main engine of water transport.", "Der Transpirationssog ist der wichtigste Antrieb für den Wassertransport."),
  tx("In a leaf vein the xylem lies above the phloem.", "In der Blattader liegt das Xylem über dem Phloem."),
  tx("Guard cells are the only epidermis cells with chloroplasts.", "Schließzellen sind die einzigen Epidermiszellen mit Chloroplasten."),
  tx("Cohesion keeps the water column in the vessels from breaking.", "Kohäsion verhindert, dass der Wasserfaden in den Gefäßen abreißt."),
];
const MYTHS2: { text: Text; title: Text; say: Text }[] = [
  { text: tx("The xylem carries sugar from the leaves to the root.", "Das Xylem leitet Zucker von den Blättern zur Wurzel."), title: tx("Xylem carries no sugar", "Xylem leitet keinen Zucker"), say: tx("The classic mix-up! Sugar travels in the phloem. The xylem carries water and minerals upwards only.", "Die klassische Verwechslung! Zucker reist im Phloem. Das Xylem leitet nur Wasser und Mineralstoffe nach oben.") },
  { text: tx("Most stomata are on the upper side of the leaf.", "Die meisten Spaltöffnungen liegen auf der Blattoberseite."), title: tx("Underneath, in the shade", "Unten, im Schatten"), say: tx("In most leaves they're on the underside: it's shadier and cooler there, so less water is lost. Only floating leaves like water lilies have them on top.", "Bei den meisten Blättern liegen sie unten: Dort ist es schattiger und kühler, also geht weniger Wasser verloren. Nur Schwimmblätter wie bei der Seerose haben sie oben.") },
  { text: tx("The phloem only transports downwards.", "Das Phloem transportiert nur nach unten."), title: tx("Both ways", "In beide Richtungen"), say: tx("Sugar goes wherever it's needed: down to the roots, but also up to buds, flowers and fruits.", "Zucker geht dorthin, wo er gebraucht wird: nach unten zur Wurzel, aber auch nach oben zu Knospen, Blüten und Früchten.") },
  { text: tx("Capillarity alone lifts water to the top of tall trees.", "Kapillarität allein hebt das Wasser bis in die Baumkrone."), title: tx("Only a short way", "Nur ein kleines Stück"), say: tx("Capillarity lifts water only a few centimetres to decimetres. The main engine is the transpiration pull from above.", "Kapillarität hebt Wasser nur wenige Zentimeter bis Dezimeter. Der Hauptantrieb ist der Transpirationssog von oben.") },
  { text: tx("The epidermis cells are full of chloroplasts.", "Die Epidermiszellen sind voller Chloroplasten."), title: tx("Transparent like a window", "Durchsichtig wie ein Fenster"), say: tx("Epidermis cells have no chloroplasts, so light passes through. Only the guard cells have some.", "Epidermiszellen haben keine Chloroplasten, damit Licht hindurchkommt. Nur die Schließzellen haben welche.") },
  { text: tx("Humid air increases transpiration.", "Feuchte Luft erhöht die Transpiration."), title: tx("Humid air slows it down", "Feuchte Luft bremst"), say: tx("Humid air already holds lots of water vapour, so less water evaporates from the leaf.", "Feuchte Luft enthält schon viel Wasserdampf, also verdunstet weniger Wasser aus dem Blatt.") },
  { text: tx("At night the stomata are wide open.", "Nachts sind die Spaltöffnungen weit geöffnet."), title: tx("Closed at night", "Nachts geschlossen"), say: tx("Without light there's no photosynthesis, so no carbon dioxide is needed: the stomata close and save water.", "Ohne Licht keine Fotosynthese, also wird kein Kohlenstoffdioxid gebraucht: Die Spaltöffnungen schließen sich und sparen Wasser.") },
  { text: tx("Plants take up most of their water through the leaves.", "Pflanzen nehmen ihr Wasser vor allem über die Blätter auf."), title: tx("In through the roots", "Über die Wurzel hinein"), say: tx("Water enters through the root hairs and leaves through the stomata. Leaves give water off.", "Wasser kommt über die Wurzelhaare hinein und geht über die Spaltöffnungen hinaus. Blätter geben Wasser ab.") },
];

function statementTask(rng: Rng): Exercise | null {
  const truth = rng.pick(TRUE2);
  const myths = rng.shuffle(MYTHS2.filter((m) => en(m.text) !== en(truth))).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: truth }, ...myths.map((m) => ({ text: m.text, title: m.title, say: m.say }))]);
  return {
    instruction: tx("Which statement is true?", "Welche Aussage stimmt?"),
    text: tx("Only one of these statements about leaves and transport is right. Which one?", "Nur eine dieser Aussagen über Blatt und Stofftransport ist richtig. Welche?"),
    answer,
    hint: tx("Watch out for the classic mix-ups: xylem and phloem, upper and lower side.", "Achte auf die klassischen Verwechslungen: Xylem und Phloem, Ober- und Unterseite."),
    solution: [{ math: tx('"true:"#t', '"richtig:"#t'), note: truth, highlight: ["t"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  return pickTask(
    rng,
    [
      [3, leafWordTask],
      [2, functionMatchTask],
      [1.5, layerOrderTask],
      [2.5, xpTask],
      [2.5, (r) => factorTask(r)],
      [1.5, pathTask],
      [2, mechTask],
      [1.5, potometerTask],
      [2, (r) => vaselineTask(r)],
      [1.5, inkTask],
      [1.5, gasTask],
      [2, statementTask],
    ],
    leafWordTask,
  );
}

// ---------------------------------------------------------------------------
// Lesson

const layerFrames: Frame[] = [
  { math: tx('"cuticle"#c', '"Cuticula"#c'), note: tx("Right on top lies the **cuticle**, a thin layer of wax. It protects the leaf from drying out.", "Ganz oben liegt die **Cuticula**, eine dünne Wachsschicht. Sie schützt das Blatt vor dem Austrocknen.") },
  { math: tx('"cuticle"#c \\\\ "upper epidermis"#oe', '"Cuticula"#c \\\\ "obere Epidermis"#oe'), note: tx("Below it, the **upper epidermis**: one layer of tightly joined cells without chloroplasts, transparent like a window.", "Darunter die **obere Epidermis**: eine Schicht lückenlos verbundener Zellen ohne Chloroplasten, durchsichtig wie ein Fenster."), highlight: ["oe"] },
  {
    math: tx('"cuticle"#c \\\\ "upper epidermis"#oe \\\\ "palisade tissue"#p', '"Cuticula"#c \\\\ "obere Epidermis"#oe \\\\ "Palisadengewebe"#p'),
    note: tx("Then the **palisade tissue**: long cells, packed tightly like fence posts and full of chloroplasts. Most photosynthesis happens here.", "Dann das **Palisadengewebe**: lange Zellen, dicht wie Zaunpfähle und voller Chloroplasten. Hier läuft die meiste Fotosynthese."),
    highlight: ["p"],
  },
  {
    math: tx('"cuticle"#c \\\\ "upper epidermis"#oe \\\\ "palisade tissue"#p \\\\ "spongy tissue"#s', '"Cuticula"#c \\\\ "obere Epidermis"#oe \\\\ "Palisadengewebe"#p \\\\ "Schwammgewebe"#s'),
    note: tx("The **spongy tissue** has loose cells with large gaps between them, the **air spaces** (Interzellularen). Gases spread out in them.", "Das **Schwammgewebe** hat locker liegende Zellen mit großen Lücken dazwischen, den **Interzellularen**. In ihnen verteilen sich die Gase."),
    highlight: ["s"],
  },
  {
    math: tx('"cuticle"#c \\\\ "upper epidermis"#oe \\\\ "palisade tissue"#p \\\\ "spongy tissue"#s \\\\ "lower epidermis"#ue', '"Cuticula"#c \\\\ "obere Epidermis"#oe \\\\ "Palisadengewebe"#p \\\\ "Schwammgewebe"#s \\\\ "untere Epidermis"#ue'),
    note: tx("At the bottom: the **lower epidermis** with the **stomata**. Leaf veins (vascular bundles) run through the middle.", "Ganz unten die **untere Epidermis** mit den **Spaltöffnungen**. Durch die Mitte ziehen die Blattadern (Leitbündel)."),
    highlight: ["ue"],
  },
];

const stomaFrames: Frame[] = [
  { math: tx('"stoma"#s = "2 guard cells"#z + "pore"#p', '"Spaltöffnung"#s = "2 Schließzellen"#z + "Spalt"#p'), note: tx("A **stoma** is made of two bean-shaped **guard cells** with a **pore** between them. They are the only epidermis cells with chloroplasts.", "Eine **Spaltöffnung** besteht aus zwei bohnenförmigen **Schließzellen**, zwischen denen ein **Spalt** liegt. Sie sind die einzigen Epidermiszellen mit Chloroplasten.") },
  { math: tx('"in:"#i \\; "carbon dioxide"#k', '"hinein:"#i \\; "Kohlenstoffdioxid"#k'), note: tx("Through the pore, **carbon dioxide** enters the leaf. The plant needs it for photosynthesis.", "Durch den Spalt gelangt **Kohlenstoffdioxid** ins Blatt. Die Pflanze braucht es für die Fotosynthese.") },
  {
    math: tx('"in:"#i \\; "carbon dioxide"#k \\\\ "out:"#o \\; "oxygen + water vapour"#w', '"hinein:"#i \\; "Kohlenstoffdioxid"#k \\\\ "hinaus:"#o \\; "Sauerstoff + Wasserdampf"#w'),
    note: tx("**Oxygen** and **water vapour** go out. Giving off water vapour is called **transpiration**.", "Hinaus gehen **Sauerstoff** und **Wasserdampf**. Die Abgabe von Wasserdampf heißt **Transpiration**."),
  },
  {
    math: tx('"stomata:"#s \\; "mostly underneath"#u', '"Spaltöffnungen:"#s \\; "meist unten"#u'),
    note: tx("Most stomata are on the **underside** of the leaf. It's shadier and cooler there, so less water evaporates. (Floating leaves like water lilies have them on top.)", "Die meisten Spaltöffnungen liegen auf der **Blattunterseite**. Dort ist es schattiger und kühler, also verdunstet weniger Wasser. (Schwimmblätter wie bei der Seerose haben sie oben.)"),
    highlight: ["u"],
  },
  {
    math: tx('"open"#a \\Leftrightarrow "closed"#b', '"offen"#a \\Leftrightarrow "geschlossen"#b'),
    note: tx("Guard cells can open and close the pore: usually open in light, closed at night and when water is short. That's how the plant controls its water balance.", "Schließzellen können den Spalt öffnen und schließen: bei Licht meist offen, nachts und bei Wassermangel geschlossen. So regelt die Pflanze ihren Wasserhaushalt."),
  },
];

const bundleFrames: Frame[] = [
  { math: tx('"vascular bundle"#l = "xylem"#x + "phloem"#p', '"Leitbündel"#l = "Xylem"#x + "Phloem"#p'), note: tx("Leaf veins are **vascular bundles**. They form a pipe network from the root through the shoot axis into every leaf.", "Blattadern sind **Leitbündel**. Sie bilden ein Röhrensystem von der Wurzel über die Sprossachse bis in jedes Blatt.") },
  {
    math: tx('"xylem (wood part)"#x \\to "water + minerals"#w', '"Xylem (Holzteil)"#x \\to "Wasser + Mineralstoffe"#w'),
    note: tx("The **xylem** (wood part) is made of dead, lignified tubes (vessels). It carries water and minerals from the root **upwards**.", "Das **Xylem** (Holzteil) besteht aus toten, verholzten Röhren (Gefäßen). Es leitet Wasser und Mineralstoffe von der Wurzel **nach oben**."),
    highlight: ["x"],
  },
  {
    math: tx('"phloem (sieve part)"#p \\to "sugar solution"#z', '"Phloem (Siebteil)"#p \\to "Zuckerlösung"#z'),
    note: tx("The **phloem** (sieve part) is made of living **sieve tubes** with sieve plates and companion cells. It carries sugar solution from the leaves to wherever sugar is used or stored: **up and down**.", "Das **Phloem** (Siebteil) besteht aus lebenden **Siebröhren** mit Siebplatten und Geleitzellen. Es leitet Zuckerlösung von den Blättern dorthin, wo Zucker gebraucht oder gespeichert wird: **nach oben und nach unten**."),
    highlight: ["p"],
  },
  {
    math: tx('"leaf:"#b \\; "xylem on top, phloem below"#o', '"Blatt:"#b \\; "Xylem oben, Phloem unten"#o'),
    note: tx("In a leaf the xylem lies on top (towards the upper side) and the phloem below. In the shoot axis the xylem is on the inside, the phloem on the outside.", "Im Blatt liegt das Xylem oben (zur Blattoberseite), das Phloem unten. In der Sprossachse liegt das Xylem innen, das Phloem außen."),
  },
];

const riseFrames: Frame[] = [
  { math: tx('"transpiration"#t \\to "pull"#s', '"Transpiration"#t \\to "Sog"#s'), note: tx("Water keeps evaporating from the leaves. This creates a pull, the **transpiration pull**: it draws water up the tubes, like sucking on a straw.", "Aus den Blättern verdunstet ständig Wasser. Das erzeugt einen Sog, den **Transpirationssog**: Er zieht Wasser in den Leitbahnen nach, wie beim Trinken mit dem Strohhalm.") },
  {
    math: tx('"transpiration"#t \\to "pull"#s \\\\ "cohesion"#k', '"Transpiration"#t \\to "Sog"#s \\\\ "Kohäsion"#k'),
    note: tx("Water molecules hold together tightly (**cohesion**). So the water column in the thin tubes doesn't break, even in a redwood over 100 m tall.", "Wassermoleküle halten fest zusammen (**Kohäsion**). Deshalb reißt der Wasserfaden in den dünnen Röhren nicht ab, selbst in einem über 100 m hohen Mammutbaum."),
    highlight: ["k"],
  },
  {
    math: tx('"transpiration"#t \\to "pull"#s \\\\ "cohesion"#k \\\\ "adhesion, capillarity"#a', '"Transpiration"#t \\to "Sog"#s \\\\ "Kohäsion"#k \\\\ "Adhäsion, Kapillarität"#a'),
    note: tx("Water also sticks to the vessel walls (**adhesion**). In narrow tubes it rises a little by itself: **capillarity**. But that only gets it a few centimetres to decimetres high.", "Wasser haftet außerdem an den Gefäßwänden (**Adhäsion**). In engen Röhren steigt es dadurch ein Stück von selbst: **Kapillarität**. Das reicht aber nur für wenige Zentimeter bis Dezimeter."),
    highlight: ["a"],
  },
  {
    math: tx('"transpiration"#t \\to "pull"#s \\\\ "cohesion"#k \\\\ "adhesion, capillarity"#a \\\\ "root pressure"#w', '"Transpiration"#t \\to "Sog"#s \\\\ "Kohäsion"#k \\\\ "Adhäsion, Kapillarität"#a \\\\ "Wurzeldruck"#w'),
    note: tx("**Root pressure** helps from below: root cells take up minerals, water follows by osmosis and pushes upwards. In the morning you can see it as droplets at the leaf edges (guttation).", "Von unten hilft der **Wurzeldruck**: Wurzelzellen nehmen Mineralstoffe auf, Wasser strömt durch Osmose nach und drückt nach oben. Morgens siehst du das an Tropfen am Blattrand (Guttation)."),
    highlight: ["w"],
  },
  {
    math: tx('"root"#r \\to "shoot axis"#sa \\to "leaf"#b \\to "air"#l', '"Wurzel"#r \\to "Sprossachse"#sa \\to "Blatt"#b \\to "Luft"#l'),
    note: tx("Together this makes the **transpiration stream**: from the root through the xylem to the stomata and out into the air. Its main engine is the transpiration pull.", "Zusammen ergibt das den **Transpirationsstrom**: von der Wurzel durch das Xylem bis zu den Spaltöffnungen und hinaus in die Luft. Sein Hauptmotor ist der Transpirationssog."),
  },
];

function palisadeCheck(): Exercise {
  const { answer, mistakes: list } = choice(createRng(4), [
    { text: tx("Palisade tissue", "Palisadengewebe") },
    { text: tx("Spongy tissue", "Schwammgewebe"), title: tx("Fewer chloroplasts", "Weniger Chloroplasten"), say: tx("It has chloroplasts too, but far fewer. The tightly packed cells right under the upper epidermis get the most light.", "Dort gibt es auch Chloroplasten, aber viel weniger. Die dicht gepackten Zellen direkt unter der oberen Epidermis bekommen das meiste Licht.") },
    { text: tx("Upper epidermis", "Obere Epidermis"), title: tx("No chloroplasts", "Keine Chloroplasten"), say: tx("The epidermis has no chloroplasts: it's transparent like a window and lets the light through.", "Die Epidermis hat keine Chloroplasten: Sie ist durchsichtig wie ein Fenster und lässt das Licht durch.") },
    { text: tx("Vascular bundle", "Leitbündel"), title: tx("Bundles transport", "Leitbündel transportieren"), say: tx("Vascular bundles only transport. Photosynthesis needs chloroplasts.", "Leitbündel transportieren nur. Fotosynthese braucht Chloroplasten.") },
  ]);
  return {
    instruction: tx("Inside the leaf", "Im Blatt"),
    text: tx("In which tissue of the leaf does most photosynthesis take place?", "In welchem Gewebe des Blattes findet die meiste Fotosynthese statt?"),
    visual: visual(PlantLeafSection, { mode: "plain" }),
    answer,
    hint: tx("Look for the cells with the most green chloroplasts, close to the light.", "Such die Zellen mit den meisten grünen Chloroplasten, nah am Licht."),
    solution: [{ math: tx('"palisade tissue"#p', '"Palisadengewebe"#p'), note: tx("The palisade cells lie right under the upper epidermis, get the most light and are packed with chloroplasts.", "Die Palisadenzellen liegen direkt unter der oberen Epidermis, bekommen das meiste Licht und sind voller Chloroplasten."), highlight: ["p"] }],
    mistakes: list,
  };
}

function undersideCheck(): Exercise {
  const { answer, mistakes: list } = choice(createRng(12), [
    { text: tx("It's shadier and cooler there, so less water evaporates.", "Dort ist es schattiger und kühler, also verdunstet weniger Wasser.") },
    { text: tx("More light reaches them there for photosynthesis.", "Dort bekommen sie mehr Licht für die Fotosynthese."), title: tx("The underside is shady", "Die Unterseite liegt im Schatten"), say: tx("The underside gets less light, not more. And stomata let gases through, they don't catch light.", "Die Unterseite bekommt weniger Licht, nicht mehr. Und Spaltöffnungen lassen Gase durch, sie fangen kein Licht ein.") },
    { text: tx("So that rainwater can run into them.", "Damit Regenwasser hineinlaufen kann."), title: tx("No liquid water", "Kein flüssiges Wasser"), say: tx("Stomata don't take in liquid water. Plants take up water through their roots.", "Spaltöffnungen nehmen kein flüssiges Wasser auf. Wasser nehmen Pflanzen über die Wurzel auf.") },
    { text: tx("Because carbon dioxide only comes from below.", "Weil Kohlenstoffdioxid nur von unten kommt."), title: tx("It's everywhere in the air", "Es ist überall in der Luft"), say: tx("Carbon dioxide is mixed into the air all around the leaf. The reason is about water loss.", "Kohlenstoffdioxid ist überall in der Luft um das Blatt herum. Der Grund hat mit dem Wasserverlust zu tun.") },
  ]);
  return {
    instruction: tx("Stomata", "Spaltöffnungen"),
    text: tx("Why are most stomata on the underside of a leaf?", "Warum liegen die meisten Spaltöffnungen auf der Blattunterseite?"),
    answer,
    hint: tx("Through open stomata, water vapour escapes. Where would it escape least?", "Durch offene Spaltöffnungen entweicht Wasserdampf. Wo entweicht am wenigsten?"),
    solution: [{ math: tx('"underside:"#u \\; "shady, cool"#s', '"Unterseite:"#u \\; "schattig, kühl"#s'), note: tx("In the shade underneath, the leaf loses less water through its open stomata.", "Im Schatten der Unterseite verliert das Blatt durch die offenen Spaltöffnungen weniger Wasser."), highlight: ["s"] }],
    mistakes: list,
  };
}

function potatoCheck(): Exercise {
  const { answer, mistakes: list } = choice(createRng(7), [
    { text: tx("Downwards in the phloem", "Im Phloem nach unten") },
    { text: tx("Downwards in the xylem", "Im Xylem nach unten"), title: tx("Xylem carries no sugar", "Xylem leitet keinen Zucker"), say: tx("The classic mix-up! The xylem only carries water and minerals, and only upwards. Sugar travels in the phloem.", "Die klassische Verwechslung! Das Xylem leitet nur Wasser und Mineralstoffe, und das nur nach oben. Zucker reist im Phloem.") },
    { text: tx("Upwards in the xylem", "Im Xylem nach oben"), title: tx("Wrong pipe, wrong way", "Falsches Rohr, falsche Richtung"), say: tx("The leaves are above the tuber, so the sugar has to go down. And sugar travels in the phloem, not the xylem.", "Die Blätter liegen über der Knolle, der Zucker muss also nach unten. Und Zucker reist im Phloem, nicht im Xylem.") },
    { text: tx("Through the root hairs from the soil", "Über die Wurzelhaare aus dem Boden"), title: tx("Plants don't eat soil", "Pflanzen essen keine Erde"), say: tx("There is no sugar in the soil for the plant. The leaves make it by photosynthesis.", "Im Boden gibt es keinen Zucker für die Pflanze. Den stellen die Blätter durch Fotosynthese her.") },
  ]);
  return {
    instruction: tx("Xylem or phloem?", "Xylem oder Phloem?"),
    text: tx("A potato tuber stores starch, which it makes from sugar. How does the sugar get from the leaves into the tuber underground?", "Eine Kartoffelknolle speichert Stärke, die sie aus Zucker herstellt. Wie kommt der Zucker aus den Blättern in die Knolle unter der Erde?"),
    answer,
    hint: tx("Which tube carries sugar solution, and in which direction is the tuber?", "Welches Rohr leitet Zuckerlösung, und in welcher Richtung liegt die Knolle?"),
    solution: [{ math: tx('"leaf"#b \\to "phloem"#p \\to "tuber"#k', '"Blatt"#b \\to "Phloem"#p \\to "Knolle"#k'), note: tx("The phloem carries sugar solution from the leaves wherever it's needed, here down into the tuber.", "Das Phloem leitet Zuckerlösung von den Blättern dorthin, wo sie gebraucht wird, hier nach unten in die Knolle."), highlight: ["p"] }],
    mistakes: list,
  };
}

const checkPalisade = palisadeCheck();
const checkUnderside = undersideCheck();
const checkPotato = potatoCheck();
const checkVaseline = vaselineTask(createRng(31), "conclude");

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("A leaf in cross-section", "Ein Blatt im Querschnitt"),
      blob: tx("A leaf is thinner than a sheet of paper, but look how much is inside!", "Ein Blatt ist dünner als Papier, aber schau, wie viel drinsteckt!"),
      body: tx("Under the microscope, a thin slice through a leaf shows several layers, each with its own job.", "Unter dem Mikroskop zeigt ein dünner Schnitt durch ein Blatt mehrere Schichten, jede mit ihrer eigenen Aufgabe."),
      frames: layerFrames,
    },
    {
      type: "widget",
      title: tx("Explore the leaf section", "Erkunde den Blattquerschnitt"),
      blob: tx("Tap the numbers, then switch on the arrows!", "Tipp auf die Nummern und schalte dann die Pfeile ein!"),
      body: tx("Tap a number or a name to see what each structure does. The switches show the gas exchange and the way of the water.", "Tipp auf eine Nummer oder einen Namen, dann siehst du, was jede Struktur leistet. Die Schalter zeigen den Gasaustausch und den Weg des Wassers."),
      widget: PlantLeafExplorer,
    },
    { type: "check", blob: tx("Where is the leaf's food factory?", "Wo ist die Nahrungsfabrik des Blattes?"), exercise: checkPalisade },
    {
      type: "explain",
      title: tx("Stomata: the leaf's doors", "Spaltöffnungen: die Türen des Blattes"),
      blob: tx("Tiny doors, huge effect!", "Winzige Türen, riesige Wirkung!"),
      frames: stomaFrames,
    },
    { type: "check", blob: tx("A classic exam question!", "Eine klassische Testfrage!"), exercise: checkUnderside },
    {
      type: "explain",
      title: tx("Vascular bundles: xylem and phloem", "Leitbündel: Xylem und Phloem"),
      blob: tx("Two pipe systems, two very different loads.", "Zwei Rohrsysteme, zwei ganz verschiedene Ladungen."),
      frames: bundleFrames,
    },
    {
      type: "widget",
      title: tx("Inside a vascular bundle", "Ein Leitbündel von innen"),
      blob: tx("Blue goes up, orange goes both ways. Spot the difference!", "Blau geht nach oben, Orange in beide Richtungen. Erkennst du den Unterschied?"),
      body: tx("Left: the bundle in cross-section. Right: cut lengthwise. Tap the numbers to explore.", "Links: das Leitbündel im Querschnitt. Rechts: der Länge nach aufgeschnitten. Tipp auf die Nummern."),
      widget: () => <PlantVascularBundle mode="explore" flow />,
    },
    { type: "check", blob: tx("Sugar on its way to the potato. Which pipe?", "Zucker auf dem Weg zur Kartoffel. Welches Rohr?"), exercise: checkPotato },
    {
      type: "explain",
      title: tx("How does water get to the top?", "Wie kommt das Wasser nach oben?"),
      blob: tx("Trees lift water 100 metres high without a pump. How?", "Bäume heben Wasser 100 Meter hoch, ohne Pumpe. Wie geht das?"),
      frames: riseFrames,
    },
    {
      type: "widget",
      title: tx("The transpiration stream", "Der Transpirationsstrom"),
      blob: tx("Make it sunny, windy or humid and watch the water!", "Mach es sonnig, windig oder feucht und beobachte das Wasser!"),
      body: tx("Change light, temperature, wind, humidity and soil water. Watch how fast the water flows and what the stomata do.", "Verändere Licht, Temperatur, Wind, Luftfeuchtigkeit und Bodenwasser. Beobachte, wie schnell das Wasser fließt und was die Spaltöffnungen tun."),
      widget: PlantTranspiration,
    },
    { type: "check", blob: tx("A real experiment with Vaseline. What does it show?", "Ein echter Versuch mit Vaseline. Was zeigt er?"), exercise: checkVaseline },
  ],
  summary: [
    {
      title: tx("The leaf from top to bottom", "Das Blatt von oben nach unten"),
      body: tx(
        "Cuticle (wax), upper epidermis (no chloroplasts), palisade tissue (most photosynthesis), spongy tissue with air spaces (gas exchange), lower epidermis with stomata. Vascular bundles run through the middle.",
        "Cuticula (Wachs), obere Epidermis (ohne Chloroplasten), Palisadengewebe (meiste Fotosynthese), Schwammgewebe mit Interzellularen (Gasaustausch), untere Epidermis mit Spaltöffnungen. Dazwischen liegen die Leitbündel.",
      ),
      examples: [tx('"cuticle" \\to "epidermis" \\to "palisades" \\\\ \\to "spongy tissue" \\to "epidermis"', '"Cuticula" \\to "Epidermis" \\to "Palisaden" \\\\ \\to "Schwammgewebe" \\to "Epidermis"')],
      tone: "rule",
    },
    {
      title: tx("Stomata", "Spaltöffnungen"),
      body: tx(
        "Two guard cells (with chloroplasts) around a pore, mostly on the underside. In: carbon dioxide. Out: oxygen and water vapour. Open in light, closed at night and when water is short.",
        "Zwei Schließzellen (mit Chloroplasten) um einen Spalt, meist auf der Blattunterseite. Hinein: Kohlenstoffdioxid. Hinaus: Sauerstoff und Wasserdampf. Bei Licht offen, nachts und bei Wassermangel geschlossen.",
      ),
      tone: "rule",
    },
    {
      title: tx("Xylem and phloem", "Xylem und Phloem"),
      body: tx("Xylem (wood part): dead, lignified vessels, water and minerals, only upwards. Phloem (sieve part): living sieve tubes with companion cells, sugar solution, up and down.", "Xylem (Holzteil): tote, verholzte Gefäße, Wasser und Mineralstoffe, nur nach oben. Phloem (Siebteil): lebende Siebröhren mit Geleitzellen, Zuckerlösung, nach oben und unten."),
      examples: [tx('"leaf vein:" \\; "xylem on top, phloem below"', '"Blattader:" \\; "Xylem oben, Phloem unten"')],
      tone: "rule",
    },
    {
      title: tx("Why water rises", "Warum Wasser aufsteigt"),
      body: tx(
        "Transpiration pull (main engine, from above), cohesion (the water column holds together), adhesion and capillarity (a short way), root pressure (from below, guttation).",
        "Transpirationssog (Hauptmotor, von oben), Kohäsion (der Wasserfaden hält zusammen), Adhäsion und Kapillarität (nur ein kleines Stück), Wurzeldruck (von unten, Guttation).",
      ),
      examples: [tx('"root" \\to "xylem" \\to "leaf" \\to "air"', '"Wurzel" \\to "Xylem" \\to "Blatt" \\to "Luft"')],
      tone: "rule",
    },
    {
      title: tx("What changes transpiration", "Was die Transpiration verändert"),
      body: tx("Goes up with light, warmth, wind and dry air. Goes down in the dark, in the cold, in humid air and when water is short (the stomata close).", "Steigt mit Licht, Wärme, Wind und trockener Luft. Sinkt bei Dunkelheit, Kälte, feuchter Luft und Wassermangel (die Spaltöffnungen schließen)."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("The xylem carries no sugar: sugar travels in the phloem. Most stomata are on the underside, not on top. Capillarity alone can't lift water to the top of a tree.", "Das Xylem leitet keinen Zucker: Zucker reist im Phloem. Die meisten Spaltöffnungen liegen unten, nicht oben. Kapillarität allein hebt kein Wasser bis in die Baumkrone."),
      tone: "warning",
    },
  ],
};
