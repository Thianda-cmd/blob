"use client";

// Level 2 (Fortgeschritten, Klasse 8–10): structure of bacterium and virus, the virus replication
// cycle, the non-specific defence (macrophages, phagocytosis), the specific defence with antigen
// and antibody (lock and key, agglutination), B cells, plasma cells, T helper and T killer cells,
// memory cells, the course of an immune response, primary and secondary response, active and
// passive immunisation.

import { tx, type Text } from "@/i18n/text";
import { ImmuneLockKey, ImmuneLockKeyPicture } from "@/learn/biology/visuals/ImmuneLockKey";
import { BACTERIUM_PARTS, ImmuneBacterium, ImmuneCompare, ImmuneVirus, VIRUS_PARTS } from "@/learn/biology/visuals/ImmunePathogens";
import { ImmunePhagocyte } from "@/learn/biology/visuals/ImmunePhagocyte";
import { ImmuneResponse } from "@/learn/biology/visuals/ImmuneResponse";
import { ImmuneTiter, ImmuneTiterGraph } from "@/learn/biology/visuals/ImmuneTiter";
import { ImmuneVirusCycle } from "@/learn/biology/visuals/ImmuneVirusCycle";
import { EPITOPES, type Epitope } from "@/learn/biology/visuals/ImmuneCells";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { ACTIVE_CASES, CELLS, DEFENCES, IMMUNISATION_CLAIMS, PASSIVE_CASES, RESPONSE, VIRUS_CYCLE, type CellId } from "./data";
import { capT, choice, de, en, join, listFrame, matchSlip, mistakes, multiOf, orderSlip, q, solve, some, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Structure of bacterium and virus

const NUCLEUS: Text = tx("Nucleus", "Zellkern");
const CELL_WALL: Text = tx("Cell wall", "Zellwand");

const BACT_CONFUSE: Record<string, Record<string, Text>> = {
  wall: { membrane: tx("The cell wall is the firm outer shell. The membrane lies just inside it.", "Die Zellwand ist die feste Hülle außen. Die Zellmembran liegt direkt darunter."), capsule: tx("The capsule is the slimy layer outside the wall. The ? marks the firm wall itself.", "Die Kapsel ist die Schleimschicht außerhalb der Wand. Das ? zeigt auf die feste Wand selbst.") },
  membrane: { wall: tx("The cell wall is the firm outer shell. The membrane is the thin layer just inside it.", "Die Zellwand ist die feste Hülle außen. Die Zellmembran ist die dünne Schicht direkt darunter.") },
  capsule: { wall: tx("The capsule is the slimy layer around everything, outside the firm cell wall.", "Die Kapsel ist die Schleimschicht um alles herum, außerhalb der festen Zellwand.") },
  plasmid: { chromosome: tx("The big tangled ring is the bacterial chromosome. The small extra rings are plasmids.", "Der große verknäuelte Ring ist das Bakterienchromosom. Die kleinen zusätzlichen Ringe sind Plasmide.") },
  chromosome: { plasmid: tx("Plasmids are the small extra rings. The big DNA ring in the middle is the bacterial chromosome.", "Plasmide sind die kleinen Extra-Ringe. Der große DNA-Ring in der Mitte ist das Bakterienchromosom.") },
  pili: { flagellum: tx("The flagellum is the one long whip for swimming. The many short hairs are pili.", "Die Geißel ist die eine lange Peitsche zum Schwimmen. Die vielen kurzen Härchen sind Pili.") },
  flagellum: { pili: tx("Pili are the many short hairs. The long whip at the end is the flagellum.", "Pili sind die vielen kurzen Härchen. Die lange Peitsche am Ende ist die Geißel.") },
};

function bacteriumTask(rng: Rng, id = rng.pick(BACTERIUM_PARTS).id): Exercise {
  const part = BACTERIUM_PARTS.find((p) => p.id === id)!;
  const near = Object.keys(BACT_CONFUSE[id] ?? {});
  const pool = [...near, ...rng.shuffle(BACTERIUM_PARTS.map((p) => p.id).filter((x) => x !== id && !near.includes(x)))].slice(0, id === "chromosome" ? 2 : 3);
  const opts: Opt[] = [{ text: capT(part.label) }];
  if (id === "chromosome") opts.push({ text: NUCLEUS, title: tx("No nucleus in bacteria", "Bakterien haben keinen Zellkern"), say: tx("Bacteria have no nucleus! Their DNA lies free in the cytoplasm as a ring: the bacterial chromosome.", "Bakterien haben keinen Zellkern! Ihre DNA liegt als Ring frei im Cytoplasma: das Bakterienchromosom.") });
  for (const o of pool) {
    const p = BACTERIUM_PARTS.find((x) => x.id === o)!;
    opts.push({ text: capT(p.label), title: tx("Another structure", "Eine andere Struktur"), say: BACT_CONFUSE[id]?.[o] ?? tx(`That's the ${en(p.label)}: ${en(p.info!).charAt(0).toLowerCase()}${en(p.info!).slice(1)}`, `${de(capT(p.label))}: ${de(p.info!)}`) });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("What is the structure of the bacterium marked with ? called?", "Wie heißt die mit ? markierte Struktur des Bakteriums?"),
    visual: visual(ImmuneBacterium, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("Bacteria: capsule outside, then cell wall, cell membrane, cytoplasm with a DNA ring, plasmids and ribosomes.", "Bakterium: außen die Kapsel, dann Zellwand, Zellmembran, Cytoplasma mit DNA-Ring, Plasmiden und Ribosomen."),
    solution: [{ math: q(capT(part.label), "a"), note: tx(`That's the **${en(part.label)}**. ${en(part.info!)}`, `Das ist **${de(part.label)}**. ${de(part.info!)}`), highlight: ["a"] }],
    mistakes: list,
  };
}

const VIRUS_CONFUSE: Record<string, Record<string, Text>> = {
  envelope: { capsid: tx("Two layers: the capsid is the protein coat inside, the envelope is the lipid membrane around it.", "Zwei Schichten: Das Kapsid ist die Proteinhülle innen, die Hülle ist die Lipidmembran darum herum.") },
  capsid: { envelope: tx("The envelope is the outer lipid layer with the spikes. The ? sits on the protein coat inside: the capsid.", "Die Hülle ist die äußere Lipidschicht mit den Spikes. Das ? sitzt auf der Proteinhülle innen: dem Kapsid.") },
  genome: { capsid: tx("The capsid is the coat. The ? marks what's packed inside it.", "Das Kapsid ist die Hülle. Das ? zeigt auf das, was darin verpackt ist.") },
  spikes: { envelope: tx("The envelope is the membrane itself. The ? marks the proteins sticking out of it.", "Die Hülle ist die Membran selbst. Das ? zeigt auf die Proteine, die aus ihr herausragen.") },
};

function virusTask(rng: Rng, id = rng.pick(VIRUS_PARTS).id): Exercise {
  const part = VIRUS_PARTS.find((p) => p.id === id)!;
  const others = VIRUS_PARTS.filter((p) => p.id !== id);
  const opts: Opt[] = [
    { text: capT(part.label) },
    ...others.map((p) => ({ text: capT(p.label), title: tx("Another part", "Ein anderer Teil"), say: VIRUS_CONFUSE[id]?.[p.id] ?? tx(`The ${en(p.label)} sits somewhere else. Look closely where the ? points.`, `${de(capT(p.label))} sitzt woanders. Schau genau, wohin das ? zeigt.`) })),
    { text: CELL_WALL, title: tx("Viruses have no cell wall", "Viren haben keine Zellwand"), say: tx("Viruses aren't cells, so they have no cell wall. That's why antibiotics can't attack them.", "Viren sind keine Zellen und haben daher keine Zellwand. Deshalb können Antibiotika sie nicht angreifen.") },
  ];
  const keep = [opts[0], ...some(rng, opts.slice(1), 3)];
  const { answer, mistakes: list } = choice(rng, keep);
  return {
    instruction: tx("Name the part", "Benenne den Bestandteil"),
    text: tx("What is the part of the virus marked with ? called?", "Wie heißt der mit ? markierte Bestandteil des Virus?"),
    visual: visual(ImmuneVirus, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("From the inside out: genetic material, capsid, envelope with surface proteins.", "Von innen nach außen: Erbinformation, Kapsid, Hülle mit Oberflächenproteinen."),
    solution: [{ math: q(capT(part.label), "a"), note: tx(`That's the **${en(part.label)}**. ${en(part.info!)}`, `Das ist **${de(part.label)}**. ${de(part.info!)}`), highlight: ["a"] }],
    mistakes: list,
  };
}

type Feature = { text: Text; bact: boolean; virus: boolean };
const FEATURES: Feature[] = [
  { text: tx("Ribosomes", "Ribosomen"), bact: true, virus: false },
  { text: tx("A cell membrane", "Eine Zellmembran"), bact: true, virus: false },
  { text: tx("Cytoplasm", "Cytoplasma"), bact: true, virus: false },
  { text: tx("Their own metabolism", "Einen eigenen Stoffwechsel"), bact: true, virus: false },
  { text: tx("A cell wall", "Eine Zellwand"), bact: true, virus: false },
  { text: tx("Genetic material", "Erbinformation"), bact: true, virus: true },
  { text: tx("Proteins", "Proteine"), bact: true, virus: true },
  { text: tx("Surface structures that act as antigens", "Oberflächenstrukturen, die als Antigene wirken"), bact: true, virus: true },
  { text: tx("A nucleus", "Einen Zellkern"), bact: false, virus: false },
];

function compareTask(rng: Rng): Exercise {
  const both = rng.chance(0.4);
  const isRight = (f: Feature) => (both ? f.bact && f.virus : f.bact && !f.virus);
  let pool: Feature[] = [];
  for (let k = 0; k < 30; k++) {
    pool = some(rng, FEATURES, 6);
    const r = pool.filter(isRight).length;
    if (r >= 2 && r <= 4) break;
  }
  const { picked, options, correct, answer } = multiOf(rng, pool, isRight);
  const m = mistakes(answer);
  const at = (s: string) => picked.findIndex((f) => en(f.text) === s);
  const plus = (i: number) => [...correct, i].sort((a, b) => a - b);
  const nuc = at("A nucleus");
  if (nuc >= 0) m.add({ kind: "multi", options, correct: plus(nuc) }, tx("No nucleus", "Kein Zellkern"), tx("Neither has a nucleus: bacteria are prokaryotes, their DNA lies free in the cytoplasm.", "Keiner von beiden hat einen Zellkern: Bakterien sind Prokaryoten, ihre DNA liegt frei im Cytoplasma."));
  const gen = at("Genetic material");
  if (gen >= 0 && !both) m.add({ kind: "multi", options, correct: plus(gen) }, tx("Viruses have genes too", "Auch Viren haben Erbinformation"), tx("Viruses carry genetic material too (DNA or RNA): the blueprint for new viruses. So that's not a difference.", "Auch Viren tragen Erbinformation (DNA oder RNA): den Bauplan für neue Viren. Das ist also kein Unterschied."));
  const rib = at("Ribosomes");
  if (rib >= 0 && both) m.add({ kind: "multi", options, correct: plus(rib) }, tx("Viruses have no ribosomes", "Viren haben keine Ribosomen"), tx("Viruses have no ribosomes: they use those of the host cell to make their proteins.", "Viren haben keine Ribosomen: Sie benutzen die der Wirtszelle, um ihre Proteine herzustellen."));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: both ? tx("What do **bacteria and viruses** both have?", "Was haben **Bakterien und Viren** beide?") : tx("What do **bacteria** have, but **viruses** don't?", "Was haben **Bakterien**, aber **Viren** nicht?"),
    answer,
    hint: tx("A virus is just genetic material in a protein coat, sometimes with an envelope. Everything else belongs to a living cell.", "Ein Virus ist nur Erbinformation in einer Proteinhülle, manchmal mit Hülle. Alles andere gehört zu einer lebenden Zelle."),
    solution: [
      { math: tx('"virus:"#v \\; "genetic material + proteins"#p', '"Virus:"#v \\; "Erbinformation + Proteine"#p'), note: tx("A virus has only genetic material and proteins (capsid, surface proteins), sometimes an envelope.", "Ein Virus hat nur Erbinformation und Proteine (Kapsid, Oberflächenproteine), manchmal eine Hülle.") },
      { math: listFrame(correct.map((i) => options[i]), " , "), note: both ? tx("These are found in both.", "Das haben beide.") : tx("These belong to a living cell: only bacteria have them.", "Das gehört zu einer lebenden Zelle: Nur Bakterien haben es.") },
    ],
    mistakes: m.list,
  };
}

const CYCLE_SHORT: Text[] = [tx("docking", "Andocken"), tx("entry", "Eindringen"), tx("uncoating", "Freisetzen"), tx("copying", "Vermehren"), tx("assembly", "Zusammenbau"), tx("release", "Freisetzung")];

function cycleTask(rng: Rng, from = rng.int(0, 1), n = rng.int(4, 5)): Exercise {
  const items = VIRUS_CYCLE.slice(from, from + n);
  const has = (i: number) => i >= from && i < from + n;
  const list: Mistake[] = [];
  if (has(0) && has(1)) list.push(orderSlip([VIRUS_CYCLE[1], VIRUS_CYCLE[0]], tx("Dock first", "Erst andocken"), tx("The virus can only get in after it has docked onto a matching receptor, like a key in a lock.", "Das Virus kommt erst hinein, nachdem es an einen passenden Rezeptor angedockt hat, wie ein Schlüssel ins Schloss.")));
  if (has(3) && has(4)) list.push(orderSlip([VIRUS_CYCLE[4], VIRUS_CYCLE[3]], tx("Parts first", "Erst die Bauteile"), tx("Before new viruses can be put together, the cell first has to make the parts: copies of the genetic material and viral proteins.", "Bevor neue Viren zusammengebaut werden, muss die Zelle erst die Bauteile herstellen: Kopien der Erbinformation und Virusproteine.")));
  if (has(2) && has(3)) list.push(orderSlip([VIRUS_CYCLE[3], VIRUS_CYCLE[2]], tx("Release the blueprint first", "Erst den Bauplan freisetzen"), tx("The cell can only copy the viral genetic material once it has been set free from its coats.", "Die Zelle kann die Erbinformation des Virus erst kopieren, wenn sie aus ihren Hüllen freigesetzt ist.")));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("How does a virus multiply? Put the steps in the right order.", "Wie vermehrt sich ein Virus? Bring die Schritte in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("First the virus has to get into the cell. Then the cell becomes a virus factory.", "Zuerst muss das Virus in die Zelle. Dann wird die Zelle zur Virusfabrik."),
    solution: [{ math: listFrame(CYCLE_SHORT.slice(from, from + n)), note: tx("Docking, entry, release of the genetic material, copying and making proteins, assembly, release of the new viruses.", "Andocken, Eindringen, Freisetzen der Erbinformation, Kopieren und Proteine bilden, Zusammenbau, Freisetzung der neuen Viren.") }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Cells of the immune system

const ORDERED: CellId[] = ["macro", "th", "b", "plasma", "tk", "mem"];

function cellMatchTask(rng: Rng, ids?: CellId[]): Exercise {
  const pick = ids ?? some(rng, ORDERED, 4);
  const pairs: [Text, Text][] = pick.map((id) => [CELLS[id].name, CELLS[id].job]);
  const unused = ORDERED.filter((id) => !pick.includes(id));
  const distractors = unused.length ? [CELLS[rng.pick(unused)].job] : [];
  const has = (id: CellId) => pick.includes(id);
  const jobOf = (id: CellId) => CELLS[id].job;
  const all = [...pick.map(jobOf), ...distractors];
  const offered = (id: CellId) => all.some((j) => en(j) === en(jobOf(id)));
  const list: Mistake[] = [];
  if (has("mem") && offered("plasma")) list.push(matchSlip([[CELLS.mem.name, jobOf("plasma")]], tx("Memory cells don't make antibodies", "Gedächtniszellen bilden keine Antikörper"), tx("Memory cells don't make antibodies themselves. When the pathogen returns, they quickly turn into plasma cells, and those make the antibodies.", "Gedächtniszellen bilden selbst keine Antikörper. Kommt der Erreger wieder, werden sie schnell zu Plasmazellen, und die bilden die Antikörper.")));
  if (has("b") && offered("tk")) list.push(matchSlip([[CELLS.b.name, jobOf("tk")]], tx("B and T swapped", "B und T vertauscht"), tx("B cells don't kill cells: they become plasma cells that make antibodies. Killing infected cells is the job of T killer cells.", "B-Zellen töten keine Zellen: Sie werden zu Plasmazellen, die Antikörper bilden. Infizierte Zellen töten die T-Killerzellen.")));
  if (has("tk") && offered("plasma")) list.push(matchSlip([[CELLS.tk.name, jobOf("plasma")]], tx("B and T swapped", "B und T vertauscht"), tx("Antibodies come from the B cell line (plasma cells). T killer cells kill infected body cells directly.", "Antikörper stammen aus der B-Zell-Linie (Plasmazellen). T-Killerzellen töten infizierte Körperzellen direkt.")));
  if (has("th") && offered("tk")) list.push(matchSlip([[CELLS.th.name, jobOf("tk")]], tx("Helper, not killer", "Helfer, nicht Killer"), tx("The T helper cell helps and coordinates: it activates the others. Killing is done by the T killer cells.", "Die T-Helferzelle hilft und koordiniert: Sie aktiviert die anderen. Töten tun die T-Killerzellen.")));
  if (has("macro") && offered("plasma")) list.push(matchSlip([[CELLS.macro.name, jobOf("plasma")]], tx("Eating, not producing", "Fressen, nicht produzieren"), tx("Macrophages eat pathogens. Antibodies are made by plasma cells.", "Makrophagen fressen Erreger. Antikörper bilden die Plasmazellen.")));
  return {
    instruction: tx("Match the cells", "Ordne die Zellen zu"),
    text: tx("What is the job of each cell of the immune system?", "Welche Aufgabe hat jede Zelle des Immunsystems?"),
    answer: { kind: "match", pairs, distractors },
    hint: tx("Macrophages eat and present, T helper cells coordinate, plasma cells (from B cells) make antibodies, T killer cells kill, memory cells remember.", "Makrophagen fressen und präsentieren, T-Helferzellen koordinieren, Plasmazellen (aus B-Zellen) bilden Antikörper, T-Killerzellen töten, Gedächtniszellen erinnern sich."),
    solution: pick.map((id, i) => ({ math: join(q(CELLS[id].name, `c${i}`), "\\to", q(CELLS[id].job, `j${i}`)), note: tx(`${en(CELLS[id].name)}: ${en(CELLS[id].job)}.`, `${de(CELLS[id].name)}: ${de(CELLS[id].job)}.`) })),
    mistakes: list,
  };
}

type Who = { clue: Text; right: CellId; wrong: Partial<Record<CellId, Text>> };
const WHO: Who[] = [
  {
    clue: tx("This type of cell makes large amounts of antibodies and releases them.", "Dieser Zelltyp bildet große Mengen Antikörper und gibt sie ab."),
    right: "plasma",
    wrong: {
      mem: tx("Memory cells don't make antibodies directly. At a second infection they quickly turn into plasma cells first.", "Gedächtniszellen bilden nicht direkt Antikörper. Bei einer Zweitinfektion werden sie zuerst schnell zu Plasmazellen."),
      th: tx("T helper cells activate B cells, but they don't make antibodies themselves.", "T-Helferzellen aktivieren B-Zellen, bilden aber selbst keine Antikörper."),
      tk: tx("B and T swapped! Antibodies come from the B cell line. T killer cells kill infected cells.", "B und T vertauscht! Antikörper stammen aus der B-Zell-Linie. T-Killerzellen töten infizierte Zellen."),
      macro: tx("Macrophages eat pathogens, they don't make antibodies.", "Makrophagen fressen Erreger, sie bilden keine Antikörper."),
    },
  },
  {
    clue: tx("This type of cell recognises body cells infected by viruses and kills them.", "Dieser Zelltyp erkennt virusinfizierte Körperzellen und tötet sie."),
    right: "tk",
    wrong: {
      b: tx("B and T swapped! B cells become plasma cells and make antibodies. Killing infected cells is the job of T killer cells.", "B und T vertauscht! B-Zellen werden zu Plasmazellen und bilden Antikörper. Infizierte Zellen töten die T-Killerzellen."),
      th: tx("The T helper cell only activates the killers. It doesn't kill itself.", "Die T-Helferzelle aktiviert die Killer nur. Selbst tötet sie nicht."),
      plasma: tx("Plasma cells make antibodies. Antibodies can't reach viruses hidden inside a cell.", "Plasmazellen bilden Antikörper. An Viren, die sich in einer Zelle verstecken, kommen Antikörper nicht heran."),
      macro: tx("Macrophages eat pathogens and remains, but they don't recognise infected body cells.", "Makrophagen fressen Erreger und Reste, erkennen aber keine infizierten Körperzellen."),
    },
  },
  {
    clue: tx("This type of cell engulfs pathogens and then presents their antigens on its surface.", "Dieser Zelltyp nimmt Erreger auf und präsentiert danach deren Antigene auf seiner Oberfläche."),
    right: "macro",
    wrong: {
      tk: tx("T killer cells kill infected cells, they don't eat pathogens.", "T-Killerzellen töten infizierte Zellen, sie fressen keine Erreger."),
      plasma: tx("Plasma cells make antibodies, they don't eat anything.", "Plasmazellen bilden Antikörper, sie fressen nichts."),
      mem: tx("Memory cells remember. Eating is the job of the phagocytes.", "Gedächtniszellen erinnern sich. Fressen ist der Job der Fresszellen."),
      th: tx("T helper cells recognise the presented antigen, but they don't eat pathogens.", "T-Helferzellen erkennen das präsentierte Antigen, fressen aber keine Erreger."),
    },
  },
  {
    clue: tx("This type of cell recognises the antigen presented by a macrophage and then activates B cells and T killer cells.", "Dieser Zelltyp erkennt das von einer Makrophage präsentierte Antigen und aktiviert dann B-Zellen und T-Killerzellen."),
    right: "th",
    wrong: {
      tk: tx("T killer cells are activated themselves. The coordinator is the T helper cell.", "T-Killerzellen werden selbst aktiviert. Der Koordinator ist die T-Helferzelle."),
      mem: tx("Memory cells only matter at a second infection. Who coordinates the first response?", "Gedächtniszellen spielen erst bei einer Zweitinfektion eine Rolle. Wer koordiniert die erste Abwehr?"),
      b: tx("B cells are activated by this cell, they don't activate the others.", "B-Zellen werden von dieser Zelle aktiviert, sie aktivieren nicht die anderen."),
      plasma: tx("Plasma cells only make antibodies.", "Plasmazellen bilden nur Antikörper."),
    },
  },
  {
    clue: tx("This type of cell stays in the body for years after an infection and allows a fast response next time.", "Dieser Zelltyp bleibt nach einer Infektion jahrelang im Körper und ermöglicht beim nächsten Mal eine schnelle Abwehr."),
    right: "mem",
    wrong: {
      plasma: tx("Plasma cells die after a few days to weeks. The long-lived ones are the memory cells.", "Plasmazellen sterben nach Tagen bis Wochen ab. Langlebig sind die Gedächtniszellen."),
      macro: tx("Macrophages have no memory for particular pathogens: they are part of the non-specific defence.", "Makrophagen haben kein Gedächtnis für bestimmte Erreger: Sie gehören zur unspezifischen Abwehr."),
      th: tx("Activated T helper cells disappear after the infection. Only memory cells stay.", "Aktivierte T-Helferzellen verschwinden nach der Infektion. Nur Gedächtniszellen bleiben."),
      tk: tx("The T killer cells of the infection don't stay. Only memory cells do.", "Die T-Killerzellen der Infektion bleiben nicht. Das tun nur Gedächtniszellen."),
    },
  },
  {
    clue: tx("This type of cell carries antibodies as receptors on its surface and turns into plasma cells when activated.", "Dieser Zelltyp trägt Antikörper als Rezeptoren auf seiner Oberfläche und wird nach Aktivierung zur Plasmazelle."),
    right: "b",
    wrong: {
      th: tx("T helper cells have T cell receptors, not antibodies. Plasma cells come from B cells.", "T-Helferzellen haben T-Zell-Rezeptoren, keine Antikörper. Plasmazellen gehen aus B-Zellen hervor."),
      tk: tx("B and T swapped! Plasma cells come from B cells.", "B und T vertauscht! Plasmazellen gehen aus B-Zellen hervor."),
      macro: tx("Macrophages don't turn into plasma cells. Think of the lymphocytes.", "Makrophagen werden nicht zu Plasmazellen. Denk an die Lymphozyten."),
      mem: tx("Memory cells come from activated B cells. Which cell is the starting point?", "Gedächtniszellen entstehen aus aktivierten B-Zellen. Welche Zelle ist der Anfang?"),
    },
  },
];

function whoTask(rng: Rng, w: Who = rng.pick(WHO)): Exercise {
  const wrongIds = some(rng, Object.keys(w.wrong) as CellId[], 3);
  const { answer, mistakes: list } = choice(rng, [{ text: CELLS[w.right].name }, ...wrongIds.map((id) => ({ text: CELLS[id].name, title: tx("Another cell's job", "Aufgabe einer anderen Zelle"), say: w.wrong[id]! }))]);
  return {
    instruction: tx("Which cell?", "Welche Zelle?"),
    text: w.clue,
    answer,
    hint: tx("Who eats, who coordinates, who makes antibodies, who kills, who remembers?", "Wer frisst, wer koordiniert, wer bildet Antikörper, wer tötet, wer erinnert sich?"),
    solution: solve(CELLS[w.right].job, tx("That's exactly this cell's job.", "Genau das ist die Aufgabe dieser Zelle."), CELLS[w.right].name, tx(`It's the **${en(CELLS[w.right].name)}**.`, `Das ist die **${de(CELLS[w.right].name)}**.`)),
    mistakes: list,
  };
}

const RESPONSE_SHORT: Text[] = [tx("macrophage", "Makrophage"), tx("T helper", "T-Helfer"), tx("B cell", "B-Zelle"), tx("plasma cells", "Plasmazellen"), tx("antibodies", "Antikörper"), tx("clumps", "Verklumpung"), tx("phagocytes", "Fresszellen")];

function responseTask(rng: Rng, from = rng.int(0, 2)): Exercise {
  const items = RESPONSE.slice(from, from + 5);
  const has = (i: number) => i >= from && i < from + 5;
  const list: Mistake[] = [];
  if (has(4) && has(2)) list.push(orderSlip([RESPONSE[4], RESPONSE[2]], tx("Antibodies come later", "Antikörper kommen später"), tx("There are no matching antibodies yet at the start. They only appear once a matching B cell has been activated and has become plasma cells.", "Am Anfang gibt es noch keine passenden Antikörper. Sie entstehen erst, wenn eine passende B-Zelle aktiviert wurde und zu Plasmazellen geworden ist.")));
  if (has(0) && has(1)) list.push(orderSlip([RESPONSE[1], RESPONSE[0]], tx("Presentation first", "Erst präsentieren"), tx("The T helper cell can only recognise the antigen once a macrophage presents it on its surface.", "Die T-Helferzelle kann das Antigen erst erkennen, wenn eine Makrophage es auf ihrer Oberfläche präsentiert.")));
  if (has(5) && has(6)) list.push(orderSlip([RESPONSE[6], RESPONSE[5]], tx("Clump first", "Erst verklumpen"), tx("The phagocytes eat the clumps: so the antibodies must clump the pathogens first.", "Die Fresszellen fressen die Klumpen: Also müssen die Antikörper die Erreger erst verklumpen.")));
  if (has(3) && has(2)) list.push(orderSlip([RESPONSE[3], RESPONSE[2]], tx("Activation first", "Erst aktivieren"), tx("A B cell only starts dividing after the T helper cell has activated it.", "Eine B-Zelle teilt sich erst, nachdem die T-Helferzelle sie aktiviert hat.")));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: tx("Pathogens have entered the body. Put the steps of the specific immune response in order.", "Erreger sind in den Körper eingedrungen. Bring die Schritte der spezifischen Immunreaktion in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("Macrophage, T helper cell, B cell, plasma cells, antibodies, clumping, phagocytes.", "Makrophage, T-Helferzelle, B-Zelle, Plasmazellen, Antikörper, Verklumpung, Fresszellen."),
    solution: [{ math: listFrame(RESPONSE_SHORT.slice(from, from + 5)), note: tx("Presentation activates the T helper cell, which activates the B cell; plasma cells make antibodies that clump the pathogens; phagocytes clear them away.", "Die Präsentation aktiviert die T-Helferzelle, sie aktiviert die B-Zelle; Plasmazellen bilden Antikörper, die die Erreger verklumpen; Fresszellen räumen auf.") }],
    mistakes: list,
  };
}

const UNSPEC: Text = tx("Non-specific defence", "Unspezifische Abwehr");
const SPEC: Text = tx("Specific defence", "Spezifische Abwehr");

function specificTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const d = rng.pick(DEFENCES);
    const macro = en(d.text).startsWith("macrophages");
    const answer: AnswerSpec = { kind: "choice", options: [UNSPEC, SPEC], correct: d.specific ? 1 : 0 };
    const list: Mistake[] = [
      {
        when: { kind: "choice", options: [UNSPEC, SPEC], correct: d.specific ? 0 : 1 },
        title: d.specific ? tx("Aimed at one pathogen", "Gezielt gegen einen Erreger") : tx("Against everything foreign", "Gegen alles Fremde"),
        say: d.specific
          ? tx(`${en(capT(d.text))} only act against one particular antigen, and that takes a few days at first. That's specific.`, `${de(capT(d.text))} richten sich nur gegen ein bestimmtes Antigen, und das dauert beim ersten Mal einige Tage. Das ist spezifisch.`)
          : macro
            ? tx("Macrophages present antigens, but they eat anything foreign, without choosing. That's non-specific.", "Makrophagen präsentieren zwar Antigene, aber sie fressen alles Fremde, ohne Auswahl. Das ist unspezifisch.")
            : tx(`${en(capT(d.text))} acts against all pathogens alike, at once and without memory. That's non-specific.`, `${de(capT(d.text))} wirkt gegen alle Erreger gleich, sofort und ohne Gedächtnis. Das ist unspezifisch.`),
      },
    ];
    return {
      instruction: tx("Specific or not?", "Spezifisch oder nicht?"),
      text: tx(`Is **${en(d.text)}** part of the non-specific or of the specific defence?`, `Gehört **${de(d.text)}** zur unspezifischen oder zur spezifischen Abwehr?`),
      answer,
      hint: tx("Non-specific: innate, at once, against everything foreign. Specific: against one particular antigen, with memory.", "Unspezifisch: angeboren, sofort, gegen alles Fremde. Spezifisch: gegen ein bestimmtes Antigen, mit Gedächtnis."),
      solution: solve(capT(d.text), d.specific ? tx("Works against one particular antigen.", "Wirkt gegen ein bestimmtes Antigen.") : tx("Works against everything foreign, at once.", "Wirkt sofort gegen alles Fremde."), d.specific ? SPEC : UNSPEC, d.specific ? tx("So: **specific** defence.", "Also: **spezifische** Abwehr.") : tx("So: **non-specific** defence.", "Also: **unspezifische** Abwehr.")),
      mistakes: list,
    };
  }
  const pool = [...some(rng, DEFENCES.filter((d) => d.specific), rng.int(2, 3)), ...some(rng, DEFENCES.filter((d) => !d.specific), 3)];
  const { picked, options, correct, answer } = multiOf(
    rng,
    pool.map((d) => ({ ...d, text: capT(d.text) })),
    (d) => d.specific,
  );
  const m = mistakes(answer);
  const mac = picked.findIndex((d) => en(d.text).startsWith("Macrophages"));
  if (mac >= 0) m.add({ kind: "multi", options, correct: [...correct, mac].sort((a, b) => a - b) }, tx("Macrophages eat everything", "Makrophagen fressen alles"), tx("Macrophages do present antigens to the specific defence, but they themselves eat anything foreign: non-specific.", "Makrophagen präsentieren zwar Antigene für die spezifische Abwehr, fressen selbst aber alles Fremde: unspezifisch."));
  const ab = picked.findIndex((d) => en(d.text) === "Antibodies");
  if (ab >= 0) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== ab) }, tx("Antibodies are specific", "Antikörper sind spezifisch"), tx("Each antibody fits exactly one antigen: that's the heart of the specific defence.", "Jeder Antikörper passt genau zu einem Antigen: Das ist das Herzstück der spezifischen Abwehr."));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which of these belong to the **specific** defence?", "Was davon gehört zur **spezifischen** Abwehr?"),
    answer,
    hint: tx("Specific means: aimed at one particular antigen. Barriers, phagocytes, inflammation and fever act against everything.", "Spezifisch heißt: gegen ein bestimmtes Antigen. Barrieren, Fresszellen, Entzündung und Fieber wirken gegen alles."),
    solution: [
      { math: tx('"specific:"#s \\; "lymphocytes, antibodies"#l', '"spezifisch:"#s \\; "Lymphozyten, Antikörper"#l'), note: tx("The specific defence: B cells, plasma cells, antibodies, T cells and memory cells.", "Die spezifische Abwehr: B-Zellen, Plasmazellen, Antikörper, T-Zellen und Gedächtniszellen.") },
      { math: listFrame(correct.map((i) => options[i]), " , "), note: tx("These are specific here.", "Diese sind hier spezifisch.") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Antigen and antibody

const LK_SHAPES: Epitope[] = EPITOPES;

function lockKeyTask(rng: Rng, shape: Epitope = rng.pick(LK_SHAPES)): Exercise {
  const others = some(rng, LK_SHAPES.filter((s) => s !== shape), 2);
  const slots = rng.shuffle([0, 1, 2, 3]);
  const options: Epitope[] = Array(4);
  options[slots[0]] = shape; // the fitting antibody
  options[slots[1]] = shape; // same shape as a bump: doesn't fit
  options[slots[2]] = others[0];
  options[slots[3]] = others[1];
  const letters = ["A", "B", "C", "D"];
  const answer: AnswerSpec = { kind: "choice", options: letters, correct: slots[0] };
  const list: Mistake[] = [
    { when: { kind: "choice", options: letters, correct: slots[1] }, title: tx("Same shape, not the counter-shape", "Gleiche Form statt Gegenform"), say: tx("This antibody carries the antigen's own shape as a bump: two bumps can't fit into each other. The binding site must be the counter-shape, like a lock for a key.", "Dieser Antikörper trägt die Form des Antigens selbst als Höcker: Zwei Höcker passen nicht ineinander. Die Bindungsstelle muss die Gegenform sein, wie ein Schloss zum Schlüssel.") },
    { when: { kind: "choice", options: letters, correct: slots[2] }, title: tx("Different shape", "Andere Form"), say: tx("This binding site has a different shape than the antigen. Compare the outlines closely.", "Diese Bindungsstelle hat eine andere Form als das Antigen. Vergleich die Umrisse genau.") },
    { when: { kind: "choice", options: letters, correct: slots[3] }, title: tx("Different shape", "Andere Form"), say: tx("This binding site has a different shape than the antigen. Compare the outlines closely.", "Diese Bindungsstelle hat eine andere Form als das Antigen. Vergleich die Umrisse genau.") },
  ];
  return {
    instruction: tx("Lock and key", "Schlüssel und Schloss"),
    text: tx("At the top you see antigens on the surface of a pathogen. Which antibody can bind to them?", "Oben siehst du Antigene auf der Oberfläche eines Erregers. Welcher Antikörper kann an sie binden?"),
    visual: visual(ImmuneLockKeyPicture, { shape, options, same: slots[1] }),
    answer,
    hint: tx("The binding site at the tips of the Y must be the exact counter-shape of the antigen.", "Die Bindungsstelle an den Spitzen des Y muss genau die Gegenform des Antigens sein."),
    solution: [
      { math: tx('"antigen"#a \\; "+" \\; "binding site"#b', '"Antigen"#a \\; "+" \\; "Bindungsstelle"#b'), note: tx("Antigen and binding site fit like a key and a lock: the binding site is the counter-shape.", "Antigen und Bindungsstelle passen wie Schlüssel und Schloss: Die Bindungsstelle ist die Gegenform.") },
      { math: `"${letters[slots[0]]}"#r`, note: tx(`Antibody ${letters[slots[0]]} has exactly the counter-shape.`, `Antikörper ${letters[slots[0]]} hat genau die Gegenform.`), highlight: ["r"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Immunisation

const ACTIVE: Text = tx("Active immunisation", "Aktive Immunisierung");
const PASSIVE: Text = tx("Passive immunisation", "Passive Immunisierung");

function activePassiveTask(rng: Rng): Exercise {
  const active = rng.chance(0.5);
  const text = active ? rng.pick(ACTIVE_CASES) : rng.pick(PASSIVE_CASES);
  const options = [ACTIVE, PASSIVE];
  return {
    instruction: tx("Active or passive?", "Aktiv oder passiv?"),
    text: tx(`${en(text)} Which kind of immunisation is this?`, `${de(text)} Welche Art der Immunisierung ist das?`),
    answer: { kind: "choice", options, correct: active ? 0 : 1 },
    hint: tx("Does the body make the antibodies itself (active), or does it receive ready-made antibodies (passive)?", "Bildet der Körper die Antikörper selbst (aktiv), oder bekommt er fertige Antikörper (passiv)?"),
    solution: solve(active ? tx("pathogen or part of it", "Erreger oder Teil davon") : tx("ready-made antibodies", "fertige Antikörper"), active ? tx("The body gets the antigen and must react itself.", "Der Körper bekommt das Antigen und muss selbst reagieren.") : tx("The body gets antibodies made elsewhere.", "Der Körper bekommt Antikörper, die woanders gebildet wurden."), active ? ACTIVE : PASSIVE, active ? tx("The body makes antibodies and memory cells itself: **active**.", "Der Körper bildet selbst Antikörper und Gedächtniszellen: **aktiv**.") : tx("Ready-made antibodies protect at once but only for weeks: **passive**.", "Fertige Antikörper schützen sofort, aber nur für Wochen: **passiv**.")),
    mistakes: [
      active
        ? { when: { kind: "choice", options, correct: 1 }, title: tx("Vaccines contain no antibodies", "Impfstoffe enthalten keine Antikörper"), say: tx("A vaccine for active immunisation contains no antibodies, but pathogens, parts of them or their blueprint. The body makes the antibodies itself: active.", "Ein Impfstoff für die aktive Immunisierung enthält keine Antikörper, sondern Erreger, Teile davon oder ihren Bauplan. Die Antikörper bildet der Körper selbst: aktiv.") }
        : { when: { kind: "choice", options, correct: 0 }, title: tx("Ready-made antibodies", "Fertige Antikörper"), say: tx("Here the body gets ready-made antibodies and doesn't have to make anything itself. That's passive, and it leaves no memory cells.", "Hier bekommt der Körper fertige Antikörper und muss selbst nichts bilden. Das ist passiv, und es bleiben keine Gedächtniszellen.") },
    ],
  };
}

function claimsTask(rng: Rng, active = rng.chance(0.5)): Exercise {
  let pool = some(rng, IMMUNISATION_CLAIMS, 5);
  for (let k = 0; k < 20; k++) {
    const r = pool.filter((c) => c.active === active).length;
    if (r >= 2 && r <= 3) break;
    pool = some(rng, IMMUNISATION_CLAIMS, 5);
  }
  const { picked, options, correct, answer } = multiOf(rng, pool, (c) => c.active === active);
  const m = mistakes(answer);
  const plus = (i: number) => [...correct, i].sort((a, b) => a - b);
  if (active) {
    const ready = picked.findIndex((c) => en(c.text).startsWith("Ready-made"));
    if (ready >= 0) m.add({ kind: "multi", options, correct: plus(ready) }, tx("Vaccines contain no antibodies", "Impfstoffe enthalten keine Antikörper"), tx("The classic mix-up! In an active vaccination you get antigens, not antibodies. Ready-made antibodies are passive immunisation.", "Die klassische Verwechslung! Bei der aktiven Impfung bekommst du Antigene, keine Antikörper. Fertige Antikörper sind passive Immunisierung."));
    const now = picked.findIndex((c) => en(c.text).startsWith("Protection starts at once"));
    if (now >= 0) m.add({ kind: "multi", options, correct: plus(now) }, tx("It takes time", "Das dauert"), tx("After an active vaccination the body first needs one to two weeks for its primary response.", "Nach einer aktiven Impfung braucht der Körper erst ein bis zwei Wochen für seine Primärreaktion."));
  } else {
    const mem = picked.findIndex((c) => en(c.text).startsWith("Memory cells"));
    if (mem >= 0) m.add({ kind: "multi", options, correct: plus(mem) }, tx("No memory", "Kein Gedächtnis"), tx("With ready-made antibodies your own immune system doesn't learn anything: no memory cells are formed.", "Bei fertigen Antikörpern lernt dein eigenes Immunsystem nichts: Es entstehen keine Gedächtniszellen."));
    const years = picked.findIndex((c) => en(c.text).startsWith("Protection lasts"));
    if (years >= 0) m.add({ kind: "multi", options, correct: plus(years) }, tx("Foreign antibodies are broken down", "Fremde Antikörper werden abgebaut"), tx("Ready-made antibodies are broken down within weeks, so passive protection is short.", "Fertige Antikörper werden in wenigen Wochen abgebaut, der passive Schutz ist also kurz."));
  }
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: active ? tx("Which statements are true for **active** immunisation?", "Welche Aussagen treffen auf die **aktive** Immunisierung zu?") : tx("Which statements are true for **passive** immunisation?", "Welche Aussagen treffen auf die **passive** Immunisierung zu?"),
    answer,
    hint: tx("Active: the body learns by itself. Passive: it gets ready-made antibodies.", "Aktiv: Der Körper lernt selbst. Passiv: Er bekommt fertige Antikörper."),
    solution: [
      { math: active ? tx('"active:"#a \\; "own antibodies + memory"#m', '"aktiv:"#a \\; "eigene Antikörper + Gedächtnis"#m') : tx('"passive:"#a \\; "ready-made antibodies"#m', '"passiv:"#a \\; "fertige Antikörper"#m'), note: active ? tx("Active: slow start, long protection, memory cells.", "Aktiv: langsamer Start, langer Schutz, Gedächtniszellen.") : tx("Passive: immediate but short protection, no memory cells.", "Passiv: sofortiger, aber kurzer Schutz, keine Gedächtniszellen.") },
      { math: listFrame(correct.map((i) => options[i]), " , "), note: tx("These statements are true.", "Diese Aussagen stimmen.") },
    ],
    mistakes: m.list,
  };
}

function vaccineTask(rng: Rng, form = rng.int(0, 1)): Exercise {
  const forms: { text: Text; opts: Opt[]; a: Text; note: Text }[] = [
    {
      text: tx("What does a vaccine for **active** immunisation contain?", "Was enthält ein Impfstoff für die **aktive** Immunisierung?"),
      opts: [
        { text: tx("Weakened or killed pathogens, parts of them, or the blueprint (mRNA) for one of their proteins", "Abgeschwächte oder abgetötete Erreger, Teile davon oder den Bauplan (mRNA) für eines ihrer Proteine") },
        { text: tx("Ready-made antibodies against the pathogen", "Fertige Antikörper gegen den Erreger"), title: tx("That's passive", "Das ist passiv"), say: tx("Ready-made antibodies are given in passive immunisation (serum). An active vaccine contains antigens, so the body makes its own antibodies.", "Fertige Antikörper gibt man bei der passiven Immunisierung (Heilserum). Ein aktiver Impfstoff enthält Antigene, damit der Körper eigene Antikörper bildet.") },
        { text: tx("Memory cells from a donor", "Gedächtniszellen eines Spenders"), title: tx("The body makes its own", "Der Körper bildet sie selbst"), say: tx("Memory cells can't simply be transferred: your own B and T cells form them during the response to the vaccine.", "Gedächtniszellen kann man nicht einfach übertragen: Deine eigenen B- und T-Zellen bilden sie bei der Reaktion auf den Impfstoff.") },
        { text: tx("Antibiotics that kill the pathogen", "Antibiotika, die den Erreger abtöten"), title: tx("Not a medicine", "Kein Medikament"), say: tx("Antibiotics treat bacterial infections. A vaccine trains the immune system.", "Antibiotika behandeln bakterielle Infektionen. Ein Impfstoff trainiert das Immunsystem.") },
      ],
      a: tx("antigens", "Antigene"),
      note: tx("The vaccine contains antigens. The body responds with its own antibodies and memory cells.", "Der Impfstoff enthält Antigene. Der Körper antwortet mit eigenen Antikörpern und Gedächtniszellen."),
    },
    {
      text: tx("How does an mRNA vaccine work?", "Wie wirkt ein mRNA-Impfstoff?"),
      opts: [
        { text: tx("Body cells briefly make a viral surface protein from the blueprint; the immune system reacts to it as an antigen", "Körperzellen stellen nach dem Bauplan kurzzeitig ein Oberflächenprotein des Virus her; das Immunsystem reagiert darauf als Antigen") },
        { text: tx("The mRNA is built into the DNA in the nucleus", "Die mRNA wird im Zellkern in die DNA eingebaut"), title: tx("It doesn't touch the DNA", "Sie verändert die DNA nicht"), say: tx("The mRNA stays in the cytoplasm, is read at the ribosomes and broken down after a few days. It doesn't get into the DNA.", "Die mRNA bleibt im Cytoplasma, wird an den Ribosomen abgelesen und nach einigen Tagen abgebaut. In die DNA gelangt sie nicht.") },
        { text: tx("The mRNA is a weakened virus", "Die mRNA ist ein abgeschwächtes Virus"), title: tx("Only a blueprint", "Nur ein Bauplan"), say: tx("There is no virus in it: only the blueprint for a single viral protein.", "Darin ist kein Virus: nur der Bauplan für ein einziges Virusprotein.") },
        { text: tx("The mRNA itself acts as an antibody", "Die mRNA wirkt selbst als Antikörper"), title: tx("Antibodies are proteins", "Antikörper sind Proteine"), say: tx("Antibodies are proteins made by plasma cells. The mRNA only leads to the antigen being made.", "Antikörper sind Proteine aus Plasmazellen. Die mRNA sorgt nur dafür, dass das Antigen hergestellt wird.") },
      ],
      a: tx("antigen made in the body", "Antigen im Körper gebildet"),
      note: tx("The body's own cells make the antigen for a short time; the immune system responds with antibodies and memory cells.", "Körpereigene Zellen bilden kurzzeitig das Antigen; das Immunsystem antwortet mit Antikörpern und Gedächtniszellen."),
    },
  ];
  const f = forms[form];
  const { answer, mistakes: list } = choice(rng, f.opts);
  return {
    instruction: tx("Vaccines", "Impfstoffe"),
    text: f.text,
    answer,
    hint: tx("An active vaccine shows the body the antigen; it must make the antibodies itself.", "Ein aktiver Impfstoff zeigt dem Körper das Antigen; die Antikörper muss er selbst bilden."),
    solution: [
      { math: q(tx("vaccine", "Impfstoff"), "v"), note: tx("Active immunisation: the vaccine imitates an infection without the illness.", "Aktive Immunisierung: Der Impfstoff ahmt eine Infektion nach, ohne die Krankheit.") },
      { math: join(q(tx("vaccine", "Impfstoff"), "v"), "\\to", q(f.a, "a")), note: f.note, highlight: ["a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Primary and secondary response (graphs)

function graphTask(rng: Rng, form = rng.int(0, 2)): Exercise {
  if (form === 0) {
    const swap = rng.chance(0.5);
    const second = swap ? tx("Curve 1", "Kurve 1") : tx("Curve 2", "Kurve 2");
    const first = swap ? tx("Curve 2", "Kurve 2") : tx("Curve 1", "Kurve 1");
    const opts: Opt[] = [
      { text: second },
      { text: first, title: tx("Slower and lower", "Langsamer und niedriger"), say: tx("This curve rises late and stays low: that's the first contact (primary response). At a second infection memory cells make the response faster and stronger.", "Diese Kurve steigt spät und bleibt niedrig: Das ist der Erstkontakt (Primärreaktion). Bei der Zweitinfektion sorgen Gedächtniszellen für eine schnellere, stärkere Reaktion.") },
      { text: tx("You can't tell from the graph", "Das kann man am Diagramm nicht erkennen"), title: tx("You can tell", "Doch, man kann"), say: tx("Look at when each curve starts to rise and how high it gets. The second infection is faster and stronger.", "Schau, wann jede Kurve ansteigt und wie hoch sie wird. Die Zweitinfektion verläuft schneller und stärker.") },
    ];
    const { answer, mistakes: list } = choice(rng, opts);
    return {
      instruction: tx("Read the graph", "Lies das Diagramm ab"),
      text: tx("The graph shows the antibody concentration after an infection, once at the first and once at a second infection with the same pathogen. Which curve belongs to the **second** infection?", "Das Diagramm zeigt die Antikörperkonzentration nach einer Infektion, einmal beim ersten und einmal bei einer zweiten Infektion mit demselben Erreger. Welche Kurve gehört zur **Zweitinfektion**?"),
      visual: visual(ImmuneTiterGraph, { preset: "overlay", swap }),
      answer,
      hint: tx("At a second infection memory cells are already there.", "Bei einer Zweitinfektion sind schon Gedächtniszellen da."),
      solution: solve(tx("faster and higher", "schneller und höher"), tx("At a second infection memory cells start the response at once.", "Bei der Zweitinfektion starten Gedächtniszellen die Reaktion sofort."), second, tx("So the steep, high curve is the **secondary response**.", "Die steile, hohe Kurve ist also die **Sekundärreaktion**.")),
      mistakes: list,
    };
  }
  if (form === 1) {
    const { answer, mistakes: list } = choice(rng, [
      { text: tx("Memory cells recognise the pathogen at once and quickly turn into many plasma cells", "Gedächtniszellen erkennen den Erreger sofort und werden schnell zu vielen Plasmazellen") },
      { text: tx("Memory cells release antibodies straight away", "Gedächtniszellen geben sofort Antikörper ab"), title: tx("Memory cells make no antibodies", "Gedächtniszellen bilden keine Antikörper"), say: tx("Nearly! But memory cells don't make antibodies themselves: they first divide and turn into plasma cells, which do.", "Fast! Aber Gedächtniszellen bilden selbst keine Antikörper: Sie teilen sich erst und werden zu Plasmazellen, und die bilden sie.") },
      { text: tx("The antibodies from the first infection stay in the blood for ever", "Die Antikörper aus der ersten Infektion bleiben für immer im Blut"), title: tx("Antibodies are broken down", "Antikörper werden abgebaut"), say: tx("Antibodies are broken down over weeks and months. The lasting memory is in the memory cells.", "Antikörper werden über Wochen und Monate abgebaut. Das bleibende Gedächtnis steckt in den Gedächtniszellen.") },
      { text: tx("The pathogen is weaker the second time", "Der Erreger ist beim zweiten Mal schwächer"), title: tx("Same pathogen", "Derselbe Erreger"), say: tx("It's the same pathogen. What has changed is your immune system.", "Es ist derselbe Erreger. Verändert hat sich dein Immunsystem.") },
    ]);
    return {
      instruction: tx("Explain the graph", "Erkläre das Diagramm"),
      text: tx("After the second infection with the same pathogen the antibody concentration rises much faster and higher. Why?", "Nach der zweiten Infektion mit demselben Erreger steigt die Antikörperkonzentration viel schneller und höher an. Warum?"),
      visual: visual(ImmuneTiterGraph, { preset: "course" }),
      answer,
      hint: tx("What is left over from the first infection?", "Was ist von der ersten Infektion übrig geblieben?"),
      solution: solve(tx("memory cells", "Gedächtniszellen"), tx("After the first infection memory cells remain.", "Nach der ersten Infektion bleiben Gedächtniszellen zurück."), tx("quickly many plasma cells", "schnell viele Plasmazellen"), tx("They recognise the pathogen at once and quickly become plasma cells: the **secondary response** is faster and stronger.", "Sie erkennen den Erreger sofort und werden schnell zu Plasmazellen: Die **Sekundärreaktion** ist schneller und stärker.")),
      mistakes: list,
    };
  }
  const swap = rng.chance(0.5);
  const passive = swap ? tx("Curve 1", "Kurve 1") : tx("Curve 2", "Kurve 2");
  const activeC = swap ? tx("Curve 2", "Kurve 2") : tx("Curve 1", "Kurve 1");
  const { answer, mistakes: list } = choice(rng, [
    { text: passive },
    { text: activeC, title: tx("That one rises slowly", "Die steigt langsam an"), say: tx("This curve only rises after some days and then stays: the body makes its own antibodies. That's active immunisation.", "Diese Kurve steigt erst nach einigen Tagen an und bleibt dann: Der Körper bildet eigene Antikörper. Das ist aktive Immunisierung.") },
  ]);
  return {
    instruction: tx("Read the graph", "Lies das Diagramm ab"),
    text: tx("On day 0 two people are immunised against tetanus: one actively with a vaccine, one passively with a serum. Which curve shows the **passive** immunisation?", "An Tag 0 werden zwei Personen gegen Tetanus immunisiert: eine aktiv mit einem Impfstoff, eine passiv mit einem Heilserum. Welche Kurve zeigt die **passive** Immunisierung?"),
    visual: visual(ImmuneTiterGraph, { preset: "activePassive", swap }),
    answer,
    hint: tx("Ready-made antibodies are there at once, but they are broken down.", "Fertige Antikörper sind sofort da, werden aber abgebaut."),
    solution: solve(tx("at once, then falling", "sofort da, dann fallend"), tx("Ready-made antibodies protect immediately, then they are broken down.", "Fertige Antikörper schützen sofort, dann werden sie abgebaut."), passive, tx("That's the **passive** immunisation: no memory cells, short protection.", "Das ist die **passive** Immunisierung: keine Gedächtniszellen, kurzer Schutz.")),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Calculations

function sizeTask(rng: Rng): Exercise {
  const um = rng.pick([1, 2, 3, 5]);
  const nm = rng.pick([20, 50, 100, 200]);
  const value = (um * 1000) / nm;
  const answer: AnswerSpec = { kind: "number", value };
  const m = mistakes(answer);
  m.add({ kind: "number", value: um / nm, tolerance: 0.001 }, tx("Units!", "Einheiten!"), tx(`µm and nm are different units: 1 µm = 1000 nm. Convert the ${um} µm into nm first.`, `µm und nm sind verschiedene Einheiten: 1 µm = 1000 nm. Rechne die ${um} µm zuerst in nm um.`));
  m.add({ kind: "number", value: (um * 100) / nm, tolerance: 0.001 }, tx("1 µm = 1000 nm", "1 µm = 1000 nm"), tx("Check the conversion: 1 µm is 1000 nm, not 100 nm.", "Prüf die Umrechnung: 1 µm sind 1000 nm, nicht 100 nm."), true);
  m.add({ kind: "number", value: nm / (um * 1000), tolerance: 0.001 }, tx("Upside down", "Verkehrt herum"), tx("That's how big the virus is compared with the bacterium. The question asks how many times larger the bacterium is: bacterium ÷ virus.", "So groß ist das Virus im Vergleich zum Bakterium. Gefragt ist, wievielmal größer das Bakterium ist: Bakterium : Virus."));
  return {
    instruction: tx("Calculate", "Berechne"),
    text: tx(`A bacterium is ${um} µm long, a virus is ${nm} nm across. How many times longer is the bacterium than the virus?`, `Ein Bakterium ist ${um} µm lang, ein Virus hat einen Durchmesser von ${nm} nm. Wievielmal länger ist das Bakterium als das Virus?`),
    answer,
    hint: tx("1 µm = 1000 nm. Convert first, then divide.", "1 µm = 1000 nm. Erst umrechnen, dann teilen."),
    solution: [
      { math: `${um} "µm" = ${um * 1000}#n "nm"`, note: tx("Convert to the same unit.", "In dieselbe Einheit umrechnen.") },
      { math: `${um * 1000}#n "nm" : ${nm} "nm" = ${value}#r`, note: tx(`The bacterium is **${value}** times longer. Viruses are tiny!`, `Das Bakterium ist **${value}**-mal länger. Viren sind winzig!`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

function virusCountTask(rng: Rng): Exercise {
  const n = rng.pick([10, 20, 50, 100]);
  const k = n >= 50 ? 2 : rng.pick([2, 3]);
  const value = n ** k;
  const answer: AnswerSpec = { kind: "number", value };
  const m = mistakes(answer);
  m.add({ kind: "number", value: n * k }, tx("Multiply, don't add up", "Malnehmen statt zusammenzählen"), tx(`Each of the ${n} new viruses infects its own cell, and each of those cells releases ${n} again. So multiply by ${n} in every cycle.`, `Jedes der ${n} neuen Viren befällt eine eigene Zelle, und jede dieser Zellen setzt wieder ${n} frei. Also in jedem Zyklus mal ${n}.`));
  m.add({ kind: "number", value: n ** (k - 1) }, tx("One cycle short", "Ein Zyklus zu wenig"), tx(`Count the cycles again: there are ${k}.`, `Zähl die Zyklen noch mal: Es sind ${k}.`), true);
  return {
    instruction: tx("Calculate", "Berechne"),
    text: tx(
      `One virus infects a cell. The cell releases ${n} new viruses, each of which infects a new cell, and so on. How many new viruses are released in the ${k === 2 ? "second" : "third"} cycle?`,
      `Ein Virus befällt eine Zelle. Die Zelle setzt ${n} neue Viren frei, jedes davon befällt eine neue Zelle, und so weiter. Wie viele neue Viren werden im ${k === 2 ? "zweiten" : "dritten"} Zyklus freigesetzt?`,
    ),
    answer,
    hint: tx(`1st cycle: ${n} viruses. In each further cycle every virus becomes ${n}.`, `1. Zyklus: ${n} Viren. In jedem weiteren Zyklus werden aus jedem Virus ${n}.`),
    solution: [
      { math: Array.from({ length: k }, (_, i) => `${n ** (i + 1)}#z${i}`).join(" \\to "), note: tx(`Each cycle multiplies the number by ${n}.`, `Jeder Zyklus vervielfacht die Zahl mit ${n}.`) },
      { math: `${n}^{${k}} = ${value}#r`, note: tx(`After ${k} cycles: **${value}** viruses. That's why a virus infection spreads so fast.`, `Nach ${k} Zyklen: **${value}** Viren. Darum breitet sich eine Virusinfektion so schnell aus.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Terms

type Term = { clue: Text; accept: Text[]; wrong: { accept: Text[]; title: Text; say: Text }[] };
const ANTIGEN: Text[] = [tx("antigen", "Antigen"), tx("antigens", "Antigene")];
const ANTIBODY: Text[] = [tx("antibody", "Antikörper"), tx("antibodies", "Antikörper"), "Immunglobulin", "Immunglobuline"];
const TERMS: Term[] = [
  { clue: tx("A structure on the surface of a pathogen (mostly a protein) by which the immune system recognises it as foreign.", "Eine Struktur auf der Oberfläche eines Erregers (meist ein Protein), an der das Immunsystem ihn als fremd erkennt."), accept: ANTIGEN, wrong: [{ accept: ANTIBODY, title: tx("Antigen or antibody?", "Antigen oder Antikörper?"), say: tx("Mixed up! The antibody is the Y-shaped protein of the body. The feature on the pathogen that it recognises is the antigen.", "Verwechselt! Der Antikörper ist das Y-förmige Protein des Körpers. Das Merkmal auf dem Erreger, das er erkennt, ist das Antigen.") }] },
  { clue: tx("Y-shaped proteins made by plasma cells that bind exactly one antigen.", "Y-förmige Proteine aus Plasmazellen, die genau ein Antigen binden."), accept: ANTIBODY, wrong: [{ accept: ANTIGEN, title: tx("Antigen or antibody?", "Antigen oder Antikörper?"), say: tx("Mixed up! The antigen sits on the pathogen. The Y-shaped protein that binds it is the antibody.", "Verwechselt! Das Antigen sitzt auf dem Erreger. Das Y-förmige Protein, das es bindet, ist der Antikörper.") }] },
  { clue: tx("The uptake of a pathogen by a phagocyte, which flows around it and digests it.", "Die Aufnahme eines Erregers durch eine Fresszelle, die ihn umfließt und verdaut."), accept: [tx("phagocytosis", "Phagocytose"), "Phagozytose"], wrong: [] },
  { clue: tx("The clumping of pathogens by antibodies.", "Die Verklumpung von Erregern durch Antikörper."), accept: [tx("agglutination", "Agglutination"), tx("clumping", "Verklumpung")], wrong: [] },
  { clue: tx("The cells that develop from activated B cells and release antibodies.", "Die Zellen, die aus aktivierten B-Zellen entstehen und Antikörper abgeben."), accept: [tx("plasma cells", "Plasmazellen"), tx("plasma cell", "Plasmazelle")], wrong: [{ accept: [tx("memory cells", "Gedächtniszellen"), tx("memory cell", "Gedächtniszelle")], title: tx("Memory cells don't make antibodies", "Gedächtniszellen bilden keine Antikörper"), say: tx("Memory cells come from B cells too, but they don't release antibodies. They wait for the next infection.", "Auch Gedächtniszellen entstehen aus B-Zellen, aber sie geben keine Antikörper ab. Sie warten auf die nächste Infektion.") }] },
  { clue: tx("Long-lived lymphocytes that remember a pathogen and allow a fast secondary response.", "Langlebige Lymphozyten, die sich einen Erreger merken und eine schnelle Sekundärreaktion ermöglichen."), accept: [tx("memory cells", "Gedächtniszellen"), tx("memory cell", "Gedächtniszelle")], wrong: [{ accept: [tx("plasma cells", "Plasmazellen"), tx("plasma cell", "Plasmazelle")], title: tx("Plasma cells die", "Plasmazellen sterben ab"), say: tx("Plasma cells only live for days to weeks. The ones that remember are …", "Plasmazellen leben nur Tage bis Wochen. Die, die sich erinnern, sind …") }] },
  { clue: tx("The T cells that kill virus-infected body cells.", "Die T-Zellen, die virusinfizierte Körperzellen töten."), accept: [tx("T killer cells", "T-Killerzellen"), tx("T killer cell", "T-Killerzelle"), tx("cytotoxic T cells", "zytotoxische T-Zellen"), "Killerzellen"], wrong: [{ accept: [tx("T helper cells", "T-Helferzellen"), tx("T helper cell", "T-Helferzelle")], title: tx("Helpers don't kill", "Helfer töten nicht"), say: tx("T helper cells activate, they don't kill. Which T cells kill?", "T-Helferzellen aktivieren, sie töten nicht. Welche T-Zellen töten?") }] },
  { clue: tx("The group of white blood cells to which B cells and T cells belong.", "Die Gruppe weißer Blutkörperchen, zu der B-Zellen und T-Zellen gehören."), accept: [tx("lymphocytes", "Lymphozyten"), tx("lymphocyte", "Lymphozyt"), "Lymphocyten"], wrong: [{ accept: [tx("phagocytes", "Fresszellen"), tx("macrophages", "Makrophagen")], title: tx("Not the eaters", "Nicht die Fresser"), say: tx("Phagocytes are white blood cells too, but B and T cells form their own group.", "Fresszellen sind auch weiße Blutkörperchen, aber B- und T-Zellen bilden eine eigene Gruppe.") }] },
];

function termTask(rng: Rng, term: Term = rng.pick(TERMS)): Exercise {
  const answer: AnswerSpec = { kind: "word", accept: term.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const w of term.wrong) m.add({ kind: "word", accept: w.accept }, w.title, w.say);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: term.clue,
    answer,
    hint: tx(`It starts with “${en(term.accept[0]).charAt(0).toUpperCase()}”.`, `Er beginnt mit „${de(term.accept[0]).charAt(0).toUpperCase()}“.`),
    solution: [{ math: q(term.accept[0], "a"), note: tx(`The term is **${en(term.accept[0])}**.`, `Der Fachbegriff ist **${de(term.accept[0])}**.`), highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  switch (rng.int(0, 15)) {
    case 0:
      return bacteriumTask(rng);
    case 1:
      return virusTask(rng);
    case 2:
      return compareTask(rng);
    case 3:
      return cycleTask(rng);
    case 4:
      return cellMatchTask(rng);
    case 5:
    case 6:
      return whoTask(rng);
    case 7:
      return responseTask(rng);
    case 8:
      return specificTask(rng);
    case 9:
      return activePassiveTask(rng);
    case 10:
      return rng.chance(0.5) ? claimsTask(rng) : vaccineTask(rng);
    case 11:
      return lockKeyTask(rng);
    case 12:
      return graphTask(rng);
    case 13:
      return rng.chance(0.5) ? sizeTask(rng) : virusCountTask(rng);
    default:
      return termTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

function CompareWidget() {
  return <ImmuneCompare explore />;
}
function CycleWidget() {
  return <ImmuneVirusCycle />;
}
function PhagoWidget() {
  return <ImmunePhagocyte level={2} />;
}
function TiterWidget() {
  return <ImmuneTiter level={2} />;
}

const checkCycle = cycleTask(createRng(3), 0, 5);
const checkLock = lockKeyTask(createRng(12), "trap");
const checkCells = cellMatchTask(createRng(6), ["th", "plasma", "tk", "mem"]);
const checkClaims = claimsTask(createRng(21), true);

export const level2: LevelLesson = {
  lesson: [
    {
      type: "widget",
      title: tx("Bacterium and virus up close", "Bakterium und Virus ganz nah"),
      blob: tx("Let's zoom right in on the pathogens!", "Zoomen wir ganz nah an die Erreger heran!"),
      body: tx(
        "Bacteria are **prokaryotes**: living cells without a nucleus. Viruses are just **genetic material** (DNA or RNA) in a **protein coat (capsid)**, often with an extra **envelope**. Tap through both drawings, then compare.",
        "Bakterien sind **Prokaryoten**: lebende Zellen ohne Zellkern. Viren bestehen nur aus **Erbinformation** (DNA oder RNA) in einer **Proteinhülle (Kapsid)**, oft mit einer zusätzlichen **Hülle**. Tipp dich durch beide Zeichnungen und vergleiche dann.",
      ),
      widget: CompareWidget,
    },
    {
      type: "widget",
      title: tx("How a virus multiplies", "Wie sich ein Virus vermehrt"),
      blob: tx("A virus can't do anything on its own. So it hijacks a cell!", "Ein Virus kann allein gar nichts. Also kapert es eine Zelle!"),
      body: tx("Step through the replication cycle. The host cell does all the work.", "Geh den Vermehrungszyklus Schritt für Schritt durch. Die ganze Arbeit macht die Wirtszelle."),
      widget: CycleWidget,
    },
    { type: "check", blob: tx("Can you put the hijack in order?", "Bekommst du den Überfall in die richtige Reihenfolge?"), exercise: checkCycle },
    {
      type: "widget",
      title: tx("Non-specific defence: phagocytes", "Unspezifische Abwehr: Fresszellen"),
      blob: tx("The first defenders on the spot: big, hungry and not picky.", "Die ersten Verteidiger vor Ort: groß, hungrig und nicht wählerisch."),
      body: tx(
        "If pathogens get past the barriers, **macrophages** (big phagocytes) are there at once. This defence is innate and **non-specific**: it acts against everything foreign, quickly, but without memory.",
        "Kommen Erreger an den Barrieren vorbei, sind sofort **Makrophagen** (große Fresszellen) zur Stelle. Diese Abwehr ist angeboren und **unspezifisch**: Sie wirkt schnell gegen alles Fremde, aber ohne Gedächtnis.",
      ),
      widget: PhagoWidget,
    },
    {
      type: "explain",
      title: tx("Specific defence: antigen and antibody", "Spezifische Abwehr: Antigen und Antikörper"),
      blob: tx("Now it gets specific: for every pathogen there is a matching weapon.", "Jetzt wird es spezifisch: Gegen jeden Erreger gibt es die passende Waffe."),
      frames: [
        { math: tx('"antigen"#a', '"Antigen"#a'), note: tx("Every pathogen carries typical molecules on its surface, mostly proteins: the **antigens**. By them the immune system recognises that something is foreign.", "Jeder Erreger trägt auf seiner Oberfläche typische Moleküle, meist Proteine: die **Antigene**. An ihnen erkennt das Immunsystem, dass etwas fremd ist.") },
        { math: tx('"antigen"#a \\; "+" \\; "antibody"#k', '"Antigen"#a \\; "+" \\; "Antikörper"#k'), note: tx("**Antibodies** are Y-shaped proteins. Their two binding sites fit exactly one antigen, like a key fits a lock (lock-and-key model).", "**Antikörper** sind Y-förmige Proteine. Ihre beiden Bindungsstellen passen genau zu einem Antigen, wie ein Schlüssel zu einem Schloss (Schlüssel-Schloss-Prinzip).") },
        { math: tx('"antigen"#a \\; "+" \\; "antibody"#k \\to "clumping"#v', '"Antigen"#a \\; "+" \\; "Antikörper"#k \\to "Verklumpung"#v'), note: tx("They bind to an antigen-antibody complex. As every antibody has two binding sites, it links two pathogens: they clump together (**agglutination**).", "Sie binden zu einem Antigen-Antikörper-Komplex. Da jeder Antikörper zwei Bindungsstellen hat, verbindet er zwei Erreger: Sie verklumpen (**Agglutination**).") },
        { math: tx('"B cells"#b \\quad "T cells"#t', '"B-Zellen"#b \\quad "T-Zellen"#t'), note: tx("Responsible are the **lymphocytes**: B cells (mature in the bone marrow) and T cells (mature in the thymus). Each carries receptors for just one antigen.", "Verantwortlich sind die **Lymphozyten**: B-Zellen (reifen im Knochenmark) und T-Zellen (reifen im Thymus). Jede trägt Rezeptoren für genau ein Antigen.") },
      ],
    },
    {
      type: "widget",
      title: tx("Lock and key", "Schlüssel und Schloss"),
      blob: tx("Three antibodies, one virus. Which key fits?", "Drei Antikörper, ein Virus. Welcher Schlüssel passt?"),
      body: tx("Send one antibody after another against the viruses. Watch what happens when one fits.", "Schick einen Antikörper nach dem anderen gegen die Viren. Schau, was passiert, wenn einer passt."),
      widget: ImmuneLockKey,
    },
    { type: "check", blob: tx("Careful, there's a lookalike!", "Vorsicht, da ist ein Doppelgänger dabei!"), exercise: checkLock },
    {
      type: "widget",
      title: tx("The course of an immune response", "Ablauf einer Immunreaktion"),
      blob: tx("Teamwork! Every cell has its own job.", "Teamarbeit! Jede Zelle hat ihre eigene Aufgabe."),
      body: tx(
        "Step through a complete immune response: the macrophage, the T helper cell, the B cell with its plasma cells, the antibodies, and the T killer cell for infected cells.",
        "Geh eine komplette Immunreaktion durch: die Makrophage, die T-Helferzelle, die B-Zelle mit ihren Plasmazellen, die Antikörper und die T-Killerzelle für befallene Zellen.",
      ),
      widget: ImmuneResponse,
    },
    { type: "check", blob: tx("Who does what in the team?", "Wer macht was im Team?"), exercise: checkCells },
    {
      type: "widget",
      title: tx("First and second infection, active and passive", "Erst- und Zweitinfektion, aktiv und passiv"),
      blob: tx("Memory cells are the secret of every vaccination.", "Gedächtniszellen sind das Geheimnis jeder Impfung."),
      body: tx(
        "The first contact causes a slow **primary response**. Thanks to memory cells, the second contact causes a fast, strong **secondary response**. **Active immunisation** (vaccine) uses that; **passive immunisation** gives ready-made antibodies (serum). Compare all three.",
        "Der Erstkontakt löst eine langsame **Primärreaktion** aus. Dank der Gedächtniszellen folgt beim Zweitkontakt eine schnelle, starke **Sekundärreaktion**. Die **aktive Immunisierung** (Impfstoff) nutzt das; die **passive Immunisierung** gibt fertige Antikörper (Heilserum). Vergleich alle drei.",
      ),
      widget: TiterWidget,
    },
    { type: "check", blob: tx("The big classic among test questions!", "Der große Klassiker unter den Testfragen!"), exercise: checkClaims },
  ],
  summary: [
    {
      title: tx("Bacterium and virus", "Bakterium und Virus"),
      body: tx(
        "Bacterium: cell wall, membrane, cytoplasm, ring-shaped DNA (no nucleus), plasmids, ribosomes, often a flagellum. Virus: DNA or RNA in a capsid, often with an envelope and surface proteins; multiplies only in host cells.",
        "Bakterium: Zellwand, Zellmembran, Cytoplasma, ringförmige DNA (kein Zellkern), Plasmide, Ribosomen, oft eine Geißel. Virus: DNA oder RNA im Kapsid, oft mit Hülle und Oberflächenproteinen; vermehrt sich nur in Wirtszellen.",
      ),
      examples: [tx('"dock" \\to "enter" \\to "copy" \\to "assemble" \\to "release"', '"Andocken" \\to "Eindringen" \\to "Vermehren" \\to "Zusammenbau" \\to "Freisetzen"')],
      tone: "rule",
    },
    {
      title: tx("Non-specific defence", "Unspezifische Abwehr"),
      body: tx("Innate, immediate, against everything foreign, no memory: barriers, phagocytes (macrophages, phagocytosis), inflammation, fever.", "Angeboren, sofort, gegen alles Fremde, ohne Gedächtnis: Barrieren, Fresszellen (Makrophagen, Phagocytose), Entzündung, Fieber."),
      tone: "rule",
    },
    {
      title: tx("Antigen and antibody", "Antigen und Antikörper"),
      body: tx("Antigen: feature on the pathogen. Antibody: Y-shaped protein from plasma cells with two binding sites; fits one antigen (lock-and-key model) and clumps pathogens.", "Antigen: Merkmal auf dem Erreger. Antikörper: Y-förmiges Protein aus Plasmazellen mit zwei Bindungsstellen; passt zu einem Antigen (Schlüssel-Schloss-Prinzip) und verklumpt Erreger."),
      examples: [tx('"antigen" + "antibody" \\to "agglutination"', '"Antigen" + "Antikörper" \\to "Agglutination"')],
      tone: "rule",
    },
    {
      title: tx("The cells", "Die Zellen"),
      body: tx(
        "Macrophage presents the antigen, T helper cell activates, B cell becomes plasma cells (antibodies) and memory cells, T killer cells kill infected body cells.",
        "Makrophage präsentiert das Antigen, T-Helferzelle aktiviert, B-Zelle wird zu Plasmazellen (Antikörper) und Gedächtniszellen, T-Killerzellen töten infizierte Körperzellen.",
      ),
      examples: [tx('"macrophage" \\to "T helper" \\to "B cell" \\to "plasma cell"', '"Makrophage" \\to "T-Helfer" \\to "B-Zelle" \\to "Plasmazelle"')],
      tone: "tip",
    },
    {
      title: tx("First and second infection", "Erst- und Zweitinfektion"),
      body: tx("First: slow, weak primary response, you get ill. Second: memory cells turn quickly into plasma cells: fast, strong secondary response, you stay healthy (immune).", "Erstinfektion: langsame, schwache Primärreaktion, man wird krank. Zweitinfektion: Gedächtniszellen werden schnell zu Plasmazellen: schnelle, starke Sekundärreaktion, man bleibt gesund (immun)."),
      tone: "rule",
    },
    {
      title: tx("Active or passive?", "Aktiv oder passiv?"),
      body: tx(
        "Active: vaccine with weakened or dead pathogens, parts or mRNA; own antibodies and memory cells; after 1 to 2 weeks, lasts years. Passive: ready-made antibodies (serum); at once, only weeks, no memory. Vaccines contain no antibodies!",
        "Aktiv: Impfstoff mit abgeschwächten oder toten Erregern, Bestandteilen oder mRNA; eigene Antikörper und Gedächtniszellen; nach 1 bis 2 Wochen, hält Jahre. Passiv: fertige Antikörper (Heilserum); sofort, nur Wochen, kein Gedächtnis. Impfstoffe enthalten keine Antikörper!",
      ),
      tone: "warning",
    },
  ],
};
