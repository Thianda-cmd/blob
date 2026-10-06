// Level 2 practice (Klasse 7–9): organelles and their jobs, bacteria (prokaryotes) versus
// eukaryotic cells, total magnification, actual size and the limits of the light microscope.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";
import { CellAnimalCell } from "@/learn/biology/visuals/CellAnimalCell";
import { CellBacterium } from "@/learn/biology/visuals/CellBacterium";
import { CellPlantCell } from "@/learn/biology/visuals/CellPlantCell";
import { BACTERIUM, MAG_OBJECTS, ORGANELLES, SIZES, type Part } from "./data";
import { capT, choice, de, en, frame, join, matchMistake, mistakes, multi, orderMistake, q, visual, type Opt } from "./kit";

/** Build the same text in both languages from one function. */
const L = (f: (l: "en" | "de") => string): Text => tx(f("en"), f("de"));
/** A number in one language: "0.05" / "0,05". */
const n = (v: number, l: "en" | "de", digits = 4) => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits, useGrouping: false }).format(v);
const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------------------
// Which organelle is it? (electron microscope drawings)

const ANIMAL_ASK = ["mitochondrion", "er", "ser", "golgi", "lysosome", "vesicle", "ribosome", "envelope", "pore"];
const PLANT_ASK = ["mitochondrion", "er", "golgi", "ribosome", "chloroplast", "vacuole", "wall"];
const CONFUSE: Record<string, string[]> = {
  mitochondrion: ["chloroplast", "lysosome", "golgi"],
  chloroplast: ["mitochondrion", "vacuole", "nucleus"],
  er: ["golgi", "ser", "mitochondrion"],
  ser: ["er", "golgi", "lysosome"],
  golgi: ["er", "ser", "mitochondrion"],
  lysosome: ["vesicle", "golgi", "mitochondrion"],
  vesicle: ["lysosome", "ribosome", "golgi"],
  ribosome: ["vesicle", "lysosome", "mitochondrion"],
  envelope: ["membrane", "er", "pore"],
  pore: ["envelope", "ribosome", "vesicle"],
  vacuole: ["nucleus", "chloroplast", "lysosome"],
  wall: ["membrane", "envelope", "vacuole"],
};

const LOOK_SAY: Record<string, [Text, Text]> = {
  "mitochondrion>chloroplast": [tx("Folds, not stacks", "Falten, keine Stapel"), tx("Chloroplasts are green with stacks of membranes. This one has a folded inner membrane: here energy is released, not sugar built.", "Chloroplasten sind grün und haben Membranstapel. Dieses hat eine gefaltete Innenmembran: Hier wird Energie freigesetzt, nicht Zucker gebaut.")],
  "chloroplast>mitochondrion": [tx("Stacks, not folds", "Stapel, keine Falten"), tx("Mitochondria have a folded inner membrane (cristae). Here you see stacks of membranes, and it's green.", "Mitochondrien haben eine gefaltete Innenmembran (Cristae). Hier siehst du Membranstapel, und es ist grün.")],
  "er>golgi": [tx("Look for the dots", "Achte auf die Punkte"), tx("The Golgi apparatus is a stack of curved sacs **without** ribosomes. These channels next to the nucleus are dotted with ribosomes.", "Der Golgi-Apparat ist ein Stapel gebogener Säckchen **ohne** Ribosomen. Diese Kanäle am Kern sind mit Ribosomen besetzt.")],
  "golgi>er": [tx("No dots here", "Hier keine Punkte"), tx("The rough ER sits right by the nucleus and is dotted with ribosomes. This is a separate stack with no dots and little bubbles at its rims.", "Das raue ER liegt direkt am Kern und ist mit Ribosomen besetzt. Das hier ist ein eigener Stapel ohne Punkte, mit Bläschen am Rand.")],
  "er>ser": [tx("Rough or smooth?", "Rau oder glatt?"), tx("Smooth ER has no ribosomes. Can you see the dots on these channels?", "Glattes ER hat keine Ribosomen. Siehst du die Punkte auf diesen Kanälen?")],
  "ser>er": [tx("Rough or smooth?", "Rau oder glatt?"), tx("Rough ER is studded with ribosomes. These tubes are smooth: no dots.", "Raues ER ist mit Ribosomen besetzt. Diese Röhren sind glatt: keine Punkte.")],
  "lysosome>vesicle": [tx("Look inside", "Schau hinein"), tx("Nearly! Lysosomes are special vesicles full of digestive enzymes: look at the dots inside.", "Fast! Lysosomen sind besondere Bläschen voller Verdauungsenzyme: Achte auf die Pünktchen darin.")],
  "vesicle>lysosome": [tx("Look inside", "Schau hinein"), tx("Lysosomes are full of digestive enzymes (the dots). These little bubbles are empty: transport vesicles.", "Lysosomen sind voller Verdauungsenzyme (die Pünktchen). Diese kleinen Bläschen sind leer: Transportbläschen.")],
  "envelope>membrane": [tx("Which boundary?", "Welche Grenze?"), tx("The cell membrane is the outer boundary of the whole cell. Here it's about the double membrane around the nucleus.", "Die Zellmembran ist die äußere Grenze der ganzen Zelle. Hier geht es um die Doppelmembran um den Kern.")],
  "pore>envelope": [tx("The gaps", "Die Lücken"), tx("The nuclear envelope is the double membrane itself. The question is about the gaps in it.", "Die Kernhülle ist die Doppelmembran selbst. Gefragt sind die Lücken darin.")],
  "envelope>pore": [tx("The membrane itself", "Die Membran selbst"), tx("The pores are the gaps. The question is about the double membrane itself.", "Die Kernporen sind die Lücken. Gefragt ist die Doppelmembran selbst.")],
  "ribosome>vesicle": [tx("No membrane", "Keine Membran"), tx("Vesicles are bubbles wrapped in a membrane. These tiny dots have no membrane: they are protein factories.", "Vesikel sind Bläschen mit einer Membran. Diese winzigen Punkte haben keine Membran: Es sind Eiweißfabriken.")],
  "wall>membrane": [tx("Wall or membrane?", "Wand oder Membran?"), tx("The cell membrane is the thin line under the wall. The question is about the thick outer layer.", "Die Zellmembran ist die dünne Linie unter der Wand. Gefragt ist die dicke Außenschicht.")],
};

function lookSay(asked: Part, picked: Part): [Text, Text] {
  return LOOK_SAY[`${asked.id}>${picked.id}`] ?? [tx("Look again", "Schau noch mal hin"), tx(`The ${en(picked.name)} is ${en(picked.look)}. The question mark marks ${en(asked.look)}.`, `${de(picked.name)}: ${de(picked.look)}. Mit dem Fragezeichen ist ${de(asked.look)} markiert.`)];
}

