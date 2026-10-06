"use client";

// Level 3 (Experte, Oberstufe): the chloroplast, absorption and action spectra (Engelmann),
// the light-dependent reactions (PS II with P680, photolysis, electron transport chain, PS I with
// P700, NADPH, proton gradient and ATP synthase: chemiosmosis), the Calvin cycle (fixation by
// Rubisco, reduction, regeneration; 6 CO2, 18 ATP, 12 NADPH per glucose) and C4 / CAM plants.

import { tx, type Text } from "@/i18n/text";
import { CHLORO_PARTS, PhotoChloroplast, PhotoChloroplastExplore } from "@/learn/biology/visuals/PhotoChloroplast";
import { PhotoC4Cam } from "@/learn/biology/visuals/PhotoC4Cam";
import { PhotoCalvin, PhotoCalvinGraph } from "@/learn/biology/visuals/PhotoCalvin";
import { PhotoEngelmann, PhotoSpectraGraph } from "@/learn/biology/visuals/PhotoSpectrum";
import { PhotoThylakoid, PhotoThylakoidFigure, THYLAKOID_PARTS } from "@/learn/biology/visuals/PhotoThylakoid";
import type { FigurePart } from "@/learn/biology/Figure";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { cap, choice, de, en, mistakes, multi, q, reasonFrames, some, visual, type MultiOpt, type Opt } from "./kit";


// ---------------------------------------------------------------------------
// 1. Where does it happen?

type Place = "mem" | "lumen" | "stroma" | "ims";
const PLACE: Record<Place, Text> = {
  mem: tx("Thylakoid membrane", "Thylakoidmembran"),
  lumen: tx("Thylakoid lumen", "Thylakoidinnenraum (Lumen)"),
  stroma: tx("Stroma", "Stroma"),
  ims: tx("Space between the two envelope membranes", "Raum zwischen den beiden Hüllmembranen"),
};
const PLACE_SHORT: Record<Place, Text> = {
  mem: tx("membrane", "Membran"),
  lumen: tx("lumen", "Lumen"),
  stroma: "Stroma",
  ims: tx("envelope", "Hülle"),
};

type Loc = { what: Text; at: Place; why: Text; say?: Partial<Record<Place, Text>> };
const LOCS: Loc[] = [
  { what: tx("Where are photosystems I and II located?", "Wo befinden sich die Fotosysteme I und II?"), at: "mem", why: tx("They are large protein-pigment complexes built into the thylakoid membrane.", "Sie sind große Protein-Pigment-Komplexe, die in die Thylakoidmembran eingebaut sind."), say: { stroma: tx("The Calvin cycle runs in the stroma, but the photosystems are membrane complexes.", "Im Stroma läuft der Calvin-Zyklus, die Fotosysteme sind aber Membrankomplexe.") } },
  { what: tx("Where are chlorophyll and the other pigments found?", "Wo liegen das Chlorophyll und die anderen Pigmente?"), at: "mem", why: tx("The pigments sit in the antenna complexes of the thylakoid membrane.", "Die Pigmente sitzen in den Antennenkomplexen der Thylakoidmembran.") },
  { what: tx("Where is ATP synthase anchored?", "Wo ist die ATP-Synthase verankert?"), at: "mem", why: tx("It spans the thylakoid membrane: the protons flow through it from the lumen to the stroma.", "Sie durchspannt die Thylakoidmembran: Die Protonen strömen durch sie vom Lumen ins Stroma.") },
  {
    what: tx("Where do protons pile up in the light?", "Wo reichern sich im Licht Protonen an?"),
    at: "lumen",
    why: tx("Photolysis and plastoquinone release protons into the thylakoid lumen: its pH falls to about 5.", "Fotolyse und Plastochinon geben Protonen in den Thylakoidinnenraum ab: Sein pH sinkt auf etwa 5."),
    say: {
      stroma: tx("The other way round: protons are taken **out** of the stroma, its pH rises to about 8.", "Andersherum: Dem Stroma werden Protonen **entzogen**, sein pH steigt auf etwa 8."),
      ims: tx("You're thinking of mitochondria: there protons go into the intermembrane space. In chloroplasts they go into the thylakoid lumen.", "Du denkst an Mitochondrien: Dort gelangen die Protonen in den Intermembranraum. Im Chloroplasten landen sie im Thylakoidinnenraum."),
    },
  },
  { what: tx("Where is the pH about 5 in the light?", "Wo liegt der pH-Wert im Licht bei etwa 5?"), at: "lumen", why: tx("Low pH means many protons: they are pumped into the lumen.", "Niedriger pH heißt viele Protonen: Sie werden ins Lumen gepumpt."), say: { stroma: tx("The stroma becomes **alkaline** (pH about 8): protons are taken out of it.", "Das Stroma wird **basisch** (pH etwa 8): Ihm werden Protonen entzogen.") } },
  { what: tx("Where does plastocyanin carry the electrons?", "Wo transportiert Plastocyanin die Elektronen?"), at: "lumen", why: tx("Plastocyanin is a small soluble protein on the lumen side, between cytochrome b₆f and PS I.", "Plastocyanin ist ein kleines lösliches Protein auf der Lumenseite, zwischen Cytochrom-b₆f und PS I.") },
  { what: tx("Where is NADPH formed?", "Wo entsteht NADPH?"), at: "stroma", why: tx("The NADP⁺ reductase sits on the stroma side and releases NADPH into the stroma, where the Calvin cycle needs it.", "Die NADP⁺-Reduktase sitzt auf der Stromaseite und gibt NADPH ins Stroma ab, wo der Calvin-Zyklus es braucht."), say: { lumen: tx("NADPH is needed by the Calvin cycle in the stroma. It's formed right there, on the stroma side of the membrane.", "NADPH braucht der Calvin-Zyklus im Stroma. Es entsteht genau dort, auf der Stromaseite der Membran.") } },
  { what: tx("Where is ATP released by ATP synthase?", "Wohin gibt die ATP-Synthase das ATP ab?"), at: "stroma", why: tx("The head of ATP synthase (CF₁) points into the stroma. ATP is made where the protons flow out.", "Der Kopf der ATP-Synthase (CF₁) ragt ins Stroma. ATP entsteht dort, wo die Protonen ausströmen."), say: { lumen: tx("The protons flow **from** the lumen. ATP is formed on the other side, in the stroma.", "Die Protonen strömen **aus** dem Lumen. ATP entsteht auf der anderen Seite, im Stroma.") } },
  { what: tx("Where does the Calvin cycle take place?", "Wo läuft der Calvin-Zyklus ab?"), at: "stroma", why: tx("The enzymes of the Calvin cycle, Rubisco among them, are dissolved in the stroma.", "Die Enzyme des Calvin-Zyklus, darunter Rubisco, liegen gelöst im Stroma."), say: { mem: tx("The membrane hosts the light reactions. The Calvin cycle uses their products in the stroma.", "In der Membran laufen die Lichtreaktionen. Der Calvin-Zyklus nutzt ihre Produkte im Stroma.") } },
  { what: tx("Where is the enzyme Rubisco found?", "Wo findet man das Enzym Rubisco?"), at: "stroma", why: tx("Rubisco is the most abundant protein on Earth and lies dissolved in the stroma.", "Rubisco ist das häufigste Protein der Erde und liegt gelöst im Stroma.") },
  { what: tx("Where does ferredoxin pass on its electrons?", "Wo gibt Ferredoxin seine Elektronen weiter?"), at: "stroma", why: tx("Ferredoxin is a small iron-sulfur protein on the stroma side of PS I.", "Ferredoxin ist ein kleines Eisen-Schwefel-Protein auf der Stromaseite von PS I.") },
];

