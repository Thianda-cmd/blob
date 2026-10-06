"use client";

// Level 3 (Oberstufe): plant tissues (meristems and permanent tissues), secondary growth with
// annual rings, the stomatal mechanism (proton pump, K⁺, osmosis, turgor, abscisic acid),
// adaptations of xerophytes, hygrophytes and hydrophytes, monocots versus dicots.

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { PlantAdaptLeaf, PlantHabitats, type LeafKind } from "@/learn/biology/visuals/PlantHabitats";
import { PlantRings } from "@/learn/biology/visuals/PlantRings";
import { PlantStemPrimary, PlantStemSection } from "@/learn/biology/visuals/PlantStem";
import { PlantStomaLab } from "@/learn/biology/visuals/PlantStomaLab";
import { PlantTissues, type TissueId } from "@/learn/biology/visuals/PlantTissues";
import { capT, choice, de, en, join, mistakes, pickTask, q, visual, where, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Tissues

type T = TissueId | "cambium" | "xylem" | "phloem";
const TNAME: Record<T, Text> = {
  meristem: tx("Meristem (dividing tissue)", "Bildungsgewebe (Meristem)"),
  parenchyma: tx("Parenchyma", "Parenchym"),
  collenchyma: tx("Collenchyma", "Kollenchym"),
  sclerenchyma: tx("Sclerenchyma", "Sklerenchym"),
  epidermis: tx("Epidermis (dermal tissue)", "Epidermis (Abschlussgewebe)"),
  vascular: tx("Vascular tissue", "Leitgewebe"),
  cambium: tx("Cambium", "Kambium"),
  xylem: tx("Xylem", "Xylem"),
  phloem: tx("Phloem", "Phloem"),
};

const TDESC: { t: T; d: Text; near: T[] }[] = [
  { t: "meristem", d: tx("Small, thin-walled cells full of cytoplasm, with a large nucleus and no central vacuole. They divide again and again.", "Kleine, dünnwandige, plasmareiche Zellen mit großem Zellkern und ohne Zentralvakuole. Sie teilen sich immer wieder."), near: ["parenchyma", "cambium", "collenchyma"] },
  { t: "meristem", d: tx("The tissue at the tip of the shoot and the root that makes them grow longer.", "Das Gewebe an Spross- und Wurzelspitze, das für das Längenwachstum sorgt."), near: ["cambium", "parenchyma", "epidermis"] },
  { t: "parenchyma", d: tx("Living, thin-walled cells with a large vacuole and air spaces between them; they store starch in a potato.", "Lebende, dünnwandige Zellen mit großer Vakuole und Zellzwischenräumen; in der Kartoffel speichern sie Stärke."), near: ["collenchyma", "meristem", "sclerenchyma"] },
  { t: "parenchyma", d: tx("The ground tissue that makes up the pith, and as palisade and spongy tissue does photosynthesis.", "Das Grundgewebe, das das Mark bildet und als Palisaden- und Schwammgewebe Fotosynthese betreibt."), near: ["collenchyma", "epidermis", "meristem"] },
  { t: "collenchyma", d: tx("Living cells with cellulose walls thickened at the corners. It supports young, still growing leaf stalks.", "Lebende Zellen mit an den Kanten verdickten Cellulosewänden. Es festigt junge, noch wachsende Blattstiele."), near: ["sclerenchyma", "parenchyma", "meristem"] },
  { t: "collenchyma", d: tx("Firm but stretchy supporting tissue of growing organs, for example the strings in a celery stalk.", "Festes, aber dehnbares Festigungsgewebe wachsender Organe, zum Beispiel die Fäden in der Selleriestange."), near: ["sclerenchyma", "xylem", "parenchyma"] },
  { t: "sclerenchyma", d: tx("Mostly dead cells with very thick, lignified walls. They make up flax fibres and the stone cells in a pear.", "Meist tote Zellen mit sehr dicken, verholzten Wänden. Sie bilden Flachsfasern und die Steinzellen in der Birne."), near: ["collenchyma", "xylem", "parenchyma"] },
  { t: "sclerenchyma", d: tx("Rigid supporting tissue of fully grown organs; nutshells and cherry stones are made of it.", "Starres Festigungsgewebe ausgewachsener Organe; Nussschalen und Kirschkerne bestehen daraus."), near: ["collenchyma", "epidermis", "xylem"] },
  { t: "epidermis", d: tx("A single, gapless layer of cells with a cuticle, stomata and hairs, covering leaves and young stems.", "Eine einzige, lückenlose Zellschicht mit Cuticula, Spaltöffnungen und Haaren, die Blätter und junge Sprossachsen bedeckt."), near: ["parenchyma", "sclerenchyma", "collenchyma"] },
  { t: "cambium", d: tx("A dividing layer between xylem and phloem that makes the stem grow thicker.", "Eine teilungsfähige Schicht zwischen Xylem und Phloem, die die Sprossachse dicker werden lässt."), near: ["meristem", "phloem", "parenchyma"] },
  { t: "xylem", d: tx("Dead, lignified vessels and tracheids that carry water and minerals upwards.", "Tote, verholzte Gefäße und Tracheiden, die Wasser und Mineralstoffe nach oben leiten."), near: ["phloem", "sclerenchyma", "collenchyma"] },
  { t: "phloem", d: tx("Living sieve tubes without a nucleus, with sieve plates and companion cells; they carry sugar solution.", "Lebende, kernlose Siebröhren mit Siebplatten und Geleitzellen; sie leiten Zuckerlösung."), near: ["xylem", "collenchyma", "cambium"] },
];

function tissueSay(right: T, picked: T): Text {
  const key = `${right}>${picked}`;
  const special: Record<string, Text> = {
    "collenchyma>sclerenchyma": tx("Sclerenchyma cells are mostly dead, lignified and rigid. Living cells with corner thickenings that can still stretch: that's the other supporting tissue.", "Sklerenchymzellen sind meist tot, verholzt und starr. Lebende Zellen mit Eckenverdickungen, die sich noch dehnen können: Das ist das andere Festigungsgewebe."),
    "sclerenchyma>collenchyma": tx("Collenchyma is alive, with walls thickened only at the corners. Thick lignified walls all round and dead cells: that's the other supporting tissue.", "Kollenchym ist lebend und nur an den Kanten verdickt. Rundum dicke, verholzte Wände und tote Zellen: Das ist das andere Festigungsgewebe."),
    "xylem>phloem": tx("The classic mix-up! The phloem consists of living sieve tubes for sugar. Dead, lignified tubes for water: the xylem.", "Die klassische Verwechslung! Das Phloem besteht aus lebenden Siebröhren für Zucker. Tote, verholzte Röhren für Wasser: das Xylem."),
    "phloem>xylem": tx("The xylem is made of dead, lignified tubes for water. Living sieve tubes with companion cells: the phloem.", "Das Xylem besteht aus toten, verholzten Röhren für Wasser. Lebende Siebröhren mit Geleitzellen: das Phloem."),
    "meristem>cambium": tx("The cambium is a meristem too, but it sits between xylem and phloem and makes things thicker. Look for the general term.", "Das Kambium ist zwar auch ein Bildungsgewebe, aber es liegt zwischen Xylem und Phloem und sorgt für Dickenwachstum. Gesucht ist der Oberbegriff."),
    "cambium>meristem": tx("Right family! But there is a more precise name for the dividing layer between xylem and phloem.", "Richtige Familie! Für die teilungsfähige Schicht zwischen Xylem und Phloem gibt es aber einen genaueren Namen."),
  };
  if (special[key]) return special[key];
  const what: Record<T, Text> = {
    meristem: tx("A meristem keeps dividing: small cells, big nucleus, no large vacuole.", "Ein Bildungsgewebe teilt sich ständig: kleine Zellen, großer Kern, keine große Vakuole."),
    parenchyma: tx("Parenchyma is thin-walled ground tissue with a large vacuole.", "Parenchym ist dünnwandiges Grundgewebe mit großer Vakuole."),
    collenchyma: tx("Collenchyma is living supporting tissue with corner thickenings.", "Kollenchym ist lebendes Festigungsgewebe mit Eckenverdickungen."),
    sclerenchyma: tx("Sclerenchyma is dead, lignified supporting tissue.", "Sklerenchym ist totes, verholztes Festigungsgewebe."),
    epidermis: tx("The epidermis is the single outer layer with a cuticle.", "Die Epidermis ist die einschichtige Außenschicht mit Cuticula."),
    vascular: tx("Vascular tissue transports water and sugar.", "Leitgewebe transportiert Wasser und Zucker."),
    cambium: tx("The cambium is the dividing layer for secondary growth.", "Das Kambium ist die Teilungsschicht für das Dickenwachstum."),
    xylem: tx("Xylem is made of dead vessels for water.", "Xylem besteht aus toten Gefäßen für Wasser."),
    phloem: tx("Phloem is made of living sieve tubes for sugar.", "Phloem besteht aus lebenden Siebröhren für Zucker."),
  };
  return tx(`${en(what[picked])} Does that match the description?`, `${de(what[picked])} Passt das zur Beschreibung?`);
}

function tissueDescTask(rng: Rng, fixed?: number): Exercise {
  const d = TDESC[fixed ?? rng.int(0, TDESC.length - 1)];
  const { answer, mistakes: list } = choice(rng, [{ text: TNAME[d.t] }, ...d.near.map((n) => ({ text: TNAME[n], title: tx("Another tissue", "Ein anderes Gewebe"), say: tissueSay(d.t, n) }))]);
  return {
    instruction: tx("Which tissue is it?", "Welches Gewebe ist gemeint?"),
    text: d.d,
    answer,
    hint: tx("Living or dead? Thin or thick walls? Dividing or specialised?", "Lebend oder tot? Dünne oder dicke Wände? Teilungsfähig oder spezialisiert?"),
    solution: [{ math: q(TNAME[d.t], "a"), note: d.d, highlight: ["a"] }],
    mistakes: list,
  };
}

const TWORDS: Record<TissueId, { accept: Text[]; wrong: { accept: Text[]; say: Text }[] }> = {
  meristem: { accept: [tx("meristem", "Bildungsgewebe"), "Meristem", "dividing tissue", "Teilungsgewebe"], wrong: [{ accept: [tx("parenchyma", "Parenchym"), "Grundgewebe"], say: tx("Parenchyma cells have a large vacuole. These cells are small, full of cytoplasm, with a big nucleus, and one is dividing.", "Parenchymzellen haben eine große Vakuole. Diese Zellen sind klein, plasmareich, mit großem Kern, und eine teilt sich gerade.") }] },
  parenchyma: { accept: [tx("parenchyma", "Parenchym"), "Grundgewebe", "ground tissue"], wrong: [{ accept: [tx("collenchyma", "Kollenchym")], say: tx("Collenchyma walls are thick at the corners. Here the walls are thin all round, and the cells have big vacuoles.", "Kollenchymwände sind an den Ecken dick. Hier sind die Wände überall dünn, und die Zellen haben große Vakuolen.") }] },
  collenchyma: { accept: [tx("collenchyma", "Kollenchym"), "Festigungsgewebe"], wrong: [{ accept: [tx("sclerenchyma", "Sklerenchym")], say: tx("Look at the walls: thick only at the corners, and the cells still have a nucleus. That's living supporting tissue.", "Schau auf die Wände: nur an den Ecken dick, und die Zellen haben noch einen Kern. Das ist lebendes Festigungsgewebe.") }] },
  sclerenchyma: { accept: [tx("sclerenchyma", "Sklerenchym"), "Steinzellen", "stone cells", "Sklerenchymfasern"], wrong: [{ accept: [tx("collenchyma", "Kollenchym")], say: tx("Here the walls are thick all round and the cells are empty (dead). Corner thickenings belong to the other supporting tissue.", "Hier sind die Wände rundum dick und die Zellen leer (tot). Eckenverdickungen gehören zum anderen Festigungsgewebe.") }] },
  epidermis: { accept: [tx("epidermis", "Epidermis"), "Abschlussgewebe", "dermal tissue"], wrong: [{ accept: [tx("cuticle", "Cuticula")], say: tx("The cuticle is only the wax layer on top. The tissue is the row of cells that makes it.", "Die Cuticula ist nur die Wachsschicht darauf. Das Gewebe ist die Zellreihe, die sie bildet.") }] },
  vascular: { accept: [tx("vascular tissue", "Leitgewebe"), "Leitbündel", "Xylem und Phloem", "xylem and phloem"], wrong: [{ accept: ["Xylem"], say: tx("That's only the left part (the vessel). The picture also shows a sieve tube with a companion cell. What is the whole tissue called?", "Das ist nur der linke Teil (das Gefäß). Das Bild zeigt auch eine Siebröhre mit Geleitzelle. Wie heißt das ganze Gewebe?") }] },
};

function tissuePicTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(TWORDS) as TissueId[]);
  const W = TWORDS[id];
  const answer: AnswerSpec = { kind: "word", accept: W.accept, placeholder: tx("tissue", "Gewebe") };
  const m = mistakes(answer);
  for (const w of W.wrong) m.add({ kind: "word", accept: w.accept }, tx("Look closely", "Schau genau hin"), w.say);
  return {
    instruction: tx("Name the tissue", "Benenne das Gewebe"),
    text: tx("The picture shows a plant tissue under the microscope. What is it called?", "Das Bild zeigt ein Pflanzengewebe unter dem Mikroskop. Wie heißt es?"),
    visual: visual(PlantTissues, { mode: "plain", only: id }),
    answer,
    hint: tx("Look at the walls (thin, thick at the corners, thick all round) and at what is inside the cells.", "Achte auf die Wände (dünn, an den Ecken dick, rundum dick) und darauf, was in den Zellen ist."),
    solution: [{ math: q(TNAME[id], "a"), note: tx(`${en(TNAME[id])}.`, `${de(TNAME[id])}.`), highlight: ["a"] }],
    mistakes: m.list,
  };
}

