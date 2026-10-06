"use client";

// Level 1 (Klasse 5–6): the basic organs of a flowering plant and their jobs, germination
// (water, warmth, oxygen; light mostly not needed), germination experiments, why plants matter.

import { resolveText, tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { PlantDishes, PlantGermination, outcomeOf, type Conditions } from "@/learn/biology/visuals/PlantGermination";
import { PlantWhole } from "@/learn/biology/visuals/PlantWhole";
import { cap, capT, choice, de, en, join, letters, mistakes, pickTask, q, visual, where, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Organs and their jobs

type Organ = "root" | "stem" | "leaf" | "flower";
const ORGANS: Organ[] = ["root", "stem", "leaf", "flower"];

const NAME: Record<Organ, Text> = {
  root: tx("root", "Wurzel"),
  stem: tx("shoot axis", "Sprossachse"),
  leaf: tx("leaf", "Blatt"),
  flower: tx("flower", "Blüte"),
};

const JOBS: Record<Organ, Text[]> = {
  root: [
    tx("anchors the plant in the ground", "verankert die Pflanze im Boden"),
    tx("takes up water and minerals from the soil", "nimmt Wasser und Mineralstoffe aus dem Boden auf"),
    tx("has fine hairs that take up water", "trägt feine Haare, die Wasser aufnehmen"),
    tx("can store food, as in a carrot", "kann Nährstoffe speichern, wie bei der Möhre"),
  ],
  stem: [
    tx("carries the leaves and flowers", "trägt die Blätter und Blüten"),
    tx("transports water from the root up to the leaves", "leitet Wasser von der Wurzel zu den Blättern"),
    tx("holds the leaves up towards the light", "hält die Blätter zum Licht hin"),
    tx("transports sugar from the leaves to all parts", "leitet Zucker aus den Blättern in alle Teile"),
  ],
  leaf: [
    tx("makes sugar from water and carbon dioxide using light", "stellt mit Licht aus Wasser und Kohlenstoffdioxid Zucker her"),
    tx("carries out photosynthesis", "betreibt Fotosynthese"),
    tx("releases oxygen in the light", "gibt im Licht Sauerstoff ab"),
    tx("lets water evaporate through tiny pores", "lässt durch winzige Öffnungen Wasser verdunsten"),
  ],
  flower: [
    tx("is used for reproduction", "dient der Fortpflanzung"),
    tx("develops into fruits with seeds", "entwickelt sich zu Früchten mit Samen"),
    tx("attracts insects with colour and scent", "lockt mit Farbe und Duft Insekten an"),
    tx("produces pollen", "bildet Pollen"),
  ],
};

/** The same jobs in two or three words, for the worked solutions. */
const SHORT: Record<Organ, Text[]> = {
  root: [tx("anchoring", "verankern"), tx("water + minerals", "Wasser + Mineralstoffe"), tx("root hairs", "Wurzelhaare"), tx("storing food", "speichern")],
  stem: [tx("carrying", "tragen"), tx("transporting water", "Wasser leiten"), tx("leaves to the light", "Blätter zum Licht"), tx("transporting sugar", "Zucker leiten")],
  leaf: [tx("making sugar", "Zucker herstellen"), tx("photosynthesis", "Fotosynthese"), tx("releasing oxygen", "Sauerstoff abgeben"), tx("evaporating water", "Wasser verdunsten")],
  flower: [tx("reproduction", "Fortpflanzung"), tx("fruits and seeds", "Früchte und Samen"), tx("attracting insects", "Insekten anlocken"), tx("making pollen", "Pollen bilden")],
};
const THE: Record<Organ, Text> = { root: tx("The root", "Die Wurzel"), stem: tx("The shoot axis", "Die Sprossachse"), leaf: tx("The leaf", "Das Blatt"), flower: tx("The flower", "Die Blüte") };

/** What Blob says when a student picks `picked` for a job of `right`. */
function organSay(right: Organ, picked: Organ, job: Text): Text {
  const j = en(job);
  if (picked === "leaf" && right === "root" && /water/.test(j))
    return tx("Leaves mostly lose water: it evaporates from them. The water gets into the plant through the root, via its root hairs.", "Blätter geben Wasser eher ab: Es verdunstet aus ihnen. In die Pflanze kommt das Wasser über die Wurzel, genauer über die Wurzelhaare.");
  if (picked === "root" && right === "leaf")
    return tx("Roots sit in the dark soil and aren't green. Making sugar needs light and the green pigment chlorophyll. Where does the plant catch light?", "Wurzeln stecken im dunklen Boden und sind nicht grün. Zuckerherstellung braucht Licht und den grünen Farbstoff Chlorophyll. Wo fängt die Pflanze Licht ein?");
  if (picked === "root" && right === "stem")
    return tx("The root takes the water in, right. But who carries it up to the leaves? That's the job of the part in between.", "Die Wurzel nimmt das Wasser auf, stimmt. Aber wer leitet es bis zu den Blättern hinauf? Das macht das Teil dazwischen.");
  if (picked === "stem" && right === "root")
    return tx("The shoot axis transports water upwards, but it doesn't take it in. That happens underground.", "Die Sprossachse leitet Wasser nach oben, nimmt es aber nicht auf. Das passiert unter der Erde.");
  if (picked === "leaf" && right === "flower")
    return tx("Leaves make food. Reproduction, pollen, fruits and seeds: that's the flower's job.", "Blätter stellen Nahrung her. Fortpflanzung, Pollen, Früchte und Samen: Das ist die Aufgabe der Blüte.");
  if (picked === "flower")
    return tx("The flower is for reproduction: fruits and seeds develop from it. This job belongs to another organ.", "Die Blüte dient der Fortpflanzung: Aus ihr entstehen Früchte und Samen. Diese Aufgabe gehört zu einem anderen Organ.");
  const what: Record<Organ, Text> = {
    root: tx("The root anchors the plant and takes up water and minerals.", "Die Wurzel verankert die Pflanze und nimmt Wasser und Mineralstoffe auf."),
    stem: tx("The shoot axis carries leaves and flowers and transports substances.", "Die Sprossachse trägt Blätter und Blüten und leitet Stoffe."),
    leaf: tx("The leaf makes sugar by photosynthesis.", "Das Blatt stellt durch Fotosynthese Zucker her."),
    flower: tx("", ""),
  };
  return tx(`${en(what[picked])} Does that fit "${j}"?`, `${de(what[picked])} Passt das zu „${de(job)}“?`);
}

function organTask(rng: Rng, fixed?: { organ: Organ; job: number }): Exercise {
  const organ = fixed?.organ ?? rng.pick(ORGANS);
  const ji = fixed?.job ?? rng.int(0, JOBS[organ].length - 1);
  const job = JOBS[organ][ji];
  const others = ORGANS.filter((o) => o !== organ);
  const { answer, mistakes: list } = choice(rng, [
    { text: capT(NAME[organ]) },
    ...others.map((o) => ({ text: capT(NAME[o]), title: tx("Another organ's job", "Aufgabe eines anderen Organs"), say: organSay(organ, o, job) })),
  ]);
  return {
    instruction: tx("Which organ does this?", "Welches Organ macht das?"),
    text: tx(`Which part of a flowering plant **${en(job)}**?`, `Welches Teil einer Blütenpflanze **${de(job)}**?`),
    answer,
    hint: tx("Think from bottom to top: root in the soil, shoot axis, leaves, flower.", "Geh von unten nach oben: Wurzel im Boden, Sprossachse, Blätter, Blüte."),
    solution: [
      { math: q(SHORT[organ][ji], "j"), note: tx(`Which organ ${en(job)}?`, `Welches Organ ${de(job)}?`) },
      { math: join(q(SHORT[organ][ji], "j"), "\\to", q(capT(NAME[organ]), "o")), note: tx(`${en(THE[organ])} ${en(job)}.`, `${de(THE[organ])} ${de(job)}.`), highlight: ["o"] },
    ],
    mistakes: list,
  };
}

const MYTH_JOB = tx("takes in food (sugar) from the soil", "nimmt Nahrung (Zucker) aus dem Boden auf");

function matchTask(rng: Rng, fixed?: number[]): Exercise {
  const idx = ORGANS.map((o, i) => fixed?.[i] ?? rng.int(0, JOBS[o].length - 1));
  const picks = ORGANS.map((o, i) => JOBS[o][idx[i]]);
  const short = ORGANS.map((o, i) => SHORT[o][idx[i]]);
  const pairs: [Text, Text][] = ORGANS.map((o, i) => [capT(NAME[o]), picks[i]]);
  const list: Mistake[] = [
    {
      when: { kind: "match", pairs: [[capT(NAME.root), MYTH_JOB]] },
      title: tx("Plants don't eat soil", "Pflanzen essen keine Erde"),
      say: tx("That's the classic trap! Plants make their food (sugar) themselves in the leaves. From the soil the root only takes water and minerals.", "Die klassische Falle! Pflanzen stellen ihre Nahrung (Zucker) im Blatt selbst her. Aus dem Boden holt die Wurzel nur Wasser und Mineralstoffe."),
    },
    {
      when: { kind: "match", pairs: [[capT(NAME.stem), picks[0]]] },
      title: tx("That happens underground", "Das passiert unter der Erde"),
      say: tx("Look at that job again: it happens underground. The shoot axis only carries and passes things on.", "Schau dir diese Aufgabe noch mal an: Sie passiert unter der Erde. Die Sprossachse trägt nur und leitet weiter."),
    },
    {
      when: { kind: "match", pairs: [[capT(NAME.flower), picks[2]]] },
      title: tx("The flower is for reproduction", "Die Blüte dient der Fortpflanzung"),
      say: tx("Making food and gas exchange happen in the green leaves. The flower is there for reproduction.", "Nahrung herstellen und Gasaustausch passieren in den grünen Blättern. Die Blüte ist für die Fortpflanzung da."),
    },
  ];
  return {
    instruction: tx("Match the organs", "Ordne die Organe zu"),
    text: tx("Match each organ with one of its jobs. One card is left over: it's wrong.", "Ordne jedem Organ eine seiner Aufgaben zu. Eine Karte bleibt übrig: Sie ist falsch."),
    answer: { kind: "match", pairs, distractors: [MYTH_JOB] },
    hint: tx("The root works underground, the leaf in the light, the flower makes seeds, the shoot axis connects them all.", "Die Wurzel arbeitet unter der Erde, das Blatt im Licht, die Blüte macht Samen, die Sprossachse verbindet alles."),
    solution: [
      { math: join(q(capT(NAME.root), "r"), "\\to", q(short[0], "rj"), "\\\\", q(capT(NAME.stem), "s"), "\\to", q(short[1], "sj")), note: tx(`The root ${en(picks[0])}. The shoot axis ${en(picks[1])}.`, `Die Wurzel ${de(picks[0])}. Die Sprossachse ${de(picks[1])}.`) },
      {
        math: join(q(capT(NAME.root), "r"), "\\to", q(short[0], "rj"), "\\\\", q(capT(NAME.stem), "s"), "\\to", q(short[1], "sj"), "\\\\", q(capT(NAME.leaf), "l"), "\\to", q(short[2], "lj"), "\\\\", q(capT(NAME.flower), "f"), "\\to", q(short[3], "fj")),
        note: tx(`The leaf ${en(picks[2])}. The flower ${en(picks[3])}. And no organ eats soil!`, `Das Blatt ${de(picks[2])}. Die Blüte ${de(picks[3])}. Und kein Organ frisst Erde!`),
      },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Name the part in the drawing

const PART_WORDS: Record<string, { accept: Text[]; wrong: { accept: Text[]; title: Text; say: Text; close?: boolean }[]; why: Text }> = {
  flower: {
    accept: [tx("flower", "Blüte"), "Blüten", "blossom"],
    wrong: [{ accept: [tx("bud", "Knospe")], title: tx("It's already open", "Sie ist schon offen"), say: tx("A bud is still closed. This one has opened its petals.", "Eine Knospe ist noch geschlossen. Diese hier hat ihre Kronblätter schon geöffnet.") }],
    why: tx("The open flower at the top: for reproduction.", "Die offene Blüte ganz oben: für die Fortpflanzung."),
  },
  bud: {
    accept: [tx("bud", "Knospe"), tx("flower bud", "Blütenknospe")],
    wrong: [{ accept: [tx("flower", "Blüte")], title: tx("Not open yet", "Noch nicht offen"), say: tx("Nearly! It's still closed, with the green sepals around it. What is a flower called before it opens?", "Fast! Sie ist noch geschlossen, die grünen Kelchblätter liegen darum. Wie heißt eine Blüte, bevor sie aufgeht?"), close: true }],
    why: tx("Still closed: a bud. A new flower will open from it.", "Noch geschlossen: eine Knospe. Aus ihr geht eine neue Blüte auf."),
  },
  leaf: {
    accept: [tx("leaf", "Blatt"), tx("foliage leaf", "Laubblatt"), "leaves", "Blätter", "Laubblätter"],
    wrong: [{ accept: [tx("leaf vein", "Blattader")], title: tx("The whole leaf", "Das ganze Blatt"), say: tx("The veins are only the lines in it. The marker points to the whole flat green organ.", "Die Adern sind nur die Linien darin. Die Markierung zeigt auf das ganze flache, grüne Organ.") }],
    why: tx("The green, flat organ: the foliage leaf.", "Das grüne, flache Organ: das Laubblatt."),
  },
  stem: {
    accept: [tx("shoot axis", "Sprossachse"), tx("stem", "Stängel"), "Stengel", "Stamm", "trunk", "stalk"],
    wrong: [
      { accept: [tx("shoot", "Spross")], title: tx("Nearly, just the axis", "Fast, nur die Achse"), say: tx("The shoot is the axis together with leaves and flowers. The axis on its own has a longer name.", "Der Spross ist die Achse samt Blättern und Blüten. Die Achse allein hat einen längeren Namen."), close: true },
      { accept: [tx("root", "Wurzel")], title: tx("Above the ground", "Über der Erde"), say: tx("This part is above the ground and carries the leaves. The root is below the soil line.", "Dieses Teil steht über der Erde und trägt die Blätter. Die Wurzel liegt unter der Bodenlinie.") },
    ],
    why: tx("It carries leaves and flowers: the shoot axis (in herbs the stem, in trees the trunk).", "Sie trägt Blätter und Blüten: die Sprossachse (bei Kräutern Stängel, bei Bäumen Stamm)."),
  },
  taproot: {
    accept: [tx("main root", "Hauptwurzel"), "taproot", "Pfahlwurzel", "primary root"],
    wrong: [
      { accept: [tx("lateral root", "Seitenwurzel")], title: tx("The thick one in the middle", "Die dicke in der Mitte"), say: tx("Lateral roots branch off to the sides. The marker points to the thick root going straight down.", "Seitenwurzeln zweigen zur Seite ab. Die Markierung zeigt auf die dicke Wurzel, die senkrecht nach unten geht.") },
      { accept: [tx("root", "Wurzel")], title: tx("Which root?", "Welche Wurzel?"), say: tx("Right, it's a root! But which one: the thick one in the middle or one of the side branches?", "Richtig, eine Wurzel! Aber welche: die dicke in der Mitte oder eine der Abzweigungen?"), close: true },
    ],
    why: tx("The thick root going straight down: the main root.", "Die dicke, senkrecht nach unten wachsende Wurzel: die Hauptwurzel."),
  },
  lateral: {
    accept: [tx("lateral root", "Seitenwurzel"), "side root", "Seitenwurzeln"],
    wrong: [
      { accept: [tx("main root", "Hauptwurzel")], title: tx("A side branch", "Eine Abzweigung"), say: tx("The main root goes straight down in the middle. This one branches off to the side.", "Die Hauptwurzel geht in der Mitte senkrecht nach unten. Diese hier zweigt zur Seite ab.") },
      { accept: [tx("root", "Wurzel")], title: tx("Which root?", "Welche Wurzel?"), say: tx("Right, a root! But it branches off sideways. What could it be called?", "Richtig, eine Wurzel! Aber sie zweigt zur Seite ab. Wie könnte sie heißen?"), close: true },
    ],
    why: tx("It branches off the main root: a lateral root.", "Sie zweigt von der Hauptwurzel ab: eine Seitenwurzel."),
  },
  hairs: {
    accept: [tx("root hairs", "Wurzelhaare"), "root hair", "Wurzelhaar"],
    wrong: [{ accept: [tx("root", "Wurzel"), tx("lateral root", "Seitenwurzel")], title: tx("Look closer", "Schau genauer hin"), say: tx("The magnifier shows the tiny hairs on a root tip. What are they called?", "Die Lupe zeigt die winzigen Härchen an einer Wurzelspitze. Wie heißen sie?"), close: true }],
    why: tx("Tiny outgrowths of single root cells: root hairs. They take up water and minerals.", "Winzige Ausstülpungen einzelner Wurzelzellen: Wurzelhaare. Sie nehmen Wasser und Mineralstoffe auf."),
  },
};

function nameTask(rng: Rng): Exercise {
  const part = rng.pick(Object.keys(PART_WORDS));
  const P = PART_WORDS[part];
  const answer: AnswerSpec = { kind: "word", accept: P.accept, placeholder: tx("name of the part", "Name des Teils") };
  const m = mistakes(answer);
  for (const w of P.wrong) m.add({ kind: "word", accept: w.accept }, w.title, w.say, w.close);
  return {
    instruction: tx("Name the part", "Benenne das Teil"),
    text: tx("What is the part with the question mark called?", "Wie heißt das Teil mit dem Fragezeichen?"),
    visual: visual(PlantWhole, { mode: "numbers", ask: part, legend: "none" }),
    answer,
    hint: tx("Is it above or below the ground? What does it look like?", "Liegt es über oder unter der Erde? Wie sieht es aus?"),
    solution: [{ math: q(capT(P.accept[0]), "a"), note: P.why, highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Vegetables: which organ do we eat?

const FOOD: { name: Text; organ: Organ; why: Text; trap?: { organ: Organ; say: Text } }[] = [
  { name: tx("a carrot", "eine Möhre"), organ: "root", why: tx("A carrot is a thick storage root.", "Die Möhre ist eine verdickte Speicherwurzel.") },
  { name: tx("a parsnip", "eine Pastinake"), organ: "root", why: tx("A parsnip is a thick storage root, like a carrot.", "Die Pastinake ist wie die Möhre eine verdickte Speicherwurzel.") },
  {
    name: tx("a potato", "eine Kartoffel"),
    organ: "stem",
    why: tx("A potato is a swollen underground shoot axis (a stem tuber). Its eyes are buds that grow new shoots.", "Die Kartoffel ist eine verdickte, unterirdische Sprossachse (Sprossknolle). Ihre Augen sind Knospen, aus denen neue Triebe wachsen."),
    trap: { organ: "root", say: tx("Sounds logical, it grows in the soil! But a potato is a swollen shoot axis (a stem tuber): its eyes are buds that sprout new shoots. Roots don't have buds like that.", "Klingt logisch, sie wächst ja in der Erde! Die Kartoffel ist aber eine verdickte Sprossachse (Sprossknolle): Ihre Augen sind Knospen, aus denen neue Triebe wachsen. So etwas haben Wurzeln nicht.") },
  },
  {
    name: tx("kohlrabi", "Kohlrabi"),
    organ: "stem",
    why: tx("Kohlrabi is a swollen shoot axis: the leaves grow right out of it.", "Kohlrabi ist eine verdickte Sprossachse: Die Blätter wachsen direkt aus ihr heraus."),
    trap: { organ: "root", say: tx("Kohlrabi grows above the ground and has leaves growing out of it. So it's a swollen shoot axis.", "Kohlrabi wächst über der Erde, und aus ihm wachsen Blätter heraus. Er ist also eine verdickte Sprossachse.") },
  },
  {
    name: tx("asparagus", "Spargel"),
    organ: "stem",
    why: tx("Asparagus spears are young shoots. The little scales at the tip are tiny leaves.", "Spargelstangen sind junge Sprosse. Die kleinen Schuppen an der Spitze sind winzige Blättchen."),
    trap: { organ: "root", say: tx("White asparagus is dug out of the soil, but the spears are young shoots growing upwards. The scales on them are tiny leaves.", "Weißer Spargel wird aus der Erde gestochen, aber die Stangen sind junge Sprosse, die nach oben wachsen. Die Schuppen daran sind winzige Blättchen.") },
  },
  {
    name: tx("ginger", "Ingwer"),
    organ: "stem",
    why: tx("Ginger is an underground shoot axis (a rhizome) with buds.", "Ingwer ist eine unterirdische Sprossachse (Erdspross, Rhizom) mit Knospen."),
    trap: { organ: "root", say: tx("Ginger grows in the soil, but it's an underground shoot axis (rhizome): it has buds and grows sideways.", "Ingwer wächst in der Erde, ist aber eine unterirdische Sprossachse (Erdspross): Er hat Knospen und wächst waagerecht.") },
  },
  { name: tx("lettuce", "Kopfsalat"), organ: "leaf", why: tx("We eat the leaves of lettuce.", "Vom Kopfsalat essen wir die Blätter.") },
  { name: tx("spinach", "Spinat"), organ: "leaf", why: tx("Spinach is leaves.", "Spinat sind Blätter.") },
  { name: tx("parsley", "Petersilie"), organ: "leaf", why: tx("We eat the leaves of parsley.", "Von der Petersilie essen wir die Blätter.") },
  {
    name: tx("rhubarb", "Rhabarber"),
    organ: "leaf",
    why: tx("Rhubarb sticks are leaf stalks. The big leaf blade sits on top (and isn't eaten).", "Rhabarberstangen sind Blattstiele. Oben sitzt die große Blattspreite (die isst man nicht)."),
    trap: { organ: "stem", say: tx("They look like stems! But rhubarb sticks are leaf stalks: each carries one big leaf blade. The stalk belongs to the leaf.", "Sie sehen aus wie Stängel! Rhabarberstangen sind aber Blattstiele: Jede trägt eine große Blattspreite. Der Stiel gehört zum Blatt.") },
  },
  {
    name: tx("an onion", "eine Zwiebel"),
    organ: "leaf",
    why: tx("The layers of an onion are thick storage leaves. The real roots are the fibres underneath.", "Die Schichten einer Zwiebel sind verdickte Speicherblätter. Die echten Wurzeln sind die Fasern unten dran."),
    trap: { organ: "root", say: tx("An onion sits in the soil, but its layers are thick storage leaves. The roots are the thin fibres at the bottom.", "Eine Zwiebel steckt in der Erde, aber ihre Schichten sind verdickte Speicherblätter. Die Wurzeln sind die dünnen Fasern unten.") },
  },
  {
    name: tx("broccoli", "Brokkoli"),
    organ: "flower",
    why: tx("The green florets are many small flower buds. Left standing, broccoli flowers yellow.", "Die grünen Röschen sind viele kleine Blütenknospen. Lässt man Brokkoli stehen, blüht er gelb."),
    trap: { organ: "leaf", say: tx("It's green, but the little florets are flower buds. Left in the garden, broccoli opens yellow flowers.", "Er ist grün, aber die Röschen sind Blütenknospen. Lässt man ihn im Garten stehen, öffnen sich gelbe Blüten.") },
  },
  {
    name: tx("cauliflower", "Blumenkohl"),
    organ: "flower",
    why: tx("The white head is a thickened cluster of flowers (the name says it: Blumen-kohl).", "Der weiße Kopf ist ein verdickter Blütenstand (der Name verrät es: Blumenkohl)."),
    trap: { organ: "leaf", say: tx("The green leaves around it are leaves, yes. But the white head we eat is a thick cluster of flower buds.", "Die grünen Blätter drumherum sind Blätter, ja. Aber der weiße Kopf, den wir essen, ist ein dicker Blütenstand.") },
  },
  { name: tx("an artichoke", "eine Artischocke"), organ: "flower", why: tx("An artichoke is a big flower bud.", "Die Artischocke ist eine große Blütenknospe.") },
];

const FOOD_SAY: Record<Organ, Text> = {
  root: tx("Roots have no buds and no leaves, and they don't grow out of the shoot. Does that fit here?", "Wurzeln haben keine Knospen und keine Blätter. Passt das hier?"),
  stem: tx("A shoot axis carries leaves and buds. Is that what you eat here?", "Eine Sprossachse trägt Blätter und Knospen. Isst du hier wirklich die?"),
  leaf: tx("A leaf is usually flat and green and grows from the shoot axis. Is that what you eat here?", "Ein Blatt ist meist flach und grün und wächst an der Sprossachse. Isst du hier wirklich eins?"),
  flower: tx("Flowers and flower buds sit at the tips of shoots. Is that what you eat here?", "Blüten und Blütenknospen sitzen an den Spitzen der Sprosse. Isst du hier wirklich die?"),
};

function foodTask(rng: Rng): Exercise {
  const f = rng.pick(FOOD);
  const opts: Opt[] = [
    { text: capT(NAME[f.organ]) },
    ...ORGANS.filter((o) => o !== f.organ).map((o) => ({
      text: capT(NAME[o]),
      title: f.trap?.organ === o ? tx("Looks can deceive", "Der Schein trügt") : tx("Another organ", "Ein anderes Organ"),
      say: f.trap?.organ === o ? f.trap.say : FOOD_SAY[o],
    })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Plant organs on your plate", "Pflanzenorgane auf dem Teller"),
    text: tx(`Which plant organ do you eat when you eat **${en(f.name)}**?`, `Welches Pflanzenorgan isst du, wenn du **${de(f.name)}** isst?`),
    answer,
    hint: tx("Not everything that grows in the soil is a root. Look for buds, leaves or flowers.", "Nicht alles, was in der Erde wächst, ist eine Wurzel. Achte auf Knospen, Blätter oder Blüten."),
    solution: [{ math: join(q(capT(f.name), "f"), "\\to", q(capT(NAME[f.organ]), "o")), note: f.why, highlight: ["o"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Germination

const ALL: Conditions = { water: true, warm: true, oxygen: true, light: true };
type Factor = keyof Conditions;
const FACTORS: Factor[] = ["water", "warm", "oxygen", "light"];
const FACTOR_NAME: Record<Factor, Text> = { water: tx("water", "Wasser"), warm: tx("warmth", "Wärme"), oxygen: tx("oxygen", "Sauerstoff"), light: tx("light", "Licht") };
const without = (f: Factor): Conditions => ({ ...ALL, [f]: false });
const FACTOR_IN: Record<Factor, Text> = { water: tx("the water", "beim Wasser"), warm: tx("the temperature", "bei der Temperatur"), oxygen: tx("the oxygen", "beim Sauerstoff"), light: tx("the light", "beim Licht") };
/** How dish B is set up without one condition. */
const SETUP: Record<Factor, Text> = {
  water: tx("gets no water", "bekommt kein Wasser"),
  warm: tx("goes into the fridge (4 °C)", "kommt in den Kühlschrank (4 °C)"),
  oxygen: tx("goes into an airtight jar without oxygen", "kommt in ein luftdichtes Gefäß ohne Sauerstoff"),
  light: tx("goes into a dark box", "kommt in einen dunklen Karton"),
};

const SEEDS: Text[] = [tx("bean seeds", "Bohnensamen"), tx("pea seeds", "Erbsensamen"), tx("maize grains", "Maiskörner"), tx("sunflower seeds", "Sonnenblumenkerne"), tx("wheat grains", "Weizenkörner")];

const NEED_SAY: Record<Factor, Text> = {
  water: tx("Without water a seed stays dry and at rest. Water makes it swell and wakes it up.", "Ohne Wasser bleibt der Samen trocken und in Samenruhe. Erst Wasser lässt ihn quellen und weckt ihn auf."),
  warm: tx("In the cold (4 °C, like in a fridge) the life processes in the seed run far too slowly.", "In der Kälte (4 °C, wie im Kühlschrank) laufen die Lebensvorgänge im Samen viel zu langsam ab."),
  oxygen: tx("The embryo needs oxygen to respire: that's how it gets energy from its food stores.", "Der Keimling braucht Sauerstoff zum Atmen: So gewinnt er Energie aus seinen Vorräten."),
  light: tx("The seeds germinate in the dark too: their food is stored in the seed. They only need light later, for photosynthesis.", "Die Samen keimen auch im Dunkeln: Ihre Nahrung steckt im Samen. Licht brauchen sie erst später für die Fotosynthese."),
};

const dishSay = (c: Conditions): Text => {
  const out = outcomeOf(c);
  if (out === "pale") return tx("Dish in the dark: the seeds germinate here too! Light isn't needed for germination.", "Schale im Dunkeln: Hier keimen die Samen auch! Licht ist zum Keimen nicht nötig.");
  if (!c.water) return NEED_SAY.water;
  if (!c.oxygen) return NEED_SAY.oxygen;
  if (!c.warm) return NEED_SAY.warm;
  return tx("This dish has everything a seed needs.", "Diese Schale hat alles, was ein Samen braucht.");
};

/** Which of these dishes germinate? */
function predictTask(rng: Rng): Exercise | null {
  const pool: Conditions[] = [ALL, without("water"), without("warm"), without("oxygen"), without("light"), { ...ALL, light: false, warm: false }, { ...ALL, water: false, light: false }];
  const n = rng.int(3, 5);
  const dishes = rng.shuffle([rng.chance(0.5) ? ALL : without("light"), ...rng.shuffle(pool.slice(1)).slice(0, n - 1)]);
  const uniq = dishes.filter((d, i) => dishes.findIndex((x) => JSON.stringify(x) === JSON.stringify(d)) === i);
  if (uniq.length < 3) return null;
  const options: Text[] = uniq.map((_, i) => tx(`Dish ${"ABCDE"[i]}`, `Schale ${"ABCDE"[i]}`));
  const correct = where(uniq, (c) => outcomeOf(c) === "germ" || outcomeOf(c) === "pale");
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const dark = where(uniq, (c) => outcomeOf(c) === "pale");
  if (dark.length) m.add({ kind: "multi", options, correct: correct.filter((i) => !dark.includes(i)) }, tx("Light isn't needed", "Licht ist nicht nötig"), tx("You left out the dish in the dark. Its seeds germinate too: their food is stored in the seed, so they don't need light yet.", "Du hast die Schale im Dunkeln weggelassen. Ihre Samen keimen auch: Ihre Nahrung steckt im Samen, Licht brauchen sie noch nicht."));
  const swell = where(uniq, (c) => outcomeOf(c) === "swell");
  for (const i of swell) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("Swelling isn't germinating", "Quellen ist nicht Keimen"), tx(`Dish ${"ABCDE"[i]}: ${en(dishSay(uniq[i]))}`, `Schale ${"ABCDE"[i]}: ${de(dishSay(uniq[i]))}`));
  const dry = where(uniq, (c) => !c.water);
  if (dry.length) m.add({ kind: "multi", options, correct: [...correct, ...dry].sort((a, b) => a - b) }, tx("No water, no germination", "Ohne Wasser kein Keimen"), NEED_SAY.water);
  const seed = rng.pick(SEEDS);
  return {
    instruction: tx("Predict the result", "Sag das Ergebnis voraus"),
    text: tx(
      `${cap(en(seed))} are put on cotton wool in ${uniq.length} dishes and left for a week. The symbols show water, temperature, oxygen and light (moon = dark). In which dishes do the seeds **germinate**?`,
      `${de(seed)} liegen in ${uniq.length} Schalen auf Watte, eine Woche lang. Die Symbole zeigen Wasser, Temperatur, Sauerstoff und Licht (Mond = dunkel). In welchen Schalen **keimen** die Samen?`,
    ),
    visual: visual(PlantDishes, { dishes: uniq }),
    answer,
    hint: tx("Seeds need water, warmth and oxygen. Do they also need light?", "Samen brauchen Wasser, Wärme und Sauerstoff. Brauchen sie auch Licht?"),
    solution: [
      { math: tx('"water" + "warmth" + "oxygen" \\\\ \\to "germination"', '"Wasser" + "Wärme" + "Sauerstoff" \\\\ \\to "Keimung"'), note: tx("These three are needed. Light is not.", "Diese drei sind nötig. Licht nicht.") },
      {
        math: tx(`"germinate:"#g \\; "${letters(correct, "en")}"#a`, `"keimen:"#g \\; "${letters(correct, "de")}"#a`),
        note: tx(`Only dish${correct.length > 1 ? "es" : ""} ${letters(correct, "en")} ${correct.length > 1 ? "have" : "has"} water, warmth and oxygen.`, `Nur ${correct.length > 1 ? "die Schalen" : "Schale"} ${letters(correct, "de")} ${correct.length > 1 ? "haben" : "hat"} Wasser, Wärme und Sauerstoff.`),
        highlight: ["a"],
      },
    ],
    mistakes: m.list,
  };
}

const CONCLUDE = (f: Factor): Text =>
  f === "light"
    ? tx("Seeds don't need light to germinate.", "Samen brauchen zum Keimen kein Licht.")
    : tx(`Seeds need ${en(FACTOR_NAME[f])} to germinate.`, `Samen brauchen zum Keimen ${de(FACTOR_NAME[f])}.`);

/** Two or three dishes with results: what does the comparison show? */
function interpretTask(rng: Rng, fixed?: Factor): Exercise {
  const f = fixed ?? rng.pick(FACTORS);
  const three = !fixed && rng.chance(0.4);
  const other = rng.pick(FACTORS.filter((x) => x !== f));
  const dishes = three ? [ALL, without(other), without(f)] : [ALL, without(f)];
  const ask = dishes.length - 1;
  const wrongFactors = FACTORS.filter((x) => x !== f);
  const opts: Opt[] = [{ text: CONCLUDE(f) }];
  if (f === "light") {
    opts.push({ text: tx("Seeds need light to germinate.", "Samen brauchen zum Keimen Licht."), title: tx("Look at the result", "Schau aufs Ergebnis"), say: tx("Look again: the seeds in the dark germinated too! They are just long and pale. So light isn't needed for germination.", "Schau noch mal hin: Die Samen im Dunkeln haben auch gekeimt! Sie sind nur lang und bleich. Licht ist also zum Keimen nicht nötig.") });
  }
  for (const w of rng.shuffle(wrongFactors).slice(0, f === "light" ? 2 : 3)) {
    opts.push({
      text: w === "light" ? tx("Seeds need light to germinate.", "Samen brauchen zum Keimen Licht.") : CONCLUDE(w),
      title: tx("Compare only one change", "Nur eine Änderung vergleichen"),
      say: tx(`Dish ${"ABC"[ask]} differs from dish A only in ${en(FACTOR_IN[f])}. So that's the only thing this comparison can tell you about.`, `Schale ${"ABC"[ask]} unterscheidet sich von Schale A nur ${de(FACTOR_IN[f])}. Nur darüber kann dieser Vergleich etwas aussagen.`),
    });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Interpret the experiment", "Werte den Versuch aus"),
    text: three
      ? tx(`The picture shows the dishes after one week. Dish A is the control. What does the comparison of dish A and dish ${"ABC"[ask]} show?`, `Das Bild zeigt die Schalen nach einer Woche. Schale A ist der Kontrollansatz. Was zeigt der Vergleich von Schale A und Schale ${"ABC"[ask]}?`)
      : tx("The picture shows two dishes after one week. Dish A is the control. What does the comparison show?", "Das Bild zeigt zwei Schalen nach einer Woche. Schale A ist der Kontrollansatz. Was zeigt der Vergleich?"),
    visual: visual(PlantDishes, { dishes, results: true }),
    answer,
    hint: tx(`What is different between dish A and dish ${"ABC"[ask]}, and did the seeds germinate?`, `Was ist zwischen Schale A und Schale ${"ABC"[ask]} anders, und haben die Samen gekeimt?`),
    solution: [
      { math: tx(`"A vs ${"ABC"[ask]}:"#v \\; "only ${en(FACTOR_NAME[f])} differs"#d`, `"A und ${"ABC"[ask]}:"#v \\; "nur ${de(FACTOR_NAME[f])} anders"#d`), note: tx("Only one condition was changed: a fair comparison.", "Nur eine Bedingung wurde geändert: ein fairer Vergleich.") },
      { math: f === "light" ? tx('"not needed:"#n \\; "light"#c', '"nicht nötig:"#n \\; "Licht"#c') : tx(`"needed:"#n \\; "${en(FACTOR_NAME[f])}"#c`, `"nötig:"#n \\; "${de(FACTOR_NAME[f])}"#c`), note: tx(`${en(CONCLUDE(f))} ${en(NEED_SAY[f])}`, `${de(CONCLUDE(f))} ${de(NEED_SAY[f])}`), highlight: ["c"] },
    ],
    mistakes: list,
  };
}

/** Plan a fair test for one factor. */
function fairTask(rng: Rng): Exercise {
  const f = rng.pick(FACTORS);
  const g = rng.pick(FACTORS.filter((x) => x !== f));
  const seed = rng.pick(SEEDS);
  const F = FACTOR_NAME[f];
  const G = FACTOR_NAME[g];
  const { answer, mistakes: list } = choice(rng, [
    { text: tx(`Dish B ${en(SETUP[f])}; everything else as in dish A.`, `Schale B ${de(SETUP[f])}, sonst alles wie bei Schale A.`) },
    {
      text: tx(`Dish B ${en(SETUP[f])} and ${en(SETUP[g])}.`, `Schale B ${de(SETUP[f])} und ${de(SETUP[g])}.`),
      title: tx("Two changes at once", "Zwei Änderungen auf einmal"),
      say: tx(`If dish B lacks ${en(F)} and ${en(G)} and nothing germinates, which one was to blame? Change only one condition.`, `Wenn Schale B ${de(F)} und ${de(G)} fehlen und nichts keimt: Woran lag es? Ändere nur eine Bedingung.`),
    },
    {
      text: tx("Set up dish B exactly like dish A.", "Schale B genau wie Schale A ansetzen."),
      title: tx("Nothing to compare", "Nichts zu vergleichen"),
      say: tx(`Then both dishes are the same, and you learn nothing about ${en(F)}. Dish B must lack exactly that one condition.`, `Dann sind beide Schalen gleich, und du erfährst nichts über ${de(F)}. Schale B muss genau diese eine Bedingung fehlen.`),
    },
    {
      text: tx(`Dish B gets only ${en(F)}, nothing else.`, `Schale B bekommt nur ${de(F)}, sonst nichts.`),
      title: tx("Too many changes", "Zu viele Änderungen"),
      say: tx("Now dish B lacks almost everything. If nothing grows, you can't say why. Change only one thing.", "Jetzt fehlt Schale B fast alles. Wenn nichts wächst, weißt du nicht, warum. Ändere nur eine Sache."),
    },
  ]);
  return {
    instruction: tx("Plan a fair experiment", "Plane einen fairen Versuch"),
    text: tx(
      `You want to find out whether ${en(seed)} need **${en(F)}** to germinate. Dish A gets water, warmth (22 °C), air and light. How do you set up dish B?`,
      `Du willst herausfinden, ob ${de(seed)} zum Keimen **${de(F)}** brauchen. Schale A bekommt Wasser, Wärme (22 °C), Luft und Licht. Wie setzt du Schale B an?`,
    ),
    answer,
    hint: tx("A fair test changes only one condition. Everything else stays the same.", "Ein fairer Versuch verändert nur eine Bedingung. Alles andere bleibt gleich."),
    solution: [
      { math: tx('"A:"#a \\; "control"#k', '"A:"#a \\; "Kontrollansatz"#k'), note: tx("Dish A has all conditions: it's the control to compare with.", "Schale A hat alle Bedingungen: Sie ist der Kontrollansatz zum Vergleichen.") },
      { math: tx(`"B:"#b \\; "without ${en(F)}"#o`, `"B:"#b \\; "ohne ${de(F)}"#o`), note: tx(`Dish B differs only in ${en(FACTOR_IN[f])}. If its seeds don't germinate, ${en(F)} must be needed.`, `Schale B unterscheidet sich nur ${de(FACTOR_IN[f])}. Keimen ihre Samen nicht, wird ${de(F)} gebraucht.`), highlight: ["o"] },
    ],
    mistakes: list,
  };
}

const NEEDS: { text: Text; right: boolean; say?: Text; title?: Text }[] = [
  { text: tx("water", "Wasser"), right: true },
  { text: tx("warmth", "Wärme"), right: true },
  { text: tx("oxygen", "Sauerstoff"), right: true },
  { text: tx("light", "Licht"), right: false, title: tx("Light isn't needed", "Licht ist nicht nötig"), say: tx("Most seeds germinate in the dark too: their food is stored inside the seed. Light only matters later, for photosynthesis.", "Die meisten Samen keimen auch im Dunkeln: Ihre Nahrung steckt im Samen. Licht ist erst später für die Fotosynthese wichtig.") },
  { text: tx("soil", "Erde"), right: false, title: tx("Cotton wool works too", "Watte reicht auch"), say: tx("Seeds germinate on wet cotton wool too. Soil only gives the young plant a hold, water and minerals later.", "Samen keimen auch auf nasser Watte. Erde gibt der jungen Pflanze erst später Halt, Wasser und Mineralstoffe.") },
  { text: tx("fertiliser", "Dünger"), right: false, title: tx("Food is in the seed", "Vorrat im Samen"), say: tx("The seed brings its own food store (in the cotyledons). Fertiliser doesn't help it germinate.", "Der Samen bringt seinen eigenen Nährstoffvorrat mit (in den Keimblättern). Dünger braucht er zum Keimen nicht.") },
  { text: tx("carbon dioxide", "Kohlenstoffdioxid"), right: false, title: tx("That's for photosynthesis", "Das ist für die Fotosynthese"), say: tx("Carbon dioxide is needed for photosynthesis in green leaves, later on. For germinating, the seed needs oxygen to respire.", "Kohlenstoffdioxid braucht erst das grüne Blatt für die Fotosynthese. Zum Keimen braucht der Samen Sauerstoff zum Atmen.") },
];

function needsTask(rng: Rng): Exercise {
  const right = NEEDS.filter((n) => n.right);
  const wrong = rng.shuffle(NEEDS.filter((n) => !n.right)).slice(0, rng.int(2, 3));
  const items = rng.shuffle([...right, ...wrong]);
  const options = items.map((n) => capT(n.text));
  const correct = where(items, (n) => n.right);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((n, i) => {
    if (!n.right && n.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, n.title!, n.say);
  });
  const ox = items.findIndex((n) => en(n.text) === "oxygen");
  m.add({ kind: "multi", options, correct: correct.filter((i) => i !== ox) }, tx("The seed breathes", "Der Samen atmet"), tx("Almost! You forgot oxygen: the embryo respires to get energy from its food store.", "Fast! Du hast den Sauerstoff vergessen: Der Keimling atmet, um Energie aus seinem Vorrat zu gewinnen."), true);
  return {
    instruction: tx("What does a seed need?", "Was braucht ein Samen?"),
    text: tx("What does a seed need to **germinate**? Select all that apply.", "Was braucht ein Samen zum **Keimen**? Wähle alle passenden aus."),
    answer,
    hint: tx("Think of the germination experiment: which dishes stayed without seedlings?", "Denk an den Keimungsversuch: In welchen Schalen gab es keine Keimlinge?"),
    solution: [{ math: tx('"water" + "warmth" + "oxygen" \\\\ \\to "germination"#k', '"Wasser" + "Wärme" + "Sauerstoff" \\\\ \\to "Keimung"#k'), note: tx("Water, warmth and oxygen. Light, soil and fertiliser aren't needed for germinating.", "Wasser, Wärme und Sauerstoff. Licht, Erde und Dünger braucht der Samen zum Keimen nicht.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Statements and explanations

const TRUE_FACTS: Text[] = [
  tx("Roots take up water and minerals through their root hairs.", "Wurzeln nehmen über ihre Wurzelhaare Wasser und Mineralstoffe auf."),
  tx("Plants make their food (sugar) themselves, in their leaves.", "Pflanzen stellen ihre Nahrung (Zucker) selbst her, in ihren Blättern."),
  tx("Most seeds can germinate in the dark.", "Die meisten Samen können im Dunkeln keimen."),
  tx("A seed needs water, warmth and oxygen to germinate.", "Ein Samen braucht zum Keimen Wasser, Wärme und Sauerstoff."),
  tx("The shoot axis carries the leaves and transports water upwards.", "Die Sprossachse trägt die Blätter und leitet Wasser nach oben."),
  tx("Fruits with seeds develop from the flower.", "Aus der Blüte entstehen Früchte mit Samen."),
  tx("Root cells need oxygen too, so waterlogged soil can harm a plant.", "Auch Wurzelzellen brauchen Sauerstoff, darum kann Staunässe einer Pflanze schaden."),
  tx("Plants release the oxygen that humans and animals breathe.", "Pflanzen geben den Sauerstoff ab, den Menschen und Tiere atmen."),
  tx("Most of a plant's mass is built from carbon dioxide from the air and water.", "Die Masse einer Pflanze stammt vor allem aus Kohlenstoffdioxid aus der Luft und aus Wasser."),
];

const MYTHS: { text: Text; title: Text; say: Text }[] = [
  {
    text: tx("Plants take their food out of the soil.", "Pflanzen holen ihre Nahrung aus der Erde."),
    title: tx("Plants don't eat soil", "Pflanzen essen keine Erde"),
    say: tx("That's the classic trap! Plants make their food (sugar) themselves in the leaves, from water and carbon dioxide using light. The soil only gives water and minerals.", "Die klassische Falle! Pflanzen stellen ihre Nahrung (Zucker) im Blatt selbst her, aus Wasser und Kohlenstoffdioxid mit Licht. Der Boden liefert nur Wasser und Mineralstoffe."),
  },
  { text: tx("Seeds need light to germinate.", "Samen brauchen zum Keimen Licht."), title: tx("They germinate in the dark", "Sie keimen im Dunkeln"), say: NEED_SAY.light },
  { text: tx("Seeds need soil to germinate.", "Samen brauchen zum Keimen Erde."), title: tx("Cotton wool works too", "Watte reicht auch"), say: tx("Seeds germinate on wet cotton wool too. Soil only gives the young plant a hold and minerals later.", "Samen keimen auch auf nasser Watte. Erde gibt der jungen Pflanze erst später Halt und Mineralstoffe.") },
  { text: tx("Leaves take up most of the water a plant needs.", "Blätter nehmen den größten Teil des Wassers auf, das eine Pflanze braucht."), title: tx("Water comes from below", "Wasser kommt von unten"), say: tx("Leaves mostly lose water: it evaporates from them. The water gets in through the roots, via the root hairs.", "Blätter geben vor allem Wasser ab: Es verdunstet aus ihnen. Hinein kommt das Wasser über die Wurzeln, genauer die Wurzelhaare.") },
  { text: tx("Roots only anchor the plant.", "Wurzeln verankern die Pflanze nur."), title: tx("Roots do more", "Wurzeln können mehr"), say: tx("Anchoring is one job. Roots also take up water and minerals, and some store food (carrot).", "Verankern ist eine Aufgabe. Wurzeln nehmen außerdem Wasser und Mineralstoffe auf, und manche speichern Nährstoffe (Möhre).") },
  { text: tx("Plant roots don't need air.", "Pflanzenwurzeln brauchen keine Luft."), title: tx("Roots breathe too", "Wurzeln atmen auch"), say: tx("Root cells respire and need oxygen from the air in the soil. In waterlogged soil, roots can suffocate.", "Wurzelzellen atmen und brauchen Sauerstoff aus der Bodenluft. In nassem, verdichtetem Boden können Wurzeln ersticken.") },
  { text: tx("The flower is only there to look pretty.", "Die Blüte ist nur zum Schmuck da."), title: tx("Flowers make seeds", "Blüten machen Samen"), say: tx("The flower is for reproduction: fruits and seeds develop from it. Its colours and scent attract insects for pollination.", "Die Blüte dient der Fortpflanzung: Aus ihr entstehen Früchte und Samen. Farben und Duft locken Insekten zur Bestäubung an.") },
  { text: tx("A potato is a root.", "Eine Kartoffel ist eine Wurzel."), title: tx("A swollen shoot", "Ein verdickter Spross"), say: tx("It grows in the soil, but a potato is a swollen shoot axis (stem tuber): its eyes are buds.", "Sie wächst in der Erde, ist aber eine verdickte Sprossachse (Sprossknolle): Ihre Augen sind Knospen.") },
];

function statementTask(rng: Rng): Exercise {
  const truth = rng.pick(TRUE_FACTS);
  const myths = rng.shuffle(MYTHS).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: truth }, ...myths.map((m) => ({ text: m.text, title: m.title, say: m.say }))]);
  return {
    instruction: tx("Which statement is true?", "Welche Aussage stimmt?"),
    text: tx("Only one of these statements is right. Which one?", "Nur eine dieser Aussagen ist richtig. Welche?"),
    answer,
    hint: tx("Watch out for popular myths about plants: soil, light and water.", "Achte auf beliebte Irrtümer über Pflanzen: Erde, Licht und Wasser."),
    solution: [{ math: tx('"true:"#t', '"richtig:"#t'), note: truth, highlight: ["t"] }],
    mistakes: list,
  };
}

const WHY: { q: Text; a: Text; wrong: Opt[]; note: Text }[] = [
  {
    q: tx("Why does a root have so many root hairs?", "Warum hat eine Wurzel so viele Wurzelhaare?"),
    a: tx("They make the surface much bigger, so more water and minerals are taken up.", "Sie vergrößern die Oberfläche stark, so wird mehr Wasser mit Mineralstoffen aufgenommen."),
    wrong: [
      { text: tx("They breathe in air for the whole plant.", "Sie atmen Luft für die ganze Pflanze ein."), title: tx("Mainly for water", "Vor allem für Wasser"), say: tx("Root cells do need some oxygen, but root hairs are there mainly to take up water and minerals: their huge surface makes that possible.", "Wurzelzellen brauchen zwar etwas Sauerstoff, aber Wurzelhaare sind vor allem für Wasser und Mineralstoffe da: Ihre riesige Oberfläche macht das möglich.") },
      { text: tx("They suck food (sugar) out of the soil.", "Sie saugen Nahrung (Zucker) aus dem Boden."), title: tx("No sugar in the soil", "Kein Zucker aus dem Boden"), say: MYTHS[0].say },
      { text: tx("They protect the root from animals.", "Sie schützen die Wurzel vor Tieren."), title: tx("Think of their size", "Denk an ihre Größe"), say: tx("Root hairs are tiny and delicate, no protection at all. What could so many tiny hairs be good for?", "Wurzelhaare sind winzig und zart, ein Schutz sind sie nicht. Wofür könnten so viele winzige Haare gut sein?") },
    ],
    note: tx("Many hairs, huge surface: more water and minerals can enter.", "Viele Haare, riesige Oberfläche: Mehr Wasser und Mineralstoffe können hinein."),
  },
  {
    q: tx("Why do bean seeds germinate even in a dark cupboard?", "Warum keimen Bohnensamen sogar in einem dunklen Schrank?"),
    a: tx("Their food is stored in the cotyledons, so they don't need light yet.", "Ihre Nährstoffe sind in den Keimblättern gespeichert, Licht brauchen sie noch nicht."),
    wrong: [
      { text: tx("They make sugar by photosynthesis in the dark.", "Sie machen im Dunkeln Fotosynthese."), title: tx("Photosynthesis needs light", "Fotosynthese braucht Licht"), say: tx("Photosynthesis only works with light. In the dark the seedling lives on the food stored in the seed.", "Fotosynthese funktioniert nur mit Licht. Im Dunkeln lebt der Keimling von den Vorräten im Samen.") },
      { text: tx("They take food from the cotton wool.", "Sie holen sich Nahrung aus der Watte."), title: tx("Cotton wool is no food", "Watte ist keine Nahrung"), say: tx("Cotton wool only holds the water. The food is in the seed itself.", "Die Watte hält nur das Wasser. Die Nahrung steckt im Samen selbst.") },
      { text: tx("Plants never need light.", "Pflanzen brauchen nie Licht."), title: tx("Later they do", "Später schon"), say: tx("Germinating works in the dark, but later the plant needs light for photosynthesis, or it starves.", "Keimen klappt im Dunkeln, aber später braucht die Pflanze Licht für die Fotosynthese, sonst verhungert sie.") },
    ],
    note: tx("The seed carries a packed lunch: the food in its cotyledons.", "Der Samen hat ein Lunchpaket dabei: die Nährstoffe in seinen Keimblättern."),
  },
  {
    q: tx("Why do seedlings that grow in the dark turn pale yellow?", "Warum werden Keimlinge, die im Dunkeln wachsen, bleich und gelblich?"),
    a: tx("Without light they make no chlorophyll, the green pigment.", "Ohne Licht bilden sie kein Chlorophyll, den grünen Farbstoff."),
    wrong: [
      { text: tx("They don't get enough water.", "Sie bekommen zu wenig Wasser."), title: tx("Water was there", "Wasser war da"), say: tx("They had water, otherwise they wouldn't have germinated. The colour has to do with the missing light.", "Wasser hatten sie, sonst wären sie nicht gekeimt. Die Farbe hat mit dem fehlenden Licht zu tun.") },
      { text: tx("They lack oxygen.", "Ihnen fehlt Sauerstoff."), title: tx("Oxygen was there", "Sauerstoff war da"), say: tx("Without oxygen they wouldn't have germinated at all. What's missing in the dark?", "Ohne Sauerstoff wären sie gar nicht gekeimt. Was fehlt im Dunkeln?") },
      { text: tx("They are ill.", "Sie sind krank."), title: tx("Not ill", "Nicht krank"), say: tx("They're healthy. Put them in the light and they turn green within a few days.", "Sie sind gesund. Stellt man sie ins Licht, werden sie in wenigen Tagen grün.") },
    ],
    note: tx("Chlorophyll is made only in the light.", "Chlorophyll wird nur im Licht gebildet."),
  },
  {
    q: tx("Seeds lie under boiled water with a layer of oil on top. Why don't they germinate?", "Samen liegen unter abgekochtem Wasser mit einer Ölschicht darauf. Warum keimen sie nicht?"),
    a: tx("They get no oxygen, so the embryo can't respire.", "Sie bekommen keinen Sauerstoff, darum kann der Keimling nicht atmen."),
    wrong: [
      { text: tx("They have too much water.", "Sie haben zu viel Wasser."), title: tx("It's about the air", "Es geht um die Luft"), say: tx("Boiling drives the air out of the water and the oil stops new air getting in. What is missing then?", "Abkochen treibt die Luft aus dem Wasser, und das Öl lässt keine neue Luft hinein. Was fehlt dann?") },
      { text: tx("They get no light under the oil.", "Unter dem Öl bekommen sie kein Licht."), title: tx("Light isn't needed", "Licht ist nicht nötig"), say: NEED_SAY.light },
      { text: tx("The water is too warm for them.", "Das Wasser ist ihnen zu warm."), title: tx("It's cooled down", "Es ist abgekühlt"), say: tx("The boiled water has cooled down again. The point of boiling is something else: it drives out the air.", "Das abgekochte Wasser ist wieder abgekühlt. Der Sinn des Abkochens ist ein anderer: Es treibt die Luft heraus.") },
    ],
    note: tx("Boiling removes the dissolved air, the oil keeps new air out: no oxygen.", "Abkochen entfernt die gelöste Luft, das Öl hält neue Luft fern: kein Sauerstoff."),
  },
  {
    q: tx("Why does a seed swell before it germinates?", "Warum quillt ein Samen, bevor er keimt?"),
    a: tx("It takes up water.", "Er nimmt Wasser auf."),
    wrong: [
      { text: tx("It takes up air.", "Er nimmt Luft auf."), title: tx("Water, not air", "Wasser, nicht Luft"), say: tx("A dry seed soaks up water like a sponge. That's what makes it swell.", "Ein trockener Samen saugt sich mit Wasser voll wie ein Schwamm. Davon quillt er.") },
      { text: tx("It makes sugar.", "Er stellt Zucker her."), title: tx("No photosynthesis yet", "Noch keine Fotosynthese"), say: tx("There's no green leaf yet to make sugar. The swelling comes from water soaking in.", "Es gibt noch kein grünes Blatt, das Zucker herstellen könnte. Das Quellen kommt vom eindringenden Wasser.") },
      { text: tx("It warms up.", "Er wird warm."), title: tx("Water does it", "Das macht das Wasser"), say: tx("Warmth speeds things up, but the swelling itself comes from water soaking in.", "Wärme beschleunigt alles, aber das Quellen selbst kommt vom eindringenden Wasser.") },
    ],
    note: tx("Water soaks into the dry seed: it swells and the seed coat bursts.", "Wasser dringt in den trockenen Samen ein: Er quillt, und die Samenschale platzt."),
  },
  {
    q: tx("Why are green plants so important for animals and humans?", "Warum sind grüne Pflanzen für Tiere und Menschen so wichtig?"),
    a: tx("They produce food and the oxygen we breathe.", "Sie stellen Nahrung her und geben den Sauerstoff ab, den wir atmen."),
    wrong: [
      { text: tx("They use up the carbon dioxide we need to breathe.", "Sie verbrauchen das Kohlenstoffdioxid, das wir zum Atmen brauchen."), title: tx("We breathe oxygen", "Wir atmen Sauerstoff"), say: tx("We breathe in oxygen and breathe out carbon dioxide. Plants use the carbon dioxide and give off oxygen.", "Wir atmen Sauerstoff ein und Kohlenstoffdioxid aus. Pflanzen nutzen das Kohlenstoffdioxid und geben Sauerstoff ab.") },
      { text: tx("They make the minerals in the soil.", "Sie stellen die Mineralstoffe im Boden her."), title: tx("They take minerals up", "Sie nehmen Mineralstoffe auf"), say: tx("Plants take up minerals from the soil, they don't make them. What do they produce in their leaves?", "Pflanzen nehmen Mineralstoffe aus dem Boden auf, sie stellen sie nicht her. Was stellen sie in ihren Blättern her?") },
      { text: tx("They eat the soil and keep it clean.", "Sie fressen die Erde und halten sie sauber."), title: tx("Plants don't eat soil", "Pflanzen essen keine Erde"), say: MYTHS[0].say },
    ],
    note: tx("Every food chain starts with plants, and their photosynthesis releases oxygen.", "Jede Nahrungskette beginnt mit Pflanzen, und bei ihrer Fotosynthese entsteht Sauerstoff."),
  },
];

function whyTask(rng: Rng, fixed?: number): Exercise {
  const w = WHY[fixed ?? rng.int(0, WHY.length - 1)];
  const { answer, mistakes: list } = choice(rng, [{ text: w.a }, ...w.wrong]);
  return {
    instruction: tx("Choose the explanation", "Wähle die Erklärung"),
    text: w.q,
    answer,
    hint: tx("Which answer explains what really happens inside the plant?", "Welche Antwort erklärt, was in der Pflanze wirklich passiert?"),
    solution: [{ math: tx('"because:"#b', '"weil:"#b'), note: tx(`${en(w.a)} ${en(w.note)}`, `${de(w.a)} ${de(w.note)}`), highlight: ["b"] }],
    mistakes: list,
  };
}

const STAGES: Text[] = [
  tx("The seed takes up water and swells.", "Der Samen nimmt Wasser auf und quillt."),
  tx("The seed coat bursts open.", "Die Samenschale platzt auf."),
  tx("The radicle (seed root) grows downwards.", "Die Keimwurzel wächst nach unten."),
  tx("The shoot grows up in a hook and breaks through the soil.", "Der Keimstängel wächst hakenförmig nach oben und durchbricht die Erde."),
  tx("The first foliage leaves unfold and turn green.", "Die ersten Laubblätter entfalten sich und werden grün."),
];

const STAGE_SHORT: Text[] = [tx("swelling", "Quellung"), tx("seed coat bursts", "Samenschale platzt"), tx("radicle grows down", "Keimwurzel wächst"), tx("shoot breaks through", "Keimstängel bricht durch"), tx("green leaves unfold", "grüne Laubblätter")];
/** A numbered list of the stages, one per line. */
const listOf = (items: Text[], l: "en" | "de") => items.map((it, i) => `"${i + 1}. ${resolveText(STAGE_SHORT[STAGES.findIndex((x) => en(x) === en(it))], l)}"#s${i}`).join(" \\\\ ");

function orderTask(rng: Rng): Exercise {
  const drop = rng.pick([-1, -1, 1, 2, 3, 4]);
  const items = STAGES.filter((_, i) => i !== drop);
  const has = (i: number) => items.includes(STAGES[i]);
  const list: Mistake[] = [];
  if (has(2) && has(3))
    list.push({ when: { kind: "order", items: [STAGES[3], STAGES[2]] }, title: tx("The root comes first", "Die Wurzel kommt zuerst"), say: tx("The radicle always comes out first: it anchors the seedling and brings it water. Only then does the shoot grow up.", "Die Keimwurzel kommt immer zuerst heraus: Sie verankert den Keimling und versorgt ihn mit Wasser. Erst danach wächst der Keimstängel nach oben.") });
  if (has(0) && has(1)) list.push({ when: { kind: "order", items: [STAGES[1], STAGES[0]] }, title: tx("Swelling bursts the coat", "Das Quellen sprengt die Schale"), say: tx("The seed coat bursts because the seed swells with water. So swelling comes first.", "Die Samenschale platzt, weil der Samen durch das Wasser quillt. Das Quellen kommt also zuerst.") });
  if (has(4) && has(3)) list.push({ when: { kind: "order", items: [STAGES[4], STAGES[3]] }, title: tx("Leaves need the light", "Blätter brauchen Licht"), say: tx("The leaves unfold and turn green only once the shoot has broken through the soil into the light.", "Die Blätter entfalten sich und werden grün, wenn der Keimstängel die Erde durchbrochen hat und im Licht ist.") });
  return {
    instruction: tx("Put the germination in order", "Bring die Keimung in die richtige Reihenfolge"),
    text: tx("A bean seed germinates. Put the steps in the right order.", "Ein Bohnensamen keimt. Bring die Schritte in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("What has to happen before the seed coat can burst? Which part comes out first?", "Was muss passieren, bevor die Samenschale platzen kann? Welcher Teil kommt zuerst heraus?"),
    solution: [
      { math: tx(listOf(items.slice(0, 2), "en"), listOf(items.slice(0, 2), "de")), note: tx("First the seed swells with water, which bursts the seed coat.", "Zuerst quillt der Samen mit Wasser, dadurch platzt die Samenschale.") },
      { math: tx(listOf(items, "en"), listOf(items, "de")), note: tx("Then the radicle comes out, the shoot pushes up, and in the light the first leaves turn green.", "Dann kommt die Keimwurzel heraus, der Keimstängel schiebt sich nach oben, und im Licht werden die ersten Blätter grün."), highlight: [`s${items.length - 1}`] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  return pickTask(
    rng,
    [
      [3, nameTask],
      [3, (r) => organTask(r)],
      [2, (r) => matchTask(r)],
      [2, predictTask],
      [2, (r) => interpretTask(r)],
      [1.5, fairTask],
      [1.5, needsTask],
      [2, statementTask],
      [2, foodTask],
      [1.5, orderTask],
      [2, (r) => whyTask(r)],
    ],
    nameTask,
  );
}

// ---------------------------------------------------------------------------
// Lesson

const organFrames: Frame[] = [
  { math: tx('"root"#w', '"Wurzel"#w'), note: tx("Below the ground is the **root**.", "Unten in der Erde steckt die **Wurzel**.") },
  {
    math: tx('"root"#w \\quad "shoot axis"#s', '"Wurzel"#w \\quad "Sprossachse"#s'),
    note: tx("Above it stands the **shoot axis**: the stem in herbs, the trunk in trees, the culm in grasses.", "Darüber steht die **Sprossachse**: bei Kräutern der Stängel, bei Bäumen der Stamm, bei Gräsern der Halm."),
  },
  { math: tx('"root"#w \\quad "shoot axis"#s \\quad "leaves"#b', '"Wurzel"#w \\quad "Sprossachse"#s \\quad "Blätter"#b'), note: tx("The **leaves** (foliage leaves) grow on the shoot axis.", "An der Sprossachse sitzen die **Blätter** (Laubblätter).") },
  {
    math: tx('"root"#w \\quad "shoot axis"#s \\quad "leaves"#b \\quad "flowers"#f', '"Wurzel"#w \\quad "Sprossachse"#s \\quad "Blätter"#b \\quad "Blüten"#f'),
    note: tx("At the top are the **flowers**. These are the basic organs of a flowering plant.", "Oben sitzen die **Blüten**. Das sind die Grundorgane einer Blütenpflanze."),
  },
  {
    math: tx('"shoot"#sp = "shoot axis"#s + "leaves"#b + "flowers"#f', '"Spross"#sp = "Sprossachse"#s + "Blätter"#b + "Blüten"#f'),
    note: tx("Everything above the ground together is the **shoot**. Botanists put it more precisely: a flower is a changed piece of shoot with special leaves.", "Alles über der Erde zusammen heißt **Spross**. Botaniker sagen genauer: Eine Blüte ist ein umgewandelter Sprossabschnitt mit besonderen Blättern."),
    highlight: ["sp"],
  },
];

const rootFrames: Frame[] = [
  { math: tx('"root"#w \\to "anchoring"#a', '"Wurzel"#w \\to "Verankerung"#a'), note: tx("The root anchors the plant in the ground, so wind and rain can't knock it over.", "Die Wurzel verankert die Pflanze im Boden, damit Wind und Regen sie nicht umwerfen.") },
  {
    math: tx('"root hairs"#h \\to "water + minerals"#m', '"Wurzelhaare"#h \\to "Wasser + Mineralstoffe"#m'),
    note: tx("Fine **root hairs** take up water and the **minerals** dissolved in it. Each root hair is an outgrowth of one single cell.", "Feine **Wurzelhaare** nehmen Wasser und die darin gelösten **Mineralstoffe** (Nährsalze) auf. Jedes Wurzelhaar ist die Ausstülpung einer einzigen Zelle."),
    highlight: ["h"],
  },
  {
    math: tx('"many hairs"#h \\to "huge surface"#o', '"viele Haare"#h \\to "riesige Oberfläche"#o'),
    note: tx("Because there are so many, the surface is huge: a single rye plant has about 14 billion root hairs!", "Weil es so viele sind, ist die Oberfläche riesig: Eine einzige Roggenpflanze hat rund 14 Milliarden Wurzelhaare!"),
  },
  { math: tx('"carrot"#c \\to "food store"#sp', '"Möhre"#c \\to "Speicher"#sp'), note: tx("Some roots store food, for example the carrot.", "Manche Wurzeln speichern Nährstoffe, zum Beispiel die Möhre.") },
  {
    math: tx('"root cells"#z \\to "need oxygen"#o', '"Wurzelzellen"#z \\to "brauchen Sauerstoff"#o'),
    note: tx("Root cells respire too and need oxygen from the air in the soil. If a plant stands in water for weeks, its roots can suffocate.", "Auch Wurzelzellen atmen und brauchen Sauerstoff aus der Bodenluft. Steht eine Pflanze wochenlang im Wasser, können ihre Wurzeln ersticken."),
  },
];

const shootFrames: Frame[] = [
  {
    math: tx('"shoot axis"#s \\to "carry and transport"#t', '"Sprossachse"#s \\to "tragen und leiten"#t'),
    note: tx("The shoot axis holds the leaves and flowers up to the light. Water rises inside it, and sugar from the leaves is sent to every part.", "Die Sprossachse hält Blätter und Blüten ins Licht. In ihr steigt Wasser nach oben, und Zucker aus den Blättern wird in alle Teile verteilt."),
  },
  {
    math: tx('"water"#w + "carbon dioxide"#k \\to "sugar"#z + "oxygen"#o', '"Wasser"#w + "Kohlenstoffdioxid"#k \\to "Traubenzucker"#z + "Sauerstoff"#o'),
    note: tx("In the **leaf** the plant makes its own food using light energy: **photosynthesis**. Oxygen is released.", "Im **Blatt** stellt die Pflanze mit Lichtenergie ihre Nahrung selbst her: die **Fotosynthese**. Dabei wird Sauerstoff frei."),
  },
  { math: tx('"flower"#f \\to "fruits and seeds"#fs', '"Blüte"#f \\to "Früchte und Samen"#fs'), note: tx("The **flower** is for reproduction. After pollination and fertilisation, fruits with seeds develop.", "Die **Blüte** dient der Fortpflanzung. Nach Bestäubung und Befruchtung entstehen Früchte mit Samen.") },
  {
    math: tx('"plants"#p \\to "oxygen, food, wood"#n', '"Pflanzen"#p \\to "Sauerstoff, Nahrung, Holz"#n'),
    note: tx("That's why plants matter so much: they give off the oxygen we breathe and start every food chain. Add wood, cotton, paper and medicines, and their roots hold the soil in place.", "Darum sind Pflanzen so wichtig: Sie geben den Sauerstoff ab, den wir atmen, und stehen am Anfang jeder Nahrungskette. Dazu kommen Holz, Baumwolle, Papier und Arzneistoffe, und ihre Wurzeln halten den Boden fest."),
  },
];

const helmontFrames: Frame[] = [
  {
    math: tx('"willow:"#a \\; 2.3#m1 "kg"#u1', '"Weide:"#a \\; 2,3#m1 "kg"#u1'),
    note: tx("Around 1640 Jan Baptist van Helmont planted a small willow tree (about 2.3 kg) in a pot with 90.7 kg of dried soil. For five years he only watered it.", "Um 1640 pflanzte Jan Baptist van Helmont eine kleine Weide (etwa 2,3 kg) in einen Topf mit 90,7 kg getrockneter Erde. Fünf Jahre lang goss er sie nur mit Wasser."),
  },
  { math: tx('"willow:"#a \\; 2.3#m1 "kg"#u1 \\to 76.7#m2 "kg"#u2', '"Weide:"#a \\; 2,3#m1 "kg"#u1 \\to 76,7#m2 "kg"#u2'), note: tx("After five years the willow weighed about 76.7 kg.", "Nach fünf Jahren wog die Weide etwa 76,7 kg."), highlight: ["m2"] },
  { math: tx('"soil:"#e \\; "only 57 g lighter"#d', '"Erde:"#e \\; "nur 57 g leichter"#d'), note: tx("And the soil? It had lost only about 57 grams!", "Und die Erde? Sie war nur um etwa 57 Gramm leichter geworden!"), highlight: ["d"] },
  {
    math: tx('"carbon dioxide"#k + "water"#w \\to "mass of the plant"#ms', '"Kohlenstoffdioxid"#k + "Wasser"#w \\to "Masse der Pflanze"#ms'),
    note: tx("So plants don't eat soil. They build their mass mainly from **carbon dioxide from the air** and water. From the soil they take only water and a few grams of minerals.", "Pflanzen fressen also keine Erde. Ihre Masse bauen sie vor allem aus **Kohlenstoffdioxid aus der Luft** und Wasser auf. Aus dem Boden nehmen sie nur Wasser und wenige Gramm Mineralstoffe."),
    highlight: ["k"],
  },
];

const seedFrames: Frame[] = [
  {
    math: tx('"seed"#s = "seed coat"#a + "cotyledons"#b + "embryo"#c', '"Samen"#s = "Samenschale"#a + "Keimblätter"#b + "Keimling"#c'),
    note: tx("A bean seed has a **seed coat**, two thick **cotyledons** (seed leaves) packed with food, and the **embryo**.", "Ein Bohnensamen hat eine **Samenschale**, zwei dicke **Keimblätter** voller Nährstoffe und den **Keimling** (Embryo)."),
  },
  { math: tx('"water"#w \\to "swelling"#q', '"Wasser"#w \\to "Quellung"#q'), note: tx("First the seed takes up water and swells: it gets bigger until the seed coat bursts.", "Zuerst nimmt der Samen Wasser auf und quillt: Er wird größer, bis die Samenschale platzt.") },
  {
    math: tx('"radicle"#kw \\to "shoot"#ks \\to "leaves"#lb', '"Keimwurzel"#kw \\to "Keimstängel"#ks \\to "Laubblätter"#lb'),
    note: tx("Then the **radicle** (seed root) grows downwards, after it the shoot grows upwards. Finally the first foliage leaves unfold.", "Dann wächst die **Keimwurzel** nach unten, danach der Keimstängel nach oben. Zuletzt entfalten sich die ersten Laubblätter."),
  },
  {
    math: tx('"water"#w + "warmth"#wa + "oxygen"#o \\to "germination"#k', '"Wasser"#w + "Wärme"#wa + "Sauerstoff"#o \\to "Keimung"#k'),
    note: tx("To germinate, a seed needs **water**, **warmth** and **oxygen**. It needs the oxygen to respire: that's how it gets energy from its food stores.", "Zum Keimen braucht ein Samen **Wasser**, **Wärme** und **Sauerstoff**. Den Sauerstoff braucht er zum Atmen: So gewinnt er Energie aus seinen Vorräten."),
  },
];

const checkWater = organTask(createRng(11), { organ: "root", job: 1 });
const checkMatch = matchTask(createRng(5), [0, 1, 0, 1]);
const checkOxygen = interpretTask(createRng(21), "oxygen");
const checkNeeds = needsTask(createRng(8));

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Four parts, one team", "Vier Teile, ein Team"),
      blob: tx("Let's look at a flowering plant from bottom to top!", "Schauen wir uns eine Blütenpflanze mal von unten bis oben an!"),
      body: tx("Whether daisy, sunflower or apple tree: every flowering plant is built from the same basic parts.", "Ob Gänseblümchen, Sonnenblume oder Apfelbaum: Jede Blütenpflanze ist aus denselben Grundteilen gebaut."),
      frames: organFrames,
    },
    {
      type: "widget",
      title: tx("Explore the plant", "Erkunde die Pflanze"),
      blob: tx("Tap the numbers. Each part has its own job!", "Tipp auf die Nummern. Jedes Teil hat seine eigene Aufgabe!"),
      body: tx("Tap a number or a name to see what that part does. The magnifier shows the tip of a root.", "Tipp auf eine Nummer oder einen Namen, dann siehst du, was das Teil leistet. Die Lupe zeigt eine Wurzelspitze."),
      widget: () => <PlantWhole mode="explore" />,
    },
    {
      type: "explain",
      title: tx("What the root does", "Was die Wurzel leistet"),
      blob: tx("The hidden half of the plant works really hard!", "Die versteckte Hälfte der Pflanze arbeitet richtig hart!"),
      frames: rootFrames,
    },
    { type: "check", blob: tx("Where does the water get in?", "Wo kommt das Wasser hinein?"), exercise: checkWater },
    {
      type: "explain",
      title: tx("Shoot axis, leaf and flower", "Sprossachse, Blatt und Blüte"),
      blob: tx("Now upwards, into the light!", "Jetzt nach oben, ins Licht!"),
      frames: shootFrames,
    },
    {
      type: "explain",
      title: tx("Do plants eat soil?", "Fressen Pflanzen Erde?"),
      blob: tx("An experiment almost 400 years old. Guess the result!", "Ein fast 400 Jahre alter Versuch. Rate mal das Ergebnis!"),
      frames: helmontFrames,
    },
    { type: "check", blob: tx("Who does what? One card is a trap!", "Wer macht was? Eine Karte ist eine Falle!"), exercise: checkMatch },
    {
      type: "explain",
      title: tx("What a seed needs to germinate", "Was ein Samen zum Keimen braucht"),
      blob: tx("A tiny seed, a whole plant inside. Let's wake it up!", "Ein winziger Samen, eine ganze Pflanze darin. Wecken wir ihn auf!"),
      frames: seedFrames,
    },
    {
      type: "widget",
      title: tx("Your germination experiment", "Dein Keimungsversuch"),
      blob: tx("You're the scientist now. Change one thing at a time!", "Jetzt bist du die Forscherin oder der Forscher. Ändere immer nur eine Sache!"),
      body: tx(
        "Bean seeds lie on cotton wool. Switch water, warmth, oxygen and light on or off and let a week pass. Always compare with the control dish, where everything is on.",
        "Bohnensamen liegen auf Watte. Schalte Wasser, Wärme, Sauerstoff und Licht an oder aus und lass eine Woche ablaufen. Vergleiche immer mit dem Kontrollansatz, bei dem alles an ist.",
      ),
      widget: PlantGermination,
    },
    { type: "check", blob: tx("A real experiment. What does it tell you?", "Ein echter Versuch. Was verrät er dir?"), exercise: checkOxygen },
    { type: "check", blob: tx("Last one: the full list!", "Zum Schluss: die ganze Liste!"), exercise: checkNeeds },
  ],
  summary: [
    {
      title: tx("How a flowering plant is built", "Bau einer Blütenpflanze"),
      body: tx(
        "Basic organs: root, shoot axis (stem, trunk), leaves and flowers. Shoot axis, leaves and flowers together form the shoot.",
        "Grundorgane: Wurzel, Sprossachse (Stängel, Stamm), Blätter und Blüten. Sprossachse, Blätter und Blüten bilden zusammen den Spross.",
      ),
      examples: [tx('"shoot" = "shoot axis" + "leaves" + "flowers"', '"Spross" = "Sprossachse" + "Blätter" + "Blüten"')],
      tone: "rule",
    },
    {
      title: tx("Who does what", "Wer macht was"),
      body: tx(
        "Root: anchors, takes up water and minerals through root hairs, sometimes stores food. Shoot axis: carries, transports water and sugar. Leaf: photosynthesis. Flower: reproduction (fruits and seeds).",
        "Wurzel: verankert, nimmt über Wurzelhaare Wasser und Mineralstoffe auf, speichert manchmal. Sprossachse: trägt, leitet Wasser und Zucker. Blatt: Fotosynthese. Blüte: Fortpflanzung (Früchte und Samen).",
      ),
      examples: [tx('"leaf:" \\; "water" + "carbon dioxide" \\to "sugar" + "oxygen"', '"Blatt:" \\; "Wasser" + "Kohlenstoffdioxid" \\to "Zucker" + "Sauerstoff"')],
      tone: "rule",
    },
    {
      title: tx("Germination", "Keimung"),
      body: tx(
        "The seed swells with water, the seed coat bursts, the radicle comes out first, then the shoot grows up and the first leaves turn green. The food comes from the cotyledons.",
        "Der Samen quillt mit Wasser, die Samenschale platzt, zuerst kommt die Keimwurzel, dann wächst der Keimstängel nach oben, und die ersten Laubblätter werden grün. Die Nährstoffe stammen aus den Keimblättern.",
      ),
      examples: [tx('"water" + "warmth" + "oxygen" \\to "germination"', '"Wasser" + "Wärme" + "Sauerstoff" \\to "Keimung"')],
      tone: "rule",
    },
    {
      title: tx("Germination experiments", "Keimungsversuche auswerten"),
      body: tx(
        "Change only one condition and compare with the control dish (everything on). If the seeds don't germinate without that condition, it is needed. Seeds in the dark germinate, but grow pale and long.",
        "Ändere nur eine Bedingung und vergleiche mit dem Kontrollansatz (alles an). Keimen die Samen ohne diese Bedingung nicht, ist sie nötig. Samen im Dunkeln keimen, werden aber bleich und lang.",
      ),
      tone: "tip",
    },
    {
      title: tx("Why plants matter", "Warum Pflanzen wichtig sind"),
      body: tx("They give off oxygen, start every food chain, give us wood, fibres, paper and medicines, and their roots protect the soil.", "Sie geben Sauerstoff ab, stehen am Anfang jeder Nahrungskette, liefern Holz, Fasern, Papier und Arzneistoffe, und ihre Wurzeln schützen den Boden."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Plants don't eat soil: they make their food in the leaves; from the soil come only water and minerals. Most seeds don't need light or soil to germinate. A potato is a shoot, not a root.",
        "Pflanzen fressen keine Erde: Ihre Nahrung stellen sie im Blatt her, aus dem Boden kommen nur Wasser und Mineralstoffe. Die meisten Samen brauchen zum Keimen weder Licht noch Erde. Die Kartoffel ist ein Spross, keine Wurzel.",
      ),
      tone: "warning",
    },
  ],
};