function locTask(rng: Rng): Exercise {
  const l = rng.pick(LOCS);
  const others = (["mem", "lumen", "stroma", "ims"] as Place[]).filter((p) => p !== l.at);
  const generic: Record<Place, Text> = {
    mem: tx("In the membrane sit the complexes (photosystems, carriers, ATP synthase). Is this a membrane complex?", "In der Membran sitzen die Komplexe (Fotosysteme, Überträger, ATP-Synthase). Ist das hier ein Membrankomplex?"),
    lumen: tx("The lumen is the space **inside** the thylakoids, where protons collect.", "Das Lumen ist der Raum **in** den Thylakoiden, wo sich Protonen sammeln."),
    stroma: tx("The stroma is the fluid around the thylakoids, home of the Calvin cycle.", "Das Stroma ist die Flüssigkeit um die Thylakoide, der Ort des Calvin-Zyklus."),
    ims: tx("The envelope only surrounds the chloroplast. Photosynthesis happens inside, at and around the thylakoids.", "Die Hülle umgibt nur den Chloroplasten. Die Fotosynthese läuft im Inneren, an und um die Thylakoide."),
  };
  const { answer, mistakes: list } = choice(rng, [{ text: PLACE[l.at] }, ...others.map((p) => ({ text: PLACE[p], title: tx("Another compartment", "Ein anderer Raum"), say: l.say?.[p] ?? generic[p] }))]);
  return {
    instruction: tx("Where in the chloroplast?", "Wo im Chloroplasten?"),
    text: l.what,
    visual: visual(PhotoChloroplast, { mode: "plain" }),
    answer,
    hint: tx("Light reactions: in and at the thylakoid membrane. Protons collect in the lumen. Calvin cycle: in the stroma.", "Lichtreaktionen: in und an der Thylakoidmembran. Protonen sammeln sich im Lumen. Calvin-Zyklus: im Stroma."),
    solution: reasonFrames(PLACE_SHORT[l.at], l.why, PLACE[l.at], tx(`So: **${en(PLACE[l.at]).toLowerCase()}**.`, `Also: **${de(PLACE[l.at])}**.`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 2. Name the structure (chloroplast or thylakoid membrane)

function structureTask(rng: Rng): Exercise {
  const thyl = rng.chance(0.5);
  const parts: FigurePart[] = thyl ? THYLAKOID_PARTS.filter((p) => p.id !== "lumen" && p.id !== "stroma") : CHLORO_PARTS;
  const target = rng.pick(parts);
  const confuse: Record<string, string[]> = {
    ps2: ["ps1"],
    ps1: ["ps2"],
    pq: ["pc"],
    pc: ["pq", "fd"],
    fd: ["pc"],
    granum: ["thylakoid", "lamella"],
    thylakoid: ["granum"],
    lamella: ["granum"],
    inner: ["outer"],
    outer: ["inner"],
  };
  const pool = parts.filter((p) => p.id !== target.id);
  const preferred = (confuse[target.id] ?? []).map((id) => pool.find((p) => p.id === id)!).filter(Boolean);
  const wrong = [...preferred, ...rng.shuffle(pool.filter((p) => !preferred.includes(p)))].slice(0, 3);
  const special: Record<string, Text> = {
    "ps2>ps1": tx("PS I comes second in the chain. The one marked takes its electrons from water: that's where the chain starts.", "PS I kommt in der Kette erst als Zweites. Das markierte holt sich seine Elektronen aus Wasser: Dort beginnt die Kette."),
    "ps1>ps2": tx("PS II sits at the start, next to the water splitting. The marked one passes electrons to ferredoxin.", "PS II steht am Anfang, neben der Wasserspaltung. Das markierte gibt Elektronen an Ferredoxin weiter."),
    "pq>pc": tx("Plastocyanin is in the lumen. The marked carrier moves **inside** the membrane.", "Plastocyanin liegt im Lumen. Der markierte Überträger bewegt sich **in** der Membran."),
    "pc>pq": tx("Plastoquinone moves inside the membrane. The marked carrier is a small protein in the **lumen**.", "Plastochinon bewegt sich in der Membran. Der markierte Überträger ist ein kleines Protein im **Lumen**."),
    "granum>thylakoid": tx("Close! A single disc is a thylakoid; the whole **stack** has its own name.", "Knapp! Eine einzelne Scheibe ist ein Thylakoid, der ganze **Stapel** hat einen eigenen Namen."),
    "inner>outer": tx("The chloroplast has two envelope membranes. The marked one is the **inner** one.", "Der Chloroplast hat zwei Hüllmembranen. Markiert ist die **innere**."),
    "outer>inner": tx("The chloroplast has two envelope membranes. The marked one is the **outer** one.", "Der Chloroplast hat zwei Hüllmembranen. Markiert ist die **äußere**."),
  };
  const { answer, mistakes: list } = choice(rng, [
    { text: target.label },
    ...wrong.map((w) => ({ text: w.label, title: tx("Another structure", "Eine andere Struktur"), say: special[`${target.id}>${w.id}`] ?? tx(`${cap(en(w.label))}: ${en(w.info!).charAt(0).toLowerCase()}${en(w.info!).slice(1)} Look again where the **?** points.`, `${de(w.label)}: ${de(w.info!)} Schau noch mal, worauf das **?** zeigt.`) })),
  ]);
  return {
    instruction: thyl ? tx("The thylakoid membrane", "Die Thylakoidmembran") : tx("The chloroplast", "Der Chloroplast"),
    text: thyl ? tx("Name the structure marked with **?** in the thylakoid membrane.", "Benenne die mit **?** markierte Struktur der Thylakoidmembran.") : tx("Name the structure of the chloroplast marked with **?**.", "Benenne die mit **?** markierte Struktur des Chloroplasten."),
    visual: thyl ? visual(PhotoThylakoidFigure, { mode: "numbers", ask: target.id, legend: "none" }) : visual(PhotoChloroplast, { mode: "numbers", ask: target.id, legend: "none" }),
    answer,
    hint: thyl
      ? tx("Electron path from left to right: PS II, plastoquinone, cytochrome b₆f, plastocyanin, PS I, ferredoxin, NADP⁺ reductase. ATP synthase on its own.", "Elektronenweg von links nach rechts: PS II, Plastochinon, Cytochrom-b₆f, Plastocyanin, PS I, Ferredoxin, NADP⁺-Reduktase. Die ATP-Synthase steht für sich.")
      : tx("Double membrane outside, stroma inside, thylakoids stacked into grana.", "Außen die Doppelmembran, innen das Stroma, die Thylakoide zu Grana gestapelt."),
    solution: [{ math: q(target.label, "n"), note: tx(`**${cap(en(target.label))}**. ${en(target.info!)}`, `**${de(target.label)}**. ${de(target.info!)}`), highlight: ["n"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 3. The electron transport chain in order

const CHAIN: Text[] = [
  tx("Water (H₂O)", "Wasser (H₂O)"),
  tx("Photosystem II (P680)", "Fotosystem II (P680)"),
  tx("Plastoquinone", "Plastochinon"),
  tx("Cytochrome b₆f complex", "Cytochrom-b₆f-Komplex"),
  tx("Plastocyanin (copper protein)", "Plastocyanin (Kupferprotein)"),
  tx("Photosystem I (P700)", "Fotosystem I (P700)"),
  tx("Ferredoxin (iron-sulfur protein)", "Ferredoxin (Eisen-Schwefel-Protein)"),
  tx("NADP⁺", "NADP⁺"),
];

function chainTask(rng: Rng, keep?: number[]): Exercise {
  let idx = keep;
  if (!idx) {
    const n = rng.int(4, 6);
    do idx = some(rng, [0, 1, 2, 3, 4, 5, 6, 7], n).sort((a, b) => a - b);
    while (!idx.includes(1) && !idx.includes(5));
  }
  const items = idx.map((i) => CHAIN[i]);
  const has = (i: number) => idx.includes(i);
  const m: Mistake[] = [];
  if (has(1) && has(5))
    m.push({ when: { kind: "order", items: [CHAIN[5], CHAIN[1]] }, title: tx("Numbered by discovery", "Nach Entdeckung nummeriert"), say: tx("The classic trap! The photosystems are numbered in the order they were **discovered**. Electrons pass through PS II first, then PS I.", "Die klassische Falle! Die Fotosysteme sind in der Reihenfolge ihrer **Entdeckung** nummeriert. Die Elektronen durchlaufen erst PS II, dann PS I.") });
  if (has(2) && has(4))
    m.push({ when: { kind: "order", items: [CHAIN[4], CHAIN[2]] }, title: tx("PQ before PC", "Erst PQ, dann PC"), say: tx("Plastoquinone takes the electrons straight from PS II inside the membrane. Plastocyanin comes later, on the lumen side before PS I.", "Plastochinon übernimmt die Elektronen direkt von PS II in der Membran. Plastocyanin kommt später, auf der Lumenseite vor PS I.") });
  if (has(6) && has(7)) m.push({ when: { kind: "order", items: [CHAIN[7], CHAIN[6]] }, title: tx("NADP⁺ is the end", "NADP⁺ ist das Ende"), say: tx("NADP⁺ is the final electron acceptor. Ferredoxin brings the electrons to it.", "NADP⁺ ist der letzte Elektronenakzeptor. Ferredoxin bringt die Elektronen dorthin.") });
  if (has(0) && idx.length > 1) m.push({ when: { kind: "order", items: [CHAIN[idx[1]], CHAIN[0]] }, title: tx("Water is the source", "Wasser ist die Quelle"), say: tx("Water is where the electrons **come from** (photolysis at PS II). It stands at the very beginning.", "Aus Wasser **stammen** die Elektronen (Fotolyse am PS II). Es steht ganz am Anfang.") });
  const chainMath = (list: number[]): Text => list.map((i, k) => `${k ? "\\to " : ""}\\text{${["H₂O", "PS II", "PQ", "Cyt b₆f", "PC", "PS I", "Fd", "NADP⁺"][i]}}#c${i}`).join(" ");
  return {
    instruction: tx("The way of the electrons", "Der Weg der Elektronen"),
    text: tx("Put the stations in the order in which the electrons pass them (non-cyclic electron transport).", "Ordne die Stationen in der Reihenfolge, in der die Elektronen sie durchlaufen (nichtzyklischer Elektronentransport)."),
    answer: { kind: "order", items },
    hint: tx("The electrons come from water and end on NADP⁺. In between, light lifts them twice: at PS II and at PS I.", "Die Elektronen kommen aus dem Wasser und landen auf NADP⁺. Dazwischen hebt Licht sie zweimal an: an PS II und an PS I."),
    solution: [
      { math: chainMath([0, 1, 2, 3]), note: tx("From water to PS II (P680), then via plastoquinone to the cytochrome b₆f complex.", "Vom Wasser zum PS II (P680), dann über Plastochinon zum Cytochrom-b₆f-Komplex.") },
      { math: chainMath([0, 1, 2, 3, 4, 5, 6, 7]), note: tx("Then plastocyanin, PS I (P700), ferredoxin and finally NADP⁺. This is the Z-scheme.", "Dann Plastocyanin, PS I (P700), Ferredoxin und zum Schluss NADP⁺. Das ist das Z-Schema.") },
    ],
    mistakes: m,
  };
}

// ---------------------------------------------------------------------------
// 4. Counting in the Calvin cycle

function calvinNumTask(rng: Rng, fixed?: { kind: number; n: number }): Exercise {
  const kind = fixed?.kind ?? rng.int(0, 6);
  const n = fixed?.n ?? rng.int(2, 8);
  const pl = (k: number, one: string, many: string) => (k === 1 ? one : many);
  let ask: Text;
  let value: number;
  let unit: Text;
  let calc: string;
  let note: Text;
  const m = { list: [] as Mistake[] };
  const add = (v: number, title: Text, say: Text) => {
    if (v !== value && !m.list.some((x) => x.when.kind === "number" && x.when.value === v)) m.list.push({ when: { kind: "number", value: v }, title, say });
  };
  switch (kind) {
    case 0:
      value = 18 * n;
      unit = "ATP";
      ask = tx(`How many ATP does the Calvin cycle use to make ${n} glucose molecules?`, `Wie viele ATP verbraucht der Calvin-Zyklus, um ${n} Glucose-Moleküle herzustellen?`);
      calc = `${n} \\cdot 18 = ${value}`;
      note = tx("Per glucose: 12 ATP for the reduction and 6 ATP for the regeneration, so 18.", "Pro Glucose: 12 ATP für die Reduktion und 6 ATP für die Regeneration, also 18.");
      add(12 * n, tx("Regeneration forgotten", "Regeneration vergessen"), tx("12 ATP per glucose covers only the reduction. Rebuilding RuBP costs another 6 ATP per glucose.", "12 ATP pro Glucose decken nur die Reduktion ab. Das Regenerieren von RuBP kostet pro Glucose weitere 6 ATP."));
      add(9 * n, tx("Per 3 CO₂", "Pro 3 CO₂"), tx("9 ATP is the cost of one turn with 3 CO₂ (one G3P). A glucose needs 6 CO₂.", "9 ATP kostet eine Runde mit 3 CO₂ (ein GAP). Eine Glucose braucht 6 CO₂."));
      break;
    case 1:
      value = 12 * n;
      unit = "NADPH";
      ask = tx(`How many NADPH does the Calvin cycle use to make ${n} glucose molecules?`, `Wie viele NADPH verbraucht der Calvin-Zyklus für ${n} Glucose-Moleküle?`);
      calc = `${n} \\cdot 12 = ${value}`;
      note = tx("NADPH is only used in the reduction: one per 3-PG, 12 per glucose.", "NADPH wird nur bei der Reduktion gebraucht: eins pro 3-PG, 12 pro Glucose.");
      add(18 * n, tx("That's the ATP", "Das ist das ATP"), tx("18 per glucose is the ATP. NADPH is only used in the reduction phase.", "18 pro Glucose ist das ATP. NADPH wird nur in der Reduktionsphase verbraucht."));
      add(6 * n, tx("Per 3 CO₂", "Pro 3 CO₂"), tx("6 NADPH is one turn with 3 CO₂. A glucose needs 6 CO₂, so twice as much.", "6 NADPH braucht eine Runde mit 3 CO₂. Eine Glucose braucht 6 CO₂, also doppelt so viel."));
      break;
    case 2:
      value = 6 * n;
      unit = "CO₂";
      ask = tx(`How many CO₂ molecules have to be fixed for ${n} glucose molecules?`, `Wie viele CO₂-Moleküle müssen für ${n} Glucose-Moleküle fixiert werden?`);
      calc = `${n} \\cdot 6 = ${value}`;
      note = tx("Glucose has 6 C atoms, and each fixed CO₂ brings one.", "Glucose hat 6 C-Atome, jedes fixierte CO₂ bringt eins mit.");
      add(3 * n, tx("That's one G3P", "Das ist ein GAP"), tx("3 CO₂ give one G3P (3 C). Glucose has 6 C.", "3 CO₂ ergeben ein GAP (3 C). Glucose hat 6 C."));
      add(n, tx("Factor missing", "Faktor fehlt"), tx("One CO₂ brings only one carbon atom. Glucose has six.", "Ein CO₂ bringt nur ein Kohlenstoffatom mit. Glucose hat sechs."));
      break;
    case 3: {
      const co2 = 3 * n;
      value = 2 * co2;
      unit = "3-PG";
      ask = tx(`Rubisco fixes ${co2} CO₂ molecules. How many molecules of 3-phosphoglycerate (3-PG) are formed?`, `Rubisco fixiert ${co2} CO₂-Moleküle. Wie viele Moleküle 3-Phosphoglycerat (3-PG) entstehen?`);
      calc = `${co2} \\cdot 2 = ${value}`;
      note = tx("Each CO₂ + RuBP gives an unstable C₆ that splits into **two** 3-PG.", "Jedes CO₂ + RuBP ergibt ein instabiles C₆, das in **zwei** 3-PG zerfällt.");
      add(co2, tx("It splits in two", "Es zerfällt in zwei"), tx("CO₂ + RuBP (5 C) gives 6 C, which splits into **two** C₃ molecules.", "CO₂ + RuBP (5 C) ergibt 6 C, das in **zwei** C₃-Moleküle zerfällt."));
      break;
    }
    case 4: {
      value = 9 * n;
      unit = "ATP";
      ask = tx(`The Calvin cycle exports ${n} ${pl(n, "molecule", "molecules")} of G3P. How many ATP did that cost?`, `Der Calvin-Zyklus gibt ${n} ${pl(n, "Molekül", "Moleküle")} GAP ab. Wie viele ATP hat das gekostet?`);
      calc = `${n} \\cdot 9 = ${value}`;
      note = tx("Per exported G3P: 3 CO₂, 6 ATP for the reduction and 3 ATP for the regeneration, so 9 ATP.", "Pro abgegebenem GAP: 3 CO₂, 6 ATP für die Reduktion und 3 ATP für die Regeneration, also 9 ATP.");
      add(6 * n, tx("Regeneration forgotten", "Regeneration vergessen"), tx("6 ATP per G3P only pays for the reduction. Regenerating RuBP needs 3 more.", "6 ATP pro GAP bezahlen nur die Reduktion. Die Regeneration von RuBP braucht 3 weitere."));
      add(18 * n, tx("That's per glucose", "Das gilt pro Glucose"), tx("18 ATP is the cost of a whole glucose (two G3P).", "18 ATP kostet eine ganze Glucose (zwei GAP)."));
      break;
    }
    case 5:
      value = 12 * n;
      unit = "H₂O";
      ask = tx(`How many water molecules must be split to supply the NADPH for ${n} glucose molecules?`, `Wie viele Wassermoleküle müssen gespalten werden, um das NADPH für ${n} Glucose-Moleküle zu liefern?`);
      calc = `${n} \\cdot 12 = ${value}`;
      note = tx("Per glucose 12 NADPH, so 24 electrons. Each water molecule gives 2 electrons: 12 H₂O.", "Pro Glucose 12 NADPH, also 24 Elektronen. Jedes Wassermolekül liefert 2 Elektronen: 12 H₂O.");
      add(6 * n, tx("The overall equation tricks you", "Die Summengleichung täuscht"), tx("The short equation shows 6 H₂O, but 6 H₂O are formed again. Split are 12 H₂O per glucose: 24 electrons for 12 NADPH.", "Die kurze Gleichung zeigt 6 H₂O, es entstehen aber auch 6 H₂O neu. Gespalten werden 12 H₂O pro Glucose: 24 Elektronen für 12 NADPH."));
      add(24 * n, tx("Two electrons per water", "Zwei Elektronen pro Wasser"), tx("24 is the number of electrons. Each water molecule gives two.", "24 ist die Zahl der Elektronen. Jedes Wassermolekül liefert zwei."));
      break;
    default:
      value = 6 * n;
      unit = "O₂";
      ask = tx(`How many O₂ molecules are released while the light reactions supply the NADPH for ${n} glucose molecules?`, `Wie viele O₂-Moleküle werden frei, während die Lichtreaktionen das NADPH für ${n} Glucose-Moleküle liefern?`);
      calc = `${n} \\cdot 6 = ${value}`;
      note = tx("12 NADPH need 12 H₂O to be split, and 2 H₂O give 1 O₂: 6 O₂ per glucose.", "12 NADPH erfordern die Spaltung von 12 H₂O, und 2 H₂O ergeben 1 O₂: 6 O₂ pro Glucose.");
      add(12 * n, tx("Two waters per O₂", "Zwei Wasser pro O₂"), tx("12 H₂O are split, right, but it takes **two** water molecules for one O₂.", "12 H₂O werden gespalten, stimmt, aber für ein O₂ braucht es **zwei** Wassermoleküle."));
      add(3 * n, tx("Halved twice", "Zweimal halbiert"), tx("Per glucose 6 O₂ are released, as in the overall equation.", "Pro Glucose werden 6 O₂ frei, wie in der Summengleichung."));
      break;
  }
  return {
    instruction: tx("Calvin cycle balance", "Bilanz des Calvin-Zyklus"),
    text: ask,
    answer: { kind: "number", value, unit },
    hint: tx("Per glucose: 6 CO₂, 18 ATP, 12 NADPH. Per G3P: 3 CO₂, 9 ATP, 6 NADPH.", "Pro Glucose: 6 CO₂, 18 ATP, 12 NADPH. Pro GAP: 3 CO₂, 9 ATP, 6 NADPH."),
    solution: [
      { math: tx('"per glucose:" \\; 6 \\ce{CO2} , \\; 18 \\ce{ATP} , \\; 12 \\ce{NADPH}', '"pro Glucose:" \\; 6 \\ce{CO2} , \\; 18 \\ce{ATP} , \\; 12 \\ce{NADPH}'), note },
      { math: `${calc.replace(/= (\d+)$/, "= \\blob{$1#v}")}`, note: tx(`So **${value}**.`, `Also **${value}**.`), highlight: ["v"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 5. Light off / CO2 off: interpreting the classic graph

type Ev = "dark" | "noco2";
type Mol = "rubp" | "pg";
const REASON: Record<`${Ev}-${Mol}`, { rises: boolean; right: Text; wrong: Text }> = {
  "dark-rubp": {
    rises: false,
    right: tx("fixation still uses up RuBP, but regenerating it needs ATP, which runs out", "die Fixierung verbraucht weiter RuBP, die Regeneration braucht aber ATP, das ausgeht"),
    wrong: tx("without light Rubisco stops at once, so RuBP piles up", "ohne Licht stoppt Rubisco sofort, deshalb staut sich RuBP"),
  },
  "dark-pg": {
    rises: true,
    right: tx("3-PG is still formed, but reducing it needs ATP and NADPH, which run out", "3-PG entsteht weiter, seine Reduktion braucht aber ATP und NADPH, die ausgehen"),
    wrong: tx("without light no CO₂ can be fixed, so 3-PG disappears", "ohne Licht kann kein CO₂ fixiert werden, deshalb verschwindet 3-PG"),
  },
  "noco2-rubp": {
    rises: true,
    right: tx("RuBP is still regenerated, but no longer used up by fixation", "RuBP wird weiter regeneriert, aber nicht mehr durch die Fixierung verbraucht"),
    wrong: tx("without CO₂ no RuBP can be regenerated", "ohne CO₂ kann kein RuBP regeneriert werden"),
  },
  "noco2-pg": {
    rises: false,
    right: tx("no new 3-PG is formed, but the existing 3-PG is still reduced", "es entsteht kein neues 3-PG mehr, das vorhandene wird aber weiter reduziert"),
    wrong: tx("3-PG piles up because it has no CO₂ to react with", "3-PG staut sich, weil es kein CO₂ zum Reagieren hat"),
  },
};
const MOL_NAME: Record<Mol, Text> = { rubp: tx("RuBP", "RuBP"), pg: tx("3-PG", "3-PG") };

function calvinGraphTask(rng: Rng, fixed?: { ev: Ev; mol: Mol; risingLabel: "A" | "B" }): Exercise {
  const ev = fixed?.ev ?? rng.pick<Ev>(["dark", "noco2"]);
  const mol = fixed?.mol ?? rng.pick<Mol>(["rubp", "pg"]);
  const risingLabel = fixed?.risingLabel ?? rng.pick<"A" | "B">(["A", "B"]);
  const r = REASON[`${ev}-${mol}`];
  const rightCurve = r.rises ? risingLabel : risingLabel === "A" ? "B" : "A";
  const otherCurve = rightCurve === "A" ? "B" : "A";
  const opt = (c: string, why: Text): Text => tx(`Curve ${c}, because ${en(why)}.`, `Kurve ${c}, denn ${de(why)}.`);
  const { answer, mistakes: list } = choice(rng, [
    { text: opt(rightCurve, r.right) },
    {
      text: opt(otherCurve, r.wrong),
      title: ev === "dark" ? tx("It needs the light products", "Es braucht die Lichtprodukte") : tx("Think about who uses what", "Überleg, wer was verbraucht"),
      say:
        ev === "dark"
          ? tx("Rubisco itself doesn't need light, so fixation goes on for a moment. What stops is everything that needs **ATP and NADPH** from the light reactions.", "Rubisco selbst braucht kein Licht, die Fixierung läuft also kurz weiter. Was stoppt, ist alles, was **ATP und NADPH** aus den Lichtreaktionen braucht.")
          : tx("Without CO₂ only the fixation stops. Reduction and regeneration still have ATP and NADPH and keep running.", "Ohne CO₂ stoppt nur die Fixierung. Reduktion und Regeneration haben weiter ATP und NADPH und laufen weiter."),
    },
    { text: opt(rightCurve, r.wrong), title: tx("Right curve, wrong reason", "Richtige Kurve, falscher Grund"), say: tx("The curve is right, but check the reason: which step of the cycle stops, and which keeps going?", "Die Kurve stimmt, aber prüf die Begründung: Welcher Schritt des Zyklus stoppt, welcher läuft weiter?") },
    { text: opt(otherCurve, r.right), title: tx("Reason and curve don't match", "Grund und Kurve passen nicht"), say: tx(`Your reason is good, but it means the concentration ${r.rises ? "rises" : "falls"}. Which curve does that?`, `Dein Grund ist gut, aber er bedeutet, dass die Konzentration ${r.rises ? "steigt" : "sinkt"}. Welche Kurve tut das?`) },
  ]);
  return {
    instruction: tx("Interpret the experiment", "Werte den Versuch aus"),
    text: tx(
      `Algae do photosynthesis in light with CO₂. At the dashed line ${ev === "dark" ? "the light is switched off" : "the CO₂ supply is stopped"}. Which curve shows **${en(MOL_NAME[mol])}**, and why?`,
      `Algen betreiben Fotosynthese im Licht mit CO₂. An der gestrichelten Linie wird ${ev === "dark" ? "das Licht ausgeschaltet" : "die CO₂-Zufuhr gestoppt"}. Welche Kurve zeigt **${de(MOL_NAME[mol])}**, und warum?`,
    ),
    visual: visual(PhotoCalvinGraph, { event: ev, risingLabel }),
    answer,
    hint:
      ev === "dark"
        ? tx("No light means no ATP and no NADPH. Which steps of the Calvin cycle need them, and which doesn't?", "Kein Licht heißt kein ATP und kein NADPH. Welche Schritte des Calvin-Zyklus brauchen sie, welcher nicht?")
        : tx("Without CO₂ only one step stops. Which one, and what happens before and after it?", "Ohne CO₂ stoppt nur ein Schritt. Welcher, und was passiert davor und danach?"),
    solution: [
      { math: ev === "dark" ? tx('"light off:" \\; \\text{ATP}, \\text{NADPH} \\to 0', '"Licht aus:" \\; \\text{ATP}, \\text{NADPH} \\to 0') : tx('"no" \\ce{CO2} : \\; "fixation stops"', '"kein" \\ce{CO2} : \\; "Fixierung stoppt"'), note: tx(`${cap(en(r.right))}.`, `${cap(de(r.right))}.`) },
      { math: tx(`\\text{${en(MOL_NAME[mol])}} \\; "${r.rises ? "rises" : "falls"}" \\Rightarrow \\blob{"curve ${rightCurve}"#v}`, `\\text{${de(MOL_NAME[mol])}} \\; "${r.rises ? "steigt" : "sinkt"}" \\Rightarrow \\blob{"Kurve ${rightCurve}"#v}`), note: tx(`So ${en(MOL_NAME[mol])} ${r.rises ? "rises" : "falls"}: **curve ${rightCurve}**.`, `${de(MOL_NAME[mol])} ${r.rises ? "steigt" : "sinkt"} also: **Kurve ${rightCurve}**.`), highlight: ["v"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 6. Which phase?

type Ph = 0 | 1 | 2 | 3;
const PHASE: Text[] = [tx("Fixation", "Fixierung"), tx("Reduction", "Reduktion"), tx("Regeneration of RuBP", "Regeneration von RuBP"), tx("Light reactions (thylakoids)", "Lichtreaktionen (Thylakoide)")];
const PHASE_ITEMS: { text: Text; p: Ph; say?: Partial<Record<Ph, Text>> }[] = [
  { text: tx("Rubisco binds CO₂ to RuBP.", "Rubisco bindet CO₂ an RuBP."), p: 0 },
  { text: tx("An unstable C₆ intermediate splits into two C₃ molecules.", "Ein instabiles C₆-Zwischenprodukt zerfällt in zwei C₃-Moleküle."), p: 0 },
  { text: tx("3-PG is reduced to G3P.", "3-PG wird zu GAP reduziert."), p: 1 },
  { text: tx("NADPH is oxidised to NADP⁺.", "NADPH wird zu NADP⁺ oxidiert."), p: 1, say: { 3: tx("In the light reactions NADP⁺ is **reduced** to NADPH. It is oxidised again where it's used: in the Calvin cycle.", "In den Lichtreaktionen wird NADP⁺ zu NADPH **reduziert**. Oxidiert wird es dort, wo es verbraucht wird: im Calvin-Zyklus.") } },
  { text: tx("RuBP is rebuilt from G3P.", "Aus GAP wird RuBP zurückgebildet."), p: 2 },
  { text: tx("ATP is used, but no NADPH.", "ATP wird verbraucht, aber kein NADPH."), p: 2, say: { 1: tx("The reduction uses ATP **and** NADPH. Only ATP is needed to rebuild RuBP.", "Die Reduktion verbraucht ATP **und** NADPH. Nur ATP braucht man, um RuBP zurückzubilden.") } },
  { text: tx("Water is split and O₂ is released.", "Wasser wird gespalten und O₂ wird frei."), p: 3, say: { 0: tx("The O₂ doesn't come from CO₂ fixation: it comes from water, split at photosystem II.", "Der Sauerstoff stammt nicht aus der CO₂-Fixierung, sondern aus Wasser, gespalten am Fotosystem II.") } },
  { text: tx("NADP⁺ is reduced to NADPH.", "NADP⁺ wird zu NADPH reduziert."), p: 3, say: { 1: tx("In the reduction phase NADPH is **used up** (oxidised). It is made in the light reactions.", "In der Reduktionsphase wird NADPH **verbraucht** (oxidiert). Hergestellt wird es in den Lichtreaktionen.") } },
];

function phaseTask(rng: Rng): Exercise {
  const it = rng.pick(PHASE_ITEMS);
  const order = rng.shuffle([0, 1, 2, 3] as Ph[]);
  const options = order.map((p) => PHASE[p]);
  const generic: Record<Ph, Text> = {
    0: tx("Fixation is only the binding of CO₂ to RuBP by Rubisco.", "Die Fixierung ist nur das Binden von CO₂ an RuBP durch Rubisco."),
    1: tx("The reduction turns 3-PG into G3P with ATP and NADPH.", "Die Reduktion macht mit ATP und NADPH aus 3-PG das GAP."),
    2: tx("The regeneration rebuilds RuBP from G3P, using ATP.", "Die Regeneration baut mit ATP aus GAP wieder RuBP auf."),
    3: tx("The light reactions on the thylakoids make ATP, NADPH and O₂. This step belongs to the Calvin cycle.", "Die Lichtreaktionen an den Thylakoiden liefern ATP, NADPH und O₂. Dieser Schritt gehört zum Calvin-Zyklus."),
  };
  const list: Mistake[] = order.flatMap((p, at) => (p === it.p ? [] : [{ when: { kind: "choice", options, correct: at } as AnswerSpec, title: tx("Another phase", "Eine andere Phase"), say: it.say?.[p] ?? generic[p] }]));
  return {
    instruction: tx("Which phase?", "Welche Phase?"),
    text: tx(`In which phase does this happen? **${en(it.text)}**`, `In welcher Phase passiert das? **${de(it.text)}**`),
    answer: { kind: "choice", options, correct: order.indexOf(it.p) },
    hint: tx("Fixation: CO₂ on. Reduction: ATP + NADPH. Regeneration: only ATP. Water splitting and NADPH formation: light reactions.", "Fixierung: CO₂ dran. Reduktion: ATP + NADPH. Regeneration: nur ATP. Wasserspaltung und NADPH-Bildung: Lichtreaktionen."),
    solution: [{ math: q(PHASE[it.p], "a"), note: tx(`**${en(PHASE[it.p])}**: ${en(generic[it.p])}`, `**${de(PHASE[it.p])}**: ${de(generic[it.p])}`), highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 7. Spectra and Engelmann

function bacteriaTask(rng: Rng): Exercise {
  const right: MultiOpt[] = [
    { text: tx("Blue-violet (about 430–480 nm)", "Blauviolett (etwa 430–480 nm)"), miss: tx("Blue light is missing: chlorophylls and carotenoids absorb strongly here, so much O₂ is made.", "Blaues Licht fehlt: Hier absorbieren Chlorophylle und Carotinoide stark, es entsteht viel O₂.") },
    { text: tx("Red (about 650–690 nm)", "Rot (etwa 650–690 nm)"), miss: tx("Red is missing: chlorophyll a has its second absorption peak there.", "Rot fehlt: Dort hat Chlorophyll a sein zweites Absorptionsmaximum.") },
  ];
  const wrong: MultiOpt[] = some(
    rng,
    [
      { text: tx("Green (about 500–560 nm)", "Grün (etwa 500–560 nm)"), title: tx("Green is reflected", "Grün wird reflektiert"), say: tx("Leaves look green because they absorb little green light and reflect it. Little absorption, little O₂, few bacteria.", "Blätter sehen grün aus, weil sie grünes Licht kaum absorbieren und zurückwerfen. Wenig Absorption, wenig O₂, wenige Bakterien.") },
      { text: tx("Yellow (about 570–600 nm)", "Gelb (etwa 570–600 nm)"), title: tx("Little absorption", "Wenig Absorption"), say: tx("Yellow light is hardly absorbed by the pigments. So hardly any oxygen forms there.", "Gelbes Licht absorbieren die Pigmente kaum. Dort entsteht also kaum Sauerstoff.") },
      { text: tx("Infrared (beyond 750 nm)", "Infrarot (jenseits von 750 nm)"), title: tx("Not usable", "Nicht nutzbar"), say: tx("Infrared lies outside the absorption range of the pigments: no photosynthesis there.", "Infrarot liegt außerhalb des Absorptionsbereichs der Pigmente: Dort gibt es keine Fotosynthese.") },
    ],
    2,
  );
  const { answer, mistakes: list } = multi(rng, right, wrong);
  return {
    instruction: tx("Engelmann's experiment", "Der Engelmann-Versuch"),
    text: tx("Engelmann lit a filamentous green alga with light split by a prism and added oxygen-loving bacteria. In which parts of the spectrum did most bacteria gather? Select all that apply.", "Engelmann beleuchtete eine fädige Grünalge mit Licht, das ein Prisma zerlegte, und gab sauerstoffliebende Bakterien hinzu. In welchen Bereichen des Spektrums sammelten sich die meisten Bakterien? Wähle alles Passende."),
    visual: visual(PhotoSpectraGraph, { show: ["action"] }),
    answer,
    hint: tx("Bacteria gather where the alga releases most oxygen, i.e. where photosynthesis is fastest.", "Die Bakterien sammeln sich dort, wo die Alge am meisten Sauerstoff abgibt, also wo die Fotosynthese am schnellsten läuft."),
    solution: [
      { math: tx('"many bacteria"#b = "much"#m \\ce{O2}', '"viele Bakterien"#b = "viel"#m \\ce{O2}'), note: tx("Aerobic bacteria swim to where there is most oxygen.", "Aerobe Bakterien schwimmen dorthin, wo es am meisten Sauerstoff gibt.") },
      { math: tx('"blue" + "red"#a', '"Blau" + "Rot"#a'), note: tx("That's where the action spectrum peaks: in **blue-violet** and in **red** light.", "Dort hat das Wirkungsspektrum seine Maxima: im **blauvioletten** und im **roten** Licht."), highlight: ["a"] },
    ],
    mistakes: list,
  };
}

type SpecQ = { ask: Text; right: Text; short: Text; ans: Text; why: Text; wrong: Opt[]; show?: ("chlA" | "chlB" | "car" | "action")[] };
const SPECQ: SpecQ[] = [
  {
    ask: tx("Why do the bacteria in Engelmann's experiment gather at certain wavelengths?", "Warum sammeln sich die Bakterien im Engelmann-Versuch bei bestimmten Wellenlängen?"),
    right: tx("There the alga releases the most oxygen, which the aerobic bacteria seek", "Dort gibt die Alge am meisten Sauerstoff ab, den die aeroben Bakterien suchen"),
    short: tx("bacteria", "Bakterien"),
    ans: tx("most O₂", "meiste O₂"),
    why: tx("The bacteria are indicators: they show where the rate of photosynthesis is highest.", "Die Bakterien sind Anzeiger: Sie zeigen, wo die Fotosyntheserate am höchsten ist."),
    wrong: [
      { text: tx("The bacteria like the warmth of the red light", "Die Bakterien mögen die Wärme des roten Lichts"), title: tx("It's about oxygen", "Es geht um Sauerstoff"), say: tx("They also gather in **blue** light, which doesn't warm much. What they seek is oxygen.", "Sie sammeln sich auch im **blauen** Licht, das kaum wärmt. Was sie suchen, ist Sauerstoff.") },
      { text: tx("The bacteria do photosynthesis themselves there", "Die Bakterien betreiben dort selbst Fotosynthese"), title: tx("They breathe", "Sie atmen"), say: tx("These bacteria need oxygen for respiration. They don't photosynthesise; they find the alga's O₂.", "Diese Bakterien brauchen Sauerstoff für ihre Atmung. Sie betreiben keine Fotosynthese, sie finden den Sauerstoff der Alge.") },
      { text: tx("The light is brightest there", "Dort ist das Licht am hellsten"), title: tx("Not about brightness", "Nicht die Helligkeit"), say: tx("It's about which colours the pigments can **use**, not about brightness.", "Es geht darum, welche Farben die Pigmente **nutzen** können, nicht um die Helligkeit.") },
    ],
  },
  {
    ask: tx("Why does photosynthesis hardly use green light?", "Warum nutzt die Fotosynthese grünes Licht kaum?"),
    right: tx("Chlorophyll absorbs little green light; most of it is reflected", "Chlorophyll absorbiert grünes Licht kaum, das meiste wird reflektiert"),
    short: tx("green gap", "Grünlücke"),
    ans: tx("reflected", "reflektiert"),
    why: tx("Light can only drive photosynthesis if a pigment absorbs it. The absorption spectra have a gap in the green.", "Licht kann die Fotosynthese nur antreiben, wenn ein Pigment es absorbiert. Die Absorptionsspektren haben im Grünen eine Lücke."),
    show: ["chlA", "chlB"],
    wrong: [
      { text: tx("Green light carries no energy", "Grünes Licht hat keine Energie"), title: tx("It has energy", "Es hat Energie"), say: tx("Green light carries plenty of energy (more than red). It just isn't absorbed well.", "Grünes Licht hat reichlich Energie (mehr als rotes). Es wird nur kaum absorbiert.") },
      { text: tx("Green light can't get through the epidermis", "Grünes Licht kommt nicht durch die Epidermis"), title: tx("It's the pigments", "Es liegt an den Pigmenten"), say: tx("The epidermis is clear. It's the pigments in the chloroplasts that hardly absorb green.", "Die Epidermis ist durchsichtig. Es sind die Pigmente in den Chloroplasten, die Grün kaum absorbieren.") },
      { text: tx("Chlorophyll absorbs green light and stores it", "Chlorophyll absorbiert grünes Licht und speichert es"), title: tx("The opposite", "Das Gegenteil"), say: tx("If chlorophyll absorbed green, leaves wouldn't look green. We see the reflected colour.", "Würde Chlorophyll Grün absorbieren, sähen Blätter nicht grün aus. Wir sehen die zurückgeworfene Farbe.") },
    ],
  },
  {
    ask: tx("Between 450 and 500 nm photosynthesis is much faster than chlorophyll a alone could explain. Why?", "Zwischen 450 und 500 nm ist die Fotosynthese viel schneller, als Chlorophyll a allein erklären könnte. Warum?"),
    right: tx("Accessory pigments (chlorophyll b, carotenoids) absorb there and pass the energy on", "Akzessorische Pigmente (Chlorophyll b, Carotinoide) absorbieren dort und leiten die Energie weiter"),
    short: tx("450–500 nm", "450–500 nm"),
    ans: tx("accessory pigments", "akzessorische Pigmente"),
    why: tx("The antenna complexes contain several pigments. They widen the usable spectrum and pass the energy on to chlorophyll a in the reaction centre.", "Die Antennenkomplexe enthalten mehrere Pigmente. Sie erweitern das nutzbare Spektrum und leiten die Energie an das Chlorophyll a im Reaktionszentrum weiter."),
    show: ["chlA", "chlB", "car", "action"],
    wrong: [
      { text: tx("The bacteria make extra oxygen there", "Die Bakterien erzeugen dort zusätzlich Sauerstoff"), title: tx("Bacteria use O₂", "Bakterien verbrauchen O₂"), say: tx("The bacteria **use** oxygen. The extra photosynthesis comes from other pigments of the alga.", "Die Bakterien **verbrauchen** Sauerstoff. Die zusätzliche Fotosynthese kommt von anderen Pigmenten der Alge.") },
      { text: tx("Chlorophyll a works better in a mixture", "Chlorophyll a arbeitet im Gemisch besser"), title: tx("Other pigments", "Andere Pigmente"), say: tx("Chlorophyll a doesn't change. Other pigments absorb where it can't.", "Chlorophyll a ändert sich nicht. Andere Pigmente absorbieren dort, wo es selbst nicht kann.") },
      { text: tx("Light of these wavelengths has the most energy", "Licht dieser Wellenlängen hat die meiste Energie"), title: tx("Absorption counts", "Die Absorption zählt"), say: tx("Shorter wavelengths have even more energy. What matters is which pigment absorbs the light.", "Kürzere Wellenlängen haben noch mehr Energie. Entscheidend ist, welches Pigment das Licht absorbiert.") },
    ],
  },
  {
    ask: tx("What is the difference between an absorption spectrum and an action spectrum?", "Was ist der Unterschied zwischen Absorptions- und Wirkungsspektrum?"),
    right: tx("Absorption: how much light a pigment absorbs at each wavelength. Action: how fast photosynthesis runs at each wavelength", "Absorption: wie viel Licht ein Pigment bei jeder Wellenlänge aufnimmt. Wirkung: wie schnell die Fotosynthese bei jeder Wellenlänge läuft"),
    short: tx("two spectra", "zwei Spektren"),
    ans: tx("pigment vs rate", "Pigment vs. Rate"),
    why: tx("An absorption spectrum is measured on a pigment solution with a photometer. An action spectrum is measured on living cells, e.g. as O₂ release.", "Ein Absorptionsspektrum misst man an einer Pigmentlösung im Fotometer. Ein Wirkungsspektrum misst man an lebenden Zellen, z. B. als O₂-Abgabe."),
    wrong: [
      { text: tx("Absorption: how fast photosynthesis runs. Action: how much light a pigment absorbs", "Absorption: wie schnell die Fotosynthese läuft. Wirkung: wie viel Licht ein Pigment aufnimmt"), title: tx("Swapped round", "Vertauscht"), say: tx("Just swapped: absorption belongs to a pigment, the action spectrum to the whole process of photosynthesis.", "Genau vertauscht: Die Absorption gehört zu einem Pigment, das Wirkungsspektrum zum ganzen Vorgang der Fotosynthese.") },
      { text: tx("Both show which colours a leaf reflects", "Beide zeigen, welche Farben ein Blatt reflektiert"), title: tx("Absorbed, not reflected", "Absorbiert, nicht reflektiert"), say: tx("Both are about **used** light: absorbed by a pigment, or effective in photosynthesis.", "Beide handeln von **genutztem** Licht: von einem Pigment absorbiert oder in der Fotosynthese wirksam.") },
      { text: tx("There is no difference, they are always identical", "Es gibt keinen Unterschied, sie sind immer gleich"), title: tx("Similar, not identical", "Ähnlich, nicht gleich"), say: tx("They are similar, but the action spectrum reflects all pigments together, so it's broader than that of chlorophyll a.", "Sie ähneln sich, aber das Wirkungsspektrum spiegelt alle Pigmente zusammen und ist breiter als das von Chlorophyll a.") },
    ],
  },
];

function specTask(rng: Rng): Exercise {
  const s = rng.pick(SPECQ);
  const { answer, mistakes: list } = choice(rng, [{ text: s.right }, ...s.wrong]);
  return {
    instruction: tx("Spectra", "Spektren"),
    text: s.ask,
    ...(s.show ? { visual: visual(PhotoSpectraGraph, { show: s.show }) } : {}),
    answer,
    hint: tx("Only absorbed light can drive photosynthesis. Several pigments together absorb more colours than one.", "Nur absorbiertes Licht kann die Fotosynthese antreiben. Mehrere Pigmente zusammen absorbieren mehr Farben als eines."),
    solution: reasonFrames(s.short, s.why, s.ans, tx(`**${en(s.right)}.**`, `**${de(s.right)}.**`)),
    mistakes: list,
  };
}

const PIG_NAME: Record<"chlA" | "chlB" | "car", Text> = { chlA: tx("chlorophyll a", "Chlorophyll a"), chlB: tx("chlorophyll b", "Chlorophyll b"), car: tx("carotenoids", "Carotinoide") };

function pigmentTask(rng: Rng): Exercise {
  const [nm, right] = rng.pick<[number, "chlA" | "chlB" | "car"]>([
    [430, "chlA"],
    [665, "chlA"],
    [645, "chlB"],
    [480, "car"],
  ]);
  const wrongs = (["chlA", "chlB", "car"] as const).filter((p) => p !== right);
  const { answer, mistakes: list } = choice(rng, [
    { text: PIG_NAME[right] },
    ...wrongs.map((w) => ({ text: PIG_NAME[w], title: tx("Read again", "Lies noch mal ab"), say: tx(`At ${nm} nm the curve of ${en(PIG_NAME[w]).toLowerCase()} is lower. Follow the line at ${nm} nm up to the highest curve.`, `Bei ${nm} nm liegt die Kurve von ${de(PIG_NAME[w])} tiefer. Geh bei ${nm} nm senkrecht nach oben bis zur höchsten Kurve.`) })),
    { text: tx("None, all absorb the same", "Keins, alle absorbieren gleich"), title: tx("Look at the curves", "Schau auf die Kurven"), say: tx("The curves are clearly different at this wavelength. Which one is highest?", "Die Kurven unterscheiden sich bei dieser Wellenlänge deutlich. Welche liegt am höchsten?") },
  ]);
  return {
    instruction: tx("Read the absorption spectra", "Lies die Absorptionsspektren ab"),
    text: tx(`Which pigment absorbs most strongly at **${nm} nm**?`, `Welches Pigment absorbiert bei **${nm} nm** am stärksten?`),
    visual: visual(PhotoSpectraGraph, { show: ["chlA", "chlB", "car"], cursor: nm }),
    answer,
    hint: tx("Go up from the wavelength on the axis and see which curve is highest there.", "Geh von der Wellenlänge auf der Achse senkrecht nach oben und schau, welche Kurve dort am höchsten liegt."),
    solution: [{ math: tx(`${nm} "nm" \\Rightarrow \\blob{"${en(PIG_NAME[right])}"#v}`, `${nm} "nm" \\Rightarrow \\blob{"${de(PIG_NAME[right])}"#v}`), note: tx(`At ${nm} nm the highest curve is that of **${en(PIG_NAME[right]).toLowerCase()}**.`, `Bei ${nm} nm liegt die Kurve von **${de(PIG_NAME[right])}** am höchsten.`), highlight: ["v"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 8. C3, C4 or CAM?

type Ty = 0 | 1 | 2;
const TYPES: Text[] = [tx("C₃ plant", "C₃-Pflanze"), tx("C₄ plant", "C₄-Pflanze"), tx("CAM plant", "CAM-Pflanze")];
const FEATS: { text: Text; t: Ty; say?: Partial<Record<Ty, Text>> }[] = [
  { text: tx("Its stomata open at night and stay closed during the day.", "Ihre Spaltöffnungen öffnen sich nachts und bleiben tagsüber geschlossen."), t: 2, say: { 1: tx("C₄ plants keep their stomata open by day; they separate the steps in **space**. Night-time opening is the **time** trick of CAM plants.", "C₄-Pflanzen haben tagsüber offene Spaltöffnungen, sie trennen die Schritte **räumlich**. Nachts öffnen ist der **zeitliche** Trick der CAM-Pflanzen.") } },
  { text: tx("It stores malic acid in the vacuole overnight.", "Sie speichert nachts Äpfelsäure in der Vakuole."), t: 2, say: { 1: tx("C₄ plants pass malate straight on to the bundle sheath. Storing it overnight in the vacuole is CAM.", "C₄-Pflanzen geben Malat sofort an die Bündelscheide weiter. Über Nacht in der Vakuole speichern ist CAM.") } },
  { text: tx("CO₂ pre-fixation and Calvin cycle take place in different cells.", "CO₂-Vorfixierung und Calvin-Zyklus laufen in verschiedenen Zellen ab."), t: 1, say: { 2: tx("CAM plants do both steps in the **same** cell, at different times. Different cells means separation in space: C₄.", "CAM-Pflanzen machen beide Schritte in **derselben** Zelle, nur zu verschiedenen Zeiten. Verschiedene Zellen heißt räumliche Trennung: C₄.") } },
  { text: tx("PEP carboxylase works in the mesophyll, Rubisco in the bundle sheath cells.", "Die PEP-Carboxylase arbeitet im Mesophyll, Rubisco in den Bündelscheidenzellen."), t: 1 },
  { text: tx("Its leaves show a ring of large bundle sheath cells around each vein (Kranz anatomy).", "Ihre Blätter zeigen einen Kranz großer Bündelscheidenzellen um jedes Leitbündel (Kranzanatomie)."), t: 1 },
  { text: tx("Maize and sugar cane", "Mais und Zuckerrohr"), t: 1, say: { 0: tx("Maize and sugar cane come from hot regions and use the C₄ trick.", "Mais und Zuckerrohr stammen aus heißen Gebieten und nutzen den C₄-Trick.") } },
  { text: tx("Pineapple and cacti", "Ananas und Kakteen"), t: 2, say: { 1: tx("Desert plants have to save water above all: they only open their stomata at night (CAM).", "Wüstenpflanzen müssen vor allem Wasser sparen: Sie öffnen ihre Spaltöffnungen nur nachts (CAM).") } },
  { text: tx("Wheat, rice and beech", "Weizen, Reis und Buche"), t: 0, say: { 1: tx("Most plants of temperate regions are C₃ plants. Wheat and rice too.", "Die meisten Pflanzen gemäßigter Breiten sind C₃-Pflanzen. Auch Weizen und Reis.") } },
  { text: tx("Rubisco fixes CO₂ straight from the air spaces; the first product is 3-PG.", "Rubisco fixiert CO₂ direkt aus den Interzellularen, das erste Produkt ist 3-PG."), t: 0 },
  { text: tx("In hot, dry weather it loses up to a quarter of its fixed carbon through photorespiration.", "Bei Hitze und Trockenheit verliert sie bis zu einem Viertel des fixierten Kohlenstoffs durch Fotorespiration."), t: 0, say: { 1: tx("C₄ plants concentrate CO₂ at Rubisco, so they hardly photorespire. The big losses happen in C₃ plants.", "C₄-Pflanzen reichern CO₂ an Rubisco an und betreiben kaum Fotorespiration. Die großen Verluste haben C₃-Pflanzen.") } },
  { text: tx("The pH of its cell sap falls during the night and rises again during the day.", "Der pH-Wert ihres Zellsafts sinkt nachts und steigt tagsüber wieder."), t: 2 },
  { text: tx("It separates CO₂ fixation and Calvin cycle in time.", "Sie trennt CO₂-Fixierung und Calvin-Zyklus zeitlich."), t: 2, say: { 1: tx("C₄ is the separation in **space** (two cell types). In **time** is CAM.", "C₄ ist die **räumliche** Trennung (zwei Zelltypen). **Zeitlich** ist CAM.") } },
  { text: tx("It separates CO₂ fixation and Calvin cycle in space.", "Sie trennt CO₂-Fixierung und Calvin-Zyklus räumlich."), t: 1, say: { 2: tx("CAM is the separation in **time** (night and day). In **space** is C₄.", "CAM ist die **zeitliche** Trennung (Nacht und Tag). **Räumlich** ist C₄.") } },
];

function typeTask(rng: Rng, f = rng.pick(FEATS)): Exercise {
  const order = rng.shuffle([0, 1, 2] as Ty[]);
  const options = order.map((x) => TYPES[x]);
  const generic: Record<Ty, Text> = {
    0: tx("C₃ plants have no extra trick: Rubisco fixes CO₂ directly in the mesophyll.", "C₃-Pflanzen haben keinen Extra-Trick: Rubisco fixiert CO₂ direkt im Mesophyll."),
    1: tx("C₄ plants separate the steps in space: mesophyll and bundle sheath.", "C₄-Pflanzen trennen die Schritte räumlich: Mesophyll und Bündelscheide."),
    2: tx("CAM plants separate the steps in time: night and day.", "CAM-Pflanzen trennen die Schritte zeitlich: Nacht und Tag."),
  };
  const list: Mistake[] = order.flatMap((x, at) => (x === f.t ? [] : [{ when: { kind: "choice", options, correct: at } as AnswerSpec, title: tx("Another type", "Ein anderer Typ"), say: f.say?.[x] ?? generic[x] }]));
  return {
    instruction: tx("C₃, C₄ or CAM?", "C₃, C₄ oder CAM?"),
    text: tx(`Which type of plant fits? **${en(f.text)}**`, `Welcher Pflanzentyp passt? **${de(f.text)}**`),
    answer: { kind: "choice", options, correct: order.indexOf(f.t) },
    hint: tx("C₄: separation in space (two cell types). CAM: separation in time (night and day). C₃: no separation.", "C₄: räumliche Trennung (zwei Zelltypen). CAM: zeitliche Trennung (Nacht und Tag). C₃: keine Trennung."),
    solution: [{ math: q(TYPES[f.t], "a"), note: tx(`**${en(TYPES[f.t])}**. ${en(generic[f.t])}`, `**${de(TYPES[f.t])}**. ${de(generic[f.t])}`), highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 9. Inhibitors (select all consequences)

type Inh = { what: Text; short: Text; right: MultiOpt[]; wrong: MultiOpt[]; why: Text };
const INHIBITORS: Inh[] = [
  {
    what: tx("The herbicide DCMU blocks the transfer of electrons from photosystem II to plastoquinone. Which consequences follow?", "Das Herbizid DCMU blockiert die Elektronenübertragung von Fotosystem II auf Plastochinon. Welche Folgen hat das?"),
    short: "DCMU",
    why: tx("Without electron flow from PS II, water is no longer split, no NADPH is formed and the Calvin cycle soon runs out of supplies.", "Ohne Elektronenfluss aus PS II wird kein Wasser mehr gespalten, es entsteht kein NADPH, und dem Calvin-Zyklus geht bald der Nachschub aus."),
    right: [
      { text: tx("No more O₂ is released", "Es wird kein O₂ mehr frei"), miss: tx("PS II can't pass on its electrons, so it can't take new ones from water: no O₂.", "PS II wird seine Elektronen nicht los, also holt es keine neuen aus Wasser: kein O₂.") },
      { text: tx("No NADPH is formed", "Es entsteht kein NADPH"), miss: tx("No electrons reach PS I and NADP⁺ any more: no NADPH.", "Bei PS I und NADP⁺ kommen keine Elektronen mehr an: kein NADPH.") },
      { text: tx("The Calvin cycle soon stops", "Der Calvin-Zyklus kommt bald zum Stillstand"), miss: tx("Without NADPH (and with less ATP) the reduction phase stops, so the cycle stops too.", "Ohne NADPH (und mit weniger ATP) stoppt die Reduktion, damit auch der Zyklus.") },
    ],
    wrong: [
      { text: tx("More ATP is formed instead", "Stattdessen entsteht mehr ATP"), title: tx("Less gradient", "Weniger Gradient"), say: tx("Without linear electron flow fewer protons are pumped: rather less ATP, not more.", "Ohne linearen Elektronenfluss werden weniger Protonen gepumpt: eher weniger ATP, nicht mehr.") },
      { text: tx("Water splitting speeds up", "Die Wasserspaltung wird schneller"), title: tx("Jammed", "Stau"), say: tx("The electrons jam at PS II. P680 can't take new ones from water.", "Die Elektronen stauen sich an PS II. P680 kann keine neuen aus Wasser holen.") },
    ],
  },
  {
    what: tx("An uncoupler makes the thylakoid membrane leaky for protons. Light reactions go on. Which consequences follow?", "Ein Entkoppler macht die Thylakoidmembran durchlässig für Protonen. Die Lichtreaktionen laufen weiter. Welche Folgen hat das?"),
    short: tx("uncoupler", "Entkoppler"),
    why: tx("Electron transport goes on (O₂ and NADPH still form), but no proton gradient builds up, so ATP synthase has nothing to run on.", "Der Elektronentransport läuft weiter (O₂ und NADPH entstehen), aber es baut sich kein Protonengradient auf, die ATP-Synthase hat keinen Antrieb."),
    right: [
      { text: tx("No proton gradient builds up", "Es baut sich kein Protonengradient auf"), miss: tx("Protons leak straight back through the membrane: the gradient collapses.", "Protonen fließen direkt durch die Membran zurück: Der Gradient bricht zusammen.") },
      { text: tx("Hardly any ATP is formed", "Es wird kaum noch ATP gebildet"), miss: tx("ATP synthase runs on the gradient. No gradient, no ATP.", "Die ATP-Synthase läuft mit dem Gradienten. Kein Gradient, kein ATP.") },
      { text: tx("O₂ is still released", "Es wird weiterhin O₂ frei"), miss: tx("The electrons still flow from water: O₂ is still released.", "Die Elektronen fließen weiter aus dem Wasser: O₂ wird weiter frei.") },
    ],
    wrong: [
      { text: tx("No NADPH is formed any more", "Es entsteht kein NADPH mehr"), title: tx("Electrons still flow", "Elektronen fließen weiter"), say: tx("The uncoupler doesn't stop the electrons. They still reach NADP⁺: NADPH is formed.", "Der Entkoppler hält die Elektronen nicht auf. Sie erreichen weiter NADP⁺: NADPH entsteht.") },
      { text: tx("Water is no longer split", "Wasser wird nicht mehr gespalten"), title: tx("Electron transport runs", "Elektronentransport läuft"), say: tx("Only the gradient is lost; the electron transport chain from water keeps running.", "Nur der Gradient geht verloren, die Elektronentransportkette ab Wasser läuft weiter.") },
    ],
  },
  {
    what: tx("A poison blocks ATP synthase in the light. Which consequences follow?", "Ein Gift blockiert im Licht die ATP-Synthase. Welche Folgen hat das?"),
    short: tx("ATP synthase blocked", "ATP-Synthase blockiert"),
    why: tx("Protons can't flow back, so the gradient gets very steep and no ATP forms. Without ATP the Calvin cycle stops.", "Die Protonen können nicht zurückfließen, der Gradient wird sehr steil und es entsteht kein ATP. Ohne ATP stoppt der Calvin-Zyklus."),
    right: [
      { text: tx("No ATP is formed", "Es entsteht kein ATP"), miss: tx("ATP synthase makes the ATP. Blocked enzyme, no ATP.", "Die ATP-Synthase macht das ATP. Enzym blockiert, kein ATP.") },
      { text: tx("The pH in the lumen falls even further", "Der pH-Wert im Lumen sinkt noch weiter"), miss: tx("Protons keep being pumped in but can't flow out: the lumen gets even more acidic.", "Protonen werden weiter hineingepumpt, können aber nicht abfließen: Das Lumen wird noch saurer.") },
      { text: tx("The Calvin cycle stops", "Der Calvin-Zyklus kommt zum Stillstand"), miss: tx("Reduction and regeneration need ATP. Without it the cycle stops.", "Reduktion und Regeneration brauchen ATP. Ohne ATP stoppt der Zyklus.") },
    ],
    wrong: [
      { text: tx("The pH in the lumen rises", "Der pH-Wert im Lumen steigt"), title: tx("More protons, lower pH", "Mehr Protonen, niedrigerer pH"), say: tx("Protons pile up in the lumen. More protons mean a **lower** pH.", "Protonen stauen sich im Lumen. Mehr Protonen heißt **niedrigerer** pH.") },
      { text: tx("NADPH is no longer needed", "NADPH wird nicht mehr gebraucht"), title: tx("Both are needed", "Beides wird gebraucht"), say: tx("The Calvin cycle needs ATP **and** NADPH. Without ATP the NADPH just isn't used up.", "Der Calvin-Zyklus braucht ATP **und** NADPH. Ohne ATP wird das NADPH nur nicht mehr verbraucht.") },
    ],
  },
];

function inhibitorTask(rng: Rng): Exercise {
  const inh = rng.pick(INHIBITORS);
  const right = some(rng, inh.right, rng.int(2, 3));
  const wrong = some(rng, inh.wrong, 2);
  const { answer, mistakes: list } = multi(rng, right, wrong);
  return {
    instruction: tx("Predict the consequences", "Sag die Folgen voraus"),
    text: tx(`${en(inh.what)} Select all that apply.`, `${de(inh.what)} Wähle alles Passende.`),
    answer,
    hint: tx("Follow the chain: electrons from water to NADP⁺, protons into the lumen, back out through ATP synthase. Where exactly is it interrupted?", "Folge der Kette: Elektronen von Wasser zu NADP⁺, Protonen ins Lumen, durch die ATP-Synthase zurück. Wo genau wird sie unterbrochen?"),
    solution: reasonFrames(inh.short, inh.why, tx("consequences", "Folgen"), tx(`True: ${right.map((r) => `**${en(r.text)}**`).join(", ")}.`, `Richtig: ${right.map((r) => `**${de(r.text)}**`).join(", ")}.`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 10. Classic experiments

type Exp = { what: Text; short: Text; right: Text; wrong: Opt[] };
const EXPERIMENTS: Exp[] = [
  {
    what: tx("Ruben and Kamen (1941) gave algae water labelled with the heavy oxygen isotope ¹⁸O. The released O₂ contained ¹⁸O. With labelled CO₂ it did not.", "Ruben und Kamen (1941) gaben Algen Wasser, das mit dem schweren Sauerstoff-Isotop ¹⁸O markiert war. Der freigesetzte Sauerstoff enthielt ¹⁸O. Mit markiertem CO₂ war das nicht so."),
    short: "¹⁸O",
    right: tx("The released oxygen comes from water", "Der freigesetzte Sauerstoff stammt aus dem Wasser"),
    wrong: [
      { text: tx("The released oxygen comes from CO₂", "Der freigesetzte Sauerstoff stammt aus dem CO₂"), title: tx("The classic mistake", "Der klassische Fehler"), say: tx("That's exactly the idea the experiment disproved. The label from **water** ended up in the O₂, the label from CO₂ didn't.", "Genau diese Vorstellung hat der Versuch widerlegt. Die Markierung aus dem **Wasser** landete im O₂, die aus dem CO₂ nicht.") },
      { text: tx("Glucose is made from water only", "Glucose entsteht nur aus Wasser"), title: tx("Carbon from CO₂", "Kohlenstoff aus CO₂"), say: tx("The carbon in glucose must come from CO₂. The experiment is about where the O₂ comes from.", "Der Kohlenstoff der Glucose muss aus dem CO₂ kommen. Der Versuch klärt, woher der Sauerstoff stammt.") },
      { text: tx("Algae don't need CO₂", "Algen brauchen kein CO₂"), title: tx("CO₂ is needed", "CO₂ wird gebraucht"), say: tx("The algae did get CO₂. Its oxygen simply doesn't end up in the released O₂.", "Die Algen bekamen ja CO₂. Sein Sauerstoff landet nur nicht im freigesetzten O₂.") },
    ],
  },
  {
    what: tx("Calvin gave algae radioactive ¹⁴CO₂ for only a few seconds and then killed them. The first labelled stable substance was 3-phosphoglycerate (3-PG).", "Calvin gab Algen nur wenige Sekunden radioaktives ¹⁴CO₂ und tötete sie dann ab. Der erste markierte stabile Stoff war 3-Phosphoglycerat (3-PG)."),
    short: "¹⁴C",
    right: tx("CO₂ is first fixed into a C₃ compound, 3-PG", "CO₂ wird zuerst in eine C₃-Verbindung eingebaut, das 3-PG"),
    wrong: [
      { text: tx("CO₂ is turned directly into glucose", "CO₂ wird direkt zu Glucose umgewandelt"), title: tx("Many steps", "Viele Schritte"), say: tx("Glucose only appeared after longer times. The first product is a C₃ molecule: the cycle has several steps.", "Glucose tauchte erst nach längerer Zeit auf. Das erste Produkt ist ein C₃-Molekül: Der Zyklus hat mehrere Schritte.") },
      { text: tx("CO₂ is first split into C and O₂", "CO₂ wird zuerst in C und O₂ gespalten"), title: tx("CO₂ isn't split", "CO₂ wird nicht gespalten"), say: tx("CO₂ is bound as a whole by Rubisco. O₂ comes from water, not from CO₂.", "CO₂ wird von Rubisco als Ganzes gebunden. O₂ stammt aus Wasser, nicht aus CO₂.") },
      { text: tx("The light reactions need CO₂", "Die Lichtreaktionen brauchen CO₂"), title: tx("Calvin cycle", "Calvin-Zyklus"), say: tx("The experiment follows the carbon: it shows the first step of the Calvin cycle.", "Der Versuch verfolgt den Kohlenstoff: Er zeigt den ersten Schritt des Calvin-Zyklus.") },
    ],
  },
  {
    what: tx("Jagendorf (1966) kept isolated thylakoids in the dark at pH 4 and then moved them quickly into a solution of pH 8 with ADP and phosphate. ATP was formed, in the dark.", "Jagendorf (1966) hielt isolierte Thylakoide im Dunkeln bei pH 4 und brachte sie dann schnell in eine Lösung mit pH 8 sowie ADP und Phosphat. Es entstand ATP, im Dunkeln."),
    short: tx("pH 4 → pH 8", "pH 4 → pH 8"),
    right: tx("A proton gradient alone is enough to drive ATP synthase", "Ein Protonengradient allein reicht aus, um die ATP-Synthase anzutreiben"),
    wrong: [
      { text: tx("ATP synthase needs light directly", "Die ATP-Synthase braucht direkt Licht"), title: tx("It was dark", "Es war dunkel"), say: tx("The thylakoids were in the dark the whole time. Light is only needed to build up the gradient.", "Die Thylakoide waren die ganze Zeit im Dunkeln. Licht braucht man nur, um den Gradienten aufzubauen.") },
      { text: tx("The electron transport chain makes ATP itself", "Die Elektronentransportkette bildet das ATP selbst"), title: tx("No electron flow here", "Hier floss kein Elektron"), say: tx("In the dark no electrons flowed. The ATP came only from the pH difference.", "Im Dunkeln floss kein Elektron. Das ATP kam allein vom pH-Unterschied.") },
      { text: tx("ATP is formed in acidic solutions", "ATP entsteht in sauren Lösungen"), title: tx("The difference counts", "Der Unterschied zählt"), say: tx("At pH 4 alone nothing happened. What counts is the **difference**: acidic inside, alkaline outside.", "Bei pH 4 allein passierte nichts. Es kommt auf den **Unterschied** an: innen sauer, außen basisch.") },
    ],
  },
  {
    what: tx("Hill (1937) lit isolated chloroplasts without CO₂ but with an artificial electron acceptor. They released O₂.", "Hill (1937) belichtete isolierte Chloroplasten ohne CO₂, aber mit einem künstlichen Elektronenakzeptor. Sie gaben O₂ ab."),
    short: tx("Hill reaction", "Hill-Reaktion"),
    right: tx("O₂ release belongs to the light reactions and doesn't need CO₂ fixation", "Die O₂-Freisetzung gehört zu den Lichtreaktionen und braucht keine CO₂-Fixierung"),
    wrong: [
      { text: tx("The oxygen comes from CO₂", "Der Sauerstoff stammt aus CO₂"), title: tx("There was no CO₂", "Es gab kein CO₂"), say: tx("No CO₂ was there at all, yet O₂ was released. So it can't come from CO₂.", "Es war gar kein CO₂ da, trotzdem wurde O₂ frei. Er kann also nicht aus CO₂ stammen.") },
      { text: tx("Chloroplasts make glucose without CO₂", "Chloroplasten bilden Glucose ohne CO₂"), title: tx("No carbon", "Kein Kohlenstoff"), say: tx("Without CO₂ there is no carbon for glucose. Only the light reactions ran.", "Ohne CO₂ gibt es keinen Kohlenstoff für Glucose. Es liefen nur die Lichtreaktionen.") },
      { text: tx("Light isn't needed for O₂ release", "Für die O₂-Freisetzung braucht man kein Licht"), title: tx("They were lit", "Sie wurden belichtet"), say: tx("The chloroplasts were lit: the light drives the water splitting.", "Die Chloroplasten wurden belichtet: Das Licht treibt die Wasserspaltung an.") },
    ],
  },
];

function experimentTask(rng: Rng): Exercise {
  const e = rng.pick(EXPERIMENTS);
  const { answer, mistakes: list } = choice(rng, [{ text: e.right }, ...e.wrong]);
  return {
    instruction: tx("Classic experiments", "Klassische Experimente"),
    text: tx(`${en(e.what)} **What does this show?**`, `${de(e.what)} **Was zeigt das?**`),
    answer,
    hint: tx("Look at what was labelled or changed, and where the effect showed up.", "Schau, was markiert oder verändert wurde und wo sich die Wirkung zeigte."),
    solution: reasonFrames(e.short, e.what, tx("conclusion", "Schluss"), tx(`**${en(e.right)}.**`, `**${de(e.right)}.**`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 11. Where does the O2 come from? (and where does labelled oxygen end up)

function o2Task(rng: Rng, variant = rng.int(0, 2)): Exercise {
  const opts: Opt[][] = [
    [
      { text: tx("In the released O₂", "Im freigesetzten O₂") },
      { text: tx("In the glucose", "In der Glucose"), title: tx("O₂ comes from water", "O₂ stammt aus Wasser"), say: tx("Ah, I think you assumed the O₂ comes from CO₂, so the water's oxygen would go into sugar. It's the other way round: photolysis splits water, its oxygen is released.", "Ah, ich glaub, du hast angenommen, dass das O₂ aus dem CO₂ kommt und der Wassersauerstoff in den Zucker geht. Andersherum: Die Fotolyse spaltet Wasser, sein Sauerstoff wird frei.") },
      { text: tx("In the CO₂ the algae give off", "Im CO₂, das die Algen abgeben"), title: tx("Photolysis", "Fotolyse"), say: tx("Water is split at photosystem II: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. Where does its oxygen go?", "Wasser wird am Fotosystem II gespalten: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. Wohin geht sein Sauerstoff?") },
      { text: tx("Nowhere: the label is lost", "Nirgends: Die Markierung geht verloren"), title: tx("Atoms aren't lost", "Atome gehen nicht verloren"), say: tx("Atoms don't vanish. Follow the oxygen of the split water.", "Atome verschwinden nicht. Verfolge den Sauerstoff des gespaltenen Wassers.") },
    ],
    [
      { text: tx("In glucose and in newly formed water, not in the released O₂", "In Glucose und neu gebildetem Wasser, nicht im freigesetzten O₂") },
      { text: tx("In the released O₂", "Im freigesetzten O₂"), title: tx("O₂ doesn't come from CO₂", "O₂ stammt nicht aus CO₂"), say: tx("The classic mix-up! The released O₂ comes entirely from **water**. The oxygen of CO₂ ends up in the sugar (and in new water).", "Die klassische Verwechslung! Das freigesetzte O₂ stammt vollständig aus **Wasser**. Der Sauerstoff des CO₂ landet im Zucker (und in neuem Wasser).") },
      { text: tx("Half in the O₂, half in the glucose", "Je zur Hälfte im O₂ und in der Glucose"), title: tx("Not shared", "Nicht geteilt"), say: tx("The released O₂ comes only from water. None of the CO₂ oxygen ends up in it.", "Das freigesetzte O₂ stammt nur aus Wasser. Davon kommt nichts aus dem CO₂.") },
      { text: tx("Only in ATP", "Nur im ATP"), title: tx("Follow the carbon", "Folge dem Kohlenstoff"), say: tx("CO₂ is fixed by Rubisco and becomes part of the sugar. Its oxygen goes with it.", "CO₂ wird von Rubisco fixiert und wird Teil des Zuckers. Sein Sauerstoff geht mit.") },
    ],
    [
      { text: tx("From water, split at photosystem II (photolysis)", "Aus Wasser, gespalten am Fotosystem II (Fotolyse)") },
      { text: tx("From CO₂, split by Rubisco", "Aus CO₂, gespalten von Rubisco"), title: tx("The classic mistake", "Der klassische Fehler"), say: tx("Rubisco doesn't split CO₂, it binds it as a whole to RuBP. The O₂ comes from **water**.", "Rubisco spaltet CO₂ nicht, es bindet es als Ganzes an RuBP. Das O₂ stammt aus **Wasser**.") },
      { text: tx("From glucose, broken down in the Calvin cycle", "Aus Glucose, abgebaut im Calvin-Zyklus"), title: tx("The cycle builds up", "Der Zyklus baut auf"), say: tx("The Calvin cycle **builds** sugar. O₂ is released by the light reactions, from water.", "Der Calvin-Zyklus **baut** Zucker **auf**. O₂ wird in den Lichtreaktionen frei, aus Wasser.") },
      { text: tx("From the air in the air spaces", "Aus der Luft in den Interzellularen"), title: tx("Made, not taken", "Gebildet, nicht aufgenommen"), say: tx("The released O₂ is newly made, by splitting water.", "Das freigesetzte O₂ wird neu gebildet, durch die Spaltung von Wasser.") },
    ],
  ];
  const texts: Text[] = [
    tx("Algae get water labelled with the heavy oxygen isotope ¹⁸O and normal CO₂. Where does the ¹⁸O turn up first?", "Algen erhalten mit dem schweren Sauerstoff-Isotop ¹⁸O markiertes Wasser und normales CO₂. Wo taucht das ¹⁸O zuerst auf?"),
    tx("Algae get CO₂ labelled with ¹⁸O and normal water. Where does the ¹⁸O end up?", "Algen erhalten mit ¹⁸O markiertes CO₂ und normales Wasser. Wo landet das ¹⁸O?"),
    tx("Where does the oxygen released in photosynthesis come from?", "Woher stammt der Sauerstoff, der bei der Fotosynthese frei wird?"),
  ];
  const { answer, mistakes: list } = choice(rng, opts[variant]);
  return {
    instruction: tx("Where does the O₂ come from?", "Woher kommt das O₂?"),
    text: texts[variant],
    answer,
    hint: tx("At photosystem II: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. CO₂ is bound whole by Rubisco.", "Am Fotosystem II: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. CO₂ wird von Rubisco als Ganzes gebunden."),
    solution: [
      { math: "\\ce{2H2O -> O2 + 4H+ + 4e-}", note: tx("Photolysis at photosystem II: all the released O₂ comes from water.", "Fotolyse am Fotosystem II: Das gesamte freigesetzte O₂ stammt aus dem Wasser.") },
      { math: "6 \\ce{CO2} + 12 \\ce{H2}\\blob{\\ce{O}} \\to \\ce{C6H12O6} + 6 \\blob{\\ce{O2}} + 6 \\ce{H2O}", note: tx("That's why the full equation has 12 H₂O on the left: their oxygen becomes the 6 O₂. The oxygen of CO₂ ends up in glucose and the new water.", "Deshalb stehen in der vollständigen Gleichung links 12 H₂O: Ihr Sauerstoff wird zu den 6 O₂. Der Sauerstoff des CO₂ landet in Glucose und neuem Wasser."), highlight: [] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 12. Terms

type Term = { def: Text; accept: Text[]; show: Text; near?: { accept: Text[]; title: Text; say: Text }[] };
const TERMS: Term[] = [
  { def: tx("The enzyme that binds CO₂ to ribulose-1,5-bisphosphate.", "Das Enzym, das CO₂ an Ribulose-1,5-bisphosphat bindet."), accept: ["Rubisco", tx("RuBisCO", "Ribulose-1,5-bisphosphat-Carboxylase/Oxygenase"), "Ribulosebisphosphat-Carboxylase"], show: "Rubisco", near: [{ accept: [tx("PEP carboxylase", "PEP-Carboxylase")], title: tx("That's the C₄ enzyme", "Das ist das C₄-Enzym"), say: tx("PEP carboxylase pre-fixes CO₂ in C₄ and CAM plants. In the Calvin cycle it's another enzyme.", "Die PEP-Carboxylase fixiert CO₂ bei C₄- und CAM-Pflanzen vor. Im Calvin-Zyklus arbeitet ein anderes Enzym.") }] },
  { def: tx("The C₅ sugar that accepts CO₂ in the Calvin cycle.", "Der C₅-Zucker, der im Calvin-Zyklus das CO₂ aufnimmt."), accept: [tx("ribulose-1,5-bisphosphate", "Ribulose-1,5-bisphosphat"), "RuBP", "Ribulosebisphosphat", "Ribulose-bisphosphat", "ribulose bisphosphate"], show: tx("ribulose-1,5-bisphosphate (RuBP)", "Ribulose-1,5-bisphosphat (RuBP)"), near: [{ accept: [tx("3-phosphoglycerate", "3-Phosphoglycerat"), "3-PG"], title: tx("That's the product", "Das ist das Produkt"), say: tx("3-PG is what comes **out** of fixation. The acceptor that takes up CO₂ has 5 C.", "3-PG kommt bei der Fixierung **heraus**. Der Akzeptor, der CO₂ aufnimmt, hat 5 C.") }] },
  { def: tx("The first stable product of CO₂ fixation, a C₃ molecule.", "Das erste stabile Produkt der CO₂-Fixierung, ein C₃-Molekül."), accept: [tx("3-phosphoglycerate", "3-Phosphoglycerat"), "3-PG", "PGS", "Phosphoglycerinsäure", "3-Phosphoglycerinsäure", "phosphoglycerate", "PGA", "3-PGA"], show: tx("3-phosphoglycerate (3-PG)", "3-Phosphoglycerat (3-PG)"), near: [{ accept: [tx("glyceraldehyde 3-phosphate", "Glycerinaldehyd-3-phosphat"), "G3P", "GAP"], title: tx("One step later", "Ein Schritt später"), say: tx("G3P is formed only after the reduction with ATP and NADPH. The very first product is its acid.", "GAP entsteht erst nach der Reduktion mit ATP und NADPH. Das allererste Produkt ist die Säure davon.") }] },
  { def: tx("The C₃ sugar phosphate formed in the reduction phase; part of it leaves the cycle.", "Das C₃-Zuckerphosphat, das in der Reduktionsphase entsteht; ein Teil verlässt den Zyklus."), accept: [tx("glyceraldehyde 3-phosphate", "Glycerinaldehyd-3-phosphat"), "G3P", "GAP", "Glycerinaldehydphosphat", "glyceraldehyde phosphate"], show: tx("glyceraldehyde 3-phosphate (G3P)", "Glycerinaldehyd-3-phosphat (GAP)"), near: [{ accept: [tx("3-phosphoglycerate", "3-Phosphoglycerat"), "3-PG"], title: tx("One step earlier", "Ein Schritt davor"), say: tx("3-PG is what gets reduced. The product of the reduction, the sugar phosphate, has another name.", "3-PG wird reduziert. Das Produkt der Reduktion, das Zuckerphosphat, heißt anders.") }] },
  { def: tx("The mobile electron carrier inside the thylakoid membrane between PS II and cytochrome b₆f.", "Der bewegliche Elektronenüberträger in der Thylakoidmembran zwischen PS II und Cytochrom-b₆f."), accept: [tx("plastoquinone", "Plastochinon"), "PQ"], show: tx("plastoquinone", "Plastochinon"), near: [{ accept: [tx("plastocyanin", "Plastocyanin"), "PC"], title: tx("That one's in the lumen", "Der ist im Lumen"), say: tx("Plastocyanin carries electrons in the lumen, after cytochrome b₆f. Inside the membrane moves another carrier.", "Plastocyanin trägt Elektronen im Lumen, nach Cytochrom-b₆f. In der Membran bewegt sich ein anderer Überträger.") }] },
  { def: tx("The small copper protein in the lumen that carries electrons to PS I.", "Das kleine Kupferprotein im Lumen, das Elektronen zum PS I bringt."), accept: [tx("plastocyanin", "Plastocyanin"), "PC"], show: tx("plastocyanin", "Plastocyanin"), near: [{ accept: [tx("plastoquinone", "Plastochinon"), "PQ"], title: tx("That one's in the membrane", "Der ist in der Membran"), say: tx("Plastoquinone moves inside the membrane. The carrier asked for is in the lumen.", "Plastochinon bewegt sich in der Membran. Gesucht ist der Überträger im Lumen.") }] },
  { def: tx("The splitting of water by light energy at photosystem II.", "Die Spaltung von Wasser mit Lichtenergie am Fotosystem II."), accept: [tx("photolysis", "Fotolyse"), "Photolyse", "photolysis of water"], show: tx("photolysis", "Fotolyse"), near: [{ accept: [tx("hydrolysis", "Hydrolyse")], title: tx("Split by light", "Durch Licht gespalten"), say: tx("In hydrolysis water splits **another** molecule. Here water itself is split, by light energy.", "Bei der Hydrolyse spaltet Wasser ein **anderes** Molekül. Hier wird das Wasser selbst gespalten, mit Lichtenergie.") }, { accept: [tx("electrolysis", "Elektrolyse")], title: tx("No electric current", "Kein elektrischer Strom"), say: tx("Electrolysis uses electric current. In the chloroplast the energy for splitting water comes from light.", "Die Elektrolyse nutzt elektrischen Strom. Im Chloroplasten kommt die Energie zur Wasserspaltung aus dem Licht.") }] },
  { def: tx("ATP synthesis driven by a proton gradient across a membrane (Mitchell's theory).", "ATP-Bildung, angetrieben von einem Protonengradienten über eine Membran (Theorie von Mitchell)."), accept: [tx("chemiosmosis", "Chemiosmose"), "chemiosmotische Kopplung", "chemiosmotic coupling"], show: tx("chemiosmosis", "Chemiosmose"), near: [{ accept: [tx("osmosis", "Osmose")], title: tx("Not water, protons", "Nicht Wasser, Protonen") , say: tx("Osmosis is about water. Here protons flow down their gradient and drive an enzyme.", "Bei Osmose geht es um Wasser. Hier fließen Protonen ihrem Gradienten nach und treiben ein Enzym an.") }] },
  { def: tx("A stack of thylakoids in the chloroplast.", "Ein Stapel von Thylakoiden im Chloroplasten."), accept: [tx("granum", "Granum"), "grana", "Grana"], show: tx("granum (plural grana)", "Granum (Plural Grana)"), near: [{ accept: [tx("stroma", "Stroma")], title: tx("That's the fluid", "Das ist die Flüssigkeit"), say: tx("The stroma is the fluid around the stacks. The stack itself has another name.", "Das Stroma ist die Flüssigkeit um die Stapel. Der Stapel selbst heißt anders.") }] },
  { def: tx("The enzyme that pre-fixes CO₂ in the mesophyll of C₄ plants.", "Das Enzym, das bei C₄-Pflanzen CO₂ im Mesophyll vorfixiert."), accept: [tx("PEP carboxylase", "PEP-Carboxylase"), "Phosphoenolpyruvat-Carboxylase", "PEPC", "phosphoenolpyruvate carboxylase"], show: tx("PEP carboxylase", "PEP-Carboxylase"), near: [{ accept: ["Rubisco"], title: tx("That's in the bundle sheath", "Das sitzt in der Bündelscheide"), say: tx("In C₄ plants Rubisco works in the bundle sheath. In the mesophyll another enzyme fixes CO₂ first.", "Bei C₄-Pflanzen arbeitet Rubisco in der Bündelscheide. Im Mesophyll fixiert zuerst ein anderes Enzym das CO₂.") }] },
];

function termTask(rng: Rng): Exercise {
  const t = rng.pick(TERMS);
  const answer: AnswerSpec = { kind: "word", accept: t.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const n of t.near ?? []) m.add({ kind: "word", accept: n.accept }, n.title, n.say);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: t.def,
    answer,
    hint: tx("The term is in the cheat sheet of this level.", "Der Begriff steht im Spickzettel dieser Stufe."),
    solution: [{ math: q(t.show, "a"), note: tx(`It's called **${en(t.show)}**.`, `Das heißt **${de(t.show)}**.`), highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  const r = rng.int(0, 27);
  if (r < 2) return locTask(rng);
  if (r < 4) return structureTask(rng);
  if (r < 6) return chainTask(rng);
  if (r < 9) return calvinNumTask(rng);
  if (r < 11) return calvinGraphTask(rng);
  if (r < 13) return phaseTask(rng);
  if (r < 14) return bacteriaTask(rng);
  if (r < 16) return rng.chance(0.5) ? specTask(rng) : pigmentTask(rng);
  if (r < 18) return typeTask(rng);
  if (r < 20) return inhibitorTask(rng);
  if (r < 22) return experimentTask(rng);
  if (r < 24) return o2Task(rng);
  return termTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const lightFrames: Frame[] = [
  {
    math: "\\ce{2H2O -> O2 + 4H+ + 4e-}",
    note: tx(
      "**Photolysis**: light-excited P680 in photosystem II pulls electrons out of water. Water is split; O₂ is released and the protons stay in the thylakoid lumen.",
      "**Fotolyse**: Das lichtangeregte P680 im Fotosystem II entreißt dem Wasser Elektronen. Wasser wird gespalten, O₂ wird frei, die Protonen bleiben im Thylakoidinnenraum.",
    ),
  },
  {
    math: "\\text{H₂O}#c0 \\to \\text{PS II}#c1 \\to \\text{PQ}#c2 \\to \\text{Cyt b₆f}#c3 \\\\ \\to \\text{PC}#c4 \\to \\text{PS I}#c5 \\to \\text{Fd}#c6 \\to \\ce{NADP+}#c7",
    note: tx(
      "The electrons travel along an **electron transport chain**. Light lifts them up twice, at PS II (P680) and at PS I (P700): the **Z-scheme**.",
      "Die Elektronen wandern entlang einer **Elektronentransportkette**. Licht hebt sie zweimal an, an PS II (P680) und an PS I (P700): das **Z-Schema**.",
    ),
    highlight: ["c1", "c5"],
  },
  {
    math: "\\ce{NADP+ + 2e- + H+ -> NADPH}",
    note: tx("At the end, the NADP⁺ reductase transfers the electrons to NADP⁺ in the stroma: **NADPH** is the reduced carrier for the Calvin cycle.", "Am Ende überträgt die NADP⁺-Reduktase die Elektronen im Stroma auf NADP⁺: **NADPH** ist der reduzierte Überträger für den Calvin-Zyklus."),
  },
  {
    math: tx('"H⁺ gradient"#g \\to \\text{ATP synthase}#s \\\\ \\ce{ADP + P -> ATP}', '"H⁺-Gradient"#g \\to \\text{ATP-Synthase}#s \\\\ \\ce{ADP + P -> ATP}'),
    note: tx(
      "Photolysis and plastoquinone fill the lumen with protons (pH about 5, stroma about 8). Flowing back through ATP synthase, they drive ATP formation: **chemiosmosis** (Mitchell).",
      "Fotolyse und Plastochinon füllen das Lumen mit Protonen (pH etwa 5, Stroma etwa 8). Beim Zurückströmen durch die ATP-Synthase treiben sie die ATP-Bildung an: **Chemiosmose** (Mitchell).",
    ),
    highlight: ["g"],
  },
  {
    math: "6 \\ce{CO2} + 12 \\ce{H2}\\blob{\\ce{O}} \\\\ \\to \\ce{C6H12O6} + 6 \\blob{\\ce{O2}} + 6 \\ce{H2O}",
    note: tx(
      "Proof that the O₂ comes from water: with water labelled by ¹⁸O, the released O₂ carries the label (Ruben and Kamen, 1941). That's why the full equation has 12 H₂O on the left.",
      "Beweis, dass das O₂ aus Wasser stammt: Mit ¹⁸O-markiertem Wasser trägt der freigesetzte Sauerstoff die Markierung (Ruben und Kamen, 1941). Deshalb stehen in der vollständigen Gleichung links 12 H₂O.",
    ),
  },
];

const balanceFrames: Frame[] = [
  {
    math: "\\ce{6CO2 + 18ATP + 12NADPH} \\\\ \\to \\ce{C6H12O6 + 18ADP + 18P + 12NADP+}",
    note: tx("Per glucose the Calvin cycle needs **6 CO₂, 18 ATP and 12 NADPH**: 12 ATP and 12 NADPH for the reduction, 6 ATP for the regeneration.", "Pro Glucose braucht der Calvin-Zyklus **6 CO₂, 18 ATP und 12 NADPH**: 12 ATP und 12 NADPH für die Reduktion, 6 ATP für die Regeneration."),
  },
  {
    math: tx('12 \\ce{NADPH} \\to 24 \\ce{e-} \\to 12 \\ce{H2O} \\to 6 \\ce{O2}', '12 \\ce{NADPH} \\to 24 \\ce{e-} \\to 12 \\ce{H2O} \\to 6 \\ce{O2}'),
    note: tx("The 12 NADPH carry 24 electrons. They come from 12 split water molecules, which release exactly the 6 O₂ of the overall equation.", "Die 12 NADPH tragen 24 Elektronen. Sie stammen aus 12 gespaltenen Wassermolekülen, und die setzen genau die 6 O₂ der Summengleichung frei."),
  },
  {
    math: tx('"light-independent"#a \\ne "works in the dark"#b', '"lichtunabhängig"#a \\ne "läuft im Dunkeln"#b'),
    note: tx(
      "Careful: the Calvin cycle needs no light **directly**, but it needs ATP and NADPH from the light reactions. In the dark it stops within a minute. So it runs during the day.",
      "Vorsicht: Der Calvin-Zyklus braucht kein Licht **direkt**, aber ATP und NADPH aus den Lichtreaktionen. Im Dunkeln stoppt er innerhalb einer Minute. Er läuft also tagsüber.",
    ),
    highlight: ["b"],
  },
  {
    math: tx('"light off:"#a \\; \\text{3-PG}#p "rises,"#r \\; \\text{RuBP}#q "falls"#f', '"Licht aus:"#a \\; \\text{3-PG}#p "steigt,"#r \\; \\text{RuBP}#q "sinkt"#f'),
    note: tx(
      "The proof in the lab: after the light goes off, 3-PG piles up (still formed, no longer reduced) and RuBP drops (still used, no longer regenerated).",
      "Der Beweis im Labor: Nach dem Ausschalten des Lichts staut sich 3-PG (entsteht weiter, wird nicht mehr reduziert), und RuBP nimmt ab (wird weiter verbraucht, nicht mehr regeneriert).",
    ),
  },
];

const checkO2 = o2Task(createRng(7), 0);
const checkGraph = calvinGraphTask(createRng(2), { ev: "dark", mol: "rubp", risingLabel: "A" });
const checkType = typeTask(createRng(5), FEATS[2]);
const checkNum = calvinNumTask(createRng(3), { kind: 0, n: 3 });

export const level3: LevelLesson = {
  lesson: [
    {
      type: "widget",
      title: tx("The chloroplast", "Der Chloroplast"),
      blob: tx("Welcome to the factory floor! Tap every part.", "Willkommen in der Werkshalle! Tipp jeden Teil an."),
      body: tx(
        "A chloroplast is enclosed by two membranes. Inside, the **thylakoids** are stacked into **grana** and surrounded by the **stroma**. The light-dependent reactions take place in the thylakoid membrane, the Calvin cycle in the stroma.",
        "Ein Chloroplast ist von zwei Membranen umgeben. Innen sind die **Thylakoide** zu **Grana** gestapelt und vom **Stroma** umgeben. Die lichtabhängigen Reaktionen laufen in der Thylakoidmembran ab, der Calvin-Zyklus im Stroma.",
      ),
      widget: PhotoChloroplastExplore,
    },
    {
      type: "widget",
      title: tx("Which light is used?", "Welches Licht wird genutzt?"),
      blob: tx("Engelmann used bacteria as oxygen detectors. Genius!", "Engelmann hat Bakterien als Sauerstoffmelder benutzt. Genial!"),
      body: tx(
        "The **absorption spectrum** shows how much light of each wavelength a pigment absorbs (measured in solution). The **action spectrum** shows how fast photosynthesis runs at each wavelength. In 1882 Engelmann lit a green alga with a spectrum: oxygen-seeking bacteria gathered in blue and red light.",
        "Das **Absorptionsspektrum** zeigt, wie viel Licht jeder Wellenlänge ein Pigment absorbiert (in Lösung gemessen). Das **Wirkungsspektrum** zeigt, wie schnell die Fotosynthese bei jeder Wellenlänge läuft. 1882 beleuchtete Engelmann eine Grünalge mit einem Spektrum: Sauerstoff suchende Bakterien sammelten sich im blauen und roten Licht.",
      ),
      widget: PhotoEngelmann,
    },
    {
      type: "explain",
      title: tx("The light-dependent reactions", "Die lichtabhängigen Reaktionen"),
      blob: tx("Water in, electrons on a rollercoaster, ATP and NADPH out!", "Wasser rein, Elektronen auf der Achterbahn, ATP und NADPH raus!"),
      frames: lightFrames,
    },
    {
      type: "widget",
      title: tx("On the thylakoid membrane", "An der Thylakoidmembran"),
      blob: tx("Play it, then step through slowly. Watch the protons pile up!", "Spiel es ab, dann geh Schritt für Schritt. Schau, wie sich die Protonen stauen!"),
      body: tx(
        "Non-cyclic electron transport from water to NADP⁺. The Z-scheme on the side shows the electron's energy: light lifts it twice. (In **cyclic** electron transport the electrons go from ferredoxin back to cytochrome b₆f: then only ATP forms, no NADPH and no O₂.)",
        "Nichtzyklischer Elektronentransport vom Wasser zum NADP⁺. Das Z-Schema daneben zeigt die Energie des Elektrons: Licht hebt es zweimal an. (Beim **zyklischen** Elektronentransport fließen die Elektronen vom Ferredoxin zurück zum Cytochrom-b₆f: Dann entsteht nur ATP, kein NADPH und kein O₂.)",
      ),
      widget: PhotoThylakoid,
    },
    { type: "check", blob: tx("The famous isotope experiment. Where does the label go?", "Der berühmte Isotopenversuch. Wohin wandert die Markierung?"), exercise: checkO2 },
    {
      type: "widget",
      title: tx("The Calvin cycle", "Der Calvin-Zyklus"),
      blob: tx("Count the carbons with me: nothing gets lost!", "Zähl die Kohlenstoffatome mit: Nichts geht verloren!"),
      body: tx(
        "The light-independent reactions in the stroma: **fixation** (Rubisco binds CO₂ to RuBP), **reduction** (3-PG becomes G3P with ATP and NADPH) and **regeneration** (RuBP is rebuilt with ATP). Black beads are carbon atoms, yellow ones phosphate groups.",
        "Die lichtunabhängigen Reaktionen im Stroma: **Fixierung** (Rubisco bindet CO₂ an RuBP), **Reduktion** (aus 3-PG wird mit ATP und NADPH das GAP) und **Regeneration** (mit ATP wird RuBP zurückgebildet). Schwarze Perlen sind Kohlenstoffatome, gelbe Phosphatgruppen.",
      ),
      widget: PhotoCalvin,
    },
    {
      type: "explain",
      title: tx("Balance and the link to light", "Bilanz und Abhängigkeit vom Licht"),
      blob: tx("Light-independent, but not independent of light. Tricky!", "Lichtunabhängig, aber nicht unabhängig vom Licht. Knifflig!"),
      frames: balanceFrames,
    },
    { type: "check", blob: tx("An exam classic: the light goes off.", "Ein Prüfungsklassiker: Das Licht geht aus."), exercise: checkGraph },
    {
      type: "widget",
      title: tx("C₄ and CAM plants", "C₄- und CAM-Pflanzen"),
      blob: tx("Hot and dry? Plants have two clever tricks.", "Heiß und trocken? Pflanzen haben zwei schlaue Tricks."),
      body: tx(
        "In heat, plants close their stomata to save water. Then CO₂ runs short, and Rubisco also binds O₂ (**photorespiration**). C₄ and CAM plants first fix CO₂ with **PEP carboxylase**, which doesn't bind O₂, and release it again for Rubisco.",
        "Bei Hitze schließen Pflanzen ihre Spaltöffnungen, um Wasser zu sparen. Dann wird CO₂ knapp, und Rubisco bindet auch O₂ (**Fotorespiration**). C₄- und CAM-Pflanzen fixieren CO₂ zuerst mit der **PEP-Carboxylase**, die kein O₂ bindet, und setzen es für Rubisco wieder frei.",
      ),
      widget: PhotoC4Cam,
    },
    { type: "check", blob: tx("Space or time? Sort it out.", "Räumlich oder zeitlich? Sortier es."), exercise: checkType },
    { type: "check", blob: tx("Last one: a little balance sheet.", "Zum Schluss: eine kleine Bilanz."), exercise: checkNum },
  ],
  summary: [
    {
      title: tx("Chloroplast", "Chloroplast"),
      body: tx(
        "Double envelope membrane, stroma, thylakoids stacked into grana (lumen inside). Light reactions in the thylakoid membrane, Calvin cycle in the stroma. Own ring DNA and 70S ribosomes.",
        "Doppelte Hüllmembran, Stroma, Thylakoide zu Grana gestapelt (innen das Lumen). Lichtreaktionen in der Thylakoidmembran, Calvin-Zyklus im Stroma. Eigene Ring-DNA und 70S-Ribosomen.",
      ),
      tone: "rule",
    },
    {
      title: tx("Light-dependent reactions", "Lichtabhängige Reaktionen"),
      body: tx(
        "PS II (P680) → plastoquinone → cytochrome b₆f → plastocyanin → PS I (P700) → ferredoxin → NADP⁺ reductase. The proton gradient (lumen pH 5, stroma pH 8) drives ATP synthase: chemiosmosis.",
        "PS II (P680) → Plastochinon → Cytochrom-b₆f → Plastocyanin → PS I (P700) → Ferredoxin → NADP⁺-Reduktase. Der Protonengradient (Lumen pH 5, Stroma pH 8) treibt die ATP-Synthase an: Chemiosmose.",
      ),
      examples: ["\\ce{2H2O -> O2 + 4H+ + 4e-}", "\\ce{NADP+ + 2e- + H+ -> NADPH}"],
      tone: "rule",
    },
    {
      title: tx("Calvin cycle", "Calvin-Zyklus"),
      body: tx(
        "Fixation (Rubisco: RuBP + CO₂ → 2 × 3-PG), reduction (3-PG → G3P with ATP and NADPH), regeneration (G3P → RuBP with ATP).",
        "Fixierung (Rubisco: RuBP + CO₂ → 2 × 3-PG), Reduktion (3-PG → GAP mit ATP und NADPH), Regeneration (GAP → RuBP mit ATP).",
      ),
      examples: [tx('"per glucose:" \\; 6 \\ce{CO2} , \\; 18 \\ce{ATP} , \\; 12 \\ce{NADPH}', '"pro Glucose:" \\; 6 \\ce{CO2} , \\; 18 \\ce{ATP} , \\; 12 \\ce{NADPH}')],
      tone: "rule",
    },
    {
      title: tx("Spectra", "Spektren"),
      body: tx(
        "Chlorophylls absorb blue and red, carotenoids blue-green; green is hardly absorbed (green gap). The action spectrum (Engelmann) matches the pigments' absorption together.",
        "Chlorophylle absorbieren Blau und Rot, Carotinoide Blaugrün; Grün wird kaum absorbiert (Grünlücke). Das Wirkungsspektrum (Engelmann) entspricht der Absorption aller Pigmente zusammen.",
      ),
      tone: "tip",
    },
    {
      title: tx("C₄ and CAM", "C₄ und CAM"),
      body: tx(
        "Both pre-fix CO₂ with PEP carboxylase (no O₂ binding). C₄: separation in space, mesophyll and bundle sheath (maize). CAM: separation in time, night and day, malic acid in the vacuole (cacti, pineapple).",
        "Beide fixieren CO₂ zuerst mit der PEP-Carboxylase (bindet kein O₂). C₄: räumliche Trennung, Mesophyll und Bündelscheide (Mais). CAM: zeitliche Trennung, Nacht und Tag, Äpfelsäure in der Vakuole (Kakteen, Ananas).",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "The O₂ comes from water, not from CO₂. Electrons pass PS II before PS I (numbered by discovery). The Calvin cycle needs ATP and NADPH from the light: it stops in the dark.",
        "Das O₂ stammt aus Wasser, nicht aus CO₂. Elektronen durchlaufen PS II vor PS I (nach Entdeckung nummeriert). Der Calvin-Zyklus braucht ATP und NADPH aus dem Licht: Im Dunkeln stoppt er.",
      ),
      tone: "warning",
    },
  ],
};