const MERI: { text: Text; right: boolean; say?: Text }[] = [
  { text: tx("Shoot tip", "Sprossspitze"), right: true },
  { text: tx("Root tip, behind the root cap", "Wurzelspitze, hinter der Wurzelhaube"), right: true },
  { text: tx("Cambium between xylem and phloem", "Kambium zwischen Xylem und Phloem"), right: true },
  { text: tx("Cork cambium under the bark", "Korkkambium unter der Borke"), right: true },
  { text: tx("Root hair zone", "Wurzelhaarzone"), right: false, say: tx("Root hairs grow out of cells that have already stopped dividing. The dividing zone lies further down, right behind the root cap.", "Wurzelhaare wachsen aus Zellen, die sich nicht mehr teilen. Die Teilungszone liegt weiter unten, direkt hinter der Wurzelhaube.") },
  { text: tx("Fully grown leaf blade", "Ausgewachsene Blattspreite"), right: false, say: tx("A fully grown leaf consists of permanent tissues; its cells no longer divide.", "Ein ausgewachsenes Blatt besteht aus Dauergeweben; seine Zellen teilen sich nicht mehr.") },
  { text: tx("Heartwood in the middle of the trunk", "Kernholz in der Stammmitte"), right: false, say: tx("Heartwood is dead tissue. New wood only forms at the cambium, at the outer edge of the wood.", "Kernholz ist totes Gewebe. Neues Holz entsteht nur am Kambium, am Außenrand des Holzes.") },
  { text: tx("Sieve tubes of the phloem", "Siebröhren des Phloems"), right: false, say: tx("Sieve tubes are specialised, have no nucleus and can't divide.", "Siebröhren sind spezialisiert, haben keinen Zellkern und können sich nicht teilen.") },
];

function meristemTask(rng: Rng): Exercise {
  const items = rng.shuffle([...rng.shuffle(MERI.filter((m) => m.right)).slice(0, rng.int(2, 4)), ...rng.shuffle(MERI.filter((m) => !m.right)).slice(0, 2)]);
  const options = items.map((m) => m.text);
  const correct = where(items, (m) => m.right);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const mk = mistakes(answer);
  items.forEach((it, i) => {
    if (!it.right && it.say) mk.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("No dividing cells there", "Dort teilt sich nichts"), it.say);
  });
  const cam = items.findIndex((m) => en(m.text).startsWith("Cambium"));
  if (cam >= 0) mk.add({ kind: "multi", options, correct: correct.filter((i) => i !== cam) }, tx("The cambium divides too", "Auch das Kambium teilt sich"), tx("Almost! The cambium is a lateral meristem: it keeps dividing and makes the stem grow thicker.", "Fast! Das Kambium ist ein seitliches Bildungsgewebe: Es teilt sich ständig und lässt den Spross in die Dicke wachsen."), true);
  return {
    instruction: tx("Where are meristems?", "Wo liegen Bildungsgewebe?"),
    text: tx("Where in a tree are there meristems (dividing tissues)? Select all that apply.", "Wo gibt es in einem Baum Bildungsgewebe (Meristeme)? Wähle alle passenden aus."),
    answer,
    hint: tx("Growth in length happens at the tips, growth in thickness in rings.", "Längenwachstum passiert an den Spitzen, Dickenwachstum in Ringen."),
    solution: [{ math: tx('"tips" \\; + \\; "cambium" \\; + \\; "cork cambium"', '"Spitzen" \\; + \\; "Kambium" \\; + \\; "Korkkambium"'), note: tx("Apical meristems at shoot and root tips (growth in length), the cambium and the cork cambium (growth in thickness).", "Apikalmeristeme an Spross- und Wurzelspitze (Längenwachstum), Kambium und Korkkambium (Dickenwachstum).") }],
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Secondary growth and annual rings

function randomWidths(rng: Rng, n: number) {
  return Array.from({ length: n }, (_, i) => Math.round((rng.int(80, 115) / 100) * (1.12 - 0.04 * i) * 100) / 100);
}

function ringCountTask(rng: Rng, fixed?: number[]): Exercise {
  const widths = fixed ?? randomWidths(rng, rng.int(4, 9));
  const n = widths.length;
  const answer: AnswerSpec = { kind: "number", value: n, unit: tx("years", "Jahre") };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 2 * n }, tx("Light and dark are one ring", "Hell und dunkel sind ein Ring"), tx("You counted the light and the dark bands separately. One annual ring is light early wood plus dark late wood together.", "Du hast helle und dunkle Bänder einzeln gezählt. Ein Jahresring besteht aus hellem Frühholz und dunklem Spätholz zusammen."));
  m.add({ kind: "number", value: n + 1 }, tx("Bark and pith don't count", "Borke und Mark zählen nicht"), tx("Nearly! Count only the rings in the wood: the bark and the pith in the middle aren't annual rings.", "Fast! Zähl nur die Ringe im Holz: Die Borke und das Mark in der Mitte sind keine Jahresringe."), true);
  return {
    instruction: tx("Count the annual rings", "Zähl die Jahresringe"),
    text: tx("A branch was cut off near its base. How old was it?", "Ein Ast wurde nah an seiner Basis abgesägt. Wie alt war er?"),
    visual: visual(PlantStemSection, { widths, mode: "plain" }),
    answer,
    hint: tx("Each year adds one ring: a light band of early wood and a dark band of late wood.", "Jedes Jahr kommt ein Ring dazu: ein helles Band Frühholz und ein dunkles Band Spätholz."),
    solution: [
      { math: tx('"1 annual ring" = "early wood" + "late wood"', '"1 Jahresring" = "Frühholz" + "Spätholz"'), note: tx("Count the dark late-wood bands: each marks the end of one year.", "Zähl die dunklen Spätholzbänder: Jedes markiert das Ende eines Jahres.") },
      { math: tx(`${n}#n "rings" \\Rightarrow ${n}#a "years"`, `${n}#n "Ringe" \\Rightarrow ${n}#a "Jahre"`), note: tx(`${n} annual rings: the branch was ${n} years old.`, `${n} Jahresringe: Der Ast war ${n} Jahre alt.`), highlight: ["a"] },
    ],
    mistakes: m.list,
  };
}

function dryYearTask(rng: Rng): Exercise | null {
  const n = rng.int(5, 7);
  const widths = randomWidths(rng, n);
  const dry = rng.int(1, n - 1);
  widths[dry] = Math.round(widths[dry] * 0.38 * 100) / 100;
  const first = rng.int(2012, 2018);
  const year = first + dry;
  const widest = widths.indexOf(Math.max(...widths));
  const answer: AnswerSpec = { kind: "number", value: year };
  const m = mistakes(answer);
  m.add({ kind: "number", value: first + widest }, tx("Wide means good growth", "Breit heißt gutes Wachstum"), tx("A wide ring means lots of growth: plenty of water and warmth. In a dry year the cambium makes little wood, so the ring is narrow.", "Ein breiter Ring bedeutet viel Wachstum: genug Wasser und Wärme. In einem trockenen Jahr bildet das Kambium wenig Holz, der Ring ist schmal."));
  m.add({ kind: "number", value: first + (n - 1 - dry) }, tx("Inside is oldest", "Innen ist am ältesten"), tx("The rings are labelled: the innermost ring is the oldest. Read the year right off the narrow ring.", "Die Ringe sind beschriftet: Der innerste Ring ist der älteste. Lies das Jahr direkt am schmalen Ring ab."));
  return {
    instruction: tx("Read the annual rings", "Lies die Jahresringe"),
    text: tx("The years are written along one radius. In which year was it especially dry?", "Die Jahre stehen entlang eines Radius. In welchem Jahr war es besonders trocken?"),
    visual: visual(PlantStemSection, { widths, mode: "plain", firstYear: first }),
    answer,
    hint: tx("In a dry year the tree grows little. What does its ring look like?", "In einem trockenen Jahr wächst der Baum wenig. Wie sieht sein Ring aus?"),
    solution: [
      { math: tx('"dry year"#d \\to "little wood"#w \\to "narrow ring"#r', '"trockenes Jahr"#d \\to "wenig Holz"#w \\to "schmaler Ring"#r'), note: tx("Little water means little growth: the cambium makes only a thin layer of wood.", "Wenig Wasser bedeutet wenig Wachstum: Das Kambium bildet nur eine dünne Holzschicht.") },
      { math: tx(`"narrowest ring:"#n \\; ${year}#a`, `"schmalster Ring:"#n \\; ${year}#a`), note: tx(`The narrowest ring is the one from ${year}.`, `Der schmalste Ring ist der von ${year}.`), highlight: ["a"] },
    ],
    mistakes: m.list,
  };
}

const STEM_OUT_IN: Text[] = [tx("Bark", "Borke"), tx("Bast (secondary phloem)", "Bast (sekundäres Phloem)"), tx("Cambium", "Kambium"), tx("Wood (secondary xylem)", "Holz (sekundäres Xylem)"), tx("Pith", "Mark")];

function stemOrderTask(rng: Rng): Exercise {
  const inward = rng.chance(0.55);
  const items = inward ? STEM_OUT_IN : [...STEM_OUT_IN].reverse();
  const [bark, bast, cam, wood] = STEM_OUT_IN;
  const list: Mistake[] = [
    { when: { kind: "order", items: inward ? [wood, cam] : [cam, wood] }, title: tx("The cambium lies in between", "Das Kambium liegt dazwischen"), say: tx("The cambium sits between bast and wood: it makes wood inwards and bast outwards.", "Das Kambium liegt zwischen Bast und Holz: Es bildet nach innen Holz und nach außen Bast.") },
    { when: { kind: "order", items: inward ? [bast, bark] : [bark, bast] }, title: tx("Bark is outermost", "Borke ganz außen"), say: tx("The bark is the dead outer layer. The living bast lies just inside it.", "Die Borke ist die abgestorbene Außenschicht. Der lebende Bast liegt direkt darunter.") },
  ];
  return {
    instruction: tx("Order the layers of the trunk", "Ordne die Schichten des Stammes"),
    text: inward ? tx("Put the layers of a tree trunk in order **from the outside in**.", "Bring die Schichten eines Baumstammes in die richtige Reihenfolge, **von außen nach innen**.") : tx("Put the layers of a tree trunk in order **from the inside out**.", "Bring die Schichten eines Baumstammes in die richtige Reihenfolge, **von innen nach außen**."),
    answer: { kind: "order", items },
    hint: tx("The cambium makes wood inwards and bast outwards.", "Das Kambium bildet nach innen Holz und nach außen Bast."),
    solution: [{ math: items.map((it, i) => q(it, `s${i}`)).reduce((a, b) => join(a, "\\\\", b)), note: tx("Bark, bast, cambium, wood, pith: the cambium sits between bast and wood.", "Borke, Bast, Kambium, Holz, Mark: Das Kambium liegt zwischen Bast und Holz.") }],
    mistakes: list,
  };
}

