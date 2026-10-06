// Level 1 practice (Klasse 5–6): cells as building blocks, plant and animal cells under the
// light microscope, using the microscope, single-celled organisms and levels of organisation.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";
import { CellAnimalCell } from "@/learn/biology/visuals/CellAnimalCell";
import { CellMicroscope } from "@/learn/biology/visuals/CellMicroscope";
import { CellParamecium } from "@/learn/biology/visuals/CellParamecium";
import { CellPlantCell } from "@/learn/biology/visuals/CellPlantCell";
import { CellSpecimenView, SPECIMENS, type Specimen } from "@/learn/biology/visuals/CellSpecimen";
import { L1_PARTS, MICROSCOPE, PARAMECIUM, type Part } from "./data";
import { cap, capT, choice, de, en, frame, join, matchMistake, mistakes, multi, orderMistake, q, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Name the structure (plant or animal cell, light microscope)

const WALL_VS_MEMBRANE: Record<string, [Text, Text]> = {
  "wall>membrane": [
    tx("Wall or membrane?", "Wand oder Membran?"),
    tx("So close! The cell membrane is the thin skin **under** the wall. The question is about the thick, firm layer right on the outside.", "Knapp! Die Zellmembran ist das dünne Häutchen **unter** der Wand. Gefragt ist die dicke, feste Schicht ganz außen."),
  ],
  "membrane>wall": [
    tx("Wall or membrane?", "Wand oder Membran?"),
    tx("The cell wall is the thick green layer on the outside. The question is about the thin line just inside it.", "Die Zellwand ist die dicke grüne Schicht außen. Gefragt ist die dünne Linie direkt darunter."),
  ],
  "vacuole>nucleus": [
    tx("Nucleus or vacuole?", "Zellkern oder Vakuole?"),
    tx("The nucleus is the smaller, purple ball. This is the big space full of cell sap.", "Der Zellkern ist die kleinere lila Kugel. Das hier ist der große Raum voller Zellsaft."),
  ],
  "nucleus>vacuole": [
    tx("Nucleus or vacuole?", "Zellkern oder Vakuole?"),
    tx("The vacuole is the big space full of cell sap. This smaller, purple ball with a dark spot controls the cell.", "Die Vakuole ist der große Raum voller Zellsaft. Diese kleinere lila Kugel mit dunklem Fleck steuert die Zelle."),
  ],
};

function nameStructureTask(rng: Rng, fixed?: { plant: boolean; id: string }): Exercise {
  const plant = fixed ? fixed.plant : rng.chance(0.72);
  const ids = plant ? Object.keys(L1_PARTS) : ["membrane", "cytoplasm", "nucleus"];
  const id = fixed ? fixed.id : rng.pick(ids);
  const P = L1_PARTS[id];
  const answer: AnswerSpec = { kind: "word", accept: P.accept, placeholder: tx("name of the structure", "Name des Bestandteils") };
  const m = mistakes(answer);
  if (!plant && id === "membrane")
    m.add({ kind: "word", accept: L1_PARTS.wall.accept }, tx("No wall in animal cells", "Tierzellen haben keine Wand"), tx("Animal cells have no cell wall at all! Their outer boundary is something thinner and softer.", "Tierzellen haben gar keine Zellwand! Ihre äußere Grenze ist etwas Dünneres und Weicheres."));
  for (const other of rng.shuffle(Object.keys(L1_PARTS).filter((o) => o !== id))) {
    const special = WALL_VS_MEMBRANE[`${id}>${other}`];
    const O = L1_PARTS[other];
    m.add(
      { kind: "word", accept: O.accept },
      special ? special[0] : tx("Look again", "Schau noch mal hin"),
      special ? special[1] : tx(`That would be ${en(O.look)}. The question mark marks ${en(P.look)}.`, `Das wäre ${de(O.look)}. Mit dem Fragezeichen ist ${de(P.look)} markiert.`),
    );
  }
  return {
    instruction: tx("Name the structure", "Benenne den Bestandteil"),
    text: plant ? tx("A plant cell under the light microscope. What is the part with the **?** called?", "Eine Pflanzenzelle unter dem Lichtmikroskop. Wie heißt der Bestandteil mit dem **?**?") : tx("An animal cell under the light microscope. What is the part with the **?** called?", "Eine Tierzelle unter dem Lichtmikroskop. Wie heißt der Bestandteil mit dem **?**?"),
    visual: plant ? visual(CellPlantCell, { mode: "numbers", ask: id, show: [id], legend: "none" }) : visual(CellAnimalCell, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("Is it on the outside or inside? Thick or thin, big or small, green or not?", "Liegt es außen oder innen? Ist es dick oder dünn, groß oder klein, grün oder nicht?"),
    solution: [frame(q(P.name, "n"), tx(`It's the **${en(P.name)}**: it ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.job)}.`), ["n"])],
    mistakes: m.list.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Plant cell, animal cell or both?

const WHERE: Text[] = [tx("Only in plant cells", "Nur in Pflanzenzellen"), tx("Only in animal cells", "Nur in Tierzellen"), tx("In both", "In beiden")];

const WHERE_SAY: Record<string, Partial<Record<number, [Text, Text]>>> = {
  wall: {
    1: [tx("The other way round", "Andersrum"), tx("A firm wall of cellulose is typical of plants. Think of a stiff lettuce leaf and your soft skin.", "Eine feste Wand aus Cellulose ist typisch für Pflanzen. Denk an ein knackiges Salatblatt und an deine weiche Haut.")],
    2: [tx("Animal cells are soft", "Tierzellen sind weich"), tx("Animal cells have no cell wall, only a thin cell membrane. That's why they are soft and can change shape.", "Tierzellen haben keine Zellwand, nur eine dünne Zellmembran. Deshalb sind sie weich und verformbar.")],
  },
  vacuole: {
    1: [tx("The other way round", "Andersrum"), tx("The big vacuole full of cell sap is typical of plant cells.", "Die große Vakuole voller Zellsaft ist typisch für Pflanzenzellen.")],
    2: [tx("Only tiny bubbles", "Nur winzige Bläschen"), tx("Animal cells have at most tiny vesicles. A big sap-filled vacuole that fills the cell is typical of plants.", "Tierzellen haben höchstens winzige Bläschen. Eine große Vakuole voller Zellsaft, die die Zelle ausfüllt, ist typisch für Pflanzen.")],
  },
  chloroplast: {
    1: [tx("The other way round", "Andersrum"), tx("Chloroplasts are green and do photosynthesis. Which living things make their own food from light?", "Chloroplasten sind grün und betreiben Fotosynthese. Welche Lebewesen stellen ihre Nahrung mit Licht selbst her?")],
    2: [tx("Animals have to eat", "Tiere müssen fressen"), tx("Animals can't do photosynthesis: they have no chloroplasts and have to eat food instead.", "Tiere können keine Fotosynthese betreiben: Sie haben keine Chloroplasten und müssen Nahrung fressen.")],
  },
  membrane: {
    0: [tx("Every cell needs a boundary", "Jede Zelle braucht eine Grenze"), tx("Animal cells have a cell membrane too. In them it is even the outermost layer.", "Auch Tierzellen haben eine Zellmembran. Bei ihnen ist sie sogar die äußerste Schicht.")],
    1: [tx("Plant cells have one too", "Pflanzenzellen haben auch eine"), tx("Plant cells have a cell membrane as well: it lies right under the cell wall.", "Pflanzenzellen haben auch eine Zellmembran: Sie liegt direkt unter der Zellwand.")],
  },
  nucleus: {
    0: [tx("Both have one", "Beide haben einen"), tx("Animal cells need a control centre too. Look at a cheek cell: there's a nucleus in the middle.", "Auch Tierzellen brauchen eine Steuerzentrale. Schau dir eine Mundschleimhautzelle an: In der Mitte liegt ein Zellkern.")],
    1: [tx("Both have one", "Beide haben einen"), tx("Plant cells need a control centre too. In onion skin you can see a nucleus in every cell.", "Auch Pflanzenzellen brauchen eine Steuerzentrale. In der Zwiebelhaut siehst du in jeder Zelle einen Zellkern.")],
  },
  cytoplasm: {
    0: [tx("Every cell is filled", "Jede Zelle ist gefüllt"), tx("Every cell is filled with cytoplasm, animal cells too.", "Jede Zelle ist mit Zellplasma gefüllt, auch Tierzellen.")],
    1: [tx("Every cell is filled", "Jede Zelle ist gefüllt"), tx("Every cell is filled with cytoplasm, plant cells too.", "Jede Zelle ist mit Zellplasma gefüllt, auch Pflanzenzellen.")],
  },
};

function whereTask(rng: Rng): Exercise {
  const id = rng.pick(["wall", "vacuole", "chloroplast", "wall", "chloroplast", "membrane", "nucleus", "cytoplasm"]);
  const P = L1_PARTS[id];
  const right = P.animal ? 2 : 0;
  const opts: Opt[] = [{ text: WHERE[right] }];
  for (const w of [0, 1, 2]) {
    if (w === right) continue;
    const s = WHERE_SAY[id][w];
    opts.push({ text: WHERE[w], title: s?.[0], say: s?.[1] });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  const name = id === "vacuole" ? tx("a large vacuole", "eine große Vakuole") : id === "chloroplast" ? tx("chloroplasts", "Chloroplasten") : P.name;
  return {
    instruction: tx("Plant cell or animal cell?", "Pflanzenzelle oder Tierzelle?"),
    text: tx(`Where do you find this part: **${en(name)}**?`, `Wo findest du diesen Bestandteil: **${de(name)}**?`),
    answer,
    hint: tx("Only three parts make the plant cell special: the firm wall, the big vacuole and the green chloroplasts.", "Nur drei Teile machen die Pflanzenzelle besonders: die feste Wand, die große Vakuole und die grünen Chloroplasten."),
    solution: [
      frame(join(q(tx("plant cell", "Pflanzenzelle"), "p"), "=", q(tx("animal cell", "Tierzelle"), "t"), "+", q(tx("wall, vacuole, chloroplasts", "Wand, Vakuole, Chloroplasten"), "x")), tx("Both have a membrane, cytoplasm and a nucleus. Only plant cells also have a cell wall, a big vacuole and chloroplasts.", "Beide haben Zellmembran, Zellplasma und Zellkern. Nur Pflanzenzellen haben zusätzlich Zellwand, große Vakuole und Chloroplasten.")),
      frame(join(q(P.name, "n"), "\\Rightarrow", q(WHERE[right], "a")), P.animal ? tx(`The ${en(P.name)} is in **both** cells.`, `${de(P.name)}: in **beiden** Zellen.`) : tx(`The ${en(P.name)}: **only in plant cells**.`, `${de(P.name)}: **nur in Pflanzenzellen**.`), ["a"]),
    ],
    mistakes: list,
  };
}

/** "Which of these does only the plant cell have?" */
function onlyPlantTask(rng: Rng): Exercise {
  const id = rng.pick(["wall", "vacuole", "chloroplast"]);
  const P = L1_PARTS[id];
  const opts: Opt[] = [{ text: capT(P.name) }];
  for (const o of ["membrane", "nucleus", "cytoplasm"]) {
    const O = L1_PARTS[o];
    opts.push({ text: capT(O.name), title: tx("Animal cells have it too", "Haben Tierzellen auch"), say: tx(`Animal cells have a ${en(O.name)} as well. Look for something that only plants need.`, `Auch Tierzellen haben ${o === "cytoplasm" ? "Zellplasma" : o === "nucleus" ? "einen Zellkern" : "eine Zellmembran"}. Such etwas, das nur Pflanzen brauchen.`) });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Only in plant cells", "Nur in Pflanzenzellen"),
    text: tx("Which of these parts does **only the plant cell** have?", "Welchen dieser Bestandteile hat **nur die Pflanzenzelle**?"),
    answer,
    hint: tx("Three parts are missing in animal cells: something firm, something big and full of sap, and something green.", "Drei Teile fehlen Tierzellen: etwas Festes, etwas Großes voller Saft und etwas Grünes."),
    solution: [frame(join(q(P.name, "n"), "\\Rightarrow", q(tx("only plant cells", "nur Pflanzenzellen"), "a")), tx(`The ${en(P.name)} ${en(P.job)}. Animal cells don't have one.`, `${de(P.name)}: ${de(P.job)}. Tierzellen haben das nicht.`), ["n"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Structures and their jobs

function jobMatchTask(rng: Rng): Exercise {
  const ids = rng.shuffle(Object.keys(L1_PARTS));
  const used = ids.slice(0, rng.int(3, 4));
  const extra = ids[used.length];
  const pairs = used.map((id) => [capT(L1_PARTS[id].name), L1_PARTS[id].job] as [Text, Text]);
  const answer: AnswerSpec = { kind: "match", pairs, distractors: [L1_PARTS[extra].job] };
  const list: Mistake[] = [];
  const has = (id: string) => used.includes(id);
  const nm = (id: string) => capT(L1_PARTS[id].name);
  const jobOf = (id: string) => L1_PARTS[id].job;
  if (has("membrane") && (has("wall") || extra === "wall"))
    list.push(matchMistake([[nm("membrane"), jobOf("wall")]], tx("Wall or membrane?", "Wand oder Membran?"), tx("The firm shape comes from the thick wall on the outside, not from the thin membrane. The membrane is more like a gatekeeper.", "Die feste Form kommt von der dicken Wand außen, nicht von der dünnen Membran. Die Membran ist eher ein Türsteher.")));
  if (has("wall") && (has("membrane") || extra === "membrane"))
    list.push(matchMistake([[nm("wall"), jobOf("membrane")]], tx("Wall or membrane?", "Wand oder Membran?"), tx("The wall lets almost everything through. Deciding what gets in is the job of the thin membrane underneath.", "Die Wand lässt fast alles durch. Was hineindarf, entscheidet die dünne Membran darunter.")));
  if (has("nucleus") && (has("chloroplast") || extra === "chloroplast"))
    list.push(matchMistake([[nm("nucleus"), jobOf("chloroplast")]], tx("Control centre", "Steuerzentrale"), tx("The nucleus doesn't make sugar: it is the control centre with the genetic information. The green parts make the sugar.", "Der Zellkern macht keinen Zucker: Er ist die Steuerzentrale mit der Erbinformation. Den Zucker machen die grünen Teile.")));
  if (has("vacuole") && (has("cytoplasm") || extra === "cytoplasm"))
    list.push(matchMistake([[nm("vacuole"), jobOf("cytoplasm")]], tx("Store, not workshop", "Speicher, nicht Werkstatt"), tx("The vacuole is a store full of cell sap. The chemistry of life happens in the jelly around it.", "Die Vakuole ist ein Speicher voller Zellsaft. Die Stoffwechselvorgänge laufen in der Grundsubstanz drumherum ab.")));
  if (has("cytoplasm") && (has("vacuole") || extra === "vacuole"))
    list.push(matchMistake([[nm("cytoplasm"), jobOf("vacuole")]], tx("Store, not workshop", "Speicher, nicht Werkstatt"), tx("Cell sap is stored in the big vacuole. The cytoplasm is the filling where the work is done.", "Zellsaft wird in der großen Vakuole gespeichert. Das Zellplasma ist die Füllung, in der gearbeitet wird.")));
  return {
    instruction: tx("Match each part to its job", "Ordne jedem Bestandteil seine Aufgabe zu"),
    text: tx("What does each part of the cell do? One job is left over.", "Was leistet welcher Zellbestandteil? Eine Aufgabe bleibt übrig."),
    answer,
    hint: tx("The nucleus controls, the membrane checks, the wall gives strength, the vacuole stores, the chloroplasts make sugar.", "Der Kern steuert, die Membran kontrolliert, die Wand gibt Halt, die Vakuole speichert, die Chloroplasten machen Zucker."),
    solution: used.map((id, i) => frame(join(q(L1_PARTS[id].name, `a${i}`), "\\to", q(L1_PARTS[id].job, `b${i}`)), tx(`The ${en(L1_PARTS[id].name)} ${en(L1_PARTS[id].job)}.`, `${de(L1_PARTS[id].name)}: ${de(L1_PARTS[id].job)}.`))),
    mistakes: list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// The microscope

const SCOPE_CONFUSE: Record<string, string[]> = {
  eyepiece: ["objective", "tube", "nosepiece"],
  objective: ["eyepiece", "nosepiece", "diaphragm"],
  nosepiece: ["objective", "stage", "tube"],
  tube: ["eyepiece", "arm", "objective"],
  stage: ["slide", "diaphragm", "nosepiece"],
  diaphragm: ["light", "stage", "fine"],
  light: ["diaphragm", "stage", "eyepiece"],
  coarse: ["fine", "diaphragm", "nosepiece"],
  fine: ["coarse", "diaphragm", "light"],
  arm: ["tube", "stage", "coarse"],
};

const SCOPE_SPECIAL: Record<string, [Text, Text]> = {
  "eyepiece>objective": [tx("Eye or object?", "Auge oder Objekt?"), tx("Little memory trick: the **ocular** (Latin oculus, eye) is where your eye goes. The **objective** is near the object.", "Merktrick: Das **Okular** (lateinisch oculus, Auge) ist dort, wo dein Auge hinkommt. Das **Objektiv** ist nah am Objekt.")],
  "objective>eyepiece": [tx("Eye or object?", "Auge oder Objekt?"), tx("Little memory trick: the **objective** sits near the object, the **ocular** (Latin oculus, eye) is where your eye goes.", "Merktrick: Das **Objektiv** sitzt nah am Objekt, das **Okular** (lateinisch oculus, Auge) ist dort, wo dein Auge hinkommt.")],
  "coarse>fine": [tx("Big knob, small knob", "Großes Rad, kleines Rad"), tx("The fine focus is the small knob. The big one moves the stage a lot: for rough focusing.", "Der Feintrieb ist das kleine Rad. Das große bewegt den Tisch stark: zum groben Scharfstellen.")],
  "fine>coarse": [tx("Big knob, small knob", "Großes Rad, kleines Rad"), tx("The coarse focus is the big knob. The small one moves the stage only a tiny bit: for the last sharp touch.", "Der Grobtrieb ist das große Rad. Das kleine bewegt den Tisch nur ein winziges Stück: für das letzte Scharfstellen.")],
  "diaphragm>light": [tx("Lamp or diaphragm?", "Lampe oder Blende?"), tx("The light source is the lamp in the base. This part above it only lets more or less of that light through.", "Die Lichtquelle ist die Lampe im Fuß. Dieses Teil darüber lässt nur mehr oder weniger von dem Licht durch.")],
  "light>diaphragm": [tx("Lamp or diaphragm?", "Lampe oder Blende?"), tx("The diaphragm is the part with the little lever under the stage. Down here in the base is where the light comes from.", "Die Blende ist das Teil mit dem kleinen Hebel unter dem Tisch. Hier unten im Fuß entsteht das Licht.")],
  "stage>slide": [tx("Table and plate", "Tisch und Plättchen"), tx("The slide is the glass plate. The question is about the table it lies on.", "Der Objektträger ist das Glasplättchen. Gefragt ist der Tisch, auf dem es liegt.")],
};

function scopeSay(asked: Part, picked: Part): [Text, Text] {
  return SCOPE_SPECIAL[`${asked.id}>${picked.id}`] ?? [tx("Another part", "Ein anderes Teil"), tx(`The ${en(picked.name)} is ${en(picked.look)}. The question mark marks ${en(asked.look)}.`, `${de(picked.name)}: ${de(picked.look)}. Mit dem Fragezeichen ist ${de(asked.look)} markiert.`)];
}

function scopePartTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(SCOPE_CONFUSE));
  const P = MICROSCOPE[id];
  const opts: Opt[] = [{ text: capT(P.name) }];
  for (const w of SCOPE_CONFUSE[id]) {
    const [title, say] = scopeSay(P, MICROSCOPE[w]);
    opts.push({ text: capT(MICROSCOPE[w].name), title, say });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Parts of the microscope", "Teile des Mikroskops"),
    text: tx("What is the part with the **?** called?", "Wie heißt das Teil mit dem **?**?"),
    visual: visual(CellMicroscope, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("Follow the light: lamp, diaphragm, specimen, objective, tube, eyepiece. The knobs move the stage.", "Folge dem Licht: Lampe, Blende, Präparat, Objektiv, Tubus, Okular. Die Drehknöpfe bewegen den Tisch."),
    solution: [frame(q(P.name, "n"), tx(`That's the **${en(P.name)}**: ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.job)}.`), ["n"])],
    mistakes: list,
  };
}

function scopeJobTask(rng: Rng): Exercise {
  const pool = ["eyepiece", "objective", "stage", "diaphragm", "light", "coarse", "fine", "nosepiece"];
  const ids = rng.shuffle(pool);
  // keep the classic pairs together now and then, so the classic swaps can happen
  const used = rng.chance(0.5) ? rng.shuffle(["coarse", "fine", ...ids.filter((x) => x !== "coarse" && x !== "fine").slice(0, 2)]) : ids.slice(0, 4);
  const pairs = used.map((id) => [capT(MICROSCOPE[id].name), MICROSCOPE[id].job] as [Text, Text]);
  const answer: AnswerSpec = { kind: "match", pairs };
  const list: Mistake[] = [];
  const nm = (id: string) => capT(MICROSCOPE[id].name);
  const both = (a: string, b: string) => used.includes(a) && used.includes(b);
  if (both("coarse", "fine")) list.push(matchMistake([[nm("coarse"), MICROSCOPE.fine.job], [nm("fine"), MICROSCOPE.coarse.job]], tx("Coarse and fine swapped", "Grob und fein vertauscht"), tx("The names give it away: **coarse** focus for the big moves, **fine** focus for the last tiny turn.", "Die Namen verraten es: **Grob**trieb für die großen Bewegungen, **Fein**trieb für das letzte bisschen.")));
  if (both("eyepiece", "objective")) list.push(matchMistake([[nm("eyepiece"), MICROSCOPE.objective.job], [nm("objective"), MICROSCOPE.eyepiece.job]], tx("Eye or object?", "Auge oder Objekt?"), tx("Memory trick: ocular, from Latin oculus (eye), is where you look in. The objective is near the object.", "Merktrick: Okular, von lateinisch oculus (Auge), ist da, wo du hineinschaust. Das Objektiv ist nah am Objekt.")));
  if (both("diaphragm", "light")) list.push(matchMistake([[nm("diaphragm"), MICROSCOPE.light.job]], tx("Lamp or diaphragm?", "Lampe oder Blende?"), tx("The diaphragm doesn't make light: it only lets more or less of it through.", "Die Blende macht kein Licht: Sie lässt nur mehr oder weniger davon durch.")));
  return {
    instruction: tx("Match each part to its job", "Ordne jedem Teil seine Aufgabe zu"),
    text: tx("Parts of the light microscope: what does each one do?", "Teile des Lichtmikroskops: Was macht welches Teil?"),
    answer,
    hint: tx("Think of the way the light takes, and which knob makes big and which small moves.", "Denk an den Weg des Lichts und daran, welcher Knopf große und welcher kleine Bewegungen macht."),
    solution: used.map((id, i) => frame(join(q(MICROSCOPE[id].name, `a${i}`), "\\to", q(MICROSCOPE[id].job, `b${i}`)), tx(`${cap(en(MICROSCOPE[id].name))}: ${en(MICROSCOPE[id].job)}.`, `${de(MICROSCOPE[id].name)}: ${de(MICROSCOPE[id].job)}.`))),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Put in order: levels of organisation, making a slide, using the microscope

type Chain = { items: Text[] };
const LEVELS: Text[] = [tx("cell", "Zelle"), tx("tissue", "Gewebe"), tx("organ", "Organ"), tx("organ system", "Organsystem"), tx("organism", "Organismus")];
const CHAINS: Chain[] = [
  { items: [tx("heart muscle cell", "Herzmuskelzelle"), tx("heart muscle tissue", "Herzmuskelgewebe"), tx("heart", "Herz"), tx("circulatory system", "Herz-Kreislauf-System"), tx("human", "Mensch")] },
  { items: [tx("nerve cell", "Nervenzelle"), tx("nerve tissue", "Nervengewebe"), tx("brain", "Gehirn"), tx("nervous system", "Nervensystem"), tx("human", "Mensch")] },
  { items: [tx("bone cell", "Knochenzelle"), tx("bone tissue", "Knochengewebe"), tx("thigh bone", "Oberschenkelknochen"), tx("skeleton", "Skelett"), tx("human", "Mensch")] },
  { items: [tx("muscle cell", "Muskelzelle"), tx("muscle tissue", "Muskelgewebe"), tx("stomach", "Magen"), tx("digestive system", "Verdauungssystem"), tx("human", "Mensch")] },
  { items: [tx("palisade cell", "Palisadenzelle"), tx("palisade tissue", "Palisadengewebe"), tx("leaf", "Laubblatt"), tx("sunflower", "Sonnenblume")] },
];

/** "A → B → C \\ → D → E" with keys by position, so example and level frames morph into each other. */
function chainMath(xs: Text[]): Text {
  const line = (l: "en" | "de") =>
    xs
      .map((t, i) => `${i === 3 ? "\\\\ " : ""}${i ? "\\to " : ""}"${l === "en" ? cap(en(t)) : de(t)}"#s${i}`)
      .join(" ");
  return tx(line("en"), line("de"));
}

function levelsTask(rng: Rng, fixed?: { chain: number; down: boolean }): Exercise {
  const abstract = fixed ? false : rng.chance(0.35);
  const full = abstract ? LEVELS : fixed ? CHAINS[fixed.chain].items : rng.pick(CHAINS).items;
  // the abstract chain sometimes without one level, so it isn't always the same task
  const drop = abstract && rng.chance(0.5) ? rng.int(1, 3) : -1;
  const items = full.filter((_, i) => i !== drop);
  const down = fixed ? fixed.down : rng.chance(0.3);
  const shown = down ? [...items].reverse() : items;
  const levelOf = (t: Text) => (full.length === 4 ? [LEVELS[0], LEVELS[1], LEVELS[2], LEVELS[4]] : LEVELS)[full.indexOf(t)] ?? t;
  const list: Mistake[] = [];
  list.push(orderMistake([...shown].reverse(), tx("Wrong direction", "Falsche Richtung"), down ? tx("You sorted from small to large. The task asks for the other direction: start with the biggest.", "Du hast von klein nach groß sortiert. Gefragt ist die andere Richtung: Fang mit dem Größten an.") : tx("You sorted from large to small. The task asks for the other direction: start with the smallest.", "Du hast von groß nach klein sortiert. Gefragt ist die andere Richtung: Fang mit dem Kleinsten an.")));
  const idx = (k: number) => (k < full.length ? full[k] : null);
  const tissue = idx(1);
  const organ = idx(2);
  const system = full.length === 5 ? idx(3) : null;
  const inItems = (t: Text | null): t is Text => !!t && items.includes(t);
  if (inItems(tissue) && inItems(organ))
    list.push(orderMistake(down ? [tissue, organ] : [organ, tissue], tx("Tissue before organ", "Gewebe vor Organ"), tx("Many similar cells form a tissue first. Only several tissues together make up an organ.", "Erst bilden viele gleichartige Zellen ein Gewebe. Erst mehrere Gewebe zusammen ergeben ein Organ.")));
  if (inItems(organ) && inItems(system))
    list.push(orderMistake(down ? [organ, system] : [system, organ], tx("Organ before organ system", "Organ vor Organsystem"), tx("An organ system is a team of several organs, so it's the bigger one.", "Ein Organsystem ist ein Team aus mehreren Organen, also das Größere.")));
  return {
    instruction: tx("Order the levels", "Ordne die Ebenen"),
    text: abstract
      ? down
        ? tx("Sort the levels of organisation from the **largest** to the **smallest**.", "Ordne die Organisationsebenen vom **Größten** zum **Kleinsten**.")
        : tx("Sort the levels of organisation from the **smallest** to the **largest**.", "Ordne die Organisationsebenen vom **Kleinsten** zum **Größten**.")
      : down
        ? tx(`Sort from the **largest** to the **smallest** level.`, `Ordne von der **größten** zur **kleinsten** Ebene.`)
        : tx(`Sort from the **smallest** to the **largest** level.`, `Ordne von der **kleinsten** zur **größten** Ebene.`),
    answer: { kind: "order", items: shown.map(capT) },
    hint: tx("Cell, then tissue (many similar cells), then organ (several tissues), then organ system, then the whole organism.", "Zelle, dann Gewebe (viele gleiche Zellen), dann Organ (mehrere Gewebe), dann Organsystem, dann der ganze Organismus."),
    solution: [
      frame(chainMath(shown), tx("Each level is made of the one below it.", "Jede Ebene besteht aus der darunterliegenden.")),
      ...(abstract ? [] : [frame(chainMath(shown.map(levelOf)), tx("These are the levels behind the example.", "Das sind die Ebenen hinter dem Beispiel."))]),
    ],
    mistakes: list.map((x) => (x.when.kind === "order" ? { ...x, when: { ...x.when, items: x.when.items.map(capT) } } : x)),
  };
}

type Procedure = { title: Text; text: Text; steps: Text[]; mist: { items: number[]; title: Text; say: Text }[] };
const PROCEDURES: Procedure[] = [
  {
    title: tx("Making a slide", "Ein Präparat herstellen"),
    text: tx("You want to look at onion skin. Put the steps in order.", "Du willst Zwiebelhaut mikroskopieren. Bring die Schritte in die richtige Reihenfolge."),
    steps: [
      tx("Put a drop of water on the slide", "Einen Wassertropfen auf den Objektträger geben"),
      tx("Lay a thin piece of onion skin flat in the drop", "Ein dünnes Stück Zwiebelhaut glatt in den Tropfen legen"),
      tx("Lower the cover slip at an angle", "Das Deckgläschen schräg ansetzen und absenken"),
      tx("Look at it with the smallest objective first", "Mit dem kleinsten Objektiv mikroskopieren"),
    ],
    mist: [
      { items: [2, 1], title: tx("Cover slip comes last", "Deckgläschen zum Schluss"), say: tx("The cover slip goes on top of the specimen. First the skin has to be in the water drop.", "Das Deckgläschen kommt auf das Präparat. Erst muss das Häutchen im Wassertropfen liegen.") },
      { items: [1, 0], title: tx("Water first", "Erst das Wasser"), say: tx("The thin skin dries out and curls up quickly. That's why the water drop is waiting for it on the slide already.", "Das dünne Häutchen trocknet schnell aus und rollt sich ein. Deshalb wartet der Wassertropfen schon auf dem Objektträger.") },
    ],
  },
  {
    title: tx("Making a slide", "Ein Präparat herstellen"),
    text: tx("You want to look at cells from the inside of your cheek. Put the steps in order.", "Du willst Zellen deiner Mundschleimhaut mikroskopieren. Bring die Schritte in die richtige Reihenfolge."),
    steps: [
      tx("Gently scrape the inside of your cheek with a clean spatula", "Mit einem sauberen Spatel vorsichtig innen über die Wange streichen"),
      tx("Spread the scrapings in a drop of water on the slide", "Den Abstrich in einem Wassertropfen auf dem Objektträger verteilen"),
      tx("Lower the cover slip at an angle", "Das Deckgläschen schräg ansetzen und absenken"),
      tx("Stain with methylene blue", "Mit Methylenblau anfärben"),
    ],
    mist: [
      { items: [2, 1], title: tx("Cover slip comes later", "Deckgläschen kommt später"), say: tx("The cover slip goes on top of the specimen, so the cells must be on the slide first.", "Das Deckgläschen kommt auf das Präparat, also müssen die Zellen zuerst auf dem Objektträger sein.") },
      { items: [3, 2], title: tx("Stain under the cover slip", "Unter dem Deckgläschen färben"), say: tx("The dye is dropped at the edge of the cover slip and drawn underneath with filter paper. So the cover slip has to be on already.", "Der Farbstoff wird an den Rand des Deckgläschens getropft und mit Filterpapier darunter gezogen. Das Deckgläschen muss also schon liegen.") },
    ],
  },
  {
    title: tx("Staining", "Anfärben"),
    text: tx("The nuclei in your onion skin are hard to see. Put the staining steps in order.", "Die Zellkerne in deiner Zwiebelhaut sind schwer zu sehen. Bring die Schritte zum Anfärben in die richtige Reihenfolge."),
    steps: [
      tx("Make the slide and put on the cover slip", "Präparat herstellen und Deckgläschen auflegen"),
      tx("Put a drop of iodine solution at one edge of the cover slip", "Einen Tropfen Iod-Kaliumiodid-Lösung an einen Rand des Deckgläschens geben"),
      tx("Hold filter paper to the opposite edge", "Filterpapier an den gegenüberliegenden Rand halten"),
      tx("Look again: the nuclei are now clearly visible", "Neu mikroskopieren: Die Zellkerne sind jetzt gut zu sehen"),
    ],
    mist: [
      { items: [2, 1], title: tx("Dye first, then pull", "Erst Farbe, dann ziehen"), say: tx("The filter paper sucks the liquid through under the cover slip. It can only pull the dye through once the dye is there.", "Das Filterpapier saugt die Flüssigkeit unter dem Deckgläschen durch. Den Farbstoff kann es erst durchziehen, wenn er da ist.") },
    ],
  },
  {
    title: tx("Using the microscope", "Mikroskopieren"),
    text: tx("Put the steps for using a microscope in order.", "Bring die Schritte beim Mikroskopieren in die richtige Reihenfolge."),
    steps: [
      tx("Swing in the smallest objective", "Das kleinste Objektiv einschwenken"),
      tx("Focus roughly with the coarse focus knob", "Mit dem Grobtrieb grob scharf stellen"),
      tx("Make it sharp with the fine focus knob", "Mit dem Feintrieb nachschärfen"),
      tx("Swing in a bigger objective and only use the fine focus", "Größeres Objektiv einschwenken und nur noch den Feintrieb benutzen"),
    ],
    mist: [
      { items: [2, 1], title: tx("Coarse before fine", "Erst grob, dann fein"), say: tx("With the fine focus alone it would take ages to find the image. First get close with the big knob, then fine-tune.", "Nur mit dem Feintrieb würdest du ewig suchen. Erst mit dem großen Rad in die Nähe, dann fein nachstellen.") },
      { items: [3, 0], title: tx("Start small", "Klein anfangen"), say: tx("Always start with the smallest objective: you see a big area, find the specimen easily, and the lens is far away from the slide.", "Fang immer mit dem kleinsten Objektiv an: Du siehst einen großen Ausschnitt, findest das Präparat leicht, und die Linse ist weit vom Objektträger weg.") },
    ],
  },
  {
    title: tx("Using the microscope", "Mikroskopieren"),
    text: tx("You start microscoping. Put the steps in order.", "Du beginnst zu mikroskopieren. Bring die Schritte in die richtige Reihenfolge."),
    steps: [
      tx("Put the slide on the stage and clip it in place", "Den Objektträger auf den Objekttisch legen und festklemmen"),
      tx("Focus roughly with the coarse focus knob", "Mit dem Grobtrieb grob scharf stellen"),
      tx("Make it sharp with the fine focus knob", "Mit dem Feintrieb nachschärfen"),
      tx("Swing in the next bigger objective", "Das nächstgrößere Objektiv einschwenken"),
      tx("Refocus only with the fine focus knob", "Nur mit dem Feintrieb nachstellen"),
    ],
    mist: [
      { items: [2, 1], title: tx("Coarse before fine", "Erst grob, dann fein"), say: tx("First get close with the big knob, then fine-tune with the small one.", "Erst mit dem großen Rad in die Nähe, dann mit dem kleinen fein nachstellen.") },
      { items: [3, 1], title: tx("Start small", "Klein anfangen"), say: tx("Focus with the small objective first. With a big objective the lens is very close to the slide.", "Stell zuerst mit dem kleinen Objektiv scharf. Beim großen Objektiv ist die Linse ganz nah am Objektträger.") },
    ],
  },
];

function procedureTask(rng: Rng, fixed?: number): Exercise {
  const P = fixed !== undefined ? PROCEDURES[fixed] : rng.pick(PROCEDURES);
  return {
    instruction: P.title,
    text: P.text,
    answer: { kind: "order", items: P.steps },
    hint: tx("Go through it in your head, as if you were doing it at the lab bench.", "Geh es im Kopf durch, als würdest du es gerade am Labortisch machen."),
    solution: P.steps.map((s, i) => frame(P.steps.slice(0, i + 1).map((_, j) => `"${j + 1}."#n${j}`).join(" \\to "), s, [`n${i}`])),
    mistakes: P.mist.map((m) => orderMistake(m.items.map((i) => P.steps[i]), m.title, m.say)),
  };
}

// ---------------------------------------------------------------------------
// Living or not?

type AliveCase = { thing: Text; alive: boolean; opts: Opt[] };
const ALIVE: AliveCase[] = [
  {
    thing: tx("a candle flame", "eine Kerzenflamme"),
    alive: false,
    opts: [
      { text: tx("No: it isn't made of cells and can't reproduce", "Nein: Sie besteht nicht aus Zellen und kann sich nicht fortpflanzen") },
      { text: tx("Yes: it grows and uses up oxygen", "Ja: Sie wächst und verbraucht Sauerstoff"), title: tx("Not all the characteristics", "Nicht alle Kennzeichen"), say: tx("Growing and using oxygen aren't enough. A living thing shows all the characteristics, and above all it is made of cells.", "Wachsen und Sauerstoff verbrauchen reichen nicht. Ein Lebewesen zeigt alle Kennzeichen, und vor allem besteht es aus Zellen.") },
      { text: tx("Yes: it moves", "Ja: Sie bewegt sich"), title: tx("Moving isn't enough", "Bewegung reicht nicht"), say: tx("A flickering flame moves, a river too. Neither is made of cells or reproduces.", "Eine flackernde Flamme bewegt sich, ein Fluss auch. Beide bestehen nicht aus Zellen und pflanzen sich nicht fort.") },
      { text: tx("No: it is too hot", "Nein: Sie ist zu heiß"), title: tx("Not the reason", "Nicht der Grund"), say: tx("Heat isn't the point: there are bacteria that live in hot springs. Check the characteristics of living things.", "An der Hitze liegt es nicht: Es gibt Bakterien, die in heißen Quellen leben. Prüf die Kennzeichen des Lebendigen.") },
    ],
  },
  {
    thing: tx("a dry bean seed", "ein trockener Bohnensamen"),
    alive: true,
    opts: [
      { text: tx("Yes: it is made of living cells and can germinate and grow", "Ja: Er besteht aus lebenden Zellen und kann keimen und wachsen") },
      { text: tx("No: it doesn't move", "Nein: Er bewegt sich nicht"), title: tx("Resting, not dead", "Ruhend, nicht tot"), say: tx("The seed is resting: its metabolism runs very slowly. Give it water and warmth and it germinates. It is made of living cells.", "Der Samen ruht: Sein Stoffwechsel läuft ganz langsam. Mit Wasser und Wärme keimt er. Er besteht aus lebenden Zellen.") },
      { text: tx("No: it doesn't eat anything", "Nein: Er frisst nichts"), title: tx("Resting, not dead", "Ruhend, nicht tot"), say: tx("Plants don't eat anyway, and a seed carries its own stored food. It is made of living cells and can grow.", "Pflanzen fressen ohnehin nicht, und ein Samen trägt seinen Vorrat in sich. Er besteht aus lebenden Zellen und kann wachsen.") },
      { text: tx("Yes: it is hard", "Ja: Er ist hart"), title: tx("Not the reason", "Nicht der Grund"), say: tx("Stones are hard too. The reason is the cells and what they can do.", "Steine sind auch hart. Der Grund sind die Zellen und was sie können.") },
    ],
  },
  {
    thing: tx("a car", "ein Auto"),
    alive: false,
    opts: [
      { text: tx("No: it isn't made of cells, doesn't grow and can't reproduce", "Nein: Es besteht nicht aus Zellen, wächst nicht und pflanzt sich nicht fort") },
      { text: tx("Yes: it moves and uses fuel", "Ja: Es bewegt sich und verbraucht Treibstoff"), title: tx("Not all the characteristics", "Nicht alle Kennzeichen"), say: tx("Moving and using fuel look a bit like movement and metabolism. But a car isn't made of cells, doesn't grow and can't reproduce.", "Bewegung und Treibstoff erinnern an Bewegung und Stoffwechsel. Aber ein Auto besteht nicht aus Zellen, wächst nicht und pflanzt sich nicht fort.") },
      { text: tx("Yes: it reacts when you press the brake", "Ja: Es reagiert, wenn man bremst"), title: tx("Not all the characteristics", "Nicht alle Kennzeichen"), say: tx("A machine that reacts isn't alive yet. Living things show all the characteristics and are made of cells.", "Eine Maschine, die reagiert, lebt noch lange nicht. Lebewesen zeigen alle Kennzeichen und bestehen aus Zellen.") },
      { text: tx("No: it is made of metal", "Nein: Es ist aus Metall"), title: tx("Not the reason", "Nicht der Grund"), say: tx("The material alone doesn't decide it. Check the characteristics of living things.", "Das Material allein entscheidet nicht. Prüf die Kennzeichen des Lebendigen.") },
    ],
  },
  {
    thing: tx("a yeast cell in dough", "eine Hefezelle im Teig"),
    alive: true,
    opts: [
      { text: tx("Yes: it is a single cell that feeds, grows and multiplies", "Ja: Sie ist eine einzelne Zelle, die sich ernährt, wächst und vermehrt") },
      { text: tx("No: a single cell is too small to be alive", "Nein: Eine einzelne Zelle ist zu klein, um zu leben"), title: tx("One cell is enough", "Eine Zelle reicht"), say: tx("A single cell can be a complete living thing: a single-celled organism. Yeast makes dough rise because it is alive.", "Eine einzelne Zelle kann ein vollständiges Lebewesen sein: ein Einzeller. Hefe lässt den Teig gehen, weil sie lebt.") },
      { text: tx("No: it can't move", "Nein: Sie kann sich nicht bewegen"), title: tx("Moving isn't everything", "Bewegung ist nicht alles"), say: tx("Plants hardly move either and are alive. Yeast feeds, grows and multiplies.", "Pflanzen bewegen sich auch kaum und leben. Hefe ernährt sich, wächst und vermehrt sich.") },
      { text: tx("Yes: it smells", "Ja: Sie riecht"), title: tx("Not the reason", "Nicht der Grund"), say: tx("Lots of things smell. What counts are the characteristics of living things.", "Vieles riecht. Entscheidend sind die Kennzeichen des Lebendigen.") },
    ],
  },
  {
    thing: tx("a salt crystal growing in salt water", "ein Salzkristall, der in Salzwasser wächst"),
    alive: false,
    opts: [
      { text: tx("No: it isn't made of cells and has no metabolism", "Nein: Er besteht nicht aus Zellen und hat keinen Stoffwechsel") },
      { text: tx("Yes: it grows", "Ja: Er wächst"), title: tx("Growing alone isn't enough", "Wachsen allein reicht nicht"), say: tx("Crystals grow by adding particles from outside. But they aren't made of cells, have no metabolism and don't react to stimuli.", "Kristalle wachsen, indem sich Teilchen außen anlagern. Sie bestehen aber nicht aus Zellen, haben keinen Stoffwechsel und reagieren nicht auf Reize.") },
      { text: tx("Yes: new crystals form next to it", "Ja: Neben ihm entstehen neue Kristalle"), title: tx("Not reproduction", "Keine Fortpflanzung"), say: tx("New crystals form on their own from the solution. That isn't reproduction: no cells pass anything on.", "Neue Kristalle entstehen von selbst aus der Lösung. Das ist keine Fortpflanzung: Es geben keine Zellen etwas weiter.") },
      { text: tx("No: it is see-through", "Nein: Er ist durchsichtig"), title: tx("Not the reason", "Nicht der Grund"), say: tx("Some living things are almost see-through too, like jellyfish. Check the characteristics.", "Manche Lebewesen sind auch fast durchsichtig, zum Beispiel Quallen. Prüf die Kennzeichen.") },
    ],
  },
  {
    thing: tx("a robot vacuum cleaner", "ein Saugroboter"),
    alive: false,
    opts: [
      { text: tx("No: it isn't made of cells, doesn't grow and can't reproduce", "Nein: Er besteht nicht aus Zellen, wächst nicht und pflanzt sich nicht fort") },
      { text: tx("Yes: it moves and reacts to obstacles", "Ja: Er bewegt sich und reagiert auf Hindernisse"), title: tx("Not all the characteristics", "Nicht alle Kennzeichen"), say: tx("Movement and reacting are only two of the characteristics. A robot isn't made of cells, doesn't grow and has no offspring.", "Bewegung und Reizbarkeit sind nur zwei der Kennzeichen. Ein Roboter besteht nicht aus Zellen, wächst nicht und hat keine Nachkommen.") },
      { text: tx("Yes: it takes in dust", "Ja: Er nimmt Staub auf"), title: tx("Not metabolism", "Kein Stoffwechsel"), say: tx("Collecting dust isn't metabolism: nothing is turned into energy or body material.", "Staub sammeln ist kein Stoffwechsel: Nichts wird in Energie oder Körpersubstanz umgewandelt.") },
      { text: tx("No: it needs electricity", "Nein: Er braucht Strom"), title: tx("Not the reason", "Nicht der Grund"), say: tx("Living things need energy too. What counts are cells, growth and reproduction.", "Auch Lebewesen brauchen Energie. Entscheidend sind Zellen, Wachstum und Fortpflanzung.") },
    ],
  },
];

function aliveTask(rng: Rng, fixed?: number): Exercise {
  const C = fixed !== undefined ? ALIVE[fixed] : rng.pick(ALIVE);
  const { answer, mistakes: list } = choice(rng, C.opts);
  return {
    instruction: tx("Alive or not?", "Lebendig oder nicht?"),
    text: tx(`Is **${en(C.thing)}** a living thing?`, `Ist **${de(C.thing)}** ein Lebewesen?`),
    answer,
    hint: tx("Living things show all the characteristics: movement, response to stimuli, metabolism, growth, development, reproduction, and they are made of cells.", "Lebewesen zeigen alle Kennzeichen: Bewegung, Reizbarkeit, Stoffwechsel, Wachstum, Entwicklung, Fortpflanzung, und sie bestehen aus Zellen."),
    solution: [
      frame(q(tx("made of cells?", "aus Zellen?"), "z"), tx("The quickest test: is it made of cells?", "Der schnellste Test: Besteht es aus Zellen?")),
      frame(join(q(C.thing, "t"), "\\Rightarrow", q(C.alive ? tx("living thing", "Lebewesen") : tx("not alive", "kein Lebewesen"), "a")), C.opts[0].text, ["a"]),
    ],
    mistakes: list,
  };
}

const SIGNS: { text: Text; right: boolean; id: string; say?: Text }[] = [
  { id: "move", text: tx("movement", "Bewegung"), right: true },
  { id: "stim", text: tx("response to stimuli", "Reizbarkeit"), right: true },
  { id: "meta", text: tx("metabolism", "Stoffwechsel"), right: true },
  { id: "grow", text: tx("growth", "Wachstum"), right: true },
  { id: "repro", text: tx("reproduction", "Fortpflanzung"), right: true },
  { id: "dev", text: tx("development", "Entwicklung"), right: true },
  { id: "cells", text: tx("being made of cells", "Aufbau aus Zellen"), right: true },
  { id: "green", text: tx("being green", "grüne Farbe"), right: false, say: tx("Most animals and fungi aren't green and are still alive. Green only shows chlorophyll in plants.", "Die meisten Tiere und Pilze sind nicht grün und leben trotzdem. Grün zeigt nur das Chlorophyll in Pflanzen.") },
  { id: "warm", text: tx("being warm", "Wärme"), right: false, say: tx("Fish, frogs and trees aren't warm and are still alive. A radiator is warm and isn't.", "Fische, Frösche und Bäume sind nicht warm und leben trotzdem. Eine Heizung ist warm und lebt nicht.") },
  { id: "legs", text: tx("having legs", "Beine"), right: false, say: tx("Plants, worms and fish have no legs and are alive. That's a feature of some animals, not of life.", "Pflanzen, Würmer und Fische haben keine Beine und leben. Das ist ein Merkmal mancher Tiere, nicht des Lebens.") },
  { id: "hard", text: tx("being hard", "Härte"), right: false, say: tx("A stone is hard, a jellyfish is soft. Hardness tells you nothing about life.", "Ein Stein ist hart, eine Qualle weich. Härte sagt nichts über Leben.") },
  { id: "noise", text: tx("making noises", "Geräusche machen"), right: false, say: tx("Plants are silent and alive, a radio is loud and isn't.", "Pflanzen sind stumm und leben, ein Radio ist laut und lebt nicht.") },
];

function signsTask(rng: Rng): Exercise {
  const rights = rng.shuffle(SIGNS.filter((s) => s.right)).slice(0, rng.int(3, 4));
  const wrongs = rng.shuffle(SIGNS.filter((s) => !s.right)).slice(0, 6 - rights.length);
  const M = multi(rng, [...rights, ...wrongs].map((s) => ({ text: capT(s.text), right: s.right, id: s.id })));
  const m = mistakes(M.answer);
  for (const w of wrongs) m.add({ kind: "multi", options: M.options, correct: [...M.correct, ...M.idx([w.id])].sort((a, b) => a - b) }, tx("Not a sign of life", "Kein Kennzeichen des Lebens"), w.say!);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which of these are **characteristics of living things**?", "Welche davon sind **Kennzeichen des Lebendigen**?"),
    answer: M.answer,
    hint: tx("A characteristic must be true for every living thing: bacteria, oak trees, mushrooms and you.", "Ein Kennzeichen muss für jedes Lebewesen gelten: Bakterien, Eichen, Pilze und dich."),
    solution: [
      frame(tx('"movement, response to stimuli, metabolism," \\\\ "growth, development, reproduction, cells"', '"Bewegung, Reizbarkeit, Stoffwechsel," \\\\ "Wachstum, Entwicklung, Fortpflanzung, Zellen"'), tx("These seven characteristics fit every living thing.", "Diese sieben Kennzeichen passen auf jedes Lebewesen.")),
    ],
    mistakes: m.list.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Single-celled or multicellular?

const SINGLE: { id: string; name: Text }[] = [
  { id: "para", name: tx("slipper animalcule", "Pantoffeltierchen") },
  { id: "amoeba", name: tx("amoeba", "Amöbe") },
  { id: "euglena", name: tx("Euglena", "Augentierchen") },
  { id: "bact", name: tx("bacterium", "Bakterium") },
  { id: "yeast", name: tx("baker's yeast", "Backhefe") },
];
const MULTI: { id: string; name: Text; say: Text }[] = [
  { id: "worm", name: tx("earthworm", "Regenwurm"), say: tx("An earthworm is made of millions of cells with different jobs.", "Ein Regenwurm besteht aus Millionen Zellen mit verschiedenen Aufgaben.") },
  { id: "hydra", name: tx("freshwater polyp (Hydra)", "Süßwasserpolyp"), say: tx("The freshwater polyp is tiny, but it is made of thousands of cells: a simple multicellular animal.", "Der Süßwasserpolyp ist winzig, besteht aber aus Tausenden Zellen: ein einfaches vielzelliges Tier.") },
  { id: "elodea", name: tx("Elodea (waterweed)", "Wasserpest"), say: tx("Elodea is a plant with leaves and a stem: many cells.", "Die Wasserpest ist eine Pflanze mit Blättern und Spross: viele Zellen.") },
  { id: "moss", name: tx("moss", "Moos"), say: tx("Moss looks simple, but every little plant is made of many cells.", "Moos sieht einfach aus, aber jedes Pflänzchen besteht aus vielen Zellen.") },
  { id: "mushroom", name: tx("button mushroom", "Champignon"), say: tx("A mushroom is a fungus made of countless cell threads. Only some fungi, like yeast, are single cells.", "Ein Champignon ist ein Pilz aus unzähligen Zellfäden. Nur manche Pilze, wie die Hefe, sind einzellig.") },
];

function singleCellTask(rng: Rng): Exercise {
  const s = rng.shuffle(SINGLE).slice(0, rng.int(2, 3));
  const mu = rng.shuffle(MULTI).slice(0, 5 - s.length);
  const M = multi(rng, [...s.map((x) => ({ text: x.name, right: true, id: x.id })), ...mu.map((x) => ({ text: x.name, right: false, id: x.id }))]);
  const m = mistakes(M.answer);
  for (const x of mu) m.add({ kind: "multi", options: M.options, correct: [...M.correct, ...M.idx([x.id])].sort((a, b) => a - b) }, tx("Many cells", "Viele Zellen"), x.say);
  if (s.some((x) => x.id === "yeast")) m.add({ kind: "multi", options: M.options, correct: M.correct.filter((i) => !M.idx(["yeast"]).includes(i)) }, tx("Yeast is single-celled", "Hefe ist einzellig"), tx("Baker's yeast is a fungus, but each yeast cell is a complete living thing of its own.", "Backhefe ist ein Pilz, aber jede Hefezelle ist ein eigenes, vollständiges Lebewesen."));
  if (s.some((x) => x.id === "para")) m.add({ kind: "multi", options: M.options, correct: M.correct.filter((i) => !M.idx(["para"]).includes(i)) }, tx("An animal in one cell", "Ein Tier in einer Zelle"), tx("Its name says animal, but the slipper animalcule is one single cell that can do everything.", "Der Name sagt Tierchen, aber das Pantoffeltierchen ist eine einzige Zelle, die alles kann."));
  return {
    instruction: tx("Single-celled organisms", "Einzeller erkennen"),
    text: tx("Which of these living things are **single-celled**?", "Welche dieser Lebewesen sind **Einzeller**?"),
    answer: M.answer,
    hint: tx("A single-celled organism is one cell that does everything on its own. You need a microscope to see most of them.", "Ein Einzeller ist eine einzige Zelle, die alles allein erledigt. Die meisten siehst du nur mit dem Mikroskop."),
    solution: [frame(tx(s.map((x, i) => `"${en(x.name)}"#c${i}`).join(" , "), s.map((x, i) => `"${de(x.name)}"#c${i}`).join(" , ")), tx("Each of these consists of just one cell. The others are multicellular.", "Diese bestehen jeweils aus nur einer Zelle. Die anderen sind Vielzeller."))],
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// The slipper animalcule

const PARA_CONFUSE: Record<string, string[]> = {
  cilia: ["mouth", "contractile", "food"],
  mouth: ["anus", "food", "cilia"],
  food: ["contractile", "micro", "mouth"],
  contractile: ["food", "macro", "anus"],
  macro: ["micro", "food", "contractile"],
  micro: ["macro", "food", "contractile"],
  anus: ["mouth", "food", "contractile"],
};

function parameciumTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(PARA_CONFUSE));
  const P = PARAMECIUM[id];
  if (rng.chance(0.5)) {
    const opts: Opt[] = [{ text: capT(P.name) }];
    for (const w of PARA_CONFUSE[id]) {
      const O = PARAMECIUM[w];
      opts.push({
        text: capT(O.name),
        title: tx("Look again", "Schau noch mal hin"),
        say:
          id === "macro" && w === "micro"
            ? tx("The micronucleus is the small dot. The question mark is on the big bean-shaped nucleus.", "Der Kleinkern ist der kleine Punkt. Das Fragezeichen steht am großen bohnenförmigen Kern.")
            : id === "micro" && w === "macro"
              ? tx("The macronucleus is the big bean. The question mark is on the small dot next to it.", "Der Großkern ist die große Bohne. Das Fragezeichen steht am kleinen Punkt daneben.")
              : tx(`The ${en(O.name)} is ${en(O.look)}. Look where the question mark is.`, `${de(O.name)}: ${de(O.look)}. Schau, wo das Fragezeichen steht.`),
      });
    }
    const { answer, mistakes: list } = choice(rng, opts);
    return {
      instruction: tx("The slipper animalcule", "Das Pantoffeltierchen"),
      text: tx("What is the part with the **?** called?", "Wie heißt der Bestandteil mit dem **?**?"),
      visual: visual(CellParamecium, { mode: "numbers", ask: id, show: [id], legend: "none" }),
      answer,
      hint: tx(`Think about what it does: ${en(P.job)}.`, `Überleg, was es tut: ${de(P.job)}.`),
      solution: [frame(q(P.name, "n"), tx(`It's the **${en(P.name)}**: ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.job)}.`), ["n"])],
      mistakes: list,
    };
  }
  // match: part to job
  const ids = rng.shuffle(Object.keys(PARA_CONFUSE)).slice(0, 4);
  const pairs = ids.map((x) => [capT(PARAMECIUM[x].name), PARAMECIUM[x].job] as [Text, Text]);
  const list: Mistake[] = [];
  if (ids.includes("food") && ids.includes("contractile"))
    list.push(matchMistake([[capT(PARAMECIUM.contractile.name), PARAMECIUM.food.job]], tx("Two kinds of vacuole", "Zwei Arten Vakuolen"), tx("Food is digested in the round food bubbles. The star-shaped vacuoles have nothing to do with food: they deal with water.", "Verdaut wird in den runden Nahrungsbläschen. Die sternförmigen Vakuolen haben mit Nahrung nichts zu tun: Sie kümmern sich um Wasser.")));
  if (ids.includes("macro") && ids.includes("micro"))
    list.push(matchMistake([[capT(PARAMECIUM.macro.name), PARAMECIUM.micro.job]], tx("Big and small nucleus", "Groß- und Kleinkern"), tx("The big nucleus runs everyday life. The small one is the one that matters for reproduction.", "Der Großkern steuert den Alltag. Für die Fortpflanzung ist der kleine wichtig.")));
  if (ids.includes("mouth") && ids.includes("anus"))
    list.push(matchMistake([[capT(PARAMECIUM.anus.name), PARAMECIUM.mouth.job]], tx("In and out", "Rein und raus"), tx("Food goes in through the cell mouth and the remains leave through the anal pore, not the other way round.", "Nahrung kommt durch den Zellmund hinein, die Reste gehen am Zellafter hinaus, nicht umgekehrt.")));
  return {
    instruction: tx("The slipper animalcule", "Das Pantoffeltierchen"),
    text: tx("A single cell does it all. Match each part of the slipper animalcule to its job.", "Eine einzige Zelle macht alles. Ordne jedem Teil des Pantoffeltierchens seine Aufgabe zu."),
    visual: visual(CellParamecium, { mode: "plain", legend: "none" }),
    answer: { kind: "match", pairs },
    hint: tx("Cilia beat, the mouth takes in, food vacuoles digest, the star-shaped vacuoles pump out water.", "Wimpern schlagen, der Mund nimmt auf, Nahrungsvakuolen verdauen, die sternförmigen Vakuolen pumpen Wasser hinaus."),
    solution: ids.map((x, i) => frame(join(q(PARAMECIUM[x].name, `a${i}`), "\\to", q(PARAMECIUM[x].job, `b${i}`)), tx(`${cap(en(PARAMECIUM[x].name))}: ${en(PARAMECIUM[x].job)}.`, `${de(PARAMECIUM[x].name)}: ${de(PARAMECIUM[x].job)}.`))),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// What's under the microscope?

const SPEC_SAY: Record<string, [Text, Text]> = {
  "onion>elodea": [tx("Any green?", "Siehst du Grün?"), tx("Elodea leaf cells are full of green chloroplasts. These cells have none.", "Zellen der Wasserpest sind voller grüner Chloroplasten. Diese Zellen haben keine.")],
  "onion>cheek": [tx("Look at the walls", "Schau auf die Wände"), tx("Cheek cells lie loosely and have no wall. These cells sit in tidy rows, each with a firm wall.", "Mundschleimhautzellen liegen lose und haben keine Wand. Diese Zellen liegen in ordentlichen Reihen, jede mit fester Wand.")],
  "onion>cork": [tx("Is anything inside?", "Ist etwas drin?"), tx("Cork cells are empty: only walls are left. These cells still have a nucleus.", "Korkzellen sind leer: Nur die Wände sind übrig. Diese Zellen haben noch einen Zellkern.")],
  "cheek>onion": [tx("Look at the walls", "Schau auf die Wände"), tx("Onion skin cells sit in tidy rows with firm walls. These cells lie loosely and have irregular shapes: no wall.", "Zwiebelhautzellen liegen in ordentlichen Reihen mit festen Wänden. Diese Zellen liegen lose und sind unregelmäßig geformt: keine Wand.")],
  "cheek>elodea": [tx("Any green?", "Siehst du Grün?"), tx("There's nothing green here, and the cells have no walls.", "Hier ist nichts Grünes, und die Zellen haben keine Wände.")],
  "cheek>cork": [tx("Is anything inside?", "Ist etwas drin?"), tx("Cork is a honeycomb of empty walls. These are single cells with a nucleus.", "Kork ist eine Wabe aus leeren Wänden. Das hier sind einzelne Zellen mit Zellkern.")],
  "elodea>onion": [tx("Look at the green", "Schau aufs Grün"), tx("The green dots are chloroplasts. Onion skin grows in the dark and has none.", "Die grünen Punkte sind Chloroplasten. Zwiebelhaut wächst im Dunkeln und hat keine.")],
  "elodea>cheek": [tx("Walls and green", "Wände und Grün"), tx("These cells have walls and green chloroplasts: plant cells, not cheek cells.", "Diese Zellen haben Wände und grüne Chloroplasten: Pflanzenzellen, keine Mundschleimhaut.")],
  "elodea>cork": [tx("Look at the green", "Schau aufs Grün"), tx("Cork cells are dead and empty. These are full of green chloroplasts.", "Korkzellen sind tot und leer. Diese hier sind voller grüner Chloroplasten.")],
  "cork>onion": [tx("Is anything inside?", "Ist etwas drin?"), tx("Onion skin cells have a nucleus and are long like bricks. These little chambers are empty.", "Zwiebelhautzellen haben einen Zellkern und sind lang wie Ziegel. Diese Kämmerchen sind leer.")],
  "cork>cheek": [tx("Is anything inside?", "Ist etwas drin?"), tx("Cheek cells are loose and have a nucleus. These are empty chambers with thick walls.", "Mundschleimhautzellen liegen lose und haben einen Kern. Das hier sind leere Kammern mit dicken Wänden.")],
  "cork>elodea": [tx("Look at the green", "Schau aufs Grün"), tx("Nothing green, nothing inside: only walls.", "Nichts Grünes, nichts drin: nur Wände.")],
};

function specimenTask(rng: Rng): Exercise {
  const kind = rng.pick(["onion", "cheek", "elodea", "cork", "onion", "cheek", "elodea"] as Specimen[]);
  const zoom = rng.pick([1, 1, 0.25]);
  if (kind !== "cork" && rng.chance(0.45)) {
    const plant = kind !== "cheek";
    const { answer, mistakes: list } = choice(rng, [
      { text: plant ? tx("Plant cells: they have cell walls", "Pflanzenzellen: Sie haben Zellwände") : tx("Animal cells: they have no cell wall", "Tierzellen: Sie haben keine Zellwand") },
      plant
        ? { text: tx("Animal cells: they have a nucleus", "Tierzellen: Sie haben einen Zellkern"), title: tx("Both have a nucleus", "Beide haben einen Kern"), say: tx("Plant cells have a nucleus too, so a nucleus tells you nothing. Look for walls, and for green.", "Auch Pflanzenzellen haben einen Kern, der Kern verrät also nichts. Achte auf Wände und auf Grün.") }
        : { text: tx("Plant cells: they have a nucleus", "Pflanzenzellen: Sie haben einen Zellkern"), title: tx("Both have a nucleus", "Beide haben einen Kern"), say: tx("A nucleus tells you nothing: both kinds have one. Look for firm walls between the cells.", "Der Kern verrät nichts: Beide haben einen. Achte auf feste Wände zwischen den Zellen.") },
      plant
        ? { text: tx("Animal cells: they are lying close together", "Tierzellen: Sie liegen dicht beieinander"), title: tx("Look at the walls", "Schau auf die Wände"), say: tx("Lying close together isn't the point. Each cell here is framed by a firm wall.", "Dicht beieinander ist nicht entscheidend. Jede Zelle hier ist von einer festen Wand umrahmt.") }
        : { text: tx("Plant cells: they are blue", "Pflanzenzellen: Sie sind blau"), title: tx("That's the stain", "Das ist die Färbung"), say: tx("The blue comes from the dye methylene blue. Look at the edges: no firm walls.", "Das Blau kommt vom Farbstoff Methylenblau. Schau auf die Ränder: keine festen Wände.") },
    ]);
    return {
      instruction: tx("Plant or animal cells?", "Pflanzen- oder Tierzellen?"),
      text: tx("This is what you see through the microscope. Are these plant or animal cells?", "Das siehst du im Mikroskop. Sind das Pflanzen- oder Tierzellen?"),
      visual: visual(CellSpecimenView, { kind, zoom }),
      answer,
      hint: tx("Look at the edges of the cells: is there a firm wall? And is anything green?", "Schau auf die Ränder der Zellen: Gibt es eine feste Wand? Und ist etwas grün?"),
      solution: [frame(q(SPECIMENS[kind].name, "s"), SPECIMENS[kind].what), frame(join(q(SPECIMENS[kind].name, "s"), "\\Rightarrow", q(plant ? tx("plant cells", "Pflanzenzellen") : tx("animal cells", "Tierzellen"), "a")), plant ? tx("Firm walls: **plant cells**.", "Feste Wände: **Pflanzenzellen**.") : tx("No walls: **animal cells**.", "Keine Wände: **Tierzellen**."), ["a"])],
      mistakes: list,
    };
  }
  const others = (["onion", "cheek", "elodea", "cork"] as Specimen[]).filter((k) => k !== kind);
  const opts: Opt[] = [{ text: capT(SPECIMENS[kind].name) }, ...others.map((o) => ({ text: capT(SPECIMENS[o].name), title: SPEC_SAY[`${kind}>${o}`][0], say: SPEC_SAY[`${kind}>${o}`][1] }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("What's under the microscope?", "Was liegt unter dem Mikroskop?"),
    text: tx("This is what you see through the microscope. Which specimen is it?", "Das siehst du im Mikroskop. Welches Präparat ist das?"),
    visual: visual(CellSpecimenView, { kind, zoom }),
    answer,
    hint: tx("Check three things: are there walls, is anything green, and is there anything inside the cells?", "Prüf drei Dinge: Gibt es Wände, ist etwas grün, und ist in den Zellen etwas drin?"),
    solution: [frame(q(SPECIMENS[kind].name, "s"), SPECIMENS[kind].what, ["s"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Terms

type Term = { def: Text; accept: Text[]; name: Text; wrong: { accept: Text[]; title: Text; say: Text }[] };
const TERMS: Term[] = [
  {
    def: tx("Many similar cells with the same job form a …", "Viele gleichartige Zellen mit derselben Aufgabe bilden ein …"),
    name: tx("tissue", "Gewebe"),
    accept: [tx("tissue", "Gewebe")],
    wrong: [{ accept: [tx("organ", "Organ")], title: tx("One level too high", "Eine Ebene zu hoch"), say: tx("An organ is made of several different tissues. First, similar cells join up.", "Ein Organ besteht aus mehreren verschiedenen Geweben. Zuerst schließen sich gleiche Zellen zusammen.") }],
  },
  {
    def: tx("Several tissues working together, like the heart or a leaf, form an …", "Mehrere Gewebe, die zusammenarbeiten, wie das Herz oder ein Laubblatt, bilden ein …"),
    name: tx("organ", "Organ"),
    accept: [tx("organ", "Organ")],
    wrong: [
      { accept: [tx("tissue", "Gewebe")], title: tx("One level too low", "Eine Ebene zu tief"), say: tx("A tissue is made of similar cells. Several different tissues together are the next level up.", "Ein Gewebe besteht aus gleichartigen Zellen. Mehrere verschiedene Gewebe zusammen sind die nächste Ebene.") },
      { accept: [tx("organ system", "Organsystem")], title: tx("One level too high", "Eine Ebene zu hoch"), say: tx("An organ system is a team of several organs, like the digestive system.", "Ein Organsystem ist ein Team aus mehreren Organen, wie das Verdauungssystem.") },
    ],
  },
  {
    def: tx("Several organs that work together on one big task, such as digestion, form an …", "Mehrere Organe, die gemeinsam eine große Aufgabe erfüllen, etwa die Verdauung, bilden ein …"),
    name: tx("organ system", "Organsystem"),
    accept: [tx("organ system", "Organsystem")],
    wrong: [{ accept: [tx("organism", "Organismus")], title: tx("One level too high", "Eine Ebene zu hoch"), say: tx("The organism is the whole living thing with all its organ systems.", "Der Organismus ist das ganze Lebewesen mit allen Organsystemen.") }],
  },
  {
    def: tx("A whole living thing, such as a human, an oak tree or a slipper animalcule, is called an …", "Ein ganzes Lebewesen, etwa ein Mensch, eine Eiche oder ein Pantoffeltierchen, nennt man …"),
    name: tx("organism", "Organismus"),
    accept: [tx("organism", "Organismus"), tx("living thing", "Lebewesen")],
    wrong: [{ accept: [tx("organ system", "Organsystem")], title: tx("One level too low", "Eine Ebene zu tief"), say: tx("An organ system is only part of a living thing. The question is about the whole thing.", "Ein Organsystem ist nur ein Teil eines Lebewesens. Gefragt ist das Ganze.") }],
  },
  {
    def: tx("A living thing that consists of just one cell is a …", "Ein Lebewesen, das nur aus einer einzigen Zelle besteht, ist ein …"),
    name: tx("single-celled organism", "Einzeller"),
    accept: [tx("single-celled organism", "Einzeller"), "unicellular organism", "unicellular", "single-celled"],
    wrong: [{ accept: [tx("multicellular organism", "Vielzeller"), "multicellular"], title: tx("Just one cell", "Nur eine Zelle"), say: tx("Multicellular organisms are made of many cells. Here there is only one.", "Vielzeller bestehen aus vielen Zellen. Hier ist es nur eine.") }],
  },
  {
    def: tx("A living thing made of many cells that share the work is a …", "Ein Lebewesen aus vielen Zellen, die sich die Arbeit teilen, ist ein …"),
    name: tx("multicellular organism", "Vielzeller"),
    accept: [tx("multicellular organism", "Vielzeller"), "multicellular"],
    wrong: [{ accept: [tx("single-celled organism", "Einzeller"), "unicellular"], title: tx("Many cells", "Viele Zellen"), say: tx("A single-celled organism is just one cell. Here many cells share the work.", "Ein Einzeller ist nur eine Zelle. Hier teilen sich viele Zellen die Arbeit.") }],
  },
  {
    def: tx("The glass plate you put the specimen on is called the …", "Das Glasplättchen, auf das du das Präparat legst, heißt …"),
    name: tx("slide", "Objektträger"),
    accept: [tx("slide", "Objektträger"), "microscope slide"],
    wrong: [{ accept: [tx("cover slip", "Deckgläschen"), "Deckglas"], title: tx("Below or on top?", "Unten oder oben?"), say: tx("The cover slip is the tiny thin glass that goes on top. The question is about the plate underneath.", "Das Deckgläschen ist das winzige dünne Glas obendrauf. Gefragt ist das Plättchen darunter.") }],
  },
  {
    def: tx("The very thin small glass you lay on top of the specimen is called the …", "Das sehr dünne kleine Glas, das du auf das Präparat legst, heißt …"),
    name: tx("cover slip", "Deckgläschen"),
    accept: [tx("cover slip", "Deckgläschen"), "Deckglas", "coverslip", "cover glass"],
    wrong: [{ accept: [tx("slide", "Objektträger")], title: tx("Below or on top?", "Unten oder oben?"), say: tx("The slide is the bigger plate underneath. The question is about the thin glass on top.", "Der Objektträger ist das größere Plättchen unten. Gefragt ist das dünne Glas obendrauf.") }],
  },
  {
    def: tx("The lens you look into at the top of the microscope is the …", "Die Linse, in die du oben am Mikroskop hineinschaust, ist das …"),
    name: tx("eyepiece", "Okular"),
    accept: MICROSCOPE.eyepiece.accept,
    wrong: [{ accept: MICROSCOPE.objective.accept, title: tx("Eye or object?", "Auge oder Objekt?"), say: tx("The objective is down near the object. Where your eye goes (Latin oculus) is the other lens.", "Das Objektiv ist unten nah am Objekt. Wo dein Auge hinkommt (lateinisch oculus), ist die andere Linse.") }],
  },
];

function termTask(rng: Rng): Exercise {
  const T = rng.pick(TERMS);
  const answer: AnswerSpec = { kind: "word", accept: T.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const w of T.wrong) m.add({ kind: "word", accept: w.accept }, w.title, w.say);
  return {
    instruction: tx("Which term is it?", "Wie heißt der Fachbegriff?"),
    text: T.def,
    answer,
    hint: tx("Think of the levels cell, tissue, organ, organ system, organism, and of the parts of a slide and a microscope.", "Denk an die Ebenen Zelle, Gewebe, Organ, Organsystem, Organismus und an die Teile von Präparat und Mikroskop."),
    solution: [frame(q(T.name, "n"), tx(`The term is **${en(T.name)}**.`, `Der Fachbegriff ist **${de(T.name)}**.`), ["n"])],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Why?

type Why = { q: Text; opts: Opt[] };
const WHY: Why[] = [
  {
    q: tx("Why don't onion skin cells have chloroplasts?", "Warum haben Zwiebelhautzellen keine Chloroplasten?"),
    opts: [
      { text: tx("The onion bulb grows in the dark, so photosynthesis isn't possible there", "Die Zwiebel wächst im Dunkeln, dort ist keine Fotosynthese möglich") },
      { text: tx("Onion cells are animal cells", "Zwiebelzellen sind Tierzellen"), title: tx("Firm walls, so plant", "Feste Wände, also Pflanze"), say: tx("Onion skin cells have firm walls and a big vacuole: they are plant cells. They just lack the green.", "Zwiebelhautzellen haben feste Wände und eine große Vakuole: Es sind Pflanzenzellen. Ihnen fehlt nur das Grün.") },
      { text: tx("Chloroplasts can only be seen with an electron microscope", "Chloroplasten sieht man nur mit dem Elektronenmikroskop"), title: tx("Easy to see", "Gut zu sehen"), say: tx("Chloroplasts are easy to see with a light microscope, for example in an Elodea leaf.", "Chloroplasten sieht man gut im Lichtmikroskop, zum Beispiel im Blatt der Wasserpest.") },
      { text: tx("The water drop washed them out", "Der Wassertropfen hat sie ausgewaschen"), title: tx("They were never there", "Sie waren nie da"), say: tx("Water can't wash organelles out of a cell. These cells never had chloroplasts.", "Wasser kann keine Organellen aus Zellen spülen. Diese Zellen hatten nie Chloroplasten.") },
    ],
  },
  {
    q: tx("Why must a specimen for the light microscope be very thin?", "Warum muss ein Präparat für das Lichtmikroskop sehr dünn sein?"),
    opts: [
      { text: tx("The light has to shine through it from below", "Das Licht muss es von unten durchleuchten") },
      { text: tx("So that it fits under the cover slip", "Damit es unter das Deckgläschen passt"), title: tx("It's about the light", "Es geht ums Licht"), say: tx("It would fit anyway. The real reason: the lamp is underneath, and its light has to get through the specimen.", "Passen würde es schon. Der eigentliche Grund: Die Lampe sitzt unten, und ihr Licht muss durch das Präparat hindurch.") },
      { text: tx("So that it dries faster", "Damit es schneller trocknet"), title: tx("Drying would be bad", "Trocknen wäre schlecht"), say: tx("Drying out is exactly what we want to avoid: that's what the water drop is for.", "Austrocknen will man gerade vermeiden: Dafür ist der Wassertropfen da.") },
      { text: tx("Thick specimens would break the objective", "Dicke Präparate machen das Objektiv kaputt"), title: tx("It's about the light", "Es geht ums Licht"), say: tx("Not quite. Think about where the light comes from and where it has to go.", "Nicht ganz. Überleg, wo das Licht herkommt und wo es hinmuss.") },
    ],
  },
  {
    q: tx("Why do you lower the cover slip at an angle?", "Warum setzt du das Deckgläschen schräg an?"),
    opts: [
      { text: tx("So that no air bubbles get trapped", "Damit keine Luftblasen eingeschlossen werden") },
      { text: tx("So that the specimen gets squashed flat", "Damit das Präparat platt gedrückt wird"), title: tx("Bubbles, not squashing", "Blasen, nicht quetschen"), say: tx("Lowering it slowly pushes the air out to the side. Squashing is not the aim.", "Langsames Absenken schiebt die Luft zur Seite hinaus. Quetschen ist nicht das Ziel.") },
      { text: tx("So that the water runs off", "Damit das Wasser abläuft"), title: tx("The water stays", "Das Wasser bleibt"), say: tx("The water should stay under the glass. What you want to keep out is something else.", "Das Wasser soll unter dem Glas bleiben. Heraushalten willst du etwas anderes.") },
      { text: tx("So that it doesn't break", "Damit es nicht zerbricht"), title: tx("Think of air", "Denk an Luft"), say: tx("It might also break, but the trick has another reason: air.", "Zerbrechen könnte es auch, aber der Trick hat einen anderen Grund: Luft.") },
    ],
  },
  {
    q: tx("Why do you always start with the smallest objective?", "Warum beginnst du immer mit dem kleinsten Objektiv?"),
    opts: [
      { text: tx("You see a large area, find the specimen easily and the lens is far from the slide", "Du siehst einen großen Ausschnitt, findest das Präparat leicht, und die Linse ist weit vom Objektträger entfernt") },
      { text: tx("It magnifies the most", "Es vergrößert am stärksten"), title: tx("It's the weakest", "Es ist das schwächste"), say: tx("The smallest objective magnifies the least. That's exactly why it's so easy to find your way.", "Das kleinste Objektiv vergrößert am wenigsten. Genau deshalb findest du dich so leicht zurecht.") },
      { text: tx("The bigger ones only work with the fine focus", "Die größeren funktionieren nur mit dem Feintrieb"), title: tx("Not the main reason", "Nicht der Hauptgrund"), say: tx("With big objectives you should only use the fine focus, true, but you start small to find the specimen and protect the lens.", "Bei großen Objektiven nimmst du nur den Feintrieb, stimmt. Klein anfangen tust du aber, um das Präparat zu finden und die Linse zu schützen.") },
      { text: tx("It makes the image brighter", "Das Bild wird dadurch heller"), title: tx("Brightness: diaphragm", "Helligkeit: Blende"), say: tx("Brightness is set with the diaphragm. The small objective helps you find your way.", "Die Helligkeit stellst du mit der Blende ein. Das kleine Objektiv hilft dir beim Zurechtfinden.") },
    ],
  },
  {
    q: tx("Why do you stain onion skin with iodine solution?", "Warum färbst du Zwiebelhaut mit Iod-Kaliumiodid-Lösung an?"),
    opts: [
      { text: tx("So that structures like the nucleus stand out more clearly", "Damit Strukturen wie der Zellkern deutlicher hervortreten") },
      { text: tx("To kill germs", "Um Keime abzutöten"), title: tx("It's about seeing", "Es geht ums Sehen"), say: tx("It's not about germs. Unstained cells are almost see-through: the dye adds contrast.", "Es geht nicht um Keime. Ungefärbte Zellen sind fast durchsichtig: Der Farbstoff sorgt für Kontrast.") },
      { text: tx("So that the cells become green", "Damit die Zellen grün werden"), title: tx("Not green", "Nicht grün"), say: tx("Iodine solution stains yellow-brown, and it doesn't make chloroplasts. It just makes things easier to see.", "Iod-Kaliumiodid-Lösung färbt gelbbraun und erzeugt keine Chloroplasten. Sie macht Dinge nur besser sichtbar.") },
      { text: tx("So that the cells grow bigger", "Damit die Zellen größer werden"), title: tx("Same size", "Gleiche Größe"), say: tx("The cells stay the same size. The dye only makes their parts easier to tell apart.", "Die Zellen bleiben gleich groß. Der Farbstoff macht nur ihre Bestandteile besser unterscheidbar.") },
    ],
  },
  {
    q: tx("Why should you only use the fine focus knob with the 40× objective?", "Warum nimmst du beim 40er-Objektiv nur noch den Feintrieb?"),
    opts: [
      { text: tx("The lens is very close to the slide and could crush it", "Die Linse ist ganz nah am Objektträger und könnte ihn zerdrücken") },
      { text: tx("The coarse focus doesn't work with big objectives", "Der Grobtrieb funktioniert bei großen Objektiven nicht"), title: tx("It works, but…", "Er funktioniert, aber …"), say: tx("It works, and that's the danger: one turn too far and the lens hits the cover slip.", "Er funktioniert, und genau das ist die Gefahr: Eine Drehung zu viel, und die Linse stößt ans Deckgläschen.") },
      { text: tx("The fine focus makes it brighter", "Der Feintrieb macht das Bild heller"), title: tx("Brightness: diaphragm", "Helligkeit: Blende"), say: tx("The focus knobs only move the stage up and down. Brightness is set with the diaphragm.", "Die Triebe bewegen nur den Tisch auf und ab. Die Helligkeit stellst du mit der Blende ein.") },
      { text: tx("The fine focus magnifies more", "Der Feintrieb vergrößert stärker"), title: tx("Focus, not magnify", "Scharfstellen, nicht vergrößern"), say: tx("The knobs don't magnify: they only focus. Magnifying is done by the lenses.", "Die Triebe vergrößern nicht, sie stellen nur scharf. Vergrößern tun die Linsen.") },
    ],
  },
  {
    q: tx("Why does the slipper animalcule need its contractile vacuoles?", "Wozu braucht das Pantoffeltierchen seine pulsierenden Vakuolen?"),
    opts: [
      { text: tx("Water keeps flowing into the cell from the pond. They pump it out so the cell doesn't burst", "Aus dem Teichwasser dringt ständig Wasser ein. Sie pumpen es hinaus, damit die Zelle nicht platzt") },
      { text: tx("To digest food", "Um Nahrung zu verdauen"), title: tx("That's the food vacuoles", "Das machen die Nahrungsvakuolen"), say: tx("Digesting happens in the round food vacuoles. The star-shaped ones deal with water.", "Verdaut wird in den runden Nahrungsvakuolen. Die sternförmigen kümmern sich um Wasser.") },
      { text: tx("To swim", "Zum Schwimmen"), title: tx("That's the cilia", "Das machen die Wimpern"), say: tx("It swims with its thousands of cilia. The pulsing vacuoles have another job.", "Es schwimmt mit seinen Tausenden Wimpern. Die pulsierenden Vakuolen haben eine andere Aufgabe.") },
      { text: tx("To store cell sap like a plant", "Um Zellsaft zu speichern wie eine Pflanze"), title: tx("Pumping, not storing", "Pumpen, nicht speichern"), say: tx("They don't store anything: they fill up and empty again and again. Watch them pulse!", "Sie speichern nichts: Sie füllen und leeren sich immer wieder. Schau, wie sie pulsieren!") },
    ],
  },
];

function whyTask(rng: Rng): Exercise {
  const W = rng.pick(WHY);
  const { answer, mistakes: list } = choice(rng, W.opts);
  return {
    instruction: tx("Explain", "Erkläre"),
    text: W.q,
    answer,
    hint: tx("Think about what is actually happening there.", "Überleg, was dabei wirklich passiert."),
    solution: [frame(q(tx("reason", "Grund"), "g"), W.opts[0].text, ["g"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  const shapes: [number, (r: Rng) => Exercise][] = [
    [3, nameStructureTask],
    [2, whereTask],
    [1, onlyPlantTask],
    [2, jobMatchTask],
    [2, scopePartTask],
    [1, scopeJobTask],
    [2, levelsTask],
    [2, procedureTask],
    [1, aliveTask],
    [1, signsTask],
    [1, singleCellTask],
    [1, parameciumTask],
    [2, specimenTask],
    [1, termTask],
    [1, whyTask],
  ];
  const total = shapes.reduce((s, [w]) => s + w, 0);
  let r = rng.int(1, total);
  for (const [w, f] of shapes) {
    r -= w;
    if (r <= 0) return f(rng);
  }
  return nameStructureTask(rng);
}

export const l1 = { nameStructureTask, procedureTask, levelsTask, whereTask, aliveTask };