function organelleNameTask(rng: Rng): Exercise {
  const plant = rng.chance(0.4);
  const id = rng.pick(plant ? PLANT_ASK : ANIMAL_ASK);
  const P = ORGANELLES[id];
  const opts: Opt[] = [{ text: capT(P.name) }];
  for (const w of CONFUSE[id]) {
    const [title, say] = lookSay(P, ORGANELLES[w]);
    opts.push({ text: capT(ORGANELLES[w].name), title, say });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Name the organelle", "Benenne das Organell"),
    text: plant ? tx("A plant cell in the electron microscope. What is marked with **?**", "Eine Pflanzenzelle im Elektronenmikroskop. Was ist mit **?** markiert?") : tx("An animal cell in the electron microscope. What is marked with **?**", "Eine Tierzelle im Elektronenmikroskop. Was ist mit **?** markiert?"),
    visual: plant ? visual(CellPlantCell, { mode: "numbers", ask: id, show: [id], legend: "none", detail: "em" }) : visual(CellAnimalCell, { mode: "numbers", ask: id, show: [id], legend: "none", detail: "em" }),
    answer,
    hint: tx("Look at the details: dots (ribosomes) or none, folded or stacked membranes, empty or filled bubbles.", "Achte auf Details: Punkte (Ribosomen) oder nicht, gefaltete oder gestapelte Membranen, leere oder gefüllte Bläschen."),
    solution: [frame(q(P.name, "n"), tx(`It's the **${en(P.name)}**: ${en(P.look)}. Its job: ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.look)}. Aufgabe: ${de(P.job)}.`), ["n"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Organelles and their jobs

const JOB_POOL = ["mitochondrion", "chloroplast", "ribosome", "er", "golgi", "lysosome", "nucleus", "pore", "vacuole", "ser"];
const JOB_SAY: Record<string, [Text, Text]> = {
  "mitochondrion>chloroplast": [tx("Breaking down or building?", "Abbauen oder aufbauen?"), tx("Chloroplasts build sugar with light energy. Mitochondria do the opposite: they break sugar down and release its energy.", "Chloroplasten bauen mit Lichtenergie Zucker auf. Mitochondrien machen das Gegenteil: Sie bauen Zucker ab und setzen seine Energie frei.")],
  "chloroplast>mitochondrion": [tx("Breaking down or building?", "Abbauen oder aufbauen?"), tx("Releasing energy from sugar is cellular respiration, and it happens elsewhere. Chloroplasts build the sugar in the first place.", "Energie aus Zucker freisetzen ist Zellatmung, und die passiert woanders. Chloroplasten bauen den Zucker überhaupt erst auf.")],
  "ribosome>nucleus": [tx("Plan or factory?", "Bauplan oder Fabrik?"), tx("The nucleus holds the plan (DNA). The proteins themselves are assembled at tiny grains outside the nucleus.", "Im Zellkern liegt der Bauplan (DNA). Zusammengebaut werden die Proteine an winzigen Körnchen außerhalb des Kerns.")],
  "nucleus>ribosome": [tx("Plan or factory?", "Bauplan oder Fabrik?"), tx("Ribosomes build proteins, but they need a plan. The plan, the DNA, is kept somewhere else.", "Ribosomen bauen Proteine, aber dafür brauchen sie einen Bauplan. Der Bauplan, die DNA, liegt woanders.")],
  "golgi>er": [tx("Making or packing?", "Herstellen oder verpacken?"), tx("The rough ER makes proteins and passes them on. Modifying and packing happens afterwards, in the stack of flat sacs.", "Das raue ER stellt Proteine her und leitet sie weiter. Verändern und verpacken passiert danach im Stapel flacher Säckchen.")],
  "er>golgi": [tx("Making or packing?", "Herstellen oder verpacken?"), tx("The Golgi apparatus comes later: it packs. The proteins are made at the ribosomes on the ER.", "Der Golgi-Apparat kommt erst danach: Er verpackt. Hergestellt werden die Proteine an den Ribosomen auf dem ER.")],
  "lysosome>vacuole": [tx("Storing or digesting?", "Speichern oder verdauen?"), tx("The plant vacuole stores cell sap. Digesting worn-out parts is done by small bags full of enzymes.", "Die Vakuole der Pflanze speichert Zellsaft. Alte Zellteile verdauen kleine Bläschen voller Enzyme.")],
  "vacuole>lysosome": [tx("Storing or digesting?", "Speichern oder verdauen?"), tx("Lysosomes digest with enzymes. Storing cell sap and keeping the cell firm is the job of the big space in plant cells.", "Lysosomen verdauen mit Enzymen. Zellsaft speichern und die Zelle prall halten macht der große Raum in Pflanzenzellen.")],
  "pore>envelope": [tx("Gate or wall?", "Tor oder Wand?"), tx("The envelope is the wall around the nucleus. mRNA needs a way out: the openings in it.", "Die Kernhülle ist die Wand um den Kern. Die mRNA braucht einen Ausgang: die Öffnungen darin.")],
  "ser>er": [tx("Rough or smooth?", "Rau oder glatt?"), tx("Without ribosomes the smooth ER can't make proteins. It makes lipids instead.", "Ohne Ribosomen kann das glatte ER keine Proteine herstellen. Es bildet stattdessen Lipide.")],
  "er>ser": [tx("Rough or smooth?", "Rau oder glatt?"), tx("Proteins need ribosomes: that's the rough ER. The smooth one has none.", "Für Proteine braucht man Ribosomen: Das ist das raue ER. Das glatte hat keine.")],
};

function jobSay(right: Part, picked: Part): [Text, Text] {
  return JOB_SAY[`${right.id}>${picked.id}`] ?? [tx("Another job", "Eine andere Aufgabe"), tx(`The ${en(picked.name)}: ${en(picked.job)}. That doesn't quite fit the description.`, `${de(picked.name)}: ${de(picked.job)}. Das passt nicht ganz zur Beschreibung.`)];
}

function organelleMatchTask(rng: Rng): Exercise {
  // often keep a classic pair together, so the classic swap can happen
  const pairsWanted = rng.pick([["mitochondrion", "chloroplast"], ["er", "golgi"], ["ribosome", "nucleus"], ["lysosome", "vacuole"], []]);
  const rest = rng.shuffle(JOB_POOL.filter((x) => !pairsWanted.includes(x)));
  const used = rng.shuffle([...pairsWanted, ...rest.slice(0, rng.int(4, 5) - pairsWanted.length)]);
  const extra = rest.find((x) => !used.includes(x))!;
  const pairs = used.map((id) => [capT(ORGANELLES[id].name), ORGANELLES[id].job] as [Text, Text]);
  const list: Mistake[] = [];
  for (const a of used)
    for (const b of [...used, extra]) {
      const say = JOB_SAY[`${a}>${b}`];
      if (a !== b && say && list.length < 4) list.push(matchMistake([[capT(ORGANELLES[a].name), ORGANELLES[b].job]], say[0], say[1]));
    }
  return {
    instruction: tx("Organelles and their jobs", "Organellen und ihre Aufgaben"),
    text: tx("Match each organelle to its job. One job is left over.", "Ordne jedem Organell seine Aufgabe zu. Eine Aufgabe bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [ORGANELLES[extra].job] },
    hint: tx("Think of a factory: control room, power station, assembly line, packing station, recycling.", "Denk an eine Fabrik: Steuerzentrale, Kraftwerk, Fließband, Packstation, Recycling."),
    solution: used.map((id, i) => frame(join(q(ORGANELLES[id].name, `a${i}`), "\\to", q(ORGANELLES[id].job, `b${i}`)), tx(`${en(capT(ORGANELLES[id].name))}: ${en(ORGANELLES[id].job)}.`, `${de(ORGANELLES[id].name)}: ${de(ORGANELLES[id].job)}.`))),
    mistakes: list,
  };
}

const WHICH: { id: string; q: Text }[] = [
  { id: "mitochondrion", q: tx("Where is energy (ATP) released from glucose by cellular respiration?", "Wo wird durch Zellatmung Energie (ATP) aus Traubenzucker freigesetzt?") },
  { id: "chloroplast", q: tx("Where is glucose built from carbon dioxide and water using light energy?", "Wo wird mit Lichtenergie aus Kohlenstoffdioxid und Wasser Traubenzucker aufgebaut?") },
  { id: "ribosome", q: tx("Where are amino acids joined into proteins?", "Wo werden Aminosäuren zu Proteinen verknüpft?") },
  { id: "golgi", q: tx("Which organelle modifies proteins, sorts them and packs them into vesicles?", "Welches Organell verändert Proteine, sortiert sie und verpackt sie in Vesikel?") },
  { id: "lysosome", q: tx("Which organelle breaks down worn-out cell parts and bacteria with digestive enzymes?", "Welches Organell baut mit Verdauungsenzymen alte Zellteile und Bakterien ab?") },
  { id: "er", q: tx("Which membrane system, dotted with ribosomes, makes proteins and carries them on?", "Welches mit Ribosomen besetzte Membransystem stellt Proteine her und transportiert sie weiter?") },
  { id: "nucleus", q: tx("Where is most of the DNA of a plant or animal cell kept?", "Wo liegt der größte Teil der DNA einer Pflanzen- oder Tierzelle?") },
  { id: "pore", q: tx("Through which openings does mRNA leave the nucleus?", "Durch welche Öffnungen verlässt die mRNA den Zellkern?") },
];
const WHICH_WRONG: Record<string, string[]> = {
  mitochondrion: ["chloroplast", "ribosome", "golgi"],
  chloroplast: ["mitochondrion", "vacuole", "nucleus"],
  ribosome: ["nucleus", "golgi", "lysosome"],
  golgi: ["er", "lysosome", "ribosome"],
  lysosome: ["vacuole", "golgi", "mitochondrion"],
  er: ["golgi", "ser", "nucleus"],
  nucleus: ["ribosome", "mitochondrion", "golgi"],
  pore: ["envelope", "vesicle", "membrane"],
};

function whichOrganelleTask(rng: Rng): Exercise {
  const W = rng.pick(WHICH);
  const P = ORGANELLES[W.id];
  const opts: Opt[] = [{ text: capT(P.name) }];
  for (const w of WHICH_WRONG[W.id]) {
    const [title, say] = jobSay(P, ORGANELLES[w]);
    opts.push({ text: capT(ORGANELLES[w].name), title, say });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Which organelle?", "Welches Organell?"),
    text: W.q,
    answer,
    hint: tx("Picture the cell as a factory: which department does this?", "Stell dir die Zelle als Fabrik vor: Welche Abteilung macht das?"),
    solution: [frame(q(P.name, "n"), tx(`The **${en(P.name)}**: ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.job)}.`), ["n"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The bacterial cell

const BACT_ASK = ["capsule", "wall", "membrane", "nucleoid", "plasmid", "ribosome", "flagellum", "pili"];
const BACT_WRONG: Record<string, { accept: Text[]; title: Text; say: Text }[]> = {
  nucleoid: [
    { accept: [tx("nucleus", "Zellkern"), "Kern"], title: tx("No nucleus!", "Kein Zellkern!"), say: tx("Bacteria have no nucleus: there's no envelope around this DNA. It lies free in the cytoplasm.", "Bakterien haben keinen Zellkern: Um diese DNA ist keine Hülle. Sie liegt frei im Zellplasma.") },
    { accept: [tx("plasmid", "Plasmid")], title: tx("Big ring or small ring?", "Großer oder kleiner Ring?"), say: tx("Plasmids are the small extra rings. This is the big tangled one with the main genetic information.", "Plasmide sind die kleinen Extra-Ringe. Das hier ist der große verknäulte mit der Haupt-Erbinformation.") },
  ],
  plasmid: [{ accept: [tx("bacterial chromosome", "Bakterienchromosom"), "Nucleoid", "Ring-DNA"], title: tx("Big ring or small ring?", "Großer oder kleiner Ring?"), say: tx("The bacterial chromosome is the big tangled loop in the middle. The question is about the small extra rings.", "Das Bakterienchromosom ist die große verknäulte Schleife in der Mitte. Gefragt sind die kleinen Extra-Ringe.") }],
  capsule: [{ accept: [tx("cell wall", "Zellwand")], title: tx("One layer further out", "Eine Schicht weiter außen"), say: tx("The cell wall is the firm brown layer. The question is about the slimy layer outside it.", "Die Zellwand ist die feste braune Schicht. Gefragt ist die schleimige Schicht außen darum.") }],
  wall: [
    { accept: [tx("capsule", "Kapsel"), "Schleimkapsel"], title: tx("One layer further in", "Eine Schicht weiter innen"), say: tx("The capsule is the slimy layer with the dashed edge outside. The question is about the firm layer under it.", "Die Kapsel ist die Schleimschicht mit dem gestrichelten Rand außen. Gefragt ist die feste Schicht darunter.") },
    { accept: [tx("cell membrane", "Zellmembran"), "Membran"], title: tx("Wall or membrane?", "Wand oder Membran?"), say: tx("The membrane is the thin line inside. The question is about the firm brown layer.", "Die Membran ist die dünne Linie innen. Gefragt ist die feste braune Schicht.") },
  ],
  membrane: [{ accept: [tx("cell wall", "Zellwand")], title: tx("Wall or membrane?", "Wand oder Membran?"), say: tx("The cell wall is the firm brown layer. The question is about the thin line just inside it.", "Die Zellwand ist die feste braune Schicht. Gefragt ist die dünne Linie direkt darin.") }],
  flagellum: [{ accept: [tx("pili", "Pili"), "Fimbrien"], title: tx("Long or short?", "Lang oder kurz?"), say: tx("Pili are the short hairs for sticking. The long wavy thread turns like a propeller.", "Pili sind die kurzen Härchen zum Anheften. Der lange gewellte Faden dreht sich wie ein Propeller.") }],
  pili: [{ accept: [tx("flagellum", "Geißel"), "Flagellum"], title: tx("Long or short?", "Lang oder kurz?"), say: tx("The flagellum is the one long wavy thread for swimming. The question is about the short hairs.", "Die Geißel ist der eine lange gewellte Faden zum Schwimmen. Gefragt sind die kurzen Härchen.") }],
  ribosome: [{ accept: [tx("mitochondria", "Mitochondrien"), "Mitochondrium"], title: tx("No mitochondria", "Keine Mitochondrien"), say: tx("Bacteria have no mitochondria at all. These tiny dots make proteins.", "Bakterien haben gar keine Mitochondrien. Diese winzigen Punkte stellen Proteine her.") }],
};

function bacteriumNameTask(rng: Rng): Exercise {
  const id = rng.pick(BACT_ASK);
  const P = BACTERIUM[id];
  const answer: AnswerSpec = { kind: "word", accept: P.accept, placeholder: tx("name of the structure", "Name des Bestandteils") };
  const m = mistakes(answer);
  for (const w of BACT_WRONG[id] ?? []) m.add({ kind: "word", accept: w.accept }, w.title, w.say);
  return {
    instruction: tx("The bacterial cell", "Die Bakterienzelle"),
    text: tx("What is the structure marked **?** called?", "Wie heißt der mit **?** markierte Bestandteil?"),
    visual: visual(CellBacterium, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("From outside in: capsule, cell wall, membrane. Inside: DNA rings and ribosomes. Outside: hairs and a long thread.", "Von außen nach innen: Kapsel, Zellwand, Membran. Innen: DNA-Ringe und Ribosomen. Außen: Härchen und ein langer Faden."),
    solution: [frame(q(P.name, "n"), tx(`It's the **${en(P.name)}**: ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.job)}.`), ["n"])],
    mistakes: m.list,
  };
}

const PRO_EU: Text[] = [tx("Only prokaryotes (bacteria)", "Nur Prokaryoten (Bakterien)"), tx("Only eukaryotes", "Nur Eukaryoten"), tx("Both", "Beide")];
type Feature = { text: Text; right: 0 | 1 | 2; say: Partial<Record<0 | 1 | 2, [Text, Text]>> };
const FEATURES: Feature[] = [
  {
    text: tx("a nucleus with a nuclear envelope", "einen Zellkern mit Kernhülle"),
    right: 1,
    say: { 2: [tx("That's the difference", "Genau das ist der Unterschied"), tx("Pro-karyote means 'before the nucleus': bacteria have no nucleus.", "Pro-karyot heißt „vor dem Kern“: Bakterien haben keinen Zellkern.")], 0: [tx("The other way round", "Andersrum"), tx("Eu-karyote means 'true nucleus'. Bacteria are the ones without one.", "Eu-karyot heißt „echter Kern“. Bakterien sind die ohne.")] },
  },
  {
    text: tx("mitochondria", "Mitochondrien"),
    right: 1,
    say: { 2: [tx("No organelles with membranes", "Keine Organellen mit Membran"), tx("Bacteria have no mitochondria. Their cellular respiration takes place at the cell membrane.", "Bakterien haben keine Mitochondrien. Ihre Zellatmung läuft an der Zellmembran ab.")], 0: [tx("The other way round", "Andersrum"), tx("Mitochondria are organelles of cells with a nucleus.", "Mitochondrien sind Organellen von Zellen mit Zellkern.")] },
  },
  {
    text: tx("a Golgi apparatus and an ER", "einen Golgi-Apparat und ein ER"),
    right: 1,
    say: { 2: [tx("No organelles with membranes", "Keine Organellen mit Membran"), tx("Bacteria have no inner membrane systems like ER or Golgi apparatus.", "Bakterien haben keine inneren Membransysteme wie ER oder Golgi-Apparat.")], 0: [tx("The other way round", "Andersrum"), tx("ER and Golgi apparatus belong to cells with a nucleus.", "ER und Golgi-Apparat gehören zu Zellen mit Zellkern.")] },
  },
  {
    text: tx("DNA as genetic material", "DNA als Erbsubstanz"),
    right: 2,
    say: { 1: [tx("No nucleus, but DNA", "Kein Kern, aber DNA"), tx("Bacteria do have DNA, just no nucleus: their ring-shaped chromosome lies free in the cytoplasm.", "Bakterien haben sehr wohl DNA, nur keinen Zellkern: Ihr ringförmiges Chromosom liegt frei im Zellplasma.")], 0: [tx("All cells", "Alle Zellen"), tx("Every cell needs DNA as its plan, ours too.", "Jede Zelle braucht DNA als Bauplan, unsere auch.")] },
  },
  {
    text: tx("ribosomes", "Ribosomen"),
    right: 2,
    say: { 1: [tx("No proteins without ribosomes", "Ohne Ribosomen keine Proteine"), tx("Bacteria need proteins too, so they have ribosomes, just smaller ones (70S).", "Auch Bakterien brauchen Proteine, also haben sie Ribosomen, nur kleinere (70S).")], 0: [tx("All cells", "Alle Zellen"), tx("Our cells build proteins at ribosomes too.", "Auch unsere Zellen bauen Proteine an Ribosomen.")] },
  },
  {
    text: tx("a cell membrane", "eine Zellmembran"),
    right: 2,
    say: { 1: [tx("Every cell has one", "Jede Zelle hat eine"), tx("Every cell is enclosed by a cell membrane, a bacterium too.", "Jede Zelle ist von einer Zellmembran umgeben, auch ein Bakterium.")], 0: [tx("Every cell has one", "Jede Zelle hat eine"), tx("Our cells are enclosed by a membrane too.", "Auch unsere Zellen sind von einer Membran umgeben.")] },
  },
  {
    text: tx("a single ring-shaped chromosome lying free in the cytoplasm", "ein einzelnes ringförmiges Chromosom, das frei im Zellplasma liegt"),
    right: 0,
    say: { 1: [tx("Free, not in a nucleus", "Frei, nicht im Kern"), tx("Eukaryotes keep several linear chromosomes inside the nucleus. A single ring lying free is typical of bacteria.", "Eukaryoten haben mehrere lineare Chromosomen im Zellkern. Ein einzelner freier Ring ist typisch für Bakterien.")], 2: [tx("Free, not in a nucleus", "Frei, nicht im Kern"), tx("In eukaryotes the chromosomes sit in the nucleus. Free in the cytoplasm only in bacteria.", "Bei Eukaryoten liegen die Chromosomen im Zellkern. Frei im Zellplasma nur bei Bakterien.")] },
  },
  {
    text: tx("a cell wall made of murein", "eine Zellwand aus Murein"),
    right: 0,
    say: { 2: [tx("Which material?", "Welches Material?"), tx("Plant cell walls are made of cellulose, fungal walls of chitin, and animal cells have none. Murein is found only in bacteria.", "Pflanzliche Zellwände bestehen aus Cellulose, die von Pilzen aus Chitin, Tierzellen haben gar keine. Murein gibt es nur bei Bakterien.")], 1: [tx("Which material?", "Welches Material?"), tx("Plants use cellulose. Murein is the wall material of bacteria.", "Pflanzen nehmen Cellulose. Murein ist das Wandmaterial der Bakterien.")] },
  },
];

function proEuTask(rng: Rng): Exercise {
  const F = rng.pick(FEATURES);
  const opts: Opt[] = [{ text: PRO_EU[F.right] }];
  for (const w of [0, 1, 2] as const) if (w !== F.right) opts.push({ text: PRO_EU[w], title: F.say[w]?.[0], say: F.say[w]?.[1] });
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Prokaryote or eukaryote?", "Prokaryot oder Eukaryot?"),
    text: tx(`Which cells have **${en(F.text)}**?`, `Welche Zellen haben **${de(F.text)}**?`),
    answer,
    hint: tx("Bacteria have DNA, ribosomes, a membrane and usually a wall, but no nucleus and no organelles with membranes.", "Bakterien haben DNA, Ribosomen, Membran und meist eine Wand, aber keinen Zellkern und keine Organellen mit Membran."),
    solution: [frame(join(q(F.text, "f"), "\\Rightarrow", q(PRO_EU[F.right], "a")), F.right === 2 ? tx("All cells have this, bacteria and eukaryotes alike.", "Das haben alle Zellen, Bakterien wie Eukaryoten.") : F.right === 1 ? tx("Only cells with a true nucleus (eukaryotes) have this.", "Das haben nur Zellen mit echtem Zellkern (Eukaryoten).") : tx("This is typical of bacteria (prokaryotes).", "Das ist typisch für Bakterien (Prokaryoten)."), ["a"])],
    mistakes: list,
  };
}

const BACT_HAS: { id: string; text: Text; right: boolean }[] = [
  { id: "membrane", text: tx("cell membrane", "Zellmembran"), right: true },
  { id: "ribosome", text: tx("ribosomes", "Ribosomen"), right: true },
  { id: "dna", text: tx("DNA (bacterial chromosome)", "DNA (Bakterienchromosom)"), right: true },
  { id: "wall", text: tx("cell wall", "Zellwand"), right: true },
  { id: "plasmid", text: tx("plasmids", "Plasmide"), right: true },
  { id: "nucleus", text: tx("nucleus", "Zellkern"), right: false },
  { id: "mito", text: tx("mitochondria", "Mitochondrien"), right: false },
  { id: "chloro", text: tx("chloroplasts", "Chloroplasten"), right: false },
  { id: "golgi", text: tx("Golgi apparatus", "Golgi-Apparat"), right: false },
];

function bacteriaMultiTask(rng: Rng): Exercise {
  const rights = rng.shuffle(BACT_HAS.filter((x) => x.right)).slice(0, rng.int(3, 4));
  const wrongs = rng.shuffle(BACT_HAS.filter((x) => !x.right)).slice(0, 6 - rights.length);
  const M = multi(rng, [...rights, ...wrongs].map((x) => ({ text: capT(x.text), right: x.right, id: x.id })));
  const m = mistakes(M.answer);
  const plus = (id: string) => [...M.correct, ...M.idx([id])].sort((a, b) => a - b);
  const minus = (id: string) => M.correct.filter((i) => !M.idx([id]).includes(i));
  if (wrongs.some((x) => x.id === "nucleus")) m.add({ kind: "multi", options: M.options, correct: plus("nucleus") }, tx("No nucleus!", "Kein Zellkern!"), tx("That's exactly what makes bacteria prokaryotes: their DNA lies free, without a nucleus.", "Genau das macht Bakterien zu Prokaryoten: Ihre DNA liegt frei, ohne Zellkern."));
  if (wrongs.some((x) => x.id === "mito")) m.add({ kind: "multi", options: M.options, correct: plus("mito") }, tx("No mitochondria", "Keine Mitochondrien"), tx("Bacteria have no organelles with membranes, so no mitochondria. They respire at their cell membrane.", "Bakterien haben keine Organellen mit Membran, also keine Mitochondrien. Sie atmen an ihrer Zellmembran."));
  if (rights.some((x) => x.id === "ribosome")) m.add({ kind: "multi", options: M.options, correct: minus("ribosome") }, tx("Ribosomes are missing", "Ribosomen fehlen"), tx("Bacteria make proteins too, so they need ribosomes. Theirs are just a little smaller (70S).", "Auch Bakterien stellen Proteine her und brauchen dafür Ribosomen. Ihre sind nur etwas kleiner (70S)."));
  if (rights.some((x) => x.id === "dna")) m.add({ kind: "multi", options: M.options, correct: minus("dna") }, tx("No nucleus, but DNA", "Kein Kern, aber DNA"), tx("No nucleus doesn't mean no DNA: the bacterial chromosome lies free in the cytoplasm.", "Kein Zellkern heißt nicht keine DNA: Das Bakterienchromosom liegt frei im Zellplasma."));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("What does a **bacterial cell** have?", "Was besitzt eine **Bakterienzelle**?"),
    answer: M.answer,
    hint: tx("Bacteria are prokaryotes: no nucleus, no organelles with membranes. But the basics every cell needs are there.", "Bakterien sind Prokaryoten: kein Zellkern, keine Organellen mit Membran. Aber das, was jede Zelle braucht, ist da."),
    solution: [frame(tx(rights.map((x, i) => `"${en(x.text)}"#c${i}`).join(" , "), rights.map((x, i) => `"${de(x.text)}"#c${i}`).join(" , ")), tx("These belong to a bacterium. Nucleus, mitochondria, chloroplasts and Golgi apparatus only exist in eukaryotes.", "Das hat ein Bakterium. Zellkern, Mitochondrien, Chloroplasten und Golgi-Apparat gibt es nur bei Eukaryoten."))],
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Magnification

const EYE = [5, 10, 10, 12.5, 15];
const OBJ = [4, 10, 20, 40, 60, 100];

function totalMagTask(rng: Rng): Exercise {
  const eye = rng.pick(EYE);
  const obj = rng.pick(OBJ);
  const M = eye * obj;
  const answer: AnswerSpec = { kind: "number", value: M, unit: "×" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: eye + obj }, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("The objective magnifies, and the eyepiece magnifies that image again. Magnifications are multiplied, not added.", "Das Objektiv vergrößert, und das Okular vergrößert dieses Bild noch einmal. Vergrößerungen werden multipliziert, nicht addiert."));
  m.add({ kind: "number", value: obj }, tx("Eyepiece forgotten", "Okular vergessen"), tx("That's only the objective. The eyepiece magnifies once more.", "Das ist nur das Objektiv. Das Okular vergrößert noch einmal."));
  const ask = rng.chance(0.25);
  if (ask && M % 10 === 0 && eye === 10) {
    // which objective?
    const ans2: AnswerSpec = { kind: "number", value: obj, unit: "×" };
    const m2 = mistakes(ans2);
    m2.add({ kind: "number", value: M - eye }, tx("Subtracted", "Subtrahiert"), tx("Magnifications are multiplied, so you have to divide to undo it: total ÷ eyepiece.", "Vergrößerungen werden multipliziert, also musst du zum Umkehren teilen: Gesamt : Okular."));
    m2.add({ kind: "number", value: M * eye }, tx("Multiplied again", "Noch mal multipliziert"), tx("You want to go back from the total. That needs a division.", "Du willst von der Gesamtvergrößerung zurückrechnen. Dafür brauchst du eine Division."));
    return {
      instruction: tx("Which objective?", "Welches Objektiv?"),
      text: tx(`Your eyepiece magnifies 10×. Which objective do you need for a total magnification of ${M}×?`, `Dein Okular vergrößert 10-fach. Welches Objektiv brauchst du für eine ${M}-fache Gesamtvergrößerung?`),
      answer: ans2,
      hint: tx("Total = eyepiece × objective, so objective = total ÷ eyepiece.", "Gesamt = Okular × Objektiv, also Objektiv = Gesamt : Okular."),
      solution: [frame(tx(`"objective"#o = \\frac{${M}}{10} = ${obj}#r`, `"Objektiv"#o = \\frac{${M}}{10} = ${obj}#r`), tx(`You need the **${obj}×** objective.`, `Du brauchst das **${obj}er**-Objektiv.`), ["r"])],
      mistakes: m2.list,
    };
  }
  return {
    instruction: tx("Total magnification", "Gesamtvergrößerung"),
    text: rng.chance(0.5)
      ? L((l) => (l === "en" ? `Your microscope has a ${n(eye, l)}× eyepiece and you swing in the ${obj}× objective. What is the total magnification?` : `Dein Mikroskop hat ein ${n(eye, l)}-fach vergrößerndes Okular, und du schwenkst das ${obj}er-Objektiv ein. Wie groß ist die Gesamtvergrößerung?`))
      : L((l) => (l === "en" ? `Eyepiece: ${n(eye, l)}×, objective: ${obj}×. How many times is the specimen magnified in total?` : `Okular: ${n(eye, l)}×, Objektiv: ${obj}×. Wie oft wird das Präparat insgesamt vergrößert?`)),
    answer,
    hint: tx("Total magnification = eyepiece × objective.", "Gesamtvergrößerung = Okular × Objektiv."),
    solution: [
      frame(tx('"total"#g = "eyepiece"#a \\times "objective"#b', '"Gesamt"#g = "Okular"#a \\times "Objektiv"#b'), tx("The eyepiece magnifies the image of the objective again: multiply.", "Das Okular vergrößert das Bild des Objektivs noch einmal: multiplizieren.")),
      frame(L((l) => `"${l === "en" ? "total" : "Gesamt"}"#g = ${n(eye, l)}#a \\times ${obj}#b = ${n(M, l)}#r`), L((l) => (l === "en" ? `**${n(M, l)}×** magnification.` : `**${n(M, l)}-fache** Vergrößerung.`)), ["r"]),
    ],
    mistakes: m.list,
  };
}

/** Pick an object and a magnification that give an image of a friendly size (5 to 80 mm, at most one decimal). */
function magCase(rng: Rng) {
  for (let i = 0; i < 40; i++) {
    const o = rng.pick(MAG_OBJECTS);
    const eye = rng.pick([10, 10, 15]);
    const obj = rng.pick([4, 10, 40, 100]);
    const M = eye * obj;
    const img = round((o.um * M) / 1000, 4);
    if (img >= 5 && img <= 80 && Math.abs(img * 10 - Math.round(img * 10)) < 1e-9) return { o, eye, obj, M, img };
  }
  return { o: MAG_OBJECTS[2], eye: 10, obj: 40, M: 400, img: 24 };
}

function actualSizeTask(rng: Rng): Exercise {
  const { o, eye, obj, M, img } = magCase(rng);
  const split = rng.chance(0.4);
  const answer: AnswerSpec = { kind: "number", value: o.um, unit: "µm", tolerance: 0.01 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: round(o.um / 1000), tolerance: 0.01 }, tx("That's in millimetres", "Das ist in Millimetern"), tx("Your number is right, but in millimetres. The box wants micrometres: 1 mm = 1000 µm.", "Deine Zahl stimmt, aber in Millimetern. Gefragt sind Mikrometer: 1 mm = 1000 µm."), true);
  m.add({ kind: "number", value: round(img * M), tolerance: 0.01 }, tx("Multiplied instead of divided", "Mal statt geteilt"), tx("The image is bigger than the real cell, so the real size must be smaller: divide by the magnification.", "Das Bild ist größer als die echte Zelle, also muss die echte Größe kleiner sein: durch die Vergrößerung teilen."));
  if (split) m.add({ kind: "number", value: round((img * 1000) / obj), tolerance: 0.01 }, tx("Eyepiece forgotten", "Okular vergessen"), tx(`You only divided by the objective. The total magnification is eyepiece × objective = ${M}.`, `Du hast nur durch das Objektiv geteilt. Die Gesamtvergrößerung ist Okular × Objektiv = ${M}.`));
  m.add({ kind: "number", value: round((img * 1000) / (eye + obj)), tolerance: 0.01 }, tx("Magnifications added", "Vergrößerungen addiert"), tx("Eyepiece and objective are multiplied to get the total magnification, not added.", "Okular und Objektiv werden für die Gesamtvergrößerung multipliziert, nicht addiert."));
  const imgT = (l: "en" | "de") => n(img, l, 1);
  const what = o.name;
  const it = o.it;
  return {
    instruction: tx("Work out the actual size", "Berechne die tatsächliche Größe"),
    text: split
      ? L((l) => (l === "en" ? `You look at ${en(what)} with a ${eye}× eyepiece and a ${obj}× objective and draw it true to scale. In your drawing it is ${imgT(l)} mm long. How long is it really, in µm?` : `Du betrachtest ${de(what)} mit einem ${eye}er-Okular und einem ${obj}er-Objektiv und zeichnest maßstabsgetreu. In deiner Zeichnung ist ${de(it)} ${imgT(l)} mm lang. Wie lang ist ${de(it)} in Wirklichkeit, in µm?`))
      : L((l) => (l === "en" ? `On a micrograph taken at ${M}× magnification, ${en(what)} is ${imgT(l)} mm long. How long is it really, in µm?` : `Auf einem Mikrofoto mit ${M}-facher Vergrößerung ist ${de(what)} ${imgT(l)} mm lang. Wie lang ist ${de(it)} in Wirklichkeit, in µm?`)),
    answer,
    hint: tx("Actual size = image size ÷ magnification. Then convert: 1 mm = 1000 µm.", "Tatsächliche Größe = Bildgröße : Vergrößerung. Dann umrechnen: 1 mm = 1000 µm."),
    solution: [
      ...(split ? [frame(L((l) => `"${l === "en" ? "magnification" : "Vergrößerung"}"#v = ${eye} \\times ${obj} = ${M}#m`), tx("First the total magnification: eyepiece × objective.", "Zuerst die Gesamtvergrößerung: Okular × Objektiv."))] : []),
      frame(L((l) => `\\frac{${imgT(l)} "mm"}{${M}#m} = ${n(o.um / 1000, l)} "mm"`), tx("Image size divided by the magnification.", "Bildgröße geteilt durch die Vergrößerung.")),
      frame(L((l) => `${n(o.um / 1000, l)} "mm" = ${n(o.um, l)}#r "µm"`), L((l) => (l === "en" ? `1 mm = 1000 µm, so it is **${n(o.um, l)} µm** long.` : `1 mm = 1000 µm, also ist ${de(it)} **${n(o.um, l)} µm** lang.`)), ["r"]),
    ],
    mistakes: m.list,
  };
}

function imageSizeTask(rng: Rng): Exercise {
  const { o, M, img } = magCase(rng);
  const askMag = rng.chance(0.4);
  if (askMag) {
    const answer: AnswerSpec = { kind: "number", value: M, unit: "×", tolerance: 0.005 };
    const m = mistakes(answer);
    m.add({ kind: "number", value: round(img / o.um, 6), tolerance: 0.01 }, tx("Units don't match", "Einheiten passen nicht"), tx("You divided millimetres by micrometres. Convert first: both sizes in µm (1 mm = 1000 µm).", "Du hast Millimeter durch Mikrometer geteilt. Rechne zuerst beide Größen in µm um (1 mm = 1000 µm)."), true);
    m.add({ kind: "number", value: round(o.um / (img * 1000), 8), tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("Magnification = image size ÷ actual size. The image is the bigger one.", "Vergrößerung = Bildgröße : tatsächliche Größe. Das Bild ist das Größere."));
    return {
      instruction: tx("Work out the magnification", "Berechne die Vergrößerung"),
      text: L((l) => (l === "en" ? `${en(o.name).replace(/^a /, "A ").replace(/^an /, "An ")} is really ${n(o.um, l)} µm long. In a photo it is ${n(img, l, 1)} mm long. How many times is it magnified?` : `${de(o.name).replace(/^ein/, "Ein")} ist in Wirklichkeit ${n(o.um, l)} µm lang. Auf einem Foto ist ${de(o.it)} ${n(img, l, 1)} mm lang. Wie stark ist ${de(o.it)} vergrößert?`)),
      answer,
      hint: tx("Magnification = image size ÷ actual size, both in the same unit.", "Vergrößerung = Bildgröße : tatsächliche Größe, beide in derselben Einheit."),
      solution: [
        frame(L((l) => `${n(img, l, 1)} "mm" = ${n(img * 1000, l)} "µm"`), tx("Same unit first.", "Erst dieselbe Einheit.")),
        frame(L((l) => `\\frac{${n(img * 1000, l)} "µm"}{${n(o.um, l)} "µm"} = ${M}#r`), L((l) => (l === "en" ? `It is magnified **${M}×**.` : `${de(o.it).replace(/^./, (c) => c.toUpperCase())} ist **${M}-fach** vergrößert.`)), ["r"]),
      ],
      mistakes: m.list,
    };
  }
  const answer: AnswerSpec = { kind: "number", value: img, unit: "mm", tolerance: 0.01 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: round(o.um * M), tolerance: 0.01 }, tx("That's in micrometres", "Das ist in Mikrometern"), tx("Your result is in µm. Convert into mm: divide by 1000.", "Dein Ergebnis ist in µm. Rechne in mm um: durch 1000 teilen."), true);
  m.add({ kind: "number", value: round(o.um / M, 6), tolerance: 0.01 }, tx("Divided instead of multiplied", "Geteilt statt mal"), tx("The image is bigger than the real thing: multiply by the magnification.", "Das Bild ist größer als das echte Objekt: mit der Vergrößerung multiplizieren."));
  return {
    instruction: tx("How big does it look?", "Wie groß erscheint es?"),
    text: L((l) => (l === "en" ? `${en(o.name).replace(/^a /, "A ").replace(/^an /, "An ")} is ${n(o.um, l)} µm long. How long does it look at ${M}× magnification, in mm?` : `${de(o.name).replace(/^ein/, "Ein")} ist ${n(o.um, l)} µm lang. Wie lang erscheint ${de(o.it)} bei ${M}-facher Vergrößerung, in mm?`)),
    answer,
    hint: tx("Image size = actual size × magnification. Then 1000 µm = 1 mm.", "Bildgröße = tatsächliche Größe × Vergrößerung. Dann 1000 µm = 1 mm."),
    solution: [
      frame(L((l) => `${n(o.um, l)} "µm" \\times ${M} = ${n(o.um * M, l)} "µm"`), tx("Multiply by the magnification.", "Mit der Vergrößerung multiplizieren.")),
      frame(L((l) => `${n(o.um * M, l)} "µm" = ${n(img, l)}#r "mm"`), L((l) => (l === "en" ? `It looks **${n(img, l)} mm** long.` : `${de(o.it).replace(/^./, (c) => c.toUpperCase())} erscheint **${n(img, l)} mm** lang.`)), ["r"]),
    ],
    mistakes: m.list,
  };
}

const UNITS: { v: number; from: string; to: string; f: number }[] = [
  { v: 0.05, from: "mm", to: "µm", f: 1000 },
  { v: 0.2, from: "mm", to: "µm", f: 1000 },
  { v: 2.5, from: "mm", to: "µm", f: 1000 },
  { v: 0.008, from: "mm", to: "µm", f: 1000 },
  { v: 0.2, from: "µm", to: "nm", f: 1000 },
  { v: 2, from: "µm", to: "nm", f: 1000 },
  { v: 0.025, from: "µm", to: "nm", f: 1000 },
  { v: 7.5, from: "µm", to: "nm", f: 1000 },
  { v: 250, from: "µm", to: "mm", f: 0.001 },
  { v: 60, from: "µm", to: "mm", f: 0.001 },
  { v: 1500, from: "µm", to: "mm", f: 0.001 },
  { v: 100, from: "nm", to: "µm", f: 0.001 },
  { v: 25, from: "nm", to: "µm", f: 0.001 },
  { v: 8, from: "nm", to: "µm", f: 0.001 },
];

function unitTask(rng: Rng): Exercise {
  const U = rng.pick(UNITS);
  const value = round(U.v * U.f, 8);
  const answer: AnswerSpec = { kind: "number", value, unit: U.to, tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: round(U.v / U.f, 10), tolerance: 0.001 }, tx("Wrong direction", "Falsche Richtung"), U.f > 1 ? tx(`A ${U.to} is smaller than a ${U.from}, so you get **more** of them: multiply by 1000.`, `Ein ${U.to} ist kleiner als ein ${U.from}, also werden es **mehr**: mal 1000.`) : tx(`A ${U.to} is bigger than a ${U.from}, so you get **fewer** of them: divide by 1000.`, `Ein ${U.to} ist größer als ein ${U.from}, also werden es **weniger**: durch 1000.`));
  m.add({ kind: "number", value: round(U.f > 1 ? U.v * 100 : U.v / 100, 10), tolerance: 0.001 }, tx("Factor 100?", "Faktor 100?"), tx("Between mm, µm and nm the factor is always 1000, not 100.", "Zwischen mm, µm und nm ist der Faktor immer 1000, nicht 100."), true);
  return {
    instruction: tx("Convert the units", "Rechne die Einheit um"),
    text: L((l) => (l === "en" ? `Convert ${n(U.v, l)} ${U.from} into ${U.to}.` : `Rechne ${n(U.v, l)} ${U.from} in ${U.to} um.`)),
    answer,
    hint: tx("1 mm = 1000 µm and 1 µm = 1000 nm. Smaller unit, bigger number.", "1 mm = 1000 µm und 1 µm = 1000 nm. Kleinere Einheit, größere Zahl."),
    solution: [frame(L((l) => `${n(U.v, l)} "${U.from}" = ${n(value, l, 6)}#r "${U.to}"`), U.f > 1 ? tx("Into a smaller unit: multiply by 1000.", "In eine kleinere Einheit: mal 1000.") : tx("Into a bigger unit: divide by 1000.", "In eine größere Einheit: durch 1000."), ["r"])],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Sizes and the limits of the light microscope

const SIZE_SAY: Record<string, [Text, Text]> = {
  "virus>bacterium": [tx("Viruses are tiny", "Viren sind winzig"), tx("Viruses are far smaller than bacteria: about 20 flu viruses fit along one bacterium.", "Viren sind viel kleiner als Bakterien: Etwa 20 Grippeviren passen der Länge nach auf ein Bakterium.")],
  "ribosome>virus": [tx("Ribosomes are smaller", "Ribosomen sind kleiner"), tx("A ribosome is only about 25 nm, a flu virus about 100 nm.", "Ein Ribosom ist nur etwa 25 nm groß, ein Grippevirus etwa 100 nm.")],
  "liver>egg": [tx("A giant among cells", "Ein Riese unter den Zellen"), tx("The human egg cell is one of the largest cells of the body: at 0.12 mm you can just about see it.", "Die menschliche Eizelle ist eine der größten Zellen des Körpers: Mit 0,12 mm kann man sie gerade noch sehen.")],
  "bacterium>rbc": [tx("Bacteria are smaller", "Bakterien sind kleiner"), tx("A bacterium is only about 2 µm long, a red blood cell about 7.5 µm across.", "Ein Bakterium ist nur etwa 2 µm lang, ein rotes Blutkörperchen etwa 7,5 µm breit.")],
  "atom>dna": [tx("Atoms are smallest", "Atome sind am kleinsten"), tx("DNA is a molecule made of many atoms, so a single atom must be smaller.", "DNA ist ein Molekül aus vielen Atomen, ein einzelnes Atom muss also kleiner sein.")],
};

function sizeOrderTask(rng: Rng): Exercise {
  for (let tries = 0; tries < 50; tries++) {
    const k = rng.int(4, 5);
    const picked = rng.shuffle(SIZES).slice(0, k).sort((a, b) => a.um - b.um);
    if (picked.some((p, i) => i > 0 && p.um / picked[i - 1].um < 2.5)) continue;
    const list: Mistake[] = [];
    const items = picked.map((p) => capT(p.name));
    list.push(orderMistake([...items].reverse(), tx("Wrong direction", "Falsche Richtung"), tx("You sorted from large to small. Start with the smallest.", "Du hast von groß nach klein sortiert. Fang mit dem Kleinsten an.")));
    for (const [key, [title, say]] of Object.entries(SIZE_SAY)) {
      const [small, large] = key.split(">");
      const a = picked.find((p) => p.id === small);
      const b = picked.find((p) => p.id === large);
      if (a && b) list.push(orderMistake([capT(b.name), capT(a.name)], title, say));
    }
    return {
      instruction: tx("Order by size", "Ordne nach Größe"),
      text: tx("Sort from the **smallest** to the **largest**.", "Ordne vom **Kleinsten** zum **Größten**."),
      answer: { kind: "order", items },
      hint: tx("1 mm = 1000 µm, 1 µm = 1000 nm. Viruses are far smaller than bacteria, and molecules smaller still.", "1 mm = 1000 µm, 1 µm = 1000 nm. Viren sind viel kleiner als Bakterien, Moleküle noch kleiner."),
      solution: [frame(tx(picked.map((p, i) => `"${en(p.shown)}"#s${i}`).join(" < "), picked.map((p, i) => `"${de(p.shown)}"#s${i}`).join(" < ")), tx(picked.map((p) => `${en(capT(p.name))}: ${en(p.shown)}`).join(", ") + ".", picked.map((p) => `${de(p.name)}: ${de(p.shown)}`).join(", ") + "."))],
      mistakes: list.slice(0, 4),
    };
  }
  return unitTask(rng);
}

const LM: { id: string; text: Text; right: boolean; say?: Text }[] = [
  { id: "nucleus", text: tx("nucleus", "Zellkern"), right: true },
  { id: "chloro", text: tx("chloroplasts", "Chloroplasten"), right: true },
  { id: "wall", text: tx("cell wall", "Zellwand"), right: true },
  { id: "vacuole", text: tx("vacuole of a plant cell", "Vakuole einer Pflanzenzelle"), right: true },
  { id: "bacteria", text: tx("bacteria (as tiny rods)", "Bakterien (als winzige Stäbchen)"), right: true },
  { id: "ribosome", text: tx("ribosomes", "Ribosomen"), right: false, say: tx("Ribosomes are only about 25 nm. The light microscope only resolves down to about 0.2 µm = 200 nm.", "Ribosomen sind nur etwa 25 nm groß. Das Lichtmikroskop löst nur bis etwa 0,2 µm = 200 nm auf.") },
  { id: "virus", text: tx("flu viruses", "Grippeviren"), right: false, say: tx("Viruses (about 100 nm) are below the resolution limit of the light microscope. You need an electron microscope.", "Viren (etwa 100 nm) liegen unter der Auflösungsgrenze des Lichtmikroskops. Dafür brauchst du ein Elektronenmikroskop.") },
  { id: "pore", text: tx("nuclear pores", "Kernporen"), right: false, say: tx("Nuclear pores are around 100 nm wide: too small for the light microscope.", "Kernporen sind etwa 100 nm groß: zu klein für das Lichtmikroskop.") },
  { id: "bilayer", text: tx("the two layers of the cell membrane", "die zwei Schichten der Zellmembran"), right: false, say: tx("The whole membrane is only 7 to 10 nm thick. Its layers only show up in the electron microscope.", "Die ganze Membran ist nur 7 bis 10 nm dick. Ihre Schichten zeigt erst das Elektronenmikroskop.") },
];

function lmVisibleTask(rng: Rng): Exercise {
  const rights = rng.shuffle(LM.filter((x) => x.right)).slice(0, rng.int(2, 3));
  const wrongs = rng.shuffle(LM.filter((x) => !x.right)).slice(0, 5 - rights.length);
  const M = multi(rng, [...rights, ...wrongs].map((x) => ({ text: capT(x.text), right: x.right, id: x.id })));
  const m = mistakes(M.answer);
  for (const w of wrongs) m.add({ kind: "multi", options: M.options, correct: [...M.correct, ...M.idx([w.id])].sort((a, b) => a - b) }, tx("Below the limit", "Unter der Grenze"), w.say!);
  if (rights.some((x) => x.id === "bacteria")) m.add({ kind: "multi", options: M.options, correct: M.correct.filter((i) => !M.idx(["bacteria"]).includes(i)) }, tx("Bacteria are visible", "Bakterien sieht man"), tx("Bacteria are 1 to 5 µm long: at 1000× you can see them as tiny rods or dots. Their inner details you can't.", "Bakterien sind 1 bis 5 µm lang: Bei 1000-facher Vergrößerung siehst du sie als winzige Stäbchen oder Punkte. Ihre Einzelheiten nicht."));
  return {
    instruction: tx("Light or electron microscope?", "Licht- oder Elektronenmikroskop?"),
    text: tx("Which of these can you see with a good **light microscope**?", "Was davon kannst du mit einem guten **Lichtmikroskop** erkennen?"),
    answer: M.answer,
    hint: tx("The light microscope resolves details down to about 0.2 µm (200 nm).", "Das Lichtmikroskop löst Details bis etwa 0,2 µm (200 nm) auf."),
    solution: [
      frame(tx('"resolution:" \\; "light microscope" \\approx 0.2 "µm"', '"Auflösung:" \\; "Lichtmikroskop" \\approx 0,2 "µm"'), tx("Anything smaller than about 0.2 µm blurs into one spot.", "Alles, was kleiner als etwa 0,2 µm ist, verschwimmt zu einem Fleck.")),
      frame(tx(rights.map((x, i) => `"${en(x.text)}"#c${i}`).join(" , "), rights.map((x, i) => `"${de(x.text)}"#c${i}`).join(" , ")), tx("These are big enough. The rest needs an electron microscope.", "Diese sind groß genug. Für den Rest brauchst du ein Elektronenmikroskop.")),
    ],
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// The way of a protein

const PATH: Text[] = [
  tx("nucleus: DNA holds the plan", "Zellkern: DNA enthält den Bauplan"),
  tx("ribosomes on the rough ER build the protein", "Ribosomen am rauen ER bauen das Protein"),
  tx("Golgi apparatus modifies and packs it", "Golgi-Apparat verändert und verpackt es"),
  tx("vesicle carries it to the membrane", "Vesikel bringt es zur Membran"),
  tx("cell membrane releases it to the outside", "Zellmembran gibt es nach außen ab"),
];

function proteinPathTask(rng: Rng): Exercise {
  const drop = rng.pick([-1, -1, 3, 4, 0]);
  const items = PATH.filter((_, i) => i !== drop);
  const has = (i: number) => i !== drop;
  const list: Mistake[] = [];
  list.push(orderMistake([PATH[2], PATH[1]], tx("Made first, then packed", "Erst bauen, dann verpacken"), tx("The protein first has to be built at the ribosomes of the ER. Only then is it modified and packed in the Golgi apparatus.", "Das Protein muss zuerst an den Ribosomen des ER gebaut werden. Erst danach wird es im Golgi-Apparat verändert und verpackt.")));
  if (has(0)) list.push(orderMistake([PATH[1], PATH[0]], tx("The plan comes first", "Der Bauplan kommt zuerst"), tx("Without a plan no protein: the information comes from the DNA in the nucleus first.", "Ohne Bauplan kein Protein: Die Information kommt zuerst aus der DNA im Zellkern.")));
  if (has(3) && has(4)) list.push(orderMistake([PATH[4], PATH[3]], tx("Delivery service", "Lieferdienst"), tx("The membrane can only release the protein once a vesicle has brought it there.", "Die Membran kann das Protein erst abgeben, wenn ein Vesikel es dorthin gebracht hat.")));
  return {
    instruction: tx("The way of a protein", "Der Weg eines Proteins"),
    text: tx("A gland cell makes a digestive enzyme and releases it. Put the stations in order.", "Eine Drüsenzelle stellt ein Verdauungsenzym her und gibt es ab. Bring die Stationen in die richtige Reihenfolge."),
    answer: { kind: "order", items: items.map(capT) },
    hint: tx("Plan, assembly line, packing station, delivery, exit.", "Bauplan, Fließband, Packstation, Lieferung, Ausgang."),
    solution: [frame(tx('"nucleus"#a \\to "rough ER"#b \\to "Golgi"#c \\\\ \\to "vesicle"#d \\to "membrane"#e', '"Zellkern"#a \\to "raues ER"#b \\to "Golgi"#c \\\\ \\to "Vesikel"#d \\to "Membran"#e'), tx("The plan comes from the DNA in the nucleus, ribosomes on the ER build the protein, the Golgi apparatus packs it, a vesicle takes it to the membrane and it leaves the cell (exocytosis).", "Der Bauplan kommt aus der DNA im Kern, Ribosomen am ER bauen das Protein, der Golgi-Apparat verpackt es, ein Vesikel bringt es zur Membran, und es verlässt die Zelle (Exocytose)."))],
    mistakes: list.map((x) => (x.when.kind === "order" ? { ...x, when: { ...x.when, items: x.when.items.map(capT) } } : x)),
  };
}

// ---------------------------------------------------------------------------
// Which statement is right?

const STATEMENTS: Opt[][] = [
  [
    { text: tx("Plant cells have mitochondria too.", "Auch Pflanzenzellen haben Mitochondrien.") },
    { text: tx("Plant cells don't need mitochondria because they have chloroplasts.", "Pflanzenzellen brauchen keine Mitochondrien, weil sie Chloroplasten haben."), title: tx("Plants respire too", "Pflanzen atmen auch"), say: tx("Chloroplasts build sugar. To release the energy from that sugar, plants need mitochondria too, day and night.", "Chloroplasten bauen Zucker auf. Um die Energie aus dem Zucker freizusetzen, brauchen auch Pflanzen Mitochondrien, Tag und Nacht.") },
    { text: tx("Only muscle cells have mitochondria.", "Nur Muskelzellen haben Mitochondrien."), title: tx("Almost all cells", "Fast alle Zellen"), say: tx("Almost every cell with a nucleus has mitochondria. Muscle cells just have especially many.", "Fast jede Zelle mit Zellkern hat Mitochondrien. Muskelzellen haben nur besonders viele.") },
    { text: tx("Mitochondria carry out photosynthesis.", "Mitochondrien betreiben Fotosynthese."), title: tx("That's the chloroplasts", "Das machen Chloroplasten"), say: tx("Photosynthesis happens in chloroplasts. Mitochondria do cellular respiration.", "Fotosynthese findet in Chloroplasten statt. Mitochondrien betreiben Zellatmung.") },
  ],
  [
    { text: tx("Bacteria have DNA and ribosomes, but no nucleus.", "Bakterien haben DNA und Ribosomen, aber keinen Zellkern.") },
    { text: tx("Bacteria have no DNA because they have no nucleus.", "Bakterien haben keine DNA, weil ihnen der Zellkern fehlt."), title: tx("No nucleus, but DNA", "Kein Kern, aber DNA"), say: tx("No nucleus doesn't mean no DNA: their ring-shaped chromosome lies free in the cytoplasm.", "Kein Zellkern heißt nicht keine DNA: Ihr ringförmiges Chromosom liegt frei im Zellplasma.") },
    { text: tx("Bacteria have a nucleus but no ribosomes.", "Bakterien haben einen Zellkern, aber keine Ribosomen."), title: tx("Exactly the other way round", "Genau andersrum"), say: tx("Bacteria have ribosomes (70S), but no nucleus.", "Bakterien haben Ribosomen (70S), aber keinen Zellkern.") },
    { text: tx("Bacteria are eukaryotes.", "Bakterien sind Eukaryoten."), title: tx("Pro, not eu", "Pro, nicht eu"), say: tx("Eukaryotes have a true nucleus. Bacteria are prokaryotes.", "Eukaryoten haben einen echten Zellkern. Bakterien sind Prokaryoten.") },
  ],
  [
    { text: tx("The electron microscope resolves much finer details, but the specimens are dead.", "Das Elektronenmikroskop löst viel feinere Details auf, aber die Präparate sind tot.") },
    { text: tx("In the electron microscope you can watch living cells swim.", "Im Elektronenmikroskop kann man lebende Zellen beim Schwimmen beobachten."), title: tx("Vacuum inside", "Innen herrscht Vakuum"), say: tx("The specimen lies in a vacuum and is fixed and very thin: nothing can live there.", "Das Präparat liegt im Vakuum und ist fixiert und hauchdünn: Da kann nichts leben.") },
    { text: tx("With enough magnification the light microscope shows ribosomes too.", "Mit genug Vergrößerung zeigt auch das Lichtmikroskop Ribosomen."), title: tx("Empty magnification", "Leere Vergrößerung"), say: tx("More magnification doesn't help: below about 0.2 µm the light microscope can't separate details. The image only gets bigger and blurrier.", "Mehr Vergrößerung hilft nicht: Unter etwa 0,2 µm kann das Lichtmikroskop keine Details mehr trennen. Das Bild wird nur größer und unschärfer.") },
    { text: tx("Electron micrographs are naturally in colour.", "Elektronenmikroskopische Bilder sind von Natur aus farbig."), title: tx("Coloured later", "Nachträglich gefärbt"), say: tx("Electron microscope images are black and white. The colours you see in books are added afterwards.", "Elektronenmikroskopische Bilder sind schwarz-weiß. Die Farben in Büchern werden nachträglich eingefärbt.") },
  ],
  [
    { text: tx("The total magnification is eyepiece magnification times objective magnification.", "Die Gesamtvergrößerung ist Okularvergrößerung mal Objektivvergrößerung.") },
    { text: tx("The total magnification is eyepiece plus objective magnification.", "Die Gesamtvergrößerung ist Okular- plus Objektivvergrößerung."), title: tx("Multiply", "Multiplizieren"), say: tx("The eyepiece magnifies the image of the objective again: magnifications are multiplied.", "Das Okular vergrößert das Bild des Objektivs noch einmal: Vergrößerungen werden multipliziert.") },
    { text: tx("Only the objective decides the magnification.", "Nur das Objektiv bestimmt die Vergrößerung."), title: tx("Two lenses", "Zwei Linsen"), say: tx("The eyepiece is a lens too and magnifies once more.", "Auch das Okular ist eine Linse und vergrößert noch einmal.") },
    { text: tx("The more you magnify, the more details you always see.", "Je stärker man vergrößert, desto mehr Details sieht man immer."), title: tx("There's a limit", "Es gibt eine Grenze"), say: tx("Above about 1000× the light microscope shows no new details: empty magnification. The limit is the resolution.", "Über etwa 1000-fach zeigt das Lichtmikroskop keine neuen Details: leere Vergrößerung. Die Grenze ist die Auflösung.") },
  ],
  [
    { text: tx("mRNA leaves the nucleus through the nuclear pores.", "Die mRNA verlässt den Zellkern durch die Kernporen.") },
    { text: tx("The DNA leaves the nucleus to be read at the ribosomes.", "Die DNA verlässt den Zellkern, um an den Ribosomen abgelesen zu werden."), title: tx("The DNA stays home", "Die DNA bleibt im Kern"), say: tx("The DNA stays safely in the nucleus. Only a copy of a gene, the mRNA, travels out.", "Die DNA bleibt geschützt im Kern. Nur eine Abschrift eines Gens, die mRNA, wandert hinaus.") },
    { text: tx("Proteins are made inside the nucleus.", "Proteine werden im Zellkern hergestellt."), title: tx("Made at ribosomes", "An Ribosomen gebaut"), say: tx("The nucleus holds the plan. The proteins are built at the ribosomes outside it.", "Der Kern enthält den Bauplan. Gebaut werden die Proteine an den Ribosomen außerhalb.") },
    { text: tx("The Golgi apparatus joins amino acids into proteins.", "Der Golgi-Apparat verknüpft Aminosäuren zu Proteinen."), title: tx("It packs, it doesn't build", "Er verpackt, er baut nicht"), say: tx("Joining amino acids is the ribosomes' job. The Golgi apparatus modifies and packs finished proteins.", "Aminosäuren verknüpfen die Ribosomen. Der Golgi-Apparat verändert und verpackt fertige Proteine.") },
  ],
  [
    { text: tx("Lysosomes contain enzymes that break down worn-out cell parts.", "Lysosomen enthalten Enzyme, die alte Zellbestandteile abbauen.") },
    { text: tx("Lysosomes store cell sap like a vacuole.", "Lysosomen speichern Zellsaft wie eine Vakuole."), title: tx("Digesting, not storing", "Verdauen, nicht speichern"), say: tx("Lysosomes are small digestion bags, not stores.", "Lysosomen sind kleine Verdauungsbläschen, keine Speicher.") },
    { text: tx("Lysosomes produce ATP.", "Lysosomen erzeugen ATP."), title: tx("That's the mitochondria", "Das machen Mitochondrien"), say: tx("ATP comes from cellular respiration in the mitochondria.", "ATP stammt aus der Zellatmung in den Mitochondrien.") },
    { text: tx("Lysosomes are only found in bacteria.", "Lysosomen gibt es nur in Bakterien."), title: tx("Bacteria have no organelles", "Bakterien haben keine Organellen"), say: tx("Bacteria have no organelles with membranes. Lysosomes are typical of animal cells.", "Bakterien haben keine Organellen mit Membran. Lysosomen sind typisch für Tierzellen.") },
  ],
];

function statementTask(rng: Rng): Exercise {
  const S = rng.pick(STATEMENTS);
  const { answer, mistakes: list } = choice(rng, S);
  return {
    instruction: tx("Which statement is right?", "Welche Aussage stimmt?"),
    text: tx("Only one of these statements is correct. Which one?", "Nur eine dieser Aussagen ist richtig. Welche?"),
    answer,
    hint: tx("Check each statement against what you know about organelles, bacteria and microscopes.", "Prüf jede Aussage mit dem, was du über Organellen, Bakterien und Mikroskope weißt."),
    solution: [frame(q(tx("correct", "richtig"), "r"), S[0].text, ["r"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  const shapes: [number, (r: Rng) => Exercise][] = [
    [3, organelleNameTask],
    [2, organelleMatchTask],
    [2, whichOrganelleTask],
    [2, bacteriumNameTask],
    [2, proEuTask],
    [1, bacteriaMultiTask],
    [2, totalMagTask],
    [3, actualSizeTask],
    [2, imageSizeTask],
    [1, unitTask],
    [2, sizeOrderTask],
    [1, lmVisibleTask],
    [1, proteinPathTask],
    [2, statementTask],
  ];
  const total = shapes.reduce((s, [w]) => s + w, 0);
  let r = rng.int(1, total);
  for (const [w, f] of shapes) {
    r -= w;
    if (r <= 0) return f(rng);
  }
  return organelleNameTask(rng);
}

export const l2 = { organelleMatchTask, bacteriaMultiTask, actualSizeTask };