const EL: Text[] = [tx("Early wood", "Frühholz"), tx("Late wood", "Spätholz")];
const EL_FACTS: { s: Text; a: 0 | 1 }[] = [
  { s: tx("has wide, thin-walled vessels", "hat weite, dünnwandige Gefäße"), a: 0 },
  { s: tx("is formed in spring, when the leaves come out", "wird im Frühjahr gebildet, wenn die Blätter austreiben"), a: 0 },
  { s: tx("looks light", "sieht hell aus"), a: 0 },
  { s: tx("carries lots of water for the new leaves", "leitet viel Wasser für die neuen Blätter"), a: 0 },
  { s: tx("has narrow, thick-walled cells", "hat enge, dickwandige Zellen"), a: 1 },
  { s: tx("is formed in summer", "wird im Sommer gebildet"), a: 1 },
  { s: tx("looks dark", "sieht dunkel aus"), a: 1 },
  { s: tx("mainly makes the wood strong", "macht das Holz vor allem fest"), a: 1 },
  { s: tx("borders directly on the next year's early wood", "grenzt direkt an das Frühholz des nächsten Jahres"), a: 1 },
];

function earlyLateTask(rng: Rng): Exercise {
  const f = rng.pick(EL_FACTS);
  const other = f.a === 0 ? 1 : 0;
  const answer: AnswerSpec = { kind: "choice", options: EL, correct: f.a };
  const list: Mistake[] = [
    {
      when: { kind: "choice", options: EL, correct: other },
      title: tx("Spring or summer?", "Frühjahr oder Sommer?"),
      say:
        f.a === 0
          ? tx("In spring the new leaves need lots of water: the cambium makes wide, thin-walled vessels. That light wood is the early wood.", "Im Frühjahr brauchen die neuen Blätter viel Wasser: Das Kambium bildet weite, dünnwandige Gefäße. Dieses helle Holz ist das Frühholz.")
          : tx("In summer the cambium makes narrow, thick-walled cells that strengthen the wood. That dark wood is the late wood.", "Im Sommer bildet das Kambium enge, dickwandige Zellen, die das Holz festigen. Dieses dunkle Holz ist das Spätholz."),
    },
  ];
  return {
    instruction: tx("Early wood or late wood?", "Frühholz oder Spätholz?"),
    text: tx(`Which part of an annual ring **${en(f.s)}**?`, `Welcher Teil eines Jahresrings **${de(f.s)}**?`),
    answer,
    hint: tx("Spring: lots of water needed, wide vessels. Summer: strength, narrow cells.", "Frühjahr: viel Wasser nötig, weite Gefäße. Sommer: Festigkeit, enge Zellen."),
    solution: [{ math: q(EL[f.a], "a"), note: tx(`${en(EL[f.a])}: it ${en(f.s)}.`, `${de(EL[f.a])}: ${de(f.s)}.`), highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Stomata: the mechanism

const OPEN_STEPS: Text[] = [
  tx("Light switches on the proton pump: H⁺ is pumped out", "Licht schaltet die Protonenpumpe ein: H⁺ wird hinausgepumpt"),
  tx("K⁺ ions flow into the guard cells", "K⁺-Ionen strömen in die Schließzellen ein"),
  tx("Water flows in by osmosis", "Wasser strömt durch Osmose nach"),
  tx("The turgor of the guard cells rises", "Der Turgor der Schließzellen steigt"),
  tx("The guard cells bend apart: the pore opens", "Die Schließzellen krümmen sich: Der Spalt öffnet sich"),
];
const CLOSE_STEPS: Text[] = [
  tx("Water shortage: abscisic acid (ABA) is made", "Wassermangel: Abscisinsäure (ABA) wird gebildet"),
  tx("K⁺ ions flow out of the guard cells", "K⁺-Ionen strömen aus den Schließzellen aus"),
  tx("Water flows out by osmosis", "Wasser strömt durch Osmose hinaus"),
  tx("The turgor of the guard cells drops", "Der Turgor der Schließzellen sinkt"),
  tx("The guard cells go slack: the pore closes", "Die Schließzellen erschlaffen: Der Spalt schließt sich"),
];

function stomaOrderTask(rng: Rng, fixed?: "open" | "close"): Exercise {
  const open = (fixed ?? (rng.chance(0.55) ? "open" : "close")) === "open";
  const steps = open ? OPEN_STEPS : CLOSE_STEPS;
  const drop = fixed ? -1 : rng.pick([-1, -1, 0, 4]);
  const items = steps.filter((_, i) => i !== drop);
  const has = (i: number) => items.includes(steps[i]);
  const list: Mistake[] = [];
  if (has(1) && has(2))
    list.push({ when: { kind: "order", items: [steps[2], steps[1]] }, title: tx("Water follows the ions", "Wasser folgt den Ionen"), say: tx("Water can't be pumped: it always follows the dissolved particles by osmosis. So the K⁺ ions have to move first.", "Wasser lässt sich nicht pumpen: Es folgt durch Osmose immer den gelösten Teilchen. Also müssen zuerst die K⁺-Ionen wandern.") });
  if (has(2) && has(3)) list.push({ when: { kind: "order", items: [steps[3], steps[2]] }, title: tx("Turgor comes from water", "Turgor kommt vom Wasser"), say: tx("The turgor is the pressure of the water inside the cell. It can only change after water has moved.", "Der Turgor ist der Druck des Wassers in der Zelle. Er ändert sich erst, wenn Wasser geflossen ist.") });
  if (open && has(0) && has(1)) list.push({ when: { kind: "order", items: [steps[1], steps[0]] }, title: tx("The pump comes first", "Erst die Pumpe"), say: tx("The proton pump makes the inside of the membrane negative. Only then do the K⁺ ions flow in.", "Die Protonenpumpe macht die Membran innen negativ. Erst dann strömen die K⁺-Ionen ein.") });
  return {
    instruction: open ? tx("How a stoma opens", "Wie eine Spaltöffnung öffnet") : tx("How a stoma closes", "Wie eine Spaltöffnung schließt"),
    text: open ? tx("Put the steps of stomatal opening in light in the right order.", "Bring die Schritte beim Öffnen einer Spaltöffnung im Licht in die richtige Reihenfolge.") : tx("Put the steps of stomatal closing during drought in the right order.", "Bring die Schritte beim Schließen einer Spaltöffnung bei Trockenheit in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("Ions move first, water follows by osmosis, then the pressure changes, then the shape.", "Erst wandern Ionen, dann folgt Wasser durch Osmose, dann ändert sich der Druck, dann die Form."),
    solution: [
      { math: open ? tx('"K⁺ in"#k \\to "water in"#w', '"K⁺ hinein"#k \\to "Wasser hinein"#w') : tx('"K⁺ out"#k \\to "water out"#w', '"K⁺ hinaus"#k \\to "Wasser hinaus"#w'), note: tx("Water always follows the ions by osmosis.", "Wasser folgt den Ionen immer durch Osmose.") },
      {
        math: open ? tx('"K⁺ in"#k \\to "water in"#w \\\\ \\to "turgor rises"#t \\to "pore opens"#o', '"K⁺ hinein"#k \\to "Wasser hinein"#w \\\\ \\to "Turgor steigt"#t \\to "Spalt offen"#o') : tx('"K⁺ out"#k \\to "water out"#w \\\\ \\to "turgor drops"#t \\to "pore closes"#o', '"K⁺ hinaus"#k \\to "Wasser hinaus"#w \\\\ \\to "Turgor sinkt"#t \\to "Spalt zu"#o'),
        note: open ? tx("Higher turgor bends the guard cells apart, because their wall along the pore is thicker.", "Höherer Turgor krümmt die Schließzellen auseinander, weil ihre Wand am Spalt dicker ist.") : tx("Lower turgor: the guard cells go slack and close the pore. The plant saves water.", "Niedrigerer Turgor: Die Schließzellen erschlaffen und schließen den Spalt. Die Pflanze spart Wasser."),
        highlight: ["o"],
      },
    ],
    mistakes: list,
  };
}

const SCEN: { q: Text; a: Text; wrong: Opt[]; why: Text }[] = [
  {
    q: tx("Pieces of epidermis are placed in a concentrated salt solution. What happens to the stomata?", "Epidermisstücke werden in eine konzentrierte Salzlösung gelegt. Was passiert mit den Spaltöffnungen?"),
    a: tx("Water leaves the guard cells, the turgor drops, the pores close.", "Wasser strömt aus den Schließzellen, der Turgor sinkt, die Spalten schließen sich."),
    wrong: [
      { text: tx("Salt flows in, so the pores open.", "Salz strömt ein, darum öffnen sich die Spalten."), title: tx("Think osmosis", "Denk an Osmose"), say: tx("The membrane holds back the salt. Water moves towards the higher concentration: out of the cells.", "Die Membran hält das Salz zurück. Wasser wandert zur höheren Konzentration: aus den Zellen hinaus.") },
      { text: tx("Nothing happens, because salt can't get through the cuticle.", "Nichts, weil Salz nicht durch die Cuticula kommt."), title: tx("Water moves", "Das Wasser bewegt sich"), say: tx("Even if the salt stays outside, the water moves: by osmosis, out of the guard cells.", "Auch wenn das Salz draußen bleibt, bewegt sich Wasser: durch Osmose aus den Schließzellen hinaus.") },
      { text: tx("Water flows into the guard cells, the pores open.", "Wasser strömt in die Schließzellen, die Spalten öffnen sich."), title: tx("Wrong direction", "Falsche Richtung"), say: tx("The salt solution outside is more concentrated (hypertonic). Water flows from low to high concentration: out of the cells.", "Die Salzlösung außen ist konzentrierter (hypertonisch). Wasser strömt von niedriger zu hoher Konzentration: aus den Zellen hinaus.") },
    ],
    why: tx("The solution outside is hypertonic: water leaves the guard cells by osmosis.", "Die Lösung außen ist hypertonisch: Wasser verlässt die Schließzellen durch Osmose."),
  },
  {
    q: tx("A fungal toxin (fusicoccin) keeps the proton pump of the guard cells running all the time. What happens to the plant?", "Ein Pilzgift (Fusicoccin) lässt die Protonenpumpe der Schließzellen ständig laufen. Was passiert mit der Pflanze?"),
    a: tx("The stomata stay open even in the dark, the plant loses too much water and wilts.", "Die Spaltöffnungen bleiben selbst im Dunkeln offen, die Pflanze verliert zu viel Wasser und welkt."),
    wrong: [
      { text: tx("The stomata stay closed and the plant can't take in carbon dioxide.", "Die Spaltöffnungen bleiben geschlossen, die Pflanze nimmt kein Kohlenstoffdioxid auf."), title: tx("The pump opens", "Die Pumpe öffnet"), say: tx("The proton pump starts the opening: H⁺ out, K⁺ in, water in. Running all the time, it keeps the pores open.", "Die Protonenpumpe startet das Öffnen: H⁺ hinaus, K⁺ hinein, Wasser hinein. Läuft sie ständig, bleiben die Spalten offen.") },
      { text: tx("Nothing changes, because the pump only works in light anyway.", "Nichts ändert sich, weil die Pumpe sowieso nur im Licht arbeitet."), title: tx("Now it runs in the dark too", "Jetzt läuft sie auch im Dunkeln"), say: tx("Normally the pump is switched on by light. The toxin keeps it running in the dark as well.", "Normalerweise schaltet Licht die Pumpe ein. Das Gift lässt sie auch im Dunkeln laufen.") },
      { text: tx("The guard cells burst from too much water.", "Die Schließzellen platzen vor lauter Wasser."), title: tx("The cell wall holds", "Die Zellwand hält"), say: tx("Plant cells have a firm cell wall: the turgor rises, but the cells don't burst.", "Pflanzenzellen haben eine feste Zellwand: Der Turgor steigt, aber die Zellen platzen nicht.") },
    ],
    why: tx("Pump always on means K⁺ and water always in: high turgor, open pores, wilting.", "Pumpe immer an heißt: K⁺ und Wasser immer drin, hoher Turgor, offene Spalten, Welken."),
  },
  {
    q: tx("A mutant can't make abscisic acid (ABA). How does it react to drought?", "Eine Mutante kann keine Abscisinsäure (ABA) bilden. Wie reagiert sie auf Trockenheit?"),
    a: tx("Its stomata stay open, it keeps losing water and wilts quickly.", "Ihre Spaltöffnungen bleiben offen, sie verliert weiter Wasser und welkt schnell."),
    wrong: [
      { text: tx("Its stomata close even faster than usual.", "Ihre Spaltöffnungen schließen sich noch schneller als sonst."), title: tx("ABA closes the stomata", "ABA schließt die Spalten"), say: tx("Abscisic acid is the signal that makes K⁺ and water leave the guard cells. Without ABA, that signal is missing.", "Abscisinsäure ist das Signal, das K⁺ und Wasser aus den Schließzellen strömen lässt. Ohne ABA fehlt dieses Signal.") },
      { text: tx("It no longer does photosynthesis.", "Sie betreibt keine Fotosynthese mehr."), title: tx("The stomata stay open", "Die Spalten bleiben offen"), say: tx("Its stomata stay open, so carbon dioxide can still get in. The problem is the water loss.", "Ihre Spalten bleiben offen, Kohlenstoffdioxid kommt also weiter hinein. Das Problem ist der Wasserverlust.") },
      { text: tx("It takes up more water through its leaves.", "Sie nimmt mehr Wasser über die Blätter auf."), title: tx("Leaves give water off", "Blätter geben Wasser ab"), say: tx("Stomata don't take in liquid water. Open stomata in drought mean more water vapour escapes.", "Spaltöffnungen nehmen kein flüssiges Wasser auf. Offene Spalten bei Trockenheit heißt: mehr Wasserdampf entweicht.") },
    ],
    why: tx("Without abscisic acid there's no closing signal: open stomata, high transpiration, wilting.", "Ohne Abscisinsäure fehlt das Schließsignal: offene Spalten, hohe Transpiration, Welken."),
  },
  {
    q: tx("An inhibitor blocks the K⁺ channels of the guard cells. What happens in the morning light?", "Ein Hemmstoff blockiert die K⁺-Kanäle der Schließzellen. Was passiert im Morgenlicht?"),
    a: tx("The pores hardly open, because no K⁺ can flow in and so no water follows.", "Die Spalten öffnen sich kaum, weil kein K⁺ einströmen kann und deshalb kein Wasser folgt."),
    wrong: [
      { text: tx("The pores open as usual, since the proton pump still works.", "Die Spalten öffnen sich normal, denn die Protonenpumpe arbeitet ja."), title: tx("The pump alone isn't enough", "Die Pumpe allein reicht nicht"), say: tx("The pump only prepares the way. Without K⁺ flowing in, the concentration doesn't rise and no water follows.", "Die Pumpe bereitet nur vor. Ohne einströmendes K⁺ steigt die Konzentration nicht, und kein Wasser folgt.") },
      { text: tx("The pores open even wider, because K⁺ can't leave.", "Die Spalten öffnen sich noch weiter, weil K⁺ nicht hinauskann."), title: tx("It can't get in either", "Es kommt auch nicht hinein"), say: tx("Blocked channels stop K⁺ getting in as well. In the morning the guard cells have little K⁺ to start with.", "Blockierte Kanäle lassen K⁺ auch nicht hinein. Morgens haben die Schließzellen anfangs wenig K⁺.") },
      { text: tx("Water is pumped into the guard cells directly instead.", "Stattdessen wird Wasser direkt in die Schließzellen gepumpt."), title: tx("Water isn't pumped", "Wasser wird nicht gepumpt"), say: tx("Cells can't pump water; it only follows dissolved particles by osmosis.", "Zellen können Wasser nicht pumpen; es folgt nur durch Osmose den gelösten Teilchen.") },
    ],
    why: tx("No K⁺ influx, no rise in concentration, no osmotic water uptake, no opening.", "Kein K⁺-Einstrom, kein Konzentrationsanstieg, keine osmotische Wasseraufnahme, keine Öffnung."),
  },
  {
    q: tx("Imagine the guard cell wall along the pore were as thin and stretchy as the outer wall. What would happen when the turgor rises?", "Stell dir vor, die Schließzellwand am Spalt wäre genauso dünn und dehnbar wie die Außenwand. Was passiert, wenn der Turgor steigt?"),
    a: tx("The guard cells would swell evenly without bending, so the pore would hardly open.", "Die Schließzellen würden gleichmäßig anschwellen, ohne sich zu krümmen, der Spalt öffnete sich kaum."),
    wrong: [
      { text: tx("The pore would open even wider.", "Der Spalt würde sich noch weiter öffnen."), title: tx("Bending needs a stiff side", "Krümmen braucht eine steife Seite"), say: tx("A cell only bends if one side stretches less than the other. Evenly stretchy walls just make it round and fat.", "Eine Zelle krümmt sich nur, wenn eine Seite sich weniger dehnt als die andere. Gleich dehnbare Wände machen sie nur rund und dick.") },
      { text: tx("The pore would close when the turgor rises.", "Der Spalt würde sich bei steigendem Turgor schließen."), title: tx("No bending at all", "Gar keine Krümmung"), say: tx("Without the thick inner wall the cells don't bend inwards either: they just swell evenly.", "Ohne die dicke Innenwand krümmen sich die Zellen auch nicht nach innen: Sie schwellen nur gleichmäßig an.") },
      { text: tx("Nothing would change, the wall thickness doesn't matter.", "Nichts würde sich ändern, die Wanddicke spielt keine Rolle."), title: tx("It's the key to the shape", "Sie ist der Schlüssel zur Form"), say: tx("The uneven wall is exactly why the swelling guard cells bend apart.", "Gerade die ungleiche Wand ist der Grund, warum sich die anschwellenden Schließzellen auseinanderkrümmen.") },
    ],
    why: tx("The thick, less stretchy wall at the pore makes the guard cells bend outwards when they swell.", "Die dicke, weniger dehnbare Wand am Spalt lässt die Schließzellen beim Anschwellen nach außen krümmen."),
  },
];

function scenarioTask(rng: Rng): Exercise {
  const s = rng.pick(SCEN);
  const { answer, mistakes: list } = choice(rng, [{ text: s.a }, ...s.wrong]);
  return {
    instruction: tx("Explain with the mechanism", "Erkläre mit dem Mechanismus"),
    text: s.q,
    answer,
    hint: tx("Go through the chain: proton pump, K⁺, osmosis, turgor, shape of the guard cells.", "Geh die Kette durch: Protonenpumpe, K⁺, Osmose, Turgor, Form der Schließzellen."),
    solution: [
      { math: tx('"ions"#i \\to "water"#w \\to "turgor"#t \\to "pore"#p', '"Ionen"#i \\to "Wasser"#w \\to "Turgor"#t \\to "Spalt"#p'), note: tx("Every change starts with the ions; water follows by osmosis.", "Jede Änderung beginnt bei den Ionen; Wasser folgt durch Osmose.") },
      { math: tx('"result"#r', '"Ergebnis"#r'), note: tx(`${en(s.a)} ${en(s.why)}`, `${de(s.a)} ${de(s.why)}`), highlight: ["r"] },
    ],
    mistakes: list,
  };
}

function densityTask(rng: Rng): Exercise | null {
  if (rng.chance(0.5)) {
    const area = rng.pick([0.1, 0.2, 0.25, 0.5]);
    const count = rng.int(12, 90);
    const value = Math.round((count / area) * 10) / 10;
    if (!Number.isInteger(value)) return null;
    const answer: AnswerSpec = { kind: "number", value, unit: tx("per mm²", "pro mm²"), tolerance: 0.005 };
    const m = mistakes(answer);
    m.add({ kind: "number", value: Math.round(count * area * 1000) / 1000, tolerance: 0.005 }, tx("Divide, don't multiply", "Teilen, nicht malnehmen"), tx("You multiplied by the area. Density means stomata per mm²: count divided by area.", "Du hast mit der Fläche malgenommen. Dichte heißt Spaltöffnungen pro mm²: Anzahl geteilt durch Fläche."));
    m.add({ kind: "number", value: count }, tx("Per mm²!", "Pro mm²!"), tx(`That's the count in ${area.toString().replace(".", ",")} mm². Scale it up to 1 mm².`, `Das ist die Anzahl in ${area.toString().replace(".", ",")} mm². Rechne sie auf 1 mm² hoch.`), true);
    const areaT = tx(String(area), String(area).replace(".", ","));
    return {
      instruction: tx("Stomatal density", "Spaltöffnungsdichte"),
      text: tx(`Under the microscope you count ${count} stomata in a field of ${en(areaT)} mm² on the underside of a leaf. How many stomata are there per mm²?`, `Unter dem Mikroskop zählst du auf der Blattunterseite ${count} Spaltöffnungen in einem Bildausschnitt von ${de(areaT)} mm². Wie viele Spaltöffnungen sind es pro mm²?`),
      answer,
      hint: tx("Stomata per mm² = count ÷ area in mm².", "Spaltöffnungen pro mm² = Anzahl : Fläche in mm²."),
      solution: [{ math: tx(`\\frac{${count}}{${en(areaT)} "mm"^2} = ${value}#r "/mm"^2`, `\\frac{${count}}{${de(areaT)} "mm"^2} = ${value}#r "/mm"^2`), note: tx("Count divided by area gives the density per mm².", "Anzahl geteilt durch Fläche ergibt die Dichte pro mm²."), highlight: ["r"] }],
      mistakes: m.list,
    };
  }
  const dens = rng.pick([120, 150, 200, 250, 300]);
  const cm2 = rng.pick([0.1, 0.2, 0.3]);
  const mm2 = Math.round(cm2 * 100);
  const value = dens * mm2;
  const cmT = tx(String(cm2), String(cm2).replace(".", ","));
  const answer: AnswerSpec = { kind: "number", value, tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: Math.round(dens * cm2 * 100) / 100 }, tx("cm² isn't mm²", "cm² ist nicht mm²"), tx("1 cm² = 100 mm². Convert the area to mm² first.", "1 cm² = 100 mm². Rechne die Fläche zuerst in mm² um."));
  m.add({ kind: "number", value: dens * mm2 / 10 }, tx("Square units", "Flächeneinheiten"), tx("1 cm = 10 mm, but 1 cm² = 10 · 10 = 100 mm².", "1 cm = 10 mm, aber 1 cm² = 10 · 10 = 100 mm²."), true);
  return {
    instruction: tx("How many stomata?", "Wie viele Spaltöffnungen?"),
    text: tx(`A leaf has ${dens} stomata per mm² on its underside. How many stomata are there on a piece of the underside measuring ${en(cmT)} cm²?`, `Ein Blatt hat auf der Unterseite ${dens} Spaltöffnungen pro mm². Wie viele Spaltöffnungen hat ein Stück der Unterseite mit ${de(cmT)} cm²?`),
    answer,
    hint: tx("Convert cm² to mm² (· 100), then multiply by the density.", "Rechne cm² in mm² um (· 100) und multipliziere mit der Dichte."),
    solution: [
      { math: tx(`${en(cmT)} "cm"^2 = ${mm2}#a "mm"^2`, `${de(cmT)} "cm"^2 = ${mm2}#a "mm"^2`), note: tx("1 cm² = 100 mm².", "1 cm² = 100 mm².") },
      { math: `${mm2}#a "mm"^2 \\cdot ${dens} "/mm"^2 = ${value}#r`, note: tx("Area times density.", "Fläche mal Dichte."), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Adaptations

type Hab = "xero" | "hygro" | "hydro";
const HAB: Record<Hab, Text> = {
  xero: tx("Xerophyte (dry habitat)", "Xerophyt (Trockenstandort)"),
  hygro: tx("Hygrophyte (damp habitat)", "Hygrophyt (Feuchtstandort)"),
  hydro: tx("Hydrophyte (in water)", "Hydrophyt (Wasserpflanze)"),
};
const FEAT: { f: Text; h: Hab }[] = [
  { f: tx("a thick cuticle and a multi-layered epidermis", "eine dicke Cuticula und eine mehrschichtige Epidermis"), h: "xero" },
  { f: tx("stomata sunken in hairy pits", "in behaarte Gruben eingesenkte Spaltöffnungen"), h: "xero" },
  { f: tx("leaves that roll up in drought", "Blätter, die sich bei Trockenheit einrollen"), h: "xero" },
  { f: tx("spines instead of leaves and a green, fleshy stem", "Dornen statt Blätter und eine grüne, fleischige Sprossachse"), h: "xero" },
  { f: tx("water-storing tissue in thick leaves", "Wasserspeichergewebe in dicken Blättern"), h: "xero" },
  { f: tx("a dense coat of dead, white hairs", "einen dichten Pelz aus toten, weißen Haaren"), h: "xero" },
  { f: tx("large, thin leaves with a thin cuticle", "große, dünne Blätter mit dünner Cuticula"), h: "hygro" },
  { f: tx("stomata raised above the leaf surface", "über die Blattoberfläche emporgehobene Spaltöffnungen"), h: "hygro" },
  { f: tx("living hairs that enlarge the leaf surface", "lebende Haare, die die Blattoberfläche vergrößern"), h: "hygro" },
  { f: tx("water pores that press out droplets (guttation)", "Wasserspalten, die Tropfen herausdrücken (Guttation)"), h: "hygro" },
  { f: tx("aerenchyma with large air chambers", "Aerenchym mit großen Luftkammern"), h: "hydro" },
  { f: tx("stomata only on the upper side of floating leaves", "Spaltöffnungen nur auf der Oberseite der Schwimmblätter"), h: "hydro" },
  { f: tx("hardly any supporting tissue and little xylem", "kaum Festigungsgewebe und wenig Xylem"), h: "hydro" },
  { f: tx("finely divided leaves under water without stomata", "fein zerteilte Unterwasserblätter ohne Spaltöffnungen"), h: "hydro" },
];

function habSay(right: Hab, picked: Hab): Text {
  if ((right === "hydro" && picked === "hygro") || (right === "hygro" && picked === "hydro"))
    return tx("Watch the prefix: **hygro**phytes live in damp air and soil, **hydro**phytes live in water. Which one fits?", "Achte auf die Vorsilbe: **Hygro**phyten leben an feuchten Standorten, **Hydro**phyten im Wasser. Was passt?");
  if (picked === "xero") return tx("Xerophytes save water. Does this feature reduce water loss, or does it do something else?", "Xerophyten sparen Wasser. Senkt dieses Merkmal den Wasserverlust, oder bewirkt es etwas anderes?");
  if (picked === "hygro") return tx("Hygrophytes promote transpiration in humid air. Does this feature do that?", "Hygrophyten fördern in feuchter Luft die Transpiration. Macht dieses Merkmal das?");
  return tx("Hydrophytes live in water: buoyancy, oxygen supply and gas exchange towards the air matter there. Does this feature fit?", "Hydrophyten leben im Wasser: Dort zählen Auftrieb, Sauerstoffversorgung und Gasaustausch zur Luft. Passt dieses Merkmal?");
}

function featureTask(rng: Rng, fixed?: number): Exercise {
  const f = FEAT[fixed ?? rng.int(0, FEAT.length - 1)];
  const order: Hab[] = ["xero", "hygro", "hydro"];
  const answer: AnswerSpec = { kind: "choice", options: order.map((h) => HAB[h]), correct: order.indexOf(f.h) };
  const list: Mistake[] = order
    .filter((h) => h !== f.h)
    .map((h) => ({ when: { kind: "choice", options: order.map((x) => HAB[x]), correct: order.indexOf(h) } as AnswerSpec, title: tx("Another habitat", "Ein anderer Standort"), say: habSay(f.h, h) }));
  return {
    instruction: tx("Adaptation to the habitat", "Angepasstheit an den Standort"),
    text: tx(`A plant has **${en(f.f)}**. Which type of plant is it most likely?`, `Eine Pflanze hat **${de(f.f)}**. Zu welchem Pflanzentyp gehört sie wahrscheinlich?`),
    answer,
    hint: tx("Does the feature save water, promote transpiration, or help living in water?", "Spart das Merkmal Wasser, fördert es die Transpiration, oder hilft es beim Leben im Wasser?"),
    solution: [{ math: q(HAB[f.h], "a"), note: tx(`${cap1(en(f.f))}: typical of a ${en(HAB[f.h]).toLowerCase()}.`, `${cap1(de(f.f))}: typisch für einen ${de(HAB[f.h])}.`), highlight: ["a"] }],
    mistakes: list,
  };
}
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PICS: { kind: LeafKind; h: Hab }[] = [
  { kind: "xero", h: "xero" },
  { kind: "rolled", h: "xero" },
  { kind: "hygro", h: "hygro" },
  { kind: "hydro", h: "hydro" },
];

function leafPicTask(rng: Rng): Exercise {
  const p = rng.pick(PICS);
  const order: Hab[] = ["xero", "hygro", "hydro"];
  const answer: AnswerSpec = { kind: "choice", options: order.map((h) => HAB[h]), correct: order.indexOf(p.h) };
  const list: Mistake[] = order.filter((h) => h !== p.h).map((h) => ({ when: { kind: "choice", options: order.map((x) => HAB[x]), correct: order.indexOf(h) } as AnswerSpec, title: tx("Look at the stomata", "Schau auf die Spaltöffnungen"), say: habSay(p.h, h) }));
  const notes: Record<LeafKind, Text> = {
    xero: tx("Thick cuticle, several layers of epidermis, stomata sunken in hairy pits: everything saves water.", "Dicke Cuticula, mehrschichtige Epidermis, eingesenkte Spaltöffnungen in behaarten Gruben: Alles spart Wasser."),
    rolled: tx("A rolled leaf with stomata in hairy grooves on the inside: it saves water in dry, windy places.", "Ein Rollblatt mit Spaltöffnungen in behaarten Rinnen auf der Innenseite: Es spart Wasser an trockenen, windigen Standorten."),
    hygro: tx("Thin leaf, thin cuticle, raised stomata, living hairs: everything promotes transpiration in humid air.", "Dünnes Blatt, dünne Cuticula, emporgehobene Spaltöffnungen, lebende Haare: Alles fördert die Transpiration in feuchter Luft."),
    hydro: tx("Stomata on the upper side and large air chambers (aerenchyma): a floating leaf on water.", "Spaltöffnungen auf der Oberseite und große Luftkammern (Aerenchym): ein Schwimmblatt auf dem Wasser."),
  };
  return {
    instruction: tx("Read the leaf section", "Deute den Blattquerschnitt"),
    text: tx("The picture shows a leaf in cross-section. Which type of plant does it come from?", "Das Bild zeigt ein Blatt im Querschnitt. Von welchem Pflanzentyp stammt es?"),
    visual: visual(PlantAdaptLeaf, { kind: p.kind, mode: "plain" }),
    answer,
    hint: tx("Look at the cuticle, where the stomata are and whether there are big air spaces.", "Achte auf die Cuticula, auf die Lage der Spaltöffnungen und auf große Lufträume."),
    solution: [{ math: q(HAB[p.h], "a"), note: notes[p.kind], highlight: ["a"] }],
    mistakes: list,
  };
}

const WHY3: { q: Text; a: Text; wrong: Opt[] }[] = [
  {
    q: tx("Why do sunken stomata in hairy pits reduce transpiration?", "Warum verringern eingesenkte Spaltöffnungen in behaarten Gruben die Transpiration?"),
    a: tx("Still, moist air stays in the pit, so the water vapour gradient to the outside air is small.", "In der Grube bleibt windstille, feuchte Luft: Das Konzentrationsgefälle für Wasserdampf zur Außenluft ist klein."),
    wrong: [
      { text: tx("The hairs soak up water from the air.", "Die Haare saugen Wasser aus der Luft auf."), title: tx("Dead hairs don't absorb", "Tote Haare saugen nichts"), say: tx("The hairs are dead and don't take up water. They slow down the air, so moist air stays in the pit.", "Die Haare sind tot und nehmen kein Wasser auf. Sie bremsen die Luft, sodass feuchte Luft in der Grube bleibt.") },
      { text: tx("The stomata in the pit are permanently closed.", "Die Spaltöffnungen in der Grube sind dauerhaft geschlossen."), title: tx("They still open", "Sie öffnen sich trotzdem"), say: tx("They open for gas exchange like any stoma. The pit just makes less water escape while they're open.", "Sie öffnen sich zum Gasaustausch wie jede Spaltöffnung. Die Grube sorgt nur dafür, dass dabei weniger Wasser entweicht.") },
      { text: tx("The pit shades the leaf so it does no photosynthesis.", "Die Grube beschattet das Blatt, damit es keine Fotosynthese betreibt."), title: tx("Photosynthesis goes on", "Die Fotosynthese läuft weiter"), say: tx("The pits are on the underside and don't stop photosynthesis. They're about water vapour leaving the leaf.", "Die Gruben liegen unten und stoppen die Fotosynthese nicht. Es geht um den Wasserdampf, der das Blatt verlässt.") },
    ],
  },
  {
    q: tx("Why do hygrophytes have raised stomata and thin leaves?", "Warum haben Hygrophyten emporgehobene Spaltöffnungen und dünne Blätter?"),
    a: tx("In humid air they promote transpiration, so the transpiration stream can carry minerals.", "In feuchter Luft fördern sie die Transpiration, damit der Transpirationsstrom Mineralstoffe transportieren kann."),
    wrong: [
      { text: tx("To save water in dry air.", "Um in trockener Luft Wasser zu sparen."), title: tx("The opposite", "Genau andersherum"), say: tx("Hygrophytes live in damp places. Raised stomata make transpiration easier, not harder.", "Hygrophyten leben an feuchten Standorten. Emporgehobene Spaltöffnungen machen die Transpiration leichter, nicht schwerer.") },
      { text: tx("To take in rainwater through the stomata.", "Um Regenwasser über die Spaltöffnungen aufzunehmen."), title: tx("No liquid water", "Kein flüssiges Wasser"), say: tx("Stomata let gases through, not liquid water. Water comes in through the roots.", "Spaltöffnungen lassen Gase durch, kein flüssiges Wasser. Wasser kommt über die Wurzel hinein.") },
      { text: tx("To catch more light in the shade.", "Um im Schatten mehr Licht einzufangen."), title: tx("Stomata don't catch light", "Spaltöffnungen fangen kein Licht"), say: tx("Large leaves do help in the shade, but stomata don't catch light. Raised stomata are about evaporation.", "Große Blätter helfen zwar im Schatten, aber Spaltöffnungen fangen kein Licht. Emporgehobene Spaltöffnungen dienen der Verdunstung.") },
    ],
  },
  {
    q: tx("What is the aerenchyma of a water lily for?", "Wozu dient das Aerenchym der Seerose?"),
    a: tx("Buoyancy, and supplying oxygen to the organs in the oxygen-poor mud.", "Für Auftrieb und zur Sauerstoffversorgung der Organe im sauerstoffarmen Schlamm."),
    wrong: [
      { text: tx("To store water, like a cactus.", "Zur Wasserspeicherung wie beim Kaktus."), title: tx("Air, not water", "Luft, kein Wasser"), say: tx("The chambers are filled with air. A water plant has plenty of water; what it lacks in the mud is oxygen.", "Die Kammern sind mit Luft gefüllt. Wasser hat eine Wasserpflanze genug; im Schlamm fehlt ihr Sauerstoff.") },
      { text: tx("To make the leaf stiff against the waves.", "Um das Blatt gegen Wellen zu versteifen."), title: tx("Air tissue is soft", "Luftgewebe ist weich"), say: tx("Large air chambers make the tissue light, not stiff. Water lilies have hardly any supporting tissue.", "Große Luftkammern machen das Gewebe leicht, nicht steif. Seerosen haben kaum Festigungsgewebe.") },
      { text: tx("To store starch for the winter.", "Um Stärke für den Winter zu speichern."), title: tx("Empty spaces", "Leere Räume"), say: tx("The chambers are air-filled spaces between cells, not storage cells.", "Die Kammern sind luftgefüllte Räume zwischen den Zellen, keine Speicherzellen.") },
    ],
  },
  {
    q: tx("Why does marram grass roll up its leaves in drought?", "Warum rollt Strandhafer bei Trockenheit seine Blätter ein?"),
    a: tx("Its stomata then lie inside in still, moist air, so less water vapour escapes.", "Seine Spaltöffnungen liegen dann innen in windstiller, feuchter Luft, also entweicht weniger Wasserdampf."),
    wrong: [
      { text: tx("To catch dew water inside the roll.", "Um im Inneren der Rolle Tauwasser zu sammeln."), title: tx("It's about losing less", "Es geht ums Weniger-Verlieren"), say: tx("Leaves don't take up liquid water. Rolling up protects the stomata from the dry wind.", "Blätter nehmen kein flüssiges Wasser auf. Das Einrollen schützt die Spaltöffnungen vor dem trockenen Wind.") },
      { text: tx("To protect itself from sand.", "Um sich vor Sand zu schützen."), title: tx("Think of the stomata", "Denk an die Spaltöffnungen"), say: tx("The key is where the stomata lie: on the inside, in still and moist air.", "Entscheidend ist, wo die Spaltöffnungen liegen: innen, in stiller und feuchter Luft.") },
      { text: tx("To get more light for photosynthesis.", "Um mehr Licht für die Fotosynthese zu bekommen."), title: tx("Less light, actually", "Eher weniger Licht"), say: tx("A rolled leaf catches less light. It's a trade-off that saves water.", "Ein eingerolltes Blatt fängt eher weniger Licht ein. Es ist ein Kompromiss, der Wasser spart.") },
    ],
  },
  {
    q: tx("Why does a cactus have spines instead of leaves?", "Warum hat ein Kaktus Dornen statt Blätter?"),
    a: tx("The surface that loses water is much smaller; the green stem does the photosynthesis.", "Die Oberfläche, über die Wasser verloren geht, ist viel kleiner; die grüne Sprossachse betreibt Fotosynthese."),
    wrong: [
      { text: tx("The spines do the photosynthesis.", "Die Dornen betreiben die Fotosynthese."), title: tx("Spines aren't green", "Dornen sind nicht grün"), say: tx("Spines are changed leaves without chlorophyll. Photosynthesis happens in the green stem.", "Dornen sind umgewandelte Blätter ohne Chlorophyll. Die Fotosynthese läuft in der grünen Sprossachse.") },
      { text: tx("The spines take up water from the air.", "Die Dornen nehmen Wasser aus der Luft auf."), title: tx("Water comes from the roots", "Wasser kommt von der Wurzel"), say: tx("A cactus takes up water with its widespread roots and stores it in its stem.", "Ein Kaktus nimmt Wasser mit seinen weit verzweigten Wurzeln auf und speichert es in der Sprossachse.") },
      { text: tx("The spines store water.", "Die Dornen speichern Wasser."), title: tx("The stem stores", "Die Sprossachse speichert"), say: tx("The water is stored in the thick, fleshy stem, not in the thin spines.", "Das Wasser steckt in der dicken, fleischigen Sprossachse, nicht in den dünnen Dornen.") },
    ],
  },
];

function adaptWhyTask(rng: Rng): Exercise {
  const w = rng.pick(WHY3);
  const { answer, mistakes: list } = choice(rng, [{ text: w.a }, ...w.wrong]);
  return {
    instruction: tx("Explain the adaptation", "Erkläre die Angepasstheit"),
    text: w.q,
    answer,
    hint: tx("Think about the water vapour gradient between leaf and air, and about what the habitat lacks.", "Denk an das Wasserdampfgefälle zwischen Blatt und Luft und daran, woran es am Standort mangelt."),
    solution: [{ math: tx('"explanation"#e', '"Erklärung"#e'), note: w.a, highlight: ["e"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Monocots and dicots

const MD: Text[] = [tx("Monocot", "Einkeimblättrig"), tx("Dicot", "Zweikeimblättrig")];

function stemKindTask(rng: Rng): Exercise {
  const mono = rng.chance(0.5);
  const answer: AnswerSpec = { kind: "choice", options: MD, correct: mono ? 0 : 1 };
  const list: Mistake[] = [
    {
      when: { kind: "choice", options: MD, correct: mono ? 1 : 0 },
      title: tx("Look at the bundles", "Schau auf die Leitbündel"),
      say: mono ? tx("The bundles are scattered over the whole cross-section and closed (no cambium): typical of monocots.", "Die Leitbündel liegen über den ganzen Querschnitt verstreut und sind geschlossen (ohne Kambium): typisch für Einkeimblättrige.") : tx("The bundles form a ring, with cambium between xylem and phloem: typical of dicots.", "Die Leitbündel bilden einen Ring, mit Kambium zwischen Xylem und Phloem: typisch für Zweikeimblättrige."),
    },
  ];
  return {
    instruction: tx("Monocot or dicot?", "Ein- oder zweikeimblättrig?"),
    text: tx("The picture shows a young stem in cross-section. Is the plant a monocot or a dicot?", "Das Bild zeigt einen jungen Spross im Querschnitt. Ist die Pflanze ein- oder zweikeimblättrig?"),
    visual: visual(PlantStemPrimary, { kind: mono ? "monocot" : "dicot", mode: "plain" }),
    answer,
    hint: tx("Are the vascular bundles arranged in a ring or scattered?", "Liegen die Leitbündel im Ring oder verstreut?"),
    solution: [{ math: mono ? tx('"scattered bundles"#b \\Rightarrow "monocot"#a', '"zerstreute Leitbündel"#b \\Rightarrow "einkeimblättrig"#a') : tx('"ring of bundles"#b \\Rightarrow "dicot"#a', '"Leitbündelring"#b \\Rightarrow "zweikeimblättrig"#a'), note: mono ? tx("Scattered, closed bundles: a monocot such as maize. No cambium, so no secondary growth.", "Zerstreute, geschlossene Leitbündel: eine Einkeimblättrige wie Mais. Kein Kambium, also kein sekundäres Dickenwachstum.") : tx("Open bundles in a ring: a dicot such as the sunflower. The cambium allows secondary growth.", "Offene Leitbündel im Ring: eine Zweikeimblättrige wie die Sonnenblume. Das Kambium ermöglicht sekundäres Dickenwachstum."), highlight: ["a"] }],
    mistakes: list,
  };
}

const MONO_F: { t: Text; mono: boolean }[] = [
  { t: tx("one cotyledon", "ein Keimblatt"), mono: true },
  { t: tx("parallel leaf veins", "parallelnervige Blätter"), mono: true },
  { t: tx("scattered vascular bundles", "zerstreute Leitbündel"), mono: true },
  { t: tx("closed bundles without cambium", "geschlossene Leitbündel ohne Kambium"), mono: true },
  { t: tx("flower parts mostly in threes", "Blütenteile meist in Dreizahl"), mono: true },
  { t: tx("fibrous roots, no taproot", "Büschelwurzeln, keine Hauptwurzel"), mono: true },
  { t: tx("two cotyledons", "zwei Keimblätter"), mono: false },
  { t: tx("net-veined leaves", "netznervige Blätter"), mono: false },
  { t: tx("vascular bundles in a ring", "Leitbündel im Ring"), mono: false },
  { t: tx("can grow thicker with annual rings (trees)", "können mit Jahresringen in die Dicke wachsen (Bäume)"), mono: false },
  { t: tx("flower parts in fours or fives", "Blütenteile in Vier- oder Fünfzahl"), mono: false },
  { t: tx("a taproot", "eine Hauptwurzel (Pfahlwurzel)"), mono: false },
];

function monoMultiTask(rng: Rng): Exercise {
  const askMono = rng.chance(0.5);
  const right = rng.shuffle(MONO_F.filter((f) => f.mono === askMono)).slice(0, rng.int(2, 3));
  const wrong = rng.shuffle(MONO_F.filter((f) => f.mono !== askMono)).slice(0, 6 - right.length);
  const items = rng.shuffle([...right, ...wrong]);
  const options = items.map((f) => capT(f.t));
  const correct = where(items, (f) => f.mono === askMono);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((f, i) => {
    if (f.mono !== askMono)
      m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("That's the other group", "Das ist die andere Gruppe"), askMono ? tx(`"${en(f.t)}" is typical of dicots like beans, oaks and sunflowers.`, `„${de(f.t)}“ ist typisch für Zweikeimblättrige wie Bohne, Eiche und Sonnenblume.`) : tx(`"${en(f.t)}" is typical of monocots like grasses, maize and tulips.`, `„${de(f.t)}“ ist typisch für Einkeimblättrige wie Gräser, Mais und Tulpe.`));
  });
  return {
    instruction: tx("Features of the two groups", "Merkmale der beiden Gruppen"),
    text: askMono ? tx("Which features are typical of **monocots** (e.g. maize, tulip)? Select all that apply.", "Welche Merkmale sind typisch für **Einkeimblättrige** (z. B. Mais, Tulpe)? Wähle alle passenden aus.") : tx("Which features are typical of **dicots** (e.g. bean, oak)? Select all that apply.", "Welche Merkmale sind typisch für **Zweikeimblättrige** (z. B. Bohne, Eiche)? Wähle alle passenden aus."),
    answer,
    hint: tx("Monocots: one cotyledon, parallel veins, scattered closed bundles, parts in threes. Dicots: the opposite.", "Einkeimblättrige: ein Keimblatt, parallele Nerven, zerstreute geschlossene Bündel, Dreizahl. Zweikeimblättrige: das Gegenteil."),
    solution: [{ math: correct.map((i, k) => q(options[i], `c${k}`)).reduce((a, b) => join(a, "\\\\", b)), note: askMono ? tx("These belong to monocots.", "Diese gehören zu den Einkeimblättrigen.") : tx("These belong to dicots.", "Diese gehören zu den Zweikeimblättrigen."), highlight: correct.map((_, k) => `c${k}`) }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Statements

const TRUE3: Text[] = [
  tx("Collenchyma consists of living cells with walls thickened at the corners.", "Kollenchym besteht aus lebenden Zellen mit an den Kanten verdickten Wänden."),
  tx("The cambium makes wood inwards and bast outwards.", "Das Kambium bildet nach innen Holz und nach außen Bast."),
  tx("Monocots have no secondary growth with annual rings.", "Einkeimblättrige haben kein sekundäres Dickenwachstum mit Jahresringen."),
  tx("When a stoma opens, K⁺ ions flow into the guard cells first, then water follows.", "Beim Öffnen strömen zuerst K⁺-Ionen in die Schließzellen, dann folgt Wasser."),
  tx("Abscisic acid makes the stomata close during drought.", "Abscisinsäure lässt die Spaltöffnungen bei Trockenheit schließen."),
  tx("One annual ring consists of early wood and late wood.", "Ein Jahresring besteht aus Frühholz und Spätholz."),
  tx("Aerenchyma gives water plants buoyancy and oxygen.", "Aerenchym verschafft Wasserpflanzen Auftrieb und Sauerstoff."),
];
const MYTHS3: { text: Text; title: Text; say: Text }[] = [
  { text: tx("Sclerenchyma consists of living, stretchy cells.", "Sklerenchym besteht aus lebenden, dehnbaren Zellen."), title: tx("Dead and rigid", "Tot und starr"), say: tx("Sclerenchyma cells are mostly dead, with thick lignified walls: rigid, not stretchy. Living and stretchy is collenchyma.", "Sklerenchymzellen sind meist tot und haben dicke, verholzte Wände: starr, nicht dehnbar. Lebend und dehnbar ist das Kollenchym.") },
  { text: tx("Maize forms annual rings.", "Mais bildet Jahresringe."), title: tx("No cambium", "Kein Kambium"), say: tx("Maize is a monocot: closed bundles without cambium, so no secondary growth and no annual rings.", "Mais ist einkeimblättrig: geschlossene Leitbündel ohne Kambium, also kein Dickenwachstum und keine Jahresringe.") },
  { text: tx("Water is pumped into the guard cells, then the ions follow.", "Wasser wird in die Schließzellen gepumpt, dann folgen die Ionen."), title: tx("Water follows the ions", "Wasser folgt den Ionen"), say: tx("Cells can't pump water. The K⁺ ions move first; water follows by osmosis.", "Zellen können Wasser nicht pumpen. Erst wandern die K⁺-Ionen, dann folgt Wasser durch Osmose.") },
  { text: tx("Hygrophytes are plants that live in water.", "Hygrophyten sind Pflanzen, die im Wasser leben."), title: tx("Hygro ≠ hydro", "Hygro ≠ Hydro"), say: tx("Hygrophytes live in damp places; plants living in water are hydrophytes.", "Hygrophyten leben an feuchten Standorten; Pflanzen im Wasser heißen Hydrophyten.") },
  { text: tx("The cambium makes wood outwards and bast inwards.", "Das Kambium bildet nach außen Holz und nach innen Bast."), title: tx("The other way round", "Andersherum"), say: tx("Wood (secondary xylem) is inside, bast (secondary phloem) outside, just as xylem and phloem lie in the stem's bundles.", "Holz (sekundäres Xylem) liegt innen, Bast (sekundäres Phloem) außen, genau wie Xylem und Phloem im Leitbündel der Sprossachse.") },
  { text: tx("Abscisic acid opens the stomata.", "Abscisinsäure öffnet die Spaltöffnungen."), title: tx("A closing signal", "Ein Schließsignal"), say: tx("Abscisic acid is the drought hormone: it makes K⁺ and water leave the guard cells, so the pores close.", "Abscisinsäure ist das Trockenstresshormon: Sie lässt K⁺ und Wasser aus den Schließzellen strömen, die Spalten schließen sich.") },
  { text: tx("A light ring and a dark ring are two years.", "Ein heller und ein dunkler Ring sind zwei Jahre."), title: tx("One year, two bands", "Ein Jahr, zwei Bänder"), say: tx("Light early wood and dark late wood are formed in the same year: together they make one annual ring.", "Helles Frühholz und dunkles Spätholz entstehen im selben Jahr: Zusammen sind sie ein Jahresring.") },
];

function statementTask(rng: Rng): Exercise {
  const truth = rng.pick(TRUE3);
  const myths = rng.shuffle(MYTHS3).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: truth }, ...myths.map((m) => ({ text: m.text, title: m.title, say: m.say }))]);
  return {
    instruction: tx("Which statement is true?", "Welche Aussage stimmt?"),
    text: tx("Only one of these statements is right. Which one?", "Nur eine dieser Aussagen ist richtig. Welche?"),
    answer,
    hint: tx("Check each statement against the mechanism: living or dead, inside or outside, ions or water first?", "Prüf jede Aussage am Mechanismus: lebend oder tot, innen oder außen, erst Ionen oder erst Wasser?"),
    solution: [{ math: tx('"true:"#t', '"richtig:"#t'), note: truth, highlight: ["t"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  return pickTask(
    rng,
    [
      [2, (r) => tissueDescTask(r)],
      [1.5, tissuePicTask],
      [1, meristemTask],
      [1.5, (r) => ringCountTask(r)],
      [1, dryYearTask],
      [1, stemOrderTask],
      [1.2, earlyLateTask],
      [1.5, (r) => stomaOrderTask(r)],
      [2, scenarioTask],
      [1, densityTask],
      [1.5, (r) => featureTask(r)],
      [1, leafPicTask],
      [1.5, adaptWhyTask],
      [1, stemKindTask],
      [1, monoMultiTask],
      [1.2, statementTask],
    ],
    (r) => tissueDescTask(r),
  );
}

// ---------------------------------------------------------------------------
// Lesson

const tissueFrames: Frame[] = [
  {
    math: tx('"meristem"#b \\to "permanent tissue"#d', '"Bildungsgewebe"#b \\to "Dauergewebe"#d'),
    note: tx("Every cell of a plant comes from a **meristem**: small cells full of cytoplasm that keep dividing. Their daughter cells develop into specialised **permanent tissues**.", "Alle Zellen einer Pflanze stammen aus **Bildungsgeweben (Meristemen)**: kleinen, plasmareichen Zellen, die sich ständig teilen. Ihre Tochterzellen entwickeln sich zu spezialisierten **Dauergeweben**."),
  },
  {
    math: tx('"apical meristems:"#a \\; "shoot and root tip"#s', '"Apikalmeristeme:"#a \\; "Spross- und Wurzelspitze"#s'),
    note: tx("The **apical meristems** at the shoot and root tips make the plant grow **longer** (primary growth). The root tip is protected by the root cap.", "Die **Apikalmeristeme** (Vegetationspunkte) an Spross- und Wurzelspitze sorgen für das **Längenwachstum** (primäres Wachstum). Die Wurzelspitze schützt die Wurzelhaube."),
  },
  {
    math: tx('"cambium:"#k \\; "growth in thickness"#d', '"Kambium:"#k \\; "Dickenwachstum"#d'),
    note: tx("The **cambium** is a lateral meristem: it makes stem and root grow **thicker** (secondary growth).", "Das **Kambium** ist ein seitliches Bildungsgewebe: Es lässt Sprossachse und Wurzel in die **Dicke** wachsen (sekundäres Wachstum)."),
  },
  {
    math: tx('"permanent tissues:"#d \\\\ "ground"#g1 , "supporting"#g2 , \\\\ "dermal"#g3 , "vascular tissue"#g4', '"Dauergewebe:"#d \\\\ "Grund-"#g1 , "Festigungs-"#g2 , \\\\ "Abschluss-"#g3 , "Leitgewebe"#g4'),
    note: tx("Permanent tissues: **ground tissue** (parenchyma), **supporting tissue** (collenchyma, sclerenchyma), **dermal tissue** (epidermis, cork) and **vascular tissue** (xylem, phloem).", "Die Dauergewebe: **Grundgewebe** (Parenchym), **Festigungsgewebe** (Kollenchym, Sklerenchym), **Abschlussgewebe** (Epidermis, Kork) und **Leitgewebe** (Xylem, Phloem)."),
  },
  {
    math: tx('"collenchyma:"#k \\; "living, corners thickened"#e \\\\ "sclerenchyma:"#s \\; "dead, lignified"#v', '"Kollenchym:"#k \\; "lebend, Ecken verdickt"#e \\\\ "Sklerenchym:"#s \\; "tot, verholzt"#v'),
    note: tx("The two supporting tissues differ: **collenchyma** is alive and stretchy (growing organs), **sclerenchyma** is mostly dead, lignified and rigid (fully grown organs).", "Die beiden Festigungsgewebe unterscheiden sich: **Kollenchym** lebt und ist dehnbar (wachsende Organe), **Sklerenchym** ist meist tot, verholzt und starr (ausgewachsene Organe)."),
  },
];

const growthFrames: Frame[] = [
  {
    math: tx('"young dicot stem:"#j \\; "ring of bundles"#l', '"junger Spross:"#j \\; "Leitbündelring"#l'),
    note: tx("In a young dicot stem the vascular bundles form a ring. They are **open**: between xylem and phloem lies **fascicular cambium**.", "Im jungen Spross einer Zweikeimblättrigen liegen die Leitbündel in einem Ring. Sie sind **offen**: Zwischen Xylem und Phloem liegt **faszikuläres Kambium**."),
  },
  {
    math: tx('"fascicular"#f + "interfascicular"#i \\to "cambium ring"#r', '"faszikulär"#f + "interfaszikulär"#i \\to "Kambiumring"#r'),
    note: tx("Parenchyma cells between the bundles become **interfascicular cambium**. Together they form a closed **cambium ring**.", "Aus Parenchymzellen zwischen den Bündeln entsteht **interfaszikuläres Kambium**. Zusammen bilden sie einen geschlossenen **Kambiumring**."),
    highlight: ["r"],
  },
  {
    math: tx('"inwards:"#in \\; "wood (secondary xylem)"#h \\\\ "outwards:"#au \\; "bast (secondary phloem)"#b', '"nach innen:"#in \\; "Holz (sek. Xylem)"#h \\\\ "nach außen:"#au \\; "Bast (sek. Phloem)"#b'),
    note: tx("The cambium divides: **wood** (secondary xylem) forms inwards, **bast** (secondary phloem) outwards. Much more is made inwards than outwards.", "Das Kambium teilt sich: Nach innen entsteht **Holz** (sekundäres Xylem), nach außen **Bast** (sekundäres Phloem). Nach innen wird viel mehr gebildet als nach außen."),
  },
  {
    math: tx('"early wood"#f + "late wood"#s = "annual ring"#j', '"Frühholz"#f + "Spätholz"#s = "Jahresring"#j'),
    note: tx("In our climate the cambium rests in winter. In spring it makes **early wood** with wide, thin-walled vessels (lots of water for the new leaves), in summer **late wood** with narrow, thick-walled cells. The sharp border to the next early wood makes the **annual ring** visible.", "In unserem Klima ruht das Kambium im Winter. Im Frühjahr bildet es **Frühholz** mit weiten, dünnwandigen Gefäßen (viel Wasser für den Austrieb), im Sommer **Spätholz** mit engen, dickwandigen Zellen. Die scharfe Grenze zum nächsten Frühholz macht den **Jahresring** sichtbar."),
    highlight: ["j"],
  },
  {
    math: tx('"cork cambium"#k \\to "outer bark"#b', '"Korkkambium"#k \\to "Borke"#b'),
    note: tx("As the trunk thickens, the epidermis tears. A **cork cambium** makes cork; the dead tissue on the outside becomes the **outer bark**.", "Weil der Stamm dicker wird, reißt die Epidermis. Ein **Korkkambium** bildet Kork; das abgestorbene Gewebe außen wird zur **Borke**."),
  },
  {
    math: tx('"monocots:"#e \\; "no cambium"#k', '"Einkeimblättrige:"#e \\; "kein Kambium"#k'),
    note: tx("**Monocots** (grasses, maize, lilies) have scattered, **closed** bundles without cambium: no secondary growth, no annual rings. (Palms become thick in a different way.)", "**Einkeimblättrige** (Gräser, Mais, Lilien) haben zerstreute, **geschlossene** Leitbündel ohne Kambium: kein sekundäres Dickenwachstum, keine Jahresringe. (Palmen werden auf andere Weise dick.)"),
  },
];

const stomaFrames: Frame[] = [
  { math: tx('"light"#l \\to "proton pump"#p', '"Licht"#l \\to "Protonenpumpe"#p'), note: tx("Blue light switches on a **proton pump** (H⁺-ATPase) in the guard cell membrane. Using ATP, it pumps H⁺ ions out.", "Blaulicht schaltet in der Membran der Schließzellen eine **Protonenpumpe** (H⁺-ATPase) ein. Sie pumpt unter ATP-Verbrauch H⁺-Ionen hinaus.") },
  {
    math: tx('"light"#l \\to "proton pump"#p \\to "K⁺ flows in"#k', '"Licht"#l \\to "Protonenpumpe"#p \\to "K⁺ strömt ein"#k'),
    note: tx("The inside of the cell becomes more negative. **Potassium ions (K⁺)** flow in through channels, chloride ions with them, and malate is made from starch.", "Dadurch wird das Zellinnere negativer. **Kaliumionen (K⁺)** strömen durch Kanäle ein, dazu Chloridionen, und aus Stärke entsteht Malat."),
    highlight: ["k"],
  },
  {
    math: tx('"light"#l \\to "proton pump"#p \\to "K⁺ flows in"#k \\\\ \\to "water flows in (osmosis)"#w', '"Licht"#l \\to "Protonenpumpe"#p \\to "K⁺ strömt ein"#k \\\\ \\to "Osmose: Wasser strömt ein"#w'),
    note: tx("The concentration of dissolved particles in the vacuole rises. Water flows in from the neighbouring cells by **osmosis**.", "Die Konzentration gelöster Teilchen in der Vakuole steigt. Wasser strömt durch **Osmose** aus den Nachbarzellen nach."),
    highlight: ["w"],
  },
  {
    math: tx('"light"#l \\to "proton pump"#p \\to "K⁺ flows in"#k \\\\ \\to "water flows in (osmosis)"#w \\to "turgor rises"#t', '"Licht"#l \\to "Protonenpumpe"#p \\to "K⁺ strömt ein"#k \\\\ \\to "Osmose: Wasser strömt ein"#w \\to "Turgor steigt"#t'),
    note: tx("The **turgor** (pressure inside the cell) rises, the guard cells swell.", "Der **Turgor** (Zellinnendruck) steigt, die Schließzellen schwellen an."),
    highlight: ["t"],
  },
  {
    math: tx('"light"#l \\to "proton pump"#p \\to "K⁺ flows in"#k \\\\ \\to "water flows in (osmosis)"#w \\to "turgor rises"#t \\\\ \\to "pore opens"#o', '"Licht"#l \\to "Protonenpumpe"#p \\to "K⁺ strömt ein"#k \\\\ \\to "Osmose: Wasser strömt ein"#w \\to "Turgor steigt"#t \\\\ \\to "Spalt öffnet sich"#o'),
    note: tx("The wall along the pore is thicker and less stretchy, and cellulose fibres run out from the pore like rays. So the swelling guard cells bend outwards: the **pore opens**.", "Die Wand am Spalt ist dicker und weniger dehnbar, und Cellulosefasern laufen strahlenförmig vom Spalt weg. Darum krümmen sich die anschwellenden Schließzellen nach außen: Der **Spalt öffnet sich**."),
    highlight: ["o"],
  },
  {
    math: tx('"water shortage"#m \\to "abscisic acid"#a \\to "K⁺ flows out"#x', '"Wassermangel"#m \\to "Abscisinsäure"#a \\to "K⁺ strömt aus"#x'),
    note: tx("When water is short, the plant makes the hormone **abscisic acid (ABA)**. It opens channels: K⁺ and anions flow out, water follows, the turgor drops and the pore closes.", "Bei **Wassermangel** bildet die Pflanze das Hormon **Abscisinsäure (ABA)**. Sie öffnet Kanäle: K⁺ und Anionen strömen aus, Wasser folgt, der Turgor sinkt, und der Spalt schließt sich."),
  },
];

function oleanderCheck(): Exercise {
  const { answer, mistakes: list } = choice(createRng(17), [
    { text: tx("In a dry, sunny place: it's a xerophyte.", "An einem trockenen, sonnigen Standort: ein Xerophyt.") },
    { text: tx("In a damp, shady place: it's a hygrophyte.", "An einem feuchten, schattigen Standort: ein Hygrophyt."), title: tx("These features save water", "Diese Merkmale sparen Wasser"), say: tx("Hygrophytes promote transpiration with thin cuticles and raised stomata. Here everything works to save water.", "Hygrophyten fördern die Transpiration mit dünner Cuticula und emporgehobenen Spaltöffnungen. Hier dient alles dem Wassersparen.") },
    { text: tx("In water: it's a hydrophyte.", "Im Wasser: ein Hydrophyt."), title: tx("No air tissue", "Kein Luftgewebe"), say: tx("A water plant would have aerenchyma and hardly any cuticle. Thick wax and sunken stomata mean water is scarce.", "Eine Wasserpflanze hätte Aerenchym und kaum Cuticula. Dickes Wachs und eingesenkte Spaltöffnungen bedeuten: Wasser ist knapp.") },
    { text: tx("You can't tell from the leaf.", "Am Blatt kann man das nicht erkennen."), title: tx("The leaf tells a lot", "Das Blatt verrät viel"), say: tx("The build of the leaf is closely adapted to the habitat. Look at how water loss is reduced.", "Der Blattbau ist eng an den Standort angepasst. Achte darauf, wie der Wasserverlust verringert wird.") },
  ]);
  return {
    instruction: tx("Adaptation to the habitat", "Angepasstheit an den Standort"),
    text: tx("An oleander leaf has a thick cuticle, a multi-layered epidermis and stomata sunken in hairy pits. Where does the plant grow?", "Ein Oleanderblatt hat eine dicke Cuticula, eine mehrschichtige Epidermis und Spaltöffnungen in behaarten Gruben. Wo wächst die Pflanze?"),
    visual: visual(PlantAdaptLeaf, { kind: "xero", mode: "plain" }),
    answer,
    hint: tx("Do these features save water or help to lose it?", "Sparen diese Merkmale Wasser, oder helfen sie, es abzugeben?"),
    solution: [{ math: tx('"saves water"#s \\Rightarrow "xerophyte"#x', '"spart Wasser"#s \\Rightarrow "Xerophyt"#x'), note: tx("All three features reduce transpiration: a xerophyte from dry, sunny places (oleander grows around the Mediterranean).", "Alle drei Merkmale senken die Transpiration: ein Xerophyt trockener, sonniger Standorte (Oleander wächst am Mittelmeer)."), highlight: ["x"] }],
    mistakes: list,
  };
}

const checkTissue = tissueDescTask(createRng(9), 4);
const checkRings = ringCountTask(createRng(2), [1.1, 0.95, 1.05, 0.5, 0.95, 0.9, 0.85]);
const checkStoma = stomaOrderTask(createRng(13), "open");
const checkOleander = oleanderCheck();

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Tissues: division of labour", "Gewebe: Arbeitsteilung in der Pflanze"),
      blob: tx("A plant is a team of specialists. Let's meet them!", "Eine Pflanze ist ein Team aus Spezialisten. Lernen wir sie kennen!"),
      body: tx("Cells with the same build and the same job form a **tissue**. Plants have two big groups: meristems and permanent tissues.", "Zellen mit gleichem Bau und gleicher Aufgabe bilden ein **Gewebe**. Pflanzen haben zwei große Gruppen: Bildungsgewebe und Dauergewebe."),
      frames: tissueFrames,
    },
    {
      type: "widget",
      title: tx("Tissue atlas", "Gewebe-Atlas"),
      blob: tx("Six tissues under the microscope. Spot the differences!", "Sechs Gewebe unter dem Mikroskop. Finde die Unterschiede!"),
      body: tx("Tap a picture or a name. Look at the cell walls: thin, thickened at the corners, or thick all round?", "Tipp auf ein Bild oder einen Namen. Achte auf die Zellwände: dünn, an den Ecken verdickt oder rundum dick?"),
      widget: () => <PlantTissues mode="explore" />,
    },
    { type: "check", blob: tx("Two supporting tissues, one tricky question.", "Zwei Festigungsgewebe, eine knifflige Frage."), exercise: checkTissue },
    {
      type: "explain",
      title: tx("Secondary growth", "Sekundäres Dickenwachstum"),
      blob: tx("How does a thin shoot become a thick trunk?", "Wie wird aus einem dünnen Spross ein dicker Stamm?"),
      frames: growthFrames,
    },
    {
      type: "widget",
      title: tx("Let a tree grow", "Lass einen Baum wachsen"),
      blob: tx("Make some years dry and watch the rings!", "Mach ein paar Jahre trocken und beobachte die Ringe!"),
      body: tx("Slide to add years. Tap a year to make it dry. Compare with a monocot: does maize get any rings?", "Schieb den Regler, um Jahre hinzuzufügen. Tipp auf ein Jahr, um es trocken zu machen. Vergleiche mit einer Einkeimblättrigen: Bekommt Mais Ringe?"),
      widget: PlantRings,
    },
    { type: "check", blob: tx("Time to count. Careful with light and dark!", "Zeit zum Zählen. Vorsicht mit hell und dunkel!"), exercise: checkRings },
    {
      type: "explain",
      title: tx("How stomata open and close", "Wie Spaltöffnungen öffnen und schließen"),
      blob: tx("Ions first, water second. That's the whole trick!", "Erst die Ionen, dann das Wasser. Das ist der ganze Trick!"),
      frames: stomaFrames,
    },
    {
      type: "widget",
      title: tx("Guard cell lab", "Schließzellen-Labor"),
      blob: tx("Play both films: morning light and drought.", "Spiel beide Filme ab: Morgenlicht und Trockenheit."),
      body: tx("Step through the opening in light and the closing in drought. Watch the K⁺ ions, the water and the turgor.", "Geh Schritt für Schritt durch das Öffnen bei Licht und das Schließen bei Trockenheit. Beobachte die K⁺-Ionen, das Wasser und den Turgor."),
      widget: PlantStomaLab,
    },
    { type: "check", blob: tx("Now you put the steps in order.", "Jetzt bringst du die Schritte in Reihenfolge."), exercise: checkStoma },
    {
      type: "widget",
      title: tx("Adapted to dry and wet places", "Angepasst an trockene und nasse Standorte"),
      blob: tx("Desert, shady forest, pond, dune: four leaves, four strategies!", "Trocken, schattig-feucht, Teich, Düne: vier Blätter, vier Strategien!"),
      body: tx(
        "Leaves are a compromise: open stomata let carbon dioxide in, but water out. Depending on the habitat, plants shift the balance. Switch between the habitats and tap the numbers.",
        "Blätter sind ein Kompromiss: Offene Spaltöffnungen lassen Kohlenstoffdioxid hinein, aber auch Wasser hinaus. Je nach Standort verschieben Pflanzen das Gleichgewicht. Wechsle zwischen den Standorten und tipp auf die Nummern.",
      ),
      widget: PlantHabitats,
    },
    { type: "check", blob: tx("Read the leaf like a detective!", "Lies das Blatt wie ein Detektiv!"), exercise: checkOleander },
  ],
  summary: [
    {
      title: tx("Plant tissues", "Pflanzengewebe"),
      body: tx(
        "Meristems: apical meristems (growth in length), cambium (growth in thickness). Permanent tissues: ground (parenchyma), supporting (collenchyma: living, corners thickened; sclerenchyma: dead, lignified), dermal (epidermis, cork), vascular (xylem, phloem).",
        "Bildungsgewebe: Apikalmeristeme (Längenwachstum), Kambium (Dickenwachstum). Dauergewebe: Grundgewebe (Parenchym), Festigungsgewebe (Kollenchym: lebend, Ecken verdickt; Sklerenchym: tot, verholzt), Abschlussgewebe (Epidermis, Kork), Leitgewebe (Xylem, Phloem).",
      ),
      tone: "rule",
    },
    {
      title: tx("Secondary growth", "Sekundäres Dickenwachstum"),
      body: tx(
        "Fascicular and interfascicular cambium form a ring: wood (secondary xylem) inwards, bast (secondary phloem) outwards. Annual ring = early wood (wide, light) + late wood (narrow, dark). The cork cambium makes the outer bark.",
        "Faszikuläres und interfaszikuläres Kambium bilden einen Ring: nach innen Holz (sekundäres Xylem), nach außen Bast (sekundäres Phloem). Jahresring = Frühholz (weitlumig, hell) + Spätholz (englumig, dunkel). Das Korkkambium bildet die Borke.",
      ),
      examples: [tx('"bark" \\to "bast" \\to "cambium" \\to "wood" \\to "pith"', '"Borke" \\to "Bast" \\to "Kambium" \\to "Holz" \\to "Mark"')],
      tone: "rule",
    },
    {
      title: tx("Opening and closing the stomata", "Öffnen und Schließen der Spaltöffnungen"),
      body: tx(
        "Light: proton pump pushes H⁺ out, K⁺ flows in, water follows by osmosis, turgor rises, the guard cells bend apart (thick inner wall). Drought: abscisic acid makes K⁺ and water flow out, turgor drops, the pore closes.",
        "Licht: Protonenpumpe pumpt H⁺ hinaus, K⁺ strömt ein, Wasser folgt durch Osmose, der Turgor steigt, die Schließzellen krümmen sich (dicke Wand am Spalt). Trockenheit: Abscisinsäure lässt K⁺ und Wasser ausströmen, der Turgor sinkt, der Spalt schließt sich.",
      ),
      examples: [tx('"K⁺ in" \\to "water in" \\to "turgor" \\to "open"', '"K⁺ hinein" \\to "Wasser hinein" \\to "Turgor" \\to "offen"')],
      tone: "rule",
    },
    {
      title: tx("Adaptations", "Angepasstheit"),
      body: tx(
        "Xerophytes save water: thick cuticle, multi-layered epidermis, sunken stomata in hairy pits, rolled leaves, spines, water storage. Hygrophytes promote transpiration: thin leaves and cuticle, raised stomata, living hairs. Hydrophytes: aerenchyma, stomata on top of floating leaves, little supporting tissue and xylem.",
        "Xerophyten sparen Wasser: dicke Cuticula, mehrschichtige Epidermis, eingesenkte Spaltöffnungen in behaarten Gruben, Rollblätter, Dornen, Wasserspeicher. Hygrophyten fördern die Transpiration: dünne Blätter und Cuticula, emporgehobene Spaltöffnungen, lebende Haare. Hydrophyten: Aerenchym, Spaltöffnungen oben auf Schwimmblättern, wenig Festigungsgewebe und Xylem.",
      ),
      tone: "rule",
    },
    {
      title: tx("Monocot or dicot?", "Ein- oder zweikeimblättrig?"),
      body: tx(
        "Monocots: one cotyledon, parallel veins, scattered closed bundles (no cambium, no annual rings), flower parts in threes, fibrous roots. Dicots: two cotyledons, net veins, open bundles in a ring, parts in fours or fives, taproot.",
        "Einkeimblättrige: ein Keimblatt, parallelnervig, zerstreute geschlossene Leitbündel (kein Kambium, keine Jahresringe), Blütenteile in Dreizahl, Büschelwurzeln. Zweikeimblättrige: zwei Keimblätter, netznervig, offene Leitbündel im Ring, Vier- oder Fünfzahl, Hauptwurzel.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Water is never pumped: it follows the ions by osmosis. Hygro (damp) is not hydro (water). Collenchyma lives, sclerenchyma is mostly dead. Light plus dark band is one annual ring, not two.",
        "Wasser wird nie gepumpt: Es folgt den Ionen durch Osmose. Hygro (feucht) ist nicht Hydro (Wasser). Kollenchym lebt, Sklerenchym ist meist tot. Helles und dunkles Band sind zusammen ein Jahresring, nicht zwei.",
      ),
      tone: "warning",
    },
  ],
};
